/**
 * PAMIR — «Підготовка до запуску»: меню PAMIR → «Підготовка до запуску» в таблице.
 *
 *   1. Перевірити (нічого не змінює) — сухой прогон: лист «Запуск — звіт» со списком будущих изменений и сводкой.
 *   2. Зробити резервну копію      — копия всей таблицы в Google Диске. Без копии за сегодня шаг 3 не запускается.
 *   3. Застосувати                 — вносит изменения. Идемпотентно: повторный запуск ничего не ломает и не дублирует.
 *
 * Данные — в LaunchData.gs (и оптовые цены в LaunchWholesale.gs). Здесь только логика.
 * Всё делается под LockService, порциями, с запасом к лимиту 6 минут: если времени не хватило, шаг запоминается
 * в Script Properties, и следующее нажатие «Застосувати» продолжает с того же места.
 * Сухой прогон и применение считают изменения одним и тем же кодом (launchPlan_), поэтому отчёт не расходится с делом.
 * Служебные колонки (закупка, конкурент) читаются только здесь, для предупреждений в отчёте, и наружу не уходят.
 */

var SHEET_LAUNCH_REPORT = 'Запуск — звіт';
var SHEET_TEST_ORDERS = 'Тестові замовлення (архів)';
var PROP_LAUNCH_BACKUP = 'LAUNCH_BACKUP';        // {"day":"2026-11-11","name":"…"} — когда и с каким именем сделана копия
var PROP_LAUNCH_STATE = 'LAUNCH_STATE';          // {"phase":3} — на каком шаге остановилось применение
var PROP_LAUNCH_DONE = 'LAUNCH_DONE';            // дата, когда применение дошло до конца
var PROP_LAUNCH_TESTDATA = 'LAUNCH_TESTDATA_DONE'; // тестовые заказы, «Кошики» и «Події» чистятся один раз
var LAUNCH_RUN_MS = 4 * 60 * 1000;               // одно нажатие работает не дольше (лимит Apps Script — 6 минут)
var LAUNCH_ARCHIVE_CHUNK = 60;                   // товаров в архив за одну порцию
var LAUNCH_MIN_KNOWN = 20;                       // защита от запуска не в той таблице: столько из 50 ID должно уже быть в «Товари»
var LAUNCH_PHASES = ['cols', 'fix', 'archive', 'add', 'products', 'recipes', 'settings', 'points', 'testdata', 'finish'];
var LAUNCH_PHASE_UA = { cols: 'колонки й листи', fix: 'тестові рядки', archive: 'архів', add: 'нові рядки спецій', products: '50 позицій',
  recipes: 'рецепти', settings: 'налаштування', points: 'точки', testdata: 'тестові дані', finish: 'статистика' };
/** Необязательные колонки «Товари», которые создаются, если их нет. Заголовки — те, что ищет Code.gs (PRODUCT_COLS). */
var LAUNCH_NEW_COLS = [['whPrice', 'Опт: ціна за 1 кг / уп., ₴'], ['whMinKg', 'Опт: мін, кг'], ['howUa', 'Як їсти (UA)'], ['howRu', 'Как есть (RU)'], ['tags', 'Теги']];
var LAUNCH_FIELD_UA = { nameUa: 'Назва (UA)', nameRu: 'Название (RU)', type: 'Тип', packs: 'Фасування', pKg: 'Ціна за 1 кг', pUnit: 'Ціна за упаковку',
  p100: 'Ціна за 100 г', packKg: 'Вага упаковки', descUa: 'Опис (UA)', descRu: 'Описание (RU)', whPrice: 'Опт: ціна', whMinKg: 'Опт: мін, кг', whMin: 'Опт: мін. обсяг',
  howUa: 'Як їсти (UA)', howRu: 'Как есть (RU)', tags: 'Теги', packPrices: 'Ціни фасувань', badge: 'Бейдж', oldPrice: 'Стара ціна', saleEnd: 'Акція до' };

/* ================================ Меню ================================ */

function launchMenu_(ui) {
  return ui.createMenu('Підготовка до запуску')
    .addItem('1. Перевірити (нічого не змінює)', 'menuLaunchCheck')
    .addItem('2. Зробити резервну копію', 'menuLaunchBackup')
    .addItem('3. Застосувати', 'menuLaunchApply');
}

function menuLaunchCheck() {
  var plan = launchCheck_();
  SpreadsheetApp.getUi().alert('Перевірку завершено — у таблиці нічого не змінено.\n\n' + launchSummaryText_(plan) +
    '\n\nПовний список — на аркуші «' + SHEET_LAUNCH_REPORT + '».');
}

function menuLaunchBackup() {
  var res = launchBackup_();
  SpreadsheetApp.getUi().alert((res.already ? 'Резервну копію сьогодні вже зроблено:\n' : 'Резервну копію зроблено:\n') + res.name +
    '\n\nВона лежить у вашому Google Диску («Мій диск»). Тепер можна натискати «3. Застосувати».');
}

function menuLaunchApply() {
  var ui = SpreadsheetApp.getUi();
  if (!launchBackupToday_()) {
    ui.alert('Спочатку зробіть резервну копію: меню PAMIR → «Підготовка до запуску» → «2. Зробити резервну копію».\n\nБез сьогоднішньої копії зміни не вносяться.');
    return;
  }
  var plan = launchPlan_();
  if (plan.fatal) { ui.alert('Нічого не змінено.\n\n' + plan.fatal); return; }
  var state = launchState_();
  var props = scriptProps_();
  var head = state.phase > 0 ? 'Продовжуємо з кроку «' + LAUNCH_PHASE_UA[LAUNCH_PHASES[state.phase]] + '».\n\n' : '';
  var done = String(props.getProperty(PROP_LAUNCH_DONE) || '');
  if (done && !(state.phase > 0)) {
    head = 'УВАГА. Підготовку вже застосовано ' + done + '. Повторний запуск знову відправить в архів усі товари, яких немає у списку 50, ' +
      'і поверне ціни та тексти 50 позицій до значень із підготовки.\n\n';
  }
  var answer = ui.alert('Застосувати підготовку до запуску?', head + launchSummaryText_(plan) + '\n\nРезервна копія за сьогодні є. Продовжити?', ui.ButtonSet.YES_NO);
  if (answer !== ui.Button.YES) return;
  var res = launchApply_();
  if (res.error === 'busy') { ui.alert('Зараз таблицю змінює інша дія. Зачекайте хвилину й натисніть «3. Застосувати» ще раз.'); return; }
  if (!res.ok) { ui.alert('Не вдалося: ' + (res.message || res.error)); return; }
  if (!res.done) {
    ui.alert('Продовжіть: натисніть ще раз.\n\nЧастину змін уже внесено (зупинилися на кроці «' + LAUNCH_PHASE_UA[res.phase] + '»). ' +
      'Меню PAMIR → «Підготовка до запуску» → «3. Застосувати».');
    return;
  }
  ui.alert('Готово. Зміни внесено.\n\nДетальний звіт — на аркуші «' + SHEET_LAUNCH_REPORT + '». Відкрийте магазин у Telegram і перевірте вітрину.');
}

/* ============================== Общие мелочи ============================== */

function launchDay_(fmt) {
  return Utilities.formatDate(new Date(), 'Europe/Kiev', fmt || 'yyyy-MM-dd');
}

function launchJson_(text) {
  try { return JSON.parse(text || '{}') || {}; } catch (err) { return {}; }
}

