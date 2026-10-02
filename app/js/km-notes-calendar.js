/* KM notes calendar — daily notebook with time reminders */
(function () {
  'use strict';

  const MONTHS = ['Հունվար', 'Փետրվար', 'Մարտ', 'Ապրիլ', 'Մայիս', 'Հունիս', 'Հուլիս', 'Օգոստոս', 'Սեպտեմբեր', 'Հոկտեմբեր', 'Նոյեմբեր', 'Դեկտեմբեր'];
  const WEEK = ['Երկ', 'Երք', 'Չրք', 'Հնգ', 'Ուրբ', 'Շբթ', 'Կիր'];
  const SOON_MIN = 10;
  const CHECK_MS = 20000;
  const ALARM_MS = 60000;
  const ALARM_GAIN = 0.78;
  const ALARM_PULSE_MS = 900;

  let viewY = new Date().getFullYear();
  let viewM = new Date().getMonth() + 1;
  let selected = ymd(new Date());
  let editingId = '';
  let searchQ = '';
  let audioCtx = null;
  let timer = null;
  let alarmPulse = null;
  let alarmEndAt = 0;
  let alarmMsg = '';
  const alerted = new Set();

  function esc(s) {
    return typeof window.esc === 'function'
      ? window.esc(s)
      : String(s ?? '').replace(/[&<>"']/g, function (m) {
          return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
        });
  }
  function pad(n) { return String(n).padStart(2, '0'); }
  function ymd(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function todayYmd() { return ymd(new Date()); }
  function parseYmd(s) {
    const p = String(s || '').split('-').map(Number);
    return new Date(p[0], (p[1] || 1) - 1, p[2] || 1);
  }
  function ensureNotes() {
    if (typeof db === 'undefined' || !db) return [];
    if (!Array.isArray(db.notebookNotes)) db.notebookNotes = [];
    return db.notebookNotes;
  }
  function notesOn(date) {
    return ensureNotes().filter(function (n) { return n && n.date === date; })
      .sort(function (a, b) { return String(a.time || '').localeCompare(String(b.time || '')); });
  }
  function datesWithNotes(y, m) {
    const prefix = y + '-' + pad(m) + '-';
    const set = {};
    ensureNotes().forEach(function (n) {
      if (n && String(n.date || '').indexOf(prefix) === 0) set[n.date] = true;
    });
    return set;
  }
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
  function persist() {
    if (typeof save === 'function') return save(true);
  }
  function canEditNotes() {
    if (typeof window.kmCanEditPage === 'function') return !!window.kmCanEditPage('notes');
    return typeof window.kmCanEdit !== 'function' || window.kmCanEdit('notes') || window.kmCanEdit();
  }
  function holidaysPanelHtml(year) {
    year = +year || viewY || new Date().getFullYear();
    var skip = true;
    try {
      if (typeof window.kmSkipHolidaysInPlan === 'function') skip = !!window.kmSkipHolidaysInPlan();
      else skip = localStorage.getItem('kmSkipHolidays') !== '0';
    } catch (e) {}
    var rows = '';
    try {
      var list = typeof window.kmArmenianHolidays === 'function' ? window.kmArmenianHolidays(year) : [];
      rows = (list || []).map(function (h) {
        return '<tr><td>' + esc(h.date) + '</td><td>' + esc(h.name) + '</td></tr>';
      }).join('') || '<tr><td colspan="2" class="muted">Տոն չկա</td></tr>';
    } catch (eH) {
      rows = '<tr><td colspan="2" class="muted">Տոները բեռնվում են…</td></tr>';
    }
    return '<div class="kmNotesHolidays" id="kmNotesHolidays" style="margin-top:12px;padding-top:10px;border-top:1px solid #d8e0ea">' +
      '<h3 style="margin:0 0 6px;font-size:16px">Տոներ · ' + year + '</h3>' +
      '<p class="muted" style="margin:0 0 8px;font-size:12px">ՀՀ տոները և նշումները մեկ բաժին են։ Տոները երևում են օրացույցում և կարող են բաց թողնվել ավտոպլանում։</p>' +
      '<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0 0 8px">' +
      '<label>Տարի <input id="kmNoteHolYear" type="number" min="2000" max="2100" value="' + year + '" style="width:90px"></label>' +
      '<button type="button" id="kmNoteHolYearGo">Ցույց տալ</button>' +
      '<label style="margin-left:4px"><input type="checkbox" id="kmNoteHolSkip"' + (skip ? ' checked' : '') + '> Ավտոպլանում բաց թողնել տոները</label>' +
      '</div>' +
      '<div class="gridwrap"><table class="grid"><thead><tr><th>Ամսաթիվ</th><th>Տոն</th></tr></thead><tbody>' +
      rows + '</tbody></table></div></div>';
  }
  function peopleNames() {
    try {
      if (typeof window.kmPeopleRoster === 'function') {
        return window.kmPeopleRoster().map(function (p) { return String((p && p.name) || '').trim(); }).filter(Boolean);
      }
      const list = (typeof db !== 'undefined' && Array.isArray(db.people)) ? db.people : [];
      return list.map(function (p) { return String((p && p.name) || '').trim(); }).filter(Boolean);
    } catch (e) { return []; }
  }
  function personSelectHtml(current) {
    const cur = String(current || '');
    const opts = peopleNames().map(function (n) {
      return '<option value="' + esc(n) + '"></option>';
    }).join('');
    return '<input id="kmNotePerson" type="text" list="kmNotePersonList" value="' + esc(cur) +
      '" placeholder="գրեք Ա․Ա․Հ" autocomplete="off"><datalist id="kmNotePersonList">' + opts + '</datalist>';
  }
  function noteSearchBlob(n) {
    return [n && n.text, n && n.person, n && n.time, n && n.date].join(' ').toLowerCase();
  }
  function findNote(id) {
    return ensureNotes().filter(function (n) { return n && n.id === id; })[0] || null;
  }
  function notify(msg, type) {
    if (typeof window.kmNotify === 'function') window.kmNotify(msg, type || 'warn');
    else if (typeof toast === 'function') toast(msg);
    try {
      if (window.Notification && Notification.permission === 'granted') {
        new Notification('KM · Նշում', { body: String(msg || ''), silent: false, requireInteraction: true });
      }
    } catch (e) {}
  }
  function requestNotifPerm() {
    try {
      if (window.Notification && Notification.permission === 'default') Notification.requestPermission();
    } catch (e) {}
  }
  function ensureAudio() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
    } catch (e) {}
    return audioCtx;
  }
  function beepBurst() {
    const ctx = ensureAudio();
    if (!ctx) return;
    const now = ctx.currentTime;
    const tones = [880, 1240, 880, 1480];
    tones.forEach(function (freq, i) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      const t = now + i * 0.14;
      o.type = 'square';
      o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(ALARM_GAIN, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(t);
      o.stop(t + 0.13);
    });
  }
  function showAlarmBanner(msg) {
    let bar = document.getElementById('kmNoteAlarmBar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'kmNoteAlarmBar';
      bar.innerHTML = '<div class="kmNoteAlarmText"></div><button type="button" id="kmNoteAlarmStop">Կանգնեցնել</button>';
      document.body.appendChild(bar);
      bar.querySelector('#kmNoteAlarmStop').onclick = function () {
        stopAlarm();
      };
    }
    bar.querySelector('.kmNoteAlarmText').textContent = String(msg || 'Նշման ժամանակը');
    bar.classList.add('is-on');
  }
  function hideAlarmBanner() {
    const bar = document.getElementById('kmNoteAlarmBar');
    if (bar) bar.classList.remove('is-on');
  }
  function stopAlarm() {
    alarmEndAt = 0;
    alarmMsg = '';
    if (alarmPulse) {
      clearInterval(alarmPulse);
      alarmPulse = null;
    }
    hideAlarmBanner();
  }
  function playAlarm(msg) {
    ensureAudio();
    alarmMsg = String(msg || 'Նշման ժամանակը');
    alarmEndAt = Date.now() + ALARM_MS;
    showAlarmBanner(alarmMsg);
    beepBurst();
    notify(alarmMsg, 'warn');
    if (alarmPulse) clearInterval(alarmPulse);
    let pulses = 0;
    alarmPulse = setInterval(function () {
      if (Date.now() >= alarmEndAt) {
        stopAlarm();
        return;
      }
      beepBurst();
      pulses++;
      if (pulses % 8 === 0) notify(alarmMsg, 'warn');
    }, ALARM_PULSE_MS);
  }
  const MEMOS = {
    '02-20': 'Արցախի հերոսամարտ',
    '04-07': 'Մայրության և գեղեցկության օր',
    '05-08': 'Երկրապահի օր',
    '06-01': 'Երեխաների պաշտպանության օր',
    '09-01': 'Գիտելիքի օր',
    '12-07': 'Սպիտակի երկրաշարժ'
  };
  function holidayNameOf(dateStr) {
    const d = parseYmd(dateStr);
    if (typeof window.kmHolidayName !== 'function') return '';
    return String(window.kmHolidayName(d.getFullYear(), d.getMonth() + 1, d.getDate()) || '');
  }
  function memoNameOf(dateStr) {
    return MEMOS[String(dateStr || '').slice(5)] || '';
  }
  function injectCss() {
    const old = document.getElementById('km-notes-cal-css');
    if (old) old.remove();
    const s = document.createElement('style');
    s.id = 'km-notes-cal-css';
    s.textContent = [
      '.kmNotesWrap{display:grid;grid-template-columns:minmax(280px,1fr) minmax(280px,1.1fr);gap:16px;margin-bottom:14px}',
      '@media(max-width:900px){.kmNotesWrap{grid-template-columns:1fr}}',
      '.kmCalCard{background:linear-gradient(180deg,#f4fbff 0%,#ffffff 42%);border:1px solid #cfe3f0;box-shadow:0 10px 28px rgba(24,70,100,.08)}',
      '.kmCalHead{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:14px}',
      '.kmCalHead h2{margin:0;font-size:22px;letter-spacing:.02em;background:linear-gradient(90deg,#156f8c,#2aa7b8);-webkit-background-clip:text;background-clip:text;color:transparent}',
      '.kmCalNav{display:flex;align-items:center;gap:8px}',
      '.kmCalNav button{border-radius:999px!important;min-width:36px;background:#e8f6fb!important;border-color:#b7dbe8!important;color:#14607a!important;font-weight:700}',
      '.kmCalNav b{min-width:150px;text-align:center;color:#1a4d63}',
      '.kmCalGrid{display:grid;grid-template-columns:repeat(7,1fr);gap:7px}',
      '.kmCalDow{text-align:center;font-size:12px;font-weight:800;padding:6px 0;border-radius:999px}',
      '.kmCalGrid .kmCalDow:nth-child(1){color:#1d4ed8;background:#dbeafe}',
      '.kmCalGrid .kmCalDow:nth-child(2){color:#0f766e;background:#ccfbf1}',
      '.kmCalGrid .kmCalDow:nth-child(3){color:#166534;background:#dcfce7}',
      '.kmCalGrid .kmCalDow:nth-child(4){color:#6d28d9;background:#ede9fe}',
      '.kmCalGrid .kmCalDow:nth-child(5){color:#9d174d;background:#fce7f3}',
      '.kmCalGrid .kmCalDow:nth-child(6){color:#374151;background:#e5e7eb}',
      '.kmCalGrid .kmCalDow:nth-child(7){color:#1f2937;background:#d1d5db}',
      '.kmCalDay{position:relative;min-height:72px;border:1px solid #d5e4ee;border-radius:14px;background:#fff;padding:8px 8px 18px;text-align:left;cursor:pointer;transition:transform .12s ease,box-shadow .12s ease,background .12s ease}',
      '.kmCalDay:hover{transform:translateY(-1px);box-shadow:0 8px 16px rgba(24,70,100,.12);border-color:#8ec3d8}',
      '.kmCalDay.other{opacity:.42}',
      '.kmCalGrid .kmCalDay.wd1{background:#dbeafe;border-color:#93c5fd;color:#1e3a8a}',
      '.kmCalGrid .kmCalDay.wd2{background:#ccfbf1;border-color:#5eead4;color:#115e59}',
      '.kmCalGrid .kmCalDay.wd3{background:#dcfce7;border-color:#86efac;color:#14532d}',
      '.kmCalGrid .kmCalDay.wd4{background:#ede9fe;border-color:#c4b5fd;color:#5b21b6}',
      '.kmCalGrid .kmCalDay.wd5{background:#fce7f3;border-color:#f9a8d4;color:#9d174d}',
      '.kmCalGrid .kmCalDay.wd6{background:#e5e7eb;border-color:#9ca3af;color:#111827}',
      '.kmCalGrid .kmCalDay.wd0{background:#d1d5db;border-color:#6b7280;color:#111827}',
      '.kmCalGrid .kmCalDay.holiday{background:linear-gradient(180deg,#fff4c4,#f5d76e)!important;border-color:#c9a227!important;color:#5a3d00!important}',
      '.kmCalGrid .kmCalDay.memo{box-shadow:inset 0 3px 0 #7c3aed}',
      '.kmCalGrid .kmCalDay.today{box-shadow:0 0 0 2px #14708d}',
      '.kmCalGrid .kmCalDay.hasNote{box-shadow:inset 0 -3px 0 #1c86a8}',
      '.kmCalGrid .kmCalDay.today.hasNote{box-shadow:0 0 0 2px #14708d,inset 0 -3px 0 #1c86a8}',
      '.kmCalGrid .kmCalDay.sel{background:linear-gradient(180deg,#1c86a8,#14708d)!important;color:#fff!important;border-color:#12667f!important;box-shadow:0 10px 18px rgba(20,112,141,.32)}',
      '.kmCalDay.sel .kmCalDot,.kmCalDay.sel .kmCalHol{background:transparent;color:#fff}',
      '.kmCalNum{font-weight:800;font-size:15px;display:block}',
      '.kmCalHol{display:block;margin-top:4px;font-size:10px;line-height:1.2;font-weight:700;max-height:2.4em;overflow:hidden}',
      '.kmCalOffMark{display:block;margin-top:3px;font-size:9px;font-weight:700;letter-spacing:.02em;opacity:.8}',
      '.kmCalLegend{margin:10px 0 0;font-size:12px;color:#4b6270;line-height:1.45}',
      '.kmCalDot{position:absolute;left:50%;bottom:7px;width:8px;height:8px;margin-left:-4px;border-radius:50%;background:#1c86a8}',
      '.kmNoteBook h3{margin:0 0 8px;color:#14607a}',
      '.kmNoteSearch{width:100%;margin:0 0 10px;padding:8px 10px;border:1px solid #c5d8e4;border-radius:10px}',
      '.kmNoteList{display:flex;flex-direction:column;gap:8px;margin:10px 0 14px;max-height:320px;overflow:auto}',
      '.kmNoteItem{display:grid;grid-template-columns:72px 1fr auto;gap:8px;align-items:start;border:1px solid #d4e6ef;border-radius:12px;padding:10px;background:linear-gradient(180deg,#f7fcfe,#f3f8fb)}',
      '.kmNoteItem.is-done{opacity:.62;background:#f3f4f6}',
      '.kmNoteItem.is-done .kmNoteText{text-decoration:line-through}',
      '.kmNoteTime{font-weight:800;color:#1c86a8}',
      '.kmNoteDate{font-size:11px;font-weight:700;color:#5b6b78;margin-bottom:2px}',
      '.kmNoteText{white-space:pre-wrap;word-break:break-word}',
      '.kmNotePersonName{margin-top:4px;font-size:12px;font-weight:700;color:#14607a}',
      '.kmNoteSide{display:flex;flex-direction:column;gap:6px;align-items:flex-end}',
      '.kmNoteActs{display:flex;flex-wrap:wrap;gap:6px;justify-content:flex-end}',
      '.kmNoteActs button,.kmNoteDone{font-size:12px}',
      '.kmNoteDone{display:flex;align-items:center;gap:4px;color:#3d5a68;white-space:nowrap}',
      '.kmNoteAdd{display:grid;grid-template-columns:110px 1fr;gap:8px;align-items:end}',
      '.kmNoteAdd label{display:flex;flex-direction:column;gap:4px;font-size:12px;color:#5b6b78}',
      '.kmNoteAdd textarea{min-height:64px;resize:vertical;width:100%;grid-column:1/-1}',
      '.kmNoteAddActions{grid-column:1/-1;display:flex;gap:8px;flex-wrap:wrap}',
      '.kmNoteEmpty{color:#6b7a89;font-size:13px}',
      '#kmNoteAlarmBar{display:none;position:fixed;top:0;left:0;right:0;z-index:500000;background:#8b1616;color:#fff;padding:14px 18px;align-items:center;justify-content:space-between;gap:12px;box-shadow:0 8px 24px rgba(0,0,0,.35);font-size:16px;font-weight:700}',
      '#kmNoteAlarmBar.is-on{display:flex;animation:kmNoteAlarmPulse 1s ease-in-out infinite}',
      '#kmNoteAlarmBar .kmNoteAlarmText{flex:1;min-width:0}',
      '#kmNoteAlarmBar button{background:#fff!important;color:#8b1616!important;border:0!important;font-weight:800;padding:8px 14px}',
      '@keyframes kmNoteAlarmPulse{0%,100%{filter:brightness(1)}50%{filter:brightness(1.25)}}'
    ].join('');
    document.head.appendChild(s);
  }
  function monthCells(y, m) {
    const first = new Date(y, m - 1, 1);
    let start = first.getDay() - 1;
    if (start < 0) start = 6;
    const days = new Date(y, m, 0).getDate();
    const prevDays = new Date(y, m - 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < start; i++) {
      const d = prevDays - start + 1 + i;
      const dt = new Date(y, m - 2, d);
      cells.push({ date: ymd(dt), num: d, other: true });
    }
    for (let d = 1; d <= days; d++) cells.push({ date: y + '-' + pad(m) + '-' + pad(d), num: d, other: false });
    while (cells.length % 7) {
      const extra = cells.length - start - days + 1;
      const dt = new Date(y, m, extra);
      cells.push({ date: ymd(dt), num: extra, other: true });
    }
    return cells;
  }
  function renderCalendar(root) {
    if (!root) return;
    injectCss();
    const marked = datesWithNotes(viewY, viewM);
    const today = todayYmd();
    const cells = monthCells(viewY, viewM).map(function (c) {
      const cls = ['kmCalDay'];
      const wd = parseYmd(c.date).getDay();
      const hol = holidayNameOf(c.date);
      const memo = hol ? '' : memoNameOf(c.date);
      const off = wd === 0 || wd === 6 || !!hol;
      cls.push('wd' + wd);
      if (c.other) cls.push('other');
      if (off) cls.push('off');
      if (hol) cls.push('holiday');
      if (memo) cls.push('memo');
      if (c.date === today) cls.push('today');
      if (c.date === selected) cls.push('sel');
      if (marked[c.date]) cls.push('hasNote');
      const title = hol || memo || (off ? 'Ոչ աշխատանքային օր' : '');
      const extra = hol
        ? '<span class="kmCalHol">' + esc(hol) + '</span>'
        : (memo
          ? '<span class="kmCalHol">' + esc(memo) + '</span>'
          : (off && !c.other ? '<span class="kmCalOffMark">ոչ աշխ.</span>' : ''));
      const dot = marked[c.date] ? '<span class="kmCalDot"></span>' : '';
      return '<button type="button" class="' + cls.join(' ') + '" data-km-day="' + c.date + '"' + (title ? ' title="' + esc(title) + '"' : '') + '><span class="kmCalNum">' + c.num + '</span>' + extra + dot + '</button>';
    }).join('');
    const q = String(searchQ || '').trim().toLowerCase();
    const editable = canEditNotes();
    function noteItemHtml(n, showDate) {
      const done = !!n.done;
      const person = n.person ? '<div class="kmNotePersonName">' + esc(n.person) + '</div>' : '';
      const dateBit = showDate ? '<div class="kmNoteDate">' + esc(n.date) + '</div>' : '';
      const actions = editable
        ? ('<div class="kmNoteActs"><button type="button" data-km-edit="' + esc(n.id) + '">Խմբագրել</button>' +
          '<button type="button" data-km-del="' + esc(n.id) + '">Ջնջել</button></div>')
        : '';
      const doneCtl = editable
        ? ('<label class="kmNoteDone"><input type="checkbox" data-km-done="' + esc(n.id) + '"' + (done ? ' checked' : '') + '> Կատարված</label>')
        : (done ? '<span class="kmNoteDone">Կատարված</span>' : '');
      return '<div class="kmNoteItem' + (done ? ' is-done' : '') + '" data-id="' + esc(n.id) + '" data-km-goto="' + esc(n.date) + '">' +
        '<div>' + dateBit + '<div class="kmNoteTime">' + esc(n.time || '--') + '</div></div>' +
        '<div class="kmNoteText">' + esc(n.text || '') + person + '</div>' +
        '<div class="kmNoteSide">' + doneCtl + actions + '</div></div>';
    }
    let listHtml;
    let listHint = '';
    if (q) {
      const found = ensureNotes().filter(function (n) { return n && noteSearchBlob(n).indexOf(q) >= 0; })
        .sort(function (a, b) { return String(a.date || '').localeCompare(String(b.date || '')) || String(a.time || '').localeCompare(String(b.time || '')); });
      listHtml = found.length
        ? found.map(function (n) { return noteItemHtml(n, true); }).join('')
        : '<p class="kmNoteEmpty">Ոչինչ չգտնվեց</p>';
      listHint = 'Որոնման արդյունք · սեղմեք տողը՝ օրը բացելու համար։';
    } else {
      const list = notesOn(selected);
      listHtml = list.length
        ? list.map(function (n) { return noteItemHtml(n, false); }).join('')
        : '<p class="kmNoteEmpty">Այս օրը նշում չկա։ Գրիր բլոկնոթում և նշիր ավարտի ժամը։</p>';
    }
    const selDate = parseYmd(selected);
    const title = 'Բլոկնոթ · ' + selDate.getDate() + ' ' + MONTHS[selDate.getMonth()];
    const hint = listHint || 'Յուրաքանչյուր օր առանձին նշումներ ունի։ Կարող եք կապել անձի հետ և նշել կատարվածը։ Ավարտի ժամին մոտենալիս KM-ը ծանուցում և ձայն է տալիս։';
    const editing = editingId ? findNote(editingId) : null;
    const formTime = editing ? String(editing.time || '') : '';
    const formText = editing ? String(editing.text || '') : '';
    const formPerson = editing ? String(editing.person || '') : '';
    const addHtml = editable
      ? [
        '<div class="kmNoteAdd">',
        '<label><span>Ավարտի ժամ</span><input id="kmNoteTime" type="time" value="' + esc(formTime) + '"></label>',
        '<label><span>Անձ</span>' + personSelectHtml(formPerson) + '</label>',
        '<textarea id="kmNoteText" maxlength="2000" placeholder="Գրիր նշումը">' + esc(formText) + '</textarea>',
        '<label class="kmNoteDone" style="margin-top:4px"><input type="checkbox" id="kmNoteWeekly"' + (editing ? ' disabled' : '') + '> Կրկնել շաբաթական (հաջորդ 4 շաբաթ)</label>',
        '<div class="kmNoteAddActions">',
        '<button type="button" id="kmNoteAddBtn" class="primary">' + (editing ? 'Պահպանել փոփոխությունը' : 'Պահպանել') + '</button>',
        (editing ? '<button type="button" id="kmNoteCancelBtn">Չեղարկել</button>' : ''),
        '<button type="button" id="kmNotePrintBtn">Տպել օրվա նշումները</button>',
        '</div></div>'
      ].join('')
      : '<p class="kmNoteEmpty">Դիտորդի իրավունքով նշումը չի փոխվում։</p>' +
        '<div class="kmNoteAddActions"><button type="button" id="kmNotePrintBtn">Տպել օրվա նշումները</button></div>';
    root.innerHTML = [
      '<div class="kmNotesWrap">',
      '<div class="card kmCalCard">',
      '<div class="kmCalHead"><h2>Օրացույց</h2><div class="kmCalNav">',
      '<button type="button" id="kmCalPrev">&larr;</button>',
      '<b>' + MONTHS[viewM - 1] + ' ' + viewY + '</b>',
      '<button type="button" id="kmCalNext">&rarr;</button>',
      '</div></div>',
      '<div class="kmCalGrid">' + WEEK.map(function (w) { return '<div class="kmCalDow">' + w + '</div>'; }).join('') + cells + '</div>',
      '<p class="kmCalLegend">Յուրաքանչյուր շաբաթվա օր՝ իր գույնով։ Շաբաթ/կիրակի և ՀՀ տոները ոչ աշխատանքային են։ Ոսկեգույնը տոն է, մանուշակագույն շերտը՝ հիշատակի օր։ Այս գույները միայն օրացույցում են։</p>',
      holidaysPanelHtml(viewY),
      '</div>',
      '<div class="card kmNoteBook">',
      '<h3>' + title + '</h3>',
      '<p class="muted">' + hint + '</p>',
      '<input id="kmNoteSearch" class="kmNoteSearch" type="search" value="' + esc(searchQ) + '" placeholder="Որոնում (տեքստ, անձ, ժամ)">',
      '<div class="kmNoteList">' + listHtml + '</div>',
      addHtml,
      '</div></div>'
    ].join('');
    bind(root);
    bindHolidays(root);
    if (typeof window.kmApplyLanguage === 'function') {
      try { window.kmApplyLanguage(); } catch (e) {}
    }
  }
  function bindHolidays(root) {
    var yEl = root.querySelector('#kmNoteHolYear');
    var go = root.querySelector('#kmNoteHolYearGo');
    var skip = root.querySelector('#kmNoteHolSkip');
    function applyYear() {
      var y = yEl ? (Number(yEl.value) || viewY) : viewY;
      viewY = y;
      renderCalendar(root);
    }
    if (go) go.onclick = applyYear;
    if (yEl) yEl.onkeydown = function (e) { if (e.key === 'Enter') applyYear(); };
    if (skip) skip.onchange = function () {
      try { localStorage.setItem('kmSkipHolidays', skip.checked ? '1' : '0'); } catch (e) {}
      if (typeof toast === 'function') toast(skip.checked ? 'Տոները կբաց թողնվեն' : 'Տոները կներառվեն');
    };
  }
  function bind(root) {
    const prev = root.querySelector('#kmCalPrev');
    const next = root.querySelector('#kmCalNext');
    if (prev) prev.onclick = function () {
      viewM--;
      if (viewM < 1) { viewM = 12; viewY--; }
      renderCalendar(root);
    };
    if (next) next.onclick = function () {
      viewM++;
      if (viewM > 12) { viewM = 1; viewY++; }
      renderCalendar(root);
    };
    root.querySelectorAll('[data-km-day]').forEach(function (btn) {
      btn.onclick = function () {
        selected = btn.getAttribute('data-km-day');
        searchQ = '';
        const dt = parseYmd(selected);
        viewY = dt.getFullYear();
        viewM = dt.getMonth() + 1;
        renderCalendar(root);
      };
    });
    root.querySelectorAll('[data-km-del]').forEach(function (btn) {
      btn.onclick = function (e) {
        e.stopPropagation();
        if (!canEditNotes()) {
          if (typeof toast === 'function') toast('Դիտորդի իրավունք');
          return;
        }
        const id = btn.getAttribute('data-km-del');
        db.notebookNotes = ensureNotes().filter(function (n) { return n.id !== id; });
        if (editingId === id) editingId = '';
        persist();
        renderCalendar(root);
      };
    });
    root.querySelectorAll('[data-km-edit]').forEach(function (btn) {
      btn.onclick = function (e) {
        e.stopPropagation();
        if (!canEditNotes()) return;
        const id = btn.getAttribute('data-km-edit');
        const n = findNote(id);
        if (!n) return;
        editingId = id;
        selected = n.date || selected;
        searchQ = '';
        const dt = parseYmd(selected);
        viewY = dt.getFullYear();
        viewM = dt.getMonth() + 1;
        renderCalendar(root);
      };
    });
    root.querySelectorAll('[data-km-done]').forEach(function (box) {
      box.onclick = function (e) { e.stopPropagation(); };
      box.onchange = function (e) {
        e.stopPropagation();
        if (!canEditNotes()) {
          box.checked = !box.checked;
          return;
        }
        const n = findNote(box.getAttribute('data-km-done'));
        if (!n) return;
        n.done = !!box.checked;
        n.updatedAt = new Date().toISOString();
        persist();
        renderCalendar(root);
      };
    });
    root.querySelectorAll('[data-km-goto]').forEach(function (el) {
      el.onclick = function (e) {
        const t = e && e.target;
        const node = t && t.nodeType === 1 ? t : (t && t.parentElement);
        if (node && node.closest && (node.closest('button') || node.closest('label') || node.closest('input'))) return;
        const d = el.getAttribute('data-km-goto');
        if (!d) return;
        selected = d;
        searchQ = '';
        const dt = parseYmd(selected);
        viewY = dt.getFullYear();
        viewM = dt.getMonth() + 1;
        renderCalendar(root);
      };
    });
    const search = root.querySelector('#kmNoteSearch');
    if (search) {
      search.oninput = function () {
        searchQ = String(search.value || '');
        if (window._kmNoteSearchT) clearTimeout(window._kmNoteSearchT);
        window._kmNoteSearchT = setTimeout(function () {
          renderCalendar(root);
          const again = root.querySelector('#kmNoteSearch');
          if (again) {
            again.focus();
            const v = again.value;
            try { again.setSelectionRange(v.length, v.length); } catch (e) {}
          }
        }, 280);
      };
    }
    const cancel = root.querySelector('#kmNoteCancelBtn');
    if (cancel) cancel.onclick = function () {
      editingId = '';
      renderCalendar(root);
    };
    const printBtn = root.querySelector('#kmNotePrintBtn');
    if (printBtn) printBtn.onclick = function () {
      window.kmPrintDayNotes(selected);
    };
    const add = root.querySelector('#kmNoteAddBtn');
    if (add) add.onclick = function () {
      if (!canEditNotes()) {
        if (typeof toast === 'function') toast('Դիտորդի իրավունք');
        return;
      }
      const text = String((root.querySelector('#kmNoteText') || {}).value || '').trim();
      const time = String((root.querySelector('#kmNoteTime') || {}).value || '').trim();
      const person = String((root.querySelector('#kmNotePerson') || {}).value || '').trim();
      const weekly = !!(root.querySelector('#kmNoteWeekly') || {}).checked;
      if (!text) {
        if (typeof toast === 'function') toast('Գրիր նշումը');
        return;
      }
      if (editingId) {
        const n = findNote(editingId);
        if (n) {
          n.text = text;
          n.time = time;
          n.person = person;
          n.date = selected;
          n.updatedAt = new Date().toISOString();
        }
        editingId = '';
      } else {
        const base = {
          id: uid(),
          date: selected,
          time: time,
          text: text,
          person: person,
          done: false,
          createdAt: new Date().toISOString()
        };
        ensureNotes().push(base);
        if (weekly) {
          const start = parseYmd(selected);
          for (let w = 1; w <= 4; w++) {
            const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + (w * 7));
            ensureNotes().push({
              id: uid(),
              date: ymd(d),
              time: time,
              text: text,
              person: person,
              done: false,
              recurring: 'weekly',
              createdAt: new Date().toISOString()
            });
          }
          if (typeof toast === 'function') toast('Նշումը կրկնվեց հաջորդ 4 շաբաթներին');
        }
      }
      persist();
      requestNotifPerm();
      renderCalendar(root);
    };
  }
  function checkReminders() {
    const now = new Date();
    const date = ymd(now);
    const minutes = now.getHours() * 60 + now.getMinutes();
    ensureNotes().forEach(function (n) {
      if (!n || n.done || !n.time || n.date !== date) return;
      const p = String(n.time).split(':').map(Number);
      const end = (p[0] || 0) * 60 + (p[1] || 0);
      const left = end - minutes;
      let phase = '';
      if (left === 0 || (left < 0 && left >= -1)) phase = 'now';
      else if (left > 0 && left <= SOON_MIN) phase = 'soon';
      if (!phase) return;
      const key = n.id + ':' + n.date + ':' + n.time + ':' + phase;
      if (alerted.has(key)) return;
      alerted.add(key);
      if (phase === 'now') dismissNoteKey(n.id + ':' + n.date + ':' + n.time);
      const msg = phase === 'now'
        ? ('Նշման ժամանակը հասել է՝ ' + (n.text || ''))
        : ('Նշումը շուտով կավարտվի (' + left + ' րոպե)՝ ' + (n.text || ''));
      playAlarm(msg);
    });
  }
  const DISMISS_KEY = 'km_note_dismissed';
  function dismissedSet() {
    try { return new Set(JSON.parse(localStorage.getItem(DISMISS_KEY) || '[]')); } catch (e) { return new Set(); }
  }
  function persistDismissed(set) {
    try { localStorage.setItem(DISMISS_KEY, JSON.stringify(Array.from(set))); } catch (e) {}
  }
  function dismissNoteKey(key) {
    const s = dismissedSet();
    s.add(String(key || ''));
    persistDismissed(s);
  }
  function noteWhenMs(n) {
    if (!n || !n.date || !n.time) return 0;
    const p = String(n.time).split(':').map(Number);
    const d = parseYmd(n.date);
    if (!(d instanceof Date) || isNaN(+d)) return 0;
    d.setHours(p[0] || 0, p[1] || 0, 0, 0);
    return d.getTime();
  }
  window.kmShowMissedNotes = function () {
    const now = Date.now();
    const dismissed = dismissedSet();
    const missed = ensureNotes().filter(function (n) {
      if (!n || n.done) return false;
      const t = noteWhenMs(n);
      if (!t || t >= now) return false;
      const key = n.id + ':' + n.date + ':' + n.time;
      return !dismissed.has(key);
    });
    const old = document.getElementById('kmMissedNotesBanner');
    if (old) old.remove();
    if (!missed.length) return;
    const el = document.createElement('div');
    el.id = 'kmMissedNotesBanner';
    el.style.cssText = 'position:fixed;left:12px;right:12px;bottom:12px;z-index:350000;background:#7a5a00;color:#fff;padding:12px 14px;border-radius:10px;box-shadow:0 6px 18px rgba(0,0,0,.25);max-width:520px;margin:0 auto';
    el.innerHTML = '<b>Բաց թողնված նշումներ</b><ul style="margin:8px 0;padding-left:18px">' +
      missed.slice(0, 8).map(function (n) {
        const key = n.id + ':' + n.date + ':' + n.time;
        const who = n.person ? (' · ' + esc(n.person)) : '';
        return '<li>' + esc(n.date) + ' ' + esc(n.time) + who + ' — ' + esc(n.text || '') +
          ' <button type="button" data-km-missed="' + esc(key) + '" style="margin-left:6px">Թաքցնել</button></li>';
      }).join('') +
      (missed.length > 8 ? '<li>… +' + (missed.length - 8) + '</li>' : '') +
      '</ul><button type="button" id="kmMissedNotesClose">Փակել</button>';
    document.body.appendChild(el);
    el.querySelectorAll('[data-km-missed]').forEach(function (btn) {
      btn.onclick = function () {
        dismissNoteKey(btn.getAttribute('data-km-missed'));
        window.kmShowMissedNotes();
      };
    });
    const close = el.querySelector('#kmMissedNotesClose');
    if (close) close.onclick = function () {
      missed.forEach(function (n) { dismissNoteKey(n.id + ':' + n.date + ':' + n.time); });
      el.remove();
    };
  };
  function startWatch() {
    if (timer) {
      window.kmShowMissedNotes();
      return;
    }
    requestNotifPerm();
    /* Perf (start-up): creating the AudioContext here cost ~120 ms on every launch. playAlarm() and the first click
       create it on demand, so the alarm still sounds exactly as before. */
    document.addEventListener('click', function () { ensureAudio(); }, true);
    checkReminders();
    window.kmShowMissedNotes();
    timer = setInterval(checkReminders, CHECK_MS);
  }

  window.kmPrintDayNotes = function (dateStr) {
    const date = String(dateStr || selected || todayYmd());
    const list = notesOn(date);
    const rows = list.length
      ? list.map(function (n) {
        return '<tr><td>' + esc(n.time || '—') + '</td><td>' + esc(n.text || '') + '</td><td>' +
          esc(n.person || '') + '</td><td>' + (n.done ? '✓' : '') + '</td></tr>';
      }).join('')
      : '<tr><td colspan="4">Նշում չկա</td></tr>';
    const title = 'Նշումներ · ' + date;
    const body = '<p class="meta">' + esc(parseYmd(date).toLocaleDateString('hy-AM')) + '</p>' +
      '<table><thead><tr><th>Ժամ</th><th>Նշում</th><th>Անձ</th><th>Կատարված</th></tr></thead><tbody>' +
      rows + '</tbody></table>';
    if (typeof window.kmPrintNativeFromHtml === 'function') {
      const html = '<!doctype html><html lang="hy"><head><meta charset="utf-8"><title>' + esc(title) + '</title>' +
        '<style>body{font-family:"Segoe UI",Arial,sans-serif;padding:14mm;color:#111}h1{font-size:18px}' +
        'table{border-collapse:collapse;width:100%;margin-top:10px}th,td{border:1px solid #333;padding:6px 8px;font-size:12px;text-align:left}' +
        'th{background:#e9eef2}.meta{font-size:12px;color:#444}</style></head><body><h1>' + esc(title) + '</h1>' +
        body + '</body></html>';
      window.kmPrintNativeFromHtml(title, html);
      return;
    }
    const w = window.open('', '_blank');
    if (!w) {
      if (typeof toast === 'function') toast('Պատուհանը չբացվեց');
      return;
    }
    w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>' + esc(title) + '</title></head><body><h1>' +
      esc(title) + '</h1>' + body + '</body></html>');
    w.document.close();
    setTimeout(function () { try { w.print(); } catch (e) {} }, 400);
  };

  window.kmRenderNotesCalendar = function (root) {
    if (!root) return;
    const t = parseYmd(selected);
    viewY = t.getFullYear();
    viewM = t.getMonth() + 1;
    renderCalendar(root);
    startWatch();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startWatch);
  } else {
    startWatch();
  }
})();
