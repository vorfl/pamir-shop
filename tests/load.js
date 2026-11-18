// Нагрузка на стенде: 300 открытий магазина (каталог + события open/view) и 30 заказов за 2 минуты.
// Запуск: node tests/load.js            (настоящий темп: 2 минуты на каждый сценарий)
//         node tests/load.js --fast     (без пауз; для обычного прогона и проверки)
//         node tests/load.js --fast --opens=100 --orders=10 --seconds=60
//
// ЧЕСТНО: стенд (tests/gas_mock.js) — один поток Node без настоящей конкуренции Google. Мок LockService не ждёт по-настоящему:
// «занята N мс» — условное число, которое запрос ждал бы блокировку. Времена вызовов ниже — это время работы кода на стенде
// (без сети и без задержек Google), они показывают только относительную стоимость, а не скорость на настоящем Apps Script.
// Настоящая проверка — только на реальном Apps Script после выпуска.
const path = require('path');
const { createGas, seed } = require('./gas_mock');
const CODE = path.join(__dirname, '..', 'apps-script', 'Code.gs');

const args = {};
process.argv.slice(2).forEach(a => { const m = /^--([\w-]+)(?:=(.*))?$/.exec(a); if (m) args[m[1]] = m[2] === undefined ? true : m[2]; });
const FAST = !!args.fast;
const OPENS = Number(args.opens) || 300;
const ORDERS = Number(args.orders) || 30;
const SECONDS = Number(args.seconds) || 120;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const U = id => ({ id, first_name: 'Тест' + id, username: 'user' + id, language_code: 'uk' });
const now = () => Number(process.hrtime.bigint()) / 1e6;
const avg = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

async function scenario(title, opt) {
  const g = createGas(CODE, seed());
  if (opt.fast) g.call('menuFastOn');
  if (opt.busy) g.setLockBusy(opt.busy);
  const ordersBefore = g.sheets['Замовлення'].rows.length;
  // расписание: открытия и заказы вперемешку равномерно на SECONDS
  const total = OPENS + ORDERS;
  const plan = [];
  for (let i = 0; i < total; i++) plan.push({ at: i * SECONDS * 1000 / total, kind: i % Math.max(1, Math.round(total / ORDERS)) === 3 && plan.filter(p => p.kind === 'order').length < ORDERS ? 'order' : 'open' });
  while (plan.filter(p => p.kind === 'order').length < ORDERS) { const p = plan.find(x => x.kind === 'open'); p.kind = 'order'; }
  while (plan.filter(p => p.kind === 'open').length < OPENS) plan.push({ at: SECONDS * 1000, kind: 'open' });
  const tOpen = [], tOrder = [], waitOpen = [], waitOrder = [];
  const numbers = [];
  let okOrders = 0, failOrders = 0, retries = 0, retryDup = 0, openFail = 0, uid = 1000, ordUid = 5000, nextFlush = 60000, flushes = 0;
  const started = Date.now();
  for (const p of plan) {
    if (!FAST) { const wait = p.at - (Date.now() - started); if (wait > 0) await sleep(wait); }
    while (p.at >= nextFlush) { g.call('flushJob'); flushes++; nextFlush += 60000; }
    const w0 = g.lockWaited.script;
    const t0 = now();
    if (p.kind === 'open') {
      const u = U(uid++);
      const cat = g.get({ action: 'catalog' });
      const r = g.post({ action: 'ev', initData: g.initData(u), sid: 's' + u.id, events: [{ e: 'open', t: Date.now() }, { e: 'view', id: 'DRY-039', t: Date.now() }] });
      if (!cat.ok || !r.ok) openFail++;
      tOpen.push(now() - t0); waitOpen.push(g.lockWaited.script - w0);
    } else {
      const u = U(ordUid++);
      const body = { action: 'order', initData: g.initData(u), items: [{ id: 'NUT-007', g: 0, q: 1 }], total: 85, name: 'Олена', phone: '+380501234567', delivery: 'pickup', pay: 'cash', lang: 'ua', rid: 'load-' + u.id };
      const r = g.post(body);
      if (r.ok) { okOrders++; numbers.push(r.number); } else failOrders++;
      tOrder.push(now() - t0); waitOrder.push(g.lockWaited.script - w0);
      if (okOrders % 5 === 0 && r.ok) { // каждый пятый «не дождался ответа» и нажал ещё раз с тем же ключом
        retries++;
        const again = g.post(body);
        if (!again.ok || again.number !== r.number) retryDup++;
      }
    }
  }
  if (opt.busy) g.setLockBusy(0);
  const evBefore = (g.sheets['Події'] ? g.sheets['Події'].rows.length - 1 : 0);
  const clBefore = (g.sheets['Клієнти'] ? g.sheets['Клієнти'].rows.length - 1 : 0);
  let guard = 0;
  do { g.call('flushJob'); flushes++; } while (opt.fast && (Number(g.cache.fb_n) || 0) > (Number(g.cache.fb_t) || 0) && ++guard < 20);
  const evAfter = (g.sheets['Події'] ? g.sheets['Події'].rows.length - 1 : 0);
  const clAfter = (g.sheets['Клієнти'] ? g.sheets['Клієнти'].rows.length - 1 : 0);
  const orderRows = g.sheets['Замовлення'].rows.length - ordersBefore;
  const uniq = new Set(numbers).size;
  const wantEvents = OPENS * 2;
  const scriptLocks = g.lockLog.filter(l => l.kind === 'script').length;
  const docLocks = g.lockLog.filter(l => l.kind === 'doc').length;
  const res = {
    title, okOrders, failOrders, orderRows, dupNumbers: numbers.length - uniq, retries, retryDup,
    events: evAfter, wantEvents, lostEvents: wantEvents - evAfter, clients: clAfter,
    beforeFlush: { events: evBefore, clients: clBefore }, openFail, scriptLocks, docLocks, flushes,
    openAvg: avg(tOpen), openMax: Math.max(0, ...tOpen), orderAvg: avg(tOrder), orderMax: Math.max(0, ...tOrder),
    waitOpenAvg: avg(waitOpen), waitOrderAvg: avg(waitOrder), lost: g.cache.fb_lost || '0'
  };
  return res;
}

