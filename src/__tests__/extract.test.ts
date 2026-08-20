import {describe, it, expect} from 'vitest'
import {extractIncoming, extractCallback} from '../telegram/extract.js'
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

describe('extractCallback', () => {
  const base = {
    update_id: 900,
    callback_query: {
      id: 'cbid-1',
      from: {id: 42, is_bot: false, language_code: 'uk'},
      message: {message_id: 77, chat: {id: 42, type: 'private'}},
      data: 'rv:u:abc123',
    },
  }

  it('extracts a callback with message context', () => {
    expect(extractCallback(base)).toEqual({
      updateId: 900,
      callbackId: 'cbid-1',
      data: 'rv:u:abc123',
      chatId: 42,
      senderId: 42,
      messageId: 77,
      languageCode: 'uk',
    })
  })

  it('returns null for plain message updates', () => {
    expect(
      extractCallback({update_id: 1, message: {message_id: 1, chat: {id: 1, type: 'private'}, from: {id: 1}}}),
    ).toBeNull()
  })

  it('returns null when the callback has no message (too old)', () => {
    expect(extractCallback({update_id: 2, callback_query: {id: 'x', from: {id: 1}, data: 'rv:p:t'}})).toBeNull()
  })

  it('returns null for non-private chats and missing data', () => {
    expect(
      extractCallback({
        ...base,
        callback_query: {...base.callback_query, message: {message_id: 7, chat: {id: 9, type: 'group'}}},
      }),
    ).toBeNull()
    expect(extractCallback({...base, callback_query: {...base.callback_query, data: undefined}})).toBeNull()
  })
})
