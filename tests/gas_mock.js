// Мини-эмулятор Google Apps Script: настоящий Code.gs работает на таблице в памяти.
// Нужен только для тестов: проверяем бэкенд и витрину без доступа к реальной таблице и боту.
const vm = require('vm');
const fs = require('fs');
const crypto = require('crypto');

function normCell(v) {
  if (typeof v === 'string' && v.charAt(0) === "'") return v.slice(1); // апостроф = «это текст»
  return v === undefined || v === null ? '' : v;
}

class Range {
  constructor(sheet, r, c, nr, nc) { this.s = sheet; this.r = r; this.c = c; this.nr = nr; this.nc = nc; }
  getValues() {
    const out = [];
    for (let i = 0; i < this.nr; i++) {
      const row = [];
      for (let j = 0; j < this.nc; j++) {
        const src = this.s.rows[this.r - 1 + i];
        const v = src ? src[this.c - 1 + j] : '';
        row.push(v === undefined ? '' : v);
      }
      out.push(row);
    }
    return out;
  }
  setValues(values) {
    values.forEach((row, i) => row.forEach((v, j) => this.s._set(this.r + i, this.c + j, v)));
    return this;
  }
  setValue(v) { this.s._set(this.r, this.c, v); return this; }
  getFormula() { return ''; }
  setFontWeight() { return this; }
  setNumberFormat() { return this; }
}

class Sheet {
  constructor(name, rows) { this.name = name; this.rows = rows || []; }
  _set(r, c, v) {
    while (this.rows.length < r) this.rows.push([]);
    const row = this.rows[r - 1];
    while (row.length < c) row.push('');
    row[c - 1] = normCell(v);
    const width = this.getLastColumn();
    this.rows.forEach(x => { while (x.length < width) x.push(''); });
  }
  getLastRow() {
    for (let i = this.rows.length; i > 0; i--) if (this.rows[i - 1].some(v => v !== '')) return i;
    return 0;
  }
  getLastColumn() { return this.rows.reduce((m, r) => Math.max(m, r.length), 0); }
  getDataRange() { return new Range(this, 1, 1, Math.max(1, this.getLastRow()), Math.max(1, this.getLastColumn())); }
  getRange(r, c, nr, nc) {
    if (typeof r === 'string') return new Range(this, 1, 1, 0, 0);
    return new Range(this, r, c, nr === undefined ? 1 : nr, nc === undefined ? 1 : nc);
  }
  appendRow(row) {
    const at = this.getLastRow() + 1;
    row.forEach((v, j) => this._set(at, j + 1, v));
    return this;
  }
  setFrozenRows() {}
  hideColumns() {}
  clearContents() { this.rows = []; }
  deleteRows(start, n) { this.rows.splice(start - 1, n); }
  deleteRow(at) { this.rows.splice(at - 1, 1); }
}

