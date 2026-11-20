/**
 * PAMIR — этап 9, выпуск Б4, пункт 3: меню PAMIR → «Очистити тестові дані перед відкриттям».
 *
 * Порядок (каждый шаг можно повторить; до слова «ОЧИСТИТИ» таблица только читается):
 *   0. План: что будет очищено (листы и число строк), что не будет. Окно с вводом слова. Не то слово / «Скасувати» — «Нічого не змінено».
 *   1. Копия всей таблицы в папку BACKUP_FOLDER_ID, имя «PAMIR — до очищення <дата час>». Папка берётся ТОЛЬКО по сохранённому id
 *      (новая не создаётся). Копия открывается и сверяется: те же листы, строк не меньше. Не сошлось — очистки нет.
 *      Имя копии не начинается с BACKUP_PREFIX, поэтому недельная чистка «хранить 8» (backupNow_) её никогда не удаляет.
 *   2. Под блокировкой скрипта (не взялась — отказ): последний выданный номер заказа → ORDER_LAST_NUM (максимум из «Замовлення»,
 *      «Тестові замовлення (архів)», ORDER_NUM_FLOOR и уже сохранённого ORDER_LAST_NUM), затем очистка строк данных (clearContent: заголовки, оформление,
 *      проверки данных и закреплённая строка остаются; сам лист не удаляется), затем client_data_version.
 *      Если с момента копии в очищаемых листах появились новые строки — отказ до первой записи: копия уже не полная.
 *   3. После блокировки: кэши (только перечисленные ключи), каталог, Worker (/purge), «Статистика» пересчитывается, журнал, админам одно сообщение.
 * Script Properties не удаляются вообще: тестовых данных в них нет (счётчики подарков, «Пригости друга» и «Перше замовлення» считаются
 * прямо по листам «Замовлення» и «Запрошення»; буферы ошибок и событий живут в кэше). Меняются только ORDER_LAST_NUM (вверх)
 * и служебная отметка CLEAN_TESTDATA_STATE («очистка начата, не доведена до конца»: по ней повторный запуск дорабатывает остаток).
 * НЕ трогаются: «Товари», «Категорії», «Рецепти», «Синоніми», «Налаштування» (кроме строки client_data_version), «Архів товарів», «Кеш НП»,
 * «Адміни», «Журнал», «Точки», а также не названные владельцем «Кошики», «Відгуки», «Розсилки», «Оптові клієнти» — они только считаются в отчёте.
 */

var CLEAN_WORD = 'ОЧИСТИТИ';
var CLEAN_BACKUP_PREFIX = 'PAMIR — до очищення ';   // не совпадает с BACKUP_PREFIX: недельная чистка копий эти файлы не видит
var CLEAN_STATE_PROP = 'CLEAN_TESTDATA_STATE';       // JSON { at, backup }: очистка начата и не закончена
var CLEAN_CDV_KEY = 'client_data_version';
var CLEAN_LOCK_MS = 30000;

function cleanMenu_(menu) {
  return menu.addSeparator().addItem('Очистити тестові дані перед відкриттям', 'menuCleanTestData');
}

/** Листы, у которых очищаются строки данных: [название, число строк шапки, которое остаётся]. */
function cleanTargets_() {
  return [[SHEET_ORDERS, 1], [SHEET_CLIENTS, 1], [SHEET_EVENTS, 1], [SHEET_STATS, 5], [SHEET_SUBS, 1], [SHEET_INVITES, 1], [SHEET_WH_APPS, 1], [SHEET_TEST_ORDERS, 1]];
}

/** Листы с данными покупателей, которых владелец в задании не назвал: не очищаются, в отчёте считаются отдельной строкой. */
function cleanNotNamed_() {
  return [SHEET_CARTS, SHEET_REVIEWS, SHEET_MAIL, SHEET_WH_CLIENTS];
}

/** Листы и свойства, которые не меняются никогда (для окна и отчёта). */
function cleanKeepText_() {
  return '«' + SHEET_PRODUCTS + '», «' + SHEET_CATEGORIES + '», «' + SHEET_RECIPES + '», «' + SHEET_SYN + '», «' + SHEET_SETTINGS + '» (крім рядка ' + CLEAN_CDV_KEY +
    '), «' + SHEET_ARCHIVE + '», «Кеш НП», «' + SHEET_ADMINS + '» і права, «' + SHEET_LOG + '», «' + SHEET_POINTS + '», усі ключі й токени.';
}

