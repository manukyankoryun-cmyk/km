/**
 * KM auto-plan logic test — 3-day gap, no side-by-side duties
 */
let passed = 0;
let failed = 0;

function ok(name, cond, detail) {
  if (cond) { passed++; console.log('  PASS:', name); }
  else { failed++; console.log('  FAIL:', name, detail || ''); }
}

function kmSchedulePersonKey(p) {
  return String((p && (p.name || p.fullName || p.person)) || '').trim();
}

function kmPersonIsBlocked(p) {
  return !!(p && p.blocked === true);
}

function kmMinDutyGap() { return 3; }

function kmPickPersonForDutyDay(people, day, lastDay, opts) {
  opts = opts || {};
  const nameOf = typeof opts.nameOf === 'function' ? opts.nameOf : kmSchedulePersonKey;
  const unavailable = typeof opts.unavailable === 'function' ? opts.unavailable : () => false;
  const minGap = Number.isFinite(+opts.minGap) ? Math.max(1, +opts.minGap) : kmMinDutyGap();
  const n = Array.isArray(people) ? people.length : 0;
  if (!n) return null;
  const start = ((+day || 1) - 1) % n;
  let best = null, bestLoad = Infinity, bestStep = n;
  for (let step = 0; step < n; step++) {
    const p = people[(start + step) % n];
    if (!p || kmPersonIsBlocked(p)) continue;
    const name = nameOf(p);
    if (!name) continue;
    if (unavailable(p, name, day)) continue;
    if (lastDay[name] != null && lastDay[name] < day && (day - lastDay[name]) < minGap) continue;
    const busy = typeof opts.busyDays === 'function' ? opts.busyDays(name) : null;
    if (Array.isArray(busy) && busy.some(x => x !== day && Math.abs(x - day) < minGap)) continue;
    const load = Array.isArray(busy) ? busy.length : 0;
    if (load < bestLoad || (load === bestLoad && step < bestStep)) {
      best = p; bestLoad = load; bestStep = step;
    }
  }
  return best;
}

function autoPlanSim(people, year, month, opts) {
  opts = opts || {};
  const days = new Date(+year, +month, 0).getDate();
  const rows = {};
  people.forEach(p => { rows[kmSchedulePersonKey(p)] = {}; });
  const isVac = opts.vacation || (() => false);
  const planning = people.filter(p => !kmPersonIsBlocked(p));
  const lastDay = {};
  const unavailable = (p, name, day) => {
    if ((p.bad || []).map(Number).includes(day)) return true;
    return isVac(name, new Date(+year, +month - 1, day, 12, 0, 0));
  };
  const pickOpts = {
    nameOf: kmSchedulePersonKey,
    unavailable,
    busyDays: name => Object.keys(rows[name] || {}).map(Number)
  };
  const minGap = kmMinDutyGap();

  for (let d = 1; d <= days; d++) {
    const avail = planning.filter(p => {
      if (!p || kmPersonIsBlocked(p)) return false;
      const name = kmSchedulePersonKey(p);
      return !!(name && !unavailable(p, name, d));
    });
    if (!avail.length) continue;
    const p = avail[(d - 1) % avail.length];
    const name = kmSchedulePersonKey(p);
    if (lastDay[name] != null && lastDay[name] < d && (d - lastDay[name]) < minGap) continue;
    rows[name][d] = 'duty';
    lastDay[name] = d;
  }

  for (let d = 1; d <= days; d++) {
    if (planning.some(p => rows[kmSchedulePersonKey(p)][d])) continue;
    const chosen = kmPickPersonForDutyDay(planning, d, lastDay, pickOpts);
    if (chosen) {
      const name = kmSchedulePersonKey(chosen);
      rows[name][d] = 'duty';
      lastDay[name] = d;
    }
  }
  return { rows, days };
}

function dutiesFor(rows, name) {
  return Object.keys(rows[name] || {}).map(Number).sort((a, b) => a - b);
}

function minGapOk(days, gap) {
  for (let i = 1; i < days.length; i++) {
    if (days[i] - days[i - 1] < gap) return false;
  }
  return true;
}

function isWeekend(year, month, day) {
  const wd = new Date(+year, +month - 1, day).getDay();
  return wd === 0 || wd === 6;
}

