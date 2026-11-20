// PAMIR — Cloudflare Worker.
// 1) webhook Telegram -> Apps Script (POST на любой адрес, кроме /purge);
// 2) GET /catalog — публичный каталог из кэша (Apps Script ?action=catalog);
// 3) POST /purge — сброс кэша каталога (шлёт Apps Script, ключ X-Pamir-Key);
// 4) cron: проверка Apps Script (?action=ping) и сообщения админам;
// 5) справочник Новой пошты: cron маленькими шагами грузит города и отделения в KV,
//    GET /np/cities?q=, /np/warehouses?city=, /np/status отвечают из KV (ключ НП в ответы не попадает).
//
// Секреты и настройки — только в Cloudflare (Settings -> Variables and secrets):
//   GAS_URL, WEBHOOK_SECRET            обязательные (уже есть)
//   BOT_TOKEN, ADMIN_CHAT_IDS          необязательные: без них слежение молчит
//   PAMIR_KV                           необязательная привязка KV (хранилище)
//   NP_API_KEY                         необязательный секрет: ключ API Новой пошты; без него /np/* отвечают nodata
//   NP_REFRESH_HOURS, NP_PAGE_SIZE, NP_PAGES_PER_RUN, NP_ASM_KB   необязательные числа (по умолчанию 24, 150, 2, 350)
// В этом файле секретов нет.

const FRESH_MS = 60 * 1000;            // каталог свежий 60 с
const MAX_STALE_SERVE_MS = 5 * 60 * 1000; // копию старше 5 минут сначала пробуем обновить, а не отдаём сразу
const KEEP_MS =24 * 60 * 60 * 1000;   // прошлый хороший ответ живёт до 24 ч
const KV_REWRITE_MS = 12 * 60 * 60 * 1000; // без изменений каталога KV обновляем не чаще раза в 12 ч (чтобы запись не истекла)
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
// Пауза действует, только когда есть что отдать из кэша (STALE). Холодный запрос без кэша её игнорирует.
const RESPONSE_DEADLINE_MS = 4500;     // витрина ждёт Worker 6 с (webapp/app.js); отвечаем не позже 4,5 с, иначе быстрый 502
const RETRY_WINDOW_MS = 3000;          // повтор только если первая попытка кончилась быстро (за 3 с)
const RETRY_DELAY_MS = 400;            // пауза перед повтором
const mem = { catalog: null, kvWrittenAt: 0, inflight: null, inflightCold: false, pauseUntil: 0, purgeAt: 0 };

// Каталог без поля updated (время сборки): по нему понимаем, изменился ли каталог на самом деле.
// Без JSON.parse: вырезаем значение первого "updated" обычной заменой в строке.
function normalizeCatalog(body) {
  return body.replace(/"updated"\s*:\s*("(?:[^"\\]|\\.)*"|-?[0-9.eE+-]+|null)/, '"updated":0');
}

// Отпечаток каталога: SHA-256 от нормализованного тела (без поля updated). Хранится рядом со значением.
async function catalogHash(body) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalizeCatalog(body)));
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, '0')).join('');
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Expose-Headers': 'X-Pamir-Cache',
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

    // Справочник Новой пошты (только чтение из KV; наполняет cron)
    if (request.method === 'GET' && path.indexOf('/np/') === 0) {
      return handleNp(path, url, env);
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
    // Слежение и шаг загрузки справочника НП независимы: сбой одного не мешает другому.
    const work = Promise.all([
      (async () => { try { await monitor(env); } catch (e) { console.log('monitor error'); } })(),
      (async () => { try { await npStep(env); } catch (e) { console.log('np step error'); } })(),
    ]);
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
    const age = now - item.ts;
    if (age <= FRESH_MS) return catalogResponse(item.body, 'HIT');
    if (age <= MAX_STALE_SERVE_MS) {
      // копия моложе 5 минут: отдаём сразу, обновляем в фоне
      ctx.waitUntil(refreshCatalog(env, false).catch(() => {}));
      return catalogResponse(item.body, 'STALE');
    }
    // копия старше 5 минут: сначала пробуем получить новый каталог (в пределах дедлайна).
    // Пауза после сбоя действует: пока она не кончилась, отдаём старую копию без попытки (не дольше 30 с).
    if (await isPaused(env)) return catalogResponse(item.body, 'EXPIRED');
    const fresh = await waitRefresh(env, ctx);
    if (fresh) return catalogResponse(fresh.body, 'REFRESHED');
    // Apps Script не ответил вовремя или плохо: старая копия (до 24 ч); на 30 с останавливаем новые ожидания
    mem.pauseUntil = Math.max(mem.pauseUntil, Date.now() + PAUSE_MS);
    return catalogResponse(item.body, 'EXPIRED');
  }
  // кэша нет — идём в Apps Script (пауза не мешает: отдать всё равно нечего).
  const fresh = await waitRefresh(env, ctx);
  if (fresh) return catalogResponse(fresh.body, 'MISS');
  return catalogError();
}