function cleanTz_(ss) {
  var tz = '';
  try { tz = ss.getSpreadsheetTimeZone(); } catch (err) { tz = ''; }
  return tz || 'Europe/Kiev';
}

function cleanPad_(n) {
  var s = String(n);
  while (s.length < 4) s = '0' + s;
  return 'P-' + s; // тот же формат, что у nextOrderNumber_
}

function cleanRows_(sheet, head) {
  return sheet ? Math.max(0, sheet.getLastRow() - head) : 0;
}

/** Наибольший номер заказа из листа (колонка «№» ищется по заголовку). Нет строк — 0. Нет колонки при наличии строк — исключение. */
function cleanSheetMaxNum_(sheet) {
  if (!sheet || sheet.getLastRow() < 2) return 0;
  var head = sheet.getRange(1, 1, 1, Math.max(1, sheet.getLastColumn())).getValues()[0];
  var col = mapHeaders_(head, ORDER_COLS);
  if (col.num < 0) throw new Error('no_num_col');
  var max = 0;
  sheet.getRange(2, col.num + 1, sheet.getLastRow() - 1, 1).getValues().forEach(function (r) {
    var m = String(r[0]).trim().match(/^P-(\d+)$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  });
  return max;
}

/** Последний выданный номер: максимум из сохранённого ORDER_NUM_FLOOR, «Замовлення» и архива тестовых заказов. */
function cleanLastNum_(ss, props) {
  var max = Math.max(0, parseInt(propRead_(props, PROP_ORDER_FLOOR, true), 10) || 0, parseInt(propRead_(props, PROP_ORDER_LAST, true), 10) || 0);
  [SHEET_ORDERS, SHEET_TEST_ORDERS].forEach(function (n) { max = Math.max(max, cleanSheetMaxNum_(ss.getSheetByName(n))); });
  return max;
}

/** Только чтение. { sheets:[{name,head,rows,exists}], kept:[{name,rows}], total, last, next, running, error } */
function cleanPlan_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var props = scriptProps_();
  var plan = { sheets: [], kept: [], total: 0, last: 0, next: '', running: false, error: '' };
  cleanTargets_().forEach(function (t) {
    var sh = ss.getSheetByName(t[0]);
    var n = cleanRows_(sh, t[1]);
    plan.sheets.push({ name: t[0], head: t[1], rows: n, exists: !!sh });
    plan.total += n;
  });
  cleanNotNamed_().forEach(function (name) {
    var sh = ss.getSheetByName(name);
    var n = cleanRows_(sh, 1);
    if (n > 0) plan.kept.push({ name: name, rows: n });
  });
  try { plan.last = cleanLastNum_(ss, props); } catch (err) { plan.error = 'У листі замовлень не знайдено колонку «№». Нічого не змінено.'; }
  plan.next = cleanPad_(plan.last + 1);
  plan.running = !!String(propRead_(props, CLEAN_STATE_PROP, true) || '');
  return plan;
}

function cleanPlanText_(plan) {
  var lines = ['Буде очищено (заголовки лишаються):'];
  plan.sheets.forEach(function (s) { if (s.exists) lines.push('  • «' + s.name + '» — ' + s.rows + ' рядків'); });
  lines.push('Усього рядків: ' + plan.total + '. Також: буфери помилок і подій у кеші, кеш каталогу.');
  lines.push('');
  lines.push('НЕ буде чіпатися: ' + cleanKeepText_());
  if (plan.kept.length) {
    lines.push('Не очищується (не було у списку): ' + plan.kept.map(function (k) { return '«' + k.name + '» — ' + k.rows + ' рядків'; }).join(', ') + '.');
  }
  lines.push('Нумерація замовлень продовжиться: наступне ' + plan.next + '.');
  lines.push('Спочатку буде зроблено повну копію таблиці в папку резервних копій; без копії очищення не піде.');
  lines.push('');
  lines.push('Щоб очистити, введіть слово ' + CLEAN_WORD + ' (великими літерами, кирилицею) і натисніть OK.');
  lines.push('Чтобы очистить, введите слово ' + CLEAN_WORD + ' (заглавными, кириллицей).');
  return lines.join('\n');
}

