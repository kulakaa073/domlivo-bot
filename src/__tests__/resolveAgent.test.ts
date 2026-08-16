import {describe, it, expect} from 'vitest'
import {resolveAgent, type SanityFetchLike} from '../resolveAgent.js'

function sanityWith(data: {
  settings?: {botEnabled?: boolean; botOwnerTelegramUserId?: number; defaultAgent?: {_id: string; name: string} | null}
  agent?: {_id: string; name: string} | null
}): SanityFetchLike {
  return {
    fetch: async () => ({
      settings: data.settings ?? null,
      agent: data.agent ?? null,
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
})
