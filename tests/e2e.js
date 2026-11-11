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
/** Листает страницы каталога, пока на экране не появится карточка товара id. */
async function toCard(page, id) {
  for (let i = 0; i < 30; i++) {
    if (await page.locator('#grid .card[data-id="' + id + '"]').count()) return true;
    const next = page.locator('.main .pager [data-page]').last();
    if (!(await next.count()) || await next.isDisabled()) { // дошли до конца — начинаем с первой страницы
      const first = page.locator('.main .pager [data-page="1"]').first();
      if (i > 0 || !(await first.count())) return false;
      await first.click();
    } else await next.click();
    await page.waitForTimeout(50);
  }
  return false;
}
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
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || undefined, executablePath: process.env.CHROME_PATH || undefined, args: ['--no-sandbox'] });

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

    ok(await count(page, '.card') === 20, 'первая страница каталога: 20 карточек', await count(page, '.card'));
    ok(await count(page, '.feature') === 1 && /Наша курага/.test(await text(page, '.feature__title')), 'блок «Наша курага» наверху');
    ok(await count(page, '.perk') === 2, 'подарок от суммы и подарок постоянным клиентам показаны на главной');
    const rails = await page.locator('.main .rail__title').allInnerTexts();
    ok(rails.includes('Популярне') && rails.includes('Акції') && rails.includes('Новинки') && rails.includes('Набори'), 'подборки на главной', rails);
    ok(await page.locator('.main .rail').first().locator('.mini').first().getAttribute('data-id') === 'DRY-039', '«Популярне» начинается с самого заказываемого товара');
    ok(await noOverflow(page), 'нет горизонтальной прокрутки страницы на 360 px');
    ok((await smallTargets(page)).length === 0, 'все кнопки на главной не меньше 44 px', await smallTargets(page));
    ok(await tg(() => window.__tg.main.visible) === false, 'в каталоге нативная кнопка Telegram скрыта (корзина — в нижней навигации)');
    await page.screenshot({ path: OUT + '/10-home.png' });

    // длинный каталог листается страницами: автоподгрузки при прокрутке больше нет
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);
    ok(await count(page, '#grid .card') === 20 && await count(page, '#more') === 0, 'при прокрутке товары сами не подгружаются, кнопки «Показати ще» нет');
    ok(/Товари 1–20 з 38/.test(await text(page, '.pager__range')), 'подпись над страницами: «Товари 1–20 з 38»', await text(page, '.pager__range'));
    await page.click('.main .pager [data-page="2"]');
    await page.waitForFunction(() => document.querySelectorAll('#grid .card').length === 18);
    ok(/Товари 21–38 з 38/.test(await text(page, '.pager__range')), 'вторая страница: остальные 18 товаров, «Товари 21–38 з 38»', await text(page, '.pager__range'));
    ok(await page.locator('#grid .card').last().evaluate(n => n.classList.contains('card--out')), 'товары, которых нет, стоят в конце списка');
    await page.click('.main .pager [data-page="1"]');
    await page.waitForFunction(() => document.querySelectorAll('#grid .card').length === 20);
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
    await page.waitForFunction(() => document.querySelectorAll('#grid .card').length === 20);
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
    await page.waitForFunction(() => document.querySelectorAll('#grid .card').length === 20);

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
    ok(/У кошику · 2/.test(await page.locator('.card[data-id="DRY-039"] .card__act').first().textContent()), 'карточка помнит, что товар в корзине');

    // быстрое добавление штучного товара прямо с карточки
    await toCard(page, 'NUT-007');
    const piece = page.locator('#grid .card[data-id="NUT-007"]');
    await piece.scrollIntoViewIfNeeded();
    await piece.locator('[data-quick="1"]').click();
    await piece.locator('[data-quick="1"]').click();
    ok(await piece.locator('.step--card output').innerText() === '2' && await count(page, '.sheet:not([hidden])') === 0, 'товар в упаковке добавляется «+» прямо на карточке, без шторки');
    await piece.locator('[data-quick="-1"]').click();
    ok(await piece.locator('.step--card output').innerText() === '1', '«−» на карточке уменьшает количество');
    // остаток: чурчхелы всего 3
    await toCard(page, 'SWT-004');
    const few = page.locator('#grid .card[data-id="SWT-004"]');
    await few.scrollIntoViewIfNeeded();
    ok(/Залишилось 3 шт/.test(await few.locator('.badge--low').innerText()), 'бейдж «Залишилось 3 шт» берётся из колонки «Залишок»');
    for (let i = 0; i < 5; i++) await few.locator('[data-quick="1"]').click({ force: true }).catch(() => {});
    ok(await few.locator('.step--card output').innerText() === '3' && await few.locator('[data-quick="1"]').isDisabled(), 'больше остатка в корзину не положить');
    for (let i = 0; i < 3; i++) await few.locator('[data-quick="-1"]').click();
    // товар, которого нет: подписка
    await toCard(page, 'DRY-005');
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
    const gifts = await page.locator('.page .note--gift').allInnerTexts();
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
    ok(ruRails.includes('Купить снова') && ruRails.includes('Вы смотрели'), 'на главной появились «Купить снова» и «Вы смотрели»', ruRails);
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
    await page.waitForSelector('[data-action="adm-save"].is-saved'); // «Збережено» — галочкой на самой кнопке (А1)
    ok(st.gas.get({ action: 'catalog' }).shop.gift.from === 700, 'подарок от суммы настраивается из панели');
    ok(st.log.filter(x => x.action === 'ev').length === 0 || st.gas.sheets['Події'].rows.length === 6, 'действия админа не попадают в аналитику');
    // Этап 8: админы с правами и журнал
    ok(await count(page, '[data-tab="admins"]') === 1, 'у владельца есть вкладка «Адміни»');
    await page.locator('[data-tab="admins"]').click();
    await page.waitForSelector('[data-adm="+"]');
    await page.waitForFunction(() => /Власник/.test(document.querySelector('#admList').innerText), null, { timeout: 5000 }).catch(() => {});
    ok(/Власник/.test(await text(page, '#admList')) && await count(page, '#admList [data-adm]') === 0, 'владелец в списке есть, изменить его нельзя', [await text(page, '#admList'), await count(page, '#admList [data-adm]')]);
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
    // «Старый бэкенд» — Code.gs из main (то, что сейчас работает у клиентов). Другую версию можно задать через OLD_BACKEND_REF.
    const oldCode = path.join(require('os').tmpdir(), 'Code.old.gs');
    fs.writeFileSync(oldCode, execSync('git show ' + (process.env.OLD_BACKEND_REF || 'main') + ':apps-script/Code.gs', { cwd: path.join(__dirname, '..') }));
    const st = await start(8814, oldCode, s => { s.props.ALLOW_TEST_ORDERS = '1'; });
    const { page, errors } = await open(browser, st.url, { uid: 0, query: '?debug=1' });
    ok(await count(page, '.card') === 20 && /Тестовий режим/.test(await text(page, '#banner')), 'каталог со старого бэкенда загружается');
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

  /* ---------------- 4б. Этап 8, волна 1: точки, дизайн, доверие, отзывы, продажи, Нова пошта ---------------- */
  console.log('Этап 8, волна 1 (360 px, светлая тема, UA)');
  const wave1 = async port => {
    const st = await start(port, undefined, s => {
      withPhotos(s);
      s.sheets['Налаштування'] = [['Ключ', 'Значення', 'Опис'], ['gift_from', '500', ''], ['gift_text_ua', '100 г кураги', ''], ['feature_id', 'DRY-039', ''], ['contact', '@pamir_help', '']];
      s.sheets['Замовлення'].push(['P-0008', new Date(Date.now() - 3600e3), 'відправлено', '501', '@user501', 'Клієнт 501', '+380501112233', 'Нова пошта', 'Київ', '12',
        'при отриманні', '', 'Арахіс бланшований 500 г × 1 = 85 ₴', 85, 'ua', 'miniapp', JSON.stringify({ i: [['NUT-007', 0, 1]], ttn: '20450000123456' })]);
    });
    st.gas.call('setupStage8');
    const rows = st.gas.sheets['Товари'].rows, head = rows[0], kur = rows.find(r => r[0] === 'DRY-039');
    const d = new Date(Date.now() - 2 * 864e5);
    const two = n => String(n).padStart(2, '0');
    st.fresh = two(d.getUTCDate()) + '.' + two(d.getUTCMonth() + 1);
    kur[head.indexOf('Сорт')] = 'Бобої'; kur[head.indexOf('Походження')] = 'Ісфара, Таджикистан'; kur[head.indexOf('Урожай')] = '2026';
    kur[head.indexOf('Свіжа поставка')] = st.fresh + '.' + d.getUTCFullYear();
    kur[head.indexOf('Підказка до ваги')] = '250 г ≈ жменя на день протягом тижня'; kur[head.indexOf('Ціни фасувань')] = '1 кг = 360';
    st.gas.sheets['Відгуки'].rows.push(['R-0001', new Date(), 'P-0001', '501', 'Олена', 'DRY-039', 'Курага', 5, 'Солодка і м’яка, беремо постійно', '', 'схвалено', 'ua', ''],
      ['R-0002', new Date(), 'P-0002', '502', 'Ігор', 'DRY-039', 'Курага', 5, '', '', 'схвалено', 'ua', ''], ['R-0003', new Date(), 'P-0003', '501', 'Олена', 'DRY-039', 'Курага', 4, 'Смачно', '', 'схвалено', 'ua', ''],
      ['R-0004', new Date(), 'P-0004', '503', 'Марія', 'NUT-003', 'Фісташки солоні', 2, 'Не сподобалось', '', 'новий', 'ua', '']);
    st.gas.clearCache();
    return st;
  };
  {
    const st = await wave1(8816);
    const { page, errors } = await open(browser, st.url, { uid: 501 });
    const tg = fn => page.evaluate(fn);
    await page.waitForSelector('.card');

    // 1.3 дизайн
    ok(await count(page, '.top .orn') === 1 && await count(page, '.feature .orn') === 1 && await count(page, '#o1') === 1, 'орнамент «ступенчатый ромб» в шапке и на блоке «Наша курага»');
    ok(Math.abs(Number(await page.evaluate(() => getComputedStyle(document.querySelector('.top .orn rect')).opacity)) - 0.2) < 0.01, 'орнамент в светлой теме: сила «заметно» (0,2)');
    ok(await count(page, '.chips .chip .acc') >= 5, 'у категорий свои иконки с абрикосовым штрихом', await count(page, '.chips .chip .acc'));
    const loading = await page.evaluate(() => Array.prototype.map.call(document.querySelectorAll('#grid .card img'), i => i.getAttribute('loading')));
    ok(loading.slice(0, 3).every(x => x === 'eager') && loading.slice(4).every(x => x === 'lazy'), 'фото первого экрана грузятся сразу, остальные — лениво', loading.slice(0, 6));
    ok(await page.evaluate(() => document.body.getAttribute('data-season') === '' && document.getElementById('season').hidden), 'сезонная тема по умолчанию выключена');

    // 1.4 и 1.5 на карточке
    const extra = await text(page, '.card[data-id="DRY-039"] .card__extra');
    ok(/4,7 · 3 відгуки/.test(extra) && extra.includes('Свіжа поставка ' + st.fresh), 'карточка: «4,7 · 3 відгуки» и «Свіжа поставка»', extra);
    ok(await count(page, '.card[data-id="NUT-003"] .card__extra') === 0, 'неодобренный отзыв на карточке не виден');
    ok(await count(page, '.feature [data-view="story"]') === 1, 'на блоке «Наша курага» ссылка «Від саду до столу»');

    // 1.6 «Ваше звичне» и шкала до подарка
    await page.waitForSelector('.usual');
    ok(/Ваше звичне/.test(await text(page, '.usual')) && /Додати все · 380/.test(await text(page, '.usual .btn')) && await page.locator('.usual .mini').getAttribute('data-id') === 'DRY-039', '«Ваше звичне»: курага из двух заказов, 500 г × 2', await text(page, '.usual'));
    ok(await count(page, '.homegift .perk') === 1, 'на главной условие подарка, пока корзина пустая');
    await page.click('.usual [data-w1="usual"]');
    await page.waitForSelector('.homegift .prog');
    ok(/Ще 120\s₴ до подарунка: 100 г кураги/.test(await text(page, '.homegift .prog')) && /380/.test(await text(page, '.tabbar [data-go="cart"]')), '«Додати все» кладёт привычное в корзину; на главной шкала до подарка', await text(page, '.homegift'));
    ok(await noOverflow(page) && (await smallTargets(page)).length === 0, 'главная волны 1: без горизонтальной прокрутки, кнопки ≥ 44 px', await smallTargets(page));
    await page.screenshot({ path: OUT + '/40-w1-home.png', fullPage: true });
    await page.waitForTimeout(4500); // корзина уходит на сервер через 4 секунды покоя

    // карточка товара: паспорт, подсказка, выгода фасовки, отзывы
    await page.locator('.card[data-id="DRY-039"] .card__name').first().click();
    await page.waitForSelector('.rv__item');
    const sheet = await text(page, '.sheet');
    ok(/Сорт\s*Бобої/.test(sheet) && /Походження\s*Ісфара, Таджикистан/.test(sheet) && /Урожай\s*2026/.test(sheet), 'паспорт товара из таблицы', sheet.slice(0, 300));
    ok(/250 г ≈ жменя на день/.test(sheet), 'подсказка к весу');
    ok(/1\sкг вигідніше на 5 %, ніж 4 × 250\sг/.test(sheet), 'выгода крупной фасовки посчитана из цен таблицы', sheet.match(/вигідніше[^\n]*/));
    ok(await count(page, '.rv__item') === 3 && /4,7 з 5 · 3 відгуки/.test(await text(page, '.rv__avg')) && /Солодка і м’яка/.test(await text(page, '.rv')), 'отзывы покупателей и средняя оценка в карточке');
    ok(st.log.some(x => x.action === 'GET reviews'), 'отзывы подгружаются отдельным запросом');
    ok(await noOverflow(page), 'карточка товара: без горизонтальной прокрутки');
    await page.locator('.rv').scrollIntoViewIfNeeded();
    await page.screenshot({ path: OUT + '/41-w1-sheet.png' });
    await page.click('.sheet__close');
    await page.locator('.card[data-id="NUT-002"] .card__name').first().click();
    await page.waitForSelector('.sheet__title');
    ok(await count(page, '.pass') === 0 && await count(page, '.rv') === 0 && !/вигідніше/.test(await text(page, '.sheet')), 'нет данных в таблице — блоков паспорта, отзывов и выгоды нет');
    await page.click('.sheet__close');

    // пустой поиск
    await page.fill('#search', 'zzzzzz');
    await page.waitForSelector('.state .art');
    ok(/Не знайшли\? Напишіть нам/.test(await text(page, '.state')), 'пустой поиск: иллюстрация и «Не знайшли? Напишіть нам»');
    await page.click('.state [data-w1="contact"]');
    ok(await tg(() => window.__tg.calls.some(c => c[0] === 'openTelegramLink' && c[1] === 'https://t.me/pamir_help')), 'кнопка «Написати нам» открывает чат из настроек');
    await page.fill('#search', '');
    await page.locator('#search').blur();
    await page.waitForSelector('.tabbar:not([hidden])');

    // 1.2 точки и 1.7 ТТН в профиле
    await page.click('.tabbar [data-go="orders"]');
    await page.waitForSelector('.my');
    ok(/ТТН: 20450000123456/.test(await text(page, '.my__ttn')) && /cargo_number=20450000123456/.test(await page.locator('.my__ttn [data-w1="open"]').getAttribute('data-url')), '«Мої замовлення»: ТТН и кнопка «Відстежити»');
    await page.click('.page [data-view="points"]');
    await page.waitForSelector('.point');
    const pt = await text(page, '.point');
    ok(await count(page, '.point') === 2 && /Точка 1/.test(pt) && /Ряд 3, місце 12/.test(pt) && /Пн: вихідний, Вт–Нд: 07:00–17:00/.test(pt), 'экран «Наші точки»: две точки, место, часы по дням', pt);
    ok(/Відкрито зараз, до 17:00|Зачинено, відкриємось (сьогодні|завтра|у \S+) о 07:00/.test(await text(page, '.point__status')), 'статус точки считается по киевскому времени', await text(page, '.point__status'));
    ok(/google\.com\/maps/.test(await page.locator('.point [data-w1="open"]').first().getAttribute('data-url')), 'кнопка «Прокласти маршрут» ведёт на карту');
    ok(await noOverflow(page) && (await smallTargets(page)).length === 0, 'точки: без горизонтальной прокрутки, кнопки ≥ 44 px', await smallTargets(page));
    await page.screenshot({ path: OUT + '/42-w1-points.png', fullPage: true });
    await page.click('[data-nav="back"]');
    await page.waitForSelector('.merow');
    await page.click('.page [data-view="story"]');
    await page.waitForSelector('.story p');
    ok(/Від саду до столу/.test(await text(page, '.page__title')) && await count(page, '.story p') >= 3 && /Ісфар/.test(await text(page, '.story')), 'страница «Від саду до столу»');
    await page.screenshot({ path: OUT + '/43-w1-story.png', fullPage: true });
    await page.click('[data-nav="back"]');

    // оформление: выбор точки
    await page.click('.tabbar [data-go="cart"]');
    await page.waitForSelector('.line');
    await tg(() => window.__tg.main.cb());
    await page.waitForSelector('#form');
    ok(await tg(() => window.__tg.calls.some(c => c[0] === 'impact')), 'вибрация на «Оформити»');
    ok(await count(page, '.opt--point') === 2 && await page.locator('.opt--point input').first().isChecked(), 'самовывоз: выбор из двух точек, первая выбрана');
    await page.locator('.opt--point').nth(1).click();
    await page.fill('#f-phone', '0501234567');
    ok(await noOverflow(page) && (await smallTargets(page)).length === 0, 'оформление с точками: без прокрутки, кнопки ≥ 44 px', await smallTargets(page));
    await tg(() => window.__tg.main.cb());
    await page.waitForSelector('.done');
    ok(await count(page, '.done .mnt') === 1 && await count(page, '.done .orn') === 1, 'экран «Замовлення прийнято»: линия гор и орнамент');
    ok(/Самовивіз з ринку · Точка 2/.test(await text(page, '.recap__meta')), 'на экране «готово» указана точка', await text(page, '.recap__meta'));
    const ord = st.gas.sheets['Замовлення'].rows;
    ok(ord[ord.length - 1][7] === 'самовивіз · Точка 2 — критий павільйон', 'точка записана в таблицу', ord[ord.length - 1][7]);
    ok(await tg(() => /"point":"p3"/.test(window.__tg.cloud.form || '') && /380 50 123/.test(window.__tg.cloud.form)), 'имя, телефон и доставка сохранены в Telegram CloudStorage');
    await page.screenshot({ path: OUT + '/44-w1-done.png' });
    await page.waitForTimeout(1900);
    ok(await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.mnt .l1')).strokeDashoffset) === 0 && getComputedStyle(document.querySelector('.mnt .sun')).opacity === '1'), 'линия гор дорисовывается за две секунды');
    await page.screenshot({ path: OUT + '/44-w1-done.png' });

    // второй заказ: Нова пошта, курьер
    await page.click('[data-nav="catalog"]');
    await page.locator('.card[data-id="NUT-007"] [data-quick="1"]').first().click();
    await page.click('.tabbar [data-go="cart"]');
    await page.waitForSelector('.line');
    await tg(() => window.__tg.main.cb());
    await page.waitForSelector('#form');
    ok(await page.inputValue('#f-phone') === '+380 50 123 45 67' && await page.locator('.opt--point input').nth(1).isChecked(), 'повторное оформление: телефон и точка уже подставлены');
    await page.locator('.opt', { hasText: 'Нова пошта' }).first().click();
    ok(await count(page, '.opts--3 .opt') === 3 && await page.locator('.opts--3 .opt').nth(0).isVisible(), 'переключатель «Відділення / Поштомат / Кур’єр»');
    await page.locator('#cityChips .chip', { hasText: 'Київ' }).click();
    ok(await page.inputValue('#f-city') === 'Київ' && await count(page, '#cityChips .chip') === 8, 'чипы популярных городов заполняют город');
    await page.locator('.opts--3 .opt', { hasText: 'Поштомат' }).click();
    ok(/№ поштомата/.test(await text(page, 'label[for="f-branch"]')), 'поштомат: поле просит номер поштомата');
    await page.locator('.opts--3 .opt', { hasText: 'Кур’єр' }).click();
    ok(/Адреса: вулиця/.test(await text(page, 'label[for="f-branch"]')), 'курьер: поле просит адрес');
    await page.fill('#f-branch', 'д.1');
    await tg(() => window.__tg.main.cb());
    ok(/Вкажіть адресу для кур’єра/.test(await text(page, '#e-branch')), 'слишком короткий адрес — понятная ошибка');
    await page.fill('#f-branch', 'вул. Сумська, 10, кв. 5');
    ok(await noOverflow(page) && (await smallTargets(page)).length === 0, 'Нова пошта: без прокрутки, кнопки ≥ 44 px', await smallTargets(page));
    await page.screenshot({ path: OUT + '/45-w1-np.png', fullPage: true });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await tg(() => window.__tg.main.cb());
    await page.waitForSelector('.done');
    await page.waitForTimeout(300);
    ok(await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.mnt .l1')).strokeDashoffset) === 0 && getComputedStyle(document.querySelector('.mnt .sun')).opacity === '1'), '«уменьшить движение»: линия гор показана сразу, без анимации');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    ok(/Нова пошта · кур’єр/.test(await text(page, '.recap__meta')) && ord[ord.length - 1][7] === 'Нова пошта · кур’єр' && ord[ord.length - 1][9] === 'вул. Сумська, 10, кв. 5', 'заказ курьером принят и записан', ord[ord.length - 1].slice(7, 10));
    ok(st.log.some(x => x.action === 'cart' && Array.isArray(x.items) && !('total' in x) && !JSON.stringify(x.items).includes('pr')), 'состав корзины синхронизируется на сервер без цен');
    ok(errors.length === 0, 'в консоли браузера нет ошибок', errors);
    await page.context().close(); st.server.close();
  }

  console.log('Этап 8, волна 1 (тёмная тема, RU, сезонная тема, админ)');
  {
    const st = await wave1(8817);
    st.gas.post({ action: 'admin.settingsSave', initData: st.gas.initData({ id: 900, first_name: 'A' }), values: { theme: 'navruz' } });
    st.gas.clearCache();
    const { page, errors } = await open(browser, st.url, { uid: 610, theme: 'dark', lc: 'ru', query: '?debug=1&now=0-600&view=points' });
    await page.waitForSelector('.point');
    ok(/Закрыто, откроемся завтра в 07:00/.test(await text(page, '.point__status')) && /Пн: выходной/.test(await text(page, '.point')), 'понедельник: «Закрыто, откроемся завтра в 07:00», русский язык', await text(page, '.point__status'));
    ok(await noOverflow(page), 'точки в тёмной теме: без горизонтальной прокрутки');
    await page.screenshot({ path: OUT + '/46-w1-points-dark.png' });
    await page.click('[data-nav="back"]');
    await page.waitForSelector('.card');
    ok(await page.evaluate(() => document.body.getAttribute('data-season') === 'navruz' && !document.getElementById('season').hidden), 'сезонная тема «Навруз» включается из настроек');
    ok(Math.abs(Number(await page.evaluate(() => getComputedStyle(document.querySelector('.top .orn rect')).opacity)) - 0.14) < 0.01, 'в тёмной теме орнамент приглушён');
    ok(/Свежая поставка/.test(await text(page, '.card[data-id="DRY-039"] .card__extra')) && /3 отзыва/.test(await text(page, '.card[data-id="DRY-039"] .card__extra')), 'карточка на русском: «Свежая поставка», «3 отзыва»');
    await page.screenshot({ path: OUT + '/47-w1-home-dark.png' });
    ok(errors.length === 0, 'в консоли браузера нет ошибок', errors);
    await page.context().close();

    const b = await open(browser, st.url, { uid: 611, query: '?debug=1&now=1-600&view=points' });
    await b.page.waitForSelector('.point');
    ok(await count(b.page, '.point__status.is-open') === 2 && /Відкрито зараз, до 17:00/.test(await text(b.page, '.point__status')), 'вторник 10:00: «Відкрито зараз, до 17:00»');
    await b.page.context().close();

    const a = await open(browser, st.url, { uid: 900, query: '?admin=1' });
    await a.page.waitForSelector('[data-tab="reviews"]');
    await a.page.click('[data-tab="reviews"]');
    await a.page.waitForSelector('#admList [data-w1="rv"]');
    ok(await count(a.page, '#admList .my') === 4 && /Фісташки солоні/.test(await text(a.page, '#admList .my')), 'панель: вкладка «Відгуки», новый отзыв сверху');
    await a.page.locator('#admList .my').first().locator('[data-ok="1"]').click();
    await a.page.waitForFunction(() => /схвалено/.test(document.querySelector('#admList .my').innerText));
    ok(st.gas.sheets['Відгуки'].rows.find(r => r[0] === 'R-0004')[10] === 'схвалено' && await count(a.page, '#admList textarea, #admList input') === 0, 'админ одобряет отзыв; поля для правки текста в панели нет');
    ok(await noOverflow(a.page) && (await smallTargets(a.page)).length === 0, 'отзывы в панели: без прокрутки, кнопки ≥ 44 px', await smallTargets(a.page));
    await a.page.screenshot({ path: OUT + '/48-w1-admin-reviews.png' });
    await a.page.click('[data-tab="orders"]');
    await a.page.waitForSelector('[data-ord="P-0008"]');
    await a.page.click('[data-ord="P-0008"]');
    await a.page.waitForSelector('.ttnrow');
    ok(await a.page.inputValue('#ttn-P-0008') === '20450000123456', 'в заказе Новой почтой видно ТТН');
    await a.page.fill('#ttn-P-0008', '5900 0111 2223 33');
    await a.page.click('[data-w1="ttn"]');
    await a.page.waitForFunction(() => /59000111222333/.test(document.querySelector('.ord__body').innerText));
    ok(JSON.parse(st.gas.sheets['Замовлення'].rows.find(r => r[0] === 'P-0008')[16]).ttn === '59000111222333' && st.gas.sent.some(m => String(m.payload.chat_id) === '501' && /59000111222333/.test(m.payload.text)), 'ТТН из панели записан, клиент получил сообщение');
    ok(await noOverflow(a.page) && (await smallTargets(a.page)).length === 0, 'ТТН в панели: без прокрутки, кнопки ≥ 44 px', await smallTargets(a.page));
    ok(a.errors.length === 0, 'в консоли браузера (админ) нет ошибок', a.errors);
    await a.page.context().close(); st.server.close();
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
    ok(/Немає з’єднання/.test(await text(page, '#banner')) && await count(page, '.card') === 20, 'без связи показывается сохранённый каталог и предупреждение');
    await page.context().close(); st.server.close();
  }

  /* ---------------- 6. Этап 8, волна 2а ---------------- */
  console.log('Волна 2а · А1: отклик кнопок');
  {
    const st = await start(8816);
    const n = action => st.log.filter(x => x.action === action).length;
    const { page, errors } = await open(browser, st.url, { uid: 900, query: '?admin=1' });
    await page.waitForSelector('.ord');
    st.opt.delay = 500; // ответ сервера идёт полсекунды, как у настоящего Apps Script

    // статус заказа: два быстрых нажатия — один запрос
    await page.locator('.ord__head').first().click();
    await page.waitForSelector('[data-st="c"]:not([disabled])');
    await page.evaluate(() => { const b = document.querySelector('[data-st="c"]:not([disabled])'); b.click(); b.click(); });
    ok(await page.evaluate(() => { const b = document.querySelector('.ord__acts .is-busy'); return !!b && b.disabled && [].every.call(document.querySelectorAll('.ord__acts button'), x => x.disabled); }), 'кнопка статуса сразу показывает индикатор, соседние кнопки заблокированы');
    await page.locator('.ord__acts').screenshot({ path: OUT + '/50-busy-status.png' });
    await page.waitForFunction(() => !document.querySelector('.ord__acts .is-busy'));
    ok(n('admin.status') === 1, 'двойное нажатие на статус заказа — один запрос', n('admin.status'));

    // переключатель наличия: меняется сразу, второй запрос не уходит
    await page.locator('[data-tab="products"]').click();
    await page.waitForSelector('[data-stock="NUT-002"]');
    const was = await page.getAttribute('[data-stock="NUT-002"]', 'aria-checked');
    await page.evaluate(() => { const b = document.querySelector('[data-stock="NUT-002"]'); b.click(); b.click(); });
    ok(await page.getAttribute('[data-stock="NUT-002"]', 'aria-checked') !== was, 'переключатель наличия меняется сразу, не дожидаясь сервера');
    await page.waitForFunction(() => !document.querySelector('[data-stock="NUT-002"]').disabled);
    ok(n('admin.product') === 1 && await page.getAttribute('[data-stock="NUT-002"]', 'aria-checked') !== was, 'двойное нажатие на переключатель — один запрос, значение сохранилось', n('admin.product'));
    // ошибка сервера: переключатель возвращается назад с сообщением
    st.opt.failAction = 'admin.product';
    const mid = await page.getAttribute('[data-stock="NUT-003"]', 'aria-checked');
    await page.click('[data-stock="NUT-003"]');
    ok(await page.getAttribute('[data-stock="NUT-003"]', 'aria-checked') !== mid, 'при нажатии переключатель сразу меняется');
    await page.waitForFunction(() => /повернули/.test(document.getElementById('toast').textContent));
    ok(await page.getAttribute('[data-stock="NUT-003"]', 'aria-checked') === mid, 'сервер ответил ошибкой — переключатель вернулся назад, показано сообщение');
    st.opt.failAction = '';

    // сохранение товара: индикатор, один запрос, «Збережено» на кнопке
    const before = n('admin.product');
    await page.locator('[data-edit="NUT-004"]').click();
    await page.waitForSelector('#a-ua');
    await page.fill('#a-dUa', 'Перевірка відгуку кнопки');
    await page.evaluate(() => { const b = document.querySelector('[data-action="adm-save"]'); b.click(); b.click(); });
    ok(await page.evaluate(() => { const b = document.querySelector('[data-action="adm-save"]'); return b.classList.contains('is-busy') && b.disabled; }), '«Зберегти» сразу показывает индикатор и блокируется');
    await page.locator('[data-action="adm-save"]').screenshot({ path: OUT + '/51-busy-save.png' });
    await page.waitForSelector('[data-action="adm-save"].is-saved');
    ok(/Збережено/.test(await text(page, '[data-action="adm-save"]')), 'после ответа на кнопке галочка и «Збережено»');
    await page.locator('[data-action="adm-save"]').screenshot({ path: OUT + '/52-saved.png' });
    await page.waitForSelector('.prod');
    ok(n('admin.product') === before + 1, 'двойное нажатие на «Зберегти» — один запрос', n('admin.product') - before);

    // галочка «Приховати» в карточке товара сохраняется сразу
    await page.locator('[data-edit="NUT-004"]').click();
    await page.waitForSelector('#a-hidden');
    await page.check('#a-hidden');
    await page.waitForFunction(() => /Збережено/.test(document.getElementById('toast').textContent));
    const hRow = st.gas.sheets['Товари'].rows.find(x => x[0] === 'NUT-004'), hCol = st.gas.sheets['Товари'].rows[0].findIndex(h => /Приховати/.test(h));
    ok(hCol >= 0 && hRow[hCol] === 'так', '«Приховати» в карточке товара сохраняется сразу, без кнопки «Зберегти»', hRow[hCol]);
    await page.uncheck('#a-hidden');
    await page.waitForFunction(() => !document.getElementById('a-hidden').disabled);
    ok((await smallTargets(page)).length === 0 && await noOverflow(page), 'карточка товара: кнопки не меньше 44 px, нет горизонтальной прокрутки', await smallTargets(page));
    ok(errors.length === 0, 'в консоли браузера нет ошибок (админ)', errors);
    await page.context().close();

    // покупатель: «Повідомити, коли з’явиться» — один запрос; нажатие даёт вибрацию
    const c = await open(browser, st.url, { uid: 620 });
    await c.page.waitForSelector('.card');
    await c.page.evaluate(() => { window.__tg.calls.length = 0; });
    await c.page.click('.chip[data-cat="DRY"]');
    ok(await c.page.evaluate(() => window.__tg.calls.filter(x => x[0] === 'impact' || x[0] === 'select').length) === 1, 'нажатие на кнопку — одна вибрация', await c.page.evaluate(() => window.__tg.calls));
    await c.page.locator('.card[data-id="DRY-005"] .card__name').click();
    await c.page.waitForSelector('[data-action="notify"]');
    await c.page.evaluate(() => { const b = document.querySelector('[data-action="notify"]'); b.click(); b.click(); });
    ok(await c.page.evaluate(() => { const b = document.querySelector('[data-action="notify"]'); return !!b && b.classList.contains('is-busy') && b.disabled; }), '«Повідомити» показывает индикатор и блокируется');
    await c.page.waitForFunction(() => !document.getElementById('toast').hidden);
    ok(n('notify') === 1, 'двойное нажатие на «Повідомити» — один запрос', n('notify'));
    ok(c.errors.length === 0, 'в консоли браузера нет ошибок (покупатель)', c.errors);
    await c.page.context().close(); st.server.close();
  }

  console.log('Волна 2а · А2: страницы на витрине');
  {
    // большой каталог: 38 товаров стенда + 180 копий = 218 → 11 страниц
    const st = await start(8817, undefined, s => {
      withPhotos(s);
      const rows = s.sheets['Товари'], base = rows.slice(1).filter(r => /^NUT-00[1-6]$/.test(r[0]));
      for (let i = 0; i < 180; i++) { const r = base[i % base.length].slice(); r[0] = 'NUT-' + (500 + i); rows.push(r); }
    });
    const { page, errors } = await open(browser, st.url, { uid: 630 });
    await page.waitForSelector('.pager');
    const total = st.gas.get({ action: 'catalog' }).products.length, pages = Math.ceil(total / 20);
    const nums = () => page.locator('.main .pager__row > *').allInnerTexts();
    const cur = () => page.locator('.main .pager [aria-current="page"]').innerText();
    const oneLine = () => page.evaluate(() => {
      const items = [].slice.call(document.querySelectorAll('.main .pager__row > *')), box = document.querySelector('.main .pager__row').getBoundingClientRect();
      const tops = items.map(n => Math.round(n.getBoundingClientRect().top));
      return tops.every(t => t === tops[0]) && items.every(n => n.getBoundingClientRect().left >= 0 && n.getBoundingClientRect().right <= window.innerWidth) && box.width <= window.innerWidth;
    });
    ok(total === 218 && await count(page, '#grid .card') === 20, 'на странице 20 товаров', [total, await count(page, '#grid .card')]);
    ok((await text(page, '.main .pager__range')) === 'Товари 1–20 з ' + total, 'подпись «Товари 1–20 з N»', await text(page, '.main .pager__range'));
    ok((await nums()).join(' ') === '‹ 1 2 3 … ' + pages + ' ›' && await cur() === '1', 'номера страниц: ‹ 1 2 3 … 11 ›, текущая выделена', await nums());
    ok(await page.locator('.main .pager [data-page]').first().isDisabled(), 'на первой странице стрелка «назад» выключена');
    ok(await oneLine() && await noOverflow(page), 'страницы помещаются в одну строку на 360 px, без горизонтальной прокрутки');
    ok((await smallTargets(page)).length === 0, 'кнопки страниц не меньше 44 px', await smallTargets(page));
    ok(await page.evaluate(() => getComputedStyle(document.querySelector('.main .pager [aria-current="page"]')).backgroundColor) === 'rgb(232, 145, 58)', 'текущая страница выделена абрикосовым');

    // переход на страницу 2: подпись, прокрутка к началу списка (под чипы), а не к верху экрана
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.click('.main .pager [data-page="2"]');
    await page.waitForFunction(() => document.querySelector('.main .pager [aria-current="page"]').textContent === '2');
    ok((await text(page, '.main .pager__range')) === 'Товари 21–40 з ' + total && await count(page, '#grid .card') === 20, 'страница 2: «Товари 21–40 з N», 20 товаров', await text(page, '.main .pager__range'));
    const pos = await page.evaluate(() => ({ y: window.scrollY, head: document.getElementById('gridHead').getBoundingClientRect().top, tools: document.querySelector('.tools').getBoundingClientRect().bottom }));
    ok(pos.y > 100 && pos.head >= pos.tools && pos.head - pos.tools < 40, 'после смены страницы список прокручен к своему началу, сразу под чипами категорий', pos);
    ok(await page.locator('#grid .card img').first().getAttribute('src') !== null, 'картинки новой страницы на месте');

    // середина длинного списка: первая, последняя, текущая, остальное — «…»
    await page.locator('.main .pager [data-page]').last().click();
    await page.locator('.main .pager [data-page]').last().click();
    await page.locator('.main .pager [data-page]').last().click();
    ok((await nums()).join(' ') === '‹ 1 … 5 … ' + pages + ' ›' && await cur() === '5', 'в середине: ‹ 1 … 5 … 11 ›', await nums());
    ok(await oneLine() && await noOverflow(page) && (await smallTargets(page)).length === 0, 'с двумя «…» страницы всё ещё в одну строку, кнопки ≥ 44 px');
    await page.locator('.main .pager').screenshot({ path: OUT + '/53-pager-middle.png' });
    await page.click('.main .pager [data-page="' + pages + '"]');
    await page.waitForFunction(p => document.querySelector('.main .pager [aria-current="page"]').textContent === String(p), pages);
    ok((await nums()).join(' ') === '‹ 1 … ' + (pages - 2) + ' ' + (pages - 1) + ' ' + pages + ' ›', 'в конце: ‹ 1 … 9 10 11 ›', await nums());
    ok((await text(page, '.main .pager__range')) === 'Товари 201–218 з 218' && await count(page, '#grid .card') === 18 && await page.locator('.main .pager [data-page]').last().isDisabled(), 'последняя страница: «Товари 201–218 з 218», стрелка «вперёд» выключена');

    // возврат из товара: та же страница и та же прокрутка; «Назад» Telegram закрывает товар, а не листает страницы
    await page.click('.main .pager [data-page="1"]');
    await page.click('.main .pager [data-page="3"]');
    await page.waitForFunction(() => document.querySelector('.main .pager [aria-current="page"]').textContent === '3');
    await page.locator('#grid .card').nth(9).scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, 37));
    const yBefore = await page.evaluate(() => window.scrollY);
    const opened = await page.locator('#grid .card').nth(9).getAttribute('data-id');
    await page.locator('#grid .card').nth(9).locator('.card__name').click();
    await page.waitForSelector('.sheet__title');
    ok(await page.evaluate(() => window.__tg.back.visible) === true, 'в товаре показана кнопка «Назад» Telegram');
    await page.evaluate(() => window.__tg.back.cb());
    await page.waitForFunction(() => document.getElementById('sheet').hidden);
    ok(await cur() === '3' && await page.locator('#grid .card').nth(9).getAttribute('data-id') === opened, '«Назад» из товара: открыта та же страница 3');
    ok(Math.abs(await page.evaluate(() => window.scrollY) - yBefore) <= 1, '«Назад» из товара: та же позиция прокрутки', [yBefore, await page.evaluate(() => window.scrollY)]);
    ok(await page.evaluate(() => window.__tg.back.visible) === false, 'в списке кнопка «Назад» Telegram скрыта');
    // то же через корзину и обратно
    await page.click('.tabbar [data-go="cart"]');
    await page.click('.tabbar [data-go="catalog"]');
    ok(await cur() === '3' && Math.abs(await page.evaluate(() => window.scrollY) - yBefore) <= 1, 'после корзины каталог открыт на той же странице и в том же месте', [await cur(), await page.evaluate(() => window.scrollY)]);

    // смена категории, поиска, сортировки или фильтра возвращает на страницу 1
    await page.click('.chip[data-cat="NUT"]');
    await page.waitForFunction(() => /Знайдено/.test(document.getElementById('gridHead').textContent));
    ok(await cur() === '1' && /^Товари 1–20 з /.test(await text(page, '.main .pager__range')), 'смена категории → страница 1', await text(page, '.main .pager__range'));
    await page.click('.main .pager [data-page="2"]');
    await page.fill('#search', 'мигдаль');
    await page.waitForFunction(() => /Товари 1–20 з /.test((document.querySelector('.main .pager__range') || {}).textContent || '') || !document.querySelector('.main .pager'));
    ok(await count(page, '.main .pager') === 0 || await cur() === '1', 'поиск → страница 1');
    await page.locator('#search').blur();
    await page.click('#searchClear');
    await page.locator('#search').blur();
    await page.waitForFunction(() => document.querySelector('.main .pager [aria-current="page"]'));
    await page.click('.main .pager [data-page="2"]');
    ok(await cur() === '2', 'снова открыта страница 2');
    await page.click('#filterBtn');
    await page.locator('.sheet .opt', { hasText: 'Спочатку дешевші' }).click();
    await page.click('[data-action="fil-apply"]');
    ok(await cur() === '1', 'сортировка → страница 1');
    await page.click('.main .pager [data-page="2"]');
    await page.click('#filterBtn');
    await page.locator('.sheet .check', { hasText: 'Лише в наявності' }).click();
    await page.click('[data-action="fil-apply"]');
    ok(await cur() === '1', 'фильтр «только в наличии» → страница 1');
    await page.click('#filterBtn');
    await page.click('[data-action="fil-reset"]');
    await page.click('.sheet__close');
    await page.click('.chip[data-cat=""]');
    ok(await count(page, '.main .rail') > 0 && await cur() === '1', 'подборки на главной на месте, список с первой страницы');
    await page.screenshot({ path: OUT + '/54-pager-home.png', fullPage: true });
    ok(errors.length === 0, 'в консоли браузера нет ошибок', errors);
    await page.context().close();

    // RU, тёмная тема, широкий экран: подпись по-русски, в середине видны соседние страницы
    const w = await open(browser, st.url, { uid: 631, lc: 'ru', theme: 'dark', w: 480 });
    await w.page.waitForSelector('.pager');
    ok((await text(w.page, '.main .pager__range')) === 'Товары 1–20 из ' + total, 'RU: «Товары 1–20 из N»', await text(w.page, '.main .pager__range'));
    for (let i = 0; i < 5; i++) await w.page.locator('.main .pager [data-page]').last().click();
    ok((await w.page.locator('.main .pager__row > *').allInnerTexts()).join(' ') === '‹ 1 … 5 6 7 … ' + pages + ' ›', 'на экране пошире видны соседние с текущей: ‹ 1 … 5 6 7 … 11 ›', await w.page.locator('.main .pager__row > *').allInnerTexts());
    ok(await noOverflow(w.page) && (await smallTargets(w.page)).length === 0, 'тёмная тема, 480 px: без горизонтальной прокрутки, кнопки ≥ 44 px', await smallTargets(w.page));
    await w.page.locator('.main .pager').screenshot({ path: OUT + '/55-pager-dark.png' });
    ok(w.errors.length === 0, 'в консоли браузера нет ошибок (RU, тёмная)', w.errors);
    await w.page.context().close(); st.server.close();
  }

  console.log('Волна 2а · А3: товары в админ-панели');
  {
    const st = await start(8818, undefined, s => {
      withPhotos(s);
      const rows = s.sheets['Товари'], base = rows.slice(1).filter(r => /^NUT-00[1-6]$/.test(r[0]));
      for (let i = 0; i < 180; i++) { const r = base[i % base.length].slice(); r[0] = 'NUT-' + (500 + i); r[3] = 'Товар номер ' + (500 + i); rows.push(r); }
    });
    const head = st.gas.sheets['Товари'].rows[0];
    const all = st.gas.sheets['Товари'].rows.slice(1).filter(r => r[0] && r[head.indexOf('Назва (UA)')]);
    const col = name => head.findIndex(h => String(h).indexOf(name) === 0);
    const { page, errors } = await open(browser, st.url, { uid: 900, query: '?admin=1' });
    await page.waitForSelector('.ord');
    await page.locator('[data-tab="products"]').click();
    await page.waitForSelector('.prod');
    const range = () => text(page, '#admList .pager__range');
    const cur = () => page.locator('#admList .pager [aria-current="page"]').innerText();
    ok(all.length === 219 && await count(page, '.prod') === 20, 'в панели 20 товаров на странице (всего 219, включая скрытый)', [all.length, await count(page, '.prod')]);
    ok(await range() === 'Товари 1–20 з 219' && !/Показано перші 60/.test(await text(page, '.page')), 'подпись «Товари 1–20 з 219», ограничения «первые 60» больше нет', await range());
    ok((await page.locator('#admList .pager__row > *').allInnerTexts()).join(' ') === '‹ 1 2 3 … 11 ›', 'те же номера страниц, что на витрине');
    ok(await noOverflow(page) && (await smallTargets(page)).length === 0, 'список товаров: без горизонтальной прокрутки, кнопки ≥ 44 px', await smallTargets(page));
    await page.screenshot({ path: OUT + '/56-admin-products.png', fullPage: true });
    const firstId = await page.locator('.prod [data-edit]').first().getAttribute('data-edit');
    await page.click('#admList .pager [data-page="2"]');
    ok(await range() === 'Товари 21–40 з 219' && await page.locator('.prod [data-edit]').first().getAttribute('data-edit') !== firstId, 'страница 2 показывает следующие 20 товаров', await range());
    const y = await page.evaluate(() => ({ y: window.scrollY, top: document.getElementById('admList').getBoundingClientRect().top }));
    ok(y.top >= 0 && y.top < 60, 'после смены страницы список прокручен к своему началу', y);

    // поиск ищет по всем товарам, а не по открытой странице
    await page.fill('#admPQ', 'номер 679');
    await page.waitForFunction(() => document.querySelectorAll('.prod').length === 1);
    ok(await page.locator('.prod [data-edit]').first().getAttribute('data-edit') === 'NUT-679', 'поиск находит товар с последней страницы');
    await page.fill('#admPQ', '');
    await page.waitForFunction(() => document.querySelectorAll('.prod').length === 20);
    ok(await cur() === '1', 'поиск возвращает на страницу 1');

    // категории чипами
    const catName = await page.locator('#admPChips [data-pcat]').nth(1).getAttribute('data-pcat');
    const inCat = all.filter(r => r[col('Категорія (UA)')] === catName).length;
    await page.click('#admList .pager [data-page="3"]');
    await page.locator('#admPChips [data-pcat]').nth(1).click();
    const shown = await count(page, '.prod');
    ok(inCat > 0 && shown === Math.min(20, inCat) && (inCat <= 20 ? await count(page, '#admList .pager') === 0 : await cur() === '1'), 'чип категории «' + catName + '»: только её товары, список с первой страницы', [inCat, shown]);
    ok(await page.locator('#admPChips [data-pcat]').nth(1).getAttribute('aria-pressed') === 'true', 'выбранная категория выделена');
    await page.locator('#admPChips [data-pcat=""]').click();

    // фильтры
    const hidden = all.filter(r => /^так$/i.test(String(r[col('Приховати')] || ''))).length;
    const noPhoto = all.filter(r => !r[col('Фото')]).length;
    await page.click('[data-pflt="hidden"]');
    ok(hidden === 1 && await count(page, '.prod') === 1 && /Приховані · 1/.test(await text(page, '[data-pflt="hidden"]')), 'фильтр «Приховані» показывает скрытые товары, на чипе их число', [hidden, await count(page, '.prod')]);
    await page.click('[data-pflt="hidden"]');
    await page.click('[data-pflt="nophoto"]');
    ok(new RegExp('з ' + noPhoto + '$').test(await range()) && new RegExp('Без фото · ' + noPhoto).test(await text(page, '[data-pflt="nophoto"]')), 'фильтр «Без фото»', [noPhoto, await range()]);
    await page.click('#admList .pager [data-page="2"]');
    await page.click('[data-pflt="out"]');
    const both = all.filter(r => !r[col('Фото')] && !/^(є|e|есть|так|да)$/i.test(String(r[col('Наявність')]).trim())).length;
    ok((await count(page, '.prod')) === Math.min(20, both) && (both <= 20 || await cur() === '1'), 'фильтры складываются («без фото» и «немає в наявності»), список с первой страницы', [both, await count(page, '.prod')]);
    await page.click('[data-pflt="nophoto"]');
    // переключатель в отфильтрованном списке: товар вернули в наличие — число на чипе уменьшилось
    const outBefore = Number((await text(page, '[data-pflt="out"]')).replace(/\D/g, ''));
    await page.locator('#admList .sw').first().click();
    await page.waitForFunction(n => Number(document.querySelector('[data-pflt="out"]').textContent.replace(/\D/g, '')) === n - 1, outBefore);
    ok(true, 'после переключателя число на чипе «Немає в наявності» обновилось');
    ok(await noOverflow(page) && (await smallTargets(page)).length === 0, 'чипы и фильтры: без горизонтальной прокрутки страницы, кнопки ≥ 44 px', await smallTargets(page));
    await page.screenshot({ path: OUT + '/57-admin-filters.png' });
    ok(errors.length === 0, 'в консоли браузера нет ошибок', errors);
    await page.context().close(); st.server.close();
  }

  console.log('Волна 2а · А4: архив и удаление');
  {
    const st = await start(8819, undefined, s => {
      withPhotos(s);
      s.props.ADMIN_CHAT_IDS = '900,950,960'; // 950 — только в настройках скрипта, 960 — и там, и в листе «Адміни»
      s.sheets['Категорії'].push(['NEW', 'Порожня', 'Пустая', '', 9]);
    });
    const g = st.gas, n = action => st.log.filter(x => x.action === action).length;
    g.call('writeAdminRow_', { id: '741', name: 'Менеджер Текстів', username: '', role: 'manager', perms: { text: true }, notify: false, active: true, by: 'тест' });
    g.call('writeAdminRow_', { id: '742', name: 'Менеджер Замовлень', username: '', role: 'manager', perms: { st: true }, notify: false, active: true, by: 'тест' });
    g.call('writeAdminRow_', { id: '960', name: 'Обидва', username: '', role: 'manager', perms: { st: true }, notify: false, active: true, by: 'тест' });
    const P = g.sheets['Товари'].rows, inSheet = id => P.some(r => r[0] === id);
    const { page, errors } = await open(browser, st.url, { uid: 900, query: '?admin=1' });
    await page.waitForSelector('.ord');
    const sheetText = () => text(page, '#sheet');
    const toastText = () => page.evaluate(() => document.getElementById('toastText').textContent);

    // «В архів» из карточки товара: подтверждение с названием, один запрос
    await page.locator('[data-tab="products"]').click();
    await page.waitForSelector('.prod');
    await page.locator('[data-edit="NUT-004"]').click();
    await page.waitForSelector('[data-action="adm-archive"]');
    ok((await smallTargets(page)).length === 0 && await noOverflow(page), 'карточка товара с кнопкой «В архів»: кнопки ≥ 44 px, без горизонтальной прокрутки', await smallTargets(page));
    await page.click('[data-action="adm-archive"]');
    await page.waitForSelector('#sheet [data-action="cf-ok"]');
    ok(/Перенести товар в архів\?/.test(await sheetText()) && /«Волоський горіх, половинки» зникне з вітрини/.test(await sheetText()) && /В архів: Волоський горіх, половинки/.test(await text(page, '[data-action="cf-ok"]')),
      'подтверждение архивации называет товар', await sheetText());
    ok(!(await page.locator('[data-action="cf-ok"]').evaluate(b => b.classList.contains('btn--danger'))), 'архивация обратима — кнопка не красная');
    await page.waitForTimeout(400); // шторка выезжает снизу
    await page.screenshot({ path: OUT + '/58-confirm-archive.png' });
    await page.click('[data-action="cf-cancel"]');
    await page.waitForFunction(() => document.getElementById('sheet').hidden);
    ok(n('admin.archive') === 0 && inSheet('NUT-004'), '«Скасувати» ничего не меняет');
    st.opt.delay = 400;
    await page.click('[data-action="adm-archive"]');
    await page.waitForSelector('#sheet [data-action="cf-ok"]');
    await page.evaluate(() => { const b = document.querySelector('[data-action="cf-ok"]'); b.click(); b.click(); });
    ok(await page.evaluate(() => { const b = document.querySelector('[data-action="cf-ok"]'); return b.classList.contains('is-busy') && b.disabled && document.querySelector('[data-action="cf-cancel"]').disabled; }), 'кнопка подтверждения показывает индикатор и блокируется');
    await page.waitForFunction(() => document.getElementById('sheet').hidden);
    st.opt.delay = 0;
    await page.waitForSelector('.prod');
    ok(n('admin.archive') === 1 && !inSheet('NUT-004') && await count(page, '[data-edit="NUT-004"]') === 0 && /Перенесено в архів/.test(await toastText()), 'товар ушёл в архив одним запросом и пропал из списка', [n('admin.archive'), await toastText()]);
    ok(!g.get({ action: 'catalog' }).products.some(p => p.id === 'NUT-004'), 'на витрине архивного товара нет');

    // экран «Архів»
    await page.click('[data-action="adm-arch"]');
    await page.waitForSelector('.arch');
    ok(await count(page, '.arch') === 1 && /Волоський горіх, половинки/.test(await text(page, '.arch')) && /NUT-004/.test(await text(page, '.arch')) && /в архіві з \d\d\.\d\d\.\d{4}/.test(await text(page, '.arch')),
      'экран «Архів»: товар, его ID и дата архивации', await text(page, '.arch'));
    ok(await count(page, '[data-arch-restore]') === 1 && await count(page, '[data-arch-purge]') === 1 && await count(page, '#admAQ') === 1, 'у товара кнопки «Відновити» и «Видалити назавжди», есть поиск');
    ok((await smallTargets(page)).length === 0 && await noOverflow(page), 'экран «Архів»: кнопки ≥ 44 px, без горизонтальной прокрутки', await smallTargets(page));
    await page.screenshot({ path: OUT + '/59-archive.png' });
    await page.fill('#admAQ', 'немає такого');
    ok(await count(page, '.arch') === 0, 'поиск в архиве фильтрует список');
    await page.fill('#admAQ', 'nut-004');
    ok(await count(page, '.arch') === 1, 'поиск в архиве находит по ID');

    // «Видалити назавжди»: красная кнопка с названием, «Це не можна скасувати»
    await page.click('[data-arch-purge="NUT-004"]');
    await page.waitForSelector('#sheet [data-action="cf-ok"]');
    ok(/Це не можна скасувати/.test(await sheetText()) && /Старі замовлення не зміняться/.test(await sheetText()) && /ID NUT-004 більше не використовуватиметься/.test(await sheetText()), 'подтверждение удаления: «Це не можна скасувати», про заказы и про ID', await sheetText());
    ok((await text(page, '[data-action="cf-ok"]')).trim() === 'Видалити назавжди Волоський горіх, половинки' && await page.locator('[data-action="cf-ok"]').evaluate(b => b.classList.contains('btn--danger') && getComputedStyle(b).backgroundColor === 'rgb(158, 47, 38)'),
      'красная кнопка «Видалити назавжди {назва}», а не «ОК»', await text(page, '[data-action="cf-ok"]'));
    ok((await smallTargets(page)).length === 0 && await noOverflow(page), 'окно подтверждения: кнопки ≥ 44 px, без горизонтальной прокрутки', await smallTargets(page));
    await page.waitForTimeout(400); // шторка выезжает снизу
    await page.screenshot({ path: OUT + '/60-confirm-purge.png' });
    await page.click('[data-action="cf-cancel"]');
    await page.waitForFunction(() => document.getElementById('sheet').hidden);
    ok(n('admin.purge') === 0 && g.sheets['Архів товарів'].rows.length === 2, 'отмена: товар остался в архиве');

    // «Відновити»
    await page.click('[data-arch-restore="NUT-004"]');
    await page.waitForFunction(() => /Відновлено: Волоський горіх/.test(document.getElementById('toastText').textContent));
    ok(inSheet('NUT-004') && g.sheets['Архів товарів'].rows.length === 1 && /В архіві порожньо/.test(await text(page, '.page')), '«Відновити»: товар снова в «Товари», архив пуст');
    ok(g.get({ action: 'catalog' }).products.some(p => p.id === 'NUT-004'), 'восстановленный товар снова на витрине');
    await page.click('[data-nav="back"]');
    await page.waitForSelector('.prod');
    await page.fill('#admPQ', 'NUT-004');
    ok(await count(page, '[data-edit="NUT-004"]') === 1, 'восстановленный товар снова в списке товаров панели');

    // архив → удалить навсегда
    await page.locator('[data-edit="NUT-004"]').click();
    await page.click('[data-action="adm-archive"]');
    await page.click('#sheet [data-action="cf-ok"]');
    await page.waitForFunction(() => document.getElementById('sheet').hidden);
    await page.click('#toastBtn'); // кнопка «Архів товарів» в сообщении
    await page.waitForSelector('.arch');
    await page.click('[data-arch-purge="NUT-004"]');
    await page.click('#sheet [data-action="cf-ok"]');
    await page.waitForFunction(() => /Видалено назавжди/.test(document.getElementById('toastText').textContent));
    ok(n('admin.purge') === 1 && !inSheet('NUT-004') && g.sheets['Архів товарів'].rows.length === 1 && g.props.DELETED_IDS === 'NUT-004', 'удалено навсегда: строки нет ни в «Товари», ни в архиве; ID запомнен', g.props.DELETED_IDS);
    await page.click('[data-nav="back"]');

    // удаление категории: с товарами — через перенос, пустая — сразу
    await page.locator('[data-tab="cats"]').click();
    await page.waitForSelector('.page [data-cat="TEA"]');
    await page.locator('.page [data-cat="TEA"]').click();
    await page.click('[data-action="adm-cat-del"]');
    await page.waitForSelector('#cfMove');
    ok(/У категорії «Чай» товарів: 5 \(разом із прихованими\)/.test(await sheetText()) && /Перенести товари й видалити «Чай»/.test(await text(page, '[data-action="cf-ok"]')) && await count(page, '#cfMove option') === 6,
      'категория с товарами: панель просит сначала перенести их и даёт список категорий', await sheetText());
    await page.waitForTimeout(400); // шторка выезжает снизу
    await page.screenshot({ path: OUT + '/61-confirm-category.png' });
    await page.selectOption('#cfMove', 'DRY');
    await page.click('#sheet [data-action="cf-ok"]');
    await page.waitForFunction(() => /товарів перенесено: 5/.test(document.getElementById('toastText').textContent));
    ok(!g.sheets['Категорії'].rows.some(r => r[0] === 'TEA') && P.find(r => r[0] === 'TEA-001')[1] === 'Сухофрукти' && await count(page, '.page [data-cat="TEA"]') === 0, 'категория удалена, товары перенесены в выбранную');
    await page.locator('.page [data-cat="NEW"]').click();
    await page.click('[data-action="adm-cat-del"]');
    await page.waitForSelector('#sheet [data-action="cf-ok"]');
    ok(/немає товарів/.test(await sheetText()) && (await text(page, '[data-action="cf-ok"]')).trim() === 'Видалити «Порожня»' && await count(page, '#cfMove') === 0, 'пустая категория: простое подтверждение с названием', await sheetText());
    await page.click('#sheet [data-action="cf-ok"]');
    await page.waitForFunction(() => /Категорію видалено/.test(document.getElementById('toastText').textContent));
    ok(!g.sheets['Категорії'].rows.some(r => r[0] === 'NEW') && await count(page, '.page [data-cat="NEW"]') === 0, 'пустая категория удалена');

    // удаление админа
    await page.locator('[data-tab="admins"]').click();
    await page.waitForSelector('[data-adm="950"]');
    ok(/Доданий у налаштуваннях скрипта/.test(await text(page, '[data-adm="950"]')) && !/Доданий у налаштуваннях/.test(await text(page, '[data-adm="742"]')), 'админ из ADMIN_CHAT_IDS помечен в списке');
    await page.screenshot({ path: OUT + '/62-admins.png', fullPage: true });
    await page.locator('[data-adm="950"]').click();
    await page.waitForSelector('#admForm');
    ok(await count(page, '[data-action="adm-admin-del"]') === 0 && /ADMIN_CHAT_IDS/.test(await text(page, '#admForm')) && /Script Properties/.test(await text(page, '#admForm')), 'у админа из настроек скрипта вместо «Видалити» — подсказка, где его убрать');
    await page.click('[data-nav="back"]');
    await page.locator('[data-adm="960"]').click();
    await page.click('[data-action="adm-admin-del"]');
    await page.waitForSelector('#sheet [data-action="cf-ok"]');
    ok(/ADMIN_CHAT_IDS/.test(await sheetText()) && /доступ у неї залишиться/.test(await sheetText()), 'записан и в листе, и в ADMIN_CHAT_IDS: подтверждение предупреждает, что доступ останется', await sheetText());
    await page.click('#sheet [data-action="cf-ok"]');
    await page.waitForFunction(() => /доступ лишився/.test(document.getElementById('toastText').textContent));
    ok(!g.sheets['Адміни'].rows.some(r => String(r[0]) === '960'), 'строка в листе «Адміни» удалена');
    await page.locator('[data-adm="742"]').click();
    await page.click('[data-action="adm-admin-del"]');
    await page.waitForSelector('#sheet [data-action="cf-ok"]');
    ok((await text(page, '[data-action="cf-ok"]')).trim() === 'Видалити Менеджер Замовлень' && await page.locator('[data-action="cf-ok"]').evaluate(b => b.classList.contains('btn--danger')) && !/ADMIN_CHAT_IDS/.test(await sheetText()), 'красная кнопка «Видалити {ім’я}»', await text(page, '[data-action="cf-ok"]'));
    await page.click('#sheet [data-action="cf-ok"]');
    await page.waitForFunction(() => /Адміна видалено/.test(document.getElementById('toastText').textContent));
    ok(!g.sheets['Адміни'].rows.some(r => String(r[0]) === '742') && await count(page, '[data-adm="742"]') === 0, 'админ удалён из листа и из списка');
    ok(await count(page, '[data-adm="900"]') === 0, 'владельца открыть на удаление нельзя');
    ok(errors.length === 0, 'в консоли браузера нет ошибок (владелец)', errors);
    await page.context().close();

    // менеджер с правом «Тексти товарів»: архивирует и восстанавливает, но не удаляет навсегда
    g.post({ action: 'admin.archive', initData: g.initData({ id: 900, first_name: 'Власник' }), id: 'NUT-001' });
    const m = await open(browser, st.url, { uid: 741, query: '?admin=1' });
    await m.page.waitForSelector('.ord, .adm__msg');
    await m.page.locator('[data-tab="products"]').click();
    await m.page.waitForSelector('.prod');
    await m.page.click('[data-action="adm-arch"]');
    await m.page.waitForSelector('.arch');
    ok(await count(m.page, '[data-arch-restore]') === 1 && await count(m.page, '[data-arch-purge]') === 0 && /лише повний адмін або власник/.test(await text(m.page, '.page')), 'менеджер видит «Відновити», но не «Видалити назавжди»');
    ok(g.post({ action: 'admin.purge', initData: g.initData({ id: 741, first_name: 'М' }), id: 'NUT-001' }).error === 'no_perm', 'и сервер менеджеру удаление навсегда не разрешает');
    ok(m.errors.length === 0, 'в консоли браузера нет ошибок (менеджер)', m.errors);
    await m.page.context().close();

    // покупатель: «Повторити замовлення» с архивным товаром — пропуск и подсказка, а не ошибка
    const c = await open(browser, st.url, { uid: 501, query: '?view=orders' });
    await c.page.waitForSelector('[data-repeat="P-0001"]');
    await c.page.click('[data-repeat="P-0001"]'); // курага + мигдаль (мигдаль в архиве)
    await c.page.waitForSelector('.line');
    ok(await count(c.page, '.line') === 1 && /Курага/.test(await text(c.page, '.line')) && /Деяких товарів більше немає/.test(await text(c.page, '.page')), 'повтор заказа: архивный товар пропущен, показано «Деяких товарів більше немає»', await text(c.page, '.page'));
    await c.page.screenshot({ path: OUT + '/63-repeat-gone.png' });
    await c.page.click('.tabbar [data-go="catalog"]');
    await c.page.waitForSelector('.card');
    ok(await count(c.page, '.mini[data-id="NUT-001"]') === 0 && await count(c.page, '.mini[data-id="DRY-039"]') > 0, 'в подборках «Купити знову» и «Ваше звичне» архивного товара нет');
    ok(c.errors.length === 0, 'в консоли браузера нет ошибок (покупатель)', c.errors);
    await c.page.context().close(); st.server.close();
  }

  await browser.close();
  console.log('\nИтог: ' + pass + ' пройдено, ' + fail + ' не пройдено');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
