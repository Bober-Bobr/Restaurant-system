-- Manual override of a department's spent total. NULL keeps the computed sum,
-- so every existing row keeps behaving exactly as before.
ALTER TABLE "DayEvent" ADD COLUMN "manualSpentSum" INTEGER;

-- Per-department "Additional Services" expense lines. Deliberately its own
-- table rather than a flag on AdditionalExpense: the two are reported and
-- totalled separately, and a shared table would need every existing query to
-- start filtering.
CREATE TABLE "ServiceExpense" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amountSum" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "eventId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceExpense_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ServiceExpense_eventId_idx" ON "ServiceExpense"("eventId");

ALTER TABLE "ServiceExpense" ADD CONSTRAINT "ServiceExpense_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "DayEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
