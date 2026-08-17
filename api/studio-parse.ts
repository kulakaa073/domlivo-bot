import type {VercelRequest, VercelResponse} from '@vercel/node'
import Anthropic from '@anthropic-ai/sdk'
import {createClient} from '@sanity/client'
import {loadConfig} from '../src/config.js'
import {log} from '../src/log.js'
import {makeRedis} from '../src/redisClient.js'
import {gateStudioRequest} from '../src/studioApi.js'
import {parseListing, type AnthropicLike} from '../src/parseListing.js'
import {resolveRefs} from '../src/resolveRefs.js'
import {validateFacts} from '../src/validate.js'
import {screenCaption} from '../src/guard.js'
import {extractMapCoordinates} from '../src/mapLink.js'
import {validateLocales} from '../src/locales.js'

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
    log('error', 'config_missing', {missing: cfg.missing, endpoint: 'studio-parse'})
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

  const body = req.body as {text?: string; locales?: unknown} | undefined
  const text = body?.text
  const locales = validateLocales(body?.locales)
  if (!locales) {
    res.status(400).json({error: 'locales must be 2-10 language codes'})
    return
  }
  if (typeof text !== 'string' || !text.trim()) {
    res.status(400).json({error: 'text is required'})
    return
  }

  // Same mechanical guard as the Telegram path — trash never reaches the model.
  const verdict = screenCaption(text)
  if (!verdict.ok) {
    log('warn', 'guard_rejected', {reason: verdict.reason, captionLength: text.length, endpoint: 'studio-parse'})
    res.status(422).json({error: 'the text does not look like a property listing'})
    return
  }

  const anthropic = new Anthropic({apiKey: cfg.config.anthropicApiKey}) as unknown as AnthropicLike
  const parsed = await parseListing(anthropic, text, 0, locales)
  if (!parsed) {
    res.status(502).json({error: 'parsing failed, try again'})
    return
  }

  const sanity = createClient({
    projectId: cfg.config.sanity.projectId,
    dataset: cfg.config.sanity.dataset,
    apiVersion: cfg.config.sanity.apiVersion,
    token: cfg.config.sanity.token,
    useCdn: false,
  })
  const refs = await resolveRefs(sanity, parsed.facts)
  const validation = validateFacts(parsed.facts)
  const map = await extractMapCoordinates(text)
  if (map.linkFound && !map.coords) {
    validation.warnings.push('map link found but coordinates could not be read — set the pin manually')
  }

  log('info', 'studio_parsed', {origin, unmatched: refs.unmatched.length, warnings: validation.warnings.length})
  res.status(200).json({parsed, refs, validation, coords: map.coords})
}
