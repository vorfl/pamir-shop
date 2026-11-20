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
    console.error('stage9b: ' + safeErr_(err, true));
    lock.releaseLock();
    var fail = 'Помилка: ' + safeErr_(err) + '. Повторний запуск безпечний.';
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
    if (!secret || !base) return;
    // Секрет уходит только на https-адрес вида *.workers.dev; иное — не слать и один раз написать в журнал (без адреса и секрета).
    var hm = /^https:\/\/([a-z0-9.-]+)(?::\d+)?(?:\/[^\s?#@]*)?$/i.exec(base);
    var host = hm ? hm[1].toLowerCase() : '';
    if (!host || host.length < 13 || host.slice(-12) !== '.workers.dev' || /\.\.|^\./.test(host)) {
      console.warn('purge: WORKER_URL не підходить (потрібен https і адреса *.workers.dev), сповіщення Worker пропущено');
      return;
    }
    var res = UrlFetchApp.fetch(base + '/purge', { method: 'post', headers: { 'X-Pamir-Key': secret }, payload: '', muteHttpExceptions: true, followRedirects: false });
    var code = res && typeof res.getResponseCode === 'function' ? res.getResponseCode() : 0;
    if (code >= 300) console.warn('purge: код ' + code);
  } catch (err) {
    console.warn('purge: не вдалося'); // текст ошибки не пишем: в нём может быть адрес Worker
  }
}

/* ------------------------- б7.2: буфер событий и отметок клиентов ------------------------- */
/*
 * Устройство. CacheService не умеет дописывать, поэтому каждая пачка (события + отметка клиента одного запроса) — свой ключ fb_<n>.
 * Счётчики fb_n (последняя занятая пачка) и fb_t (последняя записанная в лист) меняются под короткой блокировкой (counterLock_):
 * сначала DocumentLock (заказы его не используют), а если он недоступен (в веб-приложении getDocumentLock() может вернуть null) —
 * ScriptLock с tryLock(300). Под блокировкой только счётчик; сами данные кладутся в кэш уже после неё. flushJob, увидев номер без
 * данных (запрос ещё не успел положить), ждёт один цикл, потом считает пачку потерянной.
 * Нет ни одной блокировки — «запасные слоты» без блокировки: ключ fs_<минута>_<случайный номер из FB_SLOTS>; flushJob читает слоты
 * прошедших минут. Столкновение слотов — редкая допустимая потеря (считается в fb_lost).
 * flushJob (раз в минуту) берёт блокировку скрипта через tryLock; занята — откладывает до следующего запуска, ничего не теряя
 * (fb_t сдвигается только после записи в лист). Буфер пуст — выход сразу, без обращения к таблице и блокировке.
 * Режим включён, только если FAST_MODE = 1 И flushJob недавно работал (метка fb_hb в кэше, 15 минут): если триггер пропал,
 * витрина сама возвращается к прямой записи.
 * Ёмкость: честная витрина — до 1500 пачек в минуту с запасом; очередь держит FB_MAX_PENDING пачек (~2,5 минуты потока на случай,
 * когда flushJob отложен), за проход пишется FB_FLUSH_BATCHES пачек, за запуск — до FB_FLUSH_ROUNDS проходов.
 */
var FB_TTL = 21600;           // срок жизни в кэше, максимум CacheService — 6 часов
var FB_MAX_PENDING = 4000;    // сколько пачек ждёт записи; больше — новые отбрасываются (счётчик потерь fb_lost)
var FB_MAX_BYTES = 90000;     // предел значения кэша — 100 КБ
var FB_FLUSH_BATCHES = 100;   // пачек за одну порцию flushJob (блокировка скрипта держится недолго)
var FB_FLUSH_ROUNDS = 60;     // порций за один запуск flushJob (до 6000 пачек; между порциями блокировка свободна)
var FB_PORTION_MS = 3000;     // порция кончается раньше, если блокировка держится дольше этого времени (по часам)
var FB_JOB_BUDGET_MS = 35000; // общее время flushJob: новые порции позже не начинаются (минутные запуски не накладываются)
var FB_GAP_WAIT_MS = 20000;   // пропущенные номера очереди ждут столько, прежде чем считаться потерянными
var FB_SLOTS = 200;           // запасных слотов на минуту (запись без блокировки)
var FB_SLOT_LOOKBACK = 30;    // сколько прошедших минут flushJob ещё смотрит в слотах
var FB_GET_CHUNK = 100;       // ключей за один cache.getAll
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

/**
 * Короткая блокировка для счётчиков (события, отметки, ошибки, лимиты). DocumentLock → если он null, занят или бросил исключение —
 * ScriptLock с коротким tryLock. Возвращает взятую блокировку или null (тогда вызывающий пишет в запасные слоты или отказывает).
 */
