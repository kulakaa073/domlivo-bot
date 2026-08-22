import type {ParsedListing, ResolvedRefs, ValidationResult} from '../../types.js'

const loc = (s: string) => ({en: s, uk: s, ru: s, sq: s, it: s})

/** A complete, publishable-looking pipeline outcome. Tests mutate copies to poke holes in it. */
export function fullOutcome(): {
  parsed: ParsedListing
  refs: ResolvedRefs
  validation: ValidationResult
  photoCount: number
} {
  return {
    parsed: {
      facts: {
        price: {amount: 145000, currency: 'EUR', period: 'total'},
        dealType: 'sale',
        areaM2: 78,
        bedrooms: 2,
        bathrooms: 1,
        floor: 3,
        yearBuilt: 2019,
        propertyTypeName: 'Apartament',
        cityName: 'Tirana',
        districtName: 'Liqeni i Thatë',
        address: null,
        amenityNames: ['Elevator', 'Parking'],
      },
      editorial: {
        title: loc('Modern 2+1 apartment near the lake'),
        shortDescription: loc('A bright two-bedroom apartment.'),
        description: loc('A bright two-bedroom apartment near the lake with parking.'),
      },
      sourceLanguage: 'sq',
      parserNotes: '',
    },
    refs: {propertyTypeId: 'pt1', cityId: 'c1', districtId: 'd1', amenityIds: ['a1'],
    looseAmenities: [], unmatched: ['amenity "Parking"']},
    validation: {priceEur: 145000, warnings: []},
    photoCount: 6,
  }
}
