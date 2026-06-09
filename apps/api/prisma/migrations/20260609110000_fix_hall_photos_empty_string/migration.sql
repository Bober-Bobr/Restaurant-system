-- SQLite stored the DEFAULT [] (unquoted) as an empty string "" rather than NULL.
-- Prisma's JSON parser fails with EOF on empty strings.
-- Set any empty-string or NULL photos value to a valid JSON empty array.
UPDATE "Hall" SET "photos" = '[]' WHERE "photos" = '' OR "photos" IS NULL;
