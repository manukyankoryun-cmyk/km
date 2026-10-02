/* KM spreadsheet — Excel-like grid with formulas */
(function () {
  'use strict';

  var MAX_COLS = 52;
  var MAX_ROWS = 300;
  var DEF_COLS = 16;
  var DEF_ROWS = 40;
  var activeId = '';
  var sel = 'A1';
  var anchor = 'A1';
  var editing = false;
  var dragging = false;
  var resizing = null;
  var saveTimer = 0;
  var cache = {};
  var clip = null;
  var findQ = '';
  var findHits = [];
  var findI = 0;
  var lastHost = null;

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
  function persist(silent) {
    if (typeof save === 'function') return save(silent !== false);
  }
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
  function canEdit() {
    return typeof window.kmCanEdit !== 'function' || window.kmCanEdit();
  }

  function colName(n) {
    var s = '';
    n = n + 1;
    while (n > 0) {
      var rem = (n - 1) % 26;
      s = String.fromCharCode(65 + rem) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  }
  function colIndex(name) {
    var n = 0;
    String(name || '').toUpperCase().replace(/[^A-Z]/g, '').split('').forEach(function (ch) {
      n = n * 26 + (ch.charCodeAt(0) - 64);
    });
    return n - 1;
  }
  function parseAddr(addr) {
    var m = /^\$?([A-Z]+)\$?([0-9]+)$/i.exec(String(addr || '').trim());
    if (!m) return null;
    return { c: colIndex(m[1]), r: parseInt(m[2], 10) - 1, key: m[1].toUpperCase() + parseInt(m[2], 10) };
  }
  function makeAddr(c, r) {
    return colName(c) + String(r + 1);
  }

  function blankSheet(name) {
    return { id: uid(), name: name || 'Աղյուսակ 1', cols: DEF_COLS, rows: DEF_ROWS, cells: {}, widths: {} };
  }

  function migrateOldTables() {
    if (typeof db === 'undefined' || !db) return;
    if (!Array.isArray(db.spreadsheets)) db.spreadsheets = [];
    if (db.spreadsheets.length) return;
    (db.tables || []).forEach(function (t, ti) {
      if (!t) return;
      var cells = {};
      var maxC = Math.max(1, (t.headers || []).length);
      (t.headers || []).forEach(function (h, ci) {
        if (h != null && String(h) !== '') cells[colName(ci) + '1'] = String(h);
        if (ci + 1 > maxC) maxC = ci + 1;
      });
      (t.rows || []).forEach(function (row, ri) {
        (row || []).forEach(function (v, ci) {
          if (v != null && String(v) !== '') cells[colName(ci) + String(ri + 2)] = String(v);
          if (ci + 1 > maxC) maxC = ci + 1;
        });
      });
      db.spreadsheets.push({
        id: uid(),
        name: t.name || ('Աղյուսակ ' + (ti + 1)),
        cols: Math.min(MAX_COLS, Math.max(DEF_COLS, maxC)),
        rows: Math.min(MAX_ROWS, Math.max(DEF_ROWS, (t.rows || []).length + 1)),
        cells: cells,
        widths: {}
      });
    });
  }

  function ensure() {
    if (typeof db === 'undefined' || !db) return [];
    migrateOldTables();
    if (!Array.isArray(db.spreadsheets)) db.spreadsheets = [];
    if (!db.spreadsheets.length) db.spreadsheets.push(blankSheet('Աղյուսակ 1'));
    db.spreadsheets.forEach(function (sh) {
      if (!sh.id) sh.id = uid();
      if (!sh.cells || typeof sh.cells !== 'object') sh.cells = {};
      if (!sh.widths || typeof sh.widths !== 'object') sh.widths = {};
      sh.cols = Math.min(MAX_COLS, Math.max(2, +sh.cols || DEF_COLS));
      sh.rows = Math.min(MAX_ROWS, Math.max(2, +sh.rows || DEF_ROWS));
      sh.name = String(sh.name || 'Աղյուսակ').trim() || 'Աղյուսակ';
    });
    var cur = db.spreadsheets.find(function (s) { return s.id === activeId; });
    if (!cur) activeId = db.spreadsheets[0].id;
    return db.spreadsheets;
  }
  function sheet() {
    ensure();
    return db.spreadsheets.find(function (s) { return s.id === activeId; }) || db.spreadsheets[0];
  }
  function rawOf(sh, key) {
    var v = sh && sh.cells ? sh.cells[key] : '';
    return v == null ? '' : String(v);
  }
  function setRaw(sh, key, val) {
    val = String(val == null ? '' : val);
    if (!val) delete sh.cells[key];
    else sh.cells[key] = val;
    cache = {};
  }
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { persist(true); }, 400);
  }

  /* ---------- formula engine ---------- */
  function toNum(v) {
    if (v && typeof v === 'object') {
      if (v.e) return NaN;
      if (typeof v.n === 'number') return v.n;
      v = v.s;
    }
    if (typeof v === 'number') return v;
    if (v === true) return 1;
    if (v === false || v == null || v === '') return NaN;
    var s = String(v).trim().replace(/\s/g, '').replace(',', '.');
    if (!s) return NaN;
    var n = Number(s);
    return isFinite(n) ? n : NaN;
  }
  function asNum(v) {
    var n = toNum(v);
    return isFinite(n) ? n : 0;
  }
  function isEmptyVal(v) {
    if (v == null) return true;
    if (typeof v === 'object') {
      if (v.e) return false;
      if (typeof v.n === 'number') return false;
      return String(v.s || '') === '';
    }
    return String(v) === '';
  }
  function truthy(v) {
    if (v && typeof v === 'object') {
      if (v.e) return false;
      if (typeof v.n === 'number') return v.n !== 0;
      return String(v.s || '') !== '';
    }
    if (typeof v === 'number') return v !== 0;
    if (typeof v === 'boolean') return v;
    return String(v || '') !== '';
  }
  function displayVal(v) {
    if (v && typeof v === 'object') {
      if (v.e) return v.e;
      if (typeof v.n === 'number') {
        if (!isFinite(v.n)) return '#NUM!';
        if (Math.abs(v.n) < 1e-12) return '0';
        if (Math.abs(v.n - Math.round(v.n)) < 1e-9) return String(Math.round(v.n));
        return String(Math.round(v.n * 1e8) / 1e8);
      }
      return String(v.s == null ? '' : v.s);
    }
    if (typeof v === 'number') {
      if (!isFinite(v)) return '#NUM!';
      if (Math.abs(v) < 1e-12) return '0';
      if (Math.abs(v - Math.round(v)) < 1e-9) return String(Math.round(v));
      return String(Math.round(v * 1e8) / 1e8);
    }
    return v == null ? '' : String(v);
  }
  function wrap(v) {
    if (v && typeof v === 'object' && ('n' in v || 's' in v || 'e' in v)) return v;
    if (typeof v === 'number') return { n: v };
    if (typeof v === 'boolean') return { n: v ? 1 : 0 };
    var n = toNum(v);
    if (isFinite(n) && String(v).trim() !== '') return { n: n };
    return { s: v == null ? '' : String(v) };
  }
  function numsOf(args) {
    return flatten(args).map(toNum).filter(isFinite);
  }
  function flatten(args) {
    var out = [];
    (args || []).forEach(function (a) {
      if (Array.isArray(a)) a.forEach(function (x) { out.push(x); });
      else out.push(a);
    });
    return out;
  }
  function asGrid(a) {
    if (Array.isArray(a)) {
      if (!a.cols) { a.cols = a.length || 1; a.rows = 1; }
      return a;
    }
    return null;
  }
  function excelSerial(d) {
    return (Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(1899, 11, 30)) / 86400000;
  }
  function fromSerial(n) {
    return new Date(Date.UTC(1899, 11, 30) + Math.round(Number(n)) * 86400000);
  }
  function toDate(v) {
    if (v && typeof v === 'object' && typeof v.n === 'number') return fromSerial(v.n);
    var s = displayVal(v);
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return new Date(s + (s.length === 10 ? 'T00:00:00' : ''));
    var n = toNum(v);
    if (isFinite(n) && n > 200) return fromSerial(n);
    var d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }
  function matchCrit(val, crit) {
    var cs = displayVal(Array.isArray(crit) ? crit[0] : crit);
    var vn = toNum(val), vs = displayVal(val);
    var m = /^(<=|>=|<>|<|>|=)(.*)$/.exec(String(cs));
    if (m) {
      var op = m[1], rhs = m[2], rn = toNum(rhs);
      if (isFinite(vn) && isFinite(rn) && String(rhs).trim() !== '') {
        if (op === '=') return vn === rn;
        if (op === '<>') return vn !== rn;
        if (op === '>') return vn > rn;
        if (op === '<') return vn < rn;
        if (op === '>=') return vn >= rn;
        if (op === '<=') return vn <= rn;
      }
      var cmp = String(vs).localeCompare(rhs, 'hy', { sensitivity: 'accent' });
      if (op === '=') return cmp === 0;
      if (op === '<>') return cmp !== 0;
      if (op === '>') return cmp > 0;
      if (op === '<') return cmp < 0;
      if (op === '>=') return cmp >= 0;
      if (op === '<=') return cmp <= 0;
    }
    if (/[*?]/.test(cs)) {
      try {
        return new RegExp('^' + String(cs).replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i').test(vs);
      } catch (e) { return false; }
    }
    var cn = toNum(cs);
    if (isFinite(vn) && isFinite(cn) && String(cs).trim() !== '') return vn === cn;
    return String(vs).toLocaleLowerCase() === String(cs).toLocaleLowerCase();
  }
  function scanIf(range, crit, values) {
    range = flatten([range]);
    values = values == null ? range : flatten([values]);
    var sum = 0, ncount = 0, hits = 0;
    for (var i = 0; i < range.length; i++) {
      if (!matchCrit(range[i], crit)) continue;
      hits++;
      var n = toNum(values[i]);
      if (isFinite(n)) { sum += n; ncount++; }
    }
    return { sum: sum, ncount: ncount, hits: hits };
  }
  function gcd2(a, b) {
    a = Math.abs(Math.floor(a)); b = Math.abs(Math.floor(b));
    while (b) { var t = b; b = a % b; a = t; }
    return a;
  }
  function fact(n) {
    n = Math.floor(n);
    if (n < 0 || n > 170) return NaN;
    var x = 1; for (var i = 2; i <= n; i++) x *= i; return x;
  }
  function withRef(v, c, r) {
    var o = {};
    if (v && typeof v === 'object' && v.e) o.e = v.e;
    else if (v && typeof v === 'object' && typeof v.n === 'number') o.n = v.n;
    else if (v && typeof v === 'object' && v.s != null) o.s = v.s;
    else {
      var w = wrap(v);
      if (typeof w.n === 'number') o.n = w.n;
      else o.s = w.s;
    }
    o._c = c; o._r = r;
    return o;
  }
  function erf(x) {
    var s = x < 0 ? -1 : 1; x = Math.abs(x);
    var a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
    var t = 1 / (1 + p * x);
    return s * (1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x));
  }
  function normsdist(z) { return 0.5 * (1 + erf(z / Math.SQRT2)); }
  function normsinv(p) {
    if (!(p > 0) || !(p < 1)) return NaN;
    var a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
    var b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
    var c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464858, 2.938163982698783];
    var d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
    var plow = 0.02425, q, r;
    if (p < plow) {
      q = Math.sqrt(-2 * Math.log(p));
      return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }
    if (p > 1 - plow) {
      q = Math.sqrt(-2 * Math.log(1 - p));
      return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }
    q = p - 0.5; r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }
  function linreg(xs, ys) {
    var n = Math.min(xs.length, ys.length), sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, c = 0;
    for (var i = 0; i < n; i++) {
      var x = toNum(xs[i]), y = toNum(ys[i]);
      if (!isFinite(x) || !isFinite(y)) continue;
      sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y; c++;
    }
    if (c < 2) return null;
    var mx = sx / c, my = sy / c;
    var cov = sxy - c * mx * my, vx = sxx - c * mx * mx, vy = syy - c * my * my;
    var slope = vx ? cov / vx : 0;
    return { n: c, slope: slope, intercept: my - slope * mx, r: (vx > 0 && vy > 0) ? cov / Math.sqrt(vx * vy) : 0, vx: vx, vy: vy, cov: cov };
  }
  function irrNewton(cfs, guess) {
    var r = guess == null || !isFinite(guess) ? 0.1 : Number(guess);
    for (var i = 0; i < 80; i++) {
      var npv = 0, d = 0;
      for (var t = 0; t < cfs.length; t++) {
        var v = cfs[t];
        npv += v / Math.pow(1 + r, t);
        d -= t * v / Math.pow(1 + r, t + 1);
      }
      if (Math.abs(d) < 1e-14) break;
      var nr = r - npv / d;
      if (Math.abs(nr - r) < 1e-10) return nr;
      r = nr;
    }
    return r;
  }
  function romanStr(n) {
    n = Math.floor(n);
    if (n < 1 || n > 3999) return null;
    var pairs = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']], s = '';
    pairs.forEach(function (p) { while (n >= p[0]) { s += p[1]; n -= p[0]; } });
    return s;
  }
  function dbParse(g) {
    g = asGrid(g);
    if (!g || !g.length) return null;
    var cols = g.cols || 1, rows = Math.floor(g.length / cols), headers = [], recs = [];
    for (var c = 0; c < cols; c++) headers.push(displayVal(g[c]).toLocaleLowerCase());
    for (var r = 1; r < rows; r++) {
      var rec = {};
      for (var c2 = 0; c2 < cols; c2++) rec[headers[c2]] = g[r * cols + c2];
      recs.push(rec);
    }
    return { headers: headers, recs: recs };
  }
  function dbFiltered(database, criteria) {
    var dbp = dbParse(database);
    if (!dbp) return [];
    var cr = dbParse(criteria);
    if (!cr || !cr.recs.length) return dbp.recs;
    return dbp.recs.filter(function (rec) {
      return cr.recs.some(function (crow) {
        return cr.headers.every(function (h) {
          if (isEmptyVal(crow[h])) return true;
          if (!Object.prototype.hasOwnProperty.call(rec, h)) return true;
          return matchCrit(rec[h], crow[h]);
        });
      });
    });
  }
  function dbFieldVals(recs, field) {
    var key = displayVal(field).toLocaleLowerCase();
    var idx = Math.floor(asNum(field));
    var useIdx = isFinite(idx) && idx >= 1 && String(displayVal(field)).trim() === String(idx);
    return recs.map(function (rec) {
      if (useIdx) {
        var keys = Object.keys(rec);
        return rec[keys[idx - 1]];
      }
      return rec[key];
    });
  }
  function joinVals(arr) { return { s: (arr || []).map(displayVal).join(', ') }; }
  function permut(n, k) {
    n = Math.floor(n); k = Math.floor(k);
    if (k < 0 || n < k || n < 0) return NaN;
    var x = 1; for (var i = 0; i < k; i++) x *= (n - i); return x;
  }
  function originOf(v) {
    if (v && typeof v === 'object' && v._c != null) return { c: v._c, r: v._r, cols: 1, rows: 1 };
    if (Array.isArray(v) && v.startC != null) return { c: v.startC, r: v.startR, cols: v.cols || 1, rows: v.rows || 1 };
    return null;
  }

  var FN = {
    SUM: function (args) { return { n: flatten(args).reduce(function (a, v) { var n = toNum(v); return a + (isFinite(n) ? n : 0); }, 0) }; },
    SUMIF: function (args) { var s = scanIf(args[0], args[1], args[2]); return { n: s.sum }; },
    SUMIFS: function (args) {
      var sumR = flatten([args[0]]), n = sumR.length, tot = 0;
      for (var i = 0; i < n; i++) {
        var ok = true;
        for (var p = 1; p + 1 < args.length; p += 2) {
          var cr = flatten([args[p]]);
          if (!matchCrit(cr[i], args[p + 1])) { ok = false; break; }
        }
        if (ok) { var v = toNum(sumR[i]); if (isFinite(v)) tot += v; }
      }
      return { n: tot };
    },
    AVERAGE: function (args) {
      var nums = numsOf(args);
      return nums.length ? { n: nums.reduce(function (a, b) { return a + b; }, 0) / nums.length } : { e: '#DIV/0!' };
    },
    AVERAGEIF: function (args) {
      var s = scanIf(args[0], args[1], args[2] != null ? args[2] : args[0]);
      return s.ncount ? { n: s.sum / s.ncount } : { e: '#DIV/0!' };
    },
    AVERAGEIFS: function (args) {
      var avgR = flatten([args[0]]), n = avgR.length, tot = 0, c = 0;
      for (var i = 0; i < n; i++) {
        var ok = true;
        for (var p = 1; p + 1 < args.length; p += 2) {
          if (!matchCrit(flatten([args[p]])[i], args[p + 1])) { ok = false; break; }
        }
        if (ok) { var v = toNum(avgR[i]); if (isFinite(v)) { tot += v; c++; } }
      }
      return c ? { n: tot / c } : { e: '#DIV/0!' };
    },
    MIN: function (args) { var n = numsOf(args); return n.length ? { n: Math.min.apply(null, n) } : { e: '#VALUE!' }; },
    MAX: function (args) { var n = numsOf(args); return n.length ? { n: Math.max.apply(null, n) } : { e: '#VALUE!' }; },
    MINA: function (args) { return FN.MIN(args); },
    MAXA: function (args) { return FN.MAX(args); },
    COUNT: function (args) { return { n: numsOf(args).length }; },
    COUNTA: function (args) { return { n: flatten(args).filter(function (v) { return !isEmptyVal(v); }).length }; },
    COUNTBLANK: function (args) { return { n: flatten(args).filter(isEmptyVal).length }; },
    COUNTIF: function (args) { return { n: scanIf(args[0], args[1]).hits }; },
    COUNTIFS: function (args) {
      var n = flatten([args[0]]).length, hits = 0;
      for (var i = 0; i < n; i++) {
        var ok = true;
        for (var p = 0; p + 1 < args.length; p += 2) {
          if (!matchCrit(flatten([args[p]])[i], args[p + 1])) { ok = false; break; }
        }
        if (ok) hits++;
      }
      return { n: hits };
    },
    PRODUCT: function (args) {
      var n = numsOf(args);
      return { n: n.length ? n.reduce(function (a, b) { return a * b; }, 1) : 0 };
    },
    SUMPRODUCT: function (args) {
      if (args.length < 2) return FN.SUM(args);
      var lists = args.map(function (a) { return flatten([a]); });
      var n = Math.min.apply(null, lists.map(function (x) { return x.length; })), tot = 0;
      for (var i = 0; i < n; i++) {
        var p = 1;
        for (var k = 0; k < lists.length; k++) { var v = toNum(lists[k][i]); p *= isFinite(v) ? v : 0; }
        tot += p;
      }
      return { n: tot };
    },
    MEDIAN: function (args) {
      var n = numsOf(args).sort(function (a, b) { return a - b; });
      if (!n.length) return { e: '#VALUE!' };
      var m = Math.floor(n.length / 2);
      return { n: n.length % 2 ? n[m] : (n[m - 1] + n[m]) / 2 };
    },
    MODE: function (args) {
      var n = numsOf(args), map = {}, best = n[0], bc = 0;
      if (!n.length) return { e: '#N/A' };
      n.forEach(function (x) { map[x] = (map[x] || 0) + 1; if (map[x] > bc) { bc = map[x]; best = x; } });
      return { n: best };
    },
    STDEV: function (args) {
      var n = numsOf(args); if (n.length < 2) return { e: '#DIV/0!' };
      var m = n.reduce(function (a, b) { return a + b; }, 0) / n.length;
      return { n: Math.sqrt(n.reduce(function (a, b) { return a + (b - m) * (b - m); }, 0) / (n.length - 1)) };
    },
    STDEVP: function (args) {
      var n = numsOf(args); if (!n.length) return { e: '#DIV/0!' };
      var m = n.reduce(function (a, b) { return a + b; }, 0) / n.length;
      return { n: Math.sqrt(n.reduce(function (a, b) { return a + (b - m) * (b - m); }, 0) / n.length) };
    },
    VAR: function (args) {
      var n = numsOf(args); if (n.length < 2) return { e: '#DIV/0!' };
      var m = n.reduce(function (a, b) { return a + b; }, 0) / n.length;
      return { n: n.reduce(function (a, b) { return a + (b - m) * (b - m); }, 0) / (n.length - 1) };
    },
    VARP: function (args) {
      var n = numsOf(args); if (!n.length) return { e: '#DIV/0!' };
      var m = n.reduce(function (a, b) { return a + b; }, 0) / n.length;
      return { n: n.reduce(function (a, b) { return a + (b - m) * (b - m); }, 0) / n.length };
    },
    LARGE: function (args) {
      var n = numsOf([args[0]]).sort(function (a, b) { return b - a; });
      var k = Math.floor(asNum(args[1]));
      return n[k - 1] != null ? { n: n[k - 1] } : { e: '#NUM!' };
    },
    SMALL: function (args) {
      var n = numsOf([args[0]]).sort(function (a, b) { return a - b; });
      var k = Math.floor(asNum(args[1]));
      return n[k - 1] != null ? { n: n[k - 1] } : { e: '#NUM!' };
    },
    RANK: function (args) {
      var x = asNum(args[0]), n = numsOf([args[1]]).sort(function (a, b) { return asNum(args[2]) ? a - b : b - a; });
      var i = n.indexOf(x); return i < 0 ? { e: '#N/A' } : { n: i + 1 };
    },
    PERCENTILE: function (args) {
      var n = numsOf([args[0]]).sort(function (a, b) { return a - b; }), k = asNum(args[1]);
      if (!n.length || k < 0 || k > 1) return { e: '#NUM!' };
      var i = (n.length - 1) * k, f = Math.floor(i), c = Math.ceil(i);
      return { n: f === c ? n[f] : n[f] + (n[c] - n[f]) * (i - f) };
    },
    QUARTILE: function (args) { return FN.PERCENTILE([args[0], asNum(args[1]) / 4]); },
    ABS: function (args) { return { n: Math.abs(asNum(args[0])) }; },
    SIGN: function (args) { var n = asNum(args[0]); return { n: n > 0 ? 1 : n < 0 ? -1 : 0 }; },
    SQRT: function (args) { var n = asNum(args[0]); return n < 0 ? { e: '#NUM!' } : { n: Math.sqrt(n) }; },
    POWER: function (args) { return { n: Math.pow(asNum(args[0]), asNum(args[1])) }; },
    EXP: function (args) { return { n: Math.exp(asNum(args[0])) }; },
    LN: function (args) { var n = asNum(args[0]); return n > 0 ? { n: Math.log(n) } : { e: '#NUM!' }; },
    LOG: function (args) {
      var n = asNum(args[0]), b = args[1] == null ? 10 : asNum(args[1]);
      return n > 0 && b > 0 && b !== 1 ? { n: Math.log(n) / Math.log(b) } : { e: '#NUM!' };
    },
    LOG10: function (args) { return FN.LOG([args[0], 10]); },
    FACT: function (args) { var n = fact(asNum(args[0])); return isFinite(n) ? { n: n } : { e: '#NUM!' }; },
    COMBIN: function (args) {
      var n = Math.floor(asNum(args[0])), k = Math.floor(asNum(args[1]));
      if (k < 0 || n < k) return { e: '#NUM!' };
      var a = fact(n), b = fact(k), c = fact(n - k);
      return isFinite(a) && b && c ? { n: a / (b * c) } : { e: '#NUM!' };
    },
    GCD: function (args) { var n = numsOf(args).map(Math.floor); return n.length ? { n: n.reduce(gcd2) } : { e: '#VALUE!' }; },
    LCM: function (args) {
      var n = numsOf(args).map(function (x) { return Math.abs(Math.floor(x)); });
      if (!n.length) return { e: '#VALUE!' };
      return { n: n.reduce(function (a, b) { return a && b ? Math.abs(a * b) / gcd2(a, b) : 0; }) };
    },
    QUOTIENT: function (args) { var b = asNum(args[1]); return b ? { n: Math.trunc(asNum(args[0]) / b) } : { e: '#DIV/0!' }; },
    MOD: function (args) { var b = asNum(args[1]); return b ? { n: asNum(args[0]) % b } : { e: '#DIV/0!' }; },
    ROUND: function (args) {
      var n = asNum(args[0]), d = args[1] == null ? 0 : asNum(args[1]), p = Math.pow(10, d);
      return { n: Math.round(n * p) / p };
    },
    ROUNDDOWN: function (args) {
      var n = asNum(args[0]), d = args[1] == null ? 0 : asNum(args[1]), p = Math.pow(10, d);
      return { n: Math.floor(n * p) / p };
    },
    ROUNDUP: function (args) {
      var n = asNum(args[0]), d = args[1] == null ? 0 : asNum(args[1]), p = Math.pow(10, d);
      return { n: Math.ceil(n * p) / p };
    },
    INT: function (args) { return { n: Math.floor(asNum(args[0])) }; },
    TRUNC: function (args) {
      var n = asNum(args[0]), d = args[1] == null ? 0 : asNum(args[1]), p = Math.pow(10, d);
      return { n: Math.trunc(n * p) / p };
    },
    CEILING: function (args) {
      var n = asNum(args[0]), s = args[1] == null ? 1 : asNum(args[1]);
      return s ? { n: Math.ceil(n / s) * s } : { e: '#DIV/0!' };
    },
    FLOOR: function (args) {
      var n = asNum(args[0]), s = args[1] == null ? 1 : asNum(args[1]);
      return s ? { n: Math.floor(n / s) * s } : { e: '#DIV/0!' };
    },
    EVEN: function (args) { var n = asNum(args[0]); return { n: n >= 0 ? 2 * Math.ceil(n / 2) : 2 * Math.floor(n / 2) }; },
    ODD: function (args) {
      var n = asNum(args[0]);
      if (n >= 0) { var u = Math.ceil(n); return { n: u % 2 ? u : u + 1 }; }
      var d = Math.floor(n); return { n: d % 2 ? d : d - 1 };
    },
    PI: function () { return { n: Math.PI }; },
    RAND: function () { return { n: Math.random() }; },
    RANDBETWEEN: function (args) {
      var a = Math.ceil(asNum(args[0])), b = Math.floor(asNum(args[1]));
      return { n: Math.floor(Math.random() * (b - a + 1)) + a };
    },
    DEGREES: function (args) { return { n: asNum(args[0]) * 180 / Math.PI }; },
    RADIANS: function (args) { return { n: asNum(args[0]) * Math.PI / 180 }; },
    SIN: function (args) { return { n: Math.sin(asNum(args[0])) }; },
    COS: function (args) { return { n: Math.cos(asNum(args[0])) }; },
    TAN: function (args) { return { n: Math.tan(asNum(args[0])) }; },
    ASIN: function (args) { var n = asNum(args[0]); return n >= -1 && n <= 1 ? { n: Math.asin(n) } : { e: '#NUM!' }; },
    ACOS: function (args) { var n = asNum(args[0]); return n >= -1 && n <= 1 ? { n: Math.acos(n) } : { e: '#NUM!' }; },
    ATAN: function (args) { return { n: Math.atan(asNum(args[0])) }; },
    ATAN2: function (args) { return { n: Math.atan2(asNum(args[1]), asNum(args[0])) }; },
    SINH: function (args) { return { n: Math.sinh(asNum(args[0])) }; },
    COSH: function (args) { return { n: Math.cosh(asNum(args[0])) }; },
    TANH: function (args) { return { n: Math.tanh(asNum(args[0])) }; },
    IF: function (args) { return truthy(args[0]) ? wrap(args[1]) : wrap(args.length > 2 ? args[2] : 0); },
    IFS: function (args) {
      for (var i = 0; i + 1 < args.length; i += 2) if (truthy(args[i])) return wrap(args[i + 1]);
      return { e: '#N/A' };
    },
    IFERROR: function (args) { var a = args[0]; return a && a.e ? wrap(args[1]) : wrap(a); },
    IFNA: function (args) { var a = args[0]; return a && a.e === '#N/A' ? wrap(args[1]) : wrap(a); },
    AND: function (args) { return { n: flatten(args).every(truthy) ? 1 : 0 }; },
    OR: function (args) { return { n: flatten(args).some(truthy) ? 1 : 0 }; },
    XOR: function (args) { return { n: flatten(args).filter(truthy).length % 2 }; },
    NOT: function (args) { return { n: truthy(args[0]) ? 0 : 1 }; },
    TRUE: function () { return { n: 1 }; },
    FALSE: function () { return { n: 0 }; },
    SWITCH: function (args) {
      var e = displayVal(args[0]), en = toNum(args[0]);
      for (var i = 1; i + 1 < args.length; i += 2) {
        var cn = toNum(args[i]);
        if ((isFinite(en) && isFinite(cn) && en === cn) || displayVal(args[i]) === e) return wrap(args[i + 1]);
      }
      return args.length % 2 === 0 ? wrap(args[args.length - 1]) : { e: '#N/A' };
    },
    LEN: function (args) { return { n: String(displayVal(args[0] == null ? '' : args[0])).length }; },
    LEFT: function (args) { var s = displayVal(args[0] || ''); var n = args[1] == null ? 1 : asNum(args[1]); return { s: s.slice(0, Math.max(0, n)) }; },
    RIGHT: function (args) { var s = displayVal(args[0] || ''); var n = args[1] == null ? 1 : asNum(args[1]); return { s: n <= 0 ? '' : s.slice(-Math.max(0, n)) }; },
    MID: function (args) {
      var s = displayVal(args[0] || '');
      var start = Math.max(1, asNum(args[1])) - 1;
      var len = args[2] == null ? s.length : asNum(args[2]);
      return { s: s.substr(start, Math.max(0, len)) };
    },
    TRIM: function (args) { return { s: displayVal(args[0] || '').replace(/\s+/g, ' ').trim() }; },
    UPPER: function (args) { return { s: displayVal(args[0] || '').toLocaleUpperCase('hy') }; },
    LOWER: function (args) { return { s: displayVal(args[0] || '').toLocaleLowerCase('hy') }; },
    PROPER: function (args) {
      return { s: displayVal(args[0] || '').replace(/\S+/g, function (w) { return w.charAt(0).toLocaleUpperCase('hy') + w.slice(1).toLocaleLowerCase('hy'); }) };
    },
    CONCAT: function (args) { return { s: flatten(args).map(displayVal).join('') }; },
    TEXTJOIN: function (args) {
      var d = displayVal(args[0] || ''), ign = truthy(args[1]);
      var parts = flatten(args.slice(2)).map(displayVal);
      if (ign) parts = parts.filter(function (x) { return x !== ''; });
      return { s: parts.join(d) };
    },
    SUBSTITUTE: function (args) {
      var s = displayVal(args[0] || ''), old = displayVal(args[1] || ''), neu = displayVal(args[2] || '');
      if (!old) return { s: s };
      if (args[3] == null) return { s: s.split(old).join(neu) };
      var n = Math.floor(asNum(args[3])), i = 0;
      return { s: s.replace(new RegExp(old.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), function (m) { i++; return i === n ? neu : m; }) };
    },
    REPLACE: function (args) {
      var s = displayVal(args[0] || ''), start = Math.max(1, asNum(args[1])) - 1, n = Math.max(0, asNum(args[2]));
      return { s: s.slice(0, start) + displayVal(args[3] || '') + s.slice(start + n) };
    },
    FIND: function (args) {
      var f = displayVal(args[0] || ''), w = displayVal(args[1] || ''), st = args[2] == null ? 0 : Math.max(1, asNum(args[2])) - 1;
      var i = w.indexOf(f, st); return i < 0 ? { e: '#VALUE!' } : { n: i + 1 };
    },
    SEARCH: function (args) {
      var f = displayVal(args[0] || '').toLocaleLowerCase(), w = displayVal(args[1] || '').toLocaleLowerCase();
      var st = args[2] == null ? 0 : Math.max(1, asNum(args[2])) - 1;
      var i = w.indexOf(f, st); return i < 0 ? { e: '#VALUE!' } : { n: i + 1 };
    },
    REPT: function (args) { return { s: displayVal(args[0] || '').repeat(Math.max(0, Math.min(10000, asNum(args[1])))) }; },
    EXACT: function (args) { return { n: displayVal(args[0]) === displayVal(args[1]) ? 1 : 0 }; },
    VALUE: function (args) { var n = toNum(args[0]); return isFinite(n) ? { n: n } : { e: '#VALUE!' }; },
    TEXT: function (args) {
      var n = toNum(args[0]), fmt = displayVal(args[1] || '0');
      if (!isFinite(n)) return { s: displayVal(args[0]) };
      if (/0\.0+/.test(fmt)) return { s: n.toFixed((fmt.split('.')[1] || '').length) };
      if (fmt === '0' || fmt === '#') return { s: String(Math.round(n)) };
      if (/yyyy|mm|dd/i.test(fmt)) {
        var d = fromSerial(n);
        var yyyy = d.getUTCFullYear(), mm = String(d.getUTCMonth() + 1).padStart(2, '0'), dd = String(d.getUTCDate()).padStart(2, '0');
        return { s: fmt.replace(/yyyy/ig, yyyy).replace(/mm/ig, mm).replace(/dd/ig, dd) };
      }
      return { s: String(n) };
    },
    CHAR: function (args) { return { s: String.fromCharCode(asNum(args[0])) }; },
    CODE: function (args) { var s = displayVal(args[0] || ''); return s ? { n: s.charCodeAt(0) } : { e: '#VALUE!' }; },
    CLEAN: function (args) { return { s: displayVal(args[0] || '').replace(/[\x00-\x1F]/g, '') }; },
    T: function (args) { var v = args[0]; return { s: (v && typeof v === 'object' && v.s != null) ? v.s : (typeof v === 'number' || (v && v.n != null) ? '' : displayVal(v)) }; },
    TODAY: function () { return { n: excelSerial(new Date()) }; },
    NOW: function () { var d = new Date(); return { n: excelSerial(d) + (d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds()) / 86400 }; },
    DATE: function (args) { return { n: excelSerial(new Date(asNum(args[0]), asNum(args[1]) - 1, asNum(args[2]))) }; },
    DATEVALUE: function (args) { var d = toDate(args[0]); return d ? { n: excelSerial(d) } : { e: '#VALUE!' }; },
    YEAR: function (args) { var d = toDate(args[0]); return d ? { n: d.getFullYear() } : { e: '#VALUE!' }; },
    MONTH: function (args) { var d = toDate(args[0]); return d ? { n: d.getMonth() + 1 } : { e: '#VALUE!' }; },
    DAY: function (args) { var d = toDate(args[0]); return d ? { n: d.getDate() } : { e: '#VALUE!' }; },
    HOUR: function (args) {
      var n = toNum(args[0]); if (!isFinite(n)) { var d = toDate(args[0]); return d ? { n: d.getHours() } : { e: '#VALUE!' }; }
      return { n: Math.floor((n % 1) * 24) };
    },
    MINUTE: function (args) {
      var n = toNum(args[0]); if (!isFinite(n)) { var d = toDate(args[0]); return d ? { n: d.getMinutes() } : { e: '#VALUE!' }; }
      return { n: Math.floor((n % 1) * 1440) % 60 };
    },
    SECOND: function (args) {
      var n = toNum(args[0]); if (!isFinite(n)) { var d = toDate(args[0]); return d ? { n: d.getSeconds() } : { e: '#VALUE!' }; }
      return { n: Math.floor((n % 1) * 86400) % 60 };
    },
    WEEKDAY: function (args) {
      var d = toDate(args[0]); if (!d) return { e: '#VALUE!' };
      var t = args[1] == null ? 1 : asNum(args[1]), js = d.getDay();
      if (t === 1) return { n: js + 1 };
      if (t === 2) return { n: js === 0 ? 7 : js };
      return { n: js === 0 ? 1 : js + 1 };
    },
    WEEKNUM: function (args) {
      var d = toDate(args[0]); if (!d) return { e: '#VALUE!' };
      var onejan = new Date(d.getFullYear(), 0, 1);
      return { n: Math.ceil((((d - onejan) / 86400000) + onejan.getDay() + 1) / 7) };
    },
    EOMONTH: function (args) {
      var d = toDate(args[0]); if (!d) return { e: '#VALUE!' };
      var m = d.getMonth() + Math.floor(asNum(args[1])) + 1;
      return { n: excelSerial(new Date(d.getFullYear(), m, 0)) };
    },
    EDATE: function (args) {
      var d = toDate(args[0]); if (!d) return { e: '#VALUE!' };
      return { n: excelSerial(new Date(d.getFullYear(), d.getMonth() + Math.floor(asNum(args[1])), d.getDate())) };
    },
    DATEDIF: function (args) {
      var a = toDate(args[0]), b = toDate(args[1]); if (!a || !b) return { e: '#VALUE!' };
      var u = displayVal(args[2] || 'd').toLowerCase();
      if (u === 'y') return { n: b.getFullYear() - a.getFullYear() - ((b.getMonth() < a.getMonth() || (b.getMonth() === a.getMonth() && b.getDate() < a.getDate())) ? 1 : 0) };
      if (u === 'm') return { n: (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth() - (b.getDate() < a.getDate() ? 1 : 0) };
      return { n: Math.round((b - a) / 86400000) };
    },
    YEARFRAC: function (args) {
      var a = toDate(args[0]), b = toDate(args[1]); if (!a || !b) return { e: '#VALUE!' };
      return { n: Math.abs(b - a) / (86400000 * 365.25) };
    },
    NETWORKDAYS: function (args) {
      var a = toDate(args[0]), b = toDate(args[1]); if (!a || !b) return { e: '#VALUE!' };
      if (a > b) { var t = a; a = b; b = t; }
      var n = 0, hol = args[2] ? flatten([args[2]]).map(function (x) { return displayVal(x); }) : [];
      for (var d = new Date(a); d <= b; d.setDate(d.getDate() + 1)) {
        var wd = d.getDay();
        if (wd !== 0 && wd !== 6 && hol.indexOf(d.toISOString().slice(0, 10)) < 0) n++;
      }
      return { n: n };
    },
    WORKDAY: function (args) {
      var d = toDate(args[0]); if (!d) return { e: '#VALUE!' };
      var left = Math.floor(asNum(args[1])), step = left >= 0 ? 1 : -1; left = Math.abs(left);
      while (left > 0) {
        d.setDate(d.getDate() + step);
        var wd = d.getDay();
        if (wd !== 0 && wd !== 6) left--;
      }
      return { n: excelSerial(d) };
    },
    ISBLANK: function (args) { return { n: isEmptyVal(args[0]) ? 1 : 0 }; },
    ISNUMBER: function (args) { return { n: isFinite(toNum(args[0])) && !isEmptyVal(args[0]) ? 1 : 0 }; },
    ISTEXT: function (args) { var v = args[0]; return { n: v && typeof v === 'object' && v.s != null && v.n == null && !v.e ? 1 : (!isFinite(toNum(v)) && !isEmptyVal(v) ? 1 : 0) }; },
    ISERROR: function (args) { return { n: args[0] && args[0].e ? 1 : 0 }; },
    ISERR: function (args) { return { n: args[0] && args[0].e && args[0].e !== '#N/A' ? 1 : 0 }; },
    ISNA: function (args) { return { n: args[0] && args[0].e === '#N/A' ? 1 : 0 }; },
    ISLOGICAL: function (args) { var n = toNum(args[0]); return { n: (n === 0 || n === 1) && !isEmptyVal(args[0]) ? 1 : 0 }; },
    N: function (args) { var n = toNum(args[0]); return { n: isFinite(n) ? n : 0 }; },
    TYPE: function (args) {
      var v = args[0];
      if (v && v.e) return { n: 16 };
      if (v && typeof v === 'object' && typeof v.n === 'number') return { n: 1 };
      if (isEmptyVal(v)) return { n: 1 };
      return { n: 2 };
    },
    NA: function () { return { e: '#N/A' }; },
    CHOOSE: function (args) {
      var i = Math.floor(asNum(args[0]));
      return args[i] != null ? wrap(args[i]) : { e: '#VALUE!' };
    },
    INDEX: function (args) {
      var g = asGrid(args[0]); if (!g) return wrap(args[0]);
      var r = Math.floor(asNum(args[1]) || 1), c = args[2] == null ? 1 : Math.floor(asNum(args[2]));
      var cols = g.cols || 1;
      var v = g[(r - 1) * cols + (c - 1)];
      return v == null ? { e: '#REF!' } : wrap(v);
    },
    MATCH: function (args) {
      var look = args[0], arr = flatten([args[1]]), typ = args[2] == null ? 1 : asNum(args[2]);
      var ls = displayVal(look), ln = toNum(look);
      if (typ === 0) {
        for (var i = 0; i < arr.length; i++) {
          if (matchCrit(arr[i], look) || displayVal(arr[i]) === ls || (isFinite(ln) && toNum(arr[i]) === ln)) return { n: i + 1 };
        }
        return { e: '#N/A' };
      }
      var last = { e: '#N/A' };
      for (var j = 0; j < arr.length; j++) {
        var vn = toNum(arr[j]);
        if (isFinite(ln) && isFinite(vn)) {
          if (typ === 1 && vn <= ln) last = { n: j + 1 };
          if (typ === -1 && vn >= ln) return { n: j + 1 };
        }
      }
      return last;
    },
    VLOOKUP: function (args) {
      var g = asGrid(args[1]);
      if (!g) return { e: '#REF!' };
      var look = args[0], col = Math.floor(asNum(args[2])), exact = args[3] == null ? false : !truthy(args[3]);
      var cols = g.cols || 1, rows = Math.floor(g.length / cols);
      if (col < 1 || col > cols) return { e: '#REF!' };
      var last = { e: '#N/A' };
      for (var r = 0; r < rows; r++) {
        var cell = g[r * cols];
        if (exact) {
          if (matchCrit(cell, look) || displayVal(cell) === displayVal(look)) return wrap(g[r * cols + col - 1]);
        } else {
          var vn = toNum(cell), ln = toNum(look);
          if (isFinite(vn) && isFinite(ln) && vn <= ln) last = wrap(g[r * cols + col - 1]);
          else if (displayVal(cell) === displayVal(look)) return wrap(g[r * cols + col - 1]);
        }
      }
      return last;
    },
    HLOOKUP: function (args) {
      var g = asGrid(args[1]); if (!g) return { e: '#REF!' };
      var look = args[0], row = Math.floor(asNum(args[2])), exact = args[3] == null ? false : !truthy(args[3]);
      var cols = g.cols || 1;
      if (row < 1) return { e: '#REF!' };
      var last = { e: '#N/A' };
      for (var c = 0; c < cols; c++) {
        var cell = g[c];
        if (exact) {
          if (displayVal(cell) === displayVal(look) || matchCrit(cell, look)) return wrap(g[(row - 1) * cols + c]);
        } else if (displayVal(cell) === displayVal(look)) return wrap(g[(row - 1) * cols + c]);
      }
      return last;
    },
    LOOKUP: function (args) {
      if (args.length >= 3) return FN.VLOOKUP([args[0], args[1], 1, true]);
      return FN.VLOOKUP([args[0], args[1], (asGrid(args[1]) || { cols: 1 }).cols || 1, true]);
    },
    UNIQUE: function (args) {
      var seen = {}, parts = [];
      flatten(args).forEach(function (v) {
        var k = displayVal(v);
        if (!Object.prototype.hasOwnProperty.call(seen, k)) { seen[k] = 1; parts.push(k); }
      });
      return { s: parts.join(', ') };
    },
    SORT: function (args) {
      var arr = flatten([args[0]]).slice();
      var desc = asNum(args[2]) === -1;
      arr.sort(function (a, b) {
        var an = toNum(a), bn = toNum(b);
        if (isFinite(an) && isFinite(bn)) return desc ? bn - an : an - bn;
        return desc ? displayVal(b).localeCompare(displayVal(a), 'hy') : displayVal(a).localeCompare(displayVal(b), 'hy');
      });
      return { s: arr.map(displayVal).join(', ') };
    },
    FILTER: function (args) {
      var data = flatten([args[0]]), crit = flatten([args[1]]), out = [];
      for (var i = 0; i < data.length; i++) if (truthy(crit[i])) out.push(displayVal(data[i]));
      return out.length ? { s: out.join(', ') } : (args[2] != null ? wrap(args[2]) : { e: '#N/A' });
    },
    PMT: function (args) {
      var r = asNum(args[0]), n = asNum(args[1]), pv = asNum(args[2]), fv = args[3] == null ? 0 : asNum(args[3]), t = args[4] ? 1 : 0;
      if (!r) return { n: -(pv + fv) / n };
      var p = r * (pv * Math.pow(1 + r, n) + fv) / ((1 + r * t) * (Math.pow(1 + r, n) - 1));
      return { n: -p };
    },
    FV: function (args) {
      var r = asNum(args[0]), n = asNum(args[1]), pmt = asNum(args[2]), pv = args[3] == null ? 0 : asNum(args[3]), t = args[4] ? 1 : 0;
      if (!r) return { n: -pv - pmt * n };
      return { n: -pv * Math.pow(1 + r, n) - pmt * (1 + r * t) * (Math.pow(1 + r, n) - 1) / r };
    },
    PV: function (args) {
      var r = asNum(args[0]), n = asNum(args[1]), pmt = asNum(args[2]), fv = args[3] == null ? 0 : asNum(args[3]), t = args[4] ? 1 : 0;
      if (!r) return { n: -fv - pmt * n };
      return { n: -(fv + pmt * (1 + r * t) * (Math.pow(1 + r, n) - 1) / r) / Math.pow(1 + r, n) };
    },
    NPV: function (args) {
      var r = asNum(args[0]), tot = 0, vs = flatten(args.slice(1));
      for (var i = 0; i < vs.length; i++) tot += asNum(vs[i]) / Math.pow(1 + r, i + 1);
      return { n: tot };
    },
    SUMSQ: function (args) { return { n: numsOf(args).reduce(function (a, b) { return a + b * b; }, 0) }; },
    SUMX2MY2: function (args) {
      var a = flatten([args[0]]), b = flatten([args[1]]), tot = 0, n = Math.min(a.length, b.length);
      for (var i = 0; i < n; i++) { var x = toNum(a[i]), y = toNum(b[i]); if (isFinite(x) && isFinite(y)) tot += x * x - y * y; }
      return { n: tot };
    },
    SUMX2PY2: function (args) {
      var a = flatten([args[0]]), b = flatten([args[1]]), tot = 0, n = Math.min(a.length, b.length);
      for (var i = 0; i < n; i++) { var x = toNum(a[i]), y = toNum(b[i]); if (isFinite(x) && isFinite(y)) tot += x * x + y * y; }
      return { n: tot };
    },
    SUMXMY2: function (args) {
      var a = flatten([args[0]]), b = flatten([args[1]]), tot = 0, n = Math.min(a.length, b.length);
      for (var i = 0; i < n; i++) { var x = toNum(a[i]), y = toNum(b[i]); if (isFinite(x) && isFinite(y)) tot += (x - y) * (x - y); }
      return { n: tot };
    },
    MROUND: function (args) {
      var n = asNum(args[0]), m = asNum(args[1]);
      return m ? { n: Math.round(n / m) * m } : { e: '#NUM!' };
    },
    SQRTPI: function (args) { var n = asNum(args[0]); return n < 0 ? { e: '#NUM!' } : { n: Math.sqrt(n * Math.PI) }; },
    FACTDOUBLE: function (args) {
      var n = Math.floor(asNum(args[0]));
      if (n < 0 || n > 300) return { e: '#NUM!' };
      var x = 1; for (var i = n; i > 1; i -= 2) x *= i; return { n: x };
    },
    MULTINOMIAL: function (args) {
      var ns = numsOf(args).map(Math.floor), tot = ns.reduce(function (a, b) { return a + b; }, 0), den = 1;
      ns.forEach(function (k) { den *= fact(k); });
      var a = fact(tot);
      return isFinite(a) && den ? { n: a / den } : { e: '#NUM!' };
    },
    SERIESSUM: function (args) {
      var x = asNum(args[0]), n = asNum(args[1]), m = asNum(args[2]), coef = numsOf([args[3]]), tot = 0;
      for (var i = 0; i < coef.length; i++) tot += coef[i] * Math.pow(x, n + i * m);
      return { n: tot };
    },
    BASE: function (args) {
      var n = Math.floor(asNum(args[0])), r = Math.floor(asNum(args[1])), min = args[2] == null ? 0 : Math.floor(asNum(args[2]));
      if (n < 0 || r < 2 || r > 36) return { e: '#NUM!' };
      var s = n.toString(r).toUpperCase();
      while (s.length < min) s = '0' + s;
      return { s: s };
    },
    DECIMAL: function (args) {
      var s = displayVal(args[0] || ''), r = Math.floor(asNum(args[1]));
      if (r < 2 || r > 36) return { e: '#NUM!' };
      var n = parseInt(s, r);
      return isFinite(n) ? { n: n } : { e: '#NUM!' };
    },
    ROMAN: function (args) { var s = romanStr(asNum(args[0])); return s ? { s: s } : { e: '#VALUE!' }; },
    ARABIC: function (args) {
      var s = displayVal(args[0] || '').toUpperCase().replace(/\s/g, ''), map = { M: 1000, D: 500, C: 100, L: 50, X: 10, V: 5, I: 1 }, tot = 0;
      for (var i = 0; i < s.length; i++) {
        var a = map[s.charAt(i)], b = map[s.charAt(i + 1)] || 0;
        if (!a) return { e: '#VALUE!' };
        tot += a < b ? -a : a;
      }
      return { n: tot };
    },
    SUBTOTAL: function (args) {
      var k = Math.floor(asNum(args[0])) % 100, rest = args.slice(1);
      if (k === 1 || k === 101) return FN.AVERAGE(rest);
      if (k === 2 || k === 102) return FN.COUNT(rest);
      if (k === 3 || k === 103) return FN.COUNTA(rest);
      if (k === 4 || k === 104) return FN.MAX(rest);
      if (k === 5 || k === 105) return FN.MIN(rest);
      if (k === 6 || k === 106) return FN.PRODUCT(rest);
      if (k === 7 || k === 107) return FN.STDEV(rest);
      if (k === 8 || k === 108) return FN.STDEVP(rest);
      if (k === 9 || k === 109) return FN.SUM(rest);
      if (k === 10 || k === 110) return FN.VAR(rest);
      if (k === 11 || k === 111) return FN.VARP(rest);
      return { e: '#VALUE!' };
    },
    AGGREGATE: function (args) { return FN.SUBTOTAL([asNum(args[0]), args[2]].concat(args.slice(3))); },
    GEOMEAN: function (args) {
      var n = numsOf(args).filter(function (x) { return x > 0; });
      if (!n.length) return { e: '#NUM!' };
      return { n: Math.exp(n.reduce(function (a, b) { return a + Math.log(b); }, 0) / n.length) };
    },
    HARMEAN: function (args) {
      var n = numsOf(args).filter(function (x) { return x > 0; });
      if (!n.length) return { e: '#NUM!' };
      return { n: n.length / n.reduce(function (a, b) { return a + 1 / b; }, 0) };
    },
    AVEDEV: function (args) {
      var n = numsOf(args); if (!n.length) return { e: '#NUM!' };
      var m = n.reduce(function (a, b) { return a + b; }, 0) / n.length;
      return { n: n.reduce(function (a, b) { return a + Math.abs(b - m); }, 0) / n.length };
    },
    DEVSQ: function (args) {
      var n = numsOf(args); if (!n.length) return { e: '#NUM!' };
      var m = n.reduce(function (a, b) { return a + b; }, 0) / n.length;
      return { n: n.reduce(function (a, b) { return a + (b - m) * (b - m); }, 0) };
    },
    SKEW: function (args) {
      var n = numsOf(args); if (n.length < 3) return { e: '#DIV/0!' };
      var m = n.reduce(function (a, b) { return a + b; }, 0) / n.length;
      var s = Math.sqrt(n.reduce(function (a, b) { return a + (b - m) * (b - m); }, 0) / (n.length - 1));
      if (!s) return { e: '#DIV/0!' };
      var tot = n.reduce(function (a, b) { return a + Math.pow((b - m) / s, 3); }, 0);
      return { n: n.length / ((n.length - 1) * (n.length - 2)) * tot };
    },
    KURT: function (args) {
      var n = numsOf(args); if (n.length < 4) return { e: '#DIV/0!' };
      var m = n.reduce(function (a, b) { return a + b; }, 0) / n.length, len = n.length;
      var s = Math.sqrt(n.reduce(function (a, b) { return a + (b - m) * (b - m); }, 0) / (len - 1));
      if (!s) return { e: '#DIV/0!' };
      var tot = n.reduce(function (a, b) { return a + Math.pow((b - m) / s, 4); }, 0);
      return { n: (len * (len + 1) / ((len - 1) * (len - 2) * (len - 3))) * tot - 3 * (len - 1) * (len - 1) / ((len - 2) * (len - 3)) };
    },
    CORREL: function (args) {
      var g = linreg(flatten([args[0]]), flatten([args[1]]));
      return g ? { n: g.r } : { e: '#N/A' };
    },
    PEARSON: function (args) { return FN.CORREL(args); },
    COVAR: function (args) {
      var g = linreg(flatten([args[0]]), flatten([args[1]]));
      return g ? { n: g.cov / g.n } : { e: '#N/A' };
    },
    COVARIANCE_P: function (args) { return FN.COVAR(args); },
    COVARIANCE_S: function (args) {
      var g = linreg(flatten([args[0]]), flatten([args[1]]));
      return g ? { n: g.cov / (g.n - 1) } : { e: '#N/A' };
    },
    SLOPE: function (args) {
      var g = linreg(flatten([args[1]]), flatten([args[0]]));
      return g ? { n: g.slope } : { e: '#N/A' };
    },
    INTERCEPT: function (args) {
      var g = linreg(flatten([args[1]]), flatten([args[0]]));
      return g ? { n: g.intercept } : { e: '#N/A' };
    },
    RSQ: function (args) {
      var g = linreg(flatten([args[1]]), flatten([args[0]]));
      return g ? { n: g.r * g.r } : { e: '#N/A' };
    },
    FORECAST: function (args) {
      var x = asNum(args[0]), g = linreg(flatten([args[2]]), flatten([args[1]]));
      return g ? { n: g.intercept + g.slope * x } : { e: '#N/A' };
    },
    FORECAST_LINEAR: function (args) { return FN.FORECAST(args); },
    PERCENTRANK: function (args) {
      var n = numsOf([args[0]]).sort(function (a, b) { return a - b; }), x = asNum(args[1]);
      if (!n.length) return { e: '#N/A' };
      if (x <= n[0]) return { n: 0 };
      if (x >= n[n.length - 1]) return { n: 1 };
      var i = 0; while (i < n.length && n[i] < x) i++;
      return { n: (i - 1 + (x - n[i - 1]) / ((n[i] - n[i - 1]) || 1)) / (n.length - 1) };
    },
    NORMDIST: function (args) {
      var x = asNum(args[0]), m = asNum(args[1]), s = asNum(args[2]), cum = args[3] == null ? true : truthy(args[3]);
      if (s <= 0) return { e: '#NUM!' };
      var z = (x - m) / s;
      return { n: cum ? normsdist(z) : Math.exp(-0.5 * z * z) / (s * Math.sqrt(2 * Math.PI)) };
    },
    NORMSDIST: function (args) { return { n: normsdist(asNum(args[0])) }; },
    NORMSINV: function (args) { var n = normsinv(asNum(args[0])); return isFinite(n) ? { n: n } : { e: '#NUM!' }; },
    NORMINV: function (args) {
      var p = asNum(args[0]), m = asNum(args[1]), s = asNum(args[2]), z = normsinv(p);
      return isFinite(z) && s > 0 ? { n: m + s * z } : { e: '#NUM!' };
    },
    BINOMDIST: function (args) {
      var k = Math.floor(asNum(args[0])), n = Math.floor(asNum(args[1])), p = asNum(args[2]), cum = truthy(args[3]);
      if (k < 0 || n < k || p < 0 || p > 1) return { e: '#NUM!' };
      function pmf(i) { return fact(n) / (fact(i) * fact(n - i)) * Math.pow(p, i) * Math.pow(1 - p, n - i); }
      if (!cum) return { n: pmf(k) };
      var tot = 0; for (var i = 0; i <= k; i++) tot += pmf(i); return { n: tot };
    },
    POISSON: function (args) {
      var k = Math.floor(asNum(args[0])), l = asNum(args[1]), cum = truthy(args[2]);
      if (k < 0 || l < 0) return { e: '#NUM!' };
      function pmf(i) { return Math.exp(-l) * Math.pow(l, i) / fact(i); }
      if (!cum) return { n: pmf(k) };
      var tot = 0; for (var i = 0; i <= k; i++) tot += pmf(i); return { n: tot };
    },
    EXPONDIST: function (args) {
      var x = asNum(args[0]), l = asNum(args[1]), cum = args[2] == null ? true : truthy(args[2]);
      if (x < 0 || l <= 0) return { e: '#NUM!' };
      return { n: cum ? 1 - Math.exp(-l * x) : l * Math.exp(-l * x) };
    },
    CONFIDENCE: function (args) {
      var a = asNum(args[0]), s = asNum(args[1]), n = asNum(args[2]);
      var z = normsinv(1 - a / 2);
      return isFinite(z) && s > 0 && n > 0 ? { n: z * s / Math.sqrt(n) } : { e: '#NUM!' };
    },
    PERMUT: function (args) { var n = permut(asNum(args[0]), asNum(args[1])); return isFinite(n) ? { n: n } : { e: '#NUM!' }; },
    COMBINA: function (args) { return FN.COMBIN([asNum(args[0]) + asNum(args[1]) - 1, asNum(args[1])]); },
    FREQUENCY: function (args) {
      var data = numsOf([args[0]]).sort(function (a, b) { return a - b; }), bins = numsOf([args[1]]).sort(function (a, b) { return a - b; }), counts = bins.map(function () { return 0; });
      counts.push(0);
      data.forEach(function (x) {
        var i = 0; while (i < bins.length && x > bins[i]) i++;
        counts[i]++;
      });
      return joinVals(counts.map(function (n) { return { n: n }; }));
    },
    NUMBERVALUE: function (args) {
      var s = displayVal(args[0] || '').replace(/\s/g, '');
      var dec = displayVal(args[1] != null ? args[1] : '.'), grp = displayVal(args[2] != null ? args[2] : ',');
      if (grp) s = s.split(grp).join('');
      if (dec && dec !== '.') s = s.replace(dec, '.');
      var n = parseFloat(s);
      return isFinite(n) ? { n: n } : { e: '#VALUE!' };
    },
    FIXED: function (args) {
      var n = asNum(args[0]), d = args[1] == null ? 2 : asNum(args[1]), no = truthy(args[2]);
      var s = n.toFixed(Math.max(0, d));
      if (!no) s = s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      return { s: s };
    },
    DOLLAR: function (args) {
      var n = asNum(args[0]), d = args[1] == null ? 2 : asNum(args[1]);
      return { s: (n < 0 ? '-$' : '$') + Math.abs(n).toFixed(Math.max(0, d)) };
    },
    UNICHAR: function (args) { return FN.CHAR(args); },
    UNICODE: function (args) { return FN.CODE(args); },
    TEXTBEFORE: function (args) {
      var s = displayVal(args[0] || ''), d = displayVal(args[1] || ''), i = s.indexOf(d);
      return i < 0 ? { e: '#N/A' } : { s: s.slice(0, i) };
    },
    TEXTAFTER: function (args) {
      var s = displayVal(args[0] || ''), d = displayVal(args[1] || ''), i = s.indexOf(d);
      return i < 0 ? { e: '#N/A' } : { s: s.slice(i + d.length) };
    },
    TEXTSPLIT: function (args) {
      var s = displayVal(args[0] || ''), d = displayVal(args[1] || ',');
      return joinVals(s.split(d).map(function (x) { return { s: x }; }));
    },
    ARRAYTOTEXT: function (args) { return FN.TEXTJOIN([', ', true].concat(flatten(args))); },
    VALUETOTEXT: function (args) { return { s: displayVal(args[0]) }; },
    DAYS: function (args) {
      var a = toDate(args[0]), b = toDate(args[1]);
      return a && b ? { n: Math.round((a - b) / 86400000) } : { e: '#VALUE!' };
    },
    DAYS360: function (args) {
      var a = toDate(args[0]), b = toDate(args[1]); if (!a || !b) return { e: '#VALUE!' };
      var y1 = a.getFullYear(), m1 = a.getMonth(), d1 = Math.min(30, a.getDate());
      var y2 = b.getFullYear(), m2 = b.getMonth(), d2 = Math.min(30, b.getDate());
      return { n: (y2 - y1) * 360 + (m2 - m1) * 30 + (d2 - d1) };
    },
    TIME: function (args) { return { n: (asNum(args[0]) + asNum(args[1]) / 60 + asNum(args[2]) / 3600) / 24 }; },
    TIMEVALUE: function (args) {
      var s = displayVal(args[0] || ''), m = /(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(s);
      return m ? FN.TIME([+m[1], +m[2], +(m[3] || 0)]) : { e: '#VALUE!' };
    },
    ISOWEEKNUM: function (args) {
      var d = toDate(args[0]); if (!d) return { e: '#VALUE!' };
      var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
      t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
      var y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
      return { n: Math.ceil(((t - y) / 86400000 + 1) / 7) };
    },
    XLOOKUP: function (args) {
      var look = args[0], lookup = flatten([args[1]]), ret = flatten([args[2] != null ? args[2] : args[1]]);
      var ls = displayVal(look), ln = toNum(look);
      for (var i = 0; i < lookup.length; i++) {
        if (displayVal(lookup[i]) === ls || (isFinite(ln) && toNum(lookup[i]) === ln) || matchCrit(lookup[i], look))
          return wrap(ret[i] != null ? ret[i] : '');
      }
      return args[3] != null ? wrap(args[3]) : { e: '#N/A' };
    },
    XMATCH: function (args) { return FN.MATCH([args[0], args[1], args[2] == null ? 0 : args[2]]); },
    INDIRECT: function (args, ctx) {
      var a = parseAddr(displayVal(args[0]));
      if (!a || !ctx || !ctx.sh) return { e: '#REF!' };
      return withRef(evalCell(ctx.sh, a.key, ctx.stack), a.c, a.r);
    },
    ADDRESS: function (args) {
      var r = Math.floor(asNum(args[0])), c = Math.floor(asNum(args[1])), abs = args[2] == null ? 1 : Math.floor(asNum(args[2]));
      if (r < 1 || c < 1) return { e: '#VALUE!' };
      var col = colName(c - 1), row = String(r);
      if (abs === 1) return { s: '$' + col + '$' + row };
      if (abs === 2) return { s: col + '$' + row };
      if (abs === 3) return { s: '$' + col + row };
      return { s: col + row };
    },
    ROW: function (args, ctx) {
      if (!args.length) { var a = parseAddr(ctx && ctx.key); return a ? { n: a.r + 1 } : { e: '#REF!' }; }
      var o = originOf(args[0]); return o ? { n: o.r + 1 } : { e: '#REF!' };
    },
    COLUMN: function (args, ctx) {
      if (!args.length) { var a = parseAddr(ctx && ctx.key); return a ? { n: a.c + 1 } : { e: '#REF!' }; }
      var o = originOf(args[0]); return o ? { n: o.c + 1 } : { e: '#REF!' };
    },
    ROWS: function (args) {
      var o = originOf(args[0]); if (o) return { n: o.rows };
      return { n: flatten([args[0]]).length };
    },
    COLUMNS: function (args) {
      var o = originOf(args[0]); if (o) return { n: o.cols };
      var g = asGrid(args[0]); return { n: g && g.cols ? g.cols : 1 };
    },
    AREAS: function () { return { n: 1 }; },
    OFFSET: function (args, ctx) {
      var o = originOf(args[0]); if (!o || !ctx || !ctx.sh) return { e: '#REF!' };
      var dr = Math.floor(asNum(args[1]) || 0), dc = Math.floor(asNum(args[2]) || 0);
      var h = args[3] == null ? o.rows : Math.floor(asNum(args[3]));
      var w = args[4] == null ? o.cols : Math.floor(asNum(args[4]));
      var c1 = o.c + dc, r1 = o.r + dr;
      if (c1 < 0 || r1 < 0 || h < 1 || w < 1) return { e: '#REF!' };
      if (h === 1 && w === 1) return withRef(evalCell(ctx.sh, makeAddr(c1, r1), ctx.stack), c1, r1);
      return rangeValues(ctx.sh, { c: c1, r: r1 }, { c: c1 + w - 1, r: r1 + h - 1 }, ctx.stack);
    },
    FORMULATEXT: function (args, ctx) {
      var o = originOf(args[0]); if (!o || !ctx || !ctx.sh) return { e: '#N/A' };
      var raw = rawOf(ctx.sh, makeAddr(o.c, o.r));
      return raw && raw.charAt(0) === '=' ? { s: raw } : { e: '#N/A' };
    },
    TRANSPOSE: function (args) {
      var g = asGrid(args[0]);
      if (!g) return wrap(args[0]);
      var cols = g.cols || 1, rows = g.rows || Math.floor(g.length / cols), out = [];
      for (var c = 0; c < cols; c++) for (var r = 0; r < rows; r++) out.push(g[r * cols + c]);
      out.cols = rows; out.rows = cols; out.startC = g.startC; out.startR = g.startR;
      return out.length === 1 ? wrap(out[0]) : joinVals(out);
    },
    ERROR_TYPE: function (args) {
      var e = args[0] && args[0].e; if (!e) return { e: '#N/A' };
      var map = { '#NULL!': 1, '#DIV/0!': 2, '#VALUE!': 3, '#REF!': 4, '#NAME!': 5, '#NUM!': 6, '#N/A': 7 };
      return { n: map[e] || 7 };
    },
    ISFORMULA: function (args, ctx) {
      var o = originOf(args[0]); if (!o || !ctx || !ctx.sh) return { n: 0 };
      var raw = rawOf(ctx.sh, makeAddr(o.c, o.r));
      return { n: raw && raw.charAt(0) === '=' ? 1 : 0 };
    },
    ISEVEN: function (args) { return { n: Math.floor(asNum(args[0])) % 2 === 0 ? 1 : 0 }; },
    ISODD: function (args) { return { n: Math.abs(Math.floor(asNum(args[0])) % 2) === 1 ? 1 : 0 }; },
    ISNONTEXT: function (args) { var t = FN.ISTEXT(args); return { n: t.n ? 0 : 1 }; },
    ISREF: function (args) { return { n: originOf(args[0]) ? 1 : 0 }; },
    SHEET: function () { return { n: 1 }; },
    SHEETS: function () { return { n: (typeof db !== 'undefined' && db.spreadsheets) ? db.spreadsheets.length : 1 }; },
    CELL: function (args, ctx) {
      var info = displayVal(args[0] || '').toLowerCase(), o = originOf(args[1]) || (ctx && ctx.key ? parseAddr(ctx.key) : null);
      if (!o) return { e: '#N/A' };
      if (info === 'address') return { s: makeAddr(o.c, o.r) };
      if (info === 'row') return { n: o.r + 1 };
      if (info === 'col') return { n: o.c + 1 };
      if (info === 'contents') return ctx && ctx.sh ? wrap(evalCell(ctx.sh, makeAddr(o.c, o.r), ctx.stack)) : { s: '' };
      if (info === 'filename') return { s: 'KM' };
      return { s: makeAddr(o.c, o.r) };
    },
    RATE: function (args) {
      var n = asNum(args[0]), pmt = asNum(args[1]), pv = asNum(args[2]), fv = args[3] == null ? 0 : asNum(args[3]);
      var r = 0.1;
      for (var i = 0; i < 80; i++) {
        var f = pv * Math.pow(1 + r, n) + pmt * (Math.pow(1 + r, n) - 1) / r + fv;
        var df = n * pv * Math.pow(1 + r, n - 1) + pmt * ((n * r * Math.pow(1 + r, n - 1) - (Math.pow(1 + r, n) - 1)) / (r * r));
        if (Math.abs(df) < 1e-14) break;
        var nr = r - f / df;
        if (Math.abs(nr - r) < 1e-10) return { n: nr };
        r = nr;
      }
      return { n: r };
    },
    NPER: function (args) {
      var r = asNum(args[0]), pmt = asNum(args[1]), pv = asNum(args[2]), fv = args[3] == null ? 0 : asNum(args[3]);
      if (!r) return pmt ? { n: -(pv + fv) / pmt } : { e: '#NUM!' };
      return { n: Math.log((pmt - fv * r) / (pmt + pv * r)) / Math.log(1 + r) };
    },
    IPMT: function (args) {
      var r = asNum(args[0]), per = asNum(args[1]), n = asNum(args[2]), pv = asNum(args[3]);
      var pmt = FN.PMT([r, n, pv, args[4], args[5]]).n;
      var bal = pv;
      for (var i = 1; i < per; i++) bal = bal * (1 + r) + pmt;
      return { n: -(bal * r) };
    },
    PPMT: function (args) {
      var pmt = FN.PMT(args.slice(0, 1).concat(args.slice(2))).n;
      var ip = FN.IPMT(args).n;
      return { n: pmt - ip };
    },
    IRR: function (args) {
      var cfs = numsOf([args[0]]);
      if (cfs.length < 2) return { e: '#NUM!' };
      return { n: irrNewton(cfs, args[1] == null ? 0.1 : asNum(args[1])) };
    },
    MIRR: function (args) {
      var cfs = numsOf([args[0]]), fr = asNum(args[1]), rr = asNum(args[2]), pos = 0, neg = 0, n = cfs.length;
      for (var i = 0; i < n; i++) {
        if (cfs[i] >= 0) pos += cfs[i] * Math.pow(1 + rr, n - i - 1);
        else neg += cfs[i] / Math.pow(1 + fr, i);
      }
      if (!neg) return { e: '#DIV/0!' };
      return { n: Math.pow(-pos / neg, 1 / (n - 1)) - 1 };
    },
    SLN: function (args) { var n = asNum(args[2]); return n ? { n: (asNum(args[0]) - asNum(args[1])) / n } : { e: '#DIV/0!' }; },
    SYD: function (args) {
      var cost = asNum(args[0]), sal = asNum(args[1]), life = asNum(args[2]), per = asNum(args[3]);
      return { n: (cost - sal) * (life - per + 1) * 2 / (life * (life + 1)) };
    },
    DB: function (args) {
      var cost = asNum(args[0]), sal = asNum(args[1]), life = asNum(args[2]), per = asNum(args[3]);
      var rate = 1 - Math.pow(sal / cost, 1 / life), val = cost;
      for (var i = 1; i < per; i++) val -= val * rate;
      return { n: val * rate };
    },
    DDB: function (args) {
      var cost = asNum(args[0]), sal = asNum(args[1]), life = asNum(args[2]), per = asNum(args[3]), fac = args[4] == null ? 2 : asNum(args[4]);
      var val = cost, dep = 0;
      for (var i = 1; i <= per; i++) {
        dep = Math.min(val * fac / life, val - sal);
        if (i < per) val -= dep;
      }
      return { n: dep };
    },
    EFFECT: function (args) { var r = asNum(args[0]), n = asNum(args[1]); return n ? { n: Math.pow(1 + r / n, n) - 1 } : { e: '#NUM!' }; },
    NOMINAL: function (args) {
      var e = asNum(args[0]), n = asNum(args[1]);
      return n ? { n: n * (Math.pow(1 + e, 1 / n) - 1) } : { e: '#NUM!' };
    },
    CUMIPMT: function (args) {
      var tot = 0;
      for (var p = Math.floor(asNum(args[3])); p <= Math.floor(asNum(args[4])); p++) tot += FN.IPMT([args[0], p, args[1], args[2], 0, args[5]]).n;
      return { n: tot };
    },
    CUMPRINC: function (args) {
      var tot = 0;
      for (var p = Math.floor(asNum(args[3])); p <= Math.floor(asNum(args[4])); p++) tot += FN.PPMT([args[0], p, args[1], args[2], 0, args[5]]).n;
      return { n: tot };
    },
    BIN2DEC: function (args) { return { n: parseInt(displayVal(args[0]), 2) }; },
    DEC2BIN: function (args) {
      var n = Math.floor(asNum(args[0]));
      if (n < -512 || n > 511) return { e: '#NUM!' };
      if (n < 0) n = 512 + n + 512;
      var s = n.toString(2), places = args[1] == null ? 0 : Math.floor(asNum(args[1]));
      while (s.length < places) s = '0' + s;
      return { s: s };
    },
    HEX2DEC: function (args) { return { n: parseInt(displayVal(args[0]), 16) }; },
    DEC2HEX: function (args) {
      var n = Math.floor(asNum(args[0]));
      if (n < 0) n = 0x100000000 + n;
      var s = n.toString(16).toUpperCase(), places = args[1] == null ? 0 : Math.floor(asNum(args[1]));
      while (s.length < places) s = '0' + s;
      return { s: s };
    },
    OCT2DEC: function (args) { return { n: parseInt(displayVal(args[0]), 8) }; },
    DEC2OCT: function (args) {
      var n = Math.floor(asNum(args[0]));
      if (n < 0) n += 0x20000000;
      var s = n.toString(8), places = args[1] == null ? 0 : Math.floor(asNum(args[1]));
      while (s.length < places) s = '0' + s;
      return { s: s };
    },
    CONVERT: function (args) {
      var n = asNum(args[0]), from = displayVal(args[1] || ''), to = displayVal(args[2] || '');
      var u = { m: 1, km: 1000, cm: 0.01, mm: 0.001, in: 0.0254, ft: 0.3048, yd: 0.9144, mi: 1609.344, 'm2': 1, 'ft2': 0.092903, g: 0.001, kg: 1, lbm: 0.45359237, ozm: 0.028349523, l: 0.001, ml: 1e-6, gal: 0.003785411784, sec: 1, min: 60, hr: 3600, day: 86400 };
      if ((from === 'C' || from === 'F' || from === 'K') && (to === 'C' || to === 'F' || to === 'K')) {
        var k = from === 'C' ? n + 273.15 : from === 'F' ? (n + 459.67) * 5 / 9 : n;
        return { n: to === 'C' ? k - 273.15 : to === 'F' ? k * 9 / 5 - 459.67 : k };
      }
      if (u[from] == null || u[to] == null) return { e: '#N/A' };
      return { n: n * u[from] / u[to] };
    },
    DELTA: function (args) { return { n: asNum(args[0]) === (args[1] == null ? 0 : asNum(args[1])) ? 1 : 0 }; },
    GESTEP: function (args) { return { n: asNum(args[0]) >= (args[1] == null ? 0 : asNum(args[1])) ? 1 : 0 }; },
    ERF: function (args) { return { n: erf(asNum(args[0])) }; },
    ERFC: function (args) { return { n: 1 - erf(asNum(args[0])) }; },
    DSUM: function (args) { return FN.SUM(dbFieldVals(dbFiltered(args[0], args[2]), args[1])); },
    DAVERAGE: function (args) { return FN.AVERAGE(dbFieldVals(dbFiltered(args[0], args[2]), args[1])); },
    DCOUNT: function (args) { return FN.COUNT(dbFieldVals(dbFiltered(args[0], args[2]), args[1])); },
    DCOUNTA: function (args) { return FN.COUNTA(dbFieldVals(dbFiltered(args[0], args[2]), args[1])); },
    DMAX: function (args) { return FN.MAX(dbFieldVals(dbFiltered(args[0], args[2]), args[1])); },
    DMIN: function (args) { return FN.MIN(dbFieldVals(dbFiltered(args[0], args[2]), args[1])); },
    DPRODUCT: function (args) { return FN.PRODUCT(dbFieldVals(dbFiltered(args[0], args[2]), args[1])); },
    DGET: function (args) {
      var recs = dbFiltered(args[0], args[2]);
      if (recs.length !== 1) return { e: recs.length ? '#NUM!' : '#VALUE!' };
      return wrap(dbFieldVals(recs, args[1])[0]);
    },
    SEQUENCE: function (args) {
      var rows = Math.max(1, Math.floor(asNum(args[0]) || 1)), cols = args[1] == null ? 1 : Math.max(1, Math.floor(asNum(args[1])));
      var start = args[2] == null ? 1 : asNum(args[2]), step = args[3] == null ? 1 : asNum(args[3]), out = [];
      for (var i = 0; i < rows * cols; i++) out.push({ n: start + i * step });
      return joinVals(out);
    },
    RANDARRAY: function (args) {
      var rows = Math.max(1, Math.floor(asNum(args[0]) || 1)), cols = args[1] == null ? 1 : Math.max(1, Math.floor(asNum(args[1])));
      var out = []; for (var i = 0; i < rows * cols; i++) out.push({ n: Math.random() });
      return joinVals(out);
    },
    TAKE: function (args) {
      var arr = flatten([args[0]]), n = Math.floor(asNum(args[1]));
      return joinVals(n >= 0 ? arr.slice(0, n) : arr.slice(n));
    },
    DROP: function (args) {
      var arr = flatten([args[0]]), n = Math.floor(asNum(args[1]));
      return joinVals(n >= 0 ? arr.slice(n) : arr.slice(0, arr.length + n));
    },
    TOCOL: function (args) { return joinVals(flatten(args)); },
    TOROW: function (args) { return FN.TOCOL(args); },
    VSTACK: function (args) { return joinVals(flatten(args)); },
    HSTACK: function (args) { return FN.VSTACK(args); },
    DOLLARDE: function (args) {
      var f = asNum(args[0]), den = asNum(args[1]), ip = Math.trunc(f), frac = Math.abs(f) - Math.abs(ip);
      return den ? { n: ip + (frac * Math.pow(10, String(Math.floor(frac * 100)).length || 2) / den) } : { e: '#NUM!' };
    },
    DOLLARFR: function (args) {
      var n = asNum(args[0]), den = asNum(args[1]), ip = Math.trunc(n), frac = Math.abs(n) - Math.abs(ip);
      return den ? { n: ip + frac * den / 100 } : { e: '#NUM!' };
    },
    HYPERLINK: function (args) { return { s: displayVal(args[1] != null ? args[1] : args[0]) }; }
  };
  FN.MAXIFS = function (args) {
    var vals = flatten([args[0]]), n = vals.length, best = null;
    for (var i = 0; i < n; i++) {
      var ok = true;
      for (var p = 1; p + 1 < args.length; p += 2) {
        if (!matchCrit(flatten([args[p]])[i], args[p + 1])) { ok = false; break; }
      }
      if (!ok) continue;
      var v = toNum(vals[i]);
      if (isFinite(v) && (best == null || v > best)) best = v;
    }
    return best == null ? { e: '#N/A' } : { n: best };
  };
  FN.MINIFS = function (args) {
    var vals = flatten([args[0]]), n = vals.length, best = null;
    for (var i = 0; i < n; i++) {
      var ok = true;
      for (var p = 1; p + 1 < args.length; p += 2) {
        if (!matchCrit(flatten([args[p]])[i], args[p + 1])) { ok = false; break; }
      }
      if (!ok) continue;
      var v = toNum(vals[i]);
      if (isFinite(v) && (best == null || v < best)) best = v;
    }
    return best == null ? { e: '#N/A' } : { n: best };
  };
  FN['RANK.EQ'] = FN.RANK; FN['RANK.AVG'] = FN.RANK;
  FN.ԳՈՒՄԱՐ = FN.SUM; FN.AVG = FN.AVERAGE; FN.ՄԻՋԻՆ = FN.AVERAGE;
  FN.ՆՎԱԶ = FN.MIN; FN.ԱՌԱՎ = FN.MAX; FN.ՀԱՇՎԵԼ = FN.COUNT;
  FN.ԵԹԵ = FN.IF; FN.CONCATENATE = FN.CONCAT;
  FN.STDEV_S = FN.STDEV; FN.STDEV_P = FN.STDEVP; FN.VAR_S = FN.VAR; FN.VAR_P = FN.VARP;
  FN['STDEV.S'] = FN.STDEV; FN['STDEV.P'] = FN.STDEVP; FN['VAR.S'] = FN.VAR; FN['VAR.P'] = FN.VARP;
  FN.MODE_SNGL = FN.MODE; FN['MODE.SNGL'] = FN.MODE;
  FN.PERCENTILE_INC = FN.PERCENTILE; FN['PERCENTILE.INC'] = FN.PERCENTILE;
  FN.QUARTILE_INC = FN.QUARTILE; FN['QUARTILE.INC'] = FN.QUARTILE;
  FN['NORM.DIST'] = FN.NORMDIST; FN['NORM.S.DIST'] = FN.NORMSDIST; FN['NORM.S.INV'] = FN.NORMSINV; FN['NORM.INV'] = FN.NORMINV;
  FN['BINOM.DIST'] = FN.BINOMDIST; FN['POISSON.DIST'] = FN.POISSON; FN['EXPON.DIST'] = FN.EXPONDIST;
  FN['FORECAST.LINEAR'] = FN.FORECAST; FN['COVARIANCE.P'] = FN.COVARIANCE_P; FN['COVARIANCE.S'] = FN.COVARIANCE_S;
  FN['NETWORKDAYS.INTL'] = FN.NETWORKDAYS; FN['WORKDAY.INTL'] = FN.WORKDAY;
  FN['ERROR.TYPE'] = FN.ERROR_TYPE; FN.ERRORTYPE = FN.ERROR_TYPE;
  FN['CEILING.MATH'] = FN.CEILING; FN['FLOOR.MATH'] = FN.FLOOR; FN['ISO.CEILING'] = FN.CEILING;
  FN['PERCENTRANK.INC'] = FN.PERCENTRANK; FN['CONFIDENCE.NORM'] = FN.CONFIDENCE;
  FN._blocked = {
    WEBSERVICE: 1, FILTERXML: 1, ENCODEURL: 1, IMAGE: 1, STOCKHISTORY: 1,
    PYTHON: 1, COPILOT: 1, RTD: 1, CUBEMEMBER: 1, CUBEVALUE: 1, CUBEKPIMEMBER: 1,
    CUBESET: 1, CUBESETCOUNT: 1, CUBERANKEDMEMBER: 1, CUBEMEMBERPROPERTY: 1
  };

  function tokenize(src) {
    var s = String(src || ''), tokens = [], i = 0;
    while (i < s.length) {
      var c = s.charAt(i);
      if (c === ' ' || c === '\t' || c === '\n') { i++; continue; }
      if (c === ',' || c === ';') { tokens.push({ t: 'comma' }); i++; continue; }
      if (c === ':') { tokens.push({ t: 'colon' }); i++; continue; }
      if (c === '&') { tokens.push({ t: 'op', v: '&' }); i++; continue; }
      if ('+-*/^()%'.indexOf(c) >= 0) { tokens.push({ t: 'op', v: c }); i++; continue; }
      if (c === '<' || c === '>' || c === '=') {
        var op = c; i++;
        if (s.charAt(i) === '=' || (c === '<' && s.charAt(i) === '>')) { op += s.charAt(i); i++; }
        tokens.push({ t: 'cmp', v: op }); continue;
      }
      if (c === '"' || c === "'") {
        var q = c; i++; var str = '';
        while (i < s.length && s.charAt(i) !== q) {
          if (s.charAt(i) === '\\' && i + 1 < s.length) { str += s.charAt(i + 1); i += 2; continue; }
          str += s.charAt(i++);
        }
        i++; tokens.push({ t: 'str', v: str }); continue;
      }
      if (/[0-9.]/.test(c)) {
        var num = '';
        while (i < s.length && /[0-9.]/.test(s.charAt(i))) num += s.charAt(i++);
        tokens.push({ t: 'num', v: parseFloat(num) }); continue;
      }
      if (/[A-Za-zԱ-Ֆա-ֆ_]/.test(c) || c === '$') {
        var id = '';
        while (i < s.length && /[A-Za-zԱ-Ֆա-ֆ0-9_\$\.]/.test(s.charAt(i))) id += s.charAt(i++);
        var ref = parseAddr(id.replace(/\$/g, ''));
        if (ref && ref.c >= 0 && ref.c < MAX_COLS && ref.r >= 0 && ref.r < MAX_ROWS) {
          tokens.push({ t: 'ref', v: ref.key, c: ref.c, r: ref.r });
        } else tokens.push({ t: 'id', v: id.toUpperCase() });
        continue;
      }
      tokens.push({ t: 'bad', v: c }); i++;
    }
    tokens.push({ t: 'eof' });
    return tokens;
  }
  function evalCell(sh, key, stack) {
    var ck = sh.id + '|' + key;
    if (Object.prototype.hasOwnProperty.call(cache, ck)) return cache[ck];
    stack = stack || new Set();
    if (stack.has(key)) return { e: '#CYCLE!' };
    var raw = rawOf(sh, key);
    if (!raw) { cache[ck] = { s: '' }; return cache[ck]; }
    if (raw.charAt(0) !== '=') {
      var n = toNum(raw);
      var val = isFinite(n) && /^-?\d/.test(String(raw).trim()) ? { n: n } : { s: raw };
      cache[ck] = val; return val;
    }
    stack.add(key);
    var out;
    try { out = evalFormula(sh, raw.slice(1), stack, key); }
    catch (e) { out = { e: '#VALUE!' }; }
    stack.delete(key);
    cache[ck] = out;
    return out;
  }
  function rangeValues(sh, a, b, stack) {
    var c1 = Math.min(a.c, b.c), c2 = Math.max(a.c, b.c);
    var r1 = Math.min(a.r, b.r), r2 = Math.max(a.r, b.r), out = [];
    for (var r = r1; r <= r2; r++) for (var c = c1; c <= c2; c++) out.push(evalCell(sh, makeAddr(c, r), stack));
    out.cols = c2 - c1 + 1;
    out.rows = r2 - r1 + 1;
    out.startC = c1;
    out.startR = r1;
    return out;
  }
  function evalFormula(sh, src, stack, originKey) {
    var tokens = tokenize(src), i = 0;
    var ctx = { sh: sh, key: originKey || sel, stack: stack };
    function peek() { return tokens[i] || { t: 'eof' }; }
    function eat() { return tokens[i++] || { t: 'eof' }; }
    function parseCmp() {
      var left = parseConcat(), p = peek();
      if (p.t === 'cmp') {
        eat();
        var right = parseConcat(), ln = toNum(left), rn = toNum(right), ok;
        if (isFinite(ln) && isFinite(rn)) {
          if (p.v === '=') ok = ln === rn;
          else if (p.v === '<>') ok = ln !== rn;
          else if (p.v === '>') ok = ln > rn;
          else if (p.v === '<') ok = ln < rn;
          else if (p.v === '>=') ok = ln >= rn;
          else if (p.v === '<=') ok = ln <= rn;
        } else {
          var ls = displayVal(left), rs = displayVal(right);
          ok = p.v === '=' ? ls === rs : p.v === '<>' ? ls !== rs : false;
        }
        return { n: ok ? 1 : 0 };
      }
      return left;
    }
    function parseConcat() {
      var left = parseAdd();
      while (peek().t === 'op' && peek().v === '&') { eat(); left = { s: displayVal(left) + displayVal(parseAdd()) }; }
      return left;
    }
    function parseAdd() {
      var left = parseMul();
      while (peek().t === 'op' && (peek().v === '+' || peek().v === '-')) {
        var op = eat().v, right = parseMul(), ln = toNum(left), rn = toNum(right);
        if (!isFinite(ln) || !isFinite(rn)) return { e: '#VALUE!' };
        left = { n: op === '+' ? ln + rn : ln - rn };
      }
      return left;
    }
    function parseMul() {
      var left = parsePow();
      while (peek().t === 'op' && (peek().v === '*' || peek().v === '/' || peek().v === '%')) {
        var op = eat().v;
        if (op === '%' && (peek().t === 'eof' || peek().t === 'comma' || (peek().t === 'op' && peek().v === ')'))) {
          var n = toNum(left);
          if (!isFinite(n)) return { e: '#VALUE!' };
          left = { n: n / 100 }; continue;
        }
        var right = parsePow(), ln = toNum(left), rn = toNum(right);
        if (!isFinite(ln) || !isFinite(rn)) return { e: '#VALUE!' };
        if (op === '/' && rn === 0) return { e: '#DIV/0!' };
        left = { n: op === '*' ? ln * rn : op === '/' ? ln / rn : ln % rn };
      }
      if (peek().t === 'op' && peek().v === '%') {
        eat();
        var pn = toNum(left);
        if (!isFinite(pn)) return { e: '#VALUE!' };
        left = { n: pn / 100 };
      }
      return left;
    }
    function parsePow() {
      var left = parseUnary();
      if (peek().t === 'op' && peek().v === '^') {
        eat();
        var right = parsePow(), ln = toNum(left), rn = toNum(right);
        if (!isFinite(ln) || !isFinite(rn)) return { e: '#VALUE!' };
        return { n: Math.pow(ln, rn) };
      }
      return left;
    }
    function parseUnary() {
      if (peek().t === 'op' && (peek().v === '+' || peek().v === '-')) {
        var op = eat().v, v = parseUnary(), n = toNum(v);
        if (!isFinite(n)) return { e: '#VALUE!' };
        return { n: op === '-' ? -n : n };
      }
      return parsePrimary();
    }
    function parsePrimary() {
      var t = peek();
      if (t.t === 'num') { eat(); return { n: t.v }; }
      if (t.t === 'str') { eat(); return { s: t.v }; }
      if (t.t === 'ref') {
        eat();
        if (peek().t === 'colon') {
          eat();
          var b = peek();
          if (b.t !== 'ref') return { e: '#REF!' };
          eat();
          return rangeValues(sh, t, b, stack);
        }
        return withRef(evalCell(sh, t.v, stack), t.c, t.r);
      }
      if (t.t === 'id') {
        eat();
        var name = t.v;
        if (peek().t !== 'op' || peek().v !== '(') {
          if (name === 'TRUE') return { n: 1 };
          if (name === 'FALSE') return { n: 0 };
          if (name === 'PI') return { n: Math.PI };
          if (name === 'TODAY' && FN.TODAY) return FN.TODAY([]);
          if (name === 'NOW' && FN.NOW) return FN.NOW([]);
          if (name === 'NA') return { e: '#N/A' };
          return { e: '#NAME!' };
        }
        eat();
        var args = [];
        if (!(peek().t === 'op' && peek().v === ')')) {
          args.push(parseCmp());
          while (peek().t === 'comma') { eat(); args.push(parseCmp()); }
        }
        if (peek().t === 'op' && peek().v === ')') eat();
        if (FN._blocked && (FN._blocked[name] || FN._blocked[name.replace(/\./g, '_')])) return { e: '#N/A' };
        var fn = FN[name] || FN[name.replace(/\./g, '_')];
        if (!fn) return { e: '#NAME!' };
        return fn(args, ctx);
      }
      if (t.t === 'op' && t.v === '(') {
        eat();
        var inner = parseCmp();
        if (peek().t === 'op' && peek().v === ')') eat();
        return inner;
      }
      eat();
      return { e: '#VALUE!' };
    }
    var result = parseCmp();
    return Array.isArray(result) ? (result[0] || { s: '' }) : result;
  }
  function computed(sh, key) { return displayVal(evalCell(sh, key, new Set())); }

  function shiftFormula(raw, dc, dr) {
    raw = String(raw == null ? '' : raw);
    if (raw.charAt(0) !== '=') return raw;
    return raw.replace(/(\$?)([A-Za-z]{1,3})(\$?)(\d{1,4})\b/g, function (m, d1, col, d2, row) {
      var a = parseAddr(col + row);
      if (!a) return m;
      var c = a.c, r = a.r;
      if (!d1) c += dc;
      if (!d2) r += dr;
      if (c < 0 || r < 0 || c >= MAX_COLS || r >= MAX_ROWS) return '#REF!';
      return d1 + colName(c) + d2 + String(r + 1);
    });
  }
  function rewriteSheetRefs(sh, colFrom, dCol, rowFrom, dRow) {
    var delC = dCol < 0 ? colFrom + dCol : -1;
    var delR = dRow < 0 ? rowFrom + dRow : -1;
    Object.keys(sh.cells).forEach(function (key) {
      var raw = sh.cells[key];
      if (!raw || raw.charAt(0) !== '=') return;
      sh.cells[key] = String(raw).replace(/(\$?)([A-Za-z]{1,3})(\$?)(\d{1,4})\b/g, function (m, d1, col, d2, row) {
        var a = parseAddr(col + row);
        if (!a) return m;
        var c = a.c, r = a.r;
        if (delC >= 0 && c === delC) return '#REF!';
        if (delR >= 0 && r === delR) return '#REF!';
        if (!d1 && dCol && c >= colFrom) c += dCol;
        if (!d2 && dRow && r >= rowFrom) r += dRow;
        if (c < 0 || r < 0) return '#REF!';
        return d1 + colName(c) + d2 + String(r + 1);
      });
    });
  }

  /* ---------- selection / range ---------- */
  function rangeBox() {
    var a = parseAddr(anchor) || parseAddr(sel) || { c: 0, r: 0 };
    var b = parseAddr(sel) || a;
    return {
      c1: Math.min(a.c, b.c), c2: Math.max(a.c, b.c),
      r1: Math.min(a.r, b.r), r2: Math.max(a.r, b.r)
    };
  }
  function rangeLabel() {
    var b = rangeBox();
    var a1 = makeAddr(b.c1, b.r1), a2 = makeAddr(b.c2, b.r2);
    return a1 === a2 ? a1 : a1 + ':' + a2;
  }
  function inRange(key) {
    var a = parseAddr(key), b = rangeBox();
    return a && a.c >= b.c1 && a.c <= b.c2 && a.r >= b.r1 && a.r <= b.r2;
  }
  function eachRange(fn) {
    var b = rangeBox(), sh = sheet();
    for (var r = b.r1; r <= b.r2; r++) for (var c = b.c1; c <= b.c2; c++) fn(sh, makeAddr(c, r), c, r);
  }
  function usedBox(sh) {
    var c2 = 0, r2 = 0, any = false;
    Object.keys(sh.cells || {}).forEach(function (k) {
      if (!rawOf(sh, k)) return;
      var a = parseAddr(k); if (!a) return;
      any = true;
      if (a.c > c2) c2 = a.c;
      if (a.r > r2) r2 = a.r;
    });
    return any ? { c1: 0, r1: 0, c2: c2, r2: r2 } : { c1: 0, r1: 0, c2: 0, r2: 0 };
  }
  function growTo(c, r) {
    var sh = sheet(), changed = false;
    if (c >= sh.cols - 1 && sh.cols < MAX_COLS) { sh.cols = Math.min(MAX_COLS, c + 3); changed = true; }
    if (r >= sh.rows - 1 && sh.rows < MAX_ROWS) { sh.rows = Math.min(MAX_ROWS, r + 5); changed = true; }
    return changed;
  }

  /* ---------- UI ---------- */
  function injectCss() {
    var s = document.getElementById('km-ss-css');
    if (!s) { s = document.createElement('style'); s.id = 'km-ss-css'; document.head.appendChild(s); }
    s.textContent = [
      '#kmSsRoot{display:flex;flex-direction:column;gap:8px;min-height:calc(100vh - 120px)}',
      '#kmSsRoot .kmSsCard{display:flex;flex-direction:column;min-height:0;flex:1}',
      '.kmSsFormula{display:flex;gap:8px;align-items:center;margin:6px 0 8px}',
      '.kmSsAddr{min-width:86px;font-weight:700;background:#e9eef2;border:1px solid #cfd6dd;border-radius:6px;padding:7px 8px;text-align:center;font-size:12px}',
      '.kmSsBar{flex:1;padding:8px 10px;border:1px solid #cfd6dd;border-radius:6px;font-family:Consolas,"Segoe UI",monospace}',
      '.kmSsQuick{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px}',
      '.kmSsQuick button{padding:5px 9px;font-size:12px}',
      '.kmSsGridWrap{overflow:auto;border:1px solid #cfd6dd;border-radius:8px;max-height:calc(100vh - 320px);background:#fff}',
      '.kmSsGrid{border-collapse:collapse;table-layout:fixed}',
      '.kmSsGrid th,.kmSsGrid td{border:1px solid #d5dde4;padding:0;height:28px}',
      '.kmSsGrid thead th{position:sticky;top:0;z-index:3;background:#e9eef2;font-size:12px;font-weight:700;color:#4a5a68;user-select:none}',
      '.kmSsGrid tbody th{position:sticky;left:0;z-index:2;background:#eef3f7;width:42px;min-width:42px;text-align:center;font-size:12px;color:#5b6b78;cursor:pointer;user-select:none}',
      '.kmSsGrid thead th:first-child{z-index:4;left:0;width:42px;cursor:pointer}',
      '.kmSsGrid thead th{position:relative;cursor:pointer}',
      '.kmSsColResizer{position:absolute;top:0;right:0;width:6px;height:100%;cursor:col-resize}',
      '.kmSsGrid td{min-width:92px;background:#fff;cursor:cell;font-size:13px;padding:0 6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.kmSsGrid td.kmSsFormulaCell{color:#1a4f8a}',
      '.kmSsGrid td.kmSsErr{color:#a52828;font-weight:600}',
      '.kmSsGrid td.kmSsRange{background:#d7e8f5}',
      '.kmSsGrid td.kmSsSel{outline:2px solid #315f7d;outline-offset:-2px;background:#cfe0ee}',
      '.kmSsGrid td.kmSsHit{box-shadow:inset 0 0 0 2px #c9a227}',
      '.kmSsGrid td input{width:100%;height:28px;border:0;padding:0 6px;background:transparent;font:inherit}',
      '.kmSsTabs{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:8px}',
      '.kmSsTab{padding:6px 12px;border:1px solid #ccd5dc;border-radius:7px;background:#fff}',
      '.kmSsTab.sel{background:#22394d;color:#fff;border-color:#22394d}',
      '.kmSsStatus{display:flex;gap:16px;flex-wrap:wrap;font-size:12px;color:#4a5a68;padding:6px 2px 0}',
      '.kmSsStatus b{color:#182433}',
      '.kmSsHint{font-size:12px;margin:6px 0 0}',
      '#kmSsFnModal .kmSsFnBox{background:#fff;width:min(920px,96vw);max-height:90vh;overflow:auto;border-radius:12px;padding:18px}',
      '#kmSsFnModal .kmSsFnBox h3{margin:0 0 8px}',
      '#kmSsFnModal .kmSsFnBox h4{margin:14px 0 6px;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:#4a5f73}',
      '#kmSsFnModal .kmSsFnFilter{width:100%;padding:8px 10px;margin:0 0 8px;border:1px solid #cfd6dd;border-radius:8px}',
      '#kmSsFnModal [data-fn]{font-family:Consolas,"Segoe UI",monospace;font-size:12px}',
      'body.km-dark #kmSsFnModal .kmSsFnBox{background:#1c2a3a;color:#f0f4f8}',
      'body.km-dark #kmSsFnModal .kmSsFnBox h4{color:#9ab}',
      'body.km-dark #kmSsFnModal .kmSsFnFilter{background:#162231;color:#f0f4f8;border-color:#2d4560}',
      'body.km-dark .kmSsGridWrap,body.km-dark .kmSsGrid td{background:#162231}',
      'body.km-dark .kmSsGrid thead th,body.km-dark .kmSsGrid tbody th,body.km-dark .kmSsAddr{background:#1c2a3a;color:#dce7ef;border-color:#2d4560}',
      'body.km-dark .kmSsGrid th,body.km-dark .kmSsGrid td,body.km-dark .kmSsBar,body.km-dark .kmSsTab{border-color:#2d4560}',
      'body.km-dark .kmSsGrid td.kmSsRange{background:#2a445c}',
      'body.km-dark .kmSsGrid td.kmSsSel{background:#315f7d}',
      'body.km-dark .kmSsBar,body.km-dark .kmSsTab{background:#1c2a3a;color:#f0f4f8}',
      'body.km-dark .kmSsStatus,body.km-dark .kmSsStatus b{color:#dce7ef}'
    ].join('\n');
  }

  function colW(sh, c) {
    var w = sh.widths && sh.widths[c];
    return Math.max(48, Math.min(420, +w || 92));
  }

  function paintCells() {
    var sh = sheet();
    var root = document.getElementById('kmSsGrid');
    if (!root) return;
    var box = rangeBox();
    root.querySelectorAll('td[data-ref]').forEach(function (td) {
      var key = td.getAttribute('data-ref');
      if (editing && key === sel && td.querySelector('input')) return;
      var raw = rawOf(sh, key);
      var shown = raw.charAt(0) === '=' ? computed(sh, key) : raw;
      td.textContent = shown;
      td.classList.toggle('kmSsFormulaCell', raw.charAt(0) === '=');
      td.classList.toggle('kmSsErr', /^#/.test(shown));
      td.classList.toggle('kmSsSel', key === sel);
      td.classList.toggle('kmSsRange', key !== sel && inRange(key));
      td.classList.toggle('kmSsHit', findHits.indexOf(key) >= 0);
      td.title = raw.charAt(0) === '=' ? raw : '';
    });
    var addr = document.getElementById('kmSsAddr');
    var bar = document.getElementById('kmSsBar');
    if (addr) addr.textContent = rangeLabel();
    if (bar && document.activeElement !== bar) bar.value = rawOf(sh, sel);
    paintStatus();
  }

  function paintStatus() {
    var el = document.getElementById('kmSsStatus');
    if (!el) return;
    var nums = [], filled = 0;
    eachRange(function (sh, key) {
      var raw = rawOf(sh, key);
      if (raw) filled++;
      var n = toNum(evalCell(sh, key, new Set()));
      if (isFinite(n)) nums.push(n);
    });
    if (!nums.length && filled < 2) { el.innerHTML = ''; return; }
    var sum = nums.reduce(function (a, b) { return a + b; }, 0);
    var parts = [];
    if (nums.length) {
      parts.push('Գումար՝ <b>' + displayVal({ n: sum }) + '</b>');
      parts.push('Միջին՝ <b>' + displayVal({ n: sum / nums.length }) + '</b>');
      parts.push('Մին՝ <b>' + displayVal({ n: Math.min.apply(null, nums) }) + '</b>');
      parts.push('Մաքս՝ <b>' + displayVal({ n: Math.max.apply(null, nums) }) + '</b>');
      parts.push('Թվեր՝ <b>' + nums.length + '</b>');
    }
    if (filled) parts.push('Լցված՝ <b>' + filled + '</b>');
    el.innerHTML = parts.join('<span>·</span>');
  }

  function editInput() {
    return document.querySelector('#kmSsGrid td[data-ref="' + sel + '"] input');
  }
  function isFormulaEdit() {
    var inp = editInput();
    return !!(editing && inp && String(inp.value).charAt(0) === '=');
  }
  function insertRefAtCaret(ref) {
    var inp = editInput() || document.getElementById('kmSsBar');
    if (!inp) return;
    var v = String(inp.value || '');
    var start = inp.selectionStart == null ? v.length : inp.selectionStart;
    var end = inp.selectionEnd == null ? v.length : inp.selectionEnd;
    if (v.charAt(0) !== '=') return;
    inp.value = v.slice(0, start) + ref + v.slice(end);
    var pos = start + ref.length;
    inp.setSelectionRange(pos, pos);
    inp.focus();
    var bar = document.getElementById('kmSsBar');
    if (bar && inp !== bar) bar.value = inp.value;
  }

  function startEdit(initial) {
    if (!canEdit()) return;
    var td = document.querySelector('#kmSsGrid td[data-ref="' + sel + '"]');
    if (!td || editing) return;
    editing = true;
    var raw = initial != null ? initial : rawOf(sheet(), sel);
    td.innerHTML = '';
    var inp = document.createElement('input');
    inp.value = raw;
    inp.setAttribute('spellcheck', 'false');
    td.appendChild(inp);
    inp.focus();
    if (initial == null) inp.select();
    else inp.setSelectionRange(inp.value.length, inp.value.length);
    inp.onkeydown = function (e) {
      if (e.key === 'Enter') { e.preventDefault(); commitEdit(inp.value, 'down'); }
      else if (e.key === 'Tab') { e.preventDefault(); commitEdit(inp.value, e.shiftKey ? 'left' : 'right'); }
      else if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
      else {
        var bar = document.getElementById('kmSsBar');
        if (bar) setTimeout(function () { bar.value = inp.value; }, 0);
      }
    };
    inp.onblur = function () {
      setTimeout(function () {
        if (editing && document.activeElement !== inp && document.activeElement && document.activeElement.id !== 'kmSsBar') {
          commitEdit(inp.value, '');
        }
      }, 0);
    };
    var bar = document.getElementById('kmSsBar');
    if (bar) bar.value = raw;
  }
  function commitEdit(val, move) {
    if (!editing) return;
    editing = false;
    var sh = sheet();
    val = String(val == null ? '' : val);
    if (val !== rawOf(sh, sel)) {
      setRaw(sh, sel, val);
      scheduleSave();
    }
    var a = parseAddr(sel);
    var grew = a ? growTo(a.c, a.r) : false;
    if (grew) renderPage();
    else paintCells();
    if (move) moveSel(move, false);
  }
  function cancelEdit() { editing = false; paintCells(); }

  function moveSel(dir, extend) {
    var sh = sheet();
    var a = parseAddr(sel) || { c: 0, r: 0 };
    if (dir === 'left') a.c = Math.max(0, a.c - 1);
    if (dir === 'right') a.c = Math.min(sh.cols - 1, a.c + 1);
    if (dir === 'up') a.r = Math.max(0, a.r - 1);
    if (dir === 'down') a.r = Math.min(sh.rows - 1, a.r + 1);
    if (dir === 'home') a.c = 0;
    if (dir === 'end') {
      var last = 0;
      for (var c = 0; c < sh.cols; c++) if (rawOf(sh, makeAddr(c, a.r))) last = c;
      a.c = last;
    }
    sel = makeAddr(a.c, a.r);
    if (!extend) anchor = sel;
    paintCells();
    var td = document.querySelector('#kmSsGrid td[data-ref="' + sel + '"]');
    if (td) td.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  function jumpEdge(dir, extend) {
    var sh = sheet(), a = parseAddr(sel) || { c: 0, r: 0 }, c = a.c, r = a.r, found = false;
    function filled(cc, rr) { return !!rawOf(sh, makeAddr(cc, rr)); }
    if (dir === 'left') {
      if (c > 0 && filled(c, r) && filled(c - 1, r)) { while (c > 0 && filled(c - 1, r)) c--; }
      else { while (c > 0 && !filled(c - 1, r)) c--; if (c > 0) c--; while (c > 0 && filled(c - 1, r)) c--; }
    } else if (dir === 'right') {
      if (c < sh.cols - 1 && filled(c, r) && filled(c + 1, r)) { while (c < sh.cols - 1 && filled(c + 1, r)) c++; }
      else { while (c < sh.cols - 1 && !filled(c + 1, r)) c++; if (c < sh.cols - 1) c++; while (c < sh.cols - 1 && filled(c + 1, r)) c++; }
    } else if (dir === 'up') {
      if (r > 0 && filled(c, r) && filled(c, r - 1)) { while (r > 0 && filled(c, r - 1)) r--; }
      else { while (r > 0 && !filled(c, r - 1)) r--; if (r > 0) r--; while (r > 0 && filled(c, r - 1)) r--; }
    } else if (dir === 'down') {
      if (r < sh.rows - 1 && filled(c, r) && filled(c, r + 1)) { while (r < sh.rows - 1 && filled(c, r + 1)) r++; }
      else { while (r < sh.rows - 1 && !filled(c, r + 1)) r++; if (r < sh.rows - 1) r++; while (r < sh.rows - 1 && filled(c, r + 1)) r++; }
    }
    sel = makeAddr(c, r);
    if (!extend) anchor = sel;
    paintCells();
    var td = document.querySelector('#kmSsGrid td[data-ref="' + sel + '"]');
    if (td) td.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  function selectCell(key, extend) {
    if (editing && !isFormulaEdit()) {
      var inp = editInput();
      if (inp) commitEdit(inp.value, '');
    }
    sel = key;
    if (!extend) anchor = key;
    paintCells();
  }

  function bindGrid(wrap) {
    wrap.addEventListener('mousedown', function (e) {
      var res = e.target.closest('.kmSsColResizer');
      if (res) {
        var th = res.parentElement;
        var c = +th.getAttribute('data-col');
        resizing = { c: c, x: e.clientX, w: colW(sheet(), c) };
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      var thCol = e.target.closest('thead th[data-col]');
      if (thCol && !e.target.closest('.kmSsColResizer')) {
        var cc = +thCol.getAttribute('data-col');
        var sh = sheet();
        anchor = makeAddr(cc, 0);
        sel = makeAddr(cc, sh.rows - 1);
        paintCells();
        e.preventDefault();
        return;
      }
      var thRow = e.target.closest('tbody th[data-row]');
      if (thRow) {
        var rr = +thRow.getAttribute('data-row');
        var sh2 = sheet();
        anchor = makeAddr(0, rr);
        sel = makeAddr(sh2.cols - 1, rr);
        paintCells();
        e.preventDefault();
        return;
      }
      var td = e.target.closest('td[data-ref]');
      if (!td) return;
      if (e.target.tagName === 'INPUT') return;
      var key = td.getAttribute('data-ref');
      if (isFormulaEdit()) {
        e.preventDefault();
        insertRefAtCaret(key);
        return;
      }
      e.preventDefault();
      selectCell(key, e.shiftKey);
      if (!e.shiftKey) dragging = true;
    });
    wrap.addEventListener('mouseover', function (e) {
      if (!dragging) return;
      var td = e.target.closest('td[data-ref]');
      if (!td) return;
      sel = td.getAttribute('data-ref');
      paintCells();
    });
    wrap.addEventListener('dblclick', function (e) {
      var td = e.target.closest('td[data-ref]');
      if (!td) return;
      selectCell(td.getAttribute('data-ref'), false);
      startEdit();
    });
  }

  document.addEventListener('mousemove', function (e) {
    if (!resizing) return;
    var sh = sheet();
    var nw = Math.max(48, Math.min(420, resizing.w + (e.clientX - resizing.x)));
    sh.widths[resizing.c] = nw;
    var th = document.querySelector('#kmSsGrid thead th[data-col="' + resizing.c + '"]');
    var tds = document.querySelectorAll('#kmSsGrid td[data-ref^="' + colName(resizing.c) + '"]');
    var st = 'width:' + nw + 'px;min-width:' + nw + 'px;max-width:' + nw + 'px';
    if (th) th.style.cssText = st;
    tds.forEach(function (td) {
      var a = parseAddr(td.getAttribute('data-ref'));
      if (a && a.c === resizing.c) td.style.cssText = st;
    });
  });
  document.addEventListener('mouseup', function () {
    if (resizing) { scheduleSave(); resizing = null; }
    dragging = false;
  });

  function clearRange() {
    if (!canEdit()) return;
    eachRange(function (sh, key) { setRaw(sh, key, ''); });
    scheduleSave();
    paintCells();
  }
  function copyRange(cut) {
    var b = rangeBox(), sh = sheet(), rows = [], vis = [];
    for (var r = b.r1; r <= b.r2; r++) {
      var rawRow = [], visRow = [];
      for (var c = b.c1; c <= b.c2; c++) {
        var key = makeAddr(c, r);
        rawRow.push(rawOf(sh, key));
        visRow.push(computed(sh, key));
      }
      rows.push(rawRow);
      vis.push(visRow.join('\t'));
    }
    clip = { rows: rows, origin: { c: b.c1, r: b.r1 }, formula: true, vis: vis.join('\n') };
    try { navigator.clipboard.writeText(clip.vis); } catch (err) {}
    if (cut) clearRange();
  }
  function parseTsv(text) {
    return String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').map(function (line) {
      return line.split('\t');
    }).filter(function (row, i, arr) { return i < arr.length - 1 || row.some(function (x) { return x !== ''; }); });
  }
  function pasteBlock(rows, asFormula, origin) {
    if (!canEdit() || !rows || !rows.length) return;
    var sh = sheet();
    var dest = parseAddr(sel) || { c: 0, r: 0 };
    var dc = origin ? dest.c - origin.c : 0;
    var dr = origin ? dest.r - origin.r : 0;
    var maxC = dest.c, maxR = dest.r;
    rows.forEach(function (row, ri) {
      (row || []).forEach(function (val, ci) {
        var c = dest.c + ci, r = dest.r + ri;
        if (c >= MAX_COLS || r >= MAX_ROWS) return;
        var raw = String(val == null ? '' : val);
        if (asFormula && raw.charAt(0) === '=') raw = shiftFormula(raw, dc, dr);
        setRaw(sh, makeAddr(c, r), raw);
        if (c > maxC) maxC = c;
        if (r > maxR) maxR = r;
      });
    });
    growTo(maxC, maxR);
    persist(true);
    renderPage();
  }
  function fill(dir) {
    if (!canEdit()) return;
    var b = rangeBox(), sh = sheet();
    if (dir === 'down') {
      if (b.r2 === b.r1) return;
      for (var c = b.c1; c <= b.c2; c++) {
        var src = rawOf(sh, makeAddr(c, b.r1));
        for (var r = b.r1 + 1; r <= b.r2; r++) {
          setRaw(sh, makeAddr(c, r), src.charAt(0) === '=' ? shiftFormula(src, 0, r - b.r1) : src);
        }
      }
    } else {
      if (b.c2 === b.c1) return;
      for (var r2 = b.r1; r2 <= b.r2; r2++) {
        var src2 = rawOf(sh, makeAddr(b.c1, r2));
        for (var c2 = b.c1 + 1; c2 <= b.c2; c2++) {
          setRaw(sh, makeAddr(c2, r2), src2.charAt(0) === '=' ? shiftFormula(src2, c2 - b.c1, 0) : src2);
        }
      }
    }
    scheduleSave();
    paintCells();
  }

  function moveCells(sh, pred, dc, dr) {
    var next = {};
    Object.keys(sh.cells).forEach(function (key) {
      var a = parseAddr(key);
      if (!a) return;
      if (pred(a)) {
        var nc = a.c + dc, nr = a.r + dr;
        if (nc < 0 || nr < 0 || nc >= MAX_COLS || nr >= MAX_ROWS) return;
        next[makeAddr(nc, nr)] = sh.cells[key];
      } else next[key] = sh.cells[key];
    });
    sh.cells = next;
  }

  function onKey(e) {
    if (!document.getElementById('kmSsRoot')) return;
    if (e.target && e.target.closest && e.target.closest('.modal,.modalbox,#kmLoginOverlay')) return;
    var inBar = e.target && e.target.id === 'kmSsBar';
    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) && !inBar && !(editing && e.target.closest('#kmSsGrid'))) return;
    if (e.target && e.target.id === 'kmSsName') return;

    if ((e.ctrlKey || e.metaKey) && !e.altKey) {
      var k = e.key.toLowerCase();
      if (k === 'c') { e.preventDefault(); copyRange(false); return; }
      if (k === 'x') { e.preventDefault(); copyRange(true); return; }
      if (k === 'v') return;
      if (k === 'd') { e.preventDefault(); fill('down'); return; }
      if (k === 'f') { e.preventDefault(); window.kmSsFind(); return; }
      if (e.key === 'Home') { e.preventDefault(); sel = 'A1'; anchor = 'A1'; paintCells(); return; }
      if (e.key === 'ArrowLeft') { e.preventDefault(); jumpEdge('left', e.shiftKey); return; }
      if (e.key === 'ArrowRight') { e.preventDefault(); jumpEdge('right', e.shiftKey); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); jumpEdge('up', e.shiftKey); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); jumpEdge('down', e.shiftKey); return; }
      return;
    }
    if (editing || inBar) return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); moveSel('left', e.shiftKey); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); moveSel('right', e.shiftKey); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); moveSel('up', e.shiftKey); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); moveSel('down', e.shiftKey); }
    else if (e.key === 'Home') { e.preventDefault(); moveSel('home', e.shiftKey); }
    else if (e.key === 'End') { e.preventDefault(); moveSel('end', e.shiftKey); }
    else if (e.key === 'Enter') { e.preventDefault(); startEdit(); }
    else if (e.key === 'F2') { e.preventDefault(); startEdit(); }
    else if (e.key === 'F3') { e.preventDefault(); findNext(); }
    else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); clearRange(); }
    else if (e.key === 'Tab') { e.preventDefault(); moveSel(e.shiftKey ? 'left' : 'right', false); }
    else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (!canEdit()) return;
      e.preventDefault();
      startEdit(e.key);
    }
  }

  document.addEventListener('paste', function (e) {
    if (!document.getElementById('kmSsRoot') || editing) return;
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName) && e.target.id !== 'kmSsBar') return;
    var text = (e.clipboardData && e.clipboardData.getData('text/plain')) || '';
    e.preventDefault();
    if (clip && clip.formula && clip.rows && clip.vis === text) pasteBlock(clip.rows, true, clip.origin);
    else pasteBlock(parseTsv(text), false, null);
  });

  function buildGridHtml(sh) {
    var head = '<th></th>' + Array.from({ length: sh.cols }, function (_, c) {
      var st = 'width:' + colW(sh, c) + 'px;min-width:' + colW(sh, c) + 'px';
      return '<th data-col="' + c + '" style="' + st + '">' + colName(c) + '<i class="kmSsColResizer"></i></th>';
    }).join('');
    var body = '';
    for (var r = 0; r < sh.rows; r++) {
      var tds = '';
      for (var c = 0; c < sh.cols; c++) {
        var st = 'width:' + colW(sh, c) + 'px;min-width:' + colW(sh, c) + 'px';
        tds += '<td data-ref="' + makeAddr(c, r) + '" style="' + st + '"></td>';
      }
      body += '<tr><th data-row="' + r + '">' + (r + 1) + '</th>' + tds + '</tr>';
    }
    return '<table class="kmSsGrid" id="kmSsGrid"><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table>';
  }

  function renderPage(hostEl) {
    injectCss();
    var list = ensure();
    var sh = sheet();
    var host = hostEl || lastHost || document.getElementById('kmLibSectionRoot') || document.getElementById('content');
    if (!host) return;
    lastHost = host;
    cache = {};
    editing = false;
    dragging = false;
    if (!parseAddr(sel) || parseAddr(sel).c >= sh.cols || parseAddr(sel).r >= sh.rows) { sel = 'A1'; anchor = 'A1'; }
    var tabs = list.map(function (s) {
      return '<button type="button" class="kmSsTab' + (s.id === sh.id ? ' sel' : '') + '" data-ssid="' + esc(s.id) + '">' + esc(s.name) + '</button>';
    }).join('');
    host.innerHTML =
      '<div id="kmSsRoot"><div class="card kmSsCard">' +
      '<div class="toolbar">' +
      '<button type="button" onclick="kmReportsBack()">← Վերադարձ</button>' +
      '<button type="button" onclick="kmSsAddSheet()">＋ Աղյուսակ</button>' +
      '<button type="button" onclick="kmSsDuplicateSheet()">Պատճենել թերթը</button>' +
      '<button type="button" onclick="kmSsRenameSheet()">Անվանափոխել</button>' +
      '<button type="button" class="danger" onclick="kmSsDeleteSheet()">Ջնջել աղյուսակը</button>' +
      '<label>Անվանում <input id="kmSsName" type="text" value="' + esc(sh.name) + '" style="width:160px"></label>' +
      '<button type="button" onclick="kmSsInsertCol()">＋ Սյուն այստեղ</button>' +
      '<button type="button" onclick="kmSsInsertRow()">＋ Տող այստեղ</button>' +
      '<button type="button" onclick="kmSsDeleteCol()">− Սյուն</button>' +
      '<button type="button" onclick="kmSsDeleteRow()">− Տող</button>' +
      '<button type="button" onclick="kmSsImportCsv()">Ներմուծել CSV</button>' +
      '<button type="button" onclick="kmSsExportCsv()">CSV</button>' +
      '<button type="button" onclick="kmSsPrint()">Տպել</button>' +
      '<button type="button" onclick="kmSsFind()">Փնտրել</button>' +
      '</div>' +
      '<div class="kmSsQuick">' +
      '<button type="button" onclick="kmSsQuickFn(\'SUM\')">Σ Գումար</button>' +
      '<button type="button" onclick="kmSsQuickFn(\'AVERAGE\')">Միջին</button>' +
      '<button type="button" onclick="kmSsQuickFn(\'MIN\')">Մին</button>' +
      '<button type="button" onclick="kmSsQuickFn(\'MAX\')">Մաքս</button>' +
      '<button type="button" onclick="kmSsQuickFn(\'COUNT\')">Հաշվել</button>' +
      '<button type="button" onclick="kmSsQuickFn(\'SUMIF\')">SUMIF</button>' +
      '<button type="button" onclick="kmSsQuickFn(\'IF\')">IF</button>' +
      '<button type="button" onclick="kmSsFnHelp()">Ֆունկցիաներ</button>' +
      '<button type="button" onclick="kmSsFillDown()">Լրացնել ներքև (Ctrl+D)</button>' +
      '<button type="button" onclick="kmSsFillRight()">Լրացնել աջ</button>' +
      '</div>' +
      '<div class="kmSsFormula"><span class="kmSsAddr" id="kmSsAddr">' + esc(rangeLabel()) + '</span>' +
      '<input id="kmSsBar" class="kmSsBar" spellcheck="false" placeholder="=SUM(A1:A10)"></div>' +
      '<div class="kmSsGridWrap" id="kmSsGridWrap">' + buildGridHtml(sh) + '</div>' +
      '<div class="kmSsStatus" id="kmSsStatus"></div>' +
      '<div class="kmSsTabs">' + tabs + '</div>' +
      '<p class="muted kmSsHint">Excel ֆունկցիաներ՝ մաթեմատիկա, վիճակագրություն, տրամաբանություն, տեքստ, ամսաթիվ, որոնում (VLOOKUP/XLOOKUP), ֆինանսներ, ճարտարագիտություն և տվյալների բազա։ Ինտերնետային ֆունկցիաները չկան։ «Ֆունկցիաներ» կոճակով տես ամբողջ ցանկը։</p>' +
      '</div></div>';

    bindGrid(document.getElementById('kmSsGridWrap'));
    paintCells();

    var nameInp = document.getElementById('kmSsName');
    if (nameInp) {
      nameInp.onchange = function () {
        sh.name = String(nameInp.value || '').trim() || sh.name;
        persist(true);
        renderPage();
      };
    }
    var bar = document.getElementById('kmSsBar');
    if (bar) {
      bar.onkeydown = function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          setRaw(sheet(), sel, bar.value);
          scheduleSave();
          var a = parseAddr(sel);
          if (a && growTo(a.c, a.r)) renderPage();
          else paintCells();
        }
      };
      bar.onchange = function () {
        setRaw(sheet(), sel, bar.value);
        scheduleSave();
        paintCells();
      };
    }
    host.querySelectorAll('.kmSsTab[data-ssid]').forEach(function (btn) {
      btn.onclick = function () {
        activeId = btn.getAttribute('data-ssid');
        sel = 'A1'; anchor = 'A1';
        renderPage();
      };
      btn.ondblclick = function (e) {
        e.stopPropagation();
        activeId = btn.getAttribute('data-ssid');
        window.kmSsRenameSheet();
      };
    });
  }

  function findNext() {
    if (!findQ) return;
    var sh = sheet(), q = findQ.toLocaleLowerCase(), hits = [];
    Object.keys(sh.cells).forEach(function (k) {
      var raw = rawOf(sh, k), vis = computed(sh, k);
      if ((raw && raw.toLocaleLowerCase().indexOf(q) >= 0) || (vis && vis.toLocaleLowerCase().indexOf(q) >= 0)) hits.push(k);
    });
    hits.sort(function (a, b) {
      var A = parseAddr(a), B = parseAddr(b);
      return A.r - B.r || A.c - B.c;
    });
    findHits = hits;
    if (!hits.length) { toast('Ոչինչ չգտնվեց', 'warn'); paintCells(); return; }
    findI = (findI + 1) % hits.length;
    sel = hits[findI]; anchor = sel;
    paintCells();
    var td = document.querySelector('#kmSsGrid td[data-ref="' + sel + '"]');
    if (td) td.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  window.kmSpreadsheetsPage = function (hostEl) {
    document.body.classList.remove('km-boot-idle');
    var root = hostEl || document.getElementById('kmLibSectionRoot') || document.getElementById('content');
    if (!root) return;
    lastHost = root;
    var saved = typeof content !== 'undefined' ? content : null;
    try {
      if (typeof content !== 'undefined') content = root;
      if (typeof page !== 'undefined') page = 'library';
      window.page = 'library';
      window.kmLibSection = 'spreadsheets';
      renderPage(root);
    } finally {
      if (typeof content !== 'undefined') content = saved || document.getElementById('content');
    }
  };
  window.kmSsAddSheet = function () {
    ensure();
    var sh = blankSheet('Աղյուսակ ' + (db.spreadsheets.length + 1));
    db.spreadsheets.push(sh);
    activeId = sh.id; sel = 'A1'; anchor = 'A1';
    persist(true); renderPage(); toast('Նոր աղյուսակ');
  };
  window.kmSsDuplicateSheet = function () {
    var sh = sheet();
    var copy = JSON.parse(JSON.stringify(sh));
    copy.id = uid();
    copy.name = sh.name + ' (պատճեն)';
    db.spreadsheets.push(copy);
    activeId = copy.id;
    persist(true); renderPage(); toast('Թերթը պատճենվեց');
  };
  window.kmSsRenameSheet = function () {
    var sh = sheet();
    var name = prompt('Աղյուսակի անուն', sh.name);
    if (name == null) return;
    sh.name = String(name).trim() || sh.name;
    persist(true); renderPage();
  };
  window.kmSsDeleteSheet = function () {
    ensure();
    if (db.spreadsheets.length <= 1) { toast('Պետք է առնվազն 1 աղյուսակ', 'warn'); return; }
    if (!confirm('Ջնջե՞լ «' + sheet().name + '» աղյուսակը։')) return;
    db.spreadsheets = db.spreadsheets.filter(function (s) { return s.id !== activeId; });
    activeId = db.spreadsheets[0].id;
    persist(true); renderPage();
  };
  window.kmSsAddCol = function () {
    var sh = sheet();
    if (sh.cols >= MAX_COLS) { toast('Առավելագույնը ' + MAX_COLS + ' սյուն', 'warn'); return; }
    sh.cols += 1; persist(true); renderPage();
  };
  window.kmSsAddRow = function () {
    var sh = sheet();
    if (sh.rows >= MAX_ROWS) { toast('Առավելագույնը ' + MAX_ROWS + ' տող', 'warn'); return; }
    sh.rows += 1; persist(true); renderPage();
  };
  window.kmSsInsertCol = function () {
    if (!canEdit()) return;
    var sh = sheet(), at = rangeBox().c1;
    if (sh.cols >= MAX_COLS) { toast('Առավելագույնը ' + MAX_COLS + ' սյուն', 'warn'); return; }
    rewriteSheetRefs(sh, at, 1, 0, 0);
    moveCells(sh, function (a) { return a.c >= at; }, 1, 0);
    sh.cols += 1;
    persist(true); renderPage();
  };
  window.kmSsInsertRow = function () {
    if (!canEdit()) return;
    var sh = sheet(), at = rangeBox().r1;
    if (sh.rows >= MAX_ROWS) { toast('Առավելագույնը ' + MAX_ROWS + ' տող', 'warn'); return; }
    rewriteSheetRefs(sh, 0, 0, at, 1);
    moveCells(sh, function (a) { return a.r >= at; }, 0, 1);
    sh.rows += 1;
    persist(true); renderPage();
  };
  window.kmSsDeleteCol = function () {
    if (!canEdit()) return;
    var sh = sheet(), at = rangeBox().c1;
    if (sh.cols <= 2) { toast('Պետք է առնվազն 2 սյուն', 'warn'); return; }
    Object.keys(sh.cells).forEach(function (k) {
      var a = parseAddr(k);
      if (a && a.c === at) delete sh.cells[k];
    });
    rewriteSheetRefs(sh, at + 1, -1, 0, 0);
    moveCells(sh, function (a) { return a.c > at; }, -1, 0);
    sh.cols -= 1;
    persist(true); renderPage();
  };
  window.kmSsDeleteRow = function () {
    if (!canEdit()) return;
    var sh = sheet(), at = rangeBox().r1;
    if (sh.rows <= 2) { toast('Պետք է առնվազն 2 տող', 'warn'); return; }
    Object.keys(sh.cells).forEach(function (k) {
      var a = parseAddr(k);
      if (a && a.r === at) delete sh.cells[k];
    });
    rewriteSheetRefs(sh, 0, 0, at + 1, -1);
    moveCells(sh, function (a) { return a.r > at; }, 0, -1);
    sh.rows -= 1;
    persist(true); renderPage();
  };
  window.kmSsQuickFn = function (fn) {
    if (!canEdit()) return;
    var b = rangeBox(), sh = sheet();
    var rng = makeAddr(b.c1, b.r1) + ':' + makeAddr(b.c2, b.r2);
    if (fn === 'IF') {
      var v = '=IF(' + makeAddr(b.c1, b.r1) + ',"Այո","Ոչ")';
      var bar = document.getElementById('kmSsBar');
      if (bar) { bar.value = v; bar.focus(); }
      startEdit(v);
      return;
    }
    var tc = b.c1, tr = b.r2 + 1;
    if (b.r1 === b.r2 && b.c2 > b.c1) { tc = b.c2 + 1; tr = b.r1; }
    if (tr >= sh.rows) sh.rows = Math.min(MAX_ROWS, tr + 1);
    if (tc >= sh.cols) sh.cols = Math.min(MAX_COLS, tc + 1);
    var key = makeAddr(tc, tr);
    setRaw(sh, key, '=' + fn + '(' + rng + ')');
    sel = key; anchor = key;
    persist(true); renderPage();
  };
  window.kmSsFillDown = function () { fill('down'); };
  window.kmSsFillRight = function () { fill('right'); };
  window.kmSsFind = function () {
    var q = prompt('Փնտրել', findQ || '');
    if (q == null) return;
    findQ = String(q).trim();
    findI = -1;
    findNext();
  };
  window.kmSsFnHelp = function () {
    var old = document.getElementById('kmSsFnModal');
    if (old) old.remove();
    var cats = [
      ['Մաթեմատիկա', 'SUM SUMIF SUMIFS SUMSQ SUMPRODUCT PRODUCT ABS SIGN SQRT SQRTPI POWER EXP LN LOG LOG10 FACT FACTDOUBLE COMBIN COMBINA PERMUT MULTINOMIAL GCD LCM QUOTIENT MOD MROUND ROUND ROUNDUP ROUNDDOWN INT TRUNC CEILING FLOOR EVEN ODD PI RAND RANDBETWEEN SUBTOTAL AGGREGATE BASE DECIMAL ROMAN ARABIC SERIESSUM'],
      ['Վիճակագրություն', 'AVERAGE AVERAGEIF AVERAGEIFS MIN MAX MINIFS MAXIFS COUNT COUNTA COUNTBLANK COUNTIF COUNTIFS MEDIAN MODE STDEV STDEVP VAR VARP LARGE SMALL RANK PERCENTILE QUARTILE GEOMEAN HARMEAN AVEDEV DEVSQ SKEW KURT CORREL PEARSON COVAR SLOPE INTERCEPT RSQ FORECAST PERCENTRANK FREQUENCY NORMDIST NORMSDIST NORMSINV NORMINV BINOMDIST POISSON EXPONDIST CONFIDENCE'],
      ['Տրամաբանություն', 'IF IFS IFERROR IFNA AND OR XOR NOT TRUE FALSE SWITCH'],
      ['Տեքստ', 'LEFT RIGHT MID LEN TRIM UPPER LOWER PROPER CONCAT CONCATENATE TEXTJOIN SUBSTITUTE REPLACE FIND SEARCH REPT EXACT VALUE TEXT NUMBERVALUE FIXED DOLLAR CHAR CODE UNICHAR UNICODE CLEAN T TEXTBEFORE TEXTAFTER TEXTSPLIT ARRAYTOTEXT VALUETOTEXT'],
      ['Ամսաթիվ', 'TODAY NOW DATE DATEVALUE YEAR MONTH DAY HOUR MINUTE SECOND TIME TIMEVALUE WEEKDAY WEEKNUM ISOWEEKNUM EOMONTH EDATE DATEDIF DAYS DAYS360 YEARFRAC NETWORKDAYS WORKDAY'],
      ['Որոնում', 'VLOOKUP HLOOKUP XLOOKUP LOOKUP INDEX MATCH XMATCH CHOOSE INDIRECT OFFSET ADDRESS ROW COLUMN ROWS COLUMNS UNIQUE SORT FILTER SEQUENCE RANDARRAY TAKE DROP TOCOL TOROW VSTACK HSTACK TRANSPOSE'],
      ['Տեղեկատվություն', 'ISBLANK ISNUMBER ISTEXT ISNONTEXT ISERROR ISERR ISNA ISLOGICAL ISEVEN ISODD ISFORMULA ISREF N TYPE NA ERROR.TYPE FORMULATEXT CELL SHEET SHEETS AREAS'],
      ['Ֆինանսներ', 'PMT FV PV NPV IRR MIRR RATE NPER IPMT PPMT SLN SYD DB DDB EFFECT NOMINAL CUMIPMT CUMPRINC DOLLARDE DOLLARFR'],
      ['Եռանկյունաչափություն', 'SIN COS TAN ASIN ACOS ATAN ATAN2 SINH COSH TANH DEGREES RADIANS'],
      ['Ճարտարագիտություն', 'BIN2DEC DEC2BIN HEX2DEC DEC2HEX OCT2DEC DEC2OCT CONVERT DELTA GESTEP ERF ERFC'],
      ['Տվյալների բազա', 'DSUM DAVERAGE DCOUNT DCOUNTA DMAX DMIN DPRODUCT DGET']
    ];
    var html = cats.map(function (c) {
      var btns = c[1].split(/\s+/).map(function (n) {
        return '<button type="button" data-fn="' + n + '" onclick="kmSsInsertFn(\'' + n + '\')">' + n + '</button>';
      }).join('');
      return '<div class="kmSsFnCat" data-cat="' + c[0] + '"><h4>' + c[0] + '</h4><div class="toolbar" style="margin:0">' + btns + '</div></div>';
    }).join('');
    var wrap = document.createElement('div');
    wrap.id = 'kmSsFnModal';
    wrap.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;z-index:99999;padding:20px';
    wrap.onclick = function (e) { if (e.target === wrap) wrap.remove(); };
    wrap.innerHTML = '<div class="kmSsFnBox">' +
      '<h3>Excel ֆունկցիաներ</h3>' +
      '<p class="muted">Սեղմիր անունը՝ բանաձևում տեղադրելու համար։ Ինտերնետային ֆունկցիաները (WEBSERVICE, STOCKHISTORY, IMAGE, PYTHON, COPILOT, RTD, CUBE…) հասանելի չեն։</p>' +
      '<input id="kmSsFnFilter" class="kmSsFnFilter" type="search" placeholder="Փնտրել ֆունկցիա…" oninput="kmSsFnFilterList(this.value)">' +
      html +
      '<div style="text-align:right;margin-top:16px">' + (typeof window.kmModalBackHtml === 'function' ? window.kmModalBackHtml("document.getElementById('kmSsFnModal')?.remove()") : '<button type="button" class="kmBackBtn" onclick="document.getElementById(\'kmSsFnModal\').remove()">← Վերադարձ</button>') + '</div></div>';
    document.body.appendChild(wrap);
    var inp = document.getElementById('kmSsFnFilter');
    if (inp) inp.focus();
    if (typeof kmApplyLanguage === 'function') kmApplyLanguage();
  };
  window.kmSsFnFilterList = function (q) {
    q = String(q || '').toUpperCase().trim();
    document.querySelectorAll('#kmSsFnModal [data-fn]').forEach(function (b) {
      b.style.display = !q || b.getAttribute('data-fn').toUpperCase().indexOf(q) >= 0 ? '' : 'none';
    });
    document.querySelectorAll('#kmSsFnModal .kmSsFnCat').forEach(function (cat) {
      var any = Array.prototype.some.call(cat.querySelectorAll('[data-fn]'), function (b) { return b.style.display !== 'none'; });
      cat.style.display = any ? '' : 'none';
    });
  };
  window.kmSsInsertFn = function (name) {
    var m = document.getElementById('kmSsFnModal');
    if (m) m.remove();
    var bar = document.getElementById('kmSsBar');
    var v = '=' + name + '(';
    if (bar) { bar.value = v; bar.focus(); }
    startEdit(v);
  };

  function parseCsv(text) {
    var rows = [], row = [], cur = '', q = false;
    text = String(text || '').replace(/^\ufeff/, '');
    for (var i = 0; i < text.length; i++) {
      var ch = text.charAt(i);
      if (q) {
        if (ch === '"') {
          if (text.charAt(i + 1) === '"') { cur += '"'; i++; }
          else q = false;
        } else cur += ch;
      } else if (ch === '"') q = true;
      else if (ch === ';' || ch === ',') { row.push(cur); cur = ''; }
      else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
      else if (ch !== '\r') cur += ch;
    }
    row.push(cur);
    if (row.some(function (x) { return x !== ''; })) rows.push(row);
    return rows;
  }
  window.kmSsExportCsv = function () {
    var sh = sheet(), u = usedBox(sh), sep = ';', lines = [];
    for (var r = u.r1; r <= u.r2; r++) {
      var row = [];
      for (var c = u.c1; c <= u.c2; c++) {
        var v = computed(sh, makeAddr(c, r));
        if (/[;"\n]/.test(v)) v = '"' + v.replace(/"/g, '""') + '"';
        row.push(v);
      }
      lines.push(row.join(sep));
    }
    var blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (String(sh.name || 'table').replace(/[<>:"/\\|?*]/g, '_') || 'table') + '.csv';
    a.click();
    toast('CSV արտահանված');
  };
  window.kmSsBuildExportMatrix = function () {
    var sh = sheet(), u = usedBox(sh);
    var headers = [];
    var rows = [];
    for (var c = u.c1; c <= u.c2; c++) headers.push(colName(c));
    for (var r = u.r1; r <= u.r2; r++) {
      var row = [];
      for (var c2 = u.c1; c2 <= u.c2; c2++) row.push(computed(sh, makeAddr(c2, r)));
      rows.push(row);
    }
    return { name: String(sh.name || 'table'), headers: headers, rows: rows };
  };
  window.kmSsExportExcel = async function () {
    if (!window.kmNative || !window.kmNative.export || !window.kmNative.export.scheduleExcel) {
      window.kmSsExportCsv();
      return;
    }
    try {
      var mx = window.kmSsBuildExportMatrix();
      toast('Excel արտահանում…');
      var r = await window.kmNative.export.scheduleExcel({
        name: mx.name || 'KM_table',
        outputName: 'KM_' + String(mx.name || 'table').replace(/[<>:"/\\|?*\s]+/g, '_'),
        title: mx.name || 'Աղյուսակ',
        headers: mx.headers,
        rows: mx.rows
      });
      toast('Excel պատրաստ է՝ ' + ((r && r.output) || ''));
      if (r && r.output && window.kmNative.shell && window.kmNative.shell.showItemInFolder) {
        await window.kmNative.shell.showItemInFolder(r.output);
      }
    } catch (e) {
      toast((e && e.message) || 'Excel սխալ', 'error');
    }
  };
  window.kmSsImportCsv = function () {
    var inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.csv,text/csv,text/plain,text/tab-separated-values';
    inp.onchange = function () {
      var f = inp.files && inp.files[0];
      if (!f) return;
      var reader = new FileReader();
      reader.onload = function () {
        var rows = parseCsv(reader.result);
        var sh = sheet();
        sh.cells = {};
        var maxC = 0;
        rows.forEach(function (cols, ri) {
          cols.forEach(function (v, ci) {
            if (v !== '') sh.cells[makeAddr(ci, ri)] = v;
            if (ci + 1 > maxC) maxC = ci + 1;
          });
        });
        sh.cols = Math.min(MAX_COLS, Math.max(DEF_COLS, maxC));
        sh.rows = Math.min(MAX_ROWS, Math.max(DEF_ROWS, rows.length));
        persist(true); renderPage(); toast('CSV ներմուծվեց');
      };
      reader.readAsText(f, 'utf-8');
    };
    inp.click();
  };
  window.kmSsPrint = function () {
    var sh = sheet(), u = usedBox(sh);
    var head = '<th></th>' + Array.from({ length: u.c2 - u.c1 + 1 }, function (_, i) { return '<th>' + colName(u.c1 + i) + '</th>'; }).join('');
    var body = '';
    for (var r = u.r1; r <= u.r2; r++) {
      var tds = '';
      for (var c = u.c1; c <= u.c2; c++) tds += '<td>' + esc(computed(sh, makeAddr(c, r))) + '</td>';
      body += '<tr><th>' + (r + 1) + '</th>' + tds + '</tr>';
    }
    var w = window.open('', '_blank');
    if (!w) { toast('Տպման պատուհանը բացել չհաջողվեց։', 'error'); return; }
    w.document.write('<!doctype html><html lang="hy"><head><meta charset="utf-8"><title>' + esc(sh.name) +
      '</title><style>table{border-collapse:collapse;font:13px Segoe UI,Arial}td,th{border:1px solid #999;padding:4px 8px}th{background:#eee}@media print{h2{margin:0 0 8px}}</style></head><body><h2>' +
      esc(sh.name) + '</h2><table><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table></body></html>');
    w.document.close(); w.focus(); w.print();
  };

  window.tablesPage = function () {
    page = 'spreadsheets';
    window.page = 'spreadsheets';
    if (typeof window.kmSpreadsheetsPage === 'function') window.kmSpreadsheetsPage();
  };

  document.addEventListener('keydown', onKey);

  if (typeof window.normalize === 'function' && !window.normalize.__kmSs) {
    var _n = window.normalize;
    window.normalize = function () {
      _n.apply(this, arguments);
      if (typeof db !== 'undefined' && db && !Array.isArray(db.spreadsheets)) db.spreadsheets = [];
    };
    window.normalize.__kmSs = true;
  }
})();
