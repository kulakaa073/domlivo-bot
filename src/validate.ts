import type {ParsedFacts, ValidationResult} from './types.js'

export const LEK_PER_EUR = 98
export const EUR_PER_USD = 0.92

const BOUNDS = {
  sale: {min: 5_000, max: 5_000_000, perM2Min: 300, perM2Max: 7_000},
  rent: {min: 80, max: 10_000},
} as const

/**
 * Code, not AI. Warnings never block the draft — they go to the reply's ⚠ list.
 * Bounds follow cms/scripts/parser/aggregate.ts; the old-lek and rent-misread
 * cases both actually happened during the listing-parser work.
 */
export function validateFacts(facts: ParsedFacts): ValidationResult {
  const warnings: string[] = []
  let priceEur: number | null = null

  const p = facts.price
  if (p) {
    let eur: number | null =
      p.currency === 'EUR' ? p.amount
      : p.currency === 'USD' ? Math.round(p.amount * EUR_PER_USD)
      : Math.round(p.amount / LEK_PER_EUR)
    if (p.currency !== 'EUR') {
      warnings.push(`price given as ${p.amount} ${p.currency}, converted to ≈€${eur} at a fixed rate — verify`)
    }

    if (p.period === 'per_m2') {
      if (facts.areaM2 && facts.areaM2 > 0) {
        eur = Math.round(eur * facts.areaM2)
        warnings.push('price was quoted per m² — multiplied by the area')
      } else {
        warnings.push('price is per m² but the area is missing — price left empty')
        eur = null
      }
    }

    const deal = facts.dealType ?? 'sale'
    if (eur !== null) {
      const b = BOUNDS[deal]
      // Old-lek trap: sellers quote "old lek" at 10x the official denomination.
      if (p.currency === 'ALL' && eur > b.max && eur / 10 >= b.min && eur / 10 <= b.max) {
        eur = Math.round(eur / 10)
        warnings.push('lek amount looked like OLD lek (10×) — divided by 10, please verify the price')
      }
      if (eur < b.min || eur > b.max) {
        warnings.push(`price €${eur} is outside plausible ${deal} bounds (€${b.min}–€${b.max}) — verify`)
      }
      if (deal === 'sale' && facts.areaM2 && facts.areaM2 > 0) {
        const perM2 = Math.round(eur / facts.areaM2)
        if (perM2 < BOUNDS.sale.perM2Min || perM2 > BOUNDS.sale.perM2Max) {
          warnings.push(`€${perM2}/m² is outside €300–7,000 — check price or area`)
        }
      }
      priceEur = eur
    }
  }

  if (facts.areaM2 !== null && (facts.areaM2 < 10 || facts.areaM2 > 2000)) {
    warnings.push(`area ${facts.areaM2} m² looks implausible — verify`)
  }
  if (facts.bedrooms !== null && facts.bedrooms > 10) {
    warnings.push(`${facts.bedrooms} bedrooms looks implausible — verify`)
  }
  const maxYear = new Date().getFullYear() + 2
  if (facts.yearBuilt !== null && (facts.yearBuilt < 1900 || facts.yearBuilt > maxYear)) {
    warnings.push(`year built ${facts.yearBuilt} looks implausible — verify`)
  }
  if (!facts.dealType) {
    warnings.push('could not tell sale vs rent — set the Status field in Studio')
  }

  return {priceEur, warnings}
}
