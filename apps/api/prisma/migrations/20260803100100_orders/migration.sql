-- Food-service orders: a guest places an order on test.v-menu.uz and receives a
-- short code; a waiter claims it with that code plus a table number.

CREATE TABLE "Order" (
    "id"            TEXT NOT NULL,
    "restaurantId"  TEXT NOT NULL,
    "code"          TEXT NOT NULL,
    "status"        TEXT NOT NULL DEFAULT 'PENDING',
    "guestToken"    TEXT NOT NULL,
    "comment"       TEXT,
    "tableNumber"   TEXT,
    "waiterId"      TEXT,
    "claimedAt"     TIMESTAMP(3),
    "closedAt"      TIMESTAMP(3),
    "callPendingAt" TIMESTAMP(3),
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrderItem" (
    "id"             TEXT NOT NULL,
    "orderId"        TEXT NOT NULL,
    "menuItemId"     TEXT,
    "nameSnapshot"   TEXT NOT NULL,
    "unitPriceCents" INTEGER NOT NULL,
    "quantity"       INTEGER NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Order_guestToken_key" ON "Order"("guestToken");
CREATE INDEX "Order_restaurantId_status_idx"    ON "Order"("restaurantId", "status");
CREATE INDEX "Order_waiterId_status_idx"        ON "Order"("waiterId", "status");
CREATE INDEX "Order_waiterId_closedAt_idx"      ON "Order"("waiterId", "closedAt");
CREATE INDEX "Order_restaurantId_createdAt_idx" ON "Order"("restaurantId", "createdAt");
CREATE INDEX "OrderItem_orderId_idx"            ON "OrderItem"("orderId");

-- The handoff code is only 3 characters, so it cannot be globally unique. It has
-- to be unambiguous exactly where it is used: among the orders of ONE restaurant
-- that a waiter could still claim or is still serving. Once an order closes the
-- code is free to be issued again. A PARTIAL unique index is what expresses that;
-- Prisma cannot declare one, so it lives here and the schema carries a comment.
-- This is also the race guard: two guests generating the same code at the same
-- instant cannot both commit.
CREATE UNIQUE INDEX "Order_open_code_key"
    ON "Order"("restaurantId", "code")
    WHERE "status" IN ('PENDING', 'OPEN');

ALTER TABLE "Order" ADD CONSTRAINT "Order_restaurantId_fkey"
    FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_waiterId_fkey"
    FOREIGN KEY ("waiterId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_menuItemId_fkey"
    FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
