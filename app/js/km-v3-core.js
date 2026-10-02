/* KM v3 core: roles, undo/redo, search, dark mode, shortcuts, auto-lock, notifications */
(function(){
  'use strict';

  const undoStack=[], redoStack=[], MAX_UNDO=25;
  let lockTimer=null, notifEl=null;

  function esc(s){return typeof window.esc==='function'?window.esc(s):String(s??'');}

  function listHasSection(list, section){
    if(!list||!list.length||section==null||section==='')return false;
    var s=String(section);
    if(list.indexOf(s)>=0)return true;
    if(s.indexOf('lib:')===0&&list.indexOf('library')>=0)return true;
    if(s.indexOf('lib:')===0){
      var lid=s.slice(4);
      if(list.indexOf(lid)>=0||list.indexOf('lib:'+lid)>=0)return true;
    }
    if(window.kmGrantParents){
      var parents=window.kmGrantParents;
      for(var key in parents){
        if(!Object.prototype.hasOwnProperty.call(parents,key))continue;
        if(list.indexOf(key)>=0&&parents[key].indexOf(s)>=0)return true;
      }
    }
    return false;
  }

  /** Հաշվառման էջեր — ոչ ԱՇԽԱՏԱՆՔԻ ԳՈՐԾԻՔՆԵՐ (unit* անունով չշփոթել) */
  var KM_ACCOUNTING_PAGES={ unitReserve: true, /* KM_RESERVE_ARCHIVE_V1 */ unitHamalr: true, /* KM_HAMALR_MOVE_V1 */ 
    people:1,positions:1,vacations:1,troopStructure:1,
    unitFormation:1,unitMedical:1,unitTermWatch:1,unitDossiers:1,unitLeavePlan:1,unitArchive:1,unitInventory:1,
    orgCorps:1
  };
  var KM_ARCHIVE_MOVED_LIB=['lib:current','lib:hishoxutyun','lib:archive']; /* KM_ARCHIVE_HUB_V1: library children shown in the Արխիվ hub */
  var KM_TOOLS_MOVED_LIB=['notes','management','spreadsheets','files','pdfTranslate','original','convert']; /* KM_MENU_REORG_V1 + KM_MENU15_V1: reports deleted; license -> syssettings */
  function kmIsPersonnelPage(id){
    return id==='people'||id==='positions'||id==='unitDossiers';
  }
  function kmPersonnelGranted(fn){
    return !!(fn('people')||fn('positions')||fn('unitDossiers'));
  }
  var KM_PERSONNEL_OPS=['card','attach','vacant','units'];
  function kmPersonnelOpGranted(fn){
    if(kmPersonnelGranted(fn))return true;
    for(var i=0;i<KM_PERSONNEL_OPS.length;i++){
      if(fn('people:'+KM_PERSONNEL_OPS[i]))return true;
    }
    return false;
  }
  window.kmIsAccountingPage=function(pageName){
    return !!KM_ACCOUNTING_PAGES[String(pageName||'')];
  };

  /** Օգտատիրոջ լրիվ հասանելիություն (հին null կամ '*') */
  function kmUserHasFullAccess(){
    if(window.kmUserRole==='viewer')return false;
    if(window.kmUserRole==='editor'){
      if(Array.isArray(window.kmEditSections)&&window.kmEditSections.indexOf('*')>=0)return true;
      /* հին լեգասի օգտատեր՝ առանց գրանցված grant զանգվածի */
      if(window.kmEditSections==null&&window.kmViewSections==null&&!window.kmRegisteredAppUser)return true;
      return false;
    }
    if(window.kmEditSections==null)return true;
    if(Array.isArray(window.kmEditSections)&&window.kmEditSections.indexOf('*')>=0)return true;
    return false;
  }
  window.kmUserHasFullAccess=kmUserHasFullAccess;

  /** Ադմինիստրատոր (ոչ միայն սուպեր) — grant չի պահանջվում */
  window.kmIsAppAdmin=function(){
    if(window.kmUserRole==='admin')return true;
    if(typeof window.kmCanAdmin==='function'&&window.kmCanAdmin())return true;
    if(typeof window.kmIsSuperAdmin==='function'&&window.kmIsSuperAdmin())return true;
    try{
      if(sessionStorage.getItem('km_auth_mode')==='admin')return true;
    }catch(e){}
    return false;
  };


  /* KM_RBAC_ADMIN_DUAL_V1 */
  function kmAdminPermissionConfigured(){
    return window.kmUserRole==='admin' && window.kmAdminPermissionsConfigured===true;
  }
  function kmAdminCanAccess(section){
    if(window.kmIsSuperAdmin&&window.kmIsSuperAdmin()) return true;
    if(!kmAdminPermissionConfigured()){
      var legacy=window.kmAdminSections;
      return !legacy || !legacy.length ? true : listHasSection(legacy,section);
    }
    var av=(window.kmAdminEditSections||[]).concat(window.kmAdminViewSections||[]);
    if(listHasSection(av,section))return true;
    var kids=(window.kmGrantParents&&window.kmGrantParents[section])||[];
    for(var i=0;i<kids.length;i++){ if(av.indexOf(String(kids[i]))>=0)return true; }
    return false;
  }
  function kmAdminCanEdit(section){
    if(window.kmIsSuperAdmin&&window.kmIsSuperAdmin()) return true;
    if(!kmAdminPermissionConfigured()){
      var legacy=window.kmAdminSections;
      return !legacy || !legacy.length ? true : listHasSection(legacy,section);
    }
    var ae=window.kmAdminEditSections||[];
    if(listHasSection(ae,section))return true;
    var kids=(window.kmGrantParents&&window.kmGrantParents[section])||[];
    for(var i=0;i<kids.length;i++){ if(ae.indexOf(String(kids[i]))>=0)return true; }
    return false;
  }

  /** Անձնակազմ / Պաշտոն ընդհանուր գրել (ավելացնել պաշտոն, ցուցակ) */
  window.kmCanEditPersonnelOps=function(){
    if(window.kmUserRole==='viewer')return false;
    if(window.kmUserRole==='admin')return kmAdminCanEdit('people')||kmAdminCanEdit('positions')||kmAdminCanEdit('accounting');
    if(window.kmIsAppAdmin())return true;
    try{ if(sessionStorage.getItem('km_auth_mode')==='admin')return true; }catch(eA){}
    if(kmUserHasFullAccess())return true;
    if(typeof window.kmCanEdit!=='function')return false;
    return !!(window.kmCanEdit('people')||window.kmCanEdit('positions')||window.kmCanEdit('accounting'));
  };

  /** Քարտ / Կցել / Դարձնել թափուր / Զորամասեր — grant կամ ադմին */
  window.kmCanEditPersonnelOp=function(op){
    if(window.kmUserRole==='viewer')return false;
    if(window.kmUserRole==='admin'){
      if(kmAdminCanEdit('people')||kmAdminCanEdit('positions')||kmAdminCanEdit('accounting'))return true;
      op=String(op||'').trim();
      return !!(op && kmAdminCanEdit('people:'+op));
    }
    if(window.kmIsAppAdmin())return true;
    try{ if(sessionStorage.getItem('km_auth_mode')==='admin')return true; }catch(eA){}
    if(kmUserHasFullAccess())return true;
    op=String(op||'').trim();
    if(typeof window.kmCanEdit!=='function')return false;
    if(window.kmCanEdit('people')||window.kmCanEdit('positions')||window.kmCanEdit('accounting'))return true;
    return !!(op && window.kmCanEdit('people:'+op));
  };

  window.kmCanAccessPersonnelOp=function(op){
    if(window.kmUserRole==='admin'){
      if(kmAdminCanAccess('people')||kmAdminCanAccess('positions')||kmAdminCanAccess('accounting'))return true;
      op=String(op||'').trim();
      return !!(op && kmAdminCanAccess('people:'+op));
    }
    if(window.kmUserRole==='viewer')return true;
    if(kmUserHasFullAccess())return true;
    op=String(op||'').trim();
    if(typeof window.kmSectionGranted!=='function')return false;
    if(window.kmSectionGranted('people')||window.kmSectionGranted('positions')||window.kmSectionGranted('accounting'))return true;
    return !!(op && window.kmSectionGranted('people:'+op));
  };

  window.kmActorStamp=function(){
    var full=String(window.kmAuthFullName||(typeof sessionStorage!=='undefined'&&sessionStorage.getItem('km_auth_full_name'))||'').trim();
    var user=String(window.kmAuthUsername||(typeof sessionStorage!=='undefined'&&sessionStorage.getItem('km_auth_username'))||'').trim();
    return {
      user:user,
      fullName:(full&&full!==user)?full:full,
      userId:String(window.kmAuthUserId||(typeof sessionStorage!=='undefined'&&sessionStorage.getItem('km_auth_user_id'))||'').trim(),
      role:String(window.kmUserRole||'')
    };
  };

    /** KM_RIGHTS_V8 — toast + false when section/page is view-only */

  /* Fine-grained action API. UI code can call kmCan('people:attach','edit')
     or kmAssertCan('people:attach','edit') for individual buttons/functions. */
  window.kmCan=function(permission, level){
    level=String(level||'view').toLowerCase();
    if(level==='edit'||level==='write'||level==='full') return typeof window.kmCanEdit==='function' ? !!window.kmCanEdit(permission) : false;
    return typeof window.kmSectionGranted==='function' ? !!window.kmSectionGranted(permission) : true;
  };
  window.kmAssertCan=function(permission, level){
    var ok=window.kmCan(permission,level);
    if(!ok&&typeof toast==='function')toast(level==='view'?'Մուտքը արգելված է':'Միայն դիտում — փոփոխությունն արգելված է','warn');
    return !!ok;
  };

  window.kmAssertCanEdit=function(sectionOrPage){
    try{
      if(window.kmUserRole==='admin'&&!(kmAdminPermissionConfigured()&&!(window.kmIsSuperAdmin&&window.kmIsSuperAdmin())&&!kmIsSettingsScope(sectionOrPage, window.kmLibSection)))return true; /* KM_RIGHTS_V15_UNIVERSAL + KM_SETTINGS_UNTOUCHED */
      if(window.kmUserRole==='viewer'){
        if(typeof toast==='function')toast('Միայն դիտում — խմբագրում արգելված','warn');
        return false;
      }
      var ok=true;
      if(sectionOrPage!=null&&String(sectionOrPage).trim()!==''){
        ok=typeof window.kmCanEdit==='function'?!!window.kmCanEdit(sectionOrPage):false;
      }else if(typeof window.kmCanEditPage==='function'){
        ok=!!window.kmCanEditPage(window.page||'', window.kmLibSection);
      }else if(typeof window.kmCanEdit==='function'){
        ok=!!window.kmCanEdit();
      }
      if(!ok&&typeof toast==='function')toast('Միայն դիտում — խմբագրում արգելված','warn');
      return !!ok;
    }catch(e){ return false; }
  };

window.kmCanEdit=function(section){
    if(window.kmUserRole==='viewer')return false;
    if(window.kmUserRole==='admin'){
      if(window.kmIsSuperAdmin&&window.kmIsSuperAdmin())return true;
      if(!section)return true;
      return kmAdminCanEdit(section);
    }
    /* editor */
    if(kmUserHasFullAccess())return true;
    if(!Array.isArray(window.kmEditSections)||!window.kmEditSections.length)return false;
    if(!section){
      var pg=String(window.page||(typeof page!=='undefined'?page:'')||'').trim();
      var lawSub=String(window._kmLawSubPage||window._kmLawOpenSection||'').trim();
      if(lawSub)return listHasSection(window.kmEditSections,lawSub)||listHasSection(window.kmEditSections,'lawdocs');
      if(!pg||pg==='home'||pg==='about'||pg==='helpBot')return false;
      if(typeof window.kmCanEditPage==='function')return window.kmCanEditPage(pg, window.kmLibSection);
      return false;
    }
    return listHasSection(window.kmEditSections,section);
  };

  /** Բաժինը հասանելի է՞ (դիտում կամ փոփոխություն) */
  window.kmSectionGranted=function(section){
    if(window.kmUserRole==='admin')return kmAdminCanAccess(section);
    if(window.kmUserRole==='viewer')return true;
    if(kmUserHasFullAccess())return true;
    if(listHasSection(window.kmEditSections,section))return true;
    if(listHasSection(window.kmViewSections||[],section))return true;
    return false;
  };

  /** Գրանցված օգտատեր՝ ադմինը դեռ բաժին չի տվել (դատարկ, առանց '*') */
  window.kmUserGrantsLocked=function(){
    if(window.kmUserRole!=='editor')return false;
    if(kmUserHasFullAccess())return false;
    if(!Array.isArray(window.kmEditSections))return false;
    var vs=Array.isArray(window.kmViewSections)?window.kmViewSections:[];
    return window.kmEditSections.length===0&&vs.length===0;
  };

  /** Միայն դիտման ռեժիմ՝ գլոբալ կամ ընթացիկ էջում (mixed իրավունքներ) */
  /* KM_SETTINGS_UNTOUCHED: «Համակարգի կարգավորումներ» (and its network/fonts sub-pages) keep their pre-V15 behaviour. */
  function kmIsSettingsScope(name, lib){
    var n=String(name||'').trim(), l=String(lib||'').trim();
    return n==='syssettings'||n==='network'||n==='fonts'||l==='syssettings'||l==='network'||l==='fonts';
  }
  window.kmUserViewOnly=function(){
    if(window.kmUserRole==='admin'){ /* KM_RIGHTS_V15_UNIVERSAL: delegated admin with view-only grant on this page */
      if(window.kmIsSuperAdmin&&window.kmIsSuperAdmin())return false;
      if(!kmAdminPermissionConfigured())return false;
      var apg=String(window.page||(typeof page!=='undefined'?page:'')||'').trim();
      if(!apg||apg==='home'||apg==='about'||apg==='helpBot'||apg==='admins'||apg==='users')return false;
      if(kmIsSettingsScope(apg, window.kmLibSection))return false; /* KM_SETTINGS_UNTOUCHED */
      if(typeof window.kmCanAccessPage==='function'&&!window.kmCanAccessPage(apg, window.kmLibSection))return false;
      if(typeof window.kmCanEditPage==='function'&&window.kmCanEditPage(apg, window.kmLibSection))return false;
      if(kmIsPersonnelPage(apg)&&typeof window.kmCanEditPersonnelOp==='function'){
        for(var ai=0;ai<KM_PERSONNEL_OPS.length;ai++){ if(window.kmCanEditPersonnelOp(KM_PERSONNEL_OPS[ai]))return false; }
      }
      return true;
    }
    if(window.kmUserRole!=='editor')return false;
    if(kmUserHasFullAccess())return false;
    if(!Array.isArray(window.kmEditSections))return false;
    var vs=Array.isArray(window.kmViewSections)?window.kmViewSections:[];
    if(window.kmEditSections.length===0&&vs.length>0)return true;
    if(!window.kmEditSections.length)return false;
    var pg=String(window.page||(typeof page!=='undefined'?page:'')||'').trim();
    if(!pg||pg==='home'||pg==='about'||pg==='helpBot')return false;
    if(typeof window.kmCanAccessPage==='function'&&!window.kmCanAccessPage(pg, window.kmLibSection))return false;
    if(typeof window.kmCanEditPage==='function'&&window.kmCanEditPage(pg, window.kmLibSection))return false;
    /* Nested Անձնակազմ ops (Քարտ/Կցել/թափուր/Զորամասեր) — not a blanket view-only page */
    if(kmIsPersonnelPage(pg)&&typeof window.kmCanEditPersonnelOp==='function'){
      for(var i=0;i<KM_PERSONNEL_OPS.length;i++){
        if(window.kmCanEditPersonnelOp(KM_PERSONNEL_OPS[i]))return false;
      }
    }
    if(typeof window.kmCanEditPage==='function')return true;
    return false;
  };

  /** Էջ/բաժին հասանելի է՞ այս օգտատիրոջ view/edit իրավունքներով */
  window.kmCanAccessPage=function(pageName, libSection){
    pageName=String(pageName||'').trim();
    libSection=libSection!=null?String(libSection||'').trim():'';
    if(!pageName)return true;
    if(window.kmUserRole==='admin'){
      if(window.kmIsSuperAdmin&&window.kmIsSuperAdmin())return true;
      if(pageName==='admins'||pageName==='users')return false;
      return kmAdminCanAccess(pageName);
    }
    if(window.kmUserRole==='viewer'){
      if(pageName==='admins'||pageName==='users'||pageName==='sysinfo'||pageName==='fonts')return false;
      return true;
    }
    /* editor */
    if(kmUserHasFullAccess())return true;
    if(!Array.isArray(window.kmEditSections))return false;
    var vs=Array.isArray(window.kmViewSections)?window.kmViewSections:[];
    if(!window.kmEditSections.length&&!vs.length){
      return pageName==='home'||pageName==='about'||pageName==='helpBot';
    }
    if(pageName==='home'||pageName==='about'||pageName==='helpBot')return true;
    if(pageName==='admins'||pageName==='users'||pageName==='settings')return false; /* KM_RIGHTS_V8: sysinfo/fonts grantable */

    function allowed(id){
      return typeof window.kmSectionGranted==='function'?window.kmSectionGranted(id):false;
    }
    function anyChild(parentId){
      var kids=(window.kmGrantParents&&window.kmGrantParents[parentId])||[];
      for(var i=0;i<kids.length;i++){
        if(allowed(kids[i]))return true;
      }
      return false;
    }
    function libOk(sec){
      if(allowed('library'))return true;
      if(!sec){ /* KM_ARCHIVE_HUB_V1: children moved to the Արխիվ hub no longer open the Գրադարան hub */
        var __lk=(window.kmGrantParents&&window.kmGrantParents.library)||[];
        for(var __li=0;__li<__lk.length;__li++){ if(KM_ARCHIVE_MOVED_LIB.indexOf(__lk[__li])<0&&allowed(__lk[__li]))return true; }
        return allowed('reports')||allowed('lib:reports');
      }
      if(sec==='reports')return allowed('reports')||allowed('lib:reports')||anyChild('reports')||anyChild('lib:reports');
      var lid=sec.indexOf('lib:')===0?sec:('lib:'+sec);
      return allowed(lid)||allowed(sec);
    }

    if(pageName==='archiveHub'){ /* KM_ARCHIVE_HUB_V1 + KM_RIGHTS_V8 soldierCards */
      return allowed('archiveHub')||libOk('current')||libOk('hishoxutyun')||libOk('archive')||allowed('soldierCards');
    }
    if(pageName==='soldierCards')return allowed('soldierCards')||allowed('archiveHub')||libOk('archive');
    if(pageName==='syssettings'){
      return allowed('syssettings')||allowed('lib:syssettings')||allowed('network')||allowed('lib:network')||allowed('sysinfo')||allowed('lib:sysinfo')||allowed('lib:license')||allowed('license')||anyChild('syssettings'); /* KM_MENU15_V1 */
    }
    if(pageName==='network'){
      return allowed('network')||allowed('lib:network')||allowed('syssettings')||allowed('lib:syssettings')||libOk('network');
    }
    if(pageName==='fonts')return allowed('fonts')||allowed('lib:fonts')||allowed('syssettings');
    if(pageName==='sysinfo')return allowed('sysinfo')||allowed('lib:sysinfo')||allowed('archiveHub')||allowed('syssettings');

    if(pageName==='unitTools'){ /* KM_MENU_REORG_V1: own grant, any tool, or any moved library section (incl. the old library grant) */
      if(allowed('unitTools')||anyChild('unitTools'))return true;
      for(var __ti=0;__ti<KM_TOOLS_MOVED_LIB.length;__ti++){ if(libOk(KM_TOOLS_MOVED_LIB[__ti]))return true; }
      return false;
    }
    if(pageName==='accounting')return allowed('accounting')||anyChild('accounting');
    if(pageName==='lawdocs'||pageName==='codes')return allowed('lawdocs')||anyChild('lawdocs');
    if(pageName==='dutyTypes'||pageName==='schedule')return allowed('dutyTypes')||allowed('schedule')||anyChild('dutyTypes'); /* KM_MENU15_V1 */
    if(kmIsPersonnelPage(pageName))return kmPersonnelOpGranted(allowed)||allowed('accounting');
    if(pageName==='unitInventory'){ /* KM_INV_SCOPE_GRANTS_V1: a leaf grant (unitInventory:sub|svc[:kind]) opens the page */
      try{ var __iv=[].concat(window.kmEditSections||[],vs); for(var __ii=0;__ii<__iv.length;__ii++){ if(String(__iv[__ii]).indexOf('unitInventory:')===0&&!/:hamalr$/.test(String(__iv[__ii])))return true; /* KM_HAMALR_MOVE_V1 */ } }catch(eInv){}
    }
    if(pageName==='unitHamalr')return allowed('unitHamalr')||allowed('accounting')||allowed('unitInventory:sub:hamalr')||allowed('unitInventory:svc:hamalr'); /* KM_HAMALR_MOVE_V1: (unitInventory[:sub|svc] via kmGrantParents) */
    if(KM_ACCOUNTING_PAGES[pageName])return allowed(pageName)||allowed('accounting');
    if(pageName==='workStatus')return allowed(pageName)||allowed('accounting')||allowed('unitTools');
    if(pageName==='reports')return libOk('reports');

    var aliases={
      tables:'spreadsheets',spreadsheets:'spreadsheets',
      notes:'notes',registrations:'notes',holidays:'notes',management:'management',
      network:'network',license:'license',archive:'archive',
      hishoxutyun:'hishoxutyun',
      fonts:'fonts',sysinfo:'sysinfo',syssettings:'syssettings'
    };
    if(pageName==='holidays')return libOk('notes')||allowed('holidays')||allowed('notes');
    if(aliases[pageName])return libOk(aliases[pageName]);
    if(pageName==='library')return libOk(libSection||'');

    var sid=pageName;
    if(allowed(sid))return true;
    /* միայն unitTools / unitTrialLab ծնողներով — ոչ accounting unit* էջեր */
    if(KM_ACCOUNTING_PAGES[sid])return allowed('accounting');
    if(sid.indexOf('unitTrial')===0)return allowed('unitTrialLab')||allowed('unitTools');
    if(sid.indexOf('unit')===0)return allowed('unitTools');
    return false;
  };

  /** Էջը խմբագրելի է՞ (միայն editSections — view-only բաժինները false) */
  window.kmCanEditPage=function(pageName, libSection){
    pageName=String(pageName||'').trim();
    libSection=libSection!=null?String(libSection||'').trim():'';
    if(!pageName)return true;
    if(window.kmUserRole==='viewer')return false;
    if(window.kmUserRole==='admin'){
      if(window.kmIsSuperAdmin&&window.kmIsSuperAdmin())return true;
      /* KM_RIGHTS_V15_UNIVERSAL: delegated admin — current law sub-section / library section decide, not only the page */
      if(kmAdminPermissionConfigured()&&!kmIsSettingsScope(pageName, libSection)){ /* KM_SETTINGS_UNTOUCHED */
        if(pageName==='lawdocs'||pageName==='codes'){
          var __aLaw=String(window._kmLawSubPage||window._kmLawOpenSection||libSection||'').trim();
          if(__aLaw)return kmAdminCanEdit(__aLaw)||listHasSection(window.kmAdminEditSections||[],'lawdocs');
        }
        var __aLib=(pageName==='library'||pageName==='archiveHub'||pageName==='unitTools')?libSection:'';
        if(__aLib){ var __aid=__aLib.indexOf('lib:')===0?__aLib:('lib:'+__aLib); if(kmAdminCanEdit(__aid)||kmAdminCanEdit(__aLib))return true; }
      }
      return kmAdminCanEdit(pageName);
    }
    if(kmUserHasFullAccess())return true;
    if(!Array.isArray(window.kmEditSections)||!window.kmEditSections.length)return false;
    if(pageName==='home'||pageName==='about'||pageName==='helpBot')return false;
    if(pageName==='admins'||pageName==='users'||pageName==='settings')return false; /* KM_RIGHTS_V8: sysinfo/fonts grantable */

    function editable(id){
      return listHasSection(window.kmEditSections,id);
    }
    function anyChildEdit(parentId){
      var kids=(window.kmGrantParents&&window.kmGrantParents[parentId])||[];
      for(var i=0;i<kids.length;i++){
        if(editable(kids[i]))return true;
      }
      return false;
    }
    function libEditOk(sec){
      if(editable('library'))return true;
      if(!sec)return false;
      if(sec==='reports')return editable('reports')||editable('lib:reports')||anyChildEdit('reports')||anyChildEdit('lib:reports');
      var lid=sec.indexOf('lib:')===0?sec:('lib:'+sec);
      return editable(lid)||editable(sec);
    }

    if(pageName==='archiveHub')return editable('archiveHub')||libEditOk('current')||libEditOk('hishoxutyun')||libEditOk('archive')||editable('soldierCards'); /* KM_ARCHIVE_HUB_V1 + KM_RIGHTS_V8 */
    if(pageName==='soldierCards')return editable('soldierCards')||editable('archiveHub');
    if(pageName==='unitTools'){ /* KM_MENU_REORG_V1 */
      if(editable('unitTools')||anyChildEdit('unitTools'))return true;
      for(var __te=0;__te<KM_TOOLS_MOVED_LIB.length;__te++){ if(libEditOk(KM_TOOLS_MOVED_LIB[__te]))return true; }
      return false;
    }
    /* Hub էջեր՝ խմբագրելի միայն եթե ծնողն է տրված (ոչ ցանկացած երեխա) */
    if(pageName==='accounting')return editable('accounting');
    if(pageName==='lawdocs'||pageName==='codes'){
      /* Միայն ընթացիկ ենթաբաժինը կամ ամբողջ lawdocs ծնողը — ոչ ցանկացած երեխա */
      var lawSub=String(window._kmLawSubPage||window._kmLawOpenSection||libSection||'').trim();
      if(lawSub) return editable(lawSub) || editable('lawdocs');
      return editable('lawdocs');
    }
    if(pageName==='dutyTypes'||pageName==='schedule')return editable('dutyTypes')||editable('schedule');
    if(kmIsPersonnelPage(pageName))return kmPersonnelGranted(editable);
    if(pageName==='unitInventory'){ /* KM_INV_SCOPE_GRANTS_V1: per-section edit is enforced inside the page */
      try{ var __ie=window.kmEditSections||[]; for(var __ij=0;__ij<__ie.length;__ij++){ if(String(__ie[__ij]).indexOf('unitInventory:')===0&&!/:hamalr$/.test(String(__ie[__ij])))return true; /* KM_HAMALR_MOVE_V1 */ } }catch(eInv){}
    }
    if(pageName==='unitHamalr')return editable('unitHamalr')||editable('accounting')||editable('unitInventory:sub:hamalr')||editable('unitInventory:svc:hamalr'); /* KM_HAMALR_MOVE_V1: per-path edit is enforced inside the page */
    if(KM_ACCOUNTING_PAGES[pageName])return editable(pageName);
    if (pageName==='workStatus')return editable(pageName)||editable('accounting')||editable('unitTools');
    if(pageName==='reports')return libEditOk('reports');
    if(pageName==='syssettings')return editable('syssettings')||editable('lib:syssettings')||editable('network')||editable('lib:network');
    if(pageName==='network')return editable('network')||editable('lib:network')||editable('syssettings')||editable('lib:syssettings')||libEditOk('network');
    if(pageName==='fonts')return editable('fonts')||editable('lib:fonts')||editable('syssettings');
    if(pageName==='sysinfo')return editable('sysinfo')||editable('lib:sysinfo')||editable('archiveHub')||editable('syssettings');

    var aliases={
      tables:'spreadsheets',spreadsheets:'spreadsheets',
      notes:'notes',registrations:'notes',holidays:'notes',management:'management',
      network:'network',license:'license',archive:'archive',
      hishoxutyun:'hishoxutyun',
      fonts:'fonts',sysinfo:'sysinfo',syssettings:'syssettings'
    };
    if(pageName==='holidays')return libEditOk('notes')||editable('holidays')||editable('notes');
    if(aliases[pageName])return libEditOk(aliases[pageName]);
    if(pageName==='library')return libEditOk(libSection||'');

    var sid=pageName;
    if(editable(sid))return true;
    if(KM_ACCOUNTING_PAGES[sid])return false;
    if(sid.indexOf('unitTrial')===0)return editable('unitTrialLab')||editable('unitTools');
    if(sid.indexOf('unit')===0)return editable('unitTools');
    return false;
  };

  window.kmRequireGrant=function(sectionOrPage, libSection){
    if(window.kmUserRole!=='editor')return true;
    if(kmUserHasFullAccess())return true;
    var id=String(sectionOrPage||'').trim();
    if(!id)return true;
    var ok=false;
    if(typeof window.kmCanAccessPage==='function'&&(id.indexOf('lib:')===0||libSection!=null)){
      ok=window.kmCanAccessPage(id.indexOf('lib:')===0?'library':id, libSection!=null?libSection:(id.indexOf('lib:')===0?id.slice(4):''));
    }else if(typeof window.kmSectionGranted==='function'){
      ok=window.kmSectionGranted(id);
      if(!ok&&typeof window.kmCanAccessPage==='function')ok=window.kmCanAccessPage(id, libSection||'');
    }else ok=true;
    if(!ok){
      if(typeof toast==='function')toast('Այս բաժինը ձեզ թույլատրված չէ','error');
      else if(typeof window.kmNotify==='function')window.kmNotify('Այս բաժինը ձեզ թույլատրված չէ','error');
      return false;
    }
    return true;
  };

  window.kmApplyUserNavGrants=function(){
    var menu=document.getElementById('kmSideMenu');
    if(!menu)return;
    var restricted=window.kmUserRole==='editor'&&Array.isArray(window.kmEditSections);
    menu.querySelectorAll(':scope > .nav[data-page]').forEach(function(nav){
      var pg=nav.getAttribute('data-page')||'';
      if(pg==='home'||pg==='about'||pg==='helpBot'||nav.classList.contains('km-exit-nav')){
        nav.style.removeProperty('display');
        nav.removeAttribute('data-km-grant-hidden');
        return;
      }
      if(!restricted){
        nav.style.removeProperty('display');
        nav.removeAttribute('data-km-grant-hidden');
        return;
      }
      var ok=typeof window.kmCanAccessPage==='function'?window.kmCanAccessPage(pg):true;
      if(ok){
        nav.style.removeProperty('display');
        nav.removeAttribute('data-km-grant-hidden');
      }else{
        nav.style.setProperty('display','none','important');
        nav.setAttribute('data-km-grant-hidden','1');
      }
    });
  };

  window.kmFilterGrantCards=function(root){
    root=root||document.getElementById('content');
    if(!root)return;
    if(!(window.kmUserRole==='editor'&&Array.isArray(window.kmEditSections)))return;
    if(kmUserHasFullAccess())return;
    function granted(id){
      /* KM_RESERVE_GRANT_VIA_ACCOUNTING_V1 */
      var base=typeof window.kmSectionGranted==='function'?window.kmSectionGranted:function(){return true;};
      if(id==='unitReserve'){
        if(base('unitReserve')||base('accounting')||base('unitArchive')||base('people'))return true;
      }
      if(id==='unitHamalr'){ /* KM_HAMALR_MOVE_V1 */
        if(base('unitHamalr')||base('accounting')||base('unitInventory:sub:hamalr')||base('unitInventory:svc:hamalr'))return true;
      }
      return base(id);
    }
    root.querySelectorAll('.kmLawCard[onclick],button.kmLawCard[onclick]').forEach(function(card){
      var oc=String(card.getAttribute('onclick')||'');
      var id='';
      var m;
      if((m=oc.match(/kmLibSetSection\(\s*['"]([^'"]+)['"]\s*\)/)))id=m[1];
      else if((m=oc.match(/kmOpenPage\(\s*['"]([^'"]+)['"]\s*\)/)))id=m[1];
      else if((m=oc.match(/value:\s*['"]([^'"]+)['"]/)))id=m[1];
      else if((m=oc.match(/kmUnitOpen\(\s*['"]([^'"]+)['"]\s*\)/)))id=m[1];
      else if((m=oc.match(/openVacations\s*\(/)))id='vacations';
      else if((m=oc.match(/openDutyTypes|openDutyTypesSection/)))id='dutyTypes';
      else if((m=oc.match(/kmOpenUsbHub|kmHomeReportsOpen\(\s*['"]usb['"]/)))id='usb'; /* KM_MENU15_V1 */
      else if((m=oc.match(/kmHomeReportsOpen|kmReportsPage|kmOpenLibrarySection\(\s*['"]reports['"]/)))id='reports';
      else if((m=oc.match(/kmOpenHolidays/)))id='notes';
      else if((m=oc.match(/kmWorkloadReport/)))id='workload';
      else if((m=oc.match(/kmOpenRankRules/)))id='rankRules';
      else if((m=oc.match(/kmOpenFreePeople/)))id='freePeople';
      else if((m=oc.match(/kmOpenOrderDraft/)))id='orderDraft';
      else if((m=oc.match(/kmOpenDutyKiosk/)))id='dutyKiosk';
      else if((m=oc.match(/openWorkStatus/)))id='workStatus';
      else if((m=oc.match(/kmOpenDocsPack/)))id='docsPack';
      else if((m=oc.match(/kmExportMonthGraphs/)))id='exportMonthGraphs';
      else if((m=oc.match(/kmMonthSummaryPage|monthSummary/)))id='monthSummary';
      else if((m=oc.match(/kmCharacteristicPage/)))id='characteristic';
      else if((m=oc.match(/kmEncouragementsPage/)))id='encouragements';
      else if((m=oc.match(/kmDisciplinePenaltiesPage/)))id='acts_discipline';
      else if((m=oc.match(/kmLawsConstitutionHub/)))id='constitution_hub';
      else if((m=oc.match(/kmLawsOpenStatutesHub/)))id='statutes';
      else if((m=oc.match(/kmLawsOpenOrdersHub/)))id='orders';
      else if((m=oc.match(/kmSoldierRightsHub\s*\(/)))id='soldier_rights';
      else if((m=oc.match(/kmSoldierRightsOpen\(\s*['"]([^'"]+)['"]\s*\)/)))id=m[1];
      else if((m=oc.match(/kmLawsOpenLocal\(\s*['"]([^'"]+)['"]\s*\)/)))id=m[1];
      else if((m=oc.match(/kmTrialOpen\(\s*['"]([^'"]+)['"]/)))id=m[1];
      else if((m=oc.match(/kmSysSettingsOpen\(\s*['"]([^'"]+)['"]/)))id=m[1];
      else if((m=oc.match(/kmArchiveOpen\(\s*['"]([^'"]+)['"]/)))id=m[1]; /* KM_ARCHIVE_HUB_V1 */
      if(!id)return;
      var ok=true;
      function anyKid(parentId){
        var kids=(window.kmGrantParents&&window.kmGrantParents[parentId])||[];
        for(var i=0;i<kids.length;i++){ if(granted(kids[i]))return true; }
        return false;
      }
      if(id==='reports')ok=granted('reports')||granted('lib:reports')||granted('library');
      else if(id==='network'||id==='sysinfo'||id==='syssettings'){
        ok=granted(id)||granted('lib:'+id)||granted('syssettings')||granted('lib:syssettings');
        if(id==='network'&&!ok)ok=granted('library')||granted('lib:network');
      }
      else if(['notes','files','management','spreadsheets','license','original','convert','current','hishoxutyun','archive','fonts','pdfTranslate'/* KM_MENU_REORG_V1 */].indexOf(id)>=0){
        ok=granted('lib:'+id)||granted('library')||granted(id);
      }else if(id==='soldierCards'){ /* KM_RIGHTS_V8 */
        ok=granted('soldierCards')||granted('archiveHub')||granted('lib:archive')||granted('archive');
      }else if(id==='fonts'){
        ok=granted('fonts')||granted('lib:fonts')||granted('syssettings');
      }else{
        ok=granted(id);
        if(!ok&&id==='schedule')ok=granted('dutyTypes');
        if(!ok&&KM_ACCOUNTING_PAGES[id])ok=granted('accounting');
        if(!ok&&id==='unitInventory'){ try{ ok=typeof window.kmCanAccessPage==='function'&&!!window.kmCanAccessPage('unitInventory'); }catch(eInv){} } /* KM_INV_SCOPE_GRANTS_V1 */
        if(!ok&&kmIsPersonnelPage(id))ok=kmPersonnelOpGranted(granted)||granted('accounting');
        if(!ok&&id==='workStatus')ok=granted('accounting')||granted('unitTools');
        if(!ok&&(id==='constitution_hub'||id==='statutes'||id==='orders'||id==='directives'||id==='characteristic'||id==='encouragements'||id==='acts_discipline'||id==='acts_exam')){
          ok=granted('lawdocs')||anyKid(id);
        }
        if(!ok&&(window.kmGrantParents&&window.kmGrantParents.constitution_hub||[]).indexOf(id)>=0){
          ok=granted('constitution_hub')||granted('lawdocs');
        }
        if(!ok&&(window.kmGrantParents&&window.kmGrantParents.statutes||[]).indexOf(id)>=0){
          ok=granted('statutes')||granted('lawdocs');
        }
        if(!ok&&(window.kmGrantParents&&window.kmGrantParents.orders||[]).indexOf(id)>=0){
          ok=granted('orders')||granted('lawdocs');
        }
        if(!ok&&(id==='soldier_rights'||String(id).indexOf('rights_')===0)){
          ok=granted('soldier_rights')||granted('lawdocs');
          if(!ok&&id==='soldier_rights'&&window.kmGrantParents&&window.kmGrantParents.soldier_rights){
            var rk=window.kmGrantParents.soldier_rights;
            for(var ri=0;ri<rk.length;ri++){ if(granted(rk[ri])){ ok=true; break; } }
          }
        }
      }
      card.style.display=ok?'':'none';
    });
  };

  window.kmRenderGrantsLockedHome=function(){
    var host=document.getElementById('content');
    if(!host)return;
    host.innerHTML=
      '<div class="card" style="max-width:560px;margin:24px auto;padding:28px 24px;text-align:center">'+
      '<div style="font-size:42px;line-height:1;margin-bottom:12px" aria-hidden="true">🔒</div>'+
      '<h3 class="kmLawsHubTitle" style="margin:0 0 10px">Ֆունկցիաները դեռ անհասանելի են</h3>'+
      '<p class="kmLawsHubLead" style="margin:0 0 8px">Ձեր հաշիվը գրանցված է։ Բոլոր բաժինները կբացվեն միայն այն բանից հետո, երբ ադմինիստրատորը տա էջերի իրավունքներ։</p>'+
      '<p class="muted" style="margin:12px 0 0;font-size:13px">Դիմեք ադմինիստրատորին՝ «Օգտատերերի էջերի կառավարում» → Էջերի իրավունքներ → Միայն դիտել կամ Փոփոխություններ կատարել։</p>'+
      '</div>';
    var pt=document.getElementById('pageTitle');
    if(pt)pt.textContent='Սպասում է թույլտվության';
  };
  window.kmCanAdmin=function(){
    return window.kmUserRole==='admin';
  };
  window.kmIsSuperAdmin=function(){
    if(window.kmUserRole!=='admin')return false;
    if(window.kmSuperAdmin===true)return true;
    try{
      if(sessionStorage.getItem('km_auth_super')==='1')return true;
      var u=String(window.kmAuthUsername||sessionStorage.getItem('km_auth_username')||'').trim();
      if(u==='Koryun1992')return true;
      /* Գործարանային/հիմնական ադմին՝ առանց սահմանափակ բաժինների */
      if((!window.kmAdminSections||!window.kmAdminSections.length)&&sessionStorage.getItem('km_auth_mode')==='admin'){
        if(!u||u==='Koryun1992')return true;
      }
    }catch(e){}
    return false;
  };

  /** Shared DB keys for hub sync. Other local keys stay machine-local. */
  window.kmSyncShareKeys=function(){
    return [
      'version','people','schedule','dutyTypes','dutyTypeSchedules','dutyPosts','vacations',
      'tables','spreadsheets','registrations','notebookNotes','archives','futureSchedules',
      'units','cellComments','substitutions','dutyRankRules','dutyGraphTemplates','scheduleTemplates',
      'printPresets','orderDraft','troopStructure','positionAssignments','userPositions','positionArchives','peopleRemoved','kmOrg','kmCorpsData','_kmCorpsId',
      'disciplinePenalties','disciplinePenaltiesArchive','personCharacteristics',
      'personEncouragements','monthSummaries',
      'unitDocs','unitInventory','unitInventoryServices','unitCharDrafts','unitFuel','unitDayPlans','unitMedical',
      'unitLeavePlan','unitArchive','unitFormalArchives','unitBlanks','unitDossiers','unitFormation','unitTermWatch',
      'trialExamDrafts','trialCharDrafts','trialMonitorDismissed',
      'kmSavedAt'
    ];
  };
  /**
   * Keys that must NOT be overwritten by network sync for this role
   * (forbidden sections stay local / admin-owned).
   */
  window.kmSyncProtectedKeys=function(role){
    role = role || window.kmUserRole || 'viewer';
    var set = {};
    function add(arr){ (arr||[]).forEach(function(k){ set[k]=true; }); }
    // Always keep machine-local / security-adjacent keys if present
    add(['kmLocalOnly','licenseLocal','securityLocal']);
    if (role !== 'admin') {
      // Non-admin cannot absorb hub wipe of admin-gated archives as destructive local wipe of their view —
      // but they SHOULD receive shared dossier data to see. No extra protect for share keys.
      // Forbidden UI sections (sysinfo/fonts) are not in DB.
    }
    if (role === 'viewer') {
      // Viewer receives shared view data; editing remains blocked by kmApplyRoleGuard.
      // Do not protect share keys — otherwise they would not see hub updates.
    }
    return set;
  };
  window.kmBuildSharePayload=function(sourceDb){
    var src = sourceDb || (typeof db !== 'undefined' ? db : null);
    if (!src || typeof src !== 'object') return {};
    try {
      if (typeof window.kmSyncCorpsSlice === 'function') window.kmSyncCorpsSlice();
    } catch (eS) {}
    var keys = window.kmSyncShareKeys();
    var out = {};
    keys.forEach(function(k){
      if (k === 'kmCorpsData') return;
      if (Object.prototype.hasOwnProperty.call(src, k)) out[k] = src[k];
    });
    var sliceId = typeof window.kmActiveCorpsSliceId === 'function' ? window.kmActiveCorpsSliceId() : '';
    if (sliceId && src.kmCorpsData && src.kmCorpsData[sliceId]) {
      out.kmCorpsData = {};
      out.kmCorpsData[sliceId] = src.kmCorpsData[sliceId];
      out._kmCorpsId = sliceId;
    }
    if (!out.kmSavedAt) out.kmSavedAt = new Date().toISOString();
    return out;
  };

  window.kmNotify=function(msg,type){
    type=type||'info';
    if(!notifEl){
      notifEl=document.createElement('div');
      notifEl.id='kmNotifyCenter';
      notifEl.style.cssText='position:fixed;top:44px;right:12px;z-index:400000;display:flex;flex-direction:column;gap:8px;max-width:360px';
      document.body.appendChild(notifEl);
    }
    const colors={info:'#17212b',ok:'#1a5c3a',warn:'#7a5a00',error:'#7a2020'};
    const el=document.createElement('div');
    el.style.cssText='background:'+(colors[type]||colors.info)+';color:#fff;padding:10px 14px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,.2);font-size:13px';
    el.textContent=(typeof window.kmTranslateUI==='function'?window.kmTranslateUI(String(msg||'')):String(msg||''));
    notifEl.appendChild(el);
    setTimeout(()=>el.remove(),4200);
    if(typeof toast==='function')toast(msg);
  };

  function kmCloneForUndo(src){
    try{
      var slim=typeof window.kmSlimDbForPersist==='function'?window.kmSlimDbForPersist(src):src;
      if(slim&&typeof slim==='object'){
        slim=Object.assign({},slim);
        delete slim.kmCorpsData;
      }
      return JSON.parse(JSON.stringify(slim));
    }catch(e){ return null; }
  }
  window.kmPushUndo=function(label,beforeDb){
    try{
      if(document.body&&document.body.classList.contains('km-boot-idle'))return;
      var snap=beforeDb&&beforeDb.__kmUndoSnap?beforeDb:kmCloneForUndo(beforeDb);
      if(!snap)return;
      snap.__kmUndoSnap=true;
      undoStack.push({label:label||'change',db:snap});
      if(undoStack.length>MAX_UNDO)undoStack.shift();
      redoStack.length=0;
    }catch(e){}
  };

  let lastSnap=null;
  let lastSnapFp='';
  window.__kmUndoMute=false;

  function kmDbFingerprint(){
    try{
      if(typeof db==='undefined'||!db)return '';
      var keys=['people','userPositions','positionAssignments','schedule','notebookNotes','registrations','vacations'];
      var p=keys.map(function(k){
        var v=db[k];
        if(Array.isArray(v))return k+':'+v.length;
        if(v&&typeof v==='object')return k+':'+Object.keys(v).length;
        return k+':0';
      }).join('|');
      return p+'@'+String(db.kmSavedAt||'');
    }catch(e){return String(Date.now());}
  }

  window.kmUndoCaptureBaseline=function(){
    try{
      if(document.body&&document.body.classList.contains('km-boot-idle')){
        lastSnap=null;
        lastSnapFp='';
        return;
      }
      lastSnapFp=kmDbFingerprint();
      lastSnap=kmCloneForUndo(db);
      if(lastSnap) lastSnap.__kmUndoSnap=true;
    }catch(e){lastSnap=null;lastSnapFp='';}
  };

  function kmDbChangedFromSnap(){
    try{
      if(!lastSnap)return false;
      return lastSnapFp!==kmDbFingerprint();
    }catch(e){return true;}
  }

  function kmHotkeyCanWrite(){
    if(window.kmUserRole==='viewer')return false;
    if(typeof window.kmUserViewOnly==='function'&&window.kmUserViewOnly())return false;
    return true;
  }

  function kmRestoreExcelAfterUndo(prev){
    try{
      if(!prev||typeof prev!=='object')return;
      if(!db.kmCorpsData&&prev.kmCorpsData) db.kmCorpsData=prev.kmCorpsData;
      function takeB64(list, map){
        (list||[]).forEach(function(a){ if(a&&a.id&&a.base64) map[a.id]=a.base64; });
      }
      function putB64(list, map){
        (list||[]).forEach(function(a){ if(a&&a.id&&!a.base64&&map[a.id]) a.base64=map[a.id]; });
      }
      var map=Object.create(null);
      takeB64(prev.positionArchives, map);
      if(prev.kmCorpsData&&typeof prev.kmCorpsData==='object'){
        Object.keys(prev.kmCorpsData).forEach(function(k){
          takeB64(prev.kmCorpsData[k]&&prev.kmCorpsData[k].positionArchives, map);
        });
      }
      putB64(db.positionArchives, map);
      if(db.kmCorpsData&&typeof db.kmCorpsData==='object'){
        Object.keys(db.kmCorpsData).forEach(function(k){
          putB64(db.kmCorpsData[k]&&db.kmCorpsData[k].positionArchives, map);
        });
      }
    }catch(eR){}
  }
  function kmApplyUndoSnap(snap){
    var prev={
      kmCorpsData: db.kmCorpsData,
      positionArchives: db.positionArchives
    };
    Object.keys(db).forEach(function(k){ delete db[k]; });
    Object.assign(db, snap||{});
    delete db.__kmUndoSnap;
    kmRestoreExcelAfterUndo(prev);
  }

  window.kmUndo=async function(){
    if(!kmHotkeyCanWrite()){kmNotify('Դիտորդի իրավունքով հետարկում անհնար','error');return;}
    const item=undoStack.pop();if(!item){kmNotify('Հետարկելու բան չկա','warn');return;}
    var redoSnap=kmCloneForUndo(db); if(redoSnap) redoSnap.__kmUndoSnap=true;
    redoStack.push({label:item.label,db:redoSnap});
    kmApplyUndoSnap(item.db);
    if(typeof normalize==='function')normalize();
    window.__kmUndoMute=true;
    try{
      if(typeof save==='function')await save(true);
    }finally{window.__kmUndoMute=false;}
    kmUndoCaptureBaseline();
    if(typeof render==='function')render();
    kmNotify('Հետարկվել՝ '+item.label,'ok');
  };

  window.kmRedo=async function(){
    if(!kmHotkeyCanWrite())return;
    const item=redoStack.pop();if(!item){kmNotify('Կրկնելու բան չկա','warn');return;}
    var undoSnap=kmCloneForUndo(db); if(undoSnap) undoSnap.__kmUndoSnap=true;
    undoStack.push({label:item.label,db:undoSnap});
    kmApplyUndoSnap(item.db);
    if(typeof normalize==='function')normalize();
    window.__kmUndoMute=true;
    try{
      if(typeof save==='function')await save(true);
    }finally{window.__kmUndoMute=false;}
    kmUndoCaptureBaseline();
    if(typeof render==='function')render();
    kmNotify('Կրկնվել՝ '+item.label,'ok');
  };

  window.kmApplyRoleGuard=function(){
    if(window._kmRoleGuardTimer){
      clearTimeout(window._kmRoleGuardTimer);
      window._kmRoleGuardTimer=null;
    }
    const run=window._kmApplyRoleGuardNow||function(){};
    /* coalesce bursts (login + render) into one pass */
    window._kmRoleGuardTimer=setTimeout(function(){
      window._kmRoleGuardTimer=null;
      run();
    },16);
  };
  window._kmApplyRoleGuardNow=function(){
    const viewer=window.kmUserRole==='viewer';
    const admin=window.kmUserRole==='admin';
    const user=window.kmUserRole==='editor';
    const grantsLocked=typeof window.kmUserGrantsLocked==='function'&&window.kmUserGrantsLocked();
    const viewOnly=typeof window.kmUserViewOnly==='function'&&window.kmUserViewOnly();
    const readOnlyUi=viewer||viewOnly;
    document.body.classList.toggle('km-role-viewer',viewer);
    document.body.classList.toggle('km-role-admin',admin);
    document.body.classList.toggle('km-role-user',user);
    document.body.classList.toggle('km-role-grants-locked',grantsLocked);
    document.body.classList.toggle('km-role-view-only',viewOnly);
    if(!document.getElementById('km-grants-locked-css')){
      var st=document.createElement('style');
      st.id='km-grants-locked-css';
      st.textContent=
        'body.km-role-grants-locked #kmSideMenu > .nav:not(.km-exit-nav):not([data-page="about"]):not([data-page="home"]){'+
        'display:none!important;visibility:hidden!important;pointer-events:none!important;max-height:0!important;margin:0!important;padding:0!important;border:none!important;overflow:hidden!important}'+
        'body.km-role-grants-locked #kmSideMenu > .nav[data-page="home"],'+
        'body.km-role-grants-locked #kmSideMenu > .nav[data-page="about"],'+
        'body.km-role-grants-locked #kmSideMenu > .nav.km-exit-nav{display:flex!important;visibility:visible!important;pointer-events:auto!important;max-height:none!important}';
      document.head.appendChild(st);
    }
    if(grantsLocked){
      var curPage=String(window.page||(typeof page!=='undefined'?page:'')||'');
      if(curPage&&curPage!=='about'&&curPage!=='home'&&typeof window.kmOpenPage==='function'){
        try{window.kmOpenPage('home');}catch(eLock){}
      }else if((!curPage||curPage==='home')&&typeof window.kmRenderGrantsLockedHome==='function'){
        try{
          if(typeof page!=='undefined')page='home';
          window.page='home';
          window.kmRenderGrantsLockedHome();
        }catch(eHome){}
      }
    }
    if(!admin){
      document.querySelectorAll('#kmLibSections .kmLawCard[data-admin-only="1"],#kmToolsLibSections .kmLawCard[data-admin-only="1"]'/* KM_MENU_REORG_V1 */).forEach(function(el){el.remove();});
      if(window.kmLibSection==='fonts'||window.kmLibSection==='sysinfo'){
        window.kmLibSection='files';
        if(typeof window.kmLibSetSection==='function'&&((typeof page!=='undefined'&&page==='library')||window.page==='library')){
          try{window.kmLibSetSection('files');}catch(e){}
        }
      }
    }
    document.querySelectorAll('#saveBtn').forEach(b=>{
      if(b)b.disabled=readOnlyUi;
      if(b)b.title=readOnlyUi?'Միայն դիտում — խմբագրում արգելված':'';
    });

    /* KM_UI_GRANTS_V1: sub-section / field / button rights declared in km-users-ui.js (window.KM_UI_GRANT_LEAVES).
       view  -> hidden when the user has no access at all
       edit  -> hidden without access, disabled with view-only
       field -> hidden without access, disabled (read-only) with view-only
       A right given on any ancestor (accounting, people, people:card, positions ...) counts, so existing users keep what they had.
       Only marks set here (data-km-ug) are ever undone. Settings are not part of this table. */
    try{
      var ugLeaves=window.KM_UI_GRANT_LEAVES;
      /* Perf: ~60 selector scans per pass are only worth it on accounting pages or when the person-card dialog is open;
         never on the admin/user rights panels (large DOM, many clicks -> many passes). */
      var ugPg=String(window.page||(typeof page!=='undefined'?page:'')||'');
      var ugRelevant=ugPg!=='admins'&&ugPg!=='users'; /* never on the rights panels: large DOM, many clicks */
      if(ugRelevant&&Array.isArray(ugLeaves)&&ugLeaves.length&&!document.getElementById('kmLoginOverlay')){
        /* Ancestors count only through the user's own explicit lists: kmCanEdit(ancestor) would also say yes when just
           ONE descendant was granted, which would silently unlock every sibling field/button. */
        var ugAncestorGranted=function(anc,edit){
          var role=window.kmUserRole, lists;
          if(role==='admin')lists=edit?[window.kmAdminEditSections]:[window.kmAdminEditSections,window.kmAdminViewSections];
          else if(role==='editor')lists=edit?[window.kmEditSections]:[window.kmEditSections,window.kmViewSections];
          else return !edit; /* viewer: may look, never edit */
          for(var li=0;li<lists.length;li++){
            if(!Array.isArray(lists[li])||!lists[li].length)continue;
            for(var ai=0;ai<anc.length;ai++){ if(listHasSection(lists[li],anc[ai]))return true; }
          }
          return false;
        };
        var ugCan=function(id,anc,edit){
          var fn=edit?window.kmCanEdit:window.kmSectionGranted;
          if(typeof fn!=='function')return true; /* fail open */
          if(fn(id))return true;
          return ugAncestorGranted(anc,edit);
        };
        if(!ugLeaves.__all){
          var okSel=[];
          ugLeaves.forEach(function(lf){ try{ document.querySelector(lf.sel); okSel.push(lf.sel); }catch(eBad){ lf.__bad=true; } });
          ugLeaves.__all=okSel.join(',');
        }
        var ugCand=ugLeaves.__all?document.querySelectorAll(ugLeaves.__all):[];
        if(ugCand.length){
          var ugCache=Object.create(null);
          ugCand.forEach(function(el){
            ugLeaves.forEach(function(lf){
              if(lf.__bad)return;
              var hit=false;
              try{ hit=el.matches(lf.sel); }catch(eM){ hit=false; }
              if(!hit)return;
              var st=ugCache[lf.id];
              if(!st){ st=ugCache[lf.id]={v:ugCan(lf.id,lf.anc||[],false),e:ugCan(lf.id,lf.anc||[],true)}; }
              var canV=st.v, canE=st.e;
              var mark=el.getAttribute('data-km-ug')||'';
              var box=null;
              if(lf.level==='field'&&el.closest){ box=el.closest('.kmPcField')||el.closest('label')||null; }
              var wantHide=!canV;
              var wantDisable=canV&&!canE&&lf.level!=='view';
              if(wantHide){
                if(mark!=='hid'){
                  el.setAttribute('data-km-ug','hid');
                  (box||el).style.setProperty('display','none','important');
                }
              }else if(wantDisable){
                if(mark==='hid'){ (box||el).style.removeProperty('display'); }
                if(mark!=='dis'){
                  el.setAttribute('data-km-ug','dis');
                  if('disabled' in el)el.disabled=true;
                  el.setAttribute('aria-disabled','true');
                  if(!el.title)el.title='Միայն դիտում — փոփոխությունն արգելված';
                }
              }else if(mark){
                if(mark==='hid'){ (box||el).style.removeProperty('display'); }
                if(mark==='dis'){
                  if('disabled' in el)el.disabled=false;
                  el.removeAttribute('aria-disabled');
                  if(el.title==='Միայն դիտում — փոփոխությունն արգելված')el.removeAttribute('title');
                }
                el.removeAttribute('data-km-ug');
              }
            });
          });
        }
      }
    }catch(eUg){ try{ console.error('[KM] ui-grants:',eUg&&eUg.message); }catch(_e){} }

    /* Fine-grained permission attributes: any button/input may declare
       data-km-permission="people:attach" and optional
       data-km-permission-level="view|edit". */
    document.querySelectorAll('[data-km-permission]').forEach(function(el){
      var perm=String(el.getAttribute('data-km-permission')||'').trim();
      if(!perm)return;
      var lvl=String(el.getAttribute('data-km-permission-level')||'view').toLowerCase();
      var ok=typeof window.kmCan==='function'?window.kmCan(perm,lvl):true;
      if(!ok){
        if(lvl==='edit'||lvl==='write'||lvl==='full'){
          if('disabled' in el)el.disabled=true;
          el.setAttribute('aria-disabled','true');
          el.title=el.title||'Միայն դիտում — փոփոխությունն արգելված';
        }else{
          el.style.setProperty('display','none','important');
          el.setAttribute('aria-hidden','true');
        }
      }else{
        if(el.getAttribute('aria-disabled')==='true'&&el.getAttribute('data-km-permission-level')!=='view'){
          if('disabled' in el)el.disabled=false;
          el.removeAttribute('aria-disabled');
        }
        if(el.getAttribute('aria-hidden')==='true'&&el.hasAttribute('data-km-permission')){
          el.style.removeProperty('display');
          el.removeAttribute('aria-hidden');
        }
      }
    });

    const contentRoot=document.getElementById('content');
    const skipHeavy=!contentRoot||!contentRoot.childElementCount||!!document.getElementById('kmLoginOverlay');
    if(skipHeavy&&!readOnlyUi){
      /* login / empty shell — body role classes already applied */
      const brandTextFast=document.querySelector('.kmBrandText');
      if(brandTextFast){
        let un='';
        try{un=String(window.kmAuthFullName||sessionStorage.getItem('km_auth_full_name')||'').trim();}catch(e){}
        if(!window.kmRoleUnlocked&&sessionStorage.getItem('km_auth_ok')!=='1'){
          brandTextFast.textContent='KM';
          brandTextFast.classList.remove('kmBrandMenuLabel');
          brandTextFast.removeAttribute('title');
        }else{
          const label=un||(admin?'Ադմինիստրատոր':'Օգտատեր');
          brandTextFast.textContent=label;
          brandTextFast.classList.add('kmBrandMenuLabel');
          brandTextFast.title=label;
        }
      }
      return;
    }
    function isNavButton(btn){
      if(!btn||btn.closest('#kmLoginOverlay'))return true;
      if(btn.classList.contains('nav')||btn.classList.contains('kmLangBtn')||btn.classList.contains('kmSysTab'))return true;
      if(btn.hasAttribute('data-km-sys-tab')||btn.hasAttribute('data-km-sys-act')||btn.hasAttribute('data-km-sys-mode')||btn.hasAttribute('data-km-sys-kind')||btn.hasAttribute('data-km-sys-sort')||btn.hasAttribute('data-km-lic-act'))return true;
      if(btn.hasAttribute('data-km-people-card')||btn.hasAttribute('data-km-pers-tab')||btn.hasAttribute('data-km-toggle')||btn.classList.contains('kmPersTab'))return true;
      if(btn.hasAttribute('data-km-pos')){
        var posAct=btn.getAttribute('data-km-pos')||'';
        if(posAct==='card'||posAct==='units'||posAct==='refresh'||posAct==='sec'||posAct==='page')return true;
      }
      if(btn.dataset&&btn.dataset.page)return true;
      const id=btn.id||'';
      if(btn.classList.contains('kmWinBtn')||btn.closest('#kmWinChrome'))return true;
      if(/NavBtn|kmLib|kmLang|dutyTypesNav|vacationsNav|helpNav|kmExitSystem|kmCloseApp|kmWinMin|kmWinClose/i.test(id))return true;
      const oc=(btn.getAttribute('onclick')||'');
      if (/kmRememberAndOpen|kmOpenLibrarySection|kmLibSet|kmSetLanguage|kmLibSetTab|kmLibSetSection|kmOpenHishoxutyun|kmHishoxutyunLog|kmOpenOrgUnitKod|kmRenderOrgUnitKodPage|page\s*=|render\s*\(|libraryPage|kmLawDocsPage|kmLawsConstitutionHub|kmCodesPage|openDutyTypes|openVacations|openWorkStatus|closeDutyTypePlanning|kmShowShortcuts|viewArchiveReadOnly|kmLibOpen|kmLawsSetSection|kmLawsSearch|kmLawsPage|kmLawsOpen|kmLawsOpenLocal|kmLawsOpenArlis|kmLawsEnsureArlis|kmLawsOpenStatutesHub|kmLawsOpenOrdersHub|kmLawsShowDocViewer|kmLawsCloseDocViewer|kmLawsToggleDocFullscreen|kmLawsPrintDocViewer|kmLawsShowHub|kmCharacteristicPage|kmEncouragementsPage|kmCharacteristicViewPdf|kmEncouragementViewPdf|kmMonthSummaryPage|kmMonthSummaryBack|kmMonthSummaryViewPdf|kmLibPage|kmLibSearch|kmOpenMainPeoplePicker|kmOpenDutyPeoplePicker|kmSpreadsheetsPage|kmSs|kmCloseSystem|kmExitSystem|kmCloseWindow|kmMinimizeWindow|kmPrintTodayDuty|kmPrintMonthlyReport|kmPrintTodayDutyPrint|kmPrintMonthlyReportPrint|kmOpenTodayDutyPage|kmOpenMonthlyReportPage|kmReportsBack|kmArchiveHubBack|kmArchiveOpen|kmHomeReportsOpen|kmOpenPersonCard|kmCompareArchive|kmExportDocsZip|kmLibToggleFavorite|kmLibSetTag|kmLibShowRecent|kmLawsToggleBookmark|kmLawsShowBookmarks|kmSsExportExcel|kmShowDutyHistory|kmPrintIdCard|kmMonthCompare|kmRunMonthCompare|kmWorkloadReport|kmOpenHolidays|kmOpenSubstitutionLog|kmOpenRankRules|kmSyncExport|kmUsbExportUserData|kmPrintDayNotes|analytics\s*\(|kmDisciplinePenaltiesPage|kmLawSubBackToPersonCard|kmLawSubResolveBack|kmDossierUnlockForm|kmFontsRefresh|kmApplyKmFontsCss|kmNetPage|kmOpenPage|kmNetOpenInbox|kmNetOpenOutbox|kmNetReportNow|kmNetOpenArchive|kmNetOpenFile|kmNetSend|kmNetSendAll|kmNetAutoStart|kmNetAutoStop|kmNetCheckUpdate|kmNetPullUpdate|kmNetOnModeChange|kmNetStart|kmNetStop|kmNetScan|kmNetOpenUpdateStaging|_kmSysTab|_kmSysRefresh|_kmSysPdfExport|kmOpenUnifiedSubstitutions|kmOpenUnitsManager|kmOpenPrintPresetManager|kmOpenTemplateManager|kmEncryptedBackupExport|kmToggleDarkMode|kmPreviewDarkMode|kmEditDutyPost|kmCopyTodayDutySms|kmOpenDutyKiosk|kmOpenFreePeople|kmRenderFreePeople|kmCopyFreePeople|kmPrintFreePeople|kmExportTodayOrderWord|kmExportTodayOrderPdf|kmOpenDocsPack|kmDocsPackRefresh|kmExportDutyOrderWord|kmExportDutyOrderPdf|kmExportWeekOrderWord|kmExportWeekOrderPdf|kmExportMonthOrderWord|kmExportMonthOrderPdf|kmPrintDutyForDate|kmCopyDutySmsForDate|kmExportMonthGraphsPdf|kmBatchPrintAllGraphsFull|kmUsbExportUserData|convertPptToPdf|convertPdfToPpt|convertImagesToPdf|convertMergePdfs|convertSplitPdf|convertFolderBatch|kmOpenOrderDraft|kmExportOrderDraftWord|kmExportOrderDraftPdf|kmInsertOrderPerson|kmResetOrderDraft|kmOrderDraftBack|kmOrderDraftNumberPoints|kmApplyOrderTemplate|kmOpenPositionsPage|kmPositionsSelectSection|kmPositionsSearch|kmPositionsVacantOnly|kmPositionOpenCard|kmPositionAssign|kmDisciplinePenaltiesPage|kmPeopleStructToggle|kmPeopleOpenCardByName|kmOpenTroopStructure|kmTroopStructureTab|kmTroopExportXlsx|kmTroopFillFromPeople|kmTroopFilterUnit|kmTroopSearch|kmTroopVacantOnly|kmTroopColGroup|kmTroopJumpSection|kmTroopPage|kmTroopTreeFilter|kmTroopToggleEdit|kmTroopSelectRow|kmTroopFilterOpen|kmTroopFilterClose|kmTroopFilterApply|kmTroopFilterPopupSearch|kmTroopFilterToggleVal|kmTroopFilterSelectAll|kmTroopFilterSort|kmTroopFullscreen|kmTroopExitFullscreen|kmUnitOpen|kmUnitDoc|kmUnitInv|kmUnitChar|kmUnitFuel|kmUnitDay|kmUnitMed|kmUnitLeave|kmUnitBlank|kmUnitDos|kmRenderAccountingHub|kmAccountingCardsHtml|kmUnitForm|kmUnitTerm|kmTrialOpen|kmTrialChar|kmTrialExam|kmTrialMonitor|kmUnitBad/i.test(oc)) return true;
      if(btn.closest('.side,.kmLibSections,.kmLibTypeFilter,.kmLawsSubs,.kmLawsGrid,.kmLibPager,.kmLanguageBar'))return true;
      return false;
    }
    window._kmIsNavButton=isNavButton; /* KM_RIGHTS_V15_UNIVERSAL: shared with the capture guard */
    if(readOnlyUi){
      /* KM_RIGHTS_V8: lock mutate surfaces in content + modals; search stays usable */
      var __kmRoRoots='#content input,#content select,#content textarea,#content [contenteditable="true"],#kmExtModal input,#kmExtModal select,#kmExtModal textarea,#kmExtModal [contenteditable="true"],.kmDlgCard input,.kmDlgCard select,.kmDlgCard textarea';
      document.querySelectorAll(__kmRoRoots).forEach(el=>{
        if(el.closest('#kmLoginOverlay'))return;
        if(el.type==='search'||(/ListQ$/.test(String(el.id||'')))||el.getAttribute('data-km-allow-view')==='1')return;
        if(el.getAttribute('data-km-allow-edit')==='1'&&!viewOnly)return;
        el.disabled=true;
        el.setAttribute('readonly','readonly');
        if(el.isContentEditable)el.contentEditable='false';
      });
      document.querySelectorAll('#content button,#kmExtModal button,.kmDlgCard button').forEach(btn=>{
        if(isNavButton(btn))return;
        if(btn.getAttribute('data-km-allow-view')==='1')return;
        btn.disabled=true;
        btn.title=btn.title||'Միայն դիտում — խմբագրում արգելված';
      });
    }else{
      document.querySelectorAll('#content input[disabled],#content select[disabled],#content textarea[disabled]').forEach(el=>{
        if(el.closest('#kmLoginOverlay'))return;
        if(el.closest('#kmUsersOrgPick,#kmAdminOrgPick'))return;
        if(el.dataset&&el.dataset.kmKeepDisabled==='1')return;
        el.disabled=false;
        el.removeAttribute('readonly');
      });
      document.querySelectorAll('#content .kmAahInput,[data-km-allow-edit="1"],#kmExtModal [data-km-allow-edit="1"]').forEach(el=>{
        el.disabled=false;
        el.readOnly=false;
        el.removeAttribute('readonly');
        el.removeAttribute('disabled');
      });
      document.querySelectorAll('#content button[disabled]').forEach(btn=>{
        if(isNavButton(btn))return;
        if(btn.dataset&&btn.dataset.kmKeepDisabled==='1')return;
        btn.disabled=false;
      });
      document.querySelectorAll('#content [contenteditable="false"]').forEach(el=>{
        if(el.closest('#kmLoginOverlay'))return;
        if(el.id==='kmDiscRankView'||el.closest('.kmDiscFormRow,.kmDossierForm'))return;
        el.contentEditable='true';
      });
      // Discipline penalty form: never leave order number locked after role guard
      try{
        const orderEl=document.getElementById('kmDiscOrderNo');
        if(orderEl){
          orderEl.disabled=false;
          orderEl.readOnly=false;
          orderEl.removeAttribute('readonly');
          orderEl.removeAttribute('disabled');
        }
        if(typeof window.kmDisciplineUnlockForm==='function')window.kmDisciplineUnlockForm();
        if(typeof window.kmDossierUnlockForm==='function')window.kmDossierUnlockForm();
      }catch(e){}
    }
    var lawPage=String(window.page||(typeof page!=='undefined'?page:'')||'')==='lawdocs'||String(window.page||'')==='codes';
    var lawMutate=lawPage&&typeof window.kmCanEditPage==='function'&&window.kmCanEditPage('lawdocs', window._kmLawSubPage||window._kmLawOpenSection||'');
    if(!admin && !lawMutate){
      document.querySelectorAll('.kmLawCardExamDel,.kmDiscActiveEarly,button[onclick*="kmCharacteristicDelete"],button[onclick*="kmEncouragementDelete"],button[onclick*="kmDisciplineDeleteArchive"],button[onclick*="kmDisciplineRemoveEarly"],button[onclick*="kmLawsDelete"],button[onclick*="kmMonthSummaryDelete"]').forEach(function(el){
        el.style.setProperty('display','none','important');
        el.disabled=true;
        el.setAttribute('aria-hidden','true');
      });
    }else{
      document.querySelectorAll('.kmLawCardExamDel,.kmDiscActiveEarly').forEach(function(el){
        el.style.removeProperty('display');
        el.disabled=false;
        el.removeAttribute('aria-hidden');
      });
    }
    document.querySelectorAll('.km-admin-only,[data-km-home-settings="1"],[onclick*="kmOpenSecuritySettings"],[onclick*="kmOpenAuditLog"]').forEach(el=>{
      if(admin){
        el.style.removeProperty('display');
      }else{
        el.style.setProperty('display','none','important');
      }
    });
    // Տեղեկություն՝ միայն ադմին։ Օրենքներ՝ ադմին + օգտատեր (ոչ դիտորդ)
    document.querySelectorAll('.side .nav[data-page="sysinfo"]').forEach(el=>{
      el.remove();
    });
    if(viewer){
      document.querySelectorAll('.side .nav[data-page="lawdocs"],.side .nav[data-page="codes"]').forEach(el=>{
        el.style.setProperty('display','none','important');
      });
    }else{
      document.querySelectorAll('.side .nav[data-page="lawdocs"],.side .nav[data-page="codes"]').forEach(el=>{
        el.style.removeProperty('display');
      });
    }
    const brandText=document.querySelector('.kmBrandText');
    if(brandText){
      let un='';
      try{
        un=String(window.kmAuthFullName||sessionStorage.getItem('km_auth_full_name')||'').trim();
      }catch(e){}
      if(!window.kmRoleUnlocked&&sessionStorage.getItem('km_auth_ok')!=='1'){
        brandText.textContent='KM';
        brandText.classList.remove('kmBrandMenuLabel');
        brandText.removeAttribute('title');
      }else{
        const label=un||(admin?'Ադմինիստրատոր':'Օգտատեր');
        brandText.textContent=label;
        brandText.classList.add('kmBrandMenuLabel');
        brandText.title=label;
      }
    }
    try{if(typeof window.kmApplyUserNavGrants==='function')window.kmApplyUserNavGrants();}catch(eNav){}
    try{if(typeof window.kmFilterGrantCards==='function')window.kmFilterGrantCards();}catch(eCards){}
  };

  function kmSearchEsc(s){
    if(typeof window.esc==='function')return window.esc(s);
    return String(s==null?'':s).replace(/[&<>"']/g,function(ch){
      return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch];
    });
  }
  /* Search perf (output-identical): the dialog paints at most KM_SEARCH_MAX_SHOWN hits and hits keep
     collection order, so once that many are found the rest of the scan can be skipped. */
  var KM_SEARCH_MAX_SHOWN=80;
  var kmSearchDone=false;
  function kmSearchHay(needle, parts){
    if(kmSearchDone||!needle)return false;
    if(!/\s/.test(needle)){
      /* no whitespace in needle => a match can never span two parts: no join/array allocation needed */
      for(var i=0;i<parts.length;i++){
        var x=parts[i];
        if(x!=null&&String(x).toLowerCase().indexOf(needle)>=0)return true;
      }
      return false;
    }
    var hay=parts.map(function(x){return String(x==null?'':x);}).join(' ').toLowerCase();
    return hay.indexOf(needle)>=0;
  }
  function kmSearchLibScope(){
    try{
      if(typeof window.kmIsSuperAdmin==='function'&&window.kmIsSuperAdmin()){
        var ctx=typeof window.kmGetOrgContext==='function'?window.kmGetOrgContext():null;
        if(ctx&&ctx.corpsId&&ctx.unitId){
          return {corpsId:ctx.corpsId,unitId:ctx.unitId,archiveRole:ctx.archiveRole||'admin'};
        }
        return {};
      }
      if(typeof window.kmOrgArchiveScope==='function'){
        var s=window.kmOrgArchiveScope();
        if(s&&s.corpsId&&s.unitId){
          return {corpsId:s.corpsId,unitId:s.unitId,archiveRole:s.archiveRole};
        }
      }
    }catch(eSc){}
    return {};
  }
  function kmSearchCanOpenGrant(sec){
    if(!sec||!sec.id)return false;
    if(typeof window.kmCanAccessPage!=='function')return true;
    var id=String(sec.id);
    if(id==='home'||id==='about'||id==='helpBot')return true;
    try{
      if(id.indexOf('lib:')===0)return !!window.kmCanAccessPage('library',id.slice(4));
      if(window.kmCanAccessPage(id))return true;
      if(window.kmCanAccessPage('lawdocs')&&/^(constitution|electoral|admin_|civil|land|water|family|labor|forest|subsoil|tax|eaeu|judicial|criminal|crim_|penitentiary|statute_|orders_|rights_|directives|military_acts|acts_|characteristic|encouragements|soldier_rights)/.test(id))return true;
      if(id==='unitArchive'){try{if(window.kmIsSuperAdmin&&window.kmIsSuperAdmin())return true;if(window.kmSuperAdmin===true)return true;if(sessionStorage.getItem('km_auth_super')==='1')return true;if(window.kmCanAccessPage&&window.kmCanAccessPage('unitArchive'))return true;}catch(eUA){}return false;}
      /* KM_UNIT_ARCHIVE_GRANT_OR_SUPER_ACCESS_V1 */
      /* KM_ARCHIVE_ORG_SCOPE_CHECK_V1 */
      if(window.kmCanAccessPage('accounting')&&/^(people|positions|vacations|troopStructure|unitFormation|unitMedical|unitTermWatch|unitLeavePlan|orgCorps|unitDossiers|unitInventory)$/.test(id))return true;
      if(window.kmCanAccessPage('library')&&id.indexOf('lib:')===0)return true;
    }catch(eAcc){}
    return true;
  }
  function kmSearchOpenGrant(id, group){
    id=String(id||'');
    if(!id)return;
    if(id.indexOf('lib:')===0){
      if(typeof window.kmOpenLibrarySection==='function')window.kmOpenLibrarySection(id.slice(4));
      return;
    }
    if(id==='usb'){ /* KM_MENU15_V1 */
      if(typeof window.kmOpenUsbHub==='function')window.kmOpenUsbHub();
      else if(typeof window.kmHomeReportsOpen==='function')window.kmHomeReportsOpen('usb');
      else if(typeof window.kmOpenPage==='function')window.kmOpenPage('unitTools');
      return;
    }
    if(id==='exportMonthGraphs'){
      if(typeof window.kmExportMonthGraphsPdf==='function')window.kmExportMonthGraphsPdf();
      else if(typeof window.kmOpenPage==='function')window.kmOpenPage('dutyTypes');
      return;
    }
    if(id==='monthSummary'){
      if(typeof window.kmMonthSummaryPage==='function')window.kmMonthSummaryPage();
      else if(typeof window.kmOpenPage==='function')window.kmOpenPage('dutyTypes');
      return;
    }
    if(id==='lib:license'||id==='license'){
      if(typeof window.kmSysSettingsOpen==='function')window.kmSysSettingsOpen('license');
      else if(typeof window.kmOpenPage==='function'){ window._kmSysSettingsPending='license'; window.kmOpenPage('syssettings'); }
      return;
    }
    var hubFn={
      constitution_hub:'kmLawsConstitutionHub',
      statutes:'kmLawsOpenStatutesHub',
      orders:'kmLawsOpenOrdersHub',
      soldier_rights:'kmSoldierRightsHub'
    }[id];
    if(hubFn&&typeof window[hubFn]==='function'){window[hubFn]();return;}
    if(id==='characteristic'&&typeof window.kmCharacteristicPage==='function'){
      window.kmCharacteristicPage({back:'kmLawDocsPage()'});return;
    }
    if(id==='encouragements'&&typeof window.kmEncouragementsPage==='function'){
      window.kmEncouragementsPage({back:'kmLawDocsPage()'});return;
    }
    if(id==='acts_discipline'&&typeof window.kmDisciplinePenaltiesPage==='function'){
      window.kmDisciplinePenaltiesPage({back:'kmLawDocsPage()'});return;
    }
    if(typeof window.kmLawsOpenLocal==='function'&&(
      /^(constitution|electoral|admin_|civil|land|water|family|labor|forest|subsoil|tax|eaeu|judicial|criminal|crim_|penitentiary|statute_|orders_|rights_|directives|military_acts|acts_exam)/.test(id)||
      String(group||'').indexOf('օրեն')>=0
    )){
      window.kmLawsOpenLocal(id);
      return;
    }
    if(typeof window.kmOpenPage==='function')window.kmOpenPage(id);
  }
  function kmSearchOpenPerson(src){
    var s=String(src||'');
    if(s==='Շտատկա'&&typeof window.kmOpenPage==='function'){window.kmOpenPage('troopStructure');return;}
    if(s==='Պաշտոն'&&typeof window.kmOpenPage==='function'){window.kmOpenPage('people');return;}
    if(typeof window.kmOpenPage==='function')window.kmOpenPage('people');
  }
  function kmSearchPush(hits, seen, item){
    if(!item||!item.title)return;
    var key=item.kind+'|'+item.title+'|'+(item.sub||'');
    if(seen[key])return;
    seen[key]=1;
    hits.push(item);
    if(hits.length>=KM_SEARCH_MAX_SHOWN)kmSearchDone=true;
  }
  function kmSearchCollectSync(needle){
    kmSearchDone=false;
    var hits=[];
    var seen=Object.create(null);
    var secs=[{id:'home',label:'Հիմնական',group:'Հիմնական',icon:'🏠'}].concat(Array.isArray(window.kmGrantSections)?window.kmGrantSections:[]);
    secs.forEach(function(s){
      if(!s||!s.id||!kmSearchCanOpenGrant(s))return;
      var extra='';
      if(/people|troopStructure|accounting|positions|unitDossiers/.test(s.id))extra=' անվանացուցակ շտատկա Ա.Ա.Հ ԱԱՀ ահ';
      if(kmSearchHay(needle,[s.label,s.group,s.id,extra])){
        kmSearchPush(hits,seen,{
          kind:'Բաժին',
          title:s.label,
          sub:s.group&&s.group!==s.label?s.group:'Բաժին / ենթաբաժին',
          open:function(){kmSearchOpenGrant(s.id,s.group);}
        });
      }
    });
    if(typeof db!=='undefined'&&db){
      try{
        (db.people||[]).forEach(function(p){
          if(!p)return;
          if(!kmSearchHay(needle,[p.name,p.rank,p.unit,p.phone,p.note,p.education,p.address,p.city,p.idCard,'Ա.Ա.Հ','անվանացուցակ']))return;
          kmSearchPush(hits,seen,{
            kind:'Ա.Ա.Հ',
            title:String(p.name||'').trim()||'Անձ',
            sub:[p.rank,p.unit,'Անձնակազմ / անվանացուցակ'].filter(Boolean).join(' · '),
            open:function(){kmSearchOpenPerson('Անձնակազմ');}
          });
        });
      }catch(ePe){}
      try{
        if(typeof window.kmCollectServiceMembers==='function'){
          (window.kmCollectServiceMembers()||[]).forEach(function(p){
            if(!p||!p.name)return;
            if(!kmSearchHay(needle,[p.name,p.rank,p.unit,p.src,'Ա.Ա.Հ']))return;
            kmSearchPush(hits,seen,{
              kind:'Ա.Ա.Հ',
              title:p.name,
              sub:[p.rank,p.unit,p.src||'Հաշվառում'].filter(Boolean).join(' · '),
              open:function(){kmSearchOpenPerson(p.src);}
            });
          });
        }
      }catch(eMem){}
      try{
        ((((db.troopStructure||{}).staff||{}).rows)||[]).forEach(function(r){
          if(!r||r.type==='section')return;
          if(!kmSearchHay(needle,[r.name,r.sourceName,r.rank,r.position,r.unit,r.code,r.vus,'շտատկա']))return;
          var nm=String(r.name||r.sourceName||r.position||'').trim();
          if(!nm)return;
          kmSearchPush(hits,seen,{
            kind:'Շտատկա',
            title:nm,
            sub:[r.rank||r.position,r.unit,'Անձնակազմի հաշվառում'].filter(Boolean).join(' · '),
            open:function(){if(typeof window.kmOpenPage==='function')window.kmOpenPage('troopStructure');}
          });
        });
      }catch(eTs){}
      try{
        (db.positionArchives||[]).forEach(function(arch){
          if(!arch||arch.builtin)return;
          var an=arch.name||arch.fileName||arch.sourceName||'';
          if(kmSearchHay(needle,[an,arch.unitName,'շտատկա excel'])){
            kmSearchPush(hits,seen,{
              kind:'Ֆայլ',
              title:String(an||'Շտատկա'),
              sub:'Հաշվառում · բեռնված շտատկա',
              open:function(){if(typeof window.kmOpenPage==='function')window.kmOpenPage('people');}
            });
          }
          (arch.rows||[]).forEach(function(r){
            if(!r||r.type==='section')return;
            if(!kmSearchHay(needle,[r.name,r.sourceName,r.rank,r.position,r.unit]))return;
            var nm=String(r.name||r.sourceName||'').trim();
            if(!nm)return;
            kmSearchPush(hits,seen,{
              kind:'Շտատկա',
              title:nm,
              sub:[r.position,arch.name||'Շտատկա'].filter(Boolean).join(' · '),
              open:function(){if(typeof window.kmOpenPage==='function')window.kmOpenPage('people');}
            });
          });
        });
      }catch(eAr){}
      try{
        (db.userPositions||[]).forEach(function(p){
          if(!p)return;
          if(!kmSearchHay(needle,[p.position,p.personName,p.unit,p.section,p.rankSlot]))return;
          kmSearchPush(hits,seen,{
            kind:'Պաշտոն',
            title:String(p.personName||p.position||'Պաշտոն').trim(),
            sub:[p.position,p.unit,'Անձնակազմ և Պաշտոն'].filter(Boolean).join(' · '),
            open:function(){if(typeof window.kmOpenPage==='function')window.kmOpenPage('people');}
          });
        });
      }catch(eUp){}
      try{
        (db.vacations||[]).forEach(function(v){
          if(!v)return;
          if(!kmSearchHay(needle,[v.person,v.note,v.from,v.to]))return;
          kmSearchPush(hits,seen,{
            kind:'Արձակուրդ',
            title:String(v.person||'Արձակուրդ').trim(),
            sub:[v.from,v.to].filter(Boolean).join(' — '),
            open:function(){if(typeof window.kmOpenPage==='function')window.kmOpenPage('vacations');}
          });
        });
      }catch(eVa){}
      try{
        (db.registrations||[]).forEach(function(r){
          if(!r)return;
          if(!kmSearchHay(needle,[r.person,r.type,r.note,r.date]))return;
          kmSearchPush(hits,seen,{
            kind:'Նշում',
            title:String(r.person||r.type||'Նշում').trim(),
            sub:[r.date,r.note].filter(Boolean).join(' · '),
            open:function(){if(typeof window.kmOpenLibrarySection==='function')window.kmOpenLibrarySection('notes');}
          });
        });
      }catch(eRg){}
      try{
        (db.notebookNotes||[]).forEach(function(n){
          if(!n)return;
          if(!kmSearchHay(needle,[n.title,n.text,n.body,n.note]))return;
          kmSearchPush(hits,seen,{
            kind:'Նշում',
            title:String(n.title||n.note||'Նշում').trim().slice(0,80),
            sub:'Աշխատանքային գործիքներ · Նշումներ', /* KM_MENU_REORG_V1 */
            open:function(){if(typeof window.kmOpenLibrarySection==='function')window.kmOpenLibrarySection('notes');}
          });
        });
      }catch(eNt){}
      /* KM_PRODUCT_BATCH_V1: empty tables/calculators section removed from search */
      try{
        (db.archives||[]).forEach(function(a){
          if(!a)return;
          if(!kmSearchHay(needle,[a.name,a.label,a.month,a.year]))return;
          kmSearchPush(hits,seen,{
            kind:'Ֆայլ',
            title:String(a.name||a.label||'Արխիվ').trim(),
            sub:'Ընթացիկ արխիվ',
            open:function(){if(typeof window.kmOpenLibrarySection==='function')window.kmOpenLibrarySection('current');}
          });
        });
      }catch(eAc){}
      try{
        (db.dutyTypes||[]).forEach(function(n){
          var label=typeof n==='string'?n:(n&&(n.name||n.title)||'');
          if(!kmSearchHay(needle,[label]))return;
          kmSearchPush(hits,seen,{
            kind:'Վերակարգ',
            title:String(label).trim(),
            sub:'Վերակարգ', /* KM_MENU_REORG_V1 */
            open:function(){if(typeof window.kmOpenPage==='function')window.kmOpenPage('dutyTypes');}
          });
        });
      }catch(eDt){}
    }
    return hits;
  }
  function kmSearchPaint(host, hits, pending){
    if(!host)return;
    if(!hits.length&&!pending){
      host.innerHTML='<div class="muted">Ոչինչ չգտնվեց</div>';
      return;
    }
    window._kmGlobalSearchHits=hits;
    host.innerHTML=hits.slice(0,KM_SEARCH_MAX_SHOWN).map(function(h,i){
      return '<button type="button" class="kmSearchHit" onclick="kmGlobalSearchPick('+i+')">'
        +'<b>'+kmSearchEsc(h.title)+'</b>'
        +'<span>'+kmSearchEsc((h.kind?h.kind+' · ':'')+(h.sub||''))+'</span>'
        +'</button>';
    }).join('')+(pending?'<div class="muted" style="padding:8px 2px">Ֆայլեր…</div>':'');
  }
  async function kmSearchCollectFiles(needle, hits, seen){
    if(hits.length>=KM_SEARCH_MAX_SHOWN)return hits; /* list is already full: file lookups could not be shown */
    if(!(window.kmNative&&window.kmNative.library&&typeof window.kmNative.library.list==='function'))return hits;
    var types=['word','excel','pdf','ppt'];
    var scope=kmSearchLibScope();
    for(var i=0;i<types.length;i++){
      try{
        var r=await window.kmNative.library.list(types[i],Object.assign({offset:0,limit:12,q:needle},scope));
        ((r&&r.items)||[]).forEach(function(f){
          if(!f)return;
          var title=String(f.displayName||f.name||'').trim();
          if(!title)return;
          var id=f.id, typ=f.type||types[i];
          kmSearchPush(hits,seen,{
            kind:'Ֆայլ',
            title:title,
            sub:(f.folder?f.folder+' · ':'')+'Ֆայլերի պահոց · '+(typ||'ֆայլ'), /* KM_MENU_REORG_V1 */
            open:function(){
              if(typeof window.kmOpenLibrarySection==='function')window.kmOpenLibrarySection('files');
              setTimeout(function(){
                if(typeof window.kmLibOpen==='function')window.kmLibOpen(id,typ);
              },200);
            }
          });
        });
      }catch(eLf){}
    }
    return hits;
  }
  window.kmGlobalSearchPick=function(i){
    var hit=(window._kmGlobalSearchHits||[])[i];
    var dlg=document.getElementById('kmCoreDialog');
    if(dlg)try{dlg.remove();}catch(eRm){}
    if(!hit||typeof hit.open!=='function')return;
    try{hit.open();}catch(eGo){console.error(eGo);}
  };
  window.kmGlobalSearch=function(presetQ){
    const openDlg=typeof window.kmOpenDialog==='function'?window.kmOpenDialog:null;
    if(!openDlg)return;
    const q0=String(presetQ||'').trim();
    const body='<p class="muted" style="margin:0 0 8px">Բաժիններ, ենթաբաժիններ, Ա․Ա․Հ․, շտատկա, անվանացուցակ և ֆայլերի անուններ։</p>'
      +'<div class="kmHomeSearchBar" style="margin:0 0 10px">'
      +'<input id="kmGlobalSearchQ" type="search" placeholder="Ա․Ա․Հ․, բաժին, ֆայլ…">'
      +'</div>'
      +'<div id="kmGlobalSearchHits" class="kmSearchHits muted">Գրեք առնվազն 2 նիշ։</div>';
    openDlg('Որոնում',body,null,'Փակել');
    const input=document.getElementById('kmGlobalSearchQ');
    const host=document.getElementById('kmGlobalSearchHits');
    if(input&&q0)input.value=q0;
    let timer=0;
    let seq=0;
    const run=function(){
      const q=String(input&&input.value||'').trim();
      if(q.length<2){
        window._kmGlobalSearchHits=[];
        if(host)host.innerHTML='<div class="muted">Գրեք առնվազն 2 նիշ։</div>';
        return;
      }
      const needle=q.toLowerCase();
      const hits=kmSearchCollectSync(needle);
      const seen=Object.create(null);
      hits.forEach(function(h){seen[h.kind+'|'+h.title+'|'+(h.sub||'')]=1;});
      kmSearchPaint(host,hits,true);
      const my=++seq;
      kmSearchCollectFiles(q,hits,seen).then(function(){
        if(my!==seq)return;
        kmSearchPaint(host,hits,false);
      }).catch(function(){
        if(my!==seq)return;
        kmSearchPaint(host,hits,false);
      });
    };
    if(input){
      input.addEventListener('input',function(){
        clearTimeout(timer);
        timer=setTimeout(run,180);
      });
      input.addEventListener('keydown',function(ev){
        if(ev.key!=='Enter')return;
        ev.preventDefault();
        ev.stopPropagation();
        clearTimeout(timer);
        run();
      });
    }
    if(q0)run();
  };

  window.kmToggleDarkMode=async function(on){
    document.body.classList.toggle('km-dark',!!on);
    try{
      if(window.kmNative&&window.kmNative.settings){
        await window.kmNative.settings.set({darkMode:!!on});
      }
    }catch(e){}
  };

  window.kmShowShortcuts=function(){
    const openDlg=typeof window.kmOpenDialog==='function'?window.kmOpenDialog:null;
    if(!openDlg)return;
    openDlg('Ստեղնաշարային կարճուղիներ',`
      <ul style="margin:0;padding-left:18px;line-height:1.7">
        <li><b>Ctrl+S</b> — Պահպանել</li>
        <li><b>Ctrl+P</b> — Տպել (նախադիտում)</li>
        <li><b>Ctrl+Z</b> — Հետարկել</li>
        <li><b>Ctrl+Y</b> — Կրկնել</li>
        <li><b>Ctrl+K</b> — Որոնում</li>
        <li><b>Ctrl+Shift+D</b> — Մուգ ռեժիմ</li>
        <li><b>F1</b> — Այս ցանկը</li>
        <li><b>Enter</b> — Հաստատել պատուհանում</li>
      </ul>`,null,'Փակել');
  };

  function resetAutoLock(){
    if(lockTimer)clearTimeout(lockTimer);
    if(localStorage.getItem('km_admin_token'))return;
    try{
      if(sessionStorage.getItem('km_auth_ok')==='1' && sessionStorage.getItem('km_auth_mode')==='user')return;
    }catch(eU){}
    const mins=Number(window.kmAutoLockMinutes)||0;
    if(!mins||!window.kmNative||!window.kmNative.security)return;
    lockTimer=setTimeout(()=>{
      try{
        if(sessionStorage.getItem('km_auth_mode')==='user')return;
      }catch(eSkip){}
      sessionStorage.removeItem('km_auth_ok');
      sessionStorage.removeItem('km_auth_role');
      sessionStorage.removeItem('km_auth_mode');
      kmNotify('Ավտոմատ արգելափակում — մուտք գաղտնաբառով','warn');
      if(typeof window.kmEnsureSecurity==='function')window.kmEnsureSecurity();
    },mins*60000);
  }
  window.kmResetAutoLock=resetAutoLock;

  function kmHotkeyBlocked(){
    try{
      if(sessionStorage.getItem('km_auth_ok')!=='1'&&!window.kmRoleUnlocked){
        if(document.getElementById('kmLoginOverlay'))return true;
      }
    }catch(e){}
    return false;
  }

  function kmHotkeyTyping(el){
    if(!el)return false;
    const tag=String(el.tagName||'').toUpperCase();
    if(tag==='TEXTAREA')return true;
    if(tag==='INPUT'){
      const t=String(el.type||'text').toLowerCase();
      return t!=='button'&&t!=='submit'&&t!=='checkbox'&&t!=='radio'&&t!=='file'&&t!=='hidden';
    }
    return !!el.isContentEditable;
  }

  /* === KM_CTRLP_CONTEXT_V1 === Ctrl/Cmd+P prints exactly what the current view shows, or nothing.
     Root cause of the bug: the old kmHotkeyPrint() fell back to window.printScheduleTable() (the duty graph,
     defined globally on every page) and then to window.print(), so Ctrl+P on any page printed/opened the graph.
     Both the renderer keydown and the main-process 'km:hotkey' IPC go through kmHotkeyRun('print') -> here. */
  function kmPrVisible(el){
    if(!el||el.disabled)return false;
    try{
      if(el.isConnected===false)return false;
      const w=(el.ownerDocument&&el.ownerDocument.defaultView)||window;
      const st=w.getComputedStyle(el);
      return st.display!=='none'&&st.visibility!=='hidden'&&el.getClientRects().length>0;
    }catch(e){return false;}
  }
  function kmPrText(el){
    if(!el)return '';
    const raw=(String(el.tagName||'').toUpperCase()==='INPUT')?el.value:el.textContent;
    return String(raw||'').replace(/\s+/g,' ').trim();
  }
  const KM_PR_KNOWN_FN=/^\s*(?:window\.)?(?:printScheduleTable|kmUnitInvPrint)\s*\(/;
  function kmPrIsPrintBtn(b){
    if(!b||!b.getAttribute)return false;
    if(KM_PR_KNOWN_FN.test(String(b.getAttribute('onclick')||'')))return true;
    const t=kmPrText(b);
    return t.indexOf('Տպել')===0||t.indexOf('🖨')===0;
  }
  function kmPrButtonsIn(root,opts){
    opts=opts||{};
    if(!root||!root.querySelectorAll)return [];
    return [].slice.call(root.querySelectorAll('button,input[type="button"],[role="button"]')).filter(function(b){
      if(!kmPrIsPrintBtn(b)||!kmPrVisible(b))return false;
      if(b.closest&&b.closest('tr'))return false; /* per-record print buttons are not "this page" */
      if(opts.skipWidgets&&b.closest&&b.closest('.kmHubCard,.kmHubDash'))return false;
      return true;
    });
  }
  function kmPrPickBest(btns){
    let best=null,bs=-1;
    (btns||[]).forEach(function(b){
      let s=0;
      if(b.closest&&b.closest('.toolbar,.kmUtBar,.kmUtActions,header'))s+=2;
      const t=kmPrText(b);
      if(t==='Տպել'||t==='🖨'||t==='🖨 Տպել'||KM_PR_KNOWN_FN.test(String(b.getAttribute('onclick')||'')))s+=1;
      if(s>bs){bs=s;best=b;}
    });
    return best;
  }
  function kmPrZ(el){ try{ const z=parseInt(getComputedStyle(el).zIndex,10); return isNaN(z)?0:z; }catch(e){ return 0; } }
  /* [container, its own print button, required marker] */
  const KM_PR_MODALS=[
    ['#kmPrintPreview','#kmPPPrint',''],
    ['#kmCoreDialog','#kmDlgSave','#kmNativePrinter'],
    ['#kmUtPrint','#kmUtDoPrint',''],
    ['#dutyTypePlanningModal','#dutyPrintBtn','']
  ];
  const KM_PR_GENERIC_MODAL='dialog[open],[aria-modal="true"],[role="dialog"],.modal,.kmModal,#kmExtModal,[id$="Modal"]';
  function kmPrTopModal(){
    const seen=[];
    KM_PR_MODALS.forEach(function(m){ try{ const el=document.querySelector(m[0]); if(el&&seen.indexOf(el)<0)seen.push(el); }catch(e){} });
    try{ [].slice.call(document.querySelectorAll(KM_PR_GENERIC_MODAL)).forEach(function(el){ if(seen.indexOf(el)<0)seen.push(el); }); }catch(e){}
    let top=null,tz=-Infinity;
    seen.forEach(function(el){
      if(!kmPrVisible(el))return;
      if(el.closest&&el.closest('#kmLoginOverlay'))return;
      const strong=el.matches&&el.matches('dialog[open],[aria-modal="true"]');
      const known=KM_PR_MODALS.some(function(m){ try{ return el.matches(m[0]); }catch(e){ return false; } });
      if(!strong&&!known){
        let pos='';
        try{ pos=getComputedStyle(el).position; }catch(e){}
        if(pos!=='fixed')return; /* in-page blocks named *Modal are not overlays */
      }
      const z=kmPrZ(el);
      /* higher z wins; on a tie the later node in the document (drawn on top / nested) wins */
      if(z>tz||(z===tz&&top&&(top.compareDocumentPosition(el)&4))){ top=el; tz=z; }
    });
    return top;
  }
  const KM_PR_DOC_FRAMES=['kmF27LedgerFrame','kmHamalrFrame','kmApranqFrame'];
  function kmPrFrame(fr){
    let w=null,d=null;
    try{ w=fr.contentWindow; d=fr.contentDocument||(w&&w.document); }catch(e){ d=null; }
    if(!w)return '';
    try{
      if(d){
        const ov=d.getElementById('kmCtOverlay'),pb=d.getElementById('kmCtPrintBtn');
        if(ov&&pb&&!ov.hidden&&!pb.disabled&&kmPrVisible(ov)){ pb.click(); return 'frame-contents'; }
        const bp=d.getElementById('btnPrint');
        if(bp&&!bp.disabled&&kmPrVisible(bp)){ bp.click(); return 'frame-button'; }
      }
    }catch(eD){}
    try{ w.focus(); }catch(eF){}
    try{ w.print(); return 'frame-print'; }catch(eP){ return ''; }
  }
  function kmPrInModal(el){
    for(let i=0;i<KM_PR_MODALS.length;i++){
      const m=KM_PR_MODALS[i];
      let hit=false;
      try{ hit=el.matches(m[0]); }catch(e){}
      if(!hit)continue;
      if(m[2]&&!el.querySelector(m[2]))break;
      const b=el.querySelector(m[1]);
      if(kmPrVisible(b)){ b.click(); return 'modal-button'; }
      break;
    }
    const b2=kmPrPickBest(kmPrButtonsIn(el));
    if(b2){ b2.click(); return 'modal-button'; }
    const fr=[].slice.call(el.querySelectorAll('iframe')).filter(kmPrVisible)[0];
    if(fr){ const r=kmPrFrame(fr); if(r)return r; }
    return '';
  }
  function kmPrNothing(){
    try{ if(typeof window.kmNotify==='function')window.kmNotify('Այս էջում տպելու բան չկա','info'); }catch(e){}
  }
  window.kmPrintDecide=function(){
    const hint=window.__kmPrintFrameHint||null;
    window.__kmPrintFrameHint=null;
    /* 1. visible modal / dialog / overlay: its own print, or nothing */
    const modal=kmPrTopModal();
    if(modal){
      const r=kmPrInModal(modal);
      if(r)return r;
      kmPrNothing();
      return 'none';
    }
    /* 2. inventory document iframes (and the frame that has focus) */
    const cands=[];
    if(hint&&hint.tagName==='IFRAME')cands.push(hint);
    try{ const ae=document.activeElement; if(ae&&ae.tagName==='IFRAME'&&cands.indexOf(ae)<0)cands.push(ae); }catch(eA){}
    KM_PR_DOC_FRAMES.forEach(function(id){ const f=document.getElementById(id); if(f&&cands.indexOf(f)<0)cands.push(f); });
    let otherFrame=null;
    for(let i=0;i<cands.length;i++){
      const fr=cands[i];
      if(!kmPrVisible(fr))continue;
      if(KM_PR_DOC_FRAMES.indexOf(fr.id)>=0){ const r=kmPrFrame(fr); if(r)return r; }
      else if(!otherFrame)otherFrame=fr;
    }
    /* 3. the page's own visible print button (not on the home dashboard, not in hidden sections) */
    const pg=String(window.page||'');
    const host=document.getElementById('content');
    if(host&&pg!=='home'){
      const b=kmPrPickBest(kmPrButtonsIn(host,{skipWidgets:true}));
      if(b){ b.click(); return 'page-button'; }
    }
    if(otherFrame){ const r2=kmPrFrame(otherFrame); if(r2)return r2; }
    /* 4. nothing to print here */
    kmPrNothing();
    return 'none';
  };
  /* Ctrl+P pressed while focus is inside a same-origin iframe (blob documents): print that iframe */
  function kmPrBindFrame(fr){
    try{
      const w=fr&&fr.contentWindow;
      if(!w||w.__kmCtrlPBound)return;
      w.__kmCtrlPBound=true;
      w.addEventListener('keydown',function(ev){
        if(!(ev.ctrlKey||ev.metaKey)||ev.altKey||ev.shiftKey)return;
        const k=String(ev.key||'').toLowerCase();
        if(!(ev.code==='KeyP'||k==='p'))return;
        ev.preventDefault();
        if(typeof ev.stopImmediatePropagation==='function')ev.stopImmediatePropagation();
        window.__kmPrintFrameHint=fr;
        if(typeof window.kmHotkeyRun==='function')window.kmHotkeyRun('print');
      },true);
    }catch(e){ /* cross-origin frame: nothing to bind */ }
  }
  window.kmPrBindFrame=kmPrBindFrame;
  function kmPrBindFrames(){
    try{
      document.addEventListener('load',function(ev){
        const t=ev&&ev.target;
        if(t&&t.tagName==='IFRAME')kmPrBindFrame(t);
      },true);
      [].slice.call(document.querySelectorAll('iframe')).forEach(kmPrBindFrame);
    }catch(e){}
  }
  /* === /KM_CTRLP_CONTEXT_V1 === */

  function kmHotkeyPrint(){
    try{ if(typeof window.kmPrintDecide==='function'){ window.kmPrintDecide(); return; } }catch(eDec){ try{ console.warn('kmPrintDecide',eDec); }catch(_w){} } /* KM_CTRLP_CONTEXT_V1 */
    const visible=function(el){
      if(!el||el.disabled)return false;
      try{
        const style=getComputedStyle(el);
        return style.display!=='none'&&style.visibility!=='hidden'&&el.getClientRects().length>0;
      }catch(e){return false;}
    };
    const previewPrint=document.querySelector('#kmPrintPreview #kmPPPrint');
    if(visible(previewPrint)){ previewPrint.click(); return; }
    const dutyButton=document.getElementById('dutyPrintBtn');
    if(visible(dutyButton)){ dutyButton.click(); return; }
    const mainButton=[].slice.call(document.querySelectorAll('button')).find(function(button){
      return visible(button)&&button.getAttribute('onclick')==='printScheduleTable()';
    });
    if(mainButton){ mainButton.click(); return; }
    /* KM_CTRLP_CONTEXT_V1: no unconditional graph print / whole-window print any more */
  }

  var _kmHotkeyLast='', _kmHotkeyAt=0;
  window.kmHotkeyRun=function(name){
    name=String(name||'');
    if(!name)return;
    const now=Date.now();
    if(name===_kmHotkeyLast&&(now-_kmHotkeyAt)<200)return;
    _kmHotkeyLast=name;
    _kmHotkeyAt=now;
    if(name!=='help'&&kmHotkeyBlocked())return;
    if(name==='save'){
      if(!kmHotkeyCanWrite()){ kmNotify('Դիտորդի իրավունքով պահպանում անհնար','error'); return; }
      if(typeof save==='function')save();
      else if(typeof window.save==='function')window.save();
      return;
    }
    if(name==='print'){ kmHotkeyPrint(); return; }
    if(name==='undo'){ kmUndo(); return; }
    if(name==='redo'){ kmRedo(); return; }
    if(name==='search'){ kmGlobalSearch(); return; }
    if(name==='dark'){ kmToggleDarkMode(!document.body.classList.contains('km-dark')); return; }
    if(name==='help'){ kmShowShortcuts(); return; }
    if(name==='confirm'){
      const dlg=document.getElementById('kmCoreDialog');
      const btn=dlg&&dlg.querySelector('#kmDlgSave');
      if(btn&&!btn.disabled)btn.click();
    }
  };

  function kmHotkeyFromEvent(e){
    if(!e)return '';
    const ctrl=!!(e.ctrlKey||e.metaKey);
    const shift=!!e.shiftKey;
    if(e.altKey)return '';
    const code=String(e.code||'');
    const key=String(e.key||'');
    if(!ctrl&&(key==='F1'||code==='F1'))return 'help';
    if(!ctrl)return '';
    if(code==='KeyS'||key.toLowerCase()==='s')return shift?'':'save';
    if(code==='KeyP'||key.toLowerCase()==='p')return shift?'':'print';
    if(code==='KeyK'||key.toLowerCase()==='k')return shift?'':'search';
    if((code==='KeyD'||key.toLowerCase()==='d')&&shift)return 'dark';
    if(code==='KeyZ'||key.toLowerCase()==='z')return shift?'redo':'undo';
    if(code==='KeyY'||key.toLowerCase()==='y')return shift?'':'redo';
    return '';
  }

  function bindShortcuts(){
    if(window.__kmShortcutsBound)return;
    window.__kmShortcutsBound=true;
    kmPrBindFrames(); /* KM_CTRLP_CONTEXT_V1 */
    document.addEventListener('keydown',function(e){
      resetAutoLock();
      const name=kmHotkeyFromEvent(e);
      if(!name)return;
      if((name==='undo'||name==='redo')&&kmHotkeyTyping(e.target))return;
      e.preventDefault();
      if(typeof e.stopPropagation==='function')e.stopPropagation();
      window.kmHotkeyRun(name);
    },true);
    try{
      if(window.kmNative&&typeof window.kmNative.onHotkey==='function'){
        window.kmNative.onHotkey(function(name){ window.kmHotkeyRun(name); });
      }
    }catch(eHk){}
    ['click','keydown','mousemove'].forEach(function(ev){
      document.addEventListener(ev,resetAutoLock,{passive:true});
    });
  }

  /* === KM_BACK_AUDIT_V1 === back-button helpers
     1) kmBackToPage(name): «← Վերադարձ» of a page whose parent is a fixed page (e.g. Հաշվառում). If the parent is the
        last history entry, go back (pop) instead of pushing the child again - pushing caused a loop
        (parent's own back returned to the child).
     2) Sub-pages that are rendered in place by a hub card/toolbar button (settings hub cards, docs pack, order draft, …)
        never recorded a navigation entry, so their kmReportsBack() popped one level too far (hub skipped, often
        landing on home). A capture-phase click notes the view a sub-page was opened from; kmReportsBack() then
        returns to that view first. Any real navigation replaces kmCurrentView, which disarms this. */
  window.kmBackToPage=function(name){
    name=String(name||'');
    try{
      if(typeof kmNavHistory!=='undefined'&&Array.isArray(kmNavHistory)&&kmNavHistory.length&&typeof kmGoBack==='function'){
        const t=kmNavHistory[kmNavHistory.length-1];
        if(t&&t.kind==='page'&&String(t.value)===name){ kmGoBack(); return; }
      }
    }catch(eBt){}
    if(typeof window.kmOpenPage==='function')window.kmOpenPage(name);
  };
  const KM_SUBVIEW_OPENERS=/^\s*(?:window\.)?(?:kmOpenSettings|kmOpenBackupManager|kmOpenSecuritySettings|kmOpenAuditLog|kmOpenDocsPack|kmOpenOrderDraft|kmOpenFreePeople|kmOpenFutureSchedules|kmOpenTemplateManager|kmOpenPrintPresetManager|kmOpenUnitsManager|kmOpenUnifiedSubstitutions|kmOpenSubstitutionLog|kmOpenDutySwap|kmOpenRankRules|kmMonthCompare)\s*\(/;
  let kmSubViewBase=null;
  function kmCurView(){ try{ return (typeof kmCurrentView!=='undefined')?kmCurrentView:null; }catch(e){ return null; } }
  try{
    document.addEventListener('click',function(ev){
      try{
        const t=ev.target&&ev.target.closest?ev.target.closest('[onclick]'):null;
        if(!t)return;
        if(KM_SUBVIEW_OPENERS.test(String(t.getAttribute('onclick')||''))){
          const v=kmCurView();
          if(v&&v.value!=null&&String(v.value)!=='')kmSubViewBase=v;
        }
      }catch(eC){}
    },true);
  }catch(eCl){}
  (function(){
    const orig=window.kmReportsBack;
    if(typeof orig!=='function'||orig.__kmBackAudit)return;
    const wrapped=function(){
      try{
        const v=kmCurView();
        if(kmSubViewBase&&v&&kmSubViewBase===v){
          kmSubViewBase=null;
          if(v.kind==='page'&&v.value&&typeof window.kmOpenPage==='function'){ window.kmOpenPage(String(v.value)); return; }
          if(typeof kmOpenView==='function'){ kmOpenView(Object.assign({},v),true); return; }
        }
      }catch(eW){}
      kmSubViewBase=null;
      return orig.apply(this,arguments);
    };
    wrapped.__kmBackAudit=true;
    window.kmReportsBack=wrapped;
  })();
  /* === /KM_BACK_AUDIT_V1 === */

  function hookSaveForUndo(){
    if(typeof window.save!=='function'||window.save.__kmUndoHooked)return;
    const orig=window.save;
    window.save=async function(silent){
      if(!silent && !window.__kmUndoMute && lastSnap){
        kmPushUndo('պահպանում', lastSnap);
      }
      const r=await orig.apply(this,arguments);
      if(!silent) kmUndoCaptureBaseline();
      return r;
    };
    window.save.__kmUndoHooked=true;
    var later=function(){
      try{
        if(document.body&&document.body.classList.contains('km-boot-idle')){
          setTimeout(later,2000);
          return;
        }
      }catch(eIdle){}
      kmUndoCaptureBaseline();
    };
    if(typeof requestIdleCallback==='function')requestIdleCallback(later,{timeout:8000});
    else setTimeout(later,4000);
  }

  function patchRender(){
    if(typeof window.render!=='function'||window.render.__kmV3)return;
    const orig=window.render;
    window.render=function(){
      orig.apply(this,arguments);
      if(typeof window.kmApplyRoleGuard==='function')window.kmApplyRoleGuard();
    };
    window.render.__kmV3=true;
  }

  function injectSearchCss(){
    if(document.getElementById('km-v3-search-css'))return;
    const s=document.createElement('style');
    s.id='km-v3-search-css';
    s.textContent=`
      .kmHomeSearchBar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:0 0 12px}
      .kmHomeSearchBar input[type=search]{flex:1;min-width:220px;padding:9px 12px}
      .kmSearchHits{display:flex;flex-direction:column;gap:6px;max-height:52vh;overflow:auto}
      .kmSearchHit{display:block;width:100%;text-align:left;padding:10px 12px;border:1px solid #d5dde4;border-radius:10px;background:#f7f9fb;cursor:pointer}
      .kmSearchHit b{display:block;font-size:13px;font-weight:800}
      .kmSearchHit span{display:block;font-size:12px;color:#5a6b78;margin-top:2px}
      .kmSearchHit:hover{background:#eaf3fa;border-color:#b7c9d8}
    `;
    document.head.appendChild(s);
  }
  function injectDarkCss(){
    var s=document.getElementById('km-v3-dark-css');
    if(!s){
      s=document.createElement('style');
      s.id='km-v3-dark-css';
      document.head.appendChild(s);
    }
    s.textContent=`
      body.km-dark{
        --KM-bg:#0d1218;
        --KM-surface:#162231;
        --KM-border:#2d4560;
        --KM-text:#e8edf2;
        --KM-muted:#9bb0c0;
        --KM-soft:#1c2a3a;
        --KM-danger-soft:#3a2424;
        background:var(--KM-bg)!important;
        color:var(--KM-text)!important;
      }
      body.km-dark.km-mil-bg-on{
        --KM-bg:#f3f6f9;
        --KM-surface:#ffffff;
        --KM-border:#d4dee7;
        --KM-text:#182433;
        --KM-muted:#3a4a58;
        --KM-soft:#eaf1f6;
        --KM-danger-soft:#fbecec;
        --KM-sidebar-hover:#e8f0f6;
        --KM-sidebar-label-hover:#0d4a66;
      }
      body.km-dark:not(.km-mil-bg-on):not(.km-boot-idle) .app,
      body.km-dark:not(.km-mil-bg-on):not(.km-boot-idle) .main,
      body.km-dark:not(.km-mil-bg-on):not(.km-boot-idle) .top,
      body.km-dark:not(.km-mil-bg-on):not(.km-boot-idle) #content{
        background:var(--KM-bg)!important;
        color:var(--KM-text)!important;
      }
      body.km-dark.km-boot-idle .app,
      body.km-dark.km-boot-idle .main,
      body.km-dark.km-boot-idle .top,
      body.km-dark.km-boot-idle #content,
      body.km-dark.km-mil-bg-on.km-boot-idle .app,
      body.km-dark.km-mil-bg-on.km-boot-idle .main,
      body.km-dark.km-mil-bg-on.km-boot-idle .top,
      body.km-dark.km-mil-bg-on:has(#content:empty) .app,
      body.km-dark.km-mil-bg-on:has(#content:empty) .main,
      body.km-dark.km-mil-bg-on:has(#content:empty) .top{
        background:transparent!important;
        background-color:transparent!important;
      }
      body.km-dark:not(.km-mil-bg-on) .title,body.km-dark:not(.km-mil-bg-on) .kmLawsHubTitle,body.km-dark:not(.km-mil-bg-on) h3,body.km-dark:not(.km-mil-bg-on) h4{
        color:var(--KM-text)!important;
      }
      body.km-dark:not(.km-mil-bg-on) .kmLawsHubLead,body.km-dark:not(.km-mil-bg-on) .muted,body.km-dark:not(.km-mil-bg-on) .dbstatus,body.km-dark:not(.km-mil-bg-on) .calendarLegend{
        color:var(--KM-muted)!important;
      }
      body.km-dark:not(.km-mil-bg-on) .card,body.km-dark:not(.km-mil-bg-on) .stat,body.km-dark:not(.km-mil-bg-on) .modalbox,body.km-dark:not(.km-mil-bg-on) .kmDlgCard{
        background:var(--KM-surface)!important;
        border-color:var(--KM-border)!important;
        color:var(--KM-text)!important;
      }
      body.km-dark:not(.km-mil-bg-on) .kmLanguageBar{
        background:var(--KM-soft)!important;
        border-color:var(--KM-border)!important;
        color:var(--KM-text)!important;
      }
      body.km-dark:not(.km-mil-bg-on) .side{background:var(--KM-sidebar)!important;border-color:#2a3d52}
      body.km-dark.km-mil-bg-on .side,body.km-dark.km-mil-bg-on aside.side{background:transparent!important;border-color:transparent}
      body.km-dark:not(.km-mil-bg-on) input,body.km-dark:not(.km-mil-bg-on) select,body.km-dark:not(.km-mil-bg-on) textarea{
        background:#1c2a3a!important;
        color:#e8edf2!important;
        border-color:#3d5670!important;
      }
      body.km-dark:not(.km-mil-bg-on) .grid th,body.km-dark:not(.km-mil-bg-on) .schedule-table th,body.km-dark:not(.km-mil-bg-on) .a4SystemTable th{
        background:#1c2a3a!important;color:#e8edf2!important;
      }
      body.km-dark:not(.km-mil-bg-on) .grid td,body.km-dark:not(.km-mil-bg-on) .schedule-table td,body.km-dark:not(.km-mil-bg-on) .a4SystemTable td,
      body.km-dark:not(.km-mil-bg-on) .grid td:first-child,body.km-dark:not(.km-mil-bg-on) .grid th:first-child{
        background:#121a24!important;color:#e8edf2!important;border-color:#2a3d52!important;
      }
      body.km-dark:not(.km-mil-bg-on) .tab{background:#1c2a3a!important;color:#e8edf2!important;border-color:#3d5670!important}
      body.km-dark:not(.km-mil-bg-on) .tab.sel{background:var(--KM-accent)!important;color:#fff!important}
      body.km-dark:not(.km-mil-bg-on) .main button:not(.primary):not(.danger):not(.kmLangBtn.active),
      body.km-dark:not(.km-mil-bg-on) .kmDlgCard button:not(.primary):not(.danger),
      body.km-dark:not(.km-mil-bg-on) .modalbox button:not(.primary):not(.danger){
        background:#243447!important;color:#e8edf2!important;border-color:#3d5670!important;
      }
      body.km-dark:not(.km-mil-bg-on) .main button:not(.primary):not(.danger):hover,
      body.km-dark:not(.km-mil-bg-on) .kmDlgCard button:not(.primary):not(.danger):hover{
        background:#2c3f54!important;
      }
      body.km-dark:not(.km-mil-bg-on) #content .kmLawsGrid .kmLawCard:not(.kmGrantCard),
      body.km-dark:not(.km-mil-bg-on) #content .toolbar.kmLawsGrid .kmLawCard:not(.kmGrantCard),
      body.km-dark:not(.km-mil-bg-on) #content .toolbar[data-km-cards="1"] .kmLawCard:not(.kmGrantCard),
      body.km-dark:not(.km-mil-bg-on) #content .kmLawsGrid .kmLawCard:not(.kmGrantCard):hover,
      body.km-dark:not(.km-mil-bg-on) #content .toolbar[data-km-cards="1"] .kmLawCard:not(.kmGrantCard):hover,
      body.km-dark:not(.km-mil-bg-on) #content .kmLawCard:not(.kmGrantCard){
        background:linear-gradient(180deg,#162231 0%,#121c28 100%)!important;
        color:#dce7ef!important;
        border-color:#2d4560!important;
        box-shadow:0 6px 16px rgba(0,0,0,.28)!important;
      }
      body.km-dark:not(.km-mil-bg-on) .kmLawCardText{color:#dce7ef!important}
      body.km-dark:not(.km-mil-bg-on) .kmLawCardIcon,body.km-dark:not(.km-mil-bg-on) #content .kmLawCard .kmLawCardIcon{
        background:linear-gradient(145deg,#16344a,#1a8fa0)!important;color:#fff!important;
      }
      body.km-dark.km-mil-bg-on:not(.km-boot-idle) #content .kmLawsGrid .kmLawCard:not(.kmGrantCard),
      body.km-dark.km-mil-bg-on:not(.km-boot-idle) #content .toolbar.kmLawsGrid .kmLawCard:not(.kmGrantCard),
      body.km-dark.km-mil-bg-on:not(.km-boot-idle) #content .toolbar[data-km-cards="1"] .kmLawCard:not(.kmGrantCard),
      body.km-dark.km-mil-bg-on:not(.km-boot-idle) #content .kmLawsGrid .kmLawCard:not(.kmGrantCard):hover,
      body.km-dark.km-mil-bg-on:not(.km-boot-idle) #content .toolbar[data-km-cards="1"] .kmLawCard:not(.kmGrantCard):hover,
      body.km-dark.km-mil-bg-on:not(.km-boot-idle) #content .kmLawCard:not(.kmGrantCard){
        background:linear-gradient(180deg,#fff 0%,#f4f8fb 100%)!important;
        color:#0d4a66!important;
        border-color:#d7e3ec!important;
        box-shadow:0 6px 16px rgba(16,40,60,.08)!important;
      }
      body.km-dark.km-mil-bg-on:not(.km-boot-idle) .kmLawCardText,
      body.km-dark.km-mil-bg-on:not(.km-boot-idle) #content .kmLawCardText{
        color:#0d4a66!important;
      }
      body.km-dark.km-mil-bg-on:not(.km-boot-idle) #content .kmLawsSubBtn{
        background:linear-gradient(180deg,#fff 0%,#f4f8fb 100%)!important;
        color:#0d4a66!important;
        border-color:#d7e3ec!important;
      }
      body.km-dark.km-mil-bg-on:not(.km-boot-idle) #content .kmGrantCard,
      body.km-dark.km-mil-bg-on:not(.km-boot-idle) #content .kmGrantMenuItem,
      body.km-dark.km-mil-bg-on:not(.km-boot-idle) #content .kmGrantMenuExpand,
      body.km-dark.km-mil-bg-on:not(.km-boot-idle) #content .kmGrantMenuPick{
        background:#fff!important;
        color:#0d4a66!important;
        border-color:#d7e6ec!important;
      }
      body.km-dark.km-mil-bg-on:not(.km-boot-idle) #content .kmGrantMenuExpand:hover{
        background:#eef6f9!important;
        color:#0d4a66!important;
      }
      body.km-dark.km-mil-bg-on:not(.km-boot-idle) #content .kmGrantMenuChildren{
        background:#fbfcfd!important;
        color:#0d4a66!important;
      }
      body.km-dark.km-mil-bg-on:not(.km-boot-idle) .kmLanguageBar{
        background:#f7f9fb!important;
        border-color:#d5dde4!important;
        color:#182433!important;
      }
      body.km-dark.km-mil-bg-on:not(.km-boot-idle) #content .tab{
        background:#fff!important;
        color:#182433!important;
        border-color:#c8d4de!important;
      }
      body.km-dark.km-mil-bg-on:not(.km-boot-idle) #content .tab.sel{
        background:#22394d!important;
        color:#fff!important;
      }
      body.km-dark.km-mil-bg-on:not(.km-boot-idle) .main .top button:not(.primary):not(.danger):not(.kmLangBtn.active),
      body.km-dark.km-mil-bg-on:not(.km-boot-idle) #content button:not(.primary):not(.danger):not(.kmLangBtn.active):not(.kmLawCard):not(.kmGrantMenuExpand):not(.kmGrantMenuPick){
        background:#fff!important;
        color:#182433!important;
        border-color:#c8d0d8!important;
      }
      body.km-dark.km-mil-bg-on .side .km-side-menu > .nav.kmNavCard:not(.km-exit-nav) .kmNavCardText{color:#0d4a66!important}
      body.km-dark.km-mil-bg-on .side .km-side-menu > .nav.kmNavCard:not(.km-exit-nav):hover,
      body.km-mil-bg-on .side .km-side-menu > .nav.kmNavCard:not(.km-exit-nav):hover,
      body.km-mil-bg-on .side .nav:hover,
      body.km-mil-bg-on .side .KM-special-nav:hover{
        background:linear-gradient(180deg,#fff 0%,#eef6fa 100%)!important;
        color:#0d4a66!important;
        -webkit-text-fill-color:#0d4a66!important;
      }
      body.km-dark.km-mil-bg-on .side .km-side-menu > .nav.kmNavCard:not(.km-exit-nav):hover .kmNavCardText,
      body.km-mil-bg-on .side .km-side-menu > .nav.kmNavCard:not(.km-exit-nav):hover .kmNavCardText,
      body.km-mil-bg-on .side .nav:hover .kmNavCardText{
        color:#0d4a66!important;
        -webkit-text-fill-color:#0d4a66!important;
      }
      body.km-mil-bg-on:not(.km-boot-idle) #content tr:hover,
      body.km-mil-bg-on:not(.km-boot-idle) #content tr:hover td,
      body.km-mil-bg-on:not(.km-boot-idle) #content tr:hover th,
      body.km-dark.km-mil-bg-on:not(.km-boot-idle) #content tr:hover,
      body.km-dark.km-mil-bg-on:not(.km-boot-idle) #content tr:hover td,
      body.km-mil-bg-on:not(.km-boot-idle) #content tbody tr:hover td,
      body.km-mil-bg-on:not(.km-boot-idle) #content li:hover,
      body.km-mil-bg-on:not(.km-boot-idle) #content .kmPeoplePickRow:hover,
      body.km-mil-bg-on:not(.km-boot-idle) #content .kmPosPickRow:hover,
      body.km-mil-bg-on:not(.km-boot-idle) #content .kmGrantMenuExpand:hover,
      body.km-mil-bg-on:not(.km-boot-idle) #content .kmGrantMenuPick:hover,
      body.km-mil-bg-on:not(.km-boot-idle) #content .kmPersonSearchItem:hover,
      body.km-mil-bg-on:not(.km-boot-idle) #content .kmUtTable tbody tr:hover td,
      body.km-dark.km-mil-bg-on:not(.km-boot-idle) #content button:not(.primary):not(.danger):not(.kmLangBtn.active):hover,
      body.km-mil-bg-on:not(.km-boot-idle) .main .top button:not(.primary):not(.danger):hover,
      body.km-mil-bg-on:not(.km-boot-idle) #kmExtModal tr:hover,
      body.km-mil-bg-on:not(.km-boot-idle) #kmExtModal tr:hover td,
      body.km-mil-bg-on:not(.km-boot-idle) #kmExtModal li:hover,
      body.km-mil-bg-on:not(.km-boot-idle) #kmExtModal button:not(.primary):not(.danger):hover,
      body.km-mil-bg-on:not(.km-boot-idle) .kmPosModalCard tr:hover,
      body.km-mil-bg-on:not(.km-boot-idle) .kmPosModalCard tr:hover td,
      body.km-mil-bg-on:not(.km-boot-idle) .kmPosModalCard li:hover,
      body.km-mil-bg-on:not(.km-boot-idle) .kmPosModalCard .kmPosPickRow:hover,
      body.km-mil-bg-on:not(.km-boot-idle) .kmPosModalCard button:not(.primary):not(.danger):hover,
      body.km-mil-bg-on:not(.km-boot-idle) .kmDlgCard tr:hover,
      body.km-mil-bg-on:not(.km-boot-idle) .kmDlgCard tr:hover td,
      body.km-mil-bg-on:not(.km-boot-idle) .kmDlgCard li:hover,
      body.km-mil-bg-on:not(.km-boot-idle) .kmDlgCard button:not(.primary):not(.danger):hover{
        background:#e8f0f6!important;
        color:#0b1a33!important;
        -webkit-text-fill-color:#0b1a33!important;
      }
      body.km-mil-bg-on:not(.km-boot-idle) #content tr:hover td:not(.dutyTypeBlackCell):not(.assigned),
      body.km-mil-bg-on:not(.km-boot-idle) #content tr:hover td:not(.dutyTypeBlackCell) *:not(button):not(.kmPosAct),
      body.km-mil-bg-on:not(.km-boot-idle) #content li:hover,
      body.km-mil-bg-on:not(.km-boot-idle) #content li:hover *:not(button){
        color:#0b1a33!important;
        -webkit-text-fill-color:#0b1a33!important;
      }
      body.km-mil-bg-on:not(.km-boot-idle) #content .kmPosActOn,
      body.km-mil-bg-on:not(.km-boot-idle) #content tr:hover .kmPosActOn,
      body.km-dark.km-mil-bg-on:not(.km-boot-idle) #content .kmPosActOn,
      body.km-dark.km-mil-bg-on:not(.km-boot-idle) #content tr:hover .kmPosActOn{
        background:#2f5d75!important;
        color:#fff!important;
        -webkit-text-fill-color:#fff!important;
        border-color:#2f5d75!important;
      }
      body.km-mil-bg-on:not(.km-boot-idle) #content .kmPosActOff,
      body.km-mil-bg-on:not(.km-boot-idle) #content tr:hover .kmPosActOff,
      body.km-dark.km-mil-bg-on:not(.km-boot-idle) #content .kmPosActOff,
      body.km-dark.km-mil-bg-on:not(.km-boot-idle) #content tr:hover .kmPosActOff{
        background:#fff!important;
        color:#1d2733!important;
        -webkit-text-fill-color:#1d2733!important;
        border:1px solid #c5d0da!important;
      }
      body.km-mil-bg-on:not(.km-boot-idle) #content button.primary:hover,
      body.km-dark.km-mil-bg-on:not(.km-boot-idle) #content button.primary:hover,
      body.km-mil-bg-on:not(.km-boot-idle) .kmDlgCard button.primary:hover,
      body.km-mil-bg-on:not(.km-boot-idle) .kmPosModalCard button.primary:hover,
      body.km-mil-bg-on:not(.km-boot-idle) #kmExtModal button.primary:hover{
        background:#274e68!important;
        color:#fff!important;
        -webkit-text-fill-color:#fff!important;
      }
      body.km-mil-bg-on:not(.km-boot-idle) #content tr:hover td.dutyTypeBlackCell,
      body.km-mil-bg-on:not(.km-boot-idle) #content tr:hover td.assigned,
      body.km-mil-bg-on:not(.km-boot-idle) #content tr:hover .autoDutyBlack{
        background:#000!important;
        color:#000!important;
        -webkit-text-fill-color:transparent!important;
      }
      body.km-dark:not(.km-mil-bg-on) .kmSearchHit span{color:#9bb0c0!important}
      body.km-dark:not(.km-mil-bg-on) .kmSearchHit:hover{background:#243447!important}
      body.km-dark:not(.km-mil-bg-on) .grid .weekendColumn,body.km-dark:not(.km-mil-bg-on) .a4SystemTable .weekendColumn,body.km-dark:not(.km-mil-bg-on) .weekendCell{background:#1a2430!important}
      body.km-dark:not(.km-mil-bg-on) .autoDutyBlack,body.km-dark:not(.km-mil-bg-on) .dutyTypeBlackCell,body.km-dark:not(.km-mil-bg-on) td.assigned{background:#0b0f14!important;color:#f0f4f8}
      body.km-dark:not(.km-mil-bg-on) .vacationCell{background:#2a2430!important;color:#d8c8e8}
      body.km-dark:not(.km-mil-bg-on) .badDayCell{background:#2a1c1c!important}
      body.km-dark:not(.km-mil-bg-on) .kmFormalTop,body.km-dark:not(.km-mil-bg-on) .kmFormalBottom,body.km-dark:not(.km-mil-bg-on) .kmFormalBlock,body.km-dark:not(.km-mil-bg-on) [class*="kmFormal"]{background:#162231;color:#e8edf2;border-color:#2d4560}
      body.km-dark:not(.km-mil-bg-on) #kmLoginOverlay .kmLoginCard{background:#162231!important;color:#f0f4f8}
      body.km-dark:not(.km-mil-bg-on) #kmLoginOverlay .kmLoginCard input,body.km-dark:not(.km-mil-bg-on) #kmLoginOverlay .kmLoginCard select{background:#1c2a3a;color:#f0f4f8;border-color:#3d5670}
      body.km-mil-bg-on #kmLoginOverlay .kmLoginCard,
      body.km-dark.km-mil-bg-on #kmLoginOverlay .kmLoginCard{
        background:linear-gradient(180deg,#fffdf6 0%,#fff 48px)!important;
        color:#0b1a33!important;
        border-color:#d4b45a!important;
      }
      body.km-mil-bg-on #kmLoginOverlay .kmLoginCard h3,
      body.km-dark.km-mil-bg-on #kmLoginOverlay .kmLoginCard h3,
      body.km-mil-bg-on #kmLoginOverlay .kmLoginCard,
      body.km-mil-bg-on #kmLoginOverlay .kmLoginCard label,
      body.km-mil-bg-on #kmLoginOverlay .kmLoginCard p,
      body.km-mil-bg-on #kmLoginOverlay .kmLoginCard span,
      body.km-mil-bg-on #kmLoginOverlay .kmLoginCard .muted,
      body.km-mil-bg-on #kmLoginOverlay #kmLoginSubtitle,
      body.km-dark.km-mil-bg-on #kmLoginOverlay .kmLoginCard label,
      body.km-dark.km-mil-bg-on #kmLoginOverlay .kmLoginCard p,
      body.km-dark.km-mil-bg-on #kmLoginOverlay .kmLoginCard span,
      body.km-dark.km-mil-bg-on #kmLoginOverlay .kmLoginCard .muted,
      body.km-dark.km-mil-bg-on #kmLoginOverlay #kmLoginSubtitle{
        color:#0b1a33!important;
        opacity:1!important;
        text-shadow:none!important;
      }
      body.km-mil-bg-on #kmLoginOverlay .kmLoginCard input,
      body.km-mil-bg-on #kmLoginOverlay .kmLoginCard select,
      body.km-dark.km-mil-bg-on #kmLoginOverlay .kmLoginCard input,
      body.km-dark.km-mil-bg-on #kmLoginOverlay .kmLoginCard select{
        background:#fff!important;
        color:#0b1a33!important;
        -webkit-text-fill-color:#0b1a33!important;
        caret-color:#0b1a33!important;
        border-color:#c5d0dc!important;
        opacity:1!important;
      }
      body.km-mil-bg-on #kmLoginOverlay .kmLoginCard input::placeholder,
      body.km-dark.km-mil-bg-on #kmLoginOverlay .kmLoginCard input::placeholder{
        color:#3a4a5c!important;
        opacity:1!important;
      }
      body.km-mil-bg-on #kmLoginOverlay .kmLoginCard button:not(.primary),
      body.km-dark.km-mil-bg-on #kmLoginOverlay .kmLoginCard button:not(.primary){
        background:#fff!important;
        color:#0b1a33!important;
        border-color:#c5d0dc!important;
      }
      body.km-dark .kmPrintPreviewOverlay .kmPrintPreviewShell,body.km-dark .kmPrintPreviewOverlay .kmPrintPreviewToolbar{background:#121a24;color:#f0f4f8}
      body.km-dark .kmPrintPreviewOverlay .kmPrintPaper,
      body.km-dark #kmPrintPreview .kmPrintPaper,
      body.km-dark .a4PrintPaper,body.km-dark .dutyPrintPaper,body.km-dark .archivePrintPaper{
        background:#fff!important;color:#111!important;
      }
      body.km-dark:not(.km-mil-bg-on) .nav{color:#e8edf2}
      body.km-role-viewer #content .toolbar button:not(:disabled){opacity:.85}
      body.km-role-viewer #content td[data-s],body.km-role-viewer #content td[data-dtype-person]{pointer-events:none;cursor:default}
    `;
    document.head.appendChild(s);
  }

  async function kmV3Init(){
    injectSearchCss();
    injectDarkCss();
    hookSaveForUndo();
    patchRender();
    bindShortcuts();
    try{
      if(window.kmNative&&window.kmNative.settings){
        const s=await window.kmNative.settings.get();
        window.kmAutoLockMinutes=Number(s.autoLockMinutes)||0;
        if(s.darkMode)document.body.classList.add('km-dark');
      }
    }catch(e){}
    resetAutoLock();
  }

  /* ===== KM_RIGHTS_V15_UNIVERSAL — capture-phase read-only guard =====
     Every section / sub-section / button / dialog: when the current page is view-only for the
     signed-in user (viewer, editor or delegated admin) any mutating control is blocked at the
     moment of the click, including buttons created after the last role-guard pass and
     non-<button> elements with inline onclick. Navigation, search, tabs and elements marked
     data-km-allow-view="1" stay usable. Fails open if the shared helpers are missing. */
  (function kmReadOnlyCaptureGuard(){
    if(window.__kmRoCaptureGuard)return; window.__kmRoCaptureGuard=true;
    var MUTATE=/(save|add[A-Z_(]|create|delete|remove|\bdel[A-Z]|import|upload|attach|detach|vacan|clear|reset|apply|approve|assign|update|rename|merge|restore|commit|submit|scan|generate|transfer|promot|discharge|insert|append|paste|edit|set[A-Z])/;
    var lastToast=0;
    function readOnly(){
      try{
        if(kmIsSettingsScope(window.page, window.kmLibSection))return false; /* KM_SETTINGS_UNTOUCHED */
        if(window.kmUserRole==='viewer')return true;
        return typeof window.kmUserViewOnly==='function'&&!!window.kmUserViewOnly();
      }catch(e){return false;}
    }
    function inScope(t){
      try{ return !!(t&&t.closest&&t.closest('#content,#kmExtModal,.kmDlgCard')&&!t.closest('#kmLoginOverlay')); }catch(e){return false;}
    }
    function warn(){
      var now=Date.now(); if(now-lastToast<900)return; lastToast=now;
      try{ if(typeof toast==='function')toast('Միայն դիտում — փոփոխությունն արգելված','warn'); }catch(e){}
    }
    function block(ev){
      try{ ev.preventDefault(); ev.stopPropagation(); if(ev.stopImmediatePropagation)ev.stopImmediatePropagation(); }catch(e){}
      warn();
    }
    function isNav(el){
      try{ return typeof window._kmIsNavButton==='function'?!!window._kmIsNavButton(el):true; }catch(e){return true;}
    }
    document.addEventListener('click',function(ev){
      var t=ev.target; if(!t||!t.closest||!inScope(t))return;
      if(!readOnly())return;
      var el=t.closest('button,input[type="button"],input[type="submit"],input[type="file"],[onclick],a[onclick],[role="button"]');
      if(!el||!inScope(el))return;
      if(el.getAttribute('data-km-allow-view')==='1'||el.closest('[data-km-allow-view="1"]'))return;
      if(el.tagName==='BUTTON'||el.tagName==='INPUT'){
        if(el.tagName==='INPUT'&&el.type!=='button'&&el.type!=='submit'&&el.type!=='file')return;
        if(isNav(el))return;
        return block(ev);
      }
      var oc=String(el.getAttribute('onclick')||'');
      if(oc&&MUTATE.test(oc)&&!isNav(el))return block(ev);
    },true);
    document.addEventListener('submit',function(ev){
      var f=ev.target; if(!inScope(f)||!readOnly())return;
      if(f.getAttribute&&f.getAttribute('data-km-allow-view')==='1')return;
      block(ev);
    },true);
    document.addEventListener('drop',function(ev){
      if(!inScope(ev.target)||!readOnly())return;
      if(ev.dataTransfer&&ev.dataTransfer.files&&ev.dataTransfer.files.length)block(ev);
    },true);
    document.addEventListener('change',function(ev){
      var t=ev.target; if(!t||!inScope(t)||!readOnly())return;
      if(t.type==='file'||t.type==='checkbox'||t.type==='radio'||t.tagName==='SELECT'){
        if(t.type==='search'||/ListQ$/.test(String(t.id||''))||t.getAttribute('data-km-allow-view')==='1'||t.closest('[data-km-allow-view="1"]'))return;
        if(t.classList&&(t.classList.contains('kmPersTab')||t.hasAttribute('data-km-toggle')||t.hasAttribute('data-km-pers-tab')))return;
        if(t.type==='file')block(ev);
      }
    },true);
  })();


  /* ===== KM_PERF_PROBE_V1 — "what is freezing?" diagnostic (off by default, zero cost when off) =====
     Ctrl+Alt+P opens a small report of main-thread freezes (> 50 ms) with the section that was open.
     It also keeps recording on later starts (localStorage.kmPerf = "1") until switched off in the report. */
  (function kmPerfProbe(){
    if(window.__kmPerfProbe)return; window.__kmPerfProbe=true;
    var log=[], obs=null, obsEv=null, raf=0, lastFrame=0, lastVis=0, MAX=300;
    function enabled(){ try{ return localStorage.getItem('kmPerf')==='1'; }catch(e){ return !!window.__kmPerfOn; } }
    function setEnabled(v){ window.__kmPerfOn=!!v; try{ if(v)localStorage.setItem('kmPerf','1'); else localStorage.removeItem('kmPerf'); }catch(e){} }
    function where(){
      var pg=String(window.page||(typeof page!=='undefined'?page:'')||'');
      var sub=String(window.kmLibSection||'');
      return pg+(sub&&pg==='library'?(':'+sub):'');
    }
    function observe(){
      if(obs||typeof PerformanceObserver!=='function')return;
      try{
        obs=new PerformanceObserver(function(list){
          list.getEntries().forEach(function(e){
            log.push({at:Math.round(e.startTime/1000),ms:Math.round(e.duration),where:where(),kind:'JS'});
            if(log.length>MAX)log.shift();
          });
        });
        obs.observe({entryTypes:['longtask']});
      }catch(e){ obs=null; }
      /* slow interactions: time from a click/key until the next paint (covers layout + paint, not only JS) */
      try{
        obsEv=new PerformanceObserver(function(list){
          list.getEntries().forEach(function(e){
            if(e.duration<120||(e.name!=='click'&&e.name!=='keydown'))return; /* one entry per interaction */
            var t=e.target&&e.target.closest?e.target.closest('[onclick],button,a,.nav'):null;
            var lab=t?((t.getAttribute('data-page')||t.getAttribute('onclick')||t.id||t.textContent||'').trim().slice(0,40)):'';
            log.push({at:Math.round(e.startTime/1000),ms:Math.round(e.duration),where:where()+(lab?' > '+lab:''),kind:'click→paint'});
            if(log.length>MAX)log.shift();
          });
        });
        obsEv.observe({type:'event',buffered:true,durationThreshold:104});
      }catch(e2){ obsEv=null; }
      /* frame gaps: the screen did not update for > 150 ms (also catches paint / GPU stalls) */
      if(!raf&&typeof requestAnimationFrame==='function'){
        lastFrame=performance.now();
        var tick=function(now){
          if(lastFrame&&now-lastFrame>150&&document.visibilityState==='visible'&&lastVis<lastFrame){ /* skip gaps where the window was hidden / minimised / covered */
            log.push({at:Math.round(now/1000),ms:Math.round(now-lastFrame),where:where(),kind:'frame gap'});
            if(log.length>MAX)log.shift();
          }
          lastFrame=now; raf=requestAnimationFrame(tick);
        };
        raf=requestAnimationFrame(tick);
      }
    }
    document.addEventListener('visibilitychange',function(){ lastVis=performance.now(); });
    function stop(){
      if(obs){ try{obs.disconnect();}catch(e){} obs=null; }
      if(obsEv){ try{obsEv.disconnect();}catch(e){} obsEv=null; }
      if(raf){ try{cancelAnimationFrame(raf);}catch(e){} raf=0; }
    }
    function summary(){
      var by=Object.create(null);
      log.forEach(function(x){ var k=(x.where||'(start-up)')+'  ['+(x.kind||'JS')+']'; (by[k]=by[k]||{n:0,sum:0,max:0}); by[k].n++; by[k].sum+=x.ms; if(x.ms>by[k].max)by[k].max=x.ms; });
      var rows=Object.keys(by).map(function(k){ return {where:k,n:by[k].n,sum:by[k].sum,max:by[k].max}; }).sort(function(a,b){return b.sum-a.sum;});
      var out=['KM freeze report ('+new Date().toISOString()+')','recording: '+(enabled()?'ON':'OFF')+(obs?'':' (not running)'),'events: '+log.length+'  [JS = main-thread task > 50 ms | click\u2192paint = click until screen updated > 120 ms | frame gap = no frame for > 150 ms]',''];
      if(!rows.length)out.push('Nothing recorded yet. Recording starts only NOW (first press). Open the slow sections / click the menus, then press Ctrl+Alt+P again.');
      rows.forEach(function(r){ out.push(r.where+'  |  times: '+r.n+'  |  total: '+r.sum+' ms  |  worst: '+r.max+' ms'); });
      out.push('','last 20:');
      log.slice(-20).forEach(function(x){ out.push('  t+'+x.at+'s  '+x.ms+' ms  '+(x.kind||'JS')+'  '+(x.where||'(start-up)')); });
      return out.join('\n');
    }
    function close(){ var o=document.getElementById('kmPerfOverlay'); if(o)o.remove(); }
    function show(){
      close();
      var o=document.createElement('div'); o.id='kmPerfOverlay';
      o.style.cssText='position:fixed;right:16px;bottom:16px;z-index:2147483000;width:min(560px,92vw);max-height:70vh;display:flex;flex-direction:column;background:#10222b;color:#e6f2f6;border:1px solid #2c5566;border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,.45);font:12px/1.45 ui-monospace,Consolas,monospace';
      var pre=document.createElement('pre'); pre.style.cssText='margin:0;padding:12px;overflow:auto;white-space:pre-wrap;flex:1'; pre.textContent=summary();
      var bar=document.createElement('div'); bar.style.cssText='display:flex;gap:8px;padding:8px 12px;border-top:1px solid #2c5566;flex-wrap:wrap';
      function b(txt,fn){ var x=document.createElement('button'); x.type='button'; x.textContent=txt; x.setAttribute('data-km-allow-view','1'); x.style.cssText='padding:5px 10px;border-radius:8px;border:1px solid #3b6b80;background:#17333f;color:#e6f2f6;cursor:pointer;font:inherit'; x.onclick=fn; bar.appendChild(x); }
      b(enabled()?'Անջատել գրանցումը':'Միացնել գրանցումը',function(){ if(enabled()){ setEnabled(false); stop(); } else { setEnabled(true); observe(); } show(); });
      b('Պատճենել',function(){ try{ navigator.clipboard.writeText(pre.textContent); }catch(e){ var r=document.createRange(); r.selectNodeContents(pre); var sel=getSelection(); sel.removeAllRanges(); sel.addRange(r); } });
      b('Մաքրել',function(){ log.length=0; show(); });
      b('Փակել',close);
      o.appendChild(pre); o.appendChild(bar); document.body.appendChild(o);
    }
    window.kmPerfReport=function(){ if(!enabled()){ setEnabled(true); observe(); } show(); return summary(); };
    document.addEventListener('keydown',function(ev){
      if(ev.ctrlKey&&ev.altKey&&!ev.shiftKey&&(ev.key==='p'||ev.key==='P'||ev.code==='KeyP')){
        ev.preventDefault();
        if(document.getElementById('kmPerfOverlay')){ close(); return; }
        if(!enabled()){ setEnabled(true); observe(); }
        show();
      }
    },true);
    if(enabled())observe();
  })();


  /* ===== KM_SEED_PREFETCH_V1 =====
     Opening «Հաշվառում» for the first time ran a SYNCHRONOUS XHR + JSON.parse of data/km_unit_archive_25836.json
     (~800 KB, measured ~270 ms of frozen UI). The same file is now read asynchronously a few seconds after start-up
     and placed in the exact caches the existing loaders already check first. If the user is faster than the prefetch,
     the old synchronous path still runs unchanged. Each cache gets its own JSON.parse result (no shared object). */
  (function kmPrefetchUnitSeed(){
    if(window.__kmSeedPrefetchV1)return; window.__kmSeedPrefetchV1=true;
    function run(){
      if(window.__kmUnit25836Seed&&window.__kmSeed25836Cache)return;
      var x;
      try{ x=new XMLHttpRequest(); x.open('GET','data/km_unit_archive_25836.json',true); }catch(e){ return; }
      x.onload=function(){
        try{
          if(!(x.status===0||(x.status>=200&&x.status<300)))return;
          var txt=x.responseText||''; if(!txt)return;
          var a=JSON.parse(txt);
          if(a&&Array.isArray(a.roster)&&a.roster.length&&!window.__kmUnit25836Seed)window.__kmUnit25836Seed=a;
          if(!window.__kmSeed25836Cache){ window.__kmSeed25836Cache=JSON.parse(txt); window.__kmSeed25836CacheVer='v3-by-pos'; }
        }catch(e2){}
      };
      try{ x.send(null); }catch(e3){}
    }
    function schedule(){
      setTimeout(function(){
        if(typeof requestIdleCallback==='function')requestIdleCallback(run,{timeout:6000}); else run();
      },2500);
    }
    if(document.readyState==='complete')schedule(); else window.addEventListener('load',schedule);
  })();

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',kmV3Init);
  else kmV3Init();
})();
