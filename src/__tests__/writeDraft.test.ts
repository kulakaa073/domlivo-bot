import {describe, it, expect} from 'vitest'
import {uploadPhotos, type SanityWriteLike, type FileFetcher} from '../writeDraft'

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
