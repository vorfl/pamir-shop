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
  ok(fake.items.length === 2 && fake.items[0][0] === 'Етап 9Б2: записати другі фото' && typeof g00.sandbox[fake.items[0][1]] === 'function', 'пункт меню «Етап 9Б2: записати другі фото» добавлен');
  ok(fake.items[1][0] === 'Етап 9Б2: налаштувати' && fake.items[1][1] === 'stage9b2Setup' && typeof g00.sandbox.stage9b2Setup === 'function', 'пункт меню «Етап 9Б2: налаштувати» добавлен');
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
  ok(a.by['SET-010'].kp === 50 && a.by['SET-010'].a === 1, 'товар состава с единственной фасовкой: цена известна, kp = 50', a.by['SET-010']);
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
  return createGas(CODE, s);
}
const svcB = (g, num) => JSON.parse(g.sheets['Замовлення'].rows.find(r => r[0] === num)[16] || '{}');
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
  ok(res.ok && get('followup2_days') === '21' && get('followup1_days') === 5 && S.filter(r => r[0] === 'followup1_days').length === 1, 'шаг добавляет followup2_days = 21, уже стоящий followup1_days = 5 не трогает');
  ok(S.filter(r => r[0] === 'digest_hour').length === 1 && get('digest_hour') === '', 'digest_hour (уже есть, пусто) не меняется и не дублируется');
  ok(get('followup2_text_ua') === def2(g, 'followup2_text_ua') && String((S.find(r => r[0] === 'followup2_text_ua') || [])[2]).length > 30, 'тексты followup2 добавлены с описанием');
  const g1 = createGas(CODE, (() => { const t = build(); t.sheets['Налаштування'] = [['Ключ', 'Значення', 'Опис']]; return t; })());
  g1.call('stage9b2Setup');
  const S1 = g1.sheets['Налаштування'].rows, get1 = k => (S1.find(r => r[0] === k) || [])[1];
  ok(get1('followup1_days') === '3' && get1('followup2_days') === '21' && get1('digest_hour') === '', 'пустой лист настроек: followup1_days = 3, followup2_days = 21 (шаг включает), digest_hour пусто');
  const on = g1.call('followupJob_'); ok(on && on.f1 === 0 && on.f2 === 0, 'после шага включено, заказов к рассылке нет — ничего не шлётся');
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

