-- Dish ordering within a category (catering site arrangement).
ALTER TABLE "MenuItem" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;
-- Category ordering for the catering site, stored as a JSON array of category names.
ALTER TABLE "Restaurant" ADD COLUMN "categoryOrder" TEXT;
