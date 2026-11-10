/**
 * PAMIR — бэкенд магазина (Google Apps Script, привязан к таблице «PAMIR — Товари»).
 *
 * ЭТАП 1: каталог.
 *   doGet(?action=catalog) → JSON с категориями и товарами.
 *   Клиенту уходят ТОЛЬКО поля из белого списка PRODUCT_COLS (колонки A–Q).
 *   Служебные колонки (конкурент, закупка, маржа, наценка, источник) не читаются вообще.
 *
 * ЭТАП 3 (в конце файла): заказы и бот.
 *   doPost({action:'order', ...}) → проверка подписи Telegram, пересчёт цен, запись в «Замовлення»,
 *   сообщение админам с кнопками. pollUpdates() раз в минуту забирает нажатия кнопок и сообщения боту.
 *
 * ЭТАП 4 (в конце файла): setup() — кнопка меню «Магазин», команды и описание бота.
 * ЭТАП 5 (в конце файла): админ-панель — заказы, товары (правка, добавление, фото), категории,
 *   настройки магазина (лист «Налаштування»).
 *
 * Секретов в этом файле нет. Токен бота хранится только в Script Properties.
 */

var SHEET_PRODUCTS = 'Товари';
var SHEET_CATEGORIES = 'Категорії';
var CACHE_TTL_SEC = 300;          // 5 минут
var CACHE_KEY = 'catalog_v1';
var CACHE_CHUNK = 30000;          // символов в одном куске кэша (лимит CacheService — 100 КБ на значение)

/**
 * Белый список колонок листа «Товари».
 * Ключ — имя поля, значение — начало заголовка (в нижнем регистре).
 * Колонки ищутся по названию заголовка, а не по номеру: можно добавлять и двигать колонки.
 */
var PRODUCT_COLS = {
  id:      ['id'],
  catUa:   ['категорія (ua)'],
  catRu:   ['категория (ru)'],
  nameUa:  ['назва (ua)'],
  nameRu:  ['название (ru)'],
  type:    ['тип'],
  packs:   ['фасування'],
  pKg:     ['ціна за 1 кг'],
  pUnit:   ['ціна за упаковку'],
  stock:   ['наявність'],
  photo:   ['фото'],
  descUa:  ['опис (ua)'],
  descRu:  ['описание (ru)'],
  whPrice: ['опт: ціна', 'опт ціна'],
  whMin:   ['опт: мін', 'опт мін'],
  p100:    ['ціна за 100 г'],
  hidden:  ['приховати', 'прихован']
};

var CATEGORY_COLS = {
  code:  ['код'],
  ua:    ['категорія (ua)'],
  ru:    ['категория (ru)'],
  icon:  ['іконка'],
  order: ['порядок']
};

var SHOP_DEFAULTS = {
  PICKUP_ADDRESS_UA: 'Центральний ринок (будівля критого ринку), Харків, вул. Різдвяна, 33 (метро «Центральний ринок»)',
  PICKUP_ADDRESS_RU: 'Центральный рынок (здание крытого рынка), Харьков, ул. Рождественская, 33 (метро «Центральный рынок»)',
  PICKUP_HOURS_UA: 'Вівторок–неділя, 8:00–16:00. Понеділок — санітарний день',
  PICKUP_HOURS_RU: 'Вторник–воскресенье, 8:00–16:00. Понедельник — санитарный день'
};

/* ============================== Веб-приложение ============================== */

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || '';
  try {
    if (action === 'catalog') {
      return jsonText_(getCatalogJson_());
    }
    return jsonText_(JSON.stringify({ ok: true, service: 'PAMIR' }));
  } catch (err) {
    console.error('doGet: ' + (err && err.stack || err));
    return jsonText_(JSON.stringify({ ok: false, error: 'server_error' }));
  }
}

function jsonText_(text) {
  return ContentService.createTextOutput(text).setMimeType(ContentService.MimeType.JSON);
}

/* ================================= Каталог ================================= */

/** Каталог строкой JSON: из кэша или заново из таблицы. */
function getCatalogJson_() {
  var cached = cacheGetLarge_(CACHE_KEY);
  if (cached) return cached;
  var json = JSON.stringify(buildCatalog_());
  cachePutLarge_(CACHE_KEY, json);
  return json;
}

/** Читает таблицу и собирает объект каталога. */
function buildCatalog_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var categories = readCategories_(ss);
  var products = readProducts_(ss, categories);

  var used = {};
  products.forEach(function (p) { used[p.c] = true; });
  categories = categories.filter(function (c) { return used[c.code]; });

  return {
    ok: true,
    updated: new Date().toISOString(),
    shop: readShop_(),
    categories: categories,
    products: products
  };
}

/** Настройки магазина для витрины: адрес, часы, способы оплаты, минимальная сумма, объявление. */
function readShop_() {
  var st = readSettings_();
  var shop = {
    address: { ua: st.address_ua, ru: st.address_ru },
    hours:   { ua: st.hours_ua,   ru: st.hours_ru },
    pay: ['cash', 'card', 'cod'].filter(function (k) { return isYes_(st['pay_' + k]); }),
    min: Math.max(0, Math.round(toNum_(st.min_order)))
  };
  if (st.notice_ua || st.notice_ru) shop.notice = { ua: st.notice_ua || st.notice_ru, ru: st.notice_ru || st.notice_ua };
  return shop;
}

function readCategories_(ss) {
  var sheet = ss.getSheetByName(SHEET_CATEGORIES);
  if (!sheet) return [];
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  var col = mapHeaders_(values[0], CATEGORY_COLS);
  var list = [];
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    var code = cell_(row, col.code);
    var ua = cell_(row, col.ua);
    if (!code || !ua) continue;
    list.push({
      code: code,
      ua: ua,
      ru: cell_(row, col.ru) || ua,
      icon: cell_(row, col.icon).toLowerCase(),
      _order: toNum_(col.order >= 0 ? row[col.order] : 0) || 999
    });
  }
  list.sort(function (a, b) { return a._order - b._order; });
  list.forEach(function (c) { delete c._order; });
  return list;
}

function readProducts_(ss, categories) {
  var sheet = ss.getSheetByName(SHEET_PRODUCTS);
  if (!sheet) throw new Error('Не найден лист «' + SHEET_PRODUCTS + '»');
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  var col = mapHeaders_(values[0], PRODUCT_COLS);
  ['id', 'nameUa', 'type', 'stock'].forEach(function (k) {
    if (col[k] < 0) throw new Error('В листе «Товари» не найдена колонка: ' + PRODUCT_COLS[k][0]);
  });

  var catByName = {};
  var catByCode = {};
  categories.forEach(function (c) {
    catByName[c.ua.toLowerCase()] = c.code;
    catByName[c.ru.toLowerCase()] = c.code;
    catByCode[c.code] = true;
  });

  var products = [];
  var seen = {};
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    var id = cell_(row, col.id);
    var nameUa = cell_(row, col.nameUa);
    if (!id || !nameUa || seen[id]) continue;
    seen[id] = true;
    if (isYes_(cell_(row, col.hidden))) continue; // скрыт с витрины, строка остаётся в таблице

    // Категория: по названию, иначе по префиксу ID (NUT-001 → NUT), иначе создаём на лету.
    var catUa = cell_(row, col.catUa);
    var catRu = cell_(row, col.catRu);
    var code = catByName[catUa.toLowerCase()] || catByName[catRu.toLowerCase()];
    if (!code) {
      var prefix = id.split('-')[0];
      if (catByCode[prefix]) {
        code = prefix;
      } else {
        code = catUa || prefix;
        if (!catByCode[code]) {
          categories.push({ code: code, ua: catUa || code, ru: catRu || catUa || code, icon: '' });
          catByCode[code] = true;
          if (catUa) catByName[catUa.toLowerCase()] = code;
        }
      }
    }

    var p = { id: id, c: code, ua: nameUa };
    var nameRu = cell_(row, col.nameRu);
    if (nameRu && nameRu !== nameUa) p.ru = nameRu;

    var inStock = isInStock_(cell_(row, col.stock));
    var price = priceInfo_(
      cell_(row, col.type),
      cell_(row, col.packs),
      col.pKg >= 0 ? row[col.pKg] : '',
      col.pUnit >= 0 ? row[col.pUnit] : ''
    );
    p.t = price.t;
    if (price.t === 'w') {
      p.k = price.k;
      p.v = price.v;
    } else {
      p.p = price.p;
      if (price.pk) p.pk = price.pk;
    }
    p.a = inStock && price.ok ? 1 : 0;

    var img = normalizePhoto_(cell_(row, col.photo));
    if (img) p.img = img;
    var dUa = cell_(row, col.descUa);
    var dRu = cell_(row, col.descRu);
    if (dUa) p.dUa = dUa;
    if (dRu) p.dRu = dRu;

    var wh = toNum_(col.whPrice >= 0 ? row[col.whPrice] : '');
    if (wh > 0) {
      p.w = wh;
      var whMin = cell_(row, col.whMin);
      if (whMin) p.wm = whMin;
    }
    products.push(p);
  }
  return products;
}

