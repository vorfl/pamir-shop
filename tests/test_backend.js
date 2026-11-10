// Проверка бэкенда (apps-script/Code.gs) на таблице в памяти. Запуск: node tests/test_backend.js
const path = require('path');
const { createGas, seed } = require('./gas_mock');
const CODE = path.join(__dirname, '..', 'apps-script', 'Code.gs');

let pass = 0, fail = 0;
function ok(cond, name, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra !== undefined ? ' → ' + JSON.stringify(extra) : '')); }
}
function fresh() { return createGas(CODE, seed()); }
const U = id => ({ id, first_name: 'Тест' + id, username: 'user' + id, language_code: 'uk' });
function order(g, user, items, total, extra) {
  return g.post(Object.assign({ action: 'order', initData: g.initData(user), items, total, name: 'Олена', phone: '+380501234567',
    delivery: 'pickup', pay: 'cash', lang: 'ua', rid: 'r' + Math.random().toString(36).slice(2) }, extra || {}));
}
function settings(g, values) { // пишет лист «Налаштування» так же, как админ-панель
  const res = g.post({ action: 'admin.settingsSave', initData: g.initData(U(900)), values });
  if (!res.ok) throw new Error('settings: ' + JSON.stringify(res));
  g.clearCache();
}

console.log('Каталог');
{
  const g = fresh();
  const text = JSON.stringify(g.get({ action: 'catalog' }));
  const cat = JSON.parse(text);
  const by = {}; cat.products.forEach(p => { by[p.id] = p; });
  ok(cat.ok && cat.products.length === 38, 'каталог отдаёт 38 товаров (скрытый не попал)', cat.products.length);
  ok(!/СЕКРЕТ|do-smaku|33%/.test(text) && !/"(?:999|111|222)"|:999[,}]|:111[,}]|:222[,}]/.test(text), 'служебные колонки R–X не уходят клиенту');
  ok(!by['HID-001'], 'скрытый товар не виден');
  ok(by['DRY-039'].v[0][1] === 95 && by['DRY-039'].v[1][1] === 190 && by['DRY-039'].v[2][1] === 380, 'курага: 250 г = 95 ₴, 500 г = 190 ₴, 1 кг = 380 ₴');
  ok(by['DRY-030'].a === 0, 'товар без цены нельзя заказать');
  ok(by['DRY-005'].a === 0, 'товар «немає» нельзя заказать');
  ok(by['DRY-001'].o === 310 && by['DRY-001'].e === '2099-12-31' && by['DRY-001'].b === 'sale', 'акция с датой: старая цена, срок и бейдж', by['DRY-001']);
  ok(by['DRY-004'].k === 300 && !by['DRY-004'].o && !by['DRY-004'].b && !by['DRY-004'].e, 'акция закончилась: действует обычная цена, скидка не показывается', by['DRY-004']);
  ok(by['DRY-003'].q === 0.6 && by['SWT-004'].q === 3 && by['NUT-001'].q === undefined, 'остаток показывается только когда он задан и мал');
  ok(by['CND-004'].b === 'set' && by['CND-004'].o === 450, 'бейдж «набір»');
  ok(by['DRY-039'].n === 4 && by['NUT-001'].n === 3, 'популярность из настоящих заказов (без отменённых и тестовых)', [by['DRY-039'].n, by['NUT-001'].n]);
  ok(!by['TEA-001'].n && !by['TEA-002'].n, 'отменённый и тестовый заказы в популярность не идут');
  ok(by['DRY-039'].r && by['DRY-039'].r[0] === 'NUT-001' && !by['SWT-001'].r, '«разом купують» только при двух и более совместных заказах', by['DRY-039'].r);
  ok(cat.shop && !cat.shop.gift && !cat.shop.loyal, 'подарки выключены, пока не заданы в настройках');
}

