-- Small Banquets: the third section of the v-menu product.
--
-- A Supervisor (supervisor.v-menu.uz/<slug>) runs it with the same capabilities
-- a banquet ADMIN has, over a SEPARATE set of halls, table packages, extra
-- services and events. The dish table is the one thing the sections share.

-- 1. The role.
--    ALTER TYPE ... ADD VALUE cannot run inside a transaction block on older
--    servers, and `prisma migrate deploy` wraps each migration in one. IF NOT
--    EXISTS makes the statement safe to repeat; Postgres 12+ (this deploy is on
--    16) allows it inside a transaction as long as the new value is not USED in
--    the same transaction. Nothing below references it, so this is fine.
ALTER TYPE "AdminRole" ADD VALUE IF NOT EXISTS 'SUPERVISOR';

-- 2. The section discriminator.
--    Every existing row is a Banquet row: the column defaults to 'BANQUET' and
--    the backfill is therefore implicit — adding a NOT NULL column WITH a
--    constant default does not rewrite the table on Postgres 11+, it only
--    updates the catalogue, so these four are quick whatever the row count.
ALTER TABLE "Event" ADD COLUMN "section" TEXT NOT NULL DEFAULT 'BANQUET';
ALTER TABLE "Hall" ADD COLUMN "section" TEXT NOT NULL DEFAULT 'BANQUET';
ALTER TABLE "TableCategory" ADD COLUMN "section" TEXT NOT NULL DEFAULT 'BANQUET';
ALTER TABLE "ExtraService" ADD COLUMN "section" TEXT NOT NULL DEFAULT 'BANQUET';

-- 3. Name uniqueness moves into the section.
--    The two sections keep separate halls and separate packages, so both may
--    perfectly well have one called "Main hall" — and without the section in
--    the key, whichever section came second could never use that name at all.
DROP INDEX IF EXISTS "Hall_restaurantId_name_key";
DROP INDEX IF EXISTS "TableCategory_restaurantId_name_key";
CREATE UNIQUE INDEX "Hall_restaurantId_section_name_key"
  ON "Hall"("restaurantId", "section", "name");
CREATE UNIQUE INDEX "TableCategory_restaurantId_section_name_key"
  ON "TableCategory"("restaurantId", "section", "name");

-- 4. Read paths. Every list in the four modules is now filtered by
--    (restaurantId, section) rather than by restaurantId alone.
CREATE INDEX "Event_restaurantId_section_idx" ON "Event"("restaurantId", "section");
CREATE INDEX "Hall_restaurantId_section_idx" ON "Hall"("restaurantId", "section");
CREATE INDEX "TableCategory_restaurantId_section_idx" ON "TableCategory"("restaurantId", "section");
CREATE INDEX "ExtraService_restaurantId_section_idx" ON "ExtraService"("restaurantId", "section");

-- 5. The section's own switched-off dish categories.
--    Seeded FROM the banquet list rather than left null: the new section starts
--    out looking like the one it was split from. A restaurant that has never
--    touched the banquet list gets null here too, which reads as "nothing
--    excluded" — the same thing.
ALTER TABLE "Restaurant" ADD COLUMN "excludedCategoriesSmallBanquet" TEXT;
UPDATE "Restaurant" SET "excludedCategoriesSmallBanquet" = "excludedCategoriesBanquet";
