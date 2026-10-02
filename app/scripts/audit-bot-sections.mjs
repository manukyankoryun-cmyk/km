#!/usr/bin/env node
/**
 * Audit: CORE files, Help Bot section coverage, BotKnowledge access.
 * Usage: node scripts/audit-bot-sections.mjs
 */
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(__dirname, '..');
const { CORE_FILES } = require(path.join(APP, 'km_guard.js'));
const { createBotKnowledge } = require(path.join(APP, 'km_bot_knowledge.js'));
const { createKmHelpBot } = require(path.join(APP, 'km_help_bot_core.js'));

const NAV_PAGES = [
  'home', 'accounting', 'dutyTypes', 'library', 'unitTools',
  'lawdocs', 'admins', 'users', 'about'
];

const SECTION_QUERIES = [
  { id: 'home', q: 'բացիր հիմնական բաժինը' },
  { id: 'accounting', q: 'բացիր հաշվառում բաժինը' },
  { id: 'people', q: 'բացիր անձնակազմ բաժինը' },
  { id: 'dutyTypes', q: 'բացիր վերակարգերի տեսակներ բաժինը' },
  { id: 'schedule', q: 'բացիր գրաֆիկ բաժինը' },
  { id: 'library', q: 'բացիր գրադարան բաժինը' },
  { id: 'unitTools', q: 'բացիր աշխատանքի գործիքներ բաժինը' },
  { id: 'lawdocs', q: 'բացիր իրավաբանական անկյուն բաժինը' },
  { id: 'admins', q: 'բացիր ադմինիստրատորների վահանակը' },
  { id: 'users', q: 'բացիր օգտատերեր բաժինը' },
  { id: 'about', q: 'բացիր ծրագրի մասին բաժինը' },
  { id: 'positions', q: 'ինչ է պաշտոն բաժինը' },
  { id: 'kb-newton', q: 'ով է նյուտոնը' },
  { id: 'kb-law', q: 'ինչ է օրենքը' }
];

const fail = [];
const warn = [];
let ok = 0;

function pass(msg) {
  ok++;
  console.log('  OK  ' + msg);
}
function bad(msg) {
  fail.push(msg);
  console.log('  FAIL ' + msg);
}
function note(msg) {
  warn.push(msg);
  console.log('  WARN ' + msg);
}

console.log('=== 1. CORE_FILES exist ===');
CORE_FILES.forEach((rel) => {
  const p = path.join(APP, rel);
  if (fs.existsSync(p)) pass(rel);
  else bad('missing CORE ' + rel);
});

console.log('\n=== 2. Extra packaged JS (GUARD would flag if not in CORE) ===');
const extraJs = [];
function walkJs(dir, relBase) {
  let names = [];
  try { names = fs.readdirSync(dir); } catch { return; }
  names.forEach((name) => {
    if (name === 'node_modules' || name === 'scripts' || name.startsWith('.')) return;
    const full = path.join(dir, name);
    const rel = (relBase ? relBase + '/' : '') + name;
    let st;
    try { st = fs.statSync(full); } catch { return; }
    if (st.isDirectory()) walkJs(full, rel);
    else if (/\.(js|mjs|cjs)$/i.test(name) && !CORE_FILES.includes(rel.replace(/\\/g, '/'))) {
      extraJs.push(rel.replace(/\\/g, '/'));
    }
  });
}
walkJs(APP, '');
if (!extraJs.length) pass('no extra root/js modules');
else extraJs.forEach((r) => note('not in CORE_FILES: ' + r));

console.log('\n=== 3. km_help_bot.json topics vs nav ===');
const kb = JSON.parse(fs.readFileSync(path.join(APP, 'data', 'km_help_bot.json'), 'utf8'));
const topics = (kb.topics || kb.entries || []).length
  ? (kb.topics || kb.entries)
  : (Array.isArray(kb) ? kb : []);
