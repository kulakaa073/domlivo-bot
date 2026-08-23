# domlivo-bot

Telegram property-intake bot for DomLivo. Agents DM the bot an album of photos
with the listing text as the caption; the bot parses it with one Claude call,
translates to en/uk/ru/sq/it, uploads the photos, and creates a **draft**
`property` in Sanity, replying with what it understood, what's missing, and a
Studio link.

After the draft, the bot sends a **preview** of the listing as the site would
render it, with inline buttons: **✏️ Update** asks for the missing fields,
reads the agent's next message (text and/or photos), patches the draft, and
re-previews; **🚀 Post** publishes the draft (code-side gate: title, price,
deal, type, city, ≥1 photo) and replies with the live site URL. Post only
appears when `botAllowPublish` is on in Studio settings. `🔄 Restart` (or
`/restart`) resets bot state from any point — it never deletes anything in
Studio.

Spec: `domlivo-workspace/docs/engineering/SPEC-telegram-bot-2026-08-15.md` and
`SPEC-bot-review-flow-2026-08-20.md` (preview/Update/Post/restart).
Plan: `domlivo-workspace/docs/engineering/PLAN-telegram-bot-2026-08-16.md`.
Deployed on Vercel as its own project; webhook at `/api/telegram`.

Failure policy: every failure logs a detailed structured line (visible in
Vercel logs) and the user gets only a bare "something went wrong" reply.
The webhook always returns 200 so Telegram never retry-storms.

## Environment variables

| Var | Required | Where to get it |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | yes | @BotFather → `/newbot` |
| `TELEGRAM_WEBHOOK_SECRET` | yes | generate: `openssl rand -hex 32` |
| `ANTHROPIC_API_KEY` | yes | console.anthropic.com → API keys |
| `SANITY_WRITE_TOKEN` | yes | sanity.io/manage → project `g4aqp6ex` → API → Tokens → new token, **Editor** role |
| `UPSTASH_REDIS_REST_URL` | yes | console.upstash.com → create free Redis DB → REST API |
| `UPSTASH_REDIS_REST_TOKEN` | yes | same Upstash page |
| `STUDIO_BASE_URL` | yes | the deployed Studio origin, no trailing slash (e.g. `https://domlivo-admin.vercel.app` — the project has no `studioHost`, so `*.sanity.studio` 404s) |
| `SANITY_PROJECT_ID` | no (default `g4aqp6ex`) | override only for a different project |
| `SANITY_DATASET` | no (default `production`) | override only for a test dataset |

All secrets live on the Vercel project. Behavioral config (`botEnabled`
kill-switch, `botOwnerTelegramUserId`, `botDefaultAgent`, `siteBaseUrl`,
`botAllowPublish` publish kill-switch, per-agent `telegramUserId`) lives in
Sanity Site Settings / Agent documents.

The webhook must be registered with `allowed_updates: ['message',
'callback_query']` (the set-webhook script does this) — inline buttons stay
dead until `npm run set-webhook` has been re-run after the review-flow deploy.

## Deploy

```
npx vercel --prod
TELEGRAM_BOT_TOKEN=... TELEGRAM_WEBHOOK_SECRET=... npm run set-webhook -- https://<project>.vercel.app
```
