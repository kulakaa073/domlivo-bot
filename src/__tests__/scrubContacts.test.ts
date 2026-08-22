import {describe, it, expect} from 'vitest'
import {scrubContacts, scrubEditorial} from '../scrubContacts.js'

describe('scrubContacts', () => {
  it('removes an Albanian phone number and the label left dangling', () => {
    const r = scrubContacts('Asking price is negotiable. Kontakt: 069 45 67 890.')
    expect(r.text).toBe('Asking price is negotiable.')
    expect(r.removed).toBe(true)
  })

  it('removes international, dashed and parenthesised numbers', () => {
    expect(scrubContacts('Call +355 69 234 5678 today').text).toBe('Call today')
    expect(scrubContacts('Sea view flat. Tel 069-45-67-890').text).toBe('Sea view flat.')
    expect(scrubContacts('Sea view flat. Phone: (069) 4567890').text).toBe('Sea view flat.')
  })

  it('removes e-mails, links and handles', () => {
    expect(scrubContacts('Write to agjenti@domlivo.al for a viewing').text).toBe('Write to for a viewing')
    expect(scrubContacts('More at https://example.com/listing/1 now').text).toBe('More at now')
    expect(scrubContacts('Ask @domlivo_agent about it').text).toBe('Ask about it')
  })

  it('leaves prices alone, whatever separator they use', () => {
    for (const s of [
      'Çmimi 10.500.000 lekë.',
      'Çmimi 10 500 000 lekë.',
      'Price 420,000 EUR.',
      'The asking price is 92.000 euro, negotiable.',
      '€10 500 000 for the whole building.',
    ]) {
      expect(scrubContacts(s).text).toBe(s)
      expect(scrubContacts(s).removed).toBe(false)
    }
  })

  it('leaves ordinary listing prose byte-identical', () => {
    const s =
      'A 78 m² apartment on the 4th floor of a 2019 building, with a balcony facing the sea.\n\nThe bus runs every 20 minutes.'
    const r = scrubContacts(s)
    expect(r.text).toBe(s)
    expect(r.removed).toBe(false)
  })

  it('keeps coordinates and years intact', () => {
    expect(scrubContacts('Pin at 41.4830, 19.4600 on the map.').text).toBe('Pin at 41.4830, 19.4600 on the map.')
    expect(scrubContacts('Built in 2022, sold furnished.').text).toBe('Built in 2022, sold furnished.')
  })
})

describe('scrubEditorial', () => {
  const editorial = {
    title: {en: 'Apartment in Durrës', sq: 'Apartament në Durrës'},
    shortDescription: {en: 'Sea view. Kontakt: 069 45 67 890.', sq: 'Pamje nga deti.'},
    description: {en: 'Quiet street.', sq: 'Rrugë e qetë. Tel 069-45-67-890.'},
  }

  it('scrubs every locale of every editorial field and reports that it did', () => {
    const r = scrubEditorial(editorial)
    expect(r.editorial.shortDescription.en).toBe('Sea view.')
    expect(r.editorial.description.sq).toBe('Rrugë e qetë.')
    expect(r.editorial.title.en).toBe('Apartment in Durrës')
    expect(r.removed).toBe(true)
  })

  it('reports nothing when there was nothing to remove', () => {
    const clean = {title: {en: 'Apartment'}, shortDescription: {en: 'Nice.'}, description: {en: 'Quiet.'}}
    const r = scrubEditorial(clean)
    expect(r.removed).toBe(false)
    expect(r.editorial).toEqual(clean)
  })
})
