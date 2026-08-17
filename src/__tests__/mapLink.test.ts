import {describe, it, expect} from 'vitest'
import {coordsFromUrl, findMapLinks, extractMapCoordinates} from '../mapLink.js'

describe('coordsFromUrl', () => {
  it('reads the place-pin form (!3d!4d), which wins over the viewport', () => {
    const u =
      'https://www.google.com/maps/place/Orikum/@40.32,19.47,15z/data=!3m1!4b1!4m6!3m5!1s0x13453!3d40.3251!4d19.4712'
    expect(coordsFromUrl(u)).toEqual({lat: 40.3251, lng: 19.4712})
  })

  it('reads q=/ll= and /@ forms, including URL-encoded commas', () => {
    expect(coordsFromUrl('https://maps.google.com/?q=41.3275,19.8187')).toEqual({lat: 41.3275, lng: 19.8187})
    expect(coordsFromUrl('https://maps.google.com/?q=41.3275%2C19.8187')).toEqual({lat: 41.3275, lng: 19.8187})
    expect(coordsFromUrl('https://www.google.com/maps/@40.4661,19.4897,17z')).toEqual({lat: 40.4661, lng: 19.4897})
  })

  it('returns null when no coordinates are present', () => {
    expect(coordsFromUrl('https://www.google.com/maps/place/Orikum')).toBeNull()
  })
})

describe('findMapLinks', () => {
  it('finds maps links inside listing text and strips trailing punctuation', () => {
    const links = findMapLinks(
      'Shitet apartament, ja vendndodhja: https://maps.app.goo.gl/AbCd123, afer detit.',
    )
    expect(links.length).toBe(1)
    expect(links[0]!.hostname).toBe('maps.app.goo.gl')
  })

  it('ignores non-maps links', () => {
    expect(findMapLinks('see https://example.com/maps/@40.1,19.5 and https://instagram.com/p/x')).toEqual([])
  })
})

describe('extractMapCoordinates', () => {
  it('expands allowlisted short links and returns in-bounds coordinates', async () => {
    const fakeFetch = (async (url: string | URL | Request) => {
      expect(String(url)).toContain('maps.app.goo.gl')
      return {url: 'https://www.google.com/maps/place/X/@40.32,19.47,15z/data=!3d40.3251!4d19.4712'} as Response
    }) as typeof fetch
    const r = await extractMapCoordinates('Prona ketu https://maps.app.goo.gl/AbCd123', fakeFetch)
    expect(r).toEqual({linkFound: true, coords: {lat: 40.3251, lng: 19.4712}})
  })

  it('reports linkFound with null coords when the pin is unreadable or out of bounds', async () => {
    const noCoords = await extractMapCoordinates('https://www.google.com/maps/place/Orikum')
    expect(noCoords).toEqual({linkFound: true, coords: null})
    const paris = await extractMapCoordinates('https://www.google.com/maps/@48.8566,2.3522,12z')
    expect(paris).toEqual({linkFound: true, coords: null})
  })

  it('degrades to null coords when short-link expansion fails, never throws', async () => {
    const failFetch = (async () => Promise.reject(new Error('ENOTFOUND'))) as typeof fetch
    const r = await extractMapCoordinates('https://maps.app.goo.gl/AbCd123', failFetch)
    expect(r).toEqual({linkFound: true, coords: null})
  })

  it('returns linkFound false for text without map links', async () => {
    expect(await extractMapCoordinates('Shitet 2+1 ne Durres 76m2')).toEqual({linkFound: false, coords: null})
  })
})
