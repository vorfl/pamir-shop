// PAMIR — Cloudflare Worker.
// 1) webhook Telegram -> Apps Script (POST на любой адрес, кроме /purge);
// 2) GET /catalog — публичный каталог из кэша (Apps Script ?action=catalog);
// 3) POST /purge — сброс кэша каталога (шлёт Apps Script, ключ X-Pamir-Key);
// 4) cron: проверка Apps Script (?action=ping) и сообщения админам.
//
// Секреты и настройки — только в Cloudflare (Settings -> Variables and secrets):
//   GAS_URL, WEBHOOK_SECRET            обязательные (уже есть)
//   BOT_TOKEN, ADMIN_CHAT_IDS          необязательные: без них слежение молчит
//   PAMIR_KV                           необязательная привязка KV (хранилище)
// В этом файле секретов нет.

const FRESH_MS = 60 * 1000;            // каталог свежий 60 с
const KEEP_MS = 24 * 60 * 60 * 1000;   // прошлый хороший ответ живёт до 24 ч
const KV_REWRITE_MS = 30 * 60 * 1000;  // в KV не пишем чаще, если ответ не изменился
const MSG_GAP_MS = 30 * 60 * 1000;     // сообщение одного вида не чаще раза в 30 мин
const GAS_TIMEOUT_MS = 20 * 1000;
const CACHE_KEY_CATALOG = 'https://pamir-cache.invalid/catalog';
const CACHE_KEY_STATE = 'https://pamir-cache.invalid/monitor-state';
const KV_CATALOG = 'catalog';
const KV_STATE = 'monitor-state';

// Память изолята: первый слой кэша
const PAUSE_MS = 30 * 1000;            // после сбоя Apps Script 30 с не ходим за каталогом
const PURGE_GAP_MS = 5 * 1000;         // purge чаще раза в 5 с нового чтения не запускает
const CACHE_KEY_PAUSE = 'https://pamir-cache.invalid/catalog-pause';
const mem = { catalog: null, kvWrittenAt: 0, inflight: null, pauseUntil: 0, purgeAt: 0 };

// Каталог без поля updated (время сборки): по нему понимаем, изменился ли каталог на самом деле.
// Без JSON.parse: вырезаем значение первого "updated" обычной заменой в строке.
function normalizeCatalog(body) {
  return body.replace(/"updated"\s*:\s*("(?:[^"\\]|\\.)*"|-?[0-9.eE+-]+|null)/, '"updated":0');
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    if (request.method === 'GET' && path === '/catalog') {
      return handleCatalog(env, ctx);
    }

    if (request.method === 'POST' && path === '/purge') {
      return handlePurge(request, env, ctx);
    }

    // Открытие адреса в браузере — просто проверка, что Worker жив
    if (request.method !== 'POST') {
      return new Response('PAMIR bot worker: ok');
    }

    // Webhook Telegram: принимаем только запросы с нашим секретом в заголовке
    const secret = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
    if (!env.WEBHOOK_SECRET || secret !== env.WEBHOOK_SECRET) {
      return new Response('forbidden', { status: 403 });
    }

    // Telegram сразу получает «ок», а пересылка в Apps Script идёт в фоне
    const body = await request.text();
    ctx.waitUntil(forward(env, body));
    return new Response('ok');
  },

  async scheduled(event, env, ctx) {
    const work = (async () => {
      try { await monitor(env); } catch (e) { console.log('monitor error'); }
    })();
    if (ctx && ctx.waitUntil) ctx.waitUntil(work);
    await work;
  },
};

/* ============================ Webhook Telegram ============================ */

async function forward(env, body) {
  const sep = env.GAS_URL.includes('?') ? '&' : '?';
  const url = env.GAS_URL + sep + 'src=tg&key=' + encodeURIComponent(env.WEBHOOK_SECRET);
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body,
        redirect: 'follow',
      });
      if (r.ok) return;
    } catch (e) {
      console.log('forward error', String(e));
    }
  }
}

/* =============================== Каталог ================================== */

function catalogResponse(body, state) {
  return new Response(body, {
    status: 200,
    headers: Object.assign({
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Pamir-Cache': state,
    }, CORS),
  });
}

function catalogError() {
  return new Response(JSON.stringify({ ok: false, error: 'upstream' }), {
    status: 502,
    headers: Object.assign({
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    }, CORS),
  });
}

async function handleCatalog(env, ctx) {
  const now = Date.now();
  let item = mem.catalog;
  if (!item || now - item.ts > FRESH_MS) {
    // память пуста или устарела: смотрим общий слой (KV / Cache API)
    const shared = await loadCatalogShared(env);
    if (shared && (!item || shared.ts > item.ts)) {
      item = shared;
      mem.catalog = shared;
    }
  }
  if (item && now - item.ts <= KEEP_MS) {
    if (now - item.ts <= FRESH_MS) return catalogResponse(item.body, 'HIT');
    ctx.waitUntil(refreshCatalog(env, false).catch(() => {}));
    return catalogResponse(item.body, 'STALE');
  }
  // кэша нет — идём в Apps Script
  const fresh = await refreshCatalog(env, false);
  if (fresh) return catalogResponse(fresh.body, 'MISS');
  return catalogError();
}