function launchState_() {
  var s = launchJson_(propRead_(scriptProps_(), PROP_LAUNCH_STATE, true));
  return { phase: s.phase > 0 && s.phase < LAUNCH_PHASES.length ? Math.floor(s.phase) : 0 };
}

function launchBackupToday_() {
  return launchJson_(propRead_(scriptProps_(), PROP_LAUNCH_BACKUP, true)).day === launchDay_();
}

function launchWholesale_() {
  return typeof LAUNCH_WHOLESALE !== 'undefined' && LAUNCH_WHOLESALE ? LAUNCH_WHOLESALE : null;
}

/** Значение ячейки для отчёта и сравнения: дата → «15.11.2026», остальное — текст без пробелов по краям. */
function launchText_(v) {
  if (Object.prototype.toString.call(v) === '[object Date]') return isNaN(v.getTime()) ? '' : Utilities.formatDate(v, 'Europe/Kiev', 'dd.MM.yyyy');
  return String(v === null || v === undefined ? '' : v).trim();
}

/** Совпадает ли ячейка с тем, что должно быть: числа сравниваются как числа, тексты — как тексты. */
function launchSame_(cur, want) {
  if (typeof want === 'number') return launchText_(cur) !== '' && toNum_(cur) === want;
  return launchText_(cur) === String(want).trim();
}

/** Перед записью в конец листа: если в сетке не хватает строк или колонок, они добавляются. */
function launchRoom_(sheet, lastRowNeeded, lastColNeeded) {
  try {
    if (typeof sheet.getMaxRows === 'function' && sheet.getMaxRows() < lastRowNeeded) sheet.insertRowsAfter(sheet.getMaxRows(), lastRowNeeded - sheet.getMaxRows());
    if (lastColNeeded && typeof sheet.getMaxColumns === 'function' && sheet.getMaxColumns() < lastColNeeded) sheet.insertColumnsAfter(sheet.getMaxColumns(), lastColNeeded - sheet.getMaxColumns());
  } catch (err) {
    console.warn('launch room: ' + err);
  }
}

/** Записи в «Журнал» одной пачкой. Вызывается уже под блокировкой, поэтому свою блокировку не берёт. */
function launchLog_(rows) {
  if (!rows.length) return;
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_LOG);
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_LOG);
      sheet.getRange(1, 1, 1, LOG_HEAD.length).setValues([LOG_HEAD]).setFontWeight('bold');
      sheet.setFrozenRows(1);
    }
    var now = new Date();
    var out = rows.map(function (r) {
      return [now, 'Підготовка до запуску', ''].concat(r.map(function (v) { return safeCell_(clean_(v, 300)); }));
    });
    launchRoom_(sheet, sheet.getLastRow() + out.length, LOG_HEAD.length);
    sheet.getRange(sheet.getLastRow() + 1, 1, out.length, LOG_HEAD.length).setValues(out);
  } catch (err) {
    console.error('launch log: ' + (err && err.stack || err));
  }
}

/** Лист «Товари»: значения, колонки по заголовкам и три служебные колонки, нужные только для предупреждений. */
function launchProducts_(ss) {
  var sheet = ss.getSheetByName(SHEET_PRODUCTS);
  if (!sheet) return null;
  var values = sheet.getDataRange().getValues();
  var col = mapHeaders_(values[0], PRODUCT_COLS);
  var keys = headerKeys_(values[0]);
  function find(part) { for (var i = 0; i < keys.length; i++) if (keys[i].indexOf(part) >= 0) return i; return -1; }
  col.comp = find('конкурент');
  col.buy = find('закуп');
  col.packKg = find('вага упаковки');
  return { sheet: sheet, values: values, col: col };
}

function launchKeep_() {
  var map = {};
  LAUNCH_PRODUCTS.forEach(function (p) { map[p.id] = p; });
  return map;
}

function launchArchiveIds_(ss) {
  var out = {};
  var arch = ss.getSheetByName(SHEET_ARCHIVE);
  if (!arch || arch.getLastRow() < 2) return out;
  var values = arch.getDataRange().getValues();
  var col = mapHeaders_(values[0], PRODUCT_COLS);
  for (var r = 1; r < values.length; r++) {
    var id = cell_(values[r], col.id);
    if (id) (out[id] || (out[id] = [])).push(cell_(values[r], col.nameUa));
  }
  return out;
}

/**
 * Что должно стоять в строке одной из 50 позиций: { поле: значение }. Поля, которых здесь нет, не трогаются
 * (наличие, фото, категория, остаток, «паспорт товара», служебные колонки).
 */
function launchWanted_(p, row, col) {
  var want = { nameUa: p.ua, nameRu: p.ru, type: 'вагова', pKg: p.price, descUa: p.dUa, descRu: p.dRu, tags: p.tags };
  if (p.howUa) { want.howUa = p.howUa; want.howRu = p.howRu || ''; }
  var wasWeight = cell_(row, col.type).toLowerCase().indexOf('ваг') === 0;
  // Фасовку меняем, только если строка была «упаковка» с чужого сайта или фасовка не читается; свою рабочую фасовку не трогаем.
  if (!wasWeight || !parsePacks_(cell_(row, col.packs)).length) want.packs = p.packs;
  if (!wasWeight) { want.pUnit = ''; want.packKg = ''; }
  // «Ціни фасувань», бейдж и старая цена остались от чужого сайта и тестов: фасовки считаются от цены за 1 кг, бейджей пока нет.
  want.packPrices = ''; want.badge = ''; want.oldPrice = ''; want.saleEnd = '';
  var wh = launchWholesale_();
  if (wh) {
    var w = wh[p.id];
    want.whPrice = w ? w[0] : '';
    want.whMinKg = w ? w[1] : '';
    want.whMin = w ? 'від ' + w[1] + ' кг' : '';
  }
  return want;
}

/** Отличия строки от нужного состояния: [{ k: поле, was, now }]. Колонки, которых нет и которые не создаются, пропускаются. */
function launchDiff_(want, row, col) {
  var creatable = {};
  LAUNCH_NEW_COLS.forEach(function (c) { creatable[c[0]] = true; });
  var out = [];
  Object.keys(want).forEach(function (k) {
    var c = col[k];
    if (!(c >= 0)) {
      if (creatable[k] && want[k] !== '') out.push({ k: k, was: '', now: want[k] });
      return;
    }
    if (!launchSame_(row[c], want[k])) out.push({ k: k, was: launchText_(row[c]), now: want[k] });
  });
  return out;
}

/* ============================== План изменений ============================== */

/**
 * Читает таблицу и возвращает всё, что изменит «Застосувати». Ничего не пишет.
 *   rows  — [лист, ID, поле, было, стане, примітка]
 *   sum   — числа для сводки и окна подтверждения
 *   warn  — предупреждения (маржа, конкурент, чего не хватает)
 *   fatal — текст, если применять нельзя (не та таблица)
 */
