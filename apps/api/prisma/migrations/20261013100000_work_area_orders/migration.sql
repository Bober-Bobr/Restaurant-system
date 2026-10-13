-- Which floor a member of staff is working, and which floor an order belongs to.
--
-- Both default to 'DINING', which is what every existing account and every
-- existing order is: the food-service product is the only one that has had
-- orders until now, so the deploy moves nobody and re-files nothing.
ALTER TABLE "AdminUser" ADD COLUMN "workArea" TEXT NOT NULL DEFAULT 'DINING';
ALTER TABLE "Order" ADD COLUMN "workArea" TEXT NOT NULL DEFAULT 'DINING';

-- The booking a small-banquet order feeds. Nullable: a general-dining order has
-- no booking behind it, and that is the common case.
--
-- ON DELETE CASCADE, because the order is part of that booking's record: a
-- booking deleted from the Events page must not leave its food on a waiter's
-- screen for a party that is not coming.
ALTER TABLE "Order" ADD COLUMN "eventId" TEXT;
ALTER TABLE "Order" ADD CONSTRAINT "Order_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Order_eventId_idx" ON "Order"("eventId");
-- The waiter's list is "my floor's orders, by status", polled every few
-- seconds; this is the index it reads.
CREATE INDEX "Order_restaurantId_workArea_status_idx" ON "Order"("restaurantId", "workArea", "status");
