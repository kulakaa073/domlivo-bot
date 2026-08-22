import type {SanityFetchLike} from './resolveAgent.js'
import type {ParsedFacts, ResolvedRefs} from './types.js'

/** "Parrucë" -> "parruce" — same diacritic trap the listing parser handled. */
export function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

/**
 * Separator-blind key: "Kodra e Diellit", "kodra-e-diellit" and
 * "Kodra_e_Diellit" collapse to the same string, as do "Wi-Fi" and "WiFi".
 */
function tight(s: string): string {
  return fold(s).replace(/[^\p{L}\p{N}]+/gu, '')
}

/**
 * Albanian marks the definite form with a final vowel — Tiranë/Tirana,
 * Bllok/Blloku, Durrës/Durrësi — and a listing uses whichever the seller wrote
 * while the dataset stores one of them. Dropping that vowel leaves a stem the
 * two forms share. Deliberately crude: consulted only after the exact key
 * missed, and only when it produces exactly one candidate.
 */
function stem(s: string): string {
  return tight(s).replace(/(ja|[aeiu])$/, '')
}

function tokens(s: string): string[] {
  return fold(s)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
}

type TaxDoc = {
  _id: string
  title?: Record<string, string | undefined> | null
  slug?: string | null
  cityId?: string | null
  /** Reviewer-approved alternative names — see the amenity review queue spec. */
  aliases?: string[] | null
}

const TAXONOMY_QUERY = `{
  "propertyTypes": *[_type == "propertyType"]{_id, title, "slug": slug.current},
  "cities": *[_type == "city"]{_id, title, "slug": slug.current},
  "districts": *[_type == "district"]{_id, title, "slug": slug.current, "cityId": city._ref},
  "amenities": *[_type == "amenity"]{_id, title, "slug": slug.current, aliases}
}`

/**
 * Every name a document answers to: its slug, each title locale, and any alias
 * a reviewer has approved. Aliases go through the same three passes and the
 * same uniqueness rule as everything else, so one that would match two
 * documents makes both ambiguous rather than picking a winner.
 */
function names(d: TaxDoc): string[] {
  const out: string[] = []
  if (d.slug) out.push(d.slug)
  for (const v of Object.values(d.title ?? {})) {
    if (typeof v === 'string' && v.trim()) out.push(v)
  }
  for (const a of d.aliases ?? []) {
    if (typeof a === 'string' && a.trim()) out.push(a)
  }
  return out
}

/** Exactly one hit is a match; none or several is a miss the caller reports. */
function only(hits: TaxDoc[]): string | null {
  return hits.length === 1 ? hits[0]!._id : null
}

/**
 * Three passes, each narrower than a human would be and each requiring a
 * unique winner, so an unclear name is reported rather than guessed:
 *
 * 1. exact on the separator-blind key;
 * 2. Albanian definite/indefinite stem (needle stems of 4+ characters only);
 * 3. the catalogue name's words all appear in the listing's wording —
 *    "Security" inside "24h Security". Never the reverse: "Game room" must not
 *    reach "Storage Room" through the one generic word they share.
 */
function matchOne(docs: TaxDoc[], name: string): string | null {
  const needle = tight(name)
  if (!needle) return null

  const exact = docs.filter((d) => names(d).some((n) => tight(n) === needle))
  if (exact.length > 0) return only(exact)

  const needleStem = stem(name)
  if (needleStem.length >= 4) {
    const stemmed = docs.filter((d) => names(d).some((n) => stem(n) === needleStem))
    if (stemmed.length > 0) return only(stemmed)
  }

  const needleTokens = new Set(tokens(name))
  const contained = docs.filter((d) =>
    names(d).some((n) => {
      const t = tokens(n)
      return t.length > 0 && t.every((w) => needleTokens.has(w))
    }),
  )
  return only(contained)
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
