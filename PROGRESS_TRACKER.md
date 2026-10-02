# KM — Ամբողջական տող-առ-տող վերանայման tracker

Legend: ⬜ չսկսված | 🔶 մասնակի (անվտանգության տեսանկյունից արդեն ստուգված այս զրույցում) | ✅ ամբողջական տող-առ-տող ավարտված

## BACKEND (app/*.js) — priority՝ մեծից փոքր

- 🔶 main.js (4124 տող) — IPC handler-ների մեծ մասը անվտանգության տեսանկյունից ստուգված, ամբողջական տող-առ-տող՝ ոչ
- 🔶 km_backend.js (2961) — auth/security/settings հատվածները ամբողջական ստուգված, մնացածը՝ ոչ
- ⬜ km_library.js (2345) — displayName ֆիքսը միայն, մնացածը չստուգված
- 🔶 km_bot_knowledge.js (2290) — structure ստուգված, տող-առ-տող՝ ոչ
- ⬜ km_lan_sync.js (2089) — encryption/hub push ստուգված, մնացածը՝ ոչ
- 🔶 km_net.js (1522) — auth/encryption ամբողջական ստուգված
- 🔶 km_bot_rag.js (1003) — web fallback/pagination ստուգված, մնացածը՝ ոչ
- ⬜ km_pdf_translate.js (759)
- ⬜ office_backend.js (676)
- ✅ km_conversations.js (525) — ամբողջական վերանայված և ֆիքսված
- 🔶 km_owner_vault.js (465) — key architecture ստուգված
- ⬜ km_pdf_text.js (450)
- 🔶 km_help_bot_core.js (435) — ask() հոսքը ստուգված
- ⬜ km_shtatka.js (354)
- ✅ km_domain_router.js (352) — ամբողջական վերանայված և ֆիքսված
- 🔶 preload.js (344) — API surface ստուգված
- ⬜ km_text_clean.js (328)
- ✅ km_guard.js (324) — ամբողջական վերանայված և ֆիքսված
- ⬜ km_ops_logic.js (319)
- ⬜ km_fonts.js (301)
- ✅ km_edge_tts.js (285) — ամբողջական վերանայված, մաքուր (SSML escaping ճիշտ)
- ✅ km_license.js (262) — ամբողջական վերանայված և ֆիքսված
- ✅ km_sqlite_bridge.js (259) — ամբողջական վերանայված, minor env-hardening ֆիքս
- ✅ km_app_users_sync.js (203) — ամբողջական վերանայված, կրիտիկական trust-model նշում
- ✅ km_crypto_store.js (197) — ամբողջական վերանայված և ֆիքսված
- ✅ km_gemini_config.js (190) — ամբողջական վերանայված և ֆիքսված
- ✅ km_retention.js (187) — ամբողջական վերանայված, կրիտիկական ֆիքս
- ✅ km_sqlite_worker.js (123) — ամբողջական վերանայված, low-risk նշում
- ✅ km_recovery.js (106) — նոր ֆայլ, ամբողջական
- ✅ km_install_secret.js (93) — նոր ֆայլ, ամբողջական
- ✅ km_secrets_load.js (63) — ամբողջական վերանայված
- ⬜ km_version.js (58)
- ✅ km_security_secrets.js (27) — ամբողջական վերանայված

## RENDERER (app/js/*.js)

