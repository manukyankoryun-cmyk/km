const fs=require('fs'); const path=require('path');
const root=process.argv[2];
function snip(s,i,a=30,b=600){return s.slice(Math.max(0,i-a), i+b);}
const files={
  ut: 'app/js/km-unit-tools.js',
  pos: 'app/js/km-positions.js',
  users: 'app/js/km-users-ui.js',
  v3: 'app/js/km-v3-core.js',
  html: 'app/index.html',
  ops: 'app/js/km-ops.js'
};
const S={};
for(const [k,f] of Object.entries(files)){
  const p=path.join(root,f);
  S[k]=fs.existsSync(p)?fs.readFileSync(p,'utf8'):'';
  console.log(k, S[k].length, 'exists', !!S[k]);
}
for (const k of ['kmPositionMakeVacant','kmMakePositionVacant','Դարձնել թափուր','vacant','unitReserve','պահեստազոր','kmRenderAccountingHub','kmUnitOpen','GRANT_MENU','KM_ACCOUNTING_PAGES']) {
  console.log(k, Object.fromEntries(Object.entries(S).map(([n,s])=>[n, s.indexOf(k)])));
}
console.log('\n=== vacant fn ===\n', snip(S.pos, S.pos.indexOf('kmPositionMakeVacant')>=0?S.pos.indexOf('kmPositionMakeVacant'):S.pos.indexOf('MakeVacant'), 20, 900));
console.log('\n=== accounting hub ===\n', snip(S.ut, S.ut.indexOf('kmRenderAccountingHub')>=0?S.ut.indexOf('kmRenderAccountingHub'):S.ops.indexOf('kmRenderAccountingHub'), 20, 1200));
// find hub in all js
const jsDir=path.join(root,'app/js');
for(const f of fs.readdirSync(jsDir).filter(x=>x.endsWith('.js')&&!x.includes('.bak'))){
  const t=fs.readFileSync(path.join(jsDir,f),'utf8');
  if(t.includes('kmRenderAccountingHub')) console.log('hub in', f, t.indexOf('kmRenderAccountingHub'));
  if(t.includes('Պահեստազոր')||t.includes('պահեստազոր')) console.log('reserve word in', f);
}
console.log('\nPAGES keys', (S.ut.match(/^\s+unit\w+:/gm)||[]).slice(0,20));
console.log('GRANT head', snip(S.users, S.users.indexOf('GRANT_MENU'), 0, 800));
