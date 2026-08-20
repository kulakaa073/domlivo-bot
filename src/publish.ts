import type {SanityFetchLike} from './resolveAgent.js'
import type {MissingField} from './missing.js'
import type {Lang} from './messages.js'

export type TxnLike = {
  createOrReplace(doc: Record<string, unknown>): TxnLike
  delete(id: string): TxnLike
  commit(): Promise<unknown>
}

export type SanityPublishLike = SanityFetchLike & {transaction(): TxnLike}

export type GateResult = {ok: true} | {ok: false; missing: MissingField[]}

const refId = (v: unknown): string | null =>
  v && typeof v === 'object' && typeof (v as {_ref?: unknown})._ref === 'string' ? (v as {_ref: string})._ref : null

/**
 * Minimum publishable set, evaluated on the DRAFT DOC (re-read from Sanity, so
 * Studio edits count). Blocking: title.en, price, deal, type, city, ≥1 photo.
 * agent and slug are bot-written and cannot be missing from a bot draft; the
 * gate checks visitor-facing content only.
 */
export function publishGate(draft: Record<string, unknown>): GateResult {
  const missing: MissingField[] = []
  const title = draft.title as {en?: string} | undefined
  if (!title?.en?.trim()) missing.push('title')
  if (typeof draft.price !== 'number' || draft.price <= 0) missing.push('price')
  if (typeof draft.status !== 'string' || !draft.status) missing.push('deal')
  if (!refId(draft.type)) missing.push('type')
  if (!refId(draft.city)) missing.push('city')
  const gallery = draft.gallery
  if (!Array.isArray(gallery) || gallery.length === 0) missing.push('photos')
  return missing.length > 0 ? {ok: false, missing} : {ok: true}
}

const SLUG_TAKEN_QUERY =
  `count(*[_type == "property" && slug.current == $slug && _id != $pubId && _id != $draftId])`

/** Returns base, or base-2, base-3, … — the first slug no other property holds. */
export async function uniqueSlug(sanity: SanityFetchLike, base: string, draftId: string): Promise<string> {
  const pubId = draftId.replace(/^drafts\./, '')
  for (let i = 1; i < 100; i++) {
    const slug = i === 1 ? base : `${base}-${i}`
    const taken = (await sanity.fetch(SLUG_TAKEN_QUERY, {slug, pubId, draftId})) as number
    if (!taken) return slug
  }
  return `${base}-${Date.now()}`
}

export type PublishResult =
  | {ok: true; slug: string}
  | {ok: false; reason: 'gone'}
  | {ok: false; reason: 'gate'; missing: MissingField[]}

/**
 * Publish = createOrReplace at the published id (isPublished true, lifecycle
 * active — the frontend's PUBLISHED_PROPERTY_FILTER contract) + delete the
 * draft, in one transaction.
 */
export async function publishDraft(sanity: SanityPublishLike, draftId: string): Promise<PublishResult> {
  const draft = (await sanity.fetch(`*[_id == $id][0]`, {id: draftId})) as Record<string, unknown> | null
  if (!draft) return {ok: false, reason: 'gone'}

  const gate = publishGate(draft)
  if (!gate.ok) return {ok: false, reason: 'gate', missing: gate.missing}

  const baseSlug = (draft.slug as {current?: string} | undefined)?.current || 'listing'
  const slug = await uniqueSlug(sanity, baseSlug, draftId)

  const pub: Record<string, unknown> = {
    ...draft,
    _id: draftId.replace(/^drafts\./, ''),
    slug: {_type: 'slug', current: slug},
    isPublished: true,
    lifecycleStatus: 'active',
  }
  delete pub._rev
  delete pub._createdAt
  delete pub._updatedAt

  await sanity.transaction().createOrReplace(pub).delete(draftId).commit()
  return {ok: true, slug}
}

/** siteBaseUrl + botAllowPublish from siteSettings — both default safe. */
export async function fetchPublishSettings(
  sanity: SanityFetchLike,
): Promise<{siteBaseUrl: string | null; allowPublish: boolean}> {
  const s = (await sanity.fetch(`*[_type == "siteSettings"][0]{siteBaseUrl, botAllowPublish}`)) as {
    siteBaseUrl?: string
    botAllowPublish?: boolean
  } | null
  return {
    siteBaseUrl: s?.siteBaseUrl?.trim().replace(/\/+$/, '') || null,
    allowPublish: s?.botAllowPublish === true,
  }
}

export function liveUrl(base: string, lang: Lang, slug: string): string {
  return `${base}/${lang}/property/${slug}`
}
