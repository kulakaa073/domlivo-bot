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
import {buildReply} from './report.js'
import {M, pickLang} from './messages.js'

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
  const lang = pickLang(first.languageCode)
  const t = M[lang]
  const caption = items.map((i) => i.text).find((x) => x !== null) ?? null
  const photoFileIds = items.flatMap((i) => (i.photoFileId ? [i.photoFileId] : []))

  const auth = await resolveAgent(deps.sanity, senderId)
  if (auth.kind === 'disabled') {
    log('warn', 'refused_disabled', {senderId, username: first.username})
    await deps.telegram.sendMessage(chatId, t.disabled)
    return
  }
  if (auth.kind === 'pending') {
    log('info', 'refused_pending', {senderId, username: first.username})
    await deps.telegram.sendMessage(chatId, t.pending)
    return
  }
  if (auth.kind === 'unknown') {
    log('warn', 'refused_unknown_sender', {senderId, username: first.username})
    await deps.telegram.sendMessage(chatId, t.refusal)
    return
  }

  if (!caption) {
    await deps.telegram.sendMessage(chatId, t.noCaption)
    return
  }

  // Immediate feedback — parse + photo uploads take up to ~half a minute.
  await deps.telegram.sendMessage(chatId, t.working)

  const parsed = await deps.parse(caption, photoFileIds.length)
  if (!parsed) {
    // The parse layer already logged the details.
    await deps.telegram.sendMessage(chatId, t.bareError)
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
    lang,
  )
  await deps.telegram.sendMessage(chatId, reply)
}
