/**
 * PAMIR — этап 9, выпуск Б: пункт меню «PAMIR → Етап 9Б: створити колонки».
 *
 * Создаёт две необязательные колонки «Джерело» (первый источник клиента) в листе «Клієнти» и «Джерело клієнта»
 * (источник заказа) в листе «Замовлення», если их ещё нет. Существующая колонка «Джерело» в «Замовлення»
 * (miniapp / miniapp test) не трогается. Повторный запуск ничего не меняет. Запись — под LockService.
 *
 * Ниже (блок б7) — скорость и надёжность перед рекламой: уведомление Worker, буфер событий, копия таблицы, ошибки витрины.
 */

function stage9bMenu_(menu) {
  return menu.addItem('Етап 9Б: створити колонки', 'stage9bSetup')
    .addItem('Увімкнути швидкий режим (запис подій раз на хвилину)', 'menuFastOn')
    .addItem('Вимкнути швидкий режим', 'menuFastOff')
    .addItem('Зробити копію зараз', 'menuBackupNow')
    .addItem('Увімкнути щотижневу копію', 'menuBackupOn')
    .addItem('Вимкнути щотижневу копію', 'menuBackupOff');
}

function stage9bSetup() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    var busy = 'Зараз таблицю змінює інша дія. Зачекайте хвилину й натисніть ще раз.';
    s9Alert_(busy);
    return { ok: false, error: 'busy', message: busy, done: [] };
  }
  var done = [];
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var clients = ss.getSheetByName(SHEET_CLIENTS) || ensureClientsSheet_();
    if (mapHeaders_(clients.getRange(1, 1, 1, Math.max(1, clients.getLastColumn())).getValues()[0], CLIENT_COLS).src < 0) {
      clients.getRange(1, clients.getLastColumn() + 1).setValue('Джерело').setFontWeight('bold');
      done.push('колонка «Джерело» у «' + SHEET_CLIENTS + '»');
    }
    var orders = ensureOrdersSheet_();
    if (orderCols_(orders).srcClient < 0) {
      orders.getRange(1, orders.getLastColumn() + 1).setValue('Джерело клієнта').setFontWeight('bold');
      done.push('колонка «Джерело клієнта» у «' + SHEET_ORDERS + '»');
    }
    SpreadsheetApp.flush();
  } catch (err) {
    console.error('stage9b: ' + (err && err.stack || err));
    lock.releaseLock();
    var fail = 'Помилка: ' + (err && err.message || err) + '. Повторний запуск безпечний.';
    s9Alert_(fail);
    return { ok: false, error: 'fail', message: fail, done: done };
  }
  lock.releaseLock();
  var text = done.length ? 'Готово, створено:\n• ' + done.join('\n• ') : 'Усе вже створено раніше, нічого не змінено.';
  s9Alert_(text);
  return { ok: true, message: text, done: done };
}

/* ======================================================================== */
/* Выпуск 9Б, б7: скорость и надёжность перед рекламой                        */
/* ======================================================================== */
/*
 * Новые необязательные Script Properties (не секреты):
 *   WORKER_URL       адрес Cloudflare Worker (https://…), чтобы после сброса каталога Worker обновил свой кэш
 *   FAST_MODE        «1» — быстрый режим включён (ставит пункт меню; вместе с ним ставится триггер flushJob)
 *   BACKUP_FOLDER_ID id папки «PAMIR — резервні копії» на Google Диске (создаётся и запоминается сама)
 * Без этих свойств всё работает как раньше.
 */

/* ------------------------- б7.1: уведомить Worker о сбросе каталога ------------------------- */

/**
 * После clearCatalogCache_ (флаг purgePending_) в конце запроса или пункта меню: POST <WORKER_URL>/purge с заголовком X-Pamir-Key.
 * Не вызывать внутри блокировки. Нет WORKER_URL или WEBHOOK_SECRET — ничего не делается. Любая ошибка проглатывается;
 * в журнал не попадают ни секрет, ни адрес. За один запрос уходит не больше одного вызова (флаг сбрасывается сразу).
 */
