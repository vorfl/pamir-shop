// Проверка «Підготовки до запуску» (apps-script/Launch.gs + LaunchData.gs) на таблице в памяти.
// Запуск: node tests/test_launch.js. Настоящая таблица, бот и Telegram в тестах не участвуют.
const path = require('path');
const { createGas } = require('./gas_mock');
const { launchSeed, launchData, applyAll, TEST_WHOLESALE } = require('./launch_seed');
const CODE = path.join(__dirname, '..', 'apps-script', 'Code.gs');

let pass = 0, fail = 0;
function ok(cond, name, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra !== undefined ? ' → ' + JSON.stringify(extra) : '')); }
}
const fresh = opts => createGas(CODE, launchSeed(opts));
const U = id => ({ id, first_name: 'Тест' + id, username: 'user' + id, language_code: 'uk' });
const DATA = launchData();
const KEEP = {}; DATA.products.forEach(p => { KEEP[p.id] = p; });
/** Снимок всех листов, кроме перечисленных. Даты приводятся к тексту. */
function snap(g, skip) {
  const out = {};
  Object.keys(g.sheets).filter(n => !(skip || []).includes(n)).sort().forEach(n => { out[n] = g.sheets[n].rows; });
  return JSON.stringify(out);
}
const ids = (g, sheet) => g.sheets[sheet].rows.slice(1).map(r => r[0]).filter(Boolean);
const colOf = (g, sheet, title) => g.sheets[sheet].rows[0].indexOf(title);
const rowOf = (g, sheet, id) => g.sheets[sheet].rows.find(r => r[0] === id);
const REPORT = 'Запуск — звіт';

console.log('Меню');
{
  const g = fresh();
  g.call('onOpen');
  const sub = g.ui.menu.items.filter(i => i[0] === '>')[0];
  ok(sub && sub[1].items.length === 3 && /^1\. Перевірити \(нічого не змінює\)$/.test(sub[1].items[0][0]) && /^2\. Зробити резервну копію$/.test(sub[1].items[1][0]) && /^3\. Застосувати$/.test(sub[1].items[2][0]),
    'PAMIR → «Підготовка до запуску»: три действия', sub && sub[1].items);
  ok(sub[1].items.every(i => typeof g.sandbox[i[1]] === 'function'), 'у каждого пункта меню есть функция');
}

console.log('1. Перевірити (сухой прогон)');
{
  const g = fresh();
  const before = snap(g, [REPORT]);
  const beforeProps = JSON.stringify(g.props);
  const plan = g.call('launchCheck_');
  ok(snap(g, [REPORT]) === before, 'сухой прогон ничего не меняет: снимок всех листов до и после совпадает');
  ok(JSON.stringify(g.props) === beforeProps, 'и свойства скрипта не меняет');
  ok(!plan.fatal && plan.sum.keep === 50 && plan.sum.add === 20 && plan.sum.archive === 142 && plan.sum.purge === 4, 'сводка: 50 остаётся (20 новых), 142 в архив, 4 удалить навсегда', plan.sum);
  ok(plan.sum.prices === 30 && plan.sum.changed === 30, 'у всех 30 существующих позиций меняется цена', plan.sum);
  ok(plan.sum.recipes === 7 && plan.sum.orders === 14 && plan.sum.carts === 2 && plan.sum.events === 3 && plan.sum.points === 2, 'рецепты, тестовые заказы, корзины, события, точки посчитаны', plan.sum);
  ok(plan.sum.nextOrder === 'P-0015', 'следующий настоящий заказ — P-0015 (нумерация продолжается)', plan.sum.nextOrder);
  const rep = g.sheets[REPORT].rows;
  const text = rep.map(r => r.join(' | ')).join('\n');
  ok(rep.some(r => r[0] === 'Аркуш' && r[3] === 'Було' && r[4] === 'Стане'), 'лист «Запуск — звіт»: таблица «лист, ID, поле, было → станет»');
  ok(rep.some(r => r[0] === 'Товари' && r[1] === 'DRY-039' && r[2] === 'Ціна за 1 кг' && r[3] === '380' && r[4] === 440), 'в отчёте: курага 380 → 440', rep.filter(r => r[1] === 'DRY-039'));
  ok(rep.some(r => r[1] === 'NUT-068' && r[4] === 'видалити назавжди') && rep.some(r => r[1] === 'NUT-500' && r[4] === 'в архів'), 'в отчёте: тестовая строка — удалить, чужой товар — в архив');
  ok(rep.some(r => r[1] === 'NUT-006' && r[2] === 'ціна' && r[3] === '70' && r[4] === 240), 'в отчёте: NUT-006 — цена возвращается из колонки «Конкурент»');
  ok(/ПІДСУМОК[\s\S]*В архів: 142 товарів[\s\S]*ПІДСУМОК/.test(text), 'сводка есть вверху и в конце отчёта');
  ok(plan.warn.some(w => /DRY-039.*мала маржа.*роздріб/.test(w)) && plan.warn.some(w => /DRY-039.*мала маржа.*опт/.test(w)), 'предупреждение «мала маржа»: розница < закупка × 1,35 и опт < закупка × 1,15', plan.warn);
  ok(plan.warn.some(w => /NUT-014.*сильно відрізняється від конкурента.*−?-35 %/.test(w)), 'предупреждение «сильно відрізняється від конкурента» (больше 30 %)', plan.warn.filter(w => /NUT-014/.test(w)));
  ok(!plan.warn.some(w => /NUT-047.*конкурент/.test(w)), 'отличие меньше 30 % — без предупреждения');
  ok(!plan.warn.some(w => /чужа марка/.test(w)), 'после замены названий чужих марок в 50 позициях не остаётся');
  ok(plan.info.some(t => /Адміни \(2\).*БЕЗ ІМЕНІ.*Без імені: 1/.test(t)), 'отчёт перечисляет админов и говорит, у кого нет имени', plan.info.filter(t => /Адміни/.test(t)));
  ok(plan.info.some(t => /DRY-073.*немає/.test(t)) && plan.info.some(t => /SPS-004.*немає/.test(t)), 'отчёт называет позиции, которые будут «немає»');
  g.call('menuLaunchCheck');
  ok(/нічого не змінено/.test(g.ui.alerts.pop()), 'окно после проверки говорит, что ничего не изменено');
}