function launchPlan_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var plan = { rows: [], warn: [], info: [], fatal: '',
    sum: { keep: 0, archive: 0, purge: 0, add: 0, changed: 0, prices: 0, recipes: 0, settings: 0, points: 0, orders: 0, carts: 0, events: 0, nextOrder: '' } };
  function add(sheet, id, field, was, now, note) { plan.rows.push([sheet, id, field, was, now, note || '']); }

  var ctx = launchProducts_(ss);
  if (!ctx) { plan.fatal = 'У таблиці немає аркуша «' + SHEET_PRODUCTS + '». Це не таблиця магазину.'; return plan; }
  var col = ctx.col, values = ctx.values;
  if (col.id < 0 || col.nameUa < 0 || col.type < 0 || col.stock < 0 || col.pKg < 0) {
    plan.fatal = 'На аркуші «Товари» немає обов’язкових колонок (ID, Назва (UA), Тип, Наявність, Ціна за 1 кг).';
    return plan;
  }
  var keep = launchKeep_();
  var del = {}; LAUNCH_DELETE_IDS.forEach(function (id) { del[id] = true; });
  var reset = {}; LAUNCH_RESET_PRICE_IDS.forEach(function (id) { reset[id] = true; });
  var wh = launchWholesale_();
  if (!wh) plan.warn.push('Оптові ціни не завантажено (немає файлу LaunchWholesale.gs) — колонки опту не змінюються.');

  LAUNCH_NEW_COLS.forEach(function (c) {
    if (col[c[0]] < 0 && (wh || c[0].indexOf('wh') !== 0)) add(SHEET_PRODUCTS, '', 'колонка', 'немає', c[1], 'буде створено в кінці аркуша');
  });

  var have = {}, known = 0, brandRe = launchBrandRe_();
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    var id = cell_(row, col.id);
    if (!id) continue;
    var name = cell_(row, col.nameUa);
    if (del[id]) {
      plan.sum.purge++;
      add(SHEET_PRODUCTS, id, 'рядок', name, 'видалити назавжди', 'тестовий рядок; ID більше не видається');
      continue;
    }
    var p = keep[id];
    if (!p || have[id]) {
      if (p) plan.warn.push(id + ': на аркуші «Товари» є другий рядок із цим ID — він піде в архів.');
      plan.sum.archive++;
      if (reset[id]) {
        var compPrice = col.comp >= 0 ? toNum_(row[col.comp]) : 0;
        var priceCol = cell_(row, col.type).toLowerCase().indexOf('ваг') === 0 ? col.pKg : col.pUnit;
        if (compPrice > 0 && priceCol >= 0 && toNum_(row[priceCol]) !== compPrice) add(SHEET_PRODUCTS, id, 'ціна', launchText_(row[priceCol]), compPrice, 'тестова правка: ціну повернуто з колонки «Конкурент»');
        if (!(compPrice > 0)) plan.warn.push(id + ': не знайдено ціну в колонці «Конкурент» — ціна перед архівацією не змінюється.');
        ['badge', 'oldPrice', 'saleEnd'].forEach(function (k) {
          if (col[k] >= 0 && launchText_(row[col[k]]) !== '') add(SHEET_PRODUCTS, id, LAUNCH_FIELD_UA[k], launchText_(row[col[k]]), '', 'тестова правка');
        });
      }
      add(SHEET_PRODUCTS, id, 'рядок', name, 'в архів', 'можна відновити в панелі: Товари → Архів');
      continue;
    }
    have[id] = true;
    if (!p.isNew) known++;
    plan.sum.keep++;
    var want = launchWanted_(p, row, col);
    var diff = launchDiff_(want, row, col);
    if (diff.length) plan.sum.changed++;
    diff.forEach(function (d) {
      if (d.k === 'pKg') plan.sum.prices++;
      add(SHEET_PRODUCTS, id, LAUNCH_FIELD_UA[d.k] || d.k, d.was, d.now, '');
    });
    launchPriceWarnings_(plan, p, row, col, wh);
    if (!isInStock_(cell_(row, col.stock))) plan.info.push(id + ' ' + p.ua + ': зараз «' + (cell_(row, col.stock) || 'порожньо') + '» — на вітрині буде сірим.');
    // Чужая марка не должна остаться ни в одном видимом поле (после замены названий и описаний).
    var visible = [p.ua, p.ru, p.dUa, p.dRu, p.howUa || '', p.howRu || '', p.tags];
    ['sort', 'harvest', 'origin', 'hint', 'hintRu', 'compUa', 'compRu'].forEach(function (k) { visible.push(cell_(row, col[k])); });
    if (!want.packs) visible.push(cell_(row, col.packs));
    var hit = visible.join(' | ').match(brandRe);
    if (hit) plan.warn.push(id + ': у видимому полі лишається чужа марка «' + hit[0] + '» — виправте вручну.');
  }

  var archived = launchArchiveIds_(ss);
  LAUNCH_PRODUCTS.forEach(function (p) {
    if (have[p.id]) return;
    if (archived[p.id]) { plan.warn.push(p.id + ' ' + p.ua + ': лежить в архіві. Відновіть у панелі (Товари → Архів) і запустіть перевірку ще раз.'); return; }
    if (!p.isNew) { plan.warn.push(p.id + ' ' + p.ua + ': немає на аркуші «Товари» — на вітрині цієї позиції не буде.'); return; }
    plan.sum.add++;
    plan.sum.keep++;
    add(SHEET_PRODUCTS, p.id, 'рядок', 'немає', 'додати: ' + p.ua + ', ' + p.price + ' ₴/кг, наявність «' + p.stock + '»',
      p.stock === 'є' ? 'новий рядок' : 'новий рядок; «немає», доки батьки не підтвердять, що товар є');
    if (p.stock !== 'є') plan.info.push(p.id + ' ' + p.ua + ': додається з наявністю «немає» — поставте «є», коли батьки підтвердять.');
  });
  if (known < LAUNCH_MIN_KNOWN) {
    plan.fatal = 'На аркуші «Товари» знайдено лише ' + known + ' із 30 очікуваних позицій. Схоже, це не та таблиця або ID змінено. Нічого не робимо.';
    return plan;
  }

  launchPlanRecipes_(ss, plan, add);
  launchPlanSettings_(ss, plan, add);
  launchPlanPoints_(ss, plan, add);
  launchPlanTestData_(ss, plan, add);
  launchPlanAdmins_(ss, plan);
  // Категория специй должна быть в «Категорії», иначе у новых строк не будет иконки.
  var cats = readCategories_(ss);
  var newCats = {};
  LAUNCH_PRODUCTS.forEach(function (p) { if (p.isNew) newCats[p.id.split('-')[0]] = p.catUa; });
  Object.keys(newCats).forEach(function (code) {
    var okCat = cats.some(function (c) { return c.code === code || c.ua.toLowerCase() === newCats[code].toLowerCase(); });
    if (!okCat) plan.warn.push('На аркуші «Категорії» немає категорії «' + newCats[code] + '» (код ' + code + ') — додайте її в панелі.');
  });
  return plan;
}

function launchBrandRe_() {
  var parts = LAUNCH_BRANDS.map(function (b) { return b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); });
  return new RegExp('(^|[^A-Za-zА-Яа-яІіЇїЄєҐґ0-9])(' + parts.join('|') + ')(?![A-Za-zА-Яа-яІіЇїЄєҐґ0-9])', 'i');
}

