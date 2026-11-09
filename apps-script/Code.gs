/**
 * PAMIR — бэкенд магазина (Google Apps Script, привязан к таблице «PAMIR — Товари»).
 *
 * ЭТАП 1: каталог.
 *   doGet(?action=catalog) → JSON с категориями и товарами.
 *   Клиенту уходят ТОЛЬКО поля из белого списка PRODUCT_COLS (колонки A–Q).
 *   Служебные колонки (конкурент, закупка, маржа, наценка, источник) не читаются вообще.
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
  whMin:   ['опт: мін', 'опт мін']
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

function readShop_() {
  var props = PropertiesService.getScriptProperties();
  function get(key) { return props.getProperty(key) || SHOP_DEFAULTS[key]; }
  return {
    address: { ua: get('PICKUP_ADDRESS_UA'), ru: get('PICKUP_ADDRESS_RU') },
    hours:   { ua: get('PICKUP_HOURS_UA'),   ru: get('PICKUP_HOURS_RU') }
  };
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
