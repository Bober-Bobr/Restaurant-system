-- Per-day floor layouts; the saved "default layout" and its nightly reset are
-- retired. The standing tables (day IS NULL) ARE the default now: the layout
-- editors change them directly, and a booking's rearrangement is kept for its
-- own day only.

-- 1. Tables carry the day whose layout they belong to (NULL = standing layout).
ALTER TABLE "FloorTable" ADD COLUMN "day" TEXT;

-- A label is unique within one layout of one area. NULL is distinct in a
-- plain unique index, so it is folded to '' — Prisma cannot declare this.
DROP INDEX IF EXISTS "FloorTable_hallId_label_key";
CREATE UNIQUE INDEX "FloorTable_hallId_day_label_key"
  ON "FloorTable"("hallId", COALESCE("day", ''), "label");
CREATE INDEX "FloorTable_hallId_day_idx" ON "FloorTable"("hallId", "day");

-- 2. Which areas have a layout of their own on which day.
CREATE TABLE "FloorAreaDay" (
    "id" TEXT NOT NULL,
    "hallId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FloorAreaDay_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FloorAreaDay_hallId_day_key" ON "FloorAreaDay"("hallId", "day");
ALTER TABLE "FloorAreaDay" ADD CONSTRAINT "FloorAreaDay_hallId_fkey"
  FOREIGN KEY ("hallId") REFERENCES "Hall"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 3. The saved default layout and the nightly reset's bookkeeping.
ALTER TABLE "Hall" DROP COLUMN IF EXISTS "defaultLayout";
ALTER TABLE "Hall" DROP COLUMN IF EXISTS "defaultLayoutAt";
ALTER TABLE "Hall" DROP COLUMN IF EXISTS "lastLayoutResetDay";
