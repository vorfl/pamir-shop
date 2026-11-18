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

console.log('\n' + pass + ' ok, ' + fail + ' fail');
process.exit(fail ? 1 : 0);
