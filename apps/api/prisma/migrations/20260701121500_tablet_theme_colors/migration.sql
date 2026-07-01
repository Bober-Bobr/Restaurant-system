-- AlterTable: per-restaurant tablet/summary color palette (nullable → default theme)
ALTER TABLE "Restaurant" ADD COLUMN     "tabletAccentColor" TEXT,
ADD COLUMN     "tabletBgColor" TEXT;
