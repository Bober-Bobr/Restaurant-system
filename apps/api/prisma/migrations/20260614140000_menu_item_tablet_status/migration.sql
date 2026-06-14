-- Add tabletStatus to MenuItem (NONE / FREE / PAID) and backfill from showOnTablet.
ALTER TABLE "MenuItem" ADD COLUMN "tabletStatus" TEXT NOT NULL DEFAULT 'PAID';
UPDATE "MenuItem" SET "tabletStatus" = CASE WHEN "showOnTablet" = true THEN 'PAID' ELSE 'NONE' END;
