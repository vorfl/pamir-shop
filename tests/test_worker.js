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
  const m = new Map(); const meta = new Map(); const puts = []; const gets = [];
  const dec = (v) => (v instanceof Uint8Array ? new TextDecoder().decode(v) : v);
  return {
    m,
    async get(k, type) {
      gets.push(k);
      const v = m.get(k); if (v === undefined) return null;
      if (type === 'arrayBuffer') return v instanceof Uint8Array ? v.slice().buffer : new TextEncoder().encode(v).buffer;
      return type === 'json' ? JSON.parse(dec(v)) : dec(v);
    },
    async getWithMetadata(k) { const v = m.get(k); return v === undefined ? { value: null, metadata: null } : { value: dec(v), metadata: meta.get(k) || null }; },
    async put(k, v, o) { m.set(k, v instanceof Uint8Array ? v.slice() : v); meta.set(k, o && o.metadata); puts.push(k); },
    puts, gets, meta,
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

/* ================= Справочник Новой пошты ================= */
const NPKEY = 'np-key-SECRET-9f3a';
const NP_URL = 'https://api.novaposhta.ua/v2.0/json/';
const KYIV = '8d5a980d-391c-11dd-90d9-001a92567626';
const NB = 32;
function refBucket(ref) { let h = 2166136261; for (let i = 0; i < ref.length; i++) { h ^= ref.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) % NB; }

function npDataset(seedShuffle) {
  const ds = []; const truth = new Map(); // ref -> Set('num+t')
  let ci = 0;
  const mkRef = () => ((++ci * 2654435761) >>> 0).toString(16).padStart(8, '0') + '-391c-11dd-90d9-001a92567626';
  function city(ua, ru, area, type, region, nb, np, ref) {
    ref = ref || mkRef();
    for (let k = 0; k < nb + np; k++) {
      const post = k >= nb; const num = post ? k - nb + 1 : k + 1;
      const addr = ua + ', вул. Хрещатик, ' + num;
      ds.push({
        Ref: 'w' + ds.length, Number: String(num), SiteKey: String(1000 + ds.length),
        Description: post ? 'Поштомат "Нова Пошта" №' + num + ': ' + addr : 'Відділення №' + num + ': до 30 кг: ' + addr,
        DescriptionRu: 'Отделение №' + num + ': до 30 кг: ' + ru + ', ул. Крещатик, ' + num,
        ShortAddress: addr, ShortAddressRu: ru + ', ул. Крещатик, ' + num,
        Phone: '380800500609', TypeOfWarehouse: 'v' + (post ? 1 : 2), CategoryOfWarehouse: post ? 'Postomat' : 'Branch',
        CityRef: ref, CityDescription: ua, CityDescriptionRu: ru, SettlementRef: 's' + ci, SettlementDescription: ua,
        SettlementAreaDescription: area, SettlementRegionsDescription: region, SettlementTypeDescription: type,
        Longitude: '30.5234', Latitude: '50.4501', PostFinance: '1', BicycleParking: '0', PaymentAccess: '1', POSTerminal: '1',
        InternationalShipping: '0', SelfServiceWorkplacesCount: '1', TotalMaxWeightAllowed: '0', PlaceMaxWeightAllowed: '30',
        Reception: { Monday: '09:00-20:00', Tuesday: '09:00-20:00', Wednesday: '09:00-20:00', Thursday: '09:00-20:00', Friday: '09:00-20:00' },
        Delivery: { Monday: '09:00-20:00', Tuesday: '09:00-20:00', Wednesday: '09:00-20:00' },
        Schedule: { Monday: '09:00-20:00', Tuesday: '09:00-20:00', Wednesday: '09:00-20:00', Thursday: '09:00-20:00', Friday: '09:00-20:00', Saturday: '09:00-18:00', Sunday: '09:00-18:00' },
        Warehouse: '1', Ratings: '0', WarehouseStatus: 'Working', WarehouseIllusion: '0', CategoryOfWarehouseRu: 'x'.repeat(40),
      });
      if (!truth.has(ref)) truth.set(ref, new Set());
      truth.get(ref).add(num + (post ? 'p' : 'w'));
    }
  }
  city('Київ', 'Киев', 'Київ', 'місто', '', 900, 400, KYIV);
  city('Дніпро', 'Днепр', 'Дніпропетровська', 'місто', '', 150, 50);
  city('Харків', 'Харьков', 'Харківська', 'місто', '', 170, 50);
  city('Одеса', 'Одесса', 'Одеська', 'місто', '', 100, 20);
  city('Миколаїв', 'Николаев', 'Миколаївська', 'місто', '', 60, 30);
  city('Чернігів', 'Чернигов', 'Чернігівська', 'місто', '', 40, 20);
  city('Ірпінь', 'Ирпень', 'Київська', 'місто', '', 10, 5);
  city('Дніпрорудне', 'Днепрорудное', 'Запорізька', 'селище міського типу', 'Василівський', 10, 5);
  city('Дніпровка', 'Днепровка', 'Запорізька', 'село', 'Мелітопольський', 2, 1);
  city('Верхньодніпровськ', 'Верхнеднепровск', 'Дніпропетровська', 'місто', '', 4, 2);
  city('Корольов', 'Королёв', 'Житомирська', 'село', 'Житомирський', 2, 0);
  city("П'ятихатки", 'Пятихатки', 'Дніпропетровська', 'місто', '', 5, 2);
  city('Каховка', 'Каховка', 'Херсонська', 'село', 'Каховський', 1, 0);
  city('Нова Каховка', 'Новая Каховка', 'Херсонська', 'місто', '', 8, 2);
  city('Верхньокаховка', 'Верхнекаховка', 'Херсонська', 'село', 'Каховський', 1, 0);
  for (let i = 1; i <= 40; i++) city('Село ' + i, 'Село ' + i, 'Львівська', 'село', 'Район', 4, 1);
  // дубли (НП сдвинул страницы)
  ds.push(Object.assign({}, ds[10]), Object.assign({}, ds[500]), Object.assign({}, ds[900]));
  // перемешиваем: записи города разбросаны по страницам
  let seed = seedShuffle || 12345;
  for (let i = ds.length - 1; i > 0; i--) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; const j = seed % (i + 1); const t = ds[i]; ds[i] = ds[j]; ds[j] = t; }
  return { ds, truth };
}

function npHarness(extraEnv, data) {
  const kv = makeKV();
  const w = makeEnv(Object.assign({ PAMIR_KV: kv, NP_API_KEY: NPKEY }, extraEnv));
  const np = { ds: data.ds, calls: [], events: [], hook: null, cache: new Map(), n: 0 };
  const inner = globalThis.fetch;
  globalThis.fetch = async (url, o) => {
    if (String(url) !== NP_URL) return inner(url, o);
    const b = JSON.parse(o.body);
    const page = Number(b.methodProperties.Page), limit = Number(b.methodProperties.Limit);
    np.n++;
    np.calls.push({ page, limit, key: b.apiKey, model: b.modelName, method: b.calledMethod, t: w.now });
    np.events.push('req');
    const h = np.hook && np.hook({ n: np.n, page });
    if (h === 'throw') throw new Error('network');
    if (h) return new Response(h.body, { status: h.status || 200 });
    const ck = page + ':' + limit;
    let text = np.cache.get(ck);
    if (text === undefined) {
      text = JSON.stringify({ success: true, data: np.ds.slice((page - 1) * limit, page * limit), errors: [], warnings: [], info: { totalCount: np.ds.length }, errorCodes: [] });
      np.cache.set(ck, text);
    }
    return new Response(text, { status: 200 });
  };
  for (let pg = 1; pg <= Math.ceil(np.ds.length / 150); pg++) np.cache.set(pg + ':150', JSON.stringify({ success: true, data: np.ds.slice((pg - 1) * 150, pg * 150), errors: [], warnings: [], info: { totalCount: np.ds.length }, errorCodes: [] }));
  return { kv, w, np, data, ticks: [], bodies: [] };
}

