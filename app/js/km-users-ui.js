/* KM app users / appointed admins — stored in UserData/km_app_users.json */
(function () {
  'use strict';

  var SUPER_ADMIN = 'Koryun1992';

  /* Մենյուի կառուցվածք՝ ինչպես կողային մենյուն (Հիմնական միշտ բաց է · Ադմին/Օգտատերեր՝ միայն ադմին) */
  var GRANT_MENU = [
    {
      id: 'accounting', label: 'Հաշվառում', icon: '📋',
      children: [
        { id: 'people', label: 'Անձնակազմ և Պաշտոն', icon: '👥',
          children: [
            { id: 'people:card', label: 'Քարտ', icon: '🪪' },
            { id: 'people:attach', label: 'Կցել', icon: '🔗' },
            { id: 'people:vacant', label: 'Դարձնել թափուր', icon: '○' },
            { id: 'people:units', label: 'Զորամասեր', icon: '🏘' },
            { id: 'positions', label: 'Պաշտոն (ցուցակ)', icon: '📌' }, /* KM_RIGHTS_V8 */
            { id: 'unitDossiers', label: 'Էլեկտրոնային քարտադարան', icon: '📂' } /* KM_RIGHTS_V8 */
          ]
        },
        { id: 'vacations', label: 'Արձակուրդ', icon: '🏖' },
        { id: 'troopStructure', label: 'Անձնակազմի հաշվառում', icon: '🏛' },
        { id: 'unitFormation', label: 'Շարային տեղեկագիր', icon: '📋' },
        { id: 'unitMedical', label: 'Բուժկետ', icon: '🩺' },
        { id: 'unitTermWatch', label: 'Կոչումներ և ժամկետներ', icon: '⏱' },
        { id: 'unitLeavePlan', label: 'Արձակուրդների հերթափոխ', icon: '📅' },
        { id: 'unitArchive', label: 'Զորամասի Արխիվ', icon: '🗄' },
        { id: 'unitInventory', label: 'Գույքի հաշվառում', icon: '📦', /* KM_INV_SCOPE_GRANTS_V1 */
          children: [
            { id: 'unitInventory:sub', label: 'Ստորաբաժանում', icon: '🏢',
              children: [
                { id: 'unitInventory:sub:f26', label: 'Ձև 26 մատյան', icon: '📘' },
                { id: 'unitInventory:sub:f28', label: 'Ձև 28 մատյան', icon: '📗' },
                { id: 'unitInventory:sub:apranq_mutq', label: 'Մուտքի ապրանքագիր', icon: '📥' },
                { id: 'unitInventory:sub:apranq_elq', label: 'Ելքի ապրանքագիր', icon: '📤' },
                { id: 'unitInventory:sub:receipt', label: 'Ստացական', icon: '🧾' } /* KM_HAMALR_MOVE_V1: hamalr -> unitHamalr below */
              ]
            },
            { id: 'unitInventory:svc', label: 'Ծառայություն', icon: '🛡️',
              children: [
                { id: 'unitInventory:svc:f27', label: 'Ձև 27 մատյան', icon: '📒' },
                { id: 'unitInventory:svc:f28', label: 'Ձև 28 մատյան', icon: '📗' },
                { id: 'unitInventory:svc:apranq_mutq', label: 'Մուտքի ապրանքագիր', icon: '📥' },
                { id: 'unitInventory:svc:apranq_elq', label: 'Ելքի ապրանքագիր', icon: '📤' },
                { id: 'unitInventory:svc:receipt', label: 'Ստացական', icon: '🧾' } /* KM_HAMALR_MOVE_V1 */
              ]
            }
          ]
        },
        { id: 'unitHamalr', label: 'Համալրվածության վերաբերյալ հաշվետվություն', icon: '📊', /* KM_HAMALR_MOVE_V1: same leaf ids as before (data/grants unchanged) */
          children: [
            { id: 'unitInventory:sub:hamalr', label: 'Ստորաբաժանում (համալրվածություն)', icon: '🏢' },
            { id: 'unitInventory:svc:hamalr', label: 'Ծառայություն (համալրվածություն)', icon: '🛡️' }
          ]
        },
        { id: 'unitReserve', label: 'Պահեստազոր', icon: '🏛' } /* KM_RESERVE_ARCHIVE_V1 */,
        { id: 'rankRules', label: 'Կոչումների կանոններ', icon: '⭐' } /* KM_MENU_REORG_V1: moved from Աշխատանքային գործիքներ (same id) */,
        { id: 'orgCorps', label: 'Բանակային կորպուսներ', icon: '🏛', adminOnly: true }
      ]
    },
    {
      id: 'dutyTypes', label: 'Վերակարգ', icon: '🛡', /* KM_MENU_REORG_V1: renamed (id unchanged) */
      children: [
        { id: 'dutyTypes', label: 'Վերակարգ', icon: '🛡' },
        { id: 'schedule', label: 'Վերակարգի պլանավորում', icon: '📅' },
        { id: 'workStatus', label: 'Աշխատանքային վիճակ', icon: '📋' }, /* KM_MENU_REORG_V1 */
        { id: 'workload', label: 'Բեռ', icon: '📈' },
        { id: 'dutyKiosk', label: 'Տախտակ', icon: '📺' },
        /* KM_MENU15_V1: from deleted reports hub + from Աշխատանքային գործիքներ */
        { id: 'analytics', label: 'Վիճակագրություն', icon: '📉' },
        { id: 'monthlyReport', label: 'Ամսական հաշվետվություն', icon: '📄' },
        { id: 'monthSummary', label: 'Ամսվա ամփոփում', icon: '📋' },
        { id: 'monthCompare', label: 'Ամիսների համեմատություն', icon: '📊' },
        { id: 'substitutions', label: 'Փոխանակումների մատյան', icon: '🔁' },
        { id: 'exportMonthGraphs', label: 'Ամսվա բոլոր գրաֆիկները', icon: '📑' },
        { id: 'unitBadDays', label: 'Անհարմար օրեր', icon: '🚫' },
        { id: 'freePeople', label: 'Ո՞վ է ազատ', icon: '🆓' }
      ]
    },
    /* KM_MENU_REORG_V1: the «Գրադարան» node was removed from the menu; its leaves (same lib:* ids) are listed under
       «Աշխատանքային գործիքներ». A stored 'library' grant still expands to them (GRANT_PARENTS.library). */
    {
      id: 'archiveHub', label: 'Արխիվ', icon: '🗃', /* KM_ARCHIVE_HUB_V1: same leaf ids as before */
      children: [
        { id: 'lib:hishoxutyun', label: 'Հիշողություն', icon: '🕘' },
        { id: 'lib:current', label: 'Ընթացիկ արխիվ', icon: '💾' },
        { id: 'lib:archive', label: 'Արխիվ', icon: '🗄', superAdminOnly: true },
        { id: 'soldierCards', label: 'Զինծառայողների քարտեր', icon: '📁' }, /* KM_RIGHTS_V8: Անձի քարտ PDF արխիվ */
        { id: 'sysinfo', label: 'Տեղեկություն', icon: 'ℹ️', adminOnly: true }
      ]
    },
    {
      id: 'syssettings', label: 'Համակարգի կարգավորումներ', icon: '⚙',
      children: [
        { id: 'network', label: 'Ցանց և ֆայլեր', icon: '🌐' }, /* KM_ARCHIVE_HUB_V1: sysinfo -> archiveHub */
        { id: 'lib:license', label: 'Արտոնագիր', icon: '🔑', adminOnly: true }, /* KM_MENU15_V1 */
        { id: 'fonts', label: 'Ֆոնտեր', icon: '🔤', adminOnly: true } /* KM_RIGHTS_V8 */
      ]
    },
    {
      id: 'unitTools', label: 'Աշխատանքային գործիքներ', icon: '🧰', /* KM_MENU_REORG_V1: renamed (id unchanged) */
      children: [
        { id: 'unitDocs', label: 'Փաստաթղթերի գեներատոր', icon: '✍' },
        { id: 'unitCharDrafts', label: 'Բնութագրի օգնական', icon: '📄' },
        { id: 'unitFuel', label: 'ՎՔՆ հաշվիչ', icon: '⛽' },
        { id: 'unitDayPlans', label: 'Օրվա կարգացուցակ', icon: '🗒' },
        { id: 'unitBlanks', label: 'Ձևաթղթերի պորտալ', icon: '📁' },
        /* KM_MENU15_V1: unitBadDays/freePeople -> Վերակարգ; reports section deleted; license -> syssettings */
        { id: 'usb', label: 'USB', icon: '💾' },
        { id: 'docsPack', label: 'Փաստաթղթերի փաթեթ', icon: '📦' },
        { id: 'orderDraft', label: 'Հրամանի նախագիծ', icon: '✍' },
        {
          id: 'unitTrialLab', label: 'Փորձաշրջան', icon: '🧪',
          children: [
            { id: 'unitTrialExam', label: 'Ծառայողական քննությունների օգնական', icon: '🧭' },
            { id: 'unitTrialChar', label: 'Բնութագրերի օգնական', icon: '✨' },
            { id: 'unitTrialMonitor', label: 'Տույժերի ժամկետների հսկիչ', icon: '⏱' }
          ]
        },
        { id: 'lib:notes', label: 'Նշումներ', icon: '📅' },
        { id: 'lib:management', label: 'Կառավարում', icon: '⚙️', superAdminOnly: true },
        { id: 'lib:spreadsheets', label: 'Աղյուսակներ և հաշվարկներ', icon: '🧮' },
        { id: 'lib:files', label: 'Ֆայլերի պահոց', icon: '📚' },
        { id: 'lib:pdfTranslate', label: 'PDF թարգմանություն', icon: '🌐' },
        { id: 'lib:original', label: 'Բնօրինակ', icon: '📁' },
        { id: 'lib:convert', label: 'Ֆայլերի փոխակերպում', icon: '🔄' }
      ]
    },
    {
      id: 'lawdocs', label: 'Իրավական անկյուն', icon: '⚖',
      children: [
        {
          id: 'constitution_hub', label: 'ՀՀ Սահմանադրություն և օրենսգրքեր', icon: '📜',
          children: [
            { id: 'constitution', label: 'ՀՀ Սահմանադրություն', icon: '📜' },
            { id: 'electoral', label: 'ՀՀ Ընտրական օրենսգիրք', icon: '🗳' },
            { id: 'admin_offenses', label: 'Վարչական իրավախախտումներ', icon: '🛡' },
            { id: 'civil', label: 'ՀՀ Քաղաքացիական օրենսգիրք', icon: '🤝' },
            { id: 'land', label: 'ՀՀ Հողային օրենսգիրք', icon: '🌿' },
            { id: 'water', label: 'ՀՀ Ջրային օրենսգիրք', icon: '💧' },
            { id: 'family', label: 'ՀՀ Ընտանեկան օրենսգիրք', icon: '👨‍👩‍👧' },
            { id: 'labor', label: 'ՀՀ Աշխատանքային օրենսգիրք', icon: '💼' },
            { id: 'forest', label: 'ՀՀ Անտառային օրենսգիրք', icon: '🌳' },
            { id: 'subsoil', label: 'Ընդերքի մասին ՀՀ օրենսգիրք', icon: '⛏' },
            { id: 'admin_proc', label: 'ՀՀ Վարչական դատավարություն', icon: '🛡' },
            { id: 'tax', label: 'ՀՀ Հարկային օրենսգիրք', icon: '🧾' },
            { id: 'eaeu', label: 'ԵԱՏՄ մաքսային օրենսգիրք', icon: '🌐' },
            { id: 'judicial', label: 'ՀՀ Դատական օրենսգիրք', icon: '⚖' },
            { id: 'civil_proc', label: 'ՀՀ Քաղաքացիական դատավարություն', icon: '📄' },
            { id: 'criminal', label: 'ՀՀ Քրեական օրենսգիրք', icon: '⚖' },
            { id: 'crim_proc', label: 'ՀՀ Քրեական դատավարություն', icon: '⚖' },
            { id: 'penitentiary', label: 'ՀՀ Քրեակատարողական օրենսգիրք', icon: '🛡' }
          ]
        },
        {
          id: 'statutes', label: 'Կանոնադրություններ', icon: '📖',
          children: [
            { id: 'statute_internal', label: 'Ներքին ծառայության կանոնագիրք', icon: '📖' },
            { id: 'statute_garrison', label: 'Կայազորային և պահակային կանոնագիրք', icon: '🛡' },
            { id: 'statute_discipline', label: 'Կարգապահական կանոնագիրք', icon: '⚖' },
            { id: 'statute_drill', label: 'Շարային կանոնադրություն', icon: '📋' }
          ]
        },
        {
          id: 'orders', label: 'Հրամաններ', icon: '📑',
          children: [
            { id: 'orders_president', label: 'ՀՀ Նախագահի հրամաններ', icon: '📑' },
            { id: 'orders_pm', label: 'ՀՀ Վարչապետի հրամաններ', icon: '📑' },
            { id: 'orders_mod', label: 'ՀՀ ՊՆ նախարարի հրամաններ', icon: '📑' },
            { id: 'orders_cgs', label: 'ՀՀ ՊՆ ԳՇ պետի հրամաններ', icon: '📑' },
            { id: 'orders_mp', label: 'Բանակային կորպուսի հրամանատարի հրամաններ', icon: '📑' },
            { id: 'orders_gdnd', label: 'Գնդի հրամանատարի հրամաններ', icon: '📑' }
          ]
        },
        { id: 'directives', label: 'Հրահանգներ', icon: '📎' },
        { id: 'military_acts', label: 'Զինվորական ակտեր', icon: '📜' },
        { id: 'characteristic', label: 'Բնութագիր', icon: '📄' },
        { id: 'acts_discipline', label: 'Կարգապահական տույժեր', icon: '⚖' },
        { id: 'encouragements', label: 'Խրախուսանքներ', icon: '🏅' },
        { id: 'acts_exam', label: 'Ծառայողական քննության եզրակացություն', icon: '📝' },
        {
          id: 'soldier_rights', label: 'Զինծառայողի իրավունքները', icon: '🛡',
          children: [
            { id: 'rights_medical', label: 'Բուժօգնություն', icon: '🩺' },
            { id: 'rights_housing', label: 'Բնակարանային ապահովում', icon: '🏠' },
            { id: 'rights_education', label: 'Կրթական արտոնություններ', icon: '🎓' },
            { id: 'rights_transport', label: 'Տրանսպորտային արտոնություններ', icon: '🚌' },
            { id: 'rights_leave', label: 'Արձակուրդների հաշվիչ', icon: '📅' },
            { id: 'rights_military_service_law', label: 'Զինվորական ծառայություն անցնելու մասին ՀՀ օրենք', icon: '📜' },
            { id: 'rights_family_leave', label: 'Ընտանեկան արձակուրդներ', icon: '👨‍👩‍👧' },
            { id: 'rights_pay', label: 'Դրամական բավարարում', icon: '💰' },
            { id: 'rights_lump', label: 'Մեկանգամյա վճարներ', icon: '🧾' },
            { id: 'rights_injury', label: 'Վնասվածքներ / ապահովագրություն', icon: '🩹' },
            { id: 'rights_zinapah', label: 'ԶԻՆԱՊԱՀ (1000+)', icon: '🛡' },
            { id: 'rights_service_status', label: 'Զինվորական ծառայության և զինծառայողի կարգավիճակի մասին', icon: '📜' },
            { id: 'rights_complaint', label: 'Բողոքարկում', icon: '⚖' },
            { id: 'rights_hotlines', label: 'Թեժ գծեր', icon: '📞' }
          ]
        }
      ]
    },
    { id: 'about', label: 'Ծրագրի մասին', icon: 'ℹ', children: [] }
  ];

  var GRANT_SECTIONS = [];
  (function flattenMenu(nodes, group) {
    (nodes || []).forEach(function (n) {
      GRANT_SECTIONS.push({ id: n.id, label: n.label, group: group || n.label, icon: n.icon || '▸' });
      if (n.children && n.children.length) flattenMenu(n.children, n.label);
    });
  })(GRANT_MENU);

  var GRANT_PARENTS = {
    /* KM_MENU15_V1: legacy reports grants still expand to moved leaves */
    reports: ['analytics', 'monthlyReport', 'monthSummary', 'monthCompare', 'substitutions', 'exportMonthGraphs', 'usb', 'docsPack'],
    accounting: ['people', 'positions', 'vacations', 'troopStructure', 'unitFormation', 'unitMedical', 'unitTermWatch', 'unitDossiers', 'unitLeavePlan', 'unitArchive', 'unitInventory', 'unitInventory:sub', 'unitInventory:sub:f26', 'unitInventory:sub:f28', 'unitInventory:sub:apranq_mutq', 'unitInventory:sub:apranq_elq', 'unitInventory:sub:receipt', 'unitInventory:sub:hamalr', 'unitInventory:svc', 'unitInventory:svc:f27', 'unitInventory:svc:f28', 'unitInventory:svc:apranq_mutq', 'unitInventory:svc:apranq_elq', 'unitInventory:svc:receipt', 'unitInventory:svc:hamalr', /* KM_INV_SCOPE_GRANTS_V1 */ 'unitHamalr', /* KM_HAMALR_MOVE_V1 */ 'unitReserve', 'orgCorps', 'people:card', 'people:attach', 'people:vacant', 'people:units', 'rankRules'],
    people: ['positions', 'unitDossiers', 'people:card', 'people:attach', 'people:vacant', 'people:units'],
    dutyTypes: ['schedule', 'workStatus', 'workload', 'dutyKiosk', 'analytics', 'monthlyReport', 'monthSummary', 'monthCompare', 'substitutions', 'exportMonthGraphs', 'unitBadDays', 'freePeople'], /* KM_MENU15_V1 */
    unitHamalr: ['unitInventory:sub:hamalr', 'unitInventory:svc:hamalr'], /* KM_HAMALR_MOVE_V1 */
    unitInventory: ['unitInventory:sub', 'unitInventory:sub:f26', 'unitInventory:sub:f28', 'unitInventory:sub:apranq_mutq', 'unitInventory:sub:apranq_elq', 'unitInventory:sub:receipt', 'unitInventory:sub:hamalr', 'unitInventory:svc', 'unitInventory:svc:f27', 'unitInventory:svc:f28', 'unitInventory:svc:apranq_mutq', 'unitInventory:svc:apranq_elq', 'unitInventory:svc:receipt', 'unitInventory:svc:hamalr'], /* KM_INV_SCOPE_GRANTS_V1 */
    'unitInventory:sub': ['unitInventory:sub:f26', 'unitInventory:sub:f28', 'unitInventory:sub:apranq_mutq', 'unitInventory:sub:apranq_elq', 'unitInventory:sub:receipt', 'unitInventory:sub:hamalr'],
    'unitInventory:svc': ['unitInventory:svc:f27', 'unitInventory:svc:f28', 'unitInventory:svc:apranq_mutq', 'unitInventory:svc:apranq_elq', 'unitInventory:svc:receipt', 'unitInventory:svc:hamalr'],
    library: ['lib:notes', 'lib:management', 'lib:spreadsheets' /* KM_MENU_REORG_V1 */, 'lib:files', 'lib:pdfTranslate', 'lib:original', 'lib:convert', 'lib:current', 'lib:hishoxutyun', 'lib:archive', 'lib:license', 'lib:reports', 'reports'],
    syssettings: ['network', 'sysinfo', 'lib:network', 'lib:sysinfo', 'lib:syssettings', 'settings', 'lib:license', 'license', 'fonts', 'lib:fonts'] /* KM_RIGHTS_V8 */, /* KM_MENU15_V1 */
    archiveHub: ['lib:hishoxutyun', 'lib:current', 'lib:archive', 'hishoxutyun', 'current', 'archive', 'soldierCards', 'sysinfo', 'lib:sysinfo'] /* KM_RIGHTS_V8 */, /* KM_ARCHIVE_HUB_V1 */
    unitTools: ['unitDocs', 'unitCharDrafts', 'unitFuel', 'unitDayPlans', 'unitBlanks', 'usb', 'docsPack', 'orderDraft', 'unitTrialLab', 'unitTrialExam', 'unitTrialChar', 'unitTrialMonitor', 'lib:notes', 'lib:management', 'lib:spreadsheets', 'lib:files', 'lib:pdfTranslate', 'lib:original', 'lib:convert'], /* KM_MENU15_V1 */
    notes: ['holidays', 'lib:notes', 'registrations'],
    unitTrialLab: ['unitTrialExam', 'unitTrialChar', 'unitTrialMonitor'],
    'lib:reports': ['analytics', 'monthlyReport', 'monthSummary', 'monthCompare', 'substitutions', 'exportMonthGraphs', 'usb', 'docsPack'], /* legacy */
    constitution_hub: ['constitution', 'electoral', 'admin_offenses', 'civil', 'land', 'water', 'family', 'labor', 'forest', 'subsoil', 'admin_proc', 'tax', 'eaeu', 'judicial', 'civil_proc', 'criminal', 'crim_proc', 'penitentiary'],
    statutes: ['statute_internal', 'statute_garrison', 'statute_discipline', 'statute_drill'],
    orders: ['orders_president', 'orders_pm', 'orders_mod', 'orders_cgs', 'orders_mp', 'orders_gdnd'],
    lawdocs: [
      'constitution_hub', 'constitution', 'electoral', 'admin_offenses', 'civil', 'land', 'water', 'family', 'labor', 'forest', 'subsoil', 'admin_proc', 'tax', 'eaeu', 'judicial', 'civil_proc', 'criminal', 'crim_proc', 'penitentiary',
      'statutes', 'statute_internal', 'statute_garrison', 'statute_discipline', 'statute_drill',
      'orders', 'orders_president', 'orders_pm', 'orders_mod', 'orders_cgs', 'orders_mp', 'orders_gdnd',
      'directives', 'military_acts', 'characteristic', 'encouragements', 'acts_discipline', 'acts_exam',
      'soldier_rights', 'rights_medical', 'rights_housing', 'rights_education', 'rights_transport', 'rights_leave', 'rights_military_service_law', 'rights_family_leave', 'rights_pay', 'rights_lump', 'rights_injury', 'rights_zinapah', 'rights_service_status', 'rights_complaint', 'rights_hotlines'
    ],
    soldier_rights: ['rights_medical', 'rights_housing', 'rights_education', 'rights_transport', 'rights_leave', 'rights_military_service_law', 'rights_family_leave', 'rights_pay', 'rights_lump', 'rights_injury', 'rights_zinapah', 'rights_service_status', 'rights_complaint', 'rights_hotlines'],
  };

  function esc(s) {
    return typeof window.esc === 'function'
      ? window.esc(s)
      : String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
          return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
        });
  }
  function toastMsg(m, t) {
    if (typeof toast === 'function') toast(m, t);
    else if (typeof window.kmNotify === 'function') window.kmNotify(m, t);
  }
  function isSuper() {
    return typeof window.kmIsSuperAdmin === 'function' && window.kmIsSuperAdmin();
  }
  function isAdmin() {
    return typeof window.kmCanAdmin === 'function' && window.kmCanAdmin();
  }
  function adminToken() {
    try { return localStorage.getItem('km_admin_token') || ''; } catch (e) { return ''; }
  }
  function usersApi() {
    return window.kmNative && window.kmNative.users;
  }

  function hyUsernameOk(s) {
    var t = String(s || '');
    try { t = t.normalize('NFC'); } catch (eN) {}
    t = t.trim().replace(/\s+/g, ' ');
    if (!t || t.length < 5 || t.length > 96) return false;
    return /^[\u0531-\u0556\u0561-\u0587]+(?:\s+[\u0531-\u0556\u0561-\u0587]+){1,2}$/.test(t);
  }
  function hyNamePartOk(s) {
    var t = String(s || '');
    try { t = t.normalize('NFC'); } catch (eN) {}
    t = t.trim();
    if (!t || t.length < 2 || t.length > 40) return false;
    return /^[\u0531-\u0556\u0561-\u0587]+$/.test(t);
  }
  function loginUsernameOk(s) {
    var t = String(s || '').trim();
    if (!t || /[^A-Za-z0-9]/.test(t)) return false;
    var letters = (t.match(/[A-Za-z]/g) || []).length;
    var digits = (t.match(/\d/g) || []).length;
    if (letters < 1 || letters > 10) return false;
    if (digits > 6) return false;
    return true;
  }
  function sanitizeHyNameLive(s) {
    var t = String(s || '');
    try { t = t.normalize('NFC'); } catch (eN) {}
    t = t.replace(/[^\u0531-\u0556\u0561-\u0587\s]/g, '').replace(/^\s+/, '').replace(/[ \t\u00A0]+/g, ' ');
    var parts = t.split(' ').filter(Boolean);
    if (parts.length > 3) t = parts.slice(0, 3).join(' ');
    return t;
  }
  function sanitizeHyWordLive(s) {
    var t = String(s || '');
    try { t = t.normalize('NFC'); } catch (eN) {}
    return t.replace(/[^\u0531-\u0556\u0561-\u0587]/g, '');
  }
  function sanitizeLatinUserLive(s) {
    var t = String(s || '');
    var letters = 0;
    var digits = 0;
    var out = '';
    for (var i = 0; i < t.length; i++) {
      var ch = t.charAt(i);
      if (/[A-Za-z]/.test(ch)) {
        if (letters >= 10) continue;
        letters += 1;
        out += ch;
      } else if (/\d/.test(ch)) {
        if (digits >= 6) continue;
        digits += 1;
        out += ch;
      }
    }
    return out;
  }
  function bindSanitizeInput(el, sanitizer) {
    if (!el || typeof sanitizer !== 'function') return;
    el.addEventListener('input', function () {
      var next = sanitizer(el.value);
      if (el.value !== next) el.value = next;
    });
  }
  function bindHyNameInput(el) {
    if (!el) return;
    el.setAttribute('lang', 'hy');
    bindSanitizeInput(el, sanitizeHyNameLive);
  }
  function bindHyWordInput(el) {
    if (!el) return;
    el.setAttribute('lang', 'hy');
    bindSanitizeInput(el, sanitizeHyWordLive);
  }
  function bindLatinUserInput(el) {
    if (!el) return;
    el.setAttribute('lang', 'en');
    el.setAttribute('spellcheck', 'false');
    bindSanitizeInput(el, sanitizeLatinUserLive);
  }

  function grantMenuCss() {
    return '' +
      '.kmGrantMenu{display:flex;flex-direction:column;gap:6px}' +
      '.kmGrantMenuItem{border:1px solid #d7e6ec;border-radius:12px;background:#fff;overflow:hidden}' +
      '.kmGrantMenuItem.is-open{border-color:#1a8fa0;box-shadow:0 4px 14px rgba(26,143,160,.12)}' +
      '.kmGrantMenuRow{display:flex;align-items:stretch;gap:0;min-height:48px}' +
      '.kmGrantMenuExpand{flex:1;display:flex;align-items:center;gap:8px;border:0;background:#f7fbfd;padding:10px 12px;cursor:pointer;text-align:left;font:inherit;color:#0d4a66;font-weight:700}' +
      '.kmGrantMenuExpand:hover{background:#eef6f9}' +
      '.kmGrantChevron{display:inline-block;width:14px;transition:transform .15s ease;color:#1a8fa0}' +
      '.kmGrantMenuItem.is-open > .kmGrantMenuRow > .kmGrantMenuExpand .kmGrantChevron{transform:rotate(90deg)}' +
      '.kmGrantMenuIcon{font-size:16px}' +
      '.kmGrantMenuLabel{flex:1;font-size:13px}' +
      '.kmGrantMenuPick{flex:0 0 auto!important;min-width:88px!important;min-height:48px!important;margin:0!important;border-radius:0!important;border:0!important;border-left:1px solid #d7e6ec!important;box-shadow:none!important;padding:8px 10px!important}' +
      '.kmGrantMenuPick .kmLawCardText{font-size:11px!important}' +
      '.kmGrantMenuChildren{display:flex;flex-direction:row;flex-wrap:wrap;align-items:stretch;gap:8px;padding:8px 8px 10px 12px;background:#fbfcfd;border-top:1px solid #e4ebe7}' +
      '.kmGrantMenuChildren[hidden]{display:none!important}' +
      '.kmGrantMenuChildren > .kmGrantLeaf{flex:1 1 168px;max-width:260px;min-width:140px;min-height:52px!important;padding:8px 10px!important;width:auto}' +
      '.kmGrantMenuChildren > .kmGrantMenuItem{flex:1 1 100%}' +
      '.kmGrantLeaf{min-height:52px!important;padding:8px 10px!important}' +
      '.kmGrantLeaf .kmLawCardText{font-size:12px!important}' +
      '.kmGrantMenuChildren .kmGrantMenuItem{border-style:dashed}' +
      '#content .kmLawsGrid .kmGrantCard.is-selected,#content .kmGrantCard.is-selected,.kmGrantCard.is-selected{box-shadow:0 8px 20px rgba(26,143,160,.22),inset 0 0 0 2px #1a8fa0!important;background:#f0fafb!important}' +
      '#content .kmLawsGrid .kmGrantCard.is-selected:hover,#content .kmGrantCard.is-selected:hover,.kmGrantCard.is-selected:hover{box-shadow:0 8px 20px rgba(26,143,160,.22),inset 0 0 0 2px #1a8fa0!important;background:#f0fafb!important}' +
      '#content .kmLawsGrid .kmGrantCard.is-selected .kmLawCardText,.kmGrantCard.is-selected .kmLawCardText{color:#0a6a7a!important}';
  }

  function toggleGrantMenu(btn) {
    if (!btn) return;
    var item = btn.closest('.kmGrantMenuItem');
    if (!item) return;
    var open = !item.classList.contains('is-open');
    item.classList.toggle('is-open', open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    var kids = null;
    var ch = item.children;
    for (var i = 0; i < ch.length; i++) {
      if (ch[i].classList && ch[i].classList.contains('kmGrantMenuChildren')) { kids = ch[i]; break; }
    }
    if (kids) {
      if (open) kids.removeAttribute('hidden');
      else kids.setAttribute('hidden', 'hidden');
    }
  }

  function sectionChecksHtml(selected, prefix) {
    selected = expandGrantSelection(selected || []);
    var set = Object.create(null);
    selected.forEach(function (id) { set[String(id)] = 1; });
    var pref = esc(prefix || 'g');

    function renderNode(node, depth) {
      if (node.superAdminOnly && !isSuper()) return '';
      if (node.adminOnly && String(prefix || '').indexOf('usr') === 0) return '';
      depth = depth || 0;
      var kids = (node.children || []).filter(function (ch) {
        if (ch.superAdminOnly && !isSuper()) return false;
        if (ch.adminOnly && String(prefix || '').indexOf('usr') === 0) return false;
        return true;
      });
      var hasKids = kids.length > 0;
      var on = !!set[node.id];
      /* Ենթաբաժինները սկզբում փակ են բացել/փակել կոճակով */
      var open = false;
      var html = '';
      if (hasKids) {
        html +=
          '<div class="kmGrantMenuItem' + (open ? ' is-open' : '') + '" data-km-grant-menu="' + esc(node.id) + '">' +
          '<div class="kmGrantMenuRow">' +
          '<button type="button" class="kmGrantMenuExpand" title="Բացել/փակել ենթաբաժինները" aria-expanded="' + (open ? 'true' : 'false') + '">' +
          '<span class="kmGrantChevron" aria-hidden="true">▸</span>' +
          '<span class="kmGrantMenuIcon" aria-hidden="true">' + (node.icon || '▸') + '</span>' +
          '<span class="kmGrantMenuLabel">' + esc(node.label) + '</span>' +
          '</button>' +
          '<button type="button" class="kmLawCard kmGrantCard kmGrantMenuPick' + (on ? ' is-selected' : '') + '"' +
          ' data-km-grant="' + pref + '" data-value="' + esc(node.id) + '"' +
          ' aria-pressed="' + (on ? 'true' : 'false') + '" title="Ընտրել ամբողջ բաժինը">' +
          '<span class="kmLawCardText">' + (on ? '✓ Ամբողջը' : 'Ամբողջը') + '</span></button>' +
          '</div>' +
          '<div class="kmGrantMenuChildren"' + (open ? '' : ' hidden') + '>' +
          kids.map(function (ch) { return renderNode(ch, depth + 1); }).join('') +
          '</div></div>';
      } else {
        html +=
          '<button type="button" class="kmLawCard kmGrantCard kmGrantLeaf' + (on ? ' is-selected' : '') + '"' +
          ' data-km-grant="' + pref + '" data-value="' + esc(node.id) + '"' +
          ' aria-pressed="' + (on ? 'true' : 'false') + '" title="Սեղմեք՝ ընտրել / հանել">' +
          '<span class="kmLawCardText">' + esc(node.label) + '</span>' +
          '<span class="kmLawCardIcon" aria-hidden="true">' + (node.icon || '▸') + '</span></button>';
      }
      return html;
    }
    return '<div class="kmGrantMenu" data-km-grant-prefix="' + pref + '">' +
      GRANT_MENU.map(function (n) { return renderNode(n, 0); }).join('') +
      '</div>';
  }


  /* KM_RBAC_ADMIN_DUAL_V1 — the same real program tree for Admin view/edit. */
  /* ===== KM_PERM_MATRIX_V1 =====
     One compact permission tree instead of two duplicated card trees.
     Every row = one section/sub-section/field/button with a 3-way choice: Չկա | Դիտել | Փոփոխել.
     Storage contract is unchanged: checked inputs carry data-km-grant="<prefix>View|<prefix>Edit" + value=<id>,
     so readChecked() and every save routine keep working. A node is never in both lists (edit wins). */
  function pmCss() {
    return '' +
      '.kmPm{border:1px solid #d7e6ec;border-radius:14px;background:#fff;overflow:hidden}' +
      '.kmPmBar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:10px 12px;background:#f7fbfd;border-bottom:1px solid #e4ebe7;position:sticky;top:0;z-index:2}' +
      '.kmPmBar input[type=search]{flex:1 1 200px;min-width:160px;padding:7px 10px;border:1px solid #c9d8df;border-radius:8px;font:inherit;font-size:13px}' +
      '.kmPmBar button{padding:6px 10px;border:1px solid #c9d8df;border-radius:8px;background:#fff;color:#0d4a66;font:inherit;font-size:12px;cursor:pointer}' +
      '.kmPmBar button:hover{background:#eef6f9}' +
      '.kmPmCount{margin-left:auto;font-size:12px;color:#5a6b78}' +
      '.kmPmHead,.kmPmRow{display:flex;align-items:center;gap:8px;padding:0 12px;min-height:38px}' +
      '.kmPmHead{font-size:11px;font-weight:800;color:#5a6b78;text-transform:uppercase;letter-spacing:.03em;background:#fbfcfd;border-bottom:1px solid #e4ebe7}' +
      '.kmPmHead span:first-child,.kmPmName{flex:1;min-width:0}' +
      '.kmPmSegHead{display:flex;gap:2px}' +
      '.kmPmSegHead span{width:74px;text-align:center}' +
      '.kmPmList{max-height:min(62vh,640px);overflow:auto;contain:content}' +
      '.kmPmRow{border-bottom:1px solid #eef2f4}' +
      '.kmPmRow:hover{background:#f6fafc}' +
      '.kmPmRow.is-group{background:#f7fbfd;font-weight:700}' +
      '.kmPmRow.is-hit{background:#fff8dc}' +
      '.kmPmToggle{flex:0 0 22px;height:22px;border:0;background:transparent;color:#1a8fa0;cursor:pointer;padding:0;font-size:12px;line-height:1}' +
      '.kmPmToggle::before{content:"\\25B8";display:inline-block;transition:transform .12s ease}' +
      '.kmPmGroup.is-open > .kmPmRow > .kmPmToggle::before{transform:rotate(90deg)}' +
      '.kmPmSpacer{flex:0 0 22px}' +
      '.kmPmName{font-size:13px;color:#0d4a66;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.kmPmIcon{margin-right:6px}' +
      '.kmPmKids{border-left:2px solid #e1edf2;margin-left:18px}' +
      '.kmPmKids[hidden]{display:none!important}' +
      '.kmPmSeg{display:flex;gap:2px;flex:0 0 auto}' +
      '.kmPmSeg label{position:relative;width:74px;text-align:center;font-size:11.5px;padding:5px 0;border:1px solid #d0dde3;border-radius:7px;background:#fff;color:#5a6b78;cursor:pointer;user-select:none}' +
      '.kmPmSeg input{position:absolute;opacity:0;inset:0;width:100%;height:100%;margin:0;cursor:pointer}' +
      '.kmPmSeg label.is-on{color:#fff;font-weight:700}' +
      '.kmPmSeg label.k-none.is-on{background:#8a99a3;border-color:#8a99a3}' +
      '.kmPmSeg label.k-view.is-on{background:#2f7fb0;border-color:#2f7fb0}' +
      '.kmPmSeg label.k-edit.is-on{background:#1a8f5a;border-color:#1a8f5a}' +
      '.kmPmSeg label:focus-within{outline:2px solid #1a8fa0;outline-offset:1px}' +
      '.kmPmRow.is-mixed .kmPmSeg label.is-on{background:#fff;color:#5a6b78;font-weight:400}' +
      '.kmPmRow.is-mixed .kmPmName::after{content:" \\2022 \\0574\\056B\\0561\\057D\\0576\\0561\\056F\\0561\\0576";font-weight:400;font-size:11px;color:#b07a00}' +
      '.kmPm [hidden]{display:none!important}' +
      '@media (max-width:720px){.kmPmSeg label,.kmPmSegHead span{width:58px;font-size:11px}.kmPmHead,.kmPmRow{gap:4px;padding:0 8px}.kmPmKids{margin-left:10px}}' +
      'body.km-dark .kmPm{background:#16222a;border-color:#2c4250}' +
      'body.km-dark .kmPmBar,body.km-dark .kmPmHead,body.km-dark .kmPmRow.is-group{background:#1b2a33;border-color:#2c4250}' +
      'body.km-dark .kmPmRow{border-color:#25363f}body.km-dark .kmPmRow:hover{background:#1e303a}' +
      'body.km-dark .kmPmName,body.km-dark .kmPmBar button{color:#d6e7ee}' +
      'body.km-dark .kmPmBar input[type=search],body.km-dark .kmPmBar button,body.km-dark .kmPmSeg label{background:#16222a;border-color:#35505f;color:#b9ccd6}' +
      'body.km-dark .kmPmSeg label.is-on{color:#fff}body.km-dark .kmPmRow.is-hit{background:#3a3418}';
  }

  function permMatrixHtml(viewSec, editSec, prefix) {
    prefix = prefix || 'adm';
    var viewSet = Object.create(null), editSet = Object.create(null);
    (viewSec || []).forEach(function (id) { viewSet[String(id)] = 1; });
    (editSec || []).forEach(function (id) { editSet[String(id)] = 1; });
    var pref = esc(prefix);
    var rowSeq = 0;
    var isUsr = String(prefix).indexOf('usr') === 0;
    function visible(n) {
      if (n.superAdminOnly && !isSuper()) return false;
      if (n.adminOnly && isUsr) return false;
      return true;
    }
    function level(id) { return editSet[id] ? 'edit' : (viewSet[id] ? 'view' : 'none'); }
    function seg(id) {
      var lv = level(id), nm = pref + '::' + (++rowSeq);
      function opt(kind, txt) {
        var on = lv === kind;
        var attrs = kind === 'view' ? ' data-km-grant="' + pref + 'View"' : (kind === 'edit' ? ' data-km-grant="' + pref + 'Edit"' : '');
        return '<label class="k-' + kind + (on ? ' is-on' : '') + '"><input type="radio" name="' + nm + '" value="' + esc(id) + '"' + attrs +
          ' data-pm-level="' + kind + '"' + (on ? ' checked' : '') + '>' + txt + '</label>';
      }
      return '<div class="kmPmSeg" role="radiogroup">' + opt('none', '\u0549\u056F\u0561') + opt('view', '\u0534\u056B\u057F\u0565\u056C') + opt('edit', '\u0553\u0578\u0583\u0578\u056D\u0565\u056C') + '</div>';
    }
    function row(n, isGroup) {
      return '<div class="kmPmRow' + (isGroup ? ' is-group' : '') + '" data-pm-id="' + esc(n.id) + '" data-pm-label="' + esc(String(n.label || '').toLowerCase()) + '">' +
        (isGroup ? '<button type="button" class="kmPmToggle" aria-label="+/-"></button>' : '<span class="kmPmSpacer"></span>') +
        '<span class="kmPmName" title="' + esc(n.label) + '"><span class="kmPmIcon" aria-hidden="true">' + (n.icon || '') + '</span>' + esc(n.label) + '</span>' +
        seg(n.id) + '</div>';
    }
    function node(n) {
      if (!visible(n)) return '';
      var kids = (n.children || []).filter(visible);
      if (!kids.length) return row(n, false);
      return '<div class="kmPmGroup" data-pm-group="' + esc(n.id) + '">' + row(n, true) +
        '<div class="kmPmKids" hidden>' + kids.map(node).join('') + '</div></div>';
    }
    return '<div class="kmPm" data-km-pm="' + pref + '">' +
      '<div class="kmPmBar">' +
      '<input type="search" class="kmPmSearch" placeholder="\u0555\u0580\u0578\u0576\u0565\u056C \u0562\u0561\u056A\u056B\u0576, \u0564\u0561\u0577\u057F, \u056F\u0578\u0573\u0561\u056F\u2026" autocomplete="off">' +
      '<button type="button" class="kmPmAll" data-pm-set="view">\u0532\u0578\u056C\u0578\u0580\u0568\u2014 \u0534\u056B\u057F\u0565\u056C</button>' +
      '<button type="button" class="kmPmAll" data-pm-set="edit">\u0532\u0578\u056C\u0578\u0580\u0568\u2014 \u0553\u0578\u0583\u0578\u056D\u0565\u056C</button>' +
      '<button type="button" class="kmPmAll" data-pm-set="none">\u0544\u0561\u0584\u0580\u0565\u056C</button>' +
      '<button type="button" class="kmPmFold" data-pm-fold="1">\u0553\u0561\u056F\u0565\u056C \u0562\u0578\u056C\u0578\u0580\u0568</button>' +
      '<span class="kmPmCount">\u0534\u056B\u057F\u0565\u056C <b class="kmPmCountView">0</b> \u00B7 \u0553\u0578\u0583\u0578\u056D\u0565\u056C <b class="kmPmCountEdit">0</b></span></div>' +
      '<div class="kmPmHead"><span>\u0532\u0561\u056A\u056B\u0576 / \u0535\u0576\u0569\u0561\u0562\u0561\u056A\u056B\u0576 / \u0534\u0561\u0577\u057F / \u053F\u0578\u0573\u0561\u056F</span>' +
      '<div class="kmPmSegHead"><span>\u0549\u056F\u0561</span><span>\u0534\u056B\u057F\u0565\u056C</span><span>\u0553\u0578\u0583\u0578\u056D\u0565\u056C</span></div></div>' +
      '<div class="kmPmList">' + GRANT_MENU.map(node).join('') + '</div>' +
      '<style>' + pmCss() + '</style></div>';
  }

  function wirePermMatrix(root, prefix) {
    if (!root) return;
    prefix = prefix || 'adm';
    var host = root.querySelector('.kmPm[data-km-pm="' + prefix + '"]') || root.querySelector('.kmPm');
    if (!host || host.__kmPmWired) return;
    host.__kmPmWired = true;
    var pv = prefix + 'View', pe = prefix + 'Edit';

    function radios(scope) { return scope.querySelectorAll('input[type=radio][data-pm-level]'); }
    function setRowLevel(rowEl, lv) {
      var inputs = rowEl.querySelectorAll('.kmPmSeg input');
      inputs.forEach(function (inp) {
        var on = inp.getAttribute('data-pm-level') === lv;
        inp.checked = on;
        inp.parentNode.classList.toggle('is-on', on);
      });
      rowEl.classList.remove('is-mixed');
    }
    function count() {
      var a = host.querySelector('.kmPmCountView'), b = host.querySelector('.kmPmCountEdit');
      if (a) a.textContent = String(readChecked(host, pv).length);
      if (b) b.textContent = String(readChecked(host, pe).length);
    }
    host.addEventListener('change', function (ev) {
      var inp = ev.target;
      if (!inp || inp.type !== 'radio' || !inp.hasAttribute('data-pm-level')) return;
      var rowEl = inp.closest('.kmPmRow');
      if (!rowEl) return;
      // KM_PERM_SINGLE_ROW_V2: only explicit bulk buttons affect other rows.
      setRowLevel(rowEl, inp.getAttribute('data-pm-level'));
      count();
    });
    host.addEventListener('click', function (ev) {
      var t = ev.target;
      var tg = t.closest ? t.closest('.kmPmToggle') : null;
      if (tg) {
        ev.preventDefault();
        var g = tg.closest('.kmPmGroup');
        var open = !g.classList.contains('is-open');
        g.classList.toggle('is-open', open);
        var k = g.querySelector(':scope > .kmPmKids');
        if (k) { if (open) k.removeAttribute('hidden'); else k.setAttribute('hidden', 'hidden'); }
        return;
      }
      var all = t.closest ? t.closest('.kmPmAll') : null;
      if (all) {
        ev.preventDefault();
        var lv = all.getAttribute('data-pm-set');
        host.querySelectorAll('.kmPmRow').forEach(function (r) { setRowLevel(r, lv); });
        count();
        return;
      }
      var fold = t.closest ? t.closest('.kmPmFold') : null;
      if (fold) {
        ev.preventDefault();
        host.querySelectorAll('.kmPmGroup.is-open').forEach(function (g) {
          g.classList.remove('is-open');
          var k = g.querySelector(':scope > .kmPmKids'); if (k) k.setAttribute('hidden', 'hidden');
        });
      }
    });
    var timer = null;
    var search = host.querySelector('.kmPmSearch');
    if (search) search.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        var q = String(search.value || '').trim().toLowerCase();
        host.querySelectorAll('.kmPmRow.is-hit').forEach(function (r) { r.classList.remove('is-hit'); });
        if (!q) return;
        var firstHit = null;
        host.querySelectorAll('.kmPmRow').forEach(function (r) {
          if ((r.getAttribute('data-pm-label') || '').indexOf(q) < 0) return;
          r.classList.add('is-hit');
          if (!firstHit) firstHit = r;
          var g = r.parentElement ? r.parentElement.closest('.kmPmGroup') : null;
          while (g) {
            g.classList.add('is-open');
            var k = g.querySelector(':scope > .kmPmKids'); if (k) k.removeAttribute('hidden');
            g = g.parentElement ? g.parentElement.closest('.kmPmGroup') : null;
          }
        });
        if (firstHit && firstHit.scrollIntoView) firstHit.scrollIntoView({ block: 'nearest' });
      }, 160);
    });
    count();
  }

  function adminDualHtml(viewSec, editSec, prefix) {
    viewSec = Array.isArray(viewSec) ? viewSec : [];
    editSec = Array.isArray(editSec) ? editSec : [];
    prefix = prefix || 'adm';
    return '<div class="kmAdminAccessIntro"><b>Իրավունքների մատրիցա</b> — ծրագրի իրական բաժինները և ենթաբաժինները։ Ընտրությունը փոխում է միայն տվյալ տողը։ «Բոլորը» կոճակները փոխում են բոլոր տողերը։ Միևնույն տարրը կարող է լինել միայն մեկ ռեժիմում։ «Փոփոխություններ կատարել»-ը ներառում է նաև դիտում։</div>' +
      permMatrixHtml(viewSec, editSec, prefix);
  }

  function wireAdminDualGrants(root, prefix) {
    wirePermMatrix(root, prefix || 'adm');
  }

  function readChecked(root, prefix) {
    var out = [];
    if (!root) return out;
    root.querySelectorAll('button.kmGrantCard[data-km-grant="' + prefix + '"].is-selected').forEach(function (el) {
      var v = el.getAttribute('data-value');
      if (v) out.push(v);
    });
    /* հին checkbox fallback */
    root.querySelectorAll('input[data-km-grant="' + prefix + '"]:checked').forEach(function (el) {
      if (el.value) out.push(el.value);
    });
    return out;
  }

  
  /* KM_ARCHIVE_ORG_GRANT_UI_V1 / KM_SYSTEM_WIDE_V1 */
  function collectArchiveOrgIds(kind) {
    var root = document.getElementById('kmArchiveOrgGrantBox');
    if (!root) return [];
    var out = [];
    root.querySelectorAll('input[data-km-arch-' + kind + ']:checked').forEach(function (el) {
      var v = String(el.value || '').trim();
      if (v) out.push(v);
    });
    return out;
  }
  function kmArchiveOrgGrantHtml(usr) {
    usr = usr || {};
    var corpsIds = usr.archiveCorpsIds || [];
    var unitIds = usr.archiveUnitIds || [];
    var corps = [];
    try { corps = (typeof window.kmListOrgCorps === 'function' ? window.kmListOrgCorps() : []) || []; } catch (e0) { corps = []; }
    var corpsHtml = (corps || []).map(function (c) {
      if (!c || !c.id) return '';
      var on = corpsIds.map(String).indexOf(String(c.id)) >= 0;
      return '<label style="display:inline-flex;gap:6px;margin:4px 8px 4px 0"><input type="checkbox" data-km-arch-corps value="' + String(c.id).replace(/"/g,'') + '"' + (on?' checked':'') + '> ' + String(c.name || c.id) + '</label>';
    }).join('');
    var unitsHtml = '';
    (corps || []).forEach(function (c) {
      if (!c || !c.id) return;
      var units = [];
      try { units = (typeof window.kmListOrgUnits === 'function' ? window.kmListOrgUnits(c.id) : (c.units || [])) || []; } catch (e1) { units = c.units || []; }
      (units || []).forEach(function (u) {
        if (!u || !u.id) return;
        var on = unitIds.map(String).indexOf(String(u.id)) >= 0;
        unitsHtml += '<label style="display:inline-flex;gap:6px;margin:4px 8px 4px 0"><input type="checkbox" data-km-arch-unit value="' + String(u.id).replace(/"/g,'') + '"' + (on?' checked':'') + '> ' + String(u.name || u.id) + '</label>';
      });
    });
    return '<div id="kmArchiveOrgGrantBox" style="margin-top:10px;padding:10px;border-radius:10px;background:#f7faf8;border:1px solid #d5e3dc">' +
      '<div style="font-weight:700;margin-bottom:6px">Արխիվի իրավունք · կորպուս / զորամաս</div>' +
      '<div class="muted" style="font-size:12px;margin-bottom:8px">Թույլատրեք կոնկրետ բանակային կորպուսներ և զորամասեր</div>' +
      '<div style="margin-bottom:8px"><b>Կորպուս</b><div>' + (corpsHtml || '<span class="muted">—</span>') + '</div></div>' +
      '<div><b>Զորամաս</b><div>' + (unitsHtml || '<span class="muted">—</span>') + '</div></div></div>';
  }
  window.kmArchiveOrgGrantHtml = kmArchiveOrgGrantHtml;

function setGrantSelected(btn, on) {
    if (!btn) return;
    btn.classList.toggle('is-selected', !!on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    if (btn.classList.contains('kmGrantMenuPick')) {
      var t = btn.querySelector('.kmLawCardText');
      if (t) t.textContent = on ? '✓ Ամբողջը' : 'Ամբողջը';
    }
  }

  /** Ծնող «Ամբողջը» → բոլոր ենթաբաժինների քարտերը */
  function setGrantSubtree(pickBtn, on) {
    if (!pickBtn) return [];
    var prefix = pickBtn.getAttribute('data-km-grant') || '';
    var item = pickBtn.closest('.kmGrantMenuItem');
    var touched = [];
    setGrantSelected(pickBtn, on);
    var pv = pickBtn.getAttribute('data-value');
    if (pv) touched.push(pv);
    if (item) {
      if (on) {
        item.classList.add('is-open');
        var kidsWrap = item.querySelector(':scope > .kmGrantMenuChildren');
        if (kidsWrap) kidsWrap.removeAttribute('hidden');
      }
      item.querySelectorAll('button.kmGrantCard[data-km-grant="' + prefix + '"]').forEach(function (el) {
        if (el === pickBtn) return;
        setGrantSelected(el, on);
        var v = el.getAttribute('data-value');
        if (v) touched.push(v);
      });
    }
    return touched;
  }

  /** Ենթաբաժին փոխելուց հետո ծնող «Ամբողջը»-ի վիճակը համաժամեցնել */
  function syncGrantParents(fromBtn) {
    if (!fromBtn) return;
    var prefix = fromBtn.getAttribute('data-km-grant') || '';
    var node = fromBtn.closest('.kmGrantMenuItem');
    while (node) {
      var pick = node.querySelector(':scope > .kmGrantMenuRow > button.kmGrantMenuPick[data-km-grant="' + prefix + '"]');
      var kids = node.querySelector(':scope > .kmGrantMenuChildren');
      if (pick && kids) {
        var cards = kids.querySelectorAll('button.kmGrantCard[data-km-grant="' + prefix + '"]');
        var allOn = cards.length > 0;
        for (var i = 0; i < cards.length; i++) {
          if (!cards[i].classList.contains('is-selected')) { allOn = false; break; }
        }
        setGrantSelected(pick, allOn);
      }
      var parentKids = node.parentElement && node.parentElement.closest
        ? node.parentElement.closest('.kmGrantMenuChildren')
        : null;
      node = parentKids ? parentKids.closest('.kmGrantMenuItem') : null;
    }
  }

  /** Եթե պահված է ծնող id՝ UI-ում նշել նաև երեխաներին */
  function expandGrantSelection(selected) {
    var set = Object.create(null);
    var queue = (selected || []).map(String);
    while (queue.length) {
      var id = queue.pop();
      if (!id || set[id]) continue;
      set[id] = 1;
      var kids = GRANT_PARENTS[id] || [];
      for (var i = 0; i < kids.length; i++) queue.push(String(kids[i]));
    }
    return Object.keys(set);
  }

  async function loadStore() {
    var api = usersApi();
    if (!api || !api.list) {
      return { ok: false, error: 'Users API բացակայում է', admins: [], users: [], superAdminUsername: SUPER_ADMIN };
    }
    try {
      var r = await api.list({ adminToken: adminToken() });
      if (!r || typeof r !== 'object') {
        return { ok: false, error: 'Դատարկ պատասխան', admins: [], users: [], superAdminUsername: SUPER_ADMIN };
      }
      return r;
    } catch (e) {
      return {
        ok: false,
        error: (e && e.message) || 'Օգտատերերի ցուցակի սխալ',
        admins: [],
        users: [],
        superAdminUsername: SUPER_ADMIN
      };
    }
  }

  /* ===== KM_UI_GRANTS_V1 =====
     Sub-section / field / button level permissions (view | edit) for «Հաշվառում».
     One declarative table drives BOTH the admin tree (labels) and the runtime guard (selectors, in km-v3-core.js).
     A stored parent grant (people, people:card, accounting, unitFormation ...) still expands to every new child,
     so nobody loses access they already had. Settings («Համակարգի կարգավորումներ») is intentionally not part of this. */
  (function extendGrantTreeWithUiNodes() {
    function leaf(id, label, icon, level, sel) { return { id: id, label: label, icon: icon, level: level, sel: sel }; }
    function fld(key, label, icon, sel) { return leaf('people:card:f:' + key, label, icon, 'field', sel); }
    function btn(id, label, icon, level, sel) { return leaf(id, label, icon, level, sel); }
    function grp(id, label, icon, children, level, sel) { var g = { id: id, label: label, icon: icon, children: children }; if (level) { g.level = level; g.sel = sel; } return g; }
    function nfld(id, label, icon, sel) { return leaf(id, label, icon, 'field', sel); }
    var B = 'button[onclick=';
    var PEOPLE_EXTRA = ['positions', 'unitDossiers'];
    var ATTACH = [
      { to: 'people', extra: PEOPLE_EXTRA, node: { id: 'people:person', label: 'Անձնակազմ (ներդիր)', icon: '👤', children: [
        btn('people:person:add', 'Ավելացնել', '➕', 'edit', 'button[onclick="addPerson()"]'),
        btn('people:person:remove', 'Հեռացնել', '➖', 'edit', 'button[onclick="removePerson()"]'),
        btn('people:person:csv', 'CSV', '📄', 'view', 'button[onclick="exportPeopleCSV()"]')
      ] } },
      { to: 'people', extra: PEOPLE_EXTRA, node: { id: 'people:pos', label: 'Պաշտոն (կոճակներ)', icon: '🎖', children: [
        btn('people:pos:add', 'Ավելացնել պաշտոն', '➕', 'edit', '[data-km-pos="add"]'),
        btn('people:pos:refresh', 'Թարմացնել (F5)', '🔄', 'view', '[data-km-pos="refresh"]'),
        btn('people:pos:clear', 'Մաքրել ցուցակը', '🧹', 'edit', '[data-km-pos="resetShtat"]')
      ] } },
      { to: 'people:card', extra: PEOPLE_EXTRA, node: { id: 'people:card:fields', label: 'Տվյալներ / Դաշտեր', icon: '📋', children: [
        fld('photo', 'Տեղադրել լուսանկար', '🖼', '#kmPersonCardPhoto'),
        fld('unit', 'Ստորաբաժանում', '🏢', '#kmPcArchUnit'),
        fld('post', 'Պաշտոն', '🎖', '#kmPcArchPost'),
        fld('seq', 'Հ/Հ', '🔢', '#kmPcArchSeq'),
        fld('secret', 'Գաղտնիության կարգ', '🔒', '#kmPcArchSecret'),
        fld('vus', 'ԶՀՄ (ВУС)', '🎖', '#kmPcArchVus'),
        fld('code', 'Կոդ', '🏷', '#kmPcArchCode'),
        fld('rankslot', 'Կոչումը ըստ հաստիքի', '⭐', '#kmPcArchRankSlot'),
        fld('rank', 'Կոչում', '⭐', '#kmPcArchRank'),
        fld('birth', 'Ծննդյան թիվ', '🎂', '#kmPcArchBirth'),
        fld('vacation', 'Արձակուրդ', '🏖', '#kmPcArchVacation'),
        fld('contract', 'Պայմանագիր (արխիվ)', '📜', '#kmPcArchContract'),
        fld('zk', 'ԶԿ (ՏՍ)', '🏢', '#kmPcArchZk'),
        fld('phone', 'Բջջային հեռախոսահամար', '📱', '#kmPcPhone'),
        fld('edu', 'Կրթություն', '🎓', '#kmPcEduNew,#kmPcEduAdd'),
        fld('family', 'Ընտանեկան դրություն', '👨‍👩‍👧‍👦', '#kmPcFamily'),
        fld('cstart', 'Պայմանագրի սկիզբ', '📅', '#kmPcContractStart'),
        fld('cterm', 'Վերջին պայմանագրի կնքման ժամկետ', '📅', '#kmPcContractTerm'),
        fld('cend', 'Պայմանագրի ավարտ', '📅', '#kmPcContractEnd'),
        fld('region', 'Մարզ', '🗺', '#kmPcRegion'),
        fld('city', 'Քաղաք / համայնք', '🏙', '#kmPcCity'),
        fld('secrecy', 'Գաղտնիության թույլատվություն', '🔑', '#kmPcSecrecy'),
        fld('idcard', 'Անձնական վկայական (համար)', '🪪', '#kmPcIdCard'),
        fld('hsk', 'ՀԾՀ', '🆔', '#kmPcHsk'),
        fld('address', 'Հասցե', '🏠', '#kmPcAddress'),
        fld('commissariat', 'Զինվորական կոմիսարյատ', '🏛', '#kmPcCommissariat'),
        fld('blood', 'Արյան խումբ', '🩸', '#kmPcBlood'),
        fld('illnesses', 'Ուղեկցվող հիվանդություններ', '🩺', '#kmPcIllnesses'),
        fld('articles', 'Հոդվածներ (404-Ն կարգով)', '📜', '#kmPcArtNum,#kmPcArtPoint,#kmPcArtAdd')
      ] } },
      { to: 'people:card', extra: PEOPLE_EXTRA, node: { id: 'people:card:subs', label: 'Ենթաբաժիններ', icon: '📁', children: [
        btn('people:card:sub:disc', 'Տույժերի բաժին', '⚠️', 'view', '#kmPcOpenDisc'),
        btn('people:card:sub:enc', 'Խրախուսանքներ', '🎖', 'view', '#kmPcOpenEnc'),
        btn('people:card:sub:char', 'Բնութագիր', '📝', 'view', '#kmPcOpenChar'),
        btn('people:card:sub:med', 'Բուժկետ', '🩺', 'view', '#kmPcOpenMed'),
        btn('people:card:sub:hish', 'Հիշողություն', '🕘', 'view', '#kmPersonCardHish'),
        btn('people:card:sub:hist', 'Հերթապահության պատմություն', '🛡', 'view', '#kmPersonCardHist'),
        btn('people:card:sub:vac', 'Արձակուրդներ', '🏖', 'view', '#kmPersonCardVac')
      ] } },
      { to: 'people:card', extra: PEOPLE_EXTRA, node: { id: 'people:card:btns', label: 'Կոճակներ', icon: '🔘', children: [
        btn('people:card:btn:save', 'Պահպանել', '💾', 'edit', '#kmPersonCardSave'),
        btn('people:card:btn:promote', 'Պաշտոնի բարձրացում', '📈', 'edit', '#kmPersonCardPromote'),
        btn('people:card:btn:print', 'Տպել', '🖨', 'view', '#kmPersonCardPrint'),
        btn('people:card:btn:pdf', 'PDF', '📄', 'view', '#kmPersonCardPdf')
      ] } },
      { to: 'troopStructure', extra: [], node: { id: 'troopStructure:btns', label: 'Կոճակներ / Ֆունկցիաներ', icon: '🔘', children: [
        btn('troopStructure:btn:export', 'Արտահանել', '📤', 'view', 'button[onclick*="kmTroopExportXlsx"]'),
        btn('troopStructure:btn:save', 'Պահպանել', '💾', 'edit', 'button[onclick*="kmTroopSave("]')
      ] } },
      { to: 'unitFormation', extra: [], node: { id: 'unitFormation:btns', label: 'Կոճակներ', icon: '🔘', children: [
        btn('unitFormation:btn:add', 'Ավելացնել', '➕', 'edit', 'button[onclick*="kmUnitFormAddRow"]'),
        btn('unitFormation:btn:removeAll', 'Հեռացնել բոլորը', '🗑', 'edit', 'button[onclick*="kmUnitFormRemoveAll"]'),
        btn('unitFormation:btn:save', 'Պահպանել', '💾', 'edit', 'button[onclick*="kmUnitFormSave"]'),
        btn('unitFormation:btn:print', 'Տպել', '🖨', 'view', 'button[onclick*="kmUnitFormPrint"]')
      ] } },
      { to: 'unitMedical', extra: [], node: { id: 'unitMedical:btns', label: 'Կոճակներ', icon: '🔘', children: [
        btn('unitMedical:btn:add', 'Ավելացնել', '➕', 'edit', 'button[onclick*="kmUnitMedSave"],button[onclick*="kmUnitMedDel("]'),
        btn('unitMedical:btn:print', 'Տպել ցուցակ', '🖨', 'view', 'button[onclick*="kmUnitMedPrint"]')
      ] } },
      { to: 'unitTermWatch', extra: [], node: { id: 'unitTermWatch:btns', label: 'Կոճակներ', icon: '🔘', children: [
        btn('unitTermWatch:btn:save', 'Պահպանել / ավելացնել', '➕', 'edit', 'button[onclick*="kmUnitTermSave"],button[onclick*="kmUnitTermDel("]'),
        btn('unitTermWatch:btn:compare', 'Համեմատել Արխիվից', '🔄', 'edit', 'button[onclick*="kmUnitTermResync"]')
      ] } },
      { to: 'unitLeavePlan', extra: [], node: { id: 'unitLeavePlan:btns', label: 'Կոճակներ', icon: '🔘', children: [
        btn('unitLeavePlan:btn:add', 'Ավելացնել պլան', '➕', 'edit', 'button[onclick*="kmUnitLeaveSave"],button[onclick*="kmUnitLeaveDel("]')
      ] } },
      /* ---- KM_UI_GRANTS_V2: remaining items of the scheme ---- */
      { to: 'people:card:btns', extra: PEOPLE_EXTRA, node: btn('people:card:btn:scan', 'Սկանավորել և ավելացնել', '🖨️', 'edit', '#kmPcArchiveScan') },
      { to: 'unitMedical', extra: [], node: grp('unitMedical:fields', 'Տվյալներ / Դաշտեր', '📋', [
        nfld('unitMedical:f:kind', 'Տեսակ', '🏷', '#kmUtMedKind'), nfld('unitMedical:f:from', 'Սկիզբ', '📅', '#kmUtMedFrom'),
        nfld('unitMedical:f:to', 'Ավարտ', '📅', '#kmUtMedTo'), nfld('unitMedical:f:note', 'Նշում', '📝', '#kmUtMedNote')]) },
      { to: 'unitTermWatch', extra: [], node: grp('unitTermWatch:fields', 'Տվյալներ / Դաշտեր', '📋', [
        nfld('unitTermWatch:f:warn', 'Նախազգուշացում (օր)', '⚠️', '#kmUtTermWarn'), nfld('unitTermWatch:f:rank', 'Նոր կոչում', '⭐', '#kmUtTermRank'),
        nfld('unitTermWatch:f:date', 'Ժամկետ', '⏱', '#kmUtTermDate')]) },
      { to: 'unitLeavePlan', extra: [], node: grp('unitLeavePlan:fields', 'Տվյալներ / Դաշտեր', '📋', [
        nfld('unitLeavePlan:f:days', 'Օրեր', '🔢', '#kmUtLeaveDays'), nfld('unitLeavePlan:f:from', 'Սկիզբ', '📅', '#kmUtLeaveFrom'),
        nfld('unitLeavePlan:f:max', 'Մաքս. բացակա %', '📊', '#kmUtLeaveMax')]) },
      { to: 'unitInventory', extra: [], node: grp('unitInventory:btns', 'Կոճակներ (ստորաբաժանում / ծառայություն)', '🔘', [
        btn('unitInventory:btn:subAdd', 'Ավելացնել ստորաբաժանում', '➕', 'edit', B + '"kmUnitInvSubAdd()"]'),
        btn('unitInventory:btn:subRemove', 'Հեռացնել ստորաբաժանում', '🗑', 'edit', B + '"kmUnitInvSubRemoveSelected()"]'),
        btn('unitInventory:btn:svcAdd', 'Ավելացնել ծառայություն', '➕', 'edit', B + '"kmUnitInvServiceAdd()"]'),
        btn('unitInventory:btn:svcRemove', 'Հեռացնել ծառայություն', '🗑', 'edit', B + '"kmUnitInvServiceRemoveSelected()"]')]) },
      /* Վերակարգ */
      { to: 'dutyTypes', extra: [], node: grp('dutyTypes:btns', 'Կոճակներ', '🔘', [
        btn('dutyTypes:btn:remove', 'Պակասեցնել', '➖', 'edit', B + '"removeDutyTypeKM()"]'),
        btn('dutyTypes:btn:edit', 'Խմբագրել', '✏️', 'edit', B + '"editDutyTypesStable()"]'),
        btn('dutyTypes:btn:band', 'Փոխել ցուցակը', '🔄', 'edit', '#kmDutyBandChangeBtn'),
        btn('dutyTypes:btn:future', 'Ապագա պլաններ', '🗓', 'view', B + '"kmOpenFutureSchedules()"]'),
        btn('dutyTypes:btn:subs', 'Փոխարինումներ', '🔁', 'view', B + '"kmListSubstitutions()"]')]) },
      { to: 'workload', extra: [], node: grp('workload:btns', 'Կոճակներ', '🔘', [
        btn('workload:btn:ics', 'Օրացույց (ICS)', '📆', 'view', B + '"kmExportIcs()"]')]) },
      { to: 'analytics', extra: [], node: grp('analytics:btns', 'Կոճակներ', '🔘', [
        btn('analytics:btn:pdf', 'PDF հաշվետվություն', '📄', 'view', B + '"kmPrintMonthlyReport()"]'),
        btn('analytics:btn:compare', 'Համեմատություն', '📊', 'view', B + '"kmMonthCompare()"]'),
        btn('analytics:btn:today', 'Այսօր', '📅', 'view', B + '"kmPrintTodayDuty()"]')]) },
      { to: 'monthCompare', extra: [], node: grp('monthCompare:btns', 'Կոճակներ', '🔘', [
        btn('monthCompare:btn:run', 'Համեմատել', '📊', 'view', B + '"kmRunMonthCompare()"]')]) },
      { to: 'substitutions', extra: [], node: grp('substitutions:btns', 'Կոճակներ', '🔘', [
        btn('substitutions:btn:new', 'Նոր փոխանակում', '➕', 'edit', B + '"kmOpenDutySwap()"]')]) },
      { to: 'unitBadDays', extra: [], node: grp('unitBadDays:btns', 'Կոճակներ / Ֆիլտրեր', '🔘', [
        btn('unitBadDays:btn:filter', 'Ֆիլտր', '🔍', 'view', B + '"kmUnitBadFilterApply()"]'),
        btn('unitBadDays:btn:clear', 'Մաքրել ֆիլտրը', '🧹', 'view', B + '"kmUnitBadFilterClear()"]'),
        btn('unitBadDays:btn:sync', 'Համաժամեցնել Պաշտոնից', '🔄', 'edit', B + '"kmUnitBadSyncFromPositions()"]')]) },
      { to: 'freePeople', extra: [], node: grp('freePeople:btns', 'Կոճակներ', '🔘', [
        btn('freePeople:btn:show', 'Ցույց տալ', '👁', 'view', B + '"kmRenderFreePeople()"]'),
        btn('freePeople:btn:copy', 'Պատճենել տեքստ', '📋', 'view', B + '"kmCopyFreePeople()"]')]) },
      /* Արխիվ */
      { to: 'archiveHub', extra: [], node: btn('auditLog', 'Գործողությունների մատյան', '📝', 'view', '.kmLawCard[onclick="kmOpenAuditLog()"]') },
      { to: 'archiveHub', extra: ['syssettings'], node: grp('backup', 'UserData պահուստ', '💾', [ /* was under Համակարգի կարգավորումներ: that grant still opens it */
        btn('backup:now', 'Այժմ պահուստ', '💾', 'edit', B + '"kmRunBackupNow()"]'),
        btn('backup:restore', 'Վերականգնել', '♻️', 'edit', 'button[data-km-backup]')], 'view', '.kmLawCard[onclick="kmOpenBackupManager()"]') },
      /* Համակարգի կարգավորումներ (rights only; the Settings pages themselves are not edited) */
      { to: 'syssettings', extra: [], node: grp('settings:general', 'Կարգավորումներ', '⚙', [
        nfld('settings:general:equal', 'Հավասար բաշխում', '⚖', '#kmStEqual'),
        nfld('settings:general:dark', 'Մուգ ռեժիմ', '🌙', '#kmStDark'),
        nfld('settings:general:gpu', 'Ծրագրային նկարում (GPU անջատված)', '🖥', '#kmStGpu'),
        nfld('settings:general:rem', 'Պահուստի հիշեցում', '⏰', '#kmStRem'),
        nfld('settings:general:llmOn', 'Միացնել AI / LLM', '🤖', '#kmHbLlmOn'),
        nfld('settings:general:llmLocal', 'Միայն offline local (Ollama)', '🔌', '#kmHbLlmLocalOnly'),
        nfld('settings:general:rag', 'Offline RAG՝ ագրեգացված վիճակագրություն', '📊', '#kmHbLlmStats'),
        nfld('settings:general:llmBase', 'Local Base URL', '🌐', '#kmHbLlmBase'),
        btn('settings:general:probe', 'Ստուգել Local LLM', '🧪', 'edit', B + '"kmHelpBotProbeLocalLlm()"]'),
        btn('settings:general:tickets', 'Աջակցման հայտեր', '🎫', 'view', B + '"kmHelpBotOpenTicketsAdmin()"]'),
        btn('settings:general:feedback', 'Feedback / Fine-tune', '💬', 'view', B + '"kmHelpBotOpenFeedbackAdmin()"]'),
        btn('settings:general:encExport', 'Գաղտնագրված պահուստ', '🔐', 'edit', B + '"kmEncryptedBackupExport()"]'),
        btn('settings:general:encImport', 'Ներմուծել գաղտնագրվածը', '📥', 'edit', B + '"kmEncryptedBackupImport()"]'),
        btn('settings:general:darkPreview', 'Նախադիտել մուգը', '🌙', 'view', B + '"kmPreviewDarkMode()"]'),
        btn('settings:general:reset', 'Ջնջել բոլոր տվյալները (Factory Reset)', '⚠️', 'edit', B + '"kmFactoryReset()"]')
      ], 'view', '.kmLawCard[onclick="kmOpenSettings()"]') },
      { to: 'syssettings', extra: [], node: btn('settings:security', 'Անվտանգություն', '🔒', 'view', '.kmLawCard[onclick="kmOpenSecuritySettings()"]') },
      { to: 'syssettings', extra: [], node: btn('settings:help', 'Օգնություն', '❓', 'view', '.kmLawCard[onclick="kmShowShortcuts()"]') },
      { to: 'network', extra: [], node: grp('network:btns', 'Կոճակներ / Ֆունկցիաներ', '🔘', [
        btn('network:btn:autoStart', 'Սկսել ավտոմատ փնտրումը', '🔎', 'edit', B + '"kmNetAutoStart()"]'),
        btn('network:btn:sendAll', 'Ուղարկել ֆայլ բոլոր միացվածներին', '📡', 'edit', B + '"kmNetSendAll()"]'),
        btn('network:btn:updStage', 'Բացել տեղադրման պանակը', '📂', 'view', B + '"kmNetOpenUpdateStaging()"]'),
        btn('network:btn:updPull', 'Ստանալ և տեղադրել', '⬇️', 'edit', B + '"kmNetPullUpdate()"]'),
        btn('network:btn:send', 'Ընտրել ֆայլ և ուղարկել', '📤', 'edit', B + '"kmNetSend()"]'),
        btn('network:btn:inbox', 'Ստացվածների պանակ', '📥', 'view', B + '"kmNetOpenInbox()"]'),
        btn('network:btn:outbox', 'Outbox (կիսվող)', '📦', 'view', B + '"kmNetOpenOutbox()"]'),
        btn('network:btn:report', 'Հիմա կիսել Outbox / բազան', '🔄', 'edit', B + '"kmNetReportNow()"]'),
        btn('network:btn:archive', 'Բացել արխիվի պանակը', '🗄', 'view', B + '"kmNetOpenArchive()"]')]) },
      { to: 'lib:license', extra: [], node: grp('license:btns', 'Կոճակներ', '🔘', [
        btn('license:btn:stage', 'Բացել տեղադրման պանակը', '📂', 'view', 'button[data-km-lic-act="stage"]'),
        btn('license:btn:activate', 'Ակտիվացնել', '✅', 'edit', 'button[data-km-lic-act="activate"],#kmActBtn'),
        btn('license:btn:kod', 'Ակտիվացնել KM (ինքնագեներացիա)', '🔑', 'edit', 'button[data-km-lic-act="kod"]')]) }
    ];

    function findPath(nodes, id, trail) {
      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        if (n.id === id) return trail.concat([n]);
        if (n.children) { var r = findPath(n.children, id, trail.concat([n])); if (r) return r; }
      }
      return null;
    }
    function leavesOf(n, out) {
      if (n.level) out.push(n);
      (n.children || []).forEach(function (c) { leavesOf(c, out); });
      return out;
    }
    function descendantIds(n, out) {
      (n.children || []).forEach(function (c) { out.push(c.id); descendantIds(c, out); });
      return out;
    }
    function union(a, b) {
      var seen = Object.create(null), res = [];
      (a || []).concat(b || []).forEach(function (x) { x = String(x); if (!seen[x]) { seen[x] = 1; res.push(x); } });
      return res;
    }
    var registry = [];
    ATTACH.forEach(function (a) {
      var path = findPath(GRANT_MENU, a.to, []);
      if (!path) return; /* target node missing: skip, never throw at start-up */
      var target = path[path.length - 1];
      if (findPath(GRANT_MENU, a.node.id, [])) return; /* already added (idempotent) */
      (target.children = target.children || []).push(a.node);
      var ancestors = path.map(function (n) { return n.id; }).concat(a.extra || []);
      var ids = descendantIds(a.node, []).concat([a.node.id]);
      /* flat list used by other modules */
      (function flat(n, group) {
        GRANT_SECTIONS.push({ id: n.id, label: n.label, group: group, icon: n.icon || '?' });
        (n.children || []).forEach(function (c) { flat(c, n.label); });
      })(a.node, target.label);
      /* every ancestor (and the new group itself) expands to the new descendants */
      path.map(function (n) { return n.id; }).concat([a.node.id]).forEach(function (pid) {
        GRANT_PARENTS[pid] = union(GRANT_PARENTS[pid], pid === a.node.id ? descendantIds(a.node, []) : ids);
      });
      leavesOf(a.node, []).forEach(function (lf) {
        registry.push({ id: lf.id, level: lf.level, sel: lf.sel, anc: ancestors });
      });
    });
    window.KM_UI_GRANT_LEAVES = registry;
  })();

  window.kmGrantSections = GRANT_SECTIONS;
  window.kmGrantParents = GRANT_PARENTS;

  async function prepareAdminStore() {
    /* KM_ADMIN_PANELS_OPEN_SAFE_V1 prepare */
    var host = document.getElementById('content');
    if (!host) return null;
    var loadError = '';
    if (!isAdmin()) {
      loadError = 'Միայն ադմինիստրատոր';
      toastMsg(loadError, 'error');
    } else if (!adminToken()) {
      loadError = 'Ադմին սեսիան բացակայում է — նորից մտեք Administrator-ով';
      toastMsg(loadError, 'error');
    }
    var st = null;
    /* KM_ADMIN_PREPARE_TIMEOUT_V1 */
    if (!loadError) {
      try {
        st = await Promise.race([
          loadStore(),
          new Promise(function (resolve) {
            setTimeout(function () {
              resolve({ ok: false, error: 'Սպասման ժամանակը լրացավ (8վ)', admins: [], users: [], superAdminUsername: SUPER_ADMIN });
            }, 8000);
          })
        ]);
      } catch (eLoad) {
        st = { ok: false, error: String(eLoad && eLoad.message ? eLoad.message : eLoad), admins: [], users: [], superAdminUsername: SUPER_ADMIN };
      }
      if (st && st.ok === false) {
        loadError = st.error || 'Մուտքը մերժվեց — նորից մտեք Administrator-ով';
        toastMsg(loadError, 'error');
      }
    }
    var showSuper = !!(st && st.isSuper) || isSuper();
    if (showSuper) {
      window.kmSuperAdmin = true;
      try { sessionStorage.setItem('km_auth_super', '1'); } catch (eS) {}
    }
    return {
      host: host,
      admins: (st && st.admins) || [],
      users: (st && st.users) || [],
      deletedUsers: (st && st.deletedUsers) || [],
      superName: (st && st.superAdminUsername) || SUPER_ADMIN,
      showSuper: showSuper,
      loadError: loadError
    };
  }

  function bindUsersRoot(root, showSuper, reloadFn) {
    if (!root) return;
    if (root.__kmUsersHandler) {
      try { root.removeEventListener('click', root.__kmUsersHandler); } catch (eR) {}
    }
    if (root.__kmGrantToggle) {
      try { root.removeEventListener('click', root.__kmGrantToggle); } catch (eG) {}
    }
    root.__kmGrantToggle = function (ev) {
      var exp = ev.target && ev.target.closest && ev.target.closest('.kmGrantMenuExpand');
      if (exp && root.contains(exp)) {
        ev.preventDefault();
        ev.stopPropagation();
        toggleGrantMenu(exp);
        return;
      }
      var card = ev.target && ev.target.closest && ev.target.closest('button.kmGrantCard[data-km-grant]');
      if (!card || !root.contains(card)) return;
      var g = card.getAttribute('data-km-grant');
      if (g === 'usrEdit' || g === 'usrView') return; /* dual panel-ը ինքն է կապում */
      ev.preventDefault();
      var on = !card.classList.contains('is-selected');
      if (card.classList.contains('kmGrantMenuPick')) {
        setGrantSubtree(card, on);
      } else {
        setGrantSelected(card, on);
        syncGrantParents(card);
      }
    };
    root.addEventListener('click', root.__kmGrantToggle);
    function openUserEdit(usr, opts) {
      opts = opts || {};
      var api = usersApi();
      var editSec = Array.isArray(usr.editSections) ? usr.editSections.slice() : [];
      var viewSec = Array.isArray(usr.viewSections) ? usr.viewSections.slice() : [];
      if (editSec.indexOf('*') >= 0 && GRANT_SECTIONS.length) {
        editSec = GRANT_SECTIONS.map(function (s) { return s.id; });
        viewSec = [];
      }
      /* խմբագրելի բաժինները չկրկնենք դիտման ցուցակում */
      if (editSec.length) {
        var editSet0 = Object.create(null);
        editSec.forEach(function (id) { editSet0[String(id)] = 1; });
        viewSec = viewSec.filter(function (id) { return !editSet0[String(id)]; });
      }

      var grantCss =
        '<style>' +
        '.kmGrantGroup{margin:0 0 14px}' +
        '.kmGrantMenu{display:flex;flex-direction:column;gap:6px}' +
        '.kmGrantMenuItem{border:1px solid #d7e6ec;border-radius:12px;background:#fff;overflow:hidden}' +
        '.kmGrantMenuItem.is-open{border-color:#1a8fa0;box-shadow:0 4px 14px rgba(26,143,160,.12)}' +
        '.kmGrantMenuRow{display:flex;align-items:stretch;gap:0;min-height:48px}' +
        '.kmGrantMenuExpand{flex:1;display:flex;align-items:center;gap:8px;border:0;background:#f7fbfd;padding:10px 12px;cursor:pointer;text-align:left;font:inherit;color:#0d4a66;font-weight:700}' +
        '.kmGrantMenuExpand:hover{background:#eef6f9}' +
        '.kmGrantChevron{display:inline-block;width:14px;transition:transform .15s ease;color:#1a8fa0}' +
        '.kmGrantMenuItem.is-open > .kmGrantMenuRow > .kmGrantMenuExpand .kmGrantChevron{transform:rotate(90deg)}' +
        '.kmGrantMenuIcon{font-size:16px}' +
        '.kmGrantMenuLabel{flex:1;font-size:13px}' +
        '.kmGrantMenuPick{flex:0 0 auto!important;min-width:88px!important;min-height:48px!important;margin:0!important;border-radius:0!important;border:0!important;border-left:1px solid #d7e6ec!important;box-shadow:none!important;padding:8px 10px!important}' +
        '.kmGrantMenuPick .kmLawCardText{font-size:11px!important}' +
        '.kmGrantMenuChildren{display:flex;flex-direction:row;flex-wrap:wrap;align-items:stretch;gap:8px;padding:8px 8px 10px 12px;background:#fbfcfd;border-top:1px solid #e4ebe7}' +
        '.kmGrantMenuChildren[hidden]{display:none!important}' +
        '.kmGrantMenuChildren > .kmGrantLeaf{flex:1 1 168px;max-width:260px;min-width:140px;min-height:52px!important;padding:8px 10px!important;width:auto}.kmGrantMenuChildren > .kmGrantMenuItem{flex:1 1 100%}.kmGrantLeaf{min-height:52px!important;padding:8px 10px!important}' +
        '.kmGrantLeaf .kmLawCardText{font-size:12px!important}' +
        '.kmGrantMenuChildren .kmGrantMenuItem{border-style:dashed}' +
        '#content .kmLawsGrid .kmGrantCard.is-selected,#content .kmGrantCard.is-selected,.kmGrantCard.is-selected{box-shadow:0 8px 20px rgba(26,143,160,.22),inset 0 0 0 2px #1a8fa0!important;background:linear-gradient(180deg,#f0fafb 0%,#e7f6f8 100%)!important}' +
        '#content .kmLawsGrid .kmGrantCard.is-selected:hover,#content .kmGrantCard.is-selected:hover,.kmGrantCard.is-selected:hover{box-shadow:0 8px 20px rgba(26,143,160,.22),inset 0 0 0 2px #1a8fa0!important;background:#f0fafb!important}' +
        '#content .kmLawsGrid .kmGrantCard.is-selected .kmLawCardText,.kmGrantCard.is-selected .kmLawCardText{color:#0a6a7a!important}' +
        '.kmAccessDual{display:grid;grid-template-columns:1fr 1fr;gap:14px;align-items:stretch}' +
        '@media(max-width:900px){.kmAccessDual{grid-template-columns:1fr}}' +
        '.kmAccessPanel{border:1px solid #d7e6ec;border-radius:14px;background:#fff;padding:12px 12px 10px;display:flex;flex-direction:column;min-height:0;box-shadow:0 4px 14px rgba(13,74,102,.06)}' +
        '.kmAccessPanel.is-view{border-color:#b9d4de}' +
        '.kmAccessPanel.is-edit{border-color:#1a8fa0;box-shadow:0 6px 18px rgba(26,143,160,.14)}' +
        '.kmAccessPanelHead{margin:0 0 8px}' +
        '.kmAccessPanelTitle{margin:0 0 4px;font-size:15px;font-weight:800;color:#0d4a66;text-transform:uppercase;letter-spacing:.02em}' +
        '.kmAccessPanelDesc{margin:0;font-size:12.5px;line-height:1.45;color:#5a6b78}' +
        '.kmAccessPanelTools{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:8px 0 10px}' +
        '.kmAccessPanelTools .muted{margin-left:auto;font-size:12px}' +
        '.kmAccessPanelList{flex:1;max-height:min(68vh,640px);overflow:auto;border:1px solid #e4ebe7;border-radius:10px;padding:8px 10px;background:#fbfcfd}' +
        '</style>';

      function dualStepHtml() {
        return ('<p class="muted" style="font-size:13px;margin:0 0 12px">Կարգը նույնն է, ինչ հիմնական մենյուն։ <b>Հիմնական</b>-ը միշտ բաց է։ <b>Ադմին</b> և <b>Օգտատերեր</b> վահանակները միայն ադմինի համար են՝ այստեղ չեն տրվում։ Ենթաբաժինները բացել/փակել կոճակով են· Յուրաքանչյուր ընտրություն փոխում է միայն տվյալ տողը։ «Բոլորը» կոճակները փոխում են բոլոր տողերը։ «Փոփոխություններ»-ը ներառում է նաև դիտում։</p>' +
          permMatrixHtml(viewSec, editSec, 'usr') +
          (typeof kmArchiveOrgGrantHtml === 'function' ? kmArchiveOrgGrantHtml(usr) : '') +
          grantCss); /* KM_ARCHIVE_ORG_GRANT_INJECT_V1_HTML */
      }

      function wireDualGrants(dlg) {
        if (!dlg) return;
        wirePermMatrix(dlg, 'usr'); /* KM_PERM_MATRIX_V1 */
      }

      async function saveDualGrants(o) {
        if (!api || !api.saveUser) { toastMsg('Users API բացակայում է', 'error'); return false; }
        var views = readChecked(o, 'usrView');
        var edits = readChecked(o, 'usrEdit');
        if (!views.length && !edits.length) {
          toastMsg('Ընտրեք առնվազն մեկ ֆունկցիա՝ դիտման կամ փոփոխության բաժնում', 'warn');
          return false;
        }
        /* edit-ը գերակայում է */
        var editSet = Object.create(null);
        edits.forEach(function (id) { editSet[String(id)] = 1; });
        views = views.filter(function (id) { return !editSet[String(id)]; });
        var mode = edits.length && views.length ? 'mixed' : (edits.length ? 'edit' : 'view');
        var rs = await api.saveUser({
          adminToken: adminToken(),
          id: usr.id,
          pageAccessMode: mode,
          viewSections: views,
          editSections: edits,
                archiveCorpsIds: (typeof collectArchiveOrgIds==='function'?collectArchiveOrgIds('corps'):[]),
                archiveUnitIds: (typeof collectArchiveOrgIds==='function'?collectArchiveOrgIds('unit'):[])
        });
        if (!rs || !rs.ok) {
          toastMsg((rs && rs.error) || 'Չհաջողվեց', 'error');
          return false;
        }
        toastMsg('Դիտում՝ ' + views.length + ' · Փոփոխություն՝ ' + edits.length, 'ok');
        if (typeof reloadFn === 'function') reloadFn();
        return true;
      }

      if (typeof window.kmOpenDialog !== 'function') {
        var box = root.querySelector('#kmUsersDetail');
        if (!box) return;
        box.innerHTML =
          '<div class="card" style="padding:12px">' +
          '<h4 style="margin:0 0 8px">Օգտատեր՝ ' + esc(usr.fullName || 'Օգտատեր') +
          '</h4>' +
          dualStepHtml() +
          '<button type="button" class="primary" style="margin-top:12px" data-km-usr="saveUserGrants" data-id="' +
          esc(usr.id) + '">Հաստատել</button></div>';
        wireDualGrants(box);
        return;
      }
      var dlg = window.kmOpenDialog(
        'Էջերի իրավունքներ — ' + (usr.fullName || 'Օգտատեր'),
        dualStepHtml(),
        async function (o) { return saveDualGrants(o); },
        'Հաստատել'
      );
      try {
        var card = dlg && dlg.querySelector('.kmDlgCard');
        if (card) card.style.width = 'min(1100px,98vw)';
      } catch (eW) {}
      wireDualGrants(dlg);
    }
    function openAdminEdit(adm) {
      var box = root.querySelector('#kmUsersDetail');
      if (!box) return;
      var av = Array.isArray(adm.viewSections) ? adm.viewSections : [];
      var ae = Array.isArray(adm.editSections) ? adm.editSections : (adm.sections || []);
      if (ae.length) {
        var es = Object.create(null); ae.forEach(function(x){es[String(x)]=1;});
        av = av.filter(function(x){return !es[String(x)];});
      }
      box.innerHTML =
        '<div class="card" style="padding:12px">' +
        '<h4 style="margin:0 0 8px">Ադմին՝ ' + esc(adm.username) + '</h4>' +
        '<label>Գնդ / կայազոր<input id="kmAdmEditGar" type="text" style="width:100%;margin:6px 0" value="' + esc(adm.garrison || '') + '"></label>' +
        '<label>Նոր գաղտնաբառ (դատարկ՝ անփոփոխ)<input id="kmAdmEditPw" type="password" style="width:100%;margin:6px 0"></label>' +
        adminDualHtml(av, ae, 'adm') +
        '<button type="button" class="primary" style="margin-top:10px" data-km-usr="saveAdmEdit" data-id="' + esc(adm.id) + '">Հաստատել</button></div>';
      wireAdminDualGrants(box, 'adm');
    }
    root.__kmUsersHandler = async function (ev) {
      var btn = ev.target && ev.target.closest && ev.target.closest('[data-km-usr]');
      if (!btn) return;
      var act = btn.getAttribute('data-km-usr');
      var id = btn.getAttribute('data-id') || '';
      var api = usersApi();
      if (!api) { toastMsg('Users API բացակայում է', 'error'); return; }
      try {
        if (act === 'userArchives' || act === 'userPersonal') {
          var usrA = (window._kmLastUsersList || []).find(function (x) { return String(x.id) === String(id); });
          if (!usrA) {
            try {
              var lst = await api.list({ adminToken: adminToken() });
              usrA = ((lst && lst.users) || []).find(function (x) { return String(x.id) === String(id); });
            } catch (eL) {}
          }
          if (!usrA) { toastMsg('Օգտատեր չգտնվեց', 'error'); return; }
          window.kmOpenUserPersonalAdmin(usrA);
          return;
        }
        if (act === 'addAdm') {
          if (!showSuper) { toastMsg('Միայն սուպեր ադմին', 'error'); return; }
          var u = String((root.querySelector('#kmAdmUser') || {}).value || '').trim();
          var pw = String((root.querySelector('#kmAdmPw') || {}).value || '');
          var gar = String((root.querySelector('#kmAdmGar') || {}).value || '').trim();
          if (!hyUsernameOk(u)) { toastMsg('Ադմինի մուտքանունը՝ միայն հայատառ Ա․Ա․Հ․', 'warn'); return; }
          if (pw.length < 6) { toastMsg('Գաղտնաբառը կարճ է', 'warn'); return; }
          var admViews = readChecked(root, 'admNewView');
          var admEdits = readChecked(root, 'admNewEdit');
          if (!admViews.length && !admEdits.length) { toastMsg('Ընտրեք առնվազն մեկ ֆունկցիա՝ դիտման կամ փոփոխության բաժնում', 'warn'); return; }
          var admEditSet = Object.create(null); admEdits.forEach(function(x){admEditSet[String(x)]=1;});
          admViews = admViews.filter(function(x){return !admEditSet[String(x)];});
          var r = await api.saveAdmin({
            adminToken: adminToken(),
            username: u,
            password: pw,
            garrison: gar,
            sections: admEdits,
            viewSections: admViews,
            editSections: admEdits,
            pageAccessMode: (admEdits.length && admViews.length ? 'mixed' : (admEdits.length ? 'edit' : 'view'))
          });
          if (!r || !r.ok) { toastMsg((r && r.error) || 'Չհաջողվեց', 'error'); return; }
          toastMsg('Ադմինը ստեղծվեց', 'ok');
          reloadFn();
          return;
        }
        if (act === 'delAdm') {
          if (!showSuper) return;
          if (!confirm('Ջնջե՞լ ադմինին։')) return;
          await api.deleteAdmin({ adminToken: adminToken(), id: id });
          reloadFn();
          return;
        }
        if (act === 'editAdm') {
          var st2 = await loadStore();
          var adm = ((st2 && st2.admins) || []).find(function (x) { return x.id === id; });
          if (!adm) return;
          openAdminEdit(adm);
          return;
        }
        if (act === 'addUser') {
          if (!adminToken()) { toastMsg('Նորից մտեք Administrator-ով', 'error'); return; }
          var orgPick = liveUsersOrgPick(root);
          if (!orgPick.corpsId || !orgPick.unitId) {
            toastMsg('Նախ ընտրեք բանակային կորպուսը և զորամասը', 'warn');
            return;
          }
          var given = String((root.querySelector('#kmUsrGiven') || {}).value || '').trim();
          var family = String((root.querySelector('#kmUsrFamily') || {}).value || '').trim();
          var patronymic = String((root.querySelector('#kmUsrPatronymic') || {}).value || '').trim();
          var un = String((root.querySelector('#kmUsrName') || {}).value || '').trim();
          if (!hyNamePartOk(given)) { toastMsg('Անունը պարտադիր է և միայն հայատառ', 'warn'); return; }
          if (!hyNamePartOk(family)) { toastMsg('Ազգանունը պարտադիր է և միայն հայատառ', 'warn'); return; }
          if (!hyNamePartOk(patronymic)) { toastMsg('Հայրանունը պարտադիր է և միայն հայատառ', 'warn'); return; }
          if (!loginUsernameOk(un)) { toastMsg('Մուտքանունը՝ լատինատառ և թվեր (մինչև 10 տառ և 6 թիվ)', 'warn'); return; }
          var pwAdd = String((root.querySelector('#kmUsrPassword') || {}).value || '').trim();
          var ru = await api.saveUser({
            adminToken: adminToken(),
            username: un,
            givenName: given,
            familyName: family,
            patronymic: patronymic,
            password: pwAdd || undefined,
            corpsId: orgPick.corpsId,
            unitId: orgPick.unitId,
            editSections: [],
            viewSections: [],
            pageAccessMode: ''
          }); /* KM_LOGIN_SAVE_FIX_V1 */
          if (!ru || !ru.ok) { toastMsg((ru && ru.error) || 'Չհաջողվեց պահել օգտատիրոջը', 'error'); return; }
          if (pwAdd && ru.user && ru.user.hasPassword) {
            alert('Օգտատեր պահպանվեց։\n\nՕգտատեր՝ ' + given + ' ' + family + ' ' + patronymic + '\nՄուտքանուն՝ ' + un + '\nԳաղտնաբառը դրված է — մուտք գործեք մուտքանունով և գաղտնաբառով։\nՑուցակում օգտատերեր՝ ' + (ru.usersCount || '—'));
          } else if (ru.oneTimeCode) {
            alert('Օգտատեր գրանցվեց և պահպանվեց։\n\nՕգտատեր՝ ' + given + ' ' + family + ' ' + patronymic + '\nՄուտքանուն՝ ' + un + '\nԿոդ՝ ' + ru.oneTimeCode + '\n\nՅուրաքանչյուր համակարգչում կոդը մուտքագրել մեկ անգամ։\nՑուցակում օգտատերեր՝ ' + (ru.usersCount || '—'));
          } else {
            toastMsg('Օգտատերը պահպանվեց', 'ok');
          }
          reloadFn();
          return;
        }
        if (act === 'newCode') {
          var rc = await api.issueCode({ adminToken: adminToken(), id: id });
          if (!rc || !rc.ok) { toastMsg((rc && rc.error) || 'Չհաջողվեց', 'error'); return; }
          alert('Նոր կոդ՝ ' + rc.oneTimeCode + '\nՅուրաքանչյուր նոր համակարգչի համար մեկ անգամ։');
          reloadFn();
          return;
        }
        if (act === 'delUser') {
          if (!confirm('Ջնջե՞լ օգտատիրոջը։\n\nՆա կտեղափոխվի «Հեռացված» ցուցակ՝ կարելի է վերականգնել նոր մեկանգամյա կոդով։')) return;
          var rd = await api.deleteUser({ adminToken: adminToken(), id: id });
          if (!rd || !rd.ok) { toastMsg((rd && rd.error) || 'Ջնջումը չհաջողվեց', 'error'); return; }
          removeSavedLoginUsername(rd.username);
          toastMsg('Օգտատերը հեռացվեց', 'ok');
          reloadFn();
          return;
        }
        if (act === 'purgeDeleted') {
          /* KM_USER_PURGE_FIX_V1: never call restore from final-delete */
          ev.preventDefault();
          ev.stopPropagation();
          if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
          if (!confirm('Վերջնական ջնջե՞լ այս օգտատիրոջը՝\n\nԳրառումը կհեռացվի անդառնալիորեն, օգտագործված կոդերը կազատվեն՝ Վերականգնել այլևս հնարավոր չի լինի՝')) return;
          if (!api.purgeDeleted) { toastMsg('Վերջնական ջնջման API-ն բացակայում է', 'error'); return; }
          var rp = await api.purgeDeleted({ adminToken: adminToken(), id: id });
          if (!rp || !rp.ok) { toastMsg((rp && rp.error) || 'Վերջնական ջնջումը չհաջողվեց', 'error'); return; }
          removeSavedLoginUsername(rp.username);
          toastMsg('Օգտատերը վերջնական ջնջվեց' + (rp.freedCodes ? (' · ազատվեց ' + rp.freedCodes + ' կոդ') : ''), 'ok');
          reloadFn();
          return;
        }
        if (act === 'restoreUser') {
          var rr = await api.restoreUser({ adminToken: adminToken(), id: id });
          if (!rr || !rr.ok) { toastMsg((rr && rr.error) || 'Վերականգնումը չհաջողվեց', 'error'); return; }
          upsertSavedLoginUsername(rr.user && rr.user.username);
          if (rr.oneTimeCode) {
            alert(
              'Օգտատերը վերականգնվեց՝\n\nՕգտատեր՝ ' + ((rr.user && (rr.user.fullName || rr.user.username)) || '') +
              '\nՄուտքանուն՝ ' + ((rr.user && rr.user.username) || '') +
              '\nՄեկանգամյա կոդ՝ ' + rr.oneTimeCode +
              '\n\nԿոդը մուտքագրել յուրաքանչյուր նոր համակարգչում մեկ անգամ՝'
            );
          } else {
            toastMsg('Օգտատերը վերականգնվեց', 'ok');
          }
          reloadFn();
          return;
        }
        if (act === 'editUser') {
          var st3 = await loadStore();
          var usr = ((st3 && st3.users) || []).find(function (x) { return x.id === id; });
          if (!usr) return;
          openUserEdit(usr);
          return;
        }
        if (act === 'confirmAccessMode') {
          var stM = await loadStore();
          var usrM = ((stM && stM.users) || []).find(function (x) { return x.id === id; });
          if (!usrM) return;
          openUserEdit(usrM);
          return;
        }
        if (act === 'saveUserGrants') { /* KM_GRANTS_CONFIRM_SYNC_V2 saveUserGrants */
          var uid = btn.getAttribute('data-id');
          var views = readChecked(root, 'usrView');
          var edits = readChecked(root, 'usrEdit');
          if (!views.length && !edits.length) {
            toastMsg('Ընտրեք առնվազն մեկ ֆունկցիա՝ դիտման կամ փոփոխության բաժնում', 'warn');
            return;
          }
          var editSet = Object.create(null);
          edits.forEach(function (x) { editSet[String(x)] = 1; });
          views = views.filter(function (x) { return !editSet[String(x)]; });
          var modeSave = edits.length && views.length ? 'mixed' : (edits.length ? 'edit' : 'view');
          var rs = await api.saveUser({
            adminToken: adminToken(),
            id: uid,
            pageAccessMode: modeSave,
            viewSections: views,
            editSections: edits,
                  archiveCorpsIds: (typeof collectArchiveOrgIds==='function'?collectArchiveOrgIds('corps'):[]),
                  archiveUnitIds: (typeof collectArchiveOrgIds==='function'?collectArchiveOrgIds('unit'):[])
          });
          if (!rs || !rs.ok) { toastMsg((rs && rs.error) || 'Չհաջողվեց', 'error'); return; }
          toastMsg('Դիտում՝ ' + views.length + ' · Փոփոխություն՝ ' + edits.length, 'ok');
          reloadFn();
          return;
        }
        if (act === 'saveAdmEdit') {
          var aid = btn.getAttribute('data-id');
          var gar2 = String((root.querySelector('#kmAdmEditGar') || {}).value || '').trim();
          var pw2 = String((root.querySelector('#kmAdmEditPw') || {}).value || '');
          var admViews2 = readChecked(root, 'admView');
          var admEdits2 = readChecked(root, 'admEdit');
          var admEditSet2 = Object.create(null); admEdits2.forEach(function(x){admEditSet2[String(x)]=1;});
          admViews2 = admViews2.filter(function(x){return !admEditSet2[String(x)];});
          var ra = await api.saveAdmin({
            adminToken: adminToken(),
            id: aid,
            garrison: gar2,
            sections: admEdits2,
            viewSections: admViews2,
            editSections: admEdits2,
            pageAccessMode: (admEdits2.length && admViews2.length ? 'mixed' : (admEdits2.length ? 'edit' : 'view')),
            password: pw2 || undefined
          });
          if (!ra || !ra.ok) { toastMsg((ra && ra.error) || 'Չհաջողվեց', 'error'); return; }
          toastMsg('Ադմինը թարմացվեց', 'ok');
          reloadFn();
        }
      } catch (e) {
        toastMsg(e.message || 'Սխալ', 'error');
      }
    };
    root.addEventListener('click', root.__kmUsersHandler);
  }

  /** Առանձին էջ՝ ադմինիստրատորների կառավարում */
  window.kmOpenAdminsAdmin = async function () {
    /* KM_ADMIN_PANELS_OPEN_SAFE_V1 */
    try {
    /* KM_ADMIN_PAINT_FIRST_V1 — show something immediately so home dashboard cannot linger */
    (function(){
      var h = document.getElementById('content');
      if (!h) return;
      if (h.querySelector('#kmUsersRoot') && !h.querySelector('[data-km-admin-panel-loading]')) return;
      h.innerHTML = '<div class="card" id="kmUsersRoot" data-km-admin-panel-loading="1"><p class="muted" style="margin:8px 0">Բեռնվում է վահանակը…</p></div>';
    })();


    var ctx = await prepareAdminStore();
    /* KM_ADMIN_CTX_NULL_V1 */
    if (!ctx) {
      var hNull = document.getElementById('content');
      if (hNull) hNull.innerHTML = '<div class="card" id="kmUsersRoot"><b>Վահանակը հասանելի չէ։</b><p class="muted">Սեսիան կամ content-ը բացակայում է։</p></div>';
      return;
    }
    var adminRows = ctx.admins.map(function (a) {
      return '<tr data-adm-id="' + esc(a.id) + '">' +
        '<td><b>' + esc(a.username) + '</b>' +
        '<div class="muted" style="font-size:11px">Գնդ՝ ' + esc(a.garrison || '—') + '</div></td>' +
        '<td class="muted" style="font-size:12px">' + esc((a.sections || []).length) + ' բաժին</td>' +
        '<td style="white-space:nowrap">' +
        '<button type="button" data-km-usr="editAdm" data-id="' + esc(a.id) + '">Խմբագրել</button> ' +
        (ctx.showSuper ? '<button type="button" data-km-usr="delAdm" data-id="' + esc(a.id) + '">Ջնջել</button>' : '') +
        '</td></tr>';
    }).join('') || '<tr><td colspan="3" class="muted">Նշանակված ադմին չկա</td></tr>';

    ctx.host.innerHTML =
      '<div class="card" id="kmUsersRoot">' +
      (typeof window.kmBackToolbar === 'function' ? window.kmBackToolbar("kmOpenPage('home')") : '') +
      '<h3 style="margin:0 0 6px">Ադմինիստրատորների կառավարման վահանակ</h3>' +
      '<p class="muted" style="margin:0 0 14px;font-size:13px">Սուպեր ադմին՝ <b>' + esc(ctx.superName) +
      '</b>։ Այստեղ նշանակվում են ադմիններ (ոչ ծրագրի սովորական օգտատերեր)։</p>' +
      (ctx.showSuper ? ('<div class="card" style="margin-bottom:14px;padding:12px;border:1px solid #c5d0e0;background:#f6f8fc">' +
          '<h4 style="margin:0 0 6px">Կենտրոնացված զրույցներ և պահոց</h4>' +
          '<p class="muted" style="margin:0 0 8px;font-size:12px">Բոլոր կորպուսների օգտատերերի և ասիստենտի զրույցները գնում են մեկ կենտրոնական արխիվ (conversations.txt)։ Երբ Gemini API-ն միանում է համակարգչին, կատարվում է run և զրույցները անցնում են գիտելիքների բազա։ Օգտատիրոջ ջնջած ֆայլերը պահվում են 6 ամիս։ Դիտում/կառավարում՝ միայն սուպեր ադմին։</p>' +
          '<button type="button" class="primary" onclick="kmOpenHubVault()">Բացել զրույցներն ու պահոցը</button>' +
          '</div>') : '') +
      '<div class="card" style="margin-bottom:14px;padding:12px;border:1px solid #c5d8ce;background:#f7fbf8">' +
      '<h4 style="margin:0 0 8px">Նոր ադմին</h4>' +
      (ctx.showSuper
        ? ('<p class="muted" style="font-size:12px;margin:0 0 8px">Ստեղծեք ադմին՝ գնդով և բաժինների իրավունքներով։</p>' +
          '<div style="display:grid;gap:8px;grid-template-columns:1fr 1fr">' +
          '<label>Մուտքանուն (հայատառ)<input id="kmAdmUser" type="text" style="width:100%;margin-top:4px"></label>' +
          '<label>Գաղտնաբառ<input id="kmAdmPw" type="password" style="width:100%;margin-top:4px"></label>' +
          '<label style="grid-column:1/-1">Գնդ / կայազոր<input id="kmAdmGar" type="text" style="width:100%;margin-top:4px" placeholder="օր.՝ N գնդ"></label>' +
          '</div>' +
          adminDualHtml([], [], 'admNew') +
          '<button type="button" class="primary" style="margin-top:10px" data-km-usr="addAdm">Ստեղծել ադմին</button>')
        : '<p class="muted" style="margin:0">Այս բաժինը հասանելի է միայն սուպեր ադմինին (<b>' + esc(ctx.superName) + '</b>)։</p>') +
      '</div>' +
      '<h4>Նշանակված ադմիններ</h4>' +
      '<div class="gridwrap"><table class="grid"><thead><tr><th>Ադմին</th><th>Բաժիններ</th><th></th></tr></thead><tbody>' +
      adminRows + '</tbody></table></div>' +
      '<div id="kmUsersDetail" style="margin-top:14px"></div>' +
      '</div>' +
      '<style id="km-users-grant-css">' +
      '.kmGrantGroup{margin:0 0 14px}' +
      '.kmGrantGroupTitle{margin:0 0 8px;font-size:12px;font-weight:800;color:#0d4a66;text-transform:uppercase;letter-spacing:.03em;padding-bottom:4px;border-bottom:1px solid #e4ebe7}' +
      '.kmGrantGrid{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:10px!important;margin-bottom:0!important}' +
      '.kmGrantCard{min-height:78px!important;padding:12px 12px 20px!important}' +
      '.kmGrantCard .kmLawCardText{font-size:11.5px!important}' +
      grantMenuCss() +
      '#content .kmLawsGrid .kmGrantCard.is-selected,#content .kmGrantCard.is-selected,.kmGrantCard.is-selected{box-shadow:0 8px 20px rgba(26,143,160,.22),inset 0 0 0 2px #1a8fa0!important;background:#f0fafb!important}' +
      '#content .kmLawsGrid .kmGrantCard.is-selected:hover,#content .kmGrantCard.is-selected:hover,.kmGrantCard.is-selected:hover{box-shadow:0 8px 20px rgba(26,143,160,.22),inset 0 0 0 2px #1a8fa0!important;background:#f0fafb!important}' +
      '#content .kmLawsGrid .kmGrantCard.is-selected .kmLawCardText,.kmGrantCard.is-selected .kmLawCardText{color:#0a6a7a!important}' +
      '</style>';

    page = 'admins';
    window.page = 'admins';
    var pt = document.getElementById('pageTitle');
    if (pt) pt.textContent = 'Ադմինիստրատորների կառավարման վահանակ';
    if (typeof window.kmApplyRoleGuard === 'function') try { window.kmApplyRoleGuard(); } catch (eG) {}
    bindUsersRoot(ctx.host.querySelector('#kmUsersRoot'), ctx.showSuper, window.kmOpenAdminsAdmin);
    wireAdminDualGrants(ctx.host.querySelector('#kmUsersRoot'), 'admNew');
    bindHyNameInput(ctx.host.querySelector('#kmAdmUser'));
  
    } catch (errSafe) {
      console.error('kmOpenAdminsAdmin', errSafe);
      var h = document.getElementById('content');
      if (h) h.innerHTML = '<div class="card" id="kmUsersRoot"><b>Վահանակը բացել չհաջողվեց։</b><p class="muted">' +
        String(errSafe && errSafe.message ? errSafe.message : errSafe) + '</p></div>';
    }
  };;

  function removeSavedLoginUsername(username) {
    var un = String(username || '').trim().replace(/\s+/g, ' ');
    if (!un) return;
    try {
      var raw = JSON.parse(localStorage.getItem('km_saved_user_logins') || '[]');
      if (!Array.isArray(raw)) return;
      var next = raw.filter(function (x) {
        var n = typeof x === 'string' ? x : (x && x.username) || '';
        return String(n || '').trim().replace(/\s+/g, ' ') !== un;
      });
      localStorage.setItem('km_saved_user_logins', JSON.stringify(next));
    } catch (e) {}
  }

  function upsertSavedLoginUsername(username) {
    var un = String(username || '').trim().replace(/\s+/g, ' ');
    if (!un) return;
    try {
      var raw = JSON.parse(localStorage.getItem('km_saved_user_logins') || '[]');
      if (!Array.isArray(raw)) raw = [];
      var list = raw
        .map(function (x) {
          return typeof x === 'string' ? { username: x } : x;
        })
        .filter(function (x) {
          return x && String(x.username || '').trim().replace(/\s+/g, ' ') !== un;
        });
      list.unshift({ username: un, savedAt: new Date().toISOString() });
      localStorage.setItem('km_saved_user_logins', JSON.stringify(list.slice(0, 40)));
    } catch (e) {}
  }

  var USERS_ORG_KEY = 'km_users_admin_org';

  function readUsersOrgPick() {
    try {
      var s = JSON.parse(sessionStorage.getItem(USERS_ORG_KEY) || 'null');
      if (s && s.corpsId) return { corpsId: String(s.corpsId), unitId: String(s.unitId || '') };
    } catch (e) {}
    return { corpsId: '', unitId: '' };
  }
  function writeUsersOrgPick(corpsId, unitId) {
    var cid = String(corpsId || '').trim();
    var uid = String(unitId || '').trim();
    try {
      if (cid) sessionStorage.setItem(USERS_ORG_KEY, JSON.stringify({ corpsId: cid, unitId: uid }));
      else sessionStorage.removeItem(USERS_ORG_KEY);
    } catch (e) {}
    return { corpsId: cid, unitId: uid };
  }
  function liveUsersOrgPick(root) {
    var pick = readUsersOrgPick();
    try {
      var corpsSel = root && root.querySelector('#kmUsersPickCorps');
      var unitSel = root && root.querySelector('#kmUsersPickUnit');
      if (corpsSel) pick.corpsId = String(corpsSel.value || pick.corpsId || '').trim();
      if (unitSel) pick.unitId = String(unitSel.value || pick.unitId || '').trim();
    } catch (e) {}
    return writeUsersOrgPick(pick.corpsId, pick.unitId);
  }
  function listUsersOrgCorps() {
    try {
      if (typeof window.kmListOrgCorps === 'function') return window.kmListOrgCorps() || [];
    } catch (e) {}
    return [];
  }
  function listUsersOrgUnits(corpsId) {
    try {
      if (typeof window.kmListOrgUnits === 'function') return window.kmListOrgUnits(corpsId) || [];
    } catch (e) {}
    return [];
  }
  function userMatchesOrg(u, corpsId, unitId) {
    if (!u || !corpsId || !unitId) return false;
    return String(u.corpsId || '').trim() === String(corpsId).trim() && String(u.unitId || '').trim() === String(unitId).trim();
  }
  function setUnitSelectDisabled(unitSel, disabled) {
    if (!unitSel) return;
    unitSel.disabled = !!disabled;
    if (disabled) unitSel.setAttribute('data-km-keep-disabled', '1');
    else unitSel.removeAttribute('data-km-keep-disabled');
  }
  function fillUnitSelectOptions(unitSel, corpsId, selectedUnitId) {
    if (!unitSel) return;
    var cid = String(corpsId || '').trim();
    var uid = String(selectedUnitId || '').trim();
    var units = cid ? listUsersOrgUnits(cid) : [];
    if (uid && units.every(function (u) { return String(u.id) !== uid; })) uid = '';
    unitSel.innerHTML = '<option value="">— զորամաս —</option>' + units.map(function (u) {
      return '<option value="' + esc(u.id) + '"' + (String(u.id) === uid ? ' selected' : '') + '>' + esc(u.name) + '</option>';
    }).join('');
    setUnitSelectDisabled(unitSel, !cid);
    if (cid && uid) unitSel.value = uid;
  }
  function usersOrgPickerHtml(pick) {
    pick = pick || readUsersOrgPick();
    var corps = listUsersOrgCorps();
    var selC = String(pick.corpsId || '');
    var units = selC ? listUsersOrgUnits(selC) : [];
    var selU = String(pick.unitId || '');
    if (selU && units.every(function (u) { return String(u.id) !== selU; })) selU = '';
    var corpsOpts = '<option value="">— բանակային կորպուս —</option>' + corps.map(function (c) {
      return '<option value="' + esc(c.id) + '"' + (String(c.id) === selC ? ' selected' : '') + '>' + esc(c.name) + '</option>';
    }).join('');
    var unitOpts = '<option value="">— զորամաս —</option>' + units.map(function (u) {
      return '<option value="' + esc(u.id) + '"' + (String(u.id) === selU ? ' selected' : '') + '>' + esc(u.name) + '</option>';
    }).join('');
    return '<div class="kmAdminOrgPick" id="kmUsersOrgPick">' +
      '<label>Բանակային կորպուս<select id="kmUsersPickCorps">' + corpsOpts + '</select></label>' +
      '<label>Զորամաս<select id="kmUsersPickUnit"' + (selC ? '' : ' disabled data-km-keep-disabled="1"') + '>' + unitOpts + '</select></label>' +
      '</div>';
  }
  function userCardHtml(u) {
    var full = Array.isArray(u.editSections) && u.editSections.indexOf('*') >= 0;
    var nEdit = full ? GRANT_SECTIONS.length : (u.editSections || []).length;
    var nView = full ? 0 : (u.viewSections || []).length;
    var nSec = nEdit + nView;
    var waiting = u.hasPassword && !full && !nEdit && !nView;
    var modeTxt = waiting
      ? 'սպասում է ադմինի հաստատմանը'
      : (full
        ? 'բոլոր ֆունկցիաները'
        : ((nView && nEdit)
          ? ('դիտում ' + nView + ' · փոփոխություն ' + nEdit)
          : (nEdit ? ('փոփոխություն · ' + nEdit) : (nView ? ('միայն դիտում · ' + nView) : 'առանց իրավունքների'))));
    var status = waiting
      ? ('գրանցված է · հաստատեք էջերի իրավունքները')
      : (u.hasPassword
        ? ('գրանցված · գաղտնաբառ' + (u.machineCount ? (' · ' + u.machineCount + ' համակարգիչ') : ''))
        : (u.hasPendingCode
          ? ('սպասում է գրանցման կոդին · ' + (u.machineCount || 0) + ' համակարգիչ')
          : (u.machineCount ? (u.machineCount + ' համակարգիչ') : 'գրանցված')));
    var title = String((u.fullName || '')).trim() || 'Օգտատեր';
    var kodLine = u.unitKod
      ? ('<div class="muted" style="font-size:11px;margin:2px 2px 0">Զորամասի կոդ՝ <b>' + esc(u.unitKod) + '</b></div>')
      : '';
    return '<div class="kmUserGrantWrap" data-km-usr="userPersonal" data-id="' + esc(u.id) + '" title="Սեղմեք օգտատիրոջ վրա" style="cursor:pointer">' +
      '<button type="button" class="kmLawCard" data-km-usr="userPersonal" data-id="' + esc(u.id) + '" title="Սեղմեք օգտատիրոջ վրա">' +
      '<span class="kmLawCardText">' + esc(title) + '</span>' +
      '<span class="kmLawCardIcon" aria-hidden="true">👤</span></button>' +
      kodLine +
      (u.unitName ? ('<div class="muted" style="font-size:11px;margin:2px 2px 0">' + esc(u.corpsName || '') + (u.corpsName && u.unitName ? ' · ' : '') + esc(u.unitName) + '</div>') : '') +
      '<div class="muted" style="font-size:11px;margin:6px 2px 8px">' + esc(status) + ' · ' + esc(String(nSec)) + ' բաժին · ' + esc(modeTxt) + '</div>' +
      '<div class="kmUserGrantActions">' +
      '<button type="button" data-km-usr="editUser" data-id="' + esc(u.id) + '">Էջերի իրավունքներ</button>' +
      '<button type="button" data-km-usr="newCode" data-id="' + esc(u.id) + '">Նոր կոդ</button>' +
      '<button type="button" data-km-usr="delUser" data-id="' + esc(u.id) + '">Ջնջել</button>' +
      '</div></div>';
  }
  function deletedUserRowHtml(u) {
    var when = u.deletedAt ? new Date(u.deletedAt).toLocaleString('hy-AM') : '—';
    return '<tr>' +
      '<td><b>' + esc(u.fullName || 'Օգտատեր') + '</b>' +
      (u.unitKod ? ('<div class="muted" style="font-size:11px">Կոդ՝ ' + esc(u.unitKod) + '</div>') : '') +
      '<div class="muted" style="font-size:11px">Հեռացված՝ ' + esc(when) + '</div></td>' +
      '<td>' +
      '<div style="display:flex;flex-direction:column;gap:6px;align-items:stretch;min-width:160px">' +
      '<button type="button" class="primary" data-km-usr="restoreUser" data-id="' + esc(u.id) + '">Վերականգնել + կոդ</button>' +
      '<button type="button" data-km-usr="purgeDeleted" data-id="' + esc(u.id) + '" style="color:#8b0000">Վերջնական ջնջել</button>' +
      '</div></td></tr>';
  }
  function paintUsersOrgLists(root) {
    if (!root) return;
    var pick = readUsersOrgPick();
    var all = window._kmAllUsersList || [];
    var allDel = window._kmAllDeletedUsers || [];
    var ready = !!(pick.corpsId && pick.unitId);
    var shown = ready ? all.filter(function (u) { return userMatchesOrg(u, pick.corpsId, pick.unitId); }) : [];
    var shownDel = ready ? allDel.filter(function (u) { return userMatchesOrg(u, pick.corpsId, pick.unitId); }) : [];
    window._kmLastUsersList = shown;
    var cards = root.querySelector('#kmUsersCards');
    if (cards) {
      cards.innerHTML = !ready
        ? '<p class="muted" style="grid-column:1/-1">Ընտրեք բանակային կորպուսը և զորամասը՝ տեսնելու այդ զորամասի կոդով գրանցված զինծառայողներին։</p>'
        : (shown.map(userCardHtml).join('') || '<p class="muted" style="grid-column:1/-1">Այս զորամասում գրանցված օգտատեր չկա։</p>');
    }
    var delBody = root.querySelector('#kmUsersDeletedBody');
    if (delBody) {
      delBody.innerHTML = !ready
        ? '<tr><td colspan="2" class="muted">Նախ ընտրեք կորպուսը և զորամասը։</td></tr>'
        : (shownDel.map(deletedUserRowHtml).join('') || '<tr><td colspan="2" class="muted">Հեռացված օգտատեր չկա այս զորամասում</td></tr>');
    }
    var hint = root.querySelector('#kmUsersCountHint');
    if (hint) {
      hint.innerHTML = ready
        ? ('Այս զորամասում՝ <b>' + esc(String(shown.length)) + '</b> գրանցված զինծառայող։ Սեղմեք օգտատիրոջ վրա՝ անձնական էջը բացելու համար։')
        : 'Նախ ընտրեք կորպուսը, ապա զորամասը։ Ցուցակում երևում են միայն այդ զորամասի txt կոդով գրանցվածները։';
    }
    var addBox = root.querySelector('#kmUsrAddBox');
    if (addBox) addBox.style.opacity = ready ? '1' : '0.55';
    var addBtn = root.querySelector('[data-km-usr="addUser"]');
    if (addBtn) addBtn.disabled = !ready;
  }
  function bindUsersOrgPicker(root) {
    if (!root) return;
    var wrap = root.querySelector('#kmUsersOrgPick');
    if (!wrap) return;
    var corpsSel = wrap.querySelector('#kmUsersPickCorps');
    var unitSel = wrap.querySelector('#kmUsersPickUnit');
    if (!corpsSel || !unitSel) return;
    if (corpsSel.__kmBound) return;
    corpsSel.__kmBound = true;
    corpsSel.addEventListener('change', function () {
      var cid = String(corpsSel.value || '');
      writeUsersOrgPick(cid, '');
      setTimeout(function () {
        if (!unitSel.isConnected) return;
        fillUnitSelectOptions(unitSel, cid, '');
        paintUsersOrgLists(root);
      }, 0);
    });
    unitSel.addEventListener('change', function () {
      writeUsersOrgPick(corpsSel.value, unitSel.value);
      paintUsersOrgLists(root);
    });
  }

  /** Առանձին էջ՝ օգտատերերի էջերի կառավարում */
  window.kmOpenUsersAdmin = async function (opts) {
    /* KM_ADMIN_PANELS_OPEN_SAFE_V1 */
    try {
    /* KM_ADMIN_PAINT_FIRST_V1 — show something immediately so home dashboard cannot linger */
    (function(){
      var h = document.getElementById('content');
      if (!h) return;
      if (h.querySelector('#kmUsersRoot') && !h.querySelector('[data-km-admin-panel-loading]')) return;
      h.innerHTML = '<div class="card" id="kmUsersRoot" data-km-admin-panel-loading="1"><p class="muted" style="margin:8px 0">Բեռնվում է վահանակը…</p></div>';
    })();


    opts = opts || {};
    var ctx = await prepareAdminStore();
    /* KM_ADMIN_CTX_NULL_V1 */
    if (!ctx) {
      var hNull = document.getElementById('content');
      if (hNull) hNull.innerHTML = '<div class="card" id="kmUsersRoot"><b>Վահանակը հասանելի չէ։</b><p class="muted">Սեսիան կամ content-ը բացակայում է։</p></div>';
      return;
    }

    var users = [];
    try {
      users = (ctx && Array.isArray(ctx.users)) ? ctx.users : [];
    } catch (_u) { users = []; }
    window._kmAllUsersList = users;
    window._kmAllDeletedUsers = (ctx.deletedUsers || []).slice();
    window._kmLastUsersList = users;
    var pick = readUsersOrgPick();
    var existing = document.getElementById('kmUsersRoot');
    if (opts.soft && existing && ctx.host.contains(existing) && String(window.page || '') === 'users') {
      bindUsersOrgPicker(existing);
      try {
        var ae = document.activeElement;
        var picking = ae && (ae.id === 'kmUsersPickCorps' || ae.id === 'kmUsersPickUnit' || (ae.closest && ae.closest('#kmUsersOrgPick')));
        if (!picking) {
          var unitSel = existing.querySelector('#kmUsersPickUnit');
          var corpsSel = existing.querySelector('#kmUsersPickCorps');
          if (corpsSel && String(corpsSel.value || '') !== String(pick.corpsId || '')) corpsSel.value = pick.corpsId || '';
          fillUnitSelectOptions(unitSel, pick.corpsId, pick.unitId);
        }
      } catch (eS) {}
      paintUsersOrgLists(existing);
      return;
    }

    ctx.host.innerHTML =
      '<div class="card" id="kmUsersRoot">' +
      (typeof window.kmBackToolbar === 'function' ? window.kmBackToolbar("kmOpenPage('home')") : '') +
      '<h3 style="margin:0 0 6px">Օգտատերերի էջերի կառավարման վահանակ</h3>' +
      (ctx.loadError
        ? ('<p style="margin:0 0 12px;padding:10px 12px;border-radius:8px;background:#fdecea;color:#8a1f11;font-size:13px">' + esc(ctx.loadError) + '</p>')
        : '') +
      usersOrgPickerHtml(pick) +
      '<p class="muted" id="kmUsersCountHint" style="margin:0 0 14px;font-size:13px"></p>' +
      '<div class="card" id="kmUsrAddBox" style="margin-bottom:12px;padding:12px;border:1px solid #d5e0ec;background:#f7f9fc">' +
      '<h4 style="margin:0 0 8px">Նոր օգտատեր այս զորամասում</h4>' +
      '<div style="margin-bottom:10px;padding:10px;border:1px solid #e2eaf1;border-radius:8px;background:#fff">' +
      '<div style="font-weight:700;margin-bottom:8px">Օգտատեր</div>' +
      '<div style="display:grid;gap:8px;grid-template-columns:1fr 1fr 1fr">' +
      '<label>Անուն<input id="kmUsrGiven" type="text" lang="hy" style="width:100%;margin-top:4px" placeholder="միայն հայատառ"></label>' +
      '<label>Ազգանուն<input id="kmUsrFamily" type="text" lang="hy" style="width:100%;margin-top:4px" placeholder="միայն հայատառ"></label>' +
      '<label>Հայրանուն<input id="kmUsrPatronymic" type="text" lang="hy" style="width:100%;margin-top:4px" placeholder="միայն հայատառ"></label>' +
      '</div>' +
      '<p class="muted" style="font-size:12px;margin:8px 0 0">Պարտադիր՝ Անուն, Ազգանուն և Հայրանուն՝ միայն հայատառ։</p>' +
      '</div>' +
      '<div style="display:grid;gap:8px;grid-template-columns:1fr 1fr auto;align-items:end">' +
      '<label>Մուտքանուն<input id="kmUsrName" type="text" style="width:100%;margin-top:4px" placeholder="լատինատառ և թվեր (մինչև 10 տառ և 6 թիվ)" autocomplete="off" spellcheck="false"></label>' +
      '<label>Գաղտնաբառ (ըստ ցանկության)<input id="kmUsrPassword" type="password" style="width:100%;margin-top:4px" placeholder="եթե լրացված է՝ անմիջապես մուտք" autocomplete="new-password"></label>' +
      '<button type="button" class="primary" data-km-usr="addUser">Ավելացնել</button>' +
      '</div>' +
      '<p class="muted" style="font-size:12px;margin:8px 0 0">Ավելացվում է ընտրված կորպուսի/զորամասի txt կոդով։ Եթե գաղտնաբառ եք դնում՝ մուտքանուն+գաղտնաբառ, դատարկ թողնելիս՝ մեկանգամյա կոդ։</p>' +
      '</div>' +
      '<div class="kmLawsGrid" id="kmUsersCards" data-km-cards="1" style="margin-bottom:8px"></div>' +
      '<h4 style="margin:18px 0 8px">Հեռացված օգտատերեր</h4>' +
      '<p class="muted" style="font-size:12px;margin:0 0 8px">Վերականգնելիս տրվում է նոր մեկանգամյա կոդ։ Ավտոմատ վերադարձ չի լինի։</p>' +
      '<div class="gridwrap"><table class="grid"><thead><tr><th>Հեռացված</th><th></th></tr></thead><tbody id="kmUsersDeletedBody"></tbody></table></div>' +
      '<div id="kmUsersDetail" style="margin-top:14px"></div>' +
      '</div>' +
      '<style id="km-users-grant-css">' +
      '.kmAdminOrgPick{display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;margin:0 0 12px;padding:10px 12px;background:#f4f7fa;border:1px solid #d5e0e8;border-radius:10px}' +
      '.kmAdminOrgPick label{flex:1;min-width:200px;font-size:12px;font-weight:700}' +
      '.kmAdminOrgPick select{width:100%;margin-top:4px;padding:8px 10px;box-sizing:border-box;font:inherit}' +
      '.kmUserGrantWrap{display:flex;flex-direction:column;min-width:0}' +
      '.kmUserGrantWrap .kmLawCard{width:100%}' +
      '.kmUserGrantActions{display:flex;flex-wrap:wrap;gap:6px}' +
      '.kmUserGrantActions button{padding:6px 10px;font-size:12px;border-radius:8px}' +
      '.kmGrantGroup{margin:0 0 14px}' +
      '.kmGrantGroupTitle{margin:0 0 8px;font-size:12px;font-weight:800;color:#0d4a66;text-transform:uppercase;letter-spacing:.03em;padding-bottom:4px;border-bottom:1px solid #e4ebe7}' +
      '.kmGrantGrid{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:10px!important;margin-bottom:0!important}' +
      '.kmGrantCard{min-height:78px!important;padding:12px 12px 20px!important}' +
      '.kmGrantCard .kmLawCardText{font-size:11.5px!important}' +
      grantMenuCss() +
      '#content .kmLawsGrid .kmGrantCard.is-selected,#content .kmGrantCard.is-selected,.kmGrantCard.is-selected{box-shadow:0 8px 20px rgba(26,143,160,.22),inset 0 0 0 2px #1a8fa0!important;background:#f0fafb!important}' +
      '#content .kmLawsGrid .kmGrantCard.is-selected:hover,#content .kmGrantCard.is-selected:hover,.kmGrantCard.is-selected:hover{box-shadow:0 8px 20px rgba(26,143,160,.22),inset 0 0 0 2px #1a8fa0!important;background:#f0fafb!important}' +
      '#content .kmLawsGrid .kmGrantCard.is-selected .kmLawCardText,.kmGrantCard.is-selected .kmLawCardText{color:#0a6a7a!important}' +
      '</style>';

    page = 'users';
    window.page = 'users';
    var pt = document.getElementById('pageTitle');
    if (pt) pt.textContent = 'Օգտատերերի էջերի կառավարման վահանակ';
    if (typeof window.kmApplyRoleGuard === 'function') try { window.kmApplyRoleGuard(); } catch (eG) {}
    var usersRoot = ctx.host.querySelector('#kmUsersRoot');
    bindUsersRoot(usersRoot, ctx.showSuper, window.kmOpenUsersAdmin);
    bindUsersOrgPicker(usersRoot);
    paintUsersOrgLists(usersRoot);
    bindHyWordInput(ctx.host.querySelector('#kmUsrGiven'));
    bindHyWordInput(ctx.host.querySelector('#kmUsrFamily'));
    bindHyWordInput(ctx.host.querySelector('#kmUsrPatronymic'));
    bindLatinUserInput(ctx.host.querySelector('#kmUsrName'));
  
    } catch (errSafe) {
      console.error('kmOpenUsersAdmin', errSafe);
      var h = document.getElementById('content');
      if (h) h.innerHTML = '<div class="card" id="kmUsersRoot"><b>Վահանակը բացել չհաջողվեց։</b><p class="muted">' +
        String(errSafe && errSafe.message ? errSafe.message : errSafe) + '</p></div>';
    }
  };;

  window.kmRefreshUsersAdminIfOpen = function (ev) {
    try {
      if (String(window.page || '') !== 'users') {
        /* KM_TOAST_NEW_USER_ONLY_V1 */
        /* KM_TOAST_CLIENT_REGISTER_ONLY_V2: ignore hub self-watch + non-merge events */
        try {
          if (ev && ev.usersUpdated && !ev.usersLocalChanged && ev.from === 'client' && ev.usersSync && ev.usersSync.merged && typeof toastMsg === 'function') {
            const cnt = Number(ev.usersCount) || (ev.usersSync && Number(ev.usersSync.users)) || 0;
            if (cnt > 0) {
              const names = (ev.usersSync && Array.isArray(ev.usersSync.userNames))
                ? ev.usersSync.userNames.map(String).sort().join('|')
                : (ev.newUserNames ? String(ev.newUserNames) : '');
              const fp = names || ('c:' + cnt);
              const now = Date.now();
              const prev = window.__kmUsersToastFp || '';
              const at = Number(window.__kmUsersToastAt || 0);
              // toast only when fingerprint of users changed (true new registration), debounce 15s
              if (fp && fp !== prev && (now - at) > 15000) {
                window.__kmUsersToastFp = fp;
                window.__kmUsersToastAt = now;
                toastMsg('Նոր օգտատեր գրանցվեց։ Բացեք Օգտատերերի էջերի կառավարում։', 'ok');
              } else if (!prev) {
                window.__kmUsersToastFp = fp;
                window.__kmUsersToastAt = now;
              }
            }
          }
        } catch (eT) {}
        return;
      }
      var ae = document.activeElement;
      if (ae && (ae.id === 'kmUsersPickCorps' || ae.id === 'kmUsersPickUnit' || (ae.closest && ae.closest('#kmUsersOrgPick')))) {
        return;
      }
      if (window.kmRefreshUsersAdminIfOpen._busy) return;
      var _nowR = Date.now();
      if ((_nowR - (window.kmRefreshUsersAdminIfOpen._at || 0)) < 8000) return;
      window.kmRefreshUsersAdminIfOpen._at = _nowR;
      window.kmRefreshUsersAdminIfOpen._busy = true;
      Promise.resolve(window.kmOpenUsersAdmin({ soft: true })).then(function () {
        window.kmRefreshUsersAdminIfOpen._busy = false;
      }).catch(function () {
        window.kmRefreshUsersAdminIfOpen._busy = false;
      });
    } catch (eR) {
      window.kmRefreshUsersAdminIfOpen._busy = false;
    }
  };


  /* KM_USER_ARCHIVES_V1 */
  function kmUserArchiveMatches(row, username, userId) {
    if (!row) return false;
    var un = String(username || '').trim().toLowerCase();
    var uid = String(userId || '').trim();
    var by = String(row.addedBy || row.modifiedBy || row.username || '').trim().toLowerCase();
    var id = String(row.userId || '').trim();
    if (uid && id && id === uid) return true;
    if (un && by && by === un) return true;
    return false;
  }
  function kmCollectUserArchives(username, userId) {
    var out = [];
    try {
      var raw = (typeof db !== 'undefined' && Array.isArray(db.archives)) ? db.archives : [];
      raw.forEach(function (a) {
        if (kmUserArchiveMatches(a, username, userId)) {
          out.push({ kind: 'schedule', section: 'Արխիվ', sub: a.label || a.id, name: a.label || a.id, at: a.createdAt || '', row: a });
        }
      });
    } catch (e1) {}
    try {
      var pos = (typeof db !== 'undefined' && Array.isArray(db.positionArchives)) ? db.positionArchives : [];
      pos.forEach(function (a) {
        if (a && !a.builtin && kmUserArchiveMatches(a, username, userId)) {
          out.push({
            kind: 'position',
            section: 'Հաշվառում / Շտատ',
            sub: (a.unitName || a.unitId || '') + (a.corpsName ? (' · ' + a.corpsName) : ''),
            name: a.name || a.id,
            at: a.addedAt || '',
            row: a
          });
        }
      });
    } catch (e2) {}
    out.sort(function (a, b) { return String(b.at || '').localeCompare(String(a.at || '')); });
    return out;
  }
  async function kmCollectUserLibraryFiles(username, userId) {
    var items = [];
    try {
      if (window.kmNative && window.kmNative.library && typeof window.kmNative.library.listByUser === 'function') {
        var r = await window.kmNative.library.listByUser({ username: username, userId: userId });
        if (r && r.ok && Array.isArray(r.items)) items = r.items;
      }
    } catch (eL) {}
    return items.map(function (f) {
      return {
        kind: 'file',
        section: 'Ֆայլերի պահոց', /* KM_MENU_REORG_V1 */
        sub: (f.folder || f.type || '') + (f.corpsId ? (' · ' + f.corpsId) : ''),
        name: f.displayName || f.name || f.id,
        at: f.addedAt || '',
        row: f
      };
    });
  }
  function kmRenderUserArchivesHtml(list, title) {
    var escFn = (typeof esc === 'function') ? esc : function (x) { return String(x || '').replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); };
    if (!list.length) {
      return '<p class="muted" style="margin:8px 0">Դեռ արխիվ/ֆայլ չկա այս օգտատիրոջից։</p>';
    }
    var bySec = {};
    list.forEach(function (it) {
      var k = it.section || 'Այլ';
      if (!bySec[k]) bySec[k] = [];
      bySec[k].push(it);
    });
    var html = '<div class="kmPersonalArchives" style="margin-top:18px"><h4 style="margin:0 0 8px">' + escFn(title || 'Անձնական արխիվներ') + '</h4>';
    Object.keys(bySec).forEach(function (sec) {
      html += '<details open style="margin:0 0 10px"><summary><b>' + escFn(sec) + '</b> (' + bySec[sec].length + ')</summary><ul style="margin:8px 0 0;padding-left:18px">';
      bySec[sec].forEach(function (it) {
        html += '<li style="margin:4px 0"><span class="muted" style="font-size:11px">' + escFn(it.sub || it.kind) + '</span> — <b>' + escFn(it.name) + '</b>' +
          (it.at ? (' <span class="muted" style="font-size:11px">· ' + escFn(String(it.at).slice(0, 19).replace('T', ' ')) + '</span>') : '') + '</li>';
      });
      html += '</ul></details>';
    });
    html += '<p class="muted" style="font-size:11px;margin:6px 0 0">Պահվում է մինչև ադմինը չհեռացնի։</p></div>';
    return html;
  }
  function kmPersonalIdentityHtml(usr) {
    var escFn = (typeof esc === 'function') ? esc : function (x) { return String(x || ''); };
    usr = usr || {};
    var rows = [
      ['Անուն ազգանուն հայրանուն', usr.fullName || [usr.givenName, usr.familyName, usr.patronymic].filter(Boolean).join(' ')],
      ['Զինգրքույկի համար', usr.militaryBookNo || '—'],
      ['Անձնագրի համար', usr.passportNo || '—'],
      ['Բանակային կորպուս', usr.corpsName || usr.corpsId || '—'],
      ['Զորամաս', usr.unitName || usr.unitId || '—'],
      ['Զորամասի կոդ', usr.unitKod || '—']
    ];
    var html = '<div class="kmPersonalId" style="display:grid;grid-template-columns:minmax(140px,180px) 1fr;gap:6px 14px;font-size:14px">';
    rows.forEach(function (r) {
      html += '<div class="muted">' + escFn(r[0]) + '</div><div><b>' + escFn(r[1] || '—') + '</b></div>';
    });
    html += '</div>';
    return html;
  }
  function kmActionLabel(a) {
    if (typeof window.kmActionHy === 'function') {
      var hy = window.kmActionHy(a);
      if (hy && hy !== a) return hy.charAt(0).toUpperCase() + hy.slice(1);
    }
    var s = String(a || '');
    if (s === 'register' || s === 'user-self-register') return 'Գրանցում';
    if (s === 'login' || s === 'user-login') return 'Մուտք';
    if (s === 'file-add' || s === 'add') return 'Ավելացրել է';
    if (s === 'file-delete' || s === 'delete') return 'Ջնջել է';
    if (s === 'remove') return 'Հեռացրել է';
    if (s === 'attach') return 'Կցել է';
    if (s === 'vacant') return 'Դարձրել է թափուր';
    if (s === 'change' || s === 'file-change') return 'Փոփոխել է';
    if (s === 'open' || s === 'file-open') return 'Ֆայլի բացում';
    if (s === 'save') return 'Պահպանել է';
    return s || 'Գործողություն';
  }
  function kmRenderActivityHtml(list) {
    var escFn = (typeof esc === 'function') ? esc : function (x) { return String(x || ''); };
    if (!list || !list.length) {
      return '<p class="muted" style="margin:8px 0">Դեռ գործողություն չի գրանցվել։</p>';
    }
    var html = '<div class="kmUserActivity" style="margin-top:8px;max-height:420px;overflow:auto;border:1px solid #d5e0ec;border-radius:10px;background:#fff">';
    html += '<table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="background:#f4f7fa;text-align:left">' +
      '<th style="padding:8px">Ժամանակ</th><th style="padding:8px">Գործողություն</th><th style="padding:8px">Մանրամասն</th></tr></thead><tbody>';
    list.forEach(function (it) {
      var when = typeof window.kmFormatWhen === 'function'
        ? window.kmFormatWhen(it.ts || it.at)
        : String(it.ts || it.at || '').slice(0, 19).replace('T', ' ');
      var det = it.detail || it.file || it.sectionLabel || it.name || '';
      html += '<tr style="border-top:1px solid #eef2f6"><td style="padding:7px 8px;white-space:nowrap;color:#5a6a7a">' + escFn(when) +
        '</td><td style="padding:7px 8px">' + escFn(kmActionLabel(it.action)) +
        '</td><td style="padding:7px 8px">' + escFn(det) + (it.file && it.file !== det && det.indexOf(it.file) < 0 ? (' · ' + escFn(it.file)) : '') + '</td></tr>';
    });
    html += '</tbody></table></div>';
    return html;
  }
  async function kmCollectUserActivity(usr) {
    var un = String((usr && usr.username) || '').trim();
    var uid = String((usr && (usr.id || usr.userId)) || '').trim();
    var items = [];
    var seen = Object.create(null);
    function add(list) {
      (list || []).forEach(function (x) {
        if (!x) return;
        if (typeof window.kmIsRealChangeLog === 'function' && !window.kmIsRealChangeLog(x)) return;
        var k = [x.ts || x.at, x.action, x.detail || x.file || x.name].join('|');
        if (seen[k]) return;
        seen[k] = 1;
        items.push(x);
      });
    }
    try {
      if (window.kmNative && window.kmNative.users && window.kmNative.users.listActivity) {
        var act = await window.kmNative.users.listActivity({
          adminToken: adminToken(),
          userId: uid,
          username: un,
          limit: 400
        });
        if (act && act.ok) add(act.items);
      }
    } catch (eA) {}
    try {
      if (window.kmNative && window.kmNative.hishoxutyun && window.kmNative.hishoxutyun.list) {
        var listed = await window.kmNative.hishoxutyun.list({ query: un, limit: 200 });
        var rows = (listed && listed.rows) || [];
        add(rows.filter(function (r) {
          return r && (String(r.userId || '') === uid || String(r.user || '').toLowerCase() === un.toLowerCase());
        }).map(function (r) {
          return {
            ts: r.ts,
            action: r.action,
            detail: (r.sectionLabel || r.section || '') + (r.detail ? (' · ' + r.detail) : ''),
            file: r.detail || '',
            real: r.real,
            sectionLabel: r.sectionLabel,
            section: r.section,
            subsectionLabel: r.subsectionLabel
          };
        }));
      }
    } catch (eH) {}
    items.sort(function (a, b) { return String(b.ts || b.at || '').localeCompare(String(a.ts || a.at || '')); });
    return items;
  }
  window.kmOpenUserArchivesAdmin = async function (usr) {
    return window.kmOpenUserPersonalAdmin(usr);
  };
  window.kmOpenUserPersonalAdmin = async function (usr) {
    usr = usr || {};
    var host = document.getElementById('content');
    if (!host) return;
    var un = String(usr.username || '').trim();
    var uid = String(usr.id || usr.userId || '').trim();
    var full = String(usr.fullName || un).trim();
    var token = 'up_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
    window._kmUserPersonalToken = token;
    var arch = kmCollectUserArchives(un, uid);
    page = 'user-personal';
    window.page = 'user-personal';
    var pt = document.getElementById('pageTitle');
    if (pt) pt.textContent = 'Անձնական էջ';
    host.innerHTML = '<div class="card" id="kmUserPersonalRoot" data-token="' + token + '" style="padding:16px"><!-- KM_USER_PERSONAL_ADMIN_V2 -->' +
      (typeof window.kmBackToolbar === 'function' ? window.kmBackToolbar("kmOpenUsersAdmin()") : '') +
      '<h3 style="margin:0 0 6px">' + (typeof esc === 'function' ? esc(full) : full) + '</h3>' +
      '<p class="muted" style="margin:0 0 14px;font-size:12px">Արխիվը տեսանելի է միայն սուպեր ադմինին</p>' +
      kmPersonalIdentityHtml(usr) +
      '<h4 style="margin:18px 0 6px">Գործողությունների արխիվ</h4>' +
      '<p class="muted" style="margin:0 0 8px;font-size:12px">Միայն պահպանված փոփոխությունները</p>' +
      '<div id="kmUserPersonalActivity"><p class="muted" style="margin:8px 0">Բեռնվում է…</p></div>' +
      '<div id="kmUserPersonalFiles">' + kmRenderUserArchivesHtml(arch, 'Ֆայլեր և արխիվներ') + '</div>' +
      '</div>';
    function stillHere() {
      return window._kmUserPersonalToken === token && host.querySelector('#kmUserPersonalRoot[data-token="' + token + '"]');
    }
    try {
      var files = await kmCollectUserLibraryFiles(un, uid);
      if (stillHere()) {
        var filesBox = host.querySelector('#kmUserPersonalFiles');
        if (filesBox) filesBox.innerHTML = kmRenderUserArchivesHtml(arch.concat(files), 'Ֆայլեր և արխիվներ');
      }
    } catch (eF) {}
    try {
      var activity = await kmCollectUserActivity(usr);
      if (stillHere()) {
        var actBox = host.querySelector('#kmUserPersonalActivity');
        if (actBox) actBox.innerHTML = kmRenderActivityHtml(activity);
      }
    } catch (eA) {
      if (stillHere()) {
        var actErr = host.querySelector('#kmUserPersonalActivity');
        if (actErr) actErr.innerHTML = '<p class="muted" style="margin:8px 0">Գործողությունները չհաջողվեց բեռնել։</p>';
      }
    }
  };

    /* KM_USER_PERSONAL_PHOTO_V1 */
  window.kmOpenPersonalSection = async function () {
    var host = document.getElementById('content');
    if (!host) return;
    page = 'personal';
    window.page = 'personal';
    try { if (typeof kmSetActiveNav === 'function') kmSetActiveNav(document.querySelector('.nav[data-page="personal"]')); } catch (eN) {}
    var un = '';
    var uid = '';
    var full = '';
    var profile = {};
    try {
      un = String(window.kmAuthUsername || sessionStorage.getItem('km_auth_username') || '').trim();
      uid = String(window.kmAuthUserId || sessionStorage.getItem('km_auth_user_id') || '').trim();
      full = String(window.kmAuthFullName || sessionStorage.getItem('km_auth_fullname') || un || '').trim();
    } catch (eA) {}
    if (!un && window.kmUserRole === 'admin') {
      un = 'Koryun1992';
      full = 'Administrator';
    }
    try {
      if (un && window.kmNative && window.kmNative.users && window.kmNative.users.ensure) {
        var ens = await window.kmNative.users.ensure({ username: un });
        if (ens && ens.ok && ens.user) {
          profile = ens.user;
          uid = ens.user.id || uid;
          full = ens.user.fullName || full;
        }
      }
    } catch (eEns) {}
    if (!profile.username) {
      profile = window.kmAuthUserOrg ? Object.assign({ username: un, fullName: full, id: uid }, window.kmAuthUserOrg) : { username: un, fullName: full, id: uid };
    }
    function photoIdFor(u, id) {
      var base = String(id || u || 'user').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || 'user';
      return 'appuser_' + base;
    }
    var photoId = photoIdFor(un, uid);
    var photoSrc = 'kmphoto://' + photoId + '?t=' + Date.now();
    var savedMap = {};
    try {
      if (window.kmNative && window.kmNative.settings && window.kmNative.settings.get) {
        var st = await window.kmNative.settings.get();
        savedMap = (st && st.userProfilePhotos && typeof st.userProfilePhotos === 'object') ? st.userProfilePhotos : {};
        if (savedMap[un] || savedMap[photoId]) {
          photoId = savedMap[un] || savedMap[photoId] || photoId;
          photoSrc = 'kmphoto://' + photoId + '?t=' + Date.now();
        }
      }
    } catch (eS) {}
    host.innerHTML =
      '<div class="card" id="kmPersonalRoot"><!-- KM_USER_PERSONAL_PHOTO_V1 -->' +
      '<h3 style="margin-top:0">Անձնական բաժին</h3>' +
      '<p class="muted" style="margin:0 0 14px">Ձեր պրոֆիլը և լուսանկարը · պահվում է այս PC-ի UserData-ում</p>' +
      '<div style="display:flex;gap:18px;flex-wrap:wrap;align-items:flex-start">' +
        '<div style="width:140px;text-align:center">' +
          '<div style="width:120px;height:120px;border-radius:16px;overflow:hidden;border:1px solid #c5d0dc;background:#f4f7fa;margin:0 auto 8px;display:flex;align-items:center;justify-content:center">' +
            '<img id="kmPersonalPhotoImg" src="' + photoSrc + '" alt="" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display=\'none\';this.parentNode.querySelector(\'.kmPersonalPhPh\').style.display=\'flex\'">' +
            '<div class="kmPersonalPhPh" style="display:none;color:#89a;font-size:12px;padding:8px">Լուսանկար չկա</div>' +
          '</div>' +
          '<button type="button" id="kmPersonalPhotoBtn" class="primary" style="width:100%">Ընտրել լուսանկար</button>' +
          '<input id="kmPersonalPhotoFile" type="file" accept="image/jpeg,image/png,image/webp" style="display:none">' +
          '<p id="kmPersonalPhotoErr" style="color:#a43;min-height:18px;font-size:12px;margin:6px 0 0"></p>' +
        '</div>' +
        '<div style="flex:1;min-width:220px">' +
          kmPersonalIdentityHtml(Object.assign({ username: un, fullName: full, id: uid }, profile)) +
          '<p class="muted" style="font-size:12px;margin:12px 0 0">JPG / PNG / WEBP · մինչև ~2 ՄԲ</p>' +
        '</div>' +
      '</div></div>';
    var err = host.querySelector('#kmPersonalPhotoErr');
    var img = host.querySelector('#kmPersonalPhotoImg');
    var fileInp = host.querySelector('#kmPersonalPhotoFile');
    var btn = host.querySelector('#kmPersonalPhotoBtn');
    if (btn && fileInp) {
      btn.onclick = function () { fileInp.click(); };
      fileInp.onchange = function () {
        var f = fileInp.files && fileInp.files[0];
        if (!f) return;
        if (!/^image\/(jpeg|jpg|png|webp)$/i.test(f.type)) {
          if (err) err.textContent = 'Թույլատրվում է միայն JPG/PNG/WEBP';
          return;
        }
        if (f.size > 2 * 1024 * 1024) {
          if (err) err.textContent = 'Նկարը չափազանց մեծ է (մաքս 2 ՄԲ)';
          return;
        }
        var reader = new FileReader();
        reader.onload = async function () {
          try {
            if (!window.kmNative || !window.kmNative.photo || !window.kmNative.photo.save) {
              if (err) err.textContent = 'Լուսանկարի պահպանումը հասանելի չէ';
              return;
            }
            var dataUrl = String(reader.result || '');
            var r = await window.kmNative.photo.save({ id: photoId, dataUrl: dataUrl });
            if (!r || !r.ok) {
              if (err) err.textContent = (r && r.error) || 'Պահպանումը ձախողվեց';
              return;
            }
            photoId = r.id || photoId;
            try {
              savedMap[un] = photoId;
              if (window.kmNative.settings && window.kmNative.settings.set) {
                await window.kmNative.settings.set({ userProfilePhotos: savedMap });
              }
            } catch (eSave) {}
            if (img) {
              img.style.display = '';
              img.src = 'kmphoto://' + photoId + '?t=' + Date.now();
            }
            if (err) err.textContent = '';
            if (typeof toastMsg === 'function') toastMsg('Լուսանկարը պահվեց', 'ok');
            else if (typeof window.toast === 'function') window.toast('Լուսանկարը պահվեց');
          } catch (eUp) {
            if (err) err.textContent = (eUp && eUp.message) || 'Սխալ';
          }
        };
        reader.readAsDataURL(f);
      };
    }
    /* Գործողությունների արխիվը տեսնում է միայն սուպեր ադմինը՝ օգտատիրոջ անձնական էջից */

  };

})();
