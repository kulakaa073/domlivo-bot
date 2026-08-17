import {describe, it, expect} from 'vitest'
import {DEFAULT_LOCALES, localeLabels, localeObjectSchema, validateLocales} from '../locales.js'
import {buildListingSchema} from '../parseListing.js'

describe('validateLocales', () => {
  it('defaults when absent, dedupes, rejects malformed lists', () => {
    expect(validateLocales(undefined)).toEqual([...DEFAULT_LOCALES])
    expect(validateLocales(['en', 'de', 'en'])).toEqual(['en', 'de'])
    expect(validateLocales(['en'])).toBeNull() // too few
    expect(validateLocales(['en', 'GERMAN'])).toBeNull() // bad code
    expect(validateLocales('en,de')).toBeNull()
    expect(validateLocales(Array.from({length: 11}, (_, i) => `x${i}`))).toBeNull()
  })
})

describe('dynamic locale schemas', () => {
  it('localeObjectSchema requires exactly the given locales', () => {
    const s = localeObjectSchema(['en', 'de']) as {required: string[]; properties: Record<string, unknown>}
    expect(s.required).toEqual(['en', 'de'])
    expect(Object.keys(s.properties)).toEqual(['en', 'de'])
  })

  it('buildListingSchema threads the locales into every editorial field', () => {
    const s = buildListingSchema(['en', 'uk', 'de']) as any
    for (const f of ['title', 'shortDescription', 'description']) {
      expect(s.properties.editorial.properties[f].required).toEqual(['en', 'uk', 'de'])
    }
  })

  it('labels known languages by name and passes unknown codes through', () => {
    expect(localeLabels(['en', 'de'])).toBe('English (en), German (de)')
    expect(localeLabels(['zz'])).toBe('zz')
  })
})