// «300 посетителей по 6 пачек за 2 минуты»: посетители приходят равномерно за 120 с, первая пачка через 8 с, потом каждые 20 с.
// По одному событию на пачку (первая — open). Время виртуальное: flushJob запускается на границах виртуальных минут. Проверяем: потерь нет.
function burst(title, opt) {
  const g = createGas(CODE, seed());
  g.call('menuFastOn');
  if (opt.docNull) g.setDocLockNull(true);
  const V = 300, B = 6;
  const reqs = [];
  for (let i = 0; i < V; i++) for (let k = 0; k < B; k++) reqs.push({ at: (i * 120000 / V) + 8000 + k * 20000, uid: 20000 + i, k });
  reqs.sort((a, b) => a.at - b.at);
  let nextFlush = 60000, fail = 0, maxPending = 0;
  for (const r of reqs) {
    while (r.at >= nextFlush) { g.advance(60000); g.call('flushJob'); nextFlush += 60000; }
    const u = U(r.uid);
    const ev = r.k === 0 ? { e: 'open', t: Date.now() } : { e: 'view', id: 'DRY-039', t: Date.now() };
    const out = g.post({ action: 'ev', initData: g.initData(u), sid: 's' + r.uid, events: [ev] });
    if (!out.ok || out.n !== 1) fail++;
    maxPending = Math.max(maxPending, (Number(g.cache.fb_n) || 0) - (Number(g.cache.fb_t) || 0));
  }
  let guard = 0;
  do { g.advance(60000); g.call('flushJob'); } while (++guard < 5 && ((Number(g.cache.fb_n) || 0) > (Number(g.cache.fb_t) || 0)));
  const events = g.sheets['Події'] ? g.sheets['Події'].rows.length - 1 : 0;
  const clients = g.sheets['Клієнти'] ? g.sheets['Клієнти'].rows.length - 1 : 0;
  return { title, requests: reqs.length, events, clients, wantClients: V, fail, maxPending, lost: Number(g.cache.fb_lost || 0) };
}