console.log('Не та таблица');
{
  const g = createGas(CODE, require('./gas_mock').seed()); // обычная тестовая таблица: наших 30 позиций в ней нет
  const before = snap(g, [REPORT]);
  const plan = g.call('launchCheck_');
  ok(/не та таблиця/.test(plan.fatal), 'в чужой таблице план останавливается с объяснением', plan.fatal);
  g.call('launchBackup_');
  const res = g.call('launchApply_');
  ok(res.ok === false && res.error === 'fatal' && snap(g, [REPORT, 'Журнал']) === before, '«Застосувати» в чужой таблице ничего не меняет', res);
}

console.log('2. Резервная копия и запрет без неё');
{
  const g = fresh();
  const before = snap(g);
  const res = g.call('launchApply_');
  ok(res.ok === false && res.error === 'no_backup' && snap(g) === before, '«Застосувати» без резервной копии за сегодня — отказ, таблица не тронута', res);
  g.call('menuLaunchApply');
  ok(/Спочатку зробіть резервну копію/.test(g.ui.alerts.pop()) && snap(g) === before, 'меню «3. Застосувати» объясняет, что сначала нужна копия');
  const b = g.call('launchBackup_');
  ok(b.ok && !b.already && g.copies.length === 1 && /^PAMIR — Товари — резерв перед запуском \d\d\.\d\d\.\d{4}$/.test(g.copies[0].name), 'копия создана с именем «… резерв перед запуском ДД.ММ.РРРР»', g.copies[0] && g.copies[0].name);
  ok(g.copies[0].sheets['Товари'].length === g.sheets['Товари'].rows.length && g.copies[0].sheets['Замовлення'].length === 15, 'в копии — вся таблица до изменений');
  ok(g.call('launchBackup_').already === true && g.copies.length === 1, 'вторая копия в тот же день не создаётся');
  ok(/Запуск: резервна копія/.test(g.sheets['Журнал'].rows.slice(-1)[0][3]), 'копия записана в «Журнал»');
  g.props.LAUNCH_BACKUP = JSON.stringify({ day: '2020-01-01', name: 'стара' });
  ok(g.call('launchApply_').error === 'no_backup', 'вчерашняя копия не считается');
  g.ui.answer = 'NO';
  g.call('launchBackup_');
  g.call('menuLaunchApply');
  ok(/Застосувати підготовку до запуску\?[\s\S]*В архів: 142 товарів[\s\S]*Видалити назавжди: 4/.test(g.ui.alerts.pop()) && g.sheets['Товари'].rows.length === 177,
    'окно подтверждения показывает числа из прогона; «Ні» — ничего не меняется', g.sheets['Товари'].rows.length);
}

console.log('3. Застосувати: обрыв по времени и продолжение');
const G = fresh({ noNewCols: true });
{
  const g = G;
  g.call('launchBackup_');
  const first = g.call('launchApply_', { budgetMs: 0, chunk: 25 });
  ok(first.ok && first.done === false && JSON.parse(g.props.LAUNCH_STATE).phase === 1, 'время вышло: шаг сохранён, ответ «не закончено»', [first, g.props.LAUNCH_STATE]);
  g.ui.answer = 'YES';
  g.sandbox.LAUNCH_RUN_MS = 0; g.sandbox.LAUNCH_ARCHIVE_CHUNK = 25; // «лимит времени» для стенда: один шаг за нажатие
  g.call('menuLaunchApply');
  const again = g.ui.alerts.pop();
  ok(/Продовжіть: натисніть ще раз/.test(again) && /Продовжуємо з кроку «тестові рядки»/.test(g.ui.alerts.pop()), 'меню просит: «Продовжіть: натисніть ще раз» и говорит, с какого шага продолжает', again);
  let presses = 2, res, midArchive = false;
  do {
    res = g.call('launchApply_', { budgetMs: 0, chunk: 25 });
    presses++;
    const left = ids(g, 'Товари').filter(id => !KEEP[id]).length;
    if (!res.done && res.phase === 'archive' && left > 0 && left < 142) midArchive = true;
  } while (!res.done && presses < 100);
  g.sandbox.LAUNCH_RUN_MS = 4 * 60 * 1000; g.sandbox.LAUNCH_ARCHIVE_CHUNK = 60;
  ok(res.done && midArchive,'архив переносится порциями: после обрыва продолжается с того же места', presses);
  ok(presses > 10 && g.props.LAUNCH_STATE === '' && /^\d\d\.\d\d\.\d{4}$/.test(g.props.LAUNCH_DONE), 'после ' + presses + ' нажатий всё доведено до конца, шаг сброшен');
  g.clearCache();
}

