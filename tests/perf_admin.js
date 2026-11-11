// Замер админ-панели на стенде: сколько «медленных» обращений (таблица, свойства скрипта, кэш, блокировка, Telegram)
// делает сервер на одно нажатие. Настоящего времени стенд не знает — оно видно только в Apps Script → Executions.
//
// Запуск:  node tests/perf_admin.js                     — текущий Code.gs
//          node tests/perf_admin.js путь\к\старому.gs   — сравнение «до → после»
const path = require('path');
const { createGas, seed } = require('./gas_mock');
const NOW = path.join(__dirname, '..', 'apps-script', 'Code.gs');

// Примерная цена одного обращения в настоящем Apps Script, мс. Это оценка для сравнения «до/после», а не измерение.
const COST = { read: 120, write: 15, append: 150, flush: 100, prop: 40, cache: 30, lock: 50, tg: 350, tgBatch: 350 };
const KINDS = ['read', 'write', 'append', 'flush', 'prop', 'cache', 'lock', 'tg', 'tgBatch'];
const model = ops => KINDS.reduce((sum, k) => sum + (ops[k] || 0) * COST[k], 0);

const U = id => ({ id, first_name: 'Тест' + id, username: 'user' + id, language_code: 'uk' });

function stand(code) {
  const g = createGas(code, seed());
  const adm = (action, data) => g.post(Object.assign({ action, initData: g.initData(U(900)) }, data || {}));
  // как в настоящей таблице: есть листы «Точки», «Відгуки», «Кошики», «Налаштування», «Журнал»
  g.call('setupStage8');
  adm('admin.settingsSave', { values: Object.fromEntries(adm('admin.settings').fields.map(f => [f.k, f.v])) });
  // второй админ с уведомлениями: при смене статуса сообщение о заказе обновляется у обоих
  g.call('writeAdminRow_', { id: '901', name: 'Другий адмін', username: '', role: 'admin', perms: {}, notify: true, active: true, by: 'стенд' });
  const order = (delivery) => g.post({ action: 'order', initData: g.initData(U(42)), items: [{ id: 'NUT-007', g: 0, q: 1 }], total: 85, name: 'Олена',
    phone: '+380501234567', delivery, city: 'Київ', branch: '12', pay: 'cash', lang: 'ua', rid: 'r' + Math.random().toString(36).slice(2) }).number;
  return { g, adm, order };
}

/** Сценарии: что нажимает админ. prepare готовит данные (в замер не идёт), run — одно нажатие. */
const SCENARIOS = [
  ['Открыть «Замовлення»', null, s => s.adm('admin.orders')],
  ['Статус «Підтверджено» (самовывоз)', s => ({ num: s.order('pickup') }), (s, p) => s.adm('admin.status', { num: p.num, code: 'c' })],
  ['Статус «Відправлено» (Нова пошта)', s => ({ num: s.order('np') }), (s, p) => s.adm('admin.status', { num: p.num, code: 's' })],
  ['Статус «Виконано»', s => ({ num: s.order('pickup') }), (s, p) => s.adm('admin.status', { num: p.num, code: 'd' })],
  ['Открыть «Товари»', null, s => s.adm('admin.products')],
  ['Переключатель: товара нет', null, s => s.adm('admin.product', { id: 'NUT-002', patch: { stock: false } })],
  ['Переключатель: товар есть', s => { s.adm('admin.product', { id: 'NUT-002', patch: { stock: false } }); }, s => s.adm('admin.product', { id: 'NUT-002', patch: { stock: true } })],
  ['Сохранить товар (цена, описание, старая цена)', null, s => s.adm('admin.product', { id: 'NUT-002', patch: { price: 650, dUa: 'Новий опис', old: 700 } })],
  ['«Приховати з вітрини»', null, s => s.adm('admin.product', { id: 'NUT-002', patch: { hidden: true } })],
  ['Открыть «Категорії» (тот же запрос, что «Товари»)', null, s => s.adm('admin.products')],
  ['Открыть «Налаштування»', null, s => s.adm('admin.settings')],
  ['Сохранить настройки (2 поля)', s => ({ v: Object.fromEntries(s.adm('admin.settings').fields.map(f => [f.k, f.v])) }),
    (s, p) => s.adm('admin.settingsSave', { values: Object.assign(p.v, { min_order: '150', gift_from: '900', pay_cash: true, pay_card: true }) })],
  ['Открыть «Адміни»', null, s => s.adm('admin.admins')],
  ['Товар в архив', null, s => s.adm('admin.archive', { id: 'NUT-002' })],
  ['Восстановить из архива', s => { s.adm('admin.archive', { id: 'NUT-002' }); }, s => s.adm('admin.restore', { id: 'NUT-002' })]
];

function measure(code) {
  return SCENARIOS.map(([name, prepare, run]) => {
    const s = stand(code);
    const p = prepare ? prepare(s) : null;
    s.g.clearCache(); // как после 5 минут простоя: кэши пустые
    s.g.resetOps();
    const res = run(s, p);
    if (!res || !res.ok) throw new Error(name + ': ' + JSON.stringify(res));
    const cold = Object.assign({}, s.g.ops);
    return { name, cold, errors: s.g.sandbox.__errors.slice() };
  });
}

const fmt = ops => KINDS.filter(k => ops[k]).map(k => ({ read: 'чт', write: 'зап', append: 'стр', flush: 'сбр', prop: 'св', cache: 'кэш', lock: 'блок', tg: 'TG', tgBatch: 'TG-пачка' }[k]) + ' ' + ops[k]).join(', ');
const pad = (s, n) => (s + ' '.repeat(n)).slice(0, n);

const before = process.argv[2] ? measure(path.resolve(process.argv[2])) : null;
const after = measure(NOW);

console.log('Обозначения: чт — чтение листа, зап — запись ячеек, стр — добавление строки, сбр — принудительная запись (flush),');
console.log('св — чтение свойств скрипта, кэш — CacheService, блок — LockService, TG — отдельный вызов Telegram, TG-пачка — несколько вызовов разом.');
console.log('«Оценка, мс» — счётчики, умноженные на типичную цену обращения (' + KINDS.map(k => k + ' ' + COST[k]).join(', ') + '). Это не измерение.\n');
let sumB = 0, sumA = 0;
after.forEach((a, i) => {
  const b = before ? before[i] : null;
  const ma = model(a.cold), mb = b ? model(b.cold) : 0;
  sumA += ma; sumB += mb;
  console.log(pad(a.name, 50) + (b ? pad('до: ' + mb + ' мс', 16) + '→ ' : '') + pad('после: ' + ma + ' мс', 18) + (b && mb ? (ma <= mb ? '−' : '+') + Math.abs(Math.round((1 - ma / mb) * 100)) + ' %' : ''));
  if (b) console.log('    до:    ' + fmt(b.cold));
  console.log('    ' + (b ? 'после: ' : '') + fmt(a.cold));
  if (a.errors.length) console.log('    ОШИБКИ: ' + a.errors.join(' | '));
});
if (before) console.log('\nСумма по всем сценариям: до ' + sumB + ' мс → после ' + sumA + ' мс (' + (sumA <= sumB ? '−' : '+') + Math.abs(Math.round((1 - sumA / sumB) * 100)) + ' %)');
