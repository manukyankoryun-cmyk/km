/* KM — Offline/Online օգնական բոտ · տեղական Smart Engine (hy/ru/en) */
(function () {
  'use strict';

  var DATA = null;
  var ONLINE_EXTRA = null;
  var DATA_URL = 'data/km_help_bot.json';
  var ONLINE_URL = 'data/km_help_bot_online.json';
  var HISTORY = [];
  var CHAT_CLEARED_EPOCH = 0;
  var CHAT_RESTORE_BLOCKED = false;
  var MAX_HIST = 12;
  /** Do not restore prior sessions — Attestation-style: fresh panel, short in-session memory only. */
  var PERSIST_CHAT_MEMORY = false;
  var LAST_TOPIC = null;
  var LAST_TEACH = { topic: '', query: '' };
  var GREETED = false;
  var DIALOG = { mode: '', pending: '' }; // awaiting_topic | ''
  var CLARIFY_STREAK = 0;
  var LLM_STATUS = { mode: 'smart', label: '' }; // smart | llm | offline
  var ANSWERING = false;
  var ANSWER_GEN = 0;
  var LAST_CHARGED_GEN = 0;
  /* Session context — persisted in settings (helpBotMemory.chatMemory), not tied to 34-day training */
  var SESSION_CTX = { style: '', unit: '', facts: [], mood: 'neutral', formality: 'du', ongoing: false, lastTeachTopic: '' };
  var SAVE_CHAT_TIMER = null;
  var LAST_USER_Q = '';
  var LIVE_CORPUS_CACHE = { at: 0, rows: null, epoch: 0 };
  var KNOWLEDGE_EPOCH = 0;
  var DIALOG_FOCUS = { person: '', fileName: '', lawNum: '', topicId: '', lastQuery: '' };

  function invalidateBotKnowledge(reason) {
    LIVE_CORPUS_CACHE = { at: 0, rows: null, epoch: 0 };
    KNOWLEDGE_EPOCH = Date.now();
    try {
      if (LAST_TOPIC && LAST_TOPIC.id && String(LAST_TOPIC.id).indexOf('law_num_') === 0) {
        /* keep until re-verified on next ask */
      }
    } catch (e0) {}
    try {
      if (window.kmNative && window.kmNative.library && window.kmNative.library.bumpKnowledge) {
        window.kmNative.library.bumpKnowledge(reason || 'ui').catch(function () {});
      }
    } catch (e1) {}
  }
  window.kmHelpBotInvalidateKnowledge = invalidateBotKnowledge;

  /* ——— Ինքնուսուցում՝ բառապաշար DB-ում ——— */
  function loadLearnedVocab() {
    try {
      if (typeof db === 'undefined' || !db) return { words: {}, entities: {}, updatedAt: 0 };
      if (!db.helpBotLearn || typeof db.helpBotLearn !== 'object') {
        db.helpBotLearn = { words: {}, entities: {}, updatedAt: 0 };
      }
      if (!db.helpBotLearn.words || typeof db.helpBotLearn.words !== 'object') db.helpBotLearn.words = {};
      if (!db.helpBotLearn.entities || typeof db.helpBotLearn.entities !== 'object') db.helpBotLearn.entities = {};
      return db.helpBotLearn;
    } catch (e0) {
      return { words: {}, entities: {}, updatedAt: 0 };
    }
  }

  function absorbLearnedToken(tok, weight) {
    tok = norm(tok);
    if (!tok || tok.length < 3 || tok.length > 40) return;
    if (/^\d+$/.test(tok)) return;
    var store = loadLearnedVocab();
    var w = Number(store.words[tok]) || 0;
    store.words[tok] = Math.min(50, w + (Number(weight) || 1));
    store.updatedAt = Date.now();
    var keys = Object.keys(store.words);
    if (keys.length > 800) {
      keys.sort(function (a, b) { return (store.words[a] || 0) - (store.words[b] || 0); });
      keys.slice(0, keys.length - 600).forEach(function (k) { delete store.words[k]; });
    }
  }

  function absorbLearningFromText(text, weight) {
    tokens(text).forEach(function (t) { absorbLearnedToken(t, weight || 1); });
  }

  function absorbLearningFromHits(hits) {
    (hits || []).slice(0, 12).forEach(function (h) {
      if (!h) return;
      absorbLearningFromText([h.title, h.name, h.snippet, h.section, h.sectionLabel].join(' '), 2);
      if (h.kind) absorbLearnedToken(h.kind, 1);
    });
    try {
      var st = loadLearnedVocab();
      var now = Date.now();
      if (!st._lastSaveAt || (now - st._lastSaveAt) > 20000) {
        st._lastSaveAt = now;
      }
    } catch (eS) {}
  }

  function learnedTokenBoost(qTokens) {
    var store = loadLearnedVocab();
    var boost = 0;
    (qTokens || []).forEach(function (t) {
      var w = Number(store.words[t]) || 0;
      if (w >= 3) boost += Math.min(2.5, w * 0.08);
    });
    return boost;
  }

  /** Հրամանի համարներ, ամսաթվեր, մոտավոր անուններ */
  function extractQueryEntities(q) {
    var s = String(q || '').trim();
    var out = { orderNums: [], dates: [], names: [], raw: s };
    var num = extractLawDocNumber(s);
    if (num) out.orderNums.push(num);
    var dm;
    var dateRe = /(\d{1,2})[.\-\/](\d{1,2})[.\-\/](\d{2,4})|(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})/g;
    while ((dm = dateRe.exec(s))) {
      out.dates.push(dm[0]);
    }
    var cleaned = stripSearchNoise(s).replace(/\d{3,8}/g, ' ');
    var parts = cleaned.split(/\s+/).filter(function (p) {
      return p.length >= 3 && !/^(և|կամ|որ|the|and|или|для|համար|մասին|about|для)$/i.test(p);
    });
    if (parts.length >= 2 && parts.length <= 5) {
      var guess = parts.join(' ');
      if (/[\u0531-\u0556\u0561-\u0587]{3,}/.test(guess) || /^[A-Za-zА-Яа-яЁё]{3,}/.test(guess)) {
        out.names.push(guess);
      }
    }
    return out;
  }

  function personCardBlob(p) {
    if (!p || typeof p !== 'object') return '';
    return [p.name, p.rank, p.unit, p.post, p.postCode].join(' ');
  }


  async function syncKnowledgeEpoch() {
    try {
      var lib = window.kmNative && window.kmNative.library;
      if (!lib || typeof lib.knowledgeEpoch !== 'function') return KNOWLEDGE_EPOCH;
      var st = await lib.knowledgeEpoch();
      var ep = Number(st && st.epoch) || 0;
      if (ep && ep !== LIVE_CORPUS_CACHE.epoch) {
        LIVE_CORPUS_CACHE = { at: 0, rows: null, epoch: ep };
        KNOWLEDGE_EPOCH = ep;
      }
      return ep || KNOWLEDGE_EPOCH;
    } catch (e0) {
      return KNOWLEDGE_EPOCH;
    }
  }

  /* Տեղական «AI»՝ հոմանիշներ + կոնտեքստ (առանց արտաքին LLM) */
  var SYNONYMS = {
    'գրաֆիկ': ['վերակարգ', 'հերթապահ', 'պլանավորում', 'schedule', 'график', 'наряд'],
    'անձնակազմ': ['անձինք', 'զինծառայող', 'personnel', 'личный состав', 'people', 'կազմ'],
    'անհարմար': ['անհարմար օր', 'bad day', 'неудобн', 'չի կարող հերթապահել'],
    'տույժ': ['կարգապահական', 'penalty', 'взыскан', 'նկատողություն'],
    'բնութագիր': ['характеристик', 'characteristic', 'smart engine'],
    'գրադարան': ['library', 'библиотек', 'ֆայլ'], /* KM_RENAME_LEFTOVERS_V1: Արխիվ is its own menu section, not under Գրադարան */
    'հաշվառում': ['accounting', 'учёт', 'պաշտոն', 'շտատ'],
    'իրավունք': ['զինծառայողի իրավունք', 'rights', 'прав'],
    'usb': ['ֆլեշ', 'flash', 'синхр', 'համաժամեցում', 'sync'],
    'օգնություն': ['help', 'помощ', 'ինչպես', 'how', 'как'],
    'փորձաշրջան': ['wizard', 'trial', 'էզրակացություն', 'monitor'],
    'ստորաբաժանում': ['unit', 'подраздел', 'կազմ', 'section'],
    'պաշտոն': ['շտատ', 'հաստիք', 'position', 'должност', 'քարտ', 'կոդ'],
    'իրավաբանական': ['օրենք', 'ակտ', 'հրաման', 'legal', 'юридич', 'անկյուն'],
    'հրաման': ['приказ', 'order', 'որոշում', 'ակտ', 'նախագիծ'],
    'գործիք': ['աշխատանքային գործիք', 'աշխատանքի գործիք', 'work tools', 'unit tools', 'инструмент', 'գույք', 'վառելիք'], /* KM_RENAME_LEFTOVERS_V1 */
    'հիմնական': ['home', 'главн', 'սկիզբ', 'մուտք'],
    'վերակարգ': ['duty', 'наряд', 'տեսակ', 'պլանավորում'],
    'արխիվ': ['archive', 'архив', 'պահոց', 'պահպանված']
  };
  var SECTION_TREE = [
    { id: 'home', label: 'Հիմնական', page: 'home', kids: ['Այսօր հերթապահ', 'Արագ գործողություններ', 'Վիճակագրություն'] },
    { id: 'accounting', label: 'Հաշվառում', page: 'accounting', kids: ['Անձնակազմ և Պաշտոն', 'Արձակուրդ', 'Բուժկետ', 'Շարային տեղեկագիր', 'Կոչումներ և ժամկետներ', 'Գույք', 'Զորամասի Արխիվ', 'Բանակային կորպուսներ'] },
    { id: 'dutyTypes', label: 'Վերակարգ', page: 'dutyTypes', kids: ['Վերակարգի գրաֆիկ', 'Ավտոպլան', 'Ձևանմուշներ', 'Կոչումով թույլատրելիություն', 'Աշխատանքային վիճակ', 'Բեռ', 'Տախտակ'] }, /* KM_MENU_REORG_V1 */
    { id: 'archiveHub', label: 'Արխիվ', page: 'archiveHub', kids: ['Հիշողություն', 'Ընթացիկ արխիվ', 'Արխիվ', 'Գործողությունների մատյան', 'Տեղեկություն'] }, /* KM_RENAME_LEFTOVERS_V1: Արխիվ is its own left-menu section */
    /* KM_MENU_REORG_V1: Գրադարան removed from the menu; its sections are in Աշխատանքային գործիքներ (page 'library' still routes there) */
    { id: 'unitTools', label: 'Աշխատանքային գործիքներ', page: 'unitTools', kids: ['Փաստաթղթեր', 'Վառելիք', 'Օրվա կարգացուցակ', 'Ձևաթղթեր', 'Փորձաշրջան', 'Նշումներ', 'Ֆայլեր', 'Հաշվետվություններ'] }, /* KM_MENU_REORG_V1 */
    { id: 'lawdocs', label: 'Իրավական անկյուն', page: 'lawdocs', kids: ['Օրենքներ', 'Հրամաններ', 'Որոշումներ', 'Իրավունքներ', 'Տույժեր'] },
    { id: 'admins', label: 'Ադմինիստրատորներ', page: 'admins', kids: ['Ադմինների ցուցակ', 'Իրավունքներ', 'Մուտքեր'] },
    { id: 'users', label: 'Օգտատերեր', page: 'users', kids: ['Էջերի թույլտվություններ', 'Գաղտնաբառ'] },
    { id: 'about', label: 'Ծրագրի մասին', page: 'about', kids: ['Տարբերակ', 'Թարմացում'] }
  ];

  var NAV_PAGES = [
    { page: 'dutyTypes', keys: ['վերակարգերի տեսակ', 'վերակարգի տեսակ', 'վերակարգի տեսակներ', 'duty types', 'виды нарядов', 'duties', 'наряды'] }, /* KM_RENAME_LEFTOVERS_V1 */
    { page: 'schedule', keys: ['գրաֆիկ', 'հերթապահ', 'schedule', 'график'] },
    { page: 'people', keys: ['անձնակազմ', 'անձինք', 'personnel', 'личный состав', 'people', 'քարտադարան', 'էլեկտրոնային քարտ'] },
    { page: 'unitBadDays', keys: ['անհարմար', 'bad day', 'неудобн'] },
    { page: 'positions', keys: ['պաշտոն', 'շտատ', 'position', 'должност'] },
    { page: 'troopStructure', keys: ['անձնակազմի հաշվառում', 'troop', 'կազմ'] },
    { page: 'accounting', keys: ['հաշվառում', 'accounting', 'учёт'] },
    { page: 'orgCorps', keys: ['բանակային կորպուս', 'կորպուսներ', 'army corps', 'կորպուսի արխիվ'] },
    { page: 'library', keys: ['գրադարան', 'library', 'библиотек'] },
    { page: 'lawdocs', keys: ['իրավաբան', 'իրավաբանական', 'օրենք', 'օրենքներ', 'legal', 'юридич'] },
    { page: 'unitTools', keys: ['աշխատանքային գործիք', 'աշխատանքի գործիք', 'զորամասի գործիք', 'unit tools', 'инструмент', 'work tools'] }, /* KM_RENAME_LEFTOVERS_V1 */
    { page: 'unitTrialLab', keys: ['փորձաշրջան', 'wizard', 'trial'] },
    { page: 'acts_discipline', keys: ['տույժ', 'взыскан', 'penalty'] },
    { page: 'users', keys: ['օգտատեր', 'թույլտվություն', 'user', 'прав страниц', 'permission'] },
    { page: 'admins', keys: ['ադմին', 'ադմինիստրատոր', 'admin', 'админ'] },
    { page: 'about', keys: ['ծրագրի մասին', 'about', 'о программе'] },
    { page: 'home', keys: ['հիմնական', 'home', 'главн', 'սկիզբ'] },
    { page: 'archiveHub', keys: ['արխիվ', 'archive', 'архив'] }, /* KM_RENAME_LEFTOVERS_V1: left-menu Արխիվ hub (was the old Գրադարան → Արխիվ card) */
    { page: 'orderDraft', keys: ['հրամանի նախագիծ', 'order draft', 'приказ'] },
    { page: 'network', keys: ['ցանց', 'network', 'файл', 'передач', 'sync', 'lan', 'ֆայլեր'] },
    { page: 'syssettings', keys: ['համակարգի կարգավոր', 'system settings', 'системные настройки'] },
    { page: 'settings', keys: ['կարգավոր', 'settings', 'настрой'] },
    { page: 'sysinfo', keys: ['sysinfo', 'տեղեկություն', 'համակարգի տեղեկ'] }
  ];

  var GREETING_CANON = [
    'բարև', 'բարեւ', 'ողջույն', 'հլը', 'հլե', 'բարևներ',
    'привет', 'здравствуй', 'здравствуйте', 'hello', 'hi', 'hey',
    'բարի', 'доброе', 'добрый', 'доброй'
  ];

  var SECTION_PURPOSE = {
    lawdocs: {
      hy: 'Իրավական անկյունը պարունակում է օրենքներ, հրամաններ, որոշումներ, զինծառայողի իրավունքներ և տույժեր։',
      ru: 'Юридический раздел содержит законы, приказы, решения, права военнослужащих и взыскания.',
      en: 'Legal Corner holds laws, orders, decisions, soldier rights, and penalties.'
    },
    accounting: {
      hy: 'Հաշվառում բաժնում են անձնակազմը և պաշտոնը, արձակուրդը, բուժկետը, կոչումների ժամկետները, զորամասի արխիվը և բանակային կորպուսները։',
      ru: 'В учёте — личный состав, должности, отпуска, медпункт, картотека и сроки званий.',
      en: 'Accounting covers personnel, positions, leave, medical post, card index, and rank terms.'
    },
    library: {
      hy: 'Ֆայլերը, նշումները և գրանցումները այժմ «Աշխատանքային գործիքներ» բաժնում են, արխիվը՝ «Արխիվ» բաժնում։', /* KM_MENU_REORG_V1 */
      ru: 'Файлы, заметки и регистрации теперь в разделе «Рабочие инструменты», архив — в разделе «Архив».',
      en: 'Files, notes and registrations are now in Work tools; the archive is in Archive.'
    },
    schedule: {
      hy: 'Գրաֆիկ բաժինը ցույց է տալիս վերակարգերի/հերթապահության պլանավորումը և ցուցակները։',
      ru: 'Раздел графика — планирование нарядов/дежурств и списки.',
      en: 'Schedule covers duty roster planning and lists.'
    },
    people: {
      hy: 'Անձնակազմ և Պաշտոն բաժինը ցույց է տալիս անձանց ցուցակը, քարտերը և շտատային պաշտոնները։',
      ru: 'Личный состав показывает данные людей и состав.',
      en: 'Personnel shows people records and composition.'
    },
    unitTools: {
      hy: 'Աշխատանքային գործիքներում են փաստաթղթեր, վառելիք, օրվա կարգացուցակ, ձևաթղթեր, փորձաշրջան, ինչպես նաև նշումներ, ֆայլեր, հաշվետվություններ և աղյուսակներ։', /* KM_MENU_REORG_V1 */
      ru: 'В рабочих инструментах — документы, топливо, распорядок дня, бланки, испытательный режим, а также заметки, файлы, отчёты и таблицы.', /* KM_RENAME_LEFTOVERS_V1 */
      en: 'Work tools include documents, fuel, daily routine, forms, trial lab, plus notes, files, reports and spreadsheets.'
    },
    dutyTypes: {
      hy: 'Վերակարգ բաժնում կարգավորվում են գրաֆիկի տեսակները, ավտոպլանը և ձևանմուշները, այստեղ են նաև Աշխատանքային վիճակ, Բեռ և Տախտակ։', /* KM_MENU_REORG_V1 */
      ru: 'В разделе «Наряды» задаются типы графика, автоплан и шаблоны; здесь же Рабочее состояние, Нагрузка и Табло.', /* KM_RENAME_LEFTOVERS_V1 */
      en: 'Duties configures schedule kinds, auto-plan and templates; Work status, Workload and Board are here too.'
    },
    archiveHub: { /* KM_RENAME_LEFTOVERS_V1 */
      hy: 'Արխիվը ձախ մենյուի առանձին բաժին է՝ Հիշողություն, Ընթացիկ արխիվ, Արխիվ, իսկ ադմինի համար՝ Գործողությունների մատյան և Տեղեկություն։',
      ru: 'Архив — отдельный раздел левого меню: Память, Текущий архив, Архив, а для администратора — Журнал действий и Сведения.',
      en: 'Archive is its own left-menu section: Memory, Current archive, Archive, plus Audit log and System info for admins.'
    },
    home: {
      hy: 'Հիմնական էջում են արագ գործողությունները, այսօրվա հերթապահը և վիճակագրությունը։',
      ru: 'На главной — быстрые действия, дежурный сегодня и статистика.',
      en: 'Home has quick actions, today’s duty, and stats.'
    },
    positions: {
      hy: 'Պաշտոն բաժնում են շտատային քարտերը՝ կոդ, կոչում, թափուր/զբաղեցված և այլ մետատվյալներ։',
      ru: 'В должностях — штатные карточки: код, звание, вакансия и метаданные.',
      en: 'Positions holds staff cards: code, rank, vacancy, and metadata.'
    },
    unitBadDays: {
      hy: 'Անհարմար օրեր բաժինը նշում է ստորաբաժանումների անհասանելի օրերը գրաֆիկի համար։',
      ru: 'Неудобные дни задают недоступные дни подразделений для графика.',
      en: 'Unavailable days marks unit days that should be avoided in schedules.'
    },
    users: {
      hy: 'Օգտատերեր բաժնում կարգավորվում են մուտքերն ու էջերի թույլտվությունները։',
      ru: 'Пользователи — входы и права страниц.',
      en: 'Users manages logins and page permissions.'
    },
    archive: {
      hy: 'Արխիվում պահպանված են հին գրառումներն ու ֆայլերը։',
      ru: 'Архив хранит старые записи и файлы.',
      en: 'Archive keeps historical records and files.'
    },
    admins: {
      hy: 'Ադմինիստրատորների վահանակում կառավարվում են ադմինների մուտքերն ու իրավունքները։',
      ru: 'Панель администраторов — входы и права админов.',
      en: 'Admins panel manages administrator logins and rights.'
    },
    about: {
      hy: 'Ծրագրի մասին էջում են տարբերակը, թարմացումը և համակարգի նկարագրությունը։',
      ru: 'О программе — версия, обновление и описание системы.',
      en: 'About shows version, update, and system description.'
    },
    sysinfo: {
      hy: 'Տեղեկություն բաժինը ցույց է տալիս համակարգչի և տեղադրման տվյալները։',
      ru: 'Сведения — данные компьютера и установки.',
      en: 'Sysinfo shows computer and install details.'
    },
    syssettings: {
      hy: 'Համակարգի կարգավորումներում են ցանցը, ֆայլերը, տեղեկությունը, պահուստը և անվտանգությունը։',
      ru: 'Системные настройки — сеть, файлы, сведения, резерв и безопасность.',
      en: 'System settings holds network, files, information, backup, and security.'
    },
    network: {
      hy: 'Ցանց և ֆայլեր բաժինը LAN համաժամեցման և ֆայլերի փոխանցման համար է։',
      ru: 'Сеть и файлы — LAN-синхронизация и передача.',
      en: 'Network & files is for LAN sync and file transfer.'
    },
    settings: {
      hy: 'Կարգավորումներում են լեզուն, ֆոնը և այլ համակարգային ընտրանքներ։',
      ru: 'Настройки — язык, фон и системные параметры.',
      en: 'Settings covers language, background, and system options.'
    }
  };

  function esc(s) {
    return typeof window.esc === 'function'
      ? window.esc(s)
      : String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
          return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
        });
  }

  function getLang() {
    try {
      if (typeof window.kmGetLanguage === 'function') {
        var L = String(window.kmGetLanguage() || 'hy');
        if (L === 'ru' || L === 'en' || L === 'hy') return L;
      }
    } catch (e0) {}
    try {
      var s = localStorage.getItem('KM_UI_LANGUAGE_V55') || localStorage.getItem('km_ui_lang') || 'hy';
      if (s === 'ru' || s === 'en' || s === 'hy') return s;
    } catch (e1) {}
    return 'hy';
  }

  function textify(val, lang) {
    lang = lang || getLang();
    if (val == null) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'number' || typeof val === 'boolean') return String(val);
    if (Array.isArray(val)) {
      return val.map(function (x) { return textify(x, lang); }).filter(Boolean).join('\n');
    }
    if (typeof val === 'object') {
      if (val[lang] != null) return textify(val[lang], lang);
      if (val.hy != null) return textify(val.hy, lang);
      if (val.en != null) return textify(val.en, lang);
      if (val.ru != null) return textify(val.ru, lang);
      if (val.text != null) return textify(val.text, lang);
      if (val.content != null) return textify(val.content, lang);
      if (val.message != null) return textify(val.message, lang);
      if (val.title != null) return textify(val.title, lang);
      if (val.label != null) return textify(val.label, lang);
      return '';
    }
    return String(val);
  }

  function pick(val, lang) {
    lang = lang || getLang();
    if (val == null) return '';
    if (typeof val === 'string') return val;
    if (Array.isArray(val)) return val;
    if (typeof val === 'object') {
      if (val[lang] != null) return val[lang];
      if (val.hy != null) return val.hy;
      if (val.en != null) return val.en;
      if (val.ru != null) return val.ru;
      return '';
    }
    return String(val);
  }

  function pickArr(val, lang) {
    var v = pick(val, lang);
    if (Array.isArray(v)) {
      return v.map(function (x) { return textify(x, lang); }).filter(Boolean);
    }
    var s = textify(v, lang);
    return s ? [s] : [];
  }

  function hbToast(msg, kind) {
    msg = textify(msg);
    if (!msg) return;
    try {
      if (typeof toast === 'function') toast(msg, kind || '');
      else if (typeof window.kmNotify === 'function') window.kmNotify(msg, kind || '');
    } catch (e0) {}
  }

  function ui(key) {
    var pack = (DATA && DATA.ui) || {};
    var lang = getLang();
    var block = pack[lang] || pack.hy || {};
    return block[key] != null ? block[key] : '';
  }

  function isOnline() {
    try { return !!(navigator && navigator.onLine); } catch (e) { return false; }
  }

  function injectCss() {
    if (document.getElementById('km-help-bot-css')) return;
    var s = document.createElement('style');
    s.id = 'km-help-bot-css';
    s.textContent =
      '.kmHbShell{display:flex;flex-direction:column;min-height:0;height:100%}' +
      '.kmHbHead{margin-bottom:8px;flex:0 0 auto}' +
      '.kmHbLead{color:#5a6b78;font-size:12.5px;margin:0 0 8px;line-height:1.45}' +
      '.kmHbMeta{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:0 0 8px}' +
      '.kmHbBadge{font-size:11px;font-weight:700;padding:3px 8px;border-radius:999px;border:1px solid #c5d6de;background:#f4f9fb;color:#0d4a66}' +
      '.kmHbBadge.on{background:#e8f7ee;border-color:#9dceb0;color:#1a5c3a}' +
      '.kmHbBadge.off{background:#f7f1e8;border-color:#e0c9a0;color:#7a5a00}' +
      '.kmHbChips{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 8px;max-height:72px;overflow:auto}' +
      '.kmHbChip{border:1px solid #c5d6de;background:#f4f9fb;color:#0d4a66;border-radius:999px;padding:6px 10px;font-size:11.5px;font-weight:700;cursor:pointer}' +
      '.kmHbChip:hover{background:#e7f3f7}' +
      '.kmHbLog{flex:1;overflow:auto;padding:10px;background:#f7fafc;border:1px solid #d7e6ec;border-radius:12px;min-height:160px}' +
      '.kmHbMsg{margin:0 0 10px;max-width:94%}' +
      '.kmHbMsg.user{margin-left:auto}' +
      '.kmHbBubble{padding:9px 11px;border-radius:12px;line-height:1.5;font-size:13px;white-space:pre-wrap}' +
      '.kmHbMsg.bot .kmHbBubble{background:#fff;border:1px solid #dce7ed;color:#1a2a36}' +
      '.kmHbMsg.user .kmHbBubble{background:#0d6e7a;color:#fff;border:0}' +
      '.kmHbMsg.typing .kmHbBubble{opacity:.85;font-style:italic;color:#5a6b78}' +
      '.kmHbTypingDots span{display:inline-block;width:5px;height:5px;margin:0 2px;border-radius:50%;background:#7a93a3;animation:kmHbDot 1.2s infinite ease-in-out}' +
      '.kmHbTypingDots span:nth-child(2){animation-delay:.15s}' +
      '.kmHbTypingDots span:nth-child(3){animation-delay:.3s}' +
      '@keyframes kmHbDot{0%,80%,100%{opacity:.25;transform:translateY(0)}40%{opacity:1;transform:translateY(-2px)}}' +
      '.kmHbBadge.llm{background:#e8eefc;border-color:#a8b8e8;color:#243a8a}' +
      '.kmHbFb{display:inline-flex;gap:4px;margin-left:8px;vertical-align:middle}' +
      '.kmHbFb button{border:1px solid #c5d6de;background:#f8fbfd;border-radius:8px;padding:2px 7px;cursor:pointer;font-size:12px;line-height:1.2}' +
      '.kmHbFb button:hover{background:#e7f3f7}' +
      '.kmHbFb button.is-on{background:#e8f7ee;border-color:#9dceb0}' +
      '.kmHbFb button.is-down{background:#fdeeee;border-color:#e0a8a8}' +
      '.kmHbTtsRow{display:flex;gap:6px;margin-top:8px;align-items:center}' +
      '.kmHbTtsBtn{border:1px solid #c5d6de;background:#f4f9fb;color:#0d4a66;border-radius:999px;padding:4px 10px;font-size:11.5px;font-weight:700;cursor:pointer;line-height:1.2}' +
      '.kmHbTtsBtn:hover{background:#e7f3f7}' +
      '.kmHbTtsBtn.is-playing{background:#e8f7ee;border-color:#9dceb0;color:#1a5c3a}' +
      '.kmHbTtsBtn[hidden]{display:none!important}' +
      '.kmHbTitle{font-weight:800;color:#0d4a66;margin:0 0 6px;font-size:13.5px}' +
      '.kmHbSteps{margin:0;padding-left:18px}' +
      '.kmHbSteps li{margin:0 0 5px}' +
      '.kmHbGroup{margin:8px 0;border:1px solid #d7e6ec;border-radius:10px;background:#f8fbfd;padding:0 8px 6px}' +
      '.kmHbGroupSum{cursor:pointer;font-weight:800;color:#0d4a66;font-size:12.5px;padding:8px 4px;list-style:none}' +
      '.kmHbGroupSum::-webkit-details-marker{display:none}' +
      '.kmHbGroupSum::before{content:"▸ ";display:inline-block;transition:transform .15s}' +
      '.kmHbGroup[open] > .kmHbGroupSum::before{transform:rotate(90deg)}' +
      '.kmHbGroup .kmHbSteps{margin:0 0 4px;padding-left:16px}' +
      '.kmHbGroup .kmHbActs{margin-top:4px;margin-bottom:4px}' +
      '.kmHbActs{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}' +
      '.kmHbActs button{font-size:11.5px;font-weight:700}' +
      '.kmHbInputRow{display:flex;gap:8px;margin-top:10px;flex:0 0 auto}' +
      '.kmHbInputRow input{flex:1;padding:10px 11px;border:1px solid #c8d0d8;border-radius:10px;font-size:13.5px}' +
      '.kmHbFab{position:fixed;right:18px;bottom:18px;z-index:12000;width:56px;height:56px;border-radius:50%;border:0;cursor:pointer;' +
      'background:linear-gradient(145deg,#0d6e7a,#0a5570);color:#fff;font-size:22px;font-weight:800;' +
      'box-shadow:0 8px 22px rgba(13,74,102,.35)}' +
      '.kmHbFab:hover{transform:translateY(-1px);box-shadow:0 10px 26px rgba(13,74,102,.42)}' +
      '.kmHbFab.is-open{background:linear-gradient(145deg,#7a3030,#5a2020);box-shadow:0 8px 22px rgba(90,30,30,.35);font-size:0}' +
      '.kmHbFab.is-open::after{content:"\\00d7";font-size:28px;line-height:1;font-weight:700}' +
      '.kmHbFab[hidden]{display:none!important}' +
      'body.km-boot-idle .kmHbFab{display:none!important}' +
      '.kmHbOverlay{position:fixed;inset:0;z-index:11990;background:rgba(15,23,42,.35);display:flex;align-items:flex-end;justify-content:flex-end;padding:18px 18px 84px;box-sizing:border-box}' +
      '.kmHbOverlay[hidden]{display:none!important}' +
      '.kmHbPanel{width:min(460px,100%);max-height:min(80vh,760px);background:#fff;border-radius:16px;box-shadow:0 18px 50px rgba(0,0,0,.28);display:flex;flex-direction:column;overflow:hidden}' +
      '.kmHbPanel .kmHbShell{padding:12px 12px 14px}' +
      '@media(max-width:560px){.kmHbOverlay{padding:10px 10px 80px;align-items:stretch}.kmHbPanel{width:100%;max-height:min(86vh,900px)}}';
    document.head.appendChild(s);
  }

  function allTopics() {
    var base = (DATA && DATA.topics) || [];
    var extra = (ONLINE_EXTRA && ONLINE_EXTRA.topics) || [];
    return base.concat(extra);
  }

  function loadOnlineExtra() {
    if (!isOnline()) {
      ONLINE_EXTRA = null;
      return Promise.resolve(null);
    }
    var remote = '';
    try { remote = String(window.kmHelpBotOnlineUrl || '').trim(); } catch (e0) {}
    var url = remote || (ONLINE_URL + '?v=' + encodeURIComponent(String(window.kmUpdate || Date.now())));
    var fetchP = fetch(url, { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        ONLINE_EXTRA = j && typeof j === 'object' && Array.isArray(j.topics) ? j : null;
        return ONLINE_EXTRA;
      })
      .catch(function () {
        ONLINE_EXTRA = null;
        return null;
      });
    return Promise.race([
      fetchP,
      new Promise(function (resolve) {
        setTimeout(function () { resolve(ONLINE_EXTRA); }, 2000);
      })
    ]);
  }

  function loadData(force) {
    if (DATA && !force) {
      return loadOnlineExtra().then(function () { return DATA; });
    }
    return fetch(DATA_URL + '?v=' + encodeURIComponent(String(window.kmUpdate || '')))
      .then(function (r) {
        if (!r.ok) throw new Error('help_bot_load_failed');
        return r.json();
      })
      .then(function (j) {
        if (window.KMHelpBotShield && window.KMHelpBotShield.validateKb && !window.KMHelpBotShield.validateKb(j)) {
          throw new Error('help_bot_kb_invalid');
        }
        DATA = j;
        window.KM_HELP_BOT = j;
        return loadOnlineExtra().then(function () { return DATA; });
      });
  }

  function discoverSystemModules() {
    var out = [];
    try {
      var gs = window.kmGrantSections || (window.KM_USERS && window.KM_USERS.GRANT_SECTIONS);
      if (Array.isArray(gs) && gs.length) {
        gs.forEach(function (s) {
          if (!s || !s.label) return;
          out.push({ id: s.id, label: s.label, group: s.group || '' });
        });
        return out;
      }
    } catch (e0) {}
    return out;
  }

  function enrichSystemAnswer(topic, lang) {
    if (!topic || topic.id !== 'system_map') return topic;
    var mods = discoverSystemModules();
    var answers = pickArr(topic.answer, lang).slice();
    if (mods.length) {
      var byGroup = Object.create(null);
      var groups = [];
      mods.forEach(function (m) {
        var g = m.group || (lang === 'ru' ? 'Прочее' : (lang === 'en' ? 'Other' : 'Այլ'));
        if (!byGroup[g]) { byGroup[g] = []; groups.push(g); }
        byGroup[g].push(m.label);
      });
      var head = lang === 'ru'
        ? 'Обнаруженные разделы этой установки:'
        : (lang === 'en' ? 'Detected sections on this install:' : 'Համակարգում հայտնաբերված բաժիններ՝');
      answers.push(head);
      groups.slice(0, 14).forEach(function (g) {
        answers.push(g + ' — ' + byGroup[g].slice(0, 10).join(', ') + (byGroup[g].length > 10 ? '…' : ''));
      });
    }
    try {
      var treeHead = lang === 'ru'
        ? 'Основные разделы и подразделы (изучаю структуру):'
        : (lang === 'en' ? 'Main sections and subsections (I study the structure):' : 'Հիմնական բաժիններ և ենթաբաժիններ (ուսումնասիրում եմ կառուցվածքը)՝');
      answers.push(treeHead);
      (SECTION_TREE || []).forEach(function (sec) {
        answers.push('• ' + sec.label + (sec.kids && sec.kids.length ? (' → ' + sec.kids.join(', ')) : ''));
      });
      answers.push(lang === 'ru'
        ? 'Могу искать по файлам/архиву этих разделов и пополнять свой словарь для более точного поиска.'
        : (lang === 'en'
          ? 'I can search files/archives in these sections and grow my vocabulary for better search.'
          : 'Կարող եմ որոնել այս բաժինների ֆայլերում/արխիվում և համալրել բառապաշարս՝ ավելի ճշգրիտ փնտրելու համար։'));
    } catch (eTree) {}
    return {
      id: topic.id,
      title: topic.title,
      keywords: topic.keywords,
      answer: answers,
      actions: topic.actions || [],
      _localized: true
    };
  }

  function norm(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/ё/g, 'е')
      .replace(/և/g, 'եւ')
      .replace(/[^\u0531-\u0556\u0561-\u0587a-zа-я0-9\s]/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function tokens(s) {
    return norm(s).split(' ').filter(function (t) { return t.length >= 2; });
  }

  function expandQueryTokens(qTokens) {
    var set = Object.create(null);
    qTokens.forEach(function (t) { set[t] = 1; });
    Object.keys(SYNONYMS).forEach(function (root) {
      var hit = qTokens.some(function (t) {
        return t === root || t.indexOf(root) === 0 || root.indexOf(t) === 0 ||
          SYNONYMS[root].some(function (s) {
            var n = norm(s);
            return n && (t === n || t.indexOf(n) === 0 || n.indexOf(t) === 0 || qTokens.join(' ').indexOf(n) >= 0);
          });
      });
      if (!hit) return;
      set[root] = 1;
      SYNONYMS[root].forEach(function (s) {
        tokens(s).forEach(function (x) { set[x] = 1; });
      });
    });
    try {
      var learned = loadLearnedVocab().words || {};
      Object.keys(learned).forEach(function (w) {
        if ((Number(learned[w]) || 0) < 2) return;
        qTokens.forEach(function (t) {
          if (t.length < 3) return;
          if (w === t || w.indexOf(t) === 0 || t.indexOf(w) === 0 || editDist(w, t) <= 1) set[w] = 1;
        });
      });
    } catch (eL) {}
    return Object.keys(set);
  }

  function editDist(a, b) {
    a = String(a || ''); b = String(b || '');
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    if (Math.abs(a.length - b.length) > 2) return 99;
    var prev = [];
    var cur = [];
    var i, j;
    for (j = 0; j <= b.length; j++) prev[j] = j;
    for (i = 1; i <= a.length; i++) {
      cur[0] = i;
      for (j = 1; j <= b.length; j++) {
        var cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
        cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
      }
      prev = cur.slice();
    }
    return prev[b.length];
  }

  function fuzzyBoost(qTokens, kwNorm) {
    var best = 0;
    qTokens.forEach(function (t) {
      if (t.length < 4 || kwNorm.length < 4) return;
      var d = editDist(t, kwNorm);
      if (d <= 1) best = Math.max(best, 3.5);
      else if (d === 2) best = Math.max(best, 1.8);
    });
    return best;
  }

  function isFuzzyGreetingToken(t) {
    t = String(t || '');
    if (t.length < 3) return false;
    for (var i = 0; i < GREETING_CANON.length; i++) {
      var g = GREETING_CANON[i];
      if (t === g) return true;
      if (t.length >= 4 && g.length >= 4) {
        var maxD = Math.max(t.length, g.length) >= 7 ? 2 : 1;
        if (editDist(t, g) <= maxD) return true;
      }
    }
    /* Common Armenian greeting typos: որջույն≈ողջույն, բարե≈բարև */
    if (/^որ?ջույն|^ողջու|^բարե|^բարեւ|^պրիվետ|^здравст|^hel+o$/i.test(t)) return true;
    return false;
  }

  function isFuzzyGreeting(q) {
    var raw = String(q || '').trim();
    var s = norm(q);
    if (!s || raw.length > 96) return false;
    if (isSectionAboutQuery(q)) return false;
    if (/(հրաման|приказ|որոշում|ակտ|զեկույց|հաշվառ|պաշտոն|գտիր|փնտր|№|#\d|\d{3,})/i.test(s)) return false;
    var toks = tokens(s);
    if (!toks.length || toks.length > 10) return false;
    var greet = 0;
    toks.forEach(function (t) {
      if (isFuzzyGreetingToken(t)) greet++;
    });
    if (greet >= 1) return true;
    /* Whole-string fuzzy against canonical greetings (e.g. «որջույն») */
    for (var i = 0; i < GREETING_CANON.length; i++) {
      var g = GREETING_CANON[i];
      if (g.length >= 4 && s.length >= 4 && s.length <= g.length + 3 && editDist(s, g) <= 2) return true;
    }
    return false;
  }

  function resolveSectionFromQuery(qNorm) {
    qNorm = norm(qNorm);
    if (!qNorm) return null;
    var best = null;
    var bestSc = 0;
    NAV_PAGES.forEach(function (np) {
      var sc = 0;
      (np.keys || []).forEach(function (k) {
        var n = norm(k);
        if (!n) return;
        if (qNorm.indexOf(n) >= 0) sc += 5 + Math.min(5, n.length / 3);
        else {
          tokens(qNorm).forEach(function (t) {
            if (t.length >= 4 && n.length >= 4 && editDist(t, n) <= 1) sc += 3.5;
          });
        }
      });
      (SECTION_TREE || []).forEach(function (sec) {
        if (sec.page !== np.page) return;
        var lab = norm(sec.label);
        if (lab && qNorm.indexOf(lab) >= 0) sc += 8;
        else if (lab) {
          tokens(lab).forEach(function (lt) {
            if (lt.length >= 4 && qNorm.indexOf(lt) >= 0) sc += 3;
          });
        }
      });
      if (sc > bestSc) {
        bestSc = sc;
        best = np;
      }
    });
    if (bestSc < 4 || !best) return null;
    var tree = null;
    (SECTION_TREE || []).forEach(function (sec) {
      if (sec.page === best.page) tree = sec;
    });
    return { page: best.page, score: bestSc, tree: tree, label: (tree && tree.label) || best.page };
  }

  function isSectionAboutQuery(q) {
    var s = norm(q);
    if (!s) return false;
    /* «X ինչ է» = definition (science/general), NOT «ինչ կա բաժնում» */
    if (isDefinitionalQuestion(q) && !/(բաժին|раздел|անկյուն|section|էջ|page|меню|մենյու|համակարգ|км\b|km\b)/i.test(s)) {
      return false;
    }
    var aboutAsk = /(ինչ կա|ինչեր կան|ինչեր են|բովանդակ|նպատակ|նկարագր|what (is |s )?in|what.?s in|what does|расскаж|что (есть |в )|для чего|зачем)/i.test(s);
    var sectionWord = /(բաժին|раздел|անկյուն|section|էջ|page|меню|մենյու)/i.test(s);
    var sec = resolveSectionFromQuery(s);
    if (aboutAsk && (sectionWord || sec)) return true;
    if (sectionWord && sec && /(ինչ|как|what|что|ո[ր՞]տեղ)/i.test(s)) return true;
    return false;
  }

  function buildSectionAboutHit(qNorm, lang) {
    if (!isSectionAboutQuery(qNorm) && !resolveSectionFromQuery(qNorm)) return null;
    var sec = resolveSectionFromQuery(qNorm);
    if (!sec) return null;
    /* Only treat as section-about when user asks about contents / purpose / section */
    if (!isSectionAboutQuery(qNorm) && !/(բաժին|раздел|անկյուն|section)/i.test(qNorm)) return null;
    var purpose = SECTION_PURPOSE[sec.page];
    var purposeText = purpose
      ? (lang === 'ru' ? purpose.ru : (lang === 'en' ? purpose.en : purpose.hy))
      : '';
    var kids = (sec.tree && sec.tree.kids) || [];
    var title =
      lang === 'ru'
        ? ('Раздел «' + sec.label + '»')
        : (lang === 'en' ? ('Section “' + sec.label + '”') : ('«' + sec.label + '» բաժինը'));
    var lines = [];
    if (purposeText) lines.push(purposeText);
    if (kids.length) {
      lines.push(
        lang === 'ru'
          ? ('Внутри: ' + kids.join(' · ') + '.')
          : (lang === 'en'
            ? ('Inside: ' + kids.join(' · ') + '.')
            : ('Ներսում՝ ' + kids.join(' · ') + '։'))
      );
    }
    lines.push(
      lang === 'ru'
        ? 'Могу открыть этот раздел кнопкой ниже — или спросите конкретный документ/тему.'
        : (lang === 'en'
          ? 'I can open this section with the button below — or ask about a specific document/topic.'
          : 'Կարող եմ բացել այս բաժինը ներքևի կոճակով — կամ հարցրեք կոնկրետ փաստաթուղթ/թեմա։')
    );
    var openLabel = lang === 'ru' ? 'Открыть раздел' : (lang === 'en' ? 'Open section' : 'Բացել բաժինը');
    return {
      kind: 'topic',
      topic: {
        id: 'section_about_' + sec.page,
        title: title,
        answer: lines,
        actions: [{ label: openLabel, page: sec.page }],
        _localized: true
      },
      score: 60,
      alts: [],
      autoOpen: ''
    };
  }

  function userName() {
    try {
      return String(window.kmAuthUsername || sessionStorage.getItem('km_auth_username') || '').trim();
    } catch (e) { return ''; }
  }

  function liveAppStats() {
    var people = 0, units = {}, bad = 0, penalties = 0;
    try {
      var list = (typeof db !== 'undefined' && Array.isArray(db.people)) ? db.people : [];
      people = list.length;
      list.forEach(function (p) {
        var u = String((p && p.unit) || '').trim() || '—';
        units[u] = (units[u] || 0) + 1;
        if (Array.isArray(p.bad) && p.bad.length) bad += 1;
      });
    } catch (e0) {}
    try {
      penalties = (typeof db !== 'undefined' && Array.isArray(db.disciplinePenalties))
        ? db.disciplinePenalties.length : 0;
    } catch (e1) {}
    var page = '';
    try { page = String(window.page || '').trim(); } catch (e2) {}
    var role = '';
    try { role = String(window.kmUserRole || '').trim(); } catch (e3) {}
    return {
      people: people,
      unitCount: Object.keys(units).length,
      units: units,
      withBad: bad,
      penalties: penalties,
      page: page,
      role: role
    };
  }

  function extractLawDocNumber(q) {
    var s = String(q || '').trim();
    if (!s) return '';
    /* «հրաման 534» / «№ 534» / «N-534» */
    var m = s.match(/(?:հրաման(?:ը|ի|ով)?|որոշում(?:ը|ի)?|ակտ(?:ը|ի)?|նախագիծ(?:ը|ի)?|приказ|распоряжен|номер|number|№)\s*[#№:.\-]?\s*(\d{3,8})/i);
    if (m) return m[1];
    /* «534 հրամանը» / «534-րդ հրաման» */
    m = s.match(/\b(\d{3,8})\s*[-–—]?\s*(?:րդ|որորդ)?\s*(?:հրաման(?:ը|ի|ով)?|որոշում(?:ը|ի)?|ակտ(?:ը|ի)?|приказ|распоряжен)/i);
    if (m) return m[1];
    /* «№534» կամ առանձին համար */
    m = s.match(/[#№]\s*(\d{3,8})\b/);
    if (m) return m[1];
    if (/^\s*(\d{3,8})\s*$/.test(s)) return s.trim();
    /* «գտնել/բացիր 534 …» — 3+ թվանշան */
    if (/(ցույց|բացիր|բացել|գտիր|գտնել|որոն|փնտր|найди|найти|find|open|show|файл|ֆայլ|ակտ|հրաման)/i.test(s)) {
      m = s.match(/\b(\d{3,8})\b/);
      if (m) return m[1];
    }
    return '';
  }

  async function findLawDocHit(q, lang) {
    var num = extractLawDocNumber(q);
    if (!num) return null;
    var lib = window.kmNative && window.kmNative.library;
    if (!lib || typeof lib.lawsFindByNumber !== 'function') return null;
    var r;
    try {
      r = await lib.lawsFindByNumber({ q: num, hint: q, query: q });
    } catch (e0) { return null; }
    if (!r || !r.ok) return null;
    var items = Array.isArray(r.items) ? r.items.slice() : [];
    /* Եթե հարցը հրամանի մասին է՝ նախապատվություն տուր orders_* բաժիններին */
    if (/հրաման|приказ|order/i.test(q)) {
      items.sort(function (a, b) {
        var ao = /^orders_/.test(a.section || '') ? 1 : 0;
        var bo = /^orders_/.test(b.section || '') ? 1 : 0;
        if (ao !== bo) return bo - ao;
        return (b.score || 0) - (a.score || 0);
      });
    }
    var item = items[0] || null;
    var cat = r.catalog || null;
    if (!item && !cat) {
      return {
        kind: 'chat',
        intent: 'law_number',
        score: 95,
        suggest: true,
        text: lang === 'ru'
          ? ('По номеру «' + num + '» файл не найден. Загрузите документ в «Правовой уголок» или проверьте номер.') /* KM_RENAME_LEFTOVERS_V1 */
          : (lang === 'en'
            ? ('No file found for number «' + num + '». Load it in Legal Corner or check the number.')
            : ('«' + num + '» համարով ֆայլ չի գտնվել։ Բեռնեք Իրավական անկյունում կամ ստուգեք համարը։'))
      };
    }
    var openLabel = lang === 'ru' ? 'Открыть файл' : (lang === 'en' ? 'Open file' : 'Բացել ֆայլը');
    var hint = lang === 'ru'
      ? 'Файл не открыт автоматически — нажмите «Открыть», если нужно.'
      : (lang === 'en'
        ? 'File is not opened automatically — tap Open if you want.'
        : 'Ֆայլը ավտոմատ չի բացվել — ցանկության դեպքում սեղմեք «Բացել»։');
    var lines = [];
    var actions = [];
    if (lang === 'ru') lines.push('Поиск по номеру № ' + num + ' (только точные совпадения):');
    else if (lang === 'en') lines.push('Search by number № ' + num + ' (exact matches only):');
    else lines.push('№ ' + num + ' համարով որոնում (միայն ճշգրիտ համընկնում)՝');

    var shown = items.slice(0, 6);
    if (!shown.length && cat) {
      lines.push(formatFilePlace({
        area: lang === 'ru' ? 'Юридический угол' : (lang === 'en' ? 'Legal Corner' : 'Իրավական անկյուն'),
        sectionLabel: cat.sectionLabel || '',
        name: cat.title || ('№ ' + num)
      }, lang));
      lines.push(lang === 'ru'
        ? 'В каталоге есть запись, но файл ещё не загружен.'
        : (lang === 'en'
          ? 'Catalog entry exists, but the file is not loaded yet.'
          : 'Կատալոգում կա գրառում, բայց ֆայլը դեռ բեռնված չէ։'));
      actions.push({
        label: lang === 'ru' ? 'Открыть раздел' : (lang === 'en' ? 'Open section' : 'Բացել բաժինը'),
        page: 'lawdocs'
      });
    } else {
      shown.forEach(function (it) {
        lines.push('• ' + formatFilePlace({
          area: 'Իրավական անկյուն',
          sectionLabel: it.sectionLabel || it.section || '',
          name: it.displayName || it.name || ('№ ' + num)
        }, lang));
        if (it.id && it.section && actions.length < 6) {
          actions.push({
            label: openLabel + '՝ ' + String(it.displayName || it.name || num).slice(0, 28),
            lawId: it.id,
            lawSection: it.section
          });
        }
      });
      if (items.length > shown.length) {
        lines.push(lang === 'ru'
          ? ('… ещё ' + (items.length - shown.length))
          : (lang === 'en'
            ? ('… +' + (items.length - shown.length) + ' more')
            : ('… և ևս ' + (items.length - shown.length))));
      }
    }
    lines.push(hint);
    return {
      kind: 'topic',
      score: 98,
      intent: 'law_number',
      alts: [],
      topic: {
        id: 'law_num_' + num,
        title: lang === 'ru' ? ('Документ № ' + num) : (lang === 'en' ? ('Document № ' + num) : ('Փաստաթուղթ № ' + num)),
        answer: lines,
        actions: actions.length
          ? actions
          : [{ label: lang === 'ru' ? 'Открыть раздел' : (lang === 'en' ? 'Open section' : 'Բացել բաժինը'), page: 'lawdocs' }],
        _localized: true
      }
    };
  }

  function wantsContentSearch(qNorm) {
    return /(փնտր|որոն|գտիր|գտնել|որոնիր|բովանդակ|ֆայլում|ֆայլեր|ֆայլի\s*մեջ|փաստաթղթ|search|find in|найди|найти|поиск|содерж|искать|в\s*файле|в\s*документ)/i.test(qNorm) ||
      /(pdf|word|excel|pptx?|powerpoint|docx?|xlsx?|html)/i.test(qNorm) ||
      /(որտե[ղ՞]|որ\s*ֆայլ|որ\s*բաժին|где\s*(файл|найти|документ)|which\s*file|in\s*which)/i.test(qNorm) ||
      (/(ինքնակրթ|կատարելագործ|արխիվի պարունակ|self.?learn|study (files|structure))/i.test(qNorm) &&
        /(ֆայլ|բաժին|համակարգ|архив|file|folder)/i.test(qNorm));
  }

  function isUiHelpOnly(qNorm) {
    return /^(ինչպես|как |how to|бացիր|открой|open |օգն|помог|help)/i.test(String(qNorm || '').trim()) &&
      !wantsContentSearch(qNorm);
  }

  function stripSearchNoise(q) {
    return String(q || '')
      .replace(/(փնտրի?ր|որոնի?ր|գտի?ր|գտնել|որոնել|բովանդակություն|ֆայլ(եր)?(ում)?|search|find|найди|найти|поиск|кто|ով է|որտեղ է|որ գրաֆիկ|какой график|who is|where is)/gi, ' ')
      .replace(/[«»"'`]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function weekdayName(wd, lang) {
    var hy = ['կիրակի', 'երկուշաբթի', 'երեքշաբթի', 'չորեքշաբթի', 'հինգշաբթի', 'ուրբաթ', 'շաբաթ'];
    var ru = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
    var en = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    wd = ((Number(wd) % 7) + 7) % 7;
    if (lang === 'ru') return ru[wd];
    if (lang === 'en') return en[wd];
    return hy[wd];
  }

  function detectWeekday(q) {
    var s = String(q || '').toLowerCase();
    if (/(հինգշաբթի|четверг|thursday|\bthu\b|\bthurs\b)/i.test(s)) return 4;
    if (/(չորեքշաբթի|сред[аы]|wednesday|\bwed\b)/i.test(s)) return 3;
    if (/(երեքշաբթի|вторник|tuesday|\btue\b)/i.test(s)) return 2;
    if (/(երկուշաբթի|понедельник|monday|\bmon\b)/i.test(s)) return 1;
    if (/(ուրբաթ|пятниц|friday|\bfri\b)/i.test(s)) return 5;
    if (/(շաբաթ(?!օր)|суббот|saturday|\bsat\b)/i.test(s) && !/շաբաթվա|շաբաթ օրվա/i.test(s)) return 6;
    if (/(կիրակի|воскресень|sunday|\bsun\b)/i.test(s)) return 0;
    return null;
  }

  function scheduleBundles() {
    var out = [];
    try {
      if (typeof db === 'undefined' || !db) return out;
      function push(label, sch, page) {
        if (!sch || typeof sch !== 'object') return;
        var year = Number(sch.year) || new Date().getFullYear();
        var month = Number(sch.month) || (new Date().getMonth() + 1);
        var asg = sch.assignments;
        if (!asg || typeof asg !== 'object' || !Object.keys(asg).length) asg = sch.rows || {};
        out.push({
          label: String(label || sch.name || 'Գրաֆիկ'),
          year: year,
          month: month,
          assignments: asg,
          page: page || 'schedule'
        });
      }
      push((db.schedule && db.schedule.name) || 'Հիմնական', db.schedule, 'schedule');
      Object.keys(db.dutyTypeSchedules || {}).forEach(function (k) {
        var s = db.dutyTypeSchedules[k] || {};
        var idx = Number(String(k).replace(/^duty_/, ''));
        var label = s.name || ((db.dutyTypes || [])[idx]) || k;
        push(label, s, 'dutyTypes');
      });
      (db.futureSchedules || []).forEach(function (fs) {
        if (!fs) return;
        push(fs.name || 'Ապագա', fs, 'schedule');
      });
    } catch (e0) {}
    return out;
  }

  function personKeyMatch(key, needle) {
    var a = String(key || '').trim().toLowerCase();
    var b = String(needle || '').trim().toLowerCase();
    if (!a || !b || b.length < 2) return false;
    if (a === b) return true;
    if (a.indexOf(b) >= 0 || b.indexOf(a) >= 0) return true;
    var parts = b.split(/\s+/).filter(function (t) { return t.length >= 3; });
    if (parts.length >= 2 && parts.every(function (t) { return a.indexOf(t) >= 0; })) return true;
    if (parts.length === 1 && parts[0].length >= 4 && a.indexOf(parts[0]) >= 0) return true;
    return false;
  }

  function searchSchedulesByPerson(name) {
    var needle = String(name || '').trim();
    if (needle.length < 2) return [];
    var hits = [];
    scheduleBundles().forEach(function (bundle) {
      var asg = bundle.assignments || {};
      Object.keys(asg).forEach(function (person) {
        if (!personKeyMatch(person, needle)) return;
        var days = [];
        var row = asg[person] || {};
        Object.keys(row).forEach(function (d) {
          if (String(row[d] || '').trim()) days.push(Number(d));
        });
        days = days.filter(function (n) { return n > 0; }).sort(function (a, b) { return a - b; });
        if (!days.length && Object.keys(row).length === 0) {
          /* selected but empty — still list as included */
          hits.push({
            graph: bundle.label,
            person: person,
            year: bundle.year,
            month: bundle.month,
            days: [],
            page: bundle.page,
            note: 'ընդգրկված է ցուցակում'
          });
          return;
        }
        if (!days.length) return;
        hits.push({
          graph: bundle.label,
          person: person,
          year: bundle.year,
          month: bundle.month,
          days: days,
          page: bundle.page
        });
      });
    });
    return hits;
  }

  function searchSchedulesByWeekday(wd) {
    wd = ((Number(wd) % 7) + 7) % 7;
    var byDay = [];
    scheduleBundles().forEach(function (bundle) {
      var daysInMonth = new Date(bundle.year, bundle.month, 0).getDate();
      var dayList = [];
      for (var d = 1; d <= daysInMonth; d++) {
        if (new Date(bundle.year, bundle.month - 1, d, 12, 0, 0).getDay() === wd) dayList.push(d);
      }
      /* from today onward within this month; if none left, still show all month Thursdays */
      var today = new Date();
      var upcoming = dayList.filter(function (d) {
        var dt = new Date(bundle.year, bundle.month - 1, d, 23, 59, 0);
        return dt >= new Date(today.getFullYear(), today.getMonth(), today.getDate());
      });
      var useDays = upcoming.length ? upcoming : dayList;
      useDays.forEach(function (d) {
        var people = [];
        var asg = bundle.assignments || {};
        Object.keys(asg).forEach(function (person) {
          var val = asg[person] && asg[person][String(d)];
          if (String(val || '').trim()) {
            people.push({ name: person, duty: String(val) });
          }
        });
        people.sort(function (a, b) { return a.name.localeCompare(b.name, 'hy'); });
        byDay.push({
          graph: bundle.label,
          year: bundle.year,
          month: bundle.month,
          day: d,
          page: bundle.page,
          people: people
        });
      });
    });
    byDay.sort(function (a, b) {
      if (a.year !== b.year) return a.year - b.year;
      if (a.month !== b.month) return a.month - b.month;
      return a.day - b.day;
    });
    return byDay;
  }

  function searchPositionArchive(q) {
    try {
      if (typeof window.kmPositionArchiveSearch === 'function') {
        return window.kmPositionArchiveSearch(q, { limit: 12 }) || [];
      }
    } catch (e0) {}
    return [];
  }

  function findDbPerson(name) {
    try {
      var list = (typeof db !== 'undefined' && Array.isArray(db.people)) ? db.people : [];
      for (var i = 0; i < list.length; i++) {
        if (list[i] && personKeyMatch(list[i].name, name)) return list[i];
      }
    } catch (e0) {}
    return null;
  }

  function findPersonIndex(name) {
    try {
      var list = (typeof db !== 'undefined' && Array.isArray(db.people)) ? db.people : [];
      for (var i = 0; i < list.length; i++) {
        if (list[i] && personKeyMatch(list[i].name, name)) return i;
      }
    } catch (e0) {}
    return -1;
  }

  function extractPersonNameFromTitle(title) {
    var t = String(title || '').trim();
    if (!t) return '';
    var m = t.match(/(?:Անձի\s*քարտ|Պաշտոն\s*քարտ)\s*·\s*(.+)$/i);
    if (m && m[1]) return String(m[1]).trim();
    if (t.indexOf(' · ') >= 0) {
      var parts = t.split(' · ');
      return String(parts[parts.length - 1] || '').trim();
    }
    return t;
  }

  function findPosIdForPersonName(name) {
    name = String(name || '').trim();
    if (!name) return '';
    try {
      if (typeof window.kmPeopleFromPositions === 'function') {
        var roster = window.kmPeopleFromPositions() || [];
        for (var r = 0; r < roster.length; r++) {
          if (roster[r] && personKeyMatch(roster[r].name, name) && roster[r].posId) return roster[r].posId;
        }
      }
      var positions = (typeof db !== 'undefined' && Array.isArray(db.userPositions)) ? db.userPositions : [];
      for (var i = 0; i < positions.length; i++) {
        var p = positions[i];
        if (!p) continue;
        if (p.personName && personKeyMatch(p.personName, name)) return p.id || '';
      }
    } catch (e0) {}
    return '';
  }

  function buildActionForLiveHit(h, lang, fallbackPersonName) {
    if (!h || h.kind === 'position_archive') return null;
    lang = lang || getLang();
    var kind = String(h.kind || '');
    var title = String(h.title || '');
    var personName = String(fallbackPersonName || '').trim();
    if (kind === 'person_card' || kind === 'position_card') {
      personName = extractPersonNameFromTitle(title) || personName;
    }
    var openHy = lang === 'ru' ? 'Открыть: ' : (lang === 'en' ? 'Open: ' : 'Բացել՝ ');
    if (kind === 'person_card' && personName) {
      return { label: openHy + personName.slice(0, 32), personName: personName, mode: 'person_card' };
    }
    if (kind === 'position_card') {
      var posId = (h.extra && h.extra.posId) || findPosIdForPersonName(personName || extractPersonNameFromTitle(title));
      var pn = personName || extractPersonNameFromTitle(title);
      if (posId) {
        return {
          label: openHy + (lang === 'ru' ? 'Карточка должности' : (lang === 'en' ? 'Position card' : 'Պաշտոն քարտ')),
          posId: posId,
          mode: 'position_card'
        };
      }
      if (pn) {
        return { label: openHy + pn.slice(0, 32), personName: pn, page: 'positions', mode: 'position_card' };
      }
    }
    if (kind === 'position_slot' && h.extra && h.extra.id) {
      return { label: openHy + title.slice(0, 32), posId: h.extra.id, mode: 'position_card' };
    }
    if (kind === 'schedule_list' || h.page === 'schedule') {
      return { label: lang === 'ru' ? 'График' : (lang === 'en' ? 'Schedule' : 'Գրաֆիկ'), page: 'schedule' };
    }
    if (h.page === 'people' && personName) {
      return { label: openHy + personName.slice(0, 28), personName: personName, page: 'people' };
    }
    if (h.page) {
      var pg = h.page === 'unitDocs' ? 'unitTools' : (h.page === 'notes' ? 'library' : h.page);
      return {
        label: openHy + (title || kindLabel(kind, lang)).slice(0, 32),
        page: pg
      };
    }
    return null;
  }

  function buildPersonNavActions(personName, lang) {
    personName = String(personName || '').trim();
    if (!personName) return [];
    lang = lang || getLang();
    var openHy = lang === 'ru' ? 'Открыть: ' : (lang === 'en' ? 'Open: ' : 'Բացել՝ ');
    var out = [
      { label: openHy + personName.slice(0, 32), personName: personName, mode: 'person_card' }
    ];
    var posId = findPosIdForPersonName(personName);
    if (posId) {
      out.push({
        label: openHy + (lang === 'ru' ? 'Карточка должности' : (lang === 'en' ? 'Position card' : 'Պաշտոն քարտ')),
        posId: posId,
        mode: 'position_card'
      });
    }
    out.push({ label: lang === 'ru' ? 'Личный состав и должности' : (lang === 'en' ? 'Personnel and positions' : 'Անձնակազմ և Պաշտոն'), page: 'people' });
    out.push({ label: lang === 'ru' ? 'График' : (lang === 'en' ? 'Schedule' : 'Գրաֆիկ'), page: 'schedule' });
    return out;
  }

  function kindLabel(kind, lang) {
    var k = String(kind || '');
    var hy = {
      unit_doc: 'Աշխատանքային գործիքներ · Փաստաթուղթ', /* KM_MENU_REORG_V1 */
      schedule_list: 'Գրաֆիկ',
      order_text: 'Հրամանի նախագիծ',
      note: 'Նշում / գրանցում',
      char_draft: 'Բնութագիր',
      exam_draft: 'Ծառայողական քննություն',
      position_archive: 'Պաշտոն արխիվ',
      inventory: 'Գույք',
      fuel: 'Վառելիք',
      day_plan: 'Օրվա կարգացուցակ',
      blank: 'Ձևաթուղթ',
      spreadsheet: 'Աղյուսակ',
      table: 'Աղյուսակ',
      discipline: 'Կարգապահական տույժ',
      encouragement: 'Խրախուսանք',
      work_status: 'Աշխատանքային վիճակ',
      accounting: 'Հաշվառում'
    };
    var ru = {
      unit_doc: 'Рабочие инструменты · Документ',
      schedule_list: 'График',
      order_text: 'Проект приказа',
      note: 'Заметка',
      char_draft: 'Характеристика',
      exam_draft: 'Служебное расследование',
      position_archive: 'Архив должностей',
      inventory: 'Имущество',
      fuel: 'Топливо',
      day_plan: 'Распорядок дня',
      blank: 'Бланк',
      spreadsheet: 'Таблица',
      table: 'Таблица',
      discipline: 'Взыскание',
      encouragement: 'Поощрение',
      work_status: 'Рабочий статус',
      accounting: 'Учёт'
    };
    var en = {
      unit_doc: 'Work tools · Document',
      schedule_list: 'Schedule',
      order_text: 'Order draft',
      note: 'Note',
      char_draft: 'Characteristic',
      exam_draft: 'Service exam',
      position_archive: 'Positions archive',
      inventory: 'Inventory',
      fuel: 'Fuel',
      day_plan: 'Day plan',
      blank: 'Form',
      spreadsheet: 'Spreadsheet',
      table: 'Table',
      discipline: 'Penalty',
      encouragement: 'Encouragement',
      work_status: 'Work status',
      accounting: 'Accounting'
    };
    if (lang === 'ru') return ru[k] || k;
    if (lang === 'en') return en[k] || k;
    return hy[k] || k;
  }

  function formatLiveHitLine(h, lang) {
    if (!h || h.kind === 'position_archive') return '';
    var label = kindLabel(h.kind, lang);
    var title = String(h.title || '').trim() || '—';
    var snip = h.snippet ? (' — «' + String(h.snippet).slice(0, 110) + '»') : '';
    return '• ' + label + ' · ' + title + snip;
  }

  /* Ցույց տալ ֆայլի տեղը՝ առանց ավտոմատ բացելու */
  function formatFilePlace(h, lang) {
    var parts = [];
    if (h.area) parts.push(String(h.area));
    var sec = h.sectionLabel || h.section || '';
    if (sec) parts.push(String(sec));
    if (h.name) parts.push(String(h.name));
    var path = parts.filter(Boolean).join(' › ');
    if (!path) path = String(h.name || h.title || '—');
    if (lang === 'ru') return 'Место: ' + path;
    if (lang === 'en') return 'Location: ' + path;
    return 'Տեղը՝ ' + path;
  }

  function pushSearchBlob(out, kind, title, text, page, extra) {
    var body = String(text || '').replace(/\s+/g, ' ').trim();
    if (!body || body.length < 2) return;
    out.push({
      kind: kind,
      title: String(title || kind),
      text: body.slice(0, 4000),
      page: page || '',
      extra: extra || null
    });
  }

  function collectLiveSearchCorpus() {
    var out = [];
    try {
      if (typeof db === 'undefined' || !db) return out;
      (db.dutyTypes || []).forEach(function (n, i) {
        pushSearchBlob(out, 'schedule_list', 'Վերակարգ · ' + n, String(n), 'dutyTypes', { index: i });
      });
      try {
        var sch = db.schedule || {};
        pushSearchBlob(out, 'schedule_list', 'Գրաֆիկ · ' + (sch.name || 'Հիմնական'),
          [sch.name, sch.year, sch.month].join(' '),
          'schedule');
      } catch (eSch) {}
      try {
        Object.keys(db.dutyTypeSchedules || {}).forEach(function (k) {
          var s = db.dutyTypeSchedules[k] || {};
          var label = s.name || (db.dutyTypes && db.dutyTypes[k]) || k;
          pushSearchBlob(out, 'schedule_list', 'Գրաֆիկ · ' + label,
            [label, k, s.year, s.month].join(' '),
            'schedule');
        });
      } catch (eDts) {}
      (db.futureSchedules || []).forEach(function (fs) {
        if (!fs) return;
        pushSearchBlob(out, 'schedule_list', 'Ապագա գրաֆիկ · ' + (fs.name || ''),
          [fs.name, fs.year, fs.month].join(' '), 'schedule');
      });
      if (db.orderDraft && typeof db.orderDraft === 'object') {
        var od = db.orderDraft;
        var parts = [
          od.title, od.number, od.preamble, od.basis, od.header, od.footer,
          od.commander, od.unit, Array.isArray(od.points) ? od.points.join('\n') : ''
        ];
        pushSearchBlob(out, 'order_text', 'Հրամանի նախագիծ', parts.join('\n'), 'orderDraft');
      }
      (db.unitDocs || []).forEach(function (d) {
        if (!d) return;
        var docTitle = String(d.templateTitle || d.title || d.name || d.template || 'Փաստաթուղթ').trim();
        if (d.person) docTitle += ' · ' + d.person;
        pushSearchBlob(out, 'unit_doc', docTitle,
          [d.templateTitle, d.title, d.name, d.template, d.person, d.rank, d.unit, d.post,
            d.reason, d.from, d.to, d.text, d.body, d.html].join(' '),
          'unitDocs',
          { id: d.id, template: d.template || '' });
      });
      (db.notebookNotes || []).forEach(function (n) {
        if (!n) return;
        pushSearchBlob(out, 'note', n.title || 'Նշում', [n.title, n.text, n.body].join(' '), 'library');
      });
      (db.registrations || []).forEach(function (r) {
        if (!r) return;
        pushSearchBlob(out, 'note', r.title || 'Գրանցում', [r.title, r.text, r.note, r.body].join(' '), 'notes');
      });
      try {
        if (Array.isArray(db.unitCharDrafts)) {
          db.unitCharDrafts.forEach(function (c) {
            if (!c) return;
            var t = (c.title || 'Բնութագիր') + (c.person ? (' · ' + c.person) : '');
            pushSearchBlob(out, 'char_draft', t, [c.title, c.text, c.body, c.person, c.html].join(' '), 'unitTrialChar', { id: c.id });
          });
        }
      } catch (eCh) {}
      try {
        if (Array.isArray(db.unitTrialExamDrafts)) {
          db.unitTrialExamDrafts.forEach(function (c) {
            if (!c) return;
            var t = (c.title || 'Քննություն') + (c.person ? (' · ' + c.person) : '');
            pushSearchBlob(out, 'exam_draft', t,
              [c.title, c.text, c.body, c.conclusion, c.person].join(' '), 'unitTrialExam', { id: c.id });
          });
        }
      } catch (eEx) {}
      try {
        (db.unitInventory || []).forEach(function (m) {
          if (!m) return;
          pushSearchBlob(out, 'inventory',
            (m.category ? m.category + ' · ' : '') + (m.name || 'Գույք'),
            [m.category, m.name, m.unit, m.qty, m.kind, m.note, m.person].join(' '),
            'unitInventory');
        });
      } catch (eInv) {}
      try {
        (db.unitFuel || []).forEach(function (m) {
          if (!m) return;
          pushSearchBlob(out, 'fuel', m.vehicle || m.name || 'Վառելիք',
            [m.vehicle, m.name, m.liters, m.note, m.date].join(' '), 'unitFuel');
        });
      } catch (eFuel) {}
      try {
        (db.unitDayPlans || []).forEach(function (m) {
          if (!m) return;
          pushSearchBlob(out, 'day_plan', m.title || m.date || 'Օրվա կարգացուցակ',
            [m.title, m.date, m.text, m.body, m.note].join(' '), 'unitDayPlans');
        });
      } catch (eDay) {}
      try {
        (db.unitBlanks || []).forEach(function (m) {
          if (!m) return;
          pushSearchBlob(out, 'blank', m.title || m.name || 'Ձևաթուղթ',
            [m.title, m.name, m.text, m.body].join(' '), 'unitBlanks');
        });
      } catch (eBl) {}
      try {
        (db.spreadsheets || []).forEach(function (s) {
          if (!s) return;
          pushSearchBlob(out, 'spreadsheet', s.name || s.title || 'Աղյուսակ',
            [s.name, s.title, JSON.stringify(s.sheets || s.data || '').slice(0, 2000)].join(' '),
            'spreadsheets');
        });
      } catch (eSs) {}
      try {
        (db.tables || []).forEach(function (t) {
          if (!t) return;
          pushSearchBlob(out, 'table', t.name || t.title || 'Աղյուսակ',
            [t.name, t.title, JSON.stringify(t).slice(0, 1500)].join(' '), 'tables');
        });
      } catch (eTb) {}
      try {
        (db.disciplinePenalties || []).forEach(function (p) {
          if (!p) return;
          pushSearchBlob(out, 'discipline',
            (p.person || p.name || 'Տույժ') + (p.type ? (' · ' + p.type) : ''),
            [p.person, p.name, p.type, p.reason, p.from, p.to, p.note, p.orderNumber].join(' '),
            'acts_discipline');
        });
      } catch (ePen) {}
      try {
        (db.encouragements || []).forEach(function (p) {
          if (!p) return;
          pushSearchBlob(out, 'encouragement',
            (p.person || p.name || 'Խրախուսանք') + (p.type ? (' · ' + p.type) : ''),
            [p.person, p.name, p.type, p.reason, p.date, p.note].join(' '),
            'lawdocs');
        });
      } catch (eEnc) {}
      try {
        (db.workStatus || []).forEach(function (w) {
          if (!w) return;
          pushSearchBlob(out, 'work_status',
            (w.person || w.name || 'Վիճակ') + (w.status ? (' · ' + w.status) : ''),
            [w.person, w.name, w.status, w.from, w.to, w.note].join(' '),
            'workStatus');
        });
      } catch (eWs) {}
      /* Պաշտոն արխիվ + քարտեր — լրիվ կորպուս */
      try {
        if (typeof window.kmPeopleFromPositions === 'function') {
          (window.kmPeopleFromPositions() || []).forEach(function (p) {
            if (!p) return;
            pushSearchBlob(out, 'position_card',
              'Պաշտոն քարտ · ' + (p.name || ''),
              [p.name, p.unit, p.post, p.code, p.rank, p.posId].join(' '),
              'positions', { posId: p.posId || '' });
          });
        }
      } catch (ePos) {}
      try {
        (db.userPositions || []).forEach(function (up) {
          if (!up) return;
          var title = (up.vacant ? 'Թափուր պաշտոն · ' : 'Պաշտոն · ') + (up.position || up.personName || '');
          pushSearchBlob(out, 'position_slot',
            title,
            [up.position, up.section, up.unit, up.code, up.rankSlot, up.personName,
              up.vacant ? 'թափուր vacant' : 'համալրված', up.catalogId, up.archId].join(' '),
            'positions', { id: up.id, vacant: !!up.vacant });
        });
      } catch (eUp) {}
      try {
        (db.people || []).forEach(function (p) {
          if (!p) return;
          pushSearchBlob(out, 'person_card',
            'Անձի քարտ · ' + (p.name || ''),
            personCardBlob(p),
            'people');
        });
      } catch (ePe) {}
      try {
        (db.archives || db.archive || []).forEach(function (a) {
          if (!a) return;
          var snap = a.snapshot || a.data || {};
          var label = a.label || a.name || a.id || 'Արխիվ';
          var peopleN = (snap.people || []).length;
          var sch = snap.schedule || {};
          pushSearchBlob(out, 'app_archive',
            'Արխիվ · ' + label,
            [label, a.month, a.year, a.createdAt, peopleN + ' անձ', sch.name, JSON.stringify(sch.formalGraph || {}).slice(0, 500)].join(' '),
            'archive', { id: a.id });
        });
      } catch (eAr) {}
      /* Բաժինների քարտեզ — ինքնաճանաչում */
      try {
        SECTION_TREE.forEach(function (sec) {
          pushSearchBlob(out, 'section_map',
            'Բաժին · ' + sec.label,
            [sec.label, sec.id, (sec.kids || []).join(' '), 'կառուցվածք համակարգ'].join(' '),
            sec.page || sec.id);
        });
      } catch (eSec) {}
    } catch (e0) {}
    return out;
  }

  function searchLiveAppContent(q) {
    var qLower = String(q || '').toLowerCase().trim();
    if (!qLower || qLower.length < 2) return [];
    var tokens = qLower.split(/\s+/).filter(function (t) { return t.length >= 2; }).slice(0, 8);
    var hits = [];
    var now = Date.now();
    var corpus = LIVE_CORPUS_CACHE.rows;
    if (!corpus || (now - LIVE_CORPUS_CACHE.at) > 60000 || !LIVE_CORPUS_CACHE.epoch) {
      corpus = collectLiveSearchCorpus();
      if (corpus.length > 4000) corpus = corpus.slice(0, 4000);
      LIVE_CORPUS_CACHE = { at: now, rows: corpus, epoch: KNOWLEDGE_EPOCH || LIVE_CORPUS_CACHE.epoch || now };
    }
    corpus.forEach(function (row) {
      var tl = String(row.text || '').toLowerCase();
      var titleL = String(row.title || '').toLowerCase();
      var score = 0;
      if (tl.includes(qLower) || titleL.includes(qLower)) score += 12;
      tokens.forEach(function (t) {
        if (tl.includes(t)) score += 2;
        if (titleL.includes(t)) score += 1;
        else if (corpus.length <= 800) {
          var words = tl.split(/\s+/);
          for (var wi = 0; wi < words.length && wi < 80; wi++) {
            var fb = fuzzyBoost([t], words[wi]);
            if (fb) { score += fb * 0.45; break; }
          }
        }
      });
      score += learnedTokenBoost(tokens);
      if (score < 3.5) return;
      if (row.kind === 'position_archive') return;
      var idx = tl.indexOf(qLower);
      if (idx < 0) {
        for (var i = 0; i < tokens.length; i++) {
          idx = tl.indexOf(tokens[i]);
          if (idx >= 0) break;
        }
      }
      if (idx < 0) idx = 0;
      var snippet = String(row.text || '').slice(Math.max(0, idx - 40), Math.min(row.text.length, idx + 140)).trim();
      hits.push({
        kind: row.kind,
        title: row.title,
        page: row.page,
        score: score,
        snippet: snippet,
        extra: row.extra || null
      });
    });
    hits.sort(function (a, b) { return b.score - a.score; });
    return hits.slice(0, 8);
  }

  async function searchBotRagHybrid(q, lang) {
    var api = window.kmNative && window.kmNative.botRag;
    if (!api || typeof api.multiStep !== 'function') return null;
    try {
      await syncKnowledgeEpoch();
      var r = await api.multiStep({
        query: q,
        lang: lang || getLang(),
        limit: SEARCH_RESULT_LIMIT,
        learnWeb: false,
        minScore: RAG_MIN_HYBRID
      });
      if (!r || !r.ok) return null;
      var strongHits = (r.hits || []).filter(function (h) {
        return Number(h.score || 0) >= RAG_MIN_HYBRID || Number(h.metaBoost || 0) >= 8;
      });
      var strongAns = (r.answers || []).filter(function (a) {
        var h = a && a.hit;
        return h && (Number(h.score || 0) >= RAG_MIN_HYBRID || Number(h.metaBoost || 0) >= 8);
      });
      if (!strongAns.length && !strongHits.length) return null;
      r.hits = strongHits.slice(0, SEARCH_RESULT_LIMIT);
      r.answers = strongAns.slice(0, SEARCH_RESULT_LIMIT);
      return r;
    } catch (e0) {
      return null;
    }
  }

  function isPersonnelHit(h) {
    if (!h) return false;
    if (h.kind === 'position' || h.kind === 'personnel' || h.kind === 'people' ||
        h.kind === 'person_card' || h.kind === 'position_card' || h.kind === 'position_slot' ||
        h.kind === 'roster') return true;
    if (h.kind === 'position_archive') return false;
    if (/(անձնակազմ|պաշտոն|персонал|personnel|position)/i.test(String(h.section || '') + ' ' + String(h.sectionLabel || '') + ' ' + String(h.area || ''))) {
      return true;
    }
    return !!(h.persons && h.persons.length);
  }

  function isLawHit(h) {
    if (!h) return false;
    if (h.kind === 'laws' || h.area === 'Իրավական անկյուն' || h.area === 'Իրավաբանական անկյուն') return true; /* KM_LEGAL_RENAME_V1 compat */
    return /(իրավ|օրենք|հրաման|приказ|акты|legal)/i.test(String(h.section || '') + ' ' + String(h.sectionLabel || '') + ' ' + String(h.kind || ''));
  }

  function buildRagDocumentHit(rag, lang) {
    if (!rag) return null;
    lang = lang || getLang();
    var answers = (rag.answers || []).filter(function (a) {
      var h = a && a.hit;
      return h && (Number(h.score || 0) >= RAG_MIN_HYBRID || Number(h.metaBoost || 0) >= 8);
    });
    if (!answers.length) return null;

    var lawAns = [];
    var peopleAns = [];
    var otherAns = [];
    answers.forEach(function (a) {
      var h = a.hit || {};
      if (isPersonnelHit(h)) peopleAns.push(a);
      else if (isLawHit(h)) lawAns.push(a);
      else otherAns.push(a);
    });
    lawAns = lawAns.slice(0, SEARCH_LAW_TOP);
    peopleAns = peopleAns.slice(0, SEARCH_PEOPLE_TOP);
    var remain = Math.max(0, SEARCH_RESULT_LIMIT - lawAns.length - peopleAns.length);
    otherAns = otherAns.slice(0, remain);

    var actions = [];
    var groups = [];
    var intro = [];
    if (lang === 'ru') intro.push('Найдены релевантные документы (топ ' + SEARCH_RESULT_LIMIT + '). Нажмите «Открыть».');
    else if (lang === 'en') intro.push('Relevant documents (top ' + SEARCH_RESULT_LIMIT + '). Tap Open.');
    else intro.push('Գտնվել են համապատասխան փաստաթղթեր (առավելագույնը ' + SEARCH_RESULT_LIMIT + ')։ Սեղմեք «Բացել»։');

    function pushGroup(title, list, kind) {
      if (!list.length) return;
      var lines = [];
      var gActs = [];
      list.forEach(function (a, i) {
        var h = a.hit || {};
        formatStructuredDocLines({
          area: h.area || (isLawHit(h) ? 'Իրավական անկյուն' : 'Ֆայլերի պահոց'), /* KM_MENU_REORG_V1 */
          section: h.section,
          sectionLabel: h.sectionLabel,
          name: h.name,
          snippet: h.quote || h.preview || '',
          hasText: !!(h.quote || h.preview),
          ext: String(h.name || '').split('.').pop() || '',
          kind: h.kind
        }, lang).forEach(function (ln) { lines.push(ln); });
        lines.push('');
        var act = null;
        if (h.kind === 'laws' && h.section) {
          act = {
            label: (lang === 'ru' ? 'Открыть: ' : (lang === 'en' ? 'Open: ' : 'Բացել՝ ')) + String(h.name || '').slice(0, 28),
            page: 'lawdocs',
            lawId: h.id,
            lawSection: h.section
          };
        } else if (isPersonnelHit(h)) {
          var pn = extractPersonNameFromTitle(h.name || h.title || '');
          act = buildActionForLiveHit({ kind: h.kind || 'person_card', title: h.name, page: h.page, extra: h.extra }, lang, pn) ||
            { label: (lang === 'ru' ? 'Открыть: ' : (lang === 'en' ? 'Open: ' : 'Բացել՝ ')) + String(h.name || 'Անձնակազմ').slice(0, 28), page: 'people', personName: pn };
        } else if (h.kind === 'library') {
          act = {
            label: (lang === 'ru' ? 'Открыть: ' : (lang === 'en' ? 'Open: ' : 'Բացել՝ ')) + String(h.name || '').slice(0, 28),
            page: 'library',
            libId: h.id,
            libType: h.type || ''
          };
        } else {
          act = {
            label: (lang === 'ru' ? 'Открыть раздел' : (lang === 'en' ? 'Open section' : 'Բացել բաժին')),
            page: kind === 'people' ? 'positions' : 'lawdocs'
          };
        }
        if (act) {
          gActs.push(act);
          actions.push(act);
        }
      });
      groups.push({ id: kind, title: title, lines: lines, actions: gActs, open: true });
    }

    pushGroup(lang === 'ru' ? 'Юридические акты' : (lang === 'en' ? 'Legal acts' : 'Իրավական ակտեր'), lawAns, 'laws');
    pushGroup(lang === 'ru' ? 'Личный состав' : (lang === 'en' ? 'Personnel' : 'Անձնակազմ'), peopleAns, 'people');
    pushGroup(lang === 'ru' ? 'Другие документы' : (lang === 'en' ? 'Other documents' : 'Այլ փաստաթղթեր'), otherAns, 'other');

    if (!groups.length) return null;

    if (rag.filters && (rag.filters.orderNums || []).length) {
      intro.push((lang === 'ru' ? 'Фильтр №: ' : (lang === 'en' ? 'Filter #: ' : 'Ֆիլտր №՝ ')) + rag.filters.orderNums.join(', '));
    }

    return {
      kind: 'topic',
      score: 96,
      intent: 'doc_rag',
      alts: [],
      topic: {
        id: 'doc_rag',
        title: lang === 'ru' ? 'Результаты поиска' : (lang === 'en' ? 'Search results' : 'Որոնման արդյունքներ'),
        answer: intro,
        groups: groups,
        actions: actions.slice(0, SEARCH_RESULT_LIMIT),
        _localized: true
      }
    };
  }
  async function searchLibraryFileContents(q) {
    var lib = window.kmNative && window.kmNative.library;
    if (!lib || typeof lib.searchContent !== 'function') return [];
    try {
      await syncKnowledgeEpoch();
      var qn = norm(q);
      var preferLaws = /(օրենք|իրավ|հրաման|акт|приказ|legal|law|юрид)/i.test(qn) || !/(գրադարան|library|գործիք|հաշվառ|պաշտոն)/i.test(qn);
      var r = await lib.searchContent({
        query: q,
        limit: 18,
        maxExtract: 48,
        maxHtmlExtract: 80,
        preferLaws: preferLaws,
        preferHtml: true,
        wordBudget: 1,
        allowWordCom: false,
        /* light=true: JSZip full-text for DOCX/XLSX/PPTX + PDF/HTML (no PowerShell block) */
        light: true,
        timeBudgetMs: 4000,
        lawLimit: 120,
        libLimit: 80
      });
      if (!r || !r.ok) return [];
      return (Array.isArray(r.hits) ? r.hits : []).filter(function (h) {
        return h && h.id && (h.hasText || h.titleOnly === true || h.snippet);
      });
    } catch (e0) {
      return [];
    }
  }

  function resolveFollowUpQuery(q) {
    var raw = String(q || '').trim();
    var ql = raw.toLowerCase();
    var ref = /(այդ|նույն|այն|էդ|этот|эта|то же|that|same|it\b|его|её)/i.test(ql);
    if (!ref) return raw;
    var bits = [];
    if (DIALOG_FOCUS.person) bits.push(DIALOG_FOCUS.person);
    if (DIALOG_FOCUS.lawNum) bits.push(DIALOG_FOCUS.lawNum);
    if (DIALOG_FOCUS.fileName) bits.push(DIALOG_FOCUS.fileName);
    if (!bits.length && DIALOG_FOCUS.lastQuery) bits.push(DIALOG_FOCUS.lastQuery);
    if (!bits.length) return raw;
    var cleaned = raw
      .replace(/(այդ|նույն|այն|էդ)\s*(ֆայլ|հրաման|փաստաթուղթ|անձ|որոշում)?/gi, ' ')
      .replace(/(этот|эта|то же|that|same)\s*(file|order|document|person)?/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return (bits.join(' ') + (cleaned ? (' ' + cleaned) : '')).trim();
  }

  function rememberDialogFocus(q, hit) {
    try {
      if (hit && hit.topic && Array.isArray(hit.topic.answer)) absorbLearningFromText(hit.topic.answer.join(' '), 1);
      if (hit && hit.intent === 'content_search') absorbLearningFromText(q, 2);
      if (hit && hit.intent === 'person_lookup') absorbLearningFromText(q, 2);
      absorbLearningFromText(q, 1);
    } catch (eAbs) {}

    DIALOG_FOCUS.lastQuery = String(q || '').slice(0, 120);
    var num = extractLawDocNumber(q);
    if (num) DIALOG_FOCUS.lawNum = num;
    if (hit && hit.topic) {
      DIALOG_FOCUS.topicId = hit.topic.id || DIALOG_FOCUS.topicId;
      var title = textify(hit.topic.title || '');
      if (title && /№|հրաման|приказ|order|փաստաթուղթ|document/i.test(title)) {
        DIALOG_FOCUS.fileName = title.slice(0, 80);
      }
      if (hit.intent === 'person_lookup' || (hit.topic.id && String(hit.topic.id).indexOf('person') >= 0)) {
        var m = title.match(/«([^»]+)»/) || title.match(/"([^"]+)"/);
        if (m) DIALOG_FOCUS.person = m[1];
      }
    }
    var nameGuess = String(q || '').match(/([Ա-ՖԵև][ա-ֆև]+(?:\s+[Ա-ՖԵև][ա-ֆև]+){1,3})/);
    if (nameGuess) DIALOG_FOCUS.person = nameGuess[1];
  }

  /* ——— Intent routing: casual chat vs document/data search ——— */
  var SEARCH_RESULT_LIMIT = 5;
  var SEARCH_LAW_TOP = 2;
  var SEARCH_PEOPLE_TOP = 2;
  var SEARCH_MIN_SCORE = 10;
  var RAG_MIN_HYBRID = 4.5;
  /** BotKnowledge FTS / vector — raised floors so weak BM25 ≠ random curriculum */
  var BK_MIN_SCORE_STRONG = 0.58;
  var BK_MIN_SCORE_WEAK = 0.42;

  function hasLauncherVerb(q) {
    return /(բաց(իր|ել|ի|տուր)?|open|открой|открыть|show\s+me|գնա|go\s+to|navigate|перейди|բաց\s+տուր)/i.test(norm(q));
  }

  function isNameLikeToken(w) {
    w = String(w || '');
    if (!w || w.length < 3) return false;
    if (/(ամ|եմ|ես|ենք|եք|ել|ալ|ում|անք|ացի|ոնց)$/i.test(w)) return false;
    if (/(յան|եան|անց|ունի)$/i.test(w)) return true;
    if (/ի$/i.test(w) && w.length >= 4) return true;
    return w.length >= 3 && w.length <= 16;
  }

  function looksLikePersonNameQuery(q) {
    var s = norm(q).replace(/[։.:!?¿՞,«»"]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (!s || s.length > 56) return false;
    if (isEmotionalDistress(q)) return false;
    if (/^ինչ\s*(է|են)\s+/i.test(s)) return false;
    if ((isDefinitionalQuestion(q) || looksLikeGeneralKnowledge(q)) &&
        !/(?:^|\s)[\u0531-\u0587]{5,}(?:յան|եան|անց)(?:ը|ն)?(?:\s|$)/i.test(s)) return false;
    if (isProgramAuthorAsk(q) || isIdentityAsk(q) || isWhoAmIAsk(q) || isCasualChat(q)) return false;
    if (/(ինչ|օվ է|ով է|որ է|what|who|как|ֆայլ|pdf|օրենք|բաժին|էջ|հեղինակ|ծրագր|ոնց|հանգստ)/i.test(s) &&
        !/(քարտ|(?:^|\s)[\u0531-\u0587]{5,}(?:յան|եան)(?:ը|ն)?(?:\s|$))/i.test(s)) return false;
    if (/(^|\s)(ես|դու|նա|մենք|դուք|շատ|եմ|ենք|եք|կարող|ասել|հոգն|հոքն|տխուր|գնամ|ոնց)(\s|$)/i.test(s)) return false;
    var STOP = {
      ես: 1, դու: 1, նա: 1, մենք: 1, դուք: 1, նրանք: 1, շատ: 1, եմ: 1, են: 1, է: 1,
      էր: 1, չեմ: 1, չես: 1, չի: 1, կարող: 1, ասել: 1, ասա: 1, խնդրում: 1, ինձ: 1,
      ոնց: 1, ինչպես: 1, գնամ: 1, օվ: 1
    };
    var words = s.replace(/^(օվ|ով)\s*(է|են)\s+/i, '').split(/\s+/).filter(function (w) {
      return /^[\u0531-\u0587а-яёa-z]{2,32}$/i.test(w) && !STOP[w] && isNameLikeToken(w);
    });
    if (words.length < 2 || words.length > 4 || s.length < 5) return false;
    return words.some(function (w) { return /(յան|եան|անց)$/i.test(w) || (/ի$/i.test(w) && w.length >= 5); }) ||
      words.length >= 3;
  }

  function isWhoAmIAsk(q) {
    var s = norm(q);
    return /((դու\s+)?գիտես\s+ես\s+ով\s+եմ|գիտե՞?ս\s+ես\s+ով\s+եմ|ես\s+ով\s+եմ|ով\s+եմ\s+ես|գիտե՞?ս\s+ով\s+եմ|who\s+am\s+i|ты\s+знаешь\s+кто\s+я|кто\s+я)/i.test(s);
  }

  function whoAmIReply(lang) {
    var name = userName();
    if (lang === 'ru') {
      return name
        ? 'Да. В этой сессии вы вошли как «' + name + '».'
        : 'Вы пользователь KM Desktop в этом сеансе. Имя входа сейчас не видно.';
    }
    if (lang === 'en') {
      return name
        ? 'Yes. In this session you are signed in as «' + name + '».'
        : 'You are the KM Desktop user in this session. I cannot see a login name right now.';
    }
    return name
      ? 'Այո։ Այս նիստում դուք մուտք եք գործել որպես «' + name + '»։'
      : 'Դուք KM Desktop-ի օգտատերն եք այս նիստում։ Մուտքի անունը հիմա չեմ տեսնում։';
  }

  function isHowAreYouAsk(q) {
    var s = norm(q).replace(/[։.:!?¿՞]+$/g, '').trim();
    return /^(ոնց ես|ինչպես ես|ոնց եք|ինչպես եք|how are you|как дела)$/i.test(s);
  }

  /** Bare «ինչ կա» / what's up — chat, not knowledge-base miss. */
  function isBareWhatsUpAsk(q) {
    var s = norm(q).replace(/[։.:!?¿՞!]+$/g, '').trim();
    if (!s || s.length > 28) return false;
    if (/(բաժին|раздел|անկյուն|section|էջ|page|հաշվառ|պաշտոն|գրաֆիկ|իրավաբան|գրադարան)/i.test(s)) return false;
    return /^(ինչ կա|ինչեր կան|whats? ?up|what is up|что там|что есть)$/i.test(s);
  }

  function isProgramAuthorAsk(q) {
    var s = norm(q);
    return /(ծրագրի\s*հեղինակ|հեղինակն?\s*(է|ով)|ով\s*(է|ե)\s*(ծրագր|ստեղծ|գրել)|who\s+(is\s+)?(the\s+)?author|кто\s+автор|(ով|օվ)\s*(է|են)\s+կորյուն\s+մանուկյան|կորյուն\s+մանուկյան|koryun\s+manukyan)/i.test(s);
  }

  function programAuthorReply(lang) {
    if (lang === 'ru') {
      return 'Автор программы KM Desktop («Учёт нарядов и личного состава») — офицер отделения связи войсковой части 25836 МО РА капитан Корюн Гагикович Манукян.';
    }
    if (lang === 'en') {
      return 'The author of KM Desktop (Duty and personnel records) is Captain Koryun Gagiki Manukyan, communications officer of MoD RA unit 25836.';
    }
    return 'KM Desktop («Վերակարգերի և անձնակազմի հաշվառման») ծրագրի հեղինակը ՀՀ ՊՆ 25836 զորամասի կապի բաժանմունքի սպա կապիտան Կորյուն Գագիկի Մանուկյանն է։';
  }

  function isOpenCardIntent(q) {
    var s = norm(q);
    return /(բաց(իր|ել)?\s*(անձի\s*)?քարտ|open\s*(the\s*)?card|открой\s*карт|քարտը(\s*բաց|$)|քարտադարան)/i.test(s);
  }

  function isBareSectionNoun(q) {
    var s = norm(q).replace(/[։.:!?¿՞]+$/g, '').trim();
    if (!s || s.length > 40) return false;
    if (hasLauncherVerb(q)) return false;
    return /^(օրենք(ներ(ը|ն)?)?|իրավաբան(ական)?(ը)?|իրավունք(ներ(ը|ն)?)?|laws?|закон(ы)?|գրաֆիկ(ներ(ը|ն)?)?|հերթապահութ(յուն(ներ(ը|ն)?)?)?|վերակարգ(երի|ի)?\s*տեսակ(ներ(ը|ն)?)?|անձնակազմ(ը)?|գրադարան(ը)?|հաշվառում(ը)?|քարտադարան(ը)?)$/i.test(s);
  }

  function isDutyTypesCatalogAsk(q) {
    var s = norm(q);
    return /(վերակարգ(երի|ի)?.{0,20}տեսակ|տեսակ(ներ)?.{0,16}վերակարգ|duty\s*types?|виды\s*наряд)/i.test(s);
  }

  function isScheduleCatalogAsk(q) {
    var s = norm(q);
    if (isDutyTypesCatalogAsk(q)) return false;
    return /((ինչ|ինչպիսի|որ)\s*(գրաֆիկ|հերթապահ)|(գրաֆիկ|հերթապահ)(ներ|ություններ)?\s*(կա|կան))/i.test(s);
  }

  function isAppCatalogAsk(q) {
    return isDutyTypesCatalogAsk(q) || isScheduleCatalogAsk(q);
  }

  function liveDutyTypeNames() {
    var names = [];
    try {
      if (typeof db === 'undefined' || !db) return names;
      (db.dutyTypes || []).forEach(function (n) {
        var s = String(n || '').trim();
        if (s && names.indexOf(s) < 0) names.push(s);
      });
      Object.keys(db.dutyTypeSchedules || {}).forEach(function (k) {
        var row = db.dutyTypeSchedules[k] || {};
        var label = String(row.name || (db.dutyTypes && db.dutyTypes[k]) || '').trim();
        if (label && names.indexOf(label) < 0) names.push(label);
      });
    } catch (eDt) {}
    return names.slice(0, 24);
  }

  function buildAppCatalogHit(q, lang) {
    lang = lang || getLang();
    var duty = isDutyTypesCatalogAsk(q);
    var page = duty ? 'dutyTypes' : 'schedule';
    var names = liveDutyTypeNames();
    var purpose = SECTION_PURPOSE[page];
    var lead = purpose
      ? (lang === 'ru' ? purpose.ru : (lang === 'en' ? purpose.en : purpose.hy))
      : '';
    var lines = [];
    if (lead) lines.push(lead);
    if (names.length) {
      lines.push(
        lang === 'ru'
          ? ('Сейчас в программе: ' + names.join(' · ') + '.')
          : (lang === 'en'
            ? ('Currently in the app: ' + names.join(' · ') + '.')
            : ('Այժմ ծրագրում՝ ' + names.join(' · ') + '։'))
      );
    } else {
      lines.push(
        lang === 'ru'
          ? 'Список видов нарядов задаётся в разделе «Наряды».' /* KM_RENAME_LEFTOVERS_V1 */
          : (lang === 'en'
            ? 'Duty types are set in the Duties section.'
            : 'Տեսակների ցանկը կարգավորվում է «Վերակարգ» բաժնում։') /* KM_MENU_REORG_V1 */
      );
    }
    lines.push(
      lang === 'ru'
        ? 'Могу открыть раздел кнопкой ниже.'
        : (lang === 'en' ? 'I can open the section with the button below.' : 'Կարող եմ բացել բաժինը ներքևի կոճակով։')
    );
    var title = pageLabel(page, lang);
    return {
      kind: 'topic',
      topic: {
        id: 'catalog_' + page,
        title: title,
        answer: lines,
        actions: [{
          action: 'navigate',
          page: page,
          route: page,
          label: lang === 'ru' ? 'Открыть раздел' : (lang === 'en' ? 'Open section' : 'Բացել բաժինը')
        }],
        _localized: true
      },
      score: 92,
      autoOpen: '',
      intent: 'catalog'
    };
  }

  function withTimeout(promise, ms, fallback) {
    return new Promise(function (resolve) {
      var done = false;
      var t = setTimeout(function () {
        if (done) return;
        done = true;
        resolve(fallback);
      }, ms);
      Promise.resolve(promise).then(function (v) {
        if (done) return;
        done = true;
        clearTimeout(t);
        resolve(v);
      }, function () {
        if (done) return;
        done = true;
        clearTimeout(t);
        resolve(fallback);
      });
    });
  }

  function archiveConversation(q, a, source, extra) {
    extra = extra || {};
    try {
      if (!window.kmNative || !window.kmNative.conversations || !window.kmNative.conversations.append) return;
      window.kmNative.conversations.append({
        q: String(q || LAST_USER_Q || '').slice(0, 2000),
        a: String(a || '').slice(0, 4000),
        source: String(source || 'helpbot'),
        user: (typeof window.kmAuthUsername === 'string' && window.kmAuthUsername) ? window.kmAuthUsername : 'anon',
        role: window.kmUserRole || '',
        intent: extra.intent || '',
        topic: extra.topicId || extra.topic || '',
        lang: getLang()
      }).catch(function () {});
    } catch (eArch) {}
  }

  /** True when query must never hit FTS / offline KB (open/navigate launcher). */
  function shouldSkipSearchForLauncher(q) {
    if (classifyLauncherIntent(q)) return true;
    var s = norm(q);
    if (hasLauncherVerb(q) && matchNavIntent(s)) return true;
    if (hasLauncherVerb(q) &&
        /(ֆայլ|file|\.(pdf|docx?|xlsx?|pptx?|txt|html?|jsonl?|db|png|jpg)\b|թղթապանակ|folder|directory|պանակ|բաժին|section|page|menu|մենյու)/i.test(s)) {
      return true;
    }
    return false;
  }

  function isTechnicalKnowledgeAsk(q) {
    var s = norm(q);
    return /(fts|bm25|full[\s-]?text|sqlite|vector|offline\s*search|որոնման\s*(համակարգ|մոտոր)|ինչպ(?:ես|ե՞ս)\s*(?:է\s*)?(?:աշխատում|գործում)|how\s+does\s+(?:fts|search|the\s+database|offline)|technical|տեխնիկ)/i.test(s);
  }

  function bkNoMatchReply(q, lang) {
    lang = lang || getLang();
    var topic = 'FTS-ի';
    if (/bm25/i.test(q)) topic = 'BM25-ի';
    else if (/sqlite/i.test(q)) topic = 'SQLite-ի';
    else {
      var hint = extractTeachTopicHint(q) || extractDefinitionalSubject(q);
      if (hint) topic = '«' + hint + '»-ի';
    }
    if (lang === 'ru') {
      return 'С радостью помог бы, но в базе данных не нашёл точной информации о работе ' + topic + '.';
    }
    if (lang === 'en') {
      return 'Happy to help, but I did not find clear information about ' + topic + ' in my knowledge base.';
    }
    return 'Սիրով կօգնեի, սակայն իմ տվյալների բազայում ' + topic + ' աշխատանքի վերաբերյալ հստակ տեղեկություն չգտա։';
  }

  function bkLowScoreReply(q, lang) {
    lang = lang || getLang();
    var hint = extractTeachTopicHint(q) || extractDefinitionalSubject(q) || '';
    if (lang === 'ru') {
      return 'С радостью помог бы, но в базе данных не нашёл точной информации' +
        (hint ? ' о «' + hint + '».' : '.');
    }
    if (lang === 'en') {
      return 'Happy to help, but I did not find clear information' +
        (hint ? ' about «' + hint + '»' : '') + ' in my knowledge base.';
    }
    return 'Սիրով կօգնեի, սակայն իմ տվյալների բազայում' +
      (hint ? ' «' + hint + '»-ի' : '') + ' վերաբերյալ հստակ տեղեկություն չգտա։';
  }

  function isCannedDomainOverview(hit) {
    if (!hit) return false;
    var a = String(hit.a || '');
    var eng = String(hit.engine || hit.source || '');
    return eng === 'domain-overview' || /ուսումնական առարկա է գիտելիքների բազայում/.test(a);
  }

  function pickCleanKbHits(hits) {
    var out = [];
    var seen = Object.create(null);
    (hits || []).forEach(function (h) {
      if (!h || !String(h.a || '').trim() || isCannedDomainOverview(h)) return;
      var k = String(h.id || '') + '|' + String(h.a || '').slice(0, 64);
      if (seen[k]) return;
      seen[k] = 1;
      out.push(h);
    });
    return out;
  }

  function looksLikeCalcAsk(q) {
    var s = String(q || '');
    if (!/\d+\s*[+\-×xх*/÷]\s*\d+/.test(s)) return false;
    return /հաշվի['՛´`]?ր|հաշվիր|հաշվել|calculate|compute|посчит/i.test(s) ||
      /^\s*\d+\s*[+\-×xх*/÷]\s*\d+/.test(s);
  }

  function evalSafeArith(expr) {
    var s = String(expr || '')
      .replace(/[×xх]/gi, '*')
      .replace(/÷/g, '/')
      .replace(/,/g, '.')
      .replace(/\s+/g, '');
    var m = s.match(/^(-?\d+(?:\.\d+)?)([+\-*/])(-?\d+(?:\.\d+)?)$/);
    if (!m) return null;
    var a = Number(m[1]), op = m[2], b = Number(m[3]);
    if (!isFinite(a) || !isFinite(b)) return null;
    var n = op === '+' ? a + b : op === '-' ? a - b : op === '*' ? a * b : (b === 0 ? null : a / b);
    if (n == null || !isFinite(n)) return null;
    return n;
  }

  function localCalculatorReply(q, lang) {
    if (!looksLikeCalcAsk(q)) return '';
    var exprs = [];
    String(q || '').replace(/(\d+(?:[.,]\d+)?)\s*([+\-×xх*/÷])\s*(\d+(?:[.,]\d+)?)/g, function (_, a, op, b) {
      exprs.push(a + op + b);
      return _;
    });
    if (!exprs.length) return '';
    var lines = [];
    exprs.forEach(function (e) {
      var n = evalSafeArith(e);
      var shown = e.replace(/[xх]/gi, '×').replace(/\*/g, '×').replace(/\//g, '÷');
      lines.push(n == null ? shown : (shown + ' = ' + n));
    });
    if (lang === 'ru') return 'Счёт:\n' + lines.join('\n');
    if (lang === 'en') return 'Result:\n' + lines.join('\n');
    return 'Հաշվարկ.\n' + lines.join('\n');
  }

  function isBkHitStrong(hit) {
    if (!hit) return false;
    if (isCannedDomainOverview(hit)) return false;
    return Number(hit.score || 0) >= BK_MIN_SCORE_STRONG;
  }

  function isEmotionalDistress(q) {
    var s = norm(q);
    var raw = String(q || '').trim();
    if (!s || s.length < 3) return false;
    /* Personal emotional / mental-state signals — checked before any search */
    if (/(հոգեկան\s*(անկայուն|վիճակ|խնդիր|ճնշում)|անկայուն\s*վիճակ|հոգեկան\s*առողջ)/i.test(s)) return true;
    /* Fatigue / burnout — incl. հոգնել եմ, հոգնած եմ */
    if (/(հոգնած(\s*եմ)?|հոքնած(\s*եմ)?|հոգնել(\s*եմ)?|հոքնել(\s*եմ)?|հոգնեցի|հոգնում(\s*եմ)?|հոգնածություն|հանգստանամ|հանգստանալ|գնամ\s*հանգստ|ուժասպառ|այրված(\s*եմ)?|burnout|выгоран|устал|устала|усталост|exhausted|fatigued|worn\s*out|tired)/i.test(s)) return true;
    /* Low / bad mood — տրամադրություն չունեմ, վատ տրամադրություն */
    if (/(տրամադրություն\s*չունեմ|տրամադրությունս\s*(չկա|վատ|զրո)|վատ\s*տրամադրություն|տրամադրություն\s*չկա|нет\s*настроения|плохое\s*настроение|bad\s*mood|no\s*mood|not\s*in\s*(the\s*)?mood)/i.test(s)) return true;
    if (/(սթրես|стресс|stress(ed)?|тревог|anxiety|անհանգստություն|անհանգիստ(\s*եմ)?)/i.test(s)) return true;
    if (/(օգնության\s*կարիք|օգնի՛?ր\s*ինձ|need\s*help|нужна\s*помощь|мне\s*плохо|ինձ\s*վատ\s*է|վատ\s*եմ\s*զգում|ծանր\s*եմ\s*զգում|վատ\s*եմ)/i.test(s)) return true;
    if (/(տխուր(\s*եմ)?|ընկճված|դեպրեսիա|depression|грустн|печал|հուսահատ|հույսս\s*կտրվ|չեմ\s*դիմանում|չեմ\s*կարողանում\s*(շարունակել|ապրել)|նեղված(\s*եմ)?|վրդովված|մունաթ|ձանձրացել(\s*եմ)?)/i.test(s)) return true;
    if (/(միայնակ(\s*եմ)?|lonely|один\s*и\s*тот|վախենում\s*եմ|panic|խուճապ)/i.test(s)) return true;
    if (/(ինքնասպան|սուիցիդ|suicid|չեմ\s*ուզում\s*ապրել|want\s*to\s*die|не\s*хочу\s*жить)/i.test(s)) return true;
    if (/(հոգեբան|психолог|therap|խոսելու\s*կարիք|լսող\s*ունեն|պարզապես\s*լսիր)/i.test(s) &&
        !/(հրաման|պաշտոն|հաշվառ|№|#\d|pdf|word)/i.test(s)) return true;
    /* Short first-person feeling statements */
    if (raw.length <= 120 &&
        /(զգում\s*եմ|մեջս\s*(վատ|ծանր)|չեմ\s*դիմանում|ուժ\s*չունեմ|էներգիա\s*չունեմ|չեմ\s*ուզում\s*ոչինչ|ծանր\s*է\s*(օրս|սիրտս|մեջս)|тяжело\s*(на\s*душе)?|no\s*energy)/i.test(s) &&
        !wantsContentSearch(s) && !extractLawDocNumber(q) &&
        !/(բաժին|раздел|հրաման|պաշտոն|գրաֆիկ|pdf|word|օրենք)/i.test(s)) return true;
    if (/(^|\s)վատ\s*եմ(\s|$)/i.test(s) &&
        !/(բաժին|раздел|հրաման|պաշտոն|գրաֆիկ|pdf|word|օրենք|հաշվառ)/i.test(s)) return true;
    return false;
  }

  function empathyReply(q, lang) {
    var s = norm(q);
    var crisis = /(ինքնասպան|սուիցիդ|suicid|չեմ\s*ուզում\s*ապրել|want\s*to\s*die|не\s*хочу\s*жить)/i.test(s);
    if (crisis) {
      return lang === 'ru'
        ? 'Мне жаль, что вам так тяжело. Вы не одни. Пожалуйста, обратитесь прямо сейчас к близкому человеку или специалисту, которому доверяете. Я рядом выслушать — без документов и меню, просто по-человечески.'
        : (lang === 'en'
          ? 'I’m sorry you’re carrying so much right now. You are not alone. Please reach out to someone you trust or a professional as soon as you can. I’m here to listen — no files, no menus, just support.'
          : 'Կներեք, որ այս պահին այսքան ծանր է։ Դուք մենակ չեք։ Խնդրում եմ հիմա դիմել վստահելի մարդու կամ մասնագետի։ Ես այստեղ եմ լսելու համար՝ առանց ֆայլերի ու մենյուի, պարզապես որպես աջակից։');
    }
    if (/(հոգնած|հոքնած|հոգնել|հոքնել|հոգնեց|հանգստանամ|հանգստանալ|устал|exhaust|ուժասպառ|tired|worn\s*out)/i.test(s)) {
      return lang === 'ru'
        ? 'Понимаю — усталость накапливается. Сделайте паузу, если можете: вода, короткий отдых, один спокойный вдох. Я здесь, могу просто выслушать. Вы не обязаны сейчас искать документы или решать задачи.'
        : (lang === 'en'
          ? 'I hear you — fatigue builds up. If you can, pause: water, a short rest, one calm breath. I’m here to listen. You don’t need to search files or fix tasks right now.'
          : 'Հասկանում եմ՝ հոգնածությունը կուտակվում է։ Եթե կարող եք՝ մի փոքր դադար առեք՝ ջուր, կարճ հանգիստ, մեկ հանգիստ շունչ։ Ես այստեղ եմ լսելու։ Հիմա պարտադիր չէ որոնել ֆայլեր կամ լուծել գործեր։');
    }
    if (/(տրամադրություն\s*չունեմ|տրամադրությունս|վատ\s*տրամադրություն|нет\s*настроения|плохое\s*настроение|bad\s*mood|no\s*mood|not\s*in\s*(the\s*)?mood|տխուր|նեղված|մունաթ|ձանձր)/i.test(s)) {
      return lang === 'ru'
        ? 'Понимаю — бывает, когда настроения нет совсем. Это нормально. Давайте без давления: я рядом, могу просто выслушать. Документы и задачи подождут.'
        : (lang === 'en'
          ? 'I understand — sometimes the mood just isn’t there. That’s okay. No pressure: I’m here to listen. Files and tasks can wait.'
          : 'Հասկանում եմ՝ երբեմն տրամադրությունն ընդհանրապես չի լինում։ Դա նորմալ է։ Առանց ճնշման՝ ես կողքին եմ, կարող եմ պարզապես լսել։ Ֆայլերն ու գործերը կարող են սպասել։');
    }
    if (/(սթրես|стресс|stress|անհանգիստ|тревог)/i.test(s)) {
      return lang === 'ru'
        ? 'Стресс бывает тяжелым. Давайте медленно: вы в безопасности в этом разговоре. Расскажите, что давит сильнее всего — я слушаю без оценок и без поиска по базе.'
        : (lang === 'en'
          ? 'Stress can feel heavy. Let’s go slowly — you’re safe in this chat. Tell me what’s weighing most; I’m listening without judgment and without searching the database.'
          : 'Սթրեսը կարող է շատ ծանր լինել։ Եկեք դանդաղ՝ այս զրույցում դուք ապահով եք։ Ասեք՝ ինչն է ամենաշատը ճնշում․ ես լսում եմ առանց դատելու և առանց բազայում որոնելու։');
    }
    return lang === 'ru'
      ? 'Спасибо, что написали. Ваше самочувствие важнее любых файлов. Я рядом — могу выслушать, поддержать спокойным словом. Вы не одни. Если хотите — расскажите, что происходит.'
      : (lang === 'en'
        ? 'Thank you for saying something. Your well-being matters more than any file. I’m here to listen and support you calmly. You’re not alone. If you want, tell me what’s going on.'
        : 'Շնորհակալություն, որ գրեցիք։ Ձեր ինքնազգացողությունն ավելի կարևոր է, քան ցանկացած ֆայլ։ Ես կողքին եմ՝ կարող եմ լսել ու հանգիստ աջակցել։ Դուք մենակ չեք։ Եթե ուզում եք՝ պատմեք, թե ինչ է կատարվում։');
  }

  function isIdentityAsk(q) {
    var s = norm(q);
    if (!s || s.length > 120) return false;
    return /(ով\s*ես\s*դու|ով\s*եք\s*դուք|դու\s*ո[վ՞]|դուք\s*ո[վ՞]|ո[վ՞]\s*ես|ո[վ՞]\s*եք|ինչ\s*ես\s*դու|ինչ\s*եք\s*դուք|պատմիր\s*քո\s*մասին|պատմեք\s*ձեր\s*մասին|գիտես\s+ես\s+ով|ես\s+ով\s+եմ|кто\s*ты|кто\s*вы|who\s*are\s*you|what\s*are\s*you|who\s+am\s+i)/i.test(s);
  }

  function isSocialIntentAsk(q) {
    if (isEmotionalDistress(q)) return false;
    if (isDefinitionalQuestion(q) || looksLikeScienceTopic(q) || looksLikeGeneralKnowledge(q)) return false;
    if (isSectionAboutQuery(q) || wantsDocumentSearch(q) || isKmSystemIntent(q)) return false;
    if (isFuzzyGreeting(q) || isIdentityAsk(q)) return true;
    if (isCasualChat(q) && String(q || '').trim().length <= 100) return true;
    return false;
  }

  function isCasualChat(q) {
    var s = norm(q);
    var raw = String(q || '').trim();
    if (!s) return false;
    if (isEmotionalDistress(q)) return false;
    /* Science / definitions are AI teach — never small-talk catch-all */
    if (looksLikeScienceTopic(q) || isDefinitionalQuestion(q) || looksLikeGeneralKnowledge(q)) return false;
    /* Section content questions are NOT small-talk */
    if (isSectionAboutQuery(q)) return false;
    if (isBareWhatsUpAsk(q)) return true;
    /* Fuzzy greetings incl. typos: որջույն ≈ ողջույն */
    if (isFuzzyGreeting(q)) return true;
    /* Pure acknowledgements */
    if (/^(բարև|բարեւ|ողջույն|հլը|հլե|շնորհակալ(ություն)?|մերսի|thanks|thank you|привет|здравствуй(те)?|hello|hi|hey|ок|окей|լավ|լավա|հա|այո|ոչ|да|нет|yes|no|ok|okay)[\s!.։]*$/i.test(s)) {
      return true;
    }
    /* Greeting + short polite/social tail («ողջույն ընկեր», «բարև ջան», «բարև ոնց ես») */
    if (/^(բարև|բարեւ|ողջույն|hello|hi|hey|привет|здравствуй(те)?)([\s,]+.{0,48})?$/i.test(s) &&
        !/(հրաման|приказ|որոշում|ակտ|զեկույց|հաշվառ|պաշտոն|անձնակազմ|գտիր|փնտր|որոն|№|#\d|\d{3,}|pdf|word)/i.test(s)) {
      return true;
    }
    if (/(ոնց|ինչպե[սս]?)\s*ես|как дела|how are you/i.test(s) && raw.length <= 64 &&
        !/(հրաման|պաշտոն|հաշվառ|բաժին|раздел)/i.test(s)) return true;
    if (/^(բարի (լույս|երեկո|գիշեր)|добр(ое|ый|ой)|good (morning|evening|night))/i.test(s) && s.length < 40) return true;
    if (/(շնորհակալ|մերսի|thanks|спасибо)/i.test(s) && s.length < 56 &&
        !/(հրաման|պաշտոն|հաշվառ|գտիր|փնտր)/i.test(s)) return true;
    if (raw.length <= 48 && /(ընկեր|եղբայր|ջան|հարգելի|բարևում եմ)/i.test(s) &&
        !/(հրաման|պաշտոն|հաշվառ|զեկույց|գտիր|փնտր|№)/i.test(s)) return true;
    /* Social / soft capability small-talk — not document search */
    if (isSocialOrCapabilityChat(q)) return true;
    /* Real questions (ինչ/ով/երբ/ինչպես/ինչու + ՞) are NEVER casual — they go to knowledge.db + Ollama */
    return false;
  }

  function isTrueSmallTalk(q) {
    if (!q) return false;
    if (isDefinitionalQuestion(q) || looksLikeScienceTopic(q) || looksLikeGeneralKnowledge(q)) return false;
    if (isHowAreYouAsk(q) || isBareWhatsUpAsk(q) || isIdentityAsk(q) || isWhoAmIAsk(q)) return true;
    if (isFuzzyGreeting(q) && String(q || '').trim().length <= 48) return true;
    var s = norm(q);
    if (/^(բարև|բարեւ|ողջույն|շնորհակալ(ություն)?|մերսի|thanks|thank you|привет|здравствуй(те)?|hello|hi|hey|ок|окей|լավ|հա|այո|ոչ|да|нет|yes|no|ok|okay)[\s!.։]*$/i.test(s)) {
      return true;
    }
    return false;
  }

  /** «դու գիտես շփվել», «կարո՞ղ ես զրուցել», jokes/mood — friendly chat, not «չհասկացա». */
  function isSocialOrCapabilityChat(q) {
    var s = norm(q);
    var raw = String(q || '').trim();
    if (!s || raw.length > 800) return false;
    if (/(հրաման|приказ|որոշում|ակտ|զեկույց|հաշվառ|պաշտոն|անձնակազմ|գտիր|փնտր|որոն|№|#\d|\d{3,}|pdf|word|excel)/i.test(s)) {
      return false;
    }
    if (/(դու\s*գիտես\s*շփվել|գիտե[ս՞]?\s*շփվել|կարո[ղ՞]?\s*ես\s*(շփվել|խոսել|զրուցել|օգնել)|ինչպե[ս՞]?\s*ես\s*շփվում|ումեешь\s*общаться|can you (chat|talk|converse)|do you (know how to )?(chat|talk)|ուզում եմ շփվ|ուղղակի ուզում եմ շփ|ազատ զրույց)/i.test(s)) {
      return true;
    }
    if (/(ինչ\s*կարող\s*ես|ինչ\s*գիտես\s*(անել)?|что\s*(ты\s*)?(умеешь|можешь)|what\s*can\s*you\s*do|твои\s*возможност)/i.test(s)) {
      return true;
    }
    if (raw.length <= 240 && /(շփվ|զրույց|խոսենք|խոսիր|կատակ|կատակիր|տրամադրություն|ինչպե[ս՞]?\s*տրամադր|как\s*настроен|how\s*are\s*you\s*feeling|bored|ձանձրալի)/i.test(s)) {
      return true;
    }
    if (raw.length <= 120 && /^(ո[վ՞]\s*ես|դու\s*ո[վ՞]|кто\s*ты|who\s*are\s*you|ինչ\s*ես\s*դու)[\s!?.։]*$/i.test(s)) {
      return true;
    }
    return false;
  }

  function isSmallTalk(q) {
    return isCasualChat(q);
  }

  function wantsDocumentSearch(q) {
    var s = norm(q);
    var raw = String(q || '').trim();
    if (!s || isCasualChat(q) || isEmotionalDistress(q) || isAppCatalogAsk(q)) return false;
    if (extractLawDocNumber(q)) return true;
    if (wantsContentSearch(s)) return true;
    if (/(հրաման|приказ|որոշում|ակտ|զեկույց|հաշվառում|պաշտոն|անձնակազմ|փաստաթղթ|отчет|report|персонал|должн|график|գրաֆիկ|roster|найди|найти|поиск|search|find|գտիր|փնտր|որոն)/i.test(s)) {
      return true;
    }
    if (/(№|#)\s*\d{1,8}|\b\d{3,8}\b/.test(raw) && /(հրաման|приказ|որոշում|ակտ|օրենք|файл|փաստաթղթ)/i.test(s)) {
      return true;
    }
    /* Whole-string name only — not «Տիգրան Մեծը ով էր» knowledge questions */
    if (/^(?:[Ա-ՖԵև][ա-ֆև]{2,}(?:\s+[Ա-ՖԵև][ա-ֆև]{2,}){0,3})$/.test(raw) && raw.length >= 5 &&
        !/(ինչ|ով|օվ|երբ|ինչպես|ինչու|who|what|when|why|how)/i.test(s)) {
      return true;
    }
    if (detectWeekday(q) != null && /(ո[վ՞]|անձ|ցանկ|գրաֆիկ|дежур|who|on duty|roster)/i.test(s)) {
      return true;
    }
    return false;
  }

  /** Explicit «how to use the bot» — only then show bot-help topic. */
  function isExplicitBotHelpAsk(q) {
    var s = norm(q);
    if (!s) return false;
    if (/^(բոտ|օգնական|помощник|assistant|\bbot\b|faq)[\s!?.։]*$/i.test(s)) return true;
    return /(օգտագործել\s*(այս\s*)?(բոտ|օգնական)|как\s*пользоваться\s*(этим\s*)?бот|how\s*to\s*use\s*(this\s*|the\s*)?bot|բոտը\s*ինչպես|помощник\s*как|инструкция\s*бот|bot\s*help|օգնականի\s*(օգն|ուղեցույց))/i.test(s);
  }

  /**
   * Pure KM desktop commands only (docs, nav, roster, app sections).
   * Domain keyword alone is NOT enough — need clear app action/command.
   * Everything else is free-form AI assistant → Gemini.
   */
  function isKmSystemIntent(q) {
    var s = norm(q);
    if (!s) return false;
    if (isEmotionalDistress(q)) return false;
    /* Definitional / educational / philosophy — never KM */
    if (isDefinitionalQuestion(q) || looksLikeScienceTopic(q) || looksLikeGeneralKnowledge(q)) {
      if (!isExplicitBotHelpAsk(q) && !isSectionAboutQuery(q) && !matchNavIntent(s)) return false;
    }
    /* Knowledge questions must not be treated as KM document/roster search */
    if (!isSectionAboutQuery(q) && !isExplicitBotHelpAsk(q) && !matchNavIntent(s) &&
        /(ինչ|ով|օվ|երբ|ինչպես|ինչու|what|who|when|why|how)/i.test(s) &&
        !hasLauncherVerb(q) && !isOpenCardIntent(q) &&
        !/(գտիր|փնտր|որոն|найди|search|find|ֆայլ|pdf|հրաման\s*№)/i.test(s)) {
      return false;
    }
    if (isDetailElaborationAsk(q) && (LAST_TEACH.query || LAST_TEACH.topic)) return false;
    if (isAppCatalogAsk(q)) return true;
    if (looksLikePersonNameQuery(q) || isOpenCardIntent(q) || isBareSectionNoun(q)) return true;
    if (isExplicitBotHelpAsk(q)) return true;
    if (isSectionAboutQuery(q)) return true;
    if (classifyLauncherIntent(q)) return true;
    if (wantsDocumentSearch(q)) return true;
    if (matchNavIntent(s)) return true;
    if (hasKmWorkDomain(s) &&
        /(բաց(իր|ել)?|open|որոն|գտիր|փնտր|ցույց\s*տուր|show|найди|найти|поиск|search|բաժին|էջ|раздел|page|հրաման\s*№|приказ\s*№|в\s*графике|գրաֆիկում)/i.test(s)) {
      return true;
    }
    if (/(քանի\s*(անձ|հոգի|մարդ)|сколько\s*(человек|людей)|how many\s*(people|staff)|վիճակագր|ակտիվ\s*տույժ|live\s*stats)/i.test(s)) {
      return true;
    }
    return false;
  }

  function classifyUserIntent(q) {
    if (!String(q || '').trim()) return { kind: 'empty', reason: 'empty' };
    /* Human well-being first — before chat greetings and all document search */
    if (isEmotionalDistress(q)) return { kind: 'empathy', reason: 'emotional_distress' };
    /* Detail follow-up keeps prior teach topic — never KM menus */
    if (isDetailElaborationAsk(q) && (LAST_TEACH.query || LAST_TEACH.topic)) {
      return { kind: 'teach', reason: 'teach_detail' };
    }
    /* Section about («ինչ կա իրավաբանական բաժնում») before casual «ինչ…» */
    if (isSectionAboutQuery(q)) return { kind: 'nav', reason: 'section_about' };
    if (isWhoAmIAsk(q) || isHowAreYouAsk(q) || isIdentityAsk(q) || isBareWhatsUpAsk(q)) return { kind: 'chat', reason: 'identity_or_status' };
    if (isAppCatalogAsk(q)) return { kind: 'nav', reason: 'app_catalog' };
    if (isOpenCardIntent(q) || looksLikePersonNameQuery(q)) return { kind: 'search', reason: 'person_or_card' };
    if (isBareSectionNoun(q)) return { kind: 'nav', reason: 'section_noun' };
    if (classifyLauncherIntent(q)) return { kind: 'launcher', reason: 'open_or_navigate' };
    /* Any definition / concept / science → Gemini teach */
    if (isDefinitionalQuestion(q) || looksLikeScienceTopic(q) || looksLikeGeneralKnowledge(q)) {
      return { kind: 'teach', reason: 'general_knowledge' };
    }
    /* KM-only system commands (strict) */
    if (wantsDocumentSearch(q)) return { kind: 'search', reason: 'document_or_data' };
    if (matchNavIntent(norm(q))) return { kind: 'nav', reason: 'navigation' };
    if (isExplicitBotHelpAsk(q)) return { kind: 'nav', reason: 'bot_help' };
    if (hasKmWorkDomain(norm(q)) &&
        /(բաց(իր|ել)?|open|որոն|գտիր|փնտր|ցույց|show|найди|հրաման|приказ)/i.test(norm(q))) {
      return { kind: 'search', reason: 'km_command' };
    }
    /* Pure greetings stay light chat; everything else → knowledge.db + Ollama */
    if (isTrueSmallTalk(q)) {
      return { kind: 'chat', reason: 'casual' };
    }
    /* Default: full AI assistant — never hard KM menu catch-all */
    return { kind: 'teach', reason: 'ai_default' };
  }

  function hasKmWorkDomain(s) {
    return /(գրաֆիկ|վերակարգ|հերթապահ|անձնակազմ|հաշվառ|պաշտոն|շտատ|գրադարան|իրավաբան|իրավունք|օրենք|հրաման|որոշում|ակտ|տույժ|զինծառայող|էջերի?\s*իրավունք|օգտատեր|թույլտվ|usb|ֆլեշ|արխիվ|բուժկետ|անհարմար\s*օր|քարտադարան|roster|schedule|personnel|accounting|library|legal|приказ|наряд)/i.test(s || '');
  }

  function isDetailElaborationAsk(q) {
    var s = norm(q);
    return /(ավելի\s*մանրամասն|մանրամասն(իր|ել|ի|եցրու)?|խորացր|ավելի\s*(խոր|լայն|լիարժեք)|բաժիններից|ինչ\s*բաժին|կարող\s*ես\s*աս|ասա\s+(խնդրում|այդ|էդ)|պատմիր|подробн|более\s*подроб|разверн|explain\s*more|more\s*detail|elaborate|go\s*deeper|in\s*depth|deeper)/i.test(s);
  }

  function isPureStylePreference(q) {
    var s = norm(q)
      .replace(/(խնդրում\s*եմ|please|пожалуйста)/gi, ' ')
      .replace(/(ավելի\s*)?(մանրամասն|կարճ|кратко|подробн|short|brief|detail|longer|answers|պատասխան(ներ)?|խոս|ասա|скажи|tell\s*me)/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return s.length < 3;
  }

  function extractTeachTopicHint(q) {
    var s = String(q || '').trim();
    var fromDef = extractDefinitionalSubject(q);
    if (fromDef) return fromDef;
    var m =
      s.match(/(?:կինեմատիկ|դինամիկ|մեխանիկ|ստատիկ|օպտիկ|թերմոդինամիկ|քվանտ|ֆիզիկ|քիմի|մաթեմատիկ|կենսաբան|պատմութ|աշխարհագր|աստղագիտ|գրականութ|փիլիսոփայ|սեր|սիրո|երջանկութ|բարոյական|գեղեցկութ|ժամանակ|տարածութ|գիտակցութ|biology|physics|chemistry|history|geography|love|математик|физик|хими|истори|кинемат|динамик|географи)[^\s,.!?]*/i);
    if (m) return m[0];
    if (LAST_TEACH.topic) return LAST_TEACH.topic;
    if (LAST_TEACH.query && !isDetailElaborationAsk(q)) return String(LAST_TEACH.query).slice(0, 80);
    if (LAST_TEACH.query) return String(LAST_TEACH.query).slice(0, 80);
    return '';
  }

  function rememberTeachTopic(q) {
    /* Follow-ups («ավելի մանրամասն») must keep prior topic/query */
    if (isDetailElaborationAsk(q) && (LAST_TEACH.topic || LAST_TEACH.query)) {
      var keepHint = extractDefinitionalSubject(q) || extractTeachTopicHint(q);
      if (keepHint && keepHint !== LAST_TEACH.topic && !isDetailElaborationAsk(keepHint)) {
        LAST_TEACH.topic = keepHint;
      }
      SESSION_CTX.lastTeachTopic = LAST_TEACH.topic || SESSION_CTX.lastTeachTopic || '';
      return;
    }
    var hint = extractTeachTopicHint(q) || String(q || '').trim().slice(0, 80);
    LAST_TEACH = {
      topic: hint,
      query: String(q || '').trim().slice(0, 200)
    };
    SESSION_CTX.lastTeachTopic = hint;
  }

  function expandTeachQueryForLlm(q, detailed) {
    /* Attestation pattern (v264): send CLEAN user text to Gemini — rules live in system prompt only. */
    var base = String(q || '').trim();
    if (!base) return base;
    if (detailed || isDetailElaborationAsk(q)) {
      var topic = extractTeachTopicHint(q) || LAST_TEACH.topic || '';
      var prev = LAST_TEACH.query && LAST_TEACH.query !== base ? LAST_TEACH.query : '';
      if (topic || prev) {
        return base +
          (topic ? ('\n\n[նախորդ թեմա՝ ' + topic + ']') : '') +
          (prev ? ('\n[նախորդ հարց՝ ' + prev + ']') : '');
      }
    }
    return base;
  }

  /** Soft notice when cloud AI is unavailable — connection/config only, never a topic “answer”. */
  function llmUnavailableReply(lang, reason, code) {
    var r = String(reason || '') + ' ' + String(code || '');
    var shortReason = String(reason || code || '').trim().slice(0, 160);
    if (/429|quota|cooldown|RESOURCE_EXHAUSTED/i.test(r)) {
      if (lang === 'ru') {
        return 'Gemini квота/лимит исчерпан (HTTP 429). Все ключи в cooldown — подождите ~1 мин или смените API ключ в «Настройках».';
      }
      if (lang === 'en') {
        return 'Gemini quota/rate limit hit (HTTP 429). All keys are in cooldown — wait ~1 min or change the API key in Settings.';
      }
      return 'Gemini քվոտան/լիմիտը սպառված է (HTTP 429)։ Բանալիները cooldown-ում են — սպասեք ~1 րոպե կամ փոխեք API բանալին «Կարգավորումներ»-ում։';
    }
    if (/401|403|unauthorized|API_KEY|gemini_no_key|invalid/i.test(r)) {
      if (lang === 'ru') {
        return 'Gemini API ключ отклонён (401/403). Проверьте ключ в «Настройках» (Google AI Studio).';
      }
      if (lang === 'en') {
        return 'Gemini API key rejected (401/403). Check the key in Settings (Google AI Studio).';
      }
      return 'Gemini API բանալին մերժվել է (401/403)։ Ստուգեք բանալին «Կարգավորումներ»-ում (Google AI Studio)։';
    }
    if (/network|timeout|abort|ECONN|fetch|proxy|Failed to fetch|offline/i.test(r)) {
      if (lang === 'ru') {
        return 'Сеть недоступна для Gemini. Проверьте интернет и повторите вопрос.';
      }
      if (lang === 'en') {
        return 'Network error talking to Gemini. Check internet and try again.';
      }
      return 'Ցանցային սխալ Gemini-ի հետ։ Ստուգեք ինտերնետը և կրկին հարցրեք։';
    }
    if (/gemini_blocked|SAFETY|RECITATION|BLOCKLIST|PROHIBITED/i.test(r)) {
      if (lang === 'ru') {
        return 'Google Gemini заблокировал ответ (safety/policy). Переформулируйте вопрос. Код: ' + shortReason;
      }
      if (lang === 'en') {
        return 'Google Gemini blocked the reply (safety/policy). Please rephrase. Code: ' + shortReason;
      }
      return 'Google Gemini-ը արգելափակել է պատասխանը (safety/policy)։ Վերաձևակերպեք հարցը։ Կոդ՝ ' + shortReason;
    }
    if (/gemini_empty|gemini_bad_json|no_candidates|no_parts|no_content|MAX_TOKENS/i.test(r)) {
      if (lang === 'ru') {
        return 'Gemini ответил без текста (пустой JSON / нет candidates/parts). Причина: ' +
          (shortReason || 'gemini_empty') + '. Попробуйте другой вопрос или модель в «Настройках».';
      }
      if (lang === 'en') {
        return 'Gemini returned no text (empty JSON / no candidates/parts). Reason: ' +
          (shortReason || 'gemini_empty') + '. Try another question or model in Settings.';
      }
      return 'Gemini-ից տեքստ չստացվեց (դատարկ JSON / candidates/parts չկան)։ Պատճառ՝ ' +
        (shortReason || 'gemini_empty') + '։ Փորձեք այլ հարց կամ մոդել «Կարգավորումներ»-ում։';
    }
    if (/disabled|url_blocked|no_key/i.test(r)) {
      if (lang === 'ru') {
        return 'AI отключён или ключ не задан. Включите Gemini и API ключ в «Настройках».';
      }
      if (lang === 'en') {
        return 'AI is disabled or no API key is set. Enable Gemini and the API key in Settings.';
      }
      return 'AI-ն անջատված է կամ API բանալի չկա։ Միացրեք Gemini-ն և բանալին «Կարգավորումներ»-ում։';
    }
    if (lang === 'ru') {
      return 'Сейчас не удалось получить ответ от AI' +
        (shortReason ? (' (' + shortReason + ')') : '') +
        '. Проверьте интернет и Gemini API ключ в «Настройках».';
    }
    if (lang === 'en') {
      return 'Could not get an AI reply' +
        (shortReason ? (' (' + shortReason + ')') : '') +
        '. Check internet and the Gemini API key in Settings.';
    }
    return 'Հիմա չհաջողվեց ստանալ AI պատասխան' +
      (shortReason ? (' (' + shortReason + ')') : '') +
      '։ Ստուգեք ինտերնետը և Gemini API բանալին «Կարգավորումներ»-ում։';
  }

  /** Accept nearly any Gemini body — only empty / obvious secret dumps are rejected. */
  function acceptAiReply(text, userQuery) {
    var t = String(text || '').trim();
    if (t.length < 1) return false;
    if (t.length > 16000) t = t.slice(0, 16000);
    if (/passwordHash|sk-[a-zA-Z0-9]{20,}|AIza[0-9A-Za-z\-_]{20,}/i.test(t)) return false;
    void userQuery;
    return true;
  }

  /** «ինչ է X», «X ինչ է», «իսկ սերը ինչ է», what is / что такое — any concept. */
  function isDefinitionalQuestion(q) {
    var s = norm(q);
    var raw = String(q || '').trim();
    if (!s || raw.length < 3) return false;
    if (isHowAreYouAsk(q) || isBareWhatsUpAsk(q) || isIdentityAsk(q)) return false;
    if (/(բաժին|раздел|անկյուն|section|էջ|page|меню|մենյու|համակարգ)\b/i.test(s) && hasKmWorkDomain(s)) {
      return false;
    }
    /* «ինչ է/էր X» / «ով է/էր X» / «երբ է» / «инչպես է» (ոչ «ինչպես ես») */
    if (/^(իսկ\s+)?(ինչ\s*(է|են|էր|եր)|ով\s*(է|են|էր|եր)|օվ\s*(է|են|էր|եր)|երբ\s*(է|են|էր)|ինչպես\s*(է|են)|кто\s+(такой|такая|это|был)|what\s*(is|are|was)|who\s+(is|was)|when\s+(is|was|did))\s+\S+/i.test(s)) return true;
    /* «X ինչ է», «իսկ X ինչ է», mid-sentence */
    if (/(ինչ\s*(է|են))\s*[?¿՞!.։]*$/i.test(s) && !/^(ինչպես|ինչու|ինչի\s*համար)\b/i.test(s)) return true;
    if (/\b(что\s*такое|what\s*(is|are))\b/i.test(s)) return true;
    if (/^(define|definition of|բացատրի?ր|объясни|նկարագրի?ր|расскажи\s*про)\s+\S+/i.test(s)) return true;
    if (/(բացատրի?ր|объясни|նշանակում\s*է|means\s*what|что\s*значит|ինչ\s*նշանակում)\s*.{2,}/i.test(s)) return true;
    return false;
  }

  /** Pull the subject of a definitional question (աշխարհագրություն, սեր, …). */
  function extractDefinitionalSubject(q) {
    var raw = String(q || '').trim();
    var s = norm(q);
    if (!raw) return '';
    var m =
      raw.match(/^(?:իսկ\s+)?ինչ\s*(?:է|են)\s+(.+?)[\s?¿՞!.։]*$/i) ||
      raw.match(/^(?:(?:օվ|ով)\s*(?:է|են)|who\s+is|кто\s+(?:такой|такая))\s+(.+?)[\s?¿՞!.։]*$/i) ||
      raw.match(/^(?:что\s*такое|what\s*(?:is|are))\s+(.+?)[\s?!.]*$/i) ||
      raw.match(/^(?:իսկ\s+)?(.+?)\s+ինչ\s*(?:է|են)[\s?¿՞!.։]*$/i) ||
      raw.match(/^(.+?)\s+что\s*такое[\s?!.]*$/i);
    if (m && m[1]) {
      return String(m[1]).replace(/^(այդ|էս|էն|the|a|an|это|эта)\s+/i, '').trim().slice(0, 80);
    }
    if (/(ինչ\s*(է|են))\s*[?¿՞!.։]*$/i.test(s)) {
      return raw
        .replace(/^(իսկ\s+)/i, '')
        .replace(/\s+ինչ\s*(է|են)[\s?¿՞!.։]*$/i, '')
        .trim()
        .slice(0, 80);
    }
    return '';
  }

  /** Physics / science subfields — even without the word «ֆիզիկա». */
  function looksLikeScienceTopic(q) {
    var s = norm(q);
    if (!s) return false;
    return /(կինեմատիկ|դինամիկ|մեխանիկ|ստատիկ|օպտիկ|թերմոդինամիկ|էլեկտրամագնիս|էլեկտրաստատիկ|մագնիսականութ|քվանտ|նյուտոն|էյնշտեյն|ենշտեյն|հոքինգ|խոկինգ|hawking|հոգեբան|հոքեբան|իմպուլս|արագացում|ձգողականութ|ալիքային|տատանում|ռելյատիվ|միջուկային\s*ֆիզ|ատոմային\s*ֆիզ|հիդրոստատ|հիդրոդինամ|ակուստիկ|սպեկտրոսկոպ|լազեր|ֆոտոն|էլեկտրոն|պրոտոն|նեյտրոն|kinematic|dynamics?\b|mechanics?\b|statics?\b|optics?\b|thermodynamic|electromagnet|quantum|newton|einstein|momentum|relativity|psychology|кинемат|динамик|механик|статик|оптик|термодинами|электромагн|квант|ньютон|մոլեկուլ|վալենտական|օքսիդաց|պարբերական\s*աղյուսակ|քիմիական\s*ռեակց|алгебр|геометр|тригонометр|дифференц|интеграл|ֆոտոսինթեզ|էվոլյուցիա|photosynthesis|organelle)/i.test(s);
  }

  /** Detect educational / world-knowledge questions (physics, history, …). */
  function looksLikeGeneralKnowledge(q) {
    var s = norm(q);
    var raw = String(q || '').trim();
    if (!s || raw.length < 3) return false;
    if (hasKmWorkDomain(s)) return false;
    if (isEmotionalDistress(q) || isFuzzyGreeting(q) || isSectionAboutQuery(q)) return false;
    if (/(էջերի?\s*իրավունք|զինծառայողի\s*իրավունք|ուսումնասիրել\s*համակարգ|page\s*permission|прав\s*страниц)/i.test(s)) {
      return false;
    }
    /* Explicit bot/help guide — not science */
    if (/(օգտագործել\s*բոտ|как\s*пользоваться\s*бот|how\s*to\s*use\s*(the\s*)?bot|բոտը\s*ինչպես|помощник\s*как)/i.test(s)) {
      return false;
    }
    /* «ավելի մանրամասն» after a teach turn — continue general knowledge, not KM menu */
    if (isDetailElaborationAsk(q) && (LAST_TEACH.query || LAST_TEACH.topic)) return true;
    if (isDetailElaborationAsk(q) &&
        (looksLikeScienceTopic(q) ||
          /(ֆիզիկ|քիմի|մաթեմատիկ|կենսաբան|պատմութ|աշխարհագր|աստղ|գրական|փիլիսոփ|հոգեբան|հոքեբան|physics|chemistry|history|биолог|физик|хими)/i.test(s))) {
      return true;
    }
    if (looksLikeScienceTopic(q)) return true;
    if (/(պատմությունից|պատմության\s*(մասին|դաս|գիրք)|պատմիր.{0,48}պատմութ|աշխարհի\s*պատմ|հին\s*պատմ|world\s*history|from\s*history|tell.{0,40}histor|из\s*истории|расскаж.{0,40}истори|историческ)/i.test(s)) {
      return true;
    }
    if (/(ֆիզիկ|քիմի|քիմյ|մաթեմատիկ|կենսաբան|աշխարհագր|աստղագիտ|երկրաբան|գրականություն|փիլիսոփայ|(?:^|[^\u0531-\u0587])սեր(?:ը|ն|ով)?(?:[^\u0531-\u0587]|$)|սիրո|երջանկութ|բարոյական|գեղեցկութ|psychology|փսիխոլոգ|հոգեբան|հոքեբան|(?:^|[^\u0531-\u0587])հոքի(?:ն)?(?:[^\u0531-\u0587]|$)|հոքինգ|խոկինգ|hawking|biology|physics|chemistry|mathematics|geography|\bmath\b|geometry|алгебр|геометр|химия|физика|биолог|любов|философ)/i.test(s)) {
      return true;
    }
    /* Definitional Q without KM domain — teach via Gemini, never bot-help topic */
    if (isDefinitionalQuestion(q) &&
        !/(բոտ|օգնական|помощник|assistant|\bfaq\b|օգտագործել|пользоваться|բաժին|раздел|էջ|page|մենյու|համակարգ)/i.test(s)) {
      return true;
    }
    if (/^(ինչ\s*(է|են)|что\s*такое|what\s*(is|are))\s+.+/i.test(s) &&
        !/(բաժին|раздел|էջ|page|մենյու|համակարգ|km\b|բոտ)/i.test(s)) {
      return true;
    }
    if (/(պատմիր\s*(մի\s*)?(բան|պատմություն|հետաքրքիր)|расскажи\s*(что|интерес|факт|истори)|tell\s*me\s*(a\s*)?(story|fact|something|anything)|հետաքրքիր\s*փաստ)/i.test(s)) {
      return true;
    }
    return false;
  }

  function smallTalkReply(q, lang) {
    var s = norm(q);
    if (/շնորհակալ|մերսի|thanks|thank|спасибо/i.test(s)) {
      return lang === 'ru' ? 'Пожалуйста — всегда рад помочь.' : (lang === 'en' ? 'You’re welcome — happy to help.' : 'Խնդրեմ — միշտ պատրաստ եմ օգնելու։');
    }
    if (isBareWhatsUpAsk(q) || /^(ինչ կա)[\s!?.։՞]*$/i.test(s)) {
      return lang === 'ru'
        ? 'Я здесь. Могу ответить на общие вопросы и помочь по разделам KM. Напишите, что вас интересует.'
        : (lang === 'en'
          ? 'I’m here. I can answer general questions or help with KM sections. What would you like to know?'
          : 'Այստեղ եմ։ Կարող եմ պատասխանել ընդհանուր հարցերին կամ օգնել KM բաժիններով։ Գրեք՝ ինչն եք ուզում իմանալ։');
    }
    /* Human check-in first — «Բարև, ո՞նց ես» / ինչպես ես (not low-mood phrases) */
    if (/(ոնց|ինչպե[սս]?)\s*ես|как дела|how are you|ինչպե[սս]?\s*տրամադր|как\s*настроен/i.test(s) &&
        !/(տրամադրություն\s*չունեմ|վատ\s*տրամադրություն|հոգնած|հոգնել)/i.test(s)) {
      return lang === 'ru'
        ? 'Хорошо, спасибо! А вы как? Чем могу помочь сегодня?'
        : (lang === 'en'
          ? 'I’m fine, thank you! How can I help you today?'
          : 'Լավ եմ, շնորհակալություն։ Ինչպե՞ս կարող եմ օգնել այսօր։');
    }
    if (/(դու\s*գիտես\s*շփվել|գիտե[ս՞]?\s*շփվել|կարո[ղ՞]?\s*ես\s*(շփվել|խոսել|զրուցել)|умеешь\s*общаться|can you (chat|talk)|շփվ|զրույց|խոսենք)/i.test(s) ||
        /(ինչ\s*կարող\s*ես|ինչ\s*գիտես|что\s*(ты\s*)?(умеешь|можешь)|what\s*can\s*you\s*do)/i.test(s)) {
      return openFriendlyReply(lang);
    }
    /* Warm greeting only — no immediate command dump */
    if (isFuzzyGreeting(q) || /բարև|ողջույն|привет|hello|hi|hey|здравствуй|ընկեր|ջան|բարի (լույս|երեկո|գիշեր)|добр|good (morning|evening|night)/i.test(s)) {
      return lang === 'ru'
        ? 'Здравствуйте! Рад вас видеть. Как я могу помочь сегодня?'
        : (lang === 'en'
          ? 'Hello! Good to see you. How can I help today?'
          : 'Բարև։ Ուրախ եմ տեսնել ձեզ։ Ինչպե՞ս կարող եմ օգնել այսօր։');
    }
    if (/ո[վ՞]\s*ես|դու\s*ո[վ՞]|դուք\s*ո[վ՞]|кто\s*ты|who\s*are\s*you|ինչ\s*ես\s*դու|ինչ\s*եք\s*դուք|պատմիր\s*քո\s*մասին/i.test(s)) {
      return lang === 'ru'
        ? 'Я KM AI-помощник 🤝. Не человек, но могу спокойно поговорить и помочь по разделам программы — без лишних меню.'
        : (lang === 'en'
          ? 'I’m the KM AI assistant 🤝. Not a human, but I can chat and help with the app’s sections — without dumping menus.'
          : 'Ես KM AI օգնականն եմ 🤝։ Մարդ չեմ, բայց կարող եմ ջերմ զրուցել և օգնել ծրագրի բաժիններով՝ առանց ավելորդ մենյուների։');
    }
    return lang === 'ru'
      ? 'С удовольствием. Напишите, чем помочь — или просто продолжим разговор.'
      : (lang === 'en'
        ? 'Happy to help. Tell me what you need — or we can just chat.'
        : 'Ուրախ կլինեմ օգնել։ Գրեք՝ ինչ է պետք, կամ պարզապես շարունակենք զրույցը։');
  }

  /**
   * Offline encyclopedia snippets (no cloud). Used when Gemini key is missing/disabled.
   * Never the old «կարճ հիմք» stub template.
   */
  function localEncyclopediaReply(q, lang) {
    var s = norm(q);
    var topic =
      extractDefinitionalSubject(q) ||
      extractTeachTopicHint(q) ||
      LAST_TEACH.topic ||
      '';
    var pack = topic + ' ' + s;

    if (/(ինֆորմատիկ|informatik|информатик|computer\s*science|\bcs\b)/i.test(pack)) {
      return lang === 'ru'
        ? 'Информатика — наука о методах хранения, обработки, передачи и представления информации с помощью компьютеров и алгоритмов. Включает программирование, данные, сети и цифровую грамотность.'
        : (lang === 'en'
          ? 'Informatics (computer science) studies how information is stored, processed, transmitted and represented — algorithms, programming, data, networks and digital systems.'
          : 'Ինֆորմատիկան տեղեկատվության պահպանման, մշակման, փոխանցման և ներկայացման գիտություն է՝ համակարգիչների ու ալգորիթմների միջոցով։ Ներառում է ծրագրավորում, տվյալներ, ցանցեր և թվային գրագիտություն։');
    }
    if (/(աշխարհագր|geograph|географи)/i.test(pack)) {
      return lang === 'ru'
        ? 'География — наука о Земле: материки, океаны, климат, рельеф, страны и связь природы с человеком.'
        : (lang === 'en'
          ? 'Geography studies Earth — continents, oceans, climate, landforms, countries, and how nature and people interact.'
          : 'Աշխարհագրությունը Երկրի մասին գիտություն է՝ մայրցամաքներ, օվկիանոսներ, կլիմա, ռելիեֆ, երկրներ և բնության ու մարդու կապը։');
    }
    if (/(կինեմատիկ)/i.test(pack)) {
      return lang === 'ru'
        ? 'Кинематика — раздел механики о движении без учёта сил: путь, скорость, ускорение.'
        : (lang === 'en'
          ? 'Kinematics describes motion without forces: path, velocity, acceleration.'
          : 'Կինեմատիկան մեխանիկայի բաժին է՝ շարժումը առանց ուժերի․ ճանապարհ, արագություն, արագացում։');
    }
    if (/(դինամիկ)/i.test(pack)) {
      return lang === 'ru'
        ? 'Динамика — раздел механики о причинах движения: силы, масса, законы Ньютона.'
        : (lang === 'en'
          ? 'Dynamics is about causes of motion: forces, mass, Newton’s laws.'
          : 'Դինամիկան մեխանիկայի բաժին է՝ շարժման պատճառներ․ ուժեր, զանգված, Նյուտոնի օրենքներ։');
    }
    if (/(ֆիզիկ)/i.test(pack)) {
      return lang === 'ru'
        ? 'Физика изучает материю, энергию, движение, силы и законы природы.'
        : (lang === 'en'
          ? 'Physics studies matter, energy, motion, forces, and natural laws.'
          : 'Ֆիզիկան ուսումնասիրում է նյութը, էներգիան, շարժումը, ուժերը և բնության օրենքները։');
    }
    if (/(քիմի|քիմյ|chemistry|химия)/i.test(pack)) {
      return lang === 'ru'
        ? 'Химия изучает вещества, их состав, свойства и превращения.'
        : (lang === 'en'
          ? 'Chemistry studies substances — composition, properties, and changes.'
          : 'Քիմիան ուսումնասիրում է նյութերը՝ կազմը, հատկությունները և փոխակերպումները։');
    }
    if (/(ֆոտոսինթեզ|photosynthesis)/i.test(pack)) {
      return lang === 'ru'
        ? 'Фотосинтез — процесс, в котором растения с хлорофиллом превращают свет, воду и углекислый газ в сахар и кислород.'
        : (lang === 'en'
          ? 'Photosynthesis is how plants use chlorophyll to turn light, water and carbon dioxide into sugar and oxygen.'
          : 'Ֆոտոսինթեզը բույսերի գործընթաց է, որով քլորոֆիլով լույսը, ջուրը և ածխաթթու գազը վերածվում են շաքարի և թթվածնի։');
    }
    if (/(սև անցք|black hole|чёрн(ая|ую) дыр)/i.test(pack)) {
      return lang === 'ru'
        ? 'Чёрная дыра — область пространства, где гравитация настолько сильна, что даже свет не может выйти.'
        : (lang === 'en'
          ? 'A black hole is a region where gravity is so strong that not even light can escape.'
          : 'Սև անցքը տարածության այն շրջանն է, որտեղ ձգողականությունն այնքան ուժեղ է, որ նույնիսկ լույսը չի կարող դուրս գալ։');
    }
    if (/(թումանյան|tumanyan)/i.test(pack)) {
      return lang === 'ru'
        ? 'Ованес Туманян (1869–1923) — армянский поэт и прозаик, автор «Ануш», «Гикора» и «Собака и кошка».'
        : (lang === 'en'
          ? 'Hovhannes Tumanyan (1869–1923) was an Armenian poet and writer, known for Anush, Gikor, and The Dog and the Cat.'
          : 'Հովհաննես Թումանյանը (1869–1923) հայ բանաստեղծ և արձակագիր էր։ Հայտնի է «Անուշ», «Գիքորը», «Շունն ու կատուն» ստեղծագործություններով։');
    }
    if (/(հոքինգ|խոկինգ|hawking)/i.test(pack)) {
      return lang === 'ru'
        ? 'Стивен Хокинг (Stephen Hawking, 1942–2018) — английский физик-теоретик и космолог. Известен работами о чёрных дырах и книгой «Краткая история времени».'
        : (lang === 'en'
          ? 'Stephen Hawking (1942–2018) was a theoretical physicist and cosmologist, known for black-hole research and A Brief History of Time.'
          : 'Սթիվեն Հոքինգը (Stephen Hawking, 1942–2018) անգլիացի տեսական ֆիզիկոս և տիեզերագետ էր։ Հայտնի է սև անցքերի, տիեզերքի ծագման հետազոտություններով և «Ժամանակի համառոտ պատմություն» գրքով։');
    }
    if (/(հոգեբան|հոքեբան|(?:^|[^\u0531-\u0587])հոքի(?:ն)?(?:[^\u0531-\u0587]|$)|psychology|психолог)/i.test(pack)) {
      return lang === 'ru'
        ? 'Психология изучает психику: восприятие, память, эмоции, личность и поведение.'
        : (lang === 'en'
          ? 'Psychology studies the mind — perception, memory, emotion, personality and behaviour.'
          : 'Հոգեբանությունը ուսումնասիրում է հոգեկանը՝ ընկալում, հիշողություն, հույզեր, անձ և վարք։');
    }
    var domainDefs = [
      { re: /մաթեմատիկ/i, hy: 'Մաթեմատիկան թվերի, ձևերի, կառուցվածքների և օրինաչափությունների գիտություն է։', ru: 'Математика — наука о числах, формах и закономерностях.', en: 'Mathematics studies numbers, shapes, structures and patterns.' },
      { re: /քվանթային\s*ֆիզիկ|quantum/i, hy: 'Քվանթային ֆիզիկան նկարագրում է նյութն ու էներգիան ամենափոքր մասշտաբներում՝ ալիք-մասնիկ երկակիությամբ։', ru: 'Квантовая физика описывает материю и энергию на малых масштабах.', en: 'Quantum physics describes matter and energy at the smallest scales.' },
      { re: /կենսաբան/i, hy: 'Կենսաբանությունը կենդանի օրգանիզմների գիտություն է՝ բջիջ, գեն, էկոհամակարգ։', ru: 'Биология — наука о живых организмах.', en: 'Biology is the science of living organisms.' },
      { re: /աստղագիտ/i, hy: 'Աստղագիտությունը ուսումնասիրում է տիեզերքը՝ աստղեր, մոլորակներ, գալակտիկաներ։', ru: 'Астрономия изучает Вселенную: звёзды, планеты, галактики.', en: 'Astronomy studies the universe — stars, planets, galaxies.' },
      { re: /կիրառական\s*մաթեմ/i, hy: 'Կիրառական մաթեմատիկան մաթեմատիկական մեթոդները կիրառում է իրական խնդիրների վրա։', ru: 'Прикладная математика применяет математику к практическим задачам.', en: 'Applied mathematics uses math on real-world problems.' },
      { re: /վիճակագր/i, hy: 'Վիճակագրությունը տվյալների հավաքման, վերլուծության և եզրակացությունների գիտություն է։', ru: 'Статистика — сбор и анализ данных.', en: 'Statistics is about collecting and analysing data.' },
      { re: /համակարգչային\s*գիտ|ինֆորմատի/i, hy: 'Համակարգչային գիտությունը ալգորիթմների, ծրագրավորման և հաշվողական համակարգերի մասին է։', ru: 'Информатика изучает алгоритмы и вычислительные системы.', en: 'Computer science studies algorithms and computing systems.' },
      { re: /ճարտարագիտ/i, hy: 'Ճարտարագիտությունը գիտելիքը կիրառում է սարքերի, կառույցների և համակարգերի ստեղծման համար։', ru: 'Инженерия применяет знания для создания систем и устройств.', en: 'Engineering applies knowledge to build systems and devices.' },
      { re: /դեղագիտ/i, hy: 'Դեղագիտությունը ուսումնասիրում է դեղերը՝ ազդեցությունը, կազմը և կիրառումը։', ru: 'Фармакология изучает лекарства и их действие.', en: 'Pharmacology studies medicines and how they work.' },
      { re: /բիզնես\s*կառավար/i, hy: 'Բիզնես կառավարումը կազմակերպության պլանավորման, ղեկավարման և ռեսուրսների մասին է։', ru: 'Управление бизнесом — планирование и руководство организацией.', en: 'Business management is planning and running an organisation.' },
      { re: /իրավագիտ|իրավունք/i, hy: 'Իրավագիտությունը օրենքների, իրավունքների և իրավական համակարգի գիտություն է։', ru: 'Юриспруденция — наука о праве и законах.', en: 'Law studies legal systems, rights and rules.' },
      { re: /մանկավարժ/i, hy: 'Մանկավարժությունը դաստիարակության և ուսուցման տեսությունն ու պրակտիկան է։', ru: 'Педагогика — теория и практика обучения.', en: 'Pedagogy is the theory and practice of teaching.' },
      { re: /զինվորական\s*հոգեբան/i, hy: 'Զինվորական հոգեբանությունը ուսումնասիրում է զինծառայողի վարքը, սթրեսը և համախմբվածությունը։', ru: 'Военная психология изучает поведение и стресс военнослужащих.', en: 'Military psychology studies service members’ behaviour and stress.' },
      { re: /զինվորական\s*մասնագիտ/i, hy: 'Զինվորական մասնագիտությունը բանակի մասնագիտական դերերն ու հմտություններն են։', ru: 'Военная специальность — профессиональные роли в армии.', en: 'Military specialties are professional roles in the armed forces.' },
      { re: /զինվորական\s*կառուցված/i, hy: 'Զինվորական կառուցվածքը զորքերի կազմակերպումն է՝ ստորաբաժանումներ և հրամանատարություն։', ru: 'Военная структура — организация войск и командования.', en: 'Military structure is how forces and command are organised.' },
      { re: /զինվորական\s*գիտելիք/i, hy: 'Զինվորական գիտելիքները ծառայության կանոնների, սպառազինության և մարտավարության մասին են։', ru: 'Военные знания — уставы, вооружение, тактика.', en: 'Military knowledge covers regulations, weapons and tactics.' },
      { re: /հայոց\s*գրական/i, hy: 'Հայոց գրականությունը հայ գրողների և ստեղծագործությունների պատմությունն է։', ru: 'Армянская литература — история армянских писателей и произведений.', en: 'Armenian literature is the history of Armenian writers and works.' },
      { re: /հայոց\s*պատմ/i, hy: 'Հայոց պատմությունը հայ ժողովրդի անցյալի իրադարձություններն ու պետականությունն է։', ru: 'История Армении — прошлое армянского народа и государства.', en: 'Armenian history is the past of the Armenian people and state.' },
      { re: /հայոց\s*լեզու|հայերեն/i, hy: 'Հայոց լեզուն հայերի մայրենի լեզուն է՝ քերականությամբ, ուղղագրությամբ և բառապաշարով։', ru: 'Армянский язык — родной язык армян, его грамматика и письмо.', en: 'Armenian is the native language of Armenians — grammar, spelling, vocabulary.' },
      { re: /ռազմագիտ/i, hy: 'Ռազմագիտությունը պատերազմի, մարտավարության և ռազմական արվեստի տեսությունն է։', ru: 'Военная наука — теория войны и тактики.', en: 'Military science is the theory of war and tactics.' },
      { re: /տրամաբան/i, hy: 'Տրամաբանությունը ճիշտ մտածողության և եզրահանգումների կանոնների գիտություն է։', ru: 'Логика — наука о правильном рассуждении.', en: 'Logic is the study of correct reasoning.' },
      { re: /եկեղեցու\s*պատմ/i, hy: 'Հայոց եկեղեցու պատմությունը Հայ Առաքելական եկեղեցու ծագումն ու ընթացքն է։', ru: 'История Армянской церкви — происхождение и путь ААЦ.', en: 'Armenian Church history is the origin and path of the Armenian Apostolic Church.' },
      { re: /հայոց\s*մշակույթ/i, hy: 'Հայոց մշակույթը հայ արվեստի, սովորույթների, երաժշտության և ինքնության ամբողջությունն է։', ru: 'Армянская культура — искусство, обычаи и идентичность.', en: 'Armenian culture is art, customs, music and identity.' },
      { re: /երկրագիտ/i, hy: 'Երկրագիտությունը ուսումնասիրում է Երկիրը՝ երկրաբանություն, հանքեր, ռելիեֆ։', ru: 'Науки о Земле изучают геологию, недра и рельеф.', en: 'Earth science studies geology, minerals and landforms.' },
      { re: /տնտեսագիտ/i, hy: 'Տնտեսագիտությունը ուսումնասիրում է արտադրությունը, փոխանակումը և ռեսուրսների բաշխումը։', ru: 'Экономика изучает производство, обмен и распределение ресурсов.', en: 'Economics studies production, exchange and distribution of resources.' },
      { re: /սոցիոլոգ/i, hy: 'Սոցիոլոգիան ուսումնասիրում է հասարակությունը, խմբերը և սոցիալական հարաբերությունները։', ru: 'Социология изучает общество и социальные отношения.', en: 'Sociology studies society, groups and social relations.' },
      { re: /քաղաքագիտ/i, hy: 'Քաղաքագիտությունը ուսումնասիրում է իշխանությունը, պետությունը և քաղաքական գործընթացները։', ru: 'Политология изучает власть, государство и политику.', en: 'Political science studies power, the state and political processes.' },
      { re: /մարդաբան/i, hy: 'Մարդաբանությունը ուսումնասիրում է մարդուն՝ մշակույթ, ծագում և առօրյա կյանք։', ru: 'Антропология изучает человека, культуру и происхождение.', en: 'Anthropology studies humans — culture, origin and everyday life.' },
      { re: /քրիստոնե/i, hy: 'Քրիստոնեությունը Աստվածաշնչի և Քրիստոսի ուսմունքի վրա հիմնված կրոն է։', ru: 'Христианство — религия, основанная на учении Христа и Библии.', en: 'Christianity is the religion based on the teaching of Christ and the Bible.' },
      { re: /գյուղատնտես/i, hy: 'Գյուղատնտեսությունը հողի մշակման, անասնապահության և սննդի արտադրության մասին է։', ru: 'Сельское хозяйство — земледелие, животноводство и производство пищи.', en: 'Agriculture is farming, livestock and food production.' }
    ];
    var di;
    for (di = 0; di < domainDefs.length; di++) {
      if (domainDefs[di].re.test(pack)) {
        return lang === 'ru' ? domainDefs[di].ru : (lang === 'en' ? domainDefs[di].en : domainDefs[di].hy);
      }
    }
    if (/(?:^|[^\u0531-\u0587])սեր(?:ը|ն|ով)?(?:[^\u0531-\u0587]|$)|սիրո|love\b|любов/i.test(pack)) {
      return lang === 'ru'
        ? 'Любовь — глубокая привязанность и забота: чувство, отношение и выбор между людьми.'
        : (lang === 'en'
          ? 'Love is deep attachment and care — a feeling, a relationship, and a choice.'
          : 'Սերը խոր կապվածություն և հոգատարություն է՝ զգացում, վերաբերմունք և ընտրություն։');
    }
    return '';
  }

  /**
   * Answer without cloud LLM: BotKnowledge → topic TF-IDF → encyclopedia → small-talk.
   * Used when API key is missing/disabled, and as fallback before showing unavailable.
   */
  async function tryLocalKnowledgeReply(q, lang) {
    lang = lang || getLang();
    var s = norm(q);
    var rawLen = String(q || '').trim().length;

    /*
     * Attestation pattern: greetings / identity / short social NEVER hit FTS/KB.
     * Otherwise 2M-row corpus returns random physics rows on weak BM25.
     */
    if (isSocialIntentAsk(q) || isIdentityAsk(q) || isFuzzyGreeting(q)) {
      return { text: smallTalkReply(q, lang), source: 'smalltalk' };
    }

    var socialLikely =
      (isFuzzyGreeting(q) ||
        /^(բարև|ողջույն|շնորհակալ|մերսի|thanks|hello|hi)[\s!.։]*$/i.test(s) ||
        /(ոնց|ինչպե[սս]?)\s*ես|как дела|how are you/i.test(s)) &&
      !isDefinitionalQuestion(q) &&
      !looksLikeGeneralKnowledge(q) &&
      rawLen <= 64;

    if (socialLikely) {
      return { text: smallTalkReply(q, lang), source: 'smalltalk' };
    }

    var calcLoc = localCalculatorReply(q, lang);
    if (calcLoc) return { text: calcLoc, source: 'calculator' };

    if (shouldSkipSearchForLauncher(q)) return null;

    /* Very short queries without KM domain → small-talk, not FTS — but keep science/def topics */
    if (rawLen <= 24 && !hasKmWorkDomain(s) && !isDefinitionalQuestion(q) &&
        !looksLikeGeneralKnowledge(q) && !looksLikeScienceTopic(q) &&
        !/(նյուտոն|անցք|ֆիզիկ|աստղ|քիմի|մաթեմ|կենսաբան)/i.test(s)) {
      return { text: smallTalkReply(q, lang), source: 'smalltalk' };
    }

    try {
      if (window.kmNative && window.kmNative.botKnowledge) {
        var locFn = window.kmNative.botKnowledge.searchSimple || window.kmNative.botKnowledge.search;
        if (typeof locFn === 'function') {
          var bk = await locFn.call(window.kmNative.botKnowledge, { query: q, limit: 5 });
          var hit = pickCleanKbHits(bk && bk.hits)[0];
          if (isBkHitStrong(hit) && String(hit.a || '').trim() && !isCannedDomainOverview(hit)) {
            return { text: String(hit.a).trim(), source: 'offline_vector', score: hit.score };
          }
          if (hit && Number(hit.score || 0) >= BK_MIN_SCORE_WEAK && String(hit.a || '').trim() &&
              !isCannedDomainOverview(hit) &&
              !isDefinitionalQuestion(q) && !looksLikeGeneralKnowledge(q) && !isCasualChat(q)) {
            return { text: String(hit.a).trim(), source: 'offline_vector', score: hit.score };
          }
        }
      }
    } catch (eBk) {}

    try {
      var apiL = llmApi();
      var topics = typeof allTopics === 'function' ? allTopics() : ((DATA && DATA.topics) || []);
      if (apiL && typeof apiL.tfidfRetrieve === 'function' && topics && topics.length) {
        var tfHits = apiL.tfidfRetrieve(q, topics, lang, 4) || [];
        var best = tfHits[0];
        if (best && best.topic && Number(best.score) >= 0.06) {
          if (isTechnicalKnowledgeAsk(q) && Number(best.score) < 0.14) {
            return { text: bkNoMatchReply(q, lang), source: 'bk_no_match' };
          }
          var loc = localizeTopic(best.topic, lang);
          var lines = [];
          var title = textify(loc && loc.title);
          if (title) lines.push(title);
          ((loc && loc.answer) || []).forEach(function (a) {
            var t = textify(a);
            if (t) lines.push(t);
          });
          if (loc && loc.groups && loc.groups.length) {
            loc.groups.slice(0, 3).forEach(function (g) {
              var gt = textify(g.title);
              if (gt) lines.push(gt);
              ((g.lines || []).slice(0, 4)).forEach(function (ln) {
                var lt = textify(ln);
                if (lt) lines.push('• ' + lt);
              });
            });
          }
          var body = lines.join('\n').replace(/\s+\n/g, '\n').trim();
          if (body.length >= 24 && !/Ինչպես օգտագործել բոտը|How to use this bot/i.test(body)) {
            if (Number(best.score) < 0.10 && best.topic.id !== 'bot') {
              if (isTechnicalKnowledgeAsk(q) || isDefinitionalQuestion(q)) {
                return { text: bkLowScoreReply(q, lang), source: 'bk_no_match', score: best.score };
              }
            } else {
              return { text: body, source: 'local_topic', score: best.score };
            }
          }
        }
      }
    } catch (eTf) {}

    var curated = localEncyclopediaReply(q, lang);
    if (curated) return { text: curated, source: 'local_encyclopedia' };

    if (isTechnicalKnowledgeAsk(q)) {
      return { text: bkNoMatchReply(q, lang), source: 'bk_no_match' };
    }

    /* Soft local chat for short casual asks — never hard-block without a key */
    if (rawLen <= 80 && (isCasualChat(q) || isCapabilityAsk(s) || isHelpAsk(s) || isIdentityAsk(q))) {
      return { text: smallTalkReply(q, lang), source: 'smalltalk' };
    }

    return null;
  }

  function formatStructuredDocLines(h, lang) {
    var lines = [];
    var area = h.area || (h.kind === 'laws' ? 'Իրավական անկյուն' : (h.kind === 'library' ? 'Ֆայլերի պահոց' /* KM_MENU_REORG_V1 */ : ''));
    var sec = h.sectionLabel || h.section || '';
    var fname = h.name || h.title || '—';
    var ext = String(h.ext || '').toUpperCase();
    if (!ext && fname.indexOf('.') >= 0) {
      ext = fname.split('.').pop().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
    }
    var where =
      lang === 'ru' ? 'Раздел: ' : (lang === 'en' ? 'Section: ' : 'Բաժին՝ ');
    var fileL =
      lang === 'ru' ? 'Файл: ' : (lang === 'en' ? 'File: ' : 'Ֆայլ՝ ');
    var snipL =
      lang === 'ru' ? 'В тексте: ' : (lang === 'en' ? 'In text: ' : 'Տեքստում՝ ');
    var titleOnlyL =
      lang === 'ru' ? '(совпадение только в названии)' : (lang === 'en' ? '(title-only match)' : '(միայն վերնագրում)');
    var pathParts = [];
    if (area) pathParts.push(area);
    if (sec) pathParts.push(sec);
    lines.push(where + (pathParts.join(' › ') || '—'));
    lines.push(fileL + fname + (ext ? (' [' + ext + ']') : ''));
    if (h.hasText && h.snippet) {
      var sn = String(h.snippet).replace(/\s+/g, ' ').trim().slice(0, 180);
      var locHint = '';
      var slideM = sn.match(/\[Slide\s+(\d+)\]/i);
      var sheetM = sn.match(/\[Sheet\s+(\d+)\]/i);
      if (slideM) {
        locHint = lang === 'ru' ? ('слайд ' + slideM[1] + ' · ')
          : (lang === 'en' ? ('slide ' + slideM[1] + ' · ') : ('սլայդ ' + slideM[1] + ' · '));
      } else if (sheetM) {
        locHint = lang === 'ru' ? ('лист ' + sheetM[1] + ' · ')
          : (lang === 'en' ? ('sheet ' + sheetM[1] + ' · ') : ('թերթ ' + sheetM[1] + ' · '));
      }
      lines.push(snipL + locHint + '«' + sn + '»');
    } else if (h.titleOnly || !h.hasText) {
      lines.push(titleOnlyL);
    }
    return lines;
  }

  function searchAccountingContent(q) {
    var qLower = '';
    try { qLower = String(q || '').trim().toLowerCase(); }
    catch (e) { qLower = String(q || '').toLowerCase().trim(); }
    if (!qLower || qLower.length < 2) return [];
    var tokens = qLower.split(/\s+/).filter(function (t) { return t.length >= 2; }).slice(0, 8);
    var hits = [];
    function pushHit(section, title, text, page, scoreBonus) {
      var body = String(text || '').replace(/\s+/g, ' ').trim();
      if (!body) return;
      var tl = '';
      try { tl = body.toLowerCase(); } catch (e2) { tl = body.toLowerCase(); }
      var score = scoreBonus || 0;
      if (tl.indexOf(qLower) >= 0) score += 16;
      tokens.forEach(function (t) { if (tl.indexOf(t) >= 0) score += 3; });
      if (score < 6) return;
      var idx = tl.indexOf(qLower);
      if (idx < 0) {
        for (var i = 0; i < tokens.length; i++) {
          idx = tl.indexOf(tokens[i]);
          if (idx >= 0) break;
        }
      }
      if (idx < 0) idx = 0;
      hits.push({
        kind: 'accounting',
        section: section,
        title: title,
        page: page || 'accounting',
        score: score,
        snippet: body.slice(Math.max(0, idx - 40), Math.min(body.length, idx + 140)).trim(),
        area: 'Հաշվառում'
      });
    }
    try {
      if (typeof db === 'undefined' || !db) return [];
      (db.people || []).forEach(function (p) {
        if (!p) return;
        pushHit('Անձնակազմ', p.name || 'Անձ',
          [p.name, p.rank, p.unit, p.post, p.postCode, p.phone, p.education, p.specialty,
            Array.isArray(p.bad) ? p.bad.join(' ') : ''].join(' '),
          'people');
      });
      try {
        (db.userPositions || []).forEach(function (up) {
          if (!up) return;
          pushHit(up.vacant ? 'Պաշտոն · թափուր' : 'Պաշտոն · քարտ',
            (up.personName || up.position || 'Պաշտոն'),
            [up.position, up.section, up.code, up.rankSlot, up.personName, up.vacant ? 'թափուր' : 'համալրված'].join(' '),
            'positions', 6);
        });
      } catch (eUp2) {}
      try {
        (db.people || []).forEach(function (p) {
          if (!p) return;
          pushHit('Անձի քարտ (լրիվ)', p.name || 'Անձ', personCardBlob(p), 'people', 2);
        });
      } catch (ePc) {}
      try {
        var dossiers = db.unitDossiers || {};
        Object.keys(dossiers).forEach(function (name) {
          var d = dossiers[name] || {};
          pushHit('Անձնակազմ և Պաշտոն', name,
            [name, d.post, d.postCode, d.education, d.specialty, d.family, d.rankSlot, d.note].join(' '),
            'people');
        });
      } catch (eD) {}
      (db.unitMedical || []).forEach(function (m) {
        if (!m) return;
        pushHit('Բուժկետ', m.person || m.name || 'Գրառում',
          [m.person, m.name, m.diagnosis, m.note, m.status, m.from, m.to].join(' '),
          'unitMedical');
      });
      (db.vacations || []).forEach(function (v) {
        if (!v) return;
        pushHit('Արձակուրդ', v.person || v.name || 'Արձակուրդ',
          [v.person, v.name, v.type, v.from, v.to, v.note].join(' '),
          'vacations');
      });
      try {
        var leaveRows = (db.unitLeavePlan && db.unitLeavePlan.rows) || [];
        leaveRows.forEach(function (r) {
          if (!r) return;
          pushHit('Արձակուրդների հերթափոխ', r.person || r.name || 'Տող',
            [r.person, r.name, r.from, r.to, r.type, r.note].join(' '),
            'unitLeavePlan');
        });
      } catch (eL) {}
      try {
        var troopRows = (((db.troopStructure || {}).staff || {}).rows) || [];
        troopRows.forEach(function (r) {
          if (!r) return;
          pushHit('Անձնակազմի հաշվառում / շտատ', r.name || 'Տող',
            [r.name, r.position, r.unit, r.rank, r.code, r.education, r.vus, r.specialty].join(' '),
            'troopStructure');
        });
      } catch (eT) {}
      try {
        if (Array.isArray(db.unitFormation)) {
          db.unitFormation.forEach(function (r) {
            if (!r) return;
            pushHit('Շարային տեղեկագիր', r.name || r.title || 'Տող',
              JSON.stringify(r), 'unitFormation');
          });
        }
      } catch (eF) {}
      try {
        if (Array.isArray(db.unitTermWatch)) {
          db.unitTermWatch.forEach(function (r) {
            if (!r) return;
            pushHit('Կոչումներ և ժամկետներ', r.name || r.person || 'Տող',
              [r.name, r.person, r.rank, r.from, r.to, r.note].join(' '),
              'unitTermWatch');
          });
        }
      } catch (eW) {}
    } catch (e0) {}
    hits.sort(function (a, b) { return b.score - a.score; });
    return hits.slice(0, 12);
  }

  function buildWeekdayHit(wd, lang) {
    var rows = searchSchedulesByWeekday(wd);
    var dayLabel = weekdayName(wd, lang);
    var lines = [];
    var actions = [{ label: lang === 'ru' ? 'Открыть график' : (lang === 'en' ? 'Open schedule' : 'Բացել գրաֆիկ'), page: 'schedule' }];
    if (!rows.length) {
      lines.push(lang === 'ru'
        ? ('В текущих графиках дней «' + dayLabel + '» не найдено.')
        : (lang === 'en'
          ? ('No «' + dayLabel + '» days found in current schedules.')
          : ('Ընթացիկ գրաֆիկներում «' + dayLabel + '» օր չի գտնվել։')));
    } else {
      lines.push(lang === 'ru'
        ? ('«' + dayLabel + '» и следующие такие дни — состав по графикам:')
        : (lang === 'en'
          ? ('«' + dayLabel + '» and following such days — roster:')
          : ('«' + dayLabel + '» և հաջորդող նույն օրեր՝ անձնակազմ ըստ գրաֆիկների՝')));
      rows.slice(0, 10).forEach(function (r) {
        var head = r.day + '.' + r.month + '.' + r.year + ' · ' + r.graph;
        if (!(r.people && r.people.length)) {
          lines.push('• ' + head + ' — (դատարկ / նշանակում չկա)');
          return;
        }
        lines.push('• ' + head + ' (' + r.people.length + ')՝');
        r.people.slice(0, 40).forEach(function (p) {
          lines.push('   – ' + p.name + (p.duty ? (' · ' + p.duty) : ''));
        });
        if (r.people.length > 40) lines.push('   … +' + (r.people.length - 40));
      });
    }
    return {
      kind: 'topic',
      score: 95,
      intent: 'weekday_roster',
      alts: [],
      topic: {
        id: 'weekday_roster',
        title: lang === 'ru' ? ('График · ' + dayLabel) : (lang === 'en' ? ('Schedule · ' + dayLabel) : ('Գրաֆիկ · ' + dayLabel)),
        answer: lines,
        actions: actions,
        _localized: true
      }
    };
  }

  async function buildPersonDataHit(q, lang) {
    var needle = stripSearchNoise(q);
    if (!needle || needle.length < 2) return null;
    if (isEmotionalDistress(q) || isProgramAuthorAsk(q) || isDefinitionalQuestion(q)) return null;
    if (/(^|\s)(ես|շատ|եմ|հոգն|հոքն|տխուր|կարող)(\s|$)/i.test(norm(needle))) return null;
    if (detectWeekday(needle) != null && needle.split(/\s+/).length <= 2) return null;

    var schHits = searchSchedulesByPerson(needle);
    var person = findDbPerson(needle);
    var files = [];
    var live = searchLiveAppContent(needle).filter(function (h) {
      return h && h.kind !== 'position_archive';
    });

    var livePersonHits = live.filter(function (h) {
      return h.kind === 'person_card' || h.kind === 'position_card' || h.kind === 'position_slot' || h.kind === 'roster';
    });

    if (!schHits.length && !person && !livePersonHits.length) return null;

    var topName = (person && person.name) ||
      (schHits[0] && schHits[0].person) ||
      (livePersonHits[0] && extractPersonNameFromTitle(livePersonHits[0].title)) ||
      needle;

    var lines = [];
    var actions = buildPersonNavActions(topName, lang);

    lines.push(lang === 'ru'
      ? ('Данные по «' + topName + '»:')
      : (lang === 'en'
        ? ('Information for «' + topName + '»:')
        : ('Տվյալներ «' + topName + '»-ի մասին՝')));

    if (person) {
      lines.push(lang === 'ru' ? '— Карточка личного состава / Պաշտոն:' : (lang === 'en' ? '— Personnel / Positions card:' : '— Անձնակազմի / Պաշտոնի քարտ՝'));
      if (person.rank) lines.push('  Կոչում՝ ' + person.rank);
      if (person.unit) lines.push('  Ստորաբաժանում՝ ' + person.unit);
      if (person.post) lines.push('  Պաշտոն՝ ' + person.post);
      if (person.postCode) lines.push('  Հաստիքի կոդ՝ ' + person.postCode);
      if (person.phone) lines.push('  Հեռախոս՝ ' + person.phone);
      if (person.education) lines.push('  Կրթություն՝ ' + person.education);
      if (person.specialty) lines.push('  Մասնագիտություն՝ ' + person.specialty);
      if (person.familyStatus || person.family) lines.push('  Ընտանիք՝ ' + [person.familyStatus, person.family].filter(Boolean).join(' · '));
      if (person.secrecyClearance) lines.push('  Գաղտնիություն՝ ' + person.secrecyClearance);
      if (person.appointmentDate) lines.push('  Նշանակման ամսաթիվ՝ ' + person.appointmentDate);
      if (person.bloodGroup) lines.push('  Արյան խումբ՝ ' + person.bloodGroup);
      if (person.idCard) lines.push('  ID քարտ՝ ' + person.idCard);
      if (person.contractStart || person.endDate || person.contractEnd) {
        lines.push('  Պայմանագիր՝ ' + [person.contractStart, person.endDate || person.contractEnd].filter(Boolean).join(' → '));
      }
      if (Array.isArray(person.bad) && person.bad.length) lines.push('  Անհարմար օրեր՝ ' + person.bad.join(', '));
    } else if (livePersonHits.length) {
      livePersonHits.slice(0, 4).forEach(function (h) {
        lines.push(formatLiveHitLine(h, lang));
      });
    }
    try {
      var ents = extractQueryEntities(q);
      if (ents.orderNums.length) lines.push((lang === 'ru' ? '— Номер приказа/акта: ' : (lang === 'en' ? '— Order/act number: ' : '— Հրամանի/ակտի համար՝ ')) + ents.orderNums.join(', '));
      if (ents.dates.length) lines.push((lang === 'ru' ? '— Даты в запросе: ' : (lang === 'en' ? '— Dates in query: ' : '— Հարցումում ամսաթվեր՝ ')) + ents.dates.join(', '));
    } catch (eEnt) {}

    if (schHits.length) {
      lines.push(lang === 'ru' ? '— Включён в графики:' : (lang === 'en' ? '— Included in schedules:' : '— Ընդգրկված է գրաֆիկներում՝'));
      schHits.slice(0, 8).forEach(function (h) {
        var days = (h.days && h.days.length) ? (h.days.slice(0, 16).join(', ') + (h.days.length > 16 ? '…' : '')) : (h.note || '—');
        lines.push('• ' + h.graph + ' (' + h.month + '/' + h.year + ') · օրեր՝ ' + days);
      });
    }

    if (files.length) {
      lines.push(lang === 'ru' ? '— Файлы (место; открыть — кнопкой):' : (lang === 'en' ? '— Files (location; open via button):' : '— Ֆայլեր (տեղը՝ ստորև, բացել՝ կոճակով)՝'));
      files.slice(0, 6).forEach(function (h) {
        lines.push('• ' + formatFilePlace(h, lang) +
          (h.hasText && h.snippet ? (' — «' + String(h.snippet).slice(0, 100) + '»') : ''));
        if (h.kind === 'laws' && h.id && h.section) {
          actions.push({ label: 'Բացել՝ ' + String(h.name || '').slice(0, 28), lawId: h.id, lawSection: h.section });
        } else if (h.id && h.type) {
          actions.push({ label: 'Բացել՝ ' + String(h.name || '').slice(0, 28), libId: h.id, libType: h.type });
        }
      });
    }

    var related = live.filter(function (h) {
      return h && h.kind !== 'position_archive' && h.score >= 8;
    }).slice(0, 5);
    if (related.length) {
      lines.push(lang === 'ru' ? '— Связанные записи/документы:' : (lang === 'en' ? '— Related records/documents:' : '— Կապված գրառումներ / փաստաթղթեր՝'));
      related.forEach(function (h) {
        lines.push(formatLiveHitLine(h, lang));
        var actRel = buildActionForLiveHit(h, lang, topName);
        if (actRel && actions.length < 10) actions.push(actRel);
      });
    }

    var score = 0;
    if (person) score += 40;
    if (schHits.length) score += 25;
    if (livePersonHits.length) score += 20;
    if (files.length) score += 12;
    if (score < 12) score = 24;

    return {
      kind: 'topic',
      score: Math.min(98, score + 20),
      intent: 'person_lookup',
      alts: [],
      topic: {
        id: 'person_lookup',
        title: topName,
        answer: lines,
        actions: actions.slice(0, 8),
        _localized: true
      }
    };
  }

  async function findContentSearchHit(q, lang) {
    /* Համարով հրաման/որոշում՝ միայն findLawDocHit ուղիով */
    if (extractLawDocNumber(q)) return null;
    var qNorm = norm(q);
    if (isCasualChat(q) || isEmotionalDistress(q)) return null;
    var explicit = wantsContentSearch(qNorm);
    var docIntent = wantsDocumentSearch(q);
    /* Չգործարկել ծանր որոնում առանց հստակ փաստաթղթային/որոնման մտադրության */
    if (!explicit && !docIntent) return null;

    var word = stripSearchNoise(q) || String(q || '').trim();
    var tooThin = !word || word.length < 3 || /^\d{1,3}$/.test(word);
    if (tooThin) return null;
    if (isUiHelpOnly(qNorm)) return null;

    var live = searchLiveAppContent(word);
    var files = [];
    try { files = await searchLibraryFileContents(word); } catch (eF) { files = []; }
    var acct = searchAccountingContent(word).filter(function (h) {
      return h && String(h.section || '') !== 'Պաշտոն արխիվ';
    });

    live = (live || []).filter(function (h) {
      return h && h.kind !== 'position_archive' && (h.score || 0) >= SEARCH_MIN_SCORE;
    });
    files = (files || []).filter(function (h) { return (h.score || 0) >= Math.max(4, SEARCH_MIN_SCORE - 4); });
    /* Prefer full-text body hits over title-only */
    files.sort(function (a, b) {
      var ah = a && a.hasText ? 1 : 0;
      var bh = b && b.hasText ? 1 : 0;
      if (ah !== bh) return bh - ah;
      return (b.score || 0) - (a.score || 0);
    });
    acct = (acct || []).filter(function (h) { return (h.score || 0) >= Math.max(4, SEARCH_MIN_SCORE - 4); });

    if (!live.length && !files.length && !acct.length) {
      if (!explicit && !docIntent) return null;
      return {
        kind: 'chat',
        intent: 'content_search',
        score: 50,
        suggest: true,
        text: lang === 'ru'
          ? 'По этому запросу релевантных совпадений не найдено.'
          : (lang === 'en'
            ? 'No relevant matches for this query.'
            : 'Այս հարցով համապատասխան արդյունք չի գտնվել։')
      };
    }
    var topScore = 0;
    live.forEach(function (h) { if (h.score > topScore) topScore = h.score; });
    files.forEach(function (h) { if ((h.score || 0) > topScore) topScore = h.score || 0; });
    acct.forEach(function (h) { if ((h.score || 0) > topScore) topScore = h.score || 0; });
    if (topScore < SEARCH_MIN_SCORE && !explicit) return null;

    var lawFiles = files.filter(function (h) { return isLawHit(h); }).slice(0, SEARCH_LAW_TOP);
    var peopleLive = live.filter(function (h) {
      return h.kind === 'person' || h.kind === 'roster' || h.kind === 'person_card' ||
        h.kind === 'position_card' || h.kind === 'position_slot' || isPersonnelHit(h);
    }).slice(0, SEARCH_PEOPLE_TOP);
    var otherFiles = files.filter(function (h) { return !isLawHit(h); }).slice(0, 6);
    var otherLive = live.filter(function (h) {
      return !(h.kind === 'person' || h.kind === 'position_archive' || h.kind === 'roster' ||
        h.kind === 'person_card' || h.kind === 'position_card' || h.kind === 'position_slot' ||
        h.kind === 'accounting' || isPersonnelHit(h));
    }).slice(0, 2);
    acct = acct.slice(0, 2);

    var actions = [];
    var groups = [];
    var intro = [];
    if (lang === 'ru') {
      intro.push('Поиск по содержимому файлов (PDF, Word, Excel, PowerPoint, HTML) — «' + word + '».');
      intro.push('Ниже: раздел → файл → фрагмент текста. Нажмите «Открыть».');
    } else if (lang === 'en') {
      intro.push('Full-text search (PDF, Word, Excel, PowerPoint, HTML) — «' + word + '».');
      intro.push('Below: section → file → text snippet. Tap Open.');
    } else {
      intro.push('Լրիվ տեքստային որոնում (PDF, Word, Excel, PowerPoint, HTML) — «' + word + '».');
      intro.push('Ներքևում՝ բաժին → ֆայլ → տեքստի հատված։ Սեղմեք «Բացել»։');
    }

    function addGroup(title, lines, gActs, open) {
      if (!lines.length && !(gActs && gActs.length)) return;
      groups.push({ title: title, lines: lines, actions: gActs || [], open: open !== false });
      (gActs || []).forEach(function (a) { actions.push(a); });
    }

    if (lawFiles.length) {
      var lawLines = [];
      var lawActs = [];
      lawFiles.forEach(function (h) {
        formatStructuredDocLines(h, lang).forEach(function (ln) { lawLines.push(ln); });
        if (h.id && h.section && lawActs.length < SEARCH_LAW_TOP) {
          lawActs.push({
            label: (lang === 'ru' ? 'Открыть: ' : (lang === 'en' ? 'Open: ' : 'Բացել՝ ')) + String(h.name || '').slice(0, 32),
            lawId: h.id,
            lawSection: h.section
          });
        }
      });
      addGroup(lang === 'ru' ? 'Юридические акты' : (lang === 'en' ? 'Legal acts' : 'Իրավական ակտեր'), lawLines, lawActs, true);
    }

    if (peopleLive.length) {
      var pLines = [];
      var pActs = [];
      var ctxName = word;
      peopleLive.forEach(function (h) {
        pLines.push(formatLiveHitLine(h, lang));
        var actP = buildActionForLiveHit(h, lang, ctxName);
        if (actP && pActs.length < 6) pActs.push(actP);
      });
      if (!pActs.length && ctxName) {
        pActs = buildPersonNavActions(ctxName, lang).slice(0, 4);
      }
      addGroup(lang === 'ru' ? 'Личный состав' : (lang === 'en' ? 'Personnel' : 'Անձնակազմ'), pLines, pActs, true);
    }

    if (acct.length) {
      var aLines = [];
      var aActs = [];
      acct.forEach(function (h) {
        aLines.push('• [' + (h.section || '') + '] ' + (h.title || '') +
          (h.snippet ? (' — «' + String(h.snippet).slice(0, 100) + '»') : ''));
        if (h.page && aActs.length < 2) {
          aActs.push({
            label: (lang === 'ru' ? 'Открыть: ' : (lang === 'en' ? 'Open: ' : 'Բացել՝ ')) + String(h.section || h.title || '').slice(0, 28),
            page: h.page === 'unitDocs' ? 'unitTools' : h.page
          });
        }
      });
      aActs.push({ label: lang === 'ru' ? 'Открыть Учёт' : (lang === 'en' ? 'Open Accounting' : 'Բացել Հաշվառում'), page: 'accounting' });
      addGroup(lang === 'ru' ? 'Учёт' : (lang === 'en' ? 'Accounting' : 'Հաշվառում'), aLines, aActs, false);
    }

    if (otherFiles.length || otherLive.length) {
      var oLines = [];
      var oActs = [];
      otherFiles.forEach(function (h) {
        formatStructuredDocLines(h, lang).forEach(function (ln) { oLines.push(ln); });
        oLines.push('');
        if (h.id && h.type && oActs.length < 4) {
          oActs.push({
            label: (lang === 'ru' ? 'Открыть: ' : (lang === 'en' ? 'Open: ' : 'Բացել՝ ')) + String(h.name || '').slice(0, 32),
            libId: h.id,
            libType: h.type
          });
        }
      });
      otherLive.forEach(function (h) {
        oLines.push(formatLiveHitLine(h, lang));
        var actO = buildActionForLiveHit(h, lang, word);
        if (actO && oActs.length < 5) oActs.push(actO);
      });
      addGroup(
        lang === 'ru' ? 'Документы / файлы' : (lang === 'en' ? 'Documents / files' : 'Փաստաթղթեր / ֆայլեր'), /* KM_RENAME_LEFTOVERS_V1 */
        oLines.filter(function (x, i, arr) { return x !== '' || (arr[i - 1] && arr[i - 1] !== ''); }),
        oActs,
        true
      );
    }

    if (!groups.length) return null;

    return {
      kind: 'topic',
      score: Math.max(74, topScore),
      alts: [],
      intent: 'content_search',
      topic: {
        id: 'content_search',
        title: lang === 'ru' ? 'Поиск' : (lang === 'en' ? 'Search' : 'Որոնում'),
        answer: intro,
        groups: groups,
        actions: actions.slice(0, SEARCH_RESULT_LIMIT),
        _localized: true
      }
    };
  }

  function contentRagLines(live, files) {
    var blocks = [];
    (live || []).slice(0, 4).forEach(function (h) {
      blocks.push('- [live/' + h.kind + '] ' + h.title + ': ' + String(h.snippet || '').slice(0, 160));
    });
    (files || []).slice(0, 4).forEach(function (h) {
      blocks.push('- [file/' + (h.type || '') + '] ' + (h.name || '') + ': ' + String(h.snippet || '').slice(0, 160));
    });
    return blocks.join('\n');
  }

  function matchNavIntent(qNorm) {
    var isOpenCmd =
      qNorm.indexOf('բացիր') >= 0 ||
      qNorm.indexOf('բացել') >= 0 ||
      qNorm.indexOf('բաց ') === 0 ||
      qNorm.indexOf('բացի') >= 0 ||
      qNorm.indexOf('գնա') >= 0 ||
      qNorm.indexOf('գնանք') >= 0 ||
      qNorm.indexOf('открой') >= 0 ||
      qNorm.indexOf('открыть') >= 0 ||
      qNorm.indexOf('open ') >= 0 ||
      qNorm.indexOf('go to') >= 0 ||
      qNorm.indexOf('navigate') >= 0 ||
      qNorm.indexOf('перейди') >= 0;
    var softNav =
      qNorm.indexOf('բաժին') >= 0 ||
      qNorm.indexOf('էջ') >= 0 ||
      qNorm.indexOf('раздел') >= 0 ||
      qNorm.indexOf('page') >= 0 ||
      qNorm.indexOf('մենյու') >= 0 ||
      qNorm.indexOf('որտեղ') >= 0 ||
      qNorm.indexOf('где') >= 0 ||
      qNorm.indexOf('where') >= 0 ||
      qNorm.indexOf('ցույց տուր') >= 0 ||
      qNorm.indexOf('show ') >= 0 ||
      qNorm.indexOf('ինչ կա') >= 0 ||
      qNorm.indexOf('what is in') >= 0 ||
      qNorm.indexOf('что в') >= 0;
    var bareSec = isBareSectionNoun(qNorm);
    var catalog = isAppCatalogAsk(qNorm);
    if (!isOpenCmd && !softNav && !isSectionAboutQuery(qNorm) && !bareSec && !catalog) return null;
    var best = null;
    var bestSc = 0;
    NAV_PAGES.forEach(function (np) {
      var sc = 0;
      np.keys.forEach(function (k) {
        var n = norm(k);
        if (n && qNorm.indexOf(n) >= 0) sc += 4 + Math.min(4, n.length / 3);
        else {
          tokens(qNorm).forEach(function (t) {
            if (t.length >= 4 && n.length >= 4 && editDist(t, n) <= 1) sc += 3;
          });
        }
      });
      if (sc > bestSc) { bestSc = sc; best = np; }
    });
    if (bestSc < 4 || !best) return null;
    return { page: best.page, autoOpen: !!(isOpenCmd || bareSec), about: isSectionAboutQuery(qNorm) };
  }

  var PAGE_LABELS_HY = {
    schedule: 'Վերակարգի պլանավորում',
    people: 'Անձնակազմ և Պաշտոն',
    library: 'Աշխատանքային գործիքներ', /* KM_MENU_REORG_V1 */
    lawdocs: 'Իրավական անկյուն',
    network: 'Ցանց և ֆայլեր',
    syssettings: 'Համակարգի կարգավորումներ',
    settings: 'Կարգավորումներ',
    home: 'Հիմնական',
    accounting: 'Հաշվառում',
    unitTools: 'Աշխատանքային գործիքներ',
    dutyTypes: 'Վերակարգ', /* KM_MENU_REORG_V1 */
    positions: 'Անձնակազմ և Պաշտոն',
    users: 'Օգտատերեր',
    admins: 'Ադմինիստրատորներ',
    about: 'Ծրագրի մասին',
    sysinfo: 'Տեղեկություն',
    archive: 'Արխիվ',
    archiveHub: 'Արխիվ', /* KM_RENAME_LEFTOVERS_V1 */
    license: 'Արտոնագիր',
    unitDossiers: 'Անձնակազմ և Պաշտոն',
    orgCorps: 'Բանակային կորպուսներ'
  };

  function pageLabel(page, lang) {
    lang = lang || getLang();
    if (lang === 'ru') {
      var ru = { schedule: 'График', people: 'Личный состав', library: 'Рабочие инструменты' /* KM_MENU_REORG_V1 */, network: 'Сеть и файлы', settings: 'Настройки', home: 'Главная', unitTools: 'Рабочие инструменты', dutyTypes: 'Наряды', archiveHub: 'Архив' /* KM_RENAME_LEFTOVERS_V1 */ };
      return ru[page] || page;
    }
    if (lang === 'en') {
      var en = { schedule: 'Schedule', people: 'Personnel', library: 'Work tools' /* KM_MENU_REORG_V1 */, network: 'Network & files', settings: 'Settings', home: 'Home', unitTools: 'Work tools', dutyTypes: 'Duties', archiveHub: 'Archive' /* KM_RENAME_LEFTOVERS_V1 */ };
      return en[page] || page;
    }
    return PAGE_LABELS_HY[page] || page;
  }

  function isLauncherCommand(q) {
    var s = norm(q);
    if (!s) return false;
    if (hasLauncherVerb(q) && matchNavIntent(s)) return true;
    return /(բաց(իր|ել|ի|տուր)?|open|открой|открыть|show\s+me|գնա|go\s+to|navigate|перейди|բաց\s+տուր)/i.test(s) &&
      (/(ֆայլ|file|\.(pdf|docx?|xlsx?|pptx?|txt|html?|jsonl?|db|png|jpg))\b/i.test(s) ||
        /(թղթապանակ|folder|directory|պանակ)/i.test(s) ||
        /(բաժին|էջ|section|page|menu|մենյու)/i.test(s) ||
        !!matchNavIntent(s));
  }

  function extractLauncherFileQuery(q) {
    var raw = String(q || '');
    var qm = raw.match(/["']([^"']+\.[a-z0-9]{2,5})["']/i);
    if (qm) return qm[1].trim();
    var pm = raw.match(/(?:library\/|գրադարան\/|Library\/|BotKnowledge\/)?([a-zA-Z0-9_\-\u0531-\u0587()\u0400-\u04FF\s]+\.[a-z0-9]{2,5})/i);
    if (pm) return pm[1].trim();
    var fm = raw.replace(/^(խնդր(?:ում\s*եմ|ե[մն])?[,:\s]*)?(բաց(?:իր|ել|ի|տուր)?|open|открой|show)\s+/i, '')
      .match(/([^\s/\\]+\.[a-z0-9]{2,5})\s*$/i);
    if (fm) return fm[1].trim();
    return '';
  }

  function extractLauncherFolderQuery(q) {
    var raw = String(q || '');
    var m = raw.match(/(?:թղթապանակ|folder|directory|պանակ)\s+["']?([^"']+)["']?/i);
    if (m) return m[1].trim();
    return '';
  }

  function classifyLauncherIntent(q) {
    if (!isLauncherCommand(q)) return null;
    var s = norm(q);
    var isOpenCmd = /(բաց(իր|ել|ի|տուր)?|open|открой|գնա|go to|navigate|перейди|show\s+me|բաց\s+տուր)/i.test(s);
    var fileQ = extractLauncherFileQuery(q);
    if (fileQ) {
      return { kind: 'open_file', fileQuery: fileQ, autoOpen: isOpenCmd };
    }
    var folderQ = extractLauncherFolderQuery(q);
    if (folderQ) {
      return { kind: 'open_folder', folderQuery: folderQ, autoOpen: isOpenCmd };
    }
    var nav = matchNavIntent(s);
    if (nav && nav.page) {
      return { kind: 'navigate', page: nav.page, autoOpen: nav.autoOpen || isOpenCmd, about: nav.about };
    }
    return null;
  }

  function friendlyPrefix(lang) {
    if (lang === 'ru') return 'С радостью помогу — ';
    if (lang === 'en') return 'Happy to help — ';
    return 'Սիրով ';
  }

  function wrapFriendlyReply(text, lang, opts) {
    opts = opts || {};
    text = String(text || '').trim();
    if (!text) return text;
    if (/^(Սիրով|Խնդրեմ|Ուրախ|С радостью|Happy to help|Please)/i.test(text)) return text;
    if (opts.soft) {
      var lead = lang === 'ru' ? 'Конечно! ' : (lang === 'en' ? 'Of course! ' : 'Խնդրեմ, ');
      return lead + text;
    }
    return friendlyPrefix(lang) + text.charAt(0).toLowerCase() + text.slice(1);
  }

  async function resolveFileLauncherAction(launch) {
    if (!launch || !launch.fileQuery) return null;
    var fq = launch.fileQuery;
    var hits = [];
    try {
      hits = await searchLibraryFileContents(fq);
    } catch (_) {}
    if (hits && hits.length) {
      var h = hits[0];
      return {
        action: 'open_file',
        label: 'Բացել «' + (h.title || h.name || fq) + '»',
        libId: h.id,
        libType: h.type || h.store || 'files'
      };
    }
    if (/^[a-zA-Z]:\\/.test(fq) || fq.indexOf('\\\\') === 0 || fq.indexOf('/') === 0) {
      return { action: 'open_file', label: 'Բացել ֆայլը', filePath: fq, path: fq };
    }
    return null;
  }

  async function handleLauncherIntent(q, lang) {
    var launch = classifyLauncherIntent(q);
    if (!launch) return null;
    lang = lang || getLang();
    var actions = [];
    var lines = [];
    var autoOpen = null;
    var autoRun = false;

    if (launch.kind === 'open_file') {
      var fAct = await resolveFileLauncherAction(launch);
      if (fAct) {
        actions.push(fAct);
        lines.push(wrapFriendlyReply(
          lang === 'ru'
            ? 'нашёл файл «' + (fAct.label || launch.fileQuery) + '». Можете открыть кнопкой ниже.'
            : (lang === 'en'
              ? 'I found «' + launch.fileQuery + '». Use the button below to open it.'
              : 'գտա «' + launch.fileQuery + '» ֆայլը։ Սեղմեք «Բացել» կոճակը ներքևում։'),
          lang
        ));
        if (launch.autoOpen) autoRun = true;
      } else {
        lines.push(wrapFriendlyReply(
          lang === 'ru'
            ? 'не удалось найти «' + launch.fileQuery + '» в хранилище файлов KM. Проверьте имя или загрузите файл в «Рабочие инструменты → Хранилище файлов».' /* KM_RENAME_LEFTOVERS_V1 */
            : (lang === 'en'
              ? 'I could not find «' + launch.fileQuery + '» in KM file storage. Check the name or upload it in Work tools → File storage.'
              : 'չհաջողվեց գտել «' + launch.fileQuery + '»-ը KM ֆայլերի պահոցում։ Ստուգեք անունը կամ բեռնեք ֆայլը «Աշխատանքային գործիքներ → Ֆայլերի պահոց» բաժնում։' /* KM_MENU_REORG_V1 */),
          lang,
          { soft: true }
        ));
      }
    } else if (launch.kind === 'open_folder') {
      actions.push({
        action: 'open_folder',
        label: lang === 'en' ? 'Open folder' : (lang === 'ru' ? 'Открыть папку' : 'Բացել թղթապանակը'),
        folderPath: launch.folderQuery
      });
      lines.push(wrapFriendlyReply(
        lang === 'ru'
          ? 'открою папку «' + launch.folderQuery + '».'
          : (lang === 'en' ? 'I will open folder «' + launch.folderQuery + '».' : 'կբացեմ «' + launch.folderQuery + '» թղթապանակը։'),
        lang
      ));
      if (launch.autoOpen) autoRun = true;
    } else if (launch.kind === 'navigate' && launch.page) {
      var pl = pageLabel(launch.page, lang);
      actions.push({
        action: 'navigate',
        label: (lang === 'ru' ? 'Открыть «' : (lang === 'en' ? 'Open «' : 'Բացել «')) + pl + '»',
        page: launch.page,
        route: launch.page
      });
      lines.push(wrapFriendlyReply(
        lang === 'ru'
          ? 'перехожу в раздел «' + pl + '».'
          : (lang === 'en' ? 'opening section «' + pl + '».' : '«' + pl + '» բաժինը բացելու համար պատրաստ եմ։'),
        lang
      ));
      if (launch.autoOpen) {
        autoOpen = launch.page;
        autoRun = true;
      }
    }

    if (!lines.length) return null;
    return {
      kind: 'topic',
      topic: {
        id: 'launcher_' + launch.kind,
        title: lang === 'ru' ? 'Действие' : (lang === 'en' ? 'Action' : 'Գործողություն'),
        answer: lines,
        actions: actions
      },
      score: 95,
      autoOpen: autoOpen,
      autoRun: autoRun && actions.length === 1,
      intent: 'launcher'
    };
  }

  function renderInlineActionsHtml(actions, msgId) {
    if (!actions || !actions.length) return '';
    var midAttr = msgId ? (' data-km-hb-mid="' + esc(msgId) + '"') : '';
    return '<div class="kmHbActs" style="margin-top:10px">' + actions.map(function (a, i) {
      var lab = textify(a.label) || ui('open') || 'Բացել';
      if (a.action === 'open_folder' && lab.indexOf('📁') < 0) lab = '📁 ' + lab;
      if (a.action === 'open_file' && lab.indexOf('📄') < 0) lab = '📄 ' + lab;
      if (a.action === 'navigate' && lab.indexOf('🔗') < 0) lab = '🔗 ' + lab;
      return '<button type="button" class="primary" data-km-hb-act="' + i + '"' + midAttr + '>' +
        esc(lab) + '</button>';
    }).join('') + '</div>';
  }

  function composeLiveAnswer(qNorm, lang) {
    /* Never steal section-about questions into global people/unit stats */
    if (isSectionAboutQuery(qNorm)) return null;
    if (resolveSectionFromQuery(qNorm) && /(ինչ կա|what (is |s )?in|что (есть |в )|բաժին|раздел)/i.test(qNorm)) {
      return null;
    }
    var wantsStatus = /(քանի\s*(անձ|հոգի|մարդ|մարդիկ)|сколько\s*(человек|людей)|how many|վիճակագր|բազայի վիճակ|unit count|ակտիվ տույժ|անհարմար օրեր ունեց|personnel count|live stats)/i.test(qNorm);
    var wantsWhere = /(որտեղ է|որ բաժին|где (находит|откры)|where (is|do i)|как открыть|ինչպես բաց)/i.test(qNorm) &&
      !/(իրավաբան|հաշվառ|գրադարան|գրաֆիկ|պաշտոն)/i.test(qNorm);
    if (!wantsStatus && !wantsWhere) return null;
    var st = liveAppStats();
    var lines = [];
    if (lang === 'ru') {
      lines.push('Локальный Smart Engine · снимок этой базы:');
      lines.push('Личный состав: ' + st.people + ' чел., подразделений: ' + st.unitCount + '.');
      lines.push('С неудобными днями: ' + st.withBad + ' · активных взысканий: ' + st.penalties + '.');
      if (st.page) lines.push('Сейчас открыто: ' + st.page + (st.role ? (' · роль: ' + st.role) : '') + '.');
      lines.push('Это не облачный ИИ: ответы из базы KM и текущего состояния программы.');
    } else if (lang === 'en') {
      lines.push('Local Smart Engine · live snapshot:');
      lines.push('Personnel: ' + st.people + ', units: ' + st.unitCount + '.');
      lines.push('With unavailable days: ' + st.withBad + ' · active penalties: ' + st.penalties + '.');
      if (st.page) lines.push('Open page: ' + st.page + (st.role ? (' · role: ' + st.role) : '') + '.');
      lines.push('Not a cloud LLM — answers come from KM knowledge + this install’s data.');
    } else {
      lines.push('Տեղական Smart Engine · այս բազայի ակնթարթային պատկեր՝');
      lines.push('Անձնակազմ՝ ' + st.people + ' · ստորաբաժանումներ՝ ' + st.unitCount + '։');
      lines.push('Անհարմար օրեր ունեցողներ՝ ' + st.withBad + ' · ակտիվ տույժեր՝ ' + st.penalties + '։');
      if (st.page) lines.push('Բաց էջ՝ ' + st.page + (st.role ? (' · դեր՝ ' + st.role) : '') + '։');
      lines.push('Սա ամպային LLM չէ՝ պատասխանները գալիս են KM գիտելիքներից և այս ծրագրի տվյալներից։');
    }
    if (wantsWhere && /անհարմար|bad|неудобн/i.test(qNorm)) {
      lines.push(lang === 'ru'
        ? 'Откройте: Зорамаси գործիքներ → Անհարմար օրեր (по подразделениям).'
        : (lang === 'en'
          ? 'Open: Unit tools → Unavailable days (by subdivision).'
          : 'Բացեք՝ Աշխատանքային գործիքներ → Անհարմար օրեր (ստորաբաժանումների կազմով)։' /* KM_MENU_REORG_V1 */));
    }
    return { kind: 'chat', text: lines.join('\n'), intent: 'live_ai' };
  }

  function buildGreeting() {
    var lang = getLang();
    var name = userName();
    var hour = new Date().getHours();
    var part = hour < 12
      ? (lang === 'ru' ? 'Доброе утро' : (lang === 'en' ? 'Good morning' : 'Բարի լույս'))
      : (hour < 18
        ? (lang === 'ru' ? 'Добрый день' : (lang === 'en' ? 'Good afternoon' : 'Բարի օր'))
        : (lang === 'ru' ? 'Добрый вечер' : (lang === 'en' ? 'Good evening' : 'Բարի երեկո')));
    var hello = name
      ? (lang === 'ru' ? (part + ', ' + name + '!') : (lang === 'en' ? (part + ', ' + name + '!') : (part + ', ' + name + '։')))
      : (part + (lang === 'en' ? '!' : '։'));
    if (lang === 'ru') {
      return hello + '\n\nМогу ответить на общие вопросы и при необходимости помочь по KM. Просто напишите, что вас интересует.';
    }
    if (lang === 'en') {
      return hello + '\n\nI can answer general questions and help with KM when needed. Just tell me what you’d like to know.';
    }
    return hello + '\n\nԿարող եմ ազատ պատասխանել հարցերին և անհրաժեշտության դեպքում օգնել KM-ում։ Պարզապես գրեք՝ ինչն եք ուզում իմանալ։';
  }

  /** True when offline Smart Engine hit is specific enough — do not skip Gemini for weak chat fallbacks. */
  function isSmartEngineStrongHit(hit) {
    if (!hit) return false;
    if (hit.intent === 'clarify' || (hit.kind === 'chat' && hit.intent === 'clarify')) return false;
    if (hit.kind === 'topic') {
      /* Never treat bot-help / soft topic matches as strong — prefer Gemini */
      if (hit.topic && hit.topic.id === 'bot') return false;
      return !!(hit.autoOpen || (hit.score != null && hit.score >= 4.5));
    }
    if (hit.kind === 'chat') {
      var localStrong = {
        greeting: 1, thanks: 1, bye: 1, who: 1, how: 1, chitchat: 1, live_ai: 1, nav: 1
      };
      if (localStrong[hit.intent]) return true;
      /* open / teach / help fallbacks — prefer Gemini when online */
      if (hit.intent === 'open' || hit.intent === 'teach' || hit.intent === 'help' || hit.intent === 'help_ai') {
        return false;
      }
      return !!(hit.score != null && hit.score >= 2.5);
    }
    return false;
  }

  function scoreTopic(topic, qNorm, qTokens, lang) {
    var score = 0;
    var title = textify(pick(topic.title, lang), lang);
    var titleN = norm(title);
    /* Bot-help guide only for explicit «how to use bot» — never via «?» or science Q */
    if (topic && topic.id === 'bot') {
      if (!isExplicitBotHelpAsk(qNorm)) return 0;
    }
    /* Free-form / science questions must not latch onto KM topic cards */
    if (!isKmSystemIntent(qNorm) && !isExplicitBotHelpAsk(qNorm)) {
      return 0;
    }
    if (titleN && qNorm.indexOf(titleN) >= 0) score += 14;
    var kws = topic.keywords || [];
    kws.forEach(function (kw) {
      var k = norm(kw);
      if (!k) return;
      if (qNorm.indexOf(k) >= 0) score += Math.min(10, 2 + k.length / 2.5);
      qTokens.forEach(function (t) {
        if (t === k) score += 5;
        else if (k.indexOf(t) === 0 || t.indexOf(k) === 0) score += 2.5;
        else if (k.length > 3 && t.length > 3 && (k.indexOf(t) >= 0 || t.indexOf(k) >= 0)) score += 1.5;
      });
      score += fuzzyBoost(qTokens, k);
    });
    var ans = pickArr(topic.answer, lang).join(' ');
    var ansN = norm(ans);
    qTokens.forEach(function (t) {
      if (t.length >= 4 && ansN.indexOf(t) >= 0) score += 0.8;
    });
    qTokens.forEach(function (t) {
      if (t.length >= 3 && titleN.indexOf(t) >= 0) score += 1.2;
    });
    return score;
  }

  function localizeTopic(topic, lang) {
    if (!topic) return null;
    if (topic._localized) {
      return {
        id: topic.id,
        title: textify(topic.title, lang),
        keywords: topic.keywords,
        answer: pickArr(topic.answer, lang),
        actions: (topic.actions || []).map(function (a) {
          return {
            label: textify(a.label, lang) || textify(a.label),
            page: a.page,
            run: a.run,
            lawId: a.lawId,
            lawSection: a.lawSection
          };
        }),
        _localized: true
      };
    }
    return {
      id: topic.id,
      title: textify(pick(topic.title, lang), lang),
      keywords: topic.keywords,
      answer: pickArr(topic.answer, lang),
      actions: (topic.actions || []).map(function (a) {
        return {
          label: textify(pick(a.label, lang), lang) || textify(a.label, lang),
          page: a.page,
          run: a.run,
          lawId: a.lawId,
          lawSection: a.lawSection,
          libId: a.libId,
          libType: a.libType
        };
      })
    };
  }

  function openFriendlyReply(lang) {
    var name = userName();
    var hi = name ? (lang === 'en' ? (', ' + name) : (', ' + name)) : '';
    if (lang === 'ru') {
      return 'Я рядом' + hi + '. Могу свободно отвечать на общие вопросы (наука, история, повседневные темы) и при необходимости помочь по KM — график, личный состав, файлы и разделы программы.\n\nПросто напишите, что вас интересует.';
    }
    if (lang === 'en') {
      return 'I’m here' + hi + '. I can freely answer general questions (science, history, everyday topics) and, when needed, help with KM — schedule, personnel, files, and app sections.\n\nJust tell me what you’d like to know.';
    }
    return 'Ես այստեղ եմ' + hi + '։ Կարող եմ ազատ պատասխանել ընդհանուր հարցերին (գիտություն, պատմություն, առօրյա թեմաներ) և անհրաժեշտության դեպքում օգնել նաև KM-ում՝ գրաֆիկ, անձնակազմ, ֆայլեր և ծրագրի բաժիններ։\n\nՊարզապես գրեք՝ ինչն եք ուզում իմանալ։';
  }

  /** Explicit «ինչ կարող ես» — short, no hard section menu dump. */
  function capabilityReply(lang) {
    return openFriendlyReply(lang);
  }

  function clarifyReply(lang, qNorm) {
    void qNorm;
    return openFriendlyReply(lang);
  }

  function isHelpAsk(qNorm) {
    return /(օգն|օգնել|օգնիր|կարող ես|կարո՞ղ ես|ինչ կարող|чем можеш|помог|help me|can you help|how can you|what can you|assist|подскаж)/i.test(qNorm) ||
      /(ինչ ես անում|что умеешь|what do you do|գիտես շփվել|շփվել|զրուցել)/i.test(qNorm);
  }

  function isCapabilityAsk(qNorm) {
    return /(ինչ կարող ես|ինչ գիտես|что ты умеешь|что можешь|capabilities|what can you do|твои возможности|դու գիտես շփվել|գիտես շփվել|կարող ես շփվել|կարող ես խոսել)/i.test(qNorm);
  }

  function isConfused(qNorm) {
    return /(չեմ հասկանում|не понимаю|i don't understand|dont understand|confused|շփոթ)/i.test(qNorm);
  }

  function isAffirm(qNorm) {
    return /^(այո|հա|լավ|ок|окей|да|yes|yep|ok|okay|sure)$/i.test(qNorm);
  }

  function converseAI(qNorm, lang) {
    if (!qNorm) return null;

    if (isCapabilityAsk(qNorm) || isHelpAsk(qNorm)) {
      DIALOG.mode = 'awaiting_topic';
      return { kind: 'chat', text: capabilityReply(lang), intent: 'help_ai', suggest: false };
    }
    if (isConfused(qNorm)) {
      DIALOG.mode = '';
      return { kind: 'chat', text: clarifyReply(lang, ''), intent: 'open', suggest: false };
    }

    /* After “can you help” — short answers like «այո» / «գրաֆիկ» */
    if (DIALOG.mode === 'awaiting_topic') {
      if (isAffirm(qNorm)) {
        return { kind: 'chat', text: openFriendlyReply(lang), intent: 'open', suggest: false };
      }
      /* try soft topic word */
      var soft = null;
      var softScore = 0;
      allTopics().forEach(function (t) {
        var sc = scoreTopic(t, qNorm, expandQueryTokens(tokens(qNorm)), lang);
        if (sc > softScore) { softScore = sc; soft = t; }
      });
      if (soft && softScore >= 1.5) {
        DIALOG.mode = '';
        LAST_TOPIC = soft;
        var topic = localizeTopic(soft, lang);
        if (topic && topic.id === 'system_map') topic = enrichSystemAnswer(soft, lang);
        return { kind: 'topic', topic: topic, score: softScore, alts: [], suggest: true };
      }
    }

    /* Chitchat: short emotional / social */
    if (/^(լավ|լավա|ок|окей|հա|супер|cool|nice)$/i.test(qNorm)) {
      return {
        kind: 'chat',
        text: lang === 'ru'
          ? 'Отлично. Чем ещё помочь — общим вопросом или по KM?'
          : (lang === 'en'
            ? 'Great. Ask anything — general topics or KM help.'
            : 'Լավ։ Հարցրեք ցանկացած բան՝ ընդհանուր թեմա կամ KM։'),
        intent: 'chitchat',
        suggest: false
      };
    }

    return null;
  }

  function matchIntent(qNorm) {
    var intents = (DATA && DATA.intents) || {};
    /* Prefer longer patterns; short ones need word/exact boundaries */
    var keys = Object.keys(intents);
    var best = null;
    var bestLen = 0;
    function escRe(s) {
      return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    function hits(pat) {
      if (!pat) return false;
      if (qNorm === pat) return true;
      if (pat.length <= 3) {
        try {
          return new RegExp('(^|\\s)' + escRe(pat) + '(\\s|$)', 'i').test(qNorm);
        } catch (e0) {
          return false;
        }
      }
      if (qNorm.indexOf(pat) >= 0) return true;
      if (pat.length >= 5 && pat.indexOf(qNorm) >= 0 && qNorm.length >= 4) return true;
      return false;
    }
    keys.forEach(function (id) {
      var it = intents[id];
      (it.patterns || []).forEach(function (raw) {
        var pat = norm(raw);
        if (!hits(pat)) return;
        if (pat.length >= bestLen) {
          bestLen = pat.length;
          best = { id: id, intent: it };
        }
      });
    });
    return best;
  }

  function findBest(query) {
    var lang = getLang();
    var qNorm = norm(query);
    var qTokens = expandQueryTokens(tokens(query));
    if (!qNorm) return null;

    /* Free-form AI questions — answerQuery AI-first path handles Gemini; no local stub here */
    if (!isKmSystemIntent(query)) {
      return {
        kind: 'chat',
        text: '',
        intent: 'teach',
        suggest: false,
        deferLlm: true
      };
    }

    /* Explicit science — defer to Gemini path; do not inject encyclopedia stubs */
    if (looksLikeGeneralKnowledge(query) && !hasKmWorkDomain(qNorm) && !isExplicitBotHelpAsk(query)) {
      return { kind: 'chat', text: '', intent: 'teach', suggest: false, deferLlm: true };
    }

    /* 1) Conversational AI layer first */
    var talk = converseAI(qNorm, lang);
    if (talk) return talk;

    var intent = matchIntent(qNorm);
    if (intent) {
      var replies = pickArr(intent.intent.replies, lang);
      if (!replies.length && intent.intent.reply) replies = pickArr(intent.intent.reply, lang);
      if (intent.id === 'greeting') {
        DIALOG.mode = 'awaiting_topic';
        return { kind: 'chat', text: buildGreeting(), intent: 'greeting', suggest: false };
      }
      if (intent.id === 'help' || intent.id === 'who') {
        DIALOG.mode = '';
        if (intent.id === 'help') {
          return { kind: 'chat', text: capabilityReply(lang), intent: 'help', suggest: false };
        }
      }
      if (replies.length) {
        var name = userName();
        var text = replies[Math.floor(Math.random() * replies.length)];
        if (name) text = text.replace(/\{name\}/g, name ? (' ' + name) : '');
        else text = text.replace(/\s*\{name\}\s*/g, ' ').replace(/\s+/g, ' ').trim();
        return { kind: 'chat', text: text, intent: intent.id, suggest: true };
      }
    }

    var aboutHit = buildSectionAboutHit(qNorm, lang);
    if (aboutHit) {
      DIALOG.mode = '';
      return aboutHit;
    }

    var nav = matchNavIntent(qNorm);
    if (nav && nav.page) {
      DIALOG.mode = '';
      if (nav.about) {
        var aboutNav = buildSectionAboutHit(qNorm, lang);
        if (aboutNav) return aboutNav;
      }
      var openLabel = lang === 'ru' ? 'Открыть раздел' : (lang === 'en' ? 'Open section' : 'Բացել բաժինը');
      var navText = nav.autoOpen
        ? (lang === 'ru'
          ? ('Smart Engine: открываю раздел «' + nav.page + '».')
          : (lang === 'en'
            ? ('Smart Engine: opening «' + nav.page + '».')
            : ('Smart Engine՝ բացում եմ «' + nav.page + '» բաժինը։')))
        : (lang === 'ru'
          ? ('Нужный раздел: «' + nav.page + '». Нажмите кнопку, чтобы открыть.')
          : (lang === 'en'
            ? ('Relevant section: «' + nav.page + '». Tap the button to open it.')
            : ('Համապատասխան բաժին՝ «' + nav.page + '»։ Սեղմեք կոճակը՝ բացելու համար։')));
      return {
        kind: 'topic',
        topic: {
          id: 'nav_' + nav.page,
          title: navText,
          answer: [navText],
          actions: [{ label: openLabel, page: nav.page }],
          _localized: true
        },
        score: 50,
        alts: [],
        autoOpen: nav.autoOpen ? nav.page : ''
      };
    }

    var live = composeLiveAnswer(qNorm, lang);
    if (live) {
      DIALOG.mode = '';
      live.suggest = true;
      return live;
    }

    /* follow-up: more / подробнее / ավելին */
    if (LAST_TOPIC && /^(ավելի|մանրամասն|подробн|more|detail|explain)/i.test(qNorm)) {
      return { kind: 'topic', topic: localizeTopic(LAST_TOPIC, lang), score: 99, alts: [] };
    }

    var list = allTopics();
    if (!list.length) {
      DIALOG.mode = '';
      return { kind: 'chat', text: openFriendlyReply(lang), intent: 'open', suggest: false };
    }
    var best = null;
    var bestScore = 0;
    var alts = [];
    list.forEach(function (t) {
      var sc = scoreTopic(t, qNorm, qTokens, lang);
      if (sc > bestScore) {
        if (best && bestScore >= 4) alts.unshift(best);
        best = t;
        bestScore = sc;
      } else if (sc >= 4) {
        alts.push(t);
      }
    });
    if (bestScore < 4.0) {
      /* Weak topic match — soft AI reply, not hard menu / bot guide */
      DIALOG.mode = '';
      return { kind: 'chat', text: openFriendlyReply(lang), intent: 'open', suggest: false };
    }
    DIALOG.mode = '';
    var topic = localizeTopic(best, lang);
    if (topic && topic.id === 'system_map') topic = enrichSystemAnswer(best, lang);
    LAST_TOPIC = best;
    return {
      kind: 'topic',
      topic: topic,
      score: bestScore,
      alts: alts.slice(0, 4).map(function (t) { return localizeTopic(t, lang); }),
      suggest: true
    };
  }

  function runAction(act) {
    if (!act) return;
    closePanel();
    setTimeout(function () {
      try { runActionCore(act); } catch (e0) {
        if (typeof toast === 'function') toast(ui('openFail') || 'Չհաջողվեց բացել բաժինը', 'warn');
      }
    }, 120);
  }

  function runActionCore(act) {
    if (!act) return;
    var allowedPages = {
      schedule: 1, people: 1, unitBadDays: 1, positions: 1, troopStructure: 1,
      accounting: 1, library: 1, lawdocs: 1, unitTools: 1, unitTrialLab: 1,
      unitTrialExam: 1, unitTrialChar: 1, acts_discipline: 1, users: 1, about: 1,
      home: 1, reports: 1, usb: 1, soldier_rights: 1, dutyTypes: 1, orderDraft: 1,
      admins: 1, archive: 1, archiveHub: 1 /* KM_RENAME_LEFTOVERS_V1 */, license: 1, notes: 1, registrations: 1, management: 1,
      vacations: 1, unitMedical: 1, unitDossiers: 1, unitLeavePlan: 1, unitArchive: 1,
      orgCorps: 1,
      unitFormation: 1, unitTermWatch: 1, unitInventory: 1, unitFuel: 1,
      unitDayPlans: 1, unitBlanks: 1, spreadsheets: 1, tables: 1, workStatus: 1,
      network: 1, settings: 1, sysinfo: 1, syssettings: 1
    };

    if (act.action === 'open_file' || act.filePath || act.path) {
      var fp = act.filePath || act.path;
      if (act.libId) {
        if (typeof window.kmLibOpen === 'function') {
          window.kmLibOpen(act.libId, act.libType || '');
          return;
        }
        if (window.kmNative && window.kmNative.library && window.kmNative.library.open) {
          window.kmNative.library.open({ id: act.libId, type: act.libType || '' });
          return;
        }
      }
      if (fp && window.kmNative && window.kmNative.shell && window.kmNative.shell.openPath) {
        window.kmNative.shell.openPath(fp).catch(function () {
          if (typeof toast === 'function') toast(ui('openFail') || 'Չհաջողվեց բացել ֆայլը', 'warn');
        });
        return;
      }
    }

    if (act.action === 'open_folder' || act.folderPath) {
      var fdir = act.folderPath;
      if (fdir && window.kmNative && window.kmNative.shell) {
        if (window.kmNative.shell.openPath) {
          window.kmNative.shell.openPath(fdir);
          return;
        }
        if (window.kmNative.shell.showItemInFolder) {
          window.kmNative.shell.showItemInFolder(fdir);
          return;
        }
      }
    }

    if (act.action === 'navigate' || act.route) {
      var route = act.route || act.page;
      if (route && typeof window.kmOpenPage === 'function') {
        window.kmOpenPage(route);
        return;
      }
    }

    /* Person card — by name or index */
    if (act.personName && act.mode === 'person_card') {
      if (typeof window.kmPeopleOpenCardByName === 'function') {
        window.kmPeopleOpenCardByName(act.personName);
        return;
      }
      var pIdx = findPersonIndex(act.personName);
      if (pIdx >= 0 && typeof window.kmOpenPersonCard === 'function') {
        window.kmOpenPersonCard(pIdx);
        return;
      }
    }
    if (act.personIndex >= 0 && typeof window.kmOpenPersonCard === 'function') {
      window.kmOpenPersonCard(act.personIndex);
      return;
    }

    /* Position card — by posId */
    if (act.posId && typeof window.kmPositionOpenCard === 'function') {
      if (typeof window.kmOpenPositionsPage === 'function') window.kmOpenPositionsPage();
      setTimeout(function () { window.kmPositionOpenCard(act.posId); }, 90);
      return;
    }
    if (act.page === 'positions' && act.personName) {
      var posId2 = findPosIdForPersonName(act.personName);
      if (posId2 && typeof window.kmPositionOpenCard === 'function') {
        if (typeof window.kmOpenPositionsPage === 'function') window.kmOpenPositionsPage();
        setTimeout(function () { window.kmPositionOpenCard(posId2); }, 90);
        return;
      }
      if (typeof window.kmOpenPositionsPage === 'function') {
        window.kmOpenPositionsPage();
        return;
      }
    }

    if (act.run) {
        var code = String(act.run);
        /* Never eval arbitrary code — whitelist only */
        if (/[;{}]|`|\$\{|Function\s*\(|eval\s*\(|document\.|window\.|require\s*\(/.test(code) &&
            !/^km(OpenPage|SoldierRights(Hub|Open)|CharacteristicPage)\(/.test(code.trim())) {
          if (typeof toast === 'function') toast(ui('openFail') || 'Blocked', 'warn');
          return;
        }
        if (/^kmCharacteristicPage\b/.test(code.trim()) && typeof window.kmCharacteristicPage === 'function') {
          window.kmCharacteristicPage({ back: 'kmLawDocsPage()' });
          return;
        }
        if (code.indexOf('kmSoldierRightsHub') >= 0 && typeof window.kmSoldierRightsHub === 'function') {
          window.kmSoldierRightsHub();
          return;
        }
        if (code.indexOf('kmSoldierRightsOpen') >= 0) {
          var m = code.match(/^kmSoldierRightsOpen\(\s*['"]([a-zA-Z0-9_\-]+)['"]\s*\)$/);
          if (m && typeof window.kmSoldierRightsOpen === 'function') {
            window.kmSoldierRightsOpen(m[1]);
            return;
          }
        }
        if (typeof window.kmOpenPage === 'function') {
          var m2 = code.match(/^kmOpenPage\(\s*['"]([a-zA-Z0-9_\-]+)['"]\s*\)$/);
          if (m2 && allowedPages[m2[1]]) { window.kmOpenPage(m2[1]); return; }
        }
      }
      if (act.page === 'characteristic' && typeof window.kmCharacteristicPage === 'function') {
        window.kmCharacteristicPage({ back: 'kmLawDocsPage()' });
        return;
      }
      if (act.page && act.page !== 'helpBot' && allowedPages[act.page] && typeof window.kmOpenPage === 'function') {
        window.kmOpenPage(act.page);
      }
      if (act.lawId && act.lawSection && typeof window.kmLawsOpen === 'function') {
        window.kmLawsOpen(act.lawId, act.lawSection);
      }
      if (act.libId && typeof window.kmLibOpen === 'function') {
        window.kmLibOpen(act.libId, act.libType || '');
      } else if (act.libId && window.kmNative && window.kmNative.library && window.kmNative.library.open) {
        window.kmNative.library.open({ id: act.libId, type: act.libType || '' });
      }
  }

  function renderBotHtml(topic, alts, msgId) {
    var steps = (topic.answer || []).map(function (line) {
      return '<li>' + esc(textify(line)) + '</li>';
    }).join('');
    var actOffset = 0;
    var flatActions = [];
    var midAttr = msgId ? (' data-km-hb-mid="' + esc(msgId) + '"') : '';
    var groupsHtml = '';
    if (topic.groups && topic.groups.length) {
      groupsHtml = topic.groups.map(function (g) {
        var gLines = (g.lines || []).map(function (line) {
          return '<li>' + esc(textify(line)) + '</li>';
        }).join('');
        var gActsHtml = '';
        var gActs = g.actions || [];
        if (gActs.length) {
          gActsHtml = '<div class="kmHbActs">' + gActs.map(function (a) {
            var idx = flatActions.length;
            flatActions.push(a);
            return '<button type="button" class="primary" data-km-hb-act="' + idx + '"' + midAttr + '>' +
              esc(textify(a.label) || ui('open') || 'Բացել') + '</button>';
          }).join('') + '</div>';
        }
        return '<details class="kmHbGroup"' + (g.open === false ? '' : ' open') + '>' +
          '<summary class="kmHbGroupSum">' + esc(textify(g.title) || '') + '</summary>' +
          (gLines ? ('<ol class="kmHbSteps">' + gLines + '</ol>') : '') +
          gActsHtml +
          '</details>';
      }).join('');
      topic.actions = flatActions.concat((topic.actions || []).filter(function (a) {
        return flatActions.indexOf(a) < 0;
      }));
      actOffset = flatActions.length;
    }
    var leftover = (topic.actions || []).slice(actOffset);
    var acts = leftover.map(function (a, i) {
      return '<button type="button" class="primary" data-km-hb-act="' + (actOffset + i) + '"' + midAttr + '>' +
        esc(textify(a.label) || ui('open') || 'Բացել') + '</button>';
    }).join('');
    var more = '';
    if (alts && alts.length) {
      more = '<div class="kmHbActs" style="margin-top:8px">' +
        alts.map(function (t) {
          var title = textify(t.title);
          return '<button type="button" class="kmHbChip" data-km-hb-q="' + esc(title) + '">' + esc(title) + '</button>';
        }).join('') + '</div>';
    }
    return '<div class="kmHbTitle">' + esc(textify(topic.title)) + '</div>' +
      (steps ? ('<ol class="kmHbSteps">' + steps + '</ol>') : '') +
      groupsHtml +
      (acts ? ('<div class="kmHbActs">' + acts + '</div>') : '') +
      more;
  }

  function pushMsg(role, htmlOrText, isHtml, plainText) {
    var shield = window.KMHelpBotShield;
    var plain = plainText != null ? textify(plainText) : '';
    if (!plain) {
      plain = isHtml
        ? textify(String(htmlOrText || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' '))
        : textify(htmlOrText);
    }
    plain = plain.replace(/\s+/g, ' ').trim();
    if (shield && shield.sanitizePlain) plain = shield.sanitizePlain(plain);
    var html;
    if (isHtml) {
      html = typeof htmlOrText === 'string' ? htmlOrText : textify(htmlOrText).replace(/\n/g, '<br>');
      if (shield && shield.sanitizeOutputHtml) html = shield.sanitizeOutputHtml(html);
    } else {
      html = esc(plain);
    }
    if (!plain && !html) return;
    HISTORY.push({
      id: 'm' + Date.now().toString(36) + Math.floor(Math.random() * 1e5).toString(36),
      role: role,
      html: html,
      text: plain
    });
    if (HISTORY.length > MAX_HIST) HISTORY = HISTORY.slice(-MAX_HIST);
    paintLog();
    scheduleSaveChatMemory();
  }

  function scheduleSaveChatMemory() {
    clearTimeout(SAVE_CHAT_TIMER);
    if (CHAT_RESTORE_BLOCKED || !PERSIST_CHAT_MEMORY) return;
    SAVE_CHAT_TIMER = setTimeout(function () {
      if (CHAT_RESTORE_BLOCKED || !PERSIST_CHAT_MEMORY) return;
      var api = llmApi();
      if (!api || !api.saveChatMemory) return;
      api.saveChatMemory({
        history: HISTORY,
        sessionCtx: SESSION_CTX,
        lastTeach: LAST_TEACH,
        greeted: GREETED
      }).catch(function () {});
    }, 900);
  }

  function wipeLocalChatCaches() {
    try {
      ['km_help_bot_chat', 'kmHelpBotChat', 'KM_HELP_BOT_CHAT', 'km_hb_history'].forEach(function (k) {
        try { localStorage.removeItem(k); } catch (e0) {}
        try { sessionStorage.removeItem(k); } catch (e1) {}
      });
    } catch (e2) {}
  }

  function emitChatCleared() {
    try {
      window.dispatchEvent(new CustomEvent('chat:cleared', { detail: { at: Date.now(), epoch: CHAT_CLEARED_EPOCH } }));
    } catch (eEv) {}
    try {
      document.dispatchEvent(new CustomEvent('chat:cleared', { detail: { at: Date.now(), epoch: CHAT_CLEARED_EPOCH } }));
    } catch (eEv2) {}
  }

  function clearChatDomImmediate() {
    try {
      var log = document.getElementById('kmHbLog');
      if (log) log.innerHTML = '';
    } catch (eDom) {}
  }

  async function restoreChatFromMemory() {
    if (CHAT_RESTORE_BLOCKED) return false;
    var api = llmApi();
    if (!api || !api.getChatMemory) return false;
    try {
      var pack = await api.getChatMemory();
      /* If DB/settings memory is empty — never rebuild from stale UI/cache. */
      if (!pack || !Array.isArray(pack.history) || !pack.history.length) return false;
      if (CHAT_RESTORE_BLOCKED) return false;
      HISTORY = pack.history.map(function (m) {
        var plain = textify(m.text || '');
        var row = {
          id: m.id || ('m' + Date.now().toString(36)),
          role: m.role === 'user' ? 'user' : 'bot',
          text: plain,
          html: typeof m.html === 'string' && m.html ? m.html : esc(plain).replace(/\n/g, '<br>')
        };
        if (Array.isArray(m.actions) && m.actions.length) row.actions = m.actions.slice();
        if (m.topic) row.topic = m.topic;
        return row;
      });
      if (pack.sessionCtx && typeof pack.sessionCtx === 'object') {
        SESSION_CTX = Object.assign({
          style: '', unit: '', facts: [], mood: 'neutral', formality: 'du', ongoing: false, lastTeachTopic: ''
        }, pack.sessionCtx);
      }
      if (pack.lastTeach && typeof pack.lastTeach === 'object') {
        LAST_TEACH = {
          topic: String(pack.lastTeach.topic || ''),
          query: String(pack.lastTeach.query || '')
        };
      }
      GREETED = pack.greeted !== false;
      if (HISTORY.length > MAX_HIST) HISTORY = HISTORY.slice(-MAX_HIST);
      return true;
    } catch (eRestore) {
      return false;
    }
  }

  function turnLimitReply(lang, gate) {
    gate = gate || {};
    var lim = gate.limit || 800;
    if (lang === 'ru') {
      return 'Достигнут дневной лимит диалога (' + lim + ' turn). Продолжим завтра или очистите чат (Clear).';
    }
    if (lang === 'en') {
      return 'Daily conversation limit reached (' + lim + ' turns). Continue tomorrow or tap Clear.';
    }
    return 'Օրական երկխոսության սահմանաչափը լրացել է (' + lim + ' turn)։ Շարունակել կարող եք վաղը կամ «Մաքրել»-ով։';
  }

  var TTS_PLAYING_ID = '';
  var TTS_UTTER = null;
  var TTS_WATCH = null;
  var TTS_WEB_AUDIO = null;
  var TTS_WEB_URL = '';
  var TTS_HY_NOTE_SHOWN = false;

  var TTS_HY_DIGITS = ['զրո', 'մեկ', 'երկու', 'երեք', 'չորս', 'հինգ', 'վեց', 'յոթ', '\u0578\u0569', 'ինը'];

  function speechLangCode() {
    var lang = getLang();
    if (lang === 'ru') return 'ru-RU';
    if (lang === 'en') return 'en-US';
    return 'hy-AM';
  }

  function stopWebTts() {
    try {
      if (TTS_WEB_AUDIO) {
        TTS_WEB_AUDIO.pause();
        TTS_WEB_AUDIO.src = '';
        TTS_WEB_AUDIO = null;
      }
    } catch (eW0) {}
    try {
      if (TTS_WEB_URL) {
        URL.revokeObjectURL(TTS_WEB_URL);
        TTS_WEB_URL = '';
      }
    } catch (eW1) {}
  }

  function stopBotSpeech() {
    try {
      if (TTS_WATCH) { clearTimeout(TTS_WATCH); TTS_WATCH = null; }
    } catch (eW) {}
    stopWebTts();
    try {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
        try { window.speechSynthesis.resume(); } catch (eR) {}
      }
    } catch (e0) {}
    TTS_UTTER = null;
    TTS_PLAYING_ID = '';
    syncTtsButtons();
  }

  function withSpeechVoices(done) {
    var synth = window.speechSynthesis;
    if (!synth) { done([]); return; }
    var voices = [];
    try { voices = synth.getVoices() || []; } catch (e1) { voices = []; }
    if (voices.length) { done(voices); return; }
    var finished = false;
    function finish() {
      if (finished) return;
      finished = true;
      try { synth.removeEventListener('voiceschanged', onCh); } catch (e2) {}
      var v2 = [];
      try { v2 = synth.getVoices() || []; } catch (e3) { v2 = []; }
      done(v2);
    }
    function onCh() { finish(); }
    try { synth.addEventListener('voiceschanged', onCh); } catch (e4) {}
    setTimeout(finish, 700);
  }

  function ttsNormVoiceLang(v) {
    return String(v && v.lang || '').toLowerCase().replace('_', '-');
  }

  function isArmenianSpeechVoice(v) {
    if (!v) return false;
    var vl = ttsNormVoiceLang(v);
    if (vl === 'hy-am' || vl === 'hy' || vl.indexOf('hy-') === 0) return true;
    var nm = String(v.name || '').toLowerCase();
    return /armenian|hayastan|hayastani|\bani\b|\barev\b|\.hy\b|հայ/i.test(nm);
  }

  function hasArmenianSpeechVoice(voices) {
    voices = voices || [];
    for (var i = 0; i < voices.length; i++) {
      if (isArmenianSpeechVoice(voices[i])) return true;
    }
    return false;
  }

  function canWebTtsFetch() {
    return !!(window.kmNative && window.kmNative.helpBot &&
      typeof window.kmNative.helpBot.ttsFetch === 'function');
  }

  function pickSpeechVoice(voices, langCode) {
    voices = voices || [];
    if (!voices.length) return null;
    var want = String(langCode || 'hy-AM').toLowerCase().replace('_', '-');
    var short = want.slice(0, 2);
    var exact = null;
    var prefix = null;
    var ru = null;
    var en = null;
    var hyCloud = null;
    var hyLocal = null;
    var cloudAny = null;
    for (var i = 0; i < voices.length; i++) {
      var v = voices[i];
      var vl = ttsNormVoiceLang(v);
      if (vl === want) exact = exact || v;
      else if (vl.indexOf(short + '-') === 0 || vl === short) prefix = prefix || v;
      if (isArmenianSpeechVoice(v)) {
        if (v.localService === false) hyCloud = hyCloud || v;
        else hyLocal = hyLocal || v;
      }
      if (v.localService === false) cloudAny = cloudAny || v;
      if (vl.indexOf('ru') === 0) ru = ru || v;
      if (vl.indexOf('en') === 0) en = en || v;
    }
    if (short === 'hy') {
      return hyCloud || hyLocal || exact || prefix || cloudAny || en || ru || voices[0] || null;
    }
    return exact || prefix || ru || en || voices[0];
  }

  function ttsHyDigitChunk(chunk) {
    var out = [];
    var i;
    var c;
    for (i = 0; i < chunk.length; i++) {
      c = chunk.charAt(i);
      if (c >= '0' && c <= '9') out.push(TTS_HY_DIGITS[Number(c)]);
      else if (c === '.' || c === ',') out.push('կոմա');
      else if (c === '/') out.push('կլան');
      else if (c === '-') out.push('նշան');
    }
    return out.join(' ');
  }

  function ttsHyTeens(n) {
    var teens = {
      10: 'տաս', 11: 'տասը մեկ', 12: 'տասը երկու', 13: 'տասը երեք', 14: 'տասը չորս',
      15: 'տասը հինգ', 16: 'տասը վեց', 17: 'տասը յոթ', 18: 'տասը ութ', 19: 'տասը ինը'
    };
    return teens[n] || '';
  }

  function ttsHyUnder1000(n) {
    if (n < 10) return TTS_HY_DIGITS[n];
    if (n < 20) return ttsHyTeens(n);
    if (n < 100) {
      var tens = Math.floor(n / 10);
      var ones = n % 10;
      var t = tens === 2 ? 'քսան' : tens === 3 ? 'երեսուն' : tens === 4 ? 'արասուն' :
        tens === 5 ? 'հիսուն' : tens === 6 ? 'վաթսուն' : tens === 7 ? 'յոթանասուն' :
          tens === 8 ? 'ութսուն' : tens === 9 ? 'իննսուն' : 'տաս';
      return ones ? t + ' ' + TTS_HY_DIGITS[ones] : t;
    }
    if (n < 1000) {
      var h = Math.floor(n / 100);
      var rest = n % 100;
      var hw = h === 1 ? 'հարյուր' : TTS_HY_DIGITS[h] + ' հարյուր';
      return rest ? hw + ' ' + ttsHyUnder1000(rest) : hw;
    }
    return String(n);
  }

  function ttsHyNumberToken(numStr) {
    var clean = String(numStr || '').replace(/\s/g, '');
    if (!/^\d+$/.test(clean)) return ttsHyDigitChunk(clean);
    if (clean.length > 4) return ttsHyDigitChunk(clean);
    var n = parseInt(clean, 10);
    if (!isFinite(n)) return ttsHyDigitChunk(clean);
    if (n < 1000) return ttsHyUnder1000(n);
    if (n < 10000) {
      var thou = Math.floor(n / 1000);
      var rest = n % 1000;
      var tw = thou === 1 ? 'հազար' : ttsHyUnder1000(thou) + ' հազար';
      return rest ? tw + ' ' + ttsHyUnder1000(rest) : tw;
    }
    return ttsHyDigitChunk(clean);
  }

  function prepareSpeechText(text, lang) {
    var s = String(text || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;|&amp;|&lt;|&gt;/gi, ' ')
      .replace(/[🔊⏹👍👎•·▪▫►◆★☆]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (lang === 'hy') {
      s = s.replace(/\d[\d.,\-\/]*/g, function (chunk) {
        return ttsHyNumberToken(chunk.replace(/[^\d]/g, '')) || ttsHyDigitChunk(chunk);
      });
      s = s.replace(/%/g, ' տոկոս ');
      s = s.replace(/\s+/g, ' ').trim();
    }
    return s;
  }

  function splitTtsChunks(text, maxLen) {
    maxLen = maxLen || 180;
    var parts = [];
    var s = String(text || '').trim();
    while (s.length > maxLen) {
      var cut = s.lastIndexOf(' ', maxLen);
      if (cut < 40) cut = maxLen;
      parts.push(s.slice(0, cut).trim());
      s = s.slice(cut).trim();
    }
    if (s) parts.push(s);
    return parts;
  }

  function noteHyTtsMode(webMode) {
    if (TTS_HY_NOTE_SHOWN || getLang() !== 'hy') return;
    TTS_HY_NOTE_SHOWN = true;
    hbToast(
      webMode
        ? 'Հայերենը կարդում ենք առցանց ձայնով (Windows Speech Pack պետք չէ)։'
        : 'Առցանց ձայնն անհասանելի է — տեքստը շարունակվում է։',
      'info'
    );
  }

  function ttsSoftFailToast() {
    hbToast(
      getLang() === 'en'
        ? 'Speech unavailable right now — text chat still works.'
        : (getLang() === 'ru'
          ? 'Озвучка сейчас недоступна — текстовый чат работает.'
          : 'Ձայնը այս պահին հասանելի չէ — տեքստային աշխատանքը շարունակվում է։'),
      'info'
    );
  }

  function speakViaWebTts(msgId, text, lang, onFail, onDone) {
    var fetchFn = window.kmNative && window.kmNative.helpBot && window.kmNative.helpBot.ttsFetch;
    if (!fetchFn) {
      if (onFail) onFail();
      return;
    }
    stopWebTts();
    TTS_PLAYING_ID = msgId || '';
    syncTtsButtons();
    noteHyTtsMode(true);
    var chunks = splitTtsChunks(text, 180);
    var tl = lang === 'ru' ? 'ru' : (lang === 'en' ? 'en' : 'hy');
    var idx = 0;

    function failWeb() {
      stopWebTts();
      if (onFail) onFail();
      else {
        TTS_PLAYING_ID = '';
        syncTtsButtons();
      }
    }

    function playNext() {
      if (TTS_PLAYING_ID !== msgId) return;
      if (idx >= chunks.length) {
        stopWebTts();
        if (onDone) onDone();
        else {
          TTS_PLAYING_ID = '';
          syncTtsButtons();
        }
        return;
      }
      fetchFn({ text: chunks[idx], lang: tl }).then(function (res) {
        if (TTS_PLAYING_ID !== msgId) return;
        if (!res || !res.ok || !res.base64) { failWeb(); return; }
        try {
          var bin = atob(res.base64);
          var arr = new Uint8Array(bin.length);
          var j;
          for (j = 0; j < bin.length; j++) arr[j] = bin.charCodeAt(j);
          var blob = new Blob([arr], { type: res.mime || 'audio/mpeg' });
          if (TTS_WEB_URL) {
            try { URL.revokeObjectURL(TTS_WEB_URL); } catch (eRev) {}
          }
          TTS_WEB_URL = URL.createObjectURL(blob);
          var aud = new Audio(TTS_WEB_URL);
          TTS_WEB_AUDIO = aud;
          aud.onended = function () {
            idx += 1;
            playNext();
          };
          aud.onerror = function () { failWeb(); };
          var playP = aud.play();
          if (playP && typeof playP.catch === 'function') {
            playP.catch(function () { failWeb(); });
          }
        } catch (ePlay) {
          failWeb();
        }
      }).catch(function () { failWeb(); });
    }
    playNext();
  }

  function startSynthSpeak(msgId, say, voice, lang, uiLang, onFail, onDone) {
    var synth = window.speechSynthesis;
    if (!synth) {
      if (onFail) onFail();
      return;
    }
    try { if (TTS_WATCH) clearTimeout(TTS_WATCH); } catch (eW0) {}
    try { synth.cancel(); } catch (eC) {}
    TTS_UTTER = null;

    setTimeout(function () {
      try {
        var u = new window.SpeechSynthesisUtterance(say.slice(0, 4500));
        if (voice) {
          u.voice = voice;
          u.lang = voice.lang || lang;
        } else {
          u.lang = lang;
        }
        u.rate = 1;
        u.pitch = 1;
        u.volume = 1;
        TTS_UTTER = u;
        TTS_PLAYING_ID = msgId || '';
        syncTtsButtons();

        u.onend = function () {
          TTS_UTTER = null;
          if (TTS_PLAYING_ID !== msgId) return;
          if (onDone) onDone();
          else {
            TTS_PLAYING_ID = '';
            syncTtsButtons();
          }
        };
        u.onerror = function () {
          TTS_UTTER = null;
          if (TTS_PLAYING_ID !== msgId) return;
          if (onFail) onFail();
          else {
            TTS_PLAYING_ID = '';
            syncTtsButtons();
          }
        };

        try { synth.resume(); } catch (eR2) {}
        synth.speak(u);

        setTimeout(function () {
          try {
            if (synth.paused) synth.resume();
            if (!synth.speaking && !synth.pending && TTS_PLAYING_ID === msgId) {
              synth.speak(u);
            }
          } catch (eRetry) {}
        }, 120);

        TTS_WATCH = setTimeout(function () {
          TTS_WATCH = null;
          try {
            if (TTS_PLAYING_ID === msgId && !synth.speaking && !synth.pending) {
              if (onFail) onFail();
              else {
                TTS_PLAYING_ID = '';
                TTS_UTTER = null;
                syncTtsButtons();
              }
            }
          } catch (eWatch) {}
        }, 2200);
      } catch (e2) {
        TTS_UTTER = null;
        if (onFail) onFail();
        else {
          TTS_PLAYING_ID = '';
          syncTtsButtons();
        }
      }
    }, 80);
  }

  function finishTtsChain(msgId) {
    if (TTS_PLAYING_ID === msgId) TTS_PLAYING_ID = '';
    stopWebTts();
    syncTtsButtons();
  }

  function speakBotText(msgId, text) {
    var sayHy = prepareSpeechText(text, 'hy');
    if (!sayHy) {
      hbToast(getLang() === 'en' ? 'Nothing to read' : (getLang() === 'ru' ? 'Нечего читать' : 'Կարդալու տեքստ չկա'), 'info');
      return;
    }

    stopBotSpeech();

    var synthOk = !!(window.speechSynthesis && typeof window.SpeechSynthesisUtterance === 'function');
    var webOk = canWebTtsFetch();

    function done() {
      finishTtsChain(msgId);
    }
    function allFailed() {
      finishTtsChain(msgId);
      ttsSoftFailToast();
    }

    function trySynth() {
      if (!synthOk) {
        allFailed();
        return;
      }
      withSpeechVoices(function (voices) {
        if (TTS_PLAYING_ID && TTS_PLAYING_ID !== msgId) return;
        TTS_PLAYING_ID = msgId || '';
        var voice = pickSpeechVoice(voices, 'hy-AM');
        startSynthSpeak(msgId, sayHy, voice, 'hy-AM', 'hy', allFailed, done);
      });
    }

    /* Միայն հայերեն */
    if (webOk) {
      speakViaWebTts(msgId, sayHy, 'hy', trySynth, done);
      return;
    }
    trySynth();
  }

  function syncTtsButtons() {
    var log = document.getElementById('kmHbLog');
    if (!log) return;
    log.querySelectorAll('[data-km-hb-tts-id]').forEach(function (row) {
      var id = row.getAttribute('data-km-hb-tts-id') || '';
      var playing = !!(TTS_PLAYING_ID && id === TTS_PLAYING_ID);
      var playBtn = row.querySelector('[data-km-hb-tts-act="play"]');
      var stopBtn = row.querySelector('[data-km-hb-tts-act="stop"]');
      if (playBtn) {
        if (playing) playBtn.setAttribute('hidden', 'hidden');
        else playBtn.removeAttribute('hidden');
        playBtn.classList.toggle('is-playing', playing);
      }
      if (stopBtn) {
        if (playing) stopBtn.removeAttribute('hidden');
        else stopBtn.setAttribute('hidden', 'hidden');
      }
    });
  }

  function ttsControlsHtml(msgId) {
    var listen = getLang() === 'ru' ? 'Слушать' : (getLang() === 'en' ? 'Listen' : 'Լսել');
    var stop = getLang() === 'ru' ? 'Стоп' : (getLang() === 'en' ? 'Stop' : 'Կանգ');
    return '<div class="kmHbTtsRow" data-km-hb-tts-id="' + esc(msgId) + '">' +
      '<button type="button" class="kmHbTtsBtn" data-km-hb-tts-act="play" title="' + esc(listen) + '">🔊 ' + esc(listen) + '</button>' +
      '<button type="button" class="kmHbTtsBtn" data-km-hb-tts-act="stop" title="' + esc(stop) + '" hidden>⏹ ' + esc(stop) + '</button>' +
      '</div>';
  }

  function ensureActClickDelegation() {
    var log = document.getElementById('kmHbLog');
    if (!log || log.getAttribute('data-km-act-bound') === '1') return;
    log.setAttribute('data-km-act-bound', '1');
    log.addEventListener('click', function (ev) {
      var t = ev.target;
      if (!t) return;
      var btn = (t.closest && t.closest('[data-km-hb-act]')) || null;
      if (!btn && t.getAttribute && t.getAttribute('data-km-hb-act') != null) btn = t;
      if (!btn) return;
      try { ev.preventDefault(); ev.stopPropagation(); } catch (e0) {}
      var mid = btn.getAttribute('data-km-hb-mid') || '';
      var idx = Number(btn.getAttribute('data-km-hb-act'));
      if (!mid || !Number.isFinite(idx)) return;
      var msg = null;
      for (var i = 0; i < HISTORY.length; i++) {
        if (HISTORY[i].id === mid) { msg = HISTORY[i]; break; }
      }
      if (!msg || !Array.isArray(msg.actions) || !msg.actions[idx]) return;
      runAction(msg.actions[idx]);
    }, true);
  }

  function ensureTtsClickDelegation() {
    var log = document.getElementById('kmHbLog');
    if (!log || log.getAttribute('data-km-tts-bound') === '1') return;
    log.setAttribute('data-km-tts-bound', '1');
    log.addEventListener('click', function (ev) {
      var t = ev.target;
      if (!t) return;
      var btn = (t.closest && t.closest('[data-km-hb-tts-act]')) || null;
      if (!btn && t.getAttribute && t.getAttribute('data-km-hb-tts-act')) btn = t;
      if (!btn) return;
      try { ev.preventDefault(); ev.stopPropagation(); } catch (e0) {}
      var act = btn.getAttribute('data-km-hb-tts-act');
      var row = btn.closest ? btn.closest('[data-km-hb-tts-id]') : null;
      var id = row ? row.getAttribute('data-km-hb-tts-id') : '';
      if (act === 'stop') {
        stopBotSpeech();
        return;
      }
      var msg = null;
      for (var i = 0; i < HISTORY.length; i++) {
        if (HISTORY[i].id === id) { msg = HISTORY[i]; break; }
      }
      var plain = msg && msg.text ? msg.text : '';
      if (!plain && row) {
        try {
          var bubble = row.parentNode;
          plain = textify(String((bubble && bubble.innerText) || '').replace(/🔊.*|⏹.*|Լսել|Կանգ|Listen|Stop|Слушать|Стоп/g, ' '));
        } catch (e1) {}
      }
      speakBotText(id, plain);
    }, true);
  }

  function paintLog() {
    var log = document.getElementById('kmHbLog');
    if (!log) return;
    ensureTtsClickDelegation();
    ensureActClickDelegation();
    log.innerHTML = HISTORY.map(function (m) {
      var cls = 'kmHbMsg ' + esc(m.role) + (m.typing ? ' typing' : '');
      var tts = '';
      if (m.role === 'bot' && !m.typing && m.text && m.id) {
        tts = ttsControlsHtml(m.id);
      }
      return '<div class="' + cls + '" data-km-hb-mid="' + esc(m.id || '') + '"><div class="kmHbBubble">' + m.html + tts + '</div></div>';
    }).join('');
    log.scrollTop = log.scrollHeight;
    syncTtsButtons();
    try { bindLogClicks(null); } catch (eBindPaint) {}
  }

  /* Warm up system voices early (Electron/Chromium) */
  try {
    if (window.speechSynthesis) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.addEventListener('voiceschanged', function () {
        try { window.speechSynthesis.getVoices(); } catch (eV) {}
      });
    }
  } catch (eWarm) {}

  function showTyping() {
    var label = ui('typing') || 'Գրում է…';
    HISTORY.push({
      id: 't' + Date.now().toString(36),
      role: 'bot',
      typing: true,
      text: '',
      html: '<span class="kmHbTypingDots"><span></span><span></span><span></span></span> ' + esc(label)
    });
    if (HISTORY.length > MAX_HIST) HISTORY = HISTORY.slice(-MAX_HIST);
    paintLog();
  }

  function hideTyping() {
    var before = HISTORY.length;
    HISTORY = HISTORY.filter(function (m) { return !m.typing; });
    if (HISTORY.length !== before) paintLog();
  }

  function sleep(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function resetSessionCtx() {
    SESSION_CTX = { style: '', unit: '', facts: [], mood: 'neutral', formality: 'du', ongoing: false, lastTeachTopic: '' };
  }

  function escalateHtml() {
    var lab = ui('escalate') || 'Կապվել ադմինի հետ';
    return '<div class="kmHbActs" style="margin-top:10px">' +
      '<button type="button" class="primary" data-km-hb-escalate="1">' + esc(lab) + '</button>' +
      '</div>';
  }

  function applySessionHints(q, lang) {
    var api = llmApi();
    if (!api || typeof api.extractSessionHints !== 'function') return null;
    var h = api.extractSessionHints(q);
    if (!h || !h.changed) return null;
    if (h.style) SESSION_CTX.style = h.style;
    if (h.unit) SESSION_CTX.unit = h.unit;
    if (h.facts && h.facts.length) {
      h.facts.forEach(function (f) {
        if (SESSION_CTX.facts.indexOf(f) < 0) SESSION_CTX.facts.unshift(f);
      });
      SESSION_CTX.facts = SESSION_CTX.facts.slice(0, 10);
    }
    if (h.promoteLongTerm && api.touchUserMemory) {
      var prefs = {};
      if (h.style) prefs.style = h.style;
      if (h.unit) prefs.unit = h.unit;
      if (h.facts && h.facts.length) prefs.factsAppend = h.facts.slice();
      api.touchUserMemory({ prefs: prefs }).catch(function () {});
    }
    var ack = lang === 'ru' ? h.ackRu : (lang === 'en' ? h.ackEn : h.ackHy);
    return ack || null;
  }

  function feedbackHtml(fid) {
    if (!fid) return '';
    return '<span class="kmHbFb" data-km-hb-fid="' + esc(fid) + '">' +
      '<button type="button" title="👍" data-km-hb-fb="up">👍</button>' +
      '<button type="button" title="👎" data-km-hb-fb="down">👎</button>' +
      '</span>';
  }

  async function pushBotReply(plainText, extraHtml, meta) {
    meta = meta || {};
    var plain = textify(plainText);
    var shouldFriendly = meta.friendly === true ||
      (meta.friendly !== false && (
        meta.source === 'offline_vector' ||
        meta.source === 'fts5-simple' ||
        meta.source === 'like-simple' ||
        meta.source === 'file_search' ||
        meta.source === 'local' ||
        meta.source === 'local_offline'
      ));
    if (shouldFriendly && plain) {
      plain = wrapFriendlyReply(plain, getLang(), meta.friendlySoft ? { soft: true } : {});
    }
    var fid = 'fb_' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
    var msgId = 'm' + Date.now().toString(36) + Math.floor(Math.random() * 1e5).toString(36);
    var actions = Array.isArray(meta.actions) ? meta.actions.slice() : [];
    var actsHtml = actions.length ? renderInlineActionsHtml(actions, msgId) : '';
    var html = esc(plain).replace(/\n/g, '<br>') + actsHtml + (extraHtml || '') +
      '<div style="margin-top:8px">' + feedbackHtml(fid) + '</div>';
    HISTORY.push({
      id: msgId,
      role: 'bot',
      html: html,
      text: plain,
      actions: actions
    });
    if (HISTORY.length > MAX_HIST) HISTORY = HISTORY.slice(-MAX_HIST);
    paintLog();
    scheduleSaveChatMemory();
    bindLogClicks(meta.topic || null);
    try {
      if (meta.source !== 'error' && LAST_CHARGED_GEN !== ANSWER_GEN) {
        LAST_CHARGED_GEN = ANSWER_GEN;
        var turnApi = llmApi();
        if (turnApi && turnApi.incrementTurn) turnApi.incrementTurn().catch(function () {});
      }
    } catch (eTurnC) {}
    if (meta.autoRunAction && actions[0]) {
      setTimeout(function () { runAction(actions[0]); }, 380);
    }
    var api = llmApi();
    if (api && api.logInteraction) {
      api.logInteraction({
        q: LAST_USER_Q || meta.q || '',
        a: plain || '',
        source: meta.source || 'smart',
        topicId: meta.topicId || '',
        id: fid
      }).catch(function () {});
    }
    archiveConversation(LAST_USER_Q || meta.q || '', plain || '', meta.source || 'helpbot', {
      intent: meta.intent || '',
      topicId: meta.topicId || ''
    });
    return fid;
  }

  function buildRagPack(query, lang) {
    var qNorm = norm(query);
    var qTokens = expandQueryTokens(tokens(query));
    var list = allTopics();
    var keywordHits = list.map(function (t) {
      return { topic: t, score: scoreTopic(t, qNorm, qTokens, lang) };
    }).filter(function (x) { return x.score > 0; });

    var api = llmApi();
    var tfidfHits = [];
    var bm25Hits = [];
    if (api && typeof api.tfidfRetrieve === 'function') {
      try { tfidfHits = api.tfidfRetrieve(query, list, lang, 5) || []; } catch (eTf) { tfidfHits = []; }
    }
    if (api && typeof api.bm25Retrieve === 'function') {
      try { bm25Hits = api.bm25Retrieve(query, list, lang, 5) || []; } catch (eBm) { bm25Hits = []; }
    }
    var merged = (api && api.mergeRagHits)
      ? api.mergeRagHits(keywordHits.concat(bm25Hits.map(function (h) {
          return { topic: h.topic, score: (Number(h.score) || 0) * 3 };
        })), tfidfHits, 6)
      : keywordHits.sort(function (a, b) { return b.score - a.score; }).slice(0, 5);
    var scored = merged;

    var blocks = scored.map(function (x) {
      var loc = localizeTopic(x.topic, lang);
      var ans = (loc.answer || []).slice(0, 4).join(' | ');
      return '- [' + (loc.id || '') + '] ' + (loc.title || '') + ': ' + ans;
    });

    var st = liveAppStats();
    var statsLine =
      'Live stats: people=' + st.people +
      ', units=' + st.unitCount +
      ', withBadDays=' + st.withBad +
      ', penalties=' + st.penalties +
      ', page=' + (st.page || '—') +
      ', role=' + (st.role || '—');

    var contentExtra = '';
    try {
      var liveHits = searchLiveAppContent(query);
      if (liveHits.length) {
        contentExtra += '\nLive content hits:\n' + contentRagLines(liveHits, []);
        absorbLearningFromHits(liveHits);
      }
    } catch (eLive) {}
    try {
      var acctHits = searchAccountingContent(query);
      if (acctHits.length) {
        contentExtra += '\nAccounting / Positions card hits:\n' + acctHits.slice(0, 6).map(function (h) {
          return '- [' + (h.section || '') + '] ' + (h.title || '') + ': ' + String(h.snippet || '').slice(0, 120);
        }).join('\n');
        absorbLearningFromHits(acctHits);
      }
    } catch (eAc) {}
    try {
      var ents = extractQueryEntities(query);
      contentExtra += '\nExtracted entities: orders=' + (ents.orderNums.join('|') || '—') +
        '; dates=' + (ents.dates.join('|') || '—') +
        '; names=' + (ents.names.join('|') || '—');
    } catch (eEn) {}
    try {
      contentExtra += '\nSection tree: ' + (SECTION_TREE || []).map(function (s) {
        return s.label + '(' + (s.kids || []).slice(0, 4).join('/') + ')';
      }).join('; ');
    } catch (eSt) {}
    try {
      var learnedN = Object.keys((loadLearnedVocab().words) || {}).length;
      contentExtra += '\nSelf-learned vocab size: ' + learnedN;
    } catch (eLv) {}

    return {
      topics: scored.map(function (x) { return localizeTopic(x.topic, lang); }),
      topScore: scored.length ? scored[0].score : 0,
      ragText: (blocks.length ? blocks.join('\n') : '(no topic hits)') + '\n' + statsLine + contentExtra,
      stats: st,
      offline: true
    };
  }

  async function enrichRagWithFiles(rag, query) {
    if (!rag) return rag;
    try {
      var files = await searchLibraryFileContents(query);
      if (files && files.length) {
        rag.ragText += '\nLoaded file content hits (HTML/PDF/Word/Excel/PPT — MUST use when relevant):\n' +
          contentRagLines([], files);
        rag.fileHits = files;
      }
    } catch (e0) {}
    try {
      var ragPack = await searchBotRagHybrid(query, getLang());
      if (ragPack && ragPack.answers && ragPack.answers.length) {
        rag.ragText += '\nHybrid offline RAG (BM25+vector) structured hits — MUST cite quotes only from these:\n' +
          ragPack.answers.map(function (a) { return a.structured; }).join('\n---\n');
        rag.botRag = ragPack;
      }
    } catch (e1) {}
    return rag;
  }

  function llmApi() {
    return window.KMHelpBotLLM || null;
  }

  async function refreshLlmBadge() {
    var api = llmApi();
    var badge = document.getElementById('kmHbEngineBadge');
    if (!badge) return;
    if (!api) {
      badge.textContent = ui('smart') || 'Smart Engine';
      badge.className = 'kmHbBadge on';
      LLM_STATUS = { mode: 'smart' };
      return;
    }
    try {
      var cfg = await api.loadConfig(false);
      if (api.canUseLlm(cfg)) {
        var local = api.isLocalProvider ? api.isLocalProvider(cfg) : (cfg.provider === 'openai_compat');
        if (local) {
          var probe = await api.probeLocalServer(false);
          if (probe && probe.ok) {
            badge.textContent = ui('localLlm') || 'Local LLM';
            badge.className = 'kmHbBadge llm';
            LLM_STATUS = { mode: 'local' };
          } else {
            badge.textContent = ui('smart') || 'Smart Engine';
            badge.className = 'kmHbBadge on';
            LLM_STATUS = { mode: 'smart' };
          }
        } else {
          badge.textContent = ui('llmOnline') || 'LLM Online';
          badge.className = 'kmHbBadge llm';
          LLM_STATUS = { mode: 'llm' };
        }
      } else {
        badge.textContent = ui('smart') || 'Smart Engine';
        badge.className = 'kmHbBadge on';
        LLM_STATUS = { mode: 'smart' };
      }
    } catch (e0) {
      badge.textContent = ui('smart') || 'Smart Engine';
      badge.className = 'kmHbBadge on';
    }
  }

  async function doEscalate(note, sentiment) {
    var api = llmApi();
    var msgs = HISTORY.filter(function (m) { return !m.typing; }).slice(-10).map(function (m) {
      return { role: m.role, text: String(m.text || '').slice(0, 500) };
    });
    var pageNow = '';
    try { pageNow = String(window.page || ''); } catch (e0) {}
    if (api && typeof api.createTicket === 'function') {
      await api.createTicket({
        note: note || '',
        sentiment: sentiment || 'neutral',
        page: pageNow,
        messages: msgs
      });
    }
    var lang = getLang();
    var ok =
      lang === 'ru'
        ? 'Заявка отправлена администратору. Он увидит её в настройках → «Աջակցման հայտեր».'
        : (lang === 'en'
          ? 'Support ticket created for the admin (Settings → support tickets).'
          : 'Աջակցման հայտը ստեղծվեց ադմինի համար (Կարգավորումներ → Աջակցման հայտեր)։');
    pushMsg('bot', ok, false);
  }

  function suggestionChipsHtml() {
    return suggestionsForLang().slice(0, 8).map(function (s) {
      return '<button type="button" class="kmHbChip" data-km-hb-q="' + esc(s.q) + '">' + esc(s.label) + '</button>';
    }).join('');
  }

  /**
   * Smart assistant path: knowledge.db hits as RAG, then Ollama/LLM.
   * Never treat domain-overview / FTS LIMIT 1 as the final answer while LLM is up.
   */
  async function tryAssistantLlmReply(q, lang, extras) {
    extras = extras || {};
    var api = llmApi();
    var hits = Array.isArray(extras.knowledgeHits) ? extras.knowledgeHits.slice() : null;
    if (!hits) {
      hits = [];
      try {
        if (!extras.skipKnowledge && !shouldSkipSearchForLauncher(q) &&
            window.kmNative && window.kmNative.botKnowledge) {
          var bkFn = window.kmNative.botKnowledge.searchSimple || window.kmNative.botKnowledge.search;
          if (typeof bkFn === 'function') {
            var bkPack = await withTimeout(
              bkFn.call(window.kmNative.botKnowledge, { query: q, limit: 8 }),
              8000,
              { ok: true, hits: [] }
            );
            hits = pickCleanKbHits((bkPack && bkPack.hits) || []);
          }
        }
      } catch (eBk) {}
    }
    if (!api || typeof api.completeChat !== 'function') {
      return { llm: null, hits: hits, ollamaDown: false };
    }
    try {
      var cfg = await api.loadConfig(false);
      if (!api.canUseLlm(cfg)) return { llm: null, hits: hits, ollamaDown: false };
      var ollamaDown = false;
      if (api.isLocalProvider && api.isLocalProvider(cfg)) {
        var probe = await api.probeLocalServer(false);
        if (!probe || !probe.ok) {
          return { llm: null, hits: hits, ollamaDown: true };
        }
      }
      var teach = extras.teachGeneral === true ||
        isDefinitionalQuestion(q) || looksLikeScienceTopic(q) || looksLikeGeneralKnowledge(q);
      var llmRes = await withTimeout(api.completeChat({
        lang: lang,
        sentiment: extras.sentiment || 'neutral',
        ragText: extras.ragText || '',
        history: extras.history || HISTORY.filter(function (m) { return !m.typing; }).slice(0, -1),
        query: q,
        sessionCtx: extras.sessionCtx || SESSION_CTX,
        knowledgeHits: hits,
        skipOfflineSearch: true,
        chatOnly: !!extras.chatOnly && !teach,
        teachGeneral: teach
      }), 85000, null);
      if (llmRes && llmRes.ok && String(llmRes.text || '').trim()) {
        return { llm: llmRes, hits: hits, ollamaDown: ollamaDown };
      }
      return { llm: null, hits: hits, ollamaDown: ollamaDown };
    } catch (eAssist) {
      return { llm: null, hits: hits, ollamaDown: false };
    }
  }

  async function answerQuery(q) {
    q = String(q || '').trim();
    if (!q) return;
    var shield = window.KMHelpBotShield;
    var gate = shield && shield.checkMessageAllowed
      ? shield.checkMessageAllowed(q)
      : { ok: true, clean: q };
    if (!gate.ok) {
      var lang0 = getLang();
      var blocked =
        lang0 === 'ru' ? (gate.messageRu || 'Запрос отклонён.')
          : (lang0 === 'en' ? (gate.messageEn || 'Request blocked.')
            : (gate.messageHy || 'Հարցը մերժվեց։'));
      pushMsg('user', gate.clean || q.slice(0, 80), false);
      pushMsg('bot', blocked, false);
      return;
    }
    q = gate.clean || q;
    var langPre = getLang();
    var apiPre = llmApi();
    if (apiPre && apiPre.checkTurnAllowed) {
      try {
        var turnGate = await apiPre.checkTurnAllowed();
        if (!turnGate.ok) {
          pushMsg('user', q, false);
          pushMsg('bot', turnLimitReply(langPre, turnGate), false);
          return;
        }
      } catch (eTurn) {}
    }
    var myGen = ++ANSWER_GEN;
    ANSWERING = true;
    try { await syncKnowledgeEpoch(); } catch (eEp) {}
    q = resolveFollowUpQuery(q);
    LAST_USER_Q = q;
    pushMsg('user', q, false);
    var lang = getLang();
    var api = llmApi();
    var sentiment = api && api.detectSentiment ? api.detectSentiment(q) : 'neutral';
    var needHuman = api && api.wantsHuman ? api.wantsHuman(q) : false;

    /* Attestation-style mood / formality tracking for companion tone */
    if (api && api.analyzeMood) {
      SESSION_CTX.mood = api.analyzeMood(q, SESSION_CTX.mood || 'neutral');
    } else if (sentiment === 'distress') {
      SESSION_CTX.mood = 'distress';
    } else if (sentiment === 'negative') {
      SESSION_CTX.mood = 'angry';
    } else if (sentiment === 'positive') {
      SESSION_CTX.mood = 'happy';
    }
    if (api && api.analyzeFormality) {
      SESSION_CTX.formality = api.analyzeFormality(q, SESSION_CTX.formality || 'du');
    }
    SESSION_CTX.ongoing = HISTORY.filter(function (m) { return !m.typing; }).length > 1;
    if (LAST_TEACH && LAST_TEACH.topic) SESSION_CTX.lastTeachTopic = LAST_TEACH.topic;

    var sessionAck = applySessionHints(q, lang);

    showTyping();
    function stillMine() { return myGen === ANSWER_GEN; }

    try {
      await sleep(280 + Math.floor(Math.random() * 220));
      if (!stillMine()) return;

      var intent = classifyUserIntent(q);

      /* Emotional / mental distress — absolute priority; no search, cards, or menu chips */
      if (intent.kind === 'empathy') {
        hideTyping();
        if (!stillMine()) return;
        var empText = empathyReply(q, lang);
        if (api && api.canUseLlm) {
          try {
            var cfgEmp = await api.loadConfig(false);
            if (!stillMine()) return;
            if (api.canUseLlm(cfgEmp)) {
              var llmEmp = await api.completeChat({
                lang: lang,
                sentiment: 'distress',
                ragText: '',
                history: HISTORY.filter(function (m) { return !m.typing; }).slice(0, -1),
                query: q,
                sessionCtx: SESSION_CTX,
                skipOfflineSearch: true,
                chatOnly: true,
                empathyOnly: true
              });
              if (!stillMine()) return;
              if (llmEmp && llmEmp.ok && llmEmp.text && !llmEmp.offlineHit) {
                empText = llmEmp.text;
              }
            }
          } catch (eEmp) {}
        }
        await pushBotReply(empText, '', { source: 'empathy', q: q, intent: intent.kind });
        return;
      }

      /*
       * Launcher / navigate — BEFORE FTS, RAG, local KB, or LLM offline search.
       * Queries with «գնա», «բացիր», navigate, open + section name never hit BotKnowledge.
       */
      if (shouldSkipSearchForLauncher(q)) {
        var launchPriority = await handleLauncherIntent(q, lang);
        if (!stillMine()) return;
        if (launchPriority) {
          hideTyping();
          CLARIFY_STREAK = 0;
          await renderAnswerHit(launchPriority, needHuman || sentiment === 'negative', 'launcher');
          if (launchPriority.autoRun && launchPriority.topic && launchPriority.topic.actions &&
              launchPriority.topic.actions[0]) {
            setTimeout(function () { runAction(launchPriority.topic.actions[0]); }, 400);
          }
          return;
        }
        var navFallback = matchNavIntent(norm(q));
        if (navFallback && navFallback.page && hasLauncherVerb(q)) {
          hideTyping();
          CLARIFY_STREAK = 0;
          var plNav = pageLabel(navFallback.page, lang);
          var navAct = {
            action: 'navigate',
            label: (lang === 'ru' ? 'Открыть «' : (lang === 'en' ? 'Open «' : 'Բացել «')) + plNav + '»',
            page: navFallback.page,
            route: navFallback.page
          };
          await renderAnswerHit({
            kind: 'topic',
            topic: {
              id: 'launcher_navigate',
              title: lang === 'ru' ? 'Навигация' : (lang === 'en' ? 'Navigation' : 'Գործողություն'),
              answer: [wrapFriendlyReply(
                lang === 'ru' ? 'перехожу в «' + plNav + '».' :
                  (lang === 'en' ? 'opening «' + plNav + '».' : '«' + plNav + '» բաժինը բացելու համար պատրաստ եմ։'),
                lang
              )],
              actions: [navAct]
            },
            score: 96,
            autoOpen: navFallback.page,
            autoRun: !!navFallback.autoOpen,
            intent: 'launcher'
          }, needHuman || sentiment === 'negative', 'launcher');
          if (navFallback.autoOpen) {
            setTimeout(function () { runAction(navAct); }, 400);
          }
          return;
        }
      }

      if (isHowAreYouAsk(q) || isBareWhatsUpAsk(q) ||
          (isFuzzyGreeting(q) && String(q).trim().length <= 48 &&
            !isDefinitionalQuestion(q) && !looksLikeScienceTopic(q) && !looksLikeGeneralKnowledge(q))) {
        hideTyping();
        if (!stillMine()) return;
        await pushBotReply(smallTalkReply(q, lang), '', { source: 'smalltalk', q: q, intent: 'chat' });
        return;
      }

      var calcAns = localCalculatorReply(q, lang);
      if (calcAns) {
        hideTyping();
        if (!stillMine()) return;
        await pushBotReply(calcAns, '', { source: 'calculator', q: q, intent: 'calc' });
        return;
      }

      if (isWhoAmIAsk(q) || isIdentityAsk(q)) {
        hideTyping();
        if (!stillMine()) return;
        await pushBotReply(isWhoAmIAsk(q) ? whoAmIReply(lang) : (
          lang === 'ru' ? 'Я помощник KM Desktop.' :
            (lang === 'en' ? 'I am the KM Desktop assistant.' :
              'Ես KM Desktop-ի օգնական բոտն եմ։')
        ), '', { source: 'identity', q: q, intent: 'chat' });
        return;
      }

      if (isAppCatalogAsk(q)) {
        hideTyping();
        if (!stillMine()) return;
        var catHit = buildAppCatalogHit(q, lang);
        CLARIFY_STREAK = 0;
        await renderAnswerHit(catHit, needHuman || sentiment === 'negative', 'catalog');
        return;
      }

      if (isProgramAuthorAsk(q)) {
        hideTyping();
        if (!stillMine()) return;
        await pushBotReply(programAuthorReply(lang), '', { source: 'author', q: q, intent: 'author' });
        return;
      }

      /*
       * Person name / «բացիր քարտը» — local roster only. Never FTS / Library scan.
       */
      if (looksLikePersonNameQuery(q) || isOpenCardIntent(q)) {
        hideTyping();
        if (!stillMine()) return;
        var pHit = null;
        try {
          pHit = await withTimeout(buildPersonDataHit(q, lang), 2200, null);
        } catch (eP) {
          pHit = null;
        }
        if (!stillMine()) return;
        if (pHit && pHit.topic) {
          CLARIFY_STREAK = 0;
          await renderAnswerHit(pHit, needHuman || sentiment === 'negative', 'person_lookup');
          if (isOpenCardIntent(q) && pHit.topic.actions && pHit.topic.actions[0]) {
            setTimeout(function () {
              try { runAction(pHit.topic.actions[0]); } catch (eRun) {}
            }, 400);
          }
          return;
        }
        if (isOpenCardIntent(q)) {
          var miss = lang === 'ru'
            ? 'В личном составе запись с этим именем не найдена. Могу открыть раздел кнопкой ниже.'
            : (lang === 'en'
              ? 'No personnel record with that name was found. I can open the section with the button below.'
              : 'Անձնակազմում այդ անունով գրառում չգտնվեց։ Կարող եմ բացել բաժինը ներքևի կոճակով։');
          await pushBotReply(miss, '', {
            source: 'person_miss',
            q: q,
            intent: 'person_lookup',
            actions: [{
              action: 'navigate',
              page: 'people',
              label: lang === 'ru' ? 'Открыть раздел' : (lang === 'en' ? 'Open section' : 'Բացել բաժինը')
            }]
          });
          return;
        }
        /* Not a confirmed roster hit — continue to knowledge / chat */
      }

      /*
       * Free-form AI path — knowledge.db RAG + Ollama first.
       * Domain-overview / FTS LIMIT 1 must not short-circuit the assistant.
       */
      if (!isKmSystemIntent(q)) {
        if (!stillMine()) return;

        if (sessionAck && isPureStylePreference(q) &&
            !(isDetailElaborationAsk(q) && (LAST_TEACH.query || LAST_TEACH.topic))) {
          hideTyping();
          await pushBotReply(sessionAck, '', { source: 'session', q: q });
          return;
        }

        var trueChat = isTrueSmallTalk(q);
        var teachFree = !trueChat && (intent.kind === 'teach' ||
          isDefinitionalQuestion(q) || looksLikeScienceTopic(q) || looksLikeGeneralKnowledge(q) ||
          intent.kind !== 'chat');
        var assist = await tryAssistantLlmReply(q, lang, {
          sentiment: sentiment,
          teachGeneral: teachFree,
          chatOnly: trueChat,
          skipKnowledge: trueChat
        });
        if (!stillMine()) return;

        if (assist && assist.llm && assist.llm.text && !assist.llm.offlineHit) {
          hideTyping();
          rememberTeachTopic(q);
          CLARIFY_STREAK = 0;
          await pushBotReply(String(assist.llm.text).trim(), '', {
            source: 'llm',
            q: q,
            intent: teachFree ? 'teach' : 'chat',
            provider: assist.llm.provider || '',
            model: assist.llm.model || '',
            friendly: false
          });
          return;
        }

        var kb0 = assist && assist.hits && assist.hits[0];
        if (isBkHitStrong(kb0) && String(kb0.a || '').trim()) {
          hideTyping();
          rememberTeachTopic(q);
          CLARIFY_STREAK = 0;
          await pushBotReply(String(kb0.a).trim(), '', {
            source: 'offline_vector',
            q: q,
            intent: 'teach',
            score: kb0.score,
            friendly: false
          });
          return;
        }

        var corePack = null;
        try {
          var alreadySearched = assist && Array.isArray(assist.hits);
          if (!alreadySearched && window.kmNative && window.kmNative.helpBot &&
              typeof window.kmNative.helpBot.ask === 'function') {
            corePack = await withTimeout(window.kmNative.helpBot.ask(q), 5500, null);
          }
        } catch (eCore) {
          corePack = null;
        }
        if (!stillMine()) return;
        var coreSrc = corePack ? String(corePack.source || '') : '';
        var skipCore = !corePack || !corePack.text ||
          coreSrc === 'bk_no_match' || coreSrc === 'domain-overview' ||
          coreSrc === 'timeout' || coreSrc === 'error';
        if (!skipCore) {
          hideTyping();
          if (coreSrc !== 'smalltalk') rememberTeachTopic(q);
          await pushBotReply(String(corePack.text).trim(), '', {
            source: coreSrc || 'helpbot_core',
            q: q,
            intent: coreSrc === 'smalltalk' ? 'chat' : 'teach',
            actions: Array.isArray(corePack.actions) ? corePack.actions : [],
            friendly: false
          });
          return;
        }

        var localPack = null;
        try { localPack = await tryLocalKnowledgeReply(q, lang); } catch (eLoc) {}
        if (!stillMine()) return;
        if (localPack && localPack.text && localPack.source !== 'bk_no_match' &&
            localPack.source !== 'smalltalk') {
          hideTyping();
          rememberTeachTopic(q);
          await pushBotReply(String(localPack.text).trim(), '', {
            source: localPack.source || 'local',
            q: q,
            intent: 'teach',
            friendly: false
          });
          return;
        }

        hideTyping();
        if (trueChat || isBareWhatsUpAsk(q) || isHowAreYouAsk(q) || isFuzzyGreeting(q)) {
          await pushBotReply(smallTalkReply(q, lang), '', { source: 'smalltalk', q: q, intent: 'chat' });
          return;
        }
        var weakKb = assist && assist.hits && assist.hits[0] && String(assist.hits[0].a || '').trim();
        if (weakKb) {
          await pushBotReply(weakKb, '', {
            source: 'offline_vector',
            q: q,
            intent: 'teach',
            score: assist.hits[0].score,
            friendly: false
          });
          return;
        }
        var miss = assist && assist.ollamaDown
          ? (lang === 'ru'
            ? 'Ollama не запущена, и в базе нет точного ответа. Запустите Ollama (ollama run llama3 / gemma2 / aya-expanse) и спросите снова.'
            : (lang === 'en'
              ? 'Ollama is not running, and the knowledge base has no exact match. Start Ollama (ollama run llama3 / gemma2 / aya-expanse) and ask again.'
              : 'Ollama-ն չի աշխատում, և գիտելիքների բազայում ճշգրիտ պատասխան չգտնվեց։ Գործարկեք Ollama-ն (`ollama run llama3` / `gemma2` / `aya-expanse`) և նորից հարցրեք։'))
          : (lang === 'ru'
            ? 'Точного ответа в базе не нашлось. Сформулируйте вопрос конкретнее.'
            : (lang === 'en'
              ? 'No exact answer in the knowledge base. Please ask more specifically.'
              : 'Գիտելիքների բազայում ճշգրիտ պատասխան չգտնվեց։ Փորձեք ավելի կոնկրետ հարց։'));
        await pushBotReply(miss, '', { source: 'bk_no_match', q: q, intent: 'teach', friendly: false });
        return;
      }

      /* Pure style prefs on KM path */
      if (sessionAck && isPureStylePreference(q) &&
          !(isDetailElaborationAsk(q) && (LAST_TEACH.query || LAST_TEACH.topic))) {
        hideTyping();
        if (!stillMine()) return;
        await pushBotReply(sessionAck, '', { source: 'session', q: q });
        return;
      }

      var qNorm = norm(q);
      var allowDocSearch = intent.kind === 'search' || wantsDocumentSearch(q);

      /* 0) Հրամանի/որոշման համար → ֆայլ */
      if (intent.kind === 'launcher') {
        var launchHit = await handleLauncherIntent(q, lang);
        if (!stillMine()) return;
        if (launchHit) {
          hideTyping();
          CLARIFY_STREAK = 0;
          await renderAnswerHit(launchHit, needHuman || sentiment === 'negative', 'launcher');
          if (launchHit.autoRun && launchHit.topic && launchHit.topic.actions && launchHit.topic.actions[0]) {
            setTimeout(function () { runAction(launchHit.topic.actions[0]); }, 400);
          }
          return;
        }
      }

      if (allowDocSearch) {
        var lawHit = await findLawDocHit(q, lang);
        if (!stillMine()) return;
        if (lawHit && lawHit.score && lawHit.score >= 60) {
          hideTyping();
          CLARIFY_STREAK = 0;
          rememberDialogFocus(q, lawHit);
          await renderAnswerHit(lawHit, needHuman || sentiment === 'negative', 'law_number');
          return;
        }

        /* 0+) Hybrid RAG — միայն հստակ փաստաթղթային մտադրությամբ */
        var ragPack = await searchBotRagHybrid(q, lang);
        if (!stillMine()) return;
        var ragHit = buildRagDocumentHit(ragPack, lang);
        if (ragHit && ragPack && ((ragPack.answers && ragPack.answers.length) || (ragPack.hits && ragPack.hits.length))) {
          hideTyping();
          CLARIFY_STREAK = 0;
          rememberDialogFocus(q, ragHit);
          try { absorbLearningFromHits(ragPack.hits || []); } catch (eAbs2) {}
          await renderAnswerHit(ragHit, needHuman || sentiment === 'negative', 'doc_rag');
          return;
        }

        /* 0a) Շաբաթվա օր → գրաֆիկի անձնակազմ */
        var wd = detectWeekday(q);
        if (wd != null && !isHelpAsk(qNorm) && !isCapabilityAsk(qNorm) &&
            /(ո[վ՞]|անձ|ցանկ|գրաֆիկ|дежур|who|on duty|roster)/i.test(qNorm)) {
          hideTyping();
          CLARIFY_STREAK = 0;
          await renderAnswerHit(buildWeekdayHit(wd, lang), needHuman || sentiment === 'negative', 'weekday_roster');
          return;
        }

        /* 0b) Անուն → գրաֆիկներ + անձ/պաշտոն քարտեր + ֆայլեր */
        var personHit = null;
        if (!isHelpAsk(qNorm) && !isCapabilityAsk(qNorm) && !matchNavIntent(qNorm)) {
          personHit = await withTimeout(buildPersonDataHit(q, lang), 2200, null);
          if (!stillMine()) return;
          if (personHit && personHit.score >= 40) {
            hideTyping();
            CLARIFY_STREAK = 0;
            rememberDialogFocus(q, personHit);
            await renderAnswerHit(personHit, needHuman || sentiment === 'negative', 'person_lookup');
            return;
          }
        }

        /* 0c) Բառով որոնում */
        var contentHit = await findContentSearchHit(q, lang);
        if (!stillMine()) return;
        if (contentHit && contentHit.intent === 'content_search' &&
            (contentHit.kind === 'chat' || (contentHit.kind === 'topic' && contentHit.score >= SEARCH_MIN_SCORE))) {
          hideTyping();
          CLARIFY_STREAK = 0;
          rememberDialogFocus(q, contentHit);
          await renderAnswerHit(contentHit, needHuman || sentiment === 'negative', 'content_search');
          return;
        }
      }

      var personHit = null;
      var contentHit = null;

      /* Section about («ինչ կա իրավաբանական բաժնում») — before offline QA / live stats */
      if (intent.kind === 'nav' || isSectionAboutQuery(q) || isExplicitBotHelpAsk(q)) {
        var secAbout = buildSectionAboutHit(qNorm, lang);
        if (secAbout) {
          hideTyping();
          CLARIFY_STREAK = 0;
          await renderAnswerHit(secAbout, needHuman || sentiment === 'negative', 'section_about');
          return;
        }
        var navEarly = matchNavIntent(qNorm);
        if (navEarly && navEarly.page) {
          hideTyping();
          CLARIFY_STREAK = 0;
          await renderAnswerHit(findBest(q), needHuman || sentiment === 'negative', 'nav');
          return;
        }
      }

      /* 0d) Offline BotKnowledge (knowledge.db / FTS) — collect RAG hits; Ollama answers when up */
      var pendingBkHits = [];
      var pendingBkHit = null;
      try {
        if (!shouldSkipSearchForLauncher(q) &&
            !looksLikePersonNameQuery(q) && !isOpenCardIntent(q) && !isBareSectionNoun(q) &&
            window.kmNative && window.kmNative.botKnowledge) {
          var bkFnKm = window.kmNative.botKnowledge.searchSimple || window.kmNative.botKnowledge.search;
          var bkPack = typeof bkFnKm === 'function'
            ? await withTimeout(
              bkFnKm.call(window.kmNative.botKnowledge, { query: q, limit: 5 }),
              5000,
              { ok: true, hits: [], source: 'timeout' }
            )
            : { ok: true, hits: [] };
          if (!stillMine()) return;
          pendingBkHits = pickCleanKbHits((bkPack && bkPack.hits) || []);
          pendingBkHit = pendingBkHits[0] || null;
        }
      } catch (eBk) {}

      /* KM path — try Gemini with light RAG, then Smart Engine (no soft catch-all menus) */
      var hit = findBest(q);
      var strongSmart = isSmartEngineStrongHit(hit);

      var usedLlm = false;
      if (api && !strongSmart) {
        var cfg = await api.loadConfig(false);
        if (!stillMine()) return;
        var allowLlm = api.canUseLlm(cfg);
        if (allowLlm && api.isLocalProvider && api.isLocalProvider(cfg)) {
          var probe = await api.probeLocalServer(false);
          if (!stillMine()) return;
          if (!probe || !probe.ok) allowLlm = false;
        }
        if (allowLlm) {
          var rag = allowDocSearch
            ? await enrichRagWithFiles(buildRagPack(q, lang), q)
            : buildRagPack(q, lang);
          var shareStats = cfg.shareStats !== false;
          var ragText = shareStats ? rag.ragText : rag.ragText.replace(/\nLive stats:[\s\S]*$/, '');
          if (!allowDocSearch) {
            ragText = String(ragText || '').split('\n').filter(function (ln) {
              return !/Loaded file content hits|Hybrid offline RAG|file\//i.test(ln);
            }).join('\n');
          }
          if (sessionAck) ragText = 'Session note: ' + sessionAck + '\n' + ragText;
          try {
            var llmRes = await api.completeChat({
              lang: lang,
              sentiment: sentiment,
              ragText: ragText,
              history: HISTORY.filter(function (m) { return !m.typing; }).slice(0, -1),
              query: q,
              sessionCtx: SESSION_CTX,
              knowledgeHits: pendingBkHits,
              skipOfflineSearch: true,
              chatOnly: !allowDocSearch,
              teachGeneral: false
            });
            if (!stillMine()) return;
            if (llmRes && llmRes.ok && llmRes.text) {
              usedLlm = true;
              hideTyping();
              CLARIFY_STREAK = 0;
              var chips = allowDocSearch ? suggestionChipsHtml() : '';
              var escBtn = (needHuman || sentiment === 'negative') ? escalateHtml() : '';
              var extra = (chips ? ('<div class="kmHbActs" style="margin-top:10px">' + chips + '</div>') : '') + escBtn;
              await pushBotReply(llmRes.text, extra, {
                source: llmRes.offlineHit ? 'offline_vector' : 'llm',
                q: q,
                provider: llmRes.provider || '',
                model: llmRes.model || ''
              });
              return;
            }
          } catch (eLlm) {}
        }
      }

      if (isBkHitStrong(pendingBkHit) && String(pendingBkHit.a || '').trim() && !isCannedDomainOverview(pendingBkHit)) {
        hideTyping();
        CLARIFY_STREAK = 0;
        var bkText = wrapFriendlyReply(String(pendingBkHit.a).trim(), lang);
        await pushBotReply(bkText, '', { source: 'offline_vector', q: q, score: pendingBkHit.score, friendly: false });
        return;
      }
      var encLast = localEncyclopediaReply(q, lang);
      if (encLast) {
        hideTyping();
        if (!stillMine()) return;
        await pushBotReply(encLast, '', { source: 'local_encyclopedia', q: q });
        return;
      }
      if (isTechnicalKnowledgeAsk(q) || (isDefinitionalQuestion(q) && !isKmSystemIntent(q))) {
        hideTyping();
        CLARIFY_STREAK = 0;
        await pushBotReply(bkNoMatchReply(q, lang), '', { source: 'bk_no_match', q: q, score: pendingBkHit && pendingBkHit.score });
        return;
      }
      if (pendingBkHit && Number(pendingBkHit.score || 0) < BK_MIN_SCORE_STRONG &&
          (isDefinitionalQuestion(q) || looksLikeGeneralKnowledge(q))) {
        hideTyping();
        CLARIFY_STREAK = 0;
        await pushBotReply(bkLowScoreReply(q, lang), '', { source: 'bk_no_match', q: q, score: pendingBkHit.score });
        return;
      }

      if (!stillMine()) return;
      hideTyping();
      if (!hit) {
        CLARIFY_STREAK += 1;
        hit = { kind: 'chat', text: openFriendlyReply(lang), intent: 'open', suggest: false };
      } else if (hit.deferLlm || (hit.kind === 'chat' && !String(hit.text || '').trim())) {
        hit = { kind: 'chat', text: llmUnavailableReply(lang), intent: 'teach', suggest: false };
        CLARIFY_STREAK = 0;
      } else if (hit.intent === 'clarify' || (hit.kind === 'chat' && hit.intent === 'clarify')) {
        hit = { kind: 'chat', text: openFriendlyReply(lang), intent: 'open', suggest: false };
        CLARIFY_STREAK += 1;
      } else if (hit.kind === 'topic' && hit.topic && hit.topic.id === 'bot' && !isExplicitBotHelpAsk(q)) {
        hit = { kind: 'chat', text: openFriendlyReply(lang), intent: 'open', suggest: false };
        CLARIFY_STREAK += 1;
      } else if (hit.intent === 'help' && hit.kind === 'chat') {
        hit.suggest = false;
        CLARIFY_STREAK = 0;
      } else {
        CLARIFY_STREAK = 0;
      }
      var showEsc = needHuman || sentiment === 'negative' || CLARIFY_STREAK >= 2;
      await renderAnswerHit(hit, showEsc, usedLlm ? 'smart_after_llm' : 'smart');
      if (!stillMine()) return;
      if (hit.kind === 'topic' && hit.topic && hit.topic.id && api && api.touchUserMemory) {
        api.touchUserMemory({
          lastTopic: hit.topic.id,
          lastQuery: q,
          continueHint: textify(hit.topic.title) || String(hit.topic.id)
        }).catch(function () {});
      }
      refreshLlmBadge().catch(function () {});
    } catch (eAns) {
      if (!stillMine()) return;
      hideTyping();
      var soft = openFriendlyReply(lang);
      await pushBotReply(soft, escalateHtml(), { source: 'error', q: q });
      CLARIFY_STREAK += 1;
    } finally {
      if (myGen === ANSWER_GEN) {
        ANSWERING = false;
        hideTyping();
        /* paintLog can wipe onclick — rebind 👍👎 / chips / actions */
        try { bindLogClicks(null); } catch (eBind) {}
      }
    }
  }

  async function renderAnswerHit(hit, withEscalate, source) {
    if (!hit) return;
    if (hit.kind === 'chat') {
      /* Section quick-replies only for explicit nav/help-with-chips — not general chat */
      var wantChips = !!(hit.suggest && (hit.intent === 'nav' || hit.intent === 'help_ai' || hit.forceChips));
      var chips = wantChips ? suggestionChipsHtml() : '';
      var extra = (chips ? ('<div class="kmHbActs" style="margin-top:10px">' + chips + '</div>') : '') +
        (withEscalate ? escalateHtml() : '');
      await pushBotReply(hit.text, extra, { source: source || 'smart', q: LAST_USER_Q });
      return;
    }
    var fid = 'fb_' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
    var msgId = 'm' + Date.now().toString(36) + Math.floor(Math.random() * 1e5).toString(36);
    var html = renderBotHtml(hit.topic, hit.alts, msgId);
    if (withEscalate) html += escalateHtml();
    var plainTitle = textify(hit.topic && hit.topic.title);
    var plainAns = ((hit.topic && hit.topic.answer) || []).map(function (x) { return textify(x); }).filter(Boolean).join(' ');
    var plainGroups = '';
    if (hit.topic && hit.topic.groups && hit.topic.groups.length) {
      plainGroups = hit.topic.groups.map(function (g) {
        return textify(g.title) + ' ' + ((g.lines || []).map(function (x) { return textify(x); }).join(' '));
      }).join(' ');
    }
    var plain = (plainTitle + ' ' + plainAns + ' ' + plainGroups).replace(/\s+/g, ' ').trim();
    if (plain.indexOf('[object Object]') >= 0) plain = plain.replace(/\[object Object\]/g, '').replace(/\s+/g, ' ').trim();
    html += '<div style="margin-top:8px">' + feedbackHtml(fid) + '</div>';
    HISTORY.push({
      id: msgId,
      role: 'bot',
      html: html,
      topic: hit.topic,
      actions: (hit.topic && hit.topic.actions) ? hit.topic.actions.slice() : [],
      text: plain
    });
    if (HISTORY.length > MAX_HIST) HISTORY = HISTORY.slice(-MAX_HIST);
    paintLog();
    scheduleSaveChatMemory();
    bindLogClicks(hit.topic);
    var apiR = llmApi();
    if (apiR && apiR.logInteraction) {
      apiR.logInteraction({
        id: fid,
        q: LAST_USER_Q,
        a: plain,
        source: source || 'smart',
        topicId: (hit.topic && hit.topic.id) || ''
      }).catch(function () {});
    }
    archiveConversation(LAST_USER_Q, plain, source || 'smart', {
      intent: hit.intent || source || '',
      topicId: (hit.topic && hit.topic.id) || ''
    });
    /* Բաժին՝ միայն եթե օգտատերը հստակ ասել է «բացիր …»։ Որոնման ֆայլեր՝ երբեք ավտոմատ չեն բացվում։ */
    if (hit.autoOpen && typeof window.kmOpenPage === 'function') {
      setTimeout(function () {
        try { window.kmOpenPage(hit.autoOpen); } catch (e0) {}
      }, 350);
    }
  }

  function bindLogClicks(topic) {
    var log = document.getElementById('kmHbLog');
    if (!log) return;
    log.querySelectorAll('[data-km-hb-q]').forEach(function (btn) {
      btn.onclick = function () {
        var qq = btn.getAttribute('data-km-hb-q') || '';
        var inp = document.getElementById('kmHbInput');
        if (inp) inp.value = qq;
        answerQuery(qq);
      };
    });
    log.querySelectorAll('[data-km-hb-escalate]').forEach(function (btn) {
      btn.onclick = function () {
        doEscalate('manual_escalate', 'negative');
      };
    });
    log.querySelectorAll('[data-km-hb-fb]').forEach(function (btn) {
      btn.onclick = function (ev) {
        if (ev) { ev.preventDefault(); ev.stopPropagation(); }
        var wrap = btn.closest('[data-km-hb-fid]');
        var fid = wrap ? wrap.getAttribute('data-km-hb-fid') : '';
        var vote = btn.getAttribute('data-km-hb-fb');
        var apiF = llmApi();
        if (!fid || !apiF || !apiF.setFeedbackVote) {
          hbToast(getLang() === 'en' ? 'Feedback unavailable' : 'Գնահատումն անհասանելի է', 'warn');
          return;
        }
        wrap.querySelectorAll('button').forEach(function (b) {
          b.classList.remove('is-on', 'is-down');
        });
        btn.classList.add(vote === 'down' ? 'is-down' : 'is-on');
        hbToast(vote === 'down'
          ? (getLang() === 'en' ? 'Marked for review' : (getLang() === 'ru' ? 'Отмечено для правки' : 'Նշվեց ուղղման համար'))
          : (getLang() === 'en' ? 'Thanks for feedback' : (getLang() === 'ru' ? 'Спасибо за оценку' : 'Շնորհակալություն գնահատման համար')));
        Promise.resolve(apiF.setFeedbackVote(fid, vote)).catch(function () {
          hbToast(getLang() === 'en' ? 'Could not save feedback' : 'Չհաջողվեց պահել գնահատումը', 'warn');
        });
      };
    });
    var useTopic = topic;
    if (!useTopic) {
      for (var i = HISTORY.length - 1; i >= 0; i--) {
        if (HISTORY[i].topic) { useTopic = HISTORY[i].topic; break; }
      }
    }
    if (useTopic) {
      /* Action buttons handled by ensureActClickDelegation() via data-km-hb-mid + msg.actions */
    }
    syncTtsButtons();
  }

  function suggestionsForLang() {
    var lang = getLang();
    var sug = DATA && DATA.suggestions;
    if (!sug) return [];
    if (Array.isArray(sug)) return sug;
    return Array.isArray(sug[lang]) ? sug[lang] : (sug.hy || []);
  }

  function isPanelOpen() {
    var ov = document.getElementById('kmHelpBotOverlay');
    return !!(ov && !ov.hasAttribute('hidden'));
  }

  function panelHost() {
    return document.getElementById('kmHelpBotPanel');
  }

  function closePanel() {
    ANSWER_GEN += 1;
    ANSWERING = false;
    hideTyping();
    var ov = document.getElementById('kmHelpBotOverlay');
    if (ov) ov.setAttribute('hidden', 'hidden');
    syncFabState(false);
    /* Short-term in-context memory ends with chat close */
    resetSessionCtx();
  }

  function openPanel() {
    injectCss();
    ensureFab();
    var ov = document.getElementById('kmHelpBotOverlay');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'kmHelpBotOverlay';
      ov.className = 'kmHbOverlay';
      ov.setAttribute('hidden', 'hidden');
      ov.innerHTML = '<div class="kmHbPanel" id="kmHelpBotPanel" role="dialog" aria-label="Help bot"></div>';
      ov.addEventListener('click', function (e) {
        if (e.target === ov) closePanel();
      });
      document.body.appendChild(ov);
    }
    ov.removeAttribute('hidden');
    syncFabState(true);
    if (!window.__kmHbEscBound) {
      window.__kmHbEscBound = true;
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && isPanelOpen()) {
          e.preventDefault();
          closePanel();
        }
      });
    }
    var panel = document.getElementById('kmHelpBotPanel');
    if (!panel) return;
    panel.innerHTML = '<div class="kmHbShell"><p class="muted">' + esc(ui('loading') || '…') + '</p></div>';
    loadData().then(function (data) {
      renderPanel(data);
      try {
        var rag = window.kmNative && window.kmNative.botRag;
        if (rag && typeof rag.sync === 'function') {
          rag.sync({ timeBudgetMs: 35000 }).catch(function () {});
        }
      } catch (eSync) {}
    }).catch(function () {
      panel.innerHTML = '<div class="kmHbShell"><b>' + esc(ui('loadFail') || 'Error') + '</b></div>';
    });
  }

  function renderPanel(data) {
    var h = panelHost();
    if (!h) return;
    var lang = getLang();
    var chips = suggestionsForLang().map(function (s) {
      return '<button type="button" class="kmHbChip" data-km-hb-q="' + esc(s.q) + '">' + esc(s.label) + '</button>';
    }).join('');
    var online = isOnline();
    var title = ui('title') || pick(data.title, lang) || 'KM';
    var lead = ui('lead') || '';
    h.innerHTML =
      '<div class="kmHbShell">' +
        '<div class="kmHbHead">' +
          '<div class="toolbar" style="margin-bottom:8px">' +
            '<button type="button" onclick="kmHelpBotClose()">✕ ' + esc(ui('close') || 'Close') + '</button>' +
            '<button type="button" onclick="kmHelpBotClear()" title="' + esc(ui('clearHistory') || ui('clear') || 'Clear') + '">' + esc(ui('clearHistory') || ui('clear') || 'Clear') + '</button></div>' +
          '<h3 class="kmLawsHubTitle" style="margin:0 0 4px">' + esc(title) + '</h3>' +
          '<div class="kmHbMeta">' +
            '<span class="kmHbBadge">' + esc(lang.toUpperCase()) + '</span>' +
            '<span class="kmHbBadge on" id="kmHbEngineBadge">' + esc(ui('smart') || 'Smart Engine') + '</span>' +
            '<span class="kmHbBadge on" title="Shield">' + esc(ui('shield') || 'Shield') + '</span>' +
            '<span class="kmHbBadge ' + (online ? 'on' : 'off') + '">' +
              esc(online ? (ui('online') || 'Online') : (ui('offline') || 'Offline')) +
            '</span></div>' +
          (lead ? ('<p class="kmHbLead">' + esc(lead) + '</p>') : '') +
          '<div class="kmHbChips">' + chips + '</div>' +
        '</div>' +
        '<div class="kmHbLog" id="kmHbLog"></div>' +
        '<div class="kmHbInputRow">' +
          '<input id="kmHbInput" type="text" placeholder="' + esc(ui('placeholder') || '') + '" autocomplete="off">' +
          '<button type="button" class="primary" id="kmHbSend">' + esc(ui('send') || 'Send') + '</button>' +
        '</div>' +
      '</div>';

    function appendMemoryTips() {
      var apiG = llmApi();
      if (apiG && apiG.getUserMemory) {
        apiG.getUserMemory().then(function (mem) {
          if (!mem) return;
          var tips = [];
          if (mem.prefs && mem.prefs.unit) {
            tips.push(
              lang === 'ru'
                ? ('Помню: вы из «' + mem.prefs.unit + '».')
                : (lang === 'en'
                  ? ('I remember you work in “' + mem.prefs.unit + '”.')
                  : ('Հիշում եմ՝ աշխատում եք «' + mem.prefs.unit + '»-ում։'))
            );
          }
          if (mem.continueHint || (mem.lastTopics && mem.lastTopics.length)) {
            var topicRaw = mem.continueHint || mem.lastTopics[0];
            var topic = textify(topicRaw);
            if (topic && topic.indexOf('[object Object]') < 0) {
              tips.push(
                lang === 'ru'
                  ? ('Хотите продолжить по теме «' + topic + '»?')
                  : (lang === 'en'
                    ? ('Want to continue with “' + topic + '”?')
                    : ('Ցանկանո՞ւմ եք շարունակել «' + topic + '» թեմայով։'))
              );
            }
          }
          tips.forEach(function (t) {
            var s = textify(t);
            if (s && s.indexOf('[object Object]') < 0) pushMsg('bot', s, false);
          });
        }).catch(function () {});
      }
    }

    function bindPanelInputs() {
      var inp = document.getElementById('kmHbInput');
      var send = document.getElementById('kmHbSend');
      function go() {
        var v = inp ? inp.value : '';
        if (inp) inp.value = '';
        answerQuery(v);
        if (inp) inp.focus();
      }
      if (send) send.onclick = go;
      if (inp) {
        inp.onkeydown = function (e) {
          if (e.key === 'Enter') { e.preventDefault(); go(); }
        };
        setTimeout(function () { try { inp.focus(); } catch (e1) {} }, 40);
      }
      h.querySelectorAll('.kmHbChips [data-km-hb-q]').forEach(function (btn) {
        btn.onclick = function () {
          answerQuery(btn.getAttribute('data-km-hb-q') || '');
        };
      });
    }

    function initChatLog() {
      /* Fresh session each open — do not reload prior conversations into the LLM/UI */
      wipeLocalChatCaches();
      CHAT_RESTORE_BLOCKED = !PERSIST_CHAT_MEMORY;
      GREETED = true;
      HISTORY = [];
      clearChatDomImmediate();
      pushMsg('bot', buildGreeting(), false);
      appendMemoryTips();
      if (!PERSIST_CHAT_MEMORY) {
        try {
          var apiClr = llmApi();
          if (apiClr && apiClr.clearChatMemory) apiClr.clearChatMemory().catch(function () {});
        } catch (eClr) {}
      }
      return Promise.resolve(false);
    }

    initChatLog().then(function () {
      refreshLlmBadge();
      bindPanelInputs();
    }).catch(function () {
      refreshLlmBadge();
      bindPanelInputs();
    });
  }

  window.kmHelpBotClear = function () {
    var confirmMsg = ui('clearHistory') || ui('clear') || 'Clear chat history?';
    if (typeof confirm === 'function' && !confirm(confirmMsg + ' — հաստատե՞լ')) return;
    ANSWER_GEN += 1;
    CHAT_CLEARED_EPOCH += 1;
    var epoch = CHAT_CLEARED_EPOCH;
    CHAT_RESTORE_BLOCKED = true;
    clearTimeout(SAVE_CHAT_TIMER);
    SAVE_CHAT_TIMER = null;
    HISTORY = [];
    GREETED = false;
    LAST_TOPIC = null;
    LAST_TEACH = { topic: '', query: '' };
    DIALOG = { mode: '', pending: '' };
    DIALOG_FOCUS = { person: '', fileName: '', lawNum: '', topicId: '', lastQuery: '' };
    CLARIFY_STREAK = 0;
    ANSWERING = false;
    LAST_USER_Q = '';
    LIVE_CORPUS_CACHE = { at: 0, rows: null, epoch: 0 };
    resetSessionCtx();
    wipeLocalChatCaches();
    clearChatDomImmediate();
    emitChatCleared();

    var finishUi = function () {
      if (epoch !== CHAT_CLEARED_EPOCH) return;
      GREETED = true;
      HISTORY = [];
      clearChatDomImmediate();
      pushMsg('bot', buildGreeting(), false);
      appendMemoryTips();
      try {
        if (window.KMHelpBotLLM && typeof window.KMHelpBotLLM.invalidateConfig === 'function') {
          window.KMHelpBotLLM.invalidateConfig();
        }
      } catch (eInv) {}
      /* Persist empty history so launch cannot restore old turns. */
      var apiSave = llmApi();
      if (apiSave && apiSave.saveChatMemory) {
        apiSave.saveChatMemory({
          history: [],
          sessionCtx: SESSION_CTX,
          lastTeach: LAST_TEACH,
          greeted: true
        }).catch(function () {});
      }
      CHAT_RESTORE_BLOCKED = false;
      if (typeof toastMsg === 'function') toastMsg(ui('clearHistory') || ui('clear') || 'Cleared');
    };

    var tasks = [];
    var ipcClr = window.kmNative && window.kmNative.helpBot && window.kmNative.helpBot.clearHistory;
    if (ipcClr) tasks.push(Promise.resolve(ipcClr({})).catch(function () { return null; }));
    var apiClr = llmApi();
    if (apiClr && apiClr.clearChatMemory) {
      tasks.push(Promise.resolve(apiClr.clearChatMemory()).catch(function () { return null; }));
    }
    Promise.all(tasks.length ? tasks : [Promise.resolve(null)]).then(finishUi).catch(finishUi);
  };

  /* Main-process broadcast after clear — keep UI in sync if clear came from elsewhere. */
  try {
    if (window.kmNative && typeof window.kmNative.onBotHistoryCleared === 'function') {
      window.kmNative.onBotHistoryCleared(function () {
        CHAT_CLEARED_EPOCH += 1;
        CHAT_RESTORE_BLOCKED = true;
        clearTimeout(SAVE_CHAT_TIMER);
        HISTORY = [];
        wipeLocalChatCaches();
        clearChatDomImmediate();
        emitChatCleared();
        GREETED = true;
        pushMsg('bot', buildGreeting(), false);
        CHAT_RESTORE_BLOCKED = false;
      });
    }
  } catch (eBindClr) {}

  window.kmHelpBotClose = closePanel;

  function syncFabState(open) {
    var fab = document.getElementById('kmHelpBotFab');
    if (!fab) return;
    fab.classList.toggle('is-open', !!open);
    fab.setAttribute('aria-pressed', open ? 'true' : 'false');
    fab.title = open ? (ui('closeBot') || 'Close') : (ui('openBot') || 'Help');
    fab.setAttribute('aria-label', fab.title);
  }

  window.kmHelpBotSyncFab = syncFabState;

  window.kmHelpBotToggle = function () {
    if (isPanelOpen()) closePanel();
    else openPanel();
  };

  window.kmHelpBotPage = function () {
    openPanel();
  };

  function ensureFab() {
    injectCss();
    var fab = document.getElementById('kmHelpBotFab');
    if (fab) {
      if (!fab.__kmHbToggleBound) {
        fab.__kmHbToggleBound = true;
        fab.onclick = function (e) {
          e.preventDefault();
          e.stopPropagation();
          window.kmHelpBotToggle();
        };
      }
      return fab;
    }
    fab = document.createElement('button');
    fab.type = 'button';
    fab.id = 'kmHelpBotFab';
    fab.className = 'kmHbFab';
    fab.title = 'Help';
    fab.setAttribute('aria-label', 'Help');
    fab.setAttribute('aria-pressed', 'false');
    fab.textContent = '?';
    fab.__kmHbToggleBound = true;
    fab.onclick = function (e) {
      e.preventDefault();
      e.stopPropagation();
      window.kmHelpBotToggle();
    };
    document.body.appendChild(fab);
    return fab;
  }

  window.kmHelpBotEnsureFab = ensureFab;
  window.shouldSkipSearchForLauncher = shouldSkipSearchForLauncher;

  /* լեզու փոխելիս՝ բաց վահանակը թարմացնել */
  try {
    var _set = window.kmSetLanguage;
    if (typeof _set === 'function' && !_set.__kmHbWrapped) {
      window.kmSetLanguage = function (lang) {
        var r = _set.apply(this, arguments);
        if (isPanelOpen()) {
          GREETED = false;
          HISTORY = [];
          loadData(true).then(function (d) { renderPanel(d); });
        }
        return r;
      };
      window.kmSetLanguage.__kmHbWrapped = true;
    }
  } catch (eWrap) {}

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(ensureFab, 400); });
  } else {
    setTimeout(ensureFab, 400);
  }
})();
