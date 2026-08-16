import {describe, it, expect} from 'vitest'
import {fold, resolveRefs} from '../resolveRefs.js'
import type {ParsedFacts} from '../types.js'

const taxonomy = {
  propertyTypes: [{_id: 'pt-apartment', title: {en: 'Apartment', sq: 'Apartament'}, slug: 'apartment'}],
  cities: [
    {_id: 'city-shkoder', title: {en: 'Shkoder', sq: 'Shkodër', ru: 'Шкодер'}, slug: 'shkoder'},
    {_id: 'city-tirana', title: {en: 'Tirana', sq: 'Tiranë'}, slug: 'tirana'},
  ],
  districts: [
    {_id: 'district-parruce', title: {en: 'Parruce', sq: 'Parrucë'}, slug: 'parruce', cityId: 'city-shkoder'},
    {_id: 'district-qender-tirana', title: {en: 'Center'}, slug: 'qender', cityId: 'city-tirana'},
  ],
  amenities: [
    {_id: 'amenity-elevator', title: {en: 'Elevator', sq: 'Ashensor'}, slug: 'elevator'},
    {_id: 'amenity-parking', title: {en: 'Parking'}, slug: 'parking'},
  ],
}

const sanity = {fetch: async () => taxonomy}

const facts = (over: Partial<ParsedFacts>): ParsedFacts => ({
  price: null, dealType: null, areaM2: null, bedrooms: null, bathrooms: null,
  floor: null, yearBuilt: null, propertyTypeName: null, cityName: null,
  districtName: null, address: null, amenityNames: [], ...over,
})

describe('fold', () => {
  it('strips diacritics and case', () => {
    expect(fold('Parrucë')).toBe(fold('parruce'))
    expect(fold('Shkodër')).toBe('shkoder')
  })
})

describe('resolveRefs', () => {
  it('matches city, district (scoped to the city) and type across locales', async () => {
    const r = await resolveRefs(sanity, facts({cityName: 'Shkodër', districtName: 'Parruce', propertyTypeName: 'Apartament'}))
    expect(r.cityId).toBe('city-shkoder')
    expect(r.districtId).toBe('district-parruce')
    expect(r.propertyTypeId).toBe('pt-apartment')
    expect(r.unmatched).toEqual([])
  })

  it('does not match a district belonging to a different city', async () => {
    const r = await resolveRefs(sanity, facts({cityName: 'Shkodër', districtName: 'Center'}))
    expect(r.districtId).toBeNull()
    expect(r.unmatched.some((u) => u.includes('Center'))).toBe(true)
  })

  it('reports unmatched names instead of inventing documents', async () => {
    const r = await resolveRefs(sanity, facts({cityName: 'Atlantis', amenityNames: ['Elevator', 'Teleport']}))
    expect(r.cityId).toBeNull()
    expect(r.amenityIds).toEqual(['amenity-elevator'])
    expect(r.unmatched.some((u) => u.includes('Atlantis'))).toBe(true)
    expect(r.unmatched.some((u) => u.includes('Teleport'))).toBe(true)
  })
})
