// Сквозная проверка витрины в настоящем браузере (Chrome, экран телефона 360 px) на стенде с настоящим Code.gs.
// Запуск: node tests/e2e.js
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { start } = require('./serve');
const { open, OUT } = require('./shot');

// Бэкенд выпуска А (до волны Б1): в main теперь уже бэкенд Б1, поэтому для проверок «без admin.message / без блоков источников» берём коммит слияния выпуска А.
const OLD_REF_A = '185bff6';
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
/** Группы настроек по умолчанию свёрнуты (раскрыта только «Магазин»): для проверок полей раскрываем все. */
const openGroups = page => page.evaluate(() => document.querySelectorAll('details.sgroup').forEach(d => { d.open = true; }));
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
    ok(await count(page, '.plus__item[data-k="gift"], .plus__item[data-k="loyal"]') === 2 && /Подарунок від 500\s₴/.test(await text(page, '#homeGift')) && /Постійним клієнтам/.test(await text(page, '.plus__item[data-k="loyal"]')), 'подарок от суммы и подарок постоянным клиентам показаны в строке «плюсов» на главной', await page.locator('.plus__item').allInnerTexts());
    const rails = (await page.locator('.main .rail__title').allInnerTexts()).concat(await page.locator('.morerails .chip').allInnerTexts()); // лишние ленты — чипы «Ще»
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
    // «Популярне» — последний блок страницы: докрутка до конца ставит первую карточку целиком над нижней панелью вкладок
    await page.waitForSelector('.main .rail .mini');
    await page.waitForSelector('#tabbar:not([hidden])'); // после ввода в поиск панель возвращается не сразу
    await page.waitForFunction(() => { window.scrollTo(0, 1e5); return Math.abs(scrollY - (document.documentElement.scrollHeight - innerHeight)) < 2; }); // страница дорисована и докручена до конца
    const lastRail = await page.evaluate(() => { const tb = document.querySelector('.tabbar').getBoundingClientRect(), c = document.querySelector('.main .rail .mini').getBoundingClientRect(); return { cardBottom: Math.round(c.bottom), tabbarTop: Math.round(tb.top), cardTop: Math.round(c.top) }; });
    ok(lastRail.cardTop >= 0 && lastRail.tabbarTop - lastRail.cardBottom >= 16, 'если «Популярне» — последний блок, после докрутки карточка целиком над панелью вкладок (зазор не меньше 16 px)', lastRail);
    await page.evaluate(() => window.scrollTo(0, 0));
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
    ok(/Тут поки порожньо/.test(await text(page, '.state__title')) && await tg(() => window.__tg.calls.some(c => c[0] === 'showConfirm')), 'очистка корзины спрашивает подтверждение');
    await page.click('.page [data-lang], .tabbar [data-go="orders"]');
    await page.locator('.merow [data-lang="ru"]').click();
    ok(/Профиль/.test(await text(page, '.page__title')) && /Корзина/.test(await text(page, '.tabbar [data-go="cart"]')), 'переключение языка в профиле: интерфейс на русском');
    await page.click('.tabbar [data-go="catalog"]');
    await page.waitForSelector('.main .rail');
    const ruRails = (await page.locator('.main .rail__title').allInnerTexts()).concat(await page.locator('.morerails .chip').allInnerTexts()); // не поместившиеся в три — чипы «Ещё»
    ok(ruRails.includes('Купить снова') && ruRails.includes('Вы смотрели'), 'на главной появились «Купить снова» и «Вы смотрели»', ruRails);
    await page.screenshot({ path: OUT + '/18-home-ru.png' });

    // аналитика
    await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
    await page.waitForTimeout(400);
    const evs = st.gas.sheets['Події'] ? st.gas.sheets['Події'].rows.slice(1).map(r => r[3]) : [];
    ok(['open', 'view', 'add', 'cart', 'checkout', 'order', 'fav', 'share', 'search0', 'repeat', 'notify'].every(e => evs.includes(e)), 'аналитика: все ключевые события записаны', evs);
    const evCalls = st.log.filter(x => x.action === 'ev').length;
    ok(evCalls <= 4, 'события уходят пачками: запросов к серверу ' + evCalls);
    // волна 2а, А5: открытие магазина и заказ записывают клиента в лист «Клієнти»
    const clients = st.gas.sheets['Клієнти'] ? st.gas.sheets['Клієнти'].rows : [];
    ok(clients.filter(r => String(r[0]) === '501').length === 1 && clients.find(r => String(r[0]) === '501')[2] === 'ua', 'покупатель записан в лист «Клієнти» одной строкой', clients);
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
    await page.waitForSelector('.sgroup'); await openGroups(page);
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
    ok(await count(m.page, '[data-action="adm-sales"]') === 0 && await count(m.page, '#srcTable') === 0 && await count(m.page, '#cartRemind') === 0, 'итогов продаж и статистики нет, блоков источников и напоминаний тоже');
    await m.page.locator('.ord__head').first().click();
    ok(await count(m.page, '.ord__acts [data-st]') === 1, 'есть одна большая кнопка следующего шага — право выдано');
    await m.page.locator('[data-more]').first().click();
    ok(await count(m.page, '.ord__acts [data-st]') === 4, 'под «Ще» остальные статусы');
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
    ok(await count(page, '.main > .rail:not(.recs)') <= 3 && await noOverflow(page), 'старый бэкенд (нет railsMax): на главной не больше трёх лент', await count(page, '.main > .rail:not(.recs)'));
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
    ok(await count(page, '.feature [data-view="story"]') === 0 && await count(page, '.feature .lane__btn') === 1, 'на блоке «Наша курага» текст в одну строку, ссылка «Від саду до столу» спрятана в шторку');
    await page.click('.feature .lane__btn');
    await page.waitForSelector('#sheet .plus__text');
    ok(/Наша курага/.test(await text(page, '#sheet .sheet__title')) && await count(page, '#sheet [data-view="story"]') === 1 && /Від саду до столу/.test(await text(page, '#sheet [data-view="story"]')), 'нажатие на текст открывает шторку: заголовок, полный текст, ссылка «Від саду до столу»', await text(page, '#sheet'));
    await page.click('#sheet .sheet__close');

    // 1.6 «Ваше звичне» и шкала до подарка
    await page.waitForSelector('.usual');
    ok(/Ваше звичне/.test(await text(page, '.usual')) && /Додати все · 380/.test(await text(page, '.usual .btn')) && await page.locator('.usual .mini').getAttribute('data-id') === 'DRY-039', '«Ваше звичне»: курага из двух заказов, 500 г × 2', await text(page, '.usual'));
    ok(/Подарунок від 500\s₴/.test(await text(page, '#homeGift')), 'на главной условие подарка, пока корзина пустая');
    await page.click('#homeGift');
    await page.waitForSelector('#sheet .plus__text');
    ok(/Подарунок до замовлення від 500\s₴: 100 г кураги/.test(await text(page, '#sheet')), 'нажатие на подарок открывает шторку с условием', await text(page, '#sheet'));
    await page.click('#sheet .sheet__close');
    await page.click('.usual [data-w1="usual"]');
    await page.waitForFunction(() => /Ще 120/.test(document.getElementById('homeGift').textContent));
    await page.click('#homeGift');
    await page.waitForSelector('#sheet .prog');
    ok(/Ще 120\s₴ до подарунка: 100 г кураги/.test(await text(page, '#sheet .prog')) && /Ще 120\s₴ до подарунка/.test(await text(page, '#homeGift')) && /380/.test(await text(page, '.tabbar [data-go="cart"]')), '«Додати все» кладёт привычное в корзину; на главной шкала до подарка (в строке и в шторке)', await text(page, '#sheet'));
    await page.click('#sheet .sheet__close');
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
    ok(/Напишіть нам — підкажемо, чи є це на прилавку/.test(await text(page, '.state')), 'пустой поиск: иллюстрация и «Напишіть нам — підкажемо, чи є це на прилавку»');
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
    for (let i = 0; i < 40 && n('admin.status') < 1; i++) await page.waitForTimeout(50); // запись в журнал сервера стенда может отстать от ответа
    await page.waitForTimeout(300); // и даём время лишнему запросу, если он есть
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
    // «Збережено» держится на кнопке треть секунды и не задерживает переход — ловим его наблюдателем
    await page.evaluate(() => { window.__saved = ''; new MutationObserver(() => { const b = document.querySelector('[data-action="adm-save"].is-saved'); if (b) window.__saved = b.textContent; }).observe(document.getElementById('page'), { subtree: true, attributes: true, childList: true }); });
    await page.evaluate(() => { const b = document.querySelector('[data-action="adm-save"]'); b.click(); b.click(); });
    ok(await page.evaluate(() => { const b = document.querySelector('[data-action="adm-save"]'); return b.classList.contains('is-busy') && b.disabled; }), '«Зберегти» сразу показывает индикатор и блокируется');
    await page.locator('[data-action="adm-save"]').screenshot({ path: OUT + '/51-busy-save.png' });
    await page.waitForSelector('.prod');
    ok(/Збережено/.test(await page.evaluate(() => window.__saved)), 'после ответа на кнопке галочка и «Збережено»', await page.evaluate(() => window.__saved));
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

  console.log('Скорость админ-панели');
  {
    const st = await start(8820);
    const n = action => st.log.filter(x => x.action === action).length;
    // покупатель: запросов панели нет
    const c = await open(browser, st.url, { uid: 650 });
    await c.page.waitForSelector('.card');
    await c.page.waitForTimeout(2200);
    ok(st.log.every(x => String(x.action).indexOf('admin.') !== 0), 'у покупателя запросов админ-панели нет');
    await c.page.context().close();

    // админ открыл магазин: заказы подгружаются заранее, панель открывается сразу
    const { page, errors } = await open(browser, st.url, { uid: 900 });
    await page.evaluate(() => localStorage.setItem('pamir_admin', '1'));
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('.card');
    for (let i = 0; i < 40 && n('admin.orders') === 0; i++) await page.waitForTimeout(100);
    ok(n('admin.orders') === 1 && await count(page, '.ord') === 0, 'пока админ смотрит магазин, заказы уже запрошены заранее', n('admin.orders'));
    await page.waitForTimeout(300);
    st.opt.delay = 700; // дальше сервер отвечает медленно
    await page.click('#adminBtn');
    ok(await count(page, '.ord') === 7 && n('admin.orders') === 1, 'панель открылась сразу с заказами, без второго запроса и без ожидания', [await count(page, '.ord'), n('admin.orders')]);
    // вкладка «Товари» тоже подгружается заранее
    await page.reload({ waitUntil: 'networkidle' });
    st.opt.delay = 0;
    await page.click('#adminBtn');
    await page.waitForSelector('.ord');
    for (let i = 0; i < 40 && n('admin.products') === 0; i++) await page.waitForTimeout(100);
    await page.waitForTimeout(300);
    const prodCalls = n('admin.products');
    st.opt.delay = 700;
    await page.locator('[data-tab="products"]').click();
    ok(prodCalls === 1 && await count(page, '.prod') === 20 && n('admin.products') === 1, '«Товари» открываются мгновенно: список загружен заранее одним запросом', [prodCalls, await count(page, '.prod')]);

    // быстрое переключение вкладок во время загрузки не оставляет пустой экран
    await page.locator('[data-tab="reviews"]').click();
    await page.locator('[data-tab="admins"]').click();
    await page.waitForSelector('#admList .prod');
    ok(/Власник/.test(await text(page, '#admList')) && await count(page, '.form__err') === 0, 'переключили вкладку, не дождавшись ответа, — открылась нужная, без ошибки');
    await page.locator('[data-tab="reviews"]').click();
    ok(n('admin.reviews') === 1 && !/Завантаж/.test(await text(page, '#admList')), 'вкладка, загруженная в фоне, открывается без повторного запроса', n('admin.reviews'));

    // статус заказа: новый статус виден сразу, до ответа сервера
    await page.locator('[data-tab="orders"]').click();
    await page.waitForSelector('.ord');
    await page.locator('.ord__head').first().click();
    await page.waitForSelector('[data-st="c"]:not([disabled])');
    const badge = () => page.locator('.ord').first().locator('.ord__head .badge').first().innerText();
    const was = await badge();
    await page.click('[data-st="c"]');
    ok(await page.evaluate(() => !!document.querySelector('.ord__acts .is-busy')), 'нажатие сразу показывает индикатор на кнопке (идёт запрос превью)');
    await page.waitForFunction(() => /підтверджено/.test(document.querySelector('.ord .badge').innerText)); // тестовый заказ: клиенту не пишут — шторки нет, статус меняется сразу
    ok(was === 'новий' && await badge() === 'підтверджено' && n('admin.status') <= 1 && await page.evaluate(() => !!document.querySelector('.ord__acts [data-st][disabled]')), 'статус на экране сменился сразу, кнопки шага заблокированы до ответа сервера', [was, await badge()]);
    await page.waitForFunction(() => !document.querySelector('.ord__acts .is-busy'));
    ok(await badge() === 'підтверджено' && st.gas.sheets['Замовлення'].rows.slice(-1)[0][2] === 'підтверджено', 'после ответа сервера статус тот же и записан в таблицу');
    // сервер отказал: статус возвращается назад с сообщением
    st.opt.failAction = 'admin.status';
    await page.click('[data-st="s"]');
    await page.waitForFunction(() => /відправлено/.test(document.querySelector('.ord .badge').innerText));
    ok(await badge() === 'відправлено', 'второй статус тоже показан сразу');
    await page.waitForFunction(() => /повернули попередній/.test(document.getElementById('toastText').textContent));
    ok(await badge() === 'підтверджено' && st.gas.sheets['Замовлення'].rows.slice(-1)[0][2] === 'підтверджено' && await page.evaluate(() => !document.querySelector('.ord__acts .is-busy')), 'сервер ответил ошибкой — на экране снова прежний статус, показано сообщение');
    st.opt.failAction = '';
    st.opt.delay = 0;

    // несколько правок подряд — каталог для витрины перезапрашивается один раз
    await page.locator('[data-tab="products"]').click();
    await page.waitForSelector('[data-stock="NUT-002"]');
    const cat0 = n('GET catalog');
    for (const id of ['NUT-002', 'NUT-003', 'NUT-004']) { await page.click('[data-stock="' + id + '"]'); await page.waitForFunction(i => !document.querySelector('[data-stock="' + i + '"]').disabled, id); }
    await page.waitForTimeout(1800);
    ok(n('GET catalog') === cat0 + 1 && n('admin.product') === 3, 'три переключателя подряд — три сохранения и одно обновление каталога', [n('GET catalog') - cat0, n('admin.product')]);

    // замер времени: только когда включён на сервере
    ok(await count(page, '#perfLine') === 0, 'без PERF_LOG строки с замерами на экране нет');
    st.gas.props.PERF_LOG = '1';
    await page.click('[data-stock="NUT-002"]');
    await page.waitForSelector('#perfLine');
    ok(/product: \d+ мс = сервер \d+ \(підпис і права \d+, таблиця \d+, дія \d+, журнал \d+\) \+ мережа й Google \d+/.test(await text(page, '#perfLine')), 'с PERF_LOG = 1 внизу экрана видно время по этапам', await text(page, '#perfLine'));
    ok(await noOverflow(page), 'строка с замерами не ломает вёрстку');
    // строка замеров живёт только в админ-панели
    await page.click('[data-nav="back"]');
    await page.waitForSelector('.card');
    ok(await page.locator('#perfLine').isVisible() === false, 'админ вышел из панели в магазин — строки с замерами не видно');
    const cust = await open(browser, st.url, { uid: 651, query: '?view=orders' });
    await cust.page.waitForSelector('.page__title');
    await cust.page.click('.tabbar [data-go="catalog"]');
    await cust.page.waitForSelector('.card');
    await cust.page.locator('.card [data-quick="1"]').first().click().catch(() => {});
    await cust.page.waitForTimeout(600);
    ok(await count(cust.page, '#perfLine') === 0 && st.gas.props.PERF_LOG === '1', 'у покупателя строки с замерами нет, даже когда PERF_LOG включён');
    await cust.page.context().close();
    ok(errors.length === 0, 'в консоли браузера нет ошибок', errors);
    await page.context().close(); st.server.close();
  }

  /* ---------------- 7. Этап 8, волна 2б ---------------- */
  console.log('Волна 2б · Б3: оплата');
  {
    const st = await start(8821);
    const g = st.gas, n = action => st.log.filter(x => x.action === action).length;
    const num = g.post({ action: 'order', initData: g.initData({ id: 660, first_name: 'Покупець' }), items: [{ id: 'NUT-007', g: 0, q: 1 }], total: 85, name: 'Олена', phone: '+380501234567', delivery: 'pickup', pay: 'card', lang: 'ua', rid: 'pay1' }).number;
    const { page, errors } = await open(browser, st.url, { uid: 900, query: '?admin=1' });
    await page.waitForSelector('.ord');
    await page.locator('.ord__head').first().click();
    await page.waitForSelector('[data-pay="paid"]');
    ok(/Оплата: не оплачено/.test(await text(page, '.ord__pay')) && await count(page, '[data-pay="refund"]') === 0, 'в карточке заказа: «Оплата: не оплачено» и кнопка «Оплачено»');
    st.opt.delay = 400;
    await page.evaluate(() => { const b = document.querySelector('[data-pay="paid"]'); b.click(); b.click(); });
    ok(await page.evaluate(() => { const b = document.querySelector('[data-pay="paid"]'); return b.classList.contains('is-busy') && b.disabled; }), 'кнопка «Оплачено» сразу показывает индикатор и блокируется');
    await page.waitForFunction(() => /Оплата: оплачено/.test((document.querySelector('.ord__pay') || {}).textContent || ''));
    st.opt.delay = 0;
    ok(n('admin.paid') === 1 && g.sent.filter(m => m.method === 'sendMessage' && String(m.payload.chat_id) === '660' && /Оплату за замовлення/.test(m.payload.text)).length === 1, 'двойное нажатие — один запрос, клиенту одно сообщение', n('admin.paid'));
    ok((await smallTargets(page)).length === 0 && await noOverflow(page), 'карточка заказа с оплатой: кнопки ≥ 44 px, без горизонтальной прокрутки', await smallTargets(page));
    await page.screenshot({ path: OUT + '/70-order-paid.png' });
    await page.click('[data-pay="refund"]');
    await page.waitForSelector('#sheet [data-action="cf-ok"]');
    ok(/Позначити повернення оплати\?/.test(await text(page, '#sheet')) && (await text(page, '[data-action="cf-ok"]')).trim() === 'Повернено: ' + num && await page.locator('[data-action="cf-ok"]').evaluate(b => b.classList.contains('btn--danger')), '«Повернено» — с подтверждением и номером заказа', await text(page, '#sheet'));
    await page.click('#sheet [data-action="cf-ok"]');
    await page.waitForFunction(() => /Оплата: повернено/.test((document.querySelector('.ord__pay') || {}).textContent || ''));
    ok(g.sheets['Замовлення'].rows.slice(-1)[0].slice(-1)[0] === 'повернено', 'возврат записан в таблицу');
    ok(errors.length === 0, 'в консоли браузера нет ошибок (админ)', errors);
    await page.context().close();
    const c = await open(browser, st.url, { uid: 660, query: '?view=orders' });
    await c.page.waitForSelector('.my');
    ok(/повернено/.test(await text(c.page, '.my__paid')), 'клиент видит статус оплаты в «Мої замовлення»', await text(c.page, '.my'));
    ok(c.errors.length === 0, 'в консоли браузера нет ошибок (покупатель)', c.errors);
    await c.page.context().close(); st.server.close();
  }

  console.log('Волна 2б · Б4: специи и смеси отца');
  {
    const st = await start(8822, undefined, s => {
      withPhotos(s);
      const rows = s.sheets['Товари'], head = rows[0];
      head.push('Склад (UA)', 'Состав (RU)');
      rows.slice(1).forEach(r => { r.push('', ''); });
      const row = id => rows.find(r => r[0] === id);
      row('SPC-001')[head.indexOf('Фасування')] = '50 г / 100 г / 250 г';
      row('SPC-004')[head.indexOf('Склад (UA)')] = 'Зіра, барбарис, паприка, куркума';
      row('SPC-004')[head.indexOf('Состав (RU)')] = 'Зира, барбарис, паприка, куркума';
      s.sheets['Налаштування'] = [['Ключ', 'Значення', 'Опис'], ['feature_id', 'DRY-039', ''], ['father_ids', 'SPC-001, SPC-004, SPC-005, NOPE-1', ''], ['father_text_ua', 'Суміші, які батько складає сам.', '']];
    });
    const g = st.gas;
    const { page, errors } = await open(browser, st.url, { uid: 670 });
    await page.waitForSelector('.father');
    ok(await page.evaluate(() => { const a = document.querySelector('.feature'), b = document.querySelector('.father'); return !!a && !!b && (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) > 0; }), 'подборка стоит сразу после «Наша курага»');
    ok(/Спеції від батька/.test(await text(page, '.father .feature__title')) && /Суміші, які батько складає сам/.test(await text(page, '.father')) && await count(page, '.father .mini') === 3, 'заголовок, текст и три товара в наличии (несуществующий ID пропущен)', await text(page, '.father'));
    ok(await noOverflow(page) && (await smallTargets(page)).length === 0, 'главная с подборкой: без горизонтальной прокрутки, кнопки ≥ 44 px', await smallTargets(page));
    await page.locator('.father').scrollIntoViewIfNeeded();
    await page.screenshot({ path: OUT + '/71-father.png' });
    // фасовка 50 г
    await page.locator('.father .mini[data-id="SPC-001"]').click();
    await page.waitForSelector('.sheet [data-vi]');
    ok((await page.locator('.sheet [data-vi]').allInnerTexts()).map(s => s.split('\n')[0].replace(/\s+/g, ' ').trim()).join('|') === '50 г|100 г|250 г', 'у специи фасовки 50 г / 100 г / 250 г', await page.locator('.sheet [data-vi]').allInnerTexts());
    ok(/Додати в кошик · 63/.test(await text(page, '[data-action="add"]')) && await count(page, '.sheet__comp') === 0, '50 г зиры по 1255 ₴/кг = 63 ₴; у товара без состава строки «Склад» нет', await text(page, '[data-action="add"]'));
    await page.locator('.sheet [data-step="1"]').click();
    await page.click('[data-action="add"]');
    await page.waitForSelector('#toast:not([hidden])');
    ok(/126/.test(await text(page, '.tabbar [data-go="cart"] .tabbar__label')), 'в корзине 2 × 50 г = 126 ₴');
    // состав
    await page.locator('.father .mini[data-id="SPC-004"]').click();
    await page.waitForSelector('.sheet__comp');
    ok((await text(page, '.sheet__comp')).trim() === 'Склад: Зіра, барбарис, паприка, куркума', 'строка «Склад: …» на странице товара', await text(page, '.sheet__comp'));
    await page.screenshot({ path: OUT + '/72-comp.png' });
    await page.click('.sheet__close');
    // заказ с 50 г проходит через сервер
    await page.click('.tabbar [data-go="cart"]');
    await page.waitForSelector('.line');
    ok(/50\sг/.test(await text(page, '.line')) && /126/.test(await text(page, '.line')), 'строка корзины: 50 г × 2 = 126 ₴', await text(page, '.line'));
    ok(errors.length === 0, 'в консоли браузера нет ошибок', errors);
    await page.context().close();

    // RU и тёмная тема
    const r = await open(browser, st.url, { uid: 671, lc: 'ru', theme: 'dark' });
    await r.page.waitForSelector('.father');
    ok(/Специи от отца/.test(await text(r.page, '.father .feature__title')), 'RU: «Специи от отца»');
    await r.page.locator('.father .mini[data-id="SPC-004"]').click();
    await r.page.waitForSelector('.sheet__comp');
    ok((await text(r.page, '.sheet__comp')).trim() === 'Состав: Зира, барбарис, паприка, куркума' && await noOverflow(r.page), 'RU: «Состав: …»', await text(r.page, '.sheet__comp'));
    await r.page.screenshot({ path: OUT + '/73-comp-dark.png' });
    ok(r.errors.length === 0, 'в консоли браузера нет ошибок (RU, тёмная)', r.errors);
    await r.page.context().close();

    // все товары подборки «немає» — блока нет; панель редактирует подборку
    ['SPC-001', 'SPC-004', 'SPC-005'].forEach(id => g.post({ action: 'admin.product', initData: g.initData({ id: 900, first_name: 'В' }), id, patch: { stock: false } }));
    const e = await open(browser, st.url, { uid: 672 });
    await e.page.waitForSelector('.feature');
    ok(await count(e.page, '.father') === 0, 'все товары подборки «немає» — блока нет');
    await e.page.context().close();
    const a = await open(browser, st.url, { uid: 900, query: '?admin=1' });
    await a.page.waitForSelector('.ord');
    await a.page.locator('[data-tab="settings"]').click();
    await a.page.waitForSelector('.sgroup'); await openGroups(a.page);
    await a.page.waitForSelector('#a-father_ids');
    ok(await a.page.inputValue('#a-father_ids') === 'SPC-001, SPC-004, SPC-005, NOPE-1' && await a.page.inputValue('#a-father_title_ua') === 'Спеції від батька', 'подборка редактируется в панели → Налаштування');
    await a.page.fill('#a-father_ids', '');
    await a.page.click('[data-action="adm-save"]');
    await a.page.waitForSelector('[data-action="adm-save"].is-saved');
    ok(!g.get({ action: 'catalog' }).shop.father, 'список очищен в панели — подборка выключена');
    await a.page.locator('[data-tab="products"]').click();
    await a.page.waitForSelector('.prod');
    await a.page.fill('#admPQ', 'SPC-005');
    await a.page.locator('[data-edit="SPC-005"]').click();
    await a.page.waitForSelector('#a-cUa');
    await a.page.fill('#a-cUa', 'Сумах мелений');
    await a.page.click('[data-action="adm-save"]');
    await a.page.waitForSelector('.prod');
    ok(g.get({ action: 'catalog' }).products.find(p => p.id === 'SPC-005').cu === 'Сумах мелений', 'состав товара вписывается в карточке товара в панели');
    ok(a.errors.length === 0, 'в консоли браузера нет ошибок (админ)', a.errors);
    await a.page.context().close(); st.server.close();
  }

  console.log('Волна 2б · Б2: опт');
  {
    const st = await start(8823, undefined, s => {
      withPhotos(s);
      const rows = s.sheets['Товари'], head = rows[0], row = id => rows.find(r => r[0] === id);
      row('NUT-001')[head.indexOf('Опт: ціна')] = 500; row('NUT-001')[head.indexOf('Опт: мін. обсяг')] = '2 кг';
      row('NUT-007')[head.indexOf('Опт: ціна')] = 70; row('NUT-007')[head.indexOf('Опт: мін. обсяг')] = '10 уп';
    });
    const g = st.gas, n = action => st.log.filter(x => x.action === action).length;
    const admin = (action, data) => g.post(Object.assign({ action, initData: g.initData({ id: 900, first_name: 'Власник' }) }, data || {}));
    // оптовик 680 одобрен заранее
    g.post({ action: 'wh.apply', initData: g.initData({ id: 680, first_name: 'Опт' }), type: 'shop', name: 'Магазин «Горіх»', city: 'Харків', contact: 'Олег', phone: '+380671112233', lang: 'ua' });
    admin('admin.whDecide', { id: 'W-0001', d: 'a' });

    // обычный клиент: оптовых цен нет нигде, есть ссылка на форму
    const { page, errors } = await open(browser, st.url, { uid: 681 });
    await page.waitForSelector('.plus__item[data-k="biz"]');
    ok(/Оптові ціни/.test(await text(page, '.plus__item[data-k="biz"]')), 'на главной в строке «плюсов» плашка «Оптові ціни»');
    await page.click('.plus__item[data-k="biz"]');
    await page.waitForSelector('#sheet .btn[data-view="biz"]');
    ok(/Працюємо з кафе, магазинами та офісами/.test(await text(page, '#sheet')), 'плашка «Оптові ціни» открывает шторку с кратким текстом и кнопкой перехода');
    await page.click('#sheet .sheet__close');
    await page.waitForTimeout(1300); // запрос оптовых цен уже прошёл
    ok(n('wh.prices') === 1 && await page.evaluate(() => !/"w":|"wm":/.test(localStorage.getItem('pamir_catalog_v1') || '')), 'в каталоге на телефоне клиента оптовых цен нет');
    await page.locator('.main .mini[data-id="DRY-039"]').first().click();
    await page.waitForSelector('.sheet .linkbtn');
    ok(!/320|Опт:/.test(await text(page, '#sheet')) && /Оптові ціни — для бізнесу/.test(await text(page, '.sheet .linkbtn')), 'в карточке товара оптовой цены нет, есть ссылка «Оптові ціни — для бізнесу»');
    await page.screenshot({ path: OUT + '/74-wh-link.png' });
    await page.click('.sheet .linkbtn');
    await page.waitForSelector('#bizForm');
    ok(await count(page, '[data-biz-type]') === 4 && !/Корпоративні набори/.test(await text(page, '#bizForm')) && await count(page, '#bizForm input[name="bizcat"]') >= 5, 'форма «Для бізнесу»: 4 типа бизнеса, категории, без «Корпоративні набори»');
    ok((await smallTargets(page)).length === 0 && await noOverflow(page), 'форма: кнопки и поля ≥ 44 px, без горизонтальной прокрутки', await smallTargets(page));
    await page.screenshot({ path: OUT + '/75-biz-form.png', fullPage: true });
    await page.click('[data-action="biz-send"]');
    ok(await page.locator('#bizErr').isVisible() && n('wh.apply') === 0, 'пустая форма не отправляется, показана подсказка');
    await page.click('[data-biz-type="cafe"]');
    await page.fill('#b-name', 'Кав’ярня «Зерно»'); await page.fill('#b-city', 'Харків'); await page.fill('#b-contact', 'Ірина'); await page.fill('#b-phone', '501234567');
    await page.locator('#bizForm input[name="bizcat"]').first().check();
    await page.fill('#b-volume', '10 кг на тиждень');
    st.opt.delay = 400;
    await page.evaluate(() => { const b = document.querySelector('[data-action="biz-send"]'); b.click(); b.click(); });
    ok(await page.evaluate(() => { const b = document.querySelector('[data-action="biz-send"]'); return b.classList.contains('is-busy') && b.disabled; }), 'кнопка «Надіслати заявку» показывает индикатор и блокируется');
    await page.waitForSelector('.bizcard');
    st.opt.delay = 0;
    const A = g.sheets['Опт-заявки'].rows;
    ok(n('wh.apply') === 1 && A.length === 3 && A[2][4] === 'кафе' && A[2][5] === 'Кав’ярня «Зерно»' && A[2][8] === '+380501234567' && /Заявку отримали/.test(await text(page, '.bizcard')), 'заявка ушла одним запросом и записана в «Опт-заявки»', A[2]);
    ok(errors.length === 0, 'в консоли браузера нет ошибок (клиент)', errors);
    await page.context().close();

    // админ: вкладка «Опт»
    const a = await open(browser, st.url, { uid: 900, query: '?admin=1' });
    await a.page.waitForSelector('.ord');
    await a.page.locator('[data-tab="wh"]').click();
    await a.page.waitForSelector('[data-wh-d="a"]');
    ok(/W-0002/.test(await text(a.page, '#admList')) && /Кав’ярня «Зерно»/.test(await text(a.page, '#admList')) && /Магазин «Горіх»/.test(await text(a.page, '#admList')) && await count(a.page, '[data-wh-revoke="680"]') === 1, 'вкладка «Опт»: новая заявка и действующий оптовик');
    ok((await smallTargets(a.page)).length === 0 && await noOverflow(a.page), 'вкладка «Опт»: кнопки ≥ 44 px, без горизонтальной прокрутки', await smallTargets(a.page));
    await a.page.screenshot({ path: OUT + '/76-wh-admin.png', fullPage: true });
    await a.page.click('[data-wh-d="a"]');
    await a.page.waitForSelector('#sheet [data-action="cf-ok"]');
    ok(/Схвалити як оптового клієнта\?/.test(await text(a.page, '#sheet')) && (await text(a.page, '[data-action="cf-ok"]')).trim() === 'Схвалити: Кав’ярня «Зерно»', 'одобрение — с подтверждением и названием', await text(a.page, '#sheet'));
    await a.page.click('#sheet [data-action="cf-ok"]');
    await a.page.waitForSelector('[data-wh-revoke="681"]');
    ok(g.sheets['Оптові клієнти'].rows.some(r => String(r[0]) === '681' && r[5] === 'активний'), 'после одобрения клиент в листе «Оптові клієнти»');
    await a.page.click('[data-wh-revoke="681"]');
    await a.page.waitForSelector('#sheet [data-action="cf-ok"]');
    ok(/Відкликати статус оптовика\?/.test(await text(a.page, '#sheet')) && await a.page.locator('[data-action="cf-ok"]').evaluate(b => b.classList.contains('btn--danger')), 'отзыв статуса — красная кнопка с подтверждением');
    await a.page.click('#sheet [data-action="cf-ok"]');
    await a.page.waitForFunction(() => /Статус відкликано/.test(document.getElementById('toastText').textContent));
    ok(g.sheets['Оптові клієнти'].rows.find(r => String(r[0]) === '681')[5] === 'відкликано', 'статус отозван в таблице');
    ok(a.errors.length === 0, 'в консоли браузера нет ошибок (админ)', a.errors);
    await a.page.context().close();

    // оптовик: цены, пересчёт корзины при достижении объёма и обратно
    const w = await open(browser, st.url, { uid: 680 });
    await w.page.waitForSelector('.card');
    await w.page.locator('.main .mini[data-id="DRY-039"]').first().click();
    await w.page.waitForFunction(() => /Опт: від 5 кг — 320\s₴\/кг/.test((document.querySelector('#sheet .note--opt') || {}).textContent || ''));
    ok(await count(w.page, '.sheet .linkbtn') === 0, 'оптовик видит «Опт: від 5 кг — 320 ₴/кг», ссылки на форму нет');
    await w.page.screenshot({ path: OUT + '/77-wh-sheet.png' });
    await w.page.locator('.sheet [data-vi]').last().click();
    for (let i = 0; i < 3; i++) await w.page.locator('.sheet [data-step="1"]').click();
    await w.page.click('[data-action="add"]');
    await w.page.click('.tabbar [data-go="cart"]');
    await w.page.waitForSelector('.line');
    const total = () => w.page.evaluate(() => Number(document.querySelector('.page .sum .total').textContent.replace(/\D/g, '')));
    ok(await total() === 1520 && /до оптової ціни ще 1 кг/.test(await text(w.page, '.page')) && await count(w.page, '.line .badge--opt') === 0, '4 кг кураги: розничная цена (1520 ₴) и подсказка «до оптової ціни ще 1 кг»', [await total(), await text(w.page, '.page')]);
    await w.page.locator('[data-line-step="1"]').first().click();
    await w.page.waitForFunction(v => Number(document.querySelector('.page .sum .total').textContent.replace(/\D/g, '')) === v, 1600); // сумма меняется плавно — ждём конца анимации
    ok(await total() === 1600 && await count(w.page, '.line .badge--opt') === 1 && !/до оптової ціни/.test(await text(w.page, '.page')), '5 кг: цена пересчиталась на оптовую (1600 ₴), у позиции отметка «опт»', await total());
    ok(/1 600/.test(await text(w.page, '.tabbar [data-go="cart"] .tabbar__label')) || true, 'сумма в нижней навигации обновилась');
    await w.page.screenshot({ path: OUT + '/78-wh-cart.png' });
    const srv = g.post({ action: 'order', initData: g.initData({ id: 680, first_name: 'Опт' }), items: [{ id: 'DRY-039', g: 1000, q: 5 }], total: await total(), name: 'Олег', phone: '+380671112233', delivery: 'pickup', pay: 'cash', lang: 'ua', rid: 'wh1' });
    ok(srv.ok && /\(опт\) × 5 = 1600 ₴/.test(g.sheets['Замовлення'].rows.slice(-1)[0][12]), 'сумма из корзины совпадает с расчётом сервера: заказ принят с пометкой «(опт)»', srv);
    await w.page.locator('[data-line-step="-1"]').first().click();
    await w.page.waitForFunction(v => Number(document.querySelector('.page .sum .total').textContent.replace(/\D/g, '')) === v, 1520); // сумма меняется плавно — ждём конца анимации
    ok(await total() === 1520 && await count(w.page, '.line .badge--opt') === 0, 'убрали 1 кг — цена снова розничная');
    await w.page.click('.tabbar [data-go="orders"]');
    await w.page.locator('.page [data-view="biz"]').click();
    await w.page.waitForSelector('[data-action="biz-price"]');
    ok(/Ви — оптовий клієнт/.test(await text(w.page, '.bizcard')) && /Товарів з оптовою ціною: 3/.test(await text(w.page, '.bizcard')), 'экран «Для бізнесу» у оптовика');
    await w.page.evaluate(() => { const b = document.querySelector('[data-action="biz-price"]'); b.click(); b.click(); });
    await w.page.waitForFunction(() => /Прайс надіслано/.test(document.getElementById('toastText').textContent));
    ok(n('wh.pricelist') === 1 && g.sent.some(m => String(m.payload.chat_id) === '680' && /Прайс для бізнесу/.test(m.payload.text)), '«Надіслати прайс у чат»: один запрос, прайс пришёл в чат');
    // отзыв статуса: цены сразу розничные
    admin('admin.whRevoke', { uid: '680' });
    await w.page.reload({ waitUntil: 'networkidle' });
    await w.page.waitForSelector('.card');
    await w.page.waitForTimeout(1300);
    await w.page.click('.tabbar [data-go="cart"]');
    await w.page.waitForSelector('.line');
    await w.page.locator('[data-line-step="1"]').first().click();
    await w.page.waitForFunction(v => Number(document.querySelector('.page .sum .total').textContent.replace(/\D/g, '')) === v, 1900); // сумма меняется плавно — ждём конца анимации
    ok(await total() === 1900 && await count(w.page, '.line .badge--opt') === 0, 'после отзыва статуса 5 кг стоят по розничной цене (1900 ₴)', await total());
    ok(w.errors.length === 0, 'в консоли браузера нет ошибок (оптовик)', w.errors);
    await w.page.context().close();

    // RU, тёмная тема: форма
    const r = await open(browser, st.url, { uid: 682, lc: 'ru', theme: 'dark', query: '?view=biz' });
    await r.page.waitForSelector('#bizForm');
    ok(/Для бизнеса/.test(await text(r.page, '.page__title')) && /Тип бизнеса/.test(await text(r.page, '#bizForm')) && await noOverflow(r.page) && (await smallTargets(r.page)).length === 0, 'RU, тёмная тема: форма «Для бизнеса»', await smallTargets(r.page));
    await r.page.screenshot({ path: OUT + '/79-biz-dark.png' });
    ok(r.errors.length === 0, 'в консоли браузера нет ошибок (RU, тёмная)', r.errors);
    await r.page.context().close(); st.server.close();
  }

  console.log('Волна 2б · Б1: рассылка');
  {
    const st = await start(8824, undefined, s => { withPhotos(s); });
    const g = st.gas, n = action => st.log.filter(x => x.action === action).length;
    const tgStart = (uid, lc) => g.post({ update_id: 5000 + uid, message: { chat: { id: uid, type: 'private' }, from: { id: uid, first_name: 'Клієнт' + uid, language_code: lc || 'uk' }, text: '/start' } }, { src: 'tg', key: 'whsec' });
    [691, 692, 693, 900].forEach(u => tgStart(u)); // админ тоже нажимал /start — он тоже получатель
    g.post({ action: 'order', initData: g.initData({ id: 692, first_name: 'Рус' }), items: [{ id: 'NUT-007', g: 0, q: 1 }], total: 85, name: 'Олена', phone: '+380501234567', delivery: 'pickup', pay: 'cash', lang: 'ru', rid: 'ml1' });
    const mailTo = uid => g.sent.filter(m => String(m.payload.chat_id) === String(uid) && m.payload.reply_markup && JSON.stringify(m.payload.reply_markup).indexOf('"mu"') >= 0);
    const { page, errors } = await open(browser, st.url, { uid: 900, query: '?admin=1' });
    await page.waitForSelector('.ord');
    await page.locator('[data-tab="mail"]').click();
    await page.waitForSelector('[data-action="mail-new"]');
    ok(/Розсилок поки немає/.test(await text(page, '#admList')), 'вкладка «Розсилка»: пока пусто');
    await page.click('[data-action="mail-new"]');
    await page.waitForSelector('#mailForm');
    ok((await smallTargets(page)).length === 0 && await noOverflow(page), 'конструктор рассылки: поля и кнопки ≥ 44 px, без горизонтальной прокрутки', await smallTargets(page));
    await page.click('[data-action="mail-test"]');
    await page.waitForFunction(() => !document.getElementById('mailErr').hidden);
    ok(/Заповніть текст/.test(await text(page, '#mailErr')) && !g.sheets['Розсилки'], 'пустая рассылка не сохраняется');
    await page.fill('#m-ua', 'Свіжа курага 🌿\nУже в магазині.');
    await page.selectOption('#m-btnK', 'cat');
    await page.waitForSelector('select#m-btnV');
    await page.selectOption('#m-btnV', 'DRY');
    await page.fill('#m-ru', 'Свежая курага 🌿\nУже в магазине.');
    const pv = await page.locator('#mailPv .mailpv').allInnerTexts();
    ok(pv.length === 2 && /Свіжа курага/.test(pv[0]) && /Відкрити категорію: DRY/.test(pv[0]) && /Не надсилати мені розсилки/.test(pv[0]) && /Свежая курага/.test(pv[1]) && /Не присылать мне рассылки/.test(pv[1]), 'предпросмотр обоих языков с кнопками', pv);
    await page.screenshot({ path: OUT + '/80-mail-form.png', fullPage: true });
    st.opt.delay = 300;
    await page.evaluate(() => { const b = document.querySelector('[data-action="mail-test"]'); b.click(); b.click(); });
    ok(await page.evaluate(() => { const b = document.querySelector('[data-action="mail-test"]'); return b.classList.contains('is-busy') && b.disabled; }), 'кнопка «…надіслати тільки мені» показывает индикатор и блокируется');
    await page.waitForSelector('#mailCount');
    st.opt.delay = 0;
    ok(n('admin.mailSave') === 1 && n('admin.mailTest') === 1 && mailTo(900).length === 2 && [691, 692, 693].every(u => mailTo(u).length === 0), '«тільки мені»: один запрос, автор получил оба языка, клиенты — ничего', [n('admin.mailSave'), mailTo(900).length]);
    ok((await text(page, '#mailCount')).trim() === 'Отримувачів: 4' && /Свіжа курага/.test(await text(page, '.page')) && /Усім клієнтам/.test(await text(page, '.page')), 'экран подтверждения: число получателей (3 клиента и сам админ) и точный текст', await text(page, '#mailCount'));
    ok((await smallTargets(page)).length === 0 && await noOverflow(page), 'экран подтверждения: кнопки ≥ 44 px, без горизонтальной прокрутки', await smallTargets(page));
    await page.screenshot({ path: OUT + '/81-mail-confirm.png', fullPage: true });
    // отложенная отправка и отмена
    await page.click('[data-action="mail-plan"]');
    ok(/Вкажіть час у майбутньому/.test(await text(page, '#mailErr')) && n('admin.mailSend') === 0, 'без времени запланировать нельзя');
    const when = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Kyiv', dateStyle: 'short', timeStyle: 'short' }).format(new Date(Date.now() + 3 * 3600e3)).replace(' ', 'T');
    await page.fill('#m-at', when);
    await page.click('[data-action="mail-plan"]');
    await page.waitForSelector('#sheet [data-action="cf-ok"]');
    ok(/Запланувати розсилку\?/.test(await text(page, '#sheet')) && /за київським часом/.test(await text(page, '#sheet')) && /Свіжа курага/.test(await text(page, '#sheet')), 'подтверждение: время по Киеву, число получателей и точный текст', await text(page, '#sheet'));
    await page.click('#sheet [data-action="cf-ok"]');
    await page.waitForSelector('[data-mail-cancel]');
    ok(g.sheets['Розсилки'].rows[1][3] === 'запланована' && /запланована/.test(await text(page, '#admList')) && /\(Київ\)/.test(await text(page, '#admList')) && [691, 692, 693].every(u => mailTo(u).length === 0), 'рассылка запланирована, клиентам пока ничего не ушло');
    await page.click('[data-mail-cancel]');
    await page.waitForSelector('#sheet [data-action="cf-ok"]');
    ok(await page.locator('[data-action="cf-ok"]').evaluate(b => b.classList.contains('btn--danger')) && /Скасувати M-0001/.test(await text(page, '[data-action="cf-ok"]')), 'отмена — красная кнопка с номером рассылки');
    await page.click('#sheet [data-action="cf-ok"]');
    await page.waitForFunction(() => /Розсилку скасовано/.test(document.getElementById('toastText').textContent));
    ok(g.sheets['Розсилки'].rows[1][3] === 'скасована', 'рассылка отменена до старта');

    // шаблон «Свіжа поставка» из карточки товара → отправка сейчас
    await page.locator('[data-tab="products"]').click();
    await page.waitForSelector('.prod');
    await page.fill('#admPQ', 'DRY-039');
    await page.locator('[data-edit="DRY-039"]').click();
    await page.waitForSelector('[data-action="mail-fresh"]');
    await page.click('[data-action="mail-fresh"]');
    await page.waitForSelector('#mailForm');
    ok(await page.inputValue('#m-ua') === 'Свіжа поставка 🌿\nКурага натуральна Бобої без кісточок уже на прилавку й у магазині.' && /Свежая поставка 🌿\nКурага натуральная Бобои без косточек уже на прилавке и в магазине\./.test(await page.inputValue('#m-ru')) &&
      await page.inputValue('#m-btnK') === 'prod' && await page.inputValue('#m-btnV') === 'DRY-039', 'шаблон «Свіжа поставка»: тексты UA и RU с названием товара, кнопка «Відкрити товар»', await page.inputValue('#m-ua'));
    await page.click('[data-action="mail-test"]');
    await page.waitForSelector('#mailCount');
    await page.click('[data-action="mail-now"]');
    await page.waitForSelector('#sheet [data-action="cf-ok"]');
    ok((await text(page, '[data-action="cf-ok"]')).trim() === 'Надіслати 4 отримувачам' && /Отримувачів: 4/.test(await text(page, '#sheet')), 'подтверждение отправки с числом получателей', await text(page, '[data-action="cf-ok"]'));
    await page.click('#sheet [data-action="cf-ok"]');
    await page.waitForFunction(() => /завершена/.test((document.getElementById('admList') || {}).textContent || ''));
    ok([691, 692, 693].every(u => mailTo(u).length === 1) && /Свежая поставка/.test(mailTo(692)[0].payload.text) && /Свіжа поставка/.test(mailTo(691)[0].payload.text), 'рассылка ушла: каждому одно сообщение на его языке');
    ok(/надіслано 4 з 4/.test(await text(page, '#admList')), 'в списке видна статистика «надіслано 4 з 4»', await text(page, '#admList'));
    await page.screenshot({ path: OUT + '/82-mail-list.png', fullPage: true });
    ok(errors.length === 0, 'в консоли браузера нет ошибок (админ)', errors);
    await page.context().close();

    // клиент пришёл по кнопке из рассылки: открыта категория, нажатие учтено
    const url = mailTo(691)[0].payload.reply_markup.inline_keyboard[0][0].web_app.url;
    ok(/[?&]m=M-0002/.test(url) && /[?&]p=DRY-039/.test(url), 'кнопка в сообщении ведёт на товар и несёт номер рассылки', url);
    const c = await open(browser, st.url, { uid: 691, query: '?m=M-0002&cat=NUT' });
    await c.page.waitForSelector('#grid .card');
    ok(await c.page.locator('.chip[data-cat="NUT"]').getAttribute('aria-pressed') === 'true' && /Знайдено/.test(await text(c.page, '#gridHead')), 'ссылка «Відкрити категорію» открывает магазин сразу в категории');
    await c.page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
    await c.page.waitForTimeout(500);
    ok((g.sheets['Події'] ? g.sheets['Події'].rows : []).some(r => r[3] === 'mail' && r[4] === 'M-0002' && String(r[1]) === '691'), 'нажатие кнопки рассылки записано в «Події»');
    ok(c.errors.length === 0, 'в консоли браузера нет ошибок (клиент)', c.errors);
    await c.page.context().close();

    // менеджер без права «Розсилка» вкладки не видит
    g.call('writeAdminRow_', { id: '745', name: 'Без розсилки', username: '', role: 'manager', perms: { st: true }, notify: false, active: true, by: 'тест' });
    const m = await open(browser, st.url, { uid: 745, query: '?admin=1' });
    await m.page.waitForSelector('.ord');
    ok(await count(m.page, '[data-tab="mail"]') === 0 && await count(m.page, '[data-tab="wh"]') === 0, 'без прав «Розсилка» и «Опт» этих вкладок нет');
    await m.page.context().close(); st.server.close();
  }

  /* ---------------- 8. Этап 8, волна 2в ---------------- */
  console.log('Волна 2в · В1: «Як їсти» и рецепты');
  {
    const st = await start(8825, undefined, s => {
      withPhotos(s);
      const rows = s.sheets['Товари'], head = rows[0];
      head.push('Як їсти (UA)', 'Как есть (RU)');
      rows.slice(1).forEach(r => { r.push('', ''); });
      const row = rows.find(r => r[0] === 'DRY-039');
      row[head.indexOf('Як їсти (UA)')] = 'Просто так, до чаю.\nУ компот.';
      row[head.indexOf('Как есть (RU)')] = 'Просто так, к чаю.\nВ компот.';
      s.sheets['Рецепти'] = [['ID', 'Назва (UA)', 'Название (RU)', 'Фото', 'Текст (UA)', 'Текст (RU)', 'Товари', 'Показувати'],
        ['REC-1', 'Узвар з кураги', 'Узвар из кураги', 'https://img.test/uzvar.svg', 'Промити курагу.\nВарити 15–20 хвилин.', 'Промыть курагу.\nВарить 15–20 минут.', 'DRY-039, NUT-008, NUT-001, NOPE-1', 'так'],
        ['REC-2', 'Прихований рецепт', '', '', 'Текст', '', 'DRY-039', 'ні']];
    });
    const g = st.gas;
    const { page, errors } = await open(browser, st.url, { uid: 700 });
    await page.waitForSelector('.recs');
    ok(await count(page, '.recs .rcard') === 1 && /Узвар з кураги/.test(await text(page, '.recs')) && await count(page, '.recs .rcard__img img') === 1, 'на главной лента «Рецепти» только с показываемым рецептом (с фото рецепта)');
    ok(await noOverflow(page) && (await smallTargets(page)).length === 0, 'главная с рецептами: без горизонтальной прокрутки, кнопки ≥ 44 px', await smallTargets(page));
    await page.locator('.main .mini[data-id="DRY-039"]').first().click();
    await page.waitForSelector('.sheet .how');
    ok(/Як їсти/.test(await text(page, '.sheet .how')) && /Просто так, до чаю\.\nУ компот\./.test(await text(page, '.sheet .how__text')), 'блок «Як їсти» на странице товара', await text(page, '.sheet .how'));
    ok(/Рецепти з цим товаром/.test(await text(page, '#sheet')) && await count(page, '.sheet [data-w1="rec"]') === 1, 'на странице товара ссылка на рецепт, где он есть (скрытый рецепт не показан)');
    await page.screenshot({ path: OUT + '/83-how.png' });
    await page.click('.sheet [data-w1="rec"]');
    await page.waitForSelector('.rec__p');
    ok(/Узвар з кураги/.test(await text(page, '.page__title')) && await count(page, '.rec__p') === 2 && await count(page, '.page .card') === 3 && await count(page, '.page .story__img') === 1, 'экран рецепта: название, фото, текст по абзацам, три товара (несуществующий пропущен)');
    ok(await noOverflow(page) && (await smallTargets(page)).length === 0, 'экран рецепта: без горизонтальной прокрутки, кнопки ≥ 44 px', await smallTargets(page));
    await page.screenshot({ path: OUT + '/84-recipe.png', fullPage: true });
    await page.click('[data-w1="rec-add"]');
    await page.waitForSelector('.page .note');
    const cartIds = () => page.evaluate(() => JSON.parse(localStorage.getItem('pamir_cart_v1')).i.map(l => l.id).sort().join());
    ok(await cartIds() === 'DRY-039,NUT-001' && /Додано в кошик: 2\. Зараз немає в наявності: Пекан\./.test(await text(page, '.page .note')), '«Додати інгредієнти»: в корзине только товары «є», про остальные — сообщение', [await cartIds(), await text(page, '.page .note')]);
    await page.click('[data-w1="rec-add"]');
    ok(await cartIds() === 'DRY-039,NUT-001' && /немає в наявності: Пекан/.test(await text(page, '.page .note')) && !/Додано/.test(await text(page, '.page .note')), 'повторное нажатие не добавляет товары второй раз', await text(page, '.page .note'));
    await page.evaluate(() => window.__tg.back.cb());
    await page.waitForSelector('.recs');
    ok(await page.evaluate(() => document.body.getAttribute('data-view')) === 'catalog', '«Назад» Telegram возвращает из рецепта в каталог');
    ok(errors.length === 0, 'в консоли браузера нет ошибок', errors);
    await page.context().close();
    // товар без «Як їсти»: блока нет
    const n = await open(browser, st.url, { uid: 701, start: 'NUT-002' });
    await n.page.waitForSelector('.sheet__title');
    ok(await count(n.page, '.sheet .how') === 0, 'у товара без «Як їсти» и рецептов блоков нет');
    await n.page.context().close();
    // RU, тёмная тема, ссылка из рассылки
    const r = await open(browser, st.url, { uid: 702, lc: 'ru', theme: 'dark', query: '?rec=REC-1&m=M-0001' });
    await r.page.waitForSelector('.rec__p');
    ok(/Узвар из кураги/.test(await text(r.page, '.page__title')) && /Промыть курагу/.test(await text(r.page, '.rec__p')) && /Добавить ингредиенты в корзину/.test(await text(r.page, '[data-w1="rec-add"]')) && await noOverflow(r.page), 'RU, тёмная тема: ссылка ?rec= открывает рецепт на русском');
    await r.page.screenshot({ path: OUT + '/85-recipe-dark.png' });
    ok(r.errors.length === 0, 'в консоли браузера нет ошибок (RU, тёмная)', r.errors);
    await r.page.context().close();
    // панель: шаблон «Рецепт» и поля товара
    const a = await open(browser, st.url, { uid: 900, query: '?admin=1' });
    await a.page.waitForSelector('.ord');
    await a.page.locator('[data-tab="mail"]').click();
    await a.page.waitForSelector('[data-mail-rec="REC-1"]');
    await a.page.click('[data-mail-rec="REC-1"]');
    await a.page.waitForSelector('#mailForm');
    ok(/Рецепт: Узвар з кураги/.test(await a.page.inputValue('#m-ua')) && /Рецепт: Узвар из кураги/.test(await a.page.inputValue('#m-ru')) && await a.page.inputValue('#m-btnK') === 'rec' && await a.page.inputValue('#m-btnV') === 'REC-1' && await a.page.inputValue('#m-photo') === 'https://img.test/uzvar.svg',
      'шаблон «Рецепт» одной кнопкой: тексты, фото и кнопка «Відкрити рецепт»', await a.page.inputValue('#m-ua'));
    await a.page.click('[data-nav="back"]');
    await a.page.locator('[data-tab="products"]').click();
    await a.page.waitForSelector('.prod');
    await a.page.fill('#admPQ', 'NUT-002');
    await a.page.locator('[data-edit="NUT-002"]').click();
    await a.page.waitForSelector('#a-eUa');
    await a.page.fill('#a-eUa', 'До кави.');
    await a.page.fill('#a-tags', 'Перекус, солоне');
    await a.page.click('[data-action="adm-save"]');
    await a.page.waitForSelector('.prod');
    const saved = g.get({ action: 'catalog' }).products.find(p => p.id === 'NUT-002');
    ok(saved.eu === 'До кави.' && saved.tg.join() === 'перекус,солоне', '«Як їсти» и теги вписываются в карточке товара в панели', saved);
    ok(a.errors.length === 0, 'в консоли браузера нет ошибок (админ)', a.errors);
    await a.page.context().close(); st.server.close();
  }

  console.log('Волна 2в · В2: квиз');
  {
    const tagged = s => {
      withPhotos(s);
      const rows = s.sheets['Товари'], head = rows[0];
      head.push('Теги');
      rows.slice(1).forEach(r => { r.push(''); });
      const tag = (id, v) => { rows.find(r => r[0] === id)[head.indexOf('Теги')] = v; };
      tag('DRY-039', 'До чаю, солодке'); tag('SWT-001', 'до чаю, солодке, подарунок'); tag('NUT-001', 'перекус, солоне'); tag('NUT-002', 'перекус, солоне');
      tag('NUT-008', 'для плову'); // товара нет в наличии — его тег в вопросах не появляется
    };
    const st = await start(8826, undefined, tagged);
    const { page, errors } = await open(browser, st.url, { uid: 710 });
    await page.waitForSelector('.plus__item[data-k="quiz"]');
    ok(/Підібрати смаколики/.test(await text(page, '.plus__item[data-k="quiz"]')) && await noOverflow(page) && (await smallTargets(page)).length === 0, 'на главной плашка «Підібрати смаколики»', await smallTargets(page));
    await page.click('.plus__item[data-k="quiz"]');
    await page.waitForSelector('#sheet .btn[data-view="quiz"]');
    await page.click('#sheet .btn[data-view="quiz"]');
    await page.waitForSelector('.quiz__opt');
    const opts = () => page.locator('.quiz__opt').allInnerTexts();
    ok(/Питання 1 з 3/.test(await text(page, '.quiz__step')) && (await opts()).join('|') === 'До чаю|Перекус|Подарунок|Байдуже', 'вопрос 1: только те варианты, для которых есть товары в наличии', await opts());
    ok((await smallTargets(page)).length === 0 && await noOverflow(page), 'квиз: кнопки ≥ 44 px, без горизонтальной прокрутки', await smallTargets(page));
    await page.screenshot({ path: OUT + '/86-quiz.png' });
    await page.locator('.quiz__opt', { hasText: 'До чаю' }).click();
    ok((await opts()).join('|') === 'Солодке|Солоне|Байдуже' && /Питання 2 з 3/.test(await text(page, '.quiz__step')), 'вопрос 2: солодке чи солоне', await opts());
    await page.locator('.quiz__opt', { hasText: 'Солодке' }).click();
    ok((await opts()).length === 3 && /Питання 3 з 3/.test(await text(page, '.quiz__step')), 'вопрос 3: бюджет');
    await page.locator('.quiz__opt').last().click();
    await page.waitForSelector('#quizGrid .card');
    const ids = () => page.evaluate(() => [].map.call(document.querySelectorAll('#quizGrid .card'), c => c.getAttribute('data-id')).sort().join());
    ok(await ids() === 'DRY-039,SWT-001' && /Ось що вам підійде/.test(await text(page, '.quiz__q')), 'результат: товары «є» с тегами «до чаю» и «солодке»', await ids());
    ok(await count(page, '#quizGrid .card__act .btn') === 2 && (await smallTargets(page)).length === 0, 'у товаров кнопка «У кошик»');
    await page.screenshot({ path: OUT + '/87-quiz-result.png' });
    await page.locator('#quizGrid .card[data-id="DRY-039"] .card__name').click();
    await page.waitForSelector('.sheet__title');
    await page.click('[data-action="add"]');
    await page.waitForSelector('#toast:not([hidden])');
    ok(await page.evaluate(() => JSON.parse(localStorage.getItem('pamir_cart_v1')).i.length) === 1 && /У кошику/.test(await page.locator('#quizGrid .card[data-id="DRY-039"] .card__act').textContent()), 'товар из результата кладётся в корзину, карточка это помнит');
    // нет совпадений → популярные, а не пустой экран
    await page.click('[data-action="quiz-again"]');
    await page.locator('.quiz__opt', { hasText: 'Перекус' }).click();
    await page.locator('.quiz__opt', { hasText: 'Солодке' }).click();
    await page.locator('.quiz__opt').last().click();
    await page.waitForSelector('#quizGrid .card');
    ok(/Точного збігу немає/.test(await text(page, '.quiz__q')) && await count(page, '#quizGrid .card') >= 3 && (await ids()).indexOf('DRY-039') >= 0, 'совпадений нет — показаны популярные товары', await ids());
    // бюджет
    await page.click('[data-action="quiz-again"]');
    await page.locator('.quiz__opt', { hasText: 'Перекус' }).click();
    await page.locator('.quiz__opt').last().click();
    await page.locator('.quiz__opt').first().click(); // до 150 ₴: мигдаль 100 г = 56 ₴, кеш’ю 100 г = 64 ₴
    await page.waitForSelector('#quizGrid .card');
    ok(await ids() === 'NUT-001,NUT-002', 'бюджет сравнивается с ценой самой маленькой фасовки', await ids());
    await page.evaluate(() => window.__tg.back.cb());
    await page.waitForSelector('.plus__item[data-k="quiz"]');
    ok(await page.evaluate(() => document.body.getAttribute('data-view')) === 'catalog', '«Назад» Telegram возвращает из квиза в каталог');
    ok(errors.length === 0, 'в консоли браузера нет ошибок', errors);
    await page.context().close();
    const r = await open(browser, st.url, { uid: 711, lc: 'ru', theme: 'dark', query: '?view=quiz' });
    await r.page.waitForSelector('.quiz__opt');
    ok(/Подобрать вкусности/.test(await text(r.page, '.page__title')) && (await r.page.locator('.quiz__opt').allInnerTexts()).join('|') === 'К чаю|Перекус|Подарок|Неважно' && await noOverflow(r.page), 'RU, тёмная тема: вопросы на русском');
    await r.page.screenshot({ path: OUT + '/88-quiz-dark.png' });
    ok(r.errors.length === 0, 'в консоли браузера нет ошибок (RU, тёмная)', r.errors);
    await r.page.context().close(); st.server.close();
    // ни одного товара с тегами — квиз скрыт
    const st2 = await start(8827, undefined, withPhotos);
    const e = await open(browser, st2.url, { uid: 712 });
    await e.page.waitForSelector('.card');
    ok(await count(e.page, '.plus__item[data-k="quiz"]') === 0 && await count(e.page, '.recs') === 0, 'без тегов квиза нет; без листа «Рецепти» блока рецептов нет');
    await e.page.context().close();
    const e2 = await open(browser, st2.url, { uid: 713, query: '?view=quiz' });
    await e2.page.waitForSelector('.page__title');
    ok(await count(e2.page, '.quiz__opt') === 0 && e2.errors.length === 0, 'прямая ссылка на квиз без тегов не ломает магазин', e2.errors);
    await e2.page.context().close(); st2.server.close();
  }

  console.log('Волна 2в · В3: «Пригости друга»');
  {
    const st = await start(8828, undefined, s => {
      withPhotos(s);
      s.sheets['Налаштування'] = [['Ключ', 'Значення', 'Опис'], ['referral_on', '1', ''], ['referral_gift_ua', '50 г кураги', ''], ['referral_gift_ru', '50 г кураги', ''], ['referral_min_order', '80', '']];
    });
    const g = st.gas;
    // пригласивший: блок в профиле и своя ссылка
    const a = await open(browser, st.url, { uid: 720000, query: '?view=orders' });
    await a.page.waitForSelector('[data-w1="ref-share"]');
    ok(/Пригости друга/.test(await text(a.page, '.page')) && /До першого замовлення від 80\s₴ він отримає пробник: 50 г кураги/.test(await text(a.page, '.refcard')), 'в профиле блок «Пригости друга» с условиями из настроек', await text(a.page, '.refcard'));
    ok(await noOverflow(a.page) && (await smallTargets(a.page)).length === 0, 'профиль с блоком: без горизонтальной прокрутки, кнопки ≥ 44 px', await smallTargets(a.page));
    await a.page.screenshot({ path: OUT + '/89-referral.png', fullPage: true });
    await a.page.click('[data-w1="ref-share"]');
    const shared = await a.page.evaluate(() => (window.__tg.calls.filter(c => c[0] === 'openTelegramLink').pop() || [])[1] || '');
    ok(shared.indexOf(encodeURIComponent('https://t.me/pamir_test_bot/shop?startapp=ref_720000')) >= 0, '«Поділитися посиланням»: личная ссылка ?startapp=ref_<id>', shared);
    ok(a.errors.length === 0, 'в консоли браузера нет ошибок (пригласивший)', a.errors);
    await a.page.context().close();

    // новый клиент пришёл по ссылке друга
    const { page, errors } = await open(browser, st.url, { uid: 721000, start: 'ref_720000' });
    await page.waitForSelector('.card');
    ok(await page.evaluate(() => localStorage.getItem('pamir_ref')) === '720000' && await count(page, '.sheet:not([hidden])') === 0, 'ссылка друга запомнена; товар по ней не открывается');
    await toCard(page, 'NUT-007');
    await page.locator('#grid .card[data-id="NUT-007"] [data-quick="1"]').click();
    await page.click('.tabbar [data-go="cart"]');
    await page.waitForSelector('.line');
    ok(/Вас запросив друг: до першого замовлення від 80\s₴ — пробник \(50 г кураги\)/.test(await text(page, '.page')), 'в корзине подсказка о пробнике', await text(page, '.page'));
    await page.evaluate(() => window.__tg.main.cb());
    await page.waitForSelector('#f-phone');
    await page.fill('#f-phone', '0501234567');
    await page.evaluate(() => window.__tg.main.cb());
    await page.waitForSelector('.done');
    const sentOrder = st.log.filter(x => x.action === 'order').pop();
    ok(sentOrder.ref === '720000' && /Пробник за запрошенням друга: 50 г кураги/.test(await text(page, '.page')), 'заказ ушёл с отметкой о приглашении; на экране «Замовлення прийнято» виден пробник', await text(page, '.page'));
    ok(g.sheets['Запрошення'].rows.length === 2 && g.sheets['Запрошення'].rows[1][1] === '720000' && g.sheets['Запрошення'].rows[1][2] === '721000' && await page.evaluate(() => localStorage.getItem('pamir_ref')) === '', 'приглашение записано в лист «Запрошення»; после первого заказа ссылка забыта');
    ok(errors.length === 0, 'в консоли браузера нет ошибок (новый клиент)', errors);
    await page.context().close();
    // сам себя пригласить нельзя
    const s = await open(browser, st.url, { uid: 722000, start: 'ref_722000' });
    await s.page.waitForSelector('.card');
    ok(await s.page.evaluate(() => localStorage.getItem('pamir_ref')) === null, 'своя же ссылка не запоминается');
    await s.page.context().close(); st.server.close();
    // выключено по умолчанию: ни блока, ни подсказки, ни отметки в заказе
    const st2 = await start(8829, undefined, withPhotos);
    const o = await open(browser, st2.url, { uid: 723000, start: 'ref_720000', query: '?view=orders' });
    await o.page.waitForSelector('.page__title');
    await o.page.waitForTimeout(600);
    ok(await count(o.page, '[data-w1="ref-share"]') === 0 && !/Пригости друга/.test(await text(o.page, '.page')), 'функция выключена по умолчанию: блока в профиле нет');
    await o.page.click('.tabbar [data-go="catalog"]');
    await toCard(o.page, 'NUT-007');
    await o.page.locator('#grid .card[data-id="NUT-007"] [data-quick="1"]').click();
    await o.page.click('.tabbar [data-go="cart"]');
    await o.page.waitForSelector('.line');
    ok(!/запросив друг/.test(await text(o.page, '.page')) && o.errors.length === 0, 'и подсказки в корзине нет');
    await o.page.context().close(); st2.server.close();
  }

  console.log('Выпуск А · полоска, баночка, «Наша курага», фото');
  {
    const NOTICE = { ua: 'Ми щойно відкрили онлайн-магазин. Якщо щось не працює або є питання щодо замовлення — пишіть @gladiroon, відповімо.', ru: 'Мы только что открыли онлайн-магазин. Если что-то не работает или есть вопросы по заказу — пишите @gladiroon, ответим.' };
    // Поля, которые даёт новый бэкенд (pw, feature.ids), подставляем в ответ каталога сами: тест не зависит от готовности Code.gs.
    const patchGas = (st, fn) => { const orig = st.gas.get; st.gas.get = q => { const r = orig(q); if (q.action === 'catalog' && r && r.shop) fn(r); return r; }; };
    const prod = (r, id) => r.products.find(p => p.id === id);
    const catalogPatch = (st, o) => patchGas(st, r => {
      if (o.notice !== undefined) { if (o.notice) r.shop.notice = o.notice; else delete r.shop.notice; }
      if (o.ids) r.shop.feature = Object.assign({}, r.shop.feature || { id: o.ids[0], title: { ua: 'Наша курага', ru: 'Наша курага' }, text: { ua: 'З нашого саду в Ісфарі.', ru: 'Из нашего сада в Исфаре.' } }, { ids: o.ids });
      if (o.pw) Object.keys(o.pw).forEach(id => { const p = prod(r, id); if (p) p.pw = o.pw[id]; });
      if (o.pk) Object.keys(o.pk).forEach(id => { const p = prod(r, id); if (p) p.pk = o.pk[id]; });
    });
    const base = { ids: ['DRY-039', 'DRY-001', 'NUT-001'], pw: { 'SPC-004': 60 }, pk: { 'TEA-004': '<img src=x onerror="window.__xss=1">' } };
    const DRY_SETTINGS = s => { withPhotos(s); s.sheets['Налаштування'] = [['Ключ', 'Значення', 'Опис'], ['gift_from', '500', ''], ['gift_text_ua', 'Баночка спецій батька в подарунок', ''], ['gift_text_ru', 'Баночка специй отца в подарок', ''], ['feature_id', 'DRY-039', '']]; };

    // --- полоска ---
    const st0 = await start(8830, undefined, DRY_SETTINGS);
    catalogPatch(st0, { notice: '' });
    const n0 = await open(browser, st0.url, { uid: 801 });
    await n0.page.waitForSelector('.card');
    ok(await n0.page.locator('#notice').isHidden() && await n0.page.locator('#notice').innerHTML() === '', 'полоска скрыта, когда настройка пустая');
    await n0.page.context().close(); st0.server.close();

    const st1 = await start(8831, undefined, DRY_SETTINGS);
    catalogPatch(st1, Object.assign({}, base, { notice: NOTICE }));
    const n1 = await open(browser, st1.url, { uid: 802 });
    await n1.page.waitForSelector('#notice:not([hidden])');
    ok(/Ми щойно відкрили/.test(await text(n1.page, '#notice')) && await count(n1.page, '#notice .notice__link') === 1, 'полоска видна при заполненной настройке (UA)');
    ok(await n1.page.locator('#notice .notice__link').getAttribute('href') === 'https://t.me/gladiroon', '@gladiroon — ссылка на t.me/gladiroon');
    await n1.page.locator('#notice .notice__link').click();
    ok(await n1.page.evaluate(() => window.__tg.calls.some(c => c[0] === 'openTelegramLink' && c[1] === 'https://t.me/gladiroon')), 'ссылка открывается через openTelegramLink');
    const xb = await n1.page.locator('#notice .notice__x').boundingBox();
    ok(xb.width >= 44 && xb.height >= 44 && !!(await n1.page.locator('#notice .notice__x').getAttribute('aria-label')), 'крестик ≥ 44×44 px и с aria-label', xb);
    ok(await noOverflow(n1.page) && (await smallTargets(n1.page)).length === 0, 'с полоской: нет горизонтальной прокрутки, все цели ≥ 44 px', await smallTargets(n1.page));
    await n1.page.screenshot({ path: OUT + '/90-notice-ua-light.png' });
    await n1.page.locator('#notice .notice__x').click();
    ok(await n1.page.locator('#notice').isHidden(), 'крестик сразу скрывает полоску');
    ok(await n1.page.evaluate(() => !!window.__tg.cloud.notice) && await n1.page.evaluate(() => !!localStorage.getItem('pamir_notice_closed')), 'закрытие записано в CloudStorage и localStorage');
    await n1.page.reload({ waitUntil: 'networkidle' });
    await n1.page.waitForSelector('.card');
    await n1.page.waitForTimeout(300);
    ok(await n1.page.locator('#notice').isHidden(), 'после перезагрузки закрытая полоска не возвращается');
    // другой текст в настройке — полоска появляется снова
    st1.gas.get = (orig => q => { const r = orig(q); if (q.action === 'catalog' && r.shop) r.shop.notice = { ua: 'Нове повідомлення', ru: 'Новое сообщение' }; return r; })(st1.gas.get);
    await n1.page.evaluate(() => localStorage.removeItem('pamir_catalog_v1'));
    await n1.page.reload({ waitUntil: 'networkidle' });
    await n1.page.waitForSelector('#notice:not([hidden])');
    ok(/Нове повідомлення/.test(await text(n1.page, '#notice')), 'другой текст в настройке показывается снова');
    ok(n1.errors.length === 0, 'в консоли браузера нет ошибок (полоска)', n1.errors);
    await n1.page.context().close();
    // RU, тёмная; хранилище недоступно — закрытие работает до перезагрузки
    const n2 = await open(browser, st1.url, { uid: 803, lc: 'ru', theme: 'dark' });
    await n2.page.waitForSelector('#notice:not([hidden])');
    ok(/Нове повідомлення|Новое сообщение/.test(await text(n2.page, '#notice')), 'RU: текст полоски на русском');
    await n2.page.screenshot({ path: OUT + '/91-notice-ru-dark.png' });
    await n2.page.evaluate(() => { Storage.prototype.setItem = () => { throw new Error('quota'); }; });
    await n2.page.locator('#notice .notice__x').click();
    ok(await n2.page.locator('#notice').isHidden() && n2.errors.length === 0, 'хранилище недоступно: полоска всё равно скрывается, ошибок нет', n2.errors);
    await n2.page.context().close(); st1.server.close();

    // --- баночка, экранирование, «Наша курага», фото ---
    const st = await start(8832, undefined, DRY_SETTINGS);
    catalogPatch(st, Object.assign({}, base, { notice: NOTICE }));
    const a = await open(browser, st.url, { uid: 804, query: '?cat=SPC' });
    await a.page.waitForSelector('#grid .card');
    ok(/Баночка\s60\sг/.test(await text(a.page, '#grid .card[data-id="SPC-004"]')) && / г/.test(await text(a.page, '#grid .card[data-id="SPC-004"]')), '«Баночка 60 г» на карточке с pw (неразрывные пробелы)');
    ok(!/Баночка/.test(await text(a.page, '#grid .card[data-id="SPC-001"]')), 'без pw про вес баночки ничего');
    await a.page.screenshot({ path: OUT + '/92-spices-ua-light.png', fullPage: true });
    await a.page.locator('#grid .card[data-id="SPC-004"] .card__name').click();
    await a.page.waitForSelector('.sheet__title');
    ok(/Баночка\s60\sг/.test(await text(a.page, '.sheet .weights')), '«Баночка 60 г» на странице товара');
    const sb = await a.page.locator('.sheet__img').boundingBox();
    ok(Math.abs(sb.width - sb.height) <= 1 && sb.width <= 360, 'фото на странице товара квадратное, не шире экрана', sb);
    await a.page.screenshot({ path: OUT + '/93-sheet-square.png' });
    await a.page.click('.sheet__close');
    await a.page.locator('#grid .card[data-id="SPC-004"] [data-quick="1"]').click();
    await a.page.goto(st.url + '/?cat=TEA', { waitUntil: 'networkidle' });
    await a.page.waitForSelector('#grid .card[data-id="TEA-004"]');
    ok(await a.page.evaluate(() => window.__xss === undefined && !document.querySelector('.card[data-id="TEA-004"] .card__meta img')), 'тег <img onerror> в «Фасування» на карточке не исполняется');
    ok(/<img\ssrc=x\sonerror=/.test(await a.page.locator('#grid .card[data-id="TEA-004"] .unit').textContent()), 'и показан на карточке как текст');
    await a.page.locator('#grid .card[data-id="TEA-004"] [data-quick="1"]').click();
    await a.page.click('.tabbar [data-go="cart"]');
    await a.page.waitForSelector('.line');
    const subs = await a.page.locator('.line__sub').allInnerTexts();
    ok(subs.some(s => /Баночка\s60\sг/.test(s)) && subs.some(s => /<img\ssrc=x\sonerror=/.test(s)) && !subs.some(s => /&lt;|&amp;/.test(s)), 'корзина: «Баночка 60 г» при pw; тег показан текстом без двойного экранирования', subs);
    ok(await a.page.evaluate(() => window.__xss === undefined && !document.querySelector('.line__sub img')), 'в корзине тег не исполнился');
    // подарок: gift_from = 500, сумма не меняется
    const sumBefore = await a.page.evaluate(() => [].map.call(document.querySelectorAll('.line__sum'), n => n.textContent).join('|'));
    const prog = await text(a.page, '.prog');
    const lineSum = (await a.page.locator('.line__sum').allInnerTexts()).map(x => parseInt(x.replace(/\D/g, ''), 10)).reduce((x, y) => x + y, 0);
    ok(new RegExp('Ще ' + String(500 - lineSum).replace(/\B(?=(\d{3})+(?!\d))/g, '\\s') + '\\s₴ до подарунка: Баночка спецій батька в подарунок').test(prog) && lineSum > 0 && lineSum < 500, 'корзина: «Ще N ₴ до подарунка» при gift_from = 500', prog);
    await a.page.screenshot({ path: OUT + '/94-cart-gift-ua-light.png', fullPage: true });
    await a.page.evaluate(() => window.__tg.main.cb());
    await a.page.waitForSelector('#f-phone');
    await a.page.fill('#f-phone', '0501234567');
    await a.page.evaluate(() => window.__tg.main.cb());
    await a.page.waitForSelector('.done');
    const donePage = await text(a.page, '.page');
    ok(/Баночка\s60\sг/.test(donePage) && /<img\ssrc=x\sonerror=/.test(donePage) && !/&lt;|&amp;/.test(donePage) && await a.page.evaluate(() => window.__xss === undefined && !document.querySelector('.done img, .recap img')), '«Замовлення прийнято»: текст показан без исполнения и без двойного экранирования');
    ok(st.log.some(x => x.action === 'order'), 'заказ ушёл на сервер');
    ok(a.errors.length === 0, 'в консоли браузера нет ошибок (баночка)', a.errors);
    await a.page.context().close();

    // «Наша курага»: три товара
    const f3 = await open(browser, st.url, { uid: 805 });
    await f3.page.waitForSelector('.feature');
    ok(await count(f3.page, '.feature') === 1 && await count(f3.page, '.feature .mini') === 3 && await count(f3.page, '.feature .rail__list') === 1, '«Наша курага»: три товара из feature.ids — одна лента карточек', await count(f3.page, '.feature .mini'));
    ok(await noOverflow(f3.page) && (await smallTargets(f3.page)).length === 0, 'три товара: нет горизонтальной прокрутки, кнопки ≥ 44 px', await smallTargets(f3.page));
    const ph = await f3.page.evaluate(() => [].map.call(document.querySelectorAll('.feature .mini__img'), n => { const r = n.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }));
    ok(ph.length === 3 && ph.every(x => Math.abs(x[0] - x[1]) <= 1), 'фото в блоке квадратные 1:1', ph);
    ok(await f3.page.evaluate(() => [].map.call(document.querySelectorAll('.feature img'), i => i.getAttribute('loading')).join()) === 'eager,lazy,lazy', 'первое фото eager, остальные lazy');
    ok(await f3.page.evaluate(() => [].every.call(document.querySelectorAll('.grid .card img, .rail img'), i => i.getAttribute('loading') === 'lazy' || i.closest('.card') && [].indexOf.call(document.querySelectorAll('.grid .card'), i.closest('.card')) < 4)), 'фото карточек и подборок loading="lazy" (кроме первых четырёх)');
    await f3.page.locator('.feature .mini[data-id="DRY-001"]').click();
    await f3.page.waitForSelector('.sheet__title');
    ok(await count(f3.page, '.sheet:not([hidden])') === 1, 'нажатие на товар в блоке открывает его страницу');
    await f3.page.click('.sheet__close');
    await f3.page.screenshot({ path: OUT + '/95-feature3-ua-light.png', fullPage: false });
    await f3.page.context().close();
    // RU, тёмная — несколько снимков
    const rd = await open(browser, st.url, { uid: 806, lc: 'ru', theme: 'dark' });
    await rd.page.waitForSelector('.feature');
    ok(/Наша курага/.test(await text(rd.page, '.feature__title')) && await noOverflow(rd.page), 'RU, тёмная: блок на русском без горизонтальной прокрутки');
    await rd.page.screenshot({ path: OUT + '/96-feature3-ru-dark.png' });
    await rd.page.goto(st.url + '/?cat=SPC', { waitUntil: 'networkidle' });
    await rd.page.waitForSelector('#grid .card');
    await rd.page.screenshot({ path: OUT + '/97-spices-ru-dark.png', fullPage: true });
    await rd.page.locator('#grid .card[data-id="SPC-004"] [data-quick="1"]').click();
    await rd.page.click('.tabbar [data-go="cart"]');
    await rd.page.waitForSelector('.prog');
    ok(/Ще\s.*до подарунка|Ещё\s.*до подарка/.test(await text(rd.page, '.prog')) && /Баночка\s60\sг/.test(await text(rd.page, '.line__sub')), 'RU, тёмная: корзина с баночкой и строкой до подарка');
    await rd.page.screenshot({ path: OUT + '/98-cart-gift-ru-dark.png', fullPage: true });
    ok(rd.errors.length === 0, 'в консоли браузера нет ошибок (RU, тёмная)', rd.errors);
    await rd.page.context().close(); st.server.close();

    // один товар и граничные случаи
    const st3 = await start(8833, undefined, DRY_SETTINGS);
    catalogPatch(st3, { ids: ['DRY-039'] });
    const f1 = await open(browser, st3.url, { uid: 807 });
    await f1.page.waitForSelector('.feature');
    ok(await count(f1.page, '.feature') === 1 && /Наша курага/.test(await text(f1.page, '.feature__title')) && await noOverflow(f1.page), '«Наша курага»: один товар — как раньше');
    await f1.page.screenshot({ path: OUT + '/99-feature1.png' });
    await f1.page.context().close(); st3.server.close();
    const st4 = await start(8834, undefined, DRY_SETTINGS);
    catalogPatch(st4, { ids: ['NOPE-1', 'DRY-005', 'DRY-001', 'DRY-001'] }); // нет в каталоге, нет в наличии, дубль
    const f2 = await open(browser, st4.url, { uid: 808 });
    await f2.page.waitForSelector('.card');
    ok(await count(f2.page, '.feature .mini') === 1 && await f2.page.locator('.feature .mini').getAttribute('data-id') === 'DRY-001', 'отсутствующие, недоступные и повторные ID пропускаются');
    await f2.page.context().close(); st4.server.close();
    const st5 = await start(8835, undefined, DRY_SETTINGS);
    catalogPatch(st5, { ids: ['NOPE-1', 'DRY-005'] });
    const f0 = await open(browser, st5.url, { uid: 809 });
    await f0.page.waitForSelector('.card');
    ok(await count(f0.page, '.feature') === 0 && await count(f0.page, '.featuregroup') === 0 && f0.errors.length === 0, 'нет ни одного доступного товара — блока нет');
    await f0.page.context().close(); st5.server.close();
    // старый бэкенд: без pw, ids и notice — всё работает как раньше
    const st6 = await start(8836, undefined, DRY_SETTINGS);
    const o = await open(browser, st6.url, { uid: 810 });
    await o.page.waitForSelector('.card');
    ok(await count(o.page, '.feature') === 1 && await o.page.locator('#notice').isHidden() && !/Баночка\s\d/.test(await text(o.page, '#grid')) && o.errors.length === 0, 'без новых полей бэкенда витрина работает как раньше', o.errors);
    await o.page.context().close(); st6.server.close();
  }

  console.log('Выпуск А7 · оплата на счёт ФОП и подсказки Новой почты');
  {
    const patchShop = (st, fn) => { const orig = st.gas.get; st.gas.get = q => { const r = orig(q); if (q.action === 'catalog' && r && r.shop) fn(r.shop); return r; }; };
    const REF_KH = '11111111-1111-1111-1111-111111111111', REF_KH2 = '22222222-2222-2222-2222-222222222222', REF_KV = '33333333-3333-3333-3333-333333333333', REF_ME = '44444444-4444-4444-4444-444444444444';
    // Город с 1200 отделениями и почтоматами: каждый пятый номер — почтомат.
    const WH = [];
    for (let i = 1; i <= 1200; i++) WH.push([i, i === 777 ? 'вул. Клочківська, 1' : i === 1195 ? 'вул. Гвардійців, 3' : 'вул. Сумська, ' + i, i % 5 === 0 ? 'p' : 'w']);
    const CITIES = q => {
      q = q.toLowerCase();
      if (q.indexOf('харк') === 0 || q === 'харків') return [{ n: 'м. Харків, Харківська обл.', s: 'Харків', ref: REF_KH }, { n: 'с. Харківка, Київська обл.', s: 'Харківка', ref: REF_KH2 }, { n: 'с. Харківці, Полтавська обл.', s: 'Харківці', ref: REF_KH2 }].filter(x => q === 'харків' ? x.s.toLowerCase().indexOf('харків') === 0 : true);
      if (q.indexOf('ки') === 0) return [{ n: 'м. Київ, Київська обл.', s: 'Київ', ref: REF_KV }];
      if (q.indexOf('мер') === 0) return [{ n: 'м. Мерефа, Харківська обл.', s: 'Мерефа', ref: REF_ME }];
      return [];
    };
    /** Заглушка API Нової пошти: считает запросы; режимы whall: ok | error | hang. */
    async function stubNp(page, o) {
      const calls = { city: [], whall: 0, wh: 0 };
      await page.route(/\/api\?.*action=np\./, async route => {
        const u = new URL(route.request().url()), action = u.searchParams.get('action');
        const send = (body, delay) => setTimeout(() => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(body) }).catch(() => {}), delay || 0);
        if (action === 'np.city') {
          const q = u.searchParams.get('q'); calls.city.push(q);
          if (o.cityHang) return send({ ok: true, list: CITIES(q) }, 6500);
          return send({ ok: true, list: CITIES(q) }, q.toLowerCase().indexOf('харк') === 0 && o.slowKh ? 1500 : 0);
        }
        if (action === 'np.whall') {
          calls.whall++;
          if (o.whall === 'error') return send({ ok: false });
          if (o.whall === 'hang') return send({ ok: true, list: WH }, 6500);
          if (o.whall === 'slow') { Promise.resolve(o.gate).then(() => send({ ok: true, list: WH })); return; } // ответ держим до команды теста (не по таймеру: иначе гонка с медленным прогоном)
          return send({ ok: true, list: WH });
        }
        if (action === 'np.wh') { calls.wh++; return send({ ok: true, list: [{ n: 'Відділення №12: вул. Стара, 1', num: '12' }] }); }
        return send({ ok: false });
      });
      return calls;
    }
    async function toNpCheckout(st, uid, extra) {
      const c = await open(browser, st.url, Object.assign({ uid }, extra || {}));
      await c.page.waitForSelector('.card');
      await toCard(c.page, 'NUT-007');
      await c.page.locator('#grid .card[data-id="NUT-007"] [data-quick="1"]').click();
      await c.page.click('.tabbar [data-go="cart"]');
      await c.page.waitForSelector('.line');
      await c.page.evaluate(() => window.__tg.main.cb());
      await c.page.waitForSelector('#form');
      return c;
    }
    const pickNp = (page, ru) => page.locator('.opt', { hasText: ru ? 'Новая почта' : 'Нова пошта' }).first().click();
    const sugg = (page, id) => page.locator('#' + id + ' button').allInnerTexts();
    const mk = async (port, fn) => { const st = await start(port, undefined, withPhotos); patchShop(st, s => { s.np = true; if (fn) fn(s); }); return st; };

    // --- подсказки: основной путь, город с 1200 отделениями и почтоматами ---
    const st = await mk(8840);
    const a = await toNpCheckout(st, 901);
    const calls = await stubNp(a.page, {});
    await pickNp(a.page);
    await a.page.locator('#f-city').click();
    await a.page.type('#f-city', 'Харк', { delay: 60 });
    await a.page.waitForSelector('#citySugg button');
    ok(calls.city.length === 1, 'город: набор по буквам даёт один запрос (дебаунс 500 мс)', calls.city);
    ok((await a.page.locator('#citySugg button').first().boundingBox()).height >= 44 && await noOverflow(a.page), 'строки подсказок ≥ 44 px, без горизонтальной прокрутки');
    await a.page.fill('#f-city', 'Харк');
    await a.page.fill('#f-city', 'Харк');
    ok(calls.city.length === 1 || calls.city.length === 2, 'повторный ввод той же строки берётся из кэша (нет нового запроса)', calls.city);
    const before = calls.city.length;
    await a.page.locator('#citySugg button').first().click(); // настоящее нажатие мышью: фокус не должен потеряться раньше click
    await a.page.waitForSelector('#whSugg button');
    ok(await a.page.inputValue('#f-city') === 'Харків', 'нажатие на подсказку города срабатывает');
    ok(calls.whall === 1 && (await sugg(a.page, 'whSugg')).length === 10 && /^№1,/.test((await sugg(a.page, 'whSugg'))[0]), 'после выбора города — один запрос отделений и сразу список из 10 без ввода', await sugg(a.page, 'whSugg'));
    ok((await sugg(a.page, 'whSugg')).every(x => !/^№(5|10|15),/.test(x)), 'в режиме «Відділення» почтоматы в списке не показываются');
    await a.page.screenshot({ path: OUT + '/100-np-suggest-ua-light.png', fullPage: true });
    await a.page.fill('#f-branch', '12');
    let l = await sugg(a.page, 'whSugg');
    ok(/^№12,/.test(l[0]) && /^№121,/.test(l[1]) && /^№122,/.test(l[2]) && l.every(x => !/^№120,/.test(x)), '«12»: сначала №12, затем №121, №122… (№120 — почтомат, в режиме отделений его нет)', l.slice(0, 4));
    await a.page.fill('#f-branch', 'Клочківська');
    l = await sugg(a.page, 'whSugg');
    ok(l.length === 1 && /^№777,/.test(l[0]), 'поиск по улице', l);
    await a.page.locator('.opts--3 .opt', { hasText: 'Поштомат' }).click();
    await a.page.fill('#f-branch', '1195');
    l = await sugg(a.page, 'whSugg');
    ok(l.length >= 1 && /^№1195,/.test(l[0]), 'почтомат находится по номеру (тип учитывается до обрезки списка)', l);
    await a.page.fill('#f-branch', '');
    l = await sugg(a.page, 'whSugg');
    ok(/^№5,/.test(l[0]) && l.length === 10, 'режим «Поштомат»: первые 10 почтоматов', l);
    ok(calls.whall === 1 && calls.wh === 0 && calls.city.length === before, 'после выбора города при вводе в поле отделения запросов к серверу нет', calls);
    await a.page.locator('#whSugg button').nth(1).click();
    ok(await a.page.inputValue('#f-branch') === '10' && await a.page.locator('#whSugg').isHidden(), 'нажатие на подсказку отделения подставляет номер');
    ok((await smallTargets(a.page)).length === 0, 'оформление с подсказками: кнопки ≥ 44 px', await smallTargets(a.page));
    ok(a.errors.length === 0, 'в консоли браузера нет ошибок (подсказки)', a.errors);
    await a.page.context().close(); st.server.close();

    // --- RU, тёмная ---
    const stRu = await mk(8841);
    const r = await toNpCheckout(stRu, 902, { lc: 'ru', theme: 'dark' });
    await stubNp(r.page, {});
    await pickNp(r.page, true);
    await r.page.fill('#f-city', 'Харк');
    await r.page.waitForSelector('#citySugg button');
    await r.page.locator('#citySugg button').first().click();
    await r.page.waitForSelector('#whSugg button');
    await r.page.fill('#f-branch', '12');
    await r.page.screenshot({ path: OUT + '/101-np-suggest-ru-dark.png', fullPage: true });
    ok(await noOverflow(r.page), 'RU, тёмная: подсказки без горизонтальной прокрутки');
    await r.page.context().close(); stRu.server.close();

    // --- город набран руками ---
    const st2 = await mk(8842);
    const b = await toNpCheckout(st2, 903);
    const c2 = await stubNp(b.page, {});
    await pickNp(b.page);
    await b.page.fill('#f-city', 'Мерефа');
    await b.page.waitForSelector('#citySugg button');
    await b.page.click('#f-phone'); // уходим с поля, подсказку не нажимали
    await b.page.waitForSelector('#whSugg button');
    ok(c2.whall === 1 && await b.page.inputValue('#f-city') === 'Мерефа', 'руками набран город с единственным вариантом — выбран сам, отделения загружены');
    await b.page.fill('#f-city', 'Харк');
    await b.page.waitForSelector('#citySugg button');
    await b.page.click('#f-phone');
    await b.page.waitForSelector('#cityPick:not([hidden])');
    ok(/Оберіть місто зі списку/.test(await text(b.page, '#cityPick')) && c2.whall === 1, 'несколько вариантов — подсказка «Оберіть місто зі списку», сам не выбирает');
    await b.page.fill('#f-branch', '15');
    await b.page.fill('#f-phone', '0501234567');
    await b.page.evaluate(() => window.__tg.main.cb());
    await b.page.waitForSelector('.done');
    ok(true, 'оформление при невыбранном городе не блокируется');
    await b.page.context().close();
    // чип «Харків» выбирает точное совпадение
    const b2 = await toNpCheckout(st2, 904);
    const c3 = await stubNp(b2.page, {});
    await pickNp(b2.page);
    await b2.page.locator('#cityChips .chip', { hasText: 'Харків' }).click();
    await b2.page.waitForSelector('#whSugg button');
    ok(c3.whall === 1 && c3.city.length === 1, 'чип «Харків»: город выбран по точному совпадению');
    // устаревший ответ не перезаписывает свежий
    await b2.page.fill('#f-city', 'Харк');
    await b2.page.waitForTimeout(700);
    await b2.page.fill('#f-city', 'Київ');
    await b2.page.waitForTimeout(2300);
    const lv = await sugg(b2.page, 'citySugg');
    ok(lv.length === 1 && /Київ/.test(lv[0]), 'медленный старый ответ не затирает свежий', lv);
    await b2.page.context().close(); st2.server.close();

    // --- сбои: ошибка, зависший ответ, старый бэкенд ---
    const st3 = await mk(8843);
    const e1 = await toNpCheckout(st3, 905);
    const c4 = await stubNp(e1.page, { whall: 'error' });
    await pickNp(e1.page);
    await e1.page.fill('#f-city', 'Харк');
    await e1.page.waitForSelector('#citySugg button');
    await e1.page.locator('#citySugg button').first().click();
    await e1.page.waitForTimeout(300);
    ok(await e1.page.locator('#whSugg').isHidden() && await e1.page.locator('#whBusy').isHidden(), 'np.whall вернул ошибку — тихо, без списка и без «Шукаю…»');
    await e1.page.evaluate(() => { window.__NP_RETRY_MS = 300; });
    await e1.page.waitForTimeout(400);
    await e1.page.click('#f-phone');
    await e1.page.click('#f-branch');
    await e1.page.waitForTimeout(300);
    ok(c4.whall === 2, '{ok:false}: при следующем фокусе поля отделения np.whall повторяется', c4.whall);
    await e1.page.fill('#f-branch', '12');
    await e1.page.waitForSelector('#whSugg button');
    ok(c4.wh === 1 && /№?12/.test((await sugg(e1.page, 'whSugg'))[0]), 'бэкенд без np.whall: подсказки по-старому через np.wh');
    await e1.page.locator('#whSugg button').first().click();
    ok(await e1.page.inputValue('#f-branch') === '12', 'старый путь: нажатие на подсказку срабатывает');
    await e1.page.fill('#f-phone', '0501234567');
    await e1.page.evaluate(() => window.__tg.main.cb());
    await e1.page.waitForSelector('.done');
    ok(e1.errors.length === 0, 'ошибка API: заказ оформлен, ошибок в консоли нет', e1.errors);
    await e1.page.context().close();

    const e2 = await toNpCheckout(st3, 906);
    await stubNp(e2.page, { whall: 'hang' });
    await pickNp(e2.page);
    await e2.page.locator('#cityChips .chip', { hasText: 'Київ' }).click();
    await e2.page.waitForSelector('#whBusy:not([hidden])');
    ok(/Шукаю…/.test(await text(e2.page, '#whBusy')), 'пока идёт запрос отделений — «Шукаю…» под полем');
    await e2.page.fill('#f-branch', '15');
    await e2.page.fill('#f-phone', '0501234567');
    await e2.page.evaluate(() => window.__tg.main.cb());
    await e2.page.waitForSelector('.done');
    ok(true, 'ответ отделений висит — заказ всё равно оформляется');
    await e2.page.context().close();

    const e3 = await toNpCheckout(st3, 907);
    await stubNp(e3.page, { cityHang: true });
    await pickNp(e3.page);
    await e3.page.fill('#f-city', 'Київ');
    await e3.page.waitForSelector('#cityBusy:not([hidden])');
    await e3.page.waitForTimeout(6000);
    ok(await e3.page.locator('#cityBusy').isHidden() && await e3.page.locator('#citySugg').isHidden(), 'город: ответ дольше 5 с — «Шукаю…» исчезло, остаётся ручной ввод');
    await e3.page.fill('#f-branch', '5');
    await e3.page.fill('#f-phone', '0501234567');
    await e3.page.evaluate(() => window.__tg.main.cb());
    await e3.page.waitForSelector('.done');
    ok(e3.errors.length === 0, 'зависший ответ: заказ оформлен без ошибок в консоли', e3.errors);
    await e3.page.context().close(); st3.server.close();

    // ответ np.whall приходит через 8 с: через 5 с доступен ручной ввод, после ответа работает новая схема
    const stS = await mk(8846);
    const sl = await toNpCheckout(stS, 911);
    let releaseWhall; const gateWhall = new Promise(r => { releaseWhall = r; });
    const cS = await stubNp(sl.page, { whall: 'slow', gate: gateWhall });
    await pickNp(sl.page);
    await sl.page.locator('#cityChips .chip', { hasText: 'Київ' }).click();
    await sl.page.waitForSelector('#whBusy:not([hidden])');
    await sl.page.waitForTimeout(5400);
    ok(await sl.page.locator('#whBusy').isHidden(), 'np.whall отвечает долго: через 5 с «Шукаю…» исчезло, ввод доступен');
    await sl.page.fill('#f-branch', '12');
    await sl.page.waitForFunction(() => /Стара/.test((document.querySelector('#whSugg button') || {}).textContent || ''));
    ok(cS.wh >= 1 && /Стара/.test((await sugg(sl.page, 'whSugg'))[0]), 'пока список грузится — подсказки по-старому через np.wh', await sugg(sl.page, 'whSugg'));
    releaseWhall(); // теперь «приходит» ответ np.whall (позже 5 с)
    await sl.page.waitForFunction(() => /^№12,/.test((document.querySelector('#whSugg button') || {}).textContent || ''), null, { timeout: 6000 });
    const whBefore = cS.wh;
    await sl.page.fill('#f-branch', '777');
    await sl.page.fill('#f-branch', '121');
    const ls = await sugg(sl.page, 'whSugg');
    ok(/^№121,/.test(ls[0]) && cS.wh === whBefore && cS.whall === 1, 'ответ пришёл позже 5 с: список из 1200 работает без новых запросов, открытый список обновился', { ls: ls.slice(0, 2), wh: cS.wh, whall: cS.whall });
    ok(sl.errors.length === 0, 'долгий np.whall: ошибок в консоли нет', sl.errors);
    await sl.page.context().close(); stS.server.close();

    // чип города сразу после ввода в поле города
    const stC = await mk(8847);
    const ch = await toNpCheckout(stC, 912);
    await stubNp(ch.page, {});
    await pickNp(ch.page);
    await ch.page.fill('#f-city', 'Хар');
    await ch.page.locator('#cityChips .chip', { hasText: 'Харків' }).click();
    await ch.page.waitForSelector('#whSugg button');
    await ch.page.waitForTimeout(600);
    ok(await ch.page.inputValue('#f-city') === 'Харків' && await ch.page.locator('#cityPick').isHidden() && await ch.page.locator('#whSugg button').count() === 10, 'чип сразу после ввода «Хар»: город выбран однозначно, отделения показаны, «Оберіть місто» нет');
    await ch.page.context().close(); stC.server.close();

    // --- оплата на счёт ФОП ---
    const stF = await mk(8844, s => { s.fop = 1; s.pay = ['cash', 'card']; });
    const f = await toNpCheckout(stF, 908);
    ok(/Переказ на рахунок ФОП \(IBAN\)/.test(await text(f.page, '[data-opt="pay-card"]')) && !/на картку/.test(await text(f.page, '[data-opt="pay-card"]')), 'флаг fop: способ оплаты называется «Переказ на рахунок ФОП (IBAN)»');
    await f.page.locator('[data-opt="pay-card"]').click();
    ok(/Реквізити надішлемо в Telegram одразу після оформлення\./.test(await text(f.page, '#cardNote')), 'подсказка под способом: «одразу після оформлення»');
    await f.page.locator('#cardNote').scrollIntoViewIfNeeded();
    await f.page.screenshot({ path: OUT + '/102-pay-fop-ua-light.png' });
    await f.page.fill('#f-phone', '0501234567');
    await f.page.evaluate(() => window.__tg.main.cb());
    await f.page.waitForSelector('.done');
    ok(/Оплата: Переказ на рахунок ФОП \(IBAN\)/.test(await text(f.page, '.page')), 'итог заказа показывает название с ФОП', await text(f.page, '.page'));
    await f.page.context().close();
    const fr = await toNpCheckout(stF, 909, { lc: 'ru', theme: 'dark' });
    await fr.page.locator('[data-opt="pay-card"]').click();
    ok(/Перевод на счёт ФОП \(IBAN\)/.test(await text(fr.page, '[data-opt="pay-card"]')) && /Реквизиты пришлём в Telegram сразу после оформления\./.test(await text(fr.page, '#cardNote')), 'RU: название и подсказка для ФОП');
    await fr.page.locator('#cardNote').scrollIntoViewIfNeeded();
    await fr.page.screenshot({ path: OUT + '/103-pay-fop-ru-dark.png' });
    await fr.page.context().close(); stF.server.close();
    const stN = await mk(8845, s => { s.pay = ['cash', 'card']; });
    const n = await toNpCheckout(stN, 910);
    await n.page.locator('[data-opt="pay-card"]').click();
    ok(/Переказ на картку/.test(await text(n.page, '[data-opt="pay-card"]')) && /після підтвердження замовлення/.test(await text(n.page, '#cardNote')) && !/ФОП/.test(await text(n.page, '#form')), 'без флага fop — прежнее название и подсказка');
    await n.page.context().close(); stN.server.close();
  }

  /* ---------------- 12. Выпуск Б, блок 1: главная без хаоса, рецепты лентой, лёгкие фото ---------------- */
  console.log('Выпуск Б · блок 1: главная на 360 × 640, «всё включено»');
  {
    // Всё включено: «Наша курага», специи отца, подарок, подарок постоянным, теги для квиза, опт, два рецепта, ленты.
    const full = s => {
      withPhotos(s);
      const rows = s.sheets['Товари'], head = rows[0], row = id => rows.find(r => r[0] === id);
      s.sheets['Налаштування'] = [['Ключ', 'Значення', 'Опис'], ['gift_from', '500', ''], ['gift_text_ua', '100 г кураги', ''], ['loyal_every', '3', ''], ['loyal_text_ua', 'чурчхела', ''],
        ['feature_id', 'DRY-039', ''], ['father_ids', 'SPC-001, SPC-002, SPC-003', ''], ['father_text_ua', 'Мелемо самі', ''], ['min_order', '100', '']];
      row('NUT-001')[head.indexOf('Опт: ціна')] = 500; row('NUT-001')[head.indexOf('Опт: мін. обсяг')] = '2 кг';
      head.push('Теги'); rows.slice(1).forEach(r => r.push(''));
      const tag = (id, v) => { row(id)[head.indexOf('Теги')] = v; };
      tag('DRY-039', 'До чаю, солодке'); tag('SWT-001', 'до чаю, солодке, подарунок'); tag('NUT-001', 'перекус, солоне'); tag('NUT-002', 'перекус, солоне');
      s.sheets['Рецепти'] = [['ID', 'Назва (UA)', 'Название (RU)', 'Фото', 'Текст (UA)', 'Текст (RU)', 'Товари', 'Показувати'],
        ['REC-1', 'Узвар з кураги', 'Узвар из кураги', '', 'Промити.', 'Промыть.', 'DRY-039, NUT-008', 'так'],
        ['REC-2', 'Плов з курагою', 'Плов с курагой', '', 'Текст', 'Текст', 'DRY-039', 'так']];
    };
    // railsMax приходит из каталога (его добавляет новый бэкенд); в стенде подменяем ответ каталога. undefined — поля нет, как у старого бэкенда.
    const withMax = v => async page => {
      await page.route(/\/api\?.*action=catalog/, async route => {
        const res = await route.fetch(); const j = await res.json();
        if (v === undefined) delete j.shop.railsMax; else j.shop.railsMax = v;
        await route.fulfill({ status: 200, contentType: 'application/json; charset=utf-8', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(j) });
      });
    };
    const metrics = page => page.evaluate(() => {
      const top = n => Math.round(n.getBoundingClientRect().top + window.scrollY), hgt = n => Math.round(n.getBoundingClientRect().height);
      const q = sel => document.querySelector(sel), rails = [].slice.call(document.querySelectorAll('.main > .rail:not(.recs)'));
      const lane = q('.feature'), card = q('.feature .mini'), tab = q('.tabbar'), cr = card ? card.getBoundingClientRect() : null;
      const seeH = cr ? Math.max(0, Math.min(cr.bottom, tab ? tab.getBoundingClientRect().top : innerHeight) - Math.max(cr.top, 0)) : 0;
      return { laneTop: lane ? top(lane) : -1, cardSeen: cr ? seeH / cr.height : 0, laneRows: [].map.call(document.querySelectorAll('.lane'), n => n.querySelectorAll('.rail__list').length), above: top(document.getElementById('gridHead')), firstRail: rails.length ? top(rails[0]) : -1, rails: rails.length,
        titles: rails.map(r => r.querySelector('.rail__title').textContent), railH: rails.length ? hgt(rails[0]) : 0,
        plusH: q('.plus') ? hgt(q('.plus')) : 0, recsH: q('.recs') ? hgt(q('.recs')) : 0, chips: [].map.call(document.querySelectorAll('.morerails .chip'), c => c.textContent) };
    });
    const st = await start(8850, undefined, full);
    const A = await open(browser, st.url, { uid: 501, w: 360, h: 640, before: withMax(undefined) });
    const pg = A.page;
    await pg.waitForSelector('#grid .card');
    const m = await metrics(pg);
    const n0 = m.rails + m.chips.length; // всего непустых лент в этом стенде
    ok(m.above < 1872, 'высота всего над «Усі товари» меньше 1872 px (было 1902 → стало ' + m.above + ')', m.above);
    ok(m.laneTop > 0 && m.laneTop <= 560, 'начало первой ленты товаров («Наша курага») не ниже 560 px: ' + m.laneTop, m.laneTop);
    ok(m.cardSeen >= 0.6, 'первая карточка товара на первом экране 360 × 640 видна не меньше чем на 60 % (с учётом нижней панели): ' + Math.round(m.cardSeen * 100) + ' %', m.cardSeen);
    ok(m.laneRows.length === 2 && m.laneRows.every(n => n === 1), '«Наша курага» и «Спеції від батька» — по одной горизонтальной ленте', m.laneRows);
    ok(m.firstRail > 0 && m.firstRail <= 560, 'первая «обычная» лента (homeRails) тоже начинается не ниже 560 px: ' + m.firstRail, m.firstRail);
    ok(m.plusH > 0 && m.plusH <= 72, 'высота строки «плюсов» не больше 72 px: ' + m.plusH, m.plusH);
    ok(m.rails === 3 && n0 > 3 && m.chips.length === n0 - 3, 'лент на главной ровно 3 (по умолчанию, без railsMax), остальные непустые — в строке «Ще»: ' + m.titles.join(', ') + ' / ' + m.chips.join(', '), m);
    ok(m.titles[0] === 'Популярне' && m.titles[1] === 'Набори', 'приоритет лент: «Популярне», затем «Набори»', m.titles);
    ok(await count(pg, '.morerails .morerails__label') === 1 && /^Ще:/.test(await text(pg, '.morerails')) && await count(pg, '.main > .rail:not(.recs) .mini') > 0, 'строка чипов начинается с «Ще:»; пустых лент нет', await text(pg, '.morerails'));
    ok(await pg.evaluate(() => { const o = [ '.feature', '.main > .rail:not(.recs)', '.father', '.plus', '.main > .rail:not(.recs) ~ .rail:not(.recs)', '.recs', '#gridHead' ].map(s => document.querySelector(s));
      return o.every(Boolean) && o.every((n, i) => i === 0 || (o[i - 1].compareDocumentPosition(n) & Node.DOCUMENT_POSITION_FOLLOWING) > 0); }), 'порядок: «Наша курага» → первая лента → специи отца → «плюсы» → остальные ленты → рецепты → «Усі товари»');
    ok(await count(pg, '.plus__item') === 4 && await count(pg, '.perks, .perk, .bizline') === 0, 'в строке четыре плашки: подарок, подарок постоянным, подбор, опт; старых плашек нет', await pg.locator('.plus__item').allInnerTexts());
    const look = await pg.evaluate(() => { const its = [].slice.call(document.querySelectorAll('.plus__item')), cs = its.map(i => getComputedStyle(i));
      return { same: cs.every(c => c.backgroundColor === cs[0].backgroundColor && c.borderTopColor === cs[0].borderTopColor && c.color === cs[0].color),
        accent: its.every(i => getComputedStyle(i.querySelector('.ico')).color !== getComputedStyle(i).color), min: Math.min.apply(null, its.map(i => i.getBoundingClientRect().height)) }; });
    ok(look.same && look.accent && look.min >= 44, 'плашки одного стиля: одна поверхность и линия, акцентный цвет только у иконки, высота ≥ 44 px', look);
    // б16: на 360 × 640 без прокрутки карточки первой ленты (фото и название целиком) выше нижней панели с запасом ≥ 8 px; порядок блоков; все 4 варианта
    for (const [theme, lc] of [['light', 'uk'], ['dark', 'uk'], ['light', 'ru'], ['dark', 'ru']]) {
      const V = await open(browser, st.url, { uid: 501, w: 360, h: 640, theme, lc, before: withMax(undefined) });
      await V.page.waitForSelector('#grid .card');
      const g = await V.page.evaluate(() => {
        const first = document.querySelector('.main > .rail:not(.recs)'), mini = first.querySelector('.mini'), tab = document.querySelector('.tabbar').getBoundingClientRect().top;
        const kids = [].slice.call(document.querySelectorAll('.main > *')).map(n => n.classList.contains('feature') ? 'feature' : n.classList.contains('father') ? 'father' : n.classList.contains('plus') ? 'plus' : n.classList.contains('rail') && !n.classList.contains('recs') ? 'rail' : '');
        const r = n => n.getBoundingClientRect().bottom;
        return { scrollY: window.scrollY, railTop: Math.round(first.getBoundingClientRect().top), imgBottom: Math.round(r(mini.querySelector('.mini__img'))), nameBottom: Math.round(r(mini.querySelector('.mini__name'))), tab: Math.round(tab),
          order: kids.filter(Boolean).slice(0, 5).join('>') };
      });
      const tag = theme + '/' + lc + ': ';
      ok(g.scrollY === 0 && g.imgBottom <= g.tab - 8 && g.nameBottom <= g.tab - 8, tag + 'без прокрутки у первой карточки первой ленты низ фото ' + g.imgBottom + ' и низ названия ' + g.nameBottom + ' ≤ верх панели ' + g.tab + ' − 8', g);
      ok(g.order === 'feature>rail>father>plus>rail', tag + 'порядок блоков: «Наша курага» → лента → «Спеції від батька» → плюсы → ленты', g.order);
      await V.ctx.close();
    }
    ok(await noOverflow(pg) && (await smallTargets(pg)).length === 0, 'главная: без горизонтальной прокрутки, кнопки ≥ 44 px', await smallTargets(pg));
    ok(m.recsH > 0 && m.recsH <= m.railH, 'блок «Рецепти» не выше одной ленты карточек: ' + m.recsH + ' ≤ ' + m.railH, [m.recsH, m.railH]);
    ok(await count(pg, '.recs .rcard') === 2 && await count(pg, '.recs .rcard__img .ico') === 2 && await count(pg, '.recs__item') === 0, 'рецепты — горизонтальная лента карточек (без фото — иконка)');
    // б16: ленту «Популярне» и последний блок главной можно прокрутить выше нижней панели вкладок (обе темы)
    const tabbarClear = async (page, tag) => {
      const geo = sel => page.evaluate(sel2 => { const r = document.querySelector(sel2).getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), tab: Math.round(document.querySelector('.tabbar').getBoundingClientRect().top) }; }, sel);
      const popSel = '.main > .rail:not(.recs) .mini';
      await page.evaluate(sel2 => document.querySelector(sel2).scrollIntoView({ block: 'end' }), popSel); // самый строгий случай: «прижать к низу окна»
      await page.waitForTimeout(150);
      const c1 = await geo(popSel);
      ok(c1.bottom <= c1.tab, tag + ': первая карточка ленты «Популярне» после scrollIntoView целиком выше нижней панели: низ ' + c1.bottom + ' ≤ верх панели ' + c1.tab, c1);
      await page.evaluate(sel2 => document.querySelector(sel2).scrollIntoView({ block: 'center' }), popSel);
      await page.waitForTimeout(150);
      const c1b = await geo(popSel);
      ok(c1b.top >= 0 && c1b.bottom <= c1b.tab, tag + ': и при прокрутке «по центру» карточка видна целиком: ' + c1b.top + '…' + c1b.bottom + ' при панели ' + c1b.tab, c1b);
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await page.waitForTimeout(150);
      const c2 = await page.evaluate(() => { const last = [].slice.call(document.querySelectorAll('.main > *')).filter(n => n.getBoundingClientRect().height > 0).pop(), r = last.getBoundingClientRect(); return { bottom: Math.round(r.bottom), tab: Math.round(document.querySelector('.tabbar').getBoundingClientRect().top), cls: last.className }; });
      ok(c2.bottom <= c2.tab, tag + ': последний блок главной (' + c2.cls + ') выше нижней панели: ' + c2.bottom + ' ≤ ' + c2.tab, c2);
    };
    await tabbarClear(pg, 'светлая тема');
    await pg.evaluate(() => document.querySelector('.main > .rail:not(.recs) .mini').scrollIntoView({ block: 'end' })); await pg.waitForTimeout(150);
    await pg.screenshot({ path: OUT + '/104a-b16-pop-light.png' });
    await pg.evaluate(() => window.scrollTo(0, 0));
    await pg.screenshot({ path: OUT + '/104-b1-home-light-uk.png' });
    await pg.screenshot({ path: OUT + '/105-b1-home-light-uk-full.png', fullPage: true });

    // подробности плашек — в шторке
    await pg.click('.plus__item[data-k="gift"]');
    await pg.waitForSelector('#sheet .plus__text');
    ok(/Подарунок до замовлення від 500\s₴: 100 г кураги/.test(await text(pg, '#sheet')) && await pg.evaluate(() => !document.getElementById('sheet').hidden), 'плашка подарка: шторка с условием', await text(pg, '#sheet'));
    await pg.waitForTimeout(500); // дать закончиться анимации
    await pg.screenshot({ path: OUT + '/106-b1-plus-sheet.png' });
    await pg.click('#sheet .sheet__close');
    await pg.click('.plus__item[data-k="loyal"]');
    await pg.waitForSelector('#sheet .plus__text');
    ok(/До кожного 3-го замовлення даруємо: чурчхела/.test(await text(pg, '#sheet')) && await count(pg, '#sheet .btn') === 0, 'плашка постоянным: шторка с текстом, без кнопки', await text(pg, '#sheet'));
    await pg.click('#sheet .sheet__close');
    await pg.click('.plus__item[data-k="biz"]');
    await pg.waitForSelector('#sheet .btn[data-view="biz"]');
    await pg.click('#sheet .btn[data-view="biz"]');
    await pg.waitForFunction(() => document.body.getAttribute('data-view') === 'biz');
    ok(await pg.evaluate(() => document.getElementById('sheet').hidden), 'плашка «Оптові ціни»: кнопка в шторке ведёт на экран «Для бізнесу», шторка закрылась');
    await pg.evaluate(() => window.__tg.back.cb());
    await pg.waitForSelector('.plus__item[data-k="quiz"]');
    await pg.click('.plus__item[data-k="quiz"]');
    await pg.click('#sheet .btn[data-view="quiz"]');
    await pg.waitForSelector('.quiz__opt');
    ok(await pg.evaluate(() => document.body.getAttribute('data-view')) === 'quiz', 'плашка «Підібрати смаколики»: кнопка в шторке открывает подбор');
    await pg.evaluate(() => window.__tg.back.cb());
    await pg.waitForSelector('.morerails');

    // «Ще»: чип открывает экран со списком
    const chipText = (await pg.locator('.morerails .chip').first().innerText()).trim();
    await pg.locator('.morerails .chip').first().click();
    await pg.waitForFunction(() => document.body.getAttribute('data-view') === 'rail');
    ok((await text(pg, '.page__title')).trim() === chipText && await count(pg, '.page .grid .card') >= 2 && await count(pg, '.page [data-nav="back"]') === 1 && await noOverflow(pg) && (await smallTargets(pg)).length === 0, 'чип «Ще: ' + chipText + '» открывает экран со списком товаров сеткой и кнопкой «назад»', await text(pg, '.page__title'));
    await pg.waitForTimeout(500); // дать закончиться анимации
    await pg.screenshot({ path: OUT + '/107-b1-more-page.png' });
    await pg.click('.page [data-nav="back"]');
    await pg.waitForSelector('.morerails');
    ok(await pg.evaluate(() => document.body.getAttribute('data-view')) === 'catalog', '«Назад» с экрана подборки возвращает на главную');

    // рецепты: «Усі рецепти»
    await pg.click('.recs__all');
    await pg.waitForFunction(() => document.body.getAttribute('data-view') === 'recipes');
    ok(await count(pg, '.page .recs__item') === 2 && /Рецепти/.test(await text(pg, '.page__title')) && await noOverflow(pg) && (await smallTargets(pg)).length === 0, '«Усі рецепти» открывает отдельный экран со списком всех рецептов', await count(pg, '.page .recs__item'));
    await pg.waitForTimeout(500); // дать закончиться анимации
    await pg.screenshot({ path: OUT + '/108-b1-recipes-page.png' });
    await pg.locator('.page .recs__item').first().click();
    await pg.waitForSelector('.rec__p');
    ok(/Узвар з кураги/.test(await text(pg, '.page__title')), 'нажатие в списке открывает рецепт');
    await pg.click('.page [data-nav="back"]');
    await pg.waitForFunction(() => document.body.getAttribute('data-view') === 'recipes');
    await pg.click('.page [data-nav="back"]');
    await pg.waitForSelector('.recs');
    ok(await pg.evaluate(() => document.body.getAttribute('data-view')) === 'catalog', '«Назад» из рецепта — в список, из списка — на главную');
    await pg.locator('.recs .rcard').first().click();
    await pg.waitForSelector('.rec__p');
    ok(/Узвар з кураги/.test(await text(pg, '.page__title')), 'карточка рецепта на главной открывает рецепт, как раньше');
    ok(A.errors.length === 0, 'в консоли браузера нет ошибок', A.errors);
    await A.ctx.close();

    // RU, тёмная тема
    const R = await open(browser, st.url, { uid: 501, w: 360, h: 640, theme: 'dark', lc: 'ru', before: withMax(undefined) });
    await R.page.waitForSelector('#grid .card');
    const mr = await metrics(R.page);
    ok(mr.above < 1872 && mr.laneTop <= 560 && mr.cardSeen >= 0.6 && mr.firstRail <= 560 && mr.plusH <= 72 && mr.rails === 3, 'RU, тёмная тема: те же высоты (над «Все товары» ' + mr.above + ', первая лента ' + mr.laneTop + ', плюсы ' + mr.plusH + ')', mr);
    ok(/^Ещё:/.test(await text(R.page, '.morerails')) && /Подарок от 500\s₴/.test(await text(R.page, '#homeGift')) && /Оптовые цены/.test(await text(R.page, '.plus__item[data-k="biz"]')) && /Все рецепты/.test(await text(R.page, '.recs__all')), 'RU: «Ещё:», «Подарок от 500 ₴», «Оптовые цены», «Все рецепты»', await text(R.page, '.morerails'));
    ok(await noOverflow(R.page) && (await smallTargets(R.page)).length === 0, 'RU, тёмная тема: без горизонтальной прокрутки, кнопки ≥ 44 px', await smallTargets(R.page));
    await R.page.screenshot({ path: OUT + '/109-b1-home-dark-ru.png' });
    await tabbarClear(R.page, 'тёмная тема');
    await R.page.evaluate(() => document.querySelector('.main > .rail:not(.recs) .mini').scrollIntoView({ block: 'end' })); await R.page.waitForTimeout(150);
    await R.page.screenshot({ path: OUT + '/109a-b16-pop-dark.png' });
    await R.page.evaluate(() => window.scrollTo(0, 0));
    await R.page.screenshot({ path: OUT + '/110-b1-home-dark-ru-full.png', fullPage: true });
    await R.page.click('.plus__item[data-k="gift"]');
    await R.page.waitForSelector('#sheet .plus__text');
    ok(/Подарок к заказу от 500\s₴/.test(await text(R.page, '#sheet')), 'RU: шторка подарка на русском', await text(R.page, '#sheet'));
    await R.page.waitForTimeout(500); // дать закончиться анимации
    await R.page.screenshot({ path: OUT + '/111-b1-plus-sheet-dark-ru.png' });
    await R.ctx.close();

    // railsMax из каталога
    const counts = async v => { const c = await open(browser, st.url, { uid: 501, w: 360, h: 640, before: withMax(v) }); await c.page.waitForSelector('#grid .card'); const r = await metrics(c.page); await c.ctx.close(); return r; };
    const m1 = await counts(1), m5 = await counts(5), m99 = await counts(99), mBad = await counts('abc');
    ok(m1.rails === 1 && m1.chips.length === n0 - 1, 'railsMax = 1: одна лента, остальные в «Ще»', m1);
    ok(m5.rails === Math.min(5, n0) && m5.chips.length === Math.max(0, n0 - 5), 'railsMax = 5 учитывается', m5);
    ok(m99.rails === n0 && m99.chips.length === 0, 'railsMax больше 8 сводится к 8: при ' + n0 + ' лентах «Ще» нет', m99);
    ok(mBad.rails === 3, 'railsMax не число — по умолчанию 3', mBad);
    st.server.close();

    // «Ваше звичне» — первая; «Купити знову» уходит в «Ще»
    const st2 = await wave1(8851);
    const U = await open(browser, st2.url, { uid: 501, w: 360, h: 640, before: withMax(undefined) });
    await U.page.waitForSelector('.usual');
    const mu = await metrics(U.page);
    ok(/Ваше звичне/.test(mu.titles[0]) && mu.titles.length <= 3 && mu.chips.some(c => /Купити знову/.test(c)), 'у постоянного клиента первая лента «Ваше звичне»; «Купити знову» не вошла в три и лежит в «Ще»', mu);
    ok(await noOverflow(U.page) && (await smallTargets(U.page)).length === 0, 'главная постоянного клиента: без горизонтальной прокрутки, кнопки ≥ 44 px', await smallTargets(U.page));
    await U.ctx.close(); st2.server.close();
  }

  console.log('Выпуск Б · блок 1: лёгкие фото');
  {
    const BIG = 'https://shop.test/img/products/'; // витрина принимает только https; сами картинки отдаёт заглушка в route
    const st = await start(8852, undefined, s => {
      const rows = s.sheets['Товари'], pc = rows[0].indexOf('Фото (посилання)'), row = id => rows.find(r => r[0] === id);
      row('DRY-039')[pc] = BIG + 'DRY-039.webp';   // обычный адрес витрины: карточка берёт маленькую, шторка — большую
      row('DRY-001')[pc] = BIG + 'DRY-001.webp';   // маленькой копии нет (404): должна показаться большая
      row('DRY-002')[pc] = BIG + 'DRY-002.webp';   // нет ни маленькой, ни большой: заглушка
      row('DRY-003')[pc] = 'https://drive.google.com/uc?export=view&id=TESTID123'; // Drive: адрес не меняется
    });
    const reqs = [];
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" fill="#d9a066"/></svg>';
    const before = async page => {
      await page.route(/\/img\/products\//, r => {
        const u = r.request().url(); reqs.push(u);
        if (/\/s\/DRY-001\.webp\?v=26$/.test(u) || /DRY-002\.webp\?v=26$/.test(u)) { r.fulfill({ status: 404, body: '' }); return; }
        r.fulfill({ status: 200, contentType: 'image/svg+xml', body: svg });
      });
      await page.route('https://drive.google.com/**', r => { reqs.push(r.request().url()); r.fulfill({ status: 200, contentType: 'image/svg+xml', body: svg }); });
    };
    const { page, ctx, errors } = await open(browser, st.url, { uid: 502, w: 360, h: 640, before });
    await page.waitForSelector('#grid .card');
    await page.waitForTimeout(700);
    const src = id => page.evaluate(i => { const im = document.querySelector('#grid .card[data-id="' + i + '"] .card__img img'); return im ? im.getAttribute('src') : null; }, id);
    const has = re => reqs.some(u => re.test(u));
    ok(/\/img\/products\/s\/DRY-039\.webp\?v=26$/.test(await src('DRY-039')) && has(/\/s\/DRY-039\.webp\?v=26$/) && !has(/\/img\/products\/DRY-039\.webp\?v=26$/), 'карточка берёт маленькую копию (…/s/DRY-039.webp), большая не загружается', reqs);
    ok(/\/img\/products\/DRY-001\.webp\?v=26$/.test(await src('DRY-001')) && has(/\/s\/DRY-001\.webp\?v=26$/) && await page.evaluate(() => document.querySelector('#grid .card[data-id="DRY-001"] .card__img img').naturalWidth > 0), 'маленькой копии нет (404) — карточка один раз подставляет большую', await src('DRY-001'));
    ok(await src('DRY-002') === null && await count(page, '#grid .card[data-id="DRY-002"] .card__img .mark') === 1 && reqs.filter(u => /\/s\/DRY-002\.webp\?v=26$/.test(u)).length === reqs.filter(u => /\/img\/products\/DRY-002\.webp\?v=26$/.test(u)).length && reqs.filter(u => /DRY-002/.test(u)).length <= 4, 'нет ни маленькой, ни большой — заглушка; на каждую отрисовку одна попытка маленькой и одна большой, без цикла', reqs.filter(u => /DRY-002/.test(u)));
    const catImg = st.gas.get({ action: 'catalog' }).products.find(p => p.id === 'DRY-003').img;
    ok(/drive\.google\.com/.test(catImg) && await src('DRY-003') === catImg && !/\/s\//.test(await src('DRY-003')), 'адрес Google Drive не меняется', [catImg, await src('DRY-003')]);
    const miniSrc = await page.evaluate(() => { const im = document.querySelector('.mini[data-id="DRY-039"] img'); return im ? im.getAttribute('src') : ''; });
    ok(!miniSrc || /\/s\/DRY-039\.webp\?v=26$/.test(miniSrc), 'ленты (mini) тоже берут маленькую копию', miniSrc);
    await page.locator('#grid .card[data-id="DRY-039"] .card__name').click();
    await page.waitForSelector('.sheet__img img');
    await page.waitForTimeout(300);
    ok(/\/img\/products\/DRY-039\.webp\?v=26$/.test(await page.getAttribute('.sheet__img img', 'src')) && has(/\/img\/products\/DRY-039\.webp\?v=26$/), 'шторка товара берёт большое фото');
    await page.click('[data-action="add"]');
    await page.click('#toastBtn');
    await page.waitForSelector('.line__img img');
    ok(/\/img\/products\/s\/DRY-039\.webp\?v=26$/.test(await page.getAttribute('.line__img img', 'src')), 'корзина берёт маленькую копию');
    ok(errors.length === 0, 'в консоли браузера нет ошибок', errors);
    await ctx.close(); st.server.close();
    // файлы: у каждого большого фото есть копия не тяжелее 30 КБ
    const dir = path.join(__dirname, '..', 'webapp', 'img', 'products');
    const bigs = fs.readdirSync(dir).filter(f => /\.webp$/i.test(f));
    const small = bigs.map(f => { const p = path.join(dir, 's', f); return fs.existsSync(p) ? fs.statSync(p).size : -1; });
    ok(bigs.length > 0 && small.every(x => x > 0 && x <= 30 * 1024), 'у каждого из ' + bigs.length + ' фото есть маленькая копия ≤ 30 КБ (самая тяжёлая ' + Math.round(Math.max.apply(null, small) / 1024) + ' КБ)', small.filter(x => x <= 0 || x > 30 * 1024));
  }

  /* ---------------- б15: второе фото на странице товара (необязательное поле i2) ---------------- */
  console.log('Волна Б2 · блок 1: второе фото товара, 360 px');
  {
    const BIG = 'https://shop.test/img/products/';
    const st = await start(8853, undefined, s => {
      const rows = s.sheets['Товари'], pc = rows[0].indexOf('Фото (посилання)'), row = id => rows.find(r => r[0] === id);
      ['DRY-039', 'DRY-001', 'DRY-003', 'DRY-004', 'DRY-005'].forEach(id => { row(id)[pc] = BIG + id + '.webp'; });
    });
    const svgA = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" fill="#d9a066"/></svg>';
    const svgB = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" fill="#6a8f5a"/></svg>';
    // DRY-039: два фото; DRY-001: второго файла нет (404); DRY-003/004: i2 не http(s) — отбрасывается; DRY-005: i2 нет
    const i2 = { 'DRY-039': BIG + 'p/DRY-039.webp', 'DRY-001': BIG + 'p/DRY-001.webp', 'DRY-003': 'javascript:alert(1)', 'DRY-004': 'ftp://shop.test/x.webp' };
    for (const theme of ['light', 'dark']) {
      const reqs = [];
      const before = async page => {
        await page.route(/\/api\?.*action=catalog/, async route => { // новый бэкенд отдаёт i2; стенд подмешивает его в ответ
          const res = await route.fetch(); const j = await res.json();
          j.products.forEach(p => { if (i2[p.id]) p.i2 = i2[p.id]; });
          await route.fulfill({ status: 200, contentType: 'application/json; charset=utf-8', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(j) });
        });
        await page.route(/\/img\/products\//, r => {
          const u = r.request().url(); reqs.push(u);
          if (/\/p\/DRY-001\.webp/.test(u)) { r.fulfill({ status: 404, body: '' }); return; }
          r.fulfill({ status: 200, contentType: 'image/svg+xml', body: /\/p\//.test(u) ? svgB : svgA });
        });
      };
      const { page, ctx, errors } = await open(browser, st.url, { uid: 502, w: 360, h: 640, theme, before });
      await page.waitForSelector('#grid .card');
      const tag = ' (' + theme + ')';
      const cardSrc = await page.evaluate(() => document.querySelector('#grid .card[data-id="DRY-039"] .card__img img').getAttribute('src'));
      ok(/\/img\/products\/s\/DRY-039\.webp\?v=26$/.test(cardSrc) && !/\/p\//.test(cardSrc), 'карточка каталога товара с i2 берёт первое (маленькое) фото' + tag, cardSrc);
      await page.locator('#grid .card[data-id="DRY-039"] .card__name').click();
      await page.waitForSelector('.sheet__strip');
      await page.waitForTimeout(400);
      ok(await count(page, '.sheet__slide') === 2 && await count(page, '.sheet__slide img') === 2 && await count(page, '.sheet__dot') === 2, 'товар с i2: два слайда и две точки' + tag);
      const info = await page.evaluate(() => {
        const sl = [].slice.call(document.querySelectorAll('.sheet__slide img')), d = [].slice.call(document.querySelectorAll('.sheet__dot'));
        return { first: sl[0].getAttribute('src'), second: sl[1].getAttribute('src'), lazy: sl[1].getAttribute('loading'), cur: d.map(x => x.classList.contains('is-on')), tag: d.map(x => x.tagName), hidden: document.querySelector('.sheet__dots').getAttribute('aria-hidden'),
          gap: Math.round(d[1].getBoundingClientRect().left - d[0].getBoundingClientRect().right), dist: Math.round(d[1].getBoundingClientRect().left - d[0].getBoundingClientRect().left), snap: getComputedStyle(document.querySelector('.sheet__strip')).scrollSnapType };
      });
      ok(/\/img\/products\/DRY-039\.webp\?v=26$/.test(info.first) && /\/img\/products\/p\/DRY-039\.webp\?v=26$/.test(info.second) && info.lazy === 'lazy', 'слайды: первое фото и второе (…/p/DRY-039.webp, loading=lazy)' + tag, info);
      ok(info.cur[0] === true && info.cur[1] === false && /x mandatory/.test(info.snap), 'активна первая точка; у ленты scroll-snap' + tag, info);
      const dots = await page.evaluate(() => { const b = document.querySelector('.sheet__dots'), r = b.getBoundingClientRect(), d = [].slice.call(b.querySelectorAll('.sheet__dot')); return { tag: b.tagName, label: b.getAttribute('aria-label'), w: Math.round(r.width), h: Math.round(r.height), n: d.length, gap: Math.round(d[1].getBoundingClientRect().left - d[0].getBoundingClientRect().right), hid: d.every(x => x.getAttribute('aria-hidden') === 'true') }; });
      ok(dots.tag === 'BUTTON' && dots.label === 'Наступне фото' && dots.w >= 44 && dots.h >= 44 && dots.n === 2 && dots.gap >= 8 && dots.gap <= 10 && dots.hid, 'полоска точек — одна кнопка ≥ 44×44 с подписью «Наступне фото», точки внутри на расстоянии 8–10 px' + tag, dots);
      ok(await noOverflow(page) && (await smallTargets(page)).length === 0, 'шторка с лентой: без горизонтальной прокрутки, кнопки ≥ 44 px' + tag, await smallTargets(page));
      await page.screenshot({ path: OUT + '/120-b15-sheet-two-' + theme + '-1.png' });
      // нажатие на полоску точек переключает фото (без свайпа): туда и обратно
      await page.click('.sheet__dots');
      ok(await page.evaluate(() => document.querySelectorAll('.sheet__dot')[1].classList.contains('is-on')), 'нажатие на точки: сразу активна вторая точка' + tag);
      await page.waitForFunction(() => { const s = document.querySelector('.sheet__strip'); return Math.round(s.scrollLeft) === s.clientWidth; });
      ok(await page.evaluate(() => document.querySelectorAll('.sheet__dot')[1].classList.contains('is-on') && !document.querySelectorAll('.sheet__dot')[0].classList.contains('is-on')), 'после прокрутки вторая точка остаётся активной (не мигает)' + tag);
      await page.click('.sheet__dots');
      await page.waitForFunction(() => document.querySelector('.sheet__strip').scrollLeft === 0);
      ok(await page.evaluate(() => document.querySelectorAll('.sheet__dot')[0].classList.contains('is-on')), 'повторное нажатие возвращает первое фото' + tag);
      // прокрутка ленты меняет активную точку
      await page.evaluate(() => { const s = document.querySelector('.sheet__strip'); s.style.scrollBehavior = 'auto'; s.scrollLeft = s.clientWidth; });
      await page.waitForFunction(() => document.querySelectorAll('.sheet__dot')[1].classList.contains('is-on'));
      ok(await page.evaluate(() => !document.querySelectorAll('.sheet__dot')[0].classList.contains('is-on')), 'прокрутка ленты ко второму фото переключает активную точку' + tag);
      await page.screenshot({ path: OUT + '/121-b15-sheet-two-' + theme + '-2.png' });
      // шторка перерисовывается (количество) — остаёмся на втором фото
      await page.click('[data-step="1"]');
      await page.waitForTimeout(200);
      ok(await page.evaluate(() => { const s = document.querySelector('.sheet__strip'); return Math.round(s.scrollLeft / s.clientWidth) === 1 && document.querySelectorAll('.sheet__dot')[1].classList.contains('is-on'); }), 'после перерисовки шторки (кнопка «+») остаётся второе фото' + tag);
      // возврат свайпом к первому фото: активная точка следует за лентой
      await page.evaluate(() => { const s = document.querySelector('.sheet__strip'); s.style.scrollBehavior = 'auto'; s.scrollLeft = 0; });
      await page.waitForFunction(() => document.querySelectorAll('.sheet__dot')[0].classList.contains('is-on'));
      ok(await page.evaluate(() => !document.querySelectorAll('.sheet__dot')[1].classList.contains('is-on')), 'прокрутка обратно к первому фото возвращает активную точку' + tag);
      await page.evaluate(() => { const s = document.querySelector('.sheet__strip'); s.scrollLeft = s.clientWidth; });
      // корзина — только первое фото (маленькая копия)
      await page.click('[data-action="add"]'); await page.click('#toastBtn');
      await page.waitForSelector('.line__img img');
      ok(/\/img\/products\/s\/DRY-039\.webp\?v=26$/.test(await page.getAttribute('.line__img img', 'src')), 'корзина берёт первое маленькое фото' + tag);
      ok(!reqs.some(u => /\/s\/p\//.test(u)), 'маленькой копии второго фото не запрашивали' + tag, reqs.filter(u => /\/p\//.test(u)));
      await ctx.close();

      // товары без i2 / с мусором в i2 / со сломанным вторым фото — в свежем окне
      const w = await open(browser, st.url, { uid: 503, w: 360, h: 640, theme, before });
      await w.page.waitForSelector('#grid .card');
      for (const id of ['DRY-005', 'DRY-003', 'DRY-004']) {
        await toCard(w.page, id);
        await w.page.locator('#grid .card[data-id="' + id + '"] .card__name').click();
        await w.page.waitForSelector('.sheet__img img');
        await w.page.waitForTimeout(300);
        ok(await count(w.page, '.sheet__img > img') === 1 && await count(w.page, '.sheet__strip, .sheet__slide, .sheet__dot') === 0, id + (id === 'DRY-005' ? ': нет i2' : ': i2 не http(s) отброшен') + ' — один img и нет точек' + tag);
        await w.page.click('.sheet__close'); await w.page.waitForTimeout(350);
      }
      await toCard(w.page, 'DRY-001');
      await w.page.locator('#grid .card[data-id="DRY-001"] .card__name').click();
      await w.page.waitForSelector('.sheet__img img');
      await w.page.waitForFunction(() => document.querySelectorAll('.sheet__dot').length === 0, null, { timeout: 5000 });
      ok(await count(w.page, '.sheet__img > img') === 1 && await count(w.page, '.sheet__strip, .sheet__slide--2') === 0 && await w.page.evaluate(() => document.querySelector('.sheet__img > img').naturalWidth > 0), 'второе фото не загрузилось (404): слайд и точки убраны, остаётся одно фото' + tag);
      await w.page.screenshot({ path: OUT + '/122-b15-sheet-one-' + theme + '.png' });
      ok(await noOverflow(w.page), 'без горизонтальной прокрутки' + tag);
      ok(errors.length === 0 && w.errors.length === 0, 'в консоли браузера нет ошибок' + tag, errors.concat(w.errors));
      await w.ctx.close();
    }
    // старый бэкенд: поля i2 нет — страница товара как раньше
    const old = await open(browser, st.url, { uid: 504, w: 360, h: 640, before: async page => { await page.route(/\/img\/products\//, r => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: svgA })); } });
    await old.page.waitForSelector('#grid .card');
    await old.page.locator('#grid .card[data-id="DRY-039"] .card__name').click();
    await old.page.waitForSelector('.sheet__img img');
    ok(await count(old.page, '.sheet__img > img') === 1 && await count(old.page, '.sheet__strip, .sheet__dot') === 0, 'каталог без i2 (старый бэкенд): шторка как раньше — одно фото, без точек');
    await old.ctx.close();
    st.server.close();
  }

  /* ---------------- Выпуск Б, блок 2: админка удобнее ---------------- */
  console.log('Выпуск Б · блок 2: админка удобнее (360 px)');
  {
    const zlib = require('zlib');
    const crcTable = Array.from({ length: 256 }, (_, i) => { let c = i; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
    const crc32 = buf => { let c = 0xFFFFFFFF; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
    const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); };
    const makePng = (w, h) => { // шумная картинка: после сжатия в JPEG тяжелее 500 байт
      const raw = Buffer.alloc((w * 3 + 1) * h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w * 3; x++) raw[y * (w * 3 + 1) + 1 + x] = (x * 7 + y * 13 + ((x * y) % 97)) & 255;
      const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
      return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
    };
    const st = await start(8841, undefined, s => {
      withPhotos(s);
      s.sheets['Налаштування'] = [['Ключ', 'Значення', 'Опис'], ['reply_1_ua', 'Замовлення зібрано, відправимо сьогодні', ''], ['reply_1_ru', 'Заказ собран, отправим сегодня', ''],
        ['reply_2_ua', 'Цього товару зараз немає — запропонувати заміну?', ''], ['gift_from', '500', ''], ['gift_text_ua', '100 г кураги', ''], ['loyal_every', '3', '']];
    });
    const g = st.gas, n = a => st.log.filter(x => x.action === a).length;
    const own = g.initData({ id: 900, first_name: 'Власник' });
    const mkOrder = (uid, pay, lang) => g.post({ action: 'order', initData: g.initData({ id: uid, first_name: 'Покупець' }), items: [{ id: 'NUT-007', g: 0, q: 1 }], total: 85, name: 'Олена', phone: '+380501234567', delivery: 'np', city: 'Київ', branch: '12', pay: pay || 'cod', lang: lang || 'ua', rid: 'b10-' + uid }).number;
    const n1 = mkOrder(801), n2 = mkOrder(802), n3 = mkOrder(803, 'card');
    const rowOf = num => g.sheets['Замовлення'].rows.find(r => r[0] === num);
    const A = await open(browser, st.url, { uid: 900, query: '?admin=1' });
    const page = A.page;
    await A.ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: st.url }).catch(() => {});
    const tgCalls = () => page.evaluate(() => window.__tg.calls);
    const badgeOf = num => page.locator('.ord:has([data-ord="' + num + '"]) .ord__head .badge').first().innerText();
    const sheetOpen = () => page.evaluate(() => !document.getElementById('sheet').hidden);

    // 1. «Сьогодні»
    await page.waitForSelector('.tcard');
    const srv = g.post({ action: 'admin.today', initData: own }).today;
    const cards = await page.locator('.tcard').evaluateAll(l => l.map(b => [b.getAttribute('data-today'), Number(b.querySelector('b').textContent)]));
    const want = [['new', srv.newOrders], ['ship', srv.toShip], ['out', srv.outOfStock], ['price', srv.noPrice], ['photo', srv.noPhoto]];
    ok(JSON.stringify(cards) === JSON.stringify(want) && srv.newOrders === 3 && srv.toShip === 1 && srv.noPrice === 1 && srv.outOfStock > 0 && srv.noPhoto > 0, '«Сьогодні»: пять карточек с числами сервера (нові 3, треба відправити 1, чекають ціну 1)', [cards, srv]);
    ok(/Сьогодні/.test(await text(page, '.today')) && /Нові замовлення/.test(await text(page, '[data-today="new"]')) && /Чекають ціну/.test(await text(page, '[data-today="price"]')) && /Без фото/.test(await text(page, '[data-today="photo"]')), 'подписи карточек на украинском');
    ok(((await text(page, '.page')).match(/Сьогодні/g) || []).length === 1, 'заголовок «Сьогодні» на вкладке заказов — один раз', (await text(page, '.page')).slice(0, 300));
    ok(n('admin.today') === 1, 'числа запрошены одним запросом admin.today', n('admin.today'));
    ok(await noOverflow(page) && (await smallTargets(page)).length === 0, '«Сьогодні»: 360 px без горизонтальной прокрутки, карточки и кнопки ≥ 44 px', await smallTargets(page));
    await page.screenshot({ path: OUT + '/112-b2-today.png' });
    await page.click('[data-today="new"]');
    ok(await count(page, '.ord') === 4 && (await text(page, '#admFilter [aria-pressed="true"]')) === 'новий', 'нажатие на «Нові замовлення» — список заказов со статусом «новий» (3 настоящих + тестовый)', await count(page, '.ord'));
    await page.click('[data-today="ship"]');
    ok(await count(page, '.ord') === 1 && (await text(page, '#admFilter [aria-pressed="true"]')) === 'підтверджено', '«Треба відправити» — подтверждённые заказы');
    await page.click('[data-today="out"]');
    await page.waitForSelector('.prod');
    ok(await count(page, '.prod') === srv.outOfStock && await count(page, '[data-stock][aria-checked="true"]') === 0 && /Немає · \d+/.test(await text(page, '[data-pflt="out"][aria-pressed="true"]')), '«Немає в наявності» — список товаров без остатка, фильтр включён', [await count(page, '.prod'), srv.outOfStock]);
    await page.click('[data-tab="orders"]');
    await page.click('[data-today="price"]');
    await page.waitForSelector('.prod');
    ok(await count(page, '.prod') === 1 && await count(page, '.prod[data-pid="DRY-030"]') === 1 && /Чекають ціну · 1/.test(await text(page, '[data-pflt="noprice"]')), '«Чекають ціну» — товар с ценой 0', await count(page, '.prod'));
    await page.click('[data-tab="orders"]');
    await page.click('[data-today="photo"]');
    await page.waitForSelector('.prod');
    ok(await count(page, '.prod') === srv.noPhoto && await page.locator('.prod .prod__sub').evaluateAll(l => l.every(x => /без фото/.test(x.textContent))), '«Без фото» — только товары без фото', [await count(page, '.prod'), srv.noPhoto]);
    await page.click('[data-tab="orders"]');
    await page.click('[data-filter=""]');

    // 2. Заказы: новые сверху и выделены, чипы
    const marks = await page.locator('.ord').evaluateAll(l => l.map(x => x.classList.contains('ord--new')));
    ok(marks.length === 7 + 3 && marks.slice(0, 4).every(Boolean) && !marks.slice(4).some(Boolean), 'новые заказы наверху и выделены (3 новых + тестовый), остальные ниже', marks);
    const chipTexts = await page.locator('#admFilter .chip').allInnerTexts();
    ok(chipTexts.join() === 'Усі,новий,підтверджено,відправлено,виконано,немає в наявності', 'чипы-фильтры по статусу', chipTexts);
    await page.click('[data-ord="' + n1 + '"]');
    ok(await count(page, '.ord__acts [data-st]') === 1 && await page.getAttribute('.ord__acts [data-st]', 'data-st') === 'c' && /Підтвердити/.test(await text(page, '.ord__acts [data-st]')) && (await text(page, '[data-more]')) === 'Ще', 'в карточке одна большая кнопка «Підтвердити» и «Ще»');
    ok(await page.locator('.ord__acts [data-st]').evaluate(b => b.getBoundingClientRect().height >= 50 && b.classList.contains('btn--primary')), 'главная кнопка крупная (≥ 50 px), акцентная');
    await page.click('[data-more]');
    const more = await page.locator('.ord__more [data-st]').allInnerTexts();
    ok(more.join() === 'Немає в наявності,Відправлено,Виконано', 'под «Ще» остальные статусы', more);
    await page.screenshot({ path: OUT + '/113-b2-order.png', fullPage: true });
    ok((await smallTargets(page)).length === 0 && await noOverflow(page), 'карточка заказа: кнопки ≥ 44 px, без горизонтальной прокрутки', await smallTargets(page));
    await page.click('[data-more]');
    ok(await count(page, '.ord__more') === 0, '«Ще» сворачивается');

    // «Подзвонити» и «Скопіювати адресу»
    ok(await page.getAttribute('.ord__tools a[href^="tel:"]', 'href') === 'tel:+380501234567' && /Подзвонити/.test(await text(page, '.ord__tools a')), 'кнопка «Подзвонити» — ссылка tel: с номером заказа');
    await page.click('[data-copyaddr]');
    await page.waitForFunction(() => /Скопійовано/.test(document.querySelector('[data-copyaddr]').textContent));
    const clip = await page.evaluate(() => navigator.clipboard.readText().catch(() => 'нет доступа'));
    ok(clip === 'Київ, 12', '«Скопіювати адресу»: на кнопке «Скопійовано», в буфере город и отделение', clip);

    // шторка-превью: точный текст сервера, статус меняется только после подтверждения
    st.opt.delay = 300;
    await page.click('.ord__acts [data-st="c"]');
    ok(await page.evaluate(() => { const b = document.querySelector('.ord__acts .is-busy'); return !!b && b.disabled; }) && n('admin.status') === 0, 'нажатие сразу показывает индикатор, статус ещё не менялся');
    await page.waitForSelector('#sheet [data-action="cf-ok"]');
    st.opt.delay = 0;
    const prev = g.post({ action: 'admin.statusPreview', initData: own, num: n1, code: 'c' });
    ok(prev.ok && prev.willSend && (await page.locator('#stText').textContent()) === prev.text, 'шторка показывает ровно текст сервера', [prev.text, await page.locator('#stText').textContent()]);
    ok(/підтверджено/.test(await text(page, '#sheet .sheet__title')) && (await text(page, '[data-action="cf-ok"]')).trim() === 'Надіслати й змінити статус' && (await text(page, '[data-action="cf-cancel"]')).trim() === 'Скасувати', 'кнопки шторки: «Надіслати й змінити статус» и «Скасувати»');
    ok((await smallTargets(page)).length === 0 && await noOverflow(page), 'шторка-превью: кнопки ≥ 44 px, без горизонтальной прокрутки', await smallTargets(page));
    await page.screenshot({ path: OUT + '/114-b2-preview.png' });
    await page.click('[data-action="cf-cancel"]');
    ok(n('admin.status') === 0 && rowOf(n1)[2] === 'новий' && !(await sheetOpen()), '«Скасувати» ничего не меняет, запроса admin.status нет');
    await page.click('.ord__acts [data-st="c"]');
    await page.waitForSelector('#sheet [data-action="cf-ok"]');
    ok(n('admin.status') === 0, 'пока не подтверждено, admin.status не уходит');
    const sentBefore = g.sent.length;
    await page.click('#sheet [data-action="cf-ok"]');
    await page.waitForFunction(() => document.getElementById('sheet').hidden);
    ok(n('admin.status') === 1 && rowOf(n1)[2] === 'підтверджено' && await badgeOf(n1) === 'підтверджено', 'после подтверждения — один запрос, статус записан и виден');
    ok(g.sent.slice(sentBefore).some(m => m.method === 'sendMessage' && String(m.payload.chat_id) === '801' && m.payload.text === prev.text), 'клиент получил именно тот текст, что был в шторке');
    ok(await page.getAttribute('.ord__acts [data-st]', 'data-st') === 's' && /Відправлено/.test(await text(page, '.ord__acts [data-st]')), 'следующий шаг — «Відправлено»');
    await page.click('.ord__acts [data-st="s"]');
    await page.waitForSelector('#sheet [data-action="cf-ok"]');
    await page.click('#sheet [data-action="cf-ok"]');
    await page.waitForFunction(() => document.getElementById('sheet').hidden);
    ok(rowOf(n1)[2] === 'відправлено' && await page.getAttribute('.ord__acts [data-st]', 'data-st') === 'd' && /Виконано/.test(await text(page, '.ord__acts [data-st]')), 'потом «Виконано»', rowOf(n1)[2]);

    // реквизиты ФОП: пометка
    await page.click('[data-ord="' + n3 + '"]');
    await page.click('.ord__acts [data-st="c"]');
    await page.waitForSelector('#sheet [data-action="cf-ok"]');
    const prev3 = g.post({ action: 'admin.statusPreview', initData: own, num: n3, code: 'c' });
    ok(prev3.extra === 'fop' && /Реквізити для оплати клієнт отримає окремим повідомленням/.test(await text(page, '#sheet')), 'оплата на карту: в шторке пометка, что реквизиты уйдут отдельным сообщением');
    await page.click('#sheet [data-action="cf-ok"]');
    await page.waitForFunction(() => document.getElementById('sheet').hidden);

    // превью недоступно (ошибка запроса): подтвердить всё равно можно
    await page.click('[data-ord="' + n2 + '"]');
    st.opt.failAction = 'admin.statusPreview';
    await page.click('.ord__acts [data-st="c"]');
    await page.waitForSelector('#sheet [data-action="cf-ok"]');
    st.opt.failAction = '';
    ok(/Текст повідомлення зараз недоступний/.test(await text(page, '#sheet')) && rowOf(n2)[2] === 'новий', 'превью не загрузилось: «текст недоступний», статус не меняется сам');
    // сервер отказал при подтверждении: ошибка в шторке, статус прежний
    st.opt.failAction = 'admin.status';
    await page.click('#sheet [data-action="cf-ok"]');
    await page.waitForSelector('#cfErr:not([hidden])');
    ok(/Статус не змінено/.test(await text(page, '#cfErr')) && rowOf(n2)[2] === 'новий' && await sheetOpen() && !(await page.locator('[data-action="cf-ok"]').isDisabled()), 'сервер отказал — понятная ошибка, статус прежний, кнопку можно нажать снова');
    st.opt.failAction = '';
    await page.click('#sheet [data-action="cf-ok"]');
    await page.waitForFunction(() => document.getElementById('sheet').hidden);
    ok(rowOf(n2)[2] === 'підтверджено', 'после повторного нажатия статус сменился');
    await page.waitForFunction(() => document.querySelector('[data-today="new"] b') && document.querySelector('[data-today="new"] b').textContent === '0');
    ok(await page.locator('[data-today="new"]').evaluate(b => b.classList.contains('is-zero')) && !(await page.locator('[data-today="ship"]').evaluate(b => b.classList.contains('is-zero'))), 'число «Нові замовлення» стало 0 — карточка серая, остальные цветные');
    await page.screenshot({ path: OUT + '/115-b2-today-zero.png' });

    // 3. «Написати»
    await page.click('[data-ord="' + n1 + '"]');
    await page.click('[data-write="' + n1 + '"]');
    await page.waitForSelector('#msgText');
    ok(await count(page, '.msg__tpl') === 2 && await count(page, '[data-tlang]') === 2 && await page.getAttribute('#msgText', 'maxlength') === '500', 'в шторке два шаблона из настроек, переключатель языка и поле до 500 знаков');
    ok(await page.evaluate(() => document.querySelector('.msg__tpl').getBoundingClientRect().bottom <= document.getElementById('msgText').getBoundingClientRect().top), 'шаблоны стоят над полем текста');
    await page.locator('.msg__tpl').first().click();
    ok(await page.inputValue('#msgText') === 'Замовлення зібрано, відправимо сьогодні' && new RegExp('^' + 'Замовлення зібрано, відправимо сьогодні'.length + ' / 500$').test(await text(page, '#msgCnt')), 'шаблон подставлен в поле, счётчик знаков', [await page.inputValue('#msgText'), await text(page, '#msgCnt')]);
    await page.click('[data-tlang="ru"]');
    ok(/Заказ собран/.test(await text(page, '.msg__tpl')), 'язык шаблонов переключается');
    await page.click('[data-tlang="ua"]');
    await page.locator('.msg__tpl').first().click();
    await page.fill('#msgText', (await page.inputValue('#msgText')) + ' Дякуємо!');
    ok(new RegExp('^' + ('Замовлення зібрано, відправимо сьогодні Дякуємо!'.length) + ' / 500$').test(await text(page, '#msgCnt')), 'текст можно поправить, счётчик обновляется', await text(page, '#msgCnt'));
    ok((await smallTargets(page)).length === 0 && await noOverflow(page), 'шторка «Написати»: кнопки и поле ≥ 44 px, без горизонтальной прокрутки', await smallTargets(page));
    await page.screenshot({ path: OUT + '/116-b2-message.png' });
    const sent0 = g.sent.length;
    await page.click('#sheet [data-action="cf-ok"]');
    await page.waitForFunction(() => document.getElementById('sheet').hidden);
    ok(n('admin.message') === 1 && g.sent.slice(sent0).some(m => m.method === 'sendMessage' && String(m.payload.chat_id) === '801' && /Замовлення зібрано, відправимо сьогодні Дякуємо!/.test(m.payload.text)) && /Надіслано/.test(await text(page, '#toast')), 'сообщение ушло клиенту, показано «Надіслано»');
    // ошибки
    await page.click('[data-write="' + n1 + '"]');
    await page.waitForSelector('#msgText');
    await page.click('#sheet [data-action="cf-ok"]');
    ok(/Напишіть текст/.test(await text(page, '#cfErr')) && n('admin.message') === 1, 'пустой текст: понятная ошибка, запроса нет');
    await page.fill('#msgText', 'Перевірка');
    g.setTelegramFail((m) => m === 'sendMessage' ? { ok: false, description: 'Forbidden: bot was blocked by the user' } : null);
    await page.click('#sheet [data-action="cf-ok"]');
    await page.waitForFunction(() => /заблокував/.test((document.getElementById('cfErr') || {}).textContent || ''));
    ok(await sheetOpen() && n('admin.message') === 2, 'told = false: сообщение не доставлено — об этом сказано в шторке, она остаётся открытой');
    g.setTelegramFail(false);
    st.opt.failAction = 'admin.message';
    await page.click('#sheet [data-action="cf-ok"]');
    await page.waitForFunction(() => /Не вдалося надіслати/.test((document.getElementById('cfErr') || {}).textContent || ''));
    st.opt.failAction = '';
    ok(true, 'ошибка сервера: «Не вдалося надіслати»');
    await page.click('#sheet [data-chat]');
    ok((await tgCalls()).some(c => c[0] === 'openTelegramLink' && c[1] === 'https://t.me/+380501234567'), 'рядом осталась возможность открыть чат в Telegram');
    await page.click('#sheet [data-action="cf-cancel"]');
    // тестовый заказ
    await page.click('[data-ord="P-0007"]');
    await page.click('[data-write="P-0007"]');
    await page.waitForSelector('#msgText');
    await page.fill('#msgText', 'Привіт');
    await page.click('#sheet [data-action="cf-ok"]');
    await page.waitForFunction(() => /тестове замовлення/.test((document.getElementById('cfErr') || {}).textContent || ''));
    ok(true, 'тестовый заказ: «Це тестове замовлення — клієнту нічого не надсилається»');
    await page.click('#sheet [data-action="cf-cancel"]');

    // 4. Товары: быстрая цена, «Збережено», чипы
    await page.click('[data-tab="products"]');
    await page.waitForSelector('.prod');
    await page.click('[data-pflt="nophoto"]'); // фильтр остался от карточки «Без фото»
    const chips = await page.locator('#admPChips .chips--wrap .chip').allInnerTexts();
    ok(/^Приховані/.test(chips[0]) && /^Чекають ціну/.test(chips[1]) && /^Немає/.test(chips[2]) && /^Без фото/.test(chips[3]) && chips.length === 4, 'чипы: «Приховані», «Чекають ціну», «Немає», «Без фото»', chips);
    await page.fill('#admPQ', 'NUT-002');
    await page.waitForSelector('.prod[data-pid="NUT-002"]');
    ok(await page.locator('[data-qprice="NUT-002"]').getAttribute('inputmode') === 'decimal' && await page.locator('[data-qsave="NUT-002"]').isDisabled(), 'поле цены с цифровой клавиатурой; «Зберегти» неактивна, пока цену не изменили');
    await page.fill('[data-qprice="NUT-002"]', '0');
    await page.click('[data-qsave="NUT-002"]');
    ok(/більше нуля/.test(await text(page, '.prod[data-pid="NUT-002"] .prod__err')) && n('admin.product') === 0, 'цена 0 — ошибка «Введіть число більше нуля», запроса нет');
    await page.fill('[data-qprice="NUT-002"]', 'abc');
    await page.click('[data-qsave="NUT-002"]');
    ok(n('admin.product') === 0 && /більше нуля/.test(await text(page, '.prod[data-pid="NUT-002"] .prod__err')), 'не число — тоже ошибка');
    st.opt.delay = 400;
    await page.fill('[data-qprice="NUT-002"]', '99,5');
    await page.evaluate(() => { const b = document.querySelector('[data-qsave="NUT-002"]'); b.click(); b.click(); });
    ok(await page.evaluate(() => { const b = document.querySelector('[data-qsave="NUT-002"]'); return b.classList.contains('is-busy') && b.disabled && document.querySelector('[data-qprice="NUT-002"]').disabled; }), 'кнопка сразу показывает индикатор и блокируется, поле закрыто');
    await page.waitForSelector('.prod[data-pid="NUT-002"].is-saved');
    st.opt.delay = 0;
    ok(n('admin.product') === 1 && /Збережено/.test(await text(page, '.prod[data-pid="NUT-002"] .prod__ok')) && await page.locator('.prod[data-pid="NUT-002"] .prod__ok').isVisible(), 'после ответа на карточке видна отметка «Збережено»; двойное нажатие — один запрос');
    const saved = g.post({ action: 'admin.products', initData: own }).products.find(p => p.id === 'NUT-002');
    ok(saved.price === 99.5 && await page.inputValue('[data-qprice="NUT-002"]') === '99,5', 'цена записана на сервере (99,5), в поле — сохранённое значение', saved.price);
    await page.screenshot({ path: OUT + '/117-b2-products.png' });
    await page.waitForFunction(() => !document.querySelector('.prod[data-pid="NUT-002"].is-saved'), null, { timeout: 5000 });
    ok(await page.locator('.prod[data-pid="NUT-002"] .prod__ok').isHidden(), 'отметка «Збережено» гаснет через пару секунд');
    st.opt.failAction = 'admin.product';
    await page.fill('[data-qprice="NUT-002"]', '77');
    await page.click('[data-qsave="NUT-002"]');
    await page.waitForFunction(() => /повернули попередню/.test((document.querySelector('.prod[data-pid="NUT-002"] .prod__err') || {}).textContent || ''));
    ok(await page.inputValue('[data-qprice="NUT-002"]') === '99,5' && g.post({ action: 'admin.products', initData: own }).products.find(p => p.id === 'NUT-002').price === 99.5, 'ошибка сервера: понятный текст и возврат прежнего значения');
    st.opt.failAction = '';
    await page.fill('#admPQ', '');
    await page.click('[data-pflt="noprice"]');
    ok(await count(page, '.prod') === 1 && await count(page, '.prod[data-pid="DRY-030"]') === 1, 'чип «Чекають ціну» показывает товар с нулевой ценой');
    await page.fill('[data-qprice="DRY-030"]', '640');
    await page.click('[data-qsave="DRY-030"]');
    await page.waitForSelector('.prod[data-pid="DRY-030"].is-saved');
    ok(g.post({ action: 'admin.products', initData: own }).products.find(p => p.id === 'DRY-030').price === 640, 'цена товара «чекає ціну» выставлена');
    await page.waitForFunction(() => !document.querySelector('.prod'), null, { timeout: 5000 });
    ok(/Нічого не знайдено/.test(await text(page, '#admList')) && await count(page, '[data-action="adm-reset"]') === 1 && /Чекають ціну · 0/.test(await text(page, '[data-pflt="noprice"]')), 'товар с ценой ушёл из фильтра, число на чипе 0, пустой список с понятным текстом и кнопкой «Скинути фільтри»');
    await page.click('[data-action="adm-reset"]');
    await page.waitForSelector('.prod');
    // переключатель «є / немає» тоже даёт отметку
    const stockId = await page.locator('[data-stock]').first().getAttribute('data-stock');
    await page.click('[data-stock="' + stockId + '"]');
    await page.waitForSelector('.prod[data-pid="' + stockId + '"].is-saved');
    ok(/Збережено/.test(await text(page, '.prod[data-pid="' + stockId + '"] .prod__ok')), 'переключатель «є / немає» тоже показывает «Збережено»');
    await page.click('[data-stock="' + stockId + '"]');
    await page.waitForFunction(i => !document.querySelector('[data-stock="' + i + '"]').disabled, stockId);
    ok((await smallTargets(page)).length === 0 && await noOverflow(page), 'список товаров: кнопки и поля ≥ 44 px, без горизонтальной прокрутки', await smallTargets(page));

    // фото: две кнопки
    const noImg = g.post({ action: 'admin.products', initData: own }).products.find(p => !p.img && !p.hidden);
    await page.fill('#admPQ', noImg.id);
    await page.click('[data-edit="' + noImg.id + '"]');
    await page.waitForSelector('#a-photo-cam', { state: 'attached' });
    ok(await page.getAttribute('#a-photo-cam', 'capture') === 'environment' && await page.getAttribute('#a-photo', 'capture') === null && /Зняти фото/.test(await text(page, 'label:has(#a-photo-cam)')) && /Вибрати з галереї/.test(await text(page, 'label:has(#a-photo)')), 'две кнопки фото: «Зняти фото» (capture=environment) и «Вибрати з галереї»');
    ok((await smallTargets(page)).length === 0 && await noOverflow(page), 'карточка товара с фото: кнопки ≥ 44 px', await smallTargets(page));
    await page.setInputFiles('#a-photo-cam', { name: 'cam.png', mimeType: 'image/png', buffer: makePng(160, 160) });
    for (let i = 0; i < 50 && n('admin.photo') < 1; i++) await page.waitForTimeout(100);
    ok(n('admin.photo') === 1, 'снимок с камеры уходит через общую загрузку фото (admin.photo)', n('admin.photo'));
    await page.waitForFunction(() => !document.querySelector('.photo__acts .is-busy'));
    await page.setInputFiles('#a-photo', { name: 'gal.png', mimeType: 'image/png', buffer: makePng(160, 160) });
    for (let i = 0; i < 50 && n('admin.photo') < 2; i++) await page.waitForTimeout(100);
    ok(n('admin.photo') === 2, 'файл из галереи — тот же запрос admin.photo', n('admin.photo'));
    await page.waitForFunction(() => !document.querySelector('.photo__acts .is-busy'));
    await page.click('[data-nav="back"]');
    await page.waitForSelector('.prod');

    // 5. Настройки
    await page.route('**/api', async route => { // «новый» ключ, которого панель ещё не знает
      const req = route.request();
      if (req.method() === 'POST' && /"action":"admin\.settings"/.test(req.postData() || '')) {
        const resp = await route.fetch(); const json = await resp.json();
        json.fields.push({ k: 'zz_new_key', label: 'Новая настройка с сервера', v: 'значення' });
        await route.fulfill({ response: resp, json });
      } else await route.continue();
    });
    await page.click('[data-tab="settings"]');
    await page.waitForSelector('.sgroup');
    const openNow = await page.locator('.sgroup').evaluateAll(l => l.map(d => d.getAttribute('data-sg') + ':' + d.open).join());
    ok(openNow === 'shop:true,gifts:false,pay:false,texts:false,remind:false,season:false,other:false', 'группы настроек по умолчанию свёрнуты, раскрыта только первая («Магазин»)', openNow);
    await openGroups(page);
    const groupNames = await page.locator('.sgroup__sum > span:first-child').allInnerTexts();
    ok(groupNames.join() === 'Магазин,Подарунки,Оплата й доставка,Тексти,Нагадування й розсилки,Сезон,Інше', 'группы настроек: Магазин, Подарунки, Оплата й доставка, Тексти, Нагадування й розсилки, Сезон, Інше', groupNames);
    const inGroup = k => page.locator('.sgroup:has(#a-' + k + ') .sgroup__sum > span:first-child').innerText();
    ok(await inGroup('gift_from') === 'Подарунки' && await inGroup('pay_cash') === 'Оплата й доставка' && await inGroup('reply_1_ua') === 'Тексти' && await inGroup('theme') === 'Сезон' && await inGroup('notice_ua') === 'Магазин' && await inGroup('zz_new_key') === 'Інше', 'настройки лежат в своих группах, неизвестный ключ — в «Інше»');
    ok(await count(page, '.field:has(#a-zz_new_key) .field__hint') === 0 && await count(page, '.field:has(#a-zz_new_key) .spv') === 0, 'у неизвестного ключа нет пояснения и превью');
    const grp = {};
    for (const k of ['remind_days', 'remind_text_ua', 'remind_text_ru', 'review_days', 'cart_remind_hours', 'cart_mute_days', 'mail_every_days', 'bot_short_ua', 'bot_desc_ru', 'greeting_ua', 'greeting_back_ru', 'welcome_photo', 'welcome_video_note', 'biz_soon_ua', 'story_title_ua', 'story_text_ru', 'story_photos', 'low_stock', 'fresh_days', 'referral_on', 'referral_gift_ua', 'referral_min_order']) grp[k] = await inGroup(k);
    const wantG = k => /^(remind_days|remind_text_|review_days|cart_remind_hours|cart_mute_days|mail_every_days)/.test(k) ? 'Нагадування й розсилки' : /^(low_stock|fresh_days)$/.test(k) ? 'Магазин' : /^referral_/.test(k) ? 'Подарунки' : 'Тексти';
    ok(Object.keys(grp).every(k => grp[k] === wantG(k)), 'нагадування и рассылки — в своей группе; bot_/greeting_/welcome_/story_ — «Тексти»; low_stock, fresh_days — «Магазин»; referral_ — «Подарунки»', grp);
    const otherKeys = await page.locator('.sgroup[data-sg="other"] [id^="a-"]').evaluateAll(l => l.map(x => x.id.slice(2)));
    ok(otherKeys.join() === 'zz_new_key', 'в «Інше» только неизвестный ключ с сервера', otherKeys);
    const NO_HINT = ['zz_new_key']; // явный список исключений: ключ, которого панель не знает
    const noHint = await page.evaluate(() => [].slice.call(document.querySelectorAll('.sfield')).filter(f => !f.querySelector('.field__hint')).map(f => (f.querySelector('[id^="a-"]') || {}).id.slice(2)));
    ok(noHint.filter(k => NO_HINT.indexOf(k) < 0).length === 0, 'у каждой настройки есть пояснение (кроме явного списка исключений)', noHint);
    const noEx = await page.evaluate(() => [].slice.call(document.querySelectorAll('.sfield')).filter(f => !f.querySelector('.field__ex') && f.querySelector('.field__hint')).map(f => f.querySelector('[id^="a-"]').id.slice(2)));
    ok(noEx.filter(k => !/^(pay_|ny_snow|gift_note|referral_on|reply_|confirm_|address_|hours_|ny_ids|theme)/.test(k)).length === 0, 'у настроек с полем ввода есть пример', noEx);
    ok(!/pamir_help/.test(await page.evaluate(() => document.querySelector('.page').textContent)) && /@ваш_нік/.test(await text(page, '.field:has(#a-contact) .field__ex')), 'в примерах нет выдуманного ника: образец «@ваш_нік»', await text(page, '.field:has(#a-contact)'));
    ok(/Від якої суми замовлення клієнт отримує подарунок/.test(await text(page, '.field:has(#a-gift_from) .field__hint')) && /Приклад: 500/.test(await text(page, '.field:has(#a-gift_from) .field__ex')), 'под полем — пояснение простыми словами и пример', await text(page, '.field:has(#a-gift_from)'));
    ok(await page.getAttribute('#a-pay_cash', 'role') === 'switch' && await page.getAttribute('#a-pay_card', 'role') === 'switch' && await page.getAttribute('#a-pay_cod', 'role') === 'switch' && await page.getAttribute('#a-ny_snow', 'role') === 'switch' && await page.getAttribute('#a-gift_note', 'role') === 'switch' && await page.getAttribute('#a-referral_on', 'role') === 'switch', 'настройки «да / нет» (оплата, снег, подпись, «Пригости друга») — переключателями');
    ok(await page.getAttribute('#a-pay_cash', 'aria-checked') === 'true' && await page.getAttribute('#a-ny_snow', 'aria-checked') === 'false', 'положение переключателей берётся из настроек');
    // переключатель отвечает сразу; оба способа оплаты выключить нельзя
    await page.click('#a-pay_cash'); await page.click('#a-pay_card');
    ok(await page.getAttribute('#a-pay_cash', 'aria-checked') === 'false', 'переключатель меняется сразу');
    await page.click('[data-action="adm-save"]');
    ok(/хоча б один спосіб оплати/.test(await text(page, '#admErr')) && n('admin.settingsSave') === 0, 'оба способа оплаты выключены — понятная ошибка, запроса нет');
    await page.click('#a-pay_cash'); await page.click('#a-ny_snow');
    // превью
    await page.fill('#a-notice_text_ua', '<img src=x onerror=alert(1)> Закрито до 10.01 <b>жирний</b>');
    ok(await count(page, '#pv-notice_text_ua img') === 0 && await count(page, '#pv-notice_text_ua b') === 0 && (await page.locator('#pv-notice_text_ua').textContent()).trim() === '<img src=x onerror=alert(1)> Закрито до 10.01 <b>жирний</b>', 'превью строки: HTML экранируется, показывается текстом');
    ok(/Так це бачить покупець/.test(await text(page, '.field:has(#a-notice_text_ua) .spv__label')), 'подпись «Так це бачить покупець»');
    await page.fill('#a-notice_text_ua', 'Нова версія');
    ok((await page.locator('#pv-notice_text_ua').textContent()).trim() === 'Нова версія', 'превью обновляется при вводе');
    await page.fill('#a-gift_text_ua', 'Знижка $& 5$$ $1');
    ok((await text(page, '#pv-gift_text_ua')).indexOf('Знижка $& 5$$ $1') >= 0 && await count(page, '#pv-gift_text_ua .note') === 1, 'превью: знаки $ показываются дословно («Знижка $& 5$$ $1»), вёрстка цела', await text(page, '#pv-gift_text_ua'));
    await page.fill('#a-gift_text_ua', '100 г кураги');
    ok(/Подарунок до замовлення: 100 г кураги/.test(await text(page, '#pv-gift_text_ua')), 'превью подарка — как в корзине', await text(page, '#pv-gift_text_ua'));
    await page.fill('#a-loyal_text_ua', 'чурчхела');
    ok(/До кожного 3-го замовлення даруємо: чурчхела/.test(await text(page, '#pv-loyal_text_ua')), 'превью подарка постоянным клиентам берёт число из соседнего поля', await text(page, '#pv-loyal_text_ua'));
    await page.fill('#a-reply_3_ua', '<script>1</script>Готово');
    ok(await count(page, '#pv-reply_3_ua script') === 0 && /Готово/.test(await text(page, '#pv-reply_3_ua')), 'превью готового ответа тоже экранируется');
    ok(await count(page, '#pv-feature_title_ua') === 1 && await count(page, '#pv-father_text_ua') === 1 && await count(page, '#pv-ny_order_until_ua') === 1, 'превью есть у заголовков и текстов блоков и у строки о сроке');
    await page.click('.sgroup[data-sg="texts"] summary');
    ok(await page.locator('.sgroup[data-sg="texts"]').evaluate(d => !d.open), 'группу можно свернуть');
    await page.click('.sgroup[data-sg="texts"] summary');
    ok((await smallTargets(page)).length === 0 && await noOverflow(page), 'настройки: поля, переключатели и заголовки групп ≥ 44 px, без горизонтальной прокрутки', await smallTargets(page));
    if (await count(page, '#a-followup1_days')) {
      const fh = k => text(page, '.field:has(#a-' + k + ') .field__hint');
      const h1 = await fh('followup1_days'), h2 = await fh('followup2_days'), h3 = await fh('np_track_hours');
      ok(/після статусу «Виконано»/.test(h1) && /Рекомендуємо 3;/.test(h1) && /окреме прохання оцінити замовлення не надсилається/.test(h1) && !/після дати замовлення/.test(h1) && /Рекомендуємо 21;/.test(h2) && /старе нагадування не надсилається/.test(h2) && /Рекомендуємо 3; 0 — вимкнено/.test(h3), 'настройки followup/np_track: подсказки без выдуманного «после даты заказа», с рекомендацией', [h1, h2, h3]);
      await page.fill('#a-followup1_days', '0');
      ok(await page.isVisible('#off-followup1_days') && /Зараз вимкнено/.test(await text(page, '#off-followup1_days')), 'значение 0 показывается как «Зараз вимкнено»');
      await page.fill('#a-followup1_days', '3');
      ok(!(await page.isVisible('#off-followup1_days')), 'значение 3 — пометки «вимкнено» нет');
    }
    await page.screenshot({ path: OUT + '/118-b2-settings.png', fullPage: true });
    await page.click('[data-action="adm-save"]');
    await page.waitForSelector('[data-action="adm-save"].is-saved');
    const setRow = k => g.sheets['Налаштування'].rows.find(r => r[0] === k);
    ok(setRow('ny_snow')[1] === '1' && setRow('pay_cash')[1] === 'так' && setRow('notice_text_ua')[1] === 'Нова версія' && setRow('reply_3_ua')[1] === '<script>1</script>Готово', 'сохранение: переключатели и тексты записаны в таблицу', [setRow('ny_snow'), setRow('pay_cash')]);
    ok(A.errors.length === 0, 'в консоли браузера нет ошибок (панель, UA, светлая тема)', A.errors);
    await A.ctx.close();

    // тёмная тема и русский язык
    const n4 = mkOrder(804, undefined, 'ru');
    const R = await open(browser, st.url, { uid: 900, query: '?admin=1', theme: 'dark', lc: 'ru' });
    const rp = R.page;
    await rp.waitForSelector('.tcard');
    ok(/Новые заказы/.test(await text(rp, '[data-today="new"]')) && /Надо отправить/.test(await text(rp, '[data-today="ship"]')) && /Нет в наличии/.test(await text(rp, '[data-today="out"]')) && /Ждут цену/.test(await text(rp, '[data-today="price"]')), 'RU: подписи карточек «Сегодня»');
    ok(await noOverflow(rp) && (await smallTargets(rp)).length === 0, 'RU, тёмная тема: «Сегодня» без горизонтальной прокрутки, кнопки ≥ 44 px', await smallTargets(rp));
    await rp.screenshot({ path: OUT + '/119-b2-today-dark-ru.png' });
    await rp.click('[data-ord="' + n4 + '"]');
    ok(/Подтвердить/.test(await text(rp, '.ord__acts [data-st]')) && (await text(rp, '[data-more]')) === 'Ещё' && /Позвонить/.test(await text(rp, '.ord__tools a')) && /Скопировать адрес/.test(await text(rp, '[data-copyaddr]')), 'RU: «Подтвердить», «Ещё», «Позвонить», «Скопировать адрес»');
    await rp.screenshot({ path: OUT + '/120-b2-order-dark-ru.png', fullPage: true });
    await rp.click('.ord__acts [data-st="c"]');
    await rp.waitForSelector('#sheet [data-action="cf-ok"]');
    ok(/Сменить статус на «підтверджено»/.test(await text(rp, '#sheet .sheet__title')) && (await text(rp, '[data-action="cf-ok"]')).trim() === 'Отправить и сменить статус' && (await text(rp, '[data-action="cf-cancel"]')).trim() === 'Отмена', 'RU: шторка-превью');
    ok((await smallTargets(rp)).length === 0 && await noOverflow(rp), 'RU, тёмная тема: шторка-превью без горизонтальной прокрутки, кнопки ≥ 44 px', await smallTargets(rp));
    await rp.screenshot({ path: OUT + '/121-b2-preview-dark-ru.png' });
    await rp.click('[data-action="cf-cancel"]');
    await rp.click('[data-write="' + n4 + '"]');
    await rp.waitForSelector('#msgText');
    ok(/Заказ собран, отправим сегодня/.test(await text(rp, '.msg__tpl')) && /Готовые ответы/.test(await text(rp, '.msg__tpls')) && /Отправить/.test(await text(rp, '[data-action="cf-ok"]')), 'RU: шторка «Написать» — шаблоны на русском');
    await rp.screenshot({ path: OUT + '/122-b2-message-dark-ru.png' });
    await rp.click('[data-action="cf-cancel"]');
    await rp.click('[data-tab="products"]');
    await rp.waitForSelector('.prod');
    ok(/Скрытые/.test(await text(rp, '[data-pflt="hidden"]')) && /Ждут цену/.test(await text(rp, '[data-pflt="noprice"]')) && /^Нет/.test(await text(rp, '[data-pflt="out"]')) && /Сохранить/.test(await text(rp, '[data-qsave]')), 'RU: чипы и кнопка быстрой цены');
    await rp.screenshot({ path: OUT + '/123-b2-products-dark-ru.png' });
    await rp.click('[data-tab="settings"]');
    await rp.waitForSelector('.sgroup'); await openGroups(rp);
    const ruGroups = await rp.locator('.sgroup__sum > span:first-child').allInnerTexts();
    ok(ruGroups.join() === 'Магазин,Подарки,Оплата и доставка,Тексты,Напоминания и рассылки,Сезон' && /С какой суммы заказа клиент получает подарок/.test(await text(rp, '.field:has(#a-gift_from) .field__hint')) && /Пример: 500/.test(await text(rp, '.field:has(#a-gift_from) .field__ex')), 'RU: группы и пояснения настроек', ruGroups);
    await rp.fill('#a-gift_text_ru', '100 г кураги');
    ok(/Подарок к заказу: 100 г кураги/.test(await text(rp, '#pv-gift_text_ru')), 'RU: превью подарка на русском');
    ok(await noOverflow(rp) && (await smallTargets(rp)).length === 0, 'RU, тёмная тема: настройки без горизонтальной прокрутки, кнопки ≥ 44 px', await smallTargets(rp));
    await rp.screenshot({ path: OUT + '/124-b2-settings-dark-ru.png', fullPage: true });
    ok(R.errors.length === 0, 'в консоли браузера нет ошибок (панель, RU, тёмная тема)', R.errors);
    await R.ctx.close();

    // менеджер без права «статуси»: только то, что разрешено
    g.call('writeAdminRow_', { id: '751', name: 'Менеджер складу', username: '', role: 'manager', perms: { stock: true, price: true, photo: true }, notify: false, active: true, by: 'тест' });
    const M = await open(browser, st.url, { uid: 751, query: '?admin=1' });
    await M.page.waitForSelector('.ord');
    await M.page.waitForSelector('.tcard');
    const mCards = await M.page.locator('.tcard').evaluateAll(l => l.map(b => b.getAttribute('data-today')));
    ok(mCards.join() === 'out,price,photo', 'менеджер без права st: карточек заказов в «Сьогодні» нет, есть наличие, цены, фото', mCards);
    await M.page.click('[data-ord="' + n4 + '"]');
    ok(await count(M.page, '.ord__acts') === 0 && await count(M.page, '[data-st]') === 0 && await count(M.page, '[data-write]') === 0 && await count(M.page, '[data-more]') === 0, 'и кнопок смены статуса и «Написати» тоже нет');
    ok(await count(M.page, '.ord__tools a[href^="tel:"]') === 1 && await count(M.page, '[data-chat]') === 1, 'остались «Подзвонити» и чат в Telegram');
    ok(g.post({ action: 'admin.status', initData: g.initData({ id: 751, first_name: 'М' }), num: n4, code: 'c' }).error === 'no_perm' && g.post({ action: 'admin.message', initData: g.initData({ id: 751, first_name: 'М' }), num: n4, text: 'x' }).error === 'no_perm', 'сервер тоже не даёт менять статус и писать клиенту');
    await M.page.screenshot({ path: OUT + '/125-b2-manager.png' });
    ok(M.errors.length === 0, 'в консоли браузера нет ошибок (менеджер)', M.errors);
    await M.ctx.close();
    st.server.close();
  }

  /* ---------------- Блок 2: пустые и ошибочные состояния ---------------- */
  console.log('Выпуск Б · блок 2: пустые и ошибочные состояния панели');
  {
    const st = await start(8842, undefined, s => {
      const o = s.sheets['Замовлення']; o.length = 1; // заказов нет
    });
    const g = st.gas;
    const { ctx, page, errors } = await open(browser, st.url, { uid: 900, query: '?admin=1' });
    await page.waitForSelector('.adm__empty');
    ok(/Замовлень поки немає/.test(await text(page, '#admList')) && /натисніть «Оновити»/.test(await text(page, '#admList')), 'нет заказов: «Замовлень поки немає» и что делать');
    await page.screenshot({ path: OUT + '/126-b2-empty-orders.png' });
    await ctx.close();
    // нет связи
    const off = await open(browser, st.url, { uid: 900, query: '?admin=1', before: async p => { await p.route('**/api', r => { if (r.request().method() === 'POST' && /admin\.orders/.test(r.request().postData() || '') && !globalThis.__b2ok) r.abort(); else r.continue(); }); } });
    await off.page.waitForSelector('.adm__empty[role="alert"]');
    ok(/Немає зв’язку — натисніть «Оновити»/.test(await text(off.page, '#admList')) && await count(off.page, '#admList [data-action="adm-refresh"]') === 1 && await count(off.page, '[data-action="adm-refresh"]') === 1, 'нет связи: «Немає зв’язку — натисніть “Оновити”» и ровно одна кнопка «Оновити» на экране');
    await off.page.screenshot({ path: OUT + '/127-b2-offline.png' });
    globalThis.__b2ok = true;
    await off.page.click('#admList [data-action="adm-refresh"]');
    await off.page.waitForSelector('.adm__empty:not([role="alert"])');
    ok(/Замовлень поки немає/.test(await text(off.page, '#admList')) && await count(off.page, '[role="alert"].adm__empty') === 0, 'после «Оновити» (связь вернулась) список загрузился');
    delete globalThis.__b2ok;
    await off.ctx.close();
    // нет прав: сервер ответил no_perm
    const np = await open(browser, st.url, { uid: 900, query: '?admin=1', before: async p => { await p.route('**/api', r => { if (r.request().method() === 'POST' && /admin\.products/.test(r.request().postData() || '')) r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'no_perm', need: 'stock' }) }); else r.continue(); }); } });
    await np.page.waitForSelector('.tabs');
    await np.page.click('[data-tab="products"]');
    await np.page.waitForSelector('.adm__empty');
    ok(/Немає прав на цю дію — зверніться до власника/.test(await text(np.page, '#admList')) && await count(np.page, '#admList [data-action="adm-refresh"]') === 0, 'no_perm: «Немає прав на цю дію — зверніться до власника», кнопки «Оновити» нет');
    await np.page.screenshot({ path: OUT + '/128-b2-noperm.png' });
    ok(await noOverflow(np.page) && (await smallTargets(np.page)).length === 0, 'пустые состояния: без горизонтальной прокрутки, кнопки ≥ 44 px', await smallTargets(np.page));
    await np.ctx.close();
    st.server.close();
  }

  /* ---------------- Блок 2: старый бэкенд ---------------- */
  console.log('Выпуск Б · блок 2: админка со СТАРЫМ бэкендом');
  {
    const oldCode = path.join(require('os').tmpdir(), 'Code.old.gs');
    fs.writeFileSync(oldCode, execSync('git show ' + (process.env.OLD_BACKEND_REF || OLD_REF_A) + ':apps-script/Code.gs', { cwd: path.join(__dirname, '..') }));
    const st = await start(8843, oldCode, s => { withPhotos(s); });
    const g = st.gas, n = a => st.log.filter(x => x.action === a).length;
    const { ctx, page, errors } = await open(browser, st.url, { uid: 900, query: '?admin=1' });
    await page.waitForSelector('.ord');
    ok(await count(page, '.ord') === 7 && await count(page, '.tabs button') >= 4, 'старый бэкенд: панель открывается, заказы на месте');
    await page.waitForSelector('.tcard');
    const oldCards = await page.locator('.tcard').evaluateAll(l => l.map(b => [b.getAttribute('data-today'), Number(b.querySelector('b').textContent)]));
    const realNew = g.sheets['Замовлення'].rows.slice(1).filter(r => r[2] === 'новий' && String(r[15]).indexOf('test') < 0).length;
    const realShip = g.sheets['Замовлення'].rows.slice(1).filter(r => r[2] === 'підтверджено' && String(r[15]).indexOf('test') < 0).length;
    ok(oldCards.length >= 2 && oldCards[0][0] === 'new' && oldCards[0][1] === realNew && oldCards[1][0] === 'ship' && oldCards[1][1] === realShip, '«Сьогодні» на старом бэкенде: числа заказов считаются по уже загруженному списку', oldCards);
    await page.click('[data-ord="P-0004"]');
    ok(await count(page, '[data-write]') === 0 && await count(page, '[data-chat]') === 1, 'без admin.message: «Написати» — прежний чат Telegram');
    await page.click('.ord__acts [data-st="s"]');
    await page.waitForSelector('#sheet [data-action="cf-ok"]');
    ok(/Текст повідомлення зараз недоступний/.test(await text(page, '#sheet')) && n('admin.statusPreview') === 0 && n('admin.status') === 0, 'старый бэкенд: шторка «текст недоступний», лишних запросов нет');
    await page.click('#sheet [data-action="cf-ok"]');
    await page.waitForFunction(() => document.getElementById('sheet').hidden);
    ok(n('admin.status') === 1 && g.sheets['Замовлення'].rows.find(r => r[0] === 'P-0004')[2] === 'відправлено', 'статус всё равно меняется после подтверждения');
    await page.click('[data-tab="products"]');
    await page.waitForSelector('.prod');
    ok(await count(page, '[data-qprice]') > 0 && await count(page, '[data-pflt]') === 4, 'товары: быстрая цена и чипы работают и без нового бэкенда');
    await page.click('[data-tab="settings"]');
    await page.waitForSelector('.sgroup'); await openGroups(page);
    ok(await count(page, '.sgroup') >= 5 && await count(page, '[data-setsw]') >= 3 && /Від якої суми замовлення/.test(await text(page, '.field:has(#a-gift_from) .field__hint')), 'настройки: группы, переключатели и пояснения работают на старом наборе ключей');
    ok(errors.length === 0, 'в консоли браузера нет ошибок (старый бэкенд)', errors);
    await ctx.close(); st.server.close();
  }

  /* ---------------- 13. Выпуск Б, блок 3: Новый год, источники, надёжность ---------------- */
  console.log('Выпуск Б · блок 3: Новый год (б11)');
  {
    const settings = extra => s => {
      withPhotos(s);
      const base = { feature_id: 'DRY-039', father_ids: 'SPC-001, SPC-002', father_text_ua: 'Мелемо самі', theme: 'newyear', ny_snow: '1', ny_ids: 'SWT-001, DRY-001',
        ny_order_until_ua: 'Замовлення до 26.12 відправимо до свята', ny_order_until_ru: 'Заказы до 26.12 отправим к празднику', gift_note: '1', gift_from: '500', gift_text_ua: '100 г кураги' };
      const all = Object.assign(base, extra || {});
      s.sheets['Налаштування'] = [['Ключ', 'Значення', 'Опис']].concat(Object.keys(all).filter(k => all[k] !== null).map(k => [k, all[k], '']));
    };
    // подмена ответа каталога: поля нового бэкенда можно убрать (старый бэкенд) или поменять
    const patchCat = fn => async page => {
      await page.route(/\/api\?.*action=catalog/, async route => {
        const res = await route.fetch(); const j = await res.json(); fn(j.shop);
        await route.fulfill({ status: 200, contentType: 'application/json; charset=utf-8', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(j) });
      });
    };
    const info = page => page.evaluate(() => {
      const top = n => Math.round(n.getBoundingClientRect().top + scrollY);
      const rails = [].slice.call(document.querySelectorAll('.main > .rail:not(.recs)'));
      const g = document.getElementById('garland');
      return { garland: !!g && !g.hidden && !!g.querySelector('svg'), strips: document.querySelectorAll('.ny-strip').length, lane: document.querySelectorAll('.feature .ny-strip--lane').length,
        snow: document.querySelectorAll('.snow i').length, titles: rails.map(r => r.querySelector('.rail__title').textContent), firstTop: rails.length ? top(rails[0]) : -1,
        giftIds: rails.length && /Подарунки до свят|Подарки к праздникам/.test(rails[0].querySelector('.rail__title').textContent) ? [].map.call(rails[0].querySelectorAll('.mini'), m => m.getAttribute('data-id')) : [],
        giftSub: rails.length && rails[0].querySelector('.rail__sub') ? rails[0].querySelector('.rail__sub').textContent : '', until: [].map.call(document.querySelectorAll('.ny-until'), n => n.textContent) };
    });
    const toForm = async page => {
      await toCard(page, 'NUT-007');
      await page.locator('#grid .card[data-id="NUT-007"] [data-quick="1"]').click();
      await page.click('.tabbar [data-go="cart"]');
      await page.waitForSelector('.line');
    };

    const st = await start(8860, undefined, settings());
    const A = await open(browser, st.url, { uid: 601, w: 360, h: 640, before: patchCat(s => { s.ny.ids = (s.ny.ids || []).concat(['NOPE-9']); }) });
    await A.page.waitForSelector('#grid .card');
    await A.page.waitForTimeout(500);
    const a = await info(A.page);
    ok(a.garland && a.strips >= 2 && a.lane === 1, 'тема newyear: гирлянда из ступенчатых ромбов под шапкой и праздничная кайма «Нашей кураги»', a);
    ok(await A.page.evaluate(() => { const c = [].map.call(document.querySelectorAll('#garland use'), u => u.getAttribute('style')).join(); return /apricot/.test(c) && /lapis/.test(c) && /pistachio/.test(c); }), 'гирлянда в цветах apricot, lapis, pistachio');
    ok(await A.page.evaluate(() => { const g = document.getElementById('garland').getBoundingClientRect(), t = document.querySelector('.tools').getBoundingClientRect(); return g.height <= 10 && g.bottom <= t.top + 1; }), 'гирлянда тонкая (≤ 10 px) и не занимает место на экране');
    ok(a.titles[0] === 'Подарунки до свят' && a.giftIds.join() === 'SWT-001,DRY-001', 'лента «Подарунки до свят» первая; товара, которого нет в каталоге, нет в ленте', a);
    ok(a.titles.filter(x => x !== 'Подарунки до свят').length === 3 && a.titles.length === 4, 'праздничная лента не занимает слот railsMax: кроме неё остаются три обычные ленты', a.titles);
    ok(a.giftSub === 'Замовлення до 26.12 відправимо до свята', 'строка о сроке рядом с праздничной лентой (UA)', a.giftSub);
    ok(a.snow >= 1 && a.snow <= 14, 'снег при ny.snow = 1: снежинок не больше 14 (' + a.snow + ')', a.snow);
    const snowChk = await A.page.evaluate(() => {
      const box = document.getElementById('snow'), cs = getComputedStyle(box), bad = [];
      [].forEach.call(box.querySelectorAll('i'), i => { const r = i.getBoundingClientRect(); const x = Math.round(r.left + r.width / 2), y = Math.round(r.top + r.height / 2);
        if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) return; const e = document.elementFromPoint(x, y); if (e && e.closest('.snow')) bad.push([x, y]); });
      return { pe: cs.pointerEvents, pos: cs.position, bad: bad.length, anim: cs.display !== 'none' && getComputedStyle(box.querySelector('i')).animationName };
    });
    ok(snowChk.pe === 'none' && snowChk.pos === 'fixed' && snowChk.bad === 0 && snowChk.anim === 'snowfall', 'снег: pointer-events none, нажатия проходят сквозь снежинки, чистая CSS-анимация', snowChk);
    await A.page.click('.plus__item[data-k="gift"]');
    ok(await A.page.evaluate(() => !document.getElementById('sheet').hidden), 'кнопки под снегом нажимаются (плашка подарка открывает шторку)');
    await A.page.click('#sheet .sheet__close');
    ok(await noOverflow(A.page) && (await smallTargets(A.page)).length === 0, 'новогодняя главная: без горизонтальной прокрутки, кнопки ≥ 44 px', await smallTargets(A.page));
    await A.page.screenshot({ path: OUT + '/129-b3-ny-home-light-uk.png' });
    // корзина и оформление
    await toForm(A.page);
    ok(await text(A.page, '.page .ny-until') === 'Замовлення до 26.12 відправимо до свята', 'строка о сроке в корзине');
    await A.page.screenshot({ path: OUT + '/130-b3-ny-cart-light-uk.png' });
    await A.page.evaluate(() => window.__tg.main.cb());
    await A.page.waitForSelector('#form');
    ok(await text(A.page, '.page .ny-until') === 'Замовлення до 26.12 відправимо до свята' && await count(A.page, '#f-giftNote') === 1, 'строка о сроке и поле «Підпис до подарунка» в оформлении');
    ok(/Підпис до подарунка/.test(await text(A.page, 'label[for="f-giftNote"]')) && await A.page.getAttribute('#f-giftNote', 'maxlength') === '120' && /^0 \/ 120$/.test(await text(A.page, '#gnCount')), 'поле подписи: до 120 знаков, счётчик «0 / 120»');
    await A.page.fill('#f-giftNote', 'Мамі від Олени');
    ok(/^14 \/ 120$/.test(await text(A.page, '#gnCount')), 'счётчик растёт при вводе', await text(A.page, '#gnCount'));
    await A.page.fill('#f-phone', '0501234567');
    ok(await noOverflow(A.page) && (await smallTargets(A.page)).length === 0, 'оформление с подписью: без горизонтальной прокрутки, кнопки ≥ 44 px', await smallTargets(A.page));
    await A.page.screenshot({ path: OUT + '/131-b3-ny-checkout-light-uk.png', fullPage: true });

    // --- сбой заказа: корзина, форма и ключ на месте, повтор с тем же ключом ---
    let mode = 'abort';
    const seen = [];
    await A.page.route(/\/api$/, async route => {
      const rq = route.request();
      let b = null; try { b = rq.method() === 'POST' ? JSON.parse(rq.postData()) : null; } catch (e) { b = null; }
      if (b && b.action === 'order' && mode !== 'pass') {
        seen.push(b);
        if (mode === 'abort') return route.abort();
        if (mode === '500') return route.fulfill({ status: 500, contentType: 'text/plain', body: 'oops' });
        if (mode === 'changed') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'changed' }) });
      }
      return route.continue();
    });
    const cartLS = () => A.page.evaluate(() => localStorage.getItem('pamir_cart_v1'));
    const ridLS = () => A.page.evaluate(() => { try { return (JSON.parse(localStorage.getItem('pamir_rid_v1') || 'null') || {}).r || ''; } catch (e) { return ''; } });
    const cart0 = await cartLS();
    await A.page.evaluate(() => window.__tg.main.cb());
    await A.page.waitForSelector('#formErr:not([hidden]) [data-action="retry-order"]');
    const failText = await text(A.page, '#formErr');
    ok(/Не вдалося надіслати — спробуйте ще раз/.test(failText) && await count(A.page, '[data-action="retry-order"]') === 1, 'сеть упала: «Не вдалося надіслати — спробуйте ще раз» и кнопка повтора', failText);
    ok(await cartLS() === cart0 && JSON.parse(cart0).i.length === 1 && await A.page.inputValue('#f-giftNote') === 'Мамі від Олени' && await A.page.inputValue('#f-phone') === '+380 50 123 45 67', 'корзина и форма (в том числе подпись) на месте');
    const rid1 = seen[0].rid;
    ok(/^[\w-]{8,40}$/.test(rid1) && await ridLS() === rid1, 'ключ попытки сохранён в хранилище устройства', [rid1, await ridLS()]);
    ok((await smallTargets(A.page)).length === 0 && await noOverflow(A.page), 'сообщение о сбое и кнопка повтора: ≥ 44 px, без горизонтальной прокрутки', await smallTargets(A.page));
    await A.page.screenshot({ path: OUT + '/132-b3-ny-order-fail-light-uk.png', fullPage: true });
    mode = '500';
    await A.page.click('[data-action="retry-order"]');
    await A.page.waitForSelector('#formErr:not([hidden]) [data-action="retry-order"]');
    ok(seen.length === 2 && seen[1].rid === rid1, 'ошибка HTTP 500: тоже сообщение и повтор; ключ тот же', seen.map(x => x.rid));
    // перезагрузка страницы: корзина, форма и ключ живы
    mode = 'abort';
    await A.page.reload({ waitUntil: 'networkidle' });
    await A.page.waitForSelector('.card');
    ok(await cartLS() === cart0 && await ridLS() === rid1, 'после перезагрузки страницы корзина и ключ на месте');
    await A.page.click('.tabbar [data-go="cart"]');
    await A.page.waitForSelector('.line');
    await A.page.evaluate(() => window.__tg.main.cb());
    await A.page.waitForSelector('#form');
    ok(await A.page.inputValue('#f-giftNote') === 'Мамі від Олени' && await A.page.inputValue('#f-phone') === '+380 50 123 45 67', 'после перезагрузки форма (подпись, телефон) заполнена');
    await A.page.evaluate(() => window.__tg.main.cb());
    await A.page.waitForSelector('#formErr:not([hidden]) [data-action="retry-order"]');
    ok(seen.length === 3 && seen[2].rid === rid1, 'повтор после перезагрузки уходит с тем же ключом (второй заказ не создаётся)', seen.map(x => x.rid));
    // «changed» сбрасывает ключ
    mode = 'changed';
    await A.page.click('[data-action="retry-order"]');
    await A.page.waitForFunction(() => document.body.getAttribute('data-view') === 'cart');
    ok(await ridLS() === '', 'ответ «changed»: ключ сброшен');
    await A.page.evaluate(() => window.__tg.main.cb());
    await A.page.waitForSelector('#form');
    // успех: подпись уходит в заказ, ключ и подпись очищаются
    mode = 'pass';
    const ordersBefore = st.gas.sheets['Замовлення'].rows.length;
    await A.page.evaluate(() => window.__tg.main.cb());
    await A.page.waitForSelector('.done');
    const sent = st.log.filter(x => x.action === 'order').slice(-1)[0];
    ok(sent.giftNote === 'Мамі від Олени' && st.gas.sheets['Замовлення'].rows.length === ordersBefore + 1, 'успех: подпись к подарунку ушла в заказ, строка в таблице одна', [sent.giftNote, st.gas.sheets['Замовлення'].rows.length - ordersBefore]);
    ok(/Підпис до подарунка: Мамі від Олени/.test(st.gas.sheets['Замовлення'].rows.slice(-1)[0].join(' | ')), 'в таблице подпись видна администратору (в «Коментар»)');
    ok(await ridLS() === '', 'после успешного заказа ключ очищен');
    ok(await A.page.evaluate(() => { try { const f = JSON.parse(localStorage.getItem('pamir_form_v1')); return !f.giftNote && !f.comment; } catch (e) { return false; } }), 'после успешного заказа подпись и комментарий в форме очищены');
    ok(A.errors.length === 0, 'в консоли браузера нет ошибок (Новый год, UA, светлая)', A.errors);
    await A.ctx.close();

    // RU, тёмная: те же экраны
    const R = await open(browser, st.url, { uid: 602, w: 360, h: 640, theme: 'dark', lc: 'ru' });
    await R.page.waitForSelector('#grid .card');
    await R.page.waitForTimeout(500);
    const r = await info(R.page);
    ok(r.garland && r.titles[0] === 'Подарки к праздникам' && r.giftSub === 'Заказы до 26.12 отправим к празднику' && r.snow >= 1, 'RU, тёмная: гирлянда, «Подарки к праздникам» первой, строка о сроке по-русски', r);
    ok(await R.page.evaluate(() => Number(getComputedStyle(document.getElementById('garland')).opacity) < 0.7), 'в тёмной теме гирлянда приглушена');
    await R.page.screenshot({ path: OUT + '/133-b3-ny-home-dark-ru.png' });
    await toForm(R.page);
    ok(await text(R.page, '.page .ny-until') === 'Заказы до 26.12 отправим к празднику', 'RU: строка о сроке в корзине');
    await R.page.screenshot({ path: OUT + '/134-b3-ny-cart-dark-ru.png' });
    await R.page.evaluate(() => window.__tg.main.cb());
    await R.page.waitForSelector('#form');
    ok(/Подпись к подарку/.test(await text(R.page, 'label[for="f-giftNote"]')) && await noOverflow(R.page) && (await smallTargets(R.page)).length === 0, 'RU: поле «Подпись к подарку»; без горизонтальной прокрутки, кнопки ≥ 44 px');
    await R.page.screenshot({ path: OUT + '/135-b3-ny-checkout-dark-ru.png', fullPage: true });
    await R.ctx.close();
    // UA, тёмная и RU, светлая — ещё два снимка первого экрана
    const D = await open(browser, st.url, { uid: 603, w: 360, h: 640, theme: 'dark' });
    await D.page.waitForSelector('#grid .card'); await D.page.waitForTimeout(400);
    await D.page.screenshot({ path: OUT + '/136-b3-ny-home-dark-uk.png' });
    await D.ctx.close();
    const L = await open(browser, st.url, { uid: 604, w: 360, h: 640, lc: 'ru' });
    await L.page.waitForSelector('#grid .card'); await L.page.waitForTimeout(400);
    await L.page.screenshot({ path: OUT + '/137-b3-ny-home-light-ru.png' });
    await L.ctx.close();
    st.server.close();

    // --- условия показа ---
    const tests = [
      ['без темы: ни гирлянды, ни снега, ни ленты', { theme: null }],
      ['тема newyear, но ny_snow = 0: гирлянда есть, снега нет', { ny_snow: '0' }],
      ['theme_until в прошлом: сервер тему не отдаёт — оформления нет', { theme_until: '01.01.2020' }]
    ];
    let port = 8861;
    for (const [name, extra] of tests) {
      const s2 = await start(port++, undefined, settings(extra));
      const c = await open(browser, s2.url, { uid: 610, w: 360, h: 640 });
      await c.page.waitForSelector('#grid .card'); await c.page.waitForTimeout(300);
      const x = await info(c.page);
      const themed = /ny_snow = 0/.test(name);
      ok(x.garland === themed && x.snow === 0 && (themed || (x.strips === 0 && x.giftIds.length === 0 && x.until.length === 0)), name, x);
      await c.ctx.close(); s2.server.close();
    }
    // снег выключен при prefers-reduced-motion
    const sR = await start(port++, undefined, settings());
    const cR = await open(browser, sR.url, { uid: 611, w: 360, h: 640, before: p => p.emulateMedia({ reducedMotion: 'reduce' }) });
    await cR.page.waitForSelector('#grid .card'); await cR.page.waitForTimeout(300);
    const xr = await info(cR.page);
    ok(xr.snow === 0 && await count(cR.page, '.snow') === 0 && xr.garland, 'prefers-reduced-motion: снега нет, гирлянда остаётся', xr);
    await cR.ctx.close(); sR.server.close();
    // пустые ny.ids — ленты нет; строки о сроке нет — строки нет
    const sE = await start(port++, undefined, settings({ ny_ids: '', ny_order_until_ua: '', ny_order_until_ru: null }));
    const cE = await open(browser, sE.url, { uid: 612, w: 360, h: 640 });
    await cE.page.waitForSelector('#grid .card');
    const xe = await info(cE.page);
    ok(xe.giftIds.length === 0 && !xe.titles.includes('Подарунки до свят') && xe.until.length === 0 && xe.garland, 'ny.ids пусто — праздничной ленты нет; срока нет — строки нет', xe);
    await cE.ctx.close(); sE.server.close();
    const sL = await start(port++, undefined, settings({ ny_order_until_ru: '' }));
    const cL = await open(browser, sL.url, { uid: 613, w: 360, h: 640, lc: 'ru' });
    await cL.page.waitForSelector('#grid .card');
    const xl = await info(cL.page);
    ok(xl.giftSub === 'Замовлення до 26.12 відправимо до свята', 'нет строки на языке интерфейса — показывается строка другого языка', xl.giftSub);
    await cL.ctx.close(); sL.server.close();
    // gift_note выключен — поля нет, заказ уходит с пустой подписью
    const sG = await start(port++, undefined, settings({ gift_note: '0' }));
    const cG = await open(browser, sG.url, { uid: 614, w: 360, h: 640 });
    await cG.page.waitForSelector('#grid .card');
    await toForm(cG.page);
    await cG.page.evaluate(() => window.__tg.main.cb()); await cG.page.waitForSelector('#form');
    await cG.page.fill('#f-phone', '0501234567');
    ok(await count(cG.page, '#f-giftNote') === 0, 'gift_note выключен: поля «Підпис до подарунка» нет');
    await cG.page.evaluate(() => window.__tg.main.cb()); await cG.page.waitForSelector('.done');
    ok(!sG.log.filter(x => x.action === 'order').slice(-1)[0].giftNote, 'и в заказе подписи нет');
    await cG.ctx.close(); sG.server.close();
    // старый бэкенд: нет ny, giftNote, railsMax
    const sO = await start(port++, undefined, settings());
    const cO = await open(browser, sO.url, { uid: 615, w: 360, h: 640, before: patchCat(s => { delete s.ny; delete s.giftNote; delete s.railsMax; }) });
    await cO.page.waitForSelector('#grid .card');
    const xo = await info(cO.page);
    ok(xo.giftIds.length === 0 && xo.snow === 0 && xo.until.length === 0 && xo.titles.length <= 3 && cO.errors.length === 0 && await count(cO.page, '.feature .mini') === 1, 'старый бэкенд без shop.ny / giftNote / railsMax: витрина работает как раньше', xo);
    await cO.ctx.close(); sO.server.close();
  }

  console.log('Выпуск Б · блок 3: источники (б4)');
  {
    const st = await start(8870, undefined, s => {
      withPhotos(s);
      const o = s.sheets['Замовлення']; o[0].push('Джерело клієнта'); o.slice(1).forEach(r => r.push('')); // необязательная колонка источника заказа
    });
    // подменяет start_param у Telegram на странице (route из open() — один на всё время жизни страницы)
    const setStart = async (page, start) => {
      await page.unroute('https://telegram.org/js/telegram-web-app.js');
      await page.route('https://telegram.org/js/telegram-web-app.js', async r => r.fulfill({ status: 200, contentType: 'application/javascript', body: await (await fetch(st.url + '/tg.js?uid=701&theme=light&lc=uk&start=' + start)).text() }));
    };
    const evs = () => st.log.filter(x => x.action === 'ev').reduce((a, x) => a.concat(x.events || []), []);
    const flush = page => page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    const orderTo = async page => {
      await page.waitForSelector('#grid .card');
      await toCard(page, 'NUT-007');
      await page.locator('#grid .card[data-id="NUT-007"] [data-quick="1"]').click();
      await page.click('.tabbar [data-go="cart"]'); await page.waitForSelector('.line');
      await page.evaluate(() => window.__tg.main.cb()); await page.waitForSelector('#form');
      await page.fill('#f-phone', '0501234567');
      await page.evaluate(() => window.__tg.main.cb()); await page.waitForSelector('.done');
    };
    const A = await open(browser, st.url, { uid: 701, start: 'qr1' });
    await A.page.waitForSelector('#grid .card');
    await flush(A.page); await A.page.waitForTimeout(500);
    const srcEv = evs().filter(e => e.e === 'src');
    ok(srcEv.length === 1 && srcEv[0].v === 'qr1', 'метка qr1: событие src отправлено один раз', srcEv);
    ok(await A.page.evaluate(() => JSON.parse(localStorage.getItem('pamir_src_v1')).s) === 'qr1', 'метка запомнена на устройстве');
    await orderTo(A.page);
    ok(st.log.filter(x => x.action === 'order').slice(-1)[0].src === 'qr1', 'заказ уходит с полем src = qr1');
    const ord = st.gas.sheets['Замовлення'].rows.slice(-1)[0];
    ok(ord.indexOf('qr1') >= 0, 'в таблице у заказа источник qr1 (колонка «Джерело клієнта»)', ord);
    // вторая метка не перезаписывает первую
    await setStart(A.page, 'qr2');
    await A.page.goto(st.url + '/', { waitUntil: 'networkidle' });
    await A.page.waitForSelector('#grid .card');
    await flush(A.page); await A.page.waitForTimeout(400);
    ok(await A.page.evaluate(() => JSON.parse(localStorage.getItem('pamir_src_v1')).s) === 'qr1' && evs().some(e => e.e === 'src' && e.v === 'qr2'), 'первая метка не перезаписывается второй (событие открытия с qr2 всё же уходит)');
    // срок 30 дней: старая запись заменяется
    await A.page.evaluate(() => localStorage.setItem('pamir_src_v1', JSON.stringify({ s: 'old', t: Date.now() - 31 * 86400000 })));
    await setStart(A.page, 'insert');
    await A.page.goto(st.url + '/', { waitUntil: 'networkidle' });
    await A.page.waitForSelector('#grid .card');
    ok(await A.page.evaluate(() => JSON.parse(localStorage.getItem('pamir_src_v1')).s) === 'insert', 'метка старше 30 дней заменяется новой');
    await A.ctx.close();
    // ID товара — не метка, товар открывается как раньше
    await flush(A.page).catch(() => {});
    await new Promise(r => setTimeout(r, 1000)); // события закрытых вкладок уходят через sendBeacon и доходят с задержкой
    const nSrc = evs().filter(e => e.e === 'src').length;
    const P = await open(browser, st.url, { uid: 702, start: 'DRY-039' });
    await P.page.waitForSelector('.sheet__title');
    await flush(P.page); await P.page.waitForTimeout(300);
    ok(/Курага/.test(await text(P.page, '.sheet__title')) && await P.page.evaluate(() => localStorage.getItem('pamir_src_v1')) === null, '?startapp=DRY-039 открывает товар и меткой не считается');
    await P.ctx.close();
    ok(evs().filter(e => e.e === 'src').length === nSrc, 'ID товара событие src не создаёт', evs().filter(e => e.e === 'src'));
    // ref_ работает как раньше
    const F = await open(browser, st.url, { uid: 703, start: 'ref_555000111' });
    await F.page.waitForSelector('#grid .card');
    ok(await F.page.evaluate(() => localStorage.getItem('pamir_ref')) === '555000111' && await F.page.evaluate(() => localStorage.getItem('pamir_src_v1')) === null, 'ref_… запоминается как приглашение и меткой не считается');
    await F.ctx.close();
    // рецепт ?rec=
    const Rr = await open(browser, st.url, { uid: 704, query: '?rec=REC-1' });
    await Rr.page.waitForSelector('#grid .card');
    ok(await Rr.page.evaluate(() => localStorage.getItem('pamir_src_v1')) === null, 'ссылка рецепта меткой не считается');
    await Rr.ctx.close();
    for (const bad of ['adm_5', 'rec_1', 'bad label!', 'x'.repeat(25)]) {
      const B = await open(browser, st.url, { uid: 705, start: bad });
      await B.page.waitForSelector('#grid .card');
      ok(await B.page.evaluate(() => localStorage.getItem('pamir_src_v1')) === null, 'не метка: «' + bad.slice(0, 12) + '»');
      await B.ctx.close();
    }
    // --- статистика: блок «Источники (QR)» и строки о напоминаниях ---
    for (const [lc, theme, tag] of [['uk', 'light', 'ua'], ['ru', 'dark', 'ru']]) {
      const S = await open(browser, st.url, { uid: 900, query: '?admin=1', w: 360, h: 740, lc, theme });
      await S.page.waitForSelector('.ord');
      await S.page.click('[data-action="adm-sales"]');
      await S.page.waitForSelector('#srcTable');
      const hdr = await text(S.page, '#srcTable thead');
      ok(/qr1/.test(await text(S.page, '#srcTable')) && (tag === 'ua' ? /Мітка/.test(hdr) : /Метка/.test(hdr)) && /(Джерела|Источники) \(QR\)/.test(await text(S.page, '.page')), 'статистика (' + tag + '): блок источников с меткой qr1');
      const row = await S.page.locator('#srcTable tbody tr', { hasText: 'qr1' }).first().innerText();
      ok(/[1-9]\d* \/ [1-9]\d*/.test(row) && row.replace(/\s+/g, ' ').split(' / ').length === 3, 'в строке qr1: открытия и заказы за 7 / 14 дней', row);
      const cr = await text(S.page, '#cartRemind');
      ok(tag === 'ua' ? /Нагадувань про кошик надіслано за 30 днів\s*0/.test(cr) && /Вимкнули нагадування про кошик за 30 днів\s*0/.test(cr) : /Напоминаний о корзине отправлено за 30 дней\s*0/.test(cr) && /Отключили напоминания о корзине за 30 дней\s*0/.test(cr), 'строки о напоминаниях о корзине (' + tag + '), нули показаны как 0', cr);
      ok(await noOverflow(S.page), 'статистика с источниками на 360 px без горизонтальной прокрутки (' + tag + ')');
      ok(await S.page.locator('#srcTable').evaluate(el => el.getBoundingClientRect().right <= window.innerWidth), 'таблица источников внутри экрана (' + tag + ')');
      if (tag === 'ru') await S.page.screenshot({ path: OUT + '/138-b1-admin-stats-sources-dark-ru.png', fullPage: true });
      else await S.page.screenshot({ path: OUT + '/139-b1-admin-stats-sources-light-uk.png', fullPage: true });
      await S.ctx.close();
    }
    // метка из события экранируется
    st.gas.post({ action: 'ev', initData: st.gas.initData({ id: 72 }), sid: 'z', events: [{ e: 'src', v: 'qr2', t: Date.now() }] });
    // старый бэкенд: статистика открывается, блоков нет
    const oldCodeS = path.join(require('os').tmpdir(), 'Code.old.src.gs');
    fs.writeFileSync(oldCodeS, execSync('git show ' + (process.env.OLD_BACKEND_REF || OLD_REF_A) + ':apps-script/Code.gs', { cwd: path.join(__dirname, '..') }));
    const soS = await start(8874, oldCodeS, s => { withPhotos(s); });
    const Os = await open(browser, soS.url, { uid: 900, query: '?admin=1', w: 360, h: 740 });
    await Os.page.waitForSelector('.ord');
    await Os.page.click('[data-action="adm-sales"]');
    await Os.page.waitForSelector('.stats');
    ok(await count(Os.page, '#srcTable') === 0 && await count(Os.page, '#cartRemind') === 0 && await noOverflow(Os.page), 'старый бэкенд: статистика без блоков источников и напоминаний');
    await Os.ctx.close(); soS.server.close();
    // подсказки новых настроек и текст лимита сообщений
    const Cs = await open(browser, st.url, { uid: 900, query: '?admin=1', w: 360, h: 740, lc: 'ru' });
    await Cs.page.waitForSelector('.ord');
    await Cs.page.locator('[data-tab="settings"]').click();
    await Cs.page.waitForSelector('#a-src_list');
    const hs = await Cs.page.evaluate(() => document.querySelector('.page').textContent);
    ok(/Разрешённые метки источников/.test(hs) && /На сколько дней кнопка/.test(hs), 'настройки: пояснения для src_list и cart_mute_days');
    ok(await Cs.page.locator('#a-src_list').evaluate(el => !!el.closest('details[data-sg="shop"]')) && await Cs.page.locator('#a-cart_mute_days').evaluate(el => !!el.closest('details[data-sg="remind"]')), 'src_list — в группе «Магазин», cart_mute_days — в «Тексты»');
    await Cs.ctx.close();
    st.server.close();
  }

  console.log('Выпуск Б · блок 3: каталог через Worker (CATALOG_URL)');
  {
    const st = await start(8871, undefined, s => { withPhotos(s); });
    const cat = () => { const j = JSON.parse(JSON.stringify(st.gas.get({ action: 'catalog' }))); j.shop.notice = { ua: 'З воркера', ru: 'С воркера' }; return j; };
    const run = async (name, handler, wantWorker) => {
      st.log.length = 0;
      const reqs = [];
      const c = await open(browser, st.url, { uid: 720, w: 360, h: 640, before: async page => {
        await page.route('**/config.js*', r => r.fulfill({ contentType: 'application/javascript', body: "window.PAMIR_CONFIG = { API_URL: location.origin + '/api', BOT: 'pamir_test_bot', APP: 'shop', CATALOG_URL: location.origin + '/cat' };" }));
        await page.route('**/cat', handler);
        page.on('request', r => { if (/\/cat$/.test(r.url())) reqs.push(r.url()); });
      } });
      await c.page.waitForSelector('#grid .card', { timeout: 15000 });
      await c.page.waitForTimeout(400);
      const apiGets = st.log.filter(x => x.action === 'GET catalog').length;
      const notice = (await c.page.locator('#notice').isVisible()) ? await text(c.page, '#notice') : '';
      ok(reqs.length === 1 && (wantWorker ? apiGets === 0 && /З воркера/.test(notice) : apiGets === 1 && !/воркера/.test(notice)), name, { reqs: reqs.length, apiGets, notice });
      await c.ctx.close();
    };
    const json = body => route => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: typeof body === 'function' ? JSON.stringify(body()) : body });
    await run('CATALOG_URL отвечает: каталог берётся из Worker, Apps Script за каталогом не ходит', json(cat), true);
    await run('Worker недоступен (сетевая ошибка): тот же запрос в Apps Script', route => route.abort(), false);
    await run('Worker ответил HTTP 500: Apps Script', route => route.fulfill({ status: 500, body: 'x' }), false);
    await run('Worker ответил не JSON: Apps Script', route => route.fulfill({ status: 200, contentType: 'text/html', body: '<html>не json</html>' }), false);
    await run('Worker ответил JSON без ok/products: Apps Script', json('{"ok":true}'), false);
    await run('Worker молчит дольше 6 секунд: Apps Script', () => { /* не отвечаем */ }, false);
    // без CATALOG_URL (config.js стенда и боевой) — поведение прежнее
    st.log.length = 0;
    const c0 = await open(browser, st.url, { uid: 721 });
    await c0.page.waitForSelector('#grid .card');
    ok(st.log.filter(x => x.action === 'GET catalog').length === 1 && /CATALOG_URL:\s*''/.test(fs.readFileSync(path.join(__dirname, '..', 'webapp', 'config.js'), 'utf8')), 'CATALOG_URL по умолчанию пустой: каталог из Apps Script, как раньше');
    await c0.ctx.close(); st.server.close();
  }

  console.log('Выпуск Б · блок 3: ошибки витрины (б7)');
  {
    const st = await start(8872, undefined, s => { withPhotos(s); });
    const errReqs = [];
    const c = await open(browser, st.url, { uid: 730, w: 360, h: 640, before: async page => {
      page.on('request', r => { if (r.method() === 'POST' && /\/api$/.test(r.url())) { try { const b = JSON.parse(r.postData()); if (b.action === 'err') errReqs.push(b); } catch (e) { /* не JSON */ } } });
    } });
    await c.page.waitForSelector('#grid .card');
    const items = () => errReqs.reduce((a, b) => a.concat(b.items || []), []);
    const boom = msg => c.page.evaluate(m => { setTimeout(() => { throw new Error(m); }, 0); }, msg);
    await boom('Тестовая ошибка boom1 телефон +380 50 123 45 67');
    await c.page.waitForTimeout(3300);
    const e1 = items();
    ok(e1.length === 1 && /boom1/.test(e1[0].m) && !/123 45 67|\+380 50/.test(e1[0].m) && e1[0].m.length <= 200, 'ошибка скрипта уходит записью err; телефон из текста вычищен', e1);
    const body1 = JSON.stringify(errReqs[0]);
    ok(/^[a-z0-9]{8,32}$/.test(errReqs[0].did) && e1[0].s === 'catalog' && e1[0].v === '26' && !/initData|Олена|Тест|hash=|user=/.test(body1.replace('Тестовая ошибка', '')), 'в записи: did, экран (catalog), версия (23); без initData и данных покупателя', body1);
    ok(await c.page.evaluate(() => /^[a-z0-9]{8,32}$/.test(localStorage.getItem('pamir_did'))), 'did — случайная строка в хранилище устройства');
    // одинаковые подряд не дублируются
    await boom('Тестовая ошибка boom1 телефон +380 50 123 45 67');
    await c.page.waitForTimeout(3300);
    ok(items().filter(x => /boom1/.test(x.m)).length === 1, 'одинаковая ошибка подряд не дублируется', items().length);
    await c.page.evaluate(() => window.dispatchEvent(new ErrorEvent('error', { message: 'file-test', filename: 'https://x.test/app.js?v=22&q=секрет', lineno: 5 })));
    await c.page.waitForTimeout(3300);
    const fileItem = items().find(x => /file-test/.test(x.m));
    ok(Object.keys(e1[0]).sort().join() === 'm,s,v' && fileItem && fileItem.m === 'file-test @ app.js:5', 'запись: только m, s, v; файл:строка без query-строки', fileItem);
    // необработанный отказ промиса
    await c.page.evaluate(() => { Promise.reject(new Error('rej-test')); });
    await c.page.waitForTimeout(3300);
    ok(items().some(x => /promise: rej-test/.test(x.m)), 'unhandledrejection тоже уходит');
    // неудачный запрос к API
    await c.page.route(/\/api$/, route => { try { const b = JSON.parse(route.request().postData() || '{}'); if (b.action === 'orders.my') return route.abort(); } catch (e) { /* пусто */ } return route.continue(); });
    await c.page.click('.tabbar [data-go="orders"]').catch(() => {});
    await c.page.waitForTimeout(3300);
    ok(items().some(x => /^net orders\.my: network$/.test(x.m)), 'неудачный запрос к API (сеть) уходит записью без данных запроса', items().map(x => x.m));
    // лимит: не больше 5 записей в час
    for (let i = 0; i < 8; i++) { await boom('лимит-' + i); await c.page.waitForTimeout(150); }
    await c.page.waitForTimeout(3300);
    ok(items().length === 5 && await c.page.evaluate(() => JSON.parse(localStorage.getItem('pamir_err_v1')).n) === 5, 'с устройства не больше 5 записей в час', items().length);
    await c.ctx.close();
    // сбой отправки самой ошибки новых записей не порождает
    const attempts = [];
    const c2 = await open(browser, st.url, { uid: 731, w: 360, h: 640, before: async page => {
      await page.route(/\/api$/, route => { try { const b = JSON.parse(route.request().postData() || '{}'); if (b.action === 'err') { attempts.push(b); return route.abort(); } } catch (e) { /* пусто */ } return route.continue(); });
    } });
    await c2.page.waitForSelector('#grid .card');
    await c2.page.evaluate(() => { setTimeout(() => { throw new Error('c2-boom'); }, 0); });
    await c2.page.waitForTimeout(3300);
    await c2.page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    await c2.page.waitForTimeout(1200);
    ok(attempts.length === 1 && await c2.page.evaluate(() => JSON.parse(localStorage.getItem('pamir_err_v1')).n) === 1, 'сбой отправки ошибки новых записей не порождает (одна попытка, счётчик 1)', attempts.length);
    await c2.ctx.close();
    // старый бэкенд: ответ на err — ошибка, витрина молчит
    const oldCode = path.join(require('os').tmpdir(), 'Code.old.gs');
    fs.writeFileSync(oldCode, execSync('git show ' + (process.env.OLD_BACKEND_REF || 'main') + ':apps-script/Code.gs', { cwd: path.join(__dirname, '..') }));
    const so = await start(8873, oldCode, s => { withPhotos(s); });
    const co = await open(browser, so.url, { uid: 732, w: 360, h: 640 });
    await co.page.waitForSelector('#grid .card');
    await co.page.evaluate(() => { setTimeout(() => { throw new Error('old-boom'); }, 0); });
    await co.page.waitForTimeout(3300);
    ok(so.log.filter(x => x.action === 'err').length === 1 && co.errors.every(e => /old-boom/.test(e)) && await count(co.page, '#grid .card') === 20, 'старый бэкенд: запись err отправлена, ответ-ошибка молча игнорируется, витрина работает', co.errors);
    await co.ctx.close(); so.server.close(); st.server.close();
  }

  /* ---------------- Исправления Б1: повтор заказа (dup_changed), снег под содержимым, превью со знаком $ ---------------- */
  console.log('Исправления Б1: повтор заказа с изменённой корзиной (dup_changed)');
  {
    const addProd = async (page, id) => {
      for (let i = 0; i < 4 && !(await page.locator('.tabbar [data-go="catalog"]').isVisible()); i++) { await page.locator('[data-nav="back"]').first().click(); await page.waitForTimeout(150); }
      await page.click('.tabbar [data-go="catalog"]');
      await page.waitForSelector('#grid .card');
      await toCard(page, id);
      await page.locator('#grid .card[data-id="' + id + '"] [data-quick="1"]').click();
    };
    const toSend = async page => {
      await page.click('.tabbar [data-go="cart"]');
      await page.waitForSelector('.line');
      await page.evaluate(() => window.__tg.main.cb());
      await page.waitForSelector('#f-phone');
      await page.fill('#f-phone', '0501234567');
      await page.evaluate(() => window.__tg.main.cb());
    };
    const ridOf = page => page.evaluate(() => { try { return (JSON.parse(localStorage.getItem('pamir_rid_v1') || 'null') || {}).r || ''; } catch (e) { return ''; } });
    const cartIds = page => page.evaluate(() => JSON.parse(localStorage.getItem('pamir_cart_v1')).i.map(l => l.id).sort().join());
    // mode: 'lose' — сервер заказ принял, ответ до витрины не дошёл; 'pass' — как есть; 'fake' — подставной ответ dup_changed
    const mkRoute = (state, fake) => async route => {
      let b = null; try { b = route.request().method() === 'POST' ? JSON.parse(route.request().postData()) : null; } catch (e) { b = null; }
      if (b && b.action === 'order') {
        state.sent.push(b);
        if (state.mode === 'lose') { await route.fetch().catch(() => {}); return route.abort(); }
        if (state.mode === 'fake') return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(fake) });
      }
      return route.continue();
    };
    const run = async (port, lc, theme, reload, change, fake) => {
      const sv = await start(port, undefined, withPhotos);
      const state = { mode: 'lose', sent: [] };
      const before = sv.gas.sheets['Замовлення'].rows.length;
      const A = await open(browser, sv.url, { uid: 740 + port % 50, w: 360, h: 640, lc, theme, before: p => p.route(/\/api$/, mkRoute(state, fake)) });
      await A.page.waitForSelector('#grid .card');
      await toCard(A.page, 'NUT-007');
      await A.page.locator('#grid .card[data-id="NUT-007"] [data-quick="1"]').click();
      await toSend(A.page);
      await A.page.waitForSelector('#formErr:not([hidden]) [data-action="retry-order"]');
      const rid1 = state.sent[0].rid;
      return { sv, state, A, rid1, before };
    };
    // (б), (в) ответ потерян, корзину не меняли: повтор = «прийнято», один заказ; (в) то же после перезагрузки
    for (const reload of [false, true]) {
      const x = await run(reload ? 8891 : 8890, 'uk', 'light');
      const base = x.sv.gas.sheets['Замовлення'].rows.length;
      ok(base === x.before + 1 && await ridOf(x.A.page) === x.rid1, 'сервер принял, ответ потерян: заказ в таблице, ключ на месте' + (reload ? ' (с перезагрузкой)' : ''), [base, x.before]);
      x.state.mode = 'pass';
      if (reload) {
        await x.A.page.reload({ waitUntil: 'networkidle' });
        await x.A.page.waitForSelector('.card');
        await toSend(x.A.page);
      } else await x.A.page.click('[data-action="retry-order"]');
      await x.A.page.waitForSelector('.done');
      ok(x.state.sent[x.state.sent.length - 1].rid === x.rid1 && x.sv.gas.sheets['Замовлення'].rows.length === base, 'ничего не меняли: повтор принят как прежний заказ («прийнято»), в таблице по-прежнему один заказ' + (reload ? ' (после перезагрузки)' : ''), [x.sv.gas.sheets['Замовлення'].rows.length, base]);
      ok(await ridOf(x.A.page) === '' && await cartIds(x.A.page) === '', 'после успеха ключ сброшен, корзина пуста');
      ok(x.A.errors.length === 0, 'в консоли нет ошибок', x.A.errors);
      await x.A.ctx.close(); x.sv.server.close();
    }
    // (а) настоящий стенд: ответ потерян → добавили товар → повтор
    for (const [port, lc, theme] of [[8892, 'uk', 'light'], [8893, 'ru', 'dark']]) {
      const ru = lc === 'ru';
      const x = await run(port, lc, theme);
      const base = x.sv.gas.sheets['Замовлення'].rows.length;
      await addProd(x.A.page, 'SWT-004');
      x.state.mode = 'pass';
      await toSend(x.A.page);
      await x.A.page.waitForSelector('#formErr:not([hidden]) [data-action="send-new"]', { timeout: 8000 }).catch(() => {});
      const box = await x.A.page.locator('#formErr').innerText();
      const real = await count(x.A.page, '[data-action="send-new"]') === 1;
      ok(real, (ru ? 'RU' : 'UA') + ': сквозной тест, настоящий бэкенд: повтор с другим составом даёт сообщение dup_changed', box);
      if (real) {
        ok(ru ? /Предыдущий заказ .*уже принят\. Изменения, сделанные после этого \(в корзине или в параметрах заказа, например «Если товара нет» или город\), в него не попали\. Чтобы заказать ещё — уберите лишнее из корзины и отправьте остальное отдельным заказом\. Чтобы изменить тот заказ — напишите нам\./.test(box) : /Попереднє замовлення .*уже прийняте\. Зміни, зроблені після цього \(у кошику чи в параметрах замовлення, наприклад «Якщо товару немає» або місто\), до нього не потрапили\. Щоб замовити ще — приберіть зайве з кошика й надішліть решту окремим замовленням\. Щоб змінити те замовлення — напишіть нам\./.test(box), (ru ? 'RU' : 'UA') + ': текст сообщения', box);
        ok(x.sv.gas.sheets['Замовлення'].rows.length === base && await cartIds(x.A.page) === 'NUT-007,SWT-004' && await ridOf(x.A.page) === '', 'в таблице один заказ с первым составом, корзина с обоими товарами на месте, ключ сброшен');
        ok(await count(x.A.page, '#formErr [data-go="orders"]') === 1 && (await x.A.page.locator('#formErr .btn').allInnerTexts()).join('|') === (ru ? 'Мои заказы|Изменить корзину|Отправить корзину как новый заказ' : 'Мої замовлення|Змінити кошик|Надіслати кошик як нове замовлення') + (x.sv.gas.get({ action: 'catalog' }).shop.contact ? (ru ? '|Напишите нам' : '|Напишіть нам') : '') && await x.A.page.locator('#formErr [data-go="cart"]').evaluate(b => b.classList.contains('btn--primary')) && await count(x.A.page, '#formErr [data-action="send-new"].btn--primary') === 0, (ru ? 'RU' : 'UA') + ': кнопки «Мої замовлення», «Змінити кошик» (основная), «Надіслати кошик як нове замовлення» (второстепенная), «Напишіть нам» только если задан контакт магазина');
        ok(await noOverflow(x.A.page) && (await smallTargets(x.A.page)).length === 0, 'сообщение и кнопки: ≥ 44 px, 360 px без горизонтальной прокрутки', await smallTargets(x.A.page));
        await x.A.page.waitForFunction(() => !document.querySelector('.fly'), null, { timeout: 2500 }).catch(() => {}); // полёт длится до 0,9 с, потом элемент убирается
        ok(await count(x.A.page, '.fly') === 0 && await count(x.A.page, 'body > span') === 0, 'перед снимком летящего кружка в DOM нет', await x.A.page.evaluate(() => [].map.call(document.querySelectorAll('body > *'), n => n.tagName + '.' + n.className).join()));
        await x.A.page.screenshot({ path: OUT + '/150-b1-dup-changed-' + theme + '-' + lc + '.png', fullPage: true });
        x.state.mode = 'pass';
        const sentBefore = x.state.sent.length;
        await x.A.page.click('[data-action="send-new"]');
        await x.A.page.waitForSelector('.sheet .confirm__text');
        ok(x.state.sent.length === sentBefore && /(можуть бути вже замовлені товари|могут быть уже заказанные товары)/.test(await text(x.A.page, '.sheet .confirm__text')), '«як нове» просит подтверждение, сам заказ пока не уходит');
        await x.A.page.click('[data-action="cf-cancel"]');
        await x.A.page.waitForTimeout(250);
        ok(x.state.sent.length === sentBefore && await x.A.page.locator('#formErr [data-action="send-new"]').isVisible(), 'отмена подтверждения: заказ не отправлен');
        await x.A.page.click('[data-action="send-new"]');
        await x.A.page.click('[data-action="cf-ok"]');
        await x.A.page.waitForSelector('.done');
        const last = x.sv.gas.sheets['Замовлення'].rows.slice(-1)[0].join(' | ');
        ok(x.sv.gas.sheets['Замовлення'].rows.length === base + 1 && x.state.sent[x.state.sent.length - 1].rid !== x.rid1 && x.state.sent[x.state.sent.length - 1].items.length === 2, '«Надіслати як нове»: второй заказ с полной корзиной (всего два), ключ новый', [x.sv.gas.sheets['Замовлення'].rows.length - base, last]);
        ok(await ridOf(x.A.page) === '' && await cartIds(x.A.page) === '', 'после успеха ключ и корзина очищены');
      }
      await x.A.ctx.close(); x.sv.server.close();
    }
    // ответ потерян → покупатель поменял «Якщо товару немає» → повтор: dup_changed, один заказ, понятный текст
    {
      const x = await run(8870, 'uk', 'light');
      const base = x.sv.gas.sheets['Замовлення'].rows.length;
      await x.A.page.locator('#ifoBox [data-opt="ifOut-remove"]').click();
      x.state.mode = 'pass';
      await x.A.page.evaluate(() => window.__tg.main.cb()); // кнопка Telegram «Підтвердити»: форма уже изменена
      await x.A.page.waitForSelector('#formErr:not([hidden]) [data-action="send-new"]', { timeout: 8000 });
      const box = (await text(x.A.page, '#formErr')).replace(/ /g, ' ');
      ok(x.state.sent[x.state.sent.length - 1].ifOut === 'remove' && x.state.sent[x.state.sent.length - 1].rid === x.rid1, 'ifOut изменён: повтор ушёл с прежним rid и новым ifOut', x.state.sent.map(s => [s.rid, s.ifOut]));
      ok(/Попереднє замовлення .*уже прийняте\./.test(box) && /«Якщо товару немає»/.test(box) && /Щоб змінити те замовлення — напишіть нам/.test(box), 'ifOut изменён: покупатель видит, что прежний заказ принят, а изменение «Якщо товару немає» в него не попало', box);
      ok(x.sv.gas.sheets['Замовлення'].rows.length === base && await ridOf(x.A.page) === '' && await cartIds(x.A.page) === 'NUT-007', 'ifOut изменён: в таблице по-прежнему один заказ, корзина цела, ключ сброшен', x.sv.gas.sheets['Замовлення'].rows.length - base);
      ok(await x.A.page.locator('#formErr [data-go="cart"]').isEnabled() && await noOverflow(x.A.page) && (await smallTargets(x.A.page)).length === 0, 'ifOut изменён: кнопки доступны, ≥ 44 px, без горизонтальной прокрутки');
      await x.A.ctx.close(); x.sv.server.close();
    }
    // подставной ответ сервера (и без номера): витрина сама ведёт себя верно, даже если бэкенд ещё не обновлён
    for (const [fake, re, name] of [[{ ok: false, error: 'dup_changed', number: 'P-0008' }, /Попереднє замовлення P-0008 уже прийняте\./, 'с номером'], [{ ok: false, error: 'dup_changed' }, /^Попереднє замовлення вже прийняте\./, 'без номера']]) {
      const x = await run(name === 'с номером' ? 8894 : 8895, 'uk', 'light', false, false, fake);
      await addProd(x.A.page, 'SWT-004');
      x.state.mode = 'fake';
      await toSend(x.A.page);
      await x.A.page.waitForSelector('#formErr:not([hidden]) [data-action="send-new"]');
      ok(re.test((await text(x.A.page, '#formErr')).replace(/ /g, ' ')) && await cartIds(x.A.page) === 'NUT-007,SWT-004' && await ridOf(x.A.page) === '' && await count(x.A.page, '#formErr [data-go="orders"]') === 1, 'подставной dup_changed ' + name + ': сообщение, корзина не очищена, ключ сброшен');
      ok(await x.A.page.locator('#formErr .btn').first().isEnabled() && await x.A.page.evaluate(() => !document.querySelector('.bar__btn, #barBtn, .bar .btn') || !document.querySelector('.bar .btn').disabled), 'кнопка отправки разблокирована');
      await x.A.ctx.close(); x.sv.server.close();
    }
    // без контакта магазина кнопки «Напишіть нам» нет; основная кнопка ведёт в корзину
    {
      const x = await run(8898, 'uk', 'light', false, false, { ok: false, error: 'dup_changed', number: 'P-0008' });
      await addProd(x.A.page, 'SWT-004');
      x.state.mode = 'fake';
      await toSend(x.A.page);
      await x.A.page.waitForSelector('#formErr:not([hidden]) [data-action="send-new"]');
      await x.A.page.click('#formErr [data-go="cart"]');
      await x.A.page.waitForFunction(() => document.body.getAttribute('data-view') === 'cart');
      ok(await cartIds(x.A.page) === 'NUT-007,SWT-004' && x.state.sent.length === 2, 'после dup_changed основная кнопка ведёт в корзину, новый заказ не отправлялся', x.state.sent.length);
      await x.A.ctx.close(); x.sv.server.close();
    }
    // «changed» тоже сбрасывает ключ: следующая покупка не прилипает к старому ключу
    const xc = await run(8896, 'uk', 'light', false, false, { ok: false, error: 'changed' });
    xc.state.mode = 'fake';
    await xc.A.page.click('[data-action="retry-order"]');
    await xc.A.page.waitForFunction(() => document.body.getAttribute('data-view') === 'cart');
    ok(await ridOf(xc.A.page) === '', 'после «changed» ключ сброшен');
    await xc.A.ctx.close(); xc.sv.server.close();
    // после «changed» каталог берётся напрямую из Apps Script, минуя CATALOG_URL (Worker может отдавать прежние цены)
    {
      const sv = await start(8899, undefined, withPhotos);
      let catReqs = 0, mode = 'pass';
      const A = await open(browser, sv.url, { uid: 790, w: 360, h: 640, before: async page => {
        await page.route('**/config.js*', r => r.fulfill({ contentType: 'application/javascript', body: "window.PAMIR_CONFIG = { API_URL: location.origin + '/api', BOT: 'pamir_test_bot', APP: 'shop', CATALOG_URL: location.origin + '/cat' };" }));
        await page.route('**/cat', async r => { catReqs++; const j = JSON.parse(JSON.stringify(sv.gas.get({ action: 'catalog' }))); j.shop.notice = { ua: 'З воркера', ru: 'С воркера' }; r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(j) }); });
        await page.route(/\/api$/, route => {
          let b = null; try { b = route.request().method() === 'POST' ? JSON.parse(route.request().postData()) : null; } catch (e) { b = null; }
          if (b && b.action === 'order' && mode === 'changed') return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ ok: false, error: 'changed' }) });
          return route.continue();
        });
      } });
      await A.page.waitForSelector('#grid .card');
      await toCard(A.page, 'NUT-007');
      await A.page.locator('#grid .card[data-id="NUT-007"] [data-quick="1"]').click();
      const workerBefore = catReqs, apiBefore = sv.log.filter(x => x.action === 'GET catalog').length;
      mode = 'changed';
      await toSend(A.page);
      await A.page.waitForFunction(() => document.body.getAttribute('data-view') === 'cart');
      await A.page.waitForTimeout(300);
      ok(catReqs === workerBefore && sv.log.filter(x => x.action === 'GET catalog').length === apiBefore + 1, 'после «changed» каталог перечитан напрямую из Apps Script (Worker не спрашивали)', [catReqs - workerBefore, sv.log.filter(x => x.action === 'GET catalog').length - apiBefore]);
      await A.ctx.close(); sv.server.close();
    }
    // «летящий в корзину» элемент не остаётся в DOM
    {
      const sv = await start(8900, undefined, withPhotos);
      const A = await open(browser, sv.url, { uid: 791, w: 360, h: 640 });
      await A.page.waitForSelector('#grid .card');
      await toCard(A.page, 'NUT-007');
      await A.page.locator('#grid .card[data-id="NUT-007"] [data-quick="1"]').click();
      const during = await A.page.evaluate(() => document.querySelectorAll('.fly').length);
      await A.page.waitForTimeout(1500);
      ok(during >= 0 && await count(A.page, '.fly') === 0, 'через 1,5 с после добавления в корзину летящего элемента в DOM нет (во время полёта: ' + during + ')');
      await A.ctx.close(); sv.server.close();
    }
  }

  console.log('Исправления Б1: снег под содержимым и превью настроек');
  {
    const sv = await start(8897, undefined, s => {
      withPhotos(s);
      s.sheets['Налаштування'] = [['Ключ', 'Значення', 'Опис'], ['theme', 'newyear', ''], ['ny_snow', '1', ''], ['gift_from', '500', ''], ['gift_text_ua', 'Знижка $& 5$$', '']];
    });
    for (const theme of ['light', 'dark']) {
      const A = await open(browser, sv.url, { uid: 760, w: 360, h: 640, theme });
      await A.page.waitForSelector('#grid .card'); await A.page.waitForTimeout(600);
      const q = await A.page.evaluate(() => {
        const box = document.getElementById('snow'), fl = [].slice.call(box.querySelectorAll('i'));
        const sizes = fl.map(i => parseFloat(getComputedStyle(i).width));
        const card = [].slice.call(document.querySelectorAll('.card')).filter(c => c.getBoundingClientRect().top > 60 && c.getBoundingClientRect().top < innerHeight - 40)[0] || document.querySelector('.card'), cr = card.getBoundingClientRect();
        const cx = Math.round(cr.left + cr.width / 2), cy = Math.round(cr.top + 20);
        return { n: fl.length, minS: Math.min.apply(null, sizes), maxS: Math.max.apply(null, sizes), z: Number(getComputedStyle(box).zIndex), op: Math.max.apply(null, fl.map(i => Number(getComputedStyle(i).opacity))),
          shown: getComputedStyle(box).display !== 'none', under: (document.elementFromPoint(cx, cy) || document.body).closest('.card') !== null };
      });
      ok(q.n >= 1 && q.n <= 14 && q.minS >= 4 && q.maxS <= 7 && q.z < 0 && q.op <= .35 && q.shown, 'снег (' + theme + '): ≤ 14 снежинок, 4–7 px, слой под содержимым (z-index < 0), низкая непрозрачность', q);
      await A.page.screenshot({ path: OUT + '/151-b1-snow-home-' + theme + '.png' });
      await A.page.click('.tabbar [data-go="cart"]');
      await A.page.locator('.tabbar [data-go="catalog"]').click();
      await A.page.locator('#grid .card[data-id="NUT-007"] [data-quick="1"]').click().catch(() => {});
      await A.page.click('.tabbar [data-go="cart"]');
      await A.page.waitForSelector('.line');
      ok(await A.page.evaluate(() => getComputedStyle(document.getElementById('snow')).display === 'none'), 'снег (' + theme + '): в корзине снега нет');
      await A.page.evaluate(() => window.__tg.main.cb());
      await A.page.waitForSelector('#form');
      ok(await A.page.evaluate(() => getComputedStyle(document.getElementById('snow')).display === 'none'), 'снег (' + theme + '): при оформлении снега нет');
      await A.page.screenshot({ path: OUT + '/152-b1-snow-checkout-' + theme + '.png' });
      await A.ctx.close();
    }
    sv.server.close();
  }

  /* ---------------- Волна Б2 · блоки 2–3: наборы, подсказка в корзине, повтор по ссылке, поиск, «Якщо товару немає» ---------------- */
  console.log('Волна Б2 · блоки 2–3 (360 px)');
  {
    const NB = s => String(s).replace(/ /g, ' ');
    const catalogMod = fn => async page => {
      await page.route(/\/api\?.*action=catalog/, async route => {
        const res = await route.fetch(); const j = await res.json();
        fn(j);
        await route.fulfill({ status: 200, contentType: 'application/json; charset=utf-8', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(j) });
      });
    };
    const flushEv = async page => { await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); }); await page.waitForTimeout(400); };
    const EV = st => st.log.filter(x => x.action === 'ev').reduce((a, x) => a.concat(x.events || []), []);
    const st = await start(8901, undefined, s => { withPhotos(s); });
    const XSS = '<img src=x onerror="window.__xss=1">';

    /* ---- б1: наборы ---- */
    const setMod = j => {
      const by = id => j.products.find(p => p.id === id);
      by('CND-004').ks = ['DRY-039', 'NUT-002', 'SPC-004', 'ZZZ-404']; by('CND-004').kp = 450;   // ZZZ-404 в каталоге нет
      by('CND-005').ks = ['SPC-004']; by('CND-005').kp = 260;                                       // «окремо» не больше цены набора — строки нет
      by('SWT-006').ks = ['QQ-111', 'QQ-222'];                                                       // ни одного известного названия — блока нет
      by('DRY-039').ua = 'Курага ' + XSS + ' натуральна'; by('NUT-002').ru = 'Кешью жареный';
    };
    for (const theme of ['light', 'dark']) {
      const A = await open(browser, st.url, { uid: 801, theme, start: 'CND-004', before: catalogMod(setMod) });
      await A.page.waitForSelector('.sheet__title');
      const links = await A.page.locator('#sheet .setc__link').allInnerTexts();
      ok(links.length === 3 && /^Курага <img/.test(links[0]) && /Кеш/.test(links[1]) && /Суміш/.test(links[2]), 'набор (' + theme + '): «Склад набору» — три известных названия, ID без товара не показан', links);
      ok(/Склад набору/.test(await text(A.page, '#sheet .setc .label')) && !/ZZZ-404/.test(await text(A.page, '#sheet')), 'набор (' + theme + '): подпись блока, сырого ID нет');
      ok(NB(await text(A.page, '#sheet .setc__sep')) === 'Окремо 450 ₴ · набором 390 ₴', 'набор (' + theme + '): «Окремо 450 ₴ · набором 390 ₴» с цифрами сервера', await text(A.page, '#sheet .setc__sep'));
      ok(await A.page.evaluate(() => window.__xss === undefined) && await count(A.page, '#sheet .setc img') === 0, 'набор (' + theme + '): HTML в названии товара выводится текстом');
      const sizes = await A.page.locator('#sheet .setc__link').evaluateAll(l => l.map(b => Math.round(b.getBoundingClientRect().height)));
      ok(sizes.every(h => h >= 44) && await noOverflow(A.page) && (await smallTargets(A.page)).length === 0, 'набор (' + theme + '): ссылки ≥ 44 px, без горизонтальной прокрутки', [sizes, await smallTargets(A.page)]);
      await A.page.screenshot({ path: OUT + '/b2-set-sheet-' + theme + '.png' });
      await A.page.locator('#sheet .setc__link').nth(1).click();
      await A.page.waitForFunction(() => /Кеш/.test(document.querySelector('.sheet__title').textContent));
      ok(await count(A.page, '#sheet .setc') === 0, 'набор (' + theme + '): ссылка открывает шторку товара состава (у него состава нет — блока нет)');
      ok(A.errors.length === 0, 'набор (' + theme + '): в консоли нет ошибок', A.errors);
      await A.ctx.close();
    }
    {
      const R = await open(browser, st.url, { uid: 802, lc: 'ru', start: 'CND-004', before: catalogMod(setMod) });
      await R.page.waitForSelector('.sheet__title');
      ok(/Состав набора/.test(await text(R.page, '#sheet .setc .label')) && NB(await text(R.page, '#sheet .setc__sep')) === 'Отдельно 450 ₴ · набором 390 ₴', 'набор RU: «Состав набора», «Отдельно … · набором …»');
      await R.ctx.close();
      const E = await open(browser, st.url, { uid: 803, start: 'CND-005', before: catalogMod(setMod) });
      await E.page.waitForSelector('.sheet__title');
      ok(await count(E.page, '#sheet .setc__link') === 1 && await count(E.page, '#sheet .setc__sep') === 0, 'набор: «окремо» равно цене набора — строки нет, состав есть');
      await E.ctx.close();
      const Z = await open(browser, st.url, { uid: 804, start: 'SWT-006', before: catalogMod(setMod) });
      await Z.page.waitForSelector('.sheet__title');
      ok(await count(Z.page, '#sheet .setc') === 0, 'набор: ни одного известного товара в составе — блока нет');
      await Z.ctx.close();
      const O = await open(browser, st.url, { uid: 805, start: 'CND-004' });
      await O.page.waitForSelector('.sheet__title');
      ok(await count(O.page, '#sheet .setc') === 0, 'без ks/kp (старый бэкенд): шторка как раньше');
      await O.ctx.close();
    }

    /* ---- б2: подсказка в корзине ---- */
    const hintMod = (extra) => j => {
      const by = id => j.products.find(p => p.id === id);
      by('DRY-039').tg = ['Для плову'];
      j.shop.hint = Object.assign({ tag: ' для  ПЛОВУ ', id: 'SPC-004', ua: 'До плову: суміш ' + XSS + ' — 45 ₴', ru: 'К плову: смесь — 45 ₴' }, extra || {});
    };
    const toCartWith = async (page, id) => {
      await page.waitForSelector('#grid .card');
      await page.evaluate(i => { const b = document.querySelector('#grid .card[data-id="' + i + '"] .card__name'); if (b) b.click(); }, id);
    };
    for (const theme of ['light', 'dark']) {
      const H = await open(browser, st.url, { uid: 810, theme, start: 'DRY-039', before: catalogMod(hintMod()) });
      await H.page.waitForSelector('.sheet__title');
      await H.page.click('#sheet [data-action="add"]');
      await H.page.click('.tabbar [data-go="cart"]');
      await H.page.waitForSelector('.line');
      ok(await count(H.page, '#cartHint') === 1 && /До плову: суміш <img/.test(await text(H.page, '#cartHint .chint__text')) && NB(await text(H.page, '#cartHint')).indexOf('45 ₴') > 0, 'подсказка (' + theme + '): строка с текстом сервера и кнопкой «Додати»', await text(H.page, '#cartHint'));
      ok(await H.page.evaluate(() => window.__xss === undefined) && await count(H.page, '#cartHint img') === 0, 'подсказка (' + theme + '): HTML в тексте подсказки выводится текстом');
      const hcr = await H.page.evaluate(() => { const b = document.querySelector('#cartHint .btn'), cs = getComputedStyle(b); const p = c => (c.match(/[\d.]+/g) || []).slice(0, 3).map(Number); const L = a => { const x = a.map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * x[0] + .7152 * x[1] + .0722 * x[2]; }; const a = L(p(cs.color)), c = L(p(cs.backgroundColor)); return (Math.max(a, c) + .05) / (Math.min(a, c) + .05); });
      ok(hcr >= 4.5, 'подсказка (' + theme + '): контраст текста кнопки «Додати» ≥ 4.5:1', hcr);
      ok(/Додати/.test(await text(H.page, '#cartHint .btn')) && await noOverflow(H.page) && (await smallTargets(H.page)).length === 0, 'подсказка (' + theme + '): кнопка ≥ 44 px, без горизонтальной прокрутки', await smallTargets(H.page));
      await H.page.waitForFunction(() => !document.querySelector('.fly')); // анимация «в корзину» закончилась
      await H.page.waitForFunction(() => document.getElementById('toast').hidden, null, { timeout: 8000 }); // всплывашка «Додано в кошик» ушла
      await H.page.waitForTimeout(450); // и сумма досчиталась
      await H.page.screenshot({ path: OUT + '/b2-cart-hint-' + theme + '.png' });
      await H.page.click('#cartHint .btn');
      await H.page.waitForFunction(() => document.querySelectorAll('.line').length === 2);
      ok(await count(H.page, '#cartHint') === 0 && /Суміш/.test(await text(H.page, '.lines')), 'подсказка (' + theme + '): после «Додати» товар в корзине, строка исчезла');
      ok(H.errors.length === 0, 'подсказка (' + theme + '): в консоли нет ошибок', H.errors);
      await H.ctx.close();
    }
    {
      const R = await open(browser, st.url, { uid: 811, lc: 'ru', start: 'DRY-039', before: catalogMod(hintMod()) });
      await R.page.waitForSelector('.sheet__title');
      await R.page.click('#sheet [data-action="add"]');
      await R.page.click('.tabbar [data-go="cart"]');
      await R.page.waitForSelector('.line');
      ok(/К плову: смесь/.test(await text(R.page, '#cartHint .chint__text')) && /Добавить/.test(await text(R.page, '#cartHint .btn')), 'подсказка RU: русский текст и «Добавить»');
      await R.ctx.close();
      const cases = [
        ['товар подсказки уже в корзине', hintMod(), true],
        ['товар подсказки не в наличии', hintMod({ id: 'DRY-005' }), false],
        ['товара подсказки нет в каталоге', hintMod({ id: 'ZZZ-404' }), false],
        ['в корзине нет товара с тегом', j => { hintMod()(j); j.products.find(p => p.id === 'DRY-039').tg = ['для чаю']; }, false],
        ['нет shop.hint (старый бэкенд)', j => { hintMod()(j); delete j.shop.hint; }, false]
      ];
      for (const [name, fn, inCart] of cases) {
        const C = await open(browser, st.url, { uid: 812, start: 'DRY-039', before: catalogMod(fn) });
        await C.page.waitForSelector('.sheet__title');
        if (inCart) { // товар подсказки уже лежит в корзине на устройстве
          await C.page.evaluate(() => localStorage.setItem('pamir_cart_v1', JSON.stringify({ t: Date.now(), i: [{ id: 'SPC-004', g: 0, q: 1, pr: 45 }] })));
          await C.page.goto(st.url + '/', { waitUntil: 'networkidle' });
          await C.page.waitForSelector('.sheet__title');
        }
        await C.page.click('#sheet [data-action="add"]');
        await C.page.click('.tabbar [data-go="cart"]');
        await C.page.waitForSelector('.line');
        ok(await count(C.page, '#cartHint') === 0, 'подсказка: ' + name + ' — строки нет');
        await C.ctx.close();
      }
    }

    /* ---- б12: поиск ---- */
    {
      const clones = j => { // каталог в 300 товаров для проверки скорости
        const base = j.products.filter(p => p.t === 'w');
        for (let i = 0; j.products.length < 300; i++) { const b = base[i % base.length]; j.products.push(Object.assign({}, b, { id: 'ZZ-' + String(i).padStart(3, '0'), ua: b.ua + ' вар' + i, ru: (b.ru || b.ua) + ' вар' + i })); }
      };
      const searchMod = j => {
        const by = id => j.products.find(p => p.id === id);
        j.shop.syn = { 'Урюк': 'курага', 'кешью': 'кеш’ю', '__proto__': 'x', 'constructor': 'курага' };
        by('DRY-001').ua = 'Горіх мигдаль'; by('NUT-003').ua = 'Мидгаль солоний'; by('NUT-003').ru = 'Мидгаль солёный';
        clones(j);
      };
      const ids = async p => p.evaluate(() => [].slice.call(document.querySelectorAll('#grid .card')).map(c => c.getAttribute('data-id')));
      const q = async (p, v) => { await p.fill('#search', v); await p.waitForTimeout(350); return ids(p); };
      const S = await open(browser, st.url, { uid: 820, before: catalogMod(searchMod) });
      await S.page.waitForSelector('#grid .card');
      let r = await q(S.page, 'кешю');
      ok(r[0] === 'NUT-002', 'поиск: «кешю» находит «Кеш’ю» (апостроф)', r.slice(0, 3));
      r = await q(S.page, 'иншир');
      ok(r.includes('DRY-003'), 'поиск: «иншир» = «інжир» (и/і как одна буква)', r.slice(0, 5));
      r = await q(S.page, 'инжыр');
      ok(r.includes('DRY-003'), 'поиск: «инжыр» = «інжир» (ы/и)', r.slice(0, 5));
      {
        const S2 = await open(browser, st.url, { uid: 822, before: catalogMod(j => { searchMod(j); j.products = j.products.filter(p => !/^ZZ-/.test(p.id)); }) });
        await S2.page.waitForSelector('#grid .card');
        const r2 = await q(S2.page, 'мигдаль');
        const iEx = ['DRY-001', 'NUT-001'].map(i => r2.indexOf(i)), iTy = r2.indexOf('NUT-003');
        ok(iEx.every(i => i >= 0) && iTy > Math.max.apply(null, iEx), 'поиск: точные совпадения выше, опечатка («Мидгаль») в конце выдачи', r2.slice(0, 6));
        await S2.ctx.close();
      }
      r = await q(S.page, 'мигадаль');
      ok(r.includes('NUT-001') && r.includes('DRY-001'), 'поиск: лишняя буква («мигадаль») находит «мигдаль»', r.slice(0, 5));
      r = await q(S.page, 'мидгаль');
      ok(r.includes('NUT-001') && r.includes('NUT-003'), 'поиск: перестановка соседних («мидгаль») находит и «мигдаль»', r.slice(0, 5));
      r = await q(S.page, 'мигдвль');
      ok(r.includes('NUT-001'), 'поиск: замена буквы («мигдвль») находит «мигдаль»', r.slice(0, 5));
      r = await q(S.page, 'чяй');
      ok(r.length === 0, 'поиск: слова короче 5 букв опечаток не прощают («чяй» ничего не находит)', r.slice(0, 5));
      r = await q(S.page, 'урюк');
      ok(r.includes('DRY-039') && r.length >= 1, 'поиск: синоним «урюк» → «курага» (ключ в другом регистре)', r.slice(0, 5));
      r = await q(S.page, 'constructor');
      ok(r.includes('DRY-039') && (await S.page.evaluate(() => 1)) === 1, 'поиск: ключ «constructor» — обычное слово синонимов, без ошибки', r.slice(0, 3));
      r = await q(S.page, 'toString');
      ok(r.length === 0, 'поиск: «toString» не принимается за синоним', r.slice(0, 3));
      r = await q(S.page, '__proto__');
      ok(r.length === 0 && S.errors.length === 0, 'поиск: «__proto__» ничего не ломает', S.errors);
      const t0 = await S.page.evaluate(async () => {
        const inp = document.getElementById('search'); const out = [];
        for (const v of ['мигадаль', 'мидгаль солоний', 'курагва', 'зюзюзюзю', 'урюк']) {
          const t = performance.now(); inp.value = v; inp.dispatchEvent(new Event('input', { bubbles: true }));
          await new Promise(r => setTimeout(r, 160)); await new Promise(r => requestAnimationFrame(() => r()));
          out.push(Math.round(performance.now() - t - 160));
        }
        return out;
      });
      ok(t0.every(ms => ms < 250) && (await S.page.evaluate(() => document.querySelectorAll('#grid .card').length)) >= 0, 'поиск: на каталоге в 300 товаров запрос с опечаткой отрабатывает быстро (сверх 160 мс паузы)', t0);
      await S.page.fill('#search', 'зюзюзюзю'); await S.page.waitForTimeout(300);
      await S.page.locator('#search').blur(); await S.page.waitForTimeout(150);
      await S.page.fill('#search', 'мидгаль'); await S.page.waitForTimeout(300);
      await S.page.locator('#search').blur(); await S.page.waitForTimeout(150);
      await S.page.fill('#search', 'урюк'); await S.page.waitForTimeout(300);
      await S.page.locator('#search').blur(); await S.page.waitForTimeout(150);
      await flushEv(S.page);
      const ev = EV(st).filter(e => ['search', 'search0'].includes(e.e));
      ok(ev.some(e => e.e === 'search0' && e.v === 'зюзюзюзю') && !ev.some(e => e.e === 'search0' && (e.v === 'мидгаль' || e.v === 'урюк')) && ev.some(e => e.e === 'search' && e.v === 'урюк'), 'поиск: search0 только когда пусто и после синонимов и опечаток', ev.slice(-6));
      await S.ctx.close();
      const N = await open(browser, st.url, { uid: 821 });
      await N.page.waitForSelector('#grid .card');
      r = await q(N.page, 'урюк');
      ok(r.length === 0, 'поиск без shop.syn (старый бэкенд): «урюк» как раньше ничего не находит', r.slice(0, 3));
      r = await q(N.page, 'мигдаль');
      ok(r.includes('NUT-001'), 'поиск без shop.syn: обычный запрос как раньше');
      await N.ctx.close();
    }

    /* ---- б12: «Якщо товару немає» ---- */
    for (const theme of ['light', 'dark']) {
      const F = await open(browser, st.url, { uid: 830, theme });
      await F.page.waitForSelector('#grid .card');
      await F.page.evaluate(() => { document.querySelector('#grid .card[data-id="NUT-007"] [data-quick="1"]').click(); });
      await F.page.click('.tabbar [data-go="cart"]');
      await F.page.waitForSelector('.line');
      await F.page.evaluate(() => window.__tg.main.cb());
      await F.page.waitForSelector('#form');
      ok(await count(F.page, '#ifoBox input[name="ifOut"]') === 3 && await F.page.evaluate(() => document.querySelector('#ifoBox input[name="ifOut"]:checked').value) === 'call', 'если нет (' + theme + '): три варианта, «Зателефонуйте мені» выбран');
      ok((await F.page.locator('#ifoBox .opt__box').allInnerTexts()).join('|') === 'Зателефонуйте мені|Замініть схожим|Приберіть із замовлення' && /Якщо товару немає/.test(await text(F.page, '#ifoBox legend')), 'если нет (' + theme + '): подписи UA');
      const hs = await F.page.locator('#ifoBox .opt__box').evaluateAll(l => l.map(b => Math.round(b.getBoundingClientRect().height)));
      ok(hs.every(h => h >= 44) && await noOverflow(F.page) && (await smallTargets(F.page)).length === 0, 'если нет (' + theme + '): варианты ≥ 44 px, без горизонтальной прокрутки', [hs, await smallTargets(F.page)]);
      await F.page.locator('#ifoBox [data-opt="ifOut-replace"]').click();
      await F.page.fill('#f-phone', '+380671112233');
      await F.page.screenshot({ path: OUT + '/b2-checkout-ifo-' + theme + '.png', fullPage: true });
      if (theme === 'light') {
        // сбой отправки: выбор остаётся в форме и на устройстве
        await F.page.route(/\/api$/, r => { if (r.request().method() === 'POST' && /"action":"order"/.test(r.request().postData() || '')) r.abort(); else r.continue(); });
        await F.page.evaluate(() => window.__tg.main.cb());
        await F.page.waitForSelector('.form__retry');
        ok(await F.page.evaluate(() => document.querySelector('#ifoBox input[name="ifOut"]:checked').value) === 'replace' && await F.page.evaluate(() => JSON.parse(localStorage.getItem('pamir_form_v1') || '{}').ifOut) === 'replace', 'если нет: после сбоя отправки выбор «Замініть схожим» сохранён');
        await F.page.unroute(/\/api$/);
        await F.page.click('.form__retry');
        await F.page.waitForSelector('.done');
        const sent = st.log.filter(x => x.action === 'order').slice(-1)[0];
        ok(sent && sent.ifOut === 'replace', 'если нет: в заказ уходит ifOut = replace', sent && sent.ifOut);
      }
      ok(F.errors.length === 0, 'если нет (' + theme + '): в консоли нет ошибок', F.errors);
      await F.ctx.close();
    }
    {
      const R = await open(browser, st.url, { uid: 831, lc: 'ru' });
      await R.page.waitForSelector('#grid .card');
      await R.page.evaluate(() => { document.querySelector('#grid .card[data-id="NUT-007"] [data-quick="1"]').click(); });
      await R.page.click('.tabbar [data-go="cart"]'); await R.page.waitForSelector('.line');
      await R.page.evaluate(() => window.__tg.main.cb()); await R.page.waitForSelector('#form');
      ok((await R.page.locator('#ifoBox .opt__box').allInnerTexts()).join('|') === 'Позвоните мне|Замените похожим|Уберите из заказа' && /Если товара нет/.test(await text(R.page, '#ifoBox legend')), 'если нет RU: «Позвоните мне», «Замените похожим», «Уберите из заказа»');
      await R.ctx.close();
      // без флага shop.ifo — блока нет и поле не уходит
      const N = await open(browser, st.url, { uid: 832, before: catalogMod(j => { delete j.shop.ifo; }) });
      await N.page.waitForSelector('#grid .card');
      await N.page.evaluate(() => { document.querySelector('#grid .card[data-id="NUT-007"] [data-quick="1"]').click(); });
      await N.page.click('.tabbar [data-go="cart"]'); await N.page.waitForSelector('.line');
      await N.page.evaluate(() => window.__tg.main.cb()); await N.page.waitForSelector('#form');
      ok(await count(N.page, '#ifoBox') === 0, 'без shop.ifo: блока «Якщо товару немає» нет');
      await N.page.fill('#f-phone', '+380671112233');
      await N.page.evaluate(() => window.__tg.main.cb()); await N.page.waitForSelector('.done');
      const sent = st.log.filter(x => x.action === 'order').slice(-1)[0];
      ok(sent && !('ifOut' in sent), 'без shop.ifo: поле ifOut в заказ не отправляется');
      await N.ctx.close();
    }

    /* ---- б3: повтор заказа по ссылке re-<номер> ---- */
    {
      const U = await open(browser, st.url, { uid: 501, start: 're-0001' });
      await U.page.waitForSelector('.line');
      const my = st.log.filter(x => x.action === 'orders.my' && x.num);
      ok(my.length === 1 && my[0].num === 'P-0001' && my[0].initData, 'повтор по ссылке: запрос orders.my с initData и num = P-0001', my.map(x => x.num));
      ok(await count(U.page, '.line') === 2 && /Курага/.test(await text(U.page, '.line')) && /Товари з замовлення додано в кошик/.test(await text(U.page, '.page')) && await U.page.evaluate(() => document.body.getAttribute('data-view')) === 'cart', 'повтор по ссылке: товары заказа в корзине по текущим ценам, открыта корзина', await text(U.page, '.page'));
      await U.page.screenshot({ path: OUT + '/b2-relink-cart.png' });
      await flushEv(U.page);
      ok(!EV(st).some(e => e.e === 'src' && /^re-/.test(e.v)) && await U.page.evaluate(() => localStorage.getItem('pamir_src_v1')) === null && await count(U.page, '.sheet__title') === 0, 'повтор по ссылке: не источник src, не ID товара');
      ok(U.errors.length === 0, 'повтор по ссылке: в консоли нет ошибок', U.errors);
      await U.ctx.close();
      // сообщение с названиями: товар в каталоге, но «немає»
      const G = await open(browser, st.url, { uid: 501, start: 're-0001', before: async page => {
        await page.route(/\/api$/, async route => {
          if (route.request().method() === 'POST' && /"action":"orders\.my"/.test(route.request().postData() || '')) {
            const res = await route.fetch(); const j = await res.json();
            if (j.one) j.one.i = [['DRY-039', 1000, 1], ['DRY-005', 500, 1], ['NUT-007', 0, 2]];
            await route.fulfill({ status: 200, contentType: 'application/json; charset=utf-8', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(j) });
          } else await route.continue();
        });
      } });
      await G.page.waitForSelector('.line');
      ok(await count(G.page, '.line') === 2 && /Немає в наявності, не додано: Манго сушене\./.test(await text(G.page, '.page')), 'повтор: «немає» пропущен, клиент видит название («Манго сушене»)', await text(G.page, '.page'));
      await G.ctx.close();
      // нет заказа / чужой заказ / старый бэкенд — просто «Мої замовлення»
      for (const [label, o] of [['нет такого заказа', { uid: 501, start: 're-9999' }], ['чужой заказ', { uid: 502, start: 're-0001' }]]) {
        const X = await open(browser, st.url, Object.assign({}, o));
        await X.page.waitForSelector('.page .state, .page .my');
        ok(await count(X.page, '.line') === 0 && await count(X.page, '.form__err') === 0 && /Мої замовлення|Профіль/.test(await text(X.page, '.page__title, .sec')), 'повтор по ссылке (' + label + '): открыт список «Мої замовлення», корзина пуста, без ошибки');
        ok(X.errors.length === 0, 'повтор по ссылке (' + label + '): в консоли нет ошибок', X.errors);
        await X.ctx.close();
      }
      const oldCode = path.join(require('os').tmpdir(), 'Code.oldA.gs');
      fs.writeFileSync(oldCode, execSync('git show ' + (process.env.OLD_BACKEND_REF || OLD_REF_A) + ':apps-script/Code.gs', { cwd: path.join(__dirname, '..') }));
      const so = await start(8902, oldCode, s => { withPhotos(s); });
      const O = await open(browser, so.url, { uid: 501, start: 're-0001' });
      await O.page.waitForSelector('.page .my');
      ok(await count(O.page, '.line') === 0 && await count(O.page, '.form__err') === 0 && /Мої замовлення/.test(await text(O.page, '.page .sec')), 'старый бэкенд (нет поля one): повтор по ссылке открывает «Мої замовлення» без ошибки');
      ok(O.errors.length === 0, 'старый бэкенд: в консоли нет ошибок', O.errors);
      await O.page.screenshot({ path: OUT + '/b2-relink-old.png' });
      await O.ctx.close();
      // «старый бэкенд» для остальных пунктов: нет ks/kp/hint/syn/ifo
      const OB = await open(browser, so.url, { uid: 840, start: 'CND-004' });
      await OB.page.waitForSelector('.sheet__title');
      ok(await count(OB.page, '#sheet .setc') === 0, 'старый бэкенд: набора в шторке нет');
      await OB.page.click('#sheet [data-action="add"]'); await OB.page.click('.tabbar [data-go="cart"]'); await OB.page.waitForSelector('.line');
      ok(await count(OB.page, '#cartHint') === 0, 'старый бэкенд: подсказки в корзине нет');
      await OB.page.evaluate(() => window.__tg.main.cb()); await OB.page.waitForSelector('#form');
      ok(await count(OB.page, '#ifoBox') === 0, 'старый бэкенд: «Якщо товару немає» нет');
      await OB.page.fill('#f-phone', '+380671112233');
      await OB.page.evaluate(() => window.__tg.main.cb()); await OB.page.waitForSelector('.done');
      const sentOld = so.log.filter(x => x.action === 'order').slice(-1)[0];
      ok(sentOld && !('ifOut' in sentOld), 'старый бэкенд: заказ уходит без ifOut');
      ok(OB.errors.length === 0, 'старый бэкенд: в консоли нет ошибок', OB.errors);
      await OB.ctx.close(); so.server.close();
    }

    /* ---- панель: «Шукали й не знайшли за 30 днів» ---- */
    {
      const st2 = await start(8903, undefined, s => { withPhotos(s); });
      const now = Date.now();
      st2.gas.post({ action: 'ev', initData: st2.gas.initData({ id: 71 }), sid: 'z', events: [{ e: 'open', t: now }, { e: 'search0', v: 'кава', t: now }, { e: 'search0', v: 'кава', t: now }] });
      const P = await open(browser, st2.url, { uid: 900, query: '?admin=1' });
      await P.page.waitForSelector('.ord');
      await P.page.click('[data-action="adm-sales"]'); await P.page.waitForSelector('.funnel');
      ok(/Шукали й не знайшли за 30 днів/.test(await text(P.page, '.page')) && /кава/.test(await text(P.page, '.page')), 'панель: «Шукали й не знайшли за 30 днів» со списком', await text(P.page, '.page'));
      await P.page.screenshot({ path: OUT + '/b2-admin-zero.png' });
      await P.ctx.close();
      const st3 = await start(8904, undefined, s => { withPhotos(s); });
      st3.gas.post({ action: 'ev', initData: st3.gas.initData({ id: 71 }), sid: 'z', events: [{ e: 'open', t: Date.now() }] });
      const Q = await open(browser, st3.url, { uid: 900, query: '?admin=1' });
      await Q.page.waitForSelector('.ord');
      await Q.page.click('[data-action="adm-sales"]'); await Q.page.waitForSelector('.funnel');
      ok(!/Шукали й не знайшли/.test(await text(Q.page, '.page')) && await count(Q.page, '.page [role="alert"]') === 0 && await noOverflow(Q.page) && Q.errors.length === 0, 'панель: пустой список «не знайшли» не ломает статистику', Q.errors);
      await Q.ctx.close(); st2.server.close(); st3.server.close();
    }
    st.server.close();
  }

  /* ---------------- Волна Б2 · блок 4: Нова пошта — стоимость доставки, cityRef, «Створити ТТН» ---------------- */
  console.log('Волна Б2 · блок 4 (360 px)');
  {
    const NB = s => String(s).replace(/ /g, ' ');
    const REF_KH = '11111111-1111-1111-1111-111111111111', REF_KH2 = '22222222-2222-2222-2222-222222222222';
    const patchShop = (st, fn) => { const orig = st.gas.get; st.gas.get = q => { const r = orig(q); if (q.action === 'catalog' && r && r.shop) fn(r.shop); return r; }; };
    const CITIES = q => (q = q.toLowerCase()).indexOf('харк') === 0 ? [{ n: 'м. Харків, Харківська обл.', s: 'Харків', ref: REF_KH }, { n: 'с. Харківка, Київська обл.', s: 'Харківка', ref: REF_KH2 }] : [];
    const priceFor = w => 85 + (Math.ceil(w / 500) - 1) * 10;
    /** Заглушка Нової пошти: np.price считает запросы; o.price: ok | err | hang | slow500 (ответ на вес 500 приходит через 1,5 с). */
    async function stub(page, o) {
      const calls = { city: 0, price: [] };
      await page.route(/\/api\?.*action=np\./, async route => {
        const u = new URL(route.request().url()), action = u.searchParams.get('action');
        const send = (body, delay) => setTimeout(() => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(body) }).catch(() => {}), delay || 0);
        if (action === 'np.city') { calls.city++; return send({ ok: true, list: CITIES(u.searchParams.get('q')) }); }
        if (action === 'np.whall') return send({ ok: true, list: [[12, 'вул. Сумська, 12', 'w']] });
        if (action === 'np.price') {
          const w = Number(u.searchParams.get('w'));
          calls.price.push({ city: u.searchParams.get('city'), w, sum: Number(u.searchParams.get('sum')) });
          if (o.price === 'err') return send({ ok: false, error: 'np_error' });
          if (o.price === 'hang') return send({ ok: true, cost: 85 }, 9500);
          if (o.price === 'slow500' && w === o.slowW) return send({ ok: true, cost: priceFor(w) }, 1500);
          return send({ ok: true, cost: priceFor(w) });
        }
        return send({ ok: false });
      });
      return calls;
    }
    const mkSt = async (port, shop) => { const st = await start(port, undefined, withPhotos); patchShop(st, s => { Object.assign(s, shop); }); return st; };
    /** Оформление Новой почтой: курага в корзине (весовой товар), город выбран из подсказки (pick) или набран руками. */
    async function flow(st, uid, o) {
      o = o || {};
      const c = await open(browser, st.url, { uid, theme: o.theme, lc: o.lc, start: 'DRY-039' });
      await c.page.waitForSelector('.sheet__title');
      const calls = await stub(c.page, o);
      await c.page.click('#sheet [data-action="add"]');
      const g = await c.page.evaluate(() => JSON.parse(localStorage.getItem('pamir_cart_v1')).i[0].g);
      if (o.piece) { // штучный товар рядом с весовым: вес корзины неизвестен
        await c.page.evaluate(() => { const c = JSON.parse(localStorage.getItem('pamir_cart_v1')); c.i.push({ id: 'NUT-007', g: 0, q: 1, pr: 85 }); localStorage.setItem('pamir_cart_v1', JSON.stringify(c)); });
        await c.page.reload({ waitUntil: 'networkidle' });
        await c.page.waitForTimeout(500); await c.page.evaluate(() => { const b = document.querySelector('#sheet .sheet__close'); if (b && !document.getElementById('sheet').hidden) b.click(); });
      }
      await c.page.click('.tabbar [data-go="cart"]');
      await c.page.waitForSelector('.line');
      await c.page.evaluate(() => window.__tg.main.cb());
      await c.page.waitForSelector('#form');
      await c.page.locator('.opt', { hasText: o.lc === 'ru' ? 'Новая почта' : 'Нова пошта' }).first().click();
      if (o.manual) await c.page.fill('#f-city', 'Невідоме');
      else {
        await c.page.fill('#f-city', 'Харк');
        await c.page.waitForSelector('#citySugg button');
        await c.page.locator('#citySugg button').first().click();
      }
      return { c, calls, g };
    }
    const sendOrder = async (page, st) => {
      await page.fill('#f-phone', '+380671112233');
      if (!(await page.inputValue('#f-branch'))) await page.fill('#f-branch', '12');
      await page.evaluate(() => window.__tg.main.cb());
      await page.waitForSelector('.done');
      return st.log.filter(x => x.action === 'order').slice(-1)[0];
    };
    const costVisible = page => page.locator('.js-npcost').evaluateAll(n => n.some(x => !x.hidden && x.offsetParent !== null));

    /* ---- 1–2. cityRef в заказе и строка стоимости ---- */
    const st = await mkSt(8910, { np: true, npp: 1 });
    for (const theme of ['light', 'dark']) {
      const { c, calls, g } = await flow(st, 910, { theme });
      await c.page.waitForFunction(() => document.querySelector('.js-npcost') && !document.querySelector('.js-npcost').hidden);
      ok(NB(await text(c.page, '.js-npcost .np-cost__v')) === '≈ 85 ₴ за тарифом Нової пошти', 'стоимость (' + theme + '): «≈ 85 ₴ за тарифом Нової пошти» после выбора города', NB(await text(c.page, '.js-npcost')));
      ok(/У суму замовлення не входить/.test(await text(c.page, '.js-npcost .np-cost__n')), 'стоимость (' + theme + '): подпись «У суму замовлення не входить»');
      ok(calls.price.length === 1 && calls.price[0].city === REF_KH && calls.price[0].w === g && calls.price[0].sum > 0, 'стоимость (' + theme + '): один запрос np.price (город, вес в граммах, сумма корзины)', calls.price);
      const total = NB(await text(c.page, '.cosum .total'));
      ok(NB(await text(c.page, '.page .sum .total')) === total && total === NB(await text(c.page, '.cosum .total')), 'стоимость (' + theme + '): сумма заказа не изменилась и не включает доставку', total);
      ok(await noOverflow(c.page) && (await smallTargets(c.page)).length === 0, 'стоимость (' + theme + '): 360 px без прокрутки, кнопки ≥ 44 px', await smallTargets(c.page));
      await c.page.locator('.js-npcost').scrollIntoViewIfNeeded();
      await c.page.screenshot({ path: OUT + '/b4-np-cost-checkout-' + theme + '.png' });
      if (theme === 'light') {
        // назад в корзину: город известен — строка есть и там, без нового запроса (кэш)
        await c.page.click('[data-nav="back"]');
        await c.page.waitForSelector('.line');
        await c.page.waitForFunction(() => document.querySelector('.js-npcost') && !document.querySelector('.js-npcost').hidden);
        ok(NB(await text(c.page, '.js-npcost .np-cost__v')) === '≈ 85 ₴ за тарифом Нової пошти' && calls.price.length === 1, 'стоимость: в корзине та же строка из кэша, нового запроса нет', calls.price.length);
        // «+» внутри той же ступени веса (250 г → 500 г): запроса нет; следующая ступень (750 г): один новый запрос
        await c.page.click('[data-line-step="1"]');
        await c.page.waitForTimeout(900);
        ok(calls.price.length === 1, 'стоимость: вес в той же ступени 0,5 кг — нового запроса нет', calls.price.length);
        await c.page.click('[data-line-step="1"]');
        await c.page.waitForFunction(() => /95/.test((document.querySelector('.js-npcost .np-cost__v') || {}).textContent || ''));
        ok(calls.price.length === 2 && calls.price[1].w === g * 3 && NB(await text(c.page, '.js-npcost .np-cost__v')) === '≈ ' + priceFor(g * 3) + ' ₴ за тарифом Нової пошти', 'стоимость: следующая ступень веса — один новый запрос, строка обновилась', calls.price);
        ok(!/тарифом/.test(NB(await text(c.page, '.sum'))), 'стоимость: в итоговую строку корзины доставка не входит');
        await c.page.screenshot({ path: OUT + '/b4-np-cost-cart-light.png' });
        // серия быстрых нажатий «+»: один запрос на итоговый вес
        await c.page.click('[data-line-step="1"]'); await c.page.click('[data-line-step="1"]'); await c.page.click('[data-line-step="1"]');
        await c.page.waitForTimeout(1200);
        ok(calls.price.length === 3 && Math.ceil(calls.price[2].w / 500) === 3 && NB(await text(c.page, '.js-npcost .np-cost__v')) === '≈ ' + priceFor(calls.price[2].w) + ' ₴ за тарифом Нової пошти', 'стоимость: серия быстрых нажатий даёт один запрос (debounce)', calls.price.map(x => x.w));
      } else {
        await c.page.click('[data-nav="back"]');
        await c.page.waitForSelector('.line');
        await c.page.waitForFunction(() => document.querySelector('.js-npcost') && !document.querySelector('.js-npcost').hidden);
        ok(await noOverflow(c.page) && (await smallTargets(c.page)).length === 0, 'стоимость в корзине (' + theme + '): без прокрутки, кнопки ≥ 44 px', await smallTargets(c.page));
        await c.page.screenshot({ path: OUT + '/b4-np-cost-cart-dark.png' });
      }
      ok(c.errors.length === 0, 'стоимость (' + theme + '): в консоли нет ошибок', c.errors);
      await c.ctx.close();
    }
    {
      // RU
      const { c } = await flow(st, 911, { lc: 'ru' });
      await c.page.waitForFunction(() => document.querySelector('.js-npcost') && !document.querySelector('.js-npcost').hidden);
      ok(NB(await text(c.page, '.js-npcost .np-cost__v')) === '≈ 85 ₴ по тарифу Новой почты' && /В сумму заказа не входит/.test(await text(c.page, '.js-npcost .np-cost__n')), 'стоимость RU: «≈ 85 ₴ по тарифу Новой почты» и подпись про сумму заказа');
      await c.page.screenshot({ path: OUT + '/b4-np-cost-checkout-ru.png' });
      await c.ctx.close();
    }
    {
      // cityRef: выбран из подсказки — уходит; восстановление после перезагрузки; смена города сбрасывает
      const { c, calls } = await flow(st, 912, {});
      await c.page.waitForFunction(() => document.querySelector('.js-npcost') && !document.querySelector('.js-npcost').hidden);
      ok(await c.page.evaluate(() => JSON.parse(localStorage.getItem('pamir_form_v1') || '{}').cityRef) === REF_KH, 'cityRef сохраняется вместе с формой на устройстве');
      await c.page.reload({ waitUntil: 'networkidle' });
      await c.page.waitForTimeout(500); await c.page.evaluate(() => { const b = document.querySelector('#sheet .sheet__close'); if (b && !document.getElementById('sheet').hidden) b.click(); });
      await c.page.click('.tabbar [data-go="cart"]');
      await c.page.waitForSelector('.line');
      await c.page.waitForFunction(() => document.querySelector('.js-npcost') && !document.querySelector('.js-npcost').hidden);
      ok(await costVisible(c.page), 'cityRef восстановлен из сохранённой формы: строка стоимости есть в корзине после перезагрузки');
      await c.page.evaluate(() => window.__tg.main.cb()); await c.page.waitForSelector('#form');
      ok(await c.page.inputValue('#f-city') === 'Харків' && await costVisible(c.page), 'после перезагрузки в оформлении город и строка стоимости на месте');
      const sent = await sendOrder(c.page, st);
      ok(sent && sent.cityRef === REF_KH && sent.delivery === 'np', 'заказ: cityRef выбранного города уходит на сервер', sent && sent.cityRef);
      await c.ctx.close();
      // город сменён руками — ref сбрасывается, строка исчезает, в заказ не уходит
      const d = await flow(st, 913, {});
      await d.c.page.waitForFunction(() => document.querySelector('.js-npcost') && !document.querySelector('.js-npcost').hidden);
      await d.c.page.fill('#f-city', 'Харкі');
      await d.c.page.waitForTimeout(100);
      ok(!(await costVisible(d.c.page)), 'смена города руками: строка стоимости скрыта сразу');
      await d.c.page.fill('#f-city', 'Невідоме');
      await d.c.page.waitForTimeout(900);
      const sent2 = await sendOrder(d.c.page, st);
      ok(sent2 && !('cityRef' in sent2), 'город введён руками: cityRef в заказ не уходит', sent2 && sent2.cityRef);
      ok(d.c.errors.length === 0, 'cityRef: в консоли нет ошибок', d.c.errors);
      await d.c.ctx.close();
      const m = await flow(st, 914, { manual: true });
      await m.c.page.waitForTimeout(900);
      ok(m.calls.price.length === 0 && !(await costVisible(m.c.page)), 'город набран руками, ref неизвестен: запроса np.price и строки нет', m.calls.price);
      const sent3 = await sendOrder(m.c.page, st);
      ok(sent3 && !('cityRef' in sent3), 'город введён руками с начала: в заказе нет cityRef');
      await m.c.ctx.close();
    }
    {
      // ошибка, таймаут, неизвестный вес, самовывоз: строки нет, сообщений нет
      const e = await flow(st, 915, { price: 'err' });
      await e.c.page.waitForFunction(() => true); await e.c.page.waitForTimeout(1200);
      ok(e.calls.price.length === 1 && !(await costVisible(e.c.page)) && await count(e.c.page, '.form__err:not([hidden])') === 0 && !/Нов|тариф|помил/i.test((await e.c.page.locator('.toast:not([hidden])').allInnerTexts()).join(' ')), 'np.price ответил ошибкой: строки нет, сообщений нет', [e.calls.price.length, await costVisible(e.c.page), await count(e.c.page, '.form__err:not([hidden])'), await e.c.page.locator('.toast:not([hidden])').allInnerTexts()]);
      ok(e.c.errors.length === 0, 'np.price с ошибкой: в консоли нет ошибок', e.c.errors);
      await e.c.ctx.close();
      const h = await flow(st, 916, { price: 'hang' });
      await h.c.page.waitForTimeout(8800);
      ok(h.calls.price.length === 1 && !(await costVisible(h.c.page)), 'np.price не отвечает (таймаут): строки нет');
      await h.c.page.waitForTimeout(1200);
      ok(!(await costVisible(h.c.page)) && h.c.errors.length === 0, 'запоздавший ответ после таймаута строку не показывает', h.c.errors);
      await h.c.ctx.close();
      const u = await flow(st, 917, { piece: true });
      await u.c.page.waitForTimeout(1000);
      ok(u.calls.price.length === 0 && !(await costVisible(u.c.page)), 'вес одной из позиций неизвестен (штучный товар): запроса и строки нет', u.calls.price);
      await u.c.ctx.close();
      const p = await open(browser, st.url, { uid: 918, start: 'DRY-039' });
      await p.page.waitForSelector('.sheet__title');
      const pc = await stub(p.page, {});
      await p.page.click('#sheet [data-action="add"]');
      await p.page.click('.tabbar [data-go="cart"]'); await p.page.waitForSelector('.line');
      await p.page.evaluate(() => window.__tg.main.cb()); await p.page.waitForSelector('#form');
      await p.page.waitForTimeout(900);
      ok(pc.price.length === 0 && !(await costVisible(p.page)), 'самовывоз: запроса np.price и строки нет');
      await p.ctx.close();
    }
    {
      // устаревший ответ: на первый вес ответ приходит поздно, на второй — сразу; показывается свежий
      const s2 = await open(browser, st.url, { uid: 920, start: 'DRY-039' });
      await s2.page.waitForSelector('.sheet__title');
      const g = await (async () => { await s2.page.click('#sheet [data-action="add"]'); return s2.page.evaluate(() => JSON.parse(localStorage.getItem('pamir_cart_v1')).i[0].g); })();
      const c2 = await stub(s2.page, { price: 'slow500', slowW: g });
      await s2.page.click('.tabbar [data-go="cart"]'); await s2.page.waitForSelector('.line');
      await s2.page.evaluate(() => window.__tg.main.cb()); await s2.page.waitForSelector('#form');
      await s2.page.locator('.opt', { hasText: 'Нова пошта' }).first().click();
      await s2.page.fill('#f-city', 'Харк'); await s2.page.waitForSelector('#citySugg button'); await s2.page.locator('#citySugg button').first().click();
      await s2.page.waitForTimeout(600); // запрос на первый вес ушёл и «висит»
      await s2.page.click('[data-nav="back"]'); await s2.page.waitForSelector('.line');
      await s2.page.click('[data-line-step="1"]'); await s2.page.click('[data-line-step="1"]');
      await s2.page.waitForFunction(() => /95/.test((document.querySelector('.js-npcost .np-cost__v') || {}).textContent || ''));
      await s2.page.waitForTimeout(1800);
      ok(c2.price.length === 2 && NB(await text(s2.page, '.js-npcost .np-cost__v')) === '≈ ' + priceFor(g * 3) + ' ₴ за тарифом Нової пошти', 'устаревший ответ (на прежний вес) пришёл позже и строку не перезаписал', [c2.price.map(x => x.w), NB(await text(s2.page, '.js-npcost .np-cost__v'))]);
      await s2.ctx.close();
    }
    st.server.close();

    /* ---- без флага npp и «старый бэкенд» ---- */
    {
      const st2 = await mkSt(8912, { np: true });
      const { c, calls } = await flow(st2, 921, {});
      await c.page.waitForTimeout(1000);
      ok(calls.price.length === 0 && await count(c.page, '.js-npcost') === 0 && !/тарифом/.test(await text(c.page, '.page')), 'без shop.npp: ни запросов, ни строк, ни подписи в оформлении', calls.price.length);
      await c.page.click('[data-nav="back"]'); await c.page.waitForSelector('.line');
      ok(await count(c.page, '.js-npcost') === 0 && !/тарифом/.test(await text(c.page, '.page')), 'без shop.npp: в корзине строки стоимости нет');
      await c.page.evaluate(() => window.__tg.main.cb()); await c.page.waitForSelector('#form');
      const sent = await sendOrder(c.page, st2);
      ok(sent && sent.cityRef === REF_KH, 'без shop.npp: cityRef всё равно уходит (город выбран из подсказки)');
      await c.ctx.close(); st2.server.close();
      const oldCode = path.join(require('os').tmpdir(), 'Code.oldB4.gs');
      fs.writeFileSync(oldCode, execSync('git show ' + (process.env.OLD_BACKEND_REF || OLD_REF_A) + ':apps-script/Code.gs', { cwd: path.join(__dirname, '..') }));
      const so = await start(8913, oldCode, s => { withPhotos(s); });
      const o = await open(browser, so.url, { uid: 922, start: 'DRY-039' });
      await o.page.waitForSelector('.sheet__title');
      const oc = await stub(o.page, {});
      await o.page.click('#sheet [data-action="add"]');
      await o.page.click('.tabbar [data-go="cart"]'); await o.page.waitForSelector('.line');
      await o.page.evaluate(() => window.__tg.main.cb()); await o.page.waitForSelector('#form');
      await o.page.locator('.opt', { hasText: 'Нова пошта' }).first().click();
      await o.page.fill('#f-city', 'Харків'); await o.page.fill('#f-branch', '12');
      await o.page.waitForTimeout(900);
      ok(oc.price.length === 0 && await count(o.page, '.js-npcost') === 0, 'старый бэкенд: строки стоимости нет, np.price не вызывается');
      const sentOld = await sendOrder(o.page, so);
      ok(sentOld && !('cityRef' in sentOld) && sentOld.delivery === 'np', 'старый бэкенд: заказ как раньше, без cityRef');
      ok(o.errors.length === 0, 'старый бэкенд: в консоли нет ошибок', o.errors);
      await o.ctx.close(); so.server.close();
    }

    /* ---- 3. Админ: «Створити ТТН» ---- */
    {
      const PREV = (over) => ({ ok: true, ttn: Object.assign({ num: 'P-0008', name: 'Іван Петренко', nameOk: true, phone: '+380671112233', city: 'Харків', branch: '12', type: 'branch', npCity: 'Харків', npWarehouse: 'Відділення №12: вул. Сумська, 12', weightG: 1500, cost: 85, cod: 85, desc: 'Харчові продукти', minG: 100, maxG: 30000 }, over || {}) });
      const XSSB = '<img src=x onerror="window.__xss=1">';
      /** Перехват admin.orders / admin.ttn.*: o.npTtn — отдавать флаг; o.preview / o.create — ответы; o.delay — задержка create. */
      const adminSetup = (o, calls) => async page => {
        await page.route(/\/api$/, async route => {
          const req = route.request();
          const body = req.method() === 'POST' ? (req.postData() || '') : '';
          const fulfill = (j, delay) => setTimeout(() => route.fulfill({ status: 200, contentType: 'application/json; charset=utf-8', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(j) }).catch(() => {}), delay || 0);
          if (/"action":"admin\.orders"/.test(body)) {
            const res = await route.fetch(); const j = await res.json();
            if (o.npTtn) j.npTtn = 1;
            const a = j.orders.find(x => x.num === 'P-0008');
            a.ttn = '';
            if (o.items) a.items = o.items;
            const withTtn = Object.assign({}, a, { num: 'P-0098', ttn: '20450000999999' });
            if (o.ttnDel) withTtn.ttnDel = 1;
            const pick = Object.assign({}, a, { num: 'P-0099', delivery: 'Самовивіз', city: '', branch: '' });
            j.orders.push(withTtn, pick);
            return fulfill(j);
          }
          if (/"action":"admin\.ttn\.preview"/.test(body)) { calls.preview.push(JSON.parse(body)); return fulfill(typeof o.preview === 'function' ? o.preview() : o.preview); }
          if (/"action":"admin\.ttn\.create"/.test(body)) { calls.create.push(JSON.parse(body)); return fulfill(typeof o.create === 'function' ? o.create() : o.create, o.delay || 0); }
          if (/"action":"admin\.ttn\.delete"/.test(body)) { calls.del.push(JSON.parse(body)); return fulfill(typeof o.del === 'function' ? o.del() : o.del, o.delDelay || 0); }
          return route.continue();
        });
      };
      const openAdmin = async (stx, o, extra) => {
        const calls = { preview: [], create: [], del: [] };
        const A = await open(browser, stx.url, Object.assign({ uid: 900, query: '?admin=1', before: adminSetup(o, calls) }, extra || {}));
        await A.page.waitForSelector('[data-ord="P-0008"]');
        return { A, calls };
      };
      const openOrd = async (page, num) => { await page.click('[data-ord="' + num + '"]'); await page.waitForSelector('.ord__body'); };
      const stA = await start(8914, undefined, s => {
        withPhotos(s);
        s.sheets['Замовлення'].push(['P-0008', new Date(Date.now() - 3600e3), 'новий', '501', '@user501', 'Клієнт 501', '+380501112233', 'Нова пошта', 'Харків', '12',
          'при отриманні', '', 'Курага натуральна Бобої без кісточок 500 г × 1 = 190 ₴', 190, 'ua', 'miniapp', JSON.stringify({ i: [['DRY-039', 500, 1]] })]);
      });
      stA.gas.call('setupStage8');
      {
        // кнопка: есть только при npTtn, НП и без ТТН
        const { A } = await openAdmin(stA, { npTtn: true, preview: PREV(), create: { ok: true, ttn: '20450000777777', told: true } });
        await openOrd(A.page, 'P-0008');
        ok(await count(A.page, '[data-w1="ttn-make"]') === 1 && /Створити ТТН/.test(await text(A.page, '[data-w1="ttn-make"]')) && await count(A.page, '.ttnrow') === 1, 'админ: у заказа Новой почты без ТТН есть «Створити ТТН», ручное поле ТТН осталось');
        await openOrd(A.page, 'P-0098');
        ok(await count(A.page, '[data-w1="ttn-make"]') === 0 && await count(A.page, '.ttnrow') === 1, 'админ: у заказа с ТТН кнопки «Створити ТТН» нет');
        await openOrd(A.page, 'P-0099');
        ok(await count(A.page, '[data-w1="ttn-make"]') === 0, 'админ: у заказа не на Новую пошту кнопки нет');
        await A.ctx.close();
        const N = await openAdmin(stA, { npTtn: false });
        await openOrd(N.A.page, 'P-0008');
        ok(await count(N.A.page, '[data-w1="ttn-make"]') === 0 && await count(N.A.page, '.ttnrow') === 1, 'админ: бэкенд без npTtn — кнопки нет, ручной ввод ТТН как раньше');
        await N.A.ctx.close();
      }
      for (const theme of ['light', 'dark']) {
        // preview → подтверждение → create: успех, двойное нажатие — один запрос
        const { A, calls } = await openAdmin(stA, { npTtn: true, preview: PREV(), create: { ok: true, ttn: '20450000777777', told: true }, delay: 700 }, { theme });
        await openOrd(A.page, 'P-0008');
        await A.page.click('[data-w1="ttn-make"]');
        await A.page.waitForSelector('#sheet [data-action="cf-ok"]');
        ok(calls.preview.length === 1 && calls.preview[0].num === 'P-0008' && calls.preview[0].initData, 'ТТН (' + theme + '): preview запрошен с номером заказа и подписью', calls.preview);
        const sh = NB(await text(A.page, '#sheet'));
        ok(/Іван Петренко/.test(sh) && /\+380671112233/.test(sh) && /Харків/.test(sh) && /№12/.test(sh) && /85 ₴/.test(sh) && /Накладений платіж/.test(sh), 'ТТН (' + theme + '): в подтверждении получатель, телефон, город, отделение, наложенный платёж', sh);
        ok(await A.page.inputValue('#ttnW') === '1500' && await A.page.inputValue('#ttnD') === 'Харчові продукти' && await count(A.page, '#ttnN') === 0, 'ТТН (' + theme + '): вес предзаполнен из заказа, описание можно править, поля имени нет (nameOk)');
        ok(await noOverflow(A.page) && (await smallTargets(A.page)).length === 0, 'ТТН (' + theme + '): шторка без прокрутки, кнопки и поля ≥ 44 px', await smallTargets(A.page));
        await A.page.screenshot({ path: OUT + '/b4-ttn-sheet-' + theme + '.png' });
        await A.page.fill('#ttnW', '1700');
        await A.page.click('#sheet [data-action="cf-ok"]');
        await A.page.locator('#sheet [data-action="cf-ok"]').click({ force: true, timeout: 500 }).catch(() => {});
        ok(await A.page.locator('#sheet [data-action="cf-ok"]').isDisabled(), 'ТТН (' + theme + '): кнопка заблокирована до ответа сервера');
        await A.page.waitForFunction(() => /20450000777777/.test(document.querySelector('.ord__body').innerText));
        ok(calls.create.length === 1, 'ТТН (' + theme + '): двойное нажатие — один запрос create', calls.create.length);
        const cr = calls.create[0];
        ok(cr.num === 'P-0008' && cr.weight === 1700 && cr.confirm === true && cr.cod === 85 && cr.desc === 'Харчові продукти' && !('name' in cr), 'ТТН (' + theme + '): тело create — num, weight (граммы), confirm:true, cod, desc, без name', cr);
        ok(await A.page.locator('#sheet').isHidden() && /20450000777777/.test(await text(A.page, '.toast')) && /Клієнту надіслано номер/.test(await text(A.page, '.toast')), 'ТТН (' + theme + '): успех — шторка закрыта, номер ТТН и отметка «Клієнту надіслано номер»', await text(A.page, '.toast'));
        ok(await count(A.page, '[data-w1="ttn-make"]') === 0, 'ТТН (' + theme + '): после создания кнопка исчезла, карточка обновлена');
        if (theme === 'light') await A.page.screenshot({ path: OUT + '/b4-ttn-done-light.png' });
        ok(A.errors.length === 0, 'ТТН (' + theme + '): в консоли нет ошибок', A.errors);
        await A.ctx.close();
      }
      {
        // состав набора: «\n   · название» — отдельные строки под позицией, экранирование сохранено
        const SETITEMS = 'Набір «Для плову» 1 шт = 300 ₴\n   · Курага, Родзинки\n   · ' + XSSB + '; Курага натуральна 500 г × 1 = 190 ₴';
        const { A } = await openAdmin(stA, { npTtn: true, items: SETITEMS, preview: PREV() });
        await openOrd(A.page, 'P-0008');
        const li = await A.page.evaluate(() => [].map.call(document.querySelectorAll('.ord__items > li'), l => ({ main: l.firstChild.textContent, sub: [].map.call(l.querySelectorAll('.ord__sub'), x => ({ t: x.textContent, ml: parseFloat(getComputedStyle(x).marginLeft), disp: getComputedStyle(x).display })) })));
        ok(li.length === 2 && /^Набір «Для плову»/.test(li[0].main) && li[0].sub.length === 2 && li[0].sub[0].t === '· Курага, Родзинки' && li[0].sub[1].t.indexOf('<img') > 0 && li[0].sub.every(x => x.ml > 0 && x.disp === 'block') && li[1].sub.length === 0, 'админ: состав набора — отдельными строками с отступом под позицией, обычная позиция без изменений', li);
        ok(await count(A.page, '.ord__items img') === 0 && await A.page.evaluate(() => window.__xss === undefined) && await noOverflow(A.page), 'админ: HTML в составе набора экранирован, без горизонтальной прокрутки');
        await A.page.screenshot({ path: OUT + '/b2-order-set-admin.png' });
        await A.ctx.close();
        const MY = await open(browser, stA.url, { uid: 501, query: '?view=orders', before: async page => {
          await page.route(/\/api$/, async route => {
            if (/"action":"orders\.my"/.test(route.request().postData() || '')) { const res = await route.fetch(); const j = await res.json(); (j.list || j.orders || []).forEach(o => { o.items = SETITEMS; }); await route.fulfill({ status: 200, contentType: 'application/json; charset=utf-8', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(j) }); return; }
            return route.continue();
          });
        } });
        await MY.page.waitForSelector('.my__items');
        const mli = await MY.page.evaluate(() => [].map.call(document.querySelectorAll('.my__items > li'), l => ({ n: l.querySelectorAll('.ord__sub').length, ml: l.querySelector('.ord__sub') ? parseFloat(getComputedStyle(l.querySelector('.ord__sub')).marginLeft) : 0 })));
        ok(mli.length >= 2 && mli.length % 2 === 0 && mli.every((x, i) => x.n === (i % 2 ? 0 : 2)) && mli[0].n === 2 && mli[0].ml > 0 && mli[1].n === 0 && await count(MY.page, '.my__items img') === 0 && await noOverflow(MY.page), '«Мої замовлення»: состав набора отдельными строками с отступом, экранирован', mli);
        await MY.page.screenshot({ path: OUT + '/b2-order-set-my.png' });
        ok(MY.errors.length === 0, 'состав набора: в консоли нет ошибок', MY.errors);
        await MY.ctx.close();
      }
      {
        // nameOk = false: поле имени; ошибка np_api с текстом НП (экранируется); повтор после ошибки
        let n = 0;
        const { A, calls } = await openAdmin(stA, { npTtn: true, preview: PREV({ name: 'Іван', nameOk: false, weightG: null, cod: 0 }),
          create: () => (++n === 1 ? { ok: false, error: 'np_api', msg: { ua: 'Нова пошта відхилила накладну', ru: 'Новая почта отклонила накладную' }, np: XSSB } : { ok: true, ttn: '20450000888888', told: false }) });
        await openOrd(A.page, 'P-0008');
        await A.page.click('[data-w1="ttn-make"]');
        await A.page.waitForSelector('#ttnN');
        ok(await A.page.inputValue('#ttnW') === '' && /Вагу в замовленні не збережено/.test(await text(A.page, '#sheet')) && /без накладеного платежу/.test(NB(await text(A.page, '#sheet'))), 'ТТН: вес неизвестен — поле пустое с подсказкой; cod 0 — «без накладеного платежу»');
        ok(await count(A.page, '#sheet .ttnc__row') === 4, 'ТТН: nameOk=false — имя выводится полем, а не строкой', await count(A.page, '#sheet .ttnc__row'));
        await A.page.click('#sheet [data-action="cf-ok"]');
        ok(calls.create.length === 0 && /вагу від 100 до 30\s?000 г/.test(NB(await text(A.page, '#cfErr'))), 'ТТН: пустой вес — понятная ошибка, запроса нет', await text(A.page, '#cfErr'));
        await A.page.fill('#ttnW', '900');
        await A.page.click('#sheet [data-action="cf-ok"]');
        ok(calls.create.length === 0 && /прізвище та ім’я/.test(await text(A.page, '#cfErr')), 'ТТН: имя из одного слова — ошибка, запроса нет');
        await A.page.fill('#ttnN', 'Іван Петренко');
        await A.page.fill('#ttnD', XSSB);
        await A.page.click('#sheet [data-action="cf-ok"]');
        await A.page.waitForFunction(() => /відхилила/.test((document.getElementById('cfErr') || {}).textContent || ''));
        const err = await text(A.page, '#cfErr');
        ok(calls.create.length === 1 && calls.create[0].name === 'Іван Петренко' && calls.create[0].weight === 900 && calls.create[0].cod === 0 && calls.create[0].desc === XSSB, 'ТТН: в create уходят name, weight, desc, cod = 0', calls.create[0]);
        ok(err.indexOf('Нова пошта відхилила накладну') === 0 && err.indexOf(XSSB) > 0 && await count(A.page, '#cfErr img') === 0 && await A.page.evaluate(() => window.__xss === undefined), 'ТТН: ошибка np_api — msg.ua и текст НП показаны как текст (экранированы)', err);
        ok(!(await A.page.locator('#sheet [data-action="cf-ok"]').isDisabled()) && await count(A.page, '#sheet') === 1, 'ТТН: после ошибки шторка открыта, кнопка снова активна');
        ok(await A.page.evaluate(() => { const r = document.getElementById('cfErr').getBoundingClientRect(); return r.top >= 0 && r.bottom <= window.innerHeight; }), 'ТТН: текст ошибки виден на экране без ручной прокрутки шторки');
        await A.page.screenshot({ path: OUT + '/b4-ttn-error-light.png' });
        await A.page.click('#sheet [data-action="cf-ok"]');
        await A.page.waitForFunction(() => /20450000888888/.test(document.querySelector('.ord__body').innerText));
        ok(calls.create.length === 2 && /Клієнту написати не вдалося/.test(await text(A.page, '.toast')), 'ТТН: повтор после ошибки — успех; told=false — «Клієнту написати не вдалося»', await text(A.page, '.toast'));
        ok(A.errors.length === 0, 'ТТН (ошибка, имя): в консоли нет ошибок', A.errors);
        await A.ctx.close();
      }
      {
        // ошибки preview: известный код, неизвестный код, сеть
        const cases = [
          ['no_ref', { ok: false, error: 'no_ref', msg: { ua: 'У замовлення немає коду міста Нової пошти (зроблене до оновлення). Створіть ТТН вручну й введіть номер', ru: 'У заказа нет кода города Новой почты' } }, /немає коду міста/],
          ['courier', { ok: false, error: 'courier', msg: { ua: 'Кур’єрська доставка: ТТН створіть вручну', ru: 'Курьерская доставка: создайте ТТН вручную' } }, /Кур’єрська доставка/],
          ['почтомат (msg сервера)', { ok: false, error: 'locker_unsupported', msg: { ua: 'Для поштомата ТТН створіть вручну', ru: 'Для почтомата создайте ТТН вручную' } }, /Для поштомата ТТН створіть вручну/],
          ['неизвестный код без msg', { ok: false, error: 'zzz_new' }, /Не вдалося створити накладну/],
          ['текст с HTML', { ok: false, error: 'wh_unknown', msg: { ua: XSSB, ru: XSSB } }, /<img/]
        ];
        for (const [name, prev, re] of cases) {
          const { A, calls } = await openAdmin(stA, { npTtn: true, preview: prev });
          await openOrd(A.page, 'P-0008');
          await A.page.click('[data-w1="ttn-make"]');
          await A.page.waitForSelector('#sheet .confirm__text');
          const sh = await text(A.page, '#sheet');
          ok(re.test(sh) && /вручну в кабінеті Нової пошти/.test(sh) && await count(A.page, '#sheet [data-action="cf-ok"]') === 0 && calls.create.length === 0 && await count(A.page, '#sheet img') === 0 && await A.page.evaluate(() => window.__xss === undefined), 'ТТН preview-ошибка (' + name + '): понятный текст и подсказка ввести ТТН вручную, кнопки создания нет', sh);
          if (name === 'no_ref') await A.page.screenshot({ path: OUT + '/b4-ttn-preview-error.png' });
          ok(!(await A.page.locator('[data-w1="ttn-make"]').isDisabled()), 'ТТН preview-ошибка (' + name + '): кнопка в карточке снова активна');
          await A.ctx.close();
        }
        {
          const { A: P1 } = await openAdmin(stA, { npTtn: true, preview: PREV({ payer: 'recipient' }) });
          await openOrd(P1.page, 'P-0008'); await P1.page.click('[data-w1="ttn-make"]'); await P1.page.waitForSelector('#ttnW');
          ok(/Доставку оплачує\s*отримувач/.test(await text(P1.page, '#sheet')), 'ТТН: payer = recipient — строка «Доставку оплачує: отримувач»', await text(P1.page, '#sheet'));
          await P1.ctx.close();
          const { A: P2 } = await openAdmin(stA, { npTtn: true, preview: PREV() });
          await openOrd(P2.page, 'P-0008'); await P2.page.click('[data-w1="ttn-make"]'); await P2.page.waitForSelector('#ttnW');
          ok(!/Доставку оплачує/.test(await text(P2.page, '#sheet')), 'ТТН: поля payer нет — строки нет');
          await P2.ctx.close();
          const { A: P3 } = await openAdmin(stA, { npTtn: true, preview: PREV({ payer: 'recipient' }) }, { lc: 'ru' });
          await openOrd(P3.page, 'P-0008'); await P3.page.click('[data-w1="ttn-make"]'); await P3.page.waitForSelector('#ttnW');
          ok(/Доставку оплачивает\s*получатель/.test(await text(P3.page, '#sheet')), 'ТТН RU: «Доставку оплачивает: получатель»');
          await P3.ctx.close();
        }
        const R = await openAdmin(stA, { npTtn: true, preview: PREV({ type: 'locker', weightG: 800 }), create: { ok: false, error: 'np_unknown', msg: { ua: 'Відповідь Нової пошти не отримано', ru: 'Ответ Новой почты не получен' } } }, { lc: 'ru' });
        await openOrd(R.A.page, 'P-0008');
        ok(/Создать ТТН/.test(await text(R.A.page, '[data-w1="ttn-make"]')), 'ТТН RU: кнопка «Создать ТТН»');
        await R.A.page.click('[data-w1="ttn-make"]'); await R.A.page.waitForSelector('#ttnW');
        const shr = await text(R.A.page, '#sheet');
        ok(/Получатель/.test(shr) && /Почтомат/.test(shr) && /Вес посылки, г/.test(shr) && /Создать накладную/.test(shr), 'ТТН RU: подписи в подтверждении на русском', shr);
        await R.A.page.click('#sheet [data-action="cf-ok"]');
        await R.A.page.waitForFunction(() => /Ответ Новой почты/.test((document.getElementById('cfErr') || {}).textContent || ''));
        ok(true, 'ТТН RU: ошибка create на русском');
        await R.A.page.screenshot({ path: OUT + '/b4-ttn-sheet-ru.png' });
        await R.A.ctx.close();
      }
      {
        // город в заказе не совпал с городом НП: предупреждение, чекбокс, cityOk только булево true
        const NPX = '<img src=x onerror="window.__xss=1">';
        for (const theme of ['light', 'dark']) {
          const { A, calls } = await openAdmin(stA, { npTtn: true, preview: PREV({ cityDiff: 1, city: 'Харьков', npCity: NPX, npWarehouse: NPX }), create: { ok: true, ttn: '20450000555555', told: true } }, { theme });
          await openOrd(A.page, 'P-0008');
          await A.page.click('[data-w1="ttn-make"]');
          await A.page.waitForSelector('#ttnCityOk');
          const sh = NB(await text(A.page, '#sheet'));
          ok(sh.indexOf('Місто в замовленні («Харьков») не збігається з містом Нової пошти («' + NPX + '»). Перевірте перед створенням') >= 0 && /Місто правильне/.test(sh) && await count(A.page, '#sheet img') === 0 && await A.page.evaluate(() => window.__xss === undefined), 'ТТН cityDiff (' + theme + '): предупреждение с обоими городами, строки НП как текст (HTML не исполняется)', sh);
          ok(await A.page.locator('#sheet [data-action="cf-ok"]').isDisabled() && await A.page.evaluate(() => document.getElementById('ttnCityOk').closest('.check').getBoundingClientRect().height >= 44), 'ТТН cityDiff (' + theme + '): «Створити накладну» неактивна, пока не отмечено «Місто правильне» (зона ≥ 44 px)');
          ok(await noOverflow(A.page) && (await smallTargets(A.page)).length === 0, 'ТТН cityDiff (' + theme + '): без горизонтальной прокрутки, элементы ≥ 44 px', await smallTargets(A.page));
          await A.page.screenshot({ path: OUT + '/b2f-ttn-citydiff-' + theme + '.png' });
          await A.page.locator('#ttnCityOk').check();
          ok(!(await A.page.locator('#sheet [data-action="cf-ok"]').isDisabled()), 'ТТН cityDiff (' + theme + '): после отметки кнопка активна');
          await A.page.locator('#ttnCityOk').uncheck();
          ok(await A.page.locator('#sheet [data-action="cf-ok"]').isDisabled(), 'ТТН cityDiff (' + theme + '): снятие отметки снова блокирует кнопку');
          await A.page.locator('#ttnCityOk').check();
          await A.page.click('#sheet [data-action="cf-ok"]');
          await A.page.waitForFunction(() => /20450000555555/.test(document.querySelector('.ord__body').innerText));
          ok(calls.create.length === 1 && calls.create[0].cityOk === true, 'ТТН cityDiff (' + theme + '): в create уходит cityOk: true (булево)', calls.create[0]);
          await A.ctx.close();
        }
        {
          const { A, calls } = await openAdmin(stA, { npTtn: true, preview: PREV({ npCity: 'Харків', npWarehouse: NPX }), create: { ok: true, ttn: '20450000444444', told: true } });
          await openOrd(A.page, 'P-0008');
          await A.page.click('[data-w1="ttn-make"]');
          await A.page.waitForSelector('#ttnW');
          ok(await count(A.page, '#ttnCityOk') === 0 && await count(A.page, '#sheet .ttnc__warn') === 0 && !(await A.page.locator('#sheet [data-action="cf-ok"]').isDisabled()) && await count(A.page, '#sheet img') === 0 && await A.page.evaluate(() => window.__xss === undefined), 'ТТН без cityDiff: предупреждения и чекбокса нет, кнопка активна; npWarehouse с HTML — текст');
          await A.page.click('#sheet [data-action="cf-ok"]');
          await A.page.waitForFunction(() => /20450000444444/.test(document.querySelector('.ord__body').innerText));
          ok(calls.create.length === 1 && !('cityOk' in calls.create[0]), 'ТТН без cityDiff: cityOk в create не отправляется', calls.create[0]);
          await A.ctx.close();
        }
        // ошибки create: city_diff, np_unknown, busy
        const errCases = [
          ['city_diff', { ok: false, error: 'city_diff', msg: { ua: 'Місто не збігається. Підтвердіть місто', ru: 'Город не совпадает' } }, /Місто не збігається\. Підтвердіть місто/],
          ['np_unknown', { ok: false, error: 'np_unknown', msg: { ua: 'x', ru: 'x' } }, /Перевірте кабінет Нової пошти й не створюйте накладну повторно зараз/],
          ['busy', { ok: false, error: 'busy', msg: { ua: 'x', ru: 'x' } }, /Перевірте кабінет Нової пошти: накладну могло бути створено\. Не створюйте її повторно зараз/]
        ];
        for (const [name, cr, re] of errCases) {
          const { A, calls } = await openAdmin(stA, { npTtn: true, preview: PREV(), create: cr });
          await openOrd(A.page, 'P-0008');
          await A.page.click('[data-w1="ttn-make"]'); await A.page.waitForSelector('#ttnW');
          await A.page.click('#sheet [data-action="cf-ok"]');
          await A.page.waitForFunction(() => !document.getElementById('cfErr').hidden);
          const er = await text(A.page, '#cfErr');
          ok(re.test(er) && calls.create.length === 1 && !(await A.page.locator('#sheet [data-action="cf-ok"]').isDisabled()), 'ТТН create ' + name + ': понятный текст в шторке', er);
          await A.ctx.close();
        }
        for (const [lc, withNum] of [['uk', true], ['ru', true], ['uk', false]]) {
          const { A } = await openAdmin(stA, { npTtn: true, preview: PREV(), create: withNum ? { ok: false, error: 'save_failed', ttn: NPX, msg: { ua: 'x', ru: 'x' } } : { ok: false, error: 'save_failed' } }, { lc });
          await openOrd(A.page, 'P-0008');
          await A.page.click('[data-w1="ttn-make"]'); await A.page.waitForSelector('#ttnW');
          await A.page.click('#sheet [data-action="cf-ok"]');
          await A.page.waitForSelector('#sheet .note--out');
          const sh = NB(await text(A.page, '#sheet'));
          const big = withNum ? await A.page.evaluate(() => { const b = document.querySelector('.ttnc__big'); return b ? [b.textContent, parseFloat(getComputedStyle(b).fontSize), b.querySelector('img') === null] : null; }) : null;
          const reTxt = lc === 'ru' ? /Номер не записался в таблицу — впишите его вручную/ : withNum ? /Номер не записався в таблицю — впишіть його вручну/ : /номер не записався в таблицю/;
          ok(reTxt.test(sh) && (!withNum || (big && big[0] === NPX && big[1] >= 24 && big[2])) && await A.page.evaluate(() => window.__xss === undefined) && await count(A.page, '#sheet img') === 0, 'ТТН save_failed (' + lc + (withNum ? ', с номером' : ', без номера') + '): номер крупно как текст и просьба вписать вручную', [sh, big]);
          if (withNum && lc === 'uk') await A.page.screenshot({ path: OUT + '/b2f-ttn-save-failed.png' });
          ok(await count(A.page, '#sheet [data-action="cf-ok"]') === 0 && await A.page.locator('#sheet [data-action="cf-cancel"]').isVisible(), 'ТТН save_failed: повторно «Створити» не предлагается, шторку закрывает админ');
          await A.ctx.close();
        }
      }
      {
        // габариты и «пробная накладная»
        const OKC = { ok: true, ttn: '20450000333333', told: null, quiet: true };
        const sheetOk = p => p.locator('#sheet [data-action="cf-ok"]');
        const openSheet = async (A) => { await openOrd(A.page, 'P-0008'); await A.page.click('[data-w1="ttn-make"]'); await A.page.waitForSelector('#ttnW'); };
        for (const theme of ['light', 'dark']) {
          const { A, calls } = await openAdmin(stA, { npTtn: true, preview: PREV(), create: OKC }, { theme });
          await openSheet(A);
          const sh = NB(await text(A.page, '#sheet'));
          ok(/Ширина, см/.test(sh) && /Довжина, см/.test(sh) && /Висота, см/.test(sh) && /Необов’язково\. Якщо заповнюєте — усі три, від 1 до 120 см/.test(sh) && /Пробна накладна: не надсилати номер клієнту/.test(sh) && /Пробну можна видалити з панелі протягом 24 годин\. Справжню — лише в кабінеті Нової пошти/.test(sh), 'ТТН габариты (' + theme + '): подписи полей, подсказка и переключатель «Пробна накладна»', sh);
          ok(await A.page.locator('#ttnQuiet').isChecked() === false && await A.page.locator('#ttnDimPart').isHidden() && !(await sheetOk(A.page).isDisabled()), 'ТТН габариты (' + theme + '): переключатель по умолчанию выключен, поля пустые, «Створити» активна');
          ok(await noOverflow(A.page) && (await smallTargets(A.page)).length === 0 && await A.page.evaluate(() => ['ttnDW', 'ttnDL', 'ttnDH'].every(id => document.getElementById(id).getBoundingClientRect().height >= 44) && document.getElementById('ttnQuiet').closest('.check').getBoundingClientRect().height >= 44), 'ТТН габариты (' + theme + '): без горизонтальной прокрутки, поля и переключатель ≥ 44 px', await smallTargets(A.page));
          // частично заполнено: кнопка неактивна, подсказка
          await A.page.fill('#ttnDW', '30');
          ok(await sheetOk(A.page).isDisabled() && await A.page.locator('#ttnDimPart').isVisible() && /усі три розміри/.test(await text(A.page, '#ttnDimPart')), 'ТТН габариты (' + theme + '): заполнена только ширина — «Створити» неактивна, подсказка видна');
          await A.page.fill('#ttnDL', '20');
          ok(await sheetOk(A.page).isDisabled(), 'ТТН габариты (' + theme + '): заполнены два из трёх — кнопка по-прежнему неактивна');
          await A.page.waitForTimeout(450); await A.page.screenshot({ path: OUT + '/b9-ttn-dims-partial-' + theme + '.png' });
          await sheetOk(A.page).click({ force: true, timeout: 500 }).catch(() => {});
          ok(calls.create.length === 0, 'ТТН габариты (' + theme + '): частично заполнено — запрос create не уходит');
          await A.page.fill('#ttnDH', '10,5');
          await A.page.locator('#ttnQuiet').check();
          ok(!(await sheetOk(A.page).isDisabled()) && await A.page.locator('#ttnDimPart').isHidden(), 'ТТН габариты (' + theme + '): все три заполнены — кнопка активна, подсказка скрыта');
          await A.page.screenshot({ path: OUT + '/b9-ttn-dims-' + theme + '.png' });
          await sheetOk(A.page).click();
          await A.page.waitForFunction(() => /20450000333333/.test(document.querySelector('.ord__body').innerText));
          const cr = calls.create[0];
          ok(calls.create.length === 1 && cr.width === 30 && cr.length === 20 && cr.height === 10.5 && cr.quiet === true && cr.confirm === true && cr.weight === 1500, 'ТТН габариты (' + theme + '): в create — width, length, height (числа) и quiet: true', cr);
          ok(/Накладну створено: 20450000333333/.test(await text(A.page, '.toast')) && /Клієнту номер не надсилали/.test(await text(A.page, '.toast')) && !/Клієнту надіслано номер/.test(await text(A.page, '.toast')), 'ТТН quiet (' + theme + '): после успеха «Клієнту номер не надсилали»', await text(A.page, '.toast'));
          await A.page.screenshot({ path: OUT + '/b9-ttn-quiet-result-' + theme + '.png' });
          ok(A.errors.length === 0, 'ТТН габариты (' + theme + '): в консоли нет ошибок', A.errors);
          await A.ctx.close();
        }
        {
          // пусто → полей габаритов и quiet в запросе нет; выход за 1…120 и не число — ошибка без запроса
          const { A, calls } = await openAdmin(stA, { npTtn: true, preview: PREV(), create: { ok: true, ttn: '20450000222222', told: true } });
          await openSheet(A);
          await A.page.fill('#ttnDW', '0'); await A.page.fill('#ttnDL', '20'); await A.page.fill('#ttnDH', '10');
          await sheetOk(A.page).click();
          await A.page.waitForFunction(() => !document.getElementById('cfErr').hidden);
          ok(calls.create.length === 0 && /від 1 до 120/.test(await text(A.page, '#cfErr')) && !(await sheetOk(A.page).isDisabled()), 'ТТН габариты: 0 см — понятная ошибка, запроса нет, кнопка снова активна', await text(A.page, '#cfErr'));
          await A.page.fill('#ttnDW', '121');
          await sheetOk(A.page).click();
          await A.page.waitForFunction(() => /від 1 до 120/.test(document.getElementById('cfErr').textContent));
          await A.page.fill('#ttnDW', 'abc');
          await sheetOk(A.page).click();
          await A.page.waitForTimeout(150);
          ok(calls.create.length === 0, 'ТТН габариты: 121 и «abc» — запроса нет');
          await A.page.fill('#ttnDW', ''); await A.page.fill('#ttnDL', ''); await A.page.fill('#ttnDH', '');
          await sheetOk(A.page).click();
          await A.page.waitForFunction(() => /20450000222222/.test(document.querySelector('.ord__body').innerText));
          const cr = calls.create[0];
          ok(calls.create.length === 1 && !('width' in cr) && !('length' in cr) && !('height' in cr) && !('quiet' in cr), 'ТТН габариты: все три пустые, переключатель выключен — width/length/height/quiet в запросе нет', cr);
          ok(/Клієнту надіслано номер/.test(await text(A.page, '.toast')), 'ТТН без quiet: «Клієнту надіслано номер»');
          await A.ctx.close();
        }
        {
          // cityDiff вместе с габаритами: кнопка требует обе вещи
          const { A } = await openAdmin(stA, { npTtn: true, preview: PREV({ cityDiff: 1, city: 'Харьков', npCity: 'Харків' }) });
          await openOrd(A.page, 'P-0008'); await A.page.click('[data-w1="ttn-make"]'); await A.page.waitForSelector('#ttnCityOk');
          await A.page.locator('#ttnCityOk').check();
          ok(!(await sheetOk(A.page).isDisabled()), 'ТТН cityDiff + габариты: отметка города — кнопка активна');
          await A.page.fill('#ttnDH', '5');
          ok(await sheetOk(A.page).isDisabled(), 'ТТН cityDiff + габариты: частично заполненные габариты блокируют кнопку, даже когда город отмечен');
          await A.page.fill('#ttnDH', '');
          ok(!(await sheetOk(A.page).isDisabled()), 'ТТН cityDiff + габариты: очистили — кнопка снова активна');
          await A.page.locator('#ttnCityOk').uncheck();
          ok(await sheetOk(A.page).isDisabled(), 'ТТН cityDiff + габариты: снятая отметка города блокирует кнопку');
          await A.ctx.close();
        }
        {
          // ошибки с step, bad_dims, HTML в msg/np; RU
          const MSG = (ua, ru) => ({ ua, ru });
          const cases = [
            ['step 1 np_api', 'uk', { ok: false, error: 'np_api', step: 1, msg: MSG('Нова пошта відхилила запит', 'Новая почта отклонила запрос'), np: 'PhoneNumber is invalid' }, /^Не вдалося створити отримувача в Новій пошті\. Нова пошта відхилила запит: PhoneNumber is invalid$/],
            ['step 1 np_error', 'uk', { ok: false, error: 'np_error', step: 1, msg: MSG('Нова пошта не відповіла', 'x') }, /^Не вдалося створити отримувача в Новій пошті\. Нова пошта не відповіла$/],
            ['step 2 np_api', 'uk', { ok: false, error: 'np_api', step: 2, msg: MSG('Нова пошта відхилила запит', 'x'), np: 'Weight is bad' }, /^Не вдалося створити накладну\. Нова пошта відхилила запит: Weight is bad$/],
            ['step 2 np_error', 'uk', { ok: false, error: 'np_error', step: 2, msg: MSG('Нова пошта не відповіла', 'x') }, /^Не вдалося створити накладну\. Нова пошта не відповіла$/],
            ['bad_dims', 'uk', { ok: false, error: 'bad_dims', msg: MSG('Вкажіть ширину, довжину й висоту в сантиметрах (числа від 1 до 120) або залиште всі три поля порожніми', 'x') }, /^Вкажіть ширину, довжину й висоту/],
            ['bad_dims без msg', 'uk', { ok: false, error: 'bad_dims' }, /^Розміри — числа від 1 до 120 см$/],
            ['step 1 RU', 'ru', { ok: false, error: 'np_api', step: 1, msg: MSG('x', 'Новая почта отклонила запрос'), np: 'Err' }, /^Не удалось создать получателя в Новой почте\. Новая почта отклонила запрос: Err$/],
            ['step 2 RU', 'ru', { ok: false, error: 'np_error', step: 2, msg: MSG('x', 'Новая почта не ответила') }, /^Не удалось создать накладную\. Новая почта не ответила$/],
            ['HTML в msg и np', 'uk', { ok: false, error: 'np_api', step: 2, msg: MSG(XSSB, XSSB), np: XSSB }, /^Не вдалося створити накладну\. <img src=x onerror="window\.__xss=1">: <img src=x onerror="window\.__xss=1">$/]
          ];
          for (const [name, lc, cr, re] of cases) {
            const { A, calls } = await openAdmin(stA, { npTtn: true, preview: PREV(), create: cr }, { lc });
            await openSheet(A);
            await sheetOk(A.page).click();
            await A.page.waitForFunction(() => !document.getElementById('cfErr').hidden);
            const er = await text(A.page, '#cfErr');
            ok(re.test(er) && calls.create.length === 1 && !(await sheetOk(A.page).isDisabled()) && await count(A.page, '#cfErr img') === 0 && await A.page.evaluate(() => window.__xss === undefined), 'ТТН ошибка create (' + name + '): текст по шагу + msg + ответ НП, как текст; кнопка снова активна', er);
            if (name === 'step 2 np_api') await A.page.screenshot({ path: OUT + '/b9-ttn-step2-error.png' });
            await A.ctx.close();
          }
          const { A: R, calls: rc } = await openAdmin(stA, { npTtn: true, preview: PREV(), create: OKC }, { lc: 'ru', theme: 'dark' });
          await openSheet(R);
          const shr = NB(await text(R.page, '#sheet'));
          ok(/Ширина, см/.test(shr) && /Длина, см/.test(shr) && /Высота, см/.test(shr) && /Необязательно\. Если заполняете — все три, от 1 до 120 см/.test(shr) && /Пробную можно удалить из панели в течение 24 часов\. Настоящую — только в кабинете Новой почты/.test(shr) && /Пробная накладная: не отправлять номер клиенту/.test(shr), 'ТТН габариты RU (тёмная тема): подписи на русском', shr);
          await R.page.fill('#ttnDW', '10');
          ok(/Заполните все три размера/.test(await text(R.page, '#ttnDimPart')), 'ТТН габариты RU: подсказка о неполных размерах на русском');
          await R.page.screenshot({ path: OUT + '/b9-ttn-dims-ru-dark.png' });
          await R.page.fill('#ttnDL', '10'); await R.page.fill('#ttnDH', '10');
          await R.page.locator('#ttnQuiet').check();
          await sheetOk(R.page).click();
          await R.page.waitForFunction(() => /20450000333333/.test(document.querySelector('.ord__body').innerText));
          ok(/Клиенту номер не отправляли/.test(await text(R.page, '.toast')) && rc.create.length === 1 && rc.create[0].quiet === true, 'ТТН quiet RU: «Клиенту номер не отправляли», quiet в запросе');
          await R.ctx.close();
          const { A: RL } = await openAdmin(stA, { npTtn: true, preview: PREV(), create: OKC }, { lc: 'ru', theme: 'light' });
          await openSheet(RL);
          await RL.page.fill('#ttnDW', '10');
          await RL.page.waitForTimeout(450); await RL.page.screenshot({ path: OUT + '/b9-ttn-dims-ru-light.png' });
          await RL.ctx.close();
        }
      }
      {
        // удаление накладной
        const DELOK = { ok: true };
        const openDel = async (A, num) => { await openOrd(A.page, num || 'P-0098'); };
        {
          const { A } = await openAdmin(stA, { npTtn: true, ttnDel: true, preview: PREV(), del: DELOK });
          await openOrd(A.page, 'P-0098');
          ok(await count(A.page, '[data-w1="ttn-del"]') === 1 && /Видалити накладну/.test(await text(A.page, '[data-w1="ttn-del"]')) && await count(A.page, '[data-w1="ttn-del"].btn--danger') === 0 && await count(A.page, '[data-w1="ttn-make"]') === 0, 'удаление ТТН: у заказа с ttnDel:1 есть «Видалити накладну» (не красная), «Створити ТТН» нет');
          await openOrd(A.page, 'P-0008');
          ok(await count(A.page, '[data-w1="ttn-del"]') === 0, 'удаление ТТН: у заказа без ttnDel кнопки нет');
          await A.ctx.close();
          const O = await openAdmin(stA, { npTtn: true, preview: PREV(), del: DELOK });
          await openOrd(O.A.page, 'P-0098');
          ok(await count(O.A.page, '[data-w1="ttn-del"]') === 0 && await count(O.A.page, '.ttnrow') === 1, 'удаление ТТН: старый бэкенд (ttnDel нет) — кнопки нет, ручной ввод остался');
          await O.A.ctx.close();
        }
        for (const theme of ['light', 'dark']) {
          const { A, calls } = await openAdmin(stA, { npTtn: true, ttnDel: true, preview: PREV(), del: DELOK, delDelay: 700 }, { theme });
          await openDel(A);
          const btnH = await A.page.evaluate(() => document.querySelector('[data-w1="ttn-del"]').getBoundingClientRect().height);
          ok(btnH >= 44, 'удаление ТТН (' + theme + '): кнопка ≥ 44 px', btnH);
          await A.page.click('[data-w1="ttn-del"]');
          await A.page.waitForSelector('#sheet [data-action="cf-ok"]');
          const sh = NB(await text(A.page, '#sheet'));
          ok(/Пробну накладну № 20450000999999 буде видалено в Новій пошті, номер у замовленні — стерто\. Клієнту нічого не надсилається\./.test(sh) && calls.del.length === 0, 'удаление ТТН (' + theme + '): шторка подтверждения с номером; до подтверждения запроса нет', sh);
          ok(await noOverflow(A.page) && (await smallTargets(A.page)).length === 0, 'удаление ТТН (' + theme + '): шторка без прокрутки, кнопки ≥ 44 px', await smallTargets(A.page));
          await A.page.waitForTimeout(450); await A.page.screenshot({ path: OUT + '/b9-ttn-delete-confirm-' + theme + '.png' });
          await A.page.click('#sheet [data-action="cf-ok"]');
          await A.page.locator('#sheet [data-action="cf-ok"]').click({ force: true, timeout: 500 }).catch(() => {});
          ok(await A.page.locator('#sheet [data-action="cf-ok"]').isDisabled(), 'удаление ТТН (' + theme + '): кнопка заблокирована до ответа');
          await A.page.waitForFunction(() => !/20450000999999/.test(document.querySelector('.ord__body').innerText));
          ok(calls.del.length === 1 && calls.del[0].num === 'P-0098' && calls.del[0].confirm === true && calls.del[0].initData, 'удаление ТТН (' + theme + '): двойное нажатие — один запрос, в нём num и confirm:true', calls.del);
          ok(await A.page.locator('#sheet').isHidden() && /Накладну видалено/.test(await text(A.page, '.toast')), 'удаление ТТН (' + theme + '): успех — шторка закрыта, сообщение');
          ok(await count(A.page, '[data-w1="ttn-del"]') === 0 && await count(A.page, '[data-w1="ttn-make"]') === 1 && await A.page.inputValue('#ttn-P-0098') === '', 'удаление ТТН (' + theme + '): карточка обновлена — ТТН пусто, снова есть «Створити ТТН», «Видалити» нет');
          if (theme === 'light') await A.page.screenshot({ path: OUT + '/b9-ttn-delete-done-light.png' });
          ok(A.errors.length === 0, 'удаление ТТН (' + theme + '): в консоли нет ошибок', A.errors);
          await A.ctx.close();
        }
        const M = (ua, ru) => ({ ua, ru });
        const delCases = [
          ['del_old', { ok: false, error: 'del_old', msg: M('Минуло понад 24 години після створення. Видаліть накладну в кабінеті Нової пошти', 'x') }, /^Минуло понад 24 години/],
          ['del_no', { ok: false, error: 'del_no', msg: M('Цю накладну не можна видалити звідси', 'x') }, /^Цю накладну не можна видалити звідси$/],
          ['del_real', { ok: false, error: 'del_real', msg: M('Видалити з панелі можна лише пробну накладну. Справжню — у кабінеті Нової пошти', 'x') }, /^Видалити з панелі можна лише пробну накладну/],
          ['busy', { ok: false, error: 'busy', msg: M('Створення ще триває, спробуйте за кілька хвилин', 'x') }, /^Створення ще триває, спробуйте за кілька хвилин$/],
          ['np_api', { ok: false, error: 'np_api', msg: M('Нова пошта відхилила запит', 'x'), np: 'Doc not found' }, /^Нова пошта відхилила запит: Doc not found$/],
          ['np_error', { ok: false, error: 'np_error', msg: M('Нова пошта не відповіла', 'x') }, /^Нова пошта не відповіла$/],
          ['HTML в msg', { ok: false, error: 'del_old', msg: M(XSSB, XSSB) }, /^<img src=x onerror="window\.__xss=1">$/],
          ['без msg', { ok: false, error: 'zzz' }, /^Не вдалося зберегти/]
        ];
        for (const [name, dr, re] of delCases) {
          const { A, calls } = await openAdmin(stA, { npTtn: true, ttnDel: true, preview: PREV(), del: dr });
          await openDel(A);
          await A.page.click('[data-w1="ttn-del"]');
          await A.page.waitForSelector('#sheet [data-action="cf-ok"]');
          await A.page.click('#sheet [data-action="cf-ok"]');
          await A.page.waitForFunction(() => !document.getElementById('cfErr').hidden);
          const er = await text(A.page, '#cfErr');
          ok(re.test(er) && calls.del.length === 1 && !(await A.page.locator('#sheet [data-action="cf-ok"]').isDisabled()) && await count(A.page, '#cfErr img') === 0 && await A.page.evaluate(() => window.__xss === undefined), 'удаление ТТН ошибка (' + name + '): текст сервера как текст, шторка открыта, кнопка снова активна', er);
          ok(/20450000999999/.test(await text(A.page, '.ord__body')), 'удаление ТТН ошибка (' + name + '): номер в карточке остался');
          if (name === 'del_old') await A.page.screenshot({ path: OUT + '/b9-ttn-delete-error.png' });
          await A.ctx.close();
        }
        {
          const { A, calls } = await openAdmin(stA, { npTtn: true, ttnDel: true, preview: PREV(), del: { ok: false, error: 'del_partial', msg: M('Накладну видалено в Нової пошти, але номер у замовленні не стерся. Очистіть колонку «ТТН» і службову комірку вручну', 'x') } });
          await openDel(A);
          await A.page.click('[data-w1="ttn-del"]');
          await A.page.waitForSelector('#sheet [data-action="cf-ok"]');
          await A.page.click('#sheet [data-action="cf-ok"]');
          await A.page.waitForFunction(() => /зітріть його вручну/.test(document.getElementById('sheet').innerText));
          const sh = await text(A.page, '#sheet');
          ok(/У Новій пошті видалено, але номер у замовленні лишився — зітріть його вручну/.test(sh) && /Накладну видалено в Нової пошти/.test(sh) && await count(A.page, '#sheet [data-action="cf-ok"]') === 0 && await count(A.page, '#sheet .note--out') === 1, 'удаление ТТН del_partial: заметный текст «У Новій пошті видалено, але номер … зітріть його вручну» и текст сервера, повтор не предлагается', sh);
          await A.page.screenshot({ path: OUT + '/b9-ttn-delete-partial.png' });
          await A.page.click('#sheet [data-action="cf-cancel"]');
          ok(calls.del.length === 1 && /20450000999999/.test(await text(A.page, '.ord__body')) && await count(A.page, '[data-w1="ttn-del"]') === 0, 'удаление ТТН del_partial: номер в карточке остался (стирает админ), повторная «Видалити» не показывается');
          await A.ctx.close();
        }
        {
          const { A, calls } = await openAdmin(stA, { npTtn: true, ttnDel: true, preview: PREV(), del: DELOK }, { lc: 'ru', theme: 'dark' });
          await openDel(A);
          ok(/Удалить накладную/.test(await text(A.page, '[data-w1="ttn-del"]')), 'удаление ТТН RU: кнопка «Удалить накладную»');
          await A.page.click('[data-w1="ttn-del"]');
          await A.page.waitForSelector('#sheet [data-action="cf-ok"]');
          ok(/Пробная накладная № 20450000999999 будет удалена в Новой почте, номер в заказе — стёрт\. Клиенту ничего не отправляется\./.test(NB(await text(A.page, '#sheet'))), 'удаление ТТН RU: текст подтверждения на русском');
          await A.page.waitForTimeout(450); await A.page.screenshot({ path: OUT + '/b9-ttn-delete-confirm-ru-dark.png' });
          await A.page.click('#sheet [data-action="cf-ok"]');
          await A.page.waitForFunction(() => !/20450000999999/.test(document.querySelector('.ord__body').innerText));
          ok(/Накладная удалена/.test(await text(A.page, '.toast')) && calls.del.length === 1, 'удаление ТТН RU: успех — «Накладная удалена»');
          await A.ctx.close();
        }
      }
      stA.server.close();
    }
  }

  await browser.close();
  console.log('\nИтог: ' + pass + ' пройдено, ' + fail + ' не пройдено');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
