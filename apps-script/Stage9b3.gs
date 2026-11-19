/* ======================================================================================================== */
/* Выпуск 9Б3: Нова пошта — защита от лимита «To many requests», двухслойный кэш, один запрос в пути         */
/* ======================================================================================================== */
/*
 * Зачем. После выпуска Б2 Нова пошта ответила «To many requests» (код 20000401501). Здесь собрано всё, что бережёт запросы:
 *   1. Пауза. Первый ответ лимита (success:false с этой фразой или кодом, либо HTTP 429) ставит общую паузу на 10 минут.
 *      Отметка времени — в CacheService и в Script Properties (NP_PAUSE_UNTIL): переживает очистку кэша. Пока пауза идёт,
 *      npCall_ не обращается к сети вообще (публичные, админские, трекинг, отправитель, меню); ответы из кэша отдаются как обычно.
 *   2. Кэш в два слоя. Быстрый — CacheService (потолок Google: 6 часов, 100 КБ на значение). Долгий — скрытый лист «Кеш НП»
 *      (таблица — единственное хранилище проекта; Script Properties не годятся: 9 КБ на значение и getProperties читает всё
 *      целиком при каждом запросе). Лист создаётся лениво, только когда есть NP_API_KEY и есть что записать.
 *      Запрос покупателя в лист НЕ пишет: он кладёт значение в CacheService и ставит ключ в очередь «надо сохранить» (np_pend);
 *      лист пишет только фоновая задача npLongFlush_ из hourlyJob, под отдельной блокировкой LockService.getUserLock() (её не берёт
 *      ни заказ, ни другой код проекта; заказ берёт ScriptLock), и не дольше ~25 секунд за запуск. Запись не удаляет строки в горячем
 *      пути: просроченные строки чистит та же фоновая задача. Чтение — без блокировки: читаются сразу все части записи целиком,
 *      у каждой сверяются ключ и номер части, срок и контрольная метка (число частей, длина, хэш); любое несовпадение — «в кэше нет».
 *      В листе только публичные справочные данные НП (города, отделения, тарифы). Данные отправителя (его город, его отделение и их Ref)
 *      в лист не попадают совсем: поиск отправителя идёт с noLong (только быстрый слой), а город отправителя в ключе стоимости —
 *      лишь HMAC-меткой (npSenderTag_). Ключа НП и телефонов в листе нет.
 *   3. Одинаковый запрос не уходит дважды: короткая отметка «запрос в пути» (npfl_…); второй обращающийся ждёт недолго
 *      и берёт готовый ответ или получает отказ «занято», но дубль не шлёт. CacheService не атомарен, поэтому защита неполная
 *      (две обращения в одну и ту же миллисекунду могут обе пройти) — это сокращает, а не исключает дубли.
 *   4. Данные отправителя живут 7 дней (NP_SENDER_CACHE в Script Properties, см. Stage9b2.gs); повтор неудачной попытки — с нарастающей паузой.
 */

var NP_PAUSE_MS = 10 * 60 * 1000;
var NP_PAUSE_KEY = 'np_pause';
var NP_PAUSE_PROP = 'NP_PAUSE_UNTIL';
var NP_TTL_LONG = 24 * 3600;       // города, отделения, стоимость, найденное отделение: сутки
var NP_TTL_EMPTY = 3600;           // «ничего не найдено»: час, только в быстром слое
var NP_FAST_MAX = 21600;           // потолок CacheService: 6 часов
var NP_FAST_ONE = 90000;           // длиннее — режем на куски (лимит CacheService 100 КБ на значение)
var NP_FAST_BIG = '\u0001L';
var NP_CACHE_SHEET = 'Кеш НП';
var NP_CACHE_HEAD = ['Ключ', 'Частина', 'Частин', 'Діє до', 'Записано', 'Дані'];
var NP_CELL = 45000;               // знаков данных в одной ячейке (лимит Таблиц — 50 000)
var NP_CACHE_MAX_PARTS = 12;       // значение больше этого в лист не пишем (до 540 000 знаков; быстрый слой всё равно держит его 6 часов)
var NP_PEND_KEY = 'np_pend';       // очередь «надо сохранить в лист»: [[ключ, срок до (мс)], …]
var NP_PEND_MAX = 100;             // не больше ключей в очереди (≈ 8 КБ из 100 КБ значения CacheService); лишние просто не сохраняются в лист
var NP_PEND_HINTS_MAX = 40;        // из них не больше стольких подсказок городов (npc2_…): списки отделений, поиск отделения и стоимость не вытесняются
var NP_HINT_LONG_MIN = 4;          // подсказка города короче этого числа знаков — только быстрый слой
var NP_FLUSH_BUDGET_MS = 25000;    // сколько фоновая задача пишет в лист за один запуск
var NP_FLUSH_MAX_PARTS = 40;       // и сколько ячеек максимум за запуск
var NP_CACHE_MAX_ROWS = 400;       // строк в листе не больше: старые записи вытесняются
var NP_CACHE_LOCK_MS = 3000;       // ожидание блокировки записи (фоновая задача, заказ её не ждёт)
var NP_LIMIT_ALERT_PROP = 'NP_LIMIT_ALERT_LAST'; // своя отметка тревоги о лимите (не общая NP_ALERT_LAST)
var NP_LIMIT_HITS_PROP = 'NP_LIMIT_HITS';        // метки времени срабатываний паузы за последние сутки (JSON-массив)
var NP_SENDER_BACKOFF_MS = [3600000, 6 * 3600000, 24 * 3600000]; // 1 ч → 6 ч → 24 ч между неудачными попытками отправителя