/* ============================ Цены и фасовки ============================ */

/**
 * Единственное место, где считаются цены. Этим же кодом сервер будет
 * пересчитывать заказ (этап 3), поэтому витрина и сервер всегда совпадают.
 *
 *   вагова:        v = [[граммы, цена], ...], цена = round(цена_за_кг × граммы / 1000)
 *   упаковка / шт: p = цена за штуку, pk = подпись фасовки («500 г»)
 */
function priceInfo_(typeRaw, packsRaw, pKgRaw, pUnitRaw) {
  var type = String(typeRaw || '').trim().toLowerCase();
  if (type.indexOf('ваг') === 0) {
    var k = toNum_(pKgRaw);
    var grams = parsePacks_(packsRaw);
    var v = [];
    if (k > 0) {
      grams.forEach(function (g) { v.push([g, weightPrice_(k, g)]); });
    }
    return { t: 'w', k: k, v: v, ok: v.length > 0 };
  }
  var p = Math.round(toNum_(pUnitRaw));
  return {
    t: type.indexOf('шт') === 0 ? 'u' : 'p',
    p: p,
    pk: String(packsRaw || '').split('/')[0].trim(),
    ok: p > 0
  };
}

function weightPrice_(pricePerKg, grams) {
  return Math.round(pricePerKg * grams / 1000);
}

/** «100 г / 250 г / 500 г / 1 кг» → [100, 250, 500, 1000] */
function parsePacks_(text) {
  var out = [];
  String(text || '').split('/').forEach(function (part) {
    var m = part.replace(/ /g, ' ').match(/([\d.,]+)\s*(кг|kg|г|g)/i);
    if (!m) return;
    var n = parseFloat(m[1].replace(',', '.'));
    if (!(n > 0)) return;
    var unit = m[2].toLowerCase();
    var g = Math.round(unit === 'кг' || unit === 'kg' ? n * 1000 : n);
    if (g > 0 && out.indexOf(g) < 0) out.push(g);
  });
  out.sort(function (a, b) { return a - b; });
  return out;
}

function isInStock_(value) {
  var s = String(value || '').trim().toLowerCase();
  return s === 'є' || s === 'e' || s === 'есть' || s === 'так' || s === 'да';
}

/* ================================ Утилиты ================================ */

/** Заголовки → номера колонок. Сначала точное совпадение, потом по началу заголовка. */
function mapHeaders_(headerRow, spec) {
  var headers = headerRow.map(function (h) {
    return String(h || '').replace(/\s+/g, ' ').trim().toLowerCase();
  });
  var map = {};
  Object.keys(spec).forEach(function (key) {
    var idx = -1;
    spec[key].forEach(function (name) {
      if (idx < 0) idx = headers.indexOf(name);
    });
    spec[key].forEach(function (name) {
      if (idx >= 0) return;
      for (var i = 0; i < headers.length; i++) {
        if (headers[i].indexOf(name) === 0) { idx = i; break; }
      }
    });
    map[key] = idx;
  });
  return map;
}

function cell_(row, idx) {
  if (idx < 0 || idx >= row.length) return '';
  var v = row[idx];
  return v === null || v === undefined ? '' : String(v).trim();
}

/** 1420, «1 420», «0,5», «38 ₴» → число; пусто или мусор → 0 */
function toNum_(v) {
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  var s = String(v === null || v === undefined ? '' : v)
    .replace(/[\s  ]/g, '').replace(',', '.').replace(/[^\d.\-]/g, '');
  var n = parseFloat(s);
  return isFinite(n) ? n : 0;
}

