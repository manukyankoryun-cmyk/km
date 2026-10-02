'use strict';
function splitAAH(name) {
  const parts = String(name || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  return { lastName: parts[0] || '', firstName: parts[1] || '', patronymic: parts.length > 2 ? parts.slice(2).join(' ') : '' };
}
const db = { unitReserveArchive: [] };
function add(entry) {
  const parts = splitAAH(entry.name);
  const rec = Object.assign({ id: 't' + (db.unitReserveArchive.length + 1), reason: 'vacant', movedAt: new Date().toISOString() }, parts, entry);
  db.unitReserveArchive.unshift(rec);
  return rec;
}
function search(opts) {
  const ln = String(opts.lastName || '').toLocaleLowerCase('hy-AM');
  const fn = String(opts.firstName || '').toLocaleLowerCase('hy-AM');
  const pn = String(opts.patronymic || '').toLocaleLowerCase('hy-AM');
  return db.unitReserveArchive.filter((e) => {
    const last = String(e.lastName || '').toLocaleLowerCase('hy-AM');
    const first = String(e.firstName || '').toLocaleLowerCase('hy-AM');
    const pat = String(e.patronymic || '').toLocaleLowerCase('hy-AM');
    if (ln && last.indexOf(ln) < 0) return false;
    if (fn && first.indexOf(fn) < 0) return false;
    if (pn && pat.indexOf(pn) < 0) return false;
    return true;
  });
}
add({ name: 'Սարգսյան Արամ Վարդանի', rank: 'կապիտան', post: 'հրամանատար', code: '21' });
add({ name: 'Հովհաննիսյան Գևորգ', rank: 'լեյտենանտ', post: 'սպա', code: '19' });
const hit = search({ lastName: 'Սարգսյան', firstName: 'Արամ', patronymic: 'Վարդանի' });
const miss = search({ lastName: 'Ոչոք' });
const ok = hit.length === 1 && miss.length === 0 && hit[0].lastName === 'Սարգսյան';
console.log(JSON.stringify({ ok, hit: hit.length, miss: miss.length, sample: splitAAH('Սարգսյան Արամ Վարդանի') }, null, 2));
process.exit(ok ? 0 : 1);
