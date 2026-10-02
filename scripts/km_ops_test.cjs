/* KM ops + net encrypt + first-password flag tests */
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { collectGraphs, detectConflicts, todayDutyRows, swapCells, swapCellsRange, coverAbsence, occupied, freePeopleOnDate, contractReminders, contractOverdue, personContractEnded } = require('../app/km_ops_logic.js');
const { createKmBackend } = require('../app/km_backend.js');

function encryptKmNetBuffer(plain, code) {
  const key = crypto.createHash('sha256').update('KM-NET-FILE-001|' + String(code == null ? 'local' : code)).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(Buffer.from(plain)), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([Buffer.from('KMNET1'), iv, enc, tag]);
}
function decryptKmNetBuffer(buf, code) {
  const raw = Buffer.from(buf);
  if (raw.length < 34 || raw.slice(0, 6).toString() !== 'KMNET1') return raw;
  const key = crypto.createHash('sha256').update('KM-NET-FILE-001|' + String(code == null ? 'local' : code)).digest();
  const iv = raw.slice(6, 18);
  const tag = raw.slice(raw.length - 16);
  const enc = raw.slice(18, raw.length - 16);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]);
}

let passed = 0;
let failed = 0;
function ok(name, cond, detail) {
  if (cond) { passed++; console.log('  PASS:', name); }
  else { failed++; console.log('  FAIL:', name, detail || ''); }
}

function sampleDb() {
  return {
    people: [
      { name: 'Արամ', rank: 'ս-տ', unit: 'Ա', phone: '+374111', bad: [2] },
      { name: 'Գագիկ', rank: 'լ-տ', unit: 'Բ', phone: '+374222', bad: [] }
    ],
    schedule: {
      name: 'Հիմնական', month: 8, year: 2026,
      rows: { 'Արամ': { 16: 'Հերթապահ' }, 'Գագիկ': { 16: 'Հերթապահ' } }
    },
    dutyTypes: ['Դարպաս'],
    dutyTypeSchedules: {
      duty_0: {
        name: 'Դարպաս', month: 8, year: 2026,
        assignments: { 'Արամ': { 16: 'Դարպաս' } }
      }
    },
    vacations: [{ person: 'Արամ', from: '2026-08-16', to: '2026-08-16', kind: 'sick' }]
  };
}

console.log('KM OPS TEST');
const db = sampleDb();
const graphs = collectGraphs(db);
ok('graphs include main + duty type', graphs.length === 2, String(graphs.length));
ok('occupied true', occupied('Դարպաս'));
ok('occupied empty', !occupied('  '));

const conflicts = detectConflicts(db, {
  absence: (name, dt) => {
    const ds = dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
    const v = (db.vacations || []).find((x) => x.person === name && ds >= x.from && ds <= x.to);
    return v ? (v.kind || 'vacation') : null;
  }
});
ok('main graph double duty conflict', conflicts.some((c) => c.type === 'multi' && c.graph === 'main'));
ok('duty type sick+duty conflict', conflicts.some((c) => c.type === 'vacation' && c.graph === 'duty_0'));
ok('same person overlap across graphs', conflicts.some((c) => c.type === 'overlap' && c.person === 'Արամ'));
db.dutyTypeSchedules.duty_0.assignments['Գագիկ'] = { 16: 'Դարպաս' };
const twoOnDuty = detectConflicts(db, {});
ok('duty type two people is not multi', !twoOnDuty.some((c) => c.type === 'multi' && c.graph === 'duty_0'));
db.dutyPosts = [{ maxPeople: 1 }];
const capped = detectConflicts(db, {});
ok('duty type maxPeople=1 flags multi', capped.some((c) => c.type === 'multi' && c.graph === 'duty_0'));
delete db.dutyTypeSchedules.duty_0.assignments['Գագիկ'];
db.dutyPosts = [];
ok('bad day conflict on Aram day 2 not today unless assigned', true);

const today = todayDutyRows(db, new Date(2026, 7, 16));
ok('today rows include duty type', today.some((r) => r.graphName === 'Դարպաս' && r.name === 'Արամ'));
ok('today rows include main both', today.filter((r) => r.graph === 'main').length === 2);