/* ---------- Пауза при «To many requests» ---------- */

/** Собирает текст из ошибок НП любого вида: строка, число, массив, объект {код: текст} (и ключи, и значения), вложенные структуры. */
function npErrText_(x, depth) {
  if (x === null || x === undefined || depth > 4) return '';
  var t = typeof x;
  if (t === 'string' || t === 'number' || t === 'boolean') return String(x);
  if (Array.isArray(x)) return x.map(function (v) { return npErrText_(v, depth + 1); }).join(' ');
  if (t === 'object') return Object.keys(x).map(function (k) { return k + ' ' + npErrText_(x[k], depth + 1); }).join(' ');
  return '';
}

/** Ответ НП — «лимит запросов»: HTTP 429, фраза «To many requests»/«Too many requests» или код 20000401501 в errors, errorCodes, translatedErrors, warnings. */
function npLimitHit_(code, data) {
  if (Number(code) === 429) return true;
  if (!data || typeof data !== 'object' || data.success === true || data.success === 'true') return false;
  var s;
  try { s = ['errors', 'errorCodes', 'translatedErrors', 'warnings', 'warningCodes'].map(function (k) { return npErrText_(data[k], 0); }).join(' '); } catch (err) { return false; }
  return /\bto+\s+many\s+requests\b/i.test(s) || /\b20000401501\b/.test(s);
}

/** До какого времени (мс) идёт пауза, или 0. Сначала CacheService, потом Script Properties (переживает очистку кэша). */
function npPauseUntil_() {
  var now = Date.now(), until = 0;
  try { until = Number(CacheService.getScriptCache().get(NP_PAUSE_KEY)) || 0; } catch (e1) { until = 0; }
  if (until > now) return until;
  var p = 0;
  try { p = Number(scriptProps_().getProperty(NP_PAUSE_PROP)) || 0; } catch (e2) { p = 0; }
  if (p > now && p - now <= NP_PAUSE_MS + 60000) { // дальше длины паузы не верим: мусор в свойстве не должен выключить НП навсегда
    try { CacheService.getScriptCache().put(NP_PAUSE_KEY, String(p), Math.max(1, Math.ceil((p - now) / 1000))); } catch (e3) { /* не критично */ }
    return p;
  }
  return 0;
}

/** Секунд до конца паузы (0 — паузы нет). */
function npPauseLeftSec_() {
  var u = npPauseUntil_();
  return u ? Math.max(1, Math.ceil((u - Date.now()) / 1000)) : 0;
}

/** Минут до конца паузы для текстов (не меньше 1). */
function npPauseMin_() { return Math.max(1, Math.ceil(npPauseLeftSec_() / 60)); }

/** Ставит паузу на 10 минут. Уже идёт — не продлевает. Запись свойства — без блокировки (одно атомарное обращение). Каждое новое срабатывание паузы считается. */
function npPauseSet_() {
  if (npPauseUntil_()) return;
  var until = Date.now() + NP_PAUSE_MS;
  try { CacheService.getScriptCache().put(NP_PAUSE_KEY, String(until), Math.ceil(NP_PAUSE_MS / 1000)); } catch (e1) { /* не критично */ }
  try { scriptProps_().setProperty(NP_PAUSE_PROP, String(until)); } catch (e2) { console.warn('np pause: property not saved'); }
  npLimitHitsAdd_();
}

