/**
 * PAMIR — этап 9, выпуск А: пункт меню «PAMIR → Етап 9: застосувати дані запуску».
 *
 * Вносит в таблицу данные запуска: 13 баночек специй, 3 набора, три вида кураги, настройки, адреса фото и
 * 8 новых товаров (без цены, скрытых). Всё по названиям заголовков, только ячейки из списков ниже:
 * лист целиком не переписывается (в служебных колонках могут быть формулы).
 *
 * Повторный запуск безопасен: ничего не дублирует и ничего не меняет, если всё уже внесено.
 * Перед изменением делается копия листа «Товари» с датой (одна на день). Запись — под LockService.
 * Служебные колонки (закупка, маржа, конкурент) не читаются и не пишутся. Секретов и цен конкурента здесь нет.
 */

var STAGE9_REPORT_SHEET = 'Етап 9 — звіт';
var STAGE9_PHOTO_BASE = 'https://vorfl.github.io/pamir-shop/webapp/img/products/';
var STAGE9_HIDE_HEAD = 'Приховати з вітрини';
var STAGE9_PACKG_HEAD = 'Вага упаковки, г';
var STAGE9_ORDER_HEAD = 'Порядок';

/** 13 баночек (таблица а2.3). rel — ID можно сменить на следующий свободный, если он занят другим товаром. */
var STAGE9_JARS = [
  { id: 'SPS-001', ua: 'Спеції для плову — родинний рецепт', ru: 'Специи для плова — семейный рецепт', price: 35, father: 1 },
  { id: 'SPS-003', ua: 'Спеції для шашлику — родинний рецепт', ru: 'Специи для шашлыка — семейный рецепт', price: 35, father: 1 },
  { id: 'SPS-021', ua: 'Спеції для курки — родинний рецепт', ru: 'Специи для курицы — семейный рецепт', price: 35, father: 1, rel: 1, kw: /курк(?!ум)|куриц|курин/i },
  { id: 'SPS-022', ua: 'Спеції для риби — родинний рецепт', ru: 'Специи для рыбы — семейный рецепт', price: 35, father: 1, rel: 1, kw: /риб|рыб/i },
  { id: 'SPS-023', ua: 'Спеції для корейської моркви — родинний рецепт', ru: 'Специи для корейской моркови — семейный рецепт', price: 35, father: 1, rel: 1, kw: /морк/i },
  { id: 'SPS-014', ua: 'Хмелі-сунелі', ru: 'Хмели-сунели', price: 35 },
  { id: 'SPS-010', ua: 'Куркума мелена', ru: 'Куркума молотая', price: 35 },
  { id: 'SPS-024', ua: 'Аджика суха', ru: 'Аджика сухая', price: 35, rel: 1, kw: /аджик/i },
  { id: 'SPS-025', ua: 'Італійські трави', ru: 'Итальянские травы', price: 45, rel: 1, kw: /італ|итал/i },
  { id: 'SPS-009', ua: 'Паприка мелена', ru: 'Паприка молотая', price: 45 },
  { id: 'SPS-006', ua: 'Зіра ціла', ru: 'Зира целая', price: 55 },
  { id: 'SPS-012', ua: 'Перець чорний горошком', ru: 'Перец чёрный горошком', price: 55 },
  { id: 'SPS-007', ua: 'Барбарис сушений', ru: 'Барбарис сушёный', price: 55 }
];

/** Три набора (а2.4). Фото нет. */
var STAGE9_SETS = [
  { id: 'SET-001', ua: 'Набір для плову', ru: 'Набор для плова', price: 135,
    dUa: 'Спеції для плову, зіра ціла, барбарис — 3 баночки', dRu: 'Специи для плова, зира целая, барбарис — 3 баночки' },
  { id: 'SET-002', ua: 'Набір до м\'яса і грилю', ru: 'Набор к мясу и грилю', price: 95,
    dUa: 'Спеції для шашлику, для курки, аджика — 3 баночки', dRu: 'Специи для шашлыка, для курицы, аджика — 3 баночки' },
  { id: 'SET-003', ua: 'Базовий набір на кухню', ru: 'Базовый набор на кухню', price: 155,
    dUa: 'Перець горошком, паприка, хмелі-сунелі, куркума — 4 баночки', dRu: 'Перец горошком, паприка, хмели-сунели, куркума — 4 баночки' }
];

/** Курага из сада (а3.1). Цен в задании нет: у пустой цены — как у DRY-039. */
var STAGE9_KURAGA = [
  { id: 'DRY-039', ua: 'Курага кисло-солодка', ru: 'Курага кисло-сладкая' },
  { id: 'DRY-089', ua: 'Курага солодка з легкою кислинкою', ru: 'Курага сладкая с лёгкой кислинкой', rel: 1, kw: /кураг/i },
  { id: 'DRY-090', ua: 'Курага цукрова суха', ru: 'Курага сахарная сухая', rel: 1, kw: /кураг/i }
];

