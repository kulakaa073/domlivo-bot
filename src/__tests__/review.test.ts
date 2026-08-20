import {describe, it, expect, beforeEach} from 'vitest'
import {reviewKeyboard, startReview, handleReviewCallback, handleUpdateAnswer, type ReviewDeps} from '../review.js'
import {saveReview, loadReview, cbData, type ReviewContext} from '../reviewState.js'
import {M} from '../messages.js'
import type {RedisLike, GroupItem} from '../assembly.js'
import type {IncomingCallback} from '../telegram/extract.js'
import {fullOutcome} from './fixtures/outcome.js'
import type {UpdateParse} from '../parseUpdate.js'

function fakeRedis(): RedisLike {
  const store = new Map<string, string>()
  return {
    set: async (k, v) => (store.set(k, v), 'OK'),
    get: async (k) => store.get(k) ?? null,
    rpush: async () => 0,
    lrange: async () => [],
    expire: async () => 1,
    del: async (k) => (store.delete(k) ? 1 : 0),
  }
}

type Sent = {chatId: number; text: string; inline?: unknown; keyboard?: unknown}

function publishableDraft(): Record<string, unknown> {
  return {
    _id: 'drafts.property-tg-x',
    _type: 'property',
    title: {en: 'Nice flat'},
    slug: {_type: 'slug', current: 'nice-flat'},
    price: 145000,
    status: 'sale',
    type: {_type: 'reference', _ref: 'pt1'},
    city: {_type: 'reference', _ref: 'c1'},
    agent: {_type: 'reference', _ref: 'a1'},
    gallery: [{_key: 'tg-0'}],
  }
}

function makeDeps(overrides?: {
  settings?: {siteBaseUrl?: string; botAllowPublish?: boolean} | null
  draft?: Record<string, unknown> | null
  parseUpd?: UpdateParse | null
}): ReviewDeps & {
  sent: Sent[]
  edits: Array<{messageId: number; kb: unknown}>
  answered: Array<{id: string; text?: string}>
  txnCommits: number
} {
  const settings =
    overrides?.settings === undefined
      ? {siteBaseUrl: 'https://www.domlivo.com', botAllowPublish: true}
      : overrides.settings
  const draft = overrides?.draft === undefined ? publishableDraft() : overrides.draft
  const d = {
    sent: [] as Sent[],
    edits: [] as Array<{messageId: number; kb: unknown}>,
    answered: [] as Array<{id: string; text?: string}>,
    txnCommits: 0,
    redis: fakeRedis(),
    studioBaseUrl: 'https://studio.example',
    idleKeyboard: [[M.en.btnAdd, M.en.btnRestart]],
    sanity: {
      fetch: async (q: string) => {
        if (q.includes('siteSettings')) return settings
        if (q.includes('count(')) return 0
        if (q.includes('"propertyTypes"')) return {propertyTypes: [], cities: [], districts: [], amenities: []}
        return draft
      },
      create: async () => ({}),
      assets: {upload: async () => ({_id: 'new-asset-1'})},
      patch: () => ({commit: async () => ({})}),
      transaction: () => {
        const txn = {
          createOrReplace: () => txn,
          delete: () => txn,
          commit: async () => (d.txnCommits++, {}),
        }
        return txn
      },
    },
    telegram: {
      sendMessage: async (chatId: number, text: string, opts?: Record<string, unknown>) => (
        d.sent.push({chatId, text, inline: opts?.inlineKeyboard, keyboard: opts?.keyboard}), d.sent.length
      ),
      editMessageReplyMarkup: async (_c: number, messageId: number, kb: unknown) => (
        d.edits.push({messageId, kb}), true
      ),
      answerCallbackQuery: async (id: string, opts?: {text?: string}) => (
        d.answered.push({id, text: opts?.text}), true
      ),
      downloadFile: async () => Buffer.from([1]),
    },
    parseUpd: async () => overrides?.parseUpd ?? null,
  }
  return d as never
}

const cbFor = (ctx: ReviewContext, code: 'u' | 'p' | 'c'): IncomingCallback => ({
  updateId: 1,
  callbackId: 'cb1',
  data: cbData(code, ctx.token),
  chatId: ctx.chatId,
  senderId: 42,
  messageId: ctx.previewMessageId ?? 77,
  languageCode: 'en',
})

