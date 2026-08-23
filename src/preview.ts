import type {ParsedListing, ResolvedRefs, ValidationResult, LocaleMap} from './types.js'
import {M, type Lang} from './messages.js'

/** Everything needed to render (and later re-render) the draft as the site would. Plain JSON — it is snapshotted into Redis. */
export type PreviewData = {
  parsed: ParsedListing
  refs: ResolvedRefs
  validation: ValidationResult
  photoCount: number
  coords: {lat: number; lng: number} | null
}

const MAX_DESCRIPTION = 1500

const fmtEur = (n: number) => `€${n.toLocaleString('en-US')}`

function pick(map: LocaleMap, lang: Lang): string {
  return map[lang]?.trim() || map.en?.trim() || ''
}

/** Amenity names that resolved to real docs — unmatched ones only appear in the ⚠ report. */
function matchedAmenities(d: PreviewData): string[] {
  const unmatched = new Set(
    d.refs.unmatched
      .map((u) => /^amenity "(.+)"$/.exec(u)?.[1])
      .filter((x): x is string => typeof x === 'string'),
  )
  return d.parsed.facts.amenityNames.filter((n) => !unmatched.has(n))
}

/**
 * The draft as a visitor would read it, mirroring the live property page's
 * order: title → location → beds/baths/area → price+deal → built/floor →
 * amenities → photos/pin → short description → description.
 */
export function buildPreview(d: PreviewData, lang: Lang): string {
  const t = M[lang]
  const f = d.parsed.facts

  const title = pick(d.parsed.editorial.title, lang) || '—'
  const city = d.refs.cityId && f.cityName ? f.cityName : null
  const district = d.refs.districtId && f.districtName ? f.districtName : null
  const location = city ? (district ? `${district}, ${city}` : city) : '—'

  const beds = f.bedrooms !== null ? String(f.bedrooms) : '—'
  const rooms = f.rooms !== null ? String(f.rooms) : null
  const baths = f.bathrooms !== null ? String(f.bathrooms) : '—'
  const area = f.areaM2 !== null ? `${f.areaM2} m²` : '—'
  const price = d.validation.priceEur !== null ? fmtEur(d.validation.priceEur) : '—'
  const deal = f.dealType === 'sale' ? t.pvForSale : f.dealType === 'rent' ? t.pvForRent : '—'

  const amenities = matchedAmenities(d)
  let description = pick(d.parsed.editorial.description, lang)
  if (description.length > MAX_DESCRIPTION) {
    description = description.slice(0, MAX_DESCRIPTION) + t.pvTruncated
  }
  const shortDescription = pick(d.parsed.editorial.shortDescription, lang)

  const lines = [
    `🏠 ${title}`,
    `📍 ${location}`,
    // Rooms only when the listing said it — an absent number is not a dash here,
    // it is simply one fewer fact on the line.
    rooms ? `🚪 ${rooms} · 🛏 ${beds} · 🛁 ${baths} · ↔ ${area}` : `🛏 ${beds} · 🛁 ${baths} · ↔ ${area}`,
    `💶 ${price} · ${deal}`,
    ...(f.yearBuilt !== null || f.floor !== null
      ? [
          [f.yearBuilt !== null ? t.pvBuilt(f.yearBuilt) : null, f.floor !== null ? t.pvFloor(f.floor) : null]
            .filter(Boolean)
            .join(' · '),
        ]
      : []),
    ...(amenities.length > 0 ? [`${t.pvAmenities}: ${amenities.join(', ')}`] : []),
    t.pvPhotos(d.photoCount),
    d.coords ? t.pvPinSet : t.pvPinNotSet,
    ...(shortDescription ? ['', `${t.pvShortDescription}:`, shortDescription] : []),
    ...(description ? ['', `${t.pvDescription}:`, description] : []),
  ]
  return lines.join('\n')
}
