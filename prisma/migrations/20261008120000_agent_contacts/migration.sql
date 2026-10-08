-- CreateTable
CREATE TABLE "agent_contacts" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "name" TEXT,
    "owner" TEXT,
    "user_agent" TEXT,
    "first_contact_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_interaction_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "queries" INTEGER NOT NULL DEFAULT 0,
    "properties_requested" INTEGER NOT NULL DEFAULT 0,
    "properties_viewed" INTEGER NOT NULL DEFAULT 0,
    "preferred_areas" JSONB,
    "skills_used" JSONB,
    "trust_relationship" TEXT NOT NULL DEFAULT 'new',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agent_contacts_agent_id_key" ON "agent_contacts"("agent_id");

-- CreateIndex
CREATE INDEX "agent_contacts_last_interaction_at_idx" ON "agent_contacts"("last_interaction_at");
