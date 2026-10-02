const fs=require('fs'); const path=require('path');
const root=process.argv[2];
function snip(s,i,a=40,b=700){return s.slice(Math.max(0,i-a), i+b);}
const ut=fs.readFileSync(path.join(root,'app/js/km-unit-tools.js'),'utf8');
const pos=fs.readFileSync(path.join(root,'app/js/km-positions.js'),'utf8');
const v3=fs.readFileSync(path.join(root,'app/js/km-v3-core.js'),'utf8');
const html=fs.readFileSync(path.join(root,'app/index.html'),'utf8');
const users=fs.readFileSync(path.join(root,'app/js/km-users-ui.js'),'utf8');

// kmUnitOpen / open page routing
for (const k of ['window.kmUnitOpen','function kmUnitOpen','kmUnitEnsureStores','persistPersonnelNow','function saveDb','window.save']) {
  console.log(k, 'ut', ut.indexOf(k), 'pos', pos.indexOf(k), 'v3', v3.indexOf(k));
}

let i=ut.indexOf('window.kmUnitOpen');
console.log('\n=== kmUnitOpen ===\n', snip(ut,i,20,900));

i=ut.indexOf('kmUnitEnsureStores');
console.log('\n=== ensureStores ===\n', snip(ut,i,20,1200));

// person name fields
i=pos.indexOf('fatherName');
console.log('fatherName', i);
i=pos.indexOf('patronymic');
console.log('patronymic', i);
i=pos.indexOf('aah');
console.log('aah', i);
for (const k of ['firstName','lastName','middleName','surname','անուն','ազգանուն','հայրանուն','fullName','personName']) {
  console.log(k, 'pos', pos.indexOf(k), 'ut', ut.indexOf(k));
}

// how people names stored
i=pos.indexOf('p.name');
console.log('\npeople name usage', snip(pos, pos.indexOf('function ensurePersonFromName'), 20, 500));

// BUILD_SETUP hooks pattern
const ps1=fs.readFileSync(path.join(root,'BUILD_SETUP.ps1'),'utf8');
console.log('\nBUILD markers', (ps1.match(/KM_[A-Z0-9_]+_V\d+/g)||[]).slice(-15));
console.log('has km-unit-tools copy?', /km-unit-tools/.test(ps1));
console.log('V49', ps1.indexOf('V49'), 'write_integrity', ps1.indexOf('km_write_integrity'));

// openPage defer list already has unitTermWatch - need unitReserve
console.log('html has unitBadDays in defer', /unitBadDays/.test(html));
console.log('KM_ACCOUNTING need unitReserve');

// user fly submenu icons in index - extract km-user-only buttons
i=html.indexOf('km-user-only');
console.log('\nuser-only chunk\n', snip(html, html.indexOf('class="km-user-only"')>=0?html.indexOf('class="km-user-only"'):i, 0, 2000));
