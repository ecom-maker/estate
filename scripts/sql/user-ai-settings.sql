-- Per-user "bring your own" LLM credentials.
-- Run once in the Supabase SQL editor (or psql against DATABASE_URL).
-- Safe to re-run: guarded with IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS "user_ai_settings" (
  "id"              TEXT PRIMARY KEY,
  "user_id"         TEXT NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
  "enabled"         BOOLEAN NOT NULL DEFAULT true,
  "base_url"        TEXT,
  "model"           TEXT,
  "embedding_model" TEXT,
  "api_key_enc"     TEXT,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_ai_settings_user_id_key"
  ON "user_ai_settings" ("user_id");
