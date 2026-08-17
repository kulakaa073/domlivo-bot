import type {VercelRequest, VercelResponse} from '@vercel/node'
import Anthropic from '@anthropic-ai/sdk'
import {loadConfig} from '../src/config.js'
import {log} from '../src/log.js'
import {makeRedis} from '../src/redisClient.js'
import {gateStudioRequest, translateFields, type TranslateItem} from '../src/studioApi.js'
import type {AnthropicLike} from '../src/parseListing.js'

const LANGS = new Set(['en', 'uk', 'ru', 'sq', 'it'])
const MAX_ITEMS = 40
const MAX_CHARS = 20_000

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

  const body = req.body as {sourceLang?: string; items?: TranslateItem[]} | undefined
  const sourceLang = body?.sourceLang
  const items = body?.items
  if (!sourceLang || !LANGS.has(sourceLang) || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({error: 'sourceLang and items are required'})
    return
  }
  if (items.length > MAX_ITEMS || items.reduce((n, i) => n + (i.text?.length ?? 0), 0) > MAX_CHARS) {
    res.status(400).json({error: 'too much content in one request'})
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
  const translated = await translateFields(anthropic, sourceLang, clean)
  if (!translated) {
    res.status(502).json({error: 'translation failed, try again'})
    return
  }
  log('info', 'studio_translated', {items: clean.length, sourceLang, origin})
  res.status(200).json({items: translated})
}
