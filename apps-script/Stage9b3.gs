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
 *      целиком при каждом запросе). Лист создаётся лениво, только когда есть NP_API_KEY и есть что записать; запись — под
 *      LockService (tryLock: занято — в долгий слой не пишем, ответ и заказы это не задерживает); чтение — без блокировки.
 *      В листе только публичные справочные данные НП (города, отделения, тарифы): ни ключа, ни телефонов, ни Ref-ов отправителя.
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
var NP_CACHE_MAX_PARTS = 24;       // значение больше этого в лист не пишем (быстрый слой всё равно держит его 6 часов)
var NP_CACHE_MAX_ROWS = 400;       // строк в листе не больше: старые записи вытесняются
var NP_CACHE_LOCK_MS = 1500;
var NP_SENDER_BACKOFF_MS = [3600000, 6 * 3600000, 24 * 3600000]; // 1 ч → 6 ч → 24 ч между неудачными попытками отправителя

/* ---------- Пауза при «To many requests» ---------- */

/** Ответ НП — «лимит запросов»: HTTP 429, фраза «To many requests»/«Too many requests» или код 20000401501. */
function npLimitHit_(code, data) {
  if (Number(code) === 429) return true;
  if (!data || typeof data !== 'object' || data.success === true) return false;
  var s;
  try { s = [].concat(data.errors || [], data.errorCodes || []).map(function (x) { return String(x); }).join(' '); } catch (err) { return false; }
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

/** Ставит паузу на 10 минут. Уже идёт — не продлевает. Запись свойства — без блокировки (одно атомарное обращение). */
function npPauseSet_() {
  if (npPauseUntil_()) return;
  var until = Date.now() + NP_PAUSE_MS;
  try { CacheService.getScriptCache().put(NP_PAUSE_KEY, String(until), Math.ceil(NP_PAUSE_MS / 1000)); } catch (e1) { /* не критично */ }
  try { scriptProps_().setProperty(NP_PAUSE_PROP, String(until)); } catch (e2) { console.warn('np pause: property not saved'); }
}

/** Тревога админам о лимите: не чаще раза в сутки (общая отметка NP_ALERT_LAST), без ключа и данных отправителя. */
function npLimitAlert_() {
  if (typeof npAlertAdmins_ !== 'function') return;
  var n = npPauseMin_();
  npAlertAdmins_(
    'Нова пошта тимчасово обмежила запити (занадто багато звернень). Підказки міст і відділень та розрахунок вартості доставки призупинено приблизно на ' + n +
      ' хв, потім усе відновиться саме. Замовлення приймаються, покупці вводять місто й відділення вручну.',
    'Новая почта временно ограничила запросы (слишком много обращений). Подсказки городов и отделений и расчёт стоимости доставки приостановлены примерно на ' + n +
      ' мин, потом всё возобновится само. Заказы принимаются, покупатели вводят город и отделение вручную.');
}

/** Добавляет к ответу витрине необязательное поле retryAfter (секунды), если запрос не ушёл из-за паузы. */
function npRetry_(out, eo) {
  if (eo && eo.paused === true && eo.retryAfter > 0) out.retryAfter = eo.retryAfter;
  return out;
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

/** {text, exp} или null. Без блокировки: запись всегда целиком одним блоком строк, недописанное не читается (проверка частей). */
function npLongGet_(key) {
  try {
    var sh = npLongSheet_(false);
    if (!sh) return null;
    var last = sh.getLastRow();
    if (last < 2) return null;
    var idx = sh.getRange(2, 1, last - 1, 5).getValues(), now = Date.now(), parts = {}, total = 0, exp = 0, found = 0;
    for (var i = 0; i < idx.length; i++) {
      if (String(idx[i][0]) !== key) continue;
      if (!(Number(idx[i][3]) > now)) return null;
      var p = Number(idx[i][1]);
      if (!parts[p]) found++;
      parts[p] = i + 2; total = Number(idx[i][2]); exp = Number(idx[i][3]);
    }
    if (!found || found !== total) return null;
    var text = '';
    for (var k = 0; k < total; k++) {
      if (!parts[k]) return null;
      var cell = String(sh.getRange(parts[k], 6).getValues()[0][0]);
      if (cell.indexOf('n:') !== 0) return null;
      text += cell.slice(2);
    }
    return { text: text, exp: exp };
  } catch (err) { return null; }
}

/**
 * Запись в долгий слой под LockService.tryLock: занято — просто не пишем (false). Заменяет прежнюю запись этого ключа, убирает просроченные
 * строки, держит размер листа не больше NP_CACHE_MAX_ROWS (вытесняются самые старые ключи). Данные режутся на ячейки по NP_CELL знаков
 * с префиксом «n:» (чтобы Таблицы не приняли кусок за число, дату или формулу).
 */
function npLongPut_(key, text, ttlSec) {
  if (!npKey_()) return false;
  var chunks = [];
  for (var c = 0; c < text.length; c += NP_CELL) chunks.push(text.substr(c, NP_CELL));
  if (!chunks.length || chunks.length > NP_CACHE_MAX_PARTS) return false;
  var lock = LockService.getScriptLock(), got = false;
  try { got = lock.tryLock(NP_CACHE_LOCK_MS); } catch (e0) { got = false; }
  if (!got) return false;
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
    var exp = now + Math.floor(ttlSec) * 1000;
    sh.getRange(start, 1, chunks.length, NP_CACHE_HEAD.length).setValues(chunks.map(function (t, n) { return [key, n, chunks.length, exp, now, 'n:' + t]; }));
    SpreadsheetApp.flush();
    return true;
  } catch (err) {
    console.warn('np cache write failed');
    return false;
  } finally {
    try { lock.releaseLock(); } catch (e1) { /* не критично */ }
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

/** Кладёт значение в кэш: всегда в быстрый слой, а если срок больше 6 часов — ещё и в долгий. */
function npCachePut_(key, text, ttlSec) {
  npFastPut_(key, text, ttlSec);
  if (ttlSec > NP_FAST_MAX) npLongPut_(key, text, ttlSec);
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
 * eo — причина отказа (paused, retryAfter, text, api). Возвращает список или null.
 */
function npWhLoad_(cityRef, admin, eo) {
  var have = npWhPeek_(cityRef);
  if (have) return have;
  var key = npWhKey_(cityRef), lead = npLead_(key, 24, function () { return npCacheGet_(key, true); });
  if (lead.value !== undefined) { have = npWhPeek_(cityRef); if (have) return have; }
  if (!lead.lead) return null; // занято: чужая загрузка идёт, дубль не шлём
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
    npCachePut_(key, JSON.stringify(rich), all.length ? NP_TTL_LONG : NP_TTL_EMPTY);
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
