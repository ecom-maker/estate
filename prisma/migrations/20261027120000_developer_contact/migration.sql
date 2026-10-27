-- AlterTable
ALTER TABLE "developers" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "developers" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "developers" ADD COLUMN IF NOT EXISTS "noc_url" TEXT;
