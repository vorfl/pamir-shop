// Витрина после «Підготовки до запуску» в настоящем браузере (360 px, светлая и тёмная тема, UA/RU).
// Стенд: таблица «как перед запуском» → резервная копия → «Застосувати» → витрина. Запуск: node tests/e2e_launch.js
// Настоящая таблица, бот и Telegram в тестах не участвуют.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs = require('fs');
const path = require('path');
const { start } = require('./serve');
const { open, OUT } = require('./shot');
const { launchSeed, launchData, applyAll } = require('./launch_seed');

const SHOTS = path.join(OUT, 'launch');
fs.mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0;
function ok(cond, name, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra !== undefined ? ' → ' + JSON.stringify(extra) : '')); }
}
const text = (page, sel) => page.locator(sel).first().innerText();
const count = (page, sel) => page.locator(sel).count();
const noOverflow = page => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const smallTargets = page => page.evaluate(() => {
  const bad = [];
  document.querySelectorAll('button, a, input:not([type=radio]):not([type=checkbox]):not([type=file]), textarea, select').forEach(n => {
    const r = n.getBoundingClientRect();
    if (!r.width || !r.height || n.closest('[hidden]') || getComputedStyle(n).visibility === 'hidden') return;
    let w = r.width, h = r.height;
    const before = getComputedStyle(n, '::before');
    if (before.content !== 'none' && before.position === 'absolute') { w -= parseFloat(before.left) + parseFloat(before.right); h -= parseFloat(before.top) + parseFloat(before.bottom); }
    if (n.tabIndex === -1 || n.closest('.lang') && w >= 44) { if (h >= 38) return; }
    if (w < 43.5 || h < 43.5) bad.push((n.className || n.tagName) + ' ' + Math.round(w) + '×' + Math.round(h));
  });
  return bad;
});
const DATA = launchData();
const KEEP = {}; DATA.products.forEach(p => { KEEP[p.id] = p; });

