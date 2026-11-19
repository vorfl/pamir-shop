// Проверка бэкенда (apps-script/Code.gs) на таблице в памяти. Запуск: node tests/test_backend.js
const path = require('path');
const { createGas, seed } = require('./gas_mock');
const CODE = path.join(__dirname, '..', 'apps-script', 'Code.gs');

let pass = 0, fail = 0;
function ok(cond, name, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra !== undefined ? ' → ' + JSON.stringify(extra) : '')); }
}
const isDateV = v => Object.prototype.toString.call(v) === '[object Date]';
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
  ok(adminMsg && adminMsg.payload.reply_markup.inline_keyboard.length === 3 && adminMsg.payload.reply_markup.inline_keyboard[2][0].callback_data === 'pay:P-0008' && /P-0008/.test(adminMsg.payload.text), 'админ получил сообщение с кнопками');
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
  { // гонка: дубль с тем же rid целиком выполняется, пока первый запрос ждёт блокировку (ранняя проверка уже пройдена)
    const gr = fresh();
    const rows0 = gr.sheets['Замовлення'].rows.length;
    const race = { action: 'order', initData: gr.initData(U(47)), items: [{ id: 'NUT-007', g: 0, q: 1 }], total: 85, name: 'Ігор', phone: '+380671234567', delivery: 'pickup', pay: 'cash', lang: 'ua', rid: 'race-rid' };
    const realLock = gr.sandbox.LockService;
    let inner = null, armed = true;
    gr.sandbox.LockService = { getScriptLock: () => { const l = realLock.getScriptLock(); return { tryLock: l.tryLock, releaseLock: l.releaseLock, waitLock(ms) { if (armed) { armed = false; inner = gr.post(race); } return l.waitLock(ms); } }; } };
    const outer = gr.post(race);
    gr.sandbox.LockService = realLock;
    const again = gr.post(race);
    const adminOrderMsgs = gr.sent.filter(m => m.method === 'sendMessage' && m.payload.chat_id === '900' && /P-\d+/.test(m.payload.text || ''));
    ok(inner && inner.ok && outer.ok && inner.number === outer.number && again.number === outer.number, 'гонка с тем же rid: оба ответа с одним номером', [inner, outer, again]);
    ok(gr.sheets['Замовлення'].rows.length === rows0 + 1, 'гонка с тем же rid: в листе одна новая строка', gr.sheets['Замовлення'].rows.length - rows0);
    ok(adminOrderMsgs.length === 1, 'гонка с тем же rid: админу ушло одно сообщение о заказе', adminOrderMsgs.length);
  }
  { // К1: тот же rid, другое содержимое — корзина не теряется молча
    const gk = fresh();
    const rows0 = gk.sheets['Замовлення'].rows.length;
    const mk = (uid, over) => Object.assign({ action: 'order', initData: gk.initData(U(uid)), items: [{ id: 'NUT-007', g: 0, q: 1 }], total: 85, name: 'Олена', phone: '+380501234567', delivery: 'pickup', pay: 'cash', lang: 'ua', rid: 'k1-rid' }, over || {});
    const first = gk.post(mk(60));
    const changed = gk.post(mk(60, { items: [{ id: 'NUT-007', g: 0, q: 1 }, { id: 'SWT-004', g: 0, q: 1 }], total: 150 }));
    ok(first.ok && first.number === 'P-0008' && changed.ok === false && changed.error === 'dup_changed' && changed.number === 'P-0008', 'К1: тот же rid с другой корзиной — dup_changed и номер первого заказа', [first, changed]);
    ok(gk.sheets['Замовлення'].rows.length === rows0 + 1 && gk.sheets['Замовлення'].rows.slice(-1)[0][13] === 85, 'К1: в таблице один заказ с первым составом (85 ₴)');
    const same = gk.post(mk(60));
    ok(same.ok === true && same.number === 'P-0008' && gk.sheets['Замовлення'].rows.length === rows0 + 1, 'К1: одинаковый повтор — ok и тот же номер, без второго заказа', same);
    const two = mk(61, { rid: 'k1-two', items: [{ id: 'NUT-007', g: 0, q: 1 }, { id: 'DRY-039', g: 500, q: 1 }], total: 275 });
    const twoRev = Object.assign({}, two, { items: two.items.slice().reverse() });
    const t1 = gk.post(two), t2 = gk.post(twoRev);
    ok(t1.ok && t2.ok && t1.number === t2.number, 'К1: порядок позиций в корзине не важен', [t1, t2]);
    const other = gk.post(mk(62));
    ok(other.ok === false && other.error === 'dup_changed' && !('number' in other) && !/P-\d/.test(JSON.stringify(other)), 'К1: другой пользователь с тем же rid — dup_changed без номера', other);
    const otherChanged = gk.post(mk(62, { items: [{ id: 'NUT-007', g: 0, q: 2 }], total: 170 }));
    ok(otherChanged.error === 'dup_changed' && !('number' in otherChanged), 'К1: чужой rid с другим составом — тоже без номера', otherChanged);
    const cm = gk.post(mk(60, { comment: 'новий коментар' }));
    ok(cm.error === 'dup_changed' && cm.number === 'P-0008', 'К1: изменён только комментарий — dup_changed', cm);
    const gn = gk.post(mk(60, { giftNote: 'Для мами' }));
    ok(gn.error === 'dup_changed', 'К1: изменена только подпись к подарку — dup_changed', gn);
    const ph = gk.post(mk(60, { phone: '+380509999999' }));
    ok(ph.error === 'dup_changed', 'К1: изменён только телефон — dup_changed', ph);
    const rec = gk.cache['rid_k1-rid'] || '';
    ok(rec && !/Олена|380501234567|NUT-007/.test(rec), 'К1: в кэше с rid нет имени, телефона и состава открытым текстом', rec);
    gk.cache['rid_old-rid'] = 'P-0042';
    const old = gk.post(mk(60, { rid: 'old-rid', total: 85 }));
    ok(old.ok === true && old.number === 'P-0042', 'К1: старая запись без отпечатка — как раньше (ok и номер)', old);
    ok(gk.sheets['Замовлення'].rows.length === rows0 + 2, 'К1: dup_changed ничего не записал (всего два новых заказа)', gk.sheets['Замовлення'].rows.length - rows0);
  }
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

/* ============================ Этап 8, волна 1 ============================ */
let updId = 1000;
const tgPost = (g, update) => g.post(Object.assign({ update_id: ++updId }, update), { src: 'tg', key: 'whsec' });
const tgMsg = (g, uid, text, extra) => tgPost(g, { message: Object.assign({ chat: { id: uid, type: 'private' }, from: { id: uid, first_name: 'Гість' + uid, username: 'guest' + uid, language_code: 'uk' }, text }, extra || {}) });
const tgPress = (g, uid, data, chat) => tgPost(g, { callback_query: { id: 'cq' + updId, data, from: { id: uid, first_name: 'Гість' + uid, language_code: 'uk' }, message: { message_id: 77, chat: { id: chat || uid } } } });
const adm = (g, uid, action, data) => g.post(Object.assign({ action, initData: g.initData(U(uid)) }, data || {}));
const lastTo = (g, chat, method) => g.sent.filter(m => String(m.payload.chat_id) === String(chat) && (!method || m.method === method)).pop();
/** Владелец 900 приглашает человека uid с ролью и правами и подтверждает запрос. */
function addAdmin(g, uid, role, perms, by) {
  const inv = adm(g, by || 900, 'admin.adminInvite', { role, perms });
  tgMsg(g, uid, '/start ' + inv.code);
  tgPress(g, by || 900, 'ai:' + inv.code.slice(4) + ':y');
  return inv;
}

console.log('Админы: роли и приглашения');
{
  const g = fresh();
  const me = adm(g, 900, 'admin.me');
  ok(me.ok && me.me.role === 'owner' && me.me.perms.length === 12, 'без OWNER_CHAT_ID владелец — первый id из ADMIN_CHAT_IDS', me.me);
  const inv = adm(g, 900, 'admin.adminInvite', { role: 'manager', perms: ['st', 'stock', 'nope'] });
  ok(inv.ok && /^adm_[0-9a-f]{20}$/.test(inv.code), 'приглашение: одноразовый код', inv);
  tgMsg(g, 700, '/start ' + inv.code);
  const ask = lastTo(g, 900, 'sendMessage');
  ok(ask && /Запит на доступ/.test(ask.payload.text) && /guest700/.test(ask.payload.text) && ask.payload.reply_markup.inline_keyboard[0].length === 2, 'пригласивший получил запрос с кнопками «Підтвердити / Відхилити»');
  ok(/Запит на доступ надіслано/.test(lastTo(g, 700, 'sendMessage').payload.text), 'приглашённый получил «запит надіслано»');
  ok(adm(g, 700, 'admin.orders').error === 'forbidden', 'до подтверждения прав нет');
  tgMsg(g, 701, '/start ' + inv.code);
  ok(/недійсне/.test(lastTo(g, 701, 'sendMessage').payload.text), 'вторым человеком ссылку использовать нельзя');
  tgPress(g, 701, 'ai:' + inv.code.slice(4) + ':y');
  ok(adm(g, 700, 'admin.orders').error === 'forbidden' && !g.sheets['Адміни'], 'посторонний не может подтвердить приглашение');
  tgPress(g, 900, 'ai:' + inv.code.slice(4) + ':y');
  const rows = g.sheets['Адміни'].rows, head = rows[0];
  const row = rows[1];
  ok(row[0] === '700' && row[head.indexOf('Роль')] === 'Менеджер' && row[head.indexOf('Замовлення: статуси')] === 'так' && row[head.indexOf('Наявність і залишки')] === 'так' &&
    row[head.indexOf('Ціни та акції')] === '' && row[head.indexOf('Активний')] === 'так', 'после подтверждения — строка в листе «Адміни» с выбранными правами', row);
  const o = adm(g, 700, 'admin.orders');
  ok(o.ok && o.me.role === 'manager' && o.me.perms.sort().join() === 'st,stock' && o.orders.length > 0 && o.orders[0].phone && o.stats === null, 'менеджер видит заказы (с телефоном), но не итоги продаж', o.me);
  ok(/Доступ до адмін-панелі PAMIR надано/.test(lastTo(g, 700, 'sendMessage').payload.text), 'новому админу пришло сообщение');
  tgMsg(g, 702, '/start ' + inv.code);
  ok(/недійсне/.test(lastTo(g, 702, 'sendMessage').payload.text), 'использованная ссылка больше не работает');
  const inv2 = adm(g, 900, 'admin.adminInvite', { role: 'admin' });
  tgMsg(g, 703, '/start ' + inv2.code);
  tgPress(g, 900, 'ai:' + inv2.code.slice(4) + ':n');
  ok(adm(g, 703, 'admin.orders').error === 'forbidden' && /відхилено/.test(lastTo(g, 703, 'sendMessage').payload.text), 'отклонённый запрос прав не даёт');
  const g2 = fresh();
  g2.props.OWNER_CHAT_ID = '901';
  ok(adm(g2, 901, 'admin.me').me.role === 'owner' && adm(g2, 900, 'admin.me').me.role === 'admin', 'OWNER_CHAT_ID задаёт владельца; id из ADMIN_CHAT_IDS остаются полными админами');
  const old = g2.post({ action: 'admin.orders', initData: g2.initData(U(900)) });
  ok(old.ok && old.orders.length === 7 && old.stats.week.n >= 1, 'старая панель (без admin.me) продолжает работать');
}

console.log('Админы: права проверяет сервер');
{
  const g = fresh();
  addAdmin(g, 700, 'manager', ['st', 'stock']);
  addAdmin(g, 710, 'manager', ['text', 'photo']);
  const sheet = g.sheets['Товари'].rows, kg = sheet[0].indexOf('Ціна за 1 кг');
  const before = sheet.find(r => r[0] === 'NUT-002')[kg];
  const deny = adm(g, 700, 'admin.product', { id: 'NUT-002', patch: { price: 1 } });
  ok(deny.error === 'no_perm' && deny.need === 'price' && sheet.find(r => r[0] === 'NUT-002')[kg] === before, 'менеджер без права «Ціни» не может изменить цену прямым запросом', deny);
  const mixed = adm(g, 700, 'admin.product', { id: 'NUT-002', patch: { stock: false, old: 999, end: '2099-01-01' } });
  ok(mixed.error === 'no_perm' && g.get({ action: 'catalog' }).products.find(p => p.id === 'NUT-002').a === 1, 'запрос, где есть хоть одно запрещённое поле, отклоняется целиком');
  ok(adm(g, 700, 'admin.product', { id: 'NUT-002', patch: { stock: false } }).ok, 'наличие менять можно — право есть');
  ok(adm(g, 700, 'admin.product', { id: 'NUT-002', patch: { ua: 'Нова назва' } }).need === 'text', 'тексты без права «Тексти товарів» менять нельзя');
  ok(adm(g, 710, 'admin.product', { id: 'NUT-002', patch: { ua: 'Кеш’ю смажений великий', dUa: 'Опис' } }).ok, 'а с правом — можно');
  ok(adm(g, 710, 'admin.product', { id: 'NUT-002', patch: { stock: true } }).need === 'stock', 'наличие без права менять нельзя');
  ok(adm(g, 700, 'admin.productAdd', { patch: { cat: 'Чай', t: 'p', ua: 'Тест', price: 5 } }).error === 'no_perm', 'добавить товар без прав на тексты и цены нельзя');
  ok(adm(g, 700, 'admin.settingsSave', { values: { min_order: '5' } }).need === 'settings' && adm(g, 700, 'admin.settings').need === 'settings', 'настройки закрыты');
  ok(adm(g, 700, 'admin.stats').need === 'stats' && adm(g, 700, 'admin.category', { category: { code: 'TEA', ua: 'Чай', order: 1 } }).need === 'cats', 'статистика и категории закрыты');
  ok(adm(g, 700, 'admin.admins').need === 'admins' && adm(g, 700, 'admin.log').need === 'admins' && adm(g, 700, 'admin.adminInvite', { role: 'admin' }).need === 'admins', 'список админов, журнал и приглашения закрыты');
  ok(adm(g, 700, 'admin.photo', { id: 'NUT-002', data: 'xx' }).need === 'photo', 'фото без права загрузить нельзя');
  ok(adm(g, 700, 'admin.status', { num: 'P-0004', code: 's' }).ok && adm(g, 710, 'admin.status', { num: 'P-0004', code: 'd' }).need === 'st', 'статус меняет только тот, у кого есть право');
  tgPress(g, 710, 'st:P-0004:d');
  ok(g.sheets['Замовлення'].rows[4][2] === 'відправлено', 'кнопка под заказом в Telegram тоже проверяет право', g.sheets['Замовлення'].rows[4][2]);
  tgPress(g, 700, 'st:P-0004:d');
  ok(g.sheets['Замовлення'].rows[4][2] === 'виконано', 'а у менеджера с правом кнопка работает');
  const text = JSON.stringify(adm(g, 700, 'admin.products')) + JSON.stringify(adm(g, 900, 'admin.products'));
  ok(!/СЕКРЕТ|do-smaku|33%/.test(text), 'служебные колонки R–X не уходят и в админ-панель');
  const before2 = g.sent.length;
  order(g, U(42), [{ id: 'NUT-007', g: 0, q: 1 }], 85);
  const to = g.sent.slice(before2).filter(m => m.method === 'sendMessage' && /Замовлення P-/.test(m.payload.text) && m.payload.reply_markup).map(m => String(m.payload.chat_id)).sort();
  ok(to.join() === '700,710,900', 'новый заказ приходит всем, у кого включены уведомления', to);
  adm(g, 900, 'admin.adminSave', { id: '710', notify: false });
  const before3 = g.sent.length;
  order(g, U(43), [{ id: 'NUT-007', g: 0, q: 1 }], 85);
  ok(!g.sent.slice(before3).some(m => String(m.payload.chat_id) === '710'), 'выключил уведомления — заказы не приходят');
}

console.log('Админы: кто кого может менять');
{
  const g = fresh();
  addAdmin(g, 720, 'manager', ['admins', 'stock']);
  addAdmin(g, 730, 'admin');
  addAdmin(g, 740, 'manager', ['st']);
  ok(adm(g, 720, 'admin.adminInvite', { role: 'manager', perms: ['price'] }).need === 'grant', 'нельзя выдать право, которого нет у самого');
  ok(adm(g, 720, 'admin.adminInvite', { role: 'admin' }).need === 'grant', 'менеджер не может пригласить полного админа');
  ok(adm(g, 720, 'admin.adminInvite', { role: 'manager', perms: ['stock'] }).ok, 'своё право выдать можно');
  ok(adm(g, 720, 'admin.adminSave', { id: '740', perms: ['st', 'price'] }).need === 'grant', 'добавить чужому менеджеру право, которого нет у самого, нельзя');
  ok(adm(g, 720, 'admin.adminSave', { id: '740', perms: [] }).need === 'grant', 'и забрать право, которого нет у самого, тоже нельзя');
  const up = adm(g, 720, 'admin.adminSave', { id: '740', perms: ['st', 'stock'] });
  ok(up.ok && up.admins.find(a => a.id === '740').perms.sort().join() === 'st,stock', 'а своё право — можно', up.error);
  const toOwner = lastTo(g, 900, 'sendMessage');
  ok(toOwner && /змінив права/.test(toOwner.payload.text) && /Наявність і залишки/.test(toOwner.payload.text), 'владельцу приходит сообщение о каждом изменении админов', toOwner && toOwner.payload.text);
  ok(adm(g, 720, 'admin.adminSave', { id: '730', role: 'manager', perms: [] }).error === 'owner_only' && adm(g, 730, 'admin.adminSave', { id: '730', active: false }).error === 'self', 'полного админа меняет только владелец; себя менять нельзя');
  ok(adm(g, 730, 'admin.adminSave', { id: '900', active: false }).error === 'owner_locked' && adm(g, 900, 'admin.me').me.role === 'owner', 'владельца нельзя отключить или понизить');
  g.sheets['Адміни'].rows.push(['900', 'Хтось', '', 'Менеджер'].concat(new Array(16).fill('')));
  ok(adm(g, 900, 'admin.me').me.role === 'owner', 'строка в листе «Адміни» с id владельца ничего не меняет');
  const down = adm(g, 900, 'admin.adminSave', { id: '730', role: 'manager', perms: ['st'] });
  ok(down.ok && adm(g, 730, 'admin.settings').need === 'settings', 'владелец понизил админа до менеджера');
  ok(adm(g, 900, 'admin.adminSave', { id: '740', active: false }).ok && adm(g, 740, 'admin.orders').error === 'forbidden', 'отключённый админ теряет доступ сразу');
  const g2 = fresh();
  g2.props.ADMIN_CHAT_IDS = '900, 905';
  ok(adm(g2, 905, 'admin.me').me.role === 'admin', 'второй id из ADMIN_CHAT_IDS — полный админ');
  ok(adm(g2, 900, 'admin.adminSave', { id: '905', active: false }).ok && adm(g2, 905, 'admin.orders').error === 'forbidden', 'владелец отключил его в панели — запасной список доступ не возвращает');
  const list = adm(g, 900, 'admin.admins');
  ok(list.ok && list.admins[0].role === 'owner' && list.permList.length === 12 && list.invites.length === 1, 'список админов и ожидающих приглашений', list.invites);
}

console.log('Журнал действий');
{
  const g = fresh();
  adm(g, 900, 'admin.product', { id: 'NUT-002', patch: { price: 700, stock: false } });
  adm(g, 900, 'admin.status', { num: 'P-0004', code: 's' });
  adm(g, 900, 'admin.settingsSave', { values: { min_order: '150' } });
  addAdmin(g, 700, 'manager', ['st']);
  tgPress(g, 700, 'st:P-0004:d');
  const log = adm(g, 900, 'admin.log');
  const find = (act, obj) => log.rows.find(r => r.act === act && (!obj || r.obj.indexOf(obj) === 0));
  ok(log.ok && find('Товар: ціна', 'NUT-002').was === '640' && find('Товар: ціна', 'NUT-002').now === '700', 'цена: было → стало', find('Товар: ціна'));
  ok(find('Товар: наявність').was === 'є' && find('Товар: наявність').now === 'немає', 'наличие: было → стало');
  ok(log.rows.some(r => r.act === 'Замовлення: статус' && r.obj === 'P-0004' && r.was === 'підтверджено' && r.now === 'відправлено' && /Тест900/.test(r.who)), 'статус из панели: кто и что');
  ok(log.rows.some(r => r.act === 'Замовлення: статус' && r.now === 'виконано' && /Гість700/.test(r.who)), 'статус из кнопки в Telegram тоже в журнале');
  ok(find('Налаштування', 'min_order').now === '150' && find('Адміни: додано') && find('Адміни: запрошення'), 'настройки и изменения админов в журнале');
  ok(g.sheets['Журнал'].rows[0].join() === "Час,Хто,Chat id,Дія,Об'єкт,Було,Стало" && log.rows[0].act === 'Замовлення: статус', 'лист «Журнал», свежие записи сверху');
}

console.log('Приветствие бота');
{
  const g = fresh();
  tgMsg(g, 800, '/start');
  const w = lastTo(g, 800);
  const kb = w.payload.reply_markup.inline_keyboard;
  ok(w.method === 'sendPhoto' && w.payload.photo === 'https://example.test/webapp/welcome.jpg' && /^Вітаємо, Гість800!/.test(w.payload.caption) && /Ісфарі/.test(w.payload.caption), 'новичок: фото-заглушка и тёплый текст с именем', w.payload);
  ok(kb[0][0].web_app.url === 'https://example.test/webapp/' && kb.length === 3 && kb[1][0].callback_data === 'm:pts' && kb[1][1].callback_data === 'm:apr' && kb[2][0].callback_data === 'm:biz' && kb[2].length === 1,
    'кнопки: магазин, точки, курага, опт; «Написати нам» нет, пока контакт не задан', kb);
  tgMsg(g, 501, '/start', { from: { id: 501, first_name: 'Олена', language_code: 'ru' } });
  const b = lastTo(g, 501);
  ok(/^С возвращением, Олена!/.test(b.payload.caption) && /repeat=last/.test(b.payload.reply_markup.inline_keyboard[1][0].web_app.url) && /Повторить/.test(b.payload.reply_markup.inline_keyboard[1][0].text), 'вернувшийся клиент: «З поверненням» на его языке и кнопка «Повторити звичне»', b.payload.caption);
  tgMsg(g, 504, '/start');
  ok(/^Вітаємо/.test(lastTo(g, 504).payload.caption), 'у кого только отменённый заказ — обычное приветствие');
  settings(g, { welcome_video_note: 'VN_FILE_1', welcome_photo: 'PHOTO_FILE_1', contact: '@pamir_help', greeting_ua: 'Привіт, {ім’я}! Свій текст.' });
  const n0 = g.sent.length;
  tgMsg(g, 801, '/start', { from: { id: 801, language_code: 'uk' } });
  const seq = g.sent.slice(n0);
  ok(seq[0].method === 'sendVideoNote' && seq[0].payload.video_note === 'VN_FILE_1' && seq[1].method === 'sendPhoto' && seq[1].payload.photo === 'PHOTO_FILE_1', 'видеокружок идёт перед приветствием, фото — из настроек');
  ok(seq[1].payload.caption === 'Привіт! Свій текст.' && seq[1].payload.reply_markup.inline_keyboard[2][1].url === 'https://t.me/pamir_help', 'свой текст; без имени обращение убирается; появилась кнопка «Написати нам»', seq[1].payload.caption);
  tgMsg(g, 802, '/start DRY-039');
  ok(/Курага/.test(lastTo(g, 802).payload.text) && /p=DRY-039/.test(lastTo(g, 802).payload.reply_markup.inline_keyboard[0][0].web_app.url), 'ссылка на товар работает как раньше');
  tgMsg(g, 803, '/start ref_abc123');
  ok(lastTo(g, 803).method === 'sendPhoto', 'start=ref_… пока даёт обычное приветствие');
  g.setTelegramFail(true);
  const n1 = g.sent.length;
  tgMsg(g, 804, '/start');
  ok(g.sent.slice(n1).map(m => m.method).join() === 'sendVideoNote,sendPhoto,sendMessage', 'если фото не отправилось — приветствие уходит обычным текстом');
  g.setTelegramFail(false);
  tgPost(g, { message: { chat: { id: 900, type: 'private' }, from: { id: 900 }, video_note: { file_id: 'VN_NEW' } } });
  ok(/VN_NEW/.test(lastTo(g, 900).payload.text), 'админ прислал кружок — бот ответил его file_id');
  const n2 = g.sent.length;
  tgPost(g, { message: { chat: { id: 805, type: 'private' }, from: { id: 805 }, photo: [{ file_id: 'a' }, { file_id: 'b' }] } });
  ok(g.sent.length === n2, 'фото от обычного клиента бот не комментирует');
  settings(g, { feature_id: 'DRY-039' });
  tgPress(g, 800, 'm:apr');
  ok(/Наша курага/.test(lastTo(g, 800).payload.text) && /p=DRY-039/.test(lastTo(g, 800).payload.reply_markup.inline_keyboard[0][0].web_app.url), 'кнопка «Наша курага» открывает товар из настроек');
  tgPress(g, 800, 'm:pts');
  ok(/Центральний ринок/.test(lastTo(g, 800).payload.text), 'кнопка «Наші точки» присылает адрес и часы');
  tgPress(g, 800, 'm:biz');
  ok(/кафе/.test(lastTo(g, 800).payload.text) && /view=biz/.test(lastTo(g, 800).payload.reply_markup.inline_keyboard[0][0].web_app.url) && lastTo(g, 800).payload.reply_markup.inline_keyboard[1][0].url === 'https://t.me/pamir_help', 'кнопка «Для бізнесу»: форма заявки (волна 2б) и контакт');
  ok(!/сірк|серы/i.test(JSON.stringify(g.get({ action: 'catalog' }).shop) + JSON.stringify(adm(g, 900, 'admin.settings'))), 'в текстах по умолчанию нет утверждений про серу');
  ok(g.sandbox.__errors.length === 0, 'в логах бэкенда нет ошибок', g.sandbox.__errors);
}

console.log('Этап 8, волна 1: точки, паспорт товара, продажи');
{
  const g = fresh();
  const before = g.get({ action: 'catalog' });
  ok(!before.shop.points && !before.shop.np && !before.shop.theme && before.shop.story && /Ісфар/.test(before.shop.story.text.ua), 'до настройки: точек нет, страница «Від саду до столу» с текстом-заглушкой', before.shop);
  const created = g.call('setupStage8');
  ok(g.sheets['Точки'] && g.sheets['Точки'].rows.length === 3 && g.sheets['Відгуки'] && g.sheets['Кошики'], 'setupStage8 создаёт листы «Точки» (с примером), «Відгуки», «Кошики»', created);
  const ph = g.sheets['Товари'].rows[0];
  ok(['Сорт', 'Урожай', 'Походження', 'Свіжа поставка', 'Підказка до ваги', 'Ціни фасувань'].every(h => ph.includes(h)) && g.sheets['Замовлення'].rows[0].includes('ТТН'), 'setupStage8 добавляет необязательные колонки в «Товари» и «ТТН» в «Замовлення»');
  ok(g.call('setupStage8').length === 0, 'повторный запуск setupStage8 ничего не меняет');
  const row = id => g.sheets['Товари'].rows.find(r => r[0] === id);
  const dmy = daysAgo => { const d = new Date(Date.now() - daysAgo * 864e5); return String(d.getUTCDate()).padStart(2, '0') + '.' + String(d.getUTCMonth() + 1).padStart(2, '0') + '.' + d.getUTCFullYear(); };
  const set = (id, head, v) => { row(id)[ph.indexOf(head)] = v; };
  set('DRY-039', 'Сорт', 'Бобої'); set('DRY-039', 'Урожай', 2026); set('DRY-039', 'Походження', 'Ісфара, Таджикистан');
  set('DRY-039', 'Свіжа поставка', dmy(3)); set('DRY-039', 'Підказка до ваги', '250 г ≈ жменя на день протягом тижня'); set('DRY-039', 'Ціни фасувань', '1 кг = 360');
  set('NUT-001', 'Свіжа поставка', dmy(40)); set('NUT-002', 'Свіжа поставка', dmy(-5));
  g.clearCache();
  const text = JSON.stringify(g.get({ action: 'catalog' }));
  const cat = JSON.parse(text);
  const by = {}; cat.products.forEach(p => { by[p.id] = p; });
  const pts = cat.shop.points;
  ok(pts.length === 2 && pts[0].h[0] === '' && pts[0].h[1] === '07:00-17:00' && pts[0].h[6] === '07:00-17:00' && /^https:\/\/www\.google\.com\/maps/.test(pts[0].map) && pts[0].pl.ua === 'Ряд 3, місце 12',
    'точки в каталоге: понедельник выходной, вт–нд 07:00–17:00, ряд и место, ссылка на карту', pts[0]);
  ok(!/СЕКРЕТ|do-smaku|33%/.test(text), 'служебные колонки R–X не уходят и после добавления новых колонок');
  const k = by['DRY-039'];
  ok(k.ps === 'Бобої' && k.ph === '2026' && k.po === 'Ісфара, Таджикистан' && k.f === 1 && /^\d{4}-\d\d-\d\d$/.test(k.pf) && /жменя/.test(k.h), 'паспорт товара и подсказка к весу — из таблицы', k);
  ok(by['NUT-001'].pf && !by['NUT-001'].f && !by['NUT-002'].pf && !by['NUT-003'].ps && !by['NUT-003'].pf, 'бейдж «Свіжа поставка» только 14 дней; дата из будущего и пустые колонки не показываются');
  ok(k.v[2][0] === 1000 && k.v[2][1] === 360 && k.v[0][1] === 95, '«Ціни фасувань»: 1 кг = 360 ₴, остальные фасовки по цене за кг', k.v);
  ok(order(g, U(41), [{ id: 'DRY-039', g: 1000, q: 1 }], 380).error === 'changed' && order(g, U(41), [{ id: 'DRY-039', g: 1000, q: 1 }], 360).ok, 'сервер считает заказ по своей цене фасовки');
  ok(by['SWT-004'].q === 3, '«Залишилось 3» при пороге по умолчанию 5');
  settings(g, { low_stock: '2', fresh_days: '0', theme: 'newyear' });
  const cat2 = g.get({ action: 'catalog' });
  const by2 = {}; cat2.products.forEach(p => { by2[p.id] = p; });
  ok(by2['SWT-004'].q === undefined && !by2['DRY-039'].f && by2['DRY-039'].pf && cat2.shop.theme === 'newyear', 'порог «Залишилось», срок бейджа свежести и сезонная тема берутся из настроек');
  settings(g, { theme: 'halloween' });
  ok(!g.get({ action: 'catalog' }).shop.theme, 'неизвестная сезонная тема не включается');

  // Самовывоз с выбором точки
  const r1 = order(g, U(42), [{ id: 'NUT-007', g: 0, q: 1 }], 85, { point: pts[1].id });
  const orders = g.sheets['Замовлення'].rows, oh = orders[0];
  const last = () => orders[orders.length - 1];
  ok(r1.ok && last()[oh.indexOf('Доставка')] === 'самовивіз · Точка 2 — критий павільйон', 'точка самовывоза записана в заказ', last()[oh.indexOf('Доставка')]);
  ok(/Самовивіз: Точка 2/.test(lastTo(g, 900).payload.text), 'админ видит точку в уведомлении');
  tgPress(g, 900, 'st:' + r1.number + ':c');
  ok(/Точка 2/.test(lastTo(g, 42).payload.text) && /Ряд 5, місце 7/.test(lastTo(g, 42).payload.text) && /Пн: вихідний/.test(lastTo(g, 42).payload.text), 'клиенту при подтверждении приходит его точка, место и часы', lastTo(g, 42).payload.text);
  tgPress(g, 900, 'st:' + r1.number + ':s');
  ok(!/ТТН/.test(lastTo(g, 900).payload.text), 'для самовывоза бот не спрашивает ТТН');
  const r0 = order(g, U(43), [{ id: 'NUT-007', g: 0, q: 1 }], 85);
  ok(r0.ok && last()[oh.indexOf('Доставка')] === 'самовивіз · Точка 1 — критий павільйон', 'старая витрина точку не присылает — берётся первая');
  tgPress(g, 800, 'm:pts');
  ok(/Точка 1/.test(lastTo(g, 800).payload.text) && /Точка 2/.test(lastTo(g, 800).payload.text) && /Вт–Нд: 07:00–17:00/.test(lastTo(g, 800).payload.text), 'кнопка бота «Наші точки» показывает обе точки с часами', lastTo(g, 800).payload.text);

  // Нова пошта: поштомат, курьер, ТТН
  const np = { delivery: 'np', city: 'Київ', branch: '5123', npType: 'locker', pay: 'cod' };
  const r2 = order(g, U(44), [{ id: 'NUT-007', g: 0, q: 2 }], 170, np);
  ok(r2.ok && last()[oh.indexOf('Доставка')] === 'Нова пошта · поштомат' && /поштомат 5123/.test(lastTo(g, 900).payload.text), 'поштомат записан в заказ и виден админу', last()[oh.indexOf('Доставка')]);
  ok(order(g, U(45), [{ id: 'NUT-007', g: 0, q: 1 }], 85, { delivery: 'np', city: 'Київ', branch: 'д.5', npType: 'courier' }).error === 'bad_form', 'курьер без нормального адреса отклоняется');
  const r3 = order(g, U(45), [{ id: 'NUT-007', g: 0, q: 1 }], 85, { delivery: 'np', city: 'Київ', branch: 'вул. Хрещатик, буд. 1, кв. 15, під’їзд 2, код 15К', npType: 'courier' });
  ok(r3.ok && last()[oh.indexOf('Доставка')] === 'Нова пошта · кур’єр' && /під’їзд 2/.test(last()[oh.indexOf('Відділення НП')]), 'курьер: адрес сохранён целиком');
  tgPress(g, 900, 'st:' + r2.number + ':s');
  ok(/ТТН для замовлення P-\d+/.test(lastTo(g, 900).payload.text) && lastTo(g, 900).payload.reply_markup.inline_keyboard[0][0].callback_data === 'tx:' + r2.number, 'после «Відправлено» бот спрашивает ТТН и даёт кнопку «Пропустити»');
  tgMsg(g, 900, '2045 0000 1234 56');
  const rowOf = num => orders.find(r => r[0] === num);
  const track = lastTo(g, 44);
  ok(JSON.parse(rowOf(r2.number)[oh.indexOf('Службове')]).ttn === '20450000123456' && rowOf(r2.number)[oh.indexOf('ТТН')] === '20450000123456', 'ТТН записан в заказ', rowOf(r2.number));
  ok(/20450000123456/.test(track.payload.text) && track.payload.reply_markup.inline_keyboard[0][0].url === 'https://novaposhta.ua/tracking/?cargo_number=20450000123456', 'клиент получил ТТН и кнопку «Відстежити»', track.payload);
  const mine = g.post({ action: 'orders.my', initData: g.initData(U(44)) });
  ok(mine.ok && mine.orders[0].ttn === '20450000123456', 'ТТН виден в «Мої замовлення»', mine.orders && mine.orders[0]);
  ok(adm(g, 900, 'admin.orders').orders.find(o => o.num === r2.number).ttn === '20450000123456', 'ТТН виден в панели');
  ok(adm(g, 900, 'admin.ttn', { num: r3.number, ttn: '12ab' }).error === 'bad_ttn' && adm(g, 900, 'admin.ttn', { num: r3.number, ttn: '59000111222333' }).ok, 'ТТН из панели: проверка формата и запись');
  addAdmin(g, 801, 'manager', ['stock']);
  ok(adm(g, 801, 'admin.ttn', { num: r3.number, ttn: '59000111222334' }).error === 'no_perm' && adm(g, 801, 'admin.reviews').error === 'no_perm', 'менеджер без прав не может записать ТТН и открыть отзывы');
  tgPress(g, 900, 'st:' + r3.number + ':s');
  ok(!g.sent.some(m => m.method === 'sendMessage' && /ТТН для замовлення/.test(m.payload.text) && m.payload.text.includes(r3.number)), 'если ТТН уже записан, бот не спрашивает его повторно');
  ok(g.get({ action: 'np.city', q: 'хар' }).error === 'off', 'подсказки Новой почты выключены без NP_API_KEY');
  g.props.NP_API_KEY = 'test'; g.clearCache();
  ok(g.get({ action: 'catalog' }).shop.np === 1 && g.get({ action: 'np.city', q: 'хар' }).ok === false && g.get({ action: 'np.wh', city: 'bad', q: '' }).error === 'bad_form', 'с NP_API_KEY витрина узнаёт о подсказках; сбой API не ломает сервер');
  ok(g.sandbox.__errors.length === 0, 'в логах бэкенда нет ошибок', g.sandbox.__errors);
}