/** Ссылку Google Drive превращает в прямую ссылку на картинку. Только https. */
function normalizePhoto_(url) {
  url = String(url || '').trim();
  if (!/^https:\/\//i.test(url)) return '';
  var m = url.match(/drive\.google\.com\/file\/d\/([\w-]+)/) ||
          url.match(/drive\.google\.com\/(?:open|uc|thumbnail)\?(?:[^#]*&)?id=([\w-]+)/);
  if (m) return 'https://drive.google.com/thumbnail?id=' + m[1] + '&sz=w800';
  return url;
}

/* Кэш: каталог больше лимита одного значения, поэтому режем на куски. */
function cachePutLarge_(key, text) {
  try {
    var n = Math.ceil(text.length / CACHE_CHUNK);
    var obj = {};
    for (var i = 0; i < n; i++) obj[key + '_' + i] = text.substr(i * CACHE_CHUNK, CACHE_CHUNK);
    obj[key + '_n'] = String(n);
    CacheService.getScriptCache().putAll(obj, CACHE_TTL_SEC);
  } catch (err) {
    console.warn('cache put: ' + err);
  }
}

function cacheGetLarge_(key) {
  try {
    var cache = CacheService.getScriptCache();
    var n = parseInt(cache.get(key + '_n'), 10);
    if (!(n > 0)) return null;
    var keys = [];
    for (var i = 0; i < n; i++) keys.push(key + '_' + i);
    var got = cache.getAll(keys);
    var parts = [];
    for (var j = 0; j < n; j++) {
      if (typeof got[keys[j]] !== 'string') return null;
      parts.push(got[keys[j]]);
    }
    return parts.join('');
  } catch (err) {
    return null;
  }
}

function clearCatalogCache_() {
  CacheService.getScriptCache().remove(CACHE_KEY + '_n');
}

/* ====================== Меню в таблице (для удобства) ====================== */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('PAMIR')
    .addItem('Оновити каталог у магазині зараз', 'menuRefreshCatalog')
    .addItem('Перевірити каталог', 'menuCheckCatalog')
    .addToUi();
}

/** Сбрасывает кэш: изменения в таблице видны в магазине сразу, а не через 5 минут. */
function menuRefreshCatalog() {
  clearCatalogCache_();
  var cat = buildCatalog_();
  cachePutLarge_(CACHE_KEY, JSON.stringify(cat));
  SpreadsheetApp.getUi().alert('Каталог оновлено: ' + cat.products.length + ' товарів.');
}

/** Показывает, сколько товаров увидит клиент и у каких товаров нет цены. */
function menuCheckCatalog() {
  SpreadsheetApp.getUi().alert(checkCatalogText_());
}

function checkCatalogText_() {
  var cat = buildCatalog_();
  var available = 0;
  var noPrice = [];
  cat.products.forEach(function (p) {
    if (p.a) available++;
    var hasPrice = p.t === 'w' ? p.v.length > 0 : p.p > 0;
    if (!hasPrice) noPrice.push(p.id);
  });
  var lines = [
    'Товарів у каталозі: ' + cat.products.length,
    'Можна замовити: ' + available,
    'Сірі (немає або без ціни): ' + (cat.products.length - available),
    'Категорій: ' + cat.categories.length
  ];
  if (noPrice.length) {
    lines.push('');
    lines.push('Без ціни або фасування: ' + noPrice.slice(0, 30).join(', ') + (noPrice.length > 30 ? ' …' : ''));
  }
  return lines.join('\n');
}

/** Запустить из редактора Apps Script, чтобы проверить каталог без браузера. */
function testCatalog() {
  clearCatalogCache_();
  var json = getCatalogJson_();
  console.log(checkCatalogText_());
  console.log('Размер ответа: ' + Math.round(json.length / 1024) + ' КБ');
  console.log('Первый товар: ' + JSON.stringify(JSON.parse(json).products[0]));
}

/* ======================================================================== */
/* ЭТАП 3: заказы, уведомления админам, бот (polling)                         */
/* ======================================================================== */
/*
 * Script Properties (Настройки проекта → Свойства скрипта):
 *   BOT_TOKEN          токен бота от BotFather (только здесь, не в коде)
 *   ADMIN_CHAT_IDS     числовые chat id админов через запятую (узнать: команда /id у бота)
 *   WEBAPP_URL         адрес витрины, напр. https://vorfl.github.io/pamir-shop/webapp/
 *   ALLOW_TEST_ORDERS  1 — принимать тестовые заказы из браузера (?debug=1). Перед запуском удалить.
 */

var SHEET_ORDERS = 'Замовлення';
var ORDER_HEADERS = ['№', 'Дата/час', 'Статус', 'Telegram user id', '@username', 'Ім\'я', 'Телефон',
  'Доставка', 'Місто', 'Відділення НП', 'Оплата', 'Коментар', 'Товари', 'Сума, ₴', 'Мова', 'Джерело', 'Службове'];
var ORDER_COLS = {
  num: ['№'], date: ['дата'], status: ['статус'], uid: ['telegram user id'], username: ['@username'],
  name: ['ім\'я', 'ім’я'], phone: ['телефон'], delivery: ['доставка'], city: ['місто'], branch: ['відділення'],
  pay: ['оплата'], comment: ['коментар'], items: ['товари'], total: ['сума'], lang: ['мова'],
  source: ['джерело'], svc: ['службове']
};
var STATUS_NEW = 'новий';
var STATUS_BY_CODE = { c: 'підтверджено', n: 'немає в наявності', s: 'відправлено', d: 'виконано' };
var PAY_UA = { cash: 'при отриманні', card: 'переказ на картку', cod: 'накладений платіж' };
var MAX_ORDERS_PER_HOUR = 5;
var MAX_TEST_ORDERS_PER_HOUR = 20;
var INIT_DATA_MAX_AGE_SEC = 24 * 3600;

function doPost(e) {
  var out;
  try {
    var text = (e && e.postData && e.postData.contents) || '';
    if (text.length > 1500000) throw new Error('body too large');
    var body = JSON.parse(text || '{}');
    if (body.action !== 'admin.photo' && text.length > 20000) throw new Error('body too large');
    if (body.action === 'order') out = handleOrder_(body);
    else if (String(body.action).indexOf('admin.') === 0) out = handleAdmin_(body);
    else out = { ok: false, error: 'unknown_action' };
  } catch (err) {
    console.error('doPost: ' + (err && err.stack || err));
    out = { ok: false, error: 'server_error' };
  }
  return jsonText_(JSON.stringify(out));
}

/* ------------------------------ Приём заказа ------------------------------ */

function handleOrder_(body) {
  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty('BOT_TOKEN');
  if (!token) return { ok: false, error: 'not_configured' };

  // 1. Кто заказывает: подпись Telegram или (если разрешено) тестовый заказ из браузера.
  var user = null;
  var isTest = false;
  if (body.initData) {
    user = verifyInitData_(String(body.initData), token);
    if (!user) return { ok: false, error: 'bad_auth' };
    isTest = body.test === true;
  } else {
    if (props.getProperty('ALLOW_TEST_ORDERS') !== '1') return { ok: false, error: body.test === true ? 'test_off' : 'bad_auth' };
    isTest = true;
  }

  // 2. Поля формы.
  var o = {
    name: clean_(body.name, 60),
    phone: String(body.phone || '').replace(/[^\d+]/g, '').slice(0, 16),
    delivery: body.delivery === 'np' ? 'np' : 'pickup',
    city: clean_(body.city, 60),
    branch: clean_(body.branch, 30),
    pay: PAY_UA[body.pay] ? String(body.pay) : 'cash',
    comment: clean_(body.comment, 300),
    lang: body.lang === 'ru' ? 'ru' : 'ua'
  };
  if (o.delivery === 'pickup') { o.city = ''; o.branch = ''; if (o.pay === 'cod') o.pay = 'cash'; }
  if (o.name.length < 2 || !/^\+\d{10,15}$/.test(o.phone) ||
      (o.delivery === 'np' && (o.city.length < 2 || !o.branch))) {
    return { ok: false, error: 'bad_form' };
  }
  if (!Array.isArray(body.items) || !body.items.length || body.items.length > 50) return { ok: false, error: 'bad_form' };
  var shop = readShop_();
  if (shop.pay.indexOf(o.pay) < 0) return { ok: false, error: 'bad_form' };

  // 3. Повтор того же запроса (клиент не дождался ответа и нажал ещё раз) — отдаём тот же номер.
  var cache = CacheService.getScriptCache();
  var rid = String(body.rid || '').replace(/[^\w-]/g, '').slice(0, 40);
  if (rid) {
    var prev = cache.get('rid_' + rid);
    if (prev) return { ok: true, number: prev };
  }

  // 4. Цены и наличие — только по таблице. Ценам от клиента не доверяем.
  var catalog = buildCatalog_();
  cachePutLarge_(CACHE_KEY, JSON.stringify(catalog)); // витрина сразу увидит то же, что видел сервер
  var byId = {};
  catalog.products.forEach(function (p) { byId[p.id] = p; });
  var lines = [];
  var total = 0;
  var bad = false;
  body.items.forEach(function (it) {
    var id = String((it && it.id) || '');
    var g = Number(it && it.g) || 0;
    var q = Math.floor(Number(it && it.q));
    var p = byId[id];
    var price = 0;
    if (p && p.a && q >= 1 && q <= 99) {
      if (p.t === 'w') p.v.forEach(function (v) { if (v[0] === g) price = v[1]; });
      else if (g === 0) price = p.p;
    }
    if (!(price > 0)) { bad = true; return; }
    lines.push(p.ua + (p.t === 'w' ? ' ' + weightLabel_(g) : '') + ' × ' + q + ' = ' + price * q + ' ₴');
    total += price * q;
  });
  if (bad || Number(body.total) !== total) return { ok: false, error: 'changed' };
  if (shop.min > 0 && total < shop.min) return { ok: false, error: 'min_order', min: shop.min };

  o.items = lines.join('; ');
  o.total = total;
  o.uid = user ? String(user.id) : '';
  o.username = user && user.username ? '@' + user.username : '';
  o.source = isTest ? 'miniapp test' : 'miniapp';
  o.status = STATUS_NEW;

  // 5. Запись в таблицу под блокировкой: два заказа одновременно не получат один номер.
  var rowIndex;
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var rlKey = 'rl_' + (o.uid || 'test');
    var count = parseInt(cache.get(rlKey), 10) || 0;
    if (count >= (o.uid ? MAX_ORDERS_PER_HOUR : MAX_TEST_ORDERS_PER_HOUR)) return { ok: false, error: 'rate_limit' };
    cache.put(rlKey, String(count + 1), 3600);

    var sheet = ensureOrdersSheet_();
    var col = orderCols_(sheet);
    o.num = nextOrderNumber_(sheet, col);
    var row = [];
    for (var i = 0; i < sheet.getLastColumn(); i++) row.push('');
    function put(key, value) { if (col[key] >= 0) row[col[key]] = value; }
    put('num', o.num); put('date', new Date()); put('status', o.status);
    put('uid', o.uid); put('username', safeCell_(o.username)); put('name', safeCell_(o.name));
    put('phone', '\'' + o.phone);
    put('delivery', o.delivery === 'np' ? 'Нова пошта' : 'самовивіз');
    put('city', safeCell_(o.city)); put('branch', safeCell_(o.branch));
    put('pay', PAY_UA[o.pay]); put('comment', safeCell_(o.comment));
    put('items', safeCell_(o.items)); put('total', o.total); put('lang', o.lang); put('source', o.source);
    sheet.appendRow(row);
    rowIndex = sheet.getLastRow();
    SpreadsheetApp.flush();
    if (rid) cache.put('rid_' + rid, o.num, 21600);
  } finally {
    lock.releaseLock();
  }

  // 6. Уведомления. Заказ уже записан: сбой Telegram не должен его отменять.
  try {
    var sent = [];
    adminIds_(props).forEach(function (chatId) {
      var res = tg_(token, 'sendMessage', {
        chat_id: chatId, text: adminText_(o, ''), parse_mode: 'HTML',
        disable_web_page_preview: true, reply_markup: adminKeyboard_(o.num)
      });
      if (res.ok) sent.push([chatId, res.result.message_id]);
      else console.error('Не доставлено админу ' + chatId + ': ' + res.description);
    });
    var sheet2 = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ORDERS);
    var col2 = orderCols_(sheet2);
    if (col2.svc >= 0 && sent.length) sheet2.getRange(rowIndex, col2.svc + 1).setValue(JSON.stringify({ m: sent }));
    if (o.uid && !isTest) {
      tg_(token, 'sendMessage', { chat_id: o.uid, text: clientText_('new', o) });
    }
  } catch (err) {
    console.error('notify: ' + (err && err.stack || err));
  }
  return { ok: true, number: o.num };
}

/**
 * Проверка подписи Telegram Mini App. Возвращает объект user или null.
 * secret = HMAC_SHA256(key="WebAppData", msg=BOT_TOKEN); hash = HMAC_SHA256(key=secret, msg=data_check_string)
 */
function verifyInitData_(initData, token) {
  try {
    var params = {};
    initData.split('&').forEach(function (pair) {
      var i = pair.indexOf('=');
      if (i < 0) return;
      params[decodeURIComponent(pair.slice(0, i))] = decodeURIComponent(pair.slice(i + 1).replace(/\+/g, ' '));
    });
    var hash = String(params.hash || '').toLowerCase();
    delete params.hash;
    if (!/^[0-9a-f]{64}$/.test(hash)) return null;
    var check = Object.keys(params).sort().map(function (k) { return k + '=' + params[k]; }).join('\n');
    var secret = Utilities.computeHmacSha256Signature(
      Utilities.newBlob(token).getBytes(), Utilities.newBlob('WebAppData').getBytes());
    var sig = Utilities.computeHmacSha256Signature(Utilities.newBlob(check).getBytes(), secret);
    var hex = sig.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
    var diff = 0;
    for (var j = 0; j < 64; j++) diff |= hex.charCodeAt(j) ^ hash.charCodeAt(j);
    if (diff !== 0) return null;
    var age = Date.now() / 1000 - Number(params.auth_date);
    if (!(age < INIT_DATA_MAX_AGE_SEC) || age < -300) return null;
    var user = JSON.parse(params.user || 'null');
    return user && user.id ? user : null;
  } catch (err) {
    return null;
  }
}

/* ------------------------------ Лист «Замовлення» ------------------------------ */

function ensureOrdersSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_ORDERS);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_ORDERS);
    sheet.getRange(1, 1, 1, ORDER_HEADERS.length).setValues([ORDER_HEADERS]).setFontWeight('bold');
    sheet.setFrozenRows(1);
    sheet.getRange('B:B').setNumberFormat('dd.MM.yyyy HH:mm');
    sheet.getRange('G:G').setNumberFormat('@');
    sheet.hideColumns(ORDER_HEADERS.length);
  }
  return sheet;
}

