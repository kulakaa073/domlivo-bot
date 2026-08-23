import {log, errInfo} from './log.js'
import type {ParsedFacts, LocaleMap} from './types.js'
import {MODEL, FACTS_SCHEMA, type AnthropicLike} from './parseListing.js'
import {DEFAULT_LOCALES, localeLabels, localeObjectSchema} from './locales.js'

export type UpdateEditorial = Partial<{
  title: LocaleMap
  shortDescription: LocaleMap
  description: LocaleMap
}>

export type UpdateParse = {
  /** null / [] fields mean "not provided in this answer", NOT "clear the value". */
  facts: ParsedFacts
  /** Only present when the answer contained new descriptive text. */
  editorial: UpdateEditorial | null
  parserNotes: string
}

function buildUpdateSchema(locales: readonly string[]): Record<string, unknown> {
  const LOCALE_STRING = localeObjectSchema(locales)
  return {
    type: 'object',
    properties: {
      facts: FACTS_SCHEMA,
      editorial: {
        anyOf: [
          {type: 'null'},
          {
            type: 'object',
            properties: {title: LOCALE_STRING, shortDescription: LOCALE_STRING, description: LOCALE_STRING},
            additionalProperties: false,
          },
        ],
      },
      parserNotes: {type: 'string'},
    },
    required: ['facts', 'editorial', 'parserNotes'],
    additionalProperties: false,
  }
}

const SYSTEM_PROMPT_TEMPLATE = `You are updating an EXISTING property listing draft for DomLivo, an Albanian real-estate site. The agent was asked for specific missing fields and replied.

Rules:
- Extract ONLY what the reply provides. Return null (or [] for amenityNames) for every field the reply does not mention. Never guess, never repeat current values back.
- The reply may be terse ("120000", "3 bedrooms, Durrës"). Use the missing-fields list to interpret bare values: a lone number when "price" is missing is the price; a lone small number when "bedrooms" is missing is the bedroom count.
- Same conventions as intake: "2+1" -> bedrooms 2, rooms 3; Russian "двухкомнатная" -> rooms 2, bedrooms 1; lek/lekë/L means ALL; do not convert currencies; names in Latin-script Albanian.
- editorial: null UNLESS the reply contains genuinely new descriptive text about the property. In that case write ONLY the changed fields (title/shortDescription/description), each in ALL of these locales: __LOCALES__.
- parserNotes: one short sentence about anything ambiguous, else empty string.`

/**
 * Focused parse of an update-mode answer. Returns null on any failure (logged).
 * The caller merges the result into the current facts — this function never merges.
 */
export async function parseUpdate(
  client: AnthropicLike,
  answer: string,
  currentFacts: ParsedFacts,
  missingLabels: string[],
  newPhotoCount: number,
  locales: readonly string[] = DEFAULT_LOCALES,
): Promise<UpdateParse | null> {
  try {
    const system = SYSTEM_PROMPT_TEMPLATE.replace('__LOCALES__', localeLabels(locales))
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 2000 + locales.length * 400,
      system,
      messages: [
        {
          role: 'user',
          content:
            `Current facts (for interpretation only — do NOT repeat them back):\n${JSON.stringify(currentFacts)}\n\n` +
            `Fields the agent was asked for: ${missingLabels.join(', ') || '(free correction)'}\n` +
            `New photos attached: ${newPhotoCount}\n\n` +
            `Agent's reply:\n${answer}`,
        },
      ],
      tools: [{name: 'record_update', description: 'Record the update.', input_schema: buildUpdateSchema(locales)}],
      tool_choice: {type: 'tool', name: 'record_update'},
    })
    const tool = msg.content.find((b) => b.type === 'tool_use')
    if (!tool) {
      log('error', 'parse_update_no_tool_use', {contentTypes: msg.content.map((b) => b.type)})
      return null
    }
    return tool.input as UpdateParse
  } catch (e) {
    log('error', 'parse_update_failed', {answerLength: answer.length, ...errInfo(e)})
    return null
  }
}

/** Non-null update fields win; amenityNames append-dedupe. Pure. */
export function mergeFacts(current: ParsedFacts, upd: ParsedFacts): ParsedFacts {
  return {
    price: upd.price ?? current.price,
    dealType: upd.dealType ?? current.dealType,
    areaM2: upd.areaM2 ?? current.areaM2,
    bedrooms: upd.bedrooms ?? current.bedrooms,
    rooms: upd.rooms ?? current.rooms,
    bathrooms: upd.bathrooms ?? current.bathrooms,
    floor: upd.floor ?? current.floor,
    yearBuilt: upd.yearBuilt ?? current.yearBuilt,
    propertyTypeName: upd.propertyTypeName ?? current.propertyTypeName,
    cityName: upd.cityName ?? current.cityName,
    districtName: upd.districtName ?? current.districtName,
    address: upd.address ?? current.address,
    amenityNames: [...new Set([...current.amenityNames, ...upd.amenityNames])],
  }
}

/** Replace only the editorial fields the update provided. Pure. */
export function mergeEditorial(
  current: {title: LocaleMap; shortDescription: LocaleMap; description: LocaleMap},
  upd: UpdateEditorial | null,
): {title: LocaleMap; shortDescription: LocaleMap; description: LocaleMap} {
  if (!upd) return current
  return {
    title: upd.title ?? current.title,
    shortDescription: upd.shortDescription ?? current.shortDescription,
    description: upd.description ?? current.description,
  }
}

/** True when the answer contributed nothing at all (no facts, no editorial, no photos). */
export function isEmptyUpdate(upd: UpdateParse, newPhotoCount: number): boolean {
  if (newPhotoCount > 0 || upd.editorial) return false
  const f = upd.facts
  return (
    f.price === null && f.dealType === null && f.areaM2 === null && f.bedrooms === null &&
    f.bathrooms === null && f.floor === null && f.yearBuilt === null && f.propertyTypeName === null &&
    f.cityName === null && f.districtName === null && f.address === null && f.amenityNames.length === 0
  )
}
