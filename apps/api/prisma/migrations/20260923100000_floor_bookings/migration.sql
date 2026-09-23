-- Bookings on the floor map: which tables a booking takes, and whether it
-- takes a whole area.
--
-- Both are additive and default to "no tables, not a whole-venue booking", so
-- every existing booking keeps behaving exactly as it does now and no map
-- shows anything as taken until somebody books a table on it.
ALTER TABLE "Event" ADD COLUMN "wholeHall" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "EventFloorTable" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "floorTableId" TEXT NOT NULL,
    "guestCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventFloorTable_pkey" PRIMARY KEY ("id")
);

-- One row per table per booking: a table cannot be taken twice by the same
-- evening, and "is this table free" is then one lookup.
CREATE UNIQUE INDEX "EventFloorTable_eventId_floorTableId_key"
    ON "EventFloorTable"("eventId", "floorTableId");
CREATE INDEX "EventFloorTable_floorTableId_idx" ON "EventFloorTable"("floorTableId");

-- Both sides cascade: a deleted booking releases its tables, and a table
-- removed from the map takes its holds with it.
ALTER TABLE "EventFloorTable" ADD CONSTRAINT "EventFloorTable_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventFloorTable" ADD CONSTRAINT "EventFloorTable_floorTableId_fkey"
    FOREIGN KEY ("floorTableId") REFERENCES "FloorTable"("id") ON DELETE CASCADE ON UPDATE CASCADE;
