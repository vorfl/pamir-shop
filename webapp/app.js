/* PAMIR — витрина (Telegram Mini App). Чистый JS, без сборки.
 * Этап 1: каталог. Этап 2: корзина и оформление. Этап 3: отправка заказа на сервер.
 */
(function () {
  'use strict';

  /* ------------------------------ Тексты ------------------------------ */
  var I18N = {
    ua: {
      search: 'Пошук товарів',
      all: 'Усі',
      toCart: 'У кошик',
      out: 'Немає в наявності',
      badgeIn: 'Є в наявності',
      badgeNew: 'Новинка', badgeHit: 'Хіт', badgeSale: 'Знижка', featureCta: 'Обрати',
      admBadge: 'Бейдж на картці', admBadgeNone: 'Без бейджа', admOld: 'Стара ціна, ₴ (буде закреслена)',
      admOldHint: 'У тих самих одиницях, що й ціна. Порожньо — без знижки.',
      admLink: 'Посилання на товар для постів', admLinkCopy: 'Скопіювати посилання', admLinkCopied: 'Посилання скопійовано',
      admLinkFail: 'Не вдалося скопіювати. Виділіть посилання вручну.',
      badgeOut: 'Немає',
      per: 'за',
      perPiece: 'за шт',
      perPack: 'за уп.',
      packing: 'Фасування',
      qty: 'Кількість',
      pcs: 'шт',
      less: 'Менше',
      more: 'Більше',
      close: 'Закрити',
      wholesale: 'Опт',
      outNote: 'Зараз цього товару немає в наявності.',
      emptyTitle: 'Нічого не знайдено',
      emptyText: 'Спробуйте іншу назву або категорію.',
      reset: 'Показати всі товари',
      errTitle: 'Не вдалося завантажити каталог',
      errText: 'Перевірте інтернет і спробуйте ще раз.',
      retry: 'Спробувати ще раз',
      demo: 'Демо-товари: URL бекенда ще не вказано в config.js',
      debug: 'Тестовий режим',
      addToCart: 'Додати в кошик',
      inCart: 'У кошику',
      added: 'Додано в кошик',
      cart: 'Кошик',
      checkoutBtn: 'Оформити замовлення',
      confirmBtn: 'Підтвердити замовлення',
      back: 'Назад',
      cartEmptyTitle: 'Кошик порожній',
      cartEmptyText: 'Додайте товари з каталогу.',
      toCatalog: 'Перейти до каталогу',
      remove: 'Видалити',
      total: 'Разом',
      lineOut: 'Немає в наявності. Не увійде в замовлення',
      lineGone: 'Товар знято з продажу',
      priceWas: 'Ціна змінилася, було',
      removeOut: 'Прибрати відсутні товари',
      checkout: 'Оформлення',
      order: 'Ваше замовлення',
      fName: 'Ім\u2019я',
      fPhone: 'Телефон',
      sharePhone: 'Поділитися номером',
      delivery: 'Доставка',
      pickup: 'Самовивіз з ринку',
      np: 'Нова пошта',
      fCity: 'Місто',
      fBranch: '№ відділення або поштомата',
      payment: 'Оплата',
      payCash: 'При отриманні',
      payCard: 'Переказ на картку',
      payCod: 'Накладений платіж',
      payCardNote: 'Реквізити надішлемо в Telegram після підтвердження замовлення.',
      fComment: 'Коментар',
      optional: 'необов\u2019язково',
      commentPh: 'Побажання до замовлення',
      errName: 'Вкажіть ім\u2019я, щоб ми знали, як до вас звертатися',
      errPhone: 'Введіть номер повністю: +380 і ще 9 цифр',
      errCity: 'Вкажіть місто для доставки Новою поштою',
      errBranch: 'Вкажіть номер відділення або поштомата',
      errFix: 'Перевірте виділені поля',
      doneTitle: 'Замовлення прийнято',
      doneText: 'Ми підтвердимо наявність і напишемо вам у Telegram.',
      doneStub: 'Демо-режим: замовлення нікуди не надсилається.',
      doneTest: 'Тестове замовлення: у таблиці воно позначене як test.',
      sending: 'Надсилаємо…',
      errSend: 'Не вдалося надіслати замовлення. Перевірте інтернет і спробуйте ще раз.',
      errRate: 'Забагато замовлень за годину. Спробуйте пізніше або напишіть нам у Telegram.',
      errAuth: 'Не вдалося підтвердити ваш Telegram-акаунт. Закрийте магазин і відкрийте його знову з бота.',
      errNeedTg: 'Замовлення оформлюється в Telegram. Відкрийте магазин у нашому боті:',
      errTestOff: 'Тестові замовлення вимкнені на сервері (властивість ALLOW_TEST_ORDERS).',
      cartChanged: 'Ціни або наявність щойно змінилися. Перевірте кошик і оформіть замовлення ще раз.',
      doneBack: 'Повернутися до каталогу',
      admin: 'Адмін-панель', admOrders: 'Замовлення', admProducts: 'Товари', admToday: 'Сьогодні', admWeek: '7 днів',
      admSearchO: 'Номер, телефон або ім\u2019я', admSearchP: 'Назва або ID', admAll: 'Усі', admEmpty: 'Нічого немає',
      admLoading: 'Завантаження…', admError: 'Не вдалося завантажити. Спробуйте ще раз.',
      admForbidden: 'Немає доступу. Адмін-панель відкривається лише з Telegram-акаунта адміністратора.',
      admRefresh: 'Оновити', admWrite: 'Написати клієнту', admSaved: 'Збережено', admNotTold: 'Клієнту написати не вдалося',
      admFail: 'Не вдалося зберегти. Спробуйте ще раз.', admStock: 'В наявності', admPriceKg: 'Ціна за 1 кг, ₴',
      admPriceUnit: 'Ціна за упаковку / шт, ₴', admNameUa: 'Назва (UA)', admNameRu: 'Название (RU)', admPacks: 'Фасування',
      admPacksHint: 'Через « / », наприклад: 100 г / 250 г / 1 кг', admDescUa: 'Опис (UA)', admDescRu: 'Описание (RU)',
      admSave: 'Зберегти', admMore: 'Показано перші 60. Уточніть пошук.', admTest: 'тест',
      admErrName: 'Назва (UA) не може бути порожньою', admErrPrice: 'Ціна має бути числом',
      admCats: 'Категорії', admSettings: 'Налаштування', admAdd: 'Додати товар', admAddCat: 'Додати категорію',
      admNew: 'Новий товар', admNewCat: 'Нова категорія', admCat: 'Категорія', admType: 'Тип',
      admTypeW: 'ваговий (ціна за 1 кг)', admTypeP: 'упаковка', admTypeU: 'штука',
      admPrice: 'Ціна, ₴', admPriceHint: 'Ваговий товар: за 1 кг. Упаковка і штука: за одиницю.',
      admWh: 'Оптова ціна, ₴', admWm: 'Опт: мінімальний обсяг', admHidden: 'Приховати з вітрини',
      admHiddenTag: 'приховано', admNoPhoto: 'без фото', admPhotoPick: 'Вибрати фото', admPhotoChange: 'Замінити фото',
      admPhotoDel: 'Прибрати фото', admPhotoUp: 'Завантажуємо фото…', admPhotoFail: 'Не вдалося завантажити фото. Спробуйте ще раз.',
      admPhotoLater: 'Фото можна додати одразу після збереження товару.',
      admCatCode: 'Код', admCatCodeHint: '2–5 латинських літер, наприклад SPC. З нього починаються ID товарів. Змінити потім не можна.',
      admCatUa: 'Назва (UA)', admCatRu: 'Название (RU)', admCatIcon: 'Іконка', admCatOrder: 'Порядок на вітрині',
      admErrCode: 'Код: від 2 до 5 латинських літер', admErrExists: 'Категорія з таким кодом уже є',
      admErrPay: 'Залиште хоча б один спосіб оплати: при отриманні або на картку',
      ico_nut: 'Горіх', ico_cherry: 'Сухофрукти', ico_candy: 'Солодощі', ico_flame: 'Спеції', ico_leaf: 'Чай', ico_coffee: 'Кава',
      minOrder: 'Мінімальна сума замовлення:',
      stC: 'Підтвердити', stN: 'Немає в наявності', stS: 'Відправлено', stD: 'Виконано'
    },
    ru: {
      search: 'Поиск товаров',
      all: 'Все',
      toCart: 'В корзину',
      out: 'Нет в наличии',
      badgeIn: 'В наличии',
      badgeNew: 'Новинка', badgeHit: 'Хит', badgeSale: 'Скидка', featureCta: 'Выбрать',
      admBadge: 'Бейдж на карточке', admBadgeNone: 'Без бейджа', admOld: 'Старая цена, ₴ (будет зачёркнута)',
      admOldHint: 'В тех же единицах, что и цена. Пусто — без скидки.',
      admLink: 'Ссылка на товар для постов', admLinkCopy: 'Скопировать ссылку', admLinkCopied: 'Ссылка скопирована',
      admLinkFail: 'Не удалось скопировать. Выделите ссылку вручную.',
      badgeOut: 'Нет',
      per: 'за',
      perPiece: 'за шт',
      perPack: 'за уп.',
      packing: 'Фасовка',
      qty: 'Количество',
      pcs: 'шт',
      less: 'Меньше',
      more: 'Больше',
      close: 'Закрыть',
      wholesale: 'Опт',
      outNote: 'Сейчас этого товара нет в наличии.',
      emptyTitle: 'Ничего не найдено',
      emptyText: 'Попробуйте другое название или категорию.',
      reset: 'Показать все товары',
      errTitle: 'Не удалось загрузить каталог',
      errText: 'Проверьте интернет и попробуйте ещё раз.',
      retry: 'Попробовать ещё раз',
      demo: 'Демо-товары: URL бэкенда ещё не указан в config.js',
      debug: 'Тестовый режим',
      addToCart: 'Добавить в корзину',
      inCart: 'В корзине',
      added: 'Добавлено в корзину',
      cart: 'Корзина',
      checkoutBtn: 'Оформить заказ',
      confirmBtn: 'Подтвердить заказ',
      back: 'Назад',
      cartEmptyTitle: 'Корзина пуста',
      cartEmptyText: 'Добавьте товары из каталога.',
      toCatalog: 'Перейти в каталог',
      remove: 'Удалить',
      total: 'Итого',
      lineOut: 'Нет в наличии. Не войдёт в заказ',
      lineGone: 'Товар снят с продажи',
      priceWas: 'Цена изменилась, было',
      removeOut: 'Убрать отсутствующие товары',
      checkout: 'Оформление',
      order: 'Ваш заказ',
      fName: 'Имя',
      fPhone: 'Телефон',
      sharePhone: 'Поделиться номером',
      delivery: 'Доставка',
      pickup: 'Самовывоз с рынка',
      np: 'Новая почта',
      fCity: 'Город',
      fBranch: '№ отделения или почтомата',
      payment: 'Оплата',
      payCash: 'При получении',
      payCard: 'Перевод на карту',
      payCod: 'Наложенный платёж',
      payCardNote: 'Реквизиты пришлём в Telegram после подтверждения заказа.',
      fComment: 'Комментарий',
      optional: 'необязательно',
      commentPh: 'Пожелания к заказу',
      errName: 'Укажите имя, чтобы мы знали, как к вам обращаться',
      errPhone: 'Введите номер полностью: +380 и ещё 9 цифр',
      errCity: 'Укажите город для доставки Новой почтой',
      errBranch: 'Укажите номер отделения или почтомата',
      errFix: 'Проверьте выделенные поля',
      doneTitle: 'Заказ принят',
      doneText: 'Мы подтвердим наличие и напишем вам в Telegram.',
      doneStub: 'Демо-режим: заказ никуда не отправляется.',
      doneTest: 'Тестовый заказ: в таблице он помечен как test.',
      sending: 'Отправляем…',
      errSend: 'Не удалось отправить заказ. Проверьте интернет и попробуйте ещё раз.',
      errRate: 'Слишком много заказов за час. Попробуйте позже или напишите нам в Telegram.',
      errAuth: 'Не удалось подтвердить ваш Telegram-аккаунт. Закройте магазин и откройте его снова из бота.',
      errNeedTg: 'Заказ оформляется в Telegram. Откройте магазин в нашем боте:',
      errTestOff: 'Тестовые заказы выключены на сервере (свойство ALLOW_TEST_ORDERS).',
      cartChanged: 'Цены или наличие только что изменились. Проверьте корзину и оформите заказ ещё раз.',
      doneBack: 'Вернуться в каталог',
      admin: 'Админ-панель', admOrders: 'Заказы', admProducts: 'Товары', admToday: 'Сегодня', admWeek: '7 дней',
      admSearchO: 'Номер, телефон или имя', admSearchP: 'Название или ID', admAll: 'Все', admEmpty: 'Ничего нет',
      admLoading: 'Загрузка…', admError: 'Не удалось загрузить. Попробуйте ещё раз.',
      admForbidden: 'Нет доступа. Админ-панель открывается только с Telegram-аккаунта администратора.',
      admRefresh: 'Обновить', admWrite: 'Написать клиенту', admSaved: 'Сохранено', admNotTold: 'Клиенту написать не удалось',
      admFail: 'Не удалось сохранить. Попробуйте ещё раз.', admStock: 'В наличии', admPriceKg: 'Цена за 1 кг, ₴',
      admPriceUnit: 'Цена за упаковку / шт, ₴', admNameUa: 'Назва (UA)', admNameRu: 'Название (RU)', admPacks: 'Фасовка',
      admPacksHint: 'Через « / », например: 100 г / 250 г / 1 кг', admDescUa: 'Опис (UA)', admDescRu: 'Описание (RU)',
      admSave: 'Сохранить', admMore: 'Показаны первые 60. Уточните поиск.', admTest: 'тест',
      admErrName: 'Назва (UA) не может быть пустой', admErrPrice: 'Цена должна быть числом',
      admCats: 'Категории', admSettings: 'Настройки', admAdd: 'Добавить товар', admAddCat: 'Добавить категорию',
      admNew: 'Новый товар', admNewCat: 'Новая категория', admCat: 'Категория', admType: 'Тип',
      admTypeW: 'весовой (цена за 1 кг)', admTypeP: 'упаковка', admTypeU: 'штука',
      admPrice: 'Цена, ₴', admPriceHint: 'Весовой товар: за 1 кг. Упаковка и штука: за единицу.',
      admWh: 'Оптовая цена, ₴', admWm: 'Опт: минимальный объём', admHidden: 'Скрыть с витрины',
      admHiddenTag: 'скрыт', admNoPhoto: 'без фото', admPhotoPick: 'Выбрать фото', admPhotoChange: 'Заменить фото',
      admPhotoDel: 'Убрать фото', admPhotoUp: 'Загружаем фото…', admPhotoFail: 'Не удалось загрузить фото. Попробуйте ещё раз.',
      admPhotoLater: 'Фото можно добавить сразу после сохранения товара.',
      admCatCode: 'Код', admCatCodeHint: '2–5 латинских букв, например SPC. С него начинаются ID товаров. Изменить потом нельзя.',
      admCatUa: 'Назва (UA)', admCatRu: 'Название (RU)', admCatIcon: 'Иконка', admCatOrder: 'Порядок на витрине',
      admErrCode: 'Код: от 2 до 5 латинских букв', admErrExists: 'Категория с таким кодом уже есть',
      admErrPay: 'Оставьте хотя бы один способ оплаты: при получении или на карту',
      ico_nut: 'Орех', ico_cherry: 'Сухофрукты', ico_candy: 'Сладости', ico_flame: 'Специи', ico_leaf: 'Чай', ico_coffee: 'Кофе',
      minOrder: 'Минимальная сумма заказа:',
      stC: 'Подтвердить', stN: 'Нет в наличии', stS: 'Отправлено', stD: 'Выполнено'
    }
  };

  /* ---------------------- Иконки Lucide (встроены) ---------------------- */
  var ICONS = {
    nut: '<path d="M16.847 5.847 20 9a7.23 7.23 0 011.551 7.516C21.241 17.352 21 17.932 21 19v1a1 1 0 01-1 1h-1c-1.069 0-1.648.242-2.485.552A7.2 7.2 0 019.002 20l-3.155-3.153"/><path d="M18.21 5.43c-1.71.69-5.07 1.07-6.71 1.07.46 1.38.91 2.74.61 4.88a.88.88 0 01-.73.74c-1.78.28-3.54-.17-4.88-.62 0 1.64-.38 5-1.07 6.71-.21.52-.82.55-1.17.12A10 10 0 0118.33 4.26c.43.35.4.97-.12 1.17"/><path d="M4.93 4.93 3 3a.7.7 0 010-1"/>',
    cherry: '<path d="M2 17a5 5 0 0 0 10 0c0-2.76-2.5-5-5-3-2.5-2-5 .24-5 3Z"/><path d="M12 17a5 5 0 0 0 10 0c0-2.76-2.5-5-5-3-2.5-2-5 .24-5 3Z"/><path d="M7 14c3.22-2.91 4.29-8.75 5-12 1.66 2.38 4.94 9 5 12"/><path d="M22 9c-4.29 0-7.14-2.33-10-7 5.71 0 10 4.67 10 7Z"/>',
    candy: '<path d="M10 7v10.9"/><path d="M14 6.1V17"/><path d="M16 7V3a1 1 0 0 1 1.707-.707 2.5 2.5 0 0 0 2.152.717 1 1 0 0 1 1.131 1.131 2.5 2.5 0 0 0 .717 2.152A1 1 0 0 1 21 8h-4"/><path d="M16.536 7.465a5 5 0 0 0-7.072 0l-2 2a5 5 0 0 0 0 7.07 5 5 0 0 0 7.072 0l2-2a5 5 0 0 0 0-7.07"/><path d="M8 17v4a1 1 0 0 1-1.707.707 2.5 2.5 0 0 0-2.152-.717 1 1 0 0 1-1.131-1.131 2.5 2.5 0 0 0-.717-2.152A1 1 0 0 1 3 16h4"/>',
    flame: '<path d="M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4"/>',
    leaf: '<path d="M11 20a10 10 0 0010-10 25.9 25.9 0 00-1.04-7.281 1 1 0 00-1.755-.325C15.833 5.5 13 5.5 9.8 6.1A7 7 0 0011 20"/><path d="M2 21a5 5 0 012.911-4.544C7.613 15.212 8.351 15.24 11 13"/>',
    coffee: '<path d="M10 2v2"/><path d="M14 2v2"/><path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1"/><path d="M6 2v2"/>',
    search: '<path d="m21 21-4.34-4.34"/><circle cx="11" cy="11" r="8"/>',
    plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
    minus: '<path d="M5 12h14"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    'shopping-cart': '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>',
    'trash-2': '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><path d="M10 11v6"/><path d="M14 11v6"/>',
    truck: '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
    store: '<path d="M3 9.5 4.5 4h15L21 9.5"/><path d="M3 9.5a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/><path d="M5 12.2V20h14v-7.8"/><path d="M10 20v-4h4v4"/>',
    'arrow-left': '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
    check: '<path d="M20 6 9 17l-5-5"/>'
  };

  function icon(name) {
    return ICONS[name] ? '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">' + ICONS[name] + '</svg>' : '';
  }
  var MARK = '<svg class="mark" aria-hidden="true"><use href="#mark"/></svg>';

  /* ------------------------------ Окружение ------------------------------ */
  var cfg = window.PAMIR_CONFIG || {};
  var params = new URLSearchParams(location.search);
  var DEBUG = params.get('debug') === '1';
  var tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
  var inTelegram = !!(tg && tg.initData);
  var tgUser = inTelegram && tg.initDataUnsafe && tg.initDataUnsafe.user
    ? tg.initDataUnsafe.user
    : (DEBUG ? { id: 1, first_name: 'Тест', username: 'test_user', language_code: 'uk' } : null);

  var CACHE_KEY = 'pamir_catalog_v1';
  var LANG_KEY = 'pamir_lang';
  var CART_KEY = 'pamir_cart_v1';
  var FORM_KEY = 'pamir_form_v1';
  var MAX_QTY = 99;
  var useNativeMain = !!(inTelegram && tg.MainButton);

  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* хранилище недоступно */ } }
  };

  var state = {
    lang: 'ua',
    cat: '',          // код категории, '' = все
    q: '',
    catalog: null,
    status: 'loading', // loading | ready | error
    sheet: null,       // { id, vi, qty }
    view: 'catalog',   // catalog | cart | checkout | done | admin
    scrollY: 0,
    cart: { t: 0, i: [] }, // i: [{ id, g (граммы, 0 = штука/упаковка), q, pr (цена за единицу), was? }]
    form: { name: '', phone: '', delivery: 'pickup', city: '', branch: '', pay: 'cash', comment: '' },
    done: null,
    cartNotice: '',
    rid: ''            // id попытки заказа: повторная отправка не создаст второй заказ
  };

  var el = {
    banner: document.getElementById('banner'),
    search: document.getElementById('search'),
    chips: document.getElementById('chips'),
    main: document.getElementById('main'),
    sheet: document.getElementById('sheet'),
    backdrop: document.getElementById('backdrop'),
    notice: document.getElementById('notice'),
    page: document.getElementById('page'),
    bar: document.getElementById('bar'),
    barBtn: document.getElementById('barBtn'),
    toast: document.getElementById('toast'),
    cartBtn: document.getElementById('cartBtn'),
    cartCount: document.getElementById('cartCount'),
    adminBtn: document.getElementById('adminBtn')
  };

  /* ------------------------------ Форматы ------------------------------ */
  var NBSP = ' ';

  function t(key) { return I18N[state.lang][key] || I18N.ua[key] || key; }

  function esc(s) {
    return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /** 1250 → «1 250 ₴» (неразрывные пробелы) */
  function money(n) {
    return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP) + NBSP + '₴';
  }

  /** 250 → «250 г», 1000 → «1 кг», 1500 → «1,5 кг» */
  function weight(g) {
    if (g >= 1000) return String(g / 1000).replace('.', ',') + NBSP + 'кг';
    return g + NBSP + 'г';
  }

  function name(p) { return state.lang === 'ru' && p.ru ? p.ru : p.ua; }
  function desc(p) { return state.lang === 'ru' ? (p.dRu || p.dUa || '') : (p.dUa || p.dRu || ''); }

  /** Цена и подпись для карточки: весовой — за 100 г, упаковка — за упаковку. */
  function cardPrice(p) {
    if (p.t === 'w') {
      if (!(p.k > 0)) return null;
      return { price: Math.round(p.k * 100 / 1000), old: p.o > p.k ? Math.round(p.o * 100 / 1000) : 0, unit: t('per') + ' ' + weight(100) };
    }
    if (!(p.p > 0)) return null;
    return { price: p.p, old: p.o > p.p ? Math.round(p.o) : 0, unit: p.t === 'p' && p.pk ? t('per') + ' ' + p.pk.replace(/ /g, NBSP) : t('perPiece') };
  }

  /* ------------------------------ Тема, язык ------------------------------ */
  function applyTheme() {
    var forced = params.get('theme');
    var dark = forced ? forced === 'dark'
      : inTelegram ? tg.colorScheme === 'dark'
      : window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    if (inTelegram) {
      var surface = dark ? '#1B1C1F' : '#FAF6EF';
      try { tg.setHeaderColor(surface); } catch (e) { /* старый клиент Telegram */ }
      try { tg.setBackgroundColor(surface); } catch (e) { /* старый клиент Telegram */ }
    }
  }

  function initLang() {
    var saved = store.get(LANG_KEY);
    var forced = params.get('lang');
    if (forced === 'ru' || forced === 'ua') state.lang = forced;
    else if (saved === 'ru' || saved === 'ua') state.lang = saved;
    else if (tgUser && String(tgUser.language_code || '').toLowerCase().indexOf('ru') === 0) state.lang = 'ru';
  }

  function setLang(lang) {
    state.lang = lang;
    store.set(LANG_KEY, lang);
    renderAll();
  }

  /* ------------------------------ Данные ------------------------------ */
  function catalogUrl() {
    return cfg.API_URL ? cfg.API_URL + (cfg.API_URL.indexOf('?') < 0 ? '?' : '&') + 'action=catalog' : 'demo-catalog.json';
  }

  function setCatalog(data) {
    data.byId = {};
    data.products.forEach(function (p) { data.byId[p.id] = p; });
    state.catalog = data;
    state.status = 'ready';
    if (state.cat && !data.categories.some(function (c) { return c.code === state.cat; })) state.cat = '';
    reconcileCart();
  }

  /** Ссылка на товар: ?startapp=DRY-039 у Mini App или ?p=DRY-039 в адресе. Открываем один раз. */
  var deepId = String((inTelegram && tg.initDataUnsafe && tg.initDataUnsafe.start_param) || params.get('p') || params.get('tgWebAppStartParam') || '').trim().toLowerCase();
  function openDeepLink() {
    if (!deepId || !state.catalog || state.view !== 'catalog') return;
    var found = null;
    state.catalog.products.forEach(function (p) { if (p.id.toLowerCase() === deepId) found = p; });
    if (!found) return; // в сохранённой копии товара может не быть — попробуем ещё раз после свежей загрузки
    deepId = '';
    openSheet(found.id);
  }

  function loadCatalog() {
    // 1) Мгновенно показываем сохранённую копию, 2) в фоне берём свежую.
    var cachedText = cfg.API_URL ? store.get(CACHE_KEY) : null;
    if (cachedText && !state.catalog) {
      try {
        var cached = JSON.parse(cachedText);
        if (cached && cached.url === cfg.API_URL && cached.data && cached.data.products) setCatalog(cached.data);
      } catch (e) { /* испорченная копия — игнорируем */ }
    }
    if (!state.catalog) state.status = 'loading';
    renderAll();
    openDeepLink();

    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 20000);

    return fetch(catalogUrl(), ctrl ? { signal: ctrl.signal } : undefined)
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (data) {
        clearTimeout(timer);
        if (!data || !data.ok || !Array.isArray(data.products)) throw new Error('bad catalog');
        var fresh = JSON.stringify({ c: data.categories, p: data.products, s: data.shop });
        var old = state.catalog
          ? JSON.stringify({ c: state.catalog.categories, p: state.catalog.products, s: state.catalog.shop })
          : '';
        if (cfg.API_URL) store.set(CACHE_KEY, JSON.stringify({ url: cfg.API_URL, data: data }));
        if (fresh !== old) {
          setCatalog(data);
          renderAll();
        }
        openDeepLink();
        deepId = '';
      })
      .catch(function () {
        clearTimeout(timer);
        if (!state.catalog) {
          state.status = 'error';
          renderMain();
        }
      });
  }

  /* ------------------------------ Отрисовка ------------------------------ */
  function renderAll() {
    document.documentElement.lang = state.lang === 'ru' ? 'ru' : 'uk';
    el.search.placeholder = t('search');
    el.search.setAttribute('aria-label', t('search'));
    Array.prototype.forEach.call(document.querySelectorAll('.lang button'), function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-lang') === state.lang));
    });
    renderBanner();
    renderChips();
    renderMain();
    if (state.sheet) renderSheet();
    if (state.view === 'checkout') updateCheckoutSum(); else if (state.view !== 'admin') renderPage();
    updateChrome();
  }

  function renderBanner() {
    var parts = [];
    if (DEBUG) parts.push(t('debug'));
    if (!cfg.API_URL) parts.push(t('demo'));
    el.banner.hidden = parts.length === 0;
    el.banner.textContent = parts.join(' · ');
    // Объявление магазина из настроек («Сьогодні не працюємо»).
    var notice = shopInfo().notice;
    var text = notice ? (state.lang === 'ru' ? notice.ru : notice.ua) || '' : '';
    el.notice.textContent = text;
    el.notice.hidden = !text;
  }

  function shopInfo() { return (state.catalog && state.catalog.shop) || {}; }

  /** Способы оплаты, включённые в настройках магазина (старый бэкенд их не присылает — тогда все). */
  function payMethods() {
    var list = shopInfo().pay;
    return Array.isArray(list) && list.length ? list : ['cash', 'card', 'cod'];
  }

  function renderChips() {
    var cats = state.catalog ? state.catalog.categories : [];
    var html = '<button type="button" class="chip" data-cat="" aria-pressed="' + (state.cat === '') + '">' + esc(t('all')) + '</button>';
    cats.forEach(function (c) {
      html += '<button type="button" class="chip" data-cat="' + esc(c.code) + '" aria-pressed="' + (state.cat === c.code) + '">' +
        icon(c.icon) + esc(state.lang === 'ru' ? c.ru : c.ua) + '</button>';
    });
    el.chips.innerHTML = html;
  }

  function visibleProducts() {
    var q = state.q.trim().toLowerCase();
    var list = state.catalog.products.filter(function (p) {
      if (state.cat && p.c !== state.cat) return false;
      if (!q) return true;
      return (p.ua + ' ' + (p.ru || '') + ' ' + p.id).toLowerCase().indexOf(q) >= 0;
    });
    // Товары, которых нет, уходят в конец; порядок остальных — как в таблице.
    return list.filter(function (p) { return p.a; }).concat(list.filter(function (p) { return !p.a; }));
  }

  function photoHtml(p) {
    return p.img
      ? '<img src="' + esc(p.img) + '" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">'
      : MARK;
  }

  function badgeHtml(p) {
    return p.a
      ? '<span class="badge badge--stock">' + esc(t('badgeIn')) + '</span>'
      : '<span class="badge badge--out">' + esc(t('badgeOut')) + '</span>';
  }

  var PROMO = { 'new': 'badgeNew', hit: 'badgeHit', sale: 'badgeSale' };
  /** Бейдж «Новинка / Хіт / Знижка»; у товара, которого нет, не показываем. */
  function promoHtml(p) {
    return p.a && PROMO[p.b] ? '<span class="badge promo promo--' + p.b + '">' + esc(t(PROMO[p.b])) + '</span>' : '';
  }
  function priceHtml(cp) {
    return '<span class="price">' + money(cp.price) + '</span>' +
      (cp.old ? '<s class="price-old">' + money(cp.old) + '</s>' : '') + '<span class="unit">' + esc(cp.unit) + '</span>';
  }

  /** Блок наверху каталога («Наша курага»): виден без поиска и фильтра, пока товар в наличии. */
  function featureHtml() {
    var f = shopInfo().feature;
    if (!f || state.q.trim() || state.cat) return '';
    var p = state.catalog.byId[f.id];
    if (!p || !p.a) return '';
    var ru = state.lang === 'ru';
    var title = (ru ? f.title.ru : f.title.ua) || name(p);
    var text = (ru ? f.text.ru : f.text.ua) || '';
    var cp = cardPrice(p);
    return '<article class="feature card" data-id="' + esc(p.id) + '"><div class="feature__img card__img">' + photoHtml(p) + '</div>' +
      '<div class="feature__body"><h2 class="feature__title">' + esc(title) + '</h2>' +
      (text ? '<p class="feature__text">' + esc(text) + '</p>' : '') +
      '<div class="feature__foot"><div class="card__meta">' + (cp ? priceHtml(cp) : '') + '</div>' +
      '<button type="button" class="btn btn--primary">' + esc(t('featureCta')) + '</button></div></div></article>';
  }

  function cardHtml(p) {
    var cp = cardPrice(p);
    var meta = cp ? priceHtml(cp) : '';
    var inCart = p.a ? cartQty(p.id) : 0;
    var btn = inCart
      ? '<button type="button" class="btn btn--soft btn--block">' + esc(t('inCart')) + ' · ' + inCart + '</button>'
      : p.a
      ? '<button type="button" class="btn btn--primary btn--block"><svg class="ico" aria-hidden="true"><use href="#i-plus"/></svg>' + esc(t('toCart')) + '</button>'
      : '<button type="button" class="btn btn--block" disabled>' + esc(t('out')) + '</button>';
    return '<article class="card' + (p.a ? '' : ' card--out') + '" data-id="' + esc(p.id) + '">' +
      '<div class="card__img">' + photoHtml(p) + badgeHtml(p) + promoHtml(p) + '</div>' +
      '<h2 class="card__name">' + esc(name(p)) + '</h2>' +
      '<div class="card__meta">' + meta + '</div>' + btn + '</article>';
  }

  function renderMain() {
    if (state.status === 'loading') {
      var sk = '';
      for (var i = 0; i < 6; i++) sk += '<div class="skeleton"></div>';
      el.main.innerHTML = '<div class="grid" aria-hidden="true">' + sk + '</div>';
      return;
    }
    if (state.status === 'error') {
      el.main.innerHTML = '<div class="state">' + MARK +
        '<p class="state__title">' + esc(t('errTitle')) + '</p>' +
        '<p class="state__text">' + esc(t('errText')) + '</p>' +
        '<button type="button" class="btn btn--primary" data-action="retry">' + esc(t('retry')) + '</button></div>';
      return;
    }
    var list = visibleProducts();
    if (!list.length) {
      el.main.innerHTML = '<div class="state">' + MARK +
        '<p class="state__title">' + esc(t('emptyTitle')) + '</p>' +
        '<p class="state__text">' + esc(t('emptyText')) + '</p>' +
        '<button type="button" class="btn" data-action="reset">' + esc(t('reset')) + '</button></div>';
      return;
    }
    el.main.innerHTML = featureHtml() + '<div class="grid">' + list.map(cardHtml).join('') + '</div>';
  }

  /* ------------------------------ Шторка товара ------------------------------ */
  function openSheet(id) {
    var p = state.catalog && state.catalog.byId[id];
    if (!p) return;
    state.sheet = { id: id, vi: 0, qty: 1 };
    renderSheet();
    el.sheet.hidden = false;
    el.backdrop.hidden = false;
    document.body.classList.add('is-locked');
    updateChrome();
    var closeBtn = el.sheet.querySelector('.sheet__close');
    if (closeBtn) closeBtn.focus({ preventScroll: true });
  }

  function closeSheet() {
    if (!state.sheet) return;
    state.sheet = null;
    el.sheet.hidden = true;
    el.backdrop.hidden = true;
    document.body.classList.remove('is-locked');
    updateChrome();
  }

  /** Сумма позиции. Та же формула, что на сервере: цена варианта × количество. */
  function lineTotal(p, vi, qty) {
    var unit = p.t === 'w' ? (p.v[vi] ? p.v[vi][1] : 0) : p.p;
    return unit * qty;
  }

  /** Сумма позиции по старой цене (для зачёркивания); 0 — скидки нет. */
  function oldTotal(p, vi, qty) {
    var base = p.t === 'w' ? p.k : p.p;
    if (!(p.o > base)) return 0;
    var unit = p.t === 'w' ? (p.v[vi] ? Math.round(p.o * p.v[vi][0] / 1000) : 0) : Math.round(p.o);
    return unit * qty;
  }

  function renderSheet() {
    var s = state.sheet;
    var p = state.catalog && state.catalog.byId[s.id];
    if (!p) { closeSheet(); return; }
    if (p.t === 'w' && s.vi >= p.v.length) s.vi = 0;

    var body = '<div class="sheet__img">' + photoHtml(p) + '</div>' +
      '<div class="sheet__head"><div class="sheet__badges">' + badgeHtml(p) + promoHtml(p) + '</div>' +
      '<h2 class="sheet__title" id="sheetTitle">' + esc(name(p)) + '</h2>';
    if (p.t === 'w' && p.k > 0) {
      body += '<p class="sheet__perkg">' + money(p.k) + (p.o > p.k ? ' <s class="price-old">' + money(p.o) + '</s>' : '') + ' ' + esc(t('per')) + ' ' + weight(1000) + '</p>';
    }
    body += '</div>';

    var d = desc(p);
    if (d) body += '<p class="sheet__desc">' + esc(d) + '</p>';

    if (p.a) {
      if (p.t === 'w') {
        body += '<div><p class="label">' + esc(t('packing')) + '</p><div class="weights" role="group" aria-label="' + esc(t('packing')) + '">';
        p.v.forEach(function (v, i) {
          body += '<button type="button" data-vi="' + i + '" aria-pressed="' + (i === s.vi) + '">' + weight(v[0]) + '</button>';
        });
        body += '</div></div>';
      } else if (p.pk) {
        body += '<div><p class="label">' + esc(t('packing')) + '</p><div class="weights"><button type="button" aria-pressed="true" tabindex="-1">' +
          esc(p.pk.replace(/ /g, NBSP)) + '</button></div></div>';
      }
      body += '<div class="buy"><div class="step" role="group" aria-label="' + esc(t('qty')) + '">' +
        '<button type="button" data-step="-1" aria-label="' + esc(t('less')) + '"' + (s.qty <= 1 ? ' disabled' : '') + '>' + icon('minus') + '</button>' +
        '<output>' + s.qty + NBSP + esc(t('pcs')) + '</output>' +
        '<button type="button" data-step="1" aria-label="' + esc(t('more')) + '"' + (s.qty >= 99 ? ' disabled' : '') + '>' + icon('plus') + '</button>' +
        '</div><span class="total">' + (oldTotal(p, s.vi, s.qty) ? '<s class="price-old">' + money(oldTotal(p, s.vi, s.qty)) + '</s> ' : '') +
        money(lineTotal(p, s.vi, s.qty)) + '</span></div>';
    } else {
      body += '<p class="note note--out">' + esc(t('outNote')) + '</p>';
    }

    if (p.w > 0) {
      body += '<p class="note note--opt">' + esc(t('wholesale')) + ': ' + money(p.w) + ' ' +
        (p.t === 'w' ? esc(t('per')) + ' ' + weight(1000) : esc(t('perPack'))) +
        (p.wm ? ' · ' + esc(p.wm) : '') + '</p>';
    }

    var scroll = el.sheet.querySelector('.sheet__body');
    var top = scroll ? scroll.scrollTop : 0;
    var foot = p.a && lineTotal(p, s.vi, s.qty) > 0
      ? '<div class="sheet__foot"><button type="button" class="btn btn--primary btn--block" data-action="add">' +
        icon('shopping-cart') + esc(t('addToCart')) + '</button></div>'
      : '';
    el.sheet.innerHTML = '<button type="button" class="sheet__close" aria-label="' + esc(t('close')) + '">' + icon('x') + '</button>' +
      '<div class="sheet__body">' + body + '</div>' + foot;
    el.sheet.querySelector('.sheet__body').scrollTop = top;
  }

  /* ------------------------------ Корзина ------------------------------ */
  function product(id) { return state.catalog ? state.catalog.byId[id] : null; }

  /** Цена за единицу позиции по текущему каталогу; 0 — купить нельзя. */
  function unitPrice(p, g) {
    if (!p || !p.a) return 0;
    if (p.t === 'w') {
      for (var i = 0; i < p.v.length; i++) if (p.v[i][0] === g) return p.v[i][1];
      return 0;
    }
    return p.p > 0 ? p.p : 0;
  }

  /** Состояние строки корзины. Пока каталог не загружен, верим сохранённой цене. */
  function lineInfo(l) {
    if (!state.catalog) return { p: null, ok: true, price: l.pr, sum: l.pr * l.q };
    var p = product(l.id);
    var price = unitPrice(p, l.g);
    return { p: p, ok: price > 0, price: price, sum: price * l.q };
  }

  function cartTotal() {
    return state.cart.i.reduce(function (s, l) { return s + lineInfo(l).sum; }, 0);
  }
  function cartCount() {
    return state.cart.i.reduce(function (s, l) { return s + l.q; }, 0);
  }
  function cartQty(id) {
    return state.cart.i.reduce(function (s, l) { return s + (l.id === id ? l.q : 0); }, 0);
  }

  function parseCart(text) {
    try {
      var c = JSON.parse(text);
      if (!c || !Array.isArray(c.i)) return null;
      var items = [];
      c.i.forEach(function (l) {
        if (!l || typeof l.id !== 'string') return;
        var q = Math.floor(Number(l.q)), g = Number(l.g) || 0, pr = Number(l.pr) || 0;
        if (!(q >= 1)) return;
        var item = { id: l.id, g: g, q: Math.min(MAX_QTY, q), pr: pr };
        if (Number(l.was) > 0) item.was = Number(l.was);
        items.push(item);
      });
      return { t: Number(c.t) || 0, i: items };
    } catch (e) { return null; }
  }

  function cloudOk() {
    try { return inTelegram && tg.CloudStorage && tg.isVersionAtLeast('6.9'); } catch (e) { return false; }
  }

  function saveCart() {
    state.cart.t = Date.now();
    var text = JSON.stringify(state.cart);
    store.set(CART_KEY, text);
    if (cloudOk() && text.length <= 4096) {
      try { tg.CloudStorage.setItem('cart', text, function () {}); } catch (e) { /* облако недоступно */ }
    }
  }

  function loadCart() {
    var local = parseCart(store.get(CART_KEY));
    if (local) state.cart = local;
    if (!cloudOk()) return;
    try {
      tg.CloudStorage.getItem('cart', function (err, value) {
        var cloud = err ? null : parseCart(value);
        // Берём копию из Telegram, только если она новее той, что на телефоне.
        if (cloud && cloud.t > state.cart.t) {
          state.cart = cloud;
          store.set(CART_KEY, JSON.stringify(cloud));
          reconcileCart();
          renderAll();
        }
      });
    } catch (e) { /* облако недоступно */ }
  }

  /** Сверка с каталогом: если цена изменилась, запоминаем старую, чтобы показать в корзине. */
  function reconcileCart() {
    if (!state.catalog) return;
    var changed = false;
    state.cart.i.forEach(function (l) {
      var price = unitPrice(product(l.id), l.g);
      if (price > 0 && price !== l.pr) {
        if (!l.was) l.was = l.pr;
        l.pr = price;
        if (l.was === l.pr) delete l.was;
        changed = true;
      }
    });
    if (changed) saveCart();
  }

  /** Пользователь увидел изменения цен — больше о них не напоминаем. */
  function ackPriceChanges() {
    var changed = false;
    state.cart.i.forEach(function (l) { if (l.was) { delete l.was; changed = true; } });
    if (changed) saveCart();
  }

  function addFromSheet() {
    var s = state.sheet;
    var p = s && product(s.id);
    if (!p) return;
    var g = p.t === 'w' ? (p.v[s.vi] ? p.v[s.vi][0] : 0) : 0;
    var price = unitPrice(p, g);
    if (!(price > 0)) return;
    var line = null;
    state.cart.i.forEach(function (l) { if (l.id === p.id && l.g === g) line = l; });
    if (line) {
      line.q = Math.min(MAX_QTY, line.q + s.qty);
      line.pr = price;
    } else {
      state.cart.i.push({ id: p.id, g: g, q: s.qty, pr: price });
    }
    saveCart();
    haptic('success');
    closeSheet();
    renderMain();
    toast(t('added'));
  }

  function haptic(kind) {
    if (!inTelegram) return;
    try { tg.HapticFeedback.notificationOccurred(kind); } catch (e) { /* нет вибрации */ }
  }

  var toastTimer;
  function toast(text) {
    clearTimeout(toastTimer);
    el.toast.textContent = text;
    el.toast.hidden = false;
    toastTimer = setTimeout(function () { el.toast.hidden = true; }, 1800);
  }

  /* --------------------- Экраны и нижняя кнопка --------------------- */
  function go(view) {
    if (state.view === 'catalog') state.scrollY = window.scrollY || 0;
    if (state.view === 'cart' && view !== 'cart') { ackPriceChanges(); state.cartNotice = ''; }
    if (view === 'checkout' && !(cartTotal() > 0)) view = 'cart';
    if (state.sheet) closeSheet();
    state.view = view;
    document.body.setAttribute('data-view', view);
    if (view === 'catalog') renderMain();
    renderPage();
    updateChrome();
    if (view === 'admin') loadAdmin(false);
    window.scrollTo(0, view === 'catalog' ? state.scrollY : 0);
  }

  function goBack() {
    if (state.sheet) { closeSheet(); return; }
    if (state.view === 'checkout') { readForm(); go('cart'); return; }
    if (state.view === 'admin' && (adm.edit || adm.catEdit)) { adm.edit = ''; adm.catEdit = ''; renderPage(); return; }
    if (state.view !== 'catalog') go('catalog');
  }

  /** Что сейчас делает главная кнопка: null — кнопки нет. */
  function mainSpec() {
    var total = cartTotal();
    if (state.sheet || state.view === 'done' || state.view === 'admin' || !(total > 0)) return null;
    if (state.view === 'checkout') return { text: t('confirmBtn') + ' · ' + money(total), run: submitOrder };
    if (state.view === 'cart') return { text: t('checkoutBtn') + ' · ' + money(total), run: function () {
      var min = Number(shopInfo().min) || 0;
      if (min > 0 && cartTotal() < min) { state.cartNotice = t('minOrder') + ' ' + money(min); renderPage(); window.scrollTo(0, 0); haptic('error'); return; }
      go('checkout');
    } };
    return { text: t('checkoutBtn') + ' · ' + money(total), run: function () { go('cart'); } };
  }

  function mainAction() {
    var spec = mainSpec();
    if (spec) spec.run();
  }

  function updateChrome() {
    var n = cartCount();
    el.cartCount.textContent = n > 99 ? '99+' : String(n);
    el.cartCount.hidden = n === 0;
    el.cartBtn.setAttribute('aria-label', t('cart') + (n ? ': ' + n : ''));

    var spec = mainSpec();
    if (useNativeMain) {
      try {
        if (spec) {
          tg.MainButton.setParams({ text: spec.text, color: '#E8913A', text_color: '#2B2E32', is_active: true, is_visible: true });
        } else {
          tg.MainButton.hide();
        }
      } catch (e) { useNativeMain = false; }
    }
    var showBar = !useNativeMain && !!spec;
    el.bar.hidden = !showBar;
    if (spec) el.barBtn.textContent = spec.text;
    document.body.classList.toggle('has-bar', showBar);

    if (inTelegram) {
      try {
        if (state.sheet || state.view !== 'catalog') tg.BackButton.show(); else tg.BackButton.hide();
      } catch (e) { /* нет BackButton */ }
    }
  }

  function pageHead(title) {
    return '<header class="page__head"><button type="button" class="iconbtn" data-nav="back" aria-label="' + esc(t('back')) + '">' +
      icon('arrow-left') + '</button><h2 class="page__title">' + esc(title) + '</h2></header>';
  }

  function renderPage() {
    if (state.view === 'cart') el.page.innerHTML = cartHtml();
    else if (state.view === 'checkout') { el.page.innerHTML = checkoutHtml(); syncCheckout(); }
    else if (state.view === 'done') el.page.innerHTML = doneHtml();
    else if (state.view === 'admin') el.page.innerHTML = adminHtml();
    else el.page.innerHTML = '';
  }

  /* ------------------------------ Экран корзины ------------------------------ */
  function lineLabel(l, info) {
    var p = info.p || product(l.id);
    if (l.g) return weight(l.g);
    if (p && p.t === 'p' && p.pk) return p.pk.replace(/ /g, NBSP);
    return '1' + NBSP + t('pcs');
  }

  function cartHtml() {
    var html = pageHead(t('cart'));
    if (state.cartNotice) html += '<p class="form__err" role="alert">' + esc(state.cartNotice) + '</p>';
    if (!state.cart.i.length) {
      return html + '<div class="state">' + MARK +
        '<p class="state__title">' + esc(t('cartEmptyTitle')) + '</p>' +
        '<p class="state__text">' + esc(t('cartEmptyText')) + '</p>' +
        '<button type="button" class="btn btn--primary" data-nav="catalog">' + esc(t('toCatalog')) + '</button></div>';
    }
    var hasOut = false;
    html += '<ul class="lines">';
    state.cart.i.forEach(function (l, i) {
      var info = lineInfo(l);
      var p = info.p;
      if (!info.ok) hasOut = true;
      var note = '';
      if (!info.ok) note = '<p class="line__note line__note--out">' + esc(p ? t('lineOut') : t('lineGone')) + '</p>';
      else if (l.was) note = '<p class="line__note">' + esc(t('priceWas')) + ' ' + money(l.was) + '</p>';
      html += '<li class="line' + (info.ok ? '' : ' line--out') + '">' +
        '<div class="line__img">' + (p ? photoHtml(p) : MARK) + '</div>' +
        '<div class="line__text"><p class="line__name">' + esc(p ? name(p) : l.id) + '</p>' +
        '<p class="line__sub">' + lineLabel(l, info) + (info.ok ? ' · ' + money(info.price) : '') + '</p>' + note + '</div>' +
        '<button type="button" class="iconbtn iconbtn--plain" data-line-del="' + i + '" aria-label="' + esc(t('remove')) + '">' + icon('trash-2') + '</button>';
      if (info.ok) {
        html += '<div class="line__ctl"><div class="step step--sm" role="group" aria-label="' + esc(t('qty')) + '">' +
          '<button type="button" data-line-step="-1" data-i="' + i + '" aria-label="' + esc(t('less')) + '"' + (l.q <= 1 ? ' disabled' : '') + '>' + icon('minus') + '</button>' +
          '<output>' + l.q + '</output>' +
          '<button type="button" data-line-step="1" data-i="' + i + '" aria-label="' + esc(t('more')) + '"' + (l.q >= MAX_QTY ? ' disabled' : '') + '>' + icon('plus') + '</button>' +
          '</div><span class="line__sum">' + money(info.sum) + '</span></div>';
      }
      html += '</li>';
    });
    html += '</ul>';
    if (hasOut) html += '<button type="button" class="btn btn--block" data-action="clear-out">' + esc(t('removeOut')) + '</button>';
    html += '<div class="sum"><span>' + esc(t('total')) + '</span><span class="total">' + money(cartTotal()) + '</span></div>';
    return html;
  }

  /* ------------------------------ Оформление ------------------------------ */
  function loadForm() {
    try {
      var f = JSON.parse(store.get(FORM_KEY) || 'null');
      if (f) {
        ['name', 'phone', 'city', 'branch'].forEach(function (k) { if (typeof f[k] === 'string') state.form[k] = f[k]; });
        if (f.delivery === 'np' || f.delivery === 'pickup') state.form.delivery = f.delivery;
        if (f.pay === 'cash' || f.pay === 'card' || f.pay === 'cod') state.form.pay = f.pay;
      }
    } catch (e) { /* испорченная копия — игнорируем */ }
    if (!state.form.name && tgUser) {
      state.form.name = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ').slice(0, 60);
    }
  }

  function saveForm() {
    var f = state.form;
    store.set(FORM_KEY, JSON.stringify({ name: f.name, phone: f.phone, delivery: f.delivery, city: f.city, branch: f.branch, pay: f.pay }));
  }

  /** Маска +380 XX XXX XX XX. Понимает ввод с 0, 80 и 380 в начале. */
  function formatPhone(raw) {
    var text = String(raw || '').replace(/\s+/g, '');
    if (text.length < 4 && '+380'.indexOf(text) === 0) return '+380';
    var d = text.replace(/\D/g, '');
    if (d.indexOf('380') === 0) d = d.slice(3);
    else if (d.indexOf('80') === 0 && d.length > 9) d = d.slice(2);
    d = d.replace(/^0+/, ''); // коды операторов с нуля не начинаются: «+380 050…» → «+380 50…»
    d = d.slice(0, 9);
    var out = '+380';
    if (d.length) out += ' ' + d.slice(0, 2);
    if (d.length > 2) out += ' ' + d.slice(2, 5);
    if (d.length > 5) out += ' ' + d.slice(5, 7);
    if (d.length > 7) out += ' ' + d.slice(7, 9);
    return out;
  }

  function phoneValid(value) {
    var v = String(value || '').replace(/[^\d+]/g, '');
    if (v.indexOf('+380') === 0) return v.length === 13;
    return /^\+\d{10,15}$/.test(v); // иностранный номер, которым поделились из Telegram
  }

  function field(id, label, attrs, value, extra) {
    return '<div class="field"><label class="label" for="f-' + id + '">' + label + '</label>' +
      '<input class="input" id="f-' + id + '" name="' + id + '" ' + attrs + ' value="' + esc(value) + '" aria-describedby="e-' + id + '">' +
      (extra || '') + '<p class="field__err" id="e-' + id + '" hidden></p></div>';
  }

  function option(group, value, ico, label) {
    return '<label class="opt" data-opt="' + group + '-' + value + '"><input type="radio" name="' + group + '" value="' + value + '"' +
      (state.form[group] === value ? ' checked' : '') + '><span class="opt__box">' + (ico ? icon(ico) : '') +
      '<span>' + esc(label) + '</span></span></label>';
  }

  function canSharePhone() {
    try { return inTelegram && typeof tg.requestContact === 'function' && tg.isVersionAtLeast('6.9'); } catch (e) { return false; }
  }

  function checkoutHtml() {
    var f = state.form;
    var shop = (state.catalog && state.catalog.shop) || {};
    var L = state.lang === 'ru' ? 'ru' : 'ua';
    var addr = shop.address ? (shop.address[L] || shop.address.ua || '') : '';
    var hours = shop.hours ? (shop.hours[L] || shop.hours.ua || '') : '';
    var share = canSharePhone()
      ? '<button type="button" class="btn btn--block field__btn" data-action="share-phone">' + esc(t('sharePhone')) + '</button>'
      : '';

    return pageHead(t('checkout')) + '<form class="form" id="form" novalidate>' +
      '<p class="form__err" id="formErr" role="alert" hidden></p>' +
      field('name', esc(t('fName')), 'type="text" autocomplete="name" maxlength="60" enterkeyhint="next"', f.name) +
      field('phone', esc(t('fPhone')), 'type="tel" inputmode="tel" autocomplete="tel" maxlength="20" enterkeyhint="next"', f.phone || '+380', share) +

      '<fieldset class="group"><legend class="label">' + esc(t('delivery')) + '</legend><div class="opts">' +
      option('delivery', 'pickup', 'store', t('pickup')) + option('delivery', 'np', 'truck', t('np')) + '</div>' +
      '<div class="info" id="pickupInfo"><p>' + esc(addr) + '</p><p class="info__muted">' + esc(hours) + '</p></div>' +
      '<div id="npFields" class="stack">' +
      field('city', esc(t('fCity')), 'type="text" autocomplete="address-level2" maxlength="60" enterkeyhint="next"', f.city) +
      field('branch', esc(t('fBranch')), 'type="text" inputmode="numeric" autocomplete="off" maxlength="30" enterkeyhint="next"', f.branch) +
      '</div></fieldset>' +

      '<fieldset class="group"><legend class="label">' + esc(t('payment')) + '</legend><div class="opts opts--col">' +
      payMethods().map(function (k) { return option('pay', k, '', t({ cash: 'payCash', card: 'payCard', cod: 'payCod' }[k])); }).join('') + '</div>' +
      '<p class="info info__muted" id="cardNote">' + esc(t('payCardNote')) + '</p></fieldset>' +

      '<div class="field"><label class="label" for="f-comment">' + esc(t('fComment')) + ' <span class="label__opt">(' + esc(t('optional')) + ')</span></label>' +
      '<textarea class="input input--area" id="f-comment" name="comment" rows="3" maxlength="300" placeholder="' + esc(t('commentPh')) + '">' + esc(f.comment) + '</textarea></div>' +

      '<div class="sum"><span>' + esc(t('total')) + '</span><span class="total" id="coSum">' + money(cartTotal()) + '</span></div>' +
      '</form>';
  }

  /** Показывает блоки, которые зависят от выбранной доставки и оплаты. */
  function syncCheckout() {
    var pickup = document.getElementById('pickupInfo');
    if (!pickup) return;
    var np = state.form.delivery === 'np';
    pickup.hidden = np;
    document.getElementById('npFields').hidden = !np;
    // Наложенный платёж бывает только у Новой почты.
    var cod = el.page.querySelector('[data-opt="pay-cod"]');
    if (cod) cod.hidden = !np;
    var allowed = payMethods().filter(function (k) { return np || k !== 'cod'; });
    if (allowed.length && allowed.indexOf(state.form.pay) < 0) {
      state.form.pay = allowed[0];
      var first = el.page.querySelector('input[name="pay"][value="' + allowed[0] + '"]');
      if (first) first.checked = true;
      saveForm();
    }
    document.getElementById('cardNote').hidden = state.form.pay !== 'card';
  }

  function updateCheckoutSum() {
    var sum = document.getElementById('coSum');
    if (sum) sum.textContent = money(cartTotal());
    if (!(cartTotal() > 0)) go('cart');
  }

  function readForm() {
    var form = document.getElementById('form');
    if (!form) return;
    var f = state.form;
    f.name = form.elements.name.value.trim();
    f.phone = form.elements.phone.value.trim();
    f.city = form.elements.city.value.trim();
    f.branch = form.elements.branch.value.trim();
    f.comment = form.elements.comment.value.trim();
    f.delivery = form.elements.delivery.value === 'np' ? 'np' : 'pickup';
    f.pay = { card: 'card', cod: 'cod' }[form.elements.pay.value] || 'cash';
    if (f.phone === '+380') f.phone = '';
    saveForm();
  }

  function setError(id, text) {
    var input = document.getElementById('f-' + id);
    var err = document.getElementById('e-' + id);
    if (!input || !err) return;
    err.textContent = text || '';
    err.hidden = !text;
    if (text) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
  }

  function validateForm() {
    var f = state.form;
    var errors = {};
    if (f.name.length < 2) errors.name = t('errName');
    if (!phoneValid(f.phone)) errors.phone = t('errPhone');
    if (f.delivery === 'np') {
      if (f.city.length < 2) errors.city = t('errCity');
      if (!f.branch) errors.branch = t('errBranch');
    }
    ['name', 'phone', 'city', 'branch'].forEach(function (id) { setError(id, errors[id]); });
    var ids = Object.keys(errors);
    var box = document.getElementById('formErr');
    box.textContent = ids.length ? t('errFix') : '';
    box.hidden = !ids.length;
    if (ids.length) {
      var first = document.getElementById('f-' + ['name', 'phone', 'city', 'branch'].filter(function (id) { return errors[id]; })[0]);
      if (first) { first.focus(); first.scrollIntoView({ block: 'center' }); }
    }
    return !ids.length;
  }

  /** Данные заказа в том виде, в каком их получит сервер на этапе 3. Цены сервер считает сам. */
  function buildOrder() {
    var f = state.form;
    return {
      items: state.cart.i.filter(function (l) { return lineInfo(l).ok; })
        .map(function (l) { return { id: l.id, g: l.g, q: l.q }; }),
      name: f.name, phone: f.phone.replace(/\s+/g, ''),
      delivery: f.delivery, city: f.delivery === 'np' ? f.city : '', branch: f.delivery === 'np' ? f.branch : '',
      pay: f.pay, comment: f.comment, lang: state.lang, total: cartTotal(),
      initData: inTelegram ? tg.initData : '', test: DEBUG
    };
  }

  function newRid() {
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
  }

  /** Отправка на сервер. text/plain — чтобы браузер не делал предварительный CORS-запрос. */
  function sendOrder(order) {
    if (!cfg.API_URL) return Promise.resolve({ ok: true, number: '', stub: true }); // демо без бэкенда
    if (!state.rid) state.rid = newRid();
    order.action = 'order';
    order.rid = state.rid;
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 45000);
    return fetch(cfg.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(order),
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (r) {
      clearTimeout(timer);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }, function (err) { clearTimeout(timer); throw err; });
  }

  /** Просим разрешение писать клиенту в Telegram: иначе бот не сможет сообщить статус. */
  function askWriteAccess() {
    return new Promise(function (resolve) {
      try {
        if (inTelegram && typeof tg.requestWriteAccess === 'function' && tg.isVersionAtLeast('6.9')) {
          tg.requestWriteAccess(function () { resolve(); });
          return;
        }
      } catch (e) { /* старый клиент Telegram */ }
      resolve();
    });
  }

  function showFormError(text, linkBot) {
    var box = document.getElementById('formErr');
    if (!box) return;
    box.innerHTML = esc(text) + (linkBot && cfg.BOT
      ? ' <a href="https://t.me/' + esc(cfg.BOT) + '">@' + esc(cfg.BOT) + '</a>' : '');
    box.hidden = false;
    box.scrollIntoView({ block: 'center' });
  }

  var sending = false;
  function setBusy(busy) {
    sending = busy;
    el.barBtn.disabled = busy;
    if (busy) el.barBtn.textContent = t('sending');
    if (useNativeMain) {
      try { if (busy) tg.MainButton.showProgress(false); else tg.MainButton.hideProgress(); } catch (e) { /* нет индикатора */ }
    }
    if (!busy) updateChrome();
  }

  function submitOrder() {
    if (sending) return;
    readForm();
    if (!validateForm()) { haptic('error'); return; }
    if (cfg.API_URL && !inTelegram && !DEBUG) { showFormError(t('errNeedTg'), true); return; }
    var lines = state.cart.i.filter(function (l) { return lineInfo(l).ok; }).map(function (l) {
      var info = lineInfo(l);
      return { name: info.p ? name(info.p) : l.id, label: lineLabel(l, info), q: l.q, sum: info.sum };
    });
    var total = cartTotal();
    setBusy(true);
    askWriteAccess().then(function () { return sendOrder(buildOrder()); }).then(function (res) {
      if (!res || !res.ok) { orderFailed(res && res.error); return; }
      state.done = { number: res.number || '', stub: !!res.stub, test: DEBUG && !res.stub, lines: lines, total: total, delivery: state.form.delivery, pay: state.form.pay };
      state.cart.i = [];
      state.form.comment = '';
      state.rid = '';
      saveCart();
      setBusy(false);
      haptic('success');
      go('done');
    }).catch(function () { orderFailed('network'); });
  }

  function orderFailed(code) {
    haptic('error');
    if (code === 'changed') {
      // Сервер пересчитал заказ по таблице и получил другую сумму: показываем свежую корзину.
      state.rid = '';
      loadCatalog().then(function () {
        setBusy(false);
        state.cartNotice = t('cartChanged');
        go('cart');
      });
      return;
    }
    setBusy(false);
    if (code === 'min_order') { showFormError(t('minOrder') + ' ' + money(Number(shopInfo().min) || 0)); return; }
    showFormError(t({ rate_limit: 'errRate', bad_auth: 'errAuth', test_off: 'errTestOff' }[code] || 'errSend'));
  }

  function doneHtml() {
    var d = state.done;
    if (!d) return '';
    var html = '<div class="done"><span class="done__ico">' + icon('check') + '</span>' +
      '<h2 class="page__title">' + esc(t('doneTitle')) + (d.number ? ' ' + esc(d.number) : '') + '</h2>' +
      '<p class="done__text">' + esc(t('doneText')) + '</p></div>';
    if (d.stub) html += '<p class="note note--out">' + esc(t('doneStub')) + '</p>';
    else if (d.test) html += '<p class="note note--opt">' + esc(t('doneTest')) + '</p>';
    html += '<div class="recap"><p class="label">' + esc(t('order')) + '</p><ul class="recap__list">';
    d.lines.forEach(function (l) {
      html += '<li><span>' + esc(l.name) + ', ' + l.label + ' × ' + l.q + '</span><span class="recap__sum">' + money(l.sum) + '</span></li>';
    });
    html += '</ul><p class="recap__meta">' + esc(t('delivery')) + ': ' + esc(t(d.delivery === 'np' ? 'np' : 'pickup')) + '<br>' +
      esc(t('payment')) + ': ' + esc(t({ cash: 'payCash', card: 'payCard', cod: 'payCod' }[d.pay])) + '</p>' +
      '<div class="sum"><span>' + esc(t('total')) + '</span><span class="total">' + money(d.total) + '</span></div></div>' +
      '<button type="button" class="btn btn--primary btn--block" data-nav="catalog">' + esc(t('doneBack')) + '</button>';
    return html;
  }

  /* ------------------------------ Админ-панель (этап 5) ------------------------------ */
  /* Вход: команда /admin у бота (ссылка с ?admin=1). Права проверяет сервер при каждом запросе. */
  var ADMIN_KEY = 'pamir_admin';
  var adminHint = inTelegram && (params.get('admin') === '1' || store.get(ADMIN_KEY) === '1');
  var ADMIN_STATUSES = ['новий', 'підтверджено', 'відправлено', 'виконано', 'немає в наявності'];
  var STATUS_BADGE = { 'новий': 'badge--opt', 'підтверджено': 'badge--stock', 'відправлено': 'badge--ship', 'немає в наявності': 'badge--out', 'скасовано': 'badge--out' };
  var STATUS_BTNS = [['c', 'stC', 'підтверджено'], ['n', 'stN', 'немає в наявності'], ['s', 'stS', 'відправлено'], ['d', 'stD', 'виконано']];
  var ADMIN_TABS = [['orders', 'admOrders'], ['products', 'admProducts'], ['cats', 'admCats'], ['settings', 'admSettings']];
  var CAT_ICONS = ['nut', 'cherry', 'candy', 'flame', 'leaf', 'coffee'];
  var adm = { tab: 'orders', orders: null, stats: null, filter: '', q: '', open: '', products: null, cats: null, pq: '',
    edit: '', catEdit: '', settings: null, loading: false, error: '', busy: false };

  function api(action, data) {
    var body = { action: action, initData: inTelegram ? tg.initData : '' };
    Object.keys(data || {}).forEach(function (k) { body[k] = data[k]; });
    return fetch(cfg.API_URL, {
      method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body)
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  function loadAdmin(force) {
    var kind = adm.tab === 'orders' ? 'orders' : adm.tab === 'settings' ? 'settings' : 'products';
    var have = kind === 'orders' ? adm.orders : kind === 'settings' ? adm.settings : adm.products;
    if (adm.loading || (!force && have)) return;
    adm.loading = true; adm.error = '';
    renderAdminList();
    api('admin.' + kind).then(function (res) {
      adm.loading = false;
      if (!res || !res.ok) {
        adm.error = res && res.error === 'forbidden' ? 'admForbidden' : 'admError';
        if (res && res.error === 'forbidden') { store.set(ADMIN_KEY, '0'); adminHint = false; el.adminBtn.hidden = true; }
      } else {
        store.set(ADMIN_KEY, '1');
        if (kind === 'orders') { adm.orders = res.orders || []; adm.stats = res.stats || null; }
        else if (kind === 'settings') adm.settings = res.fields || [];
        else { adm.products = res.products || []; adm.cats = res.categories || []; }
      }
      if (state.view === 'admin') renderPage();
    }).catch(function () {
      adm.loading = false; adm.error = 'admError';
      if (state.view === 'admin') renderAdminList();
    });
  }

  function adminHtml() {
    var html = pageHead(t('admin'));
    if (adm.edit) return html + productFormHtml();
    if (adm.catEdit) return html + categoryFormHtml();
    html += '<div class="tabs" role="group">' + ADMIN_TABS.map(function (tab) {
      return '<button type="button" data-tab="' + tab[0] + '" aria-pressed="' + (adm.tab === tab[0]) + '">' + esc(t(tab[1])) + '</button>';
    }).join('') + '</div>';
    if (adm.tab === 'orders') {
      if (adm.stats) {
        html += '<div class="stats"><div><span>' + esc(t('admToday')) + '</span><b>' + adm.stats.today.n + ' · ' + money(adm.stats.today.sum) + '</b></div>' +
          '<div><span>' + esc(t('admWeek')) + '</span><b>' + adm.stats.week.n + ' · ' + money(adm.stats.week.sum) + '</b></div></div>';
      }
      html += '<input class="input" id="admQ" type="search" autocomplete="off" placeholder="' + esc(t('admSearchO')) + '" value="' + esc(adm.q) + '">' +
        '<div class="chips chips--flush" id="admFilter">' + [''].concat(ADMIN_STATUSES).map(function (s) {
          return '<button type="button" class="chip" data-filter="' + esc(s) + '" aria-pressed="' + (adm.filter === s) + '">' + esc(s || t('admAll')) + '</button>';
        }).join('') + '</div>';
    } else if (adm.tab === 'products') {
      html += '<button type="button" class="btn btn--primary btn--block" data-edit="+">' + icon('plus') + esc(t('admAdd')) + '</button>' +
        '<input class="input" id="admPQ" type="search" autocomplete="off" placeholder="' + esc(t('admSearchP')) + '" value="' + esc(adm.pq) + '">';
    } else if (adm.tab === 'cats') {
      html += '<button type="button" class="btn btn--primary btn--block" data-cat="+">' + icon('plus') + esc(t('admAddCat')) + '</button>';
    }
    return html + '<div id="admList">' + adminListHtml() + '</div>' +
      (adm.tab === 'settings' ? '' : '<button type="button" class="btn btn--block" data-action="adm-refresh">' + esc(t('admRefresh')) + '</button>');
  }

  function renderAdminList() {
    var box = document.getElementById('admList');
    if (box) box.innerHTML = adminListHtml();
  }

  function adminListHtml() {
    if (adm.loading) return '<p class="state__text adm__msg">' + esc(t('admLoading')) + '</p>';
    if (adm.error) return '<p class="form__err">' + esc(t(adm.error)) + '</p>';
    if (adm.tab === 'orders') return ordersHtml();
    if (adm.tab === 'products') return productsHtml();
    if (adm.tab === 'cats') return catsHtml();
    return settingsHtml();
  }

  function ordersHtml() {
    var q = adm.q.trim().toLowerCase().replace(/\s+/g, '');
    var list = (adm.orders || []).filter(function (o) {
      if (adm.filter && o.status !== adm.filter) return false;
      return !q || (o.num + ' ' + o.phone + ' ' + o.name).toLowerCase().replace(/\s+/g, '').indexOf(q) >= 0;
    });
    if (!list.length) return '<p class="state__text adm__msg">' + esc(t('admEmpty')) + '</p>';
    return '<ul class="lines">' + list.map(function (o) {
      var open = adm.open === o.num;
      var html = '<li class="ord"><button type="button" class="ord__head" data-ord="' + esc(o.num) + '" aria-expanded="' + open + '">' +
        '<span class="ord__num">' + esc(o.num) + '</span><span class="badge ' + (STATUS_BADGE[o.status] || '') + '">' + esc(o.status) + '</span>' +
        (o.test ? '<span class="badge">' + esc(t('admTest')) + '</span>' : '') +
        '<span class="ord__sum">' + money(o.total) + '</span>' +
        '<span class="ord__meta">' + esc(o.date) + ' · ' + esc(o.name) + '</span></button>';
      if (open) {
        html += '<div class="ord__body"><ul class="ord__items">' + String(o.items).split('; ').map(function (s) {
          return s ? '<li>' + esc(s) + '</li>' : '';
        }).join('') + '</ul>' +
          '<p>' + esc(o.name) + (o.username ? ' · ' + esc(o.username) : '') + '<br><a href="tel:' + esc(o.phone) + '">' + esc(o.phone) + '</a></p>' +
          '<p>' + esc(o.delivery) + (o.city ? ': ' + esc(o.city) + ', ' + esc(o.branch) : '') + '<br>' + esc(o.pay) + '</p>' +
          (o.comment ? '<p class="info">' + esc(o.comment) + '</p>' : '') +
          '<div class="ord__acts">' + STATUS_BTNS.map(function (b) {
            return '<button type="button" class="btn' + (o.status === b[2] ? ' btn--soft' : '') + '" data-st="' + b[0] + '" data-num="' + esc(o.num) + '"' +
              (o.status === b[2] || adm.busy ? ' disabled' : '') + '>' + esc(t(b[1])) + '</button>';
          }).join('') + '</div>' +
          '<button type="button" class="btn btn--block" data-chat="' + esc(o.username ? 'https://t.me/' + o.username.replace(/^@/, '') : 'https://t.me/' + o.phone) + '">' +
          esc(t('admWrite')) + '</button></div>';
      }
      return html + '</li>';
    }).join('') + '</ul>';
  }

  function adminPrice(p) {
    return p.price > 0 ? String(p.price).replace('.', ',') + NBSP + '₴' + (p.t === 'w' ? '/' + weight(1000) : '') : '—';
  }

  function productsHtml() {
    var q = adm.pq.trim().toLowerCase();
    var list = (adm.products || []).filter(function (p) {
      return !q || (p.ua + ' ' + p.ru + ' ' + p.id).toLowerCase().indexOf(q) >= 0;
    });
    if (!list.length) return '<p class="state__text adm__msg">' + esc(t('admEmpty')) + '</p>';
    var html = '<ul class="lines">' + list.slice(0, 60).map(function (p) {
      return '<li class="prod"><button type="button" class="prod__main" data-edit="' + esc(p.id) + '">' +
        '<span class="prod__name">' + esc(p.ua) + '</span><span class="prod__sub">' + esc(p.id) + ' · ' + adminPrice(p) +
        (p.hidden ? ' · ' + esc(t('admHiddenTag')) : '') + (p.img ? '' : ' · ' + esc(t('admNoPhoto'))) + '</span></button>' +
        '<button type="button" class="sw" role="switch" aria-checked="' + (p.stock ? 'true' : 'false') + '" data-stock="' + esc(p.id) + '" aria-label="' + esc(t('admStock')) + '"><span></span></button></li>';
    }).join('') + '</ul>';
    if (list.length > 60) html += '<p class="state__text adm__msg">' + esc(t('admMore')) + '</p>';
    return html;
  }

  function adminProduct(id) {
    var found = null;
    (adm.products || []).forEach(function (p) { if (p.id === id) found = p; });
    return found;
  }

  /* ---- Поля форм ---- */
  function fRow(id, label, value, attrs, hint) {
    return '<div class="field"><label class="label" for="a-' + id + '">' + esc(label) + '</label>' +
      '<input class="input" id="a-' + id + '" ' + attrs + ' value="' + esc(value) + '">' + (hint ? '<p class="field__hint">' + esc(hint) + '</p>' : '') + '</div>';
  }
  function fArea(id, label, value, max) {
    return '<div class="field"><label class="label" for="a-' + id + '">' + esc(label) + '</label>' +
      '<textarea class="input input--area" id="a-' + id + '" rows="3" maxlength="' + (max || 600) + '">' + esc(value) + '</textarea></div>';
  }
  function fSelect(id, label, value, opts) {
    return '<div class="field"><label class="label" for="a-' + id + '">' + esc(label) + '</label><select class="input" id="a-' + id + '">' +
      opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (o[0] === value ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') +
      '</select></div>';
  }
  function fCheck(id, label, on) {
    return '<label class="check"><input type="checkbox" id="a-' + id + '"' + (on ? ' checked' : '') + '><span>' + esc(label) + '</span></label>';
  }
  function fVal(id) { var x = document.getElementById('a-' + id); return x ? x.value.trim() : ''; }
  function fNum(id) { return Number(fVal(id).replace(/\s/g, '').replace(',', '.') || 0); }
  function fOn(id) { var x = document.getElementById('a-' + id); return !!(x && x.checked); }
  function fErr(key) {
    var err = document.getElementById('admErr');
    if (err) { err.textContent = t(key); err.hidden = false; err.scrollIntoView({ block: 'center' }); }
  }
  var FORM_ERR = '<p class="form__err" id="admErr" role="alert" hidden></p>';
  function saveBtn() { return '<button type="button" class="btn btn--primary btn--block" data-action="adm-save">' + esc(t('admSave')) + '</button>'; }

  /* ---- Товар: правка и добавление ---- */
  function productFormHtml() {
    var isNew = adm.edit === '+';
    var p = isNew
      ? { id: '', cat: adm.cats && adm.cats[0] ? adm.cats[0].ua : '', t: 'w', ua: '', ru: '', packs: '100 г / 250 г / 500 г / 1 кг', price: '', stock: 1, hidden: 0, img: '', dUa: '', dRu: '', wh: '', wm: '', badge: '', old: '' }
      : adminProduct(adm.edit);
    if (!p) return '';
    var cats = (adm.cats || []).map(function (c) { return [c.ua, c.ua]; });
    if (p.cat && !cats.some(function (c) { return c[0] === p.cat; })) cats.unshift([p.cat, p.cat]);
    var photo = isNew
      ? '<p class="info info__muted">' + esc(t('admPhotoLater')) + '</p>'
      : '<div class="photo"><div class="photo__box">' + (p.img ? '<img src="' + esc(p.img) + '" alt="" referrerpolicy="no-referrer">' : MARK) + '</div>' +
        '<div class="photo__acts"><label class="btn btn--block">' + esc(t(p.img ? 'admPhotoChange' : 'admPhotoPick')) +
        '<input type="file" id="a-photo" accept="image/*" hidden></label>' +
        (p.img ? '<button type="button" class="btn btn--block" data-action="adm-photo-del">' + esc(t('admPhotoDel')) + '</button>' : '') +
        '<p class="field__hint" id="photoMsg"></p></div></div>';
    return '<form class="form" id="admForm" novalidate><p class="label">' + esc(isNew ? t('admNew') : p.id) + '</p>' + FORM_ERR + photo +
      fSelect('cat', t('admCat'), p.cat, cats) +
      fSelect('t', t('admType'), p.t, [['w', t('admTypeW')], ['p', t('admTypeP')], ['u', t('admTypeU')]]) +
      fRow('ua', t('admNameUa'), p.ua, 'type="text" maxlength="120"') +
      fRow('ru', t('admNameRu'), p.ru, 'type="text" maxlength="120"') +
      fRow('price', t('admPrice'), p.price || '', 'type="text" inputmode="decimal" maxlength="9"', t('admPriceHint')) +
      fRow('old', t('admOld'), p.old || '', 'type="text" inputmode="decimal" maxlength="9"', t('admOldHint')) +
      fSelect('badge', t('admBadge'), p.badge || '', [['', t('admBadgeNone')], ['new', t('badgeNew')], ['hit', t('badgeHit')], ['sale', t('badgeSale')]]) +
      fRow('packs', t('admPacks'), p.packs, 'type="text" maxlength="80"', t('admPacksHint')) +
      fArea('dUa', t('admDescUa'), p.dUa) + fArea('dRu', t('admDescRu'), p.dRu) +
      fRow('wh', t('admWh'), p.wh || '', 'type="text" inputmode="decimal" maxlength="9"') +
      fRow('wm', t('admWm'), p.wm, 'type="text" maxlength="40"') +
      fCheck('stock', t('admStock'), p.stock) + fCheck('hidden', t('admHidden'), p.hidden) + saveBtn() +
      (isNew ? '' : '<div class="field"><label class="label" for="a-link">' + esc(t('admLink')) + '</label>' +
        '<input class="input" id="a-link" type="text" readonly value="' + esc(productLink(p.id)) + '">' +
        '<button type="button" class="btn btn--block" data-action="adm-link">' + esc(t('admLinkCopy')) + '</button></div>') + '</form>';
  }

  /** Ссылка для постов. С привязанным Mini App (cfg.APP) открывает товар сразу, без него — через кнопку в чате бота. */
  function productLink(id) {
    var bot = 'https://t.me/' + (cfg.BOT || '');
    return cfg.APP ? bot + '/' + cfg.APP + '?startapp=' + encodeURIComponent(id) : bot + '?start=' + encodeURIComponent(id);
  }
  function copyText(text, input) {
    function fallback() {
      try { input.focus(); input.select(); input.setSelectionRange(0, text.length); return document.execCommand('copy'); } catch (e) { return false; }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return fallback(); });
    }
    return Promise.resolve(fallback());
  }

  function saveProductForm() {
    var isNew = adm.edit === '+';
    var p = isNew ? null : adminProduct(adm.edit);
    if ((!isNew && !p) || adm.busy) return;
    var next = { cat: fVal('cat'), t: fVal('t'), ua: fVal('ua'), ru: fVal('ru'), packs: fVal('packs'), wm: fVal('wm'), dUa: fVal('dUa'), dRu: fVal('dRu'),
      price: fNum('price'), wh: fNum('wh'), old: fNum('old'), badge: fVal('badge'), stock: fOn('stock') ? 1 : 0, hidden: fOn('hidden') ? 1 : 0 };
    if (!next.ua) { fErr('admErrName'); return; }
    if (!(next.price >= 0) || !(next.wh >= 0) || !(next.old >= 0)) { fErr('admErrPrice'); return; }
    if (isNew) {
      next.stock = !!next.stock; next.hidden = !!next.hidden;
      adm.busy = true;
      api('admin.productAdd', { patch: next }).then(function (res) {
        adm.busy = false;
        if (!res || !res.ok) throw new Error('fail');
        adm.products.push(res.product);
        adm.edit = res.product.id; // остаёмся в карточке: теперь можно добавить фото
        toast(t('admSaved') + ': ' + res.product.id);
        loadCatalog();
        renderPage(); window.scrollTo(0, 0);
      }).catch(function () { adm.busy = false; fErr('admFail'); });
      return;
    }
    var patch = {};
    Object.keys(next).forEach(function (k) { if (next[k] !== (p[k] || (typeof next[k] === 'number' ? 0 : ''))) patch[k] = next[k]; });
    if (patch.stock !== undefined) patch.stock = !!patch.stock;
    if (patch.hidden !== undefined) patch.hidden = !!patch.hidden;
    if (!Object.keys(patch).length) { adm.edit = ''; renderPage(); return; }
    patchProduct(p, patch, function (ok) {
      if (ok) { adm.edit = ''; renderPage(); window.scrollTo(0, 0); } else fErr('admFail');
    });
  }

  function patchProduct(p, patch, done) {
    adm.busy = true;
    api('admin.product', { id: p.id, patch: patch }).then(function (res) {
      adm.busy = false;
      if (!res || !res.ok) throw new Error('fail');
      Object.keys(res.product).forEach(function (k) { p[k] = res.product[k]; });
      toast(t('admSaved'));
      loadCatalog(); // витрина сразу подхватывает правку
      done(true);
    }).catch(function () { adm.busy = false; toast(t('admFail')); done(false); });
  }

  /** Фото с телефона: уменьшаем до 1000 px по длинной стороне и сжимаем в JPEG. */
  function compressPhoto(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var im = new Image();
      im.onload = function () {
        var k = Math.min(1, 1000 / Math.max(im.width, im.height));
        var c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(im.width * k)); c.height = Math.max(1, Math.round(im.height * k));
        var ctx = c.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(im, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg', 0.82).split(',')[1]);
      };
      im.onerror = function () { URL.revokeObjectURL(url); reject(new Error('image')); };
      im.src = url;
    });
  }

  function uploadPhoto(file) {
    var p = adminProduct(adm.edit);
    var msg = document.getElementById('photoMsg');
    if (!p || !file || adm.busy) return;
    adm.busy = true;
    if (msg) msg.textContent = t('admPhotoUp');
    compressPhoto(file).then(function (data) {
      return api('admin.photo', { id: p.id, data: data });
    }).then(function (res) {
      adm.busy = false;
      if (!res || !res.ok) throw new Error('fail');
      Object.keys(res.product).forEach(function (k) { p[k] = res.product[k]; });
      toast(t('admSaved'));
      loadCatalog();
      if (state.view === 'admin' && adm.edit === p.id) renderPage();
    }).catch(function () {
      adm.busy = false;
      if (msg) msg.textContent = t('admPhotoFail');
    });
  }

  /* ---- Категории ---- */
  function catsHtml() {
    var list = adm.cats || [];
    if (!list.length) return '<p class="state__text adm__msg">' + esc(t('admEmpty')) + '</p>';
    return '<ul class="lines">' + list.map(function (c) {
      return '<li class="prod"><button type="button" class="prod__main" data-cat="' + esc(c.code) + '">' +
        '<span class="prod__name prod__name--ico">' + icon(c.icon) + esc(c.ua) + '</span>' +
        '<span class="prod__sub">' + esc(c.code) + ' · ' + esc(c.ru) + ' · №' + NBSP + (c.order === 999 ? '—' : c.order) + '</span></button></li>';
    }).join('') + '</ul>';
  }

  function adminCat(code) {
    var found = null;
    (adm.cats || []).forEach(function (c) { if (c.code === code) found = c; });
    return found;
  }

  function categoryFormHtml() {
    var isNew = adm.catEdit === '+';
    var c = isNew ? { code: '', ua: '', ru: '', icon: '', order: (adm.cats || []).length + 1 } : adminCat(adm.catEdit);
    if (!c) return '';
    return '<form class="form" id="admForm" novalidate><p class="label">' + esc(isNew ? t('admNewCat') : c.code) + '</p>' + FORM_ERR +
      (isNew ? fRow('code', t('admCatCode'), '', 'type="text" maxlength="5" autocapitalize="characters" autocomplete="off"', t('admCatCodeHint')) : '') +
      fRow('cua', t('admCatUa'), c.ua, 'type="text" maxlength="40"') +
      fRow('cru', t('admCatRu'), c.ru, 'type="text" maxlength="40"') +
      fSelect('icon', t('admCatIcon'), c.icon, [['', '—']].concat(CAT_ICONS.map(function (i) { return [i, t('ico_' + i)]; }))) +
      fRow('order', t('admCatOrder'), c.order === 999 ? '' : c.order, 'type="text" inputmode="numeric" maxlength="3"') + saveBtn() + '</form>';
  }

  function saveCategoryForm() {
    if (adm.busy) return;
    var isNew = adm.catEdit === '+';
    var c = { isNew: isNew, code: isNew ? fVal('code').toUpperCase() : adm.catEdit, ua: fVal('cua'), ru: fVal('cru'), icon: fVal('icon'), order: fNum('order') || (adm.cats || []).length + 1 };
    if (isNew && !/^[A-Z]{2,5}$/.test(c.code)) { fErr('admErrCode'); return; }
    if (!c.ua) { fErr('admErrName'); return; }
    adm.busy = true;
    api('admin.category', { category: c }).then(function (res) {
      adm.busy = false;
      if (!res || !res.ok) { fErr(res && res.error === 'exists' ? 'admErrExists' : 'admFail'); return; }
      adm.cats = res.categories;
      adm.products = null; // названия категорий в товарах могли измениться
      adm.catEdit = '';
      toast(t('admSaved'));
      loadCatalog();
      renderPage(); window.scrollTo(0, 0);
    }).catch(function () { adm.busy = false; fErr('admFail'); });
  }

  /* ---- Настройки магазина ---- */
  function settingsHtml() {
    if (!adm.settings) return '';
    return '<form class="form" id="admForm" novalidate>' + FORM_ERR + adm.settings.map(function (f) {
      if (f.k.indexOf('pay_') === 0) return fCheck(f.k, f.label, /^так$/i.test(f.v));
      if (f.k === 'min_order') return fRow(f.k, f.label, f.v, 'type="text" inputmode="numeric" maxlength="6"');
      if (f.k === 'feature_id' || f.k.indexOf('feature_title') === 0) return fRow(f.k, f.label, f.v, 'type="text" maxlength="60" autocapitalize="' + (f.k === 'feature_id' ? 'characters' : 'sentences') + '"');
      return fArea(f.k, f.label, f.v, 500);
    }).join('') + saveBtn() + '</form>';
  }

  function saveSettingsForm() {
    if (adm.busy || !adm.settings) return;
    var values = {};
    adm.settings.forEach(function (f) { values[f.k] = f.k.indexOf('pay_') === 0 ? fOn(f.k) : fVal(f.k); });
    if (!values.pay_cash && !values.pay_card) { fErr('admErrPay'); return; }
    adm.busy = true;
    api('admin.settingsSave', { values: values }).then(function (res) {
      adm.busy = false;
      if (!res || !res.ok) { fErr(res && res.error === 'no_payment' ? 'admErrPay' : 'admFail'); return; }
      adm.settings = res.fields;
      toast(t('admSaved'));
      loadCatalog();
      renderAdminList();
    }).catch(function () { adm.busy = false; fErr('admFail'); });
  }

  function adminClick(e) {
    var tab = e.target.closest('[data-tab]');
    if (tab) { adm.tab = tab.getAttribute('data-tab'); adm.error = ''; renderPage(); loadAdmin(false); return true; }
    var f = e.target.closest('[data-filter]');
    if (f) {
      adm.filter = f.getAttribute('data-filter');
      Array.prototype.forEach.call(document.querySelectorAll('#admFilter .chip'), function (b) {
        b.setAttribute('aria-pressed', String(b.getAttribute('data-filter') === adm.filter));
      });
      renderAdminList(); return true;
    }
    var ord = e.target.closest('[data-ord]');
    if (ord) { var num = ord.getAttribute('data-ord'); adm.open = adm.open === num ? '' : num; renderAdminList(); return true; }
    var st = e.target.closest('[data-st]');
    if (st && !st.disabled) {
      var order = null;
      adm.orders.forEach(function (o) { if (o.num === st.getAttribute('data-num')) order = o; });
      if (!order) return true;
      adm.busy = true; renderAdminList();
      api('admin.status', { num: order.num, code: st.getAttribute('data-st') }).then(function (res) {
        adm.busy = false;
        if (!res || !res.ok) throw new Error('fail');
        order.status = res.status;
        toast(t('admSaved') + (res.told === false ? '. ' + t('admNotTold') : ''));
        renderAdminList();
      }).catch(function () { adm.busy = false; toast(t('admFail')); renderAdminList(); });
      return true;
    }
    var chat = e.target.closest('[data-chat]');
    if (chat) {
      var url = chat.getAttribute('data-chat');
      try { tg.openTelegramLink(url); } catch (err) { window.open(url, '_blank'); }
      return true;
    }
    var sw = e.target.closest('[data-stock]');
    if (sw && !adm.busy) {
      var p = adminProduct(sw.getAttribute('data-stock'));
      if (!p) return true;
      var want = !p.stock;
      sw.setAttribute('aria-checked', String(want));
      patchProduct(p, { stock: want }, function () { renderAdminList(); });
      return true;
    }
    var ed = e.target.closest('[data-edit]');
    if (ed) { adm.edit = ed.getAttribute('data-edit'); renderPage(); window.scrollTo(0, 0); return true; }
    var ct = e.target.closest('[data-cat]');
    if (ct) { adm.catEdit = ct.getAttribute('data-cat'); renderPage(); window.scrollTo(0, 0); return true; }
    var act = e.target.closest('[data-action]');
    var name = act ? act.getAttribute('data-action') : '';
    if (name === 'adm-refresh') { loadAdmin(true); return true; }
    if (name === 'adm-save') {
      if (adm.edit) saveProductForm(); else if (adm.catEdit) saveCategoryForm(); else saveSettingsForm();
      return true;
    }
    if (name === 'adm-link') {
      var linkInput = document.getElementById('a-link');
      if (linkInput) copyText(linkInput.value, linkInput).then(function (ok) { toast(t(ok ? 'admLinkCopied' : 'admLinkFail')); });
      return true;
    }
    if (name === 'adm-photo-del') {
      var pp = adminProduct(adm.edit);
      if (pp && !adm.busy) patchProduct(pp, { img: '' }, function () { renderPage(); });
      return true;
    }
    return false;
  }

  function bindPage() {
    el.page.addEventListener('click', function (e) {
      if (state.view === 'admin' && !e.target.closest('[data-nav]') && adminClick(e)) return;
      var nav = e.target.closest('[data-nav]');
      if (nav) {
        if (nav.getAttribute('data-nav') === 'back') goBack(); else go('catalog');
        return;
      }
      var del = e.target.closest('[data-line-del]');
      if (del) {
        state.cart.i.splice(Number(del.getAttribute('data-line-del')), 1);
        saveCart(); renderPage(); updateChrome();
        return;
      }
      var st = e.target.closest('[data-line-step]');
      if (st && !st.disabled) {
        var line = state.cart.i[Number(st.getAttribute('data-i'))];
        if (line) {
          line.q = Math.min(MAX_QTY, Math.max(1, line.q + Number(st.getAttribute('data-line-step'))));
          saveCart(); renderPage(); updateChrome();
        }
        return;
      }
      var act = e.target.closest('[data-action]');
      if (!act) return;
      if (act.getAttribute('data-action') === 'clear-out') {
        state.cart.i = state.cart.i.filter(function (l) { return lineInfo(l).ok; });
        saveCart(); renderPage(); updateChrome();
      }
      if (act.getAttribute('data-action') === 'share-phone') {
        try {
          tg.requestContact(function (ok, res) {
            var c = ok && res && res.responseUnsafe && res.responseUnsafe.contact;
            var input = document.getElementById('f-phone');
            if (!c || !c.phone_number || !input) return;
            var digits = String(c.phone_number).replace(/\D/g, '');
            input.value = digits.indexOf('380') === 0 ? formatPhone(digits) : '+' + digits;
            setError('phone', '');
            readForm();
          });
        } catch (err) { /* старый клиент Telegram — остаётся ручной ввод */ }
      }
    });

    el.page.addEventListener('input', function (e) {
      var input = e.target;
      if (input.id === 'admQ') { adm.q = input.value; renderAdminList(); return; }
      if (input.id === 'admPQ') { adm.pq = input.value; renderAdminList(); return; }
      if (!input.name || state.view !== 'checkout') return;
      if (input.name === 'phone') input.value = formatPhone(input.value);
      if (input.getAttribute('aria-invalid')) setError(input.name, '');
      if (!el.page.querySelector('[aria-invalid]')) document.getElementById('formErr').hidden = true;
      readForm();
      syncCheckout();
    });
    el.page.addEventListener('focusin', function (e) {
      if (e.target.name === 'phone' && !e.target.value) e.target.value = '+380';
    });
    el.page.addEventListener('change', function (e) {
      if (e.target.id === 'a-photo' && e.target.files && e.target.files[0]) uploadPhoto(e.target.files[0]);
    });
    el.page.addEventListener('submit', function (e) { e.preventDefault(); });
    el.page.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); e.target.blur(); }
    });
  }

  /* ------------------------------ События ------------------------------ */
  function bind() {
    document.querySelector('.lang').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-lang]');
      if (b) setLang(b.getAttribute('data-lang'));
    });

    var searchTimer;
    el.search.addEventListener('input', function () {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () {
        state.q = el.search.value;
        if (state.status === 'ready') renderMain();
      }, 120);
    });
    el.search.addEventListener('keydown', function (e) { if (e.key === 'Enter') el.search.blur(); });

    el.chips.addEventListener('click', function (e) {
      var b = e.target.closest('.chip');
      if (!b) return;
      state.cat = b.getAttribute('data-cat');
      renderChips();
      if (state.status === 'ready') renderMain();
      window.scrollTo(0, 0);
    });

    el.main.addEventListener('click', function (e) {
      var act = e.target.closest('[data-action]');
      if (act) {
        if (act.getAttribute('data-action') === 'retry') loadCatalog();
        if (act.getAttribute('data-action') === 'reset') {
          state.q = ''; state.cat = ''; el.search.value = '';
          renderChips(); renderMain();
        }
        return;
      }
      var card = e.target.closest('.card');
      if (card) openSheet(card.getAttribute('data-id'));
    });

    // Битая ссылка на фото → заглушка со знаком гор.
    document.addEventListener('error', function (e) {
      var img = e.target;
      if (img && img.tagName === 'IMG' && img.parentNode &&
          /(^| )(card|sheet|line)__img( |$)/.test(img.parentNode.className)) {
        var holder = document.createElement('span');
        holder.innerHTML = MARK;
        img.parentNode.replaceChild(holder.firstChild, img);
      }
    }, true);

    el.sheet.addEventListener('click', function (e) {
      if (e.target.closest('.sheet__close')) { closeSheet(); return; }
      if (e.target.closest('[data-action="add"]')) { addFromSheet(); return; }
      var v = e.target.closest('[data-vi]');
      if (v) { state.sheet.vi = Number(v.getAttribute('data-vi')); renderSheet(); return; }
      var st = e.target.closest('[data-step]');
      if (st && !st.disabled) {
        state.sheet.qty = Math.min(99, Math.max(1, state.sheet.qty + Number(st.getAttribute('data-step'))));
        renderSheet();
      }
    });
    el.backdrop.addEventListener('click', closeSheet);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSheet(); });

    el.cartBtn.addEventListener('click', function () { go('cart'); });
    el.adminBtn.addEventListener('click', function () { go('admin'); });
    el.barBtn.addEventListener('click', mainAction);
    bindPage();

    if (inTelegram) {
      try { tg.BackButton.onClick(goBack); } catch (e) { /* нет BackButton */ }
      if (useNativeMain) { try { tg.MainButton.onClick(mainAction); } catch (e) { useNativeMain = false; } }
      try { tg.onEvent('themeChanged', applyTheme); } catch (e) { /* нет события */ }
    } else if (window.matchMedia) {
      var mq = window.matchMedia('(prefers-color-scheme: dark)');
      if (mq.addEventListener) mq.addEventListener('change', applyTheme);
    }
  }

  /* ------------------------------ Старт ------------------------------ */
  document.getElementById('searchIcon').innerHTML = icon('search');
  if (tg) {
    try { tg.ready(); tg.expand(); } catch (e) { /* открыто не в Telegram */ }
  }
  applyTheme();
  initLang();
  loadForm();
  loadCart();
  bind();
  el.adminBtn.hidden = !adminHint;
  loadCatalog();
  if (adminHint && params.get('admin') === '1') go('admin');
})();