/** Пункт меню. Возвращает { ok, ... } (для тестов); всё, что видит владелец, — в окнах. */
function menuCleanTestData() {
  var ui = SpreadsheetApp.getUi();
  var plan;
  try { plan = cleanPlan_(); } catch (err) {
    console.error('clean: ' + safeErr_(err));
    ui.alert('Не вдалося прочитати таблицю. Нічого не змінено.\nНе удалось прочитать таблицу. Ничего не изменено.');
    return { ok: false, error: 'read' };
  }
  if (plan.error) { ui.alert(plan.error); return { ok: false, error: 'plan' }; }
  if (plan.total === 0 && !plan.running) {
    ui.alert('Нема чого очищати: в усіх аркушах зі списку немає рядків даних. Нічого не змінено.\nОчищать нечего, ничего не изменено.');
    return { ok: true, nothing: true };
  }
  var resp = ui.prompt('Очищення тестових даних', cleanPlanText_(plan), ui.ButtonSet.OK_CANCEL);
  var word = resp && resp.getSelectedButton() === ui.Button.OK ? String(resp.getResponseText() || '').trim() : '';
  if (word !== CLEAN_WORD) { // только точное слово: латинские похожие буквы, другой регистр, пустая строка и «Скасувати» не проходят
    ui.alert('Нічого не змінено.\nНичего не изменено.');
    return { ok: false, cancelled: true };
  }
  var res = cleanRun_(plan);
  ui.alert(res.text);
  return res;
}

/** Копия таблицы и проверка. { ok, name, url, id, copy:{лист:строк} } или { ok:false, code, text }. */
function cleanBackup_(ss) {
  function fail(code, text) { return { ok: false, code: code, text: text }; }
  var id = String(scriptProps_().getProperty('BACKUP_FOLDER_ID') || '').trim();
  if (!id) return fail('no_folder', 'Не задано папку резервних копій (BACKUP_FOLDER_ID). Спочатку: меню PAMIR → «Зробити копію зараз». Без копії очищення не йде, нічого не змінено.\nНет папки резервных копий — очистка не выполняется.');
  var folder = null;
  try { folder = DriveApp.getFolderById(id); if (!folder || (folder.isTrashed && folder.isTrashed())) folder = null; } catch (err) { folder = null; }
  if (!folder) return fail('bad_folder', 'Папка резервних копій недоступна (видалена або немає доступу). Без копії очищення не йде, нічого не змінено.\nПапка копий недоступна — очистка не выполняется.');
  var before = {};
  ss.getSheets().forEach(function (sh) { before[sh.getName()] = sh.getLastRow(); });
  var name = CLEAN_BACKUP_PREFIX + Utilities.formatDate(new Date(), 'Europe/Kiev', 'yyyy-MM-dd HH:mm');
  var file;
  try { file = DriveApp.getFileById(ss.getId()).makeCopy(name, folder); } catch (err2) {
    console.error('clean backup: ' + safeErr_(err2));
    return fail('copy', 'Не вдалося зробити копію таблиці. Без копії очищення не йде, нічого не змінено.\nНе удалось сделать копию — очистка не выполняется.');
  }
  var copy, bad = [];
  try {
    copy = SpreadsheetApp.openById(file.getId());
    var have = {};
    copy.getSheets().forEach(function (sh) { have[sh.getName()] = sh; });
    Object.keys(before).forEach(function (n) {
      if (!have[n]) bad.push(n + ' (немає)');
      else if (have[n].getLastRow() < before[n]) bad.push(n + ' (' + have[n].getLastRow() + ' з ' + before[n] + ')');
    });
  } catch (err3) {
    console.error('clean backup verify: ' + safeErr_(err3));
    return fail('verify', 'Копію створено («' + name + '»), але перевірити її не вдалося. Очищення не йде, нічого не змінено.\nКопию не удалось проверить — очистка не выполняется.');
  }
  if (bad.length) return fail('mismatch', 'Копію створено («' + name + '»), але вона не збігається з таблицею: ' + bad.slice(0, 6).join(', ') + '. Очищення не йде, нічого не змінено.\nКопия не совпала с таблицей — очистка не выполняется.');
  var url = 'https://docs.google.com/spreadsheets/d/' + file.getId() + '/edit';
  try { if (file.getUrl) url = file.getUrl() || url; } catch (err4) { /* ссылка по id */ }
  return { ok: true, name: name, url: url, id: file.getId(), copy: before };
}