function purgeWorkerIfPending_() {
  if (!purgePending_) return;
  purgePending_ = false;
  try {
    var props = scriptProps_();
    var base = String(props.getProperty('WORKER_URL') || '').trim().replace(/\/+$/, '');
    var secret = props.getProperty('WEBHOOK_SECRET');
    if (!secret || !/^https:\/\/[^\s?#]+$/.test(base)) return;
    var res = UrlFetchApp.fetch(base + '/purge', { method: 'post', headers: { 'X-Pamir-Key': secret }, payload: '', muteHttpExceptions: true });
    var code = res && typeof res.getResponseCode === 'function' ? res.getResponseCode() : 0;
    if (code >= 300) console.warn('purge: код ' + code);
  } catch (err) {
    console.warn('purge: не вдалося');
  }
}

/* ------------------------- б7.2: буфер событий и отметок клиентов ------------------------- */
/*
 * Устройство. CacheService не умеет дописывать, поэтому каждая пачка (события + отметка клиента одного запроса) — свой ключ fb_<n>.
 * Счётчики fb_n (последняя занятая пачка) и fb_t (последняя записанная в лист) защищены НЕ блокировкой скрипта, а блокировкой
 * документа с очень коротким tryLock: заказы её не используют, поэтому не ждут аналитику. Пачка кладётся в кэш раньше,
 * чем растёт fb_n, поэтому flushJob никогда не увидит номер без данных. flushJob (раз в минуту) берёт блокировку скрипта
 * через tryLock; занята — откладывает до следующего запуска, ничего не теряя (fb_t сдвигается только после записи в лист).
 * Режим включён, только если FAST_MODE = 1 И flushJob недавно работал (метка fb_hb в кэше, 15 минут): если триггер пропал,
 * витрина сама возвращается к прямой записи.
 */
var FB_TTL = 21600;           // срок жизни в кэше, максимум CacheService — 6 часов
var FB_MAX_PENDING = 400;     // сколько пачек ждёт записи; больше — новые отбрасываются (счётчик потерь fb_lost)
var FB_MAX_BYTES = 90000;     // предел значения кэша — 100 КБ
var FB_FLUSH_BATCHES = 150;   // пачек за один проход flushJob (блокировка скрипта держится недолго)
var FB_HEARTBEAT_SEC = 900;

function fastMode_() {
  try {
    if (scriptProps_().getProperty('FAST_MODE') !== '1') return false;
    return !!CacheService.getScriptCache().get('fb_hb');
  } catch (err) {
    return false;
  }
}

function fbLost_(n) {
  try {
    var cache = CacheService.getScriptCache();
    cache.put('fb_lost', String((parseInt(cache.get('fb_lost'), 10) || 0) + (n || 1)), FB_TTL); // приблизительно: без блокировки
  } catch (err) { /* счётчик не важнее ответа */ }
}

/** Кладёт пачку { e: [строки событий], c: отметка клиента } в буфер. true — принято; false — отброшено (потери посчитаны). */
function bufferPush_(batch) {
  var lock = null, got = false;
  try {
    var json = JSON.stringify(batch);
    if (json.length > FB_MAX_BYTES) { fbLost_(1); return false; }
    var cache = CacheService.getScriptCache();
    lock = LockService.getDocumentLock();
    got = lock.tryLock(500);
    if (!got) { fbLost_(1); return false; }
    var both = cache.getAll(['fb_n', 'fb_t']);
    var t = parseInt(both.fb_t, 10) || 0;
    var n = Math.max(parseInt(both.fb_n, 10) || 0, t);
    if (n - t >= FB_MAX_PENDING) { fbLost_(1); return false; }
    n++;
    cache.put('fb_' + n, json, FB_TTL); // сначала данные, потом счётчик
    cache.put('fb_n', String(n), FB_TTL);
    return true;
  } catch (err) {
    fbLost_(1);
    return false;
  } finally {
    if (got) { try { lock.releaseLock(); } catch (err2) { /* уже снята */ } }
  }
}

/** Отметка клиента не дошла до буфера: убираем «недавно записывали», чтобы следующее открытие попробовало снова. */
function touchUndo_(rec) {
  try {
    var cache = CacheService.getScriptCache();
    cache.remove('cl_' + rec.id);
    if (rec.src) cache.remove('cls_' + rec.id);
  } catch (err) { /* не критично */ }
}

/**
 * Проверки touchClient_ без записи: только личные чаты, метка источника, «недавно уже писали». Возвращает запись отметки или null.
 * В кэш пишутся те же ключи cl_/cls_, что и раньше.
 */
function touchPrep_(user, lang, sure, src) {
  var uid = String(user && user.id !== undefined && user.id !== null ? user.id : '').trim();
  if (!/^\d+$/.test(uid)) return null; // только личные чаты
  var cache = CacheService.getScriptCache();
  src = srcLabel_(src, null); // источник — только проверенная метка; пишется один раз (первый), не перезаписывается
  if (src && cache.get('cls_' + uid)) src = ''; // источник этому человеку уже записывали недавно
  if (!sure && !src && cache.get('cl_' + uid)) return null;
  cache.put('cl_' + uid, '1', CLIENT_TOUCH_SEC);
  if (src) cache.put('cls_' + uid, '1', CLIENT_TOUCH_SEC);
  return {
    id: uid, fn: clean_(user.first_name, 60), ln: clean_(user.last_name, 60), lc: clean_(user.language_code, 8),
    lang: lang === 'ru' || lang === 'ua' ? lang : '', sure: !!sure, src: src, at: Date.now()
  };
}

/** Пачка строк в лист «Події» (под блокировкой скрипта — её держит вызывающий). rows: [Date, uid, sid, name, id, v]. */
function writeEventRows_(rows) {
  if (!rows.length) return;
  var sheet = ensureEventsSheet_();
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, EVENT_HEADERS.length).setValues(rows);
  // Лист не растёт бесконечно: самые старые строки удаляются.
  if (sheet.getLastRow() > EVENTS_KEEP_ROWS + 5000) sheet.deleteRows(2, 5000);
}

/**
 * Пачка отметок клиентов одним чтением листа «Клієнти» (под блокировкой скрипта). Те же правила, что у touchClient_:
 * язык заказа (sure) заменяет догадку, источник пишется один раз и не перезаписывается, «Заблокував бота» снимается.
 */
function applyClientTouches_(touches) {
  if (!touches.length) return 0;
  var sheet = ensureClientsSheet_();
  var values = sheet.getDataRange().getValues();
  var col = mapHeaders_(values[0], CLIENT_COLS);
  if (col.id < 0) return 0;
  var idx = {};
  for (var i = 1; i < values.length; i++) { var key = cell_(values[i], col.id); if (idx[key] === undefined) idx[key] = i; }
  var origLen = values.length, width = Math.max(sheet.getLastColumn(), 1);
  var sets = {};
  function set(r, c, v) { values[r][c] = v; if (r < origLen) sets[r + ':' + c] = [r, c, v]; }
  touches.forEach(function (t) {
    var uid = String(t.id);
    var now = new Date(Number(t.at) || Date.now());
    var name = clean_((t.fn || '') + ' ' + (t.ln || ''), 60);
    var code = t.lang === 'ru' || t.lang === 'ua' ? t.lang : (String(t.lc || '').toLowerCase().indexOf('ru') === 0 ? 'ru' : 'ua');
    var src = srcLabel_(t.src, null);
    var r = idx[uid];
    if (r === undefined) {
      var row = [];
      for (var b = 0; b < width; b++) row.push('');
      row[col.id] = '\'' + uid;
      if (col.name >= 0) row[col.name] = safeCell_(name);
      if (col.lang >= 0) row[col.lang] = code;
      if (col.first >= 0) row[col.first] = now;
      if (col.last >= 0) row[col.last] = now;
      if (col.src >= 0 && src) row[col.src] = safeCell_(src);
      values.push(row);
      idx[uid] = values.length - 1;
      return;
    }
    if (src && col.src >= 0 && !cell_(values[r], col.src)) set(r, col.src, safeCell_(src));
    if (name && col.name >= 0 && name !== cell_(values[r], col.name)) set(r, col.name, safeCell_(name));
    if (col.lang >= 0 && code !== cell_(values[r], col.lang) && (t.sure || !cell_(values[r], col.lang))) set(r, col.lang, code);
    if (col.last >= 0) set(r, col.last, now);
    if (col.blocked >= 0 && cell_(values[r], col.blocked)) set(r, col.blocked, '');
  });
  Object.keys(sets).forEach(function (k) { var s = sets[k]; sheet.getRange(s[0] + 1, s[1] + 1).setValue(s[2]); });
  var added = values.slice(origLen);
  if (added.length) sheet.getRange(sheet.getLastRow() + 1, 1, added.length, width).setValues(added);
  return touches.length;
}

/**
 * Один проход записи буфера. lockMs — сколько ждать блокировку скрипта (tryLock). Возвращает { deferred, batches, events, clients, more }.
 * deferred: блокировка занята — ничего не записано и не потеряно, следующий запуск продолжит.
 */
function flushBuffer_(lockMs) {
  var res = { deferred: false, batches: 0, events: 0, clients: 0, more: false, error: false };
  var cache = CacheService.getScriptCache();
  var peek = cache.getAll(['fb_n', 'fb_t']);
  if (!((parseInt(peek.fb_n, 10) || 0) > (parseInt(peek.fb_t, 10) || 0))) return res;
  var lock = LockService.getScriptLock();
  var got = false;
  try { got = lock.tryLock(lockMs); } catch (err) { got = false; }
  if (!got) { res.deferred = true; return res; }
  try {
    var both = cache.getAll(['fb_n', 'fb_t']);
    var n = parseInt(both.fb_n, 10) || 0, t = parseInt(both.fb_t, 10) || 0;
    if (n <= t) return res;
    var from = Math.max(t, n - FB_MAX_PENDING); // более старые уже не помещаются в очередь
    var to = Math.min(n, from + FB_FLUSH_BATCHES);
    var keys = [];
    for (var k = from + 1; k <= to; k++) keys.push('fb_' + k);
    var got2 = cache.getAll(keys);
    var events = [], touches = [], missing = 0;
    keys.forEach(function (key) {
      var raw = got2[key];
      if (typeof raw !== 'string') { missing++; return; }
      try {
        var b = JSON.parse(raw);
        if (b && Array.isArray(b.e)) b.e.forEach(function (r) { events.push([new Date(Number(r[0]) || Date.now()), r[1], r[2], r[3], r[4], r[5]]); });
        if (b && b.c) touches.push(b.c);
        res.batches++;
      } catch (err) { missing++; }
    });
    if (missing) fbLost_(missing);
    try {
      applyClientTouches_(touches); // сначала отметки (повтор безвреден), потом события
      writeEventRows_(events);
      cache.remove('fb_fail');
    } catch (err) {
      // Запись не удалась: fb_t не сдвигается, следующий запуск повторит. Пять неудач подряд — пачку отбрасываем, чтобы не застрять.
      var fails = (parseInt(cache.get('fb_fail'), 10) || 0) + 1;
      console.error('flush: ' + (err && err.message || err));
      res.error = true;
      if (fails < 5) { cache.put('fb_fail', String(fails), 3600); return res; }
      cache.remove('fb_fail');
      fbLost_(keys.length);
      res.batches = 0; events = []; touches = [];
    }
    cache.put('fb_t', String(to), FB_TTL);
    cache.removeAll(keys);
    res.events = events.length;
    res.clients = touches.length;
    res.more = to < n;
  } finally {
    lock.releaseLock();
  }
  return res;
}

/** Триггер раз в минуту (ставит пункт меню «Увімкнути швидкий режим»). Занята блокировка — отложить до следующего запуска. */
function flushJob() {
  try {
    var cache = CacheService.getScriptCache();
    if (scriptProps_().getProperty('FAST_MODE') === '1') cache.put('fb_hb', '1', FB_HEARTBEAT_SEC);
    var started = Date.now();
    for (var round = 0; round < 3; round++) {
      var res = flushBuffer_(2000);
      if (res.deferred || res.error || !res.more || Date.now() - started > 20000) break; // между проходами блокировка свободна: заказ пройдёт
    }
    var lost = parseInt(cache.get('fb_lost'), 10) || 0;
    if (lost) { console.warn('flush: втрачено подій/відміток: ' + lost); cache.remove('fb_lost'); }
  } catch (err) {
    console.error('flushJob: ' + (err && err.message || err));
  }
}

/** Статистика: если блокировка свободна, дописать буфер до расчёта. Занята — считаем по листу как есть. */
function flushBeforeStats_() {
  try {
    if (scriptProps_().getProperty('FAST_MODE') === '1') flushBuffer_(300);
  } catch (err) { /* статистика не должна падать из-за буфера */ }
}

function stage9bAlert_(text) {
  try { SpreadsheetApp.getUi().alert(text); } catch (err) { /* запуск из редактора */ }
}

function stage9bDeleteTriggers_(fn) {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === fn) ScriptApp.deleteTrigger(t); });
}

