import {describe, it, expect} from 'vitest'
import {saveReview, loadReview, clearReview, mintToken, cbData, parseCb, type ReviewContext} from '../reviewState.js'
import type {RedisLike} from '../assembly.js'
import {fullOutcome} from './fixtures/outcome.js'

function fakeRedis(): RedisLike & {store: Map<string, string>} {
  const store = new Map<string, string>()
  return {
    store,
    set: async (k, v) => (store.set(k, v), 'OK'),
    get: async (k) => store.get(k) ?? null,
    rpush: async () => 0,
    lrange: async () => [],
    expire: async () => 1,
    del: async (k) => (store.delete(k) ? 1 : 0),
  }
}

function ctx(): ReviewContext {
  return {
    token: 'tok12345',
    draftId: 'drafts.property-tg-x',
    chatId: 42,
    previewMessageId: 77,
    mode: 'reviewing',
    lang: 'en',
    agentName: 'Test Agent',
    data: {...fullOutcome(), coords: null},
  }
}

describe('review context store', () => {
  it('round-trips and clears', async () => {
    const r = fakeRedis()
    await saveReview(r, 42, ctx())
    expect(await loadReview(r, 42)).toEqual(ctx())
    await clearReview(r, 42)
    expect(await loadReview(r, 42)).toBeNull()
  })

  it('returns null for corrupt JSON', async () => {
    const r = fakeRedis()
    r.store.set('review:42', '{nope')
    expect(await loadReview(r, 42)).toBeNull()
  })
})

describe('callback data', () => {
  it('mints short unique tokens', () => {
    const a = mintToken()
    expect(a).toMatch(/^[a-f0-9]{8}$/)
    expect(mintToken()).not.toBe(a)
  })

  it('encodes and parses actions, staying under 64 bytes', () => {
    expect(cbData('u', 'tok12345')).toBe('rv:u:tok12345')
    expect(cbData('u', 'tok12345').length).toBeLessThanOrEqual(64)
    expect(parseCb('rv:u:tok12345')).toEqual({action: 'update', token: 'tok12345'})
    expect(parseCb('rv:p:tok12345')).toEqual({action: 'post', token: 'tok12345'})
    expect(parseCb('rv:c:tok12345')).toEqual({action: 'cancel', token: 'tok12345'})
    expect(parseCb('junk')).toBeNull()
    expect(parseCb('rv:x:tok')).toBeNull()
  })
})