function orderCols_(sheet) {
  var headers = sheet.getRange(1, 1, 1, Math.max(1, sheet.getLastColumn())).getValues()[0];
  var col = mapHeaders_(headers, ORDER_COLS);
  if (col.num < 0 || col.status < 0) throw new Error('В листе «Замовлення» нет колонок «№» и «Статус»');
  return col;
}

function nextOrderNumber_(sheet, col) {
  var last = sheet.getLastRow();
  var max = 0;
  if (last > 1) {
    sheet.getRange(2, col.num + 1, last - 1, 1).getValues().forEach(function (r) {
      var m = String(r[0]).match(/^P-(\d+)$/);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    });
  }
  var n = String(max + 1);
  while (n.length < 4) n = '0' + n;
  return 'P-' + n;
}

/** Находит заказ по номеру. Возвращает { sheet, col, rowIndex, o } или null. */
function findOrder_(num) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ORDERS);
  if (!sheet || sheet.getLastRow() < 2) return null;
  var col = orderCols_(sheet);
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  for (var r = values.length - 1; r >= 0; r--) {
    if (String(values[r][col.num]).trim() !== num) continue;
    var row = values[r];
    var get = function (key) { return cell_(row, col[key]); };
    var delivery = get('delivery');
    var pay = get('pay');
    var payCode = 'cash';
    Object.keys(PAY_UA).forEach(function (k) { if (PAY_UA[k] === pay) payCode = k; });
    return {
      sheet: sheet, col: col, rowIndex: r + 2,
      o: {
        num: num, status: get('status') || STATUS_NEW, uid: get('uid'), username: get('username'),
        name: get('name'), phone: get('phone'), delivery: delivery.toLowerCase().indexOf('пошта') >= 0 ? 'np' : 'pickup',
        city: get('city'), branch: get('branch'), pay: payCode, comment: get('comment'),
        items: get('items'), total: toNum_(col.total >= 0 ? row[col.total] : 0),
        lang: get('lang') === 'ru' ? 'ru' : 'ua', source: get('source'), svc: get('svc')
      }
    };
  }
  return null;
}

/* ------------------------------ Тексты сообщений ------------------------------ */

function adminText_(o, statusNote) {
  var isTest = String(o.source).indexOf('test') >= 0;
  var who = escHtml_(o.name);
  if (o.uid) who = '<a href="tg://user?id=' + o.uid + '">' + who + '</a>';
  if (o.username) who += ' (' + escHtml_(o.username) + ')';
  var lines = [
    (o.status === STATUS_NEW ? '🆕 ' : '') + '<b>Замовлення ' + o.num + '</b>' + (isTest ? ' · 🧪 ТЕСТ' : ''),
    'Статус: <b>' + escHtml_(o.status) + '</b>' + (statusNote ? ' (' + escHtml_(statusNote) + ')' : ''),
    '',
    '👤 ' + who,
    '📞 ' + escHtml_(o.phone),
    '🚚 ' + (o.delivery === 'np' ? 'Нова пошта: ' + escHtml_(o.city) + ', відділення ' + escHtml_(o.branch) : 'Самовивіз з ринку'),
    '💳 ' + PAY_UA[o.pay],
    ''
  ];
  String(o.items).split('; ').forEach(function (s) { if (s) lines.push('• ' + escHtml_(s)); });
  lines.push('');
  lines.push('<b>Разом: ' + o.total + ' ₴</b>');
  if (o.comment) lines.push('💬 ' + escHtml_(o.comment));
  return lines.join('\n').slice(0, 4000);
}

function adminKeyboard_(num) {
  return {
    inline_keyboard: [
      [{ text: '✅ Підтвердити', callback_data: 'st:' + num + ':c' }, { text: '❌ Немає в наявності', callback_data: 'st:' + num + ':n' }],
      [{ text: '📦 Відправлено', callback_data: 'st:' + num + ':s' }, { text: '✔️ Виконано', callback_data: 'st:' + num + ':d' }]
    ]
  };
}

/** Сообщение клиенту на его языке. kind: new | c | n | s | d */
function clientText_(kind, o) {
  var ru = o.lang === 'ru';
  var shop = readShop_();
  var n = o.num;
  if (kind === 'new') {
    var st = readSettings_();
    return ru
      ? '🧾 Заказ ' + n + ' принят. Сумма: ' + o.total + ' ₴.\n' + st.confirm_ru
      : '🧾 Замовлення ' + n + ' прийнято. Сума: ' + o.total + ' ₴.\n' + st.confirm_ua;
  }
  if (kind === 'c') {
    var t = ru ? '✅ Заказ ' + n + ' подтверждён.' : '✅ Замовлення ' + n + ' підтверджено.';
    if (o.pay === 'card') t += ru ? '\nРеквизиты для оплаты пришлём отдельным сообщением.' : '\nРеквізити для оплати надішлемо окремим повідомленням.';
    if (o.delivery === 'np') t += ru ? '\nСообщим, когда отправим Новой почтой.' : '\nПовідомимо, коли відправимо Новою поштою.';
    else t += (ru ? '\nЖдём вас: ' + shop.address.ru + '\n' + shop.hours.ru : '\nЧекаємо на вас: ' + shop.address.ua + '\n' + shop.hours.ua);
    return t;
  }
  if (kind === 'n') {
    return ru
      ? '😔 К сожалению, заказ ' + n + ' сейчас выполнить не можем: товара нет в наличии. Напишите нам сюда, подберём замену.'
      : '😔 На жаль, замовлення ' + n + ' зараз виконати не можемо: товару немає в наявності. Напишіть нам сюди, підберемо заміну.';
  }
  if (kind === 's') return ru ? '📦 Заказ ' + n + ' отправлен.' : '📦 Замовлення ' + n + ' відправлено.';
  return ru ? '✔️ Заказ ' + n + ' выполнен. Спасибо, что выбрали PAMIR!' : '✔️ Замовлення ' + n + ' виконано. Дякуємо, що обрали PAMIR!';
}

/* ------------------------------ Бот: опрос Telegram ------------------------------ */

/**
 * Запускается триггером раз в минуту (см. startPolling). Забирает новые сообщения и нажатия кнопок.
 * Webhook не используем: Apps Script отвечает на POST редиректом, Telegram ему не следует.
 */
