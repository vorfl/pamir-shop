/**
 * PAMIR — волна Б2, блок 1: пункт меню «PAMIR → Етап 9Б2: записати другі фото».
 *
 * Создаёт необязательную колонку «Фото 2» в листе «Товари» (если её нет) и пишет в неё адрес второго фото
 * строго для товаров из списка S9B2_PHOTO2_IDS. Заполненную ячейку не трогает, товара нет в таблице — пропускает.
 * Повторный запуск ничего не меняет. Запись — под LockService.
 */

var S9B2_PHOTO2_BASE = 'https://vorfl.github.io/pamir-shop/webapp/img/products/p/';

var S9B2_PHOTO2_IDS = [
  'DRY-017', 'DRY-018', 'DRY-019', 'NEW-arahis-syryi', 'NEW-funduk-smazhenyi-blanshovanyi',
  'NEW-mygdalevi-plastivtsi', 'NEW-tsukaty-dribni', 'NEW-tsukaty', 'NUT-013', 'NUT-014', 'NUT-018',
  'NUT-019', 'NUT-026', 'NUT-028', 'NUT-030', 'NUT-036', 'NUT-040', 'NUT-045', 'NUT-047'
];

/** Запрет: этим товарам второе фото не пишется никогда (на них нет подходящего фото страницы). */
var S9B2_PHOTO2_FORBIDDEN = [
  'DRY-039', 'DRY-089', 'DRY-090', 'DRY-068', 'DRY-086', 'NEW-yabluka-sushka',
  'NEW-sochevytsya-chervona', 'NUT-048', 'NEW-garbuzove-golonasinne'
];

function stage9b2Menu_(menu) {
  return menu.addItem('Етап 9Б2: записати другі фото', 'stage9b2Photos')
    .addItem('Етап 9Б2: налаштувати', 'stage9b2Setup');
}

/* ======================= «Етап 9Б2: налаштувати»: список шагов ======================= */

var S9B2_SET_COL = 'Склад набору';
var S9B2_SETS = [
  ['SET-001', 'SPS-001, SPS-006, SPS-007'],
  ['SET-002', 'SPS-003, SPS-021, SPS-024'],
  ['SET-003', 'SPS-012, SPS-009, SPS-014, SPS-010']
];
/** Настройки блока «подсказка в корзине»: [ключ, значение, описание]. Добавляются в «Налаштування», только если ключа там ещё нет. */
var S9B2_SETTINGS = ['hint_tag', 'hint_id', 'hint_text_ua', 'hint_text_ru'];

/**
 * Шаги меню. Каждый шаг: function (ss) → { changed: число записанного, text: строка для отчёта }.
 * Шаг идемпотентен и вызывается под общей блокировкой. В следующих блоках новые шаги добавляются в конец списка.
 */
var S9B2_STEPS = [
  { name: 'Склад набору', run: function (ss) { return s9b2StepSets_(ss); } },
  { name: 'Налаштування підказки', run: function (ss) { return s9b2StepSettings_(ss, S9B2_SETTINGS); } },
  { name: 'Налаштування після замовлення і зведення', run: function (ss) { return s9b2StepSettings_(ss, S9B2_SETTINGS_B3, S9B2_SETTING_VALUES); } },
  { name: 'Аркуш Синоніми', run: function (ss) { return s9b2StepSyn_(ss); } },
  { name: 'Колонка Якщо немає', run: function (ss) { return s9b2StepIfOut_(ss); } }
];

function s9b2Norm_(v) { return String(v === null || v === undefined ? '' : v).replace(/\s+/g, ' ').trim(); }

/** Колонка «Склад набору» (создать, если нет) и состав SET-001…003 — только в пустые ячейки. */
function s9b2StepSets_(ss) {
  var sheet = ss.getSheetByName(SHEET_PRODUCTS);
  if (!sheet) throw new Error('Не знайдено аркуш «' + SHEET_PRODUCTS + '»');
  var values = sheet.getDataRange().getValues();
  var head = values[0] || [];
  var idCol = -1, setCol = -1;
  head.forEach(function (h, i) {
    var n = s9b2Norm_(h).toLowerCase();
    if (idCol < 0 && n === 'id') idCol = i;
    if (setCol < 0 && n === S9B2_SET_COL.toLowerCase()) setCol = i;
  });
  if (idCol < 0) throw new Error('Немає колонки ID');
  var created = false;
  if (setCol < 0) {
    setCol = head.length;
    s9Room_(sheet, sheet.getLastRow(), setCol + 1);
    sheet.getRange(1, setCol + 1).setValue(S9B2_SET_COL).setFontWeight('bold');
    created = true;
  }
  var rowOf = {};
  for (var r = 1; r < values.length; r++) {
    var id = s9b2Norm_(values[r][idCol]);
    if (id && rowOf[id] === undefined) rowOf[id] = r;
  }
  var written = 0, had = 0, missing = [];
  S9B2_SETS.forEach(function (s) {
    if (rowOf[s[0]] === undefined) { missing.push(s[0]); return; }
    if (s9b2Norm_(values[rowOf[s[0]]][setCol]) !== '') { had++; return; }
    sheet.getRange(rowOf[s[0]] + 1, setCol + 1).setValue(s[1]);
    written++;
  });
  return {
    changed: written + (created ? 1 : 0),
    text: 'Склад наборів: записано ' + written + ', уже було ' + had + ', немає в таблиці ' + missing.length +
      (missing.length ? ' (' + missing.join(', ') + ')' : '') + '.' + (created ? ' Колонку «' + S9B2_SET_COL + '» створено.' : '')
  };
}

/** Додає в «Налаштування» ключі, яких там ще немає (значення за замовчуванням з SETTINGS_DEF). Наявні значення не чіпає. */
function s9b2StepSettings_(ss, keys, values) {
  var sheet = ss.getSheetByName(SHEET_SETTINGS);
  if (!sheet) return { changed: 0, text: 'Аркуша «' + SHEET_SETTINGS + '» ще немає: діють значення за замовчуванням.' };
  var have = {};
  sheet.getDataRange().getValues().forEach(function (row, i) { var k = s9b2Norm_(row[0]); if (i > 0 && k) have[k] = true; });
  var add = [];
  keys.forEach(function (k) {
    if (have[k]) return;
    SETTINGS_DEF.forEach(function (d) { if (d[0] === k) add.push([k, values && values[k] !== undefined ? values[k] : d[2], d[1]]); });
  });
  if (add.length) {
    var at = sheet.getLastRow() + 1;
    s9Room_(sheet, at + add.length - 1, 3);
    sheet.getRange(at, 1, add.length, 3).setValues(add.map(function (x) { return [x[0], safeCell_(x[1]), x[2]]; }));
  }
  return { changed: add.length, text: 'Налаштування: додано ' + add.length + ', уже було ' + (keys.length - add.length) + '.' };
}

function stage9b2Setup() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    var busy = 'Зараз таблицю змінює інша дія. Зачекайте хвилину й натисніть ще раз.';
    s9Alert_(busy);
    return { ok: false, error: 'busy', message: busy };
  }
  var changed = 0, texts = [];
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    S9B2_STEPS.forEach(function (step) {
      var res = step.run(ss);
      changed += res.changed || 0;
      texts.push(res.text);
    });
    SpreadsheetApp.flush();
    if (changed) { settingsMemo_ = null; clearCatalogCache_(); }
  } catch (err) {
    console.error('stage9b2 setup: ' + safeErr_(err, true));
    lock.releaseLock();
    var fail = 'Помилка: ' + safeErr_(err) + '. Повторний запуск безпечний.';
    s9Alert_(fail);
    return { ok: false, error: 'fail', message: fail };
  }
  lock.releaseLock();
  if (changed && typeof purgeWorkerIfPending_ === 'function') purgeWorkerIfPending_();
  var text = texts.join('\n');
  s9Alert_(text);
  return { ok: true, message: text, changed: changed };
}

