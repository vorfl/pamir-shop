// Табличка с QR (A5) и вкладыши (10 штук на A4) для печати → docs/print/*.pdf. Заодно проверка: QR читается и ведёт в магазин.
// Запуск (нужны playwright-core, qrcode, jsqr, pngjs — см. README, раздел про тесты):
//   node tests/make_print.js          собрать PDF заново и проверить QR
// Стиль — токены и шрифты из webapp/styles.css, логотип webapp/logo.svg.
const fs = require('fs');
const path = require('path');
const pwPath = process.env.PLAYWRIGHT_PATH || 'playwright';
const mods = process.env.PRINT_MODULES || (path.isAbsolute(pwPath) ? path.dirname(pwPath) : '');
const need = name => require(mods ? path.join(mods, name) : name);
const { chromium } = require(pwPath);
const QRCode = need('qrcode');
const jsQR = need('jsqr');
const { PNG } = need('pngjs');

const URL_SHOP = 'https://t.me/pamir_spices_bot/shop'; // один общий QR: источник открытия (src_…) код магазина не считает
const BOT = '@pamir_spices_bot';
const OUT = path.join(__dirname, '..', 'docs', 'print');
const logo = fs.readFileSync(path.join(__dirname, '..', 'webapp', 'logo.svg'), 'utf8').replace(/<\?xml[^>]*>/, '').replace(/ width="\d+" height="\d+"/, '');

let pass = 0, fail = 0;
function ok(cond, name, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra !== undefined ? ' → ' + JSON.stringify(extra) : '')); }
}

const HEAD = `<!doctype html><html lang="uk"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=Unbounded:wght@600&display=swap" rel="stylesheet">
<style>
  :root { --surface: #FAF6EF; --line: #E4DACB; --ink: #2B2E32; --ink-muted: #6B665E; --apricot: #E8913A; --apricot-soft: #F6E3CC; --apricot-text: #B4561A; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: #fff; color: var(--ink); font-family: 'Manrope', system-ui, 'Segoe UI', sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .display { font-family: 'Unbounded', 'Manrope', system-ui, sans-serif; font-weight: 600; }
  .qr svg { display: block; width: 100%; height: 100%; }
  .logo svg { display: block; width: 100%; height: auto; }
`;

function a5(qr) {
  return HEAD + `
  @page { size: 148mm 210mm; margin: 0; }
  .sheet { width: 148mm; height: 210mm; background: var(--surface); padding: 12mm 12mm 11mm; display: flex; flex-direction: column; align-items: center; text-align: center; }
  .logo { width: 62mm; margin: -9mm 0 -9mm; }
  h1 { font-size: 21pt; line-height: 1.2; margin-top: 3mm; }
  h1 b { color: var(--apricot-text); font-weight: 600; }
  .lead { font-size: 13pt; line-height: 1.4; margin-top: 5mm; max-width: 112mm; }
  .qrbox { margin-top: 8mm; background: #fff; border: 1.2mm solid var(--apricot); border-radius: 6mm; padding: 4mm; }
  .qr { width: 78mm; height: 78mm; }
  .hint { font-size: 13pt; font-weight: 700; margin-top: 7mm; }
  .bot { margin-top: 3mm; font-size: 15pt; background: var(--apricot-soft); border-radius: 99mm; padding: 2.2mm 7mm; }
  .foot { margin-top: auto; font-size: 9.5pt; color: var(--ink-muted); }
</style></head><body>
<div class="sheet">
  <div class="logo">${logo}</div>
  <h1 class="display">PAMIR тепер у&nbsp;<b>Telegram</b></h1>
  <p class="lead">Замовляйте в Telegram — доставимо Новою поштою або заберете тут</p>
  <div class="qrbox"><div class="qr">${qr}</div></div>
  <p class="hint">Наведіть камеру телефона на код</p>
  <p class="bot display">${BOT}</p>
  <p class="foot">Горіхи · сухофрукти · спеції · східні солодощі</p>
</div></body></html>`;
}

