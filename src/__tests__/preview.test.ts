import {describe, it, expect} from 'vitest'
import {buildPreview} from '../preview.js'
import {fullOutcome} from './fixtures/outcome.js'

describe('buildPreview', () => {
  it('renders the complete preview in site order', () => {
    const o = fullOutcome()
    const p = buildPreview({...o, coords: {lat: 41.32, lng: 19.82}}, 'en')
    const lines = p.split('\n')
    expect(lines[0]).toBe('🏠 Modern 2+1 apartment near the lake')
    expect(lines[1]).toBe('📍 Liqeni i Thatë, Tirana')
    expect(lines[2]).toBe('🛏 2 · 🛁 1 · ↔ 78 m²')
    expect(lines[3]).toBe('💶 €145,000 · For sale')
    expect(p).toContain('📅 Built 2019')
    expect(p).toContain('🏢 Floor 3')
    expect(p).toContain('🔑 Amenities: Elevator') // matched only
    expect(p).not.toContain('Parking') // unmatched amenity excluded
    expect(p).toContain('🖼 6 photo(s) uploaded')
    expect(p).toContain('📍 Map pin set')
    expect(p).toContain('Short description:\nA bright two-bedroom apartment.')
    expect(p).toContain('Description:\nA bright two-bedroom apartment near the lake with parking.')
  })

  it('uses the sender locale with en fallback, and em-dashes for absent values', () => {
    const o = fullOutcome()
    o.parsed.editorial.title.uk = 'Сучасна квартира 2+1 біля озера'
    o.parsed.editorial.shortDescription.uk = ''
    o.refs.cityId = null
    o.refs.districtId = null
    o.validation.priceEur = null
    o.parsed.facts.dealType = null
    const p = buildPreview({...o, coords: null}, 'uk')
    expect(p).toContain('🏠 Сучасна квартира 2+1 біля озера')
    expect(p).toContain('📍 —')
    expect(p).toContain('💶 — · —')
    expect(p).toContain('📍 Мітки на мапі немає')
    expect(p).toContain('A bright two-bedroom apartment.') // en fallback for empty uk shortDescription
  })

  it('omits fully absent optional lines and truncates long descriptions', () => {
    const o = fullOutcome()
    o.parsed.facts.yearBuilt = null
    o.parsed.facts.floor = null
    o.refs.amenityIds = []
    o.parsed.facts.amenityNames = []
    o.parsed.editorial.description.en = 'w'.repeat(3000)
    const p = buildPreview({...o, coords: null}, 'en')
    expect(p).not.toContain('📅')
    expect(p).not.toContain('🏢')
    expect(p).not.toContain('🔑')
    expect(p).toContain('… (full text in Studio)')
    expect(p.length).toBeLessThan(2500)
  })
})
