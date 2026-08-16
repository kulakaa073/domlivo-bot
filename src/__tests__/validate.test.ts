import {describe, it, expect} from 'vitest'
import {validateFacts} from '../validate.js'
import type {ParsedFacts} from '../types.js'

const facts = (over: Partial<ParsedFacts>): ParsedFacts => ({
  price: null, dealType: null, areaM2: null, bedrooms: null, bathrooms: null,
  floor: null, yearBuilt: null, propertyTypeName: null, cityName: null,
  districtName: null, address: null, amenityNames: [], ...over,
})

describe('validateFacts', () => {
  it('passes a plain EUR sale through untouched', () => {
    const r = validateFacts(facts({price: {amount: 59000, currency: 'EUR', period: 'total'}, dealType: 'sale', areaM2: 76}))
    expect(r.priceEur).toBe(59000)
    expect(r.warnings).toEqual([])
  })

  it('converts lek and says so', () => {
    const r = validateFacts(facts({price: {amount: 5800000, currency: 'ALL', period: 'total'}, dealType: 'sale', areaM2: 80}))
    expect(r.priceEur).toBe(59184)
    expect(r.warnings.some((w) => w.includes('converted'))).toBe(true)
  })

  it('catches the OLD-lek 10x trap: divides and flags for verification', () => {
    // "59 milionë lekë (të vjetra)" — old lek is 10x the official denomination.
    const r = validateFacts(facts({price: {amount: 590000000, currency: 'ALL', period: 'total'}, dealType: 'sale', areaM2: 100}))
    expect(r.priceEur).toBe(602041)
    expect(r.warnings.some((w) => w.toLowerCase().includes('old lek'))).toBe(true)
  })

  it('flags a rent that is far outside bounds instead of storing it silently', () => {
    // The listing parser once misread a 12M-lek sale as a EUR 122,449/month rent.
    const r = validateFacts(facts({price: {amount: 12000000, currency: 'ALL', period: 'per_month'}, dealType: 'rent'}))
    expect(r.warnings.some((w) => w.includes('outside plausible'))).toBe(true)
  })

  it('multiplies per-m2 prices by area, or drops the price when area is missing', () => {
    const withArea = validateFacts(facts({price: {amount: 1200, currency: 'EUR', period: 'per_m2'}, dealType: 'sale', areaM2: 80}))
    expect(withArea.priceEur).toBe(96000)
    const noArea = validateFacts(facts({price: {amount: 1200, currency: 'EUR', period: 'per_m2'}, dealType: 'sale'}))
    expect(noArea.priceEur).toBeNull()
    expect(noArea.warnings.some((w) => w.includes('per m²'))).toBe(true)
  })

  it('flags implausible area, bedrooms, year and missing dealType', () => {
    const r = validateFacts(facts({areaM2: 5, bedrooms: 14, yearBuilt: 1850}))
    expect(r.warnings.some((w) => w.includes('area'))).toBe(true)
    expect(r.warnings.some((w) => w.includes('bedrooms'))).toBe(true)
    expect(r.warnings.some((w) => w.includes('year'))).toBe(true)
    expect(r.warnings.some((w) => w.includes('sale vs rent'))).toBe(true)
  })
})
