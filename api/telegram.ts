import type {VercelRequest, VercelResponse} from '@vercel/node'
import {waitUntil} from '@vercel/functions'
import Anthropic from '@anthropic-ai/sdk'
import {createClient} from '@sanity/client'
import {loadConfig, type BotConfig} from '../src/config.js'
import {log, errInfo} from '../src/log.js'
import {extractIncoming, type TgUpdate, type Incoming} from '../src/telegram/extract.js'
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
import {resolveAgent, fileAccessRequest} from '../src/resolveAgent.js'
import {BARE_ERROR} from '../src/report.js'
import {M, pickLang} from '../src/messages.js'

const GROUP_DEBOUNCE_MS = 3000

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
  if (!incoming) {
    res.status(200).json({ok: true})
    return
  }

  const telegram = new Telegram(cfg.config.telegramToken)
  waitUntil(
    handleIncoming(incoming, cfg.config, telegram).catch(async (e) => {
      log('error', 'pipeline_failed', {updateId: incoming.updateId, senderId: incoming.senderId, ...errInfo(e)})
      await telegram.sendMessage(incoming.chatId, M[pickLang(incoming.languageCode)].bareError)
    }),
  )
  res.status(200).json({ok: true})
}

async function handleIncoming(incoming: Incoming, config: BotConfig, telegram: Telegram): Promise<void> {
  const redis: RedisLike = makeRedis(config.upstash)
  if (await isDuplicate(redis, incoming.updateId)) {
    log('info', 'duplicate_update', {updateId: incoming.updateId})
    return
  }

  const sanity = createClient({
    projectId: config.sanity.projectId,
    dataset: config.sanity.dataset,
    apiVersion: config.sanity.apiVersion,
    token: config.sanity.token,
    useCdn: false,
  })

  const t = M[pickLang(incoming.languageCode)]
  const keyboard = [[t.btnAdd], [t.btnSubmit, t.btnCancel]]

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
    await telegram.sendMessage(incoming.chatId, msg, {keyboard})
    return
  }

  // The SDK client satisfies AnthropicLike at runtime; its stricter param
  // types just aren't structurally assignable, hence the narrowing cast.
  const anthropic = new Anthropic({apiKey: config.anthropicApiKey}) as unknown as AnthropicLike
  const deps = {
    studioBaseUrl: config.studioBaseUrl,
    sanity,
    telegram,
    parse: (caption: string, photoCount: number) => parseListing(anthropic, caption, photoCount),
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
      await telegram.sendMessage(incoming.chatId, msg, {keyboard})
      return
    }
    await openSession(redis, incoming.senderId)
    log('info', 'session_opened', {senderId: incoming.senderId})
    await telegram.sendMessage(incoming.chatId, t.sessionStarted, {keyboard})
    return
  }
  if (action === 'cancel') {
    await closeSession(redis, incoming.senderId)
    log('info', 'session_cancelled', {senderId: incoming.senderId})
    await telegram.sendMessage(incoming.chatId, t.sessionCancelled, {keyboard})
    return
  }
  if (action === 'submit') {
    const items = await collectSession(redis, incoming.senderId)
    if (!items || items.length === 0) {
      await telegram.sendMessage(incoming.chatId, t.sessionEmpty, {keyboard})
      return
    }
    await closeSession(redis, incoming.senderId)
    log('info', 'session_submitted', {senderId: incoming.senderId, items: items.length})
    await processMessage(items, deps)
    return
  }

  // Open session: collect instead of processing. Albums still assemble first
  // so the pile gets complete albums and the tally is sent once per album.
  if (await isSessionOpen(redis, incoming.senderId)) {
    if (incoming.mediaGroupId) {
      await addToGroup(redis, incoming.mediaGroupId, incoming.updateId, item)
      await sleep(GROUP_DEBOUNCE_MS)
      const albumItems = await claimGroup(redis, incoming.mediaGroupId, incoming.updateId)
      if (!albumItems) return
      for (const it of albumItems) await addSessionItem(redis, incoming.senderId, it)
    } else {
      await addSessionItem(redis, incoming.senderId, item)
    }
    const collected = (await collectSession(redis, incoming.senderId)) ?? []
    const {photos, texts} = tally(collected)
    await telegram.sendMessage(incoming.chatId, t.sessionTally(photos, texts), {keyboard})
    return
  }

  // No session: the original quick path — one message or album in, draft out.
  if (incoming.mediaGroupId) {
    await addToGroup(redis, incoming.mediaGroupId, incoming.updateId, item)
    await sleep(GROUP_DEBOUNCE_MS)
    const items = await claimGroup(redis, incoming.mediaGroupId, incoming.updateId)
    if (!items) return // another invocation of this album is the collector
    await processMessage(items, deps)
  } else {
    await processMessage([item], deps)
  }
}