console.log('Результат на стенде');
{
  const g = G;
  const list = ids(g, 'Товари');
  ok(list.length === 50 && list.every(id => KEEP[id]) && new Set(list).size === 50, 'в «Товари» ровно 50 строк — те самые ID', list.length);
  const arch = ids(g, 'Архів товарів');
  ok(arch.length === 142 && new Set(arch).size === 142 && arch.includes('DRY-030') && arch.includes('NUT-006'), 'архив содержит остальные 142 товара без дублей (DRY-030 и NUT-006 тоже там)', arch.length);
  ok(DATA.del.every(id => !list.includes(id) && !arch.includes(id)) && DATA.del.every(id => g.props.DELETED_IDS.split(',').includes(id)), 'тестовые строки удалены навсегда, их ID запомнены', g.props.DELETED_IDS);
  ok(g.call('reservedIdMax_', 'NUT') >= 70 && g.call('reservedIdMax_', 'DRY') >= 88, 'новый товар не получит ID удалённой тестовой строки');
  const aHead = g.sheets['Архів товарів'].rows[0];
  const n6 = rowOf(g, 'Архів товарів', 'NUT-006');
  ok(n6[aHead.indexOf('Ціна за 1 кг, ₴')] === 240 && n6[aHead.indexOf('Бейдж')] === '' && n6[aHead.indexOf('Стара ціна')] === '' && n6[aHead.indexOf('Акція до')] === '',
    'NUT-006 в архиве: цена из «Конкурент», без бейджа, старой цены и «Акція до»', n6);
  ok(rowOf(g, 'Архів товарів', 'NUT-504')[aHead.indexOf('Джерело')] === 'do-smaku.com.ua' && rowOf(g, 'Архів товарів', 'NUT-504')[aHead.indexOf('Конкурент, ₴')] === 154 && aHead.includes('Хто архівував'), 'в архив строка уходит целиком, со служебными колонками');
  const restored = g.post({ action: 'admin.restore', initData: g.initData(U(900)), id: 'NUT-500' });
  ok(restored.ok && ids(g, 'Товари').includes('NUT-500'), 'товар из архива возвращается через панель', restored);
  g.post({ action: 'admin.archive', initData: g.initData(U(900)), id: 'NUT-500' });
  g.clearCache();

  const head = g.sheets['Товари'].rows[0];
  ok(['Опт: мін, кг', 'Як їсти (UA)', 'Как есть (RU)', 'Теги'].every(h => head.includes(h)), 'недостающие колонки созданы с заголовками, которые ждёт код 2в', head.slice(-6));
  const text = JSON.stringify(g.get({ action: 'catalog' }));
  const cat = JSON.parse(text);
  const by = {}; cat.products.forEach(p => { by[p.id] = p; });
  ok(cat.products.length === 50 && cat.products.every(p => KEEP[p.id]), 'на витрине ровно 50 товаров', cat.products.length);
  const grey = cat.products.filter(p => !p.a).map(p => p.id);
  ok(grey.length === 18 && grey.includes('DRY-073') && grey.includes('SPS-004') && !grey.includes('SPS-001') && !grey.includes('SPS-003'),
    'заказать можно 32; серые — DRY-073 («немає» в таблице) и 17 неподтверждённых специй', grey);
  ok(cat.products.every(p => p.t === 'w' && p.ua === KEEP[p.id].ua && (p.ru || p.ua) === KEEP[p.id].ru && p.k === KEEP[p.id].price), 'у всех 50: тип «вагова», наши названия и наши цены за 1 кг');
  ok(cat.products.every(p => p.dUa === KEEP[p.id].dUa && p.dRu === KEEP[p.id].dRu) && !/УТОЧНИТЬ/.test(text), 'описания из файла ассортимента; пометок «уточнить» на витрине нет');
  ok(cat.products.every(p => !p.cu && !p.cr), '«Склад» у смесей отца не заполнен');
  ok(cat.products.every(p => !p.b && !p.o && !p.e), 'бейджей, старых цен и акций нет ни у кого');
  ok(by['SWT-054'].v.map(v => v[0]).join() === '250,500,1000' && by['CND-016'].v.length === 3 && rowOf(g, 'Товари', 'SWT-054')[head.indexOf('Ціна за упаковку / шт, ₴')] === '',
    'халва и конфеты: были «упаковка», стали «вагова» с фасовками от цены за 1 кг', by['SWT-054']);
  ok(by['NUT-047'].v.every(v => v[1] === Math.round(380 * v[0] / 1000)) && rowOf(g, 'Товари', 'NUT-047')[head.indexOf('Ціни фасувань')] === '', '«Ціни фасувань» очищены: фасовки считаются от цены за 1 кг');
  ok(rowOf(g, 'Товари', 'DRY-039')[head.indexOf('Ціна за 100 г, ₴')] === 44 && rowOf(g, 'Товари', 'SPS-007')[head.indexOf('Ціна за 100 г, ₴')] === 120, '«Ціна за 100 г» пересчитана от новой цены');
  ok(rowOf(g, 'Товари', 'DRY-039')[head.indexOf('Конкурент, ₴')] === 380 && rowOf(g, 'Товари', 'DRY-039')[head.indexOf('Закупка, ₴')] === 400, 'служебные колонки («Конкурент», «Закупка») не изменились');
  ok(rowOf(g, 'Товари', 'DRY-073')[head.indexOf('Наявність')] === 'немає' && rowOf(g, 'Товари', 'DRY-039')[head.indexOf('Наявність')] === 'є', 'наличие существующих позиций не тронуто');

  // Цены фасовок: витрина и сервер.
  let packsOk = true, n50 = 0;
  cat.products.forEach(p => p.v.forEach(v => { if (v[1] !== Math.round(KEEP[p.id].price * v[0] / 1000)) packsOk = false; if (v[0] === 50) n50++; }));
  ok(packsOk && n50 === 15, 'цены всех фасовок = цена за 1 кг × вес, с округлением до гривны (50 г есть у 15 специй)', n50);
  ok(DATA.products.filter(p => p.isNew).every(p => by[p.id].v.map(v => v[0] + ' г').join(' / ').replace('1000 г', '1 кг') === p.packs), 'фасовки специй — как в задании');
  const o1 = g.post({ action: 'order', initData: g.initData(U(42)), items: [{ id: 'SPS-001', g: 100, q: 1 }, { id: 'DRY-039', g: 250, q: 2 }], total: 68 + 220, name: 'Олена', phone: '+380501234567', delivery: 'pickup', pay: 'cash', lang: 'ua', rid: 'l1' });
  ok(o1.ok && o1.number === 'P-0015', 'сервер принимает заказ по ценам витрины; первый настоящий заказ — P-0015', o1);
  ok(g.post({ action: 'order', initData: g.initData(U(42)), items: [{ id: 'SPS-001', g: 100, q: 1 }], total: 54, name: 'Олена', phone: '+380501234567', delivery: 'pickup', pay: 'cash', lang: 'ua', rid: 'l2' }).error === 'changed', 'обычный клиент не может заказать по оптовой цене');
  ok(g.post({ action: 'order', initData: g.initData(U(42)), items: [{ id: 'SPS-006', g: 50, q: 1 }], total: 34, name: 'Олена', phone: '+380501234567', delivery: 'pickup', pay: 'cash', lang: 'ua', rid: 'l3' }).error === 'changed', 'товар «немає» заказать нельзя');
  g.sheets['Товари'].rows.forEach(r => { if (/^SPS-/.test(r[0])) r[head.indexOf('Наявність')] = 'є'; });
  g.clearCache();
  let spiceOk = true;
  const shop50 = g.get({ action: 'catalog' }).products.filter(p => /^SPS-/.test(p.id) && p.v[0][0] === 50);
  shop50.forEach((p, i) => {
    const q = Math.ceil(250 / p.v[0][1]); // минимальная сумма заказа на стенде — 250 ₴
    const res = g.post({ action: 'order', initData: g.initData(U(1000 + i)), items: [{ id: p.id, g: 50, q }], total: p.v[0][1] * q, name: 'Олена', phone: '+380501234567', delivery: 'pickup', pay: 'cash', lang: 'ua', rid: 's' + i });
    if (!res.ok || p.v[0][1] !== Math.round(KEEP[p.id].price * 50 / 1000)) spiceOk = false;
  });
  ok(spiceOk && shop50.length === 15, 'цена фасовки 50 г у всех 15 специй совпадает на витрине и на сервере (заказ принят по этой цене)');

  // Опт и служебные колонки.
  const whNums = Object.keys(TEST_WHOLESALE).map(k => TEST_WHOLESALE[k][0]);
  ok(!whNums.some(n => new RegExp('[^0-9]' + n + '[^0-9]').test(text)), 'в каталоге обычного клиента нет ни одной оптовой цены');
  ok(!/СЕКРЕТ|do-smaku|33%/.test(text) && !/[^0-9]400[^0-9]/.test(JSON.stringify(by['DRY-039'])), 'служебные колонки R–X (примітка, закупка, маржа, джерело) не уходят клиенту');
  const allowed = ['id', 'c', 'ua', 'ru', 't', 'k', 'v', 'a', 'dUa', 'dRu', 'wb', 'eu', 'er', 'tg', 'n', 'r', 'q', 'img', 'hw'];
  ok(cat.products.every(p => Object.keys(p).every(k => allowed.includes(k))), 'в товаре каталога только клиентские поля', cat.products.map(p => Object.keys(p).filter(k => !allowed.includes(k))).filter(a => a.length)[0]);
  ok(cat.products.filter(p => p.wb).map(p => p.id).sort().join() === Object.keys(TEST_WHOLESALE).sort().join(), 'отметка «есть оптовая цена» — только у товаров из оптовой таблицы');
  const whRow = rowOf(g, 'Товари', 'DRY-039'), whNo = rowOf(g, 'Товари', 'NUT-036');
  ok(whRow[head.indexOf('Опт: ціна за 1 кг / уп., ₴')] === 377 && whRow[head.indexOf('Опт: мін, кг')] === 5 && whNo[head.indexOf('Опт: ціна за 1 кг / уп., ₴')] === '' && whNo[head.indexOf('Опт: мін, кг')] === '',
    'оптовая цена и «Опт: мін, кг» числом; у товаров без опта колонки пустые');
  const plain = g.post({ action: 'wh.prices', initData: g.initData(U(42)) });
  const biz = g.post({ action: 'wh.prices', initData: g.initData(U(555)) });
  ok(plain.ok && plain.wh === false && !plain.prices, 'обычному клиенту оптовые цены не отдаются', plain);
  ok(biz.wh === true && Object.keys(biz.prices).length === 6 && biz.prices['SPS-001'].join() === '537,1,kg', 'одобренный оптовик получает оптовые цены', biz.prices);

  // Чужие марки.
  const brandRe = new RegExp('(^|[^A-Za-zА-Яа-яІіЇїЄєҐґ0-9])(' + DATA.brands.map(b => b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')(?![A-Za-zА-Яа-яІіЇїЄєҐґ0-9])', 'i');
  const visible = cat.products.map(p => [p.ua, p.ru, p.dUa, p.dRu, p.eu, p.er, (p.tg || []).join(','), p.ps, p.ph, p.po, p.h, p.hr, p.cu, p.cr].join(' | '));
  ok(DATA.brands.length >= 30 && visible.every(v => !brandRe.test(v)), 'ни одна чужая марка из аудита не видна в 50 позициях', visible.filter(v => brandRe.test(v))[0]);
  ok(brandRe.test('Халва тахінна Amanti 5 кг') && brandRe.test('цукерки King') && !brandRe.test('Фініки королівські'), 'проверка марок действительно ловит марку');

  // «Як їсти», теги.
  ok(cat.products.filter(p => p.eu).length === 20 && cat.products.filter(p => p.eu).every(p => p.eu === KEEP[p.id].howUa && p.er === KEEP[p.id].howRu), '«Як їсти» заполнено у 20 позиций, UA и RU');
  ok(cat.products.every(p => p.tg.join(', ') === KEEP[p.id].tags) && by['DRY-086'].tg.includes('до м\'яса') && by['SPS-001'].tg.includes('спеції батька'), 'теги — как в задании, строчными, через запятую');
  ok(!/здоров|лікує|корисн|полезн|лечит/i.test(cat.products.map(p => [p.dUa, p.dRu, p.eu, p.er].join(' ')).join(' ')), 'в описаниях и «Як їсти» нет обещаний о здоровье');
}

console.log('Рецепты');
{
  const g = G;
  const rec = g.sheets['Рецепти'].rows;
  ok(rec.length === 8 && rec[0].join() === 'ID,Назва (UA),Название (RU),Фото,Текст (UA),Текст (RU),Товари,Показувати', 'лист «Рецепти» создан с колонками, которые ждёт код 2в; 7 рецептов', rec.length);
  const cat = g.get({ action: 'catalog' });
  ok(cat.recipes.length === 7 && cat.recipes.every(r => !r.img && r.tUa && r.tRu && r.items.length), 'на витрине 7 рецептов: тексты UA и RU, фото нет');
  ok(cat.recipes.map(r => r.items[0]).join() === 'DRY-068,SPS-001,SPS-002,SPS-003,DRY-039,DRY-071,DRY-086', 'главный ингредиент — первый в списке товаров');
  const plov = cat.recipes.find(r => r.id === 'REC-002');
  ok(/спеції для плову — за смаком/.test(plov.tUa) && !/спеції для плову — \d/.test(plov.tUa) && /барбарис — 1 ч\. л\./.test(plov.tUa), 'дозировка смеси отца не указана («за смаком»), остальное количество — в тексте');
  ok(cat.recipes.every(r => r.items.every(id => KEEP[id])), 'ингредиенты рецептов — только из 50 позиций');
  const head = g.sheets['Товари'].rows[0], sc = head.indexOf('Наявність');
  rowOf(g, 'Товари', 'DRY-068')[sc] = 'немає';
  g.clearCache();
  const cat2 = g.get({ action: 'catalog' });
  ok(!cat2.recipes.some(r => r.id === 'REC-001') && cat2.recipes.length === 6 && cat2.recipes.some(r => r.id === 'REC-002'), 'главного ингредиента «немає» — рецепт скрыт; рецепт, где он не главный, остаётся', cat2.recipes.map(r => r.id));
  rowOf(g, 'Товари', 'DRY-068')[sc] = 'є';
  g.post({ action: 'admin.archive', initData: g.initData(U(900)), id: 'DRY-071' });
  g.clearCache();
  ok(!g.get({ action: 'catalog' }).recipes.some(r => r.id === 'REC-006'), 'главный ингредиент в архиве — рецепт скрыт');
  g.post({ action: 'admin.restore', initData: g.initData(U(900)), id: 'DRY-071' });
  g.clearCache();
}

console.log('Настройки, приветствие, точки');
{
  const g = G;
  const shop = g.get({ action: 'catalog' }).shop;
  ok(!shop.gift && !shop.loyal, 'шуточные подарки выключены');
  const st = {}; g.sheets['Налаштування'].rows.slice(1).forEach(r => { st[r[0]] = r[1]; });
  ok(st.gift_from === '0' && st.loyal_every === '0' && st.gift_text_ua === '' && st.loyal_text_ru === '', 'gift_from и loyal_every = 0, шуточные тексты очищены', [st.gift_from, st.gift_text_ua]);
  ok(st.min_order === '250' && st.remind_days === '14' && st.contact === '@pamir_test', 'min_order, remind_days и остальные настройки не тронуты');
  ok(shop.feature.id === 'DRY-039' && shop.feature.title.ua === 'Наша курага' && /абрикосовою кислинкою/.test(shop.feature.text.ua) && /абрикосовой кислинкой/.test(shop.feature.text.ru), 'блок «Наша курага»');
  ok(shop.hours.ua === 'вівторок–неділя, 8:00–16:00; понеділок — санітарний день' && /понедельник — санитарный день/.test(shop.hours.ru), 'часы работы');
  ok(shop.father.ids.join() === 'SPS-001,SPS-002,SPS-003,SPS-004,SPS-005' && shop.father.title.ua === 'Спеції від батька' && /лагману й мантів/.test(shop.father.text.ua) && shop.father.title.ru === 'Специи от отца', 'подборка «Спеції від батька» видна: 5 смесей, заголовок и текст');
  ok(shop.min === 250, 'минимальная сумма заказа осталась 250 ₴');
  const send = (uid, lang) => { g.post({ update_id: 7000 + uid, message: { message_id: 1, chat: { id: uid, type: 'private' }, from: { id: uid, first_name: 'Олена', language_code: lang }, text: '/start' } }, { src: 'tg', key: 'whsec' }); return g.sent.filter(m => String(m.payload.chat_id) === String(uid)).pop(); };
  const hi = send(4242, 'uk');
  const hiText = hi && (hi.payload.caption || hi.payload.text) || '';
  ok(/^Вітаємо, Олена! 🌿\nPAMIR — наша родинна справа/.test(hiText) && /кошик збирається за кілька хвилин\.$/.test(hiText), 'приветствие нового клиента: имя подставлено', hiText);
  const hiRu = send(4243, 'ru');
  ok(/^Здравствуйте, Олена! 🌿/.test(hiRu.payload.caption || hiRu.payload.text), 'приветствие RU');
  const back = send(42, 'uk'); // у клиента 42 уже есть заказ
  ok(/^З поверненням, Олена! Раді бачити вас знову\.\nПопереднє замовлення можна повторити в один дотик — або зібрати щось нове\.$/.test(back.payload.caption || back.payload.text), 'приветствие вернувшегося клиента', back.payload.caption || back.payload.text);

  ok(shop.points.length === 2 && shop.points.every(p => p.a.ua === 'Центральний ринок, вул. Різдвяна, 33, критий павільйон' && p.a.ru === 'Центральный рынок, ул. Рождественская, 33, крытый павильон'), 'у обеих точек новый адрес UA и RU');
  ok(shop.points.every(p => p.h.join() === ',08:00-16:00,08:00-16:00,08:00-16:00,08:00-16:00,08:00-16:00,08:00-16:00'), 'часы точек: понедельник — выходной, вт–нд 8:00–16:00', shop.points[0].h);
  ok(shop.points.every(p => !p.pl && !p.how && !p.tel), 'ряд, место, «як знайти» и телефон очищены и на витрину не уходят');
  const msg = g.call('pointsMessage_', g.call('readSettings_'), false, 'https://example.test/webapp/', true).text;
  ok(!/Ряд|📞|місце/.test(msg) && /Пн: вихідний, Вт–Нд: 08:00–16:00/.test(msg), 'бот в ответе «Наші точки» не показывает пустых строк', msg);
}

console.log('Тестовые данные');
{
  const g = G;
  const kept = g.sheets['Тестові замовлення (архів)'].rows;
  ok(kept.length === 15 && kept[1][0] === 'P-0001' && kept[14][0] === 'P-0014' && kept[1][6] === '+380501112233', 'тестовые заказы P-0001 … P-0014 сохранены в «Тестові замовлення (архів)»', kept.length);
  const ord = ids(g, 'Замовлення');
  ok(!ord.some(n => /^P-00(0\d|1[0-4])$/.test(n)) && ord[0] === 'P-0015', 'в «Замовлення» тестовых заказов нет; настоящий заказ получил P-0015', ord.slice(0, 3));
  ok(g.props.ORDER_NUM_FLOOR === '14', 'счётчик номеров запомнен (ORDER_NUM_FLOOR = 14)');
  ok(g.sheets['Кошики'].rows.filter(r => r.some(v => v !== '')).length === 1 && g.sheets['Кошики'].rows[0][0] === 'Telegram user id', '«Кошики» очищены, заголовок остался');
  ok(g.sheets['Події'].rows.filter(r => r.some(v => v !== '')).length === 1 && g.sheets['Події'].rows[0][0] === 'Час', '«Події» очищены, заголовок остался');
  ok(g.sheets['Клієнти'].rows.length >= 3 && g.sheets['Клієнти'].rows[1][1] === 'Власник', 'лист «Клієнти» не тронут');
  ok(JSON.stringify(g.sheets['Адміни'].rows) === JSON.stringify(launchSeed().sheets['Адміни']), 'лист «Адміни» не тронут');
  const log = g.sheets['Журнал'].rows;
  ok(log[1][4] === 'NUT-006' && log.some(r => r[3] === 'Запуск: в архів') && log.some(r => r[3] === 'Запуск: товар оновлено' && /DRY-039/.test(r[4]) && /ціна 380/.test(r[5]) && /ціна 440/.test(r[6])) &&
    log.some(r => r[3] === 'Запуск: рецепт додано') && log.some(r => r[3] === 'Запуск: налаштування' && r[4] === 'gift_from') && log.some(r => r[3] === 'Запуск: завершено'),
    'всё записано в «Журнал»; старые записи на месте');
  ok(g.sheets['Статистика'] && g.sheets['Статистика'].rows.length > 2, '«Статистика» пересчитана');
  ok(g.sandbox.__errors.length === 0, 'в логах бэкенда нет ошибок', g.sandbox.__errors);
}

console.log('Повторное «Застосувати»');
{
  const g = G;
  // После запуска магазин живёт: появляются настоящие события и корзины, владелец правит наличие.
  g.sheets['Події'].rows.push([new Date(), '42', 's9', 'open', '', '']);
  g.sheets['Кошики'].rows.push(['42', new Date(), '[]', 'ua', '', '']);
  const eventsBefore = JSON.stringify(g.sheets['Події'].rows), cartsBefore = JSON.stringify(g.sheets['Кошики'].rows);
  const plan = g.call('launchPlan_');
  ok(plan.rows.length === 0 && plan.sum.changed === 0 && plan.sum.archive === 0 && plan.sum.recipes === 0 && plan.sum.settings === 0 && plan.sum.orders === 0, 'после применения проверка не находит ни одного изменения', plan.rows.slice(0, 5));
  const before = snap(g, [REPORT, 'Журнал', 'Статистика']);
  const counts = () => [ids(g, 'Товари').length, ids(g, 'Архів товарів').length, ids(g, 'Рецепти').length, g.sheets['Налаштування'].rows.length, ids(g, 'Тестові замовлення (архів)').length, ids(g, 'Замовлення').length];
  const c1 = counts();
  const res = g.call('launchApply_');
  ok(res.ok && res.done && snap(g, [REPORT, 'Журнал', 'Статистика']) === before, 'повторный запуск ничего не меняет', res);
  ok(counts().join() === c1.join() && ids(g, 'Товари').filter(id => /^SPS-/.test(id)).length === 20 && new Set(ids(g, 'Рецепти')).size === 7, 'нет дублей рецептов, строк SPS и настроек', counts());
  ok(JSON.stringify(g.sheets['Події'].rows) === eventsBefore && JSON.stringify(g.sheets['Кошики'].rows) === cartsBefore, 'настоящие «Події» и «Кошики» повторный запуск не стирает');
  g.ui.answer = 'NO';
  g.call('menuLaunchApply');
  ok(/УВАГА\. Підготовку вже застосовано \d\d\.\d\d\.\d{4}/.test(g.ui.alerts.pop()), 'меню предупреждает, что подготовка уже применена');
  // Правка руками сохраняется, а данные из подготовки возвращаются.
  const head = g.sheets['Товари'].rows[0];
  rowOf(g, 'Товари', 'SPS-004')[head.indexOf('Наявність')] = 'є';
  rowOf(g, 'Товари', 'DRY-039')[head.indexOf('Теги')] = 'зіпсовано';
  g.call('launchApply_');
  ok(rowOf(g, 'Товари', 'SPS-004')[head.indexOf('Наявність')] === 'є' && rowOf(g, 'Товари', 'DRY-039')[head.indexOf('Теги')] === KEEP['DRY-039'].tags, 'наличие, поставленное руками, не сбрасывается; теги из подготовки возвращаются');
}

console.log('Обрыв между записью в архив и удалением');
{
  const g = fresh();
  g.call('launchBackup_');
  // Имитация: строка уже попала в архив, но из «Товари» удалиться не успела.
  g.call('ensureArchiveSheet_');
  const pHead = g.sheets['Товари'].rows[0], aHead = g.sheets['Архів товарів'].rows[0];
  const src = rowOf(g, 'Товари', 'NUT-500');
  const row = aHead.map(h => (pHead.indexOf(h) >= 0 ? src[pHead.indexOf(h)] : ''));
  g.sheets['Архів товарів'].rows.push(row);
  applyAll(g);
  ok(ids(g, 'Архів товарів').filter(id => id === 'NUT-500').length === 1 && !ids(g, 'Товари').includes('NUT-500') && ids(g, 'Архів товарів').length === 142, 'строка, которая уже была в архиве, не дублируется');
}

console.log('Варианты таблицы');
{
  const g = fresh({ noWholesale: true });
  const plan = g.call('launchCheck_');
  ok(plan.warn.some(w => /Оптові ціни не завантажено/.test(w)), 'нет файла оптовых цен — предупреждение');
  applyAll(g);
  const head = g.sheets['Товари'].rows[0];
  ok(rowOf(g, 'Товари', 'DRY-039')[head.indexOf('Опт: ціна за 1 кг / уп., ₴')] === 320 && rowOf(g, 'Товари', 'DRY-039')[head.indexOf('Опт: мін. обсяг')] === 'від 5 кг', 'без файла оптовых цен колонки опта не трогаются');

  const g2 = fresh({ withRecipes: true });
  g2.sheets['Рецепти'].rows.push(['REC-001', 'Стара назва', '', 'https://example.test/uzvar.jpg', 'старий текст', '', 'DRY-068', 'ні'], ['MY-1', 'Свій рецепт', '', '', 'текст', '', 'DRY-039', 'так']);
  g2.sheets['Товари'].rows.push(g2.sheets['Товари'].rows[0].map((h, i) => (i === 0 ? 'SPS-001' : i === 3 ? 'Суміш для плову (стара)' : i === 5 ? 'упаковка' : i === 6 ? '50 г' : i === 10 ? 45 : i === 11 ? 'немає' : '')));
  const p2 = g2.call('launchCheck_');
  ok(p2.sum.add === 19, 'строка SPS, которая уже есть, второй раз не добавляется', p2.sum.add);
  applyAll(g2);
  const r = g2.sheets['Рецепти'].rows;
  ok(r.length === 9 && r[1][1] === 'Узвар з урюка' && r[1][3] === 'https://example.test/uzvar.jpg' && r[1][7] === 'ні' && r[2][0] === 'MY-1' && r[2][1] === 'Свій рецепт',
    'существующий рецепт обновлён по ID (фото и «Показувати» не тронуты), чужой рецепт остался', r.slice(1, 3).map(x => [x[0], x[1], x[7]]));
  const sps = g2.sheets['Товари'].rows.filter(x => x[0] === 'SPS-001');
  const h2 = g2.sheets['Товари'].rows[0];
  ok(sps.length === 1 && sps[0][3] === KEEP['SPS-001'].ua && sps[0][5] === 'вагова' && sps[0][h2.indexOf('Ціна за 1 кг, ₴')] === 680 && sps[0][h2.indexOf('Наявність')] === 'немає' && sps[0][6] === '100 г / 250 г / 500 г',
    'существующая строка SPS-001 обновлена: тип, фасовка, цена; наличие не тронуто', sps[0]);
  ok(g2.sandbox.__errors.length === 0 && g.sandbox.__errors.length === 0, 'в логах бэкенда нет ошибок', g2.sandbox.__errors.concat(g.sandbox.__errors));
}

console.log('Настоящий файл оптовых цен (если он есть на этой машине)');
{
  const fs = require('fs');
  const file = path.join(__dirname, '..', 'apps-script', 'LaunchWholesale.gs');
  if (!fs.existsSync(file)) console.log('  —    файла LaunchWholesale.gs нет (он не хранится в репозитории) — пропущено');
  else {
    const seed = launchSeed();
    seed.skipFiles = []; seed.extraCode = [];
    const g = createGas(CODE, seed);
    applyAll(g);
    const wh = g.sandbox.LAUNCH_WHOLESALE;
    const text = JSON.stringify(g.get({ action: 'catalog' }));
    const cat = JSON.parse(text);
    ok(Object.keys(wh).length === 14 && Object.keys(wh).every(id => KEEP[id] && wh[id][0] < KEEP[id].price && wh[id][1] > 0), '14 оптовых цен, каждая ниже розничной, минимальный объём задан');
    ok(cat.products.filter(p => p.wb).length === 14 && cat.products.every(p => !('wh' in p) && !('wp' in p)), 'в каталоге обычного клиента только отметка «есть опт», самих оптовых цен нет');
    const biz = g.post({ action: 'wh.prices', initData: g.initData(U(555)) });
    ok(Object.keys(biz.prices).length === 14 && Object.keys(wh).every(id => biz.prices[id][0] === wh[id][0] && biz.prices[id][1] === wh[id][1]), 'одобренный оптовик видит все 14 оптовых цен');
    const o = g.post({ action: 'order', initData: g.initData(U(555)), items: [{ id: 'DRY-039', g: 1000, q: 5 }], total: wh['DRY-039'][0] * 5, name: 'Оксана', phone: '+380501110000', delivery: 'pickup', pay: 'cash', lang: 'ua', rid: 'w1' });
    ok(o.ok, 'оптовик заказывает 5 кг кураги по оптовой цене', o);
  }
}

console.log('\nИтог: ' + pass + ' пройдено, ' + fail + ' не пройдено');
process.exit(fail ? 1 : 0);