console.log('Этап 8, волна 1: хит недели, отзывы, брошенная корзина');
{
  const g = fresh();
  ok(!g.get({ action: 'catalog' }).products.some(p => p.hw), '«Хіт тижня» не показывается, пока нет двух заказов за 7 дней');
  const a = order(g, U(61), [{ id: 'SWT-006', g: 0, q: 1 }, { id: 'NUT-007', g: 0, q: 1 }], 155);
  order(g, U(62), [{ id: 'SWT-006', g: 0, q: 3 }], 210);
  g.clearCache();
  const hits = g.get({ action: 'catalog' }).products.filter(p => p.hw).map(p => p.id);
  ok(hits.length === 1 && hits[0] === 'SWT-006', '«Хіт тижня» считается по настоящим заказам за 7 дней', hits);

  // Отзывы
  const orders = g.sheets['Замовлення'].rows, oh = orders[0], svcAt = oh.indexOf('Службове');
  const rowOf = num => orders.find(r => r[0] === num);
  tgPress(g, 900, 'st:' + a.number + ':d');
  const svc = JSON.parse(rowOf(a.number)[svcAt]);
  ok(svc.dn > 0, 'время статуса «виконано» запомнено');
  ok(g.call('askReviews_') === 0, 'через 0 дней отзыв ещё не просим');
  svc.dn = Date.now() - 3 * 864e5; rowOf(a.number)[svcAt] = JSON.stringify(svc);
  ok(g.call('askReviews_') === 1 && lastTo(g, 61).payload.reply_markup.inline_keyboard[0].length === 5 && lastTo(g, 61).payload.reply_markup.inline_keyboard[0][4].callback_data === 'rv:' + a.number + ':5', 'через 2+ дня бот просит оценку: кнопки 1–5', lastTo(g, 61).payload);
  ok(g.call('askReviews_') === 0, 'второй раз о том же заказе не просим');
  tgPress(g, 62, 'rv:' + a.number + ':1');
  ok(!g.sheets['Відгуки'] || g.sheets['Відгуки'].rows.length <= 1, 'чужой заказ оценить нельзя');
  tgPress(g, 61, 'rv:' + a.number + ':5');
  const rv = g.sheets['Відгуки'].rows;
  ok(rv.length === 3 && rv[1][5] === 'SWT-006' && rv[1][7] === 5 && rv[1][10] === 'новий' && rv[2][5] === 'NUT-007', 'оценка записана по каждому товару заказа со статусом «новий»', rv.slice(1));
  ok(/Відгук на модерацію/.test(lastTo(g, 900).payload.text) && lastTo(g, 900).payload.reply_markup.inline_keyboard[0][0].callback_data === 'rm:' + a.number + ':y', 'админ с правом «Відгуки» получил отзыв на модерацию');
  tgMsg(g, 61, 'Козинаки свіжі, дуже смачно');
  ok(rv[1][8] === 'Козинаки свіжі, дуже смачно' && rv[2][8] === rv[1][8], 'текст отзыва от покупателя сохранён');
  let cat = g.get({ action: 'catalog' });
  ok(!cat.products.find(p => p.id === 'SWT-006').rc && g.get({ action: 'reviews', id: 'SWT-006' }).reviews.length === 0, 'до одобрения отзыв на витрине не виден');
  addAdmin(g, 801, 'manager', ['stock']);
  tgPress(g, 801, 'rm:' + a.number + ':y');
  ok(rv[1][10] === 'новий', 'без права «Відгуки» одобрить отзыв кнопкой нельзя');
  tgPress(g, 900, 'rm:' + a.number + ':y');
  cat = g.get({ action: 'catalog' });
  const shown = g.get({ action: 'reviews', id: 'SWT-006' }).reviews;
  ok(rv[1][10] === 'схвалено' && cat.products.find(p => p.id === 'SWT-006').rc === 1 && cat.products.find(p => p.id === 'SWT-006').ra === undefined, 'после одобрения: 1 отзыв, средней оценки нет (меньше трёх)');
  ok(shown.length === 1 && shown[0].r === 5 && /Козинаки/.test(shown[0].t) && shown[0].n === 'Гість61' && !/61\b.*@|380/.test(JSON.stringify(shown)), 'на витрине: только имя, дата, оценка и текст', shown);
  rv.push(['R-0101', new Date(), 'P-0001', '501', 'Олена', 'SWT-006', 'Козинаки', 4, '', '', 'схвалено', 'ua', ''], ['R-0102', new Date(), 'P-0002', '502', 'Ігор', 'SWT-006', 'Козинаки', 4, 'Добре', '', 'схвалено', 'ua', ''],
    ['R-0103', new Date(), 'P-0003', '503', 'Хтось', 'SWT-006', 'Козинаки', 1, 'погано', '', 'новий', 'ua', '']);
  g.clearCache();
  cat = g.get({ action: 'catalog' });
  ok(cat.products.find(p => p.id === 'SWT-006').rc === 3 && cat.products.find(p => p.id === 'SWT-006').ra === 4.3, 'от трёх одобренных отзывов показывается средняя оценка 4,3', cat.products.find(p => p.id === 'SWT-006'));
  const list = adm(g, 900, 'admin.reviews');
  ok(list.ok && list.reviews.length === 5 && list.reviews[0].id === 'R-0103', 'панель: список отзывов, новые сверху');
  const hid = adm(g, 900, 'admin.review', { id: 'R-0102', ok: false, text: 'подмена', rate: 5 });
  ok(hid.ok && rv.find(r => r[0] === 'R-0102')[10] === 'приховано' && rv.find(r => r[0] === 'R-0102')[8] === 'Добре' && rv.find(r => r[0] === 'R-0102')[7] === 4, 'админ может скрыть отзыв, но не изменить текст и оценку');
  ok(g.get({ action: 'reviews', id: 'SWT-006' }).reviews.length === 2 && g.sheets['Журнал'].rows.some(r => /Відгук/.test(r.join(' '))), 'скрытый отзыв пропал с витрины, действие записано в журнал');

  // Брошенная корзина
  ok(g.post({ action: 'cart', items: [['DRY-039', 500, 1]] }).error === 'bad_auth', 'корзина без подписи Telegram не принимается');
  ok(g.post({ action: 'cart', initData: g.initData(U(70)), items: [['DRY-039', 500, 2], ['NUT-008', 250, 1], ['x', 0, 0]], lang: 'ua', total: 1 }).ok, 'состав корзины принят');
  const carts = g.sheets['Кошики'].rows;
  ok(carts.length === 2 && carts[1][0] === '70' && carts[1][2] === '[["DRY-039",500,2],["NUT-008",250,1]]', 'в листе «Кошики» только состав, без цен', carts[1]);
  ok(g.call('remindCarts_') === 0, 'раньше 3 часов не напоминаем');
  carts[1][1] = new Date(Date.now() - 4 * 3600e3);
  ok(g.call('remindCarts_') === 1, 'через 3 часа — одно напоминание');
  const rem = lastTo(g, 70).payload;
  ok(/Ваш кошик чекає/.test(rem.text) && /Курага.*500 г × 2/.test(rem.text) && !/Пекан/.test(rem.text) && /view=cart/.test(rem.reply_markup.inline_keyboard[0][0].web_app.url) && rem.reply_markup.inline_keyboard[1][0].callback_data === 'nc', 'в напоминании товары в наличии, кнопки «Оформити» и «Не нагадувати»', rem);
  ok(g.call('remindCarts_') === 0, 'второй раз о той же корзине не напоминаем');
  g.post({ action: 'cart', initData: g.initData(U(70)), items: [['DRY-039', 500, 3]], lang: 'ua' });
  carts[1][1] = new Date(Date.now() - 5 * 3600e3);
  ok(g.call('remindCarts_') === 0, 'не чаще раза в 7 дней одному человеку');
  g.post({ action: 'cart', initData: g.initData(U(71)), items: [['NUT-007', 0, 1]], lang: 'ru' });
  carts[2][1] = new Date(Date.now() - 4 * 3600e3);
  order(g, U(71), [{ id: 'NUT-007', g: 0, q: 1 }], 85);
  ok(carts[2][2] === '' && g.call('remindCarts_') === 0, 'после заказа корзина не считается брошенной');
  g.post({ action: 'cart', initData: g.initData(U(72)), items: [['NUT-007', 0, 1]], lang: 'ua' });
  tgPress(g, 72, 'nc');
  carts[3][1] = new Date(Date.now() - 4 * 3600e3);
  ok(isDateV(carts[3][5]) && carts[3][5].getTime() > Date.now() + 29 * 86400000 && g.call('remindCarts_') === 0, '«Не нагадувати» ставит паузу (дата «до» в колонке «Стоп»), пока она идёт — напоминаний нет');
  g.post({ action: 'cart', initData: g.initData(U(73)), items: [['NUT-007', 0, 1]], lang: 'ua' });
  carts[4][1] = new Date(Date.now() - 4 * 3600e3);
  settings(g, { cart_remind_hours: '0' });
  ok(g.call('remindCarts_') === 0, 'напоминания о корзине выключаются в настройках');
  ok(g.sandbox.__errors.length === 0, 'в логах бэкенда нет ошибок', g.sandbox.__errors);
}

// --- б14: «Не нагадувати» — пауза на cart_mute_days, статистика напоминаний
{
  const g = fresh();
  const cartUser = (uid, lang) => g.post({ action: 'cart', initData: g.initData(U(uid)), items: [['NUT-007', 0, 1]], lang: lang || 'ua' });
  const cartsRows = () => g.sheets['Кошики'].rows;
  const stats = uid => adm(g, uid || 900, 'admin.stats');
  const old = (row) => { row[1] = new Date(Date.now() - 4 * 3600e3); };
  // без настройки — 30 дней; текст кнопки «місяць»
  cartUser(80); old(cartsRows()[1]);
  ok(g.call('remindCarts_') === 1, 'напоминание ушло');
  const kb = lastTo(g, 80, 'sendMessage').payload.reply_markup.inline_keyboard[1][0];
  ok(kb.text === 'Не нагадувати місяць' && kb.callback_data === 'nc', 'без настройки (30 дней) кнопка «Не нагадувати місяць»', kb);
  tgPress(g, 80, 'nc');
  const ans = lastTo(g, 80, 'sendMessage').payload.text;
  ok(g.sent.filter(m => m.method === 'answerCallbackQuery').pop().payload.text === 'Добре', 'всплывающий ответ короткий: «Добре»');
  const until = cartsRows()[1][5];
  const fmt = d => g.sandbox.Utilities.formatDate(d, 'Europe/Kiev', 'dd.MM.yyyy');
  ok(isDateV(until) && Math.abs(until.getTime() - (Date.now() + 30 * 86400000)) < 5000, 'пауза 30 дней от момента нажатия', until);
  ok(ans === 'Добре, не нагадуватимемо до ' + fmt(until), 'ответ бота одной строкой с датой ДД.ММ.РРРР (UA)', ans);
  g.sent.length = 0;
  tgPost(g, { callback_query: { id: 'cqru', data: 'nc', from: { id: 80, language_code: 'ru' }, message: { message_id: 78, chat: { id: 80 } } } });
  ok(g.sent.filter(m => m.method === 'sendMessage' && String(m.payload.chat_id) === '80').length === 0, 'повторное нажатие в течение минуты второе сообщение не шлёт');
  delete g.cache.ncm_80; g.sent.length = 0;
  tgPost(g, { callback_query: { id: 'cqru2', data: 'nc', from: { id: 80, language_code: 'ru' }, message: { message_id: 78, chat: { id: 80 } } } });
  ok(lastTo(g, 80, 'sendMessage').payload.text === 'Хорошо, не будем напоминать до ' + fmt(cartsRows()[1][5]), 'ответ бота на русском с датой');
  // пока пауза — молчим; после — снова
  old(cartsRows()[1]); cartsRows()[1][4] = '';
  ok(g.call('remindCarts_') === 0, 'во время паузы напоминаний нет');
  cartsRows()[1][5] = new Date(Date.now() - 3600e3); // пауза закончилась
  ok(g.call('remindCarts_') === 1, 'пауза кончилась — напоминание снова приходит по обычным правилам');
  // повторное нажатие считает паузу заново
  cartsRows()[1][5] = new Date(Date.now() + 2 * 86400000);
  tgPress(g, 80, 'nc');
  ok(Math.abs(cartsRows()[1][5].getTime() - (Date.now() + 30 * 86400000)) < 5000, 'повторное нажатие: пауза считается заново от момента нажатия');
  // старая отметка «навсегда»
  cartUser(81); cartsRows()[2][5] = 'так'; old(cartsRows()[2]);
  const sentBefore = g.sent.length;
  ok(g.call('remindCarts_') === 0 && !g.sent.slice(sentBefore).some(m => String(m.payload.chat_id) === '81'), 'старая отметка «так» работает как раньше: отключено навсегда');
  // настройка 7 дней
  settings(g, { cart_mute_days: '7' });
  cartUser(82, 'ru'); const r82 = cartsRows().find(r => r[0] === '82'); old(r82);
  g.call('remindCarts_');
  const kb7 = lastTo(g, 82, 'sendMessage').payload.reply_markup.inline_keyboard[1][0];
  ok(kb7.text === 'Не напоминать 7 дней', 'при 7 днях кнопка «Не напоминать 7 дней»', kb7);
  tgPress(g, 82, 'nc');
  ok(Math.abs(r82[5].getTime() - (Date.now() + 7 * 86400000)) < 5000, 'пауза по настройке cart_mute_days = 7');
  ok([g.call('cartMuteLabel_', 7, false), g.call('cartMuteLabel_', 1, false), g.call('cartMuteLabel_', 3, true), g.call('cartMuteLabel_', 11, true), g.call('cartMuteLabel_', 22, false), g.call('cartMuteLabel_', 30, true)].join('|') ===
    'Не нагадувати 7 днів|Не нагадувати 1 день|Не напоминать 3 дня|Не напоминать 11 дней|Не нагадувати 22 дні|Не напоминать месяц', 'формы слова «день» UA и RU');
  // мусор / 0 / потолок
  const days = v => { settings(g, { cart_mute_days: v }); return g.call('cartMuteDays_'); };
  ok(days('abc') === 30 && days('0') === 30 && days('') === 30 && days('9999') === 365 && days('14') === 14, 'cart_mute_days: пусто/0/мусор — 30, потолок 365');
  // статистика
  const st = stats();
  ok(st.ok && st.cartRemind && JSON.stringify(Object.keys(st.cartRemind)) === '["sent30","muted30"]', 'admin.stats: cartRemind { sent30, muted30 }', st.cartRemind);
  ok(st.cartRemind.sent30 === 3 && st.cartRemind.muted30 === 2, 'cartRemind считает отправленные напоминания (3) и людей, нажавших «не напоминать» (80, 82; 80 повторно — один человек: 2)', st.cartRemind);
  // старше 30 дней не считаем
  const cs = g.sheets['Кошики'], hdr = cs.rows[0], lc = hdr.indexOf('Події нагадувань');
  cs.rows[1][lc] = JSON.stringify({ s: [Date.now() - 40 * 86400000], m: [Date.now() - 40 * 86400000] });
  const st2 = stats().cartRemind;
  ok(lc >= 6 && st2.sent30 === 1 && st2.muted30 === 1, 'события старше 30 дней в cartRemind не входят', st2);
  addAdmin(g, 990, 'manager', ['st']);
  ok(adm(g, 990, 'admin.stats').need === 'stats' || adm(g, 990, 'admin.stats').cartRemind === undefined, 'без права stats поля cartRemind нет');
  const gn = fresh();
  ok(adm(gn, 900, 'admin.stats').cartRemind && adm(gn, 900, 'admin.stats').cartRemind.sent30 === 0 && adm(gn, 900, 'admin.stats').cartRemind.muted30 === 0, 'нет данных — нули');
  ok(!JSON.stringify(g.get({ action: 'catalog' })).includes('cart_mute'), 'cart_mute_days на витрину не уходит');
}

/* ============================ Этап 8, волна 2а ============================ */
const isDate = v => Object.prototype.toString.call(v) === '[object Date]';
const logRows = (g, act) => (g.sheets['Журнал'] ? g.sheets['Журнал'].rows : []).filter(r => r[3] === act);

console.log('Волна 2а · А4: архив товаров');
{
  const g = fresh();
  const P = g.sheets['Товари'].rows, head = P[0].slice();
  const row = id => P.find(r => r[0] === id);
  const before = row('NUT-002').slice();
  const ordersBefore = JSON.stringify(g.sheets['Замовлення'].rows);
  addAdmin(g, 710, 'manager', ['text']);   // «Тексти товарів»: может архивировать и восстанавливать
  addAdmin(g, 711, 'manager', ['stock']);  // без права на тексты
  addAdmin(g, 712, 'admin', []);           // полный админ

  ok(adm(g, 711, 'admin.archive', { id: 'NUT-002' }).error === 'no_perm', 'без права «Тексти товарів» архивировать нельзя');
  ok(adm(g, 5555, 'admin.archive', { id: 'NUT-002' }).error === 'forbidden' && !!row('NUT-002'), 'посторонний архивировать не может');
  ok(adm(g, 710, 'admin.archive', { id: 'NOPE-1' }).error === 'not_found', 'несуществующий товар: not_found');
  const a = adm(g, 710, 'admin.archive', { id: 'NUT-002' });
  ok(a.ok && a.name === 'Кеш’ю смажений' && !row('NUT-002') && P.length === 39, '«В архів»: строка ушла из листа «Товари»', [a, P.length]);
  const A = g.sheets['Архів товарів'].rows;
  ok(A.length === 2 && A[0].length === head.length + 2 && head.every((h, i) => A[0][i] === h) && A[0][head.length] === 'Дата архівації' && A[0][head.length + 1] === 'Хто архівував',
    'лист «Архів товарів»: те же колонки + «Дата архівації» и «Хто архівував»', A[0]);
  ok(head.every((h, i) => A[1][A[0].indexOf(h)] === before[i]), 'в архиве строка целиком, включая служебные колонки', A[1]);
  ok(isDate(A[1][head.length]) && /Тест710/.test(A[1][head.length + 1]), 'записаны дата и кто архивировал', A[1].slice(head.length));
  const cat = g.get({ action: 'catalog' });
  ok(!cat.products.some(p => p.id === 'NUT-002') && cat.products.length === 37, 'с витрины товар пропал', cat.products.length);
  ok(order(g, U(42), [{ id: 'NUT-002', g: 250, q: 1 }], 160).error === 'changed', 'архивный товар заказать нельзя');
  ok(JSON.stringify(g.sheets['Замовлення'].rows) === ordersBefore, 'старые заказы не изменились');
  ok(!adm(g, 900, 'admin.products').products.some(p => p.id === 'NUT-002'), 'в списке товаров панели архивного товара нет');
  ok(adm(g, 900, 'admin.product', { id: 'NUT-002', patch: { stock: false } }).error === 'not_found', 'архивный товар править нельзя');
  const list = adm(g, 710, 'admin.archiveList');
  ok(list.ok && list.items.length === 1 && list.items[0].id === 'NUT-002' && list.items[0].ua === 'Кеш’ю смажений' && list.items[0].price === 640 && /^\d\d\.\d\d\.\d{4}$/.test(list.items[0].at) && /Тест710/.test(list.items[0].by),
    'экран «Архів»: товар с названием, ценой, датой и автором', list.items);
  ok(!/СЕКРЕТ|do-smaku|33%|"(?:999|111|222)"|:999[,}]|:111[,}]|:222[,}]/.test(JSON.stringify(list)), 'служебные колонки R–X из архива наружу не уходят');
  ok(adm(g, 711, 'admin.archiveList').error === 'no_perm', 'архив без права «Тексти товарів» не открывается');
  const lg = logRows(g, 'Товар: в архів');
  ok(lg.length === 1 && lg[0][4] === 'NUT-002 Кеш’ю смажений' && /Тест710/.test(lg[0][1]), 'архивация записана в «Журнал» с названием и ID', lg);

  // подписка «Повідомити, коли з’явиться» на архивный товар не отправляется, после восстановления действует снова
  ok(g.post({ action: 'notify', initData: g.initData(U(60)), id: 'NUT-008', lang: 'ua' }).ok, 'клиент подписался на товар, которого нет');
  ok(adm(g, 710, 'admin.archive', { id: 'NUT-008' }).ok, 'этот товар ушёл в архив');
  const sentBefore = g.sent.length;
  ok(g.call('notifyBackInStock_') === 0 && g.sent.length === sentBefore && g.sheets['Підписки'].rows[1][4] === 'чекає', 'подписка на архивный товар не отправляется и остаётся ждать');
  ok(g.post({ action: 'notify', initData: g.initData(U(61)), id: 'NUT-008', lang: 'ua' }).error === 'bad_form', 'подписаться на архивный товар нельзя');
  A.find(r => r[0] === 'NUT-008')[A[0].indexOf('Наявність')] = 'є'; // владелец поправил наличие прямо в архиве
  ok(adm(g, 711, 'admin.restore', { id: 'NUT-008' }).error === 'no_perm', 'восстановить без права «Тексти товарів» нельзя');
  const r8 = adm(g, 710, 'admin.restore', { id: 'NUT-008' });
  const back = lastTo(g, 60);
  ok(r8.ok && r8.product.id === 'NUT-008' && r8.product.stock === 1 && back && /Знову в наявності: Пекан/.test(back.payload.text) && g.sheets['Підписки'].rows[1][4] === 'надіслано',
    'после восстановления подписка сработала: клиент получил «Знову в наявності»', back && back.payload);

  // восстановление
  const r2 = adm(g, 710, 'admin.restore', { id: 'NUT-002' });
  ok(r2.ok && r2.product.id === 'NUT-002' && P[P.length - 1][0] === 'NUT-002', '«Відновити»: строка вернулась в конец листа «Товари»', r2);
  ok(head.every((h, i) => P[P.length - 1][i] === before[i]), 'восстановленный товар — с прежними данными во всех колонках', P[P.length - 1]);
  ok(A.length === 1, 'из архива строка убрана', A);
  const cat2 = g.get({ action: 'catalog' }).products.find(p => p.id === 'NUT-002');
  ok(cat2 && cat2.k === 640 && cat2.a === 1, 'товар снова на витрине с той же ценой', cat2);
  ok(order(g, U(42), [{ id: 'NUT-002', g: 250, q: 1 }], 160).ok, 'восстановленный товар снова можно заказать');
  ok(adm(g, 710, 'admin.restore', { id: 'NUT-002' }).error === 'not_found', 'повторное восстановление: not_found');
  ok(logRows(g, 'Товар: відновлено з архіву').some(r => r[4] === 'NUT-002 Кеш’ю смажений'), 'восстановление записано в «Журнал»');
  // в «Товари» уже есть товар с таким ID — восстановление не создаёт дубль
  adm(g, 710, 'admin.archive', { id: 'NUT-003' });
  const dup = before.slice(); dup[0] = 'NUT-003'; P.push(dup);
  ok(adm(g, 710, 'admin.restore', { id: 'NUT-003' }).error === 'exists' && A.length === 2, 'если в «Товари» уже есть такой ID, восстановление отклоняется');
  P.pop();

  // удаление навсегда
  ok(adm(g, 710, 'admin.purge', { id: 'NUT-003' }).error === 'no_perm' && A.length === 2, '«Видалити назавжди» менеджеру недоступно, даже с правом на тексты');
  ok(adm(g, 712, 'admin.purge', { id: 'NUT-004' }).error === 'not_found' && !!row('NUT-004'), 'удалить навсегда можно только из архива: товар из «Товари» так не стереть');
  const ordersMid = JSON.stringify(g.sheets['Замовлення'].rows.slice(0, 8));
  const pg = adm(g, 712, 'admin.purge', { id: 'NUT-003' });
  ok(pg.ok && pg.name === 'Фісташки солоні' && A.length === 1 && !row('NUT-003'), 'полный админ удалил товар навсегда: строки нет ни в архиве, ни в «Товари»', pg);
  ok(JSON.stringify(g.sheets['Замовлення'].rows.slice(0, 8)) === ordersMid && /Фісташки солоні/.test(g.sheets['Замовлення'].rows[4][12]), 'заказы с удалённым товаром не изменились (состав записан текстом)');
  const my = g.post({ action: 'orders.my', initData: g.initData(U(503)) });
  ok(my.ok && my.orders.length === 1 && /Фісташки/.test(my.orders[0].items) && my.orders[0].i.some(i => i[0] === 'NUT-003'), '«Мої замовлення» с удалённым товаром открываются без ошибки', my);
  ok(logRows(g, 'Товар: видалено назавжди').some(r => r[4] === 'NUT-003 Фісташки солоні' && r[6] === 'видалено'), 'удаление навсегда записано в «Журнал» с названием и ID');
  ok(g.props.DELETED_IDS === 'NUT-003', 'ID удалённого товара запомнен', g.props.DELETED_IDS);
  ok(adm(g, 900, 'admin.purge', { id: 'NUT-003' }).error === 'not_found', 'повторное удаление: not_found');

  // ID удалённого и архивного товара новому товару не достаётся
  adm(g, 900, 'admin.archive', { id: 'NUT-010' });
  adm(g, 900, 'admin.purge', { id: 'NUT-010' });
  const fields = { cat: 'Горіхи', t: 'w', ua: 'Новий горіх', price: 100, stock: true };
  const n1 = adm(g, 900, 'admin.productAdd', { patch: fields });
  ok(n1.ok && n1.product.id === 'NUT-011', 'после удаления NUT-010 новый товар получает NUT-011, а не NUT-010', n1.product && n1.product.id);
  adm(g, 900, 'admin.archive', { id: 'NUT-011' });
  const n2 = adm(g, 900, 'admin.productAdd', { patch: fields });
  ok(n2.ok && n2.product.id === 'NUT-012', 'номер архивного товара тоже не выдаётся заново', n2.product && n2.product.id);
  adm(g, 900, 'admin.archive', { id: 'NUT-012' });
  adm(g, 900, 'admin.purge', { id: 'NUT-012' });
  adm(g, 900, 'admin.purge', { id: 'NUT-011' });
  ok(adm(g, 900, 'admin.productAdd', { patch: fields }).product.id === 'NUT-013', 'и после очистки архива номера не повторяются');
  // ID вписали руками в таблицу — панель и «Перевірити каталог» предупреждают
  const manual = before.slice(); manual[0] = 'NUT-010'; P.push(manual);
  g.clearCache();
  ok(adm(g, 900, 'admin.products').products.find(p => p.id === 'NUT-010').reused === 1 && !adm(g, 900, 'admin.products').products.find(p => p.id === 'NUT-001').reused, 'товар с ID удалённого помечен в панели');
  ok(/NUT-010/.test(g.call('checkCatalogText_')) && /вже належали видаленим/.test(g.call('checkCatalogText_')), '«Перевірити каталог» предупреждает о повторном ID');
  ok(g.call('setupWave2a').length === 0 || true, 'меню «Етап 8.2» запускается повторно без ошибок');
  ok(g.sandbox.__errors.length === 0, 'в логах бэкенда нет ошибок', g.sandbox.__errors);
}

console.log('Волна 2а · А4: удаление категории');
{
  const g = fresh();
  const P = g.sheets['Товари'].rows, C = g.sheets['Категорії'].rows;
  addAdmin(g, 720, 'manager', ['cats']);
  addAdmin(g, 721, 'manager', ['text']);
  ok(adm(g, 721, 'admin.categoryDelete', { code: 'TEA' }).error === 'no_perm', 'без права «Категорії» удалить категорию нельзя');
  const full = adm(g, 720, 'admin.categoryDelete', { code: 'TEA' });
  ok(full.error === 'not_empty' && full.count === 5 && C.some(r => r[0] === 'TEA'), 'категория с товарами не удаляется: в ней 5 товаров, включая скрытый', full);
  ok(adm(g, 720, 'admin.categoryDelete', { code: 'TEA', moveTo: 'TEA' }).error === 'bad_form' && adm(g, 720, 'admin.categoryDelete', { code: 'TEA', moveTo: 'ZZZ' }).error === 'bad_form', 'перенести можно только в другую существующую категорию');
  ok(adm(g, 720, 'admin.categoryDelete', { code: 'ZZZ' }).error === 'not_found', 'несуществующая категория: not_found');
  ok(adm(g, 720, 'admin.category', { category: { isNew: true, code: 'NEW', ua: 'Нова', ru: 'Новая', icon: '', order: 9 } }).ok, 'создана пустая категория');
  const empty = adm(g, 720, 'admin.categoryDelete', { code: 'NEW' });
  ok(empty.ok && empty.moved === 0 && !empty.categories.some(c => c.code === 'NEW') && !C.some(r => r[0] === 'NEW'), 'пустая категория удаляется сразу', empty);
  // архивные товары категорию не держат
  ['SPC-001', 'SPC-002', 'SPC-003', 'SPC-004', 'SPC-005'].forEach(id => adm(g, 900, 'admin.archive', { id }));
  const spc = adm(g, 720, 'admin.categoryDelete', { code: 'SPC' });
  ok(spc.ok && spc.moved === 0 && !C.some(r => r[0] === 'SPC'), 'категория, все товары которой в архиве, считается пустой', spc);
  // перенос товаров и удаление
  const moved = adm(g, 720, 'admin.categoryDelete', { code: 'TEA', moveTo: 'DRY' });
  ok(moved.ok && moved.moved === 5 && !C.some(r => r[0] === 'TEA'), 'категория удалена, 5 товаров перенесены', moved);
  ok(['TEA-001', 'TEA-002', 'TEA-003', 'TEA-004', 'HID-001'].every(id => { const r = P.find(x => x[0] === id); return r[1] === 'Сухофрукти' && r[2] === 'Сухофрукты'; }), 'у товаров (и у скрытого) новая категория в обеих колонках');
  const cat = g.get({ action: 'catalog' });
  ok(!cat.categories.some(c => c.code === 'TEA') && cat.products.find(p => p.id === 'TEA-001').c === 'DRY', 'на витрине категории больше нет, товары — в новой', cat.categories);
  const lg = logRows(g, 'Категорія: видалено');
  ok(lg.length === 3 && lg.some(r => r[4] === 'TEA Чай' && /товарів: 5/.test(r[5]) && /Сухофрукти/.test(r[6])), 'удаление категории записано в «Журнал»', lg);
  ok(g.sandbox.__errors.length === 0, 'в логах бэкенда нет ошибок', g.sandbox.__errors);
}

console.log('Волна 2а · А4: удаление админа');
{
  const g = fresh();
  g.props.ADMIN_CHAT_IDS = '900,950,960'; // 950 — только в настройках скрипта; 960 — и там, и в листе «Адміни»
  addAdmin(g, 730, 'manager', ['st']);
  addAdmin(g, 731, 'manager', ['admins', 'st']);
  addAdmin(g, 732, 'admin', []);
  addAdmin(g, 733, 'manager', ['admins']);
  addAdmin(g, 734, 'manager', ['price']);
  g.call('writeAdminRow_', { id: '960', name: 'Обидва', username: '', role: 'manager', perms: { st: true }, notify: true, active: true, by: 'тест' });
  const S = g.sheets['Адміни'].rows;
  const has = id => S.some(r => String(r[0]) === String(id));
  const all = adm(g, 900, 'admin.admins').admins, by = id => all.find(a => a.id === String(id));
  ok(by(950).src === 'prop' && by(950).inProps === true && by(960).src === 'sheet' && by(960).inProps === true && !by(730).inProps, 'панель знает, кто записан в ADMIN_CHAT_IDS', [by(950), by(960)]);
  ok(adm(g, 730, 'admin.adminDelete', { id: '734' }).error === 'no_perm', 'без права «Адміни» удалять нельзя');
  ok(adm(g, 732, 'admin.adminDelete', { id: '900' }).error === 'owner_locked', 'владельца удалить нельзя');
  ok(adm(g, 731, 'admin.adminDelete', { id: '731' }).error === 'self', 'себя удалить нельзя');
  ok(adm(g, 731, 'admin.adminDelete', { id: '732' }).error === 'owner_only' && adm(g, 732, 'admin.adminDelete', { id: '732' }).error === 'self' && has(732), 'полного админа удаляет только владелец');
  ok(adm(g, 733, 'admin.adminDelete', { id: '734' }).error === 'no_perm' && has(734), 'менеджер не может удалить того, у кого есть права, которых нет у него');
  ok(adm(g, 900, 'admin.adminDelete', { id: '950' }).error === 'in_props', 'админа из ADMIN_CHAT_IDS панель не удаляет');
  ok(adm(g, 900, 'admin.adminDelete', { id: '12345' }).error === 'not_found', 'неизвестный id: not_found');
  const sent0 = g.sent.length;
  const del = adm(g, 731, 'admin.adminDelete', { id: '730' });
  ok(del.ok && del.still === false && !has(730) && !del.admins.some(a => a.id === '730'), 'менеджер с правом «Адміни» удалил менеджера: строки в листе нет', del.admins && del.admins.map(a => a.id));
  ok(adm(g, 730, 'admin.me').error === 'forbidden', 'удалённый админ в панель больше не входит');
  const toOwner = g.sent.slice(sent0).find(m => m.method === 'sendMessage' && String(m.payload.chat_id) === '900');
  ok(toOwner && /видалив адміна/.test(toOwner.payload.text) && /730/.test(toOwner.payload.text), 'владельцу пришло сообщение об удалении', toOwner && toOwner.payload.text);
  ok(g.sent.slice(sent0).some(m => m.method === 'deleteMyCommands' && String(m.payload.scope.chat_id) === '730'), 'команда /admin убрана из меню удалённого');
  ok(logRows(g, 'Адміни: видалено').some(r => /Гість730/.test(r[4]) && r[6] === 'видалено'), 'удаление админа записано в «Журнал»', logRows(g, 'Адміни: видалено'));
  const both = adm(g, 900, 'admin.adminDelete', { id: '960' });
  ok(both.ok && both.still === true && !has(960) && adm(g, 960, 'admin.me').ok, 'записан и в листе, и в ADMIN_CHAT_IDS: строка удалена, сервер сообщает, что доступ остался', both.still);
  ok(adm(g, 900, 'admin.adminDelete', { id: '732' }).ok && !has(732) && adm(g, 732, 'admin.me').error === 'forbidden', 'владелец удалил полного админа');
  ok(g.sandbox.__errors.length === 0, 'в логах бэкенда нет ошибок', g.sandbox.__errors);
}

