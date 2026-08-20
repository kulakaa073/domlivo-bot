import {log, errInfo} from '../log.js'

const API = 'https://api.telegram.org'

/** Telegram sendMessage hard limit. */
const MAX_TEXT = 4096

/** One inline button: label + callback_data (≤64 bytes). */
export type InlineButton = {text: string; data: string}

function inlineMarkup(rows: InlineButton[][]): Record<string, unknown> {
  return {inline_keyboard: rows.map((row) => row.map((b) => ({text: b.text, callback_data: b.data})))}
}

export class Telegram {
  constructor(private readonly token: string) {}

  /**
   * Best-effort reply. NEVER throws — a failed reply must not take down the
   * pipeline (the draft may already be written). Failures are logged in detail.
   * Returns the sent message_id, or null on failure — callers that don't need
   * it can ignore the return value. Text over Telegram's 4096 limit is truncated.
   */
  async sendMessage(
    chatId: number,
    text: string,
    opts?: {keyboard?: string[][]; inlineKeyboard?: InlineButton[][]},
  ): Promise<number | null> {
    let out = text
    if (out.length > MAX_TEXT) {
      out = out.slice(0, MAX_TEXT - 1) + '…'
      log('warn', 'tg_text_truncated', {chatId, originalLength: text.length})
    }
    try {
      const res = await fetch(`${API}/bot${this.token}/sendMessage`, {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify({
          chat_id: chatId,
          text: out,
          link_preview_options: {is_disabled: true},
          ...(opts?.inlineKeyboard
            ? {reply_markup: inlineMarkup(opts.inlineKeyboard)}
            : opts?.keyboard
              ? {
                  reply_markup: {
                    keyboard: opts.keyboard.map((row) => row.map((label) => ({text: label}))),
                    resize_keyboard: true,
                    is_persistent: true,
                  },
                }
              : {}),
        }),
      })
      if (!res.ok) {
        log('error', 'tg_send_failed', {chatId, status: res.status, body: await res.text()})
        return null
      }
      const data = (await res.json().catch(() => null)) as {result?: {message_id?: number}} | null
      return data?.result?.message_id ?? null
    } catch (e) {
      log('error', 'tg_send_failed', {chatId, ...errInfo(e)})
      return null
    }
  }

  /** Replace (or remove, with null) a message's inline keyboard. Best-effort, never throws. */
  async editMessageReplyMarkup(
    chatId: number,
    messageId: number,
    inlineKeyboard: InlineButton[][] | null,
  ): Promise<boolean> {
    try {
      const res = await fetch(`${API}/bot${this.token}/editMessageReplyMarkup`, {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          reply_markup: inlineMarkup(inlineKeyboard ?? []),
        }),
      })
      if (!res.ok) {
        log('error', 'tg_edit_markup_failed', {chatId, messageId, status: res.status, body: await res.text()})
        return false
      }
      return true
    } catch (e) {
      log('error', 'tg_edit_markup_failed', {chatId, messageId, ...errInfo(e)})
      return false
    }
  }

  /** Every callback_query MUST be answered (Telegram shows a spinner until then). Best-effort, never throws. */
  async answerCallbackQuery(callbackId: string, opts?: {text?: string; showAlert?: boolean}): Promise<boolean> {
    try {
      const res = await fetch(`${API}/bot${this.token}/answerCallbackQuery`, {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify({
          callback_query_id: callbackId,
          ...(opts?.text ? {text: opts.text} : {}),
          ...(opts?.showAlert ? {show_alert: true} : {}),
        }),
      })
      if (!res.ok) {
        log('error', 'tg_answer_cb_failed', {callbackId, status: res.status, body: await res.text()})
        return false
      }
      return true
    } catch (e) {
      log('error', 'tg_answer_cb_failed', {callbackId, ...errInfo(e)})
      return false
    }
  }

  /** Resolve a file_id to bytes. Throws on failure — the caller decides (a photo may be skipped). */
  async downloadFile(fileId: string): Promise<Buffer> {
    const infoRes = await fetch(`${API}/bot${this.token}/getFile`, {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify({file_id: fileId}),
    })
    const info = (await infoRes.json()) as {ok: boolean; result?: {file_path?: string}}
    if (!info.ok || !info.result?.file_path) throw new Error(`getFile failed for ${fileId}`)
    const fileRes = await fetch(`${API}/file/bot${this.token}/${info.result.file_path}`)
    if (!fileRes.ok) throw new Error(`file download HTTP ${fileRes.status} for ${fileId}`)
    return Buffer.from(await fileRes.arrayBuffer())
  }
}