function stage9b2Photos() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    var busy = 'Зараз таблицю змінює інша дія. Зачекайте хвилину й натисніть ще раз.';
    s9Alert_(busy);
    return { ok: false, error: 'busy', message: busy };
  }
  var written = 0, had = 0, missing = [], created = false;
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_PRODUCTS);
    if (!sheet) throw new Error('Не знайдено аркуш «' + SHEET_PRODUCTS + '»');
    var values = sheet.getDataRange().getValues();
    var head = values[0] || [];
    var idCol = -1, p2 = -1;
    head.forEach(function (h, i) {
      var n = String(h || '').replace(/\s+/g, ' ').trim().toLowerCase();
      if (idCol < 0 && n === 'id') idCol = i;
      if (p2 < 0 && n === 'фото 2') p2 = i;
    });
    if (idCol < 0) throw new Error('Немає колонки ID');
    if (p2 < 0) {
      p2 = head.length;
      sheet.getRange(1, p2 + 1).setValue('Фото 2').setFontWeight('bold');
      created = true;
    }
    var rowOf = {};
    for (var r = 1; r < values.length; r++) {
      var id = String(values[r][idCol] === null || values[r][idCol] === undefined ? '' : values[r][idCol]).trim();
      if (id && rowOf[id] === undefined) rowOf[id] = r;
    }
    S9B2_PHOTO2_IDS.forEach(function (pid) {
      if (S9B2_PHOTO2_FORBIDDEN.indexOf(pid) >= 0) return;
      if (rowOf[pid] === undefined) { missing.push(pid); return; }
      var cur = values[rowOf[pid]][p2];
      if (String(cur === null || cur === undefined ? '' : cur).trim() !== '') { had++; return; }
      sheet.getRange(rowOf[pid] + 1, p2 + 1).setValue(S9B2_PHOTO2_BASE + pid + '.webp');
      written++;
    });
    SpreadsheetApp.flush();
    if (written || created) clearCatalogCache_();
  } catch (err) {
    console.error('stage9b2: ' + safeErr_(err, true));
    lock.releaseLock();
    var fail = 'Помилка: ' + safeErr_(err) + '. Повторний запуск безпечний.';
    s9Alert_(fail);
    return { ok: false, error: 'fail', message: fail };
  }
  lock.releaseLock();
  if (typeof purgeWorkerIfPending_ === 'function') purgeWorkerIfPending_();
  var text = 'Другі фото: записано ' + written + ', уже було ' + had + ', не знайдено в таблиці ' + missing.length +
    (missing.length ? ' (' + missing.join(', ') + ')' : '') + '.' + (created ? ' Колонку «Фото 2» створено.' : '');
  s9Alert_(text);
  return { ok: true, message: text, written: written, had: had, missing: missing, created: created };
}

/* ======================================================================================================== */
/* Волна Б2, блок 3: сообщения после заказа (followup1 / followup2)                                          */
/* ======================================================================================================== */
/*
 * followup1_days — «Як вам замовлення?» через N дней после статуса «виконано» (svc.dn; нет — после даты заказа).
 * followup2_days — рецепт к купленному (или короткий текст из настроек) и кнопка «Повторити замовлення».
 * 0 или пусто — выключено. Отметки в «Службове» заказа: f1, f2 (один раз на заказ). Запуск из dailyJob.
 * Правила: не шлём, если срок наступил больше FU_WINDOW_DAYS назад (старые заказы не заваливаем), клиент отписался («Відписка»),
 * заблокировал бота, нажал «Більше не нагадувати», или ему уже писали не по заказу меньше FU_GAP_DAYS дней назад.
 * Общая отметка «писали не по заказу» — колонка «Останнє повідомлення» в «Клієнти» (необязательная, создаётся при первой записи);
 * рассылки отмечают клиента своей колонкой «Дата останньої розсилки», лимит смотрит на обе.
 */

var FU_WINDOW_DAYS = 3;      // срок давности: позже — пропускаем без отметки
var FU_GAP_DAYS = 14;        // между несервисными сообщениями одному клиенту
var FU_REPLY_DAYS = 7;       // сколько после followup1 ответ клиента пересылается админам
var FU_REPLY_MAX_FWD = 5;   // не больше 5 пересылок админам на клиента за окно
var FU_REPLY_MORE_SEC = 900; // после первой пересылки ещё 15 минут пересылаем следующие сообщения (клиент пишет в несколько строк)
var FU_MAX_RUN = 30;
var FU_DAY_MS = 24 * 3600 * 1000;
var FU_TEXT1 = {
  ua: 'Як вам замовлення? Якщо щось не так — напишіть нам, виправимо. А якщо сподобалося — будемо вдячні за кілька слів.',
  ru: 'Как вам заказ? Если что-то не так — напишите нам, исправим. А если понравилось — будем благодарны за пару слов.'
};
var FU_THANKS = { ua: 'Дякуємо, передали', ru: 'Спасибо, передали' };
var FU_APP_LINK_DEFAULT = 'https://t.me/pamir_spices_bot/shop';

/** Настройка «через сколько дней» → целое 1…max, иначе 0 (выключено). */
function fuDays_(v, max) {
  var n = Math.round(toNum_(v));
  return n >= 1 ? Math.min(n, max || 365) : 0;
}

function fuDate_(v) { return Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime()) ? v.getTime() : 0; }

/** Ссылка на Mini App без параметров: https://t.me/<бот>/<приложение>. Можно переопределить свойством MINIAPP_LINK (не секрет). */
function fuAppLink_() {
  var v = '';
  try { v = String(scriptProps_().getProperty('MINIAPP_LINK') || '').trim(); } catch (err) { v = ''; }
  return /^https:\/\/t\.me\/[A-Za-z0-9_]{4,32}\/[A-Za-z0-9_]{1,64}$/.test(v) ? v : FU_APP_LINK_DEFAULT;
}

/**
 * Параметр startapp для «Повторити замовлення»: re-<цифры номера>. Номер P-0012 → re-0012 (только A-Za-z0-9_-).
 * Номер другого вида (набран руками в таблице) → '' (кнопка тогда ведёт в «Мої замовлення»).
 */
function fuStartParam_(num) {
  var m = String(num || '').match(/^P-(\d{1,9})$/);
  return m ? 're-' + m[1] : '';
}

/** Лист «Клієнти» одним чтением: uid → { unsub, blocked, last (мс, последнее несервисное сообщение), wait, lang }. */
function fuClients_() {
  var map = {};
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_CLIENTS);
  if (!sheet || sheet.getLastRow() < 2) return map;
  var values = sheet.getDataRange().getValues();
  var col = mapHeaders_(values[0], CLIENT_COLS);
  if (col.id < 0) return map;
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    var uid = cell_(row, col.id);
    if (!/^\d+$/.test(uid) || map[uid]) continue;
    map[uid] = {
      unsub: !!cell_(row, col.unsub), blocked: !!cell_(row, col.blocked),
      last: Math.max(col.lastMsg >= 0 ? fuDate_(row[col.lastMsg]) : 0, col.mailAt >= 0 ? fuDate_(row[col.mailAt]) : 0),
      wait: col.fuWait >= 0 ? cell_(row, col.fuWait) : '', lang: cell_(row, col.lang) === 'ru' ? 'ru' : 'ua'
    };
  }
  return map;
}

/** Можно ли писать несервисное сообщение: info — запись из fuClients_ (нет записи — данных об отказе нет, можно). */
function fuGate_(info, now) {
  if (!info) return { ok: true };
  if (info.unsub) return { ok: false, why: 'unsub' };
  if (info.blocked) return { ok: false, why: 'blocked' };
  if (info.last > 0 && now - info.last < FU_GAP_DAYS * FU_DAY_MS) return { ok: false, why: 'limit' };
  return { ok: true };
}

/**
 * Пишет в «Клієнти» (под блокировкой): msgNow — поставить «Останнє повідомлення» = сейчас; wait — записать (или '' очистить) «Очікуємо відповідь».
 * Листа «Клієнти» нет — ничего не делает (лист не создаём). Колонки создаются при первой записи. Не бросает исключений.
 */
