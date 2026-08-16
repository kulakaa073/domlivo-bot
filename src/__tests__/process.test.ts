import {describe, it, expect, vi} from 'vitest'
import {processMessage, type PipelineDeps} from '../process.js'
import type {GroupItem} from '../assembly.js'

const parsedListing = {
  facts: {
    price: {amount: 59000, currency: 'EUR', period: 'total'},
    dealType: 'sale', areaM2: 76, bedrooms: 2, bathrooms: null, floor: null,
    yearBuilt: null, propertyTypeName: 'Apartament', cityName: 'Shkodër',
    districtName: 'Parrucë', address: null, amenityNames: [],
  },
  editorial: {
    title: {en: 't', uk: 't', ru: 't', sq: 't', it: 't'},
    shortDescription: {en: 's', uk: 's', ru: 's', sq: 's', it: 's'},
    description: {en: 'd', uk: 'd', ru: 'd', sq: 'd', it: 'd'},
  },
  sourceLanguage: 'sq',
  parserNotes: '',
}

function deps(over: Partial<Record<string, unknown>> = {}) {
  const created: Record<string, unknown>[] = []
  const sent: string[] = []
  const d: PipelineDeps = {
    studioBaseUrl: 'https://s',
    sanity: {
      fetch: async (q: string) =>
        q.includes('siteSettings')
          ? {settings: {botEnabled: true}, agent: {_id: 'agent-1', name: 'Blerina'}}
          : {propertyTypes: [{_id: 'pt-1', title: {sq: 'Apartament'}, slug: 'apartment'}], cities: [{_id: 'c-1', title: {sq: 'Shkodër'}, slug: 'shkoder'}], districts: [{_id: 'd-1', title: {sq: 'Parrucë'}, slug: 'parruce', cityId: 'c-1'}], amenities: []},
      create: async (doc: Record<string, unknown>) => {
        created.push(doc)
        return doc
      },
      assets: {upload: async () => ({_id: 'image-1'})},
    } as never,
    telegram: {
      sendMessage: async (_c: number, text: string) => {
        sent.push(text)
        return true
      },
      downloadFile: async () => Buffer.from('img'),
    } as never,
    parse: vi.fn(async () => parsedListing) as never,
    ...over,
  }
  return {d, created, sent}
}

const items: GroupItem[] = [
  {photoFileId: 'f1', text: 'Shitet 2+1 Parruce Shkoder 76m2 59000 EUR', senderId: 111, chatId: 111, username: 'blerina', languageCode: 'en'},
  {photoFileId: 'f2', text: null, senderId: 111, chatId: 111, username: 'blerina', languageCode: 'en'},
]

describe('processMessage', () => {
  it('acknowledges immediately, then creates a draft and replies with the studio link', async () => {
    const {d, created, sent} = deps()
    await processMessage(items, d)
    expect(created.length).toBe(1)
    expect(String(created[0]!._id)).toMatch(/^drafts\.property-tg-/)
    expect(sent.length).toBe(2)
    expect(sent[0]).toContain('processing your listing')
    expect(sent[1]).toContain('Draft created')
    expect(sent[1]).toContain('intent/edit')
  })

  it('refuses unknown senders without writing anything', async () => {
    const {d, created, sent} = deps({
      sanity: {
        fetch: async () => ({settings: {botEnabled: true}, agent: null}),
        create: async () => ({}),
        assets: {upload: async () => ({_id: 'x'})},
      } as never,
    })
    await processMessage(items, d)
    expect(created.length).toBe(0)
    expect(sent[0]).toContain('registered DomLivo agents')
  })

  it('joins every collected text for the parser (session piles)', async () => {
    const captions: string[] = []
    const {d} = deps({
      parse: vi.fn(async (caption: string) => {
        captions.push(caption)
        return parsedListing
      }) as never,
    })
    await processMessage(
      [
        {photoFileId: 'f1', text: 'Shitet 2+1 Parruce', senderId: 111, chatId: 111, username: 'b', languageCode: 'en'},
        {photoFileId: null, text: 'Cmimi 59000 EUR, kati 3', senderId: 111, chatId: 111, username: 'b', languageCode: 'en'},
      ],
      d,
    )
    expect(captions[0]).toContain('Shitet 2+1 Parruce')
    expect(captions[0]).toContain('Cmimi 59000 EUR')
  })

  it('asks for text when the album has no caption', async () => {
    const {d, created, sent} = deps()
    await processMessage([{photoFileId: 'f1', text: null, senderId: 111, chatId: 111, username: 'blerina', languageCode: 'en'}], d)
    expect(created.length).toBe(0)
    expect(sent[0]).toMatch(/caption|description/i)
  })
})
