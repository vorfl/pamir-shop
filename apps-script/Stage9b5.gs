/**
 * PAMIR — выпуск Б4, п.7: скорость оформления заказа.
 *
 * Что здесь:
 *  1) замер этапов заказа (Script Property PERF_LOG = 1): одна строка в журнал, только названия этапов и миллисекунды;
 *  2) отправка сообщений о заказе (orderNotifySend_): админы одной пачкой UrlFetchApp.fetchAll, затем клиент, затем реквизиты ФОП;
 *     у каждого получателя своя отметка в служебной ячейке заказа — второй раз одному и тому же сообщение не уходит;
 *  3) необязательная очередь (пункт меню «Швидке оформлення замовлень»): заказ записывается в лист вместе с пометкой «надіслати»
 *     и витрина получает ответ сразу; сообщения (и отметку клиента) отправляет триггер orderNotifyJob раз в минуту.
 *
 * Очередь — только отметки в самой строке заказа (ячейка «Службове», ключ nq). CacheService для очереди не используется:
 * он может вытеснить запись. В кэше лежат только подсказки «в очереди что-то есть» (oq), «триггер жив» (oq_hb) и «лист смотрели» (oq_scan).
 * Если очередь выключена, триггер не работает (нет метки oq_hb) или что-то не получилось — сообщения уходят сразу в запросе, как раньше.
 *
 * Новые необязательные Script Properties (не секреты):
 *   ORDER_QUEUE  «1» — очередь включена (ставит пункт меню вместе с триггером orderNotifyJob); иначе всё как раньше
 *   PERF_LOG     «1» — замер (уже используется для каталога и админ-панели)
 * Новых прав у скрипта нет: ScriptApp уже используется пунктами меню (flushJob, dailyJob).
 */

var OQ_HB_SEC = 300;         // метка «триггер жив»: триггер обновляет её каждую минуту; нет метки — заказ отправляет сообщения сам
var OQ_MAX_TRIES = 5;        // попыток отправки одного заказа очередью; потом — тревога главным админам
var OQ_CLAIM_MS = 180000;    // «заказ взят в работу» — столько защищает от второго запуска; упавший запуск через это время можно повторить
var OQ_STALE_MS = 120000;    // страховка (hourlyJob, flushJob, mailJob) берёт только заказы старше этого
var OQ_ALARM_MS = 600000;    // админы не получили сообщение дольше этого — одна тревога главным админам
var OQ_SCAN_ROWS = 100;      // сколько последних строк «Замовлення» просматривается в поисках очереди
var OQ_SCAN_EVERY_SEC = 300; // без подсказки лист просматривается не чаще раза в это время
var OQ_RUN_BUDGET_MS = 240000; // один запуск не дольше 4 минут (лимит Apps Script — 6)
var OQ_MAX_PER_RUN = 25;

/* ------------------------- замер (PERF_LOG = 1) ------------------------- */

var ordPerf_ = null;
function ordPerfStart_() { var n = Date.now(); ordPerf_ = { t0: n, last: n, marks: [], c: {}, mode: 'direct' }; }
function ordPerfMark_(name) {
  if (!ordPerf_) return;
  var n = Date.now();
  ordPerf_.marks.push(name + ' ' + (n - ordPerf_.last));
  ordPerf_.last = n;
}
function ordPerfCount_(name, v) { if (ordPerf_) ordPerf_.c[name] = (ordPerf_.c[name] || 0) + (v === undefined ? 1 : v); }
/** В журнал выполнения — этапы и миллисекунды. Без имён, телефонов, адресов, состава заказа и initData. Без PERF_LOG = 1 ничего не пишется. */
function ordPerfEnd_(label) {
  var p = ordPerf_;
  ordPerf_ = null;
  if (!p) return;
  try {
    if (scriptProps_().getProperty('PERF_LOG') !== '1') return;
    var counts = Object.keys(p.c).map(function (k) { return k + '=' + p.c[k]; });
    console.log('PERF ' + (label || 'order') + ' ' + p.mode + ' ' + (Date.now() - p.t0) + ' ms | ' + p.marks.join(' | ') + (counts.length ? ' | ' + counts.join(' ') : ''));
  } catch (err) { /* замер не должен ломать заказ */ }
}

/* ------------------------- включена ли очередь ------------------------- */

/** Очередь работает, только если она включена в меню И триггер недавно отметился. Иначе заказ шлёт сообщения сам, как раньше. */
function orderQueueOn_() {
  try {
    if (scriptProps_().getProperty('ORDER_QUEUE') !== '1') return false;
    var ok = !!CacheService.getScriptCache().get('oq_hb');
    if (ok && ordPerf_) ordPerf_.mode = 'queued';
    return ok;
  } catch (err) {
    return false;
  }
}

/** Что нужно для отправки позже, кладётся в ячейку «Службове» самой строки заказа (под блокировкой заказа, той же записью). */
function orderQueueMark_(svc, o, user, isTest) {
  var q = { t: Date.now() };
  if (user && !isTest && user.id !== undefined && user.id !== null) {
    q.u = [String(user.id), clean_(user.first_name, 60), clean_(user.last_name, 60), clean_(user.language_code, 8)]; // для отметки в «Клієнти»
    if (o.src) q.s = o.src;
  }
  if (o.giftNote) { q.gn = o.giftNote; q.cm = o.comment; } // в первом сообщении админу подпись к подарку идёт отдельной строкой
  if (o.giftsClient && o.giftsClient.length) svc.gc = o.giftsClient; // подарки на языке клиента (в ячейках подарков — украинский)
  svc.nq = q;
}

/** Подсказка «в очереди что-то есть»: следующий запуск триггера посмотрит лист. Потеря подсказки не страшна — лист просматривается и без неё. */
function orderQueueHint_() {
  try { CacheService.getScriptCache().put('oq', '1', 21600); } catch (err) { /* не критично */ }
}

/* ------------------------- отправка сообщений о заказе ------------------------- */

function orderTgPermanent_(res) {
  var c = Number(res && res.error_code);
  return c >= 400 && c < 500 && c !== 429; // 400/403 — адресат недоступен: повтор не поможет. Остальное (сеть, 429, 5xx) — повторяем
}

/**
 * Записывает отметки отправки. Обычный запрос (job = false): прежнее поведение — запись из памяти без блокировки и только m и r.
 * Запуск очереди (job = true): под короткой блокировкой читаем ячейку заново и меняем только свои ключи (другой код мог изменить остальное).
 */
function orderSvcApply_(ctx, delta) {
  if (!ctx.job) {
    var svc = ctx.svc;
    if (delta.m && delta.m.length) svc.m = (Array.isArray(svc.m) ? svc.m : []).concat(delta.m);
    if (delta.r) svc.r = 1;
    if (ctx.col.svc >= 0 && ((delta.m && delta.m.length) || delta.r)) ctx.sheet.getRange(ctx.rowIndex, ctx.col.svc + 1).setValue(JSON.stringify(svc));
    return true;
  }
  var res = orderSvcUpdate_(ctx.sheet, ctx.col, ctx.o.num, ctx.rowIndex, function (cur) {
    if (delta.m && delta.m.length) {
      var have = {};
      var list = Array.isArray(cur.m) ? cur.m : [];
      list.forEach(function (t) { have[String(t[0])] = true; });
      delta.m.forEach(function (t) { if (!have[String(t[0])]) list.push(t); });
      cur.m = list;
    }
    if (delta.nx && delta.nx.length) {
      var gone = Array.isArray(cur.nx) ? cur.nx : [];
      delta.nx.forEach(function (id) { if (gone.indexOf(id) < 0) gone.push(id); });
      cur.nx = gone;
    }
    if (delta.cn) cur.cn = delta.cn;
    if (delta.r) cur.r = 1;
    return true;
  });
  if (!res) return false;
  ctx.svc = res.svc;
  ctx.rowIndex = res.row;
  return true;
}

/**
 * Сообщения о заказе: админы (одной пачкой), клиент, реквизиты ФОП. Каждому — не больше одного раза: у админа отметка в svc.m,
 * у клиента svc.cn (1 — получил, 2 — недоступен), у реквизитов svc.r. Возвращает { pending, targets }: pending — что-то ушло не всем
 * из-за временной ошибки (сеть, 429, 5xx), стоит повторить. Постоянная ошибка (400/403) повтором не лечится и в pending не попадает.
 * Обычный запрос ничего не повторяет и пишет в ячейку только m и r — как до выпуска Б4.
 */
function orderNotifySend_(token, props, ctx) {
  var o = ctx.o;
  var svc = ctx.svc;
  var job = !!ctx.job;
  var out = { pending: false, targets: 0 };
  var isTest = String(o.source).indexOf('test') >= 0;
  var have = {}, gone = {};
  (Array.isArray(svc.m) ? svc.m : []).forEach(function (t) { have[String(t[0])] = true; });
  (Array.isArray(svc.nx) ? svc.nx : []).forEach(function (id) { gone[String(id)] = true; });
  var ids = orderNotifyIds_(props);
  out.targets = ids.length;
  ordPerfMark_('admins:list');
  var todo = ids.filter(function (id) { return !have[id] && !gone[id]; });
  if (todo.length) {
    var text = adminText_(o, '');
    var kb = adminKeyboard_(o.num);
    var rs = tgAll_(token, todo.map(function (chatId) {
      return ['sendMessage', { chat_id: chatId, text: text, parse_mode: 'HTML', disable_web_page_preview: true, reply_markup: kb }];
    }));
    ordPerfCount_('admins', todo.length);
    ordPerfCount_('tg', 1);
    ordPerfMark_('admins:send');
    var dm = [], dx = [];
    rs.forEach(function (res, i) {
      if (res && res.ok && res.result) dm.push([todo[i], res.result.message_id]);
      else {
        console.error('Не доставлено админу ' + todo[i] + ': ' + (res && res.description));
        if (orderTgPermanent_(res)) dx.push(todo[i]); else out.pending = true;
      }
    });
    if (dm.length || (job && dx.length)) { orderSvcApply_(ctx, { m: dm, nx: dx }); ordPerfCount_('write', 1); }
    ordPerfMark_('admins:svc');
    svc = ctx.svc;
  }
  if (o.uid && !isTest) {
    var cn = Number(svc.cn) || 0;
    if (!cn) {
      var cres = tg_(token, 'sendMessage', { chat_id: o.uid, text: clientText_('new', o) });
      ordPerfCount_('tg', 1);
      ordPerfMark_('client');
      if (cres && cres.ok) cn = 1;
      else if (orderTgPermanent_(cres)) cn = 2;
      else out.pending = true;
      if (cn && job) { orderSvcApply_(ctx, { cn: cn }); ordPerfCount_('write', 1); svc = ctx.svc; }
    }
    // реквизиты ФОП — отдельным сообщением после подтверждения: его сбой подтверждение не трогает.
    // Очередь шлёт их, только когда подтверждение уже ушло (порядок сообщений клиенту сохраняется).
    if (o.pay === 'card' && !svc.r && (!job || cn === 1)) {
      try {
        var fop = fopConfig_();
        if (fop.on) {
          var fres = tg_(token, 'sendMessage', { chat_id: o.uid, text: fopRequisitesText_(o, fop), parse_mode: 'HTML', disable_web_page_preview: true });
          ordPerfCount_('tg', 1);
          if (fres && fres.ok) { orderSvcApply_(ctx, { r: 1 }); ordPerfCount_('write', 1); } // отметка «реквизиты отправлены»
          else if (!orderTgPermanent_(fres)) out.pending = true;
          ordPerfMark_('fop');
        }
      } catch (err2) { console.error('fop: send failed'); out.pending = true; }
    }
  }
  return out;
}

/* ------------------------- очередь: запуск раз в минуту ------------------------- */

/**
 * Обновляет ячейку «Службове» заказа под блокировкой скрипта: читает свежую, вызывает fn(svc) и пишет, если fn не вернула false.
 * Строка ищется по номеру (владелец мог удалить строки выше). Возвращает { svc, row, changed } или null (нет блокировки, строки, мусор в ячейке).
 */
