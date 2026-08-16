import type {SanityFetchLike} from './resolveAgent.js'
import type {ParsedFacts, ResolvedRefs} from './types.js'

/** "Parrucë" -> "parruce" — same diacritic trap the listing parser handled. */
export function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

type TaxDoc = {
  _id: string
  title?: Record<string, string | undefined> | null
  slug?: string | null
  cityId?: string | null
}

const TAXONOMY_QUERY = `{
  "propertyTypes": *[_type == "propertyType"]{_id, title, "slug": slug.current},
  "cities": *[_type == "city"]{_id, title, "slug": slug.current},
  "districts": *[_type == "district"]{_id, title, "slug": slug.current, "cityId": city._ref},
  "amenities": *[_type == "amenity"]{_id, title, "slug": slug.current}
}`

function candidates(d: TaxDoc): string[] {
  const out: string[] = []
  if (d.slug) out.push(fold(d.slug))
  for (const v of Object.values(d.title ?? {})) {
    if (typeof v === 'string' && v.trim()) out.push(fold(v))
  }
  return out
}

function matchOne(docs: TaxDoc[], name: string): string | null {
  const needle = fold(name)
  if (!needle) return null
  const hit = docs.find((d) => candidates(d).includes(needle))
  return hit ? hit._id : null
}

/** Code, not AI: names -> existing doc ids. Never creates taxonomy documents. */
export async function resolveRefs(sanity: SanityFetchLike, facts: ParsedFacts): Promise<ResolvedRefs> {
  const tax = (await sanity.fetch(TAXONOMY_QUERY)) as {
    propertyTypes: TaxDoc[]
    cities: TaxDoc[]
    districts: TaxDoc[]
    amenities: TaxDoc[]
  }
  const unmatched: string[] = []

  const propertyTypeId = facts.propertyTypeName ? matchOne(tax.propertyTypes, facts.propertyTypeName) : null
  if (facts.propertyTypeName && !propertyTypeId) unmatched.push(`property type "${facts.propertyTypeName}"`)

  const cityId = facts.cityName ? matchOne(tax.cities, facts.cityName) : null
  if (facts.cityName && !cityId) unmatched.push(`city "${facts.cityName}"`)

  const districtPool = cityId ? tax.districts.filter((d) => d.cityId === cityId) : tax.districts
  const districtId = facts.districtName ? matchOne(districtPool, facts.districtName) : null
  if (facts.districtName && !districtId) unmatched.push(`district "${facts.districtName}"`)

  const amenityIds: string[] = []
  for (const name of facts.amenityNames) {
    const id = matchOne(tax.amenities, name)
    if (id) amenityIds.push(id)
    else unmatched.push(`amenity "${name}"`)
  }

  return {propertyTypeId, cityId, districtId, amenityIds, unmatched}
}
