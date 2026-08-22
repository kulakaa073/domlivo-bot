import {describe, it, expect} from 'vitest'
import {buildReply, BARE_ERROR, REFUSAL, DISABLED} from '../report.js'
import type {Outcome} from '../types.js'

const base: Outcome = {
  parsed: {
    facts: {
      price: {amount: 59000, currency: 'EUR', period: 'total'},
      dealType: 'sale', areaM2: 76, bedrooms: 2, bathrooms: 1, floor: 3,
      yearBuilt: null, propertyTypeName: 'Apartament', cityName: 'Shkodër',
      districtName: 'Parrucë', address: null, amenityNames: [],
    },
    editorial: {
      title: {en: '2+1 Apartment in Parrucë, Shkodër', uk: 'u', ru: 'r', sq: 's', it: 'i'},
      shortDescription: {en: 's', uk: 's', ru: 's', sq: 's', it: 's'},
      description: {en: 'd', uk: 'd', ru: 'd', sq: 'd', it: 'd'},
    },
    sourceLanguage: 'sq',
    parserNotes: '',
  },
  refs: {propertyTypeId: 'pt-1', cityId: 'city-1', districtId: 'd-1', amenityIds: [],
    looseAmenities: [], unmatched: []},
  validation: {priceEur: 59000, warnings: []},
  photoCount: 8,
  photosFailed: 0,
  draftId: 'drafts.property-tg-abc',
  coords: null,
}

describe('buildReply', () => {
  it('summarizes and links the draft without the drafts. prefix', () => {
    const r = buildReply(base, 'https://domlivo.sanity.studio')
    expect(r).toContain('2+1 Apartment in Parrucë, Shkodër')
    expect(r).toContain('€59,000')
    expect(r).toContain('8 photos')
    expect(r).toContain('https://domlivo.sanity.studio/intent/edit/id=property-tg-abc;type=property')
    expect(r).not.toContain('⚠')
  })

  it('enumerates every missing checklist item, unmatched name and warning', () => {
    const sparse: Outcome = {
      ...base,
      parsed: {...base.parsed, facts: {...base.parsed.facts, price: null, dealType: null, areaM2: null, bedrooms: null}},
      refs: {...base.refs, propertyTypeId: null, cityId: null, unmatched: ['district "Rus i madh"']},
      validation: {priceEur: null, warnings: ['could not tell sale vs rent — set the Status field in Studio']},
      photoCount: 0,
      photosFailed: 2,
    }
    const r = buildReply(sparse, 'https://s')
    for (const bit of ['price', 'sale or rent', 'property type', 'city', 'area', 'bedrooms', 'photos']) {
      expect(r.toLowerCase()).toContain(bit)
    }
    expect(r).toContain('Rus i madh')
    expect(r).toContain('2 photo(s) failed')
  })

  it('mentions coordinates when a map link supplied them', () => {
    const withPin = buildReply({...base, coords: {lat: 40.3251, lng: 19.4712}}, 'https://s')
    expect(withPin).toContain('📍')
    expect(buildReply(base, 'https://s')).not.toContain('📍')
  })

  it('bare messages carry no internals', () => {
    for (const m of [BARE_ERROR, REFUSAL, DISABLED]) {
      expect(m).not.toMatch(/stack|error:|env|sanity|anthropic/i)
    }
  })
})
