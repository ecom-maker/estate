# Troubleshooting

## Prisma cannot connect

Ensure Docker is running: `npm run docker:up`, then check `DATABASE_URL`.

## Auth Google button fails

Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. Without them, use phone OTP mock code `000000`.

## AI responses are heuristic-only

Configure OpenAI via `/admin/ai` or `OPENAI_API_KEY`. Encrypted DB key is preferred.

## Images not loading

`images.unsplash.com` must be allowed in `next.config.ts` remotePatterns.
