import {log, errInfo} from './log'

export type SanityWriteLike = {
  assets: {
    upload(type: 'image', body: Buffer, opts?: Record<string, unknown>): Promise<{_id: string}>
  }
  create(doc: Record<string, unknown>): Promise<unknown>
}

export type FileFetcher = {downloadFile(fileId: string): Promise<Buffer>}

/**
 * Downloads each Telegram file and uploads it as a Sanity image asset.
 * A single bad photo is skipped (logged + counted), not fatal — the reply
 * reports how many made it.
 */
export async function uploadPhotos(
  sanity: SanityWriteLike,
  fetcher: FileFetcher,
  fileIds: string[],
  meta: {agentName: string},
): Promise<{assetIds: string[]; failed: number}> {
  const assetIds: string[] = []
  let failed = 0
  const stamp = new Date().toISOString().slice(0, 10)
  for (const [i, fileId] of fileIds.entries()) {
    try {
      const buf = await fetcher.downloadFile(fileId)
      const asset = await sanity.assets.upload('image', buf, {
        filename: `tg-${stamp}-${i + 1}.jpg`,
        description: `via Telegram bot · ${meta.agentName} · ${stamp}`,
      })
      assetIds.push(asset._id)
    } catch (e) {
      failed += 1
      log('error', 'photo_upload_failed', {fileId, index: i, ...errInfo(e)})
    }
  }
  return {assetIds, failed}
}

export async function createDraft(sanity: SanityWriteLike, doc: Record<string, unknown>): Promise<void> {
  await sanity.create(doc)
}
