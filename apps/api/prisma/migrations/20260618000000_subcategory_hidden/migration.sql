-- Add a "hidden" flag so a subcategory header can be suppressed on the catering site.
ALTER TABLE "MenuSubcategory" ADD COLUMN "hidden" BOOLEAN NOT NULL DEFAULT false;
