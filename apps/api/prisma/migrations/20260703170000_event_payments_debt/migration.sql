ALTER TABLE "Event" ADD COLUMN "debtDeadline" TIMESTAMP(3);

CREATE TABLE "EventPayment" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventPayment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EventPayment_eventId_idx" ON "EventPayment"("eventId");

ALTER TABLE "EventPayment" ADD CONSTRAINT "EventPayment_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
