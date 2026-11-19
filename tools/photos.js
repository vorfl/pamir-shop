// Konvertatsiya gotovykh PNG/JPG v webp dlya vitriny (bez generatsii).
//   <ID>__card.(png|jpg|jpeg) ili <ID>.(png|jpg|jpeg) -> webapp/img/products/<ID>.webp (1080x1080) + products/s/<ID>.webp (360 px)
//   <ID>__page.(png|jpg|jpeg)                         -> webapp/img/products/p/<ID>.webp (1080x1080)
// Zapusk (iz kornya proekta; sharp v repozitoriy ne stavitsya, put k nemu - v peremennoy SHARP_PATH):
//   node tools/photos.js --src "<papka>" [--only card|page] [--write] [--force]
// Bez --write - suhoy progon. Papka-istochnik tolko chitaetsya. Sushchestvuyushchiy fayl bez --force ne perezapisyvaetsya.
// Dlya novyh osnovnyh foto (card) dopisyvayutsya stroki v docs/data/photos_stage9.csv (dublikaty ne dobavlyayutsya).
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'webapp', 'img', 'products');
const CSV = path.join(ROOT, 'docs', 'data', 'photos_stage9.csv');
const BASE_URL = 'https://vorfl.github.io/pamir-shop/webapp/img/products/';
const SIZE = 1080, QUALITY = 82, THUMB_W = 360, THUMB_TARGET = 30 * 1024, Q_START = 78, Q_MIN = 40, Q_STEP = 6;
// Dlya etih tovarov foto stranitsy (page) ne konvertiruetsya nikogda.
const NO_PAGE = ['DRY-039', 'DRY-089', 'DRY-090', 'DRY-068', 'DRY-086', 'NEW-yabluka-sushka',
  'NEW-sochevytsya-chervona', 'NUT-048', 'NEW-garbuzove-golonasinne'];

function arg(name) { const i = process.argv.indexOf('--' + name); return i >= 0 ? process.argv[i + 1] : undefined; }
const flag = n => process.argv.includes('--' + n);

(async () => {
  const SRC = arg('src'), ONLY = arg('only'), WRITE = flag('write'), FORCE = flag('force');
  if (!SRC || !fs.existsSync(SRC) || !fs.statSync(SRC).isDirectory()) { console.error('ERROR: no source folder (--src)'); process.exit(1); }
  if (ONLY && ONLY !== 'card' && ONLY !== 'page') { console.error('ERROR: --only must be card or page'); process.exit(1); }
  const sharp = require(process.env.SHARP_PATH || 'sharp');

  const jobs = [];
  fs.readdirSync(SRC).sort().forEach(f => {
    const m = /^(.+?)(?:__(card|page))?\.(png|jpe?g)$/i.exec(f);
    if (!m) return;
    jobs.push({ file: f, id: m[1], kind: (m[2] || 'card').toLowerCase() });
  });

  let csvIds = new Set(), csvText = '';
  if (fs.existsSync(CSV)) {
    csvText = fs.readFileSync(CSV, 'utf8');
    csvText.split(/\r?\n/).slice(1).forEach(l => { const id = l.split(',')[0].trim(); if (id) csvIds.add(id); });
  }
  const newCsv = [];
  let done = 0, skipped = 0, exists = 0, errors = 0, bytesP = 0;
  console.log((WRITE ? 'WRITE' : 'DRY RUN') + ' src files: ' + jobs.length + (ONLY ? ' only=' + ONLY : ''));

  for (const j of jobs) {
    if (ONLY && j.kind !== ONLY) continue;
    const src = path.join(SRC, j.file);
    try {
      if (!/^[A-Za-z0-9_-]+$/.test(j.id)) throw new Error('bad id ' + j.id);
      if (j.kind === 'page' && NO_PAGE.includes(j.id)) { console.log(j.file + ': skip (no page)'); skipped++; continue; }
      const dst = j.kind === 'page' ? path.join(OUT, 'p', j.id + '.webp') : path.join(OUT, j.id + '.webp');
      const thumb = path.join(OUT, 's', j.id + '.webp');
      const exist = fs.existsSync(dst);
      if (exist && !FORCE) { console.log(j.file + ': exists, skip (use --force)'); exists++; continue; }
      console.log(j.file + ' -> ' + path.relative(ROOT, dst).split(path.sep).join('/') + (j.kind === 'card' ? ' + s/' + j.id + '.webp' : ''));
      if (WRITE) {
        const img = sharp(src).resize(SIZE, SIZE, { fit: 'cover', position: 'centre' });
        const buf = await img.webp({ quality: QUALITY, effort: 6 }).toBuffer();
        fs.mkdirSync(path.dirname(dst), { recursive: true });
        fs.writeFileSync(dst, buf);
        if (j.kind === 'page') bytesP += buf.length;
        if (j.kind === 'card') {
          let q = Q_START, tb;
          for (;;) {
            tb = await sharp(buf).resize({ width: THUMB_W, withoutEnlargement: true }).webp({ quality: q, effort: 6 }).toBuffer();
            if (tb.length <= THUMB_TARGET || q <= Q_MIN) break;
            q -= Q_STEP;
          }
          fs.mkdirSync(path.dirname(thumb), { recursive: true });
          fs.writeFileSync(thumb, tb);
          if (!csvIds.has(j.id)) { csvIds.add(j.id); newCsv.push([j.id, j.id + '.webp', BASE_URL + j.id + '.webp', 'photos.js: ' + j.file].join(',')); }
        }
      }
      done++;
    } catch (e) {
      errors++;
      console.log(j.file + ': ERROR ' + String(e && e.message || e).replace(/[^\x20-\x7E]/g, '?'));
    }
  }
  if (WRITE && newCsv.length) {
    const sep = csvText && !/\n$/.test(csvText) ? '\n' : '';
    fs.appendFileSync(CSV, sep + newCsv.join('\n') + '\n', 'utf8');
    console.log('csv: added ' + newCsv.length + ' row(s)');
  }
  console.log('SUMMARY: ' + (WRITE ? 'written' : 'would write') + ' ' + done + ', exists ' + exists + ', skip (no page) ' + skipped + ', errors ' + errors +
    (bytesP ? ', p/ bytes ' + bytesP : ''));
  process.exit(errors ? 1 : 0);
})().catch(e => { console.error('ERROR: ' + String(e && e.message || e).replace(/[^\x20-\x7E]/g, '?')); process.exit(1); });