- 🔶 km-help-bot.js (6528) — chat rendering/escaping ստուգված
- ⬜ km-i18n-extra.js (3217)
- 🔶 km-library-ui.js (3099) — escaping ստուգված
- ⬜ km-positions.js (2961) — red-flag scan միայն
- ⬜ km-spreadsheet.js (2610)
- ⬜ km-unit-tools.js (2524) — մասնակի escaping scan
- ✅ km-help-bot-llm.js (2278) — ամբողջական վերանայված և ֆիքսված (key proxy)
- ⬜ km-org-context.js (1986) — red-flag scan միայն
- ⬜ km-extensions.js (1949) — escaping spot-check
- ⬜ km-sysinfo-ui.js (1511) — red-flag scan միայն
- ⬜ km-v3-core.js (1416)
- ⬜ km-net-ui.js (1318) — red-flag scan միայն
- ⬜ km-auth-ui.js (1305)
- ⬜ km-users-ui.js (1213)
- ⬜ km-person-dossiers.js (1084) — red-flag scan միայն
- ⬜ km-extra-tools.js (1047)
- ⬜ km-troop-structure.js (1035) — red-flag scan միայն
- ⬜ km-trial-lab.js (951)
- 🔶 km-license-ui.js (929) — ֆիքսված 1 կետ
- ⬜ km-ops.js (925)
- ⬜ km-v3-ext.js (857) — key-count fix
- ⬜ km-notes-calendar.js (700)
- ⬜ km-section-upgrades.js (638)
- ⬜ km-person-linked.js (594)
- ⬜ km-discipline-penalties.js (529)
- ⬜ km-features.js (474)
- ⬜ km-formal.js (355)
- ⬜ km-soldier-rights.js (342) — red-flag scan միայն
- 🔶 km-help-bot-shield.js (342) — sanitizer ստուգված
- ⬜ km-v3-tools.js (319)
- ⬜ km-lan-client.js (271)
- ⬜ km-hishoxutyun.js (232)
- ⬜ km-bg-slideshow.js (165)
- ⬜ km-auto-focus.js (92)
- ⬜ km-display-compat.js (46)
- ⬜ km-shtat-catalog-data.js (39)
- ⬜ km-services.js (27)
- ⬜ km-error-log.js (23)

## HTML
- 🔶 index.html (9089) — esc() consistency ֆիքսված, մնացածը՝ ոչ

## Ընթացիկ քայլ
Սկսում ենք index.html-ից կամ main.js-ից՝ ամենամեծից, ամենակենտրոնականից։

## Ուղղված այս փուլում (line-by-line վերանայումից)

2. **km_retention.js — arbitrary file write (ԿՐԻՏԻԿԱԿԱՆ, ուղղված և թեստավորված)**.
   `ingestRemote()`-ը ընդունում էր `meta.originalAbs`/`meta.rel`-ը **անփոփոխ**
   հեռակա peer-ից (via `/km/hub/retain`, ավտենտիկացված, բայց peer-ը կարող
   էր ցանկացած absolute path դնել)։ `restore()`-ը հետո ուղղակիորեն գրում
   էր այդ path-ում՝ **առանց validation-ի** — arbitrary file write, որով
   attacker (ով գիտի LAN code-ը) կարող էր ֆայլ գրել, օրինակ, Windows
   Startup պանակում, երբ admin-ը restore սեղմեր։ Ուղղված է երկու շերտով.
   (ա) `ingestRemote()` այլևս երբեք չի պահում remote-ից եկած absolute
   path-ը որպես restore target, (բ) `restore()`-ն ինքն ունի անկախ
   defense-in-depth ստուգում՝ dest-ը պարտադիր պետք է լինի `userRoot`-ի
   ներսում։ Ամբողջությամբ ֆունկցիոնալ թեստավորված (legit local
   retain/restore դեռ աշխատում է, malicious remote path-ը ամբողջությամբ
   արգելափակված է)։


