import type {VercelRequest, VercelResponse} from '@vercel/node'
import {waitUntil} from '@vercel/functions'
import Anthropic from '@anthropic-ai/sdk'
import {createClient} from '@sanity/client'
import {loadConfig, type BotConfig} from '../src/config.js'
import {log, errInfo} from '../src/log.js'
import {
  extractIncoming,
  extractCallback,
  type TgUpdate,
  type Incoming,
  type IncomingCallback,
} from '../src/telegram/extract.js'
import {Telegram} from '../src/telegram/api.js'
import {makeRedis} from '../src/redisClient.js'
import {isDuplicate, addToGroup, claimGroup, sleep, type GroupItem, type RedisLike} from '../src/assembly.js'
import {
  openSession,
  isSessionOpen,
  addSessionItem,
  collectSession,
  closeSession,
  tally,
  detectAction,
} from '../src/sessions.js'
import {processMessage} from '../src/process.js'
import {parseListing, type AnthropicLike} from '../src/parseListing.js'
import {parseUpdate} from '../src/parseUpdate.js'
import {resolveAgent, fileAccessRequest} from '../src/resolveAgent.js'
import {BARE_ERROR} from '../src/report.js'
import {M, pickLang} from '../src/messages.js'
import {
  startReview,
  handleReviewCallback,
  handleUpdateAnswer,
  type ReviewDeps,
  type StartReviewArgs,
} from '../src/review.js'
import {loadReview, clearReview} from '../src/reviewState.js'

const GROUP_DEBOUNCE_MS = 3000

/** Heavy work to run after the 200 (album assembly, the listing pipeline). */
type Deferred = (() => Promise<void>) | null

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  // Telegram must ALWAYS get a 200 — anything else triggers redelivery storms.
  // Every failure path below: detailed log line + bare user message when possible.
  if (req.method !== 'POST') {
    res.status(405).end()
    return
  }
  const update = req.body as TgUpdate | undefined

  const cfg = loadConfig()
  if (!cfg.ok) {
    log('error', 'config_missing', {missing: cfg.missing})
    const token = process.env.TELEGRAM_BOT_TOKEN?.trim()
    const chatId = update?.message?.chat?.id
    if (token && chatId) waitUntil(new Telegram(token).sendMessage(chatId, BARE_ERROR))
    res.status(200).json({ok: true})
    return
  }

  const headerSecret = req.headers['x-telegram-bot-api-secret-token']
  if (headerSecret !== cfg.config.webhookSecret) {
    log('warn', 'bad_webhook_secret', {got: typeof headerSecret})
    res.status(200).json({ok: true})
    return
  }

  const incoming = update ? extractIncoming(update) : null
  const callback = update ? extractCallback(update) : null
  if (!incoming && !callback) {
    res.status(200).json({ok: true})
    return
  }

  if (callback) {
    const telegramCb = new Telegram(cfg.config.telegramToken)
    let deferredCb: Deferred = null
    try {
      deferredCb = await handleCallbackUpdate(callback, cfg.config, telegramCb)
    } catch (e) {
      log('error', 'callback_failed', {updateId: callback.updateId, senderId: callback.senderId, ...errInfo(e)})
      await telegramCb.answerCallbackQuery(callback.callbackId)
    }
    if (deferredCb) {
      waitUntil(
        deferredCb().catch(async (e) => {
          log('error', 'callback_failed', {updateId: callback.updateId, senderId: callback.senderId, ...errInfo(e)})
          await telegramCb.sendMessage(callback.chatId, M[pickLang(callback.languageCode)].bareError)
        }),
      )
    }
    res.status(200).json({ok: true})
    return
  }
  if (!incoming) {
    res.status(200).json({ok: true})
    return
  }

  const telegram = new Telegram(cfg.config.telegramToken)
  const failLoudly = async (e: unknown) => {
    log('error', 'pipeline_failed', {updateId: incoming.updateId, senderId: incoming.senderId, ...errInfo(e)})
    await telegram.sendMessage(incoming.chatId, M[pickLang(incoming.languageCode)].bareError)
  }

  // ORDERING: everything light (dedupe, session state, collection, acks) runs
  // BEFORE the 200, so a sender's next message always sees this one's effects
  // — otherwise "➕ then content" or "content then ✅" can race. Only the
  // pipeline and album debounce are deferred past the response.
  let deferred: Deferred = null
  try {
    deferred = await handleIncoming(incoming, cfg.config, telegram)
  } catch (e) {
    await failLoudly(e)
  }
  if (deferred) waitUntil(deferred().catch(failLoudly))
  res.status(200).json({ok: true})
}

