/* PAMIR — витрина (Telegram Mini App). Чистый JS, без сборки.
 * Этап 1: каталог. Этап 2: корзина и оформление. Этап 3: отправка заказа на сервер.
 * Этап 7: главная с подборками, нижняя навигация, избранное, фильтры, профиль, подарки, аналитика.
 */
(function () {
  'use strict';
  var SCRIPT_V = ''; // версия файла из ?v= в index.html: уходит в записи об ошибках
  try { SCRIPT_V = (/[?&]v=([\w.-]{1,12})/.exec(document.currentScript && document.currentScript.src || '') || [])[1] || ''; } catch (e) { /* нет currentScript */ }

  /* ------------------------------ Тексты ------------------------------ */
  var I18N = {
    ua: {
      search: 'Пошук товарів',
      all: 'Усі',
      toCart: 'У кошик',
      out: 'Немає в наявності',
      badgeIn: 'Є в наявності',
      badgeNew: 'Новинка', badgeHit: 'Хіт', badgeSale: 'Знижка', featureCta: 'Обрати',
      myOrders: 'Мої замовлення', myEmpty: 'Замовлень поки немає', myEmptyText: 'Коли з’являться — тут буде їхня історія та кнопка «Повторити».',
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
      close: 'Закрити', photoNext: 'Наступне фото',
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
      cartEmptyTitle: 'Тут поки порожньо',
      cartEmptyText: 'Почніть із кураги — вона з нашого саду.',
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
      admin: 'Адмін-панель', admOrders: 'Замовлення', admProducts: 'Товари', admToday: 'Сьогодні', admWeek: '7 днів', admOrdToday: 'Замовлень сьогодні', admOrdWeek: 'Замовлень за 7 днів',
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
      myOrders: 'Мои заказы', myEmpty: 'Заказов пока нет', myEmptyText: 'Когда появятся — здесь будет их история и кнопка «Повторить».',
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
      close: 'Закрыть', photoNext: 'Следующее фото',
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
      cartEmptyTitle: 'Здесь пока пусто',
      cartEmptyText: 'Начните с кураги — она из нашего сада.',
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
      admin: 'Админ-панель', admOrders: 'Заказы', admProducts: 'Товары', admToday: 'Сегодня', admWeek: '7 дней', admOrdToday: 'Заказов сегодня', admOrdWeek: 'Заказов за 7 дней',
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
      favTitle: 'Обране', favEmptyTitle: 'В обраному поки порожньо', favEmpty: 'Зберігайте сюди те, що сподобалося, — наступного разу не доведеться шукати.',
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
      favTitle: 'Избранное', favEmptyTitle: 'В избранном пока пусто', favEmpty: 'Сохраняйте сюда то, что понравилось, — в следующий раз не придётся искать.',
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

  /* Тексты выпуска А (стадия 9): полоска-уведомление, баночка, «Наша курага». Пробелы неразрывные. */
  var I18N_A = {
    ua: { noticeClose: 'Закрити повідомлення', jar: 'Баночка {n} г', featureAll: 'Наша курага',
      payCardFop: 'Переказ на рахунок ФОП (IBAN)', payCardNoteFop: 'Реквізити надішлемо в Telegram одразу після оформлення.',
      npSearching: 'Шукаю…', npPickCity: 'Оберіть місто зі списку',
      codNote: 'Нова пошта бере за накладений платіж 20 ₴ + 2 % від суми.', codNoteFop: 'Оплата на рахунок ФОП — без цієї комісії.' },
    ru: { noticeClose: 'Закрыть уведомление', jar: 'Баночка {n} г', featureAll: 'Наша курага',
      payCardFop: 'Перевод на счёт ФОП (IBAN)', payCardNoteFop: 'Реквизиты пришлём в Telegram сразу после оформления.',
      npSearching: 'Ищу…', npPickCity: 'Выберите город из списка',
      codNote: 'Новая почта берёт за наложенный платёж 20 ₴ + 2 % от суммы.', codNoteFop: 'Оплата на счёт ФОП — без этой комиссии.' }
  };
  ['ua', 'ru'].forEach(function (lang) {
    Object.keys(I18N_A[lang]).forEach(function (k) { I18N[lang][k] = I18N_A[lang][k]; });
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
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* хранилище недоступно */ } },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) { /* хранилище недоступно */ } }
  };

  /** Ключ попытки заказа живёт в хранилище устройства до ответа сервера (сервер помнит его 6 часов). */
  var RID_KEY = 'pamir_rid_v1';
  function loadRid() {
    try {
      var o = JSON.parse(store.get(RID_KEY) || 'null');
      if (o && /^[\w-]{8,40}$/.test(o.r) && Date.now() - Number(o.t) < 5 * 3600 * 1000) return o.r;
    } catch (e) { /* испорченная запись — игнорируем */ }
    return '';
  }
  function setRid(rid) { state.rid = rid; store.set(RID_KEY, rid ? JSON.stringify({ r: rid, t: Date.now() }) : ''); }

  var state = {
    lang: 'ua',
    cat: String(params.get('cat') || '').toUpperCase().replace(/[^A-ZА-ЯІЇЄҐ0-9_-]/g, '').slice(0, 12), // код категории, '' = все; ?cat=SPC — кнопка «Відкрити категорію» из рассылки
    q: '',
    catalog: null,
    status: 'loading', // loading | ready | error
    sheet: null,       // { id, vi, qty }
    view: 'catalog',   // catalog | cart | checkout | done | admin | orders
    scrollY: 0,
    cart: { t: 0, i: [] }, // i: [{ id, g (граммы, 0 = штука/упаковка), q, pr (цена за единицу), was? }]
    form: { name: '', phone: '', delivery: 'pickup', city: '', branch: '', pay: 'cash', comment: '', giftNote: '', npType: 'branch', point: '', ifOut: 'call', cityRef: '', cityRefFor: '' },
    done: null,
    cartNotice: '',
    rid: loadRid(),    // id попытки заказа: повторная отправка не создаст второй заказ (переживает перезагрузку страницы)
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
    return { price: p.p, old: p.o > p.p ? Math.round(p.o) : 0, unit: jarText(p) || (p.t === 'p' && p.pk ? t('per') + ' ' + p.pk.replace(/ /g, NBSP) : t('perPiece')) };
  }

  /** Название способа оплаты. Флаг fop (сервер знает реквизиты ФОП; сами они на витрину не приходят) меняет название «card». */
  function payName(k) {
    if (k === 'card' && shopInfo().fop) return t('payCardFop');
    return t({ cash: 'payCash', card: 'payCard', cod: 'payCod' }[k]);
  }

  /** «Баночка 60 г» — только у упаковки с известным весом (pw). Нет веса — пустая строка. */
  function jarText(p) {
    var w = p && p.t === 'p' ? Number(p.pw) : 0;
    return w > 0 && w === Math.floor(w) ? tf('jar', { n: w }) : '';
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
    npc.off = false;
    state.status = 'ready';
    if (state.cat && !data.categories.some(function (c) { return c.code === state.cat; })) state.cat = '';
    reconcileCart();
  }

  /** Ссылка на товар: ?startapp=DRY-039 у Mini App или ?p=DRY-039 в адресе. Открываем один раз. */
  var deepId = String((inTelegram && tg.initDataUnsafe && tg.initDataUnsafe.start_param) || params.get('p') || params.get('tgWebAppStartParam') || '').trim().toLowerCase();
  function openDeepLink() {
    openStartRecipe();
    if (!deepId || !state.catalog || state.view !== 'catalog') return;
    var found = null;
    state.catalog.products.forEach(function (p) { if (p.id.toLowerCase() === deepId) found = p; });
    if (!found) return; // в сохранённой копии товара может не быть — попробуем ещё раз после свежей загрузки
    deepId = '';
    openSheet(found.id);
  }

  /** Один запрос каталога с таймаутом; ответ без ok и списка товаров — ошибка. box — «коробка» запроса: если витрина сама его отменила (box.own), ошибка помечается own и в сводку не идёт. */
  function fetchCatalog(url, ms, box) {
    var ctrl = window.AbortController ? new AbortController() : null;
    if (box) box.ctrl = ctrl;
    var timedOut = false, cacheHdr = '';
    if (box) box.cache = '';
    var timer = setTimeout(function () { timedOut = true; if (ctrl) ctrl.abort(); }, ms);
    return fetch(url, ctrl ? { signal: ctrl.signal } : undefined).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      try { cacheHdr = String(r.headers.get('X-Pamir-Cache') || ''); } catch (e) { cacheHdr = ''; } // заголовок Worker: HIT / STALE / REFRESHED / MISS / EXPIRED — витрина реагирует только на EXPIRED; прочие значения и нечитаемый заголовок (null без Access-Control-Expose-Headers) равнозначны
      return r.json();
    }).then(function (data) {
      clearTimeout(timer);
      if (!data || !data.ok || !Array.isArray(data.products)) throw new Error('bad catalog');
      if (box) box.cache = cacheHdr;
      return data;
    }, function (err) { clearTimeout(timer); throw err; }).catch(function (err) {
      if (box && box.own) throw ownAbort();
      if (timedOut && err && typeof err === 'object') err.ownTimeout = true; // оборвано нашим таймером, а не сетью: повторять не нужно
      throw err;
    });
  }
  var catGen = 0, catBox = null; // номер последней загрузки каталога и её «коробка»: устаревший запрос отменяется, его ответ не применяется
  function catCancel() {
    if (!catBox) return;
    catBox.own = true;
    try { if (catBox.ctrl) catBox.ctrl.abort(); } catch (e) { /* уже закончен */ }
  }
  /** Если в config.js задан CATALOG_URL (Worker), сначала идём туда (6 с); любая неудача — тот же запрос в Apps Script (с одним автоповтором). Сбой Worker при удачном откате — не ошибка, а метка worker_fallback. */
  function requestCatalog(direct) {
    catCancel();
    var box = catBox = { ctrl: null, own: false };
    var one = function (url, ms) { return box.own ? Promise.reject(ownAbort()) : fetchCatalog(url, ms, box); };
    var apiLoad = function () {
      // первая попытка — до 20 с (после собственного таймаута повтора нет), вторая — короткая (NET_RETRY_LIMIT_MS)
      var run = function (limit) { return one(catalogUrl(), limit || Number(window.__CAT_TIMEOUT_MS) || 20000); };
      return cfg.API_URL ? netGuard('catalog', run) : run();
    };
    if (direct || !cfg.API_URL || !/^https?:\/\//.test(String(cfg.CATALOG_URL || ''))) return apiLoad(); // direct: после «ціни змінилися» Worker мог ещё держать прежние цены
    var ws = netStart();
    return one(cfg.CATALOG_URL, 6000).catch(function (err) {
      if (err && err.own) throw err;
      var real = !netSuspect(ws, true) && navigator.onLine !== false; // обрыв при скрытой странице — не вина Worker
      return apiLoad().then(function (data) { if (real) reportWorkerFallback(); return data; });
    });
  }

  /**
   * Мягкая страховка: Worker пометил ответ EXPIRED (копия старше 5 минут, до 24 ч). Каталог уже показан; один раз (на загрузку) тихо пробуем Apps Script напрямую.
   * Удалось — обновляем витрину без мигания (позиция прокрутки сохраняется; при открытой шторке перерисовка основного экрана откладывается до её закрытия).
   * Не удалось (сеть, таймаут, плохой ответ, новая загрузка вытеснила эту) — ничего: ни ошибки, ни сводки, ни повтора.
   */
  var staleBox = null;
  function staleRecheck(gen) {
    if (!cfg.API_URL) return;
    var box = staleBox = { ctrl: null, own: false };
    fetchCatalog(catalogUrl(), 10000, box).then(function (data) {
      if (box.own || gen !== catGen || staleBox !== box) return;
      var cleared = cdvApply(data.shop);
      var fresh = JSON.stringify({ c: data.categories, p: data.products, s: data.shop });
      var old = state.catalog ? JSON.stringify({ c: state.catalog.categories, p: state.catalog.products, s: state.catalog.shop }) : '';
      store.set(CACHE_KEY, JSON.stringify({ url: cfg.API_URL, data: data }));
      if (fresh === old && !cleared) return;
      var y = window.scrollY || 0;
      var openId = state.sheet ? state.sheet.id : '', before = openId && state.catalog && state.catalog.byId[openId] ? JSON.stringify(state.catalog.byId[openId]) : '';
      if (state.sheet) {
        setCatalog(data);
        stale.main = 'force'; // экран под шторкой перерисуем, когда её закроют (flushStale)
        var np2 = data.byId[openId];
        if (!np2 || JSON.stringify(np2) !== before) renderSheet();
        renderChips(); renderBanner();
      } else {
        setCatalog(data);
        renderAll();
        if ((window.scrollY || 0) !== y) window.scrollTo(0, y);
      }
    }).catch(function () { /* страховка не сработала — покупатель видит каталог от Worker */ });
  }

  /**
   * Версия данных покупателя (shop.cdv, необязательная строка). Очистка нужна ОДИН раз на покупателя, а не на устройство, поэтому версия хранится
   * и на телефоне (localStorage 'pamir_cdv'), и в Telegram CloudStorage (ключ 'cdv'). Схема:
   *  - на телефоне та же версия, нет shop.cdv (старый бэкенд) или решение уже принято в этой сессии — ничего;
   *  - облака нет — как раньше: версия на телефоне не совпала, стираем данные на телефоне и в памяти (один раз за сессию, cdvStarted);
   *  - облако есть — сначала читаем 'cdv' (до 3 с): та же версия, телефон без метки — новое устройство, ничего не стираем (корзина, форма, «Обране» приедут из облака);
   *    та же версия, на телефоне старая — стираем только локальное и заново берём данные из облака; в облаке нет метки или другая версия — полная очистка
   *    (телефон, память, removeItems) и запись 'cdv' в облако; ошибка или тишина облака — как без облака, но облако не трогаем (вслепую не стираем);
   *  - cdvDone ставится в момент очистки с облаком/без него: поздние ответы cloud getItem после этого отбрасываются (читатели проверяют cdvDone); без очистки он пуст — ответы принимаются.
   * Язык, тема, did, кэш каталога, паузы Новой почты, админские настройки не трогаем. Берём только из свежего ответа сервера.
   * Возвращает true, если очистка уже сделана синхронно (вызывающий перерисует экран); при чтении облака очистка идёт позже и перерисовывает экран сама.
   */
  var CDV_KEY = 'pamir_cdv', cdvDone = false, cdvStarted = '';
  function cdvWipe(v, opt) {
    if (!opt.keepLoads) cdvDone = v; // поздние ответы облака не вернут старое
    [CART_KEY, FORM_KEY, RID_KEY, FAV_KEY, SEEN_KEY, SEARCH_KEY, SUBS_KEY, NOTICE_KEY].forEach(function (k) { store.del(k); });
    if (opt.cloud) {
      try {
        if (cloudOk() && tg.CloudStorage.removeItems) tg.CloudStorage.removeItems(['cart', 'form', 'fav', 'seen', 'notice'], function () {});
        if (cloudOk()) tg.CloudStorage.setItem('cdv', v, function () {});
      } catch (e) { /* облако недоступно */ }
    }
    try { clearTimeout(cartSync.timer); } catch (e) { /* таймера нет */ }
    state.cart = { t: 0, i: [] };
    state.form = { name: '', phone: '', delivery: 'pickup', city: '', branch: '', pay: 'cash', comment: '', giftNote: '', npType: 'branch', point: '', ifOut: 'call', cityRef: '', cityRefFor: '' };
    if (tgUser) state.form.name = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ').slice(0, 60);
    state.rid = '';
    favs = []; seen = []; searches = []; subs = [];
    noticeSeen.local = ''; noticeSeen.cloud = ''; noticeSeen.session = ''; noticeSeen.cloudReady = true;
    store.set(CDV_KEY, v);
    if (state.view === 'cart' || state.view === 'checkout') state.view = 'catalog'; // корзина пуста — оформлять нечего
  }
  function cdvApply(shop) {
    var v = shop && typeof shop.cdv === 'string' ? shop.cdv.trim().slice(0, 40) : '';
    if (!v || v === store.get(CDV_KEY) || cdvStarted === v) return false;
    cdvStarted = v; // даже если хранилище сломано — в этой сессии решение принимается один раз
    var hadLocal = !!store.get(CDV_KEY);
    var canRead = false;
    try { canRead = !!(cloudOk() && tg.CloudStorage.getItem); } catch (e) { canRead = false; }
    if (!canRead) { cdvWipe(v, { cloud: false }); return true; }
    var settled = false, tm = null;
    var decide = function (err, val) {
      if (settled) return;
      settled = true; clearTimeout(tm);
      if (err) cdvWipe(v, { cloud: false });                     // облако не ответило как надо: как без облака, облако не стираем
      else if (val === v) {
        if (!hadLocal) { store.set(CDV_KEY, v); return; }         // новое устройство того же покупателя: ничего не стираем
        cdvWipe(v, { cloud: false, keepLoads: true });            // на телефоне была старая версия, в облаке уже новая: чистим только телефон
        loadCart(); loadLists(); loadFormCloud();                 // и заново берём данные из облака
      } else cdvWipe(v, { cloud: true });                        // первая очистка покупателя: везде и метка в облако
      try { renderAll(); } catch (e) { /* экран ещё не готов */ }
    };
    try {
      tg.CloudStorage.getItem('cdv', function (err, val) { decide(err, typeof val === 'string' ? val : ''); });
      tm = setTimeout(function () { decide(new Error('timeout')); }, 3000);
    } catch (e) { decide(e); }
    return false;
  }

  function loadCatalog(direct) {
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
    captureSrc();

    var gen = ++catGen;
    try { if (staleBox) { staleBox.own = true; if (staleBox.ctrl) staleBox.ctrl.abort(); } } catch (e) { /* уже закончен */ }
    var p = requestCatalog(direct === true), box0 = catBox;
    return p
      .then(function (data) {
        if (gen !== catGen) return; // за это время началась более новая загрузка
        if (state.offline) { state.offline = false; renderBanner(); }
        var cleared = cdvApply(data.shop);
        var fresh = JSON.stringify({ c: data.categories, p: data.products, s: data.shop });
        var old = state.catalog
          ? JSON.stringify({ c: state.catalog.categories, p: state.catalog.products, s: state.catalog.shop })
          : '';
        if (cfg.API_URL) store.set(CACHE_KEY, JSON.stringify({ url: cfg.API_URL, data: data }));
        if (fresh !== old || cleared) {
          setCatalog(data);
          renderAll();
        }
        openDeepLink();
        deepId = '';
        captureSrc();
        openReLink();
        if (box0 && box0.cache === 'EXPIRED') staleRecheck(gen); // Worker отдал СТАРУЮ копию (старше 5 минут, Apps Script не ответил): один тихий прямой запрос. HIT / STALE / REFRESHED / MISS / нет заголовка — каталог свежий, ничего не делаем
      })
      .catch(function (err) {
        if ((err && err.own) || gen !== catGen) return; // отменено самой витриной: новая загрузка уже идёт
        if (!state.catalog) {
          state.status = 'error';
          renderMain();
        } else if (cfg.API_URL) {
          state.offline = true;
          renderBanner();
          openReLink(); // сети нет, но каталог из сохранённой копии есть
        }
      });
  }

  /* ------------------------- Избранное, просмотренное, поиск ------------------------- */
  var PAGE_SIZE = 20; // товаров на странице: 10 рядов по 2
  var FAV_KEY = 'pamir_fav_v1', SEEN_KEY = 'pamir_seen_v1', SEARCH_KEY = 'pamir_search_v1';
  var SUBS_KEY = 'pamir_subs_v1', HASORD_KEY = 'pamir_has_orders';
  var favs = [], seen = [], searches = [], subs = [];
  var flt = { sort: '', onlyStock: false, onlySale: false, page: 1 };

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
        if (err || !values || cdvDone) return;
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
    if (state.view === 'fav') { if (state.sheet) stale.fav = true; else renderPage(); }
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

  /** Нижний регистр, «ё»/«є»/«э» = «е», «і»/«ї»/«ы» = «и», без апострофов: «мʼята» и «мята», «кедрові» и «кедровые» находят одно и то же. */
  function norm(s) {
    return String(s || '').toLowerCase().replace(/[ёєэ]/g, 'е').replace(/[іїы]/g, 'и').replace(/[ʼ’'`]/g, '').replace(/\s+/g, ' ').trim();
  }

  function buildSearchIndex(data) {
    var cats = {}, words = {};
    data.categories.forEach(function (c) { cats[c.code] = c.ua + ' ' + c.ru; });
    data.sx = {}; data.sn = {};
    data.products.forEach(function (p) {
      data.sn[p.id] = norm(p.ua + ' ' + (p.ru || '') + ' ' + p.id);
      data.sx[p.id] = data.sn[p.id] + ' ' + norm((cats[p.c] || '') + ' ' + (p.dUa || '') + ' ' + (p.dRu || ''));
      data.sx[p.id].split(/[^a-z0-9а-яґ]+/).forEach(function (w) { if (w.length >= 4) words[w] = 1; });
    });
    data.dict = Object.keys(words); // слова каталога: по ним ищем опечатки (не по каждому товару)
    // Синонимы shop.syn ({слово: что искать}) приводим к тому же виду, что индекс. Нет поля — пусто, поиск как раньше.
    data.synN = {};
    var syn = data.shop && data.shop.syn;
    if (syn && typeof syn === 'object' && !Array.isArray(syn)) {
      Object.keys(syn).forEach(function (k) {
        var key = norm(k), val = norm(syn[k]);
        if (key && val && key !== '__proto__' && key.length <= 40 && val.length <= 80) data.synN[key] = val;
      });
    }
  }

  /** Отличаются ли слова не более чем на одну букву: замена, пропуск, лишняя, перестановка соседних. */
  function nearWord(a, b) {
    var la = a.length, lb = b.length;
    if (la - lb > 1 || lb - la > 1) return false;
    var i = 0;
    while (i < la && i < lb && a.charCodeAt(i) === b.charCodeAt(i)) i++;
    if (i === la && i === lb) return true;
    if (la === lb) {
      if (a.slice(i + 1) === b.slice(i + 1)) return true;
      return i + 1 < la && a.charAt(i) === b.charAt(i + 1) && a.charAt(i + 1) === b.charAt(i) && a.slice(i + 2) === b.slice(i + 2);
    }
    return la > lb ? a.slice(i + 1) === b.slice(i) : b.slice(i + 1) === a.slice(i);
  }
  /** Слова каталога, похожие на слово запроса (от 5 букв). Сравниваем слово целиком и его начало такой же длины («курагу» ~ «курага»). */
  function typoWords(tk) {
    var out = [], dict = (state.catalog && state.catalog.dict) || [];
    if (tk.length < 5) return out;
    for (var i = 0; i < dict.length; i++) {
      var w = dict[i], d = w.length - tk.length;
      if (d < -1) continue; // слово короче слова запроса больше чем на букву — не подходит
      if (w !== tk && (nearWord(tk, w) || (d > 1 && nearWord(tk, w.slice(0, tk.length))))) out.push(w);
    }
    return out;
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

  /* ------------------------------ Источник перехода (б4) ------------------------------ */
  /*
   * Метка из ссылки (?startapp=qr1, ?p=insert): латиница, цифры, _ и -, до 24 знаков. Не метка: ID товара, ref_…, adm_…, rec….
   * Первая метка хранится на устройстве 30 дней и уходит в заказ; событие «src» шлётся один раз за открытие с меткой.
   */
  var SRC_KEY = 'pamir_src_v1', SRC_DAYS = 30;
  var srcDone = false, srcOpen = String((inTelegram && tg.initDataUnsafe && tg.initDataUnsafe.start_param) || params.get('p') || params.get('tgWebAppStartParam') || '').trim().toLowerCase();
  function srcLabel(raw, catalog) {
    var v = String(raw || '');
    if (!/^[a-z0-9_-]{1,24}$/.test(v)) return '';
    if (/^(ref_|adm_|rec)/.test(v) || /^[a-z]{3}-\d{3}$/.test(v) || /^re-\d{1,10}$/.test(v)) return '';
    if (catalog && catalog.products.some(function (p) { return String(p.id).toLowerCase() === v; })) return '';
    return v;
  }
  function srcStored() {
    try {
      var o = JSON.parse(store.get(SRC_KEY) || 'null');
      if (o && /^[a-z0-9_-]{1,24}$/.test(o.s) && Date.now() - Number(o.t) < SRC_DAYS * 86400000) return o.s;
    } catch (e) { /* испорченная запись — игнорируем */ }
    return '';
  }
  /** Вызывается, когда каталог уже есть (сохранённая копия или свежий): только тогда видно, не ID ли это товара. */
  function captureSrc() {
    if (srcDone || !srcOpen || !state.catalog) return;
    srcDone = true;
    var label = srcLabel(srcOpen, state.catalog);
    if (!label) return;
    if (!srcStored()) store.set(SRC_KEY, JSON.stringify({ s: label, t: Date.now() }));
    track('src', '', label);
  }

  /* ------------------------------ Ошибки витрины (б7) ------------------------------ */
  /*
   * Ошибки скрипта и неудачные запросы к API уходят на сервер короткой записью: текст ошибки, экран, версия файла.
   * Без initData, имени, телефона, адреса и данных формы. С одного устройства — не больше 5 записей в час;
   * одинаковые подряд не дублируются; сбой самой отправки новых записей не порождает.
   */
  var ERR_KEY = 'pamir_err_v1', DID_KEY = 'pamir_did', ERR_PER_HOUR = 5;
  var errQueue = [], errTimer = null, errLast = '', errDid = '';
  function errDidGet() {
    if (errDid) return errDid;
    var v = store.get(DID_KEY) || '';
    if (!/^[a-z0-9]{8,32}$/.test(v)) {
      v = '';
      for (var i = 0; i < 16; i++) v += Math.floor(Math.random() * 36).toString(36);
      store.set(DID_KEY, v);
    }
    return (errDid = v);
  }
  function errScrub(text) {
    return String(text === undefined || text === null ? '' : text).replace(/https?:\/\/[^\s)]*/g, function (u) { return u.split(/[?#]/)[0]; })
      .replace(/\+?\d[\d\s()-]{7,}\d/g, '#').replace(/\s+/g, ' ').trim();
  }
  /** Можно ли записать ещё одну ошибку в этот час (счётчик в хранилище устройства). */
  function errAllowed() {
    var hour = Math.floor(Date.now() / 3600000), n = 0;
    try {
      var o = JSON.parse(store.get(ERR_KEY) || 'null');
      if (o && o.h === hour) n = Number(o.n) || 0;
    } catch (e) { n = 0; }
    if (n >= ERR_PER_HOUR) return false;
    store.set(ERR_KEY, JSON.stringify({ h: hour, n: n + 1 }));
    return true;
  }
  function reportError(msg) {
    try {
      if (!cfg.API_URL) return;
      var m = errScrub(msg).slice(0, 200);
      var view = String(state && state.view || '').replace(/[^\w.:-]/g, '').slice(0, 24);
      if (!m || m === errLast) return;
      if (!errAllowed()) return;
      errLast = m;
      errQueue.push({ m: m, s: view, v: SCRIPT_V });
      if (!errTimer) errTimer = setTimeout(function () { flushErrors(false); }, 2500);
    } catch (e) { /* отчёт об ошибках сам не должен ломать магазин */ }
  }
  function flushErrors(leaving) {
    clearTimeout(errTimer);
    errTimer = null;
    if (!errQueue.length || !cfg.API_URL) return;
    try {
      var body = JSON.stringify({ action: 'err', did: errDidGet(), items: errQueue.splice(0, 5) });
      if (leaving && navigator.sendBeacon) { navigator.sendBeacon(cfg.API_URL, new Blob([body], { type: 'text/plain;charset=utf-8' })); return; }
      fetch(cfg.API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: body, keepalive: true })
        .then(function (r) { return r.json(); }).catch(function () { /* старый бэкенд или нет сети — молча */ });
    } catch (e) { /* без записи */ }
  }
  /** Неудачный запрос к API (сеть, таймаут, HTTP-ошибка). Отмену пользователем (не наш таймаут) не считаем. */
  function reportNet(action, err) {
    var msg = err && err.message ? String(err.message) : '';
    if (err && (err.own || err.name === 'AbortError' && !msg)) return;
    reportError('net ' + String(action).replace(/[^\w.]/g, '').slice(0, 24) + ': ' + (/^HTTP \d{3}$/.test(msg) ? msg : err && err.name === 'AbortError' ? 'timeout' : 'network'));
  }

  /* --- Ложные «network»: обрывы при уходе Telegram в фон и короткие пропадания сети в сводку не идут --- */
  var NET_RETRY_MS = 1000;   // пауза перед автоповтором чтения
  var NET_WAIT_MS = 8000;    // сколько ждём возвращения на экран или сети перед автоповтором
  var NET_TAIL_MS = 1500;    // хвост оборванных запросов после возвращения из фона
  /** Запросы только на чтение: их безопасно повторить один раз. Всё остальное (заказ, корзина, действия админов, err, события) не повторяется никогда. */
  var NET_READ = { catalog: 1, 'orders.my': 1, 'admin.orders': 1, 'admin.products': 1, 'admin.settings': 1, 'admin.admins': 1, 'admin.reviews': 1,
    'admin.wh': 1, 'admin.mail': 1, 'admin.log': 1, 'admin.today': 1, 'admin.archiveList': 1, 'admin.statusPreview': 1, 'wh.prices': 1 };
  // Не в списке (не повторяются): admin.stats — переписывает лист «Статистика» под блокировкой; admin.ttn.preview — ходит в Нову пошту и тратит лимит; всё остальное — запись, отправка или заказ.
  var NET_RETRY_LIMIT_MS = 9000; // предел второй попытки: покупатель ждёт не дольше прежнего максимума + ~10 с
  var vis = { lastHide: 0, lastShow: 0, tg: null, waiters: [] }; // tg: true — Telegram сообщил «свёрнуто» (deactivated), false — «активно», null — не знаем
  function tgInactive() {
    try { return vis.tg !== null ? vis.tg : !!(tg && tg.isActive === false); } catch (e) { return false; }
  }
  function pageHiddenNow() {
    try { return !!document.hidden || document.visibilityState === 'hidden' || tgInactive(); } catch (e) { return false; }
  }
  function visNotify() { vis.waiters.slice().forEach(function (f) { try { f(); } catch (e) { /* ждун не должен ломать остальных */ } }); }
  function visMark() { if (pageHiddenNow()) vis.lastHide = Date.now(); else vis.lastShow = Date.now(); visNotify(); }
  // Новые версии Telegram сворачивают Mini App без visibilitychange: слушаем activated / deactivated.
  try {
    if (tg && typeof tg.onEvent === 'function') {
      tg.onEvent('deactivated', function () { vis.tg = true; visMark(); });
      tg.onEvent('activated', function () { vis.tg = false; visMark(); });
    }
  } catch (e) { /* старый Telegram — только visibilitychange */ }
  if (pageHiddenNow()) vis.lastHide = Date.now();
  document.addEventListener('visibilitychange', visMark);
  window.addEventListener('pagehide', function () { vis.lastHide = Date.now(); });
  window.addEventListener('freeze', function () { vis.lastHide = Date.now(); });
  window.addEventListener('pageshow', function (ev) { if (ev && ev.persisted && !pageHiddenNow()) vis.lastShow = Date.now(); }); // возврат из кэша страниц; обычная загрузка — не «возвращение»
  document.addEventListener('resume', function () { if (!pageHiddenNow()) vis.lastShow = Date.now(); });
  function ownAbort() { var e = new Error('cancelled'); e.own = true; return e; }
  function netStart() { return { t: Date.now(), hid: pageHiddenNow() }; }
  /** Запрос мог оборваться из-за ухода в фон: страница скрыта сейчас или была скрыта за время запроса; при tail — ещё и вернулась меньше 1,5 с назад. */
  function netSuspect(s, tail) {
    if (s.hid || pageHiddenNow() || vis.lastHide >= s.t) return true;
    return !!(tail && vis.lastShow && Date.now() - vis.lastShow < NET_TAIL_MS);
  }
  /** Ответ сервера (HTTP 4xx/5xx, не JSON) — это не обрыв сети: для записи его не глушим, даже если страница пряталась. Обрыв — исключение fetch или abort. */
  function isServerReply(err) {
    var m = err && err.message ? String(err.message) : '';
    return /^HTTP \d{3}$/.test(m) || !!(err && err.name === 'SyntaxError');
  }
  function netFail(action, err, s, tail, write) {
    if (write && isServerReply(err)) { reportNet(action, err); return; }
    if (netSuspect(s, tail) || navigator.onLine === false) return; // устройство без сети — не ошибка магазина
    reportNet(action, err);
  }
  /** Ждём, пока страница снова видна и есть сеть (не дольше NET_WAIT_MS), затем короткая пауза. */
  function netReady() {
    return new Promise(function (resolve) {
      var done = false, cap = null;
      function ready() { return !pageHiddenNow() && navigator.onLine !== false; }
      function go() {
        if (done) return;
        done = true;
        clearTimeout(cap);
        var wi = vis.waiters.indexOf(check); if (wi >= 0) vis.waiters.splice(wi, 1);
        document.removeEventListener('visibilitychange', check);
        window.removeEventListener('online', check);
        setTimeout(resolve, NET_RETRY_MS);
      }
      function check() { if (ready()) go(); }
      if (ready()) { go(); return; }
      document.addEventListener('visibilitychange', check);
      vis.waiters.push(check);
      window.addEventListener('online', check);
      cap = setTimeout(go, NET_WAIT_MS);
    });
  }
  /**
   * Запрос к API: run() делает одну попытку. Чтение при сбое повторяется один раз; «network» уходит в сводку, только если не прошла и вторая попытка.
   * Запись не повторяется никогда. Ошибка не пишется, если страница была скрыта, запрос отменён самой витриной или это хвост после возвращения из фона.
   */
  function netGuard(action, run) {
    var s1 = netStart();
    return run().catch(function (err) {
      if (err && err.own) throw err;
      if (!NET_READ[action]) { netFail(action, err, s1, true, true); throw err; }
      // Автоповтор только после быстрого сбоя сети (обрыв, ошибка fetch, HTTP 5xx). Свой таймаут при видимой странице — ошибка сразу; «ответ не тот» (4xx, не JSON) — тоже.
      var fast = !!err && !err.ownTimeout && (err.name === 'TypeError' || /^HTTP 5\d\d$/.test(String(err.message || '')));
      var hiddenTimeout = !!err && !!err.ownTimeout && netSuspect(s1, false); // таймаут, пока страница была скрыта: покупатель не ждал
      if (!fast && !hiddenTimeout) { netFail(action, err, s1, true); throw err; }
      return netReady().then(function () {
        var s2 = netStart();
        return run(NET_RETRY_LIMIT_MS).catch(function (e2) { if (!(e2 && e2.own)) netFail(action, e2, s2, false); throw e2; });
      });
    });
  }
  /** Worker не ответил, но каталог из Apps Script получен: покупатель ничего не заметил. Метка — не чаще раза в час с устройства, в лимит 5 записей не входит. */
  var WFB_KEY = 'pamir_wfb_v1';
  function reportWorkerFallback() {
    try {
      if (!cfg.API_URL) return;
      var hour = String(Math.floor(Date.now() / 3600000));
      if (store.get(WFB_KEY) === hour) return;
      store.set(WFB_KEY, hour);
      errQueue.push({ m: 'worker_fallback', s: 'catalog', v: SCRIPT_V });
      if (!errTimer) errTimer = setTimeout(function () { flushErrors(false); }, 2500);
    } catch (e) { /* метка не должна ломать магазин */ }
  }
  window.addEventListener('error', function (ev) {
    var file = String(ev && ev.filename || '').split(/[?#]/)[0].split('/').pop();
    reportError((ev && ev.message ? ev.message : 'error') + (file ? ' @ ' + file + ':' + (ev.lineno || 0) : ''));
  });
  window.addEventListener('unhandledrejection', function (ev) {
    var r = ev && ev.reason;
    reportError('promise: ' + (r && r.message ? r.message : r));
  });
  window.addEventListener('pagehide', function () { flushErrors(true); });

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
    applySeason();
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
    if (text && noticeClosed(notice)) text = '';
    if (!text) { el.notice.hidden = true; el.notice.innerHTML = ''; return; }
    // Текст сначала экранируется, потом @имя становится ссылкой на t.me.
    var html = esc(text).replace(/(^|[^A-Za-z0-9_@])@([A-Za-z0-9_]{5,32})(?![A-Za-z0-9_])/g, function (m, pre, nick) {
      return pre + '<a class="notice__link" href="https://t.me/' + nick + '" data-url="https://t.me/' + nick + '">@' + nick + '</a>';
    });
    el.notice.innerHTML = '<span class="notice__text">' + html + '</span>' +
      '<button type="button" class="notice__x" aria-label="' + esc(t('noticeClose')) + '">' + icon('x') + '</button>';
    el.notice.hidden = false;
  }

  /* Полоска закрывается навсегда: запоминаем отпечаток текста (другой текст в настройке покажется снова). */
  var NOTICE_KEY = 'pamir_notice_closed';
  var noticeSeen = { local: store.get(NOTICE_KEY) || '', cloud: '', cloudReady: false, session: '' };

  function noticePrint(notice) {
    var s = String(notice.ua || '') + '|' + String(notice.ru || ''), h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
    return 'n' + h.toString(36) + s.length;
  }

  /** Закрыта ли полоска. Пока облако Telegram не ответило, не показываем: так полоска не «прыгает». */
  function noticeClosed(notice) {
    var fp = noticePrint(notice);
    if (fp === noticeSeen.local || fp === noticeSeen.session || fp === noticeSeen.cloud) return true;
    return !noticeSeen.cloudReady;
  }

  function loadNoticeFlag() {
    function done(value) {
      if (noticeSeen.cloudReady || cdvDone) return;
      noticeSeen.cloud = typeof value === 'string' ? value : '';
      noticeSeen.cloudReady = true;
      renderBanner();
    }
    if (noticeSeen.local || !cloudOk()) { noticeSeen.cloudReady = true; return; }
    try {
      tg.CloudStorage.getItem('notice', function (err, value) { done(err ? '' : value); });
      setTimeout(function () { done(''); }, 1500); // облако не ответило — просто показываем
    } catch (e) { noticeSeen.cloudReady = true; }
  }

  function closeNotice() {
    var notice = shopInfo().notice;
    if (!notice) return;
    var fp = noticePrint(notice);
    noticeSeen.session = fp; // даже если память недоступна — до перезагрузки полоска скрыта
    store.set(NOTICE_KEY, fp);
    if (cloudOk()) {
      try { tg.CloudStorage.setItem('notice', fp, function () {}); } catch (e) { /* облако недоступно */ }
    }
    hapticSelect();
    renderBanner();
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
    var sx = state.catalog.sx || {}, sn = state.catalog.sn || {}, synN = state.catalog.synN || {};
    var has = Object.prototype.hasOwnProperty;
    var pool = state.catalog.products.filter(function (p) {
      if (state.cat && p.c !== state.cat) return false;
      if (flt.onlyStock && !p.a) return false;
      if (flt.onlySale && !(p.a && hasOld(p))) return false;
      return true;
    });
    function finish(list) {
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
    if (!tokens.length) return finish(pool);
    // Три слоя: точные совпадения; совпадения через синонимы; опечатки. Каждый следующий слой идёт ниже предыдущего.
    var exact = [], viaSyn = [], viaTypo = [], typo = {};
    pool.forEach(function (p) {
      var text = sx[p.id] || '', usedSyn = false, usedTypo = false;
      var all = tokens.every(function (tk) {
        if (text.indexOf(tk) >= 0) return true;
        if (has.call(synN, tk)) { // слово запроса заменяется целевым: «урюк» → «курага»
          var parts = synN[tk].split(' ').filter(Boolean);
          if (parts.length && parts.every(function (w) { return text.indexOf(w) >= 0; })) { usedSyn = true; return true; }
        }
        if (tk.length >= 5) {
          var ws = typo[tk] || (typo[tk] = typoWords(tk));
          for (var i = 0; i < ws.length; i++) if (text.indexOf(ws[i]) >= 0) { usedTypo = true; return true; }
        }
        return false;
      });
      if (!all) return;
      (usedTypo ? viaTypo : usedSyn ? viaSyn : exact).push(p);
    });
    return finish(exact).concat(finish(viaSyn), finish(viaTypo));
  }

  /** Адрес маленькой копии (360 px) — только для файлов витрины вида …/img/products/<ID>.webp; остальные адреса (Google Drive и т. п.) не меняются. */
  function thumbUrl(u) {
    var m = /^(.*\/img\/products\/)([^\/?#]+\.webp)$/i.exec(String(u || ''));
    return m ? m[1] + 's/' + m[2] : '';
  }
  /** К файлам витрины …/img/products/<ID>.webp (и s/<ID>.webp, p/<ID>.webp) добавляется ?v=<версия из index.html>: после замены фото телефоны не показывают старый кэш. Остальные адреса не меняются. */
  function verUrl(u) {
    u = String(u || '');
    return SCRIPT_V && /\/img\/products\/(s\/|p\/)?[^\/?#]+\.webp$/i.test(u) ? u + '?v=' + SCRIPT_V : u;
  }
  /** small — карточки, ленты, корзина: берут маленькую копию; шторка товара — большую. Нет маленькой — один раз подставляется большая (см. обработчик error). */
  function photoHtml(p, eager, small) {
    if (!p.img) return MARK;
    var thumb = small ? thumbUrl(p.img) : '';
    return '<img src="' + esc(verUrl(thumb || p.img)) + '"' + (thumb ? ' data-full="' + esc(verUrl(p.img)) + '"' : '') + ' alt="" ' +
      (eager === true ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"') + ' decoding="async" referrerpolicy="no-referrer">';
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
    if (!p.a) return '';
    // «Хіт тижня» считает сервер по заказам за 7 дней; ручной бейдж (новинка, знижка, набір) важнее.
    if (p.hw && (!p.b || p.b === 'hit')) return '<span class="badge promo promo--hit">' + esc(t('badgeWeek')) + '</span>';
    return PROMO[p.b] ? '<span class="badge promo promo--' + p.b + '">' + esc(t(PROMO[p.b])) + '</span>' : '';
  }
  function priceHtml(cp) {
    return '<span class="price">' + money(cp.price) + '</span>' +
      (cp.old ? '<s class="price-old">' + money(cp.old) + '</s>' : '') + '<span class="unit">' + esc(cp.unit) + '</span>';
  }

  /** Компактная карточка для лент «Наша курага» и «Спеції від батька»: фото слева, название и цена справа, одна нажимаемая поверхность. */
  function rowCardHtml(p, eager) {
    var cp = cardPrice(p);
    return '<article class="mini mini--row" data-id="' + esc(p.id) + '"><div class="mini__img card__img">' + photoHtml(p, eager, true) + '</div>' +
      '<div class="mini__body"><h3 class="mini__name">' + esc(name(p)) + '</h3><div class="card__meta">' + (cp ? priceHtml(cp) : '') + '</div></div></article>';
  }
  /** Заголовок ленты: название и одна строка текста (обрезается многоточием); нажатие открывает шторку с полным текстом. */
  function laneHeadHtml(key, title, line) {
    if (!line) return '<h2 class="lane__hd"><span class="feature__title">' + esc(title) + '</span></h2>';
    return '<h2 class="lane__hd"><button type="button" class="lane__btn" data-w1="info" data-k="' + key + '"><span class="feature__title">' + esc(title) + '</span>' +
      '<span class="feature__text">' + esc(line) + '</span></button></h2>';
  }

  /** Данные блока «Наша курага»: товары в наличии (скрытых и пропавших из каталога нет), заголовок, текст. null — блока нет. */
  function featureData() {
    var f = shopInfo().feature;
    if (!f || !state.catalog) return null;
    // Старый бэкенд даёт один id; новый — список ids.
    var ids = Array.isArray(f.ids) && f.ids.length ? f.ids : [f.id], seenIds = {}, list = [];
    ids.forEach(function (id) {
      var q = state.catalog.byId[id];
      if (q && q.a && !seenIds[id]) { seenIds[id] = 1; list.push(q); }
    });
    if (!list.length) return null;
    return { list: list, title: loc(f.title) || (list.length === 1 ? name(list[0]) : t('featureAll')), text: loc(f.text), story: !!shopInfo().story };
  }
  function fatherData() {
    var f = shopInfo().father;
    if (!f || !Array.isArray(f.ids)) return null;
    var list = inStockList(f.ids).slice(0, 12);
    if (!list.length) return null;
    return { list: list, title: loc(f.title) || t('fatherTitle'), text: loc(f.text), story: false };
  }
  /** Блок наверху каталога («Наша курага»): одна лента карточек, одна строка текста; всё остальное — в шторке по нажатию. */
  function featureHtml() {
    var d = featureData();
    if (!d) return '';
    return '<section class="feature lane" data-lane="feature">' + ORN + (nyOnTheme() ? nyStrip('nyl', 'ny-strip ny-strip--lane') : '') + laneHeadHtml('feature', d.title, d.text || (d.story ? t('storyBtn') : '')) +
      '<div class="rail__list">' + d.list.map(function (q, i) { return rowCardHtml(q, i === 0); }).join('') + '</div></section>';
  }
  /** Шторка «Подробнее» к ленте: заголовок, полный текст, ссылка «Від саду до столу» (если есть история). */
  function infoSheetHtml(key) {
    var d = key === 'father' ? fatherData() : featureData();
    if (!d) return '<button type="button" class="sheet__close" aria-label="' + esc(t('close')) + '">' + icon('x') + '</button><div class="sheet__grab" aria-hidden="true"></div><div class="sheet__body"></div>';
    return '<button type="button" class="sheet__close" aria-label="' + esc(t('close')) + '">' + icon('x') + '</button>' +
      '<div class="sheet__grab" aria-hidden="true"></div>' +
      '<div class="sheet__body"><h2 class="sheet__title sheet__title--pad" id="sheetTitle">' + esc(d.title) + '</h2>' +
      (d.text ? '<p class="plus__text">' + esc(d.text) + '</p>' : '') + '</div>' +
      (d.story ? '<div class="sheet__foot"><button type="button" class="btn btn--primary btn--block" data-w1="go" data-view="story">' + esc(t('storyBtn')) + '</button></div>' : '');
  }
  function openInfo(key) {
    if (!(key === 'father' ? fatherData() : featureData())) return;
    state.sheet = { kind: 'info', key: key };
    renderSheet();
    showSheet(false);
  }

  /* ---- Б9. Одна строка «плюсов»: подарок, подарок постоянным, подбор, опт ---- */
  /** Подпись плашки подарка: условие, пока корзина пустая; потом — сколько осталось. Подробности и шкала — в шторке. */
  function giftPlusInner() {
    var s = shopInfo(), total = cartTotal();
    var label = !(total > 0) ? tf('plusGift', { n: money(s.gift.from) })
      : total >= s.gift.from ? t('plusGiftOk') : tf('plusGiftLeft', { n: money(s.gift.from - total) });
    return icon('gift') + '<span>' + esc(label) + '</span>';
  }
  /** Показ каждой плашки — по тем же условиям, что раньше: подарок и постоянным — если заданы в настройках, подбор — если есть теги, опт — для не оптовика в Telegram. */
  function plusKeys() {
    var s = shopInfo(), keys = [];
    if (s.gift) keys.push('gift');
    if (s.loyal) keys.push('loyal');
    if (quizOn()) keys.push('quiz');
    if (bizPlusOn()) keys.push('biz');
    return keys;
  }
  function plusHtml() {
    var s = shopInfo(), out = '';
    function item(key, ico, label) {
      return '<button type="button" class="plus__item" data-w1="plus" data-k="' + key + '">' + icon(ico) + '<span>' + esc(label) + '</span></button>';
    }
    plusKeys().forEach(function (k) {
      if (k === 'gift') out += '<button type="button" class="plus__item" id="homeGift" data-w1="plus" data-k="gift">' + giftPlusInner() + '</button>';
      else if (k === 'loyal') out += item(k, 'users', t('loyalTitle'));
      else if (k === 'quiz') out += item(k, 'sliders', t('quizBtn'));
      else out += item(k, 'store', t('plusBiz'));
    });
    return out ? '<div class="plus" role="group">' + out + '</div>' : '';
  }
  function plusSheetHtml(key) {
    var s = shopInfo(), title = '', body = '', go = '', goText = '';
    if (key === 'gift' && s.gift) { title = t('plusGiftTitle'); body = homeGiftHtml(); }
    else if (key === 'loyal' && s.loyal) { title = t('loyalTitle'); body = '<p class="plus__text">' + esc(tf('loyalText', { k: s.loyal.every, g: loc(s.loyal) })) + '</p>'; }
    else if (key === 'quiz') { title = t('quizTitle'); body = '<p class="plus__text">' + esc(t('plusQuizText')) + '</p>'; go = 'quiz'; goText = t('quizBtn'); }
    else if (key === 'biz') { title = t('bizTitle'); body = '<p class="plus__text">' + esc(t('bizIntro')) + '</p>'; go = 'biz'; goText = t('bizBtn'); }
    return '<button type="button" class="sheet__close" aria-label="' + esc(t('close')) + '">' + icon('x') + '</button>' +
      '<div class="sheet__grab" aria-hidden="true"></div>' +
      '<div class="sheet__body"><h2 class="sheet__title sheet__title--pad" id="sheetTitle">' + esc(title) + '</h2>' + body + '</div>' +
      (go ? '<div class="sheet__foot"><button type="button" class="btn btn--primary btn--block" data-w1="go" data-view="' + go + '">' + esc(goText) + '</button></div>' : '');
  }
  function openPlus(key) {
    if (plusKeys().indexOf(key) < 0) return;
    state.sheet = { kind: 'plus', key: key };
    renderSheet();
    showSheet(false);
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

  function cardHtml(p, eager) {
    var cp = cardPrice(p);
    return '<article class="card' + (p.a ? '' : ' card--out') + '" data-id="' + esc(p.id) + '">' +
      '<div class="card__img">' + photoHtml(p, eager, true) + badgeHtml(p) + promoHtml(p) + favBtn(p) + '</div>' +
      '<h2 class="card__name">' + esc(name(p)) + '</h2>' + cardExtraHtml(p) +
      '<div class="card__meta">' + (cp ? priceHtml(cp) : '') + '</div>' +
      '<div class="card__act" data-act="' + esc(p.id) + '">' + actHtml(p) + '</div></article>';
  }

  /** Маленькая карточка для горизонтальных подборок. quick — с кнопкой «+» (в корзине). */
  function miniHtml(p, quick) {
    var cp = cardPrice(p);
    return '<article class="mini" data-id="' + esc(p.id) + '"><div class="mini__img card__img">' + photoHtml(p, false, true) + promoHtml(p) +
      (quick ? '<button type="button" class="mini__add" data-quick="1" aria-label="' + esc(t('addToCart')) + '">' + icon('plus') + '</button>' : '') + '</div>' +
      '<h3 class="mini__name">' + esc(name(p)) + '</h3>' +
      '<div class="card__meta">' + (cp ? priceHtml(cp) : '') + '</div>' +
      (p.a && p.e && hasOld(p) ? '<p class="mini__till">' + esc(tf('tillShort', { d: dayMonth(p.e) })) + '</p>' : '') + '</article>';
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

  /** Сколько лент показывать на главной: настройка магазина railsMax (1…8); нет поля (старый бэкенд) или не число — 3. */
  function railsMax() {
    var v = shopInfo().railsMax, n = typeof v === 'number' ? v : (typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN);
    if (!isFinite(n)) return 3;
    return Math.max(1, Math.min(8, Math.floor(n)));
  }
  /**
   * Ленты главной списком объектов {key, title, sub, list, html}; в списке они уже в порядке показа.
   * Приоритет: «Ваше звичне» (нет — «Купити знову»), «Популярне», «Набори», дальше по прежнему порядку.
   * Точка расширения (Б11): праздничную подборку добавить вызовом add(-1, key, title, sub, list) в railItems() ниже — она встанет первой.
   */
  function railItems() {
    var all = state.catalog.products, items = [], usual = usualLines();
    function add(pri, key, title, sub, full, html) {
      if (!full.length) return;
      items.push({ key: key, title: title, sub: sub, list: full, pri: pri, html: html || railHtml(title, sub, full.slice(0, 10)), seq: items.length });
    }
    function two(list) { return list.length >= 2 ? list : []; }
    add(-1, 'gift', t('nyGiftsTitle'), nyUntilText(), nyGiftList()); // Б11: праздничная подборка — всегда первая и вне лимита railsMax
    if (usual.length) add(0, 'usual', t('usualTitle'), t('usualSub'), usual.map(function (l) { return product(l[0]); }), usualHtml());
    add(usual.length ? 3 : 0, 'again', t('secAgain'), '', inStockList(my.bought || []));
    if (all.length >= 8) { // в совсем маленьком каталоге подборки только повторяли бы список ниже
      var pop = popular(40);
      add(1, 'pop', t('secPop'), pop.real ? t('secPopSub') : '', two(pop.list));
      add(4, 'sale', t('secSale'), '', two(all.filter(function (p) { return p.a && hasOld(p); })));
      add(5, 'new', t('secNew'), '', two(all.filter(function (p) { return p.a && p.b === 'new'; })));
      add(2, 'sets', t('secSets'), '', two(all.filter(function (p) { return p.a && p.b === 'set'; })));
      add(6, 'foryou', t('secForYou'), '', two(forYou()));
    }
    add(7, 'seen', t('secSeen'), '', seen.map(product).filter(Boolean));
    items.sort(function (x, y) { return (x.pri - y.pri) || (x.seq - y.seq); });
    return items;
  }
  /**
   * Главная после «Нашей кураги»: {first} — первая непустая лента (она встаёт сразу под «Нашей курагой»,
   * чтобы на 360 × 640 карточки были на первом экране), {rest} — остальные ленты, чипы «Ще» и рецепты.
   */
  function homeRails() {
    var all = railItems(), max = railsMax();
    var items = all.filter(function (i) { return i.key !== 'gift'; });
    var shown = all.filter(function (i) { return i.key === 'gift'; }).concat(items.slice(0, max));
    var html = shown.slice(1).map(function (i) { return i.html; }).join('');
    var rest = items.slice(max);
    if (rest.length) { // лишние непустые ленты — строкой чипов; чип открывает отдельный экран со списком
      html += '<div class="morerails"><span class="morerails__label">' + esc(t('plusMore')) + '</span>' + rest.map(function (i) {
        return '<button type="button" class="chip chip--sm" data-w1="rail" data-k="' + esc(i.key) + '">' + esc(i.title) + '</button>';
      }).join('') + '</div>';
    }
    return { first: shown.length ? shown[0].html : '', rest: html + recipesHomeHtml() };
  }
  function railPageHtml() {
    var it = null;
    if (state.catalog) railItems().forEach(function (i) { if (i.key === state.rail) it = i; });
    if (!it) return pageHead(t('secAll')) + '<p class="state__text adm__msg">' + esc(t('railGone')) + '</p>';
    return pageHead(it.title) + (it.sub ? '<p class="rail__sub">' + esc(it.sub) + '</p>' : '') +
      '<div class="grid">' + it.list.map(function (p) { return cardHtml(p); }).join('') + '</div>' + (it.key === 'usual' ? usualBtnHtml() : '');
  }

  function skeletonHtml() {
    var cards = '';
    for (var i = 0; i < 6; i++) {
      cards += '<div class="skel"><div class="skel__img"></div><div class="skel__line"></div><div class="skel__line skel__line--short"></div><div class="skel__btn"></div></div>';
    }
    return '<div class="grid" aria-hidden="true">' + cards + '</div>';
  }

  function renderMain() {
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
      el.main.innerHTML = '<div class="state">' + art('search') +
        '<p class="state__title">' + esc(t('emptyTitle')) + '</p>' +
        '<p class="state__text">' + esc(t('emptyText')) + '</p>' +
        '<button type="button" class="btn" data-action="reset">' + esc(t('reset')) + '</button>' +
        (shopInfo().contact ? '<p class="state__text state__ask">' + esc(t('emptyAsk')) + '</p>' +
          '<button type="button" class="btn btn--primary" data-w1="contact">' + esc(t('writeUs')) + '</button>' : '') + '</div>' +
        railHtml(t('secPop'), '', popular(10).list);
      return;
    }
    var hr = home ? homeRails() : null;
    var html = home ? featureHtml() + hr.first + fatherHtml() + plusHtml() + hr.rest : '';
    // Список листается страницами по PAGE_SIZE товаров; номер страницы живёт в flt.page.
    flt.page = clampPage(flt.page, list.length, PAGE_SIZE);
    var from = (flt.page - 1) * PAGE_SIZE;
    html += '<div class="grid__head" id="gridHead"><h2 class="rail__title">' + esc(home ? t('secAll') : tf('found', { n: list.length })) + '</h2></div>' +
      '<div class="grid" id="grid">' + list.slice(from, from + PAGE_SIZE).map(function (p, i) { return cardHtml(p, i < 4); }).join('') + '</div>' +
      pagerHtml(list.length, flt.page, PAGE_SIZE);
    el.main.innerHTML = html;
  }

  /** Переход на страницу каталога: список прокручивается к своему началу (под чипы категорий), а не к верху экрана. */
  function setPage(n) {
    if (!state.catalog || n === flt.page) return;
    flt.page = n;
    renderMain();
    scrollToList(document.getElementById('gridHead'));
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
    flt.page = 1;
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
    flushStale();
  }
  /** Ответ пришёл, пока была открыта шторка: экран под ней не перерисовывался. Перерисовываем при закрытии, если он всё ещё актуален. */
  var stale = { main: '', fav: false, admin: false };
  function flushStale() {
    var s = stale; stale = { main: '', fav: false, admin: false };
    if (state.sheet) { stale = s; return; }
    if (s.main && state.view === 'catalog' && state.status === 'ready' && (s.main === 'force' || (isHome() && (window.scrollY || 0) < 200))) renderMain();
    if (s.fav && state.view === 'fav') renderPage();
    if (s.admin && state.view === 'admin' && !adm.loading && !adm.busy && !adm.edit && !adm.catEdit && !adm.admEdit && !adm.salesOpen && !adm.logOpen && !adm.archOpen && !adm.mailEdit) renderAdminList();
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
    if (s.kind === 'plus') { el.sheet.innerHTML = plusSheetHtml(s.key); return; }
    if (s.kind === 'info') { el.sheet.innerHTML = infoSheetHtml(s.key); return; }
    if (s.kind === 'confirm') { // подтверждение рисуется один раз: фоновое обновление каталога не должно сбрасывать его кнопки
      if (!s.drawn) { el.sheet.innerHTML = confirmSheetHtml(s.o); s.drawn = true; }
      return;
    }
    var p = state.catalog && state.catalog.byId[s.id];
    if (!p) { closeSheet(); return; }
    if (p.t === 'w' && s.vi >= p.v.length) s.vi = 0;
    var grams = p.t === 'w' ? (p.v[s.vi] ? p.v[s.vi][0] : 0) : 0;
    var max = maxQty(p, grams);
    if (s.qty > max) s.qty = Math.max(1, max);
    var total = lineTotal(p, s.vi, s.qty), old = oldTotal(p, s.vi, s.qty);
    var canBuy = p.a && total > 0 && max >= 1;

    var two = sheetPhoto2(p); // второе фото (необязательное поле i2): есть — лента из двух слайдов и точки, нет — как раньше
    var body = '<div class="sheet__img">' + (two ? '<div class="sheet__strip"><div class="sheet__slide">' + photoHtml(p) + '</div><div class="sheet__slide sheet__slide--2">' + two + '</div></div>' : photoHtml(p)) +
      '<div class="sheet__acts">' +
      '<button type="button" class="fav fav--share" data-action="share" aria-label="' + esc(t('share')) + '">' + icon('share') + '</button>' +
      favBtn(p) + '</div></div>' + (two ? sheetDotsHtml(s.slide || 0) : '') +
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
    body += setHtml(p) + howHtml(p) + compHtml(p) + passportHtml(p) + recipeLinksHtml(p);

    if (p.a) {
      if (p.t === 'w') {
        body += '<div><p class="label">' + esc(t('packing')) + '</p><div class="weights" role="group" aria-label="' + esc(t('packing')) + '">';
        p.v.forEach(function (v, i) {
          body += '<button type="button" data-vi="' + i + '" aria-pressed="' + (i === s.vi) + '"' + (maxQty(p, v[0]) < 1 ? ' disabled' : '') + '><b>' + weight(v[0]) + '</b><span>' + money(v[1]) + '</span></button>';
        });
        body += '</div></div>';
      } else if (jarText(p) || p.pk) {
        body += '<div><p class="label">' + esc(t('packing')) + '</p><div class="weights"><button type="button" aria-pressed="true" tabindex="-1"><b>' +
          esc(jarText(p) || p.pk.replace(/ /g, NBSP)) + '</b></button></div></div>';
      }
      body += sheetHintsHtml(p);
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

    body += whSheetHtml(p); // оптовая цена видна только одобренному оптовику; остальным — ссылка на форму «Для бізнесу»

    var rel = relatedFor(p);
    body += reviewsHtml(p);
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
    var strip = el.sheet.querySelector('.sheet__strip');
    if (strip && s.slide) strip.scrollLeft = strip.clientWidth * s.slide; // шторку перерисовали (количество, фасовка) — остаёмся на том же фото
  }

  /**
   * Набор (необязательные поля ks и kp от бэкенда Б2): состав со ссылками и строка «Окремо … · набором …».
   * ID, которого нет в каталоге, не показываем; ни одного названия — блока нет. Сумму не считаем: kp приходит с сервера.
   */
  function setHtml(p) {
    if (!p || !Array.isArray(p.ks) || !p.ks.length) return '';
    var seen = {}, list = [];
    p.ks.forEach(function (id) {
      var c = product(String(id));
      if (c && c.id !== p.id && !seen[c.id]) { seen[c.id] = 1; list.push(c); }
    });
    var html = '';
    if (list.length) {
      html += '<p class="label">' + esc(t('setComp')) + '</p><ul class="setc__list">' + list.map(function (c) {
        return '<li><button type="button" class="linkbtn setc__link" data-w1="sheet-open" data-pid="' + esc(c.id) + '">' + esc(name(c)) + '</button></li>';
      }).join('') + '</ul>';
    }
    var own = p.t === 'w' ? 0 : Number(p.p) || 0, kp = Number(p.kp);
    if (p.a && own > 0 && kp > own) html += '<p class="setc__sep">' + esc(tf('setSep', { a: money(kp), b: money(own) })) + '</p>';
    return html ? '<div class="how setc">' + html + '</div>' : '';
  }

  /** Второе фото товара: только http(s)-ссылка из необязательного поля i2 и только пока оно не упало при загрузке. Нет — пустая строка. */
  var badPhoto2 = {};
  function sheetPhoto2(p) {
    var u = p && typeof p.i2 === 'string' ? p.i2.trim() : '';
    if (!u || !p.img || badPhoto2[p.id] || !/^https?:\/\//i.test(u)) return '';
    return '<img src="' + esc(verUrl(u)) + '" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">';
  }
  function sheetDotsHtml(cur) {
    // Вся полоска точек — одна кнопка (в Telegram на компьютере свайпа нет): нажатие переключает на другое фото. Свайп остаётся.
    var h = '<button type="button" class="sheet__dots" data-action="photo-next" aria-label="' + esc(t('photoNext')) + '">';
    for (var i = 0; i < 2; i++) h += '<span class="sheet__dot' + (i === cur ? ' is-on' : '') + '" aria-hidden="true"></span>';
    return h + '</button>';
  }
  function sheetMarkDot(i) {
    if (state.sheet) state.sheet.slide = i;
    [].forEach.call(el.sheet.querySelectorAll('.sheet__dot'), function (d, k) {
      d.classList.toggle('is-on', k === i);
    });
  }
  function sheetPhotoNext() {
    var strip = el.sheet.querySelector('.sheet__strip');
    if (!strip || !state.sheet || !strip.clientWidth) return;
    var to = state.sheet.slide === 1 ? 0 : 1, calm = false;
    try { calm = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { /* без matchMedia — плавно */ }
    sheetMarkDot(to); // отклик сразу, не дожидаясь конца прокрутки
    state.sheet.goto = to;
    var sh = state.sheet;
    setTimeout(function () { if (sh.goto === to) delete sh.goto; }, 700);
    try { strip.scrollTo({ left: strip.clientWidth * to, behavior: calm ? 'auto' : 'smooth' }); } catch (e) { strip.scrollLeft = strip.clientWidth * to; }
  }
  /** Второе фото не загрузилось — убираем слайд и точки, остаётся как с одним фото. */
  function dropPhoto2() {
    if (state.sheet && state.sheet.id) badPhoto2[state.sheet.id] = true;
    var strip = el.sheet.querySelector('.sheet__strip');
    if (state.sheet) state.sheet.slide = 0;
    if (strip) {
      var first = strip.querySelector('.sheet__slide');
      strip.parentNode.replaceChild(first ? (first.firstChild || document.createTextNode('')) : document.createTextNode(''), strip);
    }
    var dots = el.sheet.querySelector('.sheet__dots');
    if (dots) dots.parentNode.removeChild(dots);
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
  var notifying = {};
  function notifyMe(id, btn) {
    if (!cfg.API_URL || !inTelegram) { toast(t('notifyTg')); return; }
    if (notifying[id]) return;
    notifying[id] = true;
    btnBusy(btn);
    askWriteAccess().then(function () { return postApi('notify', { id: id, lang: state.lang }); }).then(function (res) {
      notifying[id] = false; btnFree(btn);
      if (!res || !res.ok) throw new Error('fail');
      if (res.instock) { loadCatalog(true); return; } // direct: покупатель видит «немає», а товар уже вернулся — Worker мог держать старую копию // товар уже вернулся — просто обновляем витрину
      if (subs.indexOf(id) < 0) { subs.unshift(id); subs = subs.slice(0, 40); saveList(SUBS_KEY, '', subs); }
      haptic('success');
      track('notify', id);
      toast(t(res.dup ? 'notifyDup' : 'notifyOk'));
      if (state.sheet && state.sheet.id === id) renderSheet();
    }).catch(function () { notifying[id] = false; btnFree(btn); haptic('error'); toast(t('notifyFail')); });
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
    var w = price > 0 ? whUnit(p, l.g) : 0; // оптовая цена — когда набран минимальный объём товара
    var isWh = w > 0 && w < price;
    if (isWh) price = w;
    return { p: p, ok: price > 0, price: price, sum: price * l.q, wh: isWh };
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
    scheduleCartSync();
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
        var cloud = err || cdvDone ? null : parseCart(value);
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
    fly(el.sheet.querySelector('.sheet__img img, .sheet__img .mark'));
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
      flyFromCard(id);
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
    var homeGift = document.getElementById('homeGift');
    if (homeGift && shopInfo().gift) homeGift.innerHTML = giftPlusInner();
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
  var hapticAt = 0; // одно нажатие — одна вибрация, даже если её просят и общий обработчик, и сама кнопка
  function hapticOnce() {
    var now = Date.now();
    if (!inTelegram || now - hapticAt < 80) return false;
    hapticAt = now;
    return true;
  }
  function hapticLight() {
    if (!hapticOnce()) return;
    try { tg.HapticFeedback.impactOccurred('light'); } catch (e) { /* нет вибрации */ }
  }
  function hapticSelect() {
    if (!hapticOnce()) return;
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
    if (SUB_VIEWS[view] && state.view !== view && !SUB_VIEWS[state.view]) state.back = state.view; // экраны «второго уровня»: «Назад» возвращает туда, откуда пришли
    var changed = state.view !== view;
    state.view = view;
    document.body.setAttribute('data-view', view);
    if (view === 'catalog') renderMain();
    renderPage();
    updateChrome();
    if (view === 'admin') loadAdmin(false);
    if (view === 'orders') loadMyOrders();
    if (view === 'biz') loadWh(true);
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
    if (state.view === 'admin' && (adm.edit || adm.catEdit || adm.salesOpen || adm.admEdit || adm.logOpen || adm.archOpen || adm.mailEdit)) {
      var reload = !!adm.invite;
      adm.edit = ''; adm.catEdit = ''; adm.salesOpen = false; adm.admEdit = ''; adm.invite = null; adm.logOpen = false; adm.archOpen = false; adm.mailEdit = null;
      renderPage();
      if (reload) loadAdmin(false);
      return;
    }
    if (state.view === 'recipe' && state.recFrom === 'recipes') { go('recipes'); return; }
    if (SUB_VIEWS[state.view]) { go(state.back && state.back !== 'done' ? state.back : 'catalog'); return; }
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
      hapticLight();
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
    document.body.classList.toggle('has-tabbar', tabs); document.documentElement.classList.toggle('has-tabbar', tabs); // для scroll-padding: scrollIntoView не прячет блок под панелью

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
    if (state.view === 'cart') { el.page.innerHTML = cartHtml(); tweenCartSum(); npCostSync(); }
    else if (state.view === 'checkout') { el.page.innerHTML = checkoutHtml(); syncCheckout(); }
    else if (state.view === 'done') el.page.innerHTML = doneHtml();
    else if (state.view === 'admin') { el.page.innerHTML = adminHtml(); lockAdminForm(); }
    else if (state.view === 'orders') el.page.innerHTML = profileHtml();
    else if (state.view === 'fav') el.page.innerHTML = favHtml();
    else if (state.view === 'points') el.page.innerHTML = pointsHtml();
    else if (state.view === 'story') el.page.innerHTML = storyHtml();
    else if (state.view === 'biz') el.page.innerHTML = bizHtml();
    else if (state.view === 'recipe') el.page.innerHTML = recipeHtml();
    else if (state.view === 'quiz') el.page.innerHTML = quizHtml();
    else if (state.view === 'rail') el.page.innerHTML = railPageHtml();
    else if (state.view === 'recipes') el.page.innerHTML = recipesPageHtml();
    else el.page.innerHTML = '';
  }

  /* ------------------------------ Экран корзины ------------------------------ */
  /** Возвращает обычный текст (не HTML): при выводе в разметку вызывающий код сам делает esc(). */
  function lineLabel(l, info) {
    var p = info.p || product(l.id);
    if (l.g) return weight(l.g);
    if (jarText(p)) return jarText(p);
    if (p && p.t === 'p' && p.pk) return p.pk.replace(/ /g, NBSP);
    return '1' + NBSP + t('pcs');
  }

  function favHtml() {
    var html = pageHead(t('favTitle'), true);
    if (!state.catalog) return html + skeletonHtml();
    var list = favs.map(product).filter(Boolean);
    if (!list.length) {
      return html + '<div class="state">' + art('fav') +
        '<p class="state__title">' + esc(t('favEmptyTitle')) + '</p><p class="state__text">' + esc(t('favEmpty')) + '</p>' +
        '<button type="button" class="btn btn--primary" data-nav="catalog">' + esc(t('toCatalog')) + '</button></div>';
    }
    return html + '<div class="grid">' + list.map(function (p) { return cardHtml(p); }).join('') + '</div>';
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

  /* ---- Подсказка в корзине (shop.hint = {tag, id, ua, ru}); нет поля — ничего не меняется ---- */
  function tagKey(x) { return String(x || '').toLowerCase().replace(/[ʼ’'`]/g, '').replace(/\s+/g, ' ').trim(); }
  /** Подсказка, которую надо показать сейчас: в корзине есть товар с тегом, нет товара id; товар id есть в каталоге и в наличии. */
  function activeHint() {
    var h = shopInfo().hint;
    if (!h || typeof h !== 'object' || !h.tag || !h.id || !state.catalog) return null;
    var text = String(state.lang === 'ru' ? (h.ru || h.ua) : (h.ua || h.ru) || '');
    if (!text) return null;
    var tag = tagKey(h.tag), id = String(h.id), p = product(id);
    if (!p || !p.a || !(unitPrice(p, hintGrams(p)) > 0)) return null;
    var tagged = false, have = false;
    state.cart.i.forEach(function (l) {
      if (l.id === id) have = true;
      var q = product(l.id);
      if (q && tagsOf(q).some(function (x) { return tagKey(x) === tag; })) tagged = true;
    });
    return tagged && !have ? { p: p, text: text } : null;
  }
  /** Фасовка для обычной кнопки: у весового — первая, которой хватает на складе (как при открытии шторки). */
  function hintGrams(p) {
    if (p.t !== 'w') return 0;
    for (var i = 0; i < p.v.length; i++) if (maxQty(p, p.v[i][0]) >= 1) return p.v[i][0];
    return 0;
  }
  function cartHintHtml() {
    var h = activeHint();
    if (!h) return '';
    return '<div class="chint" id="cartHint"><p class="chint__text">' + esc(h.text) + '</p>' +
      '<button type="button" class="btn btn--soft" data-w1="hint-add" data-pid="' + esc(h.p.id) + '">' + esc(t('hintAdd')) + '</button></div>';
  }
  function addHint(btn) {
    var p = product(btn.getAttribute('data-pid')), g = p ? hintGrams(p) : 0;
    var price = unitPrice(p, g);
    if (!p || !(price > 0) || maxQty(p, g) < 1) { haptic('error'); return; }
    btn.disabled = true; btn.classList.add('is-busy');
    var line = null;
    state.cart.i.forEach(function (l) { if (l.id === p.id && l.g === g) line = l; });
    if (line) { line.q = Math.min(MAX_QTY, line.q + 1); line.pr = price; } else state.cart.i.push({ id: p.id, g: g, q: 1, pr: price });
    saveCart();
    haptic('success');
    track('add', p.id, 'hint');
    afterCartChange(true); // корзина перерисуется, подсказка исчезнет (товар уже в корзине)
    toast(t('added'));
  }

  function cartHtml() {
    var html = pageHead(t('cart'), true);
    if (state.cartNotice) html += state.cartNoticeInfo
      ? '<p class="note note--opt" role="status">' + esc(state.cartNotice) + '</p>'
      : '<p class="form__err" role="alert">' + esc(state.cartNotice) + '</p>';
    if (!state.cart.i.length) {
      return html + '<div class="state">' + art('cart') +
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
        '<div class="line__img">' + (p ? photoHtml(p, false, true) : MARK) + '</div>' +
        '<div class="line__text"><p class="line__name">' + esc(p ? name(p) : l.id) + '</p>' +
        '<p class="line__sub">' + esc(lineLabel(l, info)) +(info.ok ? ' · ' + money(info.price) : '') + (info.wh ? ' <span class="badge badge--opt">' + esc(t('whTag')) + '</span>' : '') + '</p>' + note + '</div>' +
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
    html += cartHintHtml();
    if (hasOut) html += '<button type="button" class="btn btn--block" data-action="clear-out">' + esc(t('removeOut')) + '</button>';
    html += nyUntilHtml() + whCartHtml() + refCartHtml() + cartPerksHtml();
    html += '<div class="sum"><span>' + esc(t('total')) + '</span><span class="total">' + money(cartTotal()) + '</span></div>';
    if (state.form.delivery === 'np') html += npCostHtml(); // нет shop.npp — пустая строка, корзина как раньше
    html += railHtml(t('cartMore'), '', crossSell(), true);
    html += '<button type="button" class="btn btn--ghost btn--block" data-action="clear-cart">' + icon('trash-2') + esc(t('clearCart')) + '</button>';
    return html;
  }

  /* ------------------------------ Оформление ------------------------------ */
  function loadForm() {
    try {
      var f = JSON.parse(store.get(FORM_KEY) || 'null');
      applyForm(f);
    } catch (e) { /* испорченная копия — игнорируем */ }
    loadFormCloud();
    if (!state.form.name && tgUser) {
      state.form.name = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ').slice(0, 60);
    }
  }

  function saveForm() {
    var f = state.form;
    // Комментарий и подпись к подарку тоже хранятся на устройстве (не в облаке): сбой отправки или перезагрузка не стирают текст.
    var saved = { name: f.name, phone: f.phone, delivery: f.delivery, city: f.city, branch: f.branch, pay: f.pay, npType: f.npType, point: f.point, comment: f.comment, giftNote: f.giftNote, ifOut: f.ifOut };
    if (f.cityRef && f.cityRefFor === f.city) { saved.cityRef = f.cityRef; saved.cityRefFor = f.cityRefFor; } // Ref города из подсказки Новой почты: только пока совпадает с текстом города
    store.set(FORM_KEY, JSON.stringify(saved));
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
    return pageHead(t('checkout')) + nyUntilHtml() +
      '<div class="cosum"><div><p class="cosum__n">' + esc(tf('coItems', { n: cartCount() })) + '</p><p class="total js-sum">' + money(cartTotal()) + '</p></div>' +
      '<button type="button" class="btn" data-nav="back">' + esc(t('edit')) + '</button></div>' + gift +
      '<form class="form" id="form" novalidate>' +
      '<p class="form__err" id="formErr" role="alert" hidden></p>' +
      field('name', esc(t('fName')), 'type="text" autocomplete="name" maxlength="60" enterkeyhint="next"', f.name) +
      field('phone', esc(t('fPhone')), 'type="tel" inputmode="tel" autocomplete="tel" maxlength="20" enterkeyhint="next"', f.phone || '+380', share) +

      '<fieldset class="group"><legend class="label">' + esc(t('delivery')) + '</legend><div class="opts">' +
      option('delivery', 'pickup', 'store', t('pickup')) + option('delivery', 'np', 'truck', t('np')) + '</div>' +
      '<div id="pickupInfo" class="stack">' + pickupHtml(addr, hours) + '</div>' +
      '<div id="npFields" class="stack">' + npFieldsHtml() + npCostHtml() + '</div></fieldset>' +

      '<fieldset class="group"><legend class="label">' + esc(t('payment')) + '</legend><div class="opts opts--col">' +
      payMethods().map(function (k) { return option('pay', k, '', payName(k)); }).join('') + '</div>' +
      '<p class="info info__muted" id="cardNote">' + esc(t(shopInfo().fop ? 'payCardNoteFop' : 'payCardNote')) + '</p>' +
      '<p class="info info__muted" id="codNote" hidden></p></fieldset>' +

      '<div class="field"><label class="label" for="f-comment">' + esc(t('fComment')) + ' <span class="label__opt">(' + esc(t('optional')) + ')</span></label>' +
      '<textarea class="input input--area" id="f-comment" name="comment" rows="3" maxlength="300" placeholder="' + esc(t('commentPh')) + '">' + esc(f.comment) + '</textarea></div>' +
      giftNoteHtml() + ifoHtml() +

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
    syncNp();
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
    // Комиссия Новой почты за наложенный платёж: только текст, сумму заказа не меняет. Вторая фраза — если оплата на счёт ФОП доступна в этом заказе.
    var codNote = document.getElementById('codNote');
    if (codNote) {
      var showCod = np && state.form.pay === 'cod';
      if (showCod) codNote.textContent = t('codNote') + (shopInfo().fop && payMethods().indexOf('card') >= 0 ? ' ' + t('codNoteFop') : '');
      codNote.hidden = !showCod;
    }
    npCostSync();
  }

  function updateCheckoutSum() {
    Array.prototype.forEach.call(el.page.querySelectorAll('.js-sum'), function (sum) { sum.textContent = money(cartTotal()); });
    npCostSync();
    if (!(cartTotal() > 0)) go('cart');
  }

  function readForm() {
    var form = document.getElementById('form');
    if (!form) return;
    var f = state.form;
    f.name = form.elements.name.value.trim();
    f.phone = form.elements.phone.value.trim();
    f.city = form.elements.city.value.trim();
    var ref = npRefNow(f.city); f.cityRef = ref; f.cityRefFor = ref ? f.city : '';
    f.branch = form.elements.branch.value.trim();
    f.comment = form.elements.comment.value.trim();
    if (form.elements.giftNote) f.giftNote = form.elements.giftNote.value.replace(/\s+/g, ' ').trim().slice(0, 120);
    f.delivery = form.elements.delivery.value === 'np' ? 'np' : 'pickup';
    f.npType = { locker: 'locker', courier: 'courier' }[form.elements.npType ? form.elements.npType.value : ''] || 'branch';
    if (form.elements.point && form.elements.point.value) f.point = form.elements.point.value;
    f.pay = { card: 'card', cod: 'cod' }[form.elements.pay.value] || 'cash';
    if (form.elements.ifOut) f.ifOut = { replace: 'replace', remove: 'remove' }[form.elements.ifOut.value] || 'call';
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
      if (!f.branch) errors.branch = t(f.npType === 'courier' ? 'errAddr' : 'errBranch');
      else if (f.npType === 'courier' && f.branch.length < 5) errors.branch = t('errAddr');
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
    var order = {
      items: state.cart.i.filter(function (l) { return lineInfo(l).ok; })
        .map(function (l) { return { id: l.id, g: l.g, q: l.q }; }),
      name: f.name, phone: f.phone.replace(/\s+/g, ''),
      delivery: f.delivery, city: f.delivery === 'np' ? f.city : '', branch: f.delivery === 'np' ? f.branch : '',
      npType: f.delivery === 'np' ? (f.npType || 'branch') : '', point: f.delivery === 'pickup' ? (f.point || '') : '',
      pay: f.pay, comment: f.comment, giftNote: giftNoteOn() ? f.giftNote : '', src: srcStored(), lang: state.lang, total: cartTotal(), ref: refStored(),
      initData: inTelegram ? tg.initData : '', test: DEBUG
    };
    if (ifoOn()) order.ifOut = f.ifOut === 'replace' || f.ifOut === 'remove' ? f.ifOut : 'call'; // нет флага shop.ifo (старый бэкенд) — поля нет
    var cref = f.delivery === 'np' ? npRefNow(f.city) : '';
    if (cref) order.cityRef = cref; // город выбран из подсказки Новой почты (введён руками — поля нет); сервер на цену и сумму его не использует
    return order;
  }

  function newRid() {
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
  }

  /** Отправка на сервер. text/plain — чтобы браузер не делал предварительный CORS-запрос. */
  function sendOrder(order) {
    if (!cfg.API_URL) return Promise.resolve({ ok: true, number: '', stub: true }); // демо без бэкенда
    if (!state.rid) setRid(newRid());
    order.action = 'order';
    order.rid = state.rid;
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 45000);
    var st = netStart(); // заказ не повторяется автоматически (ключ rid и кнопка «повторить»), но ложную ошибку не пишем
    return fetch(cfg.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(order),
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (r) {
      clearTimeout(timer);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }, function (err) { clearTimeout(timer); throw err; }).catch(function (err) { netFail('order', err, st, true, true); throw err; });
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

  function showFormError(text, linkBot, retry) {
    var box = document.getElementById('formErr');
    if (!box) return;
    box.innerHTML = esc(text) + (linkBot && cfg.BOT
      ? ' <a href="https://t.me/' + esc(cfg.BOT) + '">@' + esc(cfg.BOT) + '</a>' : '') +
      (retry ? '<button type="button" class="btn btn--block form__retry" data-action="retry-order">' + esc(t('retryOrder')) + '</button>' : '');
    box.hidden = false;
    box.scrollIntoView({ block: 'center' });
  }

  var sending = false;
  function setBusy(busy) {
    sending = busy;
    el.barBtn.disabled = busy;
    el.barBtn.classList.toggle('is-busy', busy);
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
      if (!res || !res.ok) { orderFailed(res && res.error, res); return; }
      state.done = { number: res.number || '', stub: !!res.stub, test: DEBUG && !res.stub, lines: lines, total: total, delivery: state.form.delivery, pay: state.form.pay,
        npType: state.form.npType, point: state.form.delivery === 'pickup' && pointById(state.form.point) ? loc(pointById(state.form.point)) : '',
        gifts: Array.isArray(res.gifts) ? res.gifts : [] };
      if (!res.stub) { store.set(HASORD_KEY, '1'); my.list = null; store.set(REF_KEY, ''); } // приглашение засчитывается только к первому заказу
      track('order', res.number || '', total);
      flushEvents(false);
      saveFormCloud();
      state.cart.i = [];
      state.form.comment = ''; state.form.giftNote = '';
      saveForm();
      setRid('');
      saveCart();
      setBusy(false);
      haptic('success');
      go('done');
    }).catch(function () { orderFailed('network'); });
  }

  /** Сервер уже принял заказ с этим ключом, а корзина с тех пор изменилась: ничего не очищаем, следующий заказ — с новым ключом. */
  function dupChanged(res) {
    var box = document.getElementById('formErr');
    var num = res && /^[\w-]{1,20}$/.test(String(res.number || '')) ? String(res.number) : '';
    if (!box) return;
    box.innerHTML = esc(num ? tf('dupChanged', { n: num }) : t('dupChangedNoNum')) +
      '<button type="button" class="btn btn--block form__retry" data-go="orders">' + esc(t('myOrders')) + '</button>' +
      '<button type="button" class="btn btn--primary btn--block form__retry" data-go="cart">' + esc(t('dupEditCart')) + '</button>' +
      '<button type="button" class="btn btn--block btn--wrap form__retry" data-action="send-new">' + esc(t('sendAsNew')) + '</button>' +
      (shopInfo().contact ? '<button type="button" class="btn btn--block form__retry" data-w1="contact">' + esc(t('dupWrite')) + '</button>' : '');
    box.hidden = false;
    box.scrollIntoView({ block: 'center' });
  }

  function orderFailed(code, res) {
    haptic('error');
    if (code === 'dup_changed') {
      setRid('');
      setBusy(false);
      dupChanged(res);
      return;
    }
    if (code === 'changed') {
      // Сервер пересчитал заказ по таблице и получил другую сумму: показываем свежую корзину.
      setRid('');
      loadWh(true); // статус оптовика мог измениться — цены в корзине пересчитаются
      loadCatalog(true).then(function () {
        setBusy(false);
        state.cartNoticeInfo = false; state.cartNotice = t('cartChanged');
        go('cart');
      });
      return;
    }
    setBusy(false);
    if (code === 'min_order') { showFormError(t('minOrder') + ' ' + money(Number(shopInfo().min) || 0)); return; }
    var known = { rate_limit: 'errRate', bad_auth: 'errAuth', test_off: 'errTestOff' }[code];
    if (known) { showFormError(t(known)); return; }
    // Сеть, таймаут, ошибка сервера: корзина, форма и ключ попытки сохранены — повтор не создаст второй заказ.
    showFormError(t('errSendRetry'), false, true);
  }

  function doneHtml() {
    var d = state.done;
    if (!d) return '';
    var html = '<div class="done">' + ORN + MOUNT +
      '<h2 class="page__title">' + esc(t('doneTitle')) + (d.number ? ' <span class="nowrap">' + esc(d.number) + '</span>' : '') + '</h2>' +
      '<p class="done__text">' + esc(t('doneText')) + '</p></div>';
    (d.gifts || []).forEach(function (g) {
      html += '<p class="note note--gift">' + icon('gift') + '<span>' + esc(tf('doneGift', { g: g })) + '</span></p>';
    });
    if (d.stub) html += '<p class="note note--out">' + esc(t('doneStub')) + '</p>';
    else if (d.test) html += '<p class="note note--opt">' + esc(t('doneTest')) + '</p>';
    html += '<div class="recap"><p class="label">' + esc(t('order')) + '</p><ul class="recap__list">';
    d.lines.forEach(function (l) {
      html += '<li><span>' + esc(l.name) + ', ' + esc(l.label) + ' × ' + l.q + '</span><span class="recap__sum">' + money(l.sum) + '</span></li>';
    });
    html += '</ul><p class="recap__meta">' + esc(t('delivery')) + ': ' + esc(deliveryText(d)) + '<br>' +
      esc(t('payment')) + ': ' + esc(payName(d.pay)) + '</p>' +
      '<div class="sum"><span>' + esc(t('total')) + '</span><span class="total">' + money(d.total) + '</span></div></div>' +
      '<button type="button" class="btn btn--primary btn--block" data-nav="catalog">' + esc(t('doneBack')) + '</button>' +
      (inTelegram && !d.stub ? '<button type="button" class="btn btn--block" data-go="orders">' + esc(t('myOrders')) + '</button>' : '');
    return html;
  }

  /* ------------------------------ Мои заказы (этап 6) ------------------------------ */
  var my = { list: null, loading: false, error: '', bought: [], done: null };

  /** Один POST к API. limit (мс) задаётся только второй попытке чтения; у первой своего таймаута нет. */
  function postFetch(body, limit) {
    var ctrl = limit && window.AbortController ? new AbortController() : null, timedOut = false;
    var timer = ctrl ? setTimeout(function () { timedOut = true; ctrl.abort(); }, limit) : null;
    return fetch(cfg.API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body), signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (d) { clearTimeout(timer); return d; }, function (err) { clearTimeout(timer); if (timedOut && err && typeof err === 'object') err.ownTimeout = true; throw err; });
  }

  function postApi(action, data) {
    var body = { action: action, initData: inTelegram ? tg.initData : '' };
    Object.keys(data || {}).forEach(function (k) { body[k] = data[k]; });
    return netGuard(action, function (limit) { return postFetch(body, limit); });
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
      else if (state.view === 'catalog' && state.status === 'ready' && isHome() && my.bought.join() !== had && (window.scrollY || 0) < 200) {
        if (state.sheet) { if (!stale.main) stale.main = 'usual'; } // шторка открыта: перерисуем при закрытии
        else renderMain();
      }
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
    html += '<h3 class="sec">' + esc(t('ptsTitle')) + '</h3><button type="button" class="btn btn--block" data-w1="go" data-view="points">' + icon('pin') + esc(t('ptsBtn')) + '</button>' +
      (shop.story ? '<button type="button" class="btn btn--block" data-w1="go" data-view="story">' + icon('sprout') + esc(t('storyBtn')) + '</button>' : '') +
      (shop.contact ? '<button type="button" class="btn btn--block" data-w1="contact">' + esc(t('writeUs')) + '</button>' : '') +
      (bizAvailable() ? '<button type="button" class="btn btn--block" data-w1="go" data-view="biz">' + esc(t('bizBtn')) + '</button>' : '') + refHtml();
    if (!points().length && (addr || hours)) {
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
      return html + '<div class="state state--sm">' + art('orders') + '<p class="state__title">' + esc(t('myEmpty')) + '</p><p class="state__text">' + esc(t('myEmptyText')) + '</p>' +
        '<button type="button" class="btn btn--primary" data-nav="catalog">' + esc(t('toCatalog')) + '</button></div>';
    }
    html += '<ul class="lines">' + my.list.map(function (o) {
      var items = orderItemsHtml(o.items);
      return '<li class="my"><div class="my__head"><span class="ord__num">' + esc(o.num) + '</span>' +
        '<span class="badge ' + (STATUS_BADGE[o.status] || '') + '">' + esc(t('ost_' + o.status) === 'ost_' + o.status ? o.status : t('ost_' + o.status)) + '</span>' +
        '<span class="my__date">' + esc(o.date) + '</span></div>' +
        '<ul class="my__items">' + items + '</ul>' +
        (o.ttn ? '<p class="my__ttn"><span>' + esc(t('ttn')) + ': <b>' + esc(o.ttn) + '</b></span><button type="button" class="btn" data-w1="open" data-url="https://novaposhta.ua/tracking/?cargo_number=' + esc(o.ttn) + '">' + esc(t('track')) + '</button></p>' : '') +
        (o.paid === 'paid' || o.paid === 'refund' ? '<p class="my__paid"><span class="badge ' + (o.paid === 'paid' ? 'badge--stock' : 'badge--out') + '">' + esc(t('pay_' + o.paid)) + '</span></p>' : '') +
        '<div class="my__foot"><span class="total">' + money(o.total) + '</span>' +
        (o.i ? '<button type="button" class="btn btn--soft" data-repeat="' + esc(o.num) + '">' + icon('rotate') + esc(t('repeat')) + '</button>'
             : '<span class="my__old">' + esc(t('repeatOld')) + '</span>') + '</div></li>';
    }).join('') + '</ul>' +
      '<button type="button" class="btn btn--block' + (my.loading ? ' is-busy" disabled aria-busy="true' : '') + '" data-action="my-refresh">' + esc(t('myRefresh')) + '</button>';
    return html;
  }

  /** «Повторить заказ»: кладём в корзину то, что сейчас можно купить по тем же фасовкам. */
  function repeatOrder(num, given) {
    var order = given || null; // given — заказ из ответа «one» (ссылка re-<номер>), его может не быть среди последних 20
    if (!order) (my.list || []).forEach(function (o) { if (o.num === num) order = o; });
    if (!order || !order.i) return false;
    var skipped = []; // названия товаров, которые сейчас купить нельзя: клиент видит, чего нет в корзине
    var added = 0, gone = 0; // gone — товаров больше нет в магазине (в архиве или удалены): их пропускаем
    order.i.forEach(function (it) {
      var id = String(it[0]), g = Number(it[1]) || 0, q = Math.max(1, Math.min(MAX_QTY, Math.floor(Number(it[2])) || 1));
      var p = product(id);
      if (!p) gone++;
      var price = unitPrice(p, g);
      if (!(price > 0)) { if (p && skipped.indexOf(name(p)) < 0) skipped.push(name(p)); return; }
      var line = null;
      state.cart.i.forEach(function (l) { if (l.id === id && l.g === g) line = l; });
      if (line) { line.q = Math.min(MAX_QTY, line.q + q); line.pr = price; }
      else state.cart.i.push({ id: id, g: g, q: q, pr: price });
      added++;
    });
    if (!added) { toast(t(gone === order.i.length ? 'repeatGoneAll' : 'repeatNone') + (skipped.length ? ' ' + tf('repeatSkip', { list: skipped.join(', ') }) : '')); haptic('error'); return false; }
    track('repeat', num, added);
    saveCart();
    haptic('success');
    state.cartNotice = added === order.i.length ? t('repeatOk')
      : (gone ? t('repeatGone') + ' ' : '') + t(gone === order.i.length - added ? 'repeatAdded' : 'repeatPart').replace('{a}', added).replace('{b}', order.i.length) +
        (skipped.length ? ' ' + tf('repeatSkip', { list: skipped.join(', ') }) : '');
    renderMain();
    go('cart');
    state.cartNoticeInfo = true; // это подсказка, а не ошибка
    renderPage();
    return true;
  }

  /**
   * Повтор заказа по ссылке из сообщения бота: startapp=re-<цифры> (номер заказа P-<цифры>). Один раз за открытие, когда каталог свежий.
   * Нет поля one в ответе (старый бэкенд, чужой заказ, ошибка сети) — просто «Мої замовлення», без ошибки.
   */
  var reNum = (function () {
    var m = /^re-(\d{1,10})$/.exec(String((inTelegram && tg.initDataUnsafe && tg.initDataUnsafe.start_param) || params.get('p') || params.get('tgWebAppStartParam') || '').trim().toLowerCase());
    return m ? m[1] : '';
  })();
  var reRan = false;
  function openReLink() {
    if (!reNum || reRan || !state.catalog) return;
    reRan = true;
    function fallback() { if (state.view === 'catalog' && !state.sheet) go('orders'); }
    if (!cfg.API_URL || !inTelegram) { fallback(); return; }
    var want = 'P-' + reNum;
    postApi('orders.my', { num: want }).then(function (res) {
      var one = res && res.ok && res.one;
      if (one && one.num === want && Array.isArray(one.i) && one.i.length && repeatOrder(want, one)) return;
      fallback();
    }).catch(fallback);
  }

  /* ------------------------------ Админ-панель (этап 5) ------------------------------ */
  /* Вход: команда /admin у бота (ссылка с ?admin=1). Права проверяет сервер при каждом запросе. */
  var ADMIN_KEY = 'pamir_admin';
  var adminHint = inTelegram && (params.get('admin') === '1' || store.get(ADMIN_KEY) === '1');
  var ADMIN_STATUSES = ['новий', 'підтверджено', 'відправлено', 'виконано', 'немає в наявності'];
  var STATUS_BADGE = { 'новий': 'badge--opt', 'підтверджено': 'badge--stock', 'відправлено': 'badge--ship', 'немає в наявності': 'badge--out', 'скасовано': 'badge--out' };
  var STATUS_BTNS = [['c', 'stC', 'підтверджено'], ['n', 'stN', 'немає в наявності'], ['s', 'stS', 'відправлено'], ['d', 'stD', 'виконано']];
  var ADMIN_TABS = [['orders', 'admOrders'], ['products', 'admProducts'], ['cats', 'admCats', 'cats'], ['settings', 'admSettings', 'settings'], ['reviews', 'admReviews', 'reviews'], ['wh', 'admWh', 'wh'], ['mail', 'admMail', 'mail'], ['admins', 'admAdmins', 'admins']];
  /** Какое право нужно, чтобы менять поле товара (то же самое проверяет сервер). */
  var PATCH_PERM = { stock: 'stock', qty: 'stock', hidden: 'stock', ua: 'text', ru: 'text', dUa: 'text', dRu: 'text', cat: 'text', cUa: 'text', cRu: 'text', eUa: 'text', eRu: 'text', tags: 'text',
    price: 'price', old: 'price', badge: 'price', end: 'price', wh: 'price', wm: 'price', whn: 'price', packs: 'price', t: 'price' };
  var CAT_ICONS = ['nut', 'cherry', 'candy', 'flame', 'leaf', 'coffee'];
  var adm = { tab: 'orders', orders: null, stats: null, filter: '', q: '', open: '', products: null, cats: null, pq: '',
    edit: '', catEdit: '', settings: null, loading: false, error: '', busy: false, sales: null, salesOpen: false,
    me: null, admins: null, invites: null, permList: null, admEdit: '', invite: null, logOpen: false, log: null, reviews: null, pending: {},
    pp: 1, pcat: '', pf: { out: false, hidden: false, nophoto: false, noprice: false }, pvis: false,
    today: null, todayOld: false, replies: [], canMsg: false, more: '', saved: {}, qdraft: {}, setOpen: {},
    archOpen: false, arch: null, archErr: false, aq: '', ap: 1 }; // экран «Архів» // товары в панели: страница, категория, фильтры

  /** Есть ли у меня право. Пока сервер не прислал роль (или бэкенд ещё старый) — показываем всё: решает всё равно сервер. */
  function can(perm) { return !adm.me || adm.me.perms.indexOf(perm) >= 0; }
  function adminTabs() {
    return ADMIN_TABS.filter(function (tab) { return tab[0] === 'admins' ? !!adm.me && can('admins') : !tab[2] || can(tab[2]); });
  }
  function myId() { try { return String(tg.initDataUnsafe.user.id); } catch (e) { return ''; } }

  function api(action, data) {
    var body = { action: action, initData: inTelegram ? tg.initData : '' };
    Object.keys(data || {}).forEach(function (k) { body[k] = data[k]; });
    var started = Date.now();
    return netGuard(action, function (limit) { return postFetch(body, limit); }).then(function (res) {
      if (res && res._t) perfShow(action, Date.now() - started, res._t); // замер включён на сервере (PERF_LOG = 1)
      return res;
    });
  }

  var admFlight = {}; // запросы списков, которые уже в пути: второй такой же не отправляется
  var admAt = {};     // когда список получен: давно открытый обновляется в фоне
  var ADMIN_FRESH_MS = 30000;
  function adminKind() {
    return adm.tab === 'orders' ? 'orders' : adm.tab === 'settings' ? 'settings' : adm.tab === 'admins' ? 'admins' : adm.tab === 'reviews' ? 'reviews' : adm.tab === 'wh' ? 'wh' : adm.tab === 'mail' ? 'mail' : 'products';
  }
  function adminHave(kind) {
    return kind === 'orders' ? adm.orders : kind === 'settings' ? adm.settings : kind === 'admins' ? adm.admins : kind === 'reviews' ? adm.reviews : kind === 'wh' ? adm.wh : kind === 'mail' ? adm.mail : adm.products;
  }
  /** Один запрос списка панели. Данные кладутся в adm; права и подпись при каждом запросе проверяет сервер. */
  function fetchAdmin(kind) {
    if (admFlight[kind]) return admFlight[kind];
    admFlight[kind] = api('admin.' + kind).then(function (res) {
      delete admFlight[kind];
      if (res && res.ok) {
        store.set(ADMIN_KEY, '1');
        admAt[kind] = Date.now();
        if (res.me) adm.me = res.me;
        if (kind === 'orders') { adm.npTtn = res.npTtn === 1 ? 1 : 0; adm.orders = res.orders || []; adm.stats = res.stats || null; adm.replies = Array.isArray(res.replies) ? res.replies : []; adm.canMsg = Array.isArray(res.replies); fetchToday(); }
        else if (kind === 'settings') adm.settings = res.fields || [];
        else if (kind === 'reviews') adm.reviews = res.reviews || [];
        else if (kind === 'admins') { adm.admins = res.admins || []; adm.invites = res.invites || []; adm.permList = res.permList || []; }
        else if (kind === 'wh') adm.wh = { apps: res.apps || [], clients: res.clients || [] };
        else if (kind === 'mail') adm.mail = { mails: res.mails || [], every: res.every || 0, trigger: res.trigger ? 1 : 0 };
        else { adm.products = res.products || []; adm.cats = res.categories || []; }
        renderToday();
      } else if (res && res.error === 'forbidden') {
        store.set(ADMIN_KEY, '0'); adminHint = false; el.adminBtn.hidden = true;
      }
      return res;
    }, function (err) { delete admFlight[kind]; throw err; });
    return admFlight[kind];
  }
  /** Список загружается заранее, пока админ ещё не открыл вкладку: к нажатию данные уже на месте. */
  function prefetchAdmin(kind) {
    if (!cfg.API_URL || !inTelegram || adminHave(kind) || admFlight[kind]) return;
    fetchAdmin(kind).then(function () {
      if (state.view === 'admin' && adminKind() === kind && !adm.loading) renderPage();
    }).catch(function () { /* не получилось заранее — загрузится при открытии вкладки */ });
  }
  /** Список уже на экране, но получен давно: показываем его сразу и тихо обновляем. Форму настроек не трогаем — в ней могут печатать. */
  function refreshAdminQuietly(kind) {
    if (kind === 'settings' || admFlight[kind] || adm.busy || Date.now() - (admAt[kind] || 0) < ADMIN_FRESH_MS) return;
    fetchAdmin(kind).then(function (res) {
      if (res && res.ok && state.view === 'admin' && adminKind() === kind && !adm.loading && !adm.busy &&
          !adm.edit && !adm.catEdit && !adm.admEdit && !adm.salesOpen && !adm.logOpen && !adm.archOpen && !adm.mailEdit) { if (state.sheet) stale.admin = true; else renderAdminList(); }
    }).catch(function () { /* останется прежний список */ });
  }

  function loadAdmin(force) {
    var kind = adminKind();
    if (adm.loading === kind) return;
    if (!force && adminHave(kind)) { adm.loading = false; refreshAdminQuietly(kind); return; }
    adm.loading = kind; adm.error = '';
    renderAdminList();
    fetchAdmin(kind).then(function (res) {
      btnFree(document.querySelector('[data-action="adm-refresh"]'));
      if (adm.loading !== kind) return; // пока шёл ответ, открыли другую вкладку: данные сохранены, экран не трогаем
      adm.loading = false;
      if (!res || !res.ok) adm.error = res && res.error === 'forbidden' ? 'admForbidden' : res && res.error === 'no_perm' ? 'admNoPerm' : 'admOffline';
      if (state.view === 'admin') renderPage();
      if (res && res.ok && kind === 'orders') prefetchAdmin('products'); // следующая вкладка, куда обычно идут
    }).catch(function () {
      btnFree(document.querySelector('[data-action="adm-refresh"]'));
      if (adm.loading !== kind) return;
      adm.loading = false; adm.error = 'admOffline';
      if (state.view === 'admin') renderPage(); // вся страница: нижняя «Оновити» убирается, остаётся кнопка в сообщении
    });
  }

  function adminHtml() {
    var html = pageHead(t('admin'));
    if (adm.edit) return html + productFormHtml();
    if (adm.catEdit) return html + categoryFormHtml();
    if (adm.salesOpen) return html + salesHtml();
    if (adm.logOpen) return html + logHtml();
    if (adm.archOpen) return html + archiveHtml();
    if (adm.mailEdit) return html + mailEditHtml();
    if (adm.admEdit) return html + adminFormHtml();
    if (!adminTabs().some(function (tab) { return tab[0] === adm.tab; })) adm.tab = 'orders';
    html += '<div class="tabs" role="group">' + adminTabs().map(function (tab) {
      return '<button type="button" data-tab="' + tab[0] + '" aria-pressed="' + (adm.tab === tab[0]) + '">' + esc(t(tab[1])) + '</button>';
    }).join('') + '</div>';
    if (adm.tab === 'orders') {
      html += '<div id="admToday">' + todayHtml() + '</div>';
      if (adm.stats) {
        html += '<div class="stats"><div><span>' + esc(t('admOrdToday')) + '</span><b>' + adm.stats.today.n + ' · ' + money(adm.stats.today.sum) + '</b></div>' +
          '<div><span>' + esc(t('admOrdWeek')) + '</span><b>' + adm.stats.week.n + ' · ' + money(adm.stats.week.sum) + '</b></div></div>' +
          '<button type="button" class="btn btn--block" data-action="adm-sales">' + esc(t('admStats')) + '</button>';
      }
      html += '<input class="input" id="admQ" type="search" autocomplete="off" placeholder="' + esc(t('admSearchO')) + '" value="' + esc(adm.q) + '">' +
        '<div class="chips chips--flush" id="admFilter">' + [''].concat(ADMIN_STATUSES).map(function (s) {
          return '<button type="button" class="chip" data-filter="' + esc(s) + '" aria-pressed="' + (adm.filter === s) + '">' + esc(s || t('admAll')) + '</button>';
        }).join('') + '</div>';
    } else if (adm.tab === 'products') {
      html += (can('text') && can('price') && can('stock') ? '<button type="button" class="btn btn--primary btn--block" data-edit="+">' + icon('plus') + esc(t('admAdd')) + '</button>' : '') +
        '<input class="input" id="admPQ" type="search" autocomplete="off" placeholder="' + esc(t('admSearchP')) + '" value="' + esc(adm.pq) + '">' +
        '<div id="admPChips">' + productChipsHtml() + '</div>' +
        (can('text') ? '<button type="button" class="btn btn--block" data-action="adm-arch">' + esc(t('archTitle')) + '</button>' : '');
    } else if (adm.tab === 'cats') {
      html += '<button type="button" class="btn btn--primary btn--block" data-cat="+">' + icon('plus') + esc(t('admAddCat')) + '</button>';
    } else if (adm.tab === 'admins') {
      html += '<button type="button" class="btn btn--primary btn--block" data-adm="+">' + icon('plus') + esc(t('admAddAdmin')) + '</button>' +
        '<button type="button" class="btn btn--block" data-action="adm-log">' + esc(t('admLog')) + '</button>';
    }
    return html + '<div id="admList">' + adminListHtml() + '</div>' +
      (adm.tab === 'settings' || adm.error ? '' : '<button type="button" class="btn btn--block" data-action="adm-refresh">' + esc(t('admRefresh')) + '</button>');
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
    html += behaviorHtml(s) + sourcesHtml(s);
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

  /** Источники (QR) и напоминания о корзине: только если сервер прислал поля (старый бэкенд и менеджер без права stats их не получают). */
  function sourcesHtml(s) {
    var html = '';
    if (Array.isArray(s.sources) && s.sources.length) {
      html += '<p class="label">' + esc(t('admSources')) + '</p><table class="srct" id="srcTable"><thead><tr><th scope="col">' + esc(t('admSrcTag')) + '</th><th scope="col">' + esc(t('admSrcOpen')) + '</th><th scope="col">' + esc(t('admSrcOrd')) + '</th></tr></thead><tbody>' +
        s.sources.map(function (r) {
          return '<tr><td>' + esc(r.src) + '</td><td>' + (Number(r.open7) || 0) + ' / ' + (Number(r.open14) || 0) + '</td><td>' + (Number(r.ord7) || 0) + ' / ' + (Number(r.ord14) || 0) + '</td></tr>';
        }).join('') + '</tbody></table>';
    }
    if (s.cartRemind && typeof s.cartRemind === 'object') {
      html += '<ul class="rows" id="cartRemind"><li><span class="rows__name">' + esc(t('admCartSent')) + '</span><span class="rows__sub"></span><b>' + (Number(s.cartRemind.sent30) || 0) + '</b></li>' +
        '<li><span class="rows__name">' + esc(t('admCartMuted')) + '</span><span class="rows__sub"></span><b>' + (Number(s.cartRemind.muted30) || 0) + '</b></li></ul>';
    }
    return html;
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
    // Числа на чипах-фильтрах товаров («Без фото · 12») обновляются вместе со списком; прокрутка ряда категорий сохраняется.
    refreshChips();
    renderToday();
  }

  function adminListHtml() {
    if (adm.loading) return '<p class="state__text adm__msg">' + esc(t('admLoading')) + '</p>';
    if (adm.error) return adminErrHtml();
    if (adm.tab === 'orders') return ordersHtml();
    if (adm.tab === 'products') return productsHtml();
    if (adm.tab === 'cats') return catsHtml();
    if (adm.tab === 'admins') return adminsHtml();
    if (adm.tab === 'reviews') return reviewsAdminHtml();
    if (adm.tab === 'wh') return whAdminHtml();
    if (adm.tab === 'mail') return mailListHtml();
    return settingsHtml();
  }

  /** Следующий шаг заказа: код статуса для большой кнопки. Из других статусов (выполнено, нет в наличии) большой кнопки нет. */
  var NEXT_STEP = { 'новий': 'c', 'підтверджено': 's', 'відправлено': 'd' };
  function orderById(num) {
    var found = null;
    (adm.orders || []).forEach(function (o) { if (o.num === num) found = o; });
    return found;
  }
  function stBtnHtml(b, o, big) {
    var pend = adm.stPending && adm.stPending.num === o.num; // статус уже показан новым, сервер ещё отвечает
    return '<button type="button" class="btn' + (big ? ' btn--primary btn--big' : '') + (!big && o.status === b[2] ? ' btn--soft' : '') +
      (pend && adm.stPending.code === b[0] ? ' is-busy" aria-busy="true' : '') +
      '" data-st="' + b[0] + '" data-num="' + esc(o.num) + '"' + (o.status === b[2] || pend ? ' disabled' : '') + '>' + esc(t(b[1])) + '</button>';
  }
  /** Одна большая кнопка следующего шага; остальные статусы — под кнопкой «Ще». */
  function orderActsHtml(o) {
    var next = NEXT_STEP[o.status] || '', open = adm.more === o.num;
    var html = '<div class="ord__acts">';
    STATUS_BTNS.forEach(function (b) { if (b[0] === next) html += stBtnHtml(b, o, true); });
    html += '<button type="button" class="btn' + (next ? '' : ' btn--wide') + '" data-more="' + esc(o.num) + '" aria-expanded="' + open + '">' + esc(t(next ? 'ordMore' : 'stChange')) + '</button>';
    if (open) {
      html += '<div class="ord__more">' + STATUS_BTNS.filter(function (b) { return b[0] !== next; }).map(function (b) { return stBtnHtml(b, o, false); }).join('') + '</div>';
    }
    return html + '</div>';
  }
  /** Строки заказа: «; » между позициями, «\n   · название» — состав набора отдельными строками под позицией. */
  function orderItemsHtml(items) {
    return String(items || '').split('; ').map(function (s) {
      if (!s) return '';
      var parts = s.split('\n'), head = parts.shift(), sub = parts.map(function (x) { return x.replace(/^\s+/, ''); }).filter(Boolean);
      return '<li>' + esc(head) + sub.map(function (x) { return '<span class="ord__sub">' + esc(x) + '</span>'; }).join('') + '</li>';
    }).join('');
  }
  function orderAddress(o) {
    return [o.city, o.branch].filter(function (x) { return x && String(x).trim(); }).join(', ');
  }
  function telHref(phone) { return 'tel:' + String(phone || '').replace(/[^\d+]/g, ''); }
  function chatUrl(o) { return o.username ? 'https://t.me/' + o.username.replace(/^@/, '') : 'https://t.me/' + o.phone; }

  function ordersHtml() {
    var q = adm.q.trim().toLowerCase().replace(/\s+/g, '');
    var list = (adm.orders || []).filter(function (o) {
      if (adm.filter && o.status !== adm.filter) return false;
      return !q || (o.num + ' ' + o.phone + ' ' + o.name).toLowerCase().replace(/\s+/g, '').indexOf(q) >= 0;
    });
    if (!list.length) return emptyHtml(!(adm.orders || []).length ? 'admEmptyOrders' : 'admNoMatch', !(adm.orders || []).length ? 'admEmptyOrdersHint' : 'admNoMatchHint', !!(adm.filter || q));
    // Новые — сверху (порядок внутри групп прежний: свежие раньше).
    list = list.filter(function (o) { return o.status === 'новий'; }).concat(list.filter(function (o) { return o.status !== 'новий'; }));
    return '<ul class="lines">' + list.map(function (o) {
      var open = adm.open === o.num;
      var html = '<li class="ord' + (o.status === 'новий' ? ' ord--new' : '') + '"><button type="button" class="ord__head" data-ord="' + esc(o.num) + '" aria-expanded="' + open + '">' +
        '<span class="ord__num">' + esc(o.num) + '</span><span class="badge ' + (STATUS_BADGE[o.status] || '') + '">' + esc(o.status) + '</span>' +
        (o.test ? '<span class="badge">' + esc(t('admTest')) + '</span>' : '') + (o.wh ? '<span class="badge badge--opt">' + esc(t('whOrder')) + '</span>' : '') +
        '<span class="ord__sum">' + money(o.total) + '</span>' +
        '<span class="ord__meta">' + esc(o.date) + ' · ' + esc(o.name) + '</span></button>';
      if (open) {
        var addr = orderAddress(o);
        html += '<div class="ord__body"><ul class="ord__items">' + orderItemsHtml(o.items) + '</ul>' +
          '<p>' + esc(o.name) + (o.username ? ' · ' + esc(o.username) : '') + '<br>' + esc(o.phone) + '</p>' +
          '<p>' + esc(o.delivery) + (o.city ? ': ' + esc(o.city) + ', ' + esc(o.branch) : '') + '<br>' + esc(o.pay) + '</p>' +
          (o.comment ? '<p class="info">' + esc(o.comment) + '</p>' : '') + ttnAdminHtml(o) + payAdminHtml(o) +
          (can('st') ? orderActsHtml(o) : '') +
          '<div class="ord__tools">' + (o.phone ? '<a class="btn" href="' + esc(telHref(o.phone)) + '" data-call="' + esc(o.num) + '">' + esc(t('ordCall')) + '</a>' : '') +
          (can('st') && adm.canMsg ? '<button type="button" class="btn" data-write="' + esc(o.num) + '">' + esc(t('ordWrite')) + '</button>'
            : '<button type="button" class="btn" data-chat="' + esc(chatUrl(o)) + '">' + esc(t('admWrite')) + '</button>') +
          (addr ? '<button type="button" class="btn btn--wide" data-copyaddr="' + esc(o.num) + '">' + esc(t('ordCopy')) + '</button>' : '') + '</div></div>';
      }
      return html + '</li>';
    }).join('') + '</ul>';
  }

  /** Пустой или ошибочный список: что произошло и что нажать. reset — кнопка «Скинути фільтри». */
  function emptyHtml(titleKey, hintKey, reset) {
    return '<div class="adm__empty"><p class="adm__empty-t">' + esc(t(titleKey)) + '</p><p class="adm__empty-h">' + esc(t(hintKey)) + '</p>' +
      (reset ? '<button type="button" class="btn btn--block" data-action="adm-reset">' + esc(t('admReset')) + '</button>' : '') + '</div>';
  }
  function adminErrHtml() {
    var perm = adm.error === 'admNoPerm' || adm.error === 'admForbidden';
    return '<div class="adm__empty" role="alert"><p class="adm__empty-t">' + esc(t(adm.error)) + '</p>' +
      (perm ? '' : '<button type="button" class="btn btn--primary btn--block" data-action="adm-refresh">' + esc(t('admRefresh')) + '</button>') + '</div>';
  }

  function adminPrice(p) {
    return p.price > 0 ? String(p.price).replace('.', ',') + NBSP + '₴' + (p.t === 'w' ? '/' + weight(1000) : '') : '—';
  }

  /** Товары панели после поиска, категории и фильтров. Поиск идёт по всем товарам, а не по открытой странице. */
  function adminProductList() {
    var q = adm.pq.trim().toLowerCase();
    return (adm.products || []).filter(function (p) {
      if (adm.pcat && p.cat !== adm.pcat) return false;
      if (adm.pf.out && p.stock) return false;
      if (adm.pf.hidden && !p.hidden) return false;
      if (adm.pf.nophoto && p.img) return false;
      if (adm.pf.noprice && p.price > 0) return false;
      if (adm.pvis && p.hidden) return false; // открыто с карточки «Сьогодні»: сервер считает только видимые товары
      return !q || (p.ua + ' ' + p.ru + ' ' + p.id).toLowerCase().indexOf(q) >= 0;
    });
  }

  /** Чипы над списком товаров: категории и фильтры «приховані», «чекають ціну», «немає», «без фото» (с числом товаров). */
  function productChipsHtml() {
    var all = adm.products || [];
    if (!all.length) return '';
    var cats = [], seenCat = {};
    (adm.cats || []).forEach(function (c) { if (!seenCat[c.ua]) { seenCat[c.ua] = 1; cats.push(c.ua); } });
    all.forEach(function (p) { if (p.cat && !seenCat[p.cat]) { seenCat[p.cat] = 1; cats.push(p.cat); } }); // категория, которой нет в листе «Категорії»
    function n(test) { return all.filter(test).length; }
    var flags = [['hidden', 'admFltHidden', n(function (p) { return p.hidden; })], ['noprice', 'admFltPrice', n(function (p) { return !(p.price > 0); })],
      ['out', 'admFltOut', n(function (p) { return !p.stock; })], ['nophoto', 'admFltNoPhoto', n(function (p) { return !p.img; })]];
    return '<div class="chips chips--flush" role="group" aria-label="' + esc(t('admCat')) + '">' +
      '<button type="button" class="chip" data-pcat="" aria-pressed="' + (adm.pcat === '') + '">' + esc(t('admAll')) + '</button>' +
      cats.map(function (c) { return '<button type="button" class="chip" data-pcat="' + esc(c) + '" aria-pressed="' + (adm.pcat === c) + '">' + esc(c) + '</button>'; }).join('') + '</div>' +
      '<div class="chips chips--flush chips--wrap" role="group">' + flags.map(function (f) {
        return '<button type="button" class="chip" data-pflt="' + f[0] + '" aria-pressed="' + !!adm.pf[f[0]] + '">' + esc(t(f[1])) + ' · ' + f[2] + '</button>';
      }).join('') + '</div>';
  }

  var SAVED_MS = 2200; // сколько на карточке товара видна отметка «Збережено»
  function priceText(v) { return v > 0 ? String(v).replace('.', ',') : ''; }
  /** Одна строка товара: название, переключатель «є / немає», быстрая цена. */
  function prodRowHtml(p) {
    var mark = adm.saved[p.id] && Date.now() - adm.saved[p.id] < SAVED_MS;
    var draft = adm.qdraft[p.id], val = draft !== undefined ? draft : priceText(p.price);
    var busyQ = adm.pending['q:' + p.id];
    var dirty = draft !== undefined && draft !== priceText(p.price);
    var cur = p.t === 'w' ? '₴/' + weight(1000) : '₴';
    return '<li class="prod prod--q' + (mark ? ' is-saved' : '') + '" data-pid="' + esc(p.id) + '"><button type="button" class="prod__main" data-edit="' + esc(p.id) + '">' +
      '<span class="prod__name">' + esc(p.ua) + '</span><span class="prod__sub">' + esc(p.id) + ' · ' + adminPrice(p) +
      (p.hidden ? ' · ' + esc(t('admHiddenTag')) : '') + (p.img ? '' : ' · ' + esc(t('admNoPhoto'))) + '</span></button>' +
      '<button type="button" class="sw" role="switch" aria-checked="' + (p.stock ? 'true' : 'false') + '" data-stock="' + esc(p.id) + '" aria-label="' + esc(t('admStock')) + '"' + (can('stock') && !adm.pending[p.id] ? '' : ' disabled') + (adm.pending[p.id] ? ' aria-busy="true"' : '') + '><span></span></button>' +
      (can('price') ? '<div class="prod__quick"><input class="input" type="text" inputmode="decimal" maxlength="9" autocomplete="off" data-qprice="' + esc(p.id) + '" aria-label="' +
        esc(t(p.t === 'w' ? 'admPriceKg' : 'admPriceUnit')) + '" value="' + esc(val) + '"' + (busyQ ? ' disabled' : '') + '><span class="prod__cur">' + esc(cur) + '</span>' +
        '<button type="button" class="btn' + (busyQ ? ' is-busy" aria-busy="true' : '') + '" data-qsave="' + esc(p.id) + '"' + (dirty && !busyQ ? '' : ' disabled') + '>' + esc(t('qpSave')) + '</button></div>' +
        '<p class="form__err prod__err" role="alert" hidden></p>' : '') +
      '<span class="prod__ok" role="status"' + (mark ? '' : ' hidden') + '>' + icon('check') + esc(t('admSaved')) + '</span></li>';
  }

  function productsHtml() {
    var list = adminProductList();
    if (!list.length) return emptyHtml(!(adm.products || []).length ? 'admEmptyProducts' : 'admNoMatch', !(adm.products || []).length ? 'admEmptyProductsHint' : 'admNoMatchHint', !!(adm.products || []).length);
    adm.pp = clampPage(adm.pp, list.length, PAGE_SIZE);
    var from = (adm.pp - 1) * PAGE_SIZE;
    var html = (adm.pvis ? '<p class="field__hint">' + esc(t('admVisOnly')) + '</p>' : '') + '<ul class="lines">' + list.slice(from, from + PAGE_SIZE).map(prodRowHtml).join('') + '</ul>';
    return html + pagerHtml(list.length, adm.pp, PAGE_SIZE);
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
  function fOn(id) { var x = document.getElementById('a-' + id); return !!(x && (x.getAttribute('role') === 'switch' ? x.getAttribute('aria-checked') === 'true' : x.checked)); }
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
      ? { id: '', cat: adm.cats && adm.cats[0] ? adm.cats[0].ua : '', t: 'w', ua: '', ru: '', packs: '100 г / 250 г / 500 г / 1 кг', price: '', stock: 1, hidden: 0, img: '', dUa: '', dRu: '', wh: '', wm: '', badge: '', old: '', qty: '', end: '',
        cUa: adm.products && adm.products[0] && adm.products[0].cUa !== undefined ? '' : undefined, cRu: '' }
      : adminProduct(adm.edit);
    if (!p) return '';
    var cats = (adm.cats || []).map(function (c) { return [c.ua, c.ua]; });
    if (p.cat && !cats.some(function (c) { return c[0] === p.cat; })) cats.unshift([p.cat, p.cat]);
    var photo = isNew
      ? '<p class="info info__muted">' + esc(t('admPhotoLater')) + '</p>'
      : '<div class="photo"><div class="photo__box">' + (p.img ? '<img src="' + esc(verUrl(p.img)) + '" alt="" referrerpolicy="no-referrer">' : MARK) + '</div>' +
        '<div class="photo__acts">' + (can('photo') ? '<label class="btn btn--block">' + esc(t('admPhotoCam')) +
        '<input type="file" id="a-photo-cam" accept="image/*" capture="environment" hidden></label>' +
        '<label class="btn btn--block">' + esc(t('admPhotoGal')) + '<input type="file" id="a-photo" accept="image/*" hidden></label>' +
        (p.img ? '<button type="button" class="btn btn--block" data-action="adm-photo-del">' + esc(t('admPhotoDel')) + '</button>' : '') : '') +
        '<p class="field__hint" id="photoMsg"></p></div></div>';
    var lockedNote = Object.keys(PATCH_PERM).some(function (k) { return !can(PATCH_PERM[k]); }) ? '<p class="info info__muted">' + esc(t('admLocked')) + '</p>' : '';
    return '<form class="form" id="admForm" novalidate><p class="label">' + esc(isNew ? t('admNew') : p.id) + '</p>' + FORM_ERR + lockedNote +
      (p.reused ? '<p class="note note--out">' + esc(tf('archReused', { id: p.id })) + '</p>' : '') + photo +
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
      fRow('wm', t('admWm'), p.wm, 'type="text" maxlength="40"', p.whn === undefined ? '' : t('admWmHint')) +
      (p.whn === undefined ? '' : fRow('whn', t('admWhn'), p.whn, 'type="text" inputmode="decimal" maxlength="8"', t('admWhnHint'))) +
      (p.cUa === undefined ? '' : fArea('cUa', t('admCompUa'), p.cUa, 400) + fArea('cRu', t('admCompRu'), p.cRu, 400)) +
      (p.eUa === undefined ? '' : fArea('eUa', t('admHowUa'), p.eUa, 400) + fArea('eRu', t('admHowRu'), p.eRu, 400) +
        fRow('tags', t('admTags'), p.tags, 'type="text" maxlength="200"', t('admTagsHint'))) +
      fCheck('stock', t('admStock'), p.stock) + fCheck('hidden', t('admHidden'), p.hidden) + saveBtn() +
      (isNew ? '' : '<div class="field"><label class="label" for="a-link">' + esc(t('admLink')) + '</label>' +
        '<input class="input" id="a-link" type="text" readonly value="' + esc(productLink(p.id)) + '">' +
        '<button type="button" class="btn btn--block" data-action="adm-link">' + esc(t('admLinkCopy')) + '</button></div>') +
      (!isNew && can('mail') && p.whn !== undefined ? '<button type="button" class="btn btn--block" data-action="mail-fresh">' + esc(t('mailFreshBtn')) + '</button>' : '') +
      (!isNew && can('text') ? '<div class="danger"><button type="button" class="btn btn--ghost-danger btn--block" data-action="adm-archive">' + icon('trash-2') + esc(t('archBtn')) + '</button>' +
        '<p class="field__hint">' + esc(t('archHint')) + '</p></div>' : '') + '</form>';
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
    if (document.getElementById('a-cUa')) { next.cUa = fVal('cUa'); next.cRu = fVal('cRu'); }
    if (document.getElementById('a-whn')) next.whn = fVal('whn').replace(/\s/g, '');
    if (document.getElementById('a-eUa')) { next.eUa = fVal('eUa'); next.eRu = fVal('eRu'); next.tags = fVal('tags'); } // поля есть только с новым бэкендом
    if (next.qty && !/^\d+([.,]\d+)?$/.test(next.qty)) { fErr('admErrPrice'); return; }
    if (!next.ua) { fErr('admErrName'); return; }
    if (!(next.price >= 0) || !(next.wh >= 0) || !(next.old >= 0)) { fErr('admErrPrice'); return; }
    var btn = saveBtnEl();
    if (isNew) {
      next.stock = !!next.stock; next.hidden = !!next.hidden;
      adm.busy = true; btnBusy(btn);
      api('admin.productAdd', { patch: next }).then(function (res) {
        adm.busy = false;
        if (!res || !res.ok) throw new Error('fail');
        adm.products.push(res.product);
        toast(t('admSaved') + ': ' + res.product.id);
        catalogSoon();
        btnSaved(btn, function () {
          if (adm.edit !== '+') return;
          adm.edit = res.product.id; // остаёмся в карточке: теперь можно добавить фото
          renderPage(); window.scrollTo(0, 0);
        });
      }).catch(function () { adm.busy = false; btnFree(btn); fErr('admFail'); });
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
    btnBusy(btn);
    patchProduct(p, patch, function (ok) {
      if (!ok) { btnFree(btn); fErr('admFail'); return; }
      btnSaved(btn, function () { if (adm.edit === p.id) { adm.edit = ''; renderPage(); window.scrollTo(0, 0); } });
    }, true);
  }

  /** quiet — без всплывающего «Збережено»: результат показывает сама кнопка. */
  function patchProduct(p, patch, done, quiet) {
    adm.busy = true;
    api('admin.product', { id: p.id, patch: patch }).then(function (res) {
      adm.busy = false;
      if (res && res.error === 'no_perm') { toast(t('admNoPerm')); done(false); return; }
      if (!res || !res.ok) throw new Error('fail');
      Object.keys(res.product).forEach(function (k) { p[k] = res.product[k]; });
      if (!quiet) toast(t('admSaved'));
      catalogSoon(); // витрина сразу подхватывает правку
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
    var pick = document.querySelector('.photo__acts label.btn');
    var picks = Array.prototype.slice.call(document.querySelectorAll('.photo__acts label.btn'));
    picks.forEach(function (x) { x.classList.add('is-busy'); });
    if (msg) msg.textContent = t('admPhotoUp');
    compressPhoto(file).then(function (data) {
      return api('admin.photo', { id: p.id, data: data });
    }).then(function (res) {
      adm.busy = false;
      if (!res || !res.ok) throw new Error('fail');
      Object.keys(res.product).forEach(function (k) { p[k] = res.product[k]; });
      toast(t('admSaved'));
      catalogSoon();
      if (state.view === 'admin' && adm.edit === p.id) renderPage();
    }).catch(function () {
      adm.busy = false;
      picks.forEach(function (x) { x.classList.remove('is-busy'); });
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
      fRow('order', t('admCatOrder'), c.order === 999 ? '' : c.order, 'type="text" inputmode="numeric" maxlength="3"') + saveBtn() +
      (!isNew && can('cats') ? '<div class="danger"><button type="button" class="btn btn--ghost-danger btn--block" data-action="adm-cat-del">' + icon('trash-2') + esc(t('catDelBtn')) + '</button></div>' : '') + '</form>';
  }

  function saveCategoryForm() {
    if (adm.busy) return;
    var isNew = adm.catEdit === '+';
    var c = { isNew: isNew, code: isNew ? fVal('code').toUpperCase() : adm.catEdit, ua: fVal('cua'), ru: fVal('cru'), icon: fVal('icon'), order: fNum('order') || (adm.cats || []).length + 1 };
    if (isNew && !/^[A-Z]{2,5}$/.test(c.code)) { fErr('admErrCode'); return; }
    if (!c.ua) { fErr('admErrName'); return; }
    var btn = saveBtnEl();
    adm.busy = true; btnBusy(btn);
    api('admin.category', { category: c }).then(function (res) {
      adm.busy = false;
      if (!res || !res.ok) { btnFree(btn); fErr(res && res.error === 'exists' ? 'admErrExists' : res && res.error === 'no_perm' ? 'admNoPerm' : 'admFail'); return; }
      adm.cats = res.categories;
      adm.products = null; // названия категорий в товарах могли измениться
      catalogSoon();
      btnSaved(btn, function () { if (!adm.catEdit) return; adm.catEdit = ''; renderPage(); window.scrollTo(0, 0); });
    }).catch(function () { adm.busy = false; btnFree(btn); fErr('admFail'); });
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
        (a.src === 'prop' ? '<span class="prod__sub prod__sub--mark">' + esc(t('admFromProps')) + '</span>' : '') +
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
      (isNew ? '<button type="button" class="btn btn--primary btn--block" data-action="adm-invite">' + esc(t('admInviteMake')) + '</button>' : saveBtn()) +
      (isNew ? '' : a.src === 'prop'
        ? '<p class="info">' + esc(t('admFromProps')) + '. ' + esc(t('admPropsHow')) + '</p>'
        : '<div class="danger"><button type="button" class="btn btn--ghost-danger btn--block" data-action="adm-admin-del">' + icon('trash-2') + esc(t('admDelBtn')) + '</button></div>') + '</form>';
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
    var btn = document.querySelector('[data-action="adm-invite"]');
    adm.busy = true; btnBusy(btn);
    api('admin.adminInvite', adminFormValues()).then(function (res) {
      adm.busy = false; btnFree(btn);
      if (!res || !res.ok) { adminFormError(res); return; }
      adm.invite = 'https://t.me/' + (cfg.BOT || '') + '?start=' + res.code;
      adm.admins = null; // список ожидающих обновится при возврате
      renderPage(); window.scrollTo(0, 0);
    }).catch(function () { adm.busy = false; btnFree(btn); fErr('admFail'); });
  }

  function saveAdminForm() {
    var a = adminEntry(adm.admEdit);
    if (!a || adm.busy) return;
    var v = adminFormValues();
    v.id = a.id; v.active = fOn('active');
    var btn = saveBtnEl();
    adm.busy = true; btnBusy(btn);
    api('admin.adminSave', v).then(function (res) {
      adm.busy = false;
      if (!res || !res.ok) { btnFree(btn); adminFormError(res); return; }
      adm.admins = res.admins || []; adm.invites = res.invites || [];
      btnSaved(btn, function () { if (!adm.admEdit) return; adm.admEdit = ''; renderPage(); window.scrollTo(0, 0); });
    }).catch(function () { adm.busy = false; btnFree(btn); fErr('admFail'); });
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
  /** Группы настроек. Ключ, которого нет ни в одной группе (новый на сервере), попадает в «Інше» — без пояснения. */
  var SET_GROUPS = [
    ['shop', 'setGShop', /^(notice_|contact$|feature_|father_|home_rails_max$|low_stock$|fresh_days$|src_list$|hint_)/],
    ['gifts', 'setGGifts', /^(gift_|loyal_|referral_)/],
    ['pay', 'setGPay', /^(pay_|min_order$|address_|hours_)/],
    ['texts', 'setGTexts', /^(bot_|greeting|welcome_|biz_soon_|confirm_|story_|reply_)/],
    ['remind', 'setGRemind', /^(remind_days$|remind_text_|review_days$|cart_remind_hours$|cart_mute_days$|mail_every_days$|followup[12]_|digest_hour$|np_track_hours$)/],
    ['season', 'setGSeason', /^(theme|ny_)/]
  ];
  var SET_SWITCH = /^(pay_|ny_snow$|gift_note$|referral_on$)/; // включено/выключено — переключателем
  function settingGroup(k) {
    for (var i = 0; i < SET_GROUPS.length; i++) if (SET_GROUPS[i][2].test(k)) return SET_GROUPS[i][0];
    return 'other';
  }
  function setBase(k) { return k.replace(/^reply_\d_(ua|ru)$/, 'reply').replace(/_(ua|ru)$/, ''); }
  /** Что видит покупатель под полем: какой макет и на каком языке. null — для этой настройки превью нет. */
  function previewKind(k) {
    var m = k.match(/_(ua|ru)$/), lang = m ? m[1] : state.lang;
    var kind = /^notice(_text)?_(ua|ru)$/.test(k) ? 'notice' : /^gift_text_/.test(k) ? 'gift' : /^loyal_text_/.test(k) ? 'loyal' :
      /^(feature|father)_title_/.test(k) ? 'title' : /^(feature|father)_text_/.test(k) ? 'text' : /^reply_\d_/.test(k) ? 'reply' : /^ny_order_until_/.test(k) ? 'plain' : '';
    return kind ? { kind: kind, lang: lang } : null;
  }
  function tIn(lang, key) { return (I18N[lang] && I18N[lang][key]) || I18N.ua[key] || key; }
  function previewHtml(k, value) {
    var pk = previewKind(k);
    if (!pk) return '';
    var v = String(value || '').trim();
    if (!v) return '<span class="spv__empty">' + esc(t('spvEmpty')) + '</span>';
    if (pk.kind === 'notice') return '<div class="spv__notice">' + esc(v) + '</div>';
    if (pk.kind === 'gift') return '<div class="note note--gift">' + icon('gift') + '<span>' + esc(tIn(pk.lang, 'giftOk').replace('{g}', function () { return v; })) + '</span></div>';
    if (pk.kind === 'loyal') {
      var every = document.getElementById('a-loyal_every'), n = every ? Math.round(Number(every.value)) : 0;
      return '<div class="note note--gift">' + icon('gift') + '<span>' + esc(tIn(pk.lang, 'loyalText').replace('{k}', n >= 2 ? n : 'N').replace('{g}', function () { return v; })) + '</span></div>';
    }
    if (pk.kind === 'title') return '<div class="feature__title">' + esc(v) + '</div>';
    if (pk.kind === 'text') return '<div class="feature__text">' + esc(v) + '</div>';
    if (pk.kind === 'reply') return '<div class="spv__bubble">' + esc(v) + '</div>';
    return '<div class="spv__plain">' + esc(v) + '</div>';
  }
  function refreshPreview(k) {
    var box = document.getElementById('pv-' + k), input = document.getElementById('a-' + k);
    if (box && input) box.innerHTML = previewHtml(k, input.value);
  }
  var SET_ZERO_OFF = /^(followup[12]_days|np_track_hours)$/;
  function setOffHtml(k, v) {
    return SET_ZERO_OFF.test(k) ? '<p class="field__hint field__off" id="off-' + esc(k) + '"' + (String(v).trim() === '0' ? '' : ' hidden') + '>' + esc(t('setOff')) + '</p>' : '';
  }
  function setHintsHtml(k) {
    var base = setBase(k), h = I18N[state.lang]['sh_' + base] || I18N.ua['sh_' + base] || '';
    var ex = I18N.ua['sx_' + k] || I18N.ua['sx_' + base] || ''; // пример — это образец текста, он на языке самого поля
    var html = '';
    if (h) html += '<p class="field__hint">' + esc(h) + '</p>';
    if (h && ex) html += '<p class="field__hint field__ex">' + esc(t('setExample')) + ' ' + esc(ex) + '</p>';
    return html;
  }
  function setPreviewBox(f) {
    return previewKind(f.k) ? '<div class="spv"><p class="spv__label">' + esc(t('spvTitle')) + '</p><div class="spv__box" id="pv-' + esc(f.k) + '" aria-live="polite">' + previewHtml(f.k, f.v) + '</div></div>' : '';
  }
  function setFieldHtml(f) {
    if (SET_SWITCH.test(f.k)) {
      var on = f.k.indexOf('pay_') === 0 ? /^так$/i.test(f.v) : /^(1|так|да|yes|true)$/i.test(String(f.v).trim());
      return '<div class="field sfield"><div class="sfield__sw"><span class="label" id="l-' + esc(f.k) + '">' + esc(f.label) + '</span>' +
        '<button type="button" class="sw" role="switch" id="a-' + esc(f.k) + '" aria-labelledby="l-' + esc(f.k) + '" aria-checked="' + on + '" data-setsw="' + esc(f.k) + '"><span></span></button></div>' +
        setHintsHtml(f.k) + '</div>';
    }
    var inner;
    if (f.k === 'min_order' || f.k === 'gift_from' || f.k === 'loyal_every' || f.k === 'remind_days' || f.k === 'cart_mute_days' || /^(followup[12]_days|digest_hour|np_track_hours)$/.test(f.k)) inner = fRow(f.k, f.label, f.v, 'type="text" inputmode="numeric" maxlength="6"');
    else if (/^(gift|loyal)_text_/.test(f.k)) inner = fRow(f.k, f.label, f.v, 'type="text" maxlength="120"');
    else if (f.k === 'referral_min_order' || f.k === 'mail_every_days') inner = fRow(f.k, f.label, f.v, 'type="text" inputmode="numeric" maxlength="6"');
    else if (f.k === 'hint_id' || f.k === 'hint_tag') inner = fRow(f.k, f.label, f.v, 'type="text" maxlength="' + (f.k === 'hint_id' ? 20 : 40) + '" autocapitalize="' + (f.k === 'hint_id' ? 'characters' : 'none') + '"');
    else if (f.k.indexOf('referral_gift') === 0) inner = fRow(f.k, f.label, f.v, 'type="text" maxlength="120"');
    else if (f.k === 'father_ids' || f.k.indexOf('father_title') === 0) inner = fRow(f.k, f.label, f.v, 'type="text" maxlength="' + (f.k === 'father_ids' ? 240 : 60) + '" autocapitalize="' + (f.k === 'father_ids' ? 'characters' : 'sentences') + '"');
    else if (f.k === 'feature_id' || f.k.indexOf('feature_title') === 0) inner = fRow(f.k, f.label, f.v, 'type="text" maxlength="60" autocapitalize="' + (f.k === 'feature_id' ? 'characters' : 'sentences') + '"');
    else inner = fArea(f.k, f.label, f.v, /^reply_/.test(f.k) ? 300 : 500);
    // подсказка и превью — внутрь того же блока поля
    return inner.replace(/<\/div>$/, setHintsHtml(f.k) + setOffHtml(f.k, f.v) + setPreviewBox(f) + '</div>').replace('<div class="field">', '<div class="field sfield">')
      .replace(' id="a-' + f.k + '"', ' id="a-' + f.k + '"' + (previewKind(f.k) ? ' data-prev="' + f.k + '"' : ''));
  }
  function settingsHtml() {
    if (!adm.settings) return '';
    var groups = {};
    adm.settings.forEach(function (f) { var g = settingGroup(f.k); (groups[g] = groups[g] || []).push(f); });
    var order = SET_GROUPS.map(function (g) { return [g[0], g[1]]; }).concat([['other', 'setGOther']]);
    return '<form class="form" id="admForm" novalidate>' + FORM_ERR + order.filter(function (g) { return groups[g[0]]; }).map(function (g) {
      var open = adm.setOpen[g[0]] === undefined ? g[0] === 'shop' : !!adm.setOpen[g[0]]; // по умолчанию раскрыта только первая группа («Магазин»)
      return '<details class="sgroup" data-sg="' + g[0] + '"' + (open ? ' open' : '') + '><summary class="sgroup__sum"><span>' + esc(t(g[1])) + '</span><span class="sgroup__n">' + groups[g[0]].length + '</span></summary>' +
        '<div class="sgroup__body">' + groups[g[0]].map(setFieldHtml).join('') + '</div></details>';
    }).join('') + saveBtn() + '</form>';
  }

  /** Раскрывает группу настроек (например, с ошибкой), чтобы её было видно. */
  function openSettingGroup(name) {
    adm.setOpen[name] = true;
    var d = document.querySelector('details[data-sg="' + name + '"]');
    if (d) d.open = true;
  }
  function saveSettingsForm() {
    if (adm.busy || !adm.settings) return;
    var values = {};
    adm.settings.forEach(function (f) {
      values[f.k] = f.k.indexOf('pay_') === 0 ? fOn(f.k) : SET_SWITCH.test(f.k) ? (fOn(f.k) ? '1' : '0') : fVal(f.k);
    });
    if (!values.pay_cash && !values.pay_card) { openSettingGroup('pay'); fErr('admErrPay'); return; }
    var btn = saveBtnEl();
    adm.busy = true; btnBusy(btn);
    api('admin.settingsSave', { values: values }).then(function (res) {
      adm.busy = false;
      if (!res || !res.ok) { btnFree(btn); if (res && res.error === 'no_payment') openSettingGroup('pay'); fErr(res && res.error === 'no_payment' ? 'admErrPay' : 'admFail'); return; }
      adm.settings = res.fields;
      catalogSoon();
      btnSaved(btn); // форма остаётся на экране: «Збережено» видно на самой кнопке
    }).catch(function () { adm.busy = false; btnFree(btn); fErr('admFail'); });
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
    var pc = e.target.closest('[data-pcat], [data-pflt]');
    if (pc) { // категория или фильтр товаров: список с первой страницы
      adm.pvis = false;
      if (pc.hasAttribute('data-pcat')) adm.pcat = pc.getAttribute('data-pcat');
      else adm.pf[pc.getAttribute('data-pflt')] = !adm.pf[pc.getAttribute('data-pflt')];
      adm.pp = 1;
      Array.prototype.forEach.call(document.querySelectorAll('#admPChips .chip'), function (b) {
        b.setAttribute('aria-pressed', String(b.hasAttribute('data-pcat') ? b.getAttribute('data-pcat') === adm.pcat : !!adm.pf[b.getAttribute('data-pflt')]));
      });
      renderAdminList(); return true;
    }
    var pg = e.target.closest('[data-page]');
    if (pg) {
      if (pg.disabled) return true;
      if (adm.archOpen) { adm.ap = Number(pg.getAttribute('data-page')); renderArchiveList(); scrollToList(document.getElementById('archList')); }
      else { adm.pp = Number(pg.getAttribute('data-page')); renderAdminList(); scrollToList(document.getElementById('admList')); }
      return true;
    }
    var ord = e.target.closest('[data-ord]');
    if (ord) { var num = ord.getAttribute('data-ord'); adm.open = adm.open === num ? '' : num; renderAdminList(); return true; }
    var st = e.target.closest('[data-st]');
    if (st) { if (!st.disabled) startStatus(st); return true; }
    var more = e.target.closest('[data-more]');
    if (more) { var mn = more.getAttribute('data-more'); adm.more = adm.more === mn ? '' : mn; renderAdminList(); return true; }
    var wr = e.target.closest('[data-write]');
    if (wr) { var wo = orderById(wr.getAttribute('data-write')); if (wo) openMessageSheet(wo); return true; }
    var ca = e.target.closest('[data-copyaddr]');
    if (ca) { copyAddress(ca); return true; }
    if (e.target.closest('[data-call]')) return false; // обычная ссылка tel:
    var td = e.target.closest('[data-today]');
    if (td) { goToday(td.getAttribute('data-today')); return true; }
    var qs = e.target.closest('[data-qsave]');
    if (qs) { if (!qs.disabled) saveQuickPrice(qs); return true; }
    var ssw = e.target.closest('[data-setsw]');
    if (ssw) { ssw.setAttribute('aria-checked', String(ssw.getAttribute('aria-checked') !== 'true')); return true; }
    var chat = e.target.closest('[data-chat]');
    if (chat) {
      var url = chat.getAttribute('data-chat');
      try { tg.openTelegramLink(url); } catch (err) { window.open(url, '_blank'); }
      return true;
    }
    var sw = e.target.closest('[data-stock]');
    if (sw) {
      if (!sw.disabled) toggleStock(sw);
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
    if (name === 'adm-refresh') { if (!adm.loading) { btnBusy(act); loadAdmin(true); } return true; }
    if (name === 'adm-reset') {
      adm.filter = ''; adm.q = ''; resetProductFilters(); renderPage(); return true;
    }
    if (name === 'adm-sales') { if (!adm.salesLoading) loadSales(); return true; }
    if (name === 'adm-save') {
      if (adm.edit) saveProductForm(); else if (adm.catEdit) saveCategoryForm(); else if (adm.admEdit) saveAdminForm(); else saveSettingsForm();
      return true;
    }
    if (name === 'adm-invite') { createInvite(); return true; }
    if (name === 'adm-invite-done') { goBack(); return true; }
    if (name === 'adm-log') { loadLog(); return true; }
    if (name === 'adm-arch') { loadArchive(); return true; }
    if (mailClick(e, name, act)) return true;
    var whD = e.target.closest('[data-wh-d]');
    if (whD) { if (!whD.disabled) whDecide(whD.getAttribute('data-id'), whD.getAttribute('data-wh-d'), whD); return true; }
    var whR = e.target.closest('[data-wh-revoke]');
    if (whR) { if (!whR.disabled) whRevoke(whR.getAttribute('data-wh-revoke')); return true; }
    var payBtn = e.target.closest('[data-pay]');
    if (payBtn) { if (!payBtn.disabled) markPaid(payBtn.getAttribute('data-num'), payBtn.getAttribute('data-pay'), payBtn); return true; }
    if (name === 'adm-archive') { askArchive(adminProduct(adm.edit)); return true; }
    if (name === 'adm-cat-del') { askDeleteCategory(act); return true; }
    if (name === 'adm-admin-del') { askDeleteAdmin(adminEntry(adm.admEdit)); return true; }
    var ar = e.target.closest('[data-arch-restore]');
    if (ar) { if (!ar.disabled) restoreFromArchive(ar.getAttribute('data-arch-restore'), ar); return true; }
    var ap = e.target.closest('[data-arch-purge]');
    if (ap) { if (!ap.disabled) askPurge(ap.getAttribute('data-arch-purge')); return true; }
    if (name === 'adm-link') {
      var linkInput = document.getElementById('a-link');
      if (linkInput) copyText(linkInput.value, linkInput).then(function (ok) { toast(t(ok ? 'admLinkCopied' : 'admLinkFail')); });
      return true;
    }
    if (name === 'adm-photo-del') {
      var pp = adminProduct(adm.edit);
      if (pp && !adm.busy) { btnBusy(act); patchProduct(pp, { img: '' }, function () { renderPage(); }); }
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
      if ((state.view === 'fav' || state.view === 'cart' || state.view === 'recipe' || state.view === 'quiz' || state.view === 'rail') && productClick(e)) return;
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
      if (act.getAttribute('data-action') === 'send-new') {
        askConfirm({ title: t('sendAsNew'), text: t('sendAsNewAsk'), ok: t('sendAsNewOk'), run: function (done) { submitOrder(); done(); } });
        return;
      }
      if (act.getAttribute('data-action') === 'retry-order') { submitOrder(); return; }
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
      if (input.id === 'admPQ') { adm.pq = input.value; adm.pp = 1; renderAdminList(); return; }
      if (input.hasAttribute && input.hasAttribute('data-qprice')) {
        var qid = input.getAttribute('data-qprice'), qp = adminProduct(qid), qli = input.closest('.prod');
        adm.qdraft[qid] = input.value;
        input.removeAttribute('aria-invalid');
        if (qli) {
          var qe = qli.querySelector('.prod__err'), qb = qli.querySelector('[data-qsave]');
          if (qe) qe.hidden = true;
          if (qb) qb.disabled = !qp || input.value === priceText(qp.price) || !!adm.pending['q:' + qid];
        }
        return;
      }
      if (input.id && /^a-(followup[12]_days|np_track_hours)$/.test(input.id)) { var offp = document.getElementById('off-' + input.id.slice(2)); if (offp) offp.hidden = String(input.value).trim() !== '0'; }
      if (input.hasAttribute && input.hasAttribute('data-prev')) refreshPreview(input.getAttribute('data-prev'));
      if (input.id === 'a-loyal_every') { refreshPreview('loyal_text_ua'); refreshPreview('loyal_text_ru'); }
      if (input.id === 'admAQ') { adm.aq = input.value; adm.ap = 1; renderArchiveList(); return; }
      if (!input.name || state.view !== 'checkout') return;
      if (input.name === 'phone') input.value = formatPhone(input.value);
      if (input.getAttribute('aria-invalid')) setError(input.name, '');
      if (!el.page.querySelector('[aria-invalid]')) document.getElementById('formErr').hidden = true;
      readForm();
      if (input.name === 'giftNote') updateGiftCount();
      syncCheckout();
    });
    el.page.addEventListener('focusin', function (e) {
      if (e.target.name === 'phone' && !e.target.value) e.target.value = '+380';
    });
    el.page.addEventListener('change', function (e) {
      if (e.target.id === 'a-role' && adm.admEdit) { var pb = document.getElementById('admPerms'); if (pb) pb.hidden = e.target.value === 'admin'; return; }
      if ((e.target.id === 'a-photo' || e.target.id === 'a-photo-cam') && e.target.files && e.target.files[0]) { uploadPhoto(e.target.files[0]); try { e.target.value = ''; } catch (err) { /* поле файла не сбрасывается — не страшно */ } }
      if ((e.target.id === 'a-stock' || e.target.id === 'a-hidden') && adm.edit && adm.edit !== '+') toggleInForm(e.target);
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
        if (kind === 'retry') loadCatalog(true); // direct: первая загрузка уже не удалась (и через Worker, и напрямую) — второй круг через Worker только добавил бы ожидание
        if (kind === 'reset') {
          state.cat = ''; flt.sort = ''; flt.onlyStock = false; flt.onlySale = false;
          setSearch('');
          renderChips();
        }
        return;
      }
      var pg = e.target.closest('[data-page]');
      if (pg) { if (!pg.disabled) setPage(Number(pg.getAttribute('data-page'))); return; }
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
      if (img && img.tagName === 'IMG' && img.parentNode && img.parentNode.classList && img.parentNode.classList.contains('sheet__slide--2')) { dropPhoto2(); return; }
      if (img && img.tagName === 'IMG' && img.parentNode &&
          /(^| )(card|sheet|line|mini|feature|rcard)__img( |$)/.test(img.parentNode.className)) {
        var full = img.getAttribute('data-full');
        if (full) { img.removeAttribute('data-full'); img.src = full; return; } // маленькой копии нет — один раз пробуем большую
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
      if (kind === 'photo-next') { sheetPhotoNext(); return; }
      if (kind === 'share') { var sp = state.sheet && product(state.sheet.id); if (sp) shareProduct(sp); return; }
      if (kind === 'notify') { if (!act.disabled && state.sheet) notifyMe(state.sheet.id, act); return; }
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
    // Лента фото: точка следует за прокруткой (событие scroll не всплывает — слушаем на захвате).
    el.sheet.addEventListener('scroll', function (e) {
      var strip = e.target;
      if (!strip || !strip.classList || !strip.classList.contains('sheet__strip') || !strip.clientWidth) return;
      var i = Math.max(0, Math.min(1, Math.round(strip.scrollLeft / strip.clientWidth)));
      if (state.sheet && state.sheet.goto !== undefined) { if (i !== state.sheet.goto) return; delete state.sheet.goto; } // идёт прокрутка от кнопки: промежуточные значения не мигают точкой
      if (!state.sheet || state.sheet.slide !== i) sheetMarkDot(i);
    }, true);
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

  /* ======================================================================== */
  /* ЭТАП 8, волна 1 · части 1.2–1.7: точки, дизайн, доверие, отзывы, продажи, Нова пошта */
  /* ======================================================================== */
  var I18N_W1 = {
    ua: {
      secSale: 'Акції', tillShort: 'до {d}', badgeWeek: 'Хіт тижня', fresh: 'Свіжа поставка {d}',
      ico_sweet: 'Східні солодощі', ico_set: 'Набори',
      ptsTitle: 'Наші точки', ptsBtn: 'Наші точки на ринку', ptOpen: 'Відкрито зараз, до {t}', ptToday: 'Зачинено, відкриємось сьогодні о {t}',
      ptTomorrow: 'Зачинено, відкриємось завтра о {t}', ptLater: 'Зачинено, відкриємось {d} о {t}', ptOff: 'вихідний',
      ptRoute: 'Прокласти маршрут', ptCall: 'Подзвонити', ptVideo: 'Відео: як нас знайти', ptHow: 'Як знайти точку', ptPick: 'Де заберете замовлення',
      days: 'Пн,Вт,Ср,Чт,Пт,Сб,Нд', daysWhen: 'у понеділок,у вівторок,у середу,у четвер,у п’ятницю,у суботу,у неділю',
      storyBtn: 'Від саду до столу', storyMore: 'Наша історія',
      passSort: 'Сорт', passHarvest: 'Урожай', passOrigin: 'Походження', passFresh: 'Свіжа поставка',
      rvTitle: 'Відгуки покупців', rvLoading: 'Завантажуємо відгуки…', rvFail: 'Не вдалося завантажити відгуки.', rvFrom: 'з 5',
      rv1: 'відгук', rv2: 'відгуки', rv5: 'відгуків', rvOnly: 'Відгуки залишають лише покупці після отримання замовлення.',
      bulkSave: '{big} вигідніше на {pct} %, ніж {k} × {small}',
      usualTitle: 'Ваше звичне', usualSub: 'те, що ви берете найчастіше', usualAdd: 'Додати все', usualDone: 'Звичне додано в кошик',
      emptyAsk: 'Напишіть нам — підкажемо, чи є це на прилавку.', writeUs: 'Написати нам',
      npBranch: 'Відділення', npLocker: 'Поштомат', npCourier: 'Кур’єр',
      fBranch_branch: '№ або адреса відділення', fBranch_locker: '№ поштомата', fBranch_courier: 'Адреса: вулиця, будинок, квартира',
      errAddr: 'Вкажіть адресу для кур’єра', ttn: 'ТТН', track: 'Відстежити', ttnPh: 'Номер ТТН', ttnSave: 'Зберегти ТТН', ttnBad: 'У номері ТТН має бути 10–20 цифр',
      admReviews: 'Відгуки', rvApprove: 'Схвалити', rvHide: 'Приховати', rvEmpty: 'Відгуків поки немає.', rvPhoto: 'є фото', rvOrder: 'замовлення',
      rvs_новий: 'новий', rvs_схвалено: 'схвалено', rvs_приховано: 'приховано'
    },
    ru: {
      secSale: 'Акции', tillShort: 'до {d}', badgeWeek: 'Хит недели', fresh: 'Свежая поставка {d}',
      ico_sweet: 'Восточные сладости', ico_set: 'Наборы',
      ptsTitle: 'Наши точки', ptsBtn: 'Наши точки на рынке', ptOpen: 'Открыто сейчас, до {t}', ptToday: 'Закрыто, откроемся сегодня в {t}',
      ptTomorrow: 'Закрыто, откроемся завтра в {t}', ptLater: 'Закрыто, откроемся {d} в {t}', ptOff: 'выходной',
      ptRoute: 'Проложить маршрут', ptCall: 'Позвонить', ptVideo: 'Видео: как нас найти', ptHow: 'Как найти точку', ptPick: 'Где заберёте заказ',
      days: 'Пн,Вт,Ср,Чт,Пт,Сб,Вс', daysWhen: 'в понедельник,во вторник,в среду,в четверг,в пятницу,в субботу,в воскресенье',
      storyBtn: 'От сада до стола', storyMore: 'Наша история',
      passSort: 'Сорт', passHarvest: 'Урожай', passOrigin: 'Происхождение', passFresh: 'Свежая поставка',
      rvTitle: 'Отзывы покупателей', rvLoading: 'Загружаем отзывы…', rvFail: 'Не удалось загрузить отзывы.', rvFrom: 'из 5',
      rv1: 'отзыв', rv2: 'отзыва', rv5: 'отзывов', rvOnly: 'Отзывы оставляют только покупатели после получения заказа.',
      bulkSave: '{big} выгоднее на {pct} %, чем {k} × {small}',
      usualTitle: 'Ваше привычное', usualSub: 'то, что вы берёте чаще всего', usualAdd: 'Добавить всё', usualDone: 'Привычное добавлено в корзину',
      emptyAsk: 'Напишите нам — подскажем, есть ли это на прилавке.', writeUs: 'Написать нам',
      npBranch: 'Отделение', npLocker: 'Почтомат', npCourier: 'Курьер',
      fBranch_branch: '№ или адрес отделения', fBranch_locker: '№ почтомата', fBranch_courier: 'Адрес: улица, дом, квартира',
      errAddr: 'Укажите адрес для курьера', ttn: 'ТТН', track: 'Отследить', ttnPh: 'Номер ТТН', ttnSave: 'Сохранить ТТН', ttnBad: 'В номере ТТН должно быть 10–20 цифр',
      admReviews: 'Отзывы', rvApprove: 'Одобрить', rvHide: 'Скрыть', rvEmpty: 'Отзывов пока нет.', rvPhoto: 'есть фото', rvOrder: 'заказ',
      rvs_новий: 'новый', rvs_схвалено: 'одобрен', rvs_приховано: 'скрыт'
    }
  };
  ['ua', 'ru'].forEach(function (lang) {
    Object.keys(I18N_W1[lang]).forEach(function (k) { I18N[lang][k] = I18N_W1[lang][k]; });
  });

  /* ---- 1.3 Иконки категорий: тонкая линия + абрикосовый штрих (класс acc) ---- */
  function catIcon(base, acc) { return base + '<g class="acc">' + acc + '</g>'; }
  ICONS.nut = catIcon('<path d="M12 3.5c4.3 0 7.5 3.7 7.5 8.5s-3.2 8.5-7.5 8.5S4.5 16.8 4.5 12 7.7 3.5 12 3.5z"/><path d="M12 3.5v17"/>',
    '<path d="M8.6 7.5c1.6 1.2 1.6 2.6 0 3.8s-1.6 2.9.3 4.4"/><path d="M15.4 7.5c-1.6 1.2-1.6 2.6 0 3.8s1.6 2.9-.3 4.4"/>');
  ICONS.cherry = catIcon('<path d="M12 7.5c-4 0-7 2.7-7 6.5s3 7 7 7 7-3.2 7-7-3-6.5-7-6.5z"/><path d="M12 7.5c-1.3 2.8-1.2 6.5.4 9.5"/>',
    '<path d="M12 7.5V5.6"/><path d="M12 5.6c.8-2.2 3-3.2 5.5-2.7-.4 2.4-2.6 3.6-5.5 2.7z"/>');
  ICONS.sweet = catIcon('<path d="M12 3.5l8.5 8.5-8.5 8.5L3.5 12z"/>', '<path d="M12 8l4 4-4 4-4-4z"/>');
  ICONS.candy = catIcon('<circle cx="12" cy="12" r="4.5"/><path d="M7.7 10.6L3.5 8v8l4.2-2.6"/><path d="M16.3 10.6L20.5 8v8l-4.2-2.6"/>',
    '<path d="M9.8 12.8c.6-2.2 3.2-2.6 4.4-.9"/>');
  ICONS.flame = catIcon('<path d="M3.5 12.5h17a8.5 8.5 0 0 1-17 0z"/>',
    '<path d="M6.5 12.5C7.3 8.9 9.4 7 12 7s4.7 1.9 5.5 5.5"/><path d="M12 3v1.2"/><path d="M8 4.2l.6 1"/><path d="M16 4.2l-.6 1"/>');
  ICONS.leaf = catIcon('<path d="M4.5 9.5h15c0 5.2-3 8.5-7.5 8.5s-7.5-3.3-7.5-8.5z"/><path d="M9.5 20.5h5"/>',
    '<path d="M9.8 3c-1.1 1.3 1.1 2.2 0 3.6"/><path d="M14.2 3c-1.1 1.3 1.1 2.2 0 3.6"/>');
  ICONS.coffee = catIcon('<ellipse cx="12" cy="12" rx="5.8" ry="8.5" transform="rotate(35 12 12)"/>',
    '<path d="M12 3.5c-2.4 3 2.4 5.6 0 8.5s2.4 5.6 0 8.5" transform="rotate(35 12 12)"/>');
  ICONS.set = catIcon('<path d="M4 9h16v3.5H4z"/><path d="M5.5 12.5V20h13v-7.5"/>',
    '<path d="M12 9v11"/><path d="M12 9C10.5 5.5 7 5.3 7 7.2S10 9 12 9z"/><path d="M12 9c1.5-3.5 5-3.7 5-1.8S14 9 12 9z"/>');
  ICONS.star = '<path d="M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.2-4.1 5.8-.8z"/>';
  ICONS.map = '<path d="M9 4 3.5 6.5v13.5L9 17.5l6 2.5 5.5-2.5V4L15 6.5z"/><path d="M9 4v13.5"/><path d="M15 6.5V20"/>';
  ICONS.call = '<path d="M6.5 3.5h3l1.5 4-2 1.5a11 11 0 0 0 6 6l1.5-2 4 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.5 5.7a2 2 0 0 1 2-2.2z"/>';
  ICONS.video = '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10.5 5-3v9l-5-3"/>';
  ICONS.sprout = '<path d="M12 20v-8"/><path d="M12 12c0-3.5-2.5-6-6.5-6 0 4 2.5 6 6.5 6z"/><path d="M12 14c0-3 2-5 6-5 0 3.5-2 5-6 5z"/>';
  CAT_ICONS.push('sweet', 'set');

  /** Орнамент «ступенчатый ромб» (узор описан в index.html, #o1). */
  var ORN = '<svg class="orn" aria-hidden="true"><rect width="100%" height="100%" fill="url(#o1)"/></svg>';
  var MOUNT = '<svg class="mnt" viewBox="0 0 168 72" aria-hidden="true"><circle class="sun" cx="126" cy="20" r="6"/>' +
    '<path class="l1" pathLength="1" d="M6 64L46 12l18 24 12-14 22 30 14-16 24 28h28"/><path class="l2" pathLength="1" d="M38 22l8 6 6-5"/></svg>';

  /** Небольшие иллюстрации для пустых экранов: линия + абрикосовый акцент. */
  var ARTS = {
    cart: '<path d="M14 26h8l8 30h34l8-22H27"/><circle cx="36" cy="63" r="3"/><circle cx="60" cy="63" r="3"/><g class="acc"><path d="M44 30c-5 0-8 3-8 7s3 8 8 8 8-4 8-8-3-7-8-7z"/><path d="M44 30v-3c1-3 4-4 7-3"/></g>',
    fav: '<path d="M48 62 26 41c-6-6-6-15 0-20s14-4 22 4c8-8 16-9 22-4s6 14 0 20z"/><g class="acc"><path d="M48 34v14"/><path d="M48 41c0-4-3-6-7-6 0 4 3 6 7 6z"/><path d="M48 44c0-3 2-5 6-5 0 3-2 5-6 5z"/></g>',
    search: '<circle cx="42" cy="32" r="18"/><path d="m56 46 16 16"/><g class="acc"><path d="M30 38l8-10 5 6 3-4 8 8"/></g>',
    orders: '<path d="M30 10h36v52l-6-4-6 4-6-4-6 4-6-4-6 4z"/><path d="M38 24h20"/><path d="M38 34h20"/><g class="acc"><path d="M38 44h10"/><circle cx="56" cy="44" r="2"/></g>'
  };
  function art(name) { return '<svg class="art" viewBox="0 0 96 72" aria-hidden="true">' + ARTS[name] + '</svg>'; }

  function reducedMotion() {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }

  /** Товар «летит» в корзину: кружок с фото от карточки до значка корзины. */
  function fly(from) {
    try {
      var target = el.tabbar.querySelector('[data-go="cart"] .tabbar__ico');
      if (!from || !target || el.tabbar.hidden || reducedMotion() || !document.body.animate) return;
      var a = from.getBoundingClientRect(), b = target.getBoundingClientRect();
      if (!a.width || !b.width) return;
      var dot = document.createElement('span');
      dot.className = 'fly';
      var src = from.tagName === 'IMG' ? (from.currentSrc || from.src) : '';
      if (src) dot.style.backgroundImage = 'url("' + src.replace(/"/g, '%22') + '")';
      var x = a.left + a.width / 2 - 24, y = a.top + a.height / 2 - 24;
      dot.style.left = x + 'px'; dot.style.top = y + 'px';
      document.body.appendChild(dot);
      var dx = b.left + b.width / 2 - 24 - x, dy = b.top + b.height / 2 - 24 - y;
      var anim = dot.animate([
        { transform: 'translate(0,0) scale(1)', opacity: 1 },
        { transform: 'translate(' + dx * .6 + 'px,' + (dy * .35 - 30) + 'px) scale(.7)', opacity: 1, offset: .55 },
        { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(.2)', opacity: .3 }
      ], { duration: 560, easing: 'cubic-bezier(.3,0,.2,1)' });
      var drop = function () { if (dot.parentNode) dot.parentNode.removeChild(dot); };
      anim.onfinish = drop; anim.oncancel = drop;
      setTimeout(drop, 900);
    } catch (e) { /* анимация необязательна */ }
  }
  function flyFromCard(id) {
    var holders = document.querySelectorAll('[data-id]');
    for (var i = 0; i < holders.length; i++) {
      if (holders[i].getAttribute('data-id') !== id) continue;
      var r = holders[i].getBoundingClientRect();
      if (r.width && r.bottom > 0 && r.top < window.innerHeight) { fly(holders[i].querySelector('img, .mark')); return; }
    }
  }

  /** Сумма в корзине меняется плавно. */
  var lastCartSum = null;
  function tweenCartSum() {
    var node = el.page.querySelector('.sum .total');
    var to = cartTotal(), from = lastCartSum;
    lastCartSum = to;
    if (!node || from === null || from === to || reducedMotion() || !window.requestAnimationFrame) return;
    var start = 0;
    node.setAttribute('data-sum', String(to));
    (function step(ts) {
      if (!start) start = ts || 1;
      var k = Math.min(1, ((ts || 1) - start) / 260);
      if (!node.isConnected || node.getAttribute('data-sum') !== String(to)) return;
      node.textContent = money(Math.round(from + (to - from) * k));
      if (k < 1) requestAnimationFrame(step);
    })(0);
  }

  /* ---- Б11. Новый год ---- */
  /** Настройки праздника: только при теме newyear (после theme_until сервер сам перестаёт её отдавать). null — праздника нет. */
  function nyOnTheme() { return shopInfo().theme === 'newyear'; }
  function nyInfo() {
    var s = shopInfo();
    return s.theme === 'newyear' && s.ny && typeof s.ny === 'object' ? s.ny : null;
  }
  /** Подборка «Подарунки до свят»: товары из ny.ids, которых нет в каталоге или нет в наличии, пропускаются. */
  function nyGiftList() {
    var ny = nyInfo(), seenIds = {}, list = [];
    if (!ny || !Array.isArray(ny.ids) || !state.catalog) return list;
    ny.ids.forEach(function (id) {
      var p = product(String(id));
      if (p && p.a && !seenIds[p.id]) { seenIds[p.id] = 1; list.push(p); }
    });
    return list;
  }
  /** Строка о сроке на языке интерфейса (нет своего языка — другой). Без таймера. */
  function nyUntilText() {
    var ny = nyInfo(), u = ny && ny.until;
    if (!u || typeof u !== 'object') return '';
    return String((state.lang === 'ru' ? u.ru || u.ua : u.ua || u.ru) || '').trim();
  }
  function nyUntilHtml() {
    var text = nyUntilText();
    return text ? '<p class="note note--opt ny-until" role="note">' + esc(text) + '</p>' : '';
  }
  /** «Якщо товару немає»: только если бэкенд сказал shop.ifo === 1 (старый бэкенд поля не знает). Сумму не меняет. */
  function ifoOn() { return Number(shopInfo().ifo) === 1; }
  function ifoHtml() {
    if (!ifoOn()) return '';
    return '<fieldset class="group" id="ifoBox"><legend class="label">' + esc(t('ifoTitle')) + '</legend><div class="opts opts--col">' +
      option('ifOut', 'call', '', t('ifoCall')) + option('ifOut', 'replace', '', t('ifoReplace')) + option('ifOut', 'remove', '', t('ifoRemove')) + '</div></fieldset>';
  }
  function giftNoteOn() { return Number(shopInfo().giftNote) === 1; }
  function giftNoteHtml() {
    if (!giftNoteOn()) return '';
    var v = state.form.giftNote || '';
    return '<div class="field"><label class="label" for="f-giftNote">' + esc(t('fGiftNote')) + ' <span class="label__opt">(' + esc(t('optional')) + ')</span></label>' +
      '<textarea class="input input--area" id="f-giftNote" name="giftNote" rows="2" maxlength="120" placeholder="' + esc(t('giftNotePh')) + '" aria-describedby="gnCount">' + esc(v) + '</textarea>' +
      '<p class="field__hint gncount" id="gnCount">' + esc(tf('giftNoteCount', { n: v.length })) + '</p></div>';
  }
  function updateGiftCount() {
    var c = document.getElementById('gnCount'), i = document.getElementById('f-giftNote');
    if (c && i) c.textContent = tf('giftNoteCount', { n: i.value.length });
  }
  /** Полоска из ступенчатых ромбов (орнамент #o1: тот же ромб) в цветах apricot, lapis, pistachio. id шаблона у каждой полоски свой. */
  function nyStrip(id, cls) {
    var d = function (x, c) { return '<use href="#d-step" transform="translate(' + x + ' -1) scale(.5)" style="fill:var(--' + c + ')"/>'; };
    return '<svg class="' + cls + '" aria-hidden="true" focusable="false"><defs><pattern id="' + id + '" width="42" height="9" patternUnits="userSpaceOnUse">' +
      d(-1, 'apricot') + d(13, 'lapis') + d(27, 'pistachio') + '</pattern></defs><rect width="100%" height="9" fill="url(#' + id + ')"/></svg>';
  }
  /** Снег: только при ny.snow = 1, не больше 14 снежинок, чистый CSS, без перехвата нажатий; при prefers-reduced-motion его нет. */
  function applySnow(want) {
    var box = document.getElementById('snow');
    var calm = false;
    try { calm = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { /* нет matchMedia */ }
    if (!want || calm) { if (box) box.parentNode.removeChild(box); return; }
    if (box) return;
    box = document.createElement('div');
    box.id = 'snow'; box.className = 'snow'; box.setAttribute('aria-hidden', 'true');
    var html = '';
    for (var i = 0; i < 14; i++) {
      html += '<i style="left:' + ((i * 37 + 11) % 100) + '%;--s:' + (4 + (i * 5) % 4) + 'px;--d:' + (11 + (i * 7) % 9) + 's;--w:-' + ((i * 13) % 17) + 's;--dx:' + (((i * 29) % 41) - 20) + 'px"></i>';
    }
    box.innerHTML = html;
    document.body.appendChild(box);
  }

  /** Сезонная тема из настроек магазина: newyear | navruz | пусто. */
  function applySeason() {
    var theme = shopInfo().theme || '';
    document.body.setAttribute('data-season', theme);
    var box = document.getElementById('season');
    var ny = !!nyInfo() || theme === 'newyear';
    var g = document.getElementById('garland');
    if (g) {
      g.hidden = !ny;
      if (ny && !g.firstChild) g.innerHTML = nyStrip('nyg', 'ny-strip');
      else if (!ny) g.innerHTML = '';
    }
    applySnow(!!nyInfo() && Number(nyInfo().snow) === 1);
    if (!box) return;
    box.hidden = !theme;
    box.innerHTML = theme === 'newyear'
      ? '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18"/><path d="M4.2 7.5l15.6 9"/><path d="M19.8 7.5l-15.6 9"/><path d="M9.5 4.5 12 7l2.5-2.5"/><path d="M9.5 19.5 12 17l2.5 2.5"/></svg>'
      : theme === 'navruz' ? icon('sprout') : '';
  }

  function openUrl(url) {
    if (!/^https:\/\//.test(url || '')) return;
    try {
      if (inTelegram && /^https:\/\/t\.me\//.test(url)) tg.openTelegramLink(url);
      else if (inTelegram && typeof tg.openLink === 'function') tg.openLink(url);
      else window.open(url, '_blank', 'noopener');
    } catch (e) { window.open(url, '_blank', 'noopener'); }
  }

  function plural(n, a, b, c) {
    var m10 = n % 10, m100 = n % 100;
    return m10 === 1 && m100 !== 11 ? a : (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? b : c);
  }
  function dayMonth(iso) { return String(iso || '').split('-').reverse().slice(0, 2).join('.'); }

  /* ---- 1.2 Точки на рынке ---- */
  function points() { var list = shopInfo().points; return Array.isArray(list) ? list : []; }
  function pointById(id) { var found = null; points().forEach(function (p) { if (p.id === id) found = p; }); return found; }
  function loc(o) { return o ? (state.lang === 'ru' ? o.ru : o.ua) || o.ua || '' : ''; }

  /** Сейчас в Киеве: день недели (0 — понедельник) и минуты от начала суток. В отладке можно задать ?now=<день>-<минуты>. */
  function kyivNow() {
    var forced = DEBUG && String(params.get('now') || '').match(/^(\d)-(\d{1,4})$/);
    if (forced) return { dow: +forced[1] % 7, min: +forced[2] };
    try {
      var o = {};
      new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Kiev', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
        .formatToParts(new Date()).forEach(function (x) { o[x.type] = x.value; });
      var dow = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(o.weekday);
      if (dow < 0) return null;
      return { dow: dow, min: (Number(o.hour) % 24) * 60 + Number(o.minute) };
    } catch (e) { return null; }
  }
  function pointStatus(p) {
    var now = kyivNow();
    if (!now || !Array.isArray(p.h)) return null;
    function mins(s) { return Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5)); }
    var h = p.h[now.dow];
    if (h) {
      if (now.min >= mins(h.slice(0, 5)) && now.min < mins(h.slice(6))) return { open: true, text: tf('ptOpen', { t: h.slice(6) }) };
      if (now.min < mins(h.slice(0, 5))) return { open: false, text: tf('ptToday', { t: h.slice(0, 5) }) };
    }
    for (var i = 1; i <= 7; i++) {
      var d = (now.dow + i) % 7;
      if (!p.h[d]) continue;
      return { open: false, text: i === 1 ? tf('ptTomorrow', { t: p.h[d].slice(0, 5) }) : tf('ptLater', { d: t('daysWhen').split(',')[d], t: p.h[d].slice(0, 5) }) };
    }
    return null;
  }
  function hoursText(h) {
    var D = t('days').split(','), parts = [], i = 0;
    while (i < 7) {
      var j = i;
      while (j + 1 < 7 && h[j + 1] === h[i]) j++;
      parts.push((i === j ? D[i] : D[i] + '–' + D[j]) + ': ' + (h[i] ? h[i].replace('-', '–') : t('ptOff')));
      i = j + 1;
    }
    return parts.join(', ');
  }
  function statusHtml(p) {
    var s = pointStatus(p);
    return s ? '<p class="point__status' + (s.open ? ' is-open' : '') + '">' + esc(s.text) + '</p>' : '';
  }
  function pointsHtml() {
    var html = pageHead(t('ptsTitle'));
    var list = points();
    if (!state.catalog) return html + '<div class="skeleton skeleton--row"></div><div class="skeleton skeleton--row"></div>';
    if (!list.length) { // листа «Точки» ещё нет — показываем адрес и часы из настроек
      var shop = shopInfo();
      return html + '<article class="point"><div class="facts">' +
        (loc(shop.address) ? '<p>' + icon('pin') + '<span>' + esc(loc(shop.address)) + '</span></p>' : '') +
        (loc(shop.hours) ? '<p>' + icon('clock') + '<span>' + esc(loc(shop.hours)) + '</span></p>' : '') + '</div></article>';
    }
    list.forEach(function (p) {
      html += '<article class="point" data-point="' + esc(p.id) + '">' +
        (p.img ? '<div class="point__img"><img src="' + esc(p.img) + '" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer"></div>' : '') +
        '<h3 class="point__name">' + esc(loc(p)) + '</h3>' + statusHtml(p) + '<div class="facts">' +
        (loc(p.a) || p.pl ? '<p>' + icon('pin') + '<span>' + esc([loc(p.a), loc(p.pl)].filter(Boolean).join(', ')) + '</span></p>' : '') +
        (p.how ? '<p>' + icon('map') + '<span>' + esc(loc(p.how)) + '</span></p>' : '') +
        '<p>' + icon('clock') + '<span>' + esc(hoursText(p.h)) + '</span></p></div><div class="point__acts">' +
        (p.map ? '<button type="button" class="btn btn--primary" data-w1="open" data-url="' + esc(p.map) + '">' + icon('map') + esc(t('ptRoute')) + '</button>' : '') +
        (p.tel ? '<a class="btn" href="tel:' + esc(p.tel) + '">' + icon('call') + esc(t('ptCall')) + '</a>' : '') +
        (p.video ? '<button type="button" class="btn" data-w1="open" data-url="' + esc(p.video) + '">' + icon('video') + esc(t('ptVideo')) + '</button>' : '') +
        '</div></article>';
    });
    return html;
  }
  /** Самовывоз в оформлении: выбор точки (если их несколько) или старый адрес из настроек. */
  function pickupHtml(addr, hours) {
    var list = points();
    if (!list.length) return '<div class="info"><p>' + esc(addr) + '</p><p class="info__muted">' + esc(hours) + '</p></div>';
    if (!pointById(state.form.point)) state.form.point = list[0].id;
    var html = '<p class="label">' + esc(t('ptPick')) + '</p><div class="opts opts--col">';
    list.forEach(function (p) {
      var s = pointStatus(p);
      html += '<label class="opt opt--point"><input type="radio" name="point" value="' + esc(p.id) + '"' + (state.form.point === p.id ? ' checked' : '') + '>' +
        '<span class="opt__box"><span><b>' + esc(loc(p)) + '</b><small>' + esc([loc(p.pl), s ? s.text : ''].filter(Boolean).join(' · ')) + '</small></span></span></label>';
    });
    return html + '</div><button type="button" class="btn btn--ghost btn--block" data-w1="go" data-view="points">' + icon('map') + esc(t('ptHow')) + '</button>';
  }

  /* ---- 1.7 Нова пошта: тип доставки, города, подсказки (если на сервере задан NP_API_KEY) ---- */
  var NP_CITIES = [['Харків', 'Харьков'], ['Київ', 'Киев'], ['Дніпро', 'Днепр'], ['Львів', 'Львов'], ['Одеса', 'Одесса'], ['Запоріжжя', 'Запорожье'], ['Вінниця', 'Винница'], ['Полтава', 'Полтава']];
  var np = { ref: '', timer: null, seq: 0, cities: {}, wh: {}, whSeq: 0, whTimer: null, tap: 0, resolving: false, whAt: {}, whPending: {}, chosen: null, flight: '', queued: null, req: {}, whq: {} };
  var NP_TIMEOUT = 5000;
  var NP_MIN = 3;               // подсказки города — от 3 букв; короче поле просто принимает любой текст
  var NP_DEBOUNCE = 600;        // пауза после последней буквы перед запросом
  var NP_PAUSE_MS = 10 * 60 * 1000; // после ошибки Новой почты (лимит и т.п.) запросов np.* не шлём 10 минут
  var NP_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  function ssGet(k) { try { return window.sessionStorage.getItem(k); } catch (e) { return null; } }
  function ssSet(k, v) { try { window.sessionStorage.setItem(k, v); } catch (e) { /* хранилище недоступно — живём в памяти */ } }
  /* --- пауза: Нова пошта ответила ошибкой — до её конца витрина не шлёт np.*, поля работают вручную, покупателю ничего не показываем --- */
  var npPauseUntil = Number(ssGet('pamir_nppause_v1')) || 0;
  function npPaused() { return Date.now() < npPauseUntil; }
  function npPauseSet(res) {
    var ra = res && Number(res.retryAfter), ms = ra > 0 ? Math.min(ra, 3600) * 1000 : NP_PAUSE_MS; // retryAfter — секунды; без него (три ошибки подряд у старого бэкенда) — 10 минут
    npPauseUntil = Date.now() + ms;
    ssSet('pamir_nppause_v1', String(npPauseUntil));
    clearTimeout(np.timer); clearTimeout(np.whTimer); clearTimeout(npc.timer); npc.want = ''; np.queued = null;
  }
  /** Запрос np.* через единую дверь: в паузе не уходит. ОБЩУЮ паузу включает только ответ с retryAfter (так новый бэкенд сообщает о лимите НП)
   *  или три ошибки ok:false подряд за 2 минуты (старый бэкенд retryAfter не присылает). Остальные ошибки отключают только свой запрос — решает вызывающий. */
  var npErrAt = [];
  function npGet(query, limit) {
    if (npPaused()) return Promise.reject(new Error('np_pause'));
    return apiGetTimed(query, limit).then(function (res) {
      if (res && res.ok === false) {
        var now = Date.now();
        if (Number(res.retryAfter) > 0) { npErrAt = []; npPauseSet(res); }
        else if (res.error === 'busy') { /* такой же запрос уже в пути: это не ошибка НП, в счёт «3 за 2 минуты» не идёт */ }
        else {
          npErrAt.push(now);
          npErrAt = npErrAt.filter(function (t0) { return now - t0 <= 120000; });
          if (npErrAt.length >= 3) { npErrAt = []; npPauseSet(null); }
        }
      } else if (res && res.ok) npErrAt = [];
      return res;
    });
  }
  /* --- справочник Новой почты через Worker (config NP_URL): города и список отделений города. Без initData и данных покупателя — только q или city.
   *  Любой сбой Worker (nodata, не 200, не JSON, ok:false, таймаут, сеть, старый Worker с 404) — тот же запрос уходит в Apps Script, а Worker 10 минут не дёргаем.
   *  Отдельная метка от общей паузы 'pamir_nppause_v1' (та — про лимит Нової пошти и касается только Apps Script). ok:true с пустым списком — настоящий ответ. --- */
  var NP_WORKER_TIMEOUT = 4000;
  var npWorkerUntil = Number(ssGet('pamir_npworker_v1')) || 0;
  function npWorkerBase() {
    var u = String(cfg.NP_URL || '').replace(/\/+$/, '');
    return /^https?:\/\//.test(u) ? u : '';
  }
  function npWorkerOn() { return !!npWorkerBase() && Date.now() >= npWorkerUntil; }
  function npWorkerFail() {
    npWorkerUntil = Date.now() + NP_PAUSE_MS;
    ssSet('pamir_npworker_v1', String(npWorkerUntil));
  }
  /** Общая пауза Apps Script не должна глушить поля, пока работает Worker. */
  function npBlocked() { return npPaused() && !npWorkerOn(); }
  function npWorkerGet(path) {
    return new Promise(function (resolve, reject) {
      var done = false, ctl = null;
      try { ctl = window.AbortController ? new AbortController() : null; } catch (e) { ctl = null; }
      var timer = setTimeout(function () {
        if (done) return;
        done = true;
        try { if (ctl) ctl.abort(); } catch (e) { /* уже закончено */ }
        reject(new Error('timeout'));
      }, NP_WORKER_TIMEOUT);
      fetch(npWorkerBase() + path, ctl ? { signal: ctl.signal } : undefined)
        .then(function (r) { if (r.status !== 200) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(function (v) {
          if (done) return; done = true; clearTimeout(timer);
          if (v && v.ok === true && Array.isArray(v.list)) resolve(v); else reject(new Error('np_worker_bad'));
        }, function (e) { if (done) return; done = true; clearTimeout(timer); reject(e); });
    });
  }
  /** Worker (если включён), иначе или при сбое — Apps Script через npGet (там своя пауза и счёт ошибок). */
  function npListGet(workerPath, appsQuery, appsLimit) {
    if (!npWorkerOn()) return npGet(appsQuery, appsLimit);
    return npWorkerGet(workerPath).catch(function () { npWorkerFail(); return npGet(appsQuery, appsLimit); });
  }
  /** Ref города Новой почты для текста города city: выбран из подсказки (np.ref), совпадает с ранее выбранным или восстановлен из сохранённой формы; введён руками — пусто. */
  function npRefNow(city) {
    if (np.ref && NP_UUID.test(np.ref)) return np.ref;
    return npKnownRef(city);
  }
  /** Ref, если текст city совпадает с уже выбранным городом (в этой сессии или в сохранённой форме); иначе пусто. Запрос к серверу для такого текста не нужен. */
  function npKnownRef(city) {
    var f = state.form, low = npKey(city);
    if (!low) return '';
    if (np.chosen && np.chosen.t === low && NP_UUID.test(np.chosen.ref)) return np.chosen.ref;
    if (f.cityRef && f.cityRefFor && npKey(f.cityRefFor) === low && NP_UUID.test(f.cityRef)) { np.chosen = { t: low, ref: f.cityRef }; return f.cityRef; }
    return '';
  }
  function npKey(q) { return String(q || '').trim().replace(/\s+/g, ' ').toLowerCase(); }

  /* --- стоимость доставки «≈ 85 ₴ за тарифом Нової пошти» (только при shop.npp = 1; в сумму заказа не входит) --- */
  // Не чаще одного запроса на пару (город, ступень веса 0,5 кг) за сессию: кэш в памяти и в sessionStorage; после ошибки — не раньше чем через 10 минут.
  var npc = { cache: {}, failAt: {}, timer: null, want: '', off: false }; // off: сервер не считает стоимость (off / нет функции) — до перезагрузки каталога не спрашиваем
  var NPC_DEBOUNCE = 400, NPC_RETRY_MS = NP_PAUSE_MS;
  (function () {
    try {
      var s = JSON.parse(ssGet('pamir_npc_v1') || '{}');
      Object.keys(s.c || {}).forEach(function (k) { if (Number(s.c[k]) > 0) npc.cache[k] = Number(s.c[k]); });
      Object.keys(s.f || {}).forEach(function (k) { npc.cache[k] = 'fail'; npc.failAt[k] = Number(s.f[k]) || 0; });
    } catch (e) { /* битая запись — начинаем с пустого кэша */ }
  })();
  function npcSave() {
    var s = { c: {}, f: {} };
    Object.keys(npc.cache).forEach(function (k) { if (typeof npc.cache[k] === 'number') s.c[k] = npc.cache[k]; else if (npc.cache[k] === 'fail') s.f[k] = npc.failAt[k] || 0; });
    ssSet('pamir_npc_v1', JSON.stringify(s));
  }
  function npCostOn() { return Number(shopInfo().npp) === 1 && !!cfg.API_URL && !npc.off; }
  /** Что спрашивать у сервера сейчас: город, вес корзины, сумма. null — не хватает данных (нет города с ref, не наш вид доставки, вес хоть одной позиции неизвестен). */
  function npCostTarget() {
    if (!npCostOn() || state.form.delivery !== 'np' || !state.catalog) return null;
    var cityEl = document.getElementById('f-city');
    var city = cityEl && state.view === 'checkout' ? cityEl.value.trim() : state.form.city;
    var ref = npRefNow(city);
    if (!ref) return null;
    var grams = 0, n = 0;
    for (var i = 0; i < state.cart.i.length; i++) {
      var l = state.cart.i[i];
      if (!lineInfo(l).ok) continue; // позиции, которых нет, в заказ не попадают
      if (!(l.g > 0)) return null;   // штучный товар: вес неизвестен, цифру не выдумываем
      grams += l.g * l.q; n++;
    }
    if (!n || !(grams > 0)) return null;
    var step = Math.ceil(grams / 500);
    return { key: ref.toLowerCase() + '|' + step, ref: ref, grams: grams, sum: Math.round(cartTotal()) };
  }
  function npCostText() {
    var w = npCostTarget();
    if (!w) return '';
    var c = npc.cache[w.key];
    if (typeof c === 'number') return tf('npCost', { n: money(c) });
    if (!npPaused() && (c === undefined || (c === 'fail' && Date.now() - (npc.failAt[w.key] || 0) >= NPC_RETRY_MS))) npCostAsk(w); // после ошибки повтор не раньше чем через 10 минут
    return '';
  }
  function npCostAsk(w) {
    if (npc.want === w.key) return;          // этот запрос уже ждёт своей очереди или в пути
    npc.want = w.key;
    clearTimeout(npc.timer);
    npc.timer = setTimeout(function () {
      var c0 = npc.cache[w.key];
      if (c0 === 'loading' || typeof c0 === 'number' || npPaused()) { if (npc.want === w.key) npc.want = ''; return; }
      npc.cache[w.key] = 'loading';
      // short — сдвиг метки ошибки: ключ спросим снова не через 10 минут, а через (10 минут − short)
      var done = function (c, short) {
        if (c) npc.cache[w.key] = c; else { npc.cache[w.key] = 'fail'; npc.failAt[w.key] = Date.now() - (short || 0); }
        npcSave();
      };
      npGet('action=np.price&city=' + encodeURIComponent(w.ref) + '&w=' + w.grams + '&sum=' + w.sum, 8000).then(function (res) {
        if (res && res.ok === false && res.error === 'off') npc.off = true;                // данные отправителя устарели: стоимость не спрашиваем до перезагрузки каталога
        else if (res && res.ok === true && !('cost' in res)) npc.off = true;               // старый бэкенд: на неизвестное действие отвечает {ok:true} без данных — функции нет
        var ra = res && res.ok === false ? Number(res.retryAfter) : 0;
        // busy без retryAfter (такой же запрос уже в пути) — этот ключ снова через 90 с; busy с retryAfter — сразу после общей паузы; прочие ошибки (np_error) — через 10 минут
        var short = res && res.ok === false && res.error === 'busy' ? (ra > 0 ? NPC_RETRY_MS : NPC_RETRY_MS - 90000) : 0;
        done(res && res.ok && Number(res.cost) > 0 ? Math.round(Number(res.cost)) : 0, short);
      }).catch(function () { done(0); })
        .then(function () { if (npc.want === w.key) npc.want = ''; npCostSync(); }); // устаревший ответ только ложится в кэш: показывается то, что нужно сейчас
    }, NPC_DEBOUNCE);
  }
  /** Обновляет строки стоимости на экране (корзина и оформление). Нет данных, ошибка или таймаут — строка скрыта. */
  function npCostSync() {
    var nodes = el.page.querySelectorAll('.js-npcost');
    if (!nodes.length) return;
    var text = npCostText();
    Array.prototype.forEach.call(nodes, function (n) {
      n.hidden = !text;
      var v = n.querySelector('.np-cost__v');
      if (v) v.textContent = text;
    });
  }
  function npCostHtml() {
    if (!npCostOn()) return '';
    return '<div class="np-cost js-npcost" role="status" hidden><p class="np-cost__v"></p><p class="np-cost__n">' + esc(t('npCostNote')) + '</p></div>';
  }
  function npFieldsHtml() {
    var f = state.form;
    if (!{ branch: 1, locker: 1, courier: 1 }[f.npType]) f.npType = 'branch';
    return '<div class="opts opts--3">' + option('npType', 'branch', '', t('npBranch')) + option('npType', 'locker', '', t('npLocker')) + option('npType', 'courier', '', t('npCourier')) + '</div>' +
      field('city', esc(t('fCity')), 'type="text" autocomplete="address-level2" maxlength="60" enterkeyhint="next"', f.city,
        '<div class="sugg" id="citySugg" hidden></div><p class="np-busy" id="cityBusy" role="status" hidden>' + esc(t('npSearching')) + '</p>' +
        '<p class="np-hint" id="cityPick" hidden>' + esc(t('npPickCity')) + '</p><div class="chips chips--flush" id="cityChips">' + NP_CITIES.map(function (c) {
          return '<button type="button" class="chip chip--sm" data-w1="city" data-city="' + esc(c[0]) + '">' + esc(state.lang === 'ru' ? c[1] : c[0]) + '</button>';
        }).join('') + '</div>') +
      field('branch', esc(t('fBranch_' + f.npType)), 'type="text" autocomplete="off" maxlength="' + (f.npType === 'courier' ? 120 : 30) + '" enterkeyhint="next"', f.branch,
        '<div class="sugg" id="whSugg" hidden></div><p class="np-busy" id="whBusy" role="status" hidden>' + esc(t('npSearching')) + '</p>');
  }
  function syncNp() {
    var input = document.getElementById('f-branch');
    var label = el.page.querySelector('label[for="f-branch"]');
    if (!input || !label) return;
    var type = state.form.npType || 'branch';
    label.textContent = t('fBranch_' + type);
    input.maxLength = type === 'courier' ? 120 : 30;
    npShowWh();
  }
  /** GET к серверу с обрывом через 5 с: долгий ответ не мешает оформлению, остаётся ручной ввод. */
  function apiGetTimed(query, limit) {
    return new Promise(function (resolve, reject) {
      var done = false, ctl = null;
      try { ctl = window.AbortController ? new AbortController() : null; } catch (e) { ctl = null; }
      var timer = setTimeout(function () {
        if (done) return;
        done = true;
        try { if (ctl) ctl.abort(); } catch (e) { /* уже закончено */ }
        reject(new Error('timeout'));
      }, limit || NP_TIMEOUT);
      fetch(cfg.API_URL + (cfg.API_URL.indexOf('?') < 0 ? '?' : '&') + query, ctl ? { signal: ctl.signal } : undefined)
        .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(function (v) { if (done) return; done = true; clearTimeout(timer); resolve(v); },
          function (e) { if (done) return; done = true; clearTimeout(timer); reject(e); });
    });
  }
  function apiGet(query) {
    return fetch(cfg.API_URL + (cfg.API_URL.indexOf('?') < 0 ? '?' : '&') + query).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
  }
  function suggShow(id, list, kind) {
    var box = document.getElementById(id);
    if (!box) return;
    box.hidden = !list.length;
    box.innerHTML = list.map(function (x) {
      return '<button type="button" data-w1="' + kind + '" data-ref="' + esc(x.ref || '') + '" data-val="' + esc(kind === 'np-city' ? x.s : (x.num || x.n)) + '">' + esc(x.n) + '</button>';
    }).join('');
  }
  function npBusy(id, on) { var b = document.getElementById(id); if (b) b.hidden = !on; }
  function npOn() { return !!(shopInfo().np && cfg.API_URL && state.view === 'checkout'); }

  /* --- города: от 3 букв, дебаунс 600 мс, кэш по нормализованной строке, один запрос в пути (новый ждёт), устаревшие ответы только в кэш --- */
  function npCityTyped(input) {
    clearTimeout(np.timer);
    np.seq++; np.resolving = false; np.queued = null;
    var q = input.value.trim(), key = npKey(q), seq = np.seq;
    npBusy('cityPick', false);
    var known = npKnownRef(q);
    if (known) { // текст совпал с уже выбранным городом: ref возвращаем, на сервер не ходим
      np.ref = known; npBusy('cityBusy', false); suggShow('citySugg', [], '');
      npCostSync(); npLoadWh();
      return;
    }
    np.ref = ''; npBusy('whBusy', false); suggShow('whSugg', [], ''); npCostSync();
    if (q.length < NP_MIN || npBlocked()) { suggShow('citySugg', [], ''); npBusy('cityBusy', false); return; }
    if (np.cities[key]) { npBusy('cityBusy', false); suggShow('citySugg', np.cities[key], 'np-city'); return; }
    npBusy('cityBusy', true);
    np.timer = setTimeout(function () { npCityFetch(q, seq, false, false); }, NP_DEBOUNCE);
  }
  var npCityFail = {}; // текст -> до какого момента его не запрашиваем (ошибка не из-за лимита: только этот текст)
  function npCityFetch(q, seq, pick, chip, retried) {
    var key = npKey(q);
    if (npBlocked() || Date.now() < (npCityFail[key] || 0)) { if (seq === np.seq) { np.resolving = false; npBusy('cityBusy', false); suggShow('citySugg', [], ''); } return; }
    if (np.flight) { np.queued = { q: q, seq: seq, pick: pick, chip: chip }; return; } // один запрос в пути: новый ждёт его конца
    np.flight = key;
    var finish = function () { np.flight = ''; npCityNext(); };
    npListGet('/cities?q=' + encodeURIComponent(q), 'action=np.city&q=' + encodeURIComponent(q)).then(function (res) {
      var list = res && res.ok && Array.isArray(res.list) ? res.list : null;
      if (list) np.cities[key] = list;
      if (!list && res && res.ok === false && res.error === 'busy' && !(Number(res.retryAfter) > 0) && !retried) { // с retryAfter — общая пауза (npGet), повтор не нужен; такой же запрос уже идёт: один повтор через ~2,5 с, если текст не менялся
        setTimeout(function () { if (seq === np.seq) npCityFetch(q, seq, pick, chip, true); else if (np.seq === seq) npBusy('cityBusy', false); }, 2500);
        finish();
        return;
      }
      if (!list && res && res.ok === false) npCityFail[key] = Date.now() + 60000; // этот текст — не раньше чем через минуту
      if (seq === np.seq) { // устаревший ответ только ложится в кэш и не затирает свежий
        np.resolving = false;
        npBusy('cityBusy', false);
        if (list) npCityShow(list, pick, q, chip); else suggShow('citySugg', [], '');
      }
      finish();
    }).catch(function () { if (seq === np.seq) { np.resolving = false; npBusy('cityBusy', false); suggShow('citySugg', [], ''); } finish(); });
  }
  /** Запрос, дожидавшийся конца предыдущего: уходит, только если он всё ещё актуален и ответа нет в кэше. */
  function npCityNext() {
    var n = np.queued; np.queued = null;
    if (!n || n.seq !== np.seq || npBlocked()) { if (n && n.seq === np.seq) { np.resolving = false; npBusy('cityBusy', false); } return; }
    var list = np.cities[npKey(n.q)];
    if (list) { np.resolving = false; npBusy('cityBusy', false); npCityShow(list, n.pick, n.q, n.chip); return; }
    npCityFetch(n.q, n.seq, n.pick, n.chip);
  }
  function npCityShow(list, pick, q, chip) {
    suggShow('citySugg', list, 'np-city');
    if (!pick) return;
    var one = list.length === 1 ? list[0] : null;
    if (!one && chip) {
      var same = list.filter(function (x) { return String(x.s).toLowerCase() === q.toLowerCase(); });
      if (same.length === 1) one = same[0];
    }
    if (one) npChooseCity(one, true); else npBusy('cityPick', true);
  }
  /** Город набран руками (или взят из чипа) без нажатия на подсказку: один вариант выбираем сами, иначе просим выбрать. */
  function npCityResolve(q, chip) {
    clearTimeout(np.timer);
    q = String(q || '').trim();
    if (!npOn() || np.ref || q.length < NP_MIN) return;
    var known = npKnownRef(q);
    if (known) { np.ref = known; npBusy('cityPick', false); npBusy('cityBusy', false); suggShow('citySugg', [], ''); readForm(); npCostSync(); npLoadWh(); return; } // уже выбранный город: запроса нет
    if (npBlocked()) return;
    var seq = ++np.seq, key = npKey(q);
    if (np.cities[key]) { npBusy('cityBusy', false); npCityShow(np.cities[key], true, q, chip); return; }
    npBusy('cityBusy', true);
    np.resolving = true; // поиск «по уходу с поля» или из чипа уже идёт: второй не запускаем
    npCityFetch(q, seq, true, chip);
  }
  function npChooseCity(x, auto) {
    var city = document.getElementById('f-city');
    if (!city) return;
    city.value = String(x.s).slice(0, 60);
    np.ref = String(x.ref || ''); np.seq++; np.queued = null;
    np.chosen = NP_UUID.test(np.ref) ? { t: npKey(city.value), ref: np.ref } : null; // этот текст больше не требует запросов
    npBusy('cityPick', false); npBusy('cityBusy', false);
    setError('city', ''); suggShow('citySugg', [], ''); readForm(); npCostSync();
    if (!auto) hapticSelect();
    npLoadWh();
    var br = document.getElementById('f-branch');
    if (!auto && br && !br.value) br.focus();
  }

  /* --- отделения: один запрос на город (np.whall), дальше фильтр на витрине без запросов --- */
  function npLoadWh() {
    var ref = np.ref;
    if (!npOn() || !ref) return;
    var st = np.wh[ref], retryMs = Number(window.__NP_RETRY_MS) || NP_PAUSE_MS;
    // Список — один раз на город за сессию. Прошлая попытка не удалась: повторяем при следующем фокусе поля, не раньше чем через 10 минут.
    if (npBlocked() && (st === undefined || st === 'old' || st === 'err')) return; // пауза: не грузим, поле работает вручную
    if (st === 'err' && Date.now() - (np.whAt[ref] || 0) >= retryMs) st = undefined; // ошибка списка этого города: не раньше чем через 10 минут
    if (st === 'old' && !np.whPending[ref] && Date.now() - (np.whAt[ref] || 0) >= retryMs) st = undefined;
    if (st === undefined) {
      np.wh[ref] = 'loading'; np.whPending[ref] = true; np.whAt[ref] = Date.now();
      npBusy('whBusy', state.form.npType !== 'courier');
      // Через 5 с «Шукаю…» исчезает и работает ручной ввод / старый путь, но сам запрос ждём до 40 с и ответ сохраняем.
      setTimeout(function () {
        if (np.wh[ref] !== 'loading') return;
        np.wh[ref] = 'old';
        if (np.ref === ref) npBusy('whBusy', false);
      }, NP_TIMEOUT);
      npWhAll(ref, false);
      return;
    }
    npShowWh();
  }
  /** Запрос списка отделений города. busy — одна повторная попытка через ~5 с; прочие ошибки — этот город 10 минут не запрашиваем. Запасной np.wh при ошибке НП не включаем. */
  function npWhAll(ref, retried) {
    npListGet('/warehouses?city=' + encodeURIComponent(ref), 'action=np.whall&city=' + encodeURIComponent(ref), 40000).then(function (res) {
      np.whPending[ref] = false;
      var list = res && res.ok && Array.isArray(res.list) ? res.list.filter(function (x) { return Array.isArray(x) && Number(x[0]) > 0; })
        .map(function (x) { return [Number(x[0]), String(x[1] || ''), x[2] === 'p' ? 'p' : 'w']; }) : null;
      var npErr = res && res.ok === false;
      if (npErr && res.error === 'busy' && !(Number(res.retryAfter) > 0) && !retried) { // busy с retryAfter — общая пауза (npGet), ниже whAt = 0; список города грузит другой запрос: ждём ~5 с и пробуем один раз
        np.wh[ref] = 'wait'; np.whPending[ref] = true;
        if (np.ref === ref) npBusy('whBusy', false);
        setTimeout(function () { if (npPaused()) { np.wh[ref] = 'err'; np.whAt[ref] = Date.now(); np.whPending[ref] = false; return; } np.wh[ref] = 'loading'; npWhAll(ref, true); }, 5000);
        return;
      }
      if (npErr) np.whAt[ref] = Number(res.retryAfter) > 0 ? 0 : Date.now(); // лимит НП (retryAfter): список повторим сразу после общей паузы; иная ошибка — через 10 минут
      // Ответ без списка и без ok:false — старый бэкенд ({ok:true} на неизвестное действие): подсказки по-старому, через np.wh.
      np.wh[ref] = list || (npErr ? 'err' : 'old');
      if (np.ref === ref) {
        npBusy('whBusy', false);
        var inp = document.getElementById('f-branch');
        if (list && inp && (document.activeElement === inp || !inp.value)) npShowWh(); // открытый список обновляем
      }
    }).catch(function () { np.whPending[ref] = false; np.wh[ref] = 'old'; if (np.ref === ref) npBusy('whBusy', false); });
  }
  /** Номер — точное совпадение первым («12» → №12, потом №120…), затем по улице. Тип — до обрезки списка. */
  function npFilterWh(list, q, type) {
    var want = type === 'locker' ? 'p' : 'w';
    var items = list.filter(function (x) { return x[2] === want; });
    q = String(q || '').replace(/^[№#\s]+/, '').trim();
    if (!q) return items.slice(0, 10);
    var digits = /^\d+$/.test(q), low = q.toLowerCase(), exact = [], pref = [], street = [];
    items.forEach(function (x) {
      var n = String(x[0]);
      if (digits && n === q) exact.push(x);
      else if (digits && n.indexOf(q) === 0) pref.push(x);
      else if (String(x[1]).toLowerCase().indexOf(low) >= 0) street.push(x);
    });
    return exact.concat(pref, street).slice(0, 10);
  }
  function npShowWh() {
    var input = document.getElementById('f-branch');
    if (!input) return;
    if (!npOn() || !np.ref || state.form.npType === 'courier' || state.form.delivery !== 'np') { suggShow('whSugg', [], ''); return; }
    var entry = np.wh[np.ref];
    if (!Array.isArray(entry)) return; // загружается, либо работает старый путь
    npBusy('whBusy', false);
    var items = npFilterWh(entry, input.value, state.form.npType).map(function (x) { return { n: '№' + x[0] + ', ' + x[1], num: String(x[0]) }; });
    suggShow('whSugg', items, 'np-wh');
  }
  function npBranchTyped(input) {
    if (!npOn()) return;
    if (!np.ref || state.form.npType === 'courier') { suggShow('whSugg', [], ''); return; }
    if (Array.isArray(np.wh[np.ref])) { npShowWh(); return; }
    if (np.wh[np.ref] !== 'old') return;
    // Старый бэкенд: запрос на ввод, с задержкой, устаревшие ответы отбрасываются.
    clearTimeout(np.whTimer);
    if (npPaused()) { suggShow('whSugg', [], ''); return; }
    var q = input.value.trim(), seq = ++np.whSeq, ref = np.ref, type = state.form.npType === 'locker' ? 'locker' : '', ck = ref + '|' + type + '|' + npKey(q); // ref: ответ по прежнему городу не показываем под новым
    if (np.whq[ck]) { npBusy('whBusy', false); suggShow('whSugg', np.whq[ck], 'np-wh'); return; } // та же строка — из кэша
    np.whTimer = setTimeout(function () {
      if (np.ref !== ref || npPaused()) return;
      npBusy('whBusy', true);
      npGet('action=np.wh&city=' + encodeURIComponent(ref) + '&q=' + encodeURIComponent(q) + '&t=' + type)
        .then(function (res) {
          var list = res && res.ok && Array.isArray(res.list) ? res.list : null;
          if (list) np.whq[ck] = list;
          if (seq === np.whSeq) { npBusy('whBusy', false); if (np.ref === ref) suggShow('whSugg', list || [], 'np-wh'); }
        })
        .catch(function () { if (seq === np.whSeq) npBusy('whBusy', false); });
    }, NP_DEBOUNCE);
  }
  function npSuggest(input) {
    if (!npOn()) return;
    if (input.name === 'city') npCityTyped(input); else npBranchTyped(input);
  }
  // Нажатие на подсказку не должно теряться из-за blur поля, который на телефоне срабатывает раньше click.
  function npTap(e) {
    if (!e.target.closest || !e.target.closest('.sugg')) return;
    np.tap = Date.now() + 700;
    if (e.type !== 'touchstart' && e.cancelable) e.preventDefault(); // поле не теряет фокус, список не перерисовывается до click
  }
  el.page.addEventListener('touchstart', npTap, { passive: true }); // прокрутку не тормозим: preventDefault здесь не нужен
  el.page.addEventListener('pointerdown', npTap);
  el.page.addEventListener('mousedown', npTap);
  el.page.addEventListener('focusin', function (e) {
    if (!npOn() || e.target.name !== 'branch') return;
    var city = document.getElementById('f-city');
    if (!np.ref && city && city.value.trim().length >= NP_MIN) npCityResolve(city.value, false);
    else if (np.ref) npLoadWh();
  });
  el.page.addEventListener('focusout', function (e) {
    var name = e.target && e.target.name;
    if (name !== 'city' && name !== 'branch') return;
    setTimeout(function () {
      if (Date.now() < np.tap || !npOn() || np.resolving) return;
      var inp = document.getElementById('f-' + name);
      if (!inp || document.activeElement === inp) return;
      if (name === 'city') npCityResolve(inp.value, false);
      else suggShow('whSugg', [], '');
    }, 200);
  });

  /* ---- 1.4 «Від саду до столу» и паспорт товара ---- */
  function storyHtml() {
    var s = shopInfo().story;
    if (!s) return pageHead(t('storyBtn')) + '<div class="skeleton skeleton--row"></div>';
    var html = pageHead(loc(s.title) || t('storyBtn')) + '<div class="story__top">' + ORN + MARK + '</div><div class="story">';
    var photos = (s.img || []).slice();
    loc(s.text).split(/\n+/).forEach(function (par, i) {
      if (!par.trim()) return;
      html += '<p>' + esc(par.trim()) + '</p>';
      if (photos.length && i % 2 === 0) html += '<img class="story__img" src="' + esc(photos.shift()) + '" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">';
    });
    photos.forEach(function (u) { html += '<img class="story__img" src="' + esc(u) + '" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">'; });
    var f = shopInfo().feature, fp = f && product(f.id);
    if (fp && fp.a) html += '<button type="button" class="btn btn--primary btn--block" data-w1="product" data-pid="' + esc(fp.id) + '">' + esc(name(fp)) + '</button>';
    return html + '</div>';
  }
  function passportHtml(p) {
    var rows = [['ps', 'passSort'], ['ph', 'passHarvest'], ['po', 'passOrigin']].filter(function (r) { return p[r[0]]; })
      .map(function (r) { return '<div><dt>' + esc(t(r[1])) + '</dt><dd>' + esc(p[r[0]]) + '</dd></div>'; });
    if (p.pf) rows.push('<div><dt>' + esc(t('passFresh')) + '</dt><dd>' + esc(String(p.pf).split('-').reverse().join('.')) + '</dd></div>');
    return rows.length ? '<dl class="pass">' + rows.join('') + '</dl>' : '';
  }
  function freshHtml(p) {
    return p.a && p.f && p.pf ? '<span class="chipline chipline--fresh">' + esc(tf('fresh', { d: dayMonth(p.pf) })) + '</span>' : '';
  }

  /* ---- 1.5 Отзывы ---- */
  var rvCache = {};
  function starsHtml(n) {
    var s = '';
    for (var i = 1; i <= 5; i++) s += '<svg class="ico' + (i <= n ? ' is-on' : '') + '" viewBox="0 0 24 24" aria-hidden="true">' + ICONS.star + '</svg>';
    return '<span class="stars" role="img" aria-label="' + n + ' ' + esc(t('rvFrom')) + '">' + s + '</span>';
  }
  function rvCount(n) { return n + ' ' + plural(n, t('rv1'), t('rv2'), t('rv5')); }
  function rateHtml(p) {
    if (!(p.ra > 0)) return '';
    return '<span class="chipline chipline--rate"><svg class="ico is-on" viewBox="0 0 24 24" aria-hidden="true">' + ICONS.star + '</svg>' +
      String(p.ra.toFixed(1)).replace('.', ',') + ' · ' + esc(rvCount(p.rc)) + '</span>';
  }
  function cardExtraHtml(p) {
    var x = rateHtml(p) + freshHtml(p);
    return x ? '<div class="card__extra">' + x + '</div>' : '';
  }
  function loadReviews(id) {
    rvCache[id] = 'loading';
    apiGet('action=reviews&id=' + encodeURIComponent(id)).then(function (res) {
      rvCache[id] = res && res.ok ? (res.reviews || []) : 'error';
    }).catch(function () { rvCache[id] = 'error'; }).then(function () {
      if (state.sheet && state.sheet.id === id) renderSheet();
    });
  }
  function reviewsHtml(p) {
    if (!(p.rc > 0) || !cfg.API_URL) return '';
    if (!rvCache[p.id]) loadReviews(p.id);
    var list = rvCache[p.id];
    var html = '<section class="rv"><div class="rv__head"><h3 class="rail__title">' + esc(t('rvTitle')) + '</h3>' +
      (p.ra > 0 ? '<span class="rv__avg">' + String(p.ra.toFixed(1)).replace('.', ',') + ' ' + esc(t('rvFrom')) + ' · ' + esc(rvCount(p.rc)) + '</span>' : '') + '</div>';
    if (list === 'loading') return html + '<div class="skeleton skeleton--line"></div><div class="skeleton skeleton--line"></div></section>';
    if (list === 'error') return html + '<p class="state__text">' + esc(t('rvFail')) + '</p></section>';
    list.forEach(function (r) {
      html += '<article class="rv__item"><p class="rv__who"><b>' + esc(r.n || '') + '</b>' + starsHtml(r.r) + '<span>' + esc(r.d || '') + '</span></p>' +
        (r.t ? '<p class="rv__text">' + esc(r.t) + '</p>' : '') +
        (r.img ? '<img class="rv__img" src="' + esc(r.img) + '" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">' : '') + '</article>';
    });
    return html + '<p class="rv__note">' + esc(t('rvOnly')) + '</p></section>';
  }
  function reviewsAdminHtml() {
    var list = adm.reviews || [];
    if (!list.length) return '<p class="state__text adm__msg">' + esc(t('rvEmpty')) + '</p>';
    return '<ul class="lines">' + list.map(function (r) {
      var cls = r.status === 'схвалено' ? 'badge--stock' : r.status === 'приховано' ? 'badge--out' : 'badge--opt';
      return '<li class="my"><div class="my__head"><span class="ord__num">' + esc(r.id) + '</span><span class="badge ' + cls + '">' + esc(t('rvs_' + r.status)) + '</span>' +
        '<span class="my__date">' + esc(r.date) + '</span></div>' +
        '<p class="rv__who"><b>' + esc(r.pname) + '</b>' + starsHtml(r.rate) + '</p>' +
        '<p class="rv__text">' + esc(r.name) + ' · ' + esc(t('rvOrder')) + ' ' + esc(r.num) + (r.hasPhoto && !r.img ? ' · ' + esc(t('rvPhoto')) : '') + '</p>' +
        (r.text ? '<p class="info">' + esc(r.text) + '</p>' : '') +
        (r.img ? '<img class="rv__img" src="' + esc(r.img) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' : '') +
        '<div class="ord__acts"><button type="button" class="btn' + (r.status === 'схвалено' ? ' btn--soft' : '') + '" data-w1="rv" data-id="' + esc(r.id) + '" data-ok="1"' + (r.status === 'схвалено' ? ' disabled' : '') + '>' + esc(t('rvApprove')) + '</button>' +
        '<button type="button" class="btn' + (r.status === 'приховано' ? ' btn--soft' : '') + '" data-w1="rv" data-id="' + esc(r.id) + '" data-ok="0"' + (r.status === 'приховано' ? ' disabled' : '') + '>' + esc(t('rvHide')) + '</button></div></li>';
    }).join('') + '</ul>';
  }
  /** ТТН в карточке заказа админ-панели (только для Новой почты). */
  function ttnAdminHtml(o) {
    if (String(o.delivery).toLowerCase().indexOf('пошта') < 0) return '';
    var html = o.ttn ? '<p>' + esc(t('ttn')) + ': <b>' + esc(o.ttn) + '</b>' + (Number(o.ttnTrial) === 1 ? ' <span class="badge badge--opt">' + esc(t('ttnTrial')) + '</span>' : '') + '</p>' : '';
    if (can('st')) {
      if (adm.npTtn === 1 && !o.ttn) html += '<button type="button" class="btn btn--block" data-w1="ttn-make" data-num="' + esc(o.num) + '">' + esc(t('ttnMake')) + '</button>'; // только если бэкенд включил (ключ и данные отправителя) и ТТН ещё нет
      if (o.ttnDel === 1 && o.ttn) html += '<button type="button" class="btn btn--block" data-w1="ttn-del" data-num="' + esc(o.num) + '">' + esc(t('ttnDel')) + '</button>'; // бэкенд сам решает, можно ли (создана магазином, моложе 24 ч); старый бэкенд поля не шлёт
      html += '<div class="ttnrow"><input class="input" type="text" inputmode="numeric" maxlength="24" autocomplete="off" placeholder="' + esc(t('ttnPh')) + '" aria-label="' + esc(t('ttnPh')) + '" id="ttn-' + esc(o.num) + '" value="' + esc(o.ttn || '') + '">' +
        '<button type="button" class="btn" data-w1="ttn" data-num="' + esc(o.num) + '">' + esc(t('ttnSave')) + '</button></div>';
    }
    return html;
  }

  /* ---- 1.6 Честные продающие механики ---- */
  /** Выгода крупной фасовки — только расчёт из цен таблицы. Нет выгоды — пустая строка. */
  function bulkSaving(p) {
    if (p.t !== 'w' || !p.v || p.v.length < 2) return '';
    var small = p.v[0], big = p.v[0];
    p.v.forEach(function (v) { if (v[0] < small[0]) small = v; if (v[0] > big[0]) big = v; });
    var k = big[0] / small[0];
    if (k < 2 || Math.abs(k - Math.round(k)) > 1e-9 || !(small[1] > 0) || !(big[1] > 0)) return '';
    var pct = Math.round((1 - big[1] / (small[1] * k)) * 100);
    return pct >= 1 ? tf('bulkSave', { big: weight(big[0]), pct: pct, k: Math.round(k), small: weight(small[0]) }) : '';
  }
  function sheetHintsHtml(p) {
    var hint = state.lang === 'ru' ? (p.hr || p.h) : p.h;
    var save = bulkSaving(p);
    return (save ? '<p class="note note--gift">' + icon('gift') + '<span>' + esc(save) + '</span></p>' : '') +
      (hint ? '<p class="hint">' + esc(hint) + '</p>' : '');
  }
  /** Шкала до подарка на главной: пока корзина пустая — просто условие, потом — сколько осталось. */
  function homeGiftHtml() {
    var s = shopInfo();
    if (!s.gift) return '';
    var total = cartTotal(), g = loc(s.gift);
    if (!(total > 0)) return '<p class="plus__text">' + esc(tf('giftFrom', { n: money(s.gift.from), g: g })) + '</p>';
    return total >= s.gift.from
      ? '<p class="note note--gift">' + icon('gift') + '<span>' + esc(tf('giftOk', { g: g })) + '</span></p>'
      : progressHtml(total / s.gift.from, tf('giftLeft', { n: money(s.gift.from - total), g: g }), 'gift');
  }
  /** «Ваше звичне»: товары, которые есть минимум в двух заказах клиента, в его последней фасовке и количестве. */
  function usualLines() {
    if (!my.list || !state.catalog) return [];
    var orders = my.list.filter(function (o) { return o.i && o.status !== 'скасовано' && o.status !== 'немає в наявності'; });
    if (orders.length < 2) return [];
    var seenIn = {}, last = {};
    orders.forEach(function (o) {
      var here = {};
      o.i.forEach(function (it) {
        var id = String(it[0]);
        if (here[id]) return;
        here[id] = 1;
        seenIn[id] = (seenIn[id] || 0) + 1;
        if (!last[id]) last[id] = [id, Number(it[1]) || 0, Math.max(1, Math.min(MAX_QTY, Math.floor(Number(it[2])) || 1))];
      });
    });
    return Object.keys(seenIn).filter(function (id) { return seenIn[id] >= 2 && unitPrice(product(id), last[id][1]) > 0; })
      .sort(function (a, b) { return seenIn[b] - seenIn[a]; }).slice(0, 4).map(function (id) { return last[id]; });
  }
  function usualHtml() {
    var lines = usualLines();
    if (!lines.length) return '';
    return '<section class="rail usual"><div class="rail__head"><h2 class="rail__title">' + esc(t('usualTitle')) + '</h2><span class="rail__sub">' + esc(t('usualSub')) + '</span></div>' +
      '<div class="rail__list">' + lines.map(function (l) { return miniHtml(product(l[0])); }).join('') + '</div>' + usualBtnHtml() + '</section>';
  }
  function usualBtnHtml() {
    var sum = 0;
    usualLines().forEach(function (l) { sum += unitPrice(product(l[0]), l[1]) * l[2]; });
    return '<button type="button" class="btn btn--soft btn--block" data-w1="usual">' + icon('plus') + esc(t('usualAdd')) + ' · ' + money(sum) + '</button>';
  }
  function addUsual() {
    var added = 0;
    usualLines().forEach(function (u) {
      var price = unitPrice(product(u[0]), u[1]);
      if (!(price > 0)) return;
      var line = null;
      state.cart.i.forEach(function (l) { if (l.id === u[0] && l.g === u[1]) line = l; });
      if (line) { line.q = Math.min(MAX_QTY, line.q + u[2]); line.pr = price; }
      else state.cart.i.push({ id: u[0], g: u[1], q: u[2], pr: price });
      added++;
    });
    if (!added) return;
    track('usual', '', added);
    saveCart();
    haptic('success');
    afterCartChange(true);
    toast(t('usualDone'), t('open'), function () { go('cart'); });
  }

  /** Состав корзины (без цен) уходит на сервер: по нему бот один раз напомнит о брошенной корзине. */
  var cartSync = { timer: null, sent: '[]' };
  function scheduleCartSync() {
    if (!inTelegram || !cfg.API_URL) return;
    clearTimeout(cartSync.timer);
    cartSync.timer = setTimeout(function () {
      var items = state.cart.i.map(function (l) { return [l.id, l.g, l.q]; });
      var text = JSON.stringify(items);
      if (text === cartSync.sent) return;
      cartSync.sent = text;
      postApi('cart', { items: items, lang: state.lang }).catch(function () { cartSync.sent = ''; });
    }, 4000);
  }

  /** Имя, телефон и доставка запоминаются и в Telegram (CloudStorage): на новом телефоне форму не заполняют заново. */
  function saveFormCloud() {
    if (!cloudOk()) return;
    var f = state.form;
    try {
      var cloud = { name: f.name, phone: f.phone, delivery: f.delivery, city: f.city, branch: f.branch, pay: f.pay, npType: f.npType, point: f.point };
      if (f.cityRef && f.cityRefFor === f.city) { cloud.cityRef = f.cityRef; cloud.cityRefFor = f.cityRefFor; }
      tg.CloudStorage.setItem('form', JSON.stringify(cloud).slice(0, 4000), function () {});
    } catch (e) { /* облако недоступно */ }
  }
  function loadFormCloud() {
    if (!cloudOk() || state.form.phone) return;
    try {
      tg.CloudStorage.getItem('form', function (err, value) {
        if (err || !value || state.form.phone || cdvDone) return;
        try { applyForm(JSON.parse(value)); } catch (e) { return; }
        if (state.view === 'checkout') renderPage();
      });
    } catch (e) { /* облако недоступно */ }
  }
  function applyForm(f) {
    if (!f) return;
    ['name', 'phone', 'city', 'branch', 'point'].forEach(function (k) { if (typeof f[k] === 'string' && f[k]) state.form[k] = f[k].slice(0, 120); });
    ['comment', 'giftNote'].forEach(function (k) { if (typeof f[k] === 'string' && f[k] && !state.form[k]) state.form[k] = f[k].slice(0, k === 'giftNote' ? 120 : 300); });
    if (f.delivery === 'np' || f.delivery === 'pickup') state.form.delivery = f.delivery;
    if (f.pay === 'cash' || f.pay === 'card' || f.pay === 'cod') state.form.pay = f.pay;
    if (f.npType === 'branch' || f.npType === 'locker' || f.npType === 'courier') state.form.npType = f.npType;
    if (f.ifOut === 'call' || f.ifOut === 'replace' || f.ifOut === 'remove') state.form.ifOut = f.ifOut;
    if (NP_UUID.test(String(f.cityRef || '')) && typeof f.cityRefFor === 'string' && f.cityRefFor) { state.form.cityRef = f.cityRef; state.form.cityRefFor = f.cityRefFor.slice(0, 120); }
  }
  function deliveryText(d) {
    if (d.delivery === 'np') return t('np') + (d.npType && d.npType !== 'branch' ? ' · ' + t(d.npType === 'locker' ? 'npLocker' : 'npCourier').toLowerCase() : '');
    return t('pickup') + (d.point ? ' · ' + d.point : '');
  }

  /* ---- Нажатия на новые элементы (срабатывают раньше старых обработчиков) ---- */
  function w1Click(e) {
    var b = e.target.closest('[data-w1]');
    if (!b) return false;
    var kind = b.getAttribute('data-w1');
    if (b.disabled) return true;
    if (kind === 'go') {
      if (state.view === 'checkout') readForm();
      go(b.getAttribute('data-view'));
    } else if (kind === 'open') {
      openUrl(b.getAttribute('data-url'));
    } else if (kind === 'contact') {
      openUrl(shopInfo().contact);
    } else if (kind === 'ref-share') {
      refShare(false);
    } else if (kind === 'ref-copy') {
      refShare(true);
    } else if (kind === 'plus') {
      openPlus(b.getAttribute('data-k'));
    } else if (kind === 'info') {
      openInfo(b.getAttribute('data-k'));
    } else if (kind === 'rail') {
      state.rail = b.getAttribute('data-k');
      go('rail');
    } else if (kind === 'rec') {
      openRecipe(b.getAttribute('data-id'));
    } else if (kind === 'rec-add') {
      recipeAdd(b.getAttribute('data-id'));
    } else if (kind === 'sheet-open') {
      openSheet(b.getAttribute('data-pid')); // из шторки набора — шторка состава, без смены экрана под ней
    } else if (kind === 'hint-add') {
      addHint(b);
    } else if (kind === 'product') {
      go('catalog'); openSheet(b.getAttribute('data-pid'));
    } else if (kind === 'usual') {
      addUsual();
    } else if (kind === 'city' || kind === 'np-city') {
      var city = document.getElementById('f-city');
      if (city && kind === 'np-city') npChooseCity({ s: b.getAttribute('data-val'), ref: b.getAttribute('data-ref') }, false);
      else if (city) { // чип с крупным городом: ref неизвестен — спрашиваем сервер и выбираем точное совпадение
        city.value = b.getAttribute('data-city');
        np.ref = ''; np.seq++; np.resolving = false; suggShow('citySugg', [], ''); npBusy('cityPick', false); suggShow('whSugg', [], '');
        setError('city', ''); readForm(); npCostSync(); hapticSelect();
        npCityResolve(city.value, true);
      }
    } else if (kind === 'np-wh') {
      var wh = document.getElementById('f-branch');
      if (wh) { wh.value = b.getAttribute('data-val').slice(0, 30); setError('branch', ''); suggShow('whSugg', [], ''); readForm(); hapticSelect(); }
    } else if (kind === 'rv') {
      if (adm.busy) return true;
      adm.busy = true; btnBusy(b, '.ord__acts');
      api('admin.review', { id: b.getAttribute('data-id'), ok: b.getAttribute('data-ok') === '1' }).then(function (res) {
        adm.busy = false;
        if (res && res.error === 'no_perm') { toast(t('admNoPerm')); renderAdminList(); return; }
        if (!res || !res.ok) throw new Error('fail');
        adm.reviews = res.reviews || [];
        toast(t('admSaved'));
        renderAdminList();
      }).catch(function () { adm.busy = false; toast(t('admFail')); renderAdminList(); });
    } else if (kind === 'ttn-make') {
      ttnMake(b);
    } else if (kind === 'ttn-del') {
      ttnDelAsk(b.getAttribute('data-num'));
    } else if (kind === 'ttn') {
      var num = b.getAttribute('data-num');
      var input = document.getElementById('ttn-' + num);
      var ttn = input ? input.value.replace(/[\s-]+/g, '') : '';
      if (!/^\d{10,20}$/.test(ttn)) { toast(t('ttnBad')); haptic('error'); return true; }
      if (adm.busy) return true;
      adm.busy = true; btnBusy(b);
      api('admin.ttn', { num: num, ttn: ttn }).then(function (res) {
        adm.busy = false;
        if (res && res.error === 'no_perm') { toast(t('admNoPerm')); renderAdminList(); return; }
        if (!res || !res.ok) throw new Error('fail');
        (adm.orders || []).forEach(function (o) { if (o.num === num) o.ttn = res.ttn; });
        toast(t('admSaved') + (res.told === false ? '. ' + t('admNotTold') : ''));
        renderAdminList();
      }).catch(function () { adm.busy = false; toast(t('admFail')); renderAdminList(); });
    }
    return true;
  }
  [el.main, el.page, el.sheet].forEach(function (node) {
    node.addEventListener('click', function (e) { if (w1Click(e)) { e.stopImmediatePropagation(); e.preventDefault(); } });
  });
  el.page.addEventListener('input', function (e) {
    if (state.view !== 'checkout') return;
    if (e.target.name === 'city' || e.target.name === 'branch') npSuggest(e.target);
  });

  /* ======================================================================== */
  /* ЭТАП 8, волна 2а: отклик кнопок, страницы, архив и удаление                */
  /* ======================================================================== */
  var I18N_W2 = {
    ua: {
      admSwFail: 'Не вдалося зберегти — повернули, як було.', admStBack: 'Не вдалося змінити статус — повернули попередній.',
      perfServer: 'сервер', perfNet: 'мережа й Google', perfMs: 'мс',
      admFltOut: 'Немає в наявності', admFltHidden: 'Приховані', admFltNoPhoto: 'Без фото',
      cfCancel: 'Скасувати', repeatGone: 'Деяких товарів більше немає.', repeatGoneAll: 'Цих товарів більше немає в магазині.', repeatAdded: 'Додано позицій: {a} з {b}.',
      archTitle: 'Архів товарів', archBtn: 'В архів', archHint: 'Товар зникне з вітрини. З архіву його можна відновити або видалити назавжди.',
      archAskTitle: 'Перенести товар в архів?', archAskText: '«{name}» зникне з вітрини. Старі замовлення не зміняться. Товар можна буде відновити з архіву.',
      archAskOk: 'В архів: {name}', archDone: 'Перенесено в архів', archEmpty: 'В архіві порожньо.', archSearch: 'Назва або ID в архіві',
      archInfo: 'Товари з архіву не видно на вітрині. «Відновити» повертає товар у магазин із тими самими даними.',
      archSince: 'в архіві з {d}', archRestore: 'Відновити', archRestored: 'Відновлено: {name}', archExists: 'У листі «Товари» вже є товар із таким ID. Відновити не можна.',
      archPurge: 'Видалити назавжди', archPurgeTitle: 'Видалити товар назавжди?',
      archPurgeText: 'Це не можна скасувати. «{name}» ({id}) буде стерто з архіву. Старі замовлення не зміняться. ID {id} більше не використовуватиметься для нових товарів.',
      archPurgeOk: 'Видалити назавжди {name}', archPurged: 'Видалено назавжди: {name}', archOnlyFull: 'Видалити назавжди може лише повний адмін або власник.',
      archReused: 'ID {id} уже належав товару, якого видалили назавжди. Через це плутаються статистика й «Повторити замовлення». Краще створити товар заново — він отримає новий ID.',
      catDelBtn: 'Видалити категорію', catDelTitle: 'Видалити категорію?', catDelEmpty: 'У категорії «{name}» немає товарів. Вона зникне з вітрини й панелі.',
      catDelOk: 'Видалити «{name}»', catDelFull: 'У категорії «{name}» товарів: {n} (разом із прихованими). Спочатку перенесіть їх в іншу категорію.',
      catDelMove: 'Куди перенести товари', catDelMoveOk: 'Перенести товари й видалити «{name}»', catDelNoOther: 'Немає іншої категорії, куди перенести товари. Спочатку створіть її.',
      catDelDone: 'Категорію видалено', catDelMoved: 'Категорію видалено, товарів перенесено: {n}',
      admDelBtn: 'Видалити адміна', admDelTitle: 'Видалити адміна?', admDelText: '«{name}» втратить доступ до адмін-панелі. Повернути доступ можна буде новим запрошенням.',
      admDelOk: 'Видалити {name}', admDelDone: 'Адміна видалено', admDelStill: 'Рядок видалено, але доступ лишився: приберіть chat id з ADMIN_CHAT_IDS.',
      admDelBoth: 'Увага: chat id цієї людини записаний ще й в ADMIN_CHAT_IDS (налаштування скрипта). Рядок у листі «Адміни» буде видалено, але доступ у неї залишиться, доки ви не приберете id і там.',
      admFromProps: 'Доданий у налаштуваннях скрипта',
      admPropsHow: 'Панель його не видаляє. Щоб прибрати: таблиця → Розширення → Apps Script → Налаштування проєкту (шестерня) → Script Properties → ADMIN_CHAT_IDS — зітріть звідти його chat id і збережіть.',
      pgRange: 'Товари {a}–{b} з {n}', pgPrev: 'Попередня сторінка', pgNext: 'Наступна сторінка', pgNav: 'Сторінки', pgPage: 'Сторінка {n}'
    },
    ru: {
      admSwFail: 'Не удалось сохранить — вернули, как было.', admStBack: 'Не удалось сменить статус — вернули прежний.',
      perfServer: 'сервер', perfNet: 'сеть и Google', perfMs: 'мс',
      admFltOut: 'Нет в наличии', admFltHidden: 'Скрытые', admFltNoPhoto: 'Без фото',
      cfCancel: 'Отмена', repeatGone: 'Некоторых товаров больше нет.', repeatGoneAll: 'Этих товаров больше нет в магазине.', repeatAdded: 'Добавлено позиций: {a} из {b}.',
      archTitle: 'Архив товаров', archBtn: 'В архив', archHint: 'Товар исчезнет с витрины. Из архива его можно восстановить или удалить навсегда.',
      archAskTitle: 'Перенести товар в архив?', archAskText: '«{name}» исчезнет с витрины. Старые заказы не изменятся. Товар можно будет восстановить из архива.',
      archAskOk: 'В архив: {name}', archDone: 'Перенесено в архив', archEmpty: 'В архиве пусто.', archSearch: 'Название или ID в архиве',
      archInfo: 'Товары из архива не видны на витрине. «Восстановить» возвращает товар в магазин с теми же данными.',
      archSince: 'в архиве с {d}', archRestore: 'Восстановить', archRestored: 'Восстановлено: {name}', archExists: 'В листе «Товари» уже есть товар с таким ID. Восстановить нельзя.',
      archPurge: 'Удалить навсегда', archPurgeTitle: 'Удалить товар навсегда?',
      archPurgeText: 'Это нельзя отменить. «{name}» ({id}) будет стёрт из архива. Старые заказы не изменятся. ID {id} больше не будет использоваться для новых товаров.',
      archPurgeOk: 'Удалить навсегда {name}', archPurged: 'Удалено навсегда: {name}', archOnlyFull: 'Удалить навсегда может только полный админ или владелец.',
      archReused: 'ID {id} уже принадлежал товару, который удалили навсегда. Из-за этого путаются статистика и «Повторить заказ». Лучше создать товар заново — он получит новый ID.',
      catDelBtn: 'Удалить категорию', catDelTitle: 'Удалить категорию?', catDelEmpty: 'В категории «{name}» нет товаров. Она исчезнет с витрины и из панели.',
      catDelOk: 'Удалить «{name}»', catDelFull: 'В категории «{name}» товаров: {n} (вместе со скрытыми). Сначала перенесите их в другую категорию.',
      catDelMove: 'Куда перенести товары', catDelMoveOk: 'Перенести товары и удалить «{name}»', catDelNoOther: 'Нет другой категории, куда перенести товары. Сначала создайте её.',
      catDelDone: 'Категория удалена', catDelMoved: 'Категория удалена, товаров перенесено: {n}',
      admDelBtn: 'Удалить админа', admDelTitle: 'Удалить админа?', admDelText: '«{name}» потеряет доступ к админ-панели. Вернуть доступ можно будет новым приглашением.',
      admDelOk: 'Удалить {name}', admDelDone: 'Админ удалён', admDelStill: 'Строка удалена, но доступ остался: уберите chat id из ADMIN_CHAT_IDS.',
      admDelBoth: 'Внимание: chat id этого человека записан ещё и в ADMIN_CHAT_IDS (настройки скрипта). Строка в листе «Адміни» будет удалена, но доступ у него останется, пока вы не уберёте id и там.',
      admFromProps: 'Добавлен в настройках скрипта',
      admPropsHow: 'Панель его не удаляет. Чтобы убрать: таблица → Расширения → Apps Script → Настройки проекта (шестерёнка) → Script Properties → ADMIN_CHAT_IDS — сотрите оттуда его chat id и сохраните.',
      pgRange: 'Товары {a}–{b} из {n}', pgPrev: 'Предыдущая страница', pgNext: 'Следующая страница', pgNav: 'Страницы', pgPage: 'Страница {n}'
    }
  };
  ['ua', 'ru'].forEach(function (lang) {
    Object.keys(I18N_W2[lang]).forEach(function (k) { I18N[lang][k] = I18N_W2[lang][k]; });
  });

  /* ======================================================================== */
  /* ЭТАП 8, волна 2б: оплата, специи, опт, рассылка                           */
  /* ======================================================================== */
  var I18N_2B = {
    ua: {
      payState: 'Оплата', pay_unpaid: 'не оплачено', pay_paid: 'оплачено', pay_refund: 'повернено', payMark: 'Оплачено', payRefund: 'Повернено',
      payUndo: 'Не оплачено', payRefundTitle: 'Позначити повернення оплати?', payRefundText: 'Замовлення {num}: статус оплати стане «повернено». Клієнту повідомлення не надсилається.',
      payRefundOk: 'Повернено: {num}',
      compTitle: 'Склад', admCompUa: 'Склад (UA)', admCompRu: 'Состав (RU)', fatherTitle: 'Спеції від батька',
      whTag: 'опт', whOrder: 'ОПТ', whLink: 'Оптові ціни — для бізнесу', whFromKg: 'Опт: від {n} кг — {p}/кг', whFromPack: 'Опт: від {n} уп. — {p}/уп.', whFromPcs: 'Опт: від {n} шт — {p}/шт',
      whLeftKg: '«{name}»: до оптової ціни ще {n} кг', whLeftPcs: '«{name}»: до оптової ціни ще {n} шт', whOn: 'Діє оптова ціна',
      bizBtn: 'Для бізнесу (опт)', bizTitle: 'Для бізнесу', bizBanner: 'Кафе, магазин, офіс? Оптові ціни — для бізнесу', bizIntro: 'Працюємо з кафе, магазинами та офісами. Заповніть коротку заявку — відповімо в Telegram.',
      bizType: 'Тип бізнесу', bizT_cafe: 'Кафе', bizT_shop: 'Магазин', bizT_office: 'Офіс', bizT_other: 'Інше', bizName: 'Назва закладу або компанії', bizCity: 'Місто',
      bizContact: 'Контактна особа', bizPhone: 'Телефон', bizCats: 'Які категорії цікавлять', bizVolume: 'Приблизний обсяг', bizVolumePh: 'наприклад: 10 кг на тиждень',
      bizFreq: 'Як часто замовлятимете', bizFreqPh: 'наприклад: раз на тиждень', bizComment: 'Коментар', bizSend: 'Надіслати заявку', bizErr: 'Заповніть тип бізнесу, назву, місто, контактну особу й телефон.',
      bizRate: 'Сьогодні вже надіслано три заявки. Спробуйте завтра.', bizFail: 'Не вдалося надіслати заявку. Спробуйте ще раз.', bizTg: 'Заявку можна надіслати з магазину в Telegram.',
      bizSent: 'Заявку отримали', bizSentText: 'Відповімо вам у Telegram. Статус заявки видно на цьому екрані.', bizWork: 'Заявку взяли в роботу', bizRejected: 'Попередню заявку відхилено. Можна надіслати нову.',
      bizYes: 'Ви — оптовий клієнт', bizYesText: 'Оптова ціна вмикається в кошику сама, щойно набрано мінімальний обсяг товару. Товарів з оптовою ціною: {n}.',
      bizPrice: 'Надіслати прайс у чат', bizPriceOk: 'Прайс надіслано в чат із ботом', bizPriceRate: 'Прайс уже надсилали кілька разів. Спробуйте за годину.',
      admWh: 'Опт', admWmHint: 'Наприклад: «від 5 кг», «10 уп». Текст бачить лише оптовик.', admWhn: 'Опт: мінімальний обсяг числом (кг або шт)', admWhnHint: 'Якщо заповнено — головніше за текст. Для вагового товару — кг, для решти — упаковки або штуки.',
      whApps: 'Заявки', whClients: 'Оптові клієнти', whNoApps: 'Заявок поки немає.', whNoClients: 'Оптових клієнтів поки немає.', whTake: 'Взяти в роботу', whApprove: 'Схвалити', whReject: 'Відхилити',
      whRevoke: 'Відкликати статус', whOff: 'статус відкликано', whActive: 'активний', whRevokeTitle: 'Відкликати статус оптовика?',
      whRevokeText: '«{name}» одразу бачитиме роздрібні ціни. Повернути статус можна новою схваленою заявкою.', whRevokeOk: 'Відкликати: {name}', whRevoked: 'Статус відкликано',
      whApproveTitle: 'Схвалити як оптового клієнта?', whApproveText: '«{name}» ({id}) одразу отримає оптові ціни й повідомлення в Telegram.', whApproveOk: 'Схвалити: {name}',
      whRejectTitle: 'Відхилити заявку?', whRejectText: '«{name}» ({id}) отримає повідомлення про відмову.', whRejectOk: 'Відхилити: {name}',
      admMail: 'Розсилка', mailNew: 'Нова розсилка', mailEmpty: 'Розсилок поки немає.', mailFreshBtn: 'Розсилка «Свіжа поставка»',
      mailFreshUa: 'Свіжа поставка 🌿\n{name} уже на прилавку й у магазині.', mailFreshRu: 'Свежая поставка 🌿\n{name} уже на прилавке и в магазине.',
      mailUa: 'Текст українською', mailRu: 'Текст російською', mailLangHint: 'Кожен отримає текст своєю мовою. Якщо один із текстів порожній, усі отримають другий.',
      mailPhoto: 'Фото (необов’язково)', mailPhotoHint: 'Надішліть фото боту в чат — він відповість кодом. Вставте код сюди. З фото текст — до 1000 знаків.',
      mailBtn: 'Кнопка під повідомленням', mailBtn_none: 'Без кнопки', mailBtn_shop: 'Відкрити магазин', mailBtn_prod: 'Відкрити товар', mailBtn_cat: 'Відкрити категорію',
      mailBtnProd: 'ID товару, наприклад DRY-039', mailSeg: 'Кому надіслати', mailSeg_all: 'Усім клієнтам', mailSeg_cat: 'Хто купував категорію', mailSeg_prod: 'Хто купував товар',
      mailSeg_idle: 'Хто не замовляв 30+ днів', mailSeg_wh: 'Оптовикам', mailSeg_sub: 'Хто чекає на товар («Повідомити»)', mailSegProd: 'ID товару',
      mailPreview: 'Як побачать клієнти', mailUnsub: 'Не надсилати мені розсилки', mailTest: 'Зберегти й надіслати тільки мені',
      mailTestHint: 'Спочатку розсилка приходить лише вам — обома мовами. Перевірте текст, фото й кнопку в чаті з ботом.',
      mailTested: 'Перевірте повідомлення в чаті з ботом. Якщо все гаразд — надсилайте.', mailCount: 'Отримувачів: {n}', mailSkip: 'Пропустимо {n}: вони нещодавно вже отримували розсилку (ліміт — раз на {d} дн.).',
      mailNone: 'Немає отримувачів', mailNow: 'Надіслати зараз: {n}', mailAt: 'Або надіслати пізніше (час київський)', mailPlan: 'Запланувати', mailBack: 'Змінити текст',
      mailSendTitle: 'Надіслати розсилку?', mailSendText: 'Отримувачів: {n}. Повідомлення піде одразу, скасувати не вийде.', mailSendOk: 'Надіслати {n} отримувачам',
      mailPlanTitle: 'Запланувати розсилку?', mailPlanText: 'Отримувачів зараз: {n}. Розсилка піде {at} за київським часом (точність — близько 10 хвилин). До старту її можна скасувати.', mailPlanOk: 'Запланувати на {at}',
      mailSent: 'Розсилку запущено', mailPlanned: 'Розсилку заплановано на {at}', mailCancel: 'Скасувати розсилку', mailCancelTitle: 'Скасувати розсилку?',
      mailCancelText: 'Розсилка {id} не піде далі. Уже надіслані повідомлення не повернути.', mailCancelOk: 'Скасувати {id}', mailCanceled: 'Розсилку скасовано', mailEditBtn: 'Продовжити',
      mailErr_bad_form: 'Заповніть текст. Для кнопки «товар» або «категорія» вкажіть, що саме відкрити.', mailErr_too_long: 'З фото текст має бути до 1000 знаків.', mailErr_bad_photo: 'Фото: вставте код від бота або посилання https://',
      mailErr_need_test: 'Спочатку надішліть розсилку тільки собі.', mailErr_no_recipients: 'Немає отримувачів.', mailErr_bad_time: 'Вкажіть час у майбутньому (не далі ніж за 60 днів).',
      mailErr_locked: 'Цю розсилку вже запущено або скасовано.', mailErr_send_failed: 'Telegram не прийняв повідомлення. Перевірте код фото.',
      mailNoTrigger: 'Відкладена відправка й довгі розсилки потребують таймера: таблиця → меню PAMIR → «Увімкнути щоденні повідомлення клієнтам».',
      mailStat: 'надіслано {s} з {t}', mailStatErr: 'помилок {n}', mailStatBl: 'заблокували {n}', mailStatSkip: 'пропущено {n}', mailStatClick: 'натиснули {n}', mailStatOrd: 'замовили за 3 дні {n}', mailAtLabel: 'на {at} (Київ)'
    },
    ru: {
      payState: 'Оплата', pay_unpaid: 'не оплачено', pay_paid: 'оплачено', pay_refund: 'возвращено', payMark: 'Оплачено', payRefund: 'Возвращено',
      payUndo: 'Не оплачено', payRefundTitle: 'Отметить возврат оплаты?', payRefundText: 'Заказ {num}: статус оплаты станет «возвращено». Клиенту сообщение не отправляется.',
      payRefundOk: 'Возвращено: {num}',
      compTitle: 'Состав', admCompUa: 'Склад (UA)', admCompRu: 'Состав (RU)', fatherTitle: 'Специи от отца',
      whTag: 'опт', whOrder: 'ОПТ', whLink: 'Оптовые цены — для бизнеса', whFromKg: 'Опт: от {n} кг — {p}/кг', whFromPack: 'Опт: от {n} уп. — {p}/уп.', whFromPcs: 'Опт: от {n} шт — {p}/шт',
      whLeftKg: '«{name}»: до оптовой цены ещё {n} кг', whLeftPcs: '«{name}»: до оптовой цены ещё {n} шт', whOn: 'Действует оптовая цена',
      bizBtn: 'Для бизнеса (опт)', bizTitle: 'Для бизнеса', bizBanner: 'Кафе, магазин, офис? Оптовые цены — для бизнеса', bizIntro: 'Работаем с кафе, магазинами и офисами. Заполните короткую заявку — ответим в Telegram.',
      bizType: 'Тип бизнеса', bizT_cafe: 'Кафе', bizT_shop: 'Магазин', bizT_office: 'Офис', bizT_other: 'Другое', bizName: 'Название заведения или компании', bizCity: 'Город',
      bizContact: 'Контактное лицо', bizPhone: 'Телефон', bizCats: 'Какие категории интересуют', bizVolume: 'Примерный объём', bizVolumePh: 'например: 10 кг в неделю',
      bizFreq: 'Как часто будете заказывать', bizFreqPh: 'например: раз в неделю', bizComment: 'Комментарий', bizSend: 'Отправить заявку', bizErr: 'Заполните тип бизнеса, название, город, контактное лицо и телефон.',
      bizRate: 'Сегодня уже отправлено три заявки. Попробуйте завтра.', bizFail: 'Не удалось отправить заявку. Попробуйте ещё раз.', bizTg: 'Заявку можно отправить из магазина в Telegram.',
      bizSent: 'Заявку получили', bizSentText: 'Ответим вам в Telegram. Статус заявки виден на этом экране.', bizWork: 'Заявку взяли в работу', bizRejected: 'Прошлую заявку отклонили. Можно отправить новую.',
      bizYes: 'Вы — оптовый клиент', bizYesText: 'Оптовая цена включается в корзине сама, как только набран минимальный объём товара. Товаров с оптовой ценой: {n}.',
      bizPrice: 'Отправить прайс в чат', bizPriceOk: 'Прайс отправлен в чат с ботом', bizPriceRate: 'Прайс уже отправляли несколько раз. Попробуйте через час.',
      admWh: 'Опт', admWmHint: 'Например: «від 5 кг», «10 уп». Текст видит только оптовик.', admWhn: 'Опт: минимальный объём числом (кг или шт)', admWhnHint: 'Если заполнено — главнее текста. Для весового товара — кг, для остальных — упаковки или штуки.',
      whApps: 'Заявки', whClients: 'Оптовые клиенты', whNoApps: 'Заявок пока нет.', whNoClients: 'Оптовых клиентов пока нет.', whTake: 'Взять в работу', whApprove: 'Одобрить', whReject: 'Отклонить',
      whRevoke: 'Отозвать статус', whOff: 'статус отозван', whActive: 'активный', whRevokeTitle: 'Отозвать статус оптовика?',
      whRevokeText: '«{name}» сразу будет видеть розничные цены. Вернуть статус можно новой одобренной заявкой.', whRevokeOk: 'Отозвать: {name}', whRevoked: 'Статус отозван',
      whApproveTitle: 'Одобрить как оптового клиента?', whApproveText: '«{name}» ({id}) сразу получит оптовые цены и сообщение в Telegram.', whApproveOk: 'Одобрить: {name}',
      whRejectTitle: 'Отклонить заявку?', whRejectText: '«{name}» ({id}) получит сообщение об отказе.', whRejectOk: 'Отклонить: {name}',
      admMail: 'Рассылка', mailNew: 'Новая рассылка', mailEmpty: 'Рассылок пока нет.', mailFreshBtn: 'Рассылка «Свежая поставка»',
      mailFreshUa: 'Свіжа поставка 🌿\n{name} уже на прилавку й у магазині.', mailFreshRu: 'Свежая поставка 🌿\n{name} уже на прилавке и в магазине.',
      mailUa: 'Текст на украинском', mailRu: 'Текст на русском', mailLangHint: 'Каждый получит текст на своём языке. Если один из текстов пустой, все получат второй.',
      mailPhoto: 'Фото (необязательно)', mailPhotoHint: 'Отправьте фото боту в чат — он ответит кодом. Вставьте код сюда. С фото текст — до 1000 знаков.',
      mailBtn: 'Кнопка под сообщением', mailBtn_none: 'Без кнопки', mailBtn_shop: 'Открыть магазин', mailBtn_prod: 'Открыть товар', mailBtn_cat: 'Открыть категорию',
      mailBtnProd: 'ID товара, например DRY-039', mailSeg: 'Кому отправить', mailSeg_all: 'Всем клиентам', mailSeg_cat: 'Кто покупал категорию', mailSeg_prod: 'Кто покупал товар',
      mailSeg_idle: 'Кто не заказывал 30+ дней', mailSeg_wh: 'Оптовикам', mailSeg_sub: 'Кто ждёт товар («Сообщить»)', mailSegProd: 'ID товара',
      mailPreview: 'Как увидят клиенты', mailUnsub: 'Не присылать мне рассылки', mailTest: 'Сохранить и отправить только мне',
      mailTestHint: 'Сначала рассылка приходит только вам — на обоих языках. Проверьте текст, фото и кнопку в чате с ботом.',
      mailTested: 'Проверьте сообщение в чате с ботом. Если всё в порядке — отправляйте.', mailCount: 'Получателей: {n}', mailSkip: 'Пропустим {n}: они недавно уже получали рассылку (лимит — раз в {d} дн.).',
      mailNone: 'Нет получателей', mailNow: 'Отправить сейчас: {n}', mailAt: 'Или отправить позже (время киевское)', mailPlan: 'Запланировать', mailBack: 'Изменить текст',
      mailSendTitle: 'Отправить рассылку?', mailSendText: 'Получателей: {n}. Сообщение уйдёт сразу, отменить не получится.', mailSendOk: 'Отправить {n} получателям',
      mailPlanTitle: 'Запланировать рассылку?', mailPlanText: 'Получателей сейчас: {n}. Рассылка уйдёт {at} по киевскому времени (точность — около 10 минут). До старта её можно отменить.', mailPlanOk: 'Запланировать на {at}',
      mailSent: 'Рассылка запущена', mailPlanned: 'Рассылка запланирована на {at}', mailCancel: 'Отменить рассылку', mailCancelTitle: 'Отменить рассылку?',
      mailCancelText: 'Рассылка {id} дальше не пойдёт. Уже отправленные сообщения не вернуть.', mailCancelOk: 'Отменить {id}', mailCanceled: 'Рассылка отменена', mailEditBtn: 'Продолжить',
      mailErr_bad_form: 'Заполните текст. Для кнопки «товар» или «категория» укажите, что именно открыть.', mailErr_too_long: 'С фото текст должен быть до 1000 знаков.', mailErr_bad_photo: 'Фото: вставьте код от бота или ссылку https://',
      mailErr_need_test: 'Сначала отправьте рассылку только себе.', mailErr_no_recipients: 'Нет получателей.', mailErr_bad_time: 'Укажите время в будущем (не дальше чем через 60 дней).',
      mailErr_locked: 'Эта рассылка уже запущена или отменена.', mailErr_send_failed: 'Telegram не принял сообщение. Проверьте код фото.',
      mailNoTrigger: 'Отложенная отправка и длинные рассылки требуют таймера: таблица → меню PAMIR → «Увімкнути щоденні повідомлення клієнтам».',
      mailStat: 'отправлено {s} из {t}', mailStatErr: 'ошибок {n}', mailStatBl: 'заблокировали {n}', mailStatSkip: 'пропущено {n}', mailStatClick: 'нажали {n}', mailStatOrd: 'заказали за 3 дня {n}', mailAtLabel: 'на {at} (Киев)'
    }
  };
  ['ua', 'ru'].forEach(function (lang) {
    Object.keys(I18N_2B[lang]).forEach(function (k) { I18N[lang][k] = I18N_2B[lang][k]; });
  });

  /* ======================================================================== */
  /* ЭТАП 8, волна 2в: «Як їсти», рецепты, квиз, «Пригости друга»              */
  /* ======================================================================== */
  var I18N_2C = {
    ua: {
      howTitle: 'Як їсти', recTitle: 'Рецепти', recWith: 'Рецепти з цим товаром', recItems: 'Що знадобиться', recAdd: 'Додати інгредієнти в кошик', recOut: 'немає в наявності',
      recAdded: 'Додано в кошик: {n}.', recAlready: 'Усі інгредієнти вже в кошику.', recMissing: 'Зараз немає в наявності: {list}.', recNone: 'Цих товарів зараз немає в наявності.',
      recGone: 'Рецепт не знайдено.', admHowUa: 'Як їсти (UA)', admHowRu: 'Как есть (RU)', admTags: 'Теги для підбору', admTagsHint: 'Через кому: до чаю, перекус, подарунок, солодке, солоне, сніданок, випічка, для плову, до м’яса, суп, узвар, спеції батька',
      refTitle: 'Пригости друга', refText: 'Надішліть другові своє посилання. До першого замовлення він отримає пробник: {gift}. А ви — такий самий пробник до свого наступного замовлення.',
      refTextMin: 'Надішліть другові своє посилання. До першого замовлення від {min} він отримає пробник: {gift}. А ви — такий самий пробник до свого наступного замовлення.',
      refShare: 'Поділитися посиланням', refCopy: 'Скопіювати посилання', refCopied: 'Посилання скопійовано', refMsg: 'Пригощаю: PAMIR — горіхи та сухофрукти. За цим посиланням до першого замовлення дадуть пробник.',
      refCart: 'Вас запросив друг: до першого замовлення — пробник ({gift}).', refCartMin: 'Вас запросив друг: до першого замовлення від {min} — пробник ({gift}).',
      quizBtn: 'Підібрати смаколики', quizTitle: 'Підібрати смаколики', quizQ1: 'Для чого обираєте?', quizQ2: 'Солодке чи солоне?', quizQ3: 'Скільки готові витратити на одну позицію?',
      quizAny: 'Байдуже', quizB1: 'до 150 ₴', quizB2: 'до 400 ₴', quizB3: 'без обмежень', quizStep: 'Питання {a} з {b}', quizResult: 'Ось що вам підійде', quizPopular: 'Точного збігу немає. Ось те, що зараз беруть найчастіше',
      quizAgain: 'Підібрати ще раз', quizBack: 'Назад',
      plusGift: 'Подарунок від {n}', plusGiftLeft: 'Ще {n} до подарунка', plusGiftOk: 'Подарунок у замовленні', plusGiftTitle: 'Подарунок до замовлення',
      plusQuizText: 'Дайте відповідь на три короткі запитання — підберемо товари, які вам підійдуть.', plusBiz: 'Оптові ціни', plusMore: 'Ще:', railGone: 'Цієї підбірки зараз немає.', recAll: 'Усі рецепти',
      'tag_до чаю': 'До чаю', 'tag_перекус': 'Перекус', 'tag_подарунок': 'Подарунок', 'tag_солодке': 'Солодке', 'tag_солоне': 'Солоне', 'tag_для плову': 'Для плову', 'tag_для випічки': 'Для випічки',
      'tag_сніданок': 'На сніданок', 'tag_випічка': 'Для випічки', "tag_до м'яса": 'До м’яса', 'tag_суп': 'У суп', 'tag_узвар': 'На узвар', 'tag_спеції батька': 'Спеції від батька',
      mailBtn_rec: 'Відкрити рецепт', mailRecTitle: 'Шаблон «Рецепт»', mailRecBtn: 'Розсилка: {name}', mailRecUa: 'Рецепт: {name} 📖\nЩо знадобиться та як готувати — у магазині.', mailRecRu: 'Рецепт: {name} 📖\nЧто понадобится и как готовить — в магазине.'
    },
    ru: {
      howTitle: 'Как есть', recTitle: 'Рецепты', recWith: 'Рецепты с этим товаром', recItems: 'Что понадобится', recAdd: 'Добавить ингредиенты в корзину', recOut: 'нет в наличии',
      recAdded: 'Добавлено в корзину: {n}.', recAlready: 'Все ингредиенты уже в корзине.', recMissing: 'Сейчас нет в наличии: {list}.', recNone: 'Этих товаров сейчас нет в наличии.',
      recGone: 'Рецепт не найден.', admHowUa: 'Як їсти (UA)', admHowRu: 'Как есть (RU)', admTags: 'Теги для подбора', admTagsHint: 'Через запятую: до чаю, перекус, подарунок, солодке, солоне, сніданок, випічка, для плову, до м’яса, суп, узвар, спеції батька',
      refTitle: 'Угости друга', refText: 'Отправьте другу свою ссылку. К первому заказу он получит пробник: {gift}. А вы — такой же пробник к своему следующему заказу.',
      refTextMin: 'Отправьте другу свою ссылку. К первому заказу от {min} он получит пробник: {gift}. А вы — такой же пробник к своему следующему заказу.',
      refShare: 'Поделиться ссылкой', refCopy: 'Скопировать ссылку', refCopied: 'Ссылка скопирована', refMsg: 'Угощаю: PAMIR — орехи и сухофрукты. По этой ссылке к первому заказу дадут пробник.',
      refCart: 'Вас пригласил друг: к первому заказу — пробник ({gift}).', refCartMin: 'Вас пригласил друг: к первому заказу от {min} — пробник ({gift}).',
      quizBtn: 'Подобрать вкусности', quizTitle: 'Подобрать вкусности', quizQ1: 'Для чего выбираете?', quizQ2: 'Сладкое или солёное?', quizQ3: 'Сколько готовы потратить на одну позицию?',
      quizAny: 'Неважно', quizB1: 'до 150 ₴', quizB2: 'до 400 ₴', quizB3: 'без ограничений', quizStep: 'Вопрос {a} из {b}', quizResult: 'Вот что вам подойдёт', quizPopular: 'Точного совпадения нет. Вот то, что сейчас берут чаще всего',
      quizAgain: 'Подобрать ещё раз', quizBack: 'Назад',
      plusGift: 'Подарок от {n}', plusGiftLeft: 'Ещё {n} до подарка', plusGiftOk: 'Подарок в заказе', plusGiftTitle: 'Подарок к заказу',
      plusQuizText: 'Ответьте на три коротких вопроса — подберём товары, которые вам подойдут.', plusBiz: 'Оптовые цены', plusMore: 'Ещё:', railGone: 'Этой подборки сейчас нет.', recAll: 'Все рецепты',
      'tag_до чаю': 'К чаю', 'tag_перекус': 'Перекус', 'tag_подарунок': 'Подарок', 'tag_солодке': 'Сладкое', 'tag_солоне': 'Солёное', 'tag_для плову': 'Для плова', 'tag_для випічки': 'Для выпечки',
      'tag_сніданок': 'На завтрак', 'tag_випічка': 'Для выпечки', "tag_до м'яса": 'К мясу', 'tag_суп': 'В суп', 'tag_узвар': 'На компот', 'tag_спеції батька': 'Специи от отца',
      mailBtn_rec: 'Открыть рецепт', mailRecTitle: 'Шаблон «Рецепт»', mailRecBtn: 'Рассылка: {name}', mailRecUa: 'Рецепт: {name} 📖\nЩо знадобиться та як готувати — у магазині.', mailRecRu: 'Рецепт: {name} 📖\nЧто понадобится и как готовить — в магазине.'
    }
  };
  ['ua', 'ru'].forEach(function (lang) {
    Object.keys(I18N_2C[lang]).forEach(function (k) { I18N[lang][k] = I18N_2C[lang][k]; });
  });
  var SUB_VIEWS = { points: 1, story: 1, biz: 1, recipe: 1, quiz: 1, rail: 1, recipes: 1 };

  /* ---- В1. «Як їсти» и рецепты ---- */
  /** Рецепт виден, только когда его главный ингредиент (первый в списке товаров) есть на витрине и в наличии. Рецепт без товаров виден всегда. */
  function recipes() {
    if (!state.catalog || !Array.isArray(state.catalog.recipes)) return [];
    return state.catalog.recipes.filter(function (r) {
      if (!r.items || !r.items.length) return true;
      var main = product(r.items[0]);
      return !!(main && main.a);
    });
  }
  function recipeById(id) { var found = null; recipes().forEach(function (r) { if (r.id === id) found = r; }); return found; }
  function recName(r) { return state.lang === 'ru' && r.ru ? r.ru : r.ua; }
  function recText(r) { return state.lang === 'ru' ? (r.tRu || r.tUa || '') : (r.tUa || r.tRu || ''); }
  /** «Як їсти» в карточке товара — только если текст вписан в таблицу. */
  function howHtml(p) {
    var text = state.lang === 'ru' ? (p.er || p.eu) : (p.eu || p.er);
    return text ? '<div class="how"><p class="label">' + esc(t('howTitle')) + '</p><p class="how__text">' + esc(text) + '</p></div>' : '';
  }
  /** Ссылки на рецепты, в которых есть этот товар. */
  function recipeLinksHtml(p) {
    var list = recipes().filter(function (r) { return (r.items || []).indexOf(p.id) >= 0; });
    if (!list.length) return '';
    return '<div class="how"><p class="label">' + esc(t('recWith')) + '</p>' + list.map(function (r) {
      return '<button type="button" class="linkbtn" data-w1="rec" data-id="' + esc(r.id) + '">' + esc(recName(r)) + '</button>';
    }).join('') + '</div>';
  }
  /** Главная: горизонтальная лента карточек (фото рецепта или иконка + название) и «Усі рецепти» — экран со списком всех. */
  function recipesHomeHtml() {
    var list = recipes();
    if (!list.length) return '';
    return '<section class="rail recs"><div class="rail__head"><h2 class="rail__title">' + esc(t('recTitle')) + '</h2>' +
      '<button type="button" class="linkbtn recs__all" data-w1="go" data-view="recipes">' + esc(t('recAll')) + '</button></div><div class="rail__list">' + list.slice(0, 8).map(function (r) {
      return '<button type="button" class="rcard" data-w1="rec" data-id="' + esc(r.id) + '"><span class="rcard__img">' +
        (r.img ? '<img src="' + esc(r.img) + '" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">' : icon('sprout')) +
        '</span><span class="rcard__name">' + esc(recName(r)) + '</span></button>';
    }).join('') + '</div></section>';
  }
  function recipesPageHtml() {
    var list = recipes(), html = pageHead(t('recTitle'));
    if (!list.length) return html + '<p class="state__text adm__msg">' + esc(t('recGone')) + '</p>';
    return html + '<div class="recs__list">' + list.map(function (r) {
      return '<button type="button" class="recs__item" data-w1="rec" data-id="' + esc(r.id) + '">' + icon('sprout') + '<span>' + esc(recName(r)) + '</span></button>';
    }).join('') + '</div>';
  }
  var startRec = String(params.get('rec') || '').toUpperCase();
  function openStartRecipe() { // ссылка ?rec=ID из рассылки: открываем один раз, когда каталог загружен
    if (!startRec || !state.catalog) return;
    var id = startRec;
    if (recipeById(id)) { startRec = ''; openRecipe(id); }
  }
  function openRecipe(id) {
    if (!recipeById(id)) return;
    state.recipe = id; state.recipeNote = '';
    state.recFrom = state.view === 'recipes' ? 'recipes' : ''; // «Назад» из рецепта возвращает в список, если открыли из него
    go('recipe');
    window.scrollTo(0, 0);
  }
  function recipeHtml() {
    var r = recipeById(state.recipe);
    var html = pageHead(r ? recName(r) : t('recTitle'));
    if (!r) return html + '<p class="state__text adm__msg">' + esc(t('recGone')) + '</p>';
    var items = (r.items || []).map(product).filter(Boolean);
    html += (r.img ? '<img class="story__img" src="' + esc(r.img) + '" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">' : '') +
      (state.recipeNote ? '<p class="note note--opt" role="status">' + esc(state.recipeNote) + '</p>' : '') +
      recText(r).split(/\n+/).filter(Boolean).map(function (line) { return '<p class="rec__p">' + esc(line) + '</p>'; }).join('');
    if (items.length) {
      html += '<h3 class="sec">' + esc(t('recItems')) + '</h3><div class="grid">' + items.map(function (p) { return cardHtml(p); }).join('') + '</div>' +
        '<button type="button" class="btn btn--primary btn--block" data-w1="rec-add" data-id="' + esc(r.id) + '">' + icon('plus') + esc(t('recAdd')) + '</button>';
    }
    return html;
  }
  /** «Додати інгредієнти в кошик»: кладёт только товары, которые есть в наличии; про остальные — короткое сообщение. */
  function recipeAdd(id) {
    var r = recipeById(id);
    if (!r) return;
    var added = 0, had = 0, missing = [];
    (r.items || []).forEach(function (pid) {
      var p = product(pid);
      if (!p) return;                       // товара нет в магазине совсем (архив) — молча пропускаем
      if (!p.a) { missing.push(name(p)); return; }
      if (cartQty(pid) > 0) { had++; return; }
      var g = 0;
      if (p.t === 'w') { // первая фасовка, которой хватает на складе
        g = p.v[0] ? p.v[0][0] : 0;
        for (var i = 0; i < p.v.length; i++) if (maxQty(p, p.v[i][0]) >= 1) { g = p.v[i][0]; break; }
      }
      var price = unitPrice(p, g);
      if (!(price > 0) || maxQty(p, g) < 1) { missing.push(name(p)); return; }
      state.cart.i.push({ id: pid, g: g, q: 1, pr: price });
      added++;
    });
    var parts = [];
    if (added) parts.push(tf('recAdded', { n: added })); else if (had && !missing.length) parts.push(t('recAlready'));
    if (missing.length) parts.push(added || had ? tf('recMissing', { list: missing.join(', ') }) : t('recNone'));
    state.recipeNote = parts.join(' ');
    if (added) { saveCart(); haptic('success'); track('add', id, 'recipe'); } else haptic('error');
    renderPage();
    updateChrome();
    if (added) toast(tf('recAdded', { n: added }), t('open'), function () { go('cart'); });
  }
  /* ---- В3. «Пригости друга» ---- */
  /*
   * Работает, только когда владелец включил функцию и задал пробник (тогда сервер присылает shop.ref).
   * Пока выключено — ни блока, ни ссылок. Засчитывает приглашение сервер: один новый клиент — один раз, себя пригласить нельзя.
   */
  var REF_KEY = 'pamir_ref';
  (function () { // пришли по ссылке друга ?startapp=ref_<id>: запоминаем до первого заказа
    var m = String((inTelegram && tg.initDataUnsafe && tg.initDataUnsafe.start_param) || params.get('tgWebAppStartParam') || '').match(/^ref_(\d{5,15})$/);
    if (m && tgUser && String(tgUser.id) !== m[1]) store.set(REF_KEY, m[1]);
  })();
  function refStored() {
    var v = String(store.get(REF_KEY) || '');
    return /^\d{5,15}$/.test(v) && shopInfo().ref ? v : '';
  }
  function refLink() {
    return tgUser && cfg.BOT && cfg.APP ? 'https://t.me/' + cfg.BOT + '/' + cfg.APP + '?startapp=ref_' + tgUser.id : '';
  }
  function refHtml() {
    var r = shopInfo().ref;
    if (!r || !inTelegram || !refLink()) return '';
    return '<h3 class="sec">' + esc(t('refTitle')) + '</h3><div class="bizcard refcard"><p class="bizcard__text">' +
      esc(tf(r.min > 0 ? 'refTextMin' : 'refText', { gift: loc(r.gift), min: money(r.min) })) + '</p></div>' +
      '<button type="button" class="btn btn--primary btn--block" data-w1="ref-share">' + esc(t('refShare')) + '</button>' +
      '<button type="button" class="btn btn--block" data-w1="ref-copy">' + esc(t('refCopy')) + '</button>';
  }
  /** Подсказка в корзине тому, кого пригласили (пока он не сделал первый заказ). */
  function refCartHtml() {
    var r = shopInfo().ref;
    if (!r || !refStored() || (my.list && my.list.length)) return '';
    return '<p class="note note--gift">' + icon('gift') + '<span>' + esc(tf(r.min > 0 ? 'refCartMin' : 'refCart', { gift: loc(r.gift), min: money(r.min) })) + '</span></p>';
  }
  function refShare(copyOnly) {
    var link = refLink();
    if (!link) return;
    if (copyOnly) {
      var tmp = document.createElement('input');
      tmp.value = link; tmp.setAttribute('readonly', ''); tmp.style.position = 'fixed'; tmp.style.opacity = '0';
      document.body.appendChild(tmp);
      copyText(link, tmp).then(function (ok) { document.body.removeChild(tmp); toast(t(ok ? 'refCopied' : 'admLinkFail')); });
      return;
    }
    track('share', '', 'ref');
    openTg('https://t.me/share/url?url=' + encodeURIComponent(link) + '&text=' + encodeURIComponent(t('refMsg')));
  }
  function openTg(url) {
    try { tg.openTelegramLink(url); } catch (e) { window.open(url, '_blank'); }
  }

  /* ---- В2. Квиз «Підібрати смаколики» ---- */
  /*
   * Подбор идёт только по тегам из колонки «Теги» и по настоящим ценам. Нет ни одного товара в наличии с тегами — квиза нет.
   * Нет совпадений — показываем популярное (по настоящим заказам), а не пустой экран.
   */
  var QUIZ_FOR = ['до чаю', 'перекус', 'подарунок', 'сніданок', 'випічка', 'для випічки', 'для плову', "до м'яса", 'суп', 'узвар', 'спеції батька'];
  /** Теги товара в одном виде: апостроф в «до м'яса» может быть набран по-разному. */
  function tagsOf(p) { return Array.isArray(p.tg) ? p.tg.map(function (x) { return String(x).replace(/[’ʼ`]/g, "'"); }) : []; }
  var QUIZ_TASTE = ['солодке', 'солоне'];
  var QUIZ_BUDGET = [150, 400, 0];
  var quiz = { step: 0, purpose: '', taste: '', budget: 0 };
  function quizTagSet() {
    var set = {};
    if (state.catalog) state.catalog.products.forEach(function (p) { if (p.a) tagsOf(p).forEach(function (x) { set[x] = 1; }); });
    return set;
  }
  function quizOn() { return Object.keys(quizTagSet()).length > 0; }
  /** Самая маленькая цена, за которую товар можно купить: младшая фасовка у весового, упаковка или штука у остальных. */
  function minPrice(p) {
    if (p.t !== 'w') return p.p > 0 ? p.p : Infinity;
    var m = Infinity;
    (p.v || []).forEach(function (v) { if (v[1] > 0 && v[1] < m) m = v[1]; });
    return m;
  }
  function quizPick() {
    var list = state.catalog.products.filter(function (p) {
      var tg = tagsOf(p);
      if (!p.a || !tg.length) return false;
      if (quiz.purpose && tg.indexOf(quiz.purpose) < 0) return false;
      if (quiz.taste && tg.indexOf(quiz.taste) < 0) return false;
      return !(quiz.budget > 0) || minPrice(p) <= quiz.budget;
    }).sort(function (a, b) { return (b.n || 0) - (a.n || 0); }).slice(0, 6);
    if (list.length) return { list: list, exact: true };
    var pop = popular(6).list; // точного совпадения нет — популярное по настоящим заказам, а не пустой экран
    if (!pop.length) pop = state.catalog.products.filter(function (p) { return p.a; }).slice(0, 6);
    return { list: pop, exact: false };
  }
  function quizHtml() {
    var html = pageHead(t('quizTitle'));
    if (!state.catalog || !quizOn()) return html + '<p class="state__text adm__msg">' + esc(t('emptyTitle')) + '</p><button type="button" class="btn btn--block" data-nav="catalog">' + esc(t('toCatalog')) + '</button>';
    var have = quizTagSet();
    function opts(values, labelOf) {
      return '<div class="quiz__opts">' + values.map(function (v) {
        return '<button type="button" class="btn btn--block quiz__opt" data-quiz="' + esc(String(v)) + '">' + esc(labelOf(v)) + '</button>';
      }).join('') + '</div>';
    }
    var back = quiz.step > 0 ? '<button type="button" class="btn btn--ghost btn--block" data-action="quiz-back">' + esc(t('quizBack')) + '</button>' : '';
    if (quiz.step === 0) {
      return html + '<p class="quiz__step">' + esc(tf('quizStep', { a: 1, b: 3 })) + '</p><h3 class="quiz__q">' + esc(t('quizQ1')) + '</h3>' +
        opts(QUIZ_FOR.filter(function (x) { return have[x]; }).concat(['']), function (v) { return v ? t('tag_' + v) : t('quizAny'); });
    }
    if (quiz.step === 1) {
      return html + '<p class="quiz__step">' + esc(tf('quizStep', { a: 2, b: 3 })) + '</p><h3 class="quiz__q">' + esc(t('quizQ2')) + '</h3>' +
        opts(QUIZ_TASTE.filter(function (x) { return have[x]; }).concat(['']), function (v) { return v ? t('tag_' + v) : t('quizAny'); }) + back;
    }
    if (quiz.step === 2) {
      return html + '<p class="quiz__step">' + esc(tf('quizStep', { a: 3, b: 3 })) + '</p><h3 class="quiz__q">' + esc(t('quizQ3')) + '</h3>' +
        opts(QUIZ_BUDGET, function (v) { return t(v === 150 ? 'quizB1' : v === 400 ? 'quizB2' : 'quizB3'); }) + back;
    }
    var res = quizPick();
    return html + '<h3 class="quiz__q">' + esc(t(res.exact ? 'quizResult' : 'quizPopular')) + '</h3>' +
      '<div class="grid" id="quizGrid">' + res.list.map(function (p) { return cardHtml(p); }).join('') + '</div>' +
      '<button type="button" class="btn btn--block" data-action="quiz-again">' + esc(t('quizAgain')) + '</button>' +
      '<button type="button" class="btn btn--ghost btn--block" data-nav="catalog">' + esc(t('toCatalog')) + '</button>';
  }
  el.page.addEventListener('click', function (e) {
    if (state.view !== 'quiz') return;
    var q = e.target.closest('[data-quiz]');
    if (q) {
      var v = q.getAttribute('data-quiz');
      if (quiz.step === 0) quiz.purpose = v; else if (quiz.step === 1) quiz.taste = v; else quiz.budget = Number(v) || 0;
      quiz.step++;
      hapticSelect();
      if (quiz.step === 3) track('search', '', 'quiz:' + [quiz.purpose, quiz.taste, quiz.budget].join('|'));
      renderPage(); window.scrollTo(0, 0);
      return;
    }
    var act = e.target.closest('[data-action]');
    var kind = act ? act.getAttribute('data-action') : '';
    if (kind === 'quiz-back') { quiz.step = Math.max(0, quiz.step - 1); renderPage(); window.scrollTo(0, 0); }
    if (kind === 'quiz-again') { quiz = { step: 0, purpose: '', taste: '', budget: 0 }; renderPage(); window.scrollTo(0, 0); }
  });

  /* Панель: шаблон «Рецепт» для рассылки */
  function mailRecipesHtml() {
    var list = recipes();
    if (!list.length) return '';
    return '<p class="label">' + esc(t('mailRecTitle')) + '</p><div class="recs__list">' + list.slice(0, 12).map(function (r) {
      return '<button type="button" class="btn btn--block" data-mail-rec="' + esc(r.id) + '">' + esc(tf('mailRecBtn', { name: r.ua })) + '</button>';
    }).join('') + '</div>';
  }
  function mailFromRecipe(id, btn) {
    var r = recipeById(id);
    if (!r || adm.busy) return;
    adm.busy = true; btnBusy(btn);
    api('admin.recipePhoto', { id: id }).then(function (res) { return res && res.ok ? res.photo || '' : ''; }, function () { return ''; }).then(function (photo) {
      adm.busy = false; btnFree(btn);
      mailOpen({ ua: I18N.ua.mailRecUa.replace('{name}', r.ua), ru: I18N.ru.mailRecRu.replace('{name}', r.ru || r.ua), photo: photo, btn: { k: 'rec', v: r.id }, seg: { k: 'all', v: '' } });
    });
  }

  /* ---- Б1. Рассылка (панель) ---- */
  /*
   * Порядок жёсткий: текст → «Зберегти й надіслати тільки мені» → экран с числом получателей и точным текстом → отправка.
   * Его же проверяет сервер: без шага «тільки мені» рассылка не уйдёт, даже если обойти панель.
   */
  function mailErrText(res) {
    var key = 'mailErr_' + (res && res.error);
    return res && res.error === 'no_perm' ? t('admNoPerm') : t(key) === key ? t('admFail') : t(key) + (res.why ? ' (' + res.why + ')' : '');
  }
  function mailStatText(m) {
    var parts = [tf('mailStat', { s: m.sent, t: m.total })];
    if (m.err) parts.push(tf('mailStatErr', { n: m.err }));
    if (m.blocked) parts.push(tf('mailStatBl', { n: m.blocked }));
    if (m.skipped) parts.push(tf('mailStatSkip', { n: m.skipped }));
    if (m.clicks) parts.push(tf('mailStatClick', { n: m.clicks }));
    if (m.orders) parts.push(tf('mailStatOrd', { n: m.orders }));
    return parts.join(' · ');
  }
  function mailSegLabel(seg) { return t('mailSeg_' + seg.k) + (seg.v ? ': ' + seg.v : ''); }
  function mailListHtml() {
    var d = adm.mail || { mails: [] };
    var html = '<button type="button" class="btn btn--primary btn--block" data-action="mail-new">' + icon('plus') + esc(t('mailNew')) + '</button>' +
      (d.trigger ? '' : '<p class="info info__muted">' + esc(t('mailNoTrigger')) + '</p>');
    html += mailRecipesHtml();
    if (!d.mails.length) return html + '<p class="state__text adm__msg">' + esc(t('mailEmpty')) + '</p>';
    return html + '<ul class="lines">' + d.mails.map(function (m) {
      var cls = m.status === 'завершена' ? 'badge--stock' : m.status === 'скасована' ? 'badge--out' : m.status === 'створена' ? '' : 'badge--opt';
      var started = m.status !== 'створена' && m.status !== 'запланована';
      return '<li class="my"><div class="my__head"><span class="ord__num">' + esc(m.id) + '</span><span class="badge ' + cls + '">' + esc(m.status) + '</span><span class="my__date">' + esc(m.created) + '</span></div>' +
        '<p class="rv__text mail__text">' + esc((m.ua || m.ru).split('\n')[0].slice(0, 90)) + '</p>' +
        '<p class="prod__sub">' + esc(mailSegLabel(m.seg)) + (m.status === 'запланована' ? ' · ' + esc(tf('mailAtLabel', { at: m.at })) : '') + '</p>' +
        (started || m.status === 'запланована' ? '<p class="prod__sub">' + esc(started ? mailStatText(m) : tf('mailCount', { n: m.total })) + '</p>' : '') +
        (m.status === 'створена' ? '<button type="button" class="btn btn--block" data-mail-edit="' + esc(m.id) + '">' + esc(t('mailEditBtn')) + '</button>' : '') +
        (m.status === 'запланована' || m.status === 'йде' ? '<button type="button" class="btn btn--ghost-danger btn--block" data-mail-cancel="' + esc(m.id) + '">' + esc(t('mailCancel')) + '</button>' : '') + '</li>';
    }).join('') + '</ul>';
  }
  function mailOpen(src) {
    adm.tab = 'mail';
    adm.edit = '';
    adm.mailEdit = { id: src.id || '', ua: src.ua || '', ru: src.ru || '', photo: src.photo || '', btnK: (src.btn && src.btn.k) || 'none', btnV: (src.btn && src.btn.v) || '',
      segK: (src.seg && src.seg.k) || 'all', segV: (src.seg && src.seg.v) || '', step: 'edit', n: 0, skip: 0, at: '' };
    renderPage(); window.scrollTo(0, 0);
  }
  /** Предпросмотр: так сообщение увидит клиент на каждом языке (пустой язык показывает текст второго). */
  function mailPreviewHtml(d) {
    function bubble(lang, text) {
      var label = d.btnK === 'none' ? '' : I18N[lang === 'RU' ? 'ru' : 'ua']['mailBtn_' + d.btnK]; // подпись кнопки — на языке этого сообщения
      return '<div class="mailpv"><p class="mailpv__lang">' + lang + '</p>' + (d.photo ? '<p class="mailpv__photo">' + esc(t('mailPhoto').split(' ')[0]) + '</p>' : '') +
        '<p class="mailpv__text">' + esc(text) + '</p>' + (label ? '<p class="mailpv__btn">' + esc(label) + (d.btnV ? ': ' + esc(d.btnV) : '') + '</p>' : '') +
        '<p class="mailpv__btn mailpv__btn--muted">' + esc(I18N[lang === 'RU' ? 'ru' : 'ua'].mailUnsub) + '</p></div>';
    }
    var ua = d.ua || d.ru, ru = d.ru || d.ua;
    if (!ua && !ru) return '';
    return '<p class="label">' + esc(t('mailPreview')) + '</p>' + bubble('UA', ua) + bubble('RU', ru);
  }
  function mailEditHtml() {
    var d = adm.mailEdit;
    var cats = state.catalog ? state.catalog.categories : [];
    function catSelect(id, value) {
      return '<select class="input" id="' + id + '">' + cats.map(function (c) { return '<option value="' + esc(c.code) + '"' + (c.code === value ? ' selected' : '') + '>' + esc(c.ua) + '</option>'; }).join('') + '</select>';
    }
    if (d.step === 'confirm') { // шаг 2: число получателей и точный текст; отсюда — отправка
      var every = (adm.mail && adm.mail.every) || 0;
      return '<div class="form"><p class="label">' + esc(d.id) + '</p><p class="note note--opt">' + esc(t('mailTested')) + '</p>' +
        '<p class="mail__count" id="mailCount">' + esc(d.n ? tf('mailCount', { n: d.n }) : t('mailNone')) + '</p>' +
        (d.skip ? '<p class="info info__muted">' + esc(tf('mailSkip', { n: d.skip, d: every })) + '</p>' : '') +
        '<p class="prod__sub">' + esc(mailSegLabel({ k: d.segK, v: d.segV })) + '</p>' + mailPreviewHtml(d) +
        '<p class="form__err" id="mailErr" role="alert" hidden></p>' +
        '<button type="button" class="btn btn--primary btn--block" data-action="mail-now"' + (d.n ? '' : ' disabled') + '>' + esc(d.n ? tf('mailNow', { n: d.n }) : t('mailNone')) + '</button>' +
        '<div class="field"><label class="label" for="m-at">' + esc(t('mailAt')) + '</label><input class="input" id="m-at" type="datetime-local" value="' + esc(d.at) + '"></div>' +
        '<button type="button" class="btn btn--block" data-action="mail-plan"' + (d.n ? '' : ' disabled') + '>' + esc(t('mailPlan')) + '</button>' +
        '<button type="button" class="btn btn--ghost btn--block" data-action="mail-back">' + esc(t('mailBack')) + '</button></div>';
    }
    return '<form class="form" id="mailForm" novalidate><p class="label">' + esc(d.id || t('mailNew')) + '</p><p class="form__err" id="mailErr" role="alert" hidden></p>' +
      '<div class="field"><label class="label" for="m-ua">' + esc(t('mailUa')) + '</label><textarea class="input input--area" id="m-ua" rows="4" maxlength="3500">' + esc(d.ua) + '</textarea></div>' +
      '<div class="field"><label class="label" for="m-ru">' + esc(t('mailRu')) + '</label><textarea class="input input--area" id="m-ru" rows="4" maxlength="3500">' + esc(d.ru) + '</textarea>' +
      '<p class="field__hint">' + esc(t('mailLangHint')) + '</p></div>' +
      '<div class="field"><label class="label" for="m-photo">' + esc(t('mailPhoto')) + '</label><input class="input" id="m-photo" type="text" maxlength="200" autocomplete="off" value="' + esc(d.photo) + '">' +
      '<p class="field__hint">' + esc(t('mailPhotoHint')) + '</p></div>' +
      '<div class="field"><label class="label" for="m-btnK">' + esc(t('mailBtn')) + '</label><select class="input" id="m-btnK">' + ['none', 'shop', 'prod', 'cat'].concat(recipes().length ? ['rec'] : []).map(function (k) {
        return '<option value="' + k + '"' + (d.btnK === k ? ' selected' : '') + '>' + esc(t('mailBtn_' + k)) + '</option>'; }).join('') + '</select>' +
      (d.btnK === 'prod' ? '<input class="input" id="m-btnV" type="text" maxlength="40" autocapitalize="characters" autocomplete="off" placeholder="' + esc(t('mailBtnProd')) + '" aria-label="' + esc(t('mailBtnProd')) + '" value="' + esc(d.btnV) + '">' : '') +
      (d.btnK === 'cat' ? catSelect('m-btnV', d.btnV) : '') +
      (d.btnK === 'rec' ? '<select class="input" id="m-btnV">' + recipes().map(function (r) { return '<option value="' + esc(r.id) + '"' + (r.id === d.btnV ? ' selected' : '') + '>' + esc(r.ua) + '</option>'; }).join('') + '</select>' : '') + '</div>' +
      '<div class="field"><label class="label" for="m-segK">' + esc(t('mailSeg')) + '</label><select class="input" id="m-segK">' + ['all', 'cat', 'prod', 'idle', 'wh', 'sub'].map(function (k) {
        return '<option value="' + k + '"' + (d.segK === k ? ' selected' : '') + '>' + esc(t('mailSeg_' + k)) + '</option>'; }).join('') + '</select>' +
      (d.segK === 'prod' || d.segK === 'sub' ? '<input class="input" id="m-segV" type="text" maxlength="40" autocapitalize="characters" autocomplete="off" placeholder="' + esc(t('mailSegProd')) + '" aria-label="' + esc(t('mailSegProd')) + '" value="' + esc(d.segV) + '">' : '') +
      (d.segK === 'cat' ? catSelect('m-segV', d.segV) : '') + '</div>' +
      '<div id="mailPv">' + mailPreviewHtml(d) + '</div>' +
      '<p class="info info__muted">' + esc(t('mailTestHint')) + '</p>' +
      '<button type="button" class="btn btn--primary btn--block" data-action="mail-test">' + esc(t('mailTest')) + '</button></form>';
  }
  /** Поля редактора → adm.mailEdit (форма перерисовывается при смене кнопки и сегмента, введённое не должно теряться). */
  function mailRead() {
    var d = adm.mailEdit;
    if (!d || d.step !== 'edit') return;
    function v(id) { var x = document.getElementById(id); return x ? x.value : null; }
    if (v('m-ua') !== null) d.ua = v('m-ua').trim();
    if (v('m-ru') !== null) d.ru = v('m-ru').trim();
    if (v('m-photo') !== null) d.photo = v('m-photo').trim();
    if (v('m-btnK') !== null) d.btnK = v('m-btnK');
    if (v('m-segK') !== null) d.segK = v('m-segK');
    d.btnV = d.btnK === 'prod' || d.btnK === 'cat' || d.btnK === 'rec' ? (v('m-btnV') !== null ? v('m-btnV').trim().toUpperCase() : d.btnV) : '';
    d.segV = d.segK === 'prod' || d.segK === 'cat' || d.segK === 'sub' ? (v('m-segV') !== null ? v('m-segV').trim().toUpperCase() : d.segV) : '';
  }
  function mailFail(res, btn) {
    btnFree(btn);
    haptic('error');
    var box = document.getElementById('mailErr');
    if (box) { box.textContent = typeof res === 'string' ? res : mailErrText(res); box.hidden = false; box.scrollIntoView({ block: 'center' }); }
  }
  /** «Зберегти й надіслати тільки мені»: черновик сохраняется, автор получает сообщение на обоих языках. */
  function mailTestSend(btn) {
    var d = adm.mailEdit;
    if (!d || adm.busy) return;
    mailRead();
    if (!d.ua && !d.ru) { mailFail({ error: 'bad_form' }, null); return; } // пустую рассылку на сервер не отправляем
    adm.busy = true; btnBusy(btn);
    api('admin.mailSave', { id: d.id, ua: d.ua, ru: d.ru, photo: d.photo, btn: { k: d.btnK, v: d.btnV }, seg: { k: d.segK, v: d.segV } }).then(function (res) {
      if (!res || !res.ok) { adm.busy = false; mailFail(res, btn); return null; }
      d.id = res.mail.id;
      return api('admin.mailTest', { id: d.id });
    }).then(function (res) {
      if (res === null) return;
      adm.busy = false;
      if (!res || !res.ok) { mailFail(res, btn); return; }
      d.n = res.n; d.skip = res.skip; d.step = 'confirm';
      adm.mail = null; // список обновится при возврате
      haptic('success');
      renderPage(); window.scrollTo(0, 0);
    }).catch(function () { adm.busy = false; mailFail(t('admFail'), btn); });
  }
  function mailStart(at) {
    var d = adm.mailEdit;
    if (!d) return;
    var shown = at ? at.slice(8, 10) + '.' + at.slice(5, 7) + '.' + at.slice(0, 4) + ' ' + at.slice(11, 16) : '';
    askConfirm({
      title: t(at ? 'mailPlanTitle' : 'mailSendTitle'), text: tf(at ? 'mailPlanText' : 'mailSendText', { n: d.n, at: shown }),
      html: mailPreviewHtml(d), ok: tf(at ? 'mailPlanOk' : 'mailSendOk', { n: d.n, at: shown }),
      run: function (done) {
        api('admin.mailSend', { id: d.id, at: at || '' }).then(function (res) {
          if (!res || !res.ok) { done(mailErrText(res)); return; }
          adm.mailEdit = null; adm.mail = null; adm.loading = false;
          done();
          haptic('success');
          toast(at ? tf('mailPlanned', { at: res.at }) : t('mailSent'));
          renderPage(); window.scrollTo(0, 0);
          loadAdmin(true);
        }).catch(function () { done(t('admFail')); });
      }
    });
  }
  function mailCancelAsk(id) {
    askConfirm({ title: t('mailCancelTitle'), text: tf('mailCancelText', { id: id }), ok: tf('mailCancelOk', { id: id }), danger: true,
      run: function (done) {
        api('admin.mailCancel', { id: id }).then(function (res) {
          if (!res || !res.ok) { done(mailErrText(res)); return; }
          ((adm.mail && adm.mail.mails) || []).forEach(function (m, i) { if (m.id === id) adm.mail.mails[i] = res.mail; });
          done();
          haptic('success'); toast(t('mailCanceled'));
          renderAdminList();
        }).catch(function () { done(t('admFail')); });
      } });
  }
  /** Нажатия во вкладке «Розсилка» и кнопка шаблона «Свіжа поставка» в карточке товара. */
  function mailClick(e, name, act) {
    var ed = e.target.closest('[data-mail-edit]');
    if (ed) {
      var found = null;
      ((adm.mail && adm.mail.mails) || []).forEach(function (m) { if (m.id === ed.getAttribute('data-mail-edit')) found = m; });
      if (found) mailOpen(found);
      return true;
    }
    var cn = e.target.closest('[data-mail-cancel]');
    if (cn) { mailCancelAsk(cn.getAttribute('data-mail-cancel')); return true; }
    if (name === 'mail-new') { mailOpen({}); return true; }
    var mr = e.target.closest('[data-mail-rec]');
    if (mr) { if (!mr.disabled) mailFromRecipe(mr.getAttribute('data-mail-rec'), mr); return true; }
    if (name === 'mail-fresh') {
      var p = adminProduct(adm.edit);
      if (p) mailOpen({ ua: I18N.ua.mailFreshUa.replace('{name}', p.ua), ru: I18N.ru.mailFreshRu.replace('{name}', p.ru || p.ua), btn: { k: 'prod', v: p.id }, seg: { k: 'all', v: '' } });
      return true;
    }
    if (name === 'mail-test') { if (!act.disabled) mailTestSend(act); return true; }
    if (name === 'mail-back') { adm.mailEdit.step = 'edit'; renderPage(); window.scrollTo(0, 0); return true; }
    if (name === 'mail-now') { if (!act.disabled) mailStart(''); return true; }
    if (name === 'mail-plan') {
      var at = (document.getElementById('m-at') || {}).value || '';
      if (adm.mailEdit) adm.mailEdit.at = at;
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(at)) { mailFail(t('mailErr_bad_time'), null); return true; }
      mailStart(at.slice(0, 16));
      return true;
    }
    return false;
  }
  el.page.addEventListener('input', function (e) {
    if (state.view !== 'admin' || !adm.mailEdit || adm.mailEdit.step !== 'edit' || !/^m-/.test(e.target.id || '')) return;
    mailRead();
    var pv = document.getElementById('mailPv');
    if (pv) pv.innerHTML = mailPreviewHtml(adm.mailEdit);
  });
  el.page.addEventListener('change', function (e) {
    if (state.view !== 'admin' || !adm.mailEdit || (e.target.id !== 'm-btnK' && e.target.id !== 'm-segK')) return;
    mailRead();
    if (adm.mailEdit.btnK === 'cat' && !adm.mailEdit.btnV && state.catalog && state.catalog.categories[0]) adm.mailEdit.btnV = state.catalog.categories[0].code;
    if (adm.mailEdit.segK === 'cat' && !adm.mailEdit.segV && state.catalog && state.catalog.categories[0]) adm.mailEdit.segV = state.catalog.categories[0].code;
    var y = window.scrollY;
    renderPage(); // появляется или исчезает поле «какой товар / какая категория»
    window.scrollTo(0, y);
  });

  /* ---- Б2. Опт ---- */
  /*
   * Оптовые цены приходят отдельным запросом и только одобренному оптовику (статус при каждом запросе проверяет сервер).
   * В общем каталоге их нет. Цену заказа всё равно считает сервер: витрина лишь показывает то же самое.
   */
  var WH_KEY = 'pamir_wh';
  var wh = { on: false, prices: {}, app: '', ok: false, loading: false, sent: false };
  function num(n) { return String(Math.round(n * 1000) / 1000).replace('.', ','); }
  function loadWh(force) {
    if (!cfg.API_URL || !inTelegram || wh.loading) return;
    var saved = String(store.get(WH_KEY) || '').split(':'); // «1» — оптовик, «0:время» — нет (перепроверяем раз в сутки и при открытии «Для бізнесу»)
    if (!force && saved[0] === '0' && Date.now() - Number(saved[1] || 0) < 24 * 3600 * 1000) return;
    wh.loading = true;
    postApi('wh.prices').then(function (res) {
      wh.loading = false;
      if (!res || !res.ok) throw new Error('fail'); // старый бэкенд такого запроса не знает — опта просто нет
      var was = wh.on;
      wh.ok = true;
      wh.on = !!res.wh;
      wh.prices = (res.wh && res.prices) || {};
      wh.app = res.app || '';
      store.set(WH_KEY, wh.on ? '1' : '0:' + Date.now());
      if (state.view === 'biz' || state.view === 'cart' || state.view === 'orders') renderPage();
      if (was !== wh.on) { // стал или перестал быть оптовиком: строка «для бізнесу» на главной и цены в открытой карточке обновляются
        updateChrome();
        if (state.view === 'catalog' && state.status === 'ready') { if (state.sheet) stale.main = 'force'; else renderMain(); }
        if (state.sheet) renderSheet();
      }
    }).catch(function () { wh.loading = false; if (state.view === 'biz') renderPage(); });
  }
  /** Сколько этого товара в корзине: кг для весового (все фасовки вместе), штуки для остальных. */
  function whQty(p) {
    return state.cart.i.reduce(function (s, l) {
      if (l.id !== p.id || !(unitPrice(p, l.g) > 0)) return s;
      return s + (p.t === 'w' ? l.g * l.q / 1000 : l.q);
    }, 0);
  }
  /** Оптовая цена позиции или 0, если человек не оптовик или порог объёма не набран. Та же формула, что на сервере. */
  function whUnit(p, g) {
    var x = wh.on && p ? wh.prices[p.id] : null;
    if (!x || (p.t === 'w') !== (x[2] === 'kg') || whQty(p) + 1e-9 < x[1]) return 0;
    return p.t === 'w' ? Math.round(x[0] * g / 1000) : Math.round(x[0]);
  }
  function whSheetHtml(p) {
    var x = wh.on ? wh.prices[p.id] : null;
    if (x) return '<p class="note note--opt">' + esc(tf(p.t === 'w' ? 'whFromKg' : p.t === 'u' ? 'whFromPcs' : 'whFromPack', { n: num(x[1]), p: money(x[0]) })) + '</p>';
    if (p.wb && inTelegram && !wh.on) return '<button type="button" class="linkbtn" data-w1="go" data-view="biz">' + esc(t('whLink')) + '</button>';
    return '';
  }
  /** В корзине оптовика: что уже по оптовой цене и сколько не хватает до неё по остальным товарам. */
  function whCartHtml() {
    if (!wh.on) return '';
    var seenId = {}, html = '';
    state.cart.i.forEach(function (l) {
      var p = product(l.id), x = p ? wh.prices[p.id] : null;
      if (!p || !x || seenId[p.id] || !(unitPrice(p, l.g) > 0) || (p.t === 'w') !== (x[2] === 'kg')) return;
      seenId[p.id] = 1;
      var left = x[1] - whQty(p);
      if (left > 1e-9) html += '<p class="note note--opt">' + esc(tf(p.t === 'w' ? 'whLeftKg' : 'whLeftPcs', { name: name(p), n: num(left) })) + '</p>';
    });
    return html;
  }
  function bizAvailable() {
    return inTelegram && !!cfg.API_URL && (wh.ok || (!!state.catalog && state.catalog.products.some(function (p) { return p.wb; })));
  }
  /** Плашка на главной — только когда в магазине есть товары с оптовой ценой и человек ещё не оптовик. */
  function bizPlusOn() {
    return inTelegram && !wh.on && !!state.catalog && state.catalog.products.some(function (p) { return p.wb; });
  }
  var biz = { type: '', busy: false };
  function bizHtml() {
    var html = pageHead(t('bizTitle'));
    if (!inTelegram || !cfg.API_URL) return html + '<p class="state__text adm__msg">' + esc(t('bizTg')) + '</p>';
    if (wh.loading && !wh.ok) return html + '<div class="skeleton skeleton--row"></div>';
    if (wh.on) {
      return html + '<div class="bizcard"><p class="bizcard__title">' + esc(t('bizYes')) + '</p>' +
        '<p class="bizcard__text">' + esc(tf('bizYesText', { n: Object.keys(wh.prices).length })) + '</p></div>' +
        '<button type="button" class="btn btn--primary btn--block" data-action="biz-price">' + esc(t('bizPrice')) + '</button>' +
        '<button type="button" class="btn btn--block" data-nav="catalog">' + esc(t('toCatalog')) + '</button>';
    }
    if (wh.sent || wh.app === 'нова' || wh.app === 'в роботі') {
      return html + '<div class="bizcard"><p class="bizcard__title">' + esc(t(wh.app === 'в роботі' ? 'bizWork' : 'bizSent')) + '</p>' +
        '<p class="bizcard__text">' + esc(t('bizSentText')) + '</p></div>' +
        '<button type="button" class="btn btn--block" data-nav="catalog">' + esc(t('toCatalog')) + '</button>';
    }
    var f = state.form;
    function inp(id, label, value, attrs, ph) {
      return '<div class="field"><label class="label" for="b-' + id + '">' + esc(label) + '</label><input class="input" id="b-' + id + '" ' + attrs +
        (ph ? ' placeholder="' + esc(ph) + '"' : '') + ' value="' + esc(value || '') + '"></div>';
    }
    return html + '<form class="form" id="bizForm" novalidate><p class="info">' + esc(t('bizIntro')) + '</p>' +
      (wh.app === 'відхилено' ? '<p class="note note--out">' + esc(t('bizRejected')) + '</p>' : '') +
      '<p class="form__err" id="bizErr" role="alert" hidden></p>' +
      '<div class="field"><p class="label">' + esc(t('bizType')) + '</p><div class="chips chips--flush chips--wrap" role="group">' +
      ['cafe', 'shop', 'office', 'other'].map(function (k) {
        return '<button type="button" class="chip" data-biz-type="' + k + '" aria-pressed="' + (biz.type === k) + '">' + esc(t('bizT_' + k)) + '</button>';
      }).join('') + '</div></div>' +
      inp('name', t('bizName'), '', 'type="text" maxlength="80" autocomplete="organization"') +
      inp('city', t('bizCity'), f.city, 'type="text" maxlength="60" autocomplete="address-level2"') +
      inp('contact', t('bizContact'), f.name, 'type="text" maxlength="60" autocomplete="name"') +
      inp('phone', t('bizPhone'), f.phone || '+380', 'type="tel" inputmode="tel" maxlength="17" autocomplete="tel"') +
      '<div class="field"><p class="label">' + esc(t('bizCats')) + '</p>' + (state.catalog ? state.catalog.categories : []).map(function (c) {
        return '<label class="check"><input type="checkbox" name="bizcat" value="' + esc(c.ua) + '"><span>' + esc(state.lang === 'ru' ? c.ru : c.ua) + '</span></label>';
      }).join('') + '</div>' +
      inp('volume', t('bizVolume'), '', 'type="text" maxlength="80"', t('bizVolumePh')) +
      inp('freq', t('bizFreq'), '', 'type="text" maxlength="80"', t('bizFreqPh')) +
      '<div class="field"><label class="label" for="b-comment">' + esc(t('bizComment')) + '</label><textarea class="input input--area" id="b-comment" rows="3" maxlength="300"></textarea></div>' +
      '<button type="button" class="btn btn--primary btn--block" data-action="biz-send">' + esc(t('bizSend')) + '</button></form>';
  }
  function bizSend(btn) {
    if (biz.busy) return;
    function v(id) { var x = document.getElementById('b-' + id); return x ? x.value.trim() : ''; }
    var data = { type: biz.type, name: v('name'), city: v('city'), contact: v('contact'), phone: v('phone').replace(/\s+/g, ''), volume: v('volume'), freq: v('freq'),
      comment: v('comment'), lang: state.lang,
      cats: Array.prototype.map.call(document.querySelectorAll('#bizForm input[name="bizcat"]:checked'), function (x) { return x.value; }) };
    var box = document.getElementById('bizErr');
    function fail(key) { if (box) { box.textContent = t(key); box.hidden = false; box.scrollIntoView({ block: 'center' }); } haptic('error'); }
    if (!data.type || data.name.length < 2 || data.city.length < 2 || data.contact.length < 2 || !/^\+\d{10,15}$/.test(data.phone)) { fail('bizErr'); return; }
    biz.busy = true; btnBusy(btn);
    postApi('wh.apply', data).then(function (res) {
      biz.busy = false;
      if (!res || !res.ok) { btnFree(btn); fail(res && res.error === 'rate_limit' ? 'bizRate' : 'bizFail'); return; }
      if (res.wh) { loadWh(true); return; }
      wh.sent = true; wh.app = 'нова';
      haptic('success');
      renderPage(); window.scrollTo(0, 0);
    }).catch(function () { biz.busy = false; btnFree(btn); fail('bizFail'); });
  }
  function bizPrice(btn) {
    if (biz.busy) return;
    biz.busy = true; btnBusy(btn);
    postApi('wh.pricelist', { lang: state.lang }).then(function (res) {
      biz.busy = false; btnFree(btn);
      if (!res || !res.ok) { haptic('error'); toast(t(res && res.error === 'rate_limit' ? 'bizPriceRate' : 'bizFail')); if (res && res.error === 'no_perm') loadWh(true); return; }
      haptic('success'); toast(t('bizPriceOk'));
    }).catch(function () { biz.busy = false; btnFree(btn); toast(t('bizFail')); });
  }
  el.page.addEventListener('click', function (e) {
    if (state.view !== 'biz') return;
    var tp = e.target.closest('[data-biz-type]');
    if (tp) {
      biz.type = tp.getAttribute('data-biz-type');
      Array.prototype.forEach.call(document.querySelectorAll('[data-biz-type]'), function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-biz-type') === biz.type)); });
      return;
    }
    var act = e.target.closest('[data-action]');
    var kind = act ? act.getAttribute('data-action') : '';
    if (kind === 'biz-send' && !act.disabled) bizSend(act);
    if (kind === 'biz-price' && !act.disabled) bizPrice(act);
  });
  el.page.addEventListener('input', function (e) {
    if (state.view === 'biz' && e.target.id === 'b-phone') e.target.value = formatPhone(e.target.value);
  });

  /* Панель: вкладка «Опт» */
  function whAdminHtml() {
    var d = adm.wh || { apps: [], clients: [] };
    var html = '<p class="label">' + esc(t('whApps')) + '</p>';
    html += d.apps.length ? '<ul class="lines">' + d.apps.map(function (a) {
      var done = a.status === 'схвалено' || a.status === 'відхилено';
      var cls = a.status === 'схвалено' ? 'badge--stock' : a.status === 'відхилено' ? 'badge--out' : 'badge--opt';
      return '<li class="my"><div class="my__head"><span class="ord__num">' + esc(a.id) + '</span><span class="badge ' + cls + '">' + esc(a.status) + '</span><span class="my__date">' + esc(a.date) + '</span></div>' +
        '<p class="rv__who"><b>' + esc(a.name) + '</b></p>' +
        '<p class="rv__text">' + esc(a.type) + ' · ' + esc(a.city) + ' · ' + esc(a.contact) + (a.username ? ' · ' + esc(a.username) : '') + '<br><a href="tel:' + esc(a.phone) + '">' + esc(a.phone) + '</a></p>' +
        (a.cats || a.volume || a.freq ? '<p class="rv__text">' + [a.cats, a.volume, a.freq].filter(Boolean).map(esc).join(' · ') + '</p>' : '') +
        (a.comment ? '<p class="info">' + esc(a.comment) + '</p>' : '') +
        (done ? (a.by ? '<p class="prod__sub">' + esc(a.by) + '</p>' : '') : '<div class="wh__acts">' +
          (a.status === 'нова' ? '<button type="button" class="btn" data-wh-d="t" data-id="' + esc(a.id) + '">' + esc(t('whTake')) + '</button>' : '') +
          '<button type="button" class="btn btn--soft" data-wh-d="a" data-id="' + esc(a.id) + '">' + esc(t('whApprove')) + '</button>' +
          '<button type="button" class="btn btn--ghost-danger" data-wh-d="r" data-id="' + esc(a.id) + '">' + esc(t('whReject')) + '</button></div>') + '</li>';
    }).join('') + '</ul>' : '<p class="state__text adm__msg">' + esc(t('whNoApps')) + '</p>';
    html += '<p class="label">' + esc(t('whClients')) + '</p>';
    html += d.clients.length ? '<ul class="lines">' + d.clients.map(function (c) {
      return '<li class="arch"><span class="prod__name">' + esc(c.name || 'id ' + c.uid) + '</span>' +
        '<span class="prod__sub">' + esc(c.contact) + ' · ' + esc(c.city) + ' · ' + esc(c.phone) + '</span>' +
        '<span class="prod__sub">' + esc(c.on ? t('whActive') : t('whOff')) + ' · ' + esc(c.date) + (c.by ? ' · ' + esc(c.by) : '') + '</span>' +
        (c.on ? '<div class="arch__acts arch__acts--one"><button type="button" class="btn btn--ghost-danger" data-wh-revoke="' + esc(c.uid) + '">' + esc(t('whRevoke')) + '</button></div>' : '') + '</li>';
    }).join('') + '</ul>' : '<p class="state__text adm__msg">' + esc(t('whNoClients')) + '</p>';
    return html;
  }
  function whDecide(id, d, btn) {
    var a = null;
    ((adm.wh && adm.wh.apps) || []).forEach(function (x) { if (x.id === id) a = x; });
    if (!a || adm.busy) return;
    function send(done) {
      adm.busy = true;
      api('admin.whDecide', { id: id, d: d }).then(function (res) {
        adm.busy = false;
        if (!res || !res.ok) { var err = apiErr(res); if (done) done(err); else { btnFree(btn); haptic('error'); toast(err); renderAdminList(); } return; }
        a.status = res.status;
        if (done) done();
        haptic('success');
        toast(t('admSaved') + (res.told === false ? '. ' + t('admNotTold') : ''));
        if (d === 'a') { adm.wh = null; adm.loading = false; loadAdmin(true); } else renderAdminList();
      }).catch(function () { adm.busy = false; if (done) done(t('admFail')); else { btnFree(btn); toast(t('admFail')); renderAdminList(); } });
    }
    if (d === 't') { btnBusy(btn, '.wh__acts'); send(null); return; } // «в работу» — обратимо, без вопроса
    askConfirm({ title: t(d === 'a' ? 'whApproveTitle' : 'whRejectTitle'), text: tf(d === 'a' ? 'whApproveText' : 'whRejectText', { name: a.name, id: a.id }),
      ok: tf(d === 'a' ? 'whApproveOk' : 'whRejectOk', { name: a.name }), danger: d === 'r', run: send });
  }
  function whRevoke(uid) {
    var c = null;
    ((adm.wh && adm.wh.clients) || []).forEach(function (x) { if (x.uid === uid) c = x; });
    if (!c) return;
    var who = c.name || 'id ' + c.uid;
    askConfirm({ title: t('whRevokeTitle'), text: tf('whRevokeText', { name: who }), ok: tf('whRevokeOk', { name: who }), danger: true,
      run: function (done) {
        api('admin.whRevoke', { uid: uid }).then(function (res) {
          if (!res || !res.ok) { done(apiErr(res)); return; }
          adm.wh = { apps: res.apps || [], clients: res.clients || [] };
          done();
          haptic('success'); toast(t('whRevoked'));
          renderAdminList();
        }).catch(function () { done(t('admFail')); });
      } });
  }

  /* ---- Б4. Специи и смеси отца ---- */
  /** Подборка на главной сразу после «Наша курага», в том же стиле: одна лента карточек; товары и тексты — из настроек; нет товаров в наличии — блока нет. */
  function fatherHtml() {
    var d = fatherData();
    if (!d) return '';
    return '<section class="father lane" data-lane="father">' + ORN + laneHeadHtml('father', d.title, d.text) +
      '<div class="rail__list">' + d.list.map(function (p) { return rowCardHtml(p); }).join('') + '</div></section>';
  }
  /** «Склад: …» в карточке товара — только если состав вписан в таблицу. */
  function compHtml(p) {
    var text = state.lang === 'ru' ? (p.cr || p.cu) : (p.cu || p.cr);
    return text ? '<p class="sheet__comp"><b>' + esc(t('compTitle')) + ':</b> ' + esc(text) + '</p>' : '';
  }

  /* ---- Б3. Оплата заказа ---- */
  /** Статус оплаты и кнопки в карточке заказа. Старый бэкенд статус не присылает — тогда блока нет. */
  function payAdminHtml(o) {
    if (o.paid === undefined) return '';
    var html = '<p class="ord__pay">' + esc(t('payState')) + ': <b>' + esc(t('pay_' + o.paid)) + '</b></p>';
    if (!can('st')) return html;
    return html + '<div class="pay__acts">' +
      (o.paid === 'paid'
        ? '<button type="button" class="btn btn--ghost-danger" data-pay="refund" data-num="' + esc(o.num) + '">' + esc(t('payRefund')) + '</button>' +
          '<button type="button" class="btn" data-pay="unpaid" data-num="' + esc(o.num) + '">' + esc(t('payUndo')) + '</button>'
        : '<button type="button" class="btn btn--soft" data-pay="paid" data-num="' + esc(o.num) + '">' + esc(t('payMark')) + '</button>') + '</div>';
  }
  function markPaid(num, kind, btn) {
    var order = null;
    (adm.orders || []).forEach(function (o) { if (o.num === num) order = o; });
    if (!order || adm.busy) return;
    function send(done) {
      adm.busy = true;
      api('admin.paid', { num: num, state: kind }).then(function (res) {
        adm.busy = false;
        if (!res || !res.ok) { var err = apiErr(res); if (done) done(err); else { btnFree(btn); haptic('error'); toast(err); } return; }
        order.paid = res.paid;
        if (done) done();
        haptic('success');
        toast(t('admSaved') + (res.told === false ? '. ' + t('admNotTold') : ''));
        renderAdminList();
      }).catch(function () { adm.busy = false; if (done) done(t('admFail')); else { btnFree(btn); toast(t('admFail')); } });
    }
    if (kind === 'refund') { // возврат — заметное действие: с подтверждением и названием заказа
      askConfirm({ title: t('payRefundTitle'), text: tf('payRefundText', { num: num }), ok: tf('payRefundOk', { num: num }), danger: true, run: send });
      return;
    }
    btnBusy(btn, '.pay__acts');
    send(null);
  }

  /* ---- Скорость админ-панели ---- */
  /** Витрина после правок в панели обновляется один раз, а не после каждого нажатия: несколько правок подряд — один запрос каталога. */
  var catalogTimer = null;
  function catalogSoon() {
    clearTimeout(catalogTimer);
    catalogTimer = setTimeout(function () { loadCatalog(true); }, 1200); // direct: Worker держит копию до минуты, а админ только что сохранил правку
  }
  /**
   * Замер времени. Виден, только когда владелец включил его на сервере (свойство скрипта PERF_LOG = 1):
   * внизу экрана — последние нажатия: всё время от нажатия до ответа, сколько из него работал сервер (по этапам)
   * и сколько ушло на сеть и на сам Google.
   */
  var perfLines = [];
  function perfShow(action, total, srv) {
    var marks = (srv.marks || []).map(function (m) { return m[0] + ' ' + m[1]; }).join(', ');
    perfLines.push(action.replace('admin.', '') + ': ' + total + ' ' + t('perfMs') + ' = ' + t('perfServer') + ' ' + srv.total + (marks ? ' (' + marks + ')' : '') +
      ' + ' + t('perfNet') + ' ' + Math.max(0, total - srv.total));
    perfLines = perfLines.slice(-4);
    var box = document.getElementById('perfLine');
    if (!box) {
      box = document.createElement('div');
      box.id = 'perfLine'; box.className = 'perfline';
      document.body.appendChild(box);
    }
    box.textContent = perfLines.join('\n');
  }

  /* ---- А1. Отклик кнопок ---- */
  /**
   * Кнопка ушла на сервер: вращается индикатор, кнопка заблокирована до ответа — второй запрос не уйдёт.
   * group — селектор блока, в котором на это время блокируются и соседние кнопки (например статусы заказа).
   */
  function btnBusy(btn, group) {
    if (!btn) return;
    btn.classList.add('is-busy');
    btn.setAttribute('aria-busy', 'true');
    btn.disabled = true;
    var box = group ? btn.closest(group) : null;
    if (box) Array.prototype.forEach.call(box.querySelectorAll('button'), function (x) { x.disabled = true; });
  }
  function btnFree(btn) {
    if (!btn) return;
    btn.classList.remove('is-busy');
    btn.removeAttribute('aria-busy');
    btn.disabled = false;
  }
  /** Сохранено: галочка и «Збережено» на самой кнопке; then — что сделать после (например вернуться к списку). */
  function btnSaved(btn, then) {
    haptic('success');
    if (!btn || !document.body.contains(btn)) { if (then) then(); else toast(t('admSaved')); return; }
    var html = btn.innerHTML;
    btn.classList.remove('is-busy');
    btn.removeAttribute('aria-busy');
    btn.classList.add('is-saved');
    btn.disabled = true;
    btn.innerHTML = icon('check') + esc(t('admSaved'));
    setTimeout(function () {
      if (then) { then(); return; }
      if (!document.body.contains(btn)) return;
      btn.classList.remove('is-saved');
      btn.disabled = false;
      btn.innerHTML = html;
    }, then ? 300 : 1400);
  }
  function saveBtnEl() { return document.querySelector('#page [data-action="adm-save"]'); }

  /** Переключатель «в наявності» в списке товаров: меняется сразу, при ошибке возвращается назад с сообщением. */
  function toggleStock(sw) {
    var p = adminProduct(sw.getAttribute('data-stock'));
    if (!p || adm.pending[p.id]) return;
    var was = p.stock, want = !p.stock;
    adm.pending[p.id] = true;
    p.stock = want ? 1 : 0;
    sw.setAttribute('aria-checked', String(want));
    sw.setAttribute('aria-busy', 'true');
    sw.disabled = true;
    api('admin.product', { id: p.id, patch: { stock: want } }).then(function (res) {
      if (!res || !res.ok) throw new Error(res && res.error === 'no_perm' ? 'admNoPerm' : 'admSwFail');
      Object.keys(res.product).forEach(function (k) { p[k] = res.product[k]; });
      delete adm.pending[p.id];
      markSaved(p.id); fetchToday(true);
      catalogSoon();
      if (state.view === 'admin') renderAdminList();
    }).catch(function (err) {
      delete adm.pending[p.id];
      p.stock = was;
      haptic('error');
      toast(t(err && err.message === 'admNoPerm' ? 'admNoPerm' : 'admSwFail'));
      if (state.view === 'admin') renderAdminList();
    });
  }

  /** Галочки «В наявності» и «Приховати» в карточке товара сохраняются сразу; остальные поля формы не трогаем. */
  function toggleInForm(input) {
    var p = adminProduct(adm.edit);
    var key = input.id === 'a-stock' ? 'stock' : 'hidden';
    if (!p) return;
    var want = !!input.checked, patch = {};
    if (!!p[key] === want) return;
    patch[key] = want;
    input.disabled = true;
    var row = input.closest('.check');
    if (row) row.classList.add('is-busy');
    function finish() { if (document.body.contains(input)) { input.disabled = false; if (row) row.classList.remove('is-busy'); } }
    api('admin.product', { id: p.id, patch: patch }).then(function (res) {
      if (!res || !res.ok) throw new Error(res && res.error === 'no_perm' ? 'admNoPerm' : 'admSwFail');
      p[key] = res.product[key]; // только это поле: остальные могли быть изменены в форме и ещё не сохранены
      finish();
      haptic('success');
      toast(t('admSaved'));
      catalogSoon();
    }).catch(function (err) {
      finish();
      if (document.body.contains(input)) input.checked = !want;
      haptic('error');
      toast(t(err && err.message === 'admNoPerm' ? 'admNoPerm' : 'admSwFail'));
    });
  }

  /* ---- А2/А3. Нумерованные страницы (один компонент для витрины и админ-панели) ---- */
  function clampPage(page, total, size) {
    var pages = Math.max(1, Math.ceil(total / size));
    return Math.min(pages, Math.max(1, Math.floor(Number(page)) || 1));
  }
  /**
   * Какие номера показать: первая, последняя и текущая с соседями, остальное — «…» (0 в списке).
   * slots — сколько мест под номера и «…»: 5 на узком экране (вместе со стрелками 7 кнопок по 44 px в одну строку на 360 px),
   * 7 там, где шире. На узком экране в середине длинного списка соседние номера не помещаются — остаются стрелки.
   */
  function pageList(page, pages, slots) {
    var out = [], i;
    if (pages <= slots) { for (i = 1; i <= pages; i++) out.push(i); return out; }
    var side = slots >= 7 ? 1 : 0, edge = slots - 2;
    if (page <= edge - side) { for (i = 1; i <= edge; i++) out.push(i); out.push(0, pages); return out; }
    if (page > pages - (edge - side)) { out.push(1, 0); for (i = pages - edge + 1; i <= pages; i++) out.push(i); return out; }
    out.push(1, 0);
    for (i = page - side; i <= page + side; i++) out.push(i);
    out.push(0, pages);
    return out;
  }
  function pagerHtml(total, page, size) {
    var pages = Math.ceil(total / size);
    if (pages < 2) return '';
    var width = Math.min(window.innerWidth || 360, 720) - 32;
    var from = (page - 1) * size + 1, to = Math.min(total, page * size);
    function arrow(n, off, label, sign) {
      return '<button type="button" class="pager__arrow" data-page="' + n + '" aria-label="' + esc(t(label)) + '"' + (off ? ' disabled' : '') + '>' + sign + '</button>';
    }
    return '<nav class="pager" aria-label="' + esc(t('pgNav')) + '"><p class="pager__range">' + esc(tf('pgRange', { a: from, b: to, n: total })) + '</p>' +
      '<div class="pager__row">' + arrow(page - 1, page <= 1, 'pgPrev', '‹') +
      pageList(page, pages, width >= 9 * 46 ? 7 : 5).map(function (n) {
        return n ? '<button type="button" data-page="' + n + '" aria-label="' + esc(tf('pgPage', { n: n })) + '"' + (n === page ? ' aria-current="page"' : '') + '>' + n + '</button>'
          : '<span class="pager__gap" aria-hidden="true">…</span>';
      }).join('') + arrow(page + 1, page >= pages, 'pgNext', '›') + '</div></nav>';
  }
  /** Прокрутка к началу списка: заголовок списка встаёт сразу под закреплённой панелью поиска и категорий. */
  function scrollToList(head) {
    if (!head) return;
    var tools = document.querySelector('.tools');
    var fixed = tools && state.view === 'catalog' ? tools.getBoundingClientRect().height : 0;
    window.scrollTo(0, Math.max(0, Math.round(head.getBoundingClientRect().top + (window.scrollY || 0) - fixed - 8)));
  }

  /* ---- А4. Подтверждения, архив товаров, удаление категорий и админов ---- */
  /**
   * Подтверждение для заметных и необратимых действий: в заголовке — что произойдёт, на кнопке — точное название
   * («Видалити назавжди Курага», а не «ОК»). o: { title, text, warn, html, ok, danger, run(done) }.
   * run получает done(err): без аргумента — шторка закрывается, с текстом — показывается ошибка и кнопка снова активна.
   */
  function askConfirm(o) {
    state.sheet = { kind: 'confirm', o: o };
    clearTimeout(toastTimer); el.toast.hidden = true; toastAction = null; // старое сообщение не должно закрывать кнопки подтверждения
    renderSheet();
    showSheet(false);
    if (o.lock) { var okb = el.sheet.querySelector('[data-action="cf-ok"]'); if (okb) okb.disabled = true; } // кнопка ждёт отметки в шторке
  }
  function confirmSheetHtml(o) {
    return '<button type="button" class="sheet__close" aria-label="' + esc(t('close')) + '">' + icon('x') + '</button>' +
      '<div class="sheet__grab" aria-hidden="true"></div>' +
      '<div class="sheet__body"><h2 class="sheet__title sheet__title--pad" id="sheetTitle">' + esc(o.title) + '</h2>' +
      (o.text ? '<p class="confirm__text">' + esc(o.text) + '</p>' : '') +
      (o.warn ? '<p class="note note--out">' + esc(o.warn) + '</p>' : '') + (o.html || '') +
      '<p class="form__err" id="cfErr" role="alert" hidden></p></div>' +
      '<div class="sheet__foot sheet__foot--col">' +
      (o.ok ? '<button type="button" class="btn btn--wrap ' + (o.danger ? 'btn--danger' : 'btn--primary') + '" data-action="cf-ok">' + esc(o.ok) + '</button>' : '') +
      '<button type="button" class="btn" data-action="cf-cancel">' + esc(t('cfCancel')) + '</button></div>';
  }
  el.sheet.addEventListener('click', function (e) {
    if (!state.sheet || state.sheet.kind !== 'confirm') return;
    var act = e.target.closest('[data-action]');
    var kind = act ? act.getAttribute('data-action') : '';
    if (kind === 'cf-cancel') { closeSheet(); return; }
    if (kind !== 'cf-ok' || act.disabled) return;
    var mine = state.sheet;
    btnBusy(act, '.sheet__foot');
    mine.o.run(function (err) {
      if (state.sheet !== mine) return; // шторку уже закрыли
      if (!err) { closeSheet(); return; }
      Array.prototype.forEach.call(el.sheet.querySelectorAll('.sheet__foot button'), function (x) { x.disabled = false; });
      btnFree(act);
      haptic('error');
      var box = document.getElementById('cfErr');
      if (box) { box.textContent = err; box.hidden = false; try { box.scrollIntoView({ block: 'nearest' }); } catch (e2) { /* старый браузер */ } } // длинная шторка: ошибка не должна остаться за краем
    });
  });
  /** Текст ошибки по ответу сервера. */
  function apiErr(res, map) {
    var code = res && res.error;
    return t((map && map[code]) || (code === 'no_perm' ? 'admNoPerm' : 'admFail'));
  }
  function isFullAdmin() { return !adm.me || adm.me.role === 'owner' || adm.me.role === 'admin'; }

  /* Архив: «В архів» из карточки товара */
  function askArchive(p) {
    if (!p) return;
    askConfirm({
      title: t('archAskTitle'), text: tf('archAskText', { name: p.ua }), ok: tf('archAskOk', { name: p.ua }),
      run: function (done) {
        api('admin.archive', { id: p.id }).then(function (res) {
          if (!res || !res.ok) { done(apiErr(res)); return; }
          adm.products = (adm.products || []).filter(function (x) { return x.id !== p.id; });
          adm.arch = null;
          if (adm.edit === p.id) adm.edit = '';
          done();
          renderPage(); window.scrollTo(0, 0);
          haptic('success');
          toast(t('archDone'), t('archTitle'), loadArchive);
          catalogSoon();
        }).catch(function () { done(t('admFail')); });
      }
    });
  }

  /* Экран «Архів» */
  function loadArchive() {
    adm.archOpen = true; adm.arch = null; adm.archErr = false; adm.aq = ''; adm.ap = 1;
    adm.edit = '';
    if (state.view !== 'admin') return;
    renderPage(); window.scrollTo(0, 0);
    api('admin.archiveList').then(function (res) {
      if (!res || !res.ok) throw new Error('fail');
      adm.arch = res.items || [];
      if (adm.archOpen) renderPage();
    }).catch(function () { adm.archErr = true; if (adm.archOpen) renderPage(); });
  }
  function archiveItem(id) {
    var found = null;
    (adm.arch || []).forEach(function (p) { if (p.id === id) found = p; });
    return found;
  }
  function archiveHtml() {
    var html = '<p class="label">' + esc(t('archTitle')) + '</p>';
    if (adm.archErr) return html + '<p class="form__err">' + esc(t('admError')) + '</p><button type="button" class="btn btn--block" data-action="adm-arch">' + esc(t('admRefresh')) + '</button>';
    if (!adm.arch) return html + '<div class="skeleton skeleton--row"></div>';
    if (!adm.arch.length) return html + '<p class="state__text adm__msg">' + esc(t('archEmpty')) + '</p>';
    return html + '<p class="info">' + esc(t('archInfo')) + (isFullAdmin() ? '' : ' ' + esc(t('archOnlyFull'))) + '</p>' +
      '<input class="input" id="admAQ" type="search" autocomplete="off" placeholder="' + esc(t('archSearch')) + '" aria-label="' + esc(t('archSearch')) + '" value="' + esc(adm.aq) + '">' +
      '<div id="archList">' + archiveListHtml() + '</div>';
  }
  function archiveListHtml() {
    var q = adm.aq.trim().toLowerCase();
    var list = (adm.arch || []).filter(function (p) { return !q || (p.ua + ' ' + p.ru + ' ' + p.id).toLowerCase().indexOf(q) >= 0; });
    if (!list.length) return '<p class="state__text adm__msg">' + esc(t('admEmpty')) + '</p>';
    adm.ap = clampPage(adm.ap, list.length, PAGE_SIZE);
    var from = (adm.ap - 1) * PAGE_SIZE, full = isFullAdmin();
    return '<ul class="lines">' + list.slice(from, from + PAGE_SIZE).map(function (p) {
      return '<li class="arch"><span class="prod__name">' + esc(p.ua) + '</span>' +
        '<span class="prod__sub">' + esc(p.id) + ' · ' + adminPrice(p) + (p.at ? ' · ' + esc(tf('archSince', { d: p.at })) : '') + (p.by ? ' · ' + esc(p.by) : '') + '</span>' +
        '<div class="arch__acts' + (full ? '' : ' arch__acts--one') + '"><button type="button" class="btn btn--soft" data-arch-restore="' + esc(p.id) + '">' + esc(t('archRestore')) + '</button>' +
        (full ? '<button type="button" class="btn btn--ghost-danger" data-arch-purge="' + esc(p.id) + '">' + esc(t('archPurge')) + '</button>' : '') + '</div></li>';
    }).join('') + '</ul>' + pagerHtml(list.length, adm.ap, PAGE_SIZE);
  }
  function renderArchiveList() {
    var box = document.getElementById('archList');
    if (box) box.innerHTML = archiveListHtml(); else if (state.view === 'admin' && adm.archOpen) renderPage();
  }
  function dropFromArchive(id) {
    adm.arch = (adm.arch || []).filter(function (x) { return x.id !== id; });
    if (state.view === 'admin' && adm.archOpen) { if (adm.arch.length) renderArchiveList(); else renderPage(); }
  }
  /** «Відновити» — действие обратимое, поэтому без вопроса: товар сразу возвращается на витрину. */
  function restoreFromArchive(id, btn) {
    var p = archiveItem(id);
    if (!p || adm.busy) return;
    adm.busy = true; btnBusy(btn, '.arch__acts');
    api('admin.restore', { id: id }).then(function (res) {
      adm.busy = false;
      if (!res || !res.ok) {
        haptic('error'); toast(apiErr(res, { exists: 'archExists' }));
        if (res && res.error === 'not_found') dropFromArchive(id); else renderArchiveList();
        return;
      }
      if (adm.products) adm.products.push(res.product);
      haptic('success');
      toast(tf('archRestored', { name: p.ua }));
      dropFromArchive(id);
      catalogSoon();
    }).catch(function () { adm.busy = false; haptic('error'); toast(t('admFail')); renderArchiveList(); });
  }
  function askPurge(id) {
    var p = archiveItem(id);
    if (!p) return;
    askConfirm({
      title: t('archPurgeTitle'), text: tf('archPurgeText', { name: p.ua, id: p.id }), ok: tf('archPurgeOk', { name: p.ua }), danger: true,
      run: function (done) {
        api('admin.purge', { id: id }).then(function (res) {
          if (!res || !res.ok) { done(apiErr(res, { no_perm: 'archOnlyFull' })); return; }
          done();
          haptic('success');
          toast(tf('archPurged', { name: p.ua }));
          dropFromArchive(id);
        }).catch(function () { done(t('admFail')); });
      }
    });
  }

  /* Удаление категории: пустую — сразу, с товарами — после переноса в другую категорию */
  function askDeleteCategory(btn) {
    var c = adminCat(adm.catEdit);
    if (!c || adm.busy) return;
    if (adm.products) { catConfirm(c, adm.products.filter(function (p) { return p.cat === c.ua; }).length); return; }
    adm.busy = true; btnBusy(btn); // список товаров ещё не загружен — сначала узнаём, сколько товаров в категории
    api('admin.products').then(function (res) {
      adm.busy = false; btnFree(btn);
      if (!res || !res.ok) throw new Error('fail');
      adm.products = res.products || []; adm.cats = res.categories || adm.cats;
      catConfirm(c, adm.products.filter(function (p) { return p.cat === c.ua; }).length);
    }).catch(function () { adm.busy = false; btnFree(btn); toast(t('admFail')); });
  }
  function catConfirm(c, count) {
    var others = (adm.cats || []).filter(function (x) { return x.code !== c.code; });
    var o = { title: t('catDelTitle'), danger: true };
    if (!count) {
      o.text = tf('catDelEmpty', { name: c.ua }); o.ok = tf('catDelOk', { name: c.ua });
    } else if (!others.length) {
      o.text = tf('catDelFull', { name: c.ua, n: count }); o.warn = t('catDelNoOther');
    } else {
      o.text = tf('catDelFull', { name: c.ua, n: count }); o.ok = tf('catDelMoveOk', { name: c.ua });
      o.html = '<div class="field"><label class="label" for="cfMove">' + esc(t('catDelMove')) + '</label><select class="input" id="cfMove">' +
        others.map(function (x) { return '<option value="' + esc(x.code) + '">' + esc(x.ua) + '</option>'; }).join('') + '</select></div>';
    }
    o.run = function (done) {
      var sel = document.getElementById('cfMove');
      api('admin.categoryDelete', { code: c.code, moveTo: count && sel ? sel.value : '' }).then(function (res) {
        if (res && res.error === 'not_empty') { // пока окно было открыто, в категории появились товары
          closeSheet(); catConfirm(c, res.count); return;
        }
        if (!res || !res.ok) { done(apiErr(res)); return; }
        adm.cats = res.categories || [];
        adm.products = null; // категории у товаров изменились
        adm.catEdit = '';
        if (adm.pcat === c.ua) adm.pcat = '';
        done();
        renderPage(); window.scrollTo(0, 0);
        haptic('success');
        toast(res.moved ? tf('catDelMoved', { n: res.moved }) : t('catDelDone'));
        catalogSoon();
      }).catch(function () { done(t('admFail')); });
    };
    askConfirm(o);
  }

  /* Удаление админа */
  function askDeleteAdmin(a) {
    if (!a) return;
    var who = adminTitle(a);
    askConfirm({
      title: t('admDelTitle'), text: tf('admDelText', { name: who }), warn: a.inProps ? t('admDelBoth') : '', ok: tf('admDelOk', { name: who }), danger: true,
      run: function (done) {
        api('admin.adminDelete', { id: a.id }).then(function (res) {
          if (!res || !res.ok) { done(apiErr(res, { owner_only: 'admOwnerOnly', self: 'admSelf', in_props: 'admFromProps' })); return; }
          adm.admins = res.admins || []; adm.invites = res.invites || [];
          adm.admEdit = '';
          done();
          renderPage(); window.scrollTo(0, 0);
          haptic('success');
          toast(t(res.still ? 'admDelStill' : 'admDelDone'));
        }).catch(function () { done(t('admFail')); });
      }
    });
  }

  /* ======================================================================== */
  /* ЭТАП 9, выпуск Б, волна Б1, блок 2: админка удобнее                       */
  /* ======================================================================== */
  /* ---- «Сьогодні»: числа первого экрана ---- */
  var todayAgain = false;
  /** Числа считает сервер (admin.today). Старый бэкенд такого действия не знает — тогда считаем честно по уже загруженным спискам. */
  function fetchToday(force) {
    if (!cfg.API_URL || !inTelegram || adm.todayOld) return;
    if (admFlight.today) { if (force) todayAgain = true; return; }
    admFlight.today = api('admin.today').then(function (res) {
      delete admFlight.today;
      if (res && res.ok && res.today && typeof res.today === 'object') { adm.today = res.today; adm.todayOld = false; }
      else if (res && res.error !== 'forbidden' && res.error !== 'no_perm') adm.todayOld = true;
      if (todayAgain) { todayAgain = false; fetchToday(false); }
      renderToday();
    }, function () { delete admFlight.today; todayAgain = false; });
  }
  function isRealOrder(o) { return !o.test; }
  function todayItems() {
    var out = [];
    function add(key, label, n) { if (typeof n === 'number' && isFinite(n)) out.push({ key: key, label: label, n: n }); }
    if (adm.today && !adm.todayOld) {
      add('new', 'tdNew', adm.today.newOrders); add('ship', 'tdShip', adm.today.toShip);
      add('out', 'tdOut', adm.today.outOfStock); add('price', 'tdPrice', adm.today.noPrice); add('photo', 'tdPhoto', adm.today.noPhoto);
    } else if (adm.todayOld) { // старый бэкенд: только то, что видно в уже загруженных списках
      var os = adm.orders, ps = adm.products;
      if (os && can('st')) {
        add('new', 'tdNew', os.filter(function (o) { return isRealOrder(o) && o.status === 'новий'; }).length);
        add('ship', 'tdShip', os.filter(function (o) { return isRealOrder(o) && o.status === 'підтверджено'; }).length);
      }
      if (ps && can('stock')) add('out', 'tdOut', ps.filter(function (p) { return !p.hidden && !p.stock; }).length);
      if (ps && can('price')) add('price', 'tdPrice', ps.filter(function (p) { return !(p.price > 0); }).length);
      if (ps && can('photo')) add('photo', 'tdPhoto', ps.filter(function (p) { return !p.hidden && !p.img; }).length);
    }
    return out;
  }
  function todayHtml() {
    var items = todayItems();
    if (!items.length) return '';
    return '<section class="today" aria-label="' + esc(t('admToday')) + '"><p class="label">' + esc(t('admToday')) + '</p><div class="today__grid">' + items.map(function (c) {
      return '<button type="button" class="tcard' + (c.n ? '' : ' is-zero') + '" data-today="' + c.key + '"><b class="tcard__n">' + c.n + '</b><span class="tcard__l">' + esc(t(c.label)) + '</span></button>';
    }).join('') + '</div></section>';
  }
  function renderToday() {
    var box = document.getElementById('admToday');
    if (box && state.view === 'admin' && adm.tab === 'orders') box.innerHTML = todayHtml();
  }
  function setOrderFilter(value) {
    adm.filter = value; adm.q = ''; adm.open = '';
    var q = document.getElementById('admQ'); if (q) q.value = '';
    Array.prototype.forEach.call(document.querySelectorAll('#admFilter .chip'), function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-filter') === adm.filter));
    });
    renderAdminList();
  }
  function resetProductFilters() {
    adm.pcat = ''; adm.pq = ''; adm.pp = 1; adm.pvis = false;
    adm.pf = { out: false, hidden: false, nophoto: false, noprice: false };
  }
  /** Нажатие на карточку «Сьогодні»: открывается именно тот список, число из которого на карточке. */
  function goToday(kind) {
    if (kind === 'new' || kind === 'ship') {
      setOrderFilter(kind === 'new' ? 'новий' : 'підтверджено');
      scrollToList(document.getElementById('admFilter'));
      return;
    }
    resetProductFilters();
    if (kind === 'out') { adm.pf.out = true; adm.pvis = true; }
    else if (kind === 'photo') { adm.pf.nophoto = true; adm.pvis = true; }
    else adm.pf.noprice = true;
    adm.tab = 'products'; adm.error = '';
    renderPage(); loadAdmin(false); window.scrollTo(0, 0);
  }

  /* ---- Смена статуса: шторка с точным текстом для клиента ---- */
  function stLabel(code) { var v = ''; STATUS_BTNS.forEach(function (b) { if (b[0] === code) v = b[2]; }); return v; }
  function startStatus(btn) {
    var order = orderById(btn.getAttribute('data-num')), code = btn.getAttribute('data-st');
    if (!order || adm.busy) return;
    adm.busy = true; btnBusy(btn, '.ord__acts'); // кнопка сразу «занята», пока идёт запрос превью
    function release() { adm.busy = false; if (state.view === 'admin') renderAdminList(); }
    function sheet(text, extra) {
      release();
      openStatusSheet(order, code, text, extra);
    }
    if (!adm.canMsg) { sheet('', ''); return; } // старый бэкенд превью не умеет: текст недоступен, подтвердить можно
    api('admin.statusPreview', { num: order.num, code: code }).then(function (res) {
      if (res && res.error === 'no_perm') { release(); haptic('error'); toast(t('admNoPerm')); return; }
      if (res && res.error === 'not_found') { release(); haptic('error'); toast(t('stGone')); return; }
      if (res && res.ok && res.willSend === false) { adm.busy = false; applyStatusDirect(order, code, t('stNoMsg')); return; }
      if (res && res.ok && res.willSend === true) { sheet(String(res.text || ''), res.extra || ''); return; }
      sheet('', '');
    }).catch(function () { sheet('', ''); });
  }
  function openStatusSheet(order, code, text, extra) {
    var html = '<p class="confirm__text">' + esc(tf('stAskText', { num: order.num })) + '</p>' +
      (text ? '<blockquote class="spv__quote" id="stText">' + esc(text) + '</blockquote>' : '<p class="note note--out" id="stText">' + esc(t('stNoPreview')) + '</p>') +
      (extra === 'fop' ? '<p class="info info__muted">' + esc(t('stFop')) + '</p>' : '');
    askConfirm({
      title: tf('stAskTitle', { s: stLabel(code) }), html: html, ok: t('stOk'),
      run: function (done) {
        api('admin.status', { num: order.num, code: code }).then(function (res) {
          if (res && res.error === 'no_perm') { done(t('admNoPerm')); return; }
          if (!res || !res.ok) throw new Error('fail');
          order.status = res.status;
          done();
          haptic('success');
          toast(t('admSaved') + (res.told === false ? '. ' + t('admNotTold') : ''));
          if (state.view === 'admin') renderAdminList();
          fetchToday(true);
        }).catch(function () { done(t('stFail')); });
      }
    });
  }
  /** Клиент сообщения не получит (или шторка не нужна): новый статус виден сразу, при ошибке возвращается прежний. */
  function applyStatusDirect(order, stCode, note) {
    if (adm.busy) return;
    var stWas = order.status, stNext = stLabel(stCode) || stWas;
    adm.busy = true; adm.stPending = { num: order.num, code: stCode };
    order.status = stNext;
    renderAdminList();
    var finished = false, guard = 0;
    // Один раз и всегда: блокировка снимается, даже если отрисовка или тост упали. Сервер не ответил за 45 с — тоже снимается.
    var stDone = function (text, back) {
      if (finished) return;
      finished = true; clearTimeout(guard);
      adm.busy = false; adm.stPending = null;
      if (back) order.status = stWas;
      try {
        if (back) haptic('error');
        toast(text);
        if (state.view === 'admin') renderAdminList();
        fetchToday(true);
      } catch (e) { /* блокировка уже снята */ }
    };
    guard = setTimeout(function () { stDone(t('admStLate'), true); }, 45000);
    api('admin.status', { num: order.num, code: stCode }).then(function (res) {
      if (finished) return;
      if (res && res.error === 'no_perm') { stDone(t('admNoPerm'), true); return; }
      if (!res || !res.ok) throw new Error('fail');
      order.status = res.status;
      stDone(t('admSaved') + (res.told === false ? '. ' + t('admNotTold') : note ? '. ' + note : ''), false);
    }).catch(function () { stDone(t('admStBack'), true); });
  }

  /* ---- «Написати»: шторка с шаблонами ---- */
  var MSG_ERR = { bad_form: 'msgBad', not_found: 'msgNotFound', test_order: 'msgTest', no_chat: 'msgNoChat', rate_limit: 'msgRate', no_perm: 'admNoPerm' };
  var MSG_MAX = 500;
  function tplListHtml(lang) {
    return (adm.replies || []).map(function (r, i) {
      var text = String((lang === 'ru' ? r.ru : r.ua) || r.ua || r.ru || '');
      return text ? '<button type="button" class="btn btn--wrap msg__tpl" data-tpl="' + i + '">' + esc(text) + '</button>' : '';
    }).join('');
  }
  function msgSheetBody(o, lang) {
    var tpl = (adm.replies || []).length
      ? '<div class="msg__tpls"><p class="label">' + esc(t('msgTpl')) + '</p>' +
        '<div class="chips chips--flush chips--wrap" role="group" aria-label="' + esc(t('msgLang')) + '">' + ['ua', 'ru'].map(function (l) {
          return '<button type="button" class="chip" data-tlang="' + l + '" aria-pressed="' + (lang === l) + '">' + l.toUpperCase() + '</button>';
        }).join('') + '</div><div class="msg__list" id="msgTpls">' + tplListHtml(lang) + '</div></div>' : '';
    return tpl + '<div class="field"><label class="label" for="msgText">' + esc(t('msgField')) + '</label>' +
      '<textarea class="input input--area" id="msgText" rows="4" maxlength="' + MSG_MAX + '"></textarea>' +
      '<p class="field__hint" id="msgCnt" aria-live="polite">0 / ' + MSG_MAX + '</p><p class="field__hint">' + esc(t('msgHint')) + '</p></div>' +
      '<button type="button" class="btn btn--block" data-chat="' + esc(chatUrl(o)) + '">' + esc(t('ordTgChat')) + '</button>';
  }
  function openMessageSheet(o) {
    var lang = o.lang === 'ru' ? 'ru' : o.lang === 'ua' ? 'ua' : state.lang; // язык заказа клиента; если сервер его не прислал — язык панели
    adm.msgLang = lang;
    askConfirm({
      title: tf('msgTitle', { num: o.num }), html: msgSheetBody(o, lang), ok: t('msgSend'), msg: o,
      run: function (done) {
        var ta = document.getElementById('msgText'), text = ta ? ta.value.trim() : '';
        if (!text) { done(t('msgEmpty')); return; }
        api('admin.message', { num: o.num, text: text }).then(function (res) {
          if (res && res.ok) {
            if (res.told === false) { done(t('msgNotTold')); return; }
            done(); haptic('success'); toast(t('msgSent'));
            return;
          }
          done(t((res && MSG_ERR[res.error]) || 'msgFail'));
        }).catch(function () { done(t('msgFail')); });
      }
    });
  }
  function msgCount() {
    var ta = document.getElementById('msgText'), c = document.getElementById('msgCnt');
    if (ta && c) c.textContent = ta.value.length + ' / ' + MSG_MAX;
  }
  /** Нажатия внутри шторки «Написати»: язык шаблонов, шаблон, чат в Telegram. */
  function sheetExtraClick(e) {
    if (!state.sheet || !state.sheet.o || !state.sheet.o.msg) return false;
    var chat = e.target.closest('[data-chat]');
    if (chat) {
      var url = chat.getAttribute('data-chat');
      try { tg.openTelegramLink(url); } catch (err) { window.open(url, '_blank'); }
      return true;
    }
    var tl = e.target.closest('[data-tlang]');
    if (tl) {
      adm.msgLang = tl.getAttribute('data-tlang');
      Array.prototype.forEach.call(el.sheet.querySelectorAll('[data-tlang]'), function (b) { b.setAttribute('aria-pressed', String(b === tl)); });
      var box = document.getElementById('msgTpls');
      if (box) box.innerHTML = tplListHtml(adm.msgLang);
      return true;
    }
    var tp = e.target.closest('[data-tpl]');
    if (tp) {
      var r = (adm.replies || [])[Number(tp.getAttribute('data-tpl'))], ta = document.getElementById('msgText');
      if (r && ta) {
        ta.value = String((adm.msgLang === 'ru' ? r.ru : r.ua) || r.ua || r.ru || '').slice(0, MSG_MAX);
        msgCount();
        var err = document.getElementById('cfErr'); if (err) err.hidden = true;
        try { ta.focus({ preventScroll: true }); } catch (x) { /* не страшно */ }
      }
      return true;
    }
    return false;
  }

  /* ---- Копирование адреса ---- */
  function copyAddress(btn) {
    var o = orderById(btn.getAttribute('data-copyaddr')), text = o ? orderAddress(o) : '';
    if (!text || btn.disabled) return;
    var ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.className = 'copybuf';
    document.body.appendChild(ta);
    copyText(text, ta).then(function (ok) {
      if (ta.parentNode) ta.parentNode.removeChild(ta);
      if (!ok) { haptic('error'); toast(t('admLinkFail')); return; }
      haptic('success');
      var was = btn.innerHTML;
      btn.classList.add('is-saved'); btn.disabled = true; btn.innerHTML = icon('check') + esc(t('ordCopied'));
      setTimeout(function () { btn.classList.remove('is-saved'); btn.disabled = false; btn.innerHTML = was; }, 1400);
    });
  }

  /* ---- Быстрая цена в списке товаров ---- */
  function refreshChips() {
    var chips = document.getElementById('admPChips');
    if (chips && adm.tab === 'products') {
      var row = chips.querySelector('.chips'), left = row ? row.scrollLeft : 0;
      chips.innerHTML = productChipsHtml();
      row = chips.querySelector('.chips');
      if (row) row.scrollLeft = left;
    }
  }
  function redrawRow(id) {
    var li = document.querySelector('#admList .prod[data-pid="' + id + '"]'), p = adminProduct(id);
    if (!li || !p) return null;
    var tmp = document.createElement('ul');
    tmp.innerHTML = prodRowHtml(p);
    li.parentNode.replaceChild(tmp.firstChild, li);
    return document.querySelector('#admList .prod[data-pid="' + id + '"]');
  }
  /** «Збережено» на карточке на пару секунд; потом отметка гаснет, а товар, который уже не подходит под фильтр, уходит из списка. */
  function markSaved(id) {
    adm.saved[id] = Date.now();
    setTimeout(clearMarks, SAVED_MS + 60);
  }
  function clearMarks() {
    if (state.view !== 'admin' || adm.tab !== 'products' || adm.loading) return;
    var ids = adminProductList().map(function (p) { return p.id; }), stale = false;
    Array.prototype.forEach.call(document.querySelectorAll('#admList .prod'), function (li) {
      var id = li.getAttribute('data-pid');
      if (adm.saved[id] && Date.now() - adm.saved[id] >= SAVED_MS) {
        li.classList.remove('is-saved');
        var ok = li.querySelector('.prod__ok'); if (ok) ok.hidden = true;
      }
      if (ids.indexOf(id) < 0) stale = true;
    });
    var a = document.activeElement;
    if (stale && !(a && a.hasAttribute && a.hasAttribute('data-qprice'))) renderAdminList();
  }
  function saveQuickPrice(btn) {
    var id = btn.getAttribute('data-qsave'), p = adminProduct(id);
    if (!p || adm.pending['q:' + id]) return;
    var li = btn.closest('.prod'), input = li && li.querySelector('[data-qprice]'), err = li && li.querySelector('.prod__err');
    if (!input) return;
    var n = Number(String(input.value).replace(/\s/g, '').replace(',', '.'));
    if (!(n > 0) || !isFinite(n)) {
      input.setAttribute('aria-invalid', 'true');
      if (err) { err.textContent = t('qpBad'); err.hidden = false; }
      haptic('error');
      return;
    }
    n = Math.round(n * 100) / 100;
    adm.pending['q:' + id] = true;
    btnBusy(btn); input.disabled = true;
    if (err) err.hidden = true;
    api('admin.product', { id: id, patch: { price: n } }).then(function (res) {
      if (!res || !res.ok) throw new Error(res && res.error === 'no_perm' ? 'admNoPerm' : 'qpFail');
      Object.keys(res.product).forEach(function (k) { p[k] = res.product[k]; });
      delete adm.pending['q:' + id]; delete adm.qdraft[id];
      haptic('success'); markSaved(id); catalogSoon(); fetchToday(true);
      if (state.view === 'admin' && adm.tab === 'products') { redrawRow(id); refreshChips(); }
    }).catch(function (e2) {
      delete adm.pending['q:' + id]; delete adm.qdraft[id]; // прежнее значение возвращается в поле
      haptic('error');
      if (state.view !== 'admin' || adm.tab !== 'products') return;
      var row = redrawRow(id), msg = row && row.querySelector('.prod__err');
      if (msg) { msg.textContent = t(e2 && e2.message === 'admNoPerm' ? 'admNoPerm' : 'qpFail'); msg.hidden = false; }
    });
  }

  /* ---- Тексты ---- */
  var I18N_B10 = {
    ua: {
      tdNew: 'Нові замовлення', tdShip: 'Треба відправити', tdOut: 'Немає в наявності', tdPrice: 'Чекають ціну', tdPhoto: 'Без фото',
      ordMore: 'Ще', stChange: 'Змінити статус', ordCall: 'Подзвонити', ordWrite: 'Написати', ordCopy: 'Скопіювати адресу', ordCopied: 'Скопійовано',
      ordTgChat: 'Відкрити чат у Telegram',
      stAskTitle: 'Змінити статус на «{s}»?', stAskText: 'Замовлення {num}. Клієнт отримає таке повідомлення:', stOk: 'Надіслати й змінити статус',
      stNoPreview: 'Текст повідомлення зараз недоступний. Клієнт може отримати повідомлення про зміну статусу.',
      stFop: 'Реквізити для оплати клієнт отримає окремим повідомленням.', stNoMsg: 'Клієнт повідомлення не отримує',
      stFail: 'Не вдалося змінити статус. Статус не змінено — спробуйте ще раз.', stGone: 'Замовлення не знайдено. Натисніть «Оновити».',
      msgTitle: 'Написати клієнту · {num}', msgTpl: 'Готові відповіді', msgLang: 'Мова відповіді', msgField: 'Текст повідомлення', msgSend: 'Надіслати', msgSent: 'Надіслано',
      msgHint: 'Клієнт отримає це від бота PAMIR у чаті з ботом. Можна виправити шаблон перед надсиланням.',
      msgEmpty: 'Напишіть текст повідомлення.', msgBad: 'Повідомлення порожнє або довше за 500 знаків.', msgNotFound: 'Замовлення не знайдено. Закрийте вікно й натисніть «Оновити».',
      msgTest: 'Це тестове замовлення — клієнту нічого не надсилається.', msgNoChat: 'У цього клієнта немає чату з ботом. Зателефонуйте йому або напишіть у Telegram самі.',
      msgRate: 'Забагато повідомлень за годину — спробуйте пізніше', msgFail: 'Не вдалося надіслати. Спробуйте ще раз.',
      msgNotTold: 'Повідомлення не доставлено: клієнт, схоже, заблокував бота. Зателефонуйте йому або напишіть у Telegram.',
      qpSave: 'Зберегти', qpBad: 'Введіть число більше нуля.', qpFail: 'Не вдалося зберегти ціну — повернули попередню.',
      admFltPrice: 'Чекають ціну', admFltOut: 'Немає', admVisOnly: 'Приховані товари тут не показано — так само їх рахує картка «Сьогодні».',
      admPhotoCam: 'Зняти фото', admPhotoGal: 'Вибрати з галереї',
      admEmptyOrders: 'Замовлень поки немає', admEmptyOrdersHint: 'Нові замовлення з’являться тут самі. Щоб перевірити зараз, натисніть «Оновити».',
      admNoMatch: 'Нічого не знайдено', admNoMatchHint: 'Змініть пошук або зніміть фільтри.', admReset: 'Скинути фільтри',
      admEmptyProducts: 'Товарів поки немає', admEmptyProductsHint: 'Товари з’являться тут, щойно їх буде додано в таблицю.',
      admOffline: 'Немає зв’язку — натисніть «Оновити»', admNoPerm: 'Немає прав на цю дію — зверніться до власника',
      setGShop: 'Магазин', setGGifts: 'Подарунки', setGPay: 'Оплата й доставка', setGTexts: 'Тексти', setGRemind: 'Нагадування й розсилки', setGSeason: 'Сезон', setGOther: 'Інше',
      setExample: 'Приклад:', spvTitle: 'Так це бачить покупець', spvEmpty: 'Порожньо — нічого не показується.',
      sh_notice: 'Рядок угорі магазину; покупець може його закрити. Якщо заповнена «Смужка запуску», показується вона. Порожньо — рядка немає.',
      sh_notice_text: 'Смужка угорі магазину; головніша за звичайне оголошення. Покупець може її закрити. Порожньо — смужки немає.',
      sh_gift_from: 'Від якої суми замовлення клієнт отримує подарунок. 0 — подарунка немає. Працює, лише якщо нижче вписано, що саме дарується.',
      sh_gift_text: 'Що саме дарується, коли сума замовлення досягла порогу.',
      sh_loyal_every: 'Кожне N-те замовлення клієнта — з подарунком. 0 — вимкнено, мінімум 2. Працює, лише якщо нижче вписано подарунок.',
      sh_loyal_text: 'Що саме дарується постійному клієнтові.',
      sh_min_order: 'Менше цієї суми оформити замовлення не вийде. 0 — без обмеження.',
      sh_pay_cash: 'Чи пропонувати оплату при отриманні. Хоча б один із двох способів — «при отриманні» або «на картку» — має лишатися увімкненим.',
      sh_pay_card: 'Чи пропонувати оплату переказом на картку. Хоча б один із двох способів — «при отриманні» або «на картку» — має лишатися увімкненим.',
      sh_pay_cod: 'Накладений платіж пропонується лише при доставці Новою поштою.',
      sh_address: 'Адреса самовивозу, яку бачать покупці.', sh_hours: 'Години роботи, які бачать покупці.',
      sh_contact: 'Кому веде кнопка «Написати нам»: @нік або номер телефону. Порожньо — кнопки немає.',
      sh_feature_id: 'ID товару (або кількох через кому) для блоку угорі каталогу. Порожньо — блоку немає.',
      sh_feature_title: 'Заголовок блоку угорі каталогу.', sh_feature_text: 'Текст під заголовком блоку угорі каталогу.',
      sh_father_ids: 'ID товарів через кому для добірки на головній. Порожньо — добірки немає.',
      sh_father_title: 'Заголовок добірки на головній.', sh_father_text: 'Текст під заголовком добірки. Порожньо — без тексту.',
      sh_home_rails_max: 'Скільки стрічок товарів показувати на головній. Від 1 до 8.',
      sh_theme: 'Сезонне оформлення магазину. Порожньо — звичайне; доступні newyear і navruz.',
      sh_theme_until: 'Остання дата, коли діє сезонна тема (включно). Порожньо — без обмеження.',
      sh_confirm: 'Текст, який бот пише клієнтові одразу після прийняття замовлення.',
      sh_reply: 'Готова відповідь для кнопки «Написати» у замовленні: адмін обирає її одним дотиком і може виправити перед надсиланням. Порожньо — шаблону немає.',
      sx_notice_ua: 'Сьогодні не працюємо. Питання — @ваш_нік', sx_notice_ru: 'Сегодня не работаем. Вопросы — @ваш_ник',
      sx_notice_text_ua: 'Магазин щойно відкрився — питання пишіть нам', sx_notice_text_ru: 'Магазин только открылся — вопросы пишите нам',
      sx_gift_from: '500', sx_gift_text_ua: '100 г кураги', sx_gift_text_ru: '100 г кураги',
      sx_loyal_every: '5', sx_loyal_text_ua: 'чурчхела', sx_loyal_text_ru: 'чурчхела', sx_min_order: '300',
      sx_contact: '@ваш_нік', sx_feature_id: 'DRY-039', sx_feature_title_ua: 'Наша курага', sx_feature_title_ru: 'Наша курага',
      sx_feature_text_ua: 'З нашого родинного саду в Ісфарі.', sx_feature_text_ru: 'Из нашего семейного сада в Исфаре.',
      sx_father_ids: 'SPC-001, SPC-004', sx_father_title_ua: 'Спеції від батька', sx_father_title_ru: 'Специи от отца',
      sx_father_text_ua: 'Ці суміші батько збирає сам.', sx_father_text_ru: 'Эти смеси отец собирает сам.',
      sx_home_rails_max: '3', sx_theme: 'newyear', sx_theme_until: '10.01.2027',
      sx_confirm_ua: 'Ми підтвердимо наявність і напишемо вам сюди.', sx_confirm_ru: 'Мы подтвердим наличие и напишем вам сюда.',
      sx_reply_ua: 'Замовлення зібрано, відправимо сьогодні.', sx_reply_ru: 'Заказ собран, отправим сегодня.'
    },
    ru: {
      tdNew: 'Новые заказы', tdShip: 'Надо отправить', tdOut: 'Нет в наличии', tdPrice: 'Ждут цену', tdPhoto: 'Без фото',
      ordMore: 'Ещё', stChange: 'Сменить статус', ordCall: 'Позвонить', ordWrite: 'Написать', ordCopy: 'Скопировать адрес', ordCopied: 'Скопировано',
      ordTgChat: 'Открыть чат в Telegram',
      stAskTitle: 'Сменить статус на «{s}»?', stAskText: 'Заказ {num}. Клиент получит такое сообщение:', stOk: 'Отправить и сменить статус',
      stNoPreview: 'Текст сообщения сейчас недоступен. Клиент может получить сообщение о смене статуса.',
      stFop: 'Реквизиты для оплаты клиент получит отдельным сообщением.', stNoMsg: 'Клиент сообщение не получает',
      stFail: 'Не удалось сменить статус. Статус не изменён — попробуйте ещё раз.', stGone: 'Заказ не найден. Нажмите «Обновить».',
      msgTitle: 'Написать клиенту · {num}', msgTpl: 'Готовые ответы', msgLang: 'Язык ответа', msgField: 'Текст сообщения', msgSend: 'Отправить', msgSent: 'Отправлено',
      msgHint: 'Клиент получит это от бота PAMIR в чате с ботом. Шаблон можно поправить перед отправкой.',
      msgEmpty: 'Напишите текст сообщения.', msgBad: 'Сообщение пустое или длиннее 500 знаков.', msgNotFound: 'Заказ не найден. Закройте окно и нажмите «Обновить».',
      msgTest: 'Это тестовый заказ — клиенту ничего не отправляется.', msgNoChat: 'У этого клиента нет чата с ботом. Позвоните ему или напишите в Telegram сами.',
      msgRate: 'Слишком много сообщений за час — попробуйте позже', msgFail: 'Не удалось отправить. Попробуйте ещё раз.',
      msgNotTold: 'Сообщение не доставлено: клиент, похоже, заблокировал бота. Позвоните ему или напишите в Telegram.',
      qpSave: 'Сохранить', qpBad: 'Введите число больше нуля.', qpFail: 'Не удалось сохранить цену — вернули прежнюю.',
      admFltPrice: 'Ждут цену', admFltOut: 'Нет', admVisOnly: 'Скрытые товары здесь не показаны — так же их считает карточка «Сегодня».',
      admPhotoCam: 'Снять фото', admPhotoGal: 'Выбрать из галереи',
      admEmptyOrders: 'Заказов пока нет', admEmptyOrdersHint: 'Новые заказы появятся здесь сами. Чтобы проверить сейчас, нажмите «Обновить».',
      admNoMatch: 'Ничего не найдено', admNoMatchHint: 'Измените поиск или снимите фильтры.', admReset: 'Сбросить фильтры',
      admEmptyProducts: 'Товаров пока нет', admEmptyProductsHint: 'Товары появятся здесь, как только их добавят в таблицу.',
      admOffline: 'Нет связи — нажмите «Обновить»', admNoPerm: 'Нет прав на это действие — обратитесь к владельцу',
      setGShop: 'Магазин', setGGifts: 'Подарки', setGPay: 'Оплата и доставка', setGTexts: 'Тексты', setGRemind: 'Напоминания и рассылки', setGSeason: 'Сезон', setGOther: 'Прочее',
      setExample: 'Пример:', spvTitle: 'Так это видит покупатель', spvEmpty: 'Пусто — ничего не показывается.',
      sh_notice: 'Строка вверху магазина; покупатель может её закрыть. Если заполнена «Полоска запуска», показывается она. Пусто — строки нет.',
      sh_notice_text: 'Полоска вверху магазина; главнее обычного объявления. Покупатель может её закрыть. Пусто — полоски нет.',
      sh_gift_from: 'С какой суммы заказа клиент получает подарок. 0 — подарка нет. Работает, только если ниже вписано, что именно дарится.',
      sh_gift_text: 'Что именно дарится, когда сумма заказа достигла порога.',
      sh_loyal_every: 'Каждый N-й заказ клиента — с подарком. 0 — выключено, минимум 2. Работает, только если ниже вписан подарок.',
      sh_loyal_text: 'Что именно дарится постоянному клиенту.',
      sh_min_order: 'Меньше этой суммы оформить заказ не получится. 0 — без ограничения.',
      sh_pay_cash: 'Предлагать ли оплату при получении. Хотя бы один из двух способов — «при получении» или «на карту» — должен остаться включённым.',
      sh_pay_card: 'Предлагать ли оплату переводом на карту. Хотя бы один из двух способов — «при получении» или «на карту» — должен остаться включённым.',
      sh_pay_cod: 'Наложенный платёж предлагается только при доставке Новой почтой.',
      sh_address: 'Адрес самовывоза, который видят покупатели.', sh_hours: 'Часы работы, которые видят покупатели.',
      sh_contact: 'Куда ведёт кнопка «Написать нам»: @ник или номер телефона. Пусто — кнопки нет.',
      sh_feature_id: 'ID товара (или нескольких через запятую) для блока вверху каталога. Пусто — блока нет.',
      sh_feature_title: 'Заголовок блока вверху каталога.', sh_feature_text: 'Текст под заголовком блока вверху каталога.',
      sh_father_ids: 'ID товаров через запятую для подборки на главной. Пусто — подборки нет.',
      sh_father_title: 'Заголовок подборки на главной.', sh_father_text: 'Текст под заголовком подборки. Пусто — без текста.',
      sh_home_rails_max: 'Сколько лент товаров показывать на главной. От 1 до 8.',
      sh_theme: 'Сезонное оформление магазина. Пусто — обычное; доступны newyear и navruz.',
      sh_theme_until: 'Последняя дата, когда действует сезонная тема (включительно). Пусто — без ограничения.',
      sh_confirm: 'Текст, который бот пишет клиенту сразу после принятия заказа.',
      sh_reply: 'Готовый ответ для кнопки «Написать» в заказе: админ выбирает его одним касанием и может поправить перед отправкой. Пусто — шаблона нет.'
    }
  };
  ['ua', 'ru'].forEach(function (lang) {
    Object.keys(I18N_B10[lang]).forEach(function (k) { I18N[lang][k] = I18N_B10[lang][k]; });
  });

  /* Тексты выпуска Б, блок 3: Новый год, подпись к подарку, повтор заказа, пояснения настроек сезона. */
  var I18N_B3 = {
    ua: {
      nyGiftsTitle: 'Подарунки до свят', fGiftNote: 'Підпис до подарунка', giftNotePh: 'Наприклад: Мамі від Олени', giftNoteCount: '{n} / 120',
      errSendRetry: 'Не вдалося надіслати — спробуйте ще раз', retryOrder: 'Спробувати ще раз',
      dupChanged: 'Попереднє замовлення {n} уже прийняте. Зміни, зроблені після цього (у кошику чи в параметрах замовлення, наприклад «Якщо товару немає» або місто), до нього не потрапили. Щоб замовити ще — приберіть зайве з кошика й надішліть решту окремим замовленням. Щоб змінити те замовлення — напишіть нам.',
      dupChangedNoNum: 'Попереднє замовлення вже прийняте. Зміни, зроблені після цього (у кошику чи в параметрах замовлення, наприклад «Якщо товару немає» або місто), до нього не потрапили. Щоб замовити ще — приберіть зайве з кошика й надішліть решту окремим замовленням. Щоб змінити те замовлення — напишіть нам.',
      sendAsNew: 'Надіслати кошик як нове замовлення', dupEditCart: 'Змінити кошик', dupWrite: 'Напишіть нам',
      sendAsNewAsk: 'У кошику можуть бути вже замовлені товари. Надіслати все як нове замовлення?', sendAsNewOk: 'Надіслати все',
      sh_theme: 'Сезонне оформлення магазину. Порожньо — звичайне; доступні newyear (гірлянда, святкова добірка, рядок про строки) і navruz.',
      sh_theme_until: 'Остання дата, коли діє сезонна тема (включно); після неї тема вимикається сама. Порожньо — без обмеження.',
      sh_ny_snow: 'Падаючий сніг на новорічній темі. Вимкнено за замовчуванням; не заважає натисканню кнопок і не показується тим, у кого на телефоні вимкнено анімацію.',
      sh_ny_ids: 'ID товарів через кому для добірки «Подарунки до свят» — вона стоїть першою. Порожньо — добірки немає. Працює лише при темі newyear.',
      sh_ny_order_until: 'Рядок про строк біля святкової добірки, у кошику й при оформленні. Порожньо — рядка немає. Працює лише при темі newyear.',
      sh_gift_note: 'Поле «Підпис до подарунка» (до 120 знаків) при оформленні; текст приходить вам у замовленні.',
      sh_home_rails_max: 'Скільки стрічок товарів показувати на головній (від 1 до 8); решта — рядком «Ще». Святкова добірка сюди не входить. Порожньо — 3.',
      sx_ny_ids: 'DRY-039, SWT-001',
      sh_bot_short: 'Короткий опис бота (до 120 знаків): видно в профілі бота. У Telegram потрапляє, коли в таблиці обрано пункт меню PAMIR → «Оновити опис бота». Порожньо — цей мовний варіант пропускається.',
      sh_bot_desc: 'Повний опис бота (до 512 знаків): видно в чаті з ботом, поки людина ще не натиснула «Почати». У Telegram потрапляє тим самим пунктом меню «Оновити опис бота». Порожньо — пропускається.',
      sh_greeting: 'Перше повідомлення бота клієнтові, який ще не замовляв, після команди /start. {name} підставляє ім’я клієнта з Telegram. Нові рядки зберігаються.',
      sh_greeting_back: 'Те саме для клієнта, який уже мав справжнє замовлення. До повідомлення додається кнопка «Повторити звичне». {name} — ім’я клієнта.',
      sh_welcome_photo: 'Картинка над привітанням бота: посилання https://… або file_id (надішліть фото боту — він відповість кодом). Порожньо — стандартна картинка магазину.',
      sh_welcome_video_note: 'Відеокружок, який бот надсилає перед привітанням: лише file_id (надішліть кружок боту — він відповість кодом). Порожньо — без кружка.',
      sh_biz_soon: 'Текст, який бот показує, коли натиснути «Для бізнесу (опт)». Під текстом — кнопки заявки й зв’язку. Оптовикам замість нього одразу надсилається прайс.',
      sh_remind_days: 'Через скільки днів після виконаного замовлення бот раз нагадає, що його можна повторити, якщо клієнт нічого більше не замовив. 0 — вимкнено; менше 7 теж не працює.',
      sh_remind_text: 'Текст цього нагадування; під ним кнопки «Повторити замовлення» та «Більше не нагадувати». Працює, лише якщо вище вказано кількість днів.',
      sh_low_stock: 'Коли на складі лишилося не більше стільки штук, на товарі з’являється «Залишилось N шт». Для вагових товарів поріг власний — 2 кг. Порожньо чи 0 — стандартне значення.',
      sh_fresh_days: 'Скільки днів після дати з колонки «Свіжа поставка» (у таблиці товарів) на товарі горить бейдж «Свіжа поставка». 0 — бейдж вимкнено.',
      sh_review_days: 'Через скільки днів після статусу «виконано» бот попросить клієнта оцінити замовлення (один раз на замовлення). 0 — не просити.',
      sh_cart_remind_hours: 'Через скільки годин бот нагадає про кошик, який лежить без замовлення (одне нагадування на кошик, не частіше разу на 7 днів одній людині). 0 — вимкнено.',
      sh_mail_every_days: 'Одній людині розсилки приходять не частіше, ніж раз на стільки днів; решту при запуску пропускаємо. 0 — без обмеження.',
      sh_story_title: 'Заголовок сторінки «Від саду до столу» в магазині.',
      sh_story_text: 'Текст сторінки «Від саду до столу»; кожен абзац — з нового рядка. Порожньо в обох мовах — сторінки немає.',
      sh_story_photos: 'Фото для сторінки «Від саду до столу»: посилання https://…, кожне з нового рядка, не більше 8. Порожньо — без фото.',
      sh_referral_on: 'Програма «Пригости друга»: друг, що прийшов за посиланням, отримує пробник до першого замовлення, а той, хто запросив, — до наступного. Працює, лише якщо нижче вписано пробник.',
      sh_referral_gift: 'Який пробник дарується (за пробник гроші не беруться, сума замовлення не змінюється). Порожньо — програма вимкнена.',
      sh_referral_min_order: 'Від якої суми першого замовлення друга дарується пробник, ₴. 0 — без обмеження.',
      sx_bot_short_ua: 'Горіхи, сухофрукти та спеції. Питання — @ваш_нік',
      sx_bot_short_ru: 'Орехи, сухофрукты и специи. Вопросы — @ваш_ник',
      sx_bot_desc_ua: 'Родинна крамниця: горіхи, сухофрукти, спеції. Відкрийте магазин, зберіть кошик — підтвердимо замовлення тут.',
      sx_bot_desc_ru: 'Семейная лавка: орехи, сухофрукты, специи. Откройте магазин, соберите корзину — подтвердим заказ здесь.',
      sx_greeting_ua: 'Вітаємо, {name}! Відкрийте магазин і зберіть кошик.',
      sx_greeting_ru: 'Здравствуйте, {name}! Откройте магазин и соберите корзину.',
      sx_greeting_back_ua: 'З поверненням, {name}! Звичне замовлення можна повторити в один дотик.',
      sx_greeting_back_ru: 'С возвращением, {name}! Привычный заказ можно повторить в одно касание.',
      sx_welcome_photo: 'https://example.com/photo.jpg',
      sx_welcome_video_note: 'DQACAgIAAxk… (код від бота)',
      sx_biz_soon_ua: 'Працюємо з кафе й магазинами. Заповніть заявку — відповімо тут.',
      sx_biz_soon_ru: 'Работаем с кафе и магазинами. Заполните заявку — ответим здесь.',
      sx_remind_days: '30',
      sx_remind_text_ua: 'Вітаємо! Попереднє замовлення можна повторити в один дотик.',
      sx_remind_text_ru: 'Здравствуйте! Прошлый заказ можно повторить в одно касание.',
      sx_low_stock: '5',
      sx_fresh_days: '14',
      sx_review_days: '2',
      sx_cart_remind_hours: '3',
      sx_mail_every_days: '7',
      sx_story_title_ua: 'Від саду до столу',
      sx_story_title_ru: 'От сада до стола',
      sx_story_text_ua: 'Перший абзац.\nДругий абзац — з нового рядка.',
      sx_story_text_ru: 'Первый абзац.\nВторой абзац — с новой строки.',
      sx_story_photos: 'https://example.com/garden-1.jpg',
      sx_referral_on: '1',
      sx_referral_gift_ua: '50 г кураги',
      sx_referral_gift_ru: '50 г кураги',
      sx_referral_min_order: '300',
      sx_ny_order_until_ua: 'Замовлення до 26.12 відправимо до свята', sx_ny_order_until_ru: 'Заказы до 26.12 отправим к празднику'
    },
    ru: {
      nyGiftsTitle: 'Подарки к праздникам', fGiftNote: 'Подпись к подарку', giftNotePh: 'Например: Маме от Елены', giftNoteCount: '{n} / 120',
      errSendRetry: 'Не удалось отправить — попробуйте ещё раз', retryOrder: 'Повторить отправку',
      sh_bot_short: 'Короткое описание бота (до 120 знаков): видно в профиле бота. В Telegram попадает, когда в таблице выбран пункт меню PAMIR → «Оновити опис бота». Пусто — этот языковой вариант пропускается.',
      sh_bot_desc: 'Полное описание бота (до 512 знаков): видно в чате с ботом, пока человек ещё не нажал «Начать». В Telegram попадает тем же пунктом меню «Оновити опис бота». Пусто — пропускается.',
      sh_greeting: 'Первое сообщение бота клиенту, который ещё не заказывал, после команды /start. {name} подставляет имя клиента из Telegram. Переносы строк сохраняются.',
      sh_greeting_back: 'То же для клиента, у которого уже был настоящий заказ. К сообщению добавляется кнопка «Повторить привычное». {name} — имя клиента.',
      sh_welcome_photo: 'Картинка над приветствием бота: ссылка https://… или file_id (отправьте фото боту — он ответит кодом). Пусто — стандартная картинка магазина.',
      sh_welcome_video_note: 'Видеокружок, который бот отправляет перед приветствием: только file_id (отправьте кружок боту — он ответит кодом). Пусто — без кружка.',
      sh_biz_soon: 'Текст, который бот показывает при нажатии «Для бизнеса (опт)». Под текстом — кнопки заявки и связи. Оптовикам вместо него сразу отправляется прайс.',
      sh_remind_days: 'Через сколько дней после выполненного заказа бот один раз напомнит, что его можно повторить, если клиент больше ничего не заказывал. 0 — выключено; меньше 7 тоже не работает.',
      sh_remind_text: 'Текст этого напоминания; под ним кнопки «Повторить заказ» и «Больше не напоминать». Работает, только если выше указано число дней.',
      sh_low_stock: 'Когда на складе осталось не больше стольких штук, на товаре появляется «Осталось N шт». Для весовых товаров порог свой — 2 кг. Пусто или 0 — стандартное значение.',
      sh_fresh_days: 'Сколько дней после даты из колонки «Свіжа поставка» (в таблице товаров) на товаре горит бейдж «Свежая поставка». 0 — бейдж выключен.',
      sh_review_days: 'Через сколько дней после статуса «виконано» бот попросит клиента оценить заказ (один раз на заказ). 0 — не просить.',
      sh_cart_remind_hours: 'Через сколько часов бот напомнит о корзине, которая лежит без заказа (одно напоминание на корзину, одному человеку не чаще раза в 7 дней). 0 — выключено.',
      sh_mail_every_days: 'Одному человеку рассылки приходят не чаще, чем раз в столько дней; остальных при запуске пропускаем. 0 — без ограничения.',
      sh_story_title: 'Заголовок страницы «От сада до стола» в магазине.',
      sh_story_text: 'Текст страницы «От сада до стола»; каждый абзац — с новой строки. Пусто на обоих языках — страницы нет.',
      sh_story_photos: 'Фото для страницы «От сада до стола»: ссылки https://…, каждая с новой строки, не больше 8. Пусто — без фото.',
      sh_referral_on: 'Программа «Угости друга»: друг, пришедший по ссылке, получает пробник к первому заказу, а пригласивший — к следующему. Работает, только если ниже вписан пробник.',
      sh_referral_gift: 'Какой пробник дарится (за пробник деньги не берутся, сумма заказа не меняется). Пусто — программа выключена.',
      sh_referral_min_order: 'От какой суммы первого заказа друга дарится пробник, ₴. 0 — без ограничения.',
      dupChanged: 'Предыдущий заказ {n} уже принят. Изменения, сделанные после этого (в корзине или в параметрах заказа, например «Если товара нет» или город), в него не попали. Чтобы заказать ещё — уберите лишнее из корзины и отправьте остальное отдельным заказом. Чтобы изменить тот заказ — напишите нам.',
      dupChangedNoNum: 'Предыдущий заказ уже принят. Изменения, сделанные после этого (в корзине или в параметрах заказа, например «Если товара нет» или город), в него не попали. Чтобы заказать ещё — уберите лишнее из корзины и отправьте остальное отдельным заказом. Чтобы изменить тот заказ — напишите нам.',
      sendAsNew: 'Отправить корзину как новый заказ', dupEditCart: 'Изменить корзину', dupWrite: 'Напишите нам',
      sendAsNewAsk: 'В корзине могут быть уже заказанные товары. Отправить всё как новый заказ?', sendAsNewOk: 'Отправить всё',
      sh_theme: 'Сезонное оформление магазина. Пусто — обычное; доступны newyear (гирлянда, праздничная подборка, строка о сроках) и navruz.',
      sh_theme_until: 'Последняя дата, когда действует сезонная тема (включительно); после неё тема выключается сама. Пусто — без ограничения.',
      sh_ny_snow: 'Падающий снег на новогодней теме. По умолчанию выключен; не мешает нажимать кнопки и не показывается тем, у кого на телефоне отключена анимация.',
      sh_ny_ids: 'ID товаров через запятую для подборки «Подарки к праздникам» — она стоит первой. Пусто — подборки нет. Работает только при теме newyear.',
      sh_ny_order_until: 'Строка о сроке рядом с праздничной подборкой, в корзине и при оформлении. Пусто — строки нет. Работает только при теме newyear.',
      sh_gift_note: 'Поле «Подпись к подарку» (до 120 знаков) при оформлении; текст приходит вам в заказе.',
      sh_home_rails_max: 'Сколько лент товаров показывать на главной (от 1 до 8); остальные — строкой «Ещё». Праздничная подборка сюда не входит. Пусто — 3.'
    }
  };
  ['ua', 'ru'].forEach(function (lang) {
    Object.keys(I18N_B3[lang]).forEach(function (k) { I18N[lang][k] = I18N_B3[lang][k]; });
  });

  /* Выпуск Б1: источники, напоминания о корзине, новые настройки. */
  var I18N_B4 = {
    ua: {
      admSources: 'Джерела (QR)', admSrcTag: 'Мітка', admSrcOpen: 'Відкр. 7 / 14 дн.', admSrcOrd: 'Зам. 7 / 14 дн.',
      admCartSent: 'Нагадувань про кошик надіслано за 30 днів', admCartMuted: 'Вимкнули нагадування про кошик за 30 днів',
      sh_src_list: 'Дозволені мітки джерел через кому (QR-коди, вкладиші). Мітки не з цього списку не враховуються. Порожньо — qr1, qr2, insert.',
      sh_cart_mute_days: 'На скільки днів кнопка «Не нагадувати» ставить нагадування про кошик на паузу. Порожньо — 30.',
      sx_src_list: 'qr1, qr2, insert', sx_cart_mute_days: '30'
    },
    ru: {
      admSources: 'Источники (QR)', admSrcTag: 'Метка', admSrcOpen: 'Откр. 7 / 14 дн.', admSrcOrd: 'Зак. 7 / 14 дн.',
      admCartSent: 'Напоминаний о корзине отправлено за 30 дней', admCartMuted: 'Отключили напоминания о корзине за 30 дней',
      sh_src_list: 'Разрешённые метки источников через запятую (QR-коды, вкладыши). Метки не из этого списка не учитываются. Пусто — qr1, qr2, insert.',
      sh_cart_mute_days: 'На сколько дней кнопка «Не напоминать» ставит напоминания о корзине на паузу. Пусто — 30.'
    }
  };
  ['ua', 'ru'].forEach(function (lang) {
    Object.keys(I18N_B4[lang]).forEach(function (k) { I18N[lang][k] = I18N_B4[lang][k]; });
  });

  /* Волна Б2, блоки 2–3: наборы, подсказка в корзине, «Якщо товару немає», повтор по ссылке, поиск, настройки. */
  var I18N_B5 = {
    ua: {
      setComp: 'Склад набору', setSep: 'Окремо {a} · набором {b}',
      hintAdd: 'Додати',
      ifoTitle: 'Якщо товару немає', ifoCall: 'Зателефонуйте мені', ifoReplace: 'Замініть схожим', ifoRemove: 'Приберіть із замовлення',
      repeatSkip: 'Немає в наявності, не додано: {list}.',
      admZero: 'Шукали й не знайшли за 30 днів',
      sh_hint_tag: 'Підказка в кошику: тег товару (колонка «Теги»), при якому підказка з’являється. Порожньо — підказки немає.',
      sh_hint_id: 'Підказка в кошику: ID товару, який пропонуємо додати. Він має бути на вітрині й у наявності. Порожньо — підказки немає.',
      sh_hint_text: 'Текст підказки в кошику. {ціна} замінюється ціною товару з таблиці. Порожньо — підказки немає.',
      sh_followup1_days: 'Через скільки днів після статусу «Виконано» бот спитає «Як вам замовлення?». Рекомендуємо 3; поки увімкнено, окреме прохання оцінити замовлення не надсилається. 0 — вимкнено.',
      sh_followup2_days: 'Через скільки днів після статусу «Виконано» бот надішле рецепт до купленого й кнопку «Повторити замовлення». Рекомендуємо 21; поки увімкнено, старе нагадування не надсилається. 0 — вимкнено.',
      sh_followup2_text: 'Короткий текст другого повідомлення, коли до купленого немає рецепта. Порожньо й рецепта немає — повідомлення не надсилається.',
      sh_digest_hour: 'О котрій годині (0–23, за часом таблиці) адміни з правом «Статистика» отримують ранкове зведення. Порожньо — зведення вимкнено.',
      sh_np_track_hours: 'Раз на скільки годин перевіряти, чи посилка Нової пошти прибула у відділення, і писати про це клієнтові. Рекомендуємо 3; 0 — вимкнено. Працює лише з ключем Нової пошти.',
      sx_hint_tag: 'для плову', sx_hint_id: 'SET-001',
      sx_hint_text_ua: 'До плову: набір спецій від батька — {ціна}', sx_hint_text_ru: 'К плову: набор специй от отца — {цена}',
      sx_followup1_days: '3', sx_followup2_days: '21', sx_digest_hour: '9', sx_np_track_hours: '3',
      sx_followup2_text_ua: 'Вітаємо! Запаси горіхів і сухофруктів, мабуть, закінчуються. Попереднє замовлення можна повторити в один дотик.',
      sx_followup2_text_ru: 'Здравствуйте! Запасы орехов и сухофруктов, наверное, заканчиваются. Прошлый заказ можно повторить в одно касание.'
    },
    ru: {
      setComp: 'Состав набора', setSep: 'Отдельно {a} · набором {b}',
      hintAdd: 'Добавить',
      ifoTitle: 'Если товара нет', ifoCall: 'Позвоните мне', ifoReplace: 'Замените похожим', ifoRemove: 'Уберите из заказа',
      repeatSkip: 'Нет в наличии, не добавлено: {list}.',
      admZero: 'Искали и не нашли за 30 дней',
      sh_hint_tag: 'Подсказка в корзине: тег товара (колонка «Теги»), при котором подсказка появляется. Пусто — подсказки нет.',
      sh_hint_id: 'Подсказка в корзине: ID товара, который предлагаем добавить. Он должен быть на витрине и в наличии. Пусто — подсказки нет.',
      sh_hint_text: 'Текст подсказки в корзине. {цена} заменяется ценой товара из таблицы. Пусто — подсказки нет.',
      sh_followup1_days: 'Через сколько дней после статуса «Виконано» бот спросит «Как вам заказ?». Рекомендуем 3; пока включено, отдельная просьба оценить заказ не отправляется. 0 — выключено.',
      sh_followup2_days: 'Через сколько дней после статуса «Виконано» бот пришлёт рецепт к купленному и кнопку «Повторить заказ». Рекомендуем 21; пока включено, старое напоминание не отправляется. 0 — выключено.',
      sh_followup2_text: 'Короткий текст второго сообщения, когда к купленному нет рецепта. Пусто и рецепта нет — сообщение не отправляется.',
      sh_digest_hour: 'В котором часу (0–23, по времени таблицы) админы с правом «Статистика» получают утреннюю сводку. Пусто — сводка выключена.',
      sh_np_track_hours: 'Раз в сколько часов проверять, прибыла ли посылка Новой почты в отделение, и писать об этом клиенту. Рекомендуем 3; 0 — выключено. Работает только с ключом Новой почты.'
    }
  };
  ['ua', 'ru'].forEach(function (lang) {
    Object.keys(I18N_B5[lang]).forEach(function (k) { I18N[lang][k] = I18N_B5[lang][k]; });
  });

  /* Волна Б2, блок 4: Нова пошта — стоимость доставки и «Створити ТТН». */
  var I18N_B6 = {
    ua: {
      npCost: '≈ {n} за тарифом Нової пошти', npCostNote: 'У суму замовлення не входить. Точну суму рахує перевізник.',
      ttnMake: 'Створити ТТН', ttnMkTitle: 'Створити накладну Нової пошти', ttnMkErrTitle: 'Накладну не створено',
      ttnMkManual: 'Можна створити ТТН вручну в кабінеті Нової пошти й ввести номер у поле «Номер ТТН» у замовленні.',
      ttnMkFail: 'Не вдалося створити накладну. Спробуйте пізніше або введіть ТТН вручну.',
      ttnPayer: 'Доставку оплачує', ttnPayerRecv: 'отримувач', setOff: 'Зараз вимкнено.', ttnRecv: 'Отримувач', ttnPhone: 'Телефон', ttnCity: 'Місто', ttnBranchW: 'Відділення', ttnBranchP: 'Поштомат', ttnCod: 'Накладений платіж', ttnNoCod: 'без накладеного платежу',
      ttnWeight: 'Вага посилки, г', ttnWeightHint: 'Від {a} до {b} г', ttnWeightAsk: 'Вагу в замовленні не збережено: вкажіть її.',
      ttnName: 'Прізвище та ім’я отримувача', ttnNameHint: 'У замовленні вказано не повне ім’я. Нова пошта вимагає прізвище та ім’я.',
      ttnDesc: 'Опис вантажу', ttnCreate: 'Створити накладну',
      ttnBadW: 'Вкажіть вагу від {a} до {b} г', ttnBadName: 'Вкажіть прізвище та ім’я (два-три слова)',
      ttnMade: 'Накладну створено: {n}.', ttnTold: 'Клієнту надіслано номер.',
      ttnCityDiff: 'Місто в замовленні («{a}») не збігається з містом Нової пошти («{b}»). Перевірте перед створенням.', ttnCityOk: 'Місто правильне',
      ttnSaveFailed: 'Накладну створено: {n}. Номер не записався в таблицю — впишіть його вручну.', ttnSaveFailedNoNum: 'Накладну, можливо, створено, але номер не записався в таблицю. Перевірте кабінет Нової пошти й впишіть номер вручну.',
      ttnBusy: 'Перевірте кабінет Нової пошти: накладну могло бути створено. Не створюйте її повторно зараз.', ttnUnknown: 'Відповідь Нової пошти не отримано. Перевірте кабінет Нової пошти й не створюйте накладну повторно зараз.', ttnMadeTitle: 'Накладну створено',
      ttnDimW: 'Ширина, см', ttnDimL: 'Довжина, см', ttnDimH: 'Висота, см', ttnDimHint: 'Необов’язково. Якщо заповнюєте — усі три, від 1 до 120 см.',
      ttnDimPart: 'Заповніть усі три розміри або очистіть усі.', ttnBadDims: 'Розміри — числа від 1 до 120 см',
      ttnQuiet: 'Пробна накладна: не надсилати номер клієнту', ttnQuietDone: 'Клієнту номер не надсилали.', ttnQuietNote: 'Пробну можна видалити з панелі протягом 24 годин. Справжню — лише в кабінеті Нової пошти.',
      ttnStep1: 'Не вдалося створити отримувача в Новій пошті', ttnStep2: 'Не вдалося створити накладну',
      ttnDel: 'Видалити накладну', ttnDelTitle: 'Видалити накладну', ttnDelText: 'Пробну накладну № {n} буде видалено в Новій пошті, номер у замовленні — стерто. Клієнту нічого не надсилається.',
      ttnDelDone: 'Накладну видалено. Номер у замовленні стерто.', ttnDelErrTitle: 'Накладну не видалено',
      ttnDelPartial: 'У Новій пошті накладну видалено, але номер у замовленні лишився. Зітріть номер у колонці „ТТН“ цього замовлення; інші комірки не чіпайте.',
      ttnDelInfoTitle: 'Номер не змінено', ttnTrial: 'пробна',
      ttnLast: 'Прізвище', ttnFirst: 'Ім’я', ttnMiddle: 'По батькові (необов’язково)',
      ttnNameCheck: 'Перевірте: покупці часто пишуть спочатку ім’я. Якщо навпаки — поміняйте.', ttnSwap: 'Поміняти місцями',
      ttnNameShort: 'Прізвище та ім’я — не менше 2 знаків кожне',
      ttnDimReq: 'Обов’язково: ширина, довжина й висота, см (від 1 до 120).', ttnDimMin: 'Мінімум, наприклад, 10×10×4 см.', ttnDimNeed: 'Заповніть ширину, довжину й висоту.',
      ttnBranchWrote: 'Покупець написав', ttnBranchFound: 'Знайдено в Новій пошті', ttnWhGuess: 'Номер відділення взято з тексту покупця — перевірте.',
      ttnQuietWarn: 'Сама Нова пошта може надіслати отримувачу SMS або сповіщення — пробну робіть лише на власне замовлення.',
      admStLate: 'Сервер не відповів. Оновіть список замовлень і перевірте статус.'
    },
    ru: {
      npCost: '≈ {n} по тарифу Новой почты', npCostNote: 'В сумму заказа не входит. Точную сумму считает перевозчик.',
      ttnMake: 'Создать ТТН', ttnMkTitle: 'Создать накладную Новой почты', ttnMkErrTitle: 'Накладная не создана',
      ttnMkManual: 'Можно создать ТТН вручную в кабинете Новой почты и ввести номер в поле «Номер ТТН» в заказе.',
      ttnMkFail: 'Не удалось создать накладную. Попробуйте позже или введите ТТН вручную.',
      ttnPayer: 'Доставку оплачивает', ttnPayerRecv: 'получатель', setOff: 'Сейчас выключено.', ttnRecv: 'Получатель', ttnPhone: 'Телефон', ttnCity: 'Город', ttnBranchW: 'Отделение', ttnBranchP: 'Почтомат', ttnCod: 'Наложенный платёж', ttnNoCod: 'без наложенного платежа',
      ttnWeight: 'Вес посылки, г', ttnWeightHint: 'От {a} до {b} г', ttnWeightAsk: 'Вес в заказе не сохранён: укажите его.',
      ttnName: 'Фамилия и имя получателя', ttnNameHint: 'В заказе указано неполное имя. Новая почта требует фамилию и имя.',
      ttnDesc: 'Описание груза', ttnCreate: 'Создать накладную',
      ttnBadW: 'Укажите вес от {a} до {b} г', ttnBadName: 'Укажите фамилию и имя (два-три слова)',
      ttnMade: 'Накладная создана: {n}.', ttnTold: 'Клиенту отправлен номер.',
      ttnCityDiff: 'Город в заказе («{a}») не совпадает с городом Новой почты («{b}»). Проверьте перед созданием.', ttnCityOk: 'Город правильный',
      ttnSaveFailed: 'Накладная создана: {n}. Номер не записался в таблицу — впишите его вручную.', ttnSaveFailedNoNum: 'Накладная, возможно, создана, но номер не записался в таблицу. Проверьте кабинет Новой почты и впишите номер вручную.',
      ttnBusy: 'Проверьте кабинет Новой почты: накладная могла быть создана. Не создавайте её повторно сейчас.', ttnUnknown: 'Ответ Новой почты не получен. Проверьте кабинет Новой почты и не создавайте накладную повторно сейчас.', ttnMadeTitle: 'Накладная создана',
      ttnDimW: 'Ширина, см', ttnDimL: 'Длина, см', ttnDimH: 'Высота, см', ttnDimHint: 'Необязательно. Если заполняете — все три, от 1 до 120 см.',
      ttnDimPart: 'Заполните все три размера или очистите все.', ttnBadDims: 'Размеры — числа от 1 до 120 см',
      ttnQuiet: 'Пробная накладная: не отправлять номер клиенту', ttnQuietDone: 'Клиенту номер не отправляли.', ttnQuietNote: 'Пробную можно удалить из панели в течение 24 часов. Настоящую — только в кабинете Новой почты.',
      ttnStep1: 'Не удалось создать получателя в Новой почте', ttnStep2: 'Не удалось создать накладную',
      ttnDel: 'Удалить накладную', ttnDelTitle: 'Удалить накладную', ttnDelText: 'Пробная накладная № {n} будет удалена в Новой почте, номер в заказе — стёрт. Клиенту ничего не отправляется.',
      ttnDelDone: 'Накладная удалена. Номер в заказе стёрт.', ttnDelErrTitle: 'Накладная не удалена',
      ttnDelPartial: 'В Новой почте накладная удалена, но номер в заказе остался. Сотрите номер в колонке «ТТН» этого заказа; другие ячейки не трогайте.',
      ttnDelInfoTitle: 'Номер не изменён', ttnTrial: 'пробная',
      ttnLast: 'Фамилия', ttnFirst: 'Имя', ttnMiddle: 'Отчество (необязательно)',
      ttnNameCheck: 'Проверьте: покупатели часто пишут сначала имя. Если наоборот — поменяйте.', ttnSwap: 'Поменять местами',
      ttnNameShort: 'Фамилия и имя — не короче 2 знаков каждое',
      ttnDimReq: 'Обязательно: ширина, длина и высота, см (от 1 до 120).', ttnDimMin: 'Минимум, например, 10×10×4 см.', ttnDimNeed: 'Заполните ширину, длину и высоту.',
      ttnBranchWrote: 'Покупатель написал', ttnBranchFound: 'Найдено в Новой почте', ttnWhGuess: 'Номер отделения взят из текста покупателя — проверьте.',
      ttnQuietWarn: 'Сама Новая почта может отправить получателю SMS или уведомление — пробную делайте только на собственный заказ.',
      admStLate: 'Сервер не ответил. Обновите список заказов и проверьте статус.'
    }
  };
  ['ua', 'ru'].forEach(function (lang) {
    Object.keys(I18N_B6[lang]).forEach(function (k) { I18N[lang][k] = I18N_B6[lang][k]; });
  });

  /** Текст ошибки из ответа сервера (msg.ua / msg.ru); неизвестный код — общий текст. Выводится только через textContent. */
  function ttnSrvMsg(res) {
    var m = res && res.msg;
    return m && typeof m === 'object' ? String((state.lang === 'ru' ? (m.ru || m.ua) : (m.ua || m.ru)) || '') : '';
  }
  function ttnMsg(res) { return ttnSrvMsg(res) || t('ttnMkFail'); }
  /** Габариты: все три пустые — null; все три числа 1…120 — [ш, д, в]; иначе 'part' (не все заполнены) или 'bad' (не числа). */
  function ttnDims(vals) {
    var f = vals.filter(function (v) { return String(v).trim() !== ''; });
    if (!f.length) return null;
    if (f.length < 3) return 'part';
    var n = vals.map(function (v) { var s = String(v).trim().replace(',', '.'); return /^\d+(\.\d+)?$/.test(s) ? Number(s) : NaN; });
    return n.some(function (x) { return !(x >= 1 && x <= 120); }) ? 'bad' : n;
  }
  /** Нажатия внутри шторки подтверждения: o.sync() пересчитывает доступность «ОК» и подсказки. */
  function sheetSync(e) {
    var o = state.sheet && state.sheet.kind === 'confirm' && state.sheet.o;
    if (o && o.sync && e.target && e.target.closest && e.target.closest('.ttnc')) o.sync();
  }
  el.sheet.addEventListener('input', sheetSync);
  el.sheet.addEventListener('change', sheetSync);
  el.sheet.addEventListener('click', function (e) {
    var sw = e.target && e.target.closest && e.target.closest('[data-ttn-swap]');
    if (!sw) return;
    var a = document.getElementById('ttnLN'), b = document.getElementById('ttnFN');
    if (a && b) { var v = a.value; a.value = b.value; b.value = v; hapticLight(); }
    sheetSync(e);
  });
  var ttnFlight = false;
  /** «Створити ТТН»: сначала admin.ttn.preview (ничего не меняет), потом шторка подтверждения. */
  function ttnMake(btn) {
    if (ttnFlight || adm.busy) return;
    var num = btn.getAttribute('data-num');
    ttnFlight = true; btnBusy(btn);
    api('admin.ttn.preview', { num: num }).then(function (res) {
      ttnFlight = false; btnFree(btn);
      if (res && res.ok && res.ttn) { if (res.payer && !res.ttn.payer) res.ttn.payer = res.payer; ttnConfirm(res.ttn); return; }
      haptic('error');
      if (res && res.error === 'no_perm') { toast(t('admNoPerm')); return; }
      askConfirm({ title: t('ttnMkErrTitle'), text: ttnMsg(res), warn: t('ttnMkManual') });
    }).catch(function () { ttnFlight = false; btnFree(btn); haptic('error'); toast(t('admFail')); });
  }
  function ttnRow(label, value) {
    return '<p class="ttnc__row"><span>' + esc(label) + '</span><b>' + esc(value) + '</b></p>';
  }
  /** Накладная создана, но номер не записан в таблицу: шторка с крупным номером (текстом, не HTML). */
  function showTtnSaved(num, tn) {
    var html = (tn ? '<p class="ttnc__big" id="ttnSavedNum"></p>' : '') + '<p class="note note--out">' + esc(tn ? tf('ttnSaveFailed', { n: tn }) : t('ttnSaveFailedNoNum')) + '</p>';
    askConfirm({ title: t('ttnMadeTitle') + ' ' + num, html: html });
    var big = document.getElementById('ttnSavedNum');
    if (big) big.textContent = tn;
  }
  function ttnConfirm(d) {
    var minG = Number(d.minG) || 100, maxG = Number(d.maxG) || 30000;
    var wg = Number(d.weightG) > 0 ? Math.round(Number(d.weightG)) : '';
    var cod = Math.round(Number(d.cod) || 0);
    var diff = Number(d.cityDiff) === 1, dimReq = Number(d.dimsReq) === 1;
    // Имя: догадка сервера (nameParts); старый ответ без неё — первое слово в «Прізвище», второе в «Ім'я», остальное — по батькові.
    var np = { last: '', first: '', middle: '' };
    if (d.nameParts && typeof d.nameParts === 'object') {
      np.last = String(d.nameParts.last || ''); np.first = String(d.nameParts.first || ''); np.middle = String(d.nameParts.middle || '');
    } else {
      var ws = String(d.name || '').trim().split(/\s+/).filter(Boolean);
      np.last = ws[0] || ''; np.first = ws[1] || ''; np.middle = ws.slice(2).join(' ');
    }
    var html = '<div class="ttnc">' +
      (diff ? '<div class="ttnc__warn" role="alert"><p>' + esc(tf('ttnCityDiff', { a: d.city || '', b: d.npCity || '' })) + '</p>' +
        '<label class="check"><input type="checkbox" id="ttnCityOk"><span>' + esc(t('ttnCityOk')) + '</span></label></div>' : '') +
      ttnRow(t('ttnPhone'), d.phone) + ttnRow(t('ttnCity'), d.city) +
      (d.branch ? ttnRow(t('ttnBranchWrote'), d.branch) : '') +
      (d.npWarehouse ? ttnRow(t('ttnBranchFound'), d.npWarehouse) : '') +
      (Number(d.whGuess) === 1 ? '<div class="ttnc__warn" role="alert"><p>' + esc(t('ttnWhGuess')) + '</p></div>' : '') +
      ttnRow(t('ttnCod'), cod > 0 ? money(cod) : t('ttnNoCod')) +
      (d.payer === 'recipient' ? ttnRow(t('ttnPayer'), t('ttnPayerRecv')) : '') +
      '<div class="field"><label class="label" for="ttnLN">' + esc(t('ttnLast')) + '</label><input class="input" id="ttnLN" type="text" autocomplete="off" maxlength="40" value="' + esc(np.last) + '"></div>' +
      '<div class="field"><label class="label" for="ttnFN">' + esc(t('ttnFirst')) + '</label><input class="input" id="ttnFN" type="text" autocomplete="off" maxlength="40" value="' + esc(np.first) + '"></div>' +
      '<div class="field"><label class="label" for="ttnMN">' + esc(t('ttnMiddle')) + '</label><input class="input" id="ttnMN" type="text" autocomplete="off" maxlength="40" value="' + esc(np.middle) + '"></div>' +
      '<p class="ttnc__hint ttnc__hint--warn">' + esc(t('ttnNameCheck')) + '</p>' +
      '<button type="button" class="btn btn--block" data-ttn-swap="1">' + esc(t('ttnSwap')) + '</button>' +
      '<p class="ttnc__hint ttnc__hint--warn" id="ttnNameShort" role="status" hidden>' + esc(t('ttnNameShort')) + '</p>' +
      '<div class="field"><label class="label" for="ttnW">' + esc(t('ttnWeight')) + '</label><input class="input" id="ttnW" type="text" inputmode="numeric" autocomplete="off" maxlength="6" value="' + esc(wg) + '">' +
      '<p class="ttnc__hint">' + esc(wg === '' ? t('ttnWeightAsk') + ' ' : '') + esc(tf('ttnWeightHint', { a: minG, b: maxG })) + '</p></div>' +
      '<div class="field"><label class="label" for="ttnD">' + esc(t('ttnDesc')) + '</label><input class="input" id="ttnD" type="text" autocomplete="off" maxlength="100" value="' + esc(d.desc || '') + '"></div>' +
      '<div class="ttnc__dims">' + [['ttnDW', 'ttnDimW'], ['ttnDL', 'ttnDimL'], ['ttnDH', 'ttnDimH']].map(function (x) {
        return '<div class="field"><label class="label" for="' + x[0] + '">' + esc(t(x[1])) + '</label><input class="input" id="' + x[0] + '" type="text" inputmode="decimal" autocomplete="off" maxlength="6"></div>';
      }).join('') + '</div>' +
      '<p class="ttnc__hint' + (dimReq ? ' ttnc__hint--warn' : '') + '" id="ttnDimHint">' + esc(dimReq ? t('ttnDimReq') + ' ' + t('ttnDimMin') : t('ttnDimHint')) + '</p><p class="ttnc__hint ttnc__hint--warn" id="ttnDimPart" role="status" hidden>' + esc(t('ttnDimPart')) + '</p>' +
      '<label class="check"><input type="checkbox" id="ttnQuiet"><span>' + esc(t('ttnQuiet')) + '</span></label><p class="ttnc__hint">' + esc(t('ttnQuietNote')) + '</p><p class="ttnc__hint ttnc__hint--warn">' + esc(t('ttnQuietWarn')) + '</p></div>';
    var val = function (id) { var n = document.getElementById(id); return n ? String(n.value || '').trim() : ''; };
    var dimVals = function () { return [val('ttnDW'), val('ttnDL'), val('ttnDH')]; };
    var nameBad = function () { return val('ttnLN').length < 2 || val('ttnFN').length < 2; };
    var o = {
      title: t('ttnMkTitle') + ' ' + d.num, html: html, ok: t('ttnCreate'), lock: true,
      sync: function () {
        var cb = document.getElementById('ttnCityOk'), okb = el.sheet.querySelector('[data-action="cf-ok"]');
        var dv = ttnDims(dimVals());
        var part = dv === 'part' || (dimReq && !dv), hint = document.getElementById('ttnDimPart');
        var nb = nameBad(), nh = document.getElementById('ttnNameShort'); if (nh) nh.hidden = !nb;
        if (hint) {
          var was = hint.hidden; hint.hidden = dv !== 'part';
          if (dv === 'part' && was) try { hint.scrollIntoView({ block: 'nearest' }); } catch (e) { /* старый браузер */ } // подсказка не должна остаться под кнопками
        }
        if (okb && !okb.classList.contains('is-busy')) okb.disabled = part || nb || (diff && !(cb && cb.checked));
      },
      run: function (done) {
        var w = Math.round(Number(val('ttnW').replace(/\s+/g, '')));
        if (!(w >= minG && w <= maxG)) { done(tf('ttnBadW', { a: minG, b: maxG })); return; }
        var dm = ttnDims(dimVals());
        if (nameBad()) { done(t('ttnNameShort')); return; }
        if (dimReq && !dm) { done(t('ttnDimNeed')); return; }
        if (dm === 'part') { done(t('ttnDimPart')); return; }
        if (dm === 'bad') { done(t('ttnBadDims')); return; }
        var body = { num: d.num, weight: w, confirm: true, cod: cod };
        if (dm) { body.width = dm[0]; body.length = dm[1]; body.height = dm[2]; }
        var quiet = !!(document.getElementById('ttnQuiet') || {}).checked;
        if (quiet) body.quiet = true;
        if (diff) {
          var cb = document.getElementById('ttnCityOk');
          if (!cb || !cb.checked) { done(t('ttnCityOk')); return; }
          body.cityOk = true;
        }
        body.lastName = val('ttnLN').replace(/\s+/g, ' '); body.firstName = val('ttnFN').replace(/\s+/g, ' ');
        var mn = val('ttnMN').replace(/\s+/g, ' '); if (mn) body.middleName = mn;
        if (!(d.nameParts && typeof d.nameParts === 'object')) body.name = body.lastName + ' ' + body.firstName + (mn ? ' ' + mn : ''); // старый ответ без nameParts: бэкенд знает только name
        var ds = val('ttnD'); if (ds) body.desc = ds.slice(0, 100);
        api('admin.ttn.create', body).then(function (res) {
          if (res && res.ok && res.ttn) {
            (adm.orders || []).forEach(function (o) { if (o.num === d.num) o.ttn = String(res.ttn); });
            done();
            renderAdminList();
            haptic('success');
            toast(tf('ttnMade', { n: res.ttn }) + ' ' + (res.quiet === true || (quiet && res.told !== true) ? t('ttnQuietDone') : res.told === false ? t('admNotTold') : t('ttnTold')));
            return;
          }
          var code = res && res.error, tn = res && res.ttn ? String(res.ttn).slice(0, 40) : '';
          if (code === 'save_failed' || tn) {
            // Накладная у Нової пошти создана, а в таблицу номер не попал: показываем номер крупно, не теряем.
            if (tn) (adm.orders || []).forEach(function (o) { if (o.num === d.num) o.ttn = tn; });
            haptic('error');
            done();
            showTtnSaved(d.num, tn);
            renderAdminList();
            return;
          }
          var step = Number(res && res.step), msg;
          if ((code === 'np_api' || code === 'np_error') && (step === 1 || step === 2)) {
            msg = t(step === 1 ? 'ttnStep1' : 'ttnStep2') + (ttnSrvMsg(res) ? '. ' + ttnSrvMsg(res) : '');
          } else {
            msg = code === 'no_perm' ? t('admNoPerm') : code === 'busy' ? t('ttnBusy') : code === 'np_unknown' ? t('ttnUnknown') : code === 'bad_dims' ? (ttnSrvMsg(res) || t('ttnBadDims')) : ttnMsg(res);
          }
          if (code === 'np_api' && res.np) msg += ': ' + String(res.np).slice(0, 300);
          done(msg);
        }).catch(function () { done(t('admFail')); });
      }
    };
    askConfirm(o);
    o.sync();
  }

  /** «Видалити накладну»: подтверждение шторкой, потом admin.ttn.delete с confirm:true. Клиенту ничего не уходит. */
  function ttnDelAsk(num) {
    var ord = (adm.orders || []).filter(function (x) { return x.num === num; })[0];
    if (!ord || adm.busy) return;
    askConfirm({
      title: t('ttnDelTitle') + ' ' + num, text: tf('ttnDelText', { n: ord.ttn || '' }), ok: t('ttnDel'), danger: true,
      run: function (done) {
        api('admin.ttn.delete', { num: num, confirm: true }).then(function (res) {
          if (res && res.ok) {
            ord.ttn = ''; delete ord.ttnDel; delete ord.ttnTrial;
            done(); renderAdminList(); haptic('success');
            toast(res.done === 'del_done' && ttnSrvMsg(res) ? ttnSrvMsg(res) : t('ttnDelDone')); // «вже видалено»: текст сервера, это успех
            return;
          }
          var code = res && res.error;
          if (code === 'del_other') {
            // В заказе уже другой номер, его не трогали: это сообщение, а не тревога. Карточку обновляем с сервера.
            delete ord.ttnDel;
            done(); renderAdminList(); haptic('warning');
            askConfirm({ title: t('ttnDelInfoTitle'), text: ttnSrvMsg(res) });
            fetchAdmin('orders').then(function () { if (state.view === 'admin' && adm.tab === 'orders') renderAdminList(); }).catch(function () { /* останется прежняя карточка */ });
            return;
          }
          if (code === 'del_partial') {
            // В НП накладной уже нет: повторять нельзя, номер админ стирает вручную. Текст — с сервера, запасной — для старого ответа.
            delete ord.ttnDel;
            done(); renderAdminList(); haptic('error');
            askConfirm({ title: t('ttnDelErrTitle'), warn: ttnSrvMsg(res) || t('ttnDelPartial') });
            return;
          }
          var msg = code === 'no_perm' ? t('admNoPerm') : ttnSrvMsg(res) || t('admFail');
          if (code === 'np_api' && res.np) msg += ': ' + String(res.np).slice(0, 300);
          done(msg);
        }).catch(function () { done(t('admFail')); });
      }
    });
  }

  // Шторка «Написати»: счётчик знаков и нажатия внутри шторки.
  el.sheet.addEventListener('input', function (e) { if (e.target.id === 'msgText') msgCount(); });
  el.sheet.addEventListener('click', function (e) { if (sheetExtraClick(e)) e.stopPropagation(); }, true);
  // Группы настроек запоминают, открыты они или свёрнуты, пока панель на экране.
  el.page.addEventListener('toggle', function (e) {
    var sg = e.target && e.target.getAttribute && e.target.getAttribute('data-sg');
    if (sg) adm.setOpen[sg] = !!e.target.open;
  }, true);

  // Любое нажатие на кнопку — лёгкая вибрация; занятая кнопка нажатий не принимает.
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('button, .btn, .chip');
    if (!b) return;
    if (b.classList.contains('is-busy')) { e.stopPropagation(); e.preventDefault(); return; }
    if (!b.disabled) hapticLight();
  }, true);

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
  loadNoticeFlag();
  el.notice.addEventListener('click', function (e) {
    var link = e.target.closest('a[data-url]');
    if (link) { e.preventDefault(); openUrl(link.getAttribute('data-url')); return; }
    if (e.target.closest('.notice__x')) closeNotice();
  });
  bind();
  el.adminBtn.hidden = !adminHint;
  track('open', deepId ? deepId.toUpperCase() : '', params.get('view') || '');
  if (params.get('m')) track('mail', String(params.get('m')).replace(/[^\w-]/g, '').slice(0, 12)); // пришли по кнопке из рассылки — для её статистики
  loadCatalog();
  // Оптовые цены — отдельным запросом и только одобренному оптовику (остальным сервер их не отдаёт).
  setTimeout(function () { loadWh(false); }, 900);
  // Админу заказы подгружаются заранее, пока он смотрит магазин: панель открывается уже с данными, бэкенд к этому моменту «разогрет».
  if (adminHint && params.get('admin') !== '1') setTimeout(function () { if (state.view !== 'admin') prefetchAdmin('orders'); }, 1500);
  if (adminHint && params.get('admin') === '1') go('admin');
  else if (/^(points|story|cart|biz|quiz)$/.test(params.get('view') || '')) go(params.get('view')); // кнопки в сообщениях бота
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
  if (inTelegram && cfg.API_URL && store.get(HASORD_KEY) !== '0' && state.view === 'catalog') { // '0' — уже знаем, что заказов нет
    setTimeout(function () { if (!my.list && !my.loading) loadMyOrders(true); }, 1200);
  }
})();