1. **km_version.js → guard timing**. `applyPendingKmUpdate()`-ը ճիշտ է
   (relaunch+exit updated ֆայլերով, ոչինչ չի կատարվում նույն պրոցեսում)։
   Բայց `kmGuard.verify()`-ն (main.js, ~4000 տող) կանչվում է **հետո**, քան
   մի քանի sensitive մոդուլների (`km_backend.js`, `km_net.js`,
   `km_library.js`, `km_pdf_translate.js`, `km_bot_rag.js`,
   `km_bot_knowledge.js`, `km_help_bot_core.js`) `require()`-ը, որոնք
   կատարվում են ավելի վաղ՝ ֆայլի սինխրոն parse-ի ընթացքում։ Update-ի
   endpoint-ներն իրենք արդեն ճիշտ ավտենտիկացված են (`allowRemote()+
   checkCode()`), ուստի սա ցածր-հավանական, բայց իրական hardening-բաց է։
   **Պահանջում է Electron lifecycle փոփոխություն, որը ես թեստավորել
   չեմ կարող** (no Windows/display access) — չեմ ուղղել կույր։


3. **km_sqlite_worker.js — 'exec' op-ը ընդունում է raw SQL** (ի տարբերություն
   parameterized get/all-ի)։ Ցածր ռիսկ, քանի որ connection-ը `readOnly:true`
   + `PRAGMA query_only=ON` է, ուստի SQLite-ի մակարդակում գրություն/DDL
   անհնար է։ Չուղղված (ցածր առաջնահերթություն), արժե ստուգել կանչողին
   (`km_bot_knowledge.js`) fully. Ապագայում կարելի է `exec`-ը հանել կամ
   սահմանափակել՝ լրացուցիչ ամրապնդման համար։

