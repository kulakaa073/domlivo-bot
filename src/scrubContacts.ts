/**
 * Code, not AI: contact details never belong in listing copy, and a prompt
 * rule is a request rather than a guarantee — the 2026-08-22 test run found a
 * seller's phone number sitting in `description.en`. Contacts reach the site
 * through the `agent` reference; this strips them out of the editorial text
 * the model writes.
 *
 * Deliberately narrow. Prices are the one thing that looks like a phone number
 * in a property listing, so the phone pattern refuses dot- and comma-separated
 * runs (thousands separators) and stands down in front of a currency word.
 * Commentary and price mentions stay a prompt concern: a regex aimed at those
 * would damage more copy than it saved.
 */

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]{2,}/g
const URL = /(?:https?:\/\/|www\.)\S+/gi
const HANDLE = /(?:^|(?<=\s))@[\w.]{3,}/g

/**
 * 8–15 digits joined by spaces, dashes or parens — never dots or commas, which
 * is how prices are written. An optional leading +.
 */
const PHONE = /\(?\s*\+?\d[\d\s()-]{6,18}\d\)?/g

const CURRENCY_BEFORE = /[€$£]\s*$/
const CURRENCY_AFTER = /^\s*(?:€|\$|£|eur|euro|usd|lek[ëe]?|all|mij[ëe])\b/i

/** Labels that are left pointing at nothing once the number is gone. */
const DANGLING_LABEL =
  /\b(?:contact|contacts|tel|tel\.|telephone|phone|mob|mobile|kontakt|whatsapp|viber|telegram|тел|телефон|контакт)\b\s*[:\-–]?\s*(?=[.,;:)]|$)/gi

function looksLikePrice(text: string, match: string, index: number): boolean {
  if (CURRENCY_BEFORE.test(text.slice(0, index))) return true
  if (CURRENCY_AFTER.test(text.slice(index + match.length))) return true
  return false
}

function stripPhones(text: string): string {
  return text.replace(PHONE, (m, index: number) => {
    const digits = m.replace(/\D/g, '')
    if (digits.length < 8 || digits.length > 15) return m
    if (looksLikePrice(text, m, index)) return m
    return ''
  })
}

/** Whitespace and punctuation left behind by a removal, tidied without touching wording. */
function tidy(text: string): string {
  return text
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+([.,;:!?)])/g, '$1')
    .replace(/([.,;:])\1+/g, '$1')
    .replace(/\(\s*\)/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function scrubContacts(text: string): {text: string; removed: boolean} {
  if (!text) return {text, removed: false}
  let out = text.replace(EMAIL, '').replace(URL, '').replace(HANDLE, '')
  out = stripPhones(out)
  if (out === text) return {text, removed: false}
  out = tidy(out.replace(DANGLING_LABEL, ''))
  return {text: out, removed: true}
}

type LocaleMap = Record<string, string>
type Editorial = {title: LocaleMap; shortDescription: LocaleMap; description: LocaleMap}

/** Applies the scrub to every locale of every editorial field. */
export function scrubEditorial<T extends Editorial>(editorial: T): {editorial: T; removed: boolean} {
  let removed = false
  const out = {...editorial} as T
  for (const field of ['title', 'shortDescription', 'description'] as const) {
    const map = editorial[field]
    if (!map || typeof map !== 'object') continue
    const next: LocaleMap = {}
    for (const [locale, value] of Object.entries(map)) {
      if (typeof value !== 'string') {
        next[locale] = value
        continue
      }
      const r = scrubContacts(value)
      if (r.removed) removed = true
      next[locale] = r.text
    }
    ;(out as Editorial)[field] = next
  }
  return {editorial: out, removed}
}
