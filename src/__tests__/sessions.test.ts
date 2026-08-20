import {describe, it, expect} from 'vitest'
import {openSession, isSessionOpen, addSessionItem, collectSession, closeSession, tally, detectAction} from '../sessions.js'
import type {RedisLike, GroupItem} from '../assembly.js'

function fakeRedis(): RedisLike {
  const kv = new Map<string, string>()
  const lists = new Map<string, string[]>()
  return {
    async set(key, value, opts) {
      if (opts?.nx && kv.has(key)) return null
      kv.set(key, value)
      return 'OK'
    },
    async get(key) {
      return kv.get(key) ?? null
    },
    async rpush(key, value) {
      const l = lists.get(key) ?? []
      l.push(value)
      lists.set(key, l)
      return l.length
    },
    async lrange(key, start, stop) {
      const l = lists.get(key) ?? []
      return l.slice(start, stop === -1 ? undefined : stop + 1)
    },
    async expire() {
      return 1
    },
    async del(key) {
      const had = kv.delete(key) || lists.delete(key)
      return had ? 1 : 0
    },
  }
}

const item = (over: Partial<GroupItem>): GroupItem => ({
  photoFileId: null,
  text: null,
  senderId: 111,
  chatId: 111,
  username: null,
  languageCode: null,
  ...over,
})

describe('sessions', () => {
  it('collects items only while open, and submit drains everything', async () => {
    const r = fakeRedis()
    expect(await isSessionOpen(r, 111)).toBe(false)
    expect(await collectSession(r, 111)).toBeNull()

    await openSession(r, 111)
    await addSessionItem(r, 111, item({photoFileId: 'f1'}))
    await addSessionItem(r, 111, item({photoFileId: 'f2'}))
    await addSessionItem(r, 111, item({text: 'shitet 2+1'}))

    const items = await collectSession(r, 111)
    expect(items?.length).toBe(3)
    expect(tally(items!)).toEqual({photos: 2, texts: 1})

    await closeSession(r, 111)
    expect(await isSessionOpen(r, 111)).toBe(false)
    expect(await collectSession(r, 111)).toBeNull()
  })

  it('reopening a session discards the previous pile', async () => {
    const r = fakeRedis()
    await openSession(r, 111)
    await addSessionItem(r, 111, item({text: 'stale'}))
    await openSession(r, 111)
    expect((await collectSession(r, 111))?.length).toBe(0)
  })

  it('sessions are per sender', async () => {
    const r = fakeRedis()
    await openSession(r, 111)
    expect(await isSessionOpen(r, 222)).toBe(false)
  })
})

describe('detectAction', () => {
  it('matches emoji-prefixed localized labels and slash equivalents', () => {
    expect(detectAction('➕ Add property')).toBe('add')
    expect(detectAction('➕ Додати обʼєкт')).toBe('add')
    expect(detectAction('✅ Dërgo')).toBe('submit')
    expect(detectAction('❌ Annulla')).toBe('cancel')
    expect(detectAction('/submit')).toBe('submit')
    expect(detectAction('/new')).toBe('add')
    expect(detectAction('/cancel')).toBe('cancel')
  })

  it('ignores ordinary listing text', () => {
    expect(detectAction('Shitet apartament 2+1')).toBeNull()
    expect(detectAction(null)).toBeNull()
    expect(detectAction('')).toBeNull()
  })
})

describe('detectAction restart', () => {
  it('detects the restart button and /restart command', () => {
    expect(detectAction('🔄 Restart')).toBe('restart')
    expect(detectAction('🔄 Сначала')).toBe('restart')
    expect(detectAction('/restart')).toBe('restart')
    expect(detectAction('please restart')).toBeNull()
  })
})
