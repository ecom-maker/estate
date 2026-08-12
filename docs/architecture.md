# Architecture

DMProperties AI is a modular single-repo Next.js application with a separate `workers/` process.

## Runtime topology

```text
Browser → Next.js (Vercel)
            ├─ Route Handlers / Server Components
            ├─ Prisma → PostgreSQL + pgvector
            ├─ Redis (cache, rate limits, queues)
            ├─ OpenAI (chat + embeddings)
            └─ Supabase Storage (media/docs)

Redis → BullMQ Worker
          ├─ CRM / MLS / Transaction sync
          ├─ Document processing + embeddings
          └─ Notifications / cleanup
```

## Conversational search

```text
User message
  → conversation memory / prior intent
  → LLM or heuristic intent extraction
  → Zod-validated SearchIntent
  → Search Service (Prisma filters + pgvector)
  → Ranking Service
  → Streaming AI summary + property cards
```

The LLM never receives the ability to execute SQL.

## Key directories

- `app/` — App Router pages and API routes
- `components/` — UI including `AIChat`
- `lib/` — auth, rbac, ai, search, connectors, storage, crypto
- `prisma/` — schema, migrations, seed
- `workers/` — BullMQ processors
- `docker/` — local Postgres + Redis
- `docs/` — engineering documentation

## Environments

`local` · `staging` · `production` via `APP_ENV`. Local Docker must never point at production databases.
