/* KM license gate + login (username/password) */
/* KM_OTC_GENERATE_V1 KM_LICENSE_KOD_CHOICE_V1 */
(function(){
  'use strict';

  function esc(s){return typeof window.esc==='function'?window.esc(s):String(s??'');}
  function toastOk(msg){
    if(typeof toast==='function')toast(msg);
    else if(typeof toastMsg==='function')toastMsg(msg);
  }
  function toastErr(msg){
    if(typeof toast==='function')toast(msg,'error');
    else if(typeof toastMsg==='function')toastMsg(msg,'error');
    else alert(msg);
  }

  window.kmLicenseBypass=false;
  var licPage={data:null,filter:'all',q:'',sort:'at'};
  var licOpenSeq=0;

  function t(s){
    return typeof window.kmTranslateUI==='function'?window.kmTranslateUI(s):String(s??'');
  }

  async function licenseStatus(){
    if(!window.kmNative||!window.kmNative.license)return {needsActivation:true,valid:false,expired:false};
    return window.kmNative.license.status();
  }

  function blockApp(messageHtml,htmlExtra){
    document.body.classList.add('km-license-blocked');
    let el=document.getElementById('kmLicenseGate');
    if(!el){
      el=document.createElement('div');
      el.id='kmLicenseGate';
      el.style.cssText='position:fixed;inset:0;z-index:500000;background:transparent;display:flex;align-items:center;justify-content:center;padding:20px;-webkit-transform:translate3d(0,0,0);transform:translate3d(0,0,0)';
      document.body.appendChild(el);
    }
    el.innerHTML=`<div style="background:#fff;border-radius:12px;padding:28px;max-width:440px;width:100%;box-shadow:0 8px 32px rgba(0,0,0,.35)">
      <div style="text-align:center;margin:0 0 14px">
        <img src="assets/km_logo_square.jpg?v=006.5.113" alt="KM" style="width:92px;height:92px;object-fit:cover;border-radius:50%;background:#0b1a33;box-shadow:0 6px 16px rgba(0,0,0,.28)">
      </div>
      <h2 style="margin:0 0 12px;font-size:20px">KM ակտիվացում</h2>
      <p style="margin:0 0 16px;color:#445;line-height:1.5">${messageHtml||''}</p>
      ${htmlExtra||''}
    </div>`;
    el.style.display='flex';
    if(typeof window.kmForceUiPaint==='function')window.kmForceUiPaint(el);
  }

  function unblockApp(){
    document.body.classList.remove('km-license-blocked');
    document.getElementById('kmLicenseGate')?.remove();
  }

  window.kmActivateLicense=async function(code){
    if(!window.kmNative||!window.kmNative.license){alert('Միայն desktop KM');return false;}
    try{
      const r=await window.kmNative.license.activate(String(code||'').trim());
      if(r&&r.ok===false){
        toastErr(r.error||'Սխալ ակտիվացման կոդ');
        return false;
      }
      if(r&&(r.valid||r.universalUser||r.ok)){
        if(window.kmNative.license.clearPendingCode)await window.kmNative.license.clearPendingCode();
        unblockApp();
        if(r.universalUser)toastOk('Օգտատեր մուտքը բացված է');
        else if(r.expiresAt)toastOk('Ակտիվացված է մինչև '+new Date(r.expiresAt).toLocaleDateString('hy-AM'));
        else toastOk('Ակտիվացված է');
        if(typeof window.kmEnsureOwnerVault==='function')await window.kmEnsureOwnerVault();
        return true;
      }
      toastErr((r&&r.error)||'Սխալ ակտիվացման կոդ');
    }catch(e){
      var msg=String((e&&e.message)||e||'');
      msg=msg.replace(/^Error invoking remote method '[^']+':\s*/i,'').replace(/^Error:\s*/i,'').trim();
      toastErr(msg||'Սխալ ակտիվացման կոդ');
    }
    return false;
  };

  window.kmFillPendingActivationCode=async function(inputEl){
    if(!window.kmNative||!window.kmNative.license||!window.kmNative.license.getPendingCode)return false;
    try{
      const st=await window.kmNative.license.status();
      if(st&&st.valid)return false;
      const r=await window.kmNative.license.getPendingCode();
      if(r&&r.code){
        const targets=[];
        if(inputEl)targets.push(inputEl);
        const loginInp=document.getElementById('kmLoginUserCode');
        const actInp=document.getElementById('kmActCode');
        if(loginInp&&!targets.includes(loginInp))targets.push(loginInp);
        if(actInp&&!targets.includes(actInp))targets.push(actInp);
        targets.forEach(el=>{
          el.value=r.code;
          const wrap=document.getElementById('kmLoginUserCodeWrap');
          if(wrap)wrap.style.display='block';
        });
        toastOk('Կոդը տեղադրված է');
        return true;
      }
    }catch(e){}
    return false;
  };

  async function showActivationGate(){
    blockApp('Մուտք գործելու համար մուտքագրեք մեկանգամյա ակտիվացման կոդը։ <b>kod.cmd</b> — 1 տարի, <b>kod3.cmd</b> — 3 ամիս (կոդ՝ AA00-UU00)։',`
      <label style="display:block;margin-bottom:12px"><span>Ակտիվացման կոդ</span>
      <div class="kmCodeReveal" style="position:relative;margin-top:6px">
        <input id="kmActCode" type="password" placeholder="" autocomplete="off" spellcheck="false" style="width:100%;padding:10px 44px 10px 10px;font-size:16px;letter-spacing:.12em;text-transform:uppercase;box-sizing:border-box">
        <button type="button" id="kmActCodeEye" class="kmCodeRevealBtn" title="Ցույց տալ կոդը" aria-label="Ցույց տալ կոդը" aria-pressed="false" style="position:absolute;right:4px;top:50%;transform:translateY(-50%);width:36px;height:36px;border:0;background:transparent;border-radius:8px;cursor:pointer;color:#4a5a6a;padding:0;display:flex;align-items:center;justify-content:center"></button>
      </div></label>
      <button type="button" id="kmActBtn" class="primary" style="width:100%;padding:10px">Ակտիվացնել</button>
      <p style="margin:14px 0 0;font-size:12px;color:#667">Նոր կոդ՝ <b>kod.cmd</b> (1 տարի) կամ <b>kod3.cmd</b> (3 ամիս)</p>`);
    const inp=document.getElementById('kmActCode');
    const eye=document.getElementById('kmActCodeEye');
    const btn=document.getElementById('kmActBtn');
    (function bindActEye(){
      function svg(open){
        if(open)return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/><path d="M3 3l18 18"/></svg>';
        return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>';
      }
      if(!inp||!eye)return;
      eye.innerHTML=svg(false);
      eye.onclick=function(e){
        if(e&&e.preventDefault)e.preventDefault();
        const show=inp.type==='password';
        inp.type=show?'text':'password';
        eye.innerHTML=svg(show);
        eye.setAttribute('aria-pressed',show?'true':'false');
        eye.title=show?'Թաքցնել կոդը':'Ցույց տալ կոդը';
        eye.setAttribute('aria-label',eye.title);
        try{inp.focus();}catch(err){}
      };
    })();
    if(typeof window.kmFillPendingActivationCode==='function')await window.kmFillPendingActivationCode(inp);
    const run=async()=>{
      if(!inp.value.trim()){alert('Մուտքագրեք կոդ');return;}
      btn.disabled=true;
      const ok=await kmActivateLicense(inp.value);
      btn.disabled=false;
      if(ok&&typeof kmEnsureSecurity==='function')await kmEnsureSecurity(true);
      else if(ok&&typeof window.kmShowDualLogin==='function')await window.kmShowDualLogin();
    };
    btn.onclick=run;
    inp.onkeydown=e=>{if(e.key==='Enter')run();};
    inp.focus();
  }

  async function showExpiredGate(st){
    blockApp('Արտոնագրի ժամկետը ավարտվել է ('+(st.expiresAt?new Date(st.expiresAt).toLocaleDateString('hy-AM'):'')+')։ Մուտք գործել հնարավոր չէ մինչև ադմինիստրատորը նոր կոդ կիրառի (kod.cmd կամ kod3.cmd)։',`
      <div style="border-top:1px solid #dde3ea;margin-top:8px;padding-top:16px">
        <p style="margin:0 0 10px;font-weight:700">Administrator մուտք (սահմանափակում չկա)</p>
        <label style="display:block;margin-bottom:8px"><span>Օգտանուն</span>
        <input id="kmExpUser" type="text" style="width:100%;margin-top:4px;padding:8px"></label>
        <label style="display:block;margin-bottom:12px"><span>Գաղտնաբառ</span>
        <input id="kmExpPw" type="password" style="width:100%;margin-top:4px;padding:8px"></label>
        <button type="button" id="kmExpAdminBtn" style="width:100%;padding:10px">Admin մուտք</button>
        <p id="kmExpErr" style="color:#a43b3b;min-height:18px;margin:8px 0 0"></p>
      </div>`);
    document.getElementById('kmExpAdminBtn').onclick=async()=>{
      const user=document.getElementById('kmExpUser').value;
      const pw=document.getElementById('kmExpPw').value;
      const err=document.getElementById('kmExpErr');
      const r=window.kmNative.security.loginAdmin
        ?await window.kmNative.security.loginAdmin({username:user,password:pw})
        :await window.kmNative.security.verify({username:user,password:pw});
      if(!r.ok||!r.isAdmin){err.textContent='Սխալ admin մուտք';return;}
      if(r.token){
        localStorage.setItem('km_admin_token',r.token);
        if(r.expiresAt)localStorage.setItem('km_admin_expires',r.expiresAt);
      }
      window.kmUserRole='admin';
      window.kmRoleUnlocked=true;
      sessionStorage.setItem('km_auth_ok','1');
      sessionStorage.setItem('km_auth_role','admin');
      sessionStorage.setItem('km_auth_mode','admin');
      if(typeof window.kmApplyRoleGuard==='function')window.kmApplyRoleGuard();
      unblockApp();
      toastOk('Admin մուտք — կիրառեք kod.cmd նոր ակտիվացման համար');
      if(r.mustChangePassword && typeof window.kmPromptFirstPasswordChange==='function'){
        window.kmPromptFirstPasswordChange();
      }
      if(typeof render==='function')render();
    };
  }

  window.kmEnsureLicense=async function(){
    if(!window.kmNative||!window.kmNative.license)return true;
    const st=await licenseStatus();
    window.kmLicenseStatus=st;
    maybeWarnSoon(st);
    if(typeof window.kmEnsureOwnerVault==='function')await window.kmEnsureOwnerVault();
    if(st&&(st.valid||st.userAccess))return true;
    try{
      const tok=localStorage.getItem('km_admin_token');
      if(tok&&window.kmNative.security&&typeof window.kmNative.security.verifySession==='function'){
        const s=await window.kmNative.security.verifySession(tok);
        if(s&&s.ok&&s.isAdmin)return true;
      }
    }catch(eSess){}
    return false;
  };

  function vaultKeyRow(id,label,ph){
    return '<label style="display:block;margin-bottom:10px"><span>'+label+'</span>'+
      '<input id="'+id+'" type="password" autocomplete="new-password" spellcheck="false" placeholder="'+(ph||'')+'" style="width:100%;margin-top:4px;padding:8px;box-sizing:border-box"></label>';
  }

  async function showVaultSetupGate(st){
    blockApp(
      (st&&st.message)||'Սեփականատիրոջ գաղտնի բանալիներ (L2–L4)։ Պահվում են միայն UserData ֆայլային բազայում՝ ոչ Setup-ում։',
      vaultKeyRow('kmVaultL2','L2 — սեփականատիրոջ գլխավոր բանալի','առնվազն 10 նիշ')+
      vaultKeyRow('kmVaultL3','L3 — հակակրկնօրինակման բանալի','տարբեր L2-ից')+
      vaultKeyRow('kmVaultL4','L4 — վերականգնում / AI կրկնօրինակ','տարբեր L2/L3-ից')+
      '<p style="font-size:12px;color:#667;margin:0 0 12px">Այս բանալիները չեն մտնում Setup USB-ի մեջ։ Պահեք ապահով տեղում։ UserData USB արտահանումը կարող է տեղափոխել պահոցը։</p>'+
      '<button type="button" id="kmVaultSetupBtn" class="primary" style="width:100%;padding:10px">Պահել բանալիները</button>'+
      '<p id="kmVaultErr" style="color:#a43b3b;min-height:18px;margin:8px 0 0"></p>'
    );
    return new Promise((resolve)=>{
      const btn=document.getElementById('kmVaultSetupBtn');
      if(!btn){resolve(false);return;}
      btn.onclick=async()=>{
        const err=document.getElementById('kmVaultErr');
        try{
          btn.disabled=true;
          await window.kmNative.vault.setup({
            l2:document.getElementById('kmVaultL2').value,
            l3:document.getElementById('kmVaultL3').value,
            l4:document.getElementById('kmVaultL4').value
          });
          unblockApp();
          toastOk('Սեփականատիրոջ պահոցը կարգավորված է');
          resolve(true);
        }catch(e){
          if(err)err.textContent=e.message||String(e);
          btn.disabled=false;
        }
      };
    });
  }

  async function showVaultRebindGate(st){
    const needL4=!!(st&&(st.needsL4||(st.threats&&st.threats.length)));
    const needL3=!!(st&&(!st.machineOk||(st.bindOk===false&&st.integrityOk)));
    blockApp(
      (st&&st.message)||'Պահանջվում է սեփականատիրոջ գաղտնի բանալի։',
      vaultKeyRow('kmVaultL2','L2 — սեփականատիրոջ գլխավոր բանալի')+
      (needL3?vaultKeyRow('kmVaultL3','L3 — հակակրկնօրինակման բանալի'):'')+
      (needL4?vaultKeyRow('kmVaultL4','L4 — վերականգնում'):'')+
      '<button type="button" id="kmVaultRebindBtn" class="primary" style="width:100%;padding:10px">Վերակապել / բացել</button>'+
      '<p id="kmVaultErr" style="color:#a43b3b;min-height:18px;margin:8px 0 0"></p>'
    );
    return new Promise((resolve)=>{
      const btn=document.getElementById('kmVaultRebindBtn');
      if(!btn){resolve(false);return;}
      btn.onclick=async()=>{
        const err=document.getElementById('kmVaultErr');
        try{
          btn.disabled=true;
          const keys={
            l2:document.getElementById('kmVaultL2').value,
            l3:(document.getElementById('kmVaultL3')||{}).value||'',
            l4:(document.getElementById('kmVaultL4')||{}).value||''
          };
          await window.kmNative.vault.rebind(keys);
          unblockApp();
          toastOk('Պահոցը վերակապված է');
          resolve(true);
        }catch(e){
          if(err)err.textContent=e.message||String(e);
          btn.disabled=false;
        }
      };
    });
  }

  window.kmEnsureOwnerVault=async function(){
    if(!window.kmNative||!window.kmNative.vault)return true;
    try{
      let gate=await window.kmNative.vault.gate();
      let st=(gate&&gate.status)||await window.kmNative.vault.status();
      if(st&&st.origin)return true;
      if(st&&st.needsSetup){
        await showVaultSetupGate(st);
        gate=await window.kmNative.vault.gate();
        st=gate&&gate.status;
      }else if(st&&(st.blocked||st.needsRebind||st.needsL4)){
        await showVaultRebindGate(st);
        gate=await window.kmNative.vault.gate();
        st=gate&&gate.status;
      }
      if(gate&&gate.ok===false){
        blockApp(esc(st&&st.message||gate.message||'Սեփականատիրոջ պահոցը չի բացվել։'),'');
        return false;
      }
      try{
        const snap=localStorage.getItem('km_db_seal_hint');
        if(snap&&window.kmNative.vault.verifySeal){
          const v=await window.kmNative.vault.verifySeal(JSON.parse(snap));
          if(v&&v.ok===false)toastErr(v.message||'Բազայի կնիքը չի համընկնում');
        }
      }catch(e){}
      return true;
    }catch(e){
      toastErr(e.message||String(e));
      return false;
    }
  };

  function maybeWarnSoon(st){
    if(!st||!st.valid)return;
    try{
      if(sessionStorage.getItem('km_auth_ok')!=='1')return;
    }catch(e){}
    const d=Number(st.daysLeft)||0;
    if(d>14)return;
    try{
      if(sessionStorage.getItem('km_lic_soon')==='1')return;
      sessionStorage.setItem('km_lic_soon','1');
    }catch(e){}
    toastOk('Արտոնագրին մնացել է '+d+' օր');
  }

  function pad2(n){return String(n).padStart(2,'0');}
  function paintLicenseRemain(expIso){
    const daysEl=document.getElementById('kmLicDays');
    const hmsEl=document.getElementById('kmLicHms');
    if(!daysEl||!hmsEl||!expIso)return false;
    const left=Math.max(0,new Date(expIso).getTime()-Date.now());
    const d=Math.floor(left/86400000);
    const h=Math.floor((left%86400000)/3600000);
    const m=Math.floor((left%3600000)/60000);
    const s=Math.floor((left%60000)/1000);
    daysEl.textContent=String(d);
    hmsEl.textContent=pad2(h)+':'+pad2(m)+':'+pad2(s);
    const bar=document.getElementById('kmLicBarFill');
    if(bar){
      const kind=bar.getAttribute('data-kind')||'year';
      const total=kind==='quarter'?90*86400000:365*86400000;
      const pct=Math.max(0,Math.min(100,Math.round(left/total*100)));
      bar.style.width=pct+'%';
    }
    return left>0;
  }
  function startRemainTimer(expIso){
    paintLicenseRemain(expIso);
    if(window._kmLicCountTimer)clearInterval(window._kmLicCountTimer);
    window._kmLicCountTimer=setInterval(function(){
      if(window.page!=='license'){
        clearInterval(window._kmLicCountTimer);
        window._kmLicCountTimer=null;
        return;
      }
      paintLicenseRemain(expIso);
    },1000);
  }

  function isAdmin(){
    try{
      if(window.kmUserRole==='admin')return true;
      if(typeof window.kmCanAdmin==='function'&&window.kmCanAdmin())return true;
      if(sessionStorage.getItem('km_auth_mode')==='admin')return true;
    }catch(e){}
    return false;
  }
  function adminToken(){
    try{return localStorage.getItem('km_admin_token')||'';}catch(e){return '';}
  }
  function fmtBytes(n){
    n=Number(n)||0;
    if(n>=1073741824)return (n/1073741824).toFixed(1)+' GB';
    if(n>=1048576)return (n/1048576).toFixed(0)+' MB';
    return n+' B';
  }
  function fmtWhen(s){
    if(!s)return '—';
    try{return new Date(s).toLocaleString('hy-AM');}catch(e){return String(s);}
  }
  function kindText(kind){
    if(kind==='quarter')return '3 ամիս';
    if(kind==='year')return '1 տարի';
    return kind||'—';
  }
  function sourceText(src){
    if(src==='kod')return 'kod.cmd';
    if(src==='kod_apply')return 'kod_apply';
    if(src==='ui')return 'KM';
    return src||'KM';
  }
  function fmtEnded(r){
    if(!r)return '—';
    if(r.endedAt){
      var tail='';
      if(r.endReason==='logout')tail=' · ելք համակարգից';
      else if(r.endReason==='expired')tail=' · ժամկետը ավարտվել է';
      else if(r.endReason==='replaced')tail=' · փոխարինվել է նոր կոդով';
      return fmtWhen(r.endedAt)+tail;
    }
    if(r.expiresAt&&new Date(r.expiresAt).getTime()<=Date.now())return fmtWhen(r.expiresAt)+' · ժամկետը ավարտվել է';
    return '—';
  }
  function renderMachine(m){
    if(!m)return '<p class="muted">Համակարգչի տվյալներ չկան։</p>';
    const ips=(m.ips||[]).map(function(a){
      return '<div>'+esc(a.iface||'')+' · '+esc(a.ip||'')+(a.mac?' · MAC '+esc(a.mac):'')+'</div>';
    }).join('')||'<div class="muted">IPv4 չի գտնվել</div>';
    return '<div class="kmLicMachine">'+
      '<p><b>Համակարգչի անուն՝</b> '+esc(m.hostname||'—')+'</p>'+
      '<p><b>Օգտանուն՝</b> '+esc(m.username||'—')+'</p>'+
      '<p><b>Օպերացիոն համակարգ՝</b> '+esc(m.osName||'—')+' ('+esc(m.osRelease||'')+', '+esc(m.arch||'')+')</p>'+
      '<p><b>Պրոցեսոր՝</b> '+esc(m.cpu||'—')+' · միջուկներ՝ <b>'+esc(m.cpuCount||0)+'</b></p>'+
      '<p><b>Հիշողություն՝</b> '+esc(fmtBytes(m.ramTotal))+' ընդամենը, ազատ՝ '+esc(fmtBytes(m.ramFree))+'</p>'+
      '<p><b>Ծրագրի ուղի՝</b> '+esc(m.execPath||'—')+'</p>'+
      '<p><b>UserData՝</b> '+esc(m.userData||'—')+'</p>'+
      '<h4>Ցանցային հասցեներ</h4>'+
      '<div class="kmLicIps">'+ips+'</div>'+
    '</div>';
  }
  function fmtNum(n){
    n=Number(n)||0;
    try{return n.toLocaleString('hy-AM');}catch(e){return String(n);}
  }
  function receiptStatusMeta(r, valid, lastCode){
    if(!r)return {key:'used',label:'Օգտագործված'};
    const now=Date.now();
    if(r.endedAt){
      const ended=new Date(r.endedAt).getTime();
      const exp=r.expiresAt?new Date(r.expiresAt).getTime():0;
      if(r.endReason==='expired'||(exp&&ended>=exp)) return {key:'expired',label:'Ժամկետը ավարտվել է'};
      if(r.endReason==='replaced') return {key:'early',label:'Փոխարինված'};
      return {key:'early',label:'Ժամկետից շուտ ավարտվել է'};
    }
    if(r.expiresAt&&new Date(r.expiresAt).getTime()<=now) return {key:'expired',label:'Ժամկետը ավարտվել է'};
    if(valid&&lastCode&&String(r.code)===String(lastCode)) return {key:'working',label:'Գործում է'};
    if(r.expiresAt&&new Date(r.expiresAt).getTime()>now) return {key:'working',label:'Գործում է'};
    return {key:'used',label:'Օգտագործված'};
  }
  function receiptStatus(r, valid, lastCode){
    return receiptStatusMeta(r, valid, lastCode).label;
  }
  function statusBadge(meta){
    if(typeof meta==='string') meta={key:'used',label:meta};
    var cls='kmLicBadge';
    if(meta.key==='working')cls+=' kmLicBadgeOk';
    else if(meta.label==='Փոխարինված'||meta.key==='expired')cls+=' kmLicBadgeOff';
    else if(meta.key==='early')cls+=' kmLicBadgeWarn';
    else cls+=' kmLicBadgeUsed';
    return '<span class="'+cls+'">'+esc(meta.label)+'</span>';
  }
  function daysLeftOf(r){
    if(!r||r.endedAt||!r.expiresAt)return '';
    const left=new Date(r.expiresAt).getTime()-Date.now();
    if(left<=0)return '0';
    return String(Math.ceil(left/86400000));
  }
  function expiryBanner(st){
    if(!st)return '';
    if(st.wrongMachine)return '<div class="kmLicWarn kmLicWarnBad">Արտոնագիրը կապված է այլ համակարգչի հետ։ Այս համակարգչում պետք է նոր կոդ։</div>';
    if(st.expired)return '<div class="kmLicWarn kmLicWarnBad">Արտոնագրի ժամկետը ավարտվել է։ Կիրառեք նոր կոդ։</div>';
    if(!st.valid&&!st.expiresAt)return '<div class="kmLicWarn">Արտոնագիրը ակտիվացված չէ։</div>';
    const d=Number(st.daysLeft)||0;
    if(st.valid&&d<=7)return '<div class="kmLicWarn kmLicWarnBad">Մնացել է '+esc(String(d))+' օր։ Շուտով կիրառեք նոր կոդ։</div>';
    if(st.valid&&d<=30)return '<div class="kmLicWarn">Մնացել է '+esc(String(d))+' օր մինչև սպառումը։</div>';
    return '';
  }
  function renderHero(st, extraHtml){
    const valid=!!st.valid;
    const expired=!!st.expired;
    const statusText=valid?'Ակտիվ է':(expired?'Ժամկետը ավարտվել է':(st.wrongMachine?'Այլ համակարգիչ':'Ակտիվացված չէ'));
    const kindTextVal=kindText(st.lastKind);
    const actText=st.activatedAt?new Date(st.activatedAt).toLocaleString('hy-AM'):'—';
    const expText=st.expiresAt?new Date(st.expiresAt).toLocaleString('hy-AM'):'—';
    const kind=st.lastKind==='quarter'?'quarter':'year';
    return     '<div class="card kmLicCard">'+
      '<h3 style="margin-top:0">Ընթացիկ արտոնագիր</h3>'+
      expiryBanner(st)+
      '<p>Կարգավիճակ՝ <b>'+esc(statusText)+'</b>'+(kindTextVal&&kindTextVal!=='—'?' · տեսակ՝ <b>'+esc(kindTextVal)+'</b>':'')+'</p>'+
      (st.lastCode&&isAdmin()?'<p>Գործող կոդ՝ <b>'+esc(st.lastCode)+'</b> <button type="button" class="kmLicCopy" data-km-lic-act="copy" data-km-copy="'+esc(st.lastCode)+'">Պատճենել</button></p>':'')+
      '<p>Ակտիվացված է՝ <b>'+esc(actText)+'</b></p>'+
      '<p>Սպառվում է՝ <b>'+esc(expText)+'</b></p>'+
      (st.expiresAt
        ? '<div class="kmLicCountBox">'+
            '<div class="muted" style="margin-bottom:8px">Հետհաշվարկ մինչև սպառումը</div>'+
            '<div class="kmLicRemainLine"><b id="kmLicDays">0</b> <span>օր</span> <b id="kmLicHms">00:00:00</b></div>'+
            '<div class="kmLicBar"><span id="kmLicBarFill" data-kind="'+esc(kind)+'"></span></div>'+
          '</div>'
        : '<p class="muted">Հետհաշվարկ չկա — արտոնագիրը ակտիվացված չէ։</p>')+
      (extraHtml||'')+
    '</div>';
  }
  function filteredReceipts(data){
    const receipts=data.receipts||[];
    const lastCode=data.lastCode||'';
    const valid=!!data.valid;
    const q=String(licPage.q||'').trim().toLocaleLowerCase();
    const f=licPage.filter||'all';
    return receipts.filter(function(r){
      const meta=receiptStatusMeta(r, valid, lastCode);
      if(f==='working'&&meta.key!=='working')return false;
      if(f==='early'&&meta.key!=='early')return false;
      if(f==='expired'&&meta.key!=='expired')return false;
      if(!q)return true;
      const host=(r.machine&&r.machine.hostname)||'';
      const hay=[r.code,kindText(r.kind),host,(r.machine&&r.machine.osName)||'',meta.key,meta.label,t(meta.label),sourceText(r.source),fmtWhen(r.at),fmtEnded(r)].join(' ').toLocaleLowerCase();
      return hay.indexOf(q)>=0;
    });
  }
  function receiptRowsHtml(data){
    const lastCode=data.lastCode||'';
    const valid=!!data.valid;
    const list=filteredReceipts(data);
    if(!list.length)return '<tr><td colspan="6" class="muted">Օգտագործված անդորագիր չկա։</td></tr>';
    return list.map(function(r){
      const host=(r.machine&&r.machine.hostname)||'';
      const os=(r.machine&&r.machine.osName)||'';
      const left=daysLeftOf(r);
      const meta=receiptStatusMeta(r, valid, lastCode);
      const current=meta.key==='working'&&lastCode&&String(r.code)===String(lastCode);
      return '<tr'+(current?' class="kmLicRowCurrent"':'')+'>'+
        '<td><b>'+esc(r.code||'')+'</b>'+
          '<div class="muted">'+esc(kindText(r.kind))+' · '+esc(sourceText(r.source))+
          ' <button type="button" class="kmLicCopy" data-km-lic-act="copy" data-km-copy="'+esc(r.code||'')+'">Պատճենել</button></div></td>'+
        '<td>'+esc(host||'—')+(os?'<div class="muted">'+esc(os)+'</div>':'')+'</td>'+
        '<td>'+esc(fmtWhen(r.at))+'</td>'+
        '<td>'+esc(fmtEnded(r))+'</td>'+
        '<td>'+(left?esc(left)+' օր':'—')+'</td>'+
        '<td>'+statusBadge(meta)+'</td>'+
      '</tr>';
    }).join('');
  }
  function paintReceiptRows(){
    const tb=document.getElementById('kmLicHistBody');
    if(!tb)return;
    tb.innerHTML=receiptRowsHtml(licPage.data||{});
    if(typeof window.kmApplyLanguageTo==='function'){
      try{window.kmApplyLanguageTo(tb);}catch(e){}
    }
  }
  function syncFilterButtons(host){
    const f=licPage.filter||'all';
    (host||document).querySelectorAll('[data-km-lic-act="filter"]').forEach(function(b){
      const on=b.getAttribute('data-km-lic-filter')===f;
      b.classList.toggle('kmLicFilterOn',on);
      b.setAttribute('aria-pressed',on?'true':'false');
    });
  }
  function csvEscape(v){
    return '"'+String(v??'').replace(/"/g,'""')+'"';
  }
  async function exportReceiptsCsv(data){
    if(!window.kmNative||!window.kmNative.file||typeof window.kmNative.file.saveDesktop!=='function'){
      toastErr('Միայն desktop KM');
      return;
    }
    const lastCode=data.lastCode||'';
    const valid=!!data.valid;
    const rows=[['code','kind','source','hostname','os','applied','ended','daysLeft','status']].concat(
      filteredReceipts(data).map(function(r){
        return [
          r.code||'',
          kindText(r.kind),
          sourceText(r.source),
          (r.machine&&r.machine.hostname)||'',
          (r.machine&&r.machine.osName)||'',
          fmtWhen(r.at),
          fmtEnded(r),
          daysLeftOf(r)||'',
          receiptStatus(r, valid, lastCode)
        ];
      })
    );
    const text='\ufeff'+rows.map(function(r){return r.map(csvEscape).join(',');}).join('\r\n');
    const bytes=Array.from(new TextEncoder().encode(text));
    const r=await window.kmNative.file.saveDesktop({name:'KM_license_receipts.csv',bytes:bytes});
    if(r&&r.ok)toastOk('Արտահանվեց՝ '+r.path);
  }
  async function activateFromPage(){
    const inp=document.getElementById('kmLicNewCode');
    const err=document.getElementById('kmLicRenewErr');
    const code=inp?String(inp.value||'').trim():'';
    if(!code){if(err)err.textContent='Մուտքագրեք կոդ';return;}
    if(err)err.textContent='';
    try{
      const r=await window.kmNative.license.activate(code);
      if(r&&r.ok===false){
        const msg=r.error||'Սխալ ակտիվացման կոդ';
        if(err)err.textContent=msg;
        toastErr(msg);
        return;
      }
      try{sessionStorage.removeItem('km_lic_soon');}catch(e){}
      window.kmLicenseBypass=false;
      if(r&&r.universalUser)toastOk('Օգտատեր մուտքը բացված է');
      else toastOk('Ակտիվացված է մինչև '+new Date(r.expiresAt).toLocaleDateString('hy-AM'));
      if(typeof window.kmOpenLicensePage==='function')await window.kmOpenLicensePage();
    }catch(e){
      let msg=e.message||String(e);
      msg=msg.replace(/^Error invoking remote method '[^']+':\s*/i,'').replace(/^Error:\s*/i,'').trim();
      if(err)err.textContent=msg;
      toastErr(msg);
    }
  }
  async function kodActivateFromPage(){
    /* KM_OTC_GENERATE_V1 */
    if(!window.kmNative||!window.kmNative.kod||typeof window.kmNative.kod.activate!=='function'){
      toastErr('Ակտիվացման API հասանելի չէ');
      return;
    }
    try{
      const r=await window.kmNative.kod.activate();
      try{sessionStorage.removeItem('km_lic_soon');}catch(e){}
      window.kmLicenseStatus=r;
      const kindLabel=(r&&r.kind==='quarter')?'kod3.cmd (3 ամիս)':'kod.cmd (1 տարի)';
      toastOk('KM ակտիվացվեց · '+kindLabel+(r&&r.code?(' · կոդ '+r.code):''));
      if(typeof window.kmOpenLicensePage==='function')await window.kmOpenLicensePage();
    }catch(e){toastErr(e.message||e);}
  }

  async function stageNextCodeFromPage(){
    /* KM_OTC_GENERATE_V1 */
    if(!window.kmNative||!window.kmNative.license||typeof window.kmNative.license.stageNext!=='function'){
      toastErr('Կոդի գեներացիան հասանելի չէ');
      return;
    }
    try{
      const r=await window.kmNative.license.stageNext();
      if(!r||r.ok===false){toastErr((r&&r.error)||'Գեներացիան ձախողվեց');return;}
      const inp=document.getElementById('kmLicNewCode');
      if(inp)inp.value=r.code||'';
      const err=document.getElementById('kmLicRenewErr');
      if(err)err.textContent='';
      const kindLabel=(r.kind==='quarter')?'kod3.cmd (3 ամիս)':'kod.cmd (1 տարի)';
      toastOk('Նոր կոդ · '+kindLabel+' · '+(r.code||''));
      try{await navigator.clipboard.writeText(String(r.code||''));}catch(eC){}
    }catch(e){toastErr(e.message||e);}
  }

  async function saveKodKindChoicesFromPage(host){
    /* KM_LICENSE_KOD_CHOICE_V1 */
    if(!window.kmNative||!window.kmNative.settings||typeof window.kmNative.settings.set!=='function'){
      toastErr('Պահպանումը հասանելի չէ');
      return;
    }
    const defSel=host.querySelector('#kmLicKodDefault');
    const defaultKind=(defSel&&defSel.value==='quarter')?'quarter':'year';
    const byMachine={};
    host.querySelectorAll('[data-km-kod-seat]').forEach(function(sel){
      const key=sel.getAttribute('data-km-kod-seat')||'';
      if(!key)return;
      byMachine[key]=(sel.value==='quarter')?'quarter':'year';
    });
    try{
      await window.kmNative.settings.set({
        licenseKodKindDefault:defaultKind,
        licenseKodKindByMachine:byMachine
      });
      toastOk('Արտոնագրի kod/kod3 ընտրությունը պահվեց');
      if(typeof window.kmOpenLicensePage==='function')await window.kmOpenLicensePage();
    }catch(e){toastErr(e.message||e);}
  }
  async function clearUsedReceiptsFromPage(){
    if(!window.kmNative||!window.kmNative.license||typeof window.kmNative.license.clearUsedReceipts!=='function'){
      toastErr('Միայն desktop KM');
      return;
    }
    const n=(licPage.data&&licPage.data.stats&&licPage.data.stats.used)||((licPage.data&&licPage.data.receipts)||[]).length||0;
    const msg1='Մաքրե՞լ բոլոր օգտագործված անդորագրերը ('+n+')։\n\nkod.cmd և kod3.cmd-ը նույն կոդերը նորից կկարողանան օգտագործել 0-ից։\nԸնթացիկ արտոնագիրը նույնպես կանջատվի։';
    if(!confirm(msg1))return;
    if(!confirm('Հաստատե՞լ։ Այս գործողությունը հետ չի բերվում։'))return;
    try{
      const r=await window.kmNative.license.clearUsedReceipts({adminToken:adminToken()});
      if(!r||r.ok===false)throw new Error((r&&r.error)||'Մաքրումը չհաջողվեց');
      toastOk('Մաքրվեց՝ '+(r.clearedUsed||0)+' կոդ, '+(r.clearedReceipts||0)+' անդորագիր');
      if(typeof window.kmOpenLicensePage==='function')await window.kmOpenLicensePage();
    }catch(e){
      toastErr(e.message||String(e));
    }
  }
  function copyText(t){
    t=String(t||'');
    if(!t)return;
    if(navigator.clipboard&&navigator.clipboard.writeText){
      navigator.clipboard.writeText(t).then(function(){toastOk('Պատճենվեց');}).catch(function(){toastOk(t);});
      return;
    }
    toastOk(t);
  }
  function bindLicenseHost(host){
    host.onclick=function(e){
      const btn=e.target.closest('[data-km-lic-act]');
      if(!btn||!host.contains(btn))return;
      e.preventDefault();
      if(e.stopPropagation)e.stopPropagation();
      const act=btn.getAttribute('data-km-lic-act');
      if(act==='copy')copyText(btn.getAttribute('data-km-copy')||'');
      else if(act==='csv')exportReceiptsCsv(licPage.data||{});
      else if(act==='clearUsed')clearUsedReceiptsFromPage();
      else if(act==='activate')activateFromPage();
      else if(act==='kod')kodActivateFromPage();
      else if(act==='stage')stageNextCodeFromPage();
      else if(act==='saveKodKinds')saveKodKindChoicesFromPage(host);
      else if(act==='filter'){
        licPage.filter=btn.getAttribute('data-km-lic-filter')||'all';
        syncFilterButtons(host);
        paintReceiptRows();
      }
    };
    const search=document.getElementById('kmLicSearch');
    if(search){
      search.value=licPage.q||'';
      search.oninput=function(){
        licPage.q=search.value||'';
        paintReceiptRows();
      };
    }
  }
  function renderAdminLicense(data){
    const st=data.stats||{};
    const heroSt={
      valid:!!data.valid,
      expired:!!data.expired,
      wrongMachine:!!data.wrongMachine,
      lastKind:data.lastKind,
      lastCode:data.lastCode,
      activatedAt:data.activatedAt,
      expiresAt:data.expiresAt,
      daysLeft:data.daysLeft
    };
    const installs=(data.installMachines||[]).map(function(m,idx){
      return '<div class="card" style="margin-top:10px;padding:12px">'+
        '<div class="muted" style="margin-bottom:6px">Տեղադրում #'+(idx+1)+'</div>'+
        renderMachine(m)+
      '</div>';
    }).join('');
    const f=licPage.filter||'all';
    return renderHero(heroSt,
      '<div class="kmLicRenew"><!-- KM_OTC_GENERATE_V1 -->'+
        '<h4 style="margin:16px 0 6px">Նոր կոդ / երկարաձգում</h4>'+
        '<p class="muted" style="margin:0 0 8px">Գեներացրեք կոդը հավելվածում · <b>kod.cmd</b> արտաքին գործարկում այլևս պարտադիր չէ։ Ռեժիմը՝ «ըստ համարի» ընտրությունից։</p>'+
        '<div class="toolbar" style="gap:8px;flex-wrap:wrap">'+
          '<input id="kmLicNewCode" type="text" placeholder="Ակտիվացման կոդ" autocomplete="off" style="min-width:220px;padding:8px;letter-spacing:.06em;text-transform:uppercase">'+
          '<button type="button" data-km-lic-act="stage">Գեներացնել կոդ</button>'+
          '<button type="button" class="primary" data-km-lic-act="activate">Ակտիվացնել</button>'+
          '<button type="button" data-km-lic-act="kod">Ակտիվացնել KM (ինքնագեներացիա)</button>'+
        '</div>'+
        '<p id="kmLicRenewErr" style="color:#a43b3b;min-height:18px;margin:8px 0 0"></p>'+
      '</div>'
    )+
    ('<div class="card" id="kmLicKodChoiceCard"><!-- KM_LICENSE_KOD_CHOICE_V1 -->'+
      '<h3 style="margin-top:0">Արտոնագիր · kod.cmd / kod3.cmd ըստ համարի</h3>'+
      '<p class="muted" style="margin:0 0 10px;font-size:13px">Միայն Administrator. Յուրաքանչյուր համարի համար ընտրեք <b>kod.cmd</b> (1 տարի) կամ <b>kod3.cmd</b> (3 ամիս)։</p>'+
      '<label style="display:block;margin:0 0 10px">Լռելյայն · <select id="kmLicKodDefault" style="padding:6px 8px">'+
        '<option value="year"'+(((data.kodKindDefault||'year')==='year')?' selected':'')+'>kod.cmd (1 տարի)</option>'+
        '<option value="quarter"'+(data.kodKindDefault==='quarter'?' selected':'')+'>kod3.cmd (3 ամիս)</option>'+
      '</select></label>'+
      ((data.seats&&data.seats.length)?(
        '<div class="gridwrap"><table class="grid"><thead><tr><th>Համար</th><th>Համակարգիչ</th><th>Ռեժիմ</th></tr></thead><tbody>'+
        data.seats.map(function(seat){
          const curKind=(data.seatKodKinds&&data.seatKodKinds[seat.key])||data.kodKindDefault||'year';
          return '<tr><td><b>'+esc(seat.label||('Համար #'+seat.n))+'</b>'+(seat.current?' <span class="muted">(ընթացիկ)</span>':'')+'</td>'+
            '<td>'+esc(seat.hostname||'')+(seat.osName?(' · '+esc(seat.osName)):'')+'</td>'+
            '<td><select data-km-kod-seat="'+esc(seat.key)+'" style="padding:4px 6px">'+
              '<option value="year"'+(curKind==='year'?' selected':'')+'>kod.cmd</option>'+
              '<option value="quarter"'+(curKind==='quarter'?' selected':'')+'>kod3.cmd</option>'+
            '</select></td></tr>';
        }).join('')+
        '</tbody></table></div>'
      ):'<p class="muted">Տեղադրումների ցանկը դատարկ է · կիրառվում է լռելյայնը։</p>')+
      '<div class="toolbar" style="margin-top:10px"><button type="button" class="primary" data-km-lic-act="saveKodKinds">Պահել ընտրությունը</button></div>'+
    '</div>')+
    '<div class="card kmLicCard">'+
      '<h3 style="margin-top:0">Արտոնագիր — օգտագործված անդորագրեր</h3>'+
      '<div class="kmLicStats">'+
        '<div class="kmLicStat"><span>Մնացել է</span><b>'+esc(fmtNum(st.remaining))+'</b>'+
          '<div class="muted">1 տարի՝ '+esc(fmtNum(st.remainingYear))+' · 3 ամիս՝ '+esc(fmtNum(st.remainingQuarter))+'</div></div>'+
        '<div class="kmLicStat"><span>Օգտագործված</span><b>'+esc(fmtNum(st.used))+'</b>'+
          '<div class="muted">1 տարի՝ '+esc(fmtNum(st.usedYear))+' · 3 ամիս՝ '+esc(fmtNum(st.usedQuarter))+'</div></div>'+
        '<div class="kmLicStat"><span>Ժամկետից շուտ ավարտված</span><b>'+esc(fmtNum(st.earlyEnded))+'</b></div>'+
        '<div class="kmLicStat"><span>Տեղադրված և գործում</span><b>'+esc(fmtNum(st.working))+'</b></div>'+
      '</div>'+
      '<p class="muted">Քանակները միայն են. մնացած կոդերի ցանկը չի ցուցադրվում։ Աղյուսակում՝ օգտագործված անդորագրերը։</p>'+
      '<div class="kmLicFilters">'+
        '<input id="kmLicSearch" type="search" placeholder="Որոնում (կոդ, համակարգիչ, կարգավիճակ)" style="min-width:240px;padding:6px 8px">'+
        '<button type="button" class="kmLicFilter'+(f==='all'?' kmLicFilterOn':'')+'" data-km-lic-act="filter" data-km-lic-filter="all" aria-pressed="'+(f==='all'?'true':'false')+'">Բոլորը</button>'+
        '<button type="button" class="kmLicFilter'+(f==='working'?' kmLicFilterOn':'')+'" data-km-lic-act="filter" data-km-lic-filter="working" aria-pressed="'+(f==='working'?'true':'false')+'">Գործում է</button>'+
        '<button type="button" class="kmLicFilter'+(f==='early'?' kmLicFilterOn':'')+'" data-km-lic-act="filter" data-km-lic-filter="early" aria-pressed="'+(f==='early'?'true':'false')+'">Ժամկետից շուտ</button>'+
        '<button type="button" class="kmLicFilter'+(f==='expired'?' kmLicFilterOn':'')+'" data-km-lic-act="filter" data-km-lic-filter="expired" aria-pressed="'+(f==='expired'?'true':'false')+'">Ավարտված</button>'+
        '<button type="button" data-km-lic-act="csv">Արտահանել CSV</button>'+
        '<button type="button" class="badBtn" data-km-lic-act="clearUsed" title="Զրոյացնել օգտագործված կոդերը՝ kod.cmd / kod3.cmd-ի համար">Մաքրել օգտագործված անդորագրերը</button>'+
      '</div>'+
      '<div class="gridwrap"><table class="grid kmLicHist"><thead><tr>'+
        '<th>Անդորագիր</th><th>Համակարգիչ</th><th>Երբ է կիրառվել</th><th>Երբ է սպառվել</th><th>Մնացել է</th><th>Կարգավիճակ</th>'+
      '</tr></thead><tbody id="kmLicHistBody">'+receiptRowsHtml(data)+'</tbody></table></div>'+
    '</div>'+
    (installs?'<div class="card"><h3 style="margin-top:0">Այլ տեղադրված համակարգիչներ</h3>'+installs+'</div>':'')+
    '<div class="card" id="kmVaultAdminCard"><h3 style="margin-top:0">Սեփականատիրոջ գաղտնի բանալիներ</h3><p class="muted">Բեռնվում է…</p></div>'+
    '<div class="card">'+
      '<h3 style="margin-top:0">Այս համակարգիչը</h3>'+
      (data.wrongMachine?'<p class="kmLicWarn kmLicWarnBad">Արտոնագիրը կապված է այլ համակարգչի հետ։</p>':'')+
      renderMachine(data.machine)+
      '<div class="toolbar" style="margin-top:16px"><button type="button" onclick="kmReportsBack()">← Վերադարձ</button></div>'+
    '</div>';
  }

  async function paintVaultAdminCard(host){
    const card=(host||document).querySelector('#kmVaultAdminCard');
    if(!card||!window.kmNative||!window.kmNative.vault)return;
    try{
      const st=await window.kmNative.vault.status();
      card.innerHTML=
        '<h3 style="margin-top:0">Սեփականատիրոջ գաղտնի բանալիներ (L2–L4)</h3>'+
        '<p>Պահոց՝ <b>'+(st.configured?'կարգավորված':'չկա')+'</b>'+(st.vaultId?' · ID <code>'+esc(String(st.vaultId).slice(0,12))+'…</code>':'')+'</p>'+
        '<p class="muted">Ֆայլ՝ միայն UserData (<code>km_owner_vault.json</code>) + բազայի կնիք (<code>kmOwnerSeal</code>)։ Setup-ում բանալիներ չկան։</p>'+
        (st.message?'<p>'+esc(st.message)+'</p>':'')+
        (st.threats&&st.threats.length?'<p class="kmLicWarn kmLicWarnBad">AI/clone հետքեր՝ '+esc(st.threats.join(', '))+'</p>':'')+
        '<div class="toolbar" style="gap:8px;flex-wrap:wrap;margin-top:10px">'+
          '<button type="button" data-km-vault-act="setup">Կարգավորել / ստեղծել</button>'+
          '<button type="button" data-km-vault-act="rebind">Վերակապել</button>'+
          '<button type="button" data-km-vault-act="rotate">Փոխել L2</button>'+
        '</div>'+
        '<div id="kmVaultAdminForm" style="margin-top:12px"></div>';
      card.querySelectorAll('[data-km-vault-act]').forEach(function(btn){
        btn.onclick=async function(){
          const act=btn.getAttribute('data-km-vault-act');
          const form=document.getElementById('kmVaultAdminForm');
          if(!form)return;
          if(act==='setup'){
            form.innerHTML=vaultKeyRow('kmAdL2','L2')+vaultKeyRow('kmAdL3','L3')+vaultKeyRow('kmAdL4','L4')+
              '<button type="button" id="kmAdVaultGo" class="primary">Պահել</button>';
            document.getElementById('kmAdVaultGo').onclick=async function(){
              try{
                await window.kmNative.vault.setup({
                  l2:document.getElementById('kmAdL2').value,
                  l3:document.getElementById('kmAdL3').value,
                  l4:document.getElementById('kmAdL4').value
                });
                toastOk('Պահոցը ստեղծվեց');
                paintVaultAdminCard(host);
              }catch(e){toastErr(e.message||e);}
            };
          }else if(act==='rebind'){
            form.innerHTML=vaultKeyRow('kmAdL2','L2')+vaultKeyRow('kmAdL3','L3 (անհրաժեշտության դեպքում)')+vaultKeyRow('kmAdL4','L4 (անհրաժեշտության դեպքում)')+
              '<button type="button" id="kmAdVaultGo" class="primary">Վերակապել</button>';
            document.getElementById('kmAdVaultGo').onclick=async function(){
              try{
                await window.kmNative.vault.rebind({
                  l2:document.getElementById('kmAdL2').value,
                  l3:document.getElementById('kmAdL3').value,
                  l4:document.getElementById('kmAdL4').value
                });
                toastOk('Վերակապված է');
                paintVaultAdminCard(host);
              }catch(e){toastErr(e.message||e);}
            };
          }else if(act==='rotate'){
            form.innerHTML=vaultKeyRow('kmAdCur','Ընթացիկ L2')+vaultKeyRow('kmAdNew','Նոր L2')+
              '<button type="button" id="kmAdVaultGo" class="primary">Փոխել</button>';
            document.getElementById('kmAdVaultGo').onclick=async function(){
              try{
                await window.kmNative.vault.rotate({
                  level:'L2',
                  currentKey:document.getElementById('kmAdCur').value,
                  nextKey:document.getElementById('kmAdNew').value
                });
                toastOk('L2 փոխվեց');
                paintVaultAdminCard(host);
              }catch(e){toastErr(e.message||e);}
            };
          }
        };
      });
    }catch(e){
      card.innerHTML='<h3 style="margin-top:0">Սեփականատիրոջ գաղտնի բանալիներ</h3><p class="kmLicWarn kmLicWarnBad">'+esc(e.message||e)+'</p>';
    }
  }

  function ensureLicenseCss(){
    if(document.getElementById('km-lic-page-css'))return;
    const css=document.createElement('style');
    css.id='km-lic-page-css';
    css.textContent=
      '.kmLicCountBox{margin:16px 0 8px;padding:16px 18px;border:1px solid #cfe3f0;border-radius:12px;background:linear-gradient(180deg,#f4fbff,#fff)}'+
      '.kmLicRemainLine{font-size:28px;font-weight:800;letter-spacing:.04em;color:#14607a;font-variant-numeric:tabular-nums}'+
      '.kmLicRemainLine b{font-size:32px}'+
      '.kmLicIps{font-family:Consolas,monospace;font-size:13px;line-height:1.5}'+
      '.kmLicHist td{font-size:13px;vertical-align:top}'+
      '.kmLicMachine p{margin:6px 0}'+
      '.kmLicStats{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin:0 0 14px}'+
      '.kmLicStat{padding:12px 14px;border:1px solid #d5e3ee;border-radius:12px;background:#f7fbfd}'+
      '.kmLicStat span{display:block;font-size:12px;color:#5b6773;margin-bottom:6px}'+
      '.kmLicStat b{font-size:26px;font-weight:800;letter-spacing:.02em;color:#14607a;font-variant-numeric:tabular-nums}'+
      '.kmLicBar{height:8px;background:#e4eef4;border-radius:99px;margin-top:12px;overflow:hidden}'+
      '.kmLicBar span{display:block;height:100%;width:0;background:#1a8a6a;border-radius:99px;transition:width .3s}'+
      '.kmLicWarn{margin:0 0 12px;padding:10px 12px;border-radius:10px;background:#fff7e6;border:1px solid #f0d48a;color:#6a4b00}'+
      '.kmLicWarnBad{background:#fdeeee;border-color:#e8b4b4;color:#8a1f1f}'+
      '.kmLicBadge{display:inline-block;padding:2px 8px;border-radius:999px;font-size:12px;font-weight:700}'+
      '.kmLicBadgeOk{background:#e6f7ef;color:#14603d}'+
      '.kmLicBadgeWarn{background:#fff4e0;color:#8a5a00}'+
      '.kmLicBadgeOff{background:#eef1f4;color:#5b6773}'+
      '.kmLicBadgeUsed{background:#e8f2fb;color:#1a4d73}'+
      '.kmLicCopy{margin-left:6px;padding:2px 8px;font-size:12px}'+
      '.kmLicFilters{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:0 0 10px}'+
      '.kmLicFilter{background:#fff!important;color:var(--KM-text,#1d2733)!important;border:1px solid #c8d4de!important}'+
      '.kmLicFilter:hover{background:#eaf1f6!important}'+
      '.kmLicFilter.kmLicFilterOn{background:#315f7d!important;color:#fff!important;border-color:#315f7d!important}'+
      '.kmLicRowCurrent td{background:#f3fbf7!important}'+
      '.kmLicCard .gridwrap{max-height:none;overflow:auto}'+
      '.kmLicHist{min-width:100%}';
    document.head.appendChild(css);
  }

  window.kmOpenLicensePage=async function(hostEl){
    const seq=++licOpenSeq;
    const host=hostEl||document.getElementById('content');
    if(!host)return;
    if(hostEl){
      page='library';
      window.page='library';
      if(typeof kmSetActiveLibNav==='function')kmSetActiveLibNav('license');
    }else{
      page='license';
      window.page='license';
      if(typeof kmSetActiveNav==='function')kmSetActiveNav(document.querySelector('.nav[data-page="license"]'));
    }
    ensureLicenseCss();
    if(isAdmin()){
      host.innerHTML='<div class="card">Բեռնվում է…</div>';
      try{
        licPage.filter='all';
        licPage.q='';
        const data=await window.kmNative.license.adminOverview({adminToken:adminToken()});
        if(seq!==licOpenSeq)return;
        if(data&&data.ok===false){
          host.innerHTML='<div class="card"><b>'+esc(data.error||'Միայն Administrator')+'</b></div>';
          return;
        }
        licPage.data=data||{};
        host.innerHTML=renderAdminLicense(licPage.data);
        bindLicenseHost(host);
        syncFilterButtons(host);
        paintReceiptRows();
        paintVaultAdminCard(host);
        if(licPage.data.expiresAt)startRemainTimer(licPage.data.expiresAt);
        maybeWarnSoon(licPage.data);
      }catch(e){
        if(seq!==licOpenSeq)return;
        host.innerHTML='<div class="card"><b>Անդորագրերը չբացվեցին։</b><p class="muted">'+esc(e.message||e)+'</p></div>';
      }
      if(seq===licOpenSeq&&typeof kmApplyLanguage==='function'){try{kmApplyLanguage();}catch(e){}}
      return;
    }
    /* KM_LICENSE_ADMIN_ONLY_GATE_V1 / KM_LICENSE_KOD_CHOICE_V1 */
    host.innerHTML='<div class="card"><h3 style="margin-top:0">Արտոնագիր</h3><p class="muted">Այս բաժինը հասանելի է միայն Administrator-ին։</p></div>';
    if(typeof kmApplyLanguage==='function'){try{kmApplyLanguage();}catch(e){}}
    return;
    let st={};
    try{st=await licenseStatus();}catch(e){st={};}
    if(seq!==licOpenSeq)return;
    window.kmLicenseStatus=st;
    const expText=st.expiresAt?new Date(st.expiresAt).toLocaleDateString('hy-AM'):'—';
    const dLeft=Number(st.daysLeft)||0;
    const statusText=st.valid?'Գործող':(st.expiresAt?'Սպառված':'Ակտիվացված չէ');
    host.innerHTML=
      '<div class="card kmLicCard">'+
        '<h3 style="margin-top:0">Արտոնագիր</h3>'+
        expiryBanner(st)+
        '<p>Կարգավիճակ՝ <b>'+esc(statusText)+'</b></p>'+
        '<p>Ավարտի ժամկետ՝ <b>'+esc(expText)+'</b>'+(dLeft>0?' · մնացել է <b>'+esc(String(dLeft))+'</b> օր':'')+'</p>'+
        (st.expiresAt
          ? '<div class="kmLicCountBox">'+
              '<div class="muted" style="margin-bottom:8px">Հետհաշվարկ մինչև սպառումը</div>'+
              '<div class="kmLicRemainLine"><b id="kmLicDays">0</b> <span>օր</span> <b id="kmLicHms">00:00:00</b></div>'+
              '<div class="kmLicBar"><span id="kmLicBarFill" data-kind="'+esc(st.kind||'year')+'"></span></div>'+
            '</div>'
          : '<p class="muted">Հետհաշվարկ չկա — արտոնագիրը ակտիվացված չէ։</p>')+
        '<div class="toolbar" style="margin-top:16px"><button type="button" onclick="kmReportsBack()">← Վերադարձ</button></div>'+
      '</div>';
    if(st.expiresAt)startRemainTimer(st.expiresAt);
    maybeWarnSoon(st);
    if(typeof kmApplyLanguage==='function'){
      try{kmApplyLanguage();}catch(e){}
    }
  };

  document.addEventListener('DOMContentLoaded',()=>{
    setInterval(async()=>{
      if(document.hidden)return; /* KM_PERF_FAST_V3 */
      if(!window.kmNative||!window.kmNative.license||!window.kmNative.license.getPendingCode)return;
      const hasGate=document.getElementById('kmLicenseGate')||document.getElementById('kmLoginOverlay');
      if(!hasGate)return;
      const inp=document.getElementById('kmLoginUserCode')||document.getElementById('kmActCode');
      if(inp&&!inp.value.trim()&&typeof window.kmFillPendingActivationCode==='function'){
        await window.kmFillPendingActivationCode(inp);
      }
    },12000); /* KM_PERF_FAST_V3 */
    setTimeout(async()=>{
      try{
        const st=await licenseStatus();
        maybeWarnSoon(st);
      }catch(e){}
    },2500);
  });
})();