function run() {
  console.log('KM PLAN LOGIC TEST');
  console.log('');

  const people = Array.from({ length: 8 }, (_, i) => ({
    name: 'Person_' + (i + 1),
    bad: []
  }));

  const { rows, days } = autoPlanSim(people, 2026, 8);
  ok('august has 31 days', days === 31);

  const p1 = dutiesFor(rows, 'Person_1');
  const p2 = dutiesFor(rows, 'Person_2');
  ok('person 1 has duties', p1.length > 0, 'got ' + p1.length);
  ok('person 2 has duties', p2.length > 0, 'got ' + p2.length);

  ok('every person respects 3-day gap',
    people.every(p => minGapOk(dutiesFor(rows, p.name), 3)),
    people.map(p => p.name + '=' + dutiesFor(rows, p.name).join(',')).join(' | '));

  const weekendAssigned = [];
  for (let d = 1; d <= days; d++) {
    let who = null;
    for (const name of Object.keys(rows)) {
      if (rows[name][d]) { who = name; break; }
    }
    if (who && isWeekend(2026, 8, d)) weekendAssigned.push(d);
  }
  ok('weekends planned (aug 2026)', weekendAssigned.length >= 8,
    'weekend duty days: ' + weekendAssigned.join(','));

  ok('day 1 is saturday aug 2026', isWeekend(2026, 8, 1));
  ok('saturday day 1 assigned', weekendAssigned.includes(1));
  ok('sunday day 2 assigned', weekendAssigned.includes(2));

  let allDays = 0;
  for (let d = 1; d <= days; d++) {
    const hit = Object.keys(rows).some(n => rows[n][d]);
    if (hit) allDays++;
  }
  ok('every day has one duty', allDays === days, 'covered=' + allDays);

  ok('8 people all get some duty',
    people.every(p => dutiesFor(rows, kmSchedulePersonKey(p)).length > 0));

  const withBad = people.map((p, i) => ({
    ...p,
    bad: i === 0 ? [1] : []
  }));
  const badRes = autoPlanSim(withBad, 2026, 8);
  ok('bad day 1 fallback (not person 1)', !badRes.rows['Person_1'][1]);
  ok('bad day 1 still assigned', Object.keys(badRes.rows).some(n => badRes.rows[n][1]));
  const p2AfterFallback = dutiesFor(badRes.rows, 'Person_2');
  ok('fallback does not plan person 2 side-by-side',
    minGapOk(p2AfterFallback, 3),
    'Person_2 days=' + p2AfterFallback.join(','));
  ok('all people still respect 3-day gap after fallback',
    withBad.every(p => minGapOk(dutiesFor(badRes.rows, p.name), 3)));

  const two = [{ name: 'A', bad: [] }, { name: 'B', bad: [] }];
  const twoRes = autoPlanSim(two, 2026, 8);
  ok('2 people never planned side-by-side',
    minGapOk(dutiesFor(twoRes.rows, 'A'), 3) && minGapOk(dutiesFor(twoRes.rows, 'B'), 3),
    'A=' + dutiesFor(twoRes.rows, 'A').join(',') + ' B=' + dutiesFor(twoRes.rows, 'B').join(','));

  const blocked = people.map((p, i) => ({ ...p, blocked: i === 0 }));
  const blk = autoPlanSim(blocked, 2026, 8);
  ok('blocked person is not planned', dutiesFor(blk.rows, 'Person_1').length === 0);

  const remaining = people.filter(p => p.name !== 'Person_1');
  const rebuilt = autoPlanSim(remaining, 2026, 8);
  ok('vacation person is off the rebuilt graph',
    dutiesFor(rebuilt.rows, 'Person_1').length === 0);
  ok('rebuilt days stay covered without vacation person',
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].every(d => Object.keys(rebuilt.rows).some(n => n !== 'Person_1' && rebuilt.rows[n][d])));
  ok('rebuild after vacation keeps 3-day gap',
    remaining.every(p => minGapOk(dutiesFor(rebuilt.rows, p.name), 3)),
    remaining.map(p => p.name + '=' + dutiesFor(rebuilt.rows, p.name).join(',')).join(' | '));

  const seven = Array.from({ length: 7 }, (_, i) => ({ name: 'Person_' + (i + 1), bad: [] }));
  const hole22 = autoPlanSim(seven, 2026, 8, {
    vacation: (name, date) => name === 'Person_1' && date.getDate() === 22
  });
  const p1h = dutiesFor(hole22.rows, 'Person_1');
  const p2h = dutiesFor(hole22.rows, 'Person_2');
  ok('7-person: person 1 keeps rotation without day 22',
    p1h.includes(1) && p1h.includes(8) && p1h.includes(15) && p1h.includes(29) && !p1h.includes(22),
    'Person_1=' + p1h.join(','));
  ok('7-person: person 2 keeps 23 and does not take 22',
    p2h.includes(23) && !p2h.includes(22),
    'Person_2=' + p2h.join(','));
  ok('7-person: day 22 is assigned to someone else',
    Object.keys(hole22.rows).some(n => n !== 'Person_1' && n !== 'Person_2' && hole22.rows[n][22]),
    Object.keys(hole22.rows).filter(n => hole22.rows[n][22]).join(',') || 'none');
  ok('7-person: no side-by-side after day-22 hole',
    seven.every(p => minGapOk(dutiesFor(hole22.rows, p.name), 3)),
    seven.map(p => p.name + '=' + dutiesFor(hole22.rows, p.name).join(',')).join(' | '));

  const vacMonth = autoPlanSim(seven, 2026, 8, {
    vacation: (name) => name === 'Person_1'
  });
  const vacated = [1, 8, 15, 22, 29];
  const whoTook = vacated.map(d => Object.keys(vacMonth.rows).find(n => vacMonth.rows[n][d]));
  const uniqueTakers = [...new Set(whoTook.filter(Boolean))];
  const availLoads = seven.filter(p => p.name !== 'Person_1').map(p => dutiesFor(vacMonth.rows, p.name).length);
  const loadSpread = Math.max(...availLoads) - Math.min(...availLoads);
  ok('vacation days are not dumped on one person',
    uniqueTakers.length >= 4,
    'takers=' + whoTook.join(','));
  ok('vacation person gets no duty in full-month vacation',
    dutiesFor(vacMonth.rows, 'Person_1').length === 0);
  ok('remaining people share load after vacation',
    loadSpread <= 1,
    'loads=' + availLoads.join(',') + ' spread=' + loadSpread);
  ok('full-month vacation keeps 3-day gap',
    seven.every(p => minGapOk(dutiesFor(vacMonth.rows, p.name), 3)));

  console.log('');
  console.log('Results:', passed, 'passed,', failed, 'failed');
  process.exit(failed > 0 ? 1 : 0);
}

run();