4. **km_app_users_sync.js — password-hash merge-ի vulnerability** (փաստագրված,
   ՉՈՒՂՂՎԱԾ, պահանջում է Ձեր architecture-որոշումը). `mergeUser()`-ի
   timestamp-based conflict-resolution-ը (որով որոշվում է, թե որ կողմի
   `passwordHash`-ը հաղթում է, երբ 2 մեքենա LAN-ով sync են անում)
   **gameable է attacker-ի կողմից**, ով already գիտի LAN access code-ը.
   նա կարող է ուղարկել կեղծ user/admin record ապագայի `updatedAt`
   timestamp-ով, և իր ընտրած `passwordHash`-ը կընդունվի որպես «ավելի նոր»,
   overwrite-ելով իրական օգտագործողի գաղտնաբառը (account takeover)։
   `mergeAdmins()`-ը էլ ավելի ուղղակի է. incoming admin-ի դաշտերն
   **անվերապահորեն** overwrite են անում local admin-ի դաշտերը, timestamp
   ստուգում իսկ չկա։

   **Ինչու չեմ ուղղել**. Այս merge-մեխանիզմն ինքը միտումնավոր է
   (comment-ը՝ "Union of users so LAN last-write-wins cannot drop a
   just-registered account") և հավանաբար legitimate multi-machine password
   sync-ի հիմքն է։ Timestamp-ի փոխարեն ավելի ամուր մեխանիզմ (cryptographic
   timestamping, կամ super-admin հաստատում password-փոփոխության merge-ի
   համար) մեծ, առանձին design-որոշում է, որ ես չեմ կարող միակողմանի
   ընդունել՝ առանց իմանալու՝ արդյոք password-sync-ը իրապես անհրաժեշտ
   feature է Ձեր օգտագործման մոդելում, թե ոչ։

## Իրավաբանական անկյան մանրակրկիտ ստուգում (հատուկ հարցում)

Ամբողջական տող-առ-տող ստուգված.
- ✅ `km_library.js`-ի LAW_SECTIONS (45 բաժին) + validLawSection/listLaws/addLawsFile
  — **1 իրական տառասխալ ուղղված** (`acts_discipline`՝ «տույիեր» → «տույժեր»,
  հաստատված km-discipline-penalties.js-ի հետ խաչաձև ստուգումով)
- ✅ `km-soldier-rights.js` (342 տող, ամբողջական) — **1 defense-in-depth ֆիքս**
  (href-ի URL scheme validation, javascript: scheme-ի դեմ, ցածր ռիսկ քանի որ
  տվյալները bundled/trusted են)
- ✅ `km-discipline-penalties.js` (530 տող, ամբողջական) — մաքուր, լավ
  նախագծված (permission checks, PDF magic-byte validation, audit log,
  confirm dialogs)։ Մեկ code-quality նշում (`back` param-ի ուղղակի onclick
  interpolation) — ստուգված է, որ բոլոր 5 կանչի կետերում fixed/hardcoded է,
  ոչ user-controlled, ուստի ներկայումս exploitable չէ. unreachable, չեմ
  ուղղել։

## ՀՀ Սահմանադրություն և Օրենսգրքեր բաժնի հատուկ հարցում (Ձեր report-ի հիման վրա)

Երկու իրական, կոնկրետ bug գտնվեց և ուղղվեց, որոնք միասին ամբողջությամբ
բացատրում են ախտանիշները («չի պահպանվում» + «կրկնվում է»).

1. **Ֆայլերի փոխանցումը IPC-ով որպես հսկա plain array** (`[...bytes]`).
   Չափված է կոնկրետ թվերով. 15ՄԲ ֆայլի համար (իրատեսական օրենսգրքի
   PDF-ի չափ) հին եղանակը վերցնում էր **3.2+ վայրկյան** և **120ՄԲ
   հիշողություն** (8x ուռճացում) զուտ conversion-ի overhead-ի համար,
   ինչը մեծ/դանդաղ մեքենաների վրա շատ հավանական է timeout/hang
   պատճառ դառնում, ինչը թվում է, թե «չի պահպանվում»։ Ուղղված է **5
   տեղում** (`km-library-ui.js`) ընդհանուր, օրենքների, և fonts
   upload-ի բոլոր ուղիներում. Uint8Array-ն այժմ փոխանցվում է ուղղակի,
   ինչը main.js-ի `Buffer.from()`-ը արդեն ճիշտ էր ընդունում։

2. **Duplicate-detection ընդհանրապես չկար** ո՛չ `addLawsFile()`-ում, ո՛չ
   ընդհանուր `addFile()`-ում — ամեն upload/retry ստեղծում էր նոր entry
   նոր random ID-ով, նույնիսկ բացարձակապես նույն բովանդակության համար։
   Սա ուղղակիորեն բացատրում է «կրկնվում են բավականին շատ ամեն
   բաժնում»-ը, հատկապես համակցված #1-ի հետ (slow/failed-looking
   upload-ը դրդում էր օգտագործողներին կրկին-կրկին փորձել)։ Ուղղված է՝
   ավելացնելով content-hash (SHA-256) based dedup, որը վերադարձնում է
   գոյություն ունեցող entry-ն՝ նոր չստեղծելով, եթե բովանդակությունը
   արդեն կա (նույն բաժնում/folder-ում/org-scope-ում)։ UI-ն այժմ ցույց
   է տալիս հստակ «արդեն կար N» հաղորդագրություն, որ օգտագործողը
   հասկանա՝ դա silent failure չէ։

Ամբողջությամբ ֆունկցիոնալ թեստավորված (առաջին upload, retry-ի
dedup, տարբեր folder/scope-ի ոչ-dedup, մեծ ֆայլի performance
չափում)։

## Ֆայլերի «կորստի» դեմ ամբողջական պաշտպանություն (Ձեր հաջորդ հարցումով)

Ընդլայնեցի արդեն գոյություն ունեցող `repairLawsLibrary()`-ն (որն արդեն
ավտոմատ գործարկվում է startup-ի ժամանակ) և ավելացրի նոր `repairLibrary()`
(ընդհանուր գրադարանի համար), որոնք **երկուսն էլ ավտոմատ գործարկվում են ամեն
անգամ ծրագիրը բացվելիս**.

- **Recovery ուղղություն** (նոր, երբեք գոյություն չուներ). scan է անում
  բոլոր բաժինների/type-երի իրական ֆայլերը disk-ի վրա, համեմատում index-ի
  հետ, և ցանկացած ֆայլ, որ կա disk-ի վրա բայց index-ում ոչ (crash/timing
  bug-ի հետևանք, ինչպիսին ուղղեցինք վերևում), **ավտոմատ վերականգնում է**
  index-ում՝ առանց ձեռքով միջամտության։
