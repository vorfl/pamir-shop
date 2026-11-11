// Быстрые снимки экранов стенда. node tests/shot.js
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const { start } = require('./serve');
const fs = require('fs');
const OUT = require('path').join(require('os').tmpdir(), 'pamir-shots');
fs.mkdirSync(OUT, { recursive: true });

async function open(browser, base, opts) {
  const ctx = await browser.newContext({ viewport: { width: opts.w || 360, height: opts.h || 760 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
  await page.route('https://telegram.org/**', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }).catch(() => {}));
  await page.route('https://telegram.org/js/telegram-web-app.js', async r => {
    const res = await fetch(base + '/tg.js?uid=' + (opts.uid || 0) + '&theme=' + (opts.theme || 'light') + '&lc=' + (opts.lc || 'uk') + '&start=' + (opts.start || ''));
    r.fulfill({ status: 200, contentType: 'application/javascript', body: await res.text() });
  });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await page.route('https://img.test/**', r => {
    const hue = (r.request().url().split('/').pop().split('').reduce((a, c) => a + c.charCodeAt(0), 0) * 37) % 360;
    r.fulfill({ status: 200, contentType: 'image/svg+xml', body: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><defs><radialGradient id="g" cx="35%" cy="30%"><stop offset="0" stop-color="hsl(${hue},55%,78%)"/><stop offset="1" stop-color="hsl(${hue},45%,52%)"/></radialGradient></defs><rect width="400" height="400" fill="#f3ece0"/><circle cx="200" cy="215" r="130" fill="url(#g)"/></svg>` });
  });
  await page.goto(base + '/' + (opts.query || ''), { waitUntil: 'networkidle' });
  return { ctx, page, errors };
}
module.exports = { open, OUT };

if (require.main === module) (async () => {
  const st = await start(8801, undefined, s => {
    const rows = s.sheets['Товари'], pc = rows[0].indexOf('Фото (посилання)');
    rows.slice(1).forEach((r, i) => { if (i % 4 !== 3) r[pc] = 'https://img.test/' + r[0] + '.svg'; });
  });
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || undefined, executablePath: process.env.CHROME_PATH || undefined, args: ['--no-sandbox'] });
  const a = await open(browser, st.url, { uid: 501 });
  await a.page.screenshot({ path: OUT + '/01-home.png' });
  await a.page.screenshot({ path: OUT + '/02-home-full.png', fullPage: true });
  await a.page.locator('.card[data-id="NUT-002"]').first().scrollIntoViewIfNeeded();
  await a.page.locator('.card[data-id="NUT-002"] .card__name').first().click();
  await a.page.waitForTimeout(400);
  await a.page.screenshot({ path: OUT + '/03-sheet.png' });
  console.log('errors', a.errors);
  await browser.close(); st.server.close();
})();
