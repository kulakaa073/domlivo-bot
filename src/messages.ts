export type Lang = 'en' | 'uk' | 'ru' | 'sq' | 'it'

const LANGS: readonly Lang[] = ['en', 'uk', 'ru', 'sq', 'it']

/** Telegram's from.language_code ("uk", "ru-RU", ...) -> a supported locale, defaulting to English. */
export function pickLang(code: string | null | undefined): Lang {
  const p = (code ?? '').toLowerCase().split('-')[0] ?? ''
  return (LANGS as readonly string[]).includes(p) ? (p as Lang) : 'en'
}

export type Messages = {
  bareError: string
  refusal: string
  disabled: string
  pending: string
  requestRecorded: string
  usage: string
  greeting: (name: string) => string
  noCaption: string
  notAListing: string
  working: string
  btnAdd: string
  btnSubmit: string
  btnCancel: string
  sessionStarted: string
  sessionTally: (photos: number, texts: number) => string
  sessionCancelled: string
  sessionEmpty: string
  coordsSet: string
  draftCreated: string
  missingLabel: string
  notMatched: string
  photosFailed: (n: number) => string
  review: string
  photosWord: string
  fields: {
    title: string
    price: string
    deal: string
    type: string
    city: string
    area: string
    bedrooms: string
    photos: string
  }
  btnUpdate: string
  btnPost: string
  btnRestart: string
  restartDone: string
  pvPhotos: (n: number) => string
  pvPinSet: string
  pvPinNotSet: string
  pvBuilt: (y: number) => string
  pvFloor: (n: number) => string
  pvAmenities: string
  pvShortDescription: string
  pvDescription: string
  pvTruncated: string
  pvForSale: string
  pvForRent: string
  updAskMissing: (fields: string) => string
  updAskFree: string
  updNothingParsed: string
  updResumed: string
  postBlocked: (fields: string) => string
  postPublished: string
  postNoBaseUrl: string
  postDisabled: string
  postGone: string
  staleButton: string
}