/** Новые товары (а5): файл фото NEW-*.webp не переименовывается. */
var STAGE9_NEW = [
  { file: 'NEW-arahis-syryi', ua: 'Арахіс сирий', ru: 'Арахис сырой', cat: 'Горіхи' },
  { file: 'NEW-funduk-smazhenyi-blanshovanyi', ua: 'Фундук смажений бланшований', ru: 'Фундук жареный бланшированный', cat: 'Горіхи' },
  { file: 'NEW-mygdalevi-plastivtsi', ua: 'Мигдалеві пелюстки', ru: 'Миндальные лепестки', cat: 'Горіхи', altId: 'NUT-024', altName: /пелюст|лепест/i },
  { file: 'NEW-garbuzove-golonasinne', ua: 'Гарбузове насіння голонасінне', ru: 'Тыквенные семечки голосемянные', cat: 'Горіхи' },
  { file: 'NEW-sochevytsya-chervona', ua: 'Сочевиця червона', ru: 'Чечевица красная', cat: 'Крупи', lentil: 1 },
  { file: 'NEW-tsukaty', ua: 'Цукати фруктові, кубики', ru: 'Цукаты фруктовые, кубики', cat: 'Сухофрукти' },
  { file: 'NEW-tsukaty-dribni', ua: 'Цукати фруктові, дрібні', ru: 'Цукаты фруктовые, мелкие', cat: 'Сухофрукти' },
  { file: 'NEW-yabluka-sushka', ua: 'Яблука сушені', ru: 'Яблоки сушёные', cat: 'Сухофрукти' }
];

/** Категории и префиксы ID на случай, если в таблице их ещё нет (текст категории всё равно берётся из таблицы, если там есть). */
var STAGE9_CATS = {
  'Горіхи': { ru: 'Орехи', prefix: 'NUT' }, 'Сухофрукти': { ru: 'Сухофрукты', prefix: 'DRY' },
  'Спеції': { ru: 'Специи', prefix: 'SPS' }, 'Крупи': { ru: 'Крупы', prefix: 'KRP' }
};

/** ID, которым в docs/data/photos_stage9.csv соответствует файл <ID>.webp (41 строка). */
var STAGE9_PHOTO_IDS = ['NUT-045', 'NUT-013', 'NEW-arahis-syryi', 'NUT-014', 'NUT-036', 'NEW-funduk-smazhenyi-blanshovanyi', 'NUT-040', 'NUT-047',
  'NUT-019', 'NUT-018', 'NUT-028', 'NUT-026', 'NEW-mygdalevi-plastivtsi', 'NUT-048', 'NEW-garbuzove-golonasinne', 'NUT-030', 'NEW-sochevytsya-chervona',
  'DRY-086', 'DRY-019', 'DRY-018', 'NEW-tsukaty', 'NEW-tsukaty-dribni', 'DRY-068', 'NEW-yabluka-sushka', 'DRY-017', 'DRY-039', 'DRY-089', 'DRY-090',
  'SPS-001', 'SPS-003', 'SPS-021', 'SPS-022', 'SPS-023', 'SPS-014', 'SPS-010', 'SPS-024', 'SPS-025', 'SPS-009', 'SPS-006', 'SPS-012', 'SPS-007'];

var STAGE9_NOTICE_UA = 'Ми щойно відкрили онлайн-магазин. Якщо щось не працює або є питання щодо замовлення — пишіть @gladiroon, відповімо.';
var STAGE9_NOTICE_RU = 'Мы только что открыли онлайн-магазин. Если что-то не работает или есть вопросы по заказу — пишите @gladiroon, ответим.';

/* ================================ Меню ================================ */

function stage9Menu_(menu) {
  return menu.addItem('Етап 9: застосувати дані запуску', 'stage9Apply');
}

/** Пункт меню. Возвращает итог (для тестов); окно с итогом показывает здесь же. */
function stage9Apply() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    var busy = 'Зараз таблицю змінює інша дія. Зачекайте хвилину й натисніть ще раз.';
    s9Alert_(busy);
    return { ok: false, error: 'busy', message: busy };
  }
  var res;
  try {
    res = stage9Run_();
  } catch (err) {
    console.error('stage9: ' + safeErr_(err, true));
    res = { ok: false, error: 'fail', message: 'Помилка: ' + safeErr_(err) + '. Частину змін могло бути внесено; повторний запуск безпечний.' };
  } finally {
    lock.releaseLock();
  }
  if (res.ok && typeof clearCatalogCache_ === 'function' && res.changedCells > 0) {
    try { clearCatalogCache_(); } catch (e) { /* кэш живёт 5 минут и без этого */ }
  }
  if (typeof purgeWorkerIfPending_ === 'function') purgeWorkerIfPending_(); // Worker: каталог изменился (вне блокировки)
  s9Alert_(res.message);
  return res;
}

