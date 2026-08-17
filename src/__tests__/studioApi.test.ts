import {describe, it, expect} from 'vitest'
import {allowedOrigin, gateStudioRequest, translateFields, type TranslateItem} from '../studioApi.js'
import type {RedisLike} from '../assembly.js'
import type {AnthropicLike} from '../parseListing.js'

function fakeRedis(): RedisLike {
  const lists = new Map<string, string[]>()
  return {
    async set() {
      return 'OK'
    },
    async get() {
      return null
    },
    async rpush(key, value) {
      const l = lists.get(key) ?? []
      l.push(value)
      lists.set(key, l)
      return l.length
    },
    async lrange() {
      return []
    },
    async expire() {
      return 1
    },
    async del() {
      return 1
    },
  }
}

describe('allowedOrigin', () => {
  it('allows *.sanity.studio and localhost by default, nothing else', () => {
    expect(allowedOrigin('https://domlivo.sanity.studio', undefined)).toBe('https://domlivo.sanity.studio')
    expect(allowedOrigin('http://localhost:3333', undefined)).toBe('http://localhost:3333')
    expect(allowedOrigin('https://evil.example.com', undefined)).toBeNull()
    expect(allowedOrigin('http://fake.sanity.studio', undefined)).toBeNull() // https only
    expect(allowedOrigin(undefined, undefined)).toBeNull()
  })

  it('an explicit STUDIO_ORIGINS list replaces the default rule', () => {
    expect(allowedOrigin('https://my.example.com', 'https://my.example.com, http://localhost:3333')).toBe(
      'https://my.example.com',
    )
    expect(allowedOrigin('https://domlivo.sanity.studio', 'https://my.example.com')).toBeNull()
  })
})

describe('gateStudioRequest', () => {
  const env = {STUDIO_API_SECRET: 's3cret'}
  const origin = 'https://domlivo.sanity.studio'

  it('accepts a valid origin + secret and rate-limits after 30/min', async () => {
    const redis = fakeRedis()
    for (let i = 0; i < 30; i++) {
      const r = await gateStudioRequest({origin, secretHeader: 's3cret', redis, env, minute: 1})
      expect(r.ok).toBe(true)
    }
    const r31 = await gateStudioRequest({origin, secretHeader: 's3cret', redis, env, minute: 1})
    expect(r31.ok).toBe(false)
    if (!r31.ok) expect(r31.status).toBe(429)
  })

  it('rejects bad secret (401), bad origin (403), missing config (503)', async () => {
    const redis = fakeRedis()
    const bad = await gateStudioRequest({origin, secretHeader: 'wrong', redis, env, minute: 2})
    expect(!bad.ok && bad.status).toBe(401)
    const foreign = await gateStudioRequest({origin: 'https://evil.dev', secretHeader: 's3cret', redis, env, minute: 2})
    expect(!foreign.ok && foreign.status).toBe(403)
    const unconfigured = await gateStudioRequest({origin, secretHeader: 's3cret', redis, env: {}, minute: 2})
    expect(!unconfigured.ok && unconfigured.status).toBe(503)
  })
})

describe('translateFields', () => {
  const items: TranslateItem[] = [{key: 'title', kind: 'string', text: 'Qendër'}]

  it('returns tool_use items on success and null on failure', async () => {
    const good: AnthropicLike = {
      messages: {
        create: async () => ({
          content: [
            {
              type: 'tool_use',
              id: 't',
              name: 'record_translations',
              input: {items: [{key: 'title', locales: {en: 'Center', uk: 'Центр', ru: 'Центр', sq: 'Qendër', it: 'Centro'}}]},
            },
          ],
        }),
      },
    }
    const r = await translateFields(good, 'sq', items)
    expect(r?.[0]?.locales.it).toBe('Centro')

    const bad: AnthropicLike = {messages: {create: async () => Promise.reject(new Error('overloaded'))}}
    expect(await translateFields(bad, 'sq', items)).toBeNull()
  })
})