/** Строки данных одного листа — одним вызовом. Возвращает, сколько строк было. «Статистика»: строки 1–3 (итоги) и 6+, строки 4–5 остаются. */
function cleanOneSheet_(sheet, head) {
  var last = sheet.getLastRow();
  var n = Math.max(0, last - head);
  if (!n) return 0;
  var cols = Math.max(1, sheet.getLastColumn());
  if (head > 1) sheet.getRange(1, 1, 3, cols).clearContent(); // итоги «Статистики» с тестовыми числами
  sheet.getRange(head + 1, 1, last - head, cols).clearContent();
  return n;
}

/** Настройка client_data_version в «Налаштування»: строка находится по ключу (последняя из совпавших) или добавляется. */
function cleanSetCdv_(ss, value) {
  var sheet = ss.getSheetByName(SHEET_SETTINGS);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_SETTINGS);
    sheet.getRange(1, 1, 1, 3).setValues([['Ключ', 'Значення', 'Опис']]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  var desc = '';
  SETTINGS_DEF.forEach(function (d) { if (d[0] === CLEAN_CDV_KEY) desc = d[1]; });
  var at = 0, last = sheet.getLastRow();
  if (last > 1) {
    sheet.getRange(2, 1, last - 1, 1).getValues().forEach(function (r, i) { if (String(r[0]).trim() === CLEAN_CDV_KEY) at = i + 2; });
  }
  if (!at) { sheet.appendRow([CLEAN_CDV_KEY, '', desc]); at = sheet.getLastRow(); }
  sheet.getRange(at, 2).setNumberFormat('@').setValue(value); // текстом: таблица не превратит «2026-11-21T10:15» в дату
  settingsMemo_ = null;
}

/** Кэши, связанные с очищаемыми данными. Только перечисленные ключи; возвращает названия для отчёта. */
function cleanCaches_(uids) {
  var done = [];
  var cache = CacheService.getScriptCache();
  var keys = [];
  uids.forEach(function (u) { keys.push('cl_' + u, 'cls_' + u); }); // «клиента недавно видели»: иначе вернувшийся клиент не попал бы в пустой лист «Клієнти»
  keys.push('er_buf', 'fb_fail', 'fb_gap', 'fb_lost');
  try {
    if (typeof slotMinutes_ === 'function' && typeof slotRead_ === 'function') {
      var cur = Math.floor(Date.now() / 60000);
      var mins = slotMinutes_(cache, 'fx_', cur - ERR_SLOT_LOOKBACK, cur);
      if (mins.length) {
        slotRead_(cache, 'fx_', mins).keys.forEach(function (k) { keys.push(k); });
        mins.forEach(function (m) { keys.push('fx_m_' + m); });
      }
    }
  } catch (err) { console.warn('clean: fx slots'); }
  for (var i = 0; i < keys.length; i += 100) cache.removeAll(keys.slice(i, i + 100));
  done.push('буфер і лічильники помилок (er_buf, fx_, fb_fail, fb_gap, fb_lost)');
  if (uids.length) done.push('мітки «клієнта щойно бачили» (cl_, cls_): ' + uids.length);
  try { if (typeof catalogDropSignals_ === 'function') catalogDropSignals_(); done.push('кеш сигналів каталогу (популярне, оцінки)'); } catch (err2) { /* не критично */ }
  return done;
}

function cleanNotifyAdmins_(text) {
  try {
    var props = scriptProps_();
    var token = props.getProperty('BOT_TOKEN');
    if (!token || typeof activeAdminIds_ !== 'function') return 0;
    var ids = activeAdminIds_(props);
    ids.forEach(function (id) { tg_(token, 'sendMessage', { chat_id: id, text: text }); });
    return ids.length;
  } catch (err) { return 0; }
}