function print(r) {
  const f = x => x.toFixed(2);
  console.log('\n== ' + r.title);
  console.log('  заказов принято: ' + r.okOrders + ' из ' + (r.okOrders + r.failOrders) + '; строк в листе: ' + r.orderRows + '; дублей номеров: ' + r.dupNumbers + '; повторов с тем же ключом: ' + r.retries + ', из них создали второй заказ: ' + r.retryDup);
  console.log('  открытий с ошибкой: ' + r.openFail + '; событий в листе после flushJob: ' + r.events + ' из ' + r.wantEvents + ' (потеряно ' + r.lostEvents + '); клиентов в листе: ' + r.clients + '; до flushJob было событий/клиентов: ' + r.beforeFlush.events + '/' + r.beforeFlush.clients);
  console.log('  время кода на стенде, мс: открытие среднее ' + f(r.openAvg) + ', худшее ' + f(r.openMax) + '; заказ среднее ' + f(r.orderAvg) + ', худшее ' + f(r.orderMax));
  console.log('  захватов блокировки скрипта: ' + r.scriptLocks + ', документа: ' + r.docLocks + '; запусков flushJob: ' + r.flushes + '; счётчик потерь буфера: ' + r.lost);
  console.log('  условное ожидание блокировки на запрос, мс: открытие ' + f(r.waitOpenAvg) + ', заказ ' + f(r.waitOrderAvg));
}

(async () => {
  console.log('Нагрузка: ' + OPENS + ' открытий и ' + ORDERS + ' заказов за ' + SECONDS + ' с' + (FAST ? ' (ускоренно, без пауз)' : ' (настоящий темп)'));
  console.log('ОГОВОРКА: стенд не воспроизводит настоящую конкуренцию Google, «ожидание» ниже условное (мок: блокировка занята N мс).');
  const results = [];
  results.push(await scenario('Как раньше (без быстрого режима)', { fast: false }));
  results.push(await scenario('Быстрый режим (буфер + flushJob раз в минуту)', { fast: true }));
  results.push(await scenario('Как раньше, блокировка скрипта занята 5 с', { fast: false, busy: 5000 }));
  results.push(await scenario('Быстрый режим, блокировка скрипта занята 5 с', { fast: true, busy: 5000 }));
  results.forEach(print);
  const bursts = [burst('300 посетителей по 6 пачек за 2 минуты (быстрый режим)', {}), burst('то же, DocumentLock = null', { docNull: true })];
  bursts.forEach(b => console.log('\n== ' + b.title + '\n  запросов: ' + b.requests + '; событий в листе: ' + b.events + ' из ' + b.requests + '; клиентов: ' + b.clients + ' из ' + b.wantClients + '; отказов в ответе: ' + b.fail + '; пик очереди: ' + b.maxPending + '; потеряно: ' + b.lost));
  const burstBad = bursts.filter(b => b.events !== b.requests || b.clients !== b.wantClients || b.fail || b.lost);
  const bad = results.filter(r => r.okOrders !== ORDERS || r.orderRows !== ORDERS + (r.retries ? 0 : 0) || r.dupNumbers || r.retryDup || r.lostEvents || r.openFail);
  const fastBusy = results[3], slowBusy = results[2];
  const gain = fastBusy.waitOpenAvg < slowBusy.waitOpenAvg;
  console.log('\nИтог: ' + (bad.length ? 'ЕСТЬ ПОТЕРИ ИЛИ ДУБЛИ в сценариях: ' + bad.map(b => b.title).join('; ') : 'заказы и события не потеряны, дублей нет') +
    '; при занятой блокировке открытие не ждёт в быстром режиме: ' + (gain ? 'да' : 'нет'));
  console.log('Пачки 300×6: ' + (burstBad.length ? 'ЕСТЬ ПОТЕРИ: ' + burstBad.map(b => b.title).join('; ') : 'потерь нет'));
  process.exit(bad.length || !gain || burstBad.length ? 1 : 0);
})();
