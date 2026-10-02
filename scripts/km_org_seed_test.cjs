/* Org seed + bundled unit_kod adopt into a fresh UserData (Setup-on-new-PC). */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');
const { createKmBackend } = require('../app/km_backend.js');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'km-org-seed-'));
const fakeLocal = path.join(tmp, 'Local');
const liveRoot = path.join(fakeLocal, 'KM', 'UserData');
const liveKod = path.join(liveRoot, 'unit_kod');
const outOrg = path.join(tmp, 'payload-org');
const appSeedJson = path.join(tmp, 'app-km_org_seed.json');
const appKodSeed = path.join(tmp, 'app-unit_kod_seed');
const appArchSeed = path.join(tmp, 'app-unit_archives_seed');
fs.mkdirSync(liveKod, { recursive: true });

let passed = 0;
let failed = 0;
function ok(name, cond, detail) {
  if (cond) { passed++; console.log('  PASS:', name); }
  else { failed++; console.log('  FAIL:', name, detail == null ? '' : detail); }
}

const org = {
  corps: [{ id: 'bk2', name: '2-րդ բանակային կորպուս', kind: 'corps', ord: 2 }],
  units: [
    { id: 'bk2_hq', corpsId: 'bk2', name: 'Կորպուսի շտաբ' },
    { id: 'bk2_u1', corpsId: 'bk2', name: 'ՀՀ ՊՆ 25836 Զորամաս' }
  ]
};
fs.writeFileSync(path.join(liveRoot, 'database_snapshot.json'), JSON.stringify({
  kmOrg: org,
  kmCorpsData: {
    'bk2::bk2_u1': {
      positionArchives: [{
        id: 'arch_test_25836',
        name: 'shtatka_25836.xlsx',
        builtin: false,
        mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        base64: Buffer.from('PK-fake-xlsx').toString('base64'),
        rows: [{ name: 'Փորձ Ա․Ա․', position: 'հրամանատար' }],
        corpsId: 'bk2',
        unitId: 'bk2_u1',
        unitName: 'ՀՀ ՊՆ 25836 Զորամաս',
        corpsName: '2-րդ բանակային կորպուս',
        addedAt: '2026-09-01'
      }]
    }
  }
}), 'utf8');
fs.writeFileSync(path.join(liveKod, 'index.json'), JSON.stringify({
  'bk2::bk2_u1': { file: 'bk2__bk2_u1.txt', name: '1.txt', count: 2 }
}), 'utf8');
fs.writeFileSync(path.join(liveKod, 'bk2__bk2_u1.txt'), 'AAAA1111\nBBBB2222\n', 'utf8');

const stager = path.join(__dirname, 'stage-org-seed.cjs');
const env = Object.assign({}, process.env, {
  LOCALAPPDATA: fakeLocal,
  KM_ORG_SEED_OUT: outOrg,
  KM_ORG_APP_SEED_JSON: appSeedJson,
  KM_ORG_APP_KOD_DIR: appKodSeed,
  KM_ORG_APP_ARCHIVES_DIR: appArchSeed
});
const run = spawnSync(process.execPath, [stager], { cwd: path.join(__dirname, '..'), env, encoding: 'utf8' });
ok('stager exit', run.status === 0, (run.stderr || '') + (run.stdout || ''));
const seedJson = path.join(outOrg, 'km_org_seed.json');
const seedIdx = path.join(outOrg, 'unit_kod', 'index.json');
const packed = (run.status === 0 && fs.existsSync(seedJson)) ? JSON.parse(fs.readFileSync(seedJson, 'utf8')) : { units: [] };
const u25836 = (packed.units || []).find((u) => u.id === 'bk2_u1');
ok('packed renamed unit', !!(u25836 && u25836.name === 'ՀՀ ՊՆ 25836 Զորամաս'), u25836 && u25836.name);
const packedIdx = (run.status === 0 && fs.existsSync(seedIdx)) ? JSON.parse(fs.readFileSync(seedIdx, 'utf8')) : {};
ok('packed kod index', !!(packedIdx['bk2::bk2_u1'] && packedIdx['bk2::bk2_u1'].file === 'bk2__bk2_u1.txt'));
ok('app seed json', fs.existsSync(appSeedJson));
ok('app kod txt', fs.existsSync(path.join(appKodSeed, 'bk2__bk2_u1.txt')));
const packedArchIdx = path.join(outOrg, 'unit_archives', 'index.json');
ok('packed archive index', fs.existsSync(packedArchIdx));
const packedArch = (run.status === 0 && fs.existsSync(packedArchIdx)) ? JSON.parse(fs.readFileSync(packedArchIdx, 'utf8')) : {};
ok('packed archive id', !!(packedArch.arch_test_25836 && packedArch.arch_test_25836.file), JSON.stringify(packedArch));
ok('app archive seed json', fs.existsSync(path.join(appArchSeed, packedArch.arch_test_25836 && packedArch.arch_test_25836.file || 'missing.json')));

const freshRoot = path.join(tmp, 'fresh');
fs.mkdirSync(freshRoot, { recursive: true });
process.env.KM_UNIT_KOD_SEED_DIR = path.join(outOrg, 'unit_kod');
process.env.KM_UNIT_ARCHIVES_SEED_DIR = path.join(outOrg, 'unit_archives');
const b = createKmBackend(freshRoot);

b.writeOrgSeed(packed).then(async () => {
  const s = await b.getOrgSeed();
  ok('getOrgSeed name', !!(s && (s.units || []).some((u) => u.id === 'bk2_u1' && u.name === 'ՀՀ ՊՆ 25836 Զորամաս')), JSON.stringify(s && s.units));
  const list = await b.listUnitKodStatus();
  ok('checkmark key', !!(list && list.map && list.map['bk2::bk2_u1']), JSON.stringify(list && list.map));
  const destIdx = JSON.parse(fs.readFileSync(path.join(freshRoot, 'unit_kod', 'index.json'), 'utf8'));
  ok('adopted index.json', !!destIdx['bk2::bk2_u1']);
  ok('adopted txt', fs.existsSync(path.join(freshRoot, 'unit_kod', 'bk2__bk2_u1.txt')));
  const arch = await b.getOrgArchives();
  const got = (arch && arch.archives || []).find((a) => a && a.id === 'arch_test_25836');
  ok('adopted archive name', !!(got && got.name === 'shtatka_25836.xlsx'), JSON.stringify(got && { name: got.name, unitId: got.unitId }));
  ok('adopted archive rows', !!(got && Array.isArray(got.rows) && got.rows.length === 1));
  ok('adopted archive file', fs.existsSync(path.join(freshRoot, 'unit_archives', packedArch.arch_test_25836 && packedArch.arch_test_25836.file || 'missing.json')));
  console.log(failed ? 'FAIL ' + failed : 'PASS ' + passed);
  process.exit(failed ? 1 : 0);
}).catch((e) => {
  console.error(e);
  process.exit(1);
});