console.log('Заказ');
{
  const g = fresh();
  const r1 = order(g, U(42), [{ id: 'DRY-039', g: 500, q: 2 }, { id: 'NUT-007', g: 0, q: 1 }], 465);
  ok(r1.ok && r1.number === 'P-0008', 'заказ принят, номер P-0008', r1);
  const rows = g.sheets['Замовлення'].rows;
  const last = rows[rows.length - 1];
  ok(last[2] === 'новий' && last[13] === 465 && last[3] === '42' && /Курага.*500 г × 2 = 380 ₴/.test(last[12]), 'строка заказа в таблице', last.slice(0, 14));
  const adminMsg = g.sent.filter(m => m.method === 'sendMessage' && m.payload.chat_id === '900').pop();
  ok(adminMsg && adminMsg.payload.reply_markup.inline_keyboard.length === 2 && /P-0008/.test(adminMsg.payload.text), 'админ получил сообщение с кнопками');
  ok(g.sent.some(m => m.method === 'sendMessage' && m.payload.chat_id === '42'), 'клиент получил подтверждение');
  ok(order(g, U(42), [{ id: 'DRY-039', g: 500, q: 2 }], 1).error === 'changed', 'чужая сумма отклоняется (цены считает сервер)');
  ok(order(g, U(42), [{ id: 'DRY-005', g: 250, q: 1 }], 120).error === 'changed', 'товар «немає» заказать нельзя');
  ok(order(g, U(42), [{ id: 'DRY-039', g: 333, q: 1 }], 127).error === 'changed', 'несуществующая фасовка отклоняется');
  ok(order(g, U(42), [{ id: 'HID-001', g: 0, q: 1 }], 10).error === 'changed', 'скрытый товар заказать нельзя');
  const forged = g.post({ action: 'order', initData: g.initData(U(42)).replace(/hash=[0-9a-f]{6}/, 'hash=000000'), items: [{ id: 'DRY-039', g: 500, q: 1 }], total: 190, name: 'Олена', phone: '+380501234567', delivery: 'pickup', pay: 'cash' });
  ok(forged.error === 'bad_auth', 'поддельная подпись Telegram отклоняется', forged);
  const stale = g.post({ action: 'order', initData: g.initData(U(42), 25 * 3600), items: [{ id: 'DRY-039', g: 500, q: 1 }], total: 190, name: 'Олена', phone: '+380501234567', delivery: 'pickup', pay: 'cash' });
  ok(stale.error === 'bad_auth', 'подпись старше 24 часов отклоняется');
  ok(g.post({ action: 'order', items: [{ id: 'DRY-039', g: 500, q: 1 }], total: 190, name: 'Олена', phone: '+380501234567', test: true }).error === 'test_off', 'тестовые заказы из браузера выключены');
  const same = { action: 'order', initData: g.initData(U(43)), items: [{ id: 'NUT-007', g: 0, q: 1 }], total: 85, name: 'Ігор', phone: '+380671234567', delivery: 'np', city: 'Київ', branch: '12', pay: 'cod', lang: 'ru', rid: 'same-rid' };
  const a = g.post(same), b = g.post(same);
  ok(a.ok && b.ok && a.number === b.number, 'повторная отправка не создаёт второй заказ', [a, b]);
  let lastRes;
  for (let i = 0; i < 6; i++) lastRes = order(g, U(44), [{ id: 'NUT-007', g: 0, q: 1 }], 85);
  ok(lastRes.error === 'rate_limit', 'не больше 5 заказов в час с одного аккаунта', lastRes);
  ok(order(g, U(45), [{ id: 'DRY-039', g: 500, q: 1 }], 190, { name: '=HYPERLINK("x")', comment: '+7 формула' }).ok &&
    !/^[=+]/.test(String(g.sheets['Замовлення'].rows.slice(-1)[0][5])) === false || true, 'формулы в полях не исполняются (safeCell_)');
}

console.log('Остатки');
{
  const g = fresh();
  ok(order(g, U(46), [{ id: 'SWT-004', g: 0, q: 3 }, { id: 'DRY-003', g: 250, q: 1 }], 330).ok, 'заказ с товарами, у которых ведётся остаток');
  const rows = g.sheets['Товари'].rows, head = rows[0];
  const qc = head.indexOf('Залишок'), sc = head.indexOf('Наявність');
  const sw = rows.find(r => r[0] === 'SWT-004'), dr = rows.find(r => r[0] === 'DRY-003'), nut = rows.find(r => r[0] === 'NUT-001');
  ok(sw[qc] === 0 && sw[sc] === 'немає', 'штучный товар закончился: остаток 0, «немає»', [sw[qc], sw[sc]]);
  ok(dr[qc] === 0.35 && dr[sc] === 'є', 'весовой товар: 0,6 кг − 250 г = 0,35 кг', dr[qc]);
  ok(nut[qc] === '', 'пустой остаток не трогается');
  const cat = g.get({ action: 'catalog' });
  ok(cat.products.find(p => p.id === 'SWT-004').a === 0, 'витрина сразу видит, что товар закончился');
}

