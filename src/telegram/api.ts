import {log, errInfo} from '../log.js'

const API = 'https://api.telegram.org'

export class Telegram {
  constructor(private readonly token: string) {}

  /**
   * Best-effort reply. NEVER throws — a failed reply must not take down the
   * pipeline (the draft may already be written). Failures are logged in detail.
   */
  async sendMessage(chatId: number, text: string): Promise<boolean> {
    try {
      const res = await fetch(`${API}/bot${this.token}/sendMessage`, {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify({chat_id: chatId, text, link_preview_options: {is_disabled: true}}),
      })
      if (!res.ok) {
        log('error', 'tg_send_failed', {chatId, status: res.status, body: await res.text()})
        return false
      }
      return true
    } catch (e) {
      log('error', 'tg_send_failed', {chatId, ...errInfo(e)})
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
