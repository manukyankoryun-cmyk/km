const fs=require('fs'); const path=require('path');
const root=process.argv[2];
const pos=fs.readFileSync(path.join(root,'app/js/km-positions.js'),'utf8');
const ut=fs.readFileSync(path.join(root,'app/js/km-unit-tools.js'),'utf8');
const ui=fs.existsSync(path.join(root,'app/js/km-users-ui.js'))?fs.readFileSync(path.join(root,'app/js/km-users-ui.js'),'utf8'):'';
function hits(t, names){
  for(const name of names){
    let i=0,c=0;
    while((i=t.indexOf(name,i))>=0 && c<2){
      console.log('\n## '+name+' @'+i);
      console.log(t.slice(i, i+700));
      i+=Math.max(1,name.length); c++;
    }
  }
}
hits(pos, ['openVacantPositionCard','Դարձնել թափուր','դարձնել թափուր','markPositionVacant','clearPositionPerson','clearedAt','vacant: true']);
console.log('\n==== PAGES + open map ====');
const p=ut.indexOf('var PAGES =');
console.log(ut.slice(p,p+900));
const o=ut.indexOf('kmUnitOpen');
console.log(ut.slice(o, o+1500));
console.log('\n==== users ui icons ====');
hits(ui, ['icon','admin','role','nav','menu']);