async function seeded(deps: ReturnType<typeof makeDeps>): Promise<ReviewContext> {
  await startReview(deps, {
    senderId: 42,
    chatId: 42,
    lang: 'en',
    agentName: 'Test Agent',
    draftId: 'drafts.property-tg-x',
    data: {...fullOutcome(), coords: null},
  })
  return (await loadReview(deps.redis, 42))!
}

describe('reviewKeyboard', () => {
  it('reviewing: Update + Post when publishing allowed; Post hidden otherwise', () => {
    expect(reviewKeyboard(M.en, 'reviewing', true, 't1')).toEqual([
      [
        {text: M.en.btnUpdate, data: 'rv:u:t1'},
        {text: M.en.btnPost, data: 'rv:p:t1'},
      ],
    ])
    expect(reviewKeyboard(M.en, 'reviewing', false, 't1')).toEqual([[{text: M.en.btnUpdate, data: 'rv:u:t1'}]])
  })
  it('updating: Cancel replaces Update', () => {
    expect(reviewKeyboard(M.en, 'updating', true, 't1')).toEqual([
      [
        {text: M.en.btnCancel, data: 'rv:c:t1'},
        {text: M.en.btnPost, data: 'rv:p:t1'},
      ],
    ])
  })
})

describe('startReview', () => {
  it('sends the preview with buttons and saves the context', async () => {
    const deps = makeDeps()
    const ctx = await seeded(deps)
    expect(deps.sent).toHaveLength(1)
    expect(deps.sent[0]!.text).toContain('🏠')
    expect(deps.sent[0]!.inline).toBeTruthy()
    expect(ctx.mode).toBe('reviewing')
    expect(ctx.previewMessageId).toBe(1)
  })
})

describe('handleReviewCallback', () => {
  let deps: ReturnType<typeof makeDeps>
  let ctx: ReviewContext
  beforeEach(async () => {
    deps = makeDeps()
    ctx = await seeded(deps)
    deps.sent.length = 0
  })

  it('stale token: answers, removes that keyboard, keeps context', async () => {
    await handleReviewCallback({...cbFor(ctx, 'p'), data: 'rv:p:wrongtok'}, deps)
    expect(deps.answered[0]!.text).toBe(M.en.staleButton)
    expect(deps.edits).toEqual([{messageId: 1, kb: null}])
    expect(await loadReview(deps.redis, 42)).toBeTruthy()
    expect(deps.txnCommits).toBe(0)
  })

  it('update: morphs keyboard, asks for missing fields, mode -> updating', async () => {
    ctx.data.validation.priceEur = null
    await saveReview(deps.redis, 42, ctx)
    await handleReviewCallback(cbFor(ctx, 'u'), deps)
    const after = (await loadReview(deps.redis, 42))!
    expect(after.mode).toBe('updating')
    expect(deps.edits[0]!.kb).toEqual(reviewKeyboard(M.en, 'updating', true, ctx.token))
    expect(deps.sent[0]!.text).toBe(M.en.updAskMissing(M.en.fields.price))
  })

  it('update with nothing missing asks the free-correction variant', async () => {
    await handleReviewCallback(cbFor(ctx, 'u'), deps)
    expect(deps.sent[0]!.text).toBe(M.en.updAskFree)
  })

  it('cancel: back to reviewing, keyboard restored', async () => {
    await handleReviewCallback(cbFor(ctx, 'u'), deps)
    deps.sent.length = 0
    await handleReviewCallback(cbFor(ctx, 'c'), deps)
    const after = (await loadReview(deps.redis, 42))!
    expect(after.mode).toBe('reviewing')
    expect(deps.edits[1]!.kb).toEqual(reviewKeyboard(M.en, 'reviewing', true, ctx.token))
    expect(deps.sent[0]!.text).toBe(M.en.updResumed)
  })

  it('post: publishes, sends live URL, clears context, removes keyboard', async () => {
    await handleReviewCallback(cbFor(ctx, 'p'), deps)
    expect(deps.txnCommits).toBe(1)
    expect(deps.sent[0]!.text).toBe(`${M.en.postPublished}\nhttps://www.domlivo.com/en/property/nice-flat`)
    expect(await loadReview(deps.redis, 42)).toBeNull()
    expect(deps.edits.some((e) => e.kb === null)).toBe(true)
  })

  it('post with publishing disabled: alert only, nothing published', async () => {
    const d2 = makeDeps({settings: {siteBaseUrl: 'https://www.domlivo.com', botAllowPublish: false}})
    const c2 = await seeded(d2)
    await handleReviewCallback(cbFor(c2, 'p'), d2)
    expect(d2.answered[0]!.text).toBe(M.en.postDisabled)
    expect(d2.txnCommits).toBe(0)
    expect(await loadReview(d2.redis, 42)).toBeTruthy()
  })

  it('post blocked by the gate lists the blockers', async () => {
    const incomplete = publishableDraft()
    delete incomplete.price
    const d2 = makeDeps({draft: incomplete})
    const c2 = await seeded(d2)
    d2.sent.length = 0
    await handleReviewCallback(cbFor(c2, 'p'), d2)
    expect(d2.txnCommits).toBe(0)
    expect(d2.sent[0]!.text).toBe(M.en.postBlocked(M.en.fields.price))
  })

  it('post when the draft is gone: postGone, context cleared', async () => {
    const d2 = makeDeps({draft: null})
    const c2 = await seeded(d2)
    d2.sent.length = 0
    await handleReviewCallback(cbFor(c2, 'p'), d2)
    expect(d2.sent[0]!.text).toBe(M.en.postGone)
    expect(await loadReview(d2.redis, 42)).toBeNull()
  })

  it('post without siteBaseUrl publishes and links Studio instead', async () => {
    const d2 = makeDeps({settings: {botAllowPublish: true}})
    const c2 = await seeded(d2)
    d2.sent.length = 0
    await handleReviewCallback(cbFor(c2, 'p'), d2)
    expect(d2.txnCommits).toBe(1)
    expect(d2.sent[0]!.text).toContain(M.en.postNoBaseUrl)
    expect(d2.sent[0]!.text).toContain('https://studio.example/intent/edit/id=property-tg-x;type=property')
  })
})

