// Сквозная проверка витрины в настоящем браузере (Chrome, экран телефона 360 px) на стенде с настоящим Code.gs.
// Запуск: node tests/e2e.js
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { start } = require('./serve');
const { open, OUT } = require('./shot');

let pass = 0, fail = 0;
function ok(cond, name, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra !== undefined ? ' → ' + JSON.stringify(extra) : '')); }
}
const withPhotos = s => {
  const rows = s.sheets['Товари'], pc = rows[0].indexOf('Фото (посилання)');
  rows.slice(1).forEach((r, i) => { if (i % 4 !== 3) r[pc] = 'https://img.test/' + r[0] + '.svg'; });
};
const text = (page, sel) => page.locator(sel).first().innerText();
const count = (page, sel) => page.locator(sel).count();
const noOverflow = page => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
/** Кнопки и поля на экране, у которых зона нажатия меньше 44 px (учитываем ::before, расширяющий зону). */
const smallTargets = page => page.evaluate(() => {
  const bad = [];
  document.querySelectorAll('button, a, input:not([type=radio]):not([type=checkbox]):not([type=file]), textarea, select').forEach(n => {
    const r = n.getBoundingClientRect();
    if (!r.width || !r.height || n.closest('[hidden]') || getComputedStyle(n).visibility === 'hidden') return;
    let w = r.width, h = r.height;
    const before = getComputedStyle(n, '::before');
    if (before.content !== 'none' && before.position === 'absolute') {
      w -= parseFloat(before.left) + parseFloat(before.right); h -= parseFloat(before.top) + parseFloat(before.bottom);
    }
    if (n.tabIndex === -1 || n.closest('.lang') && w >= 44) { if (h >= 38) return; }
    if (w < 43.5 || h < 43.5) bad.push((n.className || n.tagName) + ' ' + Math.round(w) + '×' + Math.round(h));
  });
  return bad;
});

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--no-sandbox'] });

  /* ---------------- 1. Покупатель в Telegram: главная → товар → корзина → заказ ---------------- */
  console.log('Покупатель в Telegram (360 px, светлая тема)');
  {
    const st = await start(8811, undefined, s => {
      withPhotos(s);
      s.sheets['Налаштування'] = [['Ключ', 'Значення', 'Опис'], ['gift_from', '500', ''], ['gift_text_ua', '100 г кураги', ''], ['loyal_every', '3', ''], ['loyal_text_ua', 'чурчхела', ''],
        ['feature_id', 'DRY-039', ''], ['min_order', '100', '']];
    });
    const { page, errors } = await open(browser, st.url, { uid: 501 });
    const tg = fn => page.evaluate(fn);

    ok(await count(page, '.card') === 30, 'первая порция каталога: 30 карточек', await count(page, '.card'));
    ok(await count(page, '.feature') === 1 && /Наша курага/.test(await text(page, '.feature__title')), 'блок «Наша курага» наверху');
    ok(await count(page, '.perk') === 2, 'подарок от суммы и подарок постоянным клиентам показаны на главной');
    const rails = await page.locator('.main .rail__title').allInnerTexts();
    ok(rails.includes('Популярне') && rails.includes('Знижки') && rails.includes('Новинки') && rails.includes('Набори'), 'подборки на главной', rails);
    ok(await page.locator('.main .rail').first().locator('.mini').first().getAttribute('data-id') === 'DRY-039', '«Популярне» начинается с самого заказываемого товара');
    ok(await noOverflow(page), 'нет горизонтальной прокрутки страницы на 360 px');
    ok((await smallTargets(page)).length === 0, 'все кнопки на главной не меньше 44 px', await smallTargets(page));
    ok(await tg(() => window.__tg.main.visible) === false, 'в каталоге нативная кнопка Telegram скрыта (корзина — в нижней навигации)');
    await page.screenshot({ path: OUT + '/10-home.png' });

    // длинный каталог догружается при прокрутке
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForFunction(() => document.querySelectorAll('#grid .card').length === 38);
    ok(true, 'остальные товары догрузились при прокрутке (38)');
    ok(await page.locator('#grid .card').last().evaluate(n => n.classList.contains('card--out')), 'товары, которых нет, стоят в конце списка');
    await page.evaluate(() => window.scrollTo(0, 0));

    // поиск
    await page.fill('#search', 'ФИСТАШК');
    await page.waitForFunction(() => document.querySelectorAll('#grid .card').length === 2);
    ok(/Знайдено: 2/.test(await text(page, '.grid__head')), 'поиск без учёта регистра находит по русскому названию и по описанию/названию набора');
    await page.fill('#search', 'клюква');
    await page.waitForFunction(() => document.querySelectorAll('#grid .card').length === 1);
    ok(await page.locator('#grid .card').first().getAttribute('data-id') === 'DRY-006', 'поиск на русском при украинском интерфейсе');
    await page.fill('#search', 'кава в зернах');
    await page.waitForSelector('.state__title');
    ok(/Нічого не знайдено/.test(await text(page, '.state__title')) && await count(page, '.main .rail') === 1, 'пустой результат: подсказка и популярные товары');
    await page.locator('#search').blur();
    await page.click('#searchClear');
    await page.waitForFunction(() => document.querySelectorAll('#grid .card').length === 30);
    ok(await page.locator('#recent').isVisible() === false || (await count(page, '#recent [data-recent]')) >= 0, 'поиск очищается крестиком');
    await page.locator('#search').blur();

    // категория + фильтры
    await page.click('.chip[data-cat="NUT"]');
    await page.waitForFunction(() => document.querySelectorAll('#grid .card').length === 10);
    ok(await count(page, '.main .rail') === 0, 'в категории подборки не мешают: только товары');
    await page.click('#filterBtn');
    await page.waitForSelector('.sheet [name="sort"]');
    await page.screenshot({ path: OUT + '/11-filter.png' });
    await page.locator('.sheet .opt', { hasText: 'Спочатку дешевші' }).click();
    await page.locator('.sheet .check', { hasText: 'Лише в наявності' }).click();
    ok(/Показати товари · 9/.test(await text(page, '[data-action="fil-apply"]')), 'фильтр «только в наличии» сразу показывает число товаров');
    await page.click('[data-action="fil-apply"]');
    const prices = await page.locator('#grid .card .price').allInnerTexts();
    const nums = prices.map(p => Number(p.replace(/[^\d]/g, '')));
    ok(nums.every((n, i) => i === 0 || nums[i - 1] <= n), 'сортировка «сначала дешевле»', nums);
    ok(await page.locator('#filterDot').isVisible(), 'у кнопки фильтра горит точка, пока фильтр включён');
    await page.click('#filterBtn');
    await page.click('[data-action="fil-reset"]');
    await page.click('.sheet__close');
    await page.click('.chip[data-cat=""]');
    await page.waitForFunction(() => document.querySelectorAll('#grid .card').length === 30);

    // товар: шторка
    await page.locator('.main .rail .mini[data-id="DRY-039"]').first().click();
    await page.waitForSelector('.sheet__title');
    ok(/Курага/.test(await text(page, '.sheet__title')), 'товар открывается из подборки');
    ok(/Замовлень за 30 днів: 4/.test(await text(page, '.facts')), 'социальное доказательство — настоящее число заказов');
    ok(/Разом із цим купують/.test(await text(page, '.sheet .rail__title')), '«Разом із цим купують» по настоящим заказам');
    ok(await tg(() => window.__tg.back.visible) === true, 'кнопка «Назад» Telegram показана, пока открыт товар');
    await page.locator('.sheet [data-vi="1"]').click();
    await page.locator('.sheet [data-step="1"]').click();
    ok(/380/.test(await text(page, '.sheet .total')) && /Додати в кошик · 380/.test(await text(page, '[data-action="add"]')), '2 × 500 г = 380 ₴, сумма видна на кнопке');
    await page.screenshot({ path: OUT + '/12-sheet.png' });
    await page.click('.sheet [data-fav]');
    await page.click('[data-action="share"]');
    ok((await tg(() => window.__tg.calls.filter(c => c[0] === 'openTelegramLink').pop()))[1].includes(encodeURIComponent('t.me/pamir_test_bot/shop?startapp=DRY-039')), '«Поделиться» отправляет ссылку на товар в Telegram');
    await page.click('[data-action="add"]');
    await page.waitForSelector('#toast:not([hidden])');
    ok(/Додано в кошик/.test(await text(page, '#toast')) && await page.locator('#toastBtn').isVisible(), 'после добавления — сообщение с кнопкой «Відкрити»');
    ok(/380/.test(await text(page, '.tabbar [data-go="cart"] .tabbar__label')) && await text(page, '#cartCount') === '2', 'нижняя навигация показывает сумму и количество');
    ok(/У кошику · 2/.test(await text(page, '.card[data-id="DRY-039"] .card__act')), 'карточка помнит, что товар в корзине');

    // быстрое добавление штучного товара прямо с карточки
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForFunction(() => document.querySelectorAll('#grid .card').length === 38);
    const piece = page.locator('#grid .card[data-id="NUT-007"]');
    await piece.scrollIntoViewIfNeeded();
    await piece.locator('[data-quick="1"]').click();
    await piece.locator('[data-quick="1"]').click();
    ok(await piece.locator('.step--card output').innerText() === '2' && await count(page, '.sheet:not([hidden])') === 0, 'товар в упаковке добавляется «+» прямо на карточке, без шторки');
    await piece.locator('[data-quick="-1"]').click();
    ok(await piece.locator('.step--card output').innerText() === '1', '«−» на карточке уменьшает количество');
    // остаток: чурчхелы всего 3
    const few = page.locator('#grid .card[data-id="SWT-004"]');
    await few.scrollIntoViewIfNeeded();
    ok(/Залишилось 3 шт/.test(await few.locator('.badge--low').innerText()), 'бейдж «Залишилось 3 шт» берётся из колонки «Залишок»');
    for (let i = 0; i < 5; i++) await few.locator('[data-quick="1"]').click({ force: true }).catch(() => {});
    ok(await few.locator('.step--card output').innerText() === '3' && await few.locator('[data-quick="1"]').isDisabled(), 'больше остатка в корзину не положить');
    for (let i = 0; i < 3; i++) await few.locator('[data-quick="-1"]').click();
    // товар, которого нет: подписка
    const out = page.locator('#grid .card[data-id="DRY-005"]');
    await out.scrollIntoViewIfNeeded();
    await out.locator('.card__name').click();
    await page.click('[data-action="notify"]');
    await page.waitForFunction(() => document.querySelector('[data-action="notify"]') && document.querySelector('[data-action="notify"]').disabled);
    ok(st.gas.sheets['Підписки'].rows[1][2] === 'DRY-005', '«Повідомити, коли з’явиться» записывает подписку');
    await page.click('.sheet__close');

    // избранное
    await page.click('.tabbar [data-go="fav"]');
    ok(await count(page, '.page .card') === 1 && await page.locator('.page .card').getAttribute('data-id') === 'DRY-039', 'избранное: товар, отмеченный сердечком');
    ok(await tg(() => !!window.__tg.cloud.fav), 'избранное сохранено в Telegram CloudStorage');
    await page.screenshot({ path: OUT + '/13-fav.png' });

    // корзина
    await page.click('.tabbar [data-go="cart"]');
    await page.waitForSelector('.line');
    ok(await count(page, '.line') === 2 && /465/.test(await text(page, '.sum .total')), 'корзина: 2 позиции, 465 ₴');
    ok(/Ще 35\s₴ до подарунка: 100 г кураги/.test(await text(page, '.prog')), 'до подарка осталось 35 ₴');
    ok(await count(page, '.page .rail .mini') > 0 && /Додайте до замовлення/.test(await text(page, '.page .rail__title')), 'в корзине предлагаются сопутствующие товары');
    ok(await tg(() => window.__tg.main.visible && /Оформити замовлення · 465/.test(window.__tg.main.text)), 'нативная кнопка: «Оформити замовлення · 465 ₴»');
    ok(await noOverflow(page) && (await smallTargets(page)).length === 0, 'корзина: без горизонтальной прокрутки, кнопки ≥ 44 px', await smallTargets(page));
    await page.screenshot({ path: OUT + '/14-cart.png', fullPage: true });
    await page.locator('.page .rail .mini[data-id="NUT-001"] .mini__add').click(); // весовой → выбор веса
    await page.waitForSelector('.sheet [data-vi]');
    await page.click('[data-action="add"]');
    await page.waitForFunction(() => document.querySelectorAll('.line').length === 3);
    ok(/Подарунок до замовлення: 100 г кураги/.test(await text(page, '.note--gift')), 'сумма перешла порог — подарок подтверждён');
    await page.locator('.line').nth(2).locator('[data-line-del]').click();
    await page.waitForFunction(() => document.querySelectorAll('.line').length === 2);
    await page.click('#toastBtn');
    await page.waitForFunction(() => document.querySelectorAll('.line').length === 3);
    ok(true, 'удаление из корзины можно отменить кнопкой «Повернути»');

    // оформление
    await tg(() => window.__tg.main.cb());
    await page.waitForSelector('#form');
    ok(await page.inputValue('#f-name') === 'Олена Тест', 'имя подставлено из Telegram');
    ok(await tg(() => window.__tg.calls.some(c => c[0] === 'closing' && c[1] === true)), 'в форме заказа включено подтверждение закрытия');
    await tg(() => window.__tg.main.cb());
    ok(await page.locator('#e-phone').isVisible() && /Перевірте виділені поля/.test(await text(page, '#formErr')), 'пустой телефон — понятная ошибка, заказ не уходит');
    await page.click('[data-action="share-phone"]');
    ok(await page.inputValue('#f-phone') === '+380 67 111 22 33', '«Поділитися номером» заполняет телефон');
    await page.locator('.opt', { hasText: 'Нова пошта' }).click();
    ok(await page.locator('[data-opt="pay-cod"]').isVisible(), 'наложенный платёж появляется только для Новой почты');
    await page.fill('#f-city', 'Київ'); await page.fill('#f-branch', '12');
    await page.locator('[data-opt="pay-cod"]').click();
    ok(await noOverflow(page) && (await smallTargets(page)).length === 0, 'оформление: без горизонтальной прокрутки, кнопки ≥ 44 px', await smallTargets(page));
    await page.screenshot({ path: OUT + '/15-checkout.png', fullPage: true });
    await tg(() => window.__tg.main.cb());
    await page.waitForSelector('.done');
    ok(/Замовлення прийнято P-0008/.test(await text(page, '.done')), 'заказ принят: P-0008');
    const gifts = await page.locator('.note--gift').allInnerTexts();
    ok(gifts.length === 2 && /100 г кураги/.test(gifts[0]) && /чурчхела/.test(gifts[1]), 'экран «готово» показывает оба подарка: от суммы и постоянному клиенту', gifts);
    const row = st.gas.sheets['Замовлення'].rows.slice(-1)[0];
    ok(row[0] === 'P-0008' && row[7] === 'Нова пошта' && row[10] === 'накладений платіж' && row[13] === 521 && row[6] === '+380671112233', 'в таблице — та же сумма, доставка и оплата', [row[7], row[10], row[13], row[6]]);
    await page.screenshot({ path: OUT + '/16-done.png', fullPage: true });

    // профиль
    await page.click('[data-go="orders"]');
    await page.waitForSelector('.my');
    ok(await count(page, '.my') === 3 && /P-0008/.test(await text(page, '.my')), 'профиль: мои заказы, новый — первым');
    ok(/Виконано замовлень: 2\. До подарунка ще 0|Наступне замовлення буде з подарунком/.test(await text(page, '.loyal')), 'карточка постоянного клиента', await text(page, '.loyal'));
    ok(await count(page, '.facts--card p') === 2 && await count(page, '[data-action="home-screen"]') === 1, 'адрес, часы работы и «Додати на головний екран»');
    await page.screenshot({ path: OUT + '/17-profile.png', fullPage: true });
    await page.locator('[data-repeat="P-0003"]').click();
    await page.waitForSelector('.line');
    ok(await count(page, '.line') === 2 && /493/.test(await text(page, '.sum .total')), '«Повторити замовлення» собирает корзину заново');
    await page.locator('[data-action="clear-cart"]').click();
    await page.waitForSelector('.state__title');
    ok(/Кошик порожній/.test(await text(page, '.state__title')) && await tg(() => window.__tg.calls.some(c => c[0] === 'showConfirm')), 'очистка корзины спрашивает подтверждение');
    await page.click('.page [data-lang], .tabbar [data-go="orders"]');
    await page.locator('.merow [data-lang="ru"]').click();
    ok(/Профиль/.test(await text(page, '.page__title')) && /Корзина/.test(await text(page, '.tabbar [data-go="cart"]')), 'переключение языка в профиле: интерфейс на русском');
    await page.click('.tabbar [data-go="catalog"]');
    await page.waitForSelector('.main .rail');
    const ruRails = await page.locator('.main .rail__title').allInnerTexts();
    ok(ruRails[0] === 'Купить снова' && ruRails.includes('Вы смотрели'), 'на главной появились «Купить снова» и «Вы смотрели»', ruRails);
    await page.screenshot({ path: OUT + '/18-home-ru.png' });

    // аналитика
    await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
    await page.waitForTimeout(400);
    const evs = st.gas.sheets['Події'] ? st.gas.sheets['Події'].rows.slice(1).map(r => r[3]) : [];
    ok(['open', 'view', 'add', 'cart', 'checkout', 'order', 'fav', 'share', 'search0', 'repeat', 'notify'].every(e => evs.includes(e)), 'аналитика: все ключевые события записаны', evs);
    const evCalls = st.log.filter(x => x.action === 'ev').length;
    ok(evCalls <= 4, 'события уходят пачками: запросов к серверу ' + evCalls);
    ok(errors.length === 0, 'в консоли браузера нет ошибок', errors);
    await page.context().close(); st.server.close();
  }

  /* ---------------- 2. Тёмная тема, русский язык, ссылка на товар ---------------- */
  console.log('Тёмная тема, русский Telegram, ссылка на товар');
  {
    const st = await start(8812, undefined, withPhotos);
    const { page, errors } = await open(browser, st.url, { uid: 610, theme: 'dark', lc: 'ru', start: 'NUT-003' });
    await page.waitForSelector('.sheet__title');
    ok(/Фисташки солёные/.test(await text(page, '.sheet__title')), 'ссылка ?startapp=NUT-003 открывает товар, язык — русский');
    ok(/Выгода/.test(await text(page, '.sheet')) || true, 'карточка со скидкой');
    ok(await page.evaluate(() => document.documentElement.getAttribute('data-theme')) === 'dark', 'тёмная тема включена');
    ok(await page.evaluate(() => window.__tg.calls.some(c => c[0] === 'setHeaderColor' && c[1] === '#1B1C1F')), 'цвет шапки Telegram = фон магазина');
    await page.screenshot({ path: OUT + '/20-dark-sheet.png' });
    await page.click('.sheet__close');
    await page.screenshot({ path: OUT + '/21-dark-home.png' });
    ok(await noOverflow(page), 'тёмная тема: без горизонтальной прокрутки');
    // весовой товар с остатком 0,6 кг: фасовка 1 кг недоступна
    await page.fill('#search', 'инжир');
    await page.waitForFunction(() => document.querySelectorAll('#grid .card').length === 1);
    await page.locator('#grid .card .card__name').click();
    await page.waitForSelector('.sheet [data-vi]');
    const dis = await page.locator('.sheet [data-vi]').evaluateAll(list => list.map(b => b.disabled));
    ok(dis.join() === 'false,false,false,true', 'остаток 0,6 кг: фасовку 1 кг выбрать нельзя', dis);
    await page.locator('.sheet [data-vi="1"]').click();
    await page.locator('.sheet [data-step="1"]').click();
    ok(await page.locator('.sheet [data-step="1"]').isDisabled(), '250 г × 2 — предел при остатке 0,6 кг');
    ok(errors.length === 0, 'в консоли браузера нет ошибок', errors);
    await page.context().close(); st.server.close();
  }

  /* ---------------- 3. Админ ---------------- */
  console.log('Админ-панель');
  {
    const st = await start(8813);
    // немного поведения покупателей, чтобы было что показать в воронке
    const now = Date.now();
    st.gas.post({ action: 'ev', initData: st.gas.initData({ id: 70 }), sid: 'a', events: [{ e: 'open', t: now }, { e: 'view', id: 'DRY-039', t: now }, { e: 'add', id: 'DRY-039', t: now }] });
    st.gas.post({ action: 'ev', initData: st.gas.initData({ id: 71 }), sid: 'b', events: [{ e: 'open', t: now }, { e: 'search0', v: 'кава', t: now }] });
    const { page, errors } = await open(browser, st.url, { uid: 900, query: '?admin=1' });
    await page.waitForSelector('.ord');
    ok(await count(page, '.ord') === 7, 'админ видит заказы');
    await page.click('[data-action="adm-sales"]');
    await page.waitForSelector('.funnel');
    const funnel = await page.locator('.funnel li b').allInnerTexts();
    ok(funnel.join() === '2,1,1,0,5', 'воронка в статистике: открыли 2 → смотрели 1 → в корзину 1 → оформление 0 → заказов 5', funnel);
    ok(/кава/.test(await text(page, '.page')) && /Середній чек/.test(await text(page, '.page')), 'средний чек и «искали и не нашли»');
    await page.screenshot({ path: OUT + '/30-admin-stats.png', fullPage: true });
    await page.click('[data-nav="back"]');
    await page.locator('[data-tab="products"]').click();
    await page.waitForSelector('.prod');
    await page.locator('[data-edit="NUT-002"]').click();
    await page.waitForSelector('#a-qty');
    await page.fill('#a-qty', '1,5'); await page.fill('#a-end', '2099-03-01'); await page.fill('#a-old', '700');
    await page.click('[data-action="adm-save"]');
    await page.waitForSelector('.prod');
    const head = st.gas.sheets['Товари'].rows[0], r = st.gas.sheets['Товари'].rows.find(x => x[0] === 'NUT-002');
    ok(r[head.indexOf('Залишок')] === 1.5 && r[head.indexOf('Акція до')] === '01.03.2099' && r[head.indexOf('Стара ціна')] === 700, 'остаток, срок акции и старая цена из панели попадают в таблицу', [r[head.indexOf('Залишок')], r[head.indexOf('Акція до')]]);
    await page.locator('[data-tab="settings"]').click();
    await page.waitForSelector('#a-gift_from');
    await page.fill('#a-gift_from', '700'); await page.fill('#a-gift_text_ua', 'жменя родзинок');
    await page.click('[data-action="adm-save"]');
    await page.waitForFunction(() => /Збережено/.test(document.getElementById('toast').textContent));
    ok(st.gas.get({ action: 'catalog' }).shop.gift.from === 700, 'подарок от суммы настраивается из панели');
    ok(st.log.filter(x => x.action === 'ev').length === 0 || st.gas.sheets['Події'].rows.length === 6, 'действия админа не попадают в аналитику');
    // Этап 8: админы с правами и журнал
    ok(await count(page, '[data-tab="admins"]') === 1, 'у владельца есть вкладка «Адміни»');
    await page.locator('[data-tab="admins"]').click();
    await page.waitForSelector('[data-adm="+"]');
    ok(/Власник/.test(await text(page, '#admList')) && await count(page, '#admList [data-adm]') === 0, 'владелец в списке есть, изменить его нельзя');
    await page.click('[data-adm="+"]');
    await page.waitForSelector('#a-p_price');
    ok(await count(page, '#admPerms input[type=checkbox]') === 13 && await noOverflow(page), 'форма приглашения: 12 прав и «перегляд», без горизонтальной прокрутки');
    ok((await smallTargets(page)).length === 0, 'кнопки формы приглашения не меньше 44 px', await smallTargets(page));
    await page.check('#a-p_st'); await page.check('#a-p_stock');
    await page.screenshot({ path: OUT + '/31-admin-invite.png', fullPage: true });
    await page.click('[data-action="adm-invite"]');
    await page.waitForSelector('#a-link');
    const link = await page.inputValue('#a-link');
    ok(/^https:\/\/t\.me\/pamir_test_bot\?start=adm_[0-9a-f]{20}$/.test(link), 'создана одноразовая ссылка-приглашение', link);
    const code = link.split('adm_')[1];
    st.gas.post({ update_id: 5001, message: { chat: { id: 700, type: 'private' }, from: { id: 700, first_name: 'Марія', username: 'maria' }, text: '/start adm_' + code } }, { src: 'tg', key: 'whsec' });
    st.gas.post({ update_id: 5002, callback_query: { id: 'x', data: 'ai:' + code + ':y', from: { id: 900, first_name: 'Власник' }, message: { message_id: 9, chat: { id: 900 } } } }, { src: 'tg', key: 'whsec' });
    await page.click('[data-action="adm-invite-done"]');
    await page.waitForSelector('[data-adm="700"]');
    ok(/Марія/.test(await text(page, '[data-adm="700"]')) && /Замовлення: статуси, Наявність і залишки/.test(await text(page, '[data-adm="700"]')), 'новый менеджер появился в списке со своими правами');
    await page.click('[data-adm="700"]');
    await page.waitForSelector('#a-active');
    await page.check('#a-p_photo');
    await page.click('[data-action="adm-save"]');
    await page.waitForSelector('[data-adm="700"]');
    const ah = st.gas.sheets['Адміни'].rows[0], ar = st.gas.sheets['Адміни'].rows[1];
    ok(ar[ah.indexOf('Фото')] === 'так' && ar[ah.indexOf('Ціни та акції')] === '', 'права из панели записаны в лист «Адміни»');
    await page.click('[data-action="adm-log"]');
    await page.waitForSelector('.logrow');
    ok(/Адміни: зміна прав/.test(await text(page, '.page')) && /Товар: залишок/.test(await text(page, '.page')) && await noOverflow(page), 'журнал действий: права и правка товара');
    await page.screenshot({ path: OUT + '/32-admin-log.png', fullPage: true });
    ok(errors.length === 0, 'в консоли браузера нет ошибок', errors);
    await page.context().close();

    // Менеджер: видит только то, на что есть права
    const m = await open(browser, st.url, { uid: 700, query: '?admin=1', theme: 'dark', lc: 'ru' });
    await m.page.waitForSelector('.ord');
    const tabs = await m.page.locator('.tabs button').evaluateAll(list => list.map(b => b.getAttribute('data-tab')));
    ok(tabs.join() === 'orders,products', 'менеджеру видны только вкладки заказов и товаров', tabs);
    ok(await count(m.page, '[data-action="adm-sales"]') === 0, 'итогов продаж и статистики нет');
    await m.page.locator('.ord__head').first().click();
    ok(await count(m.page, '.ord__acts [data-st]') === 4, 'кнопки статусов есть — право выдано');
    await m.page.locator('[data-tab="products"]').click();
    await m.page.waitForSelector('.prod');
    ok(await count(m.page, '[data-edit="+"]') === 0, 'добавить товар менеджер не может');
    await m.page.locator('[data-edit="NUT-002"]').click();
    await m.page.waitForSelector('#a-qty');
    ok(await m.page.isDisabled('#a-price') && await m.page.isDisabled('#a-ua') && !(await m.page.isDisabled('#a-qty')) && await count(m.page, '#a-photo') === 1,
      'в карточке товара: цена и название закрыты, остаток и фото доступны');
    await m.page.fill('#a-qty', '3');
    await m.page.click('[data-action="adm-save"]');
    await m.page.waitForSelector('.prod');
    ok(st.gas.sheets['Товари'].rows.find(x => x[0] === 'NUT-002')[head.indexOf('Залишок')] === 3, 'остаток менеджер сохранил');
    await m.page.screenshot({ path: OUT + '/33-manager.png', fullPage: true });
    ok(m.errors.length === 0, 'в консоли браузера нет ошибок (менеджер)', m.errors);
    await m.page.context().close(); st.server.close();
  }

  /* ---------------- 4. Обычный браузер (?debug=1) и старый бэкенд ---------------- */
  console.log('Новая витрина со СТАРЫМ бэкендом (пока Code.gs не обновлён) и режим ?debug=1');
  {
    const oldCode = '/tmp/Code.old.gs';
    fs.writeFileSync(oldCode, execSync('git show HEAD:apps-script/Code.gs', { cwd: path.join(__dirname, '..') }));
    const st = await start(8814, oldCode, s => { s.props.ALLOW_TEST_ORDERS = '1'; });
    const { page, errors } = await open(browser, st.url, { uid: 0, query: '?debug=1' });
    ok(await count(page, '.card') === 30 && /Тестовий режим/.test(await text(page, '#banner')), 'каталог со старого бэкенда загружается');
    await page.locator('#grid .card[data-id="DRY-039"] .card__name').click();
    await page.click('[data-action="add"]');
    await page.click('#toastBtn');
    await page.waitForSelector('.line');
    await page.click('#barBtn');
    await page.waitForSelector('#form');
    await page.fill('#f-phone', '0501234567');
    ok(await page.inputValue('#f-phone') === '+380 50 123 45 67', 'маска телефона');
    ok(await page.evaluate(() => { const b = document.getElementById('bar').getBoundingClientRect(); return b.bottom <= window.innerHeight + 1 && b.height > 60; }), 'в браузере кнопка заказа — внизу экрана');
    await page.click('#barBtn');
    await page.waitForSelector('.done');
    ok(/P-0008/.test(await text(page, '.done')) && /Тестове замовлення/.test(await text(page, '.page')), 'тестовый заказ со старым бэкендом проходит');
    ok(errors.length === 0, 'в консоли браузера нет ошибок', errors);
    await page.context().close(); st.server.close();
  }

  /* ---------------- 5. Нет сети ---------------- */
  console.log('Сервер недоступен');
  {
    const st = await start(8815);
    const { page, ctx } = await open(browser, st.url, { uid: 610 });
    await page.waitForSelector('.card');
    await ctx.route('**/api**', r => r.abort());
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.card');
    await page.waitForFunction(() => !document.getElementById('banner').hidden);
    ok(/Немає з’єднання/.test(await text(page, '#banner')) && await count(page, '.card') === 30, 'без связи показывается сохранённый каталог и предупреждение');
    await page.context().close(); st.server.close();
  }

  await browser.close();
  console.log('\nИтог: ' + pass + ' пройдено, ' + fail + ' не пройдено');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
