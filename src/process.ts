import {randomUUID} from 'node:crypto'
import {log} from './log.js'
import type {GroupItem} from './assembly.js'
import type {Telegram} from './telegram/api.js'
import type {ParsedListing} from './types.js'
import {resolveAgent, type SanityFetchLike} from './resolveAgent.js'
import {resolveRefs} from './resolveRefs.js'
import {validateFacts} from './validate.js'
import {buildDraft} from './buildDraft.js'
import {uploadPhotos, createDraft, type SanityWriteLike} from './writeDraft.js'
import {buildReply, BARE_ERROR, REFUSAL, DISABLED, PENDING} from './report.js'

export type PipelineDeps = {
  studioBaseUrl: string
  sanity: SanityFetchLike & SanityWriteLike
  telegram: Pick<Telegram, 'sendMessage' | 'downloadFile'>
  /** (caption, photoCount) -> ParsedListing | null. Injected so tests never hit the API. */
  parse: (caption: string, photoCount: number) => Promise<ParsedListing | null>
}

/**
 * The whole listing pipeline for one message or assembled album. Throws only
 * for truly unexpected errors — the webhook catches those, logs in detail, and
 * sends BARE_ERROR.
 */
export async function processMessage(items: GroupItem[], deps: PipelineDeps): Promise<void> {
  const first = items[0]
  if (!first) return
  const {chatId, senderId} = first
  const caption = items.map((i) => i.text).find((t) => t !== null) ?? null
  const photoFileIds = items.flatMap((i) => (i.photoFileId ? [i.photoFileId] : []))

  const auth = await resolveAgent(deps.sanity, senderId)
  if (auth.kind === 'disabled') {
    log('warn', 'refused_disabled', {senderId, username: first.username})
    await deps.telegram.sendMessage(chatId, DISABLED)
    return
  }
  if (auth.kind === 'pending') {
    log('info', 'refused_pending', {senderId, username: first.username})
    await deps.telegram.sendMessage(chatId, PENDING)
    return
  }
  if (auth.kind === 'unknown') {
    log('warn', 'refused_unknown_sender', {senderId, username: first.username})
    await deps.telegram.sendMessage(chatId, REFUSAL)
    return
  }

  if (!caption) {
    await deps.telegram.sendMessage(
      chatId,
      'Please include the listing description as the caption of the photos, then send again.',
    )
    return
  }

  const parsed = await deps.parse(caption, photoFileIds.length)
  if (!parsed) {
    // The parse layer already logged the details.
    await deps.telegram.sendMessage(chatId, BARE_ERROR)
    return
  }

  const refs = await resolveRefs(deps.sanity, parsed.facts)
  const validation = validateFacts(parsed.facts)
  const {assetIds, failed} = await uploadPhotos(deps.sanity, deps.telegram, photoFileIds, {
    agentName: auth.agentName,
  })

  const doc = buildDraft({parsed, refs, validation, agentId: auth.agentId, assetIds}, randomUUID())
  await createDraft(deps.sanity, doc)
  log('info', 'draft_created', {
    draftId: doc._id,
    senderId,
    agentId: auth.agentId,
    photos: assetIds.length,
    photosFailed: failed,
    warnings: validation.warnings.length,
    unmatched: refs.unmatched.length,
  })

  const reply = buildReply(
    {parsed, refs, validation, photoCount: assetIds.length, photosFailed: failed, draftId: String(doc._id)},
    deps.studioBaseUrl,
  )
  await deps.telegram.sendMessage(chatId, reply)
}
