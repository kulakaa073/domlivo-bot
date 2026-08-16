export type TgUpdate = {
  update_id: number
  message?: {
    message_id: number
    from?: {id: number; is_bot?: boolean; first_name?: string; username?: string}
    chat?: {id: number; type: string}
    media_group_id?: string
    text?: string
    caption?: string
    photo?: Array<{file_id: string; width: number; height: number; file_size?: number}>
    document?: {file_id: string; mime_type?: string; file_name?: string}
  }
}

export type Incoming = {
  updateId: number
  chatId: number
  senderId: number
  /** Telegram @username if the account has one — used for onboarding logs only, never for auth. */
  username: string | null
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
    mediaGroupId: m.media_group_id ?? null,
    text,
    photoFileId,
    command,
  }
}
