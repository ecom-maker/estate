# Connect Supabase (Vercel + local)

DMProperties AI uses Supabase for:

1. **PostgreSQL + pgvector** (`DATABASE_URL` / `DIRECT_URL`)
2. **Storage** for property media / documents

## 1. Collect values from Supabase

### API (Project Settings → API)

| Env var | Where |
|--------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `anon` `public` key |
| `SUPABASE_SERVICE_ROLE_KEY` | `service_role` key (server only) |
| `SUPABASE_STORAGE_BUCKET` | e.g. `property-media` |

### Database (Project Settings → Database → Connection string)

Use the **URI** format:

| Env var | Connection |
|--------|------------|
| `DATABASE_URL` | **Transaction pooler** (port `6543`) — append `?pgbouncer=true&connection_limit=1` for Prisma |
| `DIRECT_URL` | **Direct** connection (port `5432`) — used by Prisma migrations |

Example shapes (replace password + project ref):

```bash
DATABASE_URL="postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres"
```

Or use the classic host:

```bash
DIRECT_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"
```

## 2. Enable pgvector

In Supabase **SQL Editor**, run:

```sql
create extension if not exists vector;
create extension if not exists pg_trgm;
```

(Also in [`supabase/migrations/0001_enable_pgvector.sql`](../supabase/migrations/0001_enable_pgvector.sql).)

## 3. Local `.env.local`

```bash
cp .env.local.example .env.local
# paste Supabase values
```

Then:

```bash
npx prisma db push
npm run db:seed
curl -s http://localhost:3000/api/health | jq
```

`ready: true` means DB + Storage are connected.

## 4. Vercel project env

In **Vercel → Project → Settings → Environment Variables**, add for Production (and Preview if needed):

```text
DATABASE_URL
DIRECT_URL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_STORAGE_BUCKET=property-media
AUTH_SECRET
ENCRYPTION_KEY
NEXT_PUBLIC_APP_URL=https://YOUR_DOMAIN
```

Redeploy after saving.

## 5. Storage bucket

On first upload (or health check), the app creates a public bucket named `property-media` via the service role key. You can also create it manually in **Storage**.

## Security

- Never commit `.env` / `.env.local`
- Never expose `SUPABASE_SERVICE_ROLE_KEY` or `service_role` to the browser
- Prefer pooler URL for serverless (`DATABASE_URL`) and direct URL for migrations (`DIRECT_URL`)