/** Берёт каталог из Apps Script; хороший ответ кладёт в кэш. Один запрос за раз. */
function refreshCatalog(env, force) {
  if (mem.inflight) return mem.inflight;
  const p = (async () => {
    if (!force && (await isPaused(env))) return null; // недавний сбой: в Apps Script не ходим
    const body = await fetchGood(env, 'catalog', isGoodCatalog);
    if (!body) {
      await markPause(env);
      return null;
    }
    mem.pauseUntil = 0;
    const item = { body, ts: Date.now(), norm: normalizeCatalog(body) };
    const prev = mem.catalog || (await loadCatalogShared(env));
    const changed = !prev || prev.norm !== item.norm;
    mem.catalog = item;
    await saveCatalogShared(env, item, changed);
    return item;
  })();
  mem.inflight = p;
  const clear = () => { if (mem.inflight === p) mem.inflight = null; };
  p.then(clear, clear);
  return p;
}

function isGoodCatalog(data) {
  return !!data && data.ok === true && Array.isArray(data.products);
}

function gasUrl(env, action) {
  const sep = env.GAS_URL.includes('?') ? '&' : '?';
  return env.GAS_URL + sep + 'action=' + action;
}

/** Запрос GET к Apps Script; возвращает текст ответа, только если он JSON и проходит проверку. */
async function fetchGood(env, action, check) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), GAS_TIMEOUT_MS);
  try {
    const r = await fetch(gasUrl(env, action), { redirect: 'follow', signal: ctl.signal });
    if (!r.ok) return null;
    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch (e) { return null; }
    return check(data) ? text : null;
  } catch (e) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function isPaused(env) {
  const now = Date.now();
  if (mem.pauseUntil > now) return true;
  try {
    if (typeof caches !== 'undefined' && caches.default) {
      const r = await caches.default.match(new Request(CACHE_KEY_PAUSE));
      if (r) {
        const until = Number(await r.text());
        if (until > now) { mem.pauseUntil = until; return true; }
      }
    }
  } catch (e) { /* ignore */ }
  return false;
}

// Отметка паузы: память изолята и Cache API. В KV не пишем: во время долгого сбоя это съело бы лимит записей.
async function markPause(env) {
  const until = Date.now() + PAUSE_MS;
  mem.pauseUntil = until;
  try {
    if (typeof caches !== 'undefined' && caches.default) {
      await caches.default.put(new Request(CACHE_KEY_PAUSE), new Response(String(until), {
        headers: { 'Cache-Control': 'max-age=60' },
      }));
    }
  } catch (e) { /* ignore */ }
}

async function handlePurge(request, env, ctx) {
  const key = request.headers.get('X-Pamir-Key') || '';
  if (!env.WEBHOOK_SECRET || !(await safeEqual(key, env.WEBHOOK_SECRET))) {
    return new Response('forbidden', { status: 403 });
  }
  // отвечаем сразу, перечитываем в фоне; чаще раза в 5 с новое чтение не запускаем.
  // Если Apps Script ответит плохо — старый кэш остаётся.
  const now = Date.now();
  if (now - mem.purgeAt >= PURGE_GAP_MS) {
    mem.purgeAt = now;
    ctx.waitUntil(refreshCatalogForce(env).catch(() => {}));
  }
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

async function refreshCatalogForce(env) {
  // если уже идёт обновление, дожидаемся его и делаем ещё одно, чтобы взять свежие данные
  if (mem.inflight) { try { await mem.inflight; } catch (e) { /* ignore */ } }
  return refreshCatalog(env, true);
}

/** Сравнение за постоянное время: сравниваем SHA-256 обеих строк. */
async function safeEqual(a, b) {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(String(a))),
    crypto.subtle.digest('SHA-256', enc.encode(String(b))),
  ]);
  const x = new Uint8Array(ha);
  const y = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

/* ============================ Хранилище слоёв ============================= */
// KV (если привязан PAMIR_KV), иначе Cache API. Любая ошибка хранилища — не ошибка Worker.
// Каталог хранится готовой строкой (время — в метаданных), JSON на горячем пути не разбирается.

