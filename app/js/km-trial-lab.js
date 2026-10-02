/* KM — ՓՈՐՑԱՇՐՋԱՆ (ԱՇԽԱՏԱՆՔԻ ԳՈՐԾԻՔՆԵՐ) */
(function () {
  'use strict';

  var PAGES = {
    unitTrialLab: 'Փորձաշրջան',
    unitTrialExam: 'Ծառայողական քննությունների օգնական',
    unitTrialChar: 'Բնութագրերի օգնական',
    unitTrialMonitor: 'Տույժերի ժամկետների հսկիչ'
  };

  var PENALTY_TYPES = [
    { id: 'reprimand', label: 'Նկատողություն', months: 3 },
    { id: 'strict', label: 'Խիստ նկատողություն', months: 6 },
    { id: 'position_partial', label: 'Պաշտոնի ոչ լրիվ անհամապատասխանեցում', months: 0 },
    { id: 'position_mismatch', label: 'Պաշտոնի անհամապատասխանեցում', months: 0 }
  ];

  var CHAR_CHECKS = [
    { id: 'disc_high', group: 'discipline', label: 'Կարգապահությունը՝ բարձր', text: 'Կարգապահ է, հրամանները կատարում է ժամանակին և ճշգրիտ, ծառայողական կարգապահությունը պահպանում է բարձր մակարդակով։' },
    { id: 'disc_mid', group: 'discipline', label: 'Կարգապահությունը՝ միջին', text: 'Ընդհանուր առմամբ կարգապահ է, երբեմն պահանջում է վերահսկողություն։' },
    { id: 'disc_low', group: 'discipline', label: 'Կարգապահությունը՝ ցածր', text: 'Կարգապահության մակարդակը բավարար չէ, անհրաժեշտ է լրացուցիչ աշխատանք և խիստ վերահսկողություն։' },
    { id: 'fit_good', group: 'fitness', label: 'Ֆիզպատրաստությունը՝ լավ', text: 'Ֆիզիկապես պատրաստ է, դիմացկուն է ծանրաբեռնվածություններին և մարտական առաջադրանքներին։' },
    { id: 'fit_mid', group: 'fitness', label: 'Ֆիզպատրաստությունը՝ միջին', text: 'Ֆիզիկական պատրաստությունը միջին մակարդակի է։' },
    { id: 'fit_weak', group: 'fitness', label: 'Ֆիզպատրաստությունը՝ թույլ', text: 'Ֆիզիկական պատրաստությունը թույլ է, պահանջում է համակարգված բարելավում։' },
    { id: 'char_calm', group: 'character', label: 'Բնավորությունը՝ զսպված', text: 'Բնավորությամբ զսպված է, հավասարակշիռ, կոնֆլիկտային իրավիճակներում պահպանում է ինքնատիրապետում։' },
    { id: 'char_active', group: 'character', label: 'Բնավորությունը՝ ակտիվ', text: 'Ակտիվ է, նախաձեռնող, պատրաստ է մասնակցել ստորաբաժանման առօրյա և մարտական աշխատանքներին։' },
    { id: 'char_hard', group: 'character', label: 'Բնավորությունը՝ պահանջկոտ', text: 'Պահանջկոտ է ինքն իր և շրջապատի նկատմամբ, ձգտում է կատարելության։' },
    { id: 'shoot_high', group: 'shooting', label: 'Կրակային պատրաստությունը՝ բարձր', text: 'Կրակային պատրաստությունը բարձր է, վստահ է զենքի հետ աշխատելիս։' },
    { id: 'shoot_ok', group: 'shooting', label: 'Կրակային պատրաստությունը՝ բավարար', text: 'Կրակային պատրաստությունը բավարար է ծառայողական պահանջներին։' },
    { id: 'team_good', group: 'team', label: 'Թիմային աշխատանք՝ լավ', text: 'Լավ է աշխատում թիմում, հարգում է հրամանատարական շղթան և գործընկերներին։' },
    { id: 'duty_ok', group: 'duty', label: 'Պարտականությունները՝ բարեխիղճ', text: 'Ծառայողական պարտականությունները կատարում է բարեխղճորեն և պատասխանատու։' },
    { id: 'moral_high', group: 'moral', label: 'Բարոյահոգեբանական վիճակ՝ կայուն', text: 'Բարոյահոգեբանական վիճակը կայուն է, ծառայությանը վերաբերվում է պատասխանատու։' }
  ];

  var EXAM_STEPS = [
    { id: 'who', title: 'Ով' },
    { id: 'when', title: 'Երբ / Հրաման' },
    { id: 'what', title: 'Ինչ փաստ' },
    { id: 'facts', title: 'Փաստեր' },
    { id: 'penalty', title: 'Առաջարկ' },
    { id: 'result', title: 'Եզրակացություն' }
  ];

  function esc(s) {
    return typeof window.esc === 'function'
      ? window.esc(s)
      : String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function canEdit() {
    return typeof window.kmCanEdit === 'function' ? window.kmCanEdit() : true;
  }
  function host() {
    return document.getElementById('content');
  }
  function uid(prefix) {
    return (prefix || 'tl') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  }
  function todayIso() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function fmtDate(iso) {
    if (!iso) return '—';
    try {
      return new Date(String(iso) + 'T12:00:00').toLocaleDateString('hy-AM');
    } catch (e) {
      return String(iso).slice(0, 10);
    }
  }
  function daysBetween(a, b) {
    var x = new Date(String(a) + 'T12:00:00');
    var y = new Date(String(b) + 'T12:00:00');
    if (isNaN(x.getTime()) || isNaN(y.getTime())) return 0;
    return Math.round((y - x) / 86400000);
  }
  function peopleList() {
    if (typeof window.kmPeopleRoster === 'function') {
      try { return window.kmPeopleRoster() || []; } catch (e) {}
    }
    return (typeof db !== 'undefined' && Array.isArray(db.people)) ? db.people : [];
  }
  function findPerson(name) {
    var n = String(name || '').trim();
    var p = peopleList().find(function (x) { return String(x.name || '').trim() === n; });
    return p || { name: n, rank: '', unit: '', post: '' };
  }
  function peopleSelect(id, selected) {
    var listId = id + 'List';
    var opts = peopleList().map(function (p) {
      var name = String(p.name || '').trim();
      if (!name) return '';
      return '<option value="' + esc(name) + '"></option>';
    }).join('');
    return '<input id="' + id + '" class="kmAahInput" data-km-allow-edit="1" type="text" list="' + listId +
      '" value="' + esc(selected || '') +
      '" placeholder="գրեք Ա․Ա․Հ" autocomplete="off" spellcheck="false" style="min-width:280px;pointer-events:auto">' +
      '<datalist id="' + listId + '">' + opts + '</datalist>';
  }
  function shortSign(full) {
    var parts = String(full || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '____________';
    if (parts.length === 1) return parts[0];
    return parts[0].charAt(0) + '.' + parts[parts.length - 1];
  }
  function unitFormal() {
    var s = (typeof db !== 'undefined' && db.settings && typeof db.settings === 'object') ? db.settings : {};
    return {
      unitCode: String(s.unitCode || 'ՀՀ ՊՆ 25836').trim() || 'ՀՀ ՊՆ 25836',
      cmdRank: String(s.commanderRank || 'գնդապետ').trim() || 'գնդապետ',
      cmdName: String(s.commanderName || 'Գ. ԴԱԼԼԱՔՅԱՆ').trim() || 'Գ. ԴԱԼԼԱՔՅԱՆ',
      cmdDative: String(s.commanderDative || 'Գ. ԴԱԼԼԱՔՅԱՆԻՆ').trim() || 'Գ. ԴԱԼԼԱՔՅԱՆԻՆ'
    };
  }
  async function persist(silent) {
    if (typeof normalize === 'function') normalize();
    if (typeof save === 'function') await save(!!silent);
  }
  function toastOk(msg) {
    if (typeof window.kmNotify === 'function') window.kmNotify(msg, 'ok');
    else if (typeof toast === 'function') toast(msg);
  }
  function toastErr(msg) {
    if (typeof window.kmNotify === 'function') window.kmNotify(msg, 'error');
    else if (typeof toast === 'function') toast(msg, 'error');
  }

  function ensureStores() {
    if (typeof db === 'undefined') return;
    if (!Array.isArray(db.trialExamDrafts)) db.trialExamDrafts = [];
    if (!Array.isArray(db.trialCharDrafts)) db.trialCharDrafts = [];
    if (!Array.isArray(db.trialMonitorDismissed)) db.trialMonitorDismissed = [];
    if (!Array.isArray(db.disciplinePenalties)) db.disciplinePenalties = [];
    if (!Array.isArray(db.disciplinePenaltiesArchive)) db.disciplinePenaltiesArchive = [];
  }

  function injectCss() {
    if (document.getElementById('km-trial-lab-css')) return;
    var s = document.createElement('style');
    s.id = 'km-trial-lab-css';
    s.textContent =
      '.kmTlShell{display:flex;flex-direction:column;gap:12px}' +
      '.kmTlBar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between}' +
      '.kmTlMuted{color:#667788;font-size:12px}' +
      '.kmTlForm{display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;padding:12px;background:#f4f7f9;border:1px solid #d7e0e7;border-radius:10px}' +
      '.kmTlForm label{display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:700;color:#334}' +
      '.kmTlForm input,.kmTlForm select,.kmTlForm textarea{padding:8px 10px;border:1px solid #c5d0da;border-radius:7px;min-width:160px;background:#fff;font:inherit}' +
      '.kmTlForm textarea{min-width:260px;min-height:80px;width:100%}' +
      '.kmTlChecks{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:8px;padding:10px;background:#f7fafc;border:1px solid #d7e0e7;border-radius:10px}' +
      '.kmTlChecks label{display:flex;gap:8px;align-items:flex-start;font-size:13px;font-weight:600;cursor:pointer}' +
      '.kmTlSteps{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px}' +
      '.kmTlStep{padding:6px 10px;border-radius:999px;border:1px solid #c5d0da;background:#fff;font-size:12px;font-weight:700;color:#556}' +
      '.kmTlStep.on{background:#2f5d6b;border-color:#2f5d6b;color:#fff}' +
      '.kmTlStep.done{background:#e8f6ee;border-color:#9dceb0;color:#1a5c3a}' +
      '.kmTlAlert{padding:10px 12px;border-radius:8px;background:#fff4e5;border:1px solid #f0c36d;margin:0 0 10px}' +
      '.kmTlAlert.danger{background:#fde8e8;border-color:#e8a0a0}' +
      '.kmTlAlert.ok{background:#e8f6ee;border-color:#9dceb0}' +
      '.kmTlTable{width:100%;border-collapse:collapse;font-size:13px}' +
      '.kmTlTable th,.kmTlTable td{border:1px solid #d5dee6;padding:7px 8px;text-align:left;vertical-align:top}' +
      '.kmTlTable th{background:#e8eef3;font-weight:700}' +
      '.kmTlTable tr.warn{background:#fff4e5}' +
      '.kmTlTable tr.danger{background:#fde8e8}' +
      '.kmTlActions{display:flex;flex-wrap:wrap;gap:6px}' +
      '.kmTlOut{width:100%;min-height:220px;font:inherit;padding:10px;border:1px solid #c5d0da;border-radius:8px;white-space:pre-wrap}';
    document.head.appendChild(s);
  }

  function shell(title, bodyHtml, extraBar, backFn) {
    injectCss();
    var back = backFn || "kmOpenPage('unitTrialLab')";
    return '<div class="card kmTlShell">' +
      '<div class="kmTlBar">' +
        '<div><h3 style="margin:0">' + esc(title) + '</h3>' +
        '<div class="kmTlMuted">Փորձաշրջանի գործիք · նախագծեր պահպանվում են բազայում</div></div>' +
        '<div class="kmTlActions">' +
          (extraBar || '') +
          '<button type="button" onclick="' + back + '">← Վերադարձ</button>' +
        '</div>' +
      '</div>' + bodyHtml + '</div>';
  }

  function openPrint(title, htmlBody) {
    injectCss();
    var old = document.getElementById('kmTlPrint');
    if (old) old.remove();
    var wrap = document.createElement('div');
    wrap.id = 'kmTlPrint';
    wrap.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:16px';
    wrap.innerHTML =
      '<div style="background:#fff;max-width:860px;width:100%;max-height:90vh;overflow:auto;border-radius:10px;padding:16px">' +
        '<div class="kmTlBar"><b>' + esc(title) + '</b><div class="kmTlActions">' +
          '<button type="button" class="primary" onclick="window.print()">Տպել</button>' +
          '<button type="button" onclick="document.getElementById(\'kmTlPrint\').remove()">Փակել</button>' +
        '</div></div>' + htmlBody +
      '</div>';
    document.body.appendChild(wrap);
  }

  function cardHtml(title, openExpr, icon, hint) {
    if (typeof window.kmUiLawCard === 'function') {
      return window.kmUiLawCard(title, openExpr, icon || '🧪', hint ? { title: hint } : {});
    }
    return '<button type="button" class="kmLawCard" onclick="' + openExpr + '" title="' + esc(hint || '') + '">' +
      '<span class="kmLawCardText">' + esc(title) + '</span>' +
      '<span class="kmLawCardIcon" aria-hidden="true">' + (icon || '🧪') + '</span></button>';
  }

  /* ——— Hub ——— */
  function renderHub(h) {
    ensureStores();
    var due = monitorDueRows().length;
    var alert = due
      ? '<div class="kmTlAlert danger"><b>Ահազանգ՝</b> ' + due + ' տույժ(եր) մոտենում են հանման/մարման ժամկետին։ ' +
        '<button type="button" class="primary" onclick="kmOpenPage(\'unitTrialMonitor\')">Բացել հսկիչը</button></div>'
      : '<div class="kmTlAlert ok">Ակտիվ տույժերի շրջանում հրատապ ահազանգ չկա։</div>';
    h.innerHTML = shell(PAGES.unitTrialLab,
      alert +
      '<p class="kmTlMuted" style="margin:0 0 8px">Փորձաշրջանի ենթաբաժին՝ ինտերակտիվ օգնականներ ծառայողական քննության, բնութագրի և տույժերի ժամկետների համար։</p>' +
      '<div class="kmLawsGrid" data-km-cards="1">' +
        cardHtml(PAGES.unitTrialExam, "kmRememberAndOpen({kind:'page',value:'unitTrialExam'},()=>kmOpenPage('unitTrialExam'))", '🧭',
          'Քայլ առ քայլ օգնական · Եզրակացություն (Заключение)') +
        cardHtml(PAGES.unitTrialChar, "kmRememberAndOpen({kind:'page',value:'unitTrialChar'},()=>kmOpenPage('unitTrialChar'))", '✨',
          'Checkbox → պաշտոնական բնութագիր') +
        cardHtml(PAGES.unitTrialMonitor, "kmRememberAndOpen({kind:'page',value:'unitTrialMonitor'},()=>kmOpenPage('unitTrialMonitor'))", '⏱',
          'Հետհաշվարկ · հրամանի նախագիծ') +
      '</div>',
      '',
      "kmOpenPage('unitTools')"
    );
    if (typeof window.kmFilterGrantCards === 'function') {
      try { window.kmFilterGrantCards(h); } catch (e) {}
    }
  }

  /* ——— Exam Wizard ——— */
  var examState = {
    step: 0,
    person: '',
    rank: '',
    unit: '',
    post: '',
    whenDate: '',
    whenPlace: '',
    violation: '',
    severity: 'mid',
    witnesses: '',
    evidence: '',
    circumstances: '',
    suggestedPenalty: 'reprimand',
    examiner: '',
    conclusion: ''
  };

  function penaltyLabel(id) {
    var t = PENALTY_TYPES.find(function (x) { return x.id === id; });
    return t ? t.label : id;
  }

  function buildConclusion() {
    var meta = unitFormal();
    var p = findPerson(examState.person);
    var who = [examState.rank || p.rank, examState.person].filter(Boolean).join(' ');
    var post = examState.post || p.post || '';
    var unit = examState.unit || p.unit || '';
    var whoLine = [post ? (post + '՝') : '', who].filter(Boolean).join(' ');
    var orderNo = examState.orderNo || '____';
    var orderDate = examState.whenDate || todayIso();
    var orderDateHy = fmtDate(orderDate);
    var facts = examState.circumstances || examState.violation || '—';
    var evidence = examState.evidence || '';
    var witnesses = examState.witnesses || '';
    var findings = examState.findings ||
      ('Այսպիսով, ծառայողական քննության արդյունքներից կարելի է եզրակացնել հետևյալը.\n' +
        who + ' գործողություններում հանցակազմի հատկանիշներ ի հայտ չեն եկել։\n' +
        (examState.violation ? ('Ծառայողական քննությամբ ձեռք բերված տեղեկություններով՝ ' + examState.violation + '։\n') : '') +
        who + ' մեղավորության հանգամանքներ չկան, նա բնութագրվում է որպես կարգապահ զինծառայող, գործող կարգապահական տույժեր չունի։');
    var propose = examState.propose ||
      (examState.suggestedPenalty
        ? ('Առաջարկում եմ կիրառել՝ «' + penaltyLabel(examState.suggestedPenalty) + '»։')
        : 'Առաջարկում եմ համապատասխան միջոցառումներ ձեռնարկել՝ մասնագետների եզրակացությունը ստանալու համար։');
    var examiner = examState.examiner || '';
    var examinerRank = examState.examinerRank || '';
    var examinerPost = examState.examinerPost || (meta.unitCode + ' զորամասի կապի բաժանմունքի սպա');
    return (
      meta.unitCode.toUpperCase() + ' ԶՈՐԱՄԱՍԻ ՀՐԱՄԱՆԱՏԱՐ\n' +
      meta.cmdRank + ' ' + meta.cmdDative + '\n\n' +
      'Ե Զ Ր Ա Կ Ա Ց ՈՒ Թ Յ ՈՒ Ն\n\n' +
      '      Ձեր ' + orderDateHy + '-ի N ' + orderNo +
      ' հրամանով անցկացված ծառայողական քննության արդյունքում պարզվել է հետևյալը.\n' +
      '     Փաստի վերաբերյալ ' + (whoLine || who) +
      (unit ? (' (' + unit + ')') : '') +
      ' բացատրություն է տվել այն մասին, որ ' + facts + '\n' +
      (witnesses ? (who + ' նշել է նաև, որ ' + witnesses + '\n') : '') +
      (evidence ? (who + ' ներկայացրել է՝ ' + evidence + '\n') : '') +
      '\n    ' + findings + '\n\n' +
      'Առաջարկում եմ.\n' +
      propose + '\n\n' +
      '        Ծառայողական քննության նյութերին (եզրակացությանը) ծանոթացա՝ \n' +
      (examState.rank || p.rank || '________') + '                        ' + shortSign(examState.person) + '\n' +
      'Ծառայողական քննությունը անցկացրեց՝\n' +
      examinerPost + '\n' +
      (examinerRank || '________') + '                                     ' + shortSign(examiner || '____________') + '\n' +
      '<<     >>  <<     >> ' + String(new Date().getFullYear()) + 'թ.\n'
    );
  }

  function readExamForm() {
    var g = function (id) {
      var el = document.getElementById(id);
      return el ? String(el.value || '').trim() : '';
    };
    examState.person = g('kmTlExamPerson');
    examState.rank = g('kmTlExamRank');
    examState.unit = g('kmTlExamUnit');
    examState.post = g('kmTlExamPost');
    examState.whenDate = g('kmTlExamWhen');
    examState.orderNo = g('kmTlExamOrderNo');
    examState.whenPlace = g('kmTlExamPlace');
    examState.violation = g('kmTlExamViolation');
    examState.severity = g('kmTlExamSeverity') || 'mid';
    examState.witnesses = g('kmTlExamWitnesses');
    examState.evidence = g('kmTlExamEvidence');
    examState.circumstances = g('kmTlExamCirc');
    examState.suggestedPenalty = g('kmTlExamPenalty') || '';
    examState.propose = g('kmTlExamPropose');
    examState.examiner = g('kmTlExamExaminer');
    examState.examinerRank = g('kmTlExamExaminerRank');
    if (examState.step >= 5) {
      examState.conclusion = g('kmTlExamOut') || buildConclusion();
    }
  }

  function fillPersonFields() {
    var name = String((document.getElementById('kmTlExamPerson') || {}).value || '').trim();
    var p = findPerson(name);
    var r = document.getElementById('kmTlExamRank');
    var u = document.getElementById('kmTlExamUnit');
    var po = document.getElementById('kmTlExamPost');
    if (r && !r.value) r.value = p.rank || '';
    if (u && !u.value) u.value = p.unit || '';
    if (po && !po.value) po.value = p.post || '';
  }

  function renderExam(h) {
    ensureStores();
    var step = examState.step;
    var stepsHtml = EXAM_STEPS.map(function (s, i) {
      var cls = 'kmTlStep' + (i === step ? ' on' : (i < step ? ' done' : ''));
      return '<span class="' + cls + '">' + (i + 1) + '. ' + esc(s.title) + '</span>';
    }).join('');

    var body = '';
    if (step === 0) {
      body =
        '<div class="kmTlForm">' +
          '<label>Ա․Ա․Հ' + peopleSelect('kmTlExamPerson', examState.person) + '</label>' +
          '<label>Կոչում<input id="kmTlExamRank" value="' + esc(examState.rank) + '"></label>' +
          '<label>Պաշտոն<input id="kmTlExamPost" value="' + esc(examState.post) + '"></label>' +
          '<label>Ստորաբաժանում<input id="kmTlExamUnit" value="' + esc(examState.unit) + '"></label>' +
          '<button type="button" onclick="kmTrialExamFillPerson()">Ավտոլրացում անձնակազմից</button>' +
        '</div>';
    } else if (step === 1) {
      body =
        '<div class="kmTlForm">' +
          '<label>Հրամանի ամսաթիվ<input id="kmTlExamWhen" type="date" value="' + esc(examState.whenDate || todayIso()) + '"></label>' +
          '<label>Հրամանի N<input id="kmTlExamOrderNo" data-km-allow-edit="1" value="' + esc(examState.orderNo || '') + '" placeholder="օր. 140"></label>' +
          '<label>Վայր<input id="kmTlExamPlace" value="' + esc(examState.whenPlace) + '" placeholder="օր. կապի բաժանմունք…"></label>' +
        '</div>';
    } else if (step === 2) {
      body =
        '<div class="kmTlForm" style="align-items:stretch">' +
          '<label style="flex:1 1 100%">Փաստի նկարագրություն (ինչ է տեղի ունեցել)<textarea id="kmTlExamViolation">' + esc(examState.violation) + '</textarea></label>' +
          '<label>Ծանրություն<select id="kmTlExamSeverity">' +
            '<option value="low"' + (examState.severity === 'low' ? ' selected' : '') + '>Թեթև / մեղավորություն չկա</option>' +
            '<option value="mid"' + (examState.severity === 'mid' ? ' selected' : '') + '>Միջին</option>' +
            '<option value="high"' + (examState.severity === 'high' ? ' selected' : '') + '>Կոպիտ</option>' +
          '</select></label>' +
        '</div>';
    } else if (step === 3) {
      body =
        '<div class="kmTlForm" style="align-items:stretch">' +
          '<label style="flex:1 1 100%">Բացատրություն / հանգամանքներ<textarea id="kmTlExamCirc">' + esc(examState.circumstances) + '</textarea></label>' +
          '<label style="flex:1 1 45%">Վկաներ / մասնակիցներ<textarea id="kmTlExamWitnesses">' + esc(examState.witnesses) + '</textarea></label>' +
          '<label style="flex:1 1 45%">Ապացույցներ / փաստաթղթեր<textarea id="kmTlExamEvidence">' + esc(examState.evidence) + '</textarea></label>' +
        '</div>';
    } else if (step === 4) {
      var opts = PENALTY_TYPES.map(function (t) {
        return '<option value="' + esc(t.id) + '"' + (examState.suggestedPenalty === t.id ? ' selected' : '') + '>' + esc(t.label) + '</option>';
      }).join('');
      body =
        '<div class="kmTlForm" style="align-items:stretch">' +
          '<label>Առաջարկվող տույժ (եթե կա)<select id="kmTlExamPenalty"><option value="">— չկիրառել —</option>' + opts + '</select></label>' +
          '<label style="flex:1 1 100%">Առաջարկի տեքստ<textarea id="kmTlExamPropose" placeholder="օր. Չմիացվող ռադիոկայանը ներկայացնել վերանորոգման…">' + esc(examState.propose || '') + '</textarea></label>' +
          '<label>Քննություն վարող' + peopleSelect('kmTlExamExaminer', examState.examiner) + '</label>' +
          '<label>Քննողի կոչում<input id="kmTlExamExaminerRank" data-km-allow-edit="1" value="' + esc(examState.examinerRank || '') + '"></label>' +
        '</div>';
    } else {
      examState.conclusion = buildConclusion();
      body =
        '<label style="display:block;font-weight:700;margin:0 0 6px">Եզրակացություն (Заключение)</label>' +
        '<textarea id="kmTlExamOut" class="kmTlOut">' + esc(examState.conclusion) + '</textarea>' +
        '<div class="kmTlActions" style="margin-top:10px">' +
          '<button type="button" class="primary" onclick="kmTrialExamRegen()">Վերագեներացնել</button>' +
          (canEdit() ? '<button type="button" class="primary" onclick="kmTrialExamSave()">Պահպանել</button>' : '') +
          '<button type="button" onclick="kmTrialExamPrint()">Տպել</button>' +
          '<button type="button" onclick="kmTrialExamCopy()">Պատճենել</button>' +
        '</div>';
    }

    var nav =
      '<div class="kmTlActions" style="margin-top:12px">' +
        (step > 0 ? '<button type="button" onclick="kmTrialExamPrev()">← Նախորդ</button>' : '') +
        (step < EXAM_STEPS.length - 1
          ? '<button type="button" class="primary" onclick="kmTrialExamNext()">Հաջորդ →</button>'
          : '') +
        '<button type="button" onclick="kmTrialExamReset()">Նոր սկիզբ</button>' +
      '</div>';

    var history = db.trialExamDrafts.slice().reverse().slice(0, 8).map(function (r) {
      return '<tr><td>' + esc(r.person) + '</td><td>' + esc(penaltyLabel(r.suggestedPenalty)) +
        '</td><td>' + esc(fmtDate(r.createdAt)) + '</td><td class="kmTlActions">' +
        '<button type="button" onclick="kmTrialExamLoad(\'' + esc(r.id) + '\')">Բացել</button>' +
        (canEdit() ? '<button type="button" class="danger" onclick="kmTrialExamDel(\'' + esc(r.id) + '\')">Ջնջել</button>' : '') +
        '</td></tr>';
    }).join('') || '<tr><td colspan="4" class="kmTlMuted">Պահպանված եզրակացություններ չկան</td></tr>';

    h.innerHTML = shell(PAGES.unitTrialExam,
      '<div class="kmTlSteps">' + stepsHtml + '</div>' + body + nav +
      '<div class="gridwrap" style="margin-top:16px"><table class="kmTlTable"><thead><tr><th>Ա․Ա․Հ</th><th>Տույժ</th><th>Ամսաթիվ</th><th></th></tr></thead><tbody>' +
      history + '</tbody></table></div>'
    );

    var personEl = document.getElementById('kmTlExamPerson');
    if (personEl) {
      personEl.addEventListener('change', fillPersonFields);
      personEl.addEventListener('blur', fillPersonFields);
    }
  }

  window.kmTrialExamFillPerson = function () {
    fillPersonFields();
  };
  window.kmTrialExamNext = function () {
    readExamForm();
    if (examState.step === 0 && !examState.person) {
      toastErr('Նշեք Ա․Ա․Հ');
      return;
    }
    if (examState.step === 2 && !examState.violation) {
      toastErr('Նկարագրեք խախտումը');
      return;
    }
    if (examState.step < EXAM_STEPS.length - 1) examState.step += 1;
    window.kmTrialOpen('unitTrialExam');
  };
  window.kmTrialExamPrev = function () {
    readExamForm();
    if (examState.step > 0) examState.step -= 1;
    window.kmTrialOpen('unitTrialExam');
  };
  window.kmTrialExamReset = function () {
    examState = {
      step: 0, person: '', rank: '', unit: '', post: '', whenDate: todayIso(), whenPlace: '',
      violation: '', severity: 'mid', witnesses: '', evidence: '', circumstances: '',
      suggestedPenalty: 'reprimand', examiner: '', conclusion: ''
    };
    window.kmTrialOpen('unitTrialExam');
  };
  window.kmTrialExamRegen = function () {
    readExamForm();
    var out = document.getElementById('kmTlExamOut');
    if (out) out.value = buildConclusion();
  };
  window.kmTrialExamCopy = function () {
    readExamForm();
    var t = examState.conclusion || buildConclusion();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(t).then(function () { toastOk('Պատճենվեց'); }).catch(function () { toastErr('Չհաջողվեց պատճենել'); });
    } else {
      toastErr('Clipboard հասանելի չէ');
    }
  };
  window.kmTrialExamPrint = function () {
    readExamForm();
    var t = examState.conclusion || buildConclusion();
    openPrint('Եզրակացություն', '<pre style="white-space:pre-wrap;font:inherit">' + esc(t) + '</pre>');
  };
  window.kmTrialExamSave = async function () {
    if (!canEdit()) return;
    readExamForm();
    ensureStores();
    if (!examState.person) { toastErr('Նշեք Ա․Ա․Հ'); return; }
    examState.conclusion = examState.conclusion || buildConclusion();
    db.trialExamDrafts.push({
      id: uid('exam'),
      person: examState.person,
      rank: examState.rank,
      unit: examState.unit,
      post: examState.post,
      whenDate: examState.whenDate,
      whenPlace: examState.whenPlace,
      violation: examState.violation,
      severity: examState.severity,
      witnesses: examState.witnesses,
      evidence: examState.evidence,
      circumstances: examState.circumstances,
      suggestedPenalty: examState.suggestedPenalty,
      examiner: examState.examiner,
      text: examState.conclusion,
      createdAt: todayIso()
    });
    await persist(true);
    toastOk('Եզրակացությունը պահպանվեց');
    window.kmTrialOpen('unitTrialExam');
  };
  window.kmTrialExamDel = async function (id) {
    if (!canEdit() || !confirm('Ջնջե՞լ')) return;
    ensureStores();
    db.trialExamDrafts = db.trialExamDrafts.filter(function (x) { return x.id !== id; });
    await persist(true);
    window.kmTrialOpen('unitTrialExam');
  };
  window.kmTrialExamLoad = function (id) {
    ensureStores();
    var r = db.trialExamDrafts.find(function (x) { return x.id === id; });
    if (!r) return;
    examState = {
      step: 5,
      person: r.person || '',
      rank: r.rank || '',
      unit: r.unit || '',
      post: r.post || '',
      whenDate: r.whenDate || '',
      whenPlace: r.whenPlace || '',
      violation: r.violation || '',
      severity: r.severity || 'mid',
      witnesses: r.witnesses || '',
      evidence: r.evidence || '',
      circumstances: r.circumstances || '',
      suggestedPenalty: r.suggestedPenalty || 'reprimand',
      examiner: r.examiner || '',
      conclusion: r.text || ''
    };
    window.kmTrialOpen('unitTrialExam');
  };

  /* ——— Char Smart Engine ——— */
  function generateSmartChar(personName, ids, note) {
    var meta = unitFormal();
    var p = findPerson(personName);
    var who = [p.rank, p.name || personName].filter(Boolean).join(' ');
    var post = String(p.post || '').trim();
    var unitLine = post
      ? (meta.unitCode + ' զորամասի ' + post)
      : (p.unit ? (meta.unitCode + ' զորամասի ' + p.unit) : (meta.unitCode + ' զորամաս'));
    var d = {};
    try { d = (db.unitDossiers && db.unitDossiers[p.name || personName]) || {}; } catch (e) {}
    var birth = String(p.birthDate || p.born || d.birth || '').trim();
    var edu = String(p.education || d.education || '').trim();
    var fam = String(p.familyStatus || p.family || d.family || '').trim();
    var nation = String(p.nation || d.nation || 'հայ').trim();
    var party = String(p.party || d.party || 'անկուսակցական').trim();
    var picked = CHAR_CHECKS.filter(function (c) { return ids.indexOf(c.id) >= 0; });
    var paras = picked.map(function (c) { return c.text; });
    if (!paras.length) {
      paras.push(
        'իրեն դրսևորում է որպես կարգապահ, պարտաճանաչ, գրագետ զինծառայողի, իր վրա դրված ծառայողական պարտականությունները կատարում է ժամանակին և անթերի, կարողանում է պահել զինվորական գաղտնիքը, վայելում է հրամանատարության և ենթակաների վստահությունն ու հարգանքը։'
      );
    }
    var weak = ids.some(function (id) { return /_low$|_weak$/.test(id); });
    var verdict = weak ? 'պայմանական դրական' : 'դրական';
    var head =
      '                                               ' + who + 'ին\n' +
      '                                               ' + unitLine + ',\n' +
      (birth ? ('                                               Ծնված ' + birth + '\n') : '') +
      '                                               Ազգությունը՝ ' + nation + ', ' + party + '\n' +
      (edu ? ('                                               Կրթությունը՝ ' + edu + '\n') : '') +
      (fam ? ('                                               ' + fam + '\n') : '');
    var body =
      '            ' + who + ' ' + paras.join(' ') +
      (note ? (' ' + note) : '') +
      '\nԲնութագրվում է ' + verdict + '։\n\n\n';
    var signs =
      meta.unitCode.toUpperCase() + ' ԶՈՐԱՄԱՍԻ ՀՐԱՄԱՆԱՏԱՐ\n' +
      'գնդապետ                                        ' + meta.cmdName + '\n\n' +
      meta.unitCode.toUpperCase() + ' ԶՈՐԱՄԱՍԻ ԿԱՊԻ ԲԱԺԱՆՄՈՒՆՔԻ ՊԵՏ\n' +
      'մայոր                     ________________';
    return 'ԾԱՌԱՅՈՂԱԿԱՆ ԲՆՈՒԹԱԳԻՐ\n\n' + head + '\n' + body + signs;
  }

  function renderChar(h) {
    ensureStores();
    var checks = CHAR_CHECKS.map(function (c) {
      return '<label class="kmTlCheck"><input type="checkbox" data-km-tl-char="' + c.id +
        '" value="' + c.id + '"> <span>' + esc(c.label) + '</span></label>';
    }).join('');
    var rows = (db.trialCharDrafts || []).slice().reverse().map(function (c) {
      return '<tr><td>' + esc(c.person) + '</td><td>' + esc(fmtDate(c.createdAt)) +
        '</td><td class="kmTlActions">' +
        '<button type="button" data-km-tl-print="' + esc(c.id) + '">Տպել</button>' +
        (canEdit() ? '<button type="button" class="danger" data-km-tl-del="' + esc(c.id) + '">Ջնջել</button>' : '') +
        '</td></tr>';
    }).join('') || '<tr><td colspan="3" class="kmTlMuted">Դեռ բնութագիր չկա</td></tr>';

    /* Always show generator UI; save stays edit-gated */
    h.innerHTML = shell(PAGES.unitTrialChar,
      '<div class="kmTlForm">' +
        '<label>Ա․Ա․Հ' + peopleSelect('kmTlCharPerson') + '</label>' +
        '<label style="flex:1 1 100%">Լրացուցիչ նշում<textarea id="kmTlCharNote" rows="2"></textarea></label>' +
      '</div>' +
      '<p class="kmTlMuted" style="margin:8px 0">Նշեք checkbox-ները, ապա սեղմեք <b>Գեներացնել</b>՝ պաշտոնական տեքստ ստանալու համար։</p>' +
      '<div class="kmTlChecks" id="kmTlCharChecks">' + checks + '</div>' +
      '<div class="kmTlActions" style="margin:10px 0">' +
        '<button type="button" class="primary" id="kmTlCharGenBtn">Գեներացնել</button>' +
        (canEdit() ? '<button type="button" class="primary" id="kmTlCharSaveBtn">Պահպանել</button>' : '') +
        '<button type="button" id="kmTlCharCopyBtn">Պատճենել</button>' +
      '</div>' +
      '<label style="display:block;font-weight:700;margin:0 0 6px">Արդյունք</label>' +
      '<textarea id="kmTlCharOut" class="kmTlOut" placeholder="Այստեղ կհայտնվի գեներացված բնութագիրը…"></textarea>' +
      '<div class="gridwrap" style="margin-top:12px"><table class="kmTlTable"><thead><tr><th>Ա․Ա․Հ</th><th>Ամսաթիվ</th><th></th></tr></thead><tbody>' +
      rows + '</tbody></table></div>'
    );

    bindCharUi(h);
  }

  function bindCharUi(root) {
    root = root || host();
    if (!root) return;
    root.querySelectorAll('[data-km-tl-char]').forEach(function (el) {
      el.addEventListener('change', function () {
        onCharToggle(el);
      });
    });
    var gen = document.getElementById('kmTlCharGenBtn');
    if (gen) gen.addEventListener('click', function (e) {
      e.preventDefault();
      window.kmTrialCharPreview(true);
    });
    var saveBtn = document.getElementById('kmTlCharSaveBtn');
    if (saveBtn) saveBtn.addEventListener('click', function (e) {
      e.preventDefault();
      window.kmTrialCharSave();
    });
    var copyBtn = document.getElementById('kmTlCharCopyBtn');
    if (copyBtn) copyBtn.addEventListener('click', function (e) {
      e.preventDefault();
      window.kmTrialCharCopy();
    });
    var note = document.getElementById('kmTlCharNote');
    if (note) note.addEventListener('input', function () {
      /* live optional — only if already generated once */
      if ((document.getElementById('kmTlCharOut') || {}).value) window.kmTrialCharPreview(false);
    });
    root.querySelectorAll('[data-km-tl-print]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        window.kmTrialCharPrint(btn.getAttribute('data-km-tl-print'));
      });
    });
    root.querySelectorAll('[data-km-tl-del]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        window.kmTrialCharDel(btn.getAttribute('data-km-tl-del'));
      });
    });
  }

  function selectedCharIds() {
    var root = document.getElementById('kmTlCharChecks') || host();
    if (!root) return [];
    return Array.prototype.slice.call(root.querySelectorAll('[data-km-tl-char]:checked')).map(function (el) {
      return String(el.value || el.getAttribute('data-km-tl-char') || '');
    }).filter(Boolean);
  }

  function onCharToggle(el) {
    if (!el || !el.checked) {
      window.kmTrialCharPreview(false);
      return;
    }
    var id = String(el.value || el.getAttribute('data-km-tl-char') || '');
    var meta = CHAR_CHECKS.find(function (c) { return c.id === id; });
    if (!meta) return;
    var root = document.getElementById('kmTlCharChecks') || host();
    if (root) {
      root.querySelectorAll('[data-km-tl-char]').forEach(function (o) {
        var oid = String(o.value || o.getAttribute('data-km-tl-char') || '');
        var m = CHAR_CHECKS.find(function (c) { return c.id === oid; });
        if (m && m.group === meta.group && o !== el) o.checked = false;
      });
    }
    window.kmTrialCharPreview(false);
  }

  window.kmTrialCharToggle = function (el) {
    onCharToggle(el);
  };
  window.kmTrialCharPreview = function (showToast) {
    var name = String((document.getElementById('kmTlCharPerson') || {}).value || '').trim();
    var note = String((document.getElementById('kmTlCharNote') || {}).value || '').trim();
    var out = document.getElementById('kmTlCharOut');
    if (!out) {
      toastErr('Արդյունքի դաշտը չգտնվեց');
      return;
    }
    var ids = selectedCharIds();
    out.value = generateSmartChar(name || '—', ids, note);
    out.focus();
    try { out.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch (e0) {}
    if (showToast) {
      toastOk(ids.length
        ? ('Գեներացվեց (' + ids.length + ' նշում)')
        : 'Գեներացվեց (ընդհանուր ձև — նշեք checkbox-ներ ավելի ճշգրիտ տեքստի համար)');
    }
  };
  window.kmTrialCharCopy = function () {
    window.kmTrialCharPreview(false);
    var t = (document.getElementById('kmTlCharOut') || {}).value || '';
    if (!t) { toastErr('Տեքստ չկա'); return; }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(t).then(function () { toastOk('Պատճենվեց'); }).catch(function () { toastErr('Չհաջողվեց'); });
    } else {
      var out = document.getElementById('kmTlCharOut');
      if (out) { out.select(); try { document.execCommand('copy'); toastOk('Պատճենվեց'); } catch (e) { toastErr('Clipboard չկա'); } }
    }
  };
  window.kmTrialCharSave = async function () {
    if (!canEdit()) return;
    ensureStores();
    var name = String((document.getElementById('kmTlCharPerson') || {}).value || '').trim();
    if (!name) { toastErr('Գրեք Ա․Ա․Հ'); return; }
    window.kmTrialCharPreview();
    var text = document.getElementById('kmTlCharOut').value;
    var ids = selectedCharIds();
    db.trialCharDrafts.push({
      id: uid('char'),
      person: name,
      checks: ids,
      note: String((document.getElementById('kmTlCharNote') || {}).value || '').trim(),
      text: text,
      createdAt: todayIso()
    });
    await persist(true);
    toastOk('Բնութագիրը պահպանվեց');
    window.kmTrialOpen('unitTrialChar');
  };
  window.kmTrialCharDel = async function (id) {
    if (!canEdit() || !confirm('Ջնջե՞լ')) return;
    ensureStores();
    db.trialCharDrafts = db.trialCharDrafts.filter(function (x) { return x.id !== id; });
    await persist(true);
    window.kmTrialOpen('unitTrialChar');
  };
  window.kmTrialCharPrint = function (id) {
    ensureStores();
    var c = db.trialCharDrafts.find(function (x) { return x.id === id; });
    if (!c) return;
    openPrint('Բնութագիր', '<pre style="white-space:pre-wrap;font:inherit">' + esc(c.text) + '</pre>');
  };

  /* ——— Penalty Monitor ——— */
  function typeMeta(id) {
    return PENALTY_TYPES.find(function (t) { return t.id === id; }) ||
      ({ id: id, label: String(id || '—'), months: 0 });
  }

  function monitorDueRows() {
    ensureStores();
    var today = todayIso();
    var warnDays = 14;
    return (db.disciplinePenalties || []).filter(function (row) {
      if (!row || row.status !== 'active') return false;
      if (!row.expiresAt) return false;
      var left = daysBetween(today, row.expiresAt);
      return left <= warnDays;
    }).sort(function (a, b) {
      return String(a.expiresAt).localeCompare(String(b.expiresAt));
    });
  }

  function buildRemovalOrder(row) {
    var meta = typeMeta(row.type);
    var base = (typeof window.kmKanakerOrderDraft === 'function') ? window.kmKanakerOrderDraft() : null;
    var ministry = (base && base.ministry) || 'ՀԱՅԱՍՏԱՆԻ ՀԱՆՐԱՊԵՏՈՒԹՅԱՆ ՊԱՇՏՊԱՆՈՒԹՅԱՆ ՆԱԽԱՐԱՐՈՒԹՅԱՆ';
    var unit = (base && base.unitLine) || '549 ԱՄՀԳ ՀՐԱՄԱՆԱՏԱՐ';
    var city = (base && base.city) || 'ք. Ճամբարակ';
    return (
      ministry + '\n' +
      unit + '\n' +
      'Հ Ր Ա Մ Ա Ն\n' +
      'N\n\n' +
      '   "' + fmtDate(todayIso()).replace(/\./g, '.') + '"\t\t' + city + '\n\n' +
      'ՏՈՒՅԺԸ ՀԱՆԵԼՈՒ ՄԱՍԻՆ\n\n' +
      'Հիմք ընդունելով կարգապահական տույժի ժամկետի լրացումը (կամ ինքնաբերաբար մարումը)՝\n\n' +
      'Հ Ր Ա Մ Ա Յ ՈՒ Մ    Ե Մ\n\n' +
      '1. ' + [row.rank, row.personName].filter(Boolean).join(' ') +
      ' նկատմամբ կիրառված կարգապահական տույժը՝ «' + meta.label + '»' +
      (row.orderNumber ? (' (հրաման № ' + row.orderNumber + ')') : '') +
      ', ստացված՝ ' + fmtDate(row.receivedAt) +
      (row.expiresAt ? (', ժամկետի ավարտ՝ ' + fmtDate(row.expiresAt)) : '') +
      ', համարել հանված / մարված։\n\n' +
      '2. Հրամանը ծանոթացնել շահագրգիռ պաշտոնատար անձանց և զինծառայողին։\n\n' +
      (base ? (base.commanderTitle + '\n' + base.commanderRank + '                              ' + base.commanderName + '\n') : '') +
      (base ? (base.chiefTitle + '\n' + base.chiefRank + '                       ' + base.chiefName + '\n') : '') +
      '\nԱմսաթիվ՝ ' + fmtDate(todayIso()) + '\n'
    );
  }

  function renderMonitor(h) {
    ensureStores();
    if (typeof window.kmDisciplineSyncExpired === 'function') {
      try { window.kmDisciplineSyncExpired(); } catch (e) {}
    } else {
      /* local light sync */
      var today = todayIso();
      (db.disciplinePenalties || []).forEach(function (row) {
        if (row && row.expiresAt && row.expiresAt <= today && row.status === 'active') {
          row.status = 'expired';
          row.archivedAt = new Date().toISOString();
          db.disciplinePenaltiesArchive.unshift(row);
        }
      });
      db.disciplinePenalties = (db.disciplinePenalties || []).filter(function (r) { return r && r.status === 'active'; });
    }

    var today = todayIso();
    var active = (db.disciplinePenalties || []).slice().sort(function (a, b) {
      return String(a.expiresAt || '9999').localeCompare(String(b.expiresAt || '9999'));
    });
    var due = monitorDueRows();
    var alert = due.length
      ? '<div class="kmTlAlert danger"><b>Alert հրամանատարին / իրավաբանին՝</b> ' + due.length +
        ' տույժ(եր) հասել են հանման կամ մարման ժամկետին (կամ մոտենում են ≤14 օր)։</div>'
      : '<div class="kmTlAlert ok">Հրատապ Alert չկա։ Ակտիվ տույժերի հետհաշվարկը շարունակվում է։</div>';

    var rows = active.map(function (row) {
      var meta = typeMeta(row.type);
      var left = row.expiresAt ? daysBetween(today, row.expiresAt) : null;
      var cls = '';
      var leftTxt = '—';
      if (left == null) {
        leftTxt = 'Մշտական / առանց ավտոմարման';
      } else if (left <= 0) {
        cls = 'danger';
        leftTxt = 'Ժամկետը լրացել է (' + Math.abs(left) + ' օր առաջ)';
      } else if (left <= 14) {
        cls = 'warn';
        leftTxt = left + ' օր';
      } else {
        leftTxt = left + ' օր';
      }
      return '<tr class="' + cls + '"><td>' + esc(row.personName || '—') + '</td><td>' + esc(meta.label) +
        '</td><td>' + esc(fmtDate(row.receivedAt)) + '</td><td>' + esc(fmtDate(row.expiresAt)) +
        '</td><td><b>' + esc(leftTxt) + '</b></td><td class="kmTlActions">' +
        (row.expiresAt
          ? '<button type="button" class="primary" onclick="kmTrialMonitorDraft(\'' + esc(row.id) + '\')">Հրամանի նախագիծ</button>'
          : '') +
        '</td></tr>';
    }).join('') || '<tr><td colspan="6" class="kmTlMuted">Ակտիվ տույժեր չկան (տես՝ Իրավական անկյուն → Կարգապահական տույժեր)</td></tr>';

    h.innerHTML = shell(PAGES.unitTrialMonitor,
      alert +
      '<p class="kmTlMuted" style="margin:0 0 8px">Տույժ ստացած զինծառայողի քարտի տվյալներից հետհաշվարկ է գնում։ Ժամկետի լրանալիս առաջարկվում է «Տույժը հանելու մասին» հրամանի նախագիծ։</p>' +
      '<div id="kmTlMonitorDraftWrap" style="display:none;margin:0 0 12px">' +
        '<label style="display:block;font-weight:700;margin:0 0 6px">Հրամանի նախագիծ</label>' +
        '<textarea id="kmTlMonitorDraft" class="kmTlOut"></textarea>' +
        '<div class="kmTlActions" style="margin-top:8px">' +
          '<button type="button" onclick="kmTrialMonitorCopy()">Պատճենել</button>' +
          '<button type="button" onclick="kmTrialMonitorPrint()">Տպել</button>' +
          '<button type="button" onclick="document.getElementById(\'kmTlMonitorDraftWrap\').style.display=\'none\'">Փակել</button>' +
        '</div>' +
      '</div>' +
      '<div class="gridwrap"><table class="kmTlTable"><thead><tr>' +
        '<th>Ա․Ա․Հ</th><th>Տույժ</th><th>Ստացվել է</th><th>Մարում</th><th>Մնացել է</th><th></th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table></div>'
    );
  }

  window.kmTrialMonitorDraft = function (id) {
    ensureStores();
    var row = (db.disciplinePenalties || []).find(function (x) { return String(x.id) === String(id); });
    if (!row) {
      row = (db.disciplinePenaltiesArchive || []).find(function (x) { return String(x.id) === String(id); });
    }
    if (!row) { toastErr('Գրառումը չգտնվեց'); return; }
    var wrap = document.getElementById('kmTlMonitorDraftWrap');
    var ta = document.getElementById('kmTlMonitorDraft');
    if (!wrap || !ta) return;
    ta.value = buildRemovalOrder(row);
    wrap.style.display = '';
    wrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };
  window.kmTrialMonitorCopy = function () {
    var t = (document.getElementById('kmTlMonitorDraft') || {}).value || '';
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(t).then(function () { toastOk('Պատճենվեց'); }).catch(function () { toastErr('Չհաջողվեց'); });
    }
  };
  window.kmTrialMonitorPrint = function () {
    var t = (document.getElementById('kmTlMonitorDraft') || {}).value || '';
    openPrint('Տույժը հանելու մասին', '<pre style="white-space:pre-wrap;font:inherit">' + esc(t) + '</pre>');
  };

  /* ——— Router ——— */
  window.kmTrialPages = PAGES;
  window.kmTrialDueCount = function () {
    try { return monitorDueRows().length; } catch (e) { return 0; }
  };
  window.kmTrialOpen = function (page) {
    if (window.kmUserRole === 'editor' && Array.isArray(window.kmEditSections) && typeof window.kmCanAccessPage === 'function') {
      if (!window.kmCanAccessPage(page)) {
        toastErr('Այս բաժինը ձեզ թույլատրված չէ');
        return;
      }
    }
    ensureStores();
    injectCss();
    var h = host();
    if (!h) return;
    var map = {
      unitTrialLab: renderHub,
      unitTrialExam: renderExam,
      unitTrialChar: renderChar,
      unitTrialMonitor: renderMonitor
    };
    var fn = map[page];
    if (fn) fn(h);
    else toastErr('Անհայտ բաժին');
    if (typeof window.kmApplyRoleGuard === 'function') window.kmApplyRoleGuard();
    try {
      h.querySelectorAll('.kmAahInput,[data-km-allow-edit="1"]').forEach(function (el) {
        if (canEdit()) {
          el.disabled = false;
          el.readOnly = false;
          el.removeAttribute('readonly');
          el.removeAttribute('disabled');
        }
      });
    } catch (eU) {}
  };

  window.kmTrialHomeCardHtml = function () {
    return cardHtml(
      PAGES.unitTrialLab,
      "kmRememberAndOpen({kind:'page',value:'unitTrialLab'},()=>kmOpenPage('unitTrialLab'))",
      '🧪',
      'Քայլ առ քայլ օգնական · բնութագիր · տույժերի ժամկետներ'
    );
  };
})();
