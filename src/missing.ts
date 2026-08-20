import type {ParsedListing, ResolvedRefs, ValidationResult} from './types.js'
import type {Messages} from './messages.js'

export type MissingField = 'title' | 'price' | 'deal' | 'type' | 'city' | 'area' | 'bedrooms' | 'photos'

export type MissingInput = {
  parsed: ParsedListing
  refs: ResolvedRefs
  validation: ValidationResult
  photoCount: number
}

/** Single source of truth for "what the draft still lacks" — used by the reply, the review flow, and the Update prompt. */
export function computeMissing(o: MissingInput): MissingField[] {
  const f = o.parsed.facts
  const missing: MissingField[] = []
  if (!o.parsed.editorial.title.en) missing.push('title')
  if (o.validation.priceEur === null) missing.push('price')
  if (!f.dealType) missing.push('deal')
  if (!o.refs.propertyTypeId) missing.push('type')
  if (!o.refs.cityId) missing.push('city')
  if (f.areaM2 === null) missing.push('area')
  if (f.bedrooms === null) missing.push('bedrooms')
  if (o.photoCount === 0) missing.push('photos')
  return missing
}

export function missingLabels(missing: MissingField[], t: Messages): string[] {
  return missing.map((m) => t.fields[m])
}
