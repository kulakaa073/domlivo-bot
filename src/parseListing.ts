import {log, errInfo} from './log.js'
import type {ParsedListing} from './types.js'

export const MODEL = 'claude-sonnet-5'

/** Structural subset of the Anthropic SDK client, so tests can fake it. */
export type AnthropicLike = {
  messages: {
    create(params: Record<string, unknown>): Promise<{content: Array<Record<string, unknown>>}>
  }
}

const LOCALES = ['en', 'uk', 'ru', 'sq', 'it'] as const

const LOCALE_STRING = {
  type: 'object',
  properties: Object.fromEntries(LOCALES.map((l) => [l, {type: 'string'}])),
  required: [...LOCALES],
  additionalProperties: false,
}

export const LISTING_SCHEMA = {
  type: 'object',
  properties: {
    facts: {
      type: 'object',
      properties: {
        price: {
          anyOf: [
            {type: 'null'},
            {
              type: 'object',
              properties: {
                amount: {type: 'number'},
                currency: {enum: ['EUR', 'ALL', 'USD']},
                period: {enum: ['total', 'per_m2', 'per_month']},
              },
              required: ['amount', 'currency', 'period'],
              additionalProperties: false,
            },
          ],
        },
        dealType: {anyOf: [{type: 'null'}, {enum: ['sale', 'rent']}]},
        areaM2: {type: ['number', 'null']},
        bedrooms: {type: ['integer', 'null']},
        bathrooms: {type: ['integer', 'null']},
        floor: {type: ['integer', 'null']},
        yearBuilt: {type: ['integer', 'null']},
        propertyTypeName: {type: ['string', 'null']},
        cityName: {type: ['string', 'null']},
        districtName: {type: ['string', 'null']},
        address: {type: ['string', 'null']},
        amenityNames: {type: 'array', items: {type: 'string'}},
      },
      required: [
        'price', 'dealType', 'areaM2', 'bedrooms', 'bathrooms', 'floor', 'yearBuilt',
        'propertyTypeName', 'cityName', 'districtName', 'address', 'amenityNames',
      ],
      additionalProperties: false,
    },
    editorial: {
      type: 'object',
      properties: {title: LOCALE_STRING, shortDescription: LOCALE_STRING, description: LOCALE_STRING},
      required: ['title', 'shortDescription', 'description'],
      additionalProperties: false,
    },
    sourceLanguage: {type: 'string'},
    parserNotes: {type: 'string'},
  },
  required: ['facts', 'editorial', 'sourceLanguage', 'parserNotes'],
  additionalProperties: false,
} as const

const SYSTEM_PROMPT = `You parse property listing messages for DomLivo, an Albanian real-estate site, and prepare them for its CMS.

Rules for facts:
- Extract ONLY what the text states. Return null for anything not stated. Never guess or infer.
- Albanian room notation: "2+1" means 2 bedrooms + 1 living room, so bedrooms = 2. "garsonierë"/"garsoniere" means a studio: bedrooms = 0, propertyTypeName "Studio".
- price: report the amount and currency exactly as written (lek/lekë/L means ALL). Do NOT convert currencies. period: "per_month" for rentals quoted monthly, "per_m2" if quoted per square metre, otherwise "total".
- cityName / districtName / propertyTypeName: the name as commonly written in Latin-script Albanian (e.g. "Shkodër", "Parrucë", "Apartament").
- amenityNames: short English names, e.g. "Elevator", "Parking", "Balcony", "Sea view".

Rules for editorial — write title, shortDescription and description in ALL five locales (en, uk, ru, sq, it):
- title: at most 70 characters, factual, no hype. Pattern: "<rooms> apartment in <district>, <city>" adapted to what is known.
- shortDescription: 1–2 sentences.
- description: 80–150 words built STRICTLY from stated facts. No invented details, no superlatives about things the text does not say.

The input may be SEVERAL messages concatenated (separated by blank lines) and can include unrelated chatter or, occasionally, TWO different properties. Extract the SINGLE most complete property listing and ignore the rest. If you skip a second property or discard unrelated content, say so briefly in parserNotes (e.g. "a second property was mentioned — skipped; submit it separately").

sourceLanguage: BCP-47 code of the input text ("sq", "ru", ...).
parserNotes: one or two sentences about anything ambiguous or unusual (e.g. the price might be in old lek, the location is unclear, content was discarded). Empty string if nothing.`

/** One call parses the caption AND writes all five locales. Returns null on any failure (logged). */
export async function parseListing(
  client: AnthropicLike,
  caption: string,
  photoCount: number,
): Promise<ParsedListing | null> {
  try {
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      messages: [{role: 'user', content: `Photos attached: ${photoCount}\n\nListing text:\n${caption}`}],
      tools: [{name: 'record_listing', description: 'Record the parsed listing.', input_schema: LISTING_SCHEMA}],
      tool_choice: {type: 'tool', name: 'record_listing'},
    })
    const tool = msg.content.find((b) => b.type === 'tool_use')
    if (!tool) {
      log('error', 'parse_no_tool_use', {contentTypes: msg.content.map((b) => b.type)})
      return null
    }
    return tool.input as ParsedListing
  } catch (e) {
    log('error', 'parse_failed', {captionLength: caption.length, ...errInfo(e)})
    return null
  }
}
