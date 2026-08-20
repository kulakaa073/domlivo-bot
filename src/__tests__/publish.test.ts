import {describe, it, expect} from 'vitest'
import {publishGate, uniqueSlug, publishDraft, fetchPublishSettings, liveUrl} from '../publish.js'

const goodDraft = (): Record<string, unknown> => ({
  _id: 'drafts.property-tg-x',
  _type: 'property',
  title: {en: 'Nice flat', uk: '', ru: '', sq: '', it: ''},
  slug: {_type: 'slug', current: 'nice-flat'},
  price: 145000,
  status: 'sale',
  type: {_type: 'reference', _ref: 'pt1'},
  city: {_type: 'reference', _ref: 'c1'},
  agent: {_type: 'reference', _ref: 'a1'},
  gallery: [{_type: 'image', _key: 'tg-0', asset: {_type: 'reference', _ref: 'img1'}}],
  isPublished: false,
  lifecycleStatus: 'draft',
})

describe('publishGate', () => {
  it('passes a complete draft', () => {
    expect(publishGate(goodDraft())).toEqual({ok: true})
  })

  it('collects every blocker', () => {
    const d = goodDraft()
    delete d.price
    delete d.type
    delete d.city
    d.title = {en: ''}
    d.gallery = []
    delete d.status
    const r = publishGate(d)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.missing).toEqual(['title', 'price', 'deal', 'type', 'city', 'photos'])
  })
})

describe('uniqueSlug', () => {
  it('keeps the base when free, suffixes when taken', async () => {
    const taken = new Set(['nice-flat', 'nice-flat-2'])
    const sanity = {
      fetch: async (_q: string, params?: Record<string, unknown>) => (taken.has(String(params?.slug)) ? 1 : 0),
    }
    expect(await uniqueSlug(sanity, 'other-flat', 'drafts.p')).toBe('other-flat')
    expect(await uniqueSlug(sanity, 'nice-flat', 'drafts.p')).toBe('nice-flat-3')
  })
})

describe('publishDraft', () => {
  function fakeSanity(draft: Record<string, unknown> | null) {
    const txnOps: Array<[string, unknown]> = []
    const txn = {
      createOrReplace: (doc: Record<string, unknown>) => (txnOps.push(['createOrReplace', doc]), txn),
      delete: (id: string) => (txnOps.push(['delete', id]), txn),
      commit: async () => (txnOps.push(['commit', null]), {}),
    }
    return {
      txnOps,
      fetch: async (q: string, _p?: Record<string, unknown>) => (q.includes('count(') ? 0 : draft),
      transaction: () => txn,
    }
  }

  it('publishes: strips drafts. prefix, sets flags, deletes the draft', async () => {
    const sanity = fakeSanity(goodDraft())
    const r = await publishDraft(sanity, 'drafts.property-tg-x')
    expect(r).toEqual({ok: true, slug: 'nice-flat'})
    const [op1, pub] = sanity.txnOps[0]! as [string, Record<string, unknown>]
    expect(op1).toBe('createOrReplace')
    expect(pub._id).toBe('property-tg-x')
    expect(pub.isPublished).toBe(true)
    expect(pub.lifecycleStatus).toBe('active')
    expect(sanity.txnOps[1]).toEqual(['delete', 'drafts.property-tg-x'])
    expect(sanity.txnOps[2]![0]).toBe('commit')
  })

  it('reports gone and gate failures without committing', async () => {
    expect(await publishDraft(fakeSanity(null), 'drafts.p')).toEqual({ok: false, reason: 'gone'})
    const incomplete = goodDraft()
    delete incomplete.price
    const sanity = fakeSanity(incomplete)
    const r = await publishDraft(sanity, 'drafts.property-tg-x')
    expect(r).toEqual({ok: false, reason: 'gate', missing: ['price']})
    expect(sanity.txnOps).toEqual([])
  })
})

describe('settings + url', () => {
  it('fetchPublishSettings normalizes', async () => {
    const sanity = {fetch: async () => ({siteBaseUrl: 'https://www.domlivo.com/', botAllowPublish: true})}
    expect(await fetchPublishSettings(sanity)).toEqual({siteBaseUrl: 'https://www.domlivo.com', allowPublish: true})
    const empty = {fetch: async () => null}
    expect(await fetchPublishSettings(empty)).toEqual({siteBaseUrl: null, allowPublish: false})
  })

  it('liveUrl composes locale property paths', () => {
    expect(liveUrl('https://www.domlivo.com', 'uk', 'nice-flat')).toBe('https://www.domlivo.com/uk/property/nice-flat')
  })
})
