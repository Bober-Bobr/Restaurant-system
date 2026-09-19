-- The floor map becomes one map PER AREA, switched between by tabs, instead of
-- every area placed on one shared canvas.
--
-- mapX / mapY positioned an area on that shared canvas and mean nothing now.
-- mapWidth / mapHeight stay: they are the size of the area's own map.

ALTER TABLE "Hall" DROP COLUMN "mapX";
ALTER TABLE "Hall" DROP COLUMN "mapY";

-- The drawing under the tables (zones, pool, stage, paths, labels).
ALTER TABLE "Hall" ADD COLUMN "mapFeatures" JSONB NOT NULL DEFAULT '[]';

-- Tables can be resized. Null keeps the size derived from the seat count, so
-- every existing table looks exactly as it did.
ALTER TABLE "FloorTable" ADD COLUMN "width" INTEGER;
ALTER TABLE "FloorTable" ADD COLUMN "height" INTEGER;
