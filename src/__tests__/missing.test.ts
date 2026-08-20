import {describe, it, expect} from 'vitest'
import {computeMissing, missingLabels} from '../missing.js'
import {M} from '../messages.js'
import {fullOutcome} from './fixtures/outcome.js'

describe('computeMissing', () => {
  it('returns [] for a complete outcome', () => {
    expect(computeMissing(fullOutcome())).toEqual([])
  })

  it('flags every absent field', () => {
    const o = fullOutcome()
    o.parsed.editorial.title.en = ''
    o.validation.priceEur = null
    o.parsed.facts.dealType = null
    o.refs.propertyTypeId = null
    o.refs.cityId = null
    o.parsed.facts.areaM2 = null
    o.parsed.facts.bedrooms = null
    o.photoCount = 0
    expect(computeMissing(o)).toEqual(['title', 'price', 'deal', 'type', 'city', 'area', 'bedrooms', 'photos'])
  })
})

describe('missingLabels', () => {
  it('maps keys to the locale field labels', () => {
    expect(missingLabels(['price', 'city'], M.uk)).toEqual([M.uk.fields.price, M.uk.fields.city])
  })
})
