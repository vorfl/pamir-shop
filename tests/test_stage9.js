// Проверка пункта меню «Етап 9: застосувати дані запуску» (apps-script/Stage9.gs) на таблице в памяти.
// Запуск: node tests/test_stage9.js
const path = require('path');
const { createGas, seed } = require('./gas_mock');
const CODE = path.join(__dirname, '..', 'apps-script', 'Code.gs');

let pass = 0, fail = 0;
function ok(cond, name, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra !== undefined ? ' → ' + JSON.stringify(extra) : '')); }
}
const U = id => ({ id, first_name: 'Тест' + id, username: 'user' + id, language_code: 'uk' });
const REPORT = 'Етап 9 — звіт';
const PHOTO = id => 'https://vorfl.github.io/pamir-shop/webapp/img/products/' + id + '.webp';
const DRIVE = 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUv/view';

/** Тестовая таблица + «чужие» строки: занятый SPS-021, фото на Drive, старое фото, архив. */
function build() {
  const s = seed();
  const rows = s.sheets['Товари'];
  const head = rows[0];
  const add = (o) => {
    const row = head.map(() => '');
    Object.keys(o).forEach(k => { const i = head.indexOf(k); if (i < 0) throw new Error('нет колонки ' + k); row[i] = o[k]; });
    row[head.indexOf('Ціна конкурента')] = 999; row[head.indexOf('Закупка')] = 111; row[head.indexOf('Маржа')] = 222;
    rows.push(row);
  };
  const base = { 'Категорія (UA)': 'Спеції', 'Категория (RU)': 'Специи', 'Наявність': 'є' };
  add(Object.assign({}, base, { 'ID': 'SPS-001', 'Назва (UA)': 'Суміш для плову стара', 'Название (RU)': 'Смесь для плова', 'Тип': 'вагова', 'Фасування': '50 г / 80 г', 'Ціна за 1 кг': 700, 'Стара ціна': 1200, 'Акція до': '31.12.2099', 'Опт: ціна': 600, 'Опт: мін. обсяг': 'від 5 кг', 'Залишок': 2.5 }));
  add(Object.assign({}, base, { 'ID': 'SPS-007', 'Назва (UA)': 'Барбарис', 'Тип': 'вагова', 'Фасування': '100 г', 'Ціна за 1 кг': 900, 'Фото (посилання)': DRIVE, 'Приховати з вітрини': 'так' }));
  add(Object.assign({}, base, { 'ID': 'SPS-021', 'Назва (UA)': 'Суміш для лагману', 'Тип': 'упаковка', 'Ціна за упаковку/шт': 50 }));
  add({ 'ID': 'NUT-045', 'Категорія (UA)': 'Горіхи', 'Категория (RU)': 'Орехи', 'Назва (UA)': 'Арахіс смажений', 'Тип': 'вагова', 'Фасування': '100 г', 'Ціна за 1 кг': 300, 'Наявність': 'є', 'Фото (посилання)': 'https://old.example/p.jpg' });
  add({ 'ID': 'NUT-013', 'Категорія (UA)': 'Горіхи', 'Категория (RU)': 'Орехи', 'Назва (UA)': 'Арахіс смажений солоний', 'Тип': 'вагова', 'Фасування': '100 г', 'Ціна за 1 кг': 310, 'Наявність': 'є' });
  add({ 'ID': 'NUT-024', 'Категорія (UA)': 'Горіхи', 'Категория (RU)': 'Орехи', 'Назва (UA)': 'Мигдальні пелюстки', 'Тип': 'вагова', 'Фасування': '100 г', 'Ціна за 1 кг': 800, 'Наявність': 'є' });
  add({ 'ID': 'DRY-090', 'Категорія (UA)': 'Сухофрукти', 'Категория (RU)': 'Сухофрукты', 'Назва (UA)': 'Чорнослив стара партія', 'Тип': 'вагова', 'Фасування': '500 г', 'Ціна за 1 кг': 400, 'Наявність': 'є' });
  add({ 'ID': 'DRY-089', 'Категорія (UA)': 'Сухофрукти', 'Категория (RU)': 'Сухофрукты', 'Назва (UA)': 'Курага стара партія', 'Тип': 'вагова', 'Фасування': '500 г', 'Ціна за 1 кг': 410, 'Наявність': 'є' });
  add(Object.assign({}, base, { 'ID': 'SPS-022', 'Назва (UA)': 'Суміш для риби', 'Название (RU)': 'Смесь для рыбы', 'Тип': 'упаковка', 'Ціна за упаковку/шт': 40 }));
  const archHead = head.filter(h => h).concat(['Дата архівації', 'Хто архівував']);
  const arow = archHead.map(() => '');
  arow[archHead.indexOf('ID')] = 'NUT-099'; arow[archHead.indexOf('Назва (UA)')] = 'Фундук смажений бланшований';
  s.sheets['Архів товарів'] = [archHead, arow];
  return s;
}
function fresh() {
  const g = createGas(CODE, build());
  // Стенд не умеет «Копировать лист»: добавляем, как это делает таблица Google.
  g.sheets['Товари'].copyTo = ss => {
    const n = ss.insertSheet('Копія аркуша Товари');
    n.rows = JSON.parse(JSON.stringify(g.sheets['Товари'].rows));
    n.setName = name => { delete g.sheets['Копія аркуша Товари']; n.name = name; g.sheets[name] = n; };
    return n;
  };
  return g;
}
const snap = (g, skip) => {
  const out = {};
  Object.keys(g.sheets).filter(n => !(skip || []).includes(n)).sort().forEach(n => { out[n] = g.sheets[n].rows; });
  return JSON.stringify(out);
};
const copies = g => Object.keys(g.sheets).filter(n => /^Товари — копія/.test(n));
const table = g => {
  const rows = g.sheets['Товари'].rows, head = rows[0];
  return { head, rows: rows.slice(1), col: t => head.indexOf(t), byId: id => rows.slice(1).find(r => r[0] === id) };
};
function order(g, user, items, total) {
  return g.post({ action: 'order', initData: g.initData(user), items, total, name: 'Олена', phone: '+380501234567', delivery: 'pickup', pay: 'cash', lang: 'ua', rid: 'r' + Math.random().toString(36).slice(2) });
}
const catalog = g => { g.clearCache(); const c = g.get({ action: 'catalog' }); const by = {}; c.products.forEach(p => { by[p.id] = p; }); return { c, by, text: JSON.stringify(c) }; };

console.log('Меню');
{
  const g = fresh();
  const fake = { items: [], addItem(t, fn) { this.items.push([t, fn]); return this; } };
  g.sandbox.stage9Menu_(fake);
  ok(fake.items.length === 1 && fake.items[0][0] === 'Етап 9: застосувати дані запуску' && typeof g.sandbox[fake.items[0][1]] === 'function', 'stage9Menu_ добавляет пункт «Етап 9: застосувати дані запуску»', fake.items);
  g.call('onOpen');
  ok(g.ui.menu.items.some(i => i[0] === 'Етап 9: застосувати дані запуску' && i[1] === 'stage9Apply'), 'пункт есть в меню PAMIR (onOpen)', g.ui.menu.items.map(i => i[0]));
}

console.log('Блокировка занята');
{
  const g = fresh();
  const before = snap(g);
  g.sandbox.LockService = { getScriptLock: () => ({ tryLock: () => false, releaseLock() {} }) };
  const res = g.call('stage9Apply');
  ok(res.ok === false && res.error === 'busy' && snap(g) === before && /Зараз таблицю змінює/.test(g.ui.alerts.pop()), 'занято: сообщение и выход, таблица не тронута');
}

console.log('Первый запуск');
const g = fresh();
const before = table(g);
const beforeAll = JSON.stringify(g.sheets['Товари'].rows);
const beforeRows = JSON.stringify(before.rows);
const beforeProps = JSON.stringify(g.props);
const t0 = Date.now();
const res1 = g.call('stage9Apply');
ok(Date.now() - t0 < 5000, 'работает секунды');
ok(res1.ok && res1.changedCells > 0 && /Готово/.test(g.ui.alerts.pop()), 'итоговое окно «Готово»', res1.message);
ok(JSON.stringify(Object.assign({}, g.props, { STAGE9_NOTICE_DONE: undefined })) === JSON.stringify(Object.assign(JSON.parse(beforeProps), { STAGE9_NOTICE_DONE: undefined })) && g.props.STAGE9_NOTICE_DONE === '1', 'Script Properties не менялись, кроме отметки STAGE9_NOTICE_DONE');
ok(copies(g).length === 1 && /^Товари — копія перед етапом 9 \d\d\.\d\d\.\d{4}$/.test(copies(g)[0]), 'копия листа «Товари» с датой создана одна', copies(g));
{
  const cp = g.sheets[copies(g)[0]].rows;
  ok(cp.length === before.rows.length + 1, 'копия имеет те же строки, что лист до изменений', cp.length);
}
const T = table(g);
ok(['Вага упаковки, г', 'Порядок', 'Приховати з вітрини'].every(h => T.head.includes(h)) && T.head.filter(h => h === 'Приховати з вітрини').length === 1, 'колонки созданы (скрытие не продублировано)', T.head.slice(-4));
ok(T.byId('SPS-001')[T.col('Вага упаковки, г')] === '' && T.rows.every(r => r[T.col('Вага упаковки, г')] === ''), '«Вага упаковки, г» не заполнена');

console.log('Баночки и наборы');
{
  const jars = { 'SPS-001': 35, 'SPS-003': 35, 'SPS-022': 35, 'SPS-023': 35, 'SPS-014': 35, 'SPS-010': 35, 'SPS-024': 35, 'SPS-025': 45, 'SPS-009': 45, 'SPS-006': 55, 'SPS-012': 55, 'SPS-007': 55 };
  const k = catalog(g);
  ok(Object.keys(jars).every(id => k.by[id] && k.by[id].t === 'p' && k.by[id].p === jars[id] && k.by[id].a === 1), '12 баночек с фиксированными ID в каталоге с ценой из таблицы', Object.keys(jars).filter(id => !k.by[id]));
  const chicken = T.rows.find(r => r[T.col('Назва (UA)')] === 'Спеції для курки — родинний рецепт');
  ok(chicken && chicken[0] === 'SPS-026' && k.by['SPS-026'] && k.by['SPS-026'].p === 35 && k.by['SPS-026'].ru === 'Специи для курицы — семейный рецепт', 'SPS-021 занят другим товаром → баночка под следующим свободным ID (SPS-026)', chicken && chicken[0]);
  ok(T.byId('SPS-021')[T.col('Назва (UA)')] === 'Суміш для лагману' && T.byId('SPS-021')[T.col('Ціна за упаковку/шт')] === 50, 'чужой SPS-021 не тронут (кроме скрытия как «лишняя специя»)');
  ok(/ID зайнятий, створено як SPS-026/.test(res1.message + JSON.stringify(res1.rep.notes)), 'в итоге: «ID зайнятий, створено як SPS-026»');
  ok(k.by['SPS-001'].ua === 'Спеції для плову — родинний рецепт' && !k.by['SPS-001'].v && !k.by['SPS-001'].pk, 'у баночки нет диапазона веса (Фасування очищено)', k.by['SPS-001']);
  ok(T.byId('SPS-007')[T.col('Приховати з вітрини')] === '' && k.by['SPS-007'], 'скрытие с баночки снято');
  ok(k.by['SET-001'].p === 135 && k.by['SET-002'].p === 95 && k.by['SET-003'].p === 155 && k.by['SET-002'].ua === 'Набір до м\'яса і грилю', 'наборы в каталоге с ценами 135 / 95 / 155');
  ok(k.by['SET-001'].dUa === 'Спеції для плову, зіра ціла, барбарис — 3 баночки' && k.by['SET-003'].dRu === 'Перец горошком, паприка, хмели-сунели, куркума — 4 баночки' && !k.by['SET-001'].img, 'описания наборов UA/RU, фото нет');
  const r1 = order(g, U(42), [{ id: 'SET-001', g: 0, q: 2 }, { id: 'SPS-014', g: 0, q: 1 }], 305);
  ok(r1.ok, 'заказ набора и баночки: сервер принял сумму 2×135 + 35 = 305', r1);
  ok(order(g, U(42), [{ id: 'SET-001', g: 0, q: 2 }, { id: 'SPS-014', g: 0, q: 1 }], 100).error === 'changed', 'чужая сумма заказа отклоняется');
  const t = T.rows.filter(r => r[T.col('Категорія (UA)')] === 'Спеції');
  ok(['SPC-001', 'SPC-002', 'SPC-003', 'SPC-004', 'SPC-005', 'SPS-021'].every(id => !k.by[id] && T.byId(id)[T.col('Приховати з вітрини')] === 'так'), 'остальные специи скрыты (не удалены) и не в каталоге');
  ok(['SPC-001', 'SPC-005'].every(id => T.byId(id)), 'скрытые строки на месте');
  const ord = id => Number(T.byId(id)[T.col('Порядок')]);
  ok(['SET-001', 'SET-002', 'SET-003'].map(ord).join() === '1,2,3' && ['SPS-001', 'SPS-003', 'SPS-026', 'SPS-022', 'SPS-023'].map(ord).join() === '11,12,13,14,15' &&
    ['SPS-014', 'SPS-010', 'SPS-024', 'SPS-025', 'SPS-009', 'SPS-006', 'SPS-012', 'SPS-007'].map(ord).join() === '21,22,23,24,25,26,27,28', 'порядок: наборы 1–3, смеси отца 11–15, остальные 21+');
  ok(t.length > 0, 'есть строки категории «Спеції»');
}

console.log('Курага');
{
  const k = catalog(g);
  ok(k.by['DRY-039'].ua === 'Курага кисло-солодка' && k.by['DRY-039'].ru === 'Курага кисло-сладкая' && k.by['DRY-039'].k === 380, 'DRY-039: новые названия, цена не тронута');
  const sweet = T.rows.find(r => r[T.col('Назва (UA)')] === 'Курага солодка з легкою кислинкою');
  const sugar = T.rows.find(r => r[T.col('Назва (UA)')] === 'Курага цукрова суха');
  ok(sweet && sweet[0] === 'DRY-089' && k.by['DRY-089'].k === 410 && k.by['DRY-089'].a === 1 && T.rows.filter(r => /^DRY-089$/.test(r[0])).length === 1, 'DRY-089 была под названием «Курага стара партія»: та же строка переименована, цена 410 не тронута, дубля нет', sweet && sweet[0]);
  ok(sugar && sugar[0] === 'DRY-091' && k.by['DRY-091'].k === 380 && T.byId('DRY-090')[T.col('Назва (UA)')] === 'Чорнослив стара партія' && T.byId('DRY-090')[T.col('Ціна за 1 кг')] === 400,
    'DRY-090 занят другим товаром → кураге цукрова под DRY-091, чужая строка не тронута', sugar && sugar[0]);
  ok(res1.rep.notes.some(n => /DRY-091.*як у DRY-039/.test(n)), 'в итоге есть пометка «ціну взято як у DRY-039»');
  ok(res1.rep.renamed.some(x => /DRY-089: було: «Курага стара партія» → стало: «Курага солодка з легкою кислинкою»/.test(x)) && /було: «Курага стара партія» → стало/.test(res1.message), 'в итоговом окне: було → стало для переименованной строки', res1.rep.renamed);
  ok(T.byId('DRY-091')[T.col('Фото (посилання)')] === PHOTO('DRY-090'), 'фото кураги цукрової: адрес из таблицы соответствия (DRY-090.webp)');
}

console.log('Настройки');
{
  const S = g.sheets['Налаштування'].rows;
  const get = k => { const r = S.find(x => x[0] === k); return r ? r[1] : undefined; };
  ok(get('father_ids') === 'SPS-001, SPS-003, SPS-026, SPS-022, SPS-023', 'father_ids — фактические ID пяти смесей', get('father_ids'));
  ok(get('feature_id') === 'DRY-039,DRY-089,DRY-091', 'feature_id — три ID кураги', get('feature_id'));
  ok(get('gift_from') === 500 && get('gift_text_ua') === 'Баночка спецій батька в подарунок' && get('gift_text_ru') === 'Баночка специй отца в подарок', 'gift_from и тексты подарка');
  ok(/@gladiroon/.test(get('notice_text_ua')) && /@gladiroon/.test(get('notice_text_ru')), 'notice_text_* записаны, пока строк не было');
}

console.log('Фото');
{
  const k = catalog(g);
  ok(T.byId('SPS-001')[T.col('Фото (посилання)')] === PHOTO('SPS-001') && k.by['SPS-001'].img === PHOTO('SPS-001'), 'пустое фото → адрес из таблицы соответствия');
  ok(T.byId('SPS-007')[T.col('Фото (посилання)')] === DRIVE && /SPS-007/.test(res1.rep.drive.join()), 'ссылка Google Drive не перезаписана и перечислена в итоге');
  ok(T.byId('NUT-045')[T.col('Фото (посилання)')] === PHOTO('NUT-045') && res1.rep.replaced.some(x => /NUT-045/.test(x) && /old\.example/.test(x)), 'иное значение заменено и указано в итоге');
  ok(T.byId('NUT-013')[T.col('Фото (посилання)')] === PHOTO('NUT-013'), 'NUT-013: адрес записан');
}

console.log('Новые товары (NEW-*)');
{
  const k = catalog(g);
  const byName = n => T.rows.find(r => r[T.col('Назва (UA)')] === n);
  const nuts = byName('Арахіс сирий');
  ok(nuts && /^NUT-\d{3}$/.test(nuts[0]) && nuts[T.col('Тип')] === 'вагова' && nuts[T.col('Ціна за 1 кг')] === '' && nuts[T.col('Приховати з вітрини')] === 'так' && nuts[T.col('Фото (посилання)')] === PHOTO('NEW-arahis-syryi'),
    'Арахіс сирий: новая строка, тип вагова, цена пустая, скрыта, фото NEW-*.webp', nuts);
  ok(!k.by[nuts[0]] && T.rows.filter(r => /NEW-/.test(r[T.col('Фото (посилання)')]) && r[T.col('Ціна за 1 кг')] === '').every(r => !k.by[r[0]]), 'новые товары без цены не в каталоге');
  ok(/Арахіс сирий/.test(res1.rep.waiting.join()) && res1.rep.waiting.length === 6, '«чекає ціну» — в итоге', res1.rep.waiting.length);
  const almond = T.byId('NUT-024');
  ok(almond[T.col('Назва (UA)')] === 'Мигдальні пелюстки' && almond[T.col('Фото (посилання)')] === PHOTO('NEW-mygdalevi-plastivtsi') && almond[T.col('Ціна за 1 кг')] === 800 && !byName('Мигдалеві пелюстки'), 'найден NUT-024: только фото, строка не создана и не изменена');
  ok(!byName('Фундук смажений бланшований') && res1.rep.skipped.some(x => /Фундук смажений бланшований.*архіві/.test(x)), 'есть только в архиве: строка не создана, в итоге «є в архіві, відновіть у панелі»');
  const lent = byName('Сочевиця червона');
  ok(lent && lent[T.col('Категорія (UA)')] === 'Крупи' && lent[T.col('Приховати з вітрини')] === 'так', 'чечевица: категория «Крупи», скрыта');
  const dry = byName('Цукати фруктові, кубики'), apple = byName('Яблука сушені');
  ok(dry && /^DRY-\d{3}$/.test(dry[0]) && apple && /^DRY-\d{3}$/.test(apple[0]) && dry[0] !== apple[0], 'сухофрукты: ID следующие свободные, без повторов', [dry && dry[0], apple && apple[0]]);
  ok(!k.text.includes('конкурент'), 'в строки новых товаров цены конкурента не попали');
}

console.log('Служебные колонки и чужие строки');
{
  const k = catalog(g);
  ok(!/СЕКРЕТ|do-smaku|33%/.test(k.text) && !/:999[,}]|:111[,}]|:222[,}]/.test(k.text), 'служебные колонки не в ответе catalog');
  const svc = ['Ціна конкурента', 'Примітка', 'Закупка', 'Маржа', 'Націнка', 'Джерело'];
  const same = svc.every(h => before.rows.every(r => {
    const now = T.byId(r[0]);
    return now && now[T.col(h)] === r[before.head.indexOf(h)];
  }));
  ok(same, 'служебные колонки (конкурент, закупка, маржа, примечание, источник) у всех исходных строк не изменены');
  ok(['NUT-001', 'TEA-001', 'SWT-001', 'CND-004', 'DRY-001', 'HID-001'].every(id => {
    const b = before.rows.find(r => r[0] === id), n = T.byId(id);
    return JSON.stringify(b) === JSON.stringify(n.slice(0, b.length)) && n.slice(b.length).every(v => v === '');
  }), 'чужие строки (орехи, чай, сладости, конфеты, курага DRY-001, скрытый HID-001) не изменены');
}

console.log('Повторный запуск');
{
  const snapBefore = snap(g, [REPORT]);
  const rowsBefore = g.sheets['Товари'].rows.length;
  const res2 = g.call('stage9Apply');
  ok(res2.ok && res2.changedCells === 0 && /Змін немає/.test(g.ui.alerts.pop()), 'второй запуск сообщает, что изменений нет', res2.message);
  ok(snap(g, [REPORT]) === snapBefore, 'ни одна ячейка (и ни один лист) не изменились');
  ok(g.sheets['Товари'].rows.length === rowsBefore, 'строк не добавлено (баночки, наборы, новые товары не продублированы)');
  ok(copies(g).length === 1, 'копия листа осталась одна');
  const chickens = g.sheets['Товари'].rows.filter(r => r[3] === 'Спеції для курки — родинний рецепт');
  ok(chickens.length === 1 && chickens[0][0] === 'SPS-026', 'занятый SPS-021: баночка найдена по названию, дубля нет', chickens.map(r => r[0]));
}

console.log('Повторный запуск после правок владельца');
{
  const S = g.sheets['Налаштування'];
  S.rows.find(x => x[0] === 'notice_text_ua')[1] = '';
  S.rows.find(x => x[0] === 'notice_text_ru')[1] = '';
  const res3 = g.call('stage9Apply');
  const get = k => S.rows.find(x => x[0] === k)[1];
  ok(res3.ok && get('notice_text_ua') === '' && get('notice_text_ru') === '' && res3.changedCells === 0, 'очищенная полоска (notice_text_*) не возвращается', res3.message);
  const T2 = table(g);
  T2.byId('SPS-001')[T2.col('Фото (посилання)')] = DRIVE; // владелец загрузил фото через панель
  T2.byId('SPS-009')[T2.col('Приховати з вітрини')] = '';
  g.call('stage9Apply');
  ok(T2.byId('SPS-001')[T2.col('Фото (посилання)')] === DRIVE, 'фото из панели (Drive) не перезаписывается и при повторе');
  ok(copies(g).length === 1, 'копия за день всё ещё одна');
}

console.log('Таблица без архива, настроек и колонок');
{
  const s = build();
  delete s.sheets['Архів товарів'];
  const g2 = createGas(CODE, s);
  g2.sheets['Товари'].copyTo = ss => { const n = ss.insertSheet('x'); n.rows = JSON.parse(JSON.stringify(g2.sheets['Товари'].rows)); n.setName = nm => { delete g2.sheets.x; n.name = nm; g2.sheets[nm] = n; }; return n; };
  const r = g2.call('stage9Apply');
  ok(r.ok && /^NUT-\d{3}$/.test(g2.sheets['Товари'].rows.find(x => x[3] === 'Фундук смажений бланшований')[0]), 'без архива строка «Фундук…» создаётся как новая, ошибок нет', r.message);
}

console.log('Тот же товар под другим названием (SPS-022 «Суміш для риби»)');
{
  const k = catalog(g);
  const fish = T.rows.filter(r => /риб/i.test(r[T.col('Назва (UA)')]));
  ok(fish.length === 1 && fish[0][0] === 'SPS-022' && fish[0][T.col('Назва (UA)')] === 'Спеції для риби — родинний рецепт' && k.by['SPS-022'].p === 35, 'SPS-022 найдена по слову «риб»: переименована, дубля нет, цена баночки');
  ok(res1.rep.renamed.some(x => /SPS-022: було: «Суміш для риби» → стало: «Спеції для риби — родинний рецепт»/.test(x)) && !res1.rep.created.some(x => /для риби/.test(x)), 'в итоге «було → стало», новая строка не создана');
  ok(T.rows.find(r => r[0] === 'SPS-021')[T.col('Назва (UA)')] === 'Суміш для лагману', 'название без ключевого слова (лагман вместо курки) — чужой товар, остаётся');
}

console.log('Порядок в «Спеції» в ответе catalog');
{
  const k = catalog(g);
  const ids = k.c.products.filter(p => p.c === 'SPC').map(p => p.id);
  const want = ['SET-001', 'SET-002', 'SET-003', 'SPS-001', 'SPS-003', 'SPS-026', 'SPS-022', 'SPS-023', 'SPS-014', 'SPS-010', 'SPS-024', 'SPS-025', 'SPS-009', 'SPS-006', 'SPS-012', 'SPS-007'];
  ok(JSON.stringify(ids.slice(0, want.length)) === JSON.stringify(want), 'наборы → пять смесей отца → остальные баночки', ids);
}

console.log('Полоска: отметка STAGE9_NOTICE_DONE');
{
  const s = build();
  s.sheets['Налаштування'] = [['Ключ', 'Значення', 'Опис'], ['notice_text_ua', '', ''], ['notice_text_ru', 'Моє власне повідомлення', ''], ['gift_from', 0, '']];
  const g3 = createGas(CODE, s);
  g3.sheets['Товари'].copyTo = ss => { const n = ss.insertSheet('x'); n.rows = JSON.parse(JSON.stringify(g3.sheets['Товари'].rows)); n.setName = nm => { delete g3.sheets.x; n.name = nm; g3.sheets[nm] = n; }; return n; };
  const get = k => g3.sheets['Налаштування'].rows.find(x => x[0] === k)[1];
  ok(!g3.props.STAGE9_NOTICE_DONE, 'отметки ещё нет');
  g3.call('stage9Apply');
  ok(/@gladiroon/.test(get('notice_text_ua')) && get('notice_text_ru') === 'Моє власне повідомлення' && get('gift_from') === 500, 'строки есть и пустые, отметки нет → текст записан; своё непустое значение не перезаписано');
  ok(g3.props.STAGE9_NOTICE_DONE === '1', 'отметка поставлена');
  g3.sheets['Налаштування'].rows.find(x => x[0] === 'notice_text_ua')[1] = '';
  const r = g3.call('stage9Apply');
  ok(get('notice_text_ua') === '' && r.changedCells === 0, 'после очистки и повторного запуска полоска не возвращается');
}

console.log('Старые значения «за кг» при смене типа на «упаковка»');
{
  const k = catalog(g);
  const row = T.byId('SPS-001');
  ok(['Стара ціна', 'Акція до', 'Опт: ціна', 'Опт: мін. обсяг', 'Залишок'].every(h => row[T.col(h)] === ''), 'стара ціна, акція, опт и залишок очищены у бывшей весовой строки');
  ok(k.by['SPS-001'].p === 35 && !k.by['SPS-001'].o && !k.by['SPS-001'].q && !k.by['SPS-001'].wb, 'в каталоге нет ложной скидки, остатка и опта');
  ok(res1.rep.cleared.some(x => /SPS-001: Стара ціна \(було 1200\)/.test(x)) && res1.rep.cleared.some(x => /Залишок \(було 2\.5\)/.test(x)) && /Очищено \(було …\)/.test(res1.message), 'очищенное показано в итоге блоком «Очищено (було …)»', res1.rep.cleared);
  ok(T.byId('SPS-003') && T.byId('SPS-003')[T.col('Тип')] === 'упаковка', 'прочие баночки получили тип «упаковка»');
}

console.log('Залишок, вписанный владельцем позже');
{
  const T3 = table(g);
  T3.byId('SPS-001')[T3.col('Залишок')] = 12;
  const r = g.call('stage9Apply');
  ok(r.changedCells === 0 && T3.byId('SPS-001')[T3.col('Залишок')] === 12, 'повторный запуск не стирает «Залишок» баночки');
}

console.log('Копия листа');
ok(JSON.stringify(g.sheets[copies(g)[0]].rows) === beforeAll, 'копия совпадает с листом до изменений (ячейка в ячейку)');

console.log('Куркума под SPS-021 — чужой товар');
{
  const s = build();
  s.sheets['Товари'].find(r => r[0] === 'SPS-021')[3] = 'Куркума ціла';
  const g4 = createGas(CODE, s);
  g4.sheets['Товари'].copyTo = ss => { const n = ss.insertSheet('x'); n.rows = JSON.parse(JSON.stringify(g4.sheets['Товари'].rows)); n.setName = nm => { delete g4.sheets.x; n.name = nm; g4.sheets[nm] = n; }; return n; };
  const r = g4.call('stage9Apply');
  const T4 = table(g4);
  ok(T4.byId('SPS-021')[3] === 'Куркума ціла' && T4.byId('SPS-021')[T4.col('Приховати з вітрини')] === 'так' && !r.rep.renamed.some(x => /SPS-021/.test(x)), 'куркума не переименована в «для курки», скрыта как прочие специи');
  ok(T4.byId('SPS-026') && T4.byId('SPS-026')[3] === 'Спеції для курки — родинний рецепт', 'курка получила новый ID');
}

console.log('ID без учёта регистра и пробелов');
{
  const s = build();
  const row = s.sheets['Товари'][0].map(() => '');
  const head = s.sheets['Товари'][0];
  row[head.indexOf('ID')] = ' sps-014 '; row[head.indexOf('Назва (UA)')] = 'Хмелі стара'; row[head.indexOf('Категорія (UA)')] = 'Спеції'; row[head.indexOf('Тип')] = 'вагова'; row[head.indexOf('Наявність')] = 'є';
  s.sheets['Товари'].push(row);
  const g5 = createGas(CODE, s);
  g5.sheets['Товари'].copyTo = ss => { const n = ss.insertSheet('x'); n.rows = JSON.parse(JSON.stringify(g5.sheets['Товари'].rows)); n.setName = nm => { delete g5.sheets.x; n.name = nm; g5.sheets[nm] = n; }; return n; };
  g5.call('stage9Apply');
  const hops = g5.sheets['Товари'].rows.filter(r => /^\s*sps-014\s*$/i.test(r[0]));
  ok(hops.length === 1 && hops[0][3] === 'Хмелі-сунелі', '« sps-014 » — это SPS-014: вторая строка не создана, эта обновлена', hops.map(r => r[0]));
}

console.log('Колонки «Порядок» и «Вага упаковки, г» — только точное название');
{
  const s = build();
  const head = s.sheets['Товари'][0];
  head.push('Порядок (старий)', 'Вага упаковки, г (стара)');
  s.sheets['Товари'].forEach((r, i) => { if (i) r.push('x', 'y'); });
  const g6 = createGas(CODE, s);
  g6.sheets['Товари'].copyTo = ss => { const n = ss.insertSheet('x'); n.rows = JSON.parse(JSON.stringify(g6.sheets['Товари'].rows)); n.setName = nm => { delete g6.sheets.x; n.name = nm; g6.sheets[nm] = n; }; return n; };
  g6.call('stage9Apply');
  const T6 = table(g6);
  ok(T6.head.includes('Порядок') && T6.head.includes('Вага упаковки, г') && T6.rows.every(r => ['x', ''].includes(r[T6.col('Порядок (старий)')]) && ['y', ''].includes(r[T6.col('Вага упаковки, г (стара)')])) && T6.byId('SET-001')[T6.col('Порядок')] === 1, 'создана отдельная колонка «Порядок», «Порядок (старий)» не тронута');
}

console.log('Launch после этапа 9');
{
  const g7 = createGas(CODE, seed());
  g7.props.STAGE9_NOTICE_DONE = '1';
  const b = snap(g7);
  g7.call('menuLaunchApply');
  const msg = g7.ui.alerts.pop();
  const r = g7.call('launchApply_');
  ok(/Етап 9 уже застосовано.*запуск скасовано/.test(msg) && r.ok === false && r.error === 'stage9_done' && snap(g7) === b, '«Підготовка до запуску → Застосувати» после этапа 9 отказывает и ничего не меняет', msg);
}

console.log('Волна Б2: «Фото 2» и пункт меню «Етап 9Б2»');
{
  const IDS = ['DRY-017','DRY-018','DRY-019','NEW-arahis-syryi','NEW-funduk-smazhenyi-blanshovanyi','NEW-mygdalevi-plastivtsi','NEW-tsukaty-dribni','NEW-tsukaty','NUT-013','NUT-014','NUT-018','NUT-019','NUT-026','NUT-028','NUT-030','NUT-036','NUT-040','NUT-045','NUT-047'];
  const BAN = ['DRY-039','DRY-089','DRY-090','DRY-068','DRY-086','NEW-yabluka-sushka','NEW-sochevytsya-chervona','NUT-048','NEW-garbuzove-golonasinne'];
  const P2 = id => 'https://vorfl.github.io/pamir-shop/webapp/img/products/p/' + id + '.webp';
  const mk = () => {
    const s = build(); const h = s.sheets['Товари'][0];
    BAN.forEach(id => { const row = h.map(() => ''); row[h.indexOf('ID')] = id; row[h.indexOf('Назва (UA)')] = 'x ' + id; row[h.indexOf('Тип')] = 'вагова'; row[h.indexOf('Фасування')] = '100 г'; row[h.indexOf('Ціна за 1 кг')] = 100; row[h.indexOf('Наявність')] = 'є'; s.sheets['Товари'].push(row); });
    return s;
  };
  const addCol = (g, fill) => { const rows = g.sheets['Товари'].rows; rows[0].push('Фото 2'); rows.slice(1).forEach(r => r.push(fill(r[0]))); return rows[0].length - 1; };
  const fake = { items: [], addItem(t, fn) { this.items.push([t, fn]); return this; } };
  const g00 = createGas(CODE, mk());
  g00.sandbox.stage9b2Menu_(fake);
  ok(fake.items.length === 3 && fake.items[0][0] === 'Етап 9Б2: записати другі фото' && typeof g00.sandbox[fake.items[0][1]] === 'function', 'пункт меню «Етап 9Б2: записати другі фото» добавлен');
  ok(fake.items[1][0] === 'Етап 9Б2: налаштувати' && fake.items[1][1] === 'stage9b2Setup' && typeof g00.sandbox.stage9b2Setup === 'function', 'пункт меню «Етап 9Б2: налаштувати» добавлен');
  ok(fake.items[2][0] === 'Етап 9Б2: перевірити Нову пошту' && fake.items[2][1] === 'stage9b2CheckNp' && typeof g00.sandbox.stage9b2CheckNp === 'function', 'пункт меню «Етап 9Б2: перевірити Нову пошту» добавлен');
  ok(IDS.length === 19 && new Set(IDS).size === 19 && !IDS.some(i => BAN.includes(i)), 'список из 19 ID без запрещённых (контроль теста)');
  const SB = g00.sandbox;
  ok(JSON.stringify(SB.S9B2_PHOTO2_IDS) === JSON.stringify(IDS) && JSON.stringify(SB.S9B2_PHOTO2_FORBIDDEN.slice().sort()) === JSON.stringify(BAN.slice().sort()), 'константы списка и запрета в Stage9b2.gs совпадают с заданием');

  const g0 = createGas(CODE, mk());
  const before = catalog(g0);
  ok(before.text.indexOf('"i2"') < 0, 'нет колонки «Фото 2» — в каталоге нет поля i2');
  g0.call('stage9b2Photos');
  const T = table(g0), c2 = T.head.indexOf('Фото 2');
  ok(c2 >= 0 && T.head.filter(h => h === 'Фото 2').length === 1, 'колонка «Фото 2» создана');
  ok(T.byId('NUT-045')[c2] === P2('NUT-045') && T.byId('NUT-013')[c2] === P2('NUT-013'), 'адрес записан для товаров из списка', T.byId('NUT-045')[c2]);
  ok(BAN.every(id => !T.byId(id)[c2]) && T.byId('SPS-001')[c2] === '', 'запрещённые и чужие товары не получили «Фото 2»', BAN.map(id => T.byId(id)[c2]));
  const msg1 = g0.ui.alerts[g0.ui.alerts.length - 1];
  ok(/записано 2, уже було 0, не знайдено в таблиці 17/.test(msg1), 'итог: записано 2, уже было 0, не найдено 17', msg1);
  const a = catalog(g0);
  ok(a.by['NUT-045'].i2 === P2('NUT-045') && a.by['SPS-001'].i2 === undefined, 'в каталоге i2 только у товаров с заполненной ячейкой');
  ok(a.by['NUT-045'].img === 'https://old.example/p.jpg', 'основное фото не подменено колонкой «Фото 2»', a.by['NUT-045'].img);
  ok(!/СЕКРЕТ|do-smaku|33%/.test(a.text) && !/:999[,}]|:111[,}]|:222[,}]/.test(a.text) && a.c.products.length === before.c.products.length, 'служебные колонки не в ответе, число товаров прежнее');
  const s1 = snap(g0); g0.call('stage9b2Photos');
  ok(snap(g0) === s1, 'повторный запуск меню ничего не меняет');
  ok(/записано 0, уже було 2/.test(g0.ui.alerts[g0.ui.alerts.length - 1]), 'итог повторного запуска: записано 0, уже было 2');

  const g1 = createGas(CODE, mk());
  const k1 = addCol(g1, id => id === 'NUT-045' ? 'https://my.example/own.webp' : '');
  g1.call('stage9b2Photos');
  const T1 = table(g1);
  ok(T1.byId('NUT-045')[k1] === 'https://my.example/own.webp' && T1.byId('NUT-013')[k1] === P2('NUT-013') && T1.head.filter(h => h === 'Фото 2').length === 1, 'заполненная ячейка не перезаписана, пустая заполнена, колонка не задвоена');

  const g2 = createGas(CODE, mk());
  const vals = { 'SPS-001': 'javascript:alert(1)', 'SPS-007': 'ftp://x/y.webp', 'SPS-021': 'просто текст', 'NUT-024': 'data:image/png;base64,AAA', 'NUT-013': 'http://x.example/a.webp', 'SPS-022': 'https://x.example/b.webp' };
  addCol(g2, id => vals[id] || '');
  const b = catalog(g2);
  ok(['SPS-001', 'SPS-021', 'NUT-024'].every(id => b.by[id].i2 === undefined) && b.by['NUT-013'].i2 === 'http://x.example/a.webp' && b.by['SPS-022'].i2 === 'https://x.example/b.webp', 'не-http значения не уходят, http(s) уходит');
  ok(b.by['NUT-045'].img === 'https://old.example/p.jpg', 'при «Фото 2» раньше по порядку основное фото читается из своей колонки');
}


console.log('Волна Б2, долг блока 1: «Фото 2» левее «Фото (посилання)»');
{
  const s = build(); const rows = s.sheets['Товари'];
  rows[0].splice(1, 0, 'Фото 2');
  rows.slice(1).forEach(r => r.splice(1, 0, r[0] === 'NUT-045' ? 'https://p2.example/nut45.webp' : ''));
  const g = createGas(CODE, s);
  const c = catalog(g);
  ok(c.by['NUT-045'].img === 'https://old.example/p.jpg' && c.by['NUT-045'].i2 === 'https://p2.example/nut45.webp', '«Фото 2» левее основной колонки: img не подменён, i2 верный', [c.by['NUT-045'].img, c.by['NUT-045'].i2]);
  ok(c.by['NUT-013'].img === undefined && c.by['NUT-013'].i2 === undefined, 'у товара без фото при этом нет ни img, ни i2');
}

console.log('Волна Б2, блок 2: наборы («Склад набору»)');
const NB = ' ';
function mkSets(opt) {
  opt = opt || {};
  const s = build(); const rows = s.sheets['Товари']; const head = rows[0];
  if (!opt.noCol) { head.push(opt.colName || 'Склад набору'); rows.slice(1).forEach(r => r.push('')); }
  const keyCol = opt.colName || 'Склад набору';
  const add = (o) => {
    const row = head.map(() => '');
    Object.keys(o).forEach(k => { const kk = k === 'Склад набору' ? keyCol : k; const i = head.indexOf(kk); if (i < 0) throw new Error('нет колонки ' + k); row[i] = o[k]; });
    row[head.indexOf('Ціна конкурента')] = 999; row[head.indexOf('Закупка')] = 111; row[head.indexOf('Маржа')] = 222;
    rows.push(row);
  };
  const b = { 'Категорія (UA)': 'Спеції', 'Категория (RU)': 'Специи', 'Наявність': 'є', 'Тип': 'упаковка' };
  const pk = (id, name, price, extra) => add(Object.assign({}, b, { 'ID': id, 'Назва (UA)': name, 'Название (RU)': name + ' ru', 'Ціна за упаковку/шт': price }, extra || {}));
  pk('KIT-A', 'Спеція А', 50); pk('KIT-B', 'Спеція Б', 60); pk('KIT-C', 'Спеція; В', 30, { 'Тип': 'шт' });
  pk('KIT-X', 'Спеція Х', 10, { 'Наявність': 'немає' });
  pk('KIT-H', 'Спеція прихована', 10, { 'Приховати з вітрини': 'так' });
  pk('KIT-W', 'Спеція вагова', '', { 'Тип': 'вагова', 'Фасування': '100 г', 'Ціна за 1 кг': 500 });
  pk('KIT-P', 'Спеція без ціни', '');
  const set = (id, price, comp, extra) => pk(id, 'Набір ' + id, price, Object.assign({ 'Склад набору': comp, 'Бейдж': 'набір' }, extra || {}));
  if (!opt.noCol) {
    set('SET-001', opt.p1 === undefined ? 135 : opt.p1, 'KIT-A, KIT-B, kit-c');
    set('SET-002', 140, 'KIT-A, KIT-B, KIT-C');          // сумма равна цене набора
    set('SET-003', 150, 'KIT-A, KIT-B, KIT-C');          // сумма меньше цены набора
    set('SET-004', 100, 'KIT-A, KIT-X');                 // «немає»
    set('SET-005', 100, 'KIT-A, KIT-H');                 // скрыт
    set('SET-006', 100, 'KIT-A, KIT-NOPE');              // нет в таблице
    set('SET-007', 100, 'KIT-A, SET-007');               // сам на себя
    set('SET-008', 100, 'KIT-A, SET-001');               // другой набор
    set('SET-009', 100, 'KIT-A, SPS-001');               // вагова с несколькими фасовками: цена неоднозначна
    set('SET-010', 40, 'KIT-W');                         // вагова с одной фасовкой: 50 ₴
    set('SET-011', 10, 'KIT-A, KIT-P');                  // у товара состава нет цены
    set('SET-012', 100, ' , ;');                         // состав из мусора
  } else {
    pk('SET-001', 'Набір SET-001', 135);
  }
  if (opt.settings) s.sheets['Налаштування'] = opt.settings;
  return s;
}
{
  const g = createGas(CODE, mkSets());
  const a = catalog(g);
  const S1 = a.by['SET-001'];
  ok(JSON.stringify(S1.ks) === JSON.stringify(['KIT-A', 'KIT-B', 'KIT-C']) && S1.kp === 140 && S1.a === 1 && S1.p === 135, 'SET-001: ks (с реальными ID), kp = 50+60+30 = 140, цена набора своя, в наличии', S1);
  ok(S1.cu === undefined && S1.cr === undefined, '«Склад набору» не читается как «Склад» (cu/cr)');
  ok(a.by['SET-002'].kp === undefined && a.by['SET-002'].a === 1 && a.by['SET-003'].kp === undefined && a.by['SET-003'].a === 1, 'kp не отдаётся, когда сумма состава равна цене набора или меньше');
  ok(['SET-004', 'SET-005', 'SET-006'].every(id => a.by[id] && a.by[id].a === 0 && a.by[id].kp === undefined), 'состав «немає» / скрыт / нет в таблице: набор недоступен, kp нет', ['SET-004', 'SET-005', 'SET-006'].map(id => a.by[id].a));
  ok(a.by['SET-007'].a === 0 && a.by['SET-008'].a === 0 && a.by['SET-012'].a === 0, 'набор на себя, набор в наборе и пустой состав недоступны');
  ok(a.by['SET-009'].a === 1 && a.by['SET-009'].kp === undefined && a.by['SET-011'].kp === undefined, 'цена состава неоднозначна или неизвестна: kp не отдаётся');
  ok(a.by['SET-010'].kp === undefined && a.by['SET-010'].a === 1, 'весовой товар состава (даже с одной фасовкой) без цены упаковки: kp не отдаётся', a.by['SET-010']);
  ok(a.by['KIT-A'].ks === undefined && a.by['KIT-A'].kp === undefined, 'у обычного товара нет ks/kp');
  ok(!/СЕКРЕТ|do-smaku|33%/.test(a.text) && !/:999[,}]|:111[,}]|:222[,}]/.test(a.text), 'служебные колонки не утекают (в т.ч. с колонкой «Склад набору»)');

  const mem = g.sent.length;
  ok(order(g, U(70), [{ id: 'SET-004', g: 0, q: 1 }], 100).error === 'changed', 'заказ набора с «немає» в составе отклонён');
  ok(order(g, U(70), [{ id: 'SET-005', g: 0, q: 1 }], 100).error === 'changed', 'заказ набора со скрытым товаром в составе отклонён');
  ok(order(g, U(70), [{ id: 'SET-006', g: 0, q: 1 }], 100).error === 'changed', 'заказ набора с отсутствующим товаром в составе отклонён');
  ok(order(g, U(70), [{ id: 'SET-007', g: 0, q: 1 }], 100).error === 'changed' && order(g, U(70), [{ id: 'SET-008', g: 0, q: 1 }], 100).error === 'changed', 'заказ набора на себя / набора в наборе отклонён');
  ok(order(g, U(70), [{ id: 'SET-001', g: 0, q: 1 }], 140).error === 'changed', 'сумма «окремо» вместо цены набора не принимается');
  const r = order(g, U(70), [{ id: 'SET-001', g: 0, q: 2 }, { id: 'KIT-A', g: 0, q: 1 }], 135 * 2 + 50);
  ok(r.ok === true, 'заказ набора: сумма по цене набора из таблицы (состав не влияет)', r);
  const rows = g.sheets['Замовлення'].rows, last = rows[rows.length - 1];
  const itemsCell = last.find(x => typeof x === 'string' && /Набір SET-001/.test(x));
  ok(last[13] === 320 && /^Набір SET-001 × 2 = 270 ₴\n {3}· Спеція А\n {3}· Спеція Б\n {3}· Спеція, В; Спеція А × 1 = 50 ₴$/.test(itemsCell || ''), 'в «Замовлення»: набор одной строкой, под ней состав; вторая позиция не склеена', itemsCell);
  const adm = g.sent.slice(mem).filter(m => m.method === 'sendMessage' && m.payload.chat_id === '900').pop();
  const T = adm ? adm.payload.text.split('\n') : [];
  const at = T.findIndex(x => /^• Набір SET-001 × 2 = 270 ₴$/.test(x));
  ok(at > 0 && T[at + 1] === NB.repeat(4) + '· Спеція А' && T[at + 2] === NB.repeat(4) + '· Спеція Б' && T[at + 3] === NB.repeat(4) + '· Спеція, В' && /^• Спеція А × 1 = 50 ₴$/.test(T[at + 4]) && /Разом: 320 ₴/.test(adm.payload.text), 'админу: набор строкой, состав под ней с отступом, затем обычная позиция', T.slice(at, at + 6));
  const cmp = JSON.parse(last[last.length - 1] || '{}');
  ok(JSON.stringify((cmp.i || []).map(x => x[0])) === JSON.stringify(['SET-001', 'KIT-A']), 'служебная запись заказа: набор — одна позиция (состав в неё не попадает)', cmp.i);
}
{
  // Решение владельца: «окремо» = сумма цен упаковки (баночки) состава; ожидание 145 / 105 / 170.
  // Цены баночек — из STAGE9_JARS (Stage9.gs), тот же источник, что кладёт их в таблицу.
  const jarPrice = {};
  require('vm').runInNewContext(require('fs').readFileSync(path.join(__dirname, '..', 'apps-script', 'Stage9.gs'), 'utf8') + '\nthis.J = STAGE9_JARS;', jarPrice);
  const price = id => jarPrice.J.find(j => j.id === id).price;
  const mk = (drop) => {
    const s = build(); const rows = s.sheets['Товари']; const head = rows[0];
    head.push('Склад набору'); rows.slice(1).forEach(r => r.push(''));
    const add = (id, tp, p, comp, extra) => {
      const row = head.map(() => '');
      const put = (k, v) => { row[head.indexOf(k)] = v; };
      put('ID', id); put('Категорія (UA)', 'Спеції'); put('Категория (RU)', 'Специи'); put('Назва (UA)', id); put('Название (RU)', id);
      put('Наявність', 'є'); put('Тип', tp); put('Ціна за упаковку/шт', p); put('Склад набору', comp || '');
      Object.keys(extra || {}).forEach(k => put(k, extra[k]));
      put('Ціна конкурента', 999); put('Закупка', 111); put('Маржа', 222);
      rows.push(row);
    };
    const sets = { 'SET-001': [135, ['SPS-001', 'SPS-006', 'SPS-007']], 'SET-002': [95, ['SPS-003', 'SPS-021', 'SPS-024']], 'SET-003': [155, ['SPS-012', 'SPS-009', 'SPS-014', 'SPS-010']] };
    Object.keys(sets).forEach(k => sets[k][1].forEach(id => { rows.splice(rows.findIndex((r, i) => i > 0 && r[0] === id), 1); }));
    Object.keys(sets).forEach(k => sets[k][1].forEach(id => add(id, 'упаковка', price(id))));
    if (drop) drop(add, rows, head);
    Object.keys(sets).forEach(k => add(k, 'упаковка', sets[k][0], sets[k][1].join(', ')));
    return s;
  };
  const a = catalog(createGas(CODE, mk()));
  ok(a.by['SET-001'].kp === 145 && a.by['SET-002'].kp === 105 && a.by['SET-003'].kp === 170, '«окремо» по цене баночки: SET-001 = 145, SET-002 = 105, SET-003 = 170', [1, 2, 3].map(i => a.by['SET-00' + i].kp));
  ok(a.by['SET-001'].p === 135 && a.by['SET-002'].p === 95 && a.by['SET-003'].p === 155, 'цены наборов не изменились');
  ok(!/:999[,}]|:111[,}]|:222[,}]/.test(a.text), 'служебные колонки не утекают');
  const g1 = createGas(CODE, mk());
  ok(order(g1, U(74), [{ id: 'SET-001', g: 0, q: 1 }], 135).ok === true && order(g1, U(74), [{ id: 'SET-001', g: 0, q: 1 }], 145).error === 'changed', 'сумма заказа — по цене набора, kp на неё не влияет');
  // у одной специи нет цены за упаковку
  const s2 = mk(); const h2 = s2.sheets['Товари'][0];
  s2.sheets['Товари'].find(r => r[0] === 'SPS-006')[h2.indexOf('Ціна за упаковку/шт')] = '';
  const b = catalog(createGas(CODE, s2));
  ok(b.by['SET-001'].kp === undefined && b.by['SET-002'].kp === 105 && b.by['SET-001'].p === 135, 'у специи состава нет цены упаковки: kp у набора нет, у остальных есть');
  // весовой товар с несколькими фасовками без цены упаковки
  const s3 = mk(); const h3 = s3.sheets['Товари'][0];
  const w = s3.sheets['Товари'].find(r => r[0] === 'SPS-007');
  w[h3.indexOf('Тип')] = 'вагова'; w[h3.indexOf('Фасування')] = '100 г / 250 г'; w[h3.indexOf('Ціна за 1 кг')] = 500; w[h3.indexOf('Ціна за упаковку/шт')] = '';
  const c = catalog(createGas(CODE, s3));
  ok(c.by['SPS-007'].t === 'w' && c.by['SET-001'].kp === undefined && c.by['SET-001'].a === 1 && c.by['SET-003'].kp === 170, 'весовой товар с несколькими фасовками в составе: kp нет, набор доступен');
}
{
  // Экранирование в тексте админу; статистика не ломается от многострочной ячейки.
  const s = mkSets(); const h = s.sheets['Товари'][0];
  s.sheets['Товари'].find(r => r[0] === 'KIT-A')[h.indexOf('Назва (UA)')] = 'Перець <b>&</b>';
  const g = createGas(CODE, s);
  ok(order(g, U(71), [{ id: 'SET-001', g: 0, q: 1 }], 135).ok === true, 'заказ с названием, содержащим HTML');
  const adm = g.sent.filter(m => m.method === 'sendMessage' && m.payload.chat_id === '900').pop();
  ok(adm.payload.text.indexOf('· Перець &lt;b&gt;&amp;&lt;/b&gt;') > 0 && adm.payload.text.indexOf('<b>&</b>') < 0, 'название в составе экранировано, как остальной текст');
  const st = g.call('salesStats_', false);
  ok(st && st.all && st.all.n >= 1, 'статистика читает заказы с набором (многострочная ячейка)', st && st.all);
}
{
  // Без колонки «Склад набору» всё как раньше: SET-товары — обычные.
  const g = createGas(CODE, mkSets({ noCol: true }));
  const base = createGas(CODE, build());
  const a = catalog(g), b = catalog(base);
  ok(a.c.products.every(p => p.ks === undefined && p.kp === undefined) && a.by['SET-001'].a === 1 && a.by['SET-001'].p === 135, 'без колонки нет ks/kp ни у кого, SET-товар — обычный');
  ok(a.c.products.filter(p => b.by[p.id]).every(p => JSON.stringify(p) === JSON.stringify(b.by[p.id])), 'старые товары без изменений');
  const g2 = createGas(CODE, mkSets({ noCol: true }));
  g2.sheets['Товари'].rows[0].push('Склад набору'); g2.sheets['Товари'].rows.slice(1).forEach(r => r.push(''));
  const c2 = catalog(g2);
  ok(c2.c.products.every(p => p.ks === undefined && p.kp === undefined && p.a === a.by[p.id].a), 'пустая колонка «Склад набору» ничего не меняет');
  ok(order(g, U(72), [{ id: 'SET-001', g: 0, q: 2 }], 270).ok === true, 'заказ SET-товара без колонки работает как раньше');
}
{
  const g = createGas(CODE, mkSets({ colName: '  склад   набору ' }));
  ok(catalog(g).by['SET-001'].kp === 140, 'заголовок с лишними пробелами и другим регистром находится');
  const g2 = createGas(CODE, mkSets({ colName: 'Склад набору (чернетка)' }));
  ok(catalog(g2).c.products.every(p => p.ks === undefined), 'не точный заголовок — колонка не читается');
}

console.log('Волна Б2, блок 2: пункт меню «Етап 9Б2: налаштувати»');
{
  const s = build();
  const h = s.sheets['Товари'][0];
  ['SET-001', 'SET-002', 'SET-003'].forEach(id => { const row = h.map(() => ''); row[0] = id; row[h.indexOf('Назва (UA)')] = id; row[h.indexOf('Тип')] = 'упаковка'; row[h.indexOf('Ціна за упаковку/шт')] = 100; row[h.indexOf('Наявність')] = 'є'; s.sheets['Товари'].push(row); });
  s.sheets['Налаштування'] = [['Ключ', 'Значення', 'Опис'], ['gift_from', 0, 'x'], ['hint_id', 'SET-002', 'моє']];
  const g = createGas(CODE, s);
  const res = g.call('stage9b2Setup');
  const T = table(g), k = T.head.indexOf('Склад набору');
  ok(res.ok === true && k >= 0 && T.head.filter(h => h === 'Склад набору').length === 1, 'колонка «Склад набору» создана', res);
  ok(T.byId('SET-001')[k] === 'SPS-001, SPS-006, SPS-007' && T.byId('SET-002')[k] === 'SPS-003, SPS-021, SPS-024' && T.byId('SET-003')[k] === 'SPS-012, SPS-009, SPS-014, SPS-010', 'состав SET-001…003 записан', [1, 2, 3].map(i => T.byId('SET-00' + i)[k]));
  ok(T.byId('SPS-001')[k] === '' && T.byId('SPS-021')[k] === '', 'другим товарам состав не пишется');
  const S = g.sheets['Налаштування'].rows;
  const get = key => (S.find(r => r[0] === key) || [])[1];
  ok(get('hint_tag') === 'для плову' && get('hint_text_ua') === 'До плову: набір спецій від батька — {ціна}' && get('hint_text_ru') === 'К плову: набор специй от отца — {цена}', 'недостающие настройки подсказки добавлены со значениями по умолчанию');
  ok(get('hint_id') === 'SET-002' && S.filter(r => r[0] === 'hint_id').length === 1 && get('gift_from') === 0, 'существующие настройки не тронуты и не задвоены');
  ok(S.filter(r => /^hint_/.test(r[0]) && r[0] !== 'hint_id').every(r => String(r[2]).length > 20), 'у новых строк есть описание');
  const snap1 = snap(g, ['Журнал']);
  const res2 = g.call('stage9b2Setup');
  ok(res2.ok === true && snap(g, ['Журнал']) === snap1, 'повторный запуск ничего не меняет (идемпотентно)');
  table(g).byId('SET-002')[k] = 'SPS-003';
  g.call('stage9b2Setup');
  ok(table(g).byId('SET-002')[k] === 'SPS-003', 'заполненная ячейка состава не перезаписывается');
  const g2 = createGas(CODE, build());
  const r3 = g2.call('stage9b2Setup');
  ok(r3.ok === true && !g2.sheets['Налаштування'] && table(g2).head.includes('Склад набору'), 'нет листа «Налаштування»: не создаётся, колонка создаётся');
  ok(/немає в таблиці 3/.test(r3.message), 'итог сообщает, что наборов в таблице нет', r3.message);
  ok(Array.isArray(g2.sandbox.S9B2_STEPS) && g2.sandbox.S9B2_STEPS.length >= 2, 'шаги меню — список (расширяемый)');
  // Работа под блокировкой: при занятой блокировке ничего не пишется.
  const g3 = createGas(CODE, build());
  g3.sandbox.LockService = { getScriptLock: () => ({ tryLock: () => false, releaseLock() {}, waitLock() {} }) };
  const before = snap(g3);
  const r4 = g3.call('stage9b2Setup');
  ok(r4.ok === false && r4.error === 'busy' && snap(g3) === before, 'блокировка занята: отказ, таблица не тронута');
}

console.log('Волна Б2, блок 2: подсказка в корзине (shop.hint)');
{
  const g = createGas(CODE, mkSets());
  const a = catalog(g);
  ok(a.c.shop.hint && a.c.shop.hint.tag === 'для плову' && a.c.shop.hint.id === 'SET-001', 'значения по умолчанию: тег «для плову», товар SET-001', a.c.shop.hint);
  ok(a.c.shop.hint.ua === 'До плову: набір спецій від батька — 135' + NB + '₴' && a.c.shop.hint.ru === 'К плову: набор специй от отца — 135' + NB + '₴', 'цена подставлена сервером из таблицы вместо {ціна} / {цена}', a.c.shop.hint);
  ok(Object.keys(a.c.shop.hint).sort().join() === 'id,ru,tag,ua', 'в shop.hint ровно поля tag, id, ua, ru');
  const g1 = createGas(CODE, mkSets({ p1: 1250 }));
  ok(catalog(g1).c.shop.hint.ua.endsWith('1' + NB + '250' + NB + '₴'), 'тысячи — через пробел: «1 250 ₴»', catalog(g1).c.shop.hint.ua);
  const mkS = rowsExtra => mkSets({ settings: [['Ключ', 'Значення', 'Опис']].concat(rowsExtra) });
  ['hint_tag', 'hint_id', 'hint_text_ua', 'hint_text_ru'].forEach(k => {
    const gg = createGas(CODE, mkS([[k, '', '']]));
    const cc = catalog(gg);
    ok(cc.c.shop.hint === undefined && cc.text.indexOf('"hint"') < 0, 'пустая настройка ' + k + ' — подсказки нет');
  });
  const gc = createGas(CODE, mkS([['hint_id', 'kit-a', ''], ['hint_tag', ' Для  Плову ', ''], ['hint_text_ua', 'Додайте за {ціна} або {цена}', ''], ['hint_text_ru', 'Добавьте за {цена} / {ціна}', '']]));
  const hc = catalog(gc).c.shop.hint;
  ok(hc && hc.id === 'KIT-A' && hc.tag === 'для плову' && hc.ua === 'Додайте за 50' + NB + '₴ або 50' + NB + '₴' && hc.ru === 'Добавьте за 50' + NB + '₴ / 50' + NB + '₴', 'свой товар и текст; тег как у «Теги» (нижний регистр); оба плейсхолдера в обоих языках', hc);
  const unavailable = { 'KIT-X': 'немає', 'KIT-H': 'скрыт', 'NOPE-1': 'нет в таблице', 'SET-004': 'набор с «немає» в составе', 'SET-007': 'набор на себя', 'KIT-P': 'без цены', 'SPS-001': 'цена неоднозначна' };
  Object.keys(unavailable).forEach(id => {
    const gu = createGas(CODE, mkS([['hint_id', id, '']]));
    ok(catalog(gu).c.shop.hint === undefined, 'товар подсказки недоступен (' + unavailable[id] + ') — подсказки нет');
  });
  ok(catalog(createGas(CODE, build())).c.shop.hint === undefined, 'по умолчанию, пока SET-001 нет в таблице — подсказки нет');
  ok(order(g, U(73), [{ id: 'SET-001', g: 0, q: 1 }], 135).ok === true && order(g, U(73), [{ id: 'SET-001', g: 0, q: 1 }], 1).error === 'changed', 'заказ товара подсказки — по цене таблицы');
  ok(!/СЕКРЕТ|do-smaku/.test(JSON.stringify(a.c.shop)), 'в shop нет служебных данных');
}

/* ============================ Волна Б2, блок 3: сообщения после заказа ============================ */
const FUD = 86400000;
let updB = 5000;
const tgB = (g, update) => g.post(Object.assign({ update_id: ++updB }, update), { src: 'tg', key: 'whsec' });
const msgB = (g, uid, text, extra) => tgB(g, { message: Object.assign({ chat: { id: uid, type: 'private' }, from: { id: uid, first_name: 'Олена', last_name: 'Т', username: 'olena', language_code: 'uk' }, text }, extra || {}) });
const toChat = (g, chat, from) => g.sent.slice(from || 0).filter(m => m.method === 'sendMessage' && String(m.payload.chat_id) === String(chat));
const OHEAD = ['№', 'Дата/час', 'Статус', 'Telegram user id', '@username', "Ім'я", 'Телефон', 'Доставка', 'Місто', 'Відділення НП', 'Оплата', 'Коментар', 'Товари', 'Сума, ₴', 'Мова', 'Джерело', 'Службове'];
const CHEAD = ['Chat id', "Ім'я", 'Мова', 'Перший вхід', 'Останній вхід', 'Відписка', 'Заблокував бота', 'Остання розсилка', 'Дата останньої розсилки'];
const isDateB = v => Object.prototype.toString.call(v) === '[object Date]';
const AGO = d => new Date(Date.now() - d * FUD);
/** Мир для проверок: заказы {num, uid, ago (дней назад), dn (дней назад «виконано»), status, lang, svc, source, total}, настройки, клиенты, рецепты. */
function fuWorld(o) {
  const s = build();
  s.sheets['Замовлення'] = [OHEAD].concat((o.orders || []).map(x => {
    const svc = x.svc === undefined ? { i: [['SPS-001', 50, 1]] } : x.svc;
    if (x.dn !== undefined) svc.dn = Date.now() - x.dn * FUD;
    return [x.num, AGO(x.ago === undefined ? x.dn : x.ago), x.status || 'виконано', String(x.uid), '', x.name || 'Клієнт ' + x.uid, x.phone || '+380501112233', x.delivery || 'самовивіз', x.city || '', x.branch || '', x.pay || 'при отриманні', '', 'Суміш × 1 = 700 ₴', x.total || 100, x.lang || 'ua', x.source || 'miniapp', JSON.stringify(svc)];
  }));
  if (o.props) Object.assign(s.props, o.props);
  if (o.sheets) Object.assign(s.sheets, o.sheets);
  if (o.settings) s.sheets['Налаштування'] = [['Ключ', 'Значення', 'Опис']].concat(Object.keys(o.settings).map(k => [k, o.settings[k], '']));
  if (o.clients) {
    const head = CHEAD.concat(o.clientCols || []);
    s.sheets['Клієнти'] = [head].concat(o.clients.map(c => {
      const r = head.map(() => '');
      r[0] = String(c.uid); r[2] = c.lang || 'ua';
      if (c.unsub) r[5] = 'так';
      if (c.blocked) r[6] = 'так';
      if (c.mail !== undefined) r[8] = AGO(c.mail);
      if (c.last !== undefined) r[head.indexOf('Останнє повідомлення')] = AGO(c.last);
      if (c.wait !== undefined) r[head.indexOf('Очікуємо відповідь')] = c.wait;
      return r;
    }));
  }
  if (o.recipes) s.sheets['Рецепти'] = [['ID', 'Назва (UA)', 'Название (RU)', 'Фото', 'Текст (UA)', 'Текст (RU)', 'Товари', 'Показувати']].concat(o.recipes);
  if (o.stops) s.sheets['Підписки'] = [['Дата', 'Telegram user id', 'Товар', 'Мова', 'Статус']].concat(o.stops.map(u => [new Date(), String(u), 'REMIND', '', 'стоп']));
  return createGas(o.code || CODE, s);
}
const svcB =(g, num) => JSON.parse(g.sheets['Замовлення'].rows.find(r => r[0] === num)[16] || '{}');
const clientB = (g, uid) => { const t = g.sheets['Клієнти']; if (!t) return null; const r = t.rows.slice(1).find(x => String(x[0]) === String(uid)); return r ? { r, h: t.rows[0] } : null; };
const F1_UA = 'Як вам замовлення? Якщо щось не так — напишіть нам, виправимо. А якщо сподобалося — будемо вдячні за кілька слів.';
const F1_RU = 'Как вам заказ? Если что-то не так — напишите нам, исправим. А если понравилось — будем благодарны за пару слов.';

console.log('Волна Б2, блок 3: followup1 (сроки, отметки, 0 = выкл)');
{
  const S1 = { followup1_days: 3 };
  const g = fuWorld({ settings: S1, clients: [{ uid: 501 }, { uid: 502, lang: 'ru' }], orders: [
    { num: 'P-0101', uid: 501, dn: 3.5 },                       // срок наступил полдня назад — шлём
    { num: 'P-0102', uid: 502, dn: 3.2, lang: 'ru' },
    { num: 'P-0103', uid: 503, dn: 1 },                         // срок не наступил
    { num: 'P-0104', uid: 504, dn: 7 },                         // позже окна 3 дня — пропуск
    { num: 'P-0105', uid: 505, ago: 3.4, svc: { i: [['SPS-001', 50, 1]] } }, // нет отметки «виконано» от бота — считаем от даты заказа
    { num: 'P-0106', uid: 506, dn: 3.5, status: 'новий' },      // не «виконано»
    { num: 'P-0107', uid: 507, dn: 3.5, source: 'miniapp test' } // тестовый
  ] });
  const r = g.call('followupJob_');
  ok(r.f1 === 3 && r.f2 === 0, 'followup1: ушло 3 сообщения (по dn, по dn для ru и по дате заказа без dn)', r);
  ok(toChat(g, 501)[0] && toChat(g, 501)[0].payload.text === F1_UA, 'текст UA дословно из задания', toChat(g, 501)[0] && toChat(g, 501)[0].payload.text);
  ok(toChat(g, 502)[0] && toChat(g, 502)[0].payload.text === F1_RU, 'текст RU дословно, язык берётся из заказа', toChat(g, 502)[0] && toChat(g, 502)[0].payload.text);
  ok(toChat(g, 505).length === 1, 'нет отметки «виконано»: срок считается от даты заказа');
  ok([503, 504, 506, 507].every(u => toChat(g, u).length === 0), 'срок не наступил / старше окна 3 дня / не «виконано» / тестовый — не шлём');
  ok(svcB(g, 'P-0101').f1 === 1 && svcB(g, 'P-0101').dn > 0 && svcB(g, 'P-0101').i.length === 1, 'отметка f1 в «Службове», остальное содержимое на месте');
  ok(svcB(g, 'P-0104').f1 === undefined && svcB(g, 'P-0103').f1 === undefined, 'пропущенным заказам отметка не ставится');
  const n = g.sent.length;
  ok(g.call('followupJob_').f1 === 0 && g.sent.length === n, 'второй запуск: ничего (один раз на заказ)');
  g.call('dailyJob');
  ok(toChat(g, 501).length === 1, 'dailyJob вызывает followup, повтора нет');
  const c = clientB(g, 501);
  ok(c && c.h.includes('Останнє повідомлення') && isDateB(c.r[c.h.indexOf('Останнє повідомлення')]), 'после отправки у клиента поставлена отметка «Останнє повідомлення» (колонка создана)');
  ok(/^P-0101;\d+;ua$/.test(c.r[c.h.indexOf('Очікуємо відповідь')]), 'и «Очікуємо відповідь» = номер заказа, время, язык', c.r[c.h.indexOf('Очікуємо відповідь')]);
  ok(g.sandbox.__errors.length === 0, 'в логах нет ошибок', g.sandbox.__errors);
}
{
  const o = { clients: [{ uid: 501 }], orders: [{ num: 'P-0101', uid: 501, dn: 3.5 }] };
  const a = fuWorld(Object.assign({}, o)); // нет листа «Налаштування»
  ok(a.call('followupJob_').f1 === 0 && toChat(a, 501).length === 0, 'нет настроек: по умолчанию выключено (как сейчас)');
  a.call('dailyJob');
  ok(!toChat(a, 501).some(m => m.payload.text === F1_UA), 'dailyJob без настроек followup1 не шлёт');
  ['0', '', 'abc', -3, 0].forEach(v => {
    const b = fuWorld(Object.assign({ settings: { followup1_days: v, followup2_days: v } }, o));
    ok(b.call('followupJob_').f1 === 0 && toChat(b, 501).length === 0, 'followup1_days = ' + JSON.stringify(v) + ' — выключено');
  });
  const c = fuWorld(Object.assign({ settings: { followup1_days: 1000 } }, { clients: o.clients, orders: [{ num: 'P-0101', uid: 501, dn: 60.5 }] }));
  ok(c.call('followupJob_').f1 === 1, 'очень большое значение ограничено 60 днями');
}

console.log('Волна Б2, блок 3: отписка, лимит 14 дней, «не нагадувати», окно 3 дня');
{
  const mk = cl => fuWorld({ settings: { followup1_days: 3 }, clients: cl, orders: [{ num: 'P-0101', uid: 501, dn: 3.5 }] });
  const un = mk([{ uid: 501, unsub: true }]);
  ok(un.call('followupJob_').f1 === 0 && toChat(un, 501).length === 0 && svcB(un, 'P-0101').f1 === undefined, 'отписка («Відписка» = так): не шлём и не отмечаем');
  const bl = mk([{ uid: 501, blocked: true }]);
  ok(bl.call('followupJob_').f1 === 0 && toChat(bl, 501).length === 0, 'клиент заблокировал бота — не шлём');
  const limW = fuWorld({ settings: { followup1_days: 3 }, clientCols: ['Останнє повідомлення', 'Очікуємо відповідь'], clients: [{ uid: 501, last: 5 }], orders: [{ num: 'P-0101', uid: 501, dn: 3.5 }] });
  ok(limW.call('followupJob_').f1 === 0 && toChat(limW, 501).length === 0 && svcB(limW, 'P-0101').f1 === undefined, 'писали 5 дней назад (лимит 14): не шлём, отметки нет');
  const mailed = mk([{ uid: 501, mail: 5 }]);
  ok(mailed.call('followupJob_').f1 === 0, 'рассылка 5 дней назад («Дата останньої розсилки») тоже считается несервисным сообщением');
  const old = fuWorld({ settings: { followup1_days: 3 }, clientCols: ['Останнє повідомлення', 'Очікуємо відповідь'], clients: [{ uid: 501, last: 15 }], orders: [{ num: 'P-0101', uid: 501, dn: 3.5 }] });
  ok(old.call('followupJob_').f1 === 1, 'писали 15 дней назад — можно');
  // лимит кончается внутри окна: пробуем в следующие дни
  const retry = fuWorld({ settings: { followup1_days: 3 }, clientCols: ['Останнє повідомлення', 'Очікуємо відповідь'], clients: [{ uid: 501, last: 12 }], orders: [{ num: 'P-0101', uid: 501, dn: 3.5 }] });
  ok(retry.call('followupJob_').f1 === 0, 'писали 12 дней назад: сегодня нельзя');
  retry.advance(2.2 * FUD);
  ok(retry.call('followupJob_').f1 === 1 && toChat(retry, 501).length === 1, 'через 2 дня лимит прошёл, окно ещё идёт — ушло');
  const late = fuWorld({ settings: { followup1_days: 3 }, clientCols: ['Останнє повідомлення', 'Очікуємо відповідь'], clients: [{ uid: 501, last: 12 }], orders: [{ num: 'P-0101', uid: 501, dn: 3.5 }] });
  late.advance(3 * FUD);
  ok(late.call('followupJob_').f1 === 0 && toChat(late, 501).length === 0 && svcB(late, 'P-0101').f1 === undefined, 'окно 3 дня вышло раньше, чем прошёл лимит — пропуск без отметки');
  const stop = fuWorld({ settings: { followup1_days: 3 }, stops: [501], clients: [{ uid: 501 }], orders: [{ num: 'P-0101', uid: 501, dn: 3.5 }] });
  ok(stop.call('followupJob_').f1 === 0, 'нажал «Більше не нагадувати» — не шлём');
  const nocl = fuWorld({ settings: { followup1_days: 3 }, orders: [{ num: 'P-0101', uid: 501, dn: 3.5 }] });
  ok(nocl.call('followupJob_').f1 === 1 && !nocl.sheets['Клієнти'], 'нет листа «Клієнти»: пишем, лист при этом не создаём');
  // отметка пишется под блокировкой
  const lk = fuWorld({ settings: { followup1_days: 3 }, clients: [{ uid: 501 }], orders: [{ num: 'P-0101', uid: 501, dn: 3.5 }] });
  lk.call('followupJob_');
  const wr = lk.lockLog.map((x, i) => ({ x, i })).filter(e => e.x.kind === 'sheet' && e.x.op !== 'read' && (e.x.sheet === 'Замовлення' || e.x.sheet === 'Клієнти'));
  const heldAt = i => lk.lockLog.slice(0, i).reduce((n, e) => e.kind === 'script' ? (e.op === 'release' ? n - 1 : (e.ok ? n + 1 : n)) : n, 0);
  ok(wr.length >= 2 && wr.every(e => heldAt(e.i) > 0), 'записи в «Замовлення» и «Клієнти» идут под блокировкой скрипта', wr.map(e => heldAt(e.i)));
}

console.log('Волна Б2, блок 3: ответ клиента админам');
{
  const g = fuWorld({ settings: { followup1_days: 3 }, clients: [{ uid: 501 }, { uid: 502 }], orders: [{ num: 'P-0101', uid: 501, dn: 3.5 }] });
  // админы: 902 — только «Статистика» (ответ не получает), 903 — «Замовлення: статуси»
  const h = g.sandbox.ADMIN_HEAD.slice();
  const arow = (id, role, perm, active) => { const r = h.map(() => ''); r[0] = id; r[h.indexOf('Роль')] = role; if (perm) r[h.indexOf(perm)] = 'так'; r[h.indexOf('Активний')] = active ? 'так' : ''; return r; };
  g.sheets['Адміни'] = new (g.sheets['Клієнти'].constructor)('Адміни', [h, arow('902', 'Менеджер', 'Статистика', true), arow('903', 'Менеджер', 'Замовлення: статуси', true), arow('904', 'Менеджер', 'Замовлення: статуси', false)], g.ops, g.lockLog);
  g.call('followupJob_');
  const n0 = g.sent.length;
  msgB(g, 502, 'Привіт');
  ok(toChat(g, 900, n0).length === 0, 'клиент, которому followup1 не слали, — ничего не пересылается');
  const n1 = g.sent.length;
  msgB(g, 501, '<b>Все ок</b> & дякую');
  const fw = toChat(g, 900, n1);
  ok(fw.length === 1 && fw[0].payload.parse_mode === 'HTML' && /P-0101/.test(fw[0].payload.text) && /Олена/.test(fw[0].payload.text), 'владелец получил ответ: имя, номер заказа', fw[0] && fw[0].payload.text);
  ok(fw[0].payload.text.indexOf('&lt;b&gt;Все ок&lt;/b&gt; &amp; дякую') > 0 && fw[0].payload.text.indexOf('<b>Все ок') < 0, 'текст клиента экранирован');
  ok(toChat(g, 903, n1).length === 1 && toChat(g, 902, n1).length === 0 && toChat(g, 904, n1).length === 0, 'получают только активные админы с правом «Замовлення: статуси»');
  const thanks = toChat(g, 501, n1);
  ok(thanks.length === 1 && thanks[0].payload.text === 'Дякуємо, передали', 'клиенту «Дякуємо, передали»', thanks.map(m => m.payload.text));
  const c = clientB(g, 501);
  ok(c.r[c.h.indexOf('Очікуємо відповідь')] === '', 'ожидание ответа снято');
  const n2 = g.sent.length;
  msgB(g, 501, 'ще одне речення');
  ok(toChat(g, 900, n2).length === 1 && toChat(g, 501, n2).length === 0, 'следующая строка в течение 15 минут тоже уходит админам, благодарность не повторяется');
  g.clearCache();
  const n3 = g.sent.length;
  msgB(g, 501, 'через день');
  ok(toChat(g, 900, n3).filter(x => /Відповідь клієнта/.test(x.payload.text)).length === 0 && g.sent.slice(n3).some(m => String(m.payload.chat_id) === '501'), 'после окна 15 минут сообщение идёт обычным путём бота (привітання), админам не пересылается');
  // истёкшее ожидание и сообщения админов
  const g2 = fuWorld({ settings: { followup1_days: 3 }, clientCols: ['Останнє повідомлення', 'Очікуємо відповідь'], clients: [{ uid: 501, wait: 'P-0101;' + (Date.now() - 8 * FUD) + ';ua' }, { uid: 900, wait: 'P-0101;' + Date.now() + ';ua' }], orders: [] });
  const m0 = g2.sent.length;
  msgB(g2, 501, 'пізно');
  ok(toChat(g2, 900, m0).length === 0, 'ответ позже 7 дней не пересылается');
  ok(clientB(g2, 501).r[clientB(g2, 501).h.indexOf('Очікуємо відповідь')] === '', 'устаревшее ожидание очищено');
  const m1 = g2.sent.length;
  msgB(g2, 900, 'я адмін');
  ok(toChat(g2, 900, m1).every(x => !/Відповідь клієнта/.test(x.payload.text)), 'сообщения самих админов не пересылаются');
  // команда и отзыв не перехватываются
  const g3 = fuWorld({ clientCols: ['Останнє повідомлення', 'Очікуємо відповідь'], clients: [{ uid: 501, wait: 'P-0101;' + Date.now() + ';ua' }], orders: [] });
  const k0 = g3.sent.length;
  msgB(g3, 501, '/start');
  ok(toChat(g3, 900, k0).every(x => !/Відповідь клієнта/.test(x.payload.text)), 'команда /start не считается ответом');
  g3.sandbox.CacheService.getScriptCache().put('rvt_501', 'P-0101', 900);
  msgB(g3, 501, 'текст отзыва');
  ok(toChat(g3, 900, k0).every(x => !/Відповідь клієнта/.test(x.payload.text)), 'пока клиент пишет отзыв (после оценки), существующий сценарий отзывов не ломается');
  // никто из админов не получил: обычная обработка
  const g4 = fuWorld({ clientCols: ['Останнє повідомлення', 'Очікуємо відповідь'], clients: [{ uid: 501, wait: 'P-0101;' + Date.now() + ';ua' }], orders: [] });
  g4.setTelegramFail((method, p) => (method === 'sendMessage' && String(p.chat_id) === '900' ? { ok: false, error_code: 400, description: 'bad' } : null));
  msgB(g4, 501, 'Привіт');
  const c4 = clientB(g4, 501);
  ok(/^P-0101;/.test(c4.r[c4.h.indexOf('Очікуємо відповідь')]), 'если доставить админам не удалось, ожидание остаётся (клиенту не обещаем зря)');
}

console.log('Волна Б2, блок 3: followup2 (рецепт, кнопка, startapp re-…)');
{
  const REC = [['R1', 'Плов', 'Плов RU', '', 'Текст плову <b>UA</b>', 'Текст плова RU', 'SPS-001, SPS-021', 'так'], ['R2', 'Приховано', '', '', 'x', '', 'SPS-001', ''], ['R3', 'Чужий', '', '', 'y', '', 'NUT-013', 'так']];
  const g = fuWorld({ settings: { followup2_days: 21 }, clients: [{ uid: 501 }, { uid: 502, lang: 'ru' }, { uid: 503 }], recipes: REC, orders: [
    { num: 'P-0101', uid: 501, dn: 21.5 },
    { num: 'P-0102', uid: 502, dn: 21.5, lang: 'ru' },
    { num: 'P-0103', uid: 503, dn: 21.5, svc: { i: [['NUT-024', 100, 1]] } } // рецепта к этому товару нет
  ] });
  const r = g.call('followupJob_');
  ok(r.f2 === 3 && r.f1 === 0, 'followup2 ушёл 3 клиентам', r);
  const m1 = toChat(g, 501)[0].payload;
  ok(m1.text === 'Плов\n\nТекст плову <b>UA</b>' && !m1.parse_mode, 'рецепт, связанный с купленным (скрытые и чужие не берутся); текст как есть, без разметки', m1.text);
  ok(m1.reply_markup.inline_keyboard[0][0].text === 'Повторити замовлення' && m1.reply_markup.inline_keyboard[0][0].url === 'https://t.me/pamir_spices_bot/shop?startapp=re-0101', 'кнопка «Повторити замовлення» ведёт на t.me/pamir_spices_bot/shop?startapp=re-0101', m1.reply_markup.inline_keyboard[0][0]);
  ok(m1.reply_markup.inline_keyboard[1][0].callback_data === 'nr', 'есть «Більше не нагадувати»');
  const m2 = toChat(g, 502)[0].payload;
  ok(m2.text === 'Плов RU\n\nТекст плова RU' && m2.reply_markup.inline_keyboard[0][0].text === 'Повторить заказ' && m2.reply_markup.inline_keyboard[1][0].text === 'Больше не напоминать', 'RU: название и текст рецепта, кнопки по-русски');
  const m3 = toChat(g, 503)[0].payload;
  ok(m3.text === g.sandbox.SETTINGS_DEF.find(d => d[0] === 'followup2_text_ua')[2] && m3.reply_markup.inline_keyboard[0][0].url.endsWith('startapp=re-0103'), 'нет рецепта — короткий текст из followup2_text_ua (по умолчанию) и та же кнопка');
  ok(svcB(g, 'P-0101').f2 === 1 && g.call('followupJob_').f2 === 0, 'отметка f2, второй запуск ничего не шлёт');
  ok(g.sandbox.fuStartParam_('P-0012') === 're-0012' && /^[A-Za-z0-9_-]{1,64}$/.test(g.sandbox.fuStartParam_('P-123456789')) && g.sandbox.fuStartParam_('X-1') === '' && g.sandbox.fuStartParam_('P-12; DROP') === '' && g.sandbox.fuStartParam_('P-1234567890') === '', 'startapp: P-<цифры> → re-<цифры>; иное → пусто');
  // свои тексты, пустой текст
  const own = fuWorld({ settings: { followup2_days: 21, followup2_text_ua: 'Свій текст', followup2_text_ru: '' }, clients: [{ uid: 502, lang: 'ru' }], orders: [{ num: 'P-0102', uid: 502, dn: 21.5, lang: 'ru', svc: { i: [['NUT-024', 100, 1]] } }] });
  own.call('followupJob_');
  ok(toChat(own, 502)[0].payload.text === 'Свій текст', 'RU пуст — берётся UA-текст из настроек');
  const none = fuWorld({ settings: { followup2_days: 21, followup2_text_ua: '', followup2_text_ru: '' }, clients: [{ uid: 503 }], orders: [{ num: 'P-0103', uid: 503, dn: 21.5, svc: { i: [['NUT-024', 100, 1]] } }] });
  ok(none.call('followupJob_').f2 === 0 && toChat(none, 503).length === 0 && svcB(none, 'P-0103').f2 === undefined, 'нет рецепта и пустой текст — не шлём, отметки нет');
  // рецепт, главный ингредиент которого закончился, не виден (как на витрине)
  const out = fuWorld({ settings: { followup2_days: 21, followup2_text_ua: '', followup2_text_ru: '' }, clients: [{ uid: 503 }], recipes: [['R1', 'Лагман', '', '', 'Текст', '', 'DRY-005, SPS-001', 'так']], orders: [{ num: 'P-0103', uid: 503, dn: 21.5 }] });
  ok(out.call('followupJob_').f2 === 0, 'рецепт с главным ингредиентом «немає» не используется');
  // номер не вида P-<цифры>: кнопка ведёт в «Мої замовлення»
  const odd = fuWorld({ settings: { followup2_days: 21 }, clients: [{ uid: 503 }], orders: [{ num: 'X-77', uid: 503, dn: 21.5 }] });
  odd.call('followupJob_');
  const b = toChat(odd, 503)[0].payload.reply_markup.inline_keyboard[0][0];
  ok(b.web_app && /view=orders/.test(b.web_app.url) && !b.url, 'нестандартный номер: кнопка открывает «Мої замовлення», startapp не строится');
  // клиент уже заказал снова
  const again = fuWorld({ settings: { followup2_days: 21 }, clients: [{ uid: 501 }], orders: [{ num: 'P-0101', uid: 501, dn: 21.5 }, { num: 'P-0102', uid: 501, ago: 5, status: 'новий' }] });
  ok(again.call('followupJob_').f2 === 0, 'после этого заказа клиент уже заказывал — «Повторити замовлення» не зовём');
  // лимит, отписка
  const lim = fuWorld({ settings: { followup2_days: 21 }, clientCols: ['Останнє повідомлення', 'Очікуємо відповідь'], clients: [{ uid: 501, last: 3 }, { uid: 502, unsub: true }], orders: [{ num: 'P-0101', uid: 501, dn: 21.5 }, { num: 'P-0102', uid: 502, dn: 21.5 }] });
  ok(lim.call('followupJob_').f2 === 0, 'followup2 тоже уважает лимит 14 дней и отписку');
  const win = fuWorld({ settings: { followup2_days: 21 }, orders: [{ num: 'P-0101', uid: 501, dn: 25 }, { num: 'P-0102', uid: 502, dn: 10 }] });
  ok(win.call('followupJob_').f2 === 0, 'старые и ещё не созревшие заказы не получают followup2');
  ok(g.sandbox.__errors.length === 0, 'в логах нет ошибок', g.sandbox.__errors);
}

console.log('Волна Б2, блок 3: взаимоисключение с review_days и remind_days');
{
  // followup1 и просьба об отзыве по одному заказу — только одно
  const mk = s => fuWorld({ settings: Object.assign({ review_days: 2 }, s), clients: [{ uid: 501 }], orders: [{ num: 'P-0101', uid: 501, dn: 3.2 }] });
  const a = mk({ followup1_days: 3 });
  ok(a.call('followupJob_').f1 === 1 && a.call('askReviews_') === 0 && !toChat(a, 501).some(m => m.payload.reply_markup && /rv:/.test(JSON.stringify(m.payload.reply_markup))), 'followup1 ушёл → просьбу об отзыве по этому заказу не шлём');
  const b = mk({ followup1_days: 3 });
  ok(b.call('askReviews_') === 0 && toChat(b, 501).length === 0 && b.call('followupJob_').f1 === 1, 'followup1_days > 0: askReviews_ не шлёт вовсе (review_days = 2 не блокирует followup1), followup1 уходит');
  ok(svcB(b, 'P-0101').rv === undefined, 'askReviews_ при followup1 > 0 не ставит и отметку rv');
  const c = mk({ followup1_days: 0 });
  ok(c.call('askReviews_') === 1, 'followup1 выключен: отзывы работают как раньше');
  const c2 = mk({});
  ok(c2.call('askReviews_') === 1, 'followup1_days не задан: отзывы работают как раньше');
  // оценка приходит по старым кнопкам rv:, даже когда followup1 включён
  const d = mk({ followup1_days: 3 });
  const rr = d.call('reviewRate_', 'P-0101', 501, 4, 'Олена');
  ok(Array.isArray(rr) && rr.length === 1, 'сценарий приёма оценок (reviewRate_) при followup1 > 0 не сломан', rr);
  // remind_days и followup2
  const base = { clients: [{ uid: 501 }], orders: [{ num: 'P-0101', uid: 501, dn: 9, svc: { i: [['SPS-001', 50, 1]] } }] };
  const old = fuWorld(Object.assign({ settings: { remind_days: 7 } }, base));
  ok(old.call('remindRepeat_') === 1, 'оба followup = 0: remind_days работает как раньше');
  const both = fuWorld(Object.assign({ settings: { remind_days: 7, followup2_days: 21 } }, base));
  ok(both.call('remindRepeat_') === 0 && toChat(both, 501).length === 0, 'followup2_days > 0: старое напоминание remind_days не шлётся');
  const only1 = fuWorld(Object.assign({ settings: { remind_days: 7, followup1_days: 3 } }, base));
  ok(only1.call('remindRepeat_') === 1, 'включён только followup1: remind_days остаётся как был');
  const rm = fuWorld({ settings: { followup2_days: 21 }, clients: [{ uid: 501 }], orders: [{ num: 'P-0101', uid: 501, dn: 21.5, svc: { i: [['SPS-001', 50, 1]], rm: 1 } }] });
  ok(rm.call('followupJob_').f2 === 0, 'по заказу уже было старое напоминание (rm) — followup2 не шлём');
}

console.log('Волна Б2, блок 3: общая отметка несервисных сообщений');
{
  const cols = ['Останнє повідомлення', 'Очікуємо відповідь'];
  const g = fuWorld({ settings: { remind_days: 7, review_days: 2 }, clientCols: cols, clients: [{ uid: 501 }, { uid: 502 }], orders: [
    { num: 'P-0101', uid: 501, dn: 9 }, { num: 'P-0102', uid: 502, dn: 3 }] });
  g.call('remindRepeat_');
  ok(isDateB(clientB(g, 501).r[clientB(g, 501).h.indexOf('Останнє повідомлення')]), 'remindRepeat_ ставит отметку после отправки');
  g.call('askReviews_');
  ok(isDateB(clientB(g, 502).r[clientB(g, 502).h.indexOf('Останнє повідомлення')]), 'askReviews_ ставит отметку после отправки');
  g.post({ action: 'cart', initData: g.initData(U(503)), items: [['DRY-039', 500, 2]], lang: 'ua' });
  g.sheets['Кошики'].rows[1][1] = AGO(0.2);
  g.sheets['Клієнти'].rows.push(['503', '', 'ua', '', '', '', '', '', '', '', '']);
  g.call('remindCarts_');
  ok(toChat(g, 503).length === 1 && isDateB(clientB(g, 503).r[clientB(g, 503).h.indexOf('Останнє повідомлення')]), 'remindCarts_ ставит отметку после отправки');
  // отметка не меняет «слать/не слать» у старых сообщений
  const g2 = fuWorld({ settings: { remind_days: 7 }, clientCols: cols, clients: [{ uid: 501, last: 1 }], orders: [{ num: 'P-0101', uid: 501, dn: 9 }] });
  ok(g2.call('remindRepeat_') === 1, 'remindRepeat_ шлёт и при свежей отметке (его собственная логика не менялась)');
  // нет листа «Клієнти»: ничего не создаётся
  const g3 = fuWorld({ settings: { remind_days: 7 }, orders: [{ num: 'P-0101', uid: 501, dn: 9 }] });
  g3.call('remindRepeat_');
  ok(!g3.sheets['Клієнти'], 'нет листа «Клієнти»: отметку негде ставить, лист не создаётся');
  // рассылка: лимит смотрит и на «Дата останньої розсилки»
  ok(g.sandbox.fuGate_({ last: Date.now() - 2 * FUD }, Date.now()).why === 'limit' && g.sandbox.fuGate_({ last: Date.now() - 15 * FUD }, Date.now()).ok && g.sandbox.fuGate_(undefined, Date.now()).ok, 'fuGate_: лимит 14 дней, нет записи — можно');
}

console.log('Волна Б2, блок 3: re-… не источник, «Повторити замовлення» (orders.my)');
{
  const g = fuWorld({ settings: { src_list: 'qr1,re-0101,insert' }, orders: [] });
  ok(g.sandbox.srcLabel_('re-0101', null, true) === '' && g.sandbox.srcLabel_('re-0101', null, false) === '' && g.sandbox.srcLabel_('re-12', {}, true) === '', 're-… не метка источника, даже если записана в src_list');
  ok(g.sandbox.srcLabel_('qr1', null, true) === 'qr1' && g.sandbox.srcLabel_('insert', null, true) === 'insert', 'обычные метки работают как раньше');
  const ev = g.post({ action: 'ev', initData: g.initData(U(601)), sid: 's', events: [{ e: 'open', t: Date.now() }, { e: 'src', v: 're-0101', t: Date.now() }] });
  const evs = g.sheets['Події'] ? g.sheets['Події'].rows.slice(1) : [];
  ok(ev.ok && !evs.some(r => r[3] === 'src'), 'событие src с re-… не записывается');
  const o = order(g, U(601), [{ id: 'SPS-021', g: 0, q: 1 }], 50);
  const body = { action: 'order', initData: g.initData(U(602)), items: [{ id: 'SPS-021', g: 0, q: 1 }], total: 50, name: 'Олена', phone: '+380501234567', delivery: 'pickup', pay: 'cash', lang: 'ua', src: 're-0101', rid: 'rq1' };
  g.sheets['Замовлення'].rows[0].push('Джерело клієнта');
  g.sheets['Замовлення'].rows.slice(1).forEach(r => r.push(''));
  const o2 = g.post(body);
  const row = g.sheets['Замовлення'].rows.find(r => r[0] === o2.number);
  ok(o.ok && o2.ok && row[row.length - 1] === '', 'заказ с src = re-… не пишет «Джерело клієнта»', row[row.length - 1]);
}
{
  // «Мої замовлення»: состав своего заказа по номеру из startapp
  const many = [];
  for (let i = 1; i <= 25; i++) many.push({ num: 'P-' + String(100 + i).padStart(4, '0'), uid: 501, ago: 60 - i, svc: { i: [['SPS-001', 50, 1], ['NUT-013', 100, i]] } });
  many.push({ num: 'P-0200', uid: 777, ago: 3, svc: { i: [['DRY-039', 500, 1]] } });
  many.push({ num: 'P-0201', uid: 501, ago: 2, source: 'miniapp test' });
  const g = fuWorld({ orders: many });
  const my = (uid, extra) => g.post(Object.assign({ action: 'orders.my', initData: g.initData(U(uid)) }, extra || {}));
  const plain = my(501);
  ok(plain.ok && plain.orders.length === 20 && plain.one === undefined && Object.keys(plain).sort().join() === 'done,ok,orders', 'без num ответ прежний (20 заказов, без поля one)');
  const r = my(501, { num: 'P-0101' });
  ok(r.ok && r.orders.length === 20 && !r.orders.some(x => x.num === 'P-0101') && r.one && r.one.num === 'P-0101' && JSON.stringify(r.one.i) === JSON.stringify([['SPS-001', 50, 1], ['NUT-013', 100, 1]]), 'num старше последних 20: заказ отдаётся в поле one с составом i', r.one);
  const r2 = my(501, { num: 'P-0120' });
  ok(r2.one && r2.one.num === 'P-0120' && r2.orders.some(x => x.num === 'P-0120'), 'заказ из последних 20 тоже в one');
  ok(my(502, { num: 'P-0101' }).one === undefined && my(501, { num: 'P-0200' }).one === undefined, 'чужой заказ не отдаётся (ни в one, ни в orders)');
  ok(!my(501, { num: 'P-0200' }).orders.some(x => x.num === 'P-0200'), 'чужой заказ не попадает и в список');
  ok(my(501, { num: 'P-0201' }).one === undefined && my(501, { num: "P-1' OR 1" }).one === undefined && my(501, { num: ['P-0101'] }).one === undefined, 'тестовый заказ, мусорный номер и массив — ignore');
  ok(g.post({ action: 'orders.my', num: 'P-0101' }).error === 'bad_auth' && g.post({ action: 'orders.my', initData: 'hash=bad', num: 'P-0101' }).error === 'bad_auth', 'без подписи initData — отказ');
  const cut = JSON.stringify(r);
  ok(!/\"svc\"|СЕКРЕТ|do-smaku|33%/.test(cut) && Object.keys(r.one).sort().join() === 'branch,city,date,delivery,dl,i,items,num,paid,status,total,ttn', 'в one те же поля, что в списке, служебного нет', Object.keys(r.one));
}

console.log('Волна Б2, блок 12: синонимы поиска (shop.syn)');
{
  const long = 'я'.repeat(41), ok40 = 'я'.repeat(40);
  const mk = rows => { const s = build(); if (rows) s.sheets['Синоніми'] = rows; return createGas(CODE, s); };
  const a = catalog(mk());
  ok(a.c.shop.syn === undefined && a.text.indexOf('"syn"') < 0, 'нет листа «Синоніми» — поля shop.syn нет');
  ok(catalog(mk([['Слово', 'Що шукати']])).c.shop.syn === undefined, 'лист только с заголовками — поля нет');
  ok(catalog(mk([[], ['', '']])).c.shop.syn === undefined, 'пустой лист — поля нет');
  const b = catalog(mk([['Слово', 'Що шукати'], ['  Урюк ', ' КУРАГА '], ['абрикос', 'курага'], ["кешью", "кеш'ю"], ['Урюк', 'інше'], ['порожньо', ''], ['', 'порожньо'], ['те саме', 'Те   Саме'], [long, 'x'], ['x', long], [ok40, ok40.slice(1)], ['__proto__', 'x'], ['  Два   слова ', 'a  b']]));
  const syn = b.c.shop.syn;
  ok(syn && syn['урюк'] === 'курага' && syn['абрикос'] === 'курага' && syn['кешью'] === "кеш'ю", 'пары из листа: строчные, обрезанные', syn);
  ok(syn['два слова'] === 'a b' && Object.keys(syn).every(k => k === k.toLowerCase() && k === k.trim()), 'лишние пробелы схлопнуты, ключи строчные');
  ok(Object.keys(syn).length === 5 && syn[ok40] === ok40.slice(1) && syn[long] === undefined && syn['x'] === undefined, 'длиннее 40 знаков, пустые, «слово = слово» и __proto__ отброшены; ровно 40 — проходит; дубль — первая пара', Object.keys(syn));
  ok(Object.keys(syn).indexOf('__proto__') < 0 && !Object.prototype.hasOwnProperty.call(syn, '__proto__'), '__proto__ не попадает в ответ');
  const many = [['Слово', 'Що шукати']];
  for (let i = 0; i < 250; i++) many.push(['слово' + i, 'ціль' + i]);
  const c = catalog(mk(many)).c.shop.syn;
  ok(Object.keys(c).length === 200 && c['слово0'] === 'ціль0' && c['слово199'] === 'ціль199' && c['слово200'] === undefined, 'не больше 200 пар (первые 200)');
  const d = catalog(mk([['кава', 'кофе'], ['чай', 'чай зелений']])).c.shop.syn;
  ok(d && d['кава'] === 'кофе' && d['чай'] === 'чай зелений', 'лист без строки заголовков: первая строка — тоже пара');
  const e = catalog(mk([['Слово', 'Що шукати'], ['=cmd()', '=HYPERLINK("x")']])).c.shop.syn;
  ok(e && e['=cmd()'] === '=hyperlink("x")', 'значения отдаются как текст (в таблицу это не пишется)');
  ok(!/СЕКРЕТ|do-smaku|33%/.test(b.text) && !/:999[,}]|:111[,}]|:222[,}]/.test(b.text), 'служебные колонки не утекают');
  const old = createGas(CODE, build()); // как со старым бэкендом: каталог без листа тот же, что был
  ok(catalog(old).c.products.length === a.c.products.length, 'каталог без листа не изменился');
}

console.log('Волна Б2, блок 12: «Шукали й не знайшли» за 30 дней');
{
  const g = createGas(CODE, build());
  const now = Date.now();
  const evPost2 = (uid, events) => g.post({ action: 'ev', initData: g.initData(U(uid)), sid: 's' + uid, events });
  ok(evPost2(801, [{ e: 'open', t: now }, { e: 'search0', v: 'Кава в зернах', t: now }, { e: 'search0', v: 'кава в зернах', t: now }]).ok && evPost2(802, [{ e: 'open', t: now }, { e: 'search0', v: 'кава в зернах', t: now }, { e: 'search0', v: 'шафран', t: now }]).ok, 'события search0 приняты');
  const ev = g.sheets['Події'];
  ev.rows.push([AGO(31), '803', 'old', 'search0', '', 'давній запит']); // старше 30 дней
  ev.rows.push([AGO(29), '803', 'mid', 'search0', '', 'запит 29 днів']);
  const st = g.call('salesStats_', false);
  const zero = st.funnel && st.funnel.zero;
  ok(zero && zero[0].q === 'кава в зернах' && zero[0].n === 3 && zero.some(x => x.q === 'шафран' && x.n === 1), 'в воронке «не нашли»: запросы по убыванию, регистр не важен', zero);
  ok(zero.some(x => x.q === 'запит 29 днів') && !zero.some(x => x.q === 'давній запит'), 'период 30 дней: 29 дней назад — есть, 31 — нет');
  // быстрый режим: событие идёт через буфер и доходит до листа
  const f = createGas(CODE, build());
  f.props.FAST_MODE = '1';
  f.call('flushJob');
  f.post({ action: 'ev', initData: f.initData(U(804)), sid: 'f', events: [{ e: 'open', t: Date.now() }, { e: 'search0', v: 'Буферний запит', t: Date.now() }] });
  ok(!f.sheets['Події'] || !f.sheets['Події'].rows.some(r => r[3] === 'search0'), 'в быстром режиме запрос пока в буфере');
  f.call('flushJob');
  ok(f.sheets['Події'].rows.some(r => r[3] === 'search0' && r[5] === 'Буферний запит'), 'после flushJob search0 в листе «Події»', f.sheets['Події'].rows);
  const z2 = f.call('salesStats_', false).funnel.zero;
  ok(z2.length === 1 && z2[0].q === 'буферний запит' && z2[0].n === 1, 'и в «Шукали й не знайшли» (запрос в нижнем регистре)', z2);
  ok(!/=cmd/.test(JSON.stringify(g.call('salesStats_', false).funnel)), 'в воронке только запросы и числа');
}

console.log('Волна Б2, блок 12: «Якщо товару немає» (ifOut)');
{
  const post = (g, uid, extra, rid) => g.post(Object.assign({ action: 'order', initData: g.initData(U(uid)), items: [{ id: 'SPS-021', g: 0, q: 1 }], total: 50, name: 'Олена', phone: '+380501234567', delivery: 'pickup', pay: 'cash', lang: 'ua', rid: rid || ('io' + Math.random()) }, extra));
  const withCol = () => { const s = build(); s.sheets['Замовлення'] = [OHEAD.concat(['Якщо немає'])]; return createGas(CODE, s); };
  const g = withCol();
  const vals = { call: 'Зателефонувати', replace: 'Замінити схожим', remove: 'Прибрати із замовлення' };
  Object.keys(vals).forEach((k, i) => {
    const n0 = g.sent.length;
    const r = post(g, 810 + i, { ifOut: k });
    const row = g.sheets['Замовлення'].rows.find(x => x[0] === r.number);
    const adm = toChat(g, 900, n0)[0];
    ok(r.ok && row[row.length - 1] === vals[k] && row[13] === 50 && adm.payload.text.indexOf('Якщо немає: ' + vals[k]) > 0, 'ifOut = ' + k + ': в колонку «Якщо немає» пишется «' + vals[k] + '», админу строка, сумма 50 ₴ не изменилась');
  });
  const junk = ['x', 5, null, {}, ['call'], 'CALL', ' call', 'call ', true, '', 'Зателефонувати', '__proto__'];
  junk.forEach((v, i) => {
    const n0 = g.sent.length;
    const r = post(g, 830 + i, { ifOut: v });
    const row = g.sheets['Замовлення'].rows.find(x => x[0] === r.number);
    const adm = toChat(g, 900, n0)[0];
    if (!(r.ok && row[row.length - 1] === '' && row[13] === 50 && adm.payload.text.indexOf('Якщо немає') < 0)) ok(false, 'мусорный ifOut ' + JSON.stringify(v) + ' игнорируется', [r, row]);
  });
  ok(true, 'мусор в ifOut (12 вариантов) игнорируется: колонка пуста, строки у админа нет, сумма та же');
  const n1 = g.sent.length;
  const r0 = post(g, 850, {});
  ok(r0.ok && g.sheets['Замовлення'].rows.find(x => x[0] === r0.number).slice(-1)[0] === '' && toChat(g, 900, n1)[0].payload.text.indexOf('Якщо немає') < 0, 'без ifOut всё как раньше');
  // после смены статуса строка остаётся
  const rr = post(g, 851, { ifOut: 'replace' });
  tgB(g, { callback_query: { id: 'cqx', data: 'st:' + rr.number + ':c', from: { id: 900, first_name: 'Адм', language_code: 'uk' }, message: { message_id: 7, chat: { id: 900 } } } });
  const edits = g.sent.filter(m => m.method === 'editMessageText' && /Якщо немає: Замінити схожим/.test(m.payload.text));
  ok(edits.length >= 1, 'после смены статуса сообщение админам по-прежнему содержит «Якщо немає»');
  // без колонки
  const g2 = createGas(CODE, build());
  const n2 = g2.sent.length;
  const r2 = post(g2, 860, { ifOut: 'remove' });
  const row2 = g2.sheets['Замовлення'].rows.find(x => x[0] === r2.number);
  ok(r2.ok && row2[13] === 50 && !g2.sheets['Замовлення'].rows[0].includes('Якщо немає') && toChat(g2, 900, n2)[0].payload.text.indexOf('Якщо немає: Прибрати із замовлення') > 0, 'нет колонки «Якщо немає»: заказ проходит, колонка не создаётся, выбор виден админу в тексте');
  const n3 = g2.sent.length;
  tgB(g2, { callback_query: { id: 'cqy', data: 'st:' + r2.number + ':c', from: { id: 900, first_name: 'Адм', language_code: 'uk' }, message: { message_id: 8, chat: { id: 900 } } } });
  ok(g2.sent.slice(n3).some(m => m.method === 'editMessageText' && /Якщо немає: Прибрати із замовлення/.test(m.payload.text)), 'без колонки выбор сохраняется в служебной ячейке и виден после смены статуса');
  ok(JSON.parse(row2[16]).io === 'remove', 'код выбора в «Службове»');
  // сумма и проверка цен не зависят от ifOut
  ok(post(g2, 861, { ifOut: 'call', total: 49 }).error === 'changed' && post(g2, 862, { ifOut: 'call', total: 50 }).ok, 'сумму по-прежнему считает сервер: неверная сумма отклоняется при любом ifOut');
  const k = catalog(g2);
  ok(k.c.shop.ifo === 1 && k.text.indexOf('"ifo":1') > 0, 'shop.ifo = 1: бэкенд умеет «Якщо немає»');
  // утечка и журнал
  const text = JSON.stringify(g.sent.map(m => m.payload));
  ok(!/СЕКРЕТ|do-smaku|33%/.test(text), 'в сообщениях бота нет служебных колонок');
  const my = g.post({ action: 'orders.my', initData: g.initData(U(810)) });
  ok(my.ok && my.orders.length === 1 && !/Зателефонувати|"io"/.test(JSON.stringify(my)), '«Мої замовлення» выбор не отдаёт и служебную ячейку не раскрывает');
}

console.log('Волна Б2, блок 12: утренняя сводка (digest_hour)');
{
  const hourKyiv = () => Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Kyiv', hour: '2-digit', hour12: false }).format(new Date())) % 24;
  const H = hourKyiv();
  const world = (extra, hour) => {
    const w = fuWorld(Object.assign({ settings: { digest_hour: hour === undefined ? H : hour }, orders: [
      { num: 'P-0301', uid: 1, ago: 1, status: 'новий', total: 100 },
      { num: 'P-0302', uid: 2, ago: 1, status: 'підтверджено', total: 250 },
      { num: 'P-0303', uid: 3, ago: 1, status: 'скасовано', total: 700 },
      { num: 'P-0304', uid: 4, ago: 1, status: 'немає в наявності', total: 800 },
      { num: 'P-0305', uid: 5, ago: 1, status: 'новий', total: 900, source: 'miniapp test' },
      { num: 'P-0306', uid: 6, ago: 5, status: 'підтверджено', total: 410 },
      { num: 'P-0307', uid: 7, ago: 5, status: 'відправлено', total: 120 },
      { num: 'P-0308', uid: 8, ago: 0, status: 'новий', total: 130 }
    ] }, extra || {}));
    const h = w.sandbox.ADMIN_HEAD.slice();
    const arow = (id, role, perm, active) => { const r = h.map(() => ''); r[0] = id; r[h.indexOf('Роль')] = role; if (perm) r[h.indexOf(perm)] = 'так'; r[h.indexOf('Активний')] = active ? 'так' : ''; return r; };
    w.sheets['Адміни'] = new (w.sheets['Замовлення'].constructor)('Адміни', [h, arow('902', 'Менеджер', 'Статистика', true), arow('903', 'Менеджер', 'Замовлення: статуси', true), arow('904', 'Менеджер', 'Статистика', false), arow('905', 'Адмін', '', true)], w.ops, w.lockLog);
    return w;
  };
  const g = world();
  const dig = () => g.sent.filter(m => m.method === 'sendMessage' && /Зведення PAMIR|Вчора замовлень не було/.test(m.payload.text));
  g.call('hourlyJob');
  const d = dig();
  const chats = d.map(m => String(m.payload.chat_id)).sort().join();
  ok(chats === '900,902,905', 'сводка уходит владельцу, админу и менеджеру с правом «Статистика»; без права и неактивным — нет', chats);
  const t = d[0].payload.text;
  ok(/Вчора: замовлень 2 на 350 ₴/.test(t.replace(/ /g, ' ')), 'вчера: 2 заказа на 350 ₴ (новий + підтверджено)');
  ok(/Відправити сьогодні \(2\)/.test(t) && /P-0302/.test(t) && /P-0306/.test(t) && !/P-0307/.test(t) && !/P-0301/.test(t), 'что отправить сегодня: только подтверждённые, не отправленные', t);
  ok(/Закінчилось \(\d+\):.*Манго сушене/.test(t) && !/Прихований товар/.test(t), 'что закончилось («немає»), скрытые не показываются');
  ok(/Чекають ціни \(\d+\):.*Абрикос сушений з кісточкою/.test(t), 'что ждёт цену');
  ok(!/СЕКРЕТ|do-smaku|33%/.test(t) && !/\b(999|111|222)\b/.test(t) && !/Закупка|Маржа|конкурент/i.test(t), 'нет закупки, маржи, цен конкурентов и служебных колонок');
  const cnt = g.sent.length;
  g.call('hourlyJob');
  ok(g.sent.length === cnt && g.props.DIGEST_LAST && /^\d{4}-\d{2}-\d{2}$/.test(g.props.DIGEST_LAST), 'в этот день повторно не шлём; отметка дня в свойстве DIGEST_LAST');
  g.advance(FUD);
  g.call('hourlyJob');
  ok(dig().length === d.length * 2, 'на следующий день — снова');
  // час не совпал / выключено / мусор
  [(H + 1) % 24, (H + 12) % 24].forEach(h => { const w = world({}, h); w.call('hourlyJob'); if (w.sent.some(m => /Зведення PAMIR/.test(m.payload.text || ''))) ok(false, 'в другой час не шлём', h); });
  ok(true, 'в другой час сводки нет');
  ['', 'abc', 24, -1, '1.5', '99'].forEach(v => { const w = world({}, v); w.call('hourlyJob'); if (w.sent.some(m => /Зведення PAMIR|Вчора замовлень/.test(m.payload.text || ''))) ok(false, 'digest_hour = ' + JSON.stringify(v) + ' — выключено', v); });
  ok(true, 'пустой digest_hour и значения вне 0–23 — сводка выключена');
  const noset = fuWorld({ orders: [] }); noset.call('hourlyJob');
  ok(!noset.sent.some(m => /Зведення|Вчора/.test(m.payload.text || '')) && !noset.props.DIGEST_LAST, 'нет настройки (нет листа «Налаштування») — выключено, ничего не пишется');
  // нечего сказать
  const s = build(); s.sheets['Товари'] = s.sheets['Товари'].filter((r, i) => i === 0 || ['DRY-039', 'NUT-007'].includes(r[0]));
  s.sheets['Налаштування'] = [['Ключ', 'Значення', 'Опис'], ['digest_hour', H, '']]; s.sheets['Замовлення'] = [OHEAD];
  const q = createGas(CODE, s); q.call('hourlyJob');
  const only = q.sent.filter(m => m.method === 'sendMessage' && String(m.payload.chat_id) === '900');
  ok(only.length === 1 && only[0].payload.text === 'Вчора замовлень не було', 'если сказать нечего — одна строка «Вчора замовлень не було»', only.map(m => m.payload.text));
  // лишь вчерашние заказы и пустые разделы не показываются
  const s2 = build(); s2.sheets['Товари'] = s2.sheets['Товари'].filter((r, i) => i === 0 || ['DRY-039', 'NUT-007'].includes(r[0]));
  s2.sheets['Налаштування'] = [['Ключ', 'Значення', 'Опис'], ['digest_hour', H, '']];
  s2.sheets['Замовлення'] = [OHEAD, ['P-0401', AGO(1), 'виконано', '1', '', 'К', '+380501112233', 'самовивіз', '', '', 'при отриманні', '', 'x', 1250, 'ua', 'miniapp', '{}']];
  const q2 = createGas(CODE, s2); q2.call('hourlyJob');
  const t2 = q2.sent.filter(m => m.method === 'sendMessage' && String(m.payload.chat_id) === '900')[0].payload.text;
  ok(/Вчора: замовлень 1 на 1 250 ₴/.test(t2) && !/Відправити|Закінчилось|Чекають/.test(t2), 'пустые разделы не показываются; сумма «1 250 ₴»', t2);
  // сбой отправки не мешает: отметка дня уже стоит, повторной попытки в тот же день нет
  const w2 = world(); w2.setTelegramFail(true); w2.call('hourlyJob');
  const c2 = w2.sent.length; w2.setTelegramFail(false); w2.call('hourlyJob');
  ok(w2.sent.length === c2 && w2.sandbox.__errors.length === 0, 'сбой Telegram: без исключений, второй попытки в тот же день нет');
  // права на сервере: сводку получает только тот, у кого право есть в таблице админов на момент отправки
  ok(!g.sent.some(m => m.method === 'sendMessage' && ['903', '904'].includes(String(m.payload.chat_id)) && /Зведення PAMIR/.test(m.payload.text)), 'без права «Статистика» и неактивным сводка не уходит');
  ok(g.sandbox.__errors.length === 0, 'в логах нет ошибок', g.sandbox.__errors);
}

console.log('Волна Б2, блок 3 и 12: настройки в панели и пункт меню «Етап 9Б2: налаштувати»');
{
  const g = createGas(CODE, build());
  const def = k => g.sandbox.SETTINGS_DEF.find(d => d[0] === k);
  ['followup1_days', 'followup2_days', 'followup2_text_ua', 'followup2_text_ru', 'digest_hour'].forEach(k => ok(def(k) && def(k)[1].length > 30, 'настройка ' + k + ' есть в SETTINGS_DEF с пояснением'));
  ok(def('followup1_days')[2] === '0' && def('followup2_days')[2] === '0' && def('digest_hour')[2] === '', 'по умолчанию в коде: followup = 0 (выкл), digest_hour пусто (выкл)');
  const fields = g.post({ action: 'admin.settings', initData: g.initData(U(900)) });
  ok(fields.ok !== false && JSON.stringify(fields).indexOf('followup1_days') > 0, 'настройки видны в админ-панели', Object.keys(fields));
  const save = v => g.post({ action: 'admin.settingsSave', initData: g.initData(U(900)), values: v });
  const r = save({ followup1_days: '3', followup2_days: '999', digest_hour: '9' });
  const rowOf = k => g.sheets['Налаштування'].rows.find(x => x[0] === k);
  ok(r.ok && rowOf('followup1_days')[1] === '3' && rowOf('followup2_days')[1] === '365' && rowOf('digest_hour')[1] === '9', 'сохранение: дни ограничены (до 365), час 0–23', r.ok ? '' : r);
  save({ digest_hour: '24' }); ok(rowOf('digest_hour')[1] === '', 'час 24 — сохраняется как пусто (выключено)');
  save({ digest_hour: '0' }); ok(rowOf('digest_hour')[1] === '0', 'час 0 (полночь) — допустимое значение');
  save({ digest_hour: '' }); ok(rowOf('digest_hour')[1] === '', 'пусто остаётся пустым, не превращается в 0');
  save({ followup1_days: '-5', followup2_text_ua: '' }); ok(rowOf('followup1_days')[1] === '0' && rowOf('followup2_text_ua')[1] === '', 'отрицательное число → 0; пустой текст followup2 сохраняется пустым');
}
{
  const s = build();
  s.sheets['Налаштування'] = [['Ключ', 'Значення', 'Опис'], ['followup1_days', 5, 'моє'], ['digest_hour', '', 'x']];
  s.sheets['Замовлення'] = [OHEAD.slice(), ['P-0001', new Date(), 'новий', '1', '', 'К', '+380', 'самовивіз', '', '', 'при отриманні', '', 'x', 1, 'ua', 'miniapp', '{}']];
  const g = createGas(CODE, s);
  const res = g.call('stage9b2Setup');
  const S = g.sheets['Налаштування'].rows, get = k => (S.find(r => r[0] === k) || [])[1];
  ok(res.ok && get('followup2_days') === '0' && get('followup1_days') === 5 && S.filter(r => r[0] === 'followup1_days').length === 1, 'шаг добавляет followup2_days = 0 (выключено), уже стоящий followup1_days = 5 не трогает');
  ok(S.filter(r => r[0] === 'digest_hour').length === 1 && get('digest_hour') === '', 'digest_hour (уже есть, пусто) не меняется и не дублируется');
  ok(get('followup2_text_ua') === def2(g, 'followup2_text_ua') && String((S.find(r => r[0] === 'followup2_text_ua') || [])[2]).length > 30, 'тексты followup2 добавлены с описанием');
  const g1 = createGas(CODE, (() => { const t = build(); t.sheets['Налаштування'] = [['Ключ', 'Значення', 'Опис']]; return t; })());
  g1.call('stage9b2Setup');
  const S1 = g1.sheets['Налаштування'].rows, get1 = k => (S1.find(r => r[0] === k) || [])[1];
  ok(get1('followup1_days') === '0' && get1('followup2_days') === '0' && get1('np_track_hours') === '0' && get1('digest_hour') === '', 'пустой лист настроек: followup1_days, followup2_days, np_track_hours = 0 (строки есть, выключено), digest_hour пусто');
  const on = g1.call('followupJob_'); ok(on && on.f1 === 0 && on.f2 === 0 && g1.sent.length === 0, 'после шага ничего не включено: клиентам ничего не уходит');
  ok(['followup1_days', 'followup2_days'].every(k => { const d = g1.sandbox.SETTINGS_DEF.find(x => x[0] === k)[1]; return /після статусу «Виконано»/.test(d) && !/після дати замовлення/.test(d); }), 'описания followup не обещают отправку без статуса');
  const syn = g.sheets['Синоніми'];
  ok(syn && syn.rows[0].join() === 'Слово,Що шукати' && JSON.stringify(syn.rows.slice(1)) === JSON.stringify([['урюк', 'курага'], ['абрикос', 'курага'], ['кешью', "кеш'ю"]]), 'лист «Синоніми» создан с заголовками и тремя примерами');
  ok(catalog(g).c.shop.syn['кешью'] === "кеш'ю", 'и примеры сразу работают в каталоге');
  const ordH = g.sheets['Замовлення'].rows[0];
  ok(ordH[ordH.length - 1] === 'Якщо немає' && ordH.filter(h => h === 'Якщо немає').length === 1 && g.sheets['Замовлення'].rows[1].length === ordH.length, 'колонка «Якщо немає» создана в «Замовлення» один раз');
  const snap1 = snap(g, ['Журнал']);
  const res2 = g.call('stage9b2Setup');
  ok(res2.ok && snap(g, ['Журнал']) === snap1, 'повторный запуск шага ничего не меняет (идемпотентно)');
  // существующий лист «Синоніми» не трогаем
  const s3 = build(); s3.sheets['Синоніми'] = [['Слово', 'Що шукати'], ['моє', 'своє']];
  const g3 = createGas(CODE, s3); g3.call('stage9b2Setup');
  ok(JSON.stringify(g3.sheets['Синоніми'].rows) === JSON.stringify([['Слово', 'Що шукати'], ['моє', 'своє']]), 'лист «Синоніми» владельца не перезаписывается');
  // без листа «Замовлення» — не падаем, не создаём; лист «Синоніми» без действия владельца не появляется сам
  const s4 = build(); delete s4.sheets['Замовлення'];
  const g4 = createGas(CODE, s4);
  ok(!g4.sheets['Синоніми'] && catalog(g4).c.shop.syn === undefined, 'лист «Синоніми» сам не создаётся (только шагом меню)');
  const r4 = g4.call('stage9b2Setup');
  ok(r4.ok && !g4.sheets['Замовлення'] && /Якщо немає/.test(r4.message), 'нет листа «Замовлення»: шаг сообщает и не падает');
  // свойства скрипта не меняются
  ok(!Object.keys(g.props).some(k => /DIGEST|MINIAPP/.test(k)), 'шаг меню не пишет свойства скрипта');
}
{
  console.log('Волна Б2: «тесная» таблица (листы ровно по размеру данных), оба пункта меню в любом порядке');
  const mkTight = () => {
    const s = build();
    s.sheets['Налаштування'] = [['Ключ', 'Значення', 'Опис'], ['gift_from', 0, 'x']];
    s.sheets['Замовлення'] = [OHEAD.slice(), ['P-0001', new Date(), 'новий', '1', '', 'К', '+380', 'самовивіз', '', '', 'при отриманні', '', 'x', 1, 'ua', 'miniapp', '{}']];
    const g = createGas(CODE, s);
    ['Товари', 'Налаштування', 'Замовлення'].forEach(n => g.sheets[n].tighten());
    return g;
  };
  const g0 = mkTight();
  let thrown = '';
  try { g0.sheets['Налаштування'].getRange(1, 5).setValue('x'); } catch (e) { thrown = String(e); }
  ok(/outside the dimensions/.test(thrown), 'мок: запись за пределы листа (колонка > maxColumns) бросает ошибку, как в Таблицах');
  thrown = ''; try { g0.sheets['Налаштування'].getRange(9, 1).setValue('x'); } catch (e) { thrown = String(e); }
  ok(/outside the dimensions/.test(thrown), 'мок: запись за пределы листа (строка > maxRows) бросает ошибку');
  [['stage9b2Photos', 'stage9b2Setup'], ['stage9b2Setup', 'stage9b2Photos']].forEach(order => {
    const g = mkTight();
    const r1 = g.call(order[0]), r2 = g.call(order[1]);
    ok(r1.ok === true && r2.ok === true, 'тесная таблица, порядок ' + order.join(' → ') + ': оба пункта проходят', [r1.message, r2.message]);
    const T = table(g);
    ok(T.head.includes('Фото 2') && T.head.includes('Склад набору') && T.head.filter(h => h === 'Фото 2').length === 1, 'обе колонки созданы по одному разу');
    const S = g.sheets['Налаштування'].rows, get = k => (S.find(r => r[0] === k) || [])[1];
    ok(get('followup1_days') === '0' && get('followup2_days') === '0' && get('np_track_hours') === '0' && g.sheets['Синоніми'], 'строки настроек (выключены) и лист «Синоніми» созданы');
    const oh = g.sheets['Замовлення'].rows[0];
    ok(oh[oh.length - 1] === 'Якщо немає', 'колонка «Якщо немає» создана на тесном листе');
  });
  // «Клієнти» без свободных колонок: «Останнє повідомлення» и «Очікуємо відповідь» создаются
  const gc = fuWorld({ clients: [{ uid: 501 }] });
  gc.sheets['Клієнти'].tighten();
  ok(gc.call('fuClientWrite_', '501', true, 'x') === true && gc.sheets['Клієнти'].rows[0].includes('Останнє повідомлення') && gc.sheets['Клієнти'].rows[0].includes('Очікуємо відповідь'), 'тесный лист «Клієнти»: служебные колонки добавляются без ошибки');
}
function def2(g, k) { return g.sandbox.SETTINGS_DEF.find(d => d[0] === k)[2]; }

console.log('Волна Б2, блок 3 и 12: утечки и запрет startPolling');
{
  const g = fuWorld({ settings: { followup1_days: 3, followup2_days: 21, digest_hour: 3 }, clients: [{ uid: 501 }], recipes: [['R1', 'Плов', '', '', 'Текст', '', 'SPS-001', 'так']], orders: [{ num: 'P-0101', uid: 501, dn: 3.5 }, { num: 'P-0102', uid: 501, dn: 21.5 }] });
  g.call('dailyJob'); g.call('hourlyJob');
  const all = JSON.stringify(g.sent.map(m => m.payload)) + JSON.stringify(catalog(g).c) + JSON.stringify(g.post({ action: 'orders.my', initData: g.initData(U(501)), num: 'P-0101' }));
  ok(!/СЕКРЕТ|do-smaku|33%|BOT_TOKEN|TEST_TOKEN|whsec/.test(all) && !/:999[,}]|:111[,}]|:222[,}]/.test(all), 'в сообщениях, каталоге и «Мої замовлення» нет служебных колонок и секретов');
  ok(!/TEST_TOKEN|whsec/.test(g.sandbox.__errors.concat(g.sandbox.__warns).join(' ')), 'в логах нет токена и секретов');
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'apps-script', 'Stage9b2.gs'), 'utf8');
  ok(!/startPolling\s*\(/.test(src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')), 'Stage9b2.gs не вызывает startPolling()');
  ok(!g.sent.some(m => m.method === 'deleteWebhook' || m.method === 'getUpdates'), 'webhook не трогается');
}

/* ============================ Волна Б2, блок 4: Нова пошта дальше ============================ */
const NPK = 'NPKEY-SECRET-b2-xyz';
const NPC = 'aaaaaaaa-1111-2222-3333-444444444444';   // город получателя (Ref из np.city)
const NPW = 'bbbbbbbb-1111-2222-3333-444444444444';   // Ref отделения №12
const NPL = 'cccccccc-1111-2222-3333-444444444444';   // Ref почтомата №12
const SENDER = { NP_SENDER_REF: 'SENDER-REF-SECRET-1', NP_SENDER_CONTACT: 'SENDER-CONTACT-SECRET-2', NP_SENDER_CITY: 'dddddddd-1111-2222-3333-444444444444', NP_SENDER_ADDRESS: 'SENDER-ADDR-SECRET-4', NP_SENDER_PHONE: '+380671112233' };
const NPSECRETS = [NPK, 'SENDER-REF-SECRET-1', 'SENDER-CONTACT-SECRET-2', 'SENDER-ADDR-SECRET-4', '380671112233', 'SENDER-REF', 'SENDER-CONTACT'];
const TTN1 = '20450000000001';
const NPCP = '11111111-aaaa-bbbb-cccc-000000000001', NPCT = '11111111-aaaa-bbbb-cccc-000000000002', DOCREF = 'a0a0a0a0-1111-2222-3333-444444444444';

/** Ответ НП «лимит запросов»: true/'text' — «To many requests» с кодом 20000401501; 'too' — «Too many requests»; 'code' — только код; '429' — HTTP 429. */
function limBody(mode) {
  if (mode === '429') return { __http: 429, __text: 'Too Many Requests' };
  if (mode === 'too') return { success: false, errors: ['Too many requests'], data: [] };
  if (mode === 'code') return { success: false, errors: [], errorCodes: [20000401501], data: [] };
  return { success: false, errors: ['To many requests'], errorCodes: ['20000401501'], data: [] };
}
const NPUID = i => 'eeeeeeee-0000-0000-0000-' + String(i).padStart(12, '0');

/** Стенд API Новой почты: вызовы пишутся в st.calls (modelName, calledMethod, methodProperties). */
function npStub9(g, o) {
  o = o || {};
  const st = { calls: [], price: '95', save: o.save || 'ok', cp: o.cp || 'ok', del: o.del || 'ok', status: o.status || {}, apiDown: !!o.apiDown, ttnNext: TTN1 };
  g.setTelegramFail((method, payload) => {
    if (!payload.calledMethod) return null;
    st.calls.push(payload);
    const p = payload.methodProperties;
    if (st.limit || (st.limitAt && st.calls.length >= st.limitAt)) return limBody(st.limit || st.limitMode);
    if (st.apiDown) return { success: false, errors: ['API key is invalid ' + payload.apiKey], data: [] };
    if (payload.calledMethod === 'searchSettlements') {
      const nm = String(p.CityName || '').toLowerCase();
      return { success: true, data: [{ Addresses: nm.indexOf('хар') === 0 ? [{ DeliveryCity: NPC, Present: 'м. Харків, Харківська обл.', MainDescription: 'Харків', Warehouses: 50, SettlementTypeCode: 'м.' }] : [] }] };
    }
    if (payload.calledMethod === 'getWarehouses' && p.WarehouseId && st.narrowEmpty) return { success: true, data: [] };
    if (payload.calledMethod === 'getWarehouses' && st.whN && p.CityRef === NPC && !p.WarehouseId) {
      const lim = Number(p.Limit) || 500, pg = Number(p.Page || 1);
      const all = Array.from({ length: st.whN }, (_, i) => ({ Ref: NPUID(i + 1), Number: String(i + 1), Description: 'Відділення №' + (i + 1) + ': вул. Тестова', ShortAddress: 'вул. Тестова, ' + (i + 1), CityDescription: 'Харків', CategoryOfWarehouse: 'Branch' }));
      return { success: true, data: all.slice((pg - 1) * lim, pg * lim) };
    }
    if (payload.calledMethod === 'getDocumentPrice') return st.price === 'fail' ? { success: false, errors: ['City not found'], data: [] } : { success: true, data: [{ Cost: st.price }] };
    if (payload.calledMethod === 'getWarehouses') {
      return { success: true, data: p.CityRef !== NPC ? [] : [
        { Ref: NPW, Number: '12', Description: 'Відділення №12: вул. Тестова, 1', CityDescription: 'Харків', CategoryOfWarehouse: 'Branch' },
        { Ref: NPL, Number: '12', Description: 'Поштомат "Нова пошта" №12', CityDescription: 'Харків', CategoryOfWarehouse: 'Postomat' },
        { Ref: 'eeeeeeee-1111-2222-3333-444444444444', Number: '120', Description: 'Відділення №120', CityDescription: 'Харків', CategoryOfWarehouse: 'Branch' },
        { Ref: 'ffffffff-1111-2222-3333-444444444444', Number: '7', Description: 'Відділення №7', CityDescription: 'Харків', CategoryOfWarehouse: 'Branch' },
        { Ref: 'ffffffff-1111-2222-3333-444444444445', Number: '7', Description: 'Відділення №7 (друге)', CityDescription: 'Харків', CategoryOfWarehouse: 'Branch' }
      ] };
    }
    if (payload.modelName === 'Counterparty' && payload.calledMethod === 'save') {
      if (st.cp === 'net') throw new Error('network down https://api.novaposhta.ua/v2.0/json/?k=' + payload.apiKey);
      if (st.cp === 'reject') return { success: false, errors: ['Phone is invalid'], data: [] };
      if (st.cp === 'nocontact') return { success: true, data: [{ Ref: NPCP }] };
      return { success: true, data: [{ Ref: NPCP, ContactPerson: { success: true, data: [{ Ref: NPCT }] } }] };
    }
    if (payload.calledMethod === 'getCounterpartyContactPersons') return { success: true, data: p.Ref === NPCP ? [{ Ref: NPCT, Description: 'Іваненко Олена' }] : [] };
    if (payload.calledMethod === 'delete' && st.onDelete) st.onDelete(p);
    if (payload.calledMethod === 'delete') return st.del === 'reject' ? { success: false, errors: ['Document not found'], data: [] } : { success: true, data: [{ Ref: p.DocumentRefs }] };
    if (payload.calledMethod === 'save') {
      if (st.save === 'net') throw new Error('network down https://api.novaposhta.ua/v2.0/json/?k=' + payload.apiKey);
      if (st.save === 'reject') return { success: false, errors: ['RecipientName is invalid', 'Weight too big'], errorCodes: ['20000200001'], data: [] };
      if (st.save === 'nonum') return { success: true, data: [{ Ref: DOCREF }] };
      return { success: true, data: [{ Ref: DOCREF, IntDocNumber: st.ttnNext, CostOnSite: '70' }] };
    }
    if (payload.calledMethod === 'getStatusDocuments') {
      if (st.onStatus) st.onStatus(p);
      return { success: true, data: p.Documents.map(d => ({ Number: d.DocumentNumber, StatusCode: st.status[d.DocumentNumber] || '1', Status: 'x' })) };
    }
    return { success: true, data: [] };
  });
  return st;
}
const npOf = (st, m) => st.calls.filter(c => c.calledMethod === m && !(m === 'save' && c.modelName === 'Counterparty'));
const npCp = st => st.calls.filter(c => c.calledMethod === 'save' && c.modelName === 'Counterparty');
const NPNAME = 'Іваненко Олена';
const npOrders = () => [
  { num: 'P-0101', uid: 501, ago: 1, status: 'підтверджено', name: NPNAME, delivery: 'Нова пошта', city: 'Харків', branch: '12', pay: 'при отриманні', total: 1400, svc: { i: [['SPS-001', 500, 2]], nc: NPC } },
  { num: 'P-0102', uid: 502, ago: 1, status: 'підтверджено', name: NPNAME, delivery: 'Нова пошта', city: 'Харків', branch: '12', pay: 'переказ на картку', total: 900, svc: { i: [['SPS-001', 100, 3]], nc: NPC } },
  { num: 'P-0103', uid: 503, ago: 1, status: 'підтверджено', name: NPNAME, delivery: 'Нова пошта', city: 'Харків', branch: '12', total: 500, svc: { i: [['SPS-001', 100, 1]] } },
  { num: 'P-0104', uid: 504, ago: 1, status: 'підтверджено', name: NPNAME, delivery: 'Нова пошта', city: 'Харків', branch: '12', total: 100, svc: { i: [['SPS-021', 0, 2]], nc: NPC } },
  { num: 'P-0105', uid: 505, ago: 1, status: 'підтверджено', name: NPNAME, delivery: 'Нова пошта · кур’єр', city: 'Харків', branch: 'вул. Тестова, 5', total: 500, svc: { i: [['SPS-001', 100, 1]], nc: NPC } },
  { num: 'P-0106', uid: 506, ago: 1, status: 'підтверджено', name: NPNAME, delivery: 'самовивіз', total: 500, svc: { i: [['SPS-001', 100, 1]] } },
  { num: 'P-0107', uid: 507, ago: 1, status: 'відправлено', name: NPNAME, delivery: 'Нова пошта', city: 'Харків', branch: '12', total: 500, svc: { i: [['SPS-001', 100, 1]], nc: NPC, ttn: '20450000000099' } },
  { num: 'P-0108', uid: 508, ago: 1, status: 'підтверджено', name: NPNAME, delivery: 'Нова пошта · поштомат', city: 'Харків', branch: '12', pay: 'накладений платіж', total: 700, svc: { i: [['SPS-001', 50, 2]], nc: NPC } },
  { num: 'P-0109', uid: 509, ago: 1, status: 'підтверджено', name: NPNAME, delivery: 'Нова пошта', city: 'Харків', branch: '77', total: 500, svc: { i: [['SPS-001', 100, 1]], nc: NPC } },
  { num: 'P-0110', uid: 510, ago: 1, status: 'підтверджено', name: NPNAME, delivery: 'Нова пошта', city: 'Харків', branch: '7', total: 500, svc: { i: [['SPS-001', 100, 1]], nc: NPC } },
  { num: 'P-0111', uid: 511, ago: 1, status: 'скасовано', name: NPNAME, delivery: 'Нова пошта', city: 'Харків', branch: '12', total: 500, svc: { i: [['SPS-001', 100, 1]], nc: NPC } },
  { num: 'P-0112', uid: 512, ago: 1, status: 'підтверджено', name: 'Олена', delivery: 'Нова пошта', city: 'Харків', branch: '12', total: 500, svc: { i: [['SPS-001', 100, 1]], nc: NPC } },
  { num: 'P-0113', uid: 513, ago: 1, status: 'підтверджено', name: NPNAME, phone: '+4915112345678', delivery: 'Нова пошта', city: 'Харків', branch: '12', total: 500, svc: { i: [['SPS-001', 100, 1]], nc: NPC } },
  { num: 'P-0114', uid: 514, ago: 1, status: 'підтверджено', name: NPNAME, source: 'miniapp test', delivery: 'Нова пошта', city: 'Харків', branch: '12', total: 500, svc: { i: [['SPS-001', 100, 1]], nc: NPC } }
];
const npWorld = (extra, props) => fuWorld(Object.assign({ props: Object.assign({ NP_API_KEY: NPK }, SENDER, props || {}), orders: npOrders() }, extra || {}));
const npAll = g => JSON.stringify(g.sent.filter(m => !m.payload.calledMethod).map(m => m.payload)) + g.sandbox.__errors.concat(g.sandbox.__warns).join('\n') + JSON.stringify(g.sheets['Журнал'] ? g.sheets['Журнал'].rows : []);
// Габариты теперь обязательны для admin.ttn.create: по умолчанию подставляем 20×20×10 см, если тест сам не задал width/length/height или флаг _nodims.
const admP = (g, uid, action, data) => {
  data = Object.assign({}, data || {});
  if (action === 'admin.ttn.create') {
    if (data._nodims) delete data._nodims;
    else if (!('width' in data) && !('length' in data) && !('height' in data)) Object.assign(data, { width: 20, length: 20, height: 10 });
  }
  return g.post(Object.assign({ action, initData: g.initData(U(uid)) }, data));
};
const noSecrets = (text) => !NPSECRETS.some(s => text.includes(s));

console.log('Волна Б2, блок 4: np.price (стоимость доставки)');
{
  // выключено
  const g0 = npWorld({}, {}); delete g0.props.NP_API_KEY; g0.clearCache();
  const st0 = npStub9(g0);
  ok(JSON.stringify(g0.get({ action: 'np.price', city: NPC, w: 1000, sum: 500 })) === '{"ok":false,"error":"off"}' && st0.calls.length === 0, 'без ключа: error off, вызовов API нет');
  const g1 = fuWorld({ props: { NP_API_KEY: NPK } });
  const st1 = npStub9(g1);
  ok(g1.get({ action: 'np.price', city: NPC, w: 1000, sum: 500 }).error === 'off' && st1.calls.length === 0 && !('npp' in catalog(g1).c.shop) && catalog(g1).c.shop.np === 1, 'ключ без NP_SENDER_CITY: off, shop.npp нет, shop.np = 1 как раньше');
  const g = npWorld();
  const st = npStub9(g);
  ok(catalog(g).c.shop.npp === 1, 'ключ и город отправителя: shop.npp = 1');
  const r = g.get({ action: 'np.price', city: NPC, w: 1200, sum: 1234 });
  ok(JSON.stringify(r) === '{"ok":true,"cost":95}', 'успех: {ok:true, cost:95}', r);
  const c = st.calls[0];
  ok(c.modelName === 'InternetDocument' && c.calledMethod === 'getDocumentPrice' && c.methodProperties.CitySender === SENDER.NP_SENDER_CITY && c.methodProperties.CityRecipient === NPC &&
    c.methodProperties.ServiceType === 'WarehouseWarehouse' && c.methodProperties.CargoType === 'Parcel' && c.methodProperties.SeatsAmount === '1' && c.methodProperties.Weight === '1.5' && c.methodProperties.Cost === '1500', 'запрос: InternetDocument.getDocumentPrice, вес округлён до 1,5 кг, объявленная стоимость до 1500', c);
  const n = st.calls.length;
  ok(g.get({ action: 'np.price', city: NPC, w: 1400, sum: 1400 }).cost === 95 && st.calls.length === n, 'тот же город, вес в той же ступени 0,5 кг: из кэша, без нового вызова');
  g.get({ action: 'np.price', city: NPC, w: 1600, sum: 1400 });
  ok(st.calls.length === n + 1 && npOf(st, 'getDocumentPrice')[1].methodProperties.Weight === '2', 'другая ступень веса — новый вызов');
  const bad = [{ city: 'x', w: 1000 }, { city: NPC, w: 'abc' }, { city: NPC, w: -5 }, { city: NPC, w: 0 }, { city: NPC }, { city: NPC, w: 'Infinity' }, { city: NPC.replace(/a/g, 'z'), w: 1000 }, { w: 1000 }, { city: NPC, w: '1e999' }];
  const before = st.calls.length;
  ok(bad.every(b => g.get(Object.assign({ action: 'np.price' }, b)).error === 'bad_form') && st.calls.length === before, 'мусорные параметры: bad_form, к API не идём');
  g.get({ action: 'np.price', city: NPC, w: 9999999, sum: 'abc' });
  const last = st.calls[st.calls.length - 1].methodProperties;
  ok(last.Weight === '30' && last.Cost === '200', 'огромный вес — не больше 30 кг; сумма-мусор — минимум 200', last);
  g.get({ action: 'np.price', city: NPC, w: 100, sum: 1e12 });
  const last2 = st.calls[st.calls.length - 1].methodProperties;
  ok(last2.Weight === '0.5' && last2.Cost === '50000', 'вес не меньше 0,5 кг; сумма не больше 50 000', last2);
  // ошибка API
  const ge = npWorld(); const se = npStub9(ge); se.price = 'fail';
  const re = ge.get({ action: 'np.price', city: NPC, w: 1000, sum: 500 });
  ok(JSON.stringify(re) === '{"ok":false,"error":"np_error"}', 'ошибка API: {ok:false, error}, без подробностей', re);
  se.price = '110';
  ok(ge.get({ action: 'np.price', city: NPC, w: 1000, sum: 500 }).cost === 110, 'ошибка не кэшируется: следующий запрос снова идёт в API');
  ok(!ge.sent.some(m => m.method === 'sendMessage' && /Підказки Нової пошти/.test(m.payload.text || '')), 'ошибка расчёта не шлёт админам «Підказки НП не працюють»');
  se.price = '0';
  ok(ge.get({ action: 'np.price', city: NPC, w: 3000, sum: 500 }).error === 'np_error', 'нулевая стоимость в ответе — ошибка');
  // собственный лимит
  const gl = npWorld(); const sl = npStub9(gl);
  for (let i = 0; i < 150; i++) gl.get({ action: 'np.price', city: NPC, w: 500 + i * 500 % 29000, sum: 100 + i * 500 });
  const lim = gl.get({ action: 'np.price', city: NPC, w: 777, sum: 123456 });
  ok(sl.calls.length <= 150 && sl.calls.length > 20 && (lim.error === 'busy' || lim.ok), 'свой лимит вызовов np.price в час не превышен', sl.calls.length);
  const gb = npWorld(); npStub9(gb);
  gb.sandbox.CacheService.getScriptCache().put('npp_calls', '150|' + Date.now(), 3600);
  ok(gb.get({ action: 'np.price', city: NPC, w: 1000, sum: 500 }).error === 'busy', '150 вызовов за час: busy, но то, что в кэше, отдаётся');
  ok(noSecrets(JSON.stringify([r, re]) + npAll(g) + npAll(ge)), 'в ответах и логах нет ключа и данных отправителя');
}

console.log('Волна Б2, блок 4: orders.npTtn и свой cityRef в заказе');
{
  const g = npWorld(); npStub9(g);
  ok(admP(g, 900, 'admin.orders').npTtn === 1, 'все пять NP_SENDER_* и ключ: orders.npTtn = 1');
  Object.keys(SENDER).forEach(k => {
    const gx = npWorld(); const v = gx.props[k]; delete gx.props[k]; gx.clearCache();
    ok(!('npTtn' in admP(gx, 900, 'admin.orders')), 'нет ' + k + ': флага нет');
  });
  const gk = npWorld(); delete gk.props.NP_API_KEY; gk.clearCache();
  ok(!('npTtn' in admP(gk, 900, 'admin.orders')) && !('npp' in catalog(gk).c.shop), 'нет ключа: ни npTtn, ни shop.npp');
  // заказ с cityRef
  const go = npWorld(); npStub9(go);
  const body = { action: 'order', initData: go.initData(U(601)), items: [{ id: 'SPS-001', g: 50, q: 1 }], total: 35, name: NPNAME, phone: '+380501234567', delivery: 'np', city: 'Харків', branch: '12', npType: 'branch', pay: 'cash', lang: 'ua', cityRef: NPC.toUpperCase() };
  const r1 = go.post(Object.assign({ rid: 'rA1' }, body));
  ok(r1.ok && svcB(go, r1.number).nc === NPC, 'заказ с cityRef: Ref города записан в «Службове» (svc.nc, строчными)', r1);
  const r2 = go.post(Object.assign({}, body, { rid: 'rA2', cityRef: 'не-ref' }));
  ok(r2.ok && svcB(go, r2.number).nc === undefined, 'мусорный cityRef игнорируется');
  const r3 = go.post(Object.assign({}, body, { rid: 'rA3', cityRef: undefined }));
  ok(r3.ok && svcB(go, r3.number).nc === undefined, 'без cityRef (старая витрина): заказ принимается как раньше');
  const r4 = go.post(Object.assign({}, body, { rid: 'rA4', delivery: 'pickup' }));
  ok(r4.ok && svcB(go, r4.number).nc === undefined, 'самовывоз: cityRef не пишется');
  const r5 = go.post(Object.assign({}, body, { rid: 'rA5', total: 1 }));
  ok(r5.error === 'changed', 'сумму по-прежнему считает сервер');
  const mine = go.post({ action: 'orders.my', initData: go.initData(U(601)) });
  ok(!JSON.stringify(mine).includes(NPC), 'в «Мої замовлення» Ref города не уходит');
}

console.log('Волна Б2, блок 4: admin.ttn.preview');
{
  const g = npWorld(); const st = npStub9(g);
  const pv = n => admP(g, 900, 'admin.ttn.preview', { num: n });
  const p = pv('P-0101');
  ok(p.ok && p.ttn.name === NPNAME && p.ttn.nameOk === true && p.ttn.phone === '+380501112233' && p.ttn.city === 'Харків' && p.ttn.branch === '12' && p.ttn.type === 'branch', 'preview: получатель, телефон, город, отделение', p);
  ok(p.ttn.weightG === 1000 && p.ttn.cost === 1400 && p.ttn.cod === 1400 && p.ttn.desc && p.ttn.npWarehouse === 'Відділення №12: вул. Тестова, 1' && p.ttn.npCity === 'Харків', 'вес = сумма весов позиций, наложенный платёж = сумма заказа (оплата при получении), отделение подтянуто из НП', p.ttn);
  ok(pv('P-0102').ttn.cod === 0, 'оплата переводом на карту: наложенного платежа нет');
  ok(pv('P-0108').error === 'locker' && /поштомат/.test(pv('P-0108').msg.ua) && /почтомат/.test(pv('P-0108').msg.ru) && npOf(st, 'save').length === 0, 'почтомат: preview отвечает понятной ошибкой locker (UA и RU), габаритов места мы не знаем');
  ok(p.ttn.payer === 'recipient' && pv('P-0102').ttn.payer === 'recipient', 'preview: payer = recipient (за доставку платит получатель)');
  ok(pv('P-0104').ok && pv('P-0104').ttn.weightG === null, 'штучный товар — вес неизвестен: пусто, админ вводит сам');
  ok(pv('P-0103').error === 'no_ref' && pv('P-0103').msg.ua && pv('P-0103').msg.ru, 'заказ без Ref города: no_ref с понятным текстом UA и RU');
  ok(pv('P-0105').error === 'courier' && pv('P-0106').error === 'not_np' && pv('P-0107').error === 'has_ttn' && pv('P-9999').error === 'not_found', 'курьер, самовывоз, уже есть ТТН, нет заказа — отказ с причиной');
  ok(pv('P-0109').error === 'wh_unknown' && pv('P-0110').error === 'wh_unknown', 'отделение не найдено или найдено неоднозначно — отказ');
  ok(pv('P-0111').error === 'bad_status' && pv('P-0113').error === 'bad_phone' && pv('P-0114').error === 'test', 'отменён, чужой телефон, тестовый — отказ');
  ok(pv('P-0112').ok && pv('P-0112').ttn.nameOk === false, 'имя из одного слова: preview работает, nameOk = false (админ впишет фамилию и имя)');
  ok(npOf(st, 'save').length === 0, 'preview ничего не создаёт в НП');
  ok(noSecrets(JSON.stringify([p, pv('P-0103')])), 'в ответах нет ключа и данных отправителя');
  // права
  const gm = npWorld({ sheets: { 'Адміни': (() => { const head = require('vm').runInContext('ADMIN_HEAD', createGas(CODE, build()).sandbox).slice(); const row = head.map(() => ''); row[0] = '700'; row[1] = 'М'; row[3] = 'Менеджер'; row[head.indexOf('Наявність і залишки')] = 'так'; row[head.indexOf('Активний')] = 'так'; return [head, row]; })() } });
  const sm = npStub9(gm);
  ok(admP(gm, 700, 'admin.orders').ok && admP(gm, 700, 'admin.ttn.preview', { num: 'P-0101' }).error === 'no_perm' && admP(gm, 700, 'admin.ttn.create', { num: 'P-0101', weight: 1000, confirm: true }).error === 'no_perm', 'менеджер без права «Замовлення: статуси»: preview и create — no_perm');
  ok(!('npTtn' in admP(gm, 700, 'admin.orders')), 'менеджеру без права флаг «Створити ТТН» не отдаётся');
  ok(admP(gm, 777, 'admin.ttn.preview', { num: 'P-0101' }).error === 'forbidden' && g.post({ action: 'admin.ttn.preview', num: 'P-0101' }).error === 'forbidden' && g.post({ action: 'admin.ttn.create', num: 'P-0101', weight: 1000, confirm: true, initData: 'hash=bad' }).error === 'forbidden', 'не админ и без подписи: forbidden');
  ok(sm.calls.length === 0, 'без прав вызовов НП нет');
  // выключено
  const gz = npWorld({}, {}); delete gz.props.NP_SENDER_ADDRESS; gz.clearCache(); const sz = npStub9(gz);
  ok(admP(gz, 900, 'admin.ttn.preview', { num: 'P-0101' }).error === 'off' && admP(gz, 900, 'admin.ttn.create', { num: 'P-0101', weight: 1000, confirm: true }).error === 'off' && sz.calls.length === 0, 'нет одного из NP_SENDER_*: off, вызовов нет');
}

console.log('Волна Б2, блок 4: admin.ttn.create');
{
  const mk = () => { const g = npWorld(); const st = npStub9(g); return { g, st, cr: (n, o) => admP(g, 900, 'admin.ttn.create', Object.assign({ num: n, weight: 1000, confirm: true }, o || {})) }; };
  const { g, st, cr } = mk();
  ok(cr('P-0101', { confirm: false }).error === 'not_confirmed' && cr('P-0101', { confirm: undefined }).error === 'not_confirmed', 'без confirm: true — отказ');
  [0, 50, 30001, 'abc', -1, null, undefined].forEach(w => ok(cr('P-0101', { weight: w }).error === 'bad_weight', 'вес ' + JSON.stringify(w) + ' — bad_weight'));
  ok(cr('P-0101', { cod: 1 }).error === 'bad_amount' && cr('P-0102', { cod: 900 }).error === 'bad_amount', 'cod от клиента должен совпасть с серверным (и не может появиться у оплаченного переводом)');
  ok(cr('P-0112').error === 'bad_name' && cr('P-0101', { name: 'Олена' }).error === 'bad_name' && cr('P-0101', { name: 'Ол3на Тест' }).error === 'bad_name' && cr('P-0101', { name: 'А Б В Г' }).error === 'bad_name', 'имя: нужно два-три слова из букв');
  ok(npOf(st, 'save').length === 0, 'до успешной проверки в НП ничего не уходит');
  const toClient0 = g.sent.length;
  const r = cr('P-0101');
  ok(r.ok && r.ttn === TTN1 && r.told === true, 'успех: номер из IntDocNumber, клиенту отправлено', r);
  const sv = npOf(st, 'save');
  ok(sv.length === 1 && sv[0].modelName === 'InternetDocument', 'один вызов InternetDocument.save');
  const p = sv[0].methodProperties;
  ok(p.PayerType === 'Recipient' && p.PaymentMethod === 'Cash' && p.CargoType === 'Parcel' && p.ServiceType === 'WarehouseWarehouse' && p.SeatsAmount === '1' && !('NewAddress' in p) && p.VolumeGeneral === '0.004', 'свойства: получатель платит, наличные, посылка, склад–склад, одно место', p);
  ok(p.Weight === '1' && p.Cost === '1400' && p.CitySender === SENDER.NP_SENDER_CITY && p.Sender === SENDER.NP_SENDER_REF && p.ContactSender === SENDER.NP_SENDER_CONTACT && p.SenderAddress === SENDER.NP_SENDER_ADDRESS && p.SendersPhone === '380671112233', 'отправитель — из Script Properties, вес и сумма — подтверждённые/серверные');
  ok(p.CityRecipient === NPC && p.RecipientAddress === NPW && p.Recipient === NPCP && p.ContactRecipient === NPCT && !('RecipientName' in p) && p.RecipientsPhone === '380501112233' && /^\d\d\.\d\d\.\d{4}$/.test(p.DateTime), 'получатель: город, отделение (Ref), имя, телефон 380…, дата ДД.ММ.ГГГГ');
  ok(JSON.stringify(p.BackwardDeliveryData) === JSON.stringify([{ PayerType: 'Recipient', CargoType: 'Money', RedeliveryString: '1400' }]), 'наложенный платёж: BackwardDeliveryData на сумму заказа с сервера');
  ok(svcB(g, 'P-0101').ttn === TTN1 && svcB(g, 'P-0101').tp === undefined, 'ТТН записана в заказ (через setTtn_), метка «создание идёт» снята');
  const told = g.sent.slice(toClient0).filter(m => m.method === 'sendMessage' && String(m.payload.chat_id) === '501');
  ok(told.length === 1 && told[0].payload.text.includes(TTN1) && /Відстежити/.test(JSON.stringify(told[0].payload.reply_markup)), 'клиенту ушёл номер с кнопкой «Відстежити» (существующий setTtn_)');
  ok(g.sheets['Журнал'] && JSON.stringify(g.sheets['Журнал'].rows).includes(TTN1), 'действие записано в журнал (setTtn_)');
  const again = cr('P-0101');
  ok(again.error === 'has_ttn' && npOf(st, 'save').length === 1, 'повторное создание — отказ, второго вызова save нет');
  // карта: без наложенного платежа
  st.ttnNext = '20450000000002';
  const r2 = cr('P-0102', { weight: 300, name: 'Петренко Іван Петрович' });
  const p2 = npOf(st, 'save')[1].methodProperties;
  ok(r2.ok && !('BackwardDeliveryData' in p2) && p2.Weight === '0.3' && npCp(st)[1].methodProperties.LastName === 'Петренко' && npCp(st)[1].methodProperties.FirstName === 'Іван' && npCp(st)[1].methodProperties.MiddleName === 'Петрович' && p2.Cost === '900', 'оплата на карту: BackwardDeliveryData нет; вес 0,3 кг; имя подтверждено админом');
  // почтомат
  st.ttnNext = '20450000000003';
  const r3 = cr('P-0108');
  ok(r3.ok === false && r3.error === 'locker' && npOf(st, 'save').length === 2, 'почтомат: create отказ locker, вызова save нет');
  // чужие отказы
  ok(cr('P-0103').error === 'no_ref' && cr('P-0105').error === 'courier' && cr('P-0107').error === 'has_ttn' && npOf(st, 'save').length === 2, 'нет Ref / курьер / уже есть ТТН: отказ без вызова save');
  ok(noSecrets(JSON.stringify([r, r2, r3, again]) + npAll(g)), 'ключ и данные отправителя не попали в ответы, сообщения, логи и журнал');
}

console.log('Волна Б2, блок 4: create — ошибки НП и защита от двойного создания');
{
  const mk = (save) => { const g = npWorld(); const st = npStub9(g, { save }); return { g, st, cr: (n, o) => admP(g, 900, 'admin.ttn.create', Object.assign({ num: n, weight: 1000, confirm: true }, o || {})) }; };
  // API отказал
  {
    const { g, st, cr } = mk('reject');
    const n0 = g.sent.length;
    const r = cr('P-0101');
    ok(r.ok === false && r.error === 'np_api' && /RecipientName is invalid/.test(r.np) && /Weight too big/.test(r.np) && r.msg.ua && r.msg.ru, 'ошибка API: админу текст ошибок НП', r);
    ok(svcB(g, 'P-0101').ttn === undefined && svcB(g, 'P-0101').tp === undefined && !g.sent.slice(n0).some(m => m.method === 'sendMessage' && String(m.payload.chat_id) === '501'), 'ничего не записано, метка снята, клиенту ничего не ушло');
    st.save = 'ok';
    ok(cr('P-0101').ok === true && npOf(st, 'save').length === 2, 'после отказа API создание можно повторить');
    ok(noSecrets(JSON.stringify(r) + npAll(g)), 'ключ не попал в ответ и логи при ошибке');
    ok(!g.sent.some(m => m.method === 'sendMessage' && /Підказки Нової пошти/.test(m.payload.text || '')), 'ошибка накладной не шлёт «Підказки НП не працюють»');
  }
  // ответ без номера
  {
    const { g, st, cr } = mk('nonum');
    ok(cr('P-0101').error === 'np_unknown' && svcB(g, 'P-0101').ttn === undefined && svcB(g, 'P-0101').tp > 0, 'ответ без номера: np_unknown, ничего не записано, метка «создание идёт» остаётся (повтор не создаст дубль)');
  }
  // обрыв связи: могла создаться — повтор блокируется
  {
    const { g, st, cr } = mk('net');
    const r = cr('P-0101');
    ok(r.error === 'np_unknown' && svcB(g, 'P-0101').ttn === undefined && svcB(g, 'P-0101').tp > 0, 'обрыв связи: np_unknown, метка «создание идёт» остаётся', r);
    ok(!JSON.stringify(r).includes(NPK) && !npAll(g).includes(NPK), 'ключ из текста сетевой ошибки вычищен');
    st.save = 'ok';
    const r2 = cr('P-0101');
    ok(r2.error === 'busy' && npOf(st, 'save').length === 1, 'повтор в течение 5 минут — busy, второй накладной нет');
    const sv = svcB(g, 'P-0101'); sv.tp = Date.now() - 6 * 60 * 1000;
    g.sheets['Замовлення'].rows.find(x => x[0] === 'P-0101')[16] = JSON.stringify(sv);
    ok(cr('P-0101').ok === true && npOf(st, 'save').length === 2, 'через 5 минут повтор разрешён (админ проверил кабинет)');
  }
  // метка стоит
  {
    const { g, st, cr } = mk('ok');
    const sv = svcB(g, 'P-0101'); sv.tp = Date.now() - 1000;
    g.sheets['Замовлення'].rows.find(x => x[0] === 'P-0101')[16] = JSON.stringify(sv);
    ok(cr('P-0101').error === 'busy' && npOf(st, 'save').length === 0, 'создание уже идёт (метка): отказ без вызова НП');
  }
  // два запроса подряд: второй видит ТТН
  {
    const { g, st, cr } = mk('ok');
    const a = cr('P-0101'), b = cr('P-0101');
    ok(a.ok && b.error === 'has_ttn' && npOf(st, 'save').length === 1, 'двойной клик: одна накладная');
  }
  // блокировка занята
  {
    const { g, st, cr } = mk('ok');
    g.sandbox.LockService = { getScriptLock: () => ({ tryLock: () => false, waitLock() { throw new Error('Lock timeout'); }, releaseLock() {} }) };
    const r = cr('P-0101');
    ok(r.ok === false && npOf(st, 'save').length === 0, 'блокировка занята: накладная не создаётся');
  }
  // запись под LockService
  {
    const { g, st, cr } = mk('ok');
    g.lockLog.length = 0;
    cr('P-0101');
    ok(g.lockLog.some(x => x.kind === 'script' && x.op === 'try' && x.ok), 'метка пишется под LockService');
    ok(st.calls.every(c => true) && g.sent.filter(m => m.payload.calledMethod).every(m => m.lockHeld === 0), 'запрос к НП идёт вне блокировки');
  }
}

console.log('Волна Б2, блок 4: прибытие в отделение (npTrackJob_)');
{
  const trackOrders = () => [
    { num: 'P-0201', uid: 501, ago: 3, status: 'відправлено', delivery: 'Нова пошта', svc: { i: [['SPS-001', 50, 1]], ttn: '20450000000011' } },
    { num: 'P-0202', uid: 502, ago: 40, status: 'відправлено', svc: { i: [['SPS-001', 50, 1]], ttn: '20450000000012' } },
    { num: 'P-0203', uid: 503, ago: 3, status: 'відправлено', svc: { i: [['SPS-001', 50, 1]], ttn: '20450000000013', ar: 1 } },
    { num: 'P-0204', uid: 504, ago: 3, status: 'виконано', svc: { i: [['SPS-001', 50, 1]], ttn: '20450000000014' } },
    { num: 'P-0205', uid: 505, ago: 3, status: 'відправлено', svc: { i: [['SPS-001', 50, 1]], ttn: '20450000000015' } },
    { num: 'P-0206', uid: 506, ago: 3, status: 'відправлено', source: 'miniapp test', svc: { i: [['SPS-001', 50, 1]], ttn: '20450000000016' } },
    { num: 'P-0207', uid: 507, ago: 3, status: 'відправлено', lang: 'ru', delivery: 'Нова пошта · поштомат', svc: { i: [['SPS-001', 50, 1]], ttn: '20450000000017' } },
    { num: 'P-0208', uid: 508, ago: 3, status: 'відправлено', svc: { i: [['SPS-001', 50, 1]] } }
  ];
  const mk = (hours, status, extra) => {
    const g = fuWorld(Object.assign({ props: { NP_API_KEY: NPK }, settings: hours === null ? undefined : { np_track_hours: hours }, orders: trackOrders(), clients: [{ uid: 501, unsub: true }, { uid: 507 }] }, extra || {}));
    const st = npStub9(g, { status });
    return { g, st };
  };
  const STAT = { '20450000000011': '7', '20450000000012': '7', '20450000000013': '7', '20450000000014': '7', '20450000000015': '5', '20450000000016': '7', '20450000000017': '8' };
  const { g, st } = mk(3, STAT);
  const n = g.call('npTrackJob_');
  const calls = npOf(st, 'getStatusDocuments');
  ok(calls.length === 1 && calls[0].modelName === 'TrackingDocument', 'один вызов TrackingDocument.getStatusDocuments', calls.length);
  const docs = calls[0].methodProperties.Documents.map(d => d.DocumentNumber).sort();
  ok(docs.join() === ['20450000000011', '20450000000015', '20450000000017'].join(), 'опрашиваются только «відправлено» с ТТН, без отметки, не старше 30 дней, не тестовые', docs);
  ok(calls[0].methodProperties.Documents.every(d => d.Phone === '380501112233'), 'в запросе телефон получателя 380…');
  ok(n === 2 && toChat(g, 501).length === 1 && toChat(g, 507).length === 1 && toChat(g, 505).length === 0 && toChat(g, 502).length === 0 && toChat(g, 503).length === 0 && toChat(g, 504).length === 0 && toChat(g, 506).length === 0, 'код 7 и 8 → по одному сообщению; код 5, старые, уже отмеченные, не «відправлено», тестовые — нет', n);
  ok(/Ваше замовлення № P-0201 прибуло у відділення Нової пошти\. ТТН 20450000000011/.test(toChat(g, 501)[0].payload.text) && /Відстежити/.test(JSON.stringify(toChat(g, 501)[0].payload.reply_markup)), 'UA-текст и кнопка «Відстежити»');
  ok(/Ваш заказ № P-0207 прибыл в почтомат Новой почты\. ТТН 20450000000017/.test(toChat(g, 507)[0].payload.text), 'RU-текст для ru-заказа с почтоматом: «в почтомат»');
  {
    const gn = fuWorld({ props: { NP_API_KEY: NPK }, settings: { np_track_hours: 3 }, orders: [{ num: 'P-0301', uid: 601, ago: 3, status: 'відправлено', svc: { i: [['SPS-001', 50, 1]], ttn: '20450000000031' } }, { num: 'P-0302', uid: 602, ago: 3, status: 'відправлено', lang: 'ru', svc: { i: [['SPS-001', 50, 1]], ttn: '20450000000032' } }] });
    npStub9(gn, { status: { '20450000000031': '7', '20450000000032': '7' } });
    gn.call('npTrackJob_');
    ok(/прибуло у відділення Нової пошти. ТТН 20450000000031/.test(toChat(gn, 601)[0].payload.text) && /прибыл в отделение Новой почты/.test(toChat(gn, 602)[0].payload.text), 'тип доставки в заказе неизвестен: текст по коду 7 — «у відділення»');
  }
  ok(svcB(g, 'P-0201').ar === 1 && svcB(g, 'P-0207').ar === 1 && svcB(g, 'P-0205').ar === undefined, 'отметка ar только у тех, кому написали');
  ok(clientB(g, 501) && clientB(g, 501).h.indexOf('Останнє повідомлення') < 0, 'сервисное сообщение: отписавшемуся (Відписка) тоже уходит, отметка «Останнє повідомлення» не ставится');
  // повтор
  g.props.NP_TRACK_LAST = '0';
  const n2 = g.call('npTrackJob_');
  ok(n2 === 0 && toChat(g, 501).length === 1 && toChat(g, 507).length === 1, 'повторный опрос: сообщение второй раз не уходит (отметка svc)');
  ok(npOf(st, 'getStatusDocuments')[1].methodProperties.Documents.map(d => d.DocumentNumber).join() === '20450000000015', 'отмеченные заказы больше не опрашиваются');
  // интервал
  const nn = npOf(st, 'getStatusDocuments').length;
  ok(g.call('npTrackJob_') === 0 && npOf(st, 'getStatusDocuments').length === nn, 'раньше чем через np_track_hours часов API не опрашивается');
  // 0, пусто, нет ключа
  [0, '', '0', -3, 'abc'].forEach(v => { const x = mk(v, STAT); ok(x.g.call('npTrackJob_') === 0 && x.st.calls.length === 0 && toChat(x.g, 501).length === 0, 'np_track_hours = ' + JSON.stringify(v) + ': выключено, вызовов нет'); });
  const xn = mk(null, STAT); ok(xn.g.call('npTrackJob_') === 0 && xn.st.calls.length === 0, 'настройки нет: выключено по умолчанию');
  ok(g.sandbox.SETTINGS_DEF.find(d => d[0] === 'np_track_hours')[2] === '0', 'по умолчанию в коде np_track_hours = 0');
  const nk = mk(3, STAT, { props: {} }); nk.g.clearCache(); delete nk.g.props.NP_API_KEY;
  ok(nk.g.call('hourlyJob') === undefined && nk.st.calls.length === 0 && toChat(nk.g, 501).length === 0, 'нет ключа: hourlyJob ничего не опрашивает');
  // ошибка API
  const e = mk(3, STAT); e.st.apiDown = true;
  const en = e.g.call('npTrackJob_');
  ok(en === 0 && toChat(e.g, 501).length === 0 && svcB(e.g, 'P-0201').ar === undefined, 'ошибка API: тихо, без сообщений и отметок');
  ok(!e.g.sent.some(m => m.method === 'sendMessage' && /Підказки Нової пошти|Нова пошта/.test(m.payload.text || '') && String(m.payload.chat_id) === '900'), 'ошибка опроса не шлёт тревогу админам');
  e.st.apiDown = false; e.g.props.NP_TRACK_LAST = '0';
  ok(e.g.call('npTrackJob_') === 2, 'в следующий раз — сообщения уходят');
  ok(noSecrets(npAll(e.g) + npAll(g)), 'ключ не в логах и сообщениях');
  // hourlyJob запускает опрос
  const h = mk(3, STAT); h.g.call('hourlyJob');
  ok(toChat(h.g, 501).length === 1, 'hourlyJob запускает npTrackJob_');
  // пачки по 100
  const many = []; for (let i = 0; i < 250; i++) many.push({ num: 'P-' + (3000 + i), uid: 700 + i, ago: 2, status: 'відправлено', svc: { i: [['SPS-001', 50, 1]], ttn: '2045' + String(10000000 + i) } });
  const bg = fuWorld({ props: { NP_API_KEY: NPK }, settings: { np_track_hours: 1 }, orders: many }); const bs = npStub9(bg, {});
  bg.call('npTrackJob_');
  const bc = npOf(bs, 'getStatusDocuments').map(c => c.methodProperties.Documents.length);
  ok(bc.join() === '100,100,50', 'до 100 номеров за вызов', bc);
  // сбой отправки не даёт второго сообщения
  const f = mk(3, STAT); f.g.setTelegramFail((m, p) => { if (p.calledMethod) { f.st.calls.push(p); return { success: true, data: p.methodProperties.Documents.map(d => ({ Number: d.DocumentNumber, StatusCode: '7' })) }; } return m === 'sendMessage' ? { ok: false, error_code: 500, description: 'x' } : null; });
  f.g.call('npTrackJob_'); f.g.props.NP_TRACK_LAST = '0'; f.g.call('npTrackJob_');
  ok(f.g.sent.filter(m => m.method === 'sendMessage' && String(m.payload.chat_id) === '501').length === 1, 'отметка ставится до отправки: даже при сбое Telegram второй попытки нет');
}

console.log('Волна Б2, блок 4: без ключа и без отправителя — всё как прежде');
{
  const base = fuWorld({ orders: npOrders(), settings: { np_track_hours: 3 } });
  const sb = npStub9(base);
  const cat0 = catalog(base).c, ord0 = admP(base, 900, 'admin.orders');
  ok(!('np' in cat0.shop) && !('npp' in cat0.shop) && !('npTtn' in ord0), 'без ключа: в каталоге нет np и npp, в админ-панели нет npTtn');
  ok(base.get({ action: 'np.price', city: NPC, w: 1000, sum: 500 }).error === 'off' && base.get({ action: 'np.city', q: 'Харків' }).error === 'off', 'np.price и np.city: off');
  ok(admP(base, 900, 'admin.ttn.preview', { num: 'P-0101' }).error === 'off' && admP(base, 900, 'admin.ttn.create', { num: 'P-0101', weight: 1000, confirm: true }).error === 'off', 'preview и create: off');
  base.call('hourlyJob'); base.call('dailyJob');
  ok(sb.calls.length === 0, 'hourlyJob и dailyJob без ключа не обращаются к НП');
  // с ключом, но без отправителя: каталог и админ-панель отличаются только прежним shop.np
  const k = fuWorld({ orders: npOrders(), props: { NP_API_KEY: NPK } }); npStub9(k);
  const cat1 = catalog(k).c, ord1 = admP(k, 900, 'admin.orders');
  const strip = (o) => { const c = JSON.parse(JSON.stringify(o)); if (c.shop) delete c.shop.np; delete c.updated; return JSON.stringify(c); };
  ok(cat1.shop.np === 1 && strip(cat1) === strip(cat0), 'ключ без отправителя: каталог такой же, как без ключа, плюс прежний shop.np');
  ok(!('npTtn' in ord1) && JSON.stringify(ord1) === JSON.stringify(ord0), 'ключ без отправителя: ответ admin.orders байт-в-байт прежний');
  ok(admP(k, 900, 'admin.ttn.preview', { num: 'P-0101' }).error === 'off' && k.get({ action: 'np.price', city: NPC, w: 1000, sum: 1 }).error === 'off', 'ключ без отправителя: preview, create и np.price выключены');
  // служебные колонки и секреты
  const g = npWorld(); const st = npStub9(g);
  g.get({ action: 'np.price', city: NPC, w: 1000, sum: 500 });
  admP(g, 900, 'admin.ttn.preview', { num: 'P-0101' }); admP(g, 900, 'admin.ttn.create', { num: 'P-0101', weight: 1000, confirm: true });
  g.call('hourlyJob');
  const all = JSON.stringify([catalog(g).c, admP(g, 900, 'admin.orders'), admP(g, 900, 'admin.settings'), g.get({ action: 'np.price', city: NPC, w: 2000, sum: 500 })]) + npAll(g);
  ok(noSecrets(all), 'NP_API_KEY и NP_SENDER_* не встречаются ни в одном ответе, сообщении, журнале и логе');
  ok(!/СЕКРЕТ|do-smaku|33%|BOT_TOKEN|TEST_TOKEN|whsec/.test(all) && !/:999[,}]|:111[,}]|:222[,}]/.test(all), 'служебные колонки и токены не утекают');
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'apps-script', 'Stage9b2.gs'), 'utf8');
  ok(!/startPolling\s*\(/.test(src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')), 'Stage9b2.gs не вызывает startPolling()');
  ok(!g.sent.some(m => m.method === 'deleteWebhook' || m.method === 'getUpdates'), 'webhook не трогается');
}

console.log('Аудит Б2, исправления A-J');
{
  // A: не больше 5 пересылок админам за окно
  const g = fuWorld({ settings: { followup1_days: 3 }, clients: [{ uid: 501 }], orders: [{ num: 'P-0101', uid: 501, dn: 3.5 }] });
  g.call('followupJob_');
  const n0 = g.sent.length;
  for (let i = 0; i < 40; i++) msgB(g, 501, 'спам ' + i);
  const fw = toChat(g, 900, n0).filter(x => /Відповідь клієнта/.test(x.payload.text));
  ok(fw.length === 5, 'A: из 40 сообщений клиента админу ушло ровно 5', fw.length);
  const n1 = g.sent.length;
  msgB(g, 501, 'ще');
  ok(toChat(g, 900, n1).length === 0 && g.sent.slice(n1).some(m => String(m.payload.chat_id) === '501'), 'A: после лимита админам не уходит, клиенту — обычная обработка бота');
}
{
  // B: публичные подсказки не расходуют админский счётчик
  const g = npWorld(); const st = npStub9(g);
  for (let i = 0; i < 450; i++) g.get({ action: 'np.city', q: 'zz' + i });
  const pub = st.calls.length;
  const pv = admP(g, 900, 'admin.ttn.preview', { num: 'P-0101' });
  const cr = admP(g, 900, 'admin.ttn.create', { num: 'P-0101', weight: 1000, confirm: true });
  ok(pub === 400 && pv.ok && cr.ok === true && npOf(st, 'save').length === 1, 'B: публичные вызовы упёрлись в 400, preview и create работают', { pub, pv: pv.error, cr: cr.error });
  ok(g.get({ action: 'np.price', city: NPC, w: 1000, sum: 1 }).ok === false, 'B: публичный np.price тоже за потолком');
  const g2 = npWorld(); npStub9(g2);
  g2.call('npCall_', 'getWarehouses', { CityRef: NPC, FindByString: '1' }, { admin: true });
  ok(/^1\|/.test(g2.cache['np_calls_adm'] || '') && !g2.cache['np_calls'], 'B: админский вызов считается в отдельном счётчике');
}
{
  // C: сбой записи после успеха НП — номер в ответе, метка остаётся
  const g = npWorld(); const st = npStub9(g);
  g.sandbox.setTtn_ = function () { throw new Error('Lock timeout'); };
  const r = admP(g, 900, 'admin.ttn.create', { num: 'P-0101', weight: 1000, confirm: true });
  ok(r.ok === false && r.error === 'save_failed' && r.ttn === TTN1 && r.msg.ua && r.msg.ru, 'C: исключение при записи: save_failed с номером ТТН', r);
  ok(svcB(g, 'P-0101').tp > 0 && svcB(g, 'P-0101').ttn === undefined, 'C: метка «создание идёт» не снята');
  const r2 = admP(g, 900, 'admin.ttn.create', { num: 'P-0101', weight: 1000, confirm: true });
  ok(r2.error === 'busy' && npOf(st, 'save').length === 1, 'C: повтор — busy, второй накладной нет');
  const g3 = npWorld(); npStub9(g3);
  g3.sandbox.setTtn_ = function () { return { ok: false, error: 'server_error' }; };
  const r3 = admP(g3, 900, 'admin.ttn.create', { num: 'P-0101', weight: 1000, confirm: true });
  ok(r3.error === 'save_failed' && r3.ttn === TTN1 && svcB(g3, 'P-0101').tp > 0, 'C: setTtn_ вернул отказ: то же самое');
}
{
  // D: админка без «Склад (UA)» не пишет состав в «Склад набору»
  const g = fresh();
  const rows = g.sheets['Товари'].rows;
  ok(rows[0].indexOf('Склад (UA)') < 0, 'D: в тестовой таблице нет колонки «Склад (UA)»');
  rows[0].push('Склад набору'); rows.slice(1).forEach(r => r.push(''));
  const setRow = rows[0].map(() => ''); const H = n => rows[0].indexOf(n);
  setRow[H('ID')] = 'SET-001'; setRow[H('Категорія (UA)')] = 'Спеції'; setRow[H('Назва (UA)')] = 'Набір'; setRow[H('Тип')] = 'упаковка'; setRow[H('Ціна за упаковку/шт')] = 135; setRow[H('Наявність')] = 'є'; setRow[H('Склад набору')] = 'SPS-001, SPS-022';
  rows.push(setRow);
  const ap = admP(g, 900, 'admin.products');
  ok(ap.products.find(p => p.id === 'SET-001').cUa === '', 'D: админка не показывает «Склад набору» как состав товара');
  const upd = admP(g, 900, 'admin.product', { id: 'SPS-001', patch: { cUa: 'Зіра, барбарис' } });
  const rr = g.sheets['Товари'].rows;
  ok(upd.ok && rr[0].indexOf('Склад (UA)') >= 0 && rr.find(r => r[0] === 'SPS-001')[rr[0].indexOf('Склад (UA)')] === 'Зіра, барбарис', 'D: состав записан в новую колонку «Склад (UA)»', upd);
  ok(rr.find(r => r[0] === 'SPS-001')[rr[0].indexOf('Склад набору')] === '' && rr.find(r => r[0] === 'SET-001')[rr[0].indexOf('Склад набору')] === 'SPS-001, SPS-022', 'D: «Склад набору» не тронута');
  const fx = g.sandbox.fixProductCols_({ photo: 3, photo2: 3 }, ['ID', 'x', 'y', 'Фото 2', 'Фото (посилання)']);
  ok(fx.photo === 4, 'D: «Фото 2» не подменяет «Фото (посилання)» в общем разборе');
}
{
  // E: success без разборчивого номера — метку не снимаем
  const g = npWorld(); const st = npStub9(g, { save: 'nonum' });
  const r = admP(g, 900, 'admin.ttn.create', { num: 'P-0101', weight: 1000, confirm: true });
  const r2 = admP(g, 900, 'admin.ttn.create', { num: 'P-0101', weight: 1000, confirm: true });
  ok(r.error === 'np_unknown' && r2.error === 'busy' && npOf(st, 'save').length === 1, 'E: ответ без номера — np_unknown, повтор — busy, дубля нет');
}
{
  // F: повтор rid с другим «Якщо немає» или городом — не создаёт второй заказ
  const g = fuWorld({ orders: [] });
  const base = { action: 'order', initData: g.initData(U(601)), items: [{ id: 'NUT-007', g: 0, q: 1 }], total: 85, name: 'Іваненко Олена', phone: '+380501234567', delivery: 'pickup', pay: 'cash', lang: 'ua', rid: 'rid-F1' };
  const r1 = g.post(Object.assign({ ifOut: 'call' }, base));
  const same = g.post(Object.assign({ ifOut: 'call' }, base));
  const other = g.post(Object.assign({ ifOut: 'remove' }, base));
  const n = g.sheets['Замовлення'].rows.length - 1;
  ok(r1.ok && same.ok && same.number === r1.number, 'F: точный повтор rid возвращает тот же заказ', { r1, same });
  ok(other.ok === false && other.error === 'dup_changed' && n === 1, 'F: другой «Якщо немає» с тем же rid — dup_changed, второго заказа нет', { other, n });
  const b2 = Object.assign({}, base, { rid: 'rid-F2', delivery: 'np', city: 'Харків', branch: '12', cityRef: NPC });
  const q1 = g.post(b2);
  const q2 = g.post(Object.assign({}, b2, { cityRef: 'bbbbbbbb-1111-2222-3333-444444444444' }));
  ok(q1.ok && q2.error === 'dup_changed' && g.sheets['Замовлення'].rows.length - 1 === 2, 'F: другой cityRef с тем же rid — dup_changed, второго заказа нет', { q1, q2 });
}
{
  // G: отметка по номеру заказа, а не только по номеру строки
  const g = fuWorld({ orders: [{ num: 'P-0101', uid: 501, dn: 1 }, { num: 'P-0102', uid: 502, dn: 1 }, { num: 'P-0103', uid: 503, dn: 1 }] });
  const sheet = g.sandbox.SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Замовлення');
  const col = g.sandbox.orderCols_(sheet);
  const rows = g.sheets['Замовлення'].rows;
  const r1 = rows[1], r2 = rows[2], r3 = rows[3];
  rows.length = 1; rows.push(r3, r1); // удалили P-0102 и поменяли порядок: P-0103 в строке 2, P-0101 в строке 3
  ok(rows[1][0] === 'P-0103' && rows[2][0] === 'P-0101', 'G: подготовка — строки сдвинулись после снимка');
  ok(g.sandbox.fuSetSvcMark_(sheet, col, 2, 'f1', 'P-0101') === true && svcB(g, 'P-0101').f1 === 1 && svcB(g, 'P-0103').f1 === undefined, 'G: номер в строке не совпал — отметка легла на нужный заказ, чужой не тронут');
  ok(g.sandbox.fuSetSvcMark_(sheet, col, 2, 'f1', 'P-0102') === false && svcB(g, 'P-0103').f1 === undefined, 'G: заказа с таким номером уже нет — отметки нет');
  ok(g.sandbox.fuSetSvcMark_(sheet, col, 2, 'f1', 'P-0103') === true && svcB(g, 'P-0103').f1 === 1, 'G: номер совпал — отметка в этой же строке');
}
{
  // H: лимит 14 дней держится, даже если «Останнє повідомлення» записать не удалось
  const g = fuWorld({ settings: { followup1_days: 3 }, clientCols: ['Останнє повідомлення', 'Очікуємо відповідь'], clients: [{ uid: 501 }], orders: [{ num: 'P-0101', uid: 501, dn: 3.5 }, { num: 'P-0102', uid: 501, dn: 3.6 }] });
  g.sandbox.fuClientWrite_ = function () { return false; };
  const a = g.call('followupJob_');
  g.advance(FUD);
  const b = g.call('followupJob_');
  ok(a.f1 === 1 && b.f1 === 0 && toChat(g, 501).length === 1, 'H: запись в «Клієнти» не удалась, но второй заказ клиента на следующий день не получил followup1', { a, b });
  ok(svcB(g, 'P-0101').ft > 0 || svcB(g, 'P-0102').ft > 0, 'H: время отправки хранится в «Службове» (ft)');
}
{
  // I: значения NP_SENDER_* вычищаются из текстов ошибок
  const g = npWorld(); npStub9(g);
  const t = g.sandbox.npSafeReason_('x ' + SENDER.NP_SENDER_REF + ' ' + SENDER.NP_SENDER_CONTACT + ' ' + SENDER.NP_SENDER_CITY + ' ' + SENDER.NP_SENDER_ADDRESS + ' ' + SENDER.NP_SENDER_PHONE + ' 380671112233 ' + NPK, NPK, 300);
  ok(noSecrets(t) && !t.includes(SENDER.NP_SENDER_CITY) && !t.includes(SENDER.NP_SENDER_PHONE) && !t.includes(NPK), 'I: все пять NP_SENDER_* и ключ вычищены', t);
  const g2 = npWorld();
  g2.setTelegramFail((m, p) => {
    if (!p.calledMethod) return null;
    if (p.calledMethod === 'getWarehouses') return { success: true, data: [{ Ref: NPW, Number: '12', Description: 'В', CityDescription: 'Харків', CategoryOfWarehouse: 'Branch' }] };
    return { success: false, errors: ['bad sender ' + SENDER.NP_SENDER_REF + ' / ' + SENDER.NP_SENDER_ADDRESS + ' / ' + SENDER.NP_SENDER_CITY], data: [] };
  });
  const r = admP(g2, 900, 'admin.ttn.create', { num: 'P-0101', weight: 1000, confirm: true });
  ok(r.error === 'np_api' && noSecrets(JSON.stringify(r) + npAll(g2)) && !JSON.stringify(r).includes(SENDER.NP_SENDER_CITY), 'I: ошибка API с данными отправителя — в ответе, логе и журнале их нет', r);
}
{
  // J: город заказа не совпал с городом НП по Ref
  const extra = npOrders().concat([
    { num: 'P-0201', uid: 601, ago: 1, status: 'підтверджено', name: NPNAME, delivery: 'Нова пошта', city: 'Київ', branch: '12', total: 500, svc: { i: [['SPS-001', 100, 1]], nc: NPC } },
    { num: 'P-0202', uid: 602, ago: 1, status: 'підтверджено', name: NPNAME, delivery: 'Нова пошта', city: 'м. Харків, Харківська обл.', branch: '12', total: 500, svc: { i: [['SPS-001', 100, 1]], nc: NPC } }
  ]);
  const g = npWorld({ orders: extra }); const st = npStub9(g);
  const pv = admP(g, 900, 'admin.ttn.preview', { num: 'P-0201' });
  ok(pv.ok && pv.ttn.cityDiff === 1 && pv.ttn.npCity === 'Харків', 'J: preview показывает cityDiff: 1 при расхождении', pv);
  ok(!('cityDiff' in admP(g, 900, 'admin.ttn.preview', { num: 'P-0101' }).ttn) && !('cityDiff' in admP(g, 900, 'admin.ttn.preview', { num: 'P-0202' }).ttn), 'J: без расхождения поля нет («Харків», «м. Харків, Харківська обл.»)');
  const c0 = admP(g, 900, 'admin.ttn.create', { num: 'P-0201', weight: 1000, confirm: true });
  const c1 = admP(g, 900, 'admin.ttn.create', { num: 'P-0201', weight: 1000, confirm: true, cityOk: 'true' });
  ok(c0.error === 'city_diff' && c0.msg.ua && c0.msg.ru && c1.error === 'city_diff' && npOf(st, 'save').length === 0, 'J: create без cityOk: true — city_diff с текстом UA/RU, вызова save нет', { c0, c1 });
  const c2 = admP(g, 900, 'admin.ttn.create', { num: 'P-0201', weight: 1000, confirm: true, cityOk: true });
  ok(c2.ok === true && npOf(st, 'save').length === 1, 'J: с cityOk: true накладная создаётся');
  st.ttnNext = '20450000000005';
  ok(admP(g, 900, 'admin.ttn.create', { num: 'P-0101', weight: 1000, confirm: true }).ok === true, 'J: без расхождения cityOk не нужен (как раньше)');
}

/* ============ Волна Б2, доработка Новой пошты: отправитель через API, создание, удаление, трекинг ============ */
const SKH = 'd0000000-1111-2222-3333-000000000001', SKH2 = 'd0000000-1111-2222-3333-000000000002';
const SWH = 'd0000000-1111-2222-3333-000000000034', SWP = 'd0000000-1111-2222-3333-00000000034a', SW134 = 'd0000000-1111-2222-3333-000000000134';
const SCP = 'd0000000-1111-2222-3333-0000000000c1', SCP2 = 'd0000000-1111-2222-3333-0000000000c2';
const SCT = 'd0000000-1111-2222-3333-0000000000d1', SCT2 = 'd0000000-1111-2222-3333-0000000000d2';
const SKY = 'd0000000-1111-2222-3333-0000000000e1';
const SPHONE = '380671112233';
const SNDREFS = [SKH, SWH, SCP, SCT];
const sndSecret = t => !t.includes(NPK) && !t.includes(SPHONE) && !t.includes('0671112233') && !t.includes('671112233') && SNDREFS.every(r => !t.includes(r));

/** Стенд API НП для разрешения отправителя. Только чтение; все вызовы пишутся в st.calls. */
function sndStub(g, o) {
  o = o || {};
  const st = { calls: [], o };
  g.setTelegramFail((method, payload) => {
    if (!payload.calledMethod) return null;
    st.calls.push(payload);
    const q = payload.methodProperties || {};
    if (st.o.limit) return limBody(st.o.limit);
    if (st.o.apiDown) return { success: false, errors: ['API key is invalid ' + payload.apiKey + ' phone ' + SPHONE], data: [] };
    const first = !q.Page || q.Page === '1';
    switch (payload.calledMethod) {
      case 'getCities':
        if (!first) return { success: true, data: [] };
        if (q.FindByString === 'Київ') return { success: true, data: [{ Ref: SKY, Description: 'Київ' }] };
        if (q.FindByString === 'Харків') {
          if (st.o.noCity) return { success: true, data: [{ Ref: SKH2, Description: 'Харківці' }] };
          return { success: true, data: [{ Ref: SKH, Description: 'Харків' }, { Ref: SKH2, Description: 'Харківці' }].concat(st.o.twoCities ? [{ Ref: 'd0000000-1111-2222-3333-0000000000f9', Description: 'Харків' }] : []) };
        }
        return { success: true, data: [] };
      case 'getWarehouses': {
        if (!first || q.CityRef !== SKH) return { success: true, data: [] };
        if (st.o.narrowEmpty && q.WarehouseId) return { success: true, data: [] };
        if (st.o.noWh) return { success: true, data: [{ Ref: SW134, Number: '134', CityRef: SKH, Description: 'Відділення №134', CategoryOfWarehouse: 'Branch' }] };
        const cr = st.o.whWrongCity ? SKH2 : SKH;
        return { success: true, data: [
          { Ref: SWP, Number: '34', CityRef: cr, Description: 'Поштомат №34', CategoryOfWarehouse: 'Postomat' },
          { Ref: SWH, Number: '34', CityRef: cr, Description: 'Поштове відділення №34 (до 30 кг): вул. Різдвяна, 14', CategoryOfWarehouse: 'Branch' },
          { Ref: SW134, Number: '134', CityRef: SKH, Description: 'Відділення №134', CategoryOfWarehouse: 'Branch' }] };
      }
      case 'getCounterparties':
        if (!first) return { success: true, data: [] };
        if (st.o.noCp) return { success: true, data: [] };
        return { success: true, data: [{ Ref: SCP, Description: 'ФОП Тестовий' }].concat(st.o.manyCp ? [{ Ref: SCP2, Description: 'Інший' }] : []) };
      case 'getCounterpartyContactPersons':
        if (!first || q.Ref !== SCP) return { success: true, data: [] };
        return { success: true, data: st.o.contacts || [{ Ref: SCT, Description: 'Тестовий Контакт', Phones: SPHONE }] };
      case 'getDocumentPrice': return { success: true, data: [{ Cost: '88' }] };
      default: return { success: true, data: [] };
    }
  });
  return st;
}
const sndWorld = (props, extra) => fuWorld(Object.assign({ props: Object.assign({ NP_API_KEY: NPK, NP_SENDER_PHONE: '+38 (067) 111-22-33', NP_SENDER_WAREHOUSE: '34' }, props || {}), orders: npOrders() }, extra || {}));
const alertsTo = (g, uid) => toChat(g, uid).filter(m => /Нова пошта: не вдалося визначити дані відправника/.test(m.payload.text || ''));

console.log('Доработка НП: нормализация телефона');
{
  const g = npWorld();
  const n = v => g.sandbox.npPhone_(v);
  ok(['380671112233', '+380671112233', '0671112233', '+38 (067) 111-22-33', '80671112233', ' 067-111-22-33 '].every(v => n(v) === '380671112233'), 'пять форм (380…, +380…, 0…, с пробелами/скобками/дефисами, 80…) приводятся к 380XXXXXXXXX');
  ok([null, undefined, '', 'abc', '12345', '+4915112345678', '3806711122334', '671112233', '+380 67 111'].every(v => n(v) === null), 'мусор, чужой код страны, неполный и слишком длинный номер — null («нет данных»)');
  const gb = sndWorld({ NP_SENDER_PHONE: 'не телефон' }); const sb = sndStub(gb);
  ok(gb.sandbox.npSender_().phone === null && gb.sandbox.npTtnOn_() === false, 'невалидный NP_SENDER_PHONE: телефона нет, «Створити ТТН» выключено');
}

console.log('Доработка НП: разрешение отправителя через API и кэш');
{
  const g = sndWorld(); const st = sndStub(g);
  const c0 = catalog(g).c, o0 = admP(g, 900, 'admin.orders');
  ok(st.calls.length === 0 && !('npp' in c0.shop) && !('npTtn' in o0), 'до разрешения: каталог и админ-панель без сетевых вызовов, shop.npp и npTtn нет');
  g.call('hourlyJob');
  const seq = st.calls.map(c => c.modelName + '.' + c.calledMethod).filter(x => !/getStatusDocuments/.test(x));
  ok(seq.join() === 'Address.getCities,Address.getCities,Address.getWarehouses,Address.getWarehouses,Counterparty.getCounterparties,Counterparty.getCounterparties,Counterparty.getCounterpartyContactPersons,Counterparty.getCounterpartyContactPersons'
    || seq[0] === 'Address.getCities' && seq.indexOf('Address.getWarehouses') > 0 && seq.indexOf('Counterparty.getCounterparties') > seq.indexOf('Address.getWarehouses') && seq.indexOf('Counterparty.getCounterpartyContactPersons') > seq.indexOf('Counterparty.getCounterparties'), 'hourlyJob: город → отделение → контрагент → контакт', seq);
  ok(st.calls.find(c => c.calledMethod === 'getCities').methodProperties.FindByString === 'Харків', 'город ищется по названию «Харків» (по умолчанию)');
  const w0 = st.calls.find(c => c.calledMethod === 'getWarehouses').methodProperties;
  ok(w0.CityRef === SKH && w0.WarehouseId === '34', 'отделение: Address.getWarehouses, CityRef + WarehouseId строкой «34»', w0);
  ok(st.calls.find(c => c.calledMethod === 'getCounterparties').methodProperties.CounterpartyProperty === 'Sender', 'контрагент: CounterpartyProperty = Sender');
  ok(st.calls.find(c => c.calledMethod === 'getCounterpartyContactPersons').methodProperties.Ref === SCP, 'контакт: getCounterpartyContactPersons по Ref контрагента');
  const s = g.call('npSender_');
  ok(s.city === SKH && s.address === SWH && s.ref === SCP && s.contact === SCT && s.phone === SPHONE, 'npSender_: Ref-ы найдены, отделение №34 — не почтомат №34, телефон нормализован', s);
  ok(!!g.props.NP_SENDER_CACHE && !g.props.NP_SENDER_CACHE.includes(SPHONE) && !g.props.NP_SENDER_CACHE.includes('671112233') && !g.props.NP_SENDER_CACHE.includes(NPK), 'NP_SENDER_CACHE записан, в нём нет телефона и ключа (только хэш)');
  const n1 = st.calls.length;
  const c1 = catalog(g).c, o1 = admP(g, 900, 'admin.orders');
  ok(c1.shop.npp === 1 && o1.npTtn === 1 && st.calls.length === n1, 'после разрешения: shop.npp = 1, npTtn = 1; каталог и админ-панель сети не трогают');
  g.call('hourlyJob'); g.call('npSender_');
  ok(st.calls.length === n1, 'повторно: из кэша, без сети');
  g.clearCache();
  ok(g.call('npSender_').address === SWH && st.calls.length === n1, 'кэш CacheService пуст: данные берутся из NP_SENDER_CACHE, без сети');
  // смена входных значений
  g.props.NP_SENDER_WAREHOUSE = '134'; g.clearCache();
  ok(!g.call('npSender_').address && !g.call('npTtnOn_'), 'смена номера отделения: старый кэш не подходит (отпечаток), ТТН выключено до пересчёта');
  g.call('hourlyJob');
  ok(g.call('npSender_').address === SW134 && st.calls.length > n1, 'пересчёт при смене входных значений: новый Ref отделения');
  const n2 = st.calls.length;
  g.props.NP_SENDER_PHONE = '0501234567'; g.clearCache();
  ok(!g.call('npTtnOn_'), 'смена телефона тоже меняет отпечаток');
  // срок 30 дней
  g.props.NP_SENDER_PHONE = '+380671112233'; g.call('hourlyJob'); g.clearCache();
  const cc = JSON.parse(g.props.NP_SENDER_CACHE); cc.at = Date.now() - 31 * 24 * 3600 * 1000; g.props.NP_SENDER_CACHE = JSON.stringify(cc); g.clearCache();
  ok(!g.call('npSender_').city, 'кэш старше 30 дней не используется');
  ok(sndSecret(JSON.stringify([c1, o1]) + npAll(g)), 'ключ, телефон и Ref-ы отправителя не в ответах, логах и сообщениях');
}
{
  // переопределение старыми свойствами
  const g = sndWorld({ NP_SENDER_CITY: SKH, NP_SENDER_ADDRESS: SWH, NP_SENDER_REF: SCP, NP_SENDER_CONTACT: SCT }); const st = sndStub(g);
  g.call('hourlyJob');
  ok(st.calls.length === 0 && g.call('npTtnOn_') === true && g.call('npSender_').address === SWH, 'все четыре Ref-свойства заданы: используются без запросов');
  const g2 = sndWorld({ NP_SENDER_CITY: SKH }); const s2 = sndStub(g2);
  g2.call('hourlyJob');
  ok(!s2.calls.some(c => c.calledMethod === 'getCities') && s2.calls.some(c => c.calledMethod === 'getWarehouses') && g2.call('npTtnOn_') === true, 'заданы не все: недостающее ищется, заданное не запрашивается');
  const g3 = fuWorld({ props: { NP_API_KEY: NPK }, orders: npOrders() }); const s3 = sndStub(g3);
  g3.call('hourlyJob');
  ok(s3.calls.length === 0, 'ключ есть, но нет ни NP_SENDER_WAREHOUSE, ни NP_SENDER_PHONE: hourlyJob к НП не ходит');
  const g4 = sndWorld({}, { orders: [] }); const s4 = sndStub(g4, { narrowEmpty: true });
  g4.call('hourlyJob');
  const wc = s4.calls.filter(c => c.calledMethod === 'getWarehouses').map(c => c.methodProperties);
  ok(g4.call('npSender_').address === SWH && wc.length >= 2 && wc[0].WarehouseId === '34' && !wc[1].WarehouseId && wc.every(w => w.CityRef === SKH), 'узкий запрос пуст: запасной перебор страниц города, результат проверен по Number и CityRef', wc);
  const g5 = sndWorld({ NP_SENDER_PHONE: '+380509998877' }); sndStub(g5, { contacts: [{ Ref: SCT, Phones: '380671112233' }, { Ref: SCT2, Phones: '+38 (050) 999-88-77' }] });
  g5.call('hourlyJob');
  ok(g5.call('npSender_').contact === SCT2, 'контакт выбирается по телефону после нормализации');
  const g6 = sndWorld({ NP_SENDER_PHONE: '+380509998877' }); sndStub(g6, { contacts: [{ Ref: SCT, Phones: '380671112233' }] });
  g6.call('hourlyJob');
  ok(g6.call('npSender_').contact === SCT, 'телефон не совпал, но контакт один — берётся он');
  const g7 = sndWorld({ NP_SENDER_PHONE: '+380509998877' }); sndStub(g7, { contacts: [{ Ref: SCT, Phones: '380671112233' }, { Ref: SCT2, Phones: '380000000000' }] });
  g7.call('hourlyJob');
  ok(!g7.call('npSender_').contact && !g7.call('npTtnOn_') && alertsTo(g7, 900).length === 1 && /NP_SENDER_CONTACT/.test(alertsTo(g7, 900)[0].payload.text), 'несколько контактов и нет совпадения: ошибка, совет вписать NP_SENDER_CONTACT');
}

console.log('Доработка НП: ошибки разрешения, тихий режим, тревога раз в сутки');
{
  const cases = [
    ['несколько контрагентов', { manyCp: true }, /NP_SENDER_REF/, (s) => s.city === SKH && !s.ref],
    ['отделение №34 не найдено', { noWh: true }, /NP_SENDER_ADDRESS/, (s) => s.city === SKH && !s.address],
    ['два города с одним названием', { twoCities: true }, /NP_SENDER_CITY/, (s) => !s.city],
    ['города нет', { noCity: true }, /NP_SENDER_CITY_NAME/, (s) => !s.city],
    ['нет контрагентов', { noCp: true }, /NP_SENDER_REF/, (s) => !s.ref],
    ['отделение другого города', { whWrongCity: true }, /NP_SENDER_ADDRESS/, (s) => !s.address],
    ['ошибка API', { apiDown: true }, /Нова пошта відхилила запит/, (s) => !s.city]
  ];
  cases.forEach(([title, o, re, chk]) => {
    const g = sndWorld(); const st = sndStub(g, o);
    const r = g.call('npSenderResolve_');
    const s = g.call('npSender_');
    g.call('hourlyJob');
    const al = alertsTo(g, 900);
    ok(r.ok === false && chk(s) && g.call('npTtnOn_') === false, title + ': отправитель не разрешён, «Створити ТТН» скрыта', s);
    ok(al.length === 1 && re.test(al[0].payload.text) && /Етап 9Б2: перевірити Нову пошту/.test(al[0].payload.text) && /Новая почта: не удалось/.test(al[0].payload.text), title + ': админу одно понятное сообщение (UA и RU) с советом запустить проверку');
    ok(sndSecret(al[0].payload.text + npAll(g)), title + ': в тревоге и логах нет ключа, телефона и Ref-ов');
    const pr = g.call('npPriceOn_');
    ok(pr === !!s.city, title + ': стоимость доставки включена только если известен город отправителя');
    ok(admP(g, 900, 'admin.ttn.preview', { num: 'P-0101' }).error === 'off', title + ': preview — off');
  });
  // раз в сутки
  const g = sndWorld(); sndStub(g, { manyCp: true });
  g.call('hourlyJob'); g.call('hourlyJob'); g.call('hourlyJob');
  ok(alertsTo(g, 900).length === 1 && !!g.props.NP_ALERT_LAST, 'тревога не чаще раза в сутки: три запуска — одно сообщение, отметка NP_ALERT_LAST');
  g.advance(25 * 3600 * 1000); g.call('hourlyJob');
  ok(alertsTo(g, 900).length === 2, 'через сутки — ещё одно');
  // магазин работает как раньше
  const co = catalog(g).c;
  ok(co.shop.np === 1 && co.shop.npp === 1 && g.get({ action: 'np.city', q: 'Харків' }).ok !== undefined, 'подсказки города и отделения для покупателя по-прежнему доступны');
  // обычный пользователь не получает тревогу
  ok(alertsTo(g, 501).length === 0, 'клиентам тревога не уходит');
  // телефон неверный при остальном готовом
  const gp = sndWorld({ NP_SENDER_PHONE: 'abc', NP_SENDER_CITY: SKH, NP_SENDER_ADDRESS: SWH, NP_SENDER_REF: SCP, NP_SENDER_CONTACT: SCT }); sndStub(gp);
  gp.call('hourlyJob');
  ok(alertsTo(gp, 900).length === 1 && /NP_SENDER_PHONE/.test(alertsTo(gp, 900)[0].payload.text) && gp.call('npTtnOn_') === false, 'неверный телефон при готовых Ref-ах: сообщение про NP_SENDER_PHONE, ТТН выключено');
}

console.log('Доработка НП: пункт меню «Етап 9Б2: перевірити Нову пошту»');
{
  const g = sndWorld(); const st = sndStub(g);
  const r = g.call('stage9b2CheckNp');
  const readOnly = ['getCities', 'getWarehouses', 'getCounterparties', 'getCounterpartyContactPersons', 'getDocumentPrice'];
  ok(r.ok && /Ключ: є/.test(r.message) && /Місто відправника: знайдено \(Харків\)/.test(r.message) && /Відділення №34: знайдено \(Поштове відділення №34/.test(r.message) && /Відправник: знайдено \(ФОП Тестовий\)/.test(r.message) && /Контакт: знайдено/.test(r.message) && /Вартість доставки 1 кг до Києва: 88 ₴/.test(r.message), 'итог по строкам: ключ, город, отделение №34, отправитель, контакт, стоимость', r.message);
  ok(st.calls.every(c => readOnly.indexOf(c.calledMethod) >= 0), 'только читающие вызовы, ничего не создаётся у НП', st.calls.map(c => c.calledMethod));
  const pc = st.calls.find(c => c.calledMethod === 'getDocumentPrice').methodProperties;
  ok(pc.CitySender === SKH && pc.CityRecipient === SKY && pc.Weight === '1', 'стоимость: Харків → Київ, 1 кг');
  ok(sndSecret(r.message) && g.ui.alerts.length === 1 && sndSecret(g.ui.alerts[0]), 'в тексте нет ключа, телефона и Ref-ов; текст показан владельцу');
  ok(!!g.props.NP_SENDER_CACHE && g.call('npTtnOn_') === true && catalog(g).c.shop.npp === 1, 'меню сохранило кэш: shop.npp и «Створити ТТН» включены');
  const gm = sndWorld({}, {}); sndStub(gm, { manyCp: true });
  const rm = gm.call('stage9b2CheckNp');
  ok(/Відправник: не визначено: .*NP_SENDER_REF/.test(rm.message) && /Місто відправника: знайдено/.test(rm.message) && /Вартість доставки 1 кг до Києва: 88/.test(rm.message) && /«Створити ТТН»: вимкнено/.test(rm.message) && !rm.message.includes(NPK) && !rm.message.includes('671112233'), 'ошибка: точная причина и какое свойство вписать, остальные строки на месте');
  const gk = fuWorld({ orders: [] }); const sk = sndStub(gk);
  const rk = gk.call('stage9b2CheckNp');
  ok(!rk.ok && /Ключ: немає/.test(rk.message) && /NP_API_KEY/.test(rk.message) && sk.calls.length === 0, 'без ключа: «Ключ: немає», вызовов нет');
  const ga = sndWorld(); sndStub(ga, { apiDown: true });
  const ra = ga.call('stage9b2CheckNp');
  ok(sndSecret(ra.message) && /не знайдено/.test(ra.message), 'ошибка API: текст понятный и без секретов', ra.message);
}

console.log('Доработка НП: создание — Counterparty.save → InternetDocument.save');
{
  const mk = (o) => { const g = npWorld(); const st = npStub9(g, o); return { g, st, cr: (n, x) => admP(g, 900, 'admin.ttn.create', Object.assign({ num: n, weight: 1000, confirm: true }, x || {})) }; };
  const { g, st, cr } = mk();
  const r = cr('P-0101');
  const iCp = st.calls.findIndex(c => c.modelName === 'Counterparty' && c.calledMethod === 'save');
  const iDoc = st.calls.findIndex(c => c.modelName === 'InternetDocument' && c.calledMethod === 'save');
  ok(r.ok && iCp >= 0 && iDoc > iCp, 'порядок: сначала Counterparty.save получателя, затем InternetDocument.save', { iCp, iDoc });
  const cp = st.calls[iCp].methodProperties, d = st.calls[iDoc].methodProperties;
  ok(cp.CounterpartyProperty === 'Recipient' && cp.CounterpartyType === 'PrivatePerson' && cp.CityRef === NPC && cp.LastName === 'Іваненко' && cp.FirstName === 'Олена' && cp.MiddleName === '' && cp.Phone === '380501112233', 'получатель: PrivatePerson, город получателя, фамилия/имя из подтверждённого имени, телефон 380…', cp);
  ok(d.Recipient === NPCP && d.ContactRecipient === NPCT && d.RecipientAddress === NPW && d.CityRecipient === NPC && d.PayerType === 'Recipient' && d.PaymentMethod === 'Cash' && d.CargoType === 'Parcel' && d.ServiceType === 'WarehouseWarehouse' && d.SeatsAmount === '1', 'накладная: Ref-поля получателя из шага 1, отделение найдено по номеру', d);
  ok(d.CitySender === SENDER.NP_SENDER_CITY && d.Sender === SENDER.NP_SENDER_REF && d.SenderAddress === SENDER.NP_SENDER_ADDRESS && d.ContactSender === SENDER.NP_SENDER_CONTACT && d.SendersPhone === '380671112233', 'отправитель из свойств-переопределений, телефон нормализован');
  const today = new Date(); const tz = g.sandbox.Utilities.formatDate(today, 'Europe/Kiev', 'dd.MM.yyyy');
  ok(d.DateTime === tz && d.VolumeGeneral === '0.004', 'дата dd.MM.yyyy, габариты по умолчанию 20×20×10 → VolumeGeneral');
  ok(svcB(g, 'P-0101').tr === DOCREF && svcB(g, 'P-0101').tc > 0, 'Ref документа и время создания сохранены в «Службове» (svc.tr, svc.tc)');
  ok(toChat(g, 501).some(m => /20450000000001/.test(m.payload.text)), 'без quiet клиенту ушёл номер');
  // quiet
  const q = mk(); q.st.ttnNext = '20450000000041';
  const rq = q.cr('P-0102', { quiet: true, name: 'Петренко Іван' });
  ok(rq.ok && rq.quiet === true && rq.told === null && toChat(q.g, 502).length === 0 && svcB(q.g, 'P-0102').ttn === '20450000000041' && svcB(q.g, 'P-0102').tr === DOCREF, 'quiet: номер записан, клиенту ничего не отправлено', rq);
  // габариты
  const dm = mk(); dm.cr('P-0101', { width: 20, length: '20', height: 10 });
  ok(npOf(dm.st, 'save')[0].methodProperties.VolumeGeneral === '0.004', 'габариты 20×20×10 см → VolumeGeneral 0.004 м³');
  const bad = mk();
  ok([{ width: 20 }, { width: 20, length: 20 }, { width: 0, length: 5, height: 5 }, { width: 'a', length: 5, height: 5 }, { width: 301, length: 5, height: 5 }].every(x => bad.cr('P-0101', x).error === 'bad_dims') && bad.st.calls.filter(c => c.calledMethod === 'save').length === 0, 'неполные или неверные габариты: bad_dims, к НП не обращаемся');
  const pv = admP(dm.g, 900, 'admin.ttn.preview', { num: 'P-0102', width: 10, length: 10, height: 10 });
  ok(pv.ok && pv.ttn.volume === '0.001' && !('volume' in admP(dm.g, 900, 'admin.ttn.preview', { num: 'P-0102' }).ttn) && admP(dm.g, 900, 'admin.ttn.preview', { num: 'P-0102', width: 10 }).error === 'bad_dims', 'preview: volume только при верных габаритах, иначе bad_dims');
  // контакт получателя отдельным запросом
  const nc = mk({ cp: 'nocontact' }); const rn = nc.cr('P-0101');
  ok(rn.ok && npOf(nc.st, 'getCounterpartyContactPersons').length === 1 && npOf(nc.st, 'save')[0].methodProperties.ContactRecipient === NPCT, 'нет контакта в ответе Counterparty.save: запрос getCounterpartyContactPersons по Ref получателя');
  // ошибка шага 1
  const e1 = mk({ cp: 'reject' }); const r1 = e1.cr('P-0101');
  ok(r1.ok === false && r1.error === 'np_api' && r1.step === 1 && /Phone is invalid/.test(r1.np) && npOf(e1.st, 'save').length === 0 && svcB(e1.g, 'P-0101').tp === undefined && svcB(e1.g, 'P-0101').ttn === undefined, 'ошибка шага 1: накладная не создаётся, метка снята, повтор возможен', r1);
  const e1n = mk({ cp: 'net' }); const r1n = e1n.cr('P-0101');
  ok(r1n.error === 'np_error' && r1n.step === 1 && npOf(e1n.st, 'save').length === 0 && svcB(e1n.g, 'P-0101').tp === undefined && noSecrets(JSON.stringify(r1n) + npAll(e1n.g)), 'обрыв на шаге 1: np_error, метка снята, ключа нет в тексте');
  // ошибка шага 2: больше ничего не делаем
  const e2 = mk({ save: 'reject' }); const r2 = e2.cr('P-0101');
  ok(r2.error === 'np_api' && r2.step === 2 && npCp(e2.st).length === 1 && npOf(e2.st, 'delete').length === 0 && e2.st.calls.every(c => c.calledMethod !== 'delete'), 'ошибка шага 2: np_api, лишних вызовов (удаление и т.п.) нет');
  ok(noSecrets(JSON.stringify([r, rq, r1, r2]) + npAll(g) + npAll(q.g)), 'секреты не в ответах и логах');
  // почтомат — понятный текст
  const lk = admP(g, 900, 'admin.ttn.preview', { num: 'P-0108' });
  ok(lk.error === 'locker' && /вручну/.test(lk.msg.ua) && /вручную/.test(lk.msg.ru) && /поштомат/.test(lk.msg.ua), 'почтомат: накладная вручную, понятный текст UA и RU');
}

console.log('Доработка НП: admin.ttn.delete и флаг ttnDel');
{
  const mkd = (o) => {
    const g = npWorld(); const st = npStub9(g, o);
    const rows = g.sheets['Замовлення'].rows; rows[0].push('ТТН'); rows.slice(1).forEach(r => r.push(''));
    return { g, st, cr: (n, x) => admP(g, 900, 'admin.ttn.create', Object.assign({ num: n, weight: 1000, confirm: true }, x || {})), del: (n, x, uid) => admP(g, uid || 900, 'admin.ttn.delete', Object.assign({ num: n, confirm: true }, x || {})) };
  };
  const { g, st, cr, del } = mkd();
  cr('P-0101', { quiet: true });
  const ordRow = () => g.sheets['Замовлення'].rows.find(r => r[0] === 'P-0101');
  const ttnCol = g.sheets['Замовлення'].rows[0].indexOf('ТТН');
  ok(ordRow()[ttnCol] === TTN1, 'подготовка: ТТН записана в колонку');
  ok(admP(g, 900, 'admin.orders').orders.find(x => x.num === 'P-0101').ttnDel === 1 && !('ttnDel' in admP(g, 900, 'admin.orders').orders.find(x => x.num === 'P-0102')), 'admin.orders: ttnDel: 1 только у заказа с накладной, созданной магазином');
  ok(del('P-0101', { confirm: undefined }).error === 'not_confirmed' && npOf(st, 'delete').length === 0, 'без confirm: true — отказ, вызова нет');
  ok(del('P-0107').error === 'del_no' && del('P-0107').msg.ua && del('P-0107').msg.ru, 'есть ТТН, но нет svc.tr (создана не магазином): отказ с текстом UA и RU');
  ok(del('P-9999').error === 'not_found' && del('bad').error === 'not_found', 'нет заказа: not_found');
  const sent0 = g.sent.length;
  const rd = del('P-0101');
  const dc = npOf(st, 'delete');
  ok(rd.ok === true && Object.keys(rd).join() === 'ok' && dc.length === 1 && dc[0].modelName === 'InternetDocument' && dc[0].methodProperties.DocumentRefs === DOCREF, 'удаление: InternetDocument.delete по Ref документа, ответ {ok:true}', { rd, dc: dc[0] && dc[0].methodProperties });
  const sv = svcB(g, 'P-0101');
  ok(sv.ttn === undefined && sv.tr === undefined && sv.tp === undefined && sv.tc === undefined && ordRow()[ttnCol] === '', 'после удаления очищены «ТТН» и svc.ttn/tr/tp/tc');
  ok(toChat(g, 501, sent0).length === 0, 'клиенту ничего не отправлено');
  ok(g.sheets['Журнал'] && /ТТН видалено/.test(JSON.stringify(g.sheets['Журнал'].rows)), 'действие в журнале');
  ok(!('ttnDel' in admP(g, 900, 'admin.orders').orders.find(x => x.num === 'P-0101')) && del('P-0101').error === 'del_no', 'повторное удаление — отказ');
  st.ttnNext = '20450000000051';
  ok(cr('P-0101', { quiet: true }).ok === true, 'после удаления накладную можно создать заново');
  // окно 24 часа
  const o = svcB(g, 'P-0101'); o.tc = Date.now() - 25 * 3600 * 1000;
  g.sheets['Замовлення'].rows.find(r => r[0] === 'P-0101')[16] = JSON.stringify(o);
  const n = npOf(st, 'delete').length;
  ok(del('P-0101').error === 'del_old' && npOf(st, 'delete').length === n && !('ttnDel' in admP(g, 900, 'admin.orders').orders.find(x => x.num === 'P-0101')), 'старше 24 часов: del_old, вызова НП нет, флага нет');
  // ошибка API
  const m2 = mkd({ del: 'reject' }); m2.cr('P-0102', { quiet: true, name: 'Петренко Іван' });
  const rr = m2.del('P-0102');
  ok(rr.ok === false && rr.error === 'np_api' && /Document not found/.test(rr.np) && svcB(m2.g, 'P-0102').tr === DOCREF && svcB(m2.g, 'P-0102').ttn === TTN1, 'ошибка API при удалении: заказ не тронут');
  // права
  const gm = npWorld({ sheets: { 'Адміни': (() => { const head = require('vm').runInContext('ADMIN_HEAD', createGas(CODE, build()).sandbox).slice(); const row = head.map(() => ''); row[0] = '700'; row[1] = 'М'; row[3] = 'Менеджер'; row[head.indexOf('Наявність і залишки')] = 'так'; row[head.indexOf('Активний')] = 'так'; return [head, row]; })() } });
  npStub9(gm);
  admP(gm, 900, 'admin.ttn.create', { num: 'P-0101', weight: 1000, confirm: true, quiet: true });
  ok(admP(gm, 700, 'admin.ttn.delete', { num: 'P-0101', confirm: true }).error === 'no_perm' && !('ttnDel' in admP(gm, 700, 'admin.orders').orders.find(x => x.num === 'P-0101')) && admP(gm, 900, 'admin.orders').orders.find(x => x.num === 'P-0101').ttnDel === 1, 'менеджер без права: no_perm и флага ttnDel нет; у админа есть');
  ok(admP(gm, 777, 'admin.ttn.delete', { num: 'P-0101', confirm: true }).error === 'forbidden' && gm.post({ action: 'admin.ttn.delete', num: 'P-0101', confirm: true }).error === 'forbidden', 'не админ и без подписи: forbidden');
  ok(noSecrets(JSON.stringify([rd, rr]) + npAll(g) + npAll(m2.g)), 'в ответах и логах удаления нет секретов');
  // без ключа
  const gk = npWorld(); delete gk.props.NP_API_KEY; gk.clearCache();
  ok(admP(gk, 900, 'admin.ttn.delete', { num: 'P-0101', confirm: true }).error === 'off', 'без ключа: off');
}

console.log('Доработка НП 2: удаление только пробной, сброс меток, кэш отделений, габариты, маскирование');
{
  const mk = (o) => {
    const g = npWorld(); const st = npStub9(g, o);
    const rows = g.sheets['Замовлення'].rows; rows[0].push('ТТН'); rows.slice(1).forEach(r => r.push(''));
    return { g, st, cr: (n, x) => admP(g, 900, 'admin.ttn.create', Object.assign({ num: n, weight: 1000, confirm: true }, x || {})), del: (n) => admP(g, 900, 'admin.ttn.delete', { num: n, confirm: true }), flag: (n) => admP(g, 900, 'admin.orders').orders.find(x => x.num === n).ttnDel };
  };
  const setSvc = (g, num, f) => { const row = g.sheets['Замовлення'].rows.find(r => r[0] === num); const s = JSON.parse(row[16] || '{}'); f(s); row[16] = JSON.stringify(s); };
  // 1. пробная и настоящая
  const a = mk();
  a.cr('P-0101', { quiet: true });
  const s1 = svcB(a.g, 'P-0101');
  ok(s1.tq === 1 && s1.tn === TTN1 && s1.ttn === TTN1 && s1.tr === DOCREF && s1.tc > 0, 'пробная: svc.tq=1, tn=номер, tr, tc записаны вместе с номером');
  ok(a.flag('P-0101') === 1, 'пробная: ttnDel: 1');
  const b = mk();
  b.cr('P-0101');
  const sb = svcB(b.g, 'P-0101');
  ok(sb.tq === undefined && sb.tr === DOCREF && sb.tn === TTN1 && b.flag('P-0101') === undefined, 'настоящая: tq нет, флага ttnDel нет');
  const rb = b.del('P-0101');
  ok(rb.error === 'del_real' && /пробну/.test(rb.msg.ua) && /Нової пошти/.test(rb.msg.ua) && /пробную/.test(rb.msg.ru) && npOf(b.st, 'delete').length === 0 && svcB(b.g, 'P-0101').ttn === TTN1, 'настоящую накладную удалить нельзя: del_real UA+RU, вызова НП нет, номер на месте', rb);
  // подмена номера на ручной: пробная больше не удаляется, метки сброшены
  const c = mk();
  c.cr('P-0101', { quiet: true });
  admP(c.g, 900, 'admin.ttn', { num: 'P-0101', ttn: '20450000000999' });
  const sc = svcB(c.g, 'P-0101');
  ok(sc.ttn === '20450000000999' && sc.tr === undefined && sc.tc === undefined && sc.tn === undefined && sc.tq === undefined && c.flag('P-0101') === undefined, 'ручной ввод другого номера: tr/tc/tn/tq сброшены, флага нет');
  ok(c.del('P-0101').error === 'del_no' && npOf(c.st, 'delete').length === 0, 'после ручной замены удалять нечего: отказ без вызова НП');
  // тот же номер повторно: пробная сохраняется
  const c2 = mk(); c2.cr('P-0101', { quiet: true });
  admP(c2.g, 900, 'admin.ttn', { num: 'P-0101', ttn: TTN1 });
  ok(svcB(c2.g, 'P-0101').tq === 1 && c2.flag('P-0101') === 1, 'повторный ввод того же номера метки не трогает');
  // ttn в заказе не равен tn
  const c3 = mk(); c3.cr('P-0101', { quiet: true });
  setSvc(c3.g, 'P-0101', s => { s.ttn = '20450000000888'; });
  ok(c3.del('P-0101').error === 'del_real' && c3.flag('P-0101') === undefined && npOf(c3.st, 'delete').length === 0, 'в заказе стоит не та накладная (ttn не равен tn): del_real, флага нет');
  // 2. опечатка: nd и ar сбрасываются при смене номера
  const d = mk();
  d.cr('P-0101');
  setSvc(d.g, 'P-0101', s => { s.nd = 1; s.ar = 1; });
  admP(d.g, 900, 'admin.ttn', { num: 'P-0101', ttn: '20450000000777' });
  const sd = svcB(d.g, 'P-0101');
  ok(sd.nd === undefined && sd.ar === undefined && sd.ttn === '20450000000777', 'исправление номера сбрасывает nd и ar: отслеживание возобновится');
  // гонка: создание идёт (tp) — удаление отказывает
  const r = mk();
  r.cr('P-0101', { quiet: true });
  setSvc(r.g, 'P-0101', s => { s.tp = Date.now(); });
  const rr = r.del('P-0101');
  ok(rr.error === 'busy' && npOf(r.st, 'delete').length === 0, 'пока стоит метка tp (создание идёт): удаление отказывает, вызова НП нет');
  setSvc(r.g, 'P-0101', s => { s.tp = Date.now() - 6 * 60000; });
  ok(r.del('P-0101').ok === true, 'старая метка tp (больше 5 минут) не мешает');
  // 4. orders.my: номер пробной клиенту не отдаётся
  const m = mk();
  m.cr('P-0101', { quiet: true });
  m.cr('P-0102', { name: 'Петренко Іван' });
  const my1 = m.g.post({ action: 'orders.my', initData: m.g.initData(U(501)) }), my2 = m.g.post({ action: 'orders.my', initData: m.g.initData(U(502)) });
  const o1 = my1.orders.find(x => x.num === 'P-0101'), o2 = my2.orders.find(x => x.num === 'P-0102');
  ok(my1.ok && o1.ttn === '' && JSON.stringify(my1).indexOf(TTN1) < 0, 'orders.my: у пробной накладной номера нет');
  ok(my2.ok && /^\d{10,20}$/.test(o2.ttn), 'orders.my: у настоящей накладной номер есть');
  ok(admP(m.g, 900, 'admin.orders').orders.find(x => x.num === 'P-0101').ttn === TTN1, 'админ номер пробной видит');
  // 3. кэш отделений
  const w = mk();
  const cnt = () => w.st.calls.filter(x => x.calledMethod === 'getWarehouses').length;
  admP(w.g, 900, 'admin.ttn.preview', { num: 'P-0101' });
  const n1 = cnt();
  w.cr('P-0101', { quiet: true });
  admP(w.g, 900, 'admin.ttn.preview', { num: 'P-0101' });
  ok(n1 >= 1 && cnt() === n1, 'отделение найдено один раз: превью, создание и повторное превью не делают новых запросов getWarehouses', { n1, n: cnt() });
  w.g.call('npFindWarehouse_', NPC, 999, false);
  const n2 = cnt();
  const nf = w.g.call('npFindWarehouse_', NPC, 999, false);
  ok(n2 > n1 && cnt() === n2 && nf.error === 'wh_unknown', '«не найдено» тоже кэшируется');
  const wl = w.g.call('npFindWarehouse_', NPC, 12, true), wb = w.g.call('npFindWarehouse_', NPC, 12, false);
  ok(wl.ref === NPL && wb.ref === NPW, 'кэш различает отделение и почтомат с одним номером');
  const wn = mk({ apiDown: true }); const nn = () => wn.st.calls.filter(x => x.calledMethod === 'getWarehouses').length;
  wn.g.call('npFindWarehouse_', NPC, 12, false); const k1 = nn(); wn.g.call('npFindWarehouse_', NPC, 12, false);
  ok(nn() > k1, 'ошибка связи не кэшируется');
  // 5. маскирование телефона и Ref-ов
  const t = w.g.sandbox.npSafeReason_('a +38 067 111 22 33 b 067-111-22-33 c 0671112233 d 380671112233 e +38(067)1112233 f 067 111 22 33 ' + SENDER.NP_SENDER_REF.toLowerCase() + ' ' + SENDER.NP_SENDER_CONTACT.toUpperCase() + ' ' + SENDER.NP_SENDER_CITY.toUpperCase() + ' g 050 123 45 67', NPK, 400);
  ok(!/067|1112233|111 22|REF-SECRET|CONTACT-SECRET|DDDDDDDD/i.test(t) && /050 123 45 67/.test(t), 'npSafeReason_: телефон в любой записи и Ref-ы в любом регистре скрыты, чужой номер остался', t);
  // 6. габариты 1…120
  const dm = mk();
  ok(dm.cr('P-0101', { width: 121, length: 5, height: 5 }).error === 'bad_dims' && dm.cr('P-0101', { width: 5, length: 5, height: 300 }).error === 'bad_dims' && npOf(dm.st, 'save').length === 0, 'сторона больше 120 см: bad_dims');
  const bd = dm.cr('P-0101', { width: 121, length: 5, height: 5 });
  ok(/120/.test(bd.msg.ua) && /120/.test(bd.msg.ru) && !/300/.test(bd.msg.ua + bd.msg.ru), 'текст bad_dims: предел 120, UA и RU');
  ok(dm.cr('P-0101', { width: 120, length: 5, height: 1, quiet: true }).ok === true && npOf(dm.st, 'save').pop().methodProperties.VolumeGeneral === '0.0006', 'сторона ровно 120 см допустима');
  ok(admP(dm.g, 900, 'admin.ttn.preview', { num: 'P-0102', width: 130, length: 5, height: 5 }).error === 'bad_dims', 'preview: больше 120 — bad_dims');
  ok(noSecrets(JSON.stringify([rb, rr, my1, my2]) + npAll(a.g) + npAll(w.g)), 'секреты не в ответах и логах');
}

console.log('Доработка НП: отслеживание по официальным кодам');
{
  const orders = [
    { num: 'P-0401', uid: 801, ago: 3, status: 'відправлено', svc: { i: [['SPS-001', 50, 1]], ttn: '20450000000401' } },
    { num: 'P-0402', uid: 802, ago: 3, status: 'відправлено', lang: 'ru', delivery: 'Нова пошта', svc: { i: [['SPS-001', 50, 1]], ttn: '20450000000402' } },
    { num: 'P-0403', uid: 803, ago: 3, status: 'відправлено', svc: { i: [['SPS-001', 50, 1]], ttn: '20450000000403' } },
    { num: 'P-0404', uid: 804, ago: 3, status: 'відправлено', svc: { i: [['SPS-001', 50, 1]], ttn: '20450000000404' } },
    { num: 'P-0405', uid: 805, ago: 3, status: 'відправлено', svc: { i: [['SPS-001', 50, 1]], ttn: '20450000000405' } },
    { num: 'P-0406', uid: 806, ago: 3, status: 'відправлено', phone: 'abc', svc: { i: [['SPS-001', 50, 1]], ttn: '20450000000406' } },
    { num: 'P-0407', uid: 807, ago: 3, status: 'відправлено', svc: { i: [['SPS-001', 50, 1]], ttn: '20450000000407' } },
    { num: 'P-0408', uid: 808, ago: 3, status: 'відправлено', svc: { i: [['SPS-001', 50, 1]], ttn: '20450000000408' } }
  ];
  const STAT = { '20450000000401': '7', '20450000000402': '8', '20450000000403': '9', '20450000000404': '102', '20450000000405': '5', '20450000000406': '1', '20450000000407': '3', '20450000000408': '11' };
  const g = fuWorld({ props: { NP_API_KEY: NPK }, settings: { np_track_hours: 3 }, orders }); const st = npStub9(g, { status: STAT });
  const n = g.call('npTrackJob_');
  const c1 = npOf(st, 'getStatusDocuments')[0];
  ok(c1.modelName === 'TrackingDocument' && c1.methodProperties.Documents.length === 8, 'TrackingDocument.getStatusDocuments, все номера в одном запросе');
  ok(c1.methodProperties.Documents.filter(d => d.Phone === '380501112233').length === 7 && !('Phone' in c1.methodProperties.Documents.find(d => d.DocumentNumber === '20450000000406')), 'Phone — телефон получателя из заказа; нет телефона — поля нет');
  ok(n === 2 && /прибуло у відділення Нової пошти/.test(toChat(g, 801)[0].payload.text) && /прибыл в почтомат Новой почты/.test(toChat(g, 802)[0].payload.text), 'код 7 → «у відділення», код 8 → «в почтомат» (даже без типа доставки в заказе)');
  ok([803, 804, 805, 806, 807, 808].every(u => toChat(g, u).length === 0), 'коды 9, 102, 3, 11 и «в пути» без прибытия: сообщений нет');
  ok(svcB(g, 'P-0401').ar === 1 && svcB(g, 'P-0402').ar === 1 && ['P-0403', 'P-0404', 'P-0407', 'P-0408'].every(x => svcB(g, x).nd === 1 && svcB(g, x).ar === undefined) && svcB(g, 'P-0405').nd === undefined && svcB(g, 'P-0406').nd === undefined, 'отметки: ar у прибывших; nd у конца пути (9, 102, 3, 11); у остальных нет');
  g.props.NP_TRACK_LAST = '0'; g.call('npTrackJob_');
  const c2 = npOf(st, 'getStatusDocuments')[1].methodProperties.Documents.map(d => d.DocumentNumber).sort();
  ok(c2.join() === ['20450000000405', '20450000000406'].join(), 'в следующий раз опрашиваются только заказы в пути', c2);
  st.status['20450000000405'] = '2'; g.props.NP_TRACK_LAST = '0'; g.call('npTrackJob_');
  ok(svcB(g, 'P-0405').nd === 1 && toChat(g, 805).length === 0, 'код 2 (удалена): отметка nd, сообщения нет');
  const NP_CODE_SRC = require('fs').readFileSync(require('path').join(__dirname, '..', 'apps-script', 'Stage9b2.gs'), 'utf8');
  ok(/NP_DONE_CODES = \['2', '3', '9', '10', '11', '102', '103'\]/.test(NP_CODE_SRC) && /NP_ARRIVED_CODES = \['7', '8'\]/.test(NP_CODE_SRC), 'списки кодов совпадают с официальными');
  ok(noSecrets(npAll(g)), 'ключ не в логах и сообщениях');
}

console.log('Доработка НП: modelName/calledMethod семи вызовов и общие свойства');
{
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'apps-script', 'Stage9b2.gs'), 'utf8');
  const need = [["'getDocumentPrice'", "model: 'InternetDocument'"], ["'getCounterparties'", "'Counterparty'"], ["'getCounterpartyContactPersons'", "'Counterparty'"], ["'getWarehouses'", "'Address'"], ["'getCities'", "'Address'"],
    ["npCall_('save', props, { model: 'InternetDocument'", ''], ["npCall_('delete', { DocumentRefs: ref }, { model: 'InternetDocument'", ''], ["npCall_('getStatusDocuments'", ''], ["model: 'TrackingDocument'", ''], ["npCall_('save', { CounterpartyProperty: 'Recipient'", '']];
  ok(need.every(([a, b]) => src.indexOf(a) >= 0 && (!b || src.indexOf(b) >= 0)), 'в коде: InternetDocument.getDocumentPrice/save/delete, Address.getWarehouses/getCities, Counterparty.getCounterparties/getCounterpartyContactPersons/save, TrackingDocument.getStatusDocuments');
  ok(!/AfterpaymentOnGoodsCost/.test(src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')), 'AfterpaymentOnGoodsCost не используется');
  ok(/BackwardDeliveryData[^\n]*НЕ СВЕРЕН|НЕ СВЕРЕНА с документацией/.test(src), 'BackwardDeliveryData помечен в коде «не сверено с документацией»');
}

console.log('Волна Б2, мелочи 3-го аудита: удаление пробной (коды), стёртая колонка ТТН, гонка трекинга, маскирование, ttnTrial');
{
  const mk = (o) => {
    const g = npWorld(); const st = npStub9(g, o);
    const rows = g.sheets['Замовлення'].rows; rows[0].push('ТТН'); rows.slice(1).forEach(r => r.push(''));
    return { g, st, cr: (n, x) => admP(g, 900, 'admin.ttn.create', Object.assign({ num: n, weight: 1000, confirm: true }, x || {})), del: (n) => admP(g, 900, 'admin.ttn.delete', { num: n, confirm: true }) };
  };
  const rowOf = (g, n) => g.sheets['Замовлення'].rows.find(r => r[0] === n);
  const TC = (g) => g.sheets['Замовлення'].rows[0].indexOf('ТТН');
  const setSvc = (g, num, f) => { const row = rowOf(g, num); const s = JSON.parse(row[16] || '{}'); f(s); row[16] = JSON.stringify(s); };
  const noClean = (m) => !/службов|служебн/i.test(m.ua + ' ' + m.ru);
  // 1a. в заказе уже ничего нет (параллельное удаление) — успех
  const a = mk(); a.cr('P-0101', { quiet: true });
  a.st.onDelete = () => setSvc(a.g, 'P-0101', s => { ['ttn', 'tr', 'tc', 'tn', 'tq', 'td'].forEach(k => delete s[k]); });
  const ra = a.del('P-0101');
  ok(ra.ok === true && ra.done === 'del_done' && /вже видалено/.test(ra.msg.ua) && /уже удалена/.test(ra.msg.ru), 'в заказе уже пусто: ok:true, del_done с текстом UA и RU', ra);
  // 1b. вписали другой номер
  const b = mk(); b.cr('P-0101', { quiet: true });
  b.st.onDelete = () => admP(b.g, 900, 'admin.ttn', { num: 'P-0101', ttn: '20450000000999' });
  const rb = b.del('P-0101');
  ok(rb.ok === false && rb.error === 'del_other' && rb.msg.ua === 'Пробну накладну в Новій пошті видалено. У замовленні вже інший номер — його не чіпали.' && /другой номер/.test(rb.msg.ru) && noClean(rb.msg), 'другой номер в заказе: del_other, тексты UA и RU', rb);
  ok(svcB(b.g, 'P-0101').ttn === '20450000000999' && rowOf(b.g, 'P-0101')[TC(b.g)] !== '' && svcB(b.g, 'P-0101').td === undefined, 'del_other: чужой номер и колонка не тронуты, метки удаления нет');
  // 1c. запись не удалась: del_partial; стирания одной колонки достаточно
  const c = mk(); c.cr('P-0101', { quiet: true });
  const realFind = c.g.sandbox.findOrder_;
  let failW = false;
  c.st.onDelete = () => { failW = true; };
  c.g.sandbox.findOrder_ = function (n) { const f = realFind(n); if (failW && f) f.sheet = { getRange: () => { throw new Error('write failed'); } }; return f; };
  const rc = c.del('P-0101');
  c.g.sandbox.findOrder_ = realFind; failW = false;
  ok(rc.ok === false && rc.error === 'del_partial' && /колонці «ТТН»/.test(rc.msg.ua) && /інші комірки не чіпайте/.test(rc.msg.ua) && noClean(rc.msg) && /колонке «ТТН»/.test(rc.msg.ru), 'сбой записи: del_partial, просят стереть только «ТТН», о служебной ячейке ни слова', rc);
  ok(svcB(c.g, 'P-0101').ttn === TTN1, 'подготовка: после сбоя записи svc.ttn остался');
  rowOf(c.g, 'P-0101')[TC(c.g)] = '';   // админ стёр колонку «ТТН»
  const oc = admP(c.g, 900, 'admin.orders').orders.find(x => x.num === 'P-0101');
  ok(oc.ttn === '' && !('ttnDel' in oc) && !('ttnTrial' in oc), 'после стирания колонки админ не видит номера, флагов нет');
  ok(c.g.post({ action: 'orders.my', initData: c.g.initData(U(501)) }).orders.find(x => x.num === 'P-0101').ttn === '', 'клиент номера не видит');
  c.st.ttnNext = '20450000000052';
  const rc2 = c.cr('P-0101', { quiet: true });
  ok(rc2.ok === true && rc2.ttn === '20450000000052' && svcB(c.g, 'P-0101').tq === 1, 'после стирания колонки накладную можно создать заново (не has_ttn)', rc2);
  const d = mk();
  admP(d.g, 900, 'admin.ttn', { num: 'P-0101', ttn: '20450000000777' }); rowOf(d.g, 'P-0101')[TC(d.g)] = '';
  ok(admP(d.g, 900, 'admin.orders').orders.find(x => x.num === 'P-0101').ttn === '20450000000777', 'ручной номер (без svc.tr): стирание колонки поведение не меняет');
  // 1d. два одновременных удаления: второе не идёт в НП
  const e = mk(); e.cr('P-0101', { quiet: true });
  let second = null;
  e.st.onDelete = () => { if (!second) second = e.del('P-0101'); };
  const re = e.del('P-0101');
  ok(second && second.error === 'busy' && npOf(e.st, 'delete').length === 1 && re.ok === true, 'второе удаление во время первого: busy, в НП ровно один delete', { second, n: npOf(e.st, 'delete').length });
  ok(svcB(e.g, 'P-0101').td === undefined && rowOf(e.g, 'P-0101')[TC(e.g)] === '', 'после удаления метки td нет, колонка пуста');
  const f = mk({ del: 'reject' }); f.cr('P-0101', { quiet: true });
  f.del('P-0101'); f.st.del = 'ok';
  ok(svcB(f.g, 'P-0101').td === undefined && f.del('P-0101').ok === true, 'отказ НП снимает метку удаления: повтор проходит');
  // 2. гонка трекинга: номер сменили, пока спрашивали НП
  const orders = [
    { num: 'P-0501', uid: 851, ago: 3, status: 'відправлено', svc: { i: [['SPS-001', 50, 1]], ttn: '20450000000501' } },
    { num: 'P-0502', uid: 852, ago: 3, status: 'відправлено', svc: { i: [['SPS-001', 50, 1]], ttn: '20450000000502' } }
  ];
  const g2 = fuWorld({ props: { NP_API_KEY: NPK }, settings: { np_track_hours: 3 }, orders }); const st2 = npStub9(g2, { status: { '20450000000501': '7', '20450000000502': '9' } });
  st2.onStatus = () => { setSvc(g2, 'P-0501', s => { s.ttn = '20450000000511'; }); setSvc(g2, 'P-0502', s => { s.ttn = '20450000000512'; }); };
  const n2 = g2.call('npTrackJob_');
  ok(n2 === 0 && toChat(g2, 851).length === 0 && svcB(g2, 'P-0501').ar === undefined && svcB(g2, 'P-0502').nd === undefined, 'номер сменили во время запроса: ar/nd не ставятся, «прибуло» не уходит');
  // 3. телефон отправителя внутри отрезка цифр
  const t = a.g.sandbox.npSafeReason_('x 0671112233 доб 12 y +38 067 111 22 33 12 z 380671112233 99 w 099 111 22 33 12', NPK, 400);
  ok(!/067|1112233|111 22 33 12 z/.test(t) && /099 111 22 33 12/.test(t), 'npSafeReason_: телефон внутри отрезка цифр скрыт целиком, чужой номер остался', t);
  // 4. ttnTrial
  const h = mk(); h.cr('P-0101', { quiet: true }); h.cr('P-0102', { name: 'Петренко Іван' });
  const ao = admP(h.g, 900, 'admin.orders').orders;
  ok(ao.find(x => x.num === 'P-0101').ttnTrial === 1 && !('ttnTrial' in ao.find(x => x.num === 'P-0102')) && !('ttnTrial' in ao.find(x => x.num === 'P-0103')), 'admin.orders: ttnTrial: 1 только у пробной');
  const txt = h.g.sandbox.adminText_(h.g.call('findOrder_', 'P-0101').o, ''), txt2 = h.g.sandbox.adminText_(h.g.call('findOrder_', 'P-0102').o, '');
  ok(txt.indexOf('ТТН: ' + TTN1 + ' (пробна)') >= 0 && !/пробна/.test(txt2), 'карточка админа: «(пробна)» у пробной, у настоящей нет');
  const myc = JSON.stringify(h.g.post({ action: 'orders.my', initData: h.g.initData(U(501)) }));
  ok(!/ttnTrial|пробна|пробная/.test(myc), 'клиенту пометки пробной нет');
  ok(noSecrets(JSON.stringify([ra, rb, rc, rc2, second]) + npAll(a.g) + npAll(b.g) + npAll(c.g)), 'в ответах и логах секретов нет');
}

console.log('Замечания повторной приёмки (бэкенд): имя, габариты, меню, тревога расчёта, whGuess');
{
  const mk = (o) => { const g = npWorld(); const st = npStub9(g, o); return { g, st, cr: (n, x) => admP(g, 900, 'admin.ttn.create', Object.assign({ num: n, weight: 1000, confirm: true }, x || {})) }; };
  const cpSave = st => st.calls.find(c => c.modelName === 'Counterparty' && c.calledMethod === 'save').methodProperties;
  // 1. раздельные поля имени
  const a = mk(); const ra = a.cr('P-0101', { lastName: 'Петренко', firstName: 'Іван', middleName: 'Іванович', name: 'Ігнорується Слово' });
  const cpa = cpSave(a.st);
  ok(ra.ok && cpa.LastName === 'Петренко' && cpa.FirstName === 'Іван' && cpa.MiddleName === 'Іванович', 'раздельные lastName/firstName/middleName используются как есть, name игнорируется', cpa);
  const b = mk(); b.cr('P-0101', { lastName: "О'Брайєн", firstName: 'Анна-Марія' });
  const cpb = cpSave(b.st);
  ok(cpb.LastName === "О'Брайєн" && cpb.FirstName === 'Анна-Марія' && cpb.MiddleName === '', 'апостроф и дефис допустимы, отчество необязательно');
  const c = mk();
  ok([{ lastName: 'П', firstName: 'Іван' }, { lastName: 'Петренко' }, { firstName: 'Іван' }, { lastName: 'Петренко', firstName: 'Іван2' }, { lastName: 'Петренко', firstName: 'Іван', middleName: 'X' }, { lastName: 'А'.repeat(41), firstName: 'Іван' }].every(x => c.cr('P-0101', x).error === 'bad_name') && c.st.calls.filter(k => k.calledMethod === 'save').length === 0, 'раздельные поля неверны (коротко, пусто, цифры, длиннее 40): bad_name, к НП не обращаемся');
  const d0 = mk(); d0.cr('P-0102', { name: 'Петренко Іван Іванович' });
  const cpd = cpSave(d0.st);
  ok(cpd.LastName === 'Петренко' && cpd.FirstName === 'Іван' && cpd.MiddleName === 'Іванович', 'без раздельных полей — старое поведение (name по словам)');
  const pg = npWorld(); npStub9(pg); const pv = admP(pg, 900, 'admin.ttn.preview', { num: 'P-0101' });
  const np = pv.ttn.nameParts;
  ok(np && np.last === NPNAME.split(' ')[0] && np.first === NPNAME.split(' ')[1] && np.middle === '' && pv.ttn.dimsReq === 1, 'preview: nameParts (первое слово — фамилия) и dimsReq: 1', pv.ttn);
  ok(a.g.sandbox.npNameParts_('Іван').first === '' && a.g.sandbox.npNameParts_('Іван').last === 'Іван' && a.g.sandbox.npNameParts_('Аа Бб Вв').middle === 'Вв', 'nameParts: из одного слова только фамилия-догадка, три слова — с отчеством');
  // 2. габариты обязательны
  const e = mk();
  const nd = e.cr('P-0101', { _nodims: true });
  ok(nd.error === 'bad_dims' && nd.msg.ua.indexOf('Вкажіть ширину, довжину й висоту посилки в сантиметрах') === 0 && /Укажите ширину, длину и высоту посылки в сантиметрах/.test(nd.msg.ru) && e.st.calls.filter(k => k.calledMethod === 'save').length === 0, 'без габаритов: bad_dims с текстом UA и RU, к НП не обращаемся', nd);
  const sm = e.cr('P-0101', { width: 10, length: 10, height: 3 });
  ok(sm.error === 'bad_dims' && /мінімальний об'єм 0,0004 м³ \(наприклад 10×10×4 см\)/.test(sm.msg.ua) && /минимальный объём 0,0004 м³/.test(sm.msg.ru) && admP(e.g, 900, 'admin.ttn.preview', { num: 'P-0101', width: 10, length: 10, height: 3 }).error === 'bad_dims', 'объём меньше 0,0004 м³: bad_dims с особым текстом (create и preview)');
  const ok4 = mk(); const r4 = ok4.cr('P-0101', { width: 10, length: 10, height: 4 });
  ok(r4.ok === true && npOf(ok4.st, 'save')[0].methodProperties.VolumeGeneral === '0.0004', '10×10×4 см = ровно 0,0004 м³ допустимо');
  // 5. whGuess
  const wg = a.g.sandbox.npWhGuess_;
  ok(['12', ' 34 ', '№12', '№ 12', 'Відділення №12', 'відділення 5', '#7'].every(t => wg(t) === false) && ['біля ринку, 5 поверх', 'Нова пошта 12 на Сумській', 'Сумська 12', ''].every(t => wg(t) === true), 'npWhGuess_: чистый номер — без флага; номер из свободного текста — с флагом');
  ok(pv.ttn.branch === '12' && pv.ttn.npWarehouse === 'Відділення №12: вул. Тестова, 1' && !('whGuess' in pv.ttn), 'preview отдаёт обе строки: branch (покупатель) и npWarehouse (НП); чистый номер — whGuess нет');
  // 4. тревога при отказе расчёта
  const ge = npWorld(); const se = npStub9(ge); se.price = 'fail';
  const al = () => toChat(ge, 900).filter(m => /не вдалося порахувати вартість доставки/.test(m.payload.text || ''));
  const r1 = ge.get({ action: 'np.price', city: NPC, w: 1000, sum: 500 });
  ge.get({ action: 'np.price', city: NPC, w: 2000, sum: 500 });
  ok(r1.error === 'np_error' && al().length === 1 && /не удалось рассчитать/.test(al()[0].payload.text) && !!ge.props.NP_ALERT_LAST, 'отказ API при расчёте: админу одно сообщение (UA+RU), второй отказ в сутки — молча', al().length);
  ok(!JSON.stringify(r1).includes('City not found') && noSecrets(JSON.stringify(r1) + al()[0].payload.text + npAll(ge)), 'покупателю просто np_error без текста НП; секретов нет');
  ge.props.NP_ALERT_LAST = String(Date.now() - 25 * 3600 * 1000);
  ge.get({ action: 'np.price', city: NPC, w: 3000, sum: 500 });
  ok(al().length === 2, 'через сутки — ещё одно');
  const gz = npWorld(); const sz = npStub9(gz); sz.price = '0';
  gz.get({ action: 'np.price', city: NPC, w: 1000, sum: 500 });
  ok(toChat(gz, 900).filter(m => /порахувати вартість/.test(m.payload.text || '')).length === 0, 'нулевая цена в ответе (не отказ API) — без тревоги');
  const gs = npWorld(); const ss = npStub9(gs); ss.price = 'fail'; gs.props.NP_ALERT_LAST = String(Date.now() - 3600 * 1000);
  gs.get({ action: 'np.price', city: NPC, w: 1000, sum: 500 });
  ok(toChat(gs, 900).filter(m => /порахувати вартість/.test(m.payload.text || '')).length === 0, 'общая отметка NP_ALERT_LAST: час назад уже было сообщение о НП — второе не шлём');
  // 6. del_done
  const dd = a.g.sandbox.npDelDone_();
  ok(dd.ok === true && dd.done === 'del_done' && dd.msg.ua && dd.msg.ru, 'del_done: ответ содержит msg UA и RU');
}

console.log('Замечания повторной приёмки: меню — варианты с кодами');
{
  const REF2 = 'd0000000-1111-2222-3333-0000000000f9';
  const PHRASE = n => 'Скопіюйте код потрібного рядка в Script Properties → ' + n + ' (Розширення → Apps Script → Налаштування проєкту → Властивості скрипта)';
  const g1 = sndWorld({}, { orders: [] }); sndStub(g1, { twoCities: true });
  const r1 = g1.call('stage9b2CheckNp');
  ok(/1\. Харків — d0000000/.test(r1.message) && /2\. Харків — d0000000/.test(r1.message) && r1.message.includes(SKH) && r1.message.includes(REF2) && r1.message.includes(PHRASE('NP_SENDER_CITY')), 'города: пронумерованный список «Назва — код» и точная фраза про NP_SENDER_CITY', r1.message);
  const g2 = sndWorld({}, { orders: [] }); sndStub(g2, { manyCp: true });
  const r2 = g2.call('stage9b2CheckNp');
  ok(/1\. ФОП Тестовий — /.test(r2.message) && /2\. Інший — /.test(r2.message) && r2.message.includes(SCP) && r2.message.includes(PHRASE('NP_SENDER_REF')), 'отправители: список и фраза про NP_SENDER_REF');
  const g3 = sndWorld({ NP_SENDER_PHONE: '+380509998877' }, { orders: [] }); sndStub(g3, { contacts: [{ Ref: SCT, Description: 'Іванов Іван', Phones: '380671112233' }, { Ref: SCT2, Description: 'Петров Петро', Phones: '380000000000' }] });
  const r3 = g3.call('stage9b2CheckNp');
  ok(/1\. Іванов Іван — /.test(r3.message) && /2\. Петров Петро — /.test(r3.message) && r3.message.includes(SCT2) && r3.message.includes(PHRASE('NP_SENDER_CONTACT')) && !r3.message.includes('380671112233') && !r3.message.includes('380000000000') && !r3.message.includes(NPK), 'контакты: список ПІБ — код, телефоны контактов не показаны, ключа нет');
  const g4 = sndWorld({}, { orders: [] }); sndStub(g4, { noCp: true });
  const r4 = g4.call('stage9b2CheckNp');
  ok(/ключ NP_API_KEY активний/.test(r4.message) && /контрагент-відправник/.test(r4.message), 'ничего не найдено: что проверить в кабинете НП');
  // Ref-ы только в окне меню: ни в Telegram, ни в логах, ни в ответах
  const g5 = sndWorld({}, { orders: [] }); sndStub(g5, { twoCities: true, manyCp: true });
  g5.call('hourlyJob');
  const alerts = toChat(g5, 900).map(m => m.payload.text || '').join('\n');
  ok(/Нова пошта: не вдалося визначити дані відправника/.test(alerts) && !alerts.includes(SKH) && !alerts.includes(REF2) && !alerts.includes(SCP) && npAll(g5).indexOf(REF2) < 0 && !JSON.stringify(admP(g5, 900, 'admin.orders')).includes(REF2), 'коды вариантов не в Telegram, не в логах, не в ответах API');
  const g6 = sndWorld(); sndStub(g6);
  ok(!/Скопіюйте код/.test(g6.call('stage9b2CheckNp').message), 'без неоднозначности список не показывается');
}

/* ============ Выпуск 9Б3: «To many requests», пауза, двухслойный кэш, один запрос на всех ============ */
const MIN = 60 * 1000, HR = 3600 * 1000, DAY = 24 * HR;
const NPC2 = 'aaaaaaaa-1111-2222-3333-444444444445';
const LIMALERT = (g) => toChat(g, 900).filter(m => /тимчасово обмежила запити/.test(m.payload.text || ''));
const SUGG = (g) => g.sent.filter(m => m.method === 'sendMessage' && /Підказки Нової пошти не працюють/.test(m.payload.text || ''));
/** Мир со строгим CacheService (сроки по часам стенда, потолок 6 ч, 100 КБ) и стендом НП. */
const lw = (o, props, extra) => { const g = npWorld(extra, props); g.setCacheStrict(true); const st = npStub9(g, o); ['limit', 'limitAt', 'whN', 'narrowEmpty'].forEach(k => { if (o && o[k] !== undefined) st[k] = o[k]; }); return { g, st }; };
const withTtnCol = (g) => { const rows = g.sheets['Замовлення'].rows; rows[0].push('ТТН'); rows.slice(1).forEach(r => r.push('')); return g; };
const cacheSheetText = (g) => JSON.stringify(g.sheets['Кеш НП'] ? g.sheets['Кеш НП'].rows : []);
/** Фоновая запись кэша НП в лист (то, что делает hourlyJob): покупатель в лист не пишет. */
const FL = (g) => g.call('npLongFlush_');
const cacheRows = (g) => (g.sheets['Кеш НП'] ? g.sheets['Кеш НП'].rows.length - 1 : 0);

console.log('Выпуск 9Б3: распознавание лимита НП (npLimitHit_)');
{
  const g = npWorld();
  const h = (c, d) => g.sandbox.npLimitHit_(c, d);
  ok(h(200, limBody(true)) && h(200, limBody('too')) && h(200, limBody('code')) && h(429, null), 'лимит: «To many requests», «Too many requests», только код 20000401501 (число и строка), HTTP 429');
  ok(h(200, { success: false, errors: ['TOO MANY REQUESTS'], data: [] }) && h(200, { success: false, errors: [], errorCodes: ['20000401501'] }), 'регистр не важен');
  ok(!h(200, { success: false, errors: ['API key is invalid'], errorCodes: ['20000200068'], data: [] }) && !h(200, { success: true, data: [] }) && !h(200, null) && !h(500, null) && !h(200, { success: true, errors: ['To many requests'], data: [] }), 'обычные ошибки, успех, обрыв и 500 лимитом не считаются');
}

console.log('Выпуск 9Б3: первый ответ лимита ставит паузу на 10 минут');
{
  const { g, st } = lw({ limit: true });
  const r = g.get({ action: 'np.city', q: 'Харків' });
  const until = Number(g.props.NP_PAUSE_UNTIL);
  ok(r.ok === false && r.retryAfter > 590 && r.retryAfter <= 600 && Object.keys(r).sort().join() === 'ok,retryAfter' && st.calls.length === 1, 'np.city: {ok:false, retryAfter:~600}, один вызов НП', r);
  ok(until > Date.now() + 9 * MIN && until <= Date.now() + 10 * MIN + 2000, 'пауза записана в Script Properties (NP_PAUSE_UNTIL) на 10 минут');
  ok(SUGG(g).length === 0 && !g.props.NP_ALERT_AT, 'тревога «Підказки НП не працюють» из-за лимита не шлётся');
  const al = LIMALERT(g);
  ok(al.length === 1 && /Нова пошта тимчасово обмежила запити/.test(al[0].payload.text) && /Новая почта временно ограничила запросы/.test(al[0].payload.text) && !!g.props.NP_LIMIT_ALERT_LAST && !g.props.NP_ALERT_LAST, 'админу одно сообщение UA+RU, своя отметка NP_LIMIT_ALERT_LAST (общая NP_ALERT_LAST не занята)');
  ok(noSecrets(al[0].payload.text + npAll(g)) && !String(al[0].payload.text).includes('20000401501'), 'в тревоге и логах нет ключа и данных отправителя');
  const r2 = g.get({ action: 'np.city', q: 'Київ' });
  ok(r2.ok === false && r2.retryAfter > 0 && st.calls.length === 1, 'следующий запрос: сети нет, retryAfter есть');
}
['too', 'code', '429'].forEach(mode => {
  const { g, st } = lw({ limit: mode });
  const r = g.get({ action: 'np.price', city: NPC, w: 1000, sum: 500 });
  ok(r.ok === false && r.error === 'np_error' && r.retryAfter > 0 && Number(g.props.NP_PAUSE_UNTIL) > Date.now() && st.calls.length === 1, 'лимит в виде «' + mode + '»: пауза поставлена, np.price: np_error + retryAfter', r);
});

console.log('Выпуск 9Б3: во время паузы 0 сетевых вызовов на всех путях, кэш отдаётся, после 10 минут всё возобновляется');
{
  const { g, st } = lw({}, {}, { settings: { np_track_hours: 3 }, orders: npOrders().concat([{ num: 'P-0301', uid: 601, ago: 1, status: 'підтверджено', name: NPNAME, delivery: 'Нова пошта', city: 'Київ', branch: '12', total: 500, svc: { i: [['SPS-001', 100, 1]], nc: NPC2 } }]) });
  withTtnCol(g);
  const adm = (action, d) => admP(g, 900, action, d);
  // тёплый кэш и пробная накладная до лимита
  const warmCity = g.get({ action: 'np.city', q: 'Харків' }), warmAll = g.get({ action: 'np.whall', city: NPC }), warmPrice = g.get({ action: 'np.price', city: NPC, w: 1000, sum: 500 });
  adm('admin.ttn.preview', { num: 'P-0101' });
  const trial = adm('admin.ttn.create', { num: 'P-0102', weight: 1000, confirm: true, quiet: true });
  ok(warmCity.ok && warmCity.list.length === 1 && warmAll.ok && warmAll.list.length === 5 && warmPrice.cost === 95 && trial.ok === true, 'подготовка: города, отделения, стоимость, пробная накладная');
  st.limit = true;
  g.get({ action: 'np.city', q: 'Харк' }); // этот запрос и ловит лимит
  const n = st.calls.length;
  ok(Number(g.props.NP_PAUSE_UNTIL) > Date.now(), 'пауза идёт');
  // публичные пути
  const c1 = g.get({ action: 'np.city', q: 'Київ' }), c2 = g.get({ action: 'np.city', q: 'Львів' });
  const w1 = g.get({ action: 'np.wh', city: NPC2, q: '12' }), w2 = g.get({ action: 'np.whall', city: NPC2 }), p1 = g.get({ action: 'np.price', city: NPC, w: 7000, sum: 9000 });
  ok(!c1.ok && c1.retryAfter > 0 && !c2.ok && !w1.ok && w1.error === 'np_error' && w1.retryAfter > 0 && !w2.ok && w2.retryAfter > 0 && !p1.ok && p1.error === 'np_error' && p1.retryAfter > 0, 'np.city, np.wh, np.whall, np.price: {ok:false} и retryAfter, коды ошибок прежние');
  // админские пути
  const pv = adm('admin.ttn.preview', { num: 'P-0301' }), cr = adm('admin.ttn.create', { num: 'P-0301', weight: 1000, confirm: true });
  ok(pv.ok === false && pv.error === 'np_paused' && /Нова пошта тимчасово обмежила запити\. Спробуйте через \d+ хв\./.test(pv.msg.ua) && /Новая почта временно ограничила запросы\. Попробуйте через \d+ мин\./.test(pv.msg.ru) && pv.retryAfter > 0, 'preview: np_paused, текст UA и RU «Спробуйте через N хв.»', pv);
  ok(cr.error === 'np_paused' && /Спробуйте через/.test(cr.msg.ua), 'create (отделение не в кэше): np_paused');
  const cr2 = adm('admin.ttn.create', { num: 'P-0101', weight: 1000, confirm: true });
  ok(cr2.error === 'np_paused' && cr2.step === 1 && svcB(g, 'P-0101').tp === undefined && svcB(g, 'P-0101').ttn === undefined, 'create на шаге 1 (отделение в кэше): np_paused, метка «создание идёт» снята, ТТН нет', cr2);
  const dl = adm('admin.ttn.delete', { num: 'P-0102', confirm: true });
  ok(dl.error === 'np_paused' && /Спробуйте через/.test(dl.msg.ua) && svcB(g, 'P-0102').td === undefined && svcB(g, 'P-0102').ttn === TTN1, 'delete: np_paused, метка «удаление идёт» снята, накладная на месте', dl);
  ok(g.call('npTrackJob_') === 0 && !g.props.NP_TRACK_LAST, 'трекинг: ничего не шлёт и не тратит интервал NP_TRACK_LAST');
  ok(g.call('npCall_', 'getWarehouses', { CityRef: NPC2 }, { admin: true }) === null && g.call('npCall_', 'getStatusDocuments', { Documents: [] }, { admin: true, model: 'TrackingDocument' }) === null, 'прямой админский npCall_ отвечает null без сети');
  // кэш отдаётся
  const hc = g.get({ action: 'np.city', q: 'Харків' }), ha = g.get({ action: 'np.whall', city: NPC }), hp = g.get({ action: 'np.price', city: NPC, w: 1000, sum: 500 });
  ok(hc.ok && hc.list.length === 1 && !('retryAfter' in hc) && ha.ok && ha.list.length === 5 && hp.ok && hp.cost === 95, 'города, отделения и стоимость из кэша отдаются во время паузы, без retryAfter');
  ok(adm('admin.ttn.preview', { num: 'P-0101' }).ok === true, 'preview отделения, найденного раньше (кэш), работает во время паузы');
  ok(st.calls.length === n, 'за всё время паузы к НП ушло 0 запросов', st.calls.length - n);
  ok(SUGG(g).length === 0 && LIMALERT(g).length === 1, 'тревоги: «Підказки НП» нет, о лимите одна');
  // пауза переживает очистку CacheService
  g.clearCache();
  const aft = g.get({ action: 'np.city', q: 'Одеса' });
  ok(aft.ok === false && aft.retryAfter > 0 && st.calls.length === n, 'после очистки CacheService пауза не потеряна (Script Properties)');
  // ещё не прошла
  g.advance(9 * MIN);
  ok(g.get({ action: 'np.city', q: 'Одеса' }).ok === false && st.calls.length === n, 'через 9 минут пауза ещё идёт');
  // прошла
  g.advance(1 * MIN + 5000); st.limit = false;
  const res = g.get({ action: 'np.city', q: 'Одеса' });
  ok(res.ok === true && st.calls.length === n + 1, 'через 10 минут запросы возобновляются сами', { res, d: st.calls.length - n });
  ok(g.call('npTrackJob_') >= 0 && npOf(st, 'getStatusDocuments').length === 1, 'трекинг после паузы снова опрашивает НП');
  ok(adm('admin.ttn.create', { num: 'P-0101', weight: 1000, confirm: true }).ok === true && npOf(st, 'save').length === 2, 'create после паузы проходит: накладных две (пробная и эта), дублей нет');
}

console.log('Выпуск 9Б3: лимит посреди создания накладной (шаг 2) — накладной нет, метка снята');
{
  const { g, st } = lw({}); withTtnCol(g);
  admP(g, 900, 'admin.ttn.preview', { num: 'P-0101' });
  st.limitAt = st.calls.length + 2; // шаг 1 (получатель) проходит, шаг 2 (накладная) — лимит
  const r = admP(g, 900, 'admin.ttn.create', { num: 'P-0101', weight: 1000, confirm: true });
  ok(r.error === 'np_paused' && r.step === 2 && svcB(g, 'P-0101').tp === undefined && svcB(g, 'P-0101').ttn === undefined, 'шаг 2: np_paused, ТТН нет, метка снята', r);
  g.advance(11 * MIN); st.limitAt = 0;
  ok(admP(g, 900, 'admin.ttn.create', { num: 'P-0101', weight: 1000, confirm: true }).ok === true && svcB(g, 'P-0101').ttn === TTN1, 'после паузы создаётся одна накладная');
}

console.log('Выпуск 9Б3: перебор страниц останавливается на первом ответе лимита');
{
  const { g, st } = lw({ whN: 1200, limitAt: 2 });
  const r = g.get({ action: 'np.whall', city: NPC });
  ok(r.ok === false && r.retryAfter > 0 && st.calls.length === 2, 'страница 1 прошла, страница 2 — лимит: 2 вызова, страницы 3+ не запрашиваются', st.calls.length);
  ok(g.get({ action: 'np.whall', city: NPC }).ok === false && st.calls.length === 2 && cacheRows(g) === 0, 'неполный список не кэшируется, во время паузы сети нет');
  g.advance(11 * MIN); st.limitAt = 0;
  const r2 = g.get({ action: 'np.whall', city: NPC });
  ok(r2.ok && r2.list.length === 1200 && st.calls.length === 5, 'после паузы список грузится целиком (3 страницы)', st.calls.length);
  const gn = lw({ limitAt: 1, narrowEmpty: true }); withTtnCol(gn.g);
  const pv = admP(gn.g, 900, 'admin.ttn.preview', { num: 'P-0101' });
  ok(pv.error === 'np_paused' && gn.st.calls.length === 1, 'поиск отделения: первый же ответ лимита — стоп, второго запроса (полный список) нет');
}

console.log('Выпуск 9Б3: тревога о лимите — не чаще раза в сутки');
{
  const { g, st } = lw({ limit: true });
  g.get({ action: 'np.city', q: 'Харків' });
  g.advance(11 * MIN);
  g.get({ action: 'np.city', q: 'Харкі' });
  ok(st.calls.length === 2 && LIMALERT(g).length === 1, 'второй лимит через 11 минут: сеть пробуем, тревоги второй нет');
  g.advance(25 * HR);
  g.get({ action: 'np.city', q: 'Хар' });
  ok(LIMALERT(g).length === 2, 'через сутки — ещё одно сообщение');
  const gp = lw({}); gp.g.props.NP_PAUSE_UNTIL = String(Date.now() + 5 * HR);
  ok(gp.g.get({ action: 'np.city', q: 'Харків' }).ok === true && gp.st.calls.length === 1, 'мусор в NP_PAUSE_UNTIL (дальше 10 минут) паузой не считается');
}

console.log('Выпуск 9Б3: отправитель — пауза, повтор 1 ч → 6 ч → 24 ч, срок 7 дней');
{
  // лимит во время разрешения: одна попытка, остальные шаги без сети, тревога об ошибке настроек не шлётся, повтор не копится
  const g = sndWorld(); const st = sndStub(g, { limit: true }); g.setCacheStrict(true);
  g.call('hourlyJob');
  ok(st.calls.length === 1 && Number(g.props.NP_PAUSE_UNTIL) > Date.now() && !g.props.NP_SENDER_RETRY, 'лимит на первом шаге: 1 вызов, остальные шаги без сети, пауза есть, отсчёт повторов не начат');
  ok(alertsTo(g, 900).length === 0 && LIMALERT(g).length === 1, 'об отправителе не тревожим, о лимите — одно сообщение');
  g.call('hourlyJob'); const m = g.call('stage9b2CheckNp');
  ok(st.calls.length === 1 && m.ok === false && m.paused === true && /Спробуйте через \d+ хв\./.test(m.message) && g.ui.alerts.some(a => /Спробуйте через/.test(a)), 'во время паузы hourlyJob и пункт меню: 0 вызовов, понятный текст «Спробуйте через N хв.»', m);
  g.advance(11 * MIN); st.o.limit = false;
  g.call('hourlyJob');
  ok(g.call('npSender_').city === SKH && st.calls.length > 1, 'после паузы разрешение отправителя проходит сразу (лимит в счёт повторов не шёл)');
}
{
  // постоянная ошибка: за 24 часа не больше 3 попыток
  const g = sndWorld(); const st = sndStub(g, { apiDown: true }); g.setCacheStrict(true);
  const attempts = () => st.calls.filter(c => c.calledMethod === 'getCities').length;
  const seq = [];
  for (let h = 0; h <= 24; h++) { const a0 = attempts(); g.call('hourlyJob'); if (attempts() > a0) seq.push(h); g.advance(HR); }
  ok(seq.length === 3 && seq[0] === 0 && seq[1] === 1 && seq[2] >= 7 && seq[2] <= 8, 'постоянная ошибка при ежечасном запуске: 3 попытки за 24 часа (сразу, через ~1 ч, через ~6 ч)', seq);
  ok(alertsTo(g, 900).length === 1, 'админу одно сообщение за сутки');
  const bo = JSON.parse(g.props.NP_SENDER_RETRY);
  ok(bo.n === 3 && bo.next > Date.now() && !JSON.stringify(bo).includes(SPHONE) && !JSON.stringify(bo).includes(NPK), 'в NP_SENDER_RETRY число попыток и время следующей, без телефона и ключа');
  const n0 = st.calls.length;
  const menu = g.call('stage9b2CheckNp');
  ok(st.calls.length > n0 && menu.ok === true, 'пункт меню запускает попытку сразу, даже когда идёт пауза между попытками');
  g.props.NP_SENDER_WAREHOUSE = '134'; const n1 = st.calls.length;
  g.call('hourlyJob');
  ok(st.calls.length > n1, 'смена входных значений сбрасывает отсчёт: попытка сразу');
  st.o.apiDown = false; g.advance(30 * HR); g.call('stage9b2CheckNp');
  ok(!g.props.NP_SENDER_RETRY && g.call('npTtnOn_') === true, 'успешная проверка из меню снимает отсчёт повторов');
  const n2 = st.calls.length; g.call('hourlyJob');
  ok(st.calls.length === n2, 'отправитель разрешён: hourlyJob к НП не ходит');
}
{
  // кэш отправителя: 7 дней, при неудачном обновлении работает старый
  const g = sndWorld(); const st = sndStub(g); g.setCacheStrict(true);
  g.call('hourlyJob');
  const ok0 = g.call('npSender_'); const n0 = st.calls.length;
  g.advance(4 * DAY); g.call('hourlyJob');
  ok(ok0.city === SKH && st.calls.length === n0, 'через 4 дня кэш свежий: запросов нет');
  st.o.apiDown = true; g.advance(1.1 * DAY); g.call('hourlyJob');
  ok(st.calls.length > n0 && g.call('npSender_').city === SKH && g.call('npSender_').address === SWH && g.call('npTtnOn_') === true, 'через ~5 дней начинается обновление; оно не удалось — старый кэш продолжает работать');
  g.advance(1.8 * DAY);
  ok(g.call('npSender_').city === SKH && g.call('npTtnOn_') === true, 'через ~7 дней без обновления (6,9) данные ещё действуют');
  g.advance(0.3 * DAY);
  ok(!g.call('npSender_').city && !g.call('npTtnOn_'), 'старше 7 дней кэш не используется');
  // обновление при свежем кэше без пробелов не перебирает всё: только недостающее
  const g2 = sndWorld(); const s2 = sndStub(g2, { manyCp: true });
  g2.call('hourlyJob'); const first = s2.calls.map(c => c.calledMethod);
  g2.advance(HR); g2.call('hourlyJob');
  const second = s2.calls.slice(first.length).map(c => c.calledMethod);
  ok(first.indexOf('getCities') >= 0 && second.join() === 'getCounterparties', 'повтор после частичной неудачи: город и отделение из кэша, запрашивается только недостающий шаг', second);
}

console.log('Выпуск 9Б3: кэш — один и тот же запрос не повторяется (быстрый слой, долгий слой, сроки)');
{
  const { g, st } = lw({});
  const q = () => g.get({ action: 'np.city', q: 'Харків' });
  ok(!g.sheets['Кеш НП'], 'лист «Кеш НП» не создан, пока нет обращений к НП');
  const a = q();
  ok(a.ok && a.list.length === 1 && st.calls.length === 1, 'города: первый запрос — 1 вызов');
  ok(!g.sheets['Кеш НП'], 'запрос покупателя в лист не пишет (только CacheService и очередь)');
  FL(g);
  ok(!!g.sheets['Кеш НП'] && g.sheets['Кеш НП'].hidden === true && cacheRows(g) >= 1, 'фоновая запись: лист «Кеш НП» создан и скрыт');
  g.get({ action: 'np.city', q: '  ХАРКІВ ' }); q();
  ok(st.calls.length === 1, 'повтор (в т.ч. другой регистр и пробелы): 0 новых вызовов');
  g.clearCache(); q();
  ok(st.calls.length === 1, 'CacheService пуст: ответ берётся из листа, 0 вызовов');
  g.advance(7 * HR); q();
  ok(st.calls.length === 1, 'через 7 часов (быстрый слой кончился) — лист отдаёт, 0 вызовов');
  g.advance(18 * HR); q();
  ok(st.calls.length === 2, 'через 25 часов — новый вызов', st.calls.length);
  // «ничего не найдено» — коротко и только в быстром слое
  const e = () => g.get({ action: 'np.city', q: 'Лозова' });
  const r0 = st.calls.length; e(); e();
  ok(st.calls.length === r0 + 1 && !cacheSheetText(g).includes('лозова'), 'пустой результат: 1 вызов, повтор из кэша, в лист не пишется');
  g.advance(61 * MIN); e();
  ok(st.calls.length === r0 + 2, 'пустой результат живёт 1 час, потом проверяется снова');
  // ошибка не кэшируется
  const ge = lw({ apiDown: true });
  const bad1 = ge.g.get({ action: 'np.city', q: 'Харків' });
  ge.st.apiDown = false;
  const good = ge.g.get({ action: 'np.city', q: 'Харків' });
  ok(bad1.ok === false && !('retryAfter' in bad1) && good.ok === true && ge.st.calls.length === 2, 'ошибка API не кэшируется: следующий запрос идёт в НП; retryAfter только при паузе');
  ok(SUGG(ge.g).length === 1, 'обычная ошибка по-прежнему даёт одну тревогу «Підказки НП не працюють»');
}
{
  // отделения города: список один на город, сутки; поиск номера и старый np.wh используют его
  const { g, st } = lw({ whN: 1200 });
  const all = () => g.get({ action: 'np.whall', city: NPC });
  const r = all();
  ok(r.ok && r.list.length === 1200 && r.list[0].length === 3 && st.calls.length === 3 && st.calls.every(c => c.methodProperties.Limit === '500'), 'whall: 1200 отделений = 3 страницы по 500, формат записи [номер, адрес, тип]');
  all(); FL(g); g.clearCache(); all(); g.advance(7 * HR); all();
  ok(st.calls.length === 3, 'повтор, пустой CacheService, через 7 часов: 0 новых вызовов');
  const f = g.call('npFindWarehouse_', NPC, 12, false), f2 = g.call('npFindWarehouse_', NPC, 700, false), nf = g.call('npFindWarehouse_', NPC, 5000, false);
  ok(f.ref === NPUID(12) && f2.ref === NPUID(700) && nf.error === 'wh_unknown' && st.calls.length === 3, 'поиск номера использует кэш списка города: 0 вызовов', st.calls.length);
  ok(f.desc === 'Відділення №12: вул. Тестова' && f.city === 'Харків', 'из списка берутся и описание, и город');
  const old = g.get({ action: 'np.wh', city: NPC, q: '12' });
  ok(old.ok && old.list[0].num === '12' && old.list[0].n === 'Відділення №12: вул. Тестова' && st.calls.length === 3, 'старый np.wh при готовом списке отвечает без сети');
  g.advance(18 * HR); all();
  ok(st.calls.length === 6, 'через 25 часов список грузится заново (3 вызова)', st.calls.length);
  ok(noSecrets(cacheSheetText(g)) && !cacheSheetText(g).includes(SENDER.NP_SENDER_CITY), 'в листе кэша нет ключа, телефона и Ref-ов отправителя');
}
{
  // обратное направление: поиск номера при пустом узком запросе грузит список целиком, и он остаётся для np.whall
  const { g, st } = lw({ whN: 1200, narrowEmpty: true });
  const f = g.call('npFindWarehouse_', NPC, 700, false);
  ok(f.ref === NPUID(700) && st.calls.length === 4 && st.calls[0].methodProperties.WarehouseId === '700' && !st.calls[1].methodProperties.WarehouseId, 'узкий запрос пуст → один полный перебор (1 + 3 вызова)', st.calls.length);
  const r = g.get({ action: 'np.whall', city: NPC }); const f2 = g.call('npFindWarehouse_', NPC, 701, false);
  ok(r.ok && r.list.length === 1200 && f2.ref === NPUID(701) && st.calls.length === 4, 'np.whall и другой номер после этого — 0 вызовов');
  const { g: g2, st: s2 } = lw({});
  const x = g2.call('npFindWarehouse_', NPC, 12, false); FL(g2);
  ok(x.ref === NPW && s2.calls.length === 1 && s2.calls[0].methodProperties.WarehouseId === '12', 'найдено на первой странице узкого запроса: перебор останавливается, 1 вызов');
  g2.advance(7 * HR); g2.call('npFindWarehouse_', NPC, 12, false);
  ok(s2.calls.length === 1, 'найденное отделение держится сутки (через 7 часов 0 вызовов)');
  g2.advance(18 * HR); g2.call('npFindWarehouse_', NPC, 12, false);
  ok(s2.calls.length === 2, 'через 25 часов — новый вызов');
  const nf1 = g2.call('npFindWarehouse_', NPC, 999, false), c1 = s2.calls.length; g2.call('npFindWarehouse_', NPC, 999, false);
  ok(nf1.error === 'wh_unknown' && s2.calls.length === c1, '«не найдено» тоже кэшируется (1 час)');
}
{
  // старый np.wh без списка: один запрос на (город, строка)
  const { g, st } = lw({});
  g.get({ action: 'np.wh', city: NPC, q: '12' }); g.get({ action: 'np.wh', city: NPC, q: ' 12 ' }); g.get({ action: 'np.wh', city: NPC, q: '12', t: 'locker' });
  ok(st.calls.length === 1, 'np.wh: одинаковая строка — 1 вызов (тип отделение/почтомат берётся из того же ответа)');
  g.get({ action: 'np.wh', city: NPC, q: '120' });
  ok(st.calls.length === 2, 'другая строка — новый вызов');
}
{
  // стоимость: (город, ступень веса, ступень суммы), сутки; неверный город запроса не порождает
  const { g, st } = lw({});
  const p = (w, sum) => g.get({ action: 'np.price', city: NPC, w, sum });
  p(1200, 1200); p(1400, 1300); FL(g); g.clearCache(); p(1100, 1100);
  ok(st.calls.length === 1, 'тот же город, вес и сумма в тех же ступенях: 1 вызов, повтор и пустой CacheService — из кэша');
  g.advance(7 * HR); p(1200, 1200);
  ok(st.calls.length === 1, 'через 7 часов 0 вызовов');
  g.advance(18 * HR); p(1200, 1200);
  ok(st.calls.length === 2, 'через 25 часов — новый вызов');
  p(2600, 1200);
  ok(st.calls.length === 3, 'другая ступень веса — новый вызов');
  const bad = [g.get({ action: 'np.price', city: 'Харків', w: 1000 }), g.get({ action: 'np.price', city: 'x', w: 1000 }), g.get({ action: 'np.price', city: NPC.slice(1), w: 1000 }), g.get({ action: 'np.price', w: 1000 })];
  ok(bad.every(b => b.error === 'bad_form') && st.calls.length === 3, 'город не в формате Ref (набранное руками слово): 0 вызовов');
  g.props.NP_SENDER_CITY = 'dddddddd-1111-2222-3333-555555555555'; p(1200, 1200);
  ok(st.calls.length === 4, 'смена города отправителя — другой ключ кэша: тариф не берётся от чужого города');
  ok(noSecrets(cacheSheetText(g)) && !cacheSheetText(g).includes(SENDER.NP_SENDER_CITY) && !cacheSheetText(g).includes('dddddddd'), 'в листе кэша города отправителя нет (в ключе только хэш)');
  const ge = lw({}); ge.st.price = 'fail';
  const e1 = ge.g.get({ action: 'np.price', city: NPC, w: 1000, sum: 500 }); ge.g.get({ action: 'np.price', city: NPC, w: 1000, sum: 500 });
  ok(e1.error === 'np_error' && !('retryAfter' in e1) && ge.st.calls.length === 2 && cacheRows(ge.g) === 0, 'ошибка расчёта не кэшируется');
}
{
  // найденное отделение в превью: сутки
  const { g, st } = lw({}); withTtnCol(g);
  const pv = () => g.call('npTtnPreview_', 'P-0101', {}); // напрямую: initData из admP за 25 часов «протухнет»
  pv(); FL(g); const n = st.calls.length; pv(); g.advance(7 * HR); pv();
  ok(n === 1 && st.calls.length === 1, 'preview: отделение ищется один раз, повторы и через 7 часов — 0 вызовов');
  g.advance(18 * HR); pv();
  ok(st.calls.length === 2, 'через 25 часов — новый вызов');
}

console.log('Выпуск 9Б3: один запрос в пути, блокировка занята, размер и чистка листа');
{
  const { g, st } = lw({});
  g.cache['npfl_npc2_харків'] = '1'; // «этот запрос уже в пути»
  const r = g.get({ action: 'np.city', q: 'Харків' });
  ok(JSON.stringify(r) === '{"ok":false,"error":"busy"}' && st.calls.length === 0, 'такой же запрос уже в пути: дубль не уходит, ответ {ok:false,error:busy} без retryAfter', r);
  g.cache['npfl_npwl_' + NPC] = '1';
  const rw = g.get({ action: 'np.whall', city: NPC });
  ok(JSON.stringify(rw) === '{"ok":false,"error":"busy"}' && st.calls.length === 0, 'список отделений города уже грузится: дубль не уходит, busy', rw);
  g.cache['npfl_npwq_' + NPC.toLowerCase() + '_12'] = '1';
  const rq = g.get({ action: 'np.wh', city: NPC, q: '12' });
  ok(JSON.stringify(rq) === '{"ok":false,"error":"busy"}' && st.calls.length === 0, 'np.wh: такой же запрос в пути — busy', rq);
  g.cache['npfl_npp_' + NPC + '_1_500_' + g.call('npSenderTag_')] = '1';
  const rp = g.get({ action: 'np.price', city: NPC, w: 1000, sum: 500 });
  ok(JSON.stringify(rp) === '{"ok":false,"error":"busy"}' && st.calls.length === 0, 'np.price: такой же расчёт в пути — busy', rp);
  delete g.cache['npfl_npp_' + NPC + '_1_500_' + g.call('npSenderTag_')];
  delete g.cache['npfl_npc2_харків']; delete g.cache['npfl_npwl_' + NPC]; delete g.cache['npfl_npwq_' + NPC.toLowerCase() + '_12'];
  ok(g.get({ action: 'np.city', q: 'Харків' }).ok === true && g.get({ action: 'np.whall', city: NPC }).ok === true && st.calls.length === 2, 'отметка снята — запросы проходят');
  ok(!Object.keys(g.cache).some(k => /^npfl_/.test(k)), 'отметки «в пути» снимаются после ответа');
}
{
  // собственный счётчик сервера (400/ч публичных): busy + retryAfter до конца часа, не больше 600 с; сети нет, пауза НП не ставится
  const own = (left) => ({ city: ['np.city', { q: 'Харків' }], whall: ['np.whall', { city: NPC }], wh: ['np.wh', { city: NPC, q: '12' }], price: ['np.price', { city: NPC, w: 1000, sum: 500 }] }[left]);
  ['city', 'whall', 'wh', 'price'].forEach(k => {
    const { g, st } = lw({});
    g.cache['np_calls'] = '400|' + (Date.now() - 3500000); // окно кончится через ~100 с
    const [a, p] = own(k); const r = g.get(Object.assign({ action: a }, p));
    ok(r.ok === false && r.error === 'busy' && r.retryAfter > 90 && r.retryAfter <= 100 && Object.keys(r).sort().join() === 'error,ok,retryAfter' && st.calls.length === 0 && !g.props.NP_PAUSE_UNTIL, a + ': свой счётчик исчерпан — {ok:false,error:busy,retryAfter:~100}, сети нет, паузы нет', r);
    const { g: g2 } = lw({});
    g2.cache['np_calls'] = '400|' + Date.now(); // окно только началось: до конца часа 3600 с, отдаём не больше 600
    const r2 = g2.get(Object.assign({ action: a }, p));
    ok(r2.error === 'busy' && r2.retryAfter === 600, a + ': retryAfter не больше 600 с', r2);
  });
  { // свой счётчик расчёта стоимости (npp_calls): тоже busy с retryAfter
    const { g, st } = lw({});
    g.cache['npp_calls'] = '9999|' + (Date.now() - 3500000);
    const r = g.get({ action: 'np.price', city: NPC, w: 1000, sum: 500 });
    ok(r.error === 'busy' && r.retryAfter > 90 && r.retryAfter <= 100 && st.calls.length === 0, 'np.price: счётчик расчётов исчерпан — busy + retryAfter', r);
  }
  // настоящая ошибка НП — как было (np_error / {ok:false}), без busy; лимит НП — retryAfter паузы, без busy
  const { g, st } = lw({ apiDown: true });
  const e1 = g.get({ action: 'np.city', q: 'Харків' }), e2 = g.get({ action: 'np.whall', city: NPC }), e3 = g.get({ action: 'np.wh', city: NPC, q: '12' }), e4 = g.get({ action: 'np.price', city: NPC, w: 1000, sum: 500 });
  ok(JSON.stringify(e1) === '{"ok":false}' && JSON.stringify(e2) === '{"ok":false}' && e3.error === 'np_error' && e4.error === 'np_error' && ![e1, e2, e3, e4].some(x => 'retryAfter' in x), 'настоящая ошибка НП: ответы прежние, не busy', [e1, e2, e3, e4]);
  const { g: gl } = lw({ limit: true });
  const l1 = gl.get({ action: 'np.city', q: 'Харків' }), l2 = gl.get({ action: 'np.whall', city: NPC }), l3 = gl.get({ action: 'np.price', city: NPC, w: 1000, sum: 500 });
  ok(l1.error === undefined && l1.retryAfter > 0 && l2.error === undefined && l2.retryAfter > 0 && l3.error === 'np_error' && l3.retryAfter > 0, 'лимит НП: как раньше (retryAfter паузы, не busy)', [l1, l2, l3]);
}
{
  const { g, st } = lw({});
  g.setLockBusy(5000, 0);
  const r = g.get({ action: 'np.city', q: 'Харків' });
  ok(r.ok === true && r.list.length === 1 && !g.sheets['Кеш НП'], 'блокировка занята: ответ покупателю есть, в долгий слой не пишем, лист не создаётся');
  ok(g.get({ action: 'np.city', q: 'Харків' }).ok === true && st.calls.length === 1, 'быстрый слой всё равно работает');
  FL(g);
  ok(cacheRows(g) >= 1, 'заказная блокировка занята: фоновая запись её не берёт и проходит');
  g.setLockBusy(0, 0); g.clearCache();
  g.get({ action: 'np.city', q: 'Харків' }); FL(g);
  ok(st.calls.length === 1 && cacheRows(g) >= 1, 'блокировка свободна, пустой CacheService: ответ из листа, записанного фоновой задачей, 0 новых вызовов');
  const order = (u) => g.post({ action: 'order', initData: g.initData(U(u)), items: [{ id: 'SPS-001', g: 50, q: 1 }], total: 35, name: 'Олена', phone: '+380501234567', delivery: 'pickup', pay: 'cash', lang: 'ua', rid: 'r' + u });
  ok(order(601).ok === true, 'заказ проходит как обычно');
}
{
  const { g } = lw({});
  const put = (k, t, ttl) => g.call('npLongPut_', k, t, ttl), get = (k) => g.call('npLongGet_', k);
  for (let i = 0; i < 450; i++) put('k' + i, 'x'.repeat(10), 86400);
  ok(cacheRows(g) <= 400 && cacheRows(g) >= 390 && !get('k0') && !get('k49') && !!get('k449') && !!get('k100'), 'лист ограничен 400 строками: вытесняются самые старые ключи', cacheRows(g));
  put('e1', 'abc', 60); g.advance(2 * MIN); put('e2', 'abc', 60);
  ok(!JSON.stringify(g.sheets['Кеш НП'].rows).includes('"e1"') && !!get('e2') && !get('e1'), 'просроченные строки убираются при следующей записи');
  const seg = (c, n) => c + 'z'.repeat(n - c.length);
  const text = seg("'", 45000) + seg('=', 45000) + seg('123', 45000) + seg('-5', 45000) + seg('+7', 12345);
  ok(put('big', text, 86400) === true, 'значение на 5 ячеек записано');
  const back = get('big');
  const cells = g.sheets['Кеш НП'].rows.filter(r => r[0] === 'big').map(r => String(r[5]));
  ok(back && back.text === text && cells.length === 5 && cells.every(c => c.length <= 50000 && c.indexOf('n:') === 0), 'прочитано без искажений; куски начинаются с «n:» (не формула, не число), каждая ячейка не больше 50 000 знаков', cells.map(c => c.length));
  ok(!put('huge', 'y'.repeat(45000 * 25), 86400) && !get('huge'), 'слишком большое значение в лист не пишется');
  const rows = g.sheets['Кеш НП'].rows;
  rows.push(['broken', 0, 3, Date.now() + 100000, Date.now(), 'n:abc']);
  ok(get('broken') === null, 'недописанное значение (не все части) не читается');
}
{
  const g = npWorld(); delete g.props.NP_API_KEY; g.clearCache();
  const st = npStub9(g);
  g.get({ action: 'np.city', q: 'Харків' }); g.get({ action: 'np.whall', city: NPC }); g.get({ action: 'np.price', city: NPC, w: 1000, sum: 1 });
  ok(st.calls.length === 0 && !g.sheets['Кеш НП'] && g.call('npLongPut_', 'a', 'b', 86400) === false && !g.sheets['Кеш НП'], 'без NP_API_KEY: сети нет, лист не создаётся и не пишется');
}

console.log('Выпуск 9Б3: сколько запросов к НП на один заказ (стенд: 1200 отделений в городе = 3 страницы)');
{
  const { g, st } = lw({ whN: 1200 });
  const count = (f) => { const n = st.calls.length; f(); return st.calls.length - n; };
  const buyer = () => { g.get({ action: 'np.city', q: 'Хар' }); g.get({ action: 'np.city', q: 'Харків' }); g.get({ action: 'np.whall', city: NPC }); g.get({ action: 'np.price', city: NPC, w: 1000, sum: 1000 }); };
  const cold = count(buyer); FL(g); const warm = count(buyer); g.advance(7 * HR); const warm7 = count(buyer);
  const { g: ga, st: sa } = lw({ whN: 1200 }); withTtnCol(ga);
  const countA = (f) => { const n = sa.calls.length; f(); return sa.calls.length - n; };
  const adm = (n, x) => admP(ga, 900, 'admin.ttn.' + n, x);
  const admCold = countA(() => { adm('preview', { num: 'P-0101' }); adm('create', { num: 'P-0101', weight: 1000, confirm: true }); });
  FL(ga); ga.advance(7 * HR); sa.ttnNext = '20450000000002';
  const admWarm = countA(() => { adm('preview', { num: 'P-0102' }); adm('create', { num: 'P-0102', weight: 1000, confirm: true }); });
  const { g: gb, st: sb } = lw({ whN: 1200 }); withTtnCol(gb);
  gb.get({ action: 'np.whall', city: NPC }); const nb = sb.calls.length;
  admP(gb, 900, 'admin.ttn.preview', { num: 'P-0101' }); admP(gb, 900, 'admin.ttn.create', { num: 'P-0101', weight: 1000, confirm: true });
  const admAfterBuyer = sb.calls.length - nb;
  console.log('  [запросов к НП на один заказ, новый код] покупатель (2 подсказки города + отделения + стоимость): холодный кэш ' + cold + ', тёплый <6 ч ' + warm + ', тёплый через 7 ч ' + warm7 + '; админ preview+create: ' + admCold + ' / второй заказ в тот же город через 7 ч: ' + admWarm + ' / город уже загружен покупателем: ' + admAfterBuyer);
  ok(cold === 6 && warm === 0 && warm7 === 1, 'покупатель: 6 запросов на холодном кэше, 0 на тёплом; через 7 часов 1 (короткая подсказка «Хар» живёт только в быстром слое 6 ч, остальное — сутки)', { cold, warm, warm7 });
  ok(admCold === 3 && admWarm === 2 && admAfterBuyer === 2, 'админ: preview+create — 3 запроса (отделение, получатель, накладная); второй заказ в тот же город — 2; если список города уже загружен покупателем — 2', { admCold, admWarm, admAfterBuyer });
}

console.log('Выпуск 9Б3: запросов к НП «было / стало» (измерено на старом коде из git main)');
{
  // «Было» — apps-script/*.gs из ветки main (выпуск Б2), выгружено во временную папку и запущено в том же стенде и на тех же сценариях.
  const fs = require('fs'), os = require('os'), cp = require('child_process');
  let oldCode = null, tmp = null;
  try {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pamir-old-'));
    const root = path.join(__dirname, '..');
    cp.execSync('git ls-tree --name-only main apps-script/', { cwd: root }).toString().split(/\r?\n/).filter(n => /\.gs$/.test(n)).forEach(n => {
      fs.writeFileSync(path.join(tmp, path.basename(n)), cp.execSync('git show main:' + n, { cwd: root, maxBuffer: 64 * 1024 * 1024 }));
    });
    oldCode = path.join(tmp, 'Code.gs');
    if (!fs.existsSync(oldCode)) oldCode = null;
  } catch (e) { oldCode = null; }
  if (!oldCode) console.log('  (ветка main недоступна: сравнение «было» пропущено)');
  else {
    const flush = (g) => { try { if (typeof g.sandbox.npLongFlush_ === 'function') g.call('npLongFlush_'); } catch (e) { /* в старом коде нет */ } };
    const mk = (code) => { const g = npWorld(code ? { code } : {}); g.setCacheStrict(true); const st = npStub9(g, {}); st.whN = 1200; return { g, st }; };
    const buyerOf = (g) => () => { g.get({ action: 'np.city', q: 'Хар' }); g.get({ action: 'np.city', q: 'Харків' }); g.get({ action: 'np.whall', city: NPC }); g.get({ action: 'np.price', city: NPC, w: 1000, sum: 1000 }); };
    const buyerAt = (code, hours) => {
      const { g, st } = mk(code); const b = buyerOf(g); b(); flush(g);
      if (hours) g.advance(hours * HR);
      const n = st.calls.length; b(); return st.calls.length - n;
    };
    const buyerCold = (code) => { const { g, st } = mk(code); buyerOf(g)(); return st.calls.length; };
    const adminAt = (code) => { const { g, st } = mk(code); withTtnCol(g); admP(g, 900, 'admin.ttn.preview', { num: 'P-0101' }); admP(g, 900, 'admin.ttn.create', { num: 'P-0101', weight: 1000, confirm: true }); return st.calls.length; };
    const bgDay = (code) => {
      const g = sndWorld({}, code ? { code } : {}); g.setCacheStrict(true); const st = sndStub(g, { apiDown: true });
      for (let h = 0; h < 24; h++) { g.advance(HR); try { g.call('npSenderJob_'); } catch (e) { /* ошибки задачи не важны для счёта */ } flush(g); }
      return st.calls.length;
    };
    const rows = [
      ['покупатель, холодный кэш', buyerCold(oldCode), buyerCold(null)],
      ['тот же покупатель через 1 час', buyerAt(oldCode, 1), buyerAt(null, 1)],
      ['тот же покупатель через 7 часов', buyerAt(oldCode, 7), buyerAt(null, 7)],
      ['тот же покупатель через 23 часа', buyerAt(oldCode, 23), buyerAt(null, 23)],
      ['админ preview+create (холодный кэш)', adminAt(oldCode), adminAt(null)],
      ['фон за сутки, отправитель не находится (ошибка API)', bgDay(oldCode), bgDay(null)]
    ];
    console.log('  [запросов к НП: было (main) / стало (эта ветка), измерено в стенде: 1200 отделений = 3 страницы]');
    rows.forEach(r => console.log('    ' + r[0].padEnd(54) + String(r[1]).padStart(4) + ' / ' + String(r[2]).padStart(3)));
    ok(rows.every(r => Number.isInteger(r[1]) && Number.isInteger(r[2]) && r[2] <= r[1]), 'стало не больше, чем было, во всех шести сценариях', rows);
  }
  try { if (tmp) fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { /* не критично */ }
}

console.log('Выпуск 9Б3: контракт и утечки');
{
  const { g, st } = lw({ limit: true }); withTtnCol(g);
  const pv = admP(g, 900, 'admin.ttn.preview', { num: 'P-0101' }); g.get({ action: 'np.city', q: 'Харків' });
  const all = JSON.stringify([pv, g.get({ action: 'np.whall', city: NPC }), g.get({ action: 'np.price', city: NPC, w: 1000, sum: 1 }), admP(g, 900, 'admin.orders'), catalog(g).c]) + npAll(g) + cacheSheetText(g) + JSON.stringify(g.props.NP_PAUSE_UNTIL);
  ok(noSecrets(all) && !all.includes('СЕКРЕТ-примітка') && !/"Закупка"|"Маржа"/.test(all), 'ответы, лог, лист кэша и свойство паузы: нет ключа, данных отправителя и служебных колонок');
  const b3 = require('fs').readFileSync(require('path').join(__dirname, '..', 'apps-script', 'Stage9b3.gs'), 'utf8');
  ok(!/startPolling/.test(b3), 'в новом модуле нет startPolling');
}

console.log('Выпуск 9Б3 (приёмка): кэш в лист пишет только фоновая задача, отдельная блокировка, размер записи');
{
  const { g, st } = lw({});
  const order = (u) => g.post({ action: 'order', initData: g.initData(U(u)), items: [{ id: 'SPS-001', g: 50, q: 1 }], total: 35, name: 'Олена', phone: '+380501234567', delivery: 'pickup', pay: 'cash', lang: 'ua', rid: 'rq' + u });
  const n0 = g.lockLog.length;
  g.get({ action: 'np.city', q: 'Харків' }); g.get({ action: 'np.whall', city: NPC });
  const buyerLocks = g.lockLog.slice(n0).filter(x => x.kind !== 'sheet');
  ok(buyerLocks.length === 0 && !g.sheets['Кеш НП'], 'запрос покупателя: ни одной блокировки, в лист ничего не пишется');
  ok(!!g.cache['np_pend'] && JSON.parse(g.cache['np_pend']).length === 2, 'вместо записи в лист ключи стоят в очереди «надо сохранить»');
  g.setLockBusy(100000, 0); // заказная блокировка «занята»: если бы запись кэша её брала, она бы упала
  const n1 = g.lockLog.length;
  const w = FL(g);
  const used = g.lockLog.slice(n1).filter(x => x.kind !== 'sheet').map(x => x.kind);
  ok(w === 2 && cacheRows(g) >= 2 && used.length > 0 && used.every(k => k === 'user'), 'фоновая запись берёт только UserLock (не ScriptLock заказа и не DocumentLock)', used);
  g.setLockBusy(0, 0);
  ok(order(701).ok === true && g.lockLog.some(x => x.kind === 'script'), 'заказ проходит под своей ScriptLock независимо от записи кэша');
  ok(!g.cache['np_pend'], 'после записи очередь пуста');
  g.setUserLockBusy(100000);
  g.get({ action: 'np.city', q: 'Харкі' }); const sheetBefore = cacheSheetText(g);
  ok(FL(g) === 0 && cacheSheetText(g) === sheetBefore && !!g.cache['np_pend'], 'UserLock занят: в лист не пишем, ключ остаётся в очереди до следующего запуска');
  g.setUserLockBusy(0); FL(g);
  ok(cacheSheetText(g) !== sheetBefore && !g.cache['np_pend'], 'блокировка свободна: запись дописана');
  g.setUserLockNull(true);
  g.get({ action: 'np.city', q: 'Харко' });
  ok(FL(g) === 1, 'нет UserLock (getUserLock вернул null): запасная отметка в кэше, запись проходит');
  ok(!g.cache['np_wlock'], 'запасная отметка снимается');
}
{
  // размер записи и порции за запуск
  const { g } = lw({});
  const put = (k, t, ttl) => g.call('npLongPut_', k, t, ttl);
  ok(put('p12', 'a'.repeat(45000 * 12), 86400) === true && put('p13', 'a'.repeat(45000 * 12 + 1), 86400) === false && cacheRows(g) === 12, 'до 12 ячеек (540 000 знаков) пишется, 13 — нет');
  const { g: g2 } = lw({});
  for (let i = 0; i < 5; i++) g2.call('npCachePut_', 'bulk' + i, JSON.stringify({ i, d: 'x'.repeat(45000 * 10 - 20) }), 86400);
  ok(JSON.parse(g2.cache['np_pend']).length === 5, 'пять больших значений стоят в очереди');
  const w1 = FL(g2);
  ok(w1 === 4 && cacheRows(g2) === 40 && JSON.parse(g2.cache['np_pend']).length === 1, 'за один запуск не больше 40 ячеек: 4 значения записаны, пятое ждёт', { w1, rows: cacheRows(g2) });
  ok(FL(g2) === 1 && !g2.cache['np_pend'], 'следующий запуск дописывает остаток');
  const big = 'y'.repeat(45000 * 13);
  g2.call('npCachePut_', 'toobig', big, 86400);
  ok(FL(g2) === 0 && !g2.call('npLongGet_', 'toobig') && g2.call('npCacheGet_', 'toobig', true) === big && !g2.cache['np_pend'], 'слишком большое для листа: в лист не пишется, в быстром слое остаётся, из очереди убрано');
  g2.advance(7 * HR);
  ok(g2.call('npCacheGet_', 'toobig', true) === null, 'через 6 часов большое значение исчезает (честный повторный запрос)');
}
{
  // просроченные строки чистит фоновая задача, а не запись
  const { g } = lw({});
  const put = (k, t, ttl) => g.call('npLongPut_', k, t, ttl);
  put('s1', 'abc', 60); put('s2', 'abc', 86400);
  g.advance(2 * MIN);
  const sh = g.sheets['Кеш НП'], n = sh.rows.length;
  FL(g);
  ok(sh.rows.length === n - 1 && !JSON.stringify(sh.rows).includes('"s1"') && !!g.call('npLongGet_', 's2'), 'FL: просроченная строка убрана, живая на месте');
}

console.log('Выпуск 9Б3 (приёмка): чтение листа не возвращает чужое и сомнительное');
{
  const { g } = lw({});
  const put = (k, t, ttl) => g.call('npLongPut_', k, t, ttl), get = (k) => g.call('npLongGet_', k);
  put('A', '"aaa"', 60); put('B', '"bbb"', 86400); put('C', '"ccc"', 86400);
  const sh = g.sheets['Кеш НП'];
  ok(get('C').text === '"ccc"', 'контроль: C читается');
  // как в probe.js: читатель взял номера строк, писатель удалил просроченную строку A, строки сдвинулись
  const orig = sh.getRange.bind(sh); let armed = true;
  sh.getRange = (...a) => {
    const rg = orig(...a);
    if (armed && a[3] === 4) { const gv = rg.getValues.bind(rg); rg.getValues = () => { const v = gv(); armed = false; sh.deleteRows(2, 1); return v; }; }
    return rg;
  };
  const shifted = get('C');
  sh.getRange = orig;
  ok(shifted === null, 'сдвиг строк между чтением номеров и чтением данных: «в кэше нет», а не чужие данные', shifted);
  ok(get('C') && get('C').text === '"ccc"' && get('B').text === '"bbb"', 'после сдвига обычное чтение снова даёт верные данные');
  // порча записи
  const mk = (k, text, ttl) => { put(k, text, ttl || 86400); return sh.rows.filter(r => r[0] === k); };
  const long3 = 'q'.repeat(45000 * 2 + 10);
  let rows = mk('m1', long3);
  rows[1][0] = 'ЧУЖОЙ';
  ok(get('m1') === null, 'у средней части другой ключ: не читается');
  rows = mk('m2', long3); rows[1][1] = 7;
  ok(get('m2') === null, 'номер части не тот: не читается');
  rows = mk('m3', long3); rows[2][5] = 'n:' + 'q'.repeat(9);
  ok(get('m3') === null, 'часть укорочена (длина не сходится): не читается');
  rows = mk('m4', long3); rows[1][5] = 'n:' + 'z'.repeat(45000);
  ok(get('m4') === null, 'часть заменена на другой текст той же длины (хэш не сходится): не читается');
  rows = mk('m5', long3); rows[0][2] = 2; rows[1][2] = 2; rows[2][2] = 2;
  ok(get('m5') === null, 'число частей в ячейках не совпало с контрольной меткой: не читается');
  rows = mk('m6', long3); sh.rows.splice(sh.rows.indexOf(rows[2]), 1);
  ok(get('m6') === null, 'не хватает последней части: не читается');
  rows = mk('m7', long3); sh.rows.splice(sh.rows.indexOf(rows[1]), 1);
  ok(get('m7') === null, 'не хватает средней части: не читается');
  rows = mk('m8', 'text'); rows[0][5] = 'n:{"old":1}';
  ok(get('m8') === null, 'старый формат ячейки без контрольной метки: не читается');
  rows = mk('m9', 'text'); rows[0][3] = Date.now() - 1000;
  ok(get('m9') === null, 'срок вышел: не читается');
  rows = mk('m10', 'text'); sh.rows.push(rows[0].slice());
  ok(get('m10') === null, 'две записи «часть 0» у одного ключа: не читается');
  rows = mk('m11', 'text'); rows[0][5] = "n:1:4:" + 'zz' + ':text';
  ok(get('m11') === null, 'чужая контрольная метка: не читается');
  rows = mk('m12', '{"broken":');
  ok(get('m12') && g.call('npCacheGet_', 'm12', true) === '{"broken":', 'сама ячейка цела: кэш отдаёт текст как есть');
  const { g: g2, st: s2 } = lw({});
  g2.get({ action: 'np.city', q: 'Харків' }); FL(g2); g2.clearCache();
  const row = g2.sheets['Кеш НП'].rows.find(r => r[0] === 'npc2_харків');
  row[5] = 'n:' + row[5].slice(2).replace(/^[^:]*:[^:]*:[^:]*:/, '1:2:abc:') ; // поломали метку
  const r2 = g2.get({ action: 'np.city', q: 'Харків' });
  ok(r2.ok === true && r2.list.length === 1 && s2.calls.length === 2, 'битая запись в листе: покупатель получает ответ обычным путём (запрос к НП), не ошибку', s2.calls.length);
  const g3 = lw({}); g3.g.get({ action: 'np.city', q: 'Харків' }); FL(g3.g); g3.g.clearCache();
  const row3 = g3.g.sheets['Кеш НП'].rows.find(r => r[0] === 'npc2_харків'); const head3 = /^n:\d+:\d+:[0-9a-z]+:/.exec(row3[5])[0];
  g3.g.call('npLongPut_', 'npc2_харків', 'not json', 86400);
  const r3 = g3.g.get({ action: 'np.city', q: 'Харків' });
  ok(r3.ok === true && r3.list.length === 1 && g3.st.calls.length === 2 && !!head3, 'ячейка цела, но внутри не JSON: покупатель получает ответ из НП, а не ошибку');
}
{
  // npFindWarehouse_: результат из любого слоя сверяется с запросом
  const ck = 'npwf_' + NPC.toLowerCase() + '_12b';
  const good = { ref: NPW, num: '12', desc: 'x', city: 'Харків', cityRu: 'Харьков', cr: NPC.toLowerCase(), nm: '12', lk: false };
  const bads = {
    'чужой номер': Object.assign({}, good, { nm: '13', num: '13' }),
    'чужой город': Object.assign({}, good, { cr: 'ffffffff-1111-2222-3333-444444444444' }),
    'другой тип (почтомат вместо отделения)': Object.assign({}, good, { lk: true }),
    'запись без меток (старый формат)': { ref: NPW, num: '12', desc: 'x', city: 'Харків', cityRu: '' },
    'ref не похож на Ref': Object.assign({}, good, { ref: 'no-ref' }),
    'номер в теле не совпал': Object.assign({}, good, { num: '99' }),
  };
  Object.keys(bads).forEach(name => {
    const { g, st } = lw({});
    g.cache[ck] = JSON.stringify(bads[name]);
    const r = g.call('npFindWarehouse_', NPC, 12, false);
    ok(r.ref === NPW && st.calls.length === 1, 'быстрый слой: ' + name + ' — отвергнуто, ответ из НП', { r, calls: st.calls.length });
    const { g: g2, st: s2 } = lw({});
    g2.call('npLongPut_', ck, JSON.stringify(bads[name]), 86400);
    const r2 = g2.call('npFindWarehouse_', NPC, 12, false);
    ok(r2.ref === NPW && s2.calls.length === 1, 'лист: ' + name + ' — отвергнуто, ответ из НП', { r2, calls: s2.calls.length });
  });
  const { g, st } = lw({});
  g.cache[ck] = JSON.stringify(good);
  const r = g.call('npFindWarehouse_', NPC, 12, false);
  ok(r.ref === NPW && st.calls.length === 0 && !('cr' in r) && !('lk' in r), 'верная запись принимается без сети; служебные метки наружу не выходят');
  const f1 = g.call('npFindWarehouse_', NPC, 12, true);
  ok(f1.error !== undefined || f1.ref !== NPW || st.calls.length > 0, 'тот же номер как почтомат — отдельная запись, не из кэша отделения');
}

console.log('Выпуск 9Б3 (приёмка): данные отправителя в лист не попадают');
{
  const g = sndWorld(); sndStub(g); g.setCacheStrict(true);
  g.call('hourlyJob'); FL(g);
  const txt = cacheSheetText(g);
  ok(g.call('npSender_').city === SKH && g.call('npSender_').address === SWH, 'отправитель разрешён (город и отделение известны)');
  ok(!txt.includes(SKH) && !txt.includes(SWH) && !txt.includes(SCP) && !txt.includes(SCT) && sndSecret(txt) && !txt.includes('npwf_' + SKH), 'после hourlyJob в листе нет Ref-ов города, отделения, отправителя и контакта, телефона и ключа', txt.slice(0, 300));
  const r = g.get({ action: 'np.price', city: NPC, w: 1000, sum: 500 }); FL(g);
  const txt2 = cacheSheetText(g);
  ok(r.ok === true && /npp_aaaaaaaa-1111-2222-3333-444444444444_/.test(txt2) && !txt2.includes(SKH) && sndSecret(txt2), 'ключ стоимости в листе: город получателя открыто, город отправителя — только хэшем');
  const tag = g.call('npSenderTag_');
  ok(/^[0-9a-f]{8}$/.test(tag) && tag !== SKH.slice(0, 8), 'метка города отправителя — HMAC, не кусок Ref');
  // тот же поиск отправителя в обычном порядке (без noLong) оставил бы Ref в листе — убеждаемся, что тест это видит
  const g2 = sndWorld(); sndStub(g2); g2.setCacheStrict(true);
  g2.call('npFindWarehouse_', SKH, 34, false); FL(g2);
  ok(cacheSheetText(g2).includes(SWH), 'контроль теста: обычный поиск (не отправителя) кладёт найденное отделение в лист');
}

console.log('Выпуск 9Б3 (приёмка): тревога о лимите — своя отметка, счётчик за сутки, меню');
{
  const { g, st } = lw({ limit: true });
  g.props.NP_ALERT_LAST = String(Date.now() - HR); // сегодня уже было другое сообщение о НП (например, об отправителе)
  g.get({ action: 'np.city', q: 'Хар1' });
  const a1 = LIMALERT(g);
  ok(a1.length === 1 && !!g.props.NP_LIMIT_ALERT_LAST && g.props.NP_ALERT_LAST === String(Number(g.props.NP_ALERT_LAST)) && Number(g.props.NP_ALERT_LAST) < Date.now() - 50 * MIN, 'другое сообщение о НП за сутки уже было — о лимите всё равно сообщили, общая отметка не тронута');
  ok(/автоматична і знімається сама/.test(a1[0].payload.text) && /вручну/.test(a1[0].payload.text) && /автоматическая и снимается сама/.test(a1[0].payload.text) && /вручную/.test(a1[0].payload.text) && !/спрацювала/.test(a1[0].payload.text), 'текст: что случилось, магазин работает (ручной ввод), пауза автоматическая; счётчика нет, пока срабатывание одно');
  g.advance(11 * MIN); g.get({ action: 'np.city', q: 'Хар2' });
  g.advance(11 * MIN); g.get({ action: 'np.city', q: 'Хар3' });
  ok(LIMALERT(g).length === 1 && st.calls.length === 3, 'повторное срабатывание в те же сутки: второго сообщения нет');
  g.advance(24 * HR - 22 * MIN + MIN); g.get({ action: 'np.city', q: 'Хар4' });
  const a2 = LIMALERT(g);
  ok(a2.length === 2 && /спрацювала 3 рази/.test(a2[1].payload.text) && /срабатывала 3 раза/.test(a2[1].payload.text), 'суточное сообщение на следующие сутки: сколько раз за прошедшие сутки срабатывала пауза', a2[1] && a2[1].payload.text);
  ok(noSecrets(a2[1].payload.text + npAll(g)) && !g.props.NP_LIMIT_HITS.includes('NPKEY'), 'в сообщении и свойстве счётчика нет ключа');
}
{
  const { g } = lw({ limit: true });
  g.get({ action: 'np.city', q: 'Харків' });
  const r = g.call('stage9b2CheckNp');
  ok(r.paused === true && /Пауза через ліміт запитів Нової пошти: до \d\d:\d\d/.test(r.message) && /спрацювала 1 раз\)/.test(r.message) && /повторіть пункт меню після \d\d:\d\d/.test(r.message) && g.fetched.length === 0, 'меню при паузе: «Пауза через ліміт запитів Нової пошти: до ГГ:ХХ», счётчик, когда повторить; запросов к НП нет', r.message);
  const { g: g2 } = lw({}); sndStub(g2);
  const r2 = g2.call('stage9b2CheckNp');
  ok(/Обмежень від Нової пошти зараз немає/.test(r2.message) && !/Пауза через/.test(r2.message), 'меню без паузы: «Обмежень від Нової пошти зараз немає»', r2.message.slice(0, 200));
}
{
  // словоформы
  const g = npWorld(); const T = (n, l) => g.sandbox.npTimesText_(n, l);
  const ua = { 1: '1 раз', 2: '2 рази', 4: '4 рази', 5: '5 разів', 11: '11 разів', 12: '12 разів', 14: '14 разів', 21: '21 раз', 22: '22 рази', 25: '25 разів', 111: '111 разів' };
  const ru = { 1: '1 раз', 2: '2 раза', 4: '4 раза', 5: '5 раз', 11: '11 раз', 12: '12 раз', 14: '14 раз', 21: '21 раз', 22: '22 раза', 25: '25 раз', 111: '111 раз' };
  ok(Object.keys(ua).every(n => T(+n, 'ua') === ua[n]) && Object.keys(ru).every(n => T(+n, 'ru') === ru[n]), 'словоформы «раз»: UA 1 раз/2–4 рази/5+ разів/11–14 разів/21 раз, RU 1 раз/2–4 раза/5+ раз/11–14 раз/21 раз');
}
{
  // строка состояния часового задания и очереди в меню «перевірити Нову пошту»
  const { g } = lw({});
  g.get({ action: 'np.city', q: 'Харків' }); sndStub(g);
  const r = g.call('stage9b2CheckNp');
  ok(/Щогодинне завдання: НЕ увімкнено — без нього кеш Нової пошти живе 6 годин замість доби, а дані відправника не оновлюються\. Увімкнути: PAMIR → Увімкнути щоденні повідомлення клієнтам/.test(r.message) && /у черзі на запис — 1, рядків у листі «Кеш НП» — 0/.test(r.message), 'меню: часового задания нет — предупреждение, в очереди 1, в листе 0', r.message.slice(0, 400));
  g.call('menuDailyOn'); FL(g);
  const r2 = g.call('stage9b2CheckNp');
  ok(g.triggers.includes('hourlyJob') && /Щогодинне завдання: увімкнено/.test(r2.message) && !/НЕ увімкнено/.test(r2.message) && /у черзі на запис — 0, рядків у листі «Кеш НП» — [1-9]/.test(r2.message), 'меню: после включения задания — «увімкнено», очередь записана в лист', r2.message.slice(0, 400));
}
{
  // очередь записи: 200 разных подсказок города не вытесняют ключ списка отделений, поиска отделения и стоимости
  const { g } = lw({});
  g.call('npCachePut_', 'npwl_' + NPC, JSON.stringify({ c: 'Х', u: 'Х', l: [] }), 86400);
  for (let i = 0; i < 200; i++) g.call('npCachePut_', 'npc2_подсказка' + i, '[]', 86400);
  g.call('npCachePut_', 'npp_' + NPC + '_1_500_x', '95', 86400);
  g.call('npCachePut_', 'npwf_' + NPC + '_12_0', '{"ref":"x"}', 86400);
  const keys = JSON.parse(g.cache['np_pend']).map(x => x[0]);
  ok(keys.includes('npwl_' + NPC) && keys.includes('npp_' + NPC + '_1_500_x') && keys.includes('npwf_' + NPC + '_12_0') && keys.length <= 100 && keys.filter(k => k.indexOf('npc2_') === 0).length <= 40, '200 подсказок города не вытесняют списки отделений, поиск отделения и стоимость; подсказок в очереди не больше 40', keys.length);
  // очередь заполнена приоритетными ключами сверху: новый приоритетный вытесняет самую старую подсказку
  const { g: g2 } = lw({});
  for (let i = 0; i < 40; i++) g2.call('npCachePut_', 'npc2_подсказка' + i, '[]', 86400);
  for (let i = 0; i < 60; i++) g2.call('npCachePut_', 'npp_k' + i, '1', 86400);
  g2.call('npCachePut_', 'npwl_late', '{}', 86400);
  const k2 = JSON.parse(g2.cache['np_pend']).map(x => x[0]);
  ok(k2.length === 100 && k2.includes('npwl_late') && !k2.includes('npc2_подсказка0') && k2.includes('npc2_подсказка1'), 'очередь полна: приоритетный ключ занимает место самой старой подсказки', k2.length);
  // короткие начала слов — только быстрый слой
  const { g: g3 } = lw({});
  g3.get({ action: 'np.city', q: 'Хар' }); g3.get({ action: 'np.city', q: 'Харк' });
  const k3 = JSON.parse(g3.cache['np_pend'] || '[]').map(x => x[0]);
  ok(k3.length === 1 && k3[0] === 'npc2_харк', 'подсказка «Хар» (3 знака) в очередь на лист не ставится, «Харк» (4) — ставится', k3);
}
{
  const g = npWorld();
  const h = (c, d) => g.sandbox.npLimitHit_(c, d);
  const F = (x) => Object.assign({ success: false, data: [] }, x);
  const yes = {
    'errors: массив строк': F({ errors: ['To many requests'] }),
    'errors: Too many': F({ errors: ['Too many requests'] }),
    'errors: одна строка': F({ errors: 'To many requests' }),
    'errors: объект {код: текст}': F({ errors: { '20000401501': 'To many requests' } }),
    'errors: объект, текст только в значении': F({ errors: { a: 'TOO MANY REQUESTS' } }),
    'errors: объект, только код в ключе': F({ errors: { '20000401501': '' } }),
    'errorCodes: массив строк': F({ errorCodes: ['20000401501'] }),
    'errorCodes: массив чисел': F({ errorCodes: [20000401501] }),
    'errorCodes: строка': F({ errorCodes: '20000401501' }),
    'errorCodes: число': F({ errorCodes: 20000401501 }),
    'errorCodes: объект': F({ errorCodes: { x: 20000401501 } }),
    'translatedErrors: массив': F({ translatedErrors: ['Забагато запитів. To many requests'] }),
    'translatedErrors: строка с кодом': F({ translatedErrors: 'код 20000401501' }),
    'warnings: массив': F({ warnings: ['To many requests'] }),
    'warnings: объект': F({ warnings: { w: 'too many requests' } }),
    'вложенный объект': F({ errors: [{ code: 20000401501, text: 'x' }] }),
    'регистр': F({ errors: ['tO mAnY rEqUeStS'] }),
    'success строкой false': F({ success: 'false', errors: ['To many requests'] }),
    'success отсутствует': { errors: ['To many requests'], data: [] },
  };
  Object.keys(yes).forEach(k => ok(h(200, yes[k]) === true, 'лимит распознан: ' + k));
  const no = {
    'обычная ошибка': F({ errors: ['API key is invalid'], errorCodes: ['20000200068'] }),
    'похожее слово': F({ errors: ['to many requests_x'] }),
    'другой код': F({ errorCodes: [200004015019] }),
    'успех с предупреждением': { success: true, warnings: ['To many requests'], data: [] },
    'успех строкой': { success: 'true', errors: ['To many requests'], data: [] },
    'пустые поля': F({ errors: [], errorCodes: [], translatedErrors: [], warnings: [] }),
    'ошибки — null': F({ errors: null, errorCodes: null }),
  };
  Object.keys(no).forEach(k => ok(h(200, no[k]) === false, 'лимитом не считается: ' + k));
  ok(h(429, null) === true && h('429', undefined) === true && h(200, null) === false && h(200, 'text') === false && h(500, F({})) === false, 'HTTP 429 (числом и строкой); пустой, не-объектный и 500 без текста — нет');
}

console.log('\n' + pass + ' ok, ' + fail + ' fail');
process.exit(fail ? 1 : 0);