function menuFastOn() {
  stage9bDeleteTriggers_('flushJob'); // повторное включение не дублирует триггер
  ScriptApp.newTrigger('flushJob').timeBased().everyMinutes(1).create();
  scriptProps_().setProperty('FAST_MODE', '1');
  CacheService.getScriptCache().put('fb_hb', '1', FB_HEARTBEAT_SEC);
  stage9bAlert_('Швидкий режим увімкнено. Події магазину та відмітки клієнтів записуються в таблицю раз на хвилину, замовлення не чекають на них. ' +
    'Найсвіжіші події в статистиці з\'являються із затримкою до хвилини.\n\nБыстрый режим включён: события пишутся в таблицу раз в минуту.');
  return { ok: true };
}

function menuFastOff() {
  stage9bDeleteTriggers_('flushJob');
  scriptProps_().setProperty('FAST_MODE', '0'); // новые события снова пишутся сразу
  var rounds = 0, res = null;
  do { res = flushBuffer_(20000); rounds++; } while (res && !res.deferred && !res.error && res.more && rounds < 20); // сначала дописать буфер
  var cache = CacheService.getScriptCache();
  var left = (parseInt(cache.get('fb_n'), 10) || 0) > (parseInt(cache.get('fb_t'), 10) || 0);
  stage9bAlert_(left
    ? 'Швидкий режим вимкнено, але частину подій не вдалося дописати (таблицю змінює інша дія). Увімкніть швидкий режим і через хвилину вимкніть знову.\nБыстрый режим выключен, часть событий не дописана — повторите позже.'
    : 'Швидкий режим вимкнено. Усе, що накопичилося, записано в таблицю.\nБыстрый режим выключен, накопленное записано.');
  return { ok: !left, left: left };
}

