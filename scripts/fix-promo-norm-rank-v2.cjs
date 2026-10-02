'use strict';
const fs = require('fs');
const path = require('path');
const p = path.join(process.argv[2], 'app/js/km-positions.js');
let t = fs.readFileSync(p, 'utf8');
const re = /function kmPromoNormRank_V1\(s\) \{[\s\S]*?\nfunction kmPromoNextRank_V1/;
if (!re.test(t)) {
  const i = t.indexOf('function kmPromoNormRank_V1');
  console.log('NEAR', JSON.stringify(t.slice(i, i + 700)));
  throw new Error('norm block not found');
}
const neu =
  "function kmPromoNormRank_V1(s) {\n" +
  "  /* KM_PROMO_NORM_RANK_NO_WORD_BOUNDARY_V2 — JS \\\\b breaks on Armenian (մ-ր never matched) */\n" +
  "  var t = String(s || '').toLowerCase().replace(/և/g, 'եւ').replace(/\\s+/g, ' ').trim();\n" +
  "  if (!t) return '';\n" +
  "  if (t === 'մ-ր' || t === 'մր' || t.indexOf('մայոր') >= 0 || /^մ[\\-.]?ր/.test(t)) return 'մայոր';\n" +
  "  if (t === 'կ-ն' || t === 'կն' || t.indexOf('կապիտան') >= 0 || /^կ[\\-.]?ն/.test(t)) return 'կապիտան';\n" +
  "  if (t.indexOf('փոխգնդապետ') >= 0 || t === 'փ/գ-տ' || t === 'փգտ' || /^փ\\/?գ[\\-.]?տ/.test(t)) return 'փոխգնդապետ';\n" +
  "  if (t === 'գ-տ' || t === 'գտ' || t.indexOf('գնդապետ') >= 0 || /^գ[\\-.]?տ/.test(t)) return 'գնդապետ';\n" +
  "  if (t.indexOf('ավագ լեյտենանտ') >= 0 || t === 'ավ/լ-տ' || /^ավ\\/?լ[\\-.]?տ/.test(t)) return 'ավագ լեյտենանտ';\n" +
  "  if (t === 'լ-տ' || t === 'լտ' || t.indexOf('լեյտենանտ') >= 0 || /^լ[\\-.]?տ/.test(t)) return 'լեյտենանտ';\n" +
  "  return t;\n" +
  "}\n" +
  "function kmPromoNextRank_V1";
t = t.replace(re, neu);
fs.writeFileSync(p, t);
// quick test of the logic inline
function kmPromoNormRank_V1(s) {
  var t = String(s || '').toLowerCase().replace(/և/g, 'եւ').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  if (t === 'մ-ր' || t === 'մր' || t.indexOf('մայոր') >= 0 || /^մ[\-.]?ր/.test(t)) return 'մայոր';
  if (t === 'կ-ն' || t === 'կն' || t.indexOf('կապիտան') >= 0 || /^կ[\-.]?ն/.test(t)) return 'կապիտան';
  return t;
}
console.log(['մ-ր','մր','մայոր','կ-ն'].map(s => s + '=>' + kmPromoNormRank_V1(s)).join(' | '));
console.log('ok', t.includes('KM_PROMO_NORM_RANK_NO_WORD_BOUNDARY_V2'));