/** Метки времени срабатываний паузы за последние 24 часа (из Script Properties). */
function npLimitHits_() {
  var raw = '', now = Date.now();
  try { raw = scriptProps_().getProperty(NP_LIMIT_HITS_PROP) || ''; } catch (e0) { return []; }
  try {
    var a = JSON.parse(raw || '[]');
    return Array.isArray(a) ? a.map(Number).filter(function (t) { return t > now - 24 * 3600000 && t <= now + 60000; }).slice(-50) : [];
  } catch (e1) { return []; }
}

function npLimitHitsAdd_() {
  try {
    var a = npLimitHits_();
    a.push(Date.now());
    scriptProps_().setProperty(NP_LIMIT_HITS_PROP, JSON.stringify(a.slice(-50)));
  } catch (err) { /* не критично */ }
}

/** Время окончания паузы «ГГ:ХХ» по часовому поясу таблицы. */
function npPauseUntilText_() {
  var u = npPauseUntil_();
  if (!u) return '';
  try { return Utilities.formatDate(new Date(u), SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone() || 'Europe/Kiev', 'HH:mm'); } catch (err) { return ''; }
}

/** Строка состояния для меню: пауза до ГГ:ХХ или «обмежень немає», плюс сколько раз пауза срабатывала за сутки. */
function npLimitStatusLine_() {
  var until = npPauseUntilText_(), n = npLimitHits_().length;
  var line = until ? 'Пауза через ліміт запитів Нової пошти: до ' + until : 'Обмежень від Нової пошти зараз немає';
  return line + (n > 0 ? ' (за останню добу пауза спрацювала ' + npTimesText_(n, 'ua') + ')' : '');
}

/** «n раз/рази/разів» (UA) или «n раз/раза/раз» (RU): 1 раз, 2–4 рази/раза, 5+ разів/раз, 11–14 разів/раз, 21 раз, 22 рази/раза. */
function npTimesText_(n, lang) {
  n = Math.floor(Number(n)) || 0;
  var a = n % 10, b = n % 100, ru = lang === 'ru';
  if (a === 1 && b !== 11) return n + ' раз';
  if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return n + (ru ? ' раза' : ' рази');
  return n + (ru ? ' раз' : ' разів');
}

/** Строки для меню проверки НП: есть ли часовое задание и что в очереди и листе долгого кэша. Каждая проверка в try/catch. */
function npLongStatusLines_() {
  var out = [], on = null;
  try {
    on = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'hourlyJob'; });
  } catch (e0) { on = null; }
  if (on === true) out.push('Щогодинне завдання: увімкнено');
  else if (on === false) out.push('Щогодинне завдання: НЕ увімкнено — без нього кеш Нової пошти живе 6 годин замість доби, а дані відправника не оновлюються. Увімкнути: PAMIR → Увімкнути щоденні повідомлення клієнтам');
  var pend = '?', rows = '?';
  try {
    var l = JSON.parse(CacheService.getScriptCache().get(NP_PEND_KEY) || '[]');
    pend = String(Array.isArray(l) ? l.length : 0);
  } catch (e1) { /* не критично */ }
  try {
    var sh = npLongSheet_(false);
    rows = String(sh ? Math.max(0, sh.getLastRow() - 1) : 0);
  } catch (e2) { /* не критично */ }
  out.push('Довгий кеш Нової пошти: у черзі на запис — ' + pend + ', рядків у листі «' + NP_CACHE_SHEET + '» — ' + rows);
  return out;
}

/**
 * Тревога админам о лимите: не чаще раза в сутки по СВОЕЙ отметке NP_LIMIT_ALERT_LAST (сообщение об отправителе или стоимости её не занимает).
 * Если за сутки пауза срабатывала несколько раз — в тексте сказано сколько. Без ключа и данных отправителя.
 */
function npLimitAlert_() {
  if (typeof npAlertAdmins_ !== 'function') return;
  var n = npPauseMin_(), hits = npLimitHits_().length, uaMore = '', ruMore = '';
  if (hits > 1) {
    uaMore = ' За останню добу пауза спрацювала ' + npTimesText_(hits, 'ua') + ': імовірно, запитів до Нової пошти забагато.';
    ruMore = ' За последние сутки пауза срабатывала ' + npTimesText_(hits, 'ru') + ': возможно, запросов к Новой почте слишком много.';
  }
  npAlertAdmins_(
    'Нова пошта тимчасово обмежила запити (занадто багато звернень). Підказки міст і відділень та розрахунок вартості доставки призупинено приблизно на ' + n +
      ' хв; пауза автоматична і знімається сама, нічого робити не треба. Магазин працює: замовлення приймаються, покупці вводять місто й відділення вручну.' + uaMore,
    'Новая почта временно ограничила запросы (слишком много обращений). Подсказки городов и отделений и расчёт стоимости доставки приостановлены примерно на ' + n +
      ' мин; пауза автоматическая и снимается сама, делать ничего не нужно. Магазин работает: заказы принимаются, покупатели вводят город и отделение вручную.' + ruMore,
    NP_LIMIT_ALERT_PROP);
}

