# Deployment

## Target

- Cloudflare (optional edge)
- Vercel — Next.js web
- Supabase — PostgreSQL + Storage
- Redis + worker VM/container (not on the Next.js process)
- OpenAI

## Local

```bash
npm run docker:up
npm run dev
npm run worker
```

## CI

GitHub Actions runs install → prisma generate → typecheck → lint → test → build.

Do not auto-apply destructive production migrations.