- **Purge ուղղություն** (արդեն գոյություն ուներ). index-ի entry, որի ֆայլը
  բացակայում է disk-ից, մարկվում է որպես deleted։
- Ճիշտ վերականգնում է section/type/folder/org-scope (corpsId/unitId/
  archiveRole) կառուցվածքը՝ ելնելով disk-ի directory structure-ից,
  ուստի ֆայլերն իրենց ճիշտ բաժիններում/ենթաբաժիններում են հայտնվում։
- Ամբողջությամբ ֆունկցիոնալ թեստավորված. laws recovery (flat), library
  recovery (nested org-scope), root-level recovery, և **idempotency**
  (կրկնակի repair-ը կրկնություն չի ստեղծում)։

## ARLIS scraping/duplication — արմատական պատճառը գտնված և ուղղված

Ձեր հարցումով խորացա ARLIS seeding տրամաբանության մեջ (`ensureArlisLaw`,
`seedOfficialCodes()` renderer-ում)։ Գտա **իրական TOCTOU race condition**,
որ իմ նախորդ content-hash dedup ֆիքսն ինքնին **չէր** լիովին փակում.

**Ապացուցված experiment-ով.** 2 միաժամանակյա, բացարձակապես նույնական
`addLawsFile()` կանչ (ինչպիսին տեղի կունենար, եթե «ՀՀ Սահմանադրություն և
օրենսգրքեր» էջը արագ բացվեր/նավարկվեր, կամ 2 seed-փորձ համընկներ)
**երկուսն էլ անցնում էին dedup ստուգումը** (քանի որ index-ի ընթերցումը
և գրառումը առանձին քայլեր էին, weiterhin race-ի ենթակա), ստեղծելով 2
կրկնօրինակ, ոչ 1։ Սա ճշգրիտ բացատրում է «Քաղաքացիական օրենսգիրք 4 անգամ
կրկնվում է» ախտանիշը (page-ի կրկնակի navigation/click-երից բազմապատկվող
race-եր ժամանակի ընթացքում)։

**Ուղղում** (3 շերտ).
1. `addLawsFile()`-ը այժմ **per-section mutex/queue**-ով է աշխատում
   (`withLawsSectionLock`) — dedup ստուգում + գրառում այժմ atomic է
   section-ի սահմաններում, ինչքան էլ concurrent կանչեր լինեն։
2. Ընդհանուր `addFile()`-ը նույնպես ստացավ իր **per-(type+folder+scope)
   mutex**-ը՝ նույն դասի race-ի դեմ ամբողջ գրադարանում։
3. `ensureArlisLaw()` (html/doc scrape քայլ) և `km:library:lawsEnsureArlis`
   IPC handler-ը (pdf-conversion քայլ) ստացան **section-keyed in-flight
   lock**՝ կանխելու համար, որ 2 page-navigation-ից եկած scrape-փորձեր
   ընդհանրապես սկսեն զուգահեռ աշխատել։

**Ամբողջությամբ ստուգված stress test-երով.**
- 2 concurrent identical → ճիշտ 1 entry (նախկինում՝ 2, հիմա ուղղված)
- 10 concurrent identical (stress) → ճիշտ 1 entry
- Concurrent, բայց **իրապես տարբեր** ֆայլեր → երկուսն էլ ճիշտ ավելացվում
  են (dedup-ը false-positive չի արգելափակում)
- Նույնը ստուգված ընդհանուր գրադարանի `addFile()`-ի համար (5 concurrent
  → ճիշտ 1 entry)