/** Добавляет к ответу витрине необязательное поле retryAfter (секунды), если запрос не ушёл из-за паузы. */
function npRetry_(out, eo) {
  if (eo && eo.paused === true && eo.retryAfter > 0) out.retryAfter = eo.retryAfter;
  return out;
}

/**
 * Ответ витрине при неудаче запроса к НП. Дубль уже в пути (eo.busy) или сработал собственный счётчик сервера (eo.ownLimit, секунд до конца часа):
 * {ok:false, error:'busy'} (для счётчика ещё retryAfter, не больше 600 с). Лимит НП — как раньше (retryAfter паузы); прочее — out как есть.
 */
function npFailOut_(out, eo) {
  if (eo && eo.busy === true) return { ok: false, error: 'busy' };
  if (eo && eo.ownLimit > 0) return { ok: false, error: 'busy', retryAfter: Math.min(600, Math.max(1, Math.ceil(eo.ownLimit))) };
  return npRetry_(out, eo);
}

/* ---------- Быстрый слой (CacheService) ---------- */

function npFastGet_(key) {
  try {
    var v = CacheService.getScriptCache().get(key);
    if (v === null || v === undefined) return null;
    if (v === NP_FAST_BIG) return cacheGetLarge_(key);
    return v;
  } catch (err) { return null; }
}

function npFastPut_(key, text, ttlSec) {
  var ttl = Math.max(1, Math.min(Math.floor(ttlSec), NP_FAST_MAX));
  try {
    var cache = CacheService.getScriptCache();
    if (text.length <= NP_FAST_ONE) cache.put(key, text, ttl);
    else { cachePutLarge_(key, text, ttl); cache.put(key, NP_FAST_BIG, ttl); }
  } catch (err) { /* не критично: ответ уже получен */ }
}

/* ---------- Долгий слой (скрытый лист «Кеш НП») ---------- */

function npLongSheet_(create) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(NP_CACHE_SHEET);
  if (sh || !create) return sh;
  sh = ss.insertSheet(NP_CACHE_SHEET);
  sh.getRange(1, 1, 1, NP_CACHE_HEAD.length).setValues([NP_CACHE_HEAD]).setFontWeight('bold');
  try { sh.hideSheet(); } catch (err) {
    // Лист только что созданный и потому активный: прячем после перехода на другой лист. Не вышло — лист просто остаётся видимым, на работу это не влияет.
    try {
      var other = ss.getSheets().filter(function (x) { return x.getName() !== NP_CACHE_SHEET; })[0];
      if (other) { ss.setActiveSheet(other); sh.hideSheet(); }
    } catch (err2) { /* не критично */ }
  }
  return sh;
}

/** Хэш текста для контрольной метки (два 32-битных, base36). Не криптография: защита от сдвига строк и обрыва записи. */
function npHash_(s) {
  var h1 = 5381, h2 = 52711;
  for (var i = 0; i < s.length; i++) {
    var c = s.charCodeAt(i);
    h1 = ((h1 * 33) ^ c) >>> 0;
    h2 = ((h2 * 31) + c) >>> 0;
  }
  return h1.toString(36) + h2.toString(36);
}

/**
 * {text, exp} или null. Без блокировки. Читает ВСЕ части записи одним запросом (строки подряд от части 0) и сверяет у каждой части ключ, номер
 * части, общее число частей и срок; у части 0 — контрольную метку (число частей : длина : хэш). Строки могут сдвигаться при чистке — тогда
 * сверка не сойдётся, и ответ «в кэше нет» (идём обычным путём), а не чужие данные. Битый, неполный, просроченный или двойной — тоже «нет».
 */
