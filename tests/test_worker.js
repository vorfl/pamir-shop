// Тесты Cloudflare Worker (Node, без зависимостей): node tests/test_worker.js
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'worker', 'worker.js'), 'utf8');
const SECRET = 'test-secret-ABC';
const TOKEN = '123456:TEST-TOKEN-XYZ';
const GAS = 'https://gas.example/exec';

let passed = 0, failed = 0;
function ok(cond, name) {
  if (cond) { passed++; process.stdout.write('  ok   ' + name + '\n'); }
  else { failed++; process.stdout.write('  FAIL ' + name + '\n'); }
}

let nonce = 0;
async function loadWorker() {
  const code = SRC + '\n//' + (++nonce);
  return (await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'))).default;
}

// Среда: поддельные fetch, caches, время, console.log
function makeEnv(extra) {
  const logs = [];
  const sent = [];       // сообщения в Telegram
  const gasCalls = [];   // запросы в Apps Script
  const world = {
    now: 1000000000000,
    gas: { catalog: null, ping: null }, // функции -> {status, body}
    logs, sent, gasCalls,
    cacheStore: new Map(),
    cacheWorks: true,
  };
  const goodCatalog = (n) => JSON.stringify({ ok: true, products: [{ id: 'p' + n }] });
  world.goodCatalog = goodCatalog;
  world.gas.catalog = () => ({ status: 200, body: goodCatalog(1) });
  world.gas.ping = () => ({ status: 200, body: JSON.stringify({ ok: true, service: 'PAMIR' }) });
  Date.now = () => world.now;
  console.log = (...a) => { logs.push(a.join(' ')); };
  globalThis.fetch = async (url, opts) => {
    url = String(url);
    if (url.startsWith('https://api.telegram.org/')) {
      world.sent.push({ url, body: JSON.parse(opts.body) });
      return new Response('{"ok":true}', { status: 200 });
    }
    if (url.startsWith(GAS)) {
      gasCalls.push(url);
      let kind = url.includes('action=catalog') ? 'catalog' : url.includes('action=ping') ? 'ping' : 'other';
      if (kind === 'other') return new Response('ok', { status: 200 });
      const r = await world.gas[kind]();
      if (r === 'throw') throw new Error('network');
      return new Response(r.body, { status: r.status });
    }
    throw new Error('unexpected fetch ' + url);
  };
  globalThis.caches = {
    default: {
      async match(req) {
        if (!world.cacheWorks) return undefined;
        const v = world.cacheStore.get(req.url);
        return v === undefined ? undefined : new Response(v.text, { headers: v.headers });
      },
      async put(req, res) {
        if (!world.cacheWorks) return; // как на workers.dev: молча ничего не делает
        world.cacheStore.set(req.url, { text: await res.text(), headers: [...res.headers] });
      },
    },
  };
  const env = Object.assign({ GAS_URL: GAS, WEBHOOK_SECRET: SECRET }, extra || {});
  const pending = [];
  const ctx = { waitUntil(p) { pending.push(p); } };
  world.env = env;
  world.ctx = ctx;
  world.flush = async () => { while (pending.length) await pending.shift(); };
  return world;
}

function makeKV() {
  const m = new Map(); const meta = new Map(); const puts = [];
  return {
    m,
    async get(k, type) { const v = m.get(k); if (v === undefined) return null; return type === 'json' ? JSON.parse(v) : v; },
    async getWithMetadata(k) { const v = m.get(k); return v === undefined ? { value: null, metadata: null } : { value: v, metadata: meta.get(k) || null }; },
    async put(k, v, o) { m.set(k, v); meta.set(k, o && o.metadata); puts.push(k); },
    puts,
  };
}

const realLog = console.log;
const realFetch = globalThis.fetch;
const realNow = Date.now;
function req(method, p, headers, body) {
  return new Request('https://w.workers.dev' + p, { method, headers: headers || {}, body });
}

async function run(name, fn) {
  out('# ' + name);
  const w = await loadWorker();
  try { await fn(w); } catch (e) { failed++; out('  FAIL (exception) ' + (e && e.stack || e)); }
}

function out(s) { process.stdout.write(s + '\n'); }

async function main() {
  console.log = realLog;

  await run('webhook как раньше', async (worker) => {
    const w = makeEnv();
    let r = await worker.fetch(req('GET', '/'), w.env, w.ctx);
    ok(await r.text() === 'PAMIR bot worker: ok', 'GET / -> текст проверки');
    r = await worker.fetch(req('POST', '/', {}, '{"u":1}'), w.env, w.ctx);
    ok(r.status === 403, 'POST без секрета -> 403');
    r = await worker.fetch(req('POST', '/', { 'X-Telegram-Bot-Api-Secret-Token': 'bad' }, '{}'), w.env, w.ctx);
    ok(r.status === 403, 'POST с чужим секретом -> 403');
    r = await worker.fetch(req('POST', '/', { 'X-Telegram-Bot-Api-Secret-Token': SECRET }, '{"u":1}'), w.env, w.ctx);
    ok(r.status === 200 && await r.text() === 'ok', 'POST с секретом -> ok');
    await w.flush();
    ok(w.gasCalls.length === 1 && w.gasCalls[0].includes('src=tg&key=' + SECRET), 'тело переслано в Apps Script с src=tg&key');
    // две попытки при ошибке
    w.gasCalls.length = 0;
    const f0 = globalThis.fetch;
    let n = 0;
    globalThis.fetch = async (u, o) => { n++; return new Response('x', { status: 500 }); };
    await worker.fetch(req('POST', '/', { 'X-Telegram-Bot-Api-Secret-Token': SECRET }, '{}'), w.env, w.ctx);
    await w.flush();
    ok(n === 2, '2 попытки пересылки при ошибке');
    globalThis.fetch = f0;
    r = await worker.fetch(req('POST', '/anything', { 'X-Telegram-Bot-Api-Secret-Token': 'bad' }, '{}'), w.env, w.ctx);
    ok(r.status === 403, 'POST на другой путь — по-прежнему webhook');
  });

  await run('/catalog: кэш, устаревание, плохой ответ, CORS', async (worker) => {
    const w = makeEnv();
    let r = await worker.fetch(req('GET', '/catalog?x=1&action=reviews'), w.env, w.ctx);
    const b1 = await r.text();
    ok(r.status === 200 && JSON.parse(b1).ok === true, 'первый запрос -> 200 из GAS');
    ok(w.gasCalls.length === 1 && w.gasCalls[0] === GAS + '?action=catalog', 'в GAS ушёл только action=catalog, без параметров клиента');
    ok(r.headers.get('Content-Type') === 'application/json; charset=utf-8', 'Content-Type json utf-8');
    ok(r.headers.get('Access-Control-Allow-Origin') === '*', 'CORS *');
    ok(r.headers.get('Cache-Control') === 'no-store', 'Cache-Control no-store');

    r = await worker.fetch(req('GET', '/catalog'), w.env, w.ctx);
    ok(await r.text() === b1 && w.gasCalls.length === 1, 'второй запрос из кэша (GAS не вызывался)');

    // GAS отдаёт новое; через 61 с получаем старое и обновление в фоне
    w.gas.catalog = () => ({ status: 200, body: w.goodCatalog(2) });
    w.now += 61000;
    r = await worker.fetch(req('GET', '/catalog'), w.env, w.ctx);
    ok(await r.text() === b1, 'через 61 с отдано старое');
    await w.flush();
    ok(w.gasCalls.length === 2, 'в фоне запрошено обновление');
    r = await worker.fetch(req('GET', '/catalog'), w.env, w.ctx);
    ok((await r.text()) === w.goodCatalog(2), 'следующий запрос — уже новое');

    // плохие ответы не затирают хороший
    const good2 = w.goodCatalog(2);
    for (const bad of [
      { status: 200, body: 'not json' },
      { status: 200, body: JSON.stringify({ ok: false }) },
      { status: 200, body: JSON.stringify({ ok: true }) },
      { status: 500, body: good2 },
      'throw',
    ]) {
      w.gas.catalog = () => bad;
      w.now += 61000;
      r = await worker.fetch(req('GET', '/catalog'), w.env, w.ctx);
      await w.flush();
      const t = await r.text();
      ok(r.status === 200 && t === good2, 'плохой ответ GAS -> отдаётся прошлый хороший');
    }
    // старше 24 ч и GAS лежит -> 502
    w.now += 25 * 3600 * 1000;
    r = await worker.fetch(req('GET', '/catalog'), w.env, w.ctx);
    ok(r.status === 502 && r.headers.get('Access-Control-Allow-Origin') === '*', 'нет хорошего (старше 24 ч) и GAS плох -> 502');

    r = await worker.fetch(req('OPTIONS', '/catalog'), w.env, w.ctx);
    ok(r.status === 204 && r.headers.get('Access-Control-Allow-Origin') === '*', 'OPTIONS -> 204 с CORS');
  });

  await run('/catalog: первый запрос с плохим GAS -> 502', async (worker) => {
    const w = makeEnv();
    w.gas.catalog = () => ({ status: 200, body: 'oops' });
    const r = await worker.fetch(req('GET', '/catalog'), w.env, w.ctx);
    ok(r.status === 502, 'нет кэша и плохой ответ -> 502');
  });

  await run('/catalog: слои хранилища', async (worker) => {
    // KV: новый изолят (новая загрузка модуля) читает из KV
    const kv = makeKV();
    const w = makeEnv({ PAMIR_KV: kv });
    w.cacheWorks = false; // как workers.dev
    await worker.fetch(req('GET', '/catalog'), w.env, w.ctx);
    ok(kv.m.has('catalog'), 'ответ записан в KV');
    const worker2 = await loadWorker();
    const before = w.gasCalls.length;
    const r = await worker2.fetch(req('GET', '/catalog'), w.env, w.ctx);
    ok(r.status === 200 && w.gasCalls.length === before, 'второй изолят отдаёт из KV');
  });
  await run('/catalog: без KV и с нерабочим Cache API', async (worker) => {
    const w = makeEnv();
    w.cacheWorks = false;
    let r = await worker.fetch(req('GET', '/catalog'), w.env, w.ctx);
    ok(r.status === 200, 'работает без KV и без Cache API (из памяти)');
    r = await worker.fetch(req('GET', '/catalog'), w.env, w.ctx);
    ok(w.gasCalls.length === 1, 'второй запрос из памяти изолята');
    delete globalThis.caches;
    const worker2 = await loadWorker();
    r = await worker2.fetch(req('GET', '/catalog'), w.env, w.ctx);
    ok(r.status === 200, 'нет даже объекта caches — без ошибок');
  });
  await run('/catalog: Cache API как второй слой', async (worker) => {
    const w = makeEnv();
    await worker.fetch(req('GET', '/catalog'), w.env, w.ctx);
    const worker2 = await loadWorker();
    const before = w.gasCalls.length;
    await worker2.fetch(req('GET', '/catalog'), w.env, w.ctx);
    ok(w.gasCalls.length === before, 'второй изолят отдаёт из Cache API');
  });

  await run('/purge', async (worker) => {
    const w = makeEnv();
    await worker.fetch(req('GET', '/catalog'), w.env, w.ctx);
    let r = await worker.fetch(req('POST', '/purge'), w.env, w.ctx);
    ok(r.status === 403, 'без ключа -> 403');
    r = await worker.fetch(req('POST', '/purge', { 'X-Pamir-Key': 'wrong' }), w.env, w.ctx);
    ok(r.status === 403, 'неверный ключ -> 403');
    r = await worker.fetch(req('POST', '/purge', { 'X-Pamir-Key': SECRET + 'x' }), w.env, w.ctx);
    ok(r.status === 403, 'ключ длиннее -> 403');
    ok(w.gasCalls.length === 1, 'при 403 GAS не вызывался');
    w.gas.catalog = () => ({ status: 200, body: w.goodCatalog(7) });
    w.now += 6000;
    const callsBefore = w.gasCalls.length;
    let release; const gate = new Promise((res) => { release = res; });
    w.gas.catalog = async () => { await gate; return { status: 200, body: w.goodCatalog(7) }; };
    r = await worker.fetch(req('POST', '/purge', { 'X-Pamir-Key': SECRET }), w.env, w.ctx);
    const j = await r.json();
    ok(r.status === 200 && j.ok === true, 'с ключом -> {ok:true} сразу, пока Apps Script ещё не ответил');
    release();
    await w.flush();
    ok(w.gasCalls.length === callsBefore + 1, 'в фоне каталог перечитан');
    r = await worker.fetch(req('GET', '/catalog'), w.env, w.ctx);
    ok((await r.text()) === w.goodCatalog(7), 'после purge каталог новый сразу (без ожидания 60 с)');

    // повторные purge чаще раза в 5 с не запускают чтение
    const c2 = w.gasCalls.length;
    w.now += 1000;
    for (let i = 0; i < 5; i++) await worker.fetch(req('POST', '/purge', { 'X-Pamir-Key': SECRET }), w.env, w.ctx);
    await w.flush();
    ok(w.gasCalls.length === c2, '5 purge подряд в пределах 5 с: новых чтений нет');
    w.now += 6000;
    const r2 = await worker.fetch(req('POST', '/purge', { 'X-Pamir-Key': SECRET }), w.env, w.ctx);
    await w.flush();
    ok((await r2.json()).ok === true && w.gasCalls.length === c2 + 1, 'через 5 с purge снова читает');

    // плохой ответ в фоне: клиенту всё равно {ok:true}, старый кэш цел
    w.gas.catalog = () => ({ status: 200, body: 'bad' });
    w.now += 6000;
    r = await worker.fetch(req('POST', '/purge', { 'X-Pamir-Key': SECRET }), w.env, w.ctx);
    await w.flush();
    ok(r.status === 200, 'purge при плохом GAS отвечает {ok:true}');
    r = await worker.fetch(req('GET', '/catalog'), w.env, w.ctx);
    ok((await r.text()) === w.goodCatalog(7), 'старый хороший каталог остался');
  });

  await run('пауза 30 с после сбоя Apps Script', async (worker) => {
    const w = makeEnv();
    await worker.fetch(req('GET', '/catalog'), w.env, w.ctx);
    const good = w.goodCatalog(1);
    w.gas.catalog = () => ({ status: 500, body: 'err' });
    w.now += 61000;
    await worker.fetch(req('GET', '/catalog'), w.env, w.ctx); // STALE -> фон -> сбой
    await w.flush();
    const base = w.gasCalls.length;
    for (let i = 0; i < 50; i++) {
      w.now += 200; // 10 с суммарно
      const r = await worker.fetch(req('GET', '/catalog'), w.env, w.ctx);
      await w.flush();
      if ((await r.text()) !== good) { ok(false, 'отдан не прошлый хороший'); break; }
    }
    ok(w.gasCalls.length === base, '50 запросов при сбое — 0 новых запросов в Apps Script');
    w.now += 31000;
    await worker.fetch(req('GET', '/catalog'), w.env, w.ctx);
    await w.flush();
    ok(w.gasCalls.length === base + 1, 'после 30 с пробуем снова');

    // нет хорошего ответа вообще: 502 без нового запроса
    const w2 = makeEnv();
    const worker2 = await loadWorker();
    w2.gas.catalog = () => ({ status: 200, body: 'oops' });
    let r = await worker2.fetch(req('GET', '/catalog'), w2.env, w2.ctx);
    ok(r.status === 502 && w2.gasCalls.length === 1, 'первый сбой -> 502');
    for (let i = 0; i < 20; i++) { w2.now += 100; r = await worker2.fetch(req('GET', '/catalog'), w2.env, w2.ctx); }
    ok(r.status === 502 && w2.gasCalls.length === 1, 'в паузу 502 без нового запроса к Apps Script');

    // пауза общая через Cache API: другой изолят тоже не ходит
    const w3 = makeEnv();
    const wa = await loadWorker(), wb = await loadWorker();
    w3.gas.catalog = () => ({ status: 200, body: 'oops' });
    await wa.fetch(req('GET', '/catalog'), w3.env, w3.ctx);
    await wb.fetch(req('GET', '/catalog'), w3.env, w3.ctx);
    ok(w3.gasCalls.length === 1, 'второй изолят видит паузу в Cache API');

    // purge игнорирует паузу и снимает её
    const w4 = makeEnv();
    const w4w = await loadWorker();
    w4.gas.catalog = () => ({ status: 500, body: '' });
    await w4w.fetch(req('GET', '/catalog'), w4.env, w4.ctx);
    w4.gas.catalog = () => ({ status: 200, body: w4.goodCatalog(3) });
    w4.now += 1000;
    await w4w.fetch(req('POST', '/purge', { 'X-Pamir-Key': SECRET }), w4.env, w4.ctx);
    await w4.flush();
    r = await w4w.fetch(req('GET', '/catalog'), w4.env, w4.ctx);
    ok(r.status === 200 && (await r.text()) === w4.goodCatalog(3), 'purge работает и во время паузы');
  });

  await run('KV: поле updated не считается изменением', async (worker) => {
    const kv = makeKV();
    const w = makeEnv({ PAMIR_KV: kv });
    let n = 0;
    const cat = (upd, id) => JSON.stringify({ ok: true, updated: upd, shop: {}, categories: [], products: [{ id }] });
    w.gas.catalog = () => ({ status: 200, body: cat('2026-01-01T10:00:' + String(++n % 60).padStart(2, '0'), 'a') });
    await worker.fetch(req('GET', '/catalog'), w.env, w.ctx);
    ok(kv.puts.length === 1, 'первая запись каталога в KV');
    for (let i = 0; i < 30; i++) {
      w.now += 61000; // каждый раз устарел -> обновление, меняется только updated
      await worker.fetch(req('GET', '/catalog'), w.env, w.ctx);
      await w.flush();
    }
    // 30 обновлений * 61 с ~ 30 мин: максимум одна перезапись по таймеру
    ok(kv.puts.length <= 2, 'при смене одного updated KV не пишется на каждое обновление (записей: ' + kv.puts.length + ')');
    w.gas.catalog = () => ({ status: 200, body: cat('2026-01-01T11:00:00', 'b') });
    const before = kv.puts.length;
    w.now += 61000;
    await worker.fetch(req('GET', '/catalog'), w.env, w.ctx);
    await w.flush();
    ok(kv.puts.length === before + 1, 'реальное изменение товаров — запись в KV');
    // холодный изолят с тем же каталогом не пишет
    const worker2 = await loadWorker();
    w.gas.catalog = () => ({ status: 200, body: cat('2026-01-01T12:00:00', 'b') });
    w.now += 61000;
    const b2 = kv.puts.length;
    await worker2.fetch(req('GET', '/catalog'), w.env, w.ctx);
    await w.flush();
    ok(kv.puts.length === b2, 'холодный изолят: каталог не изменился (кроме updated) — без записи');
  });

  await run('scheduled: слежение', async (worker) => {
    const kv = makeKV();
    const w = makeEnv({ PAMIR_KV: kv, BOT_TOKEN: TOKEN, ADMIN_CHAT_IDS: '111, 222' });
    const tick = async (min) => { w.now += (min || 5) * 60000; await worker.scheduled({}, w.env, w.ctx); await w.flush(); };
    await tick();
    ok(w.sent.length === 0, 'GAS жив — тишина');
    w.gas.ping = () => ({ status: 200, body: 'html error' });
    await tick();
    ok(w.sent.length === 0, 'одна ошибка — тишина');
    await tick();
    ok(w.sent.length === 2, 'две ошибки подряд — сообщение каждому админу');
    ok(w.sent.every((m) => m.body.text === 'Магазин не відповідає'), 'текст «Магазин не відповідає»');
    ok(w.sent.map((m) => String(m.body.chat_id)).sort().join() === '111,222', 'оба chat_id');
    await tick(); await tick();
    ok(w.sent.length === 2, 'пока лежит — повтора нет');
    w.gas.ping = () => ({ status: 200, body: JSON.stringify({ ok: true }) });
    await tick();
    ok(w.sent.length === 4 && w.sent[2].body.text === 'Магазин знову працює', 'восстановление — сообщение');
    // падение сразу снова: вид «не відповідає» не чаще 30 мин
    w.gas.ping = () => 'throw';
    await tick(); await tick();
    ok(w.sent.length === 4, 'новое падение в пределах 30 мин — без повтора');
    w.gas.ping = () => ({ status: 200, body: JSON.stringify({ ok: true }) });
    await tick(5);
    // после 30 мин — снова можно
    w.gas.ping = () => ({ status: 500, body: '' });
    await tick(31); await tick(5);
    ok(w.sent.length === 6 && w.sent[4].body.text === 'Магазин не відповідає', 'через 30+ мин сообщение снова уходит');
    ok(!w.logs.some((l) => l.includes(TOKEN) || l.includes(SECRET)), 'токен и секрет не в console.log');
    ok(!w.gasCalls.some((u) => u.includes('action=catalog')), 'cron не трогает каталог (нет прогрева)');
    ok(!kv.m.has('catalog'), 'cron не пишет каталог в KV');
  });

  await run('scheduled: записи KV только при изменении', async (worker) => {
    const kv = makeKV();
    const w = makeEnv({ PAMIR_KV: kv, BOT_TOKEN: TOKEN, ADMIN_CHAT_IDS: '111' });
    const tick = async () => { w.now += 300000; await worker.scheduled({}, w.env, w.ctx); await w.flush(); };
    for (let i = 0; i < 288; i++) await tick();
    ok(kv.puts.length === 1, 'сутки без сбоев: 1 запись состояния (первая), а не 288');
    w.gas.ping = () => 'throw';
    for (let i = 0; i < 20; i++) await tick();
    ok(kv.puts.length === 3, 'долгий сбой: ещё 2 записи (1-я и 2-я ошибка), дальше без записей');
  });

  await run('горячий путь /catalog: JSON не разбирается повторно', async (worker) => {
    const kv = makeKV();
    const w = makeEnv({ PAMIR_KV: kv });
    await worker.fetch(req('GET', '/catalog'), w.env, w.ctx);
    const worker2 = await loadWorker();
    const orig = JSON.parse; let parses = 0;
    JSON.parse = function () { parses++; return orig.apply(this, arguments); };
    try {
      await worker.fetch(req('GET', '/catalog'), w.env, w.ctx);   // из памяти
      await worker2.fetch(req('GET', '/catalog'), w.env, w.ctx);  // из KV
    } finally { JSON.parse = orig; }
    ok(parses === 0, 'ответы из памяти и из KV без JSON.parse');
  });

  await run('scheduled: без хранилища и без токена', async (worker) => {
    const w = makeEnv({ BOT_TOKEN: TOKEN, ADMIN_CHAT_IDS: '111' }); // KV нет
    w.cacheWorks = false; // состояние хранить негде
    w.gas.ping = () => 'throw';
    for (let i = 0; i < 4; i++) { w.now += 300000; await worker.scheduled({}, w.env, w.ctx); await w.flush(); }
    ok(w.sent.length === 0, 'негде хранить состояние — молчим');

    const w2 = makeEnv({ ADMIN_CHAT_IDS: '111' }); // нет BOT_TOKEN
    const worker2 = await loadWorker();
    w2.gas.ping = () => 'throw';
    for (let i = 0; i < 4; i++) { w2.now += 300000; await worker2.scheduled({}, w2.env, w2.ctx); await w2.flush(); }
    ok(w2.sent.length === 0, 'нет BOT_TOKEN — тишина');
    ok(!w2.gasCalls.some((u) => u.includes('action=ping')), 'нет BOT_TOKEN — слежение выключено полностью');

    const w3 = makeEnv({ BOT_TOKEN: TOKEN, ADMIN_CHAT_IDS: '111' }); // без KV, Cache API работает
    const worker3 = await loadWorker();
    w3.gas.ping = () => 'throw';
    for (let i = 0; i < 3; i++) { w3.now += 300000; await worker3.scheduled({}, w3.env, w3.ctx); await w3.flush(); }
    ok(w3.sent.length === 1, 'без KV, но с рабочим Cache API — слежение работает');
  });

  await run('утечки', async (worker) => {
    const kv = makeKV();
    const w = makeEnv({ PAMIR_KV: kv, BOT_TOKEN: TOKEN, ADMIN_CHAT_IDS: '111' });
    const bodies = [];
    for (const r0 of [
      req('GET', '/'), req('GET', '/catalog'), req('POST', '/purge'),
      req('POST', '/purge', { 'X-Pamir-Key': SECRET }), req('POST', '/', {}, '{}'), req('OPTIONS', '/catalog'),
    ]) {
      const r = await worker.fetch(r0, w.env, w.ctx);
      bodies.push(await r.text() + JSON.stringify([...r.headers]));
    }
    ok(!bodies.some((b) => b.includes(TOKEN) || b.includes(SECRET) || b.includes(GAS)), 'ответы не содержат токен, секрет и адрес GAS');
    w.gas.ping = () => 'throw';
    for (let i = 0; i < 3; i++) { w.now += 300000; await worker.scheduled({}, w.env, w.ctx); await w.flush(); }
    ok(w.sent.length === 1, 'сообщение ушло');
    ok(!w.logs.some((l) => l.includes(TOKEN) || l.includes(SECRET)), 'console.log без токена и секрета');
  });

  Date.now = realNow;
  globalThis.fetch = realFetch;
  console.log = realLog;
  out('\nИтого: ' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
}

main();
