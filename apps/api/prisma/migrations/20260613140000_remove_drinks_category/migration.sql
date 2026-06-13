-- Migrate any existing DRINKS menu items to SOFT_DRINKS before removing the value.
UPDATE "MenuItem" SET "category" = 'SOFT_DRINKS' WHERE "category" = 'DRINKS';
