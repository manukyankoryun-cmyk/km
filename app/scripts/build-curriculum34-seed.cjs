'use strict';

const fs = require('fs');
const path = require('path');
const { CURRICULUM_34_DAYS } = require('../km_gemini_config.js');
const { HAND_WRITTEN } = require('./curriculum34-hand-written.cjs');

const OUT = path.join(__dirname, '..', 'data', 'curriculum34-seed-data.js');

function loadDomainTopics() {
  const src = fs.readFileSync(path.join(__dirname, 'test-34day-curriculum.mjs'), 'utf8');
  const block = src.match(/const DOMAIN_FOCUS = \{([\s\S]*?)\};/);
  if (!block) throw new Error('DOMAIN_FOCUS not found');
  const topics = {};
  const re = /^\s+(\d+):\s*\[([\s\S]*?)\],?\s*$/gm;
  let m;
  while ((m = re.exec(block[1])) !== null) {
    const day = Number(m[1]);
    const items = [];
    const itemRe = /'((?:\\'|[^'])*)'/g;
    let im;
    while ((im = itemRe.exec(m[2])) !== null) items.push(im[1].replace(/\\'/g, "'"));
    if (items.length !== 4) throw new Error(`Day ${day}: expected 4 topics, got ${items.length}`);
    topics[day] = items;
  }
  if (Object.keys(topics).length !== 34) throw new Error('Expected 34 topic groups');
  return topics;
}

function parseDomain(entry) {
  const m = String(entry).match(/^\d+\.\s*(.+)$/);
  return m ? m[1].trim() : String(entry);
}

const DOMAIN_TOPICS = loadDomainTopics();
const SEED_QA = [];

for (let day = 1; day <= 34; day++) {
  const domain = parseDomain(CURRICULUM_34_DAYS[day - 1]);
  const rows = HAND_WRITTEN[String(day)];
  if (!rows || rows.length !== 12) throw new Error(`Day ${day}: need 12 entries, got ${rows ? rows.length : 0}`);
  for (let i = 0; i < 12; i++) {
    SEED_QA.push({ day, domain, q: rows[i].q, a: rows[i].a });
  }
}

if (SEED_QA.length !== 408) throw new Error(`Expected 408 entries, got ${SEED_QA.length}`);

const LAT = /[a-z]{4,}/;
const FORMULA_OK = /^(F=ma|E=mc|PV=nRT|dy\/dx|P\(A\)|sin|cos|tan|log|max|min|PTSD)/i;

for (const row of SEED_QA) {
  if (row.q.length < 20) throw new Error(`Short q (${row.q.length}): ${row.q.slice(0, 40)}`);
  if (row.a.length < 120) throw new Error(`Short a (${row.a.length}) on day ${row.day}`);
  for (const text of [row.q, row.a]) {
    const m = text.match(LAT);
    if (m && !FORMULA_OK.test(m[0])) {
      throw new Error(`Latin transliteration in day ${row.day}: ${m[0]}`);
    }
  }
}

const body = `'use strict';

const SEED_QA = ${JSON.stringify(SEED_QA, null, 2)};

function getAllSeedQa() {
  return SEED_QA.slice();
}

module.exports = { getAllSeedQa, SEED_QA };
`;

fs.writeFileSync(OUT, body, 'utf8');
console.log('Wrote', OUT);
console.log('Entries:', SEED_QA.length);
console.log('Lines:', body.split('\n').length);