function npLongGet_(key) {
  try {
    var sh = npLongSheet_(false);
    if (!sh) return null;
    var last = sh.getLastRow();
    if (last < 2) return null;
    var idx = sh.getRange(2, 1, last - 1, 4).getValues(), now = Date.now(), r0 = 0, total = 0, exp = 0;
    for (var i = 0; i < idx.length; i++) {
      if (String(idx[i][0]) !== key || Number(idx[i][1]) !== 0) continue;
      if (r0) return null; // две «части 0»: запись неоднозначна
      r0 = i + 2; total = Number(idx[i][2]); exp = Number(idx[i][3]);
    }
    if (!r0 || !(total >= 1 && total <= NP_CACHE_MAX_PARTS && Math.floor(total) === total) || !(exp > now) || r0 + total - 1 > last) return null;
    var rows = sh.getRange(r0, 1, total, 6).getValues();
    if (!rows || rows.length !== total) return null;
    var text = '', meta = null;
    for (var k = 0; k < total; k++) {
      var r = rows[k];
      if (String(r[0]) !== key || Number(r[1]) !== k || Number(r[2]) !== total || Number(r[3]) !== exp) return null;
      var cell = String(r[5]);
      if (cell.indexOf('n:') !== 0) return null;
      if (k === 0) {
        meta = /^n:(\d+):(\d+):([0-9a-z]+):/.exec(cell);
        if (!meta || Number(meta[1]) !== total) return null;
        text += cell.slice(meta[0].length);
      } else text += cell.slice(2);
    }
    if (text.length !== Number(meta[2]) || npHash_(text) !== meta[3]) return null;
    return { text: text, exp: exp };
  } catch (err) { return null; }
}

/**
 * Блокировка записи в лист: LockService.getUserLock() (заказы и остальной код её не берут — они работают под ScriptLock; DocumentLock тоже не берём:
 * его использует быстрый режим). Нет UserLock — отметка в кэше (не атомарна, но пишет одна фоновая задача; чтение всё равно сверяет данные).
 * Возвращает {release()} или null (занято).
 */
function npLongLock_(ms) {
  var l = null;
  try { l = LockService.getUserLock(); } catch (e0) { l = null; }
  if (l) {
    var got = false;
    try { got = l.tryLock(ms); } catch (e1) { got = false; }
    return got ? { release: function () { try { l.releaseLock(); } catch (e2) { /* не критично */ } } } : null;
  }
  try {
    var cache = CacheService.getScriptCache();
    if (cache.get('np_wlock')) return null;
    cache.put('np_wlock', '1', 120);
    return { release: function () { try { cache.remove('np_wlock'); } catch (e3) { /* сама исчезнет */ } } };
  } catch (e4) { return null; }
}

/**
 * Запись в долгий слой. Вызывает только фоновая задача (npLongFlush_) и тесты; запрос покупателя сюда не заходит. Под npLongLock_ (занято — false).
 * Заменяет прежнюю запись этого ключа, убирает просроченные строки, держит лист не больше NP_CACHE_MAX_ROWS (вытесняются самые старые ключи).
 * Данные режутся на ячейки по NP_CELL знаков с префиксом «n:» (чтобы Таблицы не приняли кусок за число, дату или формулу); у части 0 после
 * «n:» стоит контрольная метка «число частей:длина:хэш:». Больше NP_CACHE_MAX_PARTS ячеек в лист не пишем.
 */
function npLongPut_(key, text, ttlSec) {
  if (!npKey_()) return false;
  text = String(text);
  var chunks = [];
  for (var c = 0; c < text.length; c += NP_CELL) chunks.push(text.substr(c, NP_CELL));
  if (!chunks.length || chunks.length > NP_CACHE_MAX_PARTS) return false;
  var lock = npLongLock_(NP_CACHE_LOCK_MS);
  if (!lock) return false;
  try {
    var now = Date.now(), sh = npLongSheet_(true), last = sh.getLastRow();
    var idx = last >= 2 ? sh.getRange(2, 1, last - 1, 5).getValues() : [];
    var del = [], groups = {}, live = 0;
    for (var i = 0; i < idx.length; i++) {
      var k = String(idx[i][0]);
      if (!k || k === key || !(Number(idx[i][3]) > now)) { del.push(i + 2); continue; }
      var g = groups[k] || (groups[k] = { at: Number(idx[i][4]) || 0, rows: [] });
      g.rows.push(i + 2); live++;
    }
    var room = NP_CACHE_MAX_ROWS - chunks.length;
    if (live > room) {
      Object.keys(groups).sort(function (a, b) { return groups[a].at - groups[b].at; }).forEach(function (gk) {
        if (live <= room) return;
        del = del.concat(groups[gk].rows); live -= groups[gk].rows.length;
      });
    }
    del.sort(function (a, b) { return a - b; });
    var runs = [];
    del.forEach(function (r) {
      var l = runs[runs.length - 1];
      if (l && l.start + l.n === r) l.n++; else runs.push({ start: r, n: 1 });
    });
    for (var j = runs.length - 1; j >= 0; j--) sh.deleteRows(runs[j].start, runs[j].n);
    var start = sh.getLastRow() + 1, need = start + chunks.length - 1;
    if (start < 2) start = 2;
    if (need > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), need - sh.getMaxRows());
    var exp = now + Math.floor(ttlSec) * 1000, head = 'n:' + chunks.length + ':' + text.length + ':' + npHash_(text) + ':';
    sh.getRange(start, 1, chunks.length, NP_CACHE_HEAD.length).setValues(chunks.map(function (t, n) { return [key, n, chunks.length, exp, now, (n === 0 ? head : 'n:') + t]; }));
    SpreadsheetApp.flush();
    return true;
  } catch (err) {
    console.warn('np cache write failed');
    return false;
  } finally {
    lock.release();
  }
}

