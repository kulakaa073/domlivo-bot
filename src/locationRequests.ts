import {log, errInfo} from './log.js'
import type {SanityCreateIfNotExistsLike, SanityFetchLike} from './resolveAgent.js'

/**
 * A city or district the catalogue does not have cannot be stubbed the way an
 * amenity can: a zone carries a country reference, a slug that becomes a public
 * route, SEO copy and metrics, and it only goes live through the readiness gate
 * in SPEC-zone-generation. Inventing one from a listing would put a half-built
 * place into the site's geography.
 *
 * So intake does the two honest things instead: it leaves the field empty — the
 * listing cannot be published without a city anyway — and it records a request
 * staff can act on, with the listing titles that asked for it.
 *
 * The document id is derived from kind + folded name, so the same place asked
 * for twice is one row with a count, not two.
 */

export type LocationKind = 'city' | 'district'

const MIN_LENGTH = 2
const MAX_LENGTH = 60
const ALLOWED = /^[\p{L}\p{N} .,'’/-]+$/u
const DIGIT_RUN = /\d[\d\s()-]{3,}/

export type NormalizedLocation = {ok: true; name: string; key: string} | {ok: false}

export function normalizeLocationName(raw: string): NormalizedLocation {
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
  return key ? {ok: true, name, key} : {ok: false}
}

export function locationRequestId(kind: LocationKind, key: string): string {
  return `location-request-${kind}-${key}`
}

/** Both intake routes report misses as `city "Tiranë"` / `district "Bllok"`. */
export function unresolvedLocations(unmatched: readonly string[]): Array<{kind: LocationKind; name: string}> {
  const out: Array<{kind: LocationKind; name: string}> = []
  for (const entry of unmatched) {
    const m = /^(city|district)\s+"(.+)"$/.exec(entry ?? '')
    if (m && m[2]!.trim()) out.push({kind: m[1] as LocationKind, name: m[2]!})
  }
  return out
}

export type LocationRequestPlan = {
  id: string
  kind: LocationKind
  name: string
  key: string
}

export function planLocationRequests(unmatched: readonly string[]): LocationRequestPlan[] {
  const seen = new Set<string>()
  const plans: LocationRequestPlan[] = []
  for (const {kind, name} of unresolvedLocations(unmatched)) {
    const n = normalizeLocationName(name)
    if (!n.ok) continue
    const id = locationRequestId(kind, n.key)
    if (seen.has(id)) continue
    seen.add(id)
    plans.push({id, kind, name: n.name, key: n.key})
  }
  return plans
}

export type RecordDeps = SanityCreateIfNotExistsLike &
  SanityFetchLike & {
    patch(id: string, ops: Record<string, unknown>): {commit(): Promise<unknown>}
  }

/**
 * Records each request and bumps its count. Never throws: a listing must not be
 * lost because the request write failed — the reply already tells the agent
 * what happened, and the log carries the failure.
 */
export async function recordLocationRequests(
  sanity: RecordDeps,
  unmatched: readonly string[],
  context: {listingTitle: string; source: 'telegram' | 'studio'; now: string},
): Promise<string[]> {
  const plans = planLocationRequests(unmatched)
  const recorded: string[] = []
  for (const plan of plans) {
    try {
      await sanity.createIfNotExists({
        _id: plan.id,
        _type: 'locationRequest',
        kind: plan.kind,
        name: plan.name,
        normalized: plan.key,
        count: 0,
        status: 'new',
        source: context.source,
        firstSeen: context.now,
        lastSeen: context.now,
        // Only the first listing is kept as context: the count already carries
        // how often the place is asked for, and appending on every hit would
        // grow this array without bound.
        examples: [context.listingTitle],
      })
      await sanity
        .patch(plan.id, {
          inc: {count: 1},
          set: {lastSeen: context.now},
        })
        .commit()
      recorded.push(`${plan.kind} "${plan.name}"`)
    } catch (e) {
      log('error', 'location_request_failed', {kind: plan.kind, name: plan.name, ...errInfo(e)})
    }
  }
  return recorded
}
