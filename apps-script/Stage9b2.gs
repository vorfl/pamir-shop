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
    .addItem('Етап 9Б2: налаштувати', 'stage9b2Setup')
    .addItem('Етап 9Б2: перевірити Нову пошту', 'stage9b2CheckNp');
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
      s9Room_(sheet, sheet.getLastRow(), p2 + 1);
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
 * followup1_days — «Як вам замовлення?» через N дней после статуса «виконано» (svc.dn); без статуса не шлётся.
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
function fuSetSvcMark_(sheet, col, rowIdx, mark, num, ttn) { // ttn (необязательно) — номер, по которому спрашивали НП: в ячейке другой — отметку не ставим
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
    if (ttn !== undefined && String(cur.ttn || '') !== String(ttn)) return false;
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
/** Значения шага: всё выключено (0), включает владелец сам; пишется только если ключа в листе ещё нет. */
var S9B2_SETTING_VALUES = { followup1_days: '0', followup2_days: '0', np_track_hours: '0' };

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
 * Всё работает только с NP_API_KEY (Code.gs). Данные отправителя (в ответы и логи не попадают):
 *   Вводит владелец:  NP_SENDER_PHONE (380XXXXXXXXX, с «+», «0…», пробелами — всё равно),
 *                     NP_SENDER_WAREHOUSE (номер отделения, например 34), NP_SENDER_CITY_NAME (необязательно, по умолчанию «Харків»).
 *   Ручное переопределение (необязательно; заданное используется без запросов к API): NP_SENDER_CITY, NP_SENDER_ADDRESS, NP_SENDER_REF, NP_SENDER_CONTACT.
 *   Служебные (пишет код): NP_SENDER_CACHE (Ref-ы и отпечаток входных значений, не секрет), NP_ALERT_LAST, NP_TRACK_LAST, NP_PAUSE_UNTIL (пауза после «To many requests»), NP_SENDER_RETRY (повтор неудачной попытки: 1 ч → 6 ч → 24 ч).
 * Ref города, отделения, контрагента и контакта находятся через API и кэшируются (CacheService 6 ч + NP_SENDER_CACHE 7 дней).
 * Сетевых запросов в каталоге и в админ-панели нет: отправитель разрешается в hourlyJob (npSenderJob_) и из меню «Етап 9Б2: перевірити Нову пошту».
 * Нет ключа или данных — всё как раньше: нет полей shop.npp, orders.npTtn, действий и сообщений.
 *
 * Сверка с документацией (на 2026-11): официально подтверждены endpoint, формат ответа и TrackingDocument.getStatusDocuments с кодами статусов
 * (api-portal.novapost.com). Методы Address.*, Counterparty.*, InternetDocument.* на портале не описаны (developers.novaposhta.ua недоступен):
 * они собраны по открытым клиентским библиотекам и помечены в коде «не сверено с документацией».
 */

var NP_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
var NP_SENDER_PROPS = ['NP_SENDER_REF', 'NP_SENDER_CONTACT', 'NP_SENDER_CITY', 'NP_SENDER_ADDRESS', 'NP_SENDER_PHONE'];
var NP_PRICE_TTL = 24 * 3600;       // кэш стоимости, секунды (быстрый слой 6 ч + лист «Кеш НП», Stage9b3.gs)
var NP_PRICE_MAX_PER_HOUR = 150;    // свои вызовы np.price в час (общий лимит 600 — ещё и у подсказок городов и отделений)
var NP_W_MIN_G = 100, NP_W_MAX_G = 30000; // вес посылки, граммы
var NP_TTN_BUSY_MS = 5 * 60 * 1000; // отметка «создание идёт» живёт столько
var NP_TTN_DEL_MS = 24 * 3600 * 1000; // «пробную» накладную можно удалить из админки в течение суток
var NP_TRACK_DAYS = 30;             // заказы старше — не опрашиваем
var NP_TRACK_BATCH = 100, NP_TRACK_MAX_BATCHES = 5;
var NP_DESC_DEFAULT = 'Харчові продукти';
var NP_SENDER_CACHE_KEY = 'np_sender';
var NP_SENDER_TTL_MS = 7 * 24 * 3600 * 1000;       // кэш Ref-ов отправителя действует 7 дней (при неудачном обновлении старый кэш работает до конца срока)
var NP_SENDER_REFRESH_MS = 5 * 24 * 3600 * 1000;   // hourlyJob начинает обновлять его за 2 дня до конца срока
var NP_SENDER_CITY_DEFAULT = 'Харків';

function npProp_(name) {
  try { return String(scriptProps_().getProperty(name) || '').trim(); } catch (err) { return ''; }
}

/** Телефон в виде 380XXXXXXXXX из «380…», «+380…», «0XXXXXXXXX», «80…», с пробелами, скобками, дефисами. Иное — null («нет данных»). */
function npPhone_(v) {
  var d = String(v === null || v === undefined ? '' : v).replace(/\D/g, '');
  if (/^380\d{9}$/.test(d)) return d;
  if (/^80\d{9}$/.test(d)) return '3' + d;
  if (/^0\d{9}$/.test(d)) return '38' + d;
  return null;
}

/** Номер отделения отправителя из NP_SENDER_WAREHOUSE («34», «№34», «відділення 34») или 0. */
function npSenderWhNum_() {
  var m = npProp_('NP_SENDER_WAREHOUSE').match(/\d{1,5}/);
  var n = m ? parseInt(m[0], 10) : 0;
  return n > 0 ? n : 0;
}

function npSenderCityName_() { return npProp_('NP_SENDER_CITY_NAME') || NP_SENDER_CITY_DEFAULT; }

/** Отпечаток входных значений: номер отделения, город, хэш телефона (HMAC по ключу НП: самого телефона в кэше нет). */
function npSenderFp_() {
  var phone = npPhone_(npProp_('NP_SENDER_PHONE')), h = '-';
  if (phone) {
    try {
      var sig = Utilities.computeHmacSha256Signature(Utilities.newBlob(phone).getBytes(), Utilities.newBlob(npKey_() || 'np').getBytes());
      h = sig.slice(0, 6).map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join('');
    } catch (err) { h = 'x'; }
  }
  return [npSenderWhNum_() || '-', npCityNorm_(npSenderCityName_()), h].join('|');
}

function npSenderCacheOk_(c, fp, now) {
  return !!(c && typeof c === 'object' && c.fp === fp && Number(c.at) > 0 && now - Number(c.at) <= NP_SENDER_TTL_MS && Number(c.at) <= now + 3600000);
}

/** Кэш отправителя, если он свежий и собран для текущих входных значений. Без сети. */
function npSenderCacheRead_() {
  var fp = npSenderFp_(), now = Date.now(), c = null;
  var cache = CacheService.getScriptCache();
  try { var raw = cache.get(NP_SENDER_CACHE_KEY); if (raw) c = JSON.parse(raw); } catch (e1) { c = null; }
  if (npSenderCacheOk_(c, fp, now)) return c;
  c = null;
  try { var p = scriptProps_().getProperty('NP_SENDER_CACHE'); if (p) c = JSON.parse(p); } catch (e2) { c = null; }
  if (!npSenderCacheOk_(c, fp, now)) return null;
  try { cache.put(NP_SENDER_CACHE_KEY, JSON.stringify(c), 21600); } catch (e3) { /* не критично */ }
  return c;
}

function npSenderCacheWrite_(c) {
  var text = JSON.stringify(c);
  try { CacheService.getScriptCache().put(NP_SENDER_CACHE_KEY, text, 21600); } catch (e1) { /* не критично */ }
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return false; // свойство обновится при следующем запуске; кэш на 6 часов уже есть
  try { scriptProps_().setProperty('NP_SENDER_CACHE', text); } finally { lock.releaseLock(); }
  return true;
}

/**
 * Отправитель из свойств-переопределений и кэша. Сетевых вызовов нет.
 * {city, address, ref, contact — Ref-ы или '', phone — 380XXXXXXXXX или null, at — время сборки кэша, cached — есть ли поля из кэша}.
 */
function npSenderState_() {
  var s = { city: npProp_('NP_SENDER_CITY'), address: npProp_('NP_SENDER_ADDRESS'), ref: npProp_('NP_SENDER_REF'), contact: npProp_('NP_SENDER_CONTACT'),
    phone: npPhone_(npProp_('NP_SENDER_PHONE')), at: 0, cached: false };
  if (!npKey_()) return s;
  var c = npSenderCacheRead_();
  if (c) {
    s.at = Number(c.at) || 0;
    ['city', 'address', 'ref', 'contact'].forEach(function (k) { if (!s[k] && c[k] && /^[\w-]{8,64}$/.test(String(c[k]))) { s[k] = String(c[k]); s.cached = true; } });
  }
  return s;
}

/** Функция из ТЗ: отправитель целиком, без сети (свойства → кэш). Для разрешения через API — npSenderResolve_. */
function npSender_() { return npSenderState_(); }

/** Значения, которые нельзя показывать в текстах: телефон отправителя и Ref-ы отправителя. Используется npSafeReason_ (Code.gs). */
function npSecretValues_() {
  var out = [], ph = npPhone_(npProp_('NP_SENDER_PHONE'));
  if (ph) { out.push(ph, ph.slice(-9)); }
  try {
    var s = npSenderState_();
    ['city', 'address', 'ref', 'contact'].forEach(function (k) { if (s[k] && s[k].length >= 8) out.push(s[k]); });
  } catch (err) { /* только то, что есть */ }
  return out;
}

/** Есть ключ и город отправителя (из свойства или кэша): можно считать стоимость (shop.npp). */
function npPriceOn_() { return !!(npKey_() && npSenderState_().city); }

/** Есть ключ и отправитель разрешён целиком (город, отделение, контрагент, контакт, телефон): можно создавать накладные. */
function npTtnOn_() {
  if (!npKey_()) return false;
  var s = npSenderState_();
  return !!(s.city && s.address && s.ref && s.contact && s.phone);
}

var NP_MSG = {
  off: ['Нова пошта не налаштована або дані відправника ще не визначено. Запустіть у таблиці меню PAMIR → «Етап 9Б2: перевірити Нову пошту»', 'Новая почта не настроена или данные отправителя ещё не определены. Запустите в таблице меню PAMIR → «Етап 9Б2: перевірити Нову пошту»'],
  busy: ['Зараз триває інша дія із замовленням. Зачекайте хвилину', 'Сейчас идёт другое действие с заказом. Подождите минуту'],
  not_found: ['Замовлення не знайдено', 'Заказ не найден'],
  test: ['Тестове замовлення: ТТН не створюється', 'Тестовый заказ: ТТН не создаётся'],
  bad_status: ['Для цього статусу замовлення ТТН не створюється', 'Для этого статуса заказа ТТН не создаётся'],
  not_np: ['Це замовлення не на Нову пошту', 'Этот заказ не на Новую почту'],
  courier: ['Кур’єрська доставка: ТТН створіть вручну в кабінеті Нової пошти й введіть номер', 'Курьерская доставка: создайте ТТН вручную в кабинете Новой почты и введите номер'],
  locker: ['Доставка в поштомат: накладну створіть вручну в кабінеті Нової пошти (там вказують розміри місця) і впишіть її номер у замовлення', 'Доставка в почтомат: накладную создайте вручную в кабинете Новой почты (там указывают размеры места) и впишите её номер в заказ'],
  has_ttn: ['У замовлення вже є ТТН', 'У заказа уже есть ТТН'],
  no_ref: ['У замовлення немає коду міста Нової пошти (зроблене до оновлення). Створіть ТТН вручну й введіть номер', 'У заказа нет кода города Новой почты (сделан до обновления). Создайте ТТН вручную и введите номер'],
  wh_unknown: ['Не вдалося однозначно знайти відділення за номером. Створіть ТТН вручну й введіть номер', 'Не удалось однозначно найти отделение по номеру. Создайте ТТН вручную и введите номер'],
  np_error: ['Нова пошта не відповіла. Спробуйте пізніше або створіть ТТН вручну', 'Новая почта не ответила. Попробуйте позже или создайте ТТН вручную'],
  np_api: ['Нова пошта відхилила запит', 'Новая почта отклонила запрос'],
  np_paused: ['Нова пошта тимчасово обмежила запити. Спробуйте через %N% хв.', 'Новая почта временно ограничила запросы. Попробуйте через %N% мин.'],
  np_unknown: ['Відповідь Нової пошти не отримано: накладна могла бути створена. Перевірте кабінет Нової пошти перед повтором (захист від дубля діє 5 хвилин)', 'Ответ Новой почты не получен: накладная могла быть создана. Проверьте кабинет Новой почты перед повтором (защита от дубля действует 5 минут)'],
  save_failed: ['Накладну створено, але номер не записано в замовлення. Введіть номер вручну', 'Накладная создана, но номер не записан в заказ. Введите номер вручную'],
  bad_phone: ['Телефон отримувача не українського формату (+380…). Створіть ТТН вручну', 'Телефон получателя не украинского формата (+380…). Создайте ТТН вручную'],
  bad_name: ['Вкажіть отримувача: прізвище та ім’я (два-три слова)', 'Укажите получателя: фамилия и имя (два-три слова)'],
  bad_weight: ['Вкажіть вагу від 100 г до 30 кг', 'Укажите вес от 100 г до 30 кг'],
  bad_dims: ['Вкажіть ширину, довжину й висоту посилки в сантиметрах (числа від 1 до 120)', 'Укажите ширину, длину и высоту посылки в сантиметрах (числа от 1 до 120)'],
  dims_small: ['Посилка замала: мінімальний об\'єм 0,0004 м³ (наприклад 10×10×4 см)', 'Посылка слишком маленькая: минимальный объём 0,0004 м³ (например 10×10×4 см)'],
  bad_amount: ['Сума не збігається із замовленням. Відкрийте підтвердження ще раз', 'Сумма не совпадает с заказом. Откройте подтверждение ещё раз'],
  not_confirmed: ['Потрібне підтвердження', 'Нужно подтверждение'],
  city_diff: ['Місто в замовленні не збігається з містом Нової пошти за кодом. Перевірте адресу й підтвердіть створення ще раз', 'Город в заказе не совпадает с городом Новой почты по коду. Проверьте адрес и подтвердите создание ещё раз'],
  del_no: ['Цю накладну не можна видалити звідси: її створено не через магазин. Видаліть її в кабінеті Нової пошти', 'Эту накладную нельзя удалить отсюда: она создана не через магазин. Удалите её в кабинете Новой почты'],
  del_real: ['Видалити з панелі можна лише пробну накладну. Справжню — у кабінеті Нової пошти', 'Удалить из панели можно только пробную накладную. Настоящую — в кабинете Новой почты'],
  del_old: ['Минуло понад 24 години після створення. Видаліть накладну в кабінеті Нової пошти', 'Прошло больше 24 часов после создания. Удалите накладную в кабинете Новой почты'],
  del_partial: ['У Новій пошті накладну видалено, але номер у замовленні лишився. Зітріть номер у колонці «ТТН» цього замовлення; інші комірки не чіпайте.', 'В Новой почте накладная удалена, но номер в заказе остался. Сотрите номер в колонке «ТТН» этого заказа; другие ячейки не трогайте.'],
  del_other: ['Пробну накладну в Новій пошті видалено. У замовленні вже інший номер — його не чіпали.', 'Пробная накладная в Новой почте удалена. В заказе уже другой номер — его не трогали.'],
  del_done: ['Накладну вже видалено, нічого робити не треба', 'Накладная уже удалена, делать ничего не нужно']
};

/** Накладной в заказе уже нет: для витрины это успех (ok:true), с поясняющим текстом. */
function npDelDone_() {
  var m = NP_MSG.del_done;
  return { ok: true, done: 'del_done', msg: { ua: m[0], ru: m[1] } };
}

/** Ошибка габаритов: код всегда bad_dims; текст зависит от причины (слишком малый объём — свой текст). */
function npDimsFail_(vol) {
  var m = NP_MSG[vol && vol.small ? 'dims_small' : 'bad_dims'];
  return { ok: false, error: 'bad_dims', msg: { ua: m[0], ru: m[1] } };
}

function npFail_(code, extra) {
  var m = NP_MSG[code] || ['Помилка', 'Ошибка'];
  var n = code === 'np_paused' ? npPauseMin_() : 0; // «Спробуйте через N хв.»: N — остаток паузы из-за лимита НП
  var out = { ok: false, error: code, msg: { ua: n ? m[0].replace('%N%', String(n)) : m[0], ru: n ? m[1].replace('%N%', String(n)) : m[1] } };
  if (n) out.retryAfter = npPauseLeftSec_();
  if (extra) Object.keys(extra).forEach(function (k) { out[k] = extra[k]; });
  return out;
}

/* ---------- 0. Общие запросы: страницы списков ---------- */

/**
 * Список методом с перебором страниц (Page — по открытым библиотекам; не сверено с документацией). Останавливается на пустой странице,
 * на странице без новых записей (если Page игнорируется) и на maxPages. limit (если задан) — размер страницы в Limit.
 * Возвращает {items} или {err: {api, text, nocall}}. Все запросы — админский счётчик, без кэша ответа.
 */
function npPaged_(model, method, base, maxPages, limit) {
  var items = [], seen = {};
  for (var page = 1; page <= maxPages; page++) {
    var props = {};
    Object.keys(base).forEach(function (k) { props[k] = base[k]; });
    props.Page = String(page);
    if (limit) props.Limit = String(limit);
    var eo = {};
    var data = npCall_(method, props, { model: model, noCache: true, quiet: true, admin: true, errOut: eo });
    if (!data) return { items: items, err: { api: eo.api === true, text: eo.text || '', nocall: eo.nocall === true, paused: eo.paused === true, retryAfter: eo.retryAfter || 0 } }; // первая же ошибка (и пауза из-за лимита) останавливает перебор
    if (!data.length) break;
    var fresh = 0;
    data.forEach(function (x) {
      var id = x && x.Ref ? String(x.Ref) : JSON.stringify(x);
      if (seen[id]) return;
      seen[id] = true; fresh++; items.push(x);
    });
    if (!fresh) break;
    if (limit && data.length < limit) break;
  }
  return { items: items };
}

/**
 * Отделение (или почтомат) города по номеру. Порядок (выпуск 9Б3, чтобы тратить меньше запросов НП):
 *   1) кэш этого номера (найдено — 24 ч в двух слоях, «не найдено» — 1 ч);
 *   2) список отделений города, если он уже в кэше (его кладёт np.whall и полный перебор ниже): поиск без сети;
 *   3) узкий запрос (CityRef + WarehouseId = номер строкой), как раньше;
 *   4) только если узкий не дал ответа — полный список города (страницы по 500, останавливается на первой ошибке и на паузе из-за лимита),
 *      он остаётся в кэше на 24 часа и потом служит и np.whall, и другим номерам.
 * Результат всегда проверяется на своей стороне: Number === номер, CityRef города (если поле есть в ответе), тип, один результат.
 * Возвращает {ref, num, desc, city, cityRu} или {error: 'wh_unknown'|'np_error'|'np_api'|'np_paused', text, retryAfter}.
 * Не сверено с документацией: имена полей Number, CityRef, CategoryOfWarehouse, Description и параметры Page/Limit/WarehouseId — по библиотекам и указанию владельца.
 */
function npFindWarehouse_(cityRef, num, locker) {
  cityRef = String(cityRef || '');
  if (!NP_UUID_RE.test(cityRef) || !(num > 0)) return { error: 'wh_unknown' };
  function pick(items) {
    return items.filter(function (w) {
      if (!w || parseInt(w.Number, 10) !== num || !NP_UUID_RE.test(String(w.Ref || ''))) return false;
      if (w.CityRef && String(w.CityRef).toLowerCase() !== cityRef.toLowerCase()) return false;
      var isLocker = String(w.CategoryOfWarehouse || '') === 'Postomat' || /по[чш]тома[тн]/i.test(String(w.Description || ''));
      return isLocker === !!locker;
    });
  }
  var ck = 'npwf_' + cityRef.toLowerCase() + '_' + num + (locker ? 'l' : 'b');
  function cached() {
    var t = npCacheGet_(ck, true);
    if (t === null) return null;
    try { return JSON.parse(t); } catch (e0) { return null; }
  }
  function store(res) { // найдено — 24 ч (оба слоя), «не найдено» — 1 ч (только быстрый); сбои связи не кэшируются
    npCachePut_(ck, JSON.stringify(res), res.error ? NP_TTL_EMPTY : NP_TTL_LONG);
    return res;
  }
  function fail(err) {
    if (err && err.paused) return { error: 'np_paused', retryAfter: err.retryAfter || 0 };
    return { error: err && err.api ? 'np_api' : 'np_error', text: err && err.text || '' };
  }
  var hit = cached();
  if (hit) return hit;
  var list = npWhPeek_(cityRef);
  if (list) return store(npWhFromList_(list, num, locker));
  var lead = npLead_(ck, 6, cached);
  if (lead.value !== undefined) return lead.value;
  if (!lead.lead) return { error: 'np_error', text: '' };
  try {
    var r = npPaged_('Address', 'getWarehouses', { CityRef: cityRef, WarehouseId: String(num) }, 3, NP_WH_PAGE); // узкий запрос (WarehouseId по указанию владельца)
    if (r.err) return fail(r.err);
    var hits = pick(r.items);
    if (!hits.length) {
      var eo = {};
      list = npWhLoad_(cityRef, true, eo); // узкий запрос пуст: полный список города, он же попадёт в кэш
      if (!list) return eo.text || eo.paused ? fail({ api: eo.api === true, text: eo.text || '', paused: eo.paused === true, retryAfter: eo.retryAfter || 0 }) : { error: 'np_error', text: '' };
      return store(npWhFromList_(list, num, locker));
    }
    if (hits.length !== 1) return store({ error: 'wh_unknown' });
    var w = hits[0];
    return store({ ref: String(w.Ref), num: String(num), desc: String(w.Description || '').slice(0, 140), city: String(w.CityDescription || '').slice(0, 60), cityRu: String(w.CityDescriptionRu || '').slice(0, 60) });
  } finally {
    lead.done();
  }
}

/* ---------- 0б. Отправитель: разрешение через API, кэш, тревога ---------- */

var NP_SMSG = {
  no_key: ['Ключ Нової пошти (NP_API_KEY) не задано', 'Ключ Новой почты (NP_API_KEY) не задан'],
  api: ['Нова пошта відхилила запит', 'Новая почта отклонила запрос'],
  net: ['Нова пошта не відповіла', 'Новая почта не ответила'],
  city_none: ['Місто відправника не знайдено у Нової пошти. Перевірте NP_SENDER_CITY_NAME або впишіть код міста в NP_SENDER_CITY', 'Город отправителя не найден в Новой почте. Проверьте NP_SENDER_CITY_NAME или впишите код города в NP_SENDER_CITY'],
  city_many: ['Знайдено кілька міст з такою назвою. Впишіть код потрібного міста в NP_SENDER_CITY (список кодів покаже пункт меню PAMIR «Етап 9Б2: перевірити Нову пошту»)', 'Найдено несколько городов с таким названием. Впишите код нужного города в NP_SENDER_CITY (список кодов покажет пункт меню PAMIR «Етап 9Б2: перевірити Нову пошту»)'],
  wh_none: ['Відділення з номером із NP_SENDER_WAREHOUSE не знайдено в цьому місті (або їх кілька). Перевірте номер або впишіть код відділення в NP_SENDER_ADDRESS', 'Отделение с номером из NP_SENDER_WAREHOUSE не найдено в этом городе (или их несколько). Проверьте номер или впишите код отделения в NP_SENDER_ADDRESS'],
  cp_none: ['У кабінеті Нової пошти немає контрагента-відправника. Впишіть його код у NP_SENDER_REF', 'В кабинете Новой почты нет контрагента-отправителя. Впишите его код в NP_SENDER_REF'],
  cp_many: ['У кабінеті кілька відправників: який саме — невідомо. Впишіть код потрібного в NP_SENDER_REF (список кодів покаже пункт меню PAMIR «Етап 9Б2: перевірити Нову пошту»)', 'В кабинете несколько отправителей: какой именно — неизвестно. Впишите код нужного в NP_SENDER_REF (список кодов покажет пункт меню PAMIR «Етап 9Б2: перевірити Нову пошту»)'],
  ct_none: ['У відправника немає контактної особи. Впишіть її код у NP_SENDER_CONTACT', 'У отправителя нет контактного лица. Впишите её код в NP_SENDER_CONTACT'],
  ct_many: ['Контактних осіб кілька, а телефон із NP_SENDER_PHONE не підійшов ні до однієї. Перевірте телефон або впишіть код контакту в NP_SENDER_CONTACT (список кодів покаже пункт меню PAMIR «Етап 9Б2: перевірити Нову пошту»)', 'Контактных лиц несколько, а телефон из NP_SENDER_PHONE не подошёл ни к одной. Проверьте телефон или впишите код контакта в NP_SENDER_CONTACT (список кодов покажет пункт меню PAMIR «Етап 9Б2: перевірити Нову пошту»)'],
  phone_bad: ['NP_SENDER_PHONE має неправильний формат (потрібно 380XXXXXXXXX, +380XXXXXXXXX або 0XXXXXXXXX)', 'NP_SENDER_PHONE в неправильном формате (нужно 380XXXXXXXXX, +380XXXXXXXXX или 0XXXXXXXXX)'],
  bad_resp: ['Відповідь Нової пошти має незвичний вигляд', 'Ответ Новой почты имеет необычный вид'],
  paused: ['Нова пошта тимчасово обмежила запити. Спробуйте через %N% хв.', 'Новая почта временно ограничила запросы. Попробуйте через %N% мин.']
};

function npSmsg_(code, lang, text) {
  var m = NP_SMSG[code] || ['Помилка', 'Ошибка'];
  var s = lang === 'ru' ? m[1] : m[0];
  if (code === 'paused') return s.replace('%N%', String(npPauseMin_()));
  if (text && (code === 'api' || code === 'net')) s += ' (' + npSafeReason_(text, npKey_(), 120) + ')';
  return s;
}

/** Итог шага запроса к API → ошибка шага. */
function npStepErr_(err) { return { code: npErrCode_(err), text: err.text || '' }; }

/** Код причины шага из ошибки запроса: пауза из-за лимита, отказ API или обрыв связи. */
function npErrCode_(err) { return err && err.paused ? 'paused' : err && err.api ? 'api' : 'net'; }

/**
 * Разрешает отправителя через API (читающие запросы) и сохраняет кэш. Вызывать ВНЕ LockService. Заданные свойства-переопределения не запрашиваются.
 * Возвращает { ok, errs: [{code, text, n}], steps: {city, wh, cp, ct, phone}, sender }, где у шага: state 'override'|'ok'|'kept'|'err'|'skip', name (для меню).
 * Что нашлось — сохраняется, даже если другие шаги не удались (город уже позволяет считать стоимость).
 * opts.reuse (hourlyJob, кэш свежий): шаги, у которых в кэше уже есть значение, не запрашиваются повторно (state 'cached'); без opts запрашивается всё (меню).
 * Первая же ошибка лимита НП ставит паузу: остальные шаги сети не касаются (npCall_ отвечает «paused» сразу).
 */
function npSenderResolve_(opts) {
  var reuse = !!(opts && opts.reuse), reused = false;
  // cands — варианты при неоднозначности (с Ref-ами) ТОЛЬКО для окна меню владельца; не попадает в ответы API, Telegram и логи.
  var res = { ok: true, errs: [], steps: {}, sender: null, cands: {} };
  if (!npKey_()) { res.ok = false; res.errs.push({ code: 'no_key' }); return res; }
  var fp = npSenderFp_(), now = Date.now(), old = npSenderCacheRead_();
  var out = { city: '', address: '', ref: '', contact: '' };
  var ov = { city: npProp_('NP_SENDER_CITY'), address: npProp_('NP_SENDER_ADDRESS'), ref: npProp_('NP_SENDER_REF'), contact: npProp_('NP_SENDER_CONTACT') };
  var whNum = npSenderWhNum_();
  function bad(step, code, extra) {
    var e = { code: code }; if (extra) Object.keys(extra).forEach(function (k) { e[k] = extra[k]; });
    res.errs.push(e); res.steps[step] = { state: 'err', code: code }; res.ok = false;
  }
  function have(k) { return reuse && old && old[k] && /^[\w-]{8,64}$/.test(String(old[k])) ? String(old[k]) : ''; } // значение из свежего кэша, если его можно не перезапрашивать
  function keep(k, step) { // этап не удался: прежнее значение из кэша (если оно свежее) лучше, чем ничего
    if (old && old[k] && /^[\w-]{8,64}$/.test(String(old[k]))) { out[k] = String(old[k]); res.steps[step].state = 'kept'; }
  }

  // 1. Город: getCities(FindByString), точное совпадение названия (не сверено с документацией)
  var cityRef = ov.city;
  if (ov.city) res.steps.city = { state: 'override' };
  else if (have('city')) { cityRef = have('city'); out.city = cityRef; res.steps.city = { state: 'cached' }; reused = true; }
  else {
    var name = npSenderCityName_(), want = npCityNorm_(name);
    var rc = npPaged_('Address', 'getCities', { FindByString: name }, 3, 100);
    if (rc.err) bad('city', npErrCode_(rc.err), { text: rc.err.text });
    else {
      var cm = rc.items.filter(function (c) { return c && NP_UUID_RE.test(String(c.Ref || '')) && (npCityNorm_(c.Description) === want || npCityNorm_(c.DescriptionRu) === want); });
      if (cm.length === 0) bad('city', 'city_none');
      else if (cm.length > 1) { bad('city', 'city_many'); res.cands.city = cm.slice(0, 10).map(function (c) { return { name: String(c.Description || ''), area: String(c.AreaDescription || ''), ref: String(c.Ref) }; }); }
      else { cityRef = String(cm[0].Ref); out.city = cityRef; res.steps.city = { state: 'ok', name: String(cm[0].Description || name).slice(0, 60) }; }
    }
    if (res.steps.city.state === 'err') { keep('city', 'city'); cityRef = out.city; }
  }

  // 2. Отделение по номеру: getWarehouses по городу, точная проверка Number и CityRef
  if (ov.address) res.steps.wh = { state: 'override' };
  else if (!whNum) res.steps.wh = { state: 'skip' };
  else if (!cityRef) { res.steps.wh = { state: 'skip', dep: 'city' }; keep('address', 'wh'); }
  else if (have('address') && res.steps.city.state === 'cached') { out.address = have('address'); res.steps.wh = { state: 'cached', n: whNum }; reused = true; }
  else {
    var wh = npFindWarehouse_(cityRef, whNum, false);
    if (wh.error) { bad('wh', wh.error === 'wh_unknown' ? 'wh_none' : wh.error === 'np_paused' ? 'paused' : wh.error === 'np_api' ? 'api' : 'net', { text: wh.text, n: whNum }); keep('address', 'wh'); }
    else { out.address = wh.ref; res.steps.wh = { state: 'ok', name: wh.desc, n: whNum }; }
  }

  // 3. Контрагент-отправитель: ровно один (не сверено с документацией: CounterpartyProperty 'Sender')
  var cpRef = ov.ref;
  if (ov.ref) res.steps.cp = { state: 'override' };
  else if (have('ref')) { cpRef = have('ref'); out.ref = cpRef; res.steps.cp = { state: 'cached' }; reused = true; }
  else {
    var rp = npPaged_('Counterparty', 'getCounterparties', { CounterpartyProperty: 'Sender' }, 2, 100);
    if (rp.err) bad('cp', npErrCode_(rp.err), { text: rp.err.text });
    else {
      var cps = rp.items.filter(function (c) { return c && NP_UUID_RE.test(String(c.Ref || '')); });
      if (cps.length === 0) bad('cp', 'cp_none');
      else if (cps.length > 1) { bad('cp', 'cp_many'); res.cands.cp = cps.slice(0, 10).map(function (c) { return { name: String(c.Description || ''), ref: String(c.Ref) }; }); }
      else { cpRef = String(cps[0].Ref); out.ref = cpRef; res.steps.cp = { state: 'ok', name: String(cps[0].Description || '').slice(0, 60) }; }
    }
    if (res.steps.cp.state === 'err') { keep('ref', 'cp'); cpRef = out.ref; }
  }

  // 4. Контактное лицо: телефон совпал с NP_SENDER_PHONE; нет совпадения, но контакт один — он (не сверено: Counterparty.getCounterpartyContactPersons, поле Phones)
  var phoneRaw = npProp_('NP_SENDER_PHONE'), phone = npPhone_(phoneRaw);
  if (ov.contact) res.steps.ct = { state: 'override' };
  else if (!cpRef) { res.steps.ct = { state: 'skip', dep: 'cp' }; keep('contact', 'ct'); }
  else if (have('contact') && res.steps.cp.state === 'cached') { out.contact = have('contact'); res.steps.ct = { state: 'cached' }; reused = true; }
  else {
    var rt = npPaged_('Counterparty', 'getCounterpartyContactPersons', { Ref: cpRef }, 2, 100);
    if (rt.err) { bad('ct', npErrCode_(rt.err), { text: rt.err.text }); keep('contact', 'ct'); }
    else {
      var cts = rt.items.filter(function (c) { return c && NP_UUID_RE.test(String(c.Ref || '')); });
      var picked = null;
      if (phone) {
        var tail = phone.slice(-9);
        cts.forEach(function (c) { if (!picked && String(c.Phones || c.Phone || '').replace(/\D/g, '').indexOf(tail) >= 0) picked = c; });
      }
      if (!picked && cts.length === 1) picked = cts[0];
      if (picked) { out.contact = String(picked.Ref); res.steps.ct = { state: 'ok', name: String(picked.Description || '').slice(0, 60) }; }
      else {
        bad('ct', cts.length ? 'ct_many' : 'ct_none'); keep('contact', 'ct');
        if (cts.length) res.cands.ct = cts.slice(0, 10).map(function (c) { return { name: String(c.Description || ''), ref: String(c.Ref) }; }); // телефоны не берём
      }
    }
  }

  // 5. Телефон: только проверка формата (по API он не находится)
  if (phoneRaw && !phone) { res.steps.phone = { state: 'err', code: 'phone_bad' }; res.errs.push({ code: 'phone_bad' }); res.ok = false; }
  else res.steps.phone = { state: phone ? 'ok' : 'skip' };

  // Кэш: только то, что нашлось через API (переопределения читаются из свойств каждый раз)
  var any = out.city || out.address || out.ref || out.contact;
  if (any) {
    var complete = res.ok;
    var hadCity = !!npSenderState_().city;
    npSenderCacheWrite_({ fp: fp, at: (complete && !reused) || !old ? now : Number(old.at) || now, city: out.city, address: out.address, ref: out.ref, contact: out.contact });
    if (!hadCity && out.city && typeof clearCatalogCache_ === 'function') { try { clearCatalogCache_(); } catch (err) { /* кэш каталога обновится сам */ } }
  }
  res.sender = npSenderState_();
  return res;
}

/** Текст проблемы отправителя из итога npSenderResolve_: [ua, ru]. */
function npSenderProblemText_(res) {
  var ua = [], ru = [];
  res.errs.forEach(function (e) { ua.push(npSmsg_(e.code, 'ua', e.text)); ru.push(npSmsg_(e.code, 'ru', e.text)); });
  var tailUa = 'Магазин працює як раніше; вартість доставки та «Створити ТТН» вимкнені, поки це не виправлено. Запустіть у таблиці меню PAMIR → «Етап 9Б2: перевірити Нову пошту».';
  var tailRu = 'Магазин работает как раньше; стоимость доставки и «Створити ТТН» выключены, пока это не исправлено. Запустите в таблице меню PAMIR → «Етап 9Б2: перевірити Нову пошту».';
  return ['Нова пошта: не вдалося визначити дані відправника.\n- ' + ua.join('\n- ') + '\n' + tailUa, 'Новая почта: не удалось определить данные отправителя.\n- ' + ru.join('\n- ') + '\n' + tailRu];
}

/** Служебная тревога админам с правом «Замовлення: статуси»: не чаще раза в 24 часа (NP_ALERT_LAST). Возвращает true, если отправлено. */
function npAlertAdmins_(ua, ru) {
  try {
    var props = scriptProps_(), day = 24 * 3600 * 1000, now = Date.now();
    if (now - (Number(props.getProperty('NP_ALERT_LAST')) || 0) < day) return false;
    var lock = LockService.getScriptLock();
    if (!lock.tryLock(3000)) return false;
    try {
      if (now - (Number(props.fresh('NP_ALERT_LAST')) || 0) < day) return false; // кто-то успел раньше
      props.setProperty('NP_ALERT_LAST', String(now));
    } finally {
      lock.releaseLock();
    }
    var token = props.getProperty('BOT_TOKEN');
    if (!token) return false;
    var ids = adminList_(props).filter(function (a) { return a.active && a.perms && a.perms.st; }).map(function (a) { return a.id; });
    var text = npSafeReason_(ua, npKey_(), 1500).length ? ua + '\n\n' + ru : '';
    ids.forEach(function (id) { tg_(token, 'sendMessage', { chat_id: id, text: text }); });
    return ids.length > 0;
  } catch (err) {
    console.warn('np alert failed');
    return false;
  }
}

/**
 * Из hourlyJob: если есть ключ и NP_SENDER_WAREHOUSE или NP_SENDER_PHONE, а Ref-ов в свойствах и кэше не хватает (или кэшу больше 5 дней из 7) —
 * разрешает отправителя через API. Не удалось — админам одно сообщение в сутки; витрина остаётся без стоимости доставки и ТТН.
 * Выпуск 9Б3: неудачная попытка не повторяется каждый час — следующая через 1 ч, потом 6 ч, потом 24 ч (NP_SENDER_RETRY; смена входных значений
 * сбрасывает отсчёт). Пока идёт пауза из-за лимита НП, попытки нет и она в счёт не идёт. Свежий кэш без пробелов не обновляется заново:
 * запрашиваются только недостающие шаги. При неудачном обновлении остаётся прежний кэш до конца срока (7 дней).
 * Возвращает 1, если запрашивали API.
 */
function npSenderJob_() {
  if (!npKey_()) return 0;
  var whNum = npSenderWhNum_(), hasPhone = !!npProp_('NP_SENDER_PHONE');
  if (!whNum && !hasPhone) return 0;
  var s = npSenderState_();
  var need = !s.city || !s.ref || !s.contact || (whNum > 0 && !s.address);
  var stale = s.cached && s.at > 0 && Date.now() - s.at > NP_SENDER_REFRESH_MS;
  if (need || stale) {
    if (npPauseLeftSec_() > 0) return 0;
    var fp = npSenderFp_(), bo = npSenderBackoff_();
    if (bo && bo.fp === fp && Number(bo.next) > Date.now()) return 0; // прошлая попытка не удалась: ждём
    var res = npSenderResolve_({ reuse: !stale });
    var real = res.errs.filter(function (e) { return e.code !== 'paused'; }); // лимит НП — не ошибка настроек: о нём уже есть своё сообщение
    if (!res.errs.length) npSenderBackoffClear_();
    else if (real.length) npSenderBackoffSet_((bo && bo.fp === fp ? Number(bo.n) || 0 : 0) + 1, fp);
    if (real.length) { var t = npSenderProblemText_({ errs: real }); npAlertAdmins_(t[0], t[1]); }
    return 1;
  }
  if (hasPhone && !s.phone) { var t2 = npSenderProblemText_({ errs: [{ code: 'phone_bad' }] }); npAlertAdmins_(t2[0], t2[1]); }
  return 0;
}

/* ---------- 0в. Меню «Етап 9Б2: перевірити Нову пошту»: только читающие запросы ---------- */

function stage9b2CheckNp() {
  var lines = [], key = npKey_();
  if (!key) {
    var no = 'Ключ: немає.\nВпишіть ключ Нової пошти в Script Properties під назвою NP_API_KEY і запустіть цей пункт ще раз.';
    s9Alert_(no);
    return { ok: false, message: no };
  }
  lines.push('Ключ: є');
  if (npPauseLeftSec_() > 0) { // пауза после «To many requests»: сети нет вообще
    var pm = npSmsg_('paused', 'ua');
    s9Alert_(pm);
    return { ok: false, message: pm, paused: true, retryAfter: npPauseLeftSec_() };
  }
  var res = npSenderResolve_(), st = res.steps;
  if (res.ok) npSenderBackoffClear_();
  function nm(s) { return s && s.name ? ' (' + npSafeReason_(s.name, key, 90) + ')' : ''; }
  function why(e) { return ': ' + npSmsg_(e.code, 'ua', e.text); }
  function errOf(step) { var r = ''; res.errs.forEach(function (e) { if (st[step] && st[step].code === e.code && !r) r = why(e); }); return r; }
  var cityName = npSafeReason_(npSenderCityName_(), key, 60);
  lines.push('Місто відправника: ' + (st.city.state === 'override' ? 'задано вручну (NP_SENDER_CITY)' : st.city.state === 'ok' ? 'знайдено' + nm(st.city) : st.city.state === 'kept' ? 'використано збережене значення (запит не вдався)' + errOf('city') : 'не знайдено «' + cityName + '»' + errOf('city')));
  var whLabel = 'Відділення' + (npSenderWhNum_() ? ' №' + npSenderWhNum_() : '');
  lines.push(whLabel + ': ' + (st.wh.state === 'override' ? 'задано вручну (NP_SENDER_ADDRESS)' : st.wh.state === 'ok' ? 'знайдено' + nm(st.wh) : st.wh.state === 'kept' ? 'використано збережене значення (запит не вдався)' + errOf('wh')
    : st.wh.state === 'skip' ? (st.wh.dep ? 'не перевірено: немає міста' : 'не задано NP_SENDER_WAREHOUSE (номер відділення): «Створити ТТН» вимкнено') : 'не знайдено' + errOf('wh')));
  lines.push('Відправник: ' + (st.cp.state === 'override' ? 'задано вручну (NP_SENDER_REF)' : st.cp.state === 'ok' ? 'знайдено' + nm(st.cp) : st.cp.state === 'kept' ? 'використано збережене значення (запит не вдався)' + errOf('cp') : 'не визначено' + errOf('cp')));
  lines.push('Контакт: ' + (st.ct.state === 'override' ? 'задано вручну (NP_SENDER_CONTACT)' : st.ct.state === 'ok' ? 'знайдено' : st.ct.state === 'kept' ? 'використано збережене значення (запит не вдався)' + errOf('ct') : st.ct.state === 'skip' ? 'не перевірено: немає відправника' : 'не визначено' + errOf('ct')));
  lines.push('Телефон відправника: ' + (st.phone.state === 'ok' ? 'задано' : st.phone.state === 'err' ? 'неправильний формат (NP_SENDER_PHONE)' : 'не задано (NP_SENDER_PHONE): «Створити ТТН» вимкнено'));
  // Неоднозначность: пронумерованный список с кодами (Ref) — только в этом окне владельца. Телефоны контактов не показываются.
  function listBlock(title, arr, prop, fmt) {
    if (!arr || !arr.length) return;
    lines.push('');
    lines.push(title);
    arr.forEach(function (c, i) { lines.push((i + 1) + '. ' + fmt(c) + ' — ' + c.ref); });
    lines.push('Скопіюйте код потрібного рядка в Script Properties → ' + prop + ' (Розширення → Apps Script → Налаштування проєкту → Властивості скрипта)');
  }
  var sf = function (v, n) { return npSafeReason_(String(v || ''), key, n || 90); };
  listBlock('Знайдено кілька міст «' + cityName + '»:', res.cands.city, 'NP_SENDER_CITY', function (c) { return sf(c.name) + (c.area ? ' (' + sf(c.area) + ')' : ''); });
  listBlock('У кабінеті кілька відправників:', res.cands.cp, 'NP_SENDER_REF', function (c) { return sf(c.name) || 'без назви'; });
  listBlock('Контактних осіб кілька:', res.cands.ct, 'NP_SENDER_CONTACT', function (c) { return sf(c.name) || 'без імені'; });
  var codes = {};
  res.errs.forEach(function (e) { codes[e.code] = true; });
  if (codes.city_none) { lines.push(''); lines.push('Місто не знайдено: перевірте написання в NP_SENDER_CITY_NAME (за замовчуванням «Харків») або впишіть код міста в NP_SENDER_CITY.'); }
  if (codes.cp_none) { lines.push(''); lines.push('Відправників не знайдено: перевірте в кабінеті Нової пошти, що ключ NP_API_KEY активний і що в кабінеті є контрагент-відправник.'); }
  if (codes.ct_none) { lines.push(''); lines.push('Контактних осіб не знайдено: перевірте в кабінеті Нової пошти, що у відправника є контактна особа.'); }
  // Пробная стоимость: Харьков → Киев, 1 кг (читающий запрос)
  var s = res.sender || npSenderState_();
  if (!s.city) lines.push('Вартість доставки 1 кг до Києва: не перевірено, бо невідоме місто відправника');
  else {
    var kyiv = npPaged_('Address', 'getCities', { FindByString: 'Київ' }, 2, 100), kref = '';
    if (!kyiv.err) { var km = kyiv.items.filter(function (c) { return c && NP_UUID_RE.test(String(c.Ref || '')) && (npCityNorm_(c.Description) === 'київ' || npCityNorm_(c.DescriptionRu) === 'киев'); }); if (km.length === 1) kref = String(km[0].Ref); }
    if (!kref) lines.push('Вартість доставки 1 кг до Києва: не вдалося визначити Київ у Нової пошти' + (kyiv.err ? ': ' + npSmsg_(npErrCode_(kyiv.err), 'ua', kyiv.err.text) : ''));
    else {
      var eo = {};
      var pr = npCall_('getDocumentPrice', { CitySender: s.city, CityRecipient: kref, Weight: '1', ServiceType: 'WarehouseWarehouse', Cost: '200', CargoType: 'Parcel', SeatsAmount: '1' },
        { model: 'InternetDocument', noCache: true, quiet: true, admin: true, errOut: eo });
      var price = pr && pr[0] ? Math.round(Number(pr[0].Cost)) : 0;
      lines.push('Вартість доставки 1 кг до Києва: ' + (price > 0 ? String(price).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₴' : 'не вдалося дізнатися' + (eo.text ? ': ' + npSmsg_(npErrCode_(eo), 'ua', eo.text) : '')));
    }
  }
  var price1 = !!(npKey_() && s.city), ttn1 = npTtnOn_();
  lines.push('');
  lines.push(price1 ? 'Вартість доставки на сайті: увімкнено.' : 'Вартість доставки на сайті: вимкнено.');
  lines.push(ttn1 ? 'Кнопка «Створити ТТН»: увімкнено.' : 'Кнопка «Створити ТТН»: вимкнено (потрібні місто, відділення, відправник, контакт і телефон).');
  if (npPauseLeftSec_() > 0) { lines.push(''); lines.push(npSmsg_('paused', 'ua') + ' Частину перевірок не виконано.'); }
  lines.push('У Нової пошти нічого не створено: були лише запити на читання.');
  var text = lines.join('\n');
  s9Alert_(text);
  return { ok: true, message: text, price: price1, ttn: ttn1 };
}

/* ---------- 1. Стоимость доставки: ?action=np.price&city=<Ref>&w=<граммы>&sum=<сумма корзины> ---------- */

/**
 * Ответ {ok:true, cost:целое ₴} или {ok:false, error:'off'|'bad_form'|'busy'|'np_error'}. Вес — в граммах, округляется вверх до 0,5 кг
 * и ограничивается 0,5…30 кг. sum — только объявленная стоимость для тарифа: ограничена 200…50 000 и округлена вверх до 500,
 * на цены и суммы заказа не влияет. Кэш — по (город, вес, ступень суммы).
 * InternetDocument.getDocumentPrice: поля запроса и ответа — по библиотекам, не сверено с документацией.
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
  var ckey = 'npp_' + city.toLowerCase() + '_' + kg + '_' + cost + '_' + npSenderTag_(); // тариф зависит и от города отправителя: смена города — новый ключ
  var hit = npCacheGet_(ckey, true);
  if (hit && /^\d+$/.test(hit)) return { ok: true, cost: Number(hit) };
  var left = npPauseLeftSec_();
  if (left > 0) return { ok: false, error: 'np_error', retryAfter: left }; // пауза из-за лимита НП: сети нет, витрина не должна спрашивать снова
  var lead = npLead_(ckey, 6, function () { var v = npCacheGet_(ckey, true); return v && /^\d+$/.test(v) ? v : null; });
  if (lead.value !== undefined) return { ok: true, cost: Number(lead.value) };
  if (!lead.lead) return { ok: false, error: 'busy' }; // тот же расчёт уже идёт: дубль не шлём
  try {
  var now = Date.now(), parts = String(cache.get('npp_calls') || '').split('|');
  var calls = parseInt(parts[0], 10) || 0, t0 = parseInt(parts[1], 10) || now;
  if (now - t0 > 3600000) { calls = 0; t0 = now; }
  if (calls >= NP_PRICE_MAX_PER_HOUR) return { ok: false, error: 'busy' };
  cache.put('npp_calls', (calls + 1) + '|' + t0, 3600);
  var eo = {};
  var data = npCall_('getDocumentPrice', {
    CitySender: npSenderState_().city, CityRecipient: city, Weight: String(kg), ServiceType: 'WarehouseWarehouse',
    Cost: String(cost), CargoType: 'Parcel', SeatsAmount: '1'
  }, { model: 'InternetDocument', noCache: true, quiet: true, errOut: eo });
  var price = data && data[0] ? Math.round(Number(data[0].Cost)) : 0;
  if (!(price > 0) || price > 100000) {
    // Отказ самого API (не лимит запросов и не обрыв связи): админам одно простое сообщение в сутки (общая отметка NP_ALERT_LAST). Покупатель просто не видит строку.
    if (!data && eo.api === true && eo.nocall !== true) {
      npAlertAdmins_('Нова пошта: не вдалося порахувати вартість доставки для покупців (Нова пошта відмовила у запиті). Покупці просто не бачать вартість доставки, замовлення працюють як раніше. Перевірте ключ NP_API_KEY у кабінеті Нової пошти і запустіть у таблиці меню PAMIR → «Етап 9Б2: перевірити Нову пошту».',
        'Новая почта: не удалось рассчитать стоимость доставки для покупателей (Новая почта отклонила запрос). Покупатели просто не видят стоимость доставки, заказы работают как раньше. Проверьте ключ NP_API_KEY в кабинете Новой почты и запустите в таблице меню PAMIR → «Етап 9Б2: перевірити Нову пошту».');
    }
    return npRetry_({ ok: false, error: 'np_error' }, eo);
  }
  npCachePut_(ckey, String(price), NP_PRICE_TTL);
  return { ok: true, cost: price };
  } finally {
    lead.done();
  }
}

/** Короткая метка города отправителя для ключа кэша стоимости (HMAC по ключу НП: самого Ref в кэше и в листе нет). */
function npSenderTag_() {
  var city = npSenderState_().city;
  if (!city) return '-';
  try {
    var sig = Utilities.computeHmacSha256Signature(Utilities.newBlob(city).getBytes(), Utilities.newBlob(npKey_() || 'np').getBytes());
    return sig.slice(0, 4).map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join('');
  } catch (err) { return 'x'; }
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

function npName_(v) {
  var s = String(v === null || v === undefined ? '' : v).replace(/\s+/g, ' ').trim();
  var words = s.split(' ');
  if (s.length > 80 || words.length < 2 || words.length > 3) return '';
  for (var i = 0; i < words.length; i++) if (!/^[A-Za-zА-Яа-яІіЇїЄєҐґ'’ʼ`-]{2,}$/.test(words[i])) return '';
  return s;
}

/** Часть имени (фамилия, имя, отчество): кириллица/латиница, апостроф, дефис; 2…40 знаков. Неверно — ''. */
function npNamePart_(v) {
  var s = String(v === null || v === undefined ? '' : v).replace(/\s+/g, ' ').trim();
  return /^[A-Za-zА-Яа-яІіЇїЄєҐґ'’ʼ`-]{2,40}$/.test(s) ? s : '';
}

/** Подсказка разбора имени покупателя: первое слово — фамилия (только догадка для предзаполнения; админ обязан проверить). */
function npNameParts_(name) {
  var w = String(name || '').replace(/\s+/g, ' ').trim().split(' ');
  return { last: npNamePart_(w[0]), first: npNamePart_(w[1]), middle: npNamePart_(w[2]) };
}

/** Номер отделения взят из свободного текста (не просто «34», «№34», «відділення №34»): витрина просит проверить отделение. */
function npWhGuess_(branchText) {
  return !/^\s*(?:(?:відділення|отделение|відд\.?|№|#)\s*)*\d{1,5}\s*$/i.test(String(branchText || ''));
}

/**
 * Габариты места из тела запроса (width, length, height в см). Не сверено с официальной документацией НП: обязательность габаритов
 * и минимальный объём 0,0004 м³ (10×10×4 см) взяты из замечания ревьюера; если НП этого не требует — снять required и минимум.
 * Ничего не передано — {m3: null}, при required — {error:'bad_dims'}. Передано что-то одно или не число 1…120 — {error:'bad_dims'}.
 * Объём меньше 0,0004 м³ — {error:'bad_dims', small:true} (только при required). Иначе {m3: 'объём в м³ строкой'}.
 */
function npVolume_(body, required) {
  var keys = ['width', 'length', 'height'], vals = [], given = 0;
  keys.forEach(function (k) {
    var v = body ? body[k] : undefined;
    if (v !== undefined && v !== null && String(v).trim() !== '') given++;
    vals.push(v);
  });
  if (!given) return required ? { error: 'bad_dims' } : { m3: null };
  var nums = vals.map(function (v) { return typeof v === 'string' && !/^\d+([.,]\d+)?$/.test(v.trim()) ? NaN : Number(String(v).replace(',', '.')); });
  if (given !== 3 || nums.some(function (n) { return !isFinite(n) || n < 1 || n > 120; })) return { error: 'bad_dims' };
  var cm3 = Math.round(nums[0] * nums[1] * nums[2]);
  if (cm3 < 400) return { error: 'bad_dims', small: true };
  var m3 = cm3 / 1e6;
  return { m3: m3.toFixed(6).replace(/0+$/, '').replace(/\.$/, '') };
}

/** Отделение (или почтомат) города получателя по номеру из заказа: ровно одно совпадение, иначе ошибка. */
function npResolveWh_(cityRef, branchText, locker) {
  var m = String(branchText || '').match(/\d{1,5}/);
  if (!m) return { error: 'wh_unknown' };
  var r = npFindWarehouse_(cityRef, parseInt(m[0], 10), locker);
  if (r.error) return r.error === 'np_paused' ? { error: 'np_paused' } : { error: r.error === 'wh_unknown' ? 'wh_unknown' : 'np_error' };
  return r;
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
  if (o.npType === 'locker') return npFail_('locker'); // почтоматы: накладная вручную в кабинете НП
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
    weightG: npOrderWeightG_(svc), cost: total, cod: payRecv ? total : 0, desc: NP_DESC_DEFAULT, whGuess: npWhGuess_(o.branch)
  } };
}

/**
 * admin.ttn.preview: данные экрана подтверждения. Ничего не меняет. Необязательные width, length, height (см) — габариты места:
 * при верных значениях в ответе ttn.volume (м³, строка), при неверных — bad_dims.
 */
function npTtnPreview_(num, body) {
  var p = npTtnPrepare_(num);
  if (!p.ok) return p;
  var vol = npVolume_(body);
  if (vol.error) return npDimsFail_(vol);
  var o = p.f.o, d = p.d;
  var out = { ok: true, ttn: {
    num: num, name: d.name, nameOk: !!npName_(d.name), nameParts: npNameParts_(d.name), dimsReq: 1, phone: '+' + d.phone, city: o.city, branch: o.branch, type: o.npType === 'locker' ? 'locker' : 'branch',
    npCity: d.wh.city, npWarehouse: d.wh.desc, weightG: d.weightG, cost: d.cost, cod: d.cod, desc: d.desc,
    minG: NP_W_MIN_G, maxG: NP_W_MAX_G, payer: 'recipient'
  } };
  if (vol.m3) out.ttn.volume = vol.m3;
  if (npCityDiffers_(o.city, d.wh)) out.ttn.cityDiff = 1;
  if (d.whGuess) out.ttn.whGuess = 1; // номер отделения извлечён из свободного текста: витрина просит проверить (branch — что написал покупатель, npWarehouse — что найдено)
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
 * Шаг 1 создания: получатель-физлицо у НП (Counterparty.save, CounterpartyProperty 'Recipient', PrivatePerson) → {ref, contact} или {err}.
 * Накладной это не создаёт и денег не стоит. Не сверено с документацией: поля запроса и ответа (ContactPerson.data[0].Ref) — по библиотекам.
 * Нет контакта в ответе — запрашиваем getCounterpartyContactPersons по Ref получателя.
 */
function npRecipientSave_(d, parts) {
  var eo = {};
  var data = npCall_('save', { CounterpartyProperty: 'Recipient', CounterpartyType: 'PrivatePerson', CityRef: d.cityRef,
    FirstName: parts.first, MiddleName: parts.middle || '', LastName: parts.last, Phone: d.phone }, { model: 'Counterparty', noCache: true, quiet: true, admin: true, errOut: eo });
  if (!data) return { err: eo.paused === true ? { paused: true } : eo.api === true ? { api: true, text: eo.text || '' } : { api: false } };
  var rec = data[0] || {}, ref = String(rec.Ref || ''), contact = '';
  if (!NP_UUID_RE.test(ref)) return { err: { api: false, bad: true } };
  var cp = rec.ContactPerson && rec.ContactPerson.data && rec.ContactPerson.data[0];
  if (cp && NP_UUID_RE.test(String(cp.Ref || ''))) contact = String(cp.Ref);
  if (!contact) {
    var r = npPaged_('Counterparty', 'getCounterpartyContactPersons', { Ref: ref }, 1, 0);
    if (r.err) return { err: { api: r.err.api, text: r.err.text, paused: r.err.paused === true } };
    var c0 = r.items.filter(function (c) { return c && NP_UUID_RE.test(String(c.Ref || '')); })[0];
    if (c0) contact = String(c0.Ref);
  }
  if (!contact) return { err: { api: false, bad: true } };
  return { ref: ref, contact: contact };
}

/**
 * admin.ttn.create: body {num, weight (граммы), confirm: true, cod?: число, name?: текст, lastName?/firstName?/middleName? (раздельно; если
 * переданы — name игнорируется), desc?: текст, cityOk?: true, width/length/height (см, ОБЯЗАТЕЛЬНЫ все три), quiet?: true (клиенту номер не отправлять — для пробной накладной)}.
 * Сумма и наложенный платёж берутся из заказа на сервере; cod от клиента допускается только равным серверному значению.
 * Порядок: 1) Counterparty.save получателя, 2) InternetDocument.save с Ref-полями. Ошибка шага 1 накладной не создаёт.
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
  var vol = npVolume_(body, true); // габариты обязательны (не сверено с документацией НП)
  if (vol.error) return npDimsFail_(vol);
  if (body.cod !== undefined && body.cod !== null && Math.round(Number(body.cod)) !== d.cod) return npFail_('bad_amount');
  if (!(d.cost > 0)) return npFail_('bad_amount');
  // Имя получателя: раздельные lastName/firstName/middleName (если переданы — используются как есть, name игнорируется); иначе старое поле name по словам.
  var parts;
  function given(v) { return v !== undefined && v !== null && String(v).trim() !== ''; }
  if (given(body.lastName) || given(body.firstName) || given(body.middleName)) {
    parts = { last: npNamePart_(body.lastName), first: npNamePart_(body.firstName), middle: given(body.middleName) ? npNamePart_(body.middleName) : '' };
    if (!parts.last || !parts.first || (given(body.middleName) && !parts.middle)) return npFail_('bad_name');
  } else {
    var name = npName_(given(body.name) ? body.name : d.name);
    if (!name) return npFail_('bad_name');
    var w = name.split(' ');
    parts = { last: w[0], first: w[1], middle: w[2] || '' };
  }
  var desc = clean_(body.desc, 100) || d.desc;
  var quiet = body.quiet === true;
  var sender = npSenderState_();
  // Метка «создание идёт» — под блокировкой, до обращения к API.
  var now = Date.now();
  var bad = npSvcEdit_(num, function (svc) {
    if (svc.ttn) return 'has_ttn';
    if (Number(svc.tp) > 0 && now - Number(svc.tp) < NP_TTN_BUSY_MS) return 'busy';
    svc.tp = now;
    return '';
  });
  if (bad) return npFail_(bad);
  function unmark() { npSvcEdit_(num, function (svc) { delete svc.tp; return ''; }); }
  // Шаг 1: получатель у НП (накладной ещё нет: при ошибке повтор безопасен)
  var rec = npRecipientSave_(d, parts);
  if (rec.err) {
    unmark();
    if (rec.err.paused) return npFail_('np_paused', { step: 1 }); // лимит НП: запрос не обработан, повтор безопасен
    return rec.err.api ? npFail_('np_api', { np: rec.err.text || '', step: 1 }) : npFail_('np_error', { step: 1 });
  }
  // Шаг 2: накладная. Ref-поля — как в большинстве клиентских библиотек (не сверено с документацией).
  var tz = 'Europe/Kiev';
  try { tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone() || tz; } catch (err0) { /* часовой пояс по умолчанию */ }
  var props = {
    PayerType: 'Recipient', PaymentMethod: 'Cash', CargoType: 'Parcel', ServiceType: 'WarehouseWarehouse', SeatsAmount: '1',
    DateTime: Utilities.formatDate(new Date(now), tz, 'dd.MM.yyyy'),
    Weight: String(Math.round(wg / 10) / 100), Cost: String(d.cost), Description: desc,
    CitySender: sender.city, Sender: sender.ref, SenderAddress: sender.address, ContactSender: sender.contact, SendersPhone: sender.phone,
    CityRecipient: d.cityRef, Recipient: rec.ref, RecipientAddress: d.wh.ref, ContactRecipient: rec.contact, RecipientsPhone: d.phone
  };
  if (vol.m3) props.VolumeGeneral = vol.m3; // только если админ ввёл габариты
  // Наложенный платёж: BackwardDeliveryData — внутренняя структура НЕ СВЕРЕНА с документацией, оставлена как в прежней версии.
  if (d.cod > 0) props.BackwardDeliveryData = [{ PayerType: 'Recipient', CargoType: 'Money', RedeliveryString: String(d.cod) }];
  var eo = {};
  var data = npCall_('save', props, { model: 'InternetDocument', noCache: true, quiet: true, admin: true, errOut: eo });
  var ttn = data && data[0] ? String(data[0].IntDocNumber || '').replace(/\s+/g, '') : '';
  if (!/^\d{10,20}$/.test(ttn)) {
    if (!data && eo.paused === true) { unmark(); return npFail_('np_paused', { step: 2 }); } // лимит НП (или пауза): запрос отклонён, накладной нет, повтор безопасен
    if (!data && eo.api !== true && eo.nocall !== true) return npFail_('np_unknown'); // связь оборвалась: накладная могла создаться, метку не снимаем
    if (data && data.length) return npFail_('np_unknown');                             // success без разборчивого номера: накладная скорее всего создана, метку не снимаем
    unmark();                                                                          // API отказал или не вызывался: повтор безопасен
    if (data) return npFail_('np_error', { step: 2 });                                 // ответ без номера
    return eo.api === true ? npFail_('np_api', { np: eo.text || '', step: 2 }) : npFail_('np_error', { step: 2 });
  }
  // Ref документа, время и признак пробной — для admin.ttn.delete; пишутся setTtn_ в том же проходе под блокировкой, что и номер. Метку tp не трогаем.
  var docRef = String(data[0].Ref || '');
  var meta = /^[\w-]{8,64}$/.test(docRef) ? { tr: docRef, tc: Date.now(), tq: quiet ? 1 : 0 } : null;
  var res = null;
  try {
    res = setTtn_(num, ttn, token, quiet, meta);                                          // записывает «ТТН»; клиенту пишет номер с «Відстежити», если не quiet
  } catch (err) {
    console.warn('np ttn save: ' + num + ' ' + ttn + ' ' + safeErr_(err));              // номер не теряем: он в ответе админу и в логе (не секрет)
    res = null;
  }
  if (!res || !res.ok) return npFail_('save_failed', { ttn: ttn });                    // метку tp не снимаем: повтор в течение 5 минут не создаст дубль
  unmark();
  var out = { ok: true, ttn: ttn, told: res.told };
  if (quiet) out.quiet = true;
  return out;
}

/** Накладную можно удалить из админки: создана этим способом (svc.tr), есть время создания, не старше 24 часов. Без обращений к таблице и сети. */
function npDelOk_(svcText, now) {
  if (!npKey_()) return false;
  var svc;
  try { svc = JSON.parse(svcText || '{}') || {}; } catch (err) { return false; }
  var t = Number(svc.tc);
  return !!(Number(svc.tq) === 1 && svc.tr && svc.ttn && svc.tn && String(svc.ttn) === String(svc.tn) && t > 0 && now - t <= NP_TTN_DEL_MS && t <= now + 60000);
}

/**
 * admin.ttn.delete: body {num, confirm: true}. InternetDocument.delete по Ref документа (DocumentRefs — не сверено с документацией).
 * Только пока накладная создана через магазин (svc.tr) и не старше 24 часов. После успеха очищает «ТТН» и svc.ttn/tr/tc/tp/ar/nd; клиенту ничего не шлёт.
 */
function npTtnDelete_(body) {
  if (!npKey_()) return npFail_('off');
  var num = String(body.num || '');
  if (!/^P-\d+$/.test(num)) return npFail_('not_found');
  var f = findOrder_(num);
  if (!f) return npFail_('not_found');
  var svc;
  try { svc = JSON.parse(f.o.svc || '{}') || {}; } catch (err) { svc = {}; }
  var ref = String(svc.tr || '');
  if (!/^[\w-]{8,64}$/.test(ref)) return npFail_('del_no');
  if (Number(svc.tq) !== 1 || !svc.ttn || String(svc.ttn) !== String(svc.tn || '')) return npFail_('del_real'); // только пробная, и только если в заказе стоит именно она
  var now = Date.now(), t = Number(svc.tc);
  if (!(t > 0) || now - t > NP_TTN_DEL_MS) return npFail_('del_old');
  if (Number(svc.tp) > 0 && now - Number(svc.tp) < NP_TTN_BUSY_MS) return npFail_('busy'); // создание ещё идёт
  if (body.confirm !== true) return npFail_('not_confirmed');
  // Метка «удаление идёт» (svc.td) — под блокировкой до запроса к НП: второе одновременное удаление не уйдёт в НП (busy).
  var bad = npSvcEdit_(num, function (sv) {
    if (!sv.tr && !sv.ttn) return 'del_done';                                              // уже стёрто (в т.ч. вручную колонку «ТТН»)
    if (String(sv.tr || '') !== ref || Number(sv.tq) !== 1 || String(sv.ttn || '') !== String(sv.tn || '')) return 'del_real';
    if (Number(sv.td) > 0 && Date.now() - Number(sv.td) < NP_TTN_BUSY_MS) return 'busy';
    sv.td = Date.now();
    return '';
  });
  if (bad === 'del_done') return npDelDone_();
  if (bad) return npFail_(bad);
  var eo = {};
  var data = npCall_('delete', { DocumentRefs: ref }, { model: 'InternetDocument', noCache: true, quiet: true, admin: true, errOut: eo });
  if (!data) {
    npSvcEdit_(num, function (sv) { if (!sv.td) return 'x'; delete sv.td; return ''; });   // НП не удалила: метку снимаем, повтор безопасен
    if (eo.paused === true) return npFail_('np_paused');
    return eo.api === true ? npFail_('np_api', { np: eo.text || '' }) : npFail_('np_error');
  }
  // Накладной в НП уже нет. Дальше — только заказ; НП больше не спрашиваем. Две попытки взять блокировку.
  var was = '', lock = LockService.getScriptLock(), got = lock.tryLock(10000) || lock.tryLock(10000);
  if (!got) return npFail_('del_partial');
  try {
    var f2 = findOrder_(num);
    if (!f2 || f2.col.svc < 0) return npFail_('del_partial');
    var sv;
    try { sv = JSON.parse(f2.o.svc || '{}') || {}; } catch (err2) { sv = {}; }
    was = String(sv.ttn || '');
    if (!sv.ttn && !sv.tr) return npDelDone_();                                            // в заказе уже ничего нет
    if (String(sv.tr || '') !== ref || Number(sv.tq) !== 1 || was !== String(sv.tn || '')) { // админ успел вписать другой номер: чужое не стираем
      if (sv.td) { delete sv.td; try { f2.sheet.getRange(f2.rowIndex, f2.col.svc + 1).setValue(JSON.stringify(sv)); SpreadsheetApp.flush(); } catch (err5) { /* метка устареет сама */ } }
      return npFail_('del_other');
    }
    try {
      ['ttn', 'tr', 'tc', 'tn', 'tq', 'tp', 'ar', 'nd', 'td'].forEach(function (k) { delete sv[k]; });
      f2.sheet.getRange(f2.rowIndex, f2.col.svc + 1).setValue(JSON.stringify(sv));
      if (f2.col.ttn >= 0) f2.sheet.getRange(f2.rowIndex, f2.col.ttn + 1).setValue('');
      SpreadsheetApp.flush();
    } catch (err6) {
      console.warn('np ttn delete: write failed ' + safeErr_(err6));
      return npFail_('del_partial'); // стёртой «ТТН» достаточно: svcLive_ при чтении считает накладную магазина стёртой
    }
    logAction_('Замовлення: ТТН видалено', num, was, '');
  } finally {
    lock.releaseLock();
  }
  try { // сообщения админов с карточкой заказа обновляем (без номера); клиенту ничего не шлём
    var f3 = findOrder_(num), token = scriptProps_().getProperty('BOT_TOKEN');
    var targets = [];
    try { targets = (JSON.parse(f3.o.svc || '{}').m) || []; } catch (err3) { targets = []; }
    targets.forEach(function (tg) {
      tg_(token, 'editMessageText', { chat_id: tg[0], message_id: tg[1], text: adminText_(f3.o, ''), parse_mode: 'HTML', disable_web_page_preview: true, reply_markup: adminKeyboard_(f3.o.num) });
    });
  } catch (err4) { console.warn('np ttn delete: card update failed ' + safeErr_(err4)); }
  return { ok: true };
}

/* ---------- 3. Посылка прибыла в отделение: сервисное сообщение один раз ---------- */

/** Коды TrackingDocument.getStatusDocuments (официальная документация): 7 — прибыло в отделение, 8 — прибыло в отделение (загружено в почтомат). */
var NP_ARRIVED_CODES = ['7', '8'];
/** Конец пути без прибытия: 2 удалена, 3 не найдена, 9 получено, 10/11 получено с денежным переводом, 102/103 отказ. Заказ больше не опрашиваем (svc.nd). */
var NP_DONE_CODES = ['2', '3', '9', '10', '11', '102', '103'];

/**
 * Из hourlyJob. np_track_hours (0 или пусто — выключено; максимум 24): раз в N часов опрашивает ТТН заказов «відправлено»
 * без отметок svc.ar и svc.nd, не старше 30 дней. Код 7 → клиенту «у відділення», код 8 → «у поштомат» (код важнее типа доставки в заказе);
 * одно сообщение, отметка svc.ar ставится до отправки. Коды 2/3/9/10/11/102/103 без прибытия → отметка svc.nd, сообщения нет, заказ больше не опрашивается.
 * До 100 номеров за запрос; Phone получателя передаётся, если он есть в заказе.
 * Сервисное сообщение: «Відписка», лимит 14 дней и отметка «Останнє повідомлення» к нему не относятся. Ошибка API — тихо до следующего раза.
 * Возвращает число отправленных сообщений.
 */
function npTrackJob_() {
  var hours = Math.round(toNum_(readSettings_().np_track_hours));
  if (!(hours >= 1) || !npKey_()) return 0;
  hours = Math.min(hours, 24);
  if (npPauseLeftSec_() > 0) return 0; // пауза после «To many requests»: опрос не начинаем и интервал не тратим
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
    if (!/^\d{10,20}$/.test(ttn) || svc.ar || svc.nd || svc.tq || !/^\d+$/.test(cell_(row, col.uid))) return;
    list.push({ r: r + 2, ttn: ttn, uid: cell_(row, col.uid), num: cell_(row, col.num), ru: cell_(row, col.lang) === 'ru', phone: npPhone_(cell_(row, col.phone)) });
  });
  var sent = 0, teo = {};
  for (var b = 0; b < NP_TRACK_MAX_BATCHES && b * NP_TRACK_BATCH < list.length; b++) {
    var chunk = list.slice(b * NP_TRACK_BATCH, (b + 1) * NP_TRACK_BATCH);
    var data = npCall_('getStatusDocuments', { Documents: chunk.map(function (x) { var d = { DocumentNumber: x.ttn }; if (x.phone) d.Phone = x.phone; return d; }) },
      { model: 'TrackingDocument', noCache: true, quiet: true, admin: true, errOut: teo });
    if (!data) { if (teo.paused === true) break; continue; } // лимит НП — остальные пачки не шлём; иная ошибка API: до следующего раза
    var codeOf = {};
    data.forEach(function (x) { if (x && x.Number !== undefined) codeOf[String(x.Number).replace(/\s+/g, '')] = String(x.StatusCode); });
    chunk.forEach(function (x) {
      var code = codeOf[x.ttn];
      if (NP_DONE_CODES.indexOf(code) >= 0) { fuSetSvcMark_(sheet, col, x.r, 'nd', x.num, x.ttn); return; } // конец пути без прибытия: больше не опрашиваем, не пишем
      if (NP_ARRIVED_CODES.indexOf(code) < 0) return;
      if (!fuSetSvcMark_(sheet, col, x.r, 'ar', x.num, x.ttn)) return; // уже отмечено (или блокировка занята): второго сообщения не будет
      var locker = code === '8';
      var res = tg_(token, 'sendMessage', {
        chat_id: x.uid,
        text: x.ru ? 'Ваш заказ № ' + x.num + ' прибыл ' + (locker ? 'в почтомат Новой почты' : 'в отделение Новой почты') + '. ТТН ' + x.ttn + '.'
                   : 'Ваше замовлення № ' + x.num + ' прибуло ' + (locker ? 'у поштомат Нової пошти' : 'у відділення Нової пошти') + '. ТТН ' + x.ttn + '.',
        reply_markup: { inline_keyboard: [[{ text: x.ru ? 'Отследить' : 'Відстежити', url: TTN_TRACK_URL + x.ttn }]] }
      });
      if (res && res.ok) sent++;
    });
  }
  return sent;
}
