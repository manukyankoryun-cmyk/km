/* KM v3 extensions: dashboard, smart plan, reports, org, print, settings, tables */
(function(){
  'use strict';

  function esc(s){return typeof window.esc==='function'?window.esc(s):String(s??'');}
  function clone(x){return typeof window.clone==='function'?window.clone(x):JSON.parse(JSON.stringify(x));}
  function toastMsg(m,t){if(typeof toast==='function')toast(m,t);else alert(m);}

  function ensureDbFields(){
    if(typeof db==='undefined')return;
    db.substitutions=Array.isArray(db.substitutions)?db.substitutions:[];
    db.cellComments=db.cellComments&&typeof db.cellComments==='object'?db.cellComments:{};
    db.scheduleTemplates=Array.isArray(db.scheduleTemplates)?db.scheduleTemplates:[];
    db.units=Array.isArray(db.units)?db.units:[];
    (db.people||[]).forEach(p=>{
      if(p.phone==null)p.phone='';
      if(p.note==null)p.note='';
      if(p.photo==null)p.photo='';
      if(p.education==null)p.education='';
      if(p.familyStatus==null)p.familyStatus=p.family||'';
      if(p.contractStart==null)p.contractStart='';
      if(p.endDate==null)p.endDate=p.contractEnd||'';
      if(p.region==null)p.region='';
      if(p.city==null)p.city='';
      if(p.address==null)p.address='';
      if(p.commissariat==null)p.commissariat='';
      if(p.bloodGroup==null)p.bloodGroup='';
      if(p.illnesses==null)p.illnesses='';
      if(p.articles==null)p.articles='';
      if(p.educationGroup==null)p.educationGroup='';
      if(p.secrecyClearance==null)p.secrecyClearance='';
      if(p.idCard==null)p.idCard='';
      if(p.hsk==null)p.hsk='';
      if(p.unitId==null)p.unitId='';
    });
  }

  /* ---- Unified home hub (single place for extended features) ---- */
  function injectHubCss(){
    var s=document.getElementById('km-hub-css');
    if(!s){s=document.createElement('style');s.id='km-hub-css';document.head.appendChild(s);}
    s.textContent=`
      .kmHubCard{margin-top:12px;overflow:hidden}
      .kmHubDash{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:8px;margin:0 0 14px;width:100%;min-width:0}
      #kmDayGlance.kmHubCard{width:100%;margin:0 0 14px}
      #kmDayGlance .kmGlanceDash{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:12px}
      #kmDayGlance .kmGlanceCol{align-items:flex-start!important;text-align:left!important;padding:16px 18px!important;min-height:140px;width:100%}
      #kmDayGlance .kmGlanceCol b.kmGlanceCount{font-size:28px;line-height:1.05}
      #kmDayGlance .kmGlanceNames{width:100%;margin:10px 0 0;padding:0;list-style:none;font-size:13px;line-height:1.45;color:#3a4a58}
      #kmDayGlance .kmGlanceNames li{margin:0 0 4px}
      @media(max-width:780px){#kmDayGlance .kmGlanceDash{grid-template-columns:1fr!important}}
      .kmHubDash .stat{margin:0!important;min-width:0!important;width:auto;max-width:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;text-align:center;padding:12px 6px;border-radius:16px;background:linear-gradient(180deg,#fff 0%,#f4f8fb 100%);border:1px solid #d7e3ec;box-shadow:0 6px 14px rgba(16,40,60,.06);box-sizing:border-box;overflow:hidden}
      body.km-dark:not(.km-mil-bg-on) .kmHubDash .stat{background:linear-gradient(180deg,#162231 0%,#121c28 100%);border-color:#2d4560}
      .kmHubDash .stat b{font-size:22px;line-height:1.1}
      .kmHubDash .stat .muted{display:block;max-width:100%;font-size:11px;line-height:1.25;white-space:normal;overflow-wrap:anywhere;word-break:break-word}
      @media(max-width:1100px){.kmHubDash{grid-template-columns:repeat(4,minmax(0,1fr))}}
      @media(max-width:640px){.kmHubDash{grid-template-columns:repeat(2,minmax(0,1fr))}}
      .kmHubGrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}
      .kmHubGroup{border:1px solid rgba(23,33,43,.12);border-radius:12px;padding:12px;background:rgba(255,255,255,.55);display:flex;flex-direction:column;gap:8px}
      body.km-dark:not(.km-mil-bg-on) .kmHubGroup{border-color:rgba(255,255,255,.12);background:rgba(0,0,0,.18)}
      .kmHubGroup h4{margin:0;font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:#4a5f73}
      body.km-dark .kmHubGroup h4{color:#9ab}
      .kmHubGroup p{margin:0;font-size:12px;color:#667;line-height:1.4}
      .kmHubGroup .toolbar{display:flex;flex-wrap:wrap;gap:6px;margin:0}
      .kmHubGroup .toolbar button{font-size:13px;padding:7px 11px}
      .kmHubNote{margin:12px 0 0;font-size:12px;color:#667}
      .kmHubDuty{margin:0 0 14px;padding:10px 12px;border-radius:10px;background:#eaf3fa;border:1px solid #c5d6e4;font-size:13px}
      body.km-dark .kmHubDuty{background:#1c2a3a;border-color:#2d4560;color:#dce7ef}
      .kmHomeBottomRow{display:grid;grid-template-columns:minmax(155px,1fr) minmax(240px,2fr) minmax(130px,.9fr);gap:12px;align-items:stretch;margin-bottom:14px}
      .kmWorkStatusCompact{padding:10px 12px!important;margin-bottom:0!important}
      .kmWorkStatusCompact h3{font-size:14px;margin:0 0 8px}
      .kmWorkStatusCompact .kmCompactStats{display:flex;gap:6px;flex-wrap:wrap}
      .kmWorkStatusCompact .stat{flex:1 1 60px;margin:0;padding:6px 4px;font-size:11px;text-align:center;min-width:58px}
      .kmWorkStatusCompact .stat b{font-size:16px}
      .kmCurrentGraphCard h3{margin-top:0;font-size:15px}
      .kmCurrentGraphCard{margin-bottom:0!important}
      .kmHomeHelpCard{margin-bottom:0!important;padding:10px 12px!important;display:flex;flex-direction:column;justify-content:flex-start}
      .kmHomeHelpCard h4{margin:0 0 10px;font-size:13px;font-weight:800;letter-spacing:.02em;text-transform:uppercase;color:#4a5f73}
      body.km-dark .kmHomeHelpCard h4{color:#9ab}
      @media(max-width:900px){.kmHomeBottomRow{grid-template-columns:1fr 1fr}.kmHomeHelpCard{grid-column:1/-1}}
      @media(max-width:560px){.kmHomeBottomRow{grid-template-columns:1fr}}
    `;
  }

  window.kmRenderHomeHub=function(){
    /* KM_HOME_ORG_GATE_V1: hide home numbers until corps+unit picked in accounting */
    var orgOk = false;
    try {
      if (typeof window.kmHomeOrgSelected === 'function') orgOk = !!window.kmHomeOrgSelected();
      else {
        var _c = typeof window.kmGetOrgContext === 'function' ? window.kmGetOrgContext() : null;
        orgOk = !!(!(_c) ? false : (String(_c.corpsId || '').trim() && String(_c.unitId || '').trim()));
      }
    } catch (eGate) { orgOk = false; }
    if (!orgOk) {
      return '<div class="card kmHubCard" id="kmHomeHub" data-km-home-gated="1">' +
        '<h3 style="margin-top:0">Ամփոփում</h3>' +
        '<p class="muted" style="margin:8px 0 0;line-height:1.5">Տվյալները ցուցադրվում են միայն այն բանից հետո, երբ <b>Հաշվառում</b> բաժնում ընտրում եք <b>բանակային կորպուս</b> և <b>զորամաս</b>։</p>' +
        '<div class="toolbar" style="margin-top:12px">' +
          '<button type="button" class="primary" onclick="typeof kmOpenPage===\'function\'&&kmOpenPage(\'accounting\')">Բացել Հաշվառում</button>' +
        '</div></div>';
    }

    const s=db.schedule||{}, y=+s.year, m=+s.month;
    const days=new Date(y,m,0).getDate()||0;
    const conflicts=typeof kmDetectConflicts==='function'?kmDetectConflicts():[];
    const notes=(db.notebookNotes||[]).length;
    const sheets=(db.spreadsheets||[]).length;
    const archives=(Array.isArray(db.archives)?db.archives:[]).length;
    const vac=(db.vacations||[]).filter(v=>v&&v.person).length;

    /* KM_HOME_STAFF_COUNT_FROM_MANNING_V1 */
    /* KM_HOME_STAFF_COUNT_FROM_MANNING_V2 */
    var staffCount = 0;
    try {
      var tro = (((typeof db !== 'undefined' && db.troopStructure) || {}).staff || {}).rows || [];
      staffCount = tro.filter(function (r) {
        return r && r.type !== 'section' && String(r.name || '').trim();
      }).length;
    } catch (eT0) {}
    if (!staffCount) {
      try {
        var st = null;
        if (typeof window.kmUnitManningStats === 'function') {
          var uid = (window._kmUnitArchiveActiveUnitId) || (typeof db !== 'undefined' && db.troopStructure && (db.troopStructure._formalUnitId || db.troopStructure._formalBound)) || null;
          st = window.kmUnitManningStats(uid);
        }
        if (st && st.filled != null) staffCount = +st.filled || 0;
      } catch (eMan) {}
    }
    if (!staffCount) {
      try {
        staffCount = ((typeof db !== 'undefined' && db.people) || []).filter(function (p) {
          return p && String(p.name || '').trim() && p.blocked !== true && !p._kmVacantPosId;
        }).length;
      } catch (eP) {}
    }
    return `<div class="card kmHubCard" id="kmHomeHub">
      <h3 style="margin-top:0">Ամփոփում</h3>
      <div class="kmHubDash">
        <div class="stat"><b>${conflicts.length}</b><span class="muted">Խնդիրներ</span></div>
        <div class="stat"><b>${staffCount}</b><span class="muted">Անձնակազմ</span></div>
        <div class="stat"><b>${(db.dutyTypes||[]).length}</b><span class="muted">Վերակարգեր</span></div>
        <div class="stat"><b>${notes}</b><span class="muted">Նշումներ</span></div>
        <div class="stat"><b>${sheets}</b><span class="muted">Աղյուսակներ</span></div>
        <div class="stat"><b>${archives}</b><span class="muted">Արխիվներ</span></div>
        <div class="stat"><b>${vac}</b><span class="muted">Արձակուրդ</span></div>
        <div class="stat"><b>${days}</b><br><span class="muted">Օրեր (${m}/${y})</span></div>
      </div>
    </div>`;
  };

  function kmCompactWorkGraphCards(workCard, graphCard){
    if(workCard){
      workCard.classList.add('kmWorkStatusCompact');
      const stats=workCard.querySelectorAll('.stat');
      if(stats.length&&!workCard.querySelector('.kmCompactStats')){
        const wrap=document.createElement('div');
        wrap.className='kmCompactStats';
        stats.forEach(s=>wrap.appendChild(s));
        workCard.appendChild(wrap);
      }
    }
    if(graphCard){
      graphCard.classList.add('kmCurrentGraphCard');
      const ps=graphCard.querySelectorAll('p');
      if(ps.length>=2){
        const m=ps[0].innerHTML, d=ps[1].querySelector('b');
        ps[0].innerHTML=m+(d?(' · Օրեր՝ <b>'+d.textContent+'</b>'):'');
        ps[1].remove();
      }
    }
  }

  function kmFinalizeHomeLayout(){
    const c=document.getElementById('content');
    if(!c)return;

    const hero=c.querySelector('[data-km-home-system="1"]');
    const hub=c.querySelector('#kmHomeHub');
    const today=c.querySelector('#kmTodayBoard');
    const glance=c.querySelector('#kmDayGlance');
    const rem=c.querySelector('#kmContractReminders')||c.querySelector('#kmContractOverdue');

    const statusRow=c.querySelector('.two')||c.querySelector('.kmHomeTopRow')||c.querySelector('.kmHomeBottomRow');
    if(statusRow){
      const cards=statusRow.querySelectorAll('.card');
      kmCompactWorkGraphCards(cards[0]||null, cards[1]||null);
      statusRow.remove();
    }

    let extras=c.querySelector('.kmHomeExtrasRow');
    if(rem){
      if(!extras){
        extras=document.createElement('div');
        extras.className='kmHomeExtrasRow';
      }
      extras.querySelectorAll('#kmDayGlance').forEach(function(el){el.remove();});
      extras.appendChild(rem);
    }else if(extras){
      extras.querySelectorAll('#kmDayGlance').forEach(function(el){el.remove();});
      if(!extras.childNodes.length) extras.remove();
    }

    if(hero)c.appendChild(hero);
    if(hub)c.appendChild(hub);
    if(glance)c.appendChild(glance);
    if(today)c.appendChild(today);
    if(extras&&extras.childNodes.length)c.appendChild(extras);
  }
  window.kmFinalizeHomeLayout=kmFinalizeHomeLayout;

  function patchHomeLayout(){
    kmFinalizeHomeLayout();
  }

  function patchHome(){
    const orig=window.home;
    if(typeof orig!=='function'||window.home.__kmHub)return;
    window.home=function(){
      orig();
      ensureDbFields();
      injectHubCss();
      const c=document.getElementById('content');
      if(!c)return;
      c.querySelector('#kmHomeHub')?.remove();
      const dbCard=c.querySelector('.card:last-of-type');
      if(dbCard)dbCard.insertAdjacentHTML('beforebegin',kmRenderHomeHub());
      else c.insertAdjacentHTML('beforeend',kmRenderHomeHub());
      /* KM_HOME_STRIP_UNGATED_V1 */
      try {
        var orgOk2 = (typeof window.kmHomeOrgSelected === 'function') ? !!window.kmHomeOrgSelected() : false;
        if (!orgOk2) {
          /* KM_HOME_STRIP_KEEP_GATED_TODAY_V1 */
          ['#kmTodayBoard','#kmContractReminders','#kmContractOverdue','[data-km-home-system="1"]'].forEach(function(sel){
            c.querySelectorAll(sel).forEach(function(el){
              if (sel === '#kmTodayBoard' && el.getAttribute('data-km-home-gated') === '1') return;
              el.remove();
            });
          });
          c.querySelectorAll('.stat b, .kmGlanceCount').forEach(function(el){
            var card=el.closest('.card, .stat, .kmHubCard');
            if(card && card.getAttribute('data-km-home-gated')!=='1'){
              /* leave gated placeholders */
            }
          });
          c.querySelectorAll('.two, .kmHomeTopRow, .kmHomeBottomRow').forEach(function(el){ el.remove(); });
        }
      } catch (eStrip) {}
      patchHomeLayout();
    };
    window.home.__kmHub=true;
  }

  /* ---- Smart auto-plan ---- */
  window.kmSmartAutoPlan=async function(){
    if(!window.kmCanEdit()){toastMsg('Դիտորդի իրավունք','error');return;}
    let people=typeof kmMainSelectedPeople==='function'?kmMainSelectedPeople():[];
    if(!people.length){toastMsg('Ընտրեք անձնակազմ','error');return;}
    let minGap=3,maxPerMonth=5,equalize=true;
    try{
      if(window.kmNative&&window.kmNative.settings){
        const st=await window.kmNative.settings.get();
        minGap=Math.max(1,Number(st.smartPlanMinGap)||3);
        maxPerMonth=Math.max(1,Math.min(5,Number(st.smartPlanMaxPerMonth)||5));
        equalize=st.smartPlanEqualize!==false;
      }
    }catch(e){}
    if(typeof kmMaxDutyPerPerson==='function')maxPerMonth=Math.min(maxPerMonth,kmMaxDutyPerPerson());
    kmPushUndo('մինչ smart plan',clone(db));
    const s=db.schedule,days=new Date(+s.year,+s.month,0).getDate();
    archiveCurrentSchedule('Smart auto-plan');
    people=typeof kmSortPeopleByRank==='function'?kmSortPeopleByRank(people):people.slice();
    s.rows={};people.forEach(p=>s.rows[p.name]={});
    const dutyCount={};people.forEach(p=>dutyCount[p.name]=0);
    const lastDay={};
    const n=people.length;
    for(let d=1;d<=days;d++){
      if(!n)break;
      const pref=(d-1)%n;
      let chosen=null;
      let bestScore=null;
      for(let k=0;k<n;k++){
        const p=people[(pref+k)%n];
        if(typeof kmPersonNotPlannable==='function'&&kmPersonNotPlannable(p))continue;
        if(typeof kmPersonIsBlocked==='function'&&kmPersonIsBlocked(p))continue;
        if(typeof kmPersonEligibleForDuty==='function'&&!kmPersonEligibleForDuty(p,'Հիմնական'))continue;
        if((typeof kmPersonHasInconvenientDay==='function'?kmPersonHasInconvenientDay(p,d):((p.bad||[]).map(Number).includes(d))))continue;
        if(typeof kmSkipHolidaysInPlan==='function'&&kmSkipHolidaysInPlan()&&typeof kmIsArmenianHoliday==='function'&&kmIsArmenianHoliday(+s.year,+s.month,d))continue;
        if(typeof isPersonOnVacation==='function'&&isPersonOnVacation(p.name,new Date(+s.year,+s.month-1,d,12,0,0)))continue;
        if(lastDay[p.name]!=null&&d-lastDay[p.name]<minGap)continue;
        if(dutyCount[p.name]>=maxPerMonth)continue;
        const load=dutyCount[p.name]||0;
        const score=equalize?(load*10000+k):k;
        if(bestScore==null||score<bestScore){bestScore=score;chosen=p;}
        if(!equalize&&chosen)break;
      }
      if(!chosen)continue;
      s.rows[chosen.name][d]='Հերթապահ';
      dutyCount[chosen.name]=(dutyCount[chosen.name]||0)+1;
      lastDay[chosen.name]=d;
    }
    await save();render();
    toastMsg('Smart պլանավորում ավարտված');
    if(typeof kmShowConflictBanner==='function')kmShowConflictBanner();
  };

  /* ---- Month compare ---- */
  window.kmMonthCompare=function(){
    const archives=(Array.isArray(db.archives)?db.archives:[]).slice(-24).reverse();
    const host=document.getElementById('content');
    if(!host)return;
    const archOpts=archives.map(a=>`<option value="${a.id}">${esc(a.label||a.id)} (${(a.snapshot&&a.snapshot.schedule&&a.snapshot.schedule.month)||'?'} / ${(a.snapshot&&a.snapshot.schedule&&a.snapshot.schedule.year)||'?'})</option>`).join('');
    host.innerHTML=`<div class="card"><h3 class="kmLawsHubTitle" style="margin-top:0">Ամիսների համեմատություն</h3>
      <p class="kmLawsHubLead">Համեմատեք ընթացիկ գրաֆիկը արխիվի հետ կամ երկու արխիվ։ Հերթապահ է համարվում ցանկացած լրացված բջիջ։</p>
      <div class="toolbar" style="flex-wrap:wrap;gap:10px;margin-bottom:12px">
        <button type="button" onclick="kmReportsBack()">← Վերադարձ</button>
        <label>Ա <select id="kmCmpA"><option value="current">Ընթացիկ</option>${archOpts}</select></label>
        <label>Բ <select id="kmCmpB"><option value="current">Ընթացիկ</option>${archOpts}</select></label>
        <button type="button" class="primary" onclick="kmRunMonthCompare()">Համեմատել</button>
      </div>
      <div id="kmCmpOut" class="muted">${archives.length? 'Ընտրեք երկու աղբյուր և սեղմեք «Համեմատել»։' : 'Արխիվ դեռ չկա — կարող եք համեմատել միայն ընթացիկը ինքն իր հետ, կամ նախ ստեղծել արխիվ։'}</div></div>`;
    page='monthCompare';
    window.page='monthCompare';
    const pt=document.getElementById('pageTitle');
    if(pt)pt.textContent='Ամիսների համեմատություն';
    const b=document.getElementById('kmCmpB');
    if(b&&archives[0]) b.value=String(archives[0].id);
  };

  window.kmRunMonthCompare=function(){
    function occupied(v){
      const t=String(v==null?'':v).trim();
      return !!t && t!=='—' && t!=='-' && t!=='.';
    }
    function snap(id){
      if(id==='current')return db;
      const a=(Array.isArray(db.archives)?db.archives:[]).find(x=>String(x.id)===String(id));
      return a&&a.snapshot?a.snapshot:null;
    }
    const elA=document.getElementById('kmCmpA'), elB=document.getElementById('kmCmpB'), out=document.getElementById('kmCmpOut');
    if(!elA||!elB||!out){toastMsg('Էջը պատրաստ չէ');return;}
    const A=snap(elA.value);
    const B=snap(elB.value);
    if(!A||!B){toastMsg('Տվյալ չկա');out.innerHTML='<p class="muted">Տվյալ չկա ընտրված աղբյուրների համար։</p>';return;}
    const sa=A.schedule||{}, sb=B.schedule||{};
    const stats=(sch)=>{
      const o={};
      Object.keys(sch.rows||{}).forEach(name=>{
        o[name]=Object.values(sch.rows[name]||{}).filter(occupied).length;
      });
      return o;
    };
    const a=stats(sa),b=stats(sb);
    const names=new Set([...Object.keys(a),...Object.keys(b)]);
    const rows=[...names].sort((x,y)=>String(x).localeCompare(String(y),'hy')).map(n=>{
      const da=a[n]||0, db2=b[n]||0, diff=da-db2;
      return `<tr><td>${esc(n)}</td><td>${da}</td><td>${db2}</td><td style="color:${diff>0?'#1a5c3a':diff<0?'#a43b3b':'inherit'}">${diff>0?'+':''}${diff}</td></tr>`;
    }).join('');
    out.innerHTML=`<div class="gridwrap"><table class="grid"><thead><tr><th>Անձ</th><th>${esc((sa.month||'?')+'/'+(sa.year||'?'))}</th><th>${esc((sb.month||'?')+'/'+(sb.year||'?'))}</th><th>Δ</th></tr></thead><tbody>${rows||'<tr><td colspan="4">—</td></tr>'}</tbody></table></div>`;
  };

  /* ---- Workload report ---- */
  window.kmWorkloadReport=function(){
    const s=db.schedule||{};
    const y=+s.year||new Date().getFullYear();
    const m=+s.month||(new Date().getMonth()+1);
    const days=new Date(y,m,0).getDate();
    function occupied(v){
      const t=String(v==null?'':v).trim();
      return !!t && t!=='—' && t!=='-' && t!=='.';
    }
    const stats={};
    (db.people||[]).forEach(p=>stats[p.name]={duty:0,vac:0,bad:(p.bad||[]).length});
    for(let d=1;d<=days;d++){
      (db.people||[]).forEach(p=>{
        const v=(s.rows&&s.rows[p.name]&&s.rows[p.name][d])||'';
        if(occupied(v))stats[p.name].duty++;
        if(typeof isPersonOnVacation==='function'&&isPersonOnVacation(p.name,new Date(y,m-1,d,12,0,0)))stats[p.name].vac++;
      });
    }
    const vals=Object.values(stats).map(x=>x.duty);
    const avg=vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:0;
    const rows=Object.entries(stats).sort((a,b)=>b[1].duty-a[1].duty).map(([n,v])=>{
      const flag=v.duty>avg*1.2?'⚠ շատ':(v.duty<avg*0.8&&avg>0?'↓ քիչ':'');
      return `<tr><td>${esc(n)}</td><td>${v.duty}</td><td>${v.vac}</td><td>${v.bad}</td><td>${flag}</td></tr>`;
    }).join('')||'<tr><td colspan="5">Տվյալ չկա</td></tr>';
    const host=document.getElementById('content');
    if(!host)return;
    host.innerHTML=`<div class="card"><div class="toolbar kmBackToolbar" style="margin-bottom:10px">
        <button type="button" class="kmBackBtn" onclick="kmReportsBack()">← Վերադարձ</button>
      </div>
      <h3 class="kmLawsHubTitle" style="margin-top:0">Պարտականության բեռ — ${m}/${y}</h3>
      <p class="kmLawsHubLead">Միջին հերթապահություն՝ ${avg.toFixed(1)} օր</p>
      <div class="toolbar" style="margin-bottom:12px">
        <button type="button" onclick="kmExportIcs()">Օրացույց (ICS)</button>
        <button type="button" onclick="kmRememberAndOpen({kind:'page',value:'analytics'},()=>kmOpenPage('analytics'))">Վիճակագրություն</button>
      </div>
      <div class="gridwrap"><table class="grid"><thead><tr><th>Անձ</th><th>Հերթապահ</th><th>Արձակուրդ</th><th>Անհարմար</th><th></th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
    page='workload';
    window.page='workload';
    try{if(typeof kmCurrentView!=='undefined')kmCurrentView={kind:'page',value:'workload'};}catch(e){}
    const pt=document.getElementById('pageTitle');
    if(pt)pt.textContent='Բեռ';
  };

  /* ---- ICS export ---- */
  window.kmExportIcs=function(){
    const s=db.schedule,y=+s.year,m=+s.month,days=new Date(y,m,0).getDate();
    const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//KM//006.2.67//HY'];
    for(let d=1;d<=days;d++){
      (db.people||[]).forEach(p=>{
        const v=(s.rows&&s.rows[p.name]&&s.rows[p.name][d])||'';
        if(String(v).trim()!=='Հերթապահ')return;
        const ds=String(y)+String(m).padStart(2,'0')+String(d).padStart(2,'0');
        lines.push('BEGIN:VEVENT','DTSTART;VALUE=DATE:'+ds,'DTEND;VALUE=DATE:'+ds,'SUMMARY:Հերթապահ — '+p.name,'END:VEVENT');
      });
    }
    lines.push('END:VCALENDAR');
    const blob=new Blob([lines.join('\r\n')],{type:'text/calendar'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);
    a.download='KM_duty_'+y+'_'+String(m).padStart(2,'0')+'.ics';a.click();
    toastMsg('ICS արտահանված');
  };

  /* ---- Substitutions ---- */
  window.kmAddSubstitution=async function(){
    if(!window.kmCanEdit())return;
    const from=prompt('Ո՞վ չի կարող (անուն)');if(!from)return;
    const to=prompt('Փոխարինող');if(!to)return;
    const day=Number(prompt('Օր (1-31)',String(new Date().getDate())));
    db.substitutions.push({from:from.trim(),to:to.trim(),day,month:db.schedule.month,year:db.schedule.year,at:new Date().toISOString()});
    await save(true);
    toastMsg('Փոխարինում գրանցված');
  };

  window.kmListSubstitutions = function () {
    if (typeof window.kmOpenSubstitutionLog === 'function') window.kmOpenSubstitutionLog();
  };

  /* ---- Cell comments ---- */
  window.kmCellCommentKey=function(graph,person,day){
    return graph+'|'+person+'|'+day;
  };
  window.kmSetCellComment=async function(graph,person,day,text){
    if(!window.kmCanEdit())return;
    db.cellComments=db.cellComments||{};
    const k=kmCellCommentKey(graph,person,day);
    if(text)db.cellComments[k]=String(text);else delete db.cellComments[k];
    await save(true);
  };

  /* ---- CSV import people ---- */
  window.kmImportPeopleCsv=function(){
    if(!window.kmCanEdit()){toastMsg('Դիտորդի իրավունք','error');return;}
    const inp=document.createElement('input');inp.type='file';inp.accept='.csv,.txt';
    inp.onchange=async()=>{
      const f=inp.files[0];if(!f)return;
      const text=await f.text();
      const lines=text.split(/\r?\n/).filter(Boolean);
      let n=0, skipped=0;
      lines.forEach((line,i)=>{
        if(i===0&&/անուն|name/i.test(line))return;
        if((db.people||[]).length>=(window.KM_PEOPLE_MAX||20000))return;
        const parts=line.split(/[,;\t]/).map(x=>x.trim());
        if(!parts[0])return;
        const name=parts[0],rank=parts[1]||'',unit=parts[2]||'';
        if((db.people||[]).some(p=>String(p.name).toLowerCase()===name.toLowerCase())){skipped++;return;}
        const col3=parts[3]||'', col4=parts[4]||'';
        const daysLike=/^[\d,\s]+$/.test(col3)&&/\d/.test(col3);
        const phone=daysLike?'':col3;
        const badStr=daysLike?col3:(/^[\d,\s]+$/.test(col4)?col4:'');
        const note=daysLike?col4:(parts[5]||'');
        const bad=String(badStr).split(/[,\s]+/).map(Number).filter(n=>n>=1&&n<=31);
        db.people.push({name,rank,unit,bad,phone,note});
        n++;
      });
      await save();render();
      const cap=(db.people||[]).length>=(window.KM_PEOPLE_MAX||20000);
      toastMsg('CSV՝ ավելացվեց '+n+(skipped?' · բաց թողնվեց կրկնօրինակ՝ '+skipped:'')+(cap?' · հասել է '+(window.KM_PEOPLE_MAX||20000)+' սահմանաչափին':''));
    };
    inp.click();
  };

  /* ---- Units manager: defined in km-ops.js (canonical) ---- */

  /* ---- Schedule templates ---- */
  window.kmSaveScheduleTemplate=async function(){
    if(!window.kmCanEdit()){toastMsg('Դիտորդի իրավունք','error');return;}
    ensureDbFields();
    const name=prompt('Ձևանմուշի անուն');if(!name)return;
    db.scheduleTemplates.push({name:name.trim(),rows:clone(db.schedule.rows||{}),savedAt:new Date().toISOString()});
    await save(true);toastMsg('Ձևանմուշը պահպանվեց');
  };
  window.kmApplyScheduleTemplate=async function(){
    if(!window.kmCanEdit()){toastMsg('Դիտորդի իրավունք','error');return;}
    ensureDbFields();
    if(!db.scheduleTemplates.length){toastMsg('Ձևանմուշներ չկան');return;}
    const opts=db.scheduleTemplates.map((t,i)=>`${i+1}. ${t.name}`).join('\n');
    const v=Number(prompt('Համար:\n'+opts,'1'))-1;
    const t=db.scheduleTemplates[v];if(!t)return;
    if(!confirm('Կիրառե՞լ ձևանմուշը'))return;
    kmPushUndo('մինչ ձևանմուշ',clone(db));
    db.schedule.rows=clone(t.rows||{});
    await save();render();
  };

  /* ---- Tables UI ---- */
  window.tablesPage=function(){
    db.tables=Array.isArray(db.tables)?db.tables:[];
    if(!db.tables.length)db.tables.push({name:'Աղյուսակ 1',headers:['Սյունակ A','Սյունակ B'],rows:[['','']]});
    selectedTable=Math.min(Math.max(0,selectedTable||0),db.tables.length-1);
    const t=db.tables[selectedTable]||db.tables[0];
    const tableOpts=db.tables.map((tb,i)=>`<option value="${i}" ${i===selectedTable?'selected':''}>${esc(tb.name||('Աղյուսակ '+(i+1)))}</option>`).join('');
    content.innerHTML=`<div class="card"><div class="toolbar">
      <button type="button" onclick="kmReportsBack()">← Վերադարձ</button>
      <button type="button" onclick="kmTableAdd()">+ Աղյուսակ</button>
      <button type="button" onclick="kmTableRemoveTable()">− Պակասեցնել</button>
      <label>Աղյուսակ <select id="kmTablePick">${tableOpts}</select></label>
      <label>Անվանում <input id="kmTableName" type="text" value="${esc(t.name||'Աղյուսակ')}" style="width:150px"></label>
      <button type="button" onclick="kmTableAddCol()">＋ Սյուն</button>
      <button type="button" onclick="kmTableRemoveCol()">− Սյուն</button>
      <button type="button" onclick="kmTableAddRow()">＋ Տող</button>
      <button type="button" onclick="kmTableRemoveRow()">− Տող</button>
    </div><h3>${esc(t.name||'Աղյուսակ')}</h3>
    <div class="gridwrap"><table class="grid"><thead><tr>${(t.headers||[]).map((h,ci)=>`<th><input data-th="${ci}" value="${esc(h)}" style="width:100%;min-width:60px"></th>`).join('')}</tr></thead>
    <tbody>${(t.rows||[]).map((row,ri)=>`<tr>${row.map((cell,ci)=>`<td><input data-tr="${ri}" data-tc="${ci}" value="${esc(cell)}"></td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`;
    page='tables';
    document.getElementById('pageTitle').textContent='Աղյուսակներ';
    const pick=document.getElementById('kmTablePick');
    if(pick)pick.onchange=()=>{selectedTable=+pick.value;tablesPage();};
    const nameInp=document.getElementById('kmTableName');
    if(nameInp){
      nameInp.onchange=async()=>{
        const t2=db.tables[selectedTable];
        t2.name=String(nameInp.value||'').trim()||('Աղյուսակ '+(selectedTable+1));
        await save(true);tablesPage();
      };
    }
    content.querySelectorAll('input[data-th]').forEach(inp=>{
      inp.onchange=async()=>{
        const t2=db.tables[selectedTable];
        t2.headers[+inp.dataset.th]=inp.value;
        await save(true);
      };
    });
    content.querySelectorAll('input[data-tr]').forEach(inp=>{
      inp.onchange=async()=>{
        const t2=db.tables[selectedTable];
        t2.rows[+inp.dataset.tr][+inp.dataset.tc]=inp.value;
        await save(true);
      };
    });
  };
  window.kmTableAdd=function(){db.tables.push({name:'Աղյուսակ '+(db.tables.length+1),headers:['A','B'],rows:[['','']]});selectedTable=db.tables.length-1;tablesPage();save(true);};
  window.kmTableAddCol=function(){const t=db.tables[selectedTable];if(!t)return;t.headers.push('Սյունակ');t.rows.forEach(r=>r.push(''));tablesPage();save(true);};
  window.kmTableRemoveCol=function(){
    const t=db.tables[selectedTable];
    if(!t||t.headers.length<=1){toastMsg('Պետք է առնվազն 1 սյունակ');return;}
    t.headers.pop();
    t.rows.forEach(r=>r.pop());
    tablesPage();save(true);
  };
  window.kmTableAddRow=function(){const t=db.tables[selectedTable];if(!t)return;t.rows.push(t.headers.map(()=>''));tablesPage();save(true);};
  window.kmTableRemoveRow=function(){
    const t=db.tables[selectedTable];
    if(!t||t.rows.length<=1){toastMsg('Պետք է առնվազն 1 տող');return;}
    t.rows.pop();
    tablesPage();save(true);
  };
  window.kmTableRemoveTable=function(){
    if(db.tables.length<=1){toastMsg('Պետք է առնվազն 1 աղյուսակ');return;}
    if(!confirm('Ջնջե՞լ ընտրված աղյուսակը'))return;
    db.tables.splice(selectedTable,1);
    selectedTable=Math.min(selectedTable,db.tables.length-1);
    tablesPage();save(true);
  };

  /* ---- Full batch PDF ---- */
  window.kmBatchPrintAllGraphsFull=async function(){
    if(typeof kmPrintDocHtml!=='function'){toastMsg('Print engine missing','error');return;}
    const wm=window.kmPrintWatermark||'';
    const parts=[];
    function wrapHtml(inner){
      const wmark=wm?`<div style="position:fixed;inset:0;pointer-events:none;opacity:.12;font-size:72pt;font-weight:900;display:flex;align-items:center;justify-content:center;transform:rotate(-25deg)">${esc(wm)}</div>`:'';
      return inner.replace('</body>',wmark+'</body>');
    }
    const s=db.schedule;
    const mainPeople=typeof kmMainSelectedPeople==='function'?kmMainSelectedPeople():(db.people||[]);
    parts.push(wrapHtml(kmPrintDocHtml(String(s.name||'Հիմնական'),+s.month,+s.year,mainPeople,(p,d)=>((s.rows&&s.rows[kmPrintPersonName(p)]||{})[d]||''),undefined,s)));
    (db.dutyTypes||[]).forEach((name,i)=>{
      const key='duty_'+i,sch=(db.dutyTypeSchedules||{})[key];
      if(!sch)return;
      if(+sch.month!==+s.month||+sch.year!==+s.year)return;
      const people=typeof kmDutySelectedPeople==='function'?kmDutySelectedPeople(sch):(db.people||[]);
      parts.push(wrapHtml(kmPrintDocHtml(String(name),+sch.month,+sch.year,people,(p,d)=>{
        const n=kmPrintPersonName(p);
        const a=sch.assignments&&sch.assignments[n];
        return a&&Object.keys(a).map(Number).includes(d)?'x':'';
      },undefined,sch)));
    });
    const qr=window.kmDocQrDataUrl||'';
    const qrBlock=qr?`<div style="position:fixed;bottom:4mm;right:4mm"><img src="${qr}" width="48" height="48" alt="QR"></div>`:'';
    const combined='<!doctype html><html><head><meta charset="utf-8"><style>.kmBatchPage{page-break-after:always}</style></head><body>'+
      parts.map((h,idx)=>`<div class="kmBatchPage">${h.replace(/<\/?html[^>]*>|<\/?head[^>]*>|<\/?body[^>]*>/gi,'')}${idx===parts.length-1?qrBlock:''}</div>`).join('')+
      '</body></html>';
    try{
      if(window.kmNative&&window.kmNative.export&&window.kmNative.export.batchPrintPdf){
        const r=await window.kmNative.export.batchPrintPdf({title:'KM_All_Graphs',html:combined,settings:{pageSize:'A4',orientation:'landscape'}});
        if(r.cancelled)return;
        toastMsg('Խմբային PDF՝ '+r.path);
      }else if(typeof printScheduleTable==='function'){
        printScheduleTable();
      }
    }catch(e){toastMsg(e.message||'Խմբային PDF սխալ','error');}
  };

  /* ---- Settings page ---- */
  window.kmOpenSettings=async function(){
    if(typeof window.kmCanAdmin==='function'&&!window.kmCanAdmin()){toastMsg('Կարգավորումներ — միայն admin','error');return;}
    const s=window.kmNative&&window.kmNative.settings?await window.kmNative.settings.get():{};
    const backBar=typeof window.kmBackToolbar==='function'?window.kmBackToolbar('kmReportsBack()'):'';
    content.innerHTML=`${backBar}<div class="card"><h3>Կարգավորումներ</h3>
      <label>Ավտոպահուստ (ժամ) <input id="kmStBackupH" type="number" min="1" value="${s.autoBackupHours||24}"></label><br><br>
      <label>Ավտոկողպում (րոպե, 0 = անջատված) <input id="kmStLock" type="number" min="0" value="${s.autoLockMinutes||0}"></label><br><br>
      <label>Խելացի պլան՝ նվազագույն բաց <input id="kmStGap" type="number" min="1" value="${s.smartPlanMinGap||3}"></label><br><br>
      <label>Խելացի պլան՝ առավելագույնը ամսում <input id="kmStMax" type="number" min="1" max="5" value="${Math.min(5,s.smartPlanMaxPerMonth||5)}"></label><br><br>
      <label><input id="kmStEqual" type="checkbox" ${s.smartPlanEqualize!==false?'checked':''}> Հավասար բաշխում</label><br><br>
      <label>Ջրանիշ տպման <input id="kmStWm" type="text" value="${esc(s.watermark||'')}"></label><br><br>
      <label><input id="kmStDark" type="checkbox" ${s.darkMode?'checked':''}> Մուգ ռեժիմ</label><br><br>
      <label><input id="kmStGpu" type="checkbox" ${s.forceSoftwareRender?'checked':''}> Ծրագրային նկարում (GPU անջատված)</label><br><br>
      <label>Պահուստի հիշեցում (օր) <input id="kmStRem" type="number" min="0" value="${s.backupReminderDays||7}"></label>
      <hr style="margin:18px 0;border:0;border-top:1px solid #d7e6ec">
      <h4 style="margin:0 0 10px;color:#0d4a66">Օգնական բոտ · Offline Local LLM</h4>
      <p class="muted" style="margin:0 0 10px;font-size:12.5px;line-height:1.45">
        Ամպային OpenAI/Claude-ը <b>offline չի աշխատում</b>։ Զորամասի ռեժիմի համար օգտագործեք տեղական մոդել՝
        <b>Ollama</b> (Llama&nbsp;3 / Mistral / Phi-3) կամ LM Studio՝
        <code>http://localhost:11434</code> / <code>http://127.0.0.1:11434/v1</code>։
        Offline RAG-ը KM գիտելիքից է (knowledge.db + TF-IDF)։ Անձնական ցուցակներ չեն ուղարկվում։
      </p>
      <div class="muted" style="margin:0 0 12px;font-size:12px;line-height:1.5;padding:10px 12px;background:#f4f9fb;border:1px solid #d7e6ec;border-radius:10px">
        <b>Տեղադրում (մեկ անգամ).</b><br>
        1) Տեղադրեք <a href="https://ollama.com" target="_blank" rel="noopener">Ollama</a><br>
        2) CMD՝ <code>ollama pull llama3</code> · <code>ollama pull gemma2</code> · <code>ollama pull aya-expanse</code><br>
        3) Ստուգեք՝ «Ստուգել Local LLM» → ընտրեք մոդելը ցանկից → Պահպանել<br>
        <b>Ապարատ.</b> ցանկալի՝ NVIDIA GPU 8–12GB VRAM, RAM 16GB+ (32GB՝ հարմար)։ CPU-ով էլ կաշխատի՝ ավելի դանդաղ։
      </div>
      <label><input id="kmHbLlmOn" type="checkbox" ${s.helpBotLlmEnabled!==false?'checked':''}> Միացնել AI / LLM</label><br><br>
      <label><input id="kmHbLlmLocalOnly" type="checkbox" ${s.helpBotLlmLocalOnly!==false&&(s.helpBotLlmProvider||'openai_compat')==='openai_compat'?'checked':''}> Միայն offline local (Ollama) — cloud Gemini/OpenAI անջատել</label><br><br>
      <label>Մատակարար
        <select id="kmHbLlmProv">
          <option value="gemini" ${s.helpBotLlmProvider==='gemini'?'selected':''}>Cloud · Google Gemini (ազատ զրույց)</option>
          <option value="openai_compat" ${(s.helpBotLlmProvider||'openai_compat')==='openai_compat'?'selected':''}>Local · Ollama / LM Studio / Llama.cpp</option>
          <option value="openai" ${s.helpBotLlmProvider==='openai'?'selected':''}>Cloud · OpenAI</option>
          <option value="anthropic" ${s.helpBotLlmProvider==='anthropic'?'selected':''}>Cloud · Anthropic Claude</option>
        </select>
      </label><br><br>
      <label>Մոդել
        <select id="kmHbLlmModel" style="min-width:280px">
          ${(function(){
            const cur=String(s.helpBotLlmModel||(s.helpBotLlmProvider==='gemini'?'gemini-3.6-flash':'llama3:latest')).trim();
            const seed=s.helpBotLlmProvider==='gemini'
              ?['gemini-3.6-flash','gemini-3.5-flash','gemini-2.0-flash']
              :['llama3:latest','gemma2:latest','aya-expanse:latest'];
            const seen={};
            const list=[];
            function add(m){
              const t=String(m||'').trim();
              if(!t||seen[t.toLowerCase()])return;
              seen[t.toLowerCase()]=1;
              list.push(t);
            }
            add(cur);
            seed.forEach(add);
            return list.map(function(m){
              return '<option value="'+esc(m)+'"'+(m===cur?' selected':'')+'>'+esc(m)+'</option>';
            }).join('');
          })()}
        </select>
      </label>
      <p class="muted" style="margin:4px 0 12px;font-size:12px">Տեղական մոդելներ՝ <code>llama3</code>, <code>gemma2</code>, <code>aya-expanse</code>։ «Ստուգել Local LLM»-ը լրացնում է Ollama-ում տեղադրվածները։</p>
      <div class="muted" style="margin:0 0 12px;font-size:12px;line-height:1.5;padding:10px 12px;background:#f4f9fb;border:1px solid #d7e6ec;border-radius:10px">
        <b>Gemini Key Pool</b> — ${Number.isFinite(s.helpBotGeminiKeyCount)?s.helpBotGeminiKeyCount:5} բանալի (կենտրոնացված <code>km_gemini_config.js</code>) · Round-Robin<br>
        <b>Turn limit</b> — ${Number(s.helpBotTurnsPerDayMax||s.helpBotTurnsPerDay||700000)} / օր · սեսիա (700000)
      </div>
      <label>Local Base URL <input id="kmHbLlmBase" type="text" style="min-width:280px" value="${esc(s.helpBotLlmBaseUrl||'http://localhost:11434')}" placeholder="http://localhost:11434"></label><br><br>
      <label><input id="kmHbLlmStats" type="checkbox" ${s.helpBotLlmShareStats!==false?'checked':''}> Offline RAG՝ ագրեգացված վիճակագրություն (քանակներ, ոչ անձեր)</label><br><br>
      <label>Աջակցման webhook URL (optional, ինտերնետ — ոչ Ollama հասցեն) <input id="kmHbEscHook" type="text" style="min-width:280px" value="${esc((s.helpBotEscalateWebhook&&!/localhost:11434|127\.0\.0\.1:11434/i.test(s.helpBotEscalateWebhook))?s.helpBotEscalateWebhook:'')}" placeholder="https://…"></label><br><br>
      <p id="kmHbLlmProbe" class="muted" style="margin:0 0 10px;font-size:12.5px">Local LLM կարգավիճակ՝ դեռ չի ստուգվել։</p>
      <div class="toolbar" style="margin-bottom:8px">
        <button type="button" onclick="kmHelpBotProbeLocalLlm()">Ստուգել Local LLM</button>
        <button type="button" onclick="kmHelpBotOpenTicketsAdmin()">Աջակցման հայտեր</button>
        <button type="button" onclick="kmHelpBotOpenFeedbackAdmin()">Feedback / Fine-tune</button>
      </div>
      <div class="toolbar" style="margin-top:16px">
        <button type="button" onclick="kmSaveSettings()">Պահպանել</button>
        <button type="button" onclick="kmEncryptedBackupExport()">Գաղտնագրված պահուստ</button>
        <button type="button" onclick="kmEncryptedBackupImport()">Ներմուծել գաղտնագրվածը</button>
        <button type="button" onclick="kmPreviewDarkMode()">Նախադիտել մուգը</button>
      </div>
      <hr style="margin:22px 0;border:0;border-top:1px solid #e8c4c4">
      <h4 style="margin:0 0 8px;color:#8b1a1a">Տվյալների մաքրում</h4>
      <p class="muted" style="margin:0 0 12px;font-size:12.5px;line-height:1.45">
        <b>Factory Reset</b> — մաքրում է օգնական բոտի զրույցերի պատմությունը, LAN sync կարգավորումները, BotRag/KM_Net cache-ը և ժամանակավոր ֆայլերը։
        <b>Չի ջնջում</b> գրաֆիկի հիմնական տվյալները (<code>database_snapshot.json</code>) և BotKnowledge գիտելիքի բազան։
      </p>
      <div class="toolbar">
        <button type="button" style="background:#b42318;color:#fff;border-color:#8b1a1a" onclick="kmFactoryReset()">Ջնջել բոլոր տվյալները (Factory Reset)</button>
      </div></div>`;
    page='settings';
    document.getElementById('pageTitle').textContent='Կարգավորումներ';
    if(typeof window.kmApplyRoleGuard==='function')window.kmApplyRoleGuard();
    const provEl=document.getElementById('kmHbLlmProv');
    if(provEl){
      provEl.addEventListener('change',function(){
        if(typeof window.kmHelpBotFillLlmModels==='function'){
          window.kmHelpBotFillLlmModels({provider:provEl.value});
        }
      });
    }
    if(typeof window.kmHelpBotProbeLocalLlm==='function'){
      try{ window.kmHelpBotProbeLocalLlm({silent:true}); }catch(eProbe){}
    }
  };

  window.kmPreviewDarkMode=function(){
    const el=document.getElementById('kmStDark');
    kmToggleDarkMode(el?!!el.checked:false);
  };

  window.kmFactoryReset=async function(){
    if(typeof window.kmCanAdmin==='function'&&!window.kmCanAdmin()){toastMsg('Factory Reset — միայն admin','error');return;}
    if(!window.kmNative||!window.kmNative.app||typeof window.kmNative.app.factoryReset!=='function'){
      toastMsg('Անհասանելի (միայն desktop KM)','error');return;
    }
    const msg1='Սա կմաքրի օգնական բոտի զրույցերի պատմությունը, LAN sync-ը, cache-ը և ժամանակավոր ֆայլերը։\n\nԳրաֆիկի հիմնական տվյալները և BotKnowledge-ը չեն ջնջվի։\n\nՇարունակե՞լ։';
    if(!confirm(msg1))return;
    if(!confirm('Վստա՞հ եք։ Այս գործողությունը հնարավոր չէ հետարկել։'))return;
    try{
      toastMsg('Մաքրում…');
      const r=await window.kmNative.app.factoryReset({
        adminToken:(function(){try{return localStorage.getItem('km_admin_token')||'';}catch(eT){return '';}})()
      });
      if(!r||r.ok===false)throw new Error((r&&r.error)||'factory_reset_failed');
      try{
        if(window.KMHelpBotLLM&&typeof window.KMHelpBotLLM.invalidateConfig==='function') window.KMHelpBotLLM.invalidateConfig();
      }catch(eHb){}
      toastMsg('Տվյալները մաքրվեցին — վերագործարկում…');
      if(window.kmNative.app.relaunch) await window.kmNative.app.relaunch();
    }catch(e){toastMsg((e&&e.message)||String(e),'error');}
  };

  window.kmSaveSettings=async function(){
    if(!window.kmNative||!window.kmNative.settings){toastMsg('Միայն desktop KM');return;}
    try{
      const llmEl=document.getElementById('kmHbLlmOn');
      const patch={
        autoBackupHours:Number(document.getElementById('kmStBackupH').value)||24,
        autoLockMinutes:Number(document.getElementById('kmStLock').value)||0,
        smartPlanMinGap:Number(document.getElementById('kmStGap').value)||3,
        smartPlanMaxPerMonth:Math.min(5,Math.max(1,Number(document.getElementById('kmStMax').value)||5)),
        smartPlanEqualize:document.getElementById('kmStEqual').checked,
        watermark:document.getElementById('kmStWm').value,
        darkMode:document.getElementById('kmStDark').checked,
        forceSoftwareRender:document.getElementById('kmStGpu').checked,
        backupReminderDays:Number(document.getElementById('kmStRem').value)||7,
        helpBotLlmEnabled:!!(llmEl&&llmEl.checked),
        helpBotLlmLocalOnly:!!(document.getElementById('kmHbLlmLocalOnly')&&document.getElementById('kmHbLlmLocalOnly').checked),
        helpBotLlmProvider:(document.getElementById('kmHbLlmProv')||{}).value||'openai_compat',
        helpBotLlmModel:String((document.getElementById('kmHbLlmModel')||{}).value||'llama3').trim()||'llama3',
        helpBotLlmBaseUrl:String((document.getElementById('kmHbLlmBase')||{}).value||'http://localhost:11434').trim()||'http://localhost:11434',
        helpBotLlmShareStats:!!(document.getElementById('kmHbLlmStats')&&document.getElementById('kmHbLlmStats').checked),
        helpBotEscalateWebhook:(function(){
          const w=String((document.getElementById('kmHbEscHook')||{}).value||'').trim();
          return /localhost:11434|127\.0\.0\.1:11434/i.test(w)?'':w;
        })()
      };
      await window.kmNative.settings.set(patch);
      try{ if(window.KMHelpBotLLM&&typeof window.KMHelpBotLLM.invalidateConfig==='function') window.KMHelpBotLLM.invalidateConfig(); }catch(eHb){}
      window.kmAutoLockMinutes=patch.autoLockMinutes;
      window.kmPrintWatermark=patch.watermark;
      if(window.kmNative.renderPolicy)await window.kmNative.renderPolicy.setForceSoftwareRender(patch.forceSoftwareRender);
      kmToggleDarkMode(patch.darkMode);
      toastMsg(patch.helpBotLlmEnabled
        ? 'Կարգավորումները պահպանվեցին · AI / LLM միացված է'
        : 'Կարգավորումները պահպանվեցին · AI / LLM անջատված է');
    }catch(e){toastMsg((e&&e.message)||String(e),'error');}
  };

  window.kmEncryptedBackupExport=async function(){
    if(!window.kmCanEdit()){toastMsg('Դիտորդի իրավունք','error');return;}
    const pw=prompt('Գաղտնագրման գաղտնաբառ');if(!pw)return;
    if(!window.kmNative||!window.kmNative.backup||!window.kmNative.backup.exportEncrypted){toastMsg('Անհասանելի','error');return;}
    try{
      if(typeof save==='function')await save(true);
      if(window.kmNative.persistence&&typeof window.kmNative.persistence.writeSnapshot==='function'){
        var persistDb = (typeof db !== 'undefined' && db) ? db : {};
        try {
          if (typeof window.kmBuildSlimPersistDb === 'function') persistDb = window.kmBuildSlimPersistDb(persistDb);
        } catch (_eSlim) {}
        await window.kmNative.persistence.writeSnapshot(typeof KEY!=='undefined'?KEY:'km_db_v1',JSON.stringify(persistDb));
      }
      const r=await window.kmNative.backup.exportEncrypted(pw);
      toastMsg('Գաղտնագրված պահուստ՝ '+(r&&r.path?r.path:'OK'));
    }catch(e){toastMsg((e&&e.message)||String(e),'error');}
  };
  window.kmEncryptedBackupImport=async function(){
    if(typeof window.kmCanAdmin==='function'&&!window.kmCanAdmin()){toastMsg('Միայն ադմինիստրատոր','error');return;}
    const pw=prompt('Ապագաղտնագրման գաղտնաբառ');if(!pw)return;
    if(!window.kmNative||!window.kmNative.backup||!window.kmNative.backup.importEncrypted){toastMsg('Անհասանելի','error');return;}
    const inp=document.createElement('input');inp.type='file';inp.accept='.kmbak,.json';
    inp.onchange=async()=>{
      const f=inp.files[0];if(!f)return;
      try{
        const buf=await f.arrayBuffer();
        await window.kmNative.backup.importEncrypted({password:pw,bytes:Array.from(new Uint8Array(buf))});
        alert('Ներմուծվեց։ Վերագործարկեք KM-ը։');location.reload();
      }catch(e){toastMsg((e&&e.message)||String(e),'error');}
    };
    inp.click();
  };

  window.kmCheckBackupReminder=async function(){
    try{
      if(!window.kmNative||!window.kmNative.settings)return;
      const s=await window.kmNative.settings.get();
      const days=Number(s.backupReminderDays)||0;if(!days)return;
      const last=s.lastBackupAt?new Date(s.lastBackupAt).getTime():0;
      if(Date.now()-last>days*86400000)kmNotify('Պահուստի հիշեցում — '+days+'+ օր է անցել','warn');
    }catch(e){}
  };

  /* ---- QR for print ---- */
  function buildQrDataUrl(text){
    if(typeof window.kmMakeQrDataUrl==='function'){
      try{return window.kmMakeQrDataUrl(String(text||'KM'));}catch(e){}
    }
    try{
      const c=document.createElement('canvas');c.width=c.height=64;
      const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,64,64);
      ctx.fillStyle='#000';ctx.font='6px monospace';
      const hash=text.split('').reduce((a,ch)=>((a<<5)-a+ch.charCodeAt(0))|0,0);
      for(let i=0;i<64;i++)for(let j=0;j<64;j++)if(((hash+i*j)&7)===0)ctx.fillRect(i,j,1,1);
      return c.toDataURL('image/png');
    }catch(e){return '';}
  }

  function patchDutyTypesPlanning(){
    const orig=window.openDutyTypesSection;
    if(typeof orig!=='function'||window.openDutyTypesSection.__kmPlan)return;
    window.openDutyTypesSection=function(){
      orig.apply(this,arguments);
      const c=document.getElementById('content');
      if(!c||c.querySelector('#kmDutyPlanBlock'))return;
      c.insertAdjacentHTML('beforeend',`<div class="card" id="kmDutyPlanBlock">
        <h3>Պլանավորում</h3>
        <p class="muted">Պլանավորման գործիքները այս բաժնում են (նախկին «Պլանավորում» խումբը)։</p>
        <div class="toolbar">
          <button type="button" onclick="kmOpenFutureSchedules()">Ապագա պլաններ</button>
          <button type="button" onclick="kmListSubstitutions()">Փոխարինումներ</button>
          <button type="button" onclick="kmRememberAndOpen({kind:'page',value:'schedule'},()=>{page='schedule';render();})">Վերակարգի պլանավորում</button>
        </div>
      </div>`);
    };
    window.openDutyTypesSection.__kmPlan=true;
  }

  function patchRenderLibrary(){
    const orig=window.render;
    if(typeof orig!=='function'||window.render.__kmLib)return;
    window.render=function(){
      const p=(typeof window.page!=='undefined'&&window.page!=='')?window.page:((typeof page!=='undefined')?page:'');
      if(p==='archive'){
        if(typeof page!=='undefined') page='library';
        window.page='library';
        window.kmLibSection='archive';
      }
      if((p==='library'||window.page==='library')&&typeof window.libraryPage==='function'){
        if(typeof window.kmSetActiveLibNav==='function') window.kmSetActiveLibNav(window.kmLibSection||'files');
        return window.libraryPage(window.kmLibSection);
      }
      return orig.apply(this,arguments);
    };
    window.render.__kmLib=true;
  }

  function patchRenderPages(){
    patchRenderLibrary();
  }

  function overrideBatchPrint(){
    window.kmBatchPrintAllGraphs=window.kmBatchPrintAllGraphsFull;
  }

  document.addEventListener('DOMContentLoaded',async()=>{
    ensureDbFields();
    if(typeof window.normalize==='function'&&!window.normalize.__kmV3){
      const _n=window.normalize;
      window.normalize=function(){_n();ensureDbFields();};
      window.normalize.__kmV3=true;
    }
    patchHome();
    patchDutyTypesPlanning();
    patchRenderPages();
    overrideBatchPrint();
    try{
      if(window.kmNative&&window.kmNative.settings){
        const s=await window.kmNative.settings.get();
        window.kmPrintWatermark=s.watermark||'';
        setTimeout(function(){
          try{window.kmDocQrDataUrl=buildQrDataUrl('KM-006.2.67-'+new Date().toISOString().slice(0,10));}catch(e){}
        },1800);
      }
    }catch(e){}
    setTimeout(kmCheckBackupReminder,3000);
  });
})();
