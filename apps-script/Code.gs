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
 * ЭТАП 8 (в конце файла): админы с правами, журнал действий, приветствие бота.
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
  hidden:  ['приховати', 'прихован'],
  badge:   ['бейдж', 'мітка'],
  oldPrice: ['стара ціна'],
  qty:     ['залишок'],
  saleEnd: ['акція до', 'акция до'],
  // Этап 8: «паспорт товара», подсказка к весу и особые цены фасовок. Все колонки необязательные.
  sort:    ['сорт'],
  harvest: ['урожай'],
  origin:  ['походження'],
  fresh:   ['свіжа поставка'],
  hint:    ['підказка до ваги'],
  hintRu:  ['подсказка к весу'],
  packPrices: ['ціни фасувань', 'ціна фасування']
};

/** Бейдж товара: в таблице пишется словом, витрина получает код. */
var BADGE_UA = { 'new': 'новинка', hit: 'хіт', sale: 'знижка', set: 'набір' };
function badgeCode_(v) {
  var s = String(v === null || v === undefined ? '' : v).trim().toLowerCase();
  if (/^(нов|new)/.test(s)) return 'new';
  if (/^(хіт|хит|hit|топ|top)/.test(s)) return 'hit';
  if (/^(зниж|скид|акц|sale|%)/.test(s)) return 'sale';
  if (/^(наб|комплект|set)/.test(s)) return 'set';
  return '';
}

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
    if (action === 'reviews') return jsonText_(JSON.stringify(reviewsFor_(String(e.parameter.id || ''))));
    if (action === 'np.city') return jsonText_(JSON.stringify(npCities_(String(e.parameter.q || ''))));
    if (action === 'np.wh') return jsonText_(JSON.stringify(npWarehouses_(String(e.parameter.city || ''), String(e.parameter.q || ''), String(e.parameter.t || ''))));
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

  // Популярность и «разом купують» — только из настоящих заказов за последние 30 дней.
  try {
    var sig = orderSignals_(ss);
    products.forEach(function (p) {
      if (sig.n[p.id]) p.n = sig.n[p.id];
      if (sig.r[p.id]) p.r = sig.r[p.id];
    });
    var hit = weekHit_(sig.w, products);
    if (hit) hit.hw = 1;
  } catch (err) {
    console.warn('signals: ' + err);
  }

  // Отзывы: только одобренные. Средняя оценка — когда отзывов три и больше.
  try {
    var rs = reviewStats_(ss);
    products.forEach(function (p) {
      var x = rs[p.id];
      if (!x) return;
      p.rc = x.n;
      if (x.n >= REVIEW_MIN_FOR_AVG) p.ra = Math.round(x.s / x.n * 10) / 10;
    });
  } catch (err) {
    console.warn('reviews: ' + err);
  }

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
  // Подарок от суммы заказа и подарок постоянному клиенту: работают, только если в настройках заданы и число, и текст.
  var giftFrom = Math.round(toNum_(st.gift_from));
  if (giftFrom > 0 && (st.gift_text_ua || st.gift_text_ru)) {
    shop.gift = { from: giftFrom, ua: st.gift_text_ua || st.gift_text_ru, ru: st.gift_text_ru || st.gift_text_ua };
  }
  var loyalEvery = Math.round(toNum_(st.loyal_every));
  if (loyalEvery >= 2 && (st.loyal_text_ua || st.loyal_text_ru)) {
    shop.loyal = { every: loyalEvery, ua: st.loyal_text_ua || st.loyal_text_ru, ru: st.loyal_text_ru || st.loyal_text_ua };
  }
  // Блок «Наша курага» наверху каталога: товар и текст задаются в настройках.
  var fid = String(st.feature_id || '').trim().toUpperCase();
  if (fid) {
    shop.feature = {
      id: fid,
      title: { ua: st.feature_title_ua || st.feature_title_ru, ru: st.feature_title_ru || st.feature_title_ua },
      text:  { ua: st.feature_text_ua || st.feature_text_ru,   ru: st.feature_text_ru || st.feature_text_ua }
    };
  }
  shopExtras8_(shop, st);
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
  var nowMs = Date.now();
  var sheetTz = ss.getSpreadsheetTimeZone() || 'Europe/Kiev';
  var st8 = readSettings_();
  var lowPcs = Math.round(toNum_(st8.low_stock)) || LOW_STOCK_PCS;
  var freshMs = (Math.round(toNum_(st8.fresh_days)) || 0) * 24 * 3600 * 1000;
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
    var typeRaw = cell_(row, col.type);
    var packsRaw = cell_(row, col.packs);
    var packPrices = cell_(row, col.packPrices);
    var price = priceInfo_(typeRaw, packsRaw, col.pKg >= 0 ? row[col.pKg] : '', col.pUnit >= 0 ? row[col.pUnit] : '', packPrices);
    // Бейдж и старая цена (в тех же единицах, что и цена: за 1 кг или за упаковку).
    var badge = badgeCode_(cell_(row, col.badge));
    var base = price.t === 'w' ? price.k : price.p;
    var oldP = toNum_(col.oldPrice >= 0 ? row[col.oldPrice] : '');
    // «Акція до»: скидка действует по эту дату включительно. После неё товар снова стоит по обычной (старой) цене.
    var saleEnd = col.saleEnd >= 0 ? saleEnd_(row[col.saleEnd], sheetTz) : null;
    if (saleEnd && oldP > base && base > 0 && saleEnd.end <= nowMs) {
      price = priceInfo_(typeRaw, packsRaw, oldP, oldP, packPrices);
      base = price.t === 'w' ? price.k : price.p;
      if (badge === 'sale') badge = '';
      oldP = 0;
      saleEnd = null;
    }
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
    if (oldP > base && base > 0) {
      p.o = Math.round(oldP * 100) / 100;
      if (!badge) badge = 'sale';
      if (saleEnd) p.e = saleEnd.day;
    }
    if (badge) p.b = badge;
    // «Залишок» (кг для весового товара, штуки для остального): 0 — товара нет; мало — витрина покажет «Залишилось N».
    var left = col.qty >= 0 ? leftQty_(row[col.qty]) : null;
    if (left !== null) {
      if (left <= 0) p.a = 0;
      else if (left <= (price.t === 'w' ? LOW_STOCK_KG : lowPcs)) p.q = left;
    }
    // «Паспорт товара» и подсказка к весу: только то, что написано в таблице.
    var sort = cell_(row, col.sort), harvest = cell_(row, col.harvest), origin = cell_(row, col.origin);
    if (sort) p.ps = sort;
    if (harvest) p.ph = harvest;
    if (origin) p.po = origin;
    var fresh = col.fresh >= 0 ? saleEnd_(row[col.fresh], sheetTz) : null;
    if (fresh && fresh.end - 24 * 3600 * 1000 <= nowMs) {
      p.pf = fresh.day;
      if (freshMs > 0 && nowMs - fresh.end < freshMs) p.f = 1;
    }
    var hint = cell_(row, col.hint), hintRu = cell_(row, col.hintRu);
    if (hint) p.h = hint;
    if (hintRu && hintRu !== hint) p.hr = hintRu;
    products.push(p);
  }
  return products;
}

var LOW_STOCK_PCS = 5;   // «Залишилось N шт» показываем, когда осталось не больше
var LOW_STOCK_KG = 2;    // то же для весового товара, кг
var SIGNAL_DAYS = 30;

/** Значение колонки «Залишок»: число или null, если ячейка пустая. */
function leftQty_(v) {
  if (v === '' || v === null || v === undefined) return null;
  if (typeof v !== 'number' && !/\d/.test(String(v))) return null;
  return Math.round(toNum_(v) * 1000) / 1000;
}

/** «Акція до»: дата из таблицы или текст 15.11.2026 / 2026-11-15 → { day: '2026-11-15', end: мс конца этого дня }. */
function saleEnd_(v, tz) {
  var y, m, d;
  if (Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime())) {
    var parts = Utilities.formatDate(v, tz, 'yyyy-MM-dd').split('-');
    y = +parts[0]; m = +parts[1]; d = +parts[2];
  } else {
    var s = String(v === null || v === undefined ? '' : v).trim();
    var a = s.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})$/);
    var b = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (a) { d = +a[1]; m = +a[2]; y = +a[3]; }
    else if (b) { y = +b[1]; m = +b[2]; d = +b[3]; }
    else return null;
  }
  if (!(y > 2000 && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return null;
  function two(n) { return (n < 10 ? '0' : '') + n; }
  // Конец дня по Киеву (UTC+2/+3): 22:00 UTC — с запасом до часа в пользу покупателя.
  return { day: y + '-' + two(m) + '-' + two(d), end: Date.UTC(y, m - 1, d, 22, 0, 0) };
}

/**
 * Сигналы из листа «Замовлення» за SIGNAL_DAYS дней (без тестовых, отменённых и «немає в наявності»):
 *   n[id] — в скольких заказах был товар; r[id] — с какими товарами его брали вместе (не меньше двух раз).
 */
function orderSignals_(ss) {
  var out = { n: {}, r: {}, w: {} };
  var sheet = ss.getSheetByName(SHEET_ORDERS);
  if (!sheet || sheet.getLastRow() < 2) return out;
  var col = orderCols_(sheet);
  if (col.svc < 0 || col.date < 0) return out;
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  var from = Date.now() - SIGNAL_DAYS * 24 * 3600 * 1000;
  var weekFrom = Date.now() - 7 * 24 * 3600 * 1000;
  var pairs = {};
  values.forEach(function (row) {
    var date = row[col.date];
    if (Object.prototype.toString.call(date) !== '[object Date]' || isNaN(date.getTime()) || date.getTime() < from) return;
    var status = cell_(row, col.status);
    if (cell_(row, col.source).indexOf('test') >= 0 || status === 'немає в наявності' || status === 'скасовано') return;
    var ids = [];
    try {
      (JSON.parse(cell_(row, col.svc) || '{}').i || []).forEach(function (it) {
        var id = String(it[0]);
        if (ids.indexOf(id) < 0) {
          ids.push(id);
          if (date.getTime() >= weekFrom) { var w = out.w[id] || (out.w[id] = [0, 0]); w[0]++; }
        }
        if (date.getTime() >= weekFrom && out.w[id]) out.w[id][1] += Math.max(1, Number(it[2]) || 1);
      });
    } catch (err) { ids = []; }
    ids.forEach(function (a) {
      out.n[a] = (out.n[a] || 0) + 1;
      ids.forEach(function (b) {
        if (a === b) return;
        var m = pairs[a] || (pairs[a] = {});
        m[b] = (m[b] || 0) + 1;
      });
    });
  });
  Object.keys(pairs).forEach(function (a) {
    var list = Object.keys(pairs[a]).filter(function (b) { return pairs[a][b] >= 2; })
      .sort(function (x, y) { return pairs[a][y] - pairs[a][x]; }).slice(0, 4);
    if (list.length) out.r[a] = list;
  });
  return out;
}

/* ============================ Цены и фасовки ============================ */

/**
 * Единственное место, где считаются цены. Этим же кодом сервер будет
 * пересчитывать заказ (этап 3), поэтому витрина и сервер всегда совпадают.
 *
 *   вагова:        v = [[граммы, цена], ...], цена = round(цена_за_кг × граммы / 1000)
 *   упаковка / шт: p = цена за штуку, pk = подпись фасовки («500 г»)
 */
function priceInfo_(typeRaw, packsRaw, pKgRaw, pUnitRaw, packPricesRaw) {
  var type = String(typeRaw || '').trim().toLowerCase();
  if (type.indexOf('ваг') === 0) {
    var k = toNum_(pKgRaw);
    var grams = parsePacks_(packsRaw);
    var v = [];
    if (k > 0) {
      // «Ціни фасувань» (необязательная колонка): своя цена для отдельной фасовки, напр. «1 кг = 360».
      var own = packPricesRaw ? parsePackPrices_(packPricesRaw) : {};
      grams.forEach(function (g) { v.push([g, own[g] > 0 ? own[g] : weightPrice_(k, g)]); });
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
    .addItem('Оновити статистику продажів', 'menuStats')
    .addSeparator()
    .addItem('Повідомити клієнтів про появу товарів', 'menuNotifyStock')
    .addItem('Увімкнути щоденні повідомлення клієнтам', 'menuDailyOn')
    .addItem('Вимкнути щоденні повідомлення клієнтам', 'menuDailyOff')
    .addSeparator()
    .addItem('Етап 8: створити листи й колонки', 'setupStage8')
    .addItem('Етап 8.2: створити листи «Архів товарів» і «Клієнти»', 'setupWave2a')
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
  // ID товара, удалённого навсегда, нельзя давать новому товару: путаются статистика и «Повторити замовлення».
  var gone = deletedIdSet_();
  var reused = listProductsAdmin_().filter(function (p) { return gone[p.id]; }).map(function (p) { return p.id; });
  if (reused.length) {
    lines.push('');
    lines.push('УВАГА. Ці ID вже належали видаленим товарам — дайте товарам інші ID: ' + reused.slice(0, 30).join(', ') + (reused.length > 30 ? ' …' : ''));
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
  source: ['джерело'], svc: ['службове'], ttn: ['ттн']
};
var STATUS_NEW = 'новий';
var STATUS_BY_CODE = { c: 'підтверджено', n: 'немає в наявності', s: 'відправлено', d: 'виконано' };
var PAY_UA = { cash: 'при отриманні', card: 'переказ на картку', cod: 'накладений платіж' };
var MAX_ORDERS_PER_HOUR = 5;
var MAX_TEST_ORDERS_PER_HOUR = 20;
var INIT_DATA_MAX_AGE_SEC = 24 * 3600;

function doPost(e) {
  // Вебхук Telegram (через Cloudflare Worker): ?src=tg&key=<WEBHOOK_SECRET>
  if (e && e.parameter && e.parameter.src === 'tg') return handleTelegramWebhook_(e);
  var out;
  try {
    var text = (e && e.postData && e.postData.contents) || '';
    if (text.length > 1500000) throw new Error('body too large');
    var body = JSON.parse(text || '{}');
    if (body.action !== 'admin.photo' && text.length > 20000) throw new Error('body too large');
    if (body.action === 'order') out = handleOrder_(body);
    else if (body.action === 'orders.my') out = handleMyOrders_(body);
    else if (body.action === 'ev') out = handleEvents_(body);
    else if (body.action === 'notify') out = handleNotify_(body);
    else if (body.action === 'cart') out = handleCart_(body);
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
  o.npType = o.delivery === 'np' && NP_TYPE_UA[body.npType] ? String(body.npType) : (o.delivery === 'np' ? 'branch' : '');
  if (o.npType === 'courier') o.branch = clean_(body.branch, 120);
  o.point = '';
  if (o.delivery === 'pickup') { o.city = ''; o.branch = ''; if (o.pay === 'cod') o.pay = 'cash'; }
  if (o.name.length < 2 || !/^\+\d{10,15}$/.test(o.phone) ||
      (o.delivery === 'np' && (o.city.length < 2 || !o.branch || (o.npType === 'courier' && o.branch.length < 5)))) {
    return { ok: false, error: 'bad_form' };
  }
  if (!Array.isArray(body.items) || !body.items.length || body.items.length > 50) return { ok: false, error: 'bad_form' };
  var shop = readShop_();
  if (shop.pay.indexOf(o.pay) < 0) return { ok: false, error: 'bad_form' };
  // Самовывоз: точка из листа «Точки» (старая витрина точку не присылает — тогда берём первую).
  if (o.delivery === 'pickup' && shop.points && shop.points.length) {
    var point = shop.points[0];
    shop.points.forEach(function (p) { if (p.id === String(body.point || '')) point = p; });
    o.point = point.ua;
  }

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
  var compact = []; // [id, граммы, количество] — по этому «Повторить заказ» собирает корзину заново
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
    compact.push([id, g, q]);
    total += price * q;
  });
  if (bad || Number(body.total) !== total) return { ok: false, error: 'changed' };
  if (shop.min > 0 && total < shop.min) return { ok: false, error: 'min_order', min: shop.min };
  // Подарки: от суммы заказа (сразу) и постоянному клиенту (считаем ниже, под блокировкой).
  var gifts = [];
  if (shop.gift && total >= shop.gift.from) gifts.push(shop.gift);

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
    if (shop.loyal && o.uid && !isTest) {
      var doneBefore = completedOrders_(sheet, col, o.uid);
      if ((doneBefore + 1) % shop.loyal.every === 0) gifts.push(shop.loyal);
    }
    o.gifts = gifts.map(function (x) { return x.ua; });
    o.giftsClient = gifts.map(function (x) { return o.lang === 'ru' ? x.ru : x.ua; });
    var svc = { i: compact };
    if (o.gifts.length) svc.g = o.gifts;
    o.num = nextOrderNumber_(sheet, col);
    var row = [];
    for (var i = 0; i < sheet.getLastColumn(); i++) row.push('');
    function put(key, value) { if (col[key] >= 0) row[col[key]] = value; }
    put('num', o.num); put('date', new Date()); put('status', o.status);
    put('uid', o.uid); put('username', safeCell_(o.username)); put('name', safeCell_(o.name));
    put('phone', '\'' + o.phone);
    put('delivery', safeCell_(deliveryCell_(o)));
    put('city', safeCell_(o.city)); put('branch', safeCell_(o.branch));
    put('pay', PAY_UA[o.pay]); put('comment', safeCell_(o.comment));
    put('items', safeCell_(o.items)); put('total', o.total); put('lang', o.lang); put('source', o.source);
    put('svc', JSON.stringify(svc));
    sheet.appendRow(row);
    rowIndex = sheet.getLastRow();
    SpreadsheetApp.flush();
    if (rid) cache.put('rid_' + rid, o.num, 21600);
    if (o.uid) { try { clearCart_(o.uid); } catch (err) { console.warn('cart: ' + err); } }
    // Колонка «Залишок» (если она есть и заполнена) уменьшается сама. Сбой здесь заказ не отменяет.
    if (!isTest) {
      try { takeFromStock_(compact); } catch (err) { console.error('stock: ' + (err && err.stack || err)); }
    }
  } finally {
    lock.releaseLock();
  }

  // 6. Уведомления. Заказ уже записан: сбой Telegram не должен его отменять.
  try {
    var sent = [];
    orderNotifyIds_(props).forEach(function (chatId) {
      var res = tg_(token, 'sendMessage', {
        chat_id: chatId, text: adminText_(o, ''), parse_mode: 'HTML',
        disable_web_page_preview: true, reply_markup: adminKeyboard_(o.num)
      });
      if (res.ok) sent.push([chatId, res.result.message_id]);
      else console.error('Не доставлено админу ' + chatId + ': ' + res.description);
    });
    var sheet2 = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ORDERS);
    var col2 = orderCols_(sheet2);
    if (col2.svc >= 0 && sent.length) {
      svc.m = sent;
      sheet2.getRange(rowIndex, col2.svc + 1).setValue(JSON.stringify(svc));
    }
    if (o.uid && !isTest) {
      tg_(token, 'sendMessage', { chat_id: o.uid, text: clientText_('new', o) });
    }
  } catch (err) {
    console.error('notify: ' + (err && err.stack || err));
  }
  return { ok: true, number: o.num, gifts: o.giftsClient };
}

/** Сколько заказов этого клиента уже выполнено (статус «виконано», без тестовых). */
function completedOrders_(sheet, col, uid) {
  if (col.uid < 0 || sheet.getLastRow() < 2) return 0;
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  var n = 0;
  values.forEach(function (row) {
    if (String(row[col.uid]).trim() !== String(uid)) return;
    if (cell_(row, col.source).indexOf('test') >= 0) return;
    if (cell_(row, col.status) === 'виконано') n++;
  });
  return n;
}

/**
 * Уменьшает «Залишок» у заказанных товаров: кг для весовых, штуки для остальных.
 * Работает только там, где в ячейке уже стоит число. Дошло до нуля — «Наявність» становится «немає».
 */
function takeFromStock_(compact) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_PRODUCTS);
  if (!sheet) return;
  var col = productCols_(sheet);
  if (col.qty < 0) return;
  var values = sheet.getDataRange().getValues();
  var rowById = {};
  for (var r = 1; r < values.length; r++) rowById[cell_(values[r], col.id)] = r;
  var changed = false;
  compact.forEach(function (it) {
    var r = rowById[String(it[0])];
    if (r === undefined) return;
    var left = leftQty_(values[r][col.qty]);
    if (left === null) return;
    var g = Number(it[1]) || 0, q = Number(it[2]) || 0;
    var next = Math.max(0, Math.round((left - (g > 0 ? g * q / 1000 : q)) * 1000) / 1000);
    values[r][col.qty] = next;
    sheet.getRange(r + 1, col.qty + 1).setValue(next);
    if (next <= 0) sheet.getRange(r + 1, col.stock + 1).setValue('немає');
    changed = true;
  });
  if (changed) { SpreadsheetApp.flush(); clearCatalogCache_(); }
}

