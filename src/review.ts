import {log} from './log.js'
import type {RedisLike, GroupItem} from './assembly.js'
import type {IncomingCallback} from './telegram/extract.js'
import type {InlineButton} from './telegram/api.js'
import type {SanityCreateIfNotExistsLike, SanityFetchLike} from './resolveAgent.js'
import type {ParsedFacts} from './types.js'
import {M, type Lang, type Messages} from './messages.js'
import {buildPreview, type PreviewData} from './preview.js'
import {computeMissing, missingLabels} from './missing.js'
import {saveReview, loadReview, clearReview, mintToken, cbData, parseCb} from './reviewState.js'
import {resolveRefs} from './resolveRefs.js'
import {createMissingAmenities} from './createAmenities.js'
import {validateFacts} from './validate.js'
import {screenAnswer} from './guard.js'
import {mergeFacts, mergeEditorial, isEmptyUpdate, type UpdateParse} from './parseUpdate.js'
import {draftContentFields} from './buildDraft.js'
import {uploadPhotos, patchDraft, appendGallery, type SanityWriteLike, type SanityPatchLike} from './writeDraft.js'
import {publishDraft, fetchPublishSettings, liveUrl, type SanityPublishLike} from './publish.js'
import {buildReply} from './report.js'

export type ReviewDeps = {
  redis: RedisLike
  sanity: SanityFetchLike & SanityWriteLike & SanityPatchLike & SanityPublishLike & SanityCreateIfNotExistsLike
  telegram: {
    sendMessage(
      chatId: number,
      text: string,
      opts?: {keyboard?: string[][]; inlineKeyboard?: InlineButton[][]},
    ): Promise<number | null>
    editMessageReplyMarkup(chatId: number, messageId: number, kb: InlineButton[][] | null): Promise<boolean>
    answerCallbackQuery(callbackId: string, opts?: {text?: string; showAlert?: boolean}): Promise<boolean>
    downloadFile(fileId: string): Promise<Buffer>
  }
  /** Injected so tests never hit the API: (answer, currentFacts, missingLabels, newPhotoCount) -> UpdateParse | null. */
  parseUpd: (answer: string, current: ParsedFacts, missingLbls: string[], newPhotos: number) => Promise<UpdateParse | null>
  studioBaseUrl: string
  /** Reply keyboard to restore when a flow ends (idle: Add + Restart). */
  idleKeyboard: string[][]
}

export function reviewKeyboard(
  t: Messages,
  mode: 'reviewing' | 'updating',
  allowPublish: boolean,
  token: string,
): InlineButton[][] {
  const first =
    mode === 'updating'
      ? {text: t.btnCancel, data: cbData('c', token)}
      : {text: t.btnUpdate, data: cbData('u', token)}
  const row = allowPublish ? [first, {text: t.btnPost, data: cbData('p', token)}] : [first]
  return [row]
}

export type StartReviewArgs = {
  senderId: number
  chatId: number
  lang: Lang
  /** For photo-asset traceability on update uploads. */
  agentName: string
  draftId: string
  data: PreviewData
}

/** Sends a fresh preview (Message B) with buttons and saves the review context. */
export async function startReview(deps: ReviewDeps, args: StartReviewArgs): Promise<void> {
  const t = M[args.lang]
  const {allowPublish} = await fetchPublishSettings(deps.sanity)
  const token = mintToken()
  const messageId = await deps.telegram.sendMessage(args.chatId, buildPreview(args.data, args.lang), {
    inlineKeyboard: reviewKeyboard(t, 'reviewing', allowPublish, token),
  })
  await saveReview(deps.redis, args.senderId, {
    token,
    draftId: args.draftId,
    chatId: args.chatId,
    previewMessageId: messageId,
    mode: 'reviewing',
    lang: args.lang,
    agentName: args.agentName,
    data: args.data,
  })
  log('info', 'review_started', {senderId: args.senderId, draftId: args.draftId})
}