function fuClientWrite_(uid, msgNow, wait) {
  try {
    uid = String(uid);
    if (!/^\d+$/.test(uid)) return false;
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_CLIENTS);
    if (!sheet || sheet.getLastRow() < 1) return false;
    var lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) return false;
    try {
      var values = sheet.getDataRange().getValues();
      var col = mapHeaders_(values[0], CLIENT_COLS);
      if (col.id < 0) return false;
      var width = Math.max(sheet.getLastColumn(), values[0].length);
      function ensure(key, title) {
        if (col[key] >= 0) return;
        col[key] = width++;
        if (typeof s9Room_ === 'function') s9Room_(sheet, sheet.getLastRow(), width);
        sheet.getRange(1, col[key] + 1).setValue(title).setFontWeight('bold');
      }
      if (msgNow) ensure('lastMsg', 'Останнє повідомлення');
      if (wait !== undefined && (wait !== '' || col.fuWait >= 0)) ensure('fuWait', 'Очікуємо відповідь');
      var at = -1;
      for (var r = 1; r < values.length; r++) if (cell_(values[r], col.id) === uid) { at = r; break; }
      var now = new Date();
      if (at < 0) {
        var row = [];
        for (var b = 0; b < width; b++) row.push('');
        row[col.id] = '\'' + uid;
        if (col.first >= 0) row[col.first] = now;
        if (msgNow && col.lastMsg >= 0) row[col.lastMsg] = now;
        if (wait !== undefined && col.fuWait >= 0) row[col.fuWait] = wait;
        sheet.appendRow(row);
        return true;
      }
      if (msgNow) sheet.getRange(at + 1, col.lastMsg + 1).setValue(now);
      if (wait !== undefined && col.fuWait >= 0) sheet.getRange(at + 1, col.fuWait + 1).setValue(wait);
      return true;
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    console.warn('followup client mark: ' + safeErr_(err));
    return false;
  }
}

/** Старые несервисные отправки (рассылка напоминания, просьба об отзыве, корзина) ставят эту отметку после успешной отправки. */
function fuMarkSent_(uid) { return fuClientWrite_(uid, true, undefined); }

/**
 * Отметка в «Службове» заказа (под блокировкой, по свежему значению ячейки). false — уже стояла, блокировка занята или заказ не найден.
 * num — ожидаемый номер заказа: строки могли сдвинуться после чтения снимка (удаление/сортировка), поэтому номер в строке сверяется,
 * при несовпадении строка ищется заново по номеру; нет такой — отметка не ставится. Для f1/f2 рядом пишется время ft (мс): по нему
 * лимит 14 дней видит отправку, даже если «Останнє повідомлення» записать не удалось.
 */
function fuSetSvcMark_(sheet, col, rowIdx, mark, num) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return false;
  try {
    if (num && col.num >= 0) {
      var at = Number(rowIdx);
      var here = at >= 2 && at <= sheet.getLastRow() ? String(sheet.getRange(at, col.num + 1).getValues()[0][0] || '').trim() : '';
      if (here !== String(num)) {
        at = 0;
        var last = sheet.getLastRow();
        if (last >= 2) {
          var nums = sheet.getRange(2, col.num + 1, last - 1, 1).getValues();
          for (var i = 0; i < nums.length; i++) if (String(nums[i][0] || '').trim() === String(num)) { at = i + 2; break; }
        }
        if (!at) return false;
        rowIdx = at;
      }
    }
    var cur = {};
    try { cur = JSON.parse(String(sheet.getRange(rowIdx, col.svc + 1).getValues()[0][0] || '{}')) || {}; } catch (err) { return false; }
    if (cur[mark]) return false;
    cur[mark] = 1;
    if (mark === 'f1' || mark === 'f2') cur.ft = Date.now();
    sheet.getRange(rowIdx, col.svc + 1).setValue(JSON.stringify(cur));
    return true;
  } finally {
    lock.releaseLock();
  }
}

/** Рецепт к купленному: видимый на витрине (главный ингредиент в наличии), главный ингредиент куплен — в первую очередь, иначе любой купленный. */
function fuRecipeFor_(boughtIds) {
  var bought = {};
  boughtIds.forEach(function (id) { bought[String(id).toUpperCase()] = true; });
  var onSale = {};
  JSON.parse(getCatalogJson_()).products.forEach(function (p) { if (p.a) onSale[String(p.id).toUpperCase()] = true; });
  var list = readRecipes_(SpreadsheetApp.getActiveSpreadsheet()).filter(function (rec) { return rec.items && rec.items.length && onSale[String(rec.items[0]).toUpperCase()]; });
  var pick = null;
  list.forEach(function (rec) { if (!pick && bought[String(rec.items[0]).toUpperCase()]) pick = rec; });
  list.forEach(function (rec) { if (!pick && rec.items.some(function (id) { return bought[String(id).toUpperCase()]; })) pick = rec; });
  return pick;
}

/** Содержимое followup2: { text, withRecipe } или null (нет рецепта и пустой текст в настройках — не слать). */
function fuText2_(st, svc, ru) {
  var ids = [];
  (Array.isArray(svc.i) ? svc.i : []).forEach(function (it) { if (it && it[0]) ids.push(String(it[0])); });
  var rec = null;
  try { rec = ids.length ? fuRecipeFor_(ids) : null; } catch (err) { console.warn('followup recipe: ' + safeErr_(err)); rec = null; }
  if (rec) {
    var title = ru ? (rec.ru || rec.ua) : rec.ua;
    var body = ru ? (rec.tRu || rec.tUa || '') : (rec.tUa || rec.tRu || '');
    return { text: (title + (body ? '\n\n' + body : '')).slice(0, 3900), withRecipe: true };
  }
  var t = String((ru ? (st.followup2_text_ru || st.followup2_text_ua) : (st.followup2_text_ua || st.followup2_text_ru)) || '').trim();
  return t ? { text: t.slice(0, 1000), withRecipe: false } : null;
}

