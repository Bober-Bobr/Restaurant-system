-- The floor map's saved default layout, per area.
--
-- Both columns are nullable with no default: an area that has never had a
-- default saved has none, and "revert" is refused rather than putting the room
-- back to an empty map. So this deploy changes nothing until a supervisor
-- presses "Save as default".
ALTER TABLE "Hall" ADD COLUMN "defaultLayout" JSONB;
ALTER TABLE "Hall" ADD COLUMN "defaultLayoutAt" TIMESTAMP(3);
