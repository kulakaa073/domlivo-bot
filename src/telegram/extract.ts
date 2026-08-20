export type TgUpdate = {
  update_id: number
  message?: {
    message_id: number
    from?: {id: number; is_bot?: boolean; first_name?: string; username?: string; language_code?: string}
    chat?: {id: number; type: string}
    media_group_id?: string
    text?: string
    caption?: string
    photo?: Array<{file_id: string; width: number; height: number; file_size?: number}>
    document?: {file_id: string; mime_type?: string; file_name?: string}
  }
  callback_query?: {
    id: string
    from?: {id: number; is_bot?: boolean; language_code?: string}
    message?: {message_id: number; chat?: {id: number; type: string}}
    data?: string
  }
}

/** An inline-button press, with enough context to answer and edit the message. */
export type IncomingCallback = {
  updateId: number
  callbackId: string
  data: string
  chatId: number
  senderId: number
  messageId: number
  languageCode: string | null
}

export function extractCallback(update: TgUpdate): IncomingCallback | null {
  const cb = update.callback_query
  if (!cb || !cb.from || cb.from.is_bot || !cb.data) return null
  const msg = cb.message
  if (!msg || !msg.chat || msg.chat.type !== 'private') return null
  return {
    updateId: update.update_id,
    callbackId: cb.id,
    data: cb.data,
    chatId: msg.chat.id,
    senderId: cb.from.id,
    messageId: msg.message_id,
    languageCode: cb.from.language_code ?? null,
  }
}

export type Incoming = {
  updateId: number
  chatId: number
  senderId: number
  /** Telegram @username if the account has one — used for onboarding only, never for auth. */
  username: string | null
  firstName: string | null
  /** Telegram client language ("uk", "ru-RU", ...) — used to localize bot replies. */
  languageCode: string | null
  mediaGroupId: string | null
  /** caption (media) or text (plain message) */
  text: string | null
  /** Largest photo size, or an image sent as a document. */
  photoFileId: string | null
  command: string | null
}

export function extractIncoming(update: TgUpdate): Incoming | null {
  const m = update.message
  if (!m || !m.from || m.from.is_bot || !m.chat || m.chat.type !== 'private') return null

  const text = m.caption ?? m.text ?? null
  const command = text?.startsWith('/') ? (text.split(/\s/)[0] ?? null) : null

  let photoFileId: string | null = null
  if (m.photo && m.photo.length > 0) {
    // Telegram sends PhotoSize[] sorted ascending; the last entry is the largest.
    photoFileId = m.photo[m.photo.length - 1]!.file_id
  } else if (m.document && (m.document.mime_type ?? '').startsWith('image/')) {
    photoFileId = m.document.file_id
  }

  return {
    updateId: update.update_id,
    chatId: m.chat.id,
    senderId: m.from.id,
    username: m.from.username ?? null,
    firstName: m.from.first_name ?? null,
    languageCode: m.from.language_code ?? null,
    mediaGroupId: m.media_group_id ?? null,
    text,
    photoFileId,
    command,
  }
}