/** Стенд API Новой почты: вызовы пишутся в st.calls (modelName, calledMethod, methodProperties). */
function npStub9(g, o) {
  o = o || {};
  const st = { calls: [], price: '95', save: o.save || 'ok', status: o.status || {}, apiDown: !!o.apiDown, ttnNext: TTN1 };
  g.setTelegramFail((method, payload) => {
    if (!payload.calledMethod) return null;
    st.calls.push(payload);
    const p = payload.methodProperties;
    if (st.apiDown) return { success: false, errors: ['API key is invalid ' + payload.apiKey], data: [] };
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
    if (payload.calledMethod === 'save') {
      if (st.save === 'net') throw new Error('network down https://api.novaposhta.ua/v2.0/json/?k=' + payload.apiKey);
      if (st.save === 'reject') return { success: false, errors: ['RecipientName is invalid', 'Weight too big'], errorCodes: ['20000200001'], data: [] };
      if (st.save === 'nonum') return { success: true, data: [{ Ref: 'x' }] };
      return { success: true, data: [{ Ref: 'doc-ref', IntDocNumber: st.ttnNext, CostOnSite: '70' }] };
    }
    if (payload.calledMethod === 'getStatusDocuments') {
      return { success: true, data: p.Documents.map(d => ({ Number: d.DocumentNumber, StatusCode: st.status[d.DocumentNumber] || '1', Status: 'x' })) };
    }
    return { success: true, data: [] };
  });
  return st;
}
const npOf = (st, m) => st.calls.filter(c => c.calledMethod === m);
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
const admP = (g, uid, action, data) => g.post(Object.assign({ action, initData: g.initData(U(uid)) }, data || {}));
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
  ok(pv('P-0108').ttn.cod === 700 && pv('P-0108').ttn.type === 'locker' && pv('P-0108').ttn.npWarehouse === 'Поштомат "Нова пошта" №12', 'накладений платіж — тоже оплата при получении; почтомат ищется среди почтоматов, не отделений');
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
  ok(p.PayerType === 'Recipient' && p.PaymentMethod === 'Cash' && p.CargoType === 'Parcel' && p.ServiceType === 'WarehouseWarehouse' && p.SeatsAmount === '1' && p.NewAddress === '1', 'свойства: получатель платит, наличные, посылка, склад–склад, одно место', p);
  ok(p.Weight === '1' && p.Cost === '1400' && p.CitySender === SENDER.NP_SENDER_CITY && p.Sender === SENDER.NP_SENDER_REF && p.ContactSender === SENDER.NP_SENDER_CONTACT && p.SenderAddress === SENDER.NP_SENDER_ADDRESS && p.SendersPhone === '380671112233', 'отправитель — из Script Properties, вес и сумма — подтверждённые/серверные');
  ok(p.CityRecipient === NPC && p.RecipientAddress === NPW && p.RecipientCityName === 'Харків' && p.RecipientAddressName === '12' && p.RecipientName === NPNAME && p.RecipientType === 'PrivatePerson' && p.RecipientsPhone === '380501112233' && /^\d\d\.\d\d\.\d{4}$/.test(p.DateTime), 'получатель: город, отделение (Ref), имя, телефон 380…, дата ДД.ММ.ГГГГ');
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
  ok(r2.ok && !('BackwardDeliveryData' in p2) && p2.Weight === '0.3' && p2.RecipientName === 'Петренко Іван Петрович' && p2.Cost === '900', 'оплата на карту: BackwardDeliveryData нет; вес 0,3 кг; имя подтверждено админом');
  // почтомат
  st.ttnNext = '20450000000003';
  const r3 = cr('P-0108');
  ok(r3.ok && npOf(st, 'save')[2].methodProperties.RecipientAddress === NPL, 'почтомат: Ref почтомата, не отделения');
  // чужие отказы
  ok(cr('P-0103').error === 'no_ref' && cr('P-0105').error === 'courier' && cr('P-0107').error === 'has_ttn' && npOf(st, 'save').length === 3, 'нет Ref / курьер / уже есть ТТН: отказ без вызова save');
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
    { num: 'P-0201', uid: 501, ago: 3, status: 'відправлено', svc: { i: [['SPS-001', 50, 1]], ttn: '20450000000011' } },
    { num: 'P-0202', uid: 502, ago: 40, status: 'відправлено', svc: { i: [['SPS-001', 50, 1]], ttn: '20450000000012' } },
    { num: 'P-0203', uid: 503, ago: 3, status: 'відправлено', svc: { i: [['SPS-001', 50, 1]], ttn: '20450000000013', ar: 1 } },
    { num: 'P-0204', uid: 504, ago: 3, status: 'виконано', svc: { i: [['SPS-001', 50, 1]], ttn: '20450000000014' } },
    { num: 'P-0205', uid: 505, ago: 3, status: 'відправлено', svc: { i: [['SPS-001', 50, 1]], ttn: '20450000000015' } },
    { num: 'P-0206', uid: 506, ago: 3, status: 'відправлено', source: 'miniapp test', svc: { i: [['SPS-001', 50, 1]], ttn: '20450000000016' } },
    { num: 'P-0207', uid: 507, ago: 3, status: 'відправлено', lang: 'ru', svc: { i: [['SPS-001', 50, 1]], ttn: '20450000000017' } },
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
  ok(/Ваш заказ № P-0207 прибыл в отделение Новой почты\. ТТН 20450000000017/.test(toChat(g, 507)[0].payload.text), 'RU-текст для ru-заказа');
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

console.log('\n' + pass + ' ok, ' + fail + ' fail');
process.exit(fail ? 1 : 0);
