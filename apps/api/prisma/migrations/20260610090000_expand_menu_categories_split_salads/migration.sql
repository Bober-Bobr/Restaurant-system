-- Expand MenuCategory with the categories from the printed menu and split SALADS.
-- SQLite stores enum values as TEXT, so the new members need no DDL change — only a
-- data migration for the now-removed SALADS value.
--
-- Existing SALADS items are reassigned to SALADS_OIL (oil-based) as a safe default;
-- staff can move mayonnaise-based salads to SALADS_MAYO from the admin menu page.
UPDATE "MenuItem" SET "category" = 'SALADS_OIL' WHERE "category" = 'SALADS';