function orderSvcUpdate_(sheet, col, num, rowHint, fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return null;
  try {
    var at = Number(rowHint) || 0;
    var last = sheet.getLastRow();
    var here = at >= 2 && at <= last ? String(sheet.getRange(at, col.num + 1).getValues()[0][0] || '').trim() : '';
    if (here !== String(num)) {
      at = 0;
      if (last >= 2) {
        var nums = sheet.getRange(2, col.num + 1, last - 1, 1).getValues();
        for (var i = nums.length - 1; i >= 0; i--) if (String(nums[i][0] || '').trim() === String(num)) { at = i + 2; break; }
      }
    }
    if (!at) return null;
    var cur;
    try { cur = JSON.parse(String(sheet.getRange(at, col.svc + 1).getValues()[0][0] || '{}')) || {}; } catch (err) { return null; }
    var changed = fn(cur) !== false;
    if (changed) sheet.getRange(at, col.svc + 1).setValue(JSON.stringify(cur));
    return { svc: cur, row: at, changed: changed };
  } finally {
    lock.releaseLock();
  }
}

/** Триггер раз в минуту (ставит пункт меню). Метка «жив» нужна заказам: нет метки — они шлют сообщения сами. */
function orderNotifyJob() {
  try {
    if (scriptProps_().getProperty('ORDER_QUEUE') === '1') CacheService.getScriptCache().put('oq_hb', '1', OQ_HB_SEC);
    orderQueueRun_(0);
  } catch (err) {
    console.error('orderNotifyJob: ' + safeErr_(err, true));
  }
}

/** Страховка для hourlyJob / flushJob / mailJob: заказы, которые лежат в очереди дольше двух минут. Ошибки наружу не выходят. */
function orderQueueSweep_() {
  try { return orderQueueRun_(OQ_STALE_MS); } catch (err) { console.error('order queue sweep: ' + safeErr_(err, true)); return null; }
}

/**
 * Один проход очереди. minAge — брать только заказы старше этого (0 — все). Без подсказки в кэше и если лист недавно смотрели — выход
 * сразу, без обращения к таблице. Возвращает { checked, done, left }.
 */
function orderQueueRun_(minAge) {
  var res = { checked: false, done: 0, left: 0 };
  var cache = CacheService.getScriptCache();
  if (!cache.get('oq') && cache.get('oq_scan')) return res;
  cache.remove('oq'); // сначала снимаем подсказку, потом смотрим лист: заказ, записанный после этого, поставит её снова
  var started = Date.now();
  var props = scriptProps_();
  var token = props.getProperty('BOT_TOKEN');
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ORDERS);
  res.checked = true;
  var pend = [];
  var col = null;
  var last = sheet ? sheet.getLastRow() : 0;
  if (token && last >= 2) {
    var width = sheet.getLastColumn();
    col = orderCols_(sheet, sheet.getRange(1, 1, 1, Math.max(1, width)).getValues()[0]);
    if (col.svc >= 0) {
      var r0 = Math.max(2, last - OQ_SCAN_ROWS + 1);
      var rows = sheet.getRange(r0, 1, last - r0 + 1, Math.max(1, width)).getValues();
      rows.forEach(function (row, i) {
        var raw = cell_(row, col.svc);
        if (raw.indexOf('"nq"') < 0) return;
        var s;
        try { s = JSON.parse(raw); } catch (err) { return; }
        var num = cell_(row, col.num);
        if (s && s.nq && num) pend.push({ num: num, row: r0 + i, t: Number(s.nq.t) || 0 });
      });
    }
  }
  try { cache.put('oq_scan', '1', OQ_SCAN_EVERY_SEC); } catch (err1) { /* не критично */ }
  if (!pend.length) return res;
  ordPerfStart_();
  pend.sort(function (a, b) { return a.t - b.t; }); // порядок заказов сохраняется: старые раньше
  var handled = 0;
  pend.forEach(function (p) {
    if (handled >= OQ_MAX_PER_RUN || Date.now() - started > OQ_RUN_BUDGET_MS) { res.left++; return; }
    if (minAge && Date.now() - p.t < minAge) { res.left++; return; }
    handled++;
    var r;
    try { r = orderQueueOne_(token, props, sheet, col, p); } catch (err2) {
      console.error('order queue ' + p.num + ': ' + safeErr_(err2, true));
      orderQueueRelease_(sheet, col, p);
      r = { left: true };
    }
    if (r.left) res.left++; else res.done++;
  });
  if (res.left) orderQueueHint_(); // осталось — следующий запуск посмотрит лист снова
  ordPerfCount_('orders', handled);
  ordPerfEnd_('order-job');
  return res;
}

