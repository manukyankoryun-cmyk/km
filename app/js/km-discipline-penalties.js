/* KM — Կարգապահական տույժերի registry */
(function () {
  'use strict';

  const TYPES = [
    { id: 'strict', label: 'ԽԻՍՏ ՆԿԱՏՈՂՈՒԹՅՈՒՆ', months: 6 },
    { id: 'reprimand', label: 'ՆԿԱՏՈՂՈՒԹՅՈՒՆ', months: 3 },
    { id: 'position_mismatch', label: 'ՊԱՇՏՈՆԻ ԱՆՀԱՄԱՊԱՏԱՍԽԱՆԵՑՈՒՄ', months: 0 },
    { id: 'position_partial', label: 'ՊԱՇՏՈՆԻ ՈՉ ԼՐԻՎ ԱՆՀԱՄԱՊԱՏԱՍԽԱՆԵՑՈՒՄ', months: 0 }
  ];

  let pendingPdf = null; // { name, bytes: number[] }

  function esc(s) {
    return typeof window.esc === 'function' ? window.esc(s) : String(s ?? '');
  }

  function typeMeta(id) {
    return TYPES.find((t) => t.id === id) || TYPES[0];
  }

  function ensureStore() {
    if (typeof db === 'undefined') return;
    if (!Array.isArray(db.disciplinePenalties)) db.disciplinePenalties = [];
    if (!Array.isArray(db.disciplinePenaltiesArchive)) db.disciplinePenaltiesArchive = [];
  }

  function parseDate(s) {
    s = String(s || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    const d = new Date(s + 'T12:00:00');
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function fmtDate(d) {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString('hy-AM'); } catch (e) { return String(d).slice(0, 10); }
  }

  function computeExpiresAt(typeId, receivedAt) {
    const meta = typeMeta(typeId);
    if (!meta.months) return null;
    const d = parseDate(receivedAt);
    if (!d) return null;
    d.setMonth(d.getMonth() + meta.months);
    return d.toISOString().slice(0, 10);
  }

  function isPermanent(typeId) {
    return typeId === 'position_mismatch' || typeId === 'position_partial';
  }

  function syncExpired() {
    ensureStore();
    const today = new Date().toISOString().slice(0, 10);
    const keep = [];
    (db.disciplinePenalties || []).forEach((row) => {
      if (row.expiresAt && row.expiresAt <= today && row.status === 'active') {
        row.status = 'expired';
        row.archivedAt = new Date().toISOString();
        db.disciplinePenaltiesArchive.unshift(row);
      } else {
        keep.push(row);
      }
    });
    db.disciplinePenalties = keep;
  }

  function peopleOptions(selected) {
    const list = (typeof window.kmPeopleRoster === 'function')
      ? (window.kmPeopleRoster() || [])
      : (Array.isArray(db && db.people) ? db.people : []);
    return list.map((p, i) => {
      const name = String(p.name || '').trim();
      if (!name) return '';
      const sel = name === selected ? ' selected' : '';
      return '<option value="' + esc(name) + '" data-rank="' + esc(String(p.rank || '')) + '" data-idx="' + i + '"' + sel + '>' + esc(name) + '</option>';
    }).join('');
  }

  function statusLabel(row) {
    if (row.status === 'removed_early') return 'Հանված ժամանակից շուտ';
    if (row.status === 'expired') return 'Լրացել է';
    if (isPermanent(row.type)) return 'Մշտական գրառում';
    return 'Գործում է';
  }

  function hasPdf(row) {
    return !!(row && (row.hasOrderPdf || row.orderPdfName));
  }

  const GAVEL_ICON = '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 34l16-16"/><path d="M26 14l8 8"/><path d="M12 36h20"/><rect x="28" y="10" width="10" height="6" rx="1" transform="rotate(45 33 13)"/></svg>';

  function renderArchiveCards(rows) {
    if (!rows.length) {
      return '<p class="muted">Արխիվում գրառումներ չկան</p>';
    }
    const canDel = canAdmin();
    return '<div class="kmExamFilesGrid" role="list">' + rows.map((row) => {
      const title = esc(row.personName || '—');
      const metaParts = [
        esc(typeMeta(row.type).label),
        fmtDate(row.archivedAt || row.removedEarlyAt || row.receivedAt)
      ];
      if (row.orderNumber) metaParts.unshift('№' + esc(row.orderNumber));
      if (row.rank) metaParts.push(esc(row.rank));
      if (hasPdf(row)) metaParts.push('PDF');
      const meta = metaParts.join(' · ');
      const del = canDel
        ? ('<button type="button" class="kmLawCardExamDel" onclick="event.stopPropagation();kmDisciplineDeleteArchive(\'' +
            esc(row.id) + '\')" title="Ջնջել արխիվից" aria-label="Ջնջել">×</button>')
        : '';
      const tip = hasPdf(row) ? 'Դիտել PDF հրամանը' : 'PDF հրաման կցված չէ';
      return '<div class="kmLawCardExamWrap" role="listitem" data-km-person="' + esc(row.personName || '') + '">' + del +
        '<button type="button" class="kmLawCard kmLawCardLocal kmLawCardExam kmDiscArchiveCard' +
          (hasPdf(row) ? ' kmDiscHasPdf' : '') + '" title="' + esc(tip) + '" ' +
          'onclick="kmDisciplineViewPdf(\'' + esc(row.id) + '\')">' +
          '<span class="kmLawCardText">' + title + '<span class="kmLawCardMeta">' + meta + '</span></span>' +
          '<span class="kmLawCardIcon" aria-hidden="true">' + GAVEL_ICON + '</span>' +
        '</button></div>';
    }).join('') + '</div>';
  }

  function renderActiveCards(rows, editable) {
    if (!rows.length) {
      return '<p class="muted">Գործող տույժեր չկան</p>';
    }
    return '<div class="kmExamFilesGrid" role="list">' + rows.map((row) => {
      const title = esc(row.personName || '—');
      const exp = isPermanent(row.type) ? 'Մշտական' : fmtDate(row.expiresAt);
      const metaParts = [
        esc(typeMeta(row.type).label),
        'Ստացվել է՝ ' + fmtDate(row.receivedAt),
        'Լրանում՝ ' + exp,
        esc(statusLabel(row))
      ];
      if (row.orderNumber) metaParts.unshift('№' + esc(row.orderNumber));
      if (row.rank) metaParts.push(esc(row.rank));
      if (hasPdf(row)) metaParts.push('PDF');
      const meta = metaParts.join(' · ');
      const early = editable && row.status === 'active'
        ? ('<button type="button" class="kmDiscActiveEarly" onclick="event.stopPropagation();kmDisciplineRemoveEarly(\'' +
            esc(row.id) + '\')" title="Հանել ժամանակից շուտ">Հանել</button>')
        : '';
      const tip = hasPdf(row) ? 'Դիտել PDF հրամանը' : 'PDF հրաման կցված չէ';
      return '<div class="kmLawCardExamWrap" role="listitem" data-km-person="' + esc(row.personName || '') + '">' + early +
        '<button type="button" class="kmLawCard kmLawCardLocal kmLawCardExam kmDiscArchiveCard' +
          (hasPdf(row) ? ' kmDiscHasPdf' : '') + '" title="' + esc(tip) + '" ' +
          'onclick="kmDisciplineViewPdf(\'' + esc(row.id) + '\')">' +
          '<span class="kmLawCardText">' + title + '<span class="kmLawCardMeta">' + meta + '</span></span>' +
          '<span class="kmLawCardIcon" aria-hidden="true">' + GAVEL_ICON + '</span>' +
        '</button></div>';
    }).join('') + '</div>';
  }

  function canAdmin() {
    return typeof window.kmCanAdmin === 'function' ? window.kmCanAdmin() : false;
  }

  function canAdd() {
    if (typeof window.kmCanEditPage === 'function' && window.kmCanEditPage('lawdocs', 'acts_discipline')) return true;
    if (typeof window.kmCanEdit === 'function' && window.kmCanEdit('acts_discipline')) return true;
    return canAdmin();
  }

  function updatePdfLabel() {
    const label = document.getElementById('kmDiscPdfName');
    const clearBtn = document.getElementById('kmDiscPdfClear');
    if (label) label.textContent = pendingPdf ? pendingPdf.name : 'ֆայլ չի ընտրված';
    if (clearBtn) clearBtn.style.display = pendingPdf ? '' : 'none';
  }

  function renderPage(opts) {
    opts = opts || {};
    if (typeof window.kmInjectLibCss === 'function') window.kmInjectLibCss();
    ensureStore();
    syncExpired();
    const back = opts.back || 'kmLawDocsPage()';
    const canEdit = canAdd();
    const canDel = canAdmin();
    const host = document.getElementById('content') || content;
    if (!host) return;
    try { if (typeof window.kmPurgeAccountingIfNoArchive === 'function') window.kmPurgeAccountingIfNoArchive(); } catch (ePur) {}
    /* KM_UNIFIED_ARCHIVE_SOURCE_V1_DISC */
    var __noStaff = false;
    try {
      if (typeof window.kmUnitHasStaffSource === 'function') __noStaff = !window.kmUnitHasStaffSource();
      else if (window.kmUnitArchiveStaffSource && window.kmUnitArchiveStaffSource.hasFormal) __noStaff = !window.kmUnitArchiveStaffSource.hasFormal();
      else if (typeof window.kmUnitHasExcelArchive === 'function') __noStaff = !window.kmUnitHasExcelArchive();
    } catch (eD) { __noStaff = true; }
    if (__noStaff) {
      host.innerHTML =
        '<div class="card kmDiscPenWrap">' +
          '<div class="toolbar" style="margin-bottom:10px">' +
            '<button type="button" onclick="' + back + '">← Վերադարձ</button>' +
          '</div>' +
          (typeof window.kmArchiveRequiredBanner === 'function'
            ? window.kmArchiveRequiredBanner()
            : '<b>Այս զորամասի արխիվում ֆայլ չկա</b>') +
        '</div>';
      return;
    }

    const typeOpts = TYPES.map((t) => '<option value="' + t.id + '">' + esc(t.label) + '</option>').join('');
    const active = (db.disciplinePenalties || []).slice().sort((a, b) => String(b.receivedAt).localeCompare(String(a.receivedAt)));
    const archived = (db.disciplinePenaltiesArchive || []).slice().sort((a, b) => String(b.archivedAt || b.receivedAt).localeCompare(String(a.archivedAt || a.receivedAt)));

    host.innerHTML =
      '<div class="card kmDiscPenWrap">' +
        '<div class="toolbar" style="margin-bottom:10px">' +
          '<button type="button" onclick="' + back + '">← Վերադարձ</button>' +
          '<button type="button" onclick="kmOpenHishoxutyun(\'acts_discipline\')">Հիշողություն</button>' +
        '</div>' +
        '<h3 class="kmLawsHubTitle" style="margin-top:0">ԿԱՐԳԱՊԱՀԱԿԱՆ ՏՈՒՅԺԵՐ</h3>' +
        '<p class="kmLawsHubLead">Խիստ նկատողությունը պահպանվում է <b>6</b> ամիս, նկատողությունը՝ <b>3</b> ամիս։ Պաշտոնի (ան)համապատասխանեցումը գրանցվում է մշտապես՝ ստացման ամսաթվով։ ժամանակից շուտ հանված տույժերը պահվում են արխիվում։ Արխիվում զինծառայողի վրա սեղմելով՝ դիտվում է կցված PDF հրամանը։</p>' +
        (canEdit
          ? '<div class="card" style="margin:0 0 14px;padding:12px;background:#f8fafc">' +
              '<h4 style="margin:0 0 10px">Նոր տույժ</h4>' +
              '<div class="kmDiscFormRow" style="display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end">' +
                '<label style="display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:700">Ա․Ա․Հ․' +
                  '<input id="kmDiscPerson" class="kmDiscEditable" type="text" autocomplete="off" placeholder="որոնել Ա․Ա․Հ․…" ' +
                  'style="min-width:220px;padding:8px;background:#fff;border:1px solid #c8d0d8;border-radius:7px"></label>' +
                '<label style="display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:700">Կոչում' +
                  '<input id="kmDiscRank" class="kmDiscEditable" type="text" autocomplete="off" placeholder="կոչում (ոչ պարտադիր)" ' +
                  'style="min-width:180px;padding:8px;background:#fff;border:1px solid #c8d0d8;border-radius:7px"></label>' +
                '<label style="display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:700">Տույժի տեսակ' +
                  '<select id="kmDiscType" class="kmDiscEditable" style="min-width:240px;padding:8px">' + typeOpts + '</select></label>' +
                '<label style="display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:700" for="kmDiscOrderNo">ՏՈՒՅԺԻ ՀՐԱՄԱՆԻ ՀԱՄԱՐ' +
                  '<input id="kmDiscOrderNo" class="kmDiscEditable" name="kmDiscOrderNo" type="text" inputmode="text" autocomplete="off" ' +
                  'placeholder="օր. 45" spellcheck="false" ' +
                  'style="min-width:160px;padding:8px;background:#fff;border:1px solid #c8d0d8;border-radius:7px;pointer-events:auto;user-select:text"></label>' +
                '<label style="display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:700">Ստացման ամսաթիվ' +
                  '<input id="kmDiscReceived" class="kmDiscEditable" type="date" style="padding:8px"></label>' +
                '<div style="display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:700;min-width:220px">PDF հրաման' +
                  '<div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center">' +
                    '<button type="button" class="kmDiscEditable" onclick="kmDisciplinePickPdf()">Կցել PDF</button>' +
                    '<span id="kmDiscPdfName" class="muted" style="font-weight:600;font-size:12px">ֆայլ չի ընտրված</span>' +
                    '<button type="button" id="kmDiscPdfClear" class="kmDiscEditable" style="display:none" onclick="kmDisciplineClearPdf()" title="Հանել">×</button>' +
                  '</div>' +
                '</div>' +
                '<button type="button" class="primary" onclick="kmDisciplineAdd()">＋ Ավելացնել</button>' +
              '</div>' +
            '</div>'
          : '') +
        '<div class="kmPersonListSearch"><input id="kmDiscListQ" class="kmDossierEditable" type="search" placeholder="Որոնում ցանկում (Ա․Ա․Հ․)…" oninput="kmFilterPersonCards(\'.kmDiscPenWrap\', this.value)"></div>' +
        '<h4 style="margin:0 0 8px">Գործող տույժեր</h4>' +
        renderActiveCards(active, canDel) +
        '<details style="margin-top:16px"' + (archived.length ? ' open' : '') + '>' +
          '<summary><b>Արխիվ</b> (' + archived.length + ')</summary>' +
          '<div style="margin-top:10px">' + renderArchiveCards(archived) + '</div>' +
        '</details>' +
      '</div>';

    const recv = document.getElementById('kmDiscReceived');
    if (recv && !recv.value) recv.value = new Date().toISOString().slice(0, 10);
    try { document.body.classList.remove('km-boot-idle'); } catch (e0) {}
    if (typeof window.kmApplyRoleGuard === 'function') window.kmApplyRoleGuard();
    unlockDiscForm();
    updatePdfLabel();
    if (typeof window.kmAttachPersonSearch === 'function') {
      window.kmAttachPersonSearch('kmDiscPerson', { rankId: 'kmDiscRank', personnelOnly: true });
    }
    if (typeof window.kmDossierUnlockForm === 'function') window.kmDossierUnlockForm();
    if (opts.personName || window._kmLawSubPerson) {
      var pName = String(opts.personName || window._kmLawSubPerson || '').trim();
      var pRank = String(opts.rank || window._kmLawSubRank || '').trim();
      var pEl = document.getElementById('kmDiscPerson');
      var rEl = document.getElementById('kmDiscRank');
      if (pEl && pName) pEl.value = pName;
      if (rEl && pRank) rEl.value = pRank;
      var qEl = document.getElementById('kmDiscListQ');
      if (qEl && pName) {
        qEl.value = pName;
        if (typeof window.kmFilterPersonCards === 'function') {
          window.kmFilterPersonCards('.kmDiscPenWrap', pName);
        }
      }
    }
  }

  function unlockDiscForm() {
    if (window.kmUserRole === 'viewer') return;
    if (typeof window.kmUserViewOnly === 'function' && window.kmUserViewOnly()) return;
    if (typeof window.kmCanEditPage === 'function' && !window.kmCanEditPage('lawdocs', 'acts_discipline')) return;
    const orderEl = document.getElementById('kmDiscOrderNo');
    if (orderEl) {
      orderEl.disabled = false;
      orderEl.readOnly = false;
      orderEl.removeAttribute('readonly');
      orderEl.removeAttribute('disabled');
      try { orderEl.style.pointerEvents = 'auto'; } catch (e) {}
    }
    document.querySelectorAll('.kmDiscEditable').forEach(function (el) {
      el.disabled = false;
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        el.readOnly = false;
        el.removeAttribute('readonly');
      }
      el.removeAttribute('disabled');
    });
  }
  window.kmDisciplineUnlockForm = unlockDiscForm;

  function findPenaltyRow(id) {
    ensureStore();
    const sid = String(id);
    return (db.disciplinePenalties || []).find((x) => String(x.id) === sid) ||
      (db.disciplinePenaltiesArchive || []).find((x) => String(x.id) === sid) ||
      null;
  }

  async function removeStoredPdf(id) {
    if (!id || !window.kmNative || !window.kmNative.discipline || !window.kmNative.discipline.removePdf) return;
    try { await window.kmNative.discipline.removePdf({ id: String(id) }); } catch (e) {}
  }

  window.kmDisciplinePenaltiesPage = function (opts) {
    if (window.kmUserRole === 'editor' && Array.isArray(window.kmEditSections)) {
      var okD = typeof window.kmSectionGranted === 'function' && (window.kmSectionGranted('acts_discipline') || window.kmSectionGranted('lawdocs'));
      if (!okD) {
        if (typeof toast === 'function') toast('Այս բաժինը ձեզ թույլատրված չէ', 'error');
        return;
      }
    }
    opts = opts || {};
    window._kmLawSubPage = 'acts_discipline'; /* KM_GRANTS_EDIT_MODE_V1 */
    opts.back = typeof window.kmLawSubResolveBack === 'function'
      ? window.kmLawSubResolveBack(opts)
      : (opts.back || 'kmLawDocsPage()');
    window._kmDiscBack = opts.back;
    window._kmLawSubNavBack = opts.back;
    if (opts.personName) window._kmLawSubPerson = opts.personName;
    else if (opts.back !== 'kmLawSubBackToPersonCard()') window._kmLawSubPerson = '';
    if (opts.rank) window._kmLawSubRank = opts.rank;
    else if (opts.back !== 'kmLawSubBackToPersonCard()') window._kmLawSubRank = '';
    if (typeof page !== 'undefined') page = 'lawdocs';
    window.page = 'lawdocs';
    const pt = document.getElementById('pageTitle');
    if (pt) pt.textContent = 'Կարգապահական տույժեր';
    pendingPdf = null;
    renderPage({ back: window._kmDiscBack, personName: opts.personName, rank: opts.rank });
  };

  window.kmDisciplinePersonPick = function () {
    unlockDiscForm();
  };

  window.kmDisciplinePickPdf = function () {
    if (!canAdd()) {
      if (typeof toast === 'function') toast('Դիտորդի իրավունք', 'error');
      return;
    }
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.pdf,application/pdf';
    inp.onchange = async function () {
      const f = inp.files && inp.files[0];
      if (!f) return;
      if (!/\.pdf$/i.test(f.name || '')) {
        if (typeof toast === 'function') toast('Միայն PDF ֆայլ', 'warn');
        return;
      }
      if (f.size > 25 * 1024 * 1024) {
        if (typeof toast === 'function') toast('PDF ֆայլը չափազանց մեծ է (մինչև 25 ՄԲ)', 'warn');
        return;
      }
      try {
        const bytes = Array.from(new Uint8Array(await f.arrayBuffer()));
        if (bytes.length < 5 || String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3], bytes[4]) !== '%PDF-') {
          if (typeof toast === 'function') toast('Անվավեր PDF ֆայլ', 'warn');
          return;
        }
        pendingPdf = { name: f.name, bytes: bytes };
        updatePdfLabel();
        if (typeof toast === 'function') toast('PDF-ը պատրաստ է կցման');
      } catch (e) {
        if (typeof toast === 'function') toast(e.message || String(e), 'error');
      }
    };
    inp.click();
  };

  window.kmDisciplineClearPdf = function () {
    pendingPdf = null;
    updatePdfLabel();
  };

  window.kmDisciplineViewPdf = async function (id) {
    const row = findPenaltyRow(id);
    if (!row) {
      if (typeof toast === 'function') toast('Գրառումը չի գտնվել', 'error');
      return;
    }
    if (!hasPdf(row)) {
      if (typeof toast === 'function') toast('PDF հրաման կցված չէ', 'warn');
      return;
    }
    if (!window.kmNative || !window.kmNative.discipline || !window.kmNative.discipline.readPdf) {
      if (typeof toast === 'function') toast('Միայն desktop KM', 'error');
      return;
    }
    try {
      const r = await window.kmNative.discipline.readPdf({
        id: String(row.id),
        name: row.orderPdfName || ((row.personName || 'hraman') + '.pdf')
      });
      if (!r || !r.ok) {
        if (typeof toast === 'function') toast((r && r.message) || 'PDF-ը չի գտնվել', 'error');
        return;
      }
      const title = ((row.personName || '') + (row.orderNumber ? (' · №' + row.orderNumber) : '')) || r.name || 'Հրաման';
      if (typeof window.kmLawsShowDocViewer === 'function') {
        window.kmLawsShowDocViewer(title, r.mime || 'application/pdf', { base64: r.base64 });
      } else if (window.kmNative.shell && window.kmNative.shell.openPath && r.path) {
        await window.kmNative.shell.openPath(r.path);
      } else {
        if (typeof toast === 'function') toast('Դիտիչը հասանելի չէ', 'error');
      }
    } catch (e) {
      if (typeof toast === 'function') toast(e.message || String(e), 'error');
    }
  };

  window.kmDisciplineAdd = async function () {
    if (!canAdd()) {
      if (typeof toast === 'function') toast('Դիտորդի իրավունք', 'error');
      return;
    }
    ensureStore();
    const personEl = document.getElementById('kmDiscPerson');
    const rankEl = document.getElementById('kmDiscRank');
    const typeEl = document.getElementById('kmDiscType');
    const orderEl = document.getElementById('kmDiscOrderNo');
    const recvEl = document.getElementById('kmDiscReceived');
    const personName = personEl ? String(personEl.value || '').trim() : '';
    const rank = rankEl ? String(rankEl.value || '').trim() : '';
    const type = typeEl ? String(typeEl.value || '').trim() : '';
    const orderNumber = orderEl ? String(orderEl.value || '').trim() : '';
    const receivedAt = recvEl ? String(recvEl.value || '').trim() : '';
    if (!personName) {
      if (typeof toast === 'function') toast('Գրեք Ա․Ա․Հ․', 'warn');
      return;
    }
    if (!parseDate(receivedAt)) {
      if (typeof toast === 'function') toast('Ստացման ամսաթիվը սխալ է', 'warn');
      return;
    }
    const id = 'dp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    let orderPdfName = '';
    let hasOrderPdf = false;
    if (pendingPdf && pendingPdf.bytes && pendingPdf.bytes.length) {
      if (!window.kmNative || !window.kmNative.discipline || !window.kmNative.discipline.savePdf) {
        if (typeof toast === 'function') toast('PDF պահպանումը հասանելի չէ', 'error');
        return;
      }
      try {
        const saved = await window.kmNative.discipline.savePdf({
          id: id,
          name: pendingPdf.name || 'hraman.pdf',
          bytes: pendingPdf.bytes
        });
        if (!saved || !saved.ok) {
          if (typeof toast === 'function') toast('PDF-ը չպահպանվեց', 'error');
          return;
        }
        orderPdfName = pendingPdf.name || saved.name || 'hraman.pdf';
        hasOrderPdf = true;
      } catch (e) {
        if (typeof toast === 'function') toast(e.message || String(e), 'error');
        return;
      }
    }
    const row = {
      id: id,
      personName,
      rank,
      type,
      orderNumber,
      receivedAt,
      expiresAt: computeExpiresAt(type, receivedAt),
      status: 'active',
      removedEarlyAt: null,
      archivedAt: null,
      hasOrderPdf: hasOrderPdf,
      orderPdfName: orderPdfName
    };
    db.disciplinePenalties.push(row);
    pendingPdf = null;
    if (typeof window.kmHishoxutyunLog === 'function') {
      window.kmHishoxutyunLog({
        section: 'acts_discipline',
        sectionLabel: 'Կարգապահական տույժեր',
        action: 'add',
        detail: 'Ավելացրել է տույժ՝ ' + personName +
          (rank ? (' · կոչում՝ ' + rank) : '') +
          (type ? (' · ' + type) : '') +
          (orderNumber ? (' · հրաման №' + orderNumber) : '') +
          (receivedAt ? (' · ' + receivedAt) : '') +
          (orderPdfName ? (' · PDF՝ ' + orderPdfName) : '')
      });
    }
    if (typeof save === 'function') await save(true);
    if (typeof toast === 'function') toast(hasOrderPdf ? 'Տույժը և PDF հրամանը ավելացվեցին' : 'Տույժը ավելացվեց');
    renderPage({ back: window._kmDiscBack || 'kmLawDocsPage()' });
  };

  window.kmDisciplineRemoveEarly = async function (id) {
    if (!canAdmin()) {
      if (typeof toast === 'function') toast('Միայն ադմինիստրատոր', 'error');
      return;
    }
    ensureStore();
    const row = (db.disciplinePenalties || []).find((x) => String(x.id) === String(id));
    if (!row) return;
    if (!confirm('Հանե՞լ «' + row.personName + '»-ի տույժը ժամանակից շուտ և պահել արխիվում։')) return;
    row.status = 'removed_early';
    row.removedEarlyAt = new Date().toISOString().slice(0, 10);
    row.archivedAt = new Date().toISOString();
    db.disciplinePenalties = db.disciplinePenalties.filter((x) => String(x.id) !== String(id));
    db.disciplinePenaltiesArchive.unshift(row);
    if (typeof window.kmHishoxutyunLog === 'function') {
      window.kmHishoxutyunLog({
        section: 'acts_discipline',
        sectionLabel: 'Կարգապահական տույժեր',
        action: 'remove',
        detail: 'Հանել է տույժը ժամանակից շուտ՝ ' + (row.personName || '') +
          (row.type ? (' · ' + row.type) : '')
      });
    }
    if (typeof save === 'function') await save(true);
    if (typeof toast === 'function') toast('Տույժը արխիվացվեց');
    renderPage({ back: window._kmDiscBack || 'kmLawDocsPage()' });
  };

  window.kmDisciplineDeleteArchive = async function (id) {
    if (!canAdmin()) {
      if (typeof toast === 'function') toast('Միայն ադմինիստրատոր', 'error');
      return;
    }
    ensureStore();
    const row = (db.disciplinePenaltiesArchive || []).find((x) => String(x.id) === String(id));
    if (!row) return;
    const label = typeMeta(row.type).label;
    if (!confirm('Ջնջե՞լ «' + (row.personName || '') + '»-ի «' + label + '» գրառումը արխիվից։')) return;
    db.disciplinePenaltiesArchive = (db.disciplinePenaltiesArchive || []).filter((x) => String(x.id) !== String(id));
    await removeStoredPdf(id);
    if (typeof window.kmHishoxutyunLog === 'function') {
      window.kmHishoxutyunLog({
        section: 'acts_discipline',
        sectionLabel: 'Կարգապահական տույժեր',
        action: 'delete',
        detail: 'Ջնջել է տույժը արխիվից՝ ' + (row.personName || '') + (label ? (' · ' + label) : '')
      });
    }
    if (typeof save === 'function') await save(true);
    if (typeof toast === 'function') toast('Արխիվից ջնջվեց');
    renderPage({ back: window._kmDiscBack || 'kmLawDocsPage()' });
  };
  window.kmDisciplineSyncExpired = syncExpired;
})();
