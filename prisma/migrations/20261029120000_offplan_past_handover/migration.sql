-- Correct stale off-plan flags: a project whose handover date is already in the
-- past is completed, not off-plan (e.g. Marina Arcade Tower, handover 2017-06).
-- The app also derives this at read time (lib/property/handover.ts), but fixing
-- the stored column keeps the off-plan/ready FILTERS and counts consistent too.
--
-- Guarded cast: only rows whose handoverDate parses as a valid date are touched.

UPDATE "properties"
SET "off_plan" = false, "ready" = true
WHERE "off_plan" = true
  AND "metadata_json" ->> 'handoverDate' IS NOT NULL
  AND "metadata_json" ->> 'handoverDate' ~ '^\d{4}-\d{2}-\d{2}'
  AND ("metadata_json" ->> 'handoverDate')::date < CURRENT_DATE;
