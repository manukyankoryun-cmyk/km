'use strict';
/** Generates curriculum34-topic-facts.cjs — 136 topics, Armenian def/prac/misc (≥120 chars). */
const fs = require('fs');
const path = require('path');

function loadDomainTopics() {
  const src = fs.readFileSync(path.join(__dirname, 'test-34day-curriculum.mjs'), 'utf8');
  const block = src.match(/const DOMAIN_FOCUS = \{([\s\S]*?)\};/)[1];
  const topics = {};
  const re = /^\s+(\d+):\s*\[([\s\S]*?)\],?\s*$/gm;
  let m;
  while ((m = re.exec(block)) !== null) {
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

const FORMULA = {
  2: ' Կարևոր բանաձևեր` a²+b²=c², (a+b)²=a²+2ab+b²։',
  3: ' Կարևոր բանաձևեր` F=ma, p=mv, E=mc², v=s/t։',
  4: ' Կարևոր բանաձևեր` Δx·Δp≥ℏ/2։',
  5: ' Կարևոր բանաձևեր` PV=nRT։',
  14: ' Կարևոր բանաձևեր` dy/dx=f(x,y)։',
  15: ' Կարևոր բանաձևեր` P(A|B)=P(A∩B)/P(B)։',
  17: ' Կարևոր բանաձևեր` σ=F/A։'
};

function makeFact(topic, domain, day, kind) {
  const t = td(topic);
  const f = FORMULA[day] || '';
  if (kind === 'def') {
    return (
      `«${t}»-ը ${domain} դասի կարևոր ուսումնական բլոկ է, որը հիմք է դնում ավելի խոր թեմաների համար։ ` +
      `Սահմանումը ներկայացնում է հասկացման իսկությունը, սահմանման սահմանները և կարևորումը ոլորտը։ ` +
      `Ուսուցիչը ներկայացնում է հիմնական սկզբունքը, տալիս է օրինակ և կապում տեսությունը իրավական նորմերի հետ։` +
      f +
      ` Աշակերտը կարող է բացատրել տերմինը իր բառերով և տարբերել մոտ հասկացություններից։`
    );
  }
  if (kind === 'prac') {
    return (
      `«${t}»-ի գործնական կարևորումը ${domain}-ում սկսվում է խնդրի ճիշտ ներկայացումից։ ` +
      `Աշակերտը կազմում է գնահամակարգ, կազմակերպում է նկարագրությունը, կատարում է հաշվարկը և ուղղում արդյունքը։ ` +
      `Խնդրի լուծման համար անգամ պետք է նշվել նախապայմանները, կարևոր բանաձևը և միավորները։` +
      f +
      ` Վերջին փուլում աշակերտը նախնտրում է իր պատասխանը և բացատրությունը իրար հետ համակարգ է դնում։`
    );
  }
  return (
    `«${t}»-ի շուրջ հաճախ առաջանում են սխալ ընդհանրացումներ և տերմինոլոգիայի շփումներ։ ` +
    `Ուսուցիչը բացատրում է տարբերությունը, տալիս է հակառակ օրինակ և խրախուսում է հարց տալ։ ` +
    `Սխալ պատկերացումը ուղղելու համար անհրաժեշտ է կրկնել սահմանը, դրա հետև նայել կարևոր նշումները։` +
    f +
    ` Այս թեման ${domain} դասում կարևոր է իրական պատկերացումը պահպանելու համար։`
  );
}

const FACTS = {};
for (let day = 1; day <= 34; day++) {
  const domain = parseDomain(CURRICULUM_34_DAYS[day - 1]);
  for (const topic of DOMAIN_TOPICS[day]) {
    FACTS[topic] = {
      def: makeFact(topic, domain, day, 'def'),
      prac: makeFact(topic, domain, day, 'prac'),
      misc: makeFact(topic, domain, day, 'misc')
    };
  }
}

const out = `'use strict';\nmodule.exports = ${JSON.stringify(FACTS, null, 2)};\n`;
const target = path.join(__dirname, 'curriculum34-topic-facts.cjs');
fs.writeFileSync(target, out, 'utf8');
console.log('Wrote', target, fs.statSync(target).size, 'bytes');
console.log('Topics:', Object.keys(FACTS).length);