/** Предупреждения о ценах: маржа (если заполнена закупка) и отличие от цены конкурента больше чем на 30 %. Цены не меняются. */
function launchPriceWarnings_(plan, p, row, col, wh) {
  var buy = col.buy >= 0 ? toNum_(row[col.buy]) : 0;
  var comp = col.comp >= 0 ? toNum_(row[col.comp]) : 0;
  var isWeight = cell_(row, col.type).toLowerCase().indexOf('ваг') === 0;
  var packKg = col.packKg >= 0 ? toNum_(row[col.packKg]) : 0;
  if (!isWeight) { // у строки «упаковка» закупка и конкурент записаны за упаковку: приводим к 1 кг, если известен вес
    if (packKg > 0) { buy = buy / packKg; comp = comp / packKg; }
    else { if (buy > 0 || comp > 0) plan.info.push(p.id + ': закупка й ціна конкурента були за упаковку невідомої ваги — не порівнюю.'); buy = 0; comp = 0; }
  }
  if (buy > 0 && p.price < buy * 1.35) plan.warn.push(p.id + ' ' + p.ua + ': мала маржа — роздріб ' + p.price + ' ₴ менший за закупку × 1,35.');
  var w = wh ? wh[p.id] : null;
  if (buy > 0 && w && w[0] < buy * 1.15) plan.warn.push(p.id + ' ' + p.ua + ': мала маржа — опт ' + w[0] + ' ₴ менший за закупку × 1,15.');
  if (comp > 0 && Math.abs(p.price - comp) / comp > 0.3) {
    var pct = Math.round((p.price - comp) / comp * 100);
    plan.warn.push(p.id + ' ' + p.ua + ': сильно відрізняється від конкурента — наша ціна ' + p.price + ' ₴, у конкурента ' + Math.round(comp) + ' ₴ (' + (pct > 0 ? '+' : '') + pct + ' %).');
  }
}

function launchRecipeText_(lines) { return lines.join('\n'); }

function launchPlanRecipes_(ss, plan, add) {
  var sheet = ss.getSheetByName(SHEET_RECIPES);
  var byId = {}, col = null;
  if (!sheet) add(SHEET_RECIPES, '', 'аркуш', 'немає', 'створити', '');
  else {
    var values = sheet.getDataRange().getValues();
    col = mapHeaders_(values[0], RECIPE_COLS);
    if (col.id < 0 || col.ua < 0) { plan.warn.push('На аркуші «Рецепти» немає колонок ID і Назва (UA) — рецепти не записуються.'); return; }
    for (var r = 1; r < values.length; r++) { var id = cell_(values[r], col.id).toUpperCase(); if (id && !byId[id]) byId[id] = values[r]; }
  }
  LAUNCH_RECIPES.forEach(function (rec) {
    var row = byId[rec.id];
    if (!row) { plan.sum.recipes++; add(SHEET_RECIPES, rec.id, 'рядок', 'немає', 'додати: ' + rec.ua, 'товари: ' + rec.items.join(', ')); return; }
    var diff = launchRecipeDiff_(rec, row, col);
    if (diff.length) plan.sum.recipes++;
    diff.forEach(function (d) { add(SHEET_RECIPES, rec.id, d.title, d.was.slice(0, 80), String(d.now).slice(0, 80), ''); });
  });
}

function launchRecipeWant_(rec) {
  return [['ua', 'Назва (UA)', rec.ua], ['ru', 'Название (RU)', rec.ru], ['textUa', 'Текст (UA)', launchRecipeText_(rec.tUa)],
    ['textRu', 'Текст (RU)', launchRecipeText_(rec.tRu)], ['items', 'Товари', rec.items.join(', ')]];
}

function launchRecipeDiff_(rec, row, col) {
  var out = [];
  launchRecipeWant_(rec).forEach(function (w) {
    if (col[w[0]] < 0) return;
    var cur = launchText_(row[col[w[0]]]);
    var same = w[0] === 'items' ? idList_(cur, 20).join(', ') === w[2] : cur === w[2];
    if (!same) out.push({ k: w[0], title: w[1], was: cur, now: w[2] });
  });
  if (col.show >= 0 && launchText_(row[col.show]) === '') out.push({ k: 'show', title: 'Показувати', was: '', now: 'так' });
  return out;
}

function launchSettingsRows_(ss) {
  var sheet = ss.getSheetByName(SHEET_SETTINGS);
  var at = {};
  if (sheet && sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues().forEach(function (row, i) {
      var k = String(row[0] || '').trim();
      if (k && !at[k]) at[k] = { row: i + 2, v: launchText_(row[1]) };
    });
  }
  return { sheet: sheet, at: at };
}

function launchPlanSettings_(ss, plan, add) {
  var cur = launchSettingsRows_(ss);
  var known = {};
  SETTINGS_DEF.forEach(function (d) { known[d[0]] = d; });
  Object.keys(LAUNCH_SETTINGS).forEach(function (k) {
    if (!known[k]) { plan.warn.push('Налаштування «' + k + '»: такого ключа немає в коді — пропущено.'); return; }
    var want = String(LAUNCH_SETTINGS[k]).trim();
    var have = cur.at[k];
    if (have && have.v === want) return;
    plan.sum.settings++;
    add(SHEET_SETTINGS, k, 'Значення', have ? have.v.slice(0, 80) : '(немає рядка)', want.slice(0, 80) || '(порожньо)', known[k][1].slice(0, 80));
  });
}

function launchPointsCtx_(ss) {
  var sheet = ss.getSheetByName(SHEET_POINTS);
  if (!sheet || sheet.getLastRow() < 2) return null;
  var values = sheet.getDataRange().getValues();
  var col = mapHeaders_(values[0], POINT_COLS);
  return col.ua < 0 ? null : { sheet: sheet, values: values, col: col };
}

/** Что должно стоять в строке точки: { поле: значение }. */
function launchPointWant_() {
  var want = { addrUa: LAUNCH_POINTS.addrUa, addrRu: LAUNCH_POINTS.addrRu };
  LAUNCH_POINTS.hours.forEach(function (h, d) { want['d' + d] = h; });
  LAUNCH_POINTS.clear.forEach(function (k) { want[k] = ''; });
  return want;
}

function launchPlanPoints_(ss, plan, add) {
  var ctx = launchPointsCtx_(ss);
  if (!ctx) { plan.warn.push('Аркуша «Точки» немає або він порожній — точки не змінюються (вітрина показує адресу з налаштувань).'); return; }
  var want = launchPointWant_(), n = 0;
  for (var r = 1; r < ctx.values.length; r++) {
    var name = cell_(ctx.values[r], ctx.col.ua);
    if (!name) continue;
    n++;
    var changed = false;
    Object.keys(want).forEach(function (k) {
      var c = ctx.col[k];
      if (c < 0 || launchText_(ctx.values[r][c]) === want[k]) return;
      changed = true;
      add(SHEET_POINTS, name, String(ctx.values[0][c]), launchText_(ctx.values[r][c]), want[k] || '(очистити)', want[k] ? '' : 'там був приклад; справжні дані впишете самі');
    });
    if (changed) plan.sum.points++;
  }
  if (n !== 2) plan.warn.push('На аркуші «Точки» рядків із назвою: ' + n + ' (очікувалось 2). Адресу й години записано в усі.');
}

function launchOrderNum_(v) {
  var m = String(v).match(/^P-(\d+)$/);
  return m ? parseInt(m[1], 10) : 0;
}