function s9Alert_(text) {
  try { SpreadsheetApp.getUi().alert(text); } catch (err) { console.log(text); } // запуск из редактора: окна нет
}

/* ============================== Мелочи ============================== */

function s9Norm_(v) {
  return String(v === null || v === undefined ? '' : v).replace(/\s+/g, ' ').trim().toLowerCase();
}

function s9Same_(cur, want) {
  if (typeof want === 'number') return String(cur === null || cur === undefined ? '' : cur).trim() !== '' && toNum_(cur) === want;
  return String(cur === null || cur === undefined ? '' : cur).trim() === String(want).trim();
}

function s9IsDrive_(v) {
  return /drive\.google\.com|docs\.google\.com|googleusercontent\.com/i.test(v) || /^[A-Za-z0-9_-]{20,200}$/.test(v);
}

function s9Room_(sheet, rows, cols) {
  try {
    if (typeof sheet.getMaxRows === 'function' && sheet.getMaxRows() < rows) sheet.insertRowsAfter(sheet.getMaxRows(), rows - sheet.getMaxRows());
    if (typeof sheet.getMaxColumns === 'function' && sheet.getMaxColumns() < cols) sheet.insertColumnsAfter(sheet.getMaxColumns(), cols - sheet.getMaxColumns());
  } catch (err) {
    console.warn('stage9 room: ' + err);
  }
}

/** Записывает отдельные ячейки: подряд идущие строки одной колонки — одним вызовом. cells: [[r, c, value]], r и c с нуля. */
function s9WriteCells_(sheet, cells) {
  var byCol = {};
  cells.forEach(function (x) { (byCol[x[1]] = byCol[x[1]] || {})[x[0]] = x[2]; });
  Object.keys(byCol).forEach(function (c) {
    var rows = Object.keys(byCol[c]).map(Number).sort(function (a, b) { return a - b; });
    var i = 0;
    while (i < rows.length) {
      var j = i;
      while (j + 1 < rows.length && rows[j + 1] === rows[j] + 1) j++;
      var block = [];
      for (var k = i; k <= j; k++) block.push([byCol[c][rows[k]]]);
      sheet.getRange(rows[i] + 1, Number(c) + 1, block.length, 1).setValues(block);
      i = j + 1;
    }
  });
}

/* ============================== Основная работа ============================== */

