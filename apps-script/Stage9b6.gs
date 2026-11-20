/**
 * PAMIR — выпуск Б4: текст о комиссии наложенного платежа в настройках (cod_note_ua / cod_note_ru).
 *
 * Читает настройки Code.gs (codNote_). Здесь только пункт меню, который добавляет строки в лист «Налаштування» с полным текстом
 * владельца (обе фразы). Существующую строку (даже с пустым значением) не трогает. Файл необязательный: без него текст по умолчанию
 * (с условной второй фразой) работает так же.
 */

function stage9b6Menu_(menu) {
  return menu.addSeparator().addItem('Налаштування: додати текст про комісію накладеного платежу', 'menuCodNoteSetup');
}

/** Пункт меню: дописывает cod_note_ua и cod_note_ru в «Налаштування», если таких ключей ещё нет. */
function menuCodNoteSetup() {
  var res = codNoteSetup_();
  try {
    SpreadsheetApp.getUi().alert(res.added.length
      ? 'Додано рядки в аркуш «' + SHEET_SETTINGS + '»: ' + res.added.join(', ') + '. Текст можна змінити прямо в таблиці; порожнє значення — рядка на вітрині не буде. Зміни дійдуть до магазину протягом кількох хвилин.\nДобавлены строки в лист «' + SHEET_SETTINGS + '»: ' + res.added.join(', ') + '. Текст можно менять в таблице; пусто — строки в магазине не будет.'
      : 'Обидва рядки (' + COD_NOTE_KEYS.join(', ') + ') вже є в аркуші «' + SHEET_SETTINGS + '», нічого не змінено.\nОбе строки уже есть в листе, ничего не изменено.');
  } catch (err) { /* запуск из редактора */ }
  return res;
}

function codNoteSetup_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  var added = [];
  try {
    var sheet = ss.getSheetByName(SHEET_SETTINGS);
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_SETTINGS);
      sheet.getRange(1, 1, 1, 3).setValues([['Ключ', 'Значення', 'Опис']]).setFontWeight('bold');
      sheet.setFrozenRows(1);
    }
    var have = {};
    var last = sheet.getLastRow();
    if (last > 1) sheet.getRange(2, 1, last - 1, 1).getValues().forEach(function (r) { have[String(r[0] === null || r[0] === undefined ? '' : r[0]).trim()] = true; });
    var want = [
      ['cod_note_ua', COD_NOTE_UA1 + ' ' + COD_NOTE_UA2, 'Текст про комісію накладеного платежу (UA), показується при виборі накладеного платежу. Порожньо — рядка немає'],
      ['cod_note_ru', COD_NOTE_RU1 + ' ' + COD_NOTE_RU2, 'Текст о комиссии наложенного платежа (RU). Пусто — строки нет']
    ];
    want.forEach(function (w) {
      if (have[w[0]]) return;
      sheet.appendRow(w);
      added.push(w[0]);
    });
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
  settingsMemo_ = null;
  if (added.length) clearCatalogCache_();
  return { added: added };
}
