// Локальный стенд: витрина + настоящий Code.gs на таблице в памяти. Запуск: node tests/serve.js [порт] [путь к Code.gs]
const http = require('http');
const fs = require('fs');
const path = require('path');
const { createGas, seed } = require('./gas_mock');

const ROOT = path.join(__dirname, '..', 'webapp');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg' };

function start(port, codePath, tweak) {
  const s = seed();
  if (tweak) tweak(s);
  const gas = createGas(codePath || path.join(__dirname, '..', 'apps-script', 'Code.gs'), s);
  const log = []; // запросы к API — тесты смотрят, что и сколько раз вызывалось
  const opt = { delay: 0, failAction: '' }; // delay — задержка ответа, мс (как у настоящего Apps Script); failAction — действие, на которое стенд отвечает ошибкой
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/api') {
      if (req.method === 'GET') {
        log.push({ action: 'GET ' + url.searchParams.get('action') });
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify(gas.get(Object.fromEntries(url.searchParams))));
        return;
      }
      let body = '';
      req.on('data', c => { body += c; });
      req.on('end', () => {
        let out;
        try {
          const parsed = JSON.parse(body); log.push(parsed);
          out = opt.failAction && parsed.action === opt.failAction ? { ok: false, error: 'server_error' } : gas.post(body);
        } catch (e) { out = { ok: false, error: 'server_error', detail: String(e) }; }
        setTimeout(() => {
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify(out));
        }, opt.delay);
      });
      return;
    }
    if (url.pathname === '/config.js') { // вместо боевого config.js — адрес этого стенда
      res.writeHead(200, { 'Content-Type': TYPES['.js'] });
      res.end("window.PAMIR_CONFIG = { API_URL: location.origin + '/api', BOT: 'pamir_test_bot', APP: 'shop' };");
      return;
    }
    if (url.pathname === '/tg.js') { // подделка telegram-web-app.js с настоящей (для стенда) подписью
      const uid = Number(url.searchParams.get('uid'));
      res.writeHead(200, { 'Content-Type': TYPES['.js'] });
      if (!uid) { res.end('/* открыто не в Telegram */'); return; }
      const user = { id: uid, first_name: 'Олена', last_name: 'Тест', username: 'user' + uid, language_code: url.searchParams.get('lc') || 'uk' };
      const initData = gas.initData(user);
      res.end(`(function(){
        var cloud = {}; var calls = []; var handlers = {};
        function rec(n, a){ calls.push([n].concat(Array.prototype.slice.call(a||[]))); }
        var main = { text:'', visible:false, active:true, progress:false, cb:null,
          setParams:function(p){ if(p.text!==undefined) this.text=p.text; if(p.is_visible!==undefined) this.visible=p.is_visible; },
          hide:function(){ this.visible=false; }, show:function(){ this.visible=true; }, onClick:function(f){ this.cb=f; },
          showProgress:function(){ this.progress=true; }, hideProgress:function(){ this.progress=false; } };
        var back = { visible:false, cb:null, show:function(){this.visible=true;}, hide:function(){this.visible=false;}, onClick:function(f){this.cb=f;} };
        window.__tg = { calls: calls, main: main, back: back, cloud: cloud };
        window.Telegram = { WebApp: {
          initData: ${JSON.stringify(initData)},
          initDataUnsafe: { user: ${JSON.stringify(user)}, start_param: ${JSON.stringify(url.searchParams.get('start') || '')} },
          colorScheme: ${JSON.stringify(url.searchParams.get('theme') || 'light')}, version: '8.0',
          isVersionAtLeast: function(){ return true; },
          ready: function(){ rec('ready'); }, expand: function(){ rec('expand'); },
          setHeaderColor: function(c){ rec('setHeaderColor', [c]); }, setBackgroundColor: function(c){ rec('setBackgroundColor', [c]); },
          onEvent: function(n, f){ handlers[n]=f; },
          MainButton: main, BackButton: back,
          HapticFeedback: { notificationOccurred:function(k){ rec('haptic', [k]); }, impactOccurred:function(k){ rec('impact', [k]); }, selectionChanged:function(){ rec('select'); } },
          CloudStorage: {
            setItem:function(k,v,cb){ cloud[k]=v; if(cb) cb(null,true); },
            getItem:function(k,cb){ cb(null, cloud[k]||''); },
            getItems:function(keys,cb){ var o={}; keys.forEach(function(k){ o[k]=cloud[k]||''; }); cb(null,o); } },
          requestWriteAccess:function(cb){ rec('requestWriteAccess'); cb(true); },
          requestContact:function(cb){ rec('requestContact'); cb(true, { responseUnsafe: { contact: { phone_number: '380671112233' } } }); },
          showConfirm:function(t, cb){ rec('showConfirm', [t]); cb(true); },
          openTelegramLink:function(u){ rec('openTelegramLink', [u]); },
          enableVerticalSwipes:function(){ rec('swipes', [true]); }, disableVerticalSwipes:function(){ rec('swipes', [false]); },
          enableClosingConfirmation:function(){ rec('closing', [true]); }, disableClosingConfirmation:function(){ rec('closing', [false]); },
          addToHomeScreen:function(){ rec('addToHomeScreen'); }
        } };
      })();`);
      return;
    }
    let file = url.pathname === '/' ? '/index.html' : url.pathname;
    const full = path.join(ROOT, path.normalize(file));
    if (full.indexOf(ROOT) !== 0 || !fs.existsSync(full)) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(full)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(fs.readFileSync(full));
  });
  return new Promise(resolve => server.listen(port, '127.0.0.1', () => resolve({ server, gas, log, opt, url: 'http://127.0.0.1:' + port })));
}

module.exports = { start };
if (require.main === module) start(Number(process.argv[2]) || 8787, process.argv[3]).then(x => console.log('Стенд: ' + x.url + '/?debug=1'));
