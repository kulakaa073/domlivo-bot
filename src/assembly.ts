export type RedisLike = {
  set(key: string, value: string, opts?: {nx?: boolean; ex?: number}): Promise<string | null>
  get(key: string): Promise<string | null>
  rpush(key: string, value: string): Promise<number>
  lrange(key: string, start: number, stop: number): Promise<string[]>
  expire(key: string, seconds: number): Promise<number>
}

export type GroupItem = {
  photoFileId: string | null
  text: string | null
  senderId: number
  chatId: number
}

const TTL = 3600

export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

/** Telegram redelivers updates it thinks failed; process each update_id once. */
export async function isDuplicate(redis: RedisLike, updateId: number): Promise<boolean> {
  const r = await redis.set(`upd:${updateId}`, '1', {nx: true, ex: TTL})
  return r === null
}

/**
 * An album of N photos arrives as N separate webhook calls sharing
 * media_group_id, caption on only one item. Every invocation adds its item and
 * records itself as the group's latest writer.
 */
export async function addToGroup(
  redis: RedisLike,
  groupId: string,
  updateId: number,
  item: GroupItem,
): Promise<void> {
  await redis.rpush(`grp:${groupId}:items`, JSON.stringify(item))
  await redis.expire(`grp:${groupId}:items`, TTL)
  await redis.set(`grp:${groupId}:latest`, String(updateId), {ex: TTL})
}

/**
 * Called after the debounce sleep. Returns the assembled items to exactly one
 * invocation: the group's latest writer, and only if nobody claimed it yet.
 */
export async function claimGroup(
  redis: RedisLike,
  groupId: string,
  updateId: number,
): Promise<GroupItem[] | null> {
  const latest = await redis.get(`grp:${groupId}:latest`)
  if (latest !== String(updateId)) return null
  const claimed = await redis.set(`grp:${groupId}:claimed`, '1', {nx: true, ex: TTL})
  if (claimed === null) return null
  const raw = await redis.lrange(`grp:${groupId}:items`, 0, -1)
  return raw.map((r) => JSON.parse(r) as GroupItem)
}
