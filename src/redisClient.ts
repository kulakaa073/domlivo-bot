import {Redis} from '@upstash/redis'
import type {RedisLike} from './assembly'

export function makeRedis(cfg: {url: string; token: string}): RedisLike {
  // automaticDeserialization must be OFF: we store JSON strings and need them
  // back as strings, not silently re-parsed objects.
  const r = new Redis({url: cfg.url, token: cfg.token, automaticDeserialization: false})
  return {
    set: async (key, value, opts) =>
      (await r.set(key, value, opts?.nx ? {nx: true, ex: opts.ex} : opts?.ex ? {ex: opts.ex} : undefined)) as
        | string
        | null,
    get: async (key) => (await r.get<string>(key)) ?? null,
    rpush: (key, value) => r.rpush(key, value),
    lrange: (key, start, stop) => r.lrange<string>(key, start, stop),
    expire: (key, seconds) => r.expire(key, seconds),
  }
}
