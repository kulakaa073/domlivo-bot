import {Redis} from '@upstash/redis'
import type {RedisLike} from './assembly.js'

export function makeRedis(cfg: {url: string; token: string}): RedisLike {
  // automaticDeserialization must be OFF: we store JSON strings and need them
  // back as strings, not silently re-parsed objects.
  const r = new Redis({url: cfg.url, token: cfg.token, automaticDeserialization: false})
  return {
    set: async (key, value, opts) => {
      let result: unknown
      if (opts?.nx && opts.ex !== undefined) result = await r.set(key, value, {nx: true, ex: opts.ex})
      else if (opts?.nx) result = await r.set(key, value, {nx: true})
      else if (opts?.ex !== undefined) result = await r.set(key, value, {ex: opts.ex})
      else result = await r.set(key, value)
      return result as string | null
    },
    get: async (key) => (await r.get<string>(key)) ?? null,
    rpush: (key, value) => r.rpush(key, value),
    lrange: (key, start, stop) => r.lrange<string>(key, start, stop),
    expire: (key, seconds) => r.expire(key, seconds),
    del: (key) => r.del(key),
  }
}
