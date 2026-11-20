/**
 * PAMIR — этап 9, выпуск Б4.
 *
 * 1. Скорость каталога (action=catalog). Каталог собирается из таблицы долго, а Worker ждёт Apps Script 4,5 с.
 *    Поэтому собранный каталог живёт в CacheService до 6 часов, а не 5 минут, и пересобирается только когда нужно:
 *      - «версия таблицы» = отметка времени последнего изменения cat2_inv. Её ставит clearCatalogCache_ (все пути записи: админ-панель,
 *        пункты меню, заказ с остатками, отзывы, бот) и простой триггер onEdit (ручная правка таблицы). Каталог, собранный раньше
 *        отметки, считается устаревшим и пересобирается ближайшим запросом;
 *      - страховка для правок, которые onEdit не видит (скрипт, импорт, API): не реже чем раз в 5 минут (CATALOG_RECHECK_MIN)
 *        один запрос заново читает листы товаров и настроек и сравнивает результат с сохранённым (отпечаток). Не изменилось — копия
 *        остаётся; изменилось — сохраняется новая. Читать только листы, а не заказы и отзывы: они в отдельном кэше;
 *      - «Популярне», «Хіт тижня», «Разом купують» и оценки (поля n, r, hw, rc, ra) берутся из отдельного кэша сигналов (CATALOG_SIGNALS_MIN,
 *        по умолчанию 30 минут). Цены, наличие, видимость, наборы, «Залишок» в этот кэш не входят и всегда по таблице;
 *      - момент, когда каталог меняется сам по часам (конец акции, «свіжа поставка», конец праздничной темы), запоминается: копия
 *        не живёт дольше этого момента;
 *      - если каталог устарел, а кто-то уже собирает его, покупатель получает прежнюю копию (не дольше минуты после изменения),
 *        остальные ждут до 3 с. Собирает один: метка cat2_bl в кэше, без LockService (заказы и записи блокировок не занимает);
 *      - большой каталог режется на куски по 30 000 знаков (лимит CacheService — 100 КБ на значение) с контрольной меткой:
 *        номер сборки в каждом куске, длина и отпечаток. Битая или неполная копия = пересборка, а не ошибка.
 *    Заказ каталог не пересобирает и в кэш ничего не кладёт: цены и наличие он берёт прямо из таблицы (buildCatalog_({lite})).
 *    Необязательные Script Properties (не секреты): CATALOG_RECHECK_MIN (1–720, по умолчанию 5), CATALOG_SIGNALS_MIN (5–720, 30),
 *    PERF_LOG = 1 (журнал времени этапов сборки; в журнал идут только названия этапов и миллисекунды).
 *
 * 2. Пункты меню «Службове: перевстановити webhook» и «Службове: перевірити webhook». Токен, секрет и адрес Worker берутся только
 *    из Script Properties и нигде не показываются и не пишутся в журнал. Ничего не удаляется: ни deleteWebhook, ни getUpdates.
 */

var CAT2 = 'cat2';
var CAT_HARD_SEC = 21600;                    // потолок CacheService — 6 часов
var CAT_SOFT_DEFAULT_MIN = 5;                // страховка для ручных правок, не замеченных onEdit
var CAT_SIG_DEFAULT_MIN = 30;                // срок кэша сигналов (заказы, отзывы)
var CAT_STALE_MS = 60 * 1000;                // столько после изменения можно отдавать прежнюю копию, пока идёт пересборка
var CAT_WAIT_MS = 3000;                      // сколько ждать чужую сборку
var CAT_WAIT_STEP_MS = 250;
var CAT_BUILD_LOCK_SEC = 60;                 // метка «идёт сборка» живёт не дольше минуты (если сборщик упал)
var CAT_SHEETS = ['Товари', 'Категорії', 'Налаштування', 'Рецепти', 'Синоніми', 'Точки', 'Відгуки', 'Замовлення'];

/* ============================== Кэш каталога ============================== */

