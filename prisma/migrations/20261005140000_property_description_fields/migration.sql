-- Structured descriptions: sections split from the original text, plus an
-- AI-written summary and key points. All nullable; `description` is unchanged.
ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "description_sections" JSONB;
ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "summary" TEXT;
ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "highlights" JSONB;