/** Раз в день из dailyJob. Возвращает { f1, f2 } — сколько сообщений ушло. */
function followupJob_() {
  var out = { f1: 0, f2: 0 };
  var st = readSettings_();
  var d1 = fuDays_(st.followup1_days, 60), d2 = fuDays_(st.followup2_days, 365);
  if (!d1 && !d2) return out;
  var props = scriptProps_();
  var token = props.getProperty('BOT_TOKEN');
  var webapp = props.getProperty('WEBAPP_URL');
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ORDERS);
  if (!token || !sheet || sheet.getLastRow() < 2) return out;
  var col = orderCols_(sheet);
  if (col.uid < 0 || col.date < 0 || col.svc < 0) return out;
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  var clients = fuClients_(), stops = reminderStops_();
  var now = Date.now(), lastOrder = {}, lastFu = {}, done = 0;
  values.forEach(function (row) { // последний настоящий заказ клиента: если он уже заказал снова, «Повторити замовлення» не зовём
    var uid = cell_(row, col.uid), t = fuDate_(row[col.date]);
    if (uid && t && cell_(row, col.source).indexOf('test') < 0 && t > (lastOrder[uid] || 0)) lastOrder[uid] = t;
    var rawSvc = cell_(row, col.svc);
    if (uid && rawSvc.indexOf('"ft"') >= 0) { // время прошлых f1/f2 по любым заказам клиента: лимит 14 дней не зависит от записи в «Клієнти»
      try { var ft = Number((JSON.parse(rawSvc) || {}).ft) || 0; if (ft > (lastFu[uid] || 0)) lastFu[uid] = ft; } catch (err) { /* битая ячейка — пропуск */ }
    }
  });
  Object.keys(lastFu).forEach(function (u) {
    if (lastFu[u] > (clients[u] ? clients[u].last : 0)) clients[u] = Object.assign(clients[u] || { unsub: false, blocked: false, wait: '', lang: 'ua' }, { last: lastFu[u] });
  });
  for (var r = 0; r < values.length && done < FU_MAX_RUN; r++) {
    var row = values[r];
    var uid = cell_(row, col.uid), num = cell_(row, col.num);
    if (!/^\d+$/.test(uid) || !num || cell_(row, col.source).indexOf('test') >= 0 || cell_(row, col.status) !== 'виконано') continue;
    var svc;
    try { svc = JSON.parse(cell_(row, col.svc) || '{}') || {}; } catch (err) { continue; }
    var dateMs = fuDate_(row[col.date]);
    var base = Number(svc.dn) > 0 ? Number(svc.dn) : dateMs; // нет отметки «виконано» от бота — считаем от даты заказа
    if (!base) continue;
    var ru = cell_(row, col.lang) === 'ru';
    for (var k = 1; k <= 2 && done < FU_MAX_RUN; k++) {
      var days = k === 1 ? d1 : d2, mark = k === 1 ? 'f1' : 'f2';
      if (!days || svc[mark]) continue;
      if (k === 1 && svc.rv) continue;                          // по заказу уже просили оценку (review_days): второе похожее не шлём
      if (k === 2 && (svc.rm || (lastOrder[uid] || 0) > dateMs)) continue; // старое напоминание уже было / клиент заказал снова
      var late = now - (base + days * FU_DAY_MS);
      if (late < 0 || late > FU_WINDOW_DAYS * FU_DAY_MS) continue; // срок не наступил или слишком давно — пропуск без отметки
      if (stops[uid] || !fuGate_(clients[uid], now).ok) continue;   // отписка, блокировка, «не нагадувати», лимит 14 дней: попробуем завтра, пока идёт окно
      var payload;
      if (k === 1) {
        payload = { text: ru ? FU_TEXT1.ru : FU_TEXT1.ua };
      } else {
        var c2 = fuText2_(st, svc, ru);
        if (!c2) continue;
        payload = { text: c2.text };
        var param = fuStartParam_(num), kb = [];
        if (param) kb.push([{ text: ru ? 'Повторить заказ' : 'Повторити замовлення', url: fuAppLink_() + '?startapp=' + param }]);
        else if (/^https:\/\//.test(webapp || '')) kb.push([{ text: ru ? 'Повторить заказ' : 'Повторити замовлення', web_app: { url: appUrl_(webapp, 'view=orders') } }]);
        kb.push([{ text: ru ? 'Больше не напоминать' : 'Більше не нагадувати', callback_data: 'nr' }]);
        payload.reply_markup = { inline_keyboard: kb };
      }
      if (!fuSetSvcMark_(sheet, col, r + 2, mark, num)) continue;        // отмечаем до отправки: второго раза не будет
      svc[mark] = 1;
      payload.chat_id = uid;
      var res = tg_(token, 'sendMessage', payload);
      if (res && res.ok) {
        done++; out['f' + k]++;
        fuClientWrite_(uid, true, k === 1 ? num + ';' + now + ';' + (ru ? 'ru' : 'ua') : undefined);
        clients[uid] = Object.assign(clients[uid] || { unsub: false, blocked: false, wait: '' }, { last: now });
      }
    }
  }
  return out;
}

/**
 * Ответ клиента на followup1: следующее текстовое сообщение (в течение FU_REPLY_DAYS) уходит админам с правом «Замовлення: статуси»
 * (имя, номер заказа, текст — экранировано), клиенту — «Дякуємо, передали». true — сообщение обработано здесь.
 */
function fuReply_(msg, uid, text, token, props) {
  if (!msg.chat || msg.chat.type !== 'private' || !/^\d+$/.test(uid)) return false;
  if (adminAccess_(uid, props)) return false; // сообщения самих админов не пересылаем
  var cache = CacheService.getScriptCache();
  var more = cache.get('fur_' + uid);       // уже пересылали недавно: следующие строки того же ответа тоже
  var num = '', ru = false, first = false;
  if (more) {
    if ((parseInt(cache.get('furc_' + uid), 10) || 0) >= FU_REPLY_MAX_FWD) return false; // лимит пересылок за окно: дальше обычная обработка, админам не уходит
    var mm = String(more).split(';');
    num = mm[0]; ru = mm[1] === 'ru';
  } else {
    if (cache.get('fun_' + uid)) return false; // недавно проверяли: ответа не ждём
    var info = fuClients_()[uid];
    var w = info && info.wait ? info.wait.split(';') : [];
    var at = Number(w[1]);
    if (!/^P-\d+$/.test(w[0] || '') || !(at > 0) || Date.now() - at > FU_REPLY_DAYS * FU_DAY_MS) {
      if (info && info.wait) fuClientWrite_(uid, false, ''); // ожидание устарело — убираем
      cache.put('fun_' + uid, '1', 600);
      return false;
    }
    num = w[0]; ru = w[2] === 'ru'; first = true;
  }
  var targets = adminList_(props).filter(function (a) { return a.active && a.perms && a.perms.st; });
  var who = escHtml_(clean_(((msg.from && msg.from.first_name) || '') + ' ' + ((msg.from && msg.from.last_name) || ''), 60) || uid);
  who = '<a href="tg://user?id=' + uid + '">' + who + '</a>';
  if (msg.from && msg.from.username) who += ' (@' + escHtml_(String(msg.from.username).replace(/[^\w]/g, '')) + ')';
  var body = '💬 <b>Відповідь клієнта</b> · замовлення ' + escHtml_(num) + '\n👤 ' + who + '\n\n' + escHtml_(String(text).slice(0, 1500));
  var delivered = 0;
  targets.forEach(function (a) {
    var res = tg_(token, 'sendMessage', { chat_id: a.id, text: body, parse_mode: 'HTML', disable_web_page_preview: true });
    if (res && res.ok) delivered++;
  });
  if (!delivered) return false; // никто не получил — обычная обработка бота, ожидание остаётся
  if (first) { // окно «ещё строки» открывается один раз и не продлевается повторными сообщениями
    cache.put('fur_' + uid, num + ';' + (ru ? 'ru' : 'ua'), FU_REPLY_MORE_SEC);
    cache.put('furc_' + uid, '1', FU_REPLY_MORE_SEC);
  } else {
    cache.put('furc_' + uid, String((parseInt(cache.get('furc_' + uid), 10) || 0) + 1), FU_REPLY_MORE_SEC);
  }
  if (first) {
    fuClientWrite_(uid, false, ''); // ответ получен: ожидание снимаем
    tg_(token, 'sendMessage', { chat_id: uid, text: ru ? FU_THANKS.ru : FU_THANKS.ua });
  }
  return true;
}

/* ======================================================================================================== */
/* Волна Б2, блок 12: синонимы поиска и утренняя сводка                                                        */
/* ======================================================================================================== */

var SHEET_SYN = 'Синоніми';
var SYN_HEAD = ['Слово', 'Що шукати'];
var SYN_EXAMPLES = [['урюк', 'курага'], ['абрикос', 'курага'], ['кешью', 'кеш\'ю']];
var SYN_MAX_PAIRS = 200;
var SYN_MAX_LEN = 40;

/** Лист «Синоніми» → { слово: что искать } (строчные, до 200 пар, до 40 знаков). Нет листа или пар — null (поля shop.syn нет). */
function readSynonyms_(ss) {
  var sheet = (ss || SpreadsheetApp.getActiveSpreadsheet()).getSheetByName(SHEET_SYN);
  if (!sheet || sheet.getLastRow() < 1) return null;
  var values = sheet.getDataRange().getValues();
  function norm(v) { return clean_(v, 200).replace(/\s+/g, ' ').toLowerCase(); }
  var start = 0;
  var h0 = norm(values[0][0]), h1 = norm(values[0][1]);
  if (h0 === 'слово' || h1 === 'що шукати' || h1 === 'что искать') start = 1; // строка заголовков
  var out = {}, n = 0;
  for (var r = start; r < values.length && n < SYN_MAX_PAIRS; r++) {
    var from = norm(values[r][0]), to = norm(values[r][1]);
    if (!from || !to || from === to || from.length > SYN_MAX_LEN || to.length > SYN_MAX_LEN || from === '__proto__') continue;
    if (Object.prototype.hasOwnProperty.call(out, from)) continue;
    out[from] = to;
    n++;
  }
  return n ? out : null;
}