function launchPlanTestData_(ss, plan, add) {
  var props = scriptProps_();
  var doneAt = String(props.getProperty(PROP_LAUNCH_TESTDATA) || '');
  var floor = parseInt(props.getProperty(PROP_ORDER_FLOOR), 10) || 0;
  var orders = ss.getSheetByName(SHEET_ORDERS);
  var maxKept = 0, other = 0;
  if (orders && orders.getLastRow() > 1) {
    var col = orderCols_(orders);
    orders.getRange(2, 1, orders.getLastRow() - 1, orders.getLastColumn()).getValues().forEach(function (row) {
      var n = launchOrderNum_(row[col.num]);
      if (!n) return;
      if (!doneAt && n >= LAUNCH_TEST_ORDERS.from && n <= LAUNCH_TEST_ORDERS.to) {
        plan.sum.orders++;
        floor = Math.max(floor, n);
        add(SHEET_ORDERS, row[col.num], 'рядок', launchText_(row[col.status]) + (col.total >= 0 ? ', ' + launchText_(row[col.total]) + ' ₴' : ''),
          'перенести в «' + SHEET_TEST_ORDERS + '» і видалити', 'тестове замовлення');
      } else { other++; maxKept = Math.max(maxKept, n); }
    });
  }
  if (doneAt) plan.info.push('Тестові замовлення, «Кошики» і «Події» вже очищено ' + doneAt + ' — вдруге не чистяться.');
  else {
    [[SHEET_CARTS, 'carts'], [SHEET_EVENTS, 'events']].forEach(function (s) {
      var sheet = ss.getSheetByName(s[0]);
      var n = sheet ? Math.max(0, sheet.getLastRow() - 1) : 0;
      plan.sum[s[1]] = n;
      if (n) add(s[0], '', 'рядки', String(n), 'очистити', 'заголовок лишається');
    });
    if (other) plan.info.push('Інших замовлень (не P-' + launchPad_(LAUNCH_TEST_ORDERS.from) + ' … P-' + launchPad_(LAUNCH_TEST_ORDERS.to) + '): ' + other + ' — вони не чіпаються.');
  }
  var next = Math.max(floor, maxKept) + 1;
  plan.sum.nextOrder = 'P-' + launchPad_(next);
  plan.info.push('Наступне справжнє замовлення отримає номер ' + plan.sum.nextOrder + ': нумерація продовжується, щоб старі кнопки й посилання тестових замовлень не потрапили на нове замовлення.');
}

function launchPad_(n) { var s = String(n); while (s.length < 4) s = '0' + s; return s; }

/** Кто есть в листе «Адміни» и у кого не вписано имя: только в отчёт, лист не меняется. */
function launchPlanAdmins_(ss, plan) {
  var sheet = ss.getSheetByName(SHEET_ADMINS);
  if (!sheet || sheet.getLastRow() < 2) { plan.info.push('Аркуш «Адміни» порожній: адміни беруться з властивостей скрипта.'); return; }
  var values = sheet.getDataRange().getValues();
  var col = mapHeaders_(values[0], ADMIN_COLS);
  var list = [], noName = 0;
  for (var r = 1; r < values.length; r++) {
    var id = cell_(values[r], col.id);
    if (!id) continue;
    var name = cell_(values[r], col.name);
    if (!name) noName++;
    list.push((name || 'БЕЗ ІМЕНІ') + (cell_(values[r], col.username) ? ' ' + cell_(values[r], col.username) : '') + ' — ' + (cell_(values[r], col.role) || 'роль не вказано') +
      (col.active >= 0 && !isYes_(cell_(values[r], col.active)) ? ' (неактивний)' : ''));
  }
  plan.info.push('Адміни (' + list.length + '): ' + list.join('; ') + '. Аркуш не змінюється.' + (noName ? ' Без імені: ' + noName + ' — впишіть ім’я в колонку «Ім’я».' : ''));
}

function launchSummaryLines_(plan) {
  var s = plan.sum;
  var lines = [
    'Залишається на вітрині: ' + s.keep + ' позицій (з них нових рядків спецій: ' + s.add + ')',
    'В архів: ' + s.archive + ' товарів',
    'Видалити назавжди: ' + s.purge + ' тестових рядків',
    'Позицій зі змінами: ' + s.changed + ', з них змінюється ціна: ' + s.prices,
    'Рецептів додати або оновити: ' + s.recipes,
    'Налаштувань змінити: ' + s.settings,
    'Точок оновити: ' + s.points,
    'Тестових замовлень прибрати: ' + s.orders + '; рядків «Кошики»: ' + s.carts + '; рядків «Події»: ' + s.events,
    'Попереджень: ' + plan.warn.length
  ];
  return lines;
}

function launchSummaryText_(plan) {
  if (plan.fatal) return plan.fatal;
  return launchSummaryLines_(plan).join('\n');
}

/* ============================ 1. Сухой прогон ============================ */

/** Считает план и пишет лист «Запуск — звіт». Остальные листы не меняются. */
function launchCheck_() {
  var plan = launchPlan_();
  launchWriteReport_(plan, 'Перевірка — у таблиці нічого не змінено');
  return plan;
}

function launchWriteReport_(plan, title) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_LAUNCH_REPORT) || ss.insertSheet(SHEET_LAUNCH_REPORT);
  sheet.clearContents();
  var W = 6;
  function line(a, b) { var r = [a, b === undefined ? '' : b]; while (r.length < W) r.push(''); return r; }
  var summary = plan.fatal ? [line('ЗУПИНЕНО', plan.fatal)] : launchSummaryLines_(plan).map(function (t) { return line(t); });
  var out = [line('PAMIR — підготовка до запуску. ' + title + '. ' + launchDay_('dd.MM.yyyy HH:mm'))];
  out.push(line(''));
  out.push(line('ПІДСУМОК'));
  out = out.concat(summary);
  out.push(line(''));
  out.push(line('ПОПЕРЕДЖЕННЯ (' + plan.warn.length + ')'));
  if (!plan.warn.length) out.push(line('немає'));
  plan.warn.forEach(function (t) { out.push(line(t)); });
  out.push(line(''));
  out.push(line('ДО ВІДОМА'));
  plan.info.forEach(function (t) { out.push(line(t)); });
  out.push(line(''));
  out.push(line('ЩО ЗМІНИТЬСЯ (' + plan.rows.length + ' рядків)'));
  var headAt = out.length + 1;
  out.push(['Аркуш', 'ID', 'Поле', 'Було', 'Стане', 'Примітка']);
  plan.rows.forEach(function (r) {
    out.push(r.map(function (v) { return typeof v === 'number' ? v : safeCell_(String(v === null || v === undefined ? '' : v)); }));
  });
  out.push(line(''));
  out.push(line('ПІДСУМОК (те саме, що вгорі)'));
  out = out.concat(summary);
  launchRoom_(sheet, out.length, W);
  sheet.getRange(1, 1, out.length, W).setValues(out);
  try {
    sheet.getRange(1, 1, 1, 1).setFontWeight('bold');
    sheet.getRange(headAt, 1, 1, W).setFontWeight('bold');
  } catch (err) { /* оформление не обязательно */ }
}

/* ============================ 2. Резервная копия ============================ */

/** Копия всей таблицы в Google Диске владельца. День и имя копии запоминаются: без копии за сегодня «Застосувати» не работает. */
function launchBackup_() {
  var props = scriptProps_();
  var saved = launchJson_(propRead_(props, PROP_LAUNCH_BACKUP, true));
  if (saved.day === launchDay_() && saved.name) return { ok: true, already: true, name: saved.name };
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var name = 'PAMIR — Товари — резерв перед запуском ' + launchDay_('dd.MM.yyyy');
  ss.copy(name);
  props.setProperty(PROP_LAUNCH_BACKUP, JSON.stringify({ day: launchDay_(), name: name }));
  launchLog_([['Запуск: резервна копія', name, '', 'створено']]);
  return { ok: true, already: false, name: name };
}

/* ============================== 3. Применение ============================== */