/** «Мої замовлення»: последние заказы этого клиента. Кто спрашивает — определяется только по подписи Telegram. */
function handleMyOrders_(body) {
  var token = PropertiesService.getScriptProperties().getProperty('BOT_TOKEN');
  if (!token) return { ok: false, error: 'not_configured' };
  var user = body.initData ? verifyInitData_(String(body.initData), token) : null;
  if (!user) return { ok: false, error: 'bad_auth' };
  var uid = String(user.id);
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ORDERS);
  if (!sheet || sheet.getLastRow() < 2) return { ok: true, orders: [] };
  var col = orderCols_(sheet);
  if (col.uid < 0) return { ok: true, orders: [] };
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  var orders = [];
  var done = 0; // выполненные заказы за всё время — для программы «постійний клієнт»
  for (var r = values.length - 1; r >= 0; r--) {
    var row = values[r];
    if (String(row[col.uid]).trim() !== uid || !cell_(row, col.num)) continue;
    if (cell_(row, col.source).indexOf('test') >= 0) continue;
    if (cell_(row, col.status) === 'виконано') done++;
    if (orders.length >= 20) continue;
    var date = col.date >= 0 ? row[col.date] : '';
    var isDate = Object.prototype.toString.call(date) === '[object Date]' && !isNaN(date.getTime());
    var again = null;
    try {
      var svc = JSON.parse(cell_(row, col.svc) || '{}');
      if (Array.isArray(svc.i) && svc.i.length) again = svc.i;
    } catch (err) { again = null; }
    var delivery = cell_(row, col.delivery);
    orders.push({
      num: cell_(row, col.num),
      date: isDate ? Utilities.formatDate(date, 'Europe/Kiev', 'dd.MM.yyyy HH:mm') : '',
      status: cell_(row, col.status) || STATUS_NEW,
      items: cell_(row, col.items),
      total: toNum_(col.total >= 0 ? row[col.total] : 0),
      delivery: delivery.toLowerCase().indexOf('пошта') >= 0 ? 'np' : 'pickup',
      i: again, ttn: svcTtn_(cell_(row, col.svc)), dl: delivery, city: cell_(row, col.city), branch: cell_(row, col.branch)
    });
  }
  return { ok: true, orders: orders, done: done };
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
        lang: get('lang') === 'ru' ? 'ru' : 'ua', source: get('source'), svc: get('svc'),
        npType: parseDelivery_(delivery).npType, point: parseDelivery_(delivery).point
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
    '🚚 ' + escHtml_(deliveryLine_(o)),
    '💳 ' + PAY_UA[o.pay],
    ''
  ];
  String(o.items).split('; ').forEach(function (s) { if (s) lines.push('• ' + escHtml_(s)); });
  lines.push('');
  lines.push('<b>Разом: ' + o.total + ' ₴</b>');
  var gifts = o.gifts;
  if (!gifts) { try { gifts = JSON.parse(o.svc || '{}').g || []; } catch (err) { gifts = []; } }
  gifts.forEach(function (g) { lines.push('🎁 Подарунок до замовлення: ' + escHtml_(g)); });
  var ttn = o.ttn || svcTtn_(o.svc);
  if (ttn) lines.push('📮 ТТН: ' + escHtml_(ttn));
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
    var giftLine = o.giftsClient && o.giftsClient.length
      ? '\n🎁 ' + (ru ? 'Подарок к заказу: ' : 'Подарунок до замовлення: ') + o.giftsClient.join('; ')
      : '';
    return ru
      ? '🧾 Заказ ' + n + ' принят. Сумма: ' + o.total + ' ₴.\n' + st.confirm_ru + giftLine
      : '🧾 Замовлення ' + n + ' прийнято. Сума: ' + o.total + ' ₴.\n' + st.confirm_ua + giftLine;
  }
  if (kind === 'c') {
    var t = ru ? '✅ Заказ ' + n + ' подтверждён.' : '✅ Замовлення ' + n + ' підтверджено.';
    if (o.pay === 'card') t += ru ? '\nРеквизиты для оплаты пришлём отдельным сообщением.' : '\nРеквізити для оплати надішлемо окремим повідомленням.';
    if (o.delivery === 'np') t += ru ? '\nСообщим, когда отправим Новой почтой.' : '\nПовідомимо, коли відправимо Новою поштою.';
    else t += pickupText_(o, ru, shop);
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
 * Если включён вебхук (Script Property USE_WEBHOOK = 'true'), функция сразу выходит: update приходят в doPost (?src=tg).
 */
function pollUpdates() {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('USE_WEBHOOK') === 'true') return; // обновления приходят через вебхук (doPost), опрос не нужен
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
  var admins = adminIds_(props);
  data.result.forEach(function (u) {
    offset = u.update_id + 1;
    handleUpdate_(u, token, props, admins);
  });
  props.setProperty('TG_OFFSET', String(offset));
}

/** Общая обработка одного update (и для pollUpdates, и для вебхука): дедупликация + сообщения и кнопки. */
function handleUpdate_(u, token, props, admins) {
  if (!u || u.update_id === undefined || u.update_id === null) return;
  if (isDuplicateUpdate_(u.update_id)) return; // защита от повторной обработки
  try {
    if (u.callback_query) handleCallback_(u.callback_query, token, admins);
    else if (u.message) handleMessage_(u.message, token, props);
  } catch (err) {
    console.error('update ' + u.update_id + ': ' + (err && err.stack || err));
  }
}

/** true, если update_id уже обрабатывался (CacheService, 6 ч). Блокировка — чтобы два параллельных запроса не прошли оба. */
function isDuplicateUpdate_(updateId) {
  var cache = CacheService.getScriptCache();
  var key = 'upd_' + updateId;
  var lock = LockService.getScriptLock();
  var locked = false;
  try { lock.waitLock(5000); locked = true; } catch (err) { /* без блокировки — лучше, чем потерять update */ }
  try {
    if (cache.get(key)) return true;
    cache.put(key, '1', 21600);
    return false;
  } finally {
    if (locked) lock.releaseLock();
  }
}

/** Приём update от Telegram через Cloudflare Worker. Всегда отвечает быстро и без исключений. */
function handleTelegramWebhook_(e) {
  var props = PropertiesService.getScriptProperties();
  var secret = props.getProperty('WEBHOOK_SECRET');
  var given = (e.parameter && e.parameter.key) || '';
  if (!secret || given !== secret) return ContentService.createTextOutput('forbidden');
  try {
    var update = JSON.parse((e.postData && e.postData.contents) || '{}');
    var token = props.getProperty('BOT_TOKEN');
    if (!token) {
      console.error('webhook: BOT_TOKEN не задан');
    } else {
      handleUpdate_(update, token, props, adminIds_(props));
    }
  } catch (err) {
    console.error('webhook: ' + (err && err.stack || err));
  }
  return ContentService.createTextOutput('ok');
}

function handleMessage_(msg, token, props) {
  if (!msg.chat) return;
  // Админ прислал боту видеокружок или фото — отвечаем его file_id (нужен для настроек приветствия).
  if (msg.chat.type === 'private' && (msg.video_note || (msg.photo && msg.photo.length)) && adminAccess_(msg.chat.id, props)) {
    var fileId = msg.video_note ? msg.video_note.file_id : msg.photo[msg.photo.length - 1].file_id;
    tg_(token, 'sendMessage', { chat_id: msg.chat.id, parse_mode: 'HTML',
      text: (msg.video_note ? 'file_id відеокружка' : 'file_id фото') + ':\n<code>' + escHtml_(fileId) + '</code>\n\n' +
        'Натисніть на код, щоб скопіювати, і вставте в адмін-панелі → Налаштування → ' +
        (msg.video_note ? '«Відеокружок перед привітанням».' : '«Фото у привітанні бота».') });
    return;
  }
  if (handleMessage8_(msg, token, props)) return; // номер ТТН от админа, текст и фото отзыва от клиента
  if (typeof msg.text !== 'string') return; // контакт, служебные сообщения — молчим
  var text = msg.text.trim();
  if (/^\/id(@\w+)?$/i.test(text)) {
    tg_(token, 'sendMessage', { chat_id: msg.chat.id, text: 'Ваш chat id: ' + msg.chat.id });
    return;
  }
  if (msg.chat.type !== 'private') return;
  var webappUrl = props.getProperty('WEBAPP_URL');
  if (/^\/admin(@\w+)?$/i.test(text) && adminAccess_(msg.chat.id, props) && /^https:\/\//.test(webappUrl || '')) {
    tg_(token, 'sendMessage', {
      chat_id: msg.chat.id, text: 'Адмін-панель PAMIR: замовлення та товари.',
      reply_markup: { inline_keyboard: [[{ text: '🛠 Відкрити адмін-панель', web_app: { url: appUrl_(webappUrl, 'admin=1') } }]] }
    });
    return;
  }
  var ru = String((msg.from && msg.from.language_code) || '').toLowerCase().indexOf('ru') === 0;
  // Параметр /start: adm_… — приглашение админа, ref_… — рефералка (волна 2), иначе ID товара.
  var deep = text.match(/^\/start(?:@\w+)?\s+([A-Za-zА-Яа-яІЇЄҐіїєґ0-9_-]{1,40})$/);
  if (deep && /^adm_[0-9a-f]{8,32}$/i.test(deep[1])) {
    handleAdminInvite_(msg, deep[1].slice(4).toLowerCase(), token, props);
    return;
  }
  // Ссылка на товар: t.me/<бот>?start=DRY-039 → кнопка, которая открывает магазин сразу на этом товаре.
  if (deep && !/^ref_/i.test(deep[1]) && /^https:\/\//.test(webappUrl || '')) {
    var item = null;
    try {
      JSON.parse(getCatalogJson_()).products.forEach(function (p) { if (p.id.toLowerCase() === deep[1].toLowerCase()) item = p; });
    } catch (err) { console.error('deep link: ' + err); }
    if (item) {
      tg_(token, 'sendMessage', {
        chat_id: msg.chat.id, text: (ru && item.ru) || item.ua,
        reply_markup: { inline_keyboard: [[{ text: ru ? '🛒 Открыть товар' : '🛒 Відкрити товар',
          web_app: { url: appUrl_(webappUrl, 'p=' + encodeURIComponent(item.id)) } }]] }
      });
      return;
    }
  }
  sendWelcome_(msg, token, props, ru);
}

/** Нажатие кнопки под заказом: меняем статус, обновляем сообщения админов, пишем клиенту. */
function handleCallback_(cq, token, admins) {
  function answer(text) { tg_(token, 'answerCallbackQuery', { callback_query_id: cq.id, text: text || '' }); }
  var fromId = String(cq.from && cq.from.id);
  var chatId = cq.message && cq.message.chat ? String(cq.message.chat.id) : '';
  if (cq.data === 'nr') { // клиент отказался от напоминаний
    stopReminders_(fromId);
    var ruUser = String((cq.from && cq.from.language_code) || '').toLowerCase().indexOf('ru') === 0;
    answer(ruUser ? 'Больше не напоминаем' : 'Більше не нагадуємо');
    if (cq.message) tg_(token, 'editMessageReplyMarkup', { chat_id: chatId, message_id: cq.message.message_id, reply_markup: { inline_keyboard: [] } });
    return;
  }
  var props = PropertiesService.getScriptProperties();
  if (handleCallback8_(cq, token, props, answer)) return; // отзывы, брошенная корзина, ТТН
  var menu = String(cq.data || '').match(/^m:(pts|apr|biz)$/);
  if (menu) { // кнопки под приветствием — для всех
    answer('');
    handleMenuCallback_(cq, menu[1], token, props);
    return;
  }
  var inv = String(cq.data || '').match(/^ai:([0-9a-f]{8,32}):([yn])$/);
  if (inv) { answer(resolveAdminInvite_(cq, inv[1], inv[2] === 'y', token, props)); return; }
  // Права проверяются при каждом нажатии: по тому, кто нажал (или по чату, если это чат из ADMIN_CHAT_IDS).
  var me = adminAccess_(fromId, props) || adminAccess_(chatId, props);
  if (!me) { answer('Немає доступу'); return; }
  var m = String(cq.data || '').match(/^st:(P-\d+):([cnsd])$/);
  if (!m) { answer(''); return; }
  if (!me.perms.st) { answer('У вас немає права змінювати статуси замовлень'); return; }
  actor_ = { id: fromId, name: clean_((cq.from && cq.from.first_name) || me.name || '', 60) };
  var res = setOrderStatus_(m[1], m[2], (cq.from && cq.from.first_name) || '', token, cq.message ? [chatId, cq.message.message_id] : null);
  if (res.error === 'not_found') answer('Замовлення ' + m[1] + ' не знайдено в таблиці');
  else if (res.same) answer('Статус уже: ' + res.status);
  else answer('Статус: ' + res.status + (res.told === false ? '. Клієнту написати не вдалося' : ''));
  // Отправили Новой почтой — сразу спрашиваем номер накладной.
  if (m[2] === 's' && res.ok && !res.same && res.np && !res.ttn && chatId) askTtn_(token, chatId, fromId, m[1]);
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
    if (code === 'd' && found.col.svc >= 0) { // когда заказ выполнен — от этого времени считаем просьбу об отзыве
      try {
        var sv = JSON.parse(found.o.svc || '{}') || {};
        if (!sv.dn) { sv.dn = Date.now(); found.o.svc = JSON.stringify(sv); found.sheet.getRange(found.rowIndex, found.col.svc + 1).setValue(found.o.svc); }
      } catch (err) { /* служебная ячейка испорчена — отзыв просто не попросим */ }
    }
    SpreadsheetApp.flush();
    logAction_('Замовлення: статус', num, found.o.status, status);
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
    var msg = { chat_id: o.uid, text: clientText_(code, o) };
    var webapp = PropertiesService.getScriptProperties().getProperty('WEBAPP_URL');
    if (code === 'd' && /^https:\/\//.test(webapp || '')) {
      msg.reply_markup = { inline_keyboard: [[{ text: o.lang === 'ru' ? '🔁 Повторить заказ' : '🔁 Повторити замовлення',
        web_app: { url: webapp + (webapp.indexOf('?') < 0 ? '?' : '&') + 'view=orders' } }]] };
    }
    told = !!tg_(token, 'sendMessage', msg).ok;
  }
  return { ok: true, status: status, told: told, np: o.delivery === 'np', ttn: svcTtn_(o.svc) };
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
  if (PropertiesService.getScriptProperties().getProperty('USE_WEBHOOK') === 'true') {
    throw new Error('Включён webhook (USE_WEBHOOK = true). startPolling удалил бы его, и бот замолчал бы. Если опрос действительно нужен, сначала удалите свойство USE_WEBHOOK.');
  }
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
  console.log('Владелец (OWNER_CHAT_ID): ' + (props.getProperty('OWNER_CHAT_ID') || 'не задан — владельцем считается первый id из ADMIN_CHAT_IDS: ' + (ownerId_(props) || 'нет')));
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

  // Если события идут через webhook (Cloudflare Worker), опрос включать нельзя: он удалит webhook и бот замолчит.
  if (props.getProperty('USE_WEBHOOK') === 'true') {
    ensureOrdersSheet_();
    console.log('Webhook включён (USE_WEBHOOK = true): опрос не трогаем.');
  } else {
    startPolling();
  }

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
  adminList_(props).filter(function (x) { return x.active; }).map(function (x) { return x.id; }).forEach(function (id) {
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
  var me = user ? adminAccess_(user.id, props) : null;
  if (!me) return { ok: false, error: 'forbidden' };
  actor_ = { id: String(user.id), name: clean_((user.first_name || '') + (user.username ? ' @' + user.username : ''), 60) || me.name || ROLE_UA[me.role] };
  var mine = { role: me.role, perms: Object.keys(me.perms) };
  /** Нет права — отказ. Витрина прячет такие кнопки, но решает всегда сервер. */
  function deny(perm) { return me.perms[perm] ? null : { ok: false, error: 'no_perm', need: perm }; }
  var a = body.action;
  var no;

  if (a === 'admin.me') return { ok: true, me: mine, permList: PERMS };
  if (a === 'admin.orders') { // просмотр заказов есть у каждого админа
    var orders = listOrders_();
    if (!me.perms.stats) orders.stats = null;
    orders.me = mine;
    return orders;
  }
  if (a === 'admin.status') {
    return deny('st') || setOrderStatus_(String(body.num || ''), String(body.code || ''), user.first_name || '', token, null);
  }
  if (a === 'admin.products') return { ok: true, products: listProductsAdmin_(), categories: listCategoriesAdmin_(), me: mine };
  if (a === 'admin.product') {
    var patch = body.patch || {};
    no = null;
    Object.keys(patch).forEach(function (k) { if (!no && PATCH_PERM[k]) no = deny(PATCH_PERM[k]); });
    return no || updateProduct_(String(body.id || ''), patch, false);
  }
  if (a === 'admin.productAdd') return deny('text') || deny('price') || deny('stock') || updateProduct_('', body.patch || {}, true);
  if (a === 'admin.photo') return deny('photo') || savePhoto_(String(body.id || ''), String(body.data || ''));
  if (a === 'admin.category') return deny('cats') || saveCategory_(body.category || {});
  // Волна 2а: архив товаров, удаление категорий и админов. Права проверяются здесь, при каждом запросе.
  if (a === 'admin.archiveList') return deny('text') || listArchive_();
  if (a === 'admin.archive') return deny('text') || archiveProduct_(String(body.id || ''));
  if (a === 'admin.restore') return deny('text') || restoreProduct_(String(body.id || ''));
  if (a === 'admin.purge') { // удалить навсегда может только полный админ или владелец
    if (me.role !== 'owner' && me.role !== 'admin') return { ok: false, error: 'no_perm', need: 'full' };
    return purgeProduct_(String(body.id || ''));
  }
  if (a === 'admin.categoryDelete') return deny('cats') || deleteCategory_(body.code, body.moveTo);
  if (a === 'admin.adminDelete') return deny('admins') || deleteAdmin_(me, body, props, token);
  if (a === 'admin.stats') return deny('stats') || salesStats_(true);
  if (a === 'admin.settings') return deny('settings') || { ok: true, fields: settingsFields_() };
  if (a === 'admin.settingsSave') return deny('settings') || saveSettings_(body.values || {});
  if (a === 'admin.admins') return deny('admins') || listAdmins_(props);
  if (a === 'admin.adminInvite') return deny('admins') || inviteAdmin_(me, body, props);
  if (a === 'admin.adminSave') return deny('admins') || saveAdmin_(me, body, props, token);
  if (a === 'admin.log') return deny('admins') || listLog_();
  if (a === 'admin.ttn') return deny('st') || setTtn_(String(body.num || ''), String(body.ttn || ''), token);
  if (a === 'admin.reviews') return deny('reviews') || listReviews_();
  if (a === 'admin.review') return deny('reviews') || moderateReview_(String(body.id || ''), body.ok === true, token);
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
        items: cell_(row, col.items), total: total, test: source.indexOf('test') >= 0, ttn: svcTtn_(cell_(row, col.svc))
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
    wh: toNum_(col.whPrice >= 0 ? row[col.whPrice] : 0), wm: cell_(row, col.whMin),
    badge: badgeCode_(cell_(row, col.badge)), old: toNum_(col.oldPrice >= 0 ? row[col.oldPrice] : 0),
    qty: (function () { var q = col.qty >= 0 ? leftQty_(row[col.qty]) : null; return q === null ? '' : String(q).replace('.', ','); })(),
    end: (function () { var e = col.saleEnd >= 0 ? saleEnd_(row[col.saleEnd], 'Europe/Kiev') : null; return e ? e.day : ''; })()
  };
}

