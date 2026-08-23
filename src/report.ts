import type {Outcome} from './types.js'
import {M, type Lang} from './messages.js'
import {computeMissing, missingLabels} from './missing.js'

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

  const missing = missingLabels(computeMissing(o), t)

  const problems = [
    ...(missing.length ? [`${t.missingLabel}: ${missing.join(', ')}`] : []),
    ...o.refs.unmatched.map((u) => `${t.notMatched}: ${u}`),
    // Both of these are things the agent is being asked to confirm, not errors.
    ...(o.createdAmenities?.length ? [`${t.amenityCreated}: ${o.createdAmenities.join(', ')}`] : []),
    ...(o.refs.looseAmenities.length
      ? [`${t.amenityGuessed}: ${o.refs.looseAmenities.map((l) => l.name).join(', ')}`]
      : []),
    // A missing city or district cannot be stubbed the way an amenity can, so
    // the agent is told plainly what to do about it.
    ...(o.missingLocations?.length ? [t.locationMissing(o.missingLocations.join(', '))] : []),
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
