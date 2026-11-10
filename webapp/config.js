// Настройки витрины PAMIR. Секретов здесь нет и быть не должно: файл публичный.
window.PAMIR_CONFIG = {
  // URL веб-приложения Apps Script (заканчивается на /exec).
  // Если оставить пустым, витрина покажет демо-товары из demo-catalog.json.
  API_URL: 'https://script.google.com/macros/s/AKfycbw7D-TzLOoA9Sjm-d6o7qvb1zXT-4PoagfFwNP0O48f2vtYK5rC3EULKUeDkEKRonryzg/exec',
  // Имя бота без @: на него ведёт ссылка, если магазин открыли не из Telegram.
  BOT: 'pamir_spices_bot',
  // Короткое имя Mini App из BotFather (/newapp), например 'shop'. Пока пусто, ссылки на товар
  // идут через чат бота (t.me/бот?start=ID); с именем — открывают товар сразу (t.me/бот/shop?startapp=ID).
  APP: 'shop'
};