/** Товары для админ-панели: только те же клиентские колонки, служебные (закупка, маржа) не читаются. */
function listProductsAdmin_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_PRODUCTS);
  var col = productCols_(sheet);
  var values = sheet.getDataRange().getValues();
  var list = [];
  var gone = deletedIdSet_();
  for (var r = 1; r < values.length; r++) {
    var p = adminProduct_(values[r], col);
    if (!p.id || !p.ua) continue;
    if (gone[p.id]) p.reused = 1; // такой ID уже был у товара, удалённого навсегда
    list.push(p);
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
    if (patch.old !== undefined && !(Number(patch.old) >= 0 && Number(patch.old) < 1000000)) return { ok: false, error: 'bad_form' };
    if (patch.badge !== undefined && patch.badge !== '' && !BADGE_UA[patch.badge]) return { ok: false, error: 'bad_form' };
    if (patch.qty !== undefined && patch.qty !== '' && !(toNum_(patch.qty) >= 0 && toNum_(patch.qty) < 100000)) return { ok: false, error: 'bad_form' };
    if (patch.end !== undefined && patch.end !== '' && !saleEnd_(patch.end, 'Europe/Kiev')) return { ok: false, error: 'bad_form' };
    if (typeof patch.ua === 'string' && !clean_(patch.ua, 120)) return { ok: false, error: 'bad_form' };
    if (typeof patch.img === 'string' && patch.img && !/^https:\/\//i.test(patch.img)) return { ok: false, error: 'bad_form' };

    var r = -1;
    var beforeLog = null;
    if (create) {
      if (!cat || !patch.t || typeof patch.ua !== 'string') return { ok: false, error: 'bad_form' };
      var prefix = /^[A-Z0-9]{2,6}$/.test(cat.code) ? cat.code : 'PRD';
      var max = 0;
      for (var k = 1; k < values.length; k++) {
        var m = cell_(values[k], col.id).match(/^([A-Z0-9]+)-(\d+)$/);
        if (m && m[1] === prefix) max = Math.max(max, parseInt(m[2], 10));
      }
      max = Math.max(max, reservedIdMax_(prefix)); // номера архивных и удалённых навсегда товаров заново не выдаются
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
      beforeLog = adminProduct_(values[r], col);
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
    // Колонки, которых в таблице ещё нет, добавляются в конец при первой записи.
    function ensureCol(key, title) {
      if (col[key] < 0) {
        col[key] = sheet.getLastColumn();
        sheet.getRange(1, col[key] + 1).setValue(title);
      }
    }
    if (patch.hidden !== undefined) {
      ensureCol('hidden', 'Приховати з вітрини');
      set(col.hidden, patch.hidden ? 'так' : '');
    }
    if (patch.badge !== undefined && (patch.badge || col.badge >= 0)) {
      ensureCol('badge', 'Бейдж');
      set(col.badge, BADGE_UA[patch.badge] || '');
    }
    if (patch.old !== undefined && (Number(patch.old) > 0 || col.oldPrice >= 0)) {
      ensureCol('oldPrice', 'Стара ціна');
      set(col.oldPrice, Number(patch.old) > 0 ? Math.round(Number(patch.old) * 100) / 100 : '');
    }
    if (patch.qty !== undefined && (patch.qty !== '' || col.qty >= 0)) {
      ensureCol('qty', 'Залишок');
      set(col.qty, patch.qty === '' ? '' : Math.round(toNum_(patch.qty) * 1000) / 1000);
    }
    if (patch.end !== undefined && (patch.end !== '' || col.saleEnd >= 0)) {
      ensureCol('saleEnd', 'Акція до');
      // Текстом ДД.ММ.РРРР: так дата не зависит от часового пояса таблицы.
      set(col.saleEnd, patch.end === '' ? '' : '\'' + saleEnd_(patch.end, 'Europe/Kiev').day.split('-').reverse().join('.'));
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
    var result = { ok: true, product: adminProduct_(fresh, col) };
    if (actor_) logProductDiff_(beforeLog, result.product);
  } finally {
    lock.releaseLock();
  }
  // Товар снова в наличии — пишем тем, кто просил сообщить. Сбой рассылки правку не отменяет.
  if (patch.stock === true || patch.stock === 1) {
    try { notifyBackInStock_(); } catch (err) { console.error('back in stock: ' + (err && err.stack || err)); }
  }
  return result;
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

var CATEGORY_ICONS = ['nut', 'cherry', 'candy', 'flame', 'leaf', 'coffee', 'sweet', 'set'];

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
    logAction_(c.isNew ? 'Категорія: додано' : 'Категорія: зміна', code, oldUa, ua + ' / ' + ru + ' · №' + order + (icon ? ' · ' + icon : ''));
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
  ['feature_id', 'Блок угорі каталогу: ID товару (наприклад DRY-039). Порожньо — без блоку', ''],
  ['feature_title_ua', 'Блок угорі каталогу: заголовок (UA)', 'Наша курага'],
  ['feature_title_ru', 'Блок вверху каталога: заголовок (RU)', 'Наша курага'],
  ['feature_text_ua', 'Блок угорі каталогу: текст (UA)', 'З нашого родинного саду в Ісфарі, Таджикистан.'],
  ['feature_text_ru', 'Блок вверху каталога: текст (RU)', 'Из нашего семейного сада в Исфаре, Таджикистан.'],
  ['greeting_ua', 'Привітання бота (UA). {name} — ім’я клієнта', 'Вітаємо, {name}! Це PAMIR — наша родинна справа на Центральному ринку Харкова: горіхи, сухофрукти та східні солодощі.\nНаша гордість — курага з власного саду в Ісфарі.\nВідкрийте магазин, зберіть кошик, а ми підтвердимо замовлення тут, у чаті.'],
  ['greeting_ru', 'Приветствие бота (RU). {name} — имя клиента', 'Здравствуйте, {name}! Это PAMIR — наше семейное дело на Центральном рынке Харькова: орехи, сухофрукты и восточные сладости.\nНаша гордость — курага из собственного сада в Исфаре.\nОткройте магазин, соберите корзину, а мы подтвердим заказ здесь, в чате.'],
  ['greeting_back_ua', 'Привітання для клієнта, який уже замовляв (UA). {name} — ім’я', 'З поверненням, {name}! Раді бачити вас знову.\nЗвичне замовлення можна повторити в один дотик.'],
  ['greeting_back_ru', 'Приветствие для клиента, который уже заказывал (RU). {name} — имя', 'С возвращением, {name}! Рады видеть вас снова.\nПривычный заказ можно повторить в одно касание.'],
  ['welcome_photo', 'Фото у привітанні бота: посилання https:// або file_id (надішліть фото боту — він відповість кодом). Порожньо — картинка PAMIR', ''],
  ['welcome_video_note', 'Відеокружок перед привітанням: file_id (надішліть кружок боту — він відповість кодом). Порожньо — без кружка', ''],
  ['contact', 'Кнопка «Написати нам»: @username або номер +380… Порожньо — кнопки немає', ''],
  ['biz_soon_ua', 'Текст кнопки «Для бізнесу (опт)» у боті (UA)', 'Працюємо з кафе, магазинами та офісами. Форма заявки з’явиться зовсім скоро, а поки напишіть нам — обговоримо умови.'],
  ['biz_soon_ru', 'Текст кнопки «Для бизнеса (опт)» в боте (RU)', 'Работаем с кафе, магазинами и офисами. Форма заявки появится совсем скоро, а пока напишите нам — обсудим условия.'],
  ['confirm_ua', 'Текст клієнту після прийняття замовлення (UA)', 'Ми підтвердимо наявність і напишемо вам сюди.'],
  ['confirm_ru', 'Текст клиенту после принятия заказа (RU)', 'Мы подтвердим наличие и напишем вам сюда.'],
  ['gift_from', 'Подарунок від суми замовлення, ₴ (0 — вимкнено)', '0'],
  ['gift_text_ua', 'Подарунок від суми: що саме даруємо (UA), наприклад «100 г кураги»', ''],
  ['gift_text_ru', 'Подарок от суммы: что именно дарим (RU)', ''],
  ['loyal_every', 'Постійний клієнт: подарунок до кожного N-го замовлення (0 — вимкнено, мінімум 2)', '0'],
  ['loyal_text_ua', 'Постійний клієнт: що даруємо (UA)', ''],
  ['loyal_text_ru', 'Постоянный клиент: что дарим (RU)', ''],
  ['remind_days', 'Нагадати про повторне замовлення через N днів після виконаного (0 — вимкнено, мінімум 7)', '0'],
  ['remind_text_ua', 'Текст нагадування (UA)', 'Вітаємо! Запаси горіхів і сухофруктів, мабуть, закінчуються. Попереднє замовлення можна повторити в один дотик.'],
  ['low_stock', '«Залишилось N шт»: показувати, коли залишок не більший за це число (для вагових — 2 кг)', '5'],
  ['fresh_days', 'Бейдж «Свіжа поставка»: скільки днів після дати з колонки «Свіжа поставка» (0 — вимкнено)', '14'],
  ['review_days', 'Попросити відгук через N днів після статусу «виконано» (0 — вимкнено)', '2'],
  ['cart_remind_hours', 'Нагадати про покинутий кошик через N годин (0 — вимкнено)', '3'],
  ['theme', 'Сезонна тема вітрини: порожньо — звичайна, newyear — Новий рік, navruz — Весна/Навруз', ''],
  ['story_title_ua', 'Сторінка «Від саду до столу»: заголовок (UA)', 'Від саду до столу'],
  ['story_title_ru', 'Страница «От сада до стола»: заголовок (RU)', 'От сада до стола'],
  ['story_text_ua', 'Сторінка «Від саду до столу»: текст (UA), кожен абзац з нового рядка. Порожньо — сторінки немає', 'Наш сад — в Ісфарі, на півночі Таджикистану. Тут наша родина вирощує абрикоси.\nКоли абрикоси достигають, ми збираємо врожай і сушимо його — так виходить курага.\nКурагу привозимо до Харкова, на Центральний ринок. Тут ми зустрічаємо покупців на наших точках.\nЗапитуйте про сад і курагу — розповімо з радістю.'],
  ['story_text_ru', 'Страница «От сада до стола»: текст (RU), каждый абзац с новой строки', 'Наш сад — в Исфаре, на севере Таджикистана. Здесь наша семья выращивает абрикосы.\nКогда абрикосы созревают, мы собираем урожай и сушим его — так получается курага.\nКурагу привозим в Харьков, на Центральный рынок. Здесь мы встречаем покупателей на наших точках.\nСпрашивайте про сад и курагу — расскажем с радостью.'],
  ['story_photos', 'Сторінка «Від саду до столу»: посилання на фото (https://…), кожне з нового рядка', ''],
  ['remind_text_ru', 'Текст напоминания (RU)', 'Здравствуйте! Запасы орехов и сухофруктов, наверное, заканчиваются. Прошлый заказ можно повторить в одно касание.']
];
var SETTINGS_NUM = { min_order: 100000, gift_from: 100000, loyal_every: 100, remind_days: 365, low_stock: 1000, fresh_days: 365, review_days: 60, cart_remind_hours: 72 };
var SETTINGS_MAY_BE_EMPTY = ['notice_ua', 'notice_ru', 'feature_id', 'gift_text_ua', 'gift_text_ru', 'loyal_text_ua', 'loyal_text_ru',
  'welcome_photo', 'welcome_video_note', 'contact', 'theme', 'story_text_ua', 'story_text_ru', 'story_photos'];
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
  SETTINGS_DEF.forEach(function (d) { if (!out[d[0]] && SETTINGS_MAY_BE_EMPTY.indexOf(d[0]) < 0) out[d[0]] = d[2]; });
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
    else if (SETTINGS_NUM[k]) next[k] = String(Math.max(0, Math.min(SETTINGS_NUM[k], Math.round(toNum_(values[k])))));
    else if (k === 'feature_id') next[k] = clean_(values[k], 20).toUpperCase().replace(/[^A-ZА-ЯІЇЄҐ0-9-]/g, '');
    else if (k === 'theme') next[k] = /^(newyear|navruz)$/.test(String(values[k]).trim().toLowerCase()) ? String(values[k]).trim().toLowerCase() : '';
    else next[k] = multiline_(values[k], k.indexOf('story_') === 0 ? 3000 : 500);
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
    SETTINGS_DEF.forEach(function (d) {
      if (String(current[d[0]]) !== String(next[d[0]])) logAction_('Налаштування', d[0], current[d[0]], next[d[0]]);
    });
  } finally {
    lock.releaseLock();
  }
  settingsMemo_ = null;
  clearCatalogCache_();
  return { ok: true, fields: settingsFields_() };
}


/* ============================ ЭТАП 6: статистика продаж ============================ */

var SHEET_STATS = 'Статистика';

/** Пункт меню PAMIR → «Оновити статистику продажів». */
function menuStats() {
  var res = salesStats_(true);
  SpreadsheetApp.getUi().alert('Статистику оновлено. Замовлень враховано: ' + res.all.n + '. Дивіться аркуш «' + SHEET_STATS + '».');
}

/**
 * Продажи по дням и по товарам. В расчёт не идут тестовые заказы, отменённые и «немає в наявності».
 * write = true — заодно переписывает лист «Статистика» (его не правят руками: он каждый раз создаётся заново).
 */
function salesStats_(write) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_ORDERS);
  var tz = 'Europe/Kiev';
  var now = new Date();
  var from30 = now.getTime() - 30 * 24 * 3600 * 1000;
  var days = {}, dayKeys = [];
  var prodAll = {}, prod30 = {};
  var all = { n: 0, sum: 0 }, m30 = { n: 0, sum: 0 };
  var buyers = {}; // uid → число заказов: для доли повторных покупок

  function addProduct(map, key, name, q, kg, sum) {
    var x = map[key] || (map[key] = { name: name, q: 0, kg: 0, sum: 0, n: 0 });
    x.q += q; x.kg += kg; x.sum += sum; x.n++;
  }

  if (sheet && sheet.getLastRow() > 1) {
    var col = orderCols_(sheet);
    var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    values.forEach(function (row) {
      if (!cell_(row, col.num)) return;
      var status = cell_(row, col.status) || STATUS_NEW;
      if (cell_(row, col.source).indexOf('test') >= 0 || status === 'немає в наявності' || status === 'скасовано') return;
      var date = col.date >= 0 ? row[col.date] : '';
      if (Object.prototype.toString.call(date) !== '[object Date]' || isNaN(date.getTime())) return;
      var total = toNum_(col.total >= 0 ? row[col.total] : 0);
      var key = Utilities.formatDate(date, tz, 'yyyy-MM-dd');
      if (!days[key]) { days[key] = { d: key, n: 0, sum: 0 }; dayKeys.push(key); }
      days[key].n++; days[key].sum += total;
      all.n++; all.sum += total;
      var buyer = col.uid >= 0 ? cell_(row, col.uid) : '';
      if (buyer) buyers[buyer] = (buyers[buyer] || 0) + 1;
      var recent = date.getTime() >= from30;
      if (recent) { m30.n++; m30.sum += total; }

      var compact = null;
      try { compact = JSON.parse(cell_(row, col.svc) || '{}').i || null; } catch (err) { compact = null; }
      var parts = cell_(row, col.items).split('; ');
      parts.forEach(function (text, idx) {
        var m = text.match(/^(.*) × (\d+) = (\d+) ₴$/);
        if (!m) return;
        var name = m[1], q = Number(m[2]), sum = Number(m[3]);
        var pkey = name, kg = 0;
        var c = compact && compact.length === parts.length ? compact[idx] : null;
        if (c) {
          var g = Number(c[1]) || 0;
          pkey = String(c[0]);
          if (g > 0) {
            kg = g * q / 1000;
            var tail = ' ' + weightLabel_(g);
            if (name.slice(-tail.length) === tail) name = name.slice(0, -tail.length);
          }
        }
        addProduct(prodAll, pkey, name, q, kg, sum);
        if (recent) addProduct(prod30, pkey, name, q, kg, sum);
      });
    });
  }

  function top(map) {
    return Object.keys(map).map(function (k) { var x = map[k]; x.kg = Math.round(x.kg * 1000) / 1000; return x; })
      .sort(function (a, b) { return b.sum - a.sum; });
  }
  dayKeys.sort().reverse();
  var dayList = dayKeys.map(function (k) { return days[k]; });
  var p30 = top(prod30), pAll = top(prodAll);

  // Средний чек, повторные покупки и воронка (лист «Події»).
  var buyerIds = Object.keys(buyers);
  var repeatBuyers = buyerIds.filter(function (k) { return buyers[k] >= 2; }).length;
  var kpi = {
    aov30: m30.n ? Math.round(m30.sum / m30.n) : 0,
    aovAll: all.n ? Math.round(all.sum / all.n) : 0,
    buyers: buyerIds.length,
    repeat: repeatBuyers,
    repeatPct: buyerIds.length ? Math.round(repeatBuyers * 100 / buyerIds.length) : 0
  };
  var funnel = null;
  try { funnel = eventsFunnel_(ss, from30, m30.n); } catch (err) { console.warn('funnel: ' + err); }

  if (write) {
    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      var out = ss.getSheetByName(SHEET_STATS) || ss.insertSheet(SHEET_STATS);
      out.clearContents();
      var grid = [
        ['Оновлено: ' + Utilities.formatDate(now, tz, 'dd.MM.yyyy HH:mm') + '. Аркуш створюється автоматично, руками не редагувати.', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
        ['За 30 днів: замовлень ' + m30.n + ', сума ' + m30.sum + ' ₴. За весь час: замовлень ' + all.n + ', сума ' + all.sum + ' ₴.', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
        ['Середній чек: ' + kpi.aov30 + ' ₴ за 30 днів, ' + kpi.aovAll + ' ₴ за весь час. Покупців: ' + kpi.buyers + ', з повторними замовленнями: ' + kpi.repeat + ' (' + kpi.repeatPct + '%).' +
          (funnel ? ' Воронка за 30 днів (сесії): відкрили ' + funnel.open + ' → дивилися товар ' + funnel.view + ' → додали в кошик ' + funnel.add + ' → почали оформлення ' + funnel.checkout + ' → замовлень ' + funnel.order + '.' : ''),
          '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
        ['ПО ДНЯХ', '', '', '', '', 'ТОВАРИ ЗА 30 ДНІВ', '', '', '', '', '', 'ТОВАРИ ЗА ВЕСЬ ЧАС', '', '', '', ''],
        ['Дата', 'Замовлень', 'Сума, ₴', 'Середній чек, ₴', '', 'Товар', 'Штук/упаковок', 'Вага, кг', 'Сума, ₴', 'У замовленнях', '', 'Товар', 'Штук/упаковок', 'Вага, кг', 'Сума, ₴', 'У замовленнях']
      ];
      var n = Math.max(dayList.length, p30.length, pAll.length);
      for (var i = 0; i < n; i++) {
        var d = dayList[i], a = p30[i], b = pAll[i];
        grid.push([
          d ? d.d.split('-').reverse().join('.') : '', d ? d.n : '', d ? d.sum : '', d ? Math.round(d.sum / d.n) : '', '',
          a ? safeCell_(a.name) : '', a ? a.q : '', a ? (a.kg || '') : '', a ? a.sum : '', a ? a.n : '', '',
          b ? safeCell_(b.name) : '', b ? b.q : '', b ? (b.kg || '') : '', b ? b.sum : '', b ? b.n : ''
        ]);
      }
      out.getRange(1, 1, grid.length, 16).setValues(grid);
      out.getRange(4, 1, 2, 16).setFontWeight('bold');
      out.setFrozenRows(5);
      SpreadsheetApp.flush();
    } finally {
      lock.releaseLock();
    }
  }
  return { ok: true, all: all, m30: m30, days: dayList.slice(0, 30), products: p30.slice(0, 20), kpi: kpi, funnel: funnel };
}


/* ======================================================================== */
/* ЭТАП 7: аналитика, «сообщить о появлении», напоминания                     */
/* ======================================================================== */

/* ------------------------------ Аналитика поведения ------------------------------ */
/*
 * Витрина присылает пачку событий (action: 'ev'): что открыли, что смотрели, что положили в корзину.
 * Пишем в лист «Події». Считаем только подписанные Telegram сессии; действия админов не учитываются.
 * Из этого листа статистика строит воронку: відкрили → дивилися товар → додали в кошик → оформлення → замовлення.
 */
var SHEET_EVENTS = 'Події';
var EVENT_HEADERS = ['Час', 'Користувач', 'Сесія', 'Подія', 'Товар', 'Значення'];
var EVENT_NAMES = ['open', 'view', 'add', 'cart', 'checkout', 'order', 'search', 'search0', 'fav', 'repeat', 'share', 'notify'];
var MAX_EVENTS_PER_HOUR = 400;
var EVENTS_KEEP_ROWS = 20000;

function handleEvents_(body) {
  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty('BOT_TOKEN');
  if (!token) return { ok: false, error: 'not_configured' };
  var user = body.initData ? verifyInitData_(String(body.initData), token) : null;
  if (!user) return { ok: false, error: 'bad_auth' };
  var uid = String(user.id);
  if (adminAccess_(uid, props)) return { ok: true, n: 0 };
  var list = Array.isArray(body.events) ? body.events.slice(0, 40) : [];
  if (!list.length) return { ok: true, n: 0 };

  var cache = CacheService.getScriptCache();
  var used = parseInt(cache.get('ev_' + uid), 10) || 0;
  if (used >= MAX_EVENTS_PER_HOUR) return { ok: true, n: 0 };
  cache.put('ev_' + uid, String(used + list.length), 3600);

  var sid = String(body.sid || '').replace(/[^\w-]/g, '').slice(0, 24);
  var now = Date.now();
  var rows = [];
  list.forEach(function (ev) {
    var name = String((ev && ev.e) || '');
    if (EVENT_NAMES.indexOf(name) < 0) return;
    var t = Number(ev.t);
    var when = t > now - 24 * 3600 * 1000 && t <= now + 60000 ? new Date(t) : new Date(now);
    rows.push([when, uid, sid, name, safeCell_(clean_(ev.id, 32)), safeCell_(clean_(ev.v, 60))]);
  });
  if (!rows.length) return { ok: true, n: 0 };

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sheet = ensureEventsSheet_();
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, EVENT_HEADERS.length).setValues(rows);
    // Лист не растёт бесконечно: самые старые строки удаляются.
    if (sheet.getLastRow() > EVENTS_KEEP_ROWS + 5000) sheet.deleteRows(2, 5000);
  } finally {
    lock.releaseLock();
  }
  return { ok: true, n: rows.length };
}

function ensureEventsSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_EVENTS);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_EVENTS);
    sheet.getRange(1, 1, 1, EVENT_HEADERS.length).setValues([EVENT_HEADERS]).setFontWeight('bold');
    sheet.setFrozenRows(1);
    sheet.getRange('A:A').setNumberFormat('dd.MM.yyyy HH:mm');
  }
  return sheet;
}

/**
 * Воронка за период: в скольких сессиях было каждое действие. Плюс поисковые запросы без результата
 * и самые просматриваемые товары — подсказка, чего не хватает в ассортименте и что стоит показать выше.
 */
function eventsFunnel_(ss, fromMs, orders) {
  var sheet = ss.getSheetByName(SHEET_EVENTS);
  if (!sheet || sheet.getLastRow() < 2) return null;
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, EVENT_HEADERS.length).getValues();
  var steps = { open: {}, view: {}, add: {}, checkout: {} };
  var users = {}, zero = {}, viewed = {};
  values.forEach(function (row) {
    var when = row[0];
    if (Object.prototype.toString.call(when) !== '[object Date]' || when.getTime() < fromMs) return;
    var uid = String(row[1]), session = uid + '|' + String(row[2]), name = String(row[3]);
    users[uid] = true;
    steps.open[session] = true; // любое событие означает, что магазин открывали
    if (steps[name]) steps[name][session] = true;
    if (name === 'add') steps.view[session] = true;
    if (name === 'checkout') steps.add[session] = true;
    if (name === 'search0') { var q = String(row[5]).toLowerCase(); if (q) zero[q] = (zero[q] || 0) + 1; }
    if (name === 'view') { var id = String(row[4]); if (id) viewed[id] = (viewed[id] || 0) + 1; }
  });
  function size(o) { return Object.keys(o).length; }
  function topList(map, n) {
    return Object.keys(map).map(function (k) { return { k: k, n: map[k] }; })
      .sort(function (a, b) { return b.n - a.n; }).slice(0, n);
  }
  var names = {};
  try { JSON.parse(getCatalogJson_()).products.forEach(function (p) { names[p.id] = p.ua; }); } catch (err) { /* без названий */ }
  var open = size(steps.open);
  return {
    users: size(users), open: open, view: size(steps.view), add: size(steps.add), checkout: size(steps.checkout),
    order: orders, cr: open ? Math.round(orders * 1000 / open) / 10 : 0,
    zero: topList(zero, 10).map(function (x) { return { q: x.k, n: x.n }; }),
    viewed: topList(viewed, 10).map(function (x) { return { id: x.k, name: names[x.k] || x.k, n: x.n }; })
  };
}

