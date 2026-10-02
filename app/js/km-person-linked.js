/* KM_PERSONNEL_LEGAL_BIDI_SYNC_V1 вЂ” shared personnel в†” Legal Corner в†” archive sync bus */
(function () {
  'use strict';
  if (window.kmPersonnelSyncBus && window.kmPersonnelSyncBus.__v === '1') return;

  function samePerson(a, b) {
    if (typeof window.kmVacationSamePerson === 'function') {
      try { return !!window.kmVacationSamePerson(a, b); } catch (e) {}
    }
    return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
  }
  function normCode(c) {
    return String(c == null ? '' : c).replace(/\s+/g, '').trim().toLowerCase();
  }
  function ensureDb() {
    if (typeof db === 'undefined' || !db) return null;
    if (!db.personCharacteristics || typeof db.personCharacteristics !== 'object' || Array.isArray(db.personCharacteristics)) {
      db.personCharacteristics = db.personCharacteristics && !Array.isArray(db.personCharacteristics) ? db.personCharacteristics : {};
    }
    if (!Array.isArray(db.personEncouragements)) db.personEncouragements = [];
    if (!Array.isArray(db.disciplinePenalties)) db.disciplinePenalties = [];
    if (!Array.isArray(db.disciplinePenaltiesArchive)) db.disciplinePenaltiesArchive = [];
    if (!Array.isArray(db.serviceExamConclusions)) db.serviceExamConclusions = [];
    return db;
  }
  function charKey(name) {
    if (typeof window.kmPersonDocKey === 'function') return window.kmPersonDocKey(name);
    return String(name || '').trim().toLowerCase();
  }
  function findPerson(name) {
    var d = ensureDb();
    if (!d || !name) return null;
    var list = d.people || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i] && samePerson(list[i].name, name)) return list[i];
    }
    return null;
  }
  function persistSoft() {
    try {
      if (typeof window.kmSaveDb === 'function') return window.kmSaveDb();
      if (typeof saveDb === 'function') return saveDb();
      if (typeof save === 'function') return save(true);
    } catch (e) {}
  }
  function notify(name, reason) {
    name = String(name || '').trim();
    if (!name) return;
    try {
      if (typeof window.kmPersonCardNotify === 'function') window.kmPersonCardNotify(name);
    } catch (e0) {}
    try {
      document.dispatchEvent(new CustomEvent('km-personnel-sync', {
        detail: { name: name, reason: reason || '', at: Date.now() }
      }));
    } catch (e1) {}
  }

  /** Snapshot Legal Corner records for a person (read path used by all modules). */
  function snapshotForPerson(name) {
    var d = ensureDb();
    name = String(name || '').trim();
    if (!d || !name) {
      return { characteristics: null, encouragements: [], discipline: [], disciplineArchive: [], serviceExams: [] };
    }
    var key = charKey(name);
    var chars = d.personCharacteristics || {};
    var characteristic = chars[key] || null;
    if (!characteristic) {
      Object.keys(chars).forEach(function (k) {
        if (characteristic) return;
        if (chars[k] && samePerson(chars[k].personName || chars[k].name, name)) characteristic = chars[k];
      });
    }
    function filt(arr, field) {
      return (arr || []).filter(function (r) {
        return r && samePerson(r[field] || r.personName || r.person || r.name, name);
      });
    }
    return {
      characteristic: characteristic,
      encouragements: filt(d.personEncouragements, 'personName'),
      discipline: filt(d.disciplinePenalties, 'personName'),
      disciplineArchive: filt(d.disciplinePenaltiesArchive, 'personName'),
      serviceExams: filt(d.serviceExamConclusions, 'personName')
    };
  }

  /**
   * Upsert a Legal Corner record into shared stores; notifies Person Card / listeners.
   * kinds: characteristic | encouragement | discipline | serviceExam
   */
  function upsertRecord(kind, rec) {
    var d = ensureDb();
    if (!d || !rec) return false;
    var name = String(rec.personName || rec.person || rec.name || '').trim();
    if (!name) return false;
    kind = String(kind || '').toLowerCase();
    if (kind === 'characteristic' || kind === 'profile') {
      var key = charKey(name);
      d.personCharacteristics[key] = Object.assign({}, d.personCharacteristics[key] || {}, rec, {
        personName: name,
        updatedAt: rec.updatedAt || new Date().toISOString()
      });
    } else if (kind === 'encouragement' || kind === 'reward') {
      if (!rec.id) rec.id = 'enc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
      rec.personName = name;
      var ei = d.personEncouragements.findIndex(function (x) { return x && String(x.id) === String(rec.id); });
      if (ei >= 0) d.personEncouragements[ei] = Object.assign({}, d.personEncouragements[ei], rec);
      else d.personEncouragements.unshift(rec);
    } else if (kind === 'discipline' || kind === 'penalty') {
      if (!rec.id) rec.id = 'pen_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
      rec.personName = name;
      var bucket = rec.status === 'archive' || rec.archived ? 'disciplinePenaltiesArchive' : 'disciplinePenalties';
      var arr = d[bucket];
      var pi = arr.findIndex(function (x) { return x && String(x.id) === String(rec.id); });
      if (pi >= 0) arr[pi] = Object.assign({}, arr[pi], rec);
      else arr.unshift(rec);
    } else if (kind === 'serviceexam' || kind === 'service_exam' || kind === 'exam') {
      if (!rec.id) rec.id = 'exam_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
      rec.personName = name;
      var xi = d.serviceExamConclusions.findIndex(function (x) { return x && String(x.id) === String(rec.id); });
      if (xi >= 0) d.serviceExamConclusions[xi] = Object.assign({}, d.serviceExamConclusions[xi], rec);
      else d.serviceExamConclusions.unshift(rec);
    } else {
      return false;
    }
    persistSoft();
    notify(name, kind);
    return true;
  }

  /** Unit Archive / Position Card в†’ pull name + staffing code onto person profile. */
  function syncIdentityFromRow(row) {
    var d = ensureDb();
    if (!d || !row) return false;
    var name = String(row.name || row.personName || row.aah || '').trim();
    if (!name) return false;
    var code = String(row.code || row.postCode || row.staffingCode || '').trim();
    var post = String(row.position || row.post || '').trim();
    var unit = String(row.unit || row.section || '').trim();
    var person = findPerson(name);
    if (!person) {
      if (!Array.isArray(d.people)) d.people = [];
      person = { name: name, post: post, postCode: code, unit: unit, rank: '' };
      d.people.push(person);
    } else {
      if (code && !String(person.postCode || '').trim()) person.postCode = code;
      else if (code) person.postCode = code;
      if (post) if (section) person.unit = section;
      person.post = post;
      if (unit && !person.unit) person.unit = unit;
    }
    notify(name, 'identity');
    return true;
  }

  window.kmPersonnelSyncBus = {
    __v: '1',
    marker: 'KM_PERSONNEL_LEGAL_BIDI_SYNC_V1',
    samePerson: samePerson,
    normStaffingCode: normCode,
    snapshotForPerson: snapshotForPerson,
    upsertRecord: upsertRecord,
    syncIdentityFromRow: syncIdentityFromRow,
    notify: notify
  };
  window.kmPersonnelLegalSnapshot = snapshotForPerson;
  window.kmPersonnelLegalUpsert = upsertRecord;
})();

