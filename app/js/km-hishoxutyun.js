/* KM — բաժինների հիշողություն (hishoxutyun) սերվերում */
(function () {
  'use strict';

  var LABELS = {
    people: 'Անձնակազմ և քարտ',
    positions: 'Պաշտոն',
    characteristic: 'Բնութագիր',
    encouragements: 'Խրախուսանքներ',
    acts_discipline: 'Կարգապահական տույժեր',
    discipline: 'Կարգապահական տույժեր',
    schedule: 'Վերակարգի պլանավորում',
    dutyTypes: 'Վերակարգ', /* KM_MENU_REORG_V1 */
    vacations: 'Արձակուրդ',
    troopStructure: 'Անձնակազմի հաշվառում',
    unitFormation: 'Շարային տեղեկագիր',
    unitMedical: 'Բուժկետ',
    unitDossiers: 'Անձնակազմ և քարտ',
    unitLeavePlan: 'Արձակուրդների հերթափոխ',
    unitTermWatch: 'Կոչումներ և ժամկետներ',
    unitDocs: 'Փաստաթղթերի գեներատոր',
    unitInventory: 'Գույքի հաշվառում',
    unitCharDrafts: 'Բնութագրի օգնական',
    notes: 'Նշումներ',
    files: 'Ֆայլերի պահոց',
    library: 'Աշխատանքային գործիքներ', /* KM_MENU_REORG_V1: Գրադարան sections live there now */
    lawdocs: 'Իրավական անկյուն',
    acts_exam: 'Ծառայողական քննության եզրակացություն',
    original: 'Բնօրինակ',
    convert: 'Ֆայլերի փոխակերպում',
    current: 'Ընթացիկ արխիվ',
    archive: 'Արխիվ',
    accounting: 'Հաշվառում'
  };

  function esc(s) {
    return typeof window.esc === 'function'
      ? window.esc(s)
      : String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
      });
  }

  function sectionLabel(id) {
    if (LABELS[id]) return LABELS[id];
    try {
      var grant = window.kmGrantSections || [];
      for (var i = 0; i < grant.length; i++) {
        if (grant[i] && grant[i].id === id) return grant[i].label;
      }
    } catch (e) {}
    return id || 'Բաժին';
  }

  function currentSection() {
    var sub = String(window._kmLawSubPage || '');
    if (sub === 'discipline') return 'acts_discipline';
    if (sub) return sub;
    var p = String(window.page || (typeof page !== 'undefined' ? page : '') || '');
    if (p === 'library' && window.kmLibSection) return String(window.kmLibSection);
    return p || 'misc';
  }

  function actor() {
    if (typeof window.kmActorStamp === 'function') return window.kmActorStamp();
    var full = String(window.kmAuthFullName || sessionStorage.getItem('km_auth_full_name') || '').trim();
    var user = String(window.kmAuthUsername || sessionStorage.getItem('km_auth_username') || '').trim();
    return {
      user: user,
      fullName: full || '',
      userId: String(window.kmAuthUserId || sessionStorage.getItem('km_auth_user_id') || '').trim(),
      role: String(window.kmUserRole || '')
    };
  }

  function orgBits() {
    var c = null;
    try {
      if (typeof window.kmGetOrgContext === 'function') c = window.kmGetOrgContext();
    } catch (e) {}
    c = c || {};
    return {
      corpsId: c.corpsId || '',
      unitId: c.unitId || '',
      corpsName: c.corpsName || '',
      unitName: c.unitName || ''
    };
  }

  function actionHy(a) {
    var s = String(a || '');
    if (s === 'add' || s === 'file-add') return 'ավելացրել է';
    if (s === 'delete' || s === 'file-delete') return 'ջնջել է';
    if (s === 'remove') return 'հեռացրել է';
    if (s === 'attach') return 'կցել է';
    if (s === 'vacant') return 'դարձրել է թափուր';
    if (s === 'save') return 'պահպանել է';
    if (s === 'change' || s === 'file-change') return 'փոփոխել է';
    return s || 'փոփոխել է';
  }
  window.kmActionHy = actionHy;

  function pad2(n) {
    return String(n < 10 ? '0' + n : n);
  }
  function formatWhen(ts) {
    if (!ts) return '—';
    var d = new Date(ts);
    if (isNaN(+d)) {
      var s = String(ts);
      return s.length >= 10 ? s.slice(8, 10) + '.' + s.slice(5, 7) + '.' + s.slice(0, 4) : s;
    }
    return d.getDate() + '.' + pad2(d.getMonth() + 1) + '.' + d.getFullYear() +
      ' · ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds());
  }
  window.kmFormatWhen = formatWhen;
  function displayPersonName(r) {
    var full = String((r && r.fullName) || '').trim();
    if (full) return full;
    return 'Օգտատեր';
  }
  window.kmLogActorDisplayName = displayPersonName;

  window.kmIsRealChangeLog = function (r) {
    if (!r) return false;
    var act = String(r.action || '').toLowerCase();
    if (act === 'save' || act === 'open' || act === 'file-open' || act === 'login' || act === 'quit' ||
        act === 'user-login' || act.indexOf('sysinfo') === 0) return false;
    var det = String(r.detail || r.file || '').trim();
    if (!det) return false;
    if (det.charAt(0) === '{') {
      try {
        var j = JSON.parse(det);
        if (j && typeof j === 'object') {
          if (Object.prototype.hasOwnProperty.call(j, 'page') && !j.field && !j.output) return false;
          if (Object.keys(j).length <= 2 && (j.count != null || j.file != null) && !j.field) return false;
        }
      } catch (eJ) {}
    }
    if (r.real === 1 || r.real === true) return true;
    if (act === 'add' || act === 'delete' || act === 'remove' || act === 'attach' || act === 'vacant') return true;
    var sec = String(r.sectionLabel || r.section || '').trim();
    var sub = String(r.subsectionLabel || r.subsection || '').trim();
    if (det === sec || det === sub || det === String(r.section || '')) return false;
    var leftover = det;
    [sec, sub, String(r.section || ''), String(r.subsection || '')].forEach(function (x) {
      if (!x) return;
      leftover = leftover.split(x).join(' ');
    });
    leftover = leftover.replace(/[·|,;:\-–]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (!leftover) return false;
    if (act === 'change' || act === 'file-change') {
      return /ավելացրել|հանել է|փոխել է|ջնջել|կցել|թափուր|Ավելացնել|Հեռացնել|Կցել|ֆայլ՝|եզրակացություն|բնութագիր|խրախուսանք|տույժ|լուսանկար| → /.test(det);
    }
    return leftover.length >= 3;
  };

  function actorKey(r) {
    return displayPersonName(r);
  }
  function mergeRows(a, b) {
    var seen = Object.create(null);
    var out = [];
    function add(list) {
      (list || []).forEach(function (r) {
        if (!r) return;
        var k = [r.ts, r.userId || r.fullName, r.action, r.section, r.file || r.detail].join('|');
        if (seen[k]) return;
        seen[k] = 1;
        out.push(r);
      });
    }
    add(a);
    add(b);
    out.sort(function (x, y) { return String(y.ts || '').localeCompare(String(x.ts || '')); });
    return out;
  }

  var PERSON_FIELD_HY = {
    name: 'Ա․Ա․Հ․',
    rank: 'Կոչում',
    unit: 'Ստորաբաժանում',
    phone: 'Հեռախոս',
    education: 'Կրթություն',
    educations: 'Կրթություն',
    familyStatus: 'Ընտանեկան դրություն',
    contractStart: 'Պայմանագրի սկիզբ',
    contractTerm: 'Պայմանագրի ժամկետ',
    endDate: 'Պայմանագրի ավարտ',
    region: 'Մարզ',
    city: 'Քաղաք / համայնք',
    secrecyClearance: 'Գաղտնիության թույլատվություն',
    idCard: 'Անձնական վկայական',
    hsk: 'ՀԾՀ',
    address: 'Հասցե',
    commissariat: 'Զինվորական կոմիսարյատ',
    bloodGroup: 'Արյան խումբ',
    illnesses: 'Ուղեկցվող հիվանդություններ',
    articles: 'Հոդվածներ',
    articleItems: 'Հոդվածներ',
    note: 'Նշում',
    post: 'Պաշտոն',
    specialty: 'Մասնագիտություն',
    postCode: 'Հաստիքի կոդ',
    posOrder: 'Հրաման',
    appointmentDate: 'Նշանակման ամսաթիվ',
    photo: 'Լուսանկար'
  };

  function snapVal(v) {
    if (v == null) return '';
    if (Array.isArray(v)) {
      return v.map(function (x) {
        if (x == null) return '';
        if (typeof x === 'string') return String(x).trim();
        return String((x && (x.text || x.label || x.name)) || '').trim();
      }).filter(Boolean).join('; ');
    }
    return String(v).trim();
  }

  window.kmPersonCardSnapshot = function (p) {
    p = p || {};
    return {
      name: snapVal(p.name),
      rank: snapVal(p.rank),
      unit: snapVal(p.unit),
      phone: snapVal(p.phone),
      education: snapVal(p.education),
      educations: snapVal(p.educations),
      familyStatus: snapVal(p.familyStatus || p.family),
      contractStart: snapVal(p.contractStart),
      contractTerm: snapVal(p.contractTerm),
      endDate: snapVal(p.endDate || p.contractEnd),
      region: snapVal(p.region),
      city: snapVal(p.city),
      secrecyClearance: snapVal(p.secrecyClearance),
      idCard: snapVal(p.idCard),
      hsk: snapVal(p.hsk),
      address: snapVal(p.address),
      commissariat: snapVal(p.commissariat),
      bloodGroup: snapVal(p.bloodGroup),
      illnesses: snapVal(p.illnesses),
      articles: snapVal(p.articles),
      articleItems: snapVal(p.articleItems),
      note: snapVal(p.note),
      post: snapVal(p.post),
      specialty: snapVal(p.specialty),
      postCode: snapVal(p.postCode),
      posOrder: snapVal(p.posOrder),
      appointmentDate: snapVal(p.appointmentDate),
      photo: (p.photoId || p.photo) ? 'կա' : ''
    };
  };

  window.kmPersonCardDiffText = function (before, after, personName) {
    before = before || {};
    after = after || {};
    var parts = [];
    var keys = Object.keys(PERSON_FIELD_HY);
    var seenHy = Object.create(null);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      var hy = PERSON_FIELD_HY[k];
      if (seenHy[hy]) continue;
      var a = snapVal(before[k]);
      var b = snapVal(after[k]);
      if (k === 'education' || k === 'educations') {
        a = snapVal(before.educations || before.education);
        b = snapVal(after.educations || after.education);
      } else if (k === 'articles' || k === 'articleItems') {
        a = snapVal(before.articleItems || before.articles);
        b = snapVal(after.articleItems || after.articles);
      }
      seenHy[hy] = 1;
      if (a === b) continue;
      if (!a && b) parts.push('ավելացրել է «' + hy + '»՝ ' + b);
      else if (a && !b) parts.push('հանել է «' + hy + '»՝ ' + a);
      else parts.push('փոխել է «' + hy + '»՝ «' + a + '» → «' + b + '»');
    }
    var head = 'Քարտ՝ ' + String(personName || after.name || before.name || '').trim();
    return parts.length ? (head + ' · ' + parts.join('; ')) : '';
  };

  function auditDetail(rec) {
    var bits = [];
    if (rec.sectionLabel) bits.push(rec.sectionLabel);
    if (rec.subsectionLabel && rec.subsectionLabel !== rec.sectionLabel) bits.push(rec.subsectionLabel);
    if (rec.detail) bits.push(rec.detail);
    return bits.join(' · ');
  }

  window.kmHishoxutyunLog = function (opts) {
    opts = opts || {};
    try {
      if (!window.kmNative || !window.kmNative.hishoxutyun || !window.kmNative.hishoxutyun.append) return;
      var who = actor();
      var org = orgBits();
      var section = String(opts.section || currentSection() || 'misc');
      var meta = null;
      try {
        var libish = section === 'library' || section === 'laws' || section === 'lawdocs' || section === 'files' ||
          String(window.page || '') === 'lawdocs';
        if (libish && typeof window.kmLibCurrentArchiveMeta === 'function' && (!opts.sectionLabel || !opts.subsectionLabel)) {
          meta = window.kmLibCurrentArchiveMeta();
        }
      } catch (eM) { meta = null; }
      var rec = {
        section: section,
        sectionLabel: opts.sectionLabel || (meta && meta.sectionLabel) || sectionLabel(section),
        subsection: opts.subsection || (meta && meta.subsection) || '',
        subsectionLabel: opts.subsectionLabel || (meta && meta.subsectionLabel) || '',
        action: opts.action || 'change',
        detail: String(opts.detail || opts.file || '').trim(),
        file: String(opts.file || opts.detail || '').trim(),
        user: who.user,
        fullName: who.fullName || '',
        userId: who.userId || '',
        role: who.role,
        corpsId: org.corpsId,
        unitId: org.unitId,
        corpsName: org.corpsName,
        unitName: org.unitName,
        real: 1
      };
      if (!rec.detail) return;
      if (rec.detail === rec.sectionLabel || rec.detail === rec.subsectionLabel || rec.detail === rec.section) return;
      window.__kmHishoxutyunSkip = true;
      var fullDetail = auditDetail(rec);
      window.kmNative.hishoxutyun.append(rec).then(function () {
        try {
          if (window.kmNative.lanSync && typeof window.kmNative.lanSync.pushHubHishoxutyun === 'function') {
            window.kmNative.lanSync.pushHubHishoxutyun(rec);
          }
        } catch (eP) {}
      }).catch(function () {});
      try {
        if (window.kmNative.users && typeof window.kmNative.users.logActivity === 'function') {
          window.kmNative.users.logActivity({
            userId: rec.userId,
            username: rec.user,
            fullName: rec.fullName,
            action: rec.action,
            detail: fullDetail || rec.detail || rec.sectionLabel || rec.section,
            file: rec.detail || rec.file || '',
            page: rec.section,
            role: rec.role,
            real: 1,
            skipAudit: true
          }).catch(function () {});
        }
      } catch (eAct) {}
      try {
        if (window.kmNative.audit && typeof window.kmNative.audit.append === 'function') {
          var auditRec = {
            action: rec.action,
            detail: fullDetail,
            role: rec.role,
            user: rec.user,
            fullName: rec.fullName,
            userId: rec.userId,
            real: 1
          };
          window.kmNative.audit.append(auditRec);
          try {
            if (window.kmNative.lanSync && typeof window.kmNative.lanSync.pushHubAudit === 'function') {
              window.kmNative.lanSync.pushHubAudit(auditRec);
            }
          } catch (eAuP) {}
        }
      } catch (eAu) {}
      setTimeout(function () { window.__kmHishoxutyunSkip = false; }, 800);
    } catch (e) {
      window.__kmHishoxutyunSkip = false;
    }
  };

  function hookSave() {
    /* Silent/auto save must not appear in Հիշողություն / Արխիվ / մատյան.
       Real edits call kmHishoxutyunLog themselves after the user saves. */
  }

  window.kmOpenHishoxutyun = async function (section, query) {
    var embedRoot = document.getElementById('kmLibSectionRoot');
    var host = embedRoot || document.getElementById('content');
    if (!host) return;
    if (typeof page !== 'undefined') page = 'library';
    window.page = 'library';
    window.kmLibSection = 'hishoxutyun';
    var want = String(section || '').trim();
    var q = String(query || '').trim();
    var api = window.kmNative && window.kmNative.hishoxutyun;
    var data = { rows: [], sections: [] };
    if (api) {
      try {
        var secs = await api.sections();
        data.sections = (secs && secs.sections) || [];
        var listed = await api.list({ section: want, query: q, limit: 2000 });
        data.rows = ((listed && listed.rows) || []).filter(function (row) {
          return window.kmIsRealChangeLog(row);
        });
        data.dir = listed && listed.dir;
      } catch (e) {
        data.error = e.message || String(e);
      }
    }
    try {
      if (window.kmNative && window.kmNative.lanSync && typeof window.kmNative.lanSync.pullPrefix === 'function') {
        if (!window._kmHishPullAt || (Date.now() - window._kmHishPullAt) > 20000) {
          window._kmHishPullAt = Date.now();
          window.kmNative.lanSync.pullPrefix('hishoxutyun', { timeoutMs: 4000 }).then(function () {
            if (String(window.kmLibSection || '') === 'hishoxutyun') {
              window.kmOpenHishoxutyun(want, q);
            }
          }).catch(function () {});
        }
      }
    } catch (eHub) {}
    var opts = ['<option value="">Բոլոր բաժինները</option>'].concat(
      data.sections.map(function (id) {
        var sel = id === want ? ' selected' : '';
        return '<option value="' + esc(id) + '"' + sel + '>' + esc(sectionLabel(id)) + '</option>';
      })
    ).join('');
    var groups = {};
    var order = [];
    (data.rows || []).forEach(function (r) {
      var k = actorKey(r);
      if (!groups[k]) { groups[k] = []; order.push(k); }
      groups[k].push(r);
    });
    var rowsHtml = '';
    if (!order.length) {
      rowsHtml = '<tr><td colspan="6" class="muted">Դեռ գրառում չկա։ Փոփոխությունները կերևան այստեղ՝ անուն ազգանունով, ֆայլի անունով և ամսաթվով։</td></tr>';
    } else {
      order.forEach(function (k) {
        var first = groups[k][0] || {};
        var who = displayPersonName(first);
        rowsHtml += '<tr class="kmHishUserHead"><td colspan="6"><b>' + esc(who) + '</b>' +
          ' · ' + groups[k].length + ' փոփոխություն</td></tr>';
        groups[k].forEach(function (r) {
          var unit = r.unitName ? esc(r.unitName) : '—';
          var what = r.file || r.detail || '—';
          var secTxt = r.sectionLabel || sectionLabel(r.section);
          if (r.subsectionLabel && String(r.subsectionLabel) !== String(secTxt)) {
            secTxt += ' · ' + r.subsectionLabel;
          }
          rowsHtml += '<tr>' +
            '<td>' + esc(formatWhen(r.ts)) + '</td>' +
            '<td>' + esc(displayPersonName(r)) + '</td>' +
            '<td>' + esc(actionHy(r.action)) + '</td>' +
            '<td>' + esc(secTxt) + '</td>' +
            '<td>' + esc(what) + '</td>' +
            '<td class="muted">' + unit + '</td>' +
            '</tr>';
        });
      });
    }

    var backFn = 'kmLibShowHub()';
    if (embedRoot) {
      window._kmHishEntryBack = '';
    } else {
      if (!window._kmHishEntryBack) {
        if (want === 'characteristic') window._kmHishEntryBack = 'kmCharacteristicPage()';
        else if (want === 'encouragements') window._kmHishEntryBack = 'kmEncouragementsPage()';
        else if (want === 'acts_discipline' || want === 'discipline') window._kmHishEntryBack = 'kmDisciplinePenaltiesPage()';
        else if (want === 'people') window._kmHishEntryBack = "kmOpenPage('people')";
        else window._kmHishEntryBack = 'kmLibShowHub()';
      }
      backFn = window._kmHishEntryBack;
    }
    var backHtml = embedRoot
      ? ''
      : (typeof window.kmBackToolbar === 'function'
        ? window.kmBackToolbar(backFn)
        : '<div class="toolbar"><button type="button" onclick="' + backFn + '">← Վերադարձ</button></div>');
    host.innerHTML =
      backHtml +
      '<div class="card" id="kmHishoxutyunRoot">' +
      '<h3 style="margin:0 0 6px">Հիշողություն</h3>' +
      '<p class="muted" style="margin:0 0 12px;font-size:13px">Միայն օգտատիրոջ կամ ադմինի պահպանած փոփոխությունները՝ անուն ազգանունով, ինչ է ավելացվել կամ հանվել, օրը և ժամը։ Համաժամեցվում է Hub-ին։</p>' +
      (data.error ? ('<p style="color:#8a1f11">' + esc(data.error) + '</p>') : '') +
      (data.dir ? ('<p class="muted" style="font-size:12px;margin:0 0 10px">Պանակ՝ ' + esc(data.dir) + '</p>') : '') +
      '<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:end;margin-bottom:12px">' +
      '<label>Բաժին<select id="kmHishSec" style="display:block;margin-top:4px;min-width:220px">' + opts + '</select></label>' +
      '<label>Որոնում<input id="kmHishQ" type="search" value="' + esc(q) + '" placeholder="անուն, գործողություն…" style="display:block;margin-top:4px;min-width:200px"></label>' +
      '<button type="button" class="primary" id="kmHishGo">Ցույց տալ</button>' +
      '</div>' +
      '<div class="gridwrap"><table class="grid"><thead><tr>' +
      '<th>Օր / ամիս</th><th>Անուն ազգանուն</th><th>Գործողություն</th><th>Բաժին</th><th>Ֆայլ / ինչ</th><th>Զորամաս</th>' +
      '</tr></thead><tbody>' + rowsHtml + '</tbody></table></div></div>';

    var go = function () {
      var secEl = document.getElementById('kmHishSec');
      var qEl = document.getElementById('kmHishQ');
      window.kmOpenHishoxutyun(secEl ? secEl.value : '', qEl ? qEl.value : '');
    };
    var btn = document.getElementById('kmHishGo');
    if (btn) btn.onclick = go;
    var qEl = document.getElementById('kmHishQ');
    if (qEl) qEl.onkeydown = function (e) { if (e.key === 'Enter') go(); };
    var pt = document.getElementById('pageTitle');
    if (pt) pt.textContent = 'Հիշողություն';
  };

  window.kmHishoxutyunArchiveHtml = function (rows) {
    rows = (rows || []).filter(function (r) { return window.kmIsRealChangeLog(r); });
    var by = {};
    var order = [];
    rows.forEach(function (r) {
      if (!r) return;
      var parent = String(r.sectionLabel || sectionLabel(r.section) || 'Այլ').trim() || 'Այլ';
      var child = String(r.subsectionLabel || '').trim();
      if (!child && parent.indexOf(' · ') >= 0) {
        var parts = parent.split(' · ');
        if (parts.length >= 2) {
          child = parts.slice(1).join(' · ');
          parent = parts[0];
        }
      }
      if (!by[parent]) { by[parent] = { order: [], groups: {} }; order.push(parent); }
      var ck = child || '—';
      if (!by[parent].groups[ck]) { by[parent].groups[ck] = []; by[parent].order.push(ck); }
      by[parent].groups[ck].push(r);
    });
    order.sort(function (a, b) { return a.localeCompare(b, 'hy'); });
    if (!order.length) {
      return '<p class="muted">Դեռ փոփոխություն չի գրանցվել։</p>';
    }
    return order.map(function (sec) {
      var pack = by[sec];
      var total = pack.order.reduce(function (n, k) { return n + pack.groups[k].length; }, 0);
      var html = '<details open class="kmLibArchSec" style="margin:0 0 10px;border:1px solid #d5e0ec;border-radius:10px;background:#fff">' +
        '<summary style="cursor:pointer;padding:10px 12px;font-weight:700">' + esc(sec) +
        ' <span class="muted" style="font-weight:400">· ' + total + '</span></summary>';
      pack.order.forEach(function (sub) {
        var list = pack.groups[sub];
        var showSub = !(pack.order.length === 1 && sub === '—');
        if (showSub) {
          html += '<details open style="margin:0 10px 10px;border:1px solid #eef2f6;border-radius:8px">' +
            '<summary style="cursor:pointer;padding:8px 10px;font-weight:600">' + esc(sub) +
            ' <span class="muted" style="font-weight:400">· ' + list.length + '</span></summary>';
        }
        html += '<div class="gridwrap" style="padding:0 10px 10px"><table class="grid"><thead><tr>' +
          '<th>Օր / ամիս</th><th>Անուն ազգանուն</th><th>Գործողություն</th><th>Ֆայլ / ինչ</th><th>Զորամաս</th>' +
          '</tr></thead><tbody>';
        list.forEach(function (r) {
          html += '<tr>' +
            '<td>' + esc(formatWhen(r.ts)) + '</td>' +
            '<td>' + esc(displayPersonName(r)) + '</td>' +
            '<td>' + esc(actionHy(r.action)) + '</td>' +
            '<td>' + esc(r.file || r.detail || '—') + '</td>' +
            '<td class="muted">' + esc(r.unitName || '—') + '</td>' +
            '</tr>';
        });
        html += '</tbody></table></div>';
        if (showSub) html += '</details>';
      });
      html += '</details>';
      return html;
    }).join('');
  };

  function boot() {
    hookSave();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  setTimeout(hookSave, 800);
})();
