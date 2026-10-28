-- Enable Row-Level Security on every table in the public schema.
--
-- The application never reaches these tables through the Supabase anon key /
-- PostgREST: all data access goes through Prisma over DATABASE_URL (the table
-- owner role), which BYPASSES RLS. Enabling RLS with NO policies therefore
-- denies the public anon + authenticated roles any direct table access
-- (closing the "rls_disabled_in_public" hole) without affecting the app.
--
-- NOTE: plain ENABLE (not FORCE) is deliberate — the table owner that Prisma
-- connects as must keep bypassing RLS, or the app would lose all DB access.
-- Supabase Storage lives in the `storage` schema and is unaffected. If a table
-- ever needs direct client access later, add explicit policies for it.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;',
      r.tablename
    );
  END LOOP;
END $$;
