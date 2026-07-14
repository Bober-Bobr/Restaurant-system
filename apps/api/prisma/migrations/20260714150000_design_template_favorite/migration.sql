-- Favorite (pinned) design templates in the template chooser.
ALTER TABLE "DesignTemplate" ADD COLUMN "isFavorite" BOOLEAN NOT NULL DEFAULT false;
