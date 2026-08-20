import {describe, it, expect, vi, afterEach} from 'vitest'
import {Telegram} from '../telegram/api.js'

afterEach(() => vi.unstubAllGlobals())

describe('Telegram', () => {
  it('sendMessage returns null (never throws) on HTTP failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', {status: 500})))
    const id = await new Telegram('tok').sendMessage(1, 'hi')
    expect(id).toBeNull()
  })

  it('sendMessage returns null (never throws) on network error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new Error('ECONNRESET'))))
    expect(await new Telegram('tok').sendMessage(1, 'hi')).toBeNull()
  })

  it('sendMessage returns the message_id and passes inline keyboards + truncates >4096', async () => {
    let sent: Record<string, unknown> = {}
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
      sent = JSON.parse(String(init?.body)) as Record<string, unknown>
      return Response.json({ok: true, result: {message_id: 555}})
    }))
    const id = await new Telegram('tok').sendMessage(1, 'x'.repeat(5000), {
      inlineKeyboard: [[{text: 'Go', data: 'rv:p:t1'}]],
    })
    expect(id).toBe(555)
    expect((sent.text as string).length).toBeLessThanOrEqual(4096)
    expect(sent.reply_markup).toEqual({inline_keyboard: [[{text: 'Go', callback_data: 'rv:p:t1'}]]})
  })

  it('editMessageReplyMarkup sends empty keyboard for null and returns true on ok', async () => {
    let sent: Record<string, unknown> = {}
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      expect(String(url)).toContain('/editMessageReplyMarkup')
      sent = JSON.parse(String(init?.body)) as Record<string, unknown>
      return Response.json({ok: true, result: true})
    }))
    expect(await new Telegram('tok').editMessageReplyMarkup(1, 77, null)).toBe(true)
    expect(sent.reply_markup).toEqual({inline_keyboard: []})
  })

  it('editMessageReplyMarkup returns false (never throws) on failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new Error('boom'))))
    expect(await new Telegram('tok').editMessageReplyMarkup(1, 77, [[{text: 'A', data: 'd'}]])).toBe(false)
  })

  it('answerCallbackQuery posts id/text/show_alert and never throws', async () => {
    let sent: Record<string, unknown> = {}
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      expect(String(url)).toContain('/answerCallbackQuery')
      sent = JSON.parse(String(init?.body)) as Record<string, unknown>
      return Response.json({ok: true})
    }))
    expect(await new Telegram('tok').answerCallbackQuery('cb1', {text: 'Nope', showAlert: true})).toBe(true)
    expect(sent).toEqual({callback_query_id: 'cb1', text: 'Nope', show_alert: true})
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new Error('boom'))))
    expect(await new Telegram('tok').answerCallbackQuery('cb1')).toBe(false)
  })

  it('downloadFile resolves file_path then fetches bytes', async () => {
    const calls: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      calls.push(String(url))
      if (String(url).includes('/getFile')) {
        return Response.json({ok: true, result: {file_path: 'photos/f1.jpg'}})
      }
      return new Response(new Uint8Array([1, 2, 3]))
    }))
    const buf = await new Telegram('tok').downloadFile('fid')
    expect(buf.length).toBe(3)
    expect(calls[1]).toBe('https://api.telegram.org/file/bottok/photos/f1.jpg')
  })

  it('downloadFile throws when Telegram says not ok', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ok: false})))
    await expect(new Telegram('tok').downloadFile('fid')).rejects.toThrow(/getFile/)
  })
})
