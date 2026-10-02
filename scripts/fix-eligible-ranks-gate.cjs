'use strict';
const fs = require('fs');
const path = require('path');
const p = path.join(process.argv[2], 'app/js/km-positions.js');
let t = fs.readFileSync(p, 'utf8');
const re = /if \(!eligibleRanks\.length\) \{\s*listEl\.innerHTML = '<p class="muted" style="margin:10px;font-size:13px">' \+\s*\(!staffingCode \? '[^']+' : '[^']+'\) \+ '<\/p>';\s*return;\s*\}/;
if (!re.test(t)) {
  // fallback: line-based replace around the marker
  const i = t.indexOf('if (!eligibleRanks.length)');
  if (i < 0) { console.log('NO_GATE'); process.exit(1); }
  const j = t.indexOf('var cid = String(corpsSel.value', i);
  if (j < 0) { console.log('NO_CID'); process.exit(1); }
  const neu = "if (!staffingCode) {\n        listEl.innerHTML = '<p class=\"muted\" style=\"margin:10px;font-size:13px\">Անձի հաստիքային կոդը բացակայում է։</p>';\n        return;\n      } /* KM_PROMO_SKIP_ELIGIBLE_RANKS_V1 */\n      ";
  t = t.slice(0, i) + neu + t.slice(j);
} else {
  t = t.replace(re, "if (!staffingCode) {\n        listEl.innerHTML = '<p class=\"muted\" style=\"margin:10px;font-size:13px\">Անձի հաստիքային կոդը բացակայում է։</p>';\n        return;\n      } /* KM_PROMO_SKIP_ELIGIBLE_RANKS_V1 */");
}
fs.writeFileSync(p, t);
console.log('ok', t.includes('KM_PROMO_SKIP_ELIGIBLE_RANKS_V1'), !t.includes('if (!eligibleRanks.length)'));