/* KM — Անձի քարտի կապված տվյալներ (տույժ, խրախուսանք, պաշտոն, բուժկետ…) */
(function () {
  'use strict';

  function esc(s) {
    return typeof window.esc === 'function'
      ? window.esc(s)
      : String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
          return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
        });
  }

  function samePerson(a, b) {
    if (typeof window.kmVacationSamePerson === 'function') {
      try { return !!window.kmVacationSamePerson(a, b); } catch (e) {}
    }
    return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
  }

  function fmtDate(d) {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString('hy-AM'); } catch (e) { return String(d).slice(0, 10); }
  }

  function penaltyLabel(typeId) {
    var map = {
      strict: 'ԽԻՍՏ ՆԿԱՏՈՂՈՒԹՅՈՒՆ',
      reprimand: 'ՆԿԱՏՈՂՈՒԹՅՈՒՆ',
      position_mismatch: 'ՊԱՇՏՈՆԻ ԱՆՀԱՄԱՊԱՏԱՍԽԱՆԵՑՈՒՄ',
      position_partial: 'ՊԱՇՏՈՆԻ ՈՉ ԼՐԻՎ ԱՆՀԱՄԱՊԱՏԱՍԽԱՆԵՑՈՒՄ'
    };
    return map[typeId] || typeId || 'Տույժ';
  }

  function charKey(name) {
    if (typeof window.kmPersonDocKey === 'function') return window.kmPersonDocKey(name);
    return String(name || '').trim().toLowerCase();
  }

  function troopRowsFor(name) {
    var rows = (((db || {}).troopStructure || {}).staff || {}).rows;
    if (!Array.isArray(rows)) return [];
    return rows.filter(function (r) {
      return r && samePerson(r.name, name);
    });
  }

  function appointmentPostKey(post) {
    return String(post || '').trim().toLowerCase();
  }

  function appointmentSame(a, b) {
    if (!a || !b) return false;
    var pa = appointmentPostKey(a.post);
    var pb = appointmentPostKey(b.post);
    if (!pa || pa !== pb) return false;
    return String(a.orderNumber || '').trim() === String(b.orderNumber || '').trim()
      && String(a.date || '').slice(0, 10) === String(b.date || '').slice(0, 10);
  }

  window.kmPersonDedupeAppointments = function (person, byPostOnly) {
    if (!person || !Array.isArray(person.appointments)) return [];
    var out = [];
    person.appointments.forEach(function (item) {
      if (!item || !String(item.post || '').trim()) return;
      var dupIdx = out.findIndex(function (x) {
        if (byPostOnly) return appointmentPostKey(x.post) === appointmentPostKey(item.post);
        return appointmentSame(x, item);
      });
      if (dupIdx >= 0) out[dupIdx] = Object.assign({}, out[dupIdx], item);
      else out.push(Object.assign({}, item));
    });
    person.appointments = out.slice(0, 30);
    return person.appointments;
  };

  window.kmPersonLinkedSummary = function (name) {
    name = String(name || '').trim();
    if (typeof db === 'undefined' || !name) {
      return {
        name: name, penalties: [], penaltiesArchive: [], encouragements: [],
        characteristic: null, medical: [], docs: [], vacations: [], leavePlan: [],
        exams: [], dossier: {}, troop: [], appointments: []
      };
    }
    if (typeof window.kmUnitEnsureStores === 'function') window.kmUnitEnsureStores();

    var penalties = (db.disciplinePenalties || []).filter(function (r) {
      return r && samePerson(r.personName, name) && r.status === 'active';
    });
    var penaltiesArchive = (db.disciplinePenaltiesArchive || []).filter(function (r) {
      return r && samePerson(r.personName, name);
    }).slice(0, 8);
    var encouragements = (db.personEncouragements || []).filter(function (r) {
      return r && samePerson(r.personName, name);
    }).slice().sort(function (a, b) {
      return String(b.date || '').localeCompare(String(a.date || ''));
    });
    var characteristic = null;
    var chars = db.personCharacteristics || {};
    var key = charKey(name);
    if (chars[key]) characteristic = chars[key];
    else {
      Object.keys(chars).some(function (k) {
        if (chars[k] && samePerson(chars[k].personName, name)) {
          characteristic = chars[k];
          return true;
        }
        return false;
      });
    }
    var medical = (db.unitMedical || []).filter(function (r) {
      return r && samePerson(r.person, name);
    });
    var docs = (db.unitDocs || []).filter(function (r) {
      return r && samePerson(r.person, name);
    }).slice(-6).reverse();
    var vacations = (db.vacations || []).filter(function (r) {
      return r && samePerson(r.person, name);
    });
    var leavePlan = ((db.unitLeavePlan && db.unitLeavePlan.rows) || []).filter(function (r) {
      return r && samePerson(r.person, name);
    });
    var exams = (db.trialExamDrafts || []).concat(db.unitTrialExamDrafts || []).filter(function (r) {
      return r && samePerson(r.person, name);
    });
    /* KM_PERSONNEL_LEGAL_BIDI_SYNC_V1 — merge Legal Corner service-exam conclusions */
    try {
      var __sec = (db.serviceExamConclusions || []).filter(function (r) {
        return r && samePerson(r.personName || r.person || r.name, name);
      });
      if (__sec.length) exams = exams.concat(__sec);
      if (window.kmPersonnelSyncBus) {
        var __snap = window.kmPersonnelSyncBus.snapshotForPerson(name);
        if (__snap && __snap.serviceExams && __snap.serviceExams.length) {
          exams = exams.concat(__snap.serviceExams);
        }
      }
    } catch (eBid) {}
    var dossier = (db.unitDossiers && db.unitDossiers[name]) || {};
    var troop = troopRowsFor(name);
    var person = (db.people || []).find(function (p) { return p && samePerson(p.name, name); }) || null;
    if (person) window.kmPersonDedupeAppointments(person, true);
    var appointments = Array.isArray(person && person.appointments) ? person.appointments.slice() : [];
    if (!appointments.length && (dossier.post || (person && person.post))) {
      appointments = [{
        post: dossier.post || (person && person.post) || '',
        orderNumber: (person && person.posOrder) || (troop[0] && troop[0].posOrder) || '',
        date: (person && person.appointmentDate) || '',
        note: ''
      }];
    }

    return {
      name: name,
      person: person,
      dossier: dossier,
      penalties: penalties,
      penaltiesArchive: penaltiesArchive,
      encouragements: encouragements,
      characteristic: characteristic,
      medical: medical,
      docs: docs,
      vacations: vacations,
      leavePlan: leavePlan,
      exams: exams,
      troop: troop,
      appointments: appointments
    };
  };

  function listOrEmpty(items, mapFn, emptyText) {
    if (!items || !items.length) {
      return '<p class="muted" style="margin:6px 0 0">' + esc(emptyText) + '</p>';
    }
    return '<ul class="kmPcLinkedList">' + items.map(function (r, i) { return mapFn(r, i); }).join('') + '</ul>';
  }

  window.kmPersonLinkedSectionsHtml = function (name) {
    var s = window.kmPersonLinkedSummary(name);
    var post = (s.person && (s.person.post || s.dossier.post)) || s.dossier.post || '';
    /* PC_ARCH_FACTS_PREF / KM_PERSON_CARD_ARCHIVE_FIELDS_V1 */
    var excel = {};
    var archFacts = null;
    try {
      if (typeof window.kmArchiveFactsForPerson === 'function') {
        archFacts = window.kmArchiveFactsForPerson(s.person || { name: name }) || null;
      } else if (window.kmUnitArchiveStaffSource && typeof window.kmUnitArchiveStaffSource.factsForPerson === 'function') {
        archFacts = window.kmUnitArchiveStaffSource.factsForPerson(s.person || { name: name }) || null;
      }
    } catch (eArch) { archFacts = null; }
    if (archFacts && archFacts.found) {
      excel = {
        code: archFacts.postCode || archFacts.code || '',
        post: archFacts.post || '',
        unit: archFacts.section || archFacts.unit || '',
        section: archFacts.section || archFacts.unit || '',
        rankSlot: archFacts.rankSlot || '',
        rank: archFacts.rank || '',
        specialty: archFacts.specialty || '',
        vus: archFacts.vus || '',
        posOrder: archFacts.posOrder || '',
        fromFormal: true
      };
    } else {
      try {
        if (typeof window.kmExcelStaffFactsForPerson === 'function') {
          excel = window.kmExcelStaffFactsForPerson(s.person || { name: name }) || {};
        }
      } catch (eEx) { excel = {}; }
    }
    var section = String((s.person && (s.person.unit || s.person.section)) || excel.section || excel.unit || s.dossier.unit || '').trim();
    var postCode = String((s.person && (s.person.postCode || s.person.posCode)) || s.dossier.postCode || excel.code || '').trim();
    var specialty = String((s.person && s.person.specialty) || s.dossier.specialty || excel.specialty || excel.vus || '').trim();
    if (typeof window.kmLooksLikeStaffCode === 'function' && window.kmLooksLikeStaffCode(specialty)) specialty = '';
    if (postCode && specialty === postCode) specialty = '';
    var rankSlot = excel.rankSlot || (s.person && s.person.rankSlot) || s.dossier.rankSlot || '';
    var personRank = excel.rank || (s.person && s.person.rank) || '';
    var posOrder = excel.posOrder || (s.person && s.person.posOrder) || (s.troop[0] && s.troop[0].posOrder) || '';
    var appDate = (s.person && s.person.appointmentDate) || '';
    if (excel.post) post = excel.post;
    else if (!post && s.troop[0] && s.troop[0].position) post = s.troop[0].position;

    var canEdit = typeof window.kmCanEditPersonnelOp === 'function'
      ? !!window.kmCanEditPersonnelOp('card')
      : (typeof window.kmCanEdit !== 'function' || window.kmCanEdit());
    var ro = canEdit ? '' : ' readonly';
    var dis = canEdit ? '' : ' disabled';

    var penHtml = listOrEmpty(s.penalties, function (r) {
      return '<li><b>' + esc(penaltyLabel(r.type)) + '</b> · №' + esc(r.orderNumber || '—') +
        ' · ' + esc(fmtDate(r.receivedAt)) +
        (r.expiresAt ? ' → ' + esc(fmtDate(r.expiresAt)) : '') +
        (r.hasOrderPdf
          ? ' <button type="button" class="kmPcMini" data-km-pen-pdf="' + esc(r.id) + '">PDF</button>'
          : '') +
        '</li>';
    }, 'Գործող տույժ չկա');

    var encHtml = listOrEmpty(s.encouragements.slice(0, 8), function (r) {
      return '<li><b>' + esc(r.title || 'Խրախուսանք') + '</b> · №' + esc(r.orderNumber || '—') +
        ' · ' + esc(fmtDate(r.date)) +
        (r.note && !r.hasPdf ? ' — ' + esc(r.note) : '') +
        (r.hasPdf
          ? ' <button type="button" class="kmPcMini" data-km-enc-pdf="' + esc(r.id) + '">PDF</button>'
          : '') +
        '</li>';
    }, 'Խրախուսանք չկա');

    var charHtml = s.characteristic
      ? ('<p style="margin:6px 0 0"><b>Կա բնութագիր</b>' +
        (s.characteristic.note ? ' — ' + esc(s.characteristic.note) : '') +
        (s.characteristic.hasPdf
          ? ' <button type="button" class="kmPcMini" id="kmPcCharPdf">PDF</button>'
          : ' <span class="muted">(PDF չկա)</span>') +
        '</p>')
      : '<p class="muted" style="margin:6px 0 0">Բնութագիր կցված չէ</p>';

    var medHtml = listOrEmpty(s.medical.slice(0, 6), function (r) {
      return '<li>' + esc(r.kind || 'այց') + ' · ' + esc(fmtDate(r.from)) +
        (r.to ? ' → ' + esc(fmtDate(r.to)) : '') +
        (r.note ? ' — ' + esc(r.note) : '') + '</li>';
    }, 'Բուժկետ գրառում չկա');

    var examHtml = listOrEmpty((s.exams || []).slice(0, 8), function (r) {
      return '<li><b>' + esc(r.title || r.kind || 'Ծառայողական քննություն') + '</b>' +
        (r.whenDate || r.createdAt ? ' · ' + esc(fmtDate(r.whenDate || r.createdAt)) : '') +
        (r.conclusion || r.text ? ' — ' + esc(String(r.conclusion || r.text).slice(0, 120)) : '') +
        '</li>';
    }, 'Ծառայողական քննություն չկա');

    var vacHtml = listOrEmpty((s.vacations || []).slice(0, 8), function (r) {
      return '<li>' + esc(r.kind || 'արձակուրդ') + ' · ' + esc(fmtDate(r.from || r.start)) +
        (r.to || r.end ? ' → ' + esc(fmtDate(r.to || r.end)) : '') +
        (r.note ? ' — ' + esc(r.note) : '') + '</li>';
    }, 'Արձակուրդ չկա');

    var canEditApp = typeof window.kmCanEditPersonnelOp === 'function'
      ? !!window.kmCanEditPersonnelOp('card')
      : (typeof window.kmCanEdit === 'function' ? window.kmCanEdit() : true);
    var appHtml = listOrEmpty(s.appointments.slice(0, 12), function (r, i) {
      return '<li data-km-app-i="' + i + '"><b>' + esc(r.post || '\u2014') + '</b>' +
        (r.orderNumber ? ' \u00b7 \u0570\u0580\u0561\u0574\u0561\u0576 \u2116' + esc(r.orderNumber) : '') +
        (r.date ? ' \u00b7 ' + esc(fmtDate(r.date)) : '') +
        (r.note ? ' \u2014 ' + esc(r.note) : '') +
        (canEditApp ? ' <button type="button" class="kmPcMini" data-km-app-del="' + i + '">\u0540\u0565\u057c\u0561\u0581\u0576\u0565\u056c</button>' : '') +
        '</li>';
    }, '\u0546\u0577\u0561\u0576\u0561\u056f\u0574\u0561\u0576 \u057a\u0561\u057f\u0574\u0578\u0582\u0569\u0575\u0578\u0582\u0576 \u0579\u056f\u0561');

    return '' +
      '<div class="kmPcLinked" data-km-person-linked="1">' +
        '<h4 style="margin:16px 0 8px">Պաշտոն և նշանակում</h4>' +
        '<div class="kmPcGrid">' /* KM_PC_HIDE_POST_FIELDS_V1: hide unit/post/code/ranks/specialty from Person Card */ +
          '<input type="hidden" id="kmPcSection" value="' + esc(section) + '">' +
          '<input type="hidden" id="kmPcPost" value="' + esc(post) + '">' +
          '<input type="hidden" id="kmPcPostCode" value="' + esc(postCode) + '">' +
          '<input type="hidden" id="kmPcRankSlot" value="' + esc(rankSlot) + '">' +
          '<input type="hidden" id="kmPcRank" value="' + esc(personRank) + '">' +
          '<input type="hidden" id="kmPcSpecialty" value="' + esc(specialty) + '">' +
          '<label class="kmPcField"><span>Նշանակման հրաման №</span>' +
            '<input id="kmPcPosOrder" type="text" value="' + esc(posOrder) + '"' + ro + '></label>' +
          '<label class="kmPcField"><span>Նշանակման ամսաթիվ</span>' +
            '<input id="kmPcAppDate" type="date" value="' + esc(String(appDate || '').slice(0, 10)) + '"' + dis + '></label>' +
        '</div>' +
        '<div class="kmPcLinkedSub">\u0546\u0577\u0561\u0576\u0561\u056f\u0578\u0582\u0574\u0576\u0565\u0580\u056b \u057a\u0561\u057f\u0574\u0578\u0582\u0569\u0575\u0578\u0582\u0576</div>' + appHtml +
        (canEditApp
          ? '<div style="margin-top:8px"><button type="button" id="kmPcAppPush">\u0533\u0580\u0561\u0576\u0581\u0565\u056c \u0568\u0576\u0569\u0561\u0581\u056b\u056f \u057a\u0561\u0577\u057f\u0578\u0576\u0568 \u057a\u0561\u057f\u0574\u0578\u0582\u0569\u0575\u0578\u0582\u0576\u0578\u0582\u0574</button></div>'
          : '') +
        '<h4 style="margin:16px 0 8px">Տույժեր (գործող գրառումներ + PDF) <span class="muted">(' + s.penalties.length + ')</span></h4>' +
        penHtml +
        (s.penaltiesArchive && s.penaltiesArchive.length
          ? ('<div class="kmPcLinkedSub">Տույժերի արխիվ (' + s.penaltiesArchive.length + ')</div>' +
            listOrEmpty(s.penaltiesArchive.slice(0, 6), function (r) {
              return '<li class="muted"><b>' + esc(penaltyLabel(r.type)) + '</b> · №' + esc(r.orderNumber || '—') +
                ' · ' + esc(fmtDate(r.receivedAt)) +
                (r.hasOrderPdf ? ' <button type="button" class="kmPcMini" data-km-pen-pdf="' + esc(r.id) + '">PDF</button>' : '') +
                '</li>';
            }, ''))
          : '') +
        '<h4 style="margin:16px 0 8px">Խրախուսանքներ <span class="muted">(' + s.encouragements.length + ')</span></h4>' +
        encHtml +
        '<h4 style="margin:16px 0 8px">Բնութագիր</h4>' + charHtml +
        '<h4 style="margin:16px 0 8px">Բուժկետ</h4>' + medHtml +
        '<h4 style="margin:16px 0 8px">Ծառայողական քննություններ <span class="muted">(' + (s.exams || []).length + ')</span></h4>' + examHtml +
        '<h4 style="margin:16px 0 8px">Արձակուրդներ <span class="muted">(' + (s.vacations || []).length + ')</span></h4>' + vacHtml +
        '<div class="kmPcLinkedActions">' +
          '<button type="button" id="kmPcOpenDisc">Տույժերի բաժին</button>' +
          '<button type="button" id="kmPcOpenEnc">Խրախուսանքներ</button>' +
          '<button type="button" id="kmPcOpenChar">Բնութագիր</button>' +
          '<button type="button" id="kmPcOpenMed">Բուժկետ</button>' +
        '</div>' +
      '</div>';
  };

  window.kmPersonLinkedBind = function (box, person, idx) {
    if (!box || !person) return;
    var name = String(person.name || '').trim();
    window._kmPersonCardOpenName = name;
    window._kmPersonCardOpenIndex = idx;
    try {
      box.querySelectorAll('[data-km-allow-edit="1"]').forEach(function (el) {
        el.disabled = false;
        el.readOnly = false;
        el.removeAttribute('readonly');
        el.removeAttribute('disabled');
      });
    } catch (eUnlock) {}

    box.querySelectorAll('[data-km-pen-pdf]').forEach(function (btn) {
      btn.onclick = function () {
        if (typeof window.kmDisciplineViewPdf === 'function') {
          window.kmDisciplineViewPdf(btn.getAttribute('data-km-pen-pdf'));
        }
      };
    });
    box.querySelectorAll('[data-km-enc-pdf]').forEach(function (btn) {
      btn.onclick = function () {
        if (typeof window.kmEncouragementViewPdf === 'function') {
          window.kmEncouragementViewPdf(btn.getAttribute('data-km-enc-pdf'));
        }
      };
    });
    var charPdf = box.querySelector('#kmPcCharPdf');
    if (charPdf) {
      charPdf.onclick = function () {
        if (typeof window.kmCharacteristicViewPdf === 'function') {
          window.kmCharacteristicViewPdf(name);
        }
      };
    }

    function closeAnd(fn) {
      var m = document.getElementById('kmExtModal');
      if (m) m.remove();
      try { document.body.classList.remove('km-boot-idle'); } catch (e0) {}
      if (typeof window.kmCloseFlyMenus === 'function') window.kmCloseFlyMenus();
      if (typeof fn === 'function') fn();
    }
    function openLawFromCard(sub) {
      var personName = name;
      var rank = String((person && person.rank) || '').trim();
      var cardIdx = Number(window._kmPersonCardOpenIndex);
      window._kmLawSubPage = sub;
      window._kmLawSubBack = 'kmLawSubBackToPersonCard()';
      window._kmLawSubPerson = personName;
      window._kmLawSubRank = rank;
      closeAnd(function () {
        if (sub === 'discipline' && typeof window.kmDisciplinePenaltiesPage === 'function') {
          window.kmDisciplinePenaltiesPage({
            back: 'kmLawSubBackToPersonCard()',
            personName: personName,
            rank: rank
          });
        } else if (sub === 'encouragements' && typeof window.kmEncouragementsPage === 'function') {
          window.kmEncouragementsPage({
            back: 'kmLawSubBackToPersonCard()',
            personName: personName,
            rank: rank
          });
        } else if (sub === 'characteristic' && typeof window.kmCharacteristicPage === 'function') {
          window.kmCharacteristicPage({
            back: 'kmLawSubBackToPersonCard()',
            personName: personName,
            rank: rank
          });
        } else if (typeof window.kmLawDocsPage === 'function') {
          window.kmLawDocsPage();
        }
      });
    }
    var openDisc = box.querySelector('#kmPcOpenDisc');
    if (openDisc) openDisc.onclick = function () { openLawFromCard('discipline'); };
    var openEnc = box.querySelector('#kmPcOpenEnc');
    if (openEnc) openEnc.onclick = function () { openLawFromCard('encouragements'); };
    var openChar = box.querySelector('#kmPcOpenChar');
    if (openChar) openChar.onclick = function () { openLawFromCard('characteristic'); };
    var openMed = box.querySelector('#kmPcOpenMed');
    if (openMed) openMed.onclick = function () {
      closeAnd(function () {
        if (typeof window.kmUnitOpen === 'function') window.kmUnitOpen('unitMedical');
      });
    };
    box.querySelectorAll('[data-km-app-del]').forEach(function (btn) {
      btn.onclick = function () {
        var i = Number(btn.getAttribute('data-km-app-del'));
        if (!Array.isArray(person.appointments)) return;
        if (i < 0 || i >= person.appointments.length) return;
        if (!confirm('\u0540\u0565\u057c\u0561\u0581\u0576\u0565\u055e\u056c \u0576\u0577\u0561\u0576\u0561\u056f\u0574\u0561\u0576 \u0563\u0580\u0561\u057c\u0578\u0582\u0574\u0568 \u057a\u0561\u057f\u0574\u0578\u0582\u0569\u0575\u0578\u0582\u0576\u056b\u0581')) return;
        person.appointments.splice(i, 1);
        if (typeof save === 'function') save(true);
        window.kmPersonCardRefreshLinked(box, person, idx);
      };
    });
    var pushBtn = box.querySelector('#kmPcAppPush');
    if (pushBtn) pushBtn.onclick = function () {
      /* KM_PERSON_CARD_SECTION_SAVE_V1 */
      var section = String((box.querySelector('#kmPcSection') || {}).value || '').trim();
      var post = String((box.querySelector('#kmPcPost') || {}).value || '').trim();
      var postCode = String((box.querySelector('#kmPcPostCode') || {}).value || '').trim();
      var posOrder = String((box.querySelector('#kmPcPosOrder') || {}).value || '').trim();
      var appDate = String((box.querySelector('#kmPcAppDate') || {}).value || '').trim()
        || new Date().toISOString().slice(0, 10);
      if (!post) { if (typeof toast === 'function') toast('\u0546\u0561\u056d \u056c\u0580\u0561\u0581\u0580\u0565\u0584 \u057a\u0561\u0577\u057f\u0578\u0576\u0568', 'warn'); return; }
      if (!Array.isArray(person.appointments)) person.appointments = [];
      window.kmPersonDedupeAppointments(person, true);
      var dupIdx = person.appointments.findIndex(function (x) {
        return appointmentPostKey(x && x.post) === appointmentPostKey(post);
      });
      person.post = post; person.postCode = postCode; person.posCode = postCode;
      person.posOrder = posOrder; person.appointmentDate = appDate;
      if (dupIdx >= 0) {
        var existing = person.appointments[dupIdx];
        existing.orderNumber = posOrder || existing.orderNumber || '';
        existing.date = appDate || existing.date || '';
        if (dupIdx > 0) {
          person.appointments.splice(dupIdx, 1);
          person.appointments.unshift(existing);
        }
        if (typeof save === 'function') save(true);
        window.kmPersonCardRefreshLinked(box, person, idx);
        if (typeof toast === 'function') toast('Պաշտոնը արդեն կա պատմության մեջ', 'warn');
        return;
      }
      person.appointments.unshift({ post: post, orderNumber: posOrder, date: appDate, note: '' });
      if (person.appointments.length > 30) person.appointments.length = 30;
      if (typeof save === 'function') save(true);
      window.kmPersonCardRefreshLinked(box, person, idx);
      if (typeof toast === 'function') toast('Նշանակումը ավելացվեց պատմության մեջ', 'ok');
    };
  };

  window.kmPersonCardRefreshLinked = function (box, person, idx) {
    if (!box || !person || typeof window.kmPersonLinkedSectionsHtml !== 'function') return;
    var old = box.querySelector('[data-km-person-linked]');
    if (!old) return;
    var wrap = document.createElement('div');
    wrap.innerHTML = window.kmPersonLinkedSectionsHtml(person.name);
    var neu = wrap.querySelector('[data-km-person-linked]');
    if (!neu) return;
    old.replaceWith(neu);
    if (typeof window.kmPersonLinkedBind === 'function') {
      window.kmPersonLinkedBind(box, person, idx != null ? idx : window._kmPersonCardOpenIndex);
    }
  };

  window.kmPersonLinkedCollect = function (box, person) {
    if (!box || !person) return;
    if (typeof window.kmCanEditPersonnelOp === 'function' && !window.kmCanEditPersonnelOp('card')) return;
    /* KM_PC_COLLECT_KEEP_V1 + KM_PC_HIDE_POST_FIELDS_V1 */
    function pcVal(id, fallback) {
      var el = box.querySelector('#' + id);
      if (!el) return fallback == null ? '' : String(fallback);
      return String(el.value || '').trim();
    }
    var post = pcVal('kmPcPost', person.post);
    var specialty = pcVal('kmPcSpecialty', person.specialty);
    var postCode = pcVal('kmPcPostCode', person.postCode || person.posCode || person.code);
    if (!postCode) postCode = pcVal('kmPcPosCode', postCode);
    var rankSlot = pcVal('kmPcRankSlot', person.rankSlot);
    var personRank = pcVal('kmPcRank', person.rank);
    var posOrder = pcVal('kmPcPosOrder', person.posOrder);
    var appDate = pcVal('kmPcAppDate', person.appointmentDate);
    if (postCode && specialty === postCode) specialty = '';
    if (typeof window.kmLooksLikeStaffCode === 'function' && window.kmLooksLikeStaffCode(specialty)) specialty = '';
    if (post) person.post = post;
    if (specialty !== undefined) person.specialty = specialty;
    if (postCode) { person.postCode = postCode; person.posCode = postCode; }
    if (rankSlot) person.rankSlot = rankSlot;
    if (personRank) person.rank = personRank;
    person.posOrder = posOrder;
    person.appointmentDate = appDate;
    if (!Array.isArray(person.appointments)) person.appointments = [];
    window.kmPersonDedupeAppointments(person, true);
    if (!db.unitDossiers || typeof db.unitDossiers !== 'object') db.unitDossiers = {};
    var d = db.unitDossiers[person.name] || {};
    d.post = post;
    d.postCode = postCode;
    d.rankSlot = rankSlot;
    d.specialty = specialty;
    d.education = person.education || d.education || '';
    if (Array.isArray(person.educations)) d.educations = person.educations.slice();
    d.family = person.familyStatus || person.family || d.family || '';
    db.unitDossiers[person.name] = d;

    var rows = (((db.troopStructure || {}).staff || {}).rows) || [];
    rows.forEach(function (r) {
      if (!r || !samePerson(r.name, person.name)) return;
      if (post) r.position = post;
      if (posOrder) r.posOrder = posOrder;
      if (postCode) r.code = postCode;
      r.vus = specialty;
      r.specialty = specialty;
    });
    try {
      if (typeof window.kmWritePersonStaffToArchive === 'function') {
        window.kmWritePersonStaffToArchive(person, { code: postCode, specialty: specialty, post: post, posOrder: posOrder });
      }
    } catch (eArch) {}
  };

  window.kmLawSubBackToPersonCard = function () {
    window._kmLawSubPage = '';
    window._kmLawSubBack = '';
    window._kmLawSubNavBack = '';
    var idx = Number(window._kmPersonCardOpenIndex);
    var name = String(window._kmPersonCardOpenName || '').trim();
    if (name) {
      if (!(db.people || [])[idx] || !samePerson((db.people[idx] || {}).name, name)) {
        idx = (db.people || []).findIndex(function (p) { return p && samePerson(p.name, name); });
      }
    }
    if (idx >= 0 && typeof window.kmOpenPersonCard === 'function') {
      window.kmOpenPersonCard(idx);
      return;
    }
    if (typeof window.kmOpenPage === 'function') window.kmOpenPage('people');
  };

  window.kmPersonCardNotify = function (personName) {
    personName = String(personName || '').trim();
    if (!personName || !window._kmPersonCardOpenName) return;
    if (!samePerson(window._kmPersonCardOpenName, personName)) return;
    var idx = Number(window._kmPersonCardOpenIndex);
    if (!(db.people || [])[idx] || !samePerson(db.people[idx].name, personName)) {
      idx = (db.people || []).findIndex(function (p) { return p && samePerson(p.name, personName); });
    }
    if (idx < 0) return;
    var person = (db.people || [])[idx];
    var m = document.getElementById('kmExtModal');
    if (m && person && m.querySelector('[data-km-person-linked]')) {
      var box = m.querySelector('.kmPcWrap') || m;
      window.kmPersonCardRefreshLinked(box, person, idx);
      return;
    }
    if (m) m.remove();
    if (typeof window.kmOpenPersonCard === 'function') window.kmOpenPersonCard(idx);
  };

  function hook(name, afterNameArg) {
    var orig = window[name];
    if (typeof orig !== 'function' || orig.__kmLinked) return;
    window[name] = async function () {
      var args = arguments;
      var r = await orig.apply(this, args);
      try {
        var n = afterNameArg ? afterNameArg(args) : '';
        if (n) window.kmPersonCardNotify(n);
      } catch (e) {}
      return r;
    };
    window[name].__kmLinked = true;
  }

  function injectCss() {
    if (document.getElementById('km-person-linked-css')) return;
    var s = document.createElement('style');
    s.id = 'km-person-linked-css';
    s.textContent =
      '.kmPcLinkedList{margin:6px 0 0;padding-left:18px;font-size:13px;line-height:1.45}' +
      '.kmPcLinkedSub{font-size:12px;color:#5a6b78;margin:8px 0 0}' +
      '.kmPcLinkedActions{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}' +
      '.kmPcMini{padding:2px 8px;font-size:11px;margin-left:4px}';
    (document.head || document.documentElement).appendChild(s);
  }

  function patchHooks() {
    if (typeof window.kmDisciplineDeleteArchive === 'function' && !window.kmDisciplineDeleteArchive.__kmLinked) {
      var delA = window.kmDisciplineDeleteArchive;
      window.kmDisciplineDeleteArchive = async function (id) {
        var row = (db.disciplinePenaltiesArchive || []).find(function (x) { return x && String(x.id) === String(id); });
        var nm = (row && row.personName) || window._kmPersonCardOpenName || '';
        var r = await delA.apply(this, arguments);
        try { window.kmPersonCardNotify(nm); } catch (e) {}
        return r;
      };
      window.kmDisciplineDeleteArchive.__kmLinked = true;
    }
    hook('kmDisciplineAdd', function () {
      var el = document.getElementById('kmDiscPerson');
      return el ? el.value : '';
    });
    if (typeof window.kmDisciplineRemoveEarly === 'function' && !window.kmDisciplineRemoveEarly.__kmLinked) {
      var rem = window.kmDisciplineRemoveEarly;
      window.kmDisciplineRemoveEarly = async function (id) {
        var row = (db.disciplinePenalties || []).find(function (x) { return x && String(x.id) === String(id); });
        var nm = (row && row.personName) || window._kmPersonCardOpenName || '';
        var r = await rem.apply(this, arguments);
        try { window.kmPersonCardNotify(nm); } catch (e) {}
        return r;
      };
      window.kmDisciplineRemoveEarly.__kmLinked = true;
    }
    hook('kmEncouragementAdd', function () {
      var el = document.getElementById('kmEncPerson');
      return el ? el.value : '';
    });
    if (typeof window.kmEncouragementDelete === 'function' && !window.kmEncouragementDelete.__kmLinked) {
      var encDel = window.kmEncouragementDelete;
      window.kmEncouragementDelete = async function (id) {
        var row = (db.personEncouragements || []).find(function (x) { return x && String(x.id) === String(id); });
        var nm = (row && row.personName) || window._kmPersonCardOpenName || '';
        var r = await encDel.apply(this, arguments);
        try { window.kmPersonCardNotify(nm); } catch (e) {}
        return r;
      };
      window.kmEncouragementDelete.__kmLinked = true;
    }
    hook('kmCharacteristicAdd', function () {
      var el = document.getElementById('kmCharPerson');
      return el ? el.value : '';
    });
    hook('kmCharacteristicDelete', function (args) {
      return args[0] || '';
    });
    hook('kmUnitMedSave', function () {
      var el = document.getElementById('kmUtMedPerson');
      return el ? el.value : '';
    });
    if (typeof window.kmUnitDosEdit === 'function' && !window.kmUnitDosEdit.__kmLinked) {
      var dos = window.kmUnitDosEdit;
      window.kmUnitDosEdit = function (name) {
        dos(name);
        setTimeout(function () {
          var btn = document.getElementById('kmUtDosSave');
          if (!btn || btn.__kmLinked) return;
          var prev = btn.onclick;
          btn.onclick = async function () {
            if (typeof prev === 'function') await prev();
            // Sync person.post from dossier
            var d = (db.unitDossiers && db.unitDossiers[name]) || {};
            var p = (db.people || []).find(function (x) {
              return x && String(x.name || '').trim() === String(name || '').trim();
            });
            if (p) {
              if (d.post != null) p.post = d.post;
              if (d.specialty != null) p.specialty = d.specialty;
              if (d.education != null) p.education = d.education;
              if (d.family != null) { p.family = d.family; p.familyStatus = d.family; }
            }
            window.kmPersonCardNotify(name);
          };
          btn.__kmLinked = true;
        }, 0);
      };
      window.kmUnitDosEdit.__kmLinked = true;
    }
  }

  function boot() {
    injectCss();
    patchHooks();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
  setTimeout(boot, 0);
})();

/* KM_PERSONNEL_LEGAL_BIDI_SYNC_V1 bridge */
(function bridgeLegalBus() {
  if (window.__kmLegalBusBridged) return;
  window.__kmLegalBusBridged = true;
  document.addEventListener('km-personnel-sync', function (ev) {
    try {
      var n = ev && ev.detail && ev.detail.name;
      if (n && typeof window.kmPersonCardNotify === 'function') window.kmPersonCardNotify(n);
    } catch (e) {}
  });
})();

