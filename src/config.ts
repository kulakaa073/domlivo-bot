export type BotConfig = {
  telegramToken: string
  webhookSecret: string
  anthropicApiKey: string
  sanity: {projectId: string; dataset: string; apiVersion: string; token: string}
  upstash: {url: string; token: string}
  studioBaseUrl: string
}

const REQUIRED = [
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_WEBHOOK_SECRET',
  'ANTHROPIC_API_KEY',
  'SANITY_WRITE_TOKEN',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'STUDIO_BASE_URL',
] as const

export type ConfigResult = {ok: true; config: BotConfig} | {ok: false; missing: string[]}

/** Never throws — the webhook must be able to log-and-soft-fail on bad config. */
export function loadConfig(env: Record<string, string | undefined> = process.env): ConfigResult {
  const missing = REQUIRED.filter((k) => !env[k]?.trim())
  if (missing.length > 0) return {ok: false, missing: [...missing]}
  return {
    ok: true,
    config: {
      telegramToken: env.TELEGRAM_BOT_TOKEN!,
      webhookSecret: env.TELEGRAM_WEBHOOK_SECRET!,
      anthropicApiKey: env.ANTHROPIC_API_KEY!,
      sanity: {
        projectId: env.SANITY_PROJECT_ID?.trim() || 'g4aqp6ex',
        dataset: env.SANITY_DATASET?.trim() || 'production',
        apiVersion: '2025-01-01',
        token: env.SANITY_WRITE_TOKEN!,
      },
      upstash: {url: env.UPSTASH_REDIS_REST_URL!, token: env.UPSTASH_REDIS_REST_TOKEN!},
      studioBaseUrl: env.STUDIO_BASE_URL!.trim().replace(/\/+$/, ''),
    },
  }
}
