import {describe, it, expect} from 'vitest'
import {isDuplicate, addToGroup, claimGroup, type RedisLike, type GroupItem} from '../assembly.js'

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
  }
}

const item = (n: number): GroupItem => ({
  photoFileId: `f${n}`,
  text: n === 1 ? 'caption on first item' : null,
  senderId: 111,
  chatId: 111,
  username: null,
})

describe('dedupe', () => {
  it('flags the second delivery of the same update_id', async () => {
    const r = fakeRedis()
    expect(await isDuplicate(r, 900001)).toBe(false)
    expect(await isDuplicate(r, 900001)).toBe(true)
  })
})

describe('media-group assembly (latest-writer rule)', () => {
  it('only the last writer claims the group, and gets every item', async () => {
    const r = fakeRedis()
    await addToGroup(r, 'mg-777', 900002, item(1))
    await addToGroup(r, 'mg-777', 900003, item(2))
    await addToGroup(r, 'mg-777', 900004, item(3))
    expect(await claimGroup(r, 'mg-777', 900002)).toBeNull()
    expect(await claimGroup(r, 'mg-777', 900003)).toBeNull()
    const items = await claimGroup(r, 'mg-777', 900004)
    expect(items?.length).toBe(3)
    expect(items?.[0]?.text).toBe('caption on first item')
  })

  it('a claimed group cannot be claimed twice', async () => {
    const r = fakeRedis()
    await addToGroup(r, 'mg-9', 1, item(1))
    expect(await claimGroup(r, 'mg-9', 1)).not.toBeNull()
    expect(await claimGroup(r, 'mg-9', 1)).toBeNull()
  })
})
