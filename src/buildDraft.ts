import type {ParsedListing, ResolvedRefs, ValidationResult} from './types.js'

export function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96)
    .replace(/-+$/, '')
}

export type DraftInput = {
  parsed: ParsedListing
  refs: ResolvedRefs
  validation: ValidationResult
  agentId: string
  assetIds: string[]
  /** From a Google Maps link in the message, already bounds-checked. */
  coords?: {lat: number; lng: number} | null
}

const ref = (id: string) => ({_type: 'reference', _ref: id})

export type DraftContentInput = {
  parsed: ParsedListing
  refs: ResolvedRefs
  validation: ValidationResult
  coords?: {lat: number; lng: number} | null
}

/**
 * The content fields shared by draft creation and update patches. Unknown
 * values are OMITTED, not written empty — Studio's own validation then marks
 * what the human must complete. Excludes identity (_id/_type/slug), agent,
 * publish flags, and gallery — those belong to creation / appendGallery.
 */
export function draftContentFields(input: DraftContentInput): Record<string, unknown> {
  const {parsed, refs, validation, coords} = input
  const f = parsed.facts
  // `_type` is stamped so Studio tooling that discovers localized fields by
  // value shape (e.g. the Translate document action) sees these — Sanity
  // accepts the objects without it, but only the form editor would heal it.
  const doc: Record<string, unknown> = {
    title: {_type: 'localizedString', ...parsed.editorial.title},
    shortDescription: {_type: 'localizedText', ...parsed.editorial.shortDescription},
    description: {_type: 'localizedText', ...parsed.editorial.description},
  }
  if (refs.propertyTypeId) doc.type = ref(refs.propertyTypeId)
  if (f.dealType) doc.status = f.dealType
  if (validation.priceEur !== null) doc.price = validation.priceEur
  if (refs.cityId) doc.city = ref(refs.cityId)
  if (refs.districtId) doc.district = ref(refs.districtId)
  if (f.address) doc.address = {_type: 'localizedString', en: f.address}
  if (coords) {
    doc.coordinatesLat = coords.lat
    doc.coordinatesLng = coords.lng
  }
  if (f.areaM2 !== null) doc.area = f.areaM2
  if (f.bedrooms !== null) doc.bedrooms = f.bedrooms
  if (f.rooms !== null) doc.rooms = f.rooms
  if (f.bathrooms !== null) doc.bathrooms = f.bathrooms
  if (f.yearBuilt !== null) doc.yearBuilt = f.yearBuilt
  if (refs.amenityIds.length > 0) {
    doc.amenitiesRefs = refs.amenityIds.map((id) => ({...ref(id), _key: id}))
  }
  return doc
}

/**
 * Pure assembly of the property draft. The slug is minted here once and
 * deliberately never changed by the update flow.
 * Deviation from the spec noted here: isPublished is set to false explicitly
 * (not left unset) because parts of the frontend gate on `isPublished != false`,
 * where unset counts as published.
 */
export function buildDraft(input: DraftInput, uuid: string): Record<string, unknown> {
  const {parsed, agentId, assetIds} = input
  const titleEn = parsed.editorial.title.en

  const doc: Record<string, unknown> = {
    _id: `drafts.property-tg-${uuid}`,
    _type: 'property',
    ...draftContentFields(input),
    slug: {_type: 'slug', current: slugify(titleEn)},
    agent: ref(agentId),
    isPublished: false,
    lifecycleStatus: 'draft',
    createdAt: new Date().toISOString(),
  }

  if (assetIds.length > 0) {
    doc.gallery = assetIds.map((assetId, i) => ({
      _type: 'image',
      _key: `tg-${i}`,
      asset: ref(assetId),
      alt: `${titleEn} — photo ${i + 1}`,
    }))
  }

  return doc
}
