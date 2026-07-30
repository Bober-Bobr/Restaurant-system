-- Invitation orders placed from the Additional Services page; they surface on
-- the v-invite.uz system administrator's Notifications page.
CREATE TABLE "InviteRequest" (
    "id" TEXT NOT NULL,
    "names" JSONB NOT NULL DEFAULT '[]',
    "eventType" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "cardNumber" TEXT,
    "restaurantName" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "eventTime" TEXT NOT NULL,
    "menu" TEXT,
    "performers" TEXT,
    "photoUrl" TEXT,
    "dressCode" TEXT,
    "restaurantId" TEXT,
    "eventNumber" INTEGER,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InviteRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InviteRequest_createdAt_idx" ON "InviteRequest"("createdAt");
CREATE INDEX "InviteRequest_isRead_idx" ON "InviteRequest"("isRead");