/**
 * Вносит изменения. Возвращает { ok, done, phase }.
 * opts (только для тестов): budgetMs — сколько работать за один запуск, chunk — товаров в архив за порцию.
 */
function launchApply_(opts) {
  opts = opts || {};
  if (!launchBackupToday_()) return { ok: false, error: 'no_backup', message: 'немає резервної копії за сьогодні' };
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return { ok: false, error: 'busy' };
  var props = scriptProps_();
  var doneAll = false;
  try {
    var plan = launchPlan_();
    if (plan.fatal) return { ok: false, error: 'fatal', message: plan.fatal };
    var state = launchState_();
    var started = Date.now();
    var budget = opts.budgetMs === undefined ? LAUNCH_RUN_MS : opts.budgetMs;
    var run = {
      ss: SpreadsheetApp.getActiveSpreadsheet(), chunk: opts.chunk || LAUNCH_ARCHIVE_CHUNK, steps: 0,
      /** Есть ли ещё время. Первый шаг запуска делается всегда: иначе при малом запасе работа не двигалась бы вовсе. */
      timeLeft: function () { return this.steps++ === 0 || Date.now() - started < budget; }
    };
    if (state.phase === 0) {
      launchWriteReport_(plan, 'Застосування: що було заплановано');
      launchLog_([['Запуск: початок', 'в архів ' + plan.sum.archive + ', видалити ' + plan.sum.purge + ', змінити ' + plan.sum.changed, '', '']]);
    }
    for (var i = state.phase; i < LAUNCH_PHASES.length; i++) {
      var name = LAUNCH_PHASES[i];
      if (!run.timeLeft()) { props.setProperty(PROP_LAUNCH_STATE, JSON.stringify({ phase: i })); return { ok: true, done: false, phase: name }; }
      var finished = launchPhase_[name](run);
      SpreadsheetApp.flush();
      if (!finished) { props.setProperty(PROP_LAUNCH_STATE, JSON.stringify({ phase: i })); return { ok: true, done: false, phase: name }; }
      props.setProperty(PROP_LAUNCH_STATE, JSON.stringify({ phase: i + 1 }));
    }
    props.setProperty(PROP_LAUNCH_STATE, '');
    props.setProperty(PROP_LAUNCH_DONE, launchDay_('dd.MM.yyyy'));
    launchLog_([['Запуск: завершено', '', '', launchDay_('dd.MM.yyyy HH:mm')]]);
    doneAll = true;
    return { ok: true, done: true, phase: 'finish' };
  } finally {
    clearCatalogCache_();
    whMapMemo_ = null; settingsMemo_ = null; pointsMemo_ = null;
    lock.releaseLock();
    // «Статистика» пересчитывается уже после снятия блокировки: salesStats_ сама берёт и отпускает блокировку скрипта.
    if (doneAll) { try { salesStats_(true); } catch (err) { console.error('launch stats: ' + (err && err.stack || err)); } }
  }
}

/** Записывает ячейки листа: changes = [{ r, c, v }] (номера с 1). По колонкам, одной записью на колонку; формулы в соседних ячейках не затираются. */
function launchWriteCells_(sheet, changes) {
  var byCol = {};
  changes.forEach(function (ch) { (byCol[ch.c] || (byCol[ch.c] = [])).push(ch); });
  Object.keys(byCol).forEach(function (c) {
    var list = byCol[c];
    var min = list[0].r, max = list[0].r;
    list.forEach(function (ch) { min = Math.min(min, ch.r); max = Math.max(max, ch.r); });
    var range = sheet.getRange(min, +c, max - min + 1, 1);
    var formulas = null;
    try { formulas = typeof range.getFormulas === 'function' ? range.getFormulas() : null; } catch (err) { formulas = null; }
    var hasFormula = formulas && formulas.some(function (f) { return f[0]; });
    if (hasFormula || list.length === 1) {
      list.forEach(function (ch) { sheet.getRange(ch.r, +c).setValue(ch.v); });
      return;
    }
    var vals = range.getValues();
    list.forEach(function (ch) { vals[ch.r - min][0] = ch.v; });
    range.setValues(vals);
  });
}