/* ------------------------- б7.5: резервная копия таблицы ------------------------- */

var BACKUP_FOLDER_NAME = 'PAMIR — резервні копії';
var BACKUP_PREFIX = 'PAMIR — Товари — копія ';
var BACKUP_KEEP = 8;

function backupFolder_() {
  var props = scriptProps_();
  var id = props.getProperty('BACKUP_FOLDER_ID');
  var folder = null;
  if (id) {
    try { folder = DriveApp.getFolderById(id); if (folder.isTrashed && folder.isTrashed()) folder = null; } catch (err) { folder = null; }
  }
  if (!folder) {
    var it = DriveApp.getFoldersByName(BACKUP_FOLDER_NAME);
    while (it.hasNext()) { var f = it.next(); if (!(f.isTrashed && f.isTrashed())) { folder = f; break; } }
  }
  if (!folder) folder = DriveApp.createFolder(BACKUP_FOLDER_NAME);
  if (folder.getId() !== id) props.setProperty('BACKUP_FOLDER_ID', folder.getId());
  return folder;
}

/** Копия всей таблицы в папку; копий с нашим префиксом остаётся не больше 8, старшие — в корзину Drive (не навсегда). */
function backupNow_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var folder = backupFolder_();
  var name = BACKUP_PREFIX + Utilities.formatDate(new Date(), 'Europe/Kiev', 'yyyy-MM-dd HH:mm');
  DriveApp.getFileById(ss.getId()).makeCopy(name, folder);
  var mine = [];
  var files = folder.getFiles();
  while (files.hasNext()) {
    var f = files.next();
    var nm = String(f.getName());
    if (nm.indexOf(BACKUP_PREFIX) !== 0) continue; // чужие файлы в папке не трогаем
    mine.push({ f: f, name: nm, at: f.getDateCreated ? new Date(f.getDateCreated()).getTime() : 0 });
  }
  mine.sort(function (a, b) { return (b.at - a.at) || (a.name < b.name ? 1 : a.name > b.name ? -1 : 0); });
  var trashed = 0;
  mine.slice(BACKUP_KEEP).forEach(function (x) { x.f.setTrashed(true); trashed++; });
  return { name: name, kept: Math.min(mine.length, BACKUP_KEEP), trashed: trashed };
}

