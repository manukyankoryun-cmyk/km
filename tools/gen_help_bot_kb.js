/* Generate km_help_bot.json + km_help_bot_online.json */
const fs = require('fs');
const path = require('path');
const outDir = path.join(__dirname, '..', 'app', 'data');

function T(hy, ru, en) { return { hy, ru, en }; }
function A(hy, ru, en) { return { hy, ru, en }; }
function L(hy, ru, en) { return { hy, ru, en }; }

const ui = {
  hy: {
    title: 'KM օգնական բոտ',
    lead: 'Հարցրեք հայերեն, ռուսերեն կամ անգլերեն։ Բոտը ողջունում է, պատասխանում և ուղղորդում բաժիններ։',
    placeholder: 'Գրեք հարց… օր.՝ ինչպես կառուցել գրաֆիկ',
    send: 'Ուղարկել',
    close: 'Փակել',
    clear: 'Մաքրել',
    loading: 'Բեռնվում է…',
    loadFail: 'Չհաջողվեց բեռնել գիտելիքների բազան',
    openFail: 'Չհաջողվեց բացել բաժինը',
    open: 'Բացել',
    online: 'Online',
    offline: 'Offline',
    onlineMode: 'Կապ կա՝ լրացուցիչ գիտելիքները միացված են (եթե հասանելի են)։',
    offlineMode: 'Աշխատում է offline՝ տեղական գիտելիքների բազայով։',
    welcome: 'Ես KM օգնականն եմ։ Կարող եմ բացատրել գրաֆիկը, անձնակազմը, հաշվառումը, գրադարանը, իրավաբանական անկյունը, իրավունքները, USB/ցանցը և էջերի թույլտվությունները։ Գրեք հարց կամ ընտրեք թեմա։',
    fallback: 'Ճշգրիտ թեմա չգտա։ Փորձեք՝ «ուսումնասիրել համակարգը», «գրաֆիկ», «անձնակազմ», «USB», «իրավունքներ» կամ ընտրեք ստորևի թեմաները։',
    openBot: 'Օգնական բոտ',
    closeBot: 'Փակել բոտը'
  },
  ru: {
    title: 'KM помощник',
    lead: 'Спрашивайте на армянском, русском или английском. Бот приветствует, отвечает и открывает разделы.',
    placeholder: 'Вопрос… например: как построить график',
    send: 'Отправить',
    close: 'Закрыть',
    clear: 'Очистить',
    loading: 'Загрузка…',
    loadFail: 'Не удалось загрузить базу знаний',
    openFail: 'Не удалось открыть раздел',
    open: 'Открыть',
    online: 'Online',
    offline: 'Offline',
    onlineMode: 'Есть сеть — доп. знания подключены (если доступны).',
    offlineMode: 'Работает offline — локальная база знаний.',
    welcome: 'Я помощник KM. Объясню график, личный состав, учёт, библиотеку, юридический раздел, права, USB/сеть и права страниц. Напишите вопрос или выберите тему.',
    fallback: 'Точная тема не найдена. Попробуйте: «обзор системы», «график», «личный состав», «USB», «права» или темы ниже.',
    openBot: 'Помощник',
    closeBot: 'Закрыть помощника'
  },
  en: {
    title: 'KM Help Bot',
    lead: 'Ask in Armenian, Russian, or English. The bot greets, answers, and opens sections.',
    placeholder: 'Type a question… e.g. how to build a schedule',
    send: 'Send',
    close: 'Close',
    clear: 'Clear',
    loading: 'Loading…',
    loadFail: 'Failed to load knowledge base',
    openFail: 'Could not open section',
    open: 'Open',
    online: 'Online',
    offline: 'Offline',
    onlineMode: 'Online — extra knowledge attached when available.',
    offlineMode: 'Offline mode — local knowledge base.',
    welcome: 'I am the KM assistant. I can explain schedules, personnel, accounting, library, legal corner, rights, USB/network, and page permissions. Ask a question or pick a topic.',
    fallback: 'No exact topic found. Try: “system overview”, “schedule”, “personnel”, “USB”, “rights”, or the topics below.',
    openBot: 'Help bot',
    closeBot: 'Close help bot'
  }
};

