-- DropIndex
DROP INDEX IF EXISTS "Company_ownerId_key";

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Company_ownerId_idx" ON "Company"("ownerId");
