/* KM v2 features: analytics, conflicts, multi-month, templates, security, exports */
(function(){
  'use strict';

  window.kmUserRole=window.kmUserRole||'viewer';
  if(window.kmRoleUnlocked==null)window.kmRoleUnlocked=false;

  function esc(s){return typeof window.esc==='function'?window.esc(s):String(s??'');}
  function toastMsg(m,t){if(typeof toast==='function')toast(m,t);else alert(m);}
  function canEdit(){return typeof window.kmCanEdit==='function'?window.kmCanEdit():kmUserRole!=='viewer';}
  function auditActor(){
    if(typeof window.kmActorStamp==='function'){
      try{ return window.kmActorStamp(); }catch(eS){}
    }
    var user='',fullName='',userId='';
    try{
      user=String(window.kmAuthUsername||sessionStorage.getItem('km_auth_username')||'').trim();
      fullName=String(window.kmAuthFullName||sessionStorage.getItem('km_auth_full_name')||'').trim();
      userId=String(window.kmAuthUserId||sessionStorage.getItem('km_auth_user_id')||'').trim();
    }catch(eA){}
    return {user:user,fullName:fullName,userId:userId,role:window.kmUserRole||kmUserRole||''};
  }
  function audit(action,detail){
    try{
      if(window.kmNative&&window.kmNative.audit){
        var d=detail;
        if(d!=null&&typeof d!=='string'){try{d=JSON.stringify(d);}catch(eD){d=String(d);}}
        window.kmNative.audit.append(Object.assign({action:action,detail:d||''},auditActor()));
      }
    }catch(e){}
  }

  /* ---- Security gate: km-auth-ui.js (dual login + session restore) ---- */

  /* ---- Conflict detector ---- */
  window.kmDetectConflicts=function(){
    const out=[];
    if(typeof db==='undefined'||!db)return out;
    const s=db.schedule||{};
    const y=+s.year,m=+s.month;
    if(!y||!m)return out;
    const days=new Date(y,m,0).getDate();
    const people=(db.people||[]).filter(p=>!window.kmPersonIsBlocked||!kmPersonIsBlocked(p));
    for(let d=1;d<=days;d++){
      const onDuty=[];
      people.forEach(p=>{
        const v=(s.rows&&s.rows[p.name]&&s.rows[p.name][d])||'';
        if(String(v).trim()==='Հերթապահ')onDuty.push(p.name);
        if(typeof kmPersonAbsence==='function'){
          const k=kmPersonAbsence(p.name,new Date(y,m-1,d,12,0,0));
          if(k&&String(v).trim()==='Հերթապահ'){
            const labels={vacation:'արձակուրդ',sick:'հիվանդություն',trip:'գործուղում',study:'ուսում'};
            out.push({type:'vacation',day:d,person:p.name,msg:`${p.name} — ${labels[k]||k} + հերթապահ (${d})`});
          }
        }else if(typeof isPersonOnVacation==='function'&&isPersonOnVacation(p.name,new Date(y,m-1,d,12,0,0))&&String(v).trim()==='Հերթապահ'){
          out.push({type:'vacation',day:d,person:p.name,msg:`${p.name} — արձակուրդ + հերթապահ (${d})`});
        }
        if((p.bad||[]).map(Number).includes(d)&&String(v).trim()==='Հերթապահ'){
          out.push({type:'badDay',day:d,person:p.name,msg:`${p.name} — անհարմար օր + հերթապահ (${d})`});
        }
      });
      if(onDuty.length>1){
        out.push({type:'multi',day:d,person:onDuty.join(', '),msg:`Մի քանի հերթապահ նույն օրը (${d})`});
      }
    }
    return out;
  };

  window.kmShowConflictBanner=function(){
    const old=document.getElementById('kmConflictBanner');if(old)old.remove();
    const list=kmDetectConflicts();if(!list.length)return;
    const el=document.createElement('div');
    el.id='kmConflictBanner';
    el.className='card';
    el.style.cssText='border-color:#e5bcbc;background:#fbecec;margin-bottom:12px';
    el.innerHTML=`<h3 style="margin:0 0 8px;color:#a43b3b">⚠ ${list.length} խնդիր հայտնաբերվեց</h3><ul style="margin:0;padding-left:18px">${list.slice(0,8).map(x=>`<li>${esc(x.msg)}</li>`).join('')}${list.length>8?`<li>… +${list.length-8} այլ</li>`:''}</ul>
      <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
        <button type="button" onclick="kmAutoFixConflicts()">Ավտոմատ ուղղել</button>
        <button type="button" onclick="analytics()">Մանրամասն</button>
      </div>`;
    const c=document.getElementById('content');
    if(c&&c.firstChild)c.insertBefore(el,c.firstChild);
  };

  /* ---- Analytics ---- */
  window.analytics=function(){
    const conflicts=kmDetectConflicts();
    const s=db.schedule||{};
    const y=+s.year,m=+s.month,days=new Date(y,m,0).getDate()||0;
    function occupied(v){
      const t=String(v==null?'':v).trim();
      return !!t && t!=='—' && t!=='-' && t!=='.';
    }
    const stats={};
    (db.people||[]).forEach(p=>{
      stats[p.name]={duty:0,vac:0,bad:(p.bad||[]).length,blocked:kmPersonIsBlocked&&kmPersonIsBlocked(p)?1:0};
    });
    for(let d=1;d<=days;d++){
      (db.people||[]).forEach(p=>{
        const v=(s.rows&&s.rows[p.name]&&s.rows[p.name][d])||'';
        if(occupied(v))stats[p.name].duty=(stats[p.name].duty||0)+1;
        if(typeof isPersonOnVacation==='function'&&isPersonOnVacation(p.name,new Date(y,m-1,d,12,0,0))){
          stats[p.name].vac=(stats[p.name].vac||0)+1;
        }
      });
    }
    const rows=Object.entries(stats).sort((a,b)=>b[1].duty-a[1].duty);
    const host=document.getElementById('content');
    if(!host)return;
    host.innerHTML=`<div class="card"><h3 class="kmLawsHubTitle" style="margin-top:0">Վիճակագրություն — ${m}/${y}</h3>
      <div class="toolbar" style="margin-bottom:12px"><button type="button" onclick="kmReportsBack()">← Վերադարձ</button></div>
      <div class="stat"><b>${conflicts.length}</b><br><span class="muted">Խնդիրներ</span></div>
      <div class="stat"><b>${(db.people||[]).length}</b><br><span class="muted">Անձինք</span></div>
      <div class="stat"><b>${(db.dutyTypes||[]).length}</b><br><span class="muted">Վերակարգեր</span></div>
      <div class="stat"><b>${(Array.isArray(db.archives)?db.archives:[]).length}</b><br><span class="muted">Արխիվներ</span></div>
    </div>
    <div class="card"><h3>Հերթապահություններ ըստ անձի</h3>
      <div class="gridwrap"><table class="grid"><thead><tr><th>Անձ</th><th>Հերթապահ օրեր</th><th>Արձակուրդ օրեր</th><th>Անհարմար օրեր</th></tr></thead>
      <tbody>${rows.map(([n,v])=>`<tr><td>${esc(n)}</td><td>${v.duty||0}</td><td>${v.vac||0}</td><td>${v.bad||0}</td></tr>`).join('')||'<tr><td colspan="4">Տվյալ չկա</td></tr>'}</tbody></table></div>
    </div>
    ${conflicts.length?`<div class="card"><h3>Խնդիրներ</h3><ul>${conflicts.map(c=>`<li>${esc(c.msg)}</li>`).join('')}</ul></div>`:''}`;
    page='analytics';
    window.page='analytics';
    const pt=document.getElementById('pageTitle');
    if(pt)pt.textContent='Վիճակագրություն';
  };

  /* ---- Multi-month planning ---- */
  window.kmCopyScheduleMonths=async function(count){
    if(!canEdit()){toastMsg('Դիտորդի իրավունքով խմբագրումն արգելված է','error');return;}
    count=Math.max(1,Math.min(6,Number(count)||1));
    db.futureSchedules=Array.isArray(db.futureSchedules)?db.futureSchedules:[];
    let m=+db.schedule.month,y=+db.schedule.year;
    for(let i=0;i<count;i++){
      m++;if(m>12){m=1;y++;}
      const exists=db.futureSchedules.some(x=>+x.month===m&&+x.year===y);
      if(exists)continue;
      db.futureSchedules.push({
        month:m,year:y,
        name:db.schedule.name||'Հիմնական',
        rows:typeof clone==='function'?clone(db.schedule.rows||{}):JSON.parse(JSON.stringify(db.schedule.rows||{})),
        selectedPeople:typeof clone==='function'?clone(db.schedule.selectedPeople||[]):JSON.parse(JSON.stringify(db.schedule.selectedPeople||[])),
        formalGraph:typeof clone==='function'?clone(kmFormalData(db.schedule)):JSON.parse(JSON.stringify(kmFormalData(db.schedule)))
      });
    }
    await save(true);
    audit('multi_month_copy',{count});
    toastMsg(`Պլանը պատճենվեց ${count} ամիս առաջ`);
    kmOpenFutureSchedules();
  };

  window.kmOpenFutureSchedules=function(){
    db.futureSchedules=Array.isArray(db.futureSchedules)?db.futureSchedules:[];
    content.innerHTML=`<div class="card"><div class="toolbar">
      <button type="button" onclick="kmReportsBack()">← Վերադարձ</button>
      <button onclick="kmCopyScheduleMonths(1)">+1 ամիս</button>
      <button onclick="kmCopyScheduleMonths(3)">+3 ամիս</button>
      <button onclick="kmRememberAndOpen({kind:'page',value:'schedule'},()=>{page='schedule';render();})">Ընթացիկ գրաֆիկ</button>
    </div><h3>Ապագա ամիսների պլաններ</h3>
    <div class="gridwrap"><table class="grid"><thead><tr><th>Ամիս/տարի</th><th>Անվանում</th><th>Գործողություն</th></tr></thead>
    <tbody>${db.futureSchedules.map((x,i)=>`<tr><td>${x.month}/${x.year}</td><td>${esc(x.name)}</td>
      <td><button onclick="kmApplyFutureSchedule(${i})">Բացել</button>
      <button class="danger" onclick="kmDeleteFutureSchedule(${i})">Ջնջել</button></td></tr>`).join('')||'<tr><td colspan="3">Դատարկ</td></tr>'}
    </tbody></table></div></div>`;
    page='future';
    document.getElementById('pageTitle').textContent='Ապագա պլաններ';
  };

  window.kmApplyFutureSchedule=async function(i){
    const x=(db.futureSchedules||[])[i];if(!x)return;
    if(!confirm(`Բացե՞լ ${x.month}/${x.year} պլանը որպես ընթացիկ գրաֆիկ`))return;
    archiveCurrentSchedule('Նախքան ապագա պլանի բացում');
    db.schedule.month=x.month;db.schedule.year=x.year;db.schedule.name=x.name;
    db.schedule.rows=typeof clone==='function'?clone(x.rows||{}):JSON.parse(JSON.stringify(x.rows||{}));
    db.schedule.selectedPeople=typeof clone==='function'?clone(x.selectedPeople||[]):JSON.parse(JSON.stringify(x.selectedPeople||[]));
    db.schedule.formalGraph=typeof clone==='function'?clone(x.formalGraph||{}):JSON.parse(JSON.stringify(x.formalGraph||{}));
    await save();page='schedule';render();
  };

  window.kmDeleteFutureSchedule=async function(i){
    db.futureSchedules.splice(i,1);await save(true);kmOpenFutureSchedules();
  };

  /* ---- Excel export ---- */
  window.kmExportScheduleExcel=async function(){
    if(!window.kmNative||!window.kmNative.export){toastMsg('Excel export requires KM desktop app','error');return;}
    const s=db.schedule;const days=new Date(+s.year,+s.month,0).getDate();
    const people=typeof kmMainSelectedPeople==='function'?kmMainSelectedPeople():(db.people||[]);
    const headers=['Կոչում','Անուն',...Array.from({length:days},(_,i)=>String(i+1))];
    const rows=people.map(p=>[
      typeof kmRankText==='function'?kmRankText(p.rank):p.rank,
      p.name,
      ...Array.from({length:days},(_,i)=>((s.rows&&s.rows[p.name])||{})[i+1]||'')
    ]);
    try{
      toastMsg('Excel արտահանում…');
      const r=await window.kmNative.export.scheduleExcel({
        name:s.name||'Schedule',outputName:`KM_${s.year}_${String(s.month).padStart(2,'0')}`,
        headers,rows
      });
      audit('export_excel',{file:r.output});
      toastMsg('Excel պատրաստ է՝ '+r.output);
    }catch(e){toastMsg(e.message||'Excel սխալ','error');}
  };

  /* ---- Batch print ---- */
  window.kmBatchPrintAllGraphs=async function(){
    if(typeof printScheduleTable!=='function'){toastMsg('Print module missing','error');return;}
    const parts=[];
    const s=db.schedule;
    parts.push(`<section class="printSheet" style="page-break-after:always"><h1>${esc(s.name||'Հիմնական')}</h1><p>Գլխավոր գրաֆիկ ${s.month}/${s.year}</p></section>`);
    (db.dutyTypes||[]).forEach((name,i)=>{
      parts.push(`<section class="printSheet" style="page-break-after:always"><h1>${esc(name)}</h1><p>Վերակարգ ${i+1}</p></section>`);
    });
    const html='<!doctype html><html lang="hy"><head><meta charset="utf-8"><style>@page{size:A4 landscape;margin:6mm}body{font-family:serif}.printSheet{padding:8mm}</style></head><body>'+parts.join('')+'</body></html>';
    try{
      if(window.kmNative&&window.kmNative.export&&window.kmNative.export.batchPrintPdf){
        const r=await window.kmNative.export.batchPrintPdf({title:'KM_Batch_Graphs',html,settings:{pageSize:'A4',orientation:'landscape'}});
        if(r.cancelled)return;
        toastMsg('PDF պատրաստ է՝ '+r.path);
      }else{
        printScheduleTable();
      }
    }catch(e){toastMsg(e.message||'Batch print error','error');}
  };

  /* ---- Template library (per graph) ---- */
  window.kmSaveFormalTemplate=async function(){
    const owner=typeof kmCurrentFormalOwner==='function'?kmCurrentFormalOwner():(db.schedule);
    const graphKey=typeof kmFormalGraphKey==='function'?kmFormalGraphKey(owner):'main';
    const graphLabel=typeof kmFormalGraphLabel==='function'?kmFormalGraphLabel(owner):'Հիմնական';
    const name=prompt('Ձևանմուշի անունը\nԳրաֆիկ՝ '+graphLabel);if(!name)return;
    const list=window.kmNative&&window.kmNative.templates?await window.kmNative.templates.get():[];
    list.push({
      name:name.trim(),
      graphKey,
      graphLabel,
      formalGraph:typeof clone==='function'?clone(kmFormalData(owner)):JSON.parse(JSON.stringify(kmFormalData(owner))),
      savedAt:new Date().toISOString()
    });
    if(window.kmNative&&window.kmNative.templates)await window.kmNative.templates.save(list);
    toastMsg('Ձևանմուշը պահպանվեց («'+graphLabel+'»)');
  };

  window.kmLoadFormalTemplate=async function(){
    const owner=typeof kmCurrentFormalOwner==='function'?kmCurrentFormalOwner():(db.schedule);
    const graphKey=typeof kmFormalGraphKey==='function'?kmFormalGraphKey(owner):'main';
    const graphLabel=typeof kmFormalGraphLabel==='function'?kmFormalGraphLabel(owner):'Հիմնական';
    const list=window.kmNative&&window.kmNative.templates?await window.kmNative.templates.get():[];
    const scoped=list.filter(t=>!t.graphKey||t.graphKey===graphKey);
    const pool=scoped.length?scoped:list;
    if(!pool.length){toastMsg('Ձևանմուշներ չկան');return;}
    const opts=pool.map((t,i)=>`${i+1}. ${t.name}${t.graphLabel?' ['+t.graphLabel+']':''}`).join('\n');
    const v=prompt('Ընտրեք ձևանմուշը («'+graphLabel+'»):\n'+opts,'1');
    const i=Number(v)-1;if(!pool[i])return;
    owner.formalGraph=typeof clone==='function'?clone(pool[i].formalGraph):JSON.parse(JSON.stringify(pool[i].formalGraph));
    await save();render();toastMsg('Ձևանմուշը բեռնվեց');
  };

  window.kmOpenTemplateManager=async function(){
    const list=window.kmNative&&window.kmNative.templates?await window.kmNative.templates.get():[];
    const ctx=typeof kmFormalGraphLabel==='function'&&typeof kmCurrentFormalOwner==='function'
      ?kmFormalGraphLabel(kmCurrentFormalOwner()):'Հիմնական';
    content.innerHTML=`<div class="card"><div class="toolbar">
      <button type="button" onclick="kmReportsBack()">← Վերադարձ</button>
      <button onclick="kmSaveFormalTemplate()">Պահպանել ընթացիկ formal block</button>
      <button onclick="kmLoadFormalTemplate()">Բեռնել ձևանմուշ</button>
    </div><h3>Formal block ձևանմուշներ</h3>
    <p class="muted">Ընթացիկ գրաֆիկ՝ <b>${esc(ctx)}</b> · Յուրաքանչյուր գրաֆիկի իր formal block-ը</p>
    <div class="gridwrap"><table class="grid"><thead><tr><th>Անուն</th><th>Գրաֆիկ</th><th>Ամսաթիվ</th></tr></thead>
    <tbody>${list.map(t=>`<tr><td>${esc(t.name)}</td><td>${esc(t.graphLabel||t.graphKey||'main')}</td><td>${esc(t.savedAt||'')}</td></tr>`).join('')||'<tr><td colspan="3">Դատարկ</td></tr>'}</tbody></table></div></div>`;
    page='formalTemplates';
    document.getElementById('pageTitle').textContent='Formal ձևանմուշ';
  };

  /* ---- Backup & audit UI ---- */
  window.kmRunBackupNow=async function(){
    if(typeof window.kmCanAdmin==='function'&&!window.kmCanAdmin()){toastMsg('Միայն ադմինիստրատոր','error');return;}
    if(!window.kmNative||!window.kmNative.backup)return;
    await save(true);
    const r=await window.kmNative.backup.run('manual');
    toastMsg('Պահուստը պատրաստ է՝ '+r.folder);
  };

  window.kmOpenBackupManager=async function(){
    if(typeof window.kmCanAdmin==='function'&&!window.kmCanAdmin()){toastMsg('Միայն ադմինիստրատոր','error');return;}
    if(!window.kmNative||!window.kmNative.backup){toastMsg('UserData պահուստը հասանելի է desktop KM-ում');return;}
    const list=await window.kmNative.backup.list();
    content.innerHTML=`<div class="card"><div class="toolbar">
      <button onclick="kmRunBackupNow()">Այժմ պահուստ</button>
      <button type="button" onclick="(typeof kmArchiveHubPage==='function'?kmArchiveHubPage:kmReportsBack)()">← Վերադարձ</button>
    </div><h3>UserData պահուստներ</h3>
    <table class="grid"><thead><tr><th>Պանակ</th><th>Ամսաթիվ</th><th>Պիտակ</th><th></th></tr></thead>
    <tbody>${list.map((b,i)=>`<tr><td>${esc(b.name)}</td><td>${esc(b.createdAt||'')}</td><td>${esc(b.label||'')}</td>
      <td><button type="button" data-km-backup="${i}">Վերականգնել</button></td></tr>`).join('')||'<tr><td colspan="4">Պահուստ չկա</td></tr>'}</tbody></table></div>`;
    content.querySelectorAll('[data-km-backup]').forEach(btn=>{
      btn.onclick=()=>kmRestoreBackup(list[+btn.dataset.kmBackup]?.name);
    });
  };

  window.kmRestoreBackup=async function(name){
    if(typeof window.kmCanAdmin==='function'&&!window.kmCanAdmin()){toastMsg('Միայն ադմինիստրատոր','error');return;}
    if(!confirm('Վերականգնե՞լ պահուստը։ Կպահանջվի KM-ի վերագործարկում։'))return;
    await window.kmNative.backup.restore({
      name: name,
      adminToken: (function () { try { return localStorage.getItem('km_admin_token') || ''; } catch (eT) { return ''; } })()
    });
    alert('Պահուստը վերականգնվեց։ Վերագործարկեք KM-ը։');
  };

  function kmAuditWhen(ts){
    if(typeof window.kmFormatWhen==='function') return window.kmFormatWhen(ts);
    if(!ts)return '—';
    const d=new Date(ts);
    if(isNaN(+d))return String(ts).slice(0,19);
    const p=n=>String(n).padStart(2,'0');
    return d.getDate()+'.'+p(d.getMonth()+1)+'.'+d.getFullYear()+' · '+p(d.getHours())+':'+p(d.getMinutes())+':'+p(d.getSeconds());
  }
  function kmAuditAction(a){
    if(typeof window.kmActionHy==='function') return window.kmActionHy(a);
    return a||'';
  }
  window.kmOpenAuditLog=async function(query){
    const q=query!=null?String(query):(document.getElementById('kmAuditQ')?document.getElementById('kmAuditQ').value:'');
    let list=window.kmNative&&window.kmNative.audit?await window.kmNative.audit.list(4000,q):[];
    if(!Array.isArray(list)) list=(list&&list.rows)||[];
    try{
      if(window.kmNative&&window.kmNative.lanSync&&typeof window.kmNative.lanSync.pullHubAudit==='function'){
        const hub=await window.kmNative.lanSync.pullHubAudit({limit:4000,query:q});
        if(hub&&hub.ok&&Array.isArray(hub.rows)&&hub.rows.length){
          const seen=Object.create(null);
          const merged=[];
          list.concat(hub.rows).forEach(function(x){
            if(!x)return;
            const k=[x.ts,x.user,x.action,x.detail].join('|');
            if(seen[k])return;
            seen[k]=1;
            merged.push(x);
          });
          merged.sort((a,b)=>String(b.ts||'').localeCompare(String(a.ts||'')));
          list=merged;
        }
      }
    }catch(eHub){}
    if(typeof window.kmIsRealChangeLog==='function'){
      list=list.filter(function(x){ return window.kmIsRealChangeLog(x); });
    }else{
      list=list.filter(function(x){
        var a=String((x&&x.action)||'');
        var d=String((x&&x.detail)||'');
        if(a==='save'||a==='open'||a==='login'||a==='quit') return false;
        if(!d||d.charAt(0)==='{') return false;
        return true;
      });
    }
    content.innerHTML=`<div class="card"><h3>Գործողությունների մատյան</h3>
    <p class="muted" style="margin:0 0 10px;font-size:13px">Միայն պահպանված փոփոխությունները՝ անունով, ինչ է ավելացվել կամ հանվել, օրը և ժամը։ Հաճախորդների գրառումները համաժամեցվում են Hub-ին։</p>
    <div class="toolbar">
      <button type="button" onclick="kmReportsBack()">← Վերադարձ</button>
      <input id="kmAuditQ" type="search" value="${esc(q)}" placeholder="Որոնում (օգտատեր, գործողություն, մանրամաս)" style="min-width:220px;padding:6px 8px">
      <button type="button" onclick="kmOpenAuditLog(document.getElementById('kmAuditQ').value)">Որոնել</button>
      <button type="button" onclick="kmExportAudit('csv')">Արտահանել CSV</button>
      <button type="button" onclick="kmExportAudit('json')">Արտահանել JSON</button>
    </div>
    <div class="gridwrap"><table class="grid"><thead><tr><th>Օր / ամիս</th><th>Օգտատեր</th><th>Գործողություն</th><th>Մանրամաս</th><th>Դեր</th></tr></thead>
    <tbody>${list.map(x=>`<tr><td>${esc(kmAuditWhen(x.ts))}</td><td>${esc(x.fullName||x.user||'—')}</td><td>${esc(kmAuditAction(x.action||''))}</td><td>${esc(x.detail||'')}</td><td>${esc(x.role||'')}</td></tr>`).join('')||'<tr><td colspan="5">Դատարկ</td></tr>'}</tbody></table></div></div>`;
    const inp=document.getElementById('kmAuditQ');
    if(inp)inp.onkeydown=e=>{if(e.key==='Enter')kmOpenAuditLog(inp.value);};
  };
  window.kmExportAudit=async function(fmt){
    if(!window.kmNative||!window.kmNative.audit||!window.kmNative.file){toastMsg('Միայն desktop KM','error');return;}
    const q=document.getElementById('kmAuditQ')?document.getElementById('kmAuditQ').value:'';
    let list=await window.kmNative.audit.list(20000,q);
    if(!Array.isArray(list)) list=(list&&list.rows)||[];
    if(typeof window.kmIsRealChangeLog==='function') list=list.filter(window.kmIsRealChangeLog);
    let name='KM_audit.json', text=JSON.stringify(list,null,2);
    if(fmt==='csv'){
      name='KM_audit.csv';
      const rows=[['ts','user','fullName','action','detail','role']].concat((list||[]).map(x=>[x.ts||'',x.user||'',x.fullName||'',x.action||'',x.detail||'',x.role||'']));
      text='\ufeff'+rows.map(r=>r.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\r\n');
    }
    const bytes=Array.from(new TextEncoder().encode(text));
    const r=await window.kmNative.file.saveDesktop({name,bytes});
    if(r&&r.ok)toastMsg('Արտահանվեց՝ '+r.path);
  };

  window.kmOpenSecuritySettings=async function(){
    if(typeof window.kmCanAdmin==='function'&&!window.kmCanAdmin()){toastMsg('Միայն admin','error');return;}
    const sec=window.kmNative&&window.kmNative.security?await window.kmNative.security.get():{role:'admin',hasPassword:false,username:''};
    const lic=window.kmNative&&window.kmNative.license?await window.kmNative.license.status():{};
    const licText=lic.valid
      ?('Ակտիվ է մինչև '+new Date(lic.expiresAt).toLocaleDateString('hy-AM')+' ('+lic.daysLeft+' օր)')
      :(lic.expired?'Ժամկետը ավարտվել է':'Ակտիվացված չէ');
    content.innerHTML=`<div class="card"><h3>Անվտանգություն</h3>
      <p>Դեր՝ <b>${esc(sec.role)}</b> · Օգտանուն՝ <b>${esc(sec.username||'—')}</b></p>
      <p class="muted">Արտոնագիր՝ ${esc(licText)}</p>
      <label>Օգտանուն <input id="kmSecUser" type="text" value="${esc(sec.username||'')}" style="width:100%;margin:8px 0;padding:8px"></label>
      <label>Նոր գաղտնաբառ (դատարկ = չփոխել)<input id="kmSecPw" type="password" autocomplete="new-password" placeholder="ոչ վերականգնման կոդը · 12+ նիշ, Aa1!" style="width:100%;margin:8px 0;padding:8px"></label>
      <label>Դեր <select id="kmSecRole"><option value="admin">Ադմինիստրատոր</option><option value="editor">Խմբագրող</option><option value="viewer">Դիտորդ</option></select></label>
      <div class="card" style="margin-top:16px;background:#f8fafc">
        <h4 style="margin:0 0 8px">Արտոնագրի ակտիվացում (admin)</h4>
        <p class="muted" style="margin:0 0 8px">Միայն եթե տեղադրման պանակում կան <b>kod.cmd</b> / <b>kod3.cmd</b>։ Առանց դրանց կոդ գեներացնել չի կարելի։ 3 ամսվա համար գործարկեք <b>kod3.cmd</b>։</p>
        <div class="toolbar" style="margin:0 0 10px;gap:8px">
          <button type="button" class="primary" onclick="kmAdminKodActivate()">Ակտիվացնել KM (kod)</button>
        </div>
        <label>Կամ ձեռքով կոդ <input id="kmSecLicCode" type="text" placeholder="" autocomplete="off" style="width:100%;margin-top:4px;padding:8px;letter-spacing:.06em"></label>
        <button type="button" style="margin-top:10px" onclick="kmAdminRenewLicense()">Կիրառել կոդ</button>
      </div>
      <div class="toolbar" style="margin-top:16px"><button onclick="kmSaveSecuritySettings()">Պահպանել</button><button type="button" onclick="kmReportsBack()">← Վերադարձ</button></div></div>`;
    document.getElementById('kmSecRole').value=sec.role||'admin';
  };

  window.kmAdminRenewLicense=async function(){
    const code=document.getElementById('kmSecLicCode')?.value;
    if(!code){toastMsg('Մուտքագրեք կոդ');return;}
    try{
      const r=await window.kmNative.license.activate(String(code).trim());
      if(r&&r.ok===false){toastMsg(r.error||'Սխալ ակտիվացման կոդ','error');return;}
      sessionStorage.removeItem('km_license_bypass');
      window.kmLicenseBypass=false;
      toastMsg('Ակտիվացված է մինչև '+new Date(r.expiresAt).toLocaleDateString('hy-AM'));
      kmOpenSecuritySettings();
    }catch(e){
      let msg=String(e.message||e);
      msg=msg.replace(/^Error invoking remote method '[^']+':\s*/i,'').replace(/^Error:\s*/i,'').trim();
      toastMsg(msg||'Սխալ','error');
    }
  };

  window.kmAdminKodActivate=async function(){
    if(typeof window.kmCanAdmin==='function'&&!window.kmCanAdmin()){toastMsg('Միայն admin','error');return;}
    if(!window.kmNative||!window.kmNative.kod){toastMsg('kod.cmd ինտեգրումը բացակայում է','error');return;}
    try{
      const r=await window.kmNative.kod.activate();
      sessionStorage.removeItem('km_license_bypass');
      window.kmLicenseBypass=false;
      window.kmLicenseStatus=r;
      toastMsg('KM ակտիվացված է մինչև '+new Date(r.expiresAt).toLocaleDateString('hy-AM'));
      if(typeof render==='function')render();
      kmOpenSecuritySettings();
    }catch(e){toastMsg(e.message||String(e),'error');}
  };

  window.kmSaveSecuritySettings=async function(){
    const username=document.getElementById('kmSecUser').value;
    const pw=document.getElementById('kmSecPw').value;
    const role=document.getElementById('kmSecRole').value;
    const patch={username,role};
    if(pw)patch.password=pw;
    try{
      const tok=(function(){try{return localStorage.getItem('km_admin_token')||'';}catch(eT){return '';}})();
      await window.kmNative.security.set(Object.assign({adminToken:tok},patch));
    }catch(e){
      var msg=String((e&&e.message)||e||'');
      msg=msg.replace(/^Error invoking remote method '[^']+':\s*/i,'').replace(/^Error:\s*/i,'').trim();
      toastMsg(msg||'Չհաջողվեց պահպանել','error');
      return;
    }
    sessionStorage.removeItem('km_auth_ok');
    sessionStorage.removeItem('km_auth_role');
    sessionStorage.removeItem('km_auth_mode');
    localStorage.removeItem('km_admin_token');
    localStorage.removeItem('km_admin_expires');
    try{if(window.kmNative.security.clearSession)await window.kmNative.security.clearSession();}catch(e){}
    toastMsg('Անվտանգության կարգավորումները պահպանվեցին — նորից մուտք գործեք');
  };

  /* ---- Archive formal blocks patch ---- */
  const _viewArchiveReadOnly=window.viewArchiveReadOnly;
  window.viewArchiveReadOnly=function(id){
    if(typeof _viewArchiveReadOnly!=='function')return;
    _viewArchiveReadOnly(id);
    try{
      const a=(Array.isArray(db.archives)?db.archives:[]).find(x=>String(x.id)===String(id));
      const sch=(a&&a.snapshot&&a.snapshot.schedule)||{};
      const card=document.querySelector('#kmArchiveReadonlyModal .kmArchiveReadonlyCard');
      if(!card||typeof kmFormalPrintTopBlock!=='function')return;
      const top=kmFormalPrintTopBlock(sch);
      const bottom=typeof kmFormalPrintBottomBlock==='function'?kmFormalPrintBottomBlock(sch):'';
      const title=card.querySelector('.graphDisplayTitle');
      const table=card.querySelector('table');
      if(title) title.insertAdjacentHTML('beforebegin',top);
      if(table) table.insertAdjacentHTML('afterend',bottom);
      else if(title) title.insertAdjacentHTML('afterend',bottom);
    }catch(e){console.error('archive formal',e);}
  };

  /* ---- Hook save for audit + KM_ADMIN_HANG_V1b reentrancy guard ---- */
  if(typeof window.save==='function'){
    const _save=window.save;
    window.save=async function(silent){
      if(window.__kmSaveBusy){
        window.__kmSaveQueued=true;
        return;
      }
      window.__kmSaveBusy=true;
      try{
        const r=await _save.apply(this,arguments);
        return r;
      }finally{
        window.__kmSaveBusy=false;
        if(window.__kmSaveQueued){
          window.__kmSaveQueued=false;
          setTimeout(function(){
            if(!window.__kmSaveBusy && typeof window.save==='function'){
              window.save(true).catch(function(){});
            }
          }, 2000);
        }
      }
    };
  }

  /* ---- Schedule toolbar (export/plan tools live on schedule page only) ---- */
  function patchSchedule(){
    const orig=window.schedule;
    if(typeof orig!=='function'||window.schedule.__kmHubSchedule)return;
    window.schedule=function(){
      orig();
      setTimeout(()=>{if(typeof kmShowConflictBanner==='function')kmShowConflictBanner();},50);
      const tb=document.querySelector('#content .toolbar');
      if(!tb||tb.querySelector('[data-km-schedule-tools]'))return;
      const wrap=document.createElement('span');
      wrap.dataset.kmScheduleTools='1';
      wrap.style.cssText='display:inline-flex;flex-wrap:wrap;gap:6px;margin-left:8px';
      wrap.innerHTML=`
        <button type="button" onclick="kmExportScheduleExcel()">Excel</button>
        <button type="button" onclick="kmBatchPrintAllGraphs()">Խմբային PDF</button>
        <button type="button" onclick="kmSmartAutoPlan()">Խելացի պլան</button>
        <button type="button" onclick="kmCopyScheduleMonths(1)">+1 ամիս</button>`;
      tb.appendChild(wrap);
    };
    window.schedule.__kmHubSchedule=true;
  }

  function extendI18n(){
    if(typeof window.kmTranslateUI!=='function')return;
    const extra={
      hy:{'Վիճակագրություն':'Վիճակագրություն','Audit log':'Գործողությունների մատյան'},
      ru:{'Վիճակագրություն':'Аналитика','Audit log':'Журнал действий','Excel':'Excel','Batch PDF':'Пакетный PDF'},
      en:{'Վիճակագրություն':'Analytics','Audit log':'Audit log','Backup':'Backup','Security':'Security'}
    };
    /* merged at runtime via km-features-i18n patch in DOMContentLoaded */
    window.KM_EXTRA_I18N=extra;
  }

  document.addEventListener('DOMContentLoaded',async()=>{
    extendI18n();
    if(typeof window.kmEnsureSecurity==='function')await window.kmEnsureSecurity();
    patchSchedule();
    if(typeof normalize==='function'){
      const _n=normalize;
      window.normalize=function(){
        _n();
        if(!Array.isArray(db.futureSchedules))db.futureSchedules=[];
        if(!Array.isArray(db.formalTemplates))db.formalTemplates=[];
      };
    }
  });
})();
