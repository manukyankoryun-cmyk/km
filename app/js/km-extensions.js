/* KM extensions: history, reports, holidays, swap, absences, ranks, sync, QR, ID, templates */
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
  function canEdit() {
    return typeof window.kmCanEdit !== 'function' || window.kmCanEdit();
  }
  function rankOf(p) {
    return typeof kmRankText === 'function' ? kmRankText(p && p.rank) : String((p && p.rank) || '');
  }
  function ymd(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  var ABSENCE_KINDS = [
    { id: 'vacation', label: 'Արձակուրդ', mark: 'Ա' },
    { id: 'sick', label: 'Հիվանդություն', mark: 'Հ' },
    { id: 'trip', label: 'Գործուղում', mark: 'Գ' },
    { id: 'study', label: 'Ուսում', mark: 'Ո' }
  ];

  if (!document.getElementById('km-ext-css')) {
    var st = document.createElement('style');
    st.id = 'km-ext-css';
    st.textContent = '.kmHolidayHead{background:#fff4cc!important}body.km-dark .kmHolidayHead{background:#5a4a18!important}.kmPcWrap{max-width:720px}.kmPcTop{display:flex;gap:14px;flex-wrap:wrap;align-items:flex-start;margin-bottom:12px}.kmPcPhoto{display:flex;flex-direction:column;gap:8px;align-items:flex-start}.kmPcPhotoBtns{display:flex;gap:6px;flex-wrap:wrap}.kmPcGrid{display:grid;grid-template-columns:1fr 1fr;gap:10px 12px}.kmPcField{display:flex;flex-direction:column;gap:4px;font-size:13px;color:#0b1a33}.kmPcField span{color:#15222d!important;-webkit-text-fill-color:#15222d;font-size:12px;font-weight:700;opacity:1}.kmPcField input,.kmPcField select,.kmPcField textarea{padding:7px 9px;border:1px solid #c8d0d8;border-radius:7px;width:100%;box-sizing:border-box;background:#fff;color:#0b1a33!important;-webkit-text-fill-color:#0b1a33;opacity:1;-webkit-transform:translateZ(0);transform:translateZ(0)}.kmPcFull{grid-column:1/-1}@media(max-width:640px){.kmPcGrid{grid-template-columns:1fr}}#kmExtModal,.kmExtModalCard,#kmExtModal h3,#kmExtModal p,#kmExtModal label,#kmExtModal .muted{color:#0b1a33!important;-webkit-text-fill-color:#0b1a33;opacity:1}';
    (document.head || document.documentElement).appendChild(st);
  }

  function ensureExtDb() { /* KM_DUTY_UNFREEZE_V1_RANK */
    if (typeof db === 'undefined' || !db) return;
    if (!Array.isArray(db.vacations)) db.vacations = [];
    if (!db.dutyRankRules || typeof db.dutyRankRules !== 'object') db.dutyRankRules = {};
    if (!Array.isArray(db.dutyGraphTemplates)) db.dutyGraphTemplates = [];
    if (!Array.isArray(db.scheduleTemplates)) db.scheduleTemplates = [];
    if (!Array.isArray(db.substitutions)) db.substitutions = [];
    db.people = db.people || [];
    /* KM_DUTY_UNFREEZE_V1: skip kmEnsurePersonProfile-on-all-people (froze rankRules open) */
  }

  /* ---------- Armenian holidays ---------- */
  function orthodoxEaster(year) {
    var a = year % 4, b = year % 7, c = year % 19;
    var d = (19 * c + 15) % 30;
    var e = (2 * a + 4 * b - d + 34) % 7;
    var month = Math.floor((d + e + 114) / 31);
    var day = ((d + e + 114) % 31) + 1;
    var julian = new Date(Date.UTC(year, month - 1, day));
    julian.setUTCDate(julian.getUTCDate() + 13);
    return new Date(julian.getUTCFullYear(), julian.getUTCMonth(), julian.getUTCDate());
  }
  window.kmArmenianHolidays = function (year) {
    year = +year || new Date().getFullYear();
    var list = [
      [1, 1, 'Ամանոր'], [1, 2, 'Ամանոր'], [1, 6, 'Սուրբ Ծնունդ'], [1, 28, 'Բանակի օր'],
      [3, 8, 'Կանանց օր'], [4, 24, 'Հայոց ցեղասպանության զոհերի հիշատակի օր'],
      [5, 1, 'Աշխատանքի օր'], [5, 9, 'Հաղթանակի օր'], [5, 28, 'Հանրապետության օր'],
      [7, 5, 'Սահմանադրության օր'], [9, 21, 'Անկախության օր'], [12, 31, 'Ամանորի գիշեր']
    ];
    var out = list.map(function (x) {
      return { date: year + '-' + String(x[0]).padStart(2, '0') + '-' + String(x[1]).padStart(2, '0'), name: x[2] };
    });
    var e = orthodoxEaster(year);
    for (var i = -2; i <= 1; i++) {
      var d = new Date(e.getFullYear(), e.getMonth(), e.getDate() + i);
      var names = { '-2': 'Ավագ ուրբաթ', '-1': 'Ավագ շաբաթ', '0': 'Զատիկ', '1': 'Զատկի երկուշաբթի' };
      out.push({ date: ymd(d), name: names[String(i)] || 'Զատիկ' });
    }
    out.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    var seen = {};
    return out.filter(function (h) {
      if (seen[h.date]) return false;
      seen[h.date] = 1;
      return true;
    });
  };
  window.kmIsArmenianHoliday = function (year, month, day) {
    var ds = (+year) + '-' + String(+month).padStart(2, '0') + '-' + String(+day).padStart(2, '0');
    return kmArmenianHolidays(year).some(function (h) { return h.date === ds; });
  };
  window.kmHolidayName = function (year, month, day) {
    var ds = (+year) + '-' + String(+month).padStart(2, '0') + '-' + String(+day).padStart(2, '0');
    var h = kmArmenianHolidays(year).find(function (x) { return x.date === ds; });
    return h ? h.name : '';
  };
  window.kmSkipHolidaysInPlan = function () {
    try { return localStorage.getItem('kmSkipHolidays') !== '0'; } catch (e) { return true; }
  };

  /* ---------- Absences ---------- */
  window.kmAbsenceKindLabel = function (kind) {
    var k = ABSENCE_KINDS.find(function (x) { return x.id === kind; });
    return k ? k.label : 'Արձակուրդ';
  };
  window.kmGridAbsenceMark = function (kind) {
    var k = ABSENCE_KINDS.find(function (x) { return x.id === kind; });
    return k ? k.mark : 'Ա';
  };
  function kmMapRegistrationKind(type) {
    var s = String(type || '').trim().toLocaleLowerCase();
    if (!s) return 'vacation';
    if (s === 'sick' || /հիվանդ/.test(s)) return 'sick';
    if (s === 'trip' || /գործուղ/.test(s)) return 'trip';
    if (s === 'study' || /ուսում/.test(s)) return 'study';
    if (s === 'vacation' || /արձակ/.test(s)) return 'vacation';
    return 'vacation';
  }
  window.kmPersonAbsence = function (personName, dateObj) {
    var name = String(personName || '').trim();
    var ds = dateObj instanceof Date ? ymd(dateObj) : String(dateObj || '');
    if (!name || !ds || typeof db === 'undefined') return null;
    var vacs = db.vacations || [];
    var regs = db.registrations || [];
    var idx = window._kmAbsIdx;
    if (!idx || idx.nVac !== vacs.length || idx.nReg !== regs.length || idx.vacRef !== vacs || idx.regRef !== regs) {
      idx = { nVac: vacs.length, nReg: regs.length, vacRef: vacs, regRef: regs, byName: Object.create(null) };
      function bucket(person) {
        var k = String(person || '').trim().toLowerCase();
        if (!k) return null;
        if (!idx.byName[k]) idx.byName[k] = { vac: [], reg: [] };
        return idx.byName[k];
      }
      for (var i = 0; i < vacs.length; i++) {
        var v = vacs[i];
        if (!v || !v.from || !v.to) continue;
        var b = bucket(v.person);
        if (b) b.vac.push(v);
      }
      for (var r = 0; r < regs.length; r++) {
        var rec = regs[r];
        if (!rec || !rec.date) continue;
        var br = bucket(rec.person);
        if (br) br.reg.push(rec);
      }
      window._kmAbsIdx = idx;
    }
    var hit = idx.byName[name.toLowerCase()];
    if (!hit) return null;
    for (var vi = 0; vi < hit.vac.length; vi++) {
      var vv = hit.vac[vi];
      if (ds >= vv.from && ds <= vv.to) return vv.kind || 'vacation';
    }
    for (var ri = 0; ri < hit.reg.length; ri++) {
      var rr = hit.reg[ri];
      if (String(rr.date).slice(0, 10) === ds) return kmMapRegistrationKind(rr.type);
    }
    return null;
  };

  /* ---------- Rank rules ---------- */
  window.kmPersonEligibleForDuty = function (person, dutyName) {
    ensureExtDb();
    var key = String(dutyName || 'Հիմնական').trim() || 'Հիմնական';
    var allowed = db.dutyRankRules[key];
    if (!allowed || !allowed.length) return true;
    var r = rankOf(person);
    return allowed.indexOf(r) >= 0 || allowed.indexOf(String(person && person.rank || '')) >= 0;
  };

  /* ---------- Duty history ---------- */
  window.kmPersonDutyHistory = function (personName) {
    var name = String(personName || '').trim();
    var months = {};
    function add(y, m, n) {
      var k = y + '-' + String(m).padStart(2, '0');
      months[k] = (months[k] || 0) + (n || 1);
    }
    function scanRows(rows, y, m) {
      var row = rows && rows[name];
      if (!row) return;
      Object.keys(row).forEach(function (d) {
        if (String(row[d] || '').trim()) add(y, m, 1);
      });
    }
    if (typeof db === 'undefined' || !db) return { months: {}, total: 0 };
    var s = db.schedule || {};
    scanRows(s.rows, +s.year, +s.month);
    (db.archives || []).forEach(function (a) {
      var sch = a && a.snapshot && a.snapshot.schedule;
      if (sch) scanRows(sch.rows, +sch.year, +sch.month);
    });
    (db.futureSchedules || []).forEach(function (f) { scanRows(f.rows, +f.year, +f.month); });
    Object.keys(db.dutyTypeSchedules || {}).forEach(function (k) {
      var sch = db.dutyTypeSchedules[k];
      if (!sch) return;
      var asg = sch.assignments || sch.rows || {};
      var row = asg[name];
      if (!row) return;
      Object.keys(row).forEach(function (d) {
        if (String(row[d] || '').trim()) add(+sch.year || +s.year, +sch.month || +s.month, 1);
      });
    });
    var total = 0;
    Object.keys(months).forEach(function (k) { total += months[k]; });
    return { months: months, total: total };
  };
  function pickPersonIndex(title, cb) {
    if (typeof window.kmSyncPeopleFromPositions === 'function') {
      try { window.kmSyncPeopleFromPositions(); } catch (e) {}
    }
    var people = db.people || [];
    if (!people.length) { toast('Անձնակազմ չկա', 'warn'); return; }
    if (people.length === 1) { cb(0); return; }
    var opts = people.map(function (p, i) {
      return '<option value="' + i + '">' + esc(p.name) + '</option>';
    }).join('');
    kmExtModal(title,
      '<label>Անձ <select id="kmPickP" style="width:100%;margin-top:6px;padding:8px">' + opts + '</select></label>' +
      '<div class="toolbar" style="margin-top:12px"><button type="button" class="primary" id="kmPickGo">Ընտրել</button></div>',
      function (box) {
        box.querySelector('#kmPickGo').onclick = function () {
          var i = Number(box.querySelector('#kmPickP').value);
          var m = document.getElementById('kmExtModal');
          if (m) m.remove();
          cb(i);
        };
      });
  }
  window.kmShowDutyHistory = function (index) {
    var p = (db.people || [])[index];
    if (!p) {
      pickPersonIndex('Հերթապահության պատմություն', function (i) { window.kmShowDutyHistory(i); });
      return;
    }
    var h = kmPersonDutyHistory(p.name);
    var keys = Object.keys(h.months).sort().reverse();
    var rows = keys.map(function (k) {
      return '<tr><td>' + esc(k) + '</td><td>' + h.months[k] + '</td></tr>';
    }).join('') || '<tr><td colspan="2">Տվյալ չկա</td></tr>';
    kmExtModal('Հերթապահության պատմություն — ' + p.name,
      '<p class="muted">Ընդամենը՝ <b>' + h.total + '</b> հերթապահություն (ընթացիկ, արխիվ, վերակարգեր)։</p>' +
      '<table class="grid" style="width:100%"><thead><tr><th>Ամիս</th><th>Օրեր</th></tr></thead><tbody>' + rows + '</tbody></table>');
  };

  window.kmIsPersonCardAdmin = function () {
    try {
      if (window.kmUserRole === 'admin') return true;
      if (typeof window.kmCanAdmin === 'function' && window.kmCanAdmin()) return true;
      if (sessionStorage.getItem('km_auth_mode') === 'admin') return true;
    } catch (e) {}
    return false;
  };

  /* ---- Person card catalogs: marz→city, education groups ---- */
  window.kmPersonCardCatalog = {
    regions: {
      'Երևան': [
        'Երևան', 'Կենտրոն', 'Արաբկիր', 'Ավան', 'Դավթաշեն', 'Էրեբունի',
        'Քանաքեր-Զեյթուն', 'Մալաթիա-Սեբաստիա', 'Նոր Նորք', 'Նորք-Մարաշ',
        'Նուբարաշեն', 'Շենգավիթ'
      ],
      'Արագածոտն': ['Աշտարակ', 'Ապարան', 'Թալին', 'Այգեհավան', 'Արագած'],
      'Արարատ': ['Արտաշատ', 'Մասիս', 'Արարատ', 'Վեդի'],
      'Արմավիր': ['Արմավիր', 'Վաղարշապատ', 'Մեծամոր', 'Բաղրամյան'],
      'Գեղարքունիք': ['Գավառ', 'Սևան', 'Մարտունի', 'Վարդենիս', 'Ճամբարակ'],
      'Լոռի': ['Վանաձոր', 'Սպիտակ', 'Ստեփանավան', 'Ալավերդի', 'Թումանյան', 'Տաշիր'],
      'Կոտայք': ['Հրազդան', 'Աբովյան', 'Չարենցավան', 'Եղվարդ', 'Նոր Հաճն', 'Բյուրեղավան', 'Ծաղկաձոր'],
      'Շիրակ': ['Գյումրի', 'Արթիկ', 'Մարալիկ', 'Ախուրյան'],
      'Սյունիք': ['Կապան', 'Գորիս', 'Սիսիան', 'Մեղրի', 'Քաջարան'],
      'Վայոց ձոր': ['Եղեգնաձոր', 'Ջերմուկ', 'Վայք'],
      'Տավուշ': ['Իջևան', 'Դիլիջան', 'Բերդ', 'Նոյեմբերյան']
    },
    educationGroups: {
      'Տարրական / հիմնական': ['Տարրական', 'Հիմնական'],
      'Միջնակարգ': ['Միջնակարգ ընդհանուր', 'Միջնակարգ մասնագիտական'],
      'Միջին մասնագիտական': ['Միջին մասնագիտական', 'Միջին մասնագիտական (քոլեջ)'],
      'Բարձրագույն': ['Բարձրագույն', 'Բակալավր', 'Մագիստրոս', 'Մասնագետ'],
      'Հետբուհական': ['Ասպիրանտուրա', 'Գիտությունների թեկնածու', 'Գիտությունների դոկտոր']
    },
    articles404: {
      // ՀՀ կառավարության 12.04.2018 N 404-Ն · պիտանիության հոդվածներ
      numbers: (function () {
        var a = [];
        for (var i = 1; i <= 103; i++) a.push(String(i));
        return a;
      })(),
      points: ['Ա', 'Բ', 'Գ', 'Դ']
    },
    secrecyLevels: [
      { value: 'none', label: 'Չունի' },
      { value: '1', label: '1' },
      { value: '2', label: '2' },
      { value: '3', label: '3' }
    ]
  };

  window.kmPersonCitiesForRegion = function (region) {
    var cat = window.kmPersonCardCatalog && window.kmPersonCardCatalog.regions;
    if (!cat) return [];
    return (cat[String(region || '').trim()] || []).slice();
  };

  window.kmPersonEducationForGroup = function (group) {
    var cat = window.kmPersonCardCatalog && window.kmPersonCardCatalog.educationGroups;
    if (!cat) return [];
    return (cat[String(group || '').trim()] || []).slice();
  };

  window.kmPersonParseArticles = function (raw) {
    raw = String(raw || '').trim();
    if (!raw) return [];
    var out = [];
    var seen = Object.create(null);
    String(raw).split(/[;|,\n]+/).forEach(function (part) {
      part = String(part || '').trim();
      if (!part) return;
      var m = part.match(/^(\d{1,3})\s*([ԱաբԲբԳգԴդAaBbCcDd])?$/);
      if (!m) {
        var key = part;
        if (seen[key]) return;
        seen[key] = 1;
        out.push({ article: part, point: '', label: part });
        return;
      }
      var art = m[1];
      var pt = (m[2] || '').toUpperCase();
      if (pt === 'A') pt = 'Ա';
      if (pt === 'B') pt = 'Բ';
      if (pt === 'C') pt = 'Գ';
      if (pt === 'D') pt = 'Դ';
      var label = art + (pt ? (' ' + pt) : '');
      if (seen[label]) return;
      seen[label] = 1;
      out.push({ article: art, point: pt, label: label });
    });
    return out;
  };
  window.kmPersonFormatArticles = function (items) {
    return (items || []).map(function (x) { return x.label || ((x.article || '') + (x.point ? (' ' + x.point) : '')); })
      .filter(Boolean).join('; ');
  };

  window.kmPersonInferEducationGroup = function (edu) {
    edu = String(edu || '').trim();
    if (!edu) return '';
    var cat = window.kmPersonCardCatalog && window.kmPersonCardCatalog.educationGroups;
    if (!cat) return '';
    var keys = Object.keys(cat);
    for (var i = 0; i < keys.length; i++) {
      if ((cat[keys[i]] || []).indexOf(edu) >= 0) return keys[i];
    }
    return '';
  };

  function kmAddContractTerm(startIso, term) {
    var raw = String(startIso || '').slice(0, 10);
    var p = raw.split('-').map(Number);
    if (p.length < 3 || !p[0] || !p[1] || !p[2]) return '';
    var d = new Date(p[0], p[1] - 1, p[2]);
    if (isNaN(d.getTime())) return '';
    var t = String(term || '').trim();
    if (t === '3m') d.setMonth(d.getMonth() + 3);
    else if (t === '6m') d.setMonth(d.getMonth() + 6);
    else if (t === '1y') d.setFullYear(d.getFullYear() + 1);
    else if (t === '3y') d.setFullYear(d.getFullYear() + 3);
    else if (t === '20y') d.setFullYear(d.getFullYear() + 20);
    else return '';
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1);
    var day = String(d.getDate());
    if (m.length < 2) m = '0' + m;
    if (day.length < 2) day = '0' + day;
    return y + '-' + m + '-' + day;
  }
  function kmContractTermLabel(term) {
    return ({
      '3m': '3 ամիս',
      '6m': '6 ամիս',
      '1y': '1 տարի',
      '3y': '3 տարի',
      '20y': '20 տարի'
    })[String(term || '').trim()] || '';
  }
  function kmPersonTrialExams(name) {
    name = String(name || '').trim();
    if (!name) return [];
    var list = (typeof db !== 'undefined' && Array.isArray(db.trialExamDrafts)) ? db.trialExamDrafts.slice() : [];
    if (typeof db !== 'undefined' && Array.isArray(db.unitTrialExamDrafts)) {
      db.unitTrialExamDrafts.forEach(function (x) { list.push(x); });
    }
    return list.filter(function (x) {
      if (!x) return false;
      if (typeof window.kmVacationSamePerson === 'function') {
        try { return !!window.kmVacationSamePerson(x.person, name); } catch (e0) {}
      }
      return String(x.person || '').trim() === name;
    }).slice().sort(function (a, b) {
      return String(b.whenDate || b.createdAt || '').localeCompare(String(a.whenDate || a.createdAt || ''));
    });
  }

  window.kmEnsurePersonProfile = function (p) {
    if (!p || typeof p !== 'object') return p;
    if (p.photo == null) p.photo = '';
    if (p.phone == null) p.phone = '';
    if (p.note == null) p.note = '';
    if (p.education == null) p.education = '';
    if (!Array.isArray(p.educations)) {
      p.educations = [];
      var eduSeed = String(p.education || '').trim();
      if (eduSeed) {
        eduSeed.split(/\s*;\s*/).forEach(function (part) {
          part = String(part || '').trim();
          if (part) p.educations.push({ text: part });
        });
      }
    }
    if (p.familyStatus == null) p.familyStatus = p.family || '';
    if (p.contractStart == null) p.contractStart = '';
    if (p.contractTerm == null) p.contractTerm = '';
    if (p.endDate == null) p.endDate = p.contractEnd || '';
    if (p.region == null) p.region = '';
    if (p.city == null) p.city = '';
    if (p.address == null) p.address = '';
    if (p.commissariat == null) p.commissariat = '';
    if (p.bloodGroup == null) p.bloodGroup = '';
    if (p.illnesses == null) p.illnesses = '';
    if (p.articles == null) p.articles = '';
    if (!Array.isArray(p.articleItems)) {
      p.articleItems = typeof window.kmPersonParseArticles === 'function'
        ? window.kmPersonParseArticles(p.articles) : [];
    }
    if (p.post == null) p.post = '';
    if (p.specialty == null) p.specialty = '';
    if (p.posOrder == null) p.posOrder = '';
    if (p.postCode == null) p.postCode = '';
    if (p.posCode == null) p.posCode = p.postCode || '';
    if (p.rankSlot == null) p.rankSlot = '';
    if (p.appointmentDate == null) p.appointmentDate = '';
    if (!Array.isArray(p.appointments)) p.appointments = [];
    if (p.educationGroup == null) p.educationGroup = '';
    if (p.secrecyClearance == null) p.secrecyClearance = '';
    if (p.idCard == null) p.idCard = '';
    if (p.hsk == null) p.hsk = '';
    if (!p.educationGroup && p.education && typeof window.kmPersonInferEducationGroup === 'function') {
      p.educationGroup = window.kmPersonInferEducationGroup(p.education);
    }
    return p;
  };

  window.kmOpenPersonCard = function (index) {
    if (!document.getElementById('km-pc-art-css')) {
      var st = document.createElement('style');
      st.id = 'km-pc-art-css';
      st.textContent = '.kmPcArtBar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:6px}' +
        '.kmPcArtBar select{min-width:110px;padding:8px;border:1px solid #c5d0da;border-radius:7px;background:#fff}' +
        '.kmPcArtList{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}' +
        '.kmPcArtChip{display:inline-flex;align-items:center;gap:4px;padding:4px 8px;border-radius:999px;background:#e8f2f7;border:1px solid #c5d8e4;font-size:13px;font-weight:700;color:#0d4a66}' +
        '.kmPcArtChip button{border:0;background:transparent;cursor:pointer;font-size:14px;line-height:1;color:#6a7a88;padding:0 2px}' +
        '.kmPcEduBar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:6px}' +
        '.kmPcEduBar input{flex:1;min-width:180px;padding:8px;border:1px solid #c5d0da;border-radius:7px;background:#fff}' +
        '.kmPcEduList{display:flex;flex-direction:column;gap:6px;margin-top:8px}' +
        '.kmPcEduItem{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 10px;border-radius:8px;background:#f4f8fb;border:1px solid #d5e3ec;font-size:13px;font-weight:600;color:#0d4a66}' +
        '.kmPcEduItem button{border:0;background:transparent;cursor:pointer;font-size:16px;line-height:1;color:#6a7a88;padding:0 4px}';
      (document.head || document.documentElement).appendChild(st);
    }
    var p = (db.people || [])[index];
    if (!p) {
      pickPersonIndex('Անձի քարտ', function (i) { window.kmOpenPersonCard(i); });
      return;
    }
    window.kmEnsurePersonProfile(p);
    var idx = Number(index);
    var canEdit = false;
    if (window.kmUserRole === 'admin' || (typeof window.kmIsAppAdmin === 'function' && window.kmIsAppAdmin())) {
      canEdit = true;
    } else if (typeof window.kmCanEditPersonnelOp === 'function') {
      canEdit = !!window.kmCanEditPersonnelOp('card');
    } else if (typeof window.kmCanEditPage === 'function') {
      canEdit = !!(window.kmCanEditPage('people') || window.kmCanEditPage('unitDossiers') || window.kmCanEditPage('troopStructure'));
    } else if (typeof window.kmCanEdit === 'function') {
      canEdit = !!(window.kmCanEdit('people') || window.kmCanEdit('unitDossiers') || window.kmCanEdit('troopStructure'));
    } else {
      canEdit = true;
    }
    var isAdmin = window.kmIsPersonCardAdmin();
    var dossier = (db.unitDossiers && db.unitDossiers[p.name]) || {};
    if (!p.education && dossier.education) p.education = dossier.education;
    if (!p.familyStatus && (dossier.family || dossier.familyStatus)) {
      p.familyStatus = dossier.family || dossier.familyStatus;
    }
    if (!p.post && dossier.post) p.post = dossier.post;
    if (!p.specialty && dossier.specialty) p.specialty = dossier.specialty;
    if (typeof window.kmLooksLikeStaffCode === 'function' && window.kmLooksLikeStaffCode(p.specialty)) p.specialty = '';
    if (p.postCode && String(p.specialty || '').trim() === String(p.postCode).trim()) p.specialty = '';
    /* KM_PERSON_CARD_ARCHIVE_FIELDS_V1 */
    try {
      if (typeof window.kmApplyUnitArchiveToPerson === 'function') {
        window.kmApplyUnitArchiveToPerson(p, { force: true });
      } else if (window.kmUnitArchiveStaffSource && typeof window.kmUnitArchiveStaffSource.applyFactsToPerson === 'function') {
        window.kmUnitArchiveStaffSource.applyFactsToPerson(p, { force: true });
      }
    } catch (eFormal0) {}
    try {
      if (typeof window.kmApplyPositionArchiveToPerson === 'function') {
        // Only fill gaps not already set from Unit Archive (no duplicate overwrite)
        window.kmApplyPositionArchiveToPerson(p, { force: false });
      }
    } catch (eArch0) {}
    if (typeof window.kmLooksLikeStaffCode === 'function' && window.kmLooksLikeStaffCode(p.specialty)) p.specialty = '';
    if (p.postCode && String(p.specialty || '').trim() === String(p.postCode).trim()) p.specialty = '';
    try {
      var tRows = (((db.troopStructure || {}).staff || {}).rows) || [];
      var tRow = tRows.find(function (r) {
        return r && String(r.name || '').trim() === String(p.name || '').trim();
      });
      if (tRow) {
        if (!p.idCard && tRow.idCard) p.idCard = tRow.idCard;
        if (!p.hsk && tRow.hsk) p.hsk = tRow.hsk;
        if (!p.secrecyClearance && tRow.secret) {
          var sec = String(tRow.secret).trim();
          if (sec === 'Չունի' || sec === '0' || /^chuni/i.test(sec)) p.secrecyClearance = 'none';
          else if (/^[123]$/.test(sec)) p.secrecyClearance = sec;
          else p.secrecyClearance = sec;
        }
        if (!p.education && tRow.education) p.education = tRow.education;
        if (!p.bloodGroup && tRow.blood) p.bloodGroup = tRow.blood;
        if (!p.address && tRow.address) p.address = tRow.address;
      }
    } catch (eT) {}
    if ((!Array.isArray(p.educations) || !p.educations.length) && p.education) {
      p.educations = String(p.education).split(/\s*;\s*/).map(function (part) {
        part = String(part || '').trim();
        return part ? { text: part } : null;
      }).filter(Boolean);
    }
    if ((!Array.isArray(p.educations) || !p.educations.length) && Array.isArray(dossier.educations) && dossier.educations.length) {
      p.educations = dossier.educations.map(function (x) {
        return typeof x === 'string' ? { text: x } : (x && x.text ? { text: x.text } : null);
      }).filter(Boolean);
      p.education = p.educations.map(function (x) { return (x && x.text) || ''; }).filter(Boolean).join('; ');
    }
    if (!Array.isArray(p.educations)) p.educations = [];
    if (!p.educationGroup && p.education && typeof window.kmPersonInferEducationGroup === 'function') {
      p.educationGroup = window.kmPersonInferEducationGroup(p.education);
    }

    var photoSrc = typeof kmPersonPhotoSrc === 'function' ? kmPersonPhotoSrc(p) : '';
    var photo = photoSrc
      ? '<img id="kmPersonCardImg" src="' + photoSrc + '" alt="" style="width:120px;height:120px;object-fit:cover;border-radius:8px;border:1px solid #c5d0da">'
      : '<div id="kmPersonCardImg" style="width:120px;height:120px;border-radius:8px;background:#eef2f6;display:flex;align-items:center;justify-content:center;color:#7a8794;font-size:12px;text-align:center;padding:8px;box-sizing:border-box">Լուսանկար չկա</div>';

    var h = kmPersonDutyHistory(p.name);
    var vacs = (db.vacations || []).filter(function (v) { return v && v.person === p.name; });
    var vacHtml = vacs.length
      ? '<ul style="margin:6px 0 0;padding-left:18px">' + vacs.map(function (v) {
        return '<li>' + esc(v.from || '') + ' → ' + esc(v.to || '') +
          (v.kind ? ' · ' + esc(v.kind) : '') + '</li>';
      }).join('') + '</ul>'
      : '<p class="muted" style="margin:6px 0 0">Արձակուրդ/բացակայություն չկա</p>';
    var exams = kmPersonTrialExams(p.name);
    var examHtml = exams.length
      ? '<ul style="margin:6px 0 0;padding-left:18px">' + exams.map(function (ex) {
        return '<li>' + esc(ex.whenDate || ex.createdAt || '') +
          (ex.post ? ' · ' + esc(ex.post) : '') +
          (ex.violation ? ' · ' + esc(ex.violation) : '') +
          (ex.text ? '<div class="muted" style="margin-top:2px">' + esc(String(ex.text).slice(0, 280)) + '</div>' : '') +
          '</li>';
      }).join('') + '</ul>'
      : '<p class="muted" style="margin:6px 0 0">Ծառայողական քննություն չկա</p>';

    var ro = canEdit ? '' : ' readonly';
    var dis = canEdit ? '' : ' disabled';
    var artRo = isAdmin && canEdit ? '' : ' readonly';
    var artDis = isAdmin && canEdit ? '' : ' disabled';

    function selOpts(list, cur) {
      return list.map(function (x) {
        var v = x.value != null ? x.value : x;
        var lab = x.label != null ? x.label : x;
        return '<option value="' + esc(v) + '"' + (String(v) === String(cur || '') ? ' selected' : '') + '>' + esc(lab) + '</option>';
      }).join('');
    }
    var familyOpts = selOpts([
      { value: '', label: '— ընտրել —' },
      'Ամուսնացած', 'Չամուսնացած', 'Ամուսնալուծված', 'Այրի'
    ], p.familyStatus);
    var regionNames = Object.keys((window.kmPersonCardCatalog && window.kmPersonCardCatalog.regions) || {});
    var regionOpts = selOpts([{ value: '', label: '— ընտրել —' }].concat(regionNames), p.region);
    var cityList = typeof window.kmPersonCitiesForRegion === 'function'
      ? window.kmPersonCitiesForRegion(p.region) : [];
    if (p.city && cityList.indexOf(p.city) < 0) cityList = [p.city].concat(cityList);
    var cityOpts = selOpts([{ value: '', label: '— ընտրել —' }].concat(cityList), p.city);
    var eduItemsHtml = (p.educations || []).map(function (it, i) {
      return '<div class="kmPcEduItem" data-i="' + i + '"><span>' + esc((it && it.text) || '') + '</span>' +
        (canEdit ? '<button type="button" data-km-edu-del="' + i + '" title="Հեռացնել">×</button>' : '') +
        '</div>';
    }).join('') || '<span class="muted">Կրթություն չի նշված</span>';
    var secrecyOpts = selOpts(
      [{ value: '', label: '— ընտրել —' }].concat(
        ((window.kmPersonCardCatalog && window.kmPersonCardCatalog.secrecyLevels) || [])
      ),
      p.secrecyClearance
    );
    var artCat = (window.kmPersonCardCatalog && window.kmPersonCardCatalog.articles404) || { numbers: [], points: ['Ա', 'Բ', 'Գ', 'Դ'] };
    if (!Array.isArray(p.articleItems) || !p.articleItems.length) {
      p.articleItems = typeof window.kmPersonParseArticles === 'function'
        ? window.kmPersonParseArticles(p.articles) : [];
    }
    var artNumOpts = selOpts([{ value: '', label: '— հոդված —' }].concat(artCat.numbers || []), '');
    var artPointOpts = selOpts([{ value: '', label: '— կետ —' }].concat(artCat.points || []), '');
    var artChips = (p.articleItems || []).map(function (it, i) {
      return '<span class="kmPcArtChip" data-i="' + i + '">' + esc(it.label || '') +
        (isAdmin && canEdit ? ' <button type="button" data-km-art-del="' + i + '" title="Հեռացնել">×</button>' : '') +
        '</span>';
    }).join('') || '<span class="muted">Հոդված չի նշված</span>';
    var bloodOpts = selOpts([
      { value: '', label: '— ընտրել —' },
      'O(I) Rh+', 'O(I) Rh-', 'A(II) Rh+', 'A(II) Rh-',
      'B(III) Rh+', 'B(III) Rh-', 'AB(IV) Rh+', 'AB(IV) Rh-'
    ], p.bloodGroup);

    var callBtn = p.phone
      ? '<a class="kmCallBtn" href="' + (typeof kmTelHref === 'function' ? kmTelHref(p.phone) : ('tel:' + String(p.phone))) + '">Զանգ</a>'
      : '';

    kmExtModal('Անձի քարտ — ' + (p.name || ''),
      '<div class="kmPcWrap">' +
        '<div class="kmPcTop">' +
          '<div class="kmPcPhoto">' + photo +
            (canEdit
              ? '<div class="kmPcPhotoBtns">' +
                '<button type="button" id="kmPersonCardPhoto">Տեղադրել լուսանկար</button>' +
                (photoSrc ? '<button type="button" id="kmPersonCardPhotoClear">Հանել</button>' : '') +
                '</div>'
              : '') +
          '</div>' +
          '<div class="kmPcHead">' +
            '<div style="font-size:18px;font-weight:700">' + esc(p.name || '') + '</div>' +
            '<div class="muted">' + esc(rankOf(p)) +
              (p.rankSlot ? ' · հաստիք՝ ' + esc(p.rankSlot) : '') +
              (p.unit ? ' · ' + esc(p.unit) : '') + '</div>' +
            '<div style="margin-top:8px">Կարգավիճակ՝ <b>' + (p.blocked ? 'արգելափակված' : 'ակտիվ') + '</b></div>' +
            '<div>Հերթապահություններ՝ <b>' + h.total + '</b></div>' +
            (callBtn ? '<div style="margin-top:6px">' + callBtn + '</div>' : '') +
          '</div>' +
        '</div>' +
        '<div class="kmPcGrid">' +
          '<div class="kmPcField kmPcFull" style="margin:0 0 4px"><b style="color:#0d4a66">Զորամասի Արխիվ · հաստիք</b><span class="muted" style="margin-left:8px;font-size:12px">երկկողմանի սինխրոն</span></div>' +
          '<label class="kmPcField"><span>Ստորաբաժանում</span>' +
            '<input id="kmPcArchUnit" type="text" value="' + esc(p.unit || '') + '"' + ro + '></label>' +
          '<label class="kmPcField"><span>Պաշտոն</span>' +
            '<input id="kmPcArchPost" type="text" value="' + esc(p.post || '') + '"' + ro + '></label>' +
          '<label class="kmPcField"><span>Հ/Հ</span>' +
            '<input id="kmPcArchSeq" type="text" value="' + esc(p.seq || p.posOrder || '') + '"' + ro + '></label>' +
          '<label class="kmPcField"><span>Գաղտնիության կարգ</span>' +
            '<input id="kmPcArchSecret" type="text" value="' + esc(p.secret || '') + '" placeholder="արխիվի կարգ"' + ro + '></label>' +
          '<label class="kmPcField"><span>ԶՀՄ (ВУС)</span>' +
            '<input id="kmPcArchVus" type="text" value="' + esc(p.vus || '') + '"' + ro + '></label>' +
          '<label class="kmPcField"><span>Կոդ</span>' +
            '<input id="kmPcArchCode" type="text" value="' + esc(p.postCode || p.code || '') + '"' + ro + '></label>' +
          '<label class="kmPcField"><span>Կոչումը ըստ հաստիքի</span>' +
            '<input id="kmPcArchRankSlot" type="text" value="' + esc(p.rankSlot || '') + '"' + ro + '></label>' +
          '<label class="kmPcField"><span>Կոչում</span>' +
            '<input id="kmPcArchRank" type="text" value="' + esc(typeof rankOf === 'function' ? rankOf(p) : (p.rank || '')) + '"' + ro + '></label>' +
          '<label class="kmPcField"><span>Ծննդյան թիվ</span>' +
            '<input id="kmPcArchBirth" type="text" value="' + esc(p.birth || p.birthDate || '') + '"' + ro + '></label>' +
          '<label class="kmPcField"><span>Արձակուրդ</span>' +
            '<input id="kmPcArchVacation" type="text" value="' + esc(p.vacation || '') + '"' + ro + '></label>' +
          '<label class="kmPcField"><span>Պայմանագիր (արխիվ)</span>' +
            '<input id="kmPcArchContract" type="text" value="' + esc(p.contract || '') + '"' + ro + '></label>' +
          '<label class="kmPcField"><span>ԶԿ (ՏՍ)</span>' +
            '<input id="kmPcArchZk" type="text" value="' + esc(p.zk || '') + '"' + ro + '></label>' +
          /* KM_PERSON_CARD_ARCHIVE_BIDI_V1_EXT */
          '<label class="kmPcField"><span>Բջջային հեռախոսահամար</span>' +
            '<input id="kmPcPhone" type="tel" value="' + esc(p.phone || '') + '" placeholder="+374 XX XXX XXX"' + ro + '></label>' +
          '<div class="kmPcField kmPcFull"><span>Կրթություն</span>' +
            (canEdit
              ? '<div class="kmPcEduBar">' +
                '<input id="kmPcEduNew" type="text" placeholder="գրել կրթությունը">' +
                '<button type="button" id="kmPcEduAdd">＋ Ավելացնել</button>' +
                '</div>'
              : '') +
            '<div id="kmPcEduList" class="kmPcEduList">' + eduItemsHtml + '</div>' +
          '</div>' +
          '<label class="kmPcField"><span>Ընտանեկան դրություն</span>' +
            '<select id="kmPcFamily"' + dis + '>' + familyOpts + '</select></label>' +
          '<label class="kmPcField"><span>Պայմանագրի սկիզբ</span>' +
            '<input id="kmPcContractStart" type="date" value="' + esc(String(p.contractStart || '').slice(0, 10)) + '"' + dis + '></label>' +
          '<label class="kmPcField"><span>Վերջին պայմանագրի կնքման ժամկետ</span>' +
            '<select id="kmPcContractTerm"' + dis + '>' + selOpts([
              { value: '', label: '— ընտրել —' },
              { value: '3m', label: '3 ամիս' },
              { value: '6m', label: '6 ամիս' },
              { value: '1y', label: '1 տարի' },
              { value: '3y', label: '3 տարի' },
              { value: '20y', label: '20 տարի' }
            ], p.contractTerm) + '</select></label>' +
          '<label class="kmPcField"><span>Պայմանագրի ավարտ</span>' +
            '<input id="kmPcContractEnd" type="date" value="' + esc(String(p.endDate || p.contractEnd || '').slice(0, 10)) + '"' + dis + '></label>' +
          '<label class="kmPcField"><span>Մարզ</span>' +
            '<select id="kmPcRegion"' + dis + '>' + regionOpts + '</select></label>' +
          '<label class="kmPcField"><span>Քաղաք / համայնք</span>' +
            '<select id="kmPcCity"' + dis + '>' + cityOpts + '</select></label>' +
          '<label class="kmPcField"><span>Գաղտնիության թույլատվություն</span>' +
            '<select id="kmPcSecrecy"' + dis + '>' + secrecyOpts + '</select></label>' +
          '<label class="kmPcField"><span>Անձնական վկայական (համար)</span>' +
            '<input id="kmPcIdCard" type="text" value="' + esc(p.idCard || '') + '" placeholder="համար"' + ro + '></label>' +
          '<label class="kmPcField"><span>ՀԾՀ</span>' +
            '<input id="kmPcHsk" type="text" value="' + esc(p.hsk || '') + '" placeholder="ՀԾՀ"' + ro + '></label>' +
          '<label class="kmPcField kmPcFull"><span>Հասցե</span>' +
            '<input id="kmPcAddress" type="text" value="' + esc(p.address || '') + '"' + ro + '></label>' +
          '<label class="kmPcField kmPcFull"><span>Զինվորական կոմիսարյատ</span>' +
            '<input id="kmPcCommissariat" type="text" value="' + esc(p.commissariat || '') + '"' + ro + '></label>' +
          '<label class="kmPcField"><span>Արյան խումբ</span>' +
            '<select id="kmPcBlood"' + dis + '>' + bloodOpts + '</select></label>' +
          '<label class="kmPcField kmPcFull"><span>Ուղեկցվող հիվանդություններ</span>' +
            '<textarea id="kmPcIllnesses" rows="2"' + ro + '>' + esc(p.illnesses || '') + '</textarea></label>' +
          '<div class="kmPcField kmPcFull"><span>Հոդվածներ (404-Ն կարգով)' +
            (isAdmin ? '' : ' <small class="muted">— միայն ադմին</small>') + '</span>' +
            '<div class="kmPcArtBar">' +
              '<select id="kmPcArtNum"' + artDis + '>' + artNumOpts + '</select>' +
              '<select id="kmPcArtPoint"' + artDis + '>' + artPointOpts + '</select>' +
              (isAdmin && canEdit ? '<button type="button" id="kmPcArtAdd">＋ Ավելացնել</button>' : '') +
            '</div>' +
            '<div id="kmPcArtList" class="kmPcArtList">' + artChips + '</div>' +
            '<input type="hidden" id="kmPcArticles" value="' + esc(p.articles || '') + '">' +
          '</div>' +
          '<label class="kmPcField kmPcFull"><span>Նշում (անձի մասին)</span>' +
            '<textarea id="kmPersonCardNote" rows="2"' + ro + '>' + esc(p.note || '') + '</textarea></label>' +
        '</div>' +
        (typeof window.kmPersonLinkedSectionsHtml === 'function' ? window.kmPersonLinkedSectionsHtml(p.name) : '') +
        '<h4 style="margin:14px 0 0">Ծառայողական քննություններ</h4>' + examHtml +
        '<h4 style="margin:14px 0 0">Արձակուրդ / բացակայություն</h4>' + vacHtml +
        (typeof window.kmPersonCardArchiveSectionHtml === 'function' ? window.kmPersonCardArchiveSectionHtml(p, canEdit) : '') +
        '<div class="toolbar" style="margin-top:14px">' +
          (canEdit ? '<button type="button" class="primary" id="kmPersonCardSave">Պահպանել</button>' : '') +
          (canEdit && !(typeof kmPersonIsVacantStub === 'function' && kmPersonIsVacantStub(p))
            ? '<button type="button" id="kmPersonCardPromote">Պաշտոնի բարձրացում</button>' : '') +
          '<button type="button" id="kmPersonCardHish">Հիշողություն</button>' +
          '<button type="button" id="kmPersonCardPrint">Տպել</button>' +
          '<button type="button" id="kmPersonCardPdf">PDF</button>' +
          '<button type="button" id="kmPersonCardHist">Հերթապահության պատմություն</button>' +
          '<button type="button" id="kmPersonCardVac">Արձակուրդներ</button>' +
        '</div>' +
      '</div>',
      function (box) {
        window._kmPersonCardOpenName = String(p.name || '').trim();
        try {
          if (typeof window.kmPersonCardArchiveBind === 'function') window.kmPersonCardArchiveBind(box, p, canEdit);
        } catch (eArch) {}
    /* KM_PERSON_CARD_ARCHIVE_BIDI_V1_EXT live bi-di */
    try {
      var __archIds = ['kmPcArchUnit','kmPcArchPost','kmPcArchSeq','kmPcArchSecret','kmPcArchVus','kmPcArchCode','kmPcArchRankSlot','kmPcArchRank','kmPcArchBirth','kmPcArchVacation','kmPcArchContract','kmPcArchZk'];
      var __livePush = function () {
        if (!canEdit) return;
        var map = {
          unit: 'kmPcArchUnit', post: 'kmPcArchPost', seq: 'kmPcArchSeq', secret: 'kmPcArchSecret',
          vus: 'kmPcArchVus', postCode: 'kmPcArchCode', rankSlot: 'kmPcArchRankSlot', rank: 'kmPcArchRank',
          birth: 'kmPcArchBirth', vacation: 'kmPcArchVacation', contract: 'kmPcArchContract', zk: 'kmPcArchZk'
        };
        Object.keys(map).forEach(function (k) {
          var el = document.getElementById(map[k]);
          if (!el) return;
          var v = String(el.value || '').trim();
          if (k === 'postCode') { p.postCode = v; p.code = v; }
          else p[k] = v;
        });
        if (window._kmPcArchLiveT) clearTimeout(window._kmPcArchLiveT);
        window._kmPcArchLiveT = setTimeout(function () {
          window._kmPcArchLiveT = 0;
          try {
            if (typeof window.kmPushPersonCardToUnitArchive === 'function') window.kmPushPersonCardToUnitArchive(p, {});
          } catch (eL) {}
        }, 180);
      };
      setTimeout(function () {
        __archIds.forEach(function (id) {
          var el = document.getElementById(id);
          if (!el || el.__kmPcArchBound) return;
          el.__kmPcArchBound = true;
          el.addEventListener('change', __livePush);
          el.addEventListener('input', __livePush);
        });
      }, 0);
    } catch (eLive) {}
        window._kmPersonCardOpenIndex = idx;
        if (typeof window.kmPersonLinkedBind === 'function') window.kmPersonLinkedBind(box, p, idx);
        function kmPcSyncArticlesHidden() {
          p.articles = typeof window.kmPersonFormatArticles === 'function'
            ? window.kmPersonFormatArticles(p.articleItems || [])
            : (p.articleItems || []).map(function (x) { return x.label; }).join('; ');
          var hid = box.querySelector('#kmPcArticles');
          if (hid) hid.value = p.articles;
          var list = box.querySelector('#kmPcArtList');
          if (!list) return;
          list.innerHTML = (p.articleItems || []).map(function (it, i) {
            return '<span class="kmPcArtChip" data-i="' + i + '">' + esc(it.label || '') +
              (isAdmin && canEdit ? ' <button type="button" data-km-art-del="' + i + '" title="Հեռացնել">×</button>' : '') +
              '</span>';
          }).join('') || '<span class="muted">Հոդված չի նշված</span>';
          list.querySelectorAll('[data-km-art-del]').forEach(function (btn) {
            btn.onclick = function () {
              var i = Number(btn.getAttribute('data-km-art-del'));
              p.articleItems.splice(i, 1);
              kmPcSyncArticlesHidden();
            };
          });
        }
        kmPcSyncArticlesHidden();
        var artAdd = box.querySelector('#kmPcArtAdd');
        if (artAdd) artAdd.onclick = function () {
          if (!isAdmin || !canEdit) return;
          var num = String((box.querySelector('#kmPcArtNum') || {}).value || '').trim();
          var pt = String((box.querySelector('#kmPcArtPoint') || {}).value || '').trim();
          if (!num) { if (typeof toast === 'function') toast('Ընտրեք հոդվածը', 'warn'); return; }
          if (!pt) { if (typeof toast === 'function') toast('Ընտրեք հոդվածի կետը (Ա/Բ/Գ/Դ)', 'warn'); return; }
          var label = num + ' ' + pt;
          if (!Array.isArray(p.articleItems)) p.articleItems = [];
          if (p.articleItems.some(function (x) { return x.label === label; })) {
            if (typeof toast === 'function') toast('Արդեն ավելացված է', 'warn'); return;
          }
          p.articleItems.push({ article: num, point: pt, label: label });
          kmPcSyncArticlesHidden();
        };
        function refillSelect(sel, values, cur, placeholder) {
          if (!sel) return;
          var html = '<option value="">' + esc(placeholder || '— ընտրել —') + '</option>';
          (values || []).forEach(function (v) {
            html += '<option value="' + esc(v) + '"' + (String(v) === String(cur || '') ? ' selected' : '') + '>' + esc(v) + '</option>';
          });
          sel.innerHTML = html;
        }
        var regionEl = box.querySelector('#kmPcRegion');
        var cityEl = box.querySelector('#kmPcCity');
        if (regionEl && cityEl && canEdit) {
          regionEl.onchange = function () {
            var prevCity = String(cityEl.value || '').trim();
            var cities = typeof window.kmPersonCitiesForRegion === 'function'
              ? window.kmPersonCitiesForRegion(regionEl.value) : [];
            refillSelect(cityEl, cities, cities.indexOf(prevCity) >= 0 ? prevCity : '', '— ընտրել —');
          };
        }
        function kmPcSyncEduList() {
          if (!Array.isArray(p.educations)) p.educations = [];
          p.education = p.educations.map(function (x) {
            return String((x && x.text) || '').trim();
          }).filter(Boolean).join('; ');
          var list = box.querySelector('#kmPcEduList');
          if (!list) return;
          list.innerHTML = (p.educations || []).map(function (it, i) {
            return '<div class="kmPcEduItem" data-i="' + i + '"><span>' + esc((it && it.text) || '') + '</span>' +
              (canEdit ? '<button type="button" data-km-edu-del="' + i + '" title="Հեռացնել">×</button>' : '') +
              '</div>';
          }).join('') || '<span class="muted">Կրթություն չի նշված</span>';
          list.querySelectorAll('[data-km-edu-del]').forEach(function (btn) {
            btn.onclick = function () {
              var i = Number(btn.getAttribute('data-km-edu-del'));
              p.educations.splice(i, 1);
              kmPcSyncEduList();
            };
          });
        }
        kmPcSyncEduList();
        var beforeSnap = typeof window.kmPersonCardSnapshot === 'function'
          ? window.kmPersonCardSnapshot(p)
          : null;
        function kmPcApplyContractTerm() {
          var startEl = box.querySelector('#kmPcContractStart');
          var termEl = box.querySelector('#kmPcContractTerm');
          var endEl = box.querySelector('#kmPcContractEnd');
          if (!startEl || !termEl || !endEl) return;
          var next = kmAddContractTerm(startEl.value, termEl.value);
          if (next) endEl.value = next;
        }
        var termEl0 = box.querySelector('#kmPcContractTerm');
        var startEl0 = box.querySelector('#kmPcContractStart');
        if (canEdit && termEl0) termEl0.onchange = kmPcApplyContractTerm;
        if (canEdit && startEl0) {
          startEl0.onchange = function () {
            if (termEl0 && termEl0.value) kmPcApplyContractTerm();
          };
        }
        var eduAdd = box.querySelector('#kmPcEduAdd');
        var eduNew = box.querySelector('#kmPcEduNew');
        if (eduAdd && canEdit) {
          function addEdu() {
            var text = String((eduNew && eduNew.value) || '').trim();
            if (!text) {
              if (typeof toast === 'function') toast('Գրեք կրթությունը', 'warn');
              return;
            }
            if (!Array.isArray(p.educations)) p.educations = [];
            if (p.educations.some(function (x) {
              return String((x && x.text) || '').trim().toLowerCase() === text.toLowerCase();
            })) {
              if (typeof toast === 'function') toast('Արդեն ավելացված է', 'warn');
              return;
            }
            p.educations.push({ text: text });
            if (eduNew) eduNew.value = '';
            kmPcSyncEduList();
          }
          eduAdd.onclick = addEdu;
          if (eduNew) {
            eduNew.onkeydown = function (ev) {
              if (ev.key === 'Enter') {
                ev.preventDefault();
                addEdu();
              }
            };
          }
        }
        var saveBtn = box.querySelector('#kmPersonCardSave');
        if (saveBtn) saveBtn.onclick = async function () {
          if (!canEdit) { toast('Դիտորդի իրավունք', 'error'); return; }
          /* KM_PERSON_CARD_ARCHIVE_BIDI_V1_EXT save archive fields */
          p.unit = String((box.querySelector('#kmPcArchUnit') || {}).value || p.unit || '').trim();
          p.post = String((box.querySelector('#kmPcArchPost') || {}).value || p.post || '').trim();
          p.seq = String((box.querySelector('#kmPcArchSeq') || {}).value || '').trim();
          p.secret = String((box.querySelector('#kmPcArchSecret') || {}).value || '').trim();
          p.vus = String((box.querySelector('#kmPcArchVus') || {}).value || '').trim();
          p.postCode = String((box.querySelector('#kmPcArchCode') || {}).value || '').trim();
          p.code = p.postCode;
          p.rankSlot = String((box.querySelector('#kmPcArchRankSlot') || {}).value || '').trim();
          var __rk = String((box.querySelector('#kmPcArchRank') || {}).value || '').trim();
          if (__rk) p.rank = __rk;
          p.birth = String((box.querySelector('#kmPcArchBirth') || {}).value || p.birth || '').trim();
          p.vacation = String((box.querySelector('#kmPcArchVacation') || {}).value || '').trim();
          p.contract = String((box.querySelector('#kmPcArchContract') || {}).value || '').trim();
          p.zk = String((box.querySelector('#kmPcArchZk') || {}).value || '').trim();
          p.phone = String((box.querySelector('#kmPcPhone') || {}).value || '').trim();
          if (!Array.isArray(p.educations)) p.educations = [];
          p.education = p.educations.map(function (x) {
            return String((x && x.text) || '').trim();
          }).filter(Boolean).join('; ');
          if (p.education && typeof window.kmPersonInferEducationGroup === 'function') {
            p.educationGroup = window.kmPersonInferEducationGroup(
              String((p.educations[0] && p.educations[0].text) || p.education)
            ) || p.educationGroup || '';
          }
          p.familyStatus = String((box.querySelector('#kmPcFamily') || {}).value || '').trim();
          p.family = p.familyStatus;
          p.contractStart = String((box.querySelector('#kmPcContractStart') || {}).value || '').trim();
          p.contractTerm = String((box.querySelector('#kmPcContractTerm') || {}).value || '').trim();
          p.endDate = String((box.querySelector('#kmPcContractEnd') || {}).value || '').trim();
          if (p.contractStart && p.contractTerm) {
            var autoEnd = kmAddContractTerm(p.contractStart, p.contractTerm);
            if (autoEnd) p.endDate = autoEnd;
          }
          p.contractEnd = p.endDate;
          p.region = String((box.querySelector('#kmPcRegion') || {}).value || '').trim();
          p.city = String((box.querySelector('#kmPcCity') || {}).value || '').trim();
          p.secrecyClearance = String((box.querySelector('#kmPcSecrecy') || {}).value || '').trim();
          p.idCard = String((box.querySelector('#kmPcIdCard') || {}).value || '').trim();
          p.hsk = String((box.querySelector('#kmPcHsk') || {}).value || '').trim();
          p.address = String((box.querySelector('#kmPcAddress') || {}).value || '').trim();
          p.commissariat = String((box.querySelector('#kmPcCommissariat') || {}).value || '').trim();
          p.bloodGroup = String((box.querySelector('#kmPcBlood') || {}).value || '').trim();
          p.illnesses = String((box.querySelector('#kmPcIllnesses') || {}).value || '').trim();
          try {
            var rowsSync = (((db.troopStructure || {}).staff || {}).rows) || [];
            rowsSync.forEach(function (r) {
              if (!r || String(r.name || '').trim() !== String(p.name || '').trim()) return;
              r.idCard = p.idCard;
              r.hsk = p.hsk;
              r.secret = p.secrecyClearance === 'none' ? 'Չունի' : (p.secrecyClearance || r.secret || '');
              if (p.education) r.education = p.education;
              if (p.bloodGroup) r.blood = p.bloodGroup;
              if (p.address) r.address = p.address;
              if (p.familyStatus) r.family = p.familyStatus;
              if (p.unit) r.unit = p.unit;
              if (p.post) r.position = p.post;
              if (p.seq) r.seq = p.seq;
              if (p.secret) r.secret = p.secret;
              if (p.vus) r.vus = p.vus;
              if (p.postCode) r.code = p.postCode;
              if (p.rankSlot) r.rankSlot = p.rankSlot;
              if (p.rank) r.rank = p.rank;
              if (p.phone) r.contact = p.phone;
              if (p.birth) r.birth = p.birth;
              if (p.vacation) r.vacation = p.vacation;
              if (p.contract) r.contract = p.contract;
              if (p.zk) r.zk = p.zk;
            });
          } catch (eSync) {}
          try {
            if (typeof window.kmPushPersonCardToUnitArchive === 'function') {
              window.kmPushPersonCardToUnitArchive(p, { clearEmpty: false });
            }
          } catch (ePush) {}
          try {
            if (window.kmPersonnelSyncBus && typeof window.kmPersonnelSyncBus.syncIdentityFromRow === 'function') {
              window.kmPersonnelSyncBus.syncIdentityFromRow({
                name: p.name,
                code: p.postCode || p.code,
                position: p.post,
                unit: p.unit,
                rankSlot: p.rankSlot,
                rank: p.rank
              });
            }
          } catch (eBus) {}
          if (isAdmin) {
            if (!Array.isArray(p.articleItems)) p.articleItems = [];
            p.articles = typeof window.kmPersonFormatArticles === 'function'
              ? window.kmPersonFormatArticles(p.articleItems)
              : String((box.querySelector('#kmPcArticles') || {}).value || '').trim();
          }
          p.note = String((box.querySelector('#kmPersonCardNote') || {}).value || '').trim();
          if (typeof window.kmPersonLinkedCollect === 'function') {
            window.kmPersonLinkedCollect(box, p);
          } else {
            if (!db.unitDossiers || typeof db.unitDossiers !== 'object') db.unitDossiers = {};
            var d = db.unitDossiers[p.name] || {};
            d.education = p.education;
            d.educations = Array.isArray(p.educations) ? p.educations.slice() : [];
            d.family = p.familyStatus;
            db.unitDossiers[p.name] = d;
          }
          try {
            if (typeof window.kmFlushDirtyShtatExcel === 'function') await window.kmFlushDirtyShtatExcel();
          } catch (eFlush) {}
          if (typeof window.kmPersonDedupeAppointments === 'function') {
            window.kmPersonDedupeAppointments(p, true);
          }
          if (typeof window.kmHishoxutyunLog === 'function') {
            var afterSnap = typeof window.kmPersonCardSnapshot === 'function'
              ? window.kmPersonCardSnapshot(p)
              : null;
            var diff = (beforeSnap && afterSnap && typeof window.kmPersonCardDiffText === 'function')
              ? window.kmPersonCardDiffText(beforeSnap, afterSnap, p.name)
              : '';
            if (diff) {
              window.kmHishoxutyunLog({
                section: 'people',
                sectionLabel: 'Անձնակազմ և քարտ',
                subsection: 'card',
                subsectionLabel: 'Քարտ',
                action: 'change',
                detail: diff
              });
              beforeSnap = afterSnap;
            }
          }
          if (typeof save === 'function') await save(true);
          toast('Անձի քարտը պահպանվեց', 'ok');
        };
        var promoBtn = box.querySelector('#kmPersonCardPromote');
        if (promoBtn && canEdit) {
          promoBtn.onclick = function () {
            /* KM_PERSON_CARD_PROMO_ENSURE_POSITIONS_V1 */
            var runPromo = function () {
              try {
                if (typeof window.kmOpenPositionPromotion === 'function') {
                  window.kmOpenPositionPromotion(idx);
                } else if (typeof toast === 'function') {
                  toast('Պաշտոնի բարձրացումը հասանելի չէ', 'warn');
                }
              } catch (ePromoOpen) {
                if (typeof toast === 'function') {
                  toast('Պաշտոնի բարձրացում՝ ' + (ePromoOpen && ePromoOpen.message ? ePromoOpen.message : ePromoOpen), 'error');
                }
              }
            };
            if (typeof window.kmOpenPositionPromotion === 'function') {
              runPromo();
            } else if (typeof window.kmLoadPageModules === 'function') {
              window.kmLoadPageModules('positions', runPromo);
            } else if (typeof window.kmEnsureModule === 'function') {
              try { window.kmEnsureModule('positions'); } catch (eEns) {}
              setTimeout(runPromo, 120);
            } else {
              runPromo();
            }
          };
        }
        var hishBtn = box.querySelector('#kmPersonCardHish');
        if (hishBtn) hishBtn.onclick = function () {
          var m = document.getElementById('kmExtModal');
          if (m) m.remove();
          if (typeof window.kmOpenHishoxutyun === 'function') window.kmOpenHishoxutyun('people');
        };
        var hist = box.querySelector('#kmPersonCardHist');
        if (hist) hist.onclick = function () {
          var m = document.getElementById('kmExtModal');
          if (m) m.remove();
          window.kmShowDutyHistory(idx);
        };
        var printBtn = box.querySelector('#kmPersonCardPrint');
        if (printBtn) printBtn.onclick = function () {
          window.kmPrintPersonCard(idx);
        };
        var pdfBtn = box.querySelector('#kmPersonCardPdf');
        if (pdfBtn) pdfBtn.onclick = function () {
          window.kmExportPersonCardPdf(idx);
        };
        var ph = box.querySelector('#kmPersonCardPhoto');
        if (ph) ph.onclick = function () {
          if (typeof kmSetPersonPhoto === 'function') kmSetPersonPhoto(idx, true);
        };
        var phClear = box.querySelector('#kmPersonCardPhotoClear');
        if (phClear) phClear.onclick = async function () {
          if (!canEdit) return;
          if (!confirm('Հանե՞լ լուսանկարը։')) return;
          p.photo = '';
          p.photoId = '';
          if (typeof window.kmHishoxutyunLog === 'function') {
            window.kmHishoxutyunLog({
              section: 'people',
              sectionLabel: 'Անձնակազմ և քարտ',
              subsection: 'card',
              subsectionLabel: 'Քարտ',
              action: 'remove',
              detail: 'Քարտ՝ ' + (p.name || '') + ' · հանել է լուսանկարը'
            });
          }
          if (typeof save === 'function') await save(true);
          toast('Լուսանկարը հանվեց', 'ok');
          var img = box.querySelector('#kmPersonCardImg');
          if (img) {
            var phWrap = img.closest('.kmPcPhoto');
            var placeholder = '<div id="kmPersonCardImg" style="width:120px;height:120px;border-radius:8px;background:#eef2f6;display:flex;align-items:center;justify-content:center;color:#7a8794;font-size:12px;text-align:center;padding:8px;box-sizing:border-box">Լուսանկար չկա</div>';
            if (phWrap) {
              var btns = phWrap.querySelector('.kmPcPhotoBtns');
              img.outerHTML = placeholder;
              if (btns) {
                var clearBtn = btns.querySelector('#kmPersonCardPhotoClear');
                if (clearBtn) clearBtn.remove();
              }
            }
          }
        };
        var vac = box.querySelector('#kmPersonCardVac');
        if (vac) vac.onclick = function () {
          var m = document.getElementById('kmExtModal');
          if (m) m.remove();
          if (typeof openVacations === 'function') openVacations();
        };
      });
  };

  function kmPersonCardDocHtml(p) {
    window.kmEnsurePersonProfile(p);
    var photoSrc = typeof kmPersonPhotoSrc === 'function' ? kmPersonPhotoSrc(p) : '';
    var secrecyLab = '';
    try {
      var levels = (window.kmPersonCardCatalog && window.kmPersonCardCatalog.secrecyLevels) || [];
      var hit = levels.find(function (x) { return String(x.value) === String(p.secrecyClearance || ''); });
      secrecyLab = hit ? hit.label : (p.secrecyClearance || '');
    } catch (e1) { secrecyLab = p.secrecyClearance || ''; }
    var arts = '';
    if (typeof window.kmPersonFormatArticles === 'function') arts = window.kmPersonFormatArticles(p.articleItems || []);
    else arts = p.articles || '';
    var vacs = (db.vacations || []).filter(function (v) { return v && v.person === p.name; });
    var vacTxt = vacs.length
      ? vacs.map(function (v) {
        return (v.from || '') + ' → ' + (v.to || '') + (v.kind ? ' · ' + v.kind : '');
      }).join('<br>')
      : '—';
    var apps = (p.appointments || []).slice(0, 12);
    var appTxt = apps.length
      ? apps.map(function (a) {
        return (a.post || '—') + (a.orderNumber ? ' · №' + a.orderNumber : '') + (a.date ? ' · ' + a.date : '');
      }).join('<br>')
      : '—';
    function row(lab, val) {
      return '<tr><th style="width:34%">' + esc(lab) + '</th><td>' + (val ? esc(String(val)) : '—') + '</td></tr>';
    }
    return '' +
      '<div style="display:flex;gap:16px;align-items:flex-start;margin:0 0 12px">' +
        (photoSrc
          ? '<img src="' + photoSrc + '" alt="" style="width:110px;height:110px;object-fit:cover;border:1px solid #333">'
          : '<div style="width:110px;height:110px;border:1px solid #333;display:flex;align-items:center;justify-content:center;font-size:11px;color:#666">Լուսանկար չկա</div>') +
        '<div>' +
          '<div style="font-size:20px;font-weight:700">' + esc(p.name || '') + '</div>' +
          '<div style="margin-top:4px">' + esc(rankOf(p) || '') +
            (p.post ? ' · ' + esc(p.post) : '') +
            (p.unit ? '<br>' + esc(p.unit) : '') +
          '</div>' +
          '<div style="margin-top:6px">Կարգավիճակ՝ <b>' + (p.blocked ? 'արգելափակված' : 'ակտիվ') + '</b></div>' +
        '</div>' +
      '</div>' +
      '<table>' +
        row('Բջջային', p.phone) +
        row('Կրթություն', (Array.isArray(p.educations) && p.educations.length
          ? p.educations.map(function (x) { return (x && x.text) || ''; }).filter(Boolean).join(' · ')
          : [p.educationGroup, p.education].filter(Boolean).join(' · '))) +
        row('Ընտանեկան դրություն', p.familyStatus || p.family) +
        row('Պայմանագրի սկիզբ', p.contractStart) +
        row('Վերջին պայմանագրի կնքման ժամկետ', kmContractTermLabel(p.contractTerm)) +
        row('Պայմանագրի ավարտ', p.endDate || p.contractEnd) +
        row('Մարզ', p.region) +
        row('Քաղաք / համայնք', p.city) +
        row('Հասցե', p.address) +
        row('Զինվորական կոմիսարյատ', p.commissariat) +
        row('Գաղտնիության թույլատվություն', secrecyLab) +
        row('Անձնական վկայական', p.idCard) +
        row('ՀԾՀ', p.hsk) +
        row('Արյան խումբ', p.bloodGroup) +
        row('Ուղեկցվող հիվանդություններ', p.illnesses) +
        row('Մասնագիտություն', (typeof window.kmLooksLikeStaffCode === 'function' && window.kmLooksLikeStaffCode(p.specialty)) ? '' : p.specialty) +
        row('Հոդվածներ (404-Ն)', arts) +
        row('Նշում', p.note) +
        row('Հաստիքի կոդ', p.postCode || p.posCode) +
        row('Կոչումը ըստ հաստիքի', p.rankSlot) +
        row('Կոչում', p.rank) +
        row('Նշանակման հրաման №', p.posOrder) +
        row('Նշանակման ամսաթիվ', p.appointmentDate) +
        '<tr><th>Նշանակումների պատմություն</th><td>' + appTxt + '</td></tr>' +
        '<tr><th>Ծառայողական քննություններ</th><td>' + (function () {
          var exs = kmPersonTrialExams(p.name);
          if (!exs.length) return '—';
          return exs.map(function (ex) {
            return esc(ex.whenDate || ex.createdAt || '') +
              (ex.violation ? ' · ' + esc(ex.violation) : '') +
              (ex.text ? ' — ' + esc(String(ex.text).slice(0, 220)) : '');
          }).join('<br>');
        }()) + '</td></tr>' +
        '<tr><th>Արձակուրդ / բացակայություն</th><td>' + vacTxt + '</td></tr>' +
      '</table>';
  }

  function kmPersonCardFullHtml(title, body) {
    var qr = '';
    try { qr = kmMakeQrDataUrl(title + '|' + new Date().toISOString().slice(0, 10)); } catch (e) {}
    return '<!doctype html><html lang="hy"><head><meta charset="utf-8"><title>' + esc(title) + '</title>' +
      '<style>body{font-family:"Segoe UI",Arial,sans-serif;padding:14mm;color:#111}h1{font-size:18px;margin:0 0 8px}' +
      'table{border-collapse:collapse;width:100%;margin-top:10px}th,td{border:1px solid #333;padding:6px 8px;font-size:12px;text-align:left}' +
      'th{background:#e9eef2}.meta{font-size:12px;color:#444}img.qr{width:88px;height:88px;float:right}' +
      '@media print{button{display:none}}</style></head><body>' +
      (qr ? '<img class="qr" alt="QR" src="' + qr + '">' : '') +
      '<h1>' + esc(title) + '</h1>' + body +
      '<p class="meta">KM · ' + esc(new Date().toLocaleString('hy-AM')) + '</p></body></html>';
  }

  /* ---------- Print helpers ---------- */
  function printHtml(title, body) {
    var html = kmPersonCardFullHtml(title, body);
    if (typeof window.kmPrintNativeFromHtml === 'function') window.kmPrintNativeFromHtml(title, html);
    else {
      var w = window.open('', '_blank');
      if (!w) { toast('Պատուհանը չբացվեց', 'error'); return; }
      w.document.write(html);
      w.document.close();
      setTimeout(function () { try { w.print(); } catch (e) {} }, 400);
    }
  }

  window.kmPrintPersonCard = function (index) {
    var p = (db.people || [])[index];
    if (!p) {
      pickPersonIndex('Տպել անձի քարտ', function (i) { window.kmPrintPersonCard(i); });
      return;
    }
    printHtml('Անձի քարտ — ' + (p.name || ''), kmPersonCardDocHtml(p));
  };

  window.kmExportPersonCardPdf = async function (index) {
    var p = (db.people || [])[index];
    if (!p) {
      pickPersonIndex('PDF անձի քարտ', function (i) { window.kmExportPersonCardPdf(i); });
      return;
    }
    if (!window.kmNative || !window.kmNative.print || typeof window.kmNative.print.pdf !== 'function') {
      toast('PDF հանելը հասանելի է միայն KM desktop-ում', 'error');
      return;
    }
    var title = 'Անձի քարտ — ' + (p.name || '');
    try {
      var r = await window.kmNative.print.pdf({
        title: title,
        html: kmPersonCardFullHtml(title, kmPersonCardDocHtml(p)),
        settings: { pageSize: 'A4', orientation: 'portrait', printBackground: true }
      });
      if (r && r.cancelled) return;
      if (r && r.ok) toast('PDF-ը հանվեց՝ ' + r.path, 'ok');
      else toast('PDF-ը չհանվեց', 'error');
    } catch (e) {
      toast('PDF սխալ՝ ' + (e && e.message ? e.message : e), 'error');
    }
  };

  window.kmTodayDutyPeople = function () {
    var out = [];
    var seen = {};
    if (typeof window.kmTodayDutyRows === 'function') {
      var rows0 = window.kmTodayDutyRows() || [];
      /* KM_PERF_TODAY_DUTY_INDEX_V1: this used .find() over the WHOLE personnel list for every
         duty row — O(dutyRows * totalPeople). Build a name -> person index once instead. */
      var byName = null;
      if (rows0.length) {
        byName = Object.create(null);
        (typeof db !== 'undefined' && db.people || []).forEach(function (x) {
          var xn = String((x && (x.name || x.fullName || x.person)) || '').trim();
          if (xn && !byName[xn]) byName[xn] = x;
        });
      }
      rows0.forEach(function (r) {
        if (!r || !r.name || seen[r.name]) return;
        seen[r.name] = 1;
        var p = byName ? byName[String(r.name).trim()] : null;
        out.push(p || { name: r.name, rank: r.rank, unit: r.unit, phone: r.phone });
      });
      return out;
    }
    var today = new Date();
    var day = today.getDate();
    var m = today.getMonth() + 1;
    var y = today.getFullYear();
    function personKey(p) {
      if (typeof kmSchedulePersonKey === 'function') return kmSchedulePersonKey(p);
      return String((p && (p.name || p.fullName || p.person)) || '').trim();
    }
    function addFrom(rows) {
      (db.people || []).forEach(function (p) {
        var key = personKey(p);
        var v = (rows && rows[key] && rows[key][day]) || (rows && p.name && rows[p.name] && rows[p.name][day]) || '';
        if (String(v).trim() && !seen[key || p.name]) {
          seen[key || p.name] = 1;
          out.push(p);
        }
      });
    }
    var s = (typeof db !== 'undefined' && db.schedule) || {};
    if (+s.month === m && +s.year === y) addFrom(s.rows);
    Object.keys((db && db.dutyTypeSchedules) || {}).forEach(function (k) {
      var sch = db.dutyTypeSchedules[k];
      if (!sch) return;
      if (+sch.month === m && +sch.year === y) addFrom(sch.assignments || sch.rows);
    });
    return out;
  };
  window.kmPrintTodayDuty = function () {
    if (typeof window.kmOpenTodayDutyPage === 'function') {
      window.kmOpenTodayDutyPage();
      return;
    }
    var list = [];
    if (typeof window.kmTodayDutyRows === 'function') {
      list = window.kmTodayDutyRows() || [];
    } else {
      list = (typeof kmTodayDutyPeople === 'function' ? kmTodayDutyPeople() : []).map(function (p) {
        return { name: p.name, rank: rankOf(p), unit: p.unit || '', phone: p.phone || '', graphName: '' };
      });
    }
    var today = new Date();
    var dayN = today.getDate();
    var rows = list.map(function (r, i) {
      var note = '';
      try {
        var comments = (typeof db !== 'undefined' && db && db.cellComments) || {};
        var k = (typeof kmCellCommentKey === 'function')
          ? kmCellCommentKey(r.graphName || '', r.name, dayN)
          : ((r.graphName || '') + '|' + r.name + '|' + dayN);
        note = comments[k] || '';
      } catch (e) {}
      return '<tr><td>' + (i + 1) + '</td><td>' + esc(r.graphName || '') + '</td><td>' + esc(r.rank || '') + '</td><td>' + esc(r.name) + '</td><td>' + esc(r.unit || '') + '</td><td>' + esc(r.phone || '') + '</td><td>' + esc(note) + '</td></tr>';
    }).join('') || '<tr><td colspan="7">Այսօր հերթապահ նշանակված չէ</td></tr>';
    printHtml('Այսօրվա հերթապահներ — ' + ymd(today),
      '<p class="meta">Ամիս՝ ' + (today.getMonth() + 1) + '/' + today.getFullYear() + '</p>' +
      '<table><thead><tr><th>№</th><th>Վերակարգ</th><th>Կոչում</th><th>Անուն</th><th>Ստորաբաժանում</th><th>Հեռախոս</th><th>Նշում</th></tr></thead><tbody>' + rows + '</tbody></table>');
  };

  window.kmOpenTodayDutyPage = function () {
    var list = [];
    if (typeof window.kmTodayDutyRows === 'function') list = window.kmTodayDutyRows() || [];
    else {
      list = (typeof kmTodayDutyPeople === 'function' ? kmTodayDutyPeople() : []).map(function (p) {
        return { name: p.name, rank: rankOf(p), unit: p.unit || '', phone: p.phone || '', graphName: '' };
      });
    }
    var today = new Date();
    var dayN = today.getDate();
    var rows = list.map(function (r, i) {
      var note = '';
      try {
        var comments = (typeof db !== 'undefined' && db && db.cellComments) || {};
        var k = (typeof kmCellCommentKey === 'function')
          ? kmCellCommentKey(r.graphName || '', r.name, dayN)
          : ((r.graphName || '') + '|' + r.name + '|' + dayN);
        note = comments[k] || '';
      } catch (e) {}
      return '<tr><td>' + (i + 1) + '</td><td>' + esc(r.graphName || '') + '</td><td>' + esc(r.rank || '') + '</td><td>' + esc(r.name) + '</td><td>' + esc(r.unit || '') + '</td><td>' + esc(r.phone || '') + '</td><td>' + esc(note) + '</td></tr>';
    }).join('') || '<tr><td colspan="7">Այսօր հերթապահ նշանակված չէ</td></tr>';
    var host = document.getElementById('content');
    if (!host) return;
    host.innerHTML = '<div class="card"><h3 class="kmLawsHubTitle" style="margin-top:0">Այսօրվա հերթապահներ — ' + esc(ymd(today)) + '</h3>' +
      '<p class="kmLawsHubLead">Ամիս՝ ' + (today.getMonth() + 1) + '/' + today.getFullYear() + ' · ընդամենը ' + list.length + ' անձ</p>' +
      '<div class="toolbar" style="margin-bottom:12px">' +
        '<button type="button" onclick="kmReportsBack()">← Վերադարձ</button>' +
        '<button type="button" class="primary" onclick="kmPrintTodayDutyPrint()">Տպել</button>' +
      '</div>' +
      '<div class="gridwrap"><table class="grid"><thead><tr><th>№</th><th>Վերակարգ</th><th>Կոչում</th><th>Անուն</th><th>Ստորաբաժանում</th><th>Հեռախոս</th><th>Նշում</th></tr></thead><tbody>' + rows + '</tbody></table></div></div>';
    page = 'todayDuty';
    window.page = 'todayDuty';
    var pt = document.getElementById('pageTitle');
    if (pt) pt.textContent = 'Այսօրվա հերթապահներ';
  };

  window.kmPrintTodayDutyPrint = function () {
    var list = [];
    if (typeof window.kmTodayDutyRows === 'function') list = window.kmTodayDutyRows() || [];
    else {
      list = (typeof kmTodayDutyPeople === 'function' ? kmTodayDutyPeople() : []).map(function (p) {
        return { name: p.name, rank: rankOf(p), unit: p.unit || '', phone: p.phone || '', graphName: '' };
      });
    }
    var today = new Date();
    var dayN = today.getDate();
    var rows = list.map(function (r, i) {
      var note = '';
      try {
        var comments = (typeof db !== 'undefined' && db && db.cellComments) || {};
        var k = (typeof kmCellCommentKey === 'function')
          ? kmCellCommentKey(r.graphName || '', r.name, dayN)
          : ((r.graphName || '') + '|' + r.name + '|' + dayN);
        note = comments[k] || '';
      } catch (e) {}
      return '<tr><td>' + (i + 1) + '</td><td>' + esc(r.graphName || '') + '</td><td>' + esc(r.rank || '') + '</td><td>' + esc(r.name) + '</td><td>' + esc(r.unit || '') + '</td><td>' + esc(r.phone || '') + '</td><td>' + esc(note) + '</td></tr>';
    }).join('') || '<tr><td colspan="7">Այսօր հերթապահ նշանակված չէ</td></tr>';
    printHtml('Այսօրվա հերթապահներ — ' + ymd(today),
      '<p class="meta">Ամիս՝ ' + (today.getMonth() + 1) + '/' + today.getFullYear() + '</p>' +
      '<table><thead><tr><th>№</th><th>Վերակարգ</th><th>Կոչում</th><th>Անուն</th><th>Ստորաբաժանում</th><th>Հեռախոս</th><th>Նշում</th></tr></thead><tbody>' + rows + '</tbody></table>');
  };

  window.kmPrintMonthlyReport = function () {
    if (typeof window.kmOpenMonthlyReportPage === 'function') {
      window.kmOpenMonthlyReportPage();
      return;
    }
    kmOpenMonthlyReportCore(true);
  };

  function dutyCellOccupied(v) {
    var t = String(v == null ? '' : v).trim();
    if (!t || t === '—' || t === '-' || t === '.') return false;
    return true;
  }

  function kmOpenMonthlyReportCore(doPrint) {
    var s = db.schedule || {};
    var y = +s.year || new Date().getFullYear();
    var m = +s.month || (new Date().getMonth() + 1);
    var days = new Date(y, m, 0).getDate();
    var rowsHtml = (db.people || []).map(function (p) {
      var duty = 0, vac = 0, sick = 0, trip = 0, study = 0;
      for (var d = 1; d <= days; d++) {
        var v = (s.rows && s.rows[p.name] && s.rows[p.name][d]) || '';
        if (dutyCellOccupied(v)) duty++;
        var k = typeof kmPersonAbsence === 'function' ? kmPersonAbsence(p.name, new Date(y, m - 1, d, 12, 0, 0)) : '';
        if (k === 'sick') sick++;
        else if (k === 'trip') trip++;
        else if (k === 'study') study++;
        else if (k) vac++;
      }
      return '<tr><td>' + esc(rankOf(p)) + '</td><td>' + esc(p.name) + '</td><td>' + duty + '</td><td>' + vac + '</td><td>' + sick + '</td><td>' + trip + '</td><td>' + study + '</td></tr>';
    }).join('') || '<tr><td colspan="7">Տվյալ չկա</td></tr>';
    if (doPrint) {
      printHtml('Ամսական հաշվետվություն — ' + m + '/' + y,
        '<table><thead><tr><th>Կոչում</th><th>Անուն</th><th>Հերթապահ</th><th>Արձակուրդ</th><th>Հիվանդ</th><th>Գործուղում</th><th>Ուսում</th></tr></thead><tbody>' + rowsHtml + '</tbody></table>');
      return;
    }
    var host = document.getElementById('content');
    if (!host) return;
    host.innerHTML = '<div class="card"><h3 class="kmLawsHubTitle" style="margin-top:0">Ամսական հաշվետվություն — ' + m + '/' + y + '</h3>' +
      '<p class="kmLawsHubLead">Հերթապահության և բացակայությունների ամփոփում ըստ ընթացիկ գրաֆիկի ամսվա։</p>' +
      '<div class="toolbar" style="margin-bottom:12px">' +
        '<button type="button" onclick="kmReportsBack()">← Վերադարձ</button>' +
        '<button type="button" class="primary" onclick="kmPrintMonthlyReportPrint()">Տպել</button>' +
      '</div>' +
      '<div class="gridwrap"><table class="grid"><thead><tr><th>Կոչում</th><th>Անուն</th><th>Հերթապահ</th><th>Արձակուրդ</th><th>Հիվանդ</th><th>Գործուղում</th><th>Ուսում</th></tr></thead><tbody>' + rowsHtml + '</tbody></table></div></div>';
    page = 'monthlyReport';
    window.page = 'monthlyReport';
    var pt = document.getElementById('pageTitle');
    if (pt) pt.textContent = 'Ամսական հաշվետվություն';
  }

  window.kmOpenMonthlyReportPage = function () { kmOpenMonthlyReportCore(false); };
  window.kmPrintMonthlyReportPrint = function () { kmOpenMonthlyReportCore(true); };

  /* ---------- Duty swap ---------- */
  window.kmOpenDutySwap = function () {
    if (!canEdit()) { toast('Դիտորդի իրավունք', 'error'); return; }
    var s = db.schedule || {};
    var people = typeof kmMainSelectedPeople === 'function' ? kmMainSelectedPeople() : [];
    if (!people.length) {
      people = (db.people || []).filter(function (p) {
        return !(typeof kmPersonNotPlannable === 'function' ? kmPersonNotPlannable(p) : (typeof kmPersonIsBlocked === 'function' && kmPersonIsBlocked(p)));
      });
    }
    if (people.length < 2) { toast('Պետք է առնվազն 2 անձ', 'warn'); return; }
    var days = new Date(+s.year, +s.month, 0).getDate();
    var opts = people.map(function (p) { return '<option value="' + esc(p.name) + '">' + esc(p.name) + '</option>'; }).join('');
    kmExtModal('Հերթապահության փոխանակում',
      '<p class="muted">Երկու անձը փոխում են նշված օրվա հերթապահությունը։</p>' +
      '<label>Անձ A <select id="kmSwA">' + opts + '</select></label><br><br>' +
      '<label>Անձ B <select id="kmSwB">' + opts + '</select></label><br><br>' +
      '<label>Օր <input id="kmSwDay" type="number" min="1" max="' + days + '" value="1" style="width:80px"></label>' +
      '<div class="toolbar" style="margin-top:14px"><button type="button" class="primary" id="kmSwGo">Հաստատել փոխանակումը</button></div>',
      function (box) {
        box.querySelector('#kmSwGo').onclick = async function () {
          var a = box.querySelector('#kmSwA').value, b = box.querySelector('#kmSwB').value;
          var day = Number(box.querySelector('#kmSwDay').value);
          if (a === b) { toast('Ընտրեք տարբեր անձանց', 'warn'); return; }
          if (!confirm('Փոխե՞լ ' + a + ' և ' + b + ' հերթապահությունը ' + day + ' օրը։')) return;
          if (typeof archiveCurrentSchedule === 'function') archiveCurrentSchedule('Մինչև փոխանակում');
          s.rows = s.rows || {};
          s.rows[a] = s.rows[a] || {};
          s.rows[b] = s.rows[b] || {};
          var va = String(s.rows[a][day] || '').trim();
          var vb = String(s.rows[b][day] || '').trim();
          if (va) s.rows[b][day] = va; else delete s.rows[b][day];
          if (vb) s.rows[a][day] = vb; else delete s.rows[a][day];
          db.substitutions = db.substitutions || [];
          db.substitutions.push({ year: +s.year, month: +s.month, day: day, from: a, to: b, at: new Date().toISOString() });
          if (typeof save === 'function') await save();
          if (typeof schedule === 'function') schedule();
          toast('Փոխանակումը կատարվեց');
          var m = document.getElementById('kmExtModal');
          if (m) m.remove();
        };
      });
  };

  window.kmOpenSubstitutionLog = function () {
    ensureExtDb();
    var rows = (db.substitutions || []).slice().reverse().map(function (s) {
      return '<tr><td>' + esc(s.at || '') + '</td><td>' + esc((s.day || '') + '/' + (s.month || '') + '/' + (s.year || '')) + '</td><td>' + esc(s.from) + ' ↔ ' + esc(s.to) + '</td></tr>';
    }).join('') || '<tr><td colspan="3">Դատարկ</td></tr>';
    var host = document.getElementById('content');
    if (!host) return;
    host.innerHTML = '<div class="card"><h3 class="kmLawsHubTitle" style="margin-top:0">Փոխանակումների մատյան</h3>' +
      '<p class="kmLawsHubLead">Հերթապահության փոխանակումների պատմություն։</p>' +
      '<div class="toolbar" style="margin-bottom:12px">' +
        '<button type="button" onclick="kmReportsBack()">← Վերադարձ</button>' +
        (canEdit() ? '<button type="button" onclick="kmOpenDutySwap()">＋ Նոր փոխանակում</button>' : '') +
      '</div>' +
      '<div class="gridwrap"><table class="grid"><thead><tr><th>Ժամանակ</th><th>Օր</th><th>Անձինք</th></tr></thead><tbody>' + rows + '</tbody></table></div></div>';
    page = 'substitutions';
    window.page = 'substitutions';
    var pt = document.getElementById('pageTitle');
    if (pt) pt.textContent = 'Փոխանակումներ';
  };

  /* ---------- Holidays page ---------- */
  window.kmOpenHolidays = function (yearOpt) {
    if (yearOpt) {
      try { window._kmNotesHolidayYear = +yearOpt; } catch (eY) {}
    }
    if (typeof window.kmOpenPage === 'function') window.kmOpenPage('notes');
    else if (typeof window.kmLibSetSection === 'function') window.kmLibSetSection('notes');
  };

  /* ---------- Rank rules UI ---------- */
  window.kmOpenRankRules = function () {
    ensureExtDb();
    var ranks = (typeof KM_FINAL_RANKS !== 'undefined' ? KM_FINAL_RANKS : []).slice();
    var names = ['Հիմնական'].concat(db.dutyTypes || []);
    var editable = canEdit();
    var html = names.map(function (n) {
      var allowed = db.dutyRankRules[n] || [];
      var checks = ranks.map(function (r) {
        return '<label style="display:inline-block;margin:4px 10px 4px 0"><input type="checkbox" data-duty="' + esc(n) + '" value="' + esc(r) + '"' + (allowed.indexOf(r) >= 0 ? ' checked' : '') + (editable ? '' : ' disabled') + '> ' + esc(r) + '</label>';
      }).join('');
      return '<div class="card" style="margin:8px 0"><h4 style="margin:0 0 8px">' + esc(n) + '</h4><p class="muted">Դատարկ = բոլոր կոչումները թույլատրված են</p>' + checks + '</div>';
    }).join('');
    var host = document.getElementById('content');
    if (!host) return;
    host.innerHTML = '<div class="card"><h3 class="kmLawsHubTitle" style="margin-top:0">Կոչումով թույլատրելի վերակարգեր</h3>' +
      '<div class="toolbar">' +
        '<button type="button" onclick="kmReportsBack()">← Վերադարձ</button>' +
        (editable ? '<button type="button" class="primary" onclick="kmSaveRankRules()">Պահպանել</button>' : '') +
      '</div></div>' + html;
    page = 'rankRules';
    window.page = 'rankRules';
    var pt = document.getElementById('pageTitle');
    if (pt) pt.textContent = 'Կոչումների կանոններ';
  };
  window.kmSaveRankRules = async function () {
    ensureExtDb();
    var map = {};
    document.querySelectorAll('[data-duty]').forEach(function (el) {
      var n = el.getAttribute('data-duty');
      map[n] = map[n] || [];
      if (el.checked) map[n].push(el.value);
    });
    db.dutyRankRules = map;
    if (typeof save === 'function') await save(true);
    toast('Կոչումների կանոնները պահպանվեցին');
  };

  /* ---------- USB / folder sync ---------- */
  window.kmSyncExport = async function () {
    if (!canEdit()) { toast('Դիտորդի իրավունք', 'error'); return; }
    if (!window.kmNative || !window.kmNative.sync) { toast('Միայն desktop KM', 'error'); return; }
    if (typeof save === 'function') await save(true);
    var json = JSON.stringify(db);
    var r = await window.kmNative.sync.export(json);
    if (r && r.ok) toast('Արտահանվեց՝ ' + r.path);
    else if (!(r && r.cancelled)) toast('Չհաջողվեց արտահանել', 'error');
  };
  window.kmSyncImport = async function () {
    if (!canEdit()) { toast('Դիտորդի իրավունք', 'error'); return; }
    if (!window.kmNative || !window.kmNative.sync) { toast('Միայն desktop KM', 'error'); return; }
    if (!confirm('Ներմուծե՞լ KM բազան USB/պանակից։ Ներկա տվյալները կփոխարինվեն։')) return;
    var r = await window.kmNative.sync.import();
    if (!r || !r.ok) { if (!(r && r.cancelled)) toast('Ներմուծումը չհաջողվեց', 'error'); return; }
    try {
      var data = JSON.parse(r.json);
      if (!data || typeof data !== 'object') throw new Error('Սխալ ֆայլ');
      if (typeof window.kmApplyDbSnapshot === 'function') {
        if (!window.kmApplyDbSnapshot(data, { merge: false, role: window.kmUserRole || 'admin' })) return;
      } else {
        Object.keys(db).forEach(function (k) { delete db[k]; });
        Object.assign(db, data);
      }
      if (typeof normalize === 'function') normalize();
      if (typeof save === 'function') await save(true);
      toast('Ներմուծվեց։ Վերագործարկեք KM-ը անհրաժեշտության դեպքում');
      if (typeof render === 'function') render();
    } catch (e) { toast(e.message || String(e), 'error'); }
  };

  /* ---------- Photo / ID card ---------- */
  function compressPhoto(file, cb) {
    var img = new Image();
    img.onload = function () {
      var c = document.createElement('canvas');
      var w = 240, h = 240;
      c.width = w; c.height = h;
      var ctx = c.getContext('2d');
      var scale = Math.max(w / img.width, h / img.height);
      var nw = img.width * scale, nh = img.height * scale;
      ctx.fillStyle = '#ddd';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, (w - nw) / 2, (h - nh) / 2, nw, nh);
      cb(c.toDataURL('image/jpeg', 0.72));
    };
    img.onerror = function () { cb(''); };
    var rd = new FileReader();
    rd.onload = function () { img.src = rd.result; };
    rd.readAsDataURL(file);
  }
  window.kmPersonPhotoSrc = function (p) {
    var src = String((p && p.photo) || '');
    if (!src) return '';
    if (/^kmphoto:/i.test(src)) {
      var id = src.replace(/^kmphoto:\/\//i, '').replace(/^kmphoto:/i, '').split(/[/?#]/)[0];
      return 'kmphoto://' + id;
    }
    if (/^data:image\//i.test(src)) return src;
    return '';
  };
  window.kmMigratePeoplePhotos = async function () {
    if (!window.kmNative || !window.kmNative.photo || !window.kmNative.photo.save) return;
    if (typeof db === 'undefined' || !db || !Array.isArray(db.people)) return;
    for (var i = 0; i < db.people.length; i++) {
      var p = db.people[i];
      if (!p || !p.photo || !/^data:image\//i.test(String(p.photo))) continue;
      var id = String(p.photoId || '').replace(/[^a-zA-Z0-9_-]/g, '') || ('p' + Date.now().toString(36) + i);
      try {
        var r = await window.kmNative.photo.save({ id: id, dataUrl: p.photo });
        if (r && r.ok) {
          p.photoId = r.id || id;
          p.photo = 'kmphoto:' + (r.id || id);
        }
      } catch (e) {}
    }
  };
  window.kmSetPersonPhoto = function (index, reopenCard) {
    if (!canEdit()) return;
    var p = db.people[index];
    if (!p) return;
    var inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/*';
    inp.onchange = function () {
      var f = inp.files && inp.files[0];
      if (!f) return;
      compressPhoto(f, async function (data) {
        if (!data) return;
        var id = String(p.photoId || '').replace(/[^a-zA-Z0-9_-]/g, '') || ('p' + Date.now().toString(36) + index);
        if (window.kmNative && window.kmNative.photo && window.kmNative.photo.save) {
          try {
            var r = await window.kmNative.photo.save({ id: id, dataUrl: data });
            if (r && r.ok) {
              p.photoId = r.id || id;
              p.photo = 'kmphoto:' + (r.id || id);
            } else p.photo = data;
          } catch (e) { p.photo = data; }
        } else p.photo = data;
        if (typeof window.kmHishoxutyunLog === 'function') {
          window.kmHishoxutyunLog({
            section: 'people',
            sectionLabel: 'Անձնակազմ և քարտ',
            subsection: 'card',
            subsectionLabel: 'Քարտ',
            action: 'add',
            detail: 'Քարտ՝ ' + (p.name || '') + ' · ավելացրել է լուսանկար'
          });
        }
        if (typeof save === 'function') await save(true);
        toast('Լուսանկարը պահպանվեց');
        if (reopenCard) {
          var modal = document.getElementById('kmExtModal');
          var imgEl = modal && modal.querySelector('#kmPersonCardImg');
          var src = typeof kmPersonPhotoSrc === 'function' ? kmPersonPhotoSrc(p) : (p.photo || '');
          if (imgEl && src) {
            if (imgEl.tagName === 'IMG') imgEl.src = src;
            else {
              imgEl.outerHTML = '<img id="kmPersonCardImg" src="' + src + '" alt="" style="width:120px;height:120px;object-fit:cover;border-radius:8px;border:1px solid #c5d0da">';
            }
            var phWrap = modal.querySelector('.kmPcPhoto');
            var btns = phWrap && phWrap.querySelector('.kmPcPhotoBtns');
            if (btns && !btns.querySelector('#kmPersonCardPhotoClear')) {
              var clr = document.createElement('button');
              clr.type = 'button';
              clr.id = 'kmPersonCardPhotoClear';
              clr.textContent = 'Հանել';
              clr.onclick = async function () {
                if (!canEdit()) return;
                if (!confirm('Հանե՞լ լուսանկարը։')) return;
                p.photo = '';
                p.photoId = '';
                if (typeof window.kmHishoxutyunLog === 'function') {
                  window.kmHishoxutyunLog({
                    section: 'people',
                    sectionLabel: 'Անձնակազմ և քարտ',
                    subsection: 'card',
                    subsectionLabel: 'Քարտ',
                    action: 'remove',
                    detail: 'Քարտ՝ ' + (p.name || '') + ' · հանել է լուսանկարը'
                  });
                }
                if (typeof save === 'function') await save(true);
                toast('Լուսանկարը հանվեց', 'ok');
                var m2 = document.getElementById('kmExtModal');
                if (m2) m2.remove();
                if (typeof window.kmOpenPersonCard === 'function') window.kmOpenPersonCard(index);
              };
              btns.appendChild(clr);
            }
          } else if (typeof window.kmOpenPersonCard === 'function') {
            var m = document.getElementById('kmExtModal');
            if (m) m.remove();
            window.kmOpenPersonCard(index);
          }
        } else if (typeof people === 'function') people();
      });
    };
    inp.click();
  };
  window.kmPrintIdCard = function (index) {
    var list = index == null ? (db.people || []) : [db.people[index]].filter(Boolean);
    if (!list.length) { toast('Անձ չկա', 'warn'); return; }
    var cards = list.map(function (p) {
      var photoSrc = kmPersonPhotoSrc(p);
      var photo = photoSrc
        ? '<img src="' + photoSrc + '" style="width:90px;height:90px;object-fit:cover;border:1px solid #333">'
        : '<div style="width:90px;height:90px;border:1px solid #333;background:#eee"></div>';
      var qr = '';
      try { qr = kmMakeQrDataUrl((p.name || '') + '|' + (p.phone || '') + '|' + rankOf(p)); } catch (e) {}
      return '<div style="border:1px solid #000;padding:10px;width:320px;display:inline-block;margin:8px;vertical-align:top">' +
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><img src="assets/km_logo_square.jpg?v=006.5.113" alt="KM" style="width:28px;height:28px;object-fit:cover;border-radius:50%"><b>KM</b></div>' +
        '<div style="display:flex;gap:10px">' + photo + '<div><b>' + esc(p.name) + '</b><br>' + esc(rankOf(p)) +
        '<br>' + esc(p.unit || '') + '<br>' + esc(p.phone || '') + '</div>' +
        (qr ? '<img src="' + qr + '" style="width:72px;height:72px">' : '') + '</div></div>';
    }).join('');
    printHtml('Անձնակազմի ID քարտեր', cards);
  };

  /* ---------- Duty graph templates ---------- */
  window.kmSaveDutyGraphTemplate = async function (index) {
    if (!canEdit()) return;
    ensureExtDb();
    var d = typeof ensureAll === 'function' ? ensureAll() : db;
    var sch = typeof getSchedule === 'function' ? getSchedule(index) : null;
    if (!sch) { toast('Գրաֆիկ չկա', 'warn'); return; }
    var name = prompt('Ձևանմուշի անուն', (d.dutyTypes && d.dutyTypes[index]) || 'Վերակարգ');
    if (!name) return;
    db.dutyGraphTemplates.push({
      id: Date.now().toString(36),
      name: String(name).trim(),
      dutyType: (d.dutyTypes && d.dutyTypes[index]) || '',
      assignments: JSON.parse(JSON.stringify(sch.assignments || {})),
      selectedPeople: JSON.parse(JSON.stringify(sch.selectedPeople || [])),
      savedAt: new Date().toISOString()
    });
    if (typeof save === 'function') await save(true);
    toast('Ձևանմուշը պահպանվեց');
  };
  window.kmApplyDutyGraphTemplate = async function (index) {
    if (!canEdit()) return;
    ensureExtDb();
    if (!db.dutyGraphTemplates.length) { toast('Ձևանմուշներ չկան', 'warn'); return; }
    var opts = db.dutyGraphTemplates.map(function (t, i) { return (i + 1) + '. ' + t.name; }).join('\n');
    var v = Number(prompt('Համար:\n' + opts, '1')) - 1;
    var t = db.dutyGraphTemplates[v];
    if (!t) return;
    if (!confirm('Կիրառե՞լ «' + t.name + '» ձևանմուշը։')) return;
    var sch = typeof getSchedule === 'function' ? getSchedule(index) : null;
    if (!sch) return;
    sch.assignments = JSON.parse(JSON.stringify(t.assignments || {}));
    if (t.selectedPeople && t.selectedPeople.length) sch.selectedPeople = JSON.parse(JSON.stringify(t.selectedPeople));
    if (typeof save === 'function') await save(true);
    if (typeof renderDutyTypePlanning === 'function') renderDutyTypePlanning(index);
    toast('Ձևանմուշը կիրառվեց');
  };

  /* ---------- Modal ---------- */
  function kmExtModal(title, inner, after) {
    var old = document.getElementById('kmExtModal');
    if (old) old.remove();
    var wrap = document.createElement('div');
    wrap.id = 'kmExtModal';
    wrap.style.cssText = 'position:fixed;inset:0;background:transparent;display:flex;align-items:center;justify-content:center;z-index:99999;padding:20px;-webkit-transform:translate3d(0,0,0);transform:translate3d(0,0,0)';
    wrap.onclick = function (e) { if (e.target === wrap) wrap.remove(); };
    wrap.innerHTML = '<div class="kmExtModalCard" style="background:#fff;width:min(820px,96vw);max-height:90vh;overflow:auto;border-radius:12px;padding:18px;color:#0b1a33;-webkit-transform:translate3d(0,0,0);transform:translate3d(0,0,0)">' +
      '<h3 style="margin-top:0;color:#0b1a33">' + esc(title) + '</h3>' + inner +
      '<div style="text-align:right;margin-top:14px">' + (typeof window.kmModalBackHtml === 'function' ? window.kmModalBackHtml("document.getElementById('kmExtModal')?.remove()") : '<button type="button" onclick="document.getElementById(\'kmExtModal\').remove()">← Վերադարձ</button>') + '</div></div>';
    document.body.appendChild(wrap);
    if (typeof window.kmForceUiPaint === 'function') window.kmForceUiPaint(wrap);
    if (typeof window.kmApplyLanguage === 'function') {
      try { window.kmApplyLanguage(); } catch (e) {}
    }
    if (after) after(wrap);
    try {
      wrap.querySelectorAll('[data-km-allow-edit="1"]').forEach(function (el) {
        el.disabled = false;
        el.readOnly = false;
        el.removeAttribute('readonly');
        el.removeAttribute('disabled');
      });
    } catch (eUnlock) {}
  }

  /* ---------- Real QR (byte mode, ECC L, versions 1-10) ---------- */
  window.kmMakeQrDataUrl = function (text) {
    var modules = kmQrModules(String(text || 'KM'));
    var n = modules.length, scale = 4, pad = 4;
    var c = document.createElement('canvas');
    c.width = c.height = (n + pad * 2) * scale;
    var g = c.getContext('2d');
    g.fillStyle = '#fff';
    g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#000';
    for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) {
      if (modules[y][x]) g.fillRect((x + pad) * scale, (y + pad) * scale, scale, scale);
    }
    return c.toDataURL('image/png');
  };

  function kmQrModules(str) {
    var bytes = [];
    unescape(encodeURIComponent(str)).split('').forEach(function (ch) { bytes.push(ch.charCodeAt(0) & 255); });
    var VERS = [
      { v: 1, size: 21, cap: 17, ec: 7, groups: [[1, 19]] },
      { v: 2, size: 25, cap: 32, ec: 10, groups: [[1, 34]] },
      { v: 3, size: 29, cap: 53, ec: 15, groups: [[1, 55]] },
      { v: 4, size: 33, cap: 78, ec: 20, groups: [[1, 80]] },
      { v: 5, size: 37, cap: 106, ec: 26, groups: [[1, 108]] },
      { v: 6, size: 41, cap: 134, ec: 18, groups: [[2, 68]] },
      { v: 7, size: 45, cap: 154, ec: 20, groups: [[2, 78]] },
      { v: 8, size: 49, cap: 192, ec: 24, groups: [[2, 97]] },
      { v: 9, size: 53, cap: 230, ec: 30, groups: [[2, 116]] },
      { v: 10, size: 57, cap: 271, ec: 18, groups: [[2, 68], [2, 69]] }
    ];
    var spec = VERS[0];
    for (var i = 0; i < VERS.length; i++) if (bytes.length + 2 <= VERS[i].cap) { spec = VERS[i]; break; }
    if (bytes.length + 2 > spec.cap) bytes = bytes.slice(0, spec.cap - 2);
    var bits = [];
    function put(v, n) { for (var i = n - 1; i >= 0; i--) bits.push((v >> i) & 1); }
    put(4, 4);
    put(bytes.length, spec.v < 10 ? 8 : 16);
    bytes.forEach(function (b) { put(b, 8); });
    put(0, 4);
    while (bits.length % 8) bits.push(0);
    var data = [];
    for (var i = 0; i < bits.length; i += 8) {
      var b = 0;
      for (var j = 0; j < 8; j++) b = (b << 1) | (bits[i + j] || 0);
      data.push(b);
    }
    var totalData = 0;
    spec.groups.forEach(function (g) { totalData += g[0] * g[1]; });
    var pad = [0xEC, 0x11], pi = 0;
    while (data.length < totalData) data.push(pad[(pi++) % 2]);
    var exp = [], log = [];
    var x = 1;
    for (var i = 0; i < 256; i++) { exp[i] = x; log[x] = i; x <<= 1; if (x > 255) x ^= 0x11d; }
    log[0] = 0;
    function mul(a, b) { return a && b ? exp[(log[a] + log[b]) % 255] : 0; }
    function rsPoly(n) {
      var p = [1];
      for (var i = 0; i < n; i++) {
        var np = new Array(p.length + 1).fill(0);
        for (var j = 0; j < p.length; j++) {
          np[j] ^= p[j];
          np[j + 1] ^= mul(p[j], exp[i]);
        }
        p = np;
      }
      return p;
    }
    function rsEncode(block, nsym) {
      var gen = rsPoly(nsym), out = block.slice();
      for (var i = 0; i < nsym; i++) out.push(0);
      for (var i = 0; i < block.length; i++) {
        var coef = out[i];
        if (!coef) continue;
        for (var j = 0; j < gen.length; j++) out[i + j] ^= mul(gen[j], coef);
      }
      return out.slice(block.length);
    }
    var blocks = [], pos = 0;
    spec.groups.forEach(function (g) {
      for (var i = 0; i < g[0]; i++) {
        var blk = data.slice(pos, pos + g[1]);
        pos += g[1];
        blocks.push({ d: blk, e: rsEncode(blk, spec.ec) });
      }
    });
    var interleaved = [];
    var maxD = Math.max.apply(null, blocks.map(function (b) { return b.d.length; }));
    var maxE = spec.ec;
    for (var i = 0; i < maxD; i++) blocks.forEach(function (b) { if (i < b.d.length) interleaved.push(b.d[i]); });
    for (var i = 0; i < maxE; i++) blocks.forEach(function (b) { interleaved.push(b.e[i]); });
    var size = spec.size;
    var grid = [];
    var reserved = [];
    for (var y = 0; y < size; y++) { grid[y] = []; reserved[y] = []; for (var x = 0; x < size; x++) { grid[y][x] = 0; reserved[y][x] = 0; } }
    function finder(ox, oy) {
      for (var y = -1; y <= 7; y++) for (var x = -1; x <= 7; x++) {
        var xx = ox + x, yy = oy + y;
        if (xx < 0 || yy < 0 || xx >= size || yy >= size) continue;
        var on = (x >= 0 && x <= 6 && y >= 0 && y <= 6) && (x === 0 || x === 6 || y === 0 || y === 6 || (x >= 2 && x <= 4 && y >= 2 && y <= 4));
        grid[yy][xx] = on ? 1 : 0;
        reserved[yy][xx] = 1;
      }
    }
    finder(0, 0); finder(size - 7, 0); finder(0, size - 7);
    for (var i = 8; i < size - 8; i++) {
      grid[6][i] = i % 2 === 0 ? 1 : 0; reserved[6][i] = 1;
      grid[i][6] = i % 2 === 0 ? 1 : 0; reserved[i][6] = 1;
    }
    function align(cx, cy) {
      for (var y = -2; y <= 2; y++) for (var x = -2; x <= 2; x++) {
        var xx = cx + x, yy = cy + y;
        if (xx < 0 || yy < 0 || xx >= size || yy >= size) continue;
        grid[yy][xx] = (Math.max(Math.abs(x), Math.abs(y)) !== 1) ? 1 : 0;
        if (Math.abs(x) === 1 && Math.abs(y) === 1) grid[yy][xx] = 0;
        if (x === 0 && y === 0) grid[yy][xx] = 1;
        reserved[yy][xx] = 1;
      }
    }
    var ALIGN = { 1: [], 2: [18], 3: [22], 4: [26], 5: [30], 6: [34], 7: [22, 38], 8: [24, 42], 9: [26, 46], 10: [28, 50] };
    (ALIGN[spec.v] || []).forEach(function (a) {
      align(a, a);
      if (spec.v >= 7) { align(6, a); align(a, 6); }
    });
    for (var i = 0; i < 8; i++) {
      reserved[8][i] = 1; reserved[i][8] = 1;
      reserved[8][size - 1 - i] = 1; reserved[size - 1 - i][8] = 1;
    }
    reserved[8][8] = 1;
    grid[size - 8][8] = 1; reserved[size - 8][8] = 1;
    var bitStr = [];
    interleaved.forEach(function (b) { for (var i = 7; i >= 0; i--) bitStr.push((b >> i) & 1); });
    var dir = -1, col = size - 1, bi = 0;
    while (col > 0) {
      if (col === 6) col--;
      for (var i = 0; i < size; i++) {
        var y = dir < 0 ? size - 1 - i : i;
        for (var dx = 0; dx < 2; dx++) {
          var x = col - dx;
          if (reserved[y][x]) continue;
          grid[y][x] = bitStr[bi++] || 0;
        }
      }
      col -= 2; dir = -dir;
    }
    function maskFn(m, x, y) {
      if (m === 0) return (x + y) % 2 === 0;
      if (m === 1) return y % 2 === 0;
      if (m === 2) return x % 3 === 0;
      if (m === 3) return (x + y) % 3 === 0;
      if (m === 4) return (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0;
      return ((x * y) % 2 + (x * y) % 3) % 2 === 0;
    }
    var best = null, bestScore = 1e9;
    for (var m = 0; m < 8; m++) {
      var g = grid.map(function (row, y) {
        return row.map(function (v, x) { return reserved[y][x] ? v : (v ^ (maskFn(m, x, y) ? 1 : 0)); });
      });
      var score = 0, dark = 0;
      for (var y = 0; y < size; y++) for (var x = 0; x < size; x++) {
        dark += g[y][x];
        if (x < size - 4 && g[y][x] && g[y][x + 1] && g[y][x + 2] && g[y][x + 3] && g[y][x + 4]) score += 40;
        if (y < size - 4 && g[y][x] && g[y + 1][x] && g[y + 2][x] && g[y + 3][x] && g[y + 4][x]) score += 40;
      }
      score += Math.abs((dark * 100) / (size * size) - 50) / 5 * 10;
      if (score < bestScore) { bestScore = score; best = g; }
    }
    return best || grid;
  }

  /* ---------- UI patches ---------- */
  function addBtns(sel, html) {
    var tb = document.querySelector(sel);
    if (!tb || tb.querySelector('[data-km-ext]')) return;
    var span = document.createElement('span');
    span.setAttribute('data-km-ext', '1');
    span.style.cssText = 'display:contents';
    if (typeof window.kmUiLawCard === 'function' && (tb.classList.contains('kmLawsGrid') || tb.dataset.kmCards === '1')) {
      var tmp = document.createElement('div');
      tmp.innerHTML = html;
      span.innerHTML = [].slice.call(tmp.querySelectorAll('button')).map(function (b) {
        return window.kmUiLawCard((b.textContent || '').trim(), b.getAttribute('onclick') || '', '▸', {
          title: b.getAttribute('title') || ''
        });
      }).join('');
    } else {
      span.innerHTML = html;
    }
    tb.appendChild(span);
  }

  function patch(name, extra) {
    var orig = window[name];
    if (typeof orig !== 'function' || orig.__kmExt) return;
    window[name] = function () {
      var r = orig.apply(this, arguments);
      try { extra.apply(this, arguments); } catch (e) { console.error(e); }
      return r;
    };
    window[name].__kmExt = true;
  }

  patch('people', function () {
    addBtns('#content .card .toolbar',
      '<button type="button" data-km-ext="1" onclick="kmOpenPersonCard()">Անձի քարտ</button>' +
      '<button type="button" data-km-ext="1" onclick="kmShowDutyHistory()">Պատմություն</button>' +
      '<button type="button" data-km-ext="1" onclick="kmPrintIdCard()">ID քարտեր</button>' +
      '<button type="button" data-km-ext="1" onclick="kmPickPhoto()">Լուսանկար</button>');
    document.querySelectorAll('.peopleGrid tbody tr').forEach(function (tr, i) {
      if (tr.querySelector('[data-km-card]')) return;
      var td = tr.querySelector('.kmPersonIdentity') || tr.cells[0];
      if (!td) return;
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('data-km-card', '1');
      btn.textContent = 'Քարտ';
      btn.style.cssText = 'margin-left:6px;font-size:11px;padding:2px 8px';
      btn.onclick = function (e) {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        window.kmOpenPersonCard(i);
      };
      td.appendChild(btn);
    });
  });
  window.kmPickPhoto = function () {
    if (!canEdit()) { toast('Դիտորդի իրավունք', 'error'); return; }
    pickPersonIndex('Լուսանկար', function (i) { kmSetPersonPhoto(i); });
  };

  patch('schedule', function () {
    addBtns('#content .card .toolbar',
      '<button type="button" data-km-ext="1" onclick="kmPrintTodayDuty()">Այսօր տպել</button>' +
      '<button type="button" data-km-ext="1" onclick="kmPrintMonthlyReport()">Ամսական հաշվետվություն</button>' +
      '<button type="button" data-km-ext="1" onclick="kmOpenDutySwap()">Փոխանակում</button>' +
      '<button type="button" data-km-ext="1" onclick="kmOpenSubstitutionLog()">Փոխանակումների մատյան</button>' +
      '<button type="button" data-km-ext="1" onclick="kmSaveScheduleTemplate()">Ձևանմուշ պահել</button>' +
      '<button type="button" data-km-ext="1" onclick="kmApplyScheduleTemplate()">Ձևանմուշ կիրառել</button>');
  });

  patch('openVacations', function () {
    var table = document.querySelector('#vacationModal table thead tr');
    if (table && !table.querySelector('[data-km-kind]')) {
      var th = document.createElement('th');
      th.setAttribute('data-km-kind', '1');
      th.style.width = '160px';
      th.textContent = 'Տեսակ';
      table.appendChild(th);
    }
    var people = db.people || [];
    var vacs = db.vacations || [];
    document.querySelectorAll('#vacationModal tbody tr').forEach(function (tr, i) {
      if (tr.querySelector('[data-km-kind]')) return;
      var p = people[i];
      if (!p) return;
      var cur = vacs.find(function (v) { return v.person === p.name; });
      var sel = document.createElement('td');
      sel.innerHTML = '<select data-km-kind="1" id="vacKind_' + i + '" ' + (cur ? '' : 'disabled') + ' onchange="saveVacationPerson(' + i + ')">' +
        ABSENCE_KINDS.map(function (k) {
          return '<option value="' + k.id + '"' + ((cur && (cur.kind || 'vacation') === k.id) ? ' selected' : '') + '>' + k.label + '</option>';
        }).join('') + '</select>';
      tr.appendChild(sel);
    });
    var p = document.querySelector('#vacationModal p');
    if (p) p.textContent = 'Արձակուրդ, հիվանդություն, գործուղում կամ ուսում։ Այդ օրերին անձը չի պլանավորվում։';
  });

  var origSaveVac = window.saveVacationPerson;
  if (typeof origSaveVac === 'function' && !origSaveVac.__kmExt) {
    window.saveVacationPerson = async function (i) {
      await origSaveVac(i);
      var p = (db.people || [])[i];
      if (!p) return;
      var kindEl = document.getElementById('vacKind_' + i);
      var kind = kindEl ? kindEl.value : 'vacation';
      (db.vacations || []).forEach(function (v) {
        if (v && v.person === p.name) v.kind = kind;
      });
      if (kindEl) kindEl.disabled = false;
      if (typeof save === 'function') await save(true);
    };
    window.saveVacationPerson.__kmExt = true;
  }

  var origToggle = window.toggleVacationPerson;
  if (typeof origToggle === 'function' && !origToggle.__kmExt) {
    window.toggleVacationPerson = async function (i) {
      await origToggle(i);
      var kindEl = document.getElementById('vacKind_' + i);
      var check = document.getElementById('vacActive_' + i);
      if (kindEl) kindEl.disabled = !(check && check.checked);
    };
    window.toggleVacationPerson.__kmExt = true;
  }

  patch('renderDutyTypePlanning', function (index) {
    addBtns('#dutyTypePlanningBody .toolbar',
      '<button type="button" data-km-ext="1" onclick="kmSaveDutyGraphTemplate(' + index + ')">Ձևանմուշ պահել</button>' +
      '<button type="button" data-km-ext="1" onclick="kmApplyDutyGraphTemplate(' + index + ')">Ձևանմուշ կիրառել</button>' +
      '<button type="button" data-km-ext="1" onclick="kmOpenRankRules()">Կոչումներ</button>');
  });

  patch('analytics', function () {
    var first = document.querySelector('#content .card');
    if (first && !first.querySelector('[data-km-an]')) {
      var bar = document.createElement('div');
      bar.className = 'toolbar';
      bar.setAttribute('data-km-an', '1');
      bar.innerHTML = '<button type="button" onclick="kmPrintMonthlyReport()">PDF հաշվետվություն</button>' +
        '<button type="button" onclick="kmMonthCompare()">Համեմատություն</button>' +
        '<button type="button" onclick="kmPrintTodayDuty()">Այսօր</button>';
      first.appendChild(bar);
    }
  });

  ensureExtDb();
  try {
    var tools = {
      people: typeof window.people,
      schedule: typeof window.schedule,
      notesPage: typeof window.notesPage,
      management: typeof window.management,
      libraryPage: typeof window.libraryPage,
      kmNetPage: typeof window.kmNetPage,
      aboutPage: typeof window.aboutPage,
      openDutyTypesSection: typeof window.openDutyTypesSection,
      openVacations: typeof window.openVacations,
      openWorkStatus: typeof window.openWorkStatus,
      kmSpreadsheetsPage: typeof window.kmSpreadsheetsPage,
      analytics: typeof window.analytics,
      kmOpenSettings: typeof window.kmOpenSettings,
      kmMonthCompare: typeof window.kmMonthCompare,
      kmWorkloadReport: typeof window.kmWorkloadReport,
      kmOpenHolidays: typeof window.kmOpenHolidays,
      kmOpenRankRules: typeof window.kmOpenRankRules,
      kmOpenSubstitutionLog: typeof window.kmOpenSubstitutionLog
    };
    var missing = Object.keys(tools).filter(function (k) { return tools[k] !== 'function'; });
    if (missing.length) console.error('KM menu tools missing', missing);
  } catch (e) {}


  /* KM_V14_PERSON_CARD_SCANNER — archive renderer lives in an allowed core extension file. */
  (function(){
    var MAX_FILES = 100;
    function pcEsc(v){ return typeof window.esc==='function' ? window.esc(v) : String(v==null?'':v).replace(/[&<>"']/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m];}); }
    function pcApi(){ return window.kmNative && window.kmNative.soldierCardArchive ? window.kmNative.soldierCardArchive : null; }
    function pcKey(name){
      if(typeof window.kmPersonDocKey==='function') return window.kmPersonDocKey(name);
      var raw=String(name||'').trim().toLowerCase(), h=0; for(var i=0;i<raw.length;i++) h=((h<<5)-h+raw.charCodeAt(i))|0; return 'pk_'+(h>>>0).toString(16);
    }
    function pcCan(id){
      try { if(typeof window.kmIsSuperAdmin==='function' && window.kmIsSuperAdmin()) return true; if(typeof window.kmSectionGranted==='function') return !!window.kmSectionGranted(id); } catch(e){} return false;
    }
    function pcEdit(id){
      try { if(typeof window.kmIsSuperAdmin==='function' && window.kmIsSuperAdmin()) return true; if(typeof window.kmCanEdit==='function') return !!window.kmCanEdit(id); } catch(e){} return false;
    }
    function fmt(iso){ try{return iso?new Date(iso).toLocaleString('hy-AM'):'';}catch(e){return String(iso||'').slice(0,19);} }
    function syncDb(name,files){ try{ if(typeof db==='undefined'||!db)return; if(!db.personCardArchives||typeof db.personCardArchives!=='object'||Array.isArray(db.personCardArchives))db.personCardArchives={}; var k=pcKey(name); db.personCardArchives[k]={personName:String(name||'').trim(),files:(files||[]).map(function(f){return {id:f.id,name:f.name,addedAt:f.addedAt,size:f.size,mime:f.mime,type:f.type};}),updatedAt:new Date().toISOString()}; }catch(e){} }
    function listHtml(files){
      files=Array.isArray(files)?files:[];
      if(!files.length) return '<p class="muted" style="margin:8px 0 0">Արխիվում սկանավորված փաստաթուղթ չկա։</p>';
      return '<ul style="list-style:none;margin:8px 0 0;padding:0;display:flex;flex-direction:column;gap:6px">'+files.map(function(f,i){
        var canView=pcCan('people:card:archive'), canDel=pcEdit('people:card:delete');
        return '<li style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:8px 10px;background:#f8fafc;border:1px solid #e2e8ef;border-radius:8px">'+
          '<span style="flex:1;min-width:180px;font-weight:600">'+pcEsc((i+1)+'. '+(f.name||f.id||'Փաստաթուղթ'))+'</span>'+
          '<span class="muted" style="font-size:12px">'+pcEsc(fmt(f.addedAt))+'</span>'+ (canView?'<button type="button" data-km-pc-view="'+pcEsc(f.id)+'">Դիտել</button>':'')+
          (canDel?'<button type="button" data-km-pc-del="'+pcEsc(f.id)+'" style="color:#b71c1c">Հեռացնել</button>':'')+'</li>';
      }).join('')+'</ul>';
    }
    window.kmPersonCardArchiveSectionHtml=function(p,canEdit){
      var scanAllowed=pcEdit('people:card:scan'), archiveAllowed=pcCan('people:card:archive');
      return '<div class="kmPcField kmPcFull" id="kmPcArchiveBlock" style="margin-top:12px">'+
        '<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between"><div><b style="color:#0d4a66">Արխիվ</b><span class="muted" style="margin-left:8px;font-size:12px">սկանավորված անձնական գործ · մինչև '+MAX_FILES+'</span></div>'+
        (scanAllowed?'<button type="button" id="kmPcArchiveScan" class="primary">＋ Սկանավորել և ավելացնել</button>':'')+'</div>'+
        '<div id="kmPcArchiveCount" class="muted" style="margin-top:4px;font-size:12px">Բեռնվում է…</div><div id="kmPcArchiveList"></div></div>';
    };
    window.kmPersonCardArchiveBind=function(box,p,canEdit){
      if(!box||!p)return; var name=String(p.name||'').trim(), key=pcKey(name), a=pcApi(); var list=box.querySelector('#kmPcArchiveList'), count=box.querySelector('#kmPcArchiveCount'), scan=box.querySelector('#kmPcArchiveScan');
      async function refresh(){
        if(!list)return; if(!a){if(count)count.textContent='Սկաները հասանելի է միայն desktop KM-ում';return;}
        try{var r=await a.list({personKey:key,personName:name}), files=r&&r.ok&&Array.isArray(r.files)?r.files:[]; syncDb(name,files); if(count)count.textContent=files.length+' / '+MAX_FILES+' փաստաթուղթ'; list.innerHTML=listHtml(files);
          list.querySelectorAll('[data-km-pc-view]').forEach(function(b){b.onclick=function(){viewOne(b.getAttribute('data-km-pc-view'));};});
          list.querySelectorAll('[data-km-pc-del]').forEach(function(b){b.onclick=function(){removeOne(b.getAttribute('data-km-pc-del'));};});
          if(scan)scan.disabled=files.length>=MAX_FILES || !pcEdit('people:card:scan');
        }catch(e){if(count)count.textContent=e.message||String(e);}
      }
      async function viewOne(id){ if(!a||!id||!pcCan('people:card:archive'))return; try{var r=await a.read({personKey:key,id:id}); if(!r||!r.ok){if(typeof toast==='function')toast((r&&r.message)||'Փաստաթուղթը չի գտնվել','warn');return;} if(typeof window.kmLawsShowDocViewer==='function')window.kmLawsShowDocViewer(r.name||'Արխիվ',r.mime||'application/pdf',{base64:r.base64});}catch(e){if(typeof toast==='function')toast(e.message||String(e),'error');} }
      async function removeOne(id){ if(!a||!id||!pcEdit('people:card:delete'))return; if(typeof window.kmAssertCanEdit==='function'&&!window.kmAssertCanEdit('people:card:delete'))return; if(!confirm('Հեռացնե՞լ այս փաստաթուղթը արխիվից։'))return; try{var r=await a.remove({personKey:key,id:id,personName:name}); if(!r||!r.ok){if(typeof toast==='function')toast((r&&r.message)||'Չհաջողվեց հեռացնել','error');return;} syncDb(name,r.files||[]); if(typeof save==='function')try{await save(true);}catch(eS){} if(typeof toast==='function')toast('Փաստաթուղթը հեռացվեց','ok'); await refresh();}catch(e){if(typeof toast==='function')toast(e.message||String(e),'error');} }
      if(scan)scan.onclick=async function(){ if(!pcEdit('people:card:scan')){if(typeof toast==='function')toast('Սկանավորման իրավունք չունեք','warn');return;} if(!a||typeof a.scanAndSave!=='function'){if(typeof toast==='function')toast('Սկանավորման մոդուլը հասանելի չէ','error');return;} try{scan.disabled=true; if(typeof toast==='function')toast('Ընտրեք scanner-ը և տեղադրեք փաստաթուղթը','info'); var r=await a.scanAndSave({personKey:key,personName:name}); if(!r||!r.ok){if(typeof toast==='function')toast((r&&r.message)||'Սկանավորումը չհաջողվեց','error');return;} syncDb(name,r.files||[]); if(typeof save==='function')try{await save(true);}catch(eS){} if(typeof toast==='function')toast('Սկանավորված փաստաթուղթը ավելացվեց արխիվ','ok'); await refresh();}catch(e){if(typeof toast==='function')toast(e.message||String(e),'error');}finally{scan.disabled=false;} };
      refresh();
    };
    window.kmSoldierCardsArchivePage=async function(host){
      if(!host)host=document.getElementById('content'); if(!host)return; var a=pcApi(); host.innerHTML=(typeof window.kmBackToolbar==='function'?window.kmBackToolbar("kmArchiveOpen('')"):'')+'<div class="card"><h3 style="margin-top:0">Զինծառայողների քարտեր</h3><p class="muted">Անձի քարտի «Արխիվ» բաժնում սկանավորված անձնական գործերը։</p><div id="kmSoldCardsBody"><p class="muted">Բեռնվում է…</p></div></div>'; var body=host.querySelector('#kmSoldCardsBody'); if(!a){body.innerHTML='<p class="muted">Սկանավորված արխիվը հասանելի է միայն desktop KM-ում։</p>';return;} try{var r=await a.listAll(),people=r&&r.ok&&Array.isArray(r.people)?r.people:[]; if(!people.length){body.innerHTML='<p class="muted">Դեռևս սկանավորված արխիվ չկա։</p>';return;} body.innerHTML='<div style="display:flex;flex-direction:column;gap:12px">'+people.map(function(pe){var fs=pe.files||[];return '<div style="border:1px solid #e2e8ef;border-radius:10px;padding:12px;background:#fff"><div style="font-weight:700">'+pcEsc(pe.personName||pe.personKey)+' <span class="muted" style="font-size:12px">('+fs.length+' փաստաթուղթ)</span></div>'+ (fs.length?'<ul style="list-style:none;margin:8px 0 0;padding:0">'+fs.map(function(f){return '<li style="display:flex;gap:8px;align-items:center;padding:5px 0"><span style="flex:1">'+pcEsc(f.name||f.id)+'</span><button type="button" data-km-sc-key="'+pcEsc(pe.personKey)+'" data-km-sc-id="'+pcEsc(f.id)+'">Դիտել</button></li>';}).join('')+'</ul>':'<p class="muted">Փաստաթղթեր չկան</p>')+'</div>';}).join('')+'</div>'; body.querySelectorAll('[data-km-sc-id]').forEach(function(b){b.onclick=async function(){try{var rr=await a.read({personKey:b.getAttribute('data-km-sc-key'),id:b.getAttribute('data-km-sc-id')});if(rr&&rr.ok&&typeof window.kmLawsShowDocViewer==='function')window.kmLawsShowDocViewer(rr.name||'Փաստաթուղթ',rr.mime||'application/pdf',{base64:rr.base64});}catch(e){if(typeof toast==='function')toast(e.message||String(e),'error');}};}); }catch(e){body.innerHTML='<p class="muted">'+pcEsc(e.message||String(e))+'</p>';}
    };
  })();
})();