/** Администраторы, которым пишем о сбоях: все активные. */
function activeAdminIds_(props) {
  return adminList_(props).filter(function (a) { return a.active && /^-?\d+$/.test(a.id); }).map(function (a) { return a.id; });
}

/** Триггер раз в неделю. Ошибка — одно сообщение активным админам (без деталей и ключей). */
function backupJob() {
  try {
    var r = backupNow_();
    console.log('backup: ' + r.name + ', у кошик: ' + r.trashed);
    return { ok: true };
  } catch (err) {
    console.error('backup: ' + (err && err.message || err));
    try {
      var props = scriptProps_();
      var token = props.getProperty('BOT_TOKEN');
      if (token) {
        var cache = CacheService.getScriptCache();
        if (!cache.get('bk_err')) { // один раз за сбой, а не по разу на каждый повтор
          cache.put('bk_err', '1', 3600);
          activeAdminIds_(props).forEach(function (id) {
            tg_(token, 'sendMessage', { chat_id: id, text: 'Не вдалося зробити тижневу резервну копію таблиці. Спробуйте: меню PAMIR → «Зробити копію зараз».\nНе удалось сделать еженедельную резервную копию таблицы. Попробуйте: меню PAMIR → «Зробити копію зараз».' });
          });
        }
      }
    } catch (err2) { /* сообщение необязательно */ }
    return { ok: false };
  }
}

