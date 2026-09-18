# Deploy DMProperties AI to Vercel (Git integration)

> Ordered for: **no Supabase yet**, **deploy via your own GitHub repo**.
> Steps marked **YOU** require your credentials/accounts — I can't do these for you.
> Steps marked **CLAUDE** I can run once you provide non-secret inputs.

## Why this order
Vercel hosts only the Next.js web app. It needs a Postgres+pgvector database (Supabase) to run.
So: **database first → code in your GitHub → Vercel imports it → env vars → deploy.**

---

## Step 1 — Create the Supabase project  · **YOU**
1. supabase.com → New project. Name `dmproperties-prod`. Pick the region closest to your users. Set a strong DB password (save it).
2. In the project: **SQL Editor** → run: `create extension if not exists vector;`
3. **Project Settings → Database → Connection string:**
   - **Pooled** (Transaction, port 6543) → this is `DATABASE_URL`
   - **Direct** (port 5432) → this is `DIRECT_URL`
4. **Project Settings → API:** copy `Project URL`, `anon` key, `service_role` key (for Supabase Storage later).
5. **Storage:** create a bucket named `property-media`.

## Step 2 — Push the schema to Supabase
Put the two connection strings in `~/Projects/estate/.env.local`, then:
```bash
cd ~/Projects/estate && npx prisma db push
```
- **CLAUDE** can run this if you paste the strings into `.env.local` — but they contain your DB
  password, so you may prefer to run it yourself. Either works.

## Step 3 — Get the code into YOUR GitHub  · **YOU** (Claude preps)
The clone currently points at `ecom-maker/estate` (not yours). Create your own repo and push:
1. **YOU:** create an empty GitHub repo, e.g. `dmproperties-ai` (no README/gitignore).
2. **CLAUDE** can re-point the remote and prep the commit:
   ```bash
   git remote set-url origin https://github.com/<you>/dmproperties-ai.git
   ```
3. **YOU:** push (uses your GitHub auth):
   ```bash
   git push -u origin main
   ```
   *(`.gitignore` already excludes `.env*` — secrets won't be committed. Verify before pushing.)*

## Step 4 — Generate the app secrets  · run locally, keep private
```bash
openssl rand -base64 32      # AUTH_SECRET
openssl rand -hex 32         # ENCRYPTION_KEY
```
Keep these out of chat and out of git — paste them straight into Vercel (Step 6).

## Step 5 — Import the repo in Vercel  · **YOU**
1. vercel.com → **Add New → Project → Import Git Repository** → pick `dmproperties-ai`.
2. Authorize the Vercel↔GitHub connection when prompted.
3. Framework auto-detects **Next.js**. Leave build/output defaults (`build` already does `prisma generate && next build`).

## Step 6 — Set environment variables in Vercel  · **YOU**
Project → **Settings → Environment Variables**. Minimum for a working first deploy:

| Var | Value |
|---|---|
| `DATABASE_URL` | Supabase pooled string (Step 1) |
| `DIRECT_URL` | Supabase direct string |
| `AUTH_SECRET` | from Step 4 |
| `AUTH_URL` | `https://<your-app>.vercel.app` |
| `NEXT_PUBLIC_APP_URL` | `https://<your-app>.vercel.app` |
| `ENCRYPTION_KEY` | from Step 4 |
| `APP_ENV` | `production` |
| `AI_ENABLED` | `true` |
| `MOCK_CONNECTORS_ENABLED` | `true` |

Add when you enable those features:
`REDIS_URL` (Upstash), `OPENAI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET=property-media`, `GOOGLE_CLIENT_ID/SECRET`.

> `AUTH_URL`/`NEXT_PUBLIC_APP_URL` are chicken-and-egg: deploy once to learn the URL, set them, redeploy.

## Step 7 — Deploy  · **YOU** click Deploy
Watch the build log. If it fails, send me the log — the local build check (running now) should
have caught most issues already.

---

## What does NOT go on Vercel
- **The background worker** (`npm run worker`, BullMQ) — Vercel is serverless and can't run a
  persistent queue consumer. It goes on a managed container (Render/Railway) later, per the plan.
- **Redis** — Upstash (managed), not Vercel.

## Reality check for the first deploy
With DB + the env vars above, the site and DB-backed pages work. Auth via Google needs the OAuth
creds; AI chat needs `OPENAI_API_KEY`; media needs Supabase Storage keys; connector sync needs the
worker. So expect a working browse/search deploy first, with those features lighting up as you add
their keys.