function pollUpdates() {
  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty('BOT_TOKEN');
  if (!token) return;
  var offset = parseInt(props.getProperty('TG_OFFSET'), 10) || 0;
  // У GET-запроса UrlFetchApp игнорирует payload, поэтому параметры — прямо в URL.
  var url = 'https://api.telegram.org/bot' + token + '/getUpdates?timeout=0&limit=50' +
    '&allowed_updates=' + encodeURIComponent('["message","callback_query"]') + (offset ? '&offset=' + offset : '');
  var data;
  try {
    data = JSON.parse(UrlFetchApp.fetch(url, { muteHttpExceptions: true }).getContentText());
  } catch (err) {
    console.error('getUpdates: ' + err);
    return;
  }
  if (!data.ok) {
    console.error('getUpdates: ' + data.description + (data.error_code === 409 ? ' — запустите startPolling(), чтобы удалить webhook' : ''));
    return;
  }
  if (!data.result.length) return;
  var cache = CacheService.getScriptCache();
  var admins = adminIds_(props);
  data.result.forEach(function (u) {
    offset = u.update_id + 1;
    if (cache.get('upd_' + u.update_id)) return; // защита от повторной обработки
    cache.put('upd_' + u.update_id, '1', 3600);
    try {
      if (u.callback_query) handleCallback_(u.callback_query, token, admins);
      else if (u.message) handleMessage_(u.message, token, props);
    } catch (err) {
      console.error('update ' + u.update_id + ': ' + (err && err.stack || err));
    }
  });
  props.setProperty('TG_OFFSET', String(offset));
}

function handleMessage_(msg, token, props) {
  if (!msg.chat || typeof msg.text !== 'string') return; // контакт, фото, служебные сообщения — молчим
  var text = msg.text.trim();
  if (/^\/id(@\w+)?$/i.test(text)) {
    tg_(token, 'sendMessage', { chat_id: msg.chat.id, text: 'Ваш chat id: ' + msg.chat.id });
    return;
  }
  if (msg.chat.type !== 'private') return;
  var webappUrl = props.getProperty('WEBAPP_URL');
  if (/^\/admin(@\w+)?$/i.test(text) && adminIds_(props).indexOf(String(msg.chat.id)) >= 0 && /^https:\/\//.test(webappUrl || '')) {
    tg_(token, 'sendMessage', {
      chat_id: msg.chat.id, text: 'Адмін-панель PAMIR: замовлення та товари.',
      reply_markup: { inline_keyboard: [[{ text: '🛠 Відкрити адмін-панель', web_app: { url: webappUrl + (webappUrl.indexOf('?') < 0 ? '?' : '&') + 'admin=1' } }]] }
    });
    return;
  }
  var ru = String((msg.from && msg.from.language_code) || '').toLowerCase().indexOf('ru') === 0;
  var settings = readSettings_();
  var payload = { chat_id: msg.chat.id, text: ru ? settings.greeting_ru : settings.greeting_ua };
  var webapp = props.getProperty('WEBAPP_URL');
  if (/^https:\/\//.test(webapp || '')) {
    payload.reply_markup = { inline_keyboard: [[{ text: ru ? '🛒 Открыть магазин' : '🛒 Відкрити магазин', web_app: { url: webapp } }]] };
  }
  tg_(token, 'sendMessage', payload);
}

/** Нажатие кнопки под заказом: меняем статус, обновляем сообщения админов, пишем клиенту. */
function handleCallback_(cq, token, admins) {
  function answer(text) { tg_(token, 'answerCallbackQuery', { callback_query_id: cq.id, text: text || '' }); }
  var fromId = String(cq.from && cq.from.id);
  var chatId = cq.message && cq.message.chat ? String(cq.message.chat.id) : '';
  if (admins.indexOf(fromId) < 0 && admins.indexOf(chatId) < 0) { answer('Немає доступу'); return; }
  var m = String(cq.data || '').match(/^st:(P-\d+):([cnsd])$/);
  if (!m) { answer(''); return; }
  var res = setOrderStatus_(m[1], m[2], (cq.from && cq.from.first_name) || '', token, cq.message ? [chatId, cq.message.message_id] : null);
  if (res.error === 'not_found') answer('Замовлення ' + m[1] + ' не знайдено в таблиці');
  else if (res.same) answer('Статус уже: ' + res.status);
  else answer('Статус: ' + res.status + (res.told === false ? '. Клієнту написати не вдалося' : ''));
}

/**
 * Меняет статус заказа: таблица → сообщения админов → сообщение клиенту.
 * Одна функция и для кнопок в Telegram, и для админ-панели.
 * told: true — клиенту написали, false — не получилось, null — писать некому (тестовый заказ).
 */
function setOrderStatus_(num, code, actor, token, extraTarget) {
  var status = STATUS_BY_CODE[code];
  if (!status) return { ok: false, error: 'bad_status' };
  var found;
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    found = findOrder_(num);
    if (!found) return { ok: false, error: 'not_found' };
    if (found.o.status === status) return { ok: true, same: true, status: status, told: null };
    found.sheet.getRange(found.rowIndex, found.col.status + 1).setValue(status);
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }

  var o = found.o;
  o.status = status;
  var note = (actor ? actor + ', ' : '') + Utilities.formatDate(new Date(), 'Europe/Kiev', 'dd.MM HH:mm');
  var targets = [];
  try { targets = (JSON.parse(o.svc || '{}').m) || []; } catch (err) { targets = []; }
  if (extraTarget && !targets.some(function (t) { return String(t[0]) === String(extraTarget[0]) && t[1] === extraTarget[1]; })) {
    targets.push(extraTarget);
  }
  targets.forEach(function (t) {
    tg_(token, 'editMessageText', {
      chat_id: t[0], message_id: t[1], text: adminText_(o, note), parse_mode: 'HTML',
      disable_web_page_preview: true, reply_markup: adminKeyboard_(o.num)
    });
  });
  var told = null;
  if (o.uid && String(o.source).indexOf('test') < 0) {
    told = !!tg_(token, 'sendMessage', { chat_id: o.uid, text: clientText_(code, o) }).ok;
  }
  return { ok: true, status: status, told: told };
}

/* ------------------------------ Служебное ------------------------------ */

function tg_(token, method, payload) {
  try {
    var res = UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/' + method, {
      method: 'post', contentType: 'application/json', payload: JSON.stringify(payload || {}), muteHttpExceptions: true
    });
    return JSON.parse(res.getContentText());
  } catch (err) {
    return { ok: false, description: String(err) };
  }
}

function adminIds_(props) {
  return String(props.getProperty('ADMIN_CHAT_IDS') || '').split(/[,;\s]+/).filter(function (s) { return /^-?\d+$/.test(s); });
}

function clean_(v, max) {
  return String(v === null || v === undefined ? '' : v).replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, max);
}

/** Текст от клиента не должен стать формулой в таблице. */
function safeCell_(s) {
  s = String(s || '');
  return /^[=+\-@]/.test(s) ? '\'' + s : s;
}

function escHtml_(s) {
  return String(s === null || s === undefined ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function weightLabel_(g) {
  return g >= 1000 ? String(g / 1000).replace('.', ',') + ' кг' : g + ' г';
}

/* ---------------- Функции, которые запускаются руками из редактора ---------------- */

/** Запустить один раз: включает опрос Telegram раз в минуту и создаёт лист «Замовлення». */
function startPolling() {
  var token = PropertiesService.getScriptProperties().getProperty('BOT_TOKEN');
  if (!token) throw new Error('Сначала добавьте BOT_TOKEN в Свойства скрипта (Настройки проекта).');
  var me = tg_(token, 'getMe', {});
  if (!me.ok) throw new Error('Telegram не принял токен: ' + me.description);
  tg_(token, 'deleteWebhook', {});
  stopPolling();
  ScriptApp.newTrigger('pollUpdates').timeBased().everyMinutes(1).create();
  ensureOrdersSheet_();
  console.log('Готово. Бот @' + me.result.username + ' опрашивается раз в минуту. Напишите боту /id, ответ придёт в течение минуты.');
}

/** Выключает опрос (например, на время отпуска). */
function stopPolling() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'pollUpdates') ScriptApp.deleteTrigger(t);
  });
}

/** Проверка настроек: токен, список админов, пробное сообщение каждому админу. */
function testBot() {
  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty('BOT_TOKEN');
  if (!token) throw new Error('Нет BOT_TOKEN в Свойствах скрипта.');
  var me = tg_(token, 'getMe', {});
  console.log(me.ok ? 'Токен в порядке: @' + me.result.username : 'Токен не принят: ' + me.description);
  var admins = adminIds_(props);
  console.log('Админы (ADMIN_CHAT_IDS): ' + (admins.length ? admins.join(', ') : 'не заданы'));
  admins.forEach(function (id) {
    var res = tg_(token, 'sendMessage', { chat_id: id, text: 'PAMIR: перевірка зв\'язку ✅' });
    console.log(id + ': ' + (res.ok ? 'сообщение доставлено' : 'НЕ доставлено (' + res.description + '). Этот человек должен нажать Start у бота.'));
  });
  console.log('WEBAPP_URL: ' + (props.getProperty('WEBAPP_URL') || 'не задан'));
  console.log('Тестовые заказы из браузера: ' + (props.getProperty('ALLOW_TEST_ORDERS') === '1' ? 'разрешены (перед запуском удалите ALLOW_TEST_ORDERS)' : 'выключены'));
  var polling = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'pollUpdates'; });
  console.log('Опрос Telegram: ' + (polling ? 'включён' : 'выключен, запустите startPolling'));
}

