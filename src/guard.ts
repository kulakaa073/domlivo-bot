/**
 * Mechanical pre-filter — code, not AI. Runs after auth, BEFORE the model call,
 * so trash and prompt-injection attempts never reach the agent (and never cost
 * an API call). The user always gets the same generic rejection regardless of
 * reason; the specific reason is logged only.
 *
 * This is one layer of several: the model call itself uses forced tool-choice
 * with a strict JSON schema (injected instructions cannot change the output
 * shape), and nothing publishes without human review in Studio.
 */

export type GuardVerdict = {ok: true} | {ok: false; reason: string}

const MIN_CHARS = 20
const MAX_CHARS = 8000 // several Telegram messages; a real listing never needs more

/** Case-insensitive markers of instruction-injection attempts, incl. ru/uk. */
const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(?:(?:all|any|the|previous|prior|above|earlier)\s+)+(instructions?|prompts?|rules?|messages?)/i,
  /disregard\s+(all|any|the|previous|prior|above)\s/i,
  /forget\s+(all|any|your|previous|prior)\s+(instructions?|rules?|training)/i,
  /(system|developer)\s*(prompt|message|instructions?)/i,
  /you\s+are\s+(now|no\s+longer)\s/i,
  /new\s+instructions?\s*:/i,
  /<\/?\s*(system|assistant|instructions?|prompt)\s*>/i,
  /\[\s*(system|assistant|inst)\s*\]/i,
  /act\s+as\s+(if\s+you|an?\s+(?:ai|assistant|admin))/i,
  /(respond|reply|answer)\s+with\s+(only|just)\s+(your|the)\s+(system|prompt|instructions)/i,
  /(игнорируй|проигнорируй|забудь)\s+(все|всі|предыдущие|попередні)/i,
  /(системный|системні|системну)\s+(промпт|инструкции|інструкці)/i,
  /jailbreak|\bDAN\b/,
]

const URL_ONLY = /^\s*(https?:\/\/\S+[\s,;]*)+$/i

export function screenCaption(caption: string): GuardVerdict {
  const s = caption.trim()

  if (s.length < MIN_CHARS) return {ok: false, reason: 'too_short'}
  if (s.length > MAX_CHARS) return {ok: false, reason: 'too_long'}

  // Must contain actual letters — not only emoji/punctuation/numbers.
  if (!/\p{L}{3,}/u.test(s)) return {ok: false, reason: 'no_words'}

  if (URL_ONLY.test(s)) return {ok: false, reason: 'link_only'}

  // One repeated character/word stretched out ("aaaaaa...", "spam spam spam ...")
  const words = new Set(s.toLowerCase().split(/\s+/))
  if (s.length >= 60 && words.size <= 2) return {ok: false, reason: 'repetitive'}

  for (const p of INJECTION_PATTERNS) {
    if (p.test(s)) return {ok: false, reason: 'injection_pattern'}
  }

  return {ok: true}
}

/**
 * Lighter screen for update-mode answers: these are legitimately short
 * ("price 120000", "3"), so only emptiness, size, and injection are checked.
 */
export function screenAnswer(answer: string): GuardVerdict {
  const s = answer.trim()
  if (s.length < 1) return {ok: false, reason: 'empty'}
  if (s.length > MAX_CHARS) return {ok: false, reason: 'too_long'}
  for (const p of INJECTION_PATTERNS) {
    if (p.test(s)) return {ok: false, reason: 'injection_pattern'}
  }
  return {ok: true}
}
