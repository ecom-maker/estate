-- Defense-in-depth for tables holding secrets or personal identifiers.
--
-- RLS (migration 20261028120000_enable_rls_public) already denies the public
-- anon/authenticated PostgREST roles any row access. This additionally REVOKES
-- their table privileges outright, so these tables can never be reached through
-- the Supabase API even if a permissive policy is added later by mistake.
--
-- Prisma connects as the table owner (via DATABASE_URL), which is unaffected by
-- grants to anon/authenticated, so the application keeps full access.

DO $$
DECLARE
  sensitive text[] := ARRAY[
    'users',
    'accounts',
    'sessions',
    'verification_tokens',
    'otp_codes',
    'api_credentials',
    'user_ai_settings',
    'leads'
  ];
  t text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    FOREACH t IN ARRAY sensitive LOOP
      IF EXISTS (
        SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = t
      ) THEN
        EXECUTE format(
          'REVOKE ALL PRIVILEGES ON TABLE public.%I FROM anon, authenticated;',
          t
        );
      END IF;
    END LOOP;
  END IF;
END $$;