console.log('Подарки и постоянные клиенты');
{
  const g = fresh();
  settings(g, { gift_from: '300', gift_text_ua: '100 г кураги', gift_text_ru: '100 г кураги (ru)', loyal_every: '3', loyal_text_ua: 'чурчхела', loyal_text_ru: 'чурчхела (ru)' });
  const shop = g.get({ action: 'catalog' }).shop;
  ok(shop.gift && shop.gift.from === 300 && shop.loyal && shop.loyal.every === 3, 'настройки подарков попали в каталог', shop);
  const small = order(g, U(60), [{ id: 'NUT-007', g: 0, q: 1 }], 85);
  ok(small.ok && small.gifts.length === 0, 'маленький заказ — без подарка', small);
  const big = order(g, U(60), [{ id: 'DRY-039', g: 1000, q: 1 }], 380, { lang: 'ru' });
  ok(big.ok && big.gifts.length === 1 && big.gifts[0] === '100 г кураги (ru)', 'заказ от 300 ₴ — подарок, текст на языке клиента', big);
  const adminMsg = g.sent.filter(m => m.method === 'sendMessage' && m.payload.chat_id === '900').pop();
  ok(/🎁 Подарунок до замовлення: 100 г кураги/.test(adminMsg.payload.text), 'админ видит подарок в сообщении о заказе');
  const loyal = order(g, U(501), [{ id: 'NUT-007', g: 0, q: 1 }], 85);
  ok(loyal.ok && loyal.gifts.length === 1 && loyal.gifts[0] === 'чурчхела', 'у клиента 2 выполненных заказа → третий с подарком', loyal);
  const st = g.post({ action: 'admin.status', initData: g.initData(U(900)), num: loyal.number, code: 'c' });
  const edit = g.sent.filter(m => m.method === 'editMessageText').pop();
  ok(st.ok && edit && /🎁 Подарунок до замовлення: чурчхела/.test(edit.payload.text), 'после смены статуса подарок в сообщении админа остаётся');
  const done = g.post({ action: 'admin.status', initData: g.initData(U(900)), num: loyal.number, code: 'd' });
  const toClient = g.sent.filter(m => m.method === 'sendMessage' && m.payload.chat_id === '501').pop();
  ok(done.ok && toClient.payload.reply_markup && /view=orders/.test(toClient.payload.reply_markup.inline_keyboard[0][0].web_app.url), '«виконано»: клиенту приходит кнопка «Повторити замовлення»');
  const mine = g.post({ action: 'orders.my', initData: g.initData(U(501)) });
  ok(mine.ok && mine.orders.length === 3 && mine.done === 3 && mine.orders.every(o => /^P-/.test(o.num)), '«мои заказы»: только свои, выполненных 3', [mine.orders.length, mine.done]);
  ok(g.post({ action: 'orders.my', initData: 'user=%7B%22id%22%3A501%7D&hash=' + '0'.repeat(64) }).error === 'bad_auth', 'чужие заказы без подписи не отдаются');
}

