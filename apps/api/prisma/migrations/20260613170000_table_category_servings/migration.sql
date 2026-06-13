-- Number of servings of each included dish per table.
ALTER TABLE "TableCategoryMenuItem" ADD COLUMN "servings" INTEGER NOT NULL DEFAULT 1;
