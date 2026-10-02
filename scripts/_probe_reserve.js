const fs=require('fs'); const path=require('path');
const root=process.argv[2];
function snip(s,i,a=200,b=400){return s.slice(Math.max(0,i-a), i+b);}
const ut=fs.readFileSync(path.join(root,'app/js/km-unit-tools.js'),'utf8');
const pos=fs.readFileSync(path.join(root,'app/js/km-positions.js'),'utf8');
const users=fs.readFileSync(path.join(root,'app/js/km-users-ui.js'),'utf8');

// PAGES / tiles
let i=ut.indexOf('unitTermWatch');
console.log('=== near unitTermWatch ===\n', snip(ut,i,500,800));

i=ut.indexOf('kmUtCard');
if(i<0) i=ut.indexOf('kmUtTile');
if(i<0) i=ut.indexOf('data-km-ut-page');
console.log('\n=== tiles marker', i);
console.log(snip(ut, i>=0?i:ut.indexOf('unitBadDays'), 100, 1500));

// GRANT_MENU
i=users.indexOf('GRANT_MENU');
console.log('\n=== GRANT_MENU ===\n', snip(users,i,50,1500));

// side nav in users
for (const k of ['sideNav','kmSide','navIcon','sectionIcon','icon:','emoji','svg','kmNavItem','menuIcon']) {
  let p=0,c=0; while((p=users.indexOf(k,p))>=0 && c<5){ console.log('users',k,p); p++; c++; }
}

// zeroPersonCard
i=pos.indexOf('function zeroPersonCard');
console.log('\n=== zeroPersonCard ===\n', snip(pos,i,20,700));

// markPeopleRemoved
i=pos.indexOf('function markPeopleRemoved');
console.log('\n=== markPeopleRemoved ===\n', snip(pos,i,20,500));

// how unitFormalArchives stored
i=ut.indexOf('unitFormalArchives');
console.log('\n=== unitFormalArchives uses ===');
let p=0,c=0; while((p=ut.indexOf('unitFormalArchives',p))>=0 && c<8){ console.log(p, snip(ut,p,40,120).replace(/\n/g,' ')); p++; c++; }

// renderTerms start for pattern
i=ut.indexOf('function renderTerms');
console.log('\n=== renderTerms head ===\n', snip(ut,i,10,900));
