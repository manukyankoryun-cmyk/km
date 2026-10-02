#!/usr/bin/env node
/* KM_PURGE_SHTATKA_EXCEL_V1 — delete SHTATKA xlsx / Excel archive seeds; never touch unitFormalArchives JSON. */
'use strict';
const fs = require('fs');
const path = require('path');

const MARKER = 'KM_PURGE_SHTATKA_EXCEL_V1';
const SKIP_DIR = /^(node_modules|soldier_rights|zu_statutes|\.git|vendor|_jsc_stage)$/i;
const EXACT_NAMES = new Set([
  'SHTATKA նոր 31.08.2025.xlsx',
  'SHTATKA.xlsx',
  'SHTATKA_nor_31.08.2025.xlsx',
  'arch_1789597925850_1uilt'
]);

function isShtatkaXlsx(name) {
  if (EXACT_NAMES.has(name)) return true;
  if (/^SHTATKA.*\.xlsx$/i.test(name)) return true;
  if (/^arch_1789597925850/i.test(name)) return true;
  if (/shtatka/i.test(name) && /\.xlsx$/i.test(name)) return true;
  return false;
}

function walk(dir, out) {
  let ents;
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
  for (const ent of ents) {
    if (SKIP_DIR.test(ent.name)) continue;
    if (/\.bak/i.test(ent.name)) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, out);
    else if (isShtatkaXlsx(ent.name) || (/shtatka/i.test(ent.name) && /\.(xlsx|xls)$/i.test(ent.name))) {
      out.push(full);
    }
  }
}

function rmQuiet(p) {
  try {
    fs.unlinkSync(p);
    return true;
  } catch (e) {
    console.log('WARN unlink', p, e.message);
    return false;
  }
}

function purgeSeedArchives(root, report) {
  const candidates = [
    path.join(root, 'app', 'data', 'unit_archives_seed'),
    path.join(root, 'data', 'unit_archives_seed'),
    path.join(root, 'payload', 'seed', 'org', 'unit_archives'),
    path.join(root, 'app', 'data', 'unit_archives')
  ];
  for (const d of candidates) {
    if (!fs.existsSync(d)) continue;
    let ents;
    try { ents = fs.readdirSync(d); } catch (e) { continue; }
    for (const name of ents) {
      if (/\.bak/i.test(name)) continue;
      // Only remove Excel-named / SHTATKA archive payloads — keep unitFormal JSON seeds
      if (isShtatkaXlsx(name) || (/shtatka|position.?arch|excel.?arch/i.test(name) && /\.(json|xlsx|xls|b64)$/i.test(name))) {
        const full = path.join(d, name);
        // Never delete km_unit_archive_*.json formal seeds
        if (/km_unit_archive/i.test(name)) continue;
        if (rmQuiet(full)) report.deleted.push(full);
      }
    }
  }
}

function emptyPositionArchivesInSnapshot(snapPath, report) {
  if (!fs.existsSync(snapPath)) return;
  let raw;
  try { raw = fs.readFileSync(snapPath, 'utf8'); } catch (e) { return; }
  let db;
  try { db = JSON.parse(raw); } catch (e) {
    console.log('WARN snapshot not JSON', snapPath);
    return;
  }
  let changed = false;
  if (Array.isArray(db.positionArchives) && db.positionArchives.length) {
    report.emptied.push({ path: snapPath, field: 'positionArchives', before: db.positionArchives.length });
    db.positionArchives = [];
    changed = true;
  }
  if (db.kmCorpsData && typeof db.kmCorpsData === 'object') {
    for (const cid of Object.keys(db.kmCorpsData)) {
      const c = db.kmCorpsData[cid];
      if (c && Array.isArray(c.positionArchives) && c.positionArchives.length) {
        report.emptied.push({ path: snapPath, field: 'kmCorpsData.' + cid + '.positionArchives', before: c.positionArchives.length });
        c.positionArchives = [];
        changed = true;
      }
    }
  }
  // Strip index entries that rehydrate SHTATKA archives
  if (db.archiveIndex && typeof db.archiveIndex === 'object') {
    for (const k of Object.keys(db.archiveIndex)) {
      const v = db.archiveIndex[k];
      const s = JSON.stringify(v || '');
      if (/SHTATKA|shtatka|\.xlsx/i.test(s) || /arch_1789597925850/i.test(s)) {
        delete db.archiveIndex[k];
        report.emptied.push({ path: snapPath, field: 'archiveIndex.' + k });
        changed = true;
      }
    }
  }
  if (changed) {
    fs.writeFileSync(snapPath, JSON.stringify(db, null, 2), 'utf8');
    report.snapshotsPatched.push(snapPath);
  }
}

function main() {
  const roots = process.argv.slice(2);
  if (!roots.length) {
    console.error('usage: node km-purge-shtatka-excel-v1.cjs <ProjectRoot> [UserData] [moreRoots...]');
    process.exit(1);
  }
  const report = { marker: MARKER, at: new Date().toISOString(), deleted: [], emptied: [], snapshotsPatched: [], scanned: [] };
  for (const root of roots) {
    if (!root || !fs.existsSync(root)) {
      console.log('SKIP missing', root);
      continue;
    }
    report.scanned.push(root);
    const hits = [];
    walk(root, hits);
    for (const h of hits) {
      if (rmQuiet(h)) report.deleted.push(h);
    }
    purgeSeedArchives(root, report);

    // UserData unit_archives Excel leftovers
    const ua = path.join(root, 'unit_archives');
    if (fs.existsSync(ua)) {
      const hits2 = [];
      walk(ua, hits2);
      for (const h of hits2) {
        // Only xlsx / SHTATKA-named — keep formal JSON
        if (/km_unit_archive/i.test(path.basename(h))) continue;
        if (rmQuiet(h)) report.deleted.push(h);
      }
    }

    emptyPositionArchivesInSnapshot(path.join(root, 'database_snapshot.json'), report);
    emptyPositionArchivesInSnapshot(path.join(root, 'UserData', 'database_snapshot.json'), report);
    emptyPositionArchivesInSnapshot(path.join(root, 'app', 'data', 'database_snapshot.json'), report);
  }
  const out = path.join(process.cwd(), 'KM_PURGE_SHTATKA_EXCEL_V1_report.json');
  try { fs.writeFileSync(out, JSON.stringify(report, null, 2), 'utf8'); } catch (e) {}
  console.log(MARKER, 'deleted=', report.deleted.length, 'emptied=', report.emptied.length);
  console.log(JSON.stringify(report, null, 2));
}

main();