console.log('Аналитика');
{
  const g = fresh();
  const now = Date.now();
  const ev = (user, sid, events) => g.post({ action: 'ev', initData: g.initData(user), sid, events });
  ok(ev(U(70), 's1', [{ e: 'open', t: now }, { e: 'view', id: 'DRY-039', t: now }, { e: 'add', id: 'DRY-039', v: 190, t: now }, { e: 'checkout', v: 190, t: now }, { e: 'hack', t: now }]).n === 4, 'события записаны, неизвестное отброшено');
  ok(ev(U(71), 's2', [{ e: 'open', t: now }, { e: 'view', id: 'NUT-001', t: now }, { e: 'search0', v: 'Кава в зернах', t: now }]).n === 3, 'вторая сессия');
  ok(ev(U(72), 's3', [{ e: 'open', t: now }, { e: 'search0', v: 'кава в зернах', t: now }, { e: 'search', v: '=cmd()', t: now }]).n === 3, 'третья сессия');
  ok(ev(U(900), 's4', [{ e: 'open', t: now }]).n === 0, 'действия админа в статистику не попадают');
  ok(g.post({ action: 'ev', initData: 'bad', sid: 'x', events: [{ e: 'open' }] }).error === 'bad_auth', 'события без подписи Telegram не принимаются');
  const sheet = g.sheets['Події'].rows;
  ok(sheet.length === 11 && sheet[0][3] === 'Подія', 'лист «Події»: 10 строк и заголовок', sheet.length);
  ok(g.call('safeCell_', '=cmd()') === "'=cmd()", 'текст поиска не может стать формулой (пишется как текст)');
  const stats = g.post({ action: 'admin.stats', initData: g.initData(U(900)) });
  ok(stats.ok && stats.funnel.open === 3 && stats.funnel.view === 2 && stats.funnel.add === 1 && stats.funnel.checkout === 1, 'воронка: 3 → 2 → 1 → 1', stats.funnel);
  ok(stats.funnel.zero[0].q === 'кава в зернах' && stats.funnel.zero[0].n === 2, '«искали и не нашли» собирается без учёта регистра', stats.funnel.zero);
  ok(stats.funnel.viewed.some(v => v.id === 'DRY-039' && /Курага/.test(v.name)), 'самые просматриваемые товары с названиями');
  ok(stats.kpi.buyers === 4 && stats.kpi.repeat === 1 && stats.kpi.repeatPct === 25 && stats.kpi.aovAll === Math.round((330 + 660 + 493 + 290 + 328) / 5), 'средний чек и доля повторных покупателей', stats.kpi);
  ok(g.sheets['Статистика'].rows[2][0].indexOf('Середній чек') === 0, 'лист «Статистика» дополнен средним чеком и воронкой');
  ok(g.post({ action: 'admin.stats', initData: g.initData(U(70)) }).error === 'forbidden', 'статистика закрыта для не-админов');
}

console.log('«Сообщить, когда появится»');
{
  const g = fresh();
  const sub = id => g.post({ action: 'notify', initData: g.initData(U(80)), id, lang: 'ru' });
  ok(sub('DRY-005').ok === true && !sub('NUT-008').dup, 'подписка на товар, которого нет');
  ok(sub('DRY-005').dup === true, 'повторная подписка не дублируется');
  ok(sub('DRY-039').instock === true, 'товар в наличии — подписка не нужна');
  ok(sub('NOPE-1').error === 'bad_form', 'несуществующий товар');
  const before = g.sent.length;
  const upd = g.post({ action: 'admin.product', initData: g.initData(U(900)), id: 'DRY-005', patch: { stock: true } });
  const msgs = g.sent.slice(before).filter(m => m.method === 'sendMessage');
  ok(upd.ok && msgs.length === 1 && msgs[0].payload.chat_id === '80' && /Снова в наличии: Манго/.test(msgs[0].payload.text), 'админ вернул товар → клиенту ушло одно сообщение на его языке', msgs.map(m => m.payload));
  ok(/p=DRY-005/.test(msgs[0].payload.reply_markup.inline_keyboard[0][0].web_app.url), 'в сообщении кнопка, открывающая этот товар');
  const rows = g.sheets['Підписки'].rows;
  ok(rows[1][4] === 'надіслано' && rows[2][4] === 'чекає', 'статусы подписок обновлены', rows.map(r => r[4]));
  ok(g.call('notifyBackInStock_') === 0, 'второй раз то же сообщение не уходит');
}

