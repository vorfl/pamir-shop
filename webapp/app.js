/* PAMIR — витрина (Telegram Mini App). Чистый JS, без сборки.
 * Этап 1: каталог. Этап 2: корзина и оформление. Этап 3: отправка заказа на сервер.
 * Этап 7: главная с подборками, нижняя навигация, избранное, фильтры, профиль, подарки, аналитика.
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
      myOrders: 'Мої замовлення', myEmpty: 'Замовлень поки немає', myEmptyText: 'Після першого замовлення воно з’явиться тут.',
      myErr: 'Не вдалося завантажити замовлення. Спробуйте ще раз.', myTg: 'Свої замовлення видно, коли магазин відкрито в Telegram.',
      myRefresh: 'Оновити', repeat: 'Повторити замовлення', repeatOld: 'Це замовлення зроблено до оновлення: зберіть кошик заново.',
      repeatNone: 'Цих товарів зараз немає в наявності.',
      repeatPart: 'Додано позицій: {a} з {b}. Решти зараз немає в наявності або змінилася фасовка.',
      repeatOk: 'Товари з замовлення додано в кошик. Перевірте суму і кількість.',
      ost_новий: 'Прийнято', 'ost_підтверджено': 'Підтверджено', 'ost_немає в наявності': 'Немає в наявності',
      'ost_відправлено': 'Відправлено', 'ost_виконано': 'Виконано', 'ost_скасовано': 'Скасовано',
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
      admStats: 'Статистика продажів', admStats30: '30 днів', admStatsAll: 'Весь час', admStatsTop: 'Товари за 30 днів',
      admStatsDays: 'По днях', admStatsEmpty: 'Продажів поки немає.', admStatsSheet: 'Повна таблиця — на аркуші «Статистика» у Google Таблиці.',
      admStatsOrd: 'зам.',
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
      myOrders: 'Мои заказы', myEmpty: 'Заказов пока нет', myEmptyText: 'После первого заказа он появится здесь.',
      myErr: 'Не удалось загрузить заказы. Попробуйте ещё раз.', myTg: 'Свои заказы видно, когда магазин открыт в Telegram.',
      myRefresh: 'Обновить', repeat: 'Повторить заказ', repeatOld: 'Этот заказ сделан до обновления: соберите корзину заново.',
      repeatNone: 'Этих товаров сейчас нет в наличии.',
      repeatPart: 'Добавлено позиций: {a} из {b}. Остальных сейчас нет в наличии или изменилась фасовка.',
      repeatOk: 'Товары из заказа добавлены в корзину. Проверьте сумму и количество.',
      ost_новий: 'Принят', 'ost_підтверджено': 'Подтверждён', 'ost_немає в наявності': 'Нет в наличии',
      'ost_відправлено': 'Отправлен', 'ost_виконано': 'Выполнен', 'ost_скасовано': 'Отменён',
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
      admStats: 'Статистика продаж', admStats30: '30 дней', admStatsAll: 'Всё время', admStatsTop: 'Товары за 30 дней',
      admStatsDays: 'По дням', admStatsEmpty: 'Продаж пока нет.', admStatsSheet: 'Полная таблица — на листе «Статистика» в Google Таблице.',
      admStatsOrd: 'зак.',
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
    cherry: '<path d="M12 7C7.5 5.5 4 8.5 4 13a8 8 0 0 0 16 0c0-4.5-3.5-7.5-8-6Z"/><path d="M12 7c-1.6 3.5-1.6 10 0 14"/><path d="M12 7c0-1.8.6-3.2 2-4"/><path d="M14 4.5c1.2-1.9 3.6-2.3 5.6-1.7-.4 2.2-2.6 3.4-5.6 1.7Z"/>', // абрикос (иконка категории «Сухофрукти»)
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
    check: '<path d="M20 6 9 17l-5-5"/>',
    rotate: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>'
  };


  /* Тексты этапа 7 (главная, избранное, фильтры, профиль, подарки, аналитика). */
  var I18N_MORE = {
    ua: {
      navHome: 'Каталог', navFav: 'Обране', navCart: 'Кошик', navMe: 'Профіль',
      favTitle: 'Обране', favEmptyTitle: 'В обраному поки порожньо', favEmpty: 'Натисніть на сердечко біля товару, і він збережеться тут.',
      favAdd: 'Додати в обране', favDel: 'Прибрати з обраного', favAdded: 'Додано в обране', favRemoved: 'Прибрано з обраного',
      secAgain: 'Купити знову', secPop: 'Популярне', secPopSub: 'за замовленнями за 30 днів', secSale: 'Знижки', secNew: 'Новинки',
      secSets: 'Набори', secSeen: 'Ви дивилися', secForYou: 'Вам може сподобатися', secAll: 'Усі товари',
      found: 'Знайдено: {n}', showMore: 'Показати ще',
      sortBtn: 'Сортування і фільтри', sortTitle: 'Сортування', sortDef: 'Як у магазині', sortPop: 'Спочатку популярні',
      sortAsc: 'Спочатку дешевші', sortDesc: 'Спочатку дорожчі', sortAz: 'За назвою',
      filTitle: 'Показувати', filStock: 'Лише в наявності', filSale: 'Лише зі знижкою', filApply: 'Показати товари', filReset: 'Скинути',
      badgeSet: 'Набір', bought: 'Замовлень за 30 днів: {n}', leftPcs: 'Залишилось {n} шт', leftKg: 'Залишилось {n} кг',
      saleTill: 'Знижка діє до {d} включно', benefit: 'Вигода {n}',
      related: 'Разом із цим купують', similar: 'Схожі товари',
      notifyBtn: 'Повідомити, коли з’явиться', notifyOk: 'Напишемо вам у Telegram, щойно товар з’явиться', notifyDup: 'Ви вже підписані на цей товар',
      notifyFail: 'Не вдалося підписатися. Спробуйте ще раз.', notifyTg: 'Підписка працює, коли магазин відкрито в Telegram.',
      share: 'Поділитися', shareCopied: 'Посилання скопійовано', open: 'Відкрити',
      undo: 'Повернути', removed: 'Товар прибрано з кошика', clearCart: 'Очистити кошик', clearAsk: 'Прибрати всі товари з кошика?', cleared: 'Кошик очищено',
      cartMore: 'Додайте до замовлення', inCartNow: 'У кошику: {n}',
      giftLeft: 'Ще {n} до подарунка: {g}', giftOk: 'Подарунок до замовлення: {g}', giftFrom: 'Подарунок до замовлення від {n}: {g}',
      minLeft: 'До мінімальної суми замовлення ще {n}',
      loyalTitle: 'Постійним клієнтам', loyalText: 'До кожного {k}-го замовлення даруємо: {g}',
      loyalLeft: 'Виконано замовлень: {a}. До подарунка ще {b}.', loyalNext: 'Наступне замовлення буде з подарунком.',
      meShop: 'Де нас знайти', meHome: 'Додати на головний екран', meHomeOk: 'PAMIR додано на головний екран', meLang: 'Мова',
      doneGift: 'До замовлення додамо подарунок: {g}', recent: 'Ви шукали', clear: 'Очистити',
      coItems: 'Товарів: {n}', edit: 'Змінити', offline: 'Немає з’єднання. Показуємо збережений каталог.',
      admQty: 'Залишок (кг для вагового, шт для решти)', admQtyHint: 'Порожньо — не рахувати. Після кожного замовлення зменшується сам; на нулі товар стає «немає».',
      admEnd: 'Знижка діє до', admEndHint: 'Після цієї дати товар знову коштує як «стара ціна». Порожньо — без терміну.',
      admKpi: 'Середній чек', admRepeat: 'Повторні покупці', admFunnel: 'Воронка за 30 днів (сесії)',
      fOpen: 'Відкрили магазин', fView: 'Дивилися товар', fAdd: 'Додали в кошик', fCheckout: 'Почали оформлення', fOrder: 'Замовили',
      admCr: 'Конверсія в замовлення', admZero: 'Шукали і не знайшли', admViewed: 'Найчастіше дивляться',
      admNoEvents: 'Дані про поведінку з’являться після перших відвідувань.', admOf: 'з'
    },
    ru: {
      navHome: 'Каталог', navFav: 'Избранное', navCart: 'Корзина', navMe: 'Профиль',
      favTitle: 'Избранное', favEmptyTitle: 'В избранном пока пусто', favEmpty: 'Нажмите на сердечко у товара, и он сохранится здесь.',
      favAdd: 'Добавить в избранное', favDel: 'Убрать из избранного', favAdded: 'Добавлено в избранное', favRemoved: 'Убрано из избранного',
      secAgain: 'Купить снова', secPop: 'Популярное', secPopSub: 'по заказам за 30 дней', secSale: 'Скидки', secNew: 'Новинки',
      secSets: 'Наборы', secSeen: 'Вы смотрели', secForYou: 'Вам может понравиться', secAll: 'Все товары',
      found: 'Найдено: {n}', showMore: 'Показать ещё',
      sortBtn: 'Сортировка и фильтры', sortTitle: 'Сортировка', sortDef: 'Как в магазине', sortPop: 'Сначала популярные',
      sortAsc: 'Сначала дешевле', sortDesc: 'Сначала дороже', sortAz: 'По названию',
      filTitle: 'Показывать', filStock: 'Только в наличии', filSale: 'Только со скидкой', filApply: 'Показать товары', filReset: 'Сбросить',
      badgeSet: 'Набор', bought: 'Заказов за 30 дней: {n}', leftPcs: 'Осталось {n} шт', leftKg: 'Осталось {n} кг',
      saleTill: 'Скидка действует до {d} включительно', benefit: 'Выгода {n}',
      related: 'Вместе с этим покупают', similar: 'Похожие товары',
      notifyBtn: 'Сообщить, когда появится', notifyOk: 'Напишем вам в Telegram, как только товар появится', notifyDup: 'Вы уже подписаны на этот товар',
      notifyFail: 'Не удалось подписаться. Попробуйте ещё раз.', notifyTg: 'Подписка работает, когда магазин открыт в Telegram.',
      share: 'Поделиться', shareCopied: 'Ссылка скопирована', open: 'Открыть',
      undo: 'Вернуть', removed: 'Товар убран из корзины', clearCart: 'Очистить корзину', clearAsk: 'Убрать все товары из корзины?', cleared: 'Корзина очищена',
      cartMore: 'Добавьте к заказу', inCartNow: 'В корзине: {n}',
      giftLeft: 'Ещё {n} до подарка: {g}', giftOk: 'Подарок к заказу: {g}', giftFrom: 'Подарок к заказу от {n}: {g}',
      minLeft: 'До минимальной суммы заказа ещё {n}',
      loyalTitle: 'Постоянным клиентам', loyalText: 'К каждому {k}-му заказу дарим: {g}',
      loyalLeft: 'Выполнено заказов: {a}. До подарка ещё {b}.', loyalNext: 'Следующий заказ будет с подарком.',
      meShop: 'Где нас найти', meHome: 'Добавить на главный экран', meHomeOk: 'PAMIR добавлен на главный экран', meLang: 'Язык',
      doneGift: 'К заказу добавим подарок: {g}', recent: 'Вы искали', clear: 'Очистить',
      coItems: 'Товаров: {n}', edit: 'Изменить', offline: 'Нет соединения. Показываем сохранённый каталог.',
      admQty: 'Остаток (кг для весового, шт для остального)', admQtyHint: 'Пусто — не считать. После каждого заказа уменьшается сам; на нуле товар становится «немає».',
      admEnd: 'Скидка действует до', admEndHint: 'После этой даты товар снова стоит как «старая цена». Пусто — без срока.',
      admKpi: 'Средний чек', admRepeat: 'Повторные покупатели', admFunnel: 'Воронка за 30 дней (сессии)',
      fOpen: 'Открыли магазин', fView: 'Смотрели товар', fAdd: 'Добавили в корзину', fCheckout: 'Начали оформление', fOrder: 'Заказали',
      admCr: 'Конверсия в заказ', admZero: 'Искали и не нашли', admViewed: 'Чаще всего смотрят',
      admNoEvents: 'Данные о поведении появятся после первых посещений.', admOf: 'из'
    }
  };
  ['ua', 'ru'].forEach(function (lang) {
    Object.keys(I18N_MORE[lang]).forEach(function (k) { I18N[lang][k] = I18N_MORE[lang][k]; });
  });

  /* Тексты этапа 8 (админы с правами, журнал). */
  var I18N_8 = {
    ua: {
      admAdmins: 'Адміни', admAddAdmin: 'Додати адміна', admRole: 'Роль', admRoleOwner: 'Власник', admRoleAdmin: 'Адмін (усі права)',
      admRoleManager: 'Менеджер (права на вибір)', admPermsTitle: 'Що дозволено', admPermView: 'Замовлення: перегляд (завжди)',
      admNotify: 'Отримувати сповіщення про замовлення', admActive: 'Доступ увімкнено', admInviteMake: 'Створити посилання-запрошення',
      admInviteLink: 'Посилання для нового адміна', admInviteDone: 'Готово',
      admInviteHint: 'Надішліть це посилання людині особисто. Воно одноразове і діє 24 години. Коли людина його відкриє, бот запитає у вас підтвердження — до цього прав у неї немає.',
      admLog: 'Журнал дій', admLogEmpty: 'Записів поки немає.', admNoPerm: 'У вас немає права на цю дію.',
      admOwnerOnly: 'Повних адмінів змінює лише власник.', admSelf: 'Свої права змінити не можна.', admOffTag: 'вимкнено',
      admNoNotify: 'без сповіщень', admAllPerms: 'Усі права', admViewOnly: 'Лише перегляд замовлень', admWaiting: 'Очікують підтвердження',
      admInviteNew: 'посилання ще не відкрили', admHours: 'год', admLocked: 'Сірі поля недоступні: на них у вас немає прав.',
      admYou: 'це ви'
    },
    ru: {
      admAdmins: 'Админы', admAddAdmin: 'Добавить админа', admRole: 'Роль', admRoleOwner: 'Владелец', admRoleAdmin: 'Админ (все права)',
      admRoleManager: 'Менеджер (права на выбор)', admPermsTitle: 'Что разрешено', admPermView: 'Замовлення: перегляд (всегда)',
      admNotify: 'Получать уведомления о заказах', admActive: 'Доступ включён', admInviteMake: 'Создать ссылку-приглашение',
      admInviteLink: 'Ссылка для нового админа', admInviteDone: 'Готово',
      admInviteHint: 'Отправьте эту ссылку человеку лично. Она одноразовая и действует 24 часа. Когда человек её откроет, бот спросит у вас подтверждение — до этого прав у него нет.',
      admLog: 'Журнал действий', admLogEmpty: 'Записей пока нет.', admNoPerm: 'У вас нет права на это действие.',
      admOwnerOnly: 'Полных админов меняет только владелец.', admSelf: 'Свои права изменить нельзя.', admOffTag: 'отключён',
      admNoNotify: 'без уведомлений', admAllPerms: 'Все права', admViewOnly: 'Только просмотр заказов', admWaiting: 'Ждут подтверждения',
      admInviteNew: 'ссылку ещё не открыли', admHours: 'ч', admLocked: 'Серые поля недоступны: на них у вас нет прав.',
      admYou: 'это вы'
    }
  };
  ['ua', 'ru'].forEach(function (lang) {
    Object.keys(I18N_8[lang]).forEach(function (k) { I18N[lang][k] = I18N_8[lang][k]; });
  });

  var ICONS_MORE = {
    heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
    home: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    sliders: '<path d="M21 4h-7"/><path d="M10 4H3"/><path d="M21 12h-9"/><path d="M8 12H3"/><path d="M21 20h-5"/><path d="M12 20H3"/><path d="M14 2v4"/><path d="M8 10v4"/><path d="M16 18v4"/>',
    share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.59 13.51 6.83 3.98"/><path d="m15.41 6.51-6.82 3.98"/>',
    bell: '<path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/>',
    gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5"/>',
    pin: '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    phone: '<rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    box: '<path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="m7.5 4.27 9 5.15"/>'
  };
  Object.keys(ICONS_MORE).forEach(function (k) { ICONS[k] = ICONS_MORE[k]; });

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
    view: 'catalog',   // catalog | cart | checkout | done | admin | orders
    scrollY: 0,
    cart: { t: 0, i: [] }, // i: [{ id, g (граммы, 0 = штука/упаковка), q, pr (цена за единицу), was? }]
    form: { name: '', phone: '', delivery: 'pickup', city: '', branch: '', pay: 'cash', comment: '' },
    done: null,
    cartNotice: '',
    rid: '',           // id попытки заказа: повторная отправка не создаст второй заказ
    offline: false     // свежий каталог не загрузился, показываем сохранённую копию
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
    toastText: document.getElementById('toastText'),
    toastBtn: document.getElementById('toastBtn'),
    adminBtn: document.getElementById('adminBtn'),
    tabbar: document.getElementById('tabbar'),
    searchClear: document.getElementById('searchClear'),
    filterBtn: document.getElementById('filterBtn'),
    filterDot: document.getElementById('filterDot'),
    recent: document.getElementById('recent')
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
    buildSearchIndex(data);
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
        if (state.offline) { state.offline = false; renderBanner(); }
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
        } else if (cfg.API_URL) {
          state.offline = true;
          renderBanner();
        }
      });
  }

  /* ------------------------- Избранное, просмотренное, поиск ------------------------- */
  var PAGE_SIZE = 30;
  var FAV_KEY = 'pamir_fav_v1', SEEN_KEY = 'pamir_seen_v1', SEARCH_KEY = 'pamir_search_v1';
  var SUBS_KEY = 'pamir_subs_v1', HASORD_KEY = 'pamir_has_orders';
  var favs = [], seen = [], searches = [], subs = [];
  var flt = { sort: '', onlyStock: false, onlySale: false, limit: PAGE_SIZE };

  /** Текст с подстановками: tf('found', { n: 12 }) → «Знайдено: 12». */
  function tf(key, vars) {
    return t(key).replace(/\{(\w+)\}/g, function (m, k) { return vars[k] === undefined ? m : String(vars[k]); });
  }

  function readList(key, max) {
    try {
      var a = JSON.parse(store.get(key) || '[]');
      return Array.isArray(a) ? a.filter(function (x) { return typeof x === 'string' && x; }).slice(0, max) : [];
    } catch (e) { return []; }
  }

  function saveList(key, cloudKey, list) {
    var text = JSON.stringify(list);
    store.set(key, text);
    if (cloudKey && cloudOk() && text.length <= 4096) {
      try { tg.CloudStorage.setItem(cloudKey, text, function () {}); } catch (e) { /* облако недоступно */ }
    }
  }

  function loadLists() {
    favs = readList(FAV_KEY, 200);
    seen = readList(SEEN_KEY, 12);
    searches = readList(SEARCH_KEY, 6);
    subs = readList(SUBS_KEY, 40);
    if (!cloudOk()) return;
    // Новый телефон: избранное и просмотренное приезжают из Telegram, если здесь ещё пусто.
    try {
      tg.CloudStorage.getItems(['fav', 'seen'], function (err, values) {
        if (err || !values) return;
        var changed = false;
        function take(cloudKey, max) {
          try {
            var a = JSON.parse(values[cloudKey] || '[]');
            return Array.isArray(a) ? a.filter(function (x) { return typeof x === 'string' && x; }).slice(0, max) : [];
          } catch (e) { return []; }
        }
        if (!favs.length) { favs = take('fav', 200); if (favs.length) { store.set(FAV_KEY, JSON.stringify(favs)); changed = true; } }
        if (!seen.length) { seen = take('seen', 12); if (seen.length) { store.set(SEEN_KEY, JSON.stringify(seen)); changed = true; } }
        if (!changed) return;
        if (state.status === 'ready' && state.view === 'catalog') renderMain();
        if (state.view === 'fav') renderPage();
        renderTabbar();
      });
    } catch (e) { /* облако недоступно */ }
  }

  function isFav(id) { return favs.indexOf(id) >= 0; }

  function toggleFav(id) {
    var i = favs.indexOf(id), on = i < 0;
    if (on) favs.unshift(id); else favs.splice(i, 1);
    favs = favs.slice(0, 200);
    saveList(FAV_KEY, 'fav', favs);
    Array.prototype.forEach.call(document.querySelectorAll('[data-fav]'), function (b) {
      if (b.getAttribute('data-fav') !== id) return;
      b.setAttribute('aria-pressed', String(on));
      b.setAttribute('aria-label', t(on ? 'favDel' : 'favAdd'));
      if (on) { b.classList.remove('is-pop'); void b.offsetWidth; b.classList.add('is-pop'); }
    });
    hapticLight();
    if (on) track('fav', id);
    renderTabbar();
    if (state.view === 'fav' && !state.sheet) renderPage();
  }

  function favBtn(p) {
    var on = isFav(p.id);
    return '<button type="button" class="fav" data-fav="' + esc(p.id) + '" aria-pressed="' + on + '" aria-label="' + esc(t(on ? 'favDel' : 'favAdd')) + '">' + icon('heart') + '</button>';
  }

  function markSeen(id) {
    var i = seen.indexOf(id);
    if (i === 0) return;
    if (i > 0) seen.splice(i, 1);
    seen.unshift(id);
    seen = seen.slice(0, 12);
    saveList(SEEN_KEY, 'seen', seen);
  }

  /** Нижний регистр, «ё» = «е», без апострофов: «мʼята» и «мята» находят одно и то же. */
  function norm(s) {
    return String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/[ʼ’'`]/g, '').replace(/\s+/g, ' ').trim();
  }

  function buildSearchIndex(data) {
    var cats = {};
    data.categories.forEach(function (c) { cats[c.code] = c.ua + ' ' + c.ru; });
    data.sx = {}; data.sn = {};
    data.products.forEach(function (p) {
      data.sn[p.id] = norm(p.ua + ' ' + (p.ru || '') + ' ' + p.id);
      data.sx[p.id] = data.sn[p.id] + ' ' + norm((cats[p.c] || '') + ' ' + (p.dUa || '') + ' ' + (p.dRu || ''));
    });
  }

  function rememberSearch(q) {
    q = q.trim().slice(0, 40);
    if (q.length < 2) return;
    var key = norm(q);
    searches = searches.filter(function (s) { return norm(s) !== key; });
    searches.unshift(q);
    searches = searches.slice(0, 6);
    saveList(SEARCH_KEY, '', searches);
  }

  /** Поиск завершён (Enter, уход из поля): запоминаем запрос и отмечаем в аналитике, нашлось ли что-то. */
  var lastTracked = '';
  function commitSearch() {
    var q = state.q.trim();
    if (q.length < 2 || !state.catalog || norm(q) === lastTracked) return;
    lastTracked = norm(q);
    var n = visibleProducts().length;
    if (n) rememberSearch(q);
    track(n ? 'search' : 'search0', '', q.slice(0, 60));
  }

  function renderRecent() {
    var show = document.activeElement === el.search && !el.search.value && searches.length > 0;
    el.recent.hidden = !show;
    if (!show) return;
    el.recent.innerHTML = '<span class="recent__label">' + esc(t('recent')) + '</span>' + searches.map(function (s) {
      return '<button type="button" class="chip chip--sm" data-recent="' + esc(s) + '">' + esc(s) + '</button>';
    }).join('') + '<button type="button" class="recent__clear" data-recent-clear="1">' + esc(t('clear')) + '</button>';
  }

  /* ------------------------------ Аналитика ------------------------------ */
  /* События копятся и уходят пачкой: при сворачивании магазина, раз в 20 секунд или когда набралось 20 штук. */
  var SID = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  var evQueue = [], evTimer = null;

  function track(name, id, value) {
    if (!cfg.API_URL || !inTelegram) return;
    evQueue.push({ e: name, id: id || '', v: value === undefined || value === null ? '' : String(value), t: Date.now() });
    if (evQueue.length >= 20) flushEvents(false);
    else if (!evTimer) evTimer = setTimeout(function () { flushEvents(false); }, evQueue.length === 1 && name === 'open' ? 8000 : 20000);
  }

  function flushEvents(leaving) {
    clearTimeout(evTimer);
    evTimer = null;
    if (!evQueue.length || !cfg.API_URL || !inTelegram) return;
    var body = JSON.stringify({ action: 'ev', initData: tg.initData, sid: SID, events: evQueue.splice(0, 40) });
    try {
      if (leaving && navigator.sendBeacon) {
        navigator.sendBeacon(cfg.API_URL, new Blob([body], { type: 'text/plain;charset=utf-8' }));
        return;
      }
      fetch(cfg.API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: body, keepalive: true })
        .catch(function () { /* аналитика не должна мешать магазину */ });
    } catch (e) { /* аналитика не должна мешать магазину */ }
  }

  /* ------------------------------ Отрисовка ------------------------------ */
  function renderAll() {
    document.documentElement.lang = state.lang === 'ru' ? 'ru' : 'uk';
    el.search.placeholder = t('search');
    el.search.setAttribute('aria-label', t('search'));
    el.searchClear.setAttribute('aria-label', t('clear'));
    el.filterBtn.setAttribute('aria-label', t('sortBtn'));
    Array.prototype.forEach.call(document.querySelectorAll('.lang button'), function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-lang') === state.lang));
    });
    renderBanner();
    renderChips();
    renderRecent();
    renderMain();
    if (state.sheet) renderSheet();
    if (state.view === 'checkout') updateCheckoutSum(); else if (state.view !== 'admin') renderPage();
    updateChrome();
  }

  function renderBanner() {
    var parts = [];
    if (DEBUG) parts.push(t('debug'));
    if (!cfg.API_URL) parts.push(t('demo'));
    if (state.offline && state.catalog) parts.push(t('offline'));
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
    var active = el.chips.querySelector('[aria-pressed="true"]');
    if (active && active.scrollIntoView && state.cat) {
      try { active.scrollIntoView({ block: 'nearest', inline: 'center' }); } catch (e) { /* старый браузер */ }
    }
    el.filterDot.hidden = !(flt.sort || flt.onlyStock || flt.onlySale);
  }

  function hasOld(p) { return p.o > (p.t === 'w' ? p.k : p.p); }

  /** Главная: ни поиска, ни категории, ни фильтров — показываем подборки. */
  function isHome() {
    return !state.q.trim() && !state.cat && !flt.sort && !flt.onlyStock && !flt.onlySale;
  }

  function visibleProducts() {
    var tokens = norm(state.q).split(' ').filter(Boolean);
    var sx = state.catalog.sx || {}, sn = state.catalog.sn || {};
    var list = state.catalog.products.filter(function (p) {
      if (state.cat && p.c !== state.cat) return false;
      if (flt.onlyStock && !p.a) return false;
      if (flt.onlySale && !(p.a && hasOld(p))) return false;
      var text = sx[p.id] || '';
      return tokens.every(function (tk) { return text.indexOf(tk) >= 0; });
    });
    if (tokens.length) { // совпадение в названии важнее совпадения в описании
      var inName = function (p) { var text = sn[p.id] || ''; return tokens.every(function (tk) { return text.indexOf(tk) >= 0; }); };
      list = list.filter(inName).concat(list.filter(function (p) { return !inName(p); }));
    }
    if (flt.sort === 'asc' || flt.sort === 'desc') {
      var dir = flt.sort === 'asc' ? 1 : -1;
      var val = function (p) { var cp = cardPrice(p); return cp ? cp.price : Infinity * dir; };
      list = list.slice().sort(function (a, b) { return (val(a) - val(b)) * dir; });
    } else if (flt.sort === 'pop') {
      list = list.slice().sort(function (a, b) { return (b.n || 0) - (a.n || 0); });
    } else if (flt.sort === 'az') {
      list = list.slice().sort(function (a, b) { return name(a).localeCompare(name(b), state.lang === 'ru' ? 'ru' : 'uk'); });
    }
    // Товары, которых нет, уходят в конец; порядок остальных — как выбрано (по умолчанию как в таблице).
    return list.filter(function (p) { return p.a; }).concat(list.filter(function (p) { return !p.a; }));
  }

  function photoHtml(p) {
    return p.img
      ? '<img src="' + esc(p.img) + '" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">'
      : MARK;
  }

  function leftText(p) {
    return p.q > 0 ? tf(p.t === 'w' ? 'leftKg' : 'leftPcs', { n: String(p.q).replace('.', ',') }) : '';
  }

  /** Бейдж наличия. На карточке — только когда это важно: товара нет или он заканчивается. */
  function badgeHtml(p, always) {
    if (!p.a) return '<span class="badge badge--out">' + esc(t('badgeOut')) + '</span>';
    if (p.q > 0) return '<span class="badge badge--low">' + esc(leftText(p)) + '</span>';
    return always ? '<span class="badge badge--stock">' + esc(t('badgeIn')) + '</span>' : '';
  }

  var PROMO = { 'new': 'badgeNew', hit: 'badgeHit', sale: 'badgeSale', set: 'badgeSet' };
  /** Бейдж «Новинка / Хіт / Знижка / Набір»; у товара, которого нет, не показываем. */
  function promoHtml(p) {
    return p.a && PROMO[p.b] ? '<span class="badge promo promo--' + p.b + '">' + esc(t(PROMO[p.b])) + '</span>' : '';
  }
  function priceHtml(cp) {
    return '<span class="price">' + money(cp.price) + '</span>' +
      (cp.old ? '<s class="price-old">' + money(cp.old) + '</s>' : '') + '<span class="unit">' + esc(cp.unit) + '</span>';
  }

  /** Блок наверху каталога («Наша курага»): виден на главной, пока товар в наличии. */
  function featureHtml() {
    var f = shopInfo().feature;
    if (!f) return '';
    var p = state.catalog.byId[f.id];
    if (!p || !p.a) return '';
    var ru = state.lang === 'ru';
    var title = (ru ? f.title.ru : f.title.ua) || name(p);
    var text = (ru ? f.text.ru : f.text.ua) || '';
    var cp = cardPrice(p);
    return '<article class="feature" data-id="' + esc(p.id) + '"><div class="feature__img card__img">' + photoHtml(p) + '</div>' +
      '<div class="feature__body"><h2 class="feature__title">' + esc(title) + '</h2>' +
      (text ? '<p class="feature__text">' + esc(text) + '</p>' : '') +
      '<div class="feature__foot"><div class="card__meta">' + (cp ? priceHtml(cp) : '') + '</div>' +
      '<button type="button" class="btn btn--primary">' + esc(t('featureCta')) + '</button></div></div></article>';
  }

  /** Подарок от суммы и подарок постоянным клиентам — если они заданы в настройках магазина. */
  function perksHtml() {
    var s = shopInfo(), ru = state.lang === 'ru', out = '';
    function perk(ico, text) { return '<p class="perk">' + icon(ico) + '<span>' + esc(text) + '</span></p>'; }
    if (s.gift) out += perk('gift', tf('giftFrom', { n: money(s.gift.from), g: ru ? s.gift.ru : s.gift.ua }));
    if (s.loyal) out += perk('users', tf('loyalText', { k: s.loyal.every, g: ru ? s.loyal.ru : s.loyal.ua }));
    return out ? '<div class="perks">' + out + '</div>' : '';
  }

  /** Кнопка под карточкой. Штучный товар кладётся в корзину сразу; у весового сначала выбирают вес. */
  function actHtml(p) {
    if (!p.a) return '<button type="button" class="btn btn--block" disabled>' + esc(t('out')) + '</button>';
    var n = cartQty(p.id);
    if (p.t === 'w') {
      return n
        ? '<button type="button" class="btn btn--soft btn--block">' + esc(t('inCart')) + ' · ' + n + '</button>'
        : '<button type="button" class="btn btn--primary btn--block"><svg class="ico" aria-hidden="true"><use href="#i-plus"/></svg>' + esc(t('toCart')) + '</button>';
    }
    if (!n) {
      return '<button type="button" class="btn btn--primary btn--block" data-quick="1"><svg class="ico" aria-hidden="true"><use href="#i-plus"/></svg>' + esc(t('toCart')) + '</button>';
    }
    return '<div class="step step--card" role="group" aria-label="' + esc(t('qty')) + '">' +
      '<button type="button" data-quick="-1" aria-label="' + esc(t('less')) + '">' + icon('minus') + '</button>' +
      '<output>' + n + '</output>' +
      '<button type="button" data-quick="1" aria-label="' + esc(t('more')) + '"' + (n >= maxQty(p, 0) ? ' disabled' : '') + '>' + icon('plus') + '</button></div>';
  }

  function cardHtml(p) {
    var cp = cardPrice(p);
    return '<article class="card' + (p.a ? '' : ' card--out') + '" data-id="' + esc(p.id) + '">' +
      '<div class="card__img">' + photoHtml(p) + badgeHtml(p) + promoHtml(p) + favBtn(p) + '</div>' +
      '<h2 class="card__name">' + esc(name(p)) + '</h2>' +
      '<div class="card__meta">' + (cp ? priceHtml(cp) : '') + '</div>' +
      '<div class="card__act" data-act="' + esc(p.id) + '">' + actHtml(p) + '</div></article>';
  }

  /** Маленькая карточка для горизонтальных подборок. quick — с кнопкой «+» (в корзине). */
  function miniHtml(p, quick) {
    var cp = cardPrice(p);
    return '<article class="mini" data-id="' + esc(p.id) + '"><div class="mini__img card__img">' + photoHtml(p) + promoHtml(p) +
      (quick ? '<button type="button" class="mini__add" data-quick="1" aria-label="' + esc(t('addToCart')) + '">' + icon('plus') + '</button>' : '') + '</div>' +
      '<h3 class="mini__name">' + esc(name(p)) + '</h3>' +
      '<div class="card__meta">' + (cp ? priceHtml(cp) : '') + '</div></article>';
  }

  function railHtml(title, sub, list, quick) {
    if (!list.length) return '';
    return '<section class="rail"><div class="rail__head"><h2 class="rail__title">' + esc(title) + '</h2>' +
      (sub ? '<span class="rail__sub">' + esc(sub) + '</span>' : '') + '</div><div class="rail__list">' +
      list.map(function (p) { return miniHtml(p, quick); }).join('') + '</div></section>';
  }

  function inStockList(ids) {
    return ids.map(product).filter(function (p) { return p && p.a; });
  }

  /** Популярное — по настоящим заказам за 30 дней; пока заказов мало, показываем товары с бейджем «Хіт». */
  function popular(limit) {
    var all = state.catalog.products;
    var list = all.filter(function (p) { return p.a && p.n > 0; }).sort(function (a, b) { return b.n - a.n; });
    if (list.length >= 3) return { list: list.slice(0, limit), real: true };
    return { list: all.filter(function (p) { return p.a && p.b === 'hit'; }).slice(0, limit), real: false };
  }

  /** «Вам може сподобатися»: товары из тех же категорий, что человек смотрел и покупал, которых он ещё не видел. */
  function forYou() {
    var base = seen.concat(my.bought || []);
    if (base.length < 2) return [];
    var cats = {}, skip = {};
    base.forEach(function (id) { var p = product(id); skip[id] = 1; if (p) cats[p.c] = (cats[p.c] || 0) + 1; });
    state.cart.i.forEach(function (l) { skip[l.id] = 1; });
    return state.catalog.products.filter(function (p) { return p.a && cats[p.c] && !skip[p.id]; })
      .sort(function (a, b) { return (cats[b.c] - cats[a.c]) || ((b.n || 0) - (a.n || 0)); }).slice(0, 10);
  }

  function homeRails() {
    var all = state.catalog.products, html = '';
    function two(list) { return list.length >= 2 ? list.slice(0, 10) : []; }
    html += railHtml(t('secAgain'), '', inStockList(my.bought || []).slice(0, 10));
    if (all.length >= 8) { // в совсем маленьком каталоге подборки только повторяли бы список ниже
      var pop = popular(10);
      html += railHtml(t('secPop'), pop.real ? t('secPopSub') : '', two(pop.list));
      html += railHtml(t('secSale'), '', two(all.filter(function (p) { return p.a && hasOld(p); })));
      html += railHtml(t('secNew'), '', two(all.filter(function (p) { return p.a && p.b === 'new'; })));
      html += railHtml(t('secSets'), '', two(all.filter(function (p) { return p.a && p.b === 'set'; })));
      html += railHtml(t('secForYou'), '', two(forYou()));
    }
    html += railHtml(t('secSeen'), '', seen.map(product).filter(Boolean).slice(0, 10));
    return html;
  }

  function skeletonHtml() {
    var cards = '';
    for (var i = 0; i < 6; i++) {
      cards += '<div class="skel"><div class="skel__img"></div><div class="skel__line"></div><div class="skel__line skel__line--short"></div><div class="skel__btn"></div></div>';
    }
    return '<div class="grid" aria-hidden="true">' + cards + '</div>';
  }

  var moreObs = null;
  function renderMain() {
    if (moreObs) { moreObs.disconnect(); moreObs = null; }
    if (state.status === 'loading') { el.main.innerHTML = skeletonHtml(); return; }
    if (state.status === 'error') {
      el.main.innerHTML = '<div class="state">' + MARK +
        '<p class="state__title">' + esc(t('errTitle')) + '</p>' +
        '<p class="state__text">' + esc(t('errText')) + '</p>' +
        '<button type="button" class="btn btn--primary" data-action="retry">' + esc(t('retry')) + '</button></div>';
      return;
    }
    var list = visibleProducts();
    var home = isHome();
    if (!list.length) {
      el.main.innerHTML = '<div class="state">' + MARK +
        '<p class="state__title">' + esc(t('emptyTitle')) + '</p>' +
        '<p class="state__text">' + esc(t('emptyText')) + '</p>' +
        '<button type="button" class="btn" data-action="reset">' + esc(t('reset')) + '</button></div>' +
        railHtml(t('secPop'), '', popular(10).list);
      return;
    }
    var html = home ? featureHtml() + perksHtml() + homeRails() : '';
    html += '<div class="grid__head"><h2 class="rail__title">' + esc(home ? t('secAll') : tf('found', { n: list.length })) + '</h2></div>' +
      '<div class="grid" id="grid">' + list.slice(0, flt.limit).map(cardHtml).join('') + '</div>';
    if (list.length > flt.limit) {
      html += '<div class="more" id="more"><button type="button" class="btn btn--block" data-action="more">' + esc(t('showMore')) + '</button></div>';
    }
    el.main.innerHTML = html;
    // Длинный каталог рисуется порциями: следующая появляется, когда до неё доскроллили.
    var more = document.getElementById('more');
    if (more && window.IntersectionObserver) {
      moreObs = new IntersectionObserver(function (entries) {
        if (entries.some(function (x) { return x.isIntersecting; })) showMore();
      }, { rootMargin: '600px 0px' });
      moreObs.observe(more);
    }
  }

  function showMore() {
    var grid = document.getElementById('grid');
    if (!grid || !state.catalog) return;
    var list = visibleProducts();
    grid.insertAdjacentHTML('beforeend', list.slice(flt.limit, flt.limit + PAGE_SIZE).map(cardHtml).join(''));
    flt.limit += PAGE_SIZE;
    if (flt.limit >= list.length) {
      var more = document.getElementById('more');
      if (more) more.parentNode.removeChild(more);
      if (moreObs) { moreObs.disconnect(); moreObs = null; }
    }
  }

  /** Обновляет только кнопки под карточками: фото не перерисовываются и не мигают. */
  function refreshActs() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-act]'), function (box) {
      var p = product(box.getAttribute('data-act'));
      if (p) box.innerHTML = actHtml(p);
    });
  }

  /** Новый поиск, категория или фильтр: список с начала. */
  function resetList() {
    flt.limit = PAGE_SIZE;
    if (state.status === 'ready') renderMain();
  }

  /* ------------------------------ Шторка товара ------------------------------ */
  /** Сколько штук этой фасовки можно положить в корзину (с учётом остатка, если он известен). */
  function maxQty(p, g) {
    if (!(p.q > 0)) return MAX_QTY;
    var n = p.t === 'w' ? (g > 0 ? Math.floor(p.q * 1000 / g + 1e-9) : 0) : Math.floor(p.q);
    return Math.max(0, Math.min(MAX_QTY, n));
  }

  function openSheet(id) {
    var p = state.catalog && state.catalog.byId[id];
    if (!p) return;
    var vi = 0;
    if (p.t === 'w') { // первая фасовка, которой хватает на складе
      for (var i = 0; i < p.v.length; i++) if (maxQty(p, p.v[i][0]) >= 1) { vi = i; break; }
    }
    var wasOpen = !!state.sheet;
    state.sheet = { id: id, vi: vi, qty: 1 };
    renderSheet();
    showSheet(wasOpen);
    if (wasOpen) el.sheet.querySelector('.sheet__body').scrollTop = 0;
    markSeen(id);
    track('view', id);
  }

  function openFilter() {
    state.sheet = { kind: 'filter' };
    renderSheet();
    showSheet(false);
  }

  function showSheet(wasOpen) {
    el.sheet.style.transform = '';
    el.sheet.hidden = false;
    el.backdrop.hidden = false;
    document.body.classList.add('is-locked');
    updateChrome();
    swipes(false);
    if (!wasOpen) {
      var closeBtn = el.sheet.querySelector('.sheet__close');
      if (closeBtn) closeBtn.focus({ preventScroll: true });
    }
  }

  function closeSheet() {
    if (!state.sheet) return;
    state.sheet = null;
    el.sheet.hidden = true;
    el.backdrop.hidden = true;
    el.sheet.style.transform = '';
    document.body.classList.remove('is-locked');
    updateChrome();
    swipes(state.view !== 'checkout');
  }

  /** Пока открыта шторка или форма заказа, жест «потянуть вниз» не должен сворачивать весь магазин. */
  function swipes(on) {
    if (!inTelegram) return;
    try { if (on) tg.enableVerticalSwipes(); else tg.disableVerticalSwipes(); } catch (e) { /* старый клиент Telegram */ }
  }

  /** Сумма позиции. Та же формула, что на сервере: цена варианта × количество. */
  function lineTotal(p, vi, qty) {
    var unit = p.t === 'w' ? (p.v[vi] ? p.v[vi][1] : 0) : p.p;
    return unit * qty;
  }

  /** Сумма позиции по старой цене (для зачёркивания); 0 — скидки нет. */
  function oldTotal(p, vi, qty) {
    if (!hasOld(p)) return 0;
    var unit = p.t === 'w' ? (p.v[vi] ? Math.round(p.o * p.v[vi][0] / 1000) : 0) : Math.round(p.o);
    return unit * qty;
  }

  /** Что показать под товаром: «разом купують» по настоящим заказам, а пока их мало — товары той же категории. */
  function relatedFor(p) {
    var real = (p.r || []).map(product).filter(function (x) { return x && x.a && x.id !== p.id; });
    if (real.length) return { title: 'related', list: real.slice(0, 8) };
    var same = state.catalog.products.filter(function (x) { return x.a && x.c === p.c && x.id !== p.id; })
      .sort(function (a, b) { return (b.n || 0) - (a.n || 0); }).slice(0, 8);
    return { title: 'similar', list: same };
  }

  var SORTS = [['', 'sortDef'], ['pop', 'sortPop'], ['asc', 'sortAsc'], ['desc', 'sortDesc'], ['az', 'sortAz']];

  function filterSheetHtml() {
    var hasPop = state.catalog && state.catalog.products.some(function (p) { return p.n > 0; });
    var sorts = SORTS.filter(function (s) { return s[0] !== 'pop' || hasPop; }).map(function (s) {
      return '<label class="opt"><input type="radio" name="sort" value="' + s[0] + '"' + (flt.sort === s[0] ? ' checked' : '') +
        '><span class="opt__box"><span>' + esc(t(s[1])) + '</span></span></label>';
    }).join('');
    function check(key, label) {
      return '<label class="check"><input type="checkbox" name="' + key + '"' + (flt[key] ? ' checked' : '') + '><span>' + esc(t(label)) + '</span></label>';
    }
    var n = state.catalog ? visibleProducts().length : 0;
    return '<button type="button" class="sheet__close" aria-label="' + esc(t('close')) + '">' + icon('x') + '</button>' +
      '<div class="sheet__grab" aria-hidden="true"></div>' +
      '<div class="sheet__body"><h2 class="sheet__title sheet__title--pad" id="sheetTitle">' + esc(t('sortBtn')) + '</h2>' +
      '<div><p class="label">' + esc(t('sortTitle')) + '</p><div class="opts opts--col">' + sorts + '</div></div>' +
      '<div><p class="label">' + esc(t('filTitle')) + '</p>' + check('onlyStock', 'filStock') + check('onlySale', 'filSale') + '</div></div>' +
      '<div class="sheet__foot sheet__foot--two"><button type="button" class="btn" data-action="fil-reset">' + esc(t('filReset')) + '</button>' +
      '<button type="button" class="btn btn--primary" data-action="fil-apply">' + esc(t('filApply')) + ' · ' + n + '</button></div>';
  }

  function renderSheet() {
    var s = state.sheet;
    if (s.kind === 'filter') { el.sheet.innerHTML = filterSheetHtml(); return; }
    var p = state.catalog && state.catalog.byId[s.id];
    if (!p) { closeSheet(); return; }
    if (p.t === 'w' && s.vi >= p.v.length) s.vi = 0;
    var grams = p.t === 'w' ? (p.v[s.vi] ? p.v[s.vi][0] : 0) : 0;
    var max = maxQty(p, grams);
    if (s.qty > max) s.qty = Math.max(1, max);
    var total = lineTotal(p, s.vi, s.qty), old = oldTotal(p, s.vi, s.qty);
    var canBuy = p.a && total > 0 && max >= 1;

    var body = '<div class="sheet__img">' + photoHtml(p) + '<div class="sheet__acts">' +
      '<button type="button" class="fav fav--share" data-action="share" aria-label="' + esc(t('share')) + '">' + icon('share') + '</button>' +
      favBtn(p) + '</div></div>' +
      '<div class="sheet__head"><div class="sheet__badges">' + badgeHtml(p, true) + promoHtml(p) + '</div>' +
      '<h2 class="sheet__title" id="sheetTitle">' + esc(name(p)) + '</h2>';
    if (p.t === 'w' && p.k > 0) {
      body += '<p class="sheet__perkg">' + money(p.k) + (p.o > p.k ? ' <s class="price-old">' + money(p.o) + '</s>' : '') + ' ' + esc(t('per')) + ' ' + weight(1000) + '</p>';
    }
    body += '</div>';

    // Только факты: сколько раз заказывали, до какого числа скидка. Выдуманных счётчиков здесь нет.
    var facts = '';
    if (p.a && p.n >= 3) facts += '<li>' + icon('users') + '<span>' + esc(tf('bought', { n: p.n })) + '</span></li>';
    if (p.a && p.e && hasOld(p)) facts += '<li>' + icon('clock') + '<span>' + esc(tf('saleTill', { d: p.e.split('-').reverse().slice(0, 2).join('.') })) + '</span></li>';
    if (facts) body += '<ul class="facts">' + facts + '</ul>';

    var d = desc(p);
    if (d) body += '<p class="sheet__desc">' + esc(d) + '</p>';

    if (p.a) {
      if (p.t === 'w') {
        body += '<div><p class="label">' + esc(t('packing')) + '</p><div class="weights" role="group" aria-label="' + esc(t('packing')) + '">';
        p.v.forEach(function (v, i) {
          body += '<button type="button" data-vi="' + i + '" aria-pressed="' + (i === s.vi) + '"' + (maxQty(p, v[0]) < 1 ? ' disabled' : '') + '><b>' + weight(v[0]) + '</b><span>' + money(v[1]) + '</span></button>';
        });
        body += '</div></div>';
      } else if (p.pk) {
        body += '<div><p class="label">' + esc(t('packing')) + '</p><div class="weights"><button type="button" aria-pressed="true" tabindex="-1"><b>' +
          esc(p.pk.replace(/ /g, NBSP)) + '</b></button></div></div>';
      }
      body += '<div class="buy"><div class="step" role="group" aria-label="' + esc(t('qty')) + '">' +
        '<button type="button" data-step="-1" aria-label="' + esc(t('less')) + '"' + (s.qty <= 1 ? ' disabled' : '') + '>' + icon('minus') + '</button>' +
        '<output>' + s.qty + NBSP + esc(t('pcs')) + '</output>' +
        '<button type="button" data-step="1" aria-label="' + esc(t('more')) + '"' + (s.qty >= max ? ' disabled' : '') + '>' + icon('plus') + '</button>' +
        '</div><span class="buy__sum">' + (old ? '<s class="price-old">' + money(old) + '</s>' : '') +
        '<span class="total">' + money(total) + '</span>' +
        (old > total ? '<span class="save">' + esc(tf('benefit', { n: money(old - total) })) + '</span>' : '') + '</span></div>';
    } else {
      var waiting = subs.indexOf(p.id) >= 0;
      body += '<p class="note note--out">' + esc(t('outNote')) + '</p>' +
        '<button type="button" class="btn btn--block" data-action="notify"' + (waiting ? ' disabled' : '') + '>' + icon('bell') +
        esc(t(waiting ? 'notifyDup' : 'notifyBtn')) + '</button>';
    }

    if (p.w > 0) {
      body += '<p class="note note--opt">' + esc(t('wholesale')) + ': ' + money(p.w) + ' ' +
        (p.t === 'w' ? esc(t('per')) + ' ' + weight(1000) : esc(t('perPack'))) +
        (p.wm ? ' · ' + esc(p.wm) : '') + '</p>';
    }

    var rel = relatedFor(p);
    body += railHtml(t(rel.title), '', rel.list);

    var scroll = el.sheet.querySelector('.sheet__body');
    var top = scroll ? scroll.scrollTop : 0;
    var inCart = cartQty(p.id);
    var foot = canBuy
      ? '<div class="sheet__foot">' + (inCart ? '<p class="sheet__incart">' + esc(tf('inCartNow', { n: inCart })) + '</p>' : '') +
        '<button type="button" class="btn btn--primary btn--block" data-action="add">' +
        icon('shopping-cart') + esc(t('addToCart')) + ' · ' + money(total) + '</button></div>'
      : '';
    el.sheet.innerHTML = '<button type="button" class="sheet__close" aria-label="' + esc(t('close')) + '">' + icon('x') + '</button>' +
      '<div class="sheet__grab" aria-hidden="true"></div>' +
      '<div class="sheet__body">' + body + '</div>' + foot;
    el.sheet.querySelector('.sheet__body').scrollTop = top;
  }

  function shareProduct(p) {
    var link = productLink(p.id);
    track('share', p.id);
    if (inTelegram) {
      try {
        tg.openTelegramLink('https://t.me/share/url?url=' + encodeURIComponent(link) + '&text=' + encodeURIComponent(name(p)));
        return;
      } catch (e) { /* старый клиент Telegram — копируем ссылку */ }
    }
    var input = document.createElement('input');
    input.value = link;
    input.setAttribute('readonly', '');
    input.style.cssText = 'position:fixed;opacity:0;left:0;top:0';
    document.body.appendChild(input);
    copyText(link, input).then(function (ok) {
      document.body.removeChild(input);
      if (ok) toast(t('shareCopied'));
    });
  }

  /** «Повідомити, коли з'явиться»: бот напишет клиенту, когда админ вернёт товар в наличие. */
  function notifyMe(id) {
    if (!cfg.API_URL || !inTelegram) { toast(t('notifyTg')); return; }
    askWriteAccess().then(function () { return postApi('notify', { id: id, lang: state.lang }); }).then(function (res) {
      if (!res || !res.ok) throw new Error('fail');
      if (res.instock) { loadCatalog(); return; } // товар уже вернулся — просто обновляем витрину
      if (subs.indexOf(id) < 0) { subs.unshift(id); subs = subs.slice(0, 40); saveList(SUBS_KEY, '', subs); }
      haptic('success');
      track('notify', id);
      toast(t(res.dup ? 'notifyDup' : 'notifyOk'));
      if (state.sheet && state.sheet.id === id) renderSheet();
    }).catch(function () { haptic('error'); toast(t('notifyFail')); });
  }

  /** Клик по карточке товара в любом месте: сердечко, быстрое «+/−» или открытие товара. */
  function productClick(e) {
    var fav = e.target.closest('[data-fav]');
    if (fav) { toggleFav(fav.getAttribute('data-fav')); return true; }
    var holder = e.target.closest('[data-id]');
    if (!holder) return false;
    var quick = e.target.closest('[data-quick]');
    if (quick) {
      if (!quick.disabled) quickAdd(holder.getAttribute('data-id'), Number(quick.getAttribute('data-quick')));
      return true;
    }
    if (e.target.closest('.step--card')) return true; // промах между «−» и «+» товар не открывает
    openSheet(holder.getAttribute('data-id'));
    return true;
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
    track('add', p.id, price * s.qty);
    var fromCart = state.view === 'cart';
    closeSheet();
    afterCartChange(true);
    if (fromCart) toast(t('added')); else toast(t('added'), t('open'), function () { go('cart'); });
  }

  /** «+» и «−» прямо на карточке: для товара в упаковке или поштучно. Весовой товар открывает выбор веса. */
  function quickAdd(id, delta) {
    var p = product(id);
    if (!p) return;
    if (p.t === 'w') { openSheet(id); return; }
    var price = unitPrice(p, 0);
    if (!(price > 0)) return;
    var line = null, idx = -1;
    state.cart.i.forEach(function (l, i) { if (l.id === id && l.g === 0) { line = l; idx = i; } });
    if (delta > 0) {
      if (line) {
        if (line.q >= maxQty(p, 0)) { haptic('error'); return; }
        line.q++; line.pr = price;
      } else {
        state.cart.i.push({ id: id, g: 0, q: 1, pr: price });
      }
      track('add', id, price);
    } else if (line) {
      line.q--;
      if (line.q <= 0) state.cart.i.splice(idx, 1);
    } else {
      return;
    }
    saveCart();
    hapticLight();
    afterCartChange(delta > 0);
  }

  /** Корзина изменилась: обновляем кнопки карточек, счётчик внизу и (если открыта) саму корзину. */
  function afterCartChange(bump) {
    refreshActs();
    updateChrome();
    if (state.view === 'cart') renderPage();
    if (bump) {
      var count = document.getElementById('cartCount');
      if (count) { count.classList.remove('is-bump'); void count.offsetWidth; count.classList.add('is-bump'); }
    }
  }

  function haptic(kind) {
    if (!inTelegram) return;
    try { tg.HapticFeedback.notificationOccurred(kind); } catch (e) { /* нет вибрации */ }
  }
  function hapticLight() {
    if (!inTelegram) return;
    try { tg.HapticFeedback.impactOccurred('light'); } catch (e) { /* нет вибрации */ }
  }
  function hapticSelect() {
    if (!inTelegram) return;
    try { tg.HapticFeedback.selectionChanged(); } catch (e) { /* нет вибрации */ }
  }

  /** Короткое сообщение внизу экрана. С action — кнопка справа («Відкрити», «Повернути»). */
  var toastTimer, toastAction = null;
  function toast(text, actionLabel, action) {
    clearTimeout(toastTimer);
    el.toastText.textContent = text;
    toastAction = action || null;
    el.toastBtn.hidden = !action;
    el.toastBtn.textContent = actionLabel || '';
    el.toast.hidden = false;
    el.toast.classList.remove('is-in'); void el.toast.offsetWidth; el.toast.classList.add('is-in');
    toastTimer = setTimeout(function () { el.toast.hidden = true; toastAction = null; }, action ? 4200 : 1800);
  }

  /* --------------------- Экраны и нижняя кнопка --------------------- */
  var TABS = [['catalog', 'home', 'navHome'], ['fav', 'heart', 'navFav'], ['cart', 'shopping-cart', 'navCart'], ['orders', 'user', 'navMe']];
  var TAB_VIEWS = { catalog: 1, fav: 1, cart: 1, orders: 1 };
  var typing = false; // открыта клавиатура: нижнюю навигацию прячем, чтобы она не закрывала поле

  function renderTabbar() {
    var n = cartCount(), total = cartTotal();
    el.tabbar.innerHTML = TABS.map(function (tab) {
      var badge = '';
      if (tab[0] === 'cart' && n) badge = '<span class="tabbar__count" id="cartCount">' + (n > 99 ? '99+' : n) + '</span>';
      if (tab[0] === 'fav' && favs.length) badge = '<span class="tabbar__dot"></span>';
      var label = tab[0] === 'cart' && total > 0 ? money(total) : esc(t(tab[2]));
      return '<button type="button" data-go="' + tab[0] + '"' + (state.view === tab[0] ? ' aria-current="page"' : '') +
        (tab[0] === 'cart' ? ' aria-label="' + esc(t('cart') + (n ? ': ' + n : '')) + '"' : '') + '>' +
        '<span class="tabbar__ico">' + icon(tab[1]) + badge + '</span><span class="tabbar__label">' + label + '</span></button>';
    }).join('');
  }

  /** Плавное появление экрана при переходе. */
  function animateView(node) {
    node.classList.remove('is-in');
    void node.offsetWidth;
    node.classList.add('is-in');
  }

  /** В форме заказа Telegram переспрашивает перед закрытием: введённые данные жалко терять. */
  function confirmClose(on) {
    if (!inTelegram) return;
    try { if (on) tg.enableClosingConfirmation(); else tg.disableClosingConfirmation(); } catch (e) { /* старый клиент Telegram */ }
  }

  function go(view) {
    if (state.view === 'catalog') state.scrollY = window.scrollY || 0;
    if (state.view === 'cart' && view !== 'cart') { ackPriceChanges(); state.cartNotice = ''; state.cartNoticeInfo = false; }
    if (view === 'checkout' && !(cartTotal() > 0)) view = 'cart';
    if (state.sheet) closeSheet();
    var changed = state.view !== view;
    state.view = view;
    document.body.setAttribute('data-view', view);
    if (view === 'catalog') renderMain();
    renderPage();
    updateChrome();
    if (view === 'admin') loadAdmin(false);
    if (view === 'orders') loadMyOrders();
    if (changed) {
      if (view === 'cart' && cartCount()) track('cart', '', cartTotal());
      if (view === 'checkout') track('checkout', '', cartTotal());
      animateView(view === 'catalog' ? el.main : el.page);
    }
    confirmClose(view === 'checkout');
    swipes(view !== 'checkout');
    window.scrollTo(0, view === 'catalog' ? state.scrollY : 0);
  }

  function goBack() {
    if (state.sheet) { closeSheet(); return; }
    if (state.view === 'checkout') { readForm(); go('cart'); return; }
    if (state.view === 'admin' && (adm.edit || adm.catEdit || adm.salesOpen || adm.admEdit || adm.logOpen)) {
      var reload = !!adm.invite;
      adm.edit = ''; adm.catEdit = ''; adm.salesOpen = false; adm.admEdit = ''; adm.invite = null; adm.logOpen = false;
      renderPage();
      if (reload) loadAdmin(false);
      return;
    }
    if (state.view !== 'catalog') go('catalog');
  }

  /** Что сейчас делает главная кнопка: null — кнопки нет. */
  function mainSpec() {
    var total = cartTotal();
    if (state.sheet || !(total > 0)) return null;
    if (state.view === 'checkout') return { text: t('confirmBtn') + ' · ' + money(total), run: submitOrder };
    if (state.view === 'cart') return { text: t('checkoutBtn') + ' · ' + money(total), run: function () {
      var min = Number(shopInfo().min) || 0;
      if (min > 0 && cartTotal() < min) { state.cartNoticeInfo = false; state.cartNotice = t('minOrder') + ' ' + money(min); renderPage(); window.scrollTo(0, 0); haptic('error'); return; }
      go('checkout');
    } };
    return null; // в каталоге и избранном корзина всегда под рукой в нижней навигации
  }

  function mainAction() {
    var spec = mainSpec();
    if (spec) spec.run();
  }

  function updateChrome() {
    renderTabbar();
    var tabs = !!TAB_VIEWS[state.view] && !typing;
    el.tabbar.hidden = !tabs;
    document.body.classList.toggle('has-tabbar', tabs);

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

  /** Заголовок экрана. plain — без стрелки «назад» (экраны из нижней навигации). */
  function pageHead(title, plain) {
    if (plain) return '<header class="page__head page__head--plain"><h2 class="page__title">' + esc(title) + '</h2></header>';
    return '<header class="page__head"><button type="button" class="iconbtn" data-nav="back" aria-label="' + esc(t('back')) + '">' +
      icon('arrow-left') + '</button><h2 class="page__title">' + esc(title) + '</h2></header>';
  }

  function renderPage() {
    if (state.view === 'cart') el.page.innerHTML = cartHtml();
    else if (state.view === 'checkout') { el.page.innerHTML = checkoutHtml(); syncCheckout(); }
    else if (state.view === 'done') el.page.innerHTML = doneHtml();
    else if (state.view === 'admin') { el.page.innerHTML = adminHtml(); lockAdminForm(); }
    else if (state.view === 'orders') el.page.innerHTML = profileHtml();
    else if (state.view === 'fav') el.page.innerHTML = favHtml();
    else el.page.innerHTML = '';
  }

  /* ------------------------------ Экран корзины ------------------------------ */
  function lineLabel(l, info) {
    var p = info.p || product(l.id);
    if (l.g) return weight(l.g);
    if (p && p.t === 'p' && p.pk) return p.pk.replace(/ /g, NBSP);
    return '1' + NBSP + t('pcs');
  }

  function favHtml() {
    var html = pageHead(t('favTitle'), true);
    if (!state.catalog) return html + skeletonHtml();
    var list = favs.map(product).filter(Boolean);
    if (!list.length) {
      return html + '<div class="state"><span class="state__ico">' + icon('heart') + '</span>' +
        '<p class="state__title">' + esc(t('favEmptyTitle')) + '</p><p class="state__text">' + esc(t('favEmpty')) + '</p>' +
        '<button type="button" class="btn btn--primary" data-nav="catalog">' + esc(t('toCatalog')) + '</button></div>';
    }
    return html + '<div class="grid">' + list.map(cardHtml).join('') + '</div>';
  }

  function progressHtml(share, text, ico) {
    return '<div class="prog"><p class="prog__text">' + icon(ico) + '<span>' + esc(text) + '</span></p>' +
      '<div class="prog__bar"><span style="width:' + Math.max(4, Math.min(100, Math.round(share * 100))) + '%"></span></div></div>';
  }

  /** Сколько осталось до минимальной суммы и до подарка (если они заданы в настройках). */
  function cartPerksHtml() {
    var total = cartTotal(), s = shopInfo(), html = '';
    var min = Number(s.min) || 0;
    if (min > 0 && total > 0 && total < min) html += progressHtml(total / min, tf('minLeft', { n: money(min - total) }), 'box');
    if (s.gift && total > 0) {
      var g = state.lang === 'ru' ? s.gift.ru : s.gift.ua;
      html += total >= s.gift.from
        ? '<p class="note note--gift">' + icon('gift') + '<span>' + esc(tf('giftOk', { g: g })) + '</span></p>'
        : progressHtml(total / s.gift.from, tf('giftLeft', { n: money(s.gift.from - total), g: g }), 'gift');
    }
    return html;
  }

  /** «Додайте до замовлення»: то, что брали вместе с товарами из корзины, затем популярное. */
  function crossSell() {
    if (!state.catalog) return [];
    var inCart = {}, taken = {}, out = [];
    state.cart.i.forEach(function (l) { inCart[l.id] = 1; });
    function push(p) { if (p && p.a && !inCart[p.id] && !taken[p.id]) { taken[p.id] = 1; out.push(p); } }
    state.cart.i.forEach(function (l) {
      var p = product(l.id);
      ((p && p.r) || []).forEach(function (id) { push(product(id)); });
    });
    if (out.length < 6) popular(12).list.forEach(push);
    return out.slice(0, 8);
  }

  function cartHtml() {
    var html = pageHead(t('cart'), true);
    if (state.cartNotice) html += state.cartNoticeInfo
      ? '<p class="note note--opt" role="status">' + esc(state.cartNotice) + '</p>'
      : '<p class="form__err" role="alert">' + esc(state.cartNotice) + '</p>';
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
    html += cartPerksHtml();
    html += '<div class="sum"><span>' + esc(t('total')) + '</span><span class="total">' + money(cartTotal()) + '</span></div>';
    html += railHtml(t('cartMore'), '', crossSell(), true);
    html += '<button type="button" class="btn btn--ghost btn--block" data-action="clear-cart">' + icon('trash-2') + esc(t('clearCart')) + '</button>';
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

    var gift = shop.gift && cartTotal() >= shop.gift.from
      ? '<p class="note note--gift">' + icon('gift') + '<span>' + esc(tf('giftOk', { g: shop.gift[L] || shop.gift.ua })) + '</span></p>' : '';
    return pageHead(t('checkout')) +
      '<div class="cosum"><div><p class="cosum__n">' + esc(tf('coItems', { n: cartCount() })) + '</p><p class="total js-sum">' + money(cartTotal()) + '</p></div>' +
      '<button type="button" class="btn" data-nav="back">' + esc(t('edit')) + '</button></div>' + gift +
      '<form class="form" id="form" novalidate>' +
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

      '<div class="sum"><span>' + esc(t('total')) + '</span><span class="total js-sum">' + money(cartTotal()) + '</span></div>' +
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
    Array.prototype.forEach.call(el.page.querySelectorAll('.js-sum'), function (sum) { sum.textContent = money(cartTotal()); });
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
      state.done = { number: res.number || '', stub: !!res.stub, test: DEBUG && !res.stub, lines: lines, total: total, delivery: state.form.delivery, pay: state.form.pay,
        gifts: Array.isArray(res.gifts) ? res.gifts : [] };
      if (!res.stub) { store.set(HASORD_KEY, '1'); my.list = null; }
      track('order', res.number || '', total);
      flushEvents(false);
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
        state.cartNoticeInfo = false; state.cartNotice = t('cartChanged');
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
    (d.gifts || []).forEach(function (g) {
      html += '<p class="note note--gift">' + icon('gift') + '<span>' + esc(tf('doneGift', { g: g })) + '</span></p>';
    });
    if (d.stub) html += '<p class="note note--out">' + esc(t('doneStub')) + '</p>';
    else if (d.test) html += '<p class="note note--opt">' + esc(t('doneTest')) + '</p>';
    html += '<div class="recap"><p class="label">' + esc(t('order')) + '</p><ul class="recap__list">';
    d.lines.forEach(function (l) {
      html += '<li><span>' + esc(l.name) + ', ' + l.label + ' × ' + l.q + '</span><span class="recap__sum">' + money(l.sum) + '</span></li>';
    });
    html += '</ul><p class="recap__meta">' + esc(t('delivery')) + ': ' + esc(t(d.delivery === 'np' ? 'np' : 'pickup')) + '<br>' +
      esc(t('payment')) + ': ' + esc(t({ cash: 'payCash', card: 'payCard', cod: 'payCod' }[d.pay])) + '</p>' +
      '<div class="sum"><span>' + esc(t('total')) + '</span><span class="total">' + money(d.total) + '</span></div></div>' +
      '<button type="button" class="btn btn--primary btn--block" data-nav="catalog">' + esc(t('doneBack')) + '</button>' +
      (inTelegram && !d.stub ? '<button type="button" class="btn btn--block" data-go="orders">' + esc(t('myOrders')) + '</button>' : '');
    return html;
  }

  /* ------------------------------ Мои заказы (этап 6) ------------------------------ */
  var my = { list: null, loading: false, error: '', bought: [], done: null };

  function postApi(action, data) {
    var body = { action: action, initData: inTelegram ? tg.initData : '' };
    Object.keys(data || {}).forEach(function (k) { body[k] = data[k]; });
    return fetch(cfg.API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
  }

  /** quiet — фоновая загрузка при старте: нужна для подборки «Купити знову» и программы для постоянных клиентов. */
  function loadMyOrders(quiet) {
    if (!cfg.API_URL || !inTelegram) { my.error = 'myTg'; if (!quiet) renderPage(); return; }
    if (my.loading) return;
    my.loading = true; my.error = '';
    if (!quiet) renderPage();
    postApi('orders.my').then(function (res) {
      my.loading = false;
      if (!res || !res.ok) throw new Error('fail');
      my.list = res.orders || [];
      my.done = typeof res.done === 'number' ? res.done : null;
      var bought = [];
      my.list.forEach(function (o) {
        (o.i || []).forEach(function (it) { var id = String(it[0]); if (bought.indexOf(id) < 0) bought.push(id); });
      });
      var had = my.bought.join();
      my.bought = bought.slice(0, 12);
      store.set(HASORD_KEY, my.list.length ? '1' : '0');
      if (state.view === 'orders') renderPage();
      // Подборка «Купити знову» появляется на главной, если человек ещё не начал её листать.
      else if (state.view === 'catalog' && !state.sheet && state.status === 'ready' && isHome() && my.bought.join() !== had && (window.scrollY || 0) < 200) renderMain();
    }).catch(function () {
      my.loading = false; my.error = 'myErr';
      if (state.view === 'orders') renderPage();
    });
  }

  /** Программа для постоянных клиентов: подарок к каждому N-му выполненному заказу (если задана в настройках). */
  function loyaltyHtml() {
    var loyal = shopInfo().loyal;
    if (!loyal) return '';
    var g = state.lang === 'ru' ? loyal.ru : loyal.ua;
    var html = '<div class="loyal"><p class="loyal__title">' + icon('gift') + '<span>' + esc(t('loyalTitle')) + '</span></p>' +
      '<p class="loyal__text">' + esc(tf('loyalText', { k: loyal.every, g: g })) + '</p>';
    if (typeof my.done === 'number') {
      var pos = my.done % loyal.every;            // сколько выполнено в текущем круге
      var left = loyal.every - 1 - pos;           // сколько ещё заказов до заказа с подарком
      var dots = '';
      for (var i = 0; i < loyal.every; i++) dots += '<span class="loyal__dot' + (i < pos ? ' is-on' : '') + (i === loyal.every - 1 ? ' is-gift' : '') + '"></span>';
      html += '<div class="loyal__dots" aria-hidden="true">' + dots + '</div>' +
        '<p class="loyal__left">' + esc(left === 0 ? t('loyalNext') : tf('loyalLeft', { a: my.done, b: left })) + '</p>';
    }
    return html + '</div>';
  }

  function canAddToHome() {
    try { return inTelegram && typeof tg.addToHomeScreen === 'function' && tg.isVersionAtLeast('8.0'); } catch (e) { return false; }
  }

  function profileHtml() {
    var shop = shopInfo();
    var L = state.lang === 'ru' ? 'ru' : 'ua';
    var html = pageHead(t('navMe'), true) + loyaltyHtml() +
      '<h3 class="sec">' + esc(t('myOrders')) + '</h3>' + myOrdersHtml();
    var addr = shop.address ? (shop.address[L] || shop.address.ua || '') : '';
    var hours = shop.hours ? (shop.hours[L] || shop.hours.ua || '') : '';
    if (addr || hours) {
      html += '<h3 class="sec">' + esc(t('meShop')) + '</h3><div class="facts facts--card">' +
        (addr ? '<p>' + icon('pin') + '<span>' + esc(addr) + '</span></p>' : '') +
        (hours ? '<p>' + icon('clock') + '<span>' + esc(hours) + '</span></p>' : '') + '</div>';
    }
    html += '<div class="merow"><span class="label">' + esc(t('meLang')) + '</span><div class="lang" role="group">' +
      '<button type="button" data-lang="ua" aria-pressed="' + (state.lang === 'ua') + '">UA</button>' +
      '<button type="button" data-lang="ru" aria-pressed="' + (state.lang === 'ru') + '">RU</button></div></div>';
    if (canAddToHome()) html += '<button type="button" class="btn btn--block" data-action="home-screen">' + icon('phone') + esc(t('meHome')) + '</button>';
    return html;
  }

  function myOrdersHtml() {
    var html = '';
    if (my.loading && !my.list) return html + '<div class="skeleton skeleton--row"></div><div class="skeleton skeleton--row"></div>';
    if (my.error && !my.list) {
      return html + '<p class="state__text adm__msg">' + esc(t(my.error)) + '</p>' +
        (my.error === 'myTg' ? '' : '<button type="button" class="btn btn--block" data-action="my-refresh">' + esc(t('myRefresh')) + '</button>');
    }
    if (!my.list || !my.list.length) {
      return html + '<div class="state state--sm">' + MARK + '<p class="state__title">' + esc(t('myEmpty')) + '</p><p class="state__text">' + esc(t('myEmptyText')) + '</p>' +
        '<button type="button" class="btn btn--primary" data-nav="catalog">' + esc(t('toCatalog')) + '</button></div>';
    }
    html += '<ul class="lines">' + my.list.map(function (o) {
      var items = String(o.items).split('; ').filter(Boolean).map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('');
      return '<li class="my"><div class="my__head"><span class="ord__num">' + esc(o.num) + '</span>' +
        '<span class="badge ' + (STATUS_BADGE[o.status] || '') + '">' + esc(t('ost_' + o.status) === 'ost_' + o.status ? o.status : t('ost_' + o.status)) + '</span>' +
        '<span class="my__date">' + esc(o.date) + '</span></div>' +
        '<ul class="my__items">' + items + '</ul>' +
        '<div class="my__foot"><span class="total">' + money(o.total) + '</span>' +
        (o.i ? '<button type="button" class="btn btn--soft" data-repeat="' + esc(o.num) + '">' + icon('rotate') + esc(t('repeat')) + '</button>'
             : '<span class="my__old">' + esc(t('repeatOld')) + '</span>') + '</div></li>';
    }).join('') + '</ul>' +
      '<button type="button" class="btn btn--block" data-action="my-refresh">' + esc(t('myRefresh')) + '</button>';
    return html;
  }

  /** «Повторить заказ»: кладём в корзину то, что сейчас можно купить по тем же фасовкам. */
  function repeatOrder(num) {
    var order = null;
    (my.list || []).forEach(function (o) { if (o.num === num) order = o; });
    if (!order || !order.i) return;
    var added = 0;
    order.i.forEach(function (it) {
      var id = String(it[0]), g = Number(it[1]) || 0, q = Math.max(1, Math.min(MAX_QTY, Math.floor(Number(it[2])) || 1));
      var p = product(id);
      var price = unitPrice(p, g);
      if (!(price > 0)) return;
      var line = null;
      state.cart.i.forEach(function (l) { if (l.id === id && l.g === g) line = l; });
      if (line) { line.q = Math.min(MAX_QTY, line.q + q); line.pr = price; }
      else state.cart.i.push({ id: id, g: g, q: q, pr: price });
      added++;
    });
    if (!added) { toast(t('repeatNone')); haptic('error'); return; }
    track('repeat', num, added);
    saveCart();
    haptic('success');
    state.cartNotice = added < order.i.length ? t('repeatPart').replace('{a}', added).replace('{b}', order.i.length) : t('repeatOk');
    renderMain();
    go('cart');
    state.cartNoticeInfo = true; // это подсказка, а не ошибка
    renderPage();
  }

  /* ------------------------------ Админ-панель (этап 5) ------------------------------ */
  /* Вход: команда /admin у бота (ссылка с ?admin=1). Права проверяет сервер при каждом запросе. */
  var ADMIN_KEY = 'pamir_admin';
  var adminHint = inTelegram && (params.get('admin') === '1' || store.get(ADMIN_KEY) === '1');
  var ADMIN_STATUSES = ['новий', 'підтверджено', 'відправлено', 'виконано', 'немає в наявності'];
  var STATUS_BADGE = { 'новий': 'badge--opt', 'підтверджено': 'badge--stock', 'відправлено': 'badge--ship', 'немає в наявності': 'badge--out', 'скасовано': 'badge--out' };
  var STATUS_BTNS = [['c', 'stC', 'підтверджено'], ['n', 'stN', 'немає в наявності'], ['s', 'stS', 'відправлено'], ['d', 'stD', 'виконано']];
  var ADMIN_TABS = [['orders', 'admOrders'], ['products', 'admProducts'], ['cats', 'admCats', 'cats'], ['settings', 'admSettings', 'settings'], ['admins', 'admAdmins', 'admins']];
  /** Какое право нужно, чтобы менять поле товара (то же самое проверяет сервер). */
  var PATCH_PERM = { stock: 'stock', qty: 'stock', hidden: 'stock', ua: 'text', ru: 'text', dUa: 'text', dRu: 'text', cat: 'text',
    price: 'price', old: 'price', badge: 'price', end: 'price', wh: 'price', wm: 'price', packs: 'price', t: 'price' };
  var CAT_ICONS = ['nut', 'cherry', 'candy', 'flame', 'leaf', 'coffee'];
  var adm = { tab: 'orders', orders: null, stats: null, filter: '', q: '', open: '', products: null, cats: null, pq: '',
    edit: '', catEdit: '', settings: null, loading: false, error: '', busy: false, sales: null, salesOpen: false,
    me: null, admins: null, invites: null, permList: null, admEdit: '', invite: null, logOpen: false, log: null };

  /** Есть ли у меня право. Пока сервер не прислал роль (или бэкенд ещё старый) — показываем всё: решает всё равно сервер. */
  function can(perm) { return !adm.me || adm.me.perms.indexOf(perm) >= 0; }
  function adminTabs() {
    return ADMIN_TABS.filter(function (tab) { return tab[0] === 'admins' ? !!adm.me && can('admins') : !tab[2] || can(tab[2]); });
  }
  function myId() { try { return String(tg.initDataUnsafe.user.id); } catch (e) { return ''; } }

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
    var kind = adm.tab === 'orders' ? 'orders' : adm.tab === 'settings' ? 'settings' : adm.tab === 'admins' ? 'admins' : 'products';
    var have = kind === 'orders' ? adm.orders : kind === 'settings' ? adm.settings : kind === 'admins' ? adm.admins : adm.products;
    if (adm.loading || (!force && have)) return;
    adm.loading = true; adm.error = '';
    renderAdminList();
    api('admin.' + kind).then(function (res) {
      adm.loading = false;
      if (!res || !res.ok) {
        adm.error = res && res.error === 'forbidden' ? 'admForbidden' : res && res.error === 'no_perm' ? 'admNoPerm' : 'admError';
        if (res && res.error === 'forbidden') { store.set(ADMIN_KEY, '0'); adminHint = false; el.adminBtn.hidden = true; }
      } else {
        store.set(ADMIN_KEY, '1');
        if (res.me) adm.me = res.me;
        if (kind === 'orders') { adm.orders = res.orders || []; adm.stats = res.stats || null; }
        else if (kind === 'settings') adm.settings = res.fields || [];
        else if (kind === 'admins') { adm.admins = res.admins || []; adm.invites = res.invites || []; adm.permList = res.permList || []; }
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
    if (adm.salesOpen) return html + salesHtml();
    if (adm.logOpen) return html + logHtml();
    if (adm.admEdit) return html + adminFormHtml();
    if (!adminTabs().some(function (tab) { return tab[0] === adm.tab; })) adm.tab = 'orders';
    html += '<div class="tabs" role="group">' + adminTabs().map(function (tab) {
      return '<button type="button" data-tab="' + tab[0] + '" aria-pressed="' + (adm.tab === tab[0]) + '">' + esc(t(tab[1])) + '</button>';
    }).join('') + '</div>';
    if (adm.tab === 'orders') {
      if (adm.stats) {
        html += '<div class="stats"><div><span>' + esc(t('admToday')) + '</span><b>' + adm.stats.today.n + ' · ' + money(adm.stats.today.sum) + '</b></div>' +
          '<div><span>' + esc(t('admWeek')) + '</span><b>' + adm.stats.week.n + ' · ' + money(adm.stats.week.sum) + '</b></div></div>' +
          '<button type="button" class="btn btn--block" data-action="adm-sales">' + esc(t('admStats')) + '</button>';
      }
      html += '<input class="input" id="admQ" type="search" autocomplete="off" placeholder="' + esc(t('admSearchO')) + '" value="' + esc(adm.q) + '">' +
        '<div class="chips chips--flush" id="admFilter">' + [''].concat(ADMIN_STATUSES).map(function (s) {
          return '<button type="button" class="chip" data-filter="' + esc(s) + '" aria-pressed="' + (adm.filter === s) + '">' + esc(s || t('admAll')) + '</button>';
        }).join('') + '</div>';
    } else if (adm.tab === 'products') {
      html += (can('text') && can('price') && can('stock') ? '<button type="button" class="btn btn--primary btn--block" data-edit="+">' + icon('plus') + esc(t('admAdd')) + '</button>' : '') +
        '<input class="input" id="admPQ" type="search" autocomplete="off" placeholder="' + esc(t('admSearchP')) + '" value="' + esc(adm.pq) + '">';
    } else if (adm.tab === 'cats') {
      html += '<button type="button" class="btn btn--primary btn--block" data-cat="+">' + icon('plus') + esc(t('admAddCat')) + '</button>';
    } else if (adm.tab === 'admins') {
      html += '<button type="button" class="btn btn--primary btn--block" data-adm="+">' + icon('plus') + esc(t('admAddAdmin')) + '</button>' +
        '<button type="button" class="btn btn--block" data-action="adm-log">' + esc(t('admLog')) + '</button>';
    }
    return html + '<div id="admList">' + adminListHtml() + '</div>' +
      (adm.tab === 'settings' ? '' : '<button type="button" class="btn btn--block" data-action="adm-refresh">' + esc(t('admRefresh')) + '</button>');
  }

  /* ---- Статистика продаж ---- */
  function loadSales() {
    adm.salesOpen = true; adm.salesErr = false; adm.salesLoading = true;
    renderPage(); window.scrollTo(0, 0);
    api('admin.stats').then(function (res) {
      adm.salesLoading = false;
      if (!res || !res.ok) throw new Error('fail');
      adm.sales = res;
      if (adm.salesOpen) renderPage();
    }).catch(function () { adm.salesLoading = false; adm.salesErr = true; if (adm.salesOpen) renderPage(); });
  }

  function salesHtml() {
    var html = '<p class="label">' + esc(t('admStats')) + '</p>';
    var s = adm.sales;
    if (!s) {
      return html + (adm.salesErr
        ? '<p class="state__text adm__msg">' + esc(t('admError')) + '</p><button type="button" class="btn btn--block" data-action="adm-sales">' + esc(t('admRefresh')) + '</button>'
        : '<div class="skeleton skeleton--row"></div>');
    }
    html += '<div class="stats"><div><span>' + esc(t('admStats30')) + '</span><b>' + s.m30.n + ' · ' + money(s.m30.sum) + '</b></div>' +
      '<div><span>' + esc(t('admStatsAll')) + '</span><b>' + s.all.n + ' · ' + money(s.all.sum) + '</b></div></div>';
    html += behaviorHtml(s);
    if (!s.all.n) return html + '<p class="state__text adm__msg">' + esc(t('admStatsEmpty')) + '</p>';
    if (s.products.length) {
      html += '<p class="label">' + esc(t('admStatsTop')) + '</p><ul class="rows">' + s.products.map(function (p) {
        var amount = p.kg > 0 ? String(p.kg).replace('.', ',') + NBSP + 'кг' : p.q + NBSP + t('pcs');
        return '<li><span class="rows__name">' + esc(p.name) + '</span><span class="rows__sub">' + amount + '</span><b>' + money(p.sum) + '</b></li>';
      }).join('') + '</ul>';
    }
    html += '<p class="label">' + esc(t('admStatsDays')) + '</p><ul class="rows">' + s.days.map(function (d) {
      return '<li><span class="rows__name">' + esc(d.d.split('-').reverse().join('.')) + '</span><span class="rows__sub">' + d.n + NBSP + esc(t('admStatsOrd')) + '</span><b>' + money(d.sum) + '</b></li>';
    }).join('') + '</ul>';
    return html + '<p class="info info__muted">' + esc(t('admStatsSheet')) + '</p>' +
      '<button type="button" class="btn btn--block" data-action="adm-sales">' + esc(t('admRefresh')) + (adm.salesLoading ? '…' : '') + '</button>';
  }

  /** Средний чек, повторные покупки и воронка: что люди делают в магазине до заказа. */
  function behaviorHtml(s) {
    var html = '';
    if (s.kpi) {
      html += '<div class="stats"><div><span>' + esc(t('admKpi')) + ' · ' + esc(t('admStats30')) + '</span><b>' + money(s.kpi.aov30) + '</b></div>' +
        '<div><span>' + esc(t('admRepeat')) + '</span><b>' + s.kpi.repeat + ' ' + esc(t('admOf')) + ' ' + s.kpi.buyers + ' · ' + s.kpi.repeatPct + '%</b></div></div>';
    }
    var f = s.funnel;
    if (!f) return html + (s.kpi ? '<p class="info info__muted">' + esc(t('admNoEvents')) + '</p>' : '');
    var steps = [['fOpen', f.open], ['fView', f.view], ['fAdd', f.add], ['fCheckout', f.checkout], ['fOrder', f.order]];
    html += '<p class="label">' + esc(t('admFunnel')) + '</p><ul class="funnel">' + steps.map(function (st) {
      var share = f.open ? Math.min(100, Math.round(st[1] * 100 / f.open)) : 0;
      return '<li><span class="funnel__name">' + esc(t(st[0])) + '</span><b>' + st[1] + '</b><span class="funnel__pct">' + share + '%</span>' +
        '<span class="funnel__bar"><span style="width:' + Math.max(2, share) + '%"></span></span></li>';
    }).join('') + '</ul>' + (f.open >= f.order && f.open > 0 // пока событий меньше, чем заказов, процент был бы бессмысленным
      ? '<p class="info info__muted">' + esc(t('admCr')) + ': ' + String(f.cr).replace('.', ',') + '%</p>' : '');
    if (f.zero && f.zero.length) {
      html += '<p class="label">' + esc(t('admZero')) + '</p><ul class="rows">' + f.zero.map(function (z) {
        return '<li><span class="rows__name">' + esc(z.q) + '</span><span class="rows__sub"></span><b>' + z.n + '</b></li>';
      }).join('') + '</ul>';
    }
    if (f.viewed && f.viewed.length) {
      html += '<p class="label">' + esc(t('admViewed')) + '</p><ul class="rows">' + f.viewed.map(function (v) {
        return '<li><span class="rows__name">' + esc(v.name) + '</span><span class="rows__sub"></span><b>' + v.n + '</b></li>';
      }).join('') + '</ul>';
    }
    return html;
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
    if (adm.tab === 'admins') return adminsHtml();
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
          (can('st') ? '<div class="ord__acts">' + STATUS_BTNS.map(function (b) {
            return '<button type="button" class="btn' + (o.status === b[2] ? ' btn--soft' : '') + '" data-st="' + b[0] + '" data-num="' + esc(o.num) + '"' +
              (o.status === b[2] || adm.busy ? ' disabled' : '') + '>' + esc(t(b[1])) + '</button>';
          }).join('') + '</div>' : '') +
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
        '<button type="button" class="sw" role="switch" aria-checked="' + (p.stock ? 'true' : 'false') + '" data-stock="' + esc(p.id) + '" aria-label="' + esc(t('admStock')) + '"' + (can('stock') ? '' : ' disabled') + '><span></span></button></li>';
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
      ? { id: '', cat: adm.cats && adm.cats[0] ? adm.cats[0].ua : '', t: 'w', ua: '', ru: '', packs: '100 г / 250 г / 500 г / 1 кг', price: '', stock: 1, hidden: 0, img: '', dUa: '', dRu: '', wh: '', wm: '', badge: '', old: '', qty: '', end: '' }
      : adminProduct(adm.edit);
    if (!p) return '';
    var cats = (adm.cats || []).map(function (c) { return [c.ua, c.ua]; });
    if (p.cat && !cats.some(function (c) { return c[0] === p.cat; })) cats.unshift([p.cat, p.cat]);
    var photo = isNew
      ? '<p class="info info__muted">' + esc(t('admPhotoLater')) + '</p>'
      : '<div class="photo"><div class="photo__box">' + (p.img ? '<img src="' + esc(p.img) + '" alt="" referrerpolicy="no-referrer">' : MARK) + '</div>' +
        '<div class="photo__acts">' + (can('photo') ? '<label class="btn btn--block">' + esc(t(p.img ? 'admPhotoChange' : 'admPhotoPick')) +
        '<input type="file" id="a-photo" accept="image/*" hidden></label>' +
        (p.img ? '<button type="button" class="btn btn--block" data-action="adm-photo-del">' + esc(t('admPhotoDel')) + '</button>' : '') : '') +
        '<p class="field__hint" id="photoMsg"></p></div></div>';
    var lockedNote = Object.keys(PATCH_PERM).some(function (k) { return !can(PATCH_PERM[k]); }) ? '<p class="info info__muted">' + esc(t('admLocked')) + '</p>' : '';
    return '<form class="form" id="admForm" novalidate><p class="label">' + esc(isNew ? t('admNew') : p.id) + '</p>' + FORM_ERR + lockedNote + photo +
      fSelect('cat', t('admCat'), p.cat, cats) +
      fSelect('t', t('admType'), p.t, [['w', t('admTypeW')], ['p', t('admTypeP')], ['u', t('admTypeU')]]) +
      fRow('ua', t('admNameUa'), p.ua, 'type="text" maxlength="120"') +
      fRow('ru', t('admNameRu'), p.ru, 'type="text" maxlength="120"') +
      fRow('price', t('admPrice'), p.price || '', 'type="text" inputmode="decimal" maxlength="9"', t('admPriceHint')) +
      fRow('old', t('admOld'), p.old || '', 'type="text" inputmode="decimal" maxlength="9"', t('admOldHint')) +
      fRow('end', t('admEnd'), p.end || '', 'type="date"', t('admEndHint')) +
      fSelect('badge', t('admBadge'), p.badge || '', [['', t('admBadgeNone')], ['new', t('badgeNew')], ['hit', t('badgeHit')], ['sale', t('badgeSale')], ['set', t('badgeSet')]]) +
      fRow('qty', t('admQty'), p.qty === undefined || p.qty === null ? '' : p.qty, 'type="text" inputmode="decimal" maxlength="8"', t('admQtyHint')) +
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
      price: fNum('price'), wh: fNum('wh'), old: fNum('old'), badge: fVal('badge'), stock: fOn('stock') ? 1 : 0, hidden: fOn('hidden') ? 1 : 0,
      qty: fVal('qty').replace(/\s/g, ''), end: fVal('end') };
    if (next.qty && !/^\d+([.,]\d+)?$/.test(next.qty)) { fErr('admErrPrice'); return; }
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
    Object.keys(next).forEach(function (k) {
      if ((k === 'qty' || k === 'end') && p[k] === undefined) return; // бэкенд ещё не обновлён и этих полей не знает
      if (next[k] !== (p[k] || (typeof next[k] === 'number' ? 0 : ''))) patch[k] = next[k];
    });
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
      if (res && res.error === 'no_perm') { toast(t('admNoPerm')); done(false); return; }
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

  /* ---- Админы и журнал (этап 8) ---- */
  function roleLabel(r) { return t(r === 'owner' ? 'admRoleOwner' : r === 'admin' ? 'admRoleAdmin' : 'admRoleManager'); }
  function adminTitle(a) { return (a.name || 'id ' + a.id) + (a.username ? ' · ' + a.username : ''); }
  function permNames(a) {
    if (a.role !== 'manager') return t('admAllPerms');
    var names = (adm.permList || []).filter(function (p) { return a.perms.indexOf(p[0]) >= 0; }).map(function (p) { return p[1]; });
    return names.length ? names.join(', ') : t('admViewOnly');
  }
  function adminEntry(id) {
    var found = null;
    (adm.admins || []).forEach(function (a) { if (a.id === id) found = a; });
    return found;
  }

  function adminsHtml() {
    var list = adm.admins || [];
    var html = '<ul class="lines">' + list.map(function (a) {
      var mine = a.id === myId();
      var inner = '<span class="prod__name">' + esc(adminTitle(a)) + '</span><span class="prod__sub">' + esc(roleLabel(a.role)) +
        (mine ? ' · ' + esc(t('admYou')) : '') + (a.active ? '' : ' · ' + esc(t('admOffTag'))) + (a.notify ? '' : ' · ' + esc(t('admNoNotify'))) + '</span>' +
        '<span class="prod__sub">' + esc(permNames(a)) + '</span>';
      return '<li class="prod">' + (a.role === 'owner' || mine ? '<div class="prod__main">' + inner + '</div>'
        : '<button type="button" class="prod__main" data-adm="' + esc(a.id) + '">' + inner + '</button>') + '</li>';
    }).join('') + '</ul>';
    if (adm.invites && adm.invites.length) {
      html += '<p class="label">' + esc(t('admWaiting')) + '</p><ul class="rows">' + adm.invites.map(function (i) {
        return '<li><span class="rows__name">' + esc(i.name || t('admInviteNew')) + '</span><span class="rows__sub">' + esc(roleLabel(i.role)) + '</span><b>' + i.left + NBSP + esc(t('admHours')) + '</b></li>';
      }).join('') + '</ul>';
    }
    return html;
  }

  function adminFormHtml() {
    if (adm.invite) {
      return '<div class="form"><p class="label">' + esc(t('admInviteLink')) + '</p><p class="info">' + esc(t('admInviteHint')) + '</p>' +
        '<input class="input" id="a-link" type="text" readonly value="' + esc(adm.invite) + '">' +
        '<button type="button" class="btn btn--primary btn--block" data-action="adm-link">' + esc(t('admLinkCopy')) + '</button>' +
        '<button type="button" class="btn btn--block" data-action="adm-invite-done">' + esc(t('admInviteDone')) + '</button></div>';
    }
    var isNew = adm.admEdit === '+';
    var a = isNew ? { role: 'manager', perms: [], notify: true, active: true } : adminEntry(adm.admEdit);
    if (!a) return '';
    var roles = [['manager', t('admRoleManager')]];
    if (!adm.me || adm.me.role !== 'manager' || a.role === 'admin') roles.push(['admin', t('admRoleAdmin')]);
    return '<form class="form" id="admForm" novalidate><p class="label">' + esc(isNew ? t('admAddAdmin') : adminTitle(a)) + '</p>' + FORM_ERR +
      fSelect('role', t('admRole'), a.role, roles) +
      '<div id="admPerms"' + (a.role === 'admin' ? ' hidden' : '') + '><p class="label">' + esc(t('admPermsTitle')) + '</p>' +
      '<label class="check"><input type="checkbox" checked disabled><span>' + esc(t('admPermView')) + '</span></label>' +
      (adm.permList || []).map(function (p) {
        return '<label class="check"><input type="checkbox" id="a-p_' + p[0] + '"' + (a.perms.indexOf(p[0]) >= 0 ? ' checked' : '') +
          (can(p[0]) ? '' : ' disabled') + '><span>' + esc(p[1]) + '</span></label>';
      }).join('') + '</div>' +
      fCheck('notify', t('admNotify'), a.notify) + (isNew ? '' : fCheck('active', t('admActive'), a.active)) +
      (isNew ? '<button type="button" class="btn btn--primary btn--block" data-action="adm-invite">' + esc(t('admInviteMake')) + '</button>' : saveBtn()) + '</form>';
  }

  function adminFormValues() {
    return { role: fVal('role') === 'admin' ? 'admin' : 'manager', notify: fOn('notify'),
      perms: (adm.permList || []).map(function (p) { return p[0]; }).filter(function (k) { return fOn('p_' + k); }) };
  }
  function adminFormError(res) {
    fErr(res && res.error === 'no_perm' ? 'admNoPerm' : res && res.error === 'owner_only' ? 'admOwnerOnly' : res && res.error === 'self' ? 'admSelf' : 'admFail');
  }

  function createInvite() {
    if (adm.busy) return;
    adm.busy = true;
    api('admin.adminInvite', adminFormValues()).then(function (res) {
      adm.busy = false;
      if (!res || !res.ok) { adminFormError(res); return; }
      adm.invite = 'https://t.me/' + (cfg.BOT || '') + '?start=' + res.code;
      adm.admins = null; // список ожидающих обновится при возврате
      renderPage(); window.scrollTo(0, 0);
    }).catch(function () { adm.busy = false; fErr('admFail'); });
  }

  function saveAdminForm() {
    var a = adminEntry(adm.admEdit);
    if (!a || adm.busy) return;
    var v = adminFormValues();
    v.id = a.id; v.active = fOn('active');
    adm.busy = true;
    api('admin.adminSave', v).then(function (res) {
      adm.busy = false;
      if (!res || !res.ok) { adminFormError(res); return; }
      adm.admins = res.admins || []; adm.invites = res.invites || [];
      adm.admEdit = '';
      toast(t('admSaved'));
      renderPage(); window.scrollTo(0, 0);
    }).catch(function () { adm.busy = false; fErr('admFail'); });
  }

  function loadLog() {
    adm.logOpen = true; adm.log = null; adm.logErr = false;
    renderPage(); window.scrollTo(0, 0);
    api('admin.log').then(function (res) {
      if (!res || !res.ok) throw new Error('fail');
      adm.log = res.rows || [];
      if (adm.logOpen) renderPage();
    }).catch(function () { adm.logErr = true; if (adm.logOpen) renderPage(); });
  }

  function logHtml() {
    var html = '<p class="label">' + esc(t('admLog')) + '</p>';
    if (adm.logErr) return html + '<p class="form__err">' + esc(t('admError')) + '</p>';
    if (!adm.log) return html + '<div class="skeleton skeleton--row"></div>';
    if (!adm.log.length) return html + '<p class="state__text adm__msg">' + esc(t('admLogEmpty')) + '</p>';
    return html + '<ul class="lines">' + adm.log.map(function (r) {
      return '<li class="logrow"><span class="logrow__meta">' + esc(r.t) + ' · ' + esc(r.who) + '</span>' +
        '<span class="logrow__act">' + esc(r.act) + (r.obj ? ': ' + esc(r.obj) : '') + '</span>' +
        (r.was || r.now ? '<span class="logrow__diff">' + (r.was ? esc(r.was) + ' → ' : '') + esc(r.now) + '</span>' : '') + '</li>';
    }).join('') + '</ul>';
  }

  /** В карточке товара поля, на которые нет прав, становятся серыми. */
  function lockAdminForm() {
    if (!adm.edit || !adm.me) return;
    Object.keys(PATCH_PERM).forEach(function (k) {
      var x = document.getElementById('a-' + k);
      if (x && !can(PATCH_PERM[k])) x.disabled = true;
    });
  }

  /* ---- Настройки магазина ---- */
  function settingsHtml() {
    if (!adm.settings) return '';
    return '<form class="form" id="admForm" novalidate>' + FORM_ERR + adm.settings.map(function (f) {
      if (f.k.indexOf('pay_') === 0) return fCheck(f.k, f.label, /^так$/i.test(f.v));
      if (f.k === 'min_order' || f.k === 'gift_from' || f.k === 'loyal_every' || f.k === 'remind_days') return fRow(f.k, f.label, f.v, 'type="text" inputmode="numeric" maxlength="6"');
      if (/^(gift|loyal)_text_/.test(f.k)) return fRow(f.k, f.label, f.v, 'type="text" maxlength="120"');
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
        if (res && res.error === 'no_perm') { toast(t('admNoPerm')); renderAdminList(); return; }
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
    var am = e.target.closest('[data-adm]');
    if (am) { adm.admEdit = am.getAttribute('data-adm'); adm.invite = null; renderPage(); window.scrollTo(0, 0); return true; }
    var act = e.target.closest('[data-action]');
    var name = act ? act.getAttribute('data-action') : '';
    if (name === 'adm-refresh') { loadAdmin(true); return true; }
    if (name === 'adm-sales') { if (!adm.salesLoading) loadSales(); return true; }
    if (name === 'adm-save') {
      if (adm.edit) saveProductForm(); else if (adm.catEdit) saveCategoryForm(); else if (adm.admEdit) saveAdminForm(); else saveSettingsForm();
      return true;
    }
    if (name === 'adm-invite') { createInvite(); return true; }
    if (name === 'adm-invite-done') { goBack(); return true; }
    if (name === 'adm-log') { loadLog(); return true; }
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
      var goBtn = e.target.closest('[data-go]');
      if (goBtn) { go(goBtn.getAttribute('data-go')); return; }
      var lg = e.target.closest('button[data-lang]');
      if (lg) { setLang(lg.getAttribute('data-lang')); return; }
      if ((state.view === 'fav' || state.view === 'cart') && productClick(e)) return;
      var rep = e.target.closest('[data-repeat]');
      if (rep) { repeatOrder(rep.getAttribute('data-repeat')); return; }
      var myr = e.target.closest('[data-action="my-refresh"]');
      if (myr) { loadMyOrders(); return; }
      var del = e.target.closest('[data-line-del]');
      if (del) {
        var at = Number(del.getAttribute('data-line-del'));
        var gone = state.cart.i.splice(at, 1)[0];
        saveCart(); renderPage(); updateChrome(); refreshActs();
        if (gone) {
          toast(t('removed'), t('undo'), function () { // случайное нажатие на корзину легко отменить
            state.cart.i.splice(Math.min(at, state.cart.i.length), 0, gone);
            saveCart(); refreshActs(); updateChrome();
            if (state.view === 'cart') renderPage();
          });
        }
        return;
      }
      var st = e.target.closest('[data-line-step]');
      if (st && !st.disabled) {
        var line = state.cart.i[Number(st.getAttribute('data-i'))];
        if (line) {
          line.q = Math.min(MAX_QTY, Math.max(1, line.q + Number(st.getAttribute('data-line-step'))));
          saveCart(); renderPage(); updateChrome(); refreshActs(); hapticLight();
        }
        return;
      }
      var act = e.target.closest('[data-action]');
      if (!act) return;
      if (act.getAttribute('data-action') === 'clear-cart') {
        var clear = function (ok) {
          if (!ok) return;
          state.cart.i = [];
          saveCart(); refreshActs(); updateChrome();
          if (state.view === 'cart') renderPage();
          toast(t('cleared'));
        };
        try {
          if (inTelegram && typeof tg.showConfirm === 'function' && tg.isVersionAtLeast('6.2')) tg.showConfirm(t('clearAsk'), clear);
          else clear(window.confirm(t('clearAsk')));
        } catch (err) { clear(window.confirm(t('clearAsk'))); }
        return;
      }
      if (act.getAttribute('data-action') === 'home-screen') {
        try { tg.addToHomeScreen(); } catch (err) { /* старый клиент Telegram */ }
        return;
      }
      if (act.getAttribute('data-action') === 'clear-out') {
        state.cart.i = state.cart.i.filter(function (l) { return lineInfo(l).ok; });
        saveCart(); renderPage(); updateChrome(); refreshActs();
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
      if (e.target.id === 'a-role' && adm.admEdit) { var pb = document.getElementById('admPerms'); if (pb) pb.hidden = e.target.value === 'admin'; return; }
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

    var searchTimer, commitTimer;
    el.search.addEventListener('input', function () {
      clearTimeout(searchTimer);
      clearTimeout(commitTimer);
      el.searchClear.hidden = !el.search.value;
      renderRecent();
      searchTimer = setTimeout(function () {
        state.q = el.search.value;
        resetList();
      }, 120);
      commitTimer = setTimeout(commitSearch, 1500);
    });
    el.search.addEventListener('keydown', function (e) { if (e.key === 'Enter') el.search.blur(); });
    el.search.addEventListener('focus', renderRecent);
    el.search.addEventListener('blur', function () {
      clearTimeout(commitTimer);
      state.q = el.search.value;
      commitSearch();
      setTimeout(renderRecent, 0);
    });
    function setSearch(value) {
      clearTimeout(searchTimer);
      el.search.value = value;
      state.q = value;
      el.searchClear.hidden = !value;
      renderRecent();
      resetList();
    }
    el.searchClear.addEventListener('click', function (e) {
      e.preventDefault();
      setSearch('');
      el.search.focus();
    });
    // mousedown/touch не должны уводить фокус из поля: иначе подсказки исчезнут раньше, чем по ним попадут.
    el.recent.addEventListener('mousedown', function (e) { e.preventDefault(); });
    el.recent.addEventListener('click', function (e) {
      if (e.target.closest('[data-recent-clear]')) { searches = []; saveList(SEARCH_KEY, '', searches); renderRecent(); return; }
      var b = e.target.closest('[data-recent]');
      if (!b) return;
      setSearch(b.getAttribute('data-recent'));
      el.search.blur();
    });
    el.filterBtn.addEventListener('click', openFilter);

    el.chips.addEventListener('click', function (e) {
      var b = e.target.closest('.chip');
      if (!b) return;
      state.cat = b.getAttribute('data-cat');
      hapticSelect();
      renderChips();
      resetList();
      window.scrollTo(0, 0);
    });

    el.main.addEventListener('click', function (e) {
      var act = e.target.closest('[data-action]');
      if (act) {
        var kind = act.getAttribute('data-action');
        if (kind === 'retry') loadCatalog();
        if (kind === 'more') showMore();
        if (kind === 'reset') {
          state.cat = ''; flt.sort = ''; flt.onlyStock = false; flt.onlySale = false;
          setSearch('');
          renderChips();
        }
        return;
      }
      productClick(e);
    });

    el.tabbar.addEventListener('click', function (e) {
      var b = e.target.closest('[data-go]');
      if (!b) return;
      var view = b.getAttribute('data-go');
      hapticSelect();
      if (view === state.view) { // повторное нажатие на текущую вкладку поднимает наверх
        try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (err) { window.scrollTo(0, 0); }
        return;
      }
      go(view);
    });

    el.toastBtn.addEventListener('click', function () {
      var run = toastAction;
      clearTimeout(toastTimer);
      el.toast.hidden = true;
      toastAction = null;
      if (run) run();
    });

    // Клавиатура открыта — нижняя навигация не должна прыгать над ней.
    document.addEventListener('focusin', function (e) {
      var tag = e.target && e.target.tagName;
      if ((tag === 'INPUT' && !/^(radio|checkbox|file)$/.test(e.target.type)) || tag === 'TEXTAREA') { typing = true; updateChrome(); }
    });
    document.addEventListener('focusout', function () {
      if (!typing) return;
      setTimeout(function () {
        var a = document.activeElement, tag = a && a.tagName;
        if ((tag === 'INPUT' && !/^(radio|checkbox|file)$/.test(a.type)) || tag === 'TEXTAREA') return;
        typing = false; updateChrome();
      }, 80);
    });

    // События аналитики уходят, когда магазин сворачивают или закрывают.
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') flushEvents(true); });
    window.addEventListener('pagehide', function () { flushEvents(true); });

    // Битая ссылка на фото → заглушка со знаком гор.
    document.addEventListener('error', function (e) {
      var img = e.target;
      if (img && img.tagName === 'IMG' && img.parentNode &&
          /(^| )(card|sheet|line|mini|feature)__img( |$)/.test(img.parentNode.className)) {
        var holder = document.createElement('span');
        holder.innerHTML = MARK;
        img.parentNode.replaceChild(holder.firstChild, img);
      }
    }, true);

    el.sheet.addEventListener('click', function (e) {
      if (e.target.closest('.sheet__close')) { closeSheet(); return; }
      var act = e.target.closest('[data-action]');
      var kind = act ? act.getAttribute('data-action') : '';
      if (kind === 'add') { addFromSheet(); return; }
      if (kind === 'share') { var sp = state.sheet && product(state.sheet.id); if (sp) shareProduct(sp); return; }
      if (kind === 'notify') { if (!act.disabled && state.sheet) notifyMe(state.sheet.id); return; }
      if (kind === 'fil-apply') { closeSheet(); return; }
      if (kind === 'fil-reset') {
        flt.sort = ''; flt.onlyStock = false; flt.onlySale = false;
        renderChips(); resetList(); renderSheet();
        return;
      }
      var v = e.target.closest('[data-vi]');
      if (v) { if (!v.disabled) { state.sheet.vi = Number(v.getAttribute('data-vi')); hapticSelect(); renderSheet(); } return; }
      var st = e.target.closest('[data-step]');
      if (st) {
        if (!st.disabled) { state.sheet.qty = Math.min(MAX_QTY, Math.max(1, state.sheet.qty + Number(st.getAttribute('data-step')))); hapticLight(); renderSheet(); }
        return;
      }
      productClick(e); // сердечко и товары из подборки под описанием
    });
    el.sheet.addEventListener('change', function (e) {
      if (!state.sheet || state.sheet.kind !== 'filter') return;
      var input = e.target;
      if (input.name === 'sort') flt.sort = input.value;
      else if (input.name === 'onlyStock' || input.name === 'onlySale') flt[input.name] = !!input.checked;
      else return;
      hapticSelect();
      renderChips();
      resetList();
      window.scrollTo(0, 0);
      var apply = el.sheet.querySelector('[data-action="fil-apply"]');
      if (apply && state.catalog) apply.textContent = t('filApply') + ' · ' + visibleProducts().length;
    });

    // Шторку можно смахнуть вниз, потянув за верхнюю часть (ручка, фото, заголовок).
    var drag = null;
    el.sheet.addEventListener('touchstart', function (e) {
      drag = null;
      if (e.touches.length !== 1 || !e.target.closest('.sheet__grab, .sheet__img, .sheet__head, .sheet__title--pad')) return;
      if (e.target.closest('button')) return;
      var body = el.sheet.querySelector('.sheet__body');
      if (body && body.scrollTop > 0) return;
      drag = { x: e.touches[0].clientX, y: e.touches[0].clientY, dy: 0, on: false };
    }, { passive: true });
    el.sheet.addEventListener('touchmove', function (e) {
      if (!drag) return;
      var dx = e.touches[0].clientX - drag.x;
      drag.dy = e.touches[0].clientY - drag.y;
      if (!drag.on) {
        if (drag.dy < 8 || Math.abs(dx) > drag.dy) { if (drag.dy < -8 || Math.abs(dx) > 16) drag = null; return; }
        drag.on = true;
        el.sheet.style.transition = 'none';
      }
      el.sheet.style.transform = 'translateY(' + Math.max(0, drag.dy) + 'px)';
    }, { passive: true });
    function endDrag() {
      if (!drag) return;
      var close = drag.on && drag.dy > 110;
      drag = null;
      el.sheet.style.transition = '';
      if (close) closeSheet(); else el.sheet.style.transform = '';
    }
    el.sheet.addEventListener('touchend', endDrag);
    el.sheet.addEventListener('touchcancel', endDrag);
    el.backdrop.addEventListener('click', closeSheet);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSheet(); });

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
  document.getElementById('filterIcon').innerHTML = icon('sliders');
  el.searchClear.innerHTML = icon('x');
  if (tg) {
    try { tg.ready(); tg.expand(); } catch (e) { /* открыто не в Telegram */ }
  }
  applyTheme();
  initLang();
  loadForm();
  loadCart();
  loadLists();
  bind();
  el.adminBtn.hidden = !adminHint;
  track('open', deepId ? deepId.toUpperCase() : '', params.get('view') || '');
  loadCatalog();
  if (adminHint && params.get('admin') === '1') go('admin');
  else if (params.get('view') === 'orders') go('orders'); // кнопка «Повторити замовлення» в сообщении бота
  // Кнопка «Повторити звичне» в приветствии бота: последний заказ сразу ложится в корзину.
  if (params.get('repeat') === 'last' && inTelegram) {
    var repeatTries = 0;
    (function tryRepeat() {
      if (state.catalog && my.list) {
        for (var i = 0; i < my.list.length; i++) if (my.list[i].i) { repeatOrder(my.list[i].num); return; }
        return;
      }
      if (++repeatTries < 40) setTimeout(tryRepeat, 300);
    })();
  }
  // Тем, кто уже заказывал, в фоне подтягиваем историю: для «Купити знову» и подарка постоянным клиентам.
  if (inTelegram && cfg.API_URL && store.get(HASORD_KEY) === '1' && state.view === 'catalog') {
    setTimeout(function () { if (!my.list && !my.loading) loadMyOrders(true); }, 1200);
  }
})();