/** Снимает «взят в работу» после сбоя (запись не обязательна: без неё заказ вернётся в работу через OQ_CLAIM_MS). */
function orderQueueRelease_(sheet, col, p) {
  try { orderSvcUpdate_(sheet, col, p.num, p.row, function (cur) { if (!cur.nq || !cur.nq.c) return false; cur.nq.c = 0; return true; }); } catch (err) { /* вернётся сам */ }
}

/** Главные админы: владелец и админы с ролью «Адмін» (менеджеры тревоги не получают). */
function orderQueueAlarmIds_(props) {
  return adminList_(props).filter(function (a) { return a.active && (a.role === 'owner' || a.role === 'admin') && /^-?\d+$/.test(a.id); }).map(function (a) { return a.id; });
}

/** Тревога без персональных данных: только номер заказа и минуты. */
function orderQueueAlarm_(token, props, num, minutes, gaveUp) {
  var ua = gaveUp
    ? 'Увага: повідомлення про замовлення ' + num + ' не вдалося надіслати після кількох спроб. Відкрийте таблицю «Замовлення» і перевірте замовлення вручну.'
    : 'Увага: про замовлення ' + num + ' адміністратори не отримали повідомлення вже ' + minutes + ' хв. Перевірте, чи працює тригер (меню PAMIR → «Швидке оформлення»), і подивіться таблицю «Замовлення».';
  var ru = gaveUp
    ? 'Внимание: сообщение о заказе ' + num + ' не удалось отправить после нескольких попыток. Откройте таблицу «Замовлення» и проверьте заказ вручную.'
    : 'Внимание: о заказе ' + num + ' администраторы не получили сообщение уже ' + minutes + ' мин. Проверьте, работает ли триггер (меню PAMIR → «Швидке оформлення»), и посмотрите таблицу «Замовлення».';
  orderQueueAlarmIds_(props).forEach(function (id) { tg_(token, 'sendMessage', { chat_id: id, text: ua + '\n\n' + ru }); });
}

/** Один заказ из очереди. Возвращает { left: true }, если что-то осталось (повторится следующим запуском). */
function orderQueueOne_(token, props, sheet, col, p) {
  var now = Date.now();
  var needTouch = false, lateMin = 0, giveUp = false, alreadyDone = false, busy = false;
  // 1. «Взять в работу» под блокировкой: два запуска не отправят один заказ дважды.
  var claim = orderSvcUpdate_(sheet, col, p.num, p.row, function (cur) {
    var q = cur.nq;
    if (!q) { alreadyDone = true; return false; }
    if (q.c && now - q.c < OQ_CLAIM_MS) { busy = true; return false; }
    q.a = (Number(q.a) || 0) + 1; // попытка считается с начала: упавший запуск не даёт повторять бесконечно
    if (q.a > OQ_MAX_TRIES) { delete cur.nq; cur.nz = 1; cur.nal = 1; giveUp = true; return true; }
    q.c = now;
    if (q.u && !q.tc) { q.tc = 1; needTouch = true; } // отметка клиента — не больше одного раза
    var noAdminYet = !(Array.isArray(cur.m) && cur.m.length);
    if (!cur.nal && noAdminYet && now - Number(q.t || now) > OQ_ALARM_MS) { cur.nal = 1; lateMin = Math.round((now - q.t) / 60000); }
    return true;
  });
  if (!claim) return { left: true }; // нет блокировки или строки — попробует следующий запуск
  if (alreadyDone) return { left: false };
  if (busy) return { left: true };
  if (giveUp) {
    orderQueueAlarm_(token, props, p.num, 0, true);
    console.error('order queue: ' + p.num + ' — отправка не удалась после ' + OQ_MAX_TRIES + ' попыток');
    return { left: false };
  }
  var q0 = claim.svc.nq || {};
  var found = findOrder_(p.num);
  if (!found) return { left: false }; // строку удалили вручную — отправлять нечего
  var o = found.o;
  o.giftsClient = Array.isArray(claim.svc.gc) ? claim.svc.gc : [];
  if (q0.gn) { o.giftNote = q0.gn; o.comment = q0.cm || ''; } // как в первом сообщении при отправке прямо в запросе
  ordPerfCount_('lag_ms', Math.max(0, now - Number(q0.t || now)));
  ordPerfMark_('find');
  if (needTouch && q0.u) {
    touchClient_({ id: q0.u[0], first_name: q0.u[1], last_name: q0.u[2], language_code: q0.u[3] }, o.lang, true, q0.s || '');
    ordPerfMark_('touch');
  }
  if (lateMin) { try { orderQueueAlarm_(token, props, p.num, lateMin, false); } catch (errA) { console.error('order queue alarm: ' + safeErr_(errA)); } }
  var ctx = { o: o, svc: claim.svc, sheet: found.sheet, col: found.col, rowIndex: found.rowIndex, job: true };
  var r = orderNotifySend_(token, props, ctx);
  // 2. Итог: всё ушло — пометка снимается; иначе «взят в работу» снимается, следующий запуск повторит только недостающее.
  var left = r.pending;
  var fin = orderSvcUpdate_(found.sheet, found.col, p.num, ctx.rowIndex, function (cur) {
    if (!cur.nq) return false;
    if (!r.pending) { delete cur.nq; return true; }
    cur.nq.c = 0;
    return true;
  });
  if (!fin) left = true; // пометку снять не удалось — следующий запуск проверит (отправленным повторно не пошлёт: есть отметки получателей)
  ordPerfMark_('done');
  return { left: left };
}