// Одновременные запросы делят один обмен; при быстром сбое одна повторная попытка.
// Ждём не дольше RESPONSE_DEADLINE_MS (витрина ждёт Worker 6 с, потом идёт в Apps Script сама);
// обмен при этом дорабатывает в фоне и наполняет кэш. Возвращает каталог или null.
async function waitRefresh(env, ctx) {
  const work = refreshCatalog(env, false, true).catch(() => null);
  ctx.waitUntil(work);
  let timer;
  const deadline = new Promise((res) => { timer = setTimeout(() => res(null), RESPONSE_DEADLINE_MS); });
  const fresh = await Promise.race([work, deadline]);
  clearTimeout(timer);
  return fresh;
}

/**
 * Берёт каталог из Apps Script; хороший ответ кладёт в кэш. Один обмен за раз.
 * cold: отдать нечего — пауза не действует, при быстром сбое одна повторная попытка.
 */
function refreshCatalog(env, force, cold) {
  if (mem.inflight) {
    // обмен фоновый (мог пропустить попытку из-за паузы), а нам нужен настоящий
    if (cold && !mem.inflightCold) return mem.inflight.then((r) => r || refreshCatalog(env, false, true));
    return mem.inflight;
  }
  const t0 = Date.now();
  const p = (async () => {
    if (!force && !cold && (await isPaused(env))) return null; // недавний сбой: в Apps Script не ходим (но есть что отдать)
    let body = await fetchGood(env, 'catalog', isGoodCatalog);
    if (!body && cold && Date.now() - t0 <= RETRY_WINDOW_MS) {
      await new Promise((res) => setTimeout(res, RETRY_DELAY_MS));
      body = await fetchGood(env, 'catalog', isGoodCatalog);
    }
    if (!body) {
      await markPause(env);
      return null;
    }
    mem.pauseUntil = 0;
    const item = { body, ts: Date.now(), h: await catalogHash(body) };
    const prev = mem.catalog || (await loadCatalogShared(env));
    const changed = !prev || prev.h !== item.h;
    mem.catalog = item;
    await saveCatalogShared(env, item, changed);
    return item;
  })();
  mem.inflight = p;
  mem.inflightCold = !!cold;
  const clear = () => { if (mem.inflight === p) { mem.inflight = null; mem.inflightCold = false; } };
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
  // 1) Cache API: бесплатно по лимитам KV; берём, только если там свежий каталог
  let cached = null;
  try {
    if (typeof caches !== 'undefined' && caches.default) {
      const r = await caches.default.match(new Request(CACHE_KEY_CATALOG));
      if (r) {
        const ts = Number(r.headers.get('X-Pamir-Ts'));
        if (ts) {
          const body = await r.text();
          cached = { body, ts, h: r.headers.get('X-Pamir-Hash') || (await catalogHash(body)) };
          if (Date.now() - ts <= FRESH_MS) return cached;
        }
      }
    }
  } catch (e) { /* ignore */ }
  // 2) KV (запасной слой): одно чтение
  if (env.PAMIR_KV) {
    try {
      const r = await env.PAMIR_KV.getWithMetadata(KV_CATALOG, 'text');
      if (r && typeof r.value === 'string' && r.metadata && typeof r.metadata.ts === 'number') {
        mem.kvWrittenAt = Math.max(mem.kvWrittenAt, r.metadata.ts); // время последней записи в KV известно
        const kvItem = { body: r.value, ts: r.metadata.ts, h: typeof r.metadata.h === 'string' ? r.metadata.h : await catalogHash(r.value) };
        if (!cached || kvItem.ts > cached.ts) return kvItem;
      }
    } catch (e) { /* идём дальше */ }
  }
  return cached;
}