/** Ставит ключ в очередь «надо сохранить в лист» (CacheService; гонка при добавлении может потерять метку — тогда запись просто останется только в быстром слое). */
function npPendAdd_(key, expMs) {
  try {
    var cache = CacheService.getScriptCache(), list = [];
    try { list = JSON.parse(cache.get(NP_PEND_KEY) || '[]'); } catch (e0) { list = []; }
    if (!Array.isArray(list)) list = [];
    list = list.filter(function (x) { return x && x[0] !== key; });
    var hint = key.indexOf('npc2_') === 0; // подсказка города: низкий приоритет, её много
    var hints = list.filter(function (x) { return String(x[0]).indexOf('npc2_') === 0; }).length;
    if (hint) {
      if (hints >= NP_PEND_HINTS_MAX || list.length >= NP_PEND_MAX) return; // подсказки не занимают место остальных ключей
    } else if (list.length >= NP_PEND_MAX) {
      var at = -1;
      for (var i = 0; i < list.length; i++) { if (String(list[i][0]).indexOf('npc2_') === 0) { at = i; break; } } // вытесняем самую старую подсказку
      if (at < 0) return;
      list.splice(at, 1);
    }
    list.push([key, expMs]);
    cache.put(NP_PEND_KEY, JSON.stringify(list), NP_FAST_MAX);
  } catch (err) { /* не критично */ }
}

/**
 * Фоновая задача (hourlyJob): сохраняет в лист то, что покупатели положили в очередь, и чистит просроченные строки. Значение берётся из быстрого слоя;
 * исчезло или просрочено — пропускается. Не дольше NP_FLUSH_BUDGET_MS и NP_FLUSH_MAX_PARTS ячеек за запуск; остальное — в следующий раз.
 * Не берёт ScriptLock: заказы её не ждут. Возвращает число записанных ключей.
 */
function npLongFlush_() {
  if (!npKey_()) return 0;
  var cache, list;
  try {
    cache = CacheService.getScriptCache();
    list = JSON.parse(cache.get(NP_PEND_KEY) || '[]');
  } catch (e0) { return 0; }
  if (!Array.isArray(list)) return 0;
  var started = Date.now(), parts = 0, done = {}, written = 0;
  for (var i = 0; i < list.length; i++) {
    var key = list[i] && list[i][0], exp = Number(list[i] && list[i][1]);
    if (!key) continue;
    var ttl = Math.floor((exp - Date.now()) / 1000);
    var text = ttl > 0 ? npFastGet_(key) : null;
    if (text === null || ttl <= NP_FAST_MAX) { done[key] = true; continue; } // значения нет или срок уже не «долгий»
    var need = Math.ceil(text.length / NP_CELL);
    if (need > NP_CACHE_MAX_PARTS) { done[key] = true; continue; } // слишком большой для листа: остаётся в быстром слое на 6 часов
    if (Date.now() - started > NP_FLUSH_BUDGET_MS || parts + need > NP_FLUSH_MAX_PARTS) break;
    if (npLongPut_(key, text, ttl)) { done[key] = true; parts += need; written++; }
    else break; // блокировка занята или запись не удалась: до следующего запуска
  }
  try {
    var now = []; // очередь могла пополниться пока писали: убираем только обработанное
    try { now = JSON.parse(cache.get(NP_PEND_KEY) || '[]'); } catch (e1) { now = []; }
    var rest = (Array.isArray(now) ? now : []).filter(function (x) { return x && !done[x[0]]; });
    if (rest.length) cache.put(NP_PEND_KEY, JSON.stringify(rest), NP_FAST_MAX); else cache.remove(NP_PEND_KEY);
  } catch (e2) { /* не критично */ }
  try { npLongSweep_(); } catch (e3) { /* не критично */ }
  return written;
}

