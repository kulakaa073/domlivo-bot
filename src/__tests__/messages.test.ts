import {describe, it, expect} from 'vitest'
import {M, pickLang, type Lang} from '../messages.js'

const LANGS: Lang[] = ['en', 'uk', 'ru', 'sq', 'it']

describe('pickLang', () => {
  it('maps telegram language_code to supported locales, defaulting to en', () => {
    expect(pickLang('uk')).toBe('uk')
    expect(pickLang('ru-RU')).toBe('ru')
    expect(pickLang('sq')).toBe('sq')
    expect(pickLang('it-IT')).toBe('it')
    expect(pickLang('de')).toBe('en')
    expect(pickLang(null)).toBe('en')
    expect(pickLang(undefined)).toBe('en')
  })
})

describe('message tables', () => {
  it('every locale has every message filled', () => {
    for (const lang of LANGS) {
      const t = M[lang]
      for (const [k, v] of Object.entries(t)) {
        if (typeof v === 'string') expect(v.length, `${lang}.${k}`).toBeGreaterThan(0)
      }
      expect(t.greeting('X')).toContain('X')
      expect(t.photosFailed(2)).toContain('2')
      for (const [k, v] of Object.entries(t.fields)) {
        expect(v.length, `${lang}.fields.${k}`).toBeGreaterThan(0)
      }
    }
  })
})