/* ======================================================================== */
/* ЭТАП 4: подключение магазина к боту                                        */
/* ======================================================================== */

/**
 * Запустить один раз из редактора. Ставит кнопку меню «Магазин», команды и описание бота,
 * удаляет webhook и включает опрос. Повторный запуск безопасен: всё просто выставится заново.
 */
function setup() {
  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty('BOT_TOKEN');
  var webapp = props.getProperty('WEBAPP_URL');
  if (!token) throw new Error('Нет BOT_TOKEN в Свойствах скрипта.');
  if (!/^https:\/\//.test(webapp || '')) throw new Error('Нет WEBAPP_URL в Свойствах скрипта (должен начинаться с https://).');

  startPolling();

  var steps = [
    ['Кнопка меню «Магазин»', 'setChatMenuButton', { menu_button: { type: 'web_app', text: 'Магазин', web_app: { url: webapp } } }],
    ['Команды (UA)', 'setMyCommands', { commands: [
      { command: 'start', description: 'Відкрити магазин' },
      { command: 'id', description: 'Показати мій chat id' }] }],
    ['Команды (RU)', 'setMyCommands', { language_code: 'ru', commands: [
      { command: 'start', description: 'Открыть магазин' },
      { command: 'id', description: 'Показать мой chat id' }] }],
    ['Описание (UA)', 'setMyDescription', { description:
      'PAMIR — горіхи, сухофрукти та східні солодощі з Центрального ринку Харкова. Курага з власного саду в Ісфарі.\n\nНатисніть «Магазин», зберіть кошик і оформіть замовлення: самовивіз з ринку або Нова пошта.' }],
    ['Описание (RU)', 'setMyDescription', { language_code: 'ru', description:
      'PAMIR — орехи, сухофрукты и восточные сладости с Центрального рынка Харькова. Курага из собственного сада в Исфаре.\n\nНажмите «Магазин», соберите корзину и оформите заказ: самовывоз с рынка или Новая почта.' }],
    ['Короткое описание (UA)', 'setMyShortDescription', { short_description: 'Горіхи, сухофрукти, східні солодощі. Центральний ринок, Харків' }],
    ['Короткое описание (RU)', 'setMyShortDescription', { language_code: 'ru', short_description: 'Орехи, сухофрукты, восточные сладости. Центральный рынок, Харьков' }]
  ];
  // Админам — дополнительная команда /admin (видна только в их чатах с ботом).
  adminIds_(props).forEach(function (id) {
    steps.push(['Команды админа ' + id, 'setMyCommands', { scope: { type: 'chat', chat_id: id }, commands: [
      { command: 'start', description: 'Відкрити магазин' },
      { command: 'admin', description: 'Адмін-панель: замовлення і товари' },
      { command: 'id', description: 'Показати мій chat id' }] }]);
  });
  var failed = 0;
  steps.forEach(function (s) {
    var res = tg_(token, s[1], s[2]);
    if (!res.ok) failed++;
    console.log(s[0] + ': ' + (res.ok ? 'готово' : 'ОШИБКА — ' + res.description + (s[1] === 'setMyCommands' && s[2].scope ? ' (этот админ ещё не нажал Start у бота)' : '')));
  });
  console.log(failed
    ? 'Не всё получилось: ' + failed + ' шаг(ов) с ошибкой, см. выше.'
    : 'Всё готово. Закройте и заново откройте чат с ботом: слева от поля ввода появится кнопка «Магазин».');
}


/* ======================================================================== */
/* ЭТАП 5: админ-панель (заказы и товары)                                     */
/* ======================================================================== */
/*
 * Все действия admin.* выполняются только если подпись Telegram верна И id пользователя есть
 * в ADMIN_CHAT_IDS. Проверка идёт при каждом запросе; тестового обхода (?debug=1) здесь нет.
 */

function handleAdmin_(body) {
  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty('BOT_TOKEN');
  if (!token) return { ok: false, error: 'not_configured' };
  var user = verifyInitData_(String(body.initData || ''), token);
  if (!user || adminIds_(props).indexOf(String(user.id)) < 0) return { ok: false, error: 'forbidden' };

  if (body.action === 'admin.orders') return listOrders_();
  if (body.action === 'admin.status') {
    return setOrderStatus_(String(body.num || ''), String(body.code || ''), user.first_name || '', token, null);
  }
  if (body.action === 'admin.products') return { ok: true, products: listProductsAdmin_(), categories: listCategoriesAdmin_() };
  if (body.action === 'admin.product') return updateProduct_(String(body.id || ''), body.patch || {}, false);
  if (body.action === 'admin.productAdd') return updateProduct_('', body.patch || {}, true);
  if (body.action === 'admin.photo') return savePhoto_(String(body.id || ''), String(body.data || ''));
  if (body.action === 'admin.category') return saveCategory_(body.category || {});
  if (body.action === 'admin.settings') return { ok: true, fields: settingsFields_() };
  if (body.action === 'admin.settingsSave') return saveSettings_(body.values || {});
  return { ok: false, error: 'unknown_action' };
}

/** Последние 100 заказов (новые сверху) и итоги за сегодня и за 7 дней. */
function listOrders_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ORDERS);
  var stats = { today: { n: 0, sum: 0 }, week: { n: 0, sum: 0 } };
  if (!sheet || sheet.getLastRow() < 2) return { ok: true, orders: [], stats: stats };
  var col = orderCols_(sheet);
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  var now = new Date();
  var todayKey = Utilities.formatDate(now, 'Europe/Kiev', 'yyyy-MM-dd');
  var weekAgo = now.getTime() - 7 * 24 * 3600 * 1000;
  var orders = [];
  for (var r = values.length - 1; r >= 0; r--) {
    var row = values[r];
    var num = cell_(row, col.num);
    if (!num) continue;
    var date = col.date >= 0 ? row[col.date] : '';
    var isDate = Object.prototype.toString.call(date) === '[object Date]' && !isNaN(date.getTime());
    var status = cell_(row, col.status) || STATUS_NEW;
    var source = cell_(row, col.source);
    var total = toNum_(col.total >= 0 ? row[col.total] : 0);
    // В итоги не идут тестовые, отменённые и те, где товара не оказалось.
    if (isDate && source.indexOf('test') < 0 && status !== 'немає в наявності' && status !== 'скасовано') {
      if (Utilities.formatDate(date, 'Europe/Kiev', 'yyyy-MM-dd') === todayKey) { stats.today.n++; stats.today.sum += total; }
      if (date.getTime() >= weekAgo) { stats.week.n++; stats.week.sum += total; }
    }
    if (orders.length < 100) {
      orders.push({
        num: num, date: isDate ? Utilities.formatDate(date, 'Europe/Kiev', 'dd.MM HH:mm') : String(date || ''),
        status: status, uid: cell_(row, col.uid), username: cell_(row, col.username), name: cell_(row, col.name),
        phone: cell_(row, col.phone), delivery: cell_(row, col.delivery), city: cell_(row, col.city),
        branch: cell_(row, col.branch), pay: cell_(row, col.pay), comment: cell_(row, col.comment),
        items: cell_(row, col.items), total: total, test: source.indexOf('test') >= 0
      });
    }
  }
  return { ok: true, orders: orders, stats: stats };
}

function productCols_(sheet) {
  var col = mapHeaders_(sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0], PRODUCT_COLS);
  ['id', 'nameUa', 'type', 'stock'].forEach(function (k) {
    if (col[k] < 0) throw new Error('В листе «Товари» не найдена колонка: ' + PRODUCT_COLS[k][0]);
  });
  return col;
}