/** Чистка листа: убирает просроченные и пустые строки (под той же блокировкой, вне пути покупателя и заказа). */
function npLongSweep_() {
  var sh = npLongSheet_(false);
  if (!sh) return 0;
  var last = sh.getLastRow();
  if (last < 2) return 0;
  var lock = npLongLock_(NP_CACHE_LOCK_MS);
  if (!lock) return 0;
  try {
    var idx = sh.getRange(2, 1, last - 1, 4).getValues(), now = Date.now(), runs = [], n = 0;
    for (var i = 0; i < idx.length; i++) {
      if (String(idx[i][0]) && Number(idx[i][3]) > now) continue;
      var r = i + 2, l = runs[runs.length - 1];
      if (l && l.start + l.n === r) l.n++; else runs.push({ start: r, n: 1 });
      n++;
    }
    for (var j = runs.length - 1; j >= 0; j--) sh.deleteRows(runs[j].start, runs[j].n);
    return n;
  } catch (err) {
    return 0;
  } finally {
    lock.release();
  }
}

/** Значение из кэша: быстрый слой, затем (если useLong) долгий; найденное в долгом слое возвращается в быстрый. null — нет. */
function npCacheGet_(key, useLong) {
  var v = npFastGet_(key);
  if (v !== null) return v;
  if (!useLong) return null;
  var l = npLongGet_(key);
  if (!l) return null;
  var left = Math.floor((l.exp - Date.now()) / 1000);
  if (left > 0) npFastPut_(key, l.text, left);
  return l.text;
}

/**
 * Кладёт значение в кэш: всегда в быстрый слой; если срок больше 6 часов — ещё и в очередь на сохранение в лист (сама запись — фоновая).
 * noLong — данные отправителя и всё, что нельзя класть в лист: только быстрый слой.
 */
function npCachePut_(key, text, ttlSec, noLong) {
  npFastPut_(key, text, ttlSec);
  if (ttlSec > NP_FAST_MAX && !noLong) npPendAdd_(key, Date.now() + Math.floor(ttlSec) * 1000);
}

/* ---------- Один запрос в пути ---------- */

/**
 * Занять «запрос в пути» по ключу. Возвращает {value} (пока ждали, ответ появился), {busy:true} (не дождались: дубль не шлём)
 * или {lead:true, done()} (запрос выполняете вы; done() снимает отметку). peek() — прочитать готовый ответ или null.
 */
function npLead_(key, waitSteps, peek) {
  var cache = null, mk = 'npfl_' + key;
  try { cache = CacheService.getScriptCache(); } catch (e0) { return { lead: true, done: function () {} }; }
  var steps = 0;
  while (cache.get(mk)) {
    if (steps++ >= waitSteps) return { busy: true };
    Utilities.sleep(500);
    var v = peek();
    if (v !== null) return { value: v };
  }
  if (steps > 0) { var late = peek(); if (late !== null) return { value: late }; } // ждали и отметка исчезла: ответ мог появиться
  cache.put(mk, '1', 60);
  return { lead: true, done: function () { try { cache.remove(mk); } catch (e1) { /* отметка сама исчезнет через минуту */ } } };
}

/* ---------- Отделения города: один список на всех (публичный np.whall, поиск номера, старый np.wh) ---------- */

function npWhKey_(cityRef) { return 'npwl_' + String(cityRef).toLowerCase(); }

/** Список отделений города из кэша (быстрый и долгий слой): {c, u, l:[[номер, адрес, 'w'|'p', Ref, описание]]} или null. Без сети. */
function npWhPeek_(cityRef) {
  var t = npCacheGet_(npWhKey_(cityRef), true);
  if (t === null) return null;
  try {
    var o = JSON.parse(t);
    return o && Array.isArray(o.l) ? o : null;
  } catch (err) { return null; }
}

/**
 * Весь список отделений города (страницы по 500). Из кэша; иначе грузит один раз (одновременные запросы ждут первого) и кладёт в оба слоя:
 * 24 часа, пустой город — 1 час. Остановка на первой же ошибке (в том числе на паузе из-за лимита). admin — счётчик и тихий режим админских вызовов.
 * eo — причина отказа (paused, retryAfter, text, api). noLong — не ставить в очередь на запись в лист (поиск отправителя). Возвращает список или null.
 */
