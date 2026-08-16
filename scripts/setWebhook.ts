/**
 * Registers the Telegram webhook. Run AFTER the Vercel deploy:
 *   TELEGRAM_BOT_TOKEN=... TELEGRAM_WEBHOOK_SECRET=... npm run set-webhook -- https://<project>.vercel.app
 *
 * Pending updates (messages sent while the webhook was down) are KEPT by
 * default — pass --drop-pending to discard them, e.g. after changing bots.
 */
export {} // top-level await needs module context

const token = process.env.TELEGRAM_BOT_TOKEN?.trim()
const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim()
const base = process.argv.filter((a) => !a.startsWith('--'))[2]?.replace(/\/+$/, '')
const dropPending = process.argv.includes('--drop-pending')

if (!token || !secret || !base) {
  console.error('Usage: TELEGRAM_BOT_TOKEN=... TELEGRAM_WEBHOOK_SECRET=... npm run set-webhook -- <deployment-url>')
  process.exit(1)
}

const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: 'POST',
  headers: {'content-type': 'application/json'},
  body: JSON.stringify({
    url: `${base}/api/telegram`,
    secret_token: secret,
    allowed_updates: ['message'],
    drop_pending_updates: dropPending,
  }),
})
console.log(JSON.stringify(await res.json(), null, 2))
