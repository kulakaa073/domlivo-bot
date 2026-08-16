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
}

const ref = (id: string) => ({_type: 'reference', _ref: id})

/**
 * Pure assembly of the property draft. Unknown values are OMITTED, not written
 * empty — Studio's own validation then marks what the human must complete.
 * Deviation from the spec noted here: isPublished is set to false explicitly
 * (not left unset) because parts of the frontend gate on `isPublished != false`,
 * where unset counts as published.
 */
export function buildDraft(input: DraftInput, uuid: string): Record<string, unknown> {
  const {parsed, refs, validation, agentId, assetIds} = input
  const f = parsed.facts
  const titleEn = parsed.editorial.title.en

  const doc: Record<string, unknown> = {
    _id: `drafts.property-tg-${uuid}`,
    _type: 'property',
    title: parsed.editorial.title,
    slug: {_type: 'slug', current: slugify(titleEn)},
    shortDescription: parsed.editorial.shortDescription,
    description: parsed.editorial.description,
    agent: ref(agentId),
    isPublished: false,
    lifecycleStatus: 'draft',
    createdAt: new Date().toISOString(),
  }

  if (refs.propertyTypeId) doc.type = ref(refs.propertyTypeId)
  if (f.dealType) doc.status = f.dealType
  if (validation.priceEur !== null) doc.price = validation.priceEur
  if (refs.cityId) doc.city = ref(refs.cityId)
  if (refs.districtId) doc.district = ref(refs.districtId)
  if (f.address) doc.address = {_type: 'localizedString', en: f.address}
  if (f.areaM2 !== null) doc.area = f.areaM2
  if (f.bedrooms !== null) doc.bedrooms = f.bedrooms
  if (f.bathrooms !== null) doc.bathrooms = f.bathrooms
  if (f.yearBuilt !== null) doc.yearBuilt = f.yearBuilt
  if (refs.amenityIds.length > 0) {
    doc.amenitiesRefs = refs.amenityIds.map((id) => ({...ref(id), _key: id}))
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
