/* KM section upgrades — archive partial/compare, docs ZIP, library prefs, laws bookmarks,
   convert profiles, net selected peers, duty rank rules link, spreadsheet Excel, security warn */
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
  function lsGet(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (e) { return fallback; }
  }
  function lsSet(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }

  /* ---------- Archive: partial restore + compare ---------- */
  window.restoreArchivePartial = function (id, mode) {
    if (!canEdit()) { toast('Դիտորդի իրավունք', 'error'); return; }
    var a = (typeof db !== 'undefined' && (db.archives || []).find(function (x) { return String(x.id) === String(id); }));
    if (!a || !a.snapshot) { toast('Արխիվը չի գտնվել', 'error'); return; }
    var labels = {
      people: 'միայն անձնակազմը',
      schedule: 'միայն գրաֆիկը',
      notes: 'միայն նշումները',
      vacations: 'միայն արձակուրդները'
    };
    var label = labels[mode] || mode;
    if (!confirm('Վերականգնե՞լ արխիվից ' + label + '։ Մնացած տվյալները չեն փոխվի։')) return;
    var snap = a.snapshot;
    if (mode === 'people') db.people = typeof clone === 'function' ? clone(snap.people || []) : (snap.people || []).slice();
    else if (mode === 'schedule') {
      db.schedule = typeof clone === 'function' ? clone(snap.schedule || {}) : Object.assign({}, snap.schedule || {});
      if (snap.dutyTypes) db.dutyTypes = typeof clone === 'function' ? clone(snap.dutyTypes) : snap.dutyTypes.slice();
      if (snap.dutyTypeSchedules) db.dutyTypeSchedules = typeof clone === 'function' ? clone(snap.dutyTypeSchedules) : Object.assign({}, snap.dutyTypeSchedules);
    } else if (mode === 'notes') {
      db.notebookNotes = Array.isArray(snap.notebookNotes)
        ? (typeof clone === 'function' ? clone(snap.notebookNotes) : snap.notebookNotes.slice())
        : [];
      if (snap.registrations) db.registrations = typeof clone === 'function' ? clone(snap.registrations) : snap.registrations;
    } else if (mode === 'vacations') {
      db.vacations = Array.isArray(snap.vacations)
        ? (typeof clone === 'function' ? clone(snap.vacations) : snap.vacations.slice())
        : [];
    } else {
      toast('Անհայտ ռեժիմ', 'error');
      return;
    }
    if (typeof normalize === 'function') normalize();
    if (typeof save === 'function') save(true);
    toast('Մասնակի վերականգնումը հաջողվեց (' + label + ')', 'ok');
    if (typeof window.kmOpenLibrarySection === 'function') window.kmOpenLibrarySection('archive');
    else if (typeof window.libraryPage === 'function') window.libraryPage('archive');
  };

  window.kmCompareArchive = function (id) {
    if (typeof window.kmMonthCompare !== 'function') {
      toast('Համեմատությունը հասանելի չէ', 'error');
      return;
    }
    window.kmMonthCompare();
    var tries = 0;
    (function waitCmp() {
      tries++;
      var b = document.getElementById('kmCmpB');
      if (b) {
        b.value = String(id);
        if (!b.value) {
          toast('Արխիվը համեմատման ցանկում չէ', 'warn');
          return;
        }
        if (typeof window.kmRunMonthCompare === 'function') window.kmRunMonthCompare();
        return;
      }
      if (tries < 20) setTimeout(waitCmp, 50);
      else toast('Համեմատման պատուհանը չբացվեց', 'warn');
    })();
  };

  function patchArchiveTable() {
    if (window.kmLibSection !== 'archive') return;
    var tbody = document.querySelector('#kmLibSectionRoot table.grid tbody');
    if (!tbody) return;
    tbody.querySelectorAll('tr').forEach(function (tr) {
      if (tr.querySelector('[data-km-arc-extra]')) return;
      var btn = tr.querySelector('button[onclick*="restoreFullArchive"]');
      if (!btn) return;
      var m = String(btn.getAttribute('onclick') || '').match(/restoreFullArchive\('([^']+)'\)/);
      if (!m) return;
      var id = m[1];
      var td = btn.parentElement;
      var extra = document.createElement('div');
      extra.setAttribute('data-km-arc-extra', '1');
      extra.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;margin-top:6px';
      extra.innerHTML =
        '<button type="button" onclick="restoreArchivePartial(\'' + id + '\',\'people\')">Անձնակազմ</button>' +
        '<button type="button" onclick="restoreArchivePartial(\'' + id + '\',\'schedule\')">Գրաֆիկ</button>' +
        '<button type="button" onclick="restoreArchivePartial(\'' + id + '\',\'notes\')">Նշումներ</button>' +
        '<button type="button" onclick="restoreArchivePartial(\'' + id + '\',\'vacations\')">Արձակուրդ</button>' +
        '<button type="button" onclick="kmCompareArchive(\'' + id + '\')">Համեմատել</button>';
      td.appendChild(extra);
    });
  }

  /* ---------- Library favorites / recent / tags ---------- */
  var LIB_PREF = 'km_lib_prefs_v1';
  function libPrefs() {
    var p = lsGet(LIB_PREF, null);
    if (!p || typeof p !== 'object') p = { favorites: [], recent: [], tags: {} };
    if (!Array.isArray(p.favorites)) p.favorites = [];
    if (!Array.isArray(p.recent)) p.recent = [];
    if (!p.tags || typeof p.tags !== 'object') p.tags = {};
    return p;
  }
  function saveLibPrefs(p) { lsSet(LIB_PREF, p); }

  window.kmLibToggleFavorite = function (id, type) {
    var key = String(type || '') + ':' + String(id || '');
    var p = libPrefs();
    var i = p.favorites.indexOf(key);
    if (i >= 0) p.favorites.splice(i, 1);
    else p.favorites.unshift(key);
    p.favorites = p.favorites.slice(0, 200);
    saveLibPrefs(p);
    toast(i >= 0 ? 'Հանված է ընտրվածներից' : 'Ավելացված է ընտրվածներին', 'ok');
    if (typeof window.kmLibRefreshList === 'function') window.kmLibRefreshList();
    else if (typeof window.refreshLibraryList === 'function') window.refreshLibraryList();
  };
  window.kmLibSetTag = function (id, type) {
    var key = String(type || '') + ':' + String(id || '');
    var p = libPrefs();
    var cur = p.tags[key] || '';
    var t = prompt('Պիտակ (դատարկ = ջնջել)', cur);
    if (t == null) return;
    t = String(t).trim();
    if (t) p.tags[key] = t;
    else delete p.tags[key];
    saveLibPrefs(p);
    toast(t ? 'Պիտակը պահվեց' : 'Պիտակը ջնջվեց', 'ok');
  };
  window.kmLibShowRecent = function () {
    var p = libPrefs();
    if (!p.recent.length) { toast('Վերջին բացվածներ չկան', 'warn'); return; }
    var lines = p.recent.slice(0, 20).map(function (r, i) {
      return (i + 1) + '. ' + (r.name || r.id) + ' (' + (r.type || '') + ')';
    }).join('\n');
    alert('Վերջին բացվածներ\n\n' + lines);
  };

  var _kmLibOpen = null;
  function wrapLibOpen() {
    if (typeof window.kmLibOpen !== 'function' || window.kmLibOpen.__kmUpg) return;
    _kmLibOpen = window.kmLibOpen;
    window.kmLibOpen = async function (id, type) {
      var p = libPrefs();
      p.recent = [{ id: id, type: type, name: '', at: new Date().toISOString() }].concat(
        p.recent.filter(function (r) { return !(r.id === id && r.type === type); })
      ).slice(0, 40);
      saveLibPrefs(p);
      return _kmLibOpen.apply(this, arguments);
    };
    window.kmLibOpen.__kmUpg = true;
  }

  function patchLibRows() {
    var tbody = document.getElementById('kmLibBody');
    if (!tbody || window.kmLibSection !== 'files') return;
    var p = libPrefs();
    tbody.querySelectorAll('tr').forEach(function (tr) {
      if (tr.querySelector('[data-km-lib-fav]')) return;
      var openBtn = tr.querySelector('button[onclick*="kmLibOpen"]');
      if (!openBtn) return;
      var m = String(openBtn.getAttribute('onclick') || '').match(/kmLibOpen\('([^']+)','([^']+)'\)/);
      if (!m) return;
      var id = m[1], type = m[2];
      var key = type + ':' + id;
      var fav = p.favorites.indexOf(key) >= 0;
      var tag = p.tags[key] || '';
      var box = document.createElement('span');
      box.setAttribute('data-km-lib-fav', '1');
      box.style.marginLeft = '4px';
      box.innerHTML =
        '<button type="button" title="Ընտրված" onclick="kmLibToggleFavorite(\'' + id + '\',\'' + type + '\')">' + (fav ? '★' : '☆') + '</button>' +
        '<button type="button" title="Պիտակ" onclick="kmLibSetTag(\'' + id + '\',\'' + type + '\')">🏷</button>' +
        (tag ? '<span class="muted" style="margin-left:4px;font-size:11px">' + esc(tag) + '</span>' : '');
      openBtn.parentElement.appendChild(box);
    });
    var tb = document.querySelector('#kmLibSectionRoot .toolbar');
    if (tb && !tb.querySelector('[data-km-lib-recent]')) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('data-km-lib-recent', '1');
      b.textContent = 'Վերջին բացվածներ';
      b.onclick = function () { window.kmLibShowRecent(); };
      tb.appendChild(b);
    }
  }

  /* ---------- Laws bookmarks ---------- */
  var LAW_BM = 'km_law_bookmarks_v1';
  function lawBm() {
    var a = lsGet(LAW_BM, []);
    return Array.isArray(a) ? a : [];
  }
  window.kmLawsToggleBookmark = function (id, section, name) {
    var list = lawBm();
    var i = list.findIndex(function (x) { return x.id === id && x.section === section; });
    if (i >= 0) list.splice(i, 1);
    else list.unshift({ id: id, section: section, name: name || id, at: new Date().toISOString() });
    lsSet(LAW_BM, list.slice(0, 100));
    toast(i >= 0 ? 'Էջանշանը հանվեց' : 'Էջանշանվեց', 'ok');
    patchLawRows();
  };
  window.kmLawsShowBookmarks = function () {
    var list = lawBm();
    if (!list.length) { toast('Էջանշաններ չկան', 'warn'); return; }
    var html = list.map(function (x) {
      return '<div style="margin:6px 0"><button type="button" onclick="kmLawsOpen(\'' + esc(x.id) + '\',\'' + esc(x.section) + '\')">' +
        esc(x.name || x.id) + '</button> <span class="muted">' + esc(x.section || '') + '</span></div>';
    }).join('');
    var old = document.getElementById('kmLawBmModal');
    if (old) old.remove();
    var wrap = document.createElement('div');
    wrap.id = 'kmLawBmModal';
    wrap.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:12000;display:flex;align-items:center;justify-content:center;padding:16px';
    wrap.innerHTML = '<div class="card" style="max-width:480px;width:100%"><h3 style="margin-top:0">Օրենքների էջանշաններ</h3>' +
      html + '<div class="toolbar" style="margin-top:12px"><button type="button" onclick="document.getElementById(\'kmLawBmModal\').remove()">Փակել</button></div></div>';
    wrap.onclick = function (e) { if (e.target === wrap) wrap.remove(); };
    document.body.appendChild(wrap);
  };
  function patchLawRows() {
    var tbody = document.getElementById('kmLawsBody');
    if (!tbody || window.kmLibSection !== 'laws') return;
    var list = lawBm();
    tbody.querySelectorAll('tr').forEach(function (tr) {
      if (tr.querySelector('[data-km-law-bm]')) return;
      var openBtn = tr.querySelector('button[onclick*="kmLawsOpen"]');
      if (!openBtn) return;
      var m = String(openBtn.getAttribute('onclick') || '').match(/kmLawsOpen\('([^']+)','([^']+)'\)/);
      if (!m) return;
      var id = m[1], section = m[2];
      var name = (tr.cells[1] && tr.cells[1].textContent) || id;
      var on = list.some(function (x) { return x.id === id && x.section === section; });
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('data-km-law-bm', '1');
      b.textContent = on ? '★' : '☆';
      b.title = 'Էջանշան';
      b.onclick = function () { window.kmLawsToggleBookmark(id, section, name); };
      openBtn.parentElement.insertBefore(b, openBtn);
    });
    var tb = document.querySelector('#kmLibSectionRoot .toolbar');
    if (tb && !tb.querySelector('[data-km-law-bm-list]')) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('data-km-law-bm-list', '1');
      btn.textContent = 'Էջանշաններ';
      btn.onclick = function () { window.kmLawsShowBookmarks(); };
      tb.appendChild(btn);
    }
  }

  /* ---------- Convert profiles ---------- */
  var CONV_PREF = 'km_convert_profiles_v1';
  window.kmSaveConvertProfile = function () {
    var kindEl = document.getElementById('convFolderKind');
    var kind = kindEl ? kindEl.value : 'word-to-pdf';
    var name = prompt('Պրոֆիլի անուն', kind);
    if (!name) return;
    var list = lsGet(CONV_PREF, []);
    if (!Array.isArray(list)) list = [];
    list = [{ name: String(name).trim(), kind: kind, at: new Date().toISOString() }].concat(
      list.filter(function (x) { return x.name !== name; })
    ).slice(0, 20);
    lsSet(CONV_PREF, list);
    toast('Պրոֆիլը պահվեց', 'ok');
    paintConvertProfiles();
  };
  window.kmApplyConvertProfile = function () {
    var sel = document.getElementById('kmConvProfileSel');
    if (!sel || !sel.value) return;
    var list = lsGet(CONV_PREF, []);
    var p = (list || []).find(function (x) { return x.name === sel.value; });
    if (!p) return;
    var kindEl = document.getElementById('convFolderKind');
    if (kindEl) kindEl.value = p.kind || 'word-to-pdf';
    toast('Պրոֆիլը կիրառվեց՝ ' + p.name, 'ok');
  };
  function paintConvertProfiles() {
    if (window.kmLibSection !== 'convert') return;
    var host = document.getElementById('kmLibSectionRoot');
    if (!host) return;
    var list = lsGet(CONV_PREF, []);
    var sig = (list || []).map(function (x) { return x.name + ':' + x.kind; }).join('|');
    var bar = host.querySelector('[data-km-conv-profiles]');
    if (bar && bar.getAttribute('data-km-sig') === sig) return;
    if (!bar) {
      var card = host.querySelector('.card');
      if (!card) return;
      bar = document.createElement('div');
      bar.className = 'toolbar';
      bar.setAttribute('data-km-conv-profiles', '1');
      bar.style.marginBottom = '10px';
      card.insertBefore(bar, card.firstChild.nextSibling);
    }
    bar.setAttribute('data-km-sig', sig);
    var opts = (list || []).map(function (x) {
      return '<option value="' + esc(x.name) + '">' + esc(x.name) + ' (' + esc(x.kind) + ')</option>';
    }).join('');
    bar.innerHTML =
      '<label style="display:flex;gap:6px;align-items:center">Պրոֆիլ ' +
      '<select id="kmConvProfileSel" style="padding:6px;min-width:160px"><option value="">—</option>' + opts + '</select></label>' +
      '<button type="button" onclick="kmApplyConvertProfile()">Կիրառել</button>' +
      '<button type="button" onclick="kmSaveConvertProfile()">Պահել պրոֆիլ</button>';
  }

  /* ---------- Docs ZIP ---------- */
  window.kmExportDocsZip = async function () {
    if (!canEdit()) { toast('Դիտորդի իրավունք', 'error'); return; }
    if (!window.kmNative || !window.kmNative.file) {
      toast('ZIP-ը հասանելի է միայն KM desktop-ում', 'error');
      return;
    }
    toast('Փաթեթը կազմվում է…');
    try {
      if (!window.JSZip) {
        if (typeof window.needZip === 'function') await window.needZip();
        else if (typeof window.loadLib === 'function') await window.loadLib('vendor/jszip.min.js', 'JSZip');
        else {
          await new Promise(function (resolve, reject) {
            var s = document.createElement('script');
            s.src = 'vendor/jszip.min.js';
            s.onload = resolve;
            s.onerror = reject;
            document.head.appendChild(s);
          });
        }
      }
      var Zip = window.JSZip;
      if (!Zip) throw new Error('JSZip չկա');
      var zip = new Zip();
      var dt = typeof window.kmDocsDate === 'function' ? window.kmDocsDate() : new Date();
      if (!(dt instanceof Date) || isNaN(dt.getTime())) {
        var el = document.getElementById('kmDocsDate');
        if (el && el.value) {
          var pp = String(el.value).split('-').map(Number);
          dt = new Date(pp[0], (pp[1] || 1) - 1, pp[2] || 1, 12, 0, 0);
        } else dt = new Date();
      }
      var iso = dt.toISOString().slice(0, 10);
      var logic = window.kmOpsLogic || {};
      var data = typeof db !== 'undefined' ? db : {};
      var abs = function (name, d) {
        return typeof window.kmPersonAbsence === 'function' ? window.kmPersonAbsence(name, d) : null;
      };
      var blocked = function (p) {
        return typeof window.kmPersonIsBlocked === 'function' ? window.kmPersonIsBlocked(p) : !!p.blocked;
      };
      var duty = logic.todayDutyRows ? logic.todayDutyRows(data, dt, { absence: abs, isBlocked: blocked }) : [];
      var free = logic.freePeopleOnDate ? logic.freePeopleOnDate(data, dt, { absence: abs, isBlocked: blocked }) : [];
      var notes = (Array.isArray(data.notebookNotes) ? data.notebookNotes : []).filter(function (n) {
        return n && n.date === iso;
      });
      var dutyTxt = 'Հերթապահներ · ' + iso + '\n\n' + duty.map(function (r, i) {
        return (i + 1) + '. ' + (r.rank || '') + ' ' + (r.name || '') +
          (r.graphName ? ' · ' + r.graphName : '') + (r.phone ? ' · ' + r.phone : '');
      }).join('\n') || 'չկա';
      var freeTxt = 'Ազատ անձինք · ' + iso + '\n\n' + free.map(function (r, i) {
        return (i + 1) + '. ' + (r.rank || '') + ' ' + (r.name || '') +
          (r.unit ? ' · ' + r.unit : '') + (r.phone ? ' · ' + r.phone : '');
      }).join('\n') || 'չկա';
      var notesTxt = 'Նշումներ · ' + iso + '\n\n' + notes.map(function (n) {
        return (n.time || '--') + '  ' + (n.text || '') + (n.person ? ' [' + n.person + ']' : '') + (n.done ? ' ✓' : '');
      }).join('\n') || 'չկա';
      zip.file('1_herthapahner.txt', dutyTxt);
      zip.file('2_azat_andzner.txt', freeTxt);
      zip.file('3_nshumner.txt', notesTxt);
      zip.file('README.txt', 'KM փաստաթղթերի փաթեթ\nԱմսաթիվ՝ ' + iso + '\nՀերթապահ՝ ' + duty.length + '\nԱզատ՝ ' + free.length + '\nՆշում՝ ' + notes.length + '\n');

      var wordPath = '';
      var pdfPath = '';
      try {
        if (window.kmNative.export && window.kmNative.export.dutyOrderWord) {
          var rows = duty.map(function (r) {
            return { rank: r.rank || '', name: r.name || '', unit: r.unit || '', phone: r.phone || '', place: r.graphName || '' };
          });
          var f = typeof window.kmFormalData === 'function' ? window.kmFormalData() : {};
          var w = await window.kmNative.export.dutyOrderWord({
            name: 'KM_hraman_' + iso,
            title: 'Հրաման — հերթապահներ',
            date: dt.toLocaleDateString('hy-AM'),
            note: 'KM փաթեթ',
            asPdf: false,
            formal: f,
            rows: rows
          });
          wordPath = w && w.output;
          var p = await window.kmNative.export.dutyOrderWord({
            name: 'KM_hraman_' + iso,
            title: 'Հրաման — հերթապահներ',
            date: dt.toLocaleDateString('hy-AM'),
            note: 'KM փաթեթ',
            asPdf: true,
            formal: f,
            rows: rows
          });
          pdfPath = (p && (p.pdf || p.output)) || '';
        }
      } catch (eWord) {
        zip.file('WORD_ERROR.txt', String((eWord && eWord.message) || eWord));
      }
      if (wordPath && window.kmNative.file.readBytes) {
        try {
          var wb = await window.kmNative.file.readBytes(wordPath);
          if (wb && wb.ok && wb.bytes) zip.file(wb.name || 'hraman.docx', wb.bytes instanceof Uint8Array ? wb.bytes : new Uint8Array(wb.bytes));
        } catch (e1) {}
      }
      if (pdfPath && window.kmNative.file.readBytes) {
        try {
          var pb = await window.kmNative.file.readBytes(pdfPath);
          if (pb && pb.ok && pb.bytes) zip.file(pb.name || 'hraman.pdf', pb.bytes instanceof Uint8Array ? pb.bytes : new Uint8Array(pb.bytes));
        } catch (e2) {}
      }

      var blob = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
      var r = await window.kmNative.file.saveDesktop({ name: 'KM_pastatuxter_' + iso + '.zip', bytes: blob });
      if (r && r.ok) {
        toast('ZIP պատրաստ է՝ ' + (r.path || ''), 'ok');
        if (window.kmNative.shell && window.kmNative.shell.showItemInFolder) {
          await window.kmNative.shell.showItemInFolder(r.path);
        }
      } else toast('ZIP-ը չպահվեց', 'error');
    } catch (e) {
      toast((e && e.message) || 'ZIP-ը չստեղծվեց', 'error');
    }
  };

  function patchDocsPack() {
    if (window.page !== 'docsPack') return;
    var toolbar = document.querySelector('#content .toolbar');
    if (!toolbar || toolbar.querySelector('[data-km-docs-zip]')) return;
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'primary';
    b.setAttribute('data-km-docs-zip', '1');
    b.textContent = 'Օրվա ZIP փաթեթ';
    b.onclick = function () { window.kmExportDocsZip(); };
    toolbar.appendChild(b);
  }

  /* ---------- Network selected peers ---------- */
  window._kmNetSelected = window._kmNetSelected || {};
  window.kmNetTogglePeer = function (key, on) {
    key = String(key || '');
    if (!key) return;
    if (on) window._kmNetSelected[key] = 1;
    else delete window._kmNetSelected[key];
  };
  window.kmNetSendSelected = async function () {
    var keys = Object.keys(window._kmNetSelected || {});
    if (!keys.length) { toast('Ընտրեք կայաններ', 'warn'); return; }
    try {
      var api = window.kmNative && window.kmNative.net;
      if (!api) throw new Error('Ցանցը հասանելի չէ');
      var pick = await api.pickFile();
      if (!pick || !pick.path) return;
      toast('Ուղարկվում է ընտրվածներին…');
      var ok = 0, bad = 0;
      for (var i = 0; i < keys.length; i++) {
        try {
          var parts = String(keys[i]).split(':');
          var host = parts[0];
          var port = Number(parts[1]) || undefined;
          var r = await api.send({ host: host, port: port, path: pick.path });
          if (r && r.ok !== false && !r.cancelled) ok++;
          else bad++;
        } catch (e) { bad++; }
      }
      toast('Ուղարկվեց՝ ' + ok + (bad ? ', սխալ՝ ' + bad : ''), bad ? 'warn' : 'ok');
    } catch (e) {
      toast((e && e.message) || String(e), 'error');
    }
  };
  function patchNetPeers() {
    if (window.page !== 'network') return;
    var rows = document.querySelectorAll('#content table.grid tbody tr');
    rows.forEach(function (tr) {
      if (tr.querySelector('[data-km-net-sel]')) return;
      var ipCell = tr.querySelector('.kmNetIps');
      if (!ipCell) return;
      var txt = String(ipCell.textContent || '').trim();
      var m = txt.match(/(\d+\.\d+\.\d+\.\d+)(?::(\d+))?/);
      if (!m) return;
      var key = m[1] + (m[2] ? (':' + m[2]) : '');
      var on = !!window._kmNetSelected[key];
      var box = document.createElement('label');
      box.setAttribute('data-km-net-sel', '1');
      box.style.cssText = 'display:inline-flex;align-items:center;gap:4px;margin-right:6px';
      box.innerHTML = '<input type="checkbox" ' + (on ? 'checked' : '') +
        ' onchange="kmNetTogglePeer(' + JSON.stringify(key) + ',this.checked)" title="Ընտրել">';
      ipCell.insertBefore(box, ipCell.firstChild);
    });
    var tb = document.querySelector('#content .toolbar');
    if (tb && !tb.querySelector('[data-km-net-sel-send]')) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('data-km-net-sel-send', '1');
      b.textContent = 'Ուղարկել ընտրվածներին';
      b.onclick = function () { window.kmNetSendSelected(); };
      tb.appendChild(b);
    }
    var prog = document.getElementById('kmNetProgress');
    if (!prog) {
      prog = document.createElement('div');
      prog.id = 'kmNetProgress';
      prog.className = 'muted';
      prog.style.cssText = 'position:fixed;left:260px;right:16px;bottom:10px;z-index:9000;padding:6px 10px;background:rgba(255,255,255,.92);border:1px solid #c5d0da;border-radius:8px;display:none';
      document.body.appendChild(prog);
    }
  }
  function bindNetProgress() {
    if (bindNetProgress.done || !window.kmNative || !window.kmNative.onNetEvent) return;
    bindNetProgress.done = true;
    window.kmNative.onNetEvent(function (ev) {
      if (!ev) return;
      var el = document.getElementById('kmNetProgress');
      if (!el) return;
      if (ev.type === 'progress') {
        el.style.display = 'block';
        el.textContent = 'Փոխանցում՝ ' + (ev.file || '') + ' · ' + (ev.percent != null ? ev.percent + '%' : ((ev.sent || 0) + '/' + (ev.total || 0)));
      } else if (ev.type === 'sent' || ev.type === 'received') {
        el.textContent = '';
        el.style.display = 'none';
      }
    });
  }

  /* ---------- Duty types: rank rules + month compare ---------- */
  function patchDutyTypes() {
    if (window.page !== 'dutyTypes') return;
    var tb = document.querySelector('#content .toolbar');
    if (!tb || tb.querySelector('[data-km-duty-rank]')) return;
    var b1 = document.createElement('button');
    b1.type = 'button';
    b1.setAttribute('data-km-duty-rank', '1');
    b1.textContent = 'Կոչումների կանոններ';
    b1.onclick = function () {
      if (typeof window.kmOpenRankRules === 'function') window.kmOpenRankRules();
    };
    var b2 = document.createElement('button');
    b2.type = 'button';
    b2.textContent = 'Ամիսների համեմատություն';
    b2.onclick = function () {
      if (typeof window.kmMonthCompare === 'function') window.kmMonthCompare();
    };
    tb.appendChild(b1);
    tb.appendChild(b2);
  }

  /* ---------- Spreadsheet Excel (toolbar hook; export lives in km-spreadsheet.js) ---------- */
  function patchSpreadsheetToolbar() {
    if (window.page !== 'spreadsheets' && window.page !== 'tables') return;
    var tb = document.querySelector('#content .toolbar');
    if (!tb || tb.querySelector('[data-km-ss-xlsx]')) return;
    var b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('data-km-ss-xlsx', '1');
    b.textContent = 'Excel';
    b.onclick = function () {
      if (typeof window.kmSsExportExcel === 'function') window.kmSsExportExcel();
      else if (typeof window.kmSsExportCsv === 'function') window.kmSsExportCsv();
    };
    tb.appendChild(b);
  }

  /* ---------- Security demotion warning ---------- */
  var _saveSec = null;
  function wrapSecuritySave() {
    if (typeof window.kmSaveSecuritySettings !== 'function' || window.kmSaveSecuritySettings.__kmUpg) return;
    _saveSec = window.kmSaveSecuritySettings;
    window.kmSaveSecuritySettings = async function () {
      var roleEl = document.getElementById('kmSecRole');
      var role = roleEl ? roleEl.value : '';
      if (role && role !== 'admin') {
        if (!confirm('Դուք փոխում եք դերը admin-ից։ Եթե սա վերջին ադմինն է, կարող եք կորցնել կառավարման մուտքը։ Շարունակե՞լ։')) return;
      }
      return _saveSec.apply(this, arguments);
    };
    window.kmSaveSecuritySettings.__kmUpg = true;
  }

  /* ---------- Observer / boot ---------- */
  function tick() {
    try {
      wrapLibOpen();
      wrapSecuritySave();
      bindNetProgress();
      patchArchiveTable();
      patchLibRows();
      patchLawRows();
      paintConvertProfiles();
      patchDocsPack();
      patchNetPeers();
      patchDutyTypes();
      patchSpreadsheetToolbar();
    } catch (e) {
      console.error('km-section-upgrades', e);
    }
  }

  var mo = null;
  function start() {
    tick();
    if (mo) return;
    var root = document.getElementById('content') || document.body;
    mo = new MutationObserver(function () {
      if (start._t) clearTimeout(start._t);
      start._t = setTimeout(tick, 220);
    });
    mo.observe(root, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
/* KM_AUDIT: loaded after km-ops.js from index.html (wired 20260922_013859). */
