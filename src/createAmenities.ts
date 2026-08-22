import {log, errInfo} from './log.js'
import type {SanityCreateIfNotExistsLike} from './resolveAgent.js'

/**
 * An amenity the catalogue does not have yet is created on sight, flagged for
 * review, and attached to the listing immediately — the listing is right from
 * the first parse and the taxonomy catches up afterwards. Nothing flagged
 * reaches the site: the frontend queries exclude it until a person clears the
 * flag. See SPEC-amenity-autocreate-2026-08-22.md.
 *
 * Published, never a draft. `resolveRefs` runs a token query, which returns
 * drafts, so a draft amenity would be matched by the next parse and referenced
 * by its `drafts.` id — a broken reference in published content.
 */

/** One listing cannot reshape the catalogue, however creative the parse. */
export const MAX_NEW_AMENITIES_PER_LISTING = 8

const MIN_LENGTH = 2
const MAX_LENGTH = 60
const ALLOWED = /^[\p{L}\p{N} .,&/'’-]+$/u
/** Four or more digits in a row is a phone number or a price, not an amenity. */
const DIGIT_RUN = /\d[\d\s()-]{3,}/

export type NormalizedAmenity = {ok: true; name: string; key: string} | {ok: false}

export function normalizeAmenityName(raw: string): NormalizedAmenity {
  const name = (raw ?? '').replace(/\s+/g, ' ').trim()
  if (name.length < MIN_LENGTH || name.length > MAX_LENGTH) return {ok: false}
  if (!ALLOWED.test(name)) return {ok: false}
  if (!/\p{L}/u.test(name)) return {ok: false}
  if (DIGIT_RUN.test(name)) return {ok: false}
  const key = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '')
  if (!key) return {ok: false}
  return {ok: true, name, key}
}

export function amenityDocFor(n: {ok: true; name: string; key: string}): Record<string, unknown> & {
  _id: string
  _type: string
} {
  return {
    _id: `amenity-${n.key}`,
    _type: 'amenity',
    title: {_type: 'localizedString', en: n.name},
    slug: {_type: 'slug', current: n.key},
    active: true,
    needsReview: true,
  }
}

/** The endpoint and the bot both report misses as `amenity "Sauna"`. */
function amenityNamesIn(unmatched: readonly string[]): string[] {
  const out: string[] = []
  for (const entry of unmatched) {
    const m = /^amenity\s+"(.+)"$/.exec(entry ?? '')
    if (m && m[1]!.trim()) out.push(m[1]!)
  }
  return out
}

export type CreatedAmenities = {
  /** Ids to attach to the listing, in the order the names appeared. */
  ids: string[]
  /** Names that became new amenities — reported so a person knows to look. */
  created: string[]
  /** Entries left unresolved: other kinds, refused shapes, failed writes. */
  stillUnmatched: string[]
}

export async function createMissingAmenities(
  sanity: SanityCreateIfNotExistsLike,
  unmatched: readonly string[],
): Promise<CreatedAmenities> {
  const ids: string[] = []
  const created: string[] = []
  const stillUnmatched = unmatched.filter((u) => !/^amenity\s+".+"$/.test(u ?? ''))
  const seen = new Set<string>()

  for (const raw of amenityNamesIn(unmatched)) {
    const n = normalizeAmenityName(raw)
    if (!n.ok) {
      stillUnmatched.push(`amenity "${raw}"`)
      continue
    }
    if (seen.has(n.key)) continue
    if (ids.length >= MAX_NEW_AMENITIES_PER_LISTING) {
      stillUnmatched.push(`amenity "${raw}"`)
      continue
    }
    seen.add(n.key)
    const doc = amenityDocFor(n)
    try {
      await sanity.createIfNotExists(doc)
      ids.push(doc._id)
      created.push(n.name)
    } catch (e) {
      // A listing must not be lost because the catalogue write failed.
      log('error', 'amenity_create_failed', {name: n.name, ...errInfo(e)})
      stillUnmatched.push(`amenity "${raw}"`)
    }
  }

  return {ids, created, stillUnmatched}
}