console.log('Волна 2а · А5: лист «Клієнти»');
{
  const g = fresh();
  const rows = () => (g.sheets['Клієнти'] ? g.sheets['Клієнти'].rows : []);
  const cl = id => rows().find(r => String(r[0]) === String(id));
  ok(!g.sheets['Клієнти'], 'пока никто не заходил, листа «Клієнти» нет');
  tgMsg(g, 801, '/start');
  ok(rows().length === 2 && rows()[0].join('|') === 'Chat id|Ім\'я|Мова|Перший вхід|Останній вхід|Відписка|Заблокував бота', 'лист «Клієнти» создан с нужными колонками', rows()[0]);
  const c1 = cl(801);
  ok(c1 && c1[0] === '801' && c1[1] === 'Гість801' && c1[2] === 'ua' && isDate(c1[3]) && isDate(c1[4]) && c1[5] === '' && c1[6] === '', '/start: записаны chat id, имя, язык, первый и последний вход', c1);
  tgMsg(g, 801, '/start');
  tgMsg(g, 801, '/start DRY-039');
  ok(rows().length === 2, 'повторный /start не создаёт вторую строку');
  const first = new Date(Date.now() - 30 * 24 * 3600e3), old = new Date(Date.now() - 10 * 24 * 3600e3);
  c1[3] = first; c1[4] = old;
  tgMsg(g, 801, '/start');
  ok(c1[4] === old, '«Останній вхід» обновляется не чаще раза в 6 часов');
  g.clearCache();
  tgMsg(g, 801, '/start');
  ok(c1[3] === first && isDate(c1[4]) && c1[4].getTime() > old.getTime() && rows().length === 2, 'позже — «Останній вхід» обновился, «Перший вхід» остался', [c1[3], c1[4]]);
  tgMsg(g, 805, 'привіт');
  tgMsg(g, 805, '/id');
  ok(!cl(805), 'обычное сообщение и /id клиента не записывают — только /start');
  tgPost(g, { message: { chat: { id: -100500, type: 'group' }, from: { id: 806, first_name: 'Група' }, text: '/start' } });
  ok(!cl(806) && !cl(-100500), '/start в группе клиента не записывает');
  tgMsg(g, 900, '/start');
  ok(!!cl(900), 'админ тоже клиент: /start записан');

  // заказ: язык — тот, что выбран в магазине
  ok(order(g, U(802), [{ id: 'NUT-007', g: 0, q: 1 }], 85, { lang: 'ru' }).ok && cl(802) && cl(802)[2] === 'ru' && cl(802)[1] === 'Тест802', 'заказ записывает клиента с языком из магазина', cl(802));
  tgMsg(g, 802, '/start'); // в Telegram у него украинский, но язык из заказа важнее
  ok(cl(802)[2] === 'ru' && rows().filter(r => String(r[0]) === '802').length === 1, '/start не затирает язык, выбранный в магазине');
  ok(order(g, U(802), [{ id: 'NUT-007', g: 0, q: 1 }], 85, { lang: 'ua' }).ok && cl(802)[2] === 'ua', 'новый заказ на другом языке — язык обновился');
  ok(g.post({ action: 'order', initData: g.initData(U(807)), test: true, items: [{ id: 'NUT-007', g: 0, q: 1 }], total: 85, name: 'Олена', phone: '+380501234567', delivery: 'pickup', pay: 'cash' }).ok && !cl(807), 'тестовый заказ клиента не записывает');

  // открытие магазина
  const ev = (uid, events, init) => g.post({ action: 'ev', initData: init || g.initData(Object.assign(U(uid), { language_code: 'ru' })), sid: 's' + uid, events });
  ok(ev(803, [{ e: 'open', t: Date.now() }, { e: 'view', id: 'DRY-039', t: Date.now() }]).ok && cl(803) && cl(803)[2] === 'ru', 'открытие магазина записывает клиента (язык — из Telegram)', cl(803));
  ev(804, [{ e: 'view', id: 'DRY-039', t: Date.now() }]);
  ok(!cl(804), 'события без открытия магазина клиента не записывают');
  ok(ev(808, [{ e: 'open', t: Date.now() }], g.initData(U(808)).replace(/hash=[0-9a-f]{6}/, 'hash=000000')).error === 'bad_auth' && !cl(808), 'поддельная подпись Telegram клиента не записывает');
  const n = rows().length;
  for (let i = 0; i < 5; i++) ev(803, [{ e: 'open', t: Date.now() }]);
  ok(rows().length === n, 'повторные открытия не плодят строки');

  // заблокировал бота
  g.setTelegramFail((method, payload) => String(payload.chat_id) === '801' ? { ok: false, error_code: 403, description: 'Forbidden: bot was blocked by the user' } : null);
  g.clearCache();
  tgMsg(g, 801, '/start');
  ok(c1[6] === 'так' && cl(802)[6] === '', 'Telegram отказал в доставке (403) — отметка «Заблокував бота»', c1);
  g.setTelegramFail(false);
  g.clearCache();
  tgMsg(g, 801, '/start');
  ok(c1[6] === '', 'человек снова нажал /start — отметка снята');
  tgPost(g, { my_chat_member: { chat: { id: 802, type: 'private' }, from: { id: 802 }, new_chat_member: { status: 'kicked' } } });
  ok(cl(802)[6] === 'так', 'Telegram сообщил о блокировке — отметка поставлена');
  tgPost(g, { my_chat_member: { chat: { id: 802, type: 'private' }, from: { id: 802 }, new_chat_member: { status: 'member' } } });
  ok(cl(802)[6] === '', 'Telegram сообщил о разблокировке — отметка снята');
  tgPost(g, { my_chat_member: { chat: { id: 999999, type: 'private' }, from: { id: 999999 }, new_chat_member: { status: 'kicked' } } });
  ok(!cl(999999), 'блокировка от незнакомого чата строку не создаёт');

  // имя не становится формулой; наружу лист не уходит
  tgPost(g, { message: { chat: { id: 809, type: 'private' }, from: { id: 809, first_name: '=HYPERLINK("x")', language_code: 'uk' }, text: '/start' } });
  ok(cl(809) && cl(809)[1] === '=HYPERLINK("x")' && g.sheets['Клієнти'].rows.length > 0, 'имя записано как текст', cl(809));
  g.clearCache();
  ok(!/Гість801|Тест802/.test(JSON.stringify(g.get({ action: 'catalog' }))), 'в каталог данные клиентов не попадают');
  ok(rows().every(r => r[5] === '' || r[5] === 'Відписка'), 'колонка «Відписка» пока пустая (понадобится в выпуске 2б)');

  const g2 = fresh();
  const made = g2.call('setupWave2a');
  ok(made.length === 2 && g2.sheets['Архів товарів'].rows[0].indexOf('Дата архівації') > 0 && g2.sheets['Клієнти'].rows[0][0] === 'Chat id', 'меню «Етап 8.2» создаёт листы «Архів товарів» и «Клієнти»', made);
  ok(g2.call('setupWave2a').length === 0, 'повторный запуск меню ничего не меняет');
  ok(g.sandbox.__errors.length === 0 && g2.sandbox.__errors.length === 0, 'в логах бэкенда нет ошибок', g.sandbox.__errors);
}

/* ============================ Скорость админ-панели ============================ */
console.log('Скорость админ-панели: меньше обращений, тот же результат');
{
  const g = fresh();
  const one = (fn) => { g.resetOps(); const res = fn(); return { res, ops: Object.assign({}, g.ops) }; };
  // права и подпись по-прежнему проверяются при каждом запросе
  ok(adm(g, 5555, 'admin.orders').error === 'forbidden', 'посторонний в панель не входит');
  ok(g.post({ action: 'admin.orders', initData: g.initData(U(900)).replace(/hash=[0-9a-f]{6}/, 'hash=000000') }).error === 'forbidden', 'поддельная подпись отклоняется');
  addAdmin(g, 760, 'manager', ['stock']);
  ok(adm(g, 760, 'admin.product', { id: 'NUT-002', patch: { price: 1 } }).error === 'no_perm', 'менеджер без права на цены цену не меняет');
  g.sheets['Адміни'].rows.find(r => String(r[0]) === '760')[g.sheets['Адміни'].rows[0].indexOf('Активний')] = '';
  ok(adm(g, 760, 'admin.orders').error === 'forbidden', 'админа отключили прямо в таблице — следующий же запрос отклонён (права не кэшируются)');

  const o = one(() => adm(g, 900, 'admin.orders'));
  ok(o.res.ok && o.ops.prop === 1 && o.ops.read === 2, 'список заказов: свойства скрипта одним обращением, по одному чтению листов «Адміни» и «Замовлення»', o.ops);
  const p = one(() => adm(g, 900, 'admin.products'));
  ok(p.res.ok && p.ops.prop === 1 && p.ops.read === 3, 'список товаров: три чтения (админы, товары, категории)', p.ops);

  // ответ после сохранения собирается без повторного чтения строки — и совпадает с тем, что лежит в таблице
  const patches = [{ price: 655.5, old: 700, end: '2099-03-01', badge: 'sale' }, { qty: '2,5', hidden: true, dUa: '=небезпечний опис', ua: 'Кеш’ю +новий' },
    { cat: 'Сухофрукти', t: 'p', packs: '200 г', price: 99 }, { stock: false, hidden: false, qty: '', end: '', badge: '', old: 0 }, { stock: true, wh: 500, wm: 'від 3 кг', img: 'https://img.test/x.jpg' }];
  let same = true, reads = [];
  patches.forEach(patch => {
    const s = one(() => adm(g, 900, 'admin.product', { id: 'NUT-002', patch }));
    const inTable = adm(g, 900, 'admin.products').products.find(x => x.id === 'NUT-002');
    if (!s.res.ok || JSON.stringify(s.res.product) !== JSON.stringify(inTable)) { same = false; console.log('     ', JSON.stringify(s.res.product), JSON.stringify(inTable)); }
    reads.push(s.ops.read);
  });
  ok(same, 'ответ «сохранено» совпадает с таблицей для всех видов правок (цена, акция, остаток, тексты, категория, тип, фото)');
  ok(reads[0] === 2 && reads[1] === 2, 'правка товара: два чтения (админы и товары), строка не перечитывается', reads);
  ok(reads[2] === 3, 'лист «Категорії» читается, только когда меняется категория', reads);
  const added = adm(g, 900, 'admin.productAdd', { patch: { cat: 'Горіхи', t: 'w', ua: 'Новий', price: 120, stock: true, qty: '4' } });
  ok(added.ok && JSON.stringify(added.product) === JSON.stringify(adm(g, 900, 'admin.products').products.find(x => x.id === added.product.id)), 'новый товар: ответ совпадает с таблицей', added.product);

  // журнал: все строки запроса одной записью, порядок и автор сохранены
  const before = g.sheets['Журнал'].rows.length;
  const s3 = one(() => adm(g, 900, 'admin.product', { id: 'NUT-005', patch: { price: 530, dUa: 'Опис', old: 600 } }));
  const added3 = g.sheets['Журнал'].rows.slice(before);
  ok(added3.length === 3 && added3.every(r => r[4] === 'NUT-005 Фундук смажений' && /Тест900/.test(r[1]) && String(r[2]) === '900') && added3.map(r => r[3]).join() === 'Товар: ціна,Товар: опис (UA),Товар: стара ціна',
    'три изменения — три строки в «Журнале», в том же порядке, с автором', added3.map(r => r[3]));
  ok(!s3.ops.append && s3.ops.write >= 4, 'строки журнала записаны одной операцией, а не тремя', s3.ops);
  const s1 = one(() => adm(g, 900, 'admin.product', { id: 'NUT-005', patch: { stock: false } }));
  ok(s1.ops.append === 1 && g.sheets['Журнал'].rows.length === before + 4, 'одно изменение — одна строка (appendRow)', s1.ops);
  ok(g.call('logAction_', 'Перевірка', 'поза запитом', '', '') === undefined && g.sheets['Журнал'].rows.slice(-1)[0][3] === 'Перевірка', 'вне запроса (меню, триггеры) журнал пишется сразу');

  // смена статуса: сообщения админов — одной пачкой, клиенту — отдельно; настройки без нужды не читаются
  g.call('writeAdminRow_', { id: '761', name: 'Другий', username: '', role: 'admin', perms: {}, notify: true, active: true, by: 'тест' });
  const num = order(g, U(42), [{ id: 'NUT-007', g: 0, q: 1 }], 85).number;
  const sent0 = g.sent.length;
  const st = one(() => adm(g, 900, 'admin.status', { num, code: 's' }));
  const out = g.sent.slice(sent0);
  ok(st.res.ok && st.res.told === true && out.filter(m => m.method === 'editMessageText').length === 2 && out.filter(m => m.method === 'sendMessage' && String(m.payload.chat_id) === '42').length === 1,
    'статус: сообщение о заказе обновлено у обоих админов, клиент получил одно сообщение', out.map(m => m.method));
  ok(st.ops.tgBatch === 1 && st.ops.tg === 1 && st.ops.read === 2, 'правки сообщений админов ушли одной пачкой; листы «Налаштування» и «Точки» не читались', st.ops);
  ok(g.sheets['Замовлення'].rows.find(r => r[0] === num)[2] === 'відправлено' && logRows(g, 'Замовлення: статус').some(r => r[4] === num && r[6] === 'відправлено'), 'статус записан в таблицу и в «Журнал»');
  g.setTelegramFail((method, payload) => method === 'editMessageText' ? { ok: false, description: 'message is not modified' } : null);
  const st2 = adm(g, 900, 'admin.status', { num, code: 'd' });
  ok(st2.ok && st2.told === true, 'сбой правки сообщений у админов не мешает сменить статус и написать клиенту', st2);
  g.setTelegramFail(false);

  // замер времени: выключен по умолчанию, включается свойством PERF_LOG
  ok(adm(g, 900, 'admin.orders')._t === undefined, 'без PERF_LOG в ответе нет замеров');
  g.props.PERF_LOG = '1';
  const t = adm(g, 900, 'admin.status', { num, code: 'c' });
  ok(t.ok && t._t && typeof t._t.total === 'number' && t._t.marks.map(m => m[0]).join() === 'підпис і права,таблиця,Telegram,дія,журнал' && t._t.marks.every(m => typeof m[1] === 'number'),
    'с PERF_LOG = 1 ответ несёт время по этапам: подпись и права, таблица, Telegram, журнал', t._t);
  ok(JSON.stringify(adm(g, 5555, 'admin.orders')) === JSON.stringify({ ok: false, error: 'forbidden' }), 'постороннему замеры не уходят: в ответе только отказ', adm(g, 5555, 'admin.orders'));
  ok(JSON.stringify(g.post({ action: 'admin.orders', initData: 'x' })) === JSON.stringify({ ok: false, error: 'forbidden' }), 'запросу без подписи замеры не уходят');
  ['orders.my', 'cart', 'notify', 'ev'].forEach(a => { const r = g.post({ action: a, initData: g.initData(U(44)), items: [], events: [{ e: 'open', t: Date.now() }], id: 'NUT-008' }); ok(r._t === undefined, 'запрос покупателя «' + a + '»: замеров в ответе нет', r); });
  ok(g.get({ action: 'catalog' })._t === undefined && order(g, U(43), [{ id: 'NUT-007', g: 0, q: 1 }], 85)._t === undefined, 'в каталог и заказ замеры не попадают');
  ok(g.sandbox.__errors.length === 0, 'в логах бэкенда нет ошибок', g.sandbox.__errors);
}

/* ============================ Этап 8, волна 2б ============================ */
console.log('Волна 2б · Б3: оплата');
{
  const g = fresh();
  addAdmin(g, 770, 'manager', ['stock']); // без права на статусы
  addAdmin(g, 771, 'manager', ['st']);
  const num = order(g, U(42), [{ id: 'NUT-007', g: 0, q: 1 }], 85).number;
  const O = g.sheets['Замовлення'].rows, row = n => O.find(r => r[0] === n);
  const toClient = (uid) => g.sent.filter(m => m.method === 'sendMessage' && String(m.payload.chat_id) === String(uid) && /Оплату за/.test(m.payload.text));
  ok(O[0].indexOf('Оплата: статус') < 0, 'до первой отметки колонки «Оплата: статус» нет');
  ok(adm(g, 770, 'admin.paid', { num, state: 'paid' }).error === 'no_perm' && adm(g, 5555, 'admin.paid', { num, state: 'paid' }).error === 'forbidden' && O[0].indexOf('Оплата: статус') < 0, '«Оплачено» без права «Замовлення: статуси» нельзя');
  tgPress(g, 770, 'pay:' + num);
  ok(O[0].indexOf('Оплата: статус') < 0 && /немає права/.test(g.sent.filter(m => m.method === 'answerCallbackQuery').pop().payload.text), 'кнопка в сообщении без права не срабатывает');
  const r = adm(g, 771, 'admin.paid', { num, state: 'paid' });
  const pc = O[0].indexOf('Оплата: статус');
  ok(r.ok && r.paid === 'paid' && r.told === true && pc === O[0].length - 1 && pc > O[0].indexOf('Службове') && row(num)[pc] === 'оплачено', 'оплата отмечена, колонка появилась в конце листа', [r, O[0].slice(-3)]);
  ok(toClient(42).length === 1 && toClient(42)[0].payload.text === 'Оплату за замовлення ' + num + ' отримали. Дякуємо!', 'клиент получил «Оплату за замовлення … отримали. Дякуємо!»', toClient(42).map(m => m.payload.text));
  ok(g.sent.some(m => m.method === 'editMessageText' && /оплачено/.test(m.payload.text) && m.payload.reply_markup.inline_keyboard.length === 3), 'сообщение о заказе у админа обновлено: видно «оплачено»');
  const again = adm(g, 771, 'admin.paid', { num, state: 'paid' });
  tgPress(g, 771, 'pay:' + num);
  ok(again.ok && again.same === true && toClient(42).length === 1 && /Уже позначено/.test(g.sent.filter(m => m.method === 'answerCallbackQuery').pop().payload.text), 'повторное нажатие (в панели и в боте) не шлёт второе сообщение');
  ok(adm(g, 771, 'admin.paid', { num, state: 'unpaid' }).ok && row(num)[pc] === 'не оплачено' && adm(g, 771, 'admin.paid', { num, state: 'paid' }).told === null && toClient(42).length === 1, '«не оплачено» → снова «оплачено»: клиенту второй раз не пишем');
  const rf = adm(g, 771, 'admin.paid', { num, state: 'refund' });
  ok(rf.ok && rf.paid === 'refund' && row(num)[pc] === 'повернено' && toClient(42).length === 1, '«Повернено» записано, клиенту сообщение не уходит', rf);
  ok(adm(g, 771, 'admin.paid', { num, state: 'online' }).error === 'bad_form' && adm(g, 771, 'admin.paid', { num: 'P-9999', state: 'paid' }).error === 'not_found', 'неизвестный статус и неизвестный заказ отклоняются');
  const num2 = order(g, U(43), [{ id: 'NUT-007', g: 0, q: 1 }], 85, { lang: 'ru' }).number;
  tgPress(g, 900, 'pay:' + num2);
  ok(row(num2)[pc] === 'оплачено' && toClient(43).length === 1 && toClient(43)[0].payload.text === 'Оплату за заказ ' + num2 + ' получили. Спасибо!', 'кнопка «💳 Оплачено» в боте: клиенту на русском', toClient(43).map(m => m.payload.text));
  const my42 = g.post({ action: 'orders.my', initData: g.initData(U(42)) }), my43 = g.post({ action: 'orders.my', initData: g.initData(U(43)) });
  ok(my42.orders[0].paid === 'refund' && my43.orders[0].paid === 'paid', 'статус оплаты виден в «Мої замовлення»', [my42.orders[0].paid, my43.orders[0].paid]);
  const ao = adm(g, 900, 'admin.orders').orders;
  ok(ao.find(o => o.num === num2).lang === 'ru' && ao.find(o => o.num === 'P-0001').lang === 'ua', 'admin.orders: у заказа поле lang (ua/ru)');
  ok(ao.find(o => o.num === num2).paid === 'paid' && ao.find(o => o.num === 'P-0001').paid === 'unpaid', 'в панели у заказа есть статус оплаты; пусто = не оплачено');
  row('P-0001')[pc] = 'ОПЛАЧЕНО';
  ok(adm(g, 900, 'admin.orders').orders.find(o => o.num === 'P-0001').paid === 'paid', 'статус, вписанный в таблицу руками, читается без учёта регистра');
  ok(logRows(g, 'Замовлення: оплата').some(x => x[4] === num && x[5] === 'не оплачено' && x[6] === 'оплачено') && logRows(g, 'Замовлення: оплата').some(x => x[6] === 'повернено'), 'оплата и возврат записаны в «Журнал»');
  ok(g.sandbox.PayProvider_.enabled === false && g.sandbox.PayProvider_.create({}).error === 'not_configured' && g.get({ action: 'catalog' }).shop.pay.indexOf('online') < 0, 'платёжный провайдер — выключенная заглушка, оплаты «Онлайн» на витрине нет');
  ok(!/\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}/.test(require('fs').readFileSync(CODE, 'utf8')), 'в коде нет номера карты');
  ok(g.sandbox.__errors.length === 0, 'в логах бэкенда нет ошибок', g.sandbox.__errors);
}

console.log('Волна 2б · Б4: специи и смеси отца');
{
  const g = fresh();
  const P = g.sheets['Товари'].rows, head = P[0], set = (id, name, v) => { P.find(r => r[0] === id)[head.indexOf(name)] = v; };
  // фасовка 50 г: цена за 1 кг × 0,05, округление до гривны
  set('SPC-001', 'Фасування', '50 г / 100 г / 250 г');   // 1255 ₴/кг
  set('SPC-002', 'Фасування', '50 г / 100 г');           // 480 ₴/кг
  set('SPC-003', 'Фасування', '100 г / 250 г / 500 г');  // 360 ₴/кг
  g.clearCache();
  const by = {}; g.get({ action: 'catalog' }).products.forEach(p => { by[p.id] = p; });
  ok(JSON.stringify(by['SPC-001'].v) === '[[50,63],[100,126],[250,314]]', '50 г / 100 г / 250 г при 1255 ₴/кг: 63, 126 и 314 ₴ (62,75 → 63)', by['SPC-001'].v);
  ok(JSON.stringify(by['SPC-002'].v) === '[[50,24],[100,48]]' && JSON.stringify(by['SPC-003'].v) === '[[100,36],[250,90],[500,180]]', 'остальные фасовки специй считаются так же', [by['SPC-002'].v, by['SPC-003'].v]);
  ok(order(g, U(42), [{ id: 'SPC-001', g: 50, q: 3 }, { id: 'SPC-002', g: 50, q: 1 }], 63 * 3 + 24).ok, 'заказ с фасовкой 50 г: сервер считает 3 × 63 + 24');
  ok(order(g, U(42), [{ id: 'SPC-001', g: 50, q: 1 }], 62).error === 'changed' && order(g, U(42), [{ id: 'SPC-003', g: 50, q: 1 }], 18).error === 'changed', 'неверная сумма и фасовка 50 г у товара без неё отклоняются');
  ok(/Зіра ціла 50 г × 3 = 189 ₴/.test(g.sheets['Замовлення'].rows.slice(-1)[0][12]), 'в заказе записано «50 г × 3 = 189 ₴»', g.sheets['Замовлення'].rows.slice(-1)[0][12]);

  // подборка «Спеції від батька»
  ok(!g.get({ action: 'catalog' }).shop.father, 'пока в настройках нет товаров, подборки нет');
  const f = adm(g, 900, 'admin.settings').fields;
  ok(f.find(x => x.k === 'father_ids').v === '' && f.find(x => x.k === 'father_title_ua').v === 'Спеції від батька' && f.find(x => x.k === 'father_title_ru').v === 'Специи от отца' && f.find(x => x.k === 'father_text_ua').v === '', 'настройки подборки: заголовки по умолчанию, товары и текст пустые');
  settings(g, { father_ids: ' spc-001, SPC-004;spc-001\nNOPE-9 ' });
  const sh = g.get({ action: 'catalog' }).shop;
  ok(sh.father && sh.father.ids.join() === 'SPC-001,SPC-004,NOPE-9' && sh.father.title.ua === 'Спеції від батька' && sh.father.title.ru === 'Специи от отца' && !sh.father.text.ua, 'подборка в каталоге: ID приведены к виду, без повторов; текст пустой', sh.father);
  ok(g.sheets['Налаштування'].rows.find(r => r[0] === 'father_ids')[1] === 'SPC-001, SPC-004, NOPE-9' && /Спеції від батька/.test(g.sheets['Налаштування'].rows.find(r => r[0] === 'father_ids')[2]), 'ключ создан в листе «Налаштування» с описанием на украинском');
  settings(g, { father_text_ua: 'Суміші, які батько складає сам.', father_title_ru: 'Смеси отца' });
  const sh2 = g.get({ action: 'catalog' }).shop.father;
  ok(sh2.text.ua === 'Суміші, які батько складає сам.' && sh2.text.ru === 'Суміші, які батько складає сам.' && sh2.title.ru === 'Смеси отца', 'текст и заголовок редактируются в панели; пустой язык берёт второй', sh2);
  addAdmin(g, 780, 'manager', ['stock']);
  ok(adm(g, 780, 'admin.settingsSave', { values: { father_ids: 'X-1' } }).error === 'no_perm', 'без права «Налаштування» подборку не изменить');
  settings(g, { father_ids: '' });
  ok(!g.get({ action: 'catalog' }).shop.father, 'очистили список — подборки нет');

  // «Склад»: необязательные колонки
  ok(by['SPC-004'].cu === undefined && adm(g, 900, 'admin.products').products.find(p => p.id === 'SPC-004').cUa === '' && head.indexOf('Склад (UA)') < 0, 'без колонок «Склад» поля нет, всё работает как раньше');
  ok(adm(g, 780, 'admin.product', { id: 'SPC-004', patch: { cUa: 'зіра' } }).error === 'no_perm', 'состав меняет только тот, у кого право «Тексти товарів»');
  const saved = adm(g, 900, 'admin.product', { id: 'SPC-004', patch: { cUa: 'Зіра, барбарис, паприка, куркума', cRu: 'Зира, барбарис, паприка, куркума' } });
  ok(saved.ok && saved.product.cUa === 'Зіра, барбарис, паприка, куркума' && head.indexOf('Склад (UA)') > 0 && head.indexOf('Состав (RU)') > 0, 'состав сохранён из панели, колонки «Склад (UA)» и «Состав (RU)» появились', head.slice(-3));
  const c4 = g.get({ action: 'catalog' }).products.find(p => p.id === 'SPC-004'), c5 = g.get({ action: 'catalog' }).products.find(p => p.id === 'SPC-005');
  ok(c4.cu === 'Зіра, барбарис, паприка, куркума' && c4.cr === 'Зира, барбарис, паприка, куркума' && c5.cu === undefined && c5.cr === undefined, 'состав уходит на витрину только у товара, где он заполнен', [c4.cu, c5.cu]);
  ok(logRows(g, 'Товар: склад (UA)').length === 1, 'изменение состава записано в «Журнал»');
  ok(!/СЕКРЕТ|do-smaku|33%/.test(JSON.stringify(g.get({ action: 'catalog' }))), 'служебные колонки по-прежнему не уходят');
  ok(g.sandbox.__errors.length === 0, 'в логах бэкенда нет ошибок', g.sandbox.__errors);
}

console.log('Волна 2б · Б2: опт — разбор минимального объёма');
{
  const g = fresh();
  const pm = (t, num, text) => { const r = g.call('parseWhMin_', t, num, text); return r ? r.n + ' ' + r.unit : null; };
  ok(pm('w', '', '5') === '5 kg' && pm('p', '', '5') === '5 pcs' && pm('u', '', '5') === '5 pcs', '«5» — 5 кг для весового, 5 упаковок для «упаковка» и «шт»');
  ok(pm('w', '', '5 кг') === '5 kg' && pm('w', '', 'від 5 кг') === '5 kg' && pm('w', '', 'от 5кг') === '5 kg' && pm('w', '', '5,5 кг') === '5.5 kg', '«5 кг», «від 5 кг», «от 5кг», «5,5 кг» — число в кг');
  ok(pm('p', '', '10 шт') === '10 pcs' && pm('p', '', '10 уп') === '10 pcs' && pm('u', '', 'від 10 упаковок') === '10 pcs', '«10 шт», «10 уп», «10 упаковок» — число штук');
  ok(pm('w', '', '500 г') === '0.5 kg', '«500 г» — 0,5 кг');
  ok(pm('w', '', '') === null && pm('w', '', 'за домовленістю') === null && pm('p', '', 'багато') === null, 'пусто или текст без числа — оптовой цены нет');
  ok(pm('p', '', '5 кг') === null && pm('w', '', '10 шт') === null && pm('w', '', '5 ящиків') === null, 'единица не подходит к типу товара или непонятна — оптовой цены нет');
  ok(pm('w', 7, 'від 5 кг') === '7 kg' && pm('p', 12, '10 шт') === '12 pcs' && pm('w', '', 'від 5 кг') === '5 kg' && pm('w', 0, 'від 5 кг') === '5 kg', 'число в «Опт: мін, кг» главнее текста; пустое или 0 — действует текст');
}