(async () => {
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || undefined, executablePath: process.env.CHROME_PATH || undefined, args: ['--no-sandbox'] });
  const st = await start(8861, undefined, () => launchSeed());
  const g = st.gas;
  applyAll(g);
  const stockCol = g.sheets['Товари'].rows[0].indexOf('Наявність');
  const setStock = (id, v) => { g.sheets['Товари'].rows.find(r => r[0] === id)[stockCol] = v; g.clearCache(); };

  console.log('Главная и каталог после запуска (светлая тема, UA)');
  {
    const { page, errors } = await open(browser, st.url, { uid: 4201 });
    await page.waitForSelector('.card');
    ok(await count(page, '.feature') === 1 && /Наша курага/.test(await text(page, '.feature__title')) && /абрикосовою кислинкою/.test(await text(page, '.feature__text')), 'блок «Наша курага» с текстом из настроек');
    const father = await text(page, '.father');
    ok(/Спеції від батька/.test(father) && /Ці суміші батько збирає сам/.test(father) && await count(page, '.father .mini') === 3, 'подборка «Спеції від батька» видна: заголовок, текст и три смеси, которые «є»', await count(page, '.father .mini'));
    ok(await count(page, '.perk') === 0, 'шуточных подарков на главной нет');
    ok(await count(page, '.recs__item') === 7 && /Плов з урюком/.test(await text(page, '.recs')), 'блок «Рецепти»: 7 рецептов');
    ok(await count(page, '.bizline--quiz') === 1, 'кнопка «Підібрати смаколики» есть');
    ok(await noOverflow(page) && (await smallTargets(page)).length === 0, 'главная: без горизонтальной прокрутки, кнопки ≥ 44 px', await smallTargets(page));
    // Все категории: ровно 50 товаров, чужих марок нет.
    const chips = await page.locator('.chip[data-cat]').evaluateAll(list => list.map(c => c.getAttribute('data-cat')).filter(Boolean));
    let total = 0, names = [];
    for (const c of chips) {
      await page.click('.chip[data-cat="' + c + '"]');
      await page.waitForTimeout(80);
      total += await count(page, '#grid .card');
      names = names.concat(await page.locator('#grid .card .card__name').allInnerTexts());
    }
    ok(chips.join() === 'DRY,NUT,SWT,CND,SPS' && total === 50, 'на витрине ровно 50 товаров в 5 категориях', [chips, total]);
    ok(!/Amanti|King|Grunwerk|Стара назва/i.test(names.join(' | ')) && names.includes('Халва тахінна') && names.includes('Курага з нашого саду (Ісфара)'), 'в названиях нет чужих марок и старых названий');
    const gridText = names.join(' | ');
    ok(!/Хіт|Новинка|Знижка|Набір/.test(gridText) && await count(page, '#grid .card__old, #grid s') === 0, 'бейджей «хіт», «новинка», «знижка» и зачёркнутых цен нет', (gridText.match(/.{0,40}(Хіт|Новинка|Знижка|Набір).{0,40}/) || [])[0]);
    await page.click('.chip[data-cat="SPS"]');
    await page.waitForTimeout(80);
    ok(await count(page, '#grid .card') === 20 && await noOverflow(page) && (await smallTargets(page)).length === 0, 'категория «Спеції»: 20 позиций, кнопки ≥ 44 px', await smallTargets(page));
    ok(errors.length === 0, 'в консоли браузера нет ошибок', errors);
    await page.context().close();
  }

  console.log('Карточки товаров');
  {
    const a = await open(browser, st.url, { uid: 4202, start: 'DRY-039' });
    await a.page.waitForSelector('.sheet__title');
    const sheet = await text(a.page, '#sheet');
    ok(/Курага з нашого саду \(Ісфара\)/.test(sheet) && /Як їсти/.test(sheet) && /Просто так або до чаю/.test(sheet) && /Рецепти з цим товаром/.test(sheet), 'карточка кураги: наше название, «Як їсти», ссылки на рецепты');
    const prices = await a.page.evaluate(() => fetch('/api?action=catalog').then(r => r.json()).then(c => c.products.find(p => p.id === 'DRY-039').v));
    ok(prices.join(';') === '100,44;250,110;500,220;1000,440' && /44\s₴/.test(sheet.replace(/ /g, ' ')), 'курага: 100 г = 44 ₴, 250 г = 110 ₴, 500 г = 220 ₴, 1 кг = 440 ₴ (цена на экране — та же)', prices);
    ok(!/377/.test(sheet), 'оптовой цены кураги (на стенде — 377) в карточке обычного клиента нет');
    ok(await noOverflow(a.page) && (await smallTargets(a.page)).length === 0 && a.errors.length === 0, 'карточка кураги: вёрстка в порядке, ошибок нет', (await smallTargets(a.page)).concat(a.errors));
    await a.page.context().close();

    const b = await open(browser, st.url, { uid: 4203, start: 'SPS-001' });
    await b.page.waitForSelector('.sheet__title');
    const s2 = await text(b.page, '#sheet');
    ok(/Спеції для плову — родинний рецепт/.test(s2) && /Суміш для плову, яку наш батько складає сам\./.test(s2) && /Додавайте в зірвак/.test(s2) && /Плов з урюком/.test(s2), 'карточка смеси для плова: описание, «Як їсти», рецепт');
    ok(await count(b.page, '.sheet__comp') === 0 && !/УТОЧНИТЬ|Склад:/.test(s2), 'состава смеси нет (его знает только отец) — блок скрыт');
    ok(await noOverflow(b.page) && (await smallTargets(b.page)).length === 0 && b.errors.length === 0, 'карточка смеси: вёрстка в порядке, ошибок нет', (await smallTargets(b.page)).concat(b.errors));
    await b.page.context().close();
  }

  console.log('Рецепты');
  {
    const { page, errors } = await open(browser, st.url, { uid: 4204, query: '?rec=REC-002' });
    await page.waitForSelector('.rec__p');
    ok(/Плов з урюком/.test(await text(page, '.page__title')) && await count(page, '.rec__p') === 9 && await count(page, '.page .story__img') === 0, 'рецепт плова: название, 9 абзацев, фото нет — пустого места под фото тоже нет');
    ok(await count(page, '.page .card') === 4 && await noOverflow(page) && (await smallTargets(page)).length === 0, 'четыре ингредиента из магазина, кнопки ≥ 44 px', await smallTargets(page));
    await page.click('[data-w1="rec-add"]');
    await page.waitForSelector('.page .note');
    const cartIds = () => page.evaluate(() => JSON.parse(localStorage.getItem('pamir_cart_v1')).i.map(l => l.id).sort().join());
    ok(await cartIds() === 'DRY-019,DRY-068,SPS-001' && /Додано в кошик: 3\. Зараз немає в наявності: Барбарис сушений\./.test(await text(page, '.page .note')),
      '«Додати інгредієнти в кошик»: только то, что «є»; про барбарис («немає») — сообщение', [await cartIds(), await text(page, '.page .note')]);
    ok(errors.length === 0, 'в консоли браузера нет ошибок', errors);
    await page.context().close();

    setStock('SPS-002', 'немає'); // главный ингредиент шурпы
    const h = await open(browser, st.url, { uid: 4205 });
    await h.page.waitForSelector('.recs');
    ok(await count(h.page, '.recs__item') === 6 && !/Шурпа/.test(await text(h.page, '.recs')), 'главный ингредиент «немає» — рецепт с главной пропал');
    await h.page.context().close();
    setStock('SPS-002', 'є');

    // То же правило на самой витрине: старый бэкенд отдаёт рецепты без проверки наличия.
    const c = await open(browser, st.url, { uid: 4206, query: '?nocache=1' });
    await c.page.route(/\/api\?.*action=catalog/, async route => {
      const res = await route.fetch();
      const body = await res.json();
      body.recipes.push({ id: 'X1', ua: 'Тест: головного немає', tUa: 'текст', items: ['SPS-004', 'DRY-039'] }, { id: 'X2', ua: 'Тест: головний є', tUa: 'текст', items: ['DRY-039', 'SPS-004'] });
      await route.fulfill({ status: 200, contentType: 'application/json; charset=utf-8', body: JSON.stringify(body) });
    });
    await c.page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); }); // иначе витрина покажет каталог из своей памяти
    await c.page.reload({ waitUntil: 'networkidle' });
    await c.page.waitForFunction(() => /головний є/.test(document.body.innerText), null, { timeout: 8000 }).catch(() => {});
    const recs = await text(c.page, '.recs');
    ok(!/головного немає/.test(recs) && /головний є/.test(recs), 'витрина сама скрывает рецепт, если главного ингредиента нет в наличии', recs);
    await c.page.context().close();
  }

  console.log('Точки, пустые экраны, квиз');
  {
    const { page, errors } = await open(browser, st.url, { uid: 4207, query: '?view=points' });
    await page.waitForSelector('.point');
    const pts = await text(page, '.page');
    ok(await count(page, '.point') === 2 && /Центральний ринок, вул\. Різдвяна, 33, критий павільйон/.test(pts) && /Пн: вихідний/.test(pts), 'две точки: новый адрес и часы');
    const facts = await page.locator('.point .facts p').allInnerTexts();
    ok(await count(page, '.point a[href^="tel:"]') === 0 && !/Ряд|місце|Від входу|фонтан/.test(pts) && facts.every(f => f.trim().length > 3) && facts.length === 4,
      'пустые поля точки не показываются: нет строк «Ряд», «як знайти» и кнопки телефона', facts);
    ok(await noOverflow(page) && (await smallTargets(page)).length === 0, 'экран точек: вёрстка в порядке', await smallTargets(page));
    await page.screenshot({ path: SHOTS + '/points-light-ua.png', fullPage: true });

    await page.goto(st.url + '/?view=cart', { waitUntil: 'networkidle' });
    await page.waitForSelector('.state');
    ok(/Тут поки порожньо/.test(await text(page, '.state')) && /Почніть із кураги — вона з нашого саду\./.test(await text(page, '.state')), 'пустая корзина: новый текст');
    await page.screenshot({ path: SHOTS + '/cart-empty-light-ua.png' });
    await page.locator('#tabbar button').nth(1).click();
    await page.waitForSelector('.state');
    ok(/Зберігайте сюди те, що сподобалося, — наступного разу не доведеться шукати\./.test(await text(page, '.state')), 'пустое избранное: новый текст');
    await page.locator('#tabbar button').nth(3).click();
    await page.waitForFunction(() => /Замовлень поки немає/.test(document.body.innerText));
    ok(/Коли з’являться — тут буде їхня історія та кнопка «Повторити»\./.test(await page.locator('body').innerText()), 'пустые заказы: новый текст');
    await page.locator('#tabbar button').nth(0).click();
    await page.fill('#search', 'щщщжжж');
    await page.waitForSelector('.state');
    ok(/Нічого не знайдено/.test(await text(page, '.state')) && /Напишіть нам — підкажемо, чи є це на прилавку\./.test(await text(page, '.state')) && await count(page, '.state [data-w1="contact"]') === 1, 'пустой поиск: новый текст и кнопка «Написати нам»');
    await page.fill('#search', '');

    await page.goto(st.url + '/?view=quiz', { waitUntil: 'networkidle' });
    await page.waitForSelector('.quiz__opt');
    const opts = (await page.locator('.quiz__opt').allInnerTexts()).join('|');
    ok(opts === 'До чаю|Перекус|Подарунок|На сніданок|Для випічки|Для плову|До м’яса|У суп|На узвар|Спеції від батька|Байдуже', 'квиз знает новые теги (сніданок, випічка, до м’яса, суп, узвар, спеції батька)', opts);
    ok(await noOverflow(page) && (await smallTargets(page)).length === 0, 'квиз: вёрстка в порядке', await smallTargets(page));
    await page.locator('.quiz__opt', { hasText: 'До м’яса' }).click();
    await page.locator('.quiz__opt').last().click();
    await page.locator('.quiz__opt').last().click();
    await page.waitForSelector('#quizGrid .card');
    const got = await page.evaluate(() => [].map.call(document.querySelectorAll('#quizGrid .card'), c => c.getAttribute('data-id')).sort().join());
    ok(got === 'DRY-086,SPS-003' && /Ось що вам підійде/.test(await text(page, '.quiz__q')), 'квиз «До м’яса»: чернослив и смесь для шашлыка (то, что «є»)', got);
    ok(errors.length === 0, 'в консоли браузера нет ошибок', errors);
    await page.context().close();

    const r = await open(browser, st.url, { uid: 4208, lc: 'ru', query: '?view=cart' });
    await r.page.waitForSelector('.state');
    ok(/Здесь пока пусто/.test(await text(r.page, '.state')) && /Начните с кураги — она из нашего сада\./.test(await text(r.page, '.state')), 'пустая корзина RU');
    await r.page.context().close();
  }

  console.log('Снимки экранов: 360 px, светлая и тёмная тема, UA и RU');
  {
    let n = 0, bad = [];
    for (const theme of ['light', 'dark']) {
      for (const lc of ['uk', 'ru']) {
        const tag = theme + '-' + (lc === 'uk' ? 'ua' : 'ru');
        const check = async (page, name) => {
          if (!(await noOverflow(page))) bad.push(tag + ' ' + name + ': горизонтальная прокрутка');
          const small = await smallTargets(page);
          if (small.length) bad.push(tag + ' ' + name + ': ' + small.join(', '));
          n++;
        };
        const home = await open(browser, st.url, { uid: 4300 + n, theme, lc });
        await home.page.waitForSelector('.card');
        await home.page.screenshot({ path: SHOTS + '/1-home-' + tag + '.png', fullPage: true });
        await check(home.page, 'главная');
        await home.page.click('.chip[data-cat="SPS"]');
        await home.page.waitForTimeout(150);
        await home.page.screenshot({ path: SHOTS + '/2-spices-' + tag + '.png', fullPage: true });
        await check(home.page, 'спеції');
        bad = bad.concat(home.errors.map(e => tag + ' главная: ' + e));
        await home.page.context().close();
        for (const [id, file] of [['DRY-039', '3-kuraga'], ['SPS-001', '4-plov-mix']]) {
          const c = await open(browser, st.url, { uid: 4300 + n, theme, lc, start: id });
          await c.page.waitForSelector('.sheet__title');
          await c.page.waitForTimeout(350);
          await c.page.screenshot({ path: SHOTS + '/' + file + '-' + tag + '.png' });
          await c.page.locator('#sheet').evaluate(el => { const s = el.querySelector('.sheet__body, .sheet__scroll') || el; s.scrollTop = s.scrollHeight; });
          await c.page.waitForTimeout(150);
          await c.page.screenshot({ path: SHOTS + '/' + file + '-' + tag + '-2.png' });
          await check(c.page, id);
          bad = bad.concat(c.errors.map(e => tag + ' ' + id + ': ' + e));
          await c.page.context().close();
        }
        const rec = await open(browser, st.url, { uid: 4300 + n, theme, lc, query: '?rec=REC-002' });
        await rec.page.waitForSelector('.rec__p');
        await rec.page.screenshot({ path: SHOTS + '/5-recipe-plov-' + tag + '.png', fullPage: true });
        await check(rec.page, 'рецепт');
        await rec.page.click('[data-w1="rec-add"]');
        await rec.page.waitForSelector('.page .note');
        await rec.page.goto(st.url + '/?view=cart', { waitUntil: 'networkidle' });
        await rec.page.waitForSelector('.lines');
        await rec.page.screenshot({ path: SHOTS + '/6-cart-' + tag + '.png', fullPage: true });
        await check(rec.page, 'корзина');
        bad = bad.concat(rec.errors.map(e => tag + ' рецепт/корзина: ' + e));
        await rec.page.context().close();
      }
    }
    ok(bad.length === 0, 'на всех ' + n + ' экранах нет горизонтальной прокрутки, мелких кнопок и ошибок в консоли', bad);
    console.log('  снимки: ' + SHOTS);
  }

  ok(g.sandbox.__errors.length === 0, 'в логах бэкенда нет ошибок', g.sandbox.__errors);
  await browser.close();
  st.server.close();
  console.log('\nИтог: ' + pass + ' пройдено, ' + fail + ' не пройдено');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