/** Отпечаток строки (cyrb53, 53 бита), строкой base36. Для контрольной метки кусков и сравнения «изменился ли каталог». */
function catHash_(str) {
  var imul = Math.imul; // один раз: обращение к глобальному Math внутри цикла дорого
  var h1 = 0xdeadbeef | 0, h2 = 0x41c6ce57 | 0;
  for (var i = 0, ch, n = str.length; i < n; i++) {
    ch = str.charCodeAt(i);
    h1 = imul(h1 ^ ch, 2654435761);
    h2 = imul(h2 ^ ch, 1597334677);
  }
  h1 = imul(h1 ^ (h1 >>> 16), 2246822507) ^ imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = imul(h2 ^ (h2 >>> 16), 2246822507) ^ imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

function catMinutes_(name, def, min, max) {
  var v = NaN;
  try { v = parseInt(scriptProps_().getProperty(name), 10); } catch (err) { v = NaN; }
  if (!(v >= min && v <= max)) v = def;
  return v;
}

/** Отметка «каталог изменился». Вызывается из clearCatalogCache_ и onEdit. Старая копия остаётся до первой пересборки. */
function catalogMarkDirty_() {
  var cache = CacheService.getScriptCache();
  try {
    cache.put(CAT2 + '_inv', String(Date.now()), CAT_HARD_SEC);
  } catch (err) {
    try { cache.remove(CAT2 + '_m'); } catch (e2) { /* кэш недоступен: следующая сборка всё равно возьмёт таблицу */ }
  }
}

/** Кэш сигналов (заказы, отзывы) больше не верен: оценки и «Популярне» будут прочитаны заново при следующей сборке. */
function catalogDropSignals_() {
  try { CacheService.getScriptCache().remove(CAT2 + 's_n'); } catch (err) { /* не критично */ }
}

/**
 * Простой триггер: ручная правка таблицы. Работает без установки; на правки скриптом не срабатывает (их отмечает clearCatalogCache_).
 * Правка листа, который каталога не касается, ничего не сбрасывает.
 */
function onEdit(e) {
  try {
    var name = '';
    try { name = e && e.range ? String(e.range.getSheet().getName()) : ''; } catch (e1) { name = ''; }
    if (name && CAT_SHEETS.indexOf(name) < 0) return;
    if (name === 'Відгуки' || name === 'Замовлення') catalogDropSignals_();
    catalogMarkDirty_();
  } catch (err) { /* простой триггер не должен падать */ }
}

/** Читает кэш каталога: { meta, text, inv, bl, bad }. text есть только у целой, проверенной копии. */
function catRead_(cache) {
  var out = { meta: null, text: null, inv: 0, bl: 0, bad: false };
  var got = {};
  try { got = cache.getAll([CAT2 + '_m', CAT2 + '_inv', CAT2 + '_bl']) || {}; } catch (err) { return out; }
  out.inv = parseInt(got[CAT2 + '_inv'], 10) || 0;
  if (got[CAT2 + '_bl']) out.bl = parseInt(String(got[CAT2 + '_bl']).split(':')[0], 10) || 0;
  if (!got[CAT2 + '_m']) return out;
  var meta = null;
  try { meta = JSON.parse(got[CAT2 + '_m']); } catch (err2) { meta = null; }
  if (!meta || typeof meta.b !== 'string' || !(meta.n > 0) || !(meta.l > 0) || !(meta.x > 0) || !(meta.t > 0) || !(meta.v > 0)) { out.bad = true; return out; }
  var keys = [];
  for (var i = 0; i < meta.n; i++) keys.push(CAT2 + '_' + i);
  var parts;
  try { parts = cache.getAll(keys) || {}; } catch (err3) { return out; }
  var pre = meta.b + '|', pieces = [];
  for (var j = 0; j < keys.length; j++) {
    var v = parts[keys[j]];
    if (typeof v !== 'string' || v.indexOf(pre) !== 0) { out.bad = true; return out; } // кусок другой сборки или пропал
    pieces.push(v.slice(pre.length));
  }
  var text = pieces.join('');
  if (text.length !== meta.l || catHash_(text) !== meta.c) { out.bad = true; return out; }
  out.meta = meta;
  out.text = text;
  return out;
}

/** fresh — отдать; recheck — свежая, но пора проверить таблицу; dirty — таблица менялась; expired — вышел срок; miss — копии нет или она битая. */
function catVerdict_(st, now) {
  var m = st.meta;
  if (!m) return 'miss';
  if (now >= m.x) return 'expired';
  if (st.inv && st.inv >= m.t) return 'dirty';
  if (now - m.v >= (m.s > 0 ? m.s : CAT_SOFT_DEFAULT_MIN * 60000)) return 'recheck';
  return 'fresh';
}

function catBuilding_(st, now) { return st.bl > 0 && now - st.bl < CAT_BUILD_LOCK_SEC * 1000 && st.bl <= now + 5000; }

/** Занять метку «собираю». null — метку успел занять другой запрос. force — занять без проверки (чужая метка протухла). */
function catClaim_(cache, force) {
  var stamp = Date.now() + ':' + Math.floor(Math.random() * 1e9).toString(36);
  try {
    cache.put(CAT2 + '_bl', stamp, CAT_BUILD_LOCK_SEC);
    if (force) return stamp;
    return cache.get(CAT2 + '_bl') === stamp ? stamp : null;
  } catch (err) {
    return stamp; // кэш недоступен: без метки, как раньше
  }
}

function catRelease_(cache, stamp) {
  try {
    if (stamp && cache.get(CAT2 + '_bl') === stamp) cache.remove(CAT2 + '_bl'); // чужую метку не трогаем
  } catch (err) { /* метка сама истечёт за минуту */ }
}

/** Ждёт чужую сборку до CAT_WAIT_MS. Текст готового каталога или null (сборщик не закончил или упал). */
function catWait_(cache) {
  var waited = 0;
  while (waited < CAT_WAIT_MS) {
    Utilities.sleep(CAT_WAIT_STEP_MS);
    waited += CAT_WAIT_STEP_MS;
    var s2 = catRead_(cache);
    var v2 = catVerdict_(s2, Date.now());
    if (v2 === 'fresh' || v2 === 'recheck') return s2.text;
    if (!catBuilding_(s2, Date.now())) return null; // сборщик закончил, но копия не годится (или упал)
  }
  return null;
}

/**
 * Каталог строкой JSON. opts.stale = true (только doGet): покупателю можно отдать прежнюю копию, пока идёт пересборка
 * (не дольше минуты после изменения) и проверять таблицу по расписанию. Внутренним вызовам (opts пустые) устаревшее не отдаётся.
 */
function catalogServe_(opts) {
  opts = opts || {};
  var cache = CacheService.getScriptCache();
  var st = catRead_(cache);
  var now = Date.now();
  var v = catVerdict_(st, now);
  if (v === 'fresh') return st.text;
  var building = catBuilding_(st, now);
  if (v === 'recheck') {
    if (!opts.stale || building) return st.text; // проверку таблицы ведёт запрос витрины или расписание; остальные берут то, что есть
    return catRefresh_(cache, st, opts, 'recheck');
  }
  var staleOk = !!(opts.stale && st.text && v === 'dirty' && now - st.inv < CAT_STALE_MS);
  if (building) {
    if (staleOk) return st.text; // собирает другой запрос; эта копия не старше минуты после изменения
    var waited = catWait_(cache);
    if (waited !== null) return waited;
    st = catRead_(cache); // сборщик не успел: собираем сами
  }
  return catRefresh_(cache, st, opts, v);
}

/** Сборка под меткой. Исключение отдаётся наружу, но у витрины при ошибке остаётся прежняя копия (если она ещё годится по сроку). */
function catRefresh_(cache, st, opts, why) {
  var stamp = catClaim_(cache, false);
  if (!stamp) {
    var w = catWait_(cache);
    if (w !== null) return w;
    stamp = catClaim_(cache, true);
  }
  catPerfStart_(why);
  try {
    return catBuildAndStore_(cache, st, why, false).text;
  } catch (err) {
    if (opts.stale && st && st.text && st.meta && Date.now() < st.meta.x) {
      console.warn('catalog: пересборка не удалась, отдана прежняя копия: ' + safeErr_(err));
      return st.text;
    }
    throw err;
  } finally {
    catRelease_(cache, stamp);
    catPerfEnd_();
  }
}

/**
 * Читает таблицу, собирает каталог и кладёт в кэш. why = 'recheck': если результат тот же, что в копии, копия остаётся (меняется только
 * время проверки). freshSig — сигналы заказов и отзывов читаются заново, кэш сигналов не используется.
 * Возвращает { text, cat, stored }.
 */
function catBuildAndStore_(cache, st, why, freshSig) {
  var t0 = Date.now();
  if (st && st.inv >= t0) t0 = st.inv + 1; // сборка начинается строго после отметки изменения, иначе она считалась бы устаревшей сразу
  var sigIn = freshSig ? null : catSigGet_(cache, t0);
  var sigOut = {};
  var cat = buildCatalog_({ sig: sigIn, sigOut: sigOut });
  var bound = catBoundMs_;
  if (!sigIn && sigOut.o && sigOut.r) catSigPut_(cache, sigOut, t0);
  var text = JSON.stringify(cat);
  var cmp = catHash_(text.replace(/^\{"ok":true,"updated":"[^"]*"/, '{"ok":true,"updated":""'));
  catMark_('JSON');
  var softMs = catMinutes_('CATALOG_RECHECK_MIN', CAT_SOFT_DEFAULT_MIN, 1, 720) * 60000;
  var x = t0 + CAT_HARD_SEC * 1000;
  if (bound > 0 && bound < x) x = bound;
  var m = st && st.meta;
  if (why === 'recheck' && m && m.h === cmp && st.text && Date.now() < m.x) {
    // та же таблица: копия остаётся, продлевается только проверка
    var keep = { b: m.b, t: m.t, v: t0, x: Math.min(m.x, x), n: m.n, l: m.l, c: m.c, h: m.h, s: softMs };
    try { cache.put(CAT2 + '_m', JSON.stringify(keep), Math.max(1, Math.min(CAT_HARD_SEC, Math.floor((keep.x - Date.now()) / 1000)))); } catch (err) { /* не критично */ }
    catMark_('кеш: без змін');
    return { text: st.text, cat: cat, stored: false };
  }
  var b = t0.toString(36) + Math.floor(Math.random() * 1679616).toString(36);
  var n = Math.max(1, Math.ceil(text.length / CACHE_CHUNK));
  var obj = {};
  for (var i = 0; i < n; i++) obj[CAT2 + '_' + i] = b + '|' + text.substr(i * CACHE_CHUNK, CACHE_CHUNK);
  var meta = { b: b, t: t0, v: t0, x: x, n: n, l: text.length, c: catHash_(text), h: cmp, s: softMs };
  var stored = false;
  try {
    cache.putAll(obj, CAT_HARD_SEC); // сначала куски, потом метка: пока метки нет, читатель видит «копии нет»
    cache.put(CAT2 + '_m', JSON.stringify(meta), CAT_HARD_SEC);
    stored = true;
  } catch (err2) {
    console.warn('catalog: кэш не записан: ' + safeErr_(err2));
  }
  catMark_('кеш: запис');
  return { text: text, cat: cat, stored: stored };
}

/** Сигналы заказов и отзывов: свой кэш на CATALOG_SIGNALS_MIN минут. null — нет или устарели. */
function catSigGet_(cache, now) {
  var raw = cacheGetLarge_(CAT2 + 's');
  if (!raw) return null;
  var s;
  try { s = JSON.parse(raw); } catch (err) { return null; }
  if (!s || !(s.t > 0) || !s.o || !s.r || typeof s.o !== 'object' || typeof s.o.n !== 'object' || typeof s.o.r !== 'object' || typeof s.o.w !== 'object' || typeof s.r !== 'object') return null;
  if (now - s.t >= (s.m > 0 ? s.m : CAT_SIG_DEFAULT_MIN * 60000) || s.t > now + 60000) return null;
  return s;
}

function catSigPut_(cache, sigOut, t0) {
  var text = JSON.stringify({ t: t0, m: catMinutes_('CATALOG_SIGNALS_MIN', CAT_SIG_DEFAULT_MIN, 5, 720) * 60000, o: sigOut.o, r: sigOut.r });
  cachePutLarge_(CAT2 + 's', text, CAT_HARD_SEC);
}

/** Пункт меню «Оновити каталог у магазині зараз»: свежая сборка, в том числе заказы и отзывы. Возвращает объект каталога. */
function catalogRebuild_() {
  var cache = CacheService.getScriptCache();
  var st = catRead_(cache);
  var stamp = catClaim_(cache, true);
  catPerfStart_('menu');
  try {
    catalogDropSignals_();
    return catBuildAndStore_(cache, st, 'menu', true).cat;
  } finally {
    catRelease_(cache, stamp);
    catPerfEnd_();
  }
}

/**
 * Расписание (hourlyJob): если каталог устарел, потерян или давно не проверялся — собрать его, чтобы покупатель не ждал.
 * Если сборку уже ведёт кто-то другой — ничего не делает. Возвращает 'fresh' | 'built' | 'busy'.
 */
function catalogWarm_() {
  var cache = CacheService.getScriptCache();
  var st = catRead_(cache);
  var now = Date.now();
  var v = catVerdict_(st, now);
  var sig = catSigGet_(cache, now + 10 * 60000); // сигналы, которым осталось жить меньше 10 минут, обновляем заранее (при сроке 30 — с 20-й минуты)
  if (v === 'fresh' && sig) return 'fresh';
  if (catBuilding_(st, now)) return 'busy';
  var stamp = catClaim_(cache, false);
  if (!stamp) return 'busy';
  catPerfStart_('warm');
  try {
    catBuildAndStore_(cache, st, v === 'fresh' || v === 'recheck' ? 'recheck' : v, !sig);
    return 'built';
  } finally {
    catRelease_(cache, stamp);
    catPerfEnd_();
  }
}

/* ------------------------- необязательный замер (PERF_LOG = 1) ------------------------- */

var catPerf_ = null;
function catPerfStart_(label) { var n = Date.now(); catPerf_ = { label: label, t0: n, last: n, marks: [] }; }
function catPerfMark_(name) {
  if (!catPerf_) return;
  var n = Date.now();
  catPerf_.marks.push(name + ' ' + (n - catPerf_.last));
  catPerf_.last = n;
}
/** В журнал выполнения — только названия этапов и миллисекунды. Без PERF_LOG = 1 ничего не пишется. */
function catPerfEnd_() {
  var p = catPerf_;
  catPerf_ = null;
  if (!p) return;
  try {
    if (scriptProps_().getProperty('PERF_LOG') !== '1') return;
    console.log('PERF catalog ' + p.label + ' ' + (Date.now() - p.t0) + ' ms | ' + p.marks.join(' | '));
  } catch (err) { /* замер не должен ломать сборку */ }
}

/* ======================================================================== */
/* Пункты меню: webhook                                                       */
/* ======================================================================== */

var WH_ALLOWED = ['message', 'callback_query', 'my_chat_member']; // всё, что разбирает handleUpdate_; drop_pending_updates не ставим никогда

function stage9b4Menu_(menu) {
  menu.addSeparator()
    .addItem('Службове: перевстановити webhook', 'menuWebhookReinstall')
    .addItem('Службове: перевірити webhook', 'menuWebhookCheck');
  if (typeof cleanMenu_ === 'function') cleanMenu_(menu); // Stage9b4clean.gs: «Очистити тестові дані перед відкриттям»
  return menu;
}

function whAlert_(text) {
  try { SpreadsheetApp.getUi().alert(text); } catch (err) { /* запуск из редактора */ }
}

/** Текст из ответа Telegram или исключения: без секретов, без управляющих знаков, не длиннее 160. */
function whDesc_(v) {
  var s = '';
  try { s = String(v === null || v === undefined ? '' : v); } catch (err) { s = ''; }
  s = safeErr_(s).replace(/[\u0000-\u001f\u007f]+/g, ' ').trim();
  return s.length > 160 ? s.slice(0, 160) + '…' : s;
}

function whHost_(url) {
  var m = /^https?:\/\/([^\/?#:@\s]+)/i.exec(String(url || ''));
  return m ? m[1].toLowerCase() : '';
}

/** Хост из WORKER_URL, если адрес годится: https, *.workers.dev, без порта кроме 443. Иначе ''. */
function whWorkerHost_(base) {
  var hm = /^https:\/\/([a-z0-9.-]+)(?::443)?(?:\/[^\s?#@]*)?$/i.exec(base);
  var host = hm ? hm[1].toLowerCase() : '';
  if (!host || host.length < 13 || host.slice(-12) !== '.workers.dev' || /\.\.|^\./.test(host)) return '';
  if (/\/purge\/?$/i.test(base)) return '';
  return host;
}

/** Формат secret_token Telegram: 1–256 знаков A-Z a-z 0-9 _ -. Для нас — не короче 32. Возвращает 'ok' | 'empty' | 'short' | 'chars' | 'long'. */
function whSecretState_(secret) {
  var s = secret === null || secret === undefined ? '' : String(secret);
  if (!s) return 'empty';
  if (s.length > 256) return 'long';
  if (!/^[A-Za-z0-9_-]+$/.test(s)) return 'chars';
  if (s.length < 32) return 'short';
  return 'ok';
}

function whInfoLines_(info, lang, expectHost) {
  var ru = lang === 'ru';
  var r = info && info.ok && info.result ? info.result : null;
  if (!r) return [ru ? 'Не удалось получить состояние webhook: ' + whDesc_(info && info.description) : 'Не вдалося отримати стан webhook: ' + whDesc_(info && info.description)];
  var url = String(r.url || '');
  var host = whHost_(url);
  var lines = [];
  lines.push((ru ? 'Webhook установлен: ' : 'Webhook встановлено: ') + (url ? (ru ? 'да' : 'так') : (ru ? 'нет' : 'ні')));
  if (url) lines.push((ru ? 'Адрес (хост): ' : 'Адреса (хост): ') + (host || '?') + (expectHost ? (host === expectHost ? (ru ? ' — совпадает с WORKER_URL' : ' — збігається з WORKER_URL') : (ru ? ' — НЕ совпадает с WORKER_URL' : ' — НЕ збігається з WORKER_URL')) : ''));
  lines.push((ru ? 'Ждут доставки (pending_update_count): ' : 'Очікують доставки (pending_update_count): ') + (Number(r.pending_update_count) || 0));
  if (r.last_error_message) {
    var when = '';
    if (Number(r.last_error_date) > 0) { try { when = ' (' + Utilities.formatDate(new Date(Number(r.last_error_date) * 1000), 'Europe/Kiev', 'dd.MM.yyyy HH:mm') + ')'; } catch (err) { when = ''; } }
    lines.push((ru ? 'Последняя ошибка: ' : 'Остання помилка: ') + whDesc_(r.last_error_message) + when);
  } else {
    lines.push(ru ? 'Ошибок доставки нет' : 'Помилок доставки немає');
  }
  return lines;
}

/** Пункт меню «Службове: перевірити webhook»: только getWebhookInfo, ничего не меняет. */
function webhookCheck_() {
  var props = scriptProps_();
  var token = props.getProperty('BOT_TOKEN');
  if (!token) return { ok: false, message: 'Не задано BOT_TOKEN у властивостях скрипта. Нічого не зроблено.\n\nНе задан BOT_TOKEN в свойствах скрипта. Ничего не сделано.' };
  var base = String(props.getProperty('WORKER_URL') || '').trim().replace(/\/+$/, '');
  var host = base ? whWorkerHost_(base) : '';
  var info = tg_(token, 'getWebhookInfo', {});
  var sec = whSecretState_(props.getProperty('WEBHOOK_SECRET'));
  var secUa = sec === 'ok' ? 'задано, формат підходить' : (sec === 'empty' ? 'НЕ задано' : 'задано, але формат не підходить для Telegram');
  var secRu = sec === 'ok' ? 'задан, формат подходит' : (sec === 'empty' ? 'НЕ задан' : 'задан, но формат не подходит для Telegram');
  var wUa = host ? 'WORKER_URL: задано (' + host + ')' : (base ? 'WORKER_URL: задано, але не підходить (потрібен https і *.workers.dev)' : 'WORKER_URL: не задано');
  var wRu = host ? 'WORKER_URL: задан (' + host + ')' : (base ? 'WORKER_URL: задан, но не подходит (нужен https и *.workers.dev)' : 'WORKER_URL: не задан');
  var ua = whInfoLines_(info, 'ua', host).concat(['WEBHOOK_SECRET: ' + secUa, wUa, 'Значення секрету й токена на екран не виводяться.']);
  var ru = whInfoLines_(info, 'ru', host).concat(['WEBHOOK_SECRET: ' + secRu, wRu, 'Значения секрета и токена на экран не выводятся.']);
  return { ok: !!(info && info.ok), message: ua.join('\n') + '\n\n' + ru.join('\n'), info: info && info.ok ? { url: !!(info.result && info.result.url), pending: Number(info.result && info.result.pending_update_count) || 0 } : null };
}

function menuWebhookCheck() {
  var r = webhookCheck_();
  console.log('webhook: перевірка ' + (r.ok ? 'виконана' : 'не вдалася'));
  whAlert_(r.message);
  return r;
}

/**
 * Пункт меню «Службове: перевстановити webhook»: setWebhook (адрес Worker из WORKER_URL, secret_token из WEBHOOK_SECRET) и затем
 * getWebhookInfo. Ничего не удаляет: нет deleteWebhook, нет drop_pending_updates, нет getUpdates. Без WORKER_URL, токена, секрета
 * подходящего формата или без подтверждения — отказ без единого сетевого вызова.
 */
function webhookReinstall_() {
  var props = scriptProps_();
  var token = props.getProperty('BOT_TOKEN');
  var secret = props.getProperty('WEBHOOK_SECRET');
  var base = String(props.getProperty('WORKER_URL') || '').trim().replace(/\/+$/, '');
  var missing = [];
  if (!token) missing.push('BOT_TOKEN');
  if (!secret) missing.push('WEBHOOK_SECRET');
  if (!base) missing.push('WORKER_URL');
  var noUa = ' Нічого не зроблено, webhook не змінено.';
  var noRu = ' Ничего не сделано, webhook не изменён.';
  if (missing.length) {
    return { ok: false, refused: 'missing', message: 'Не задано у властивостях скрипта: ' + missing.join(', ') + '.' + noUa + '\n\nНе задано в свойствах скрипта: ' + missing.join(', ') + '.' + noRu };
  }
  var host = whWorkerHost_(base);
  if (!host) {
    return { ok: false, refused: 'worker', message: 'WORKER_URL не підходить: потрібна адреса https://<ім\'я>.workers.dev без параметрів.' + noUa + '\n\nWORKER_URL не подходит: нужен адрес https://<имя>.workers.dev без параметров.' + noRu };
  }
  var sec = whSecretState_(secret);
  if (sec !== 'ok') {
    var whyUa = sec === 'short' ? 'закороткий (потрібно не менше 32 знаків)' : (sec === 'long' ? 'задовгий (не більше 256 знаків)' : 'містить недозволені знаки (дозволено лише A-Z a-z 0-9 _ -)');
    var whyRu = sec === 'short' ? 'слишком короткий (нужно не меньше 32 знаков)' : (sec === 'long' ? 'слишком длинный (не больше 256 знаков)' : 'содержит недопустимые знаки (разрешено только A-Z a-z 0-9 _ -)');
    return { ok: false, refused: 'secret', message: 'WEBHOOK_SECRET ' + whyUa + '. Значення не показую.' + noUa + '\n\nWEBHOOK_SECRET ' + whyRu + '. Значение не показываю.' + noRu };
  }
  if (props.getProperty('USE_WEBHOOK') !== 'true') {
    return { ok: false, refused: 'mode', message: 'USE_WEBHOOK не дорівнює true: бот працює через опитування, webhook зараз вмикати не можна.' + noUa + '\n\nUSE_WEBHOOK не равно true: бот работает через опрос, webhook сейчас включать нельзя.' + noRu };
  }
  var ui;
  try { ui = SpreadsheetApp.getUi(); } catch (err) { ui = null; }
  if (!ui) {
    return { ok: false, refused: 'noui', message: 'Запустіть цей пункт із меню таблиці PAMIR: потрібне підтвердження.' + noUa + '\n\nЗапустите этот пункт из меню таблицы PAMIR: нужно подтверждение.' + noRu };
  }
  var ask = 'Перевстановити webhook?\n\nБуде викликано Telegram setWebhook:\n• адреса: ' + host + '\n• secret_token: значення WEBHOOK_SECRET із властивостей скрипта (на екран не виводиться)\n• типи подій: ' + WH_ALLOWED.join(', ') +
    '\n• непрочитані повідомлення НЕ видаляються\n\nЗамінюючи секрет, спочатку змініть його в Cloudflare та у властивостях скрипта (docs/KEYS_ROTATION.md).' +
    '\n\nПереустановить webhook?\n\nБудет вызван Telegram setWebhook: адрес ' + host + ', secret_token — значение WEBHOOK_SECRET из свойств скрипта (на экран не выводится), типы событий: ' + WH_ALLOWED.join(', ') +
    '. Непрочитанные сообщения НЕ удаляются. При замене секрета сначала измените его в Cloudflare и в свойствах скрипта (docs/KEYS_ROTATION.md).';
  var answer;
  try { answer = ui.alert('PAMIR', ask, ui.ButtonSet.YES_NO); } catch (err2) { answer = null; }
  if (answer !== ui.Button.YES) {
    return { ok: false, refused: 'cancel', message: 'Скасовано.' + noUa + '\n\nОтменено.' + noRu };
  }
  var res = tg_(token, 'setWebhook', { url: base, secret_token: secret, allowed_updates: WH_ALLOWED });
  var info = tg_(token, 'getWebhookInfo', {});
  var okSet = !!(res && res.ok === true);
  var headUa = okSet ? 'setWebhook виконано.' : 'setWebhook НЕ вдалося: ' + whDesc_(res && res.description) + '. Бот може мовчати: перевірте значення і повторіть.';
  var headRu = okSet ? 'setWebhook выполнен.' : 'setWebhook НЕ удался: ' + whDesc_(res && res.description) + '. Бот может молчать: проверьте значения и повторите.';
  console.log('webhook: setWebhook ' + (okSet ? 'виконано' : 'не вдалося'));
  return { ok: okSet, message: headUa + '\n' + whInfoLines_(info, 'ua', host).join('\n') + '\n\n' + headRu + '\n' + whInfoLines_(info, 'ru', host).join('\n'), info: info && info.ok ? { url: !!(info.result && info.result.url), pending: Number(info.result && info.result.pending_update_count) || 0 } : null };
}

function menuWebhookReinstall() {
  var r = webhookReinstall_();
  whAlert_(r.message);
  return r;
}
