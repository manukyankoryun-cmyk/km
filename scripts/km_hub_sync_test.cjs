/* Internet hub find + user merge + HMAC hello path. */
'use strict';
const http = require('http');
const crypto = require('crypto');
const usersSync = require('../app/km_app_users_sync.js');
const secrets = require('../app/km_secrets_load.js').loadKmSecrets();

const NET_HMAC_KEY = secrets.NET_HMAC_KEY || secrets.LOCAL_AUTH_SIGNATURE_KEY;
let passed = 0;
let failed = 0;
function ok(name, cond, detail) {
  if (cond) { passed++; console.log('  PASS:', name); }
  else { failed++; console.log('  FAIL:', name, detail == null ? '' : detail); }
}

function sign(method, urlPath, code) {
  const ts = String(Date.now());
  const nonce = crypto.randomBytes(12).toString('hex');
  const payload = [String(method || 'GET').toUpperCase(), String(urlPath || '/'), ts, nonce, String(code || '')].join('\n');
  return {
    'x-km-code': String(code || ''),
    'x-km-ts': ts,
    'x-km-nonce': nonce,
    'x-km-sig': crypto.createHmac('sha256', NET_HMAC_KEY).update(payload).digest('hex')
  };
}

function verify(req, code) {
  const ts = String(req.headers['x-km-ts'] || '');
  const nonce = String(req.headers['x-km-nonce'] || '');
  const sig = String(req.headers['x-km-sig'] || '');
  if (!ts || !nonce || !sig) return false;
  const method = String((req.method || 'GET')).toUpperCase();
  const urlPath = String((req.url || '/').split('?')[0] || '/');
  const payload = [method, urlPath, ts, nonce, String(code || '')].join('\n');
  const expect = crypto.createHmac('sha256', NET_HMAC_KEY).update(payload).digest('hex');
  return expect === sig && String(req.headers['x-km-code'] || '') === String(code || '');
}

function collectHubCandidates(st) {
  st = st || {};
  const seen = Object.create(null);
  const out = [];
  function add(p) {
    if (!p || !p.ip) return;
    const ip = String(p.ip).trim();
    if (!ip || seen[ip]) return;
    seen[ip] = 1;
    if (!p.updateServer && !(st.lastHub && st.lastHub.ip === ip)) return;
    out.push(ip);
  }
  (st.peers || []).forEach((p) => { if (p && p.updateServer && !p.stale) add(p); });
  (st.knownPeers || []).forEach((p) => { if (p && p.updateServer) add(p); });
  if (st.lastHub && st.lastHub.ip) add({ ip: st.lastHub.ip, updateServer: true });
  return out;
}

function request(port, path, headers) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path, method: 'GET', timeout: 2000, headers: headers || {} }, (res) => {
      let buf = '';
      res.on('data', (d) => { buf += d; });
      res.on('end', () => resolve({ status: res.statusCode, body: buf }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

async function run() {
  const code = '424242';
  const server = http.createServer((req, res) => {
    if (!verify(req, code)) {
      res.writeHead(403);
      res.end('forbidden');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, updateServer: true, id: 'hub1', name: 'HUB' }));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  const wrong = await request(port, '/km/hello', sign('GET', '/', code));
  ok('HMAC GET / rejected on /km/hello (old bug)', wrong.status === 403, String(wrong.status));

  const right = await request(port, '/km/hello', sign('GET', '/km/hello', code));
  ok('HMAC GET /km/hello accepted', right.status === 200 && /updateServer/.test(right.body), right.body);

  const noSig = await request(port, '/km/hello', { 'x-km-code': code });
  ok('internet+code without HMAC rejected', noSig.status === 403, String(noSig.status));

  await new Promise((resolve) => server.close(resolve));

  const hubUsers = {
    users: [{ id: 'usr_admin_local', username: 'Koryun', usernameKey: 'koryun', passwordHash: 'h1', salt: 's1', fullName: 'ԿՈՐՅՈՒՆ ՄԱՆՈՒԿՅԱՆ', active: true }],
    admins: [],
    deletedUsers: []
  };
  const clientUsers = {
    users: [{ id: 'usr_internet', username: 'Aram01', usernameKey: 'aram01', passwordHash: 'h2', salt: 's2', fullName: 'ԱՐԱՄ ՍԱՐԳՍՅԱՆ', active: true, createdAt: new Date().toISOString() }],
    admins: [],
    deletedUsers: []
  };
  const merged = usersSync.mergeAppUsersStores(hubUsers, clientUsers);
  ok('merge keeps hub user', merged.users.some((u) => u.username === 'Koryun'), JSON.stringify(merged.users.map((u) => u.username)));
  ok('merge adds internet user', merged.users.some((u) => u.username === 'Aram01'), JSON.stringify(merged.users.map((u) => u.username)));
  ok('merge has 2 users', merged.users.length === 2, String(merged.users.length));

  const emptyPush = usersSync.mergeAppUsersStores(hubUsers, { users: [], admins: [], deletedUsers: [] });
  ok('empty client push does not drop hub user', emptyPush.users.some((u) => u.username === 'Koryun') && emptyPush.users.length === 1);

  ok('candidates ignore non-hub live peer', collectHubCandidates({
    peers: [{ ip: '10.0.0.8', updateServer: false, stale: false }],
    knownPeers: []
  }).length === 0, JSON.stringify(collectHubCandidates({
    peers: [{ ip: '10.0.0.8', updateServer: false, stale: false }],
    knownPeers: []
  })));

  ok('candidates use lastHub', collectHubCandidates({
    peers: [],
    knownPeers: [],
    lastHub: { ip: '203.0.113.10', port: 18094, updateServer: true }
  }).join(',') === '203.0.113.10');

  ok('candidates use known updateServer even if stale live list empty', collectHubCandidates({
    peers: [{ ip: '203.0.113.10', updateServer: true, stale: true }],
    knownPeers: [{ ip: '203.0.113.10', updateServer: true }]
  }).join(',') === '203.0.113.10');

  console.log(failed ? ('FAIL ' + failed + ' / ' + (passed + failed)) : ('OK ' + passed));
  process.exit(failed ? 1 : 0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
