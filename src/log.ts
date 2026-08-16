type Level = 'info' | 'warn' | 'error'

/**
 * One JSON line per event — this is what shows up in `vercel logs`.
 * Detailed diagnostics go HERE; Telegram users only ever see bare messages.
 */
export function log(level: Level, event: string, data: Record<string, unknown> = {}): void {
  const line = JSON.stringify({level, event, ...data, ts: new Date().toISOString()})
  if (level === 'error') console.error(line)
  else console.log(line)
}

export function errInfo(e: unknown): {message: string; stack?: string} {
  if (e instanceof Error) return {message: e.message, stack: e.stack}
  return {message: String(e)}
}
