-- Denormalized, sortable handover date for the projects listing (completion
-- sort can't order by the metadata JSON field). Backfilled from
-- metadata_json->>'handoverDate' and kept in sync by the app on create/update.
ALTER TABLE "properties" ADD COLUMN "handover_at" TIMESTAMP(3);

-- Backfill existing rows from the JSON handover date where it parses.
UPDATE "properties"
SET "handover_at" = ("metadata_json" ->> 'handoverDate')::timestamp
WHERE "metadata_json" ->> 'handoverDate' IS NOT NULL
  AND ("metadata_json" ->> 'handoverDate') ~ '^\d{4}-\d{2}-\d{2}';

CREATE INDEX "properties_off_plan_status_handover_at_idx"
  ON "properties" ("off_plan", "status", "handover_at");