/* ------------------------------ «Повідомити, коли з'явиться» ------------------------------ */

var SHEET_SUBS = 'Підписки';
var SUB_HEADERS = ['Дата', 'Telegram user id', 'Товар', 'Мова', 'Статус'];
var SUB_WAIT = 'чекає';
var SUB_REMIND = 'REMIND'; // строка-отказ от напоминаний: Товар = REMIND, Статус = стоп
var MAX_SUBS_PER_USER = 20;

function ensureSubsSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_SUBS);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_SUBS);
    sheet.getRange(1, 1, 1, SUB_HEADERS.length).setValues([SUB_HEADERS]).setFontWeight('bold');
    sheet.setFrozenRows(1);
    sheet.getRange('A:A').setNumberFormat('dd.MM.yyyy HH:mm');
  }
  return sheet;
}

/** Клиент нажал «Повідомити, коли з'явиться» у товара, которого нет. */
function handleNotify_(body) {
  var token = PropertiesService.getScriptProperties().getProperty('BOT_TOKEN');
  if (!token) return { ok: false, error: 'not_configured' };
  var user = body.initData ? verifyInitData_(String(body.initData), token) : null;
  if (!user) return { ok: false, error: 'bad_auth' };
  var uid = String(user.id);
  var id = clean_(body.id, 32);
  var product = null;
  JSON.parse(getCatalogJson_()).products.forEach(function (p) { if (p.id === id) product = p; });
  if (!product) return { ok: false, error: 'bad_form' };
  if (product.a) return { ok: true, instock: true };

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sheet = ensureSubsSheet_();
    var mine = 0, dup = false;
    if (sheet.getLastRow() > 1) {
      sheet.getRange(2, 1, sheet.getLastRow() - 1, SUB_HEADERS.length).getValues().forEach(function (row) {
        if (String(row[1]).trim() !== uid || String(row[4]).trim() !== SUB_WAIT) return;
        mine++;
        if (String(row[2]).trim() === id) dup = true;
      });
    }
    if (dup) return { ok: true, dup: true };
    if (mine >= MAX_SUBS_PER_USER) return { ok: false, error: 'rate_limit' };
    sheet.appendRow([new Date(), uid, id, body.lang === 'ru' ? 'ru' : 'ua', SUB_WAIT]);
  } finally {
    lock.releaseLock();
  }
  return { ok: true };
}

/** Пишет всем, кто ждал товар, который снова в наличии. Возвращает число отправленных сообщений. */
function notifyBackInStock_() {
  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty('BOT_TOKEN');
  var webapp = props.getProperty('WEBAPP_URL');
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_SUBS);
  if (!token || !sheet || sheet.getLastRow() < 2) return 0;
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, SUB_HEADERS.length).getValues();
  var waiting = values.some(function (row) { return String(row[4]).trim() === SUB_WAIT; });
  if (!waiting) return 0;
  var byId = {};
  buildCatalog_().products.forEach(function (p) { byId[p.id] = p; });
  var sent = 0;
  for (var r = 0; r < values.length && sent < 60; r++) {
    var row = values[r];
    if (String(row[4]).trim() !== SUB_WAIT) continue;
    var p = byId[String(row[2]).trim()];
    if (!p || !p.a) continue;
    var ru = String(row[3]).trim() === 'ru';
    var msg = { chat_id: String(row[1]).trim(), text: (ru ? '✅ Снова в наличии: ' : '✅ Знову в наявності: ') + ((ru && p.ru) || p.ua) };
    if (/^https:\/\//.test(webapp || '')) {
      msg.reply_markup = { inline_keyboard: [[{ text: ru ? '🛒 Открыть товар' : '🛒 Відкрити товар',
        web_app: { url: webapp + (webapp.indexOf('?') < 0 ? '?' : '&') + 'p=' + encodeURIComponent(p.id) } }]] };
    }
    var res = tg_(token, 'sendMessage', msg);
    sheet.getRange(r + 2, 5).setValue(res.ok ? 'надіслано' : 'не доставлено');
    sent++;
  }
  return sent;
}

function menuNotifyStock() {
  var n = notifyBackInStock_();
  SpreadsheetApp.getUi().alert('Надіслано повідомлень: ' + n + '.');
}

/* ------------------------------ Напоминание о повторном заказе ------------------------------ */

/** Клиенты, которые нажали «Більше не нагадувати». */
function reminderStops_() {
  var stops = {};
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_SUBS);
  if (!sheet || sheet.getLastRow() < 2) return stops;
  sheet.getRange(2, 1, sheet.getLastRow() - 1, SUB_HEADERS.length).getValues().forEach(function (row) {
    if (String(row[2]).trim() === SUB_REMIND) stops[String(row[1]).trim()] = true;
  });
  return stops;
}

function stopReminders_(uid) {
  if (!/^\d+$/.test(String(uid))) return;
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    if (reminderStops_()[String(uid)]) return;
    ensureSubsSheet_().appendRow([new Date(), String(uid), SUB_REMIND, '', 'стоп']);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Одно напоминание на один выполненный заказ: через remind_days дней, если после него клиент ничего не заказывал.
 * Выключено, пока в настройках remind_days = 0. В сообщении есть кнопка «Більше не нагадувати».
 */
function remindRepeat_() {
  var st = readSettings_();
  var days = Math.round(toNum_(st.remind_days));
  if (!(days >= 7)) return 0;
  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty('BOT_TOKEN');
  var webapp = props.getProperty('WEBAPP_URL');
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ORDERS);
  if (!token || !/^https:\/\//.test(webapp || '') || !sheet || sheet.getLastRow() < 2) return 0;
  var col = orderCols_(sheet);
  if (col.uid < 0 || col.date < 0 || col.svc < 0) return 0;
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  var last = {}; // uid → последняя по времени строка заказа
  values.forEach(function (row, r) {
    var uid = cell_(row, col.uid);
    var date = row[col.date];
    if (!uid || cell_(row, col.source).indexOf('test') >= 0) return;
    if (Object.prototype.toString.call(date) !== '[object Date]' || isNaN(date.getTime())) return;
    if (!last[uid] || date.getTime() > last[uid].time) last[uid] = { r: r, time: date.getTime(), row: row };
  });
  var stops = reminderStops_();
  var now = Date.now(), day = 24 * 3600 * 1000, sent = 0;
  Object.keys(last).forEach(function (uid) {
    if (sent >= 30 || stops[uid]) return;
    var x = last[uid];
    var age = (now - x.time) / day;
    if (cell_(x.row, col.status) !== 'виконано' || age < days || age >= days + 7) return;
    var svc = {};
    try { svc = JSON.parse(cell_(x.row, col.svc) || '{}') || {}; } catch (err) { svc = {}; }
    if (svc.rm) return;
    var ru = cell_(x.row, col.lang) === 'ru';
    var res = tg_(token, 'sendMessage', {
      chat_id: uid, text: ru ? st.remind_text_ru : st.remind_text_ua,
      reply_markup: { inline_keyboard: [
        [{ text: ru ? '🔁 Повторить заказ' : '🔁 Повторити замовлення', web_app: { url: webapp + (webapp.indexOf('?') < 0 ? '?' : '&') + 'view=orders' } }],
        [{ text: ru ? 'Больше не напоминать' : 'Більше не нагадувати', callback_data: 'nr' }]
      ] }
    });
    svc.rm = 1; // отмечаем в любом случае: второй попытки не будет
    sheet.getRange(x.r + 2, col.svc + 1).setValue(JSON.stringify(svc));
    if (res.ok) sent++;
  });
  return sent;
}

/** Раз в день (триггер из меню PAMIR): сообщения о появлении товаров и напоминания о повторном заказе. */
function dailyJob() {
  try { notifyBackInStock_(); } catch (err) { console.error('daily stock: ' + (err && err.stack || err)); }
  try { remindRepeat_(); } catch (err) { console.error('daily remind: ' + (err && err.stack || err)); }
  try { askReviews_(); } catch (err) { console.error('daily reviews: ' + (err && err.stack || err)); }
}

/** Раз в час (тот же пункт меню PAMIR): напоминание о брошенной корзине. */
function hourlyJob() {
  try { remindCarts_(); } catch (err) { console.error('hourly carts: ' + (err && err.stack || err)); }
}

function menuDailyOff() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'dailyJob' || t.getHandlerFunction() === 'hourlyJob') ScriptApp.deleteTrigger(t);
  });
  try { SpreadsheetApp.getUi().alert('Щоденні повідомлення вимкнено.'); } catch (err) { /* запуск из редактора */ }
}

function menuDailyOn() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'dailyJob' || t.getHandlerFunction() === 'hourlyJob') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('dailyJob').timeBased().everyDays(1).atHour(11).create();
  ScriptApp.newTrigger('hourlyJob').timeBased().everyHours(1).create();
  try {
    SpreadsheetApp.getUi().alert('Готово. Щодня близько 11:00: повідомлення про появу товарів, прохання про відгук і (якщо задано remind_days) нагадування про повторне замовлення. Щогодини: нагадування про покинутий кошик.');
  } catch (err) { /* запуск из редактора */ }
}


/* ======================================================================== */
/* ЭТАП 8, волна 1 · часть 1.8: админы с правами и журнал действий            */
/* ======================================================================== */
/*
 * Кто админ и что ему можно:
 *   1) Владелец — chat id из Script Property OWNER_CHAT_ID (пока свойства нет — первый id из ADMIN_CHAT_IDS).
 *      Его нельзя удалить, понизить или изменить ни из бота, ни из панели, ни строкой в листе.
 *   2) Лист «Адміни»: роль «Адмін» (все права) или «Менеджер» (права — «так» в колонках). Строка без «так»
 *      в колонке «Активний» доступа не даёт.
 *   3) ADMIN_CHAT_IDS — запасной вариант: id оттуда, которых нет в листе, остаются полными админами.
 * Права проверяются на сервере при каждом запросе и каждом нажатии кнопки. Скрытые кнопки в панели — только удобство.
 */

var SHEET_ADMINS = 'Адміни';
var SHEET_LOG = 'Журнал';
var PERMS = [
  ['st', 'Замовлення: статуси'], ['stock', 'Наявність і залишки'], ['photo', 'Фото'], ['text', 'Тексти товарів'],
  ['price', 'Ціни та акції'], ['cats', 'Категорії'], ['stats', 'Статистика'], ['settings', 'Налаштування'],
  ['reviews', 'Відгуки'], ['mail', 'Розсилка'], ['wh', 'Опт'], ['admins', 'Адміни']
];
var ROLE_UA = { owner: 'Власник', admin: 'Адмін', manager: 'Менеджер' };
var ADMIN_NOTIFY_HEAD = 'Отримувати сповіщення про замовлення';
var ADMIN_HEAD = ['Chat id', 'Ім\'я', '@username', 'Роль']
  .concat(PERMS.map(function (p) { return p[1]; }))
  .concat([ADMIN_NOTIFY_HEAD, 'Хто додав', 'Дата', 'Активний']);
var ADMIN_COLS = (function () {
  var spec = { id: ['chat id'], name: ['ім\'я', 'ім’я'], username: ['@username'], role: ['роль'],
    notify: ['отримувати сповіщення'], by: ['хто додав'], date: ['дата'], active: ['активний'] };
  PERMS.forEach(function (p) { spec['p_' + p[0]] = [p[1].toLowerCase()]; });
  return spec;
})();
/** Какое право нужно, чтобы изменить поле товара. */
var PATCH_PERM = { stock: 'stock', qty: 'stock', hidden: 'stock', img: 'photo',
  ua: 'text', ru: 'text', dUa: 'text', dRu: 'text', cat: 'text',
  price: 'price', old: 'price', badge: 'price', end: 'price', wh: 'price', wm: 'price', packs: 'price', t: 'price' };
var INVITE_TTL_MS = 24 * 3600 * 1000;
var LOG_HEAD = ['Час', 'Хто', 'Chat id', 'Дія', 'Об\'єкт', 'Було', 'Стало'];
var LOG_KEEP_ROWS = 5000;

var adminsMemo_ = null;
var actor_ = null; // кто выполняет текущее действие: { id, name } — попадает в журнал

function ownerId_(props) {
  var own = String(props.getProperty('OWNER_CHAT_ID') || '').trim();
  if (/^\d+$/.test(own)) return own;
  var ids = adminIds_(props).filter(function (s) { return /^\d+$/.test(s); });
  return ids.length ? ids[0] : '';
}

function allPerms_() {
  var o = {};
  PERMS.forEach(function (p) { o[p[0]] = true; });
  return o;
}

function roleCode_(v) {
  var s = String(v === null || v === undefined ? '' : v).trim().toLowerCase();
  if (/^(менедж|manager)/.test(s)) return 'manager';
  if (/^(адмін|админ|admin|власн|владел|owner)/.test(s)) return 'admin'; // «Власник» в листе — обычный полный админ
  return '';
}

/** Все админы: владелец, строки листа «Адміни» и запасные id из ADMIN_CHAT_IDS. */
function adminList_(props) {
  if (adminsMemo_) return adminsMemo_;
  props = props || PropertiesService.getScriptProperties();
  var owner = ownerId_(props);
  var list = [];
  var seen = {};
  var ownerEntry = null;
  if (owner) {
    ownerEntry = { id: owner, name: '', username: '', role: 'owner', perms: allPerms_(), notify: true, active: true, by: '', date: '', src: 'owner' };
    list.push(ownerEntry);
    seen[owner] = true;
  }
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ADMINS);
  if (sheet && sheet.getLastRow() > 1) {
    var values = sheet.getDataRange().getValues();
    var col = mapHeaders_(values[0], ADMIN_COLS);
    for (var r = 1; r < values.length; r++) {
      var row = values[r];
      var id = cell_(row, col.id);
      if (!/^-?\d+$/.test(id)) continue;
      if (id === owner) { // строка владельца в листе ничего не меняет, из неё берём только имя
        if (ownerEntry) { ownerEntry.name = cell_(row, col.name); ownerEntry.username = cell_(row, col.username); }
        continue;
      }
      if (seen[id]) continue;
      seen[id] = true;
      var role = roleCode_(cell_(row, col.role));
      var perms = {};
      if (role === 'admin') perms = allPerms_();
      else if (role === 'manager') PERMS.forEach(function (p) { if (isYes_(cell_(row, col['p_' + p[0]]))) perms[p[0]] = true; });
      var date = col.date >= 0 ? row[col.date] : '';
      var isDate = Object.prototype.toString.call(date) === '[object Date]' && !isNaN(date.getTime());
      list.push({ id: id, name: cell_(row, col.name), username: cell_(row, col.username), role: role || 'manager', perms: perms,
        notify: isYes_(cell_(row, col.notify)), active: !!role && isYes_(cell_(row, col.active)), by: cell_(row, col.by),
        date: isDate ? Utilities.formatDate(date, 'Europe/Kiev', 'dd.MM.yyyy') : String(date || ''), src: 'sheet', row: r + 1 });
    }
  }
  adminIds_(props).forEach(function (id) {
    if (seen[id]) return;
    seen[id] = true;
    list.push({ id: id, name: '', username: '', role: 'admin', perms: allPerms_(), notify: true, active: true, by: 'ADMIN_CHAT_IDS', date: '', src: 'prop' });
  });
  adminsMemo_ = list;
  return list;
}

/** Действующий админ с этим id или null. */
function adminAccess_(uid, props) {
  uid = String(uid === null || uid === undefined ? '' : uid);
  if (!uid) return null;
  var found = null;
  adminList_(props).forEach(function (a) { if (a.id === uid && a.active) found = a; });
  return found;
}

/** Кому присылать новые заказы. */
function orderNotifyIds_(props) {
  return adminList_(props).filter(function (a) { return a.active && a.notify; }).map(function (a) { return a.id; });
}

function ensureAdminsSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_ADMINS);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_ADMINS);
    sheet.getRange(1, 1, 1, ADMIN_HEAD.length).setValues([ADMIN_HEAD]).setFontWeight('bold');
    sheet.setFrozenRows(1);
    sheet.getRange('A:A').setNumberFormat('@');
  }
  return sheet;
}

/** Записывает (или обновляет) строку админа. e: { id, name, username, role, perms, notify, by, active } */
function writeAdminRow_(e) {
  var sheet = ensureAdminsSheet_();
  var values = sheet.getDataRange().getValues();
  var col = mapHeaders_(values[0], ADMIN_COLS);
  var r = -1;
  for (var i = 1; i < values.length; i++) if (cell_(values[i], col.id) === String(e.id)) { r = i; break; }
  var isNew = r < 0;
  if (isNew) {
    var blank = [];
    for (var b = 0; b < Math.max(sheet.getLastColumn(), ADMIN_HEAD.length); b++) blank.push('');
    blank[col.id] = '\'' + e.id;
    sheet.appendRow(blank);
    r = sheet.getLastRow() - 1;
  }
  function set(key, value) { if (col[key] >= 0) sheet.getRange(r + 1, col[key] + 1).setValue(value); }
  if (e.name !== undefined && (isNew || e.name)) set('name', safeCell_(clean_(e.name, 60)));
  if (e.username !== undefined && (isNew || e.username)) set('username', safeCell_(clean_(e.username, 40)));
  set('role', ROLE_UA[e.role === 'admin' ? 'admin' : 'manager']);
  PERMS.forEach(function (p) { set('p_' + p[0], e.role === 'admin' || e.perms[p[0]] ? 'так' : ''); });
  set('notify', e.notify ? 'так' : '');
  if (isNew) { set('by', safeCell_(clean_(e.by || '', 80))); set('date', new Date()); }
  set('active', e.active ? 'так' : '');
  SpreadsheetApp.flush();
  adminsMemo_ = null;
}

/* ------------------------------ Журнал действий ------------------------------ */

function logAction_(action, object, was, now) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_LOG);
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_LOG);
      sheet.getRange(1, 1, 1, LOG_HEAD.length).setValues([LOG_HEAD]).setFontWeight('bold');
      sheet.setFrozenRows(1);
      sheet.getRange('A:A').setNumberFormat('dd.MM.yyyy HH:mm');
    }
    function txt(v) { return safeCell_(clean_(v === null || v === undefined ? '' : v, 300)); }
    sheet.appendRow([new Date(), txt(actor_ ? actor_.name : 'система'), actor_ ? '\'' + actor_.id : '', txt(action), txt(object), txt(was), txt(now)]);
    var extra = sheet.getLastRow() - 1 - LOG_KEEP_ROWS;
    if (extra > 500) sheet.deleteRows(2, extra);
  } catch (err) {
    console.error('log: ' + (err && err.stack || err));
  }
}

function listLog_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_LOG);
  if (!sheet || sheet.getLastRow() < 2) return { ok: true, rows: [] };
  var last = sheet.getLastRow();
  var n = Math.min(150, last - 1);
  var values = sheet.getRange(last - n + 1, 1, n, LOG_HEAD.length).getValues();
  var rows = [];
  for (var r = values.length - 1; r >= 0; r--) {
    var d = values[r][0];
    var isDate = Object.prototype.toString.call(d) === '[object Date]' && !isNaN(d.getTime());
    rows.push({ t: isDate ? Utilities.formatDate(d, 'Europe/Kiev', 'dd.MM HH:mm') : String(d || ''), who: String(values[r][1] || ''),
      act: String(values[r][3] || ''), obj: String(values[r][4] || ''), was: String(values[r][5] || ''), now: String(values[r][6] || '') });
  }
  return { ok: true, rows: rows };
}

/** Что изменилось в товаре: сравниваем то, что видит панель, до и после. */
var PRODUCT_LOG_NAMES = { cat: 'категорія', ua: 'назва (UA)', ru: 'назва (RU)', t: 'тип', packs: 'фасування', price: 'ціна', stock: 'наявність',
  hidden: 'приховано', img: 'фото', dUa: 'опис (UA)', dRu: 'опис (RU)', wh: 'опт ціна', wm: 'опт мін. обсяг', badge: 'бейдж', old: 'стара ціна',
  qty: 'залишок', end: 'акція до' };
function logProductDiff_(before, after) {
  Object.keys(PRODUCT_LOG_NAMES).forEach(function (k) {
    var a = before ? before[k] : '', b = after[k];
    if (String(a === undefined ? '' : a) === String(b === undefined ? '' : b)) return;
    if (k === 'stock') { a = a ? 'є' : 'немає'; b = b ? 'є' : 'немає'; }
    if (k === 'hidden') { a = a ? 'так' : 'ні'; b = b ? 'так' : 'ні'; }
    if (k === 'img') { a = a ? 'було фото' : 'без фото'; b = b ? 'нове фото' : 'без фото'; }
    logAction_('Товар: ' + PRODUCT_LOG_NAMES[k], after.id + ' ' + after.ua, before ? a : '', b);
  });
}

/* ------------------------------ Управление админами ------------------------------ */

function publicAdmin_(a) {
  return { id: a.id, name: a.name, username: a.username, role: a.role, perms: Object.keys(a.perms), notify: !!a.notify,
    active: !!a.active, by: a.by, date: a.date, src: a.src };
}

function listAdmins_(props) {
  var invites = readInvites_(props);
  var waiting = [];
  Object.keys(invites).forEach(function (code) {
    var x = invites[code];
    waiting.push({ role: x.role, perms: x.perms, by: x.byName, name: x.name || '', state: x.uid ? 'wait' : 'new',
      left: Math.max(0, Math.round((x.exp - Date.now()) / 3600000)) });
  });
  var propIds = adminIds_(props);
  var admins = adminList_(props).map(function (a) {
    var x = publicAdmin_(a);
    if (propIds.indexOf(a.id) >= 0) x.inProps = true; // chat id записан в ADMIN_CHAT_IDS: доступ не пропадёт, пока его не уберут оттуда
    return x;
  });
  return { ok: true, admins: admins, invites: waiting, permList: PERMS };
}

