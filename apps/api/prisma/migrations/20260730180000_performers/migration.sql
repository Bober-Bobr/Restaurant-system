-- Performer profile, calendar and booking inbox. The PERFORMER enum value is
-- added by the preceding migration, on its own, for the reason documented there.

-- The invitation form no longer collects performers; they are their own
-- section now, so the reserved column goes.
ALTER TABLE "InviteRequest" DROP COLUMN IF EXISTS "performers";

CREATE TABLE "PerformerProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "craft" TEXT,
    "bio" TEXT,
    "phone" TEXT,
    "avatarUrl" TEXT,
    "photos" JSONB NOT NULL DEFAULT '[]',
    "videos" JSONB NOT NULL DEFAULT '[]',
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerformerProfile_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PerformerProfile_userId_key" ON "PerformerProfile"("userId");

CREATE TABLE "PerformerBooking" (
    "id" TEXT NOT NULL,
    "performerId" TEXT NOT NULL,
    "restaurantName" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "eventTime" TEXT NOT NULL,
    "eventType" TEXT,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "restaurantId" TEXT,
    "eventNumber" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerformerBooking_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PerformerBooking_performerId_status_idx" ON "PerformerBooking"("performerId", "status");
CREATE INDEX "PerformerBooking_eventDate_idx" ON "PerformerBooking"("eventDate");

CREATE TABLE "PerformerEvent" (
    "id" TEXT NOT NULL,
    "performerId" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "eventTime" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "note" TEXT,
    "bookingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerformerEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PerformerEvent_bookingId_key" ON "PerformerEvent"("bookingId");
CREATE INDEX "PerformerEvent_performerId_eventDate_idx" ON "PerformerEvent"("performerId", "eventDate");

ALTER TABLE "PerformerProfile" ADD CONSTRAINT "PerformerProfile_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PerformerBooking" ADD CONSTRAINT "PerformerBooking_performerId_fkey"
    FOREIGN KEY ("performerId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PerformerEvent" ADD CONSTRAINT "PerformerEvent_performerId_fkey"
    FOREIGN KEY ("performerId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PerformerEvent" ADD CONSTRAINT "PerformerEvent_bookingId_fkey"
    FOREIGN KEY ("bookingId") REFERENCES "PerformerBooking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
