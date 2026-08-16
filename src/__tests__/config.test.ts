import {describe, it, expect} from 'vitest'
import {loadConfig} from '../config'

const FULL = {
  TELEGRAM_BOT_TOKEN: 't',
  TELEGRAM_WEBHOOK_SECRET: 's',
  ANTHROPIC_API_KEY: 'a',
  SANITY_WRITE_TOKEN: 'w',
  UPSTASH_REDIS_REST_URL: 'https://x.upstash.io',
  UPSTASH_REDIS_REST_TOKEN: 'u',
  STUDIO_BASE_URL: 'https://domlivo.sanity.studio/',
}

describe('loadConfig', () => {
  it('reports every missing var instead of throwing', () => {
    const r = loadConfig({})
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.missing).toContain('TELEGRAM_BOT_TOKEN')
      expect(r.missing).toContain('STUDIO_BASE_URL')
      expect(r.missing.length).toBe(7)
    }
  })

  it('loads with defaults for project id and dataset', () => {
    const r = loadConfig(FULL)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.config.sanity.projectId).toBe('g4aqp6ex')
      expect(r.config.sanity.dataset).toBe('production')
      expect(r.config.studioBaseUrl).toBe('https://domlivo.sanity.studio')
    }
  })

  it('treats blank strings as missing', () => {
    const r = loadConfig({...FULL, ANTHROPIC_API_KEY: '  '})
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.missing).toEqual(['ANTHROPIC_API_KEY'])
  })
})
