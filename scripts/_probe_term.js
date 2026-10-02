const fs=require('fs'); const path=require('path');
const root=process.argv[2];
const t=fs.readFileSync(path.join(root,'app/js/km-unit-tools.js'),'utf8');
const names=['syncTermRanksFromArchive','collectTermArchiveRows','canonExcelRank','nextRankAfter','rankTermYears','extractStaffAppointedAt','parseStaffDate','RANK_LADDER_LOCAL','unitTermWatch'];
for (const n of names) {
  let c=0,i=0; while((i=t.indexOf(n,i))>=0){c++;i+=n.length;}
  console.log(n, c);
}
const a=t.indexOf('function canonExcelRank');
console.log('CANON', t.slice(a, a+450));
const b=t.indexOf('function syncTermRanksFromArchive');
console.log('SYNC db refs', (t.slice(b,b+2800).match(/db\.[A-Za-z]+/g)||[]).slice(0,20));
console.log('fn next', !!t.match(/function nextRankAfter\s*\(/));
console.log('fn years', !!t.match(/function rankTermYears\s*\(/));
console.log('fn addYears', (t.match(/function addYears\w*\s*\(/g)||[]));
console.log('dismiss', (t.match(/function \w*[Dd]ismiss\w*\s*\(/g)||[]).slice(0,8));
console.log('ensure', (t.match(/function kmUnitEnsure\w*\s*\(/g)||[]).slice(0,5));
console.log('collect', !!t.match(/function collectTermArchiveRows\s*\(/));