function npWhLoad_(cityRef, admin, eo, noLong) {
  var have = npWhPeek_(cityRef);
  if (have) return have;
  var key = npWhKey_(cityRef), lead = npLead_(key, 24, function () { return npCacheGet_(key, true); });
  if (lead.value !== undefined) { have = npWhPeek_(cityRef); if (have) return have; }
  if (!lead.lead) { if (eo) eo.busy = true; return null; } // занято: чужая загрузка идёт, дубль не шлём
  try {
    var started = Date.now(), all = [], done = false, cityD = '', cityRu = '', want = String(cityRef).toLowerCase();
    for (var page = 1; page <= NP_WH_MAX_PAGES && Date.now() - started < NP_WH_MAX_MS; page++) {
      var data = npCall_('getWarehouses', { CityRef: cityRef, Limit: String(NP_WH_PAGE), Page: String(page) }, { noCache: true, admin: !!admin, quiet: !!admin, errOut: eo });
      if (!data) return null;
      data.forEach(function (w) {
        var num = parseInt(w && w.Number, 10);
        if (!(num > 0)) return;
        if (w.CityRef && String(w.CityRef).toLowerCase() !== want) return; // чужой город в ответе: не берём
        var locker = String(w.CategoryOfWarehouse || '') === 'Postomat' || /по[чш]тома[тн]/i.test(String(w.Description || '')); // тип — до любой обрезки
        if (!cityD) { cityD = String(w.CityDescription || '').slice(0, 60); cityRu = String(w.CityDescriptionRu || '').slice(0, 60); }
        all.push([num, String(w.ShortAddress || w.Description || '').slice(0, 90), locker ? 'p' : 'w', NP_UUID_RE.test(String(w.Ref || '')) ? String(w.Ref) : '', String(w.Description || '').slice(0, 140)]);
      });
      if (data.length < NP_WH_PAGE) { done = true; break; }
    }
    if (!done) return null; // не дочитали — неполный список не отдаём и не кэшируем
    all.sort(function (a, b) { return a[0] - b[0] || (a[2] < b[2] ? -1 : 1); });
    var rich = { c: cityD, u: cityRu, l: all };
    npCachePut_(key, JSON.stringify(rich), all.length ? NP_TTL_LONG : NP_TTL_EMPTY, noLong);
    return rich;
  } finally {
    lead.done();
  }
}

/** Поиск отделения по номеру в готовом списке: {ref, num, desc, city, cityRu} или {error:'wh_unknown'} (нет такого или их несколько). */
function npWhFromList_(rich, num, locker) {
  var hits = rich.l.filter(function (x) { return x[0] === num && (x[2] === 'p') === !!locker && NP_UUID_RE.test(String(x[3] || '')); });
  if (hits.length !== 1) return { error: 'wh_unknown' };
  return { ref: String(hits[0][3]), num: String(num), desc: String(hits[0][4] || '').slice(0, 140), city: String(rich.c || '').slice(0, 60), cityRu: String(rich.u || '').slice(0, 60) };
}

/** Старый np.wh по готовому списку (без сети): тип, точный номер первым, потом начало номера, потом текст адреса; не больше 12. */
function npWhLocalSearch_(rich, q, type) {
  var want = type === 'locker' ? 'p' : 'w', low = String(q || '').replace(/^[№#\s]+/, '').trim().toLowerCase(), digits = /^\d+$/.test(low);
  var exact = [], pref = [], rest = [];
  rich.l.forEach(function (x) {
    if (x[2] !== want) return;
    var n = String(x[0]);
    if (!low) rest.push(x);
    else if (digits && n === low) exact.push(x);
    else if (digits && n.indexOf(low) === 0) pref.push(x);
    else if (String(x[4] || x[1]).toLowerCase().indexOf(low) >= 0) rest.push(x);
  });
  return exact.concat(pref, rest).slice(0, 12).map(function (x) { return { n: String(x[4] || x[1]).slice(0, 140), num: String(x[0]) }; });
}

/* ---------- Данные отправителя: повтор неудачной попытки с нарастающей паузой (1 ч → 6 ч → 24 ч) ---------- */

/** {n, next, fp} из NP_SENDER_RETRY или null. */
function npSenderBackoff_() {
  var raw = npProp_('NP_SENDER_RETRY');
  if (!raw) return null;
  try {
    var o = JSON.parse(raw);
    return o && Number(o.n) > 0 ? o : null;
  } catch (err) { return null; }
}

/** Отметить неудачную попытку номер n (1, 2, 3…): следующая не раньше чем через 1 ч, 6 ч, 24 ч (минус 5 минут на разброс часового триггера). */
function npSenderBackoffSet_(n, fp) {
  var delay = NP_SENDER_BACKOFF_MS[Math.min(n, NP_SENDER_BACKOFF_MS.length) - 1];
  try { scriptProps_().setProperty('NP_SENDER_RETRY', JSON.stringify({ n: n, next: Date.now() + delay - 300000, fp: fp })); } catch (err) { /* не критично */ }
}

function npSenderBackoffClear_() {
  if (!npProp_('NP_SENDER_RETRY')) return;
  try { scriptProps_().setProperty('NP_SENDER_RETRY', ''); } catch (err) { /* не критично */ }
}
