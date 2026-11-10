-- Per-account saved listings (units and projects), keyed by a stable share ref.
CREATE TABLE "saved_listings" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'property',
    "path" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "image" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "saved_listings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "saved_listings_user_id_ref_key" ON "saved_listings"("user_id", "ref");
CREATE INDEX "saved_listings_user_id_idx" ON "saved_listings"("user_id");

ALTER TABLE "saved_listings"
    ADD CONSTRAINT "saved_listings_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Same posture as every other public table: enable RLS with no policies so the
-- Supabase anon/authenticated (PostgREST) roles get no direct access, while
-- Prisma (the table owner over DATABASE_URL) bypasses RLS and keeps full access.
ALTER TABLE "saved_listings" ENABLE ROW LEVEL SECURITY;

-- This table records a user's own activity, so additionally revoke the public
-- API roles' privileges outright (defence-in-depth, matching the sensitive set).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL PRIVILEGES ON TABLE public.saved_listings FROM anon, authenticated;
  END IF;
END $$;