function readInvites_(props) {
  var all = {};
  try { all = JSON.parse(props.getProperty('ADMIN_INVITES') || '{}') || {}; } catch (err) { all = {}; }
  var now = Date.now();
  Object.keys(all).forEach(function (code) { if (!(all[code].exp > now)) delete all[code]; });
  return all;
}

function saveInvites_(props, all) {
  props.setProperty('ADMIN_INVITES', JSON.stringify(all));
}

function cleanPerms_(list) {
  var out = {};
  (Array.isArray(list) ? list : []).forEach(function (k) {
    PERMS.forEach(function (p) { if (p[0] === String(k)) out[p[0]] = true; });
  });
  return out;
}

/** Можно ли этому админу выдать такую роль и такие права. Нельзя выдать то, чего нет у самого. */
function canGrant_(me, role, perms) {
  if (me.role === 'owner') return true;
  if (role === 'admin') return me.role === 'admin';
  return Object.keys(perms).every(function (k) { return me.perms[k]; });
}

function notifyOwner_(props, token, text) {
  var owner = ownerId_(props);
  if (!owner || (actor_ && actor_.id === owner)) return; // свои действия владельцу не пересказываем
  tg_(token, 'sendMessage', { chat_id: owner, text: '🛡 ' + text });
}

function permsText_(role, perms) {
  if (role === 'admin') return ROLE_UA.admin + ' (усі права)';
  var names = PERMS.filter(function (p) { return perms[p[0]]; }).map(function (p) { return p[1]; });
  return ROLE_UA.manager + ': ' + (names.length ? names.join(', ') : 'лише перегляд замовлень');
}

/** «Додати адміна»: одноразовая ссылка на 24 часа. Прав у приглашённого нет, пока пригласивший не подтвердит. */
function inviteAdmin_(me, body, props) {
  var role = body.role === 'admin' ? 'admin' : 'manager';
  var perms = role === 'admin' ? allPerms_() : cleanPerms_(body.perms);
  if (!canGrant_(me, role, perms)) return { ok: false, error: 'no_perm', need: 'grant' };
  var all = readInvites_(props);
  if (Object.keys(all).length >= 20) return { ok: false, error: 'too_many' };
  var code = Utilities.getUuid().replace(/-/g, '').slice(0, 20);
  all[code] = { role: role, perms: Object.keys(perms), notify: body.notify !== false, by: me.id, byName: actor_ ? actor_.name : '', exp: Date.now() + INVITE_TTL_MS };
  saveInvites_(props, all);
  logAction_('Адміни: запрошення', permsText_(role, perms), '', 'посилання на 24 год');
  return { ok: true, code: 'adm_' + code, hours: 24 };
}

/** Изменение роли, прав, уведомлений или отключение админа. body: { id, role, perms, notify, active } */
function saveAdmin_(me, body, props, token) {
  var id = String(body.id || '');
  var target = null;
  adminList_(props).forEach(function (a) { if (a.id === id) target = a; });
  if (!target) return { ok: false, error: 'not_found' };
  if (target.role === 'owner') return { ok: false, error: 'owner_locked' };
  if (target.id === me.id) return { ok: false, error: 'self' };
  // Полных админов меняет и удаляет только владелец.
  if (target.role === 'admin' && target.active && me.role !== 'owner') return { ok: false, error: 'owner_only' };
  var role = body.role === undefined ? target.role : (body.role === 'admin' ? 'admin' : 'manager');
  var perms = role === 'admin' ? allPerms_() : (body.perms === undefined ? (target.role === 'admin' ? {} : target.perms) : cleanPerms_(body.perms));
  var active = body.active === undefined ? target.active : !!body.active;
  var notify = body.notify === undefined ? target.notify : !!body.notify;
  if (me.role !== 'owner') {
    if (role === 'admin' && me.role !== 'admin') return { ok: false, error: 'no_perm', need: 'grant' };
    // Трогать (выдавать и забирать) можно только те права, которые есть у самого.
    var before = target.active ? target.perms : {};
    var touched = PERMS.some(function (p) { return !!before[p[0]] !== !!(active && perms[p[0]]) && !me.perms[p[0]]; });
    if (touched) return { ok: false, error: 'no_perm', need: 'grant' };
  }
  var was = target.active ? permsText_(target.role, target.perms) + (target.notify ? '' : ' · без сповіщень') : 'вимкнено';
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    writeAdminRow_({ id: id, name: target.name, username: target.username, role: role, perms: perms, notify: notify, active: active,
      by: actor_ ? actor_.name : '' });
  } finally {
    lock.releaseLock();
  }
  var now = active ? permsText_(role, perms) + (notify ? '' : ' · без сповіщень') : 'вимкнено';
  var label = (target.name || 'id ' + id) + (target.username ? ' ' + target.username : '');
  logAction_(active ? 'Адміни: зміна прав' : 'Адміни: вимкнено', label, was, now);
  notifyOwner_(props, token, (actor_ ? actor_.name : 'Адмін') + ' змінив права: ' + label + '\nБуло: ' + was + '\nСтало: ' + now);
  if (!active || !target.active) setAdminCommands_(token, id, active);
  return listAdmins_(props);
}

/** Команда /admin в меню чата появляется у админа и исчезает у отключённого. */
function setAdminCommands_(token, chatId, on) {
  if (on) {
    tg_(token, 'setMyCommands', { scope: { type: 'chat', chat_id: chatId }, commands: [
      { command: 'start', description: 'Відкрити магазин' },
      { command: 'admin', description: 'Адмін-панель: замовлення і товари' },
      { command: 'id', description: 'Показати мій chat id' }] });
  } else {
    tg_(token, 'deleteMyCommands', { scope: { type: 'chat', chat_id: chatId } });
  }
}

/** Человек открыл ссылку-приглашение: привязываем его аккаунт и спрашиваем пригласившего. */
function handleAdminInvite_(msg, code, token, props) {
  var uid = String(msg.chat.id);
  var ru = String((msg.from && msg.from.language_code) || '').toLowerCase().indexOf('ru') === 0;
  function say(ua, r) { tg_(token, 'sendMessage', { chat_id: uid, text: ru ? r : ua }); }
  if (adminAccess_(uid, props)) { say('Ви вже маєте доступ до адмін-панелі. Команда: /admin', 'У вас уже есть доступ к админ-панели. Команда: /admin'); return; }
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  var inv;
  try {
    var all = readInvites_(props);
    inv = all[code];
    if (!inv || (inv.uid && inv.uid !== uid)) {
      say('Посилання недійсне або вже використане. Попросіть нове.', 'Ссылка недействительна или уже использована. Попросите новую.');
      return;
    }
    if (inv.uid === uid) { say('Запит уже надіслано. Чекаємо підтвердження.', 'Запрос уже отправлен. Ждём подтверждения.'); return; }
    inv.uid = uid;
    inv.name = clean_(((msg.from && msg.from.first_name) || '') + ' ' + ((msg.from && msg.from.last_name) || ''), 60);
    inv.username = msg.from && msg.from.username ? '@' + msg.from.username : '';
    saveInvites_(props, all);
  } finally {
    lock.releaseLock();
  }
  say('Запит на доступ надіслано. Щойно його підтвердять, я напишу вам сюди.', 'Запрос на доступ отправлен. Как только его подтвердят, я напишу вам сюда.');
  var who = escHtml_(inv.name || 'Без імені') + (inv.username ? ' (' + escHtml_(inv.username) + ')' : '') + ', id ' + uid;
  var res = tg_(token, 'sendMessage', { chat_id: inv.by, parse_mode: 'HTML',
    text: '🛡 <b>Запит на доступ до адмін-панелі</b>\n' + who + '\n' + escHtml_(permsText_(inv.role, cleanPerms_(inv.perms))) +
      '\n\nПідтверджуйте, лише якщо це та людина, якій ви надсилали посилання.',
    reply_markup: { inline_keyboard: [[{ text: '✅ Підтвердити', callback_data: 'ai:' + code + ':y' }, { text: '❌ Відхилити', callback_data: 'ai:' + code + ':n' }]] } });
  if (!res.ok) console.error('invite: не доставлено пригласившему ' + inv.by + ': ' + res.description);
}

/** Пригласивший (или владелец) нажал «Підтвердити / Відхилити». Возвращает текст для всплывающего ответа. */
function resolveAdminInvite_(cq, code, yes, token, props) {
  var fromId = String(cq.from && cq.from.id);
  var me = adminAccess_(fromId, props);
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  var inv, note;
  try {
    var all = readInvites_(props);
    inv = all[code];
    if (!inv || !inv.uid) return 'Запит уже неактуальний';
    if (!me || (fromId !== inv.by && me.role !== 'owner')) return 'Немає доступу';
    actor_ = { id: fromId, name: clean_((cq.from && cq.from.first_name) || me.name || '', 60) };
    var perms = cleanPerms_(inv.perms);
    if (yes && (!me.perms.admins || !canGrant_(me, inv.role, perms))) return 'У вас уже немає права видавати такий доступ';
    delete all[code];
    saveInvites_(props, all);
    var label = (inv.name || 'id ' + inv.uid) + (inv.username ? ' ' + inv.username : '');
    if (yes) {
      writeAdminRow_({ id: inv.uid, name: inv.name, username: inv.username, role: inv.role, perms: perms, notify: inv.notify !== false, active: true, by: actor_.name });
      logAction_('Адміни: додано', label, '', permsText_(inv.role, perms));
      note = '✅ Доступ надано: ' + label;
    } else {
      logAction_('Адміни: запит відхилено', label, '', '');
      note = '❌ Запит відхилено: ' + label;
    }
  } finally {
    lock.releaseLock();
  }
  if (yes) {
    setAdminCommands_(token, inv.uid, true);
    tg_(token, 'sendMessage', { chat_id: inv.uid, text: '✅ Доступ до адмін-панелі PAMIR надано. Команда: /admin' });
    notifyOwner_(props, token, actor_.name + ' додав адміна: ' + (inv.name || '') + ' ' + (inv.username || '') + ', id ' + inv.uid + '\n' + permsText_(inv.role, cleanPerms_(inv.perms)));
  } else {
    tg_(token, 'sendMessage', { chat_id: inv.uid, text: 'Запит на доступ відхилено.' });
  }
  if (cq.message && cq.message.chat) {
    tg_(token, 'editMessageText', { chat_id: cq.message.chat.id, message_id: cq.message.message_id, text: note });
  }
  return yes ? 'Доступ надано' : 'Відхилено';
}

/* ======================================================================== */
/* ЭТАП 8, волна 1 · часть 1.1: приветствие бота                              */
/* ======================================================================== */

function appUrl_(webapp, query) {
  return webapp + (webapp.indexOf('?') < 0 ? '?' : '&') + query;
}

/** Папка витрины (со слэшем на конце) — рядом с index.html лежит картинка приветствия welcome.jpg. */
function webappBase_(webapp) {
  var base = String(webapp || '').split('?')[0].split('#')[0];
  return base.replace(/[^\/]*$/, '');
}