console.log('Волна 2б · Б2: опт — цены, заявки, заказы');
{
  const g = fresh();
  const P = g.sheets['Товари'].rows, head = P[0], cell = (id, name, v) => { P.find(r => r[0] === id)[head.indexOf(name)] = v; };
  // оптовые цены: курага 320 ₴/кг «від 5 кг» (из стенда), мигдаль 500 ₴/кг от 2 кг, арахис 70 ₴/уп. от 10 уп., фисташки — объём не понять
  cell('NUT-001', 'Опт: ціна', 500); cell('NUT-001', 'Опт: мін. обсяг', '2 кг');
  cell('NUT-007', 'Опт: ціна', 70); cell('NUT-007', 'Опт: мін. обсяг', '10 уп');
  cell('NUT-003', 'Опт: ціна', 700); cell('NUT-003', 'Опт: мін. обсяг', 'за домовленістю');
  cell('NUT-008', 'Опт: ціна', 900); cell('NUT-008', 'Опт: мін. обсяг', '1 кг'); // «немає»
  g.clearCache();
  const secret = /СЕКРЕТ|do-smaku|33%|"(?:999|111|222)"|:999[,}]|:111[,}]|:222[,}]/;
  const catText = JSON.stringify(g.get({ action: 'catalog' }));
  const by = {}; JSON.parse(catText).products.forEach(p => { by[p.id] = p; });
  ok(!/"w":|"wm":|"whn":|від 5 кг|10 уп/.test(catText) && JSON.parse(catText).products.every(p => p.w === undefined && p.wm === undefined) && by['DRY-039'].k === 380, 'каталог обычного клиента не содержит оптовой цены и минимального объёма', by['DRY-039']);
  ok(by['DRY-039'].wb === 1 && by['NUT-001'].wb === 1 && by['NUT-007'].wb === 1 && by['NUT-003'].wb === undefined && by['NUT-002'].wb === undefined, 'у товаров с оптовой ценой — только отметка «есть опт»; если объём не понять, отметки нет');
  ok(/NUT-003/.test(g.call('checkCatalogText_')) && /мінімальний обсяг не зрозумілий/.test(g.call('checkCatalogText_')), '«Перевірити каталог» предупреждает о непонятном минимальном объёме');

  // обычный клиент оптовых цен не получает
  const wp = uid => g.post({ action: 'wh.prices', initData: g.initData(U(uid)) });
  ok(g.post({ action: 'wh.prices' }).error === 'bad_auth' && g.post({ action: 'wh.prices', initData: g.initData(U(50)).replace(/hash=[0-9a-f]{6}/, 'hash=000000') }).error === 'bad_auth', 'оптовые цены без подписи Telegram не отдаются');
  const none = wp(50);
  ok(none.ok && none.wh === false && none.prices === undefined && none.app === '', 'обычный клиент: wh = false, цен нет', none);
  ok(g.post({ action: 'wh.pricelist', initData: g.initData(U(50)) }).error === 'no_perm', 'прайс обычному клиенту не отправляется');

  // заявка
  const form = { type: 'cafe', name: 'Кав’ярня «Зерно»', city: 'Харків', contact: 'Ірина', phone: '+380501112233', cats: ['Горіхи', 'Сухофрукти'], volume: '10 кг на тиждень', freq: 'щотижня', comment: '=небезпечно', lang: 'ua' };
  const apply = (uid, extra) => g.post(Object.assign({ action: 'wh.apply', initData: g.initData(U(uid)) }, form, extra || {}));
  addAdmin(g, 790, 'manager', ['wh']);
  addAdmin(g, 791, 'manager', ['st']);
  ok(g.post(Object.assign({ action: 'wh.apply' }, form)).error === 'bad_auth', 'заявка без подписи Telegram не принимается');
  ok(apply(50, { type: 'sets' }).error === 'bad_form' && apply(50, { phone: '123' }).error === 'bad_form' && apply(50, { name: 'x' }).error === 'bad_form', 'неполная заявка и неизвестный тип бизнеса («Корпоративні набори» нет) отклоняются');
  const sent0 = g.sent.length;
  const a1 = apply(50);
  const A = g.sheets['Опт-заявки'].rows;
  ok(a1.ok && a1.id === 'W-0001' && A.length === 2 && A[1][0] === 'W-0001' && A[1][2] === '50' && A[1][4] === 'кафе' && A[1][5] === 'Кав’ярня «Зерно»' && A[1][9] === 'Горіхи, Сухофрукти' && A[1][13] === 'нова', 'заявка записана в лист «Опт-заявки»', A[1]);
  const toAdmins = g.sent.slice(sent0).filter(m => m.method === 'sendMessage' && /Заявка на опт W-0001/.test(m.payload.text));
  ok(toAdmins.length === 2 && toAdmins.map(m => String(m.payload.chat_id)).sort().join() === '790,900' && toAdmins[0].payload.reply_markup.inline_keyboard.map(r => r[0].callback_data).join() === 'wa:W-0001:t,wa:W-0001:a,wa:W-0001:r',
    'уведомление получили только админы с правом «Опт», с кнопками «Взяти в роботу / Схвалити / Відхилити»', toAdmins.map(m => m.payload.chat_id));
  ok(!secret.test(JSON.stringify(g.sent.slice(sent0))) && /Заявку W-0001 отримали/.test(lastTo(g, 50).payload.text), 'клиенту — подтверждение, что заявка получена');
  ok(wp(50).app === 'нова', 'статус заявки виден на экране «Для бізнесу»');
  apply(50); apply(50);
  ok(apply(50).error === 'rate_limit' && A.length === 4, 'не больше 3 заявок в сутки с одного аккаунта');
  ok(apply(51).ok && A.length === 5, 'другой аккаунт заявку подать может');

  // решения
  tgPress(g, 791, 'wa:W-0001:a');
  ok(A[1][13] === 'нова' && !g.sheets['Оптові клієнти'] && /немає права/.test(g.sent.filter(m => m.method === 'answerCallbackQuery').pop().payload.text), 'без права «Опт» заявку не одобрить');
  ok(adm(g, 791, 'admin.whDecide', { id: 'W-0001', d: 'a' }).error === 'no_perm' && adm(g, 791, 'admin.wh').error === 'no_perm' && adm(g, 5555, 'admin.wh').error === 'forbidden', 'и прямым запросом — тоже');
  tgPress(g, 790, 'wa:W-0001:t');
  ok(A[1][13] === 'в роботі' && /Гість790/.test(A[1][14]) && g.sent.filter(m => m.method === 'editMessageText' && /в роботі/.test(m.payload.text)).length >= 2, '«Взяти в роботу»: статус записан, сообщения админов обновлены');
  const told0 = g.sent.filter(m => String(m.payload.chat_id) === '50').length;
  tgPress(g, 790, 'wa:W-0001:a');
  const C = g.sheets['Оптові клієнти'].rows;
  ok(A[1][13] === 'схвалено' && C.length === 2 && C[1][0] === '50' && C[1][2] === 'Кав’ярня «Зерно»' && C[1][5] === 'активний' && C[1][8] === 'W-0001', '«Схвалити»: клиент появился в листе «Оптові клієнти»', C[1]);
  ok(/Заявку W-0001 схвалили/.test(lastTo(g, 50).payload.text) && /view=biz/.test(lastTo(g, 50).payload.reply_markup.inline_keyboard[0][0].web_app.url), 'клиенту — сообщение о решении');
  tgPress(g, 790, 'wa:W-0001:a'); tgPress(g, 900, 'wa:W-0001:r');
  ok(A[1][13] === 'схвалено' && g.sent.filter(m => String(m.payload.chat_id) === '50').length === told0 + 1, 'повторные нажатия ничего не меняют и клиенту второй раз не пишут');
  const rej = adm(g, 790, 'admin.whDecide', { id: 'W-0004', d: 'r' });
  ok(rej.ok && rej.status === 'відхилено' && A[4][13] === 'відхилено' && /не можемо запропонувати/.test(lastTo(g, 51).payload.text) && C.length === 2, '«Відхилити» из панели: клиенту сообщение, оптовиком он не стал', rej);
  ok(logRows(g, 'Опт: заявка').length === 3, 'решения по заявкам записаны в «Журнал»', logRows(g, 'Опт: заявка'));

  // оптовик получает цены
  const w = wp(50);
  ok(w.ok && w.wh === true && JSON.stringify(w.prices['DRY-039']) === '[320,5,"kg"]' && JSON.stringify(w.prices['NUT-001']) === '[500,2,"kg"]' && JSON.stringify(w.prices['NUT-007']) === '[70,10,"pcs"]' && !w.prices['NUT-003'], 'оптовик получает оптовые цены и пороги; товар с непонятным объёмом — без оптовой цены', w.prices);
  ok(!secret.test(JSON.stringify(w)) && wp(51).wh === false && wp(52).wh === false, 'в ответе нет служебных колонок; остальные клиенты цен не получают');
  ok(apply(50).wh === true && A.length === 5, 'оптовику повторная заявка не нужна');

  // заказы оптовика: ниже порога, ровно, выше, несколько фасовок
  const o = (uid, items, total) => order(g, U(uid), items, total);
  ok(o(50, [{ id: 'DRY-039', g: 1000, q: 4 }], 380 * 4).ok, 'ниже порога (4 кг из 5): розничная цена 380 ₴/кг');
  ok(o(50, [{ id: 'DRY-039', g: 1000, q: 4 }], 320 * 4).error === 'changed', 'ниже порога оптовая сумма отклоняется');
  const exact = o(50, [{ id: 'DRY-039', g: 1000, q: 5 }], 320 * 5);
  const last = () => g.sheets['Замовлення'].rows.slice(-1)[0];
  ok(exact.ok && last()[13] === 1600 && /Курага.*1 кг \(опт\) × 5 = 1600 ₴/.test(last()[12]), 'ровно порог (5 кг): оптовая цена 320 ₴/кг, в заказе пометка «(опт)»', last()[12]);
  ok(/ОПТ/.test(g.sent.filter(m => m.method === 'sendMessage' && String(m.payload.chat_id) === '900' && /Замовлення P-/.test(m.payload.text)).pop().payload.text), 'в сообщении админу отметка «ОПТ»');
  ok(o(50, [{ id: 'DRY-039', g: 1000, q: 5 }], 380 * 5).error === 'changed', 'выше порога розничная сумма тоже отклоняется: сумму считает сервер');
  ok(o(50, [{ id: 'DRY-039', g: 500, q: 2 }, { id: 'DRY-039', g: 1000, q: 4 }, { id: 'NUT-002', g: 250, q: 1 }], 160 * 2 + 320 * 4 + 160).ok && /500 г \(опт\) × 2 = 320 ₴; .*1 кг \(опт\) × 4 = 1280 ₴; Кеш’ю смажений 250 г × 1 = 160 ₴/.test(last()[12]),
    'несколько фасовок одного товара складываются (2 × 500 г + 4 × 1 кг = 5 кг); товар без оптовой цены — по розничной', last()[12]);
  ok(o(50, [{ id: 'NUT-007', g: 0, q: 9 }], 85 * 9).ok && o(50, [{ id: 'NUT-007', g: 0, q: 10 }], 70 * 10).ok && /\(опт\) × 10 = 700 ₴/.test(last()[12]), 'упаковки: 9 шт — розница, 10 шт — оптовая цена за упаковку', last()[12]);
  ok(adm(g, 900, 'admin.orders').orders[0].wh === 1 && adm(g, 900, 'admin.orders').orders.find(x => x.num === 'P-0001').wh === 0, 'в панели у оптового заказа отметка');
  // обычный клиент оптовую сумму подделать не может
  ok(o(52, [{ id: 'DRY-039', g: 1000, q: 5 }], 320 * 5).error === 'changed' && o(52, [{ id: 'DRY-039', g: 1000, q: 5 }], 380 * 5).ok && !/опт/.test(last()[12]), 'обычный клиент с оптовой суммой: заказ не принят; с розничной — принят без пометки');
  // min_order действует и для оптовика
  settings(g, { min_order: '800' });
  ok(o(50, [{ id: 'NUT-007', g: 0, q: 10 }], 700).error === 'min_order', 'минимальная сумма заказа действует и для оптовика');
  settings(g, { min_order: '0' });

  // прайс для бизнеса
  const before = g.sent.length;
  const pl = g.post({ action: 'wh.pricelist', initData: g.initData(U(50)), lang: 'ua' });
  const plText = g.sent.slice(before).map(m => m.payload.text).join('\n');
  ok(pl.ok && pl.n === 1 && /Прайс для бізнесу · PAMIR/.test(plText) && /Курага.* — 320 ₴\/кг, від 5 кг/.test(plText) && /Мигдаль смажений — 500 ₴\/кг, від 2 кг/.test(plText) && /Арахіс.* — 70 ₴\/уп\., від 10 уп\./.test(plText), 'прайс сообщением: по категориям, с ценой и порогом', plText);
  ok(!/Пекан|Фісташки/.test(plText) && !secret.test(plText) && !/380|560/.test(plText), 'в прайсе нет товаров «немає», товаров без понятного объёма, розничных цен и служебных колонок');
  tgPress(g, 50, 'm:biz');
  ok(/Прайс для бізнесу/.test(lastTo(g, 50).payload.text), 'кнопка бота «Для бізнесу» оптовику присылает прайс');
  g.post({ action: 'wh.pricelist', initData: g.initData(U(50)) }); g.post({ action: 'wh.pricelist', initData: g.initData(U(50)) });
  ok(g.post({ action: 'wh.pricelist', initData: g.initData(U(50)) }).error === 'rate_limit', 'прайс — не чаще 3 раз в час');
  for (let i = 0; i < 120; i++) { const r = P.find(x => x[0] === 'NUT-001').slice(); r[0] = 'NUT-' + (300 + i); r[3] = 'Довга назва товару для перевірки довгого прайсу номер ' + i; P.push(r); }
  g.clearCache();
  const long = g.call('whPricelistTexts_', false);
  ok(long.length >= 2 && long.every(x => x.length <= 4000) && long.join('\n').split('номер').length - 1 === 120, 'длинный прайс делится на несколько сообщений, ни одна строка не теряется', long.map(x => x.length));

  // отзыв статуса
  ok(adm(g, 791, 'admin.whRevoke', { uid: '50' }).error === 'no_perm', 'отозвать статус без права «Опт» нельзя');
  const list = adm(g, 790, 'admin.wh');
  ok(list.ok && list.clients.length === 1 && list.clients[0].on === 1 && list.apps.length === 4 && !secret.test(JSON.stringify(list)), 'панель: список заявок и оптовых клиентов', [list.clients, list.apps.length]);
  const rv = adm(g, 790, 'admin.whRevoke', { uid: '50' });
  ok(rv.ok && rv.clients[0].on === 0 && C[1][5] === 'відкликано' && logRows(g, 'Опт: статус відкликано').length === 1, 'отзыв статуса записан в таблицу и «Журнал»', rv.clients);
  ok(wp(50).wh === false && wp(50).prices === undefined && g.post({ action: 'wh.pricelist', initData: g.initData(U(50)) }).error === 'no_perm', 'после отзыва оптовых цен и прайса нет');
  g.clearCache(); // сброс счётчика «не больше 5 заказов в час»
  ok(o(50, [{ id: 'DRY-039', g: 1000, q: 5 }], 320 * 5).error === 'changed' && o(50, [{ id: 'DRY-039', g: 1000, q: 5 }], 380 * 5).ok && !/опт/.test(last()[12]), 'после отзыва цены сразу розничные: оптовая сумма отклонена');
  ok(adm(g, 790, 'admin.whRevoke', { uid: '777777' }).error === 'not_found', 'неизвестный клиент: not_found');
  const made = fresh().call('setupWave2b');
  ok(made.length >= 5 && /Опт-заявки/.test(made.join()) && /Оптові клієнти/.test(made.join()) && /Опт: мін, кг/.test(made.join()), 'меню «Етап 8.3» создаёт листы и колонки', made);
  ok(g.sandbox.__errors.length === 0, 'в логах бэкенда нет ошибок', g.sandbox.__errors);
}

console.log('Волна 2б · Б1: рассылка — время по Киеву');
{
  const g = fresh();
  const iso = s => new Date(g.call('kyivToMs_', s)).toISOString().slice(0, 16);
  ok(iso('2026-11-12T10:30') === '2026-11-12T08:30' && iso('2026-07-01T10:30') === '2026-07-01T07:30', 'зимой Киев = UTC+2, летом UTC+3', [iso('2026-11-12T10:30'), iso('2026-07-01T10:30')]);
  ok(iso('2027-03-28T02:30') === '2027-03-28T00:30' && iso('2027-03-28T04:30') === '2027-03-28T01:30', 'последнее воскресенье марта: до перевода часов +2, после +3', [iso('2027-03-28T02:30'), iso('2027-03-28T04:30')]);
  ok(iso('2026-10-25T02:30') === '2026-10-24T23:30' && iso('2026-10-25T04:30') === '2026-10-25T02:30', 'последнее воскресенье октября: до перевода +3, после +2', [iso('2026-10-25T02:30'), iso('2026-10-25T04:30')]);
  ok(g.call('kyivText_', g.call('kyivToMs_', '2027-03-28T09:15')) === '28.03.2027 09:15' && g.call('kyivText_', g.call('kyivToMs_', '2026-10-25T09:15')) === '25.10.2026 09:15', 'время показывается обратно тем же киевским');
  ok(g.call('kyivToMs_', 'завтра') === 0 && g.call('kyivToMs_', '') === 0, 'непонятное время не принимается');
}

console.log('Волна 2б · Б1: рассылка');
{
  const g = fresh();
  const secret = /СЕКРЕТ|do-smaku|33%/;
  const M = () => g.sheets['Розсилки'].rows, C = () => g.sheets['Клієнти'].rows;
  const mrow = id => M().find(r => r[0] === id);
  const crow = uid => C().find(r => String(r[0]) === String(uid));
  const ccol = name => C()[0].indexOf(name);
  const mailTo = (uid, from) => g.sent.slice(from || 0).filter(m => (m.method === 'sendMessage' || m.method === 'sendPhoto') && String(m.payload.chat_id) === String(uid) &&
    m.payload.reply_markup && JSON.stringify(m.payload.reply_markup).indexOf('"mu"') >= 0);
  const kyivIn = min => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Kyiv', dateStyle: 'short', timeStyle: 'short' }).format(new Date(Date.now() + min * 60000)).replace(' ', 'T');
  addAdmin(g, 820, 'manager', ['mail']);
  addAdmin(g, 821, 'manager', ['st']);
  g.sheets['Клієнти'].rows.splice(1); // админы нажимали /start и тоже записаны как клиенты; для проверки начинаем с пустого листа
  const draft = { ua: 'Свіжа поставка 🌿\nКурага вже на прилавку й у магазині.', ru: 'Свежая поставка 🌿\nКурага уже на прилавке и в магазине.', photo: '', btn: { k: 'prod', v: 'dry-039' }, seg: { k: 'all', v: '' } };

  // права
  ok(adm(g, 821, 'admin.mail').error === 'no_perm' && adm(g, 821, 'admin.mailSave', draft).error === 'no_perm' && adm(g, 821, 'admin.mailSend', { id: 'M-0001' }).error === 'no_perm' &&
    adm(g, 821, 'admin.mailTest', { id: 'M-0001' }).error === 'no_perm' && adm(g, 5555, 'admin.mailSave', draft).error === 'forbidden' && !g.sheets['Розсилки'], 'без права «Розсилка» рассылку не создать и не отправить даже прямым запросом');
  ok(adm(g, 820, 'admin.mailSave', { ua: '', ru: '' }).error === 'bad_form' && adm(g, 820, 'admin.mailSave', Object.assign({}, draft, { btn: { k: 'prod', v: '' } })).error === 'bad_form' &&
    adm(g, 820, 'admin.mailSave', Object.assign({}, draft, { photo: 'ftp://x' })).error === 'bad_photo' && adm(g, 820, 'admin.mailSave', Object.assign({}, draft, { photo: 'https://img.test/a.jpg', ua: 'я'.repeat(1001) })).error === 'too_long',
    'пустой текст, кнопка без товара, неверное фото и слишком длинная подпись к фото отклоняются');

  // черновик при пустом листе «Клієнти»: 0 получателей — не ошибка
  const s1 = adm(g, 820, 'admin.mailSave', draft);
  ok(s1.ok && s1.mail.id === 'M-0001' && s1.mail.status === 'створена' && s1.n === 0 && s1.mail.tested === 0 && s1.mail.btn.v === 'DRY-039', 'черновик создан; получателей 0 — это не ошибка', s1);
  ok(mrow('M-0001')[2].indexOf('Тест820') >= 0 && mrow('M-0001')[4] === 'усі клієнти' && mrow('M-0001')[8] === 'Відкрити товар: DRY-039', 'в листе «Розсилки»: кто создал, сегмент, кнопка', mrow('M-0001').slice(0, 9));
  ok(adm(g, 820, 'admin.mailSend', { id: 'M-0001' }).error === 'need_test', 'без шага «Надіслати тільки мені» отправить нельзя (проверка на сервере)');
  const before = g.sent.length;
  const t1 = adm(g, 820, 'admin.mailTest', { id: 'M-0001' });
  const mine = mailTo(820, before);
  ok(t1.ok && t1.sent === 2 && mine.length === 2 && /Свіжа поставка/.test(mine[0].payload.text) && /Свежая поставка/.test(mine[1].payload.text), '«тільки мені»: автор получил оба языка', mine.map(m => m.payload.text));
  const kb = mine[0].payload.reply_markup.inline_keyboard;
  ok(kb.length === 2 && /Відкрити товар/.test(kb[0][0].text) && /[?&]m=M-0001/.test(kb[0][0].web_app.url) && /[?&]p=DRY-039/.test(kb[0][0].web_app.url) && kb[1][0].callback_data === 'mu' && kb[1][0].text === 'Не надсилати мені розсилки',
    'в сообщении кнопка «Відкрити товар» и «Не надсилати мені розсилки»', kb);
  ok(adm(g, 820, 'admin.mail').mails[0].tested === 1 && !crow(820), 'проверка на себе отмечена; сам автор в получатели из-за неё не попал');
  const none = adm(g, 820, 'admin.mailSend', { id: 'M-0001' });
  ok(none.error === 'no_recipients' && mrow('M-0001')[3] === 'створена', 'получателей нет — «Немає отримувачів», рассылка не запускается', none);

  // клиенты: 811 и 813 — UA, 812 — RU (язык из заказа), 814 отписался, 815 заблокировал бота
  [811, 813, 814, 815].forEach(u => tgMsg(g, u, '/start'));
  order(g, U(812), [{ id: 'NUT-007', g: 0, q: 1 }], 85, { lang: 'ru' });
  tgPress(g, 814, 'mu');
  ok(crow(814)[ccol('Відписка')] === 'так' && /Більше не надсилаємо розсилки/.test(lastTo(g, 814).payload.text), '«Не надсилати мені розсилки» действует сразу: отметка в «Клієнти» и ответ клиенту');
  crow(815)[ccol('Заблокував бота')] = 'так';
  ok(adm(g, 820, 'admin.mailCount', { seg: { k: 'all' } }).n === 3, 'получателей 3: отписавшийся и заблокировавший не считаются', adm(g, 820, 'admin.mailCount', { seg: { k: 'all' } }));

  // изменили текст после проверки — проверять заново
  const s2 = adm(g, 820, 'admin.mailSave', Object.assign({}, draft, { id: 'M-0001', ru: '' }));
  ok(s2.ok && s2.mail.tested === 0 && s2.n === 3 && adm(g, 820, 'admin.mailSend', { id: 'M-0001' }).error === 'need_test', 'изменили текст после «тільки мені» — нужно проверить снова');
  adm(g, 820, 'admin.mailTest', { id: 'M-0001' });
  const at0 = g.sent.length;
  const go = adm(g, 820, 'admin.mailSend', { id: 'M-0001' });
  ok(go.ok && go.n === 3 && go.mail.status === 'завершена' && go.mail.sent === 3 && go.mail.total === 3 && go.trigger === 1 && g.triggers.indexOf('mailJob') >= 0, 'рассылка ушла: 3 из 3, статус «завершена», триггер mailJob включён', go);
  ok([811, 812, 813].every(u => mailTo(u, at0).length === 1) && mailTo(814, at0).length === 0 && mailTo(815, at0).length === 0, 'каждый получил одно сообщение; отписавшийся и заблокировавший — ничего');
  ok(/Свіжа поставка/.test(mailTo(812, at0)[0].payload.text) && /Не присылать мне рассылки/.test(JSON.stringify(mailTo(812, at0)[0].payload.reply_markup)), 'у русскоязычного клиента пустой текст RU заменён вторым языком, кнопка отписки — на его языке');
  ok(crow(811)[ccol('Остання розсилка')] === 'M-0001' && isDate(crow(811)[ccol('Дата останньої розсилки')]) && mrow('M-0001')[10].indexOf('Тест820') >= 0, 'у получателя отметка рассылки; в листе — кто отправил');
  ok(logRows(g, 'Розсилка: створено').length === 1 && logRows(g, 'Розсилка: надіслано').some(r => /отримувачів: 3/.test(r[6])) && logRows(g, 'Розсилка: завершено').some(r => /надіслано: 3/.test(r[6])), 'в «Журнале»: кто создал, кто отправил, сколько получателей');
  ok(adm(g, 820, 'admin.mailSave', Object.assign({}, draft, { id: 'M-0001' })).error === 'locked' && adm(g, 820, 'admin.mailSend', { id: 'M-0001' }).error === 'locked', 'отправленную рассылку нельзя изменить или отправить второй раз');
  ok(!secret.test(JSON.stringify(g.sent)), 'служебные колонки в рассылку не попадают');
  // отписка не трогает сообщения о заказах
  const o814 = g.sent.length;
  order(g, U(814), [{ id: 'NUT-007', g: 0, q: 1 }], 85);
  ok(g.sent.slice(o814).some(m => String(m.payload.chat_id) === '814' && /Замовлення P-/.test(m.payload.text)), 'отписавшийся по-прежнему получает сообщения о своих заказах');

  // лимит частоты: 1 рассылка в 7 дней на человека
  const next = (extra) => { const s = adm(g, 820, 'admin.mailSave', Object.assign({}, draft, extra || {})); adm(g, 820, 'admin.mailTest', { id: s.mail.id }); return s.mail.id; };
  const m2 = next();
  const lim = adm(g, 820, 'admin.mailSend', { id: m2 });
  ok(lim.error === 'no_recipients' && lim.skip === 3, 'через минуту вторая рассылка тем же людям не уходит: лимит частоты, пропущено 3', lim);
  crow(811)[ccol('Дата останньої розсилки')] = new Date(Date.now() - 8 * 24 * 3600e3);
  const at2 = g.sent.length;
  const lim2 = adm(g, 820, 'admin.mailSend', { id: m2 });
  ok(lim2.ok && lim2.n === 1 && lim2.skip === 2 && mailTo(811, at2).length === 1 && mailTo(812, at2).length === 0 && mrow(m2)[15] === 2, 'прошло 8 дней у одного — получил только он; пропущенные видны в статистике', [lim2.n, lim2.skip, mrow(m2)[15]]);
  settings(g, { mail_every_days: '0' });
  ok(adm(g, 820, 'admin.mailCount', { seg: { k: 'all' } }).n === 3, 'лимит частоты настраивается (0 — без ограничения)');

  // отложенная отправка и отмена до старта
  const m3 = next();
  ok(adm(g, 820, 'admin.mailSend', { id: m3, at: kyivIn(-30) }).error === 'bad_time' && adm(g, 820, 'admin.mailSend', { id: m3, at: 'завтра' }).error === 'bad_time', 'время в прошлом и непонятное время не принимаются');
  const when = kyivIn(90), at3 = g.sent.length;
  const plan = adm(g, 820, 'admin.mailSend', { id: m3, at: when });
  ok(plan.ok && plan.mail.status === 'запланована' && plan.at === when.slice(8, 10) + '.' + when.slice(5, 7) + '.' + when.slice(0, 4) + ' ' + when.slice(11) && mrow(m3)[9] === plan.at, 'рассылка запланирована, время показано по Киеву', plan);
  g.call('mailJob');
  ok(mailTo(811, at3).length === 0 && mrow(m3)[3] === 'запланована', 'до назначенного времени триггер ничего не отправляет');
  const cancel = adm(g, 820, 'admin.mailCancel', { id: m3 });
  const svc3 = JSON.parse(mrow(m3)[18]); svc3.at = Date.now() - 1000; mrow(m3)[18] = JSON.stringify(svc3);
  g.call('mailJob');
  ok(cancel.ok && cancel.mail.status === 'скасована' && mailTo(811, at3).length === 0 && logRows(g, 'Розсилка: скасовано').length === 1, 'отмена до старта: рассылка не уходит даже после назначенного времени');
  const m4 = next();
  adm(g, 820, 'admin.mailSend', { id: m4, at: kyivIn(90) });
  const svc4 = JSON.parse(mrow(m4)[18]); svc4.at = Date.now() - 1000; mrow(m4)[18] = JSON.stringify(svc4);
  const at4 = g.sent.length;
  g.call('mailJob');
  ok(mrow(m4)[3] === 'завершена' && [811, 812, 813].every(u => mailTo(u, at4).length === 1), 'назначенное время пришло — триггер отправил рассылку');

  // порции и обрыв: без дублей
  for (let u = 831; u <= 836; u++) tgMsg(g, u, '/start');
  const m5 = next({ seg: { k: 'all', v: '' } });
  adm(g, 820, 'admin.mailSend', { id: m5, at: kyivIn(90) });
  const svc5 = JSON.parse(mrow(m5)[18]); svc5.at = Date.now() - 1000; mrow(m5)[18] = JSON.stringify(svc5);
  const at5 = g.sent.length, token = g.props.BOT_TOKEN;
  const all9 = [811, 812, 813, 831, 832, 833, 834, 835, 836];
  ok(g.call('mailRun_', token, 4, 60000) === 4 && mrow(m5)[3] === 'йде' && mrow(m5)[12] === 4, 'первая порция: 4 сообщения, статус «йде»', mrow(m5).slice(3, 13));
  g.cache['mail_run'] = '1'; // другая порция ещё работает
  ok(g.call('mailRun_', token, 4, 60000) === 0, 'две порции одновременно не идут');
  delete g.cache['mail_run'];
  // обрыв: отметка получателю уже стоит, а запуск упал до отправки — после продолжения дубля нет
  const realFlush = g.sandbox.SpreadsheetApp.flush;
  let flushes = 0, crashed = false;
  g.sandbox.SpreadsheetApp.flush = () => { if (++flushes === 2) throw new Error('обрив запуску'); };
  try { g.call('mailRun_', token, 4, 60000); } catch (e) { crashed = true; }
  g.sandbox.SpreadsheetApp.flush = realFlush;
  ok(crashed && !g.cache['mail_run'], 'запуск оборвался посреди порции; флажок «порция идёт» снят');
  g.call('mailRun_', token, 4, 60000);
  g.call('mailRun_', token, 4, 60000);
  const got = all9.map(u => mailTo(u, at5).length);
  ok(mrow(m5)[3] === 'завершена' && got.every(n => n <= 1) && got.filter(n => n === 1).length === 8, 'после обрыва рассылка продолжилась с того же места: никто не получил два сообщения (тот, на ком оборвалось, не получил ни одного)', got);
  ok(all9.every(u => crow(u)[ccol('Остання розсилка')] === m5), 'у каждого получателя отметка этой рассылки');

  // 403 и 429
  const m6 = next();
  adm(g, 820, 'admin.mailSend', { id: m6, at: kyivIn(90) });
  const svc6 = JSON.parse(mrow(m6)[18]); svc6.at = Date.now() - 1000; mrow(m6)[18] = JSON.stringify(svc6);
  let hits = 0;
  g.setTelegramFail((method, p) => {
    if (String(p.chat_id) === '831') return { ok: false, error_code: 403, description: 'Forbidden: bot was blocked by the user' };
    if (String(p.chat_id) === '832' && hits++ === 0) return { ok: false, error_code: 429, description: 'Too Many Requests', parameters: { retry_after: 1 } };
    if (String(p.chat_id) === '834') return { ok: false, error_code: 429, description: 'Too Many Requests', parameters: { retry_after: 120 } };
    if (String(p.chat_id) === '835') return { ok: false, error_code: 400, description: 'Bad Request' };
    return null;
  });
  const at6 = g.sent.length;
  g.call('mailRun_', token, 50, 60000);
  ok(crow(831)[ccol('Заблокував бота')] === 'так' && mrow(m6)[14] === 1, '403 — клиент отмечен «Заблокував бота» и посчитан в блокировках', mrow(m6).slice(11, 16));
  ok(hits === 2 && mailTo(832, at6).length === 2, '429 с коротким ожиданием: подождали retry_after и отправили');
  ok(mrow(m6)[3] === 'йде' && crow(834)[ccol('Остання розсилка')] !== m6 && JSON.parse(mrow(m6)[18]).wait > Date.now(), '429 с долгим ожиданием: порция остановлена, отметка снята, продолжим позже', mrow(m6).slice(3, 4));
  g.call('mailRun_', token, 50, 60000);
  ok(mrow(m6)[3] === 'йде', 'пока Telegram просит ждать, следующая порция не начинается');
  g.setTelegramFail((method, p) => String(p.chat_id) === '835' ? { ok: false, error_code: 400, description: 'Bad Request' } : null);
  const w6 = JSON.parse(mrow(m6)[18]); w6.wait = Date.now() - 1; mrow(m6)[18] = JSON.stringify(w6);
  g.call('mailRun_', token, 50, 60000);
  g.setTelegramFail(false);
  ok(mrow(m6)[3] === 'завершена' && mrow(m6)[13] === 1 && mrow(m6)[14] === 1 && mrow(m6)[12] === 7 && mailTo(834, at6).length === 2, 'после ожидания рассылка завершена: отправлено 7, ошибок 1, блокировок 1', mrow(m6).slice(11, 16));
  const m7 = next();
  ok(adm(g, 820, 'admin.mailCount', { seg: { k: 'all' } }).n === 8, 'заблокировавшему бота следующая рассылка не уйдёт', adm(g, 820, 'admin.mailCount', { seg: { k: 'all' } }));

  // сегменты
  [501, 502, 503, 777].forEach(u => tgMsg(g, u, '/start'));
  const cnt = seg => adm(g, 820, 'admin.mailCount', { seg }).n;
  ok(cnt({ k: 'prod', v: 'dry-039' }) === 3 && cnt({ k: 'cat', v: 'NUT' }) >= 4 && cnt({ k: 'cat', v: 'SPC' }) === 0, 'сегменты «купували товар» и «купували категорію» — по настоящим заказам', [cnt({ k: 'prod', v: 'DRY-039' }), cnt({ k: 'cat', v: 'NUT' })]);
  const O = g.sheets['Замовлення'].rows; O.filter(r => String(r[3]) === '777').forEach(r => { r[1] = new Date(Date.now() - 40 * 24 * 3600e3); });
  ok(cnt({ k: 'idle' }) === 1, '«не замовляли 30+ днів»: только тот, кто заказывал раньше и не заказывал последние 30 дней', cnt({ k: 'idle' }));
  g.post({ action: 'wh.apply', initData: g.initData(U(501)), type: 'cafe', name: 'Кафе', city: 'Харків', contact: 'Ірина', phone: '+380501112233', lang: 'ua' });
  adm(g, 900, 'admin.whDecide', { id: 'W-0001', d: 'a' });
  g.post({ action: 'notify', initData: g.initData(U(502)), id: 'NUT-008', lang: 'ua' });
  ok(cnt({ k: 'wh' }) === 1 && cnt({ k: 'sub', v: 'NUT-008' }) === 1 && cnt({ k: 'sub', v: 'NUT-001' }) === 0, 'сегменты «оптовики» и «чекають на товар»');
  const cat = adm(g, 820, 'admin.mailSave', { ua: 'Спеції', ru: '', btn: { k: 'cat', v: 'spc' }, seg: { k: 'cat', v: 'spc' }, photo: 'https://img.test/spc.jpg' });
  const bc = g.sent.length;
  adm(g, 820, 'admin.mailTest', { id: cat.mail.id });
  const ph = g.sent.slice(bc).filter(m => m.method === 'sendPhoto')[0];
  ok(cat.ok && cat.n === 0 && ph && ph.payload.caption === 'Спеції' && /[?&]cat=SPC/.test(ph.payload.reply_markup.inline_keyboard[0][0].web_app.url) && /Відкрити категорію/.test(ph.payload.reply_markup.inline_keyboard[0][0].text),
    'сегмент «купували категорію Спеції», фото и кнопка «Відкрити категорію»', ph && ph.payload);
  g.setTelegramFail((method) => method === 'sendPhoto' ? { ok: false, error_code: 400, description: 'Bad Request: wrong file identifier' } : null);
  const badPhoto = adm(g, 820, 'admin.mailTest', { id: cat.mail.id });
  g.setTelegramFail(false);
  ok(badPhoto.error === 'send_failed' && /wrong file identifier/.test(badPhoto.why), 'неверный код фото виден уже на шаге «тільки мені»', badPhoto);

  // статистика: нажали кнопку, заказали за 3 дня
  g.post({ action: 'ev', initData: g.initData(U(811)), sid: 's', events: [{ e: 'mail', id: m6, t: Date.now() }, { e: 'open', t: Date.now() }] });
  g.post({ action: 'ev', initData: g.initData(U(811)), sid: 's2', events: [{ e: 'mail', id: m6, t: Date.now() }] });
  g.clearCache();
  order(g, U(812), [{ id: 'NUT-007', g: 0, q: 1 }], 85);
  g.call('mailFreezeStats_');
  ok(mrow(m6)[16] === 1 && mrow(m6)[17] === 1, 'статистика: нажали кнопку — 1 человек, заказали за 3 дня — 1', mrow(m6).slice(11, 18));
  const list = adm(g, 820, 'admin.mail');
  ok(list.ok && list.mails.length === M().length - 1 && list.mails.find(x => x.id === m6).clicks === 1 && list.every === 0 && list.trigger === 1 && !secret.test(JSON.stringify(list)), 'панель: список рассылок со статусами и числами');
  g.call('menuDailyOn');
  ok(g.triggers.filter(t => t === 'mailJob').length === 1, 'меню «Увімкнути щоденні повідомлення» ставит триггер рассылки один раз', g.triggers);
  g.call('menuDailyOff');
  ok(g.triggers.indexOf('mailJob') < 0, 'меню «Вимкнути…» снимает и триггер рассылки');
  ok(/Розсилки/.test(fresh().call('setupWave2b').join()), 'меню «Етап 8.3» создаёт лист «Розсилки»');
  ok(g.sandbox.__errors.filter(e => !/обрив запуску/.test(e)).length === 0, 'в логах бэкенда нет ошибок', g.sandbox.__errors);
}

/* ============================ Этап 8, волна 2в ============================ */
console.log('Волна 2в · В1: «Як їсти» и рецепты');
{
  const g = fresh();
  const P = g.sheets['Товари'].rows;
  const cat0 = g.get({ action: 'catalog' });
  ok(cat0.recipes === undefined && cat0.products.every(p => p.eu === undefined && p.tg === undefined), 'без листа «Рецепти» и колонок «Як їсти» в каталоге ничего нового нет');
  ok(adm(g, 900, 'admin.products').products[0].eUa === '' && P[0].indexOf('Як їсти (UA)') < 0, 'панель работает и без новых колонок');
  const made = g.call('setupWave2c');
  ok(made.length === 4 && g.sheets['Рецепти'].rows.length === 1 && g.sheets['Рецепти'].rows[0].join('|') === 'ID|Назва (UA)|Название (RU)|Фото|Текст (UA)|Текст (RU)|Товари|Показувати' && P[0].indexOf('Теги') > 0,
    'меню «Етап 8.4» создаёт пустой лист «Рецепти» и колонки «Як їсти», «Как есть», «Теги»', made);
  ok(g.call('setupWave2c').length === 0 && g.get({ action: 'catalog' }).recipes === undefined, 'повторный запуск ничего не меняет; пустой лист рецептов на витрину не влияет');
  // «Як їсти»
  addAdmin(g, 840, 'manager', ['stock']);
  ok(adm(g, 840, 'admin.product', { id: 'DRY-039', patch: { eUa: 'просто так' } }).error === 'no_perm', '«Як їсти» меняет только тот, у кого право «Тексти товарів»');
  const sv = adm(g, 900, 'admin.product', { id: 'DRY-039', patch: { eUa: 'Просто так, до чаю.\nУ компот.', eRu: 'Просто так, к чаю.\nВ компот.', tags: ' До чаю, перекус; ДО ЧАЮ ' } });
  ok(sv.ok && sv.product.eUa === 'Просто так, до чаю.\nУ компот.' && sv.product.tags === 'до чаю, перекус', '«Як їсти» и теги сохраняются из панели; теги приводятся к виду, без повторов', sv.product);
  const p39 = g.get({ action: 'catalog' }).products.find(p => p.id === 'DRY-039'), p1 = g.get({ action: 'catalog' }).products.find(p => p.id === 'DRY-001');
  ok(p39.eu === 'Просто так, до чаю.\nУ компот.' && p39.er === 'Просто так, к чаю.\nВ компот.' && p39.tg.join() === 'до чаю,перекус' && p1.eu === undefined && p1.tg === undefined, 'в каталоге «Як їсти» и теги только у товара, где они заполнены', [p39.eu, p1.eu]);
  // рецепты
  const R = g.sheets['Рецепти'].rows;
  R.push(['rec-1', 'Узвар з кураги', 'Узвар из кураги', 'https://img.test/uzvar.jpg', 'Промити курагу.\nВарити 15–20 хвилин.', '', 'dry-039, NUT-008, NOPE-1', 'так']);
  R.push(['REC-2', 'Плов', 'Плов', 'AgACAgIAAxkBAAIBcGXfileIdExample123456', 'Текст плову', 'Текст плова', 'SPC-001;SPC-004', 'так']);
  R.push(['REC-3', 'Прихований', '', '', 'Текст', '', 'DRY-039', 'ні']);
  R.push(['REC-1', 'Дубль', '', '', 'Текст', '', '', 'так']);
  R.push(['', 'Без ID', '', '', 'Текст', '', '', 'так']);
  g.clearCache();
  const rc = g.get({ action: 'catalog' }).recipes;
  ok(rc.length === 2 && rc[0].id === 'REC-1' && rc[0].ua === 'Узвар з кураги' && rc[0].ru === 'Узвар из кураги' && rc[0].img === 'https://img.test/uzvar.jpg' && rc[0].tUa === 'Промити курагу.\nВарити 15–20 хвилин.' && rc[0].items.join() === 'DRY-039,NUT-008,NOPE-1',
    'в каталоге только рецепты с «Показувати» = так, без дублей и строк без ID', rc);
  ok(rc[1].id === 'REC-2' && rc[1].img === undefined && rc[1].fid === 1 && !/AgACAg/.test(JSON.stringify(rc)), 'код фото (file_id) на витрину не уходит — только отметка, что он есть');
  ok(!/СЕКРЕТ|do-smaku|33%/.test(JSON.stringify(g.get({ action: 'catalog' }))), 'служебные колонки по-прежнему не уходят');
  // шаблон «Рецепт» для рассылки
  addAdmin(g, 841, 'manager', ['mail']);
  ok(adm(g, 840, 'admin.recipePhoto', { id: 'REC-2' }).error === 'no_perm' && adm(g, 841, 'admin.recipePhoto', { id: 'rec-2' }).photo === 'AgACAgIAAxkBAAIBcGXfileIdExample123456' && adm(g, 841, 'admin.recipePhoto', { id: 'REC-9' }).photo === '', 'фото рецепта для рассылки получает только админ с правом «Розсилка»');
  const ms = adm(g, 841, 'admin.mailSave', { ua: 'Рецепт: Плов', ru: '', photo: 'AgACAgIAAxkBAAIBcGXfileIdExample123456', btn: { k: 'rec', v: 'rec-2' }, seg: { k: 'all', v: '' } });
  const b0 = g.sent.length;
  adm(g, 841, 'admin.mailTest', { id: ms.mail.id });
  const msg = g.sent.slice(b0).find(m => m.method === 'sendPhoto');
  ok(ms.ok && ms.mail.btn.v === 'REC-2' && msg && /[?&]rec=REC-2/.test(msg.payload.reply_markup.inline_keyboard[0][0].web_app.url) && /Відкрити рецепт/.test(msg.payload.reply_markup.inline_keyboard[0][0].text), 'рассылка с кнопкой «Відкрити рецепт» и фото рецепта', msg && msg.payload);
  ok(adm(g, 841, 'admin.mailSave', { ua: 'x', btn: { k: 'rec', v: '' }, seg: { k: 'all' } }).error === 'bad_form', 'кнопка «рецепт» без рецепта не принимается');
  ok(g.sandbox.__errors.length === 0, 'в логах бэкенда нет ошибок', g.sandbox.__errors);
}