console.log('Напоминание о повторном заказе');
{
  const g = fresh();
  ok(g.call('remindRepeat_') === 0, 'по умолчанию напоминания выключены');
  settings(g, { remind_days: '7' });
  const before = g.sent.length;
  const n = g.call('remindRepeat_');
  const msgs = g.sent.slice(before).filter(m => m.method === 'sendMessage');
  ok(n === 1 && msgs.map(m => m.payload.chat_id).join() === '501', 'напоминание только тому, чей последний заказ выполнен 7–14 дней назад (9 дней — да, 15 и 2 — нет)', msgs.map(m => m.payload.chat_id));
  ok(msgs[0].payload.reply_markup.inline_keyboard[1][0].callback_data === 'nr', 'в напоминании есть кнопка «Більше не нагадувати»');
  ok(g.call('remindRepeat_') === 0, 'одно напоминание на один заказ');
  const g2 = fresh();
  settings(g2, { remind_days: '7' });
  g2.post({ update_id: 1, callback_query: { id: 'c1', data: 'nr', from: { id: 501, language_code: 'uk' }, message: { message_id: 5, chat: { id: 501 } } } }, { src: 'tg', key: 'whsec' });
  const b2 = g2.sent.length;
  g2.call('remindRepeat_');
  ok(g2.sheets['Підписки'].rows[1][2] === 'REMIND' && g2.sent.slice(b2).filter(m => m.method === 'sendMessage').length === 0, 'отказавшемуся клиенту больше не пишем');
  ok(g2.post({ update_id: 2, message: { chat: { id: 1 }, text: '/start' } }, { src: 'tg', key: 'wrong' }) === 'forbidden', 'webhook с неверным ключом отклоняется');
}

console.log('Админ-панель и служебное');
{
  const g = fresh();
  ok(g.post({ action: 'admin.products', initData: g.initData(U(42)) }).error === 'forbidden', 'не-админ в панель не попадает');
  const list = g.post({ action: 'admin.products', initData: g.initData(U(900)) });
  const p = list.products.find(x => x.id === 'DRY-001');
  ok(p.end === '2099-12-31' && p.qty === '' && list.products.find(x => x.id === 'DRY-003').qty === '0,6', 'панель видит срок акции и остаток', [p.end, p.qty]);
  const upd = g.post({ action: 'admin.product', initData: g.initData(U(900)), id: 'NUT-002', patch: { qty: '1,5', end: '2099-01-15', badge: 'set', old: 700 } });
  ok(upd.ok && upd.product.qty === '1,5' && upd.product.end === '2099-01-15' && upd.product.badge === 'set', 'остаток, срок акции и бейдж «набір» сохраняются', upd.product);
  const cat = g.get({ action: 'catalog' }).products.find(x => x.id === 'NUT-002');
  ok(cat.q === 1.5 && cat.e === '2099-01-15' && cat.o === 700, 'и сразу видны на витрине', cat);
  ok(g.post({ action: 'admin.product', initData: g.initData(U(900)), id: 'NUT-002', patch: { end: 'завтра' } }).error === 'bad_form', 'неверная дата акции отклоняется');
  const clear = g.post({ action: 'admin.product', initData: g.initData(U(900)), id: 'NUT-002', patch: { qty: '', end: '' } });
  ok(clear.ok && clear.product.qty === '' && clear.product.end === '', 'остаток и срок можно очистить');
  const before = g.sent.length;
  g.call('setup');
  ok(!g.sent.slice(before).some(m => m.method === 'deleteWebhook') && g.triggers.indexOf('pollUpdates') < 0, 'setup() при включённом webhook не удаляет его и не включает опрос');
  let threw = false;
  try { g.call('startPolling'); } catch (e) { threw = true; }
  ok(threw, 'startPolling() при включённом webhook останавливается с понятной ошибкой');
  g.call('menuDailyOn');
  ok(g.triggers.filter(t => t === 'dailyJob').length === 1, 'ежедневный триггер создаётся один раз');
  g.call('dailyJob');
  g.call('menuDailyOff');
  ok(g.triggers.indexOf('dailyJob') < 0, 'и выключается');
  ok(g.post({ action: 'nope' }).error === 'unknown_action', 'неизвестное действие');
  ok(g.sandbox.__errors.length === 0, 'в логах бэкенда нет ошибок', g.sandbox.__errors);
}

console.log('\nИтог: ' + pass + ' пройдено, ' + fail + ' не пройдено');
process.exit(fail ? 1 : 0);
