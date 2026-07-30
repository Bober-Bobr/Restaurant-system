-- Per-restaurant paid module entitlements, toggled by CHIEF_ADMIN.
ALTER TABLE "Restaurant" ADD COLUMN "moduleBanquet" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Restaurant" ADD COLUMN "moduleCatering" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Restaurant" ADD COLUMN "moduleAddons" BOOLEAN NOT NULL DEFAULT false;

-- Grandfather every restaurant that already exists: they are live today, so the
-- switches must start ON for them or deploying this would lock them out. Only
-- restaurants created from here on start locked and wait for a grant.
UPDATE "Restaurant" SET "moduleBanquet" = true, "moduleCatering" = true;
