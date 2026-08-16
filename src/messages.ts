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
  },
}
