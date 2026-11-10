// PAMIR — Cloudflare Worker: принимает webhook от Telegram и пересылает в Apps Script.
// Секреты (GAS_URL, WEBHOOK_SECRET) хранятся в Cloudflare: Settings → Variables and secrets.
// В этом файле секретов нет.

export default {
  async fetch(request, env, ctx) {
    // Открытие адреса в браузере — просто проверка, что Worker жив
    if (request.method !== 'POST') {
      return new Response('PAMIR bot worker: ok');
    }

    // Принимаем только запросы от Telegram (он подставляет наш секрет в заголовок)
    const secret = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
    if (!env.WEBHOOK_SECRET || secret !== env.WEBHOOK_SECRET) {
      return new Response('forbidden', { status: 403 });
    }

    // Telegram сразу получает «ок», а пересылка в Apps Script идёт в фоне
    const body = await request.text();
    ctx.waitUntil(forward(env, body));
    return new Response('ok');
  },
};

async function forward(env, body) {
  const sep = env.GAS_URL.includes('?') ? '&' : '?';
  const url = env.GAS_URL + sep + 'src=tg&key=' + encodeURIComponent(env.WEBHOOK_SECRET);
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body,
        redirect: 'follow',
      });
      if (r.ok) return;
    } catch (e) {
      console.log('forward error', String(e));
    }
  }
}