/**
 * Копия → блокировка → очистка. plan — результат cleanPlan_(). Возвращает { ok, text, ... }.
 * Любое исключение после начала записи: данные в копии, повторный запуск доводит дело (отметка CLEAN_TESTDATA_STATE).
 */
function cleanRun_(plan) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var props = scriptProps_();
  var tz = cleanTz_(ss);
  // Буфер событий (быстрый режим) дописывается ДО копии: иначе тестовые события упали бы в пустой лист уже после очистки.
  try { if (typeof flushBuffer_ === 'function') flushBuffer_(2000); } catch (errF) { /* не критично */ }
  var bk = cleanBackup_(ss);
  if (!bk.ok) return { ok: false, error: bk.code, text: bk.text };

  var lock = LockService.getScriptLock();
  var got = false;
  try { got = lock.tryLock(CLEAN_LOCK_MS); } catch (errL) { got = false; }
  if (!got) return { ok: false, error: 'busy', backup: bk.name, text: 'Таблицю зараз змінює інша дія (замовлення чи інший запуск). Нічого не змінено — спробуйте ще раз за хвилину.\nКопія вже є: ' + bk.name + '\nТаблица занята, ничего не изменено.' };

  var res = { ok: false, rows: {}, kept: [], backup: bk.name, url: bk.url };
  var uids = [];
  var cdv = '';
  try {
    // 1. Копия уже не полная, если в очищаемых листах появились строки после неё: отказ до первой записи.
    var grew = [];
    plan.sheets.forEach(function (s) {
      var sh = ss.getSheetByName(s.name);
      if (sh && bk.copy[s.name] !== undefined && sh.getLastRow() > bk.copy[s.name]) grew.push(s.name);
    });
    if (grew.length) {
      return { ok: false, error: 'changed', backup: bk.name, text: 'Під час копіювання в таблиці з’явилися нові рядки («' + grew.join('», «') + '»). Нічого не очищено — запустіть ще раз.\nПока копировалось, появились новые строки — ничего не очищено, запустите ещё раз.' };
    }
    // 2. Номер последнего заказа — ДО очистки; записано и прочитано обратно.
    var last = cleanLastNum_(ss, props);
    var cur = parseInt(propRead_(props, PROP_ORDER_LAST, true), 10) || 0;
    if (last > cur) props.setProperty(PROP_ORDER_LAST, String(last));
    var back = parseInt(propRead_(props, PROP_ORDER_LAST, true), 10) || 0;
    if (back < last) return { ok: false, error: 'floor', backup: bk.name, text: 'Не вдалося зберегти номер останнього замовлення. Нічого не очищено.\nНе удалось сохранить номер последнего заказа, ничего не очищено.' };
    res.last = Math.max(last, back);
    res.next = cleanPad_(res.last + 1);
    props.setProperty(CLEAN_STATE_PROP, JSON.stringify({ at: Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH:mm'), backup: bk.name }));
    // Клиенты, у которых позже сбрасываются метки в кэше.
    var cl = ss.getSheetByName(SHEET_CLIENTS);
    if (cl && cl.getLastRow() > 1) cl.getRange(2, 1, cl.getLastRow() - 1, 1).getValues().forEach(function (r) { var u = String(r[0]).trim(); if (/^\d+$/.test(u)) uids.push(u); });
    // 3. Очистка: по одному листу, каждый — одной операцией.
    plan.sheets.forEach(function (s) {
      var sh = ss.getSheetByName(s.name);
      if (!sh) return;
      res.rows[s.name] = cleanOneSheet_(sh, s.head);
    });
    SpreadsheetApp.flush();
    // 4. Версия данных на телефонах.
    var now = new Date();
    cdv = cdvClean_(Utilities.formatDate(now, tz, 'yyyy-MM-dd') + 'T' + Utilities.formatDate(now, tz, 'HH:mm'));
    cleanSetCdv_(ss, cdv);
    SpreadsheetApp.flush();
  } catch (err) {
    console.error('clean: ' + safeErr_(err));
    return { ok: false, error: 'interrupted', rows: res.rows, backup: bk.name, url: bk.url,
      text: 'Очищення перервано. Дані є в копії «' + bk.name + '». Запустіть пункт меню ще раз — він дочистить решту.\nОчистка прервана, данные в копии; запустите пункт ещё раз.' };
  } finally {
    try { lock.releaseLock(); } catch (errU) { /* уже снята */ }
  }

  // После блокировки: кэши, каталог, Worker, статистика. Сбой здесь не отменяет очистку: отметка «начато» остаётся, повторный запуск дорабатывает.
  var cacheDone = [], post = true;
  try {
    cacheDone = cleanCaches_(uids);
    clearCatalogCache_(); // + catalogMarkDirty_: следующий запрос пересоберёт каталог уже с shop.cdv
    if (typeof purgeWorkerIfPending_ === 'function') purgeWorkerIfPending_();
    cacheDone.push('кеш каталогу (витрина одразу отримає нову версію даних)');
  } catch (err2) {
    post = false;
    console.error('clean post: ' + safeErr_(err2));
  }
  var statsOk = true;
  try { if (ss.getSheetByName(SHEET_STATS)) salesStats_(true); } catch (err3) { statsOk = false; console.warn('clean stats: ' + safeErr_(err3)); }
  if (post) { try { props.setProperty(CLEAN_STATE_PROP, ''); } catch (err4) { /* повторный запуск просто ничего не найдёт */ } }

  var total = 0;
  Object.keys(res.rows).forEach(function (n) { total += res.rows[n]; });
  var lines = ['Тестові дані очищено.', ''];
  plan.sheets.forEach(function (s) { if (res.rows[s.name] !== undefined) lines.push('«' + s.name + '»: очищено ' + res.rows[s.name] + ' рядків'); });
  lines.push('Усього: ' + total + ' рядків.', '');
  lines.push('У кеші очищено: ' + (cacheDone.length ? cacheDone.join('; ') : 'не вдалося (повторіть запуск)') + '.');
  lines.push('Властивості скрипта: тестових даних там немає, нічого не видалено (лічильники подарунків, «Пригости друга» і «Перше замовлення» рахуються по аркушах, очищених вище). Оновлено лише ORDER_LAST_NUM (номер останнього замовлення).');
  lines.push('Мітки розсилок і нагадань: у колонках аркушів «Клієнти» і «Замовлення» (службова), очищені разом з рядками.');
  var kept = [];
  cleanNotNamed_().forEach(function (name) {
    var n = cleanRows_(ss.getSheetByName(name), 1);
    if (n > 0) kept.push('«' + name + '» — ' + n + ' рядків');
  });
  res.kept = kept;
  lines.push('Не очищено (не було у списку): ' + (kept.length ? kept.join(', ') : 'немає даних') + '. Питання до власника: чи очищати їх теж.');
  lines.push('Не чіпали: ' + cleanKeepText_());
  lines.push('Наступне замовлення: ' + res.next + '.');
  lines.push('Версія даних на телефонах (' + CLEAN_CDV_KEY + '): ' + cdv + '.');
  if (!statsOk) lines.push('Аркуш «' + SHEET_STATS + '» не оновився: натисніть PAMIR → «Оновити статистику продажів».');
  lines.push('Копія до очищення: «' + bk.name + '»', bk.url);
  lines.push('', 'Очищено ' + total + ' строк, следующий заказ ' + res.next + '. Копия: ' + bk.name + '.');
  res.text = lines.join('\n');
  res.ok = post;
  res.total = total;
  res.cdv = cdv;
  try { logAction_('Очищення тестових даних', 'рядків: ' + total + ', наступний ' + res.next, '', 'копія: ' + bk.name + '; ' + CLEAN_CDV_KEY + ' ' + cdv); } catch (err5) { console.warn('clean: log'); }
  cleanNotifyAdmins_('Тестові дані очищено (' + total + ' рядків). Наступне замовлення: ' + res.next + '. Копія збережена в папці резервних копій.\nТестовые данные очищены (' + total + ' строк), следующий заказ ' + res.next + '. Копия сохранена.');
  return res;
}
