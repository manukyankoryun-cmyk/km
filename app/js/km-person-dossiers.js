/* KM — Բնութագիր և Խրախուսանքներ (admin ավելացնում է զինծառայող + PDF) */
(function () {
  'use strict';

  const PERSON_ICON = '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2"><circle cx="24" cy="16" r="6"/><path d="M10 40c2-10 8-14 14-14s12 4 14 14"/></svg>';
  const STAR_ICON = '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2"><path d="M24 8l4.5 9.5L39 19l-7.5 7 2 10.5L24 31l-9.5 5.5 2-10.5L9 19l10.5-1.5L24 8z"/></svg>';

  let pendingCharPdf = null;
  let pendingEncPdf = null;

  function esc(s) {
    return typeof window.esc === 'function' ? window.esc(s) : String(s ?? '');
  }

  function canAdmin() {
    return typeof window.kmCanAdmin === 'function' ? window.kmCanAdmin() : false;
  }

  function canAdd(section) {
    var sec = String(section || window._kmLawSubPage || '').trim();
    if (sec) {
      if (typeof window.kmCanEditPage === 'function' && window.kmCanEditPage('lawdocs', sec)) return true;
      if (typeof window.kmCanEdit === 'function') return window.kmCanEdit(sec);
    }
    return typeof window.kmCanEdit === 'function' ? window.kmCanEdit() : canAdmin();
  }

  function ensureStore() {
    if (typeof db === 'undefined') return;
    if (!db.personCharacteristics || typeof db.personCharacteristics !== 'object' || Array.isArray(db.personCharacteristics)) {
      db.personCharacteristics = {};
    }
    if (!Array.isArray(db.personEncouragements)) db.personEncouragements = [];
    if (!Array.isArray(db.monthSummaries)) db.monthSummaries = [];
    migrateCharacteristicKeys();
  }

  function personKey(name) {
    const raw = String(name || '').trim().toLowerCase();
    let h = 0;
    for (let i = 0; i < raw.length; i++) h = ((h << 5) - h + raw.charCodeAt(i)) | 0;
    return 'pk_' + (h >>> 0).toString(16);
  }
  window.kmPersonDocKey = personKey;

  function personDocFileId(keyOrName) {
    const key = String(keyOrName || '').trim();
    if (/^pk_[0-9a-f]+$/i.test(key)) return key.toLowerCase();
    return personKey(key);
  }

  function personDocFileIdLegacy(name) {
    const raw = String(name || '').trim().toLowerCase();
    let h = 0;
    for (let i = 0; i < raw.length; i++) h = ((h << 5) - h + raw.charCodeAt(i)) | 0;
    const hex = (h >>> 0).toString(16);
    const slug = raw.replace(/[^a-z0-9\u0531-\u0556\u0561-\u0587]+/gi, '_').replace(/^_+|_+$/g, '').slice(0, 40);
    const oldKey = ('pk_' + hex + (slug ? '_' + slug : '')).slice(0, 80);
    return oldKey.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 96);
  }

  function migrateCharacteristicKeys() {
    if (!db || !db.personCharacteristics || typeof db.personCharacteristics !== 'object') return;
    const src = db.personCharacteristics;
    const next = {};
    let moved = false;
    Object.keys(src).forEach(function (k) {
      const rec = src[k];
      if (!rec || typeof rec !== 'object') return;
      const nk = personKey(rec.personName || k);
      if (!next[nk] || String(rec.updatedAt || '') >= String((next[nk] && next[nk].updatedAt) || '')) {
        next[nk] = Object.assign({}, rec);
      }
      if (k !== nk) moved = true;
    });
    if (moved || Object.keys(next).length !== Object.keys(src).length) {
      db.personCharacteristics = next;
    }
  }

  /* ---- Shared Ա․Ա․Հ․ search across personnel + other sections ---- */
  function kmPsEsc(s) {
    return typeof window.esc === 'function'
      ? window.esc(s)
      : String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
          return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m];
        });
  }

  window.kmCollectServiceMembers = function () {
    var map = Object.create(null);
    function add(name, rank, unit, src) {
      name = String(name || '').trim();
      if (!name) return;
      var key = name.toLowerCase();
      var cur = map[key];
      if (!cur) {
        map[key] = { name: name, rank: String(rank || '').trim(), unit: String(unit || '').trim(), src: src || '' };
        return;
      }
      if (!cur.rank && rank) cur.rank = String(rank).trim();
      if (!cur.unit && unit) cur.unit = String(unit).trim();
    }
    if (typeof db === 'undefined') return [];
    try { (db.people || []).forEach(function (p) { if (p) add(p.name, p.rank, p.unit, 'Անձնակազմ'); }); } catch (e1) {}
    try {
      ((((db.troopStructure || {}).staff || {}).rows) || []).forEach(function (r) {
        if (r) add(r.name, r.rank, r.unit, 'Շտատկա');
      });
    } catch (e2) {}
    try { (db.vacations || []).forEach(function (v) { if (v) add(v.person, '', '', 'Արձակուրդ'); }); } catch (e3) {}
    try { Object.keys(db.unitDossiers || {}).forEach(function (n) { add(n, '', '', 'Քարտադարան'); }); } catch (e4) {}
    try {
      (db.disciplinePenalties || []).concat(db.disciplinePenaltiesArchive || []).forEach(function (r) {
        if (r) add(r.personName, r.rank, '', 'Տույժ');
      });
    } catch (e5) {}
    try {
      Object.keys(db.personCharacteristics || {}).forEach(function (k) {
        var row = db.personCharacteristics[k];
        if (row) add(row.personName, row.rank, '', 'Բնութագիր');
      });
    } catch (e6) {}
    try {
      (db.personEncouragements || []).forEach(function (r) {
        if (r) add(r.personName, r.rank, '', 'Խրախուսանք');
      });
    } catch (e7) {}
    try { (db.unitMedical || []).forEach(function (r) { if (r) add(r.person, '', '', 'Բուժկետ'); }); } catch (e8) {}
    try { (db.unitDocs || []).forEach(function (r) { if (r) add(r.person, '', '', 'Փաստաթուղթ'); }); } catch (e9) {}
    try {
      ((((db.unitLeavePlan || {}).rows) || [])).forEach(function (r) {
        if (r) add(r.person, '', '', 'Արձակուրդային պլան');
      });
    } catch (e10) {}
    return Object.keys(map).map(function (k) { return map[k]; }).sort(function (a, b) {
      return a.name.localeCompare(b.name, 'hy');
    });
  };

  /** Միայն Անձնակազմ / Պաշտոն ցուցակի անուններ */
  window.kmPersonnelRosterNames = function () {
    var list = [];
    try {
      if (typeof window.kmPeopleRoster === 'function') list = window.kmPeopleRoster() || [];
      else if (typeof db !== 'undefined' && Array.isArray(db.people)) list = db.people;
    } catch (e0) {
      if (typeof db !== 'undefined' && Array.isArray(db.people)) list = db.people;
    }
    var out = [];
    var seen = Object.create(null);
    (list || []).forEach(function (p) {
      if (!p || p.blocked) return;
      var name = String(p.name || '').trim();
      if (!name) return;
      var key = name.toLowerCase();
      if (seen[key]) return;
      seen[key] = 1;
      out.push({
        name: name,
        rank: String(p.rank || '').trim(),
        unit: String(p.unit || '').trim(),
        src: 'Անձնակազմ'
      });
    });
    out.sort(function (a, b) {
      return String(a.name || '').localeCompare(String(b.name || ''), 'hy');
    });
    return out;
  };

  /** opts.personnelOnly — միայն Անձնակազմ բաժնի անվանացուցակ */
  window.kmPersonSearchMatch = function (q, limit, opts) {
    q = String(q || '').trim().toLowerCase();
    limit = limit || 14;
    opts = opts || {};
    var all = opts.personnelOnly
      ? (typeof window.kmPersonnelRosterNames === 'function' ? window.kmPersonnelRosterNames() : [])
      : window.kmCollectServiceMembers();
    if (!q) return all.slice(0, limit);
    var out = [];
    for (var i = 0; i < all.length; i++) {
      var p = all[i];
      var hay = (p.name + ' ' + (p.rank || '') + ' ' + (p.unit || '')).toLowerCase();
      if (hay.indexOf(q) >= 0) {
        out.push(p);
        if (out.length >= limit) break;
      }
    }
    return out;
  };

  window.kmAttachPersonSearch = function (inputOrId, opts) {
    opts = opts || {};
    var input = typeof inputOrId === 'string' ? document.getElementById(inputOrId) : inputOrId;
    if (!input || input.__kmPersonSearch) return;
    input.__kmPersonSearch = true;
    input.setAttribute('autocomplete', 'off');
    if (!input.getAttribute('placeholder')) {
      input.setAttribute('placeholder', opts.placeholder ||
        (opts.personnelOnly ? 'որոնել Ա․Ա․Հ․ — Անձնակազմից…' : 'որոնել Ա․Ա․Հ․…'));
    }
    input.classList.add('kmPersonSearchInput');

    var wrap = document.createElement('div');
    wrap.className = 'kmPersonSearchWrap';
    if (!input.parentNode) return;
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);

    var drop = document.createElement('div');
    drop.className = 'kmPersonSearchDrop';
    drop.hidden = true;
    wrap.appendChild(drop);

    function hide() { drop.hidden = true; drop.innerHTML = ''; }

    function pick(row) {
      input.value = row.name || '';
      hide();
      if (opts.rankId) {
        var rankEl = document.getElementById(opts.rankId);
        if (rankEl && row.rank && !String(rankEl.value || '').trim()) rankEl.value = row.rank;
      }
      if (typeof opts.onPick === 'function') opts.onPick(row);
      try { input.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
    }

    function paint() {
      var rows = window.kmPersonSearchMatch(input.value, opts.limit || 14, opts);
      if (!rows.length) {
        drop.innerHTML = '<div class="kmPersonSearchEmpty">Համընկնում չկա</div>';
        drop.hidden = false;
        return;
      }
      drop.innerHTML = rows.map(function (r, i) {
        var meta = [r.rank, r.unit, r.src].filter(Boolean).join(' · ');
        return '<button type="button" class="kmPersonSearchItem" data-i="' + i + '">' +
          '<b>' + kmPsEsc(r.name) + '</b>' +
          (meta ? '<span class="muted">' + kmPsEsc(meta) + '</span>' : '') +
          '</button>';
      }).join('');
      drop.hidden = false;
      drop.querySelectorAll('.kmPersonSearchItem').forEach(function (btn) {
        btn.onmousedown = function (ev) {
          ev.preventDefault();
          pick(rows[Number(btn.getAttribute('data-i'))]);
        };
      });
    }

    input.addEventListener('focus', paint);
    input.addEventListener('input', paint);
    input.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') hide();
      if (ev.key === 'Enter' && !drop.hidden) {
        var first = drop.querySelector('.kmPersonSearchItem');
        if (first) {
          ev.preventDefault();
          first.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        }
      }
    });
    input.addEventListener('blur', function () { setTimeout(hide, 160); });
  };

  window.kmFilterPersonCards = function (root, q) {
    root = typeof root === 'string' ? document.querySelector(root) : root;
    if (!root) return;
    q = String(q || '').trim().toLowerCase();
    root.querySelectorAll('[data-km-person]').forEach(function (el) {
      var name = String(el.getAttribute('data-km-person') || '').toLowerCase();
      el.style.display = !q || name.indexOf(q) >= 0 ? '' : 'none';
    });
  };

  (function injectPersonSearchCss() {
    if (document.getElementById('km-person-search-css')) return;
    var s = document.createElement('style');
    s.id = 'km-person-search-css';
    s.textContent =
      '.kmPersonSearchWrap{position:relative;display:block;min-width:220px}' +
      '.kmPersonSearchWrap .kmPersonSearchInput{width:100%;min-width:220px;box-sizing:border-box}' +
      '.kmPersonSearchDrop{position:absolute;left:0;right:0;top:100%;z-index:80;margin-top:4px;max-height:260px;overflow:auto;background:#fff;border:1px solid #c8d0d8;border-radius:8px;box-shadow:0 10px 28px rgba(15,23,42,.14)}' +
      '.kmPersonSearchItem{display:flex;flex-direction:column;align-items:flex-start;gap:2px;width:100%;padding:8px 10px;border:0;border-bottom:1px solid #eef2f6;background:#fff;text-align:left;cursor:pointer;font:inherit}' +
      '.kmPersonSearchItem:hover,.kmPersonSearchItem:focus{background:#f0f7fb}' +
      '.kmPersonSearchItem b{font-size:13px;color:#0d4a66}' +
      '.kmPersonSearchItem .muted{font-size:11px;font-weight:600}' +
      '.kmPersonSearchEmpty{padding:10px;font-size:12px;color:#667788}' +
      '.kmPersonListSearch{margin:0 0 12px;display:flex;flex-wrap:wrap;gap:8px;align-items:center}' +
      '.kmPersonListSearch input{min-width:240px;padding:8px 10px;border:1px solid #c8d0d8;border-radius:7px;background:#fff}';
    (document.head || document.documentElement).appendChild(s);
  })();


  function peopleOptions(selected) {
    const list = (typeof window.kmPeopleRoster === 'function')
      ? (window.kmPeopleRoster() || [])
      : (Array.isArray(db && db.people) ? db.people : []);
    return list.map((p) => {
      const name = String(p.name || '').trim();
      if (!name) return '';
      const sel = name === selected ? ' selected' : '';
      return '<option value="' + esc(name) + '" data-rank="' + esc(String(p.rank || '')) + '"' + sel + '>' + esc(name) + '</option>';
    }).join('');
  }

  function findPerson(name) {
    const roster = (typeof window.kmPeopleRoster === 'function')
      ? (window.kmPeopleRoster() || [])
      : (Array.isArray(db && db.people) ? db.people : []);
    const n = String(name || '').trim();
    const p = roster.find((x) => String(x.name || '').trim() === n)
      || (Array.isArray(db && db.people) ? db.people : []).find((x) => String(x.name || '').trim() === n);
    return { name: n, rank: p ? String(p.rank || '').trim() : '' };
  }

  function fmtDate(d) {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString('hy-AM'); } catch (e) { return String(d).slice(0, 10); }
  }

  function injectCss() {
    if (document.getElementById('km-person-dossier-css')) return;
    if (typeof window.kmInjectLibCss === 'function') window.kmInjectLibCss();
    const s = document.createElement('style');
    s.id = 'km-person-dossier-css';
    s.textContent =
      '.kmDossierMeta{display:block;margin-top:8px;font-size:11px;font-weight:600;color:#5a6b78;text-transform:none;letter-spacing:0}' +
      '.kmDossierCard .kmLawCardText{text-transform:none;font-size:13px;font-weight:700;line-height:1.35}' +
      '.kmDossierForm{display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;margin:0 0 14px;padding:12px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8ef}' +
      '.kmDossierForm label{display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:700}' +
      '.kmDossierForm input,.kmDossierForm textarea,.kmDossierForm select{padding:8px;min-width:160px;border:1px solid #c8d0d8;border-radius:7px;background:#fff}' +
      '.kmDossierForm textarea{min-width:220px;min-height:64px}' +
      '.kmDossierForm .primary{padding:8px 14px;font-weight:700}' +
      '.kmDossierActions{display:flex;flex-wrap:wrap;gap:6px;align-items:center}';
    document.head.appendChild(s);
  }

  async function savePdf(kind, id, name, bytes) {
    if (!window.kmNative || !window.kmNative.personDoc || !window.kmNative.personDoc.savePdf) {
      throw new Error('PDF պահպանումը հասանելի չէ');
    }
    return window.kmNative.personDoc.savePdf({ kind: kind, id: personDocFileId(id), name: name, bytes: bytes });
  }

  async function readPdf(kind, id, name, legacyName) {
    if (!window.kmNative || !window.kmNative.personDoc || !window.kmNative.personDoc.readPdf) {
      throw new Error('Միայն desktop KM');
    }
    const docId = personDocFileId(id);
    let r = await window.kmNative.personDoc.readPdf({ kind: kind, id: docId, name: name || (docId + '.pdf') });
    if ((!r || !r.ok) && legacyName) {
      const legacy = personDocFileIdLegacy(legacyName);
      if (legacy && legacy !== docId) {
        r = await window.kmNative.personDoc.readPdf({ kind: kind, id: legacy, name: name || (legacy + '.pdf') });
      }
    }
    return r;
  }

  async function removePdf(kind, id) {
    if (!window.kmNative || !window.kmNative.personDoc || !window.kmNative.personDoc.removePdf) return;
    try { await window.kmNative.personDoc.removePdf({ kind: kind, id: personDocFileId(id) }); } catch (e) {}
  }

  async function viewPdf(kind, id, title, fileName, legacyName) {
    try {
      const r = await readPdf(kind, id, fileName, legacyName);
      if (!r || !r.ok) {
        if (typeof toast === 'function') toast((r && r.message) || 'PDF կցված չէ', 'warn');
        return;
      }
      if (typeof window.kmLawsShowDocViewer === 'function') {
        window.kmLawsShowDocViewer(title || r.name || 'Փաստաթուղթ', r.mime || 'application/pdf', { base64: r.base64 });
      } else if (typeof toast === 'function') {
        toast('Դիտիչը հասանելի չէ', 'error');
      }
    } catch (e) {
      if (typeof toast === 'function') toast(e.message || String(e), 'error');
    }
  }

  function pickPdfFile() {
    return new Promise(async function (resolve) {
      if (window.kmNative && window.kmNative.file && window.kmNative.file.pickOpen) {
        try {
          const r = await window.kmNative.file.pickOpen({
            title: 'Ընտրել PDF',
            filters: [{ name: 'PDF', extensions: ['pdf'] }]
          });
          if (!r || r.cancelled || !r.ok || !r.bytes) { resolve(null); return; }
          const name = String(r.name || 'document.pdf');
          if (!/\.pdf$/i.test(name)) {
            if (typeof toast === 'function') toast('Միայն PDF ֆայլ', 'warn');
            resolve(null);
            return;
          }
          const bytes = Array.isArray(r.bytes) ? r.bytes : Array.from(new Uint8Array(r.bytes));
          if (bytes.length < 5 || String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3], bytes[4]) !== '%PDF-') {
            if (typeof toast === 'function') toast('Անվավեր PDF ֆայլ', 'warn');
            resolve(null);
            return;
          }
          resolve({ name: name, bytes: bytes });
          return;
        } catch (e) {
          if (typeof toast === 'function') toast(e.message || String(e), 'error');
          resolve(null);
          return;
        }
      }
      const inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = '.pdf,application/pdf';
      inp.onchange = async function () {
        const f = inp.files && inp.files[0];
        if (!f) { resolve(null); return; }
        if (!/\.pdf$/i.test(f.name || '')) {
          if (typeof toast === 'function') toast('Միայն PDF ֆայլ', 'warn');
          resolve(null);
          return;
        }
        if (f.size > 25 * 1024 * 1024) {
          if (typeof toast === 'function') toast('PDF ֆայլը չափազանց մեծ է (մինչև 25 ՄԲ)', 'warn');
          resolve(null);
          return;
        }
        try {
          const bytes = Array.from(new Uint8Array(await f.arrayBuffer()));
          if (bytes.length < 5 || String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3], bytes[4]) !== '%PDF-') {
            if (typeof toast === 'function') toast('Անվավեր PDF ֆայլ', 'warn');
            resolve(null);
            return;
          }
          resolve({ name: f.name, bytes: bytes });
        } catch (e) {
          if (typeof toast === 'function') toast(e.message || String(e), 'error');
          resolve(null);
        }
      };
      inp.click();
    });
  }

  /* ——— Բնութագիր ——— */

  function charList() {
    ensureStore();
    return Object.keys(db.personCharacteristics || {}).map(function (key) {
      const rec = db.personCharacteristics[key];
      if (!rec || typeof rec !== 'object') return null;
      return Object.assign({ key: key }, rec);
    }).filter(Boolean).sort(function (a, b) {
      return String(a.personName || '').localeCompare(String(b.personName || ''), 'hy');
    });
  }

  function renderCharacteristicCards(rows) {
    if (!rows.length) return '<p class="muted">Բնութագրեր դեռ չկան</p>';
    const canDel = canAdmin();
    return '<div class="kmExamFilesGrid" role="list">' + rows.map(function (row) {
      const title = esc(row.personName || '—');
      const metaParts = [];
      if (row.rank) metaParts.push(esc(row.rank));
      metaParts.push(row.hasPdf ? 'PDF կցված է' : 'PDF չկա');
      if (row.updatedAt) metaParts.push(fmtDate(row.updatedAt));
      const meta = metaParts.join(' · ');
      const del = canDel
        ? ("<button type=\"button\" class=\"kmLawCardExamDel\" onclick='event.stopPropagation();kmCharacteristicDelete(" +
            JSON.stringify(row.personName) + ")' title=\"Ջնջել\" aria-label=\"Ջնջել\">×</button>")
        : '';
      const tip = row.hasPdf ? 'Դիտել բնութագրի PDF-ը' : (row.note ? esc(row.note) : 'PDF կցված չէ');
      return '<div class="kmLawCardExamWrap" role="listitem" data-km-person="' + esc(row.personName || '') + '">' + del +
        "<button type=\"button\" class=\"kmLawCard kmLawCardLocal kmLawCardExam kmDossierCard kmDiscArchiveCard\" title=\"" + esc(tip) + "\" " +
        "onclick='kmCharacteristicViewPdf(" + JSON.stringify(row.personName) + ")'>" +
        '<span class="kmLawCardText">' + title + '<span class="kmDossierMeta">' + meta + '</span></span>' +
        '<span class="kmLawCardIcon" aria-hidden="true">' + PERSON_ICON + '</span>' +
        '</button></div>';
    }).join('') + '</div>';
  }

  function prefillLawPerson(prefix, opts) {
    opts = opts || {};
    var name = String(opts.personName || window._kmLawSubPerson || '').trim();
    var rank = String(opts.rank || window._kmLawSubRank || '').trim();
    var pEl = document.getElementById(prefix + 'Person');
    var rEl = document.getElementById(prefix + 'Rank');
    if (pEl && name) pEl.value = name;
    if (rEl && rank) rEl.value = rank;
    if (name) {
      var qEl = document.getElementById(prefix.replace(/^kmDisc$/, 'kmDisc') + 'ListQ');
      if (prefix === 'kmChar') qEl = document.getElementById('kmCharListQ');
      if (prefix === 'kmEnc') qEl = document.getElementById('kmEncListQ');
      if (prefix === 'kmDisc') qEl = document.getElementById('kmDiscListQ');
      if (qEl) {
        qEl.value = name;
        if (typeof window.kmFilterPersonCards === 'function') {
          window.kmFilterPersonCards('.kmDiscPenWrap', name);
        }
      }
    }
  }

  window.kmDossierUnlockForm = function () {
    if (window.kmUserRole === 'viewer') return;
    if (typeof window.kmUserViewOnly === 'function' && window.kmUserViewOnly()) return;
    var sub = String(window._kmLawSubPage || '');
    if (sub && typeof window.kmCanEditPage === 'function' && !window.kmCanEditPage('lawdocs', sub)) return;
    document.querySelectorAll('.kmDossierEditable, .kmDossierForm input, .kmDossierForm textarea, .kmDossierForm select, .kmDossierForm button').forEach(function (el) {
      el.disabled = false;
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        el.readOnly = false;
        el.removeAttribute('readonly');
      }
      el.removeAttribute('disabled');
      try { el.style.pointerEvents = 'auto'; } catch (e) {}
    });
    document.querySelectorAll('.kmDiscArchiveCard, .kmDossierCard').forEach(function (el) {
      el.disabled = false;
      el.removeAttribute('disabled');
      try { el.style.pointerEvents = 'auto'; el.style.cursor = 'pointer'; } catch (e) {}
    });
  };

  function renderCharacteristicPage(opts) {
    opts = opts || {};
    injectCss();
    ensureStore();
    const canEdit = canAdd('characteristic');
    const host = document.getElementById('content') || content;
    if (!host) return;
    const back = opts.back || 'kmLawDocsPage()';
    const rows = charList();
    const form = canEdit
      ? ('<div class="kmDossierForm">' +
          '<label>Ա․Ա․Հ․<input id="kmCharPerson" class="kmDossierEditable" type="text" autocomplete="off" placeholder="որոնել Ա․Ա․Հ․…" style="min-width:220px"></label>' +
          '<label>Կոչում<input id="kmCharRank" class="kmDossierEditable" type="text" autocomplete="off" placeholder="կոչում (ոչ պարտադիր)" style="min-width:160px"></label>' +
          '<label style="flex:1;min-width:200px">Նշում<textarea id="kmCharNote" class="kmDossierEditable" placeholder="կարճ նշում (ոչ պարտադիր)"></textarea></label>' +
          '<div class="kmDossierActions">' +
            '<button type="button" class="kmDossierEditable" onclick="kmCharacteristicPickPdf()">Կցել PDF</button>' +
            '<span id="kmCharPdfName" class="muted">ֆայլ չի ընտրված (ոչ պարտադիր)</span>' +
            '<button type="button" class="primary" onclick="kmCharacteristicAdd()">＋ Ավելացնել</button>' +
          '</div></div>')
      : '';

    host.innerHTML =
      '<div class="card kmDiscPenWrap">' +
        '<div class="toolbar" style="margin-bottom:10px">' +
          '<button type="button" onclick="' + back + '">← Վերադարձ</button>' +
          '<button type="button" onclick="kmOpenHishoxutyun(\'characteristic\')">Հիշողություն</button>' +
        '</div>' +
        '<h3 class="kmLawsHubTitle" style="margin-top:0">ԲՆՈՒԹԱԳԻՐ</h3>' +
        '<p class="kmLawsHubLead">Գրեք Ա․Ա․Հ․-ը և կցեք PDF բնութագիրը։ Քարտին սեղմելով՝ դիտվում է PDF-ը։ Ջնջել կարող է միայն ադմինիստրատորը։</p>' +
        form +
        '<div class="kmPersonListSearch"><input id="kmCharListQ" class="kmDossierEditable" type="search" placeholder="Որոնում ցանկում (Ա․Ա․Հ․)…" oninput="kmFilterPersonCards(\'.kmDiscPenWrap\', this.value)"></div>' +
        '<h4 style="margin:8px 0">Գրառումներ (' + rows.length + ')</h4>' +
        renderCharacteristicCards(rows) +
      '</div>';

    pendingCharPdf = null;
    try { document.body.classList.remove('km-boot-idle'); } catch (e0) {}
    if (typeof window.kmAttachPersonSearch === 'function') {
      window.kmAttachPersonSearch('kmCharPerson', { rankId: 'kmCharRank', personnelOnly: true });
    }
    prefillLawPerson('kmChar', opts);
    if (typeof window.kmApplyRoleGuard === 'function') window.kmApplyRoleGuard();
    if (typeof window.kmDossierUnlockForm === 'function') window.kmDossierUnlockForm();
    setTimeout(function () {
      if (typeof window.kmDossierUnlockForm === 'function') window.kmDossierUnlockForm();
    }, 40);
  }

  window.kmCharacteristicPage = function (opts) {
    if (window.kmUserRole === 'editor' && Array.isArray(window.kmEditSections)) {
      var okC = typeof window.kmSectionGranted === 'function' && (window.kmSectionGranted('characteristic') || window.kmSectionGranted('lawdocs'));
      if (!okC) {
        if (typeof toast === 'function') toast('Այս բաժինը ձեզ թույլատրված չէ', 'error');
        return;
      }
    }
    opts = opts || {};
    window._kmLawSubPage = 'characteristic';
    opts.back = typeof window.kmLawSubResolveBack === 'function'
      ? window.kmLawSubResolveBack(opts)
      : (opts.back || 'kmLawDocsPage()');
    if (opts.personName) window._kmLawSubPerson = opts.personName;
    else if (opts.back !== 'kmLawSubBackToPersonCard()') window._kmLawSubPerson = '';
    if (opts.rank) window._kmLawSubRank = opts.rank;
    else if (opts.back !== 'kmLawSubBackToPersonCard()') window._kmLawSubRank = '';
    if (typeof page !== 'undefined') page = 'lawdocs';
    window.page = 'lawdocs';
    const pt = document.getElementById('pageTitle');
    if (pt) pt.textContent = 'Բնութագիր';
    pendingCharPdf = null;
    renderCharacteristicPage(opts);
  };

  window.kmCharacteristicPickPdf = async function () {
    if (!canAdd()) return;
    const file = await pickPdfFile();
    if (!file) return;
    pendingCharPdf = file;
    const label = document.getElementById('kmCharPdfName');
    if (label) label.textContent = file.name;
  };

  window.kmCharacteristicAdd = async function () {
    if (!canAdd()) {
      if (typeof toast === 'function') toast('Դիտորդի իրավունք', 'error');
      return;
    }
    ensureStore();
    const name = String((document.getElementById('kmCharPerson') || {}).value || '').trim();
    const rankIn = String((document.getElementById('kmCharRank') || {}).value || '').trim();
    const note = String((document.getElementById('kmCharNote') || {}).value || '').trim();
    if (!name) {
      if (typeof toast === 'function') toast('Գրեք Ա․Ա․Հ․', 'warn');
      return;
    }
    const person = findPerson(name);
    const key = personKey(name);
    const hadPdf = !!(db.personCharacteristics[key] && db.personCharacteristics[key].hasPdf);
    if (hadPdf && pendingCharPdf && pendingCharPdf.bytes && pendingCharPdf.bytes.length) {
      if (!confirm('«' + name + '»-ի բնութագիրը արդեն կա։ Փոխարինե՞լ PDF-ը։')) return;
    }
    let hasPdf = hadPdf;
    let pdfName = (db.personCharacteristics[key] && db.personCharacteristics[key].pdfName) || '';
    try {
      if (pendingCharPdf && pendingCharPdf.bytes && pendingCharPdf.bytes.length) {
        await savePdf('characteristic', key, pendingCharPdf.name, pendingCharPdf.bytes);
        hasPdf = true;
        pdfName = pendingCharPdf.name;
      }
      db.personCharacteristics[key] = {
        personName: name,
        rank: rankIn || person.rank || '',
        note: note,
        hasPdf: !!hasPdf,
        pdfName: pdfName,
        updatedAt: new Date().toISOString()
      };
      pendingCharPdf = null;
      if (typeof window.kmHishoxutyunLog === 'function') {
        window.kmHishoxutyunLog({
          section: 'characteristic',
          sectionLabel: 'Բնութագիր',
          action: hadPdf ? 'change' : 'add',
          detail: (hadPdf ? 'Փոխել է բնութագիրը՝ ' : 'Ավելացրել է բնութագիր՝ ') + name +
            (rankIn ? (' · կոչում՝ ' + rankIn) : '') +
            (pdfName ? (' · PDF՝ ' + pdfName) : '') +
            (note ? (' · նշում՝ ' + String(note).slice(0, 80)) : '')
        });
      }
      if (typeof save === 'function') await save(true);
      if (typeof toast === 'function') toast('Բնութագիրը ավելացվեց');
      renderCharacteristicPage({ back: window._kmLawSubNavBack || 'kmLawDocsPage()' });
      if (typeof window.kmPersonCardNotify === 'function') window.kmPersonCardNotify(name);
    } catch (e) {
      if (typeof toast === 'function') toast(e.message || String(e), 'error');
    }
  };

  window.kmCharacteristicViewPdf = function (name) {
    ensureStore();
    const key = personKey(name);
    const rec = db.personCharacteristics[key];
    if (!rec) {
      if (typeof toast === 'function') toast('Բնութագիր չի գտնվել', 'warn');
      return;
    }
    if (!rec.hasPdf) {
      if (typeof toast === 'function') toast(rec.note || 'PDF կցված չէ', 'warn');
      return;
    }
    viewPdf('characteristic', key, 'Բնութագիր · ' + name, rec.pdfName, name);
  };

  window.kmCharacteristicDelete = async function (name) {
    if (!canAdmin()) {
      if (typeof toast === 'function') toast('Միայն ադմինիստրատոր', 'error');
      return;
    }
    if (!confirm('Ջնջե՞լ «' + name + '»-ի բնութագիրը։')) return;
    ensureStore();
    const key = personKey(name);
    await removePdf('characteristic', key);
    delete db.personCharacteristics[key];
    if (typeof window.kmHishoxutyunLog === 'function') {
      window.kmHishoxutyunLog({
        section: 'characteristic',
        sectionLabel: 'Բնութագիր',
        action: 'delete',
        detail: 'Ջնջել է բնութագիրը՝ ' + name
      });
    }
    if (typeof save === 'function') await save(true);
    if (typeof toast === 'function') toast('Ջնջվեց');
    renderCharacteristicPage({ back: window._kmLawSubNavBack || 'kmLawDocsPage()' });
    if (typeof window.kmPersonCardNotify === 'function') window.kmPersonCardNotify(name);
  };

  /* ——— Խրախուսանքներ ——— */

  function renderEncouragementCards(rows) {
    if (!rows.length) return '<p class="muted">Խրախուսանքներ դեռ չկան</p>';
    const canDel = canAdmin();
    return '<div class="kmExamFilesGrid" role="list">' + rows.map(function (row) {
      const title = esc(row.personName || '—');
      const metaParts = [];
      if (row.title) metaParts.push(esc(row.title));
      if (row.orderNumber) metaParts.unshift('№' + esc(row.orderNumber));
      if (row.rank) metaParts.push(esc(row.rank));
      metaParts.push(fmtDate(row.date));
      if (row.hasPdf) metaParts.push('PDF');
      const meta = metaParts.join(' · ');
      const del = canDel
        ? ("<button type=\"button\" class=\"kmLawCardExamDel\" onclick='event.stopPropagation();kmEncouragementDelete(" +
            JSON.stringify(row.id) + ")' title=\"Ջնջել\" aria-label=\"Ջնջել\">×</button>")
        : '';
      const tip = row.hasPdf ? 'Դիտել PDF-ը' : 'PDF կցված չէ';
      return '<div class="kmLawCardExamWrap" role="listitem" data-km-person="' + esc(row.personName || '') + '">' + del +
        "<button type=\"button\" class=\"kmLawCard kmLawCardLocal kmLawCardExam kmDossierCard kmDiscArchiveCard\" title=\"" + esc(tip) + "\" " +
        "onclick='kmEncouragementViewPdf(" + JSON.stringify(row.id) + ")'>" +
        '<span class="kmLawCardText">' + title + '<span class="kmDossierMeta">' + meta + '</span></span>' +
        '<span class="kmLawCardIcon" aria-hidden="true">' + STAR_ICON + '</span>' +
        '</button></div>';
    }).join('') + '</div>';
  }

  function renderEncouragementsPage(opts) {
    opts = opts || {};
    injectCss();
    ensureStore();
    const canEdit = canAdd('encouragements');
    const host = document.getElementById('content') || content;
    if (!host) return;
    const back = opts.back || 'kmLawDocsPage()';
    const rows = (db.personEncouragements || []).slice().sort(function (a, b) {
      return String(b.date || '').localeCompare(String(a.date || ''));
    });
    const form = canEdit
      ? ('<div class="kmDossierForm">' +
          '<label>Ա․Ա․Հ․<input id="kmEncPerson" class="kmDossierEditable" type="text" autocomplete="off" placeholder="որոնել Ա․Ա․Հ․…" style="min-width:220px"></label>' +
          '<label>Կոչում<input id="kmEncRank" class="kmDossierEditable" type="text" autocomplete="off" placeholder="կոչում (ոչ պարտադիր)" style="min-width:160px"></label>' +
          '<label>Վերնագիր / տեսակ<input id="kmEncTitle" class="kmDossierEditable" type="text" placeholder="օր. Շնորհակալագիր"></label>' +
          '<label>Հրամանի №<input id="kmEncOrder" class="kmDossierEditable" type="text" placeholder="օր. 12"></label>' +
          '<label>Ամսաթիվ<input id="kmEncDate" class="kmDossierEditable" type="date"></label>' +
          '<label style="flex:1;min-width:200px">Նշում<textarea id="kmEncNote" class="kmDossierEditable" placeholder="կարճ նկարագրություն"></textarea></label>' +
          '<div class="kmDossierActions">' +
            '<button type="button" class="kmDossierEditable" onclick="kmEncouragementPickPdf()">Կցել PDF</button>' +
            '<span id="kmEncPdfName" class="muted">ֆայլ չի ընտրված (ոչ պարտադիր)</span>' +
            '<button type="button" class="primary" onclick="kmEncouragementAdd()">＋ Ավելացնել</button>' +
          '</div></div>')
      : '';

    host.innerHTML =
      '<div class="card kmDiscPenWrap">' +
        '<div class="toolbar" style="margin-bottom:10px">' +
          '<button type="button" onclick="' + back + '">← Վերադարձ</button>' +
          '<button type="button" onclick="kmOpenHishoxutyun(\'encouragements\')">Հիշողություն</button>' +
        '</div>' +
        '<h3 class="kmLawsHubTitle" style="margin-top:0">ԽՐԱԽՈՒՍԱՆՔՆԵՐ</h3>' +
        '<p class="kmLawsHubLead">Գրեք Ա․Ա․Հ․-ը և կցեք խրախուսանքի PDF-ը։ Քարտին սեղմելով՝ դիտվում է PDF-ը։ Ջնջել կարող է միայն ադմինիստրատորը։</p>' +
        form +
        '<div class="kmPersonListSearch"><input id="kmEncListQ" class="kmDossierEditable" type="search" placeholder="Որոնում ցանկում (Ա․Ա․Հ․)…" oninput="kmFilterPersonCards(\'.kmDiscPenWrap\', this.value)"></div>' +
        '<h4 style="margin:8px 0">Պատմություն (' + rows.length + ')</h4>' +
        renderEncouragementCards(rows) +
      '</div>';

    pendingEncPdf = null;
    try { document.body.classList.remove('km-boot-idle'); } catch (e0) {}
    const dateEl = document.getElementById('kmEncDate');
    if (dateEl && !dateEl.value) dateEl.value = new Date().toISOString().slice(0, 10);
    if (typeof window.kmAttachPersonSearch === 'function') {
      window.kmAttachPersonSearch('kmEncPerson', { rankId: 'kmEncRank', personnelOnly: true });
    }
    prefillLawPerson('kmEnc', opts);
    if (typeof window.kmApplyRoleGuard === 'function') window.kmApplyRoleGuard();
    if (typeof window.kmDossierUnlockForm === 'function') window.kmDossierUnlockForm();
    setTimeout(function () {
      if (typeof window.kmDossierUnlockForm === 'function') window.kmDossierUnlockForm();
    }, 40);
  }

  window.kmEncouragementsPage = function (opts) {
    if (window.kmUserRole === 'editor' && Array.isArray(window.kmEditSections)) {
      var okE = typeof window.kmSectionGranted === 'function' && (window.kmSectionGranted('encouragements') || window.kmSectionGranted('lawdocs'));
      if (!okE) {
        if (typeof toast === 'function') toast('Այս բաժինը ձեզ թույլատրված չէ', 'error');
        return;
      }
    }
    opts = opts || {};
    window._kmLawSubPage = 'encouragements';
    opts.back = typeof window.kmLawSubResolveBack === 'function'
      ? window.kmLawSubResolveBack(opts)
      : (opts.back || 'kmLawDocsPage()');
    if (opts.personName) window._kmLawSubPerson = opts.personName;
    else if (opts.back !== 'kmLawSubBackToPersonCard()') window._kmLawSubPerson = '';
    if (opts.rank) window._kmLawSubRank = opts.rank;
    else if (opts.back !== 'kmLawSubBackToPersonCard()') window._kmLawSubRank = '';
    if (typeof page !== 'undefined') page = 'lawdocs';
    window.page = 'lawdocs';
    const pt = document.getElementById('pageTitle');
    if (pt) pt.textContent = 'Խրախուսանքներ';
    pendingEncPdf = null;
    renderEncouragementsPage(opts);
  };

  window.kmEncouragementPickPdf = async function () {
    if (!canAdd()) return;
    const file = await pickPdfFile();
    if (!file) return;
    pendingEncPdf = file;
    const label = document.getElementById('kmEncPdfName');
    if (label) label.textContent = file.name;
  };

  window.kmEncouragementAdd = async function () {
    if (!canAdd()) {
      if (typeof toast === 'function') toast('Դիտորդի իրավունք', 'error');
      return;
    }
    ensureStore();
    const name = String((document.getElementById('kmEncPerson') || {}).value || '').trim();
    const rankIn = String((document.getElementById('kmEncRank') || {}).value || '').trim();
    const title = String((document.getElementById('kmEncTitle') || {}).value || '').trim();
    const orderNumber = String((document.getElementById('kmEncOrder') || {}).value || '').trim();
    const date = String((document.getElementById('kmEncDate') || {}).value || '').trim();
    const note = String((document.getElementById('kmEncNote') || {}).value || '').trim();
    if (!name) {
      if (typeof toast === 'function') toast('Գրեք Ա․Ա․Հ․', 'warn');
      return;
    }
    const titleFinal = title || '\u054a\u0561\u057f\u057e\u0578\u0563\u056b\u0580';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      if (typeof toast === 'function') toast('Ամսաթիվը սխալ է', 'warn');
      return;
    }
    const person = findPerson(name);
    const id = 'enc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    try {
      let hasPdf = false;
      let pdfName = '';
      if (pendingEncPdf && pendingEncPdf.bytes && pendingEncPdf.bytes.length) {
        await savePdf('encouragement', id, pendingEncPdf.name, pendingEncPdf.bytes);
        hasPdf = true;
        pdfName = pendingEncPdf.name;
      }
      db.personEncouragements.unshift({
        id: id,
        personName: name,
        rank: rankIn || person.rank || '',
        title: titleFinal,
        orderNumber: orderNumber,
        date: date,
        note: note,
        hasPdf: hasPdf,
        pdfName: pdfName,
        createdAt: new Date().toISOString()
      });
      pendingEncPdf = null;
      if (typeof window.kmHishoxutyunLog === 'function') {
        window.kmHishoxutyunLog({
          section: 'encouragements',
          sectionLabel: 'Խրախուսանքներ',
          action: 'add',
          detail: 'Ավելացրել է խրախուսանք՝ ' + name +
            (titleFinal ? (' · ' + titleFinal) : '') +
            (orderNumber ? (' · հրաման №' + orderNumber) : '') +
            (date ? (' · ' + date) : '') +
            (pdfName ? (' · PDF՝ ' + pdfName) : '')
        });
      }
      if (typeof save === 'function') await save(true);
      if (typeof toast === 'function') toast('Խրախուսանքը ավելացվեց');
      renderEncouragementsPage({ back: window._kmLawSubNavBack || 'kmLawDocsPage()' });
      if (typeof window.kmPersonCardNotify === 'function') window.kmPersonCardNotify(name);
    } catch (e) {
      if (typeof toast === 'function') toast(e.message || String(e), 'error');
    }
  };

  window.kmEncouragementViewPdf = function (id) {
    ensureStore();
    const row = (db.personEncouragements || []).find(function (x) { return String(x.id) === String(id); });
    if (!row) {
      if (typeof toast === 'function') toast('Գրառումը չի գտնվել', 'warn');
      return;
    }
    if (!row.hasPdf) {
      if (typeof toast === 'function') toast(row.note || row.title || 'PDF կցված չէ', 'warn');
      return;
    }
    viewPdf('encouragement', id, (row.personName || '') + ' · ' + (row.title || 'Խրախուսանք'), row.pdfName);
  };

  window.kmEncouragementDelete = async function (id) {
    if (!canAdmin()) {
      if (typeof toast === 'function') toast('Միայն ադմինիստրատոր', 'error');
      return;
    }
    ensureStore();
    const row = (db.personEncouragements || []).find(function (x) { return String(x.id) === String(id); });
    if (!row) return;
    if (!confirm('Ջնջե՞լ «' + (row.personName || '') + '»-ի «' + (row.title || '') + '» գրառումը։')) return;
    db.personEncouragements = (db.personEncouragements || []).filter(function (x) { return String(x.id) !== String(id); });
    await removePdf('encouragement', id);
    if (typeof window.kmHishoxutyunLog === 'function') {
      window.kmHishoxutyunLog({
        section: 'encouragements',
        sectionLabel: 'Խրախուսանքներ',
        action: 'delete',
        detail: 'Ջնջել է խրախուսանքը՝ ' + (row.personName || '') +
          (row.title ? (' · ' + row.title) : '') +
          (row.orderNumber ? (' · հրաման №' + row.orderNumber) : '')
      });
    }
    if (typeof save === 'function') await save(true);
    if (typeof toast === 'function') toast('Ջնջվեց');
    renderEncouragementsPage({ back: window._kmLawSubNavBack || 'kmLawDocsPage()' });
  };

  /* ——— Ամսվա ամփոփում ——— */

  const DOC_ICON = '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2"><rect x="12" y="8" width="24" height="32" rx="2"/><path d="M18 16h12M18 22h12M18 28h8"/></svg>';
  let pendingMonthPdf = null;

  function pad2(n) {
    n = Number(n) || 0;
    return (n < 10 ? '0' : '') + n;
  }

  function fmtSummaryDate(row) {
    const d = pad2(row.day);
    const m = pad2(row.month);
    const y = String(row.year || '');
    return d + '.' + m + '.' + y;
  }

  function renderMonthSummaryCards(rows) {
    if (!rows.length) return '<p class="muted">Ամփոփումներ դեռ չկան</p>';
    const canDel = canAdmin();
    return '<div class="kmExamFilesGrid" role="list">' + rows.map(function (row) {
      const title = esc(fmtSummaryDate(row));
      const metaParts = [];
      if (row.pdfName) metaParts.push(esc(row.pdfName));
      if (row.hasPdf) metaParts.push('PDF');
      const meta = metaParts.join(' · ') || 'PDF';
      const del = canDel
        ? ("<button type=\"button\" class=\"kmLawCardExamDel\" onclick='event.stopPropagation();kmMonthSummaryDelete(" +
            JSON.stringify(row.id) + ")' title=\"Ջնջել\" aria-label=\"Ջնջել\">×</button>")
        : '';
      return '<div class="kmLawCardExamWrap" role="listitem">' + del +
        "<button type=\"button\" class=\"kmLawCard kmLawCardLocal kmLawCardExam kmDossierCard kmDiscArchiveCard\" title=\"Դիտել PDF\" " +
        "onclick='kmMonthSummaryViewPdf(" + JSON.stringify(row.id) + ")'>" +
        '<span class="kmLawCardText">' + title + '<span class="kmDossierMeta">' + meta + '</span></span>' +
        '<span class="kmLawCardIcon" aria-hidden="true">' + DOC_ICON + '</span>' +
        '</button></div>';
    }).join('') + '</div>';
  }

  function renderMonthSummaryPage() {
    injectCss();
    ensureStore();
    const canEdit = canAdd();
    const host = document.getElementById('content') || content;
    if (!host) return;
    const now = new Date();
    const rows = (db.monthSummaries || []).slice().sort(function (a, b) {
      const ka = String(a.year) + pad2(a.month) + pad2(a.day);
      const kb = String(b.year) + pad2(b.month) + pad2(b.day);
      return kb.localeCompare(ka);
    });
    const dayOpts = Array.from({ length: 31 }, function (_, i) {
      const n = i + 1;
      return '<option value="' + n + '"' + (n === now.getDate() ? ' selected' : '') + '>' + n + '</option>';
    }).join('');
    const monthOpts = Array.from({ length: 12 }, function (_, i) {
      const n = i + 1;
      return '<option value="' + n + '"' + (n === (now.getMonth() + 1) ? ' selected' : '') + '>' + n + '</option>';
    }).join('');
    const y = now.getFullYear();
    const form = canEdit
      ? ('<div class="kmDossierForm">' +
          '<label>Օր<select id="kmMsDay">' + dayOpts + '</select></label>' +
          '<label>Ամիս<select id="kmMsMonth">' + monthOpts + '</select></label>' +
          '<label>Տարի<input id="kmMsYear" type="number" min="2000" max="2100" value="' + y + '" style="min-width:100px"></label>' +
          '<div class="kmDossierActions">' +
            '<button type="button" onclick="kmMonthSummaryPickPdf()">Կցել PDF</button>' +
            '<span id="kmMsPdfName" class="muted">ֆայլ չի ընտրված</span>' +
            '<button type="button" class="primary" onclick="kmMonthSummaryAdd()">＋ Ավելացնել</button>' +
          '</div></div>')
      : '';

    host.innerHTML =
      '<div class="card kmDiscPenWrap">' +
        '<div class="toolbar" style="margin-bottom:10px">' +
          '<button type="button" onclick="kmMonthSummaryBack()">← Վերադարձ</button>' +
        '</div>' +
        '<h3 class="kmLawsHubTitle" style="margin-top:0">ԱՄՍՎԱ ԱՄՓՈՓՈՒՄ</h3>' +
        '<p class="kmLawsHubLead">Տեղադրեք ամսվա ամփոփման PDF-ը և նշեք օր / ամիս / տարի։ Քարտին սեղմելով՝ դիտվում է PDF-ը։ Ջնջել կարող է միայն ադմինիստրատորը։</p>' +
        form +
        '<h4 style="margin:8px 0">Ամփոփումներ (' + rows.length + ')</h4>' +
        renderMonthSummaryCards(rows) +
      '</div>';
    pendingMonthPdf = null;
    if (typeof window.kmApplyRoleGuard === 'function') window.kmApplyRoleGuard();
  }

  window.kmMonthSummaryPage = function () {
    if (typeof page !== 'undefined') page = 'home';
    window.page = 'home';
    const pt = document.getElementById('pageTitle');
    if (pt) pt.textContent = 'Ամսվա ամփոփում';
    pendingMonthPdf = null;
    renderMonthSummaryPage();
  };

  window.kmMonthSummaryBack = function () {
    if (typeof window.kmGoBack === 'function' && Array.isArray(window.kmNavHistory) && window.kmNavHistory.length) {
      window.kmGoBack();
      return;
    }
    if (typeof home === 'function') home();
    if (typeof window.kmHomeReportsOpen === 'function') window.kmHomeReportsOpen('stats');
  };

  window.kmMonthSummaryPickPdf = async function () {
    if (!canAdd()) return;
    const file = await pickPdfFile();
    if (!file) return;
    pendingMonthPdf = file;
    const label = document.getElementById('kmMsPdfName');
    if (label) label.textContent = file.name;
  };

  window.kmMonthSummaryAdd = async function () {
    if (!canAdd()) {
      if (typeof toast === 'function') toast('Դիտորդի իրավունք', 'error');
      return;
    }
    ensureStore();
    const day = Number((document.getElementById('kmMsDay') || {}).value || 0);
    const month = Number((document.getElementById('kmMsMonth') || {}).value || 0);
    const year = Number((document.getElementById('kmMsYear') || {}).value || 0);
    if (!(day >= 1 && day <= 31) || !(month >= 1 && month <= 12) || !(year >= 2000 && year <= 2100)) {
      if (typeof toast === 'function') toast('Օր / ամիս / տարի սխալ է', 'warn');
      return;
    }
    if (!pendingMonthPdf || !pendingMonthPdf.bytes || !pendingMonthPdf.bytes.length) {
      if (typeof toast === 'function') toast('Կցեք PDF ֆայլը', 'warn');
      return;
    }
    const id = 'ms_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    try {
      await savePdf('monthSummary', id, pendingMonthPdf.name, pendingMonthPdf.bytes);
      db.monthSummaries.unshift({
        id: id,
        day: day,
        month: month,
        year: year,
        hasPdf: true,
        pdfName: pendingMonthPdf.name,
        createdAt: new Date().toISOString()
      });
      pendingMonthPdf = null;
      if (typeof save === 'function') await save(true);
      if (typeof toast === 'function') toast('Ամփոփումը ավելացվեց');
      renderMonthSummaryPage();
    } catch (e) {
      if (typeof toast === 'function') toast(e.message || String(e), 'error');
    }
  };

  window.kmMonthSummaryViewPdf = function (id) {
    ensureStore();
    const row = (db.monthSummaries || []).find(function (x) { return String(x.id) === String(id); });
    if (!row || !row.hasPdf) {
      if (typeof toast === 'function') toast('PDF կցված չէ', 'warn');
      return;
    }
    viewPdf('monthSummary', id, 'Ամփոփում · ' + fmtSummaryDate(row), row.pdfName);
  };

  window.kmMonthSummaryDelete = async function (id) {
    if (!canAdmin()) {
      if (typeof toast === 'function') toast('Միայն ադմինիստրատոր', 'error');
      return;
    }
    ensureStore();
    const row = (db.monthSummaries || []).find(function (x) { return String(x.id) === String(id); });
    if (!row) return;
    if (!confirm('Ջնջե՞լ «' + fmtSummaryDate(row) + '» ամփոփումը։')) return;
    db.monthSummaries = (db.monthSummaries || []).filter(function (x) { return String(x.id) !== String(id); });
    await removePdf('monthSummary', id);
    if (typeof save === 'function') await save(true);
    if (typeof toast === 'function') toast('Ջնջվեց');
    renderMonthSummaryPage();
  };
})();