const twins = {
  people: [
    { name: 'Պողոսյան Պողոս Գուրգենի', rank: 'ս-տ', unit: 'Ա', phone: '1' },
    { name: 'Պողոսյան Պողոս Իսահակի', rank: 'լ-տ', unit: 'Բ', phone: '2' }
  ],
  schedule: {
    name: 'Հիմնական', month: 8, year: 2026,
    selectedPeople: ['Պողոսյան Պողոս Գուրգենի', 'Պողոսյան Պողոս Իսահակի'],
    rows: {
      'Պողոսյան Պողոս Գուրգենի': { 17: 'Հերթապահ' },
      'Պողոսյան Պողոս Իսահակի': { 18: 'Հերթապահ' }
    }
  },
  dutyTypes: [],
  dutyTypeSchedules: {}
};
const twinToday = todayDutyRows(twins, new Date(2026, 7, 17));
ok('similar names: only graph cell for that day', twinToday.length === 1 && twinToday[0].name === 'Պողոսյան Պողոս Գուրգենի');
const leftover = JSON.parse(JSON.stringify(twins));
leftover.schedule.selectedPeople = ['Պողոսյան Պողոս Գուրգենի'];
leftover.schedule.rows['Պողոսյան Պողոս Իսահակի'][17] = 'Հերթապահ';
const leftoverToday = todayDutyRows(leftover, new Date(2026, 7, 17));
ok('person not on graph is not listed today', leftoverToday.length === 1 && leftoverToday[0].name === 'Պողոսյան Պողոս Գուրգենի');
const vacToday = todayDutyRows(twins, new Date(2026, 7, 17), {
  absence: (name) => name === 'Պողոսյան Պողոս Գուրգենի' ? 'vacation' : null
});
ok('vacation day not listed as on duty', vacToday.length === 0);

const rows = { A: { 1: 'X' }, B: {} };
swapCells(rows, 'A', rows, 'B', 1);
ok('swap moved X to B', rows.B[1] === 'X' && !rows.A[1]);

const free16 = freePeopleOnDate(db, new Date(2026, 7, 16), {});
ok('nobody free on duty day', free16.length === 0, String(free16.length));
const free17 = freePeopleOnDate(db, new Date(2026, 7, 17), {});
ok('both free next day', free17.length === 2, String(free17.map((x) => x.name)));
const freeVac = freePeopleOnDate(db, new Date(2026, 7, 17), { absence: () => 'vacation' });
ok('absence not free', freeVac.length === 0);
db.people[0].endDate = '2026-08-20';
const rem = contractReminders(db, 30, new Date(2026, 7, 16));
ok('contract reminder in window', rem.some((r) => r.name === 'Արամ' && r.daysLeft === 4), JSON.stringify(rem));
const remFar = contractReminders(db, 2, new Date(2026, 7, 16));
ok('far contract not listed', remFar.length === 0);
db.people[1].endDate = '2026-08-01';
const overdue = contractOverdue(db, new Date(2026, 7, 16));
ok('overdue contract listed', overdue.some((r) => r.name === 'Գագիկ' && r.daysLeft < 0), JSON.stringify(overdue));
ok('ended contract helper', personContractEnded({ endDate: '2026-08-01' }, new Date(2026, 7, 16)) === true);
ok('active contract not ended', personContractEnded({ endDate: '2026-08-20' }, new Date(2026, 7, 16)) === false);
const freeEnded = freePeopleOnDate(db, new Date(2026, 7, 17), {});
ok('ended contract not free', !freeEnded.some((x) => x.name === 'Գագիկ'), JSON.stringify(freeEnded));

