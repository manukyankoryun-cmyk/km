'use strict';
const fs = require('fs');
const path = require('path');
const proj = process.argv[2];
const p = path.join(proj, 'app/js/km-positions.js');
let t = fs.readFileSync(p, 'utf8');
const MARK = 'KM_PROMO_RANK_FROM_CODE_AND_PICK_V2';

// --- 1) Prefer staffing CODE for next rank (19 → մայոր), not person.rank (լեյտենանտ→ավագ լեյտենանտ) ---
const oldMatch = `function kmPromoVacantMatchesNext_V1(rec, wantCode) {
  var next = kmPromoNextRank_V1(kmPromoPersonRank_V1());
  // Fallback: staffing code 19 ⇒ next major even if person rank field empty
  if (!next) {
    var wg = (typeof kmStaffingGradeToken === 'function') ? kmStaffingGradeToken(wantCode) : String(wantCode || '');
    if (String(wg) === '19') next = 'մայոր';
    else if (String(wg) === '18') next = 'կապիտան';
  }
  var postRank = kmPromoNormRank_V1(rec && (rec.rank || rec.rankSlot || ''));
  var isNext = !!(next && postRank && postRank === next);
  var band = kmPromoCodeBand_V1(wantCode);
  var pcNum = parseInt(String((rec && rec.code) || '').replace(/\\s+/g, ''), 10);
  var inBand = !!(band && pcNum && pcNum >= band.min && pcNum <= band.max);
  return !!(isNext || inBand);
}`;

const newMatch = `function kmPromoVacantMatchesNext_V1(rec, wantCode) {
  /* ${MARK}: next rank from staffing CODE first (19→մայոր), person.rank only if code unknown */
  var next = kmPromoNextFromCode_V1(wantCode) || kmPromoNextRank_V1(kmPromoPersonRank_V1());
  var postRank = kmPromoNormRank_V1(rec && (rec.rank || rec.rankSlot || ''));
  var isNext = !!(next && postRank && postRank === next);
  var band = kmPromoCodeBand_V1(wantCode);
  var pcNum = parseInt(String((rec && rec.code) || '').replace(/\\s+/g, ''), 10);
  var inBand = !!(band && pcNum && pcNum >= band.min && pcNum <= band.max);
  return !!(isNext || inBand);
}
function kmPromoNextFromCode_V1(wantCode) {
  var g = (typeof kmStaffingGradeToken === 'function') ? kmStaffingGradeToken(wantCode) : String(wantCode || '').replace(/\\s+/g, '');
  g = String(g || '');
  if (g === '19') return 'մայոր';
  if (g === '18') return 'կապիտան';
  if (g === '17' || g === '16') return 'ավագ լեյտենանտ';
  if (g === '15') return 'լեյտենանտ';
  if (g === '20' || g === '21' || g === '22' || g === '23' || g === '24') return 'փոխգնդապետ';
  return '';
}`;

if (!t.includes('kmPromoVacantMatchesNext_V1')) throw new Error('match helper missing');
if (!t.includes(oldMatch)) {
  // try softer replace of function body start
  const re = /function kmPromoVacantMatchesNext_V1\(rec, wantCode\) \{[\s\S]*?\nfunction kmPromoHintText_V1/;
  if (!re.test(t)) throw new Error('cannot locate match helper for replace');
  t = t.replace(re, newMatch + '\nfunction kmPromoHintText_V1');
} else {
  t = t.replace(oldMatch, newMatch);
}

// Fix hint to use code-first next rank
t = t.replace(
  /function kmPromoHintText_V1\(wantCode\) \{\s*var next = kmPromoNextRank_V1\(kmPromoPersonRank_V1\(\)\) \|\| \(String\(wantCode\) === '19' \? 'մայոր' : 'հաջորդ'\);/,
  `function kmPromoHintText_V1(wantCode) {\n  var next = kmPromoNextFromCode_V1(wantCode) || kmPromoNextRank_V1(kmPromoPersonRank_V1()) || (String(wantCode) === '19' ? 'մայոր' : 'հաջորդ');`
);

// --- 2) Selection: setting corps/unit fires onchange → fillPos → picked=null. Guard it. ---
if (!t.includes('KM_PROMO_PICK_NO_REFILL_V2')) {
  // Add suppress flag near picked declaration in promo modal — find unique nearby
  const pickAnchor = t.indexOf('picked = vis[i] || null;');
  if (pickAnchor < 0) throw new Error('pick handler not found');
  // Replace the whole onclick assignment block's value-setting part
  const oldClick = `picked = vis[i] || null;
          listEl.querySelectorAll('.kmPosPickRow').forEach(function (b) {
            b.style.background = 'transparent';
          });
          btn.style.background = '#d9ebe0';
          if (picked) {
            if (picked._promoCorpsId) corpsSel.value = picked._promoCorpsId;
            if (picked._promoUnitId) unitSel.value = picked._promoUnitId;
          }`;
  const newClick = `picked = vis[i] || null; /* KM_PROMO_PICK_NO_REFILL_V2 */
          listEl.querySelectorAll('.kmPosPickRow').forEach(function (b) {
            b.style.background = 'transparent';
          });
          btn.style.background = '#d9ebe0';
          /* do NOT write corpsSel/unitSel here — onchange would call fillPos and clear picked */`;
  if (!t.includes(oldClick)) {
    // alternate class name kmPosPickRow vs kmPosPickRow
    const old2 = oldClick.replace(/kmPosPickRow/g, 'kmPosPickRow');
    if (t.includes(old2)) t = t.replace(old2, newClick.replace(/kmPosPickRow/g, 'kmPosPickRow'));
    else {
      // dump nearby for debug
      console.log('NEAR', JSON.stringify(t.slice(pickAnchor - 80, pickAnchor + 450)));
      throw new Error('pick onclick block mismatch');
    }
  } else {
    t = t.replace(oldClick, newClick);
  }
}

fs.writeFileSync(p, t);
console.log('nextFromCode', t.includes('kmPromoNextFromCode_V1'));
console.log('matchUsesCodeFirst', t.includes('next rank from staffing CODE first'));
console.log('pickNoRefill', t.includes('KM_PROMO_PICK_NO_REFILL_V2'));
console.log('hintUsesCodeFirst', /kmPromoHintText_V1[\s\S]{0,120}kmPromoNextFromCode_V1/.test(t));
