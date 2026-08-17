import type {Outcome} from './types.js'
import {M, type Lang} from './messages.js'

// English aliases kept for tests and log-side references.
export const BARE_ERROR = M.en.bareError
export const REFUSAL = M.en.refusal
export const DISABLED = M.en.disabled
export const PENDING = M.en.pending
export const REQUEST_RECORDED = M.en.requestRecorded
export const USAGE = M.en.usage

const fmtEur = (n: number) => `€${n.toLocaleString('en-US')}`

/**
 * The reply skeleton is localized via the sender's Telegram language_code.
 * Validation warnings (o.validation.warnings) stay English in v1 — they are
 * review-oriented technical detail.
 */
export function buildReply(o: Outcome, studioBaseUrl: string, lang: Lang = 'en'): string {
  const t = M[lang]
  const f = o.parsed.facts

  const summaryBits = [
    o.parsed.editorial.title.en || 'Untitled listing',
    f.cityName ? (f.districtName ? `${f.districtName}, ${f.cityName}` : f.cityName) : null,
    f.areaM2 !== null ? `${f.areaM2} m²` : null,
    o.validation.priceEur !== null ? fmtEur(o.validation.priceEur) : null,
    `${o.photoCount} ${t.photosWord}`,
  ].filter(Boolean)

  const missing: string[] = []
  if (!o.parsed.editorial.title.en) missing.push(t.fields.title)
  if (o.validation.priceEur === null) missing.push(t.fields.price)
  if (!f.dealType) missing.push(t.fields.deal)
  if (!o.refs.propertyTypeId) missing.push(t.fields.type)
  if (!o.refs.cityId) missing.push(t.fields.city)
  if (f.areaM2 === null) missing.push(t.fields.area)
  if (f.bedrooms === null) missing.push(t.fields.bedrooms)
  if (o.photoCount === 0) missing.push(t.fields.photos)

  const problems = [
    ...(missing.length ? [`${t.missingLabel}: ${missing.join(', ')}`] : []),
    ...o.refs.unmatched.map((u) => `${t.notMatched}: ${u}`),
    ...o.validation.warnings,
    ...(o.photosFailed > 0 ? [t.photosFailed(o.photosFailed)] : []),
    ...(o.parsed.parserNotes ? [o.parsed.parserNotes] : []),
  ]

  const editId = o.draftId.replace(/^drafts\./, '')
  const lines = [
    `🏠 ${t.draftCreated}: ${summaryBits.join(' · ')}`,
    ...(o.coords ? [t.coordsSet] : []),
    ...(problems.length ? ['', ...problems.map((p) => `⚠ ${p}`)] : []),
    '',
    `${t.review}: ${studioBaseUrl}/intent/edit/id=${editId};type=property`,
  ]
  return lines.join('\n')
}