const intents = {
  greeting: {
    patterns: ['բարև', 'բարեև', 'ողջույն', 'հելո', 'հայ', 'привет', 'здравствуй', 'здравствуйте', 'добрый', 'hello', 'hi', 'hey', 'good morning', 'good evening'],
    replies: T(
      ['Բարև{name}։ Ինչո՞վ օգնել այսօր՝ գրաֆիկ, անձնակազմ, թե այլ բաժին։'],
      ['Здравствуйте{name}! Чем помочь: график, личный состав или другой раздел?'],
      ['Hello{name}! How can I help — schedule, personnel, or another section?']
    )
  },
  thanks: {
    patterns: ['շնորհակալ', 'մերսի', 'спасибо', 'благодар', 'thanks', 'thank you', 'thx'],
    replies: T(
      ['Խնդրեմ։ Եթե ուրիշ հարց ունեք՝ գրեք։', 'Հաճույքով։ Կարող եմ նաև բացել համապատասխան բաժինը։'],
      ['Пожалуйста! Если есть ещё вопрос — пишите.', 'Рад помочь. Могу открыть нужный раздел.'],
      ['You’re welcome! Ask anything else anytime.', 'Glad to help. I can also open the right section.']
    )
  },
  bye: {
    patterns: ['ցտեսություն', 'հաջող', 'դուրս', 'пока', 'до свидания', 'bye', 'goodbye', 'see you'],
    replies: T(
      ['Հաջողություն։ Կարող եք նորից բացել բոտը «?» կոճակով։'],
      ['Удачи! Снова откройте бота кнопкой «?».'],
      ['Goodbye! Open the bot again with the “?” button.']
    )
  },
  who: {
    patterns: ['ով ես', 'ինչ ես', 'кто ты', 'что ты', 'who are you', 'what are you'],
    replies: T(
      ['Ես KM տեղական օգնական բոտն եմ՝ առանց ինտերնետի էլ աշխատում եմ, իսկ online-ում կարող եմ լրացուցիչ գիտելիք միացնել։'],
      ['Я локальный помощник KM: работаю и без интернета, а онлайн могу подключить доп. знания.'],
      ['I am the KM local help bot: I work offline, and can attach extra knowledge online.']
    )
  },
  how: {
    patterns: ['ինչպես ես', 'как дела', 'how are you'],
    replies: T(
      ['Լավ եմ, շնորհակալություն։ Պատրաստ եմ օգնել KM-ի հարցերով։'],
      ['Хорошо, спасибо! Готов помочь по KM.'],
      ['I am fine, thank you! Ready to help with KM.']
    )
  }
};

function topic(id, title, keywords, answer, actions) {
  return { id, title, keywords, answer, actions: actions || [] };
}

