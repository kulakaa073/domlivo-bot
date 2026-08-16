import {describe, it, expect} from 'vitest'
import {parseListing, LISTING_SCHEMA, type AnthropicLike} from '../parseListing'

const recordedInput = {
  facts: {
    price: {amount: 59000, currency: 'EUR', period: 'total'},
    dealType: 'sale',
    areaM2: 76,
    bedrooms: 2,
    bathrooms: null,
    floor: 3,
    yearBuilt: null,
    propertyTypeName: 'Apartament',
    cityName: 'Shkodër',
    districtName: 'Parrucë',
    address: null,
    amenityNames: [],
  },
  editorial: {
    title: {en: '2+1 apartment in Parrucë, Shkodër', uk: 'x', ru: 'x', sq: 'x', it: 'x'},
    shortDescription: {en: 'x', uk: 'x', ru: 'x', sq: 'x', it: 'x'},
    description: {en: 'x', uk: 'x', ru: 'x', sq: 'x', it: 'x'},
  },
  sourceLanguage: 'sq',
  parserNotes: '',
}

describe('parseListing', () => {
  it('returns the tool_use input when the call succeeds', async () => {
    const client: AnthropicLike = {
      messages: {
        create: async () => ({
          content: [{type: 'tool_use', id: 't1', name: 'record_listing', input: recordedInput}],
        }),
      },
    }
    const r = await parseListing(client, 'Shitet 2+1 ...', 3)
    expect(r?.facts.price?.amount).toBe(59000)
    expect(r?.editorial.title.en).toMatch(/Parrucë/)
  })

  it('returns null (never throws) on API failure', async () => {
    const client: AnthropicLike = {
      messages: {create: async () => Promise.reject(new Error('529 overloaded'))},
    }
    expect(await parseListing(client, 'x', 0)).toBeNull()
  })

  it('schema requires all five locales on every editorial field', () => {
    const editorial = (LISTING_SCHEMA.properties as Record<string, any>).editorial
    for (const f of ['title', 'shortDescription', 'description']) {
      expect(editorial.properties[f].required).toEqual(['en', 'uk', 'ru', 'sq', 'it'])
    }
  })
})