const npTrace = { events: null };
async function npTick(h, worker, minutes) {
  h.w.now += (minutes || 5) * 60000;
  const s = { puts: h.kv.puts.length, gets: h.kv.gets.length, calls: h.np.calls.length };
  npTrace.events = h.np.events; h.np.events.push('tick');
  const c0 = process.cpuUsage();
  await worker.scheduled({}, h.w.env, h.w.ctx);
  await h.w.flush();
  const c = process.cpuUsage(c0);
  const rec = { puts: h.kv.puts.length - s.puts, gets: h.kv.gets.length - s.gets, calls: h.np.calls.length - s.calls, cpuMs: (c.user + c.system) / 1000 };
  h.ticks.push(rec);
  return rec;
}
const npMetaOf = (h) => { const v = h.kv.m.get('np:meta'); return v ? JSON.parse(v) : null; };
const npStateOf = (h) => { const v = h.kv.m.get('np:st'); return v ? JSON.parse(v) : null; };
async function npLoad(h, worker, max) {
  const g0 = npMetaOf(h) && npMetaOf(h).g;
  for (let i = 0; i < (max || 80); i++) {
    await npTick(h, worker);
    const m = npMetaOf(h);
    if (m && m.g !== g0) return i + 1;
  }
  return -1;
}
async function npGet(h, worker, p) {
  const r = await worker.fetch(req('GET', p), h.w.env, h.w.ctx);
  const text = await r.text();
  h.bodies.push(text + JSON.stringify([...r.headers]));
  let j = null; try { j = JSON.parse(text); } catch (e) { /* не json */ }
  return { r, text, j };
}