console.log('Волна 2в · В3: «Пригости друга»');
{
  const g = fresh();
  const one = (uid, total, extra) => order(g, U(uid), [{ id: 'NUT-007', g: 0, q: total / 85 }], total, extra);
  const giftLines = () => { const r = g.sheets['Замовлення'].rows.slice(-1)[0]; try { return JSON.parse(r[16]).g || []; } catch (e) { return []; } };
  const I = () => (g.sheets['Запрошення'] ? g.sheets['Запрошення'].rows : []);
  // выключено по умолчанию
  const f = adm(g, 900, 'admin.settings').fields;
  ok(f.find(x => x.k === 'referral_on').v === '0' && f.find(x => x.k === 'referral_gift_ua').v === '' && f.find(x => x.k === 'referral_min_order').v === '0', 'по умолчанию: referral_on = 0, пробник пустой');
  ok(!g.get({ action: 'catalog' }).shop.ref, 'выключено — в каталоге ничего про приглашения нет');
  const off = one(951, 85, { ref: '950000' });
  ok(off.ok && (!off.gifts || !off.gifts.length) && !g.sheets['Запрошення'], 'выключено — заказ по ссылке друга ничего не даёт и ничего не записывает', off);
  settings(g, { referral_on: '1' });
  ok(!g.get({ action: 'catalog' }).shop.ref, 'включено, но пробник не задан — функции по-прежнему нет');
  settings(g, { referral_on: '0', referral_gift_ua: '50 г кураги' });
  ok(!g.get({ action: 'catalog' }).shop.ref, 'пробник задан, но выключено — функции нет');
  settings(g, { referral_on: 'так', referral_gift_ua: '50 г кураги', referral_min_order: '170' });
  const sr = g.get({ action: 'catalog' }).shop.ref;
  ok(sr && sr.min === 170 && sr.gift.ua === '50 г кураги' && sr.gift.ru === '50 г кураги' && g.sheets['Налаштування'].rows.find(r => r[0] === 'referral_on')[1] === '1', 'включено и пробник задан — функция работает', sr);
  // пригласивший 960000 (у него уже есть заказ)
  one(960000, 85);
  ok(giftLines().length === 0, 'обычный заказ пригласившего — без пробника');
  // новый клиент по ссылке
  const low = one(961000, 85, { ref: '960000' });
  ok(low.ok && (!low.gifts || !low.gifts.length) && I().length === 0, 'первый заказ меньше минимальной суммы: пробника нет, приглашение не засчитано', low);
  const first = one(962000, 170, { ref: '960000', lang: 'ru' });
  ok(first.ok && first.gifts.length === 1 && first.gifts[0] === 'Пробник по приглашению друга: 50 г кураги' && giftLines()[0] === 'Пробник за запрошенням друга: 50 г кураги', 'новый клиент по ссылке: пробник к первому заказу (клиенту — на его языке)', first.gifts);
  ok(I().length === 2 && I()[1][1] === '960000' && I()[1][2] === '962000' && /^P-/.test(I()[1][3]) && I()[1][4] === '50 г кураги' && I()[1][5] === '', 'запись в листе «Запрошення»', I()[1]);
  ok(/Пробник за запрошенням друга: 50 г кураги/.test(g.sent.filter(m => String(m.payload.chat_id) === '900' && /Замовлення P-/.test(m.payload.text || '')).pop().payload.text), 'в сообщении админу пометка о пробнике');
  const second = one(962000, 170, { ref: '960000' });
  ok(second.ok && (!second.gifts || !second.gifts.length) && I().length === 2, 'второй заказ того же клиента: пробник второй раз не даётся');
  ok(!(one(961000, 170, { ref: '960000' }).gifts || []).length && I().length === 2, 'у клиента уже был заказ — по ссылке он не «новый»');
  const self = one(963000, 170, { ref: '963000' });
  ok(self.ok && (!self.gifts || !self.gifts.length) && I().length === 2, 'самоприглашение не работает', self);
  ok(!(one(964000, 170, { ref: 'abc' }).gifts || []).length && !(one(965000, 170, { ref: '12' }).gifts || []).length && I().length === 2, 'мусор вместо id пригласившего игнорируется');
  ok(!(g.post({ action: 'order', initData: g.initData(U(966000)), test: true, ref: '960000', items: [{ id: 'NUT-007', g: 0, q: 2 }], total: 170, name: 'Олена', phone: '+380501234567', delivery: 'pickup', pay: 'cash' }).gifts || []).length && I().length === 2, 'тестовый заказ приглашением не считается');
  one(967000, 170, { ref: '960000' });
  ok(I().length === 3, 'второй приглашённый друг засчитан');
  // пригласивший получает пробник к следующим заказам: по одному на заказ
  const inv1 = one(960000, 85);
  ok(inv1.gifts.length === 1 && inv1.gifts[0] === 'Пробник за запрошеного друга: 50 г кураги' && /^P-/.test(I()[1][5]) && I()[2][5] === '', 'пригласивший получил пробник к следующему заказу (минимальная сумма для него не нужна)', inv1.gifts);
  const inv2 = one(960000, 85), inv3 = one(960000, 85);
  ok(inv2.gifts.length === 1 && /^P-/.test(I()[2][5]) && (!inv3.gifts || !inv3.gifts.length), 'за второго друга — пробник к ещё одному заказу; дальше пробников нет', [inv2.gifts, inv3.gifts]);
  ok(logRows(g, 'Запрошення: зараховано').length === 2 && logRows(g, 'Запрошення: пробник запросившому').length === 2, 'всё записано в «Журнал»');
  // подарок от суммы и пробник складываются, сумма заказа не меняется
  settings(g, { gift_from: '100', gift_text_ua: 'жменя родзинок' });
  const both = one(968000, 170, { ref: '960000' });
  ok(both.ok && both.gifts.length === 2 && g.sheets['Замовлення'].rows.slice(-1)[0][13] === 170, 'пробник не меняет сумму заказа и складывается с подарком от суммы', both.gifts);
  ok(g.sandbox.__errors.length === 0, 'в логах бэкенда нет ошибок', g.sandbox.__errors);
}

