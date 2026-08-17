import {log, errInfo} from './log.js'
import type {RedisLike} from './assembly.js'
import type {AnthropicLike} from './parseListing.js'
import {MODEL} from './parseListing.js'

/**
 * Shared gate for the Studio-facing endpoints (/api/studio-*). Compute-only
 * surface: the secret ships in the Studio bundle (extractable by design), so
 * these endpoints never touch the dataset — all writes happen in the Studio
 * under the editor's own Sanity permissions. Abuse is capped by the rate limit.
 */

export type GateResult =
  | {ok: true; corsOrigin: string}
  | {ok: false; status: number; error: string; corsOrigin: string | null}

const DEFAULT_LOCAL = 'http://localhost:3333'
const RATE_LIMIT_PER_MINUTE = 30

export function allowedOrigin(origin: string | undefined, originsEnv: string | undefined): string | null {
  if (!origin) return null
  const o = origin.replace(/\/$/, '')
  const custom = (originsEnv ?? '')
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean)
  if (custom.length > 0) return custom.includes(o) ? o : null
  try {
    const u = new URL(o)
    if (o === DEFAULT_LOCAL) return o
    if (u.protocol === 'https:' && u.hostname.endsWith('.sanity.studio')) return o
  } catch {
    return null
  }
  return null
}

export async function gateStudioRequest(input: {
  origin: string | undefined
  secretHeader: string | undefined
  redis: RedisLike
  env: {STUDIO_API_SECRET?: string; STUDIO_ORIGINS?: string}
  /** Minute bucket for the rate limiter — injectable for tests. */
  minute?: number
}): Promise<GateResult> {
  const corsOrigin = allowedOrigin(input.origin, input.env.STUDIO_ORIGINS)

  const secret = input.env.STUDIO_API_SECRET?.trim()
  if (!secret) {
    log('error', 'config_missing', {missing: ['STUDIO_API_SECRET']})
    return {ok: false, status: 503, error: 'not configured', corsOrigin}
  }
  if (!corsOrigin) {
    log('warn', 'studio_origin_rejected', {origin: input.origin ?? null})
    return {ok: false, status: 403, error: 'forbidden', corsOrigin}
  }
  if (input.secretHeader !== secret) {
    log('warn', 'studio_bad_secret', {origin: input.origin})
    return {ok: false, status: 401, error: 'unauthorized', corsOrigin}
  }

  const minute = input.minute ?? Math.floor(Date.now() / 60_000)
  const key = `studio:rl:${minute}`
  const count = await input.redis.rpush(key, '1')
  await input.redis.expire(key, 120)
  if (count > RATE_LIMIT_PER_MINUTE) {
    log('warn', 'studio_rate_limited', {origin: input.origin, count})
    return {ok: false, status: 429, error: 'too many requests, try again in a minute', corsOrigin}
  }

  return {ok: true, corsOrigin}
}

// ---------------------------------------------------------------------------
// Translate call — one request covers every field of the document.

export type TranslateItem = {key: string; kind: 'string' | 'text'; text: string}
export type TranslatedItem = {key: string; locales: {en: string; uk: string; ru: string; sq: string; it: string}}

const LOCALES = ['en', 'uk', 'ru', 'sq', 'it'] as const

const TRANSLATE_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          key: {type: 'string'},
          locales: {
            type: 'object',
            properties: Object.fromEntries(LOCALES.map((l) => [l, {type: 'string'}])),
            required: [...LOCALES],
            additionalProperties: false,
          },
        },
        required: ['key', 'locales'],
        additionalProperties: false,
      },
    },
  },
  required: ['items'],
  additionalProperties: false,
} as const

const TRANSLATE_SYSTEM = `You translate CMS content for DomLivo, an Albanian real-estate site, between English (en), Ukrainian (uk), Russian (ru), Albanian (sq) and Italian (it).

Rules:
- For every input item, return ALL five locales. The locale matching the given source language must be the input text unchanged.
- Translate faithfully: no additions, no omissions, no marketing embellishment. Keep numbers, prices, area figures and proper nouns (place names in their locally common form: Durrës/Дуррес/Durazzo).
- Preserve line breaks and paragraph structure for multi-line text.
- Keep the register of the source (listing copy stays listing copy).`

export async function translateFields(
  client: AnthropicLike,
  sourceLang: string,
  items: TranslateItem[],
): Promise<TranslatedItem[] | null> {
  try {
    const payload = items.map((i) => ({key: i.key, kind: i.kind, text: i.text}))
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 8000,
      system: TRANSLATE_SYSTEM,
      messages: [
        {
          role: 'user',
          content: `Source language: ${sourceLang}\n\nItems to translate (JSON):\n${JSON.stringify(payload, null, 2)}`,
        },
      ],
      tools: [{name: 'record_translations', description: 'Record the translations.', input_schema: TRANSLATE_SCHEMA}],
      tool_choice: {type: 'tool', name: 'record_translations'},
    })
    const tool = msg.content.find((b) => b.type === 'tool_use')
    if (!tool) {
      log('error', 'translate_no_tool_use', {})
      return null
    }
    return (tool.input as {items: TranslatedItem[]}).items
  } catch (e) {
    log('error', 'translate_failed', {items: items.length, ...errInfo(e)})
    return null
  }
}
