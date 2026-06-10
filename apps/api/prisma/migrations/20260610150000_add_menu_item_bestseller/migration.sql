-- AlterTable: flag bestseller menu items
ALTER TABLE "MenuItem" ADD COLUMN "isBestseller" BOOLEAN NOT NULL DEFAULT false;