const studioEditUrl = (studioBaseUrl: string, draftId: string) =>
  `${studioBaseUrl}/intent/edit/id=${draftId.replace(/^drafts\./, '')};type=property`

export async function handleReviewCallback(cb: IncomingCallback, deps: ReviewDeps): Promise<void> {
  const ctx = await loadReview(deps.redis, cb.senderId)
  const parsed = parseCb(cb.data)
  // The sender's Telegram language may drift; the review speaks the language it started in.
  const t = M[ctx?.lang ?? 'en']

  if (!parsed || !ctx || ctx.token !== parsed.token) {
    log('info', 'review_stale_callback', {senderId: cb.senderId, data: cb.data})
    await deps.telegram.answerCallbackQuery(cb.callbackId, {text: t.staleButton, showAlert: true})
    await deps.telegram.editMessageReplyMarkup(cb.chatId, cb.messageId, null)
    return
  }

  const {allowPublish} = await fetchPublishSettings(deps.sanity)

  if (parsed.action === 'update') {
    await deps.telegram.answerCallbackQuery(cb.callbackId)
    await saveReview(deps.redis, cb.senderId, {...ctx, mode: 'updating'})
    await deps.telegram.editMessageReplyMarkup(
      ctx.chatId,
      cb.messageId,
      reviewKeyboard(t, 'updating', allowPublish, ctx.token),
    )
    const missing = missingLabels(computeMissing(ctx.data), t)
    const ask = missing.length > 0 ? t.updAskMissing(missing.join(', ')) : t.updAskFree
    await deps.telegram.sendMessage(ctx.chatId, ask)
    log('info', 'review_update_started', {senderId: cb.senderId, missing: missing.length})
    return
  }

  if (parsed.action === 'cancel') {
    await deps.telegram.answerCallbackQuery(cb.callbackId)
    await saveReview(deps.redis, cb.senderId, {...ctx, mode: 'reviewing'})
    await deps.telegram.editMessageReplyMarkup(
      ctx.chatId,
      cb.messageId,
      reviewKeyboard(t, 'reviewing', allowPublish, ctx.token),
    )
    await deps.telegram.sendMessage(ctx.chatId, t.updResumed)
    return
  }

  // action === 'post'
  if (!allowPublish) {
    await deps.telegram.answerCallbackQuery(cb.callbackId, {text: t.postDisabled, showAlert: true})
    return
  }
  await deps.telegram.answerCallbackQuery(cb.callbackId)

  const result = await publishDraft(deps.sanity, ctx.draftId)

  if (!result.ok && result.reason === 'gone') {
    await clearReview(deps.redis, cb.senderId)
    await deps.telegram.editMessageReplyMarkup(ctx.chatId, cb.messageId, null)
    await deps.telegram.sendMessage(ctx.chatId, t.postGone, {keyboard: deps.idleKeyboard})
    return
  }
  if (!result.ok) {
    const labels = missingLabels(result.missing, t)
    await deps.telegram.sendMessage(ctx.chatId, t.postBlocked(labels.join(', ')))
    return
  }

  await clearReview(deps.redis, cb.senderId)
  await deps.telegram.editMessageReplyMarkup(ctx.chatId, cb.messageId, null)
  const {siteBaseUrl} = await fetchPublishSettings(deps.sanity)
  const text = siteBaseUrl
    ? `${t.postPublished}\n${liveUrl(siteBaseUrl, ctx.lang, result.slug)}`
    : `${t.postNoBaseUrl}\n${studioEditUrl(deps.studioBaseUrl, ctx.draftId)}`
  await deps.telegram.sendMessage(ctx.chatId, text, {keyboard: deps.idleKeyboard})
  log('info', 'review_published', {senderId: cb.senderId, draftId: ctx.draftId, slug: result.slug})
}

/**
 * A message (or assembled album) sent while the sender's review is in
 * 'updating' mode. The caller has already verified the mode.
 */
