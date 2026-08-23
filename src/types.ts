export type LocaleMap = {en: string; uk: string; ru: string; sq: string; it: string}

export type ParsedFacts = {
  price: {amount: number; currency: 'EUR' | 'ALL' | 'USD'; period: 'total' | 'per_m2' | 'per_month'} | null
  dealType: 'sale' | 'rent' | null
  areaM2: number | null
  bedrooms: number | null
  /** Total habitable rooms — bedrooms plus living rooms, the count behind Albanian X+1 and Russian X-комнатная. */
  rooms: number | null
  bathrooms: number | null
  floor: number | null
  yearBuilt: number | null
  propertyTypeName: string | null
  cityName: string | null
  districtName: string | null
  address: string | null
  amenityNames: string[]
}

export type ParsedListing = {
  facts: ParsedFacts
  editorial: {title: LocaleMap; shortDescription: LocaleMap; description: LocaleMap}
  sourceLanguage: string
  parserNotes: string
}

export type ResolvedRefs = {
  propertyTypeId: string | null
  cityId: string | null
  districtId: string | null
  amenityIds: string[]
  /** Guessed by the last-resort pass — a person must confirm these. */
  looseAmenities: Array<{name: string; id: string}>
  /** Human-readable notes like `district "Rus i madh" not matched` — surfaced in the reply. */
  unmatched: string[]
}

export type ValidationResult = {priceEur: number | null; warnings: string[]}

export type Outcome = {
  parsed: ParsedListing
  refs: ResolvedRefs
  validation: ValidationResult
  photoCount: number
  photosFailed: number
  /** Amenity names intake created on sight for this listing. */
  createdAmenities?: string[]
  /** Cities or districts the catalogue lacks — recorded as requests for staff. */
  missingLocations?: string[]
  draftId: string
  /** Set when a Google Maps link in the message yielded a plausible pin. */
  coords: {lat: number; lng: number} | null
}
