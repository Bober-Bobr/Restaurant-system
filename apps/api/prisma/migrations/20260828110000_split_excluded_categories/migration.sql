-- Dish-category exclusions used to be ONE list applied to every surface, so a
-- restaurant switching a category off for its banquet packages also removed it
-- from its public catering menu, and vice versa. Split it in two.
--
-- The rename keeps the banquet list's data in place, and the backfill copies it
-- to the catering side, so on the deploy every surface shows exactly what it
-- showed before. The two only diverge once someone edits one of them.
ALTER TABLE "Restaurant" RENAME COLUMN "excludedCategories" TO "excludedCategoriesBanquet";

ALTER TABLE "Restaurant" ADD COLUMN "excludedCategoriesCatering" TEXT;

UPDATE "Restaurant" SET "excludedCategoriesCatering" = "excludedCategoriesBanquet";
