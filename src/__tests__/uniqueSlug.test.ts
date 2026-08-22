import {describe, it, expect} from 'vitest'
import {pickFreeSlug, resolveUniqueSlug} from '../uniqueSlug.js'
import {slugify} from '../buildDraft.js'

describe('pickFreeSlug', () => {
  it('leaves an uncontested slug alone and suffixes from 2 upward', () => {
    expect(pickFreeSlug('flat-in-durres', [])).toBe('flat-in-durres')
    expect(pickFreeSlug('flat-in-durres', ['flat-in-durres'])).toBe('flat-in-durres-2')
    expect(pickFreeSlug('flat-in-durres', ['flat-in-durres', 'flat-in-durres-2'])).toBe('flat-in-durres-3')
  })

  it('ignores unrelated slugs that merely share a prefix', () => {
    expect(pickFreeSlug('flat', ['flat-in-durres', 'flatmate'])).toBe('flat')
  })

  it('agrees with the Studio implementation on the titles both repos see', () => {
    // Pinned against cms/lib/studioAi/slug.ts — the two intake routes must not
    // disagree about what a free slug looks like.
    expect(slugify('2-bedroom apartment in Currila, Durrës')).toBe('2-bedroom-apartment-in-currila-durres')
    expect(pickFreeSlug('2-bedroom-apartment-in-currila-durres', ['2-bedroom-apartment-in-currila-durres'])).toBe(
      '2-bedroom-apartment-in-currila-durres-2',
    )
  })
})

describe('resolveUniqueSlug', () => {
  it('asks only about the base and its suffixes, and returns a free one', async () => {
    const seen: Array<{query: string; params?: Record<string, unknown>}> = []
    const sanity = {
      async fetch(query: string, params?: Record<string, unknown>) {
        seen.push({query, params})
        return ['flat-in-durres', 'flat-in-durres-2']
      },
    }
    expect(await resolveUniqueSlug(sanity, 'flat-in-durres')).toBe('flat-in-durres-3')
    expect(seen).toHaveLength(1)
    expect(seen[0]!.params).toEqual({base: 'flat-in-durres', pattern: 'flat-in-durres-*'})
    expect(seen[0]!.query).toContain('_type == "property"')
  })

  it('counts drafts as taken — a draft is a URL someone is about to claim', async () => {
    const sanity = {async fetch() { return ['flat-in-durres'] }}
    expect(await resolveUniqueSlug(sanity, 'flat-in-durres')).toBe('flat-in-durres-2')
  })

  it('falls back to the base slug when the lookup fails, rather than losing the listing', async () => {
    const sanity = {async fetch() { throw new Error('network') }}
    expect(await resolveUniqueSlug(sanity, 'flat-in-durres')).toBe('flat-in-durres')
  })

  it('tolerates a malformed response', async () => {
    const sanity = {async fetch() { return null }}
    expect(await resolveUniqueSlug(sanity, 'flat-in-durres')).toBe('flat-in-durres')
  })
})
