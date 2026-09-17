-- Small Banquets floor map: halls gain a kind (HALL | OUTDOOR) and a position on
-- the map; tables are new rows hanging off a hall.
--
-- Every new Hall column is nullable or defaulted, so existing halls stay halls
-- and simply have no position yet — the map lays unplaced areas out itself.

ALTER TABLE "Hall" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'HALL';
ALTER TABLE "Hall" ADD COLUMN "mapX" INTEGER;
ALTER TABLE "Hall" ADD COLUMN "mapY" INTEGER;
ALTER TABLE "Hall" ADD COLUMN "mapWidth" INTEGER;
ALTER TABLE "Hall" ADD COLUMN "mapHeight" INTEGER;

CREATE TABLE "FloorTable" (
    "id" TEXT NOT NULL,
    "hallId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "seats" INTEGER NOT NULL,
    "shape" TEXT NOT NULL DEFAULT 'RECT',
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,
    "rotation" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FloorTable_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FloorTable_hallId_label_key" ON "FloorTable"("hallId", "label");
CREATE INDEX "FloorTable_hallId_idx" ON "FloorTable"("hallId");

-- A table stands in a hall; removing the hall removes its tables.
ALTER TABLE "FloorTable" ADD CONSTRAINT "FloorTable_hallId_fkey"
    FOREIGN KEY ("hallId") REFERENCES "Hall"("id") ON DELETE CASCADE ON UPDATE CASCADE;
