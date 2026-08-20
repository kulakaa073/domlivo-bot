import {describe, it, expect} from 'vitest'
import {buildDraft, draftContentFields, slugify} from '../buildDraft.js'
import {fullOutcome} from './fixtures/outcome.js'
import type {ParsedListing, ResolvedRefs, ValidationResult} from '../types.js'

const parsed: ParsedListing = {
  facts: {
    price: {amount: 59000, currency: 'EUR', period: 'total'},
    dealType: 'sale', areaM2: 76, bedrooms: 2, bathrooms: 1, floor: 3,
    yearBuilt: null, propertyTypeName: 'Apartament', cityName: 'Shkodër',
    districtName: 'Parrucë', address: 'Rruga e Parrucës', amenityNames: ['Elevator'],
  },
  editorial: {
    title: {en: '2+1 Apartment in Parrucë, Shkodër', uk: 'у', ru: 'р', sq: 'ш', it: 'и'},
    shortDescription: {en: 's', uk: 's', ru: 's', sq: 's', it: 's'},
    description: {en: 'd', uk: 'd', ru: 'd', sq: 'd', it: 'd'},
  },
  sourceLanguage: 'sq',
  parserNotes: '',
}

const refs: ResolvedRefs = {
  propertyTypeId: 'pt-apartment', cityId: 'city-shkoder',
  districtId: 'district-parruce', amenityIds: ['amenity-elevator'], unmatched: [],
}

const validation: ValidationResult = {priceEur: 59000, warnings: []}

describe('slugify', () => {
  it('folds diacritics, lowercases, dashes, and caps at 96', () => {
    expect(slugify('2+1 Apartment in Parrucë, Shkodër')).toBe('2-1-apartment-in-parruce-shkoder')
    expect(slugify('x'.repeat(200)).length).toBeLessThanOrEqual(96)
  })
})

describe('buildDraft', () => {
  const doc = buildDraft({parsed, refs, validation, agentId: 'agent-1', assetIds: ['img-1', 'img-2']}, 'fixed-uuid')

  it('is a draft, unpublished, in review lifecycle', () => {
    expect(doc._id).toBe('drafts.property-tg-fixed-uuid')
    expect(doc._type).toBe('property')
    expect(doc.isPublished).toBe(false)
    expect(doc.lifecycleStatus).toBe('draft')
  })

  it('fills required schema fields', () => {
    expect(doc.title).toEqual(parsed.editorial.title)
    expect(doc.slug).toEqual({_type: 'slug', current: '2-1-apartment-in-parruce-shkoder'})
    expect(doc.agent).toEqual({_type: 'reference', _ref: 'agent-1'})
    expect(doc.type).toEqual({_type: 'reference', _ref: 'pt-apartment'})
    expect(doc.status).toBe('sale')
    expect(doc.price).toBe(59000)
    expect(doc.city).toEqual({_type: 'reference', _ref: 'city-shkoder'})
  })

  it('writes map-link coordinates when provided, omits them otherwise', () => {
    const withPin = buildDraft(
      {parsed, refs, validation, agentId: 'agent-1', assetIds: [], coords: {lat: 40.3251, lng: 19.4712}},
      'u3',
    )
    expect(withPin.coordinatesLat).toBe(40.3251)
    expect(withPin.coordinatesLng).toBe(19.4712)
    expect('coordinatesLat' in doc).toBe(false)
  })

  it('builds the gallery with keys and alt text', () => {
    const gallery = doc.gallery as Array<Record<string, unknown>>
    expect(gallery.length).toBe(2)
    expect(gallery[0]).toMatchObject({
      _type: 'image',
      _key: 'tg-0',
      asset: {_type: 'reference', _ref: 'img-1'},
      alt: '2+1 Apartment in Parrucë, Shkodër — photo 1',
    })
  })

  it('omits what is unknown instead of writing empty values', () => {
    const bare = buildDraft(
      {
        parsed: {...parsed, facts: {...parsed.facts, dealType: null, address: null}},
        refs: {...refs, propertyTypeId: null, cityId: null, districtId: null, amenityIds: []},
        validation: {priceEur: null, warnings: []},
        agentId: 'agent-1',
        assetIds: [],
      },
      'u2',
    )
    expect('type' in bare).toBe(false)
    expect('city' in bare).toBe(false)
    expect('district' in bare).toBe(false)
    expect('price' in bare).toBe(false)
    expect('status' in bare).toBe(false)
    expect('address' in bare).toBe(false)
    expect('gallery' in bare).toBe(false)
  })
})

describe('draftContentFields', () => {
  it('returns content fields only - no identity/agent/gallery/slug keys', () => {
    const o = fullOutcome()
    const fields = draftContentFields({parsed: o.parsed, refs: o.refs, validation: o.validation, coords: null})
    expect(fields.title).toEqual(o.parsed.editorial.title)
    expect(fields.price).toBe(145000)
    expect(fields.status).toBe('sale')
    expect(fields.city).toEqual({_type: 'reference', _ref: 'c1'})
    expect(fields).not.toHaveProperty('_id')
    expect(fields).not.toHaveProperty('_type')
    expect(fields).not.toHaveProperty('slug')
    expect(fields).not.toHaveProperty('agent')
    expect(fields).not.toHaveProperty('gallery')
    expect(fields).not.toHaveProperty('isPublished')
  })

  it('omits unknown values instead of writing them empty', () => {
    const o = fullOutcome()
    o.refs.cityId = null
    o.validation.priceEur = null
    const fields = draftContentFields({parsed: o.parsed, refs: o.refs, validation: o.validation, coords: null})
    expect(fields).not.toHaveProperty('city')
    expect(fields).not.toHaveProperty('price')
  })
})
