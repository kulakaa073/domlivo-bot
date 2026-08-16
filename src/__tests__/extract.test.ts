import {describe, it, expect} from 'vitest'
import {extractIncoming} from '../telegram/extract.js'
import * as fx from './fixtures/updates.js'

describe('extractIncoming', () => {
  it('picks the LARGEST photo size (Telegram sorts ascending)', () => {
    const r = extractIncoming(fx.singlePhoto)
    expect(r?.photoFileId).toBe('ph-big')
    expect(r?.text).toMatch(/Parruce/)
    expect(r?.senderId).toBe(111111111)
    expect(r?.mediaGroupId).toBeNull()
  })

  it('carries media_group_id and caption for album items', () => {
    expect(extractIncoming(fx.albumItemWithCaption)?.mediaGroupId).toBe('mg-777')
    const noCap = extractIncoming(fx.albumItemNoCaption)
    expect(noCap?.text).toBeNull()
    expect(noCap?.photoFileId).toBe('alb-2-big')
  })

  it('accepts image documents (full-quality uploads)', () => {
    const r = extractIncoming(fx.imageDocument)
    expect(r?.photoFileId).toBe('doc-1')
    expect(r?.text).toMatch(/Блоку/)
  })

  it('handles text-only and commands', () => {
    expect(extractIncoming(fx.textOnly)?.photoFileId).toBeNull()
    expect(extractIncoming(fx.startCommand)?.command).toBe('/start')
  })

  it('returns null for updates without a usable private message', () => {
    expect(extractIncoming(fx.editedMessageOnly as never)).toBeNull()
  })
})