describe('handleUpdateAnswer', () => {
  const emptyFacts = () => ({
    price: null, dealType: null, areaM2: null, bedrooms: null, bathrooms: null, floor: null,
    yearBuilt: null, propertyTypeName: null, cityName: null, districtName: null, address: null,
    amenityNames: [] as string[],
  })

  const answerItems = (text: string | null, photo = false): GroupItem[] => [
    {photoFileId: photo ? 'f1' : null, text, senderId: 42, chatId: 42, username: null, languageCode: 'en'},
  ]

  async function updatingDeps(parseUpd?: UpdateParse | null) {
    const deps = makeDeps({parseUpd: parseUpd ?? null})
    const ctx = await seeded(deps)
    await handleReviewCallback(cbFor(ctx, 'u'), deps)
    deps.sent.length = 0
    deps.edits.length = 0
    return {deps, ctx}
  }

  it('applies a parsed answer: patches, re-previews with fresh token, mode -> reviewing', async () => {
    const upd: UpdateParse = {facts: {...emptyFacts(), bedrooms: 3}, editorial: null, parserNotes: ''}
    const {deps, ctx} = await updatingDeps(upd)
    await handleUpdateAnswer(answerItems('3 bedrooms'), deps)
    const after = (await loadReview(deps.redis, 42))!
    expect(after.mode).toBe('reviewing')
    expect(after.token).not.toBe(ctx.token)
    expect(after.data.parsed.facts.bedrooms).toBe(3)
    // fresh report + fresh preview were sent
    expect(deps.sent.some((s) => s.text.includes('🏠') && s.inline)).toBe(true)
    // old preview keyboard removed
    expect(deps.edits.some((e) => e.kb === null && e.messageId === ctx.previewMessageId)).toBe(true)
  })

  it('unparseable answer: updNothingParsed, still updating', async () => {
    const {deps} = await updatingDeps({facts: emptyFacts(), editorial: null, parserNotes: ''})
    await handleUpdateAnswer(answerItems('hello there'), deps)
    expect(deps.sent[0]!.text).toBe(M.en.updNothingParsed)
    expect((await loadReview(deps.redis, 42))!.mode).toBe('updating')
  })

  it('photos-only answer uploads and re-previews', async () => {
    const {deps} = await updatingDeps({facts: emptyFacts(), editorial: null, parserNotes: ''})
    await handleUpdateAnswer(answerItems(null, true), deps)
    const after = (await loadReview(deps.redis, 42))!
    expect(after.mode).toBe('reviewing')
    expect(after.data.photoCount).toBe(7) // 6 + 1
  })
})