function adminProduct_(row, col) {
  var info = priceInfo_(cell_(row, col.type), cell_(row, col.packs), col.pKg >= 0 ? row[col.pKg] : '', col.pUnit >= 0 ? row[col.pUnit] : '');
  return {
    id: cell_(row, col.id), cat: cell_(row, col.catUa), ua: cell_(row, col.nameUa), ru: cell_(row, col.nameRu), t: info.t,
    packs: cell_(row, col.packs), price: info.t === 'w' ? toNum_(col.pKg >= 0 ? row[col.pKg] : 0) : toNum_(col.pUnit >= 0 ? row[col.pUnit] : 0),
    stock: isInStock_(cell_(row, col.stock)) ? 1 : 0, hidden: isYes_(cell_(row, col.hidden)) ? 1 : 0,
    img: normalizePhoto_(cell_(row, col.photo)), dUa: cell_(row, col.descUa), dRu: cell_(row, col.descRu),
    wh: toNum_(col.whPrice >= 0 ? row[col.whPrice] : 0), wm: cell_(row, col.whMin)
  };
}

/** Товары для админ-панели: только те же клиентские колонки, служебные (закупка, маржа) не читаются. */
function listProductsAdmin_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_PRODUCTS);
  var col = productCols_(sheet);
  var values = sheet.getDataRange().getValues();
  var list = [];
  for (var r = 1; r < values.length; r++) {
    var p = adminProduct_(values[r], col);
    if (p.id && p.ua) list.push(p);
  }
  return list;
}

var TYPE_UA = { w: 'вагова', p: 'упаковка', u: 'шт' };

function multiline_(v, max) {
  return String(v === null || v === undefined ? '' : v).replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ').trim().slice(0, max);
}

/**
 * Правка товара или (create = true) добавление нового.
 * patch: { cat, t, ua, ru, packs, price, stock, hidden, img, dUa, dRu, wh, wm } — любое подмножество.
 * Новый товар получает ID автоматически: код категории + следующий номер (DRY-088).
 */
function updateProduct_(id, patch, create) {
  if (!create && !id) return { ok: false, error: 'bad_form' };
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_PRODUCTS);
    var col = productCols_(sheet);
    var values = sheet.getDataRange().getValues();
    var cats = listCategoriesAdmin_();
    var cat = null;
    if (patch.cat !== undefined) {
      cats.forEach(function (c) { if (c.ua === patch.cat || c.code === patch.cat) cat = c; });
      if (!cat) return { ok: false, error: 'bad_form' };
    }
    if (patch.t !== undefined && !TYPE_UA[patch.t]) return { ok: false, error: 'bad_form' };
    if (patch.price !== undefined && !(Number(patch.price) >= 0 && Number(patch.price) < 1000000)) return { ok: false, error: 'bad_form' };
    if (patch.wh !== undefined && !(Number(patch.wh) >= 0 && Number(patch.wh) < 1000000)) return { ok: false, error: 'bad_form' };
    if (typeof patch.ua === 'string' && !clean_(patch.ua, 120)) return { ok: false, error: 'bad_form' };
    if (typeof patch.img === 'string' && patch.img && !/^https:\/\//i.test(patch.img)) return { ok: false, error: 'bad_form' };

    var r = -1;
    if (create) {
      if (!cat || !patch.t || typeof patch.ua !== 'string') return { ok: false, error: 'bad_form' };
      var prefix = /^[A-Z0-9]{2,6}$/.test(cat.code) ? cat.code : 'PRD';
      var max = 0;
      for (var k = 1; k < values.length; k++) {
        var m = cell_(values[k], col.id).match(/^([A-Z0-9]+)-(\d+)$/);
        if (m && m[1] === prefix) max = Math.max(max, parseInt(m[2], 10));
      }
      var n = String(max + 1);
      while (n.length < 3) n = '0' + n;
      id = prefix + '-' + n;
      var blank = [];
      for (var b = 0; b < sheet.getLastColumn(); b++) blank.push('');
      blank[col.id] = id;
      blank[col.stock] = patch.stock ? 'є' : 'немає';
      sheet.appendRow(blank);
      r = sheet.getLastRow() - 1;
    } else {
      for (var i = 1; i < values.length; i++) if (cell_(values[i], col.id) === id) { r = i; break; }
      if (r < 0) return { ok: false, error: 'not_found' };
    }

    function set(c, value) { if (c >= 0) sheet.getRange(r + 1, c + 1).setValue(value); }
    function text(key, c, max) { if (typeof patch[key] === 'string') set(c, safeCell_(clean_(patch[key], max))); }
    if (cat) { set(col.catUa, cat.ua); set(col.catRu, cat.ru); }
    if (patch.t !== undefined) set(col.type, TYPE_UA[patch.t]);
    text('ua', col.nameUa, 120); text('ru', col.nameRu, 120); text('packs', col.packs, 80); text('wm', col.whMin, 40);
    if (typeof patch.dUa === 'string') set(col.descUa, safeCell_(multiline_(patch.dUa, 600)));
    if (typeof patch.dRu === 'string') set(col.descRu, safeCell_(multiline_(patch.dRu, 600)));
    if (typeof patch.img === 'string') set(col.photo, patch.img);
    if (patch.stock !== undefined) set(col.stock, patch.stock ? 'є' : 'немає');
    if (patch.wh !== undefined) set(col.whPrice, Number(patch.wh) > 0 ? Math.round(Number(patch.wh) * 100) / 100 : '');
    if (patch.hidden !== undefined) {
      if (col.hidden < 0) { // колонки «Приховати» ещё нет — добавляем в конец
        col.hidden = sheet.getLastColumn();
        sheet.getRange(1, col.hidden + 1).setValue('Приховати з вітрини');
      }
      set(col.hidden, patch.hidden ? 'так' : '');
    }
    var isWeight = patch.t !== undefined ? patch.t === 'w'
      : priceInfo_(create ? '' : cell_(values[r], col.type), '', 0, 0).t === 'w';
    if (patch.price !== undefined || (patch.t !== undefined && !create)) {
      var old = create ? 0 : (col.pKg >= 0 ? toNum_(values[r][col.pKg]) : 0) || (col.pUnit >= 0 ? toNum_(values[r][col.pUnit]) : 0);
      var price = patch.price !== undefined ? Math.round(Number(patch.price) * 100) / 100 : old;
      // Цена живёт в колонке своего типа; вторую очищаем, чтобы не осталось старого значения.
      set(col.pKg, isWeight && price ? price : '');
      set(col.pUnit, !isWeight && price ? price : '');
      if (col.p100 >= 0 && !sheet.getRange(r + 1, col.p100 + 1).getFormula()) set(col.p100, isWeight && price ? Math.round(price) / 10 : '');
    }
    SpreadsheetApp.flush();
    clearCatalogCache_();
    var fresh = sheet.getRange(r + 1, 1, 1, sheet.getLastColumn()).getValues()[0];
    return { ok: true, product: adminProduct_(fresh, col) };
  } finally {
    lock.releaseLock();
  }
}

/* ------------------------------ Фото товаров ------------------------------ */

var PHOTO_FOLDER_NAME = 'PAMIR — фото товарів';

function photoFolder_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('PHOTO_FOLDER_ID');
  if (id) {
    try { return DriveApp.getFolderById(id); } catch (err) { /* папку удалили — создадим новую */ }
  }
  var folder = DriveApp.createFolder(PHOTO_FOLDER_NAME);
  props.setProperty('PHOTO_FOLDER_ID', folder.getId());
  return folder;
}

/** Фото приходит из админ-панели уже сжатым (JPEG, base64). Кладём в папку на Google Drive, ссылку — в таблицу. */
function savePhoto_(id, data) {
  if (!id) return { ok: false, error: 'bad_form' };
  var bytes;
  try { bytes = Utilities.base64Decode(data); } catch (err) { return { ok: false, error: 'bad_form' }; }
  if (bytes.length < 500 || bytes.length > 1100000 || (bytes[0] & 255) !== 0xFF || (bytes[1] & 255) !== 0xD8) {
    return { ok: false, error: 'bad_form' };
  }
  var file = photoFolder_().createFile(Utilities.newBlob(bytes, 'image/jpeg', id + '-' + Date.now() + '.jpg'));
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return updateProduct_(id, { img: 'https://drive.google.com/file/d/' + file.getId() + '/view' }, false);
}

/** Запустить один раз из редактора: выдаёт доступ к Google Drive и создаёт папку для фото. */
function setupPhotos() {
  var folder = photoFolder_();
  console.log('Папка для фото готова: ' + folder.getUrl());
}

/* ------------------------------ Категории ------------------------------ */

var CATEGORY_ICONS = ['nut', 'cherry', 'candy', 'flame', 'leaf', 'coffee'];

