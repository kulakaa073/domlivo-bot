/**
 * One-shot: enable the bot's 🚀 Post button and set the live-site origin.
 *   SANITY_WRITE_TOKEN=... npx tsx scripts/enableBotPublish.ts [siteBaseUrl]
 * Reverse with: npx tsx scripts/enableBotPublish.ts --off
 */
import {createClient} from '@sanity/client'

const token = process.env.SANITY_WRITE_TOKEN?.trim()
if (!token) {
  console.error('SANITY_WRITE_TOKEN is required')
  process.exit(1)
}

const off = process.argv.includes('--off')
const siteBaseUrl =
  process.argv.filter((a) => !a.startsWith('--'))[2]?.replace(/\/+$/, '') || 'https://www.domlivo.com'

const client = createClient({
  projectId: process.env.SANITY_PROJECT_ID?.trim() || 'g4aqp6ex',
  dataset: process.env.SANITY_DATASET?.trim() || 'production',
  apiVersion: '2025-01-01',
  token,
  useCdn: false,
})

const set = off ? {botAllowPublish: false} : {botAllowPublish: true, siteBaseUrl}
const result = await client.patch('siteSettings').set(set).commit()
console.log('siteSettings updated:', {
  botAllowPublish: (result as {botAllowPublish?: boolean}).botAllowPublish,
  siteBaseUrl: (result as {siteBaseUrl?: string}).siteBaseUrl,
})
