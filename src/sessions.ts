import type {RedisLike, GroupItem} from './assembly.js'

const TTL = 86_400 // sessions live a day; opening a new one always starts clean

const openKey = (senderId: number) => `sess:${senderId}:open`
const itemsKey = (senderId: number) => `sess:${senderId}:items`

/** Opens a collecting session, discarding any previous unsubmitted pile. */
export async function openSession(redis: RedisLike, senderId: number): Promise<void> {
  await redis.del(itemsKey(senderId))
  await redis.set(openKey(senderId), '1', {ex: TTL})
}

export async function isSessionOpen(redis: RedisLike, senderId: number): Promise<boolean> {
  return (await redis.get(openKey(senderId))) !== null
}

export async function addSessionItem(redis: RedisLike, senderId: number, item: GroupItem): Promise<void> {
  await redis.rpush(itemsKey(senderId), JSON.stringify(item))
  await redis.expire(itemsKey(senderId), TTL)
}

/** Everything collected so far, or null when no session is open. */
export async function collectSession(redis: RedisLike, senderId: number): Promise<GroupItem[] | null> {
  if (!(await isSessionOpen(redis, senderId))) return null
  const raw = await redis.lrange(itemsKey(senderId), 0, -1)
  return raw.map((r) => JSON.parse(r) as GroupItem)
}

export async function closeSession(redis: RedisLike, senderId: number): Promise<void> {
  await redis.del(openKey(senderId))
  await redis.del(itemsKey(senderId))
}

export function tally(items: GroupItem[]): {photos: number; texts: number} {
  return {
    photos: items.filter((i) => i.photoFileId !== null).length,
    texts: items.filter((i) => i.text !== null).length,
  }
}

export type SessionAction = 'add' | 'submit' | 'cancel' | 'restart'

/**
 * Reply-keyboard presses arrive as plain text carrying the localized label.
 * The emoji prefix is constant across locales; slash commands are equivalents.
 */
export function detectAction(text: string | null): SessionAction | null {
  const s = (text ?? '').trim()
  if (s.startsWith('➕') || s.startsWith('/new')) return 'add'
  if (s.startsWith('✅') || s.startsWith('/submit')) return 'submit'
  if (s.startsWith('❌') || s.startsWith('/cancel')) return 'cancel'
  if (s.startsWith('🔄') || s.startsWith('/restart')) return 'restart'
  return null
}