export const M: Record<Lang, Messages> = {
  en: {
    bareError:
      "⚠️ Something went wrong on our side. The listing was not saved — please try again in a few minutes.",
    refusal:
      "Sorry, this bot only accepts listings from registered DomLivo agents. Press /start to request access.",
    disabled: "The intake bot is currently switched off. Please try again later.",
    pending:
      "Your access request is waiting for approval. You will be able to submit listings once a manager approves it.",
    requestRecorded:
      "Thanks! Your request has been recorded — your Telegram id and username were sent to the DomLivo team. " +
      "You will be able to submit listings as soon as a manager approves you.",
    usage:
      "Send me property photos as an album, with the listing text in the caption (any language). " +
      "Tip: send images as files for full quality. I will create a draft for review — nothing goes live automatically.",
    greeting: (name) => `Hi ${name}! `,
    noCaption: "Please include the listing description as the caption of the photos, then send again.",
    notAListing:
      "This doesn't look like a property listing. Please send the property description — type, location, area, price.",
    working: "✅ Got it — processing your listing. This takes about half a minute…",
    btnAdd: "➕ Add property",
    btnSubmit: "✅ Submit",
    btnCancel: "❌ Cancel",
    sessionStarted:
      "Session started — send photos and the listing text in as many messages as you like, then press ✅ Submit.",
    sessionTally: (p, t) => `📥 Collected: ${p} photo(s), ${t} text message(s). Press ✅ Submit when done.`,
    sessionCancelled: "Session cancelled — nothing was saved.",
    sessionEmpty:
      "Nothing to submit yet — press ➕ Add property, send photos and the description, then ✅ Submit.",
    coordsSet: "📍 Coordinates taken from your map link.",
    draftCreated: "Draft created",
    missingLabel: "Missing",
    notMatched: "Not matched (left empty)",
    photosFailed: (n) => `${n} photo(s) failed to upload`,
    review: "Review and publish",
    photosWord: "photos",
    fields: {
      title: "title",
      price: "price",
      deal: "sale or rent",
      type: "property type",
      city: "city",
      area: "area (m²)",
      bedrooms: "bedrooms",
      photos: "photos",
    },
    btnUpdate: "✏️ Update",
    btnPost: "🚀 Post",
    btnRestart: "🔄 Restart",
    restartDone: "Fresh start — nothing was deleted from Studio.",
    pvPhotos: (n) => `🖼 ${n} photo(s) uploaded`,
    pvPinSet: "📍 Map pin set",
    pvPinNotSet: "📍 Map pin not set",
    pvBuilt: (y) => `📅 Built ${y}`,
    pvFloor: (n) => `🏢 Floor ${n}`,
    pvAmenities: "🔑 Amenities",
    pvShortDescription: "Short description",
    pvDescription: "Description",
    pvTruncated: "… (full text in Studio)",
    pvForSale: "For sale",
    pvForRent: "For rent",
    updAskMissing: (fields) =>
      `Please send the missing info in one message: ${fields}. You can also attach more photos.`,
    updAskFree:
      "Send the corrections in one message (e.g. “price 120000, 3 bedrooms”). You can also attach more photos.",
    updNothingParsed:
      "I couldn't read any listing fields from that — try “price 120000”, or press ❌ Cancel.",
    updResumed: "OK — back to review.",
    postBlocked: (fields) => `Cannot publish yet — missing: ${fields}. Press ✏️ Update to add them.`,
    postPublished: "Published 🎉 — it may take a minute to appear:",
    postNoBaseUrl:
      "Published 🎉 — set “Site Base URL” in Studio settings to get live links here. Studio link:",
    postDisabled: "Publishing from the bot is switched off. Ask the site owner to enable it in Studio settings.",
    postGone: "This draft no longer exists in Studio — it may have been published or deleted already.",
    staleButton: "This draft is no longer in review — open it in Studio.",
  },

  uk: {
    bareError:
      "⚠️ Щось пішло не так з нашого боку. Оголошення не збережено — спробуйте ще раз за кілька хвилин.",
    refusal:
      "Вибачте, цей бот приймає оголошення лише від зареєстрованих агентів DomLivo. Натисніть /start, щоб запросити доступ.",
    disabled: "Бот прийому оголошень зараз вимкнено. Спробуйте пізніше.",
    pending:
      "Ваш запит на доступ очікує підтвердження. Ви зможете надсилати оголошення, щойно менеджер його схвалить.",
    requestRecorded:
      "Дякуємо! Ваш запит записано — ваш Telegram id та імʼя користувача надіслано команді DomLivo. " +
      "Ви зможете надсилати оголошення, щойно менеджер вас схвалить.",
    usage:
      "Надішліть мені фотографії обʼєкта альбомом, а текст оголошення — у підписі (будь-якою мовою). " +
      "Порада: надсилайте зображення файлами для повної якості. Я створю чернетку на перевірку — нічого не публікується автоматично.",
    greeting: (name) => `Вітаю, ${name}! `,
    noCaption: "Будь ласка, додайте опис оголошення в підпис до фотографій і надішліть знову.",
    notAListing:
      "Це не схоже на оголошення про нерухомість. Надішліть, будь ласка, опис обʼєкта — тип, розташування, площа, ціна.",
    working: "✅ Прийнято — обробляю ваше оголошення. Це займе близько пів хвилини…",
    btnAdd: "➕ Додати обʼєкт",
    btnSubmit: "✅ Надіслати",
    btnCancel: "❌ Скасувати",
    sessionStarted:
      "Сесію розпочато — надсилайте фото та текст оголошення будь-якою кількістю повідомлень, потім натисніть ✅ Надіслати.",
    sessionTally: (p, t) => `📥 Зібрано: фото — ${p}, текстів — ${t}. Натисніть ✅ Надіслати, коли готово.`,
    sessionCancelled: "Сесію скасовано — нічого не збережено.",
    sessionEmpty:
      "Ще немає що надсилати — натисніть ➕ Додати обʼєкт, надішліть фото та опис, потім ✅ Надіслати.",
    coordsSet: "📍 Координати взято з вашого посилання на мапу.",
    draftCreated: "Чернетку створено",
    missingLabel: "Бракує",
    notMatched: "Не розпізнано (залишено порожнім)",
    photosFailed: (n) => `${n} фото не завантажено`,
    review: "Переглянути й опублікувати",
    photosWord: "фото",
    fields: {
      title: "заголовок",
      price: "ціна",
      deal: "продаж чи оренда",
      type: "тип нерухомості",
      city: "місто",
      area: "площа (м²)",
      bedrooms: "спальні",
      photos: "фотографії",
    },
    btnUpdate: "✏️ Доповнити",
    btnPost: "🚀 Опублікувати",
    btnRestart: "🔄 Спочатку",
    restartDone: "Починаємо заново — у Studio нічого не видалено.",
    pvPhotos: (n) => `🖼 Фото завантажено: ${n}`,
    pvPinSet: "📍 Мітку на мапі встановлено",
    pvPinNotSet: "📍 Мітки на мапі немає",
    pvBuilt: (y) => `📅 Рік побудови: ${y}`,
    pvFloor: (n) => `🏢 Поверх: ${n}`,
    pvAmenities: "🔑 Зручності",
    pvShortDescription: "Короткий опис",
    pvDescription: "Опис",
    pvTruncated: "… (повний текст у Studio)",
    pvForSale: "Продаж",
    pvForRent: "Оренда",
    updAskMissing: (fields) =>
      `Надішліть, будь ласка, одним повідомленням: ${fields}. Можна також додати фото.`,
    updAskFree:
      "Надішліть виправлення одним повідомленням (напр. «ціна 120000, 3 спальні»). Можна також додати фото.",
    updNothingParsed:
      "Не вдалося розпізнати жодного поля — спробуйте «ціна 120000» або натисніть ❌ Скасувати.",
    updResumed: "Гаразд — повертаємось до перегляду.",
    postBlocked: (fields) => `Опублікувати ще не можна — бракує: ${fields}. Натисніть ✏️ Доповнити.`,
    postPublished: "Опубліковано 🎉 — сторінка з'явиться протягом хвилини:",
    postNoBaseUrl:
      "Опубліковано 🎉 — задайте «Site Base URL» у налаштуваннях Studio, щоб отримувати живі посилання. Посилання на Studio:",
    postDisabled: "Публікацію з бота вимкнено. Попросіть власника сайту увімкнути її в налаштуваннях Studio.",
    postGone: "Цієї чернетки вже немає в Studio — можливо, її вже опубліковано або видалено.",
    staleButton: "Ця чернетка вже не на перегляді — відкрийте її в Studio.",
  },

  ru: {
    bareError:
      "⚠️ Что-то пошло не так на нашей стороне. Объявление не сохранено — попробуйте ещё раз через несколько минут.",
    refusal:
      "Извините, этот бот принимает объявления только от зарегистрированных агентов DomLivo. Нажмите /start, чтобы запросить доступ.",
    disabled: "Бот приёма объявлений сейчас выключен. Попробуйте позже.",
    pending:
      "Ваш запрос на доступ ожидает подтверждения. Вы сможете отправлять объявления, как только менеджер его одобрит.",
    requestRecorded:
      "Спасибо! Ваш запрос записан — ваш Telegram id и имя пользователя отправлены команде DomLivo. " +
      "Вы сможете отправлять объявления, как только менеджер вас одобрит.",
    usage:
      "Отправьте мне фотографии объекта альбомом, а текст объявления — в подписи (на любом языке). " +
      "Совет: отправляйте изображения файлами для полного качества. Я создам черновик на проверку — ничего не публикуется автоматически.",
    greeting: (name) => `Здравствуйте, ${name}! `,
    noCaption: "Пожалуйста, добавьте описание объявления в подпись к фотографиям и отправьте снова.",
    notAListing:
      "Это не похоже на объявление о недвижимости. Отправьте, пожалуйста, описание объекта — тип, расположение, площадь, цена.",
    working: "✅ Принято — обрабатываю ваше объявление. Это займёт около полминуты…",
    btnAdd: "➕ Добавить объект",
    btnSubmit: "✅ Отправить",
    btnCancel: "❌ Отменить",
    sessionStarted:
      "Сессия начата — отправляйте фото и текст объявления любым числом сообщений, затем нажмите ✅ Отправить.",
    sessionTally: (p, t) => `📥 Собрано: фото — ${p}, текстов — ${t}. Нажмите ✅ Отправить, когда закончите.`,
    sessionCancelled: "Сессия отменена — ничего не сохранено.",
    sessionEmpty:
      "Пока нечего отправлять — нажмите ➕ Добавить объект, отправьте фото и описание, затем ✅ Отправить.",
    coordsSet: "📍 Координаты взяты из вашей ссылки на карту.",
    draftCreated: "Черновик создан",
    missingLabel: "Не хватает",
    notMatched: "Не распознано (оставлено пустым)",
    photosFailed: (n) => `${n} фото не загружено`,
    review: "Проверить и опубликовать",
    photosWord: "фото",
    fields: {
      title: "заголовок",
      price: "цена",
      deal: "продажа или аренда",
      type: "тип недвижимости",
      city: "город",
      area: "площадь (м²)",
      bedrooms: "спальни",
      photos: "фотографии",
    },
    btnUpdate: "✏️ Дополнить",
    btnPost: "🚀 Опубликовать",
    btnRestart: "🔄 Сначала",
    restartDone: "Начинаем заново — в Studio ничего не удалено.",
    pvPhotos: (n) => `🖼 Фото загружено: ${n}`,
    pvPinSet: "📍 Метка на карте установлена",
    pvPinNotSet: "📍 Метки на карте нет",
    pvBuilt: (y) => `📅 Год постройки: ${y}`,
    pvFloor: (n) => `🏢 Этаж: ${n}`,
    pvAmenities: "🔑 Удобства",
    pvShortDescription: "Краткое описание",
    pvDescription: "Описание",
    pvTruncated: "… (полный текст в Studio)",
    pvForSale: "Продажа",
    pvForRent: "Аренда",
    updAskMissing: (fields) =>
      `Пришлите недостающее одним сообщением: ${fields}. Можно также приложить фото.`,
    updAskFree:
      "Пришлите исправления одним сообщением (напр. «цена 120000, 3 спальни»). Можно также приложить фото.",
    updNothingParsed:
      "Не удалось распознать ни одного поля — попробуйте «цена 120000» или нажмите ❌ Отменить.",
    updResumed: "Хорошо — возвращаемся к просмотру.",
    postBlocked: (fields) => `Опубликовать пока нельзя — не хватает: ${fields}. Нажмите ✏️ Дополнить.`,
    postPublished: "Опубликовано 🎉 — страница появится в течение минуты:",
    postNoBaseUrl:
      "Опубликовано 🎉 — задайте «Site Base URL» в настройках Studio, чтобы получать живые ссылки. Ссылка на Studio:",
    postDisabled: "Публикация из бота выключена. Попросите владельца сайта включить её в настройках Studio.",
    postGone: "Этого черновика больше нет в Studio — возможно, он уже опубликован или удалён.",
    staleButton: "Этот черновик уже не на просмотре — откройте его в Studio.",
  },

  sq: {
    bareError:
      "⚠️ Diçka shkoi keq nga ana jonë. Njoftimi nuk u ruajt — provoni përsëri pas disa minutash.",
    refusal:
      "Na vjen keq, ky bot pranon njoftime vetëm nga agjentët e regjistruar të DomLivo. Shtypni /start për të kërkuar qasje.",
    disabled: "Boti i pranimit të njoftimeve është i fikur për momentin. Provoni më vonë.",
    pending:
      "Kërkesa juaj për qasje po pret miratimin. Do të mund të dërgoni njoftime sapo një menaxher ta miratojë.",
    requestRecorded:
      "Faleminderit! Kërkesa juaj u regjistrua — id-ja juaj e Telegramit dhe emri i përdoruesit iu dërguan ekipit të DomLivo. " +
      "Do të mund të dërgoni njoftime sapo një menaxher t'ju miratojë.",
    usage:
      "Dërgoni fotot e pronës si album, me tekstin e njoftimit si përshkrim (në çdo gjuhë). " +
      "Këshillë: dërgojini imazhet si skedarë për cilësi të plotë. Do të krijoj një draft për shqyrtim — asgjë nuk publikohet automatikisht.",
    greeting: (name) => `Përshëndetje, ${name}! `,
    noCaption: "Ju lutem shtoni përshkrimin e njoftimit si tekst te fotot dhe dërgoni përsëri.",
    notAListing:
      "Kjo nuk duket si njoftim prone. Ju lutem dërgoni përshkrimin e pronës — lloji, vendndodhja, sipërfaqja, çmimi.",
    working: "✅ E mora — po e përpunoj njoftimin tuaj. Kjo zgjat rreth gjysmë minute…",
    btnAdd: "➕ Shto pronë",
    btnSubmit: "✅ Dërgo",
    btnCancel: "❌ Anulo",
    sessionStarted:
      "Sesioni filloi — dërgoni fotot dhe tekstin e njoftimit me sa mesazhe të doni, pastaj shtypni ✅ Dërgo.",
    sessionTally: (p, t) => `📥 Të mbledhura: ${p} foto, ${t} tekste. Shtypni ✅ Dërgo kur të mbaroni.`,
    sessionCancelled: "Sesioni u anulua — asgjë nuk u ruajt.",
    sessionEmpty:
      "Ende s'ka asgjë për të dërguar — shtypni ➕ Shto pronë, dërgoni fotot dhe përshkrimin, pastaj ✅ Dërgo.",
    coordsSet: "📍 Koordinatat u morën nga lidhja juaj e hartës.",
    draftCreated: "Drafti u krijua",
    missingLabel: "Mungon",
    notMatched: "Nuk u gjet (u la bosh)",
    photosFailed: (n) => `${n} foto nuk u ngarkuan`,
    review: "Shqyrtoni dhe publikoni",
    photosWord: "foto",
    fields: {
      title: "titulli",
      price: "çmimi",
      deal: "shitje apo qira",
      type: "lloji i pronës",
      city: "qyteti",
      area: "sipërfaqja (m²)",
      bedrooms: "dhomat e gjumit",
      photos: "fotot",
    },
    btnUpdate: "✏️ Plotëso",
    btnPost: "🚀 Publiko",
    btnRestart: "🔄 Rifillo",
    restartDone: "Fillim i ri — asgjë nuk u fshi nga Studio.",
    pvPhotos: (n) => `🖼 Foto të ngarkuara: ${n}`,
    pvPinSet: "📍 Pika në hartë u vendos",
    pvPinNotSet: "📍 Pika në hartë mungon",
    pvBuilt: (y) => `📅 Ndërtuar më ${y}`,
    pvFloor: (n) => `🏢 Kati: ${n}`,
    pvAmenities: "🔑 Pajisjet",
    pvShortDescription: "Përshkrim i shkurtër",
    pvDescription: "Përshkrimi",
    pvTruncated: "… (teksti i plotë në Studio)",
    pvForSale: "Në shitje",
    pvForRent: "Me qira",
    updAskMissing: (fields) =>
      `Ju lutem dërgoni me një mesazh të vetëm: ${fields}. Mund të shtoni edhe foto.`,
    updAskFree:
      "Dërgoni korrigjimet me një mesazh (p.sh. «çmimi 120000, 3 dhoma gjumi»). Mund të shtoni edhe foto.",
    updNothingParsed:
      "Nuk munda të lexoj asnjë fushë — provoni «çmimi 120000» ose shtypni ❌ Anulo.",
    updResumed: "Në rregull — kthehemi te shqyrtimi.",
    postBlocked: (fields) => `Nuk mund të publikohet ende — mungon: ${fields}. Shtypni ✏️ Plotëso.`,
    postPublished: "U publikua 🎉 — faqja shfaqet brenda një minute:",
    postNoBaseUrl:
      "U publikua 🎉 — vendosni «Site Base URL» te cilësimet e Studio-s për lidhje të drejtpërdrejta. Lidhja e Studio-s:",
    postDisabled: "Publikimi nga boti është i fikur. Kërkojini pronarit të faqes ta aktivizojë te cilësimet e Studio-s.",
    postGone: "Ky draft nuk ekziston më në Studio — mund të jetë publikuar ose fshirë tashmë.",
    staleButton: "Ky draft nuk është më në shqyrtim — hapeni në Studio.",
  },

  it: {
    bareError:
      "⚠️ Qualcosa è andato storto da parte nostra. L'annuncio non è stato salvato — riprova tra qualche minuto.",
    refusal:
      "Spiacenti, questo bot accetta annunci solo da agenti DomLivo registrati. Premi /start per richiedere l'accesso.",
    disabled: "Il bot di ricezione annunci è momentaneamente spento. Riprova più tardi.",
    pending:
      "La tua richiesta di accesso è in attesa di approvazione. Potrai inviare annunci non appena un manager la approverà.",
    requestRecorded:
      "Grazie! La tua richiesta è stata registrata — il tuo id Telegram e il tuo username sono stati inviati al team DomLivo. " +
      "Potrai inviare annunci non appena un manager ti approverà.",
    usage:
      "Inviami le foto dell'immobile come album, con il testo dell'annuncio nella didascalia (in qualsiasi lingua). " +
      "Consiglio: invia le immagini come file per la massima qualità. Creerò una bozza da revisionare — nulla va online automaticamente.",
    greeting: (name) => `Ciao ${name}! `,
    noCaption: "Aggiungi la descrizione dell'annuncio come didascalia delle foto e invia di nuovo.",
    notAListing:
      "Questo non sembra un annuncio immobiliare. Invia una descrizione dell'immobile — tipo, posizione, superficie, prezzo.",
    working: "✅ Ricevuto — sto elaborando il tuo annuncio. Ci vorrà circa mezzo minuto…",
    btnAdd: "➕ Aggiungi immobile",
    btnSubmit: "✅ Invia",
    btnCancel: "❌ Annulla",
    sessionStarted:
      "Sessione avviata — invia foto e testo dell'annuncio in quanti messaggi vuoi, poi premi ✅ Invia.",
    sessionTally: (p, t) => `📥 Raccolti: ${p} foto, ${t} testi. Premi ✅ Invia quando hai finito.`,
    sessionCancelled: "Sessione annullata — nulla è stato salvato.",
    sessionEmpty:
      "Niente da inviare per ora — premi ➕ Aggiungi immobile, invia foto e descrizione, poi ✅ Invia.",
    coordsSet: "📍 Coordinate prese dal tuo link della mappa.",
    draftCreated: "Bozza creata",
    missingLabel: "Mancano",
    notMatched: "Non riconosciuto (lasciato vuoto)",
    photosFailed: (n) => `${n} foto non caricate`,
    review: "Rivedi e pubblica",
    photosWord: "foto",
    fields: {
      title: "titolo",
      price: "prezzo",
      deal: "vendita o affitto",
      type: "tipo di immobile",
      city: "città",
      area: "superficie (m²)",
      bedrooms: "camere da letto",
      photos: "foto",
    },
    btnUpdate: "✏️ Completa",
    btnPost: "🚀 Pubblica",
    btnRestart: "🔄 Ricomincia",
    restartDone: "Si ricomincia — nulla è stato eliminato da Studio.",
    pvPhotos: (n) => `🖼 Foto caricate: ${n}`,
    pvPinSet: "📍 Punto sulla mappa impostato",
    pvPinNotSet: "📍 Punto sulla mappa mancante",
    pvBuilt: (y) => `📅 Costruito nel ${y}`,
    pvFloor: (n) => `🏢 Piano: ${n}`,
    pvAmenities: "🔑 Servizi",
    pvShortDescription: "Descrizione breve",
    pvDescription: "Descrizione",
    pvTruncated: "… (testo completo in Studio)",
    pvForSale: "In vendita",
    pvForRent: "In affitto",
    updAskMissing: (fields) =>
      `Invia le informazioni mancanti in un unico messaggio: ${fields}. Puoi anche allegare altre foto.`,
    updAskFree:
      "Invia le correzioni in un unico messaggio (es. «prezzo 120000, 3 camere»). Puoi anche allegare altre foto.",
    updNothingParsed:
      "Non sono riuscito a leggere alcun campo — prova «prezzo 120000» o premi ❌ Annulla.",
    updResumed: "Va bene — torniamo alla revisione.",
    postBlocked: (fields) => `Non si può ancora pubblicare — manca: ${fields}. Premi ✏️ Completa.`,
    postPublished: "Pubblicato 🎉 — la pagina apparirà entro un minuto:",
    postNoBaseUrl:
      "Pubblicato 🎉 — imposta «Site Base URL» nelle impostazioni di Studio per ricevere link diretti. Link a Studio:",
    postDisabled: "La pubblicazione dal bot è disattivata. Chiedi al proprietario del sito di attivarla nelle impostazioni di Studio.",
    postGone: "Questa bozza non esiste più in Studio — potrebbe essere già stata pubblicata o eliminata.",
    staleButton: "Questa bozza non è più in revisione — aprila in Studio.",
  },
}