function counterLock_(docMs, scriptMs) {
  var lock = null;
  try { lock = LockService.getDocumentLock(); } catch (err) { lock = null; }
  if (lock) {
    try { if (lock.tryLock(docMs || 500)) return lock; } catch (err2) { /* пробуем блокировку скрипта */ }
  }
  try {
    var sl = LockService.getScriptLock();
    if (sl && sl.tryLock(scriptMs || 300)) return sl;
  } catch (err3) { /* блокировок нет */ }
  return null;
}

function unlock_(lock) {
  if (lock) { try { lock.releaseLock(); } catch (err) { /* уже снята */ } }
}

/** cache.getAll порциями по FB_GET_CHUNK ключей. */
function cacheGetAll_(cache, keys) {
  var out = {};
  for (var i = 0; i < keys.length; i += FB_GET_CHUNK) {
    var part = cache.getAll(keys.slice(i, i + FB_GET_CHUNK));
    Object.keys(part).forEach(function (k) { out[k] = part[k]; });
  }
  return out;
}

function minuteNo_() { return Math.floor(Date.now() / 60000); }

/** Запасной слот без блокировки: ключ <prefix><минута>_<случайный номер>. Занят — потеря (считается). */
function slotPut_(prefix, json) {
  try {
    var cache = CacheService.getScriptCache();
    var m = minuteNo_();
    var key = prefix + m + '_' + Math.floor(Math.random() * FB_SLOTS);
    if (cache.get(key) !== null) { fbLost_(1); return false; } // столкновение слотов
    cache.put(key, json, FB_TTL);
    cache.put(prefix + 'm_' + m, '1', FB_TTL); // отметка «в этой минуте есть слоты»
    return true;
  } catch (err) {
    fbLost_(1);
    return false;
  }
}

/** Минуты from…to, в которых есть слоты prefix (по отметкам). */
function slotMinutes_(cache, prefix, from, to) {
  if (to < from) return [];
  var keys = [], mins = [];
  for (var m = from; m <= to; m++) keys.push(prefix + 'm_' + m);
  var got = cacheGetAll_(cache, keys);
  for (var m2 = from; m2 <= to; m2++) if (got[prefix + 'm_' + m2]) mins.push(m2);
  return mins;
}

/** Все слоты этих минут одним проходом: { keys: [все возможные ключи], vals: { ключ: строка } }. */
function slotRead_(cache, prefix, mins) {
  var keys = [];
  mins.forEach(function (m) { for (var i = 0; i < FB_SLOTS; i++) keys.push(prefix + m + '_' + i); });
  return { keys: keys, vals: cacheGetAll_(cache, keys) };
}

