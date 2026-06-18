-- Per-event booking fields and notes (separate from the day-level report).
ALTER TABLE "DayEvent" ADD COLUMN "bookingName" TEXT;
ALTER TABLE "DayEvent" ADD COLUMN "guestCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "DayEvent" ADD COLUMN "pricePerGuestSum" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "DayEvent" ADD COLUMN "report" TEXT;