function stage9Run_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_PRODUCTS);
  if (!sheet || sheet.getLastRow() < 1) return { ok: false, error: 'no_sheet', message: 'Не знайдено аркуш «' + SHEET_PRODUCTS + '». Нічого не змінено.' };

  var vals = sheet.getDataRange().getValues();
  var origRows = vals.length;
  var spec = {};
  Object.keys(PRODUCT_COLS).forEach(function (k) { spec[k] = PRODUCT_COLS[k]; });
  spec.packG = ['вага упаковки, г'];
  spec.order = ['порядок'];
  var col = mapHeaders_(vals[0], spec);
  // «Порядок» и «Вага упаковки, г» — только точное совпадение заголовка (как в Code.gs), а не «по началу»
  var exactHead = vals[0].map(function (h) { return String(h || '').replace(/\s+/g, ' ').trim().toLowerCase(); });
  col.packG = exactHead.indexOf('вага упаковки, г');
  col.order = exactHead.indexOf('порядок');
  var must = [['id', 'ID'], ['nameUa', 'Назва (UA)'], ['type', 'Тип'], ['pUnit', 'Ціна за упаковку'], ['stock', 'Наявність'], ['photo', 'Фото'], ['catUa', 'Категорія (UA)']];
  for (var m = 0; m < must.length; m++) {
    if (col[must[m][0]] < 0) return { ok: false, error: 'no_col', message: 'В аркуші «' + SHEET_PRODUCTS + '» немає колонки «' + must[m][1] + '». Нічого не змінено.' };
  }

  var touched = {};            // «r:c» → true: ячейки, которые меняем
  var cells = [];              // [[r, c, value]]
  var rep = { changed: [], created: [], skipped: [], waiting: [], renamed: [], cleared: [], drive: [], replaced: [], notes: [], warn: [] };
  var rowChanges = {};         // r → [что изменено]
  var newCols = [];

  function set(r, c, v) {
    if (c < 0) return false;
    while (vals[r].length <= c) vals[r].push('');
    if (s9Same_(vals[r][c], v)) return false;
    vals[r][c] = v;
    var key = r + ':' + c;
    if (!touched[key]) { touched[key] = true; }
    return true;
  }
  function field(r, key, v, label) {
    if (col[key] === undefined || col[key] < 0) return;
    if (set(r, col[key], v) && label !== false) (rowChanges[r] = rowChanges[r] || []).push(label || key);
  }
  function text(r, key) { return col[key] >= 0 && col[key] !== undefined ? String(vals[r][col[key]] === null || vals[r][col[key]] === undefined ? '' : vals[r][col[key]]).trim() : ''; }

  // 2. Необязательные колонки в конец.
  [['packG', STAGE9_PACKG_HEAD], ['order', STAGE9_ORDER_HEAD], ['hidden', STAGE9_HIDE_HEAD]].forEach(function (c) {
    if (col[c[0]] >= 0) return;
    col[c[0]] = vals[0].length;
    vals.forEach(function (row, i) { row.push(i === 0 ? c[1] : ''); });
    touched['0:' + col[c[0]]] = true;
    newCols.push(c[1]);
  });

  // Архив: ID и названия (только чтение).
  var arch = { byId: {}, byName: {} };
  var archSheet = ss.getSheetByName(SHEET_ARCHIVE);
  var archMax = {};
  if (archSheet && archSheet.getLastRow() > 1) {
    var av = archSheet.getDataRange().getValues();
    var ac = mapHeaders_(av[0], PRODUCT_COLS);
    for (var a = 1; a < av.length; a++) {
      var aid = cell_(av[a], ac.id), anm = cell_(av[a], ac.nameUa);
      aid = aid.trim().toUpperCase();
      if (aid) arch.byId[aid] = anm;
      if (anm && !arch.byName[s9Norm_(anm)]) arch.byName[s9Norm_(anm)] = aid;
    }
  }

  var rowById = {}, rowByName = {};
  function idOf(r) { return text(r, 'id').toUpperCase(); }
  function index(r) {
    var id = idOf(r), nm = s9Norm_(text(r, 'nameUa'));
    if (id && rowById[id] === undefined) rowById[id] = r;
    if (nm && rowByName[nm] === undefined) rowByName[nm] = r;
  }
  for (var r0 = 1; r0 < origRows; r0++) index(r0);

  var allocated = {};
  var planned = {};
  STAGE9_JARS.concat(STAGE9_SETS, STAGE9_KURAGA).forEach(function (it) { planned[it.id] = true; });
  function allocId(prefix) {
    if (allocated[prefix] === undefined) {
      var max = 0;
      var scan = function (id) { id = String(id).toUpperCase(); var mm = String(id).match(/^([A-Z0-9]+)-(\d+)$/); if (mm && mm[1] === prefix) max = Math.max(max, parseInt(mm[2], 10)); };
      Object.keys(rowById).forEach(scan);
      Object.keys(arch.byId).forEach(scan);
      try { if (typeof reservedIdMax_ === 'function') max = Math.max(max, reservedIdMax_(prefix)); } catch (e) { /* без резерва — только по листам */ }
      allocated[prefix] = max;
    }
    var id;
    do { // номера, которые этот запуск сам собирается занять (SPS-022…025, DRY-089/090), не выдаём
      var n = String(++allocated[prefix]);
      while (n.length < 3) n = '0' + n;
      id = prefix + '-' + n;
    } while (planned[id] || rowById[id] !== undefined || arch.byId[id] !== undefined);
    return id;
  }

  function newRow() {
    var row = [];
    for (var i = 0; i < vals[0].length; i++) row.push('');
    vals.push(row);
    return vals.length - 1;
  }

  function resolve(item) {
    var nu = s9Norm_(item.ua);
    var rid = rowById[item.id];
    if (rid !== undefined && s9Norm_(text(rid, 'nameUa')) === nu) return { r: rid };
    if (rid !== undefined && !item.rel) return { r: rid };
    // Поиск по названию — только для ID, которые могли быть заняты другим товаром (SPS-021…025, DRY-089/090):
    // так находится строка, созданная прошлым запуском под новым ID. Остальные ищутся строго по ID.
    if (item.rel && rowByName[nu] !== undefined) return { r: rowByName[nu] };
    if (rid !== undefined) {
      // тот же товар под чуть другим названием (ключевое слово в UA или RU) — своя строка, переименуем
      if (item.kw && (item.kw.test(text(rid, 'nameUa')) || item.kw.test(text(rid, 'nameRu')))) return { r: rid, renamed: true };
      return { conflict: true };
    }
    if (item.rel && arch.byName[nu]) return { archived: true };
    if (arch.byId[item.id] !== undefined) return item.rel && s9Norm_(arch.byId[item.id]) !== nu ? { conflict: true } : { archived: true };
    return { create: true };
  }

  function label(r) { return text(r, 'id') + ' «' + text(r, 'nameUa') + '»'; }

  var resolved = {};   // исходный ID → строка (или null, если пропущено)
  var keep = {};       // строки, которые не скрываем как «лишние специи»

  /** Находит или создаёт строку; возвращает её номер или -1. cat — {ua, ru} для новой строки. */
  function place(item, cat, kind) {
    var res = resolve(item);
    if (res.archived) {
      rep.skipped.push(item.id + ' «' + item.ua + '»: є в архіві, відновіть у панелі — рядок не створено');
      resolved[item.id] = null;
      return -1;
    }
    var r, isNew = false;
    if (res.r !== undefined) {
      r = res.r;
      if (res.renamed) rep.renamed.push(text(r, 'id') + ': було: «' + text(r, 'nameUa') + '» → стало: «' + item.ua + '»');
    } else {
      isNew = true;
      var id = res.conflict ? allocId(item.id.split('-')[0]) : item.id;
      r = newRow();
      field(r, 'id', id, false);
      field(r, 'catUa', cat.ua, false);
      field(r, 'catRu', cat.ru, false);
      field(r, 'stock', 'є', false);
      rowById[id] = r;
      rep.created.push(id + ' «' + item.ua + '»' + (res.conflict ? ' — ID ' + item.id + ' зайнятий, створено як ' + id : ''));
      if (res.conflict) rep.notes.push('ID зайнятий, створено як ' + id + ' (замість ' + item.id + '); файл фото лишається ' + item.id + '.webp');
    }
    resolved[item.id] = r;
    return r;
  }

  var QTY_CLEAR = [['oldPrice', 'Стара ціна'], ['saleEnd', 'Акція до'], ['whPrice', 'Опт: ціна'], ['whMin', 'Опт: мін. обсяг'], ['whMinKg', 'Опт: мін, кг'], ['qty', 'Залишок']];
  /** Строка была не «упаковка»: старые значения «за кг» (стара ціна, опт, залишок у кг) дали бы ложную скидку. Пустой «Залишок» = облік не ведеться (leftQty_ → null). */
  function clearOnPack(r) {
    if (r >= origRows || s9Norm_(text(r, 'type')) === 'упаковка') return;
    QTY_CLEAR.forEach(function (c) {
      if (col[c[0]] === undefined || col[c[0]] < 0) return;
      var was = text(r, c[0]);
      if (was && set(r, col[c[0]], '')) rep.cleared.push(idOf(r) + ': ' + c[1] + ' (було ' + was + ')');
    });
  }
  var spicesCat = { ua: 'Спеції', ru: 'Специи' };

  // 3. Баночки и 5. наборы.
  var jarRows = {};
  STAGE9_JARS.forEach(function (j) {
    var r = place(j, spicesCat, 'jar');
    if (r < 0) return;
    jarRows[j.id] = r;
    keep[r] = true;
    field(r, 'nameUa', j.ua, 'назва UA');
    field(r, 'nameRu', j.ru, 'назва RU');
    clearOnPack(r);
    field(r, 'type', 'упаковка', 'тип');
    field(r, 'pUnit', j.price, 'ціна');
    field(r, 'packs', '', 'фасування очищено');
    field(r, 'packPrices', '', 'ціни фасувань очищено');
    if (isYes_(text(r, 'hidden'))) field(r, 'hidden', '', 'знято приховування');
    if (!isInStock_(text(r, 'stock'))) rep.warn.push(label(r) + ': наявність не «є» — на вітрині буде «немає»');
  });
  var setRows = {};
  STAGE9_SETS.forEach(function (s) {
    var r = place(s, spicesCat, 'set');
    if (r < 0) return;
    setRows[s.id] = r;
    keep[r] = true;
    field(r, 'nameUa', s.ua, 'назва UA');
    field(r, 'nameRu', s.ru, 'назва RU');
    clearOnPack(r);
    field(r, 'type', 'упаковка', 'тип');
    field(r, 'pUnit', s.price, 'ціна');
    field(r, 'descUa', s.dUa, 'опис UA');
    field(r, 'descRu', s.dRu, 'опис RU');
    field(r, 'packs', '', 'фасування очищено');
    field(r, 'packPrices', '', 'ціни фасувань очищено');
    if (isYes_(text(r, 'hidden'))) field(r, 'hidden', '', 'знято приховування');
    if (!isInStock_(text(r, 'stock'))) rep.warn.push(label(r) + ': наявність не «є» — на вітрині буде «немає»');
  });

  // 4. Остальные специи — скрыть.
  for (var h = 1; h < origRows; h++) {
    if (keep[h]) continue;
    var hid = idOf(h);
    if (!hid || !text(h, 'nameUa')) continue;
    var cu = s9Norm_(text(h, 'catUa')), cr = s9Norm_(text(h, 'catRu'));
    var isSpice = cu === 'спеції' || cr === 'специи' || (!cu && !cr && /^SPS-/.test(hid));
    if (!isSpice || isYes_(text(h, 'hidden'))) continue;
    if (set(h, col.hidden, 'так')) rep.changed.push(hid + ' «' + text(h, 'nameUa') + '»: приховано з вітрини (не видалено)');
  }

  // 6. Порядок в «Спеції».
  var orderList = [];
  STAGE9_SETS.forEach(function (s, i) { if (setRows[s.id] !== undefined) orderList.push([setRows[s.id], 1 + i]); });
  var fi = 0, oi = 0;
  var fatherIds = [];
  STAGE9_JARS.forEach(function (j) {
    var r = jarRows[j.id];
    if (r === undefined) return;
    if (j.father) { orderList.push([r, 11 + fi++]); fatherIds.push(idOf(r)); } else { orderList.push([r, 21 + oi++]); }
  });
  // Остальные баночки должны идти после смесей отца: нумерация 21+ в порядке таблицы задания.
  orderList.forEach(function (o) { field(o[0], 'order', o[1], 'порядок'); });

  // 7. Курага.
  var kRows = {};
  var tmpl = -1;
  STAGE9_KURAGA.forEach(function (k, i) {
    var r = place(k, { ua: 'Сухофрукти', ru: 'Сухофрукты' }, 'kuraga');
    if (r < 0) return;
    kRows[k.id] = r;
    keep[r] = true;
    if (i === 0) tmpl = r;
  });
  var tmplHasPrice = tmpl >= 0 && (toNum_(text(tmpl, 'pKg')) > 0 || toNum_(text(tmpl, 'pUnit')) > 0);
  STAGE9_KURAGA.forEach(function (k) {
    var r = kRows[k.id];
    if (r === undefined) return;
    field(r, 'nameUa', k.ua, 'назва UA');
    field(r, 'nameRu', k.ru, 'назва RU');
    if (r === tmpl) return;
    var empty = !(toNum_(text(r, 'pKg')) > 0) && !(toNum_(text(r, 'pUnit')) > 0);
    var brandNew = r >= origRows;
    if (brandNew && tmpl >= 0) { field(r, 'catUa', text(tmpl, 'catUa'), false); field(r, 'catRu', text(tmpl, 'catRu'), false); }
    if (empty) {
      if (tmplHasPrice) {
        ['type', 'packs', 'pKg', 'pUnit', 'p100', 'packPrices'].forEach(function (key) {
          if (col[key] < 0) return;
          var src = vals[tmpl][col[key]];
          if ((key === 'type' || key === 'packs') && text(r, key)) return;
          if (src !== '' && src !== null && src !== undefined) field(r, key, src, 'ціна як у DRY-039');
        });
        rep.notes.push(label(r) + ': ціни в завданні не було — взято як у DRY-039 (перевірте і поправте)');
      } else {
        rep.waiting.push(label(r) + ': чекає ціну (у DRY-039 ціни немає)');
        if (brandNew) field(r, 'hidden', 'так', false);
      }
    }
  });

  // 8 (часть настроек считается ниже). 10. Новые товары.
  function catInfo(name, lentil) {
    var base = STAGE9_CATS[name] || { ru: name, prefix: 'PRD' };
    var best = null;
    for (var i = 1; i < origRows; i++) {
      var cu = s9Norm_(text(i, 'catUa'));
      if (!cu) continue;
      if (lentil ? /круп|бобов/.test(cu) : cu === s9Norm_(name)) { best = i; break; }
    }
    if (best === null) return { ua: name, ru: base.ru, prefix: base.prefix };
    var pre = base.prefix;
    for (var j = 1; j < origRows; j++) {
      if (s9Norm_(text(j, 'catUa')) !== s9Norm_(text(best, 'catUa'))) continue;
      var mm = text(j, 'id').match(/^([A-Z0-9]+)-\d+$/);
      if (mm) { pre = mm[1]; break; }
    }
    return { ua: text(best, 'catUa'), ru: text(best, 'catRu') || base.ru, prefix: pre };
  }

  var photoTargets = {};  // ключ файла → строка
  STAGE9_NEW.forEach(function (n) {
    var nu = s9Norm_(n.ua);
    var r = rowByName[nu];
    if (r === undefined && n.altId && rowById[n.altId] !== undefined && n.altName.test(text(rowById[n.altId], 'nameUa'))) r = rowById[n.altId];
    if (r !== undefined) { photoTargets[n.file] = r; return; }
    var inArch = arch.byName[nu] !== undefined || (n.altId && arch.byId[n.altId] !== undefined && n.altName.test(arch.byId[n.altId]));
    if (inArch) {
      rep.skipped.push(n.file + ' «' + n.ua + '»: є в архіві, відновіть у панелі — рядок не створено');
      return;
    }
    var cat = catInfo(n.cat, n.lentil);
    var id = allocId(cat.prefix);
    r = newRow();
    field(r, 'id', id, false);
    field(r, 'catUa', cat.ua, false);
    field(r, 'catRu', cat.ru, false);
    field(r, 'nameUa', n.ua, false);
    field(r, 'nameRu', n.ru, false);
    field(r, 'type', 'вагова', false);
    field(r, 'hidden', 'так', false);
    rowById[id] = r;
    rowByName[nu] = r;
    photoTargets[n.file] = r;
    rep.created.push(id + ' «' + n.ua + '» (прихований, ціна порожня)');
    rep.waiting.push(id + ' «' + n.ua + '»: чекає ціну');
  });

  // 9. Фото.
  function setPhoto(r, url) {
    var cur = text(r, 'photo');
    if (cur === url) return;
    if (!cur) { field(r, 'photo', url, 'фото'); return; }
    if (s9IsDrive_(cur)) { rep.drive.push(label(r) + ' — фото з Google Drive не змінено'); return; }
    field(r, 'photo', url, false);
    rep.replaced.push(label(r) + ': фото замінено (було «' + cur + '»)');
  }
  STAGE9_PHOTO_IDS.forEach(function (key) {
    var url = STAGE9_PHOTO_BASE + key + '.webp';
    var r;
    if (/^NEW-/.test(key)) r = photoTargets[key];
    else if (resolved[key] !== undefined) r = resolved[key];
    else r = rowById[key];
    if (r === undefined || r === null) {
      if (r === undefined) rep.skipped.push('фото ' + key + ': рядка немає в «Товари»');
      return;
    }
    setPhoto(r, url);
  });

  // Какие ячейки реально меняются (после сравнения).
  Object.keys(touched).forEach(function (key) {
    var p = key.split(':');
    cells.push([Number(p[0]), Number(p[1]), vals[Number(p[0])][Number(p[1])]]);
  });
  // Новые строки целиком: ячейки без значения не пишем, но id у них всегда есть.
  Object.keys(rowChanges).forEach(function (r) {
    var rr = Number(r);
    if (rr >= origRows) return; // созданные строки уже в rep.created
    var items = rowChanges[r].filter(function (x, i, arr) { return arr.indexOf(x) === i; });
    rep.changed.push(label(rr) + ': ' + items.join(', '));
  });

  // 8. Настройки.
  var noticeDone = String(scriptProps_().getProperty(STAGE9_NOTICE_FLAG) || '') === '1';
  var st = s9PlanSettings_(ss, fatherIds, STAGE9_KURAGA.map(function (k) { return kRows[k.id] === undefined ? '' : text(kRows[k.id], 'id').toUpperCase(); }).filter(Boolean), noticeDone);
  st.setFlag = !noticeDone;

  var changedCells = cells.length + st.updates.length + st.appends.length;
  var res0 = { ok: true, changedCells: changedCells, rep: rep, newCols: newCols, copy: '' };
  if (changedCells === 0) {
    if (st.setFlag) scriptProps_().setProperty(STAGE9_NOTICE_FLAG, '1');
    res0.message = s9Report_(ss, rep, res0, 'Змін немає: усе вже внесено раніше.');
    return res0;
  }

  // 1. Копия листа «Товари» (одна на день) — до первой записи.
  var copyName = 'Товари — копія перед етапом 9 ' + Utilities.formatDate(new Date(), 'Europe/Kiev', 'dd.MM.yyyy');
  if (!ss.getSheetByName(copyName)) {
    if (typeof sheet.copyTo !== 'function') return { ok: false, error: 'no_copy', message: 'Не вдалося зробити копію аркуша «' + SHEET_PRODUCTS + '». Нічого не змінено.' };
    var cp = sheet.copyTo(ss);
    cp.setName(copyName);
    res0.copy = copyName;
  } else {
    res0.copy = copyName + ' (вже була сьогодні)';
  }

  // Запись. Новые строки и колонки: сначала место в сетке.
  s9Room_(sheet, vals.length, vals[0].length);
  s9WriteCells_(sheet, cells);
  s9WriteSettings_(ss, st);
  if (st.setFlag) scriptProps_().setProperty(STAGE9_NOTICE_FLAG, '1');
  try { SpreadsheetApp.flush(); } catch (e) { /* не критично */ }

  res0.message = s9Report_(ss, rep, res0, '');
  return res0;
}