async function loadCatalogShared(env) {
  if (env.PAMIR_KV) {
    try {
      const r = await env.PAMIR_KV.getWithMetadata(KV_CATALOG, 'text');
      if (r && typeof r.value === 'string' && r.metadata && typeof r.metadata.ts === 'number') {
        mem.kvWrittenAt = Math.max(mem.kvWrittenAt, r.metadata.ts); // время последней записи в KV известно
        return { body: r.value, ts: r.metadata.ts, norm: normalizeCatalog(r.value) };
      }
    } catch (e) { /* идём дальше */ }
  }
  try {
    if (typeof caches !== 'undefined' && caches.default) {
      const r = await caches.default.match(new Request(CACHE_KEY_CATALOG));
      if (r) {
        const ts = Number(r.headers.get('X-Pamir-Ts'));
        if (ts) { const body = await r.text(); return { body, ts, norm: normalizeCatalog(body) }; }
      }
    }
  } catch (e) { /* ignore */ }
  return null;
}

async function saveCatalogShared(env, item, writeKv) {
  if (env.PAMIR_KV) {
    // у KV на бесплатном тарифе 1000 записей в сутки: пишем при изменении или раз в 30 минут
    if (writeKv || Date.now() - mem.kvWrittenAt > KV_REWRITE_MS) {
      try {
        await env.PAMIR_KV.put(KV_CATALOG, item.body, { expirationTtl: 2 * 24 * 60 * 60, metadata: { ts: item.ts } });
        mem.kvWrittenAt = Date.now();
      } catch (e) { /* ignore */ }
    }
  }
  try {
    if (typeof caches !== 'undefined' && caches.default) {
      await caches.default.put(new Request(CACHE_KEY_CATALOG), new Response(item.body, {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=86400', 'X-Pamir-Ts': String(item.ts) },
      }));
    }
  } catch (e) { /* ignore */ }
}

// Состояние слежения — маленький JSON
async function loadState(env) {
  if (env.PAMIR_KV) {
    try {
      const v = await env.PAMIR_KV.get(KV_STATE, 'json');
      if (v && typeof v === 'object') return v;
    } catch (e) { /* дальше */ }
  }
  try {
    if (typeof caches !== 'undefined' && caches.default) {
      const r = await caches.default.match(new Request(CACHE_KEY_STATE));
      if (r) { const v = await r.json(); if (v && typeof v === 'object') return v; }
    }
  } catch (e) { /* ignore */ }
  return null;
}

async function saveState(env, st) {
  const json = JSON.stringify(st);
  if (env.PAMIR_KV) {
    try { await env.PAMIR_KV.put(KV_STATE, json, { expirationTtl: 7 * 24 * 60 * 60 }); } catch (e) { /* ignore */ }
  }
  try {
    if (typeof caches !== 'undefined' && caches.default) {
      await caches.default.put(new Request(CACHE_KEY_STATE), new Response(json, {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=604800' },
      }));
    }
  } catch (e) { /* ignore */ }
}

/* =============================== Слежение ================================= */

async function monitor(env) {
  if (!env.BOT_TOKEN || !env.ADMIN_CHAT_IDS || !env.GAS_URL) return; // слежение выключено

  const up = !!(await fetchGood(env, 'ping', (d) => !!d && d.ok === true));
  const now = Date.now();
  const stored = await loadState(env);
  const prev = stored || { fails: 0, down: false, notifiedDown: false, lastDownMsg: 0, lastUpMsg: 0 };
  const st = Object.assign({}, prev);
  let send = null;

  if (up) {
    st.fails = 0;
    if (st.down) {
      st.down = false;
      if (st.notifiedDown && now - st.lastUpMsg >= MSG_GAP_MS) {
        send = 'Магазин знову працює';
        st.lastUpMsg = now;
      }
      st.notifiedDown = false;
    }
  } else {
    st.fails = Math.min(2, (st.fails || 0) + 1); // выше 2 не растёт: состояние не меняется, KV не пишется
    if (st.fails >= 2 && !st.down) {
      st.down = true;
      if (now - st.lastDownMsg >= MSG_GAP_MS) {
        send = 'Магазин не відповідає';
        st.lastDownMsg = now;
        st.notifiedDown = true;
      }
    }
  }

  // Пишем состояние только при изменении (экономия записей KV)
  const same = stored && ['fails', 'down', 'notifiedDown', 'lastDownMsg', 'lastUpMsg'].every((k) => st[k] === stored[k]);
  if (!same) {
    await saveState(env, st);
    // Состояние обязательно должно сохраниться: иначе слежение молчит (чтобы не спамить)
    if (!stored && !(await loadState(env))) return;
  }

  if (send) await notifyAdmins(env, send);
}

async function notifyAdmins(env, text) {
  const ids = String(env.ADMIN_CHAT_IDS).split(',').map((s) => s.trim()).filter(Boolean);
  for (const id of ids) {
    try {
      const r = await fetch('https://api.telegram.org/bot' + env.BOT_TOKEN + '/sendMessage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: id, text }),
      });
      if (!r.ok) console.log('notify failed, status ' + r.status);
    } catch (e) {
      console.log('notify error'); // текст ошибки не пишем: в нём может быть адрес с токеном
    }
  }
}
