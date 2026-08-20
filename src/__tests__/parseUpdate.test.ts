import {describe, it, expect} from 'vitest'
import {parseUpdate, mergeFacts, mergeEditorial, isEmptyUpdate, type UpdateParse} from '../parseUpdate.js'
import type {AnthropicLike} from '../parseListing.js'
import type {ParsedFacts} from '../types.js'

const emptyFacts: ParsedFacts = {
  price: null, dealType: null, areaM2: null, bedrooms: null, bathrooms: null,
  floor: null, yearBuilt: null, propertyTypeName: null, cityName: null,
  districtName: null, address: null, amenityNames: [],
}

const current: ParsedFacts = {
  ...emptyFacts,
  dealType: 'sale',
  areaM2: 78,
  cityName: 'Tirana',
  amenityNames: ['Elevator'],
}

function fakeClient(toolInput: unknown): AnthropicLike & {lastParams: Record<string, unknown>} {
  const c = {
    lastParams: {} as Record<string, unknown>,
    messages: {
      create: async (params: Record<string, unknown>) => {
        c.lastParams = params
        return {content: [{type: 'tool_use', input: toolInput}]}
      },
    },
  }
  return c
}

describe('parseUpdate', () => {
  it('returns the tool payload and includes current facts + missing list in the prompt', async () => {
    const payload: UpdateParse = {
      facts: {...emptyFacts, price: {amount: 120000, currency: 'EUR', period: 'total'}, bedrooms: 3},
      editorial: null,
      parserNotes: '',
    }
    const client = fakeClient(payload)
    const out = await parseUpdate(client, 'price 120000, 3 bedrooms', current, ['price', 'bedrooms'], 0)
    expect(out).toEqual(payload)
    const userMsg = JSON.stringify((client.lastParams.messages as unknown[])[0])
    expect(userMsg).toContain('price 120000')
    expect(userMsg).toContain('Tirana') // current facts included
    expect(userMsg).toContain('bedrooms') // missing list included
  })

  it('returns null when the call fails', async () => {
    const client: AnthropicLike = {
      messages: {
        create: async () => {
          throw new Error('api down')
        },
      },
    }
    expect(await parseUpdate(client, 'x', current, [], 0)).toBeNull()
  })
})

describe('mergeFacts', () => {
  it('non-null update fields win; others keep current values; amenities append-dedupe', () => {
    const upd: ParsedFacts = {...emptyFacts, bedrooms: 3, cityName: 'Durrës', amenityNames: ['Elevator', 'Parking']}
    const merged = mergeFacts(current, upd)
    expect(merged.bedrooms).toBe(3)
    expect(merged.cityName).toBe('Durrës')
    expect(merged.dealType).toBe('sale') // untouched
    expect(merged.areaM2).toBe(78) // untouched
    expect(merged.amenityNames).toEqual(['Elevator', 'Parking'])
  })
})

describe('mergeEditorial', () => {
  const loc = (s: string) => ({en: s, uk: s, ru: s, sq: s, it: s})
  it('replaces only the provided fields', () => {
    const cur = {title: loc('Old'), shortDescription: loc('Short'), description: loc('Long')}
    const merged = mergeEditorial(cur, {description: loc('New long')})
    expect(merged.title.en).toBe('Old')
    expect(merged.description.en).toBe('New long')
  })
  it('null editorial keeps everything', () => {
    const cur = {title: loc('Old'), shortDescription: loc('S'), description: loc('D')}
    expect(mergeEditorial(cur, null)).toEqual(cur)
  })
})

describe('isEmptyUpdate', () => {
  it('true when no facts, no editorial, no new photos', () => {
    expect(isEmptyUpdate({facts: emptyFacts, editorial: null, parserNotes: ''}, 0)).toBe(true)
    expect(isEmptyUpdate({facts: emptyFacts, editorial: null, parserNotes: ''}, 2)).toBe(false)
    expect(isEmptyUpdate({facts: {...emptyFacts, bedrooms: 1}, editorial: null, parserNotes: ''}, 0)).toBe(false)
  })
})
