import type {VercelRequest, VercelResponse} from '@vercel/node'
import Anthropic from '@anthropic-ai/sdk'
import {loadConfig} from '../src/config.js'
import {log} from '../src/log.js'
import {makeRedis} from '../src/redisClient.js'
import {
  MAX_TRANSLATE_ITEMS,
  gateStudioRequest,
  maxCharsForLocales,
  translateFields,
  type TranslateItem,
} from '../src/studioApi.js'
import type {AnthropicLike} from '../src/parseListing.js'
import {validateLocales} from '../src/locales.js'

const MAX_ITEMS = MAX_TRANSLATE_ITEMS

function applyCors(res: VercelResponse, origin: string | null): void {
  if (!origin) return
  res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'content-type, x-studio-secret')
  res.setHeader('Vary', 'Origin')
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const cfg = loadConfig()
  const origin = typeof req.headers.origin === 'string' ? req.headers.origin : undefined

  if (!cfg.ok) {
    log('error', 'config_missing', {missing: cfg.missing, endpoint: 'studio-translate'})
    res.status(503).json({error: 'not configured'})
    return
  }

  const gate = await gateStudioRequest({
    origin,
    secretHeader: typeof req.headers['x-studio-secret'] === 'string' ? req.headers['x-studio-secret'] : undefined,
    redis: makeRedis(cfg.config.upstash),
    env: {STUDIO_API_SECRET: process.env.STUDIO_API_SECRET, STUDIO_ORIGINS: process.env.STUDIO_ORIGINS},
  })
  applyCors(res, gate.corsOrigin)

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  if (req.method !== 'POST') {
    res.status(405).json({error: 'method not allowed'})
    return
  }
  if (!gate.ok) {
    res.status(gate.status).json({error: gate.error})
    return
  }

  const body = req.body as {sourceLang?: string; items?: TranslateItem[]; locales?: unknown} | undefined
  const sourceLang = body?.sourceLang
  const items = body?.items
  const locales = validateLocales(body?.locales)
  if (!locales) {
    res.status(400).json({error: 'locales must be 2-10 language codes'})
    return
  }
  if (!sourceLang || !locales.includes(sourceLang) || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({error: 'sourceLang (one of locales) and items are required'})
    return
  }
  const maxChars = maxCharsForLocales(locales.length)
  const chars = items.reduce((n, i) => n + (i.text?.length ?? 0), 0)
  if (items.length > MAX_ITEMS || chars > maxChars) {
    res.status(400).json({
      error: `too much content in one request (max ${MAX_ITEMS} items / ${maxChars} characters for ${locales.length} locales)`,
    })
    return
  }
  const clean = items.filter(
    (i) => typeof i.key === 'string' && typeof i.text === 'string' && i.text.trim() && (i.kind === 'string' || i.kind === 'text'),
  )
  if (clean.length === 0) {
    res.status(400).json({error: 'no valid items'})
    return
  }

  const anthropic = new Anthropic({apiKey: cfg.config.anthropicApiKey}) as unknown as AnthropicLike
  const translated = await translateFields(anthropic, sourceLang, clean, locales)
  if (!translated) {
    res.status(502).json({error: 'translation failed, try again'})
    return
  }
  log('info', 'studio_translated', {items: clean.length, sourceLang, locales: locales.length, origin})
  res.status(200).json({items: translated})
}