Սա, համակցված նախորդ 2 ուղղումների հետ (IPC performance fix + reconciliation/
recovery), պետք է ամբողջությամբ լուծի Ձեր նկարագրած «կրկնություն» և
«դատարկ ենթաբաժիններ» խնդիրները։ Recommendation. Deploy անելուց հետո
խորհուրդ եմ տալիս մեկ անգամ ձեռքով գործարկել repair/reconciliation-ը
(արդեն ավտոմատ աշխատում է startup-ում), որպեսզի առկա կրկնօրինակները
մաքրվեն — բայց repair-ը ներկայումս միայն **missing-file** entry-ներ է
մաքրում, ոչ թե already-persisted կրկնօրինակներ, ուստի եթե Դուք արդեն
ունեք երևացող կրկնօրինակներ, դրանք պետք է ձեռքով ջնջվեն admin UI-ից
մեկ անգամ. այս պահից հետո նոր կրկնօրինակ չեն ավելանա։

## LAN Hub sync — user registration և unit-kod-ի «անտեսանելիության» ախտորոշում

Ձեր նկարագրած ախտանիշը («Ֆայլերը/user-ները տեսանելի են LAN-ում, բայց
չեն սինխրոնիզացվում admin panel/unit-code ստուգմանը») հետևեց ցածր
մակարդակի root cause-ի.

**Գտածո.** Ամբողջ «hub» based sync-ը (`unit_kod` ֆայլերի, user-գրանցման
push-ի) կախված է հատուկ, **ձեռքով միացվող** կարգավորումից՝ **«Hub սերվեր
(այս համակարգիչ)»** checkbox-ը (Ցանց/Network էջում), որը պետք է
ակտիվացված լինի **ուղիղ մեկ** մեքենայի վրա։ Հիմնական LAN peer-discovery-ն
(«համակարգիչները իրար տեսնում են») **առանձին, ցածր-մակարդակի մեխանիզմ
է** (`km_net.js`) և ինքնին բավարար չէ hub-based sync-ի համար։ Եթե ոչ մի
մեքենայում այս checkbox-ը միացված չէ, `unit_kod`/user-registration-ի
sync-ը երբեք չի կատարվում, նույնիսկ եթե peer-discovery-ն կատարյալ
աշխատում է։

**Ուղղում** (diagnostic, ոչ թե ավտոմատ կարգավորում, քանի որ չեմ կարող
հեռակա միացնել Ձեր checkbox-ը).
1. `kmEnsureHubSync()`-ը նախկինում **միշտ լուռ** վերադարձնում էր
   `{ok:false}`՝ առանց պատճառի, և կանչողները նույնպես `try{}catch(_){}`-ով
   լուռ էին կուլ տալիս ամեն ինչ։ Այժմ վերադարձնում է կոնկրետ `error`
   պատճառաբանություն (`no_hub`, և այլն)։
2. `km:org:verifyUnitEntry` handler-ն այժմ ավելացնում է հասկանալի
   բացատրություն սխալի հաղորդագրությանը, երբ պատճառը sync-ի ձախողումն
   է, ոչ թե իրապես բացակայող կոդ։
3. `km:users:register`-ը այժմ վերադարձնում է `hubPushFailed`/
   `hubPushError`, և renderer-ը (`km-auth-ui.js`) ցույց է տալիս
   ոչ-արգելափակող toast նախազգուշացում, եթե գրանցումը հաջողվել է
   local-ում, բայց չի հասել hub-ին. «Ստուգեք, որ որևէ մեքենայում
   միացված է «Hub սերվեր»»։

**Ձեզանից անհրաժեշտ.** Ստուգեք Network/Ցանց էջում, թե որևէ մեքենայում
միացվա՞ծ է «Hub սերվեր (այս համակարգիչ)» checkbox-ը (սովորաբար պետք է
լինի admin-ի/գլխավոր մեքենայի վրա)։ Եթե ոչ մի տեղ միացված չէ, դա է
արմատական պատճառը. պետք է մեկ մեքենայում միացնել այն։