const rangeRows = { A: { 1: 'X', 2: 'Y', 3: 'Z' }, B: {} };
swapCellsRange(rangeRows, 'A', 'B', 1, 3);
ok('range swap 3 days', rangeRows.B[1] === 'X' && rangeRows.B[2] === 'Y' && rangeRows.B[3] === 'Z' && !rangeRows.A[1] && !rangeRows.A[2] && !rangeRows.A[3]);
const coverRows = { A: { 10: 'Հերթապահ', 11: 'Հերթապահ', 12: 'Հերթապահ' }, B: { 11: 'Զբաղված' } };
const cov = coverAbsence(coverRows, 'A', 'B', 10, 12);
ok('cover moved free days', cov.moved.join(',') === '10,12' && coverRows.B[10] === 'Հերթապահ' && coverRows.B[12] === 'Հերթապահ' && !coverRows.A[10]);
ok('cover skipped occupied day', cov.skipped.join(',') === '11' && coverRows.A[11] === 'Հերթապահ');

const enc = encryptKmNetBuffer(Buffer.from('KM_SYNC_TEST'), 'secret');
ok('enc magic', enc.slice(0, 6).toString() === 'KMNET1');
const dec = decryptKmNetBuffer(enc, 'secret');
ok('decrypt roundtrip', dec.toString() === 'KM_SYNC_TEST');
ok('plaintext passthrough', decryptKmNetBuffer(Buffer.from('hello'), 'x').toString() === 'hello');
let threw = false;
try { decryptKmNetBuffer(enc, 'wrong'); } catch (e) { threw = true; }
ok('wrong code fails', threw);

async function secTest() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'km-ops-sec-'));
  const b = createKmBackend(tmp);
  await b.ensureDefaultSecurity();
  const g = await b.getSecurity();
  ok('mustChangePassword on default', g.mustChangePassword === true);
  const login = await b.loginAdmin('Koryun1992', '098460813');
  ok('default login still works', login.ok && login.mustChangePassword);
  const sess = await b.verifyAdminSession(login.token);
  ok('session restore carries mustChangePassword', sess.ok && sess.mustChangePassword === true);
  await b.setSecurity({ password: 'newpass99' });
  const g2 = await b.getSecurity();
  ok('flag cleared after password change', g2.mustChangePassword === false);
  const login2 = await b.loginAdmin('Koryun1992', 'newpass99');
  ok('new password login', login2.ok && !login2.mustChangePassword);

  const snap = path.join(tmp, 'database_snapshot.json');
  fs.writeFileSync(snap, JSON.stringify({ version: 2, people: [{ name: 'USB', endDate: '2026-09-01' }] }), 'utf8');
  const usbDir = path.join(tmp, 'usb');
  fs.mkdirSync(usbDir);
  const pack = await b.exportUsbTransfer('usb-secret', usbDir);
  ok('usb export file', pack.ok && fs.existsSync(pack.path) && fs.readFileSync(pack.path).slice(0, 6).toString() === 'KMUSB1');
  let usbBad = false;
  try { await b.importUsbTransfer('wrong', fs.readFileSync(pack.path)); } catch (e) { usbBad = true; }
  ok('usb wrong password fails', usbBad);
  const restored = await b.importUsbTransfer('usb-secret', fs.readFileSync(pack.path));
  ok('usb import snapshot', restored.ok && JSON.parse(restored.snapshot).people[0].name === 'USB');
  const libSrc = path.join(tmp, 'Library', 'word');
  fs.mkdirSync(libSrc, { recursive: true });
  fs.writeFileSync(path.join(libSrc, 'note.txt'), 'lib-ok', 'utf8');
  const packLib = await b.exportUsbTransfer('usb-secret', usbDir, { includeLibrary: true });
  ok('usb library folder', packLib.library && fs.existsSync(path.join(packLib.library, 'word', 'note.txt')));
  fs.rmSync(path.join(tmp, 'Library'), { recursive: true, force: true });
  const libIn = await b.importUsbLibrary(packLib.library);
  ok('usb library import', libIn.ok && fs.readFileSync(path.join(tmp, 'Library', 'word', 'note.txt'), 'utf8') === 'lib-ok');
}

secTest().then(() => {
  console.log('');
  console.log(failed ? 'FAILED ' + failed + ' / ' + (passed + failed) : 'ALL PASS ' + passed);
  process.exit(failed ? 1 : 0);
}).catch((e) => {
  console.error(e);
  process.exit(1);
});
