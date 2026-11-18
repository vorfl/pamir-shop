// Маленькие копии фото товаров: webapp/img/products/<ID>.webp -> webapp/img/products/s/<ID>.webp
// Ширина 360 px, цель - до 30 KB (качество понижается, пока файл не уложится, но не ниже 40).
//
// Запуск (из корня проекта; sharp в репозиторий не ставится, путь к нему - в переменной):
//   Git Bash:   SHARP_PATH=C:/Users/Islombek/Documents/gradino-site/node_modules/sharp node tools/make_thumbs.js
//   PowerShell: $env:SHARP_PATH='C:/Users/Islombek/Documents/gradino-site/node_modules/sharp'; node tools/make_thumbs.js
// Скрипт можно запускать повторно: копии пересоздаются. Новые фото -> запустить, закоммитить папку s/.
const fs = require('fs');
const path = require('path');
const sharp = require(process.env.SHARP_PATH || 'sharp');

const SRC = path.join(__dirname, '..', 'webapp', 'img', 'products');
const DST = path.join(SRC, 's');
const WIDTH = 360, TARGET = 30 * 1024, Q_START = 78, Q_MIN = 40, Q_STEP = 6;

(async () => {
  fs.mkdirSync(DST, { recursive: true });
  const files = fs.readdirSync(SRC).filter(f => /\.webp$/i.test(f)).sort();
  let before = 0, after = 0, big = 0, worst = { name: '', size: 0 };
  for (const f of files) {
    const src = path.join(SRC, f);
    let q = Q_START, buf;
    for (;;) {
      buf = await sharp(src).resize({ width: WIDTH, withoutEnlargement: true }).webp({ quality: q, effort: 6 }).toBuffer();
      if (buf.length <= TARGET || q <= Q_MIN) break;
      q -= Q_STEP;
    }
    fs.writeFileSync(path.join(DST, f), buf);
    const sz = fs.statSync(src).size;
    before += sz; after += buf.length;
    if (buf.length > TARGET) big++;
    if (buf.length > worst.size) worst = { name: f, size: buf.length };
    console.log(f + '  ' + (sz / 1024).toFixed(1) + ' KB -> ' + (buf.length / 1024).toFixed(1) + ' KB  q=' + q);
  }
  console.log('files: ' + files.length + '; before: ' + (before / 1024).toFixed(0) + ' KB; after: ' + (after / 1024).toFixed(0) + ' KB');
  console.log('heaviest small copy: ' + worst.name + ' ' + (worst.size / 1024).toFixed(1) + ' KB; over 30 KB: ' + big);
})().catch(e => { console.error(String(e && e.message || e)); process.exit(1); });
