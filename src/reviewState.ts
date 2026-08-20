import {randomUUID} from 'node:crypto'
import type {RedisLike} from './assembly.js'
import type {PreviewData} from './preview.js'
import type {Lang} from './messages.js'

/** A review can span a workday or three; collect sessions keep their own 1-day TTL. */
const TTL = 7 * 86_400

const key = (senderId: number) => `review:${senderId}`

export type ReviewMode = 'reviewing' | 'updating'

/**
 * One review context per sender, newest wins. `data` is the full snapshot the
 * merge parse and re-preview need; `token` invalidates stale inline keyboards.
 */
export type ReviewContext = {
  token: string
  draftId: string
  chatId: number
  previewMessageId: number | null
  mode: ReviewMode
  lang: Lang
  /** For photo-asset traceability on update uploads. */
  agentName: string
  data: PreviewData
}

export async function saveReview(redis: RedisLike, senderId: number, ctx: ReviewContext): Promise<void> {
  await redis.set(key(senderId), JSON.stringify(ctx), {ex: TTL})
}

export async function loadReview(redis: RedisLike, senderId: number): Promise<ReviewContext | null> {
  const raw = await redis.get(key(senderId))
  if (raw === null) return null
  try {
    return JSON.parse(raw) as ReviewContext
  } catch {
    return null
  }
}

export async function clearReview(redis: RedisLike, senderId: number): Promise<void> {
  await redis.del(key(senderId))
}

/** 8 hex chars — short enough for callback_data, random enough per review round. */
export function mintToken(): string {
  return randomUUID().replace(/-/g, '').slice(0, 8)
}

export type CbAction = 'update' | 'post' | 'cancel'

const CODE_TO_ACTION: Record<string, CbAction> = {u: 'update', p: 'post', c: 'cancel'}

export function cbData(code: 'u' | 'p' | 'c', token: string): string {
  return `rv:${code}:${token}`
}

export function parseCb(data: string): {action: CbAction; token: string} | null {
  const m = /^rv:([upc]):(.+)$/.exec(data)
  if (!m) return null
  return {action: CODE_TO_ACTION[m[1]!]!, token: m[2]!}
}
