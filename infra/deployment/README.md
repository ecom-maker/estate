# Infrastructure

## Local Docker

`docker/docker-compose.yml` runs:

- Postgres 16 + pgvector on host port `55432`
- Redis 7 on host port `6380`

```bash
npm run docker:up
npx prisma db push
npm run db:seed
```

## Suggested production layout

```text
Cloudflare → Vercel (Next.js)
               ├─ Supabase Postgres + pgvector
               ├─ Supabase Storage
               ├─ Redis
               └─ OpenAI

Redis → Worker VM/container (BullMQ)
```

## Terraform

Do not apply destructive infrastructure automatically. Keep IaC under `infra/terraform/` as documentation-first stubs until explicitly approved.