function listCategoriesAdmin_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_CATEGORIES);
  if (!sheet) return [];
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  var col = mapHeaders_(values[0], CATEGORY_COLS);
  var list = [];
  for (var r = 1; r < values.length; r++) {
    var code = cell_(values[r], col.code);
    var ua = cell_(values[r], col.ua);
    if (!code || !ua) continue;
    list.push({ code: code, ua: ua, ru: cell_(values[r], col.ru) || ua, icon: cell_(values[r], col.icon).toLowerCase(),
      order: toNum_(col.order >= 0 ? values[r][col.order] : 0) || 999 });
  }
  list.sort(function (a, b) { return a.order - b.order; });
  return list;
}

/** Добавить (isNew) или изменить категорию. При переименовании названия меняются и в строках товаров. */
function saveCategory_(c) {
  var code = String(c.code || '').trim().toUpperCase();
  var ua = clean_(c.ua, 40);
  var ru = clean_(c.ru, 40) || ua;
  var icon = CATEGORY_ICONS.indexOf(String(c.icon)) >= 0 ? String(c.icon) : '';
  var order = Math.round(Number(c.order));
  if (!ua || !(order >= 1 && order <= 999) || !/^[A-Z]{2,5}$/.test(code)) return { ok: false, error: 'bad_form' };
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_CATEGORIES);
    if (!sheet) return { ok: false, error: 'not_found' };
    var values = sheet.getDataRange().getValues();
    var col = mapHeaders_(values[0], CATEGORY_COLS);
    if (col.code < 0 || col.ua < 0) return { ok: false, error: 'not_found' };
    var r = -1;
    for (var i = 1; i < values.length; i++) if (cell_(values[i], col.code).toUpperCase() === code) { r = i; break; }
    if (c.isNew) {
      if (r >= 0) return { ok: false, error: 'exists' };
      var blank = [];
      for (var b = 0; b < sheet.getLastColumn(); b++) blank.push('');
      blank[col.code] = code;
      sheet.appendRow(blank);
      r = sheet.getLastRow() - 1;
    } else if (r < 0) {
      return { ok: false, error: 'not_found' };
    }
    var oldUa = c.isNew ? '' : cell_(values[r], col.ua);
    function set(k, value) { if (col[k] >= 0) sheet.getRange(r + 1, col[k] + 1).setValue(value); }
    set('ua', safeCell_(ua)); set('ru', safeCell_(ru)); set('icon', icon); set('order', order);

    if (oldUa && oldUa !== ua) { // товары ссылаются на категорию по названию
      var ps = ss.getSheetByName(SHEET_PRODUCTS);
      var pc = productCols_(ps);
      var pv = ps.getDataRange().getValues();
      for (var k = 1; k < pv.length; k++) {
        if (pc.catUa >= 0 && cell_(pv[k], pc.catUa) === oldUa) {
          ps.getRange(k + 1, pc.catUa + 1).setValue(ua);
          if (pc.catRu >= 0) ps.getRange(k + 1, pc.catRu + 1).setValue(ru);
        }
      }
    } else if (!c.isNew && cell_(values[r], col.ru) !== ru) {
      var ps2 = ss.getSheetByName(SHEET_PRODUCTS);
      var pc2 = productCols_(ps2);
      var pv2 = ps2.getDataRange().getValues();
      for (var q = 1; q < pv2.length; q++) {
        if (pc2.catUa >= 0 && pc2.catRu >= 0 && cell_(pv2[q], pc2.catUa) === ua) ps2.getRange(q + 1, pc2.catRu + 1).setValue(ru);
      }
    }
    SpreadsheetApp.flush();
    clearCatalogCache_();
    return { ok: true, categories: listCategoriesAdmin_() };
  } finally {
    lock.releaseLock();
  }
}

/* ------------------------------ Настройки магазина ------------------------------ */

var SHEET_SETTINGS = 'Налаштування';
/** [ключ, подпись для админа, значение по умолчанию]. Лист «Налаштування»: Ключ · Значення · Опис. */
var SETTINGS_DEF = [
  ['notice_ua', 'Оголошення у шапці вітрини (UA). Порожньо — без оголошення', ''],
  ['notice_ru', 'Объявление в шапке витрины (RU)', ''],
  ['address_ua', 'Адреса самовивозу (UA)', SHOP_DEFAULTS.PICKUP_ADDRESS_UA],
  ['address_ru', 'Адрес самовывоза (RU)', SHOP_DEFAULTS.PICKUP_ADDRESS_RU],
  ['hours_ua', 'Години роботи (UA)', SHOP_DEFAULTS.PICKUP_HOURS_UA],
  ['hours_ru', 'Часы работы (RU)', SHOP_DEFAULTS.PICKUP_HOURS_RU],
  ['pay_cash', 'Оплата при отриманні', 'так'],
  ['pay_card', 'Оплата переказом на картку', 'так'],
  ['pay_cod', 'Накладений платіж (Нова пошта)', 'так'],
  ['min_order', 'Мінімальна сума замовлення, ₴ (0 — без обмеження)', '0'],
  ['greeting_ua', 'Привітання бота (UA)', 'Вітаємо! Це PAMIR: горіхи, сухофрукти та східні солодощі з Центрального ринку Харкова.\nВідкрийте магазин, зберіть кошик, а ми підтвердимо замовлення тут, у чаті.'],
  ['greeting_ru', 'Приветствие бота (RU)', 'Здравствуйте! Это PAMIR: орехи, сухофрукты и восточные сладости с Центрального рынка Харькова.\nОткройте магазин, соберите корзину, а мы подтвердим заказ здесь, в чате.'],
  ['confirm_ua', 'Текст клієнту після прийняття замовлення (UA)', 'Ми підтвердимо наявність і напишемо вам сюди.'],
  ['confirm_ru', 'Текст клиенту после принятия заказа (RU)', 'Мы подтвердим наличие и напишем вам сюда.']
];
var settingsMemo_ = null;

function isYes_(v) {
  return /^(так|да|yes|true|1|є|x|х|\+)$/i.test(String(v === null || v === undefined ? '' : v).trim());
}

/** Значения настроек: лист «Налаштування», а пока его нет — значения по умолчанию (и старые PICKUP_* из свойств). */
function readSettings_() {
  if (settingsMemo_) return settingsMemo_;
  var out = {};
  var props = PropertiesService.getScriptProperties();
  SETTINGS_DEF.forEach(function (d) { out[d[0]] = d[2]; });
  [['address_ua', 'PICKUP_ADDRESS_UA'], ['address_ru', 'PICKUP_ADDRESS_RU'], ['hours_ua', 'PICKUP_HOURS_UA'], ['hours_ru', 'PICKUP_HOURS_RU']]
    .forEach(function (m) { var v = props.getProperty(m[1]); if (v) out[m[0]] = v; });
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_SETTINGS);
  if (sheet && sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues().forEach(function (row) {
      var key = String(row[0] || '').trim();
      if (key in out) out[key] = String(row[1] === null || row[1] === undefined ? '' : row[1]).trim();
    });
  }
  // Пустой обязательный текст заменяем значением по умолчанию: бот не должен слать пустое сообщение.
  SETTINGS_DEF.forEach(function (d) { if (!out[d[0]] && d[0].indexOf('notice_') !== 0 && d[0] !== 'min_order') out[d[0]] = d[2]; });
  settingsMemo_ = out;
  return out;
}

function settingsFields_() {
  var st = readSettings_();
  return SETTINGS_DEF.map(function (d) { return { k: d[0], label: d[1], v: st[d[0]] }; });
}

function saveSettings_(values) {
  var next = {};
  var current = readSettings_();
  SETTINGS_DEF.forEach(function (d) {
    var k = d[0];
    if (values[k] === undefined) { next[k] = current[k]; return; }
    if (k.indexOf('pay_') === 0) next[k] = values[k] === true || isYes_(values[k]) ? 'так' : 'ні';
    else if (k === 'min_order') next[k] = String(Math.max(0, Math.min(100000, Math.round(toNum_(values[k])))));
    else next[k] = multiline_(values[k], 500);
  });
  if (!isYes_(next.pay_cash) && !isYes_(next.pay_card)) return { ok: false, error: 'no_payment' };
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_SETTINGS);
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_SETTINGS);
      sheet.getRange(1, 1, 1, 3).setValues([['Ключ', 'Значення', 'Опис']]).setFontWeight('bold');
      sheet.setFrozenRows(1);
    }
    var rows = SETTINGS_DEF.map(function (d) { return [d[0], safeCell_(next[d[0]]), d[1]]; });
    sheet.getRange(2, 1, rows.length, 3).setValues(rows);
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
  settingsMemo_ = null;
  clearCatalogCache_();
  return { ok: true, fields: settingsFields_() };
}
