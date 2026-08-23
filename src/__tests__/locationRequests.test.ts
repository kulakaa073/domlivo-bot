import {describe, it, expect} from 'vitest'
import {
  locationRequestId,
  normalizeLocationName,
  planLocationRequests,
  recordLocationRequests,
  unresolvedLocations,
} from '../locationRequests.js'

describe('unresolvedLocations', () => {
  it('picks cities and districts out of the unmatched list and ignores amenities', () => {
    expect(
      unresolvedLocations(['city "Tiranë"', 'amenity "Sauna"', 'district "Bllok"', 'property type "Kullë"']),
    ).toEqual([
      {kind: 'city', name: 'Tiranë'},
      {kind: 'district', name: 'Bllok'},
    ])
  })
})

describe('normalizeLocationName', () => {
  it('folds case, diacritics and separators into one key', () => {
    const a = normalizeLocationName('Kodra e Diellit')
    const b = normalizeLocationName('kodra-e-diellit')
    expect(a.ok && b.ok && a.key === b.key).toBe(true)
  })

  it('refuses anything that is not a place name', () => {
    expect(normalizeLocationName('x').ok).toBe(false)
    expect(normalizeLocationName('12345').ok).toBe(false)
    expect(normalizeLocationName('call 069 45 67 890').ok).toBe(false)
    expect(normalizeLocationName('<b>Tirana</b>').ok).toBe(false)
  })
})

describe('planLocationRequests', () => {
  it('gives each place a stable id derived from kind and folded name', () => {
    expect(planLocationRequests(['city "Tiranë"'])).toEqual([
      {id: locationRequestId('city', 'tirane'), kind: 'city', name: 'Tiranë', key: 'tirane'},
    ])
  })

  it('keeps a city and a district of the same name apart', () => {
    const plans = planLocationRequests(['city "Himarë"', 'district "Himarë"'])
    expect(plans.map((p) => p.id)).toEqual(['location-request-city-himare', 'location-request-district-himare'])
  })

  it('collapses a repeat inside one listing', () => {
    expect(planLocationRequests(['city "Tiranë"', 'city "tirane"'])).toHaveLength(1)
  })
})

describe('recordLocationRequests', () => {
  const spy = () => {
    const created: Array<Record<string, unknown>> = []
    const patched: Array<{id: string; ops: Record<string, unknown>}> = []
    return {
      created,
      patched,
      async fetch() {
        return null
      },
      async createIfNotExists(doc: Record<string, unknown> & {_id: string; _type: string}) {
        created.push(doc)
        return doc
      },
      patch(id: string, ops: Record<string, unknown>) {
        patched.push({id, ops})
        return {async commit() {return null}}
      },
    }
  }
  const ctx = {listingTitle: '2-bedroom apartment in Currila', source: 'telegram' as const, now: '2026-08-22T10:00:00.000Z'}

  it('creates the row at zero and bumps it, so the first hit lands on one', async () => {
    const s = spy()
    const recorded = await recordLocationRequests(s, ['city "Tiranë"'], ctx)
    expect(recorded).toEqual(['city "Tiranë"'])
    expect(s.created[0]).toMatchObject({_type: 'locationRequest', kind: 'city', name: 'Tiranë', count: 0, status: 'new'})
    expect(s.patched[0]!.ops).toMatchObject({inc: {count: 1}, set: {lastSeen: ctx.now}})
  })

  it('keeps the listing when the write fails', async () => {
    const failing = {
      async fetch() {return null},
      async createIfNotExists() {throw new Error('permission denied')},
      patch() {return {async commit() {return null}}},
    }
    await expect(recordLocationRequests(failing, ['city "Tiranë"'], ctx)).resolves.toEqual([])
  })

  it('records nothing when every reference resolved', async () => {
    const s = spy()
    expect(await recordLocationRequests(s, [], ctx)).toEqual([])
    expect(s.created).toHaveLength(0)
  })
})

describe('examples stay bounded', () => {
  it('keeps only the first listing as context, and never appends on later hits', async () => {
    const created: Array<Record<string, unknown>> = []
    const patched: Array<Record<string, unknown>> = []
    const s = {
      async fetch() {return null},
      async createIfNotExists(doc: Record<string, unknown> & {_id: string; _type: string}) {created.push(doc); return doc},
      patch(_id: string, ops: Record<string, unknown>) {patched.push(ops); return {async commit() {return null}}},
    }
    const ctx = {listingTitle: 'First listing', source: 'telegram' as const, now: '2026-08-22T10:00:00.000Z'}
    await recordLocationRequests(s, ['city "Pukë"'], ctx)
    await recordLocationRequests(s, ['city "Pukë"'], {...ctx, listingTitle: 'Second listing'})

    expect(created[0]!.examples).toEqual(['First listing'])
    // createIfNotExists leaves the existing row alone, and the patch only
    // touches the count and the timestamp — so the array cannot grow.
    for (const ops of patched) expect(ops).not.toHaveProperty('insert')
  })
})
