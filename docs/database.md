# Database

PostgreSQL with Prisma. Local image: `pgvector/pgvector:pg16`.

## Extensions

- `vector` (pgvector)
- `uuid-ossp`
- `pg_trgm`

## Core entities

Users/roles/permissions, properties/units/media, communities/developers, amenities, chat sessions/messages, saved searches/favorites, knowledge documents/chunks, AI settings/logs, API providers/credentials/sync jobs, notifications, audit logs.

## Vector columns

`document_chunks.embedding` is `vector(1536)` via Prisma `Unsupported`. Similarity queries use raw SQL helpers (Phase 13).

## Migrations

```bash
npx prisma migrate dev
```

Production destructive migrations require explicit approval.