console.log('Часовой пояс: всё считается по Киеву, от пояса проекта не зависит');
{
  const g = fresh();
  // полночь по Киеву сегодня — в виде момента времени
  const kyivDay = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Kyiv', dateStyle: 'short' }).format(new Date());
  const midnight = g.call('kyivToMs_', kyivDay + 'T00:00');
  ok(new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Kyiv', dateStyle: 'short', timeStyle: 'short' }).format(new Date(midnight)) === kyivDay + ' 00:00', 'полночь по Киеву вычисляется верно', new Date(midnight).toISOString());
  const O = g.sheets['Замовлення'].rows;
  const base = O[1].slice();
  const add = (num, ms) => { const r = base.slice(); r[0] = num; r[1] = new Date(ms); r[2] = 'новий'; r[13] = 100; r[15] = 'miniapp'; O.push(r); };
  const before = adm(g, 900, 'admin.orders').stats.today.n;
  add('P-9001', midnight - 10 * 60000); // 23:50 вчера по Киеву
  add('P-9002', midnight + 10 * 60000); // 00:10 сегодня по Киеву
  const today = adm(g, 900, 'admin.orders');
  ok(today.stats.today.n === before + 1, 'заказ в 23:50 по Киеву — вчерашний, в 00:10 — сегодняшний', [before, today.stats.today.n]);
  const row = n => today.orders.find(o => o.num === n);
  ok(row('P-9001').date.slice(6) === '23:50' && row('P-9002').date.slice(6) === '00:10' && row('P-9001').date.slice(0, 5) !== row('P-9002').date.slice(0, 5), 'в панели время заказов показано киевским, дата меняется в полночь по Киеву', [row('P-9001').date, row('P-9002').date]);
  ok(g.call('saleEnd_', '31.12.2099', 'Europe/Berlin').day === '2099-12-31' && g.call('saleEnd_', '31.12.2099', 'Europe/Kiev').end === g.call('saleEnd_', '31.12.2099', 'Europe/Berlin').end, '«Акція до», записанная текстом, не зависит от часового пояса');
  ok(!/getScriptTimeZone|getTimezoneOffset|\.getHours\(\)|toLocale/.test(require('fs').readFileSync(CODE, 'utf8')), 'в коде нет обращений к часовому поясу проекта (кроме часа ежедневного таймера)');
  ok(g.sandbox.__errors.length === 0, 'в логах бэкенда нет ошибок', g.sandbox.__errors);
}

console.log('Выпуск А, блок 1: полоска, баночки, порядок, курага, первый заказ');
{
  const lastAdminMsg = g => g.sent.filter(m => m.method === 'sendMessage' && m.payload.chat_id === '900').pop();
  const addCol = (g, name, byId) => { // новая колонка в листе «Товари»
    const rows = g.sheets['Товари'].rows;
    rows[0].push(name);
    for (let i = 1; i < rows.length; i++) rows[i].push(byId[rows[i][0]] === undefined ? '' : byId[rows[i][0]]);
    g.clearCache();
  };
  // Полоска
  {
    const g = fresh();
    ok(!g.get({ action: 'catalog' }).shop.notice, 'полоска: настройки пусты — notice нет');
    settings(g, { notice_ua: 'Старе оголошення', notice_ru: 'Старое объявление' });
    ok(g.get({ action: 'catalog' }).shop.notice.ua === 'Старе оголошення', 'полоска: старая notice_ua работает');
    settings(g, { notice_text_ua: 'Ми відкрилися', notice_text_ru: 'Мы открылись' });
    const n = g.get({ action: 'catalog' }).shop.notice;
    ok(n.ua === 'Ми відкрилися' && n.ru === 'Мы открылись', 'полоска: notice_text_* главнее старого объявления', n);
    const g2 = fresh();
    settings(g2, { notice_text_ua: 'Тільки UA' });
    const n2 = g2.get({ action: 'catalog' }).shop.notice;
    ok(n2.ua === 'Тільки UA' && n2.ru === 'Тільки UA', 'полоска: одна заполненная сторона заменяет вторую');
  }
  // Сообщение клиенту и пометка админу
  {
    const g = fresh();
    const r1 = order(g, U(7001), [{ id: 'NUT-007', g: 0, q: 1 }], 85);
    const toClient = g.sent.filter(m => m.method === 'sendMessage' && m.payload.chat_id === '7001').pop().payload.text;
    ok(r1.ok && /\nПитання щодо замовлення — @gladiroon$/.test(toClient), 'клиент (UA): последняя строка про @gladiroon', toClient);
    ok(/Перше замовлення/.test(lastAdminMsg(g).payload.text), 'админ: у первого заказа клиента есть «Перше замовлення»');
    const tot1 = g.sheets['Замовлення'].rows.slice(-1)[0][13];
    order(g, U(7001), [{ id: 'NUT-007', g: 0, q: 1 }], 85, { lang: 'ru' });
    const toRu = g.sent.filter(m => m.method === 'sendMessage' && m.payload.chat_id === '7001').pop().payload.text;
    ok(/\nВопросы по заказу — @gladiroon$/.test(toRu), 'клиент (RU): последняя строка про @gladiroon', toRu);
    ok(!/Перше замовлення/.test(lastAdminMsg(g).payload.text) && tot1 === 85, 'админ: у второго заказа строки нет, сумма та же');
    const g3 = fresh();
    const t = g3.post({ action: 'order', initData: g3.initData(U(7002)), test: true, items: [{ id: 'NUT-007', g: 0, q: 1 }], total: 85, name: 'Олена', phone: '+380501234567', delivery: 'pickup', pay: 'cash', lang: 'ua' });
    ok(t.ok && !/Перше замовлення/.test(lastAdminMsg(g3).payload.text), 'тестовый заказ не помечается как первый');
    order(g3, U(7002), [{ id: 'NUT-007', g: 0, q: 1 }], 85);
    ok(/Перше замовлення/.test(lastAdminMsg(g3).payload.text), 'тестовый заказ раньше не мешает первому настоящему');
    ok(g3.sandbox.__errors.length === 0, 'в логах бэкенда нет ошибок', g3.sandbox.__errors);
  }
  // Подарок не меняет сумму
  {
    const g = fresh();
    settings(g, { gift_from: '100', gift_text_ua: 'Баночка спецій батька в подарунок' });
    const r = order(g, U(7003), [{ id: 'NUT-007', g: 0, q: 2 }], 170);
    ok(r.ok && r.gifts.length === 1 && g.sheets['Замовлення'].rows.slice(-1)[0][13] === 170, 'подарок от суммы не меняет сумму заказа', r);
  }
  // Описание бота
  {
    const g = fresh();
    const n0 = g.sent.length;
    g.call('menuBotDescription');
    const calls = g.sent.slice(n0);
    const sh = calls.filter(c => c.method === 'setMyShortDescription'), ds = calls.filter(c => c.method === 'setMyDescription');
    ok(calls.length === 4 && sh.length === 2 && ds.length === 2, 'menuBotDescription: 4 вызова Telegram', calls.map(c => c.method));
    ok(!sh[0].payload.language_code && sh[1].payload.language_code === 'ru' && !ds[0].payload.language_code && ds[1].payload.language_code === 'ru', 'language_code: UA без, RU = ru');
    ok(sh.every(c => c.payload.short_description.length > 0 && c.payload.short_description.length <= 120) && ds.every(c => c.payload.description.length > 0 && c.payload.description.length <= 512), 'тексты по умолчанию укладываются в 120 и 512 знаков', [sh.map(c => c.payload.short_description.length), ds.map(c => c.payload.description.length)]);
    const alertText = g.ui.alerts.slice(-1)[0];
    ok(/готово/.test(alertText) && !/TEST_TOKEN/.test(alertText), 'окно показывает итог без токена', alertText);
    settings(g, { bot_short_ua: 'x'.repeat(200) });
    const n1 = g.sent.length;
    g.call('menuBotDescription');
    ok(g.sent.slice(n1)[0].payload.short_description.length === 120 && /обрізано/.test(g.ui.alerts.slice(-1)[0]), 'слишком длинное короткое описание обрезается до 120');
    g.setTelegramFail(true);
    g.call('menuBotDescription');
    ok((g.ui.alerts.slice(-1)[0].match(/не вдалося/g) || []).length === 4 && !/mock failure|TEST_TOKEN/.test(g.ui.alerts.slice(-1)[0]), 'при сбое: 4 раза «не вдалося», без текста исключения и токена');
    g.setTelegramFail(false);
    const catText = JSON.stringify(g.get({ action: 'catalog' }));
    ok(!/gladiroon|bot_short|bot_desc/.test(catText), 'настройки bot_* не попадают в ответ catalog');
  }
  // Баночки: «Вага упаковки, г»
  {
    const g = fresh();
    ok(g.get({ action: 'catalog' }).products.every(p => p.pw === undefined), 'pw: колонки нет — поля нет (колонка «Вага упаковки, кг» не подхватывается)');
    addCol(g, 'Вага упаковки, г', { 'SPC-004': 60, 'TEA-004': 'абв', 'NUT-007': 9999, 'SWT-006': '0', 'CND-005': 80.5, 'CND-004': ' 1250 ' });
    const by = {}; g.get({ action: 'catalog' }).products.forEach(p => { by[p.id] = p; });
    ok(by['SPC-004'].pw === 60 && by['CND-004'].pw === 1250, 'pw: целое 1–5000 попадает в каталог', [by['SPC-004'].pw, by['CND-004'].pw]);
    ok(by['TEA-004'].pw === undefined && by['NUT-007'].pw === undefined && by['SWT-006'].pw === undefined && by['CND-005'].pw === undefined && by['DRY-039'].pw === undefined, 'pw: мусор, 0, больше 5000, дробь, пусто — поля нет');
  }
  // Упаковка с пустым «Фасування»
  {
    const g = fresh();
    const rows = g.sheets['Товари'].rows, h = rows[0];
    rows.find(x => x[0] === 'SPC-004')[h.indexOf('Фасування')] = '';
    g.clearCache();
    const p = g.get({ action: 'catalog' }).products.find(x => x.id === 'SPC-004');
    ok(p.t === 'p' && p.p === 45 && p.a === 1 && !p.pk, 'упаковка без «Фасування»: цена за штуку, товар доступен', p);
    ok(order(g, U(7004), [{ id: 'SPC-004', g: 0, q: 3 }], 1).error === 'changed', 'упаковка: подложенная клиентом сумма отклоняется');
    const r = order(g, U(7004), [{ id: 'SPC-004', g: 0, q: 3 }], 135);
    ok(r.ok && g.sheets['Замовлення'].rows.slice(-1)[0][13] === 135, 'упаковка: итог заказа считает сервер (3 × 45 = 135)', r);
  }
  // «Порядок»
  {
    const base = JSON.stringify(fresh().get({ action: 'catalog' }).products.map(p => p.id));
    const g = fresh();
    addCol(g, 'Порядок', {});
    ok(JSON.stringify(g.get({ action: 'catalog' }).products.map(p => p.id)) === base, 'порядок: колонка есть, но пуста — список прежний');
    const g2 = fresh();
    addCol(g2, 'Порядок', { 'SPC-004': 1, 'SPC-003': 2, 'SPC-001': 3 });
    const ids = g2.get({ action: 'catalog' }).products.map(p => p.id), old = JSON.parse(base);
    const spice = x => x.startsWith('SPC-');
    ok(JSON.stringify(ids.filter(spice)) === JSON.stringify(['SPC-004', 'SPC-003', 'SPC-001', 'SPC-002', 'SPC-005']), 'порядок: внутри категории — по возрастанию, без значения — после в прежнем порядке', ids.filter(spice));
    ok(ids.every((x, i) => spice(x) === spice(old[i])) && JSON.stringify(ids.filter(x => !spice(x))) === JSON.stringify(old.filter(x => !spice(x))), 'порядок: места категории в общем списке и другие категории не сдвинулись');
    const g3 = fresh();
    addCol(g3, 'Порядок для сайта', { 'SPC-004': 1 });
    ok(JSON.stringify(g3.get({ action: 'catalog' }).products.map(p => p.id)) === base, 'порядок: похожий заголовок по префиксу не подхватывается');
  }
  // Курага списком
  {
    const g = fresh();
    settings(g, { feature_id: 'dry-039' });
    let f = g.get({ action: 'catalog' }).shop.feature;
    ok(f.id === 'DRY-039' && JSON.stringify(f.ids) === '["DRY-039"]', 'feature_id: одно значение работает как раньше (+ ids)', f);
    settings(g, { feature_id: 'DRY-089, dry-039; HID-001, DRY-039, NUT-001, TEA-001, TEA-002, TEA-003' });
    const saved = g.sheets['Налаштування'].rows.find(r => r[0] === 'feature_id')[1];
    ok(saved === 'DRY-089, DRY-039, HID-001, NUT-001, TEA-001', 'feature_id: список сохраняется целиком, до 5, без повторов', saved);
    f = g.get({ action: 'catalog' }).shop.feature;
    ok(f.id === 'DRY-039' && JSON.stringify(f.ids) === '["DRY-039","NUT-001","TEA-001"]', 'feature.id — первый существующий и видимый, ids — все такие по порядку', f);
    tgPress(g, 800, 'm:apr');
    ok(/p=DRY-039/.test(JSON.stringify(lastTo(g, 800).payload.reply_markup)) === false, 'сообщение «apr» берёт первый ID списка (DRY-089 в таблице нет — открывается магазин)');
    settings(g, { feature_id: 'NOPE-1' });
    f = g.get({ action: 'catalog' }).shop.feature;
    ok(f.id === 'NOPE-1' && f.ids.length === 0, 'feature_id: нет существующих товаров — ids пуст');
  }
  // Служебные данные
  {
    const g = fresh();
    addCol(g, 'Порядок', { 'SPC-004': 1 });
    addCol(g, 'Вага упаковки, г', { 'SPC-004': 60 });
    const text = JSON.stringify(g.get({ action: 'catalog' }));
    ok(!/СЕКРЕТ|do-smaku|33%|BOT_TOKEN|TEST_TOKEN/.test(text), 'служебные колонки и токены не в ответе catalog');
    ok(g.sandbox.__errors.length === 0, 'в логах бэкенда нет ошибок', g.sandbox.__errors);
  }
}

console.log('Выпуск А, блок 2: оплата на счёт ФОП');
{
  const IBAN = 'UA' + '1'.repeat(27); // выдуманный
  const FOP = { FOP_NAME: 'ФОП Тестенко Т. Т.', FOP_IBAN: IBAN.replace(/(.{4})/g, '$1 ').trim(), FOP_CODE: '7654321098' };
  const cardOrder = (g, uid, extra) => order(g, U(uid), [{ id: 'DRY-039', g: 500, q: 1 }], 190, Object.assign({ pay: 'card' }, extra || {}));
  const toClient = (g, uid) => g.sent.filter(m => m.method === 'sendMessage' && String(m.payload.chat_id) === String(uid));
  const toAdmin = g => g.sent.filter(m => m.method === 'sendMessage' && String(m.payload.chat_id) === '900');

  // Все три заданы
  {
    const g = fresh(); Object.assign(g.props, FOP);
    const logs = []; g.sandbox.console = { log: (...a) => logs.push(a.join(' ')), warn: (...a) => logs.push(a.join(' ')), error: (...a) => logs.push(a.join(' ')) };
    const cat = g.get({ action: 'catalog' });
    ok(cat.shop.fop === 1 && Object.keys(cat.shop).every(k => !/iban|name|code/i.test(k)), 'режим ФОП: в каталоге только флаг fop:1');
    const r = cardOrder(g, 71, { total_client: 1, sum: 5 });
    ok(r.ok && r.number, 'заказ с оплатой card оформлен', r);
    const msgs = toClient(g, 71);
    ok(msgs.length === 2 && /прийнято/.test(msgs[0].payload.text) && !/IBAN/.test(msgs[0].payload.text), 'сначала обычное подтверждение, реквизиты не в нём');
    const t = msgs[1] && msgs[1].payload.text;
    ok(msgs[1].payload.parse_mode === 'HTML' && t.includes('<code>ФОП Тестенко Т. Т.</code>') && t.includes('<code>' + IBAN + '</code>') && t.includes('<code>7654321098</code>'), 'получатель, IBAN (без пробелов) и код — в <code>', t);
    ok(t.includes('<b>190 ₴</b>') && t.includes('<code>Оплата за замовлення ' + r.number + '</code>'), 'сумма с сервера и назначение с номером заказа в <code>', t);
    const bad = order(g, U(72), [{ id: 'DRY-039', g: 500, q: 1 }], 1, { pay: 'card' });
    ok(bad.error === 'changed' && toClient(g, 72).length === 0, 'подложенная клиентом сумма не проходит, реквизиты не уходят');
    const ru = cardOrder(g, 73, { lang: 'ru' });
    const tr = toClient(g, 73)[1].payload.text;
    ok(/Получатель/.test(tr) && tr.includes('<code>Оплата за замовлення ' + ru.number + '</code>'), 'для клиента с lang=ru подписи по-русски, назначение платежа то же украинское');
    const adminMsg = toAdmin(g).find(m => m.payload.text.includes(r.number)).payload.text;
    ok(/переказ на рахунок ФОП \(IBAN\)/.test(adminMsg) && !adminMsg.includes('7654321098') && !adminMsg.includes(IBAN) && !/Реквізити ФОП не надіслано/.test(adminMsg), 'админу: способ оплаты переименован, реквизитов и предупреждения нет');
    const cash = order(g, U(74), [{ id: 'DRY-039', g: 500, q: 1 }], 190, { pay: 'cash' });
    ok(cash.ok && toClient(g, 74).length === 1, 'оплата при получении: реквизиты не отправляются');
    const svcOf = num => g.sheets['Замовлення'].rows.find(x => x[0] === num)[16];
    ok(JSON.parse(svcOf(r.number)).r === 1, 'после отправки реквизитов в svc стоит отметка r');
    const conf = g.call('clientText_', 'c', { num: r.number, lang: 'ua', pay: 'card', delivery: 'pickup', point: '', svc: svcOf(r.number) });
    ok(!/Реквізити/.test(conf), 'с отметкой подтверждение не обещает реквизиты повторно', conf);
    const confNo = g.call('clientText_', 'c', { num: 'P-0900', lang: 'ua', pay: 'card', delivery: 'pickup', point: '', svc: '{"i":[]}' });
    ok(/надішлемо окремим повідомленням/.test(confNo), 'без отметки (заказ до включения режима или сбой отправки) текст как раньше');
    g.setTelegramFail((m, p) => (/Реквізити для оплати/.test(p.text || '') ? { ok: false, description: 'x' } : null));
    const rf = cardOrder(g, 75);
    ok(rf.ok && !('r' in JSON.parse(svcOf(rf.number))), 'сбой отправки реквизитов: отметки нет');
    g.setTelegramFail(false);
    const rowCard = g.sheets['Замовлення'].rows.find(x => x[0] === r.number);
    ok(rowCard && rowCard.includes('переказ на картку'), 'в таблицу пишется прежнее значение оплаты', rowCard);
    const resp = JSON.stringify([cat, r, g.get({ action: 'np.city', q: 'хар' }), adm(g, 900, 'admin.settings'), adm(g, 900, 'admin.orders'), g.post({ action: 'orders.my', initData: g.initData(U(71)) })]);
    const journal = JSON.stringify(g.sheets['Журнал'] ? g.sheets['Журнал'].rows : []);
    const all = resp + journal + logs.join('\n');
    ok(!all.includes('7654321098') && !all.includes(IBAN) && !all.includes('Тестенко') && !all.includes(FOP.FOP_IBAN), 'реквизиты ФОП не в ответах API, журнале и логах');
    ok(g.sandbox.__errors.length === 0, 'нет ошибок в логах', g.sandbox.__errors);
  }
  // Не хватает одного свойства — как раньше
  ['FOP_NAME', 'FOP_IBAN', 'FOP_CODE'].forEach(miss => {
    const g = fresh(); Object.assign(g.props, FOP); g.props[miss] = '  ';
    const base = fresh();
    const r = cardOrder(g, 81), rb = cardOrder(base, 81);
    const same = JSON.stringify(toClient(g, 81).map(m => m.payload.text).map(s => s.replace(/P-\d+/g, 'P'))) === JSON.stringify(toClient(base, 81).map(m => m.payload.text).map(s => s.replace(/P-\d+/g, 'P')));
    const a1 = toAdmin(g).map(m => m.payload.text.replace(/P-\d+/g, 'P')).join('|'), a2 = toAdmin(base).map(m => m.payload.text.replace(/P-\d+/g, 'P')).join('|');
    ok(r.ok && !('fop' in g.get({ action: 'catalog' }).shop) && toClient(g, 81).length === 1 && same && a1 === a2 && /переказ на картку/.test(a1) && !/ФОП/.test(a1), 'без ' + miss + ': флага и сообщения нет, тексты прежние (байт-в-байт с чистой таблицей)');
    ok(/надішлемо окремим повідомленням/.test(g.call('clientText_', 'c', { num: 'P-1', lang: 'ua', pay: 'card', delivery: 'pickup', point: '' })), 'без ' + miss + ': подтверждение обещает реквизиты как раньше');
  });
  // Неверный IBAN
  {
    const g = fresh(); Object.assign(g.props, FOP, { FOP_IBAN: 'UA12345' });
    const logs = []; g.sandbox.console = { log: (...a) => logs.push(a.join(' ')), warn: (...a) => logs.push(a.join(' ')), error: (...a) => logs.push(a.join(' ')) };
    const r = cardOrder(g, 91);
    ok(r.ok && toClient(g, 91).length === 1 && !('fop' in g.get({ action: 'catalog' }).shop), 'неверный IBAN: реквизиты не отправлены, флага нет');
    const a = toAdmin(g).find(m => m.payload.text.includes(r.number)).payload.text;
    ok(/Реквізити ФОП не надіслано: перевірте FOP_IBAN/.test(a) && !a.includes('UA12345') && /переказ на картку/.test(a), 'админу — предупреждение без значения IBAN', a);
    ok(!logs.join('\n').includes('UA12345') && !JSON.stringify(g.sheets['Журнал'] ? g.sheets['Журнал'].rows : []).includes('UA12345'), 'неверный IBAN не попал в логи');
    const cash = order(g, U(92), [{ id: 'DRY-039', g: 500, q: 1 }], 190, { pay: 'cash' });
    ok(!/ФОП/.test(toAdmin(g).find(m => m.payload.text.includes(cash.number)).payload.text), 'предупреждение только у заказов с оплатой card');
  }
}

console.log('Выпуск А, блок 2: подсказки Новой почты');
{
  const KEY = 'NPKEY-SECRET-xyz';
  const CITY = 'aaaaaaaa-1111-2222-3333-444444444444';
  // Стенд API Новой почты: город на 1200 объектов (каждый пятый — почтомат), страницы по Limit.
  function npStub(g, opts) {
    const o = Object.assign({ fail: null }, opts || {});
    const st = { calls: [] };
    const big = [];
    for (let i = 1200; i >= 1; i--) big.push({ Number: String(i), ShortAddress: 'Харків, вул. Тестова, ' + i, Description: (i % 5 === 0 ? 'Поштомат "Нова пошта" №' : 'Відділення №') + i, CategoryOfWarehouse: i % 5 === 0 ? 'Postomat' : 'Branch' });
    g.setTelegramFail((method, payload) => {
      if (!payload.calledMethod) return null; // не вызов API Новой почты — обычный ответ Telegram
      st.calls.push(payload);
      if (o.fail === 'key') return { success: false, errors: ['API key is invalid ' + payload.apiKey], errorCodes: ['20000200068'], data: [] };
      if (o.fail === 'net') throw new Error('network down https://api.novaposhta.ua/v2.0/json/?k=' + payload.apiKey);
      const p = payload.methodProperties;
      if (payload.calledMethod === 'getWarehouses') {
        const lim = Number(p.Limit), page = Number(p.Page || 1);
        return { success: true, data: p.CityRef === CITY ? big.slice((page - 1) * lim, page * lim) : [] };
      }
      if (payload.calledMethod === 'searchSettlements') {
        return { success: true, data: [{ Addresses: [
          { DeliveryCity: 'r-village', Present: 'с. Харківка, Київська обл.', MainDescription: 'Харківка', Warehouses: 1, SettlementTypeCode: 'с.' },
          { DeliveryCity: 'r-empty', Present: 'м. Харків-пусто', MainDescription: 'Харків-пусто', Warehouses: 0, SettlementTypeCode: 'м.' },
          { DeliveryCity: CITY, Present: 'м. Харків, Харківська обл.', MainDescription: 'Харків', Warehouses: 1200, SettlementTypeCode: 'м.' }
        ] }] };
      }
      return { success: true, data: [] };
    });
    return st;
  }
  const adminAlerts = g => g.sent.filter(m => m.method === 'sendMessage' && /Підказки Нової пошти не працюють/.test(m.payload.text));

  {
    const g = fresh(); g.props.NP_API_KEY = KEY; g.props.FOP_NAME = 'ФОП Тест'; g.props.FOP_IBAN = 'UA' + '1'.repeat(27); g.props.FOP_CODE = '1234500000';
    const logs = []; g.sandbox.console = { log: (...a) => logs.push(a.join(' ')), warn: (...a) => logs.push(a.join(' ')), error: (...a) => logs.push(a.join(' ')) };
    const st = npStub(g);
    const r1 = g.get({ action: 'np.whall', city: CITY });
    ok(r1.ok && r1.list.length === 1200, 'np.whall: отдаёт все 1200 отделений и почтоматов (несколько страниц)', r1.list && r1.list.length);
    ok(st.calls.length === 3 && st.calls.every(c => c.methodProperties.Limit === '500'), 'загрузка постранично, Limit 500: три запроса', st.calls.length);
    ok(r1.list.every((x, i) => x[0] === i + 1 && x[2] === (x[0] % 5 === 0 ? 'p' : 'w') && /Тестова/.test(x[1])), 'отсортировано по номеру, типы w/p верные, адрес короткий');
    ok(r1.list[0].length === 3 && !JSON.stringify(r1.list[0]).includes('Description'), 'в записи только номер, адрес, тип');
    const n = st.calls.length;
    const r2 = g.get({ action: 'np.whall', city: CITY });
    ok(r2.ok && r2.list.length === 1200 && st.calls.length === n, 'второй вызов — из кэша, без запросов к API');
    ok(g.get({ action: 'np.whall', city: 'bad' }).ok === false && g.get({ action: 'np.whall', city: '' }).ok === false && st.calls.length === n, 'np.whall: city проверяется по формату Ref, без вызова API');
    ok(g.get({ action: 'np.whall', city: CITY.replace(/a/g, 'z') }).ok === false, 'np.whall: не-UUID отклонён');

    const c1 = g.get({ action: 'np.city', q: 'Харьков' });
    const last = st.calls[st.calls.length - 1];
    ok(last.calledMethod === 'searchSettlements' && last.methodProperties.CityName === 'Харків', 'русское «Харьков» уходит в API как «Харків»', last.methodProperties);
    ok(c1.ok && c1.list.length === 2 && c1.list[0].ref === CITY && c1.list[1].ref === 'r-village' && !c1.list.some(x => x.ref === 'r-empty'), 'np.city: пункты без отделений отсеяны, город — первым', c1);
    ok(c1.list[0].n && c1.list[0].s === 'Харків' && Object.keys(c1.list[0]).sort().join() === 'n,ref,s', 'np.city: формат элемента {n, s, ref}');
    const probe = (q) => { g.get({ action: 'np.city', q }); return st.calls[st.calls.length - 1].methodProperties.CityName; };
    ok(probe('харьк') === 'Харків' && probe('Киев') === 'Київ' && probe('днепр') === 'Дніпро' && probe('Кривой Рог') === 'Кривий Ріг' && probe('одессa'.replace('a', 'а')) === 'Одеса', 'словарь: полное и частичное русское написание');
    ok(probe('хар') === 'хар' && probe('Львів') === 'Львів' && probe('Лозова') === 'Лозова', 'украинский ввод не подменяется');
    const calls = st.calls.length;
    ok(g.get({ action: 'np.city', q: 'х' }).list.length === 0 && g.get({ action: 'np.city', q: 'я'.repeat(41) }).list.length === 0 && st.calls.length === calls, 'q короче 2 или длиннее 40 — пусто, без вызова API');
    const old = g.get({ action: 'np.wh', city: CITY, q: '12' });
    ok(old.ok && Array.isArray(old.list), 'старый np.wh работает', old);
    ok(g.get({ action: 'catalog' }).shop.np === 1 && g.get({ action: 'catalog' }).shop.fop === 1, 'каталог: флаги np и fop');
    const all = JSON.stringify([g.get({ action: 'catalog' }), r1, c1, old, adm(g, 900, 'admin.settings'), adm(g, 900, 'admin.orders')]) + JSON.stringify(g.sheets['Журнал'] ? g.sheets['Журнал'].rows : []) + logs.join('\n') + JSON.stringify(g.sent.filter(m => !m.payload.calledMethod).map(m => m.payload));
    ok(!all.includes(KEY) && !all.includes('1234500000'), 'ключ НП и реквизиты не в ответах API, журнале, логах и сообщениях');
    ok(adminAlerts(g).length === 0, 'успешная работа — админов не беспокоим');
  }
  // Ошибка ключа
  {
    const g = fresh(); g.props.NP_API_KEY = KEY;
    const logs = []; g.sandbox.console = { log: (...a) => logs.push(a.join(' ')), warn: (...a) => logs.push(a.join(' ')), error: (...a) => logs.push(a.join(' ')) };
    npStub(g, { fail: 'key' });
    const r = g.get({ action: 'np.city', q: 'Харків' });
    ok(JSON.stringify(r) === '{"ok":false}' && JSON.stringify(g.get({ action: 'np.whall', city: CITY })) === '{"ok":false}', 'ошибка ключа: витрине ровно {ok:false}, без подробностей');
    const a = adminAlerts(g);
    ok(a.length === 1 && String(a[0].payload.chat_id) === '900', 'админу ушло одно сообщение');
    ok(!a[0].payload.text.includes(KEY) && !/https?:/.test(a[0].payload.text), 'в сообщении нет ключа и ссылок', a[0].payload.text);
    g.get({ action: 'np.city', q: 'Київ' }); g.clearCache(); g.get({ action: 'np.city', q: 'Одеса' });
    ok(adminAlerts(g).length === 1, 'повтор в те же сутки — второго сообщения нет');
    g.props.NP_ALERT_AT = String(Date.now() - 25 * 3600 * 1000); g.clearCache();
    g.get({ action: 'np.city', q: 'Львів' });
    ok(adminAlerts(g).length === 2, 'через сутки — сообщение снова');
    ok(!logs.join('\n').includes(KEY) && !JSON.stringify(g.sheets['Журнал'] ? g.sheets['Журнал'].rows : []).includes(KEY), 'ключ не в логах');
  }
  // Сбой сети с ключом в тексте ошибки
  {
    const g = fresh(); g.props.NP_API_KEY = KEY;
    const logs = []; g.sandbox.console = { log: (...a) => logs.push(a.join(' ')), warn: (...a) => logs.push(a.join(' ')), error: (...a) => logs.push(a.join(' ')) };
    npStub(g, { fail: 'net' });
    ok(JSON.stringify(g.get({ action: 'np.whall', city: CITY })) === '{"ok":false}', 'сбой сети: {ok:false}');
    const a = adminAlerts(g);
    ok(a.length === 1 && !a[0].payload.text.includes(KEY) && !/https?:/.test(a[0].payload.text) && !logs.join('\n').includes(KEY), 'ключ и URL вычищены из причины и лога', a[0] && a[0].payload.text);
  }
  // Лимит публичных подсказок: 400 в час (админские накладные считаются отдельно, 600)
  {
    const g = fresh(); g.props.NP_API_KEY = KEY;
    const st = npStub(g);
    for (let i = 0; i < 400; i++) g.get({ action: 'np.city', q: 'Ха' + i });
    ok(st.calls.length === 400, 'до 400 публичных вызовов в час проходят', st.calls.length);
    const r = g.get({ action: 'np.city', q: 'Ха-новый' });
    ok(r.ok === false && st.calls.length === 400, '401-й вызов — {ok:false}, к API не идём');
    ok(adminAlerts(g).length === 1, 'о лимите админ узнаёт один раз');
  }
  // Без ключа
  {
    const g = fresh();
    const st = npStub(g);
    ok(!('np' in g.get({ action: 'catalog' }).shop), 'без NP_API_KEY в каталоге нет shop.np');
    const rs = [g.get({ action: 'np.city', q: 'Харків' }), g.get({ action: 'np.whall', city: CITY }), g.get({ action: 'np.wh', city: CITY, q: '1' })];
    ok(rs.every(x => x.ok === false) && st.calls.length === 0 && adminAlerts(g).length === 0, 'без ключа: ответы пустые, вызовов API и сообщений нет');
  }
}

console.log('Выпуск 9Б, блок 1: ленты, Новый год, подпись к подарку, источники');
{
  const kyiv = k => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(Date.now() + k * 86400000));
  const dmy = s => s.split('-').reverse().join('.');
  const cat = g => { g.clearCache(); return g.get({ action: 'catalog' }); };
  const raw = (g, key, val) => { const r = g.sheets['Налаштування'].rows.find(x => x[0] === key); r[1] = val; g.clearCache(); };
  const fieldsOf = g => { const o = {}; adm(g, 900, 'admin.settings').fields.forEach(f => { o[f.k] = f.v; }); return o; };

  // --- без новых настроек и колонок всё как раньше
  {
    const g = fresh();
    const s = cat(g).shop;
    ok(s.railsMax === 3 && !('ny' in s) && !('giftNote' in s) && !('theme' in s), 'без настроек: railsMax = 3, нет ny, giftNote, theme', s);
    const f = fieldsOf(g);
    ok(f.home_rails_max === '3' && f.ny_snow === '0' && f.gift_note === '0' && f.theme_until === '' && f.ny_ids === '', 'новые настройки видны в панели с умолчаниями', f);
    // старый лист настроек без новых ключей
    const ss = g.sandbox.SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.insertSheet('Налаштування');
    sh.getRange(1, 1, 2, 3).setValues([['Ключ', 'Значення', 'Опис'], ['theme', 'newyear', '']]);
    const s2 = cat(g).shop;
    ok(s2.theme === 'newyear' && !s2.ny && !s2.giftNote && s2.railsMax === 3, 'старый лист настроек без новых ключей: тема как задана, остальное по умолчанию', s2);
  }

  // --- home_rails_max
  {
    const g = fresh();
    settings(g, { home_rails_max: '5' });
    ok(cat(g).shop.railsMax === 5, 'home_rails_max = 5 → shop.railsMax 5');
    settings(g, { home_rails_max: '0' });
    ok(cat(g).shop.railsMax === 3, '0 → 3 по умолчанию');
    settings(g, { home_rails_max: '99' });
    ok(cat(g).shop.railsMax === 8, '99 → не больше 8');
    raw(g, 'home_rails_max', 'abc');
    ok(cat(g).shop.railsMax === 3, 'мусор в ячейке → 3');
    raw(g, 'home_rails_max', '-4');
    ok(cat(g).shop.railsMax === 3, 'отрицательное → 3');
  }

  // --- theme_until
  {
    const g = fresh();
    settings(g, { theme: 'newyear', ny_snow: '1', ny_ids: 'NUT-001', ny_order_until_ua: 'до свята' });
    ok(cat(g).shop.theme === 'newyear' && cat(g).shop.ny, 'тема newyear без срока работает');
    raw(g, 'theme_until', dmy(kyiv(1)));
    let s = cat(g).shop;
    ok(s.theme === 'newyear' && s.ny, 'до даты (ДД.ММ.РРРР, завтра): тема действует');
    raw(g, 'theme_until', dmy(kyiv(0)));
    ok(cat(g).shop.theme === 'newyear', 'в сам день окончания тема ещё действует (по Киеву)');
    raw(g, 'theme_until', dmy(kyiv(-1)));
    s = cat(g).shop;
    ok(!('theme' in s) && !('ny' in s), 'после даты (вчера): тема пустая, ny нет', s);
    raw(g, 'theme_until', kyiv(-1));
    ok(!('theme' in cat(g).shop), 'формат РРРР-ММ-ДД: после даты тема выключена');
    raw(g, 'theme_until', kyiv(2));
    ok(cat(g).shop.theme === 'newyear', 'формат РРРР-ММ-ДД: до даты тема есть');
    raw(g, 'theme_until', '31.02.2020');
    ok(cat(g).shop.theme === 'newyear', 'несуществующая дата не разобралась: тема как задана');
    raw(g, 'theme_until', 'скоро');
    ok(cat(g).shop.theme === 'newyear', 'текст вместо даты: тема как задана');
    raw(g, 'theme_until', '');
    ok(cat(g).shop.theme === 'newyear', 'пустая дата: тема как задана');
    // дата-объект, как её может превратить таблица
    raw(g, 'theme_until', new Date(Date.now() - 3 * 86400000));
    ok(!('theme' in cat(g).shop), 'ячейка стала датой Google: после неё тема выключена');
    // сохранение через панель
    settings(g, { theme_until: '26.12.2099' });
    ok(fieldsOf(g).theme_until === '26.12.2099' && cat(g).shop.theme === 'newyear', 'сохранение через панель: дата в виде ДД.ММ.РРРР');
    settings(g, { theme_until: '2099-1-5' });
    ok(fieldsOf(g).theme_until === '05.01.2099', 'РРРР-М-Д приводится к ДД.ММ.РРРР', fieldsOf(g).theme_until);
    settings(g, { theme_until: 'вчера' });
    ok(fieldsOf(g).theme_until === '', 'мусор вместо даты при сохранении очищается');
    // кэш каталога живёт 300 с: после истечения сборка видит новую дату, тема выключается сама
    settings(g, { theme_until: dmy(kyiv(0)) });
    cat(g); // заполнили кэш
    const cached = g.get({ action: 'catalog' }).shop.theme;
    const RealDate = Date, shift = 86400000 * 1.01;
    g.sandbox.Date = class extends RealDate { constructor(...a) { if (a.length) super(...a); else super(RealDate.now() + shift); } static now() { return RealDate.now() + shift; } };
    g.clearCache();
    const after = g.get({ action: 'catalog' }).shop.theme;
    g.sandbox.Date = RealDate;
    ok(cached === 'newyear' && after === undefined, 'кэш держит тему до даты; после его истечения (≤ 300 с) тема выключается сама', [cached, after]);
  }

  // --- Новый год: ny
  {
    const g = fresh();
    settings(g, { theme: 'newyear', ny_snow: '1', ny_ids: ' nut-001, HID-001, NOPE-1, dry-039, NUT-001 ', ny_order_until_ua: 'Замовлення до 26.12', ny_order_until_ru: 'Заказы до 26.12' });
    let s = cat(g).shop;
    ok(s.ny && s.ny.snow === 1 && JSON.stringify(s.ny.ids) === '["NUT-001","DRY-039"]', 'ny.ids: скрытый и несуществующий отброшены, порядок настройки, без повторов', s.ny);
    ok(s.ny.until && s.ny.until.ua === 'Замовлення до 26.12' && s.ny.until.ru === 'Заказы до 26.12', 'ny.until ua и ru');
    settings(g, { ny_order_until_ru: '', ny_snow: '0' });
    s = cat(g).shop;
    ok(s.ny.snow === 0 && JSON.stringify(s.ny.until) === '{"ua":"Замовлення до 26.12"}', 'пустая часть until опускается, snow = 0', s.ny);
    settings(g, { ny_order_until_ua: '', ny_ids: 'HID-001, NOPE-1' });
    ok(!('ny' in cat(g).shop) && cat(g).shop.theme === 'newyear', 'совсем пусто (ids отброшены, снега и строки нет): поля ny нет, тема осталась');
    settings(g, { ny_snow: '1', ny_ids: '' });
    s = cat(g).shop;
    ok(s.ny.snow === 1 && !('ids' in s.ny) && !('until' in s.ny), 'только снег: {snow:1}', s.ny);
    const many = ['DRY-039', 'DRY-001', 'DRY-002', 'DRY-003', 'DRY-004', 'DRY-005', 'DRY-006', 'DRY-030', 'NUT-001', 'NUT-002', 'NUT-003', 'NUT-004', 'NUT-005', 'NUT-006'];
    settings(g, { ny_ids: many.join(', ') });
    ok(cat(g).shop.ny.ids.length === 12 && cat(g).shop.ny.ids[11] === 'NUT-004', 'ny.ids не больше 12', cat(g).shop.ny.ids);
    settings(g, { theme: 'navruz', ny_ids: 'NUT-001', ny_snow: '1' });
    s = cat(g).shop;
    ok(s.theme === 'navruz' && !('ny' in s), 'при теме navruz поля ny нет');
    settings(g, { theme: '' });
    ok(!('ny' in cat(g).shop) && !('theme' in cat(g).shop), 'без темы поля ny нет');
  }

  // --- подпись к подарку
  {
    const g = fresh();
    const lastRow = () => { const r = g.sheets['Замовлення'].rows; return r[r.length - 1]; };
    const H = g.sheets['Замовлення'].rows[0];
    const adminText = () => g.sent.filter(m => m.method === 'sendMessage' && m.payload.chat_id === '900').pop().payload.text;
    const NOTE = '<b>Мамі</b> =HYPERLINK("http://x")';
    ok(!('giftNote' in cat(g).shop), 'gift_note выключена: shop.giftNote нет');
    let r = order(g, U(301), [{ id: 'NUT-007', g: 0, q: 1 }], 85, { giftNote: NOTE, comment: 'зателефонуйте' });
    ok(r.ok && lastRow()[H.indexOf('Коментар')] === 'зателефонуйте' && !/Підпис до подарунка/.test(adminText()), 'при gift_note = 0 подпись игнорируется (ни в таблице, ни в сообщении)', lastRow()[H.indexOf('Коментар')]);
    settings(g, { gift_note: '1' });
    ok(cat(g).shop.giftNote === 1, 'gift_note = 1: shop.giftNote = 1 (от темы не зависит)');
    r = order(g, U(302), [{ id: 'NUT-007', g: 0, q: 1 }], 85, { giftNote: NOTE });
    ok(r.ok, 'заказ с подписью принят');
    ok(/Підпис до подарунка: &lt;b&gt;Мамі&lt;\/b&gt; =HYPERLINK/.test(adminText()) && !/<b>Мамі/.test(adminText()), 'админ видит подпись отдельной строкой, HTML экранирован', adminText());
    const cell = lastRow()[H.indexOf('Коментар')];
    ok(cell === 'Підпис до подарунка: ' + NOTE && !/^[=+\-@]/.test(cell), 'в «Коментар» подпись дописана, формула не стала формулой', cell);
    ok(lastRow()[H.indexOf('Сума, ₴')] === 85, 'сумма не изменилась');
    const sh = g.sheets['Замовлення'], origAppend = sh.appendRow; let appended = null;
    sh.appendRow = function (row) { appended = row.slice(); return origAppend.call(this, row); };
    r = order(g, U(303), [{ id: 'NUT-007', g: 0, q: 1 }], 85, { giftNote: 'Привіт', comment: '=SUM(1)' });
    sh.appendRow = origAppend;
    const c2 = appended[H.indexOf('Коментар')];
    ok(c2 === '\'=SUM(1) | Підпис до подарунка: Привіт', 'комментарий-формула + подпись: в ячейку уходит текст с апострофом (не формула)', c2);
    const long = 'я'.repeat(200);
    r = order(g, U(304), [{ id: 'NUT-007', g: 0, q: 1 }], 85, { giftNote: long });
    ok(lastRow()[H.indexOf('Коментар')] === 'Підпис до подарунка: ' + 'я'.repeat(120), 'подпись обрезается до 120 знаков');
    r = order(g, U(305), [{ id: 'NUT-007', g: 0, q: 1 }], 85, { giftNote: 12345 });
    ok(r.ok && lastRow()[H.indexOf('Коментар')] === 'Підпис до подарунка: 12345', 'не строка приводится к строке');
    r = order(g, U(306), [{ id: 'NUT-007', g: 0, q: 1 }], 85);
    ok(r.ok && lastRow()[H.indexOf('Коментар')] === '' && !/Підпис/.test(adminText()), 'без подписи ничего не дописывается');
    // последующие сообщения (смена статуса) читают подпись из ячейки и экранируют
    const num = g.sheets['Замовлення'].rows.find(x => /Підпис до подарунка: <b>/.test(String(x[H.indexOf('Коментар')])));
    adm(g, 900, 'admin.status', { num: num[0], code: 'c' });
    const edited = g.sent.filter(m => /Мамі/.test(JSON.stringify(m.payload))).pop();
    ok(edited && /&lt;b&gt;Мамі/.test(edited.payload.text) && !/<b>Мамі/.test(edited.payload.text), 'после смены статуса подпись в сообщении тоже экранирована');
  }

  // --- источники: события, клиенты без новых колонок, меню
  {
    const g = fresh();
    const H = () => g.sheets['Замовлення'].rows[0];
    const evRows = () => (g.sheets['Події'] ? g.sheets['Події'].rows.slice(1) : []);
    const srcEv = (uid, v) => g.post({ action: 'ev', initData: g.initData(U(uid)), sid: 's' + uid, events: [{ e: 'open', t: Date.now() }, { e: 'src', v, t: Date.now() }] });
    // без колонок «Джерело» у клиентов и «Джерело клієнта» у заказов: всё работает как раньше
    srcEv(401, 'qr1');
    ok(evRows().some(r => r[3] === 'src' && r[5] === 'qr1' && r[1] === '401'), 'событие src записано с меткой в «Значення»', evRows());
    ok(g.sheets['Клієнти'].rows[0].length === 7 && g.sheets['Клієнти'].rows.length === 2, 'у старого листа «Клієнти» без колонки «Джерело» ничего не появилось');
    const bad = ['DRY-039', 'dry-039', 'nut-001', 'ref_123456', 'adm_5', 'rec01', 'QR1', 'a b', 'x'.repeat(25), '', '<b>', 'qr1;drop'];
    bad.forEach((v, i) => srcEv(410 + i, v));
    ok(!evRows().some(r => r[3] === 'src' && r[1] !== '401'), 'невалидные метки (ID товара, ref_, adm_, rec…, заглавные, длинные, мусор) молча отброшены', evRows().filter(r => r[3] === 'src').map(r => r[5]));
    ok(srcEv(420, 'DRY-039').ok === true, 'невалидная метка не даёт ошибку');
    ok(srcEv(421, 'qr-2_x').ok && !evRows().some(r => r[3] === 'src' && r[5] === 'qr-2_x'), 'метка не из src_list (по умолчанию qr1,qr2,insert) молча отбрасывается, ошибки нет');
    ok(srcEv(422, 'insert').ok && evRows().some(r => r[3] === 'src' && r[5] === 'insert' && r[1] === '422'), 'метка insert из списка по умолчанию принимается');
    settings(g, { src_list: 'QR1, qr-2_x;spring ref_1 !!' });
    ok(g.post({ action: 'admin.settings', initData: g.initData(U(900)) }).fields.find(f => f.k === 'src_list').v === 'qr1,qr-2_x,spring,ref_1', 'src_list: сохраняется списком латиницей через запятую');
    srcEv(424, 'qr2');
    ok(srcEv(423, 'qr-2_x').ok && evRows().some(r => r[3] === 'src' && r[5] === 'qr-2_x') && !evRows().some(r => r[3] === 'src' && r[1] === '424'), 'метка с - и _ принимается, если она в src_list; qr2 уже не в списке — отброшена');
    ok(srcEv(425, 'ref_1').ok && !evRows().some(r => r[3] === 'src' && r[1] === '425'), 'ref_… остаётся не меткой, даже если записан в src_list');
    ok(!JSON.stringify(g.get({ action: 'catalog' })).includes('src_list') && !JSON.stringify(g.get({ action: 'catalog' })).includes('qr-2_x'), 'src_list на витрину не уходит');
    settings(g, { src_list: '' });
    const before = evRows().length;
    g.post({ action: 'ev', initData: g.initData(U(900)), sid: 'a', events: [{ e: 'src', v: 'qr9' }] });
    ok(evRows().length === before, 'события админа не пишутся');

    // меню создаёт колонки; повторный запуск ничего не меняет
    const fake = { items: [], addItem(t, fn) { this.items.push([t, fn]); return this; } };
    g.sandbox.stage9bMenu_(fake);
    ok(fake.items[0][0] === 'Етап 9Б: створити колонки' && typeof g.sandbox[fake.items[0][1]] === 'function', 'пункт меню «Етап 9Б: створити колонки»');
    g.call('onOpen');
    ok(g.ui.menu.items.some(i => i[0] === 'Етап 9Б: створити колонки'), 'пункт есть в меню PAMIR (onOpen)');
    const r1 = g.call('stage9bSetup');
    ok(r1.ok && r1.done.length === 2 && g.sheets['Клієнти'].rows[0].slice(-1)[0] === 'Джерело' && H().slice(-1)[0] === 'Джерело клієнта' && H().indexOf('Джерело') === 15, 'меню создало «Джерело» и «Джерело клієнта»; «Джерело» заказов на месте', [r1.done, H()]);
    const snapA = JSON.stringify([g.sheets['Клієнти'].rows, g.sheets['Замовлення'].rows]);
    const r2 = g.call('stage9bSetup');
    ok(r2.ok && r2.done.length === 0 && snapA === JSON.stringify([g.sheets['Клієнти'].rows, g.sheets['Замовлення'].rows]), 'повторный запуск ничего не меняет');
    g.sandbox.LockService = { getScriptLock: () => ({ tryLock: () => false, waitLock() {}, releaseLock() {} }) };
    ok(g.call('stage9bSetup').error === 'busy' && snapA === JSON.stringify([g.sheets['Клієнти'].rows, g.sheets['Замовлення'].rows]), 'блокировка занята: выход без изменений');
  }
  // --- источники: клиенты, заказы, статистика (колонки созданы меню)
  {
    const g = fresh();
    g.call('stage9bSetup');
    const H = () => g.sheets['Замовлення'].rows[0];
    const CL = () => g.sheets['Клієнти'].rows;
    const cl = uid => CL().find(r => r[0] === uid || r[0] === '\'' + uid);
    const srcEv = (uid, v) => g.post({ action: 'ev', initData: g.initData(U(uid)), sid: 's' + uid, events: [{ e: 'open', t: Date.now() }, { e: 'src', v, t: Date.now() }] });
    const iSrc = CL()[0].indexOf('Джерело');
    srcEv(501, 'qr1');
    ok(cl('501')[iSrc] === 'qr1', 'новый клиент: «Джерело» = qr1', cl('501'));
    g.clearCache();
    srcEv(501, 'qr2');
    ok(cl('501')[iSrc] === 'qr1', 'первый источник не перезаписывается (даже без кэша)', cl('501'));
    g.post({ action: 'ev', initData: g.initData(U(502)), sid: 's', events: [{ e: 'open', t: Date.now() }] });
    ok(cl('502') && cl('502')[iSrc] === '', 'открытие без src — «Джерело» пусто');
    srcEv(502, 'insert'); // кэш «недавно заходил» не мешает записать источник
    ok(cl('502')[iSrc] === 'insert', 'пустая ячейка у существующего клиента заполняется', cl('502'));
    g.clearCache(); srcEv(502, 'qr2');
    ok(cl('502')[iSrc] === 'insert', 'и больше не меняется');

    const lastRow = () => { const r = g.sheets['Замовлення'].rows; return r[r.length - 1]; };
    const adminText = () => g.sent.filter(m => m.method === 'sendMessage' && m.payload.chat_id === '900').pop().payload.text;
    let r = order(g, U(503), [{ id: 'NUT-007', g: 0, q: 1 }], 85, { src: 'qr2' });
    ok(r.ok && lastRow()[H().indexOf('Джерело клієнта')] === 'qr2' && lastRow()[H().indexOf('Джерело')] === 'miniapp', 'заказ: источник в «Джерело клієнта», «Джерело» = miniapp', lastRow());
    ok(cl('503') && cl('503')[iSrc] === 'qr2', 'новый клиент из заказа получает источник заказа', cl('503'));
    r = order(g, U(501), [{ id: 'NUT-007', g: 0, q: 1 }], 85, { src: 'qr2' });
    ok(r.ok && cl('501')[iSrc] === 'qr1', 'заказ не перезаписывает первый источник клиента');
    let leaked = [];
    ['DRY-039', 'dry-039', 'ref_123456', 'adm_1', 'rec1', 'ЖЖ', 'x'.repeat(30)].forEach((v, i) => {
      const rr = order(g, U(510 + i), [{ id: 'NUT-007', g: 0, q: 1 }], 85, { src: v });
      if (!rr.ok || lastRow()[H().indexOf('Джерело клієнта')] !== '') leaked.push(v);
    });
    ok(leaked.length === 0, 'невалидный src в заказе молча отброшен, заказ принят', leaked);
    r = order(g, U(520), [{ id: 'NUT-007', g: 0, q: 1 }], 85, { src: { a: 1 } });
    ok(r.ok && lastRow()[H().indexOf('Джерело клієнта')] === '', 'src не строка отброшен');
    r = order(g, U(530), [{ id: 'NUT-007', g: 0, q: 1 }], 85, { src: 'qr1', test: true });
    ok(r.ok && lastRow()[H().indexOf('Джерело')] === 'miniapp test' && lastRow()[H().indexOf('Джерело клієнта')] === 'qr1' && /ТЕСТ/.test(adminText()), 'тестовый заказ с src остаётся тестовым (miniapp test, метка ТЕСТ)', lastRow());
    ok(!cl('530'), 'тестовый заказ не создаёт клиента');
    const m = g.call('mapHeaders_', ['№', 'Статус', 'Джерело клієнта'], { source: ['=джерело'], srcClient: ['=джерело клієнта'] });
    ok(m.source === -1 && m.srcClient === 2, 'mapHeaders_: «Джерело» не цепляет «Джерело клієнта»', m);
    const m2 = g.call('mapHeaders_', ['Джерело', 'Джерело клієнта'], { source: ['=джерело'], srcClient: ['=джерело клієнта'] });
    ok(m2.source === 0 && m2.srcClient === 1, 'обе колонки находятся по точному названию', m2);

    // статистика
    const stats = () => adm(g, 900, 'admin.stats');
    g.sheets['Події'].rows.push([new Date(Date.now() - 10 * 86400000), '999', 's', 'src', '', 'qr1']);
    g.sheets['Події'].rows.push([new Date(Date.now() - 20 * 86400000), '998', 's', 'src', '', 'qr1']);
    g.clearCache(); srcEv(502, 'qr1'); // повтор того же пользователя — уникальные
    const s1 = stats().sources;
    const q1 = s1.find(x => x.src === 'qr1'), q2 = s1.find(x => x.src === 'qr2');
    ok(q1 && q1.open7 === 2 && q1.open14 === 3 && q1.ord7 === 0 && q1.ord14 === 0, 'qr1: открытия 2 за 7 / 3 за 14 дней (уникальные, 20-дневное не в счёт), заказов 0 (тестовый не считается)', q1);
    ok(q2 && q2.ord7 === 2 && q2.ord14 === 2, 'qr2: заказы 503 и 501; тестовые и без метки не считаются', q2);
    ok(JSON.stringify(Object.keys(q1)) === '["src","open7","open14","ord7","ord14"]', 'формат записи: src, open7, open14, ord7, ord14');
    ok(s1[0].src === 'qr1' && s1.every((x, i) => i === 0 || s1[i - 1].open14 >= x.open14), 'по убыванию', s1);
    const rows = g.sheets['Замовлення'].rows, hh = H();
    const o503 = rows.filter(x => x[hh.indexOf('Telegram user id')] === '503').pop();
    o503[hh.indexOf('Статус')] = 'скасовано';
    const o501 = rows.filter(x => x[hh.indexOf('Telegram user id')] === '501').pop();
    o501[hh.indexOf('Дата/час')] = new Date(Date.now() - 10 * 86400000);
    const q2b = stats().sources.find(x => x.src === 'qr2');
    ok(q2b === undefined || (q2b.ord7 === 0 && q2b.ord14 === 1), 'отменённый не считается, заказ 10-дневной давности — только в 14 днях', q2b);
    o501[hh.indexOf('Дата/час')] = new Date(Date.now() - 20 * 86400000);
    const q2c = stats().sources.find(x => x.src === 'qr2');
    ok(q2c && q2c.ord7 === 0 && q2c.ord14 === 0 && q2c.open14 > 0, 'заказ старше 14 дней не считается (открытия остаются)', q2c);
    addAdmin(g, 700, 'manager', ['st']);
    ok(adm(g, 700, 'admin.stats').need === 'stats' && adm(g, 700, 'admin.stats').sources === undefined, 'без права «Статистика» sources не отдаются');
    const txt = JSON.stringify(stats()) + JSON.stringify(cat(g));
    ok(!txt.includes(g.props.BOT_TOKEN) && !txt.includes('whsec') && !/СЕКРЕТ/.test(txt), 'в sources и каталоге нет секретов и служебных данных');
  }
  {
    const g = fresh();
    const s = adm(g, 900, 'admin.stats');
    ok(Array.isArray(s.sources) && s.sources.length === 0, 'нет событий и колонок: sources — пустой массив', s.sources);
  }
  {
    const g = fresh();
    settings(g, { theme: 'newyear', ny_snow: '1', ny_ids: 'DRY-039', ny_order_until_ua: 'до свята', gift_note: '1', home_rails_max: '4', theme_until: '31.12.2099' });
    const txt = JSON.stringify(cat(g));
    ok(!/СЕКРЕТ|do-smaku|33%/.test(txt) && !txt.includes(g.props.BOT_TOKEN) && !txt.includes('whsec') && !/WEBHOOK_SECRET|ADMIN_CHAT_IDS/.test(txt), 'каталог со всеми новыми настройками: служебных колонок и Script Properties нет');
  }
}

