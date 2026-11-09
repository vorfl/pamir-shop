/* PAMIR — витрина (Telegram Mini App). Чистый JS, без сборки.
 * Этап 1: каталог только для чтения. Корзина и оформление — этап 2.
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
      debug: 'Тестовий режим'
    },
    ru: {
      search: 'Поиск товаров',
      all: 'Все',
      toCart: 'В корзину',
      out: 'Нет в наличии',
      badgeIn: 'В наличии',
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
      debug: 'Тестовый режим'
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
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'
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
    sheet: null        // { id, vi, qty }
  };

  var el = {
    banner: document.getElementById('banner'),
    search: document.getElementById('search'),
    chips: document.getElementById('chips'),
    main: document.getElementById('main'),
    sheet: document.getElementById('sheet'),
    backdrop: document.getElementById('backdrop')
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
      return { price: Math.round(p.k * 100 / 1000), unit: t('per') + ' ' + weight(100) };
    }
    if (!(p.p > 0)) return null;
    return { price: p.p, unit: p.t === 'p' && p.pk ? t('per') + ' ' + p.pk.replace(/ /g, NBSP) : t('perPiece') };
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

    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 20000);

    fetch(catalogUrl(), ctrl ? { signal: ctrl.signal } : undefined)
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
  }

  function renderBanner() {
    var parts = [];
    if (DEBUG) parts.push(t('debug'));
    if (!cfg.API_URL) parts.push(t('demo'));
    el.banner.hidden = parts.length === 0;
    el.banner.textContent = parts.join(' · ');
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

  function cardHtml(p) {
    var cp = cardPrice(p);
    var meta = cp ? '<span class="price">' + money(cp.price) + '</span><span class="unit">' + esc(cp.unit) + '</span>' : '';
    var btn = p.a
      ? '<button type="button" class="btn btn--primary btn--block"><svg class="ico" aria-hidden="true"><use href="#i-plus"/></svg>' + esc(t('toCart')) + '</button>'
      : '<button type="button" class="btn btn--block" disabled>' + esc(t('out')) + '</button>';
    return '<article class="card' + (p.a ? '' : ' card--out') + '" data-id="' + esc(p.id) + '">' +
      '<div class="card__img">' + photoHtml(p) + badgeHtml(p) + '</div>' +
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
    el.main.innerHTML = '<div class="grid">' + list.map(cardHtml).join('') + '</div>';
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
    if (inTelegram) { try { tg.BackButton.show(); } catch (e) { /* нет BackButton */ } }
    var closeBtn = el.sheet.querySelector('.sheet__close');
    if (closeBtn) closeBtn.focus({ preventScroll: true });
  }

  function closeSheet() {
    if (!state.sheet) return;
    state.sheet = null;
    el.sheet.hidden = true;
    el.backdrop.hidden = true;
    document.body.classList.remove('is-locked');
    if (inTelegram) { try { tg.BackButton.hide(); } catch (e) { /* нет BackButton */ } }
  }

  /** Сумма позиции. Та же формула, что на сервере: цена варианта × количество. */
  function lineTotal(p, vi, qty) {
    var unit = p.t === 'w' ? (p.v[vi] ? p.v[vi][1] : 0) : p.p;
    return unit * qty;
  }

  function renderSheet() {
    var s = state.sheet;
    var p = state.catalog && state.catalog.byId[s.id];
    if (!p) { closeSheet(); return; }
    if (p.t === 'w' && s.vi >= p.v.length) s.vi = 0;

    var body = '<div class="sheet__img">' + photoHtml(p) + '</div>' +
      '<div class="sheet__head">' + badgeHtml(p) +
      '<h2 class="sheet__title" id="sheetTitle">' + esc(name(p)) + '</h2>';
    if (p.t === 'w' && p.k > 0) {
      body += '<p class="sheet__perkg">' + money(p.k) + ' ' + esc(t('per')) + ' ' + weight(1000) + '</p>';
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
        '</div><span class="total">' + money(lineTotal(p, s.vi, s.qty)) + '</span></div>';
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
    el.sheet.innerHTML = '<button type="button" class="sheet__close" aria-label="' + esc(t('close')) + '">' + icon('x') + '</button>' +
      '<div class="sheet__body">' + body + '</div>';
    el.sheet.querySelector('.sheet__body').scrollTop = top;
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
          (img.parentNode.classList.contains('card__img') || img.parentNode.classList.contains('sheet__img'))) {
        var holder = document.createElement('span');
        holder.innerHTML = MARK;
        img.parentNode.replaceChild(holder.firstChild, img);
      }
    }, true);

    el.sheet.addEventListener('click', function (e) {
      if (e.target.closest('.sheet__close')) { closeSheet(); return; }
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

    if (inTelegram) {
      try { tg.BackButton.onClick(closeSheet); } catch (e) { /* нет BackButton */ }
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
  bind();
  loadCatalog();
})();