function buildReviewDeps(config: BotConfig, telegram: Telegram, idleKeyboard: string[][]): ReviewDeps {
  const redis = makeRedis(config.upstash)
  const sanity = createClient({
    projectId: config.sanity.projectId,
    dataset: config.sanity.dataset,
    apiVersion: config.sanity.apiVersion,
    token: config.sanity.token,
    useCdn: false,
  })
  const anthropic = new Anthropic({apiKey: config.anthropicApiKey}) as unknown as AnthropicLike
  return {
    redis,
    // The SDK client satisfies the structural *Like types at runtime; same
    // narrowing note as the AnthropicLike cast above.
    sanity: sanity as unknown as ReviewDeps['sanity'],
    telegram,
    parseUpd: (answer, current, missingLbls, newPhotos) =>
      parseUpdate(anthropic, answer, current, missingLbls, newPhotos),
    studioBaseUrl: config.studioBaseUrl,
    idleKeyboard,
  }
}

/**
 * ORDERING: dedupe + duplicate-ack run before the 200; the routing itself
 * (publish, patch, preview sends) is deferred. handleReviewCallback answers
 * the callback as its own first step.
 */
async function handleCallbackUpdate(cb: IncomingCallback, config: BotConfig, telegram: Telegram): Promise<Deferred> {
  const redis = makeRedis(config.upstash)
  if (await isDuplicate(redis, cb.updateId)) {
    log('info', 'duplicate_update', {updateId: cb.updateId})
    await telegram.answerCallbackQuery(cb.callbackId)
    return null
  }
  const t = M[pickLang(cb.languageCode)]
  const deps = buildReviewDeps(config, telegram, [[t.btnAdd, t.btnRestart]])
  return () => handleReviewCallback(cb, deps)
}

