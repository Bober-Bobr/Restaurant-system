-- Master switch to disable subcategories everywhere for a restaurant.
ALTER TABLE "Restaurant" ADD COLUMN "hideSubcategories" BOOLEAN NOT NULL DEFAULT false;

-- The "MENU_NOT_SELECTED" EventStatus value is enforced at the application layer
-- (SQLite stores enums as TEXT with no DB-level constraint), so no column change
-- is required here.