function formatDate(date, tz, fmt) {
  const p = {};
  new Intl.DateTimeFormat('en-GB', { timeZone: tz === 'Europe/Kiev' ? 'Europe/Kyiv' : tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
    .formatToParts(date).forEach(x => { p[x.type] = x.value; });
  if (p.hour === '24') p.hour = '00';
  return fmt.replace('yyyy', p.year).replace('MM', p.month).replace('dd', p.day).replace('HH', p.hour).replace('mm', p.minute).replace('ss', p.second);
}

function createGas(codePath, seed) {
  const sheets = {};
  Object.keys(seed.sheets).forEach(name => { sheets[name] = new Sheet(name, seed.sheets[name].map(r => r.slice())); });
  const props = Object.assign({}, seed.props);
  const cache = {};
  const sent = []; // всё, что бэкенд отправил в Telegram
  const triggers = [];
  let msgId = 100;
  let failTelegram = false;

  const ss = {
    getSheetByName: n => sheets[n] || null,
    insertSheet: n => { sheets[n] = new Sheet(n, []); return sheets[n]; },
    getSpreadsheetTimeZone: () => 'Europe/Kiev'
  };
  const sandbox = {
    console: { log() {}, warn() {}, error(...a) { sandbox.__errors.push(a.join(' ')); } },
    __errors: [],
    SpreadsheetApp: { getActiveSpreadsheet: () => ss, flush() {}, getUi: () => ({ alert() {}, createMenu: () => { const m = { addItem: () => m, addSeparator: () => m, addToUi() {} }; return m; } }) },
    CacheService: { getScriptCache: () => ({
      get: k => (k in cache ? cache[k] : null),
      put: (k, v) => { cache[k] = String(v); },
      putAll: o => { Object.keys(o).forEach(k => { cache[k] = String(o[k]); }); },
      getAll: keys => { const o = {}; keys.forEach(k => { if (k in cache) o[k] = cache[k]; }); return o; },
      remove: k => { delete cache[k]; }
    }) },
    PropertiesService: { getScriptProperties: () => ({
      getProperty: k => (k in props ? props[k] : null),
      setProperty: (k, v) => { props[k] = String(v); }
    }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Utilities: {
      newBlob: (data) => ({ getBytes: () => (typeof data === 'string' ? Array.from(Buffer.from(data, 'utf8')) : data) }),
      computeHmacSha256Signature: (value, key) => {
        const h = crypto.createHmac('sha256', Buffer.from(key.map(b => b & 255)));
        h.update(Buffer.from(value.map(b => b & 255)));
        return Array.from(h.digest()).map(b => (b > 127 ? b - 256 : b));
      },
      formatDate,
      base64Decode: s => Array.from(Buffer.from(s, 'base64')),
      getUuid: () => crypto.randomUUID()
    },
    UrlFetchApp: { fetch: (url, opts) => {
      const method = url.split('/').pop().split('?')[0];
      const payload = opts && opts.payload ? JSON.parse(opts.payload) : {};
      sent.push({ method, payload });
      const body = failTelegram ? { ok: false, description: 'mock failure' } : { ok: true, result: { message_id: ++msgId, username: 'pamir_test_bot' } };
      return { getContentText: () => JSON.stringify(body) };
    } },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: text => ({ text, setMimeType() { return this; } }) },
    ScriptApp: {
      getProjectTriggers: () => triggers.map(t => ({ getHandlerFunction: () => t })),
      deleteTrigger: t => { const i = triggers.indexOf(t.getHandlerFunction()); if (i >= 0) triggers.splice(i, 1); },
      newTrigger: fn => { const b = { timeBased: () => b, everyMinutes: () => b, everyHours: () => b, everyDays: () => b, atHour: () => b, create: () => { triggers.push(fn); } }; return b; }
    },
    DriveApp: {}
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(codePath, 'utf8'), sandbox, { filename: 'Code.gs' });

  function resetMemo() { vm.runInContext('settingsMemo_ = null; if (typeof adminsMemo_ !== "undefined") { adminsMemo_ = null; actor_ = null; }', sandbox); } // у каждого запроса Apps Script свой запуск

  return {
    sandbox, sheets, props, cache, sent, triggers,
    setTelegramFail(v) { failTelegram = v; },
    clearCache() { Object.keys(cache).forEach(k => { delete cache[k]; }); },
    get(query) { resetMemo(); return JSON.parse(sandbox.doGet({ parameter: query }).text); },
    post(body, parameter) {
      resetMemo();
      const out = sandbox.doPost({ parameter: parameter || {}, postData: { contents: typeof body === 'string' ? body : JSON.stringify(body) } });
      try { return JSON.parse(out.text); } catch (e) { return out.text; }
    },
    call(fn, ...args) { resetMemo(); return sandbox[fn](...args); },
    /** Подписанный initData — как его выдаёт Telegram. */
    initData(user, ageSec) {
      const params = {
        auth_date: String(Math.floor(Date.now() / 1000) - (ageSec || 0)),
        query_id: 'AAE' + crypto.randomBytes(6).toString('hex'),
        user: JSON.stringify(user)
      };
      const check = Object.keys(params).sort().map(k => k + '=' + params[k]).join('\n');
      const secret = crypto.createHmac('sha256', 'WebAppData').update(props.BOT_TOKEN).digest();
      params.hash = crypto.createHmac('sha256', secret).update(check).digest('hex');
      return Object.keys(params).map(k => k + '=' + encodeURIComponent(params[k])).join('&');
    }
  };
}

/** Тестовая таблица: 40 товаров, служебные колонки, несколько старых заказов. */
function seed() {
  const head = ['ID', 'Категорія (UA)', 'Категория (RU)', 'Назва (UA)', 'Название (RU)', 'Тип', 'Фасування', 'Вага упаковки, кг',
    'Ціна за 100 г', 'Ціна за 1 кг', 'Ціна за упаковку/шт', 'Наявність', 'Фото (посилання)', 'Опис (UA)', 'Описание (RU)', 'Опт: ціна', 'Опт: мін. обсяг',
    'Ціна конкурента', 'Примітка', 'Закупка', 'Маржа', 'Націнка', 'Джерело', 'Бейдж', 'Стара ціна', 'Залишок', 'Акція до'];
  const rows = [head];
  function add(id, catUa, catRu, ua, ru, type, packs, kg, unit, stock, extra) {
    const e = extra || {};
    rows.push([id, catUa, catRu, ua, ru, type, packs, '', kg ? kg / 10 : '', kg || '', unit || '', stock, e.img || '', e.dUa || '', e.dRu || '', e.wh || '', e.wm || '',
      999, 'СЕКРЕТ-примітка', 111, 222, '33%', 'do-smaku', e.badge || '', e.old || '', e.qty === undefined ? '' : e.qty, e.end || '']);
  }
  const W = '100 г / 250 г / 500 г / 1 кг';
  add('DRY-039', 'Сухофрукти', 'Сухофрукты', 'Курага натуральна Бобої без кісточок', 'Курага натуральная Бобои без косточек', 'вагова', '250 г / 500 г / 1 кг', 380, '', 'є',
    { dUa: 'Курага з нашого саду в Ісфарі. Сушена на сонці, без сірки.', dRu: 'Курага из нашего сада в Исфаре. Сушёная на солнце, без серы.', wh: 320, wm: 'від 5 кг', badge: 'хіт' });
  add('DRY-001', 'Сухофрукти', 'Сухофрукты', 'Чорнослив без кісточки', 'Чернослив без косточки', 'вагова', W, 260, '', 'є', { old: 310, end: '31.12.2099' });
  add('DRY-002', 'Сухофрукти', 'Сухофрукты', 'Фініки Меджул', 'Финики Меджул', 'вагова', W, 620, '', 'є', { badge: 'новинка' });
  add('DRY-003', 'Сухофрукти', 'Сухофрукты', 'Інжир сушений', 'Инжир сушёный', 'вагова', W, 540, '', 'є', { qty: 0.6 });
  add('DRY-004', 'Сухофрукти', 'Сухофрукты', 'Родзинки золоті', 'Изюм золотой', 'вагова', W, 240, '', 'є', { old: 300, end: '01.01.2020' });
  add('DRY-005', 'Сухофрукти', 'Сухофрукты', 'Манго сушене', 'Манго сушёное', 'вагова', W, 480, '', 'немає');
  add('DRY-006', 'Сухофрукти', 'Сухофрукты', 'Журавлина в’ялена', 'Клюква вяленая', 'вагова', W, 420, '', 'є', { badge: 'новинка' });
  add('DRY-030', 'Сухофрукти', 'Сухофрукты', 'Абрикос сушений з кісточкою', 'Абрикос сушёный с косточкой', 'вагова', W, '', '', 'є');
  add('NUT-001', 'Горіхи', 'Орехи', 'Мигдаль смажений', 'Миндаль жареный', 'вагова', W, 560, '', 'є', { badge: 'хіт' });
  add('NUT-002', 'Горіхи', 'Орехи', 'Кеш’ю смажений', 'Кешью жареный', 'вагова', W, 640, '', 'є');
  add('NUT-003', 'Горіхи', 'Орехи', 'Фісташки солоні', 'Фисташки солёные', 'вагова', W, 780, '', 'є', { old: 860 });
  add('NUT-004', 'Горіхи', 'Орехи', 'Волоський горіх, половинки', 'Грецкий орех, половинки', 'вагова', W, 420, '', 'є');
  add('NUT-005', 'Горіхи', 'Орехи', 'Фундук смажений', 'Фундук жареный', 'вагова', W, 520, '', 'є');
  add('NUT-006', 'Горіхи', 'Орехи', 'Бразильський горіх', 'Бразильский орех', 'вагова', W, 1420, '', 'є');
  add('NUT-007', 'Горіхи', 'Орехи', 'Арахіс бланшований 500 г', 'Арахис бланшированный 500 г', 'упаковка', '500 г', '', 85, 'є');
  add('NUT-008', 'Горіхи', 'Орехи', 'Пекан', 'Пекан', 'вагова', W, 1100, '', 'немає');
  add('NUT-009', 'Горіхи', 'Орехи', 'Кедровий горіх', 'Кедровый орех', 'вагова', '100 г / 250 г', 2400, '', 'є');
  add('NUT-010', 'Горіхи', 'Орехи', 'Макадамія в шкаралупі', 'Макадамия в скорлупе', 'вагова', W, 690, '', 'є');
  add('SWT-001', 'Східні солодощі', 'Восточные сладости', 'Пахлава горіхова', 'Пахлава ореховая', 'вагова', '250 г / 500 г / 1 кг', 450, '', 'є');
  add('SWT-002', 'Східні солодощі', 'Восточные сладости', 'Рахат-лукум з трояндою', 'Рахат-лукум с розой', 'вагова', '250 г / 500 г', 320, '', 'є');
  add('SWT-003', 'Східні солодощі', 'Восточные сладости', 'Халва соняшникова', 'Халва подсолнечная', 'вагова', '250 г / 500 г', 210, '', 'є');
  add('SWT-004', 'Східні солодощі', 'Восточные сладости', 'Чурчхела з волоським горіхом', 'Чурчхела с грецким орехом', 'шт', '', '', 65, 'є', { qty: 3 });
  add('SWT-005', 'Східні солодощі', 'Восточные сладости', 'Нуга з фісташкою', 'Нуга с фисташкой', 'вагова', '250 г / 500 г', 520, '', 'є');
  add('SWT-006', 'Східні солодощі', 'Восточные сладости', 'Козинаки кунжутні', 'Козинаки кунжутные', 'упаковка', '200 г', '', 70, 'є');
  add('CND-001', 'Цукерки з сухофруктів', 'Конфеты из сухофруктов', 'Цукерка «Фінік з мигдалем»', 'Конфета «Финик с миндалём»', 'шт', '', '', 12, 'є');
  add('CND-002', 'Цукерки з сухофруктів', 'Конфеты из сухофруктов', 'Курага в шоколаді', 'Курага в шоколаде', 'вагова', '250 г / 500 г', 480, '', 'є');
  add('CND-003', 'Цукерки з сухофруктів', 'Конфеты из сухофруктов', 'Чорнослив з горіхом у шоколаді', 'Чернослив с орехом в шоколаде', 'вагова', '250 г / 500 г', 460, '', 'є');
  add('CND-004', 'Цукерки з сухофруктів', 'Конфеты из сухофруктов', 'Набір «Східний подарунок» 600 г', 'Набор «Восточный подарок» 600 г', 'упаковка', '600 г', '', 390, 'є', { badge: 'набір', old: 450 });
  add('CND-005', 'Цукерки з сухофруктів', 'Конфеты из сухофруктов', 'Набір «До чаю» 400 г', 'Набор «К чаю» 400 г', 'упаковка', '400 г', '', 260, 'є', { badge: 'набір' });
  add('SPC-001', 'Спеції', 'Специи', 'Зіра ціла', 'Зира целая', 'вагова', '100 г / 250 г', 1255, '', 'є');
  add('SPC-002', 'Спеції', 'Специи', 'Паприка копчена', 'Паприка копчёная', 'вагова', '100 г / 250 г', 480, '', 'є');
  add('SPC-003', 'Спеції', 'Специи', 'Куркума мелена', 'Куркума молотая', 'вагова', '100 г / 250 г', 360, '', 'є');
  add('SPC-004', 'Спеції', 'Специи', 'Суміш для плову', 'Смесь для плова', 'упаковка', '50 г', '', 45, 'є');
  add('SPC-005', 'Спеції', 'Специи', 'Сумах', 'Сумах', 'вагова', '100 г / 250 г', 520, '', 'є');
  add('TEA-001', 'Чай', 'Чай', 'Чай чорний з чебрецем', 'Чай чёрный с чабрецом', 'вагова', '100 г / 250 г', 640, '', 'є');
  add('TEA-002', 'Чай', 'Чай', 'Чай зелений з жасмином', 'Чай зелёный с жасмином', 'вагова', '100 г / 250 г', 720, '', 'є');
  add('TEA-003', 'Чай', 'Чай', 'Каркаде', 'Каркаде', 'вагова', '100 г / 250 г', 380, '', 'є');
  add('TEA-004', 'Чай', 'Чай', 'Іван-чай', 'Иван-чай', 'упаковка', '100 г', '', 120, 'є');
  add('HID-001', 'Чай', 'Чай', 'Прихований товар', 'Скрытый товар', 'упаковка', '100 г', '', 10, 'є');
  rows[rows.length - 1][head.length] = 'так';
  rows[0].push('Приховати з вітрини');
  rows.forEach(r => { while (r.length < rows[0].length) r.push(''); });

  const cats = [['Код', 'Категорія (UA)', 'Категория (RU)', 'Іконка (Lucide)', 'Порядок у боті'],
    ['DRY', 'Сухофрукти', 'Сухофрукты', 'cherry', 1], ['NUT', 'Горіхи', 'Орехи', 'nut', 2],
    ['SWT', 'Східні солодощі', 'Восточные сладости', 'candy', 3], ['CND', 'Цукерки з сухофруктів', 'Конфеты из сухофруктов', 'candy', 4],
    ['SPC', 'Спеції', 'Специи', 'flame', 5], ['TEA', 'Чай', 'Чай', 'leaf', 6]];

  const ordHead = ['№', 'Дата/час', 'Статус', 'Telegram user id', '@username', "Ім'я", 'Телефон', 'Доставка', 'Місто', 'Відділення НП',
    'Оплата', 'Коментар', 'Товари', 'Сума, ₴', 'Мова', 'Джерело', 'Службове'];
  const orders = [ordHead];
  const day = 24 * 3600 * 1000;
  function ord(n, daysAgo, status, uid, items, total, source) {
    orders.push(['P-' + String(n).padStart(4, '0'), new Date(Date.now() - daysAgo * day), status, String(uid), '@user' + uid, 'Клієнт ' + uid, '+380501112233',
      'самовивіз', '', '', 'при отриманні', '', items.map(i => i[3]).join('; '), total, 'ua', source || 'miniapp',
      JSON.stringify({ i: items.map(i => [i[0], i[1], i[2]]) })]);
  }
  ord(1, 20, 'виконано', 501, [['DRY-039', 500, 1, 'Курага натуральна Бобої без кісточок 500 г × 1 = 190 ₴'], ['NUT-001', 250, 1, 'Мигдаль смажений 250 г × 1 = 140 ₴']], 330);
  ord(2, 15, 'виконано', 502, [['DRY-039', 1000, 1, 'Курага натуральна Бобої без кісточок 1 кг × 1 = 380 ₴'], ['NUT-001', 250, 2, 'Мигдаль смажений 250 г × 2 = 280 ₴']], 660);
  ord(3, 9, 'виконано', 501, [['DRY-039', 500, 2, 'Курага натуральна Бобої без кісточок 500 г × 2 = 380 ₴'], ['SWT-001', 250, 1, 'Пахлава горіхова 250 г × 1 = 113 ₴']], 493);
  ord(4, 6, 'підтверджено', 503, [['NUT-003', 250, 1, 'Фісташки солоні 250 г × 1 = 195 ₴'], ['DRY-039', 250, 1, 'Курага натуральна Бобої без кісточок 250 г × 1 = 95 ₴']], 290);
  ord(5, 3, 'скасовано', 504, [['TEA-001', 100, 5, 'Чай чорний з чебрецем 100 г × 5 = 320 ₴']], 320);
  ord(6, 2, 'виконано', 777, [['NUT-001', 500, 1, 'Мигдаль смажений 500 г × 1 = 280 ₴'], ['CND-001', 0, 4, 'Цукерка «Фінік з мигдалем» × 4 = 48 ₴']], 328);
  ord(7, 1, 'новий', 1, [['TEA-002', 100, 9, 'Чай зелений з жасмином 100 г × 9 = 648 ₴']], 648, 'miniapp test');

  return {
    sheets: { 'Товари': rows, 'Категорії': cats, 'Замовлення': orders },
    props: { BOT_TOKEN: '123456:TEST_TOKEN_for_local_mock_only', ADMIN_CHAT_IDS: '900', WEBAPP_URL: 'https://example.test/webapp/', USE_WEBHOOK: 'true', WEBHOOK_SECRET: 'whsec' }
  };
}

module.exports = { createGas, seed };
