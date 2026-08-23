import {describe, it, expect} from 'vitest'
import {amenityDocFor, createMissingAmenities, normalizeAmenityName} from '../createAmenities.js'

describe('normalizeAmenityName', () => {
  it('accepts a plausible name and collapses whitespace', () => {
    expect(normalizeAmenityName('  Sauna   room ')).toEqual({ok: true, name: 'Sauna room', key: 'saunaroom', slug: 'sauna-room'})
  })

  it('folds case, diacritics and separators into one key', () => {
    const a = normalizeAmenityName('Wi-Fi')
    const b = normalizeAmenityName('wifi')
    expect(a.ok && b.ok && a.key === b.key).toBe(true)
  })

  it('refuses anything that is not an amenity name', () => {
    expect(normalizeAmenityName('a').ok).toBe(false)
    expect(normalizeAmenityName('x'.repeat(61)).ok).toBe(false)
    expect(normalizeAmenityName('12345').ok).toBe(false)
    expect(normalizeAmenityName('call 069 45 67 890').ok).toBe(false)
    expect(normalizeAmenityName('<script>alert(1)</script>').ok).toBe(false)
  })
})

describe('amenityDocFor', () => {
  it('is a published document, flagged, and identified by the fold key', () => {
    expect(amenityDocFor({name: 'Sauna', key: 'sauna', slug: 'sauna'})).toEqual({
      _id: 'amenity-sauna',
      _type: 'amenity',
      title: {_type: 'localizedString', en: 'Sauna'},
      slug: {_type: 'slug', current: 'sauna'},
      active: true,
      needsReview: true,
    })
  })

  it('never mints a draft id — a reference to a draft is broken in published content', () => {
    expect(amenityDocFor({name: 'Sauna', key: 'sauna', slug: 'sauna'})._id.startsWith('drafts.')).toBe(false)
  })
})

describe('createMissingAmenities', () => {
  const sanity = () => {
    const created: Array<Record<string, unknown>> = []
    return {
      created,
      async createIfNotExists(doc: Record<string, unknown> & {_id: string; _type: string}) {
        created.push(doc)
        return doc
      },
    }
  }

  it('creates one amenity per unmatched name and returns the ids to attach', async () => {
    const s = sanity()
    const r = await createMissingAmenities(s, ['amenity "Sauna"', 'city "Atlantis"', 'amenity "Game room"'])
    expect(r.ids).toEqual(['amenity-sauna', 'amenity-gameroom'])
    expect(r.created).toEqual(['Sauna', 'Game room'])
    expect(r.stillUnmatched).toEqual(['city "Atlantis"'])
    expect(s.created).toHaveLength(2)
  })

  it('collapses repeats of the same wording within one listing', async () => {
    const s = sanity()
    const r = await createMissingAmenities(s, ['amenity "Sauna"', 'amenity "sauna"'])
    expect(r.ids).toEqual(['amenity-sauna'])
    expect(s.created).toHaveLength(1)
  })

  it('reports a name it refused rather than creating junk', async () => {
    const s = sanity()
    const r = await createMissingAmenities(s, ['amenity "12345"'])
    expect(r.ids).toEqual([])
    expect(s.created).toHaveLength(0)
    expect(r.stillUnmatched).toEqual(['amenity "12345"'])
  })

  it('caps what a single listing can add', async () => {
    const s = sanity()
    const many = Array.from({length: 12}, (_, i) => `amenity "Feature number ${i}"`)
    const r = await createMissingAmenities(s, many)
    expect(r.ids).toHaveLength(8)
  })

  it('keeps the listing when creation fails, and says the name is still unmatched', async () => {
    const failing = {
      async createIfNotExists() {
        throw new Error('permission denied')
      },
    }
    const r = await createMissingAmenities(failing, ['amenity "Sauna"'])
    expect(r.ids).toEqual([])
    expect(r.stillUnmatched).toEqual(['amenity "Sauna"'])
  })
})
