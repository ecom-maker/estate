-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'new',
    "channel" TEXT NOT NULL DEFAULT 'web',
    "session_id" TEXT,
    "property_id" TEXT,
    "name" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "preferred_date" TEXT,
    "preferred_time" TEXT,
    "requirements" JSONB,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "leads_status_created_at_idx" ON "leads"("status", "created_at");

-- CreateIndex
CREATE INDEX "leads_session_id_idx" ON "leads"("session_id");

-- CreateIndex
CREATE INDEX "leads_phone_idx" ON "leads"("phone");

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;