export async function handleUpdateAnswer(items: GroupItem[], deps: ReviewDeps): Promise<void> {
  const first = items[0]
  if (!first) return
  const ctx = await loadReview(deps.redis, first.senderId)
  if (!ctx || ctx.mode !== 'updating') return
  const t = M[ctx.lang]

  const texts = items.flatMap((i) => (i.text !== null ? [i.text] : []))
  const answer = texts.join('\n\n')
  const photoFileIds = items.flatMap((i) => (i.photoFileId ? [i.photoFileId] : []))

  if (answer && !screenAnswer(answer).ok) {
    log('warn', 'update_answer_rejected', {senderId: first.senderId})
    await deps.telegram.sendMessage(ctx.chatId, t.updNothingParsed)
    return
  }
  if (!answer && photoFileIds.length === 0) {
    await deps.telegram.sendMessage(ctx.chatId, t.updNothingParsed)
    return
  }

  const missing = missingLabels(computeMissing(ctx.data), t)
  const emptyUpd: UpdateParse = {facts: emptyFacts(), editorial: null, parserNotes: ''}
  const upd: UpdateParse = answer
    ? ((await deps.parseUpd(answer, ctx.data.parsed.facts, missing, photoFileIds.length)) ?? emptyUpd)
    : emptyUpd

  if (isEmptyUpdate(upd, photoFileIds.length)) {
    await deps.telegram.sendMessage(ctx.chatId, t.updNothingParsed)
    return
  }

  // Merge, re-resolve, re-validate — same code-path quality gates as intake.
  const mergedFacts = mergeFacts(ctx.data.parsed.facts, upd.facts)
  const mergedEditorial = mergeEditorial(ctx.data.parsed.editorial, upd.editorial)
  const refs = await resolveRefs(deps.sanity, mergedFacts)
  // Same rule as intake: an amenity the catalogue lacks is created flagged and
  // attached, so an update never silently drops one the agent has just added.
  const newAmenities = await createMissingAmenities(deps.sanity, refs.unmatched)
  refs.amenityIds = [...refs.amenityIds, ...newAmenities.ids]
  refs.unmatched = newAmenities.stillUnmatched
  const validation = validateFacts(mergedFacts)

  const {assetIds, failed} = await uploadPhotos(deps.sanity, deps.telegram, photoFileIds, {
    agentName: ctx.agentName,
  })

  const parsed = {
    ...ctx.data.parsed,
    facts: mergedFacts,
    editorial: mergedEditorial,
    parserNotes: upd.parserNotes,
  }

  await patchDraft(deps.sanity, ctx.draftId, {
    set: draftContentFields({parsed, refs, validation, coords: ctx.data.coords}),
  })
  await appendGallery(deps.sanity, ctx.draftId, assetIds, mergedEditorial.title.en, ctx.data.photoCount)

  const data: PreviewData = {
    parsed,
    refs,
    validation,
    photoCount: ctx.data.photoCount + assetIds.length,
    coords: ctx.data.coords,
  }
  log('info', 'review_updated', {senderId: first.senderId, draftId: ctx.draftId, newPhotos: assetIds.length})

  // Fresh Message A (recomputed problems) + fresh Message B; the old preview's buttons die.
  await deps.telegram.sendMessage(
    ctx.chatId,
    buildReply(
      {
        parsed,
        refs,
        validation,
        photoCount: data.photoCount,
        photosFailed: failed,
        draftId: ctx.draftId,
        coords: data.coords,
      },
      deps.studioBaseUrl,
      ctx.lang,
    ),
  )
  if (ctx.previewMessageId !== null) {
    await deps.telegram.editMessageReplyMarkup(ctx.chatId, ctx.previewMessageId, null)
  }
  await startReview(deps, {
    senderId: first.senderId,
    chatId: ctx.chatId,
    lang: ctx.lang,
    agentName: ctx.agentName,
    draftId: ctx.draftId,
    data,
  })
}

function emptyFacts(): ParsedFacts {
  return {
    price: null, dealType: null, areaM2: null, bedrooms: null, bathrooms: null, floor: null,
    yearBuilt: null, propertyTypeName: null, cityName: null, districtName: null, address: null, amenityNames: [],
  }
}