/** Кладёт пачку { e: [строки событий], c: отметка клиента } в буфер. true — принято; false — отброшено (потери посчитаны). */
function bufferPush_(batch) {
  var json;
  try {
    json = JSON.stringify(batch);
  } catch (err0) { fbLost_(1); return false; }
  if (json.length > FB_MAX_BYTES) { fbLost_(1); return false; }
  var cache;
  try { cache = CacheService.getScriptCache(); } catch (err1) { return false; }
  var lock = counterLock_(500, 300);
  if (!lock) return slotPut_('fs_', json); // ни одной блокировки: запасные слоты
  var n = 0;
  try {
    var both = cache.getAll(['fb_n', 'fb_t']);
    var t = parseInt(both.fb_t, 10) || 0;
    n = Math.max(parseInt(both.fb_n, 10) || 0, t);
    if (n - t >= FB_MAX_PENDING) { fbLost_(1); return false; }
    n++;
    cache.put('fb_n', String(n), FB_TTL); // под блокировкой только номер
  } catch (err) {
    fbLost_(1);
    return false;
  } finally {
    unlock_(lock);
  }
  try {
    cache.put('fb_' + n, json, FB_TTL); // данные — уже вне блокировки; flushJob ждёт номер без данных один цикл
    return true;
  } catch (err2) {
    fbLost_(1);
    return false;
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

/* touchPrep_ и writeEventRows_ перенесены в Code.gs: нужны и без быстрого режима (устойчивость к забытому файлу). */

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
  var changed = {}; // строка → [первая, последняя изменённая колонка]: пишем только их, одним setValues на строку
  function set(r, c, v) {
    values[r][c] = v;
    if (r >= origLen) return;
    var ch = changed[r];
    if (!ch) changed[r] = [c, c]; else { if (c < ch[0]) ch[0] = c; if (c > ch[1]) ch[1] = c; }
  }
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
  Object.keys(changed).forEach(function (k) {
    var ch = changed[k], r = Number(k);
    sheet.getRange(r + 1, ch[0] + 1, 1, ch[1] - ch[0] + 1).setValues([values[r].slice(ch[0], ch[1] + 1)]);
  });
  var added = values.slice(origLen);
  if (added.length) sheet.getRange(sheet.getLastRow() + 1, 1, added.length, width).setValues(added);
  return touches.length;
}

/** Состояние пропусков очереди: { w: до какого номера просмотрено, g: [пропущенные номера], at: когда пропуски последний раз добавлялись }. */
function gapParse_(raw) {
  try {
    var o = JSON.parse(String(raw || ''));
    if (o && typeof o === 'object' && Array.isArray(o.g)) return { w: Number(o.w) || 0, g: o.g.map(Number).filter(function (x) { return x > 0; }), at: Number(o.at) || 0 };
  } catch (err) { /* нет состояния */ }
  return { w: 0, g: [], at: 0 };
}

/**
 * Одна порция записи буфера (блокировка скрипта держится только на неё). lockMs — сколько ждать блокировку (tryLock).
 * Возвращает { deferred, batches, events, clients, more, gap, error }.
 * deferred: блокировка занята — ничего не записано и не потеряно, следующий запуск продолжит.
 * Порция: до FB_FLUSH_BATCHES пачек и не дольше FB_PORTION_MS по часам. Буфер пуст (ни пачек, ни слотов) — возврат сразу: ни таблицы, ни блокировки.
 * Пропуски (номер занят, данных нет): все сразу ждут FB_GAP_WAIT_MS, при следующей порции после этого считаются потерянными;
 * очередь при этом не останавливается (просмотр идёт дальше, остальное пишется сразу).
 * Указатель fb_t сдвигается сразу после успешной записи в лист, до ротации листа и чистки кэша.
 */
function flushBuffer_(lockMs) {
  var res = { deferred: false, batches: 0, events: 0, clients: 0, more: false, error: false, gap: false };
  var cache = CacheService.getScriptCache();
  var cur = minuteNo_();
  var peek = cache.getAll(['fb_n', 'fb_t', 'fs_done']);
  var slotFrom = Math.max((parseInt(peek.fs_done, 10) || 0) + 1, cur - FB_SLOT_LOOKBACK), slotTo = cur - 1; // текущую минуту дочитаем в следующий раз
  var hasMain = (parseInt(peek.fb_n, 10) || 0) > (parseInt(peek.fb_t, 10) || 0);
  var slotMins = slotMinutes_(cache, 'fs_', slotFrom, slotTo);
  if (!hasMain && !slotMins.length) return res;
  var lock = LockService.getScriptLock();
  var got = false;
  try { got = lock.tryLock(lockMs); } catch (err) { got = false; }
  if (!got) { res.deferred = true; return res; }
  var sheetToTrim = null, afterKeys = [];
  try {
    var t0 = Date.now();
    var both = cache.getAll(['fb_n', 'fb_t', 'fb_gap']);
    var n = parseInt(both.fb_n, 10) || 0, t = parseInt(both.fb_t, 10) || 0;
    var from = Math.max(t, n - FB_MAX_PENDING); // более старые уже не помещаются в очередь
    var st = gapParse_(both.fb_gap);
    var oldGaps = st.g.filter(function (x) { return x > from && x <= n; });
    var waitOld = oldGaps.length > 0 && Date.now() - st.at < FB_GAP_WAIT_MS; // прежние пропуски ждут один цикл
    var w = Math.max(st.w, from);                 // номера до w (кроме пропусков) уже обработаны
    var upper = Math.min(n, w + FB_FLUSH_BATCHES);
    var keys = [];
    if (!waitOld) oldGaps.forEach(function (x) { keys.push('fb_' + x); });
    for (var k = w + 1; k <= upper; k++) keys.push('fb_' + k);
    var got2 = keys.length ? cacheGetAll_(cache, keys) : {};
    var events = [], touches = [], missing = n > t ? from - t : 0, dropKeys = [], newGaps = [], keptGaps = waitOld ? oldGaps : [];
    function take(raw) {
      try {
        var b = JSON.parse(raw);
        if (b && Array.isArray(b.e)) b.e.forEach(function (r) { events.push([new Date(Number(r[0]) || Date.now()), r[1], r[2], r[3], r[4], r[5]]); });
        if (b && b.c) touches.push(b.c);
        res.batches++;
      } catch (err) { missing++; }
    }
    if (!waitOld) {
      oldGaps.forEach(function (x) { // прошёл цикл: пришло — пишем, иначе считаем потерей
        var raw0 = got2['fb_' + x];
        if (typeof raw0 === 'string') { take(raw0); dropKeys.push('fb_' + x); } else missing++;
      });
    }
    var scanned = w;
    for (var num = w + 1; num <= upper; num++) {
      if (num > w + 1 && Date.now() - t0 > FB_PORTION_MS) break; // порция не держит блокировку дольше срока
      var raw = got2['fb_' + num];
      scanned = num;
      if (typeof raw !== 'string') { newGaps.push(num); continue; } // номер занят, данных нет: ждём цикл (общий для всех пропусков)
      take(raw);
      dropKeys.push('fb_' + num);
    }
    var allGaps = keptGaps.concat(newGaps);
    var newT = allGaps.length ? Math.max(t, Math.min.apply(null, allGaps) - 1) : Math.max(t, scanned);
    var slotKeys = [], slotDone = 0;
    if (slotMins.length) {
      var sm = slotMins.slice(0, 1); // за порцию — одна минута слотов
      var sl = slotRead_(cache, 'fs_', sm);
      sl.keys.forEach(function (key) { if (typeof sl.vals[key] === 'string') { take(sl.vals[key]); slotKeys.push(key); } });
      slotDone = slotMins.length > 1 ? sm[0] : slotTo;
    }
    try {
      applyClientTouches_(touches); // сначала отметки (повтор безвреден), потом события
      sheetToTrim = writeEventRows_(events, true);
      cache.remove('fb_fail');
    } catch (err) {
      // Запись не удалась: fb_t не сдвигается, следующий запуск повторит. Пять неудач подряд — пачку отбрасываем, чтобы не застрять.
      var fails = (parseInt(cache.get('fb_fail'), 10) || 0) + 1;
      console.error('flush: ' + safeErr_(err));
      res.error = true;
      if (fails < 5) { cache.put('fb_fail', String(fails), 3600); return res; }
      cache.remove('fb_fail');
      fbLost_(dropKeys.length + slotKeys.length);
      res.batches = 0; events = []; touches = []; sheetToTrim = null;
    }
    // Указатель — сразу после записи, до любых необязательных действий (ротация, чистка кэша): сбой дальше не вызовет повторной записи.
    try {
      if (n > t) cache.put('fb_t', String(newT), FB_TTL);
      if (allGaps.length) cache.put('fb_gap', JSON.stringify({ w: scanned, g: allGaps, at: newGaps.length || !waitOld ? Date.now() : st.at }), FB_TTL);
      else if (both.fb_gap) cache.remove('fb_gap');
      if (slotMins.length) cache.put('fs_done', String(slotDone), FB_TTL);
    } catch (errP) { console.error('flush pointer: ' + safeErr_(errP)); }
    if (missing) fbLost_(missing);
    afterKeys = dropKeys.concat(slotKeys);
    res.events = events.length;
    res.clients = touches.length;
    res.gap = allGaps.length > 0;
    res.more = (scanned < n || slotMins.length > 1);
    if (sheetToTrim) { try { trimEventsSheet_(sheetToTrim); } catch (errT) { console.warn('flush trim: ' + safeErr_(errT)); } } // ротация не откатывает указатель
  } finally {
    lock.releaseLock();
  }
  // Чистка кэша — уже вне блокировки; ошибка не мешает следующей порции.
  try { if (afterKeys.length) cacheRemoveAll_(cache, afterKeys); } catch (errC) { /* ключи сами истекут */ }
  return res;
}

function cacheRemoveAll_(cache, keys) {
  for (var i = 0; i < keys.length; i += FB_GET_CHUNK) cache.removeAll(keys.slice(i, i + FB_GET_CHUNK));
}

/** Триггер раз в минуту (ставит пункт меню «Увімкнути швидкий режим»). Занята блокировка — отложить до следующего запуска. Пустой буфер — выход сразу. */
function flushJob() {
  try {
    var cache = CacheService.getScriptCache();
    if (scriptProps_().getProperty('FAST_MODE') === '1') cache.put('fb_hb', '1', FB_HEARTBEAT_SEC);
    var started = Date.now();
    for (var round = 0; round < FB_FLUSH_ROUNDS; round++) {
      var res = flushBuffer_(2000); // одна порция под блокировкой; между порциями она свободна, заказ проходит
      if (res.deferred || res.error || !res.more || Date.now() - started > FB_JOB_BUDGET_MS) break; // остаток — на следующий запуск
    }
    var lost = parseInt(cache.get('fb_lost'), 10) || 0;
    if (lost) { console.warn('flush: втрачено подій/відміток: ' + lost); cache.remove('fb_lost'); }
  } catch (err) {
    console.error('flushJob: ' + safeErr_(err));
  }
  try { if (typeof orderQueueSweep_ === 'function') orderQueueSweep_(); } catch (err2) { console.error('flushJob order queue: ' + safeErr_(err2)); } // Stage9b5.gs: страховка очереди сообщений о заказах
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
  do { res = flushBuffer_(20000); rounds++; } while (res && !res.deferred && !res.error && (res.more || (res.gap && rounds < 3)) && rounds < 20); // сначала дописать буфер
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
  // Папка — ТОЛЬКО по сохранённому id (по имени не ищем никогда: посторонняя папка с таким именем не должна получить копии таблицы).
  if (id) {
    try { folder = DriveApp.getFolderById(id); if (!folder || (folder.isTrashed && folder.isTrashed())) folder = null; } catch (err) { folder = null; }
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
    console.error('backup: ' + safeErr_(err));
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
    console.error('backup: ' + safeErr_(err));
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
var ERR_FB_PER_DID_HOUR = 2;  // метка worker_fallback с одного телефона в час (не съедает лимит настоящих ошибок)
var ERR_TOTAL_HOUR = 300;     // общий счётчик: выше него повторы уже известных текстов не растут
var ERR_DISTINCT_HOUR = 40;   // разных текстов в час: новые сверх этого молча отбрасываются
var ERR_TEXT_MAX = 80;
var ERR_SUMMARY_TOP = 5;
var ERR_FALLBACK_MSG = 'worker_fallback'; // метка витрины: Worker не ответил, каталог взят напрямую — это не ошибка
var ERR_FALLBACK_GAP_MS = 24 * 3600 * 1000; // одна сводка «только метки» в сутки (свойство ERR_FB_LAST)
var ERR_DID_PER_KEY = 60;     // сколько разных телефонов помним на один вид ошибки
var ERR_SLOT_LOOKBACK = 65;   // минут слотов, которые читает часовая сводка

/**
 * Чистка текста ошибки. Любые адреса (http/https/www, домены слово.зона, t.me), @имена, телефоны, почта, initData и параметры
 * вырезаются; остаются только буквы, цифры, пробел и базовая пунктуация. Чужая ссылка в сводку админу попасть не может.
 */
function errScrub_(v, max) {
  var s = clean_(v, 2000);
  s = s.replace(/\b(?:https?|ftp):\/\/\S*/gi, ' ');
  s = s.replace(/\bwww\.\S*/gi, ' ');
  s = s.replace(/\bt\.me\S*/gi, ' ');
  s = s.replace(/[?#]\S*/g, ' '); // остаток с параметрами или якорем
  s = s.replace(/\S*(?:initData|tgWebAppData)\S*/gi, ' ');
  s = s.replace(/\b(?:hash|user|query_id|auth_date|signature|start_param)(?:=|%3D)\S*/gi, ' ');
  s = s.replace(/\S+@\S+\.\S+/g, ' ');
  s = s.replace(/@\w+/g, ' '); // @имена
  s = s.replace(/(?:[\p{L}\p{N}_-]+\.)+[\p{L}]{2,24}(?![\p{L}\p{N}_])\S*/gu, ' '); // домены слово.зона и всё после них (путь)
  s = s.replace(/\b\d{1,3}(?:\.\d{1,3}){3}\b\S*/g, ' '); // IP-адреса
  s = s.replace(/\+?\d[\d\s().\-]{5,}\d/g, function (m) { return m.replace(/\D/g, '').length >= 7 ? ' ' : m; });
  s = s.replace(/[^\p{L}\p{N} .,:;!?()'"\-]+/gu, ' '); // только буквы, цифры, пробел и базовая пунктуация
  return s.replace(/\s+/g, ' ').trim().slice(0, max);
}

var ERR_TYPES = ['TypeError', 'ReferenceError', 'SyntaxError', 'RangeError', 'EvalError', 'URIError', 'Error'];
var ERR_FILES = ['app.js', 'config.js', 'index.html'];
var ERR_NET_RE = /^net [\w.]{1,24}: (?:HTTP \d{3}|timeout|network)$/;
var ERR_SCRIPT_RE = /^(TypeError|ReferenceError|SyntaxError|RangeError|EvalError|URIError|Error) @ (app\.js|config\.js|index\.html):\d{1,6}$/;

/**
 * Разбор ДО вырезания адресов: известный вид -> безопасная каноническая строка, иначе ''.
 *  'net <действие>: HTTP <код>|timeout|network' (как шлёт app.js) -> без изменений;
 *  '<текст с TypeError…> @ app.js:123' -> 'TypeError @ app.js:123' (текст ошибки отбрасывается);
 *  'promise: …' -> 'Unhandled' (текст отбрасывается).
 */
function errSafe_(v) {
  var s = clean_(v, 400).replace(/\s+/g, ' ');
  if (ERR_NET_RE.test(s)) return s;
  var loc = /@ ([\w.\-]{1,24}):(\d{1,6})$/.exec(s);
  if (loc && ERR_FILES.indexOf(loc[1]) >= 0) {
    var type = '';
    ERR_TYPES.some(function (t) { if (new RegExp('(?:^|[^\\w])' + t + '(?![\\w])').test(s)) { type = t; return true; } return false; });
    // более конкретный тип выигрывает у общего Error: проверяем в порядке списка (Error — последний)
    if (type) return type + ' @ ' + loc[1] + ':' + loc[2];
    return '';
  }
  if (/^promise:/.test(s)) return 'Unhandled';
  if (s === ERR_FALLBACK_MSG) return s;
  return '';
}

/** Запись буфера пригодна для показа админу только в известном виде. */
function errShowable_(m) {
  m = String(m || '');
  return ERR_NET_RE.test(m) || ERR_SCRIPT_RE.test(m) || m === 'Unhandled';
}

/** Короткий отпечаток телефона (устройства): сам did в буфер, слоты и сводку не попадает. 16 hex, два варианта FNV. */
function errDidHash_(did) {
  var s = String(did || '');
  var h1 = 0x811c9dc5, h2 = 0x01000193;
  for (var i = 0; i < s.length; i++) {
    var c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ (c + i), 0x85ebca6b) >>> 0;
  }
  return ('00000000' + h1.toString(16)).slice(-8) + ('00000000' + h2.toString(16)).slice(-8);
}

/** Запоминает телефон за видом ошибки: есть отпечаток — в список (без повторов), нет (старая запись) — метка «невідомо». */
function errNoteDid_(holder, key, d) {
  if (!d) { holder.u = holder.u || {}; holder.u[key] = 1; return; }
  holder.d = holder.d || {};
  var list = holder.d[key] = holder.d[key] || [];
  if (list.indexOf(d) < 0 && list.length < ERR_DID_PER_KEY) list.push(d);
}

/** Добавляет одну запись в буфер ошибок: тот же текст — одна запись со счётчиком и списком отпечатков телефонов. */
function errBufAdd_(buf, x) {
  var d = /^[0-9a-f]{16}$/.test(String(x.d || '')) ? String(x.d) : '';
  if (x.m === ERR_FALLBACK_MSG) { // не ошибка: считается отдельно и в N не входит
    var f = buf.f = buf.f || { c: 0 };
    if (f.c < ERR_TOTAL_HOUR) { f.c++; errNoteDid_(f, 'x', d); }
    return;
  }
  var key = x.s + '\u0001' + x.v + '\u0001' + x.m;
  if (buf.m[key] !== undefined) { // повтор: не расходует потолок разных текстов, общий счётчик растёт до ERR_TOTAL_HOUR
    if (buf.n < ERR_TOTAL_HOUR) { buf.m[key]++; buf.n++; errNoteDid_(buf, key, d); }
    return;
  }
  if (Object.keys(buf.m).length >= ERR_DISTINCT_HOUR) return; // разных текстов слишком много
  buf.m[key] = 1;
  buf.n++;
  errNoteDid_(buf, key, d);
}

function errBufParse_(raw) {
  var buf = {};
  try { buf = JSON.parse(raw || '{}') || {}; } catch (err) { buf = {}; }
  buf.n = Number(buf.n) || 0;
  buf.m = buf.m && typeof buf.m === 'object' ? buf.m : {};
  if (!buf.v) { // буфер, накопленный до выкладки (нет отпечатков телефонов): всё в нём «невідомо»
    Object.keys(buf.m).forEach(function (k) { buf.u = buf.u || {}; buf.u[k] = 1; });
    buf.v = 2;
  }
  return buf;
}

/**
 * action: 'err' — { did, items: [{ m, s, v }] }. initData не нужен и не читается. Сохраняются только текст (≤80), экран (≤24), версия (≤12).
 * ≤5 записей в час с одного did; один и тот же текст — одна запись со счётчиком; разных текстов ≤40 в час; сверх — молча ok.
 * Копится в кэше, в лист ничего не пишется. Нет блокировок — запасные слоты (fx_), сводка их дочитает.
 */
function handleErr_(body) {
  var did = String(body && body.did || '');
  if (!/^[a-z0-9]{8,32}$/.test(did) || !Array.isArray(body.items)) return { ok: false, error: 'bad_form' };
  var cache = CacheService.getScriptCache();
  var dKey = 'er_d_' + did + '_' + Math.floor(Date.now() / 3600000);
  var used = parseInt(cache.get(dKey), 10) || 0;
  var fKey = 'er_f_' + did + '_' + Math.floor(Date.now() / 3600000); // метка worker_fallback: свой лимит
  var usedF = parseInt(cache.get(fKey), 10) || 0;
  var newF = 0;
  var items = [];
  var dh = errDidHash_(did);
  body.items.slice(0, ERR_PER_DID_HOUR + ERR_FB_PER_DID_HOUR).forEach(function (it) {
    var m = errSafe_(it && it.m) || errScrub_(it && it.m, ERR_TEXT_MAX);
    if (!m) return;
    if (m === ERR_FALLBACK_MSG) {
      if (usedF + newF >= ERR_FB_PER_DID_HOUR) return;
      newF++;
    } else if (used + items.filter(function (y) { return y.m !== ERR_FALLBACK_MSG; }).length >= ERR_PER_DID_HOUR) return;
    var v = String((it && it.v) || '').replace(/[^0-9A-Za-z.\-]/g, '').slice(0, 12);
    if (!/^v?\d[\w.\-]*$/i.test(v)) v = ''; // версия похожа на версию, а не на адрес
    items.push({ m: m, s: String((it && it.s) || '').replace(/[^\w:\-]/g, '').slice(0, 24), v: v, d: dh });
  });
  if (!items.length) return { ok: true };
  var realN = items.length - newF;
  if (realN > 0) cache.put(dKey, String(used + realN), 3600);
  if (newF > 0) cache.put(fKey, String(usedF + newF), 3600);
  // Анонимный запрос не должен брать блокировку заказов: только DocumentLock, иначе запасные слоты.
  var lock = null;
  try { var dl = LockService.getDocumentLock(); if (dl && dl.tryLock(500)) lock = dl; } catch (errLock) { lock = null; }
  if (!lock) { slotPut_('fx_', JSON.stringify(items)); return { ok: true }; }
  try {
    var buf = errBufParse_(cache.get('er_buf'));
    items.forEach(function (x) { errBufAdd_(buf, x); });
    var json = JSON.stringify(buf);
    if (json.length <= FB_MAX_BYTES) cache.put('er_buf', json, FB_TTL);
  } catch (err2) {
    console.warn('err: буфер недоступний');
  } finally {
    unlock_(lock);
  }
  return { ok: true };
}

/** Раз в час (из hourlyJob): одна сводка получателям заказов, если ошибки были; буфер очищается. В лист ничего не пишется. */
function errorsJob() {
  var cache = CacheService.getScriptCache();
  var cur = minuteNo_();
  var slotMins = slotMinutes_(cache, 'fx_', cur - ERR_SLOT_LOOKBACK, cur);
  if (!cache.get('er_buf') && !slotMins.length) return { sent: 0 };
  var lock = counterLock_(1000, 1000);
  if (!lock) return { sent: 0, deferred: true }; // следующий час
  var buf = null;
  try {
    buf = errBufParse_(cache.get('er_buf'));
    cache.remove('er_buf');
    if (slotMins.length) { // ошибки, записанные без блокировки: сливаем в общую сводку
      var sl = slotRead_(cache, 'fx_', slotMins);
      sl.keys.forEach(function (key) {
        if (typeof sl.vals[key] !== 'string') return;
        try { (JSON.parse(sl.vals[key]) || []).forEach(function (x) { if (x && x.m) errBufAdd_(buf, { m: String(x.m).slice(0, ERR_TEXT_MAX), s: String(x.s || ''), v: String(x.v || ''), d: String(x.d || '') }); }); } catch (e) { /* испорченный слот */ }
      });
      cacheRemoveAll_(cache, sl.keys.filter(function (key) { return typeof sl.vals[key] === 'string'; }));
      cacheRemoveAll_(cache, slotMins.map(function (m) { return 'fx_m_' + m; }));
    }
  } finally {
    unlock_(lock);
  }
  var fb = buf && buf.f && buf.f.c > 0 ? buf.f : null;
  if (!buf || (!(buf.n > 0) && !fb)) return { sent: 0 };
  var props = scriptProps_();
  var token = props.getProperty('BOT_TOKEN');
  var ids = orderNotifyIds_(props);
  if (!token || !ids.length) return { sent: 0 };
  var fbLast = Number(props.getProperty('ERR_FB_LAST')) || 0;
  if (!(buf.n > 0) && Date.now() - fbLast < ERR_FALLBACK_GAP_MS) return { sent: 0, fbSkipped: true }; // одни метки — не чаще раза в сутки
  var text = errSummaryText_(buf, fb);
  ids.forEach(function (id) { tg_(token, 'sendMessage', { chat_id: id, text: text, parse_mode: 'HTML', disable_web_page_preview: true }); });
  if (fb) { try { props.setProperty('ERR_FB_LAST', String(Date.now())); } catch (e) { /* не критично */ } }
  return { sent: ids.length, n: buf.n };
}

/** 1 телефон, 2–4 телефони, 5+ телефонів (11–14 — телефонів). */
function errPhoneNoun_(n) {
  var a = n % 10, b = n % 100;
  if (a === 1 && b !== 11) return 'телефон';
  if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return 'телефони';
  return 'телефонів';
}
/** После «з» (родительный): з 1 телефону, з 21 телефону, з 2 телефонів, з 11 телефонів. */
function errPhoneFrom_(n) { return 'з ' + n + ' ' + (n % 10 === 1 && n % 100 !== 11 ? 'телефону' : 'телефонів'); }
/** 1 раз, 2–4 рази, 5+ разів (11–14 — разів, 21 раз, 22 рази). */
function errTimesText_(n) {
  var a = n % 10, b = n % 100;
  if (a === 1 && b !== 11) return n + ' раз';
  if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return n + ' рази';
  return n + ' разів';
}
/** Ошибка админки: экран начинается с admin или это сетевая ошибка действия admin.* (витрина читает admin.* заранее, с экрана catalog). */
function errIsAdmin_(screen, msg) {
  return /^admin/i.test(String(screen || '')) || /^net admin/i.test(String(msg || ''));
}

/** Число разных телефонов по списку видов ошибок; unknown — есть записи без отпечатка (старые, до выкладки). */
function errPhoneStat_(holder, keys) {
  var seen = {}, known = 0, unknown = false;
  keys.forEach(function (k) {
    var list = holder.d && holder.d[k];
    if (list && list.length) list.forEach(function (d) { if (!seen[d]) { seen[d] = 1; known++; } });
    if ((holder.u && holder.u[k]) || !(list && list.length)) unknown = true;
  });
  return { known: known, unknown: unknown };
}

function errPhoneText_(st, from) {
  if (!st.known) return 'телефон невідомий';
  return (from ? errPhoneFrom_(st.known) : st.known + ' ' + errPhoneNoun_(st.known)) + (st.unknown ? ' + невідомо' : '');
}

/** Текст сводки: только счётчики, экраны, версии и известные виды ошибок. Ни did, ни отпечатков. */
function errSummaryText_(buf, fb) {
  var groups = { shop: [], admin: [] };
  Object.keys(buf.m || {}).forEach(function (k) {
    var kp = k.split('\u0001');
    groups[errIsAdmin_(kp[0], kp[2]) ? 'admin' : 'shop'].push({ k: k, c: buf.m[k] });
  });
  function block(list) {
    list.sort(function (a, b) { return (b.c - a.c) || (a.k < b.k ? -1 : 1); });
    var shown = list.filter(function (x) { return errShowable_(x.k.split('\u0001')[2]); });
    var top = shown.slice(0, ERR_SUMMARY_TOP);
    var rest = list.filter(function (x) { return top.indexOf(x) < 0; });
    var lines = top.map(function (x) {
      var p = x.k.split('\u0001');
      return '• ' + escHtml_(p[2]) + ' (екран: ' + escHtml_(p[0] || '—') + ', версія: ' + escHtml_(p[1] || '—') + ') — ' + x.c + ' (' + errPhoneText_(errPhoneStat_(buf, [x.k]), false) + ')';
    });
    if (rest.length) {
      var rn = 0; rest.forEach(function (x) { rn += x.c; });
      lines.push('інші: ' + rn + ' / другие: ' + rn + ' (' + errPhoneText_(errPhoneStat_(buf, rest.map(function (x) { return x.k; })), false) + ')');
    }
    var n = 0; list.forEach(function (x) { n += x.c; });
    return { n: n, lines: lines, st: errPhoneStat_(buf, list.map(function (x) { return x.k; })) };
  }
  var out = [];
  var shop = groups.shop.length ? block(groups.shop) : null;
  var adm = groups.admin.length ? block(groups.admin) : null;
  if (shop || adm) {
    var all = errPhoneStat_(buf, groups.shop.concat(groups.admin).map(function (x) { return x.k; }));
    out.push('Помилки у магазині за годину: ' + buf.n + ' (' + errPhoneText_(all, true) + ')');
    if (shop && adm) {
      out.push('Покупці: ' + shop.n + ' (' + errPhoneText_(shop.st, true) + ')');
      out = out.concat(shop.lines);
      out.push('Адмін-панель: ' + adm.n + ' (' + errPhoneText_(adm.st, true) + ')');
      out = out.concat(adm.lines);
    } else if (adm) {
      out.push('Тільки адмін-панель, покупці помилок не мали / Только админ-панель, у покупателей ошибок не было.');
      out.push('Адмін-панель: ' + adm.n + ' (' + errPhoneText_(adm.st, true) + ')');
      out = out.concat(adm.lines);
    } else {
      out = out.concat(shop.lines);
    }
  }
  if (fb) {
    if (!out.length) out.push('Інформація (це не помилки, покупці нічого не помітили):');
    out.push('Каталог через Cloudflare не відповів, магазин узяв його напряму: ' + errTimesText_(fb.c) + ' (' + errPhoneText_(errPhoneStat_(fb, ['x']), true) + ')');
  }
  return out.join('\n');
}
