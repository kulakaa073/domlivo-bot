import {log, errInfo} from './log.js'

/**
 * Mechanical extraction of coordinates from Google Maps links in the caption —
 * no geocoding service, code only. Most gmaps URL forms carry the coordinates
 * literally; short links resolve to one with a single redirect-following fetch
 * (allowlisted hosts only, so user text can never make the bot call arbitrary
 * servers).
 */

export type Coords = {lat: number; lng: number}
export type MapExtract = {linkFound: boolean; coords: Coords | null}

// Generous Albania-and-surroundings bounds; a pin outside is treated as unreadable.
const LAT_MIN = 39.0
const LAT_MAX = 43.0
const LNG_MIN = 18.5
const LNG_MAX = 21.5

const SHORT_HOSTS = new Set(['maps.app.goo.gl', 'goo.gl', 'g.co'])
const FULL_HOST_RE = /(^|\.)google\.[a-z.]+$/i

function inBounds(c: Coords): boolean {
  return c.lat >= LAT_MIN && c.lat <= LAT_MAX && c.lng >= LNG_MIN && c.lng <= LNG_MAX
}

function parseUrl(raw: string): URL | null {
  try {
    return new URL(raw)
  } catch {
    return null
  }
}

function isMapsUrl(u: URL): boolean {
  if (SHORT_HOSTS.has(u.hostname.toLowerCase())) return true
  return FULL_HOST_RE.test(u.hostname) && /\/maps/i.test(u.pathname)
}

/** Pull lat/lng out of a full Google Maps URL. Order matters: !3d/!4d is the actual pin. */
export function coordsFromUrl(raw: string): Coords | null {
  const s = decodeURIComponent(raw)
  const NUM = '(-?\\d{1,2}\\.\\d+)'
  for (const re of [
    new RegExp(`!3d${NUM}!4d${NUM}`),
    new RegExp(`[?&](?:q|ll|query|center|destination)=${NUM}[, ]${NUM}`),
    new RegExp(`/@${NUM},${NUM}`),
  ]) {
    const m = s.match(re)
    if (m) {
      const c = {lat: Number.parseFloat(m[1]!), lng: Number.parseFloat(m[2]!)}
      if (Number.isFinite(c.lat) && Number.isFinite(c.lng)) return c
    }
  }
  return null
}

/**
 * Fallback for share links that resolve to a place-name search (?q=…&ftid=…)
 * with no numeric coordinates in the URL: the `output=embed` form of the same
 * URL is server-rendered and tiny, and carries the place's [lat,lng] literally.
 * (The full page is useless here — its static center is the VIEWER's IP
 * location, not the place.)
 */
async function coordsFromEmbed(mapsUrl: string, fetchFn: typeof fetch): Promise<Coords | null> {
  try {
    const u = parseUrl(mapsUrl)
    if (!u || !FULL_HOST_RE.test(u.hostname) || !/\/maps/i.test(u.pathname)) return null
    u.searchParams.set('output', 'embed')
    const res = await fetchFn(u.href, {redirect: 'follow'})
    const body = (await res.text()).slice(0, 100_000)
    const m = body.match(/\[(-?\d{1,2}\.\d{4,}),(-?\d{1,3}\.\d{4,})\]/)
    if (!m) return null
    const c = {lat: Number.parseFloat(m[1]!), lng: Number.parseFloat(m[2]!)}
    return Number.isFinite(c.lat) && Number.isFinite(c.lng) ? c : null
  } catch (e) {
    log('warn', 'maplink_embed_failed', {url: mapsUrl, ...errInfo(e)})
    return null
  }
}

export function findMapLinks(text: string): URL[] {
  const raw = text.match(/https?:\/\/\S+/g) ?? []
  return raw
    .map((r) => parseUrl(r.replace(/[.,;)\]]+$/, '')))
    .filter((u): u is URL => u !== null && isMapsUrl(u))
}

/**
 * text -> coordinates, expanding allowlisted short links when needed.
 * Never throws; failures log and degrade to {linkFound, coords: null}.
 */
export async function extractMapCoordinates(
  text: string,
  fetchFn: typeof fetch = fetch,
): Promise<MapExtract> {
  const links = findMapLinks(text)
  if (links.length === 0) return {linkFound: false, coords: null}

  for (const link of links) {
    let target = link.href
    if (SHORT_HOSTS.has(link.hostname.toLowerCase())) {
      try {
        const res = await fetchFn(link.href, {redirect: 'follow'})
        target = res.url || target
      } catch (e) {
        log('warn', 'maplink_expand_failed', {url: link.href, ...errInfo(e)})
        continue
      }
    }
    const coords = coordsFromUrl(target)
    if (coords && inBounds(coords)) return {linkFound: true, coords}
    if (coords) {
      // A real pin, just not in our region — do not second-guess it via embed.
      log('warn', 'maplink_out_of_bounds', {url: link.href, ...coords})
      continue
    }
    // URL carries no numbers (place-name search form) — ask the embed page.
    const embedded = await coordsFromEmbed(target, fetchFn)
    if (embedded && inBounds(embedded)) return {linkFound: true, coords: embedded}
    if (embedded) log('warn', 'maplink_out_of_bounds', {url: link.href, ...embedded})
  }
  return {linkFound: true, coords: null}
}
