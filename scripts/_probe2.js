const fs=require('fs');
const t=fs.readFileSync(require('path').join(process.argv[2],'app/js/km-unit-tools.js'),'utf8');
const names=['canonExcelRank','rankTermYears','nextRankAfter','addYearsIso','isTermDismissed','extractStaffAppointedAt','parseStaffDate','RANK_LADDER_LOCAL','RANK_TERM_YEARS','normRankLocal','kmUnitEnsureStores','uid'];
for (const n of names) {
  const defFn = t.indexOf('function '+n+'(') >= 0;
  const defVar = t.indexOf('var '+n) >= 0 || t.indexOf(n+' =') >= 0;
  console.log(n, 'defFn', defFn, 'uses', t.split(n).length-1);
}
const s=t.indexOf('function syncTermRanksFromArchive');
console.log('---SYNC---');
console.log(t.slice(s, s+1200));
