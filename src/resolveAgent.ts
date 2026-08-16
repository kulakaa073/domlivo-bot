export type SanityFetchLike = {
  fetch(query: string, params?: Record<string, unknown>): Promise<unknown>
}

export type SanityCreateIfNotExistsLike = {
  createIfNotExists(doc: Record<string, unknown> & {_id: string; _type: string}): Promise<unknown>
}

export type AuthResult =
  | {kind: 'ok'; agentId: string; agentName: string}
  | {kind: 'disabled'}
  | {kind: 'pending'}
  | {kind: 'unknown'}

const QUERY = `{
  "settings": *[_type == "siteSettings"][0]{
    botEnabled,
    botOwnerTelegramUserId,
    "defaultAgent": botDefaultAgent->{_id, name}
  },
  "agent": *[_type == "agent" && telegramUserId == $senderId][0]{_id, name},
  "request": *[_type == "botAccessRequest" && telegramUserId == $senderId][0]{
    approved,
    "agent": agent->{_id, name}
  }
}`

type QueryResult = {
  settings: {
    botEnabled?: boolean
    botOwnerTelegramUserId?: number
    defaultAgent?: {_id: string; name: string} | null
  } | null
  agent: {_id: string; name: string} | null
  request: {approved?: boolean; agent?: {_id: string; name: string} | null} | null
}

/**
 * Auth order: direct agent.telegramUserId match -> owner id -> approved access
 * request (the manager-driven onboarding path) -> pending request -> unknown.
 */
export async function resolveAgent(sanity: SanityFetchLike, senderId: number): Promise<AuthResult> {
  const r = (await sanity.fetch(QUERY, {senderId})) as QueryResult
  // Unconfigured settings mean OFF — the safe default.
  if (r.settings?.botEnabled !== true) return {kind: 'disabled'}
  if (r.agent) return {kind: 'ok', agentId: r.agent._id, agentName: r.agent.name}
  if (r.settings.botOwnerTelegramUserId === senderId && r.settings.defaultAgent) {
    return {kind: 'ok', agentId: r.settings.defaultAgent._id, agentName: r.settings.defaultAgent.name}
  }
  if (r.request?.approved === true && r.request.agent) {
    return {kind: 'ok', agentId: r.request.agent._id, agentName: r.request.agent.name}
  }
  if (r.request) return {kind: 'pending'}
  return {kind: 'unknown'}
}

/**
 * Files an access request for an unknown sender who pressed /start.
 * createIfNotExists with a deterministic id: a second /start is a no-op and an
 * already-approved request can never be overwritten back to pending.
 */
export async function fileAccessRequest(
  sanity: SanityCreateIfNotExistsLike,
  who: {senderId: number; username: string | null; firstName: string | null},
): Promise<void> {
  await sanity.createIfNotExists({
    _id: `botAccessRequest-${who.senderId}`,
    _type: 'botAccessRequest',
    telegramUserId: who.senderId,
    ...(who.username ? {username: who.username} : {}),
    ...(who.firstName ? {firstName: who.firstName} : {}),
    requestedAt: new Date().toISOString(),
    approved: false,
  })
}
