import type {Outcome} from './types'

/** The ONLY thing users see on internal failure. Details go to Vercel logs. */
export const BARE_ERROR =
  '⚠️ Something went wrong on our side. The listing was not saved — please try again in a few minutes.'

export const REFUSAL =
  'Sorry, this bot only accepts listings from registered DomLivo agents.'

export const DISABLED = 'The intake bot is currently switched off. Please try again later.'

export const USAGE =
  'Send me property photos as an album, with the listing text in the caption (any language). ' +
  'Tip: send images as files for full quality. I will create a draft for review — nothing goes live automatically.'

const fmtEur = (n: number) => `€${n.toLocaleString('en-US')}`

export function buildReply(o: Outcome, studioBaseUrl: string): string {
  const f = o.parsed.facts

  const summaryBits = [
    o.parsed.editorial.title.en || 'Untitled listing',
    f.cityName ? (f.districtName ? `${f.districtName}, ${f.cityName}` : f.cityName) : null,
    f.areaM2 !== null ? `${f.areaM2} m²` : null,
    o.validation.priceEur !== null ? fmtEur(o.validation.priceEur) : null,
    `${o.photoCount} photos`,
  ].filter(Boolean)

  const missing: string[] = []
  if (!o.parsed.editorial.title.en) missing.push('title')
  if (o.validation.priceEur === null) missing.push('price')
  if (!f.dealType) missing.push('sale or rent')
  if (!o.refs.propertyTypeId) missing.push('property type')
  if (!o.refs.cityId) missing.push('city')
  if (f.areaM2 === null) missing.push('area (m²)')
  if (f.bedrooms === null) missing.push('bedrooms')
  if (o.photoCount === 0) missing.push('photos')

  const problems = [
    ...(missing.length ? [`Missing: ${missing.join(', ')}`] : []),
    ...o.refs.unmatched.map((u) => `Not matched (left empty): ${u}`),
    ...o.validation.warnings,
    ...(o.photosFailed > 0 ? [`${o.photosFailed} photo(s) failed to upload`] : []),
    ...(o.parsed.parserNotes ? [o.parsed.parserNotes] : []),
  ]

  const editId = o.draftId.replace(/^drafts\./, '')
  const lines = [
    `🏠 Draft created: ${summaryBits.join(' · ')}`,
    ...(problems.length ? ['', ...problems.map((p) => `⚠ ${p}`)] : []),
    '',
    `Review and publish: ${studioBaseUrl}/intent/edit/id=${editId};type=property`,
  ]
  return lines.join('\n')
}
