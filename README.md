# DMProperties AI

AI-native luxury real estate discovery platform for **DMProperties**.

Conversational search is the primary product surface — not a bolt-on chatbot.

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- Prisma 6 + PostgreSQL + pgvector
- Auth.js (Google OAuth + phone OTP)
- OpenAI via Vercel AI SDK (streaming)
- Redis + BullMQ workers
- Supabase Storage

> Package manager: **npm** (pnpm was planned; npm is used for compatibility in this environment).

## Quick start

```bash
cp .env.local.example .env.local
npm install
npm run docker:up
npx prisma db push
npm run db:seed
npm run dev
```

Local Docker maps Postgres to **55432** and Redis to **6380** to avoid common host port conflicts.

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Next.js dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript |
| `npm run test` | Vitest unit tests |
| `npm run db:seed` | Seed fictional luxury inventory |
| `npm run worker` | Background worker entrypoint |
| `npm run docker:up` | Postgres (pgvector) + Redis |

## Design system

**Ethereal Estate** — quiet luxury. Tokens live in `app/globals.css`.

- Primary `#0f172a`
- Background `#fcf8fa`
- Accent Champagne Gold `#C5A572`
- Headlines: Libre Caslon Text
- UI/body: Inter

## Documentation

See [`docs/`](./docs/) for architecture, AI, security, connectors, and deployment notes.

## Safety

- Never commit real `.env` files
- LLM never executes SQL — intent → Zod → Search Service → Prisma
- API keys encrypted at rest (`ENCRYPTION_KEY`)