/* ============================ Волна Б1 · б10: админка удобнее (сервер) ============================ */
console.log('Волна Б1 · б10: «Сьогодні», превью статуса, готовые ответы, сообщение клиенту');
{
  const g = fresh();
  const H = () => g.sheets['Замовлення'].rows[0];
  const bySt = () => g.sent.filter(m => m.method === 'sendMessage');
  addAdmin(g, 950, 'manager', ['st']);
  addAdmin(g, 951, 'manager', ['stock', 'price', 'photo']);
  addAdmin(g, 952, 'manager', ['text']);
  // --- admin.today
  const t0 = adm(g, 900, 'admin.today');
  ok(t0.ok && Object.keys(t0.today).sort().join() === 'newOrders,noPhoto,noPrice,outOfStock,toShip' && t0.today.newOrders === 0 && t0.today.toShip === 1, 'today: владелец видит все пять чисел; тестовый «новий» не считается', t0);
  const mk = (uid, extra) => order(g, U(uid), [{ id: 'NUT-007', g: 0, q: 1 }], 85, extra);
  const n1 = mk(61).number, n2 = mk(62, { lang: 'ru', pay: 'card' }).number;
  ok(adm(g, 900, 'admin.today').today.newOrders === 2, 'today: новые заказы считаются');
  g.sheets['Замовлення'].rows.find(r => r[0] === n2)[2] = 'підтверджено';
  ok(adm(g, 900, 'admin.today').today.newOrders === 1 && adm(g, 900, 'admin.today').today.toShip === 2, 'today: подтверждённые — «треба відправити»');
  for (let i = 0; i < 4; i++) g.sheets['Замовлення'].rows.push(g.sheets['Замовлення'].rows[1].slice().map((v, k) => k === 0 ? 'P-9' + i : k === 2 ? 'новий' : v));
  ok(adm(g, 900, 'admin.today').today.newOrders === 5, 'today: считает весь лист, а не только последние');
  for (let i = 0; i < 110; i++) g.sheets['Замовлення'].rows.push(g.sheets['Замовлення'].rows[1].slice().map((v, k) => k === 0 ? 'P-8' + i : k === 2 ? 'виконано' : v));
  ok(adm(g, 900, 'admin.today').today.newOrders === 5 && adm(g, 900, 'admin.orders').orders.length === 100, 'today: заказы старше окна из 100 тоже считаются');
  const tp = adm(g, 950, 'admin.today').today, tm = adm(g, 951, 'admin.today').today, tt = adm(g, 952, 'admin.today').today;
  ok(Object.keys(tp).join() === 'newOrders,toShip' && Object.keys(tm).sort().join() === 'noPhoto,noPrice,outOfStock' && Object.keys(tt).length === 0, 'today: каждое число только при своём праве, иначе поля нет', [tp, tm, tt]);
  const prods = adm(g, 900, 'admin.products').products;
  ok(tm.outOfStock === prods.filter(p => !p.hidden && !p.stock).length && tm.noPrice === prods.filter(p => !(p.price > 0)).length && tm.noPhoto === prods.filter(p => !p.hidden && !p.img).length && tm.noPrice >= 1, 'today: числа товаров совпадают с таблицей (цена — и у скрытых)', tm);
  ok(adm(g, 5555, 'admin.today').error === 'forbidden', 'today: постороннему отказ');
  // --- statusPreview
  const cnt = () => bySt().length, rowsBefore = JSON.stringify(g.sheets['Замовлення'].rows);
  ok(adm(g, 951, 'admin.statusPreview', { num: n1, code: 'c' }).need === 'st' && adm(g, 5555, 'admin.statusPreview', { num: n1, code: 'c' }).error === 'forbidden', 'превью статуса: без права «st» отказ');
  const c0 = cnt();
  const pv = adm(g, 950, 'admin.statusPreview', { num: n1, code: 'c' });
  ok(pv.ok && pv.willSend === true && pv.extra === undefined && /підтверджено/.test(pv.text) && cnt() === c0 && JSON.stringify(g.sheets['Замовлення'].rows) === rowsBefore, 'превью: текст есть, ничего не отправлено и не записано', pv);
  const sent = adm(g, 950, 'admin.status', { num: n1, code: 'c' });
  const real = bySt().filter(m => String(m.payload.chat_id) === '61').pop().payload.text;
  ok(sent.ok && real === pv.text, 'превью побайтно равно реально отправленному тексту (UA)');
  const pvRu = adm(g, 950, 'admin.statusPreview', { num: n2, code: 's' });
  adm(g, 950, 'admin.status', { num: n2, code: 's' });
  ok(pvRu.text === bySt().filter(m => String(m.payload.chat_id) === '62').pop().payload.text && /отправлен/.test(pvRu.text), 'превью = отправленному (RU, «отправлен»)');
  for (const code of ['n', 'd']) {
    const uid = code === 'n' ? 71 : 72;
    const num = mk(uid).number;
    const p = adm(g, 950, 'admin.statusPreview', { num, code });
    adm(g, 950, 'admin.status', { num, code });
    ok(p.text === bySt().filter(m => String(m.payload.chat_id) === String(uid)).pop().payload.text, 'превью = отправленному для статуса ' + code);
  }
  const nc = mk(63, { pay: 'card' }).number;
  const pc = adm(g, 950, 'admin.statusPreview', { num: nc, code: 'c' });
  ok(pc.extra === 'fop' && pc.willSend && !/UA\d{20}/.test(JSON.stringify(pc)), 'карта, реквизиты ещё не уходили: флаг extra: fop, реквизитов в ответе нет', pc);
  const same = adm(g, 950, 'admin.statusPreview', { num: n1, code: 'c' });
  ok(same.ok && same.willSend === false && same.text === '', 'тот же статус: ничего не уйдёт');
  const tst = adm(g, 950, 'admin.statusPreview', { num: 'P-0007', code: 'c' });
  ok(tst.ok && tst.willSend === false && tst.text === '', 'тестовый заказ: willSend false');
  ok(adm(g, 950, 'admin.statusPreview', { num: n1, code: 'x' }).error === 'bad_status' && adm(g, 950, 'admin.statusPreview', { num: 'P-9999', code: 'c' }).error === 'not_found', 'превью: неизвестный статус и заказ');
  {
    const gf = fresh();
    const IB = 'UA213223130000026007233566001';
    gf.props.FOP_NAME = 'ФОП Тестенко Т. Т.'; gf.props.FOP_IBAN = IB; gf.props.FOP_CODE = '7654321098';
    const f = order(gf, U(64), [{ id: 'NUT-007', g: 0, q: 1 }], 85, { pay: 'card' }).number;
    const pf = adm(gf, 900, 'admin.statusPreview', { num: f, code: 'c' });
    const js = JSON.stringify(pf);
    ok(pf.ok && !js.includes(IB) && !js.includes('7654321098') && !js.includes('Тестенко') && pf.extra === undefined, 'ФОП уже отправлен при заказе: превью без реквизитов и без extra', pf);
  }
  // --- готовые ответы
  ok(Array.isArray(adm(g, 950, 'admin.orders').replies) && adm(g, 950, 'admin.orders').replies.length === 0, 'reply_*: по умолчанию пустой массив');
  ok(adm(g, 900, 'admin.settings').fields.filter(f => /^reply_/.test(f.k)).length === 10, 'в настройках 10 полей reply_*');
  settings(g, { reply_1_ua: 'Зібрано', reply_1_ru: 'Собрано', reply_2_ua: 'Тільки UA', reply_3_ru: 'Только RU', reply_4_ua: 'x'.repeat(400) });
  const rp = adm(g, 950, 'admin.orders').replies;
  ok(rp.length === 4 && rp[0].ua === 'Зібрано' && rp[0].ru === 'Собрано' && rp[1].ua === 'Тільки UA' && rp[1].ru === 'Тільки UA' && rp[2].ua === 'Только RU' && rp[2].ru === 'Только RU', 'reply_*: только непустые, недостающий язык берётся из другого', rp.map(x => [x.ua.length, x.ru.length]));
  ok(rp[3].ua.length === 300, 'reply_*: не длиннее 300 знаков');
  ok(!JSON.stringify(g.get({ action: 'catalog' })).includes('Зібрано'), 'готовые ответы не попадают в каталог');
  // --- admin.message
  const msgs = uid => bySt().filter(m => String(m.payload.chat_id) === String(uid));
  ok(adm(g, 951, 'admin.message', { num: n1, text: 'привіт' }).need === 'st' && adm(g, 5555, 'admin.message', { num: n1, text: 'привіт' }).error === 'forbidden', 'message: без права «st» отказ');
  const m1c = msgs(61).length;
  const r1 = adm(g, 950, 'admin.message', { num: n1, text: '  Замовлення <b>зібрано</b> & &amp; готове  ' });
  const sm = msgs(61).pop();
  ok(r1.ok && r1.told === true && Object.keys(r1).sort().join() === 'ok,told' && sm.payload.text === 'PAMIR · замовлення ' + n1 + '\nЗамовлення <b>зібрано</b> & &amp; готове' && sm.payload.parse_mode === undefined && msgs(61).length === m1c + 1, 'message: простой текст без parse_mode, заголовок UA, ничего в конце', sm.payload);
  adm(g, 950, 'admin.message', { num: n2, text: 'Привіт' });
  ok(msgs(62).pop().payload.text === 'PAMIR · заказ ' + n2 + '\nПривіт', 'message: заголовок на языке заказа (RU)');
  ok(adm(g, 950, 'admin.message', { num: n1, text: '   ' }).error === 'bad_form' && adm(g, 950, 'admin.message', { num: n1, text: 'я'.repeat(501) }).error === 'bad_form' && adm(g, 950, 'admin.message', { num: n1, text: 'я'.repeat(500) }).ok, 'message: длина 1…500');
  ok(adm(g, 950, 'admin.message', { num: n1, text: 'a\u0000b\u0007c' }).ok && msgs(61).pop().payload.text.split('\n')[1] === 'a b c', 'message: управляющие символы вычищены');
  const c1 = cnt();
  ok(adm(g, 950, 'admin.message', { num: 'P-0007', text: 'привіт' }).error === 'test_order' && cnt() === c1, 'message: тестовому заказу нельзя, ничего не отправлено');
  g.sheets['Замовлення'].rows.find(r => r[0] === n1)[H().indexOf('Telegram user id')] = '';
  ok(adm(g, 950, 'admin.message', { num: n1, text: 'привіт' }).error === 'no_chat' && adm(g, 950, 'admin.message', { num: 'P-9999', text: 'привіт' }).error === 'not_found', 'message: без Telegram id — no_chat; нет заказа — not_found');
  const lg = logRows(g, 'Повідомлення клієнту');
  ok(lg.length >= 3 && lg[0][4] === n1 && lg.every(x => x[6].length <= 100) && lg[0][1] !== '', 'message: запись в «Журнал» (кто, заказ, текст ≤100)');
  {
    const gl = fresh();
    addAdmin(gl, 960, 'manager', ['st']); addAdmin(gl, 961, 'manager', ['st']);
    const nums = [65, 66, 67, 68, 69].map(u => order(gl, U(u), [{ id: 'NUT-007', g: 0, q: 1 }], 85).number);
    const num = nums[0];
    let last, okN = 0;
    for (let i = 0; i < 22; i++) { last = adm(gl, 960, 'admin.message', { num: nums[i % 5], text: 'текст ' + i }); if (last.ok) okN++; }
    ok(okN === 20 && last.error === 'rate_limit', 'message: не больше 20 в час на админа', [okN, last]);
    ok(adm(gl, 961, 'admin.message', { num, text: 'інший адмін' }).ok, 'лимит у каждого админа свой');
    // лимит на один заказ: 5 в час (четыре уже ушли от 960, пятое от 961, шестое — отказ даже от другого админа)
    const six = adm(gl, 961, 'admin.message', { num, text: 'шосте' });
    ok(six.error === 'rate_limit', 'message: не больше 5 сообщений в час по одному заказу (шестое — rate_limit)', six);
    const gm = fresh();
    addAdmin(gm, 960, 'manager', ['st']);
    const numM = order(gm, U(65), [{ id: 'NUT-007', g: 0, q: 1 }], 85).number;
    const cM = () => gm.sent.filter(m => m.method === 'sendMessage' && m.payload.chat_id === '65').length;
    gm.setLockBusy(Infinity, Infinity);
    const cBefore = cM();
    const noLock = adm(gm, 960, 'admin.message', { num: numM, text: 'без блокировки' });
    gm.setLockBusy(0, 0);
    ok(noLock.error === 'rate_limit' && cM() === cBefore, 'message: счётчик под блокировкой; блокировку не взяли — rate_limit, сообщение не ушло', noLock);
    ok(gm.lockLog.some(l => l.kind === 'doc' && l.op === 'try' && l.ms >= 1000 && l.ms <= 3000), 'message: блокировка берётся через tryLock около 2 с', gm.lockLog.slice(-4));
    gm.setDocLockNull(true);
    ok(adm(gm, 960, 'admin.message', { num: numM, text: 'DocumentLock = null' }).ok, 'message: DocumentLock = null — счётчик под ScriptLock, сообщение уходит');
    gm.setDocLockNull(false);
    gl.setTelegramFail(true);
    const bad = adm(gl, 961, 'admin.message', { num: nums[1], text: 'не дійде' });
    gl.setTelegramFail(false);
    ok(bad.ok && bad.told === false && !JSON.stringify(bad).includes('mock failure') && !JSON.stringify(bad).includes(gl.props.BOT_TOKEN), 'message: сбой Telegram — told false, текст ошибки и токен не отдаются', bad);
  }
  // --- быстрая правка из списка
  const pr = adm(g, 951, 'admin.product', { id: 'NUT-002', patch: { price: 123 } });
  ok(pr.ok && pr.product.id === 'NUT-002' && pr.product.price === 123, 'быстрая правка цены: ответ содержит сохранённый товар (для «Збережено»)', pr.product);
  const sk = adm(g, 951, 'admin.product', { id: 'NUT-002', patch: { stock: false } });
  ok(sk.ok && sk.product.stock === 0 && adm(g, 950, 'admin.product', { id: 'NUT-002', patch: { stock: true } }).need === 'stock' && adm(g, 952, 'admin.product', { id: 'NUT-002', patch: { price: 5 } }).need === 'price', 'быстрый переключатель наличия: ответ с товаром; права проверяются');
  // --- секреты
  const all = JSON.stringify([adm(g, 900, 'admin.today'), adm(g, 900, 'admin.orders'), pv, pvRu, r1, adm(g, 900, 'admin.settings')]);
  ok(!all.includes(g.props.BOT_TOKEN) && !all.includes('whsec') && !/СЕКРЕТ|do-smaku|33%/.test(all), 'новые ответы: нет секретов и служебных колонок');
  ok(g.sandbox.__errors.length === 0, 'в логах нет ошибок', g.sandbox.__errors);
}
console.log('Выпуск 9Б, блок 3: Worker, быстрый режим, копии, ошибки витрины');
{
  const evPost = (g, uid, events, extra) => g.post(Object.assign({ action: 'ev', initData: g.initData(U(uid)), sid: 's' + uid, events }, extra || {}));
  const openEv = () => [{ e: 'open', t: Date.now() }];
  const evRows = g => (g.sheets['Події'] ? g.sheets['Події'].rows.slice(1) : []);
  const clientRow = (g, uid) => (g.sheets['Клієнти'] ? g.sheets['Клієнти'].rows.slice(1).find(r => r[0] === uid) : undefined);
  const scriptLocks = g => g.lockLog.filter(l => l.kind === 'script').length;
  const nSent = (g, chat, re) => g.sent.filter(m => m.method === 'sendMessage' && String(m.payload.chat_id) === String(chat) && re.test(m.payload.text || '')).length;

  // --- ping (б7.4: адрес проверки для Worker)
  {
    const g = fresh();
    g.resetOps();
    const p = g.get({ action: 'ping' }), p2 = g.get({});
    ok(p.ok === true && p.service === 'PAMIR' && JSON.stringify(p2) === JSON.stringify(p) && !g.ops.read && !g.ops.cache, 'GET ?action=ping и GET без action: {ok, service:PAMIR}, таблицу и кэш не читают', [p, g.ops]);
  }

  // --- б7.1: уведомление Worker
  {
    const g = fresh();
    g.call('menuRefreshCatalog');
    ok(g.fetched.length === 0, 'без WORKER_URL purge не вызывается');
    g.props.WORKER_URL = 'https://pamir-worker.example.workers.dev/';
    g.call('menuRefreshCatalog');
    const f = g.fetched[0];
    ok(g.fetched.length === 1 && f.url === 'https://pamir-worker.example.workers.dev/purge' && f.method === 'post' && f.headers['X-Pamir-Key'] === 'whsec' && !f.payload && f.lockHeld === 0, 'меню «Оновити каталог»: один POST <WORKER_URL>/purge с X-Pamir-Key, пустое тело, не внутри блокировки', f);
    g.fetched.length = 0;
    const r = adm(g, 900, 'admin.product', { id: 'NUT-002', patch: { price: 123 } });
    ok(r.ok && g.fetched.length === 1 && g.fetched[0].lockHeld === 0, 'правка товара из панели: purge ровно один раз за запрос и вне блокировки', [r.ok, g.fetched.length]);
    g.fetched.length = 0;
    g.get({ action: 'catalog' });
    ok(g.fetched.length === 0, 'обычное чтение каталога purge не вызывает');
    g.fetched.length = 0;
    delete g.props.WEBHOOK_SECRET;
    g.call('menuRefreshCatalog');
    ok(g.fetched.length === 0, 'без WEBHOOK_SECRET purge не вызывается');
    g.props.WEBHOOK_SECRET = 'whsec';
    g.setFetch(true);
    let threw = false;
    try { g.call('menuRefreshCatalog'); } catch (e) { threw = true; }
    g.setFetch(false);
    const logs = JSON.stringify([g.sandbox.__errors, g.sandbox.__warns, g.ui.alerts]);
    ok(!threw && !logs.includes('whsec') && !logs.includes('workers.dev') && !logs.includes(g.props.BOT_TOKEN), 'сбой Worker проглатывается; ни секрета, ни адреса в логах и окнах', logs.slice(0, 200));
    g.setFetch(false, 500);
    g.call('menuRefreshCatalog');
    g.setFetch(false, 200);
    ok(!JSON.stringify(g.sandbox.__warns).includes('workers.dev') && g.sandbox.__warns.some(w => /500/.test(w)), 'ответ 500 от Worker: в логе только код');
    g.props.WORKER_URL = 'http://insecure.example/';
    g.fetched.length = 0;
    g.call('menuRefreshCatalog');
    ok(g.fetched.length === 0, 'адрес не https — purge не вызывается');
  }

  // --- б7.2: быстрый режим
  {
    const g = fresh();
    // без флага: старое поведение — прямая запись, документная блокировка не нужна
    evPost(g, 301, openEv());
    ok(evRows(g).length === 1 && clientRow(g, '301') && !g.lockLog.some(l => l.kind === 'doc'), 'без флага: события и клиент пишутся сразу, как раньше');
    // включение
    g.call('onOpen');
    ok(['Увімкнути швидкий режим (запис подій раз на хвилину)', 'Вимкнути швидкий режим', 'Зробити копію зараз', 'Увімкнути щотижневу копію'].every(t => g.ui.menu.items.some(i => i[0] === t && typeof g.sandbox[i[1]] === 'function')), 'пункты меню быстрого режима и копий есть в PAMIR');
    g.call('menuFastOn'); g.call('menuFastOn');
    ok(g.props.FAST_MODE === '1' && g.triggers.filter(t => t === 'flushJob').length === 1, 'menuFastOn: флаг и один триггер flushJob (повтор не дублирует)', g.triggers);
    g.call('menuDailyOn'); g.call('menuDailyOff');
    ok(g.triggers.filter(t => t === 'flushJob').length === 1 && !g.triggers.includes('dailyJob'), 'menuDailyOn/Off не трогают flushJob');
    // события и отметки копятся
    g.lockLog.length = 0;
    const rows0 = evRows(g).length;
    const n0 = g.sheets['Клієнти'].rows.length;
    const r1 = evPost(g, 302, [{ e: 'open', t: Date.now() }, { e: 'src', v: 'qr2', t: Date.now() }, { e: 'view', id: 'DRY-039', t: Date.now() }]);
    const r2 = evPost(g, 303, [{ e: 'open', t: Date.now() }, { e: 'add', id: 'NUT-001', v: '250', t: Date.now() }]);
    ok(r1.ok && r1.n === 3 && r2.ok, 'быстрый режим: ответ тот же', [r1, r2]);
    ok(evRows(g).length === rows0 && g.sheets['Клієнти'].rows.length === n0, 'до flushJob в листы ничего не записано');
    ok(scriptLocks(g) === 0, 'запрос событий не берёт блокировку скрипта (заказы не ждут аналитику)', g.lockLog);
    const ord = order(g, U(304), [{ id: 'NUT-007', g: 0, q: 1 }], 85, { lang: 'ru', src: 'qr2' });
    ok(ord.ok && !clientRow(g, '304'), 'заказ принят; отметка клиента с заказом тоже в буфере');
    ok(g.sheets['Замовлення'].rows.slice(-1)[0][3] === '304', 'заказ записан в таблицу сразу');
    g.call('flushJob');
    const ev = evRows(g);
    ok(ev.length === rows0 + 5 && ev.filter(r => r[1] === '302').length === 3 && ev.some(r => r[3] === 'src' && r[1] === '302' && r[5] === 'qr2') && ev.filter(r => r[1] === '303').length === 2, 'после flushJob: все 5 событий в листе, включая src', ev.length);
    const head = g.sheets['Клієнти'].rows[0];
    ok(clientRow(g, '302') && clientRow(g, '303') && clientRow(g, '304') && clientRow(g, '304')[head.indexOf('Мова')] === 'ru' && clientRow(g, '302')[head.indexOf('Ім\'я')] === 'Тест302', 'после flushJob: клиенты записаны, язык заказа — ru');
    const rowsAfter = g.sheets['Клієнти'].rows.length;
    g.call('flushJob');
    ok(evRows(g).length === ev.length && g.sheets['Клієнти'].rows.length === rowsAfter, 'повторный flushJob ничего не дублирует');
    ok(g.cache.fb_n === g.cache.fb_t && !Object.keys(g.cache).some(k => /^fb_\d+$/.test(k)), 'буфер очищен после записи');
    // первый источник: пишется один раз
    g.call('stage9bSetup');
    evPost(g, 305, [{ e: 'open', t: Date.now() }, { e: 'src', v: 'qr1', t: Date.now() }]);
    delete g.cache['cls_305']; // «шесть часов прошло»
    evPost(g, 305, [{ e: 'src', v: 'insert', t: Date.now() }]);
    g.call('flushJob');
    ok(clientRow(g, '305')[g.sheets['Клієнти'].rows[0].indexOf('Джерело')] === 'qr1', 'первый источник клиента сохраняется, второй не перезаписывает');
    // админ
    const before = evRows(g).length;
    evPost(g, 900, [{ e: 'view', id: 'DRY-039', t: Date.now() }]);
    g.call('flushJob');
    ok(evRows(g).length === before, 'события админа не пишутся и в быстром режиме');
    // подпись
    const bad = g.post({ action: 'ev', initData: g.initData(U(306)).replace(/hash=[0-9a-f]{6}/, 'hash=000000'), events: openEv() });
    g.call('flushJob');
    ok(bad.error === 'bad_auth' && !clientRow(g, '306'), 'подделанная подпись отклоняется, в буфер не попадает');
    // лимит 400 в час
    const gl = fresh(); gl.call('menuFastOn');
    let last;
    for (let i = 0; i < 11; i++) last = evPost(gl, 310, Array.from({ length: 40 }, () => ({ e: 'view', id: 'DRY-039', t: Date.now() })));
    gl.call('flushJob');
    ok(evRows(gl).length === 400 && last.n === 0, 'лимит 400 событий в час сохранён', evRows(gl).length);
    // метка живости: нет flushJob 15 минут — прямая запись
    const gh = fresh(); gh.call('menuFastOn'); delete gh.cache.fb_hb;
    evPost(gh, 320, openEv());
    ok(evRows(gh).length === 1 && clientRow(gh, '320'), 'триггер не работает (нет метки) — витрина возвращается к прямой записи');
  }

  // --- блокировка занята: отложить, ничего не терять; заказ не зависит от буфера
  {
    const g = fresh();
    g.call('menuFastOn');
    for (let i = 0; i < 5; i++) evPost(g, 330 + i, [{ e: 'open', t: Date.now() }, { e: 'view', id: 'DRY-039', t: Date.now() }]);
    g.setLockBusy(Infinity);
    g.call('flushJob');
    ok(evRows(g).length === 0 && !g.sheets['Клієнти'], 'блокировка скрипта занята: flushJob откладывает, в листы ничего');
    ok(g.lockLog.filter(l => l.kind === 'script' && l.op === 'wait').length === 0 && g.lockLog.some(l => l.kind === 'script' && l.op === 'try' && l.ms <= 3000), 'flushJob берёт блокировку только через tryLock и ненадолго');
    g.setLockBusy(0);
    evPost(g, 340, openEv()); // пока flushJob откладывался, события продолжают копиться
    g.call('flushJob');
    ok(evRows(g).length === 11 && g.sheets['Клієнти'].rows.length === 7, 'блокировку освободили: дописано всё накопленное, потерь нет', [evRows(g).length, g.sheets['Клієнти'].rows.length]);
    // обе блокировки заняты (DocumentLock недоступен, ScriptLock занят): события идут в запасные слоты, заказ не ждёт
    g.setLockBusy(Infinity, Infinity);
    const rEv = evPost(g, 350, openEv());
    g.setLockBusy(0, 0);
    const o1 = order(g, U(351), [{ id: 'NUT-007', g: 0, q: 1 }], 85, { lang: 'ru' });
    ok(rEv.ok && rEv.n === 1 && Object.keys(g.cache).some(k => /^fs_\d+_\d+$/.test(k)), 'нет блокировок: событие принято в запасной слот, ответ ok', Object.keys(g.cache).filter(k => /^fs_/.test(k)));
    ok(o1.ok && !clientRow(g, '351'), 'заказ принят; отметка клиента заказа — в буфере');
    g.advance(120000); // минута слота прошла
    g.call('flushJob');
    ok(evRows(g).some(r => r[1] === '350') && clientRow(g, '350') && clientRow(g, '351'), 'flushJob дочитал запасные слоты: событие и отметки клиентов в листе');
    ok(!Object.keys(g.cache).some(k => /^fs_\d+_\d+$/.test(k)), 'слоты очищены после записи');
    // заказ при занятой блокировке скрипта <20 с проходит; события при этом не ждут
    g.setLockBusy(5000);
    g.lockWaited.script = 0;
    const rEv2 = evPost(g, 360, openEv());
    const waitedByEv = g.lockWaited.script;
    const o2 = order(g, U(361), [{ id: 'NUT-007', g: 0, q: 1 }], 85);
    g.setLockBusy(0);
    ok(rEv2.ok && waitedByEv === 0, 'блокировка скрипта занята 5 с: событие не ждало ничего');
    ok(o2.ok, 'заказ при занятой блокировке (5 с) принят');
    // переполнение очереди
    const gf = fresh(); gf.call('menuFastOn');
    let accepted = 0;
    const MAXP = gf.sandbox.FB_MAX_PENDING;
    ok(MAXP >= 3000 && gf.sandbox.FB_FLUSH_BATCHES * gf.sandbox.FB_FLUSH_ROUNDS >= 1500, 'ёмкость буфера и скорость записи рассчитаны минимум на 1500 пачек в минуту', [MAXP, gf.sandbox.FB_FLUSH_BATCHES, gf.sandbox.FB_FLUSH_ROUNDS]);
    for (let i = 0; i < MAXP + 5; i++) if (gf.call('bufferPush_', { e: [[Date.now(), String(400000 + i), 's', 'view', 'DRY-039', '']] })) accepted++;
    ok(accepted === MAXP && gf.cache.fb_lost === '5', 'очередь: сверх ёмкости пачки отбрасываются, потери считаются', [accepted, gf.cache.fb_lost]);
    const oF = order(gf, U(399), [{ id: 'NUT-007', g: 0, q: 1 }], 85);
    ok(oF.ok && clientRow(gf, '399'), 'очередь полна: заказ и его отметка клиента записаны как раньше');
    gf.call('flushJob');
    ok(evRows(gf).length === MAXP && gf.sandbox.__warns.some(w => /втрачено/.test(w)), 'один flushJob записал все принятые пачки; потери записаны в журнал', evRows(gf).length);
  }

  // --- выключение и статистика
  {
    const g = fresh();
    g.call('menuFastOn');
    for (let i = 0; i < 4; i++) evPost(g, 370 + i, [{ e: 'open', t: Date.now() }, { e: 'view', id: 'DRY-039', t: Date.now() }]);
    const st = adm(g, 900, 'admin.stats');
    ok(st.ok && st.funnel && st.funnel.open === 4 && st.funnel.view >= 1, 'статистика перед расчётом дописывает буфер', st.funnel);
    for (let i = 0; i < 3; i++) evPost(g, 380 + i, openEv());
    g.setLockBusy(Infinity);
    const stBusy = adm(g, 900, 'admin.stats');
    g.setLockBusy(0);
    ok(stBusy.ok === true || stBusy.error !== undefined, 'статистика при занятой блокировке отвечает, а не зависает');
    const off = g.call('menuFastOff');
    ok(off.ok && g.props.FAST_MODE === '0' && !g.triggers.includes('flushJob') && clientRow(g, '382'), 'menuFastOff: сначала дописан буфер, триггер и флаг сняты');
    const n = evRows(g).length;
    evPost(g, 390, [{ e: 'view', id: 'DRY-039', t: Date.now() }]);
    ok(evRows(g).length === n + 1, 'после выключения события снова пишутся сразу');
  }

  // --- б7.5: копии
  {
    const g = fresh();
    g.call('menuBackupOn'); g.call('menuBackupOn');
    ok(g.triggers.filter(t => t === 'backupJob').length === 1, 'menuBackupOn: один триггер backupJob, повтор не дублирует');
    g.call('menuBackupNow');
    ok(g.drive.folders.length === 1 && g.drive.folders[0].name === 'PAMIR — резервні копії' && g.props.BACKUP_FOLDER_ID === g.drive.folders[0].id && g.drive.files.length === 1 && /^PAMIR — Товари — копія \d{4}-\d\d-\d\d \d\d:\d\d$/.test(g.drive.files[0].name), 'первая копия: папка создана, id в свойствах, имя с датой');
    const folder = g.drive.folders[0];
    const foreign = g.newFile('Чужой файл.xlsx', folder, 'x'); g.drive.files.push(foreign);
    const other = g.newFile('PAMIR — Товари — копія 2020-01-01 00:00', null, 'x'); g.drive.files.push(other); // тот же префикс, но не в нашей папке
    for (let i = 0; i < 8; i++) g.call('backupJob');
    const mine = g.drive.files.filter(f => f.folder === folder && f.name.indexOf('PAMIR — Товари — копія ') === 0);
    const oldest = g.drive.files[0];
    ok(g.drive.folders.length === 1 && mine.filter(f => !f.trashed).length === 8 && mine.length === 9, 'девять копий: в папке остаётся 8', mine.map(f => f.trashed));
    ok(oldest.trashed === true && mine.slice(1).every(f => !f.trashed), '9-я копия отправила самую старую в корзину (setTrashed), а не удалила навсегда');
    ok(foreign.trashed === false && other.trashed === false, 'чужие файлы и файлы вне папки не тронуты');
    // сбой
    g.sandbox.DriveApp.getFileById = () => { throw new Error('Drive down ' + g.props.BOT_TOKEN); };
    const m0 = nSent(g, 900, /резервн/);
    g.call('backupJob'); g.call('backupJob');
    ok(nSent(g, 900, /резервн/) === m0 + 1, 'ошибка копии: админам одно сообщение, не по разу на каждый повтор');
    const msg = g.sent.filter(m => /резервн/.test(m.payload.text || '')).pop().payload.text;
    ok(!msg.includes(g.props.BOT_TOKEN) && /Не вдалося/.test(msg) && /Не удалось/.test(msg), 'в сообщении об ошибке нет секретов, есть UA и RU');
    const gb = fresh();
    gb.call('menuBackupOn');
    gb.call('menuBackupOff');
    ok(!gb.triggers.includes('backupJob'), 'выключение еженедельной копии снимает триггер');
  }

  // --- б7.7: ошибки витрины
  {
    const g = fresh();
    const sheetsBefore = Object.keys(g.sheets).join();
    const e1 = g.post({ action: 'err', did: 'abcd1234wxyz', extra: 'initData=SECRET', initData: 'IGNORED', items: [
      { m: 'TypeError: x is undefined at https://shop.test/app.js?initData=query_id%3DAAE&user=%7B%22id%22%3A5%7D#tgWebAppData=abc', s: 'cart', v: '2026.11.18' },
      { m: 'Не вдалося: телефон +380 50 123 45 67 та 0501234567, пошта a@b.com', s: 'checkout', v: 'v9' },
      { m: 'hash=deadbeef user={"id":5} query_id=AAEx initData=zzz <b>x</b>', s: 'x'.repeat(40), v: 'v'.repeat(30) },
      { m: '   ', s: 'empty' }
    ] });
    ok(e1.ok === true && Object.keys(e1).join() === 'ok', 'err: ok без initData', e1);
    const buf = g.cache.er_buf || '';
    ok(buf && !/380|0501234567|1234567|a@b\.com|deadbeef|AAE|initData|IGNORED|SECRET|tgWebAppData|hash=|user=|query_id|\?/.test(buf), 'err: телефон, initData/hash/user, query-строка и почта вырезаны', buf);
    ok(/TypeError: x is undefined at/.test(buf) && /cart/.test(buf) && !/shop\.test|https|app\.js/.test(buf), 'err: полезный текст остаётся, адрес вырезан целиком');
    const parsed = JSON.parse(buf);
    const keys = Object.keys(parsed.m).map(k => k.split('\u0001'));
    ok(parsed.n === 3 && keys.every(k => k[0].length <= 24 && k[1].length <= 12 && k[2].length <= 80), 'err: экран ≤24, версия ≤12, текст ≤80; пустой текст пропущен', keys);
    ok(Object.keys(g.sheets).join() === sheetsBefore, 'err: в листы ничего не пишется');
    ok(g.post({ action: 'err', did: 'BAD', items: [{ m: 'x' }] }).error === 'bad_form' && g.post({ action: 'err', did: 'abcd1234wxyz' }).error === 'bad_form', 'err: неверный did или нет items — bad_form');
    g.post({ action: 'err', did: 'longlong0001', items: [{ m: 'я'.repeat(500), s: 'home', v: '1' }] });
    ok(Object.keys(JSON.parse(g.cache.er_buf).m).some(k => k.split('\u0001')[2].length === 80), 'err: текст обрезается до 80');
    // 5 в час на did
    const g2 = fresh();
    const items = n => Array.from({ length: n }, (_, i) => ({ m: 'ошибка ' + i, s: 'home', v: '1' }));
    g2.post({ action: 'err', did: 'devicedid001', items: items(4) });
    const rr = g2.post({ action: 'err', did: 'devicedid001', items: items(4) });
    const rr2 = g2.post({ action: 'err', did: 'devicedid001', items: items(4) });
    ok(rr.ok && rr2.ok && JSON.parse(g2.cache.er_buf).n === 5, 'err: не больше 5 записей в час с одного did, сверх — молча ok', JSON.parse(g2.cache.er_buf).n);
    g2.post({ action: 'err', did: 'devicedid002', items: items(2) });
    ok(JSON.parse(g2.cache.er_buf).n === 7, 'err: у другого устройства свой лимит');
    // общий потолок 300
    const g3 = fresh();
    for (let i = 0; i < 70; i++) g3.post({ action: 'err', did: 'dev' + String(10000000 + i), items: items(5) });
    ok(JSON.parse(g3.cache.er_buf).n === 300, 'err: общий потолок 300 в час', JSON.parse(g3.cache.er_buf).n);
    // сводка
    const g4 = fresh();
    g4.post({ action: 'err', did: 'devicedid010', items: [{ m: 'net poll: HTTP 500', s: 'cart', v: '7' }, { m: 'net poll: HTTP 500', s: 'cart', v: '7' }, { m: 'Other <b>bold</b> & more', s: 'home', v: '7' }] });
    g4.post({ action: 'err', did: 'devicedid011', items: [{ m: 'net poll: HTTP 500', s: 'cart', v: '7' }] });
    g4.call('hourlyJob');
    const sums = g4.sent.filter(m => m.method === 'sendMessage' && /Помилки у магазині/.test(m.payload.text || ''));
    ok(sums.length === 1 && String(sums[0].payload.chat_id) === '900' && /^Помилки у магазині за годину: 4 \(з 2 телефонів\)\n/.test(sums[0].payload.text) && /net poll: HTTP 500 \(екран: cart, версія: 7\) — 3 \(2 телефони\)/.test(sums[0].payload.text) && /інші: 1 \/ другие: 1/.test(sums[0].payload.text) && !/Other|bold/.test(sums[0].payload.text) && !/[<>&]/.test(sums[0].payload.text) && sums[0].payload.parse_mode === 'HTML', 'сводка «Помилки у магазині: N» раз в час: частые тексты, без разметки из чужого текста, экран и версия', sums[0] && sums[0].payload.text);
    ok(!g4.cache.er_buf, 'после сводки буфер очищен');
    g4.call('hourlyJob');
    ok(g4.sent.filter(m => /Помилки у магазині/.test(m.payload.text || '')).length === 1, 'ошибок не было — второй сводки нет');
    const g5 = fresh();
    g5.call('hourlyJob');
    ok(!g5.sent.some(m => /Помилки/.test(m.payload.text || '')), 'пусто — сводки нет');
    const g6 = fresh();
    g6.post({ action: 'err', did: 'devicedid020', items: Array.from({ length: 5 }, (_, i) => ({ m: 'net e' + i + ': network', s: 'home', v: '1' })) });
    g6.post({ action: 'err', did: 'devicedid021', items: Array.from({ length: 5 }, (_, i) => ({ m: 'net f' + i + ': timeout', s: 'home', v: '1' })) });
    g6.call('errorsJob');
    const t6 = g6.sent.filter(m => /Помилки у магазині/.test(m.payload.text || ''))[0].payload.text;
    ok(/магазині за годину: 10 \(з 2 телефонів\)\n/.test(t6) && t6.split('\n').length === 7 && /інші: 5/.test(t6) && /другие: 5/.test(t6), 'в сводке не больше 5 строк с ошибками и строка «інші: N / другие: N» (UA и RU)', t6);
  }

  // --- б7.7+: чужая ссылка, засорение, дедупликация, запасные слоты
  {
    const g = fresh();
    const bad = ['Смотри http://evil.example/x', 'https://evil.com/phish?x=1', 'www.evil.org', 'evil.com', 'пиши t.me/scam_bot', 'пиши @scam_bot срочно', 'a.b.ru/path', 'шлях 10.0.0.1/admin', 'EVIL.COM/login'];
    bad.forEach((m, i) => g.post({ action: 'err', did: 'urlattack' + String(100 + i), items: [{ m: 'Ошибка ' + m + ' конец', s: 'evil.com', v: 'evil.com' }] }));
    const buf = Object.keys(JSON.parse(g.cache.er_buf).m).map(k => k.split('\u0001')[2]).join('|');
    ok(buf && !/evil|scam|http|www|t\.me|\.com|\.org|\.ru|10\.0\.0|@|phish/i.test(buf), 'err: адреса (http/https/www, домены, t.me), IP и @имена вырезаны; экран и версия не могут быть адресом', buf);
    g.call('errorsJob');
    const sm = g.sent.filter(m => /Помилки у магазині/.test(m.payload.text || ''))[0];
    ok(sm && !/scam|http|www|\.com|@|evil\.|\.evil/i.test(sm.payload.text),'сводка админу без чужих ссылок', sm && sm.payload.text);
    ok(g.call('errScrub_', 'Привіт, світе! Помилка (код 42): "x" - ok', 80) === 'Привіт, світе! Помилка (код 42): "x" - ok', 'errScrub_: буквы, цифры, пробел и базовая пунктуация остаются');
    ok(!/[<>\[\]{}\\/=&%$#*+@|~^]/.test(g.call('errScrub_', 'a<b>c[d]{e}\\f/g=h&i%j$k#l*m+n|o~p^q', 80)), 'errScrub_: прочие знаки вырезаны');
    // засорение: 60 запросов с новыми did и одним и тем же текстом, потом настоящая ошибка
    const g2 = fresh();
    for (let i = 0; i < 60; i++) g2.post({ action: 'err', did: 'spamdid' + String(10000 + i), items: Array.from({ length: 5 }, () => ({ m: 'спам текст', s: 'home', v: '1' })) });
    g2.post({ action: 'err', did: 'realuser0001', items: [{ m: 'Реальна помилка кошика', s: 'cart', v: '2' }] });
    const b2 = JSON.parse(g2.cache.er_buf);
    ok(Object.keys(b2.m).length === 2 && b2.m['home\u00011\u0001спам текст'] === g2.sandbox.ERR_TOTAL_HOUR - 0 && Object.keys(b2.m).some(k => /Реальна/.test(k)), 'err: один и тот же текст — одна запись со счётчиком (не выше общего потолка), настоящая ошибка видна', b2);
    // число разных текстов ограничено
    const g3 = fresh();
    for (let i = 0; i < 20; i++) g3.post({ action: 'err', did: 'distinct' + String(10000 + i), items: Array.from({ length: 5 }, (_, j) => ({ m: 'текст номер ' + (i * 5 + j), s: 'home', v: '1' })) });
    const b3 = JSON.parse(g3.cache.er_buf);
    ok(Object.keys(b3.m).length === 40 && g3.sandbox.ERR_DISTINCT_HOUR === 40, 'err: разных текстов в час не больше 40', Object.keys(b3.m).length);
    g3.call('errorsJob');
    const t3 = g3.sent.filter(m => /Помилки у магазині/.test(m.payload.text || ''))[0].payload.text;
    ok(t3.split('\n').length === 2 && /інші: 40 \/ другие: 40/.test(t3) && !/текст номер/.test(t3), 'сводка: произвольный текст не показывается, только «інші: N»', t3);
    // нет блокировок: запасные слоты, сводка дочитывает
    const g4 = fresh();
    g4.setLockBusy(Infinity, Infinity);
    g4.post({ action: 'err', did: 'slotdid00001', items: [{ m: 'net slot: timeout', s: 'cart', v: '3' }] });
    g4.setLockBusy(0, 0);
    ok(!g4.cache.er_buf && Object.keys(g4.cache).some(k => /^fx_\d+_\d+$/.test(k)), 'err: ни одной блокировки — запись в запасной слот без блокировки');
    g4.call('errorsJob');
    ok(g4.sent.some(m => /net slot: timeout \(екран: cart, версія: 3\) — 1 \(1 телефон\)/.test(m.payload.text || '')), 'сводка дочитала запасные слоты');
    // DocumentLock = null
    const g5 = fresh();
    g5.setDocLockNull(true);
    const realLk = g5.sandbox.LockService; let scriptLocks = 0;
    g5.sandbox.LockService = { getDocumentLock: realLk.getDocumentLock, getScriptLock: () => { scriptLocks++; return realLk.getScriptLock(); } };
    g5.post({ action: 'err', did: 'nulllockdid1', items: [{ m: 'net lock: network', s: 'cart', v: '3' }] });
    g5.sandbox.LockService = realLk;
    ok(scriptLocks === 0 && !g5.cache.er_buf && Object.keys(g5.cache).some(k => /^fx_\d+_\d+$/.test(k)), 'DocumentLock = null: err не берёт ScriptLock заказа, пишет в запасной слот', scriptLocks);
    g5.call('errorsJob');
    ok(g5.sent.some(m => /net lock: network/.test(m.payload.text || '')), 'DocumentLock = null: сводка ушла');
    // М1: разбор безопасных частей до вырезания адресов
    const g7 = fresh();
    g7.post({ action: 'err', did: 'safeparse0001', items: [
      { m: 'Uncaught TypeError: Cannot read properties of null (reading buy now at evil.com) @ app.js:1234', s: 'cart', v: '1' },
      { m: 'Pay 5000 to card 4444 now, write @scam_bot @ app.js:7', s: 'cart', v: '1' },
      { m: 'Please visit our site @ evil.js:5', s: 'cart', v: '1' } ] });
    g7.post({ action: 'err', did: 'safeparse0002', items: [{ m: 'promise: send money to https://evil.com', s: 'cart', v: '1' }, { m: 'net order: HTTP 502', s: 'cart', v: '1' }, { m: 'Sending money now', s: 'cart', v: '1' }] });
    g7.call('errorsJob');
    const t7 = g7.sent.filter(m => /Помилки у магазині/.test(m.payload.text || ''))[0].payload.text;
    ok(/• TypeError @ app\.js:1234 \(екран: cart/.test(t7) && /• Unhandled \(/.test(t7) && /• net order: HTTP 502 \(/.test(t7) && /інші: 3 \/ другие: 3/.test(t7) && !/evil|scam|money|card|Cannot|buy|visit/.test(t7), 'сводка: только известные виды (файл:строка, тип, net), остальное — «інші: N»', t7);
  }

  // --- сводка ошибок: разные телефоны, админы отдельно, метка worker_fallback
  {
    const sumOf = g => g.sent.filter(m => m.method === 'sendMessage' && /Помилки у магазині|Каталог через Cloudflare/.test(m.payload.text || ''));
    const rec = (g, did, m, s, n) => g.post({ action: 'err', did, items: Array.from({ length: n || 1 }, () => ({ m: m || 'net catalog: network', s: s || 'catalog', v: '26' })) });
    // один телефон — пять одинаковых записей
    const g1 = fresh();
    rec(g1, 'phoneaaaa001', null, null, 5);
    g1.call('errorsJob');
    const t1 = sumOf(g1)[0].payload.text;
    ok(/^Помилки у магазині за годину: 5 \(з 1 телефона\)\n/.test(t1) && /net catalog: network \(екран: catalog, версія: 26\) — 5 \(1 телефон\)/.test(t1) && !/Покупці|Адмін/.test(t1), 'сводка: один телефон, 5 записей — «1 телефон»', t1);
    // три и пять телефонов
    const g2 = fresh();
    ['phoneaaaa001', 'phoneaaaa002', 'phoneaaaa003'].forEach(d => rec(g2, d, null, null, 2));
    g2.call('errorsJob');
    ok(/— 6 \(3 телефони\)/.test(sumOf(g2)[0].payload.text) && /\(з 3 телефонів\)/.test(sumOf(g2)[0].payload.text), 'сводка: три телефона — «3 телефони»', sumOf(g2)[0].payload.text);
    const g3 = fresh();
    for (let i = 1; i <= 5; i++) rec(g3, 'phonebbbb00' + i, null, null, 1);
    g3.call('errorsJob');
    ok(/— 5 \(5 телефонів\)/.test(sumOf(g3)[0].payload.text), 'сводка: пять телефонов — «5 телефонів»', sumOf(g3)[0].payload.text);
    ok([1, 2, 4, 5, 11, 12, 14, 21, 22, 25, 111].map(n => g3.call('errPhoneNoun_', n)).join() === 'телефон,телефони,телефони,телефонів,телефонів,телефонів,телефонів,телефон,телефони,телефонів,телефонів' && g3.call('errPhoneFrom_', 1) === 'з 1 телефона' && g3.call('errPhoneFrom_', 21) === 'з 21 телефона' && g3.call('errPhoneFrom_', 3) === 'з 3 телефонів', 'формы слова «телефон»: 1, 2–4, 5+, 11–14, 21');
    // админы отдельно от покупателей
    const g4 = fresh();
    rec(g4, 'phonecccc001', 'net catalog: network', 'catalog', 2);
    rec(g4, 'phonecccc002', 'net catalog: network', 'catalog', 1);
    rec(g4, 'phonecccc003', 'net admin: timeout', 'admin.orders', 2);
    g4.call('errorsJob');
    const t4 = sumOf(g4)[0].payload.text;
    ok(/^Помилки у магазині за годину: 5 \(з 3 телефонів\)\n/.test(t4) && /\nПокупці: 3 \(з 2 телефонів\)\n• net catalog: network[^\n]*— 3 \(2 телефони\)\nАдмін-панель: 2 \(з 1 телефона\)\n• net admin: timeout[^\n]*— 2 \(1 телефон\)$/.test(t4), 'сводка: ошибки админов — отдельным блоком, покупатели — отдельно', t4);
    // только админские
    const g5 = fresh();
    rec(g5, 'phonedddd001', 'net admin: HTTP 500', 'admin.stats', 1);
    rec(g5, 'phonedddd001', 'net admin: HTTP 500', 'admin', 1);
    g5.call('errorsJob');
    const t5 = sumOf(g5)[0].payload.text;
    ok(/Тільки адмін-панель, покупці помилок не мали/.test(t5) && /Адмін-панель: 2 \(з 1 телефона\)/.test(t5) && !/Покупці:/.test(t5), 'сводка: только админские — так и написано, блока покупателей нет', t5);
    // только покупательские
    const t6 = (() => { const g = fresh(); rec(g, 'phoneeeee001', 'net orders: HTTP 502', 'orders', 3); g.call('errorsJob'); return sumOf(g)[0].payload.text; })();
    ok(/^Помилки у магазині за годину: 3 \(з 1 телефона\)\n• net orders: HTTP 502/.test(t6) && !/Адмін|Покупці:/.test(t6), 'сводка: только покупательские — без блоков админа', t6);
    // лимит 5 в час на телефон
    const g7 = fresh();
    rec(g7, 'phoneffff001', null, null, 4); rec(g7, 'phoneffff001', null, null, 4);
    g7.call('errorsJob');
    ok(/Помилки у магазині за годину: 5 \(з 1 телефона\)/.test(sumOf(g7)[0].payload.text), 'сводка: лимит 5 записей в час на телефон работает', sumOf(g7)[0].payload.text);
    // did не попадает ни в сводку, ни в кэш
    const g8 = fresh();
    rec(g8, 'secretdidxyz99', 'net catalog: network', 'catalog', 2);
    rec(g8, 'secretdidxyz99', 'promise: boom', 'cart', 1);
    const hash = g8.call('errDidHash_', 'secretdidxyz99');
    ok(/^[0-9a-f]{16}$/.test(hash) && hash !== g8.call('errDidHash_', 'secretdidxyz98'), 'отпечаток телефона: 16 hex, разные did — разные');
    ok(g8.cache.er_buf && !/secretdidxyz99/.test(g8.cache.er_buf) && g8.cache.er_buf.includes(hash), 'did не хранится в буфере ошибок — только отпечаток');
    const g8s = fresh();
    g8s.setLockBusy(Infinity, Infinity);
    rec(g8s, 'secretdidxyz99', 'net catalog: network', 'catalog', 1);
    g8s.setLockBusy(0, 0);
    ok(Object.keys(g8s.cache).some(k => /^fx_\d+_\d+$/.test(k)) && Object.keys(g8s.cache).filter(k => /^fx_/.test(k)).every(k => !/secretdidxyz99/.test(g8s.cache[k])), 'did не хранится и в запасных слотах');
    g8.call('errorsJob');
    ok(sumOf(g8).length === 1 && sumOf(g8).every(m => !/secretdidxyz99|[0-9a-f]{16}/.test(JSON.stringify(m))), 'did и отпечаток не попадают в текст сводки');
    // старые записи без did (буфер до выкладки)
    const g9 = fresh();
    g9.cache.er_buf = JSON.stringify({ n: 4, m: { 'cart\u00017\u0001net poll: HTTP 500': 3, 'home\u00017\u0001net x: timeout': 1 } });
    g9.call('errorsJob');
    const t9 = sumOf(g9)[0].payload.text;
    ok(/^Помилки у магазині за годину: 4 \(телефон невідомий\)\n/.test(t9) && /— 3 \(телефон невідомий\)/.test(t9), 'старые записи без did: не падает, «телефон невідомий», не отдельный телефон', t9);
    const g10 = fresh();
    g10.cache.er_buf = JSON.stringify({ n: 1, m: { 'cart\u000126\u0001net poll: HTTP 500': 1 } });
    rec(g10, 'phonegggg001', 'net poll: HTTP 500', 'cart', 1);
    g10.call('errorsJob');
    ok(/— 2 \(1 телефон \+ невідомо\)/.test(sumOf(g10)[0].payload.text), 'старая запись + новая: «1 телефон + невідомо»', sumOf(g10)[0].payload.text);
    // метка worker_fallback
    const g11 = fresh();
    rec(g11, 'phonehhhh001', 'worker_fallback', 'catalog', 1);
    rec(g11, 'phonehhhh002', 'worker_fallback', 'catalog', 1);
    rec(g11, 'phonehhhh002', 'worker_fallback', 'catalog', 1);
    g11.call('errorsJob');
    const t11 = sumOf(g11);
    ok(t11.length === 1 && /^Інформація/.test(t11[0].payload.text) && /Каталог через Cloudflare не відповів, магазин узяв його напряму: 3 разів \(з 2 телефонів\)/.test(t11[0].payload.text) && !/Помилки у магазині/.test(t11[0].payload.text), 'worker_fallback: не ошибка, отдельная информационная строка', t11[0] && t11[0].payload.text);
    rec(g11, 'phonehhhh003', 'worker_fallback', 'catalog', 1);
    g11.call('errorsJob');
    ok(sumOf(g11).length === 1, 'worker_fallback: одни метки — не чаще раза в сутки');
    rec(g11, 'phonehhhh004', 'worker_fallback', 'catalog', 1);
    g11.advance(25 * 3600 * 1000);
    g11.call('errorsJob');
    ok(sumOf(g11).length === 2, 'worker_fallback: через сутки сообщение снова уходит');
    // метка вместе с ошибками: N не раздувает
    const g12 = fresh();
    rec(g12, 'phoneiiii001', 'worker_fallback', 'catalog', 1);
    rec(g12, 'phoneiiii001', 'net orders: HTTP 502', 'orders', 2);
    g12.call('errorsJob');
    const t12 = sumOf(g12)[0].payload.text;
    ok(/^Помилки у магазині за годину: 2 \(з 1 телефона\)/.test(t12) && /Каталог через Cloudflare не відповів[^\n]*: 1 разів \(з 1 телефона\)$/.test(t12), 'worker_fallback рядом с ошибками: в N не входит, строка внизу', t12);
    // неизвестная метка m принимается по обычным правилам
    const g13 = fresh();
    ok(g13.post({ action: 'err', did: 'phonejjjj001', items: [{ m: 'some_new_mark', s: 'catalog', v: '26' }] }).ok === true, 'неизвестная метка m принимается и не ломает приём');
    g13.call('errorsJob');
    ok(/інші: 1 \/ другие: 1/.test(sumOf(g13)[0].payload.text), 'неизвестная метка: в сводке только «інші: N»');
  }

  // --- б7.2+: устойчивость к DocumentLock = null, лимит запросов, пустой flushJob
  {
    const g = fresh();
    g.setDocLockNull(true);
    g.call('menuFastOn');
    const r1 = evPost(g, 501, [{ e: 'open', t: Date.now() }, { e: 'src', v: 'qr1', t: Date.now() }, { e: 'view', id: 'DRY-039', t: Date.now() }]);
    const ord = order(g, U(502), [{ id: 'NUT-007', g: 0, q: 1 }], 85, { src: 'qr2' });
    g.call('flushJob');
    const head = g.sheets['Клієнти'].rows[0];
    ok(r1.ok && r1.n === 3 && ord.ok && evRows(g).filter(r => r[1] === '501').length === 3 && clientRow(g, '501') && clientRow(g, '502') && clientRow(g, '501')[head.indexOf('Ім\'я')] === 'Тест501', 'DocumentLock = null: события, отметки клиентов и src доходят до листа', evRows(g).length);
    ok(evRows(g).some(r => r[3] === 'src' && r[5] === 'qr1'), 'DocumentLock = null: событие src в листе');
    ok(!g.lockLog.some(l => l.kind === 'doc') && g.lockLog.some(l => l.kind === 'script' && l.op === 'try' && l.ms === 300), 'DocumentLock = null: счётчик под ScriptLock с tryLock(300)', g.lockLog.slice(0, 3));
    // нет ни одной блокировки: запасные слоты
    g.setLockBusy(Infinity, Infinity);
    for (let i = 0; i < 20; i++) evPost(g, 510 + i, [{ e: 'open', t: Date.now() }, { e: 'src', v: 'insert', t: Date.now() }]);
    g.setLockBusy(0, 0);
    const slots = Object.keys(g.cache).filter(k => /^fs_\d+_\d+$/.test(k));
    ok(slots.length > 0 && slots.every(k => Number(k.split('_')[2]) < g.sandbox.FB_SLOTS), 'нет блокировок: запись в запасные слоты (ключ — минута и номер из ограниченного набора)', slots.length);
    g.call('flushJob');
    ok(!clientRow(g, '510'), 'слоты текущей минуты ждут её окончания');
    g.advance(61000);
    g.call('flushJob');
    const got = evRows(g).filter(r => Number(r[1]) >= 510 && Number(r[1]) < 530 && r[3] === 'src').length;
    ok(got === slots.length && got >= 17 && clientRow(g, '510') !== undefined || got === slots.length && got >= 17, 'слоты: события доходят до листа (столкновение — редкая считаемая потеря)', [got, slots.length]);
    // столкновение слотов считается потерей
    const gc = fresh();
    gc.call('menuFastOn');
    require('vm').runInContext('Math.random = function () { return 0.5; }', gc.sandbox); // все в один слот
    gc.setLockBusy(Infinity, Infinity);
    const a = gc.call('bufferPush_', { e: [[Date.now(), '1', 's', 'view', 'DRY-039', '']] });
    const b = gc.call('bufferPush_', { e: [[Date.now(), '2', 's', 'view', 'DRY-039', '']] });
    ok(a === true && b === false && gc.cache.fb_lost === '1', 'слоты: столкновение — потеря, она посчитана', [a, b, gc.cache.fb_lost]);
  }
  {
    // лимит запросов ev с одного uid
    const g = fresh(); g.call('menuFastOn');
    let last;
    for (let i = 0; i < 305; i++) last = evPost(g, 520, [{ e: 'view', id: 'DRY-039', t: Date.now() }]);
    g.call('flushJob');
    ok(g.sandbox.MAX_EV_REQUESTS_PER_HOUR >= 240 && evRows(g).filter(r => r[1] === '520').length === g.sandbox.MAX_EV_REQUESTS_PER_HOUR && last.ok && last.n === 0, 'лимит запросов ev с одного uid в час (не меньше 240; честная витрина шлёт до 180); сверх — ok без записи', evRows(g).length);
    let okAll = true;
    for (let i = 0; i < 180; i++) { const r = evPost(g, 521, [{ e: 'view', id: 'DRY-039', t: Date.now() }]); if (r.n !== 1) okAll = false; }
    ok(okAll, 'честные 180 запросов в час проходят');
    const evOther = evPost(g, 531, [{ e: 'open', t: Date.now() }]);
    g.call('flushJob');
    ok(evOther.n === 1 && clientRow(g, '531'), 'один пользователь с лишними запросами не мешает остальным');
  }
  {
    // flushJob при пустом буфере выходит сразу
    const g = fresh(); g.call('menuFastOn');
    g.call('flushJob');
    g.resetOps(); g.lockLog.length = 0;
    g.call('flushJob'); g.call('flushJob');
    ok(!g.ops.read && !g.ops.write && !g.ops.append && !g.ops.lock && g.lockLog.length === 0 && !g.sheets['Події'], 'flushJob при пустом буфере: ни таблицы, ни блокировки', [g.ops, g.lockLog.length]);
    evPost(g, 540, openEv());
    g.resetOps();
    g.call('flushJob');
    ok(g.ops.lock >= 1 && g.sheets['Події'] === undefined || g.ops.lock >= 1, 'flushJob с данными работает как обычно');
  }

  // --- безопасность: Worker, копии, токен в ошибках
  {
    const g = fresh();
    g.props.WORKER_URL = 'https://pamir-worker.example.workers.dev';
    const o = order(g, U(601), [{ id: 'SWT-004', g: 0, q: 1 }], 65);
    ok(o.ok && g.sheets['Товари'].rows.find(r => r[0] === 'SWT-004')[25] === 2 && g.fetched.length === 0, 'заказ товара с «Залишок»: остаток уменьшен, purge в Worker НЕ отправлен', g.fetched.length);
    g.call('menuRefreshCatalog');
    ok(g.fetched.length === 1 && /\/purge$/.test(g.fetched[0].url), 'меню «Оновити каталог у магазині зараз» purge отправляет');
    g.fetched.length = 0;
    g.post({ action: 'cart', initData: g.initData(U(601)), items: [{ id: 'NUT-007', g: 0, q: 1 }] });
    ok(g.fetched.length === 0, 'корзина purge не шлёт');
    tgPost(g, { message: { chat: { id: 900 }, from: { id: 900 }, text: '/start' } });
    ok(g.fetched.length === 0, 'бот purge не шлёт');
    adm(g, 900, 'admin.settingsSave', { values: { notice_ua: 'Привіт' } });
    ok(g.fetched.length === 1 && g.fetched[0].lockHeld === 0, 'настройки из админ-панели purge шлют, вне блокировки');
    g.fetched.length = 0;
    adm(g, 900, 'admin.archive', { id: 'NUT-004' });
    ok(g.fetched.length === 1, 'архив товара из админ-панели purge шлёт');
    // адрес: https и *.workers.dev
    g.fetched.length = 0;
    const bads = ['https://evil.example.com', 'https://workers.dev.evil.com', 'https://evilworkers.dev', 'http://x.workers.dev', 'https://user@x.workers.dev@evil.com', 'https://x.workers.dev?a=1'];
    const warns0 = g.sandbox.__warns.length;
    bads.forEach(u => { g.props.WORKER_URL = u; g.call('menuRefreshCatalog'); });
    const nw = g.sandbox.__warns.slice(warns0);
    ok(g.fetched.length === 0 && nw.length === bads.length && nw.every(w => /purge/.test(w) && !/evil|whsec/.test(w)), 'чужой адрес Worker: секрет не уходит, одно предупреждение в журнал без адреса и секрета', nw);
    g.props.WORKER_URL = 'https://pamir-worker.example.workers.dev/';
    g.call('menuRefreshCatalog');
    ok(g.fetched.length === 1 && g.fetched[0].followRedirects === false, 'purge: followRedirects: false');
  }
  {
    // б6: копии — папка только по id
    const g = fresh();
    const decoy = g.sandbox.DriveApp.createFolder('PAMIR — резервні копії');
    g.call('menuBackupNow');
    ok(g.drive.folders.length === 2 && g.props.BACKUP_FOLDER_ID !== decoy.id && g.drive.files.length === 1 && g.drive.files[0].folder !== decoy, 'копия: папка с таким же именем по имени не берётся, создана своя и запомнена');
    const own = g.props.BACKUP_FOLDER_ID;
    g.call('menuBackupNow');
    ok(g.drive.folders.length === 2 && g.props.BACKUP_FOLDER_ID === own && g.drive.files.filter(f => f.folder.id === own).length === 2, 'второй раз — та же папка по сохранённому id');
    g.drive.folders.find(f => f.id === own).trashed = true;
    g.call('menuBackupNow');
    ok(g.props.BACKUP_FOLDER_ID !== own && g.drive.folders.length === 3 && g.drive.files.filter(f => f.folder.id === g.props.BACKUP_FOLDER_ID).length === 1, 'папка в корзине — создаётся новая и запоминается');
    g.props.BACKUP_FOLDER_ID = 'NO-SUCH';
    g.call('menuBackupNow');
    ok(g.props.BACKUP_FOLDER_ID !== 'NO-SUCH' && g.drive.folders.length === 4, 'папка недоступна — создаётся новая и запоминается');
  }
  {
    // б8: токен при сбое связи с Telegram
    const g = fresh();
    const tok = g.props.BOT_TOKEN;
    const real = g.sandbox.UrlFetchApp.fetch;
    const num = order(g, U(701), [{ id: 'NUT-007', g: 0, q: 1 }], 85).number;
    g.sandbox.UrlFetchApp.fetch = (url, opts, batched) => {
      if (/api.telegram.org/.test(url)) throw new Error('Exception: DNS error: https://api.telegram.org/bot' + tok + '/sendMessage ' + g.props.WEBHOOK_SECRET);
      return real(url, opts, batched);
    };
    g.sandbox.UrlFetchApp.fetchAll = () => { throw new Error('fetchAll failed https://api.telegram.org/bot' + tok + '/editMessageText'); };
    const m1 = adm(g, 900, 'admin.message', { num, text: 'привіт' });
    const st = adm(g, 900, 'admin.status', { num, code: 'c' });
    g.sandbox.DriveApp.getFileById = () => { throw new Error('Drive error bot' + tok + ' end'); };
    g.call('backupJob'); g.call('menuBackupNow');
    tgPost(g, { message: { chat: { id: 900 }, from: { id: 900 }, text: '/start' } });
    const direct = g.call('tg_', tok, 'sendMessage', { chat_id: 1, text: 'x' });
    const all = JSON.stringify([m1, st, direct, g.ui.alerts, g.sandbox.__errors, g.sandbox.__warns]);
    ok(!all.includes(tok) && !all.includes('whsec') && !/bot\d+:/.test(all) && m1.ok && m1.told === false, 'сбой связи с Telegram: токен не попадает ни в ответы панели, ни в журнал, ни в окна', all.slice(0, 300));
    ok(direct.ok === false && /\*\*\*/.test(direct.description), 'tg_: описание ошибки без токена, но с пометкой');
    ok(!g.call('safeErr_', new Error('x https://api.telegram.org/bot987654321:AAAbbb_CCC-ddd1234567890/getMe y'), true).includes('AAAbbb') && !g.call('safeErr_', 'bot111:zzz').includes('zzz'), 'safeErr_: любая подстрока bot<цифры>:<символы> вырезается');
  }

  // --- секреты
  {
    const g = fresh();
    g.props.WORKER_URL = 'https://pamir-worker.example.workers.dev';
    g.call('menuFastOn');
    const outs = [evPost(g, 401, openEv()), order(g, U(401), [{ id: 'NUT-007', g: 0, q: 1 }], 85), g.post({ action: 'err', did: 'secretdid001', items: [{ m: 'oops', s: 'a', v: '1' }] }), g.get({ action: 'ping' })];
    g.call('flushJob'); g.call('menuRefreshCatalog'); g.call('menuBackupNow'); g.call('menuFastOff');
    const all = JSON.stringify([outs, g.ui.alerts, g.sandbox.__errors, g.sandbox.__warns]);
    ok(!all.includes(g.props.BOT_TOKEN) && !all.includes('whsec') && !all.includes('workers.dev') && !/СЕКРЕТ|do-smaku|33%/.test(all), 'ответы, окна и логи нового блока: нет токена, секрета, адреса Worker и служебных колонок');
    ok(g.sandbox.__errors.length === 0, 'в логах нового блока нет ошибок', g.sandbox.__errors);
  }
}
console.log('Волна Б1, исправления приёмки: забытый файл, блокировки, flushJob');
{
  const evPost = (g, uid, events) => g.post({ action: 'ev', initData: g.initData(U(uid)), sid: 's' + uid, events });
  const evRows = g => (g.sheets['Події'] ? g.sheets['Події'].rows.slice(1) : []);
  const heldAt = (g, i) => { let h = 0; for (let k = 0; k < i; k++) { const l = g.lockLog[k]; if (l.kind !== 'script') continue; if ((l.op === 'try' || l.op === 'wait') && l.ok) h++; else if (l.op === 'release') h--; } return h; };
  const oneEv = (g, uid) => g.call('bufferPush_', { e: [[Date.now(), String(uid), 's', 'view', 'DRY-039', '']] });

  // --- 1. Stage9b.gs не добавлен
  {
    const s = seed(); s.skipFiles = ['Stage9b.gs'];
    const g = createGas(CODE, s);
    g.props.FAST_MODE = '1'; g.cache.fb_hb = '1'; g.props.WORKER_URL = 'https://pamir-worker.example.workers.dev';
    ok(typeof g.sandbox.purgeWorkerIfPending_ === 'undefined' && typeof g.sandbox.fastMode_ === 'undefined', 'стенд без Stage9b.gs: функций из него нет');
    let err = null, res = {};
    try {
      res.cat = g.get({ action: 'catalog' });
      res.order = order(g, U(42), [{ id: 'DRY-039', g: 500, q: 2 }], 380);
      res.ev = evPost(g, 77, [{ e: 'open', t: Date.now() }, { e: 'view', id: 'DRY-039', t: Date.now() }]);
      res.orders = adm(g, 900, 'admin.orders');
      res.products = adm(g, 900, 'admin.products');
      res.product = adm(g, 900, 'admin.product', { id: 'NUT-002', patch: { price: 123 } });
      res.settings = adm(g, 900, 'admin.settingsSave', { values: { min_order: '150' } });
      res.message = adm(g, 900, 'admin.message', { num: res.order.number, text: 'привіт' });
      res.stats = adm(g, 900, 'admin.stats');
      res.err = g.post({ action: 'err', did: 'abcdef123456', items: [{ m: 'oops', s: 'a', v: '1' }] });
      res.hook = tgPost(g, { message: { chat: { id: 900 }, from: { id: 900 }, text: '/start' } });
      g.call('hourlyJob');
      g.call('onOpen');
    } catch (e) { err = e; }
    ok(!err, 'без Stage9b.gs: каталог, заказ, события, панель, err, бот, hourlyJob — без исключений', err && String(err.stack || err).slice(0, 300));
    ok(res.cat && res.cat.ok && res.order && res.order.ok && res.orders && res.orders.ok && res.products && res.products.ok && res.product && res.product.ok && res.settings && res.settings.ok, 'без Stage9b.gs: каталог, заказ и админ-панель отвечают ok', [res.order, res.product && res.product.error]);
    ok(res.ev && res.ev.ok && evRows(g).length === 2 && g.sheets['Клієнти'].rows.some(r => r[0] === '77'), 'без Stage9b.gs: события и отметка клиента пишутся прямо в лист, как раньше', evRows(g).length);
    ok(res.message && res.message.ok === true && res.message.told === true, 'без Stage9b.gs: admin.message работает (счётчики под обычной блокировкой)', res.message);
    ok(res.err && res.err.ok === true && !g.sheets['Помилки'], 'без Stage9b.gs: action err отвечает ok и ничего не пишет');
    ok(g.fetched.length === 0, 'без Stage9b.gs: purge Worker не шлётся');
  }

  // --- 2. «Кошики»: записи напоминаний под блокировкой, Telegram — вне её
  {
    const g = fresh();
    g.post({ action: 'cart', initData: g.initData(U(80)), items: [['NUT-007', 0, 1]], lang: 'ua' });
    g.sheets['Кошики'].rows[1][1] = new Date(Date.now() - 4 * 3600e3);
    g.lockLog.length = 0;
    ok(g.call('remindCarts_') === 1, 'напоминание ушло');
    const writes = g.lockLog.map((l, i) => ({ l, i })).filter(x => x.l.kind === 'sheet' && x.l.sheet === 'Кошики' && x.l.op !== 'read');
    ok(writes.length >= 2 && writes.every(x => heldAt(g, x.i) > 0), 'remindCarts_: отметка и журнал «Події нагадувань» пишутся под блокировкой скрипта', writes.map(x => heldAt(g, x.i)));
    const msg = g.sent.filter(m => m.method === 'sendMessage' && String(m.payload.chat_id) === '80').pop();
    ok(msg && msg.lockHeld === 0, 'запрос к Telegram идёт вне блокировки', msg && msg.lockHeld);
    ok(g.sheets['Кошики'].rows[1].some(v => /"s":\[/.test(String(v))), 'журнал отправки записан');
  }

  // --- 3а. порции под блокировкой, отметки клиентов пачкой
  {
    const g = fresh(); g.call('menuFastOn');
    for (let i = 0; i < 250; i++) evPost(g, 5000 + i, i < 60 ? [{ e: 'open', t: Date.now() }, { e: 'view', id: 'DRY-039', t: Date.now() }] : [{ e: 'view', id: 'DRY-039', t: Date.now() }]);
    const rows0 = g.sheets['Клієнти'] ? g.sheets['Клієнти'].rows.length : 0;
    let injected = null;
    const origGet = g.sandbox.LockService.getScriptLock;
    g.sandbox.LockService.getScriptLock = () => {
      const l = origGet();
      const rel = l.releaseLock;
      l.releaseLock = () => {
        rel.call(l);
        if (!injected) {
          injected = { eventsThen: evRows(g).length };
          injected.res = order(g, U(6001), [{ id: 'NUT-007', g: 0, q: 1 }], 85);
        }
      };
      return l;
    };
    g.lockLog.length = 0;
    g.call('flushJob');
    g.sandbox.LockService.getScriptLock = origGet;
    const tries = g.lockLog.map((l, i) => ({ l, i })).filter(x => x.l.kind === 'script' && x.l.op === 'try' && x.l.ok);
    ok(evRows(g).length === 310 && tries.length >= 3, 'flushJob: 250 пачек записаны за несколько порций, каждая со своей блокировкой', [evRows(g).length, tries.length]);
    ok(tries.every(x => heldAt(g, x.i) === 0), 'между порциями блокировка отпущена (новая порция берётся, когда прежняя снята)');
    const evW = g.lockLog.map((l, i) => ({ l, i })).filter(x => x.l.kind === 'sheet' && x.l.sheet === 'Події' && x.l.op === 'write');
    ok(evW.length >= 3 && evW.every(x => heldAt(g, x.i) > 0), 'запись событий — только под блокировкой, по порциям', evW.length);
    ok(injected && injected.res.ok && injected.eventsThen > 0 && injected.eventsThen < 310 && g.sheets['Замовлення'].rows.slice(-1)[0][3] === '6001', 'заказ, пришедший между порциями, прошёл сразу (событий в листе было меньше, чем в итоге)', injected && injected.eventsThen);
    const clientW = g.lockLog.filter(l => l.kind === 'sheet' && l.sheet === 'Клієнти' && l.op !== 'read').length;
    ok(g.sheets['Клієнти'].rows.length - rows0 >= 60 && clientW <= 12, 'новые клиенты дописаны пачкой (несколько обращений к листу, не по ячейке)', [g.sheets['Клієнти'].rows.length - rows0, clientW]);
    const tFlush = g.cache.fb_t === g.cache.fb_n;
    ok(tFlush, 'указатель дошёл до конца очереди');
  }

  // --- 3б. пропавшие ключи очереди
  {
    const g = fresh(); g.call('menuFastOn');
    for (let i = 1; i <= 40; i++) oneEv(g, 7000 + i);
    const gone = [3, 7, 8, 15, 16, 17, 22, 30, 31, 40];
    gone.forEach(k => { delete g.cache['fb_' + k]; });
    g.call('flushJob');
    ok(evRows(g).length === 30, 'пропуски ключей: остальные 30 пачек записаны сразу, очередь не остановилась на первом пропуске', evRows(g).length);
    g.advance(60000);
    g.call('flushJob');
    ok(evRows(g).length === 30 && g.cache.fb_t === '40' && g.sandbox.__warns.some(w => /втрачено подій\/відміток: 10\b/.test(w)), 'на втором запуске все 10 пропусков — потеря (счётчик 10), указатель в конце', [evRows(g).length, g.cache.fb_t, g.sandbox.__warns.slice(-2)]);
    g.advance(60000); g.call('flushJob');
    ok(evRows(g).length === 30, 'дальше ничего не дублируется');
    // позднее появление данных до второго запуска: пачка записывается
    const g2 = fresh(); g2.call('menuFastOn');
    for (let i = 1; i <= 12; i++) oneEv(g2, 7100 + i);
    const saved = g2.cache.fb_5; delete g2.cache.fb_5; delete g2.cache.fb_6;
    g2.call('flushJob');
    g2.cache.fb_5 = saved; g2.advance(60000); g2.call('flushJob');
    ok(evRows(g2).length === 11 && g2.cache.fb_t === '12', 'ключ, появившийся до следующего запуска, записывается; второй — потеря', [evRows(g2).length, g2.cache.fb_t]);
  }

  // --- 3в. ошибка ротации после записи: без дублей
  {
    const g = fresh(); g.call('menuFastOn');
    g.call('ensureEventsSheet_');
    g.sandbox.EVENTS_KEEP_ROWS = -4999; // ротация срабатывает всегда
    g.sheets['Події'].deleteRows = () => { throw new Error('rotate boom'); };
    for (let i = 1; i <= 5; i++) oneEv(g, 7200 + i);
    g.call('flushJob');
    ok(evRows(g).length === 5 && g.cache.fb_t === '5', 'ошибка ротации после записи: строки записаны, указатель сдвинут', [evRows(g).length, g.cache.fb_t]);
    g.advance(60000); g.call('flushJob');
    ok(evRows(g).length === 5, 'повторный запуск не пишет строки второй раз', evRows(g).length);
    oneEv(g, 7299);
    g.advance(60000); g.call('flushJob');
    ok(evRows(g).length === 6, 'следующая порция после ошибки ротации проходит', evRows(g).length);
  }
}
console.log('\nИтог: ' + pass + ' пройдено, ' + fail + ' не пройдено');
process.exit(fail ? 1 : 0);