function a4(qr) {
  const cell = `<div class="cell"><div class="txt"><div class="logo">${logo}</div>
    <p class="t1 display">Сподобалось?</p><p class="t2">Наступного разу замовте в&nbsp;Telegram</p><p class="bot">${BOT}</p></div>
    <div class="qr">${qr}</div></div>`;
  return HEAD + `
  @page { size: 210mm 297mm; margin: 0; }
  .sheet { width: 210mm; height: 297mm; display: grid; grid-template-columns: 105mm 105mm; grid-template-rows: repeat(5, 59.4mm); }
  .cell { display: flex; align-items: center; justify-content: space-between; gap: 4mm; padding: 6mm 8mm 6mm 9mm; border-right: 0.2mm dashed #8F8576; border-bottom: 0.2mm dashed #8F8576; background: var(--surface); }
  .cell:nth-child(2n) { border-right: 0; }
  .cell:nth-last-child(-n+2) { border-bottom: 0; }
  .txt { min-width: 0; }
  .logo { width: 30mm; margin: -5mm 0 -3.5mm -5mm; }
  .t1 { font-size: 11.5pt; color: var(--apricot-text); }
  .t2 { font-size: 10pt; line-height: 1.3; margin-top: 1.5mm; font-weight: 600; }
  .bot { font-size: 8.5pt; color: var(--ink-muted); margin-top: 2mm; }
  .qr { flex: none; width: 36mm; height: 36mm; background: #fff; border-radius: 2mm; padding: 1mm; }
</style></head><body><div class="sheet">${new Array(11).join(cell)}</div></body></html>`;
}

function decode(buf) {
  const png = PNG.sync.read(buf);
  const res = jsQR(new Uint8ClampedArray(png.data.buffer, png.data.byteOffset, png.data.length), png.width, png.height);
  return res ? res.data : '';
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const qr = await QRCode.toString(URL_SHOP, { type: 'svg', errorCorrectionLevel: 'Q', margin: 2, color: { dark: '#2B2E32', light: '#FFFFFF' } });
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || undefined, executablePath: process.env.CHROME_PATH || undefined, args: ['--no-sandbox'] });
  const jobs = [['pamir_tablichka_A5.pdf', a5(qr), '148mm', '210mm', '.qrbox', 1], ['pamir_vkladysh_A4.pdf', a4(qr), '210mm', '297mm', '.cell', 10]];
  for (const [file, html, w, h, sel, n] of jobs) {
    console.log(file);
    const page = await browser.newPage({ viewport: { width: 900, height: 1200 }, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: 'networkidle' });
    const fonts = await page.evaluate(() => document.fonts.ready.then(() => [document.fonts.check('600 20px Unbounded'), document.fonts.check('400 14px Manrope')]));
    ok(fonts[0] && fonts[1], 'шрифты Unbounded и Manrope загружены', fonts);
    const fits = await page.evaluate(() => { const s = document.querySelector('.sheet'); return s.scrollHeight <= s.clientHeight + 1 && s.scrollWidth <= s.clientWidth + 1; });
    ok(fits, 'содержимое помещается на лист');
    const codes = [];
    const boxes = page.locator(sel);
    for (let i = 0; i < await boxes.count(); i++) codes.push(decode(await boxes.nth(i).screenshot()));
    ok(codes.length === n && codes.every(c => c === URL_SHOP), 'QR читается декодером и открывает ' + URL_SHOP + ' (кодов: ' + n + ')', codes);
    const target = path.join(OUT, file);
    await page.pdf({ path: target, width: w, height: h, printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
    const pdf = fs.readFileSync(target);
    const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
    ok(pdf.slice(0, 5).toString() === '%PDF-' && pdf.length > 10000 && pages === 1, 'PDF записан: одна страница, ' + Math.round(pdf.length / 1024) + ' КБ', pages);
    await page.screenshot({ path: path.join(require('os').tmpdir(), 'pamir-shots', file.replace('.pdf', '.png')), fullPage: true }).catch(() => {});
    await page.close();
  }
  await browser.close();
  console.log('\nИтог: ' + pass + ' пройдено, ' + fail + ' не пройдено');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
