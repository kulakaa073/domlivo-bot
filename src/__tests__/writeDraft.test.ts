import {describe, it, expect} from 'vitest'
import {uploadPhotos, patchDraft, appendGallery, type SanityWriteLike, type FileFetcher} from '../writeDraft.js'

describe('uploadPhotos', () => {
  const sanity: SanityWriteLike = {
    assets: {
      upload: async (_type, _buf, opts) => ({_id: `image-${(opts?.filename as string) ?? 'x'}`}),
    },
    create: async (doc) => doc,
  }

  it('uploads every downloadable photo and stamps traceability metadata', async () => {
    const fetcher: FileFetcher = {downloadFile: async (id) => Buffer.from(id)}
    const r = await uploadPhotos(sanity, fetcher, ['a', 'b'], {agentName: 'Blerina'})
    expect(r.assetIds.length).toBe(2)
    expect(r.failed).toBe(0)
  })

  it('skips failed downloads instead of aborting the listing', async () => {
    const fetcher: FileFetcher = {
      downloadFile: async (id) => {
        if (id === 'bad') throw new Error('410 gone')
        return Buffer.from(id)
      },
    }
    const r = await uploadPhotos(sanity, fetcher, ['ok', 'bad', 'ok2'], {agentName: 'X'})
    expect(r.assetIds.length).toBe(2)
    expect(r.failed).toBe(1)
  })
})

describe('patchDraft / appendGallery', () => {
  it('patchDraft passes ops through and commits', async () => {
    const calls: Array<{id: string; ops: Record<string, unknown>}> = []
    const sanity = {
      patch: (id: string, ops: Record<string, unknown>) => {
        calls.push({id, ops})
        return {commit: async () => ({})}
      },
    }
    await patchDraft(sanity, 'drafts.p1', {set: {price: 1}})
    expect(calls).toEqual([{id: 'drafts.p1', ops: {set: {price: 1}}}])
  })

  it('appendGallery inserts keyed images after the last gallery item', async () => {
    const calls: Array<{id: string; ops: Record<string, unknown>}> = []
    const sanity = {
      patch: (id: string, ops: Record<string, unknown>) => {
        calls.push({id, ops})
        return {commit: async () => ({})}
      },
    }
    await appendGallery(sanity, 'drafts.p1', ['asset-1', 'asset-2'], 'Nice flat', 6)
    expect(calls[0]!.ops).toEqual({setIfMissing: {gallery: []}})
    const items = (calls[1]!.ops.insert as {items: Array<Record<string, unknown>>}).items
    expect((calls[1]!.ops.insert as {after: string}).after).toBe('gallery[-1]')
    expect(items).toHaveLength(2)
    expect(items[0]).toEqual({
      _type: 'image',
      _key: 'tg-6',
      asset: {_type: 'reference', _ref: 'asset-1'},
      alt: 'Nice flat — photo 7',
    })
  })
})