/** {name} / {ім’я} / {имя} → имя из Telegram. Если имени нет, обращение убирается вместе с запятой. */
function fillName_(text, name) {
  var re = /\{\s*(name|ім['’ʼ]я|имя)\s*\}/gi;
  if (name) return String(text).replace(re, name);
  return String(text).replace(/,?\s*\{\s*(name|ім['’ʼ]я|имя)\s*\}/gi, '');
}

/** Настройка «contact» → ссылка для кнопки «Написати нам» или пустая строка. */
function contactUrl_(st) {
  var c = String(st.contact || '').trim();
  if (/^https:\/\/t\.me\/[\w+\/]+$/i.test(c)) return c;
  if (/^@?[A-Za-z][A-Za-z0-9_]{3,31}$/.test(c)) return 'https://t.me/' + c.replace(/^@/, '');
  var phone = c.replace(/[\s()-]/g, '');
  if (/^\+\d{10,15}$/.test(phone)) return 'https://t.me/' + phone;
  return '';
}

/** Есть ли у клиента хотя бы один настоящий (не тестовый, не отменённый) заказ. */
function hasOrders_(uid) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ORDERS);
  if (!sheet || sheet.getLastRow() < 2) return false;
  var col = orderCols_(sheet);
  if (col.uid < 0) return false;
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  return values.some(function (row) {
    if (String(row[col.uid]).trim() !== String(uid)) return false;
    var status = cell_(row, col.status);
    return cell_(row, col.source).indexOf('test') < 0 && status !== 'скасовано' && status !== 'немає в наявності';
  });
}

function sendWelcome_(msg, token, props, ru) {
  var st = readSettings_();
  var chatId = msg.chat.id;
  var webapp = props.getProperty('WEBAPP_URL');
  var hasApp = /^https:\/\//.test(webapp || '');
  var name = clean_((msg.from && msg.from.first_name) || '', 40);
  var back = false;
  try { back = hasOrders_(chatId); } catch (err) { console.error('welcome: ' + err); }
  var text = fillName_(back ? (ru ? st.greeting_back_ru : st.greeting_back_ua) : (ru ? st.greeting_ru : st.greeting_ua), name);
  var kb = [];
  if (hasApp) kb.push([{ text: ru ? '🛒 Открыть магазин' : '🛒 Відкрити магазин', web_app: { url: webapp } }]);
  if (hasApp && back) kb.push([{ text: ru ? '🔁 Повторить привычное' : '🔁 Повторити звичне', web_app: { url: appUrl_(webapp, 'view=orders&repeat=last') } }]);
  kb.push([{ text: ru ? '📍 Наши точки на рынке' : '📍 Наші точки на ринку', callback_data: 'm:pts' },
    { text: '🍑 Наша курага', callback_data: 'm:apr' }]);
  var last = [{ text: ru ? '💼 Для бизнеса (опт)' : '💼 Для бізнесу (опт)', callback_data: 'm:biz' }];
  var contact = contactUrl_(st);
  if (contact) last.push({ text: ru ? '✍️ Написать нам' : '✍️ Написати нам', url: contact });
  kb.push(last);
  var markup = { inline_keyboard: kb };
  // Видеокружок — только если в настройках задан его file_id.
  if (st.welcome_video_note) {
    var vn = tg_(token, 'sendVideoNote', { chat_id: chatId, video_note: st.welcome_video_note });
    if (!vn.ok) console.warn('welcome video note: ' + vn.description);
  }
  var photo = st.welcome_photo || (hasApp ? webappBase_(webapp) + 'welcome.jpg' : '');
  var res = photo ? tg_(token, 'sendPhoto', { chat_id: chatId, photo: photo, caption: text.slice(0, 1024), reply_markup: markup }) : { ok: false };
  if (!res.ok) {
    if (photo) console.warn('welcome photo: ' + res.description);
    tg_(token, 'sendMessage', { chat_id: chatId, text: text, reply_markup: markup });
  }
}

/** Кнопки под приветствием: точки, курага, опт. */
function handleMenuCallback_(cq, kind, token, props) {
  var chatId = cq.message && cq.message.chat ? cq.message.chat.id : (cq.from && cq.from.id);
  var ru = String((cq.from && cq.from.language_code) || '').toLowerCase().indexOf('ru') === 0;
  var st = readSettings_();
  var webapp = props.getProperty('WEBAPP_URL');
  var hasApp = /^https:\/\//.test(webapp || '');
  var text = '', kb = [];
  if (kind === 'pts') {
    var pm = pointsMessage_(st, ru, webapp, hasApp);
    text = pm.text; kb = pm.kb;
  } else if (kind === 'apr') {
    var fid = String(st.feature_id || '').trim().toUpperCase();
    var title = ru ? (st.feature_title_ru || st.feature_title_ua) : (st.feature_title_ua || st.feature_title_ru);
    var body = ru ? (st.feature_text_ru || st.feature_text_ua) : (st.feature_text_ua || st.feature_text_ru);
    text = '🍑 ' + title + '\n\n' + body;
    var found = false;
    if (fid) {
      try { JSON.parse(getCatalogJson_()).products.forEach(function (p) { if (p.id.toUpperCase() === fid) found = true; }); } catch (err) { found = false; }
    }
    if (hasApp) kb.push([{ text: ru ? '🛒 Открыть в магазине' : '🛒 Відкрити в магазині', web_app: { url: found ? appUrl_(webapp, 'p=' + encodeURIComponent(fid)) : webapp } }]);
  } else if (kind === 'biz') {
    text = '💼 ' + (ru ? st.biz_soon_ru : st.biz_soon_ua);
    var contact = contactUrl_(st);
    if (contact) kb.push([{ text: ru ? '✍️ Написать нам' : '✍️ Написати нам', url: contact }]);
  } else {
    return;
  }
  var payload = { chat_id: chatId, text: text };
  if (kb.length) payload.reply_markup = { inline_keyboard: kb };
  tg_(token, 'sendMessage', payload);
}


/* ======================================================================== */
/* ЭТАП 8, волна 1 · части 1.2–1.7: точки, доверие, отзывы, продажи, Нова пошта */
/* ======================================================================== */
/*
 * Новые листы (создаёт setupStage8 — меню PAMIR → «Етап 8: створити листи й колонки»):
 *   «Точки»    точки на рынке: адрес, ряд и место, часы по дням, телефон, карта, фото, видео;
 *   «Відгуки»  отзывы покупателей (создаётся и сам при первом отзыве); на витрину идут только «схвалено»;
 *   «Кошики»   состав корзин для напоминания (создаётся сам), цен в нём нет.
 * Новые необязательные колонки: «Товари» — Сорт, Урожай, Походження, Свіжа поставка, Підказка до ваги,
 *   Подсказка к весу, Ціни фасувань; «Замовлення» — ТТН. Без них всё работает как раньше.
 * Script Property NP_API_KEY (необязательно) включает подсказки городов и отделений Новой почты.
 */

/* ------------------------------ 1.2 Точки на рынке ------------------------------ */

var SHEET_POINTS = 'Точки';
var POINT_HEAD = ['Назва (UA)', 'Название (RU)', 'Адреса (UA)', 'Адрес (RU)', 'Ряд і місце (UA)', 'Ряд и место (RU)',
  'Як знайти (UA)', 'Как найти (RU)', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд', 'Телефон', 'Google Maps (посилання)',
  'Фото (посилання)', 'Відео (посилання)', 'Активна'];
var POINT_COLS = {
  ua: ['назва (ua)', 'назва'], ru: ['название (ru)', 'название'], addrUa: ['адреса (ua)', 'адреса'], addrRu: ['адрес (ru)'],
  placeUa: ['ряд і місце'], placeRu: ['ряд и место'], howUa: ['як знайти'], howRu: ['как найти'],
  d0: ['пн'], d1: ['вт'], d2: ['ср'], d3: ['чт'], d4: ['пт'], d5: ['сб'], d6: ['нд', 'вс'],
  tel: ['телефон'], map: ['google maps', 'мапа', 'карта'], img: ['фото'], video: ['відео', 'видео'], active: ['активна']
};
var MAX_POINTS = 6;

/** «7:00-17:00» → «07:00-17:00»; «вихідний», пусто и всё непонятное → '' (точка в этот день закрыта). */
function hoursCell_(v) {
  var m = String(v === null || v === undefined ? '' : v).match(/(\d{1,2})[:.](\d{2})\s*[-–—]\s*(\d{1,2})[:.](\d{2})/);
  if (!m || +m[1] > 23 || +m[3] > 24 || +m[2] > 59 || +m[4] > 59) return '';
  function two(n) { n = +n; return (n < 10 ? '0' : '') + n; }
  var out = two(m[1]) + ':' + m[2] + '-' + two(m[3]) + ':' + m[4];
  return out.slice(0, 5) < out.slice(6) ? out : '';
}

function httpsUrl_(v) {
  var s = String(v === null || v === undefined ? '' : v).trim();
  return /^https:\/\/[^\s"'<>]+$/i.test(s) ? s.slice(0, 500) : '';
}

/** Точки из листа «Точки» (только активные). Листа нет — пустой список, витрина покажет старый адрес из настроек. */
function readPoints_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_POINTS);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var values = sheet.getDataRange().getValues();
  var col = mapHeaders_(values[0], POINT_COLS);
  if (col.ua < 0) return [];
  var out = [];
  for (var r = 1; r < values.length && out.length < MAX_POINTS; r++) {
    var row = values[r];
    var ua = cell_(row, col.ua);
    if (!ua || (col.active >= 0 && !isYes_(cell_(row, col.active)))) continue;
    var addrUa = cell_(row, col.addrUa), placeUa = cell_(row, col.placeUa), howUa = cell_(row, col.howUa);
    var p = { id: 'p' + (r + 1), ua: ua, ru: cell_(row, col.ru) || ua, a: { ua: addrUa, ru: cell_(row, col.addrRu) || addrUa }, h: [] };
    for (var d = 0; d < 7; d++) p.h.push(col['d' + d] >= 0 ? hoursCell_(row[col['d' + d]]) : '');
    if (placeUa) p.pl = { ua: placeUa, ru: cell_(row, col.placeRu) || placeUa };
    if (howUa) p.how = { ua: howUa, ru: cell_(row, col.howRu) || howUa };
    var tel = cell_(row, col.tel).replace(/[^\d+]/g, '');
    if (/^\+?\d{9,15}$/.test(tel)) p.tel = tel;
    var map = httpsUrl_(cell_(row, col.map));
    if (map) p.map = map;
    var img = normalizePhoto_(cell_(row, col.img));
    if (img) p.img = img;
    var video = httpsUrl_(cell_(row, col.video));
    if (video) p.video = video;
    out.push(p);
  }
  return out;
}

function pointByName_(name) {
  var found = null;
  readPoints_().forEach(function (p) { if (p.ua === name) found = p; });
  return found;
}

/** Сейчас в Киеве: день недели (0 — понедельник) и минуты от начала суток. */
function kyivNow_() {
  var s = Utilities.formatDate(new Date(), 'Europe/Kiev', 'yyyy-MM-dd HH:mm');
  var d = s.slice(0, 10).split('-');
  var dow = new Date(Date.UTC(+d[0], +d[1] - 1, +d[2])).getUTCDay();
  return { dow: (dow + 6) % 7, min: (+s.slice(11, 13)) * 60 + (+s.slice(14, 16)) };
}

var DAYS_SHORT = { ua: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'], ru: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] };
var DAYS_WHEN = {
  ua: ['у понеділок', 'у вівторок', 'у середу', 'у четвер', 'у п’ятницю', 'у суботу', 'у неділю'],
  ru: ['в понедельник', 'во вторник', 'в среду', 'в четверг', 'в пятницу', 'в субботу', 'в воскресенье']
};

/** «Пн: вихідний, Вт–Нд: 07:00–17:00» */
function hoursText_(h, ru) {
  var D = DAYS_SHORT[ru ? 'ru' : 'ua'], parts = [], i = 0;
  while (i < 7) {
    var j = i;
    while (j + 1 < 7 && h[j + 1] === h[i]) j++;
    parts.push((i === j ? D[i] : D[i] + '–' + D[j]) + ': ' + (h[i] ? h[i].replace('-', '–') : (ru ? 'выходной' : 'вихідний')));
    i = j + 1;
  }
  return parts.join(', ');
}

/** «Відкрито зараз, до 17:00» / «Зачинено, відкриємось завтра о 07:00». Считается по киевскому времени. */
function pointStatus_(p, ru) {
  var now = kyivNow_();
  function mins(t) { return (+t.slice(0, 2)) * 60 + (+t.slice(3, 5)); }
  var h = p.h[now.dow];
  if (h) {
    if (now.min >= mins(h.slice(0, 5)) && now.min < mins(h.slice(6))) return (ru ? 'Открыто сейчас, до ' : 'Відкрито зараз, до ') + h.slice(6);
    if (now.min < mins(h.slice(0, 5))) return (ru ? 'Закрыто, откроемся сегодня в ' : 'Зачинено, відкриємось сьогодні о ') + h.slice(0, 5);
  }
  for (var i = 1; i <= 7; i++) {
    var d = (now.dow + i) % 7;
    if (!p.h[d]) continue;
    var when = i === 1 ? 'завтра' : DAYS_WHEN[ru ? 'ru' : 'ua'][d];
    return (ru ? 'Закрыто, откроемся ' : 'Зачинено, відкриємось ') + when + (ru ? ' в ' : ' о ') + p.h[d].slice(0, 5);
  }
  return '';
}

/** Ответ бота на кнопку «Наші точки на ринку». */
function pointsMessage_(st, ru, webapp, hasApp) {
  var L = ru ? 'ru' : 'ua';
  var points = readPoints_();
  var kb = [];
  var text = ru ? '📍 Наши точки на рынке' : '📍 Наші точки на ринку';
  if (!points.length) {
    text += '\n\n' + (ru ? st.address_ru + '\n' + st.hours_ru : st.address_ua + '\n' + st.hours_ua);
  }
  points.forEach(function (p) {
    var lines = ['', '', '🏪 ' + p[L]];
    if (p.a[L]) lines.push(p.a[L]);
    if (p.pl) lines.push(p.pl[L]);
    if (p.how) lines.push(p.how[L]);
    lines.push('🕒 ' + hoursText_(p.h, ru));
    var status = pointStatus_(p, ru);
    if (status) lines.push(status);
    if (p.tel) lines.push('📞 ' + p.tel);
    text += lines.join('\n');
    if (p.map) kb.push([{ text: (ru ? '🧭 Маршрут: ' : '🧭 Маршрут: ') + p[L].slice(0, 40), url: p.map }]);
  });
  if (hasApp) kb.push([{ text: ru ? '🛒 Открыть магазин' : '🛒 Відкрити магазин', web_app: { url: appUrl_(webapp, 'view=points') } }]);
  return { text: text.slice(0, 4000), kb: kb };
}

/** Строка клиенту после подтверждения заказа с самовывозом: куда и когда приходить. */
function pickupText_(o, ru, shop) {
  var p = o.point ? pointByName_(o.point) : null;
  if (!p) return ru ? '\nЖдём вас: ' + shop.address.ru + '\n' + shop.hours.ru : '\nЧекаємо на вас: ' + shop.address.ua + '\n' + shop.hours.ua;
  var L = ru ? 'ru' : 'ua';
  return (ru ? '\nЖдём вас: ' : '\nЧекаємо на вас: ') + p[L] + '\n' + p.a[L] + (p.pl ? ', ' + p.pl[L] : '') + '\n' + hoursText_(p.h, ru);
}

/* ------------------------------ Доставка: как пишется в таблицу ------------------------------ */

var NP_TYPE_UA = { branch: 'відділення', locker: 'поштомат', courier: 'кур’єр' };

/** Колонка «Доставка»: «самовивіз · Точка 1», «Нова пошта», «Нова пошта · поштомат», «Нова пошта · кур’єр». */
function deliveryCell_(o) {
  if (o.delivery === 'np') return 'Нова пошта' + (o.npType && o.npType !== 'branch' ? ' · ' + NP_TYPE_UA[o.npType] : '');
  return 'самовивіз' + (o.point ? ' · ' + o.point : '');
}

function parseDelivery_(text) {
  var s = String(text || ''), low = s.toLowerCase();
  if (low.indexOf('пошта') >= 0) {
    return { delivery: 'np', npType: low.indexOf('поштомат') >= 0 ? 'locker' : (low.indexOf('кур') >= 0 ? 'courier' : 'branch'), point: '' };
  }
  var m = s.match(/·\s*(.+)$/);
  return { delivery: 'pickup', npType: '', point: m ? m[1].trim() : '' };
}

function deliveryLine_(o) {
  if (o.delivery === 'np') {
    var type = o.npType || 'branch';
    if (type === 'courier') return 'Нова пошта, кур’єр: ' + o.city + ', ' + o.branch;
    return 'Нова пошта: ' + o.city + ', ' + (type === 'locker' ? 'поштомат ' : 'відділення ') + o.branch;
  }
  return o.point ? 'Самовивіз: ' + o.point : 'Самовивіз з ринку';
}

function svcTtn_(svcText) {
  try { return String((JSON.parse(svcText || '{}') || {}).ttn || ''); } catch (err) { return ''; }
}

/* ------------------------------ Настройки витрины этапа 8 ------------------------------ */

/** Дополняет «shop» в каталоге: точки, страница «Від саду до столу», сезонная тема, контакт, подсказки НП. */
function shopExtras8_(shop, st) {
  try {
    var points = readPoints_();
    if (points.length) shop.points = points;
  } catch (err) { console.warn('points: ' + err); }
  if (st.story_text_ua || st.story_text_ru) {
    shop.story = {
      title: { ua: st.story_title_ua || st.story_title_ru, ru: st.story_title_ru || st.story_title_ua },
      text: { ua: st.story_text_ua || st.story_text_ru, ru: st.story_text_ru || st.story_text_ua }
    };
    var photos = String(st.story_photos || '').split(/\s+/).map(normalizePhoto_).filter(function (u) { return /^https:\/\//.test(u); }).slice(0, 8);
    if (photos.length) shop.story.img = photos;
  }
  if (st.theme === 'newyear' || st.theme === 'navruz') shop.theme = st.theme;
  var contact = contactUrl_(st);
  if (contact) shop.contact = contact;
  if (npKey_()) shop.np = 1;
}

/* ------------------------------ 1.6 Хит недели и цены фасовок ------------------------------ */

var WEEK_HIT_MIN_ORDERS = 2;

/** «Хіт тижня»: товар в наличии, который за 7 дней был в наибольшем числе заказов (не меньше двух). Нет такого — null. */
function weekHit_(week, products) {
  var best = null, bestW = null;
  products.forEach(function (p) {
    var w = week && week[p.id];
    if (!p.a || !w || w[0] < WEEK_HIT_MIN_ORDERS) return;
    if (!bestW || w[0] > bestW[0] || (w[0] === bestW[0] && w[1] > bestW[1])) { best = p; bestW = w; }
  });
  return best;
}

/** «1 кг = 360; 500 г: 185» → { 1000: 360, 500: 185 } */
function parsePackPrices_(text) {
  var out = {};
  String(text || '').split(/[;\n]+/).forEach(function (part) {
    var m = part.replace(/ /g, ' ').match(/([\d.,]+)\s*(кг|kg|г|g)\s*[:=—–-]\s*([\d.,\s]+)/i);
    if (!m) return;
    var n = parseFloat(m[1].replace(',', '.'));
    var unit = m[2].toLowerCase();
    var g = Math.round(unit === 'кг' || unit === 'kg' ? n * 1000 : n);
    var price = Math.round(toNum_(m[3]));
    if (g > 0 && price > 0) out[g] = price;
  });
  return out;
}

/* ------------------------------ 1.5 Отзывы ------------------------------ */

var SHEET_REVIEWS = 'Відгуки';
var REVIEW_HEAD = ['ID', 'Дата', 'Замовлення', 'Telegram user id', 'Ім\'я', 'Товар ID', 'Товар', 'Оцінка', 'Текст', 'Фото', 'Статус', 'Мова', 'Модерував'];
var RV = { id: 0, date: 1, num: 2, uid: 3, name: 4, pid: 5, pname: 6, rate: 7, text: 8, photo: 9, status: 10, lang: 11, mod: 12 };
var RV_NEW = 'новий', RV_OK = 'схвалено', RV_HIDE = 'приховано';
var REVIEW_MIN_FOR_AVG = 3;
var REVIEW_TEXT_WINDOW_SEC = 7200; // сколько после оценки бот ждёт текст и фото отзыва

function ensureReviewsSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_REVIEWS);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_REVIEWS);
    sheet.getRange(1, 1, 1, REVIEW_HEAD.length).setValues([REVIEW_HEAD]).setFontWeight('bold');
    sheet.setFrozenRows(1);
    sheet.getRange('B:B').setNumberFormat('dd.MM.yyyy HH:mm');
  }
  return sheet;
}

function reviewRows_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_REVIEWS);
  if (!sheet || sheet.getLastRow() < 2) return { sheet: sheet, values: [] };
  return { sheet: sheet, values: sheet.getRange(2, 1, sheet.getLastRow() - 1, REVIEW_HEAD.length).getValues() };
}

/** { id товара: { s: сумма оценок, n: число отзывов } } — только одобренные. */
function reviewStats_() {
  var out = {};
  reviewRows_().values.forEach(function (row) {
    var rate = Math.round(toNum_(row[RV.rate]));
    var pid = String(row[RV.pid]).trim();
    if (String(row[RV.status]).trim() !== RV_OK || !pid || rate < 1 || rate > 5) return;
    var x = out[pid] || (out[pid] = { s: 0, n: 0 });
    x.s += rate; x.n++;
  });
  return out;
}

function reviewDate_(v) {
  return Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime()) ? Utilities.formatDate(v, 'Europe/Kiev', 'dd.MM.yyyy') : '';
}

/** Одобренные отзывы о товаре для витрины: имя (только имя), дата, оценка, текст, фото. */
function reviewsFor_(pid) {
  pid = clean_(pid, 40);
  if (!pid) return { ok: false, error: 'bad_form' };
  var cache = CacheService.getScriptCache();
  var key = 'rv_' + pid;
  var cached = cache.get(key);
  if (cached) return JSON.parse(cached);
  var list = [];
  var values = reviewRows_().values;
  for (var r = values.length - 1; r >= 0 && list.length < 30; r--) {
    var row = values[r];
    if (String(row[RV.pid]).trim() !== pid || String(row[RV.status]).trim() !== RV_OK) continue;
    var rate = Math.round(toNum_(row[RV.rate]));
    if (rate < 1 || rate > 5) continue;
    var item = { n: String(row[RV.name]).trim().split(/\s+/)[0].slice(0, 24), d: reviewDate_(row[RV.date]), r: rate };
    var text = String(row[RV.text]).trim();
    if (text) item.t = text;
    var photo = normalizePhoto_(String(row[RV.photo]).trim());
    if (/^https:\/\//.test(photo)) item.img = photo;
    list.push(item);
  }
  var out = { ok: true, reviews: list };
  cache.put(key, JSON.stringify(out), CACHE_TTL_SEC);
  return out;
}

function reviewCacheDrop_(pids) {
  var cache = CacheService.getScriptCache();
  pids.forEach(function (pid) { cache.remove('rv_' + pid); });
  clearCatalogCache_();
}

function nextReviewId_(values) {
  var max = 0;
  values.forEach(function (row) { var m = String(row[RV.id]).match(/^R-(\d+)$/); if (m) max = Math.max(max, parseInt(m[1], 10)); });
  return max;
}

function reviewKeyboard_(num) {
  return [[1, 2, 3, 4, 5].map(function (n) { return { text: n + ' ⭐', callback_data: 'rv:' + num + ':' + n }; })];
}

/**
 * Раз в день: просим оценить заказы, которые стали «виконано» review_days дней назад.
 * Один раз на заказ. Тем, кто нажал «Більше не нагадувати», не пишем.
 */
function askReviews_() {
  var st = readSettings_();
  var days = Math.round(toNum_(st.review_days));
  if (!(days >= 1)) return 0;
  var token = PropertiesService.getScriptProperties().getProperty('BOT_TOKEN');
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ORDERS);
  if (!token || !sheet || sheet.getLastRow() < 2) return 0;
  var col = orderCols_(sheet);
  if (col.uid < 0 || col.svc < 0) return 0;
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  var stops = reminderStops_();
  var now = Date.now(), day = 24 * 3600 * 1000, sent = 0;
  values.forEach(function (row, r) {
    if (sent >= 30) return;
    var uid = cell_(row, col.uid);
    if (!uid || cell_(row, col.status) !== 'виконано' || cell_(row, col.source).indexOf('test') >= 0) return;
    var svc;
    try { svc = JSON.parse(cell_(row, col.svc) || '{}') || {}; } catch (err) { return; }
    if (!svc.dn || svc.rv) return;
    var age = (now - svc.dn) / day;
    if (age < days) return;
    svc.rv = 1; // отмечаем в любом случае: второй просьбы не будет
    sheet.getRange(r + 2, col.svc + 1).setValue(JSON.stringify(svc));
    if (age >= days + 14 || stops[uid]) return;
    var ru = cell_(row, col.lang) === 'ru';
    var num = cell_(row, col.num);
    var kb = reviewKeyboard_(num);
    kb.push([{ text: ru ? 'Больше не напоминать' : 'Більше не нагадувати', callback_data: 'nr' }]);
    var res = tg_(token, 'sendMessage', {
      chat_id: uid,
      text: ru ? 'Как вам заказ ' + num + '? Оцените, пожалуйста, от 1 до 5 — это поможет другим покупателям.'
               : 'Як вам замовлення ' + num + '? Оцініть, будь ласка, від 1 до 5 — це допоможе іншим покупцям.',
      reply_markup: { inline_keyboard: kb }
    });
    if (res.ok) sent++;
  });
  return sent;
}

/** Строки отзывов этого клиента по этому заказу: [{ at: номер строки листа, row }]. */
function reviewOf_(num, uid) {
  var data = reviewRows_();
  var out = [];
  data.values.forEach(function (row, r) {
    if (String(row[RV.num]).trim() === num && String(row[RV.uid]).trim() === String(uid)) out.push({ at: r + 2, row: row });
  });
  return { sheet: data.sheet, rows: out, all: data.values };
}

/** Клиент поставил оценку заказу: по строке на каждый товар заказа. Возвращает строки или null, если заказ не его. */
function reviewRate_(num, uid, rate, firstName) {
  var found = findOrder_(num);
  if (!found || found.o.uid !== String(uid) || found.o.status !== 'виконано' || String(found.o.source).indexOf('test') >= 0) return null;
  var ids = [];
  try { (JSON.parse(found.o.svc || '{}').i || []).forEach(function (it) { if (ids.indexOf(String(it[0])) < 0) ids.push(String(it[0])); }); } catch (err) { ids = []; }
  if (!ids.length) return null;
  var names = {};
  try { JSON.parse(getCatalogJson_()).products.forEach(function (p) { names[p.id] = p.ua; }); } catch (err) { names = {}; }
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sheet = ensureReviewsSheet_();
    var cur = reviewOf_(num, uid);
    if (cur.rows.length) { // оценку можно поменять, пока идёт разговор с ботом
      cur.rows.forEach(function (x) {
        sheet.getRange(x.at, RV.rate + 1).setValue(rate);
        sheet.getRange(x.at, RV.status + 1).setValue(RV_NEW);
      });
    } else {
      var next = nextReviewId_(cur.all);
      ids.slice(0, 20).forEach(function (pid) {
        var id = String(++next);
        while (id.length < 4) id = '0' + id;
        sheet.appendRow(['R-' + id, new Date(), num, '\'' + uid, safeCell_(clean_(firstName || found.o.name, 40)), pid,
          safeCell_(names[pid] || pid), rate, '', '', RV_NEW, found.o.lang, '']);
      });
    }
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
  reviewCacheDrop_(ids);
  return reviewOf_(num, uid).rows;
}

function reviewListMarkup_(num, rows) {
  return { inline_keyboard: rows.slice(0, 20).map(function (x, i) {
    return [{ text: String(x.row[RV.pname]).slice(0, 40) + ' — ' + x.row[RV.rate] + ' ⭐', callback_data: 'ri:' + num + ':' + i }];
  }) };
}

/** Сообщение модераторам (право «Відгуки») с кнопками «Схвалити / Приховати». */
function notifyReview_(token, props, num, uid) {
  var rows = reviewOf_(num, uid).rows;
  if (!rows.length) return;
  var first = rows[0].row;
  var lines = ['📝 <b>Відгук на модерацію</b> · ' + escHtml_(num), '👤 ' + escHtml_(first[RV.name]), ''];
  rows.forEach(function (x) { lines.push('• ' + escHtml_(x.row[RV.pname]) + ' — ' + escHtml_(x.row[RV.rate]) + ' ⭐'); });
  var text = String(first[RV.text]).trim();
  if (text) lines.push('', '«' + escHtml_(text) + '»');
  var photo = String(first[RV.photo]).trim();
  var markup = { inline_keyboard: [[{ text: '✅ Схвалити', callback_data: 'rm:' + num + ':y' }, { text: '🚫 Приховати', callback_data: 'rm:' + num + ':n' }]] };
  adminList_(props).filter(function (a) { return a.active && a.perms.reviews; }).forEach(function (a) {
    var fileId = photo.indexOf('tg:') === 0 ? photo.slice(3).split(' ')[0] : '';
    var res = fileId
      ? tg_(token, 'sendPhoto', { chat_id: a.id, photo: fileId, caption: lines.join('\n').slice(0, 1000), parse_mode: 'HTML', reply_markup: markup })
      : { ok: false };
    if (!res.ok) tg_(token, 'sendMessage', { chat_id: a.id, text: lines.join('\n').slice(0, 4000), parse_mode: 'HTML', reply_markup: markup });
  });
}

/** Фото из Telegram → файл в папке фото на Google Drive. Не получилось — пустая строка (file_id остаётся в таблице). */
function saveTgPhoto_(token, fileId, name) {
  try {
    var info = tg_(token, 'getFile', { file_id: fileId });
    if (!info.ok || !info.result || !info.result.file_path) return '';
    var resp = UrlFetchApp.fetch('https://api.telegram.org/file/bot' + token + '/' + info.result.file_path, { muteHttpExceptions: true });
    if (resp.getResponseCode() !== 200) return '';
    var blob = resp.getBlob().setName(name + '.jpg');
    if (blob.getBytes().length > 5000000) return '';
    var file = photoFolder_().createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return 'https://drive.google.com/file/d/' + file.getId() + '/view';
  } catch (err) {
    console.warn('review photo: ' + err);
    return '';
  }
}

/** Текст и (или) фото отзыва от клиента, который только что поставил оценку. */
function reviewText_(msg, num, token, props) {
  var uid = String(msg.chat.id);
  var text = multiline_(msg.text || msg.caption || '', 600);
  var fileId = msg.photo && msg.photo.length ? msg.photo[msg.photo.length - 1].file_id : '';
  var photoCell = '';
  if (fileId) {
    var link = saveTgPhoto_(token, fileId, 'review-' + num + '-' + Date.now());
    photoCell = link || 'tg:' + fileId;
  }
  var pids = [];
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var cur = reviewOf_(num, uid);
    if (!cur.rows.length) return false;
    cur.rows.forEach(function (x) {
      if (text) cur.sheet.getRange(x.at, RV.text + 1).setValue(safeCell_(text));
      if (photoCell) cur.sheet.getRange(x.at, RV.photo + 1).setValue(photoCell);
      cur.sheet.getRange(x.at, RV.status + 1).setValue(RV_NEW);
      pids.push(String(x.row[RV.pid]));
    });
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
  reviewCacheDrop_(pids);
  var ru = String((msg.from && msg.from.language_code) || '').toLowerCase().indexOf('ru') === 0;
  tg_(token, 'sendMessage', { chat_id: uid, text: ru ? 'Спасибо! Отзыв появится в магазине после проверки.' : 'Дякуємо! Відгук з’явиться в магазині після перевірки.' });
  notifyReview_(token, props, num, uid);
  return true;
}