/* ============================== Настройки ============================== */

var STAGE9_NOTICE_FLAG = 'STAGE9_NOTICE_DONE'; // несекретная отметка: тексты полоски уже записывались

function s9PlanSettings_(ss, fatherIds, featureIds, noticeDone) {
  var sheet = ss.getSheetByName(SHEET_SETTINGS);
  var vals = sheet && sheet.getLastRow() > 0 ? sheet.getDataRange().getValues() : [];
  var rowOf = {};
  for (var i = 1; i < vals.length; i++) {
    var k = String(vals[i][0] === null || vals[i][0] === undefined ? '' : vals[i][0]).trim();
    if (k && rowOf[k] === undefined) rowOf[k] = i;
  }
  var want = [
    ['father_ids', fatherIds.join(', '), 'Добірка «Спеції від батька»: ID через кому', true],
    ['feature_id', featureIds.join(','), 'Блок «Наша курага»: ID через кому', true],
    ['gift_from', 500, 'Подарунок від суми замовлення, ₴', true],
    ['gift_text_ua', 'Баночка спецій батька в подарунок', 'Подарунок (UA)', true],
    ['gift_text_ru', 'Баночка специй отца в подарок', 'Подарок (RU)', true],
    ['notice_text_ua', STAGE9_NOTICE_UA, 'Смужка про запуск (UA). Порожньо — смужки немає', false],
    ['notice_text_ru', STAGE9_NOTICE_RU, 'Полоска о запуске (RU). Пусто — полоски нет', false]
  ];
  var plan = { sheet: sheet, updates: [], appends: [], head: !sheet || vals.length === 0 };
  want.forEach(function (w) {
    var at = rowOf[w[0]];
    if (!w[3] && noticeDone) return; // notice_text_*: после первой записи не трогаем никогда
    if (at === undefined) { plan.appends.push([w[0], w[1], w[2]]); return; }
    if (!w[3] && String(vals[at][1] === null || vals[at][1] === undefined ? '' : vals[at][1]).trim() !== '') return; // своё значение владельца
    if (!s9Same_(vals[at][1], w[1])) plan.updates.push([at, w[1]]);
  });
  return plan;
}