function menuBackupNow() {
  try {
    var r = backupNow_();
    stage9bAlert_('Копію створено: ' + r.name + '\nПапка на Google Диску: «' + BACKUP_FOLDER_NAME + '». Зберігається останніх ' + BACKUP_KEEP + ' копій, старіші йдуть у кошик Диска.\nКопия создана, хранятся последние ' + BACKUP_KEEP + '.');
    return { ok: true, name: r.name };
  } catch (err) {
    console.error('backup: ' + (err && err.message || err));
    stage9bAlert_('Не вдалося зробити копію. Спробуйте ще раз; якщо повториться — перевірте доступ скрипта до Google Диска.\nНе удалось сделать копию.');
    return { ok: false };
  }
}

function menuBackupOn() {
  stage9bDeleteTriggers_('backupJob'); // повторне ввімкнення не дублює
  ScriptApp.newTrigger('backupJob').timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(3).create();
  stage9bAlert_('Щотижневу копію ввімкнено: щонеділі близько 3:00. Зберігається останніх ' + BACKUP_KEEP + ' копій.\nЕженедельная копия включена.');
  return { ok: true };
}

function menuBackupOff() {
  stage9bDeleteTriggers_('backupJob');
  stage9bAlert_('Щотижневу копію вимкнено.\nЕженедельная копия выключена.');
  return { ok: true };
}

/* ------------------------- б7.7: ошибки витрины ------------------------- */

var ERR_PER_DID_HOUR = 5;
var ERR_TOTAL_HOUR = 300;

