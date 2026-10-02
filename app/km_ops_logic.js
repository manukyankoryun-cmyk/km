/* KM ops core — graphs, conflicts, today roster. Browser + Node. */
(function (root) {
  'use strict';

  function occupied(v) {
    return String(v == null ? '' : v).trim() !== '';
  }

  function personName(p) {
    return String((p && (p.name || p.fullName || p.person)) || '').trim();
  }

  function collectGraphs(db) {
    const out = [];
    if (!db || typeof db !== 'object') return out;
    const s = db.schedule || {};
    out.push({
      key: 'main',
      name: String(s.name || 'Հիմնական'),
      year: +s.year || 0,
      month: +s.month || 0,
      rows: s.rows && typeof s.rows === 'object' ? s.rows : {},
      selectedPeople: Array.isArray(s.selectedPeople) ? s.selectedPeople : []
    });
    const map = db.dutyTypeSchedules && typeof db.dutyTypeSchedules === 'object' ? db.dutyTypeSchedules : {};
    Object.keys(map).forEach((k) => {
      const sch = map[k];
      if (!sch || typeof sch !== 'object') return;
      const idx = Number(String(k).replace(/^duty_/, ''));
      const name = (!Number.isNaN(idx) && (db.dutyTypes || [])[idx]) || sch.name || k;
      out.push({
        key: k,
        name: String(name),
        year: +sch.year || +s.year || 0,
        month: +sch.month || +s.month || 0,
        rows: sch.assignments || sch.rows || {},
        selectedPeople: Array.isArray(sch.selectedPeople) ? sch.selectedPeople : []
      });
    });
    return out;
  }

  function cellValue(rows, name, day) {
    if (!rows || !name) return '';
    const want = String(name).trim();
    let row = rows[name] || rows[want];
    if (!row) {
      const keys = Object.keys(rows);
      for (let i = 0; i < keys.length; i++) {
        if (String(keys[i]).trim() === want) {
          row = rows[keys[i]];
          break;
        }
      }
    }
    row = row || {};
    return row[day] != null ? row[day] : row[String(day)];
  }

  function isPersonName(n) {
    const t = String(n || '').trim();
    if (!t) return false;
    if (typeof root.kmLooksLikePersonName === 'function') return !!root.kmLooksLikePersonName(t);
    if (typeof root.kmLooksLikeLegalOrderText === 'function' && root.kmLooksLikeLegalOrderText(t)) return false;
    if (/հրաման/i.test(t) && (/N\s*\d+|№|առ\s+\d{1,2}[./]/i.test(t) || t.length > 28)) return false;
    return /[Ա-Ֆա-ֆA-Za-zЁёА-Яа-я]/.test(t);
  }

  function graphSelectedNames(g) {
    if (!g || !Array.isArray(g.selectedPeople)) return [];
    return g.selectedPeople.map((n) => String(n || '').trim()).filter(isPersonName);
  }

  function rowHasDuty(row) {
    if (!row || typeof row !== 'object') return false;
    return Object.keys(row).some((k) => occupied(row[k]));
  }

  function graphDutyNames(g) {
    const sel = graphSelectedNames(g);
    const rows = g && g.rows && typeof g.rows === 'object' ? g.rows : {};
    const out = [];
    const seen = {};
    function add(n) {
      const t = String(n || '').trim();
      if (!t || seen[t] || !isPersonName(t)) return;
      seen[t] = 1;
      out.push(t);
    }
    if (sel.length) {
      sel.forEach(add);
    } else {
      Object.keys(rows).forEach((k) => {
        if (rowHasDuty(rows[k])) add(k);
      });
    }
    return out;
  }

  function graphPeople(db, g) {
    const all = db && Array.isArray(db.people) ? db.people : [];
    const names = graphDutyNames(g);
    if (!names.length) return [];
    const set = {};
    names.forEach((n) => { set[n] = 1; });
    const matched = all.filter((p) => {
      const n = personName(p);
      return !!(set[n] || set[String((p && p.name) || '').trim()]);
    });
    const have = {};
    matched.forEach((p) => { have[personName(p)] = 1; });
    names.forEach((n) => {
      if (!have[n]) matched.push({ name: n, rank: '', unit: '', post: '' });
    });
    return matched;
  }

  function dashboardAnchorDate(db, dateObj, opts) {
    const now = dateObj instanceof Date ? dateObj : new Date();
    try {
      if (todayDutyRows(db, now, opts).length) return now;
    } catch (e0) {}
    const graphs = collectGraphs(db);
    const dayNum = now.getDate();
    let best = null;
    let bestN = -1;
    const seen = {};
    graphs.forEach((g) => {
      const y = +g.year;
      const m = +g.month;
      if (!y || !m) return;
      const key = y + '-' + m;
      if (seen[key]) return;
      seen[key] = 1;
      const max = new Date(y, m, 0).getDate();
      const dt = new Date(y, m - 1, Math.min(dayNum, max), 12, 0, 0);
      let n = 0;
      try { n = todayDutyRows(db, dt, opts).length; } catch (e1) { n = 0; }
      if (n > bestN) {
        bestN = n;
        best = dt;
      }
    });
    if (best && bestN > 0) return best;
    const s = db && db.schedule && typeof db.schedule === 'object' ? db.schedule : {};
    const y = +s.year || 0;
    const m = +s.month || 0;
    if (y && m && (y !== now.getFullYear() || m !== now.getMonth() + 1)) {
      const max = new Date(y, m, 0).getDate();
      return new Date(y, m - 1, Math.min(Math.max(1, now.getDate()), max), 12, 0, 0);
    }
    return now;
  }

  function graphCap(db, g) {
    if (!g || g.key === 'main') return 1;
    const idx = Number(String(g.key).replace(/^duty_/, ''));
    const post = (db && Array.isArray(db.dutyPosts) ? db.dutyPosts : [])[idx] || {};
    const max = Number(post.maxPeople);
    return max > 0 ? max : 0;
  }

  function personBadSet(p, db) {
    const days = {};
    function add(arr) {
      (arr || []).forEach((n) => {
        const d = Number(n);
        if (d >= 1 && d <= 31) days[d] = 1;
      });
    }
    add(p && p.bad);
    add(p && p.badDays);
    add(p && p.inconvenientDays);
    if (db && Array.isArray(db.people)) {
      const name = personName(p);
      if (name) {
        const live = db.people.find((x) => personName(x) === name || String((x && x.name) || '').trim() === name);
        if (live && live !== p) {
          add(live.bad);
          add(live.badDays);
          add(live.inconvenientDays);
        }
      }
    }
    return days;
  }

  function detectConflicts(db, opts) {
    opts = opts || {};
    const out = [];
    const graphs = collectGraphs(db);
    const absence = typeof opts.absence === 'function' ? opts.absence : null;
    const overlap = {};
    graphs.forEach((g) => {
      const y = g.year, m = g.month;
      if (!y || !m) return;
      const days = new Date(y, m, 0).getDate();
      const cap = graphCap(db, g);
      for (let d = 1; d <= days; d++) {
        const onDuty = [];
        graphPeople(db, g).forEach((p) => {
          if (opts.isBlocked && opts.isBlocked(p)) return;
          const name = personName(p);
          if (!name) return;
          const v = cellValue(g.rows, name, d);
          if (!occupied(v)) return;
          onDuty.push(name);
          const stamp = name + '|' + y + '-' + m + '-' + d;
          (overlap[stamp] = overlap[stamp] || []).push(g);
          const dt = new Date(y, m - 1, d, 12, 0, 0);
          if (absence) {
            const k = absence(name, dt);
            if (k) {
              const labels = { vacation: 'արձակուրդ', sick: 'հիվանդություն', trip: 'գործուղում', study: 'ուսում' };
              out.push({
                type: 'vacation', graph: g.key, graphName: g.name, day: d, person: name,
                msg: g.name + ' · ' + name + ' — ' + (labels[k] || k) + ' + հերթապահ (' + d + ')'
              });
            }
          }
          if (personBadSet(p, db)[d]) {
            out.push({
              type: 'badDay', graph: g.key, graphName: g.name, day: d, person: name,
              msg: g.name + ' · ' + name + ' — անհարմար օր + հերթապահ (' + d + ')'
            });
          }
        });
        if (cap > 0 && onDuty.length > cap) {
          out.push({
            type: 'multi', graph: g.key, graphName: g.name, day: d, person: onDuty.join(', '),
            msg: g.name + ' · հերթապահների քանակը գերազանցում է (' + d + ')՝ ' + onDuty.join(', ')
          });
        }
      }
    });
    Object.keys(overlap).forEach((stamp) => {
      const hit = overlap[stamp];
      if (!hit || hit.length < 2) return;
      const parts = stamp.split('|');
      const name = parts[0];
      const day = Number(String(parts[1] || '').split('-')[2]);
      out.push({
        type: 'overlap',
        graph: hit.map((g) => g.key).join(','),
        graphName: hit.map((g) => g.name).join(' + '),
        day: day,
        person: name,
        msg: name + ' — նույն օրը (' + day + ') մի քանի վերակարգում՝ ' + hit.map((g) => g.name).join(', ')
      });
    });
    return out;
  }

  function todayDutyRows(db, dateObj, opts) {
    opts = opts || {};
    const today = dateObj instanceof Date ? dateObj : new Date();
    const day = today.getDate();
    const m = today.getMonth() + 1;
    const y = today.getFullYear();
    const absence = typeof opts.absence === 'function' ? opts.absence : null;
    const dt = new Date(y, m - 1, day, 12, 0, 0);
    const rowsOut = [];
    const people = db && Array.isArray(db.people) ? db.people : [];
    collectGraphs(db).forEach((g) => {
      if (+g.month !== m || +g.year !== y) return;
      const map = g.rows && typeof g.rows === 'object' ? g.rows : {};
      const seen = {};
      Object.keys(map).forEach((rawName) => {
        const name = String(rawName || '').trim();
        if (!name || seen[name] || !isPersonName(name)) return;
        const v = cellValue(map, name, day);
        if (!occupied(v)) return;
        if (absence && absence(name, dt)) return;
        seen[name] = 1;
        let p = people.find((x) => personName(x) === name) || people.find((x) => String((x && x.name) || '').trim() === name);
        if (!p) p = { name, rank: '', unit: '', phone: '' };
        rowsOut.push({
          graph: g.key,
          graphName: g.name,
          name,
          rank: p.rank || '',
          unit: p.unit || '',
          phone: p.phone || '',
          mark: String(v).trim()
        });
      });
    });
    return rowsOut;
  }

  function freePeopleOnDate(db, dateObj, opts) {
    opts = opts || {};
    const today = dateObj instanceof Date ? dateObj : new Date();
    const duty = todayDutyRows(db, today, opts);
    const busy = {};
    duty.forEach((r) => { if (r && r.name) busy[String(r.name).trim()] = 1; });
    const absence = typeof opts.absence === 'function' ? opts.absence : null;
    const blocked = typeof opts.isBlocked === 'function' ? opts.isBlocked : null;
    const dt = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12, 0, 0);
    const out = [];
    /* KM_FREE_POOL_FROM_TROOP_V1 */ (function () {
      var pool = [];
      try {
        var rows = (((db && db.troopStructure) || {}).staff || {}).rows || [];
        rows.forEach(function (r) {
          if (!r || r.type === 'section') return;
          var nm = String(r.name || '').trim();
          if (!nm) return;
          pool.push({ name: nm, rank: r.rank || '', unit: r.unit || '', post: r.position || r.post || '' });
        });
      } catch (eTroop) {}
      if (!pool.length && db && Array.isArray(db.people)) pool = db.people;
      return pool;
    })().forEach((p) => {
      const name = personName(p);
      if (!name) return;
      if (blocked && blocked(p)) return;
      if (personContractEnded(p, dt)) return;
      if (busy[name]) return;
      const k = absence ? absence(name, dt) : null;
      if (k) return;
      out.push({
        name,
        rank: p.rank || '',
        unit: p.unit || '',
        phone: p.phone || '',
        endDate: p.endDate || p.contractEnd || ''
      });
    });
    return out;
  }

  function contractReminders(db, daysAhead, today) {
    const n = Math.max(0, Number(daysAhead) || 30);
    const now = today instanceof Date ? today : new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0).getTime();
    const end = start + n * 86400000;
    const out = [];
    (db && Array.isArray(db.people) ? db.people : []).forEach((p) => {
      const raw = String((p && (p.endDate || p.contractEnd)) || '').trim();
      if (!raw) return;
      const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (!m) return;
      const t = new Date(+m[1], +m[2] - 1, +m[3], 12, 0, 0).getTime();
      if (!Number.isFinite(t)) return;
      const left = Math.round((t - start) / 86400000);
      if (t >= start && t <= end) {
        out.push({
          name: personName(p),
          rank: (p && p.rank) || '',
          unit: (p && p.unit) || '',
          endDate: raw.slice(0, 10),
          daysLeft: left
        });
      }
    });
    out.sort((a, b) => a.daysLeft - b.daysLeft);
    return out;
  }

  function personContractEnded(p, today) {
    const raw = String((p && (p.endDate || p.contractEnd)) || '').trim();
    if (!raw) return false;
    const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return false;
    const now = today instanceof Date ? today : new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0).getTime();
    const t = new Date(+m[1], +m[2] - 1, +m[3], 12, 0, 0).getTime();
    return Number.isFinite(t) && t < start;
  }

  function contractOverdue(db, today) {
    const now = today instanceof Date ? today : new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0).getTime();
    const out = [];
    (db && Array.isArray(db.people) ? db.people : []).forEach((p) => {
      const raw = String((p && (p.endDate || p.contractEnd)) || '').trim();
      if (!raw) return;
      const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (!m) return;
      const t = new Date(+m[1], +m[2] - 1, +m[3], 12, 0, 0).getTime();
      if (!Number.isFinite(t) || t >= start) return;
      out.push({
        name: personName(p),
        rank: (p && p.rank) || '',
        unit: (p && p.unit) || '',
        endDate: raw.slice(0, 10),
        daysLeft: Math.round((t - start) / 86400000)
      });
    });
    out.sort((a, b) => a.daysLeft - b.daysLeft);
    return out;
  }

  function swapCells(rowsA, nameA, rowsB, nameB, day) {
    rowsA[nameA] = rowsA[nameA] || {};
    rowsB[nameB] = rowsB[nameB] || {};
    const va = cellValue(rowsA, nameA, day);
    const vb = cellValue(rowsB, nameB, day);
    if (occupied(va)) rowsB[nameB][day] = va; else delete rowsB[nameB][day];
    if (occupied(vb)) rowsA[nameA][day] = vb; else delete rowsA[nameA][day];
    return { va, vb };
  }

  function dayRange(fromDay, toDay) {
    const a = Math.min(Number(fromDay) || 0, Number(toDay) || 0);
    const b = Math.max(Number(fromDay) || 0, Number(toDay) || 0);
    const days = [];
    if (a < 1 || b > 31) return days;
    for (let d = a; d <= b; d++) days.push(d);
    return days;
  }

  function swapCellsRange(rows, nameA, nameB, fromDay, toDay) {
    const days = dayRange(fromDay, toDay);
    days.forEach((d) => swapCells(rows, nameA, rows, nameB, d));
    return days;
  }

  function coverAbsence(rows, fromName, toName, fromDay, toDay) {
    const moved = [];
    const skipped = [];
    const empty = [];
    dayRange(fromDay, toDay).forEach((d) => {
      const va = cellValue(rows, fromName, d);
      const vb = cellValue(rows, toName, d);
      if (!occupied(va)) { empty.push(d); return; }
      if (occupied(vb)) { skipped.push(d); return; }
      rows[fromName] = rows[fromName] || {};
      rows[toName] = rows[toName] || {};
      rows[toName][d] = va;
      delete rows[fromName][d];
      moved.push(d);
    });
    return { moved, skipped, empty };
  }

  const api = { occupied, personName, collectGraphs, cellValue, graphPeople, graphCap, detectConflicts, todayDutyRows, freePeopleOnDate, dashboardAnchorDate, contractReminders, contractOverdue, personContractEnded, swapCells, swapCellsRange, coverAbsence, dayRange };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.kmOpsLogic = api;
})(typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