async function npTests() {
  const realSetTimeout = globalThis.setTimeout;
  // Паузы 1-3 с (между запросами к НП) выполняем мгновенно, но запоминаем; остальные таймеры настоящие.
  globalThis.setTimeout = (fn, ms, ...a) => {
    if (ms >= 1000 && ms <= 3000) { if (npTrace.events) npTrace.events.push('sleep:' + ms); return realSetTimeout(fn, 0, ...a); }
    return realSetTimeout(fn, ms, ...a);
  };
  try {
    const data = npDataset();
    const N = data.ds.length;
    const uniq = [...data.truth.values()].reduce((s, x) => s + x.size, 0);
    out('# НП: набор данных: ' + N + ' записей (с дублями), уникальных ' + uniq + ', городов ' + data.truth.size);

    await run('НП: конвейер доходит до конца, пределы на запуск, темп, записи KV', async (worker) => {
      const h = npHarness({ NP_ASM_KB: '40' }, data);
      let r = await npGet(h, worker, '/np/cities?q=%D0%B4%D0%BD');
      ok(r.j && r.j.ok === false && r.j.error === 'nodata', 'до загрузки /np/cities -> nodata');
      r = await npGet(h, worker, '/np/warehouses?city=' + KYIV);
      ok(r.j && r.j.error === 'nodata', 'до загрузки /np/warehouses -> nodata');
      const ticks = await npLoad(h, worker, 80);
      const pages = Math.ceil(N / 150), fetchRuns = Math.ceil(pages / 2);
      const st = npStateOf(h);
      ok(ticks > 0, 'справочник опубликован за ' + ticks + ' запусков cron (' + fetchRuns + ' на загрузку, остальное сборка)');
      ok(ticks >= fetchRuns + 2 && ticks <= fetchRuns + 2 + 14, 'число запусков близко к расчёту: ' + fetchRuns + ' + сборка + склейка');
      ok(h.np.calls.length === pages, 'запросов в НП ровно ' + pages + ' (по странице на 150), было ' + h.np.calls.length);
      ok(h.np.calls.every((c) => c.limit === 150 && c.key === NPKEY && c.model === 'Address' && c.method === 'getWarehouses'), 'каждый запрос: Limit 150, getWarehouses, ключ в теле');
      ok(h.ticks.every((t) => t.calls <= 2), 'не больше 2 запросов в НП за запуск (макс ' + Math.max(...h.ticks.map((t) => t.calls)) + ')');
      ok(h.ticks.every((t) => t.calls * 150 <= 300), 'разбирается не больше 300 записей за запуск');
      ok(h.ticks.every((t) => t.puts <= NB + 2), 'записей KV за запуск не больше ' + (NB + 2) + ' (макс ' + Math.max(...h.ticks.map((t) => t.puts)) + ')');
      ok(h.ticks.every((t) => t.gets <= 150), 'чтений KV за запуск не больше 150 (макс ' + Math.max(...h.ticks.map((t) => t.gets)) + ')');
      const ev = h.np.events; let gapOk = true, pairs = 0;
      for (let i = 0; i < ev.length; i++) {
        if (ev[i] !== 'req') continue;
        let j = i - 1; let slept = 0;
        while (j >= 0 && ev[j] !== 'req' && ev[j] !== 'tick') { if (ev[j].indexOf('sleep:') === 0) slept = Math.max(slept, Number(ev[j].slice(6))); j--; }
        if (j >= 0 && ev[j] === 'req') { pairs++; if (slept < 1000) gapOk = false; }
      }
      ok(pairs > 0 && gapOk, 'между запросами к НП в одном запуске пауза >= 1 с (пар: ' + pairs + ')');
      const total = h.kv.puts.length;
      const expected = fetchRuns + ticks + NB + 2;
      ok(total <= expected, 'записей KV на полную загрузку ' + total + ' <= расчёт ' + expected + ' (куски ' + fetchRuns + ', состояние ' + ticks + ', корзины ' + NB + ', индекс 1, указатель 1)');
      {
        const sz = (pref) => [...h.kv.m.entries()].filter(([k]) => k.indexOf(pref) === 0).map(([, v]) => (v instanceof Uint8Array ? v.length : String(v).length));
        const raw = sz('np:r:'), bk = sz('np:g:').sort((a, b) => b - a);
        out('  инфо  размеры, байт: сырой кусок (300 записей) в среднем ' + Math.round(raw.reduce((a, b) => a + b, 0) / raw.length) + ', самая большая корзина ' + bk[0] + ', индекс городов ' + h.kv.m.get('np:g:' + npMetaOf(h).g + ':c').length + ', всего корзин ' + bk.reduce((a, b) => a + b, 0) + ' на ' + uniq + ' отделений');
      }
      ok(h.kv.puts.filter((k) => k === 'np:meta').length === 1, 'указатель поколения записан один раз');
      ok(!h.kv.puts.some((k) => k === 'catalog'), 'каталог в KV не тронут конвейером');
      ok(st && st.s === 'idle' && st.wd.n === total, 'после загрузки конвейер в покое; счётчик записей за сутки совпал (' + st.wd.n + ')');
      const fetchCpu = Math.max(...h.ticks.slice(0, fetchRuns).map((t) => t.cpuMs));
      const asmCpu = Math.max(...h.ticks.slice(fetchRuns).map((t) => t.cpuMs));
      out('  инфо  CPU по запускам, мс: ' + h.ticks.map((t) => t.cpuMs.toFixed(1)).join(' '));
      out('  инфо  CPU Node, мс: запуск загрузки до ' + fetchCpu.toFixed(1) + ', сборка/склейка до ' + asmCpu.toFixed(1) + ' (в Cloudflare будет иначе; лимит 10 мс)');
      ok(fetchCpu < 100 && asmCpu < 100, 'процессорное время шага (Node) грубо в норме (< 100 мс)');
      {
        // честнее: одна страница за запуск (без пауз), время по таймеру высокой точности
        const hm = npHarness({ NP_PAGES_PER_RUN: '1', NP_ASM_KB: '4000' }, data);
        const wall = [];
        for (let i = 0; i < 40; i++) {
          const a = process.hrtime.bigint();
          await npTick(hm, worker);
          wall.push(Number(process.hrtime.bigint() - a) / 1e6);
          if (npMetaOf(hm)) break;
        }
        const pg = Math.ceil(N / 150);
        const fw = wall.slice(2, pg).sort((x, y) => x - y); // без прогрева
        const asm = wall.slice(pg);
        out('  инфо  время запуска (Node, 1 страница на 150 записей): медиана ' + fw[Math.floor(fw.length / 2)].toFixed(2) + ' мс, максимум ' + fw[fw.length - 1].toFixed(2) + ' мс; сборка всех корзин одним запуском (' + N + ' записей, Киев 1300): ' + asm.map((x) => x.toFixed(1)).join(' + ') + ' мс');
        ok(fw[fw.length - 1] < 100 && Math.max(...asm) < 300, 'время шагов (Node, грубо) в разумных пределах');
      }

      r = await npGet(h, worker, '/np/warehouses?city=' + KYIV);
      const L = r.j && r.j.list;
      ok(r.r.status === 200 && r.j.ok === true && Array.isArray(L) && L.length === data.truth.get(KYIV).size, 'Киев: ' + (L && L.length) + ' отделений и почтоматов = уникальным (дубли убраны)');
      ok(L.every((x) => Array.isArray(x) && x.length === 3 && Number.isInteger(x[0]) && typeof x[1] === 'string' && (x[2] === 'w' || x[2] === 'p')), 'формат как у np.whall: [номер, адрес, "w"|"p"]');
      let sorted = true; for (let i = 1; i < L.length; i++) if (L[i][0] < L[i - 1][0] || (L[i][0] === L[i - 1][0] && L[i][2] === 'w' && L[i - 1][2] === 'p')) sorted = false;
      ok(sorted, 'сортировка по номеру (при равном номере отделение раньше почтомата)');
      ok(L.filter((x) => x[2] === 'p').length === 400 && L.filter((x) => x[2] === 'w').length === 900, 'почтоматы помечены "p" (400), отделения "w" (900)');
      ok(L[0][0] === 1 && L[0][2] === 'w' && L[0][1] === 'Київ, вул. Хрещатик, 1', 'первое отделение №1 с коротким адресом');
      r = await npGet(h, worker, '/np/warehouses?city=' + KYIV.toUpperCase());
      ok(r.j && r.j.ok === true && r.j.list.length === L.length, 'Ref в верхнем регистре тоже принят');
      r = await npGet(h, worker, '/np/warehouses?city=' + KYIV + '&q=12');
      ok(r.j.list.length <= 12 && r.j.list[0][0] === 12 && r.j.list[0][2] === 'w' && r.j.list[1][0] === 12 && r.j.list[1][2] === 'p', 'необязательный q: точный номер первым');
      r = await npGet(h, worker, '/np/warehouses?city=' + KYIV + '&t=locker');
      ok(r.j.list.length === 400 && r.j.list.every((x) => x[2] === 'p'), 't=locker: только почтоматы');
      let allOk = true;
      for (const [ref, set] of data.truth) {
        const x = await npGet(h, worker, '/np/warehouses?city=' + ref);
        if (!x.j || x.j.ok !== true || x.j.list.length !== set.size) allOk = false;
      }
      ok(allOk, 'все ' + data.truth.size + ' городов: число отделений совпало с эталоном');
      r = await npGet(h, worker, '/np/warehouses?city=00000000-0000-0000-0000-000000000000');
      ok(r.j && r.j.ok === false && r.j.error === 'nodata' && r.r.headers.get('Cache-Control') === 'no-store', 'город не найден в KV -> nodata, no-store');
      let badOk = true;
      for (const bad of ['', 'abc', KYIV + 'x', "' or 1=1 --"]) {
        r = await npGet(h, worker, '/np/warehouses?city=' + encodeURIComponent(bad));
        if (!(r.r.status === 400 && r.j.ok === false && r.j.error === 'bad_city')) badOk = false;
      }
      ok(badOk, 'неверный city (пусто, не UUID, лишний символ, инъекция) -> 400 bad_city');
      r = await npGet(h, worker, '/np/warehouses?city=' + KYIV);
      ok(r.r.headers.get('Access-Control-Allow-Origin') === '*' && r.r.headers.get('Cache-Control') === 'public, max-age=600' && /^application\/json/.test(r.r.headers.get('Content-Type')), 'CORS *, Cache-Control public max-age=600, JSON');
      const o = await worker.fetch(req('OPTIONS', '/np/cities'), h.w.env, h.w.ctx);
      ok(o.status === 204 && o.headers.get('Access-Control-Allow-Origin') === '*', 'OPTIONS /np/cities -> 204 с CORS');
      const g0 = h.kv.gets.length;
      const worker2 = await loadWorker();
      await npGet(h, worker2, '/np/warehouses?city=' + KYIV);
      ok(h.kv.gets.length - g0 === 2, 'холодный изолят: /np/warehouses = 2 чтения KV (указатель + корзина), было ' + (h.kv.gets.length - g0));
      const g1 = h.kv.gets.length;
      for (let i = 0; i < 20; i++) await npGet(h, worker2, '/np/warehouses?city=' + KYIV);
      ok(h.kv.gets.length === g1, '20 повторных запросов: 0 чтений KV (память изолята)');
      const t0 = process.hrtime.bigint(); const c0 = process.cpuUsage();
      for (let i = 0; i < 50; i++) await npGet(h, worker2, '/np/warehouses?city=' + KYIV);
      const cpu = process.cpuUsage(c0); const wall = Number(process.hrtime.bigint() - t0) / 1e6;
      out('  инфо  /np/warehouses Киев (' + L.length + ' записей): в среднем ' + ((cpu.user + cpu.system) / 1000 / 50).toFixed(2) + ' мс процессора, ' + (wall / 50).toFixed(2) + ' мс на вызов (Node, без сети)');
      const dtc = process.hrtime.bigint();
      for (let i = 0; i < 50; i++) await npGet(h, worker2, '/np/cities?q=' + encodeURIComponent('дн'));
      out('  инфо  /np/cities?q=дн: ' + (Number(process.hrtime.bigint() - dtc) / 1e6 / 50).toFixed(2) + ' мс на вызов (Node, без сети)');
      const dump = [...h.kv.m.values()].map((v) => (v instanceof Uint8Array ? new TextDecoder().decode(v) : String(v))).join('\n');
      ok(!dump.includes(NPKEY) && !h.w.logs.some((l) => l.includes(NPKEY)) && !h.bodies.some((b) => b.includes(NPKEY)), 'ключ НП не встречается ни в ответах, ни в логах, ни в данных KV');
      const dump2 = h.bodies.join('');
      ok(!dump2.includes(SECRET) && !dump2.includes(GAS), 'секрет вебхука и адрес Apps Script не в ответах /np/*');
    });

    await run('НП: /np/cities — поиск', async (worker) => {
      const h = npHarness({}, data);
      await npLoad(h, worker, 80);
      const q = async (s) => { const r = await npGet(h, worker, '/np/cities?q=' + encodeURIComponent(s)); return r.j && r.j.list ? r.j.list : null; };
      const names = (l) => l.map((x) => x.s).join(',');
      let l = await q('днепр');
      ok(l && l[0].s === 'Дніпро' && l[0].n === 'м. Дніпро, Дніпропетровська обл.' && /^[0-9a-f-]{36}$/.test(l[0].ref) && Object.keys(l[0]).sort().join() === 'n,ref,s', 'русское написание «днепр» -> Дніпро, формат {n, s, ref}');
      ok(names(l) === 'Дніпро,Дніпрорудне,Дніпровка,Верхньодніпровськ', 'порядок: начало названия (город крупнее первым), затем вхождение: ' + names(l));
      l = await q('ДНІПРО');
      ok(l[0].s === 'Дніпро' && l.length === 4, 'украинское написание в верхнем регистре');
      l = await q('дніпр'); ok(l[0].s === 'Дніпро', 'и украинское без последних букв');
      l = await q('киев'); ok(l[0].s === 'Київ' && l[0].n === 'м. Київ', 'киев -> Київ');
      l = await q('Київ'); ok(l[0].s === 'Київ', 'Київ -> Київ');
      l = await q('королев'); ok(l.length === 1 && l[0].s === 'Корольов', 'е вместо ё: королев');
      l = await q('Королёв'); ok(l.length === 1 && l[0].s === 'Корольов', 'ё: Королёв');
      let apOk = true;
      for (const v of ["п'ятихатки", 'п’ятихатки', 'пʼятихатки', 'пятихатки', 'пятихатк']) { l = await q(v); if (!(l && l[0] && l[0].s === "П'ятихатки")) apOk = false; }
      ok(apOk, "апострофы (' ’ ʼ) и без них находят П'ятихатки");
      l = await q('миколаив'); ok(l[0].s === 'Миколаїв', 'и вместо ї: миколаив');
      l = await q('ирпень'); ok(l[0].s === 'Ірпінь', 'ирпень (ru) -> Ірпінь');
      l = await q('ирпинь'); ok(l[0].s === 'Ірпінь', 'ирпинь (и вместо і)');
      l = await q('каховк'); ok(names(l) === 'Каховка,Нова Каховка,Верхньокаховка', 'начало названия выше начала слова, выше вхождения: ' + names(l));
      l = await q('се'); ok(l.length === 10, 'не больше 10 результатов');
      ok((await q('д')).length === 0 && (await q('')).length === 0 && (await q('  ')).length === 0, 'пустой и односимвольный q -> пустой список ok');
      ok((await q('д'.repeat(41))).length === 0, 'слишком длинный q (41) -> пустой список');
      l = await q('qwertyzzz'); ok(l && l.length === 0, 'нет совпадений -> ok, пустой список');
      l = await q('ки\tев\n'); ok(Array.isArray(l), 'управляющие символы в q не ломают ответ');
      l = await q('обл'); ok(Array.isArray(l) && l.length === 0, 'слово из служебной части строки (обл) не даёт ложных совпадений');
      const r = await npGet(h, worker, '/np/cities?q=%D0%BA%D0%B8');
      ok(r.r.headers.get('Access-Control-Allow-Origin') === '*' && r.r.headers.get('Cache-Control') === 'public, max-age=600', '/np/cities: CORS и Cache-Control');
      ok(!h.bodies.join('').includes(NPKEY), 'в ответах нет ключа НП');
    });

    await run('НП: лимит НП, пустой ответ, ошибки — пауза и продолжение с того же места', async (worker) => {
      const LIMIT = { body: JSON.stringify({ success: false, data: [], errors: ['To many requests'], errorCodes: ['20000401501'] }) };
      const pages = Math.ceil(N / 150);
      {
        const h = npHarness({}, data);
        h.np.hook = ({ n }) => (n === 5 ? LIMIT : undefined);
        let t = 0;
        while (h.np.calls.length < 5 && t++ < 20) await npTick(h, worker);
        const failPage = h.np.calls[4].page;
        const st = npStateOf(h);
        ok(st.pu > h.w.now && st.le.k === 'limit' && st.pg === failPage, 'лимит: пауза записана, курсор остался на странице ' + failPage);
        const stat = (await npGet(h, worker, '/np/status')).j;
        ok(stat.loading.pausedUntil && stat.loading.lastProblem.kind === 'limit', '/np/status показывает паузу и причину');
        const c0 = h.np.calls.length;
        await npTick(h, worker); await npTick(h, worker);
        ok(h.np.calls.length === c0, 'пока пауза (15 минут) идёт, запросов в НП нет');
        await npTick(h, worker);
        ok(h.np.calls.length === c0 + 2 && h.np.calls[c0].page === failPage, 'через 15 минут продолжение с той же страницы ' + failPage);
        const ticks = await npLoad(h, worker, 60);
        ok(ticks > 0 && h.np.calls.length === pages + 1, 'загрузка дошла до конца; запросов ' + h.np.calls.length + ' = страницы + 1 повтор');
        const r = await npGet(h, worker, '/np/warehouses?city=' + KYIV);
        ok(r.j.ok && r.j.list.length === data.truth.get(KYIV).size, 'после паузы данные полные');
      }
      {
        const h = npHarness({}, data);
        h.np.hook = ({ n }) => (n === 4 ? { status: 429, body: 'Too Many Requests' } : undefined);
        let t = 0;
        while (h.np.calls.length < 4 && t++ < 20) await npTick(h, worker);
        const st = npStateOf(h);
        ok(st.le.k === 'limit' && st.k === 2 && h.np.calls[3].page === 4, 'HTTP 429: первая страница запуска сохранена (кусков 2), курсор на странице 4');
        await npTick(h, worker); await npTick(h, worker); await npTick(h, worker);
        ok(h.np.calls[4].page === 4, 'после паузы страница 4 запрошена снова');
        ok((await npLoad(h, worker, 60)) > 0, '429: загрузка доходит до конца');
      }
      {
        const h = npHarness({}, data);
        h.np.hook = ({ n }) => (n === 7 ? { body: JSON.stringify({ success: true, data: [], errors: [], info: { totalCount: N } }) } : undefined);
        let t = 0;
        while (h.np.calls.length < 7 && t++ < 20) await npTick(h, worker);
        const st = npStateOf(h);
        ok(st.le.k === 'empty' && st.pu > h.w.now && st.pg === h.np.calls[6].page, 'пустой ответ без ошибки на середине = отказ: пауза, курсор не сдвинут, конец не засчитан');
        ok((await npLoad(h, worker, 60)) > 0, 'после паузы загрузка доходит до конца');
        const r = await npGet(h, worker, '/np/warehouses?city=' + KYIV);
        ok(r.j.ok && r.j.list.length === data.truth.get(KYIV).size, 'данные полные, хотя НП один раз промолчал');
      }
      {
        const h = npHarness({}, data);
        h.np.hook = ({ n }) => (n === 3 || n === 4 ? LIMIT : undefined);
        let t = 0;
        while (h.np.calls.length < 3 && t++ < 20) await npTick(h, worker);
        for (let i = 0; i < 3; i++) await npTick(h, worker);
        const st = npStateOf(h);
        ok(st.lim === 2 && st.pu - h.w.now >= 24 * 60000 && st.pu - h.w.now <= 30 * 60000, 'второй лимит подряд: пауза 30 минут');
        const c0 = h.np.calls.length;
        for (let i = 0; i < 5; i++) await npTick(h, worker);
        ok(h.np.calls.length === c0, '30 минут без запросов');
      }
      {
        const h = npHarness({}, data);
        h.np.hook = ({ n }) => (n === 1 ? { body: JSON.stringify({ success: false, errors: ['API key expired'], errorCodes: ['20000200068'] }) } : undefined);
        await npTick(h, worker);
        let st = npStateOf(h);
        ok(st.le.k === 'api' && st.pu - h.w.now > 50 * 60000, 'ошибка API (не лимит): пауза около часа');
        const h2 = npHarness({}, data);
        h2.np.hook = ({ n }) => (n === 1 ? 'throw' : undefined);
        await npTick(h2, worker);
        st = npStateOf(h2);
        ok(st.le.k === 'net' && st.pu - h2.w.now <= 10 * 60000 && st.k === 0, 'обрыв сети: пауза 10 минут, ничего не записано кроме состояния');
        ok(!h.w.logs.concat(h2.w.logs).some((l) => l.includes(NPKEY)), 'при ошибках ключ в логах не появился');
      }
    });

    await run('НП: новое поколение не публикуется при сбое, старое работает', async (worker) => {
      {
        const h = npHarness({}, data);
        await npLoad(h, worker, 80);
        const m1 = h.kv.m.get('np:meta');
        const calls0 = h.np.n;
        h.np.hook = ({ n }) => (n > calls0 + 4 ? { body: JSON.stringify({ success: false, errors: ['Internal error'], errorCodes: ['1'] }) } : undefined);
        h.w.now += 25 * 3600000;
        for (let i = 0; i < 40; i++) await npTick(h, worker);
        ok(h.np.n > calls0, 'через сутки началась новая загрузка');
        ok(h.kv.m.get('np:meta') === m1, 'новая загрузка не завершена: указатель поколения не изменился');
        const r = await npGet(h, worker, '/np/warehouses?city=' + KYIV);
        ok(r.j.ok && r.j.list.length === data.truth.get(KYIV).size, 'старое поколение продолжает отвечать');
        const s = (await npGet(h, worker, '/np/status')).j;
        ok(s.published && s.published.generation === JSON.parse(m1).g && s.loading.lastProblem.kind === 'api', '/np/status: поколение прежнее, виден сбой');
      }
      {
        const h = npHarness({}, data);
        await npLoad(h, worker, 80);
        const m1 = h.kv.m.get('np:meta');
        h.np.hook = ({ page }) => (page === 8 ? { body: JSON.stringify({ success: true, data: data.ds.slice(7 * 150, 7 * 150 + 20), errors: [], info: { totalCount: N } }) } : undefined);
        h.w.now += 25 * 3600000;
        for (let i = 0; i < 40; i++) await npTick(h, worker);
        const st = npStateOf(h);
        ok(h.kv.m.get('np:meta') === m1 && st.le && st.le.k === 'incomplete', 'обрезанный справочник не опубликован (incomplete), указатель прежний');
        const c0 = h.np.n;
        for (let i = 0; i < 10; i++) await npTick(h, worker);
        ok(h.np.n === c0, 'после неудачи повтор не раньше чем через 6 часов');
      }
      {
        const h = npHarness({}, data);
        await npLoad(h, worker, 80);
        const m1 = h.kv.m.get('np:meta');
        h.np.ds = data.ds.slice(0, 1200); h.np.cache.clear();
        h.w.now += 25 * 3600000;
        for (let i = 0; i < 30; i++) await npTick(h, worker);
        ok(h.kv.m.get('np:meta') === m1 && npStateOf(h).le.k === 'incomplete', 'справочник вдвое меньше прежнего не публикуется');
      }
      {
        const h = npHarness({}, data);
        await npLoad(h, worker, 80);
        const g1 = npMetaOf(h).g;
        h.w.now += 25 * 3600000;
        const t = await npLoad(h, worker, 80);
        ok(t > 0 && npMetaOf(h).g !== g1, 'через сутки справочник обновился, поколение новое');
        ok(h.kv.m.has('np:g:' + g1 + ':c'), 'ключи старого поколения не удаляются (удаление тоже запись); живут по TTL');
        const writesDay2 = npStateOf(h).wd.n;
        ok(writesDay2 <= 120 && writesDay2 > 0, 'записей конвейера за вторые сутки: ' + writesDay2);
      }
    });

    await run('НП: нет ключа / нет KV / устарело / битые данные', async (worker) => {
      {
        const kv = makeKV();
        const w = makeEnv({ PAMIR_KV: kv });
        w.now += 300000;
        await worker.scheduled({}, w.env, w.ctx); await w.flush();
        ok(kv.gets.length === 0 && kv.puts.length === 0, 'нет NP_API_KEY: cron ничего не читает и не пишет в KV');
        const r = await worker.fetch(req('GET', '/np/cities?q=%D0%BA%D0%B8%D0%B5%D0%B2'), w.env, w.ctx);
        ok((await r.json()).error === 'nodata' && r.headers.get('Access-Control-Allow-Origin') === '*' && r.headers.get('Cache-Control') === 'no-store', 'нет ключа: /np/cities -> nodata с CORS и no-store');
        const st = await (await worker.fetch(req('GET', '/np/status'), w.env, w.ctx)).json();
        ok(st.ok === true && st.key === false && st.kv === true, '/np/status: ключ не задан');
      }
      {
        const w = makeEnv({ NP_API_KEY: NPKEY });
        const calls = [];
        const inner = globalThis.fetch;
        globalThis.fetch = async (u, o) => { if (String(u) === NP_URL) { calls.push(1); } return inner(u, o); };
        w.now += 300000;
        await worker.scheduled({}, w.env, w.ctx); await w.flush();
        ok(calls.length === 0, 'нет KV: cron не ходит в НП и не падает');
        let r = await worker.fetch(req('GET', '/np/warehouses?city=' + KYIV), w.env, w.ctx);
        ok((await r.json()).error === 'nodata', 'нет KV: /np/warehouses -> nodata');
        r = await worker.fetch(req('GET', '/np/status'), w.env, w.ctx);
        const j = await r.json();
        ok(j.kv === false && j.key === true && !JSON.stringify(j).includes(NPKEY), '/np/status без KV: ключ как признак, значение не показывается');
      }
      {
        const h = npHarness({}, data);
        await npLoad(h, worker, 80);
        let r = await npGet(h, worker, '/np/cities?q=%D0%BA%D0%B8%D0%B5%D0%B2');
        ok(r.j.ok === true && r.j.list.length > 0, 'свежий справочник отвечает');
        const wk = await loadWorker();
        h.w.now += 8 * 24 * 3600000;
        r = await npGet(h, wk, '/np/cities?q=%D0%BA%D0%B8%D0%B5%D0%B2');
        ok(r.j.error === 'nodata', 'справочник старше 7 суток -> nodata');
        r = await npGet(h, wk, '/np/warehouses?city=' + KYIV);
        ok(r.j.error === 'nodata', 'отделения: старше 7 суток -> nodata');
        const s = (await npGet(h, wk, '/np/status')).j;
        ok(s.published && s.published.fresh === false, '/np/status: fresh=false');
        const h2 = npHarness({}, data);
        await npLoad(h2, worker, 80);
        const m = npMetaOf(h2);
        h2.kv.m.delete('np:g:' + m.g + ':' + refBucket(KYIV));
        const wk2 = await loadWorker();
        r = await npGet(h2, wk2, '/np/warehouses?city=' + KYIV);
        ok(r.j.error === 'nodata', 'корзина пропала -> nodata, не пустой список');
        h2.kv.m.delete('np:g:' + m.g + ':c');
        r = await npGet(h2, wk2, '/np/cities?q=%D0%BA%D0%B8%D0%B5%D0%B2');
        ok(r.j.error === 'nodata', 'индекс городов пропал -> nodata');
      }
      {
        const kv = makeKV();
        const g = kv.get.bind(kv), p = kv.put.bind(kv);
        kv.get = async (k, t) => { if (String(k).indexOf('np:') === 0) throw new Error('kv down'); return g(k, t); };
        kv.put = async (k, v, o) => { if (String(k).indexOf('np:') === 0) throw new Error('kv down'); return p(k, v, o); };
        const w = makeEnv({ PAMIR_KV: kv, NP_API_KEY: NPKEY, BOT_TOKEN: TOKEN, ADMIN_CHAT_IDS: '111' });
        w.gas.ping = () => ({ status: 500, body: '' });
        let thrown = false;
        for (let i = 0; i < 3; i++) { w.now += 300000; try { await worker.scheduled({}, w.env, w.ctx); await w.flush(); } catch (e) { thrown = true; } }
        ok(!thrown, 'KV с ошибками для np:*: cron не падает');
        ok(w.sent.length === 1 && w.sent[0].body.text === 'Магазин не відповідає', 'слежение «Магазин не відповідає» работает рядом с конвейером');
        ok(!w.logs.some((l) => l.includes(NPKEY) || l.includes(TOKEN)), 'в логах нет ключа НП и токена');
      }
    });

    await run('НП: слежение и /catalog как раньше, пока идёт загрузка', async (worker) => {
      const h = npHarness({ BOT_TOKEN: TOKEN, ADMIN_CHAT_IDS: '111' }, data);
      const r0 = await worker.fetch(req('GET', '/catalog'), h.w.env, h.w.ctx);
      ok(r0.status === 200 && JSON.parse(await r0.text()).ok === true, '/catalog отвечает');
      let catOk = true;
      for (let i = 0; i < 12; i++) {
        await npTick(h, worker);
        const r = await worker.fetch(req('GET', '/catalog'), h.w.env, h.w.ctx);
        if (r.status !== 200) catOk = false;
      }
      ok(catOk, '/catalog отвечает на каждом шаге загрузки');
      const cp = h.kv.puts.filter((k) => k === 'catalog').length;
      ok(cp <= 3, 'записей каталога в KV за время загрузки: ' + cp + ' (не больше 3, как раньше)');
      ok(h.kv.puts.filter((k) => k === 'monitor-state').length <= 1, 'слежение при живом Apps Script пишет состояние не чаще раза');
      h.w.gas.ping = () => ({ status: 500, body: '' });
      await npTick(h, worker); await npTick(h, worker);
      ok(h.w.sent.length === 1 && h.w.sent[0].body.text === 'Магазин не відповідає', 'сбой Apps Script во время загрузки: сообщение админам ушло');
      ok(!h.w.logs.some((l) => l.includes(NPKEY) || l.includes(TOKEN)), 'в логах нет ключа НП и токена');
    });

    await run('НП: /np/status без секретов', async (worker) => {
      const h = npHarness({ BOT_TOKEN: TOKEN, ADMIN_CHAT_IDS: '111' }, data);
      await npTick(h, worker); await npTick(h, worker);
      let s = await npGet(h, worker, '/np/status');
      const j = s.j;
      ok(j.ok && j.key === true && j.kv === true && j.published === null && j.loading.stage === 'fetch' && j.loading.percent > 0 && j.loading.percent < 80 && j.loading.page === 5, '/np/status в процессе загрузки: стадия fetch, процент ' + j.loading.percent + ', страница 5');
      ok(s.r.headers.get('Cache-Control') === 'no-store' && s.r.headers.get('Access-Control-Allow-Origin') === '*', '/np/status: no-store, CORS');
      await npLoad(h, worker, 80);
      s = await npGet(h, worker, '/np/status');
      ok(s.j.published.cities === data.truth.size && s.j.published.warehouses === uniq && s.j.published.fresh === true && s.j.loading.stage === 'idle', '/np/status после загрузки: ' + s.j.published.cities + ' городов, ' + s.j.published.warehouses + ' отделений, покой');
      const all = JSON.stringify(s.j);
      ok(![NPKEY, SECRET, TOKEN, GAS].some((x) => all.includes(x)), '/np/status не содержит секретов и адресов');
    });
  } finally {
    globalThis.setTimeout = realSetTimeout;
  }
}

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

    // нет хорошего ответа вообще: пауза холодным запросам не мешает (каждый делает попытку + 1 повтор)
    const w2 = makeEnv();
    const worker2 = await loadWorker();
    w2.gas.catalog = () => ({ status: 200, body: 'oops' });
    let r = await worker2.fetch(req('GET', '/catalog'), w2.env, w2.ctx);
    ok(r.status === 502 && w2.gasCalls.length === 2, 'первый сбой -> 502 (попытка + 1 повтор)');
    w2.now += 100;
    w2.gas.catalog = () => ({ status: 200, body: w2.goodCatalog(5) });
    r = await worker2.fetch(req('GET', '/catalog'), w2.env, w2.ctx);
    ok(r.status === 200 && w2.gasCalls.length === 3, 'в паузу холодный запрос всё равно идёт в Apps Script и получает каталог');

    // другой изолят с пустым кэшем тоже пробует (пауза в Cache API не блокирует холодных)
    const w3 = makeEnv();
    const wa = await loadWorker(), wb = await loadWorker();
    w3.gas.catalog = () => ({ status: 200, body: 'oops' });
    await wa.fetch(req('GET', '/catalog'), w3.env, w3.ctx);
    w3.gas.catalog = () => ({ status: 200, body: w3.goodCatalog(1) });
    r = await wb.fetch(req('GET', '/catalog'), w3.env, w3.ctx);
    ok(r.status === 200, 'второй изолят при паузе в Cache API без каталога — идёт в Apps Script');

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

  await run('холодный старт: повтор, single-flight, плохие ответы', async (worker) => {
    const BADS = {
      'HTML Google': { status: 200, body: '<!DOCTYPE html><html><body>Error</body></html>' },
      '500': { status: 500, body: 'Internal' },
      'пустое тело': { status: 200, body: '' },
      'обрезанный JSON': { status: 200, body: '{"ok":true,"products":[{"id":"p1"' },
      'ok:false': { status: 200, body: JSON.stringify({ ok: false, error: 'x' }) },
      'throw': 'throw',
    };
    // 1) холодный изолят: первый ответ плохой, второй хороший -> 200, ровно 2 обращения
    for (const k of Object.keys(BADS)) {
      const w = makeEnv(); const wk = await loadWorker();
      let n = 0;
      w.gas.catalog = () => (++n === 1 ? BADS[k] : { status: 200, body: w.goodCatalog(1) });
      const r = await wk.fetch(req('GET', '/catalog'), w.env, w.ctx);
      ok(r.status === 200 && JSON.parse(await r.text()).ok === true && w.gasCalls.length === 2, 'холодный: ' + k + ' -> повтор -> 200 (обращений ' + w.gasCalls.length + ')');
    }
    // 2) оба плохие: 502, не кэшируется, CORS и no-store, время мало
    for (const k of Object.keys(BADS)) {
      const w = makeEnv(); const wk = await loadWorker();
      w.gas.catalog = () => BADS[k];
      const t0 = process.hrtime.bigint();
      const r = await wk.fetch(req('GET', '/catalog'), w.env, w.ctx);
      const ms = Number(process.hrtime.bigint() - t0) / 1e6;
      await w.flush();
      ok(r.status === 502 && r.headers.get('Access-Control-Allow-Origin') === '*' && r.headers.get('Cache-Control') === 'no-store'
        && !r.headers.get('X-Pamir-Cache') && w.gasCalls.length === 2 && !w.cacheStore.has('https://pamir-cache.invalid/catalog'),
        'два плохих (' + k + ') -> 502 с CORS и no-store, в кэш не попало, ' + Math.round(ms) + ' мс');
      ok(ms < 2000, 'два быстрых сбоя: ответ быстрее 2 с (' + Math.round(ms) + ' мс)');
      const j = await r.json();
      ok(j.ok === false && !JSON.stringify(j).includes(GAS), '502: тело {ok:false}, без адреса Apps Script');
    }
    // 3) пауза холодных не блокирует: после сбоя сразу следующий запрос ходит в GAS
    {
      const w = makeEnv(); const wk = await loadWorker();
      w.gas.catalog = () => ({ status: 500, body: '' });
      await wk.fetch(req('GET', '/catalog'), w.env, w.ctx); await w.flush();
      const c = w.gasCalls.length;
      await wk.fetch(req('GET', '/catalog'), w.env, w.ctx); await w.flush();
      ok(w.gasCalls.length === c + 2, 'во время паузы холодный запрос делает попытку и повтор');
    }
    // 4) 10 одновременных холодных запросов делят один обмен
    {
      const w = makeEnv(); const wk = await loadWorker();
      let release; const gate = new Promise((res) => { release = res; });
      w.gas.catalog = async () => { await gate; return { status: 200, body: w.goodCatalog(1) }; };
      const ps = []; for (let i = 0; i < 10; i++) ps.push(wk.fetch(req('GET', '/catalog'), w.env, w.ctx));
      await new Promise((res) => setTimeout(res, 20));
      release();
      const rs = await Promise.all(ps);
      ok(rs.every((r) => r.status === 200) && w.gasCalls.length === 1, '10 одновременных холодных -> все 200, обращений к Apps Script: ' + w.gasCalls.length);
      // то же при плохом ответе: не больше 2 обращений (попытка + повтор)
      const w2 = makeEnv(); const wk2 = await loadWorker();
      w2.gas.catalog = () => ({ status: 500, body: '' });
      const rs2 = await Promise.all(Array.from({ length: 10 }, () => wk2.fetch(req('GET', '/catalog'), w2.env, w2.ctx)));
      ok(rs2.every((r) => r.status === 502) && w2.gasCalls.length <= 2, '10 одновременных при сбое -> 502, обращений: ' + w2.gasCalls.length + ' (<= 2)');
    }
    // 5) первая попытка была медленной (> 3 с) -> повтора нет, быстрый 502
    {
      const w = makeEnv(); const wk = await loadWorker();
      w.gas.catalog = () => { w.now += 5000; return { status: 500, body: '' }; };
      const r = await wk.fetch(req('GET', '/catalog'), w.env, w.ctx);
      ok(r.status === 502 && w.gasCalls.length === 1, 'медленный сбой (> 3 с): без повтора, 502');
    }
    // 6) Apps Script завис: ответ Worker не позже ~4,5 с, обмен дорабатывает в фоне
    {
      const w = makeEnv(); const wk = await loadWorker();
      let release; const gate = new Promise((res) => { release = res; });
      w.gas.catalog = async () => { await gate; return { status: 200, body: w.goodCatalog(9) }; };
      const t0 = process.hrtime.bigint();
      const r = await wk.fetch(req('GET', '/catalog'), w.env, w.ctx);
      const ms = Number(process.hrtime.bigint() - t0) / 1e6;
      ok(r.status === 502 && ms >= 4400 && ms < 5500, 'зависший Apps Script: 502 через ~4,5 с (' + Math.round(ms) + ' мс) < 6 с витрины');
      release(); await w.flush();
      const r2 = await wk.fetch(req('GET', '/catalog'), w.env, w.ctx);
      ok(r2.status === 200 && (await r2.text()) === w.goodCatalog(9) && w.gasCalls.length === 1, 'после зависания фоновый обмен наполнил кэш');
    }
    // 7) есть кэш, Apps Script отвечает любой дрянью -> STALE 200, плохое не кэшируется
    for (const k of Object.keys(BADS)) {
      const w = makeEnv(); const wk = await loadWorker();
      await wk.fetch(req('GET', '/catalog'), w.env, w.ctx);
      const good = w.goodCatalog(1);
      w.gas.catalog = () => BADS[k];
      w.now += 61000;
      const r = await wk.fetch(req('GET', '/catalog'), w.env, w.ctx);
      await w.flush();
      const r2 = await wk.fetch(req('GET', '/catalog'), w.env, w.ctx);
      ok(r.status === 200 && (await r.text()) === good && r.headers.get('X-Pamir-Cache') === 'STALE' && (await r2.text()) === good, 'кэш + ' + k + ' -> STALE 200, плохое не сохранено');
    }
    // 8) KV: холодные сбои не пишут в KV
    {
      const kv = makeKV(); const w = makeEnv({ PAMIR_KV: kv }); const wk = await loadWorker();
      w.gas.catalog = () => ({ status: 500, body: '' });
      for (let i = 0; i < 10; i++) await wk.fetch(req('GET', '/catalog'), w.env, w.ctx);
      await w.flush();
      ok(kv.puts.length === 0, 'сбои Apps Script не пишут в KV');
    }
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

  await run('копия старше 5 минут: сначала пробуем обновить', async () => {
    const MIN = 60000;
    const hdr = (r) => r.headers.get('X-Pamir-Cache');
    const prep = async (extra) => {
      const w = makeEnv(extra); const wk = await loadWorker();
      await wk.fetch(req('GET', '/catalog'), w.env, w.ctx);
      return { w, wk, old: w.goodCatalog(1) };
    };
    // 2 минуты: отдано сразу, обновление в фоне
    {
      const { w, wk, old } = await prep();
      w.gas.catalog = () => ({ status: 200, body: w.goodCatalog(2) });
      w.now += 2 * MIN;
      const r = await wk.fetch(req('GET', '/catalog'), w.env, w.ctx);
      ok((await r.text()) === old && hdr(r) === 'STALE', 'копия 2 минуты: отдана сразу (STALE)');
      await w.flush();
      ok(w.gasCalls.length === 2, 'копия 2 минуты: обновление ушло в фон');
    }
    // 10 минут, Apps Script отвечает за 1 с: новый каталог
    {
      const { w, wk } = await prep();
      w.gas.catalog = async () => { await new Promise((res) => setTimeout(res, 1000)); return { status: 200, body: w.goodCatalog(2) }; };
      w.now += 10 * MIN;
      const t0 = Date.now(); const rt0 = process.hrtime.bigint();
      const r = await wk.fetch(req('GET', '/catalog'), w.env, w.ctx);
      const ms = Number(process.hrtime.bigint() - rt0) / 1e6;
      ok((await r.text()) === w.goodCatalog(2) && hdr(r) === 'REFRESHED' && ms < 3000, 'копия 10 минут + Apps Script за 1 с: отдан НОВЫЙ каталог (' + Math.round(ms) + ' мс)');
      void t0;
    }
    // 10 минут, Apps Script молчит: через <= 4,5 с старая копия, не 502
    {
      const { w, wk, old } = await prep();
      let release; const gate = new Promise((res) => { release = res; });
      w.gas.catalog = async () => { await gate; return { status: 200, body: w.goodCatalog(2) }; };
      w.now += 10 * MIN;
      const rt0 = process.hrtime.bigint();
      const r = await wk.fetch(req('GET', '/catalog'), w.env, w.ctx);
      const ms = Number(process.hrtime.bigint() - rt0) / 1e6;
      ok(r.status === 200 && (await r.text()) === old && hdr(r) === 'EXPIRED' && ms >= 4400 && ms < 5500, 'копия 10 минут + Apps Script молчит: через ~4,5 с старая копия, не 502 (' + Math.round(ms) + ' мс)');
      // пока зависший обмен идёт, следующие запросы не ждут заново
      const rt1 = process.hrtime.bigint();
      const r2 = await wk.fetch(req('GET', '/catalog'), w.env, w.ctx);
      ok((await r2.text()) === old && Number(process.hrtime.bigint() - rt1) / 1e6 < 500 && w.gasCalls.length === 2, 'следующий запрос при зависшем обмене: сразу старая копия, нового обращения нет');
      release(); await w.flush();
      const r3 = await wk.fetch(req('GET', '/catalog'), w.env, w.ctx);
      ok((await r3.text()) === w.goodCatalog(2), 'фоновый обмен довёл обновление: следующий запрос получает новый каталог');
    }
    // плохие ответы: старая копия
    const BADS = {
      'HTML': { status: 200, body: '<!DOCTYPE html><html><body>Error</body></html>' },
      '500': { status: 500, body: 'Internal' },
      'пустое': { status: 200, body: '' },
      'обрезанный JSON': { status: 200, body: '{"ok":true,"products":[{"id":"p1"' },
      'ok:false': { status: 200, body: JSON.stringify({ ok: false }) },
    };
    for (const k of Object.keys(BADS)) {
      const { w, wk, old } = await prep();
      w.gas.catalog = () => BADS[k];
      w.now += 10 * MIN;
      const r = await wk.fetch(req('GET', '/catalog'), w.env, w.ctx);
      await w.flush();
      ok(r.status === 200 && (await r.text()) === old && hdr(r) === 'EXPIRED' && w.gasCalls.length === 3, 'копия 10 минут + ' + k + ': старая копия (попытка и повтор)');
    }
    // пауза: после сбоя 30 с без попыток, потом снова пробуем
    {
      const { w, wk, old } = await prep();
      w.gas.catalog = () => ({ status: 500, body: '' });
      w.now += 10 * MIN;
      await wk.fetch(req('GET', '/catalog'), w.env, w.ctx); await w.flush();
      const base = w.gasCalls.length;
      w.now += 10000;
      const r = await wk.fetch(req('GET', '/catalog'), w.env, w.ctx);
      ok((await r.text()) === old && w.gasCalls.length === base, 'в паузу копия старше 5 минут отдаётся сразу, без обращения');
      w.gas.catalog = () => ({ status: 200, body: w.goodCatalog(4) });
      w.now += 31000;
      const r2 = await wk.fetch(req('GET', '/catalog'), w.env, w.ctx);
      ok((await r2.text()) === w.goodCatalog(4) && hdr(r2) === 'REFRESHED', 'через 30 с пауза кончилась: новый каталог');
    }
    // 10 одновременных запросов при старой копии: одно обращение
    {
      const { w, wk } = await prep();
      let release; const gate = new Promise((res) => { release = res; });
      w.gas.catalog = async () => { await gate; return { status: 200, body: w.goodCatalog(2) }; };
      w.now += 10 * MIN;
      const ps = Array.from({ length: 10 }, () => wk.fetch(req('GET', '/catalog'), w.env, w.ctx));
      await new Promise((res) => setTimeout(res, 20));
      release();
      const rs = await Promise.all(ps);
      const bodies = await Promise.all(rs.map((r) => r.text()));
      ok(rs.every((r) => r.status === 200) && bodies.every((b) => b === w.goodCatalog(2)) && w.gasCalls.length === 2, '10 одновременных при старой копии: одно обращение к Apps Script (всего ' + w.gasCalls.length + ' с первым)');
    }
    // записи KV за сутки: запрос каждые 10 минут, каталог не меняется
    {
      const kv = makeKV();
      const { w, wk } = await prep({ PAMIR_KV: kv });
      let n = 0;
      w.gas.catalog = () => ({ status: 200, body: JSON.stringify({ ok: true, updated: 'u' + (++n), products: [{ id: 'p1' }] }) });
      const b = kv.puts.length;
      for (let i = 0; i < 144; i++) { w.now += 10 * MIN; await wk.fetch(req('GET', '/catalog'), w.env, w.ctx); await w.flush(); }
      ok(kv.puts.length - b <= 3, 'сутки при старой копии: записей KV ' + (kv.puts.length - b) + ' (<= 3)');
    }
    // Expose-Headers во всех видах ответа /catalog
    {
      const EXP = (r) => r.headers.get('Access-Control-Expose-Headers') === 'X-Pamir-Cache';
      const { w, wk } = await prep();
      const seen = {};
      let r = await wk.fetch(req('GET', '/catalog'), w.env, w.ctx); seen[hdr(r)] = EXP(r);
      w.now += 2 * MIN;
      r = await wk.fetch(req('GET', '/catalog'), w.env, w.ctx); await w.flush(); seen[hdr(r)] = EXP(r);
      w.now += 10 * MIN;
      r = await wk.fetch(req('GET', '/catalog'), w.env, w.ctx); seen[hdr(r)] = EXP(r);
      w.gas.catalog = () => ({ status: 500, body: '' });
      w.now += 10 * MIN;
      r = await wk.fetch(req('GET', '/catalog'), w.env, w.ctx); seen[hdr(r)] = EXP(r);
      const w2 = makeEnv(); const wk2 = await loadWorker();
      r = await wk2.fetch(req('GET', '/catalog'), w2.env, w2.ctx); seen[hdr(r)] = EXP(r);
      ok(['HIT', 'STALE', 'REFRESHED', 'EXPIRED', 'MISS'].every((k) => seen[k] === true), 'Expose-Headers: X-Pamir-Cache в ответах ' + Object.keys(seen).join('/'));
      const w3 = makeEnv(); const wk3 = await loadWorker();
      w3.gas.catalog = () => ({ status: 500, body: '' });
      r = await wk3.fetch(req('GET', '/catalog'), w3.env, w3.ctx);
      ok(r.status === 502 && EXP(r), 'Expose-Headers и на 502');
    }
    // purge: следующий запрос получает новый каталог
    {
      const { w, wk } = await prep();
      w.gas.catalog = () => ({ status: 200, body: w.goodCatalog(8) });
      w.now += 10 * MIN;
      await wk.fetch(req('POST', '/purge', { 'X-Pamir-Key': SECRET }), w.env, w.ctx);
      await w.flush();
      const r = await wk.fetch(req('GET', '/catalog'), w.env, w.ctx);
      ok((await r.text()) === w.goodCatalog(8) && hdr(r) === 'HIT', 'после /purge следующий запрос получает новый каталог');
    }
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

  await run('лимит записей KV: сутки работы', async (worker) => {
    const cat = (upd, id) => JSON.stringify({ ok: true, updated: upd, products: [{ id }] });
    // 24 ч, запрос каждую минуту, каталог не меняется (меняется только updated), cron раз в 5 мин
    const kv = makeKV();
    const w = makeEnv({ PAMIR_KV: kv, BOT_TOKEN: TOKEN, ADMIN_CHAT_IDS: '111' });
    let n = 0;
    w.gas.catalog = () => ({ status: 200, body: cat('t' + (++n), 'a') });
    for (let i = 0; i < 1440; i++) {
      w.now += 60000;
      await worker.fetch(req('GET', '/catalog'), w.env, w.ctx);
      await w.flush();
      if (i % 5 === 0) { await worker.scheduled({}, w.env, w.ctx); await w.flush(); }
    }
    const catPuts = kv.puts.filter((k) => k === 'catalog').length;
    ok(catPuts <= 3, 'сутки без изменений каталога: записей каталога ' + catPuts + ' (<= 3)');
    ok(kv.puts.length <= 5, 'сутки обычной работы: всего записей KV ' + kv.puts.length + ' (<= 5)');
    // несколько холодных изолятов подряд не множат записи
    const b0 = kv.puts.length;
    for (let i = 0; i < 5; i++) { const wk = await loadWorker(); w.now += 61000; await wk.fetch(req('GET', '/catalog'), w.env, w.ctx); await w.flush(); }
    ok(kv.puts.length <= b0 + 1, '5 холодных изолятов с тем же каталогом: не больше 1 записи (плановое обновление раз в 12 ч), было ' + (kv.puts.length - b0));
    // изменение каталога — ровно одна запись
    w.gas.catalog = () => ({ status: 200, body: cat('t', 'b') });
    w.now += 61000;
    const b1 = kv.puts.length;
    await worker.fetch(req('GET', '/catalog'), w.env, w.ctx); await w.flush();
    ok(kv.puts.length === b1 + 1, 'изменение каталога: ровно 1 запись');
    // два изолята заметили изменение одновременно — всё равно одна запись
    const wA = await loadWorker(), wB = await loadWorker();
    w.gas.catalog = () => ({ status: 200, body: cat('t', 'c') });
    w.now += 61000;
    const b2 = kv.puts.length;
    await Promise.all([wA.fetch(req('GET', '/catalog'), w.env, w.ctx), wB.fetch(req('GET', '/catalog'), w.env, w.ctx)]);
    await w.flush();
    ok(kv.puts.length <= b2 + 2 && kv.puts.length >= b2 + 1, 'два изолята, одно изменение: записей ' + (kv.puts.length - b2) + ' (<= 2)');
    // purge без изменений — 0 записей
    const b3 = kv.puts.length;
    w.now += 61000;
    await worker.fetch(req('POST', '/purge', { 'X-Pamir-Key': SECRET }), w.env, w.ctx); await w.flush();
    await worker.fetch(req('GET', '/catalog'), w.env, w.ctx);
    ok(kv.puts.length <= b3 + 1, 'purge: записей ' + (kv.puts.length - b3) + ' (<= 1)');
    // purge при изменении — 1 запись
    const b4 = kv.puts.length;
    w.gas.catalog = () => ({ status: 200, body: cat('t', 'd') });
    w.now += 61000;
    await worker.fetch(req('POST', '/purge', { 'X-Pamir-Key': SECRET }), w.env, w.ctx); await w.flush();
    ok(kv.puts.length === b4 + 1, 'purge с изменением: ровно 1 запись');
    // метаданные хранят хэш, в них нет тела
    const meta = kv.meta ? kv.meta.get('catalog') : null;
    ok(!meta || (typeof meta.h === 'string' && meta.h.length === 64), 'хэш SHA-256 лежит в metadata вместе со значением');
  });

  await run('лимит записей KV: Cache API снимает чтения KV', async (worker) => {
    const kv = makeKV();
    let reads = 0; const g = kv.getWithMetadata; kv.getWithMetadata = async (...a) => { reads++; return g(...a); };
    const w = makeEnv({ PAMIR_KV: kv });
    await worker.fetch(req('GET', '/catalog'), w.env, w.ctx);
    const r0 = reads;
    for (let i = 0; i < 20; i++) { const wk = await loadWorker(); await wk.fetch(req('GET', '/catalog'), w.env, w.ctx); }
    ok(reads === r0, '20 холодных изолятов при рабочем Cache API: 0 чтений KV');
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

  await npTests();

  Date.now = realNow;
  globalThis.fetch = realFetch;
  console.log = realLog;
  out('\nИтого: ' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
}

main();
