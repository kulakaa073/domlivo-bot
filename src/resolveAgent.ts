export type SanityFetchLike = {
  fetch(query: string, params?: Record<string, unknown>): Promise<unknown>
}

export type AuthResult =
  | {kind: 'ok'; agentId: string; agentName: string}
  | {kind: 'disabled'}
  | {kind: 'unknown'}

const QUERY = `{
  "settings": *[_type == "siteSettings"][0]{
    botEnabled,
    botOwnerTelegramUserId,
    "defaultAgent": botDefaultAgent->{_id, name}
  },
  "agent": *[_type == "agent" && telegramUserId == $senderId][0]{_id, name}
}`

type QueryResult = {
  settings: {
    botEnabled?: boolean
    botOwnerTelegramUserId?: number
    defaultAgent?: {_id: string; name: string} | null
  } | null
  agent: {_id: string; name: string} | null
}

export async function resolveAgent(sanity: SanityFetchLike, senderId: number): Promise<AuthResult> {
  const r = (await sanity.fetch(QUERY, {senderId})) as QueryResult
  // Unconfigured settings mean OFF — the safe default.
  if (r.settings?.botEnabled !== true) return {kind: 'disabled'}
  if (r.agent) return {kind: 'ok', agentId: r.agent._id, agentName: r.agent.name}
  if (r.settings.botOwnerTelegramUserId === senderId && r.settings.defaultAgent) {
    return {kind: 'ok', agentId: r.settings.defaultAgent._id, agentName: r.settings.defaultAgent.name}
  }
  return {kind: 'unknown'}
}