/** Отзывы для админ-панели: последние 100, новые сверху. */
function listReviews_() {
  var values = reviewRows_().values;
  var list = [];
  for (var r = values.length - 1; r >= 0 && list.length < 100; r--) {
    var row = values[r];
    if (!String(row[RV.id]).trim()) continue;
    var photo = normalizePhoto_(String(row[RV.photo]).trim());
    list.push({ id: String(row[RV.id]).trim(), date: reviewDate_(row[RV.date]), num: String(row[RV.num]).trim(), name: String(row[RV.name]).trim(),
      pid: String(row[RV.pid]).trim(), pname: String(row[RV.pname]).trim(), rate: Math.round(toNum_(row[RV.rate])),
      text: String(row[RV.text]).trim(), img: /^https:\/\//.test(photo) ? photo : '', hasPhoto: !!String(row[RV.photo]).trim(),
      status: String(row[RV.status]).trim() || RV_NEW });
  }
  return { ok: true, reviews: list };
}

/**
 * Одобрить или скрыть отзыв. key — ID отзыва (R-0001) или номер заказа (P-0008: все отзывы этого заказа).
 * Текст и оценку админ изменить не может: меняется только статус.
 */
function moderateReview_(key, approve, token) {
  var status = approve ? RV_OK : RV_HIDE;
  var pids = [], changed = 0;
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var data = reviewRows_();
    data.values.forEach(function (row, r) {
      var match = /^R-/.test(key) ? String(row[RV.id]).trim() === key : String(row[RV.num]).trim() === key;
      if (!match) return;
      var was = String(row[RV.status]).trim();
      pids.push(String(row[RV.pid]).trim());
      if (was === status) return;
      data.sheet.getRange(r + 2, RV.status + 1).setValue(status);
      data.sheet.getRange(r + 2, RV.mod + 1).setValue(safeCell_(actor_ ? actor_.name : ''));
      logAction_('Відгук', String(row[RV.id]).trim() + ' · ' + String(row[RV.pname]).trim(), was, status);
      changed++;
    });
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
  if (!pids.length) return { ok: false, error: 'not_found' };
  reviewCacheDrop_(pids);
  var out = listReviews_();
  out.changed = changed;
  out.status = status;
  return out;
}

/* ------------------------------ 1.6 Брошенная корзина ------------------------------ */

var SHEET_CARTS = 'Кошики';
var CART_HEAD = ['Telegram user id', 'Оновлено', 'Склад', 'Мова', 'Нагадано', 'Стоп'];
var CART_REMIND_EVERY_DAYS = 7;
var CART_REMIND_MAX_AGE_HOURS = 48;

function ensureCartsSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_CARTS);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_CARTS);
    sheet.getRange(1, 1, 1, CART_HEAD.length).setValues([CART_HEAD]).setFontWeight('bold');
    sheet.setFrozenRows(1);
    sheet.getRange('B:B').setNumberFormat('dd.MM.yyyy HH:mm');
    sheet.getRange('E:E').setNumberFormat('dd.MM.yyyy HH:mm');
  }
  return sheet;
}

function cartRow_(sheet, uid) {
  if (!sheet || sheet.getLastRow() < 2) return 0;
  var ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
  for (var r = 0; r < ids.length; r++) if (String(ids[r][0]).trim() === String(uid)) return r + 2;
  return 0;
}

/** Витрина присылает состав корзины (без цен): [[id, граммы, количество], …]. Пустой список — корзину очистили. */
function handleCart_(body) {
  var token = PropertiesService.getScriptProperties().getProperty('BOT_TOKEN');
  if (!token) return { ok: false, error: 'not_configured' };
  var user = body.initData ? verifyInitData_(String(body.initData), token) : null;
  if (!user) return { ok: false, error: 'bad_auth' };
  var uid = String(user.id);
  if (!Array.isArray(body.items) || body.items.length > 50) return { ok: false, error: 'bad_form' };
  var items = [];
  body.items.forEach(function (it) {
    var id = String((it && it[0]) || ''), g = Math.max(0, Math.floor(Number(it && it[1]) || 0)), q = Math.floor(Number(it && it[2]) || 0);
    if (/^[A-Za-zА-Яа-яІЇЄҐіїєґ0-9_-]{1,40}$/.test(id) && g <= 100000 && q >= 1 && q <= 99) items.push([id, g, q]);
  });
  var cache = CacheService.getScriptCache();
  var rlKey = 'crt_' + uid;
  var count = parseInt(cache.get(rlKey), 10) || 0;
  if (count >= 40) return { ok: false, error: 'rate_limit' };
  cache.put(rlKey, String(count + 1), 3600);
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sheet = ensureCartsSheet_();
    var at = cartRow_(sheet, uid);
    var lang = body.lang === 'ru' ? 'ru' : 'ua';
    if (at) sheet.getRange(at, 2, 1, 3).setValues([[new Date(), items.length ? JSON.stringify(items) : '', lang]]);
    else if (items.length) sheet.appendRow(['\'' + uid, new Date(), JSON.stringify(items), lang, '', '']);
  } finally {
    lock.releaseLock();
  }
  return { ok: true };
}

/** Заказ оформлен — корзина больше не «брошенная». */
function clearCart_(uid) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_CARTS);
  var at = cartRow_(sheet, uid);
  if (at) sheet.getRange(at, 3).setValue('');
}

function stopCartReminders_(uid) {
  if (!/^\d+$/.test(String(uid))) return;
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sheet = ensureCartsSheet_();
    var at = cartRow_(sheet, uid);
    if (at) sheet.getRange(at, 6).setValue('так');
    else sheet.appendRow(['\'' + uid, new Date(), '', '', '', 'так']);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Раз в час: если корзина лежит cart_remind_hours часов и заказа нет — одно сообщение «Ваш кошик чекає».
 * Одна корзина — одно напоминание, одному человеку — не чаще раза в 7 дней, после «Не нагадувати» — никогда.
 */
function remindCarts_() {
  var st = readSettings_();
  var hours = Math.round(toNum_(st.cart_remind_hours));
  if (!(hours >= 1)) return 0;
  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty('BOT_TOKEN');
  var webapp = props.getProperty('WEBAPP_URL');
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_CARTS);
  if (!token || !/^https:\/\//.test(webapp || '') || !sheet || sheet.getLastRow() < 2) return 0;
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, CART_HEAD.length).getValues();
  var byId = null;
  var now = Date.now(), hour = 3600 * 1000, sent = 0;
  function time(v) { return Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime()) ? v.getTime() : 0; }
  values.forEach(function (row, r) {
    if (sent >= 30) return;
    var uid = String(row[0]).trim();
    var updated = time(row[1]), reminded = time(row[4]);
    if (!/^\d+$/.test(uid) || !String(row[2]).trim() || isYes_(row[5]) || !updated) return;
    var age = (now - updated) / hour;
    if (age < hours || age >= CART_REMIND_MAX_AGE_HOURS) return;
    if (reminded && (reminded >= updated || now - reminded < CART_REMIND_EVERY_DAYS * 24 * hour)) return;
    var items;
    try { items = JSON.parse(String(row[2])); } catch (err) { return; }
    if (!byId) {
      byId = {};
      JSON.parse(getCatalogJson_()).products.forEach(function (p) { byId[p.id] = p; });
    }
    var ru = String(row[3]).trim() === 'ru';
    var names = [];
    (items || []).forEach(function (it) {
      var p = byId[String(it[0])];
      if (p && p.a && names.length < 6) names.push('• ' + ((ru && p.ru) || p.ua) + (it[1] ? ' ' + weightLabel_(it[1]) : '') + ' × ' + it[2]);
    });
    if (!names.length) return; // всё, что было в корзине, закончилось — не зовём
    sheet.getRange(r + 2, 5).setValue(new Date()); // отмечаем до отправки: второй попытки не будет
    var res = tg_(token, 'sendMessage', {
      chat_id: uid,
      text: (ru ? 'Ваша корзина ждёт:\n' : 'Ваш кошик чекає:\n') + names.join('\n'),
      reply_markup: { inline_keyboard: [
        [{ text: ru ? '🛒 Оформить' : '🛒 Оформити', web_app: { url: appUrl_(webapp, 'view=cart') } }],
        [{ text: ru ? 'Не напоминать' : 'Не нагадувати', callback_data: 'nc' }]
      ] }
    });
    if (res.ok) sent++;
  });
  return sent;
}

/* ------------------------------ 1.7 ТТН ------------------------------ */

var TTN_TRACK_URL = 'https://novaposhta.ua/tracking/?cargo_number=';

/** Бот спрашивает номер накладной у админа, который нажал «Відправлено». */
function askTtn_(token, chatId, adminId, num) {
  CacheService.getScriptCache().put('ttn_' + adminId, num, 21600);
  tg_(token, 'sendMessage', {
    chat_id: chatId,
    text: '📮 ТТН для замовлення ' + num + ': надішліть номер накладної відповіддю на це повідомлення (або просто наступним повідомленням).',
    reply_markup: { inline_keyboard: [[{ text: 'Пропустити', callback_data: 'tx:' + num }]] }
  });
}

/** Записывает ТТН в заказ, обновляет сообщения админов и пишет клиенту номер с кнопкой «Відстежити». */
function setTtn_(num, ttn, token) {
  ttn = String(ttn || '').replace(/[\s-]+/g, '');
  if (!/^\d{10,20}$/.test(ttn)) return { ok: false, error: 'bad_ttn' };
  var found, was;
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    found = findOrder_(num);
    if (!found) return { ok: false, error: 'not_found' };
    if (found.col.svc < 0) return { ok: false, error: 'server_error' };
    var svc;
    try { svc = JSON.parse(found.o.svc || '{}') || {}; } catch (err) { svc = {}; }
    was = String(svc.ttn || '');
    svc.ttn = ttn;
    found.o.svc = JSON.stringify(svc);
    found.sheet.getRange(found.rowIndex, found.col.svc + 1).setValue(found.o.svc);
    if (found.col.ttn >= 0) found.sheet.getRange(found.rowIndex, found.col.ttn + 1).setValue('\'' + ttn);
    SpreadsheetApp.flush();
    if (was !== ttn) logAction_('Замовлення: ТТН', num, was, ttn);
  } finally {
    lock.releaseLock();
  }
  var o = found.o;
  var targets = [];
  try { targets = (JSON.parse(o.svc || '{}').m) || []; } catch (err) { targets = []; }
  targets.forEach(function (t) {
    tg_(token, 'editMessageText', { chat_id: t[0], message_id: t[1], text: adminText_(o, ''), parse_mode: 'HTML',
      disable_web_page_preview: true, reply_markup: adminKeyboard_(o.num) });
  });
  var told = null;
  if (was !== ttn && o.uid && String(o.source).indexOf('test') < 0) {
    var ru = o.lang === 'ru';
    told = !!tg_(token, 'sendMessage', {
      chat_id: o.uid,
      text: ru ? '📮 Заказ ' + num + ' едет Новой почтой. Номер накладной (ТТН): ' + ttn
               : '📮 Замовлення ' + num + ' їде Новою поштою. Номер накладної (ТТН): ' + ttn,
      reply_markup: { inline_keyboard: [[{ text: ru ? 'Отследить' : 'Відстежити', url: TTN_TRACK_URL + ttn }]] }
    }).ok;
  }
  return { ok: true, ttn: ttn, told: told };
}

/* ------------------------------ Бот: новые сообщения и кнопки этапа 8 ------------------------------ */

/** true — сообщение обработано здесь (номер ТТН от админа или текст/фото отзыва от клиента). */
function handleMessage8_(msg, token, props) {
  if (!msg.chat || msg.chat.type !== 'private') return false;
  var uid = String(msg.chat.id);
  var cache = CacheService.getScriptCache();
  var text = typeof msg.text === 'string' ? msg.text.trim() : '';
  // 1) Админ прислал номер ТТН: ответом на вопрос бота или следующим сообщением после «Відправлено».
  if (/^[\d\s-]{10,26}$/.test(text)) {
    var me = adminAccess_(uid, props);
    if (me && me.perms.st) {
      var reply = msg.reply_to_message && String(msg.reply_to_message.text || '').match(/ТТН для замовлення (P-\d+)/);
      var num = reply ? reply[1] : cache.get('ttn_' + uid);
      if (num) {
        actor_ = { id: uid, name: clean_((msg.from && msg.from.first_name) || me.name || '', 60) };
        var res = setTtn_(num, text, token);
        cache.remove('ttn_' + uid);
        tg_(token, 'sendMessage', { chat_id: uid, text: res.ok
          ? 'ТТН ' + res.ttn + ' записано в замовлення ' + num + '.' + (res.told ? ' Клієнт отримав номер і кнопку «Відстежити».' : (res.told === false ? ' Клієнту написати не вдалося.' : ''))
          : (res.error === 'bad_ttn' ? 'Це не схоже на номер ТТН (потрібно 10–20 цифр). Надішліть ще раз.' : 'Замовлення ' + num + ' не знайдено.') });
        return true;
      }
    }
  }
  // 2) Клиент после оценки прислал текст и (или) фото отзыва.
  var pending = cache.get('rvt_' + uid);
  if (pending && (msg.photo && msg.photo.length || (text && text.charAt(0) !== '/'))) {
    if (reviewText_(msg, pending, token, props)) {
      cache.put('rvt_' + uid, pending, 900); // ещё немного ждём: текст и фото могут прийти двумя сообщениями
      return true;
    }
  }
  return false;
}

/** true — нажатие обработано здесь: отзывы (rv, rp, ri, rq, rm), корзина (nc), ТТН (tx). */
function handleCallback8_(cq, token, props, answer) {
  var data = String(cq.data || '');
  var fromId = String(cq.from && cq.from.id);
  var chatId = cq.message && cq.message.chat ? String(cq.message.chat.id) : fromId;
  var mid = cq.message ? cq.message.message_id : 0;
  var ru = String((cq.from && cq.from.language_code) || '').toLowerCase().indexOf('ru') === 0;
  var m;
  function noButtons() { if (mid) tg_(token, 'editMessageReplyMarkup', { chat_id: chatId, message_id: mid, reply_markup: { inline_keyboard: [] } }); }

  if (data === 'nc') { // клиент отказался от напоминаний о корзине
    stopCartReminders_(fromId);
    answer(ru ? 'Больше не напоминаем' : 'Більше не нагадуємо');
    noButtons();
    return true;
  }
  if ((m = data.match(/^rv:(P-\d+):([1-5])$/))) { // оценка заказа
    var rows = reviewRate_(m[1], fromId, +m[2], cq.from && cq.from.first_name);
    if (!rows) { answer(ru ? 'Заказ не найден' : 'Замовлення не знайдено'); return true; }
    answer(ru ? 'Спасибо!' : 'Дякуємо!');
    noButtons();
    CacheService.getScriptCache().put('rvt_' + fromId, m[1], REVIEW_TEXT_WINDOW_SEC);
    var kb = rows.length > 1 ? [[{ text: ru ? 'Оценить товары по отдельности' : 'Оцінити товари окремо', callback_data: 'rp:' + m[1] }]] : [];
    var payload = { chat_id: chatId, text: ru
      ? 'Спасибо за оценку: ' + m[2] + ' из 5.\nЕсли хотите, напишите пару слов о заказе ответным сообщением — можно с фото. Это необязательно.'
      : 'Дякуємо за оцінку: ' + m[2] + ' з 5.\nЯкщо хочете, напишіть кілька слів про замовлення повідомленням у відповідь — можна з фото. Це необов’язково.' };
    if (kb.length) payload.reply_markup = { inline_keyboard: kb };
    tg_(token, 'sendMessage', payload);
    notifyReview_(token, props, m[1], fromId);
    return true;
  }
  if ((m = data.match(/^rp:(P-\d+)$/))) { // список товаров заказа: оценить каждый отдельно
    var list = reviewOf_(m[1], fromId).rows;
    answer('');
    if (list.length) tg_(token, 'sendMessage', { chat_id: chatId, text: ru ? 'Нажмите на товар, чтобы изменить его оценку:' : 'Натисніть на товар, щоб змінити його оцінку:',
      reply_markup: reviewListMarkup_(m[1], list) });
    return true;
  }
  if ((m = data.match(/^ri:(P-\d+):(\d{1,2})$/))) { // выбран товар — показываем 1–5
    var one = reviewOf_(m[1], fromId).rows[+m[2]];
    answer('');
    if (one && mid) tg_(token, 'editMessageText', { chat_id: chatId, message_id: mid, text: String(one.row[RV.pname]),
      reply_markup: { inline_keyboard: [[1, 2, 3, 4, 5].map(function (n) { return { text: n + ' ⭐', callback_data: 'rq:' + m[1] + ':' + m[2] + ':' + n }; })] } });
    return true;
  }
  if ((m = data.match(/^rq:(P-\d+):(\d{1,2}):([1-5])$/))) { // оценка отдельного товара
    var cur = reviewOf_(m[1], fromId);
    var x = cur.rows[+m[2]];
    if (!x) { answer(''); return true; }
    cur.sheet.getRange(x.at, RV.rate + 1).setValue(+m[3]);
    cur.sheet.getRange(x.at, RV.status + 1).setValue(RV_NEW);
    SpreadsheetApp.flush();
    reviewCacheDrop_([String(x.row[RV.pid])]);
    answer(ru ? 'Оценка сохранена' : 'Оцінку збережено');
    var again = reviewOf_(m[1], fromId).rows;
    if (mid) tg_(token, 'editMessageText', { chat_id: chatId, message_id: mid, text: ru ? 'Нажмите на товар, чтобы изменить его оценку:' : 'Натисніть на товар, щоб змінити його оцінку:',
      reply_markup: reviewListMarkup_(m[1], again) });
    return true;
  }
  if ((m = data.match(/^rm:(P-\d+):([yn])$/))) { // модерация: только админ с правом «Відгуки»
    var mod = adminAccess_(fromId, props) || adminAccess_(chatId, props);
    if (!mod || !mod.perms.reviews) { answer('У вас немає права «Відгуки»'); return true; }
    actor_ = { id: fromId, name: clean_((cq.from && cq.from.first_name) || mod.name || '', 60) };
    var res = moderateReview_(m[1], m[2] === 'y', token);
    answer(res.ok ? 'Відгук: ' + res.status : 'Відгук не знайдено');
    return true;
  }
  if ((m = data.match(/^tx:(P-\d+)$/))) { // «Пропустити» в вопросе про ТТН
    var adm = adminAccess_(fromId, props) || adminAccess_(chatId, props);
    if (!adm) { answer('Немає доступу'); return true; }
    CacheService.getScriptCache().remove('ttn_' + fromId);
    answer('Без ТТН');
    if (mid) tg_(token, 'editMessageText', { chat_id: chatId, message_id: mid, text: '📮 ТТН для замовлення ' + m[1] + ': пропущено. Номер можна додати пізніше в адмін-панелі.' });
    return true;
  }
  return false;
}

/* ------------------------------ 1.7 Нова пошта: заготовка под API ------------------------------ */
/*
 * Без Script Property NP_API_KEY модуль выключен: город и отделение клиент вводит руками.
 * С ключом витрина получает подсказки: ?action=np.city&q=хар → города, ?action=np.wh&city=<ref>&q=12 → отделения.
 * Ответы Новой почты кэшируются на 6 часов. С настоящим ключом модуль ещё не проверялся.
 */

var NP_API_URL = 'https://api.novaposhta.ua/v2.0/json/';
var NP_MAX_CALLS_PER_HOUR = 1500;

function npKey_() {
  return String(PropertiesService.getScriptProperties().getProperty('NP_API_KEY') || '').trim();
}

/** Запрос к API Новой почты с кэшем. null — модуль выключен или запрос не удался. */
function npCall_(method, properties) {
  var key = npKey_();
  if (!key) return null;
  var cache = CacheService.getScriptCache();
  var cacheKey = ('np_' + method + '_' + JSON.stringify(properties)).slice(0, 240);
  var cached = cache.get(cacheKey);
  if (cached) return JSON.parse(cached);
  var calls = parseInt(cache.get('np_calls'), 10) || 0;
  if (calls >= NP_MAX_CALLS_PER_HOUR) return null;
  cache.put('np_calls', String(calls + 1), 3600);
  try {
    var res = UrlFetchApp.fetch(NP_API_URL, { method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      payload: JSON.stringify({ apiKey: key, modelName: 'Address', calledMethod: method, methodProperties: properties }) });
    var data = JSON.parse(res.getContentText());
    if (!data || !data.success || !Array.isArray(data.data)) return null;
    var text = JSON.stringify(data.data);
    if (text.length < 90000) cache.put(cacheKey, text, 21600);
    return data.data;
  } catch (err) {
    console.warn('np: ' + err);
    return null;
  }
}

function npCities_(q) {
  if (!npKey_()) return { ok: false, error: 'off' };
  q = clean_(q, 40);
  if (q.length < 2) return { ok: true, list: [] };
  var data = npCall_('searchSettlements', { CityName: q, Limit: '8' });
  if (!data) return { ok: false, error: 'np_error' };
  var list = [];
  ((data[0] && data[0].Addresses) || []).forEach(function (a) {
    if (a && a.DeliveryCity && a.Present) list.push({ n: String(a.Present).slice(0, 120), s: String(a.MainDescription || a.Present).slice(0, 60), ref: String(a.DeliveryCity) });
  });
  return { ok: true, list: list };
}

function npWarehouses_(cityRef, q, type) {
  if (!npKey_()) return { ok: false, error: 'off' };
  if (!/^[0-9a-f-]{36}$/i.test(cityRef)) return { ok: false, error: 'bad_form' };
  var data = npCall_('getWarehouses', { CityRef: cityRef, FindByString: clean_(q, 40), Limit: '30' });
  if (!data) return { ok: false, error: 'np_error' };
  var list = [];
  data.forEach(function (w) {
    if (!w || !w.Description) return;
    var locker = String(w.CategoryOfWarehouse || '') === 'Postomat';
    if ((type === 'locker') !== locker) return;
    if (list.length < 12) list.push({ n: String(w.Description).slice(0, 140), num: String(w.Number || '') });
  });
  return { ok: true, list: list };
}

/* ------------------------------ Разовая настройка этапа 8 ------------------------------ */

