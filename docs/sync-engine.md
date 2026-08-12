# Sync engine

`lib/sync/engine.ts` upserts normalized properties from connector adapters.

## Modes

- Manual via `POST /api/sync` `{ "source": "crm" | "mls" | "transactions" }`
- Scheduled (BullMQ) in worker processors
- Incremental / full (job `mode` field)

## Deduplication

Unique on `(source, externalId)`. Uncertain merges are never automatic.

## Embedding invalidation

Only queue embedding updates when searchable text fields change (description, amenities, community, title).
