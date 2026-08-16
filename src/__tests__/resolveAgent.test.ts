import {describe, it, expect} from 'vitest'
import {resolveAgent, fileAccessRequest, type SanityFetchLike} from '../resolveAgent.js'

function sanityWith(data: {
  settings?: {botEnabled?: boolean; botOwnerTelegramUserId?: number; defaultAgent?: {_id: string; name: string} | null}
  agent?: {_id: string; name: string} | null
  request?: {approved?: boolean; agent?: {_id: string; name: string} | null} | null
}): SanityFetchLike {
  return {
    fetch: async () => ({
      settings: data.settings ?? null,
      agent: data.agent ?? null,
      request: data.request ?? null,
    }),
  }
}

describe('resolveAgent', () => {
  it('refuses everyone when the kill-switch is off or settings are missing', async () => {
    expect((await resolveAgent(sanityWith({}), 111)).kind).toBe('disabled')
    expect(
      (await resolveAgent(sanityWith({settings: {botEnabled: false}}), 111)).kind,
    ).toBe('disabled')
  })

  it('matches an agent by telegramUserId', async () => {
    const r = await resolveAgent(
      sanityWith({settings: {botEnabled: true}, agent: {_id: 'agent-blerina', name: 'Blerina'}}),
      111,
    )
    expect(r).toEqual({kind: 'ok', agentId: 'agent-blerina', agentName: 'Blerina'})
  })

  it('maps the owner id to the default agent', async () => {
    const r = await resolveAgent(
      sanityWith({
        settings: {botEnabled: true, botOwnerTelegramUserId: 222, defaultAgent: {_id: 'agent-dom', name: 'DomLivo'}},
      }),
      222,
    )
    expect(r).toEqual({kind: 'ok', agentId: 'agent-dom', agentName: 'DomLivo'})
  })

  it('refuses unknown senders', async () => {
    const r = await resolveAgent(sanityWith({settings: {botEnabled: true}}), 999)
    expect(r.kind).toBe('unknown')
  })

  it('authorizes an approved access request with an agent set', async () => {
    const r = await resolveAgent(
      sanityWith({settings: {botEnabled: true}, request: {approved: true, agent: {_id: 'agent-f', name: 'Fedir'}}}),
      555,
    )
    expect(r).toEqual({kind: 'ok', agentId: 'agent-f', agentName: 'Fedir'})
  })

  it('reports pending for an unapproved request, and for approved-without-agent', async () => {
    expect(
      (await resolveAgent(sanityWith({settings: {botEnabled: true}, request: {approved: false}}), 555)).kind,
    ).toBe('pending')
    expect(
      (await resolveAgent(sanityWith({settings: {botEnabled: true}, request: {approved: true, agent: null}}), 555)).kind,
    ).toBe('pending')
  })
})

describe('fileAccessRequest', () => {
  it('createIfNotExists with a deterministic id — can never overwrite an approval', async () => {
    const calls: Record<string, unknown>[] = []
    await fileAccessRequest(
      {createIfNotExists: async (doc) => (calls.push(doc), doc)},
      {senderId: 42, username: 'fedirdev', firstName: 'Fedir'},
    )
    expect(calls[0]).toMatchObject({
      _id: 'botAccessRequest-42',
      _type: 'botAccessRequest',
      telegramUserId: 42,
      username: 'fedirdev',
      approved: false,
    })
  })
})
