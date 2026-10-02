/* KM extra tools: kiosk, free people, contract reminders, SMS copy, USB transfer, duty order */
(function () {
  'use strict';

  function esc(s) {
    return typeof window.esc === 'function'
      ? window.esc(s)
      : String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
      });
  }
  function toast(msg, type) {
    if (typeof window.kmNotify === 'function') window.kmNotify(msg, type || 'ok');
    else if (typeof window.toast === 'function') window.toast(msg);
  }
  function kmHyLongDate(dt) {
    dt = dt instanceof Date ? dt : new Date(dt);
    if (isNaN(dt.getTime())) dt = new Date();
    var wd = ['կիրակի', 'երկուշաբթի', 'երեքշաբթի', 'չորեքշաբթի', 'հինգշաբթի', 'ուրբաթ', 'շաբաթ'];
    var mo = ['հունվարի', 'փետրվարի', 'մարտի', 'ապրիլի', 'մայիսի', 'հունիսի', 'հուլիսի', 'օգոստոսի', 'սեպտեմբերի', 'հոկտեմբերի', 'նոյեմբերի', 'դեկտեմբերի'];
    return wd[dt.getDay()] + ', ' + dt.getDate() + ' ' + mo[dt.getMonth()] + ' ' + dt.getFullYear() + ' թ.';
  }
  window.kmHyLongDate = kmHyLongDate;
  function rankOf(p) {
    if (p && p.rank != null && typeof window.kmRankText === 'function') return window.kmRankText(p.rank);
    return String((p && p.rank) || '');
  }
  function copyText(text) {
    const t = String(text || '');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(t).then(function () { return true; }).catch(function () {
        return copyFallback(t);
      });
    }
    return Promise.resolve(copyFallback(t));
  }
  function copyFallback(t) {
    try {
      const ta = document.createElement('textarea');
      ta.value = t;
      ta.setAttribute('readonly', 'readonly');
      ta.style.cssText = 'position:fixed;left:-9999px;top:0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch (e) { return false; }
  }
  function warnDays() {
    try { return Math.max(1, Number(localStorage.getItem('kmContractWarnDays')) || 30); } catch (e) { return 30; }
  }
  function setWarnDays(n) {
    try { localStorage.setItem('kmContractWarnDays', String(Math.max(1, Number(n) || 30))); } catch (e) {}
  }
  function absenceOpts() {
    return {
      absence: function (name, dt) {
        if (typeof window.kmPersonAbsence === 'function') return window.kmPersonAbsence(name, dt);
        if (typeof window.isPersonOnVacation === 'function' && window.isPersonOnVacation(name, dt)) return 'vacation';
        return null;
      },
      isBlocked: function (p) {
        if (typeof window.kmPersonNotPlannable === 'function') return window.kmPersonNotPlannable(p);
        return typeof window.kmPersonIsBlocked === 'function' && window.kmPersonIsBlocked(p);
      }
    };
  }
  function personPhoto(name) {
    const people = (typeof db !== 'undefined' && db && Array.isArray(db.people)) ? db.people : [];
    const want = String(name || '').trim();
    for (let i = 0; i < people.length; i++) {
      if (String(people[i].name || '').trim() !== want) continue;
      const src = typeof window.kmPersonPhotoSrc === 'function' ? window.kmPersonPhotoSrc(people[i]) : String(people[i].photo || '');
      if (/^kmphoto:/i.test(src) || /^data:image\//i.test(src)) return src.replace(/"/g, '');
      return '';
    }
    return '';
  }
  function printSheet(title, body) {
    const html = '<!doctype html><html lang="hy"><head><meta charset="utf-8"><title>' + esc(title) + '</title>' +
      '<style>body{font-family:"Segoe UI",Arial,sans-serif;padding:14mm;color:#111}h1{font-size:18px;margin:0 0 8px}' +
      'table{border-collapse:collapse;width:100%;margin-top:10px}th,td{border:1px solid #333;padding:6px 8px;font-size:12px;text-align:left}' +
      'th{background:#e9eef2}.meta{font-size:12px;color:#444}@media print{button{display:none}}</style></head><body>' +
      '<h1>' + esc(title) + '</h1>' + body +
      '<p class="meta">KM · ' + esc(new Date().toLocaleString('hy-AM')) + '</p></body></html>';
    if (typeof window.kmPrintNativeFromHtml === 'function') window.kmPrintNativeFromHtml(title, html);
    else {
      const w = window.open('', '_blank');
      if (!w) { toast('Պատուհանը չբացվեց', 'error'); return; }
      w.document.write(html);
      w.document.close();
      setTimeout(function () { try { w.print(); } catch (e) {} }, 400);
    }
  }

  if (!document.getElementById('km-extra-css')) {
    const st = document.createElement('style');
    st.id = 'km-extra-css';
    st.textContent =
      'body.km-kiosk .app>aside{display:none!important}' +
      '#kmDutyKiosk{position:fixed;inset:0;z-index:500000;background:#0b1a33;color:#f4f7fa;display:flex;flex-direction:column;padding:28px 36px;overflow:auto}' +
      '#kmDutyKiosk h1{margin:0 0 8px;font-size:42px;letter-spacing:.04em}' +
      '#kmDutyKiosk .kmKioskDate{opacity:.8;margin:0 0 22px;font-size:22px}' +
      '#kmDutyKiosk .kmKioskGrid{display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(280px,1fr))}' +
      '#kmDutyKiosk .kmKioskCard{background:#13263f;border:1px solid #2a4668;border-radius:14px;padding:18px 20px;display:flex;gap:14px;align-items:center}' +
      '#kmDutyKiosk .kmKioskPhoto{width:88px;height:88px;object-fit:cover;border-radius:12px;background:#0b1a33;flex:0 0 auto}' +
      '#kmDutyKiosk .kmKioskName{font-size:28px;font-weight:700}' +
      '#kmDutyKiosk .kmKioskMeta{margin-top:8px;font-size:18px;opacity:.9}' +
      '#kmDutyKiosk .kmKioskEmpty{font-size:28px;opacity:.7}' +
      '#kmDutyKiosk .kmKioskExit{position:absolute;top:16px;right:20px}' +
      '#kmDayGlance .kmGlanceDash{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:0 0 14px}' +
      '#kmDayGlance .kmGlanceCol{min-height:140px}' +
      '#kmDayGlance .kmGlanceMeta{display:block;margin-top:4px;font-size:12px}' +
      '#kmDayGlance .kmGlanceNames{width:100%;margin:10px 0 0;padding:0;list-style:none;font-size:13px;line-height:1.45}' +
      '#kmDayGlance .kmGlanceNames li{margin:0 0 4px}' +
      '@media(max-width:780px){#kmDayGlance .kmGlanceDash{grid-template-columns:1fr}}' +
      '#kmContractOverdue{border-color:#e7a3a3;background:#fff4f4}';
    document.head.appendChild(st);
  }

  window.kmCopyTodayDutySms = function () {
    const rows = typeof window.kmTodayDutyRows === 'function' ? window.kmTodayDutyRows() : [];
    const d = new Date().toLocaleDateString('hy-AM');
    let text;
    if (!rows.length) text = 'Այսօր (' + d + ') հերթապահ նշանակված չէ։';
    else {
      text = 'Այսօր հերթապահ եք (' + d + ').\n' + rows.map(function (r, i) {
        const rank = rankOf(r);
        return (i + 1) + '. ' + (rank ? rank + ' ' : '') + r.name +
          (r.graphName ? ' — ' + r.graphName : '') +
          (r.phone ? ' · ' + r.phone : '');
      }).join('\n');
    }
    copyText(text).then(function (ok) {
      toast(ok ? 'Տեքստը պատճենվեց։ Կարող եք ուղարկել Viber/WhatsApp։' : 'Չհաջողվեց պատճենել։', ok ? 'ok' : 'error');
    });
  };

  function kioskCardsHtml() {
    const rows = typeof window.kmTodayDutyRows === 'function' ? window.kmTodayDutyRows() : [];
    if (!rows.length) return '<p class="kmKioskEmpty">Այսօր հերթապահ նշանակված չէ</p>';
    return '<div class="kmKioskGrid">' + rows.map(function (r) {
      const photo = personPhoto(r.name);
      return '<div class="kmKioskCard">' +
        (photo ? '<img class="kmKioskPhoto" alt="" src="' + photo + '">' : '') +
        '<div><div class="kmKioskName">' + esc(r.name) + '</div>' +
        '<div class="kmKioskMeta">' + esc(rankOf(r)) + (r.unit ? ' · ' + esc(r.unit) : '') + '</div>' +
        '<div class="kmKioskMeta">' + esc(r.graphName || '') + (r.phone ? ' · ' + esc(r.phone) : '') + '</div></div></div>';
    }).join('') + '</div>';
  }

  window.kmOpenDutyKiosk = function () {
    if (typeof window.kmRequireGrant === 'function' && !window.kmRequireGrant('dutyKiosk')) return;
    const old = document.getElementById('kmDutyKiosk');
    if (old) {
      if (old._kmTimer) clearInterval(old._kmTimer);
      old.remove();
    }
    const wrap = document.createElement('div');
    wrap.id = 'kmDutyKiosk';
    wrap.setAttribute('role', 'dialog');
    wrap.innerHTML = '<button type="button" class="kmKioskExit kmBackBtn" id="kmKioskExitBtn">' + ((typeof window.KM_BACK_LABEL === 'string' && window.KM_BACK_LABEL) || '← Վերադարձ') + ' (Esc)</button>' +
      '<h1>Այսօր հերթապահ</h1><p class="kmKioskDate" id="kmKioskDate"></p><div id="kmKioskBody"></div>';
    document.body.appendChild(wrap);
    document.body.classList.add('km-kiosk');
    function paint() {
      const dateEl = document.getElementById('kmKioskDate');
      const body = document.getElementById('kmKioskBody');
      if (dateEl) dateEl.textContent = kmHyLongDate(new Date());
      if (body) body.innerHTML = kioskCardsHtml();
    }
    paint();
    wrap._kmTimer = setInterval(paint, 60000);
    function close() {
      if (wrap._kmTimer) clearInterval(wrap._kmTimer);
      wrap.remove();
      document.body.classList.remove('km-kiosk');
      document.removeEventListener('keydown', onKey);
    }
    function onKey(e) { if (e.key === 'Escape') close(); }
    document.getElementById('kmKioskExitBtn').onclick = close;
    wrap.addEventListener('dblclick', close);
    document.addEventListener('keydown', onKey);
  };

  function freeDateFromInput() {
    const inp = document.getElementById('kmFreeDate');
    const raw = String((inp && inp.value) || '');
    const p = raw.split('-').map(Number);
    return p.length === 3 ? new Date(p[0], p[1] - 1, p[2], 12, 0, 0) : new Date();
  }
  function freePeopleList(dt) {
    const logic = window.kmOpsLogic || {};
    return logic.freePeopleOnDate
      ? logic.freePeopleOnDate(typeof db !== 'undefined' ? db : {}, dt, absenceOpts())
      : [];
  }

  window.kmOpenFreePeople = function () {
    if (typeof window.kmRequireGrant === 'function' && !window.kmRequireGrant('freePeople')) return;
    const host = document.getElementById('content');
    if (!host) return;
    const today = new Date();
    const iso = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    host.innerHTML = '<div class="card">' +
      '<div class="toolbar kmBackToolbar" style="margin-bottom:10px">' +
      '<button type="button" class="kmBackBtn" onclick="kmReportsBack()">← Վերադարձ</button></div>' +
      '<h3 class="kmLawsHubTitle" style="margin-top:0">Ո՞վ է ազատ այս օրը</h3>' +
      '<p class="muted">Անձինք, որոնք այդ օրը հերթապահ չեն, արձակուրդ/հիվանդ/գործուղում/ուսում չեն և արգելափակված չեն։ Բոլոր վերակարգերի գրաֆիկները։</p>' +
      '<label>Ամսաթիվ <input id="kmFreeDate" type="date" value="' + iso + '"></label> ' +
      '<button type="button" class="primary" onclick="kmRenderFreePeople()">Ցույց տալ</button>' +
      '<div class="toolbar" style="margin-top:10px">' +
      '<button type="button" onclick="kmCopyFreePeople()">Պատճենել տեքստ</button>' +
      '<button type="button" onclick="kmPrintFreePeople()">Տպել</button></div>' +
      '<div id="kmFreeRoot" style="margin-top:12px"></div></div>';
    page = 'freePeople';
    window.page = 'freePeople';
    try {
      if (typeof kmCurrentView !== 'undefined') kmCurrentView = { kind: 'page', value: 'freePeople' };
    } catch (eV) {}
    const pt = document.getElementById('pageTitle');
    if (pt) pt.textContent = 'Ազատ անձինք';
    window.kmRenderFreePeople();
  };

  window.kmRenderFreePeople = function () {
    const root = document.getElementById('kmFreeRoot');
    if (!root) return;
    const dt = freeDateFromInput();
    const list = freePeopleList(dt);
    window._kmFreeLast = { dt: dt, list: list };
    const rows = list.map(function (r) {
      return '<tr><td>' + esc(rankOf(r)) + '</td><td class="kmPersonIdentity">' + esc(r.name) + '</td><td>' +
        esc(r.unit || '') + '</td><td>' + esc(r.phone || '—') + '</td></tr>';
    }).join('') || '<tr><td colspan="4" class="muted">Ազատ անձ չկա</td></tr>';
    root.innerHTML = '<p><b>' + list.length + '</b> ազատ · ' + esc(dt.toLocaleDateString('hy-AM')) + '</p>' +
      '<div class="gridwrap"><table class="grid"><thead><tr><th>Կոչում</th><th>Անձ</th><th>Ստորաբաժանում</th><th>Հեռախոս</th></tr></thead><tbody>' +
      rows + '</tbody></table></div>';
  };

  window.kmCopyFreePeople = function () {
    const dt = (window._kmFreeLast && window._kmFreeLast.dt) || freeDateFromInput();
    const list = (window._kmFreeLast && window._kmFreeLast.list) || freePeopleList(dt);
    const d = dt.toLocaleDateString('hy-AM');
    let text;
    if (!list.length) text = 'Ազատ անձ չկա (' + d + ')։';
    else {
      text = 'Ազատ անձինք (' + d + ').\n' + list.map(function (r, i) {
        const rank = rankOf(r);
        return (i + 1) + '. ' + (rank ? rank + ' ' : '') + r.name +
          (r.unit ? ' — ' + r.unit : '') +
          (r.phone ? ' · ' + r.phone : '');
      }).join('\n');
    }
    copyText(text).then(function (ok) {
      toast(ok ? 'Ազատների ցուցակը պատճենվեց։' : 'Չհաջողվեց պատճենել։', ok ? 'ok' : 'error');
    });
  };

  window.kmPrintFreePeople = function () {
    const dt = (window._kmFreeLast && window._kmFreeLast.dt) || freeDateFromInput();
    const list = (window._kmFreeLast && window._kmFreeLast.list) || freePeopleList(dt);
    const rows = list.map(function (r, i) {
      return '<tr><td>' + (i + 1) + '</td><td>' + esc(rankOf(r)) + '</td><td>' + esc(r.name) + '</td><td>' +
        esc(r.unit || '') + '</td><td>' + esc(r.phone || '') + '</td></tr>';
    }).join('') || '<tr><td colspan="5">Ազատ անձ չկա</td></tr>';
    printSheet('Ազատ անձինք — ' + dt.toLocaleDateString('hy-AM'),
      '<table><thead><tr><th>№</th><th>Կոչում</th><th>Անձ</th><th>Ստորաբաժանում</th><th>Հեռախոս</th></tr></thead><tbody>' +
      rows + '</tbody></table>');
  };

  function pad2(n) { return String(n).padStart(2, '0'); }
  function toIso(dt) {
    const d = dt instanceof Date && !isNaN(dt.getTime()) ? dt : new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  function parseIso(raw) {
    const p = String(raw || '').split('-').map(Number);
    return p.length === 3 ? new Date(p[0], p[1] - 1, p[2], 12, 0, 0) : new Date();
  }
  function docsDate() {
    const el = document.getElementById('kmDocsDate');
    return el ? parseIso(el.value) : new Date();
  }
  window.kmDocsDate = docsDate;
  function mapDutyRows(rows) {
    return (rows || []).map(function (x) {
      return { graphName: x.graphName || '', rank: rankOf(x), name: x.name, unit: x.unit || '', phone: x.phone || '' };
    });
  }
  function dutyRowsOn(dt) {
    return typeof window.kmTodayDutyRows === 'function' ? (window.kmTodayDutyRows(dt) || []) : [];
  }
  function weekDates(dt) {
    const d = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate(), 12, 0, 0);
    const dow = d.getDay();
    const off = dow === 0 ? -6 : 1 - dow;
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() + off, 12, 0, 0);
    const out = [];
    for (let i = 0; i < 7; i++) out.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i, 12, 0, 0));
    return out;
  }
  function monthDates(dt) {
    const y = dt.getFullYear(), m = dt.getMonth();
    const n = new Date(y, m + 1, 0).getDate();
    const out = [];
    for (let i = 1; i <= n; i++) out.push(new Date(y, m, i, 12, 0, 0));
    return out;
  }
  function dayHeading(dt) {
    return kmHyLongDate(dt);
  }
  async function sendDutyDoc(payload) {
    if (!window.kmNative || !window.kmNative.export || !window.kmNative.export.dutyOrderWord) {
      toast('Հրամանը հասանելի է միայն KM desktop-ում', 'error');
      return;
    }
    try {
      const r = await window.kmNative.export.dutyOrderWord(payload);
      const out = payload.asPdf ? (r.pdf || r.output) : r.output;
      toast((payload.asPdf ? 'Հրամանի PDF՝ ' : 'Հրամանը պատրաստ է՝ ') + (out || ''), 'ok');
      if (out && window.kmNative.shell && window.kmNative.shell.showItemInFolder) {
        await window.kmNative.shell.showItemInFolder(out);
      }
    } catch (e) {
      toast((e && e.message) || (payload.asPdf ? 'Հրամանի PDF-ը չստեղծվեց։ Word է պետք։' : 'Հրամանը չստեղծվեց։ Word է պետք։'), 'error');
    }
  }

  async function exportDutyOrder(asPdf, dateObj) {
    const dt = dateObj instanceof Date ? dateObj : new Date();
    const rows = mapDutyRows(dutyRowsOn(dt));
    const f = typeof window.kmFormalData === 'function' ? window.kmFormalData() : {};
    const today = new Date();
    const isToday = dt.getFullYear() === today.getFullYear() && dt.getMonth() === today.getMonth() && dt.getDate() === today.getDate();
    const label = dt.toLocaleDateString('hy-AM');
    await sendDutyDoc({
      name: 'KM_hraman_' + toIso(dt),
      title: isToday ? 'Հրաման — այսօրվա հերթապահներ' : 'Հրաման — հերթապահներ',
      date: label,
      note: 'Կազմված է KM գրաֆիկներից։',
      asPdf: !!asPdf,
      formal: f,
      rows: rows
    });
  }
  window.kmExportTodayOrderWord = function () {
    toast('Օրվա հրաման (Word) հեռացված է։ Օգտագործեք «Հրամանի նախագիծ».', 'warn');
  };
  window.kmExportTodayOrderPdf = function () {
    toast('Օրվա հրաման (PDF) հեռացված է։ Օգտագործեք «Հրամանի նախագիծ».', 'warn');
  };
  window.kmExportDutyOrderWord = function () { return exportDutyOrder(false, docsDate()); };
  window.kmExportDutyOrderPdf = function () { return exportDutyOrder(true, docsDate()); };

  window.kmPrintDutyForDate = function () {
    const dt = docsDate();
    const list = dutyRowsOn(dt);
    const rows = list.map(function (r, i) {
      return '<tr><td>' + (i + 1) + '</td><td>' + esc(r.graphName || '') + '</td><td>' + esc(rankOf(r)) + '</td><td>' +
        esc(r.name) + '</td><td>' + esc(r.unit || '') + '</td><td>' + esc(r.phone || '') + '</td></tr>';
    }).join('') || '<tr><td colspan="6">Հերթապահ նշանակված չէ</td></tr>';
    printSheet('Հերթապահներ — ' + dt.toLocaleDateString('hy-AM'),
      '<table><thead><tr><th>№</th><th>Վերակարգ</th><th>Կոչում</th><th>Անուն</th><th>Ստորաբաժանում</th><th>Հեռախոս</th></tr></thead><tbody>' +
      rows + '</tbody></table>');
  };

  window.kmCopyDutySmsForDate = function () {
    const dt = docsDate();
    const rows = dutyRowsOn(dt);
    const d = dt.toLocaleDateString('hy-AM');
    let text;
    if (!rows.length) text = '(' + d + ') հերթապահ նշանակված չէ։';
    else {
      text = 'Հերթապահ եք (' + d + ').\n' + rows.map(function (r, i) {
        const rank = rankOf(r);
        return (i + 1) + '. ' + (rank ? rank + ' ' : '') + r.name +
          (r.graphName ? ' — ' + r.graphName : '') +
          (r.phone ? ' · ' + r.phone : '');
      }).join('\n');
    }
    copyText(text).then(function (ok) {
      toast(ok ? 'Տեքստը պատճենվեց։' : 'Չհաջողվեց պատճենել։', ok ? 'ok' : 'error');
    });
  };

  async function exportWeekPack(asPdf) {
    const dt = docsDate();
    const days = weekDates(dt);
    const f = typeof window.kmFormalData === 'function' ? window.kmFormalData() : {};
    const sections = days.map(function (d) {
      return { heading: dayHeading(d), date: d.toLocaleDateString('hy-AM'), rows: mapDutyRows(dutyRowsOn(d)) };
    });
    await sendDutyDoc({
      name: 'KM_hraman_shabat_' + toIso(days[0]),
      title: 'Հրաման — շաբաթվա հերթապահներ',
      date: days[0].toLocaleDateString('hy-AM') + ' – ' + days[6].toLocaleDateString('hy-AM'),
      note: 'Շաբաթը՝ երկուշաբթիից կիրակի։ Կազմված է KM գրաֆիկներից։',
      asPdf: !!asPdf,
      formal: f,
      sections: sections,
      rows: sections[0] ? sections[0].rows : []
    });
  }
  async function exportMonthPack(asPdf) {
    const dt = docsDate();
    const days = monthDates(dt);
    const f = typeof window.kmFormalData === 'function' ? window.kmFormalData() : {};
    const rows = [];
    days.forEach(function (d) {
      mapDutyRows(dutyRowsOn(d)).forEach(function (r) {
        rows.push({ day: String(d.getDate()), date: d.toLocaleDateString('hy-AM'), graphName: r.graphName, rank: r.rank, name: r.name, unit: r.unit, phone: r.phone });
      });
    });
    await sendDutyDoc({
      name: 'KM_hraman_amis_' + dt.getFullYear() + '-' + pad2(dt.getMonth() + 1),
      title: 'Հրաման — ամսվա հերթապահներ',
      date: (dt.getMonth() + 1) + '/' + dt.getFullYear(),
      note: 'Ամսվա բոլոր օրերի հերթապահները մեկ աղյուսակով։ Կազմված է KM գրաֆիկներից։',
      asPdf: !!asPdf,
      layout: 'flat',
      formal: f,
      rows: rows
    });
  }
  window.kmExportWeekOrderWord = function () { return exportWeekPack(false); };
  window.kmExportWeekOrderPdf = function () { return exportWeekPack(true); };
  window.kmExportMonthOrderWord = function () { return exportMonthPack(false); };
  window.kmExportMonthOrderPdf = function () { return exportMonthPack(true); };

  window.kmDocsPackRefresh = function () {
    const root = document.getElementById('kmDocsPreview');
    if (!root) return;
    const dt = docsDate();
    const list = dutyRowsOn(dt);
    const rows = list.map(function (r) {
      return '<tr><td>' + esc(r.graphName || '') + '</td><td>' + esc(rankOf(r)) + '</td><td class="kmPersonIdentity">' +
        esc(r.name) + '</td><td>' + esc(r.unit || '') + '</td><td>' + esc(r.phone || '—') + '</td></tr>';
    }).join('') || '<tr><td colspan="5" class="muted">Այդ օրը հերթապահ նշանակված չէ</td></tr>';
    const week = weekDates(dt);
    root.innerHTML = '<p><b>' + list.length + '</b> հերթապահ · ' + esc(dayHeading(dt)) + '</p>' +
      '<p class="muted">Շաբաթ՝ ' + esc(week[0].toLocaleDateString('hy-AM')) + ' – ' + esc(week[6].toLocaleDateString('hy-AM')) +
      ' · Ամիս՝ ' + (dt.getMonth() + 1) + '/' + dt.getFullYear() + '</p>' +
      '<div class="gridwrap"><table class="grid"><thead><tr><th>Վերակարգ</th><th>Կոչում</th><th>Անձ</th><th>Ստորաբաժանում</th><th>Հեռախոս</th></tr></thead><tbody>' +
      rows + '</tbody></table></div>';
  };

  window.kmOpenDocsPack = function () {
    if (typeof window.kmRequireGrant === 'function' && !window.kmRequireGrant('docsPack')) return;
    const host = document.getElementById('content');
    if (!host) return;
    const iso = toIso(new Date());
    host.innerHTML = '<div class="card"><h3>Հրամաններ և փաստաթղթերի փաթեթ</h3>' +
      '<p class="muted">Ընտրիր օրը։ Ավտոմատ կկազմվի այդ օրվա, շաբաթվա (երկուշաբթի–կիրակի) կամ ամբողջ ամսվա հրամանը՝ ձևանմուշով, Word կամ PDF։</p>' +
      '<label>Ամսաթիվ <input id="kmDocsDate" type="date" value="' + iso + '" onchange="kmDocsPackRefresh()"></label> ' +
      '<button type="button" class="primary" onclick="kmDocsPackRefresh()">Ցույց տալ օրը</button>' +
      '<h4 style="margin:16px 0 8px">Ընտրված օր</h4>' +
      '<div class="toolbar">' +
      '<button type="button" onclick="kmExportDutyOrderWord()">Հրաման Word</button>' +
      '<button type="button" onclick="kmExportDutyOrderPdf()">Հրաման PDF</button>' +
      '<button type="button" onclick="kmPrintDutyForDate()">Տպել</button>' +
      '<button type="button" onclick="kmCopyDutySmsForDate()">Պատճենել տեքստ</button></div>' +
      '<h4 style="margin:16px 0 8px">Շաբաթվա փաթեթ</h4>' +
      '<div class="toolbar">' +
      '<button type="button" onclick="kmExportWeekOrderWord()">Շաբաթ Word</button>' +
      '<button type="button" onclick="kmExportWeekOrderPdf()">Շաբաթ PDF</button></div>' +
      '<h4 style="margin:16px 0 8px">Ամսվա փաթեթ</h4>' +
      '<div class="toolbar">' +
      '<button type="button" onclick="kmExportMonthOrderWord()">Ամիս Word</button>' +
      '<button type="button" onclick="kmExportMonthOrderPdf()">Ամիս PDF</button></div>' +
      '<h4 style="margin:16px 0 8px">Հրամանի նախագիծ (ձև)</h4>' +
      '<p class="muted">Զորամասի հրաման և քաղվածք՝ խմբագրվող նախագիծ, օրինակը վերցված է Քանաքեռի Word ձևից։</p>' +
      '<div class="toolbar"><button type="button" class="primary" onclick="kmOpenOrderDraft(\'docs\')">Բացել նախագիծը</button></div>' +
      '<div id="kmDocsPreview" style="margin-top:12px"></div>' +
      '<div class="toolbar" style="margin-top:10px"><button type="button" onclick="kmReportsBack()">← Վերադարձ</button></div></div>';
    page = 'docsPack';
    window.page = 'docsPack';
    const pt = document.getElementById('pageTitle');
    if (pt) pt.textContent = 'Փաստաթղթեր';
    window.kmDocsPackRefresh();
  };

  window.kmUsbExportUserData = async function () {
    if (typeof window.kmCanEdit === 'function' && !window.kmCanEdit()) { toast('Դիտորդի իրավունք', 'error'); return; }
    if (!window.kmNative || !window.kmNative.usb) { toast('USB տեղափոխումը միայն desktop KM-ում է', 'error'); return; }
    const pw = prompt('Գաղտնաբառ USB փաթեթի համար');
    if (!pw) return;
    const includeLibrary = confirm('Ներառե՞լ ֆայլերի պահոցի ֆայլերը USB-ում։ Արտոնագիրը չի պատճենվում։'); /* KM_RENAME_LEFTOVERS_V1 */
    try {
      if (typeof save === 'function') await save(true);
      const r = await window.kmNative.usb.export(pw, { includeLibrary: !!includeLibrary });
      if (r && r.cancelled) return;
      toast('USB փաթեթ՝ ' + (r.path || '') + (r.library ? ' · ֆայլերի պահոց՝ ' + r.library : '') /* KM_RENAME_LEFTOVERS_V1 */ + (r.photos ? ' · լուսանկարներ՝ ' + r.photos : ''), 'ok');
    } catch (e) {
      toast((e && e.message) || 'USB արտահանումը ձախողվեց', 'error');
    }
  };

  window.kmUsbImportUserData = async function () {
    if (typeof window.kmCanEdit === 'function' && !window.kmCanEdit()) { toast('Դիտորդի իրավունք', 'error'); return; }
    if (!window.kmNative || !window.kmNative.usb) { toast('USB տեղափոխումը միայն desktop KM-ում է', 'error'); return; }
    const pw = prompt('USB փաթեթի գաղտնաբառ');
    if (!pw) return;
    if (!confirm('Ներկա տվյալները կփոխարինվեն USB փաթեթով։ Շարունակե՞լ։')) return;
    try {
      const r = await window.kmNative.usb.import({ password: pw });
      if (r && r.cancelled) return;
      let data = r && r.snapshot;
      if (typeof data === 'string') data = JSON.parse(data);
      if (!data || typeof data !== 'object') throw new Error('Փաթեթում բազա չկա');
      if (typeof db !== 'undefined') {
        if (typeof window.kmApplyDbSnapshot === 'function') {
          if (!window.kmApplyDbSnapshot(data)) return;
        } else {
          Object.keys(db).forEach(function (k) { delete db[k]; });
          Object.assign(db, data);
        }
        if (typeof normalize === 'function') normalize();
        if (typeof save === 'function') await save(true);
      }
      if (r.photosSibling && confirm('Ներմուծե՞լ նաև անձնակազմի լուսանկարները։')) {
        try {
          const ph = await window.kmNative.usb.importPhotos(r.photosSibling);
          if (ph && ph.ok) toast('Լուսանկարները ներմուծվեցին', 'ok');
        } catch (pe) {
          toast((pe && pe.message) || 'Լուսանկարները չներմուծվեցին', 'error');
        }
      }
      if (r.librarySibling && confirm('Ներմուծե՞լ նաև ֆայլերի պահոցի ֆայլերը։')) { /* KM_RENAME_LEFTOVERS_V1 */
        try {
          const lib = await window.kmNative.usb.importLibrary(r.librarySibling);
          if (lib && lib.ok) toast('Ֆայլերի պահոցը ներմուծվեց', 'ok'); /* KM_RENAME_LEFTOVERS_V1 */
        } catch (le) {
          toast((le && le.message) || 'Ֆայլերի պահոցը չներմուծվեց', 'error'); /* KM_RENAME_LEFTOVERS_V1 */
        }
      } else if (!r.librarySibling && confirm('Ընտրե՞լ KM_USB_Library պանակը ներմուծման համար։')) {
        try {
          const lib = await window.kmNative.usb.importLibrary('');
          if (lib && lib.cancelled) { /* skip */ }
          else if (lib && lib.ok) toast('Ֆայլերի պահոցը ներմուծվեց', 'ok'); /* KM_RENAME_LEFTOVERS_V1 */
        } catch (le) {
          toast((le && le.message) || 'Ֆայլերի պահոցը չներմուծվեց', 'error'); /* KM_RENAME_LEFTOVERS_V1 */
        }
      }
      toast('USB ներմուծումը հաջողվեց', 'ok');
      if (typeof render === 'function') render();
      else location.reload();
    } catch (e) {
      toast((e && e.message) || 'USB ներմուծումը ձախողվեց', 'error');
    }
  };

  window.kmRenderContractReminders = function () {
    const logic = window.kmOpsLogic || {};
    if (!logic.contractReminders) return '';
    const days = warnDays();
    const now = new Date();
    const data = typeof db !== 'undefined' ? db : {};
    const overdue = logic.contractOverdue ? logic.contractOverdue(data, now) : [];
    const list = logic.contractReminders(data, days, now);
    if (!overdue.length && !list.length) return '';
    let html = '';
    if (overdue.length) {
      const rows = overdue.map(function (r) {
        return '<tr><td>' + esc(rankOf(r)) + '</td><td>' + esc(r.name) + '</td><td>' + esc(r.unit || '') +
          '</td><td>' + esc(r.endDate) + '</td><td><b>' + r.daysLeft + '</b></td></tr>';
      }).join('');
      html += '<div class="card" id="kmContractOverdue" style="border-color:#e7a3a3;background:#fff4f4">' +
        '<h3 style="margin:0 0 8px">Ժամկետանց պայմանագրեր</h3>' +
        '<p class="muted" style="margin:0 0 8px">Ավարտի ամսաթիվը անցել է։ Կարմիր ցուցակ՝ Անձնակազմի «Ավարտ» դաշտից։</p>' +
        '<div class="gridwrap"><table class="grid"><thead><tr><th>Կոչում</th><th>Անձ</th><th>Ստորաբաժանում</th><th>Ավարտ</th><th>Օր</th></tr></thead><tbody>' +
        rows + '</tbody></table></div></div>';
    }
    if (list.length) {
      const rows = list.map(function (r) {
        return '<tr><td>' + esc(rankOf(r)) + '</td><td>' + esc(r.name) + '</td><td>' + esc(r.unit || '') +
          '</td><td>' + esc(r.endDate) + '</td><td><b>' + r.daysLeft + '</b></td></tr>';
      }).join('');
      html += '<div class="card" id="kmContractReminders" style="border-color:#e5bc7a;background:#fff8e8">' +
        '<h3 style="margin:0 0 8px">Ժամկետի հիշեցում (' + days + ' օր)</h3>' +
        '<p class="muted" style="margin:0 0 8px">Պայմանագրի / ծառայության ավարտ՝ մոտ օրերին։ Դաշտը լրացվում է Անձնակազմում։</p>' +
        '<div class="gridwrap"><table class="grid"><thead><tr><th>Կոչում</th><th>Անձ</th><th>Ստորաբաժանում</th><th>Ավարտ</th><th>Օր</th></tr></thead><tbody>' +
        rows + '</tbody></table></div></div>';
    }
    return html;
  };

  window.kmRenderDayGlance = function () {
    /* KM_DAYGLANCE_ORG_GATE_V1 */
    var orgOk = false;
    try {
      if (typeof window.kmHomeOrgSelected === 'function') orgOk = !!window.kmHomeOrgSelected();
      else {
        var _c = typeof window.kmGetOrgContext === 'function' ? window.kmGetOrgContext() : null;
        orgOk = !!(!(_c) ? false : (String(_c.corpsId || '').trim() && String(_c.unitId || '').trim()));
      }
    } catch (eG) { orgOk = false; }
    if (!orgOk) {
      return '<div class="card kmHubCard" id="kmDayGlance" data-km-home-gated="1">' +
        '<h3 style="margin-top:0">Օրվա վահանակ</h3>' +
        '<p class="muted" style="margin:8px 0 0;line-height:1.5">Թվերն ու ցուցակները երևում են միայն <b>Հաշվառում</b> → <b>բանակային կորպուս</b> և <b>զորամաս</b> ընտրությունից հետո։</p>' +
        '<div class="toolbar" style="margin-top:12px">' +
          '<button type="button" class="primary" onclick="typeof kmOpenPage===\'function\'&&kmOpenPage(\'accounting\')">Բացել Հաշվառում</button>' +
        '</div></div>';
    }

    const logic = window.kmOpsLogic || {};
    if (!logic.todayDutyRows) return '';
    const data = typeof db !== 'undefined' ? db : {};
    const cal = new Date();
    const today = (logic.dashboardAnchorDate && logic.dashboardAnchorDate(data, cal, absenceOpts())) || cal;
    const yest = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1, 12, 0, 0);
    const tom = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1, 12, 0, 0);
    function freeCount(dateObj) {
      if (!logic.freePeopleOnDate) return 0;
      try { return logic.freePeopleOnDate(data, dateObj, absenceOpts()).length; } catch (e) { return 0; }
    }
    function notesCount(dateObj) {
      try {
        const y = dateObj.getFullYear();
        const m = String(dateObj.getMonth() + 1).padStart(2, '0');
        const d = String(dateObj.getDate()).padStart(2, '0');
        const key = y + '-' + m + '-' + d;
        const list = Array.isArray(data.notebookNotes) ? data.notebookNotes : [];
        return list.filter(function (n) { return n && n.date === key && !n.done; }).length;
      } catch (e) { return 0; }
    }
    function col(label, dateObj) {
      const rows = logic.todayDutyRows(data, dateObj, absenceOpts());
      const freeN = freeCount(dateObj);
      const noteN = notesCount(dateObj);
      const items = rows.length
        ? '<ul class="kmGlanceNames">' + rows.slice(0, 8).map(function (r) {
          return '<li>' + esc(r.name) + (r.graphName ? ' · ' + esc(r.graphName) : '') + '</li>';
        }).join('') + (rows.length > 8 ? '<li class="muted">… +' + (rows.length - 8) + '</li>' : '') + '</ul>'
        : '<p class="muted kmGlanceMeta">հերթապահ չկա</p>';
      return '<div class="stat kmGlanceCol"><b class="kmGlanceCount">' + rows.length + '</b>' +
        '<span class="muted">' + label + ' · Հերթապահ</span>' +
        '<span class="muted kmGlanceMeta">' + esc(dateObj.toLocaleDateString('hy-AM')) +
        ' · Ազատ՝ <b>' + freeN + '</b>' +
        (noteN ? (' · Նշում՝ <b>' + noteN + '</b>') : '') + '</span>' + items + '</div>';
    }
    return '<div class="card kmHubCard" id="kmDayGlance">' +
      '<h3 style="margin-top:0">Օրվա վահանակ</h3>' +
      '<p class="muted">Երեկ · Այսօր · Վաղը · Հերթապահություն, ազատ անձինք և նշումներ</p>' +
      '<div class="kmHubDash kmGlanceDash">' + col('Երեկ', yest) + col('Այսօր', today) + col('Վաղը', tom) + '</div>' +
      '<div class="toolbar">' +
        '<button type="button" class="primary" onclick="kmOpenFreePeople()">Ո՞վ է ազատ</button>' +
        '<button type="button" onclick="kmOpenOrderDraft()">Հրամանի նախագիծ</button>' +
        '<button type="button" onclick="kmOpenDocsPack()">Փաստաթղթերի փաթեթ</button>' +
        '<button type="button" onclick="kmOpenDutyKiosk()">Տախտակ</button>' +
        '<button type="button" onclick="typeof kmOpenLibrarySection===\'function\'?kmOpenLibrarySection(\'notes\'):kmOpenPage(\'library\')">Նշումներ</button>' +
      '</div></div>';
  };

  window.kmExportMonthGraphsPdf = function () {
    if (typeof window.kmBatchPrintAllGraphsFull === 'function') return window.kmBatchPrintAllGraphsFull();
    toast('Ամսվա PDF-ը հասանելի չէ', 'error');
  };

  function patchTodayBoard() {
    const orig = window.kmRenderTodayBoard;
    if (typeof orig !== 'function' || orig.__kmExtra) return;
    window.kmRenderTodayBoard = function () {
      let html = orig.apply(this, arguments);
      html = html.replace(
        '<button type="button" onclick="kmPrintTodayDuty()">Տպել այսօր</button>',
        '<button type="button" onclick="kmPrintTodayDuty()">Տպել այսօր</button>' +
        '<button type="button" onclick="kmOpenOrderDraft()">Հրամանի նախագիծ</button>' +
        '<button type="button" onclick="kmOpenDocsPack()">Փաստաթղթերի փաթեթ</button>' +
        '<button type="button" onclick="kmCopyTodayDutySms()">Պատճենել հեռախոսի տեքստ</button>' +
        '<button type="button" onclick="kmOpenDutyKiosk()">Հերթապահության տախտակ</button>' +
        '<button type="button" onclick="kmOpenFreePeople()">Ո՞վ է ազատ</button>' +
        '<button type="button" onclick="kmExportMonthGraphsPdf()">Ամսվա բոլոր գրաֆիկները PDF</button>'
      );
      return html;
    };
    window.kmRenderTodayBoard.__kmExtra = true;
  }

  function patchHomeExtra() {
    const orig = window.home;
    if (typeof orig !== 'function' || orig.__kmExtra) return;
    window.home = function () {
      orig.apply(this, arguments);
      const c = document.getElementById('content');
      if (!c) return;
      const reports = c.querySelector('[data-km-home-reports-tb]');
      if (reports) {
        reports.querySelectorAll('[data-km-extra-tools]').forEach(function (el) { el.remove(); });
      }
      window._kmHomeReportsHubHtml = null;
      const oldG = c.querySelector('#kmDayGlance');
      if (oldG) oldG.remove();
      const oldO = c.querySelector('#kmContractOverdue');
      if (oldO) oldO.remove();
      const oldR = c.querySelector('#kmContractReminders');
      if (oldR) oldR.remove();
      const board = c.querySelector('#kmTodayBoard');
      const glance = window.kmRenderDayGlance();
      const rem = window.kmRenderContractReminders();
      const block = (glance || '') + (rem || '');
      if (block) {
        if (board) board.insertAdjacentHTML('beforebegin', block);
        else c.insertAdjacentHTML('afterbegin', block);
      }
      if (typeof window.kmFinalizeHomeLayout === 'function') window.kmFinalizeHomeLayout();
    };
    window.home.__kmExtra = true;
  }

  window.kmKanakerOrderDraft = function () {
    return {
      ministry: 'ՀԱՅԱՍՏԱՆԻ ՀԱՆՐԱՊԵՏՈՒԹՅԱՆ ՊԱՇՏՊԱՆՈՒԹՅԱՆ ՆԱԽԱՐԱՐՈՒԹՅԱՆ',
      unitLine: '549 ԱՄՀԳ ՀՐԱՄԱՆԱՏԱՐ',
      docTitle: 'Հ Ր Ա Մ Ա Ն',
      number: 'N',
      date: '".....".____.____թ.',
      city: 'ք. Ճամբարակ',
      subject: '',
      preamble: '',
      commandVerb: 'Հ Ր Ա Մ Ա Յ ՈՒ Մ    Ե Մ',
      points: [''],
      commanderTitle: '549 ԱՄՀԳ ՀՐԱՄԱՆԱՏԱՐ',
      commanderRank: 'գնդապետ',
      commanderName: 'Գ.ԴԱԼԼԱՔՅԱՆ',
      chiefTitle: 'ԳՆԴԻ ՇՏԱԲԻ ՊԵՏ',
      chiefRank: 'փոխգնդապետ',
      chiefName: 'Ա.ՍԱՐԳՍՅԱՆ',
      agreedTitle: '"Հ Ա Մ Ա Ձ Ա Յ Ն Ե Ց Վ Ա Ծ  Է"',
      agreedLine1: 'ԶՈՐԱՄԱՍԻ  ՀՐԱՄԱՆԱՏԱՐԻ ՍՈՑԻԱԼ- ԻՐԱՎԱԿԱՆ',
      agreedLine2: 'ԱՇԽԱՏԱՆՔՆԵՐԻ ԳԾՈՎ ՕԳՆԱԿԱՆ-ՍՊԱ',
      agreedRank: 'մայոր',
      agreedName: 'Ա. ԴԱԼԼԱՔՅԱՆ',
      agreedDate: '".....".____.____թ.',
      copies: 'Տպագրված օրինակների քանակը 1(մեկ)',
      copyNote: 'Օրինակ 1(մեկ) - գաղտնի գործավարություն',
      madeBy: '',
      typedBy: '',
      phone: '/Հեռ.36-30',
      includeExtract: true,
      extractFrom: 'ԹԻՎ ____ ՀՐԱՄԱՆԻՑ',
      extractTitle: 'Ք Ա Ղ Վ Ա Ծ Ք',
      extractClerk: 'Իսկականի հետ ճիշտ է՝  Գաղտնի գործավարության պետ',
      extractClerkRank: 'ավագ սերժանտ',
      extractClerkName: 'Ս.Դալլաքյան',
      templateId: ''
    };
  };

  var ORDER_TEMPLATES = null;
  function loadOrderTemplates() {
    if (ORDER_TEMPLATES) return Promise.resolve(ORDER_TEMPLATES);
    return fetch('data/km_order_templates.json?v=' + encodeURIComponent(String(window.kmUpdate || '')))
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        ORDER_TEMPLATES = (j && Array.isArray(j.templates)) ? j.templates : [];
        window.KM_ORDER_TEMPLATES = ORDER_TEMPLATES;
        return ORDER_TEMPLATES;
      })
      .catch(function () {
        ORDER_TEMPLATES = [];
        return ORDER_TEMPLATES;
      });
  }

  window.kmApplyOrderTemplate = function (id) {
    id = String(id || '').trim();
    const list = ORDER_TEMPLATES || window.KM_ORDER_TEMPLATES || [];
    const hit = list.find(function (t) { return t && t.id === id; });
    if (!hit || !hit.draft) {
      toast('Ձևանմուշը չգտնվեց', 'warn');
      return;
    }
    if (typeof db === 'undefined') return;
    const base = window.kmKanakerOrderDraft();
    db.orderDraft = Object.assign({}, base, hit.draft, { templateId: hit.id });
    if (!Array.isArray(db.orderDraft.points) || !db.orderDraft.points.length) db.orderDraft.points = [''];
    toast('Բեռնվեց՝ ' + (hit.label || hit.id), 'ok');
    window.kmOpenOrderDraft();
  };

  window.kmBlankOrderDraft = function () {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    const base = window.kmKanakerOrderDraft();
    return Object.assign({}, base, {
      subject: '',
      preamble: '',
      points: [''],
      date: '"....".' + mm + '.' + yyyy + 'թ.',
      agreedDate: '"....".' + mm + '.' + yyyy + 'թ.',
      madeBy: '',
      typedBy: '',
      includeExtract: true,
      templateId: ''
    });
  };

  function orderDraftNow() {
    const blank = window.kmBlankOrderDraft();
    const saved = (typeof db !== 'undefined' && db.orderDraft && typeof db.orderDraft === 'object') ? db.orderDraft : null;
    if (saved && Object.keys(saved).length) {
      const out = Object.assign({}, blank, saved);
      if (!Array.isArray(out.points) || !out.points.length) out.points = [''];
      return out;
    }
    return blank;
  }
  function inp(id) {
    const el = document.getElementById(id);
    return el ? String(el.value || '').trim() : '';
  }
  function collectOrderDraft() {
    const points = String((document.getElementById('kmOdPoints') || {}).value || '')
      .split(/\n+/).map(function (s) { return s.trim(); }).filter(Boolean);
    const ex = document.getElementById('kmOdExtract');
    return {
      ministry: inp('kmOdMinistry'),
      unitLine: inp('kmOdUnit'),
      docTitle: inp('kmOdTitle') || 'Հ Ր Ա Մ Ա Ն',
      number: inp('kmOdNumber'),
      date: inp('kmOdDate'),
      city: inp('kmOdCity'),
      subject: inp('kmOdSubject'),
      preamble: inp('kmOdPreamble'),
      commandVerb: inp('kmOdVerb') || 'Հ Ր Ա Մ Ա Յ ՈՒ Մ    Ե Մ',
      points: points,
      commanderTitle: inp('kmOdCmdTitle'),
      commanderRank: inp('kmOdCmdRank'),
      commanderName: inp('kmOdCmdName'),
      chiefTitle: inp('kmOdChiefTitle'),
      chiefRank: inp('kmOdChiefRank'),
      chiefName: inp('kmOdChiefName'),
      agreedTitle: inp('kmOdAgrTitle'),
      agreedLine1: inp('kmOdAgr1'),
      agreedLine2: inp('kmOdAgr2'),
      agreedRank: inp('kmOdAgrRank'),
      agreedName: inp('kmOdAgrName'),
      agreedDate: inp('kmOdAgrDate'),
      copies: inp('kmOdCopies'),
      copyNote: inp('kmOdCopyNote'),
      madeBy: inp('kmOdMade'),
      typedBy: inp('kmOdTyped'),
      phone: inp('kmOdPhone'),
      includeExtract: !!(ex && ex.checked),
      extractFrom: inp('kmOdExFrom'),
      extractTitle: inp('kmOdExTitle') || 'Ք Ա Ղ Վ Ա Ծ Ք',
      extractClerk: inp('kmOdExClerk'),
      extractClerkRank: inp('kmOdExRank'),
      extractClerkName: inp('kmOdExName'),
      templateId: (function () {
        var sel = document.getElementById('kmOdTemplate');
        if (sel && sel.value) return String(sel.value);
        try {
          return (db && db.orderDraft && db.orderDraft.templateId) || '';
        } catch (e) { return ''; }
      })()
    };
  }
  window.kmSaveOrderDraft = async function () {
    if (typeof window.kmCanEdit === 'function' && !window.kmCanEdit()) { toast('Դիտորդի իրավունք', 'error'); return; }
    if (typeof db === 'undefined') return;
    db.orderDraft = collectOrderDraft();
    if (typeof save === 'function') await save(true);
    toast('Նախագիծը պահպանվեց', 'ok');
  };
  window.kmResetOrderDraft = function () {
    if (!confirm('Վերականգնե՞լ 549 ԱՄՀԳ դատարկ ձևի հիմքը։ Ընթացիկ նախագիծը կփոխարինվի։')) return;
    if (typeof db !== 'undefined') db.orderDraft = window.kmBlankOrderDraft();
    window.kmOpenOrderDraft();
  };
  window.kmClearOrderDraft = function () {
    if (!confirm('Դատարկե՞լ նախագիծը։ Անձնական օրինակի տվյալները կհեռացվեն։')) return;
    if (typeof db !== 'undefined') db.orderDraft = window.kmBlankOrderDraft();
    window.kmOpenOrderDraft();
  };
  window.kmInsertOrderPerson = function () {
    if (typeof window.kmSyncPeopleFromPositions === 'function') {
      try { window.kmSyncPeopleFromPositions(); } catch (e1) {}
    }
    const people = (typeof db !== 'undefined' && Array.isArray(db.people)) ? db.people : [];
    if (!people.length) { toast('Անձնակազմ չկա', 'warn'); return; }
    const opts = people.map(function (p, i) {
      return '<option value="' + i + '">' + esc(rankOf(p)) + ' ' + esc(p.name || '') +
        (p.unit ? ' · ' + esc(p.unit) : '') + '</option>';
    }).join('');
    const wrap = document.createElement('div');
    wrap.id = 'kmOdPersonPick';
    wrap.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:12000;display:flex;align-items:center;justify-content:center;padding:16px';
    wrap.innerHTML = '<div class="card" style="max-width:420px;width:100%">' +
      '<h3 style="margin-top:0">Ավելացնել անձ կետերին</h3>' +
      '<select id="kmOdPickP" style="width:100%;padding:8px;margin:8px 0">' + opts + '</select>' +
      '<div class="toolbar">' +
      '<button type="button" class="primary" id="kmOdPickGo">Ավելացնել</button>' +
      '<button type="button" id="kmOdPickX">Փակել</button></div></div>';
    document.body.appendChild(wrap);
    wrap.querySelector('#kmOdPickX').onclick = function () { wrap.remove(); };
    wrap.querySelector('#kmOdPickGo').onclick = function () {
      const i = Number(wrap.querySelector('#kmOdPickP').value);
      const p = people[i];
      wrap.remove();
      if (!p) return;
      const line = [rankOf(p), p.name || '', p.unit ? '(' + p.unit + ')' : ''].filter(Boolean).join(' ').trim();
      const ta = document.getElementById('kmOdPoints');
      if (!ta) return;
      const cur = String(ta.value || '').trim();
      ta.value = cur ? (cur + '\n' + line) : line;
      toast('Ավելացվեց՝ ' + line, 'ok');
    };
  };
  function escAttr(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;');
  }
  function escTa(v) {
    return esc(v || '').replace(/<\/textarea/gi, '&lt;/textarea');
  }
  window.kmOrderDraftBack = function () {
    if (typeof window.kmReportsBack === 'function') {
      window.kmReportsBack();
      return;
    }
    const from = window._kmOrderDraftFrom || 'home';
    if (from === 'docs' && typeof window.kmOpenDocsPack === 'function') window.kmOpenDocsPack();
    else if (typeof window.kmOpenPage === 'function') window.kmOpenPage('home');
    else if (typeof window.home === 'function') window.home();
  };
  window.kmOrderDraftNumberPoints = function () {
    const ta = document.getElementById('kmOdPoints');
    if (!ta) return;
    const lines = String(ta.value || '').split(/\n+/).map(function (s) { return s.trim(); }).filter(Boolean);
    ta.value = lines.map(function (line, i) {
      if (/^\d+[\.\)]\s/.test(line)) return line;
      return (i + 1) + '. ' + line;
    }).join('\n');
    toast('Կետերը համարակվեցին', 'ok');
  };
  async function exportOrderDraft(asPdf) {
    if (!window.kmNative || !window.kmNative.export || !window.kmNative.export.orderDraftWord) {
      toast('Հրամանի նախագիծը հասանելի է միայն KM desktop-ում', 'error');
      return;
    }
    const draft = collectOrderDraft();
    if (typeof db !== 'undefined') db.orderDraft = draft;
    if (typeof save === 'function') await save(true);
    try {
      const r = await window.kmNative.export.orderDraftWord({
        name: 'KM_hraman_nakagits',
        asPdf: !!asPdf,
        draft: draft
      });
      const out = asPdf ? (r.pdf || r.output) : r.output;
      toast((asPdf ? 'Հրամանի PDF՝ ' : 'Հրամանի Word՝ ') + (out || ''), 'ok');
      if (out && window.kmNative.shell && window.kmNative.shell.showItemInFolder) {
        await window.kmNative.shell.showItemInFolder(out);
      }
    } catch (e) {
      toast((e && e.message) || 'Հրամանը չստեղծվեց։ Word է պետք։', 'error');
    }
  }
  window.kmExportOrderDraftWord = function () { return exportOrderDraft(false); };
  window.kmExportOrderDraftPdf = function () { return exportOrderDraft(true); };

  window.kmOpenOrderDraft = function (from) {
    if (typeof window.kmRequireGrant === 'function' && !window.kmRequireGrant('orderDraft')) return;
    if (from) window._kmOrderDraftFrom = from;
    else if (!window._kmOrderDraftFrom) window._kmOrderDraftFrom = 'home';
    const host = document.getElementById('content');
    if (!host) return;

    function paint(templates) {
      const d = orderDraftNow();
      templates = templates || [];
      function f(id, label, val, extra) {
        extra = extra || '';
        return '<label class="kmDlgField"><span>' + label + '</span><input id="' + id + '" type="text" value="' + escAttr(val || '') + '" ' + extra + '></label>';
      }
      const tplOpts = '<option value="">— ընտրել ձևանմուշ —</option>' + templates.map(function (t) {
        const sel = d.templateId === t.id ? ' selected' : '';
        return '<option value="' + escAttr(t.id) + '"' + sel + '>' + esc(t.label || t.id) + '</option>';
      }).join('');
      const backLabel = (typeof window.KM_BACK_LABEL === 'string' && window.KM_BACK_LABEL) ? window.KM_BACK_LABEL : '← Վերադարձ';
      host.innerHTML = '<div class="card"><h3>Հրամանի նախագիծ</h3>' +
        '<p class="muted">Հիմք՝ իրական հրամանների ձևանմուշներ (տեսադիտարկում / բենզոագրեգատներ)։ Ընտրեք ձևանմուշը, խմբագրեք և արտահանեք Word/PDF։</p>' +
        '<div class="toolbar" style="flex-wrap:wrap;gap:8px;align-items:center">' +
        '<label style="display:flex;gap:6px;align-items:center;font-weight:700">Ձևանմուշ' +
        '<select id="kmOdTemplate" style="min-width:260px;padding:6px 8px">' + tplOpts + '</select></label>' +
        '<button type="button" class="primary" onclick="kmApplyOrderTemplate(document.getElementById(\'kmOdTemplate\').value)">Բեռնել ձևանմուշը</button>' +
        '<button type="button" class="primary" onclick="kmExportOrderDraftWord()">Հրաման Word</button>' +
        '<button type="button" onclick="kmExportOrderDraftPdf()">Հրաման PDF</button>' +
        '<button type="button" onclick="kmSaveOrderDraft()">Պահպանել նախագիծը</button>' +
        '<button type="button" onclick="kmInsertOrderPerson()">Ավելացնել անձ</button>' +
        '<button type="button" onclick="kmOrderDraftNumberPoints()">Համարակել կետերը</button>' +
        '<button type="button" onclick="kmClearOrderDraft()">Դատարկ ձև</button>' +
        '<button type="button" onclick="kmResetOrderDraft()">549 հիմք</button>' +
        '<button type="button" onclick="kmOrderDraftBack()">' + backLabel + '</button></div>' +
        '<div class="kmDlgGrid" style="margin-top:12px">' +
        f('kmOdMinistry', 'Վերնագիր (Նախարարություն)', d.ministry) +
        f('kmOdUnit', 'Զորամաս / հրամանատար', d.unitLine) +
        f('kmOdTitle', 'Փաստաթղթի տեսակ', d.docTitle) +
        f('kmOdNumber', 'Համար', d.number) +
        f('kmOdDate', 'Ամսաթիվ', d.date) +
        f('kmOdCity', 'Քաղաք', d.city) +
        f('kmOdSubject', 'Վերնագիր / մասին', d.subject) +
        '</div>' +
        '<label class="kmDlgField" style="display:block;margin-top:10px"><span>Նախաբան</span><textarea id="kmOdPreamble" rows="3" style="width:100%">' + escTa(d.preamble || '') + '</textarea></label>' +
        f('kmOdVerb', 'Հրամայում եմ', d.commandVerb) +
        '<label class="kmDlgField" style="display:block;margin-top:10px"><span>Կետեր (յուրաքանչյուրը նոր տողով)</span><textarea id="kmOdPoints" rows="12" style="width:100%">' + escTa((d.points || []).join('\n')) + '</textarea></label>' +
        '<h4>Ստորագրություններ</h4>' +
        '<div class="kmDlgGrid">' +
        f('kmOdCmdTitle', 'Հրամանատար — պաշտոն', d.commanderTitle) +
        f('kmOdCmdRank', 'Կոչում', d.commanderRank) +
        f('kmOdCmdName', 'Անուն', d.commanderName) +
        f('kmOdChiefTitle', 'Շտաբի պետ — պաշտոն', d.chiefTitle) +
        f('kmOdChiefRank', 'Կոչում', d.chiefRank) +
        f('kmOdChiefName', 'Անուն', d.chiefName) +
        f('kmOdAgrTitle', 'Համաձայնեցված է', d.agreedTitle) +
        f('kmOdAgr1', 'Համաձայնեցնող — տող 1', d.agreedLine1) +
        f('kmOdAgr2', 'Համաձայնեցնող — տող 2', d.agreedLine2) +
        f('kmOdAgrRank', 'Կոչում', d.agreedRank) +
        f('kmOdAgrName', 'Անուն', d.agreedName) +
        f('kmOdAgrDate', 'Ամսաթիվ', d.agreedDate) +
        '</div>' +
        '<h4>Գործավարություն</h4>' +
        '<div class="kmDlgGrid">' +
        f('kmOdCopies', 'Օրինակների քանակ', d.copies) +
        f('kmOdCopyNote', 'Օրինակ 1', d.copyNote) +
        f('kmOdMade', 'Կատարեց', d.madeBy) +
        f('kmOdTyped', 'Տպագրեց', d.typedBy) +
        f('kmOdPhone', 'Հեռախոս', d.phone) +
        '</div>' +
        '<label style="display:flex;gap:8px;align-items:center;margin:12px 0"><input id="kmOdExtract" type="checkbox"' + (d.includeExtract !== false ? ' checked' : '') + '> Ներառել քաղվածք (երկրորդ էջ)</label>' +
        '<div class="kmDlgGrid">' +
        f('kmOdExFrom', 'Քաղվածք — ից', d.extractFrom) +
        f('kmOdExTitle', 'Քաղվածքի վերնագիր', d.extractTitle) +
        f('kmOdExClerk', 'Իսկականի հետ ճիշտ է', d.extractClerk) +
        f('kmOdExRank', 'Կոչում', d.extractClerkRank) +
        f('kmOdExName', 'Անուն', d.extractClerkName) +
        '</div></div>';
      page = 'orderDraft';
      window.page = 'orderDraft';
      const pt = document.getElementById('pageTitle');
      if (pt) pt.textContent = 'Հրամանի նախագիծ';
      if (typeof window.kmApplyLanguage === 'function') {
        try { window.kmApplyLanguage(); } catch (e) {}
      }
      if (typeof window.kmApplyRoleGuard === 'function') window.kmApplyRoleGuard();
    }

    loadOrderTemplates().then(paint).catch(function () { paint([]); });
  };

  window.kmContractWarnDays = warnDays;
  window.kmSetContractWarnDays = setWarnDays;

  function boot() {
    patchTodayBoard();
    patchHomeExtra();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