const topics = [
  topic('system_map',
    T('Ամբողջ համակարգի քարտեզ', 'Обзор всей системы', 'Full system map'),
    ['ուսումնասիրել', 'համակարգ', 'ամբողջ', 'քարտեզ', 'կառուցվածք', 'бзор', 'система', 'карта', 'overview', 'system', 'map', 'modules', 'все разделы', 'բոլոր բաժին'],
    A(
      ['KM-ը offline ծրագիր է զորամասի համար՝ վերակարգեր, անձնակազմ, հաշվառում, փաստաթղթեր և իրավաբանական տեղեկատու։',
       'Հիմնական բլոկներ՝ Հաշվառում, Վերակարգեր, Գրադարան, Իրավաբանական անկյուն, Ադմին գործիքներ։',
       'Հերթականություն՝ անձնակազմ → վերակարգի տեսակ → գրաֆիկ → պահպանել/տպել → USB/ցանց։',
       'Մանրամասների համար հարցրեք առանձին թեմա (օր.՝ «գրաֆիկ»)։'],
      ['KM — offline программа для части: наряды, личный состав, учёт, документы и юридический справочник.',
       'Основные блоки: Учёт, Наряды, Библиотека, Юридический раздел, Админ-инструменты.',
       'Порядок: личный состав → тип наряда → график → сохранить/печать → USB/сеть.',
       'Для деталей спросите отдельную тему (например «график»).'],
      ['KM is an offline unit app for duties, personnel, accounting, documents, and a legal reference.',
       'Main blocks: Accounting, Duties, Library, Legal corner, Admin tools.',
       'Flow: personnel → duty type → schedule → save/print → USB/network.',
       'Ask about a specific topic for details (e.g. “schedule”).']
    ),
    [
      { label: L('Հիմնական', 'Главная', 'Home'), page: 'home' },
      { label: L('Անձնակազմ', 'Личный состав', 'Personnel'), page: 'people' },
      { label: L('Պլանավորում', 'Планирование', 'Schedule'), page: 'schedule' },
      { label: L('Գրադարան', 'Библиотека', 'Library'), page: 'library' },
      { label: L('Իրավաբանական', 'Юридический', 'Legal'), page: 'lawdocs' }
    ]
  ),
  topic('start',
    T('Ինչպես սկսել', 'Как начать', 'How to start'),
    ['սկսել', 'սկիզբ', 'մուտք', 'начать', 'старт', 'вход', 'start', 'begin', 'login', 'first'],
    A(
      ['Մուտք՝ Administrator կամ օգտատեր։', 'KM լոգոն բացում/փակում է մենյուն։', 'Աջ ներքևի «?»՝ օգնական բոտ։', 'Առաջին անգամ՝ Անձնակազմ → Վերակարգերի տեսակներ → Պլանավորում։', 'Տվյալները պահվում են այս PC-ում։'],
      ['Вход: Administrator или пользователь.', 'Логотип KM открывает/закрывает меню.', 'Кнопка «?» справа внизу — помощник.', 'Сначала: Личный состав → Типы нарядов → Планирование.', 'Данные хранятся на этом ПК.'],
      ['Sign in as Administrator or user.', 'KM logo opens/closes the menu.', 'Bottom-right “?” opens the help bot.', 'First steps: Personnel → Duty types → Schedule.', 'Data stays on this PC.']
    ),
    [{ label: L('Հիմնական', 'Главная', 'Home'), page: 'home' }]
  ),
  topic('people',
    T('Անձնակազմ', 'Личный состав', 'Personnel'),
    ['անձ', 'անձնակազմ', 'мարդ', 'личный', 'состав', 'personnel', 'people', 'soldier', 'զինծառայող', 'ավելացնել անձ'],
    A(
      ['Մենյու → Հաշվառում → Անձնակազմ։', 'Լրացրեք Ա․Ա․Հ․, կոչում, ստորաբաժանում, անհարմար օրեր։', 'Անձի քարտ՝ PDF, տույժեր, խրախուսանքներ, բնութագիր։', 'Գրաֆիկում երևալու համար անձը պետք է լինի ցուցակում։'],
      ['Меню → Учёт → Личный состав.', 'ФИО, звание, подразделение, неудобные дни.', 'Карточка: PDF, взыскания, поощрения, характеристика.', 'Чтобы попасть в график, человек должен быть в списке.'],
      ['Menu → Accounting → Personnel.', 'Add full name, rank, unit, unavailable days.', 'Person card: PDF, penalties, awards, characteristics.', 'They must be listed to appear on the schedule.']
    ),
    [{ label: L('Բացել', 'Открыть', 'Open'), page: 'people' }]
  ),
  topic('schedule',
    T('Վերակարգի գրաֆիկ', 'График нарядов', 'Duty schedule'),
    ['գրաֆիկ', 'վերակարգ', 'պլանավորում', 'график', 'наряд', 'планирование', 'schedule', 'duty', 'roster', 'ավտոմատ'],
    A(
      ['Նախ՝ անձնակազմ և վերակարգի տեսակ։', 'Վերակարգի պլանավորում → ամիս/տարի → Կառուցել կամ Ավտոմատ։', 'Ստուգեք վանդակները, Պահպանեք / Տպեք։', 'Formal տվյալները պահվում են յուրաքանչյուր գրաֆիկի համար առանձին։'],
      ['Сначала личный состав и тип наряда.', 'Планирование → месяц/год → Построить или Авто.', 'Проверьте ячейки, Сохранить / Печать.', 'Formal-данные хранятся отдельно для каждого графика.'],
      ['First set personnel and a duty type.', 'Schedule → month/year → Build or Auto.', 'Check cells, then Save / Print.', 'Formal data is stored per graph.']
    ),
    [
      { label: L('Տեսակներ', 'Типы', 'Types'), page: 'dutyTypes' },
      { label: L('Պլանավորում', 'Планирование', 'Schedule'), page: 'schedule' }
    ]
  ),
  topic('dutyTypes',
    T('Վերակարգերի տեսակներ', 'Типы нарядов', 'Duty types'),
    ['տեսակ', 'վերակարգերի տեսակ', 'тип наряда', 'duty type', 'types'],
    A(
      ['Մենյու → Վերակարգերի տեսակներ։', 'Ստեղծեք տեսակ՝ անուն, կանոններ, պաշտոններ։', 'Այնուհետև անցեք Պլանավորում։'],
      ['Меню → Типы нарядов.', 'Создайте тип: имя, правила, должности.', 'Затем откройте Планирование.'],
      ['Menu → Duty types.', 'Create a type: name, rules, posts.', 'Then open Schedule.']
    ),
    [{ label: L('Բացել', 'Открыть', 'Open'), page: 'dutyTypes' }]
  ),
  topic('accounting',
    T('Հաշվառում', 'Учёт', 'Accounting'),
    ['հաշվառում', 'учёт', 'учет', 'accounting', 'պաշտոն', 'должность', 'positions', 'troop'],
    A(
      ['Հաշվառում՝ անձնակազմ, պաշտոն, արձակուրդ, շարային տեղեկագիր, բուժկետ, քարտադարան, կոչումներ։', 'Պաշտոններից կարելի է կապել անձանց շտատային կառուցվածքին։'],
      ['Учёт: личный состав, должности, отпуск, строевая, медпункт, досье, звания.', 'Должности связывают людей со штатом.'],
      ['Accounting includes personnel, positions, leave, formation, medical, dossiers, ranks.', 'Positions link people to the unit structure.']
    ),
    [{ label: L('Հաշվառում', 'Учёт', 'Accounting'), page: 'accounting' }]
  ),
  topic('positions',
    T('Պաշտոններ', 'Должности', 'Positions'),
    ['պաշտոն', 'շտատ', 'должность', 'штат', 'position', 'shtat'],
    A(
      ['Հաշվառում → Պաշտոն։', 'Կարող եք նշանակել անձի պաշտոն, տեսնել թափուր տեղեր, արտահանել։'],
      ['Учёт → Должности.', 'Назначайте людей, смотрите вакансии, экспортируйте.'],
      ['Accounting → Positions.', 'Assign people, see vacancies, export.']
    ),
    [{ label: L('Պաշտոն', 'Должности', 'Positions'), page: 'positions' }]
  ),
  topic('vacations',
    T('Արձակուրդ', 'Отпуск', 'Leave / vacation'),
    ['արձակուրդ', 'отпуск', 'vacation', 'leave', 'հերթափոխ'],
    A(
      ['Հաշվառում → Արձակուրդ կամ Արձակուրդների հերթափոխ։', 'Իրավունքների բաժնում կա նաև արձակուրդների հաշվիչ։'],
      ['Учёт → Отпуск или очередь отпусков.', 'В правах военнослужащего есть калькулятор отпуска.'],
      ['Accounting → Leave or leave rotation.', 'Soldier rights also has a leave calculator.']
    ),
    [{ label: L('Արձակուրդ', 'Отпуск', 'Leave'), page: 'vacations' }]
  ),
  topic('library',
    T('ԳՐԱԴԱՐԱՆ', 'Библиотека и инструменты', 'Library and tools'),
    ['գրադարան', 'ֆայլ', 'библиотека', 'файл', 'library', 'files', 'նշում', 'архив', 'archive'],
    A(
      ['Գրադարան՝ ֆայլեր, նշումներ, հաշվետվություններ, USB, ցանց, արխիվ, փոխակերպում։', 'Ադմինը տեսնում է նաև ֆոնտեր և համակարգի տեղեկություն։'],
      ['Библиотека: файлы, заметки, отчёты, USB, сеть, архив, конвертация.', 'Админ также видит шрифты и сведения о системе.'],
      ['Library: files, notes, reports, USB, network, archive, convert.', 'Admin also sees fonts and system info.']
    ),
    [{ label: L('Գրադարան', 'Библиотека', 'Library'), page: 'library' }]
  ),
  topic('reports',
    T('Հաշվետվություններ', 'Отчёты', 'Reports'),
    ['հաշվետվություն', 'վիճակագրություն', 'отчёт', 'статистика', 'report', 'analytics', 'ամսական'],
    A(
      ['Գրադարան → Հաշվետվություններ՝ վիճակագրություն, ամսական, համեմատություն, փոխանակումներ։'],
      ['Библиотека → Отчёты: статистика, месячный, сравнение, замены.'],
      ['Library → Reports: analytics, monthly, compare, substitutions.']
    ),
    [{ label: L('Հաշվետվություններ', 'Отчёты', 'Reports'), page: 'reports' }]
  ),
  topic('usb',
    T('USB և համաժամեցում', 'USB и синхронизация', 'USB and sync'),
    ['usb', 'համաժամ', 'սինք', 'синхрон', 'sync', 'обмен', 'փոխանցել', 'import', 'export'],
    A(
      ['Գրադարան → USB կամ ցանց։', 'KM_SYNC.json կամ .kmusb արտահանում/ներմուծում։', 'Ցանցով կարելի է փոխանցել ֆայլեր և թարմացումներ տեղական ցանցում։'],
      ['Библиотека → USB или сеть.', 'Экспорт/импорт KM_SYNC.json или .kmusb.', 'По сети можно передавать файлы и обновления в LAN.'],
      ['Library → USB or network.', 'Export/import KM_SYNC.json or .kmusb.', 'Network transfer works on the local LAN.']
    ),
    [{ label: L('Գրադարան', 'Библиотека', 'Library'), page: 'library' }]
  ),
  topic('lawdocs',
    T('Իրավաբանական անկյուն', 'Юридический раздел', 'Legal corner'),
    ['իրավաբանական', 'օրենք', 'սահմանադրություն', 'юридич', 'закон', 'конституция', 'legal', 'law', 'codes'],
    A(
      ['Իրավաբանական անկյուն՝ Սահմանադրություն/օրենսգրքեր, կանոնադրություններ, հրամաններ, տույժեր, խրախուսանքներ, զինծառայողի իրավունքներ։', 'Սեղմեք քարտը՝ բացելու փաստաթուղթը in-app դիտիչում։'],
      ['Юридический раздел: Конституция/кодексы, уставы, приказы, взыскания, поощрения, права военнослужащего.', 'Нажмите карточку — документ откроется во встроенном просмотрщике.'],
      ['Legal corner: Constitution/codes, statutes, orders, penalties, awards, soldier rights.', 'Click a card to open the document in the in-app viewer.']
    ),
    [{ label: L('Բացել', 'Открыть', 'Open'), page: 'lawdocs' }]
  ),
  topic('soldier_rights',
    T('Զինծառայողի իրավունքներ', 'Права военнослужащего', 'Soldier rights'),
    ['իրավունք', 'զինծառայող', 'права', 'военнослужащ', 'rights', 'soldier', 'զինապահ', 'բուժ', 'medical'],
    A(
      ['Իրավաբանական → Զինծառայողի իրավունքներ։', 'Ենթաբաժիններ՝ բուժօգնություն, բնակարան, կրթություն, տրանսպորտ, արձակուրդ, վճարներ, ԶԻՆԱՊԱՀ, բողոքարկում, թեժ գծեր։', 'Յուրաքանչյուր քարտ բացում է ուղեցույց (HTML/PDF)։'],
      ['Юридический → Права военнослужащего.', 'Подразделы: медицина, жильё, образование, транспорт, отпуск, выплаты, ЗИНАПАХ, жалобы, горячие линии.', 'Каждая карточка открывает руководство (HTML/PDF).'],
      ['Legal → Soldier rights.', 'Subsections: medical, housing, education, transport, leave, pay, ZINAPAH, complaints, hotlines.', 'Each card opens a guide (HTML/PDF).']
    ),
    [{ label: L('Իրավունքներ', 'Права', 'Rights'), page: 'lawdocs' }]
  ),
  topic('users',
    T('Օգտատերեր և էջերի իրավունքներ', 'Пользователи и права страниц', 'Users and page rights'),
    ['օգտատեր', 'իրավունք', 'թույլտվություն', 'пользовател', 'права страниц', 'grant', 'permission', 'view only', 'միայն դիտել'],
    A(
      ['Ադմին → Օգտատերերի էջերի կառավարում → Էջերի իրավունքներ։', 'Քայլ 1՝ Միայն դիտել կամ Փոփոխություններ կատարել։', 'Քայլ 2՝ ընտրեք բաժինները և Հաստատել։', 'Օգնական բոտը («?») հասանելի է բոլորին։'],
      ['Админ → Управление страницами пользователей → Права страниц.', 'Шаг 1: Только просмотр или Изменения.', 'Шаг 2: выберите разделы и Подтвердить.', 'Помощник («?») доступен всем.'],
      ['Admin → User pages management → Page rights.', 'Step 1: View only or Make changes.', 'Step 2: select sections and Confirm.', 'The “?” help bot is available to everyone.']
    ),
    [{ label: L('Օգտատերեր', 'Пользователи', 'Users'), page: 'users' }]
  ),
  topic('unitTools',
    T('Զորամասի գործիքներ', 'Инструменты части', 'Unit tools'),
    ['զորամաս', 'գործիք', 'инструмент', 'unit tools', 'վքն', 'օրվա կարգ', 'գույք'],
    A(
      ['Միայն ադմին։ Փաստաթղթեր, ՎՔՆ, օրվա կարգացուցակ, գույք, ձևաթղթեր, անհարմար օրեր և այլն։'],
      ['Только админ. Документы, ВКН, распорядок дня, имущество, бланки, неудобные дни и др.'],
      ['Admin only. Documents, fuel calc, day plan, inventory, blanks, unavailable days, etc.']
    ),
    [{ label: L('Գործիքներ', 'Инструменты', 'Tools'), page: 'unitTools' }]
  ),
  topic('save',
    T('Պահպանում և արխիվ', 'Сохранение и архив', 'Save and archive'),
    ['պահպանել', 'արխիվ', 'сохранить', 'архив', 'save', 'backup', 'պահուստ'],
    A(
      ['Պահպանել կոճակը վերևում։', 'Գրադարան → Ընթացիկ արխիվ / Արխիվ։', 'USB արտահանումը լրացուցիչ պահուստ է։'],
      ['Кнопка Сохранить сверху.', 'Библиотека → Текущий архив / Архив.', 'USB-экспорт — дополнительная копия.'],
      ['Use Save at the top.', 'Library → Current archive / Archive.', 'USB export is an extra backup.']
    ),
    [{ label: L('Գրադարան', 'Библиотека', 'Library'), page: 'library' }]
  ),
  topic('print',
    T('Տպում և PDF', 'Печать и PDF', 'Print and PDF'),
    ['տպել', 'pdf', 'печать', 'print', 'экспорт'],
    A(
      ['Շատ բաժիններում կա Տպել / PDF։', 'Գրաֆիկը, հաշվետվությունները և անձի քարտը կարելի է տպել կամ արտահանել։'],
      ['Во многих разделах есть Печать / PDF.', 'График, отчёты и карточку можно печатать или экспортировать.'],
      ['Many sections have Print / PDF.', 'Schedules, reports, and person cards can be printed or exported.']
    ),
    []
  ),
  topic('language',
    T('Լեզուներ', 'Языки', 'Languages'),
    ['լեզու', 'язык', 'language', 'english', 'русский', 'հայերեն'],
    A(
      ['Վերևում՝ Լեզու / Язык / Language։', 'Ընտրեք Հայերեն, Русский կամ English։', 'Օգնական բոտը պատասխանում է ընտրված լեզվով։'],
      ['Сверху: Լեզու / Язык / Language.', 'Выберите Հայերեն, Русский или English.', 'Помощник отвечает на выбранном языке.'],
      ['Top bar: Լեզու / Язык / Language.', 'Choose Armenian, Russian, or English.', 'The help bot answers in the selected language.']
    ),
    []
  ),
  topic('bot',
    T('Ինչպես օգտագործել բոտը', 'Как пользоваться ботом', 'How to use this bot'),
    ['բոտ', 'օգնական', 'помощник', 'assistant', 'bot', 'faq', '?'],
    A(
      ['Բացեք աջ ներքևի «?» կոճակը։', 'Գրեք հարց կամ սեղմեք թեմաները։', 'Երկրորդ սեղմումը կամ × փակում է վահանակը՝ էջը չի փոխվում։', 'Աշխատում է offline, իսկ online-ում ավելացնում է լրացուցիչ գիտելիք։'],
      ['Откройте кнопку «?» справа внизу.', 'Напишите вопрос или выберите темы.', 'Повторное нажатие или × закрывает панель без смены страницы.', 'Работает offline; online добавляет доп. знания.'],
      ['Open the bottom-right “?” button.', 'Type a question or tap topics.', 'Second click or × closes the panel without changing the page.', 'Works offline; online adds extra knowledge.']
    ),
    []
  ),
  topic('discipline',
    T('Կարգապահական տույժեր', 'Дисциплинарные взыскания', 'Disciplinary penalties'),
    ['տույժ', 'կարգապահ', 'взыскан', 'дисциплин', 'penalty', 'discipline'],
    A(
      ['Իրավաբանական անկյուն → Կարգապահական տույժեր։', 'Կարող եք ավելացնել գրառում և կցել PDF։'],
      ['Юридический раздел → Дисциплинарные взыскания.', 'Можно добавить запись и прикрепить PDF.'],
      ['Legal corner → Disciplinary penalties.', 'Add records and attach PDF files.']
    ),
    [{ label: L('Իրավաբանական', 'Юридический', 'Legal'), page: 'lawdocs' }]
  ),
  topic('network',
    T('Ցանց', 'Сеть', 'Network'),
    ['ցանց', 'сеть', 'network', 'peer', 'ip', 'сервер'],
    A(
      ['Գրադարան → Ցանց և ֆայլեր։', 'Կարող եք փոխանակել ֆայլեր և թարմացումներ տեղական ցանցով։'],
      ['Библиотека → Сеть и файлы.', 'Обмен файлами и обновлениями по локальной сети.'],
      ['Library → Network and files.', 'Exchange files and updates over the local network.']
    ),
    [{ label: L('Ցանց', 'Сеть', 'Network'), page: 'network' }]
  )
];