async function saveCatalogShared(env, item, changed) {
  if (env.PAMIR_KV) {
    // Бесплатный KV: 1000 записей в сутки. Пишем только если каталог изменился
    // (по хэшу) либо раз в 12 часов, чтобы запись не истекла. Перед записью смотрим,
    // не записал ли то же самое другой экземпляр Worker.
    const now = Date.now();
    if (changed || now - mem.kvWrittenAt > KV_REWRITE_MS) {
      try {
        let skip = false;
        const cur = await env.PAMIR_KV.getWithMetadata(KV_CATALOG, 'text');
        const m = cur && cur.metadata;
        if (m && typeof m.ts === 'number' && m.h === item.h && now - m.ts <= KV_REWRITE_MS) {
          skip = true;
          mem.kvWrittenAt = Math.max(mem.kvWrittenAt, m.ts);
        }
        if (!skip) {
          await env.PAMIR_KV.put(KV_CATALOG, item.body, { expirationTtl: 2 * 24 * 60 * 60, metadata: { ts: item.ts, h: item.h } });
          mem.kvWrittenAt = now;
        }
      } catch (e) { /* ignore */ }
    }
  }
  try {
    if (typeof caches !== 'undefined' && caches.default) {
      await caches.default.put(new Request(CACHE_KEY_CATALOG), new Response(item.body, {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=86400', 'X-Pamir-Ts': String(item.ts), 'X-Pamir-Hash': item.h },
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

/* ======================= Справочник Новой пошты (НП) ======================= */
// Зачем: подсказки города и отделения не должны ходить в НП с пути покупателя.
// Лимиты бесплатного Cloudflare: 10 мс процессора на вызов (cron тоже), 1000 записей KV в сутки,
// 1000 операций KV и 50 внешних запросов на вызов. Поэтому загрузка идёт конвейером на cron */5:
//   fetch  -> 2 страницы НП по 150 отделений за запуск (пауза >= 1,1 с между запросами), одна запись KV
//             «сырой кусок» (бинарный, уже разложенный по 32 корзинам хэша CityRef) + запись состояния;
//   asm    -> читает все куски (чтение дёшево), собирает корзины по бюджету ~350 КБ за запуск,
//             внутри города сортирует по номеру, готовый JSON ответа хранится строкой в корзине;
//   merge  -> склеивает городскую часть корзин в индекс городов, проверяет полноту и ОДНОЙ записью
//             переключает указатель np:meta на новое поколение. Старое поколение работает до этого момента.
// Чтение: /np/warehouses = 1-2 чтения KV (meta + корзина), без JSON.parse; /np/cities = индекс городов
// (одна строка на город с нормализованными ключами), поиск через indexOf.
// Что НЕ проверено на настоящем НП: имена полей в ответе getWarehouses (см. README), реальное число записей,
// реальное процессорное время в Cloudflare.

const NP_URL = 'https://api.novaposhta.ua/v2.0/json/';
const NP_B = 32;                              // число корзин (хэш CityRef)
const NP_GAP_MS = 1100;                       // пауза между запросами к НП внутри запуска
const NP_REQ_TIMEOUT_MS = 15000;
const NP_MAX_AGE_MS = 7 * 24 * 3600 * 1000;   // справочник старше 7 суток не отдаём
const NP_STUCK_MS = 48 * 3600 * 1000;         // загрузка дольше 48 ч — бросаем и начинаем заново
const NP_TTL_RAW = 3 * 24 * 3600;             // сырые куски живут 3 суток
const NP_TTL_DATA = 8 * 24 * 3600;            // корзины и индекс живут 8 суток (без удалений: удаление тоже запись)
const NP_WRITE_CAP = 450;                     // предохранитель: записей конвейера в сутки (лимит KV 1000 на всё)
const NP_MIN_RECORDS = 1000;                  // меньше отделений в справочнике НП быть не может: не публикуем
const NP_MIN_RATIO = 0.7;                     // и не публикуем, если отделений стало < 70% от прошлого поколения
const NP_HTTP_CACHE = 'public, max-age=600';  // справочник меняется раз в сутки: браузеру можно хранить 10 минут
const NP_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KV_NP_STATE = 'np:st';
const KV_NP_META = 'np:meta';
const npMem = { meta: undefined, metaTs: 0, buckets: new Map(), cities: null, status: null };

function npInt(v, def, min, max) {
  const n = parseInt(v, 10);
  return n >= min && n <= max ? n : def;
}

function npRefBucket(ref) { // FNV-1a по символам CityRef: ссылки НП похожи друг на друга, первый символ не годится
  let h = 2166136261;
  for (let i = 0; i < ref.length; i++) { h ^= ref.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) % NP_B;
}

const NP_NORM_MAP = { 'ё': 'е', 'і': 'и', 'ї': 'и', 'є': 'е', 'ґ': 'г', 'ы': 'и', 'э': 'е', 'ъ': '', "'": '', '’': '', 'ʼ': '', '`': '', '´': '', '‘': '', '"': '' };
/** Для поиска: нижний регистр, ё/е, і/и/ї, є/е, без апострофов; русское и украинское написание сходятся. */
function npNorm(s) {
  return String(s == null ? '' : s).toLowerCase().replace(/[ёіїєґыэъ'’ʼ`´‘"]/g, (c) => NP_NORM_MAP[c])
    .replace(/[\t\r\n\f|#]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function npClean(s, max) { return String(s == null ? '' : s).replace(/[\t\r\n\f|#]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max); }

const npSleep = (ms) => new Promise((res) => setTimeout(res, ms));

/* ---------- Запрос getWarehouses (ключ только в теле запроса, наружу не попадает) ---------- */

async function npRequest(env, page, size) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), NP_REQ_TIMEOUT_MS);
  try {
    const r = await fetch(NP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: env.NP_API_KEY, modelName: 'Address', calledMethod: 'getWarehouses', methodProperties: { Page: String(page), Limit: String(size) } }),
      signal: ctl.signal,
    });
    if (r.status === 429) return { kind: 'limit' };
    if (!r.ok) return { kind: 'net' };
    let d;
    try { d = JSON.parse(await r.text()); } catch (e) { return { kind: 'net' }; }
    if (!d || typeof d !== 'object') return { kind: 'net' };
    if (!d.success) {
      const why = JSON.stringify([d.errors || [], d.errorCodes || []]);
      return { kind: /many requests|20000401501/i.test(why) ? 'limit' : 'api' };
    }
    if (!Array.isArray(d.data)) return { kind: 'net' };
    return { data: d.data, total: Number(d.info && d.info.totalCount) || 0 };
  } catch (e) {
    return { kind: 'net' };
  } finally {
    clearTimeout(timer);
  }
}

/* ---------- Состояние конвейера ---------- */

async function npLoadMetaRaw(kv) {
  const v = await kv.get(KV_NP_META, 'json');
  return v && typeof v === 'object' && typeof v.g === 'string' ? v : null;
}

function npDue(st, now, refreshMs) {
  if (st.rt && now < st.rt) return false;
  return !st.last || now - st.last >= refreshMs;
}

function npPauseMin(kind, lim) {
  if (kind === 'limit' || kind === 'empty') return Math.min(15 * Math.pow(2, Math.max(0, lim - 1)), 120); // 15, 30, 60, 120 минут
  if (kind === 'api') return 60;
  return 10;
}

/** Один шаг конвейера (вызывается из cron). Без ключа НП или без KV — ничего не делает и ничего не читает. */
async function npStep(env) {
  if (!env.NP_API_KEY || !env.PAMIR_KV) return;
  const kv = env.PAMIR_KV;
  const now = Date.now();
  let st = await kv.get(KV_NP_STATE, 'json');
  if (!st || typeof st !== 'object') {
    const m = await npLoadMetaRaw(kv);
    st = { s: 'idle', last: m ? m.at : 0 };
  }
  const day = new Date(now).toISOString().slice(0, 10);
  if (!st.wd || st.wd.d !== day) st.wd = { d: day, n: 0 };
  if (st.pu && now < st.pu) return;                  // пауза после лимита/ошибки НП
  if (st.wd.n >= NP_WRITE_CAP) return;               // предохранитель по записям
  const refreshMs = npInt(env.NP_REFRESH_HOURS, 24, 12, 168) * 3600 * 1000;
  const io = {
    kv, st,
    async put(key, val, ttl) { st.wd.n++; await kv.put(key, val, { expirationTtl: ttl }); },
    async save() { st.wd.n++; await kv.put(KV_NP_STATE, JSON.stringify(st), { expirationTtl: 30 * 24 * 3600 }); },
  };
  if (st.s !== 'idle' && st.t0 && now - st.t0 > NP_STUCK_MS) {
    st.s = 'idle'; st.le = { t: now, k: 'stuck' }; st.rt = now + 3600 * 1000;
    await io.save();
    return;
  }
  if (st.s === 'idle') {
    if (!npDue(st, now, refreshMs)) return;
    Object.assign(st, { s: 'fetch', g: Math.floor(now / 1000).toString(36), pg: 1, k: 0, rc: 0, ex: 0, b: 0, wc: 0, cc: 0, t0: now, lim: 0, pu: 0, rt: 0 });
  }
  if (st.s === 'fetch') return npStepFetch(env, io, now);
  if (st.s === 'asm') return npStepAsm(env, io, now);
  if (st.s === 'merge') return npStepMerge(io, now);
  st.s = 'idle'; await io.save();
}

/* ---------- Стадия fetch ---------- */

async function npStepFetch(env, io, now) {
  const st = io.st;
  const size = npInt(env.NP_PAGE_SIZE, 150, 50, 300);
  const pages = npInt(env.NP_PAGES_PER_RUN, 2, 1, 3);
  const segs = [];
  for (let i = 0; i < NP_B; i++) segs.push([]);
  const seenCity = new Set();
  let got = 0, done = false, fail = null, ok = false;
  for (let i = 0; i < pages; i++) {
    if (i > 0) await npSleep(NP_GAP_MS);
    const res = await npRequest(env, st.pg, size);
    if (res.kind) { fail = res.kind; break; }
    const data = res.data;
    if (res.total && !st.ex) st.ex = res.total;
    if (data.length === 0) {
      // пустая страница: либо конец, либо НП молча отказал. Концом считаем, только если уже набрано почти всё.
      const enough = st.pg > 1 && (st.ex ? st.rc >= st.ex * 0.98 : st.rc >= NP_MIN_RECORDS);
      if (enough) { done = true; ok = true; } else fail = 'empty';
      break;
    }
    ok = true;
    for (let j = 0; j < data.length; j++) {
      const w = data[j];
      if (!w) continue;
      const ref = String(w.CityRef || '').toLowerCase();
      const num = parseInt(w.Number, 10);
      if (!NP_UUID.test(ref) || !(num > 0 && num <= 9999999)) continue;
      const locker = String(w.CategoryOfWarehouse || '') === 'Postomat' || /по[чш]тома[тн]/i.test(String(w.Description || ''));
      const addr = String(w.ShortAddress || w.Description || '').slice(0, 90);
      const seg = segs[npRefBucket(ref)];
      if (!seenCity.has(ref)) {
        seenCity.add(ref);
        seg.push('#' + ref + '\t' + npClean(w.CityDescription || w.SettlementDescription, 60) + '\t' + npClean(w.CityDescriptionRu || w.SettlementDescriptionRu, 60) + '\t' +
          npClean(w.SettlementAreaDescription, 40) + '\t' + npClean(w.SettlementTypeDescription, 30) + '\t' + npClean(w.SettlementRegionsDescription, 40) + '\n');
      }
      seg.push(ref + String(num).padStart(7, '0') + (locker ? 'p' : 'w') + JSON.stringify(addr) + '\n');
      got++;
    }
    st.rc += data.length;
    st.pg++;
    if (data.length < size || (st.ex && st.rc >= st.ex)) { done = true; break; }
  }
  if (got > 0) {
    await io.put('np:r:' + st.g + ':' + st.k, npPackChunk(segs.map((a) => a.join(''))), NP_TTL_RAW);
    st.k++;
  }
  if (fail) {
    st.lim = fail === 'limit' || fail === 'empty' ? (st.lim || 0) + 1 : 0;
    st.pu = now + npPauseMin(fail, st.lim) * 60000;
    st.le = { t: now, k: fail };
  } else if (ok) {
    st.lim = 0; st.pu = 0;
  }
  if (done) { st.s = 'asm'; st.b = 0; st.wc = 0; st.cc = 0; }
  await io.save();
}

function npPackChunk(texts) {
  const enc = new TextEncoder();
  const parts = texts.map((s) => enc.encode(s));
  const hdr = new Uint32Array(NP_B + 1);
  let off = 0;
  for (let i = 0; i < NP_B; i++) { hdr[i] = off; off += parts[i].length; }
  hdr[NP_B] = off;
  const base = 4 * (NP_B + 1);
  const out = new Uint8Array(base + off);
  out.set(new Uint8Array(hdr.buffer), 0);
  let p = base;
  for (let i = 0; i < NP_B; i++) { out.set(parts[i], p); p += parts[i].length; }
  return out;
}

/* ---------- Стадия asm ---------- */

async function npReadMany(kv, keys) {
  const out = new Array(keys.length);
  for (let i = 0; i < keys.length; i += 25) {
    const part = await Promise.all(keys.slice(i, i + 25).map((k) => kv.get(k, 'arrayBuffer')));
    for (let j = 0; j < part.length; j++) out[i + j] = part[j];
  }
  return out;
}

function npCityLabel(c) {
  const type = String(c.type || '').toLowerCase();
  let pre = '';
  if (type === 'місто' || type === 'город') pre = 'м.';
  else if (type.indexOf('селище міського') === 0 || type.indexOf('поселок городского') === 0) pre = 'смт';
  else if (type.indexOf('селище') === 0 || type.indexOf('посёлок') === 0 || type.indexOf('поселок') === 0) pre = 'с-ще';
  else if (type === 'село' || type === 'деревня') pre = 'с.';
  let n = (pre ? pre + ' ' : '') + c.ua;
  if (c.area && !/обл|респуб|^київ$/i.test(c.area) && npNorm(c.area) !== npNorm(c.ua)) n += ', ' + c.area + ' обл.';
  else if (c.area && /обл/i.test(c.area)) n += ', ' + c.area;
  if (c.region && pre !== 'м.') n += ', ' + c.region + ' р-н';
  return { n: n.slice(0, 120), town: pre === 'м.' ? 1 : 0 };
}

/** Текст корзины (строки кусков) -> {bytes, w, c}. Работа процессора пропорциональна числу строк. */
function npBuildBucket(text) {
  const lines = text.split('\n');
  const meta = new Map();
  const groups = new Map();
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    if (!ln) continue;
    if (ln.charCodeAt(0) === 35) { // '#': описание города
      const p = ln.split('\t');
      const ref = p[0].slice(1);
      if (!meta.has(ref)) meta.set(ref, { ua: p[1] || '', ru: p[2] || '', area: p[3] || '', type: p[4] || '', region: p[5] || '' });
      continue;
    }
    const ref = ln.slice(0, 36);
    let g = groups.get(ref);
    if (!g) { g = { k: [], a: [] }; groups.set(ref, g); }
    if (g.a.length >= 65535) continue;
    const num = +ln.slice(36, 43);
    const t = ln.charCodeAt(43) === 112 ? 1 : 0; // 'p'
    g.a.push(ln.slice(44));
    g.k.push((num * 2 + t) * 65536 + (g.a.length - 1));
  }
  let cityPart = '', secs = '', w = 0, c = 0;
  groups.forEach((g, ref) => {
    const keys = Float64Array.from(g.k);
    keys.sort(); // числовая сортировка встроенная: по номеру, при равном номере отделение раньше почтомата
    const out = [];
    let prev = -1;
    for (let i = 0; i < keys.length; i++) {
      const base = Math.floor(keys[i] / 65536);
      if (base === prev) continue; // дубль (НП сдвинул страницы при загрузке)
      prev = base;
      out.push('[' + Math.floor(base / 2) + ',' + g.a[keys[i] - base * 65536] + ',"' + (base % 2 ? 'p' : 'w') + '"]');
    }
    secs += '#' + ref + '\n[' + out.join(',') + ']\n';
    w += out.length;
    const m = meta.get(ref);
    if (m && (m.ua || m.ru)) {
      const lab = npCityLabel({ ua: m.ua || m.ru, area: m.area, type: m.type, region: m.region });
      cityPart += npNorm(m.ua || m.ru) + '\t' + npNorm(m.ru || m.ua) + '\t' + out.length + '\t' + lab.town + '\t' +
        JSON.stringify({ n: lab.n, s: (m.ua || m.ru).slice(0, 60), ref }) + '\n';
      c++;
    }
  });
  const enc = new TextEncoder();
  const cb = enc.encode(cityPart), sb = enc.encode(secs), hb = enc.encode(cb.length + ' ' + cityPart.length + '\n');
  const bytes = new Uint8Array(hb.length + cb.length + sb.length);
  bytes.set(hb, 0); bytes.set(cb, hb.length); bytes.set(sb, hb.length + cb.length);
  return { bytes, w, c };
}

async function npStepAsm(env, io, now) {
  const st = io.st;
  const budget = npInt(env.NP_ASM_KB, 350, 20, 4000) * 1024;
  const keys = [];
  for (let i = 0; i < st.k; i++) keys.push('np:r:' + st.g + ':' + i);
  const bufs = await npReadMany(io.kv, keys);
  const hdrs = [];
  for (let i = 0; i < bufs.length; i++) {
    const buf = bufs[i];
    if (!buf || buf.byteLength < 4 * (NP_B + 1)) { hdrs.length = 0; break; }
    const h = new Uint32Array(buf, 0, NP_B + 1);
    if (h[NP_B] + 4 * (NP_B + 1) !== buf.byteLength) { hdrs.length = 0; break; }
    hdrs.push(h);
  }
  if (hdrs.length !== bufs.length) { // кусок потерян или повреждён: эту загрузку бросаем, начнём заново позже
    st.s = 'idle'; st.le = { t: now, k: 'lost' }; st.rt = now + 3600 * 1000;
    await io.save();
    return;
  }
  const base = 4 * (NP_B + 1), dec = new TextDecoder();
  let spent = 0;
  while (st.b < NP_B) {
    const b = st.b;
    let size = 0;
    for (let i = 0; i < hdrs.length; i++) size += hdrs[i][b + 1] - hdrs[i][b];
    if (spent > 0 && spent + size > budget) break;
    const joined = new Uint8Array(size);
    let p = 0;
    for (let i = 0; i < bufs.length; i++) {
      const seg = new Uint8Array(bufs[i], base + hdrs[i][b], hdrs[i][b + 1] - hdrs[i][b]);
      joined.set(seg, p); p += seg.length;
    }
    const r = npBuildBucket(dec.decode(joined));
    await io.put('np:g:' + st.g + ':' + b, r.bytes, NP_TTL_DATA);
    st.wc += r.w; st.cc += r.c;
    st.b++; spent += size;
  }
  if (st.b >= NP_B) st.s = 'merge';
  await io.save();
}

/* ---------- Стадия merge: индекс городов, проверка полноты, переключение указателя ---------- */

async function npStepMerge(io, now) {
  const st = io.st;
  const keys = [];
  for (let i = 0; i < NP_B; i++) keys.push('np:g:' + st.g + ':' + i);
  const bufs = await npReadMany(io.kv, keys);
  const dec = new TextDecoder();
  const parts = [];
  let total = 0;
  for (let i = 0; i < bufs.length; i++) {
    if (!bufs[i]) { parts.length = 0; break; }
    const u8 = new Uint8Array(bufs[i]);
    let nl = 0;
    while (nl < 40 && u8[nl] !== 10) nl++;
    const n = parseInt(dec.decode(u8.subarray(0, nl)), 10);
    if (!(n >= 0)) { parts.length = 0; break; }
    parts.push(u8.subarray(nl + 1, nl + 1 + n));
    total += n;
  }
  const prev = await npLoadMetaRaw(io.kv);
  let why = '';
  if (parts.length !== NP_B) why = 'lost';
  else if (st.wc < NP_MIN_RECORDS || st.cc < 1) why = 'incomplete';
  else if (st.ex && st.wc < st.ex * 0.9) why = 'incomplete';
  else if (prev && st.wc < prev.w * NP_MIN_RATIO) why = 'incomplete';
  if (why) { // полупустой справочник не публикуем: прежнее поколение остаётся рабочим
    st.s = 'idle'; st.le = { t: now, k: why }; st.rt = now + 6 * 3600 * 1000;
    await io.save();
    return;
  }
  const idx = new Uint8Array(total);
  let p = 0;
  for (let i = 0; i < parts.length; i++) { idx.set(parts[i], p); p += parts[i].length; }
  await io.put('np:g:' + st.g + ':c', idx, NP_TTL_DATA);
  st.wd.n++;
  await io.kv.put(KV_NP_META, JSON.stringify({ g: st.g, at: now, w: st.wc, c: st.cc, b: NP_B, v: 1 }), { expirationTtl: 30 * 24 * 3600 });
  st.s = 'idle'; st.last = st.t0; st.le = null; st.rt = 0; st.k = 0;
  await io.save();
}

/* ============================ Публичные адреса /np/* ============================ */

function npResp(body, status, cacheable) {
  return new Response(body, {
    status,
    headers: Object.assign({
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': cacheable ? NP_HTTP_CACHE : 'no-store',
    }, CORS),
  });
}
const npNoData = () => npResp('{"ok":false,"error":"nodata"}', 200, false);

async function npGetMeta(env) {
  const now = Date.now();
  if (npMem.meta !== undefined && now - npMem.metaTs < (npMem.meta ? 60000 : 20000)) return npMem.meta;
  let m = null;
  if (env.PAMIR_KV) {
    try { m = await npLoadMetaRaw(env.PAMIR_KV); } catch (e) { m = null; }
  }
  if (m && !(now - m.at <= NP_MAX_AGE_MS)) m = null; // слишком старый
  npMem.meta = m; npMem.metaTs = now;
  return m;
}

async function npGetText(env, key) {
  const now = Date.now();
  const hit = npMem.buckets.get(key);
  if (hit && now - hit.ts < 5 * 60000) return hit.text;
  let text = null;
  try { text = await env.PAMIR_KV.get(key, 'text'); } catch (e) { text = null; }
  if (typeof text !== 'string') return null;
  if (npMem.buckets.size >= 6) npMem.buckets.delete(npMem.buckets.keys().next().value);
  npMem.buckets.set(key, { text, ts: now });
  return text;
}

async function handleNp(path, url, env) {
  try {
    if (path === '/np/status') return await npStatus(env);
    if (path === '/np/cities') return await npCities(url, env);
    if (path === '/np/warehouses') return await npWarehouses(url, env);
  } catch (e) {
    return npNoData();
  }
  return npResp('{"ok":false,"error":"not_found"}', 404, false);
}

/** /np/cities?q=: формат как у np.city — {ok:true, list:[{n, s, ref}]}, не больше 10. */
async function npCities(url, env) {
  const nq = npNorm(String(url.searchParams.get('q') || '').slice(0, 200));
  if (nq.length < 2 || nq.length > 40) return npResp('{"ok":true,"list":[]}', 200, true);
  const meta = await npGetMeta(env);
  if (!meta) return npNoData();
  const text = await npGetText(env, 'np:g:' + meta.g + ':c');
  if (text === null) return npNoData();
  const found = [];
  const seen = new Set();
  let from = 0, guard = 0;
  while (guard++ < 5000) {
    const p = text.indexOf(nq, from);
    if (p < 0) break;
    const ls = text.lastIndexOf('\n', p) + 1;
    let le = text.indexOf('\n', p);
    if (le < 0) le = text.length;
    from = le + 1;
    if (seen.has(ls)) continue;
    seen.add(ls);
    const t1 = text.indexOf('\t', ls), t2 = text.indexOf('\t', t1 + 1), t3 = text.indexOf('\t', t2 + 1), t4 = text.indexOf('\t', t3 + 1);
    if (t1 < 0 || t2 < 0 || t3 < 0 || t4 < 0 || t4 > le) continue;
    const ua = text.slice(ls, t1), ru = text.slice(t1 + 1, t2);
    let score = 3;
    if (ua.indexOf(nq) === 0 || ru.indexOf(nq) === 0) score = 0;
    else if (ua.indexOf(' ' + nq) >= 0 || ua.indexOf('-' + nq) >= 0 || ru.indexOf(' ' + nq) >= 0 || ru.indexOf('-' + nq) >= 0) score = 1;
    else if (ua.indexOf(nq) >= 0 || ru.indexOf(nq) >= 0) score = 2;
    if (score === 3) continue; // совпадение не в названии (в служебной части строки)
    found.push({ s: score, cnt: Number(text.slice(t2 + 1, t3)) || 0, town: text.charCodeAt(t3 + 1) === 49 ? 0 : 1, f: text.slice(t4 + 1, le) });
  }
  found.sort((a, b) => a.s - b.s || a.town - b.town || b.cnt - a.cnt);
  return npResp('{"ok":true,"list":[' + found.slice(0, 10).map((x) => x.f).join(',') + ']}', 200, true);
}

/** /np/warehouses?city=<Ref>[&q=][&t=locker|branch]: как np.whall — {ok:true, list:[[номер, адрес, 'w'|'p']]} по возрастанию номера. */
async function npWarehouses(url, env) {
  const city = String(url.searchParams.get('city') || '').toLowerCase();
  if (!NP_UUID.test(city)) return npResp('{"ok":false,"error":"bad_city"}', 400, false);
  const meta = await npGetMeta(env);
  if (!meta) return npNoData();
  const text = await npGetText(env, 'np:g:' + meta.g + ':' + npRefBucket(city));
  if (text === null) return npNoData();
  const nl = text.indexOf('\n'), sp = text.indexOf(' ');
  const start = nl + 1 + (Number(text.slice(sp + 1, nl)) || 0);
  const pos = text.indexOf('#' + city + '\n', start);
  if (pos < 0 || (pos > start && text.charCodeAt(pos - 1) !== 10)) return npNoData();
  const a = pos + 38;
  const payload = text.slice(a, text.indexOf('\n', a));
  const q = npClean(url.searchParams.get('q'), 40).replace(/^[№#\s]+/, '').toLowerCase();
  const t = String(url.searchParams.get('t') || '');
  if (!q && !t) return npResp('{"ok":true,"list":' + payload + '}', 200, true);
  let list;
  try { list = JSON.parse(payload); } catch (e) { return npNoData(); }
  const want = t === 'locker' ? 'p' : t === 'branch' ? 'w' : '';
  const digits = /^\d+$/.test(q), exact = [], pref = [], rest = [];
  for (const x of list) {
    if (want && x[2] !== want) continue;
    const n = String(x[0]);
    if (!q) rest.push(x);
    else if (digits && n === q) exact.push(x);
    else if (digits && n.indexOf(q) === 0) pref.push(x);
    else if (String(x[1]).toLowerCase().indexOf(q) >= 0) rest.push(x);
  }
  const res = exact.concat(pref, rest);
  return npResp(JSON.stringify({ ok: true, list: q ? res.slice(0, 12) : res }), 200, true);
}

/** /np/status: без секретов — поколение, дата, числа, стадия и процент, пауза, последняя ошибка. */
async function npStatus(env) {
  const out = { ok: true, key: !!env.NP_API_KEY, kv: !!env.PAMIR_KV };
  const now = Date.now();
  if (env.PAMIR_KV) {
    let st = null, meta = null;
    try { st = await env.PAMIR_KV.get(KV_NP_STATE, 'json'); } catch (e) { /* пусто */ }
    try { meta = await npLoadMetaRaw(env.PAMIR_KV); } catch (e) { /* пусто */ }
    out.published = meta ? { generation: meta.g, at: new Date(meta.at).toISOString(), ageHours: Math.round((now - meta.at) / 360000) / 10, fresh: now - meta.at <= NP_MAX_AGE_MS, cities: meta.c, warehouses: meta.w } : null;
    if (st) {
      let pct = 0;
      if (st.s === 'fetch') pct = Math.round(80 * Math.min(1, (st.rc || 0) / (st.ex || (meta && meta.w) || ((st.rc || 0) * 2 + 1))));
      else if (st.s === 'asm') pct = 80 + Math.round(15 * (st.b || 0) / NP_B);
      else if (st.s === 'merge') pct = 97;
      out.loading = {
        stage: st.s || 'idle', percent: st.s === 'idle' ? null : pct, page: st.s === 'fetch' ? st.pg : null, received: st.s === 'idle' ? null : (st.rc || 0),
        pausedUntil: st.pu && st.pu > now ? new Date(st.pu).toISOString() : null,
        lastProblem: st.le ? { at: new Date(st.le.t).toISOString(), kind: String(st.le.k) } : null,
        writesToday: st.wd && st.wd.d === new Date(now).toISOString().slice(0, 10) ? st.wd.n : 0,
      };
    } else out.loading = null;
  }
  return npResp(JSON.stringify(out), 200, false);
}
