const {chromium}=require(process.env.KM_PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert');
const root=path.resolve(__dirname,'../app');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const styles=[...html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').matchAll(/<style\b[^>]*>[\s\S]*?<\/style>/gi)].map(m=>m[0]).join('');
const harness='<!doctype html><html><head><meta charset="utf-8">'+styles+'</head><body><div class="app"><main class="main"><div class="top"><div id="pageTitle"></div></div><div id="content"></div></main></div><script>var page="lawdocs",content=document.getElementById("content");window.kmUserRole="admin";window.esc=s=>String(s).replace(/[&<>"\x27]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\\\"":"&quot;","\x27":"&#39;"}[c]||c));</script><script src="js/km-library-ui.js"></script><script src="js/km-soldier-rights.js"></script></body></html>';
const server=http.createServer((req,res)=>{if(req.url==='/test'){res.setHeader('Content-Type','text/html;charset=utf-8');return res.end(harness);}const f=path.join(root,decodeURIComponent(req.url.split('?')[0]));try{res.setHeader('Content-Type',f.endsWith('.json')?'application/json':f.endsWith('.js')?'text/javascript':'text/html');res.end(fs.readFileSync(f));}catch{res.statusCode=404;res.end();}});
(async()=>{
await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,executablePath:process.env.KM_TEST_BROWSER||undefined});const page=await browser.newPage({viewport:{width:1280,height:900}});let errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
await page.goto(url+'/test');
await page.evaluate(()=>kmLawDocsPage());assert(await page.locator('.kmLawCard').count()>0);
await page.evaluate(()=>kmLawsConstitutionHub());assert.equal(await page.locator('.kmLawCard').count(),18);
await page.evaluate(()=>kmLegalInlineOpen('labor'));await page.waitForSelector('#kmLegalOutline option:nth-child(3)',{state:'attached'});
assert((await page.locator('#kmLegalOutline').textContent()).toLocaleUpperCase().includes('ՀՈԴՎԱԾ 1.'));assert(!(await page.locator('#kmLegalText').textContent()).includes('&#9878'));
const first=await page.locator('#kmLegalText').textContent();await page.click('#kmLegalNext');assert.notEqual(await page.locator('#kmLegalText').textContent(),first);await page.click('#kmLegalFirst');assert.equal(await page.locator('#kmLegalText').textContent(),first);
await page.locator('#kmLegalSearch').fill('աշխատանքային');await page.waitForTimeout(200);assert(await page.locator('#kmLegalText mark').count()>0);await page.getByRole('button',{name:'Հաջորդ գտածո',exact:true}).click();
await page.locator('#kmLegalOutline').selectOption({index:100});assert.equal(await page.locator('#kmLegalSearch').inputValue(),'');
await page.screenshot({path:path.join(require('os').tmpdir(),'km-legal-desktop.png')});
await page.setViewportSize({width:600,height:850});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(require('os').tmpdir(),'km-legal-narrow.png')});
await page.evaluate(()=>kmLegalInlineOpen('orders_pm'));await page.waitForSelector('.kmLegalActOpen');await page.locator('.kmLegalActOpen').first().click();await page.waitForSelector('#kmLegalText');await page.getByRole('button',{name:'← Վերադարձ',exact:true}).click();await page.waitForSelector('.kmLegalActOpen');
// Source-format view must keep all source table cells and be isolated from app scripts.
await page.evaluate(()=>kmLegalInlineOpen('labor'));await page.waitForSelector('#kmLegalText table');
await page.getByRole('button',{name:'Սկզբնաղբյուրի դասավորությամբ',exact:true}).click();
await page.waitForSelector('.kmLegalSourceDialog iframe');
const frameElement=page.locator('.kmLegalSourceDialog iframe');assert.equal(await frameElement.getAttribute('sandbox'),'');
const sourceFrame=page.frameLocator('.kmLegalSourceDialog iframe');await sourceFrame.locator('table').first().waitFor();
const index=JSON.parse(fs.readFileSync(path.join(root,'data/legal-reader/index.json')));
const labor=JSON.parse(fs.readFileSync(path.join(root,'data/legal-reader',index.records['act/51'].file)));
assert.equal(await sourceFrame.locator('table').count(),labor.verification.tableCount);
assert.equal(await sourceFrame.locator('td,th').count(),labor.verification.cellCount);
assert.equal(await sourceFrame.locator('script,iframe,object,embed').count(),0);
await page.locator('.kmLegalSourceDialog').screenshot({path:path.join(require('os').tmpdir(),'km-source-layout.png')});
await page.locator('.kmLegalSourceDialog').getByRole('button',{name:'Փակել',exact:true}).click();
// Paginated HTML must preserve exact text-node content, including complex table layouts.
for(const [section,id] of [['labor','51'],['admin_offenses','20'],['tax','109017'],['eaeu','159647']]){
 const rec=JSON.parse(fs.readFileSync(path.join(root,'data/legal-reader',index.records['act/'+id].file)));
 await page.evaluate(s=>kmLegalInlineOpen(s),section);await page.waitForSelector('#kmLegalText .kmLegalRichBlock');
 for(const pn of [0,Math.floor(rec.starts.length/2),rec.starts.length-1]){
  await page.locator('#kmLegalJump').fill(String(pn+1));await page.locator('#kmLegalJump').dispatchEvent('change');
  const start=rec.starts[pn],end=rec.starts[pn+1]||rec.text.length;
  const expected=rec.richBlocks.filter(b=>(b.end>start&&b.start<end)||(b.end===b.start&&b.start>=start&&(b.start<end||(pn===rec.starts.length-1&&b.start===end)))).map(b=>rec.text.slice(b.start,b.end)).join('');
  assert.equal(await page.locator('#kmLegalText').textContent(),expected,section+' page '+pn);
 }
}
// Regression: empty official form tables must survive pagination exactly once.
const blankItem=index.items.find(x=>String(x.actId)==='144952');
const blankRec=JSON.parse(fs.readFileSync(path.join(root,'data/legal-reader',index.records['act/144952'].file)));
await page.evaluate(s=>kmLegalInlineOpen(s),blankItem.section);await page.waitForSelector('#kmLegalOrders');await page.evaluate(()=>kmLegalInlineOrder('144952'));await page.waitForSelector('#kmLegalText .kmLegalRichBlock');
let tableCount=0,cellCount=0;
for(let pn=0;pn<blankRec.starts.length;pn++){
 await page.locator('#kmLegalJump').fill(String(pn+1));await page.locator('#kmLegalJump').dispatchEvent('change');
 tableCount+=await page.locator('#kmLegalText table').count();cellCount+=await page.locator('#kmLegalText td,#kmLegalText th').count();
}
assert.equal(tableCount,blankRec.verification.tableCount);assert.equal(cellCount,blankRec.verification.cellCount);
// Rapid navigation must not let an in-flight reader overwrite a different page.
await page.evaluate(()=>{kmLegalInlineOpen('tax');kmLawDocsPage();});await page.waitForTimeout(200);assert.equal(await page.locator('#kmLegalText').count(),0);
await page.evaluate(()=>kmLegalInlineOpen('eaeu'));await page.waitForSelector('#kmLegalOutline option:nth-child(3)',{state:'attached'});await page.click('#kmLegalLast');assert(await page.locator('#kmLegalNext').isDisabled());
const sections=['constitution','electoral','admin_offenses','civil','land','water','family','labor','forest','subsoil','admin_proc','tax','eaeu','judicial','civil_proc','criminal','crim_proc','penitentiary','statute_internal','statute_garrison','statute_discipline','statute_drill','rights_education'];
for(const section of sections){await page.evaluate(s=>kmLegalInlineOpen(s),section);await page.waitForSelector('#kmLegalText p');assert((await page.locator('#kmLegalText').textContent()).trim().length>0,section);}
for(const section of ['orders_president','orders_pm','orders_mod','orders_cgs','orders_mp','orders_gdnd','military_acts','directives']){await page.evaluate(s=>kmLegalInlineOpen(s),section);await page.waitForSelector('#kmLegalOrders');assert((await page.locator('#kmLegalOrderCount').textContent()).includes('ակտ'));}
await page.evaluate(()=>kmSoldierRightsHub());await page.waitForSelector('.kmSrShell');
assert(!requests.some(u=>u.includes('km_arlis_military_catalog')));assert.equal(errors.length,0,errors.join('\n'));
console.log(JSON.stringify({passed:true,networkRequests:requests.length,errors,screenshots:[path.join(require('os').tmpdir(),'km-legal-desktop.png'),path.join(require('os').tmpdir(),'km-legal-narrow.png')]}));
await browser.close();server.close();
})().catch(e=>{console.error(e);server.close();process.exit(1)});
