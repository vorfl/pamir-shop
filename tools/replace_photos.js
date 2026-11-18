// Замена фото товаров: <папка>/<ID>__card.png и <ID>__jar.png -> webapp/img/products/<ID>.webp
// Квадрат 1080x1080, WebP, качество 82. Файлы <ID>__page.png не берутся. Исходная папка только читается.
// ID сверяется с manifest.csv из той же папки и с уже существующим файлом webapp/img/products/<ID>.webp:
// новые имена не создаются, адреса фото в таблице не меняются.
//
// Запуск (из корня проекта; sharp в репозиторий не ставится, путь к нему - в переменной):
//   PowerShell: $env:SHARP_PATH='C:/Users/Islombek/Documents/gradino-site/node_modules/sharp'
//               node tools/replace_photos.js "<папка с фото>"          (только проверка, ничего не пишет)
//               node tools/replace_photos.js "<папка с фото>" --write  (записать)
// После записи: node tools/make_thumbs.js (маленькие копии), потом коммит.
const fs = require('fs');
const path = require('path');
const sharp = require(process.env.SHARP_PATH || 'sharp');

const SRC = process.argv[2];
const WRITE = process.argv.includes('--write');
const DST = path.join(__dirname, '..', 'webapp', 'img', 'products');
const SIZE = 1080, QUALITY = 82;

(async () => {
  if (!SRC || !fs.existsSync(SRC)) { console.error('no source folder given'); process.exit(1); }
  const manifestPath = path.join(SRC, 'manifest.csv');
  const ids = new Set();
  if (fs.existsSync(manifestPath)) {
    fs.readFileSync(manifestPath, 'utf8').split(/\r?\n/).slice(1).forEach(line => {
      const id = line.split(',')[0].trim();
      if (id) ids.add(id);
    });
  }
  const files = fs.readdirSync(SRC).filter(f => /__(card|jar)\.png$/i.test(f)).sort();
  let before = 0, after = 0, done = 0, problems = 0;
  const seen = new Set();
  for (const f of files) {
    const id = f.replace(/__(card|jar)\.png$/i, '');
    const out = path.join(DST, id + '.webp');
    const notes = [];
    if (seen.has(id)) notes.push('DUPLICATE ID');
    seen.add(id);
    if (ids.size && !ids.has(id)) notes.push('NOT IN MANIFEST');
    if (!fs.existsSync(out)) notes.push('NO SUCH FILE IN REPO');
    const meta = await sharp(path.join(SRC, f)).metadata();
    if (meta.width !== meta.height) notes.push('not square ' + meta.width + 'x' + meta.height);
    if (meta.width < SIZE) notes.push('smaller than ' + SIZE + ' px');
    const bad = notes.some(n => /DUPLICATE|MANIFEST|NO SUCH/.test(n));
    if (bad) { problems++; console.log(f + '  SKIPPED: ' + notes.join('; ')); continue; }
    // Не квадрат - обрезка по центру до квадрата (cover); белые поля не добавляются.
    const buf = await sharp(path.join(SRC, f))
      .resize({ width: SIZE, height: SIZE, fit: 'cover', position: 'centre' })
      .flatten({ background: '#ffffff' })
      .webp({ quality: QUALITY, effort: 6 })
      .toBuffer();
    const old = fs.statSync(out).size;
    before += old; after += buf.length; done++;
    if (WRITE) fs.writeFileSync(out, buf);
    console.log(id + '.webp  ' + meta.width + 'x' + meta.height + '  ' + (old / 1024).toFixed(1) + ' KB -> ' + (buf.length / 1024).toFixed(1) + ' KB' + (notes.length ? '  [' + notes.join('; ') + ']' : ''));
  }
  const repo = fs.readdirSync(DST).filter(f => /\.webp$/i.test(f)).map(f => f.replace(/\.webp$/i, ''));
  const missing = repo.filter(id => !seen.has(id));
  console.log('source files: ' + files.length + '; converted: ' + done + '; skipped: ' + problems + '; mode: ' + (WRITE ? 'WRITE' : 'check only'));
  console.log('before: ' + (before / 1024).toFixed(0) + ' KB; after: ' + (after / 1024).toFixed(0) + ' KB');
  console.log('repo photos without a new file: ' + (missing.length ? missing.join(' ') : 'none'));
  if (problems) process.exit(2);
})().catch(e => { console.error(String(e && e.message || e)); process.exit(1); });
