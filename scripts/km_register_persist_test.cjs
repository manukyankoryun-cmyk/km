/* Register must survive a new backend instance (fresh usersMem) and a stale LAN pull. */
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const os = require('os');
const { createKmBackend } = require('../app/km_backend.js');
const usersSync = require('../app/km_app_users_sync.js');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'km-reg-persist-'));
let passed = 0;
let failed = 0;
function ok(name, cond, detail) {
  if (cond) { passed++; console.log('  PASS:', name); }
  else { failed++; console.log('  FAIL:', name, detail || ''); }
}

const person = {
  givenName: 'Արամ',
  familyName: 'Սարգսյան',
  patronymic: 'Հովհաննեսի'
};

async function run() {
  console.log('KM register persist', tmp);

  const a = createKmBackend(tmp);
  await a.ensureDefaultSecurity();
  const act = await a.activateLicense('AA000010');
  ok('activate', act && act.ok && act.valid);

  const un = 'Aram01';
  const pw = 'Ab123456';
  const reg = await a.registerAppUser({ username: un, password: pw, code: 'AA000011', ...person });
  ok('register ok', !!(reg && reg.ok), JSON.stringify(reg));
  ok('register userId', !!(reg && reg.userId));

  const ens = await a.ensureAppUser(un);
  ok('ensure on disk after register', !!(ens && ens.ok && ens.user && ens.user.hasPassword), JSON.stringify(ens));

  const b = createKmBackend(tmp);
  const ens2 = await b.ensureAppUser(un);
  ok('ensure after new backend (restart)', !!(ens2 && ens2.ok && ens2.user), JSON.stringify(ens2));
  const login = await b.loginAppUser(un, '', pw);
  ok('password login after restart', !!(login && login.ok && login.userId), JSON.stringify(login));

  const emptyIncoming = Buffer.from(JSON.stringify({ users: [], admins: [], deletedUsers: [] }), 'utf8');
  const usersFile = path.join(tmp, 'km_app_users.json');
  const before = await fsp.readFile(usersFile);
  const skip = await usersSync.installAppUsersBuffer(usersFile, emptyIncoming, before);
  ok('lan empty skip', !!(skip && skip.skipped === 'empty-users' && skip.users >= 1), JSON.stringify(skip));
  const ens3 = await createKmBackend(tmp).ensureAppUser(un);
  ok('user still there after empty lan payload', !!(ens3 && ens3.ok), JSON.stringify(ens3));

  const staleSnap = Buffer.from(JSON.stringify({ users: [], admins: [], deletedUsers: [] }), 'utf8');
  const oldIncoming = Buffer.from(JSON.stringify({
    users: [{ id: 'usr_old', username: 'Other1', usernameKey: 'other1', passwordHash: 'x', salt: 'y', active: true }],
    admins: [],
    deletedUsers: []
  }), 'utf8');
  const race = await usersSync.installAppUsersBuffer(usersFile, oldIncoming, staleSnap);
  ok('lan stale-snap merge keeps registered user', !!(race && race.ok && race.users >= 2), JSON.stringify(race));
  const ens4 = await createKmBackend(tmp).ensureAppUser(un);
  ok('user still there after stale lan snapshot', !!(ens4 && ens4.ok && ens4.user && ens4.user.hasPassword), JSON.stringify(ens4));

  const adm = createKmBackend(tmp);
  await adm.ensureDefaultSecurity();
  const admLogin = await adm.loginAdmin('Koryun1992', require('../app/km_secrets_load.js').loadKmSecrets().FACTORY_ADMIN_PW);
  ok('admin login for list', !!(admLogin && admLogin.ok && admLogin.token));
  const listed = await adm.listAppUsers({ adminToken: admLogin.token });
  ok('admin list contains registered user', !!(listed && listed.ok && (listed.users || []).some((u) => u.username === un)), JSON.stringify(listed && listed.users && listed.users.map((u) => u.username)));

  const del = await adm.deleteAppUser({ adminToken: admLogin.token, id: listed.users.find((u) => u.username === un).id });
  ok('admin delete to trash', !!(del && del.ok), JSON.stringify(del));
  const listedDel = await adm.listAppUsers({ adminToken: admLogin.token });
  const trash = (listedDel.deletedUsers || []).find((u) => u.username === un);
  ok('user in deleted list', !!trash, JSON.stringify(listedDel.deletedUsers));
  const purged = await adm.purgeDeletedAppUser({ adminToken: admLogin.token, id: trash.id });
  ok('purge deleted ok', !!(purged && purged.ok), JSON.stringify(purged));
  const listedGone = await adm.listAppUsers({ adminToken: admLogin.token });
  ok('deleted list empty after purge', !!(listedGone && listedGone.ok && !(listedGone.deletedUsers || []).some((u) => u.username === un || u.id === trash.id)), JSON.stringify(listedGone.deletedUsers));
  const stillLive = (listedGone.users || []).some((u) => u.username === un);
  ok('purged user not in live list', !stillLive);

  const resurrect = usersSync.mergeAppUsersStores(
    { users: [], admins: [], deletedUsers: [{ id: trash.id, username: un, usernameKey: un.toLowerCase() }], purgedUsers: [] },
    { users: [], admins: [], deletedUsers: [], purgedUsers: [{ id: trash.id, username: un, usernameKey: un.toLowerCase(), purgedAt: new Date().toISOString() }] }
  );
  ok('merge does not resurrect purged deleted row', !(resurrect.deletedUsers || []).some((u) => u.username === un));

  const eRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'km-reg-lic-only-'));
  const e = createKmBackend(eRoot);
  await e.ensureDefaultSecurity();
  const licOnly = await e.activateLicense('AA000013');
  ok('license-only activate', !!(licOnly && licOnly.ok && licOnly.valid));
  const eAdm = await e.loginAdmin('Koryun1992', require('../app/km_secrets_load.js').loadKmSecrets().FACTORY_ADMIN_PW);
  const eList = await e.listAppUsers({ adminToken: eAdm.token });
  ok('license-only does not create app user', !!(eList && eList.ok && !(eList.users || []).length), JSON.stringify(eList && eList.users));
  try { fs.rmSync(eRoot, { recursive: true, force: true }); } catch {}

  const cRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'km-reg-code-'));
  const c = createKmBackend(cRoot);
  await c.ensureDefaultSecurity();
  const un2 = 'Gayane2';
  const person2 = { givenName: 'Գայանե', familyName: 'Հովհաննիսյան', patronymic: 'Արամի' };
  const reg2 = await c.registerAppUser({ username: un2, password: pw, code: 'AA000012', ...person2 });
  ok('register with one-time code only', !!(reg2 && reg2.ok && reg2.userId), JSON.stringify(reg2));
  const d = createKmBackend(cRoot);
  const login2 = await d.loginAppUser(un2, '', pw);
  ok('login after code-only register + restart', !!(login2 && login2.ok), JSON.stringify(login2));
  const lic = await d.getLicenseStatus();
  ok('code consumed / license valid', !!(lic && lic.valid));
  try { fs.rmSync(cRoot, { recursive: true, force: true }); } catch {}

  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
  console.log('Results:', passed, 'passed,', failed, 'failed');
  process.exit(failed ? 1 : 0);
}

run().catch((e) => { console.error(e); process.exit(2); });