const suggestions = {
  hy: [
    { label: 'Ուսումնասիրել համակարգը', q: 'ուսումնասիրել համակարգը' },
    { label: 'Սկիզբ', q: 'ինչպես սկսել' },
    { label: 'Անձնակազմ', q: 'անձնակազմ' },
    { label: 'Գրաֆիկ', q: 'վերակարգի գրաֆիկ' },
    { label: 'Հաշվառում', q: 'հաշվառում' },
    { label: 'Գրադարան', q: 'գրադարան' },
    { label: 'Իրավաբանական', q: 'իրավաբանական անկյուն' },
    { label: 'Իրավունքներ', q: 'զինծառայողի իրավունքներ' },
    { label: 'USB / ցանց', q: 'usb համաժամեցում' },
    { label: 'Էջերի իրավունքներ', q: 'էջերի իրավունքներ' },
    { label: 'Լեզու', q: 'լեզու փոխել' }
  ],
  ru: [
    { label: 'Обзор системы', q: 'обзор системы' },
    { label: 'Начать', q: 'как начать' },
    { label: 'Личный состав', q: 'личный состав' },
    { label: 'График', q: 'график нарядов' },
    { label: 'Учёт', q: 'учёт' },
    { label: 'Библиотека', q: 'библиотека' },
    { label: 'Юридический', q: 'юридический раздел' },
    { label: 'Права', q: 'права военнослужащего' },
    { label: 'USB / сеть', q: 'usb синхронизация' },
    { label: 'Права страниц', q: 'права страниц' },
    { label: 'Язык', q: 'сменить язык' }
  ],
  en: [
    { label: 'System overview', q: 'system overview' },
    { label: 'Getting started', q: 'how to start' },
    { label: 'Personnel', q: 'personnel' },
    { label: 'Schedule', q: 'duty schedule' },
    { label: 'Accounting', q: 'accounting' },
    { label: 'Library', q: 'library' },
    { label: 'Legal', q: 'legal corner' },
    { label: 'Rights', q: 'soldier rights' },
    { label: 'USB / network', q: 'usb sync' },
    { label: 'Page rights', q: 'page permissions' },
    { label: 'Language', q: 'change language' }
  ]
};

