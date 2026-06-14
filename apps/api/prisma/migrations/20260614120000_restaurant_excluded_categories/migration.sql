-- Excluded dish categories per restaurant: a JSON array of MenuCategory names.
-- Categories listed here are hidden everywhere (menus, table categories, photos).
ALTER TABLE "Restaurant" ADD COLUMN "excludedCategories" TEXT;
