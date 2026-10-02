const fs=require('fs'); const path=require('path');
const root=process.argv[2];
function snip(s,i,a=80,b=1000){return s.slice(Math.max(0,i-a), i+b);}
const html=fs.readFileSync(path.join(root,'app/index.html'),'utf8');
const v3=fs.readFileSync(path.join(root,'app/js/km-v3-core.js'),'utf8');
const users=fs.readFileSync(path.join(root,'app/js/km-users-ui.js'),'utf8');
const sec=fs.readFileSync(path.join(root,'app/js/km-section-upgrades.js'),'utf8');

// find where kmNavCard HTML is created
let i=html.indexOf('kmNavCardIcon');
let c=0, p=0;
while((p=html.indexOf('kmNavCardIcon',p))>=0 && c<8){
  console.log('html@',p, snip(html,p,60,200).replace(/\n/g,' | '));
  p++; c++;
}
p=0;c=0;
while((p=v3.indexOf('kmNavCard',p))>=0 && c<10){
  console.log('v3@',p, snip(v3,p,40,180).replace(/\n/g,' | '));
  p++; c++;
}

// grants menu rebuild - inject granted pages as nav
for (const k of ['kmRebuildGrantedNav','rebuildGranted','grantedNav','injectGrant','paintGranted','kmSyncSide','kmApplyGrants','applyPageGrants','kmFilterNav','KM_NAV_META','navMeta','pageTitle']) {
  console.log(k, 'v3', v3.indexOf(k), 'users', users.indexOf(k), 'sec', sec.indexOf(k), 'html', html.indexOf(k));
}

// search createElement nav / data-page assignment for grants
i=v3.indexOf('kmSideMenu');
console.log('\n=== kmSideMenu v3 ===\n', snip(v3,i,50,1200));

i=users.indexOf('kmSideMenu');
console.log('\n=== kmSideMenu users ===\n', snip(users,i,50,800));

// section upgrades might restyle
i=sec.indexOf('kmNavCard');
console.log('\n=== sec kmNavCard ===', i, snip(sec, i>=0?i:0, 50, 500));

// look for different icon sets - emoji vs svg for user
for (const k of ['km-role-user','role-user','userIcon','adminIcon','navEmoji','span class=\"ico\"','kmIco']) {
  console.log('k',k,'html',html.indexOf(k),'v3',v3.indexOf(k),'users',users.indexOf(k));
}
