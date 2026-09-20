# Deployment

## Target

- Vercel — Next.js web (`ecom-maker/estate`)
- Supabase — PostgreSQL + pgvector + Storage
- Redis + worker VM/container (not on the Next.js process)
- OpenAI

## Supabase + Vercel

Follow [supabase.md](./supabase.md): set pooler `DATABASE_URL`, direct `DIRECT_URL`, API keys, enable `vector`, then verify with `GET /api/health`.

## Local

```bash
npm run docker:up
npm run dev
npm run worker
```

## CI

GitHub Actions runs install → prisma generate → typecheck → lint → test → build.

Do not auto-apply destructive production migrations.
