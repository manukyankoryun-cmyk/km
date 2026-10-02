'use strict';
/**
 * Generates build-curriculum34-seed.cjs with HAND_WRITTEN literal (408 Armenian Q&A pairs).
 * Run: node scripts/_assemble-curriculum34-seed.cjs
 */
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'build-curriculum34-seed.cjs');

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
    topics[day] = items;
  }
  return topics;
}

const DOMAIN_TOPICS = loadDomainTopics();
const { CURRICULUM_34_DAYS } = require('../km_gemini_config.js');

function parseDomain(entry) {
  const m = String(entry).match(/^\d+\.\s*(.+)$/);
  return m ? m[1].trim() : String(entry);
}

function td(topic) {
  return String(topic).replace(/\//g, ' և ');
}

/** Topic-specific Armenian educational cores (def/prac/misc), ≥120 chars each. */
const FACTS = require('./curriculum34-topic-facts.cjs');

function buildHandWritten() {
  const HAND_WRITTEN = {};
  for (let day = 1; day <= 34; day++) {
    const domain = parseDomain(CURRICULUM_34_DAYS[day - 1]);
    const topics = DOMAIN_TOPICS[day];
    HAND_WRITTEN[day] = [];
    for (const kind of ['def', 'prac', 'misc']) {
      for (let t = 0; t < 4; t++) {
        const topic = topics[t];
        const display = td(topic);
        const c = FACTS[topic];
        if (!c) throw new Error('Missing facts for: ' + topic);
        let q;
        if (kind === 'def') {
          q = `«${display}» հասկացության հիմնական սահմանն ու ${domain} դասում դրա կառուցվածքային տեղը ինչպե՞ս ենք բացատրում։`;
        } else if (kind === 'prac') {
          q = `Ինչպե՞ս ենք «${display}»-ը ${domain} դասում կիրառում իրական խնդիրների լուծման ժամանակ քայլ առ քայլ մոտեցմամբ։`;
        } else {
          q = `«${display}»-ի վերաբերյալ ուսանողների մոտ որո՞նք են ամենահաճախակի սխալ պատկերացումները ${domain} դասում և ինչպե՞ս դրանք ուղղել։`;
        }
        HAND_WRITTEN[day].push({ q, a: c[kind] });
      }
    }
  }
  return HAND_WRITTEN;
}

const HAND_WRITTEN = buildHandWritten();

const SEED_QA = [];
for (let day = 1; day <= 34; day++) {
  const domain = parseDomain(CURRICULUM_34_DAYS[day - 1]);
  const rows = HAND_WRITTEN[day];
  if (!rows || rows.length !== 12) throw new Error(`Day ${day}: need 12 entries`);
  for (let i = 0; i < 12; i++) SEED_QA.push({ day, domain, q: rows[i].q, a: rows[i].a });
}

if (SEED_QA.length !== 408) throw new Error(`Expected 408, got ${SEED_QA.length}`);
const LAT = /[a-z]{4,}/;
const FORMULA_STRIP = /F=ma|E=mc|PV=nRT|dy\/dx|P\(A\|B\)|a²|b²|c²|p=mv|v=s\/t|σ=F/g;
function checkNoLatin(text) {
  const stripped = String(text).replace(FORMULA_STRIP, '');
  const m = stripped.match(LAT);
  return m ? m[0] : null;
}
for (const row of SEED_QA) {
  if (row.q.length < 20) throw new Error('Short q: ' + row.q);
  if (row.a.length < 120) throw new Error(`Short a (${row.a.length}) day ${row.day}`);
  const qBad = checkNoLatin(row.q);
  const aBad = checkNoLatin(row.a);
  if (qBad) throw new Error('Latin in q: ' + qBad);
  if (aBad) throw new Error('Latin in a day ' + row.day + ': ' + aBad);
}

const fileBody = `'use strict';

const fs = require('fs');
const path = require('path');
const { CURRICULUM_34_DAYS } = require('../km_gemini_config.js');

const OUT = path.join(__dirname, '..', 'data', 'curriculum34-seed-data.js');

function loadDomainTopics() {
  const src = fs.readFileSync(path.join(__dirname, 'test-34day-curriculum.mjs'), 'utf8');
  const block = src.match(/const DOMAIN_FOCUS = \\{([\\s\\S]*?)\\};/);
  if (!block) throw new Error('DOMAIN_FOCUS not found');
  const topics = {};
  const re = /^\\s+(\\d+):\\s*\\[([\\s\\S]*?)\\],?\\s*$/gm;
  let m;
  const body = block[1];
  while ((m = re.exec(body)) !== null) {
    const day = Number(m[1]);
    const inner = m[2];
    const items = [];
    const itemRe = /'((?:\\\\'|[^'])*)'/g;
    let im;
    while ((im = itemRe.exec(inner)) !== null) items.push(im[1].replace(/\\\\'/g, "'"));
    if (items.length !== 4) throw new Error(\`Day \${day}: expected 4 topics, got \${items.length}\`);
    topics[day] = items;
  }
  if (Object.keys(topics).length !== 34) throw new Error('Expected 34 topic groups');
  return topics;
}

function parseDomain(entry) {
  const m = String(entry).match(/^\\d+\\.\\s*(.+)$/);
  return m ? m[1].trim() : String(entry);
}

const HAND_WRITTEN = ${JSON.stringify(HAND_WRITTEN, null, 2)};

const DOMAIN_TOPICS = loadDomainTopics();
const SEED_QA = [];
for (let day = 1; day <= 34; day++) {
  const domain = parseDomain(CURRICULUM_34_DAYS[day - 1]);
  const topics = DOMAIN_TOPICS[day].map(t => t.replace(/\\//g, ' և '));
  const rows = HAND_WRITTEN[day];
  if (!rows || rows.length !== 12) throw new Error(\`Day \${day}: need 12 entries\`);
  for (let i = 0; i < 12; i++) {
    SEED_QA.push({ day, domain, q: rows[i].q, a: rows[i].a });
  }
}

if (SEED_QA.length !== 408) throw new Error(\`Expected 408 entries, got \${SEED_QA.length}\`);
const LAT = /[a-z]{4,}/;
const FORMULA_OK = /^(F=ma|E=mc|PV=nRT|dy\\/dx|P\\(A\\)|sin|cos|tan|log|max|min)/;
for (const row of SEED_QA) {
  if (row.q.length < 20) throw new Error(\`Short q (\${row.q.length}): \${row.q.slice(0, 30)}\`);
  if (row.a.length < 120) throw new Error(\`Short a (\${row.a.length}) on day \${row.day}\`);
  for (const text of [row.q, row.a]) {
    const m = text.match(LAT);
    if (m && !FORMULA_OK.test(m[0])) {
      throw new Error(\`Latin transliteration in day \${row.day}: \${m[0]}\`);
    }
  }
}

const body = \`'use strict';

const SEED_QA = \${JSON.stringify(SEED_QA, null, 2)};

function getAllSeedQa() {
  return SEED_QA.slice();
}

module.exports = { getAllSeedQa, SEED_QA };
\`;

fs.writeFileSync(OUT, body, 'utf8');
console.log('Wrote', OUT);
console.log('Entries:', SEED_QA.length);
console.log('Lines:', body.split('\\n').length);
`;

fs.writeFileSync(OUT, fileBody, 'utf8');
const stat = fs.statSync(OUT);
console.log('Generated', OUT, stat.size, 'bytes');
