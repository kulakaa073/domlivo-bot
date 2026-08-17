/**
 * Single source of truth for CONTENT locales — the languages parse/translate
 * produce. Endpoints may override the list per request (the Studio sends its
 * own, derived from cms languages.ts), so adding a site language needs no
 * backend change. Deliberately separate from messages.ts: that is the bot's
 * chat-UI language set, which always needs human-written strings.
 */

export const DEFAULT_LOCALES = ['en', 'uk', 'ru', 'sq', 'it'] as const

const LOCALE_NAMES: Record<string, string> = {
  en: 'English',
  uk: 'Ukrainian',
  ru: 'Russian',
  sq: 'Albanian',
  it: 'Italian',
  de: 'German',
  fr: 'French',
  es: 'Spanish',
  pl: 'Polish',
  tr: 'Turkish',
  el: 'Greek',
  mk: 'Macedonian',
  sr: 'Serbian',
  nl: 'Dutch',
  sv: 'Swedish',
  no: 'Norwegian',
}

/** "Ukrainian (uk)" for prompt clarity; bare code for languages we have no name for. */
export function localeLabel(code: string): string {
  const name = LOCALE_NAMES[code.split('-')[0] ?? '']
  return name ? `${name} (${code})` : code
}

export function localeLabels(locales: readonly string[]): string {
  return locales.map(localeLabel).join(', ')
}

/** JSON schema for an object carrying one string per locale — all required. */
export function localeObjectSchema(locales: readonly string[]): Record<string, unknown> {
  return {
    type: 'object',
    properties: Object.fromEntries(locales.map((l) => [l, {type: 'string'}])),
    required: [...locales],
    additionalProperties: false,
  }
}

/**
 * Request-supplied locale lists: undefined -> the default; anything malformed
 * -> null (caller answers 400). Deduped, order preserved.
 */
export function validateLocales(input: unknown): string[] | null {
  if (input === undefined) return [...DEFAULT_LOCALES]
  if (!Array.isArray(input) || input.length < 2 || input.length > 10) return null
  if (!input.every((l) => typeof l === 'string' && /^[a-z]{2}(-[a-z]{2})?$/.test(l))) return null
  return [...new Set(input as string[])]
}