async function handleIncoming(incoming: Incoming, config: BotConfig, telegram: Telegram): Promise<Deferred> {
  const redis: RedisLike = makeRedis(config.upstash)
  if (await isDuplicate(redis, incoming.updateId)) {
    log('info', 'duplicate_update', {updateId: incoming.updateId})
    return null
  }

  const sanity = createClient({
    projectId: config.sanity.projectId,
    dataset: config.sanity.dataset,
    apiVersion: config.sanity.apiVersion,
    token: config.sanity.token,
    useCdn: false,
  })

  const t = M[pickLang(incoming.languageCode)]
  // State-aware reply keyboard: only buttons that currently do something.
  const kbAdd = [[t.btnAdd, t.btnRestart]]
  const kbSession = [[t.btnSubmit, t.btnCancel]]
  // While a review is open the only way out is finishing it (inline buttons) or Restart.
  const kbReview = [[t.btnRestart]]

  if (incoming.command === '/start') {
    const auth = await resolveAgent(sanity, incoming.senderId)
    // Username is logged for onboarding (mapping ids to known people), never used for auth.
    log('info', 'start_command', {senderId: incoming.senderId, username: incoming.username, auth: auth.kind})
    let msg: string
    if (auth.kind === 'ok') {
      msg = `${t.greeting(auth.agentName)}${t.usage}`
    } else if (auth.kind === 'disabled') {
      msg = t.disabled
    } else if (auth.kind === 'pending') {
      msg = t.pending
    } else {
      // Unknown sender pressing Start IS the access request.
      await fileAccessRequest(sanity, {
        senderId: incoming.senderId,
        username: incoming.username,
        firstName: incoming.firstName,
      })
      log('info', 'access_request_filed', {senderId: incoming.senderId, username: incoming.username})
      msg = t.requestRecorded
    }
    await telegram.sendMessage(incoming.chatId, msg, {
      keyboard: (await isSessionOpen(redis, incoming.senderId))
        ? kbSession
        : (await loadReview(redis, incoming.senderId))
          ? kbReview
          : kbAdd,
    })
    return null
  }

  // The SDK client satisfies AnthropicLike at runtime; its stricter param
  // types just aren't structurally assignable, hence the narrowing cast.
  const anthropic = new Anthropic({apiKey: config.anthropicApiKey}) as unknown as AnthropicLike
  const reviewDeps = buildReviewDeps(config, telegram, kbAdd)
  const deps = {
    studioBaseUrl: config.studioBaseUrl,
    sanity,
    telegram,
    parse: (caption: string, photoCount: number) => parseListing(anthropic, caption, photoCount),
    keyboard: kbAdd, // pipeline replies always end with no open session
    startReview: (args: StartReviewArgs) => startReview(reviewDeps, args),
  }

  const item: GroupItem = {
    photoFileId: incoming.photoFileId,
    text: incoming.text,
    senderId: incoming.senderId,
    chatId: incoming.chatId,
    username: incoming.username,
    languageCode: incoming.languageCode,
  }

  // Session buttons (localized labels; emoji prefix is the marker).
  const action = detectAction(incoming.text)
  if (action === 'add') {
    const auth = await resolveAgent(sanity, incoming.senderId)
    if (auth.kind !== 'ok') {
      const msg = auth.kind === 'disabled' ? t.disabled : auth.kind === 'pending' ? t.pending : t.refusal
      await telegram.sendMessage(incoming.chatId, msg, {keyboard: kbAdd})
      return null
    }
    // One listing at a time: no new intake while a review is open.
    if (await loadReview(redis, incoming.senderId)) {
      await telegram.sendMessage(incoming.chatId, t.reviewOpen, {keyboard: kbReview})
      return null
    }
    await openSession(redis, incoming.senderId)
    log('info', 'session_opened', {senderId: incoming.senderId})
    await telegram.sendMessage(incoming.chatId, t.sessionStarted, {keyboard: kbSession})
    return null
  }
  if (action === 'cancel') {
    await closeSession(redis, incoming.senderId)
    log('info', 'session_cancelled', {senderId: incoming.senderId})
    await telegram.sendMessage(incoming.chatId, t.sessionCancelled, {keyboard: kbAdd})
    return null
  }
  if (action === 'restart') {
    await closeSession(redis, incoming.senderId)
    await clearReview(redis, incoming.senderId)
    log('info', 'restarted', {senderId: incoming.senderId})
    await telegram.sendMessage(incoming.chatId, t.restartDone, {keyboard: kbAdd})
    return null
  }
  if (action === 'submit') {
    // Collect + close synchronously so no later message can join a closed pile;
    // only the pipeline itself is deferred.
    const items = await collectSession(redis, incoming.senderId)
    if (!items || items.length === 0) {
      // No session at all -> offer to start one; open-but-empty -> keep session buttons.
      await telegram.sendMessage(incoming.chatId, t.sessionEmpty, {keyboard: items ? kbSession : kbAdd})
      return null
    }
    await closeSession(redis, incoming.senderId)
    log('info', 'session_submitted', {senderId: incoming.senderId, items: items.length})
    return () => processMessage(items, deps)
  }

  // Albums must debounce (their sibling updates are still arriving), so their
  // handling is deferred; whether they land in a session pile or the quick
  // pipeline is decided at claim time.
  if (incoming.mediaGroupId) {
    const groupId = incoming.mediaGroupId
    return async () => {
      await addToGroup(redis, groupId, incoming.updateId, item)
      await sleep(GROUP_DEBOUNCE_MS)
      const albumItems = await claimGroup(redis, groupId, incoming.updateId)
      if (!albumItems) return // another invocation of this album is the collector
      if (await isSessionOpen(redis, incoming.senderId)) {
        for (const it of albumItems) await addSessionItem(redis, incoming.senderId, it)
        const collected = (await collectSession(redis, incoming.senderId)) ?? []
        const {photos, texts} = tally(collected)
        await telegram.sendMessage(incoming.chatId, t.sessionTally(photos, texts), {keyboard: kbSession})
        return
      }
      const review = await loadReview(redis, incoming.senderId)
      if (review?.mode === 'updating') {
        await handleUpdateAnswer(albumItems, reviewDeps)
        return
      }
      if (review) {
        // One listing at a time: content while reviewing is neither a new
        // listing nor an update answer — point back at the open review.
        await telegram.sendMessage(incoming.chatId, t.reviewOpen, {keyboard: kbReview})
        return
      }
      await processMessage(albumItems, deps)
    }
  }

  // Open session: collect synchronously — a ✅ right behind this message must
  // find it already in the pile.
  if (await isSessionOpen(redis, incoming.senderId)) {
    await addSessionItem(redis, incoming.senderId, item)
    const collected = (await collectSession(redis, incoming.senderId)) ?? []
    const {photos, texts} = tally(collected)
    await telegram.sendMessage(incoming.chatId, t.sessionTally(photos, texts), {keyboard: kbSession})
    return null
  }

  // Update-mode answer: the next message from a sender whose review is in
  // 'updating' belongs to the review flow, not the intake pipeline.
  const review = await loadReview(redis, incoming.senderId)
  if (review?.mode === 'updating') {
    return () => handleUpdateAnswer([item], reviewDeps)
  }
  if (review) {
    // One listing at a time: content while reviewing is neither a new listing
    // nor an update answer — point back at the open review.
    await telegram.sendMessage(incoming.chatId, t.reviewOpen, {keyboard: kbReview})
    return null
  }

  // No session: the original quick path — one message in, draft out.
  return () => processMessage([item], deps)
}