const topicList = Array.isArray(kb.topics) ? kb.topics : (kb.knowledge && kb.knowledge.topics) || [];
const allTopics = topicList.length ? topicList : (kb.items || []);
const topicIds = new Set((allTopics.length ? allTopics : Object.values(kb).find(Array.isArray) || []).map((t) => t && t.id).filter(Boolean));
if (!topicIds.size) {
  const raw = JSON.stringify(kb);
  NAV_PAGES.forEach((p) => {
    if (raw.indexOf('"id":  "' + p + '"') >= 0 || raw.indexOf('"id": "' + p + '"') >= 0) topicIds.add(p);
  });
  if (raw.indexOf('"id":  "admins"') >= 0 || raw.indexOf('"id": "admins"') >= 0) topicIds.add('admins');
}
['system_map', 'accounting', 'dutyTypes', 'library', 'unitTools', 'lawdocs', 'admins', 'users', 'about'].forEach((id) => {
  if (topicIds.has(id) || JSON.stringify(kb).includes('"id":  "' + id + '"') || JSON.stringify(kb).includes('"id": "' + id + '"')) {
    pass('topic ' + id);
  } else bad('km_help_bot.json missing topic ' + id);
});

console.log('\n=== 4. Help-bot source maps ===');
const helpJs = fs.readFileSync(path.join(APP, 'js', 'km-help-bot.js'), 'utf8');
const coreJs = fs.readFileSync(path.join(APP, 'km_help_bot_core.js'), 'utf8');
NAV_PAGES.forEach((p) => {
  const inNav = helpJs.includes("page: '" + p + "'") || helpJs.includes('page: "' + p + '"');
  const inAllowed = new RegExp(p + ':\\s*1').test(helpJs);
  if (inNav) pass('NAV/TREE ' + p);
  else bad('NAV/TREE missing ' + p);
  if (inAllowed) pass('allowedPages ' + p);
  else bad('allowedPages missing ' + p);
});
['home', 'admins', 'users', 'unitTools', 'dutyTypes', 'about'].forEach((p) => {
  if (coreJs.includes("page: '" + p + "'")) pass('core SECTION_NAV ' + p);
  else bad('core SECTION_NAV missing ' + p);
});

console.log('\n=== 5. BotKnowledge + HelpBot ask ===');
const userRoot = path.join(process.env.LOCALAPPDATA || '', 'KM', 'UserData');
const dbPath = path.join(userRoot, 'BotKnowledge', 'knowledge.db');
if (!fs.existsSync(dbPath)) {
  bad('knowledge.db missing at ' + dbPath);
} else {
  pass('knowledge.db exists (' + Math.round(fs.statSync(dbPath).size / 1024 / 1024) + ' MB)');
}

const store = createBotKnowledge(userRoot, { log: () => {} });
/* Skip getStatus() — it counts the entire qa.jsonl (~1.5 GB). Probe via search only. */

const bot = createKmHelpBot({ log: () => {} });
bot.setSearchSimple(async (req) => store.searchSimple(String((req && req.query) || '')));

function withTimeout(p, ms, label) {
  return Promise.race([
    p,
    new Promise((_, rej) => setTimeout(() => rej(new Error('timeout ' + ms + 'ms ' + label)), ms))
  ]);
}

for (const item of SECTION_QUERIES) {
  try {
    const pack = await withTimeout(bot.ask(item.q), 45000, item.id);
    const act = (pack && pack.actions || []).find((a) => a && a.page);
    const hasText = !!(pack && pack.text && String(pack.text).trim());
    const navOk = !item.q.startsWith('բացիր') || (act && act.page);
    if (pack && pack.ok && hasText) {
      const extra = act ? ' → ' + act.page : ' src=' + (pack.source || '');
      pass(item.id + extra);
      if (item.q.startsWith('բացիր') && act && act.page !== item.id && !['people', 'schedule', 'positions'].includes(item.id)) {
        note(item.id + ' navigated to ' + act.page);
      }
    } else if (navOk && hasText) {
      pass(item.id + ' text-only');
    } else {
      bad(item.id + ' ask failed ' + JSON.stringify({ ok: pack && pack.ok, src: pack && pack.source, page: act && act.page }));
    }
  } catch (e) {
    bad(item.id + ' exception ' + ((e && e.message) || e));
  }
}

try {
  if (typeof store.closeSqliteForSync === 'function') store.closeSqliteForSync();
} catch (_) {}

console.log('\n=== RESULT ===');
console.log('passed=' + ok + ' failed=' + fail.length + ' warnings=' + warn.length);
if (fail.length) {
  fail.forEach((f) => console.log('  - ' + f));
  process.exit(1);
}
process.exit(0);
