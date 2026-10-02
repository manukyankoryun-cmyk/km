const fs=require('fs'); const path=require('path');
const root=process.argv[2];
function snip(s,i,a=50,b=800){return s.slice(Math.max(0,i-a), i+b);}
const html=fs.readFileSync(path.join(root,'app/index.html'),'utf8');
const v3=fs.readFileSync(path.join(root,'app/js/km-v3-core.js'),'utf8');
const users=fs.readFileSync(path.join(root,'app/js/km-users-ui.js'),'utf8');

for (const k of ['kmNavCardIcon','kmNavCard','NAV_ICONS','pageIcons','data-page','rebuildNav','paintNav','kmApplyRole','role-grants','km-role']) {
  console.log('html',k, html.indexOf(k), 'v3', v3.indexOf(k));
}

// extract km-nav-card-style
let i=html.indexOf('id="km-nav-card-style"');
console.log('\n=== nav-card-style ===\n', snip(html,i,0,2500));

i=html.indexOf('id="km-nav-role-fix"');
console.log('\n=== nav-role-fix ===\n', snip(html,i,0,2000));

// how nav items get icons - search in index.html scripts
i=html.indexOf('kmNavCardIcon');
console.log('\n=== first kmNavCardIcon usage ===\n', snip(html,i,200,600));

// find buildSideMenu or similar
for (const k of ['function buildSide','function paintSide','kmNavCardText','navIcons','ICON_BY_PAGE','pageToIcon']) {
  console.log(k, 'html', html.indexOf(k), 'v3', v3.indexOf(k), 'users', users.indexOf(k));
}

// look at how grants filter side menu
i=v3.indexOf('km-role-grants-locked');
console.log('\n=== grants locked ===\n', snip(v3,i,100,1500));

// ACCOUNTING_PAGES and openPage registration for unit tools
i=v3.indexOf('ACCOUNTING_PAGES');
console.log('\n=== ACCOUNTING_PAGES ===\n', snip(v3,i,20,600));