/** Чистка текста ошибки: ничего, похожего на телефон, initData, адрес с параметрами или почту, не остаётся. */
function errScrub_(v, max) {
  var s = clean_(v, 2000);
  s = s.replace(/[?#]\S*/g, ' '); // адрес с параметрами или якорем: всё после ? и # отрезается (первым, чтобы не терять сам адрес)
  s = s.replace(/\S*(?:initData|tgWebAppData)\S*/gi, ' ');
  s = s.replace(/\b(?:hash|user|query_id|auth_date|signature|start_param)(?:=|%3D)\S*/gi, ' ');
  s = s.replace(/\S+@\S+\.\S+/g, ' ');
  s = s.replace(/\+?\d[\d\s().\-]{5,}\d/g, function (m) { return m.replace(/\D/g, '').length >= 7 ? ' ' : m; });
  return s.replace(/\s+/g, ' ').trim().slice(0, max);
}

/**
 * action: 'err' — { did, items: [{ m, s, v }] }. initData не нужен и не читается. Сохраняются только текст (≤200), экран (≤24), версия (≤12).
 * ≤5 записей в час с одного did, ≤300 в час всего; сверх — молча ok. Копится в кэше, в лист ничего не пишется.
 */
function handleErr_(body) {
  var did = String(body && body.did || '');
  if (!/^[a-z0-9]{8,32}$/.test(did) || !Array.isArray(body.items)) return { ok: false, error: 'bad_form' };
  var cache = CacheService.getScriptCache();
  var dKey = 'er_d_' + did + '_' + Math.floor(Date.now() / 3600000);
  var used = parseInt(cache.get(dKey), 10) || 0;
  var items = [];
  body.items.slice(0, ERR_PER_DID_HOUR).forEach(function (it) {
    if (used + items.length >= ERR_PER_DID_HOUR) return;
    var m = errScrub_(it && it.m, 200);
    if (!m) return;
    items.push({ m: m, s: String((it && it.s) || '').replace(/[^\w.:\-]/g, '').slice(0, 24), v: String((it && it.v) || '').replace(/[^\w.\-]/g, '').slice(0, 12) });
  });
  if (!items.length) return { ok: true };
  cache.put(dKey, String(used + items.length), 3600);
  var lock = null, got = false;
  try {
    lock = LockService.getDocumentLock();
    got = lock.tryLock(500);
    if (got) {
      var buf = {};
      try { buf = JSON.parse(cache.get('er_buf') || '{}') || {}; } catch (err) { buf = {}; }
      buf.n = Number(buf.n) || 0;
      buf.m = buf.m && typeof buf.m === 'object' ? buf.m : {};
      items.forEach(function (x) {
        if (buf.n >= ERR_TOTAL_HOUR) return;
        var key = x.s + '\u0001' + x.v + '\u0001' + x.m;
        buf.m[key] = (buf.m[key] || 0) + 1;
        buf.n++;
      });
      var json = JSON.stringify(buf);
      if (json.length <= FB_MAX_BYTES) cache.put('er_buf', json, FB_TTL);
    }
  } catch (err2) {
    console.warn('err: буфер недоступний');
  } finally {
    if (got) { try { lock.releaseLock(); } catch (err3) { /* уже снята */ } }
  }
  return { ok: true };
}

/** Раз в час (из hourlyJob): одна сводка получателям заказов, если ошибки были; буфер очищается. В лист ничего не пишется. */
function errorsJob() {
  var cache = CacheService.getScriptCache();
  var lock = null, got = false, buf = null;
  try {
    if (!cache.get('er_buf')) return { sent: 0 };
    lock = LockService.getDocumentLock();
    got = lock.tryLock(1000);
    if (!got) return { sent: 0, deferred: true }; // следующий час
    try { buf = JSON.parse(cache.get('er_buf') || 'null'); } catch (err) { buf = null; }
    cache.remove('er_buf');
  } finally {
    if (got) { try { lock.releaseLock(); } catch (err2) { /* уже снята */ } }
  }
  if (!buf || !(buf.n > 0)) return { sent: 0 };
  var props = scriptProps_();
  var token = props.getProperty('BOT_TOKEN');
  var ids = orderNotifyIds_(props);
  if (!token || !ids.length) return { sent: 0 };
  var top = Object.keys(buf.m || {}).map(function (k) { return { k: k, c: buf.m[k] }; })
    .sort(function (a, b) { return (b.c - a.c) || (a.k < b.k ? -1 : 1); }).slice(0, 5);
  var lines = top.map(function (x) {
    var p = x.k.split('\u0001');
    return '• ' + escHtml_(p[2]) + ' (екран: ' + escHtml_(p[0] || '—') + ', версія: ' + escHtml_(p[1] || '—') + ') × ' + x.c;
  });
  var text = 'Помилки у магазині: ' + buf.n + (lines.length ? '\n' + lines.join('\n') : '');
  ids.forEach(function (id) { tg_(token, 'sendMessage', { chat_id: id, text: text, parse_mode: 'HTML', disable_web_page_preview: true }); });
  return { sent: ids.length, n: buf.n };
}
