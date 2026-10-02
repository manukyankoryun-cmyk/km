/* KM — Զինծառայողի իրավունքները (Իրավական անկյուն) */
(function () {
  'use strict';

  var DATA = null;
  var DATA_URL = 'data/km_soldier_rights.json';

  function esc(s) {
    return typeof window.esc === 'function'
      ? window.esc(s)
      : String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
          return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
        });
  }

  function host() {
    var h = document.getElementById('content');
    if (h) window.content = h;
    return h || window.content;
  }

  function toastMsg(m, t) {
    if (typeof toast === 'function') toast(m, t);
    else if (typeof window.kmNotify === 'function') window.kmNotify(m, t);
  }

  function injectCss() {
    if (document.getElementById('km-soldier-rights-css')) return;
    var s = document.createElement('style');
    s.id = 'km-soldier-rights-css';
    s.textContent =
      '.kmSrShell{max-width:1100px;margin:0 auto}' +
      '.kmSrGroup{margin:18px 0 8px;font-size:13px;font-weight:800;color:#0d4a66;text-transform:uppercase;letter-spacing:.03em}' +
      '.kmSrArticle{line-height:1.55;color:#243848}' +
      '.kmSrArticle p{margin:0 0 12px}' +
      '.kmSrLinks{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}' +
      '.kmSrLinks a{font-size:13px;font-weight:700;color:#0d6e7a}' +
      '.kmSrHot{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;margin:12px 0}' +
      '.kmSrHotItem{padding:12px;border:1px solid #d7e6ec;border-radius:10px;background:#f7fbfd}' +
      '.kmSrHotItem b{display:block;color:#0d4a66;margin-bottom:4px}' +
      '.kmSrHotPhone{font-size:20px;font-weight:800;color:#17212b}' +
      '.kmSrCalc{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;padding:14px;background:#f4f8fa;border:1px solid #d7e6ec;border-radius:12px;margin:12px 0}' +
      '.kmSrCalc label{display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:700}' +
      '.kmSrCalc select,.kmSrCalc input{padding:8px;border:1px solid #c8d0d8;border-radius:8px;background:#fff}' +
      '.kmSrResult{margin:12px 0;padding:14px;border-radius:12px;background:#e8f6f1;border:1px solid #b7e0d0}' +
      '.kmSrResult strong{font-size:22px;color:#0d5c45}' +
      '.kmSrTpl{white-space:pre-wrap;font-family:Consolas,monospace;font-size:12px;padding:12px;background:#f8fafc;border:1px solid #e2e8ef;border-radius:10px}' +
      '.kmSrFiles{margin-top:16px}' +
      '.kmSrMuted{color:#5a6b78;font-size:13px}';
    document.head.appendChild(s);
  }

  function loadData() {
    if (DATA) return Promise.resolve(DATA);
    return fetch(DATA_URL + '?v=' + encodeURIComponent((window.kmUpdate || '') + ''))
      .then(function (r) {
        if (!r.ok) throw new Error('Չհաջողվեց բեռնել իրավունքների տվյալները');
        return r.json();
      })
      .then(function (j) {
        DATA = j;
        window.KM_SOLDIER_RIGHTS = j;
        return j;
      });
  }

  function safeHref(u) {
    /* SECURITY: defense-in-depth — this data file is currently bundled/
       trusted-only (never LAN-synced or user-edited), but only allow
       http(s) links regardless, so a future change to how this data is
       sourced can't turn an unescaped-but-entity-encoded 'javascript:' URL
       into a click-to-execute link (HTML-entity escaping alone does not
       neutralize a dangerous URL scheme). */
    var s = String(u || '').trim();
    return /^https?:\/\//i.test(s) ? s : '#';
  }

  function findSection(id) {
    var list = (DATA && DATA.sections) || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function backBtn(onclick) {
    if (typeof window.kmBackBtnHtml === 'function') return window.kmBackBtnHtml(onclick);
    return '<button type="button" onclick="' + onclick + '">← Վերադարձ</button>';
  }

  function cardHtml(sec) {
    var icon = '📋';
    var map = {
      medical: '🩺', home: '🏠', edu: '🎓', transport: '🚌', leave: '📅', family: '👨‍👩‍👧',
      pay: '💰', lump: '🧾', injury: '🩹', fund: '🛡', legal: '⚖', phone: '📞', law: '📜'
    };
    if (map[sec.icon]) icon = map[sec.icon];
    /* Ներկառուցված ուղեցույց՝ առանց ֆայլային պահոցի։ */
    return '<button type="button" class="kmLawCard kmLawCardLocal" onclick="kmSoldierRightsOpen(\'' + esc(sec.id) + '\')">' +
      '<span class="kmLawCardText">' + esc(sec.title) +
      (sec.summary ? ('<span class="kmLawCardMeta" style="margin-top:6px;display:block;text-transform:none;font-weight:600;color:#5a6b78;font-size:11px">' + esc(sec.summary) + '</span>') : '') +
      '</span>' +
      '<span class="kmLawCardIcon" aria-hidden="true" style="font-size:28px;line-height:1">' + icon + '</span></button>';
  }

  function renderHub(h, data) {
    var groups = [];
    var map = Object.create(null);
    (data.sections || []).forEach(function (s) {
      var g = s.group || 'Այլ';
      if (!map[g]) {
        map[g] = [];
        groups.push(g);
      }
      map[g].push(s);
    });
    var body = groups.map(function (g) {
      return '<div class="kmSrGroup">' + esc(g) + '</div>' +
        '<div class="kmLawsGrid" role="list">' + map[g].map(cardHtml).join('') + '</div>';
    }).join('');
    h.innerHTML =
      '<div class="card kmLawsHubWrap kmSrShell" style="margin-bottom:0">' +
        '<div class="toolbar" style="margin-bottom:10px">' +
          backBtn('kmLawDocsPage()') +
          '<button type="button" onclick="kmSoldierRightsOpen(\'rights_leave\')">Արձակուրդների հաշվիչ</button>' +
        '</div>' +
        '<h3 class="kmLawsHubTitle">' + esc(data.title || 'Զինծառայողի իրավունքները') + '</h3>' +
        '<p class="kmLawsHubLead">' + esc(data.lead || '') + '</p>' +
        body +
      '</div>';
  }

  function calcLeave() {
    var typeEl = document.getElementById('kmSrLeaveType');
    var combatEl = document.getElementById('kmSrLeaveCombat');
    var stazhEl = document.getElementById('kmSrLeaveStazh');
    var mountainEl = document.getElementById('kmSrLeaveMountain');
    var oathEl = document.getElementById('kmSrLeaveOath');
    var out = document.getElementById('kmSrLeaveOut');
    if (!out) return;
    var type = typeEl ? typeEl.value : 'conscript';
    var combat = !!(combatEl && combatEl.checked);
    var stazh = Number(stazhEl && stazhEl.value) || 0;
    var mountain = !!(mountainEl && mountainEl.checked);
    var oath = !!(oathEl && oathEl.checked);
    var main = 0;
    var extra = 0;
    var note = [];
    if (type === 'conscript') {
      main = combat ? 30 : 21;
      note.push('Պարտադիր ծառայություն՝ հիմնական արձակուրդ ' + main + ' օր (երեք մասերով)');
      if (oath) {
        extra += 2;
        note.push('Երդում՝ +2 օր');
      }
      note.push('Առաջին մասը՝ առնվազն 5 ամիս ծառայությունից հետո');
    } else {
      /* Պայմանագրային՝ ուղեցույցային հաշվարկ (ստուգել գործող հրամանով) */
      if (stazh < 5) main = 30;
      else if (stazh < 10) main = 35;
      else if (stazh < 15) main = 40;
      else main = 45;
      note.push('Պայմանագրային՝ ստաժային ուղեցույց ' + main + ' օր');
      if (combat) {
        extra += 5;
        note.push('Մարտական հերթապահություն՝ +5 օր (ուղեցույց)');
      }
      if (mountain) {
        extra += 5;
        note.push('Լեռնային/դժվարանցանելի՝ +5 օր (ուղեցույց)');
      }
    }
    var total = main + extra;
    out.innerHTML =
      '<div>Հասանելիք օրեր (ուղեցույց)՝ <strong>' + total + '</strong></div>' +
      '<div class="kmSrMuted" style="margin-top:8px">Հիմնական՝ ' + main + (extra ? (' · լրացուցիչ՝ ' + extra) : '') + '</div>' +
      '<ul class="kmSrMuted" style="margin:8px 0 0;padding-left:18px">' +
      note.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') +
      '</ul>' +
      '<p class="kmSrMuted" style="margin:10px 0 0">Վերջնական օրերը հաստատում է հրամանատարը՝ գրաֆիկի և գործող ակտերի համաձայն։</p>';
  }

  function filesPanelHtml(sectionId) {
    return '<div class="kmSrFiles card" style="margin-top:14px;padding:14px">' +
      '<h4 style="margin:0 0 8px">Բաժնի ֆայլեր</h4>' +
      '<p class="kmSrMuted" style="margin:0 0 10px">Այստեղ պահեք այս թեմայի օրենքներ, հրամաններ և ձևաթղթեր (PDF/DOCX)։</p>' +
      '<div class="toolbar">' +
        '<button type="button" class="primary" onclick="kmSoldierRightsOpenFiles(\'' + esc(sectionId) + '\')">Բացել ֆայլերի պահոցը</button>' +
      '</div></div>';
  }

  function renderArticle(h, sec) {
    var paras = (sec.body || []).map(function (p) {
      return '<p>' + esc(p) + '</p>';
    }).join('');
    var links = (sec.links || []).filter(function (l) {
      var lab = String(l.label || '');
      var url = String(l.url || '');
      return !/arlis/i.test(lab) && !/arlis/i.test(url);
    }).map(function (l) {
      return '<a href="' + esc(safeHref(l.url)) + '" target="_blank" rel="noopener">' + esc(l.label || l.url) + '</a>';
    }).join('');
    var hot = '';
    if (sec.hotlines && sec.hotlines.length) {
      hot = '<div class="kmSrHot">' + sec.hotlines.map(function (x) {
        return '<div class="kmSrHotItem"><b>' + esc(x.name) + '</b>' +
          '<div class="kmSrHotPhone">' + esc(x.phone) + '</div>' +
          (x.note ? ('<div class="kmSrMuted">' + esc(x.note) + '</div>') : '') +
          '</div>';
      }).join('') + '</div>';
    }
    var calc = '';
    if (sec.calculator) {
      calc =
        '<div class="kmSrCalc">' +
          '<label>Ծառայության տեսակ<select id="kmSrLeaveType" onchange="kmSoldierRightsCalcLeave()">' +
            '<option value="conscript">Պարտադիր</option>' +
            '<option value="contract">Պայմանագրային</option>' +
          '</select></label>' +
          '<label>Ստաժ (տարի, պայմանագրային)<input id="kmSrLeaveStazh" type="number" min="0" max="40" value="3" oninput="kmSoldierRightsCalcLeave()"></label>' +
          '<label style="flex-direction:row;align-items:center;gap:8px;margin-top:18px">' +
            '<input id="kmSrLeaveCombat" type="checkbox" onchange="kmSoldierRightsCalcLeave()"> Մարտական հերթապահություն</label>' +
          '<label style="flex-direction:row;align-items:center;gap:8px;margin-top:18px">' +
            '<input id="kmSrLeaveMountain" type="checkbox" onchange="kmSoldierRightsCalcLeave()"> Լեռնային / դժվարանցանելի</label>' +
          '<label style="flex-direction:row;align-items:center;gap:8px;margin-top:18px">' +
            '<input id="kmSrLeaveOath" type="checkbox" onchange="kmSoldierRightsCalcLeave()"> Երդում (+2 օր, պարտադիր)</label>' +
        '</div>' +
        '<div class="kmSrResult" id="kmSrLeaveOut">Հաշվարկ…</div>';
    }
    var tpl = '';
    if (sec.template) {
      tpl = '<h4>Օրինակելի ձև</h4><pre class="kmSrTpl">' + esc(sec.template) + '</pre>' +
        '<div class="toolbar"><button type="button" onclick="kmSoldierRightsCopyTpl()">Պատճենել ձևը</button></div>';
      window._kmSrTpl = sec.template;
    }
    h.innerHTML =
      '<div class="card kmSrShell kmSrArticle">' +
        '<div class="toolbar" style="margin-bottom:10px">' + backBtn('kmSoldierRightsHub()') + '</div>' +
        '<p class="kmSrMuted" style="margin:0 0 4px">' + esc(sec.group || '') + '</p>' +
        '<h3 class="kmLawsHubTitle" style="margin-top:0">' + esc(sec.title) + '</h3>' +
        '<p class="kmSrMuted">Ներքին ուղեցույց․ չի փոխարինում պաշտոնական իրավական ակտին։ Այս ուղեցույցի դրույթները առանձին իրավական ստուգում չեն անցել։</p>' +
        paras + calc + hot +
        (links ? ('<div class="kmSrLinks">' + links + '</div>') : '') +
        tpl +
        (sec.id === 'rights_military_service_law' || sec.id === 'rights_service_status' ? '<div class="toolbar"><button type="button" onclick="kmLegalInlineOpen(\'rights_service_status\')">Կարդալ առկա օրենքի տեքստը ծրագրում</button></div>' : '') +
      '</div>';
    if (sec.calculator) setTimeout(calcLeave, 0);
  }

  function ensureGuideFiles() {
    try {
      if (window.kmNative && window.kmNative.library && window.kmNative.library.lawsEnsureSoldierRights) {
        return window.kmNative.library.lawsEnsureSoldierRights().catch(function () { return null; });
      }
    } catch (e0) {}
    return Promise.resolve(null);
  }

  window.kmSoldierRightsHub = function () {
    if (window.kmUserRole === 'editor' && Array.isArray(window.kmEditSections)) {
      var okS = typeof window.kmSectionGranted === 'function' && (window.kmSectionGranted('soldier_rights') || window.kmSectionGranted('lawdocs'));
      if (!okS && window.kmGrantParents && window.kmGrantParents.soldier_rights) {
        okS = window.kmGrantParents.soldier_rights.some(function (id) {
          return window.kmSectionGranted(id);
        });
      }
      if (!okS) {
        if (typeof toast === 'function') toast('Այս բաժինը ձեզ թույլատրված չէ', 'error');
        return;
      }
    }
    injectCss();
    var h = host();
    if (!h) return;
    if (typeof page !== 'undefined') page = 'lawdocs';
    window.page = 'lawdocs';
    window._kmLawSubPage = 'soldier_rights';
    document.body.classList.remove('km-boot-idle');
    var pt = document.getElementById('pageTitle');
    if (pt) pt.textContent = 'Զինծառայողի իրավունքները';
    h.innerHTML = '<div class="card"><p class="muted">Բեռնվում է…</p></div>';
    loadData().then(function (data) {
      renderHub(h, data);
      if (typeof window.kmApplyRoleGuard === 'function') window.kmApplyRoleGuard();
      if (typeof window.kmFilterGrantCards === 'function') {
        try { window.kmFilterGrantCards(h); } catch (eG) {}
      }
    }).catch(function (e) {
      h.innerHTML = '<div class="card"><b>Չհաջողվեց բացել։</b><p class="muted">' + esc(e.message || e) + '</p>' +
        '<button type="button" onclick="kmLawDocsPage()">← Վերադարձ</button></div>';
    });
  };

  window.kmSoldierRightsOpen = function (id) {
    if (window.kmUserRole === 'editor' && Array.isArray(window.kmEditSections)) {
      var sid = String(id || '');
      var okO = typeof window.kmSectionGranted === 'function' && (
        window.kmSectionGranted(sid) ||
        window.kmSectionGranted('soldier_rights') ||
        window.kmSectionGranted('lawdocs')
      );
      if (!okO) {
        if (typeof toast === 'function') toast('Այս բաժինը ձեզ թույլատրված չէ', 'error');
        return;
      }
    }
    injectCss();
    var h = host();
    if (!h) return;
    loadData().then(function () {
      var sec = findSection(id);
      if (!sec) {
        toastMsg('Բաժինը չի գտնվել', 'error');
        return;
      }
      window._kmLawSubPage = id;
      var pt = document.getElementById('pageTitle');
      if (pt) pt.textContent = sec.title;
      renderArticle(h, sec);
      if (typeof window.kmApplyRoleGuard === 'function') window.kmApplyRoleGuard();
    }).catch(function (e) {
      toastMsg(e.message || String(e), 'error');
    });
  };

  window.kmSoldierRightsCalcLeave = calcLeave;

  window.kmSoldierRightsCopyTpl = function () {
    var t = window._kmSrTpl || '';
    if (!t) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(t).then(function () { toastMsg('Պատճենվեց', 'ok'); });
        return;
      }
    } catch (e0) {}
    toastMsg('Պատճենել չհաջողվեց', 'warn');
  };

  window.kmSoldierRightsOpenFiles = function (sectionId) {
    sectionId = String(sectionId || '').trim();
    if (!sectionId) return;
    ensureGuideFiles().then(function () {
      if (typeof window.kmLawsOpenLocal === 'function') {
        window.kmLawsOpenLocal(sectionId);
        return;
      }
      toastMsg('Ֆայլերի բաժինը հասանելի չէ', 'warn');
    });
  };

  window.kmSoldierRightsSectionIds = function () {
    return (DATA && DATA.sections ? DATA.sections : []).map(function (s) { return s.id; });
  };
})();