function fuMoney_(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₴'; }

/**
 * Текст утренней сводки (UA, простой текст) или '' — нет данных ни для одного раздела. Только настоящие данные:
 * заказы за вчера (без тестовых, отменённых и «немає в наявності»), подтверждённые и ещё не отправленные, товары «немає», товары без цены.
 */
function digestText_(ss, now) {
  var tz = ss.getSpreadsheetTimeZone() || 'Europe/Kiev';
  var dayKey = function (t) { return Utilities.formatDate(new Date(t), tz, 'yyyy-MM-dd'); };
  var yesterday = dayKey(now - FU_DAY_MS);
  var yN = 0, ySum = 0, ship = [];
  var sheet = ss.getSheetByName(SHEET_ORDERS);
  if (sheet && sheet.getLastRow() > 1) {
    var col = orderCols_(sheet);
    sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues().forEach(function (row) {
      if (!cell_(row, col.num) || cell_(row, col.source).indexOf('test') >= 0) return;
      var status = cell_(row, col.status) || STATUS_NEW;
      var t = col.date >= 0 ? fuDate_(row[col.date]) : 0;
      if (status === STATUS_BY_CODE.c) ship.push(cell_(row, col.num) + (cell_(row, col.name) ? ' ' + cell_(row, col.name) : '') + ' — ' + fuMoney_(toNum_(col.total >= 0 ? row[col.total] : 0)));
      if (status === 'скасовано' || status === STATUS_BY_CODE.n || !t || dayKey(t) !== yesterday) return;
      yN++; ySum += toNum_(col.total >= 0 ? row[col.total] : 0);
    });
  }
  var out = [], noStock = [], noPrice = [];
  listProductsAdmin_().forEach(function (p) { // только id, название, наличие, наличие цены: закупка и прочие служебные колонки не читаются
    if (!p.hidden && !p.stock) noStock.push(p.ua);
    if (!(p.price > 0)) noPrice.push(p.ua);
  });
  function list(items, max) { return items.slice(0, max).join(', ') + (items.length > max ? ' …і ще ' + (items.length - max) : ''); }
  if (yN) out.push('Вчора: замовлень ' + yN + ' на ' + fuMoney_(ySum));
  if (ship.length) out.push('Відправити сьогодні (' + ship.length + '):\n' + ship.slice(0, 10).map(function (x) { return '• ' + x; }).join('\n') + (ship.length > 10 ? '\n…і ще ' + (ship.length - 10) : ''));
  if (noStock.length) out.push('Закінчилось (' + noStock.length + '): ' + list(noStock, 10));
  if (noPrice.length) out.push('Чекають ціни (' + noPrice.length + '): ' + list(noPrice, 10));
  if (!out.length) return 'Вчора замовлень не було';
  return ('Зведення PAMIR, ' + Utilities.formatDate(new Date(now), tz, 'dd.MM') + '\n\n' + out.join('\n\n')).slice(0, 4000);
}

/**
 * Раз на час из hourlyJob: если сейчас digest_hour (часовой пояс таблицы) и сегодня ещё не слали — сводка админам с правом «Статистика».
 * Пусто или не 0–23 — выключено. Отметка дня — свойство скрипта DIGEST_LAST (дата, не секрет). Возвращает число получателей.
 */
function digestJob_() {
  var raw = String(readSettings_().digest_hour === undefined ? '' : readSettings_().digest_hour).trim();
  if (!/^\d{1,2}$/.test(raw) || Number(raw) > 23) return 0;
  var props = scriptProps_();
  var token = props.getProperty('BOT_TOKEN');
  if (!token) return 0;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var tz = ss.getSpreadsheetTimeZone() || 'Europe/Kiev';
  var now = Date.now();
  if (Number(Utilities.formatDate(new Date(now), tz, 'HH')) !== Number(raw)) return 0;
  var today = Utilities.formatDate(new Date(now), tz, 'yyyy-MM-dd');
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return 0;
  try {
    if (String(props.fresh('DIGEST_LAST') || '') === today) return 0;
    props.setProperty('DIGEST_LAST', today); // отмечаем до отправки: второго раза в этот день не будет
  } finally {
    lock.releaseLock();
  }
  var targets = adminList_(props).filter(function (a) { return a.active && a.perms && a.perms.stats; });
  if (!targets.length) return 0;
  var text = digestText_(ss, now);
  var n = 0;
  targets.forEach(function (a) { var res = tg_(token, 'sendMessage', { chat_id: a.id, text: text, disable_web_page_preview: true }); if (res && res.ok) n++; });
  return n;
}

/* ---------- шаги меню «Етап 9Б2: налаштувати» для блока 3 и 12 ---------- */

var S9B2_SETTINGS_B3 = ['followup1_days', 'followup2_days', 'followup2_text_ua', 'followup2_text_ru', 'digest_hour', 'np_track_hours'];
/** Значения, которые шаг записывает вместо «0 — выключено» (только если ключа в листе ещё нет). */
var S9B2_SETTING_VALUES = { followup1_days: '3', followup2_days: '21', np_track_hours: '3' };

/** Лист «Синоніми» с заголовками и тремя примерами — только если листа ещё нет. */
function s9b2StepSyn_(ss) {
  if (ss.getSheetByName(SHEET_SYN)) return { changed: 0, text: 'Аркуш «' + SHEET_SYN + '»: уже є, не чіпали.' };
  var sheet = ss.insertSheet(SHEET_SYN);
  sheet.getRange(1, 1, 1, 2).setValues([SYN_HEAD]).setFontWeight('bold');
  sheet.getRange(2, 1, SYN_EXAMPLES.length, 2).setValues(SYN_EXAMPLES);
  if (typeof sheet.setFrozenRows === 'function') sheet.setFrozenRows(1);
  return { changed: 1, text: 'Аркуш «' + SHEET_SYN + '» створено (приклади: урюк → курага, абрикос → курага, кешью → кеш\'ю).' };
}

/** Колонка «Якщо немає» в «Замовлення» — только если её нет. */
function s9b2StepIfOut_(ss) {
  var sheet = ss.getSheetByName(SHEET_ORDERS);
  if (!sheet) return { changed: 0, text: 'Аркуша «' + SHEET_ORDERS + '» ще немає: колонку «Якщо немає» буде створено пізніше.' };
  var head = sheet.getRange(1, 1, 1, Math.max(1, sheet.getLastColumn())).getValues()[0];
  var col = mapHeaders_(head, ORDER_COLS);
  if (col.ifOut >= 0) return { changed: 0, text: 'Колонка «Якщо немає»: уже є.' };
  var at = Math.max(sheet.getLastColumn(), head.length);
  s9Room_(sheet, sheet.getLastRow(), at + 1);
  sheet.getRange(1, at + 1).setValue('Якщо немає').setFontWeight('bold');
  return { changed: 1, text: 'Колонку «Якщо немає» створено в аркуші «' + SHEET_ORDERS + '».' };
}

/* ======================================================================================================== */
/* Волна Б2, блок 4: Нова пошта дальше (стоимость доставки, «Створити ТТН», «посылка прибыла»)               */
/* ======================================================================================================== */
/*
 * Всё работает только с NP_API_KEY (Code.gs) и данными отправителя из Script Properties (в ответы и логи не попадают):
 *   NP_SENDER_CITY    Ref города отправителя         — нужен для np.price и для «Створити ТТН»
 *   NP_SENDER_REF     Ref контрагента-отправителя     — только «Створити ТТН»
 *   NP_SENDER_CONTACT Ref контактного лица
 *   NP_SENDER_ADDRESS Ref отделения отправителя
 *   NP_SENDER_PHONE   телефон отправителя (380XXXXXXXXX)
 * Нет ключа или данных — всё как раньше: нет полей shop.npp, orders.npTtn, действий и сообщений.
 * Названия методов и полей API Новой почты НЕ сверены с живой документацией (нет доступа) и ни разу не вызывались с настоящим ключом.
 */

var NP_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
var NP_SENDER_PROPS = ['NP_SENDER_REF', 'NP_SENDER_CONTACT', 'NP_SENDER_CITY', 'NP_SENDER_ADDRESS', 'NP_SENDER_PHONE'];
var NP_PRICE_TTL = 4 * 3600;        // кэш стоимости, секунды
var NP_PRICE_MAX_PER_HOUR = 150;    // свои вызовы np.price в час (общий лимит 600 — ещё и у подсказок городов и отделений)
var NP_W_MIN_G = 100, NP_W_MAX_G = 30000; // вес посылки, граммы
var NP_TTN_BUSY_MS = 5 * 60 * 1000; // отметка «создание идёт» живёт столько
var NP_TRACK_DAYS = 30;             // заказы старше — не опрашиваем
var NP_TRACK_BATCH = 100, NP_TRACK_MAX_BATCHES = 5;
var NP_DESC_DEFAULT = 'Харчові продукти';

function npProp_(name) {
  try { return String(scriptProps_().getProperty(name) || '').trim(); } catch (err) { return ''; }
}

/** Есть ключ и город отправителя: можно считать стоимость (shop.npp). */
function npPriceOn_() { return !!(npKey_() && npProp_('NP_SENDER_CITY')); }

/** Есть ключ и все пять NP_SENDER_*: можно создавать накладные (orders.npTtn в админ-панели). */
function npTtnOn_() {
  if (!npKey_()) return false;
  return NP_SENDER_PROPS.every(function (k) { return !!npProp_(k); });
}

var NP_MSG = {
  off: ['Нова пошта не налаштована', 'Новая почта не настроена'],
  busy: ['Зараз триває інша дія із замовленням. Зачекайте хвилину', 'Сейчас идёт другое действие с заказом. Подождите минуту'],
  not_found: ['Замовлення не знайдено', 'Заказ не найден'],
  test: ['Тестове замовлення: ТТН не створюється', 'Тестовый заказ: ТТН не создаётся'],
  bad_status: ['Для цього статусу замовлення ТТН не створюється', 'Для этого статуса заказа ТТН не создаётся'],
  not_np: ['Це замовлення не на Нову пошту', 'Этот заказ не на Новую почту'],
  courier: ['Кур’єрська доставка: ТТН створіть вручну в кабінеті Нової пошти й введіть номер', 'Курьерская доставка: создайте ТТН вручную в кабинете Новой почты и введите номер'],
  has_ttn: ['У замовлення вже є ТТН', 'У заказа уже есть ТТН'],
  no_ref: ['У замовлення немає коду міста Нової пошти (зроблене до оновлення). Створіть ТТН вручну й введіть номер', 'У заказа нет кода города Новой почты (сделан до обновления). Создайте ТТН вручную и введите номер'],
  wh_unknown: ['Не вдалося однозначно знайти відділення за номером. Створіть ТТН вручну й введіть номер', 'Не удалось однозначно найти отделение по номеру. Создайте ТТН вручную и введите номер'],
  np_error: ['Нова пошта не відповіла. Спробуйте пізніше або створіть ТТН вручну', 'Новая почта не ответила. Попробуйте позже или создайте ТТН вручную'],
  np_api: ['Нова пошта відхилила накладну', 'Новая почта отклонила накладную'],
  np_unknown: ['Відповідь Нової пошти не отримано: накладна могла бути створена. Перевірте кабінет Нової пошти перед повтором (захист від дубля діє 5 хвилин)', 'Ответ Новой почты не получен: накладная могла быть создана. Проверьте кабинет Новой почты перед повтором (защита от дубля действует 5 минут)'],
  save_failed: ['Накладну створено, але номер не записано в замовлення. Введіть номер вручну', 'Накладная создана, но номер не записан в заказ. Введите номер вручную'],
  bad_phone: ['Телефон отримувача не українського формату (+380…). Створіть ТТН вручну', 'Телефон получателя не украинского формата (+380…). Создайте ТТН вручную'],
  bad_name: ['Вкажіть отримувача: прізвище та ім’я (два-три слова)', 'Укажите получателя: фамилия и имя (два-три слова)'],
  bad_weight: ['Вкажіть вагу від 100 г до 30 кг', 'Укажите вес от 100 г до 30 кг'],
  bad_amount: ['Сума не збігається із замовленням. Відкрийте підтвердження ще раз', 'Сумма не совпадает с заказом. Откройте подтверждение ещё раз'],
  not_confirmed: ['Потрібне підтвердження', 'Нужно подтверждение'],
  city_diff: ['Місто в замовленні не збігається з містом Нової пошти за кодом. Перевірте адресу й підтвердіть створення ще раз', 'Город в заказе не совпадает с городом Новой почты по коду. Проверьте адрес и подтвердите создание ещё раз']
};

function npFail_(code, extra) {
  var m = NP_MSG[code] || ['Помилка', 'Ошибка'];
  var out = { ok: false, error: code, msg: { ua: m[0], ru: m[1] } };
  if (extra) Object.keys(extra).forEach(function (k) { out[k] = extra[k]; });
  return out;
}

/* ---------- 1. Стоимость доставки: ?action=np.price&city=<Ref>&w=<граммы>&sum=<сумма корзины> ---------- */

/**
 * Ответ {ok:true, cost:целое ₴} или {ok:false, error:'off'|'bad_form'|'busy'|'np_error'}. Вес — в граммах, округляется вверх до 0,5 кг
 * и ограничивается 0,5…30 кг. sum — только объявленная стоимость для тарифа: ограничена 200…50 000 и округлена вверх до 500,
 * на цены и суммы заказа не влияет. Кэш — по (город, вес, ступень суммы).
 */
function npPrice_(city, w, sum) {
  if (!npPriceOn_()) return { ok: false, error: 'off' };
  city = String(city || '');
  var g = Number(w);
  if (!NP_UUID_RE.test(city) || !isFinite(g) || g <= 0) return { ok: false, error: 'bad_form' };
  var kg = Math.min(30, Math.max(0.5, Math.ceil(Math.min(g, 100000) / 500) * 0.5));
  var s = Number(sum);
  if (!isFinite(s) || s < 0) s = 0;
  var cost = Math.min(50000, Math.max(200, Math.ceil(s / 500) * 500));
  var cache = CacheService.getScriptCache();
  var ckey = 'npp_' + city.toLowerCase() + '_' + kg + '_' + cost;
  var hit = cache.get(ckey);
  if (hit && /^\d+$/.test(hit)) return { ok: true, cost: Number(hit) };
  var now = Date.now(), parts = String(cache.get('npp_calls') || '').split('|');
  var calls = parseInt(parts[0], 10) || 0, t0 = parseInt(parts[1], 10) || now;
  if (now - t0 > 3600000) { calls = 0; t0 = now; }
  if (calls >= NP_PRICE_MAX_PER_HOUR) return { ok: false, error: 'busy' };
  cache.put('npp_calls', (calls + 1) + '|' + t0, 3600);
  var data = npCall_('getDocumentPrice', {
    CitySender: npProp_('NP_SENDER_CITY'), CityRecipient: city, Weight: String(kg), ServiceType: 'WarehouseWarehouse',
    Cost: String(cost), CargoType: 'Parcel', SeatsAmount: '1'
  }, { model: 'InternetDocument', noCache: true, quiet: true });
  var price = data && data[0] ? Math.round(Number(data[0].Cost)) : 0;
  if (!(price > 0) || price > 100000) return { ok: false, error: 'np_error' };
  cache.put(ckey, String(price), NP_PRICE_TTL);
  return { ok: true, cost: price };
}

/* ---------- 2. «Створити ТТН»: подтверждение и создание ---------- */

/** Вес позиций в граммах, если известен у всех позиций (весовые), иначе null. */
function npOrderWeightG_(svc) {
  var items = svc && Array.isArray(svc.i) ? svc.i : [];
  if (!items.length) return null;
  var sum = 0;
  for (var i = 0; i < items.length; i++) {
    var g = Number(items[i] && items[i][1]), q = Number(items[i] && items[i][2]);
    if (!(g > 0) || !(q >= 1)) return null; // штучный товар: вес в заказе не хранится
    sum += g * q;
  }
  return sum > 0 ? Math.round(sum) : null;
}

/** Телефон 380XXXXXXXXX из «+380…» или null. */
function npPhone_(v) {
  var d = String(v === null || v === undefined ? '' : v).replace(/\D/g, '');
  return /^380\d{9}$/.test(d) ? d : null;
}

function npName_(v) {
  var s = String(v === null || v === undefined ? '' : v).replace(/\s+/g, ' ').trim();
  var words = s.split(' ');
  if (s.length > 80 || words.length < 2 || words.length > 3) return '';
  for (var i = 0; i < words.length; i++) if (!/^[A-Za-zА-Яа-яІіЇїЄєҐґ'’ʼ`-]{2,}$/.test(words[i])) return '';
  return s;
}

/** Отделение (или почтомат) города по номеру: ровно одно совпадение, иначе ошибка. */
function npResolveWh_(cityRef, branchText, locker) {
  var m = String(branchText || '').match(/\d{1,5}/);
  if (!m) return { error: 'wh_unknown' };
  var num = parseInt(m[0], 10);
  var data = npCall_('getWarehouses', { CityRef: cityRef, FindByString: String(num), Limit: '300' }, { quiet: true, admin: true });
  if (!data) return { error: 'np_error' };
  var hits = data.filter(function (w) {
    return w && parseInt(w.Number, 10) === num && NP_UUID_RE.test(String(w.Ref || '')) && ((String(w.CategoryOfWarehouse || '') === 'Postomat') === locker);
  });
  if (hits.length !== 1) return { error: 'wh_unknown' };
  var w = hits[0];
  return { ref: String(w.Ref), num: String(num), desc: String(w.Description || '').slice(0, 140), city: String(w.CityDescription || '').slice(0, 60), cityRu: String(w.CityDescriptionRu || '').slice(0, 60) };
}

/** Название города для осторожного сравнения: регистр, апострофы, «м.»/«місто», скобки, всё после запятой не учитываются. */
function npCityNorm_(v) {
  var s = String(v === null || v === undefined ? '' : v).toLowerCase().replace(/ё/g, 'е').replace(/[’ʼ`'‘]/g, '').replace(/\([^)]*\)/g, ' ');
  s = s.replace(/(^|\s)(м|г|смт|пгт|с|с-ще)\.(?=\s|[а-яіїєґ])/g, ' ').replace(/(^|\s)(місто|город|селище|село|поселок)(?=\s|$)/g, ' ');
  return s.replace(/[^a-zа-яіїєґ0-9\s,-]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** true — город заказа из формы заметно отличается от города НП по Ref (нет данных для сравнения — false). */
function npCityDiffers_(formCity, wh) {
  var names = [npCityNorm_(wh && wh.city), npCityNorm_(wh && wh.cityRu)].filter(function (x) { return x; });
  var form = npCityNorm_(formCity);
  if (!names.length || !form) return false;
  var head = form.split(',')[0].trim();
  var padded = ' ' + form.replace(/[,]/g, ' ').replace(/\s+/g, ' ') + ' ';
  return !names.some(function (n) { return head === n || padded.indexOf(' ' + n + ' ') >= 0; });
}

/** Общая часть preview и create: заказ найден, подходит, получатель и отделение известны. Возвращает {ok:true, f, d} или {ok:false,…}. */
function npTtnPrepare_(num) {
  if (!npTtnOn_()) return npFail_('off');
  if (!/^P-\d+$/.test(num)) return npFail_('not_found');
  var f = findOrder_(num);
  if (!f) return npFail_('not_found');
  var o = f.o;
  if (String(o.source).indexOf('test') >= 0) return npFail_('test');
  if (o.status === 'скасовано' || o.status === STATUS_BY_CODE.n) return npFail_('bad_status');
  if (o.delivery !== 'np') return npFail_('not_np');
  if (o.npType === 'courier') return npFail_('courier');
  var svc = {};
  try { svc = JSON.parse(o.svc || '{}') || {}; } catch (err) { svc = {}; }
  if (svc.ttn) return npFail_('has_ttn');
  var cityRef = String(svc.nc || '');
  if (!NP_UUID_RE.test(cityRef)) return npFail_('no_ref');
  var phone = npPhone_(o.phone);
  if (!phone) return npFail_('bad_phone');
  var wh = npResolveWh_(cityRef, o.branch, o.npType === 'locker');
  if (wh.error) return npFail_(wh.error);
  var payRecv = (o.pay === 'cash' || o.pay === 'cod') && paidCode_(o.paid) === 'unpaid';
  var total = Math.round(Number(o.total) || 0);
  return { ok: true, f: f, svc: svc, d: {
    name: String(o.name || '').replace(/\s+/g, ' ').trim().slice(0, 80), phone: phone, cityRef: cityRef, wh: wh,
    weightG: npOrderWeightG_(svc), cost: total, cod: payRecv ? total : 0, desc: NP_DESC_DEFAULT
  } };
}

/** admin.ttn.preview: данные экрана подтверждения. Ничего не меняет. */
function npTtnPreview_(num) {
  var p = npTtnPrepare_(num);
  if (!p.ok) return p;
  var o = p.f.o, d = p.d;
  var out = { ok: true, ttn: {
    num: num, name: d.name, nameOk: !!npName_(d.name), phone: '+' + d.phone, city: o.city, branch: o.branch, type: o.npType === 'locker' ? 'locker' : 'branch',
    npCity: d.wh.city, npWarehouse: d.wh.desc, weightG: d.weightG, cost: d.cost, cod: d.cod, desc: d.desc,
    minG: NP_W_MIN_G, maxG: NP_W_MAX_G
  } };
  if (npCityDiffers_(o.city, d.wh)) out.ttn.cityDiff = 1;
  return out;
  // cityDiff: 1 добавляется только при расхождении города заказа и города НП по Ref (необязательное поле).
}

/** Запись в «Службове» заказа под блокировкой. fn(svc) возвращает код ошибки (строку), чтобы отказаться. '' — записано. */
function npSvcEdit_(num, fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return 'busy';
  try {
    var f = findOrder_(num);
    if (!f || f.col.svc < 0) return 'not_found';
    var svc;
    try { svc = JSON.parse(f.o.svc || '{}') || {}; } catch (err) { svc = {}; }
    var bad = fn(svc);
    if (bad) return bad;
    f.sheet.getRange(f.rowIndex, f.col.svc + 1).setValue(JSON.stringify(svc));
    SpreadsheetApp.flush();
    return '';
  } finally {
    lock.releaseLock();
  }
}

/**
 * admin.ttn.create: body {num, weight (граммы), confirm: true, cod?: число, name?: текст, desc?: текст}.
 * Сумма и наложенный платёж берутся из заказа на сервере; cod от клиента допускается только равным серверному значению.
 * Защита от дубля: ТТН уже есть → отказ; отметка «создание идёт» (svc.tp) на 5 минут ставится под блокировкой до запроса к API.
 */
function npTtnCreate_(body, token) {
  var num = String(body.num || '');
  var p = npTtnPrepare_(num);
  if (!p.ok) return p;
  if (body.confirm !== true) return npFail_('not_confirmed');
  var d = p.d;
  if (npCityDiffers_(p.f.o.city, d.wh) && body.cityOk !== true) return npFail_('city_diff'); // город заказа ≠ город НП по Ref: нужно явное cityOk: true
  var wg = Math.round(Number(body.weight));
  if (!isFinite(wg) || wg < NP_W_MIN_G || wg > NP_W_MAX_G) return npFail_('bad_weight');
  if (body.cod !== undefined && body.cod !== null && Math.round(Number(body.cod)) !== d.cod) return npFail_('bad_amount');
  if (!(d.cost > 0)) return npFail_('bad_amount');
  var name = npName_(body.name !== undefined && body.name !== null && String(body.name).trim() ? body.name : d.name);
  if (!name) return npFail_('bad_name');
  var desc = clean_(body.desc, 100) || d.desc;
  // Метка «создание идёт» — под блокировкой, до обращения к API.
  var now = Date.now();
  var bad = npSvcEdit_(num, function (svc) {
    if (svc.ttn) return 'has_ttn';
    if (Number(svc.tp) > 0 && now - Number(svc.tp) < NP_TTN_BUSY_MS) return 'busy';
    svc.tp = now;
    return '';
  });
  if (bad) return npFail_(bad);
  var props = {
    NewAddress: '1', PayerType: 'Recipient', PaymentMethod: 'Cash', CargoType: 'Parcel', ServiceType: 'WarehouseWarehouse', SeatsAmount: '1',
    DateTime: Utilities.formatDate(new Date(now), 'Europe/Kiev', 'dd.MM.yyyy'),
    Weight: String(Math.round(wg / 10) / 100), Cost: String(d.cost), Description: desc,
    CitySender: npProp_('NP_SENDER_CITY'), Sender: npProp_('NP_SENDER_REF'), SenderAddress: npProp_('NP_SENDER_ADDRESS'),
    ContactSender: npProp_('NP_SENDER_CONTACT'), SendersPhone: npProp_('NP_SENDER_PHONE').replace(/\D/g, ''),
    CityRecipient: d.cityRef, RecipientCityName: d.wh.city, RecipientAddress: d.wh.ref, RecipientAddressName: d.wh.num,
    RecipientName: name, RecipientType: 'PrivatePerson', RecipientsPhone: d.phone
  };
  if (d.cod > 0) props.BackwardDeliveryData = [{ PayerType: 'Recipient', CargoType: 'Money', RedeliveryString: String(d.cod) }];
  var eo = {};
  var data = npCall_('save', props, { model: 'InternetDocument', noCache: true, quiet: true, admin: true, errOut: eo });
  var ttn = data && data[0] ? String(data[0].IntDocNumber || '').replace(/\s+/g, '') : '';
  if (!/^\d{10,20}$/.test(ttn)) {
    if (!data && eo.api !== true && eo.nocall !== true) return npFail_('np_unknown'); // связь оборвалась: накладная могла создаться, метку не снимаем
    if (data && data.length) return npFail_('np_unknown');                             // success без разборчивого номера: накладная скорее всего создана, метку не снимаем
    npSvcEdit_(num, function (svc) { delete svc.tp; return ''; });                     // API отказал или не вызывался: повтор безопасен
    if (data) return npFail_('np_error');                                              // ответ без номера
    return eo.api === true ? npFail_('np_api', { np: eo.text || '' }) : npFail_('np_error');
  }
  var res = null;
  try {
    res = setTtn_(num, ttn, token);                                                    // записывает «ТТН» и пишет клиенту номер с «Відстежити»
  } catch (err) {
    console.warn('np ttn save: ' + num + ' ' + ttn + ' ' + safeErr_(err));              // номер не теряем: он в ответе админу и в логе (не секрет)
    res = null;
  }
  if (!res || !res.ok) return npFail_('save_failed', { ttn: ttn });                    // метку tp не снимаем: повтор в течение 5 минут не создаст дубль
  npSvcEdit_(num, function (svc) { delete svc.tp; return ''; });
  return { ok: true, ttn: ttn, told: res.told };
}

/* ---------- 3. Посылка прибыла в отделение: сервисное сообщение один раз ---------- */

var NP_ARRIVED_CODES = ['7', '8'];

/**
 * Из hourlyJob. np_track_hours (0 или пусто — выключено; максимум 24): раз в N часов опрашивает ТТН заказов «відправлено»
 * без отметки svc.ar, не старше 30 дней. Код 7 или 8 → клиенту одно сообщение, отметка svc.ar (один раз, ставится до отправки).
 * Сервисное сообщение: «Відписка», лимит 14 дней и отметка «Останнє повідомлення» к нему не относятся. Ошибка API — тихо до следующего раза.
 * Возвращает число отправленных сообщений.
 */
function npTrackJob_() {
  var hours = Math.round(toNum_(readSettings_().np_track_hours));
  if (!(hours >= 1) || !npKey_()) return 0;
  hours = Math.min(hours, 24);
  var props = scriptProps_();
  var token = props.getProperty('BOT_TOKEN');
  if (!token) return 0;
  var now = Date.now();
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return 0;
  try {
    if (now - (Number(props.fresh('NP_TRACK_LAST')) || 0) < hours * 3600000 - 300000) return 0; // триггер ходит раз в час: небольшой допуск
    props.setProperty('NP_TRACK_LAST', String(now)); // не секрет: время последнего опроса
  } finally {
    lock.releaseLock();
  }
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ORDERS);
  if (!sheet || sheet.getLastRow() < 2) return 0;
  var col = orderCols_(sheet);
  if (col.uid < 0 || col.svc < 0 || col.date < 0) return 0;
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  var list = [];
  values.forEach(function (row, r) {
    if (cell_(row, col.status) !== STATUS_BY_CODE.s || cell_(row, col.source).indexOf('test') >= 0) return;
    var t = fuDate_(row[col.date]);
    if (!t || now - t > NP_TRACK_DAYS * FU_DAY_MS) return;
    var svc;
    try { svc = JSON.parse(cell_(row, col.svc) || '{}') || {}; } catch (err) { return; }
    var ttn = String(svc.ttn || '');
    if (!/^\d{10,20}$/.test(ttn) || svc.ar || !/^\d+$/.test(cell_(row, col.uid))) return;
    list.push({ r: r + 2, ttn: ttn, uid: cell_(row, col.uid), num: cell_(row, col.num), ru: cell_(row, col.lang) === 'ru', phone: npPhone_(cell_(row, col.phone)) });
  });
  var sent = 0;
  for (var b = 0; b < NP_TRACK_MAX_BATCHES && b * NP_TRACK_BATCH < list.length; b++) {
    var chunk = list.slice(b * NP_TRACK_BATCH, (b + 1) * NP_TRACK_BATCH);
    var data = npCall_('getStatusDocuments', { Documents: chunk.map(function (x) { var d = { DocumentNumber: x.ttn }; if (x.phone) d.Phone = x.phone; return d; }) },
      { model: 'TrackingDocument', noCache: true, quiet: true, admin: true });
    if (!data) continue; // ошибка API: до следующего раза
    var arrived = {};
    data.forEach(function (x) { if (x && NP_ARRIVED_CODES.indexOf(String(x.StatusCode)) >= 0) arrived[String(x.Number || '')] = true; });
    chunk.forEach(function (x) {
      if (!arrived[x.ttn]) return;
      if (!fuSetSvcMark_(sheet, col, x.r, 'ar', x.num)) return; // уже отмечено (или блокировка занята): второго сообщения не будет
      var res = tg_(token, 'sendMessage', {
        chat_id: x.uid,
        text: x.ru ? 'Ваш заказ № ' + x.num + ' прибыл в отделение Новой почты. ТТН ' + x.ttn + '.'
                   : 'Ваше замовлення № ' + x.num + ' прибуло у відділення Нової пошти. ТТН ' + x.ttn + '.',
        reply_markup: { inline_keyboard: [[{ text: x.ru ? 'Отследить' : 'Відстежити', url: TTN_TRACK_URL + x.ttn }]] }
      });
      if (res && res.ok) sent++;
    });
  }
  return sent;
}