/**
 * Меню PAMIR → «Етап 8: створити листи й колонки» (или запуск из редактора). Можно запускать повторно:
 * создаёт только то, чего ещё нет. Существующие данные не трогает.
 */
function setupStage8() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var done = [];
  if (!ss.getSheetByName(SHEET_POINTS)) {
    var sheet = ss.insertSheet(SHEET_POINTS);
    var open = '7:00-17:00', off = 'вихідний';
    var map = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent('Центральний ринок, Харків');
    sheet.getRange(1, 1, 1, POINT_HEAD.length).setValues([POINT_HEAD]).setFontWeight('bold');
    sheet.getRange(2, 1, 2, POINT_HEAD.length).setValues([
      ['Точка 1 — критий павільйон', 'Точка 1 — крытый павильон', SHOP_DEFAULTS.PICKUP_ADDRESS_UA, SHOP_DEFAULTS.PICKUP_ADDRESS_RU,
        'Ряд 3, місце 12', 'Ряд 3, место 12', 'Від головного входу — третій ряд ліворуч', 'От главного входа — третий ряд слева',
        off, open, open, open, open, open, open, '', map, '', '', 'так'],
      ['Точка 2 — критий павільйон', 'Точка 2 — крытый павильон', SHOP_DEFAULTS.PICKUP_ADDRESS_UA, SHOP_DEFAULTS.PICKUP_ADDRESS_RU,
        'Ряд 5, місце 7', 'Ряд 5, место 7', 'Від головного входу — п’ятий ряд праворуч', 'От главного входа — пятый ряд справа',
        off, open, open, open, open, open, open, '', map, '', '', 'так']
    ]);
    sheet.setFrozenRows(1);
    done.push('лист «Точки» (з прикладом — замініть на свої дані)');
  }
  if (!ss.getSheetByName(SHEET_REVIEWS)) { ensureReviewsSheet_(); done.push('лист «Відгуки»'); }
  if (!ss.getSheetByName(SHEET_CARTS)) { ensureCartsSheet_(); done.push('лист «Кошики»'); }

  var products = ss.getSheetByName(SHEET_PRODUCTS);
  if (products) {
    var pcol = mapHeaders_(products.getRange(1, 1, 1, products.getLastColumn()).getValues()[0], PRODUCT_COLS);
    [['sort', 'Сорт'], ['harvest', 'Урожай'], ['origin', 'Походження'], ['fresh', 'Свіжа поставка'], ['hint', 'Підказка до ваги'],
      ['hintRu', 'Подсказка к весу'], ['packPrices', 'Ціни фасувань']].forEach(function (c) {
      if (pcol[c[0]] >= 0) return;
      products.getRange(1, products.getLastColumn() + 1).setValue(c[1]).setFontWeight('bold');
      done.push('колонка «' + c[1] + '» у «Товари»');
    });
  }
  var orders = ensureOrdersSheet_();
  if (orderCols_(orders).ttn < 0) {
    orders.getRange(1, orders.getLastColumn() + 1).setValue('ТТН').setFontWeight('bold');
    done.push('колонка «ТТН» у «Замовлення»');
  }
  clearCatalogCache_();
  var text = done.length ? 'Готово, створено:\n• ' + done.join('\n• ') : 'Усе вже створено раніше, нічого не змінено.';
  console.log(text);
  try { SpreadsheetApp.getUi().alert(text); } catch (err) { /* запуск из редактора */ }
  return done;
}

/* ======================================================================== */
/* ЭТАП 8, волна 2а · А4: архив товаров, удаление категорий и админов        */
/* ======================================================================== */
/*
 * Товар удаляется в два шага: «В архів» (строка переезжает из «Товари» в «Архів товарів») и
 * «Видалити назавжди» (строка стирается из архива). Из архива товар можно вернуть — «Відновити».
 * Заказы в листе «Замовлення» не меняются: состав там записан текстом.
 */

var SHEET_ARCHIVE = 'Архів товарів';
var ARCHIVE_AT = 'Дата архівації';
var ARCHIVE_BY = 'Хто архівував';
var PROP_DELETED_IDS = 'DELETED_IDS';  // ID товаров, удалённых навсегда (через запятую). Не секрет.
var PROP_ID_MAX = 'PRODUCT_ID_MAX';    // {"NUT":12}: самый большой номер, который уже выдавался в категории

/** Ключи колонок по заголовкам: по ним строка переносится между «Товари» и архивом. Колонки без заголовка получают ключ «#N». */
function headerKeys_(row) {
  var seen = {};
  return row.map(function (h) {
    var k = String(h === null || h === undefined ? '' : h).replace(/\s+/g, ' ').trim().toLowerCase();
    seen[k] = (seen[k] || 0) + 1;
    return !k || seen[k] > 1 ? k + '#' + seen[k] : k;
  });
}

/** Значение переносится как есть: текст остаётся текстом (не превращается в формулу, число или дату). */
function keepCell_(v) {
  return typeof v === 'string' && v !== '' ? '\'' + v : (v === null || v === undefined ? '' : v);
}

function headRow_(sheet) {
  return sheet.getRange(1, 1, 1, Math.max(1, sheet.getLastColumn())).getValues()[0];
}

/** Лист «Архів товарів»: те же колонки, что в «Товари», плюс дата и кто архивировал. Новые колонки «Товари» добавляются в конец. */
function ensureArchiveSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var products = ss.getSheetByName(SHEET_PRODUCTS);
  var pHead = products ? headRow_(products) : [];
  var sheet = ss.getSheetByName(SHEET_ARCHIVE);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_ARCHIVE);
    var head = pHead.filter(function (h) { return String(h).trim() !== ''; }).concat([ARCHIVE_AT, ARCHIVE_BY]);
    sheet.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold');
    sheet.setFrozenRows(1);
    return sheet;
  }
  var have = {};
  headerKeys_(headRow_(sheet)).forEach(function (k) { have[k] = true; });
  var pKeys = headerKeys_(pHead);
  pHead.concat([ARCHIVE_AT, ARCHIVE_BY]).forEach(function (title, i) {
    var k = i < pKeys.length ? pKeys[i] : String(title).toLowerCase();
    if (!String(title).trim() || k.indexOf('#') >= 0 || have[k]) return;
    sheet.getRange(1, sheet.getLastColumn() + 1).setValue(title).setFontWeight('bold');
    have[k] = true;
  });
  return sheet;
}

function deletedIds_(props) {
  props = props || PropertiesService.getScriptProperties();
  return String(props.getProperty(PROP_DELETED_IDS) || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
}

function deletedIdSet_() {
  var set = {};
  try { deletedIds_().forEach(function (id) { set[id] = true; }); } catch (err) { console.warn('deleted ids: ' + err); }
  return set;
}

function idMax_(props) {
  var o = {};
  try { o = JSON.parse(props.getProperty(PROP_ID_MAX) || '{}') || {}; } catch (err) { o = {}; }
  return o;
}

/** Запоминает ID удалённого навсегда товара: новый товар такой ID уже не получит. */
function rememberDeletedId_(id) {
  var props = PropertiesService.getScriptProperties();
  var list = deletedIds_(props);
  if (list.indexOf(id) < 0) list.push(id);
  var text = list.join(',');
  while (text.length > 8500 && list.length > 1) { list.shift(); text = list.join(','); } // лимит свойства — 9 КБ; номера всё равно хранит PRODUCT_ID_MAX
  props.setProperty(PROP_DELETED_IDS, text);
  var m = id.match(/^([A-Z0-9]+)-(\d+)$/);
  if (m) {
    var max = idMax_(props), n = parseInt(m[2], 10);
    if (!(max[m[1]] >= n)) { max[m[1]] = n; props.setProperty(PROP_ID_MAX, JSON.stringify(max)); }
  }
}

/** Наибольший номер с этим префиксом среди архивных и удалённых навсегда товаров. */
function reservedIdMax_(prefix) {
  var max = 0;
  try {
    var saved = Number(idMax_(PropertiesService.getScriptProperties())[prefix]) || 0;
    max = Math.max(max, saved);
    deletedIds_().forEach(function (id) {
      var d = id.match(/^([A-Z0-9]+)-(\d+)$/);
      if (d && d[1] === prefix) max = Math.max(max, parseInt(d[2], 10));
    });
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ARCHIVE);
    if (sheet && sheet.getLastRow() > 1) {
      var values = sheet.getDataRange().getValues();
      var col = mapHeaders_(values[0], PRODUCT_COLS);
      for (var r = 1; r < values.length; r++) {
        var m = cell_(values[r], col.id).match(/^([A-Z0-9]+)-(\d+)$/);
        if (m && m[1] === prefix) max = Math.max(max, parseInt(m[2], 10));
      }
    }
  } catch (err) {
    console.error('reserved id: ' + (err && err.stack || err));
  }
  return max;
}

/** Архив для панели: те же клиентские поля, что у списка товаров (служебные колонки не читаются), плюс дата и кто архивировал. */
function listArchive_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ARCHIVE);
  if (!sheet || sheet.getLastRow() < 2) return { ok: true, items: [] };
  var values = sheet.getDataRange().getValues();
  var col = mapHeaders_(values[0], PRODUCT_COLS);
  var keys = headerKeys_(values[0]);
  var atCol = keys.indexOf(ARCHIVE_AT.toLowerCase()), byCol = keys.indexOf(ARCHIVE_BY.toLowerCase());
  var items = [];
  for (var r = values.length - 1; r >= 1; r--) { // последние архивированные — сверху
    var p = adminProduct_(values[r], col);
    if (!p.id) continue;
    var d = atCol >= 0 ? values[r][atCol] : '';
    var isDate = Object.prototype.toString.call(d) === '[object Date]' && !isNaN(d.getTime());
    p.at = isDate ? Utilities.formatDate(d, 'Europe/Kiev', 'dd.MM.yyyy') : String(d || '');
    p.by = cell_(values[r], byCol);
    items.push(p);
  }
  return { ok: true, items: items };
}

/** «В архів»: строка товара переносится из «Товари» в «Архів товарів». С витрины товар пропадает. */
function archiveProduct_(id) {
  id = String(id || '').trim();
  if (!id) return { ok: false, error: 'bad_form' };
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_PRODUCTS);
    var col = productCols_(sheet);
    var values = sheet.getDataRange().getValues();
    var r = -1;
    for (var i = 1; i < values.length; i++) if (cell_(values[i], col.id) === id) { r = i; break; }
    if (r < 0) return { ok: false, error: 'not_found' };
    var name = cell_(values[r], col.nameUa);

    var arch = ensureArchiveSheet_();
    var aHead = headRow_(arch);
    var at = {};
    headerKeys_(aHead).forEach(function (k, j) { at[k] = j; });
    var row = aHead.map(function () { return ''; });
    headerKeys_(values[0]).forEach(function (k, j) {
      if (k.indexOf('#') < 0 && at[k] !== undefined) row[at[k]] = keepCell_(values[r][j]);
    });
    var atCol = at[ARCHIVE_AT.toLowerCase()], byCol = at[ARCHIVE_BY.toLowerCase()];
    if (atCol !== undefined) row[atCol] = new Date();
    if (byCol !== undefined) row[byCol] = keepCell_(clean_(actor_ ? actor_.name : 'система', 80));
    // Сначала строка появляется в архиве, и только потом исчезает из «Товари»: при сбое товар не потеряется.
    arch.appendRow(row);
    if (atCol !== undefined) arch.getRange(arch.getLastRow(), atCol + 1).setNumberFormat('dd.MM.yyyy HH:mm');
    SpreadsheetApp.flush();
    sheet.deleteRow(r + 1);
    SpreadsheetApp.flush();
    clearCatalogCache_();
    logAction_('Товар: в архів', id + ' ' + name, 'на вітрині', 'в архіві');
    return { ok: true, id: id, name: name };
  } finally {
    lock.releaseLock();
  }
}

/** Формулы (маржа, цена за 100 г и т. п.) в новой строке повторяют формулы строки выше — как при протягивании в таблице. */
function copyRowFormulas_(sheet, fromRow, toRow) {
  try {
    if (fromRow < 2) return;
    var n = sheet.getLastColumn();
    var src = sheet.getRange(fromRow, 1, 1, n);
    if (typeof src.getFormulasR1C1 !== 'function') return;
    var f = src.getFormulasR1C1()[0];
    for (var c = 0; c < n; c++) if (f[c]) sheet.getRange(toRow, c + 1).setFormulaR1C1(f[c]);
  } catch (err) {
    console.warn('formulas: ' + err);
  }
}

/** «Відновити»: строка возвращается из архива в конец листа «Товари», товар снова на витрине с прежними данными. */
function restoreProduct_(id) {
  id = String(id || '').trim();
  if (!id) return { ok: false, error: 'bad_form' };
  var result;
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var arch = ss.getSheetByName(SHEET_ARCHIVE);
    if (!arch || arch.getLastRow() < 2) return { ok: false, error: 'not_found' };
    var aValues = arch.getDataRange().getValues();
    var aCol = mapHeaders_(aValues[0], PRODUCT_COLS);
    var r = -1;
    for (var i = aValues.length - 1; i >= 1; i--) if (cell_(aValues[i], aCol.id) === id) { r = i; break; }
    if (r < 0) return { ok: false, error: 'not_found' };

    var sheet = ss.getSheetByName(SHEET_PRODUCTS);
    var col = productCols_(sheet);
    var pValues = sheet.getDataRange().getValues();
    for (var k = 1; k < pValues.length; k++) if (cell_(pValues[k], col.id) === id) return { ok: false, error: 'exists' }; // товар с таким ID уже есть в «Товари»
    var at = {};
    headerKeys_(pValues[0]).forEach(function (key, j) { at[key] = j; });
    var row = pValues[0].map(function () { return ''; });
    headerKeys_(aValues[0]).forEach(function (key, j) {
      if (key.indexOf('#') < 0 && at[key] !== undefined) row[at[key]] = keepCell_(aValues[r][j]);
    });
    var lastRow = sheet.getLastRow();
    sheet.appendRow(row);
    var newRow = sheet.getLastRow();
    copyRowFormulas_(sheet, lastRow, newRow);
    SpreadsheetApp.flush();
    arch.deleteRow(r + 1);
    SpreadsheetApp.flush();
    clearCatalogCache_();
    var fresh = sheet.getRange(newRow, 1, 1, sheet.getLastColumn()).getValues()[0];
    result = { ok: true, product: adminProduct_(fresh, col) };
    logAction_('Товар: відновлено з архіву', id + ' ' + result.product.ua, 'в архіві', 'на вітрині');
  } finally {
    lock.releaseLock();
  }
  // Подписки «Повідомити, коли з’явиться» на этот товар снова действуют. Сбой рассылки восстановление не отменяет.
  if (result.product.stock) {
    try { notifyBackInStock_(); } catch (err) { console.error('back in stock: ' + (err && err.stack || err)); }
  }
  return result;
}

/** «Видалити назавжди»: строка стирается из архива. Отменить нельзя. ID запоминается и новому товару не достанется. */
function purgeProduct_(id) {
  id = String(id || '').trim();
  if (!id) return { ok: false, error: 'bad_form' };
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var arch = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ARCHIVE);
    if (!arch || arch.getLastRow() < 2) return { ok: false, error: 'not_found' };
    var values = arch.getDataRange().getValues();
    var col = mapHeaders_(values[0], PRODUCT_COLS);
    var r = -1;
    for (var i = values.length - 1; i >= 1; i--) if (cell_(values[i], col.id) === id) { r = i; break; }
    if (r < 0) return { ok: false, error: 'not_found' }; // удалить навсегда можно только то, что уже лежит в архиве
    var name = cell_(values[r], col.nameUa);
    rememberDeletedId_(id);
    arch.deleteRow(r + 1);
    SpreadsheetApp.flush();
    logAction_('Товар: видалено назавжди', id + ' ' + name, 'в архіві', 'видалено');
    return { ok: true, id: id, name: name };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Удаление категории. Пустая удаляется сразу. Если в ней есть товары (включая скрытые) — нужен moveTo:
 * код категории, куда их перенести. Архивные товары категорию не держат.
 */
function deleteCategory_(codeRaw, moveToRaw) {
  var code = String(codeRaw || '').trim().toUpperCase();
  var moveTo = String(moveToRaw || '').trim().toUpperCase();
  if (!code) return { ok: false, error: 'bad_form' };
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_CATEGORIES);
    if (!sheet) return { ok: false, error: 'not_found' };
    var values = sheet.getDataRange().getValues();
    var col = mapHeaders_(values[0], CATEGORY_COLS);
    var r = -1;
    for (var i = 1; i < values.length; i++) if (cell_(values[i], col.code).toUpperCase() === code) { r = i; break; }
    if (r < 0) return { ok: false, error: 'not_found' };
    var cats = listCategoriesAdmin_();
    var mine = null, target = null;
    var byName = {}, byCode = {};
    cats.forEach(function (c) {
      var cc = c.code.toUpperCase();
      if (cc === code) mine = c;
      if (moveTo && cc === moveTo) target = c;
      byName[c.ua.toLowerCase()] = cc;
      byName[c.ru.toLowerCase()] = cc;
      byCode[cc] = true;
    });
    if (!mine) return { ok: false, error: 'not_found' };

    // Товары категории ищем так же, как витрина: по названию, иначе по префиксу ID.
    var ps = ss.getSheetByName(SHEET_PRODUCTS);
    var pc = productCols_(ps);
    var pv = ps.getDataRange().getValues();
    var rows = [];
    for (var k = 1; k < pv.length; k++) {
      var id = cell_(pv[k], pc.id);
      if (!id) continue;
      var found = byName[cell_(pv[k], pc.catUa).toLowerCase()] || byName[cell_(pv[k], pc.catRu).toLowerCase()];
      if (!found) { var prefix = id.split('-')[0].toUpperCase(); if (byCode[prefix]) found = prefix; }
      if (found === code) rows.push(k);
    }
    if (rows.length) {
      if (!moveTo) return { ok: false, error: 'not_empty', count: rows.length };
      if (!target || target.code.toUpperCase() === code || pc.catUa < 0) return { ok: false, error: 'bad_form' };
      rows.forEach(function (row) {
        ps.getRange(row + 1, pc.catUa + 1).setValue(safeCell_(target.ua));
        if (pc.catRu >= 0) ps.getRange(row + 1, pc.catRu + 1).setValue(safeCell_(target.ru));
      });
    }
    sheet.deleteRow(r + 1);
    SpreadsheetApp.flush();
    clearCatalogCache_();
    logAction_('Категорія: видалено', code + ' ' + mine.ua, rows.length ? 'товарів: ' + rows.length : 'порожня',
      rows.length ? 'товари перенесено в «' + target.ua + '»' : 'видалено');
    return { ok: true, categories: listCategoriesAdmin_(), moved: rows.length };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Удаление админа: стирается его строка в листе «Адміни». Правила те же, что при отключении:
 * владельца удалить нельзя, себя нельзя, полных админов удаляет только владелец.
 * Админа, который записан только в ADMIN_CHAT_IDS, панель не удаляет: Script Properties меняют вручную.
 */
function deleteAdmin_(me, body, props, token) {
  var id = String(body.id || '');
  var target = null;
  adminList_(props).forEach(function (a) { if (a.id === id) target = a; });
  if (!target) return { ok: false, error: 'not_found' };
  if (target.role === 'owner') return { ok: false, error: 'owner_locked' };
  if (target.id === me.id) return { ok: false, error: 'self' };
  if (target.src !== 'sheet') return { ok: false, error: 'in_props' };
  if (target.role === 'admin' && me.role !== 'owner') return { ok: false, error: 'owner_only' };
  if (me.role !== 'owner' && target.active && Object.keys(target.perms).some(function (k) { return !me.perms[k]; })) {
    return { ok: false, error: 'no_perm', need: 'grant' }; // забрать можно только те права, которые есть у самого
  }
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ADMINS);
    if (!sheet) return { ok: false, error: 'not_found' };
    var values = sheet.getDataRange().getValues();
    var col = mapHeaders_(values[0], ADMIN_COLS);
    var r = -1;
    for (var i = 1; i < values.length; i++) if (cell_(values[i], col.id) === id) { r = i; break; }
    if (r < 0) return { ok: false, error: 'not_found' };
    sheet.deleteRow(r + 1);
    SpreadsheetApp.flush();
    adminsMemo_ = null;
  } finally {
    lock.releaseLock();
  }
  var still = adminIds_(props).indexOf(id) >= 0; // chat id есть ещё и в ADMIN_CHAT_IDS — доступ у человека остаётся
  var label = (target.name || 'id ' + id) + (target.username ? ' ' + target.username : '');
  var was = target.active ? permsText_(target.role, target.perms) : 'вимкнено';
  logAction_('Адміни: видалено', label, was, still ? 'рядок видалено; доступ лишився через ADMIN_CHAT_IDS' : 'видалено');
  notifyOwner_(props, token, (actor_ ? actor_.name : 'Адмін') + ' видалив адміна: ' + label + ', id ' + id + '\nБуло: ' + was +
    (still ? '\nУвага: цей chat id записаний у ADMIN_CHAT_IDS, тому доступ у нього лишився.' : ''));
  if (!still) setAdminCommands_(token, id, false);
  var out = listAdmins_(props);
  out.still = still;
  return out;
}

/** Меню PAMIR → «Етап 8.2: створити листи…» (или запуск из редактора). Можно запускать повторно: существующие данные не трогает. */
function setupWave2a() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var done = [];
  if (!ss.getSheetByName(SHEET_ARCHIVE)) { ensureArchiveSheet_(); done.push('лист «' + SHEET_ARCHIVE + '»'); }
  var text = done.length ? 'Готово, створено:\n• ' + done.join('\n• ') : 'Усе вже створено раніше, нічого не змінено.';
  console.log(text);
  try { SpreadsheetApp.getUi().alert(text); } catch (err) { /* запуск из редактора */ }
  return done;
}
