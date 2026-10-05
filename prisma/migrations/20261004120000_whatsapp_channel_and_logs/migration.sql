-- AlterTable
ALTER TABLE "chat_sessions" ADD COLUMN     "channel" TEXT NOT NULL DEFAULT 'web',
ADD COLUMN     "phone" TEXT;

-- CreateTable
CREATE TABLE "whatsapp_logs" (
    "id" TEXT NOT NULL,
    "execution_id" TEXT,
    "wa_message_id" TEXT,
    "phone" TEXT NOT NULL,
    "session_id" TEXT,
    "message" TEXT NOT NULL,
    "reply" TEXT,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "intent" JSONB,
    "property_ids" JSONB,
    "latency_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_logs_wa_message_id_key" ON "whatsapp_logs"("wa_message_id");

-- CreateIndex
CREATE INDEX "whatsapp_logs_status_created_at_idx" ON "whatsapp_logs"("status", "created_at");

-- CreateIndex
CREATE INDEX "whatsapp_logs_phone_created_at_idx" ON "whatsapp_logs"("phone", "created_at");

-- CreateIndex
CREATE INDEX "whatsapp_logs_execution_id_idx" ON "whatsapp_logs"("execution_id");

-- CreateIndex
CREATE INDEX "chat_sessions_channel_phone_updated_at_idx" ON "chat_sessions"("channel", "phone", "updated_at");


-- Row Level Security, to match every other table in this database.
-- RLS was turned on across "public" on 2026-10-04 because the Supabase anon key
-- (which is public by design) could otherwise read every row through the REST
-- API. whatsapp_logs holds customer phone numbers and message text, so a new
-- table must not be left open. RLS on with no policies = the anon and
-- authenticated keys get nothing; the app is unaffected, because Prisma
-- connects as the database owner, which RLS does not restrict.
ALTER TABLE "whatsapp_logs" ENABLE ROW LEVEL SECURITY;
