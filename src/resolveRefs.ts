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

/**
 * Words that name a container or a qualifier rather than the thing itself.
 * "Room" is why `Game room` must not reach `Storage Room`: it is the head of
 * both names and carries none of their meaning. Kept deliberately short — a
 * long list turns a mechanical rule into a private vocabulary.
 */
const GENERIC_WORDS = new Set(['room', 'area', 'space', 'zone', 'place', 'unit', 'set', 'system'])

/**
 * Last resort, and only for amenities: a catalogue entry wins if one of its
 * words appears in the parsed name, that word belongs to no other entry, and
 * it carries meaning of its own. `pool` links "Private pool" to "Swimming
 * Pool"; `view` links nothing, because Sea View and Mountain View both claim
 * it; `room` links nothing, because it names a container.
 *
 * Every hit is returned separately from the confident ones — this is a guess
 * a person is being asked to check, and it must never read as a match.
 */
function looseMatch(docs: TaxDoc[], name: string): string | null {
  const needleTokens = new Set(tokens(name))
  if (needleTokens.size === 0) return null

  const ownersOf = new Map<string, Set<string>>()
  for (const d of docs) {
    for (const n of names(d)) {
      for (const w of tokens(n)) {
        if (w.length < 3 || GENERIC_WORDS.has(w)) continue
        const owners = ownersOf.get(w) ?? new Set<string>()
        owners.add(d._id)
        ownersOf.set(w, owners)
      }
    }
  }

  const hits = new Set<string>()
  for (const w of needleTokens) {
    const owners = ownersOf.get(w)
    if (owners && owners.size === 1) hits.add([...owners][0]!)
  }
  return hits.size === 1 ? [...hits][0]! : null
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
  const looseAmenities: Array<{name: string; id: string}> = []
  for (const name of facts.amenityNames) {
    const id = matchOne(tax.amenities, name)
    if (id) {
      amenityIds.push(id)
      continue
    }
    const loose = looseMatch(tax.amenities, name)
    if (loose && !amenityIds.includes(loose)) {
      amenityIds.push(loose)
      looseAmenities.push({name, id: loose})
    } else if (!loose) {
      unmatched.push(`amenity "${name}"`)
    }
  }

  return {propertyTypeId, cityId, districtId, amenityIds, looseAmenities, unmatched}
}
