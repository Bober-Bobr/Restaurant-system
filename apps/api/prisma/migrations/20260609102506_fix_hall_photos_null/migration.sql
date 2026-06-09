-- Fix Hall.photos NULL values left by the previous migration.
-- SQLite treated DEFAULT [] (unquoted) as an invalid expression and stored NULL
-- for all rows that were copied from the old table without an explicit photos value.
UPDATE "Hall" SET "photos" = '[]' WHERE "photos" IS NULL;
