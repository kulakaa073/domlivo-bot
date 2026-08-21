import {log, errInfo} from './log.js'
import type {ParsedListing} from './types.js'
import {DEFAULT_LOCALES, localeLabels, localeObjectSchema} from './locales.js'

export const MODEL = 'claude-sonnet-5'

/** Structural subset of the Anthropic SDK client, so tests can fake it. */
export type AnthropicLike = {
  messages: {
    create(params: Record<string, unknown>): Promise<{content: Array<Record<string, unknown>>}>
  }
}

/** JSON schema for the facts block — shared by the full parse and the update parse. */
export const FACTS_SCHEMA: Record<string, unknown> = {
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
}

export function buildListingSchema(locales: readonly string[]): Record<string, unknown> {
  const LOCALE_STRING = localeObjectSchema(locales)
  return buildSchemaBody(LOCALE_STRING)
}

/** Default-locale schema kept as a named export for tests and the Telegram path. */
export const LISTING_SCHEMA = buildListingSchema(DEFAULT_LOCALES)

function buildSchemaBody(LOCALE_STRING: Record<string, unknown>): Record<string, unknown> {
  return SCHEMA_TEMPLATE(LOCALE_STRING)
}

function SCHEMA_TEMPLATE(LOCALE_STRING: Record<string, unknown>): Record<string, unknown> {
  return {
  type: 'object',
  properties: {
    facts: FACTS_SCHEMA,
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
  }
}

const SYSTEM_PROMPT_TEMPLATE = `You parse property listing messages for DomLivo, an Albanian real-estate site, and prepare them for its CMS.

Rules for facts:
- Extract ONLY what the text states. Return null for anything not stated. Never guess or infer.
- Albanian room notation: "2+1" means 2 bedrooms + 1 living room, so bedrooms = 2. "garsonierë"/"garsoniere"/studio means a studio apartment: bedrooms = 1 (DomLivo convention — the single living/sleeping room counts as one bedroom), propertyTypeName "Studio".
- price: report the amount and currency exactly as written (lek/lekë/L means ALL). Do NOT convert currencies. period: "per_month" for rentals quoted monthly, "per_m2" if quoted per square metre, otherwise "total".
- cityName / districtName / propertyTypeName: the name as commonly written in Latin-script Albanian (e.g. "Shkodër", "Parrucë", "Apartament").
- amenityNames: short English names, e.g. "Elevator", "Parking", "Balcony", "Sea view".

Rules for editorial — write title, shortDescription and description in ALL of these locales: __LOCALES__:
- title: at most 70 characters, factual, no hype. Pattern: "<rooms> apartment in <district>, <city>" adapted to what is known.
- shortDescription: 1–2 sentences.
- description: 80–150 words built STRICTLY from stated facts. No invented details, no superlatives about things the text does not say.

The input may be SEVERAL messages concatenated (separated by blank lines) and can include unrelated chatter or, occasionally, TWO different properties. Extract the SINGLE most complete property listing and ignore the rest. If you skip a second property or discard unrelated content, say so briefly in parserNotes (e.g. "a second property was mentioned — skipped; submit it separately").

sourceLanguage: BCP-47 code of the input text ("sq", "ru", ...).
parserNotes: one or two sentences about anything ambiguous or unusual (e.g. the price might be in old lek, the location is unclear, content was discarded). Empty string if nothing.`

/** One call parses the caption AND writes every requested locale. Returns null on any failure (logged). */
export async function parseListing(
  client: AnthropicLike,
  caption: string,
  photoCount: number,
  locales: readonly string[] = DEFAULT_LOCALES,
): Promise<ParsedListing | null> {
  try {
    const system = SYSTEM_PROMPT_TEMPLATE.replace('__LOCALES__', localeLabels(locales))
    const schema = locales === DEFAULT_LOCALES ? LISTING_SCHEMA : buildListingSchema(locales)
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 4000 + locales.length * 400,
      system,
      messages: [{role: 'user', content: `Photos attached: ${photoCount}\n\nListing text:\n${caption}`}],
      tools: [{name: 'record_listing', description: 'Record the parsed listing.', input_schema: schema}],
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
