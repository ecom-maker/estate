-- Multi-country support: country on communities + properties, and native
-- currency alongside the AED-normalized price (price_aed stays the sort/filter
-- key). Existing rows are backfilled as UAE / AED so nothing changes for them.

ALTER TABLE "communities" ADD COLUMN IF NOT EXISTS "country" TEXT;

ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "country" TEXT;
ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "price_native" DOUBLE PRECISION;
ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'AED';

UPDATE "communities" SET "country" = 'AE' WHERE "country" IS NULL;
UPDATE "properties"  SET "country" = 'AE' WHERE "country" IS NULL;