var launchPhase_ = {
  /** Недостающие колонки «Товари» и листы «Архів товарів», «Рецепти». */
  cols: function (run) {
    var sheet = run.ss.getSheetByName(SHEET_PRODUCTS);
    var col = mapHeaders_(headRow_(sheet), PRODUCT_COLS);
    var made = [];
    LAUNCH_NEW_COLS.forEach(function (c) {
      if (col[c[0]] >= 0 || (!launchWholesale_() && c[0].indexOf('wh') === 0)) return;
      launchRoom_(sheet, 1, sheet.getLastColumn() + 1);
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue(c[1]).setFontWeight('bold');
      made.push(c[1]);
    });
    ensureArchiveSheet_();
    if (!run.ss.getSheetByName(SHEET_RECIPES)) {
      var rec = run.ss.insertSheet(SHEET_RECIPES);
      rec.getRange(1, 1, 1, RECIPE_HEAD.length).setValues([RECIPE_HEAD]).setFontWeight('bold');
      rec.setFrozenRows(1);
      made.push('аркуш «' + SHEET_RECIPES + '»');
    }
    if (made.length) launchLog_([['Запуск: створено', made.join(', '), '', '']]);
    return true;
  },

  /** NUT-006: тестовая цена и скидка убираются. Тестовые строки удаляются навсегда, их ID запоминаются. */
  fix: function (run) {
    var ctx = launchProducts_(run.ss), col = ctx.col, sheet = ctx.sheet, log = [], changes = [];
    var reset = {}; LAUNCH_RESET_PRICE_IDS.forEach(function (id) { reset[id] = true; });
    var del = {}; LAUNCH_DELETE_IDS.forEach(function (id) { del[id] = true; });
    var rowsToDelete = [];
    for (var r = 1; r < ctx.values.length; r++) {
      var row = ctx.values[r], id = cell_(row, col.id);
      if (del[id]) { rowsToDelete.push(r + 1); log.push(['Запуск: видалено назавжди', id + ' ' + cell_(row, col.nameUa), 'на вітрині', 'видалено']); continue; }
      if (!reset[id]) continue;
      var comp = col.comp >= 0 ? toNum_(row[col.comp]) : 0;
      var isWeight = cell_(row, col.type).toLowerCase().indexOf('ваг') === 0;
      var pc = isWeight ? col.pKg : col.pUnit;
      if (comp > 0 && pc >= 0 && toNum_(row[pc]) !== comp) {
        changes.push({ r: r + 1, c: pc + 1, v: comp });
        if (isWeight && col.p100 >= 0 && !sheet.getRange(r + 1, col.p100 + 1).getFormula()) changes.push({ r: r + 1, c: col.p100 + 1, v: Math.round(comp) / 10 });
        log.push(['Запуск: ціну повернуто', id, launchText_(row[pc]), comp]);
      }
      ['badge', 'oldPrice', 'saleEnd'].forEach(function (k) {
        if (col[k] >= 0 && launchText_(row[col[k]]) !== '') changes.push({ r: r + 1, c: col[k] + 1, v: '' });
      });
    }
    launchWriteCells_(sheet, changes);
    SpreadsheetApp.flush();
    rowsToDelete.reverse().forEach(function (n) { sheet.deleteRow(n); });
    // Тестовая строка могла уже лежать в архиве — оттуда она тоже удаляется.
    var arch = run.ss.getSheetByName(SHEET_ARCHIVE);
    if (arch && arch.getLastRow() > 1) {
      var av = arch.getDataRange().getValues(), ac = mapHeaders_(av[0], PRODUCT_COLS);
      for (var i = av.length - 1; i >= 1; i--) if (del[cell_(av[i], ac.id)]) { arch.deleteRow(i + 1); log.push(['Запуск: видалено назавжди', cell_(av[i], ac.id), 'в архіві', 'видалено']); }
    }
    LAUNCH_DELETE_IDS.forEach(function (id) { rememberDeletedId_(id); });
    launchLog_(log);
    return true;
  },

  /** Всё, чего нет в списке 50, переносится в «Архів товарів» порциями: сначала строка появляется в архиве, потом исчезает из «Товари». */
  archive: function (run) {
    var keep = launchKeep_();
    var arch = ensureArchiveSheet_();
    for (;;) {
      var ctx = launchProducts_(run.ss), col = ctx.col, sheet = ctx.sheet, values = ctx.values;
      var seen = {}, pick = [];
      for (var r = 1; r < values.length && pick.length < run.chunk; r++) {
        var id = cell_(values[r], col.id);
        if (!id) continue;
        if (keep[id] && !seen[id]) { seen[id] = true; continue; }
        pick.push(r);
      }
      if (!pick.length) return true;
      var aHead = headRow_(arch), at = {};
      headerKeys_(aHead).forEach(function (k, j) { at[k] = j; });
      var pKeys = headerKeys_(values[0]);
      var atCol = at[ARCHIVE_AT.toLowerCase()], byCol = at[ARCHIVE_BY.toLowerCase()];
      var already = launchArchiveIds_(run.ss); // строки, которые успели попасть в архив до обрыва прошлого запуска
      var rows = [], log = [], now = new Date();
      pick.forEach(function (r) {
        var id = cell_(values[r], col.id), name = cell_(values[r], col.nameUa);
        log.push(['Запуск: в архів', id + ' ' + name, 'на вітрині', 'в архіві']);
        if (already[id] && already[id].indexOf(name) >= 0) return;
        var row = aHead.map(function () { return ''; });
        pKeys.forEach(function (k, j) { if (k.indexOf('#') < 0 && at[k] !== undefined) row[at[k]] = keepCell_(values[r][j]); });
        if (atCol !== undefined) row[atCol] = now;
        if (byCol !== undefined) row[byCol] = 'Підготовка до запуску';
        rows.push(row);
      });
      if (rows.length) {
        var first = arch.getLastRow() + 1;
        launchRoom_(arch, first + rows.length - 1, aHead.length);
        arch.getRange(first, 1, rows.length, aHead.length).setValues(rows);
        if (atCol !== undefined) arch.getRange(first, atCol + 1, rows.length, 1).setNumberFormat('dd.MM.yyyy HH:mm');
        SpreadsheetApp.flush();
      }
      // Удаляем снизу вверх, соседние строки — одной операцией.
      var i = pick.length - 1;
      while (i >= 0) {
        var end = pick[i], start = end;
        while (i > 0 && pick[i - 1] === start - 1) { i--; start = pick[i]; }
        sheet.deleteRows(start + 1, end - start + 1);
        i--;
      }
      SpreadsheetApp.flush();
      launchLog_(log);
      if (!run.timeLeft()) return false;
    }
  },

  /** Строки специй SPS-001 … SPS-020, которых ещё нет: добавляются в конец «Товари». Остальные поля заполнит шаг «50 позицій». */
  add: function (run) {
    var ctx = launchProducts_(run.ss), col = ctx.col, sheet = ctx.sheet;
    var have = {};
    for (var r = 1; r < ctx.values.length; r++) have[cell_(ctx.values[r], col.id)] = true;
    var archived = launchArchiveIds_(run.ss);
    var width = ctx.values[0].length, rows = [], log = [];
    LAUNCH_PRODUCTS.forEach(function (p) {
      if (!p.isNew || have[p.id] || archived[p.id]) return;
      var row = []; for (var i = 0; i < width; i++) row.push('');
      [['id', p.id], ['catUa', p.catUa], ['catRu', p.catRu], ['nameUa', p.ua], ['nameRu', p.ru], ['type', 'вагова'], ['packs', p.packs], ['pKg', p.price], ['stock', p.stock]]
        .forEach(function (f) { if (col[f[0]] >= 0) row[col[f[0]]] = f[1]; });
      rows.push(row);
      log.push(['Запуск: додано товар', p.id + ' ' + p.ua, '', p.price + ' ₴/кг, ' + p.stock]);
    });
    if (!rows.length) return true;
    var last = sheet.getLastRow();
    launchRoom_(sheet, last + rows.length, width);
    sheet.getRange(last + 1, 1, rows.length, width).setValues(rows);
    SpreadsheetApp.flush();
    for (var n = 0; n < rows.length; n++) copyRowFormulas_(sheet, last, last + 1 + n);
    launchLog_(log);
    return true;
  },

  /** 50 позиций: названия, описания, цены, опт, теги, «Як їсти»; тип «вагова»; чужие «Ціни фасувань», бейджи и старые цены убираются. */
  products: function (run) {
    var ctx = launchProducts_(run.ss), col = ctx.col, sheet = ctx.sheet, values = ctx.values;
    var keep = launchKeep_(), seen = {}, changes = [], log = [];
    var p100Formula = null;
    if (col.p100 >= 0 && values.length > 1) {
      var fr = sheet.getRange(2, col.p100 + 1, values.length - 1, 1);
      try { p100Formula = typeof fr.getFormulas === 'function' ? fr.getFormulas() : null; } catch (err) { p100Formula = null; }
    }
    for (var r = 1; r < values.length; r++) {
      var id = cell_(values[r], col.id), p = keep[id];
      if (!p || seen[id]) continue;
      seen[id] = true;
      var diff = launchDiff_(launchWanted_(p, values[r], col), values[r], col).filter(function (d) { return col[d.k] >= 0; });
      // «Ціна за 100 г» — если в ячейке не формула, пересчитываем от новой цены за 1 кг.
      if (col.p100 >= 0 && !(p100Formula && p100Formula[r - 1] && p100Formula[r - 1][0]) && !launchSame_(values[r][col.p100], p.price / 10)) {
        diff.push({ k: 'p100', was: launchText_(values[r][col.p100]), now: p.price / 10 });
      }
      if (!diff.length) continue;
      diff.forEach(function (d) { changes.push({ r: r + 1, c: col[d.k] + 1, v: d.now }); });
      var priceChange = diff.filter(function (d) { return d.k === 'pKg'; })[0];
      log.push(['Запуск: товар оновлено', id + ' ' + p.ua, priceChange ? 'ціна ' + priceChange.was : '',
        (priceChange ? 'ціна ' + priceChange.now + '; ' : '') + diff.map(function (d) { return LAUNCH_FIELD_UA[d.k] || d.k; }).join(', ')]);
    }
    launchWriteCells_(sheet, changes);
    launchLog_(log);
    return true;
  },

  /** Рецепты: по ID. Есть строка — обновляются тексты и товары, нет — добавляется. Фото и чужие рецепты не трогаются. */
  recipes: function (run) {
    var sheet = run.ss.getSheetByName(SHEET_RECIPES);
    var values = sheet.getDataRange().getValues();
    var col = mapHeaders_(values[0], RECIPE_COLS);
    if (col.id < 0 || col.ua < 0) return true;
    var at = {};
    for (var r = 1; r < values.length; r++) { var id = cell_(values[r], col.id).toUpperCase(); if (id && !at[id]) at[id] = r; }
    var changes = [], rows = [], log = [], width = values[0].length;
    LAUNCH_RECIPES.forEach(function (rec) {
      if (at[rec.id]) {
        var diff = launchRecipeDiff_(rec, values[at[rec.id]], col);
        diff.forEach(function (d) { changes.push({ r: at[rec.id] + 1, c: col[d.k] + 1, v: d.now }); });
        if (diff.length) log.push(['Запуск: рецепт оновлено', rec.id + ' ' + rec.ua, '', diff.map(function (d) { return d.title; }).join(', ')]);
        return;
      }
      var row = []; for (var i = 0; i < width; i++) row.push('');
      row[col.id] = rec.id;
      launchRecipeWant_(rec).forEach(function (w) { if (col[w[0]] >= 0) row[col[w[0]]] = w[2]; });
      if (col.show >= 0) row[col.show] = 'так';
      rows.push(row);
      log.push(['Запуск: рецепт додано', rec.id + ' ' + rec.ua, '', rec.items.join(', ')]);
    });
    launchWriteCells_(sheet, changes);
    if (rows.length) {
      launchRoom_(sheet, sheet.getLastRow() + rows.length, width);
      sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, width).setValues(rows);
    }
    launchLog_(log);
    return true;
  },

  /** Настройки: меняются только ключи из LAUNCH_SETTINGS; остальные строки листа остаются как есть. */
  settings: function (run) {
    var cur = launchSettingsRows_(run.ss);
    var sheet = cur.sheet;
    if (!sheet) {
      sheet = run.ss.insertSheet(SHEET_SETTINGS);
      sheet.getRange(1, 1, 1, 3).setValues([['Ключ', 'Значення', 'Опис']]).setFontWeight('bold');
      sheet.setFrozenRows(1);
    }
    var known = {};
    SETTINGS_DEF.forEach(function (d) { known[d[0]] = d; });
    var changes = [], rows = [], log = [];
    Object.keys(LAUNCH_SETTINGS).forEach(function (k) {
      if (!known[k]) return;
      var want = String(LAUNCH_SETTINGS[k]).trim();
      var have = cur.at[k];
      if (have && have.v === want) return;
      if (have) changes.push({ r: have.row, c: 2, v: want });
      else rows.push([k, want, known[k][1]]);
      log.push(['Запуск: налаштування', k, have ? have.v : '', want]);
    });
    launchWriteCells_(sheet, changes);
    if (rows.length) {
      launchRoom_(sheet, sheet.getLastRow() + rows.length, 3);
      sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 3).setValues(rows);
    }
    settingsMemo_ = null;
    launchLog_(log);
    return true;
  },

  /** Точки: адрес и часы; ряд, место, «як знайти» и телефон очищаются (там были примеры). */
  points: function (run) {
    var ctx = launchPointsCtx_(run.ss);
    if (!ctx) return true;
    var want = launchPointWant_(), changes = [], log = [];
    for (var r = 1; r < ctx.values.length; r++) {
      var name = cell_(ctx.values[r], ctx.col.ua);
      if (!name) continue;
      var fields = [];
      Object.keys(want).forEach(function (k) {
        var c = ctx.col[k];
        if (c < 0 || launchText_(ctx.values[r][c]) === want[k]) return;
        changes.push({ r: r + 1, c: c + 1, v: want[k] });
        fields.push(String(ctx.values[0][c]));
      });
      if (fields.length) log.push(['Запуск: точку оновлено', name, '', fields.join(', ')]);
    }
    launchWriteCells_(ctx.sheet, changes);
    pointsMemo_ = null;
    launchLog_(log);
    return true;
  },

  /** Тестовые заказы — в «Тестові замовлення (архів)» и прочь из «Замовлення»; «Кошики» и «Події» очищаются. Делается один раз. */
  testdata: function (run) {
    var props = scriptProps_();
    if (String(propRead_(props, PROP_LAUNCH_TESTDATA, true) || '')) return true;
    var log = [];
    var orders = run.ss.getSheetByName(SHEET_ORDERS);
    if (orders && orders.getLastRow() > 1) {
      var width = orders.getLastColumn();
      var head = orders.getRange(1, 1, 1, width).getValues()[0];
      var col = orderCols_(orders, head);
      var values = orders.getRange(2, 1, orders.getLastRow() - 1, width).getValues();
      var keepSheet = run.ss.getSheetByName(SHEET_TEST_ORDERS);
      if (!keepSheet) {
        keepSheet = run.ss.insertSheet(SHEET_TEST_ORDERS);
        launchRoom_(keepSheet, 1, width);
        keepSheet.getRange(1, 1, 1, width).setValues([head]).setFontWeight('bold');
        keepSheet.setFrozenRows(1);
      }
      var saved = {};
      if (keepSheet.getLastRow() > 1) keepSheet.getRange(2, col.num + 1, keepSheet.getLastRow() - 1, 1).getValues().forEach(function (v) { saved[String(v[0])] = true; });
      var copy = [], drop = [], floor = parseInt(propRead_(props, PROP_ORDER_FLOOR, true), 10) || 0;
      values.forEach(function (row, i) {
        var n = launchOrderNum_(row[col.num]);
        if (!n || n < LAUNCH_TEST_ORDERS.from || n > LAUNCH_TEST_ORDERS.to) return;
        floor = Math.max(floor, n);
        drop.push(i + 2);
        if (!saved[String(row[col.num])]) copy.push(row.map(keepCell_));
        log.push(['Запуск: тестове замовлення прибрано', row[col.num], launchText_(row[col.status]), 'у «' + SHEET_TEST_ORDERS + '»']);
      });
      // Счётчик номеров запоминается ДО удаления строк: новый заказ не получит номер тестового даже при обрыве.
      if (floor > 0) props.setProperty(PROP_ORDER_FLOOR, String(floor));
      if (copy.length) {
        launchRoom_(keepSheet, keepSheet.getLastRow() + copy.length, width);
        keepSheet.getRange(keepSheet.getLastRow() + 1, 1, copy.length, width).setValues(copy);
        SpreadsheetApp.flush();
      }
      var i = drop.length - 1;
      while (i >= 0) {
        var end = drop[i], start = end;
        while (i > 0 && drop[i - 1] === start - 1) { i--; start = drop[i]; }
        // Последнюю строку под закреплённым заголовком удалить нельзя — её содержимое просто очищается.
        if (start === 2 && end === orders.getLastRow() && orders.getMaxRows && orders.getMaxRows() === end) orders.getRange(start, 1, end - start + 1, width).clearContent();
        else orders.deleteRows(start, end - start + 1);
        i--;
      }
    }
    [SHEET_CARTS, SHEET_EVENTS].forEach(function (name) {
      var sheet = run.ss.getSheetByName(name);
      var n = sheet ? sheet.getLastRow() - 1 : 0;
      if (n > 0) {
        sheet.getRange(2, 1, n, sheet.getLastColumn()).clearContent();
        log.push(['Запуск: очищено аркуш', name, n + ' рядків', 'порожньо']);
      }
    });
    props.setProperty(PROP_LAUNCH_TESTDATA, launchDay_('dd.MM.yyyy'));
    launchLog_(log);
    return true;
  },

  /** Кэш каталога сбрасывается: витрина сразу видит новое. «Статистика» пересчитывается в launchApply_ после снятия блокировки. */
  finish: function () {
    clearCatalogCache_();
    return true;
  }
};