/* ------------------------- пункты меню ------------------------- */

function stage9b5Menu_(menu) {
  return menu.addSeparator()
    .addItem('Швидке оформлення замовлень: увімкнути', 'menuOrderQueueOn')
    .addItem('Швидке оформлення замовлень: вимкнути', 'menuOrderQueueOff');
}

function orderQueueAlert_(text) {
  try { SpreadsheetApp.getUi().alert(text); } catch (err) { /* запуск из редактора */ }
}

function orderQueueDeleteTriggers_() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'orderNotifyJob') ScriptApp.deleteTrigger(t); });
}

/** Пункт меню: триггер раз в минуту + флажок. Не получилось создать триггер — флажок не ставится, заказы идут как раньше. */
function menuOrderQueueOn() {
  try {
    orderQueueDeleteTriggers_(); // повторное включение не дублирует триггер
    ScriptApp.newTrigger('orderNotifyJob').timeBased().everyMinutes(1).create();
  } catch (err) {
    console.error('order queue on: ' + safeErr_(err));
    orderQueueAlert_('Не вдалося створити тригер (можливо, їх уже забагато). Швидке оформлення НЕ ввімкнено, замовлення працюють як раніше.\nНе удалось создать триггер. Быстрое оформление НЕ включено, заказы работают как раньше.');
    return { ok: false };
  }
  scriptProps_().setProperty('ORDER_QUEUE', '1');
  CacheService.getScriptCache().put('oq_hb', '1', OQ_HB_SEC);
  orderQueueAlert_('Швидке оформлення увімкнено. Покупець бачить «Замовлення прийнято» одразу, а повідомлення адмінам і клієнту надходять протягом хвилини (зазвичай швидше). Якщо тригер зупиниться, замовлення знову надсилають повідомлення самі.\nБыстрое оформление включено: сообщения приходят в течение минуты.');
  return { ok: true };
}

/** Пункт меню: снять триггер и флажок, сразу отправить всё, что лежало в очереди. */
function menuOrderQueueOff() {
  orderQueueDeleteTriggers_();
  scriptProps_().setProperty('ORDER_QUEUE', '0'); // новые заказы шлют сообщения сами
  var cache = CacheService.getScriptCache();
  cache.remove('oq_hb');
  var left = 0;
  for (var i = 0; i < 3; i++) {
    cache.put('oq', '1', 600); // принудительно посмотреть лист
    var r = orderQueueRun_(0);
    left = r ? r.left : 0;
    if (!left) break;
  }
  orderQueueAlert_(left
    ? 'Швидке оформлення вимкнено, але частину повідомлень ще не надіслано (' + left + '). Вони підуть самі: щогодини страхувальна перевірка.\nБыстрое оформление выключено, часть сообщений ещё не отправлена.'
    : 'Швидке оформлення вимкнено. Усе, що чекало в черзі, надіслано.\nБыстрое оформление выключено, очередь отправлена.');
  return { ok: !left, left: left };
}