function s9WriteSettings_(ss, plan) {
  if (!plan.updates.length && !plan.appends.length) return;
  var sheet = plan.sheet;
  if (!sheet) sheet = ss.insertSheet(SHEET_SETTINGS);
  if (plan.head) {
    sheet.getRange(1, 1, 1, 3).setValues([['Ключ', 'Значення', 'Опис']]).setFontWeight('bold');
    if (typeof sheet.setFrozenRows === 'function') sheet.setFrozenRows(1);
  }
  plan.updates.forEach(function (u) { sheet.getRange(u[0] + 1, 2).setValue(u[1]); });
  if (plan.appends.length) {
    var at = sheet.getLastRow() + 1;
    s9Room_(sheet, at + plan.appends.length - 1, 3);
    sheet.getRange(at, 1, plan.appends.length, 3).setValues(plan.appends);
  }
}

/* ============================== Итог ============================== */

function s9Report_(ss, rep, res, headline) {
  var lines = [];
  function block(title, list) { if (list.length) { lines.push(title + ' (' + list.length + '):'); list.forEach(function (t) { lines.push('  • ' + t); }); } }
  if (res.newCols.length) lines.push('Нові колонки: ' + res.newCols.join(', '));
  block('Змінено', rep.changed);
  block('Перейменовано (той самий товар)', rep.renamed);
  block('Очищено (було …)', rep.cleared);
  block('Створено', rep.created);
  block('Пропущено', rep.skipped);
  block('Чекає ціну (приховано, на вітрині немає)', rep.waiting);
  block('Фото з Google Drive не чіпали', rep.drive);
  block('Фото замінено', rep.replaced);
  block('Увага', rep.warn);
  block('Примітки', rep.notes);
  if (res.copy) lines.push('Копія аркуша: ' + res.copy);
  var shortText = headline || ('Готово. Змінено клітинок: ' + res.changedCells + '. Створено рядків: ' + rep.created.length + '. Пропущено: ' + rep.skipped.length + '. Чекає ціну: ' + rep.waiting.length + '. Фото з Drive не чіпали: ' + rep.drive.length + '.');
  try {
    var sheet = ss.getSheetByName(STAGE9_REPORT_SHEET) || ss.insertSheet(STAGE9_REPORT_SHEET);
    sheet.clearContents();
    var out = [['Етап 9: звіт ' + Utilities.formatDate(new Date(), 'Europe/Kiev', 'dd.MM.yyyy HH:mm')], [shortText]].concat(lines.map(function (l) { return [l]; }));
    s9Room_(sheet, out.length, 1);
    sheet.getRange(1, 1, out.length, 1).setValues(out);
  } catch (err) {
    console.warn('stage9 report: ' + err);
  }
  return shortText + (lines.length ? '\n\n' + lines.slice(0, 40).join('\n') + (lines.length > 40 ? '\n… повний список — на аркуші «' + STAGE9_REPORT_SHEET + '».' : '') : '');
}
