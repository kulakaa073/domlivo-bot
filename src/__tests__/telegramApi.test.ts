import {describe, it, expect, vi, afterEach} from 'vitest'
import {Telegram} from '../telegram/api.js'

afterEach(() => vi.unstubAllGlobals())

describe('Telegram', () => {
  it('sendMessage returns false (never throws) on HTTP failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', {status: 500})))
    const ok = await new Telegram('tok').sendMessage(1, 'hi')
    expect(ok).toBe(false)
  })

  it('sendMessage returns false (never throws) on network error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new Error('ECONNRESET'))))
    expect(await new Telegram('tok').sendMessage(1, 'hi')).toBe(false)
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
