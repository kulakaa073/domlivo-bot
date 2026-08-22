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
/**
 * Dataset-accurate taxonomy for the matching cases found on 2026-08-22 —
 * note city-tirana carries "Tirana" in every locale (no "Tiranë" anywhere),
 * which is exactly why the Albanian form used to miss.
 */
const realistic = {
  propertyTypes: [{_id: 'propertyType-apartment', title: {en: 'Apartment', sq: 'Apartament'}, slug: 'apartment'}],
  cities: [
    {_id: 'city-tirana', title: {en: 'Tirana', it: 'Tirana', ru: 'Тирана', sq: 'Tirana', uk: 'Тірана'}, slug: 'tirana'},
    {_id: 'city-durres', title: {en: 'Durres', it: 'Durazzo', sq: 'Durrësi'}, slug: 'durres'},
  ],
  districts: [
    {_id: 'district-blloku', title: {en: 'Blloku', sq: 'Blloku'}, slug: 'blloku', cityId: 'city-tirana'},
    {
      _id: 'district-kodra-e-diellit',
      title: {en: 'Kodra e Diellit / Selitë', sq: 'Kodra e Diellit / Selitë'},
      slug: 'kodra-e-diellit',
      cityId: 'city-tirana',
    },
  ],
  amenities: [
    {_id: 'amenity-wifi', title: {en: 'WiFi', sq: 'WiFi'}, slug: 'wifi'},
    {_id: 'amenity-security', title: {en: 'Security', sq: 'Siguri'}, slug: 'security'},
    {_id: 'amenity-pool', title: {en: 'Swimming Pool', sq: 'Pishinë'}, slug: 'swimming-pool'},
    {_id: 'amenity-storage-room', title: {en: 'Storage Room'}, slug: 'storage-room'},
    {_id: 'amenity-sea-view', title: {en: 'Sea View'}, slug: 'sea-view'},
    {_id: 'amenity-mountain-view', title: {en: 'Mountain View'}, slug: 'mountain-view'},
  ],
}

const realSanity = {fetch: async () => realistic}

describe('resolveRefs — wording found in real listings (2026-08-22)', () => {
  it('matches Albanian definite/indefinite city and district forms', async () => {
    const r = await resolveRefs(realSanity, facts({cityName: 'Tiranë', districtName: 'Bllok'}))
    expect(r.cityId).toBe('city-tirana')
    expect(r.districtId).toBe('district-blloku')
    expect(r.unmatched).toEqual([])
  })

  it('matches the indefinite city form against a definite title (Durrës / Durrësi)', async () => {
    const r = await resolveRefs(realSanity, facts({cityName: 'Durrës'}))
    expect(r.cityId).toBe('city-durres')
  })

  it('ignores separators, so spaces match a hyphenated slug and Wi-Fi matches WiFi', async () => {
    const r = await resolveRefs(
      realSanity,
      facts({cityName: 'Tiranë', districtName: 'Kodra e Diellit', amenityNames: ['Wi-Fi']}),
    )
    expect(r.districtId).toBe('district-kodra-e-diellit')
    expect(r.amenityIds).toEqual(['amenity-wifi'])
  })

  it('matches a qualified amenity whose catalogue name is fully contained in it', async () => {
    const r = await resolveRefs(realSanity, facts({amenityNames: ['24h Security']}))
    expect(r.amenityIds).toEqual(['amenity-security'])
  })

  it('refuses a generic shared token: "Game room" is not "Storage Room"', async () => {
    const r = await resolveRefs(realSanity, facts({amenityNames: ['Game room']}))
    expect(r.amenityIds).toEqual([])
    expect(r.unmatched.some((u) => u.includes('Game room'))).toBe(true)
  })

  it('refuses an ambiguous match rather than guessing between two candidates', async () => {
    const r = await resolveRefs(realSanity, facts({amenityNames: ['Sea and mountain view']}))
    expect(r.amenityIds).toEqual([])
    expect(r.unmatched.some((u) => u.includes('Sea and mountain view'))).toBe(true)
  })

  it('leaves a genuinely new amenity unmatched for the review queue', async () => {
    const r = await resolveRefs(realSanity, facts({amenityNames: ['Private pool', 'Sauna']}))
    expect(r.amenityIds).toEqual([])
    expect(r.unmatched).toHaveLength(2)
  })
})

describe('aliases', () => {
  const withAliases = {
    ...realistic,
    amenities: [
      {_id: 'amenity-pool', title: {en: 'Swimming Pool'}, slug: 'swimming-pool', aliases: ['Private pool']},
      {_id: 'amenity-security', title: {en: 'Security'}, slug: 'security'},
    ],
  }

  it('resolves a name a reviewer mapped onto an existing amenity', async () => {
    const r = await resolveRefs({fetch: async () => withAliases}, facts({amenityNames: ['Private pool']}))
    expect(r.amenityIds).toEqual(['amenity-pool'])
    expect(r.unmatched).toEqual([])
  })

  it('refuses an alias claimed by two amenities instead of picking one', async () => {
    const clashing = {
      ...realistic,
      amenities: [
        {_id: 'amenity-pool', title: {en: 'Swimming Pool'}, slug: 'swimming-pool', aliases: ['Water']},
        {_id: 'amenity-sea-view', title: {en: 'Sea View'}, slug: 'sea-view', aliases: ['Water']},
      ],
    }
    const r = await resolveRefs({fetch: async () => clashing}, facts({amenityNames: ['Water']}))
    expect(r.amenityIds).toEqual([])
    expect(r.unmatched).toHaveLength(1)
  })
})
