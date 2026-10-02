const fs=require('fs');const path=require('path');
const root=process.argv[2];
const ut=fs.readFileSync(path.join(root,'app/js/km-unit-tools.js'),'utf8');
const pos=fs.readFileSync(path.join(root,'app/js/km-positions.js'),'utf8');
const users=fs.readFileSync(path.join(root,'app/js/km-users-ui.js'),'utf8');
const v3=fs.readFileSync(path.join(root,'app/js/km-v3-core.js'),'utf8');
const html=fs.readFileSync(path.join(root,'app/index.html'),'utf8');
const m=ut.match(/unitReserve\s*:\s*'([^']+)'/);
console.log(JSON.stringify({
  pageTitle: m&&m[1],
  hasReserveWord: ut.includes('\u054A\u0561\u0570\u0565\u057D\u057F\u0561\u0566\u0578\u0580'),
  render: ut.includes('kmRenderUnitReserve'),
  add: ut.includes('kmReserveArchiveAdd'),
  search: ut.includes('kmReserveArchiveSearch'),
  store: ut.includes('unitReserveArchive'),
  grant: /id:\s*'unitReserve'/.test(users),
  accounting: v3.includes('unitReserve'),
  htmlDefer: /unitReserve/.test(html),
  vacantHook: pos.includes('kmReserveCopyBeforeVacant'),
  iconCss: html.includes('KM_RESERVE_ARCHIVE_V1') && /km-role-user/.test(html)
},null,2));