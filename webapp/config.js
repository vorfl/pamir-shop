// Настройки витрины PAMIR. Секретов здесь нет и быть не должно: файл публичный.
window.PAMIR_CONFIG = {
  // URL веб-приложения Apps Script (заканчивается на /exec).
  // Если оставить пустым, витрина покажет демо-товары из demo-catalog.json.
  API_URL: 'https://script.google.com/macros/s/AKfycbw7D-TzLOoA9Sjm-d6o7qvb1zXT-4PoagfFwNP0O48f2vtYK5rC3EULKUeDkEKRonryzg/exec',
  // Имя бота без @: на него ведёт ссылка, если магазин открыли не из Telegram.
  BOT: 'pamir_spices_bot',
  // Короткое имя Mini App из BotFather (/newapp), например 'shop'. Пока пусто, ссылки на товар
  // идут через чат бота (t.me/бот?start=ID); с именем — открывают товар сразу (t.me/бот/shop?startapp=ID).
  APP: 'shop',
  // Необязательно: адрес каталога через Cloudflare Worker — адрес Worker + /catalog, например
  // 'https://pamir-bot.ИМЯ.workers.dev/catalog'. Пусто — каталог берётся из Apps Script, как раньше.
  // Если Worker не ответил за 6 секунд или ответил не так, витрина сама идёт в Apps Script.
  // Заказы, цены и всё остальное в любом случае идут только в Apps Script.
  CATALOG_URL: 'https://pamir-bot.pochoev2306.workers.dev/catalog',
  // Необязательно: справочник Новой пошты (города и отделения) через Cloudflare Worker — адрес Worker + /np.
  // Пусто или нет ключа — города и отделения берутся из Apps Script, как раньше. Если Worker не ответил за 4 секунды
  // или ответил не так, витрина сама идёт в Apps Script и 10 минут Worker не спрашивает. Тариф и заказ идут только в Apps Script.
  NP_URL: 'https://pamir-bot.pochoev2306.workers.dev/np'
};