const main = {
  version: 2,
  ui,
  intents,
  suggestions,
  topics,
  title: T('KM օգնական բոտ', 'KM помощник', 'KM Help Bot'),
  welcome: T(ui.hy.welcome, ui.ru.welcome, ui.en.welcome),
  fallback: T(ui.hy.fallback, ui.ru.fallback, ui.en.fallback)
};

const online = {
  version: 1,
  note: 'Loaded when online; merges into local KB',
  topics: [
    topic('updates',
      T('Թարմացումներ', 'Обновления', 'Updates'),
      ['թարմացում', 'обновлен', 'update', 'upgrade', 'версия'],
      A(
        ['Թարմացումները տեղադրում է ադմինը՝ ցանցով կամ Setup-ով։', 'Օգտատերը կարող է ստուգել թարմացումը, եթե թույլատրված է։'],
        ['Обновления ставит админ по сети или Setup.', 'Пользователь может проверить обновление, если разрешено.'],
        ['Admins install updates via network or Setup.', 'Users can check for updates when allowed.']
      ),
      []
    ),
    topic('security',
      T('Անվտանգություն', 'Безопасность', 'Security'),
      ['անվտանգ', 'գաղտնաբառ', 'безопас', 'пароль', 'password', 'security'],
      A(
        ['Մի տվեք ադմինի գաղտնաբառը։', 'Օգտատերերին տվեք միայն անհրաժեշտ էջերի իրավունքները։'],
        ['Не передавайте пароль администратора.', 'Выдавайте пользователям только нужные права страниц.'],
        ['Do not share the admin password.', 'Grant users only the page rights they need.']
      ),
      []
    ),
    topic('troubleshooting',
      T('Խնդիրների լուծում', 'Устранение проблем', 'Troubleshooting'),
      ['չի բացվում', 'սխալ', 'ошибка', 'error', 'bug', 'не работает', 'չի աշխատում'],
      A(
        ['Փակեք և նորից բացեք KM-ը։', 'Ստուգեք՝ արդյոք ունեք էջի իրավունք։', 'Ադմին՝ ստուգեք Setup/թարմացում և պահուստ։'],
        ['Закройте и снова откройте KM.', 'Проверьте права страницы.', 'Админ: проверьте Setup/обновление и резервную копию.'],
        ['Close and reopen KM.', 'Check that you have page rights.', 'Admin: verify Setup/update and backups.']
      ),
      []
    )
  ]
};

fs.writeFileSync(path.join(outDir, 'km_help_bot.json'), JSON.stringify(main, null, 2), 'utf8');
fs.writeFileSync(path.join(outDir, 'km_help_bot_online.json'), JSON.stringify(online, null, 2), 'utf8');
console.log('topics', topics.length, 'online', online.topics.length);
