import {log, errInfo} from './log.js'
import type {SanityFetchLike} from './resolveAgent.js'

/**
 * Two listings with the same generated title mint the same slug — likely
 * enough, given titles are built from a fixed pattern over a small vocabulary
 * of districts and room counts. The Studio path resolves this under the
 * editor's session; this is the same rule for the Telegram path.
 *
 * `pickFreeSlug` mirrors `cms/lib/studioAi/slug.ts`, pinned by a test to the
 * same outputs: the two intake routes must not disagree about what a free slug
 * looks like.
 */
export function pickFreeSlug(base: string, taken: readonly string[]): string {
  const used = new Set(taken)
  if (!used.has(base)) return base
  for (let n = 2; n < 1000; n++) {
    const candidate = `${base}-${n}`
    if (!used.has(candidate)) return candidate
  }
  return `${base}-${Date.now()}`
}

const TAKEN_QUERY =
  '*[_type == "property" && defined(slug.current) && (slug.current == $base || slug.current match $pattern)].slug.current'

/**
 * Drafts count as taken — a draft is a URL someone is about to claim.
 *
 * A failed lookup returns the base slug rather than throwing: an intake bot
 * that drops a listing because a uniqueness query timed out is worse than one
 * that occasionally leaves an editor a slug to fix.
 */
export async function resolveUniqueSlug(sanity: SanityFetchLike, base: string): Promise<string> {
  try {
    const taken = (await sanity.fetch(TAKEN_QUERY, {base, pattern: `${base}-*`})) as unknown
    if (!Array.isArray(taken)) return base
    return pickFreeSlug(
      base,
      taken.filter((s): s is string => typeof s === 'string'),
    )
  } catch (e) {
    log('warn', 'slug_uniqueness_check_failed', {base, ...errInfo(e)})
    return base
  }
}
