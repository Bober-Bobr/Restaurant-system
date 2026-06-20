/*
  Warnings:

  - You are about to drop the column `additionalNote` on the `ExpenseDay` table. All the data in the column will be lost.
  - You are about to drop the column `additionalSum` on the `ExpenseDay` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "GuestInvitation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "createdById" TEXT,
    "accentColor" TEXT,
    "backgroundColor" TEXT,
    "musicUrl" TEXT,
    "trailTemplate" TEXT NOT NULL DEFAULT 'sparkle',
    "trailColor" TEXT,
    "coupleNames" TEXT,
    "heroSubtitle" TEXT,
    "heroImageUrl" TEXT,
    "greetingTitle" TEXT,
    "greetingMessage" TEXT,
    "coupleSignature" TEXT,
    "venueLabel" TEXT,
    "venueName" TEXT,
    "eventDate" DATETIME,
    "venueImageUrl" TEXT,
    "mapAddress" TEXT,
    "mapButtonLabel" TEXT,
    "timingTitle" TEXT,
    "timingItems" JSONB NOT NULL DEFAULT '[]',
    "countdownAt" DATETIME,
    "countdownLabel" TEXT,
    "telegramUrl" TEXT,
    "phone" TEXT,
    "instagramUrl" TEXT,
    "brandLabel" TEXT,
    "rsvpTitle" TEXT,
    "rsvpEnabled" BOOLEAN NOT NULL DEFAULT true,
    "sectionAnimations" JSONB NOT NULL DEFAULT '{}',
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GuestInvitation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AdminUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GuestInvitationRsvp" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invitationId" TEXT NOT NULL,
    "guestName" TEXT NOT NULL,
    "attending" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GuestInvitationRsvp_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "GuestInvitation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ExpenseDay" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" TEXT NOT NULL,
    "allocatedSum" INTEGER NOT NULL DEFAULT 0,
    "report" TEXT,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "closedAt" DATETIME,
    "managerId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExpenseDay_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "AdminUser" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ExpenseDay" ("allocatedSum", "closedAt", "createdAt", "date", "id", "isClosed", "managerId", "report", "updatedAt") SELECT "allocatedSum", "closedAt", "createdAt", "date", "id", "isClosed", "managerId", "report", "updatedAt" FROM "ExpenseDay";
DROP TABLE "ExpenseDay";
ALTER TABLE "new_ExpenseDay" RENAME TO "ExpenseDay";
CREATE INDEX "ExpenseDay_managerId_idx" ON "ExpenseDay"("managerId");
CREATE UNIQUE INDEX "ExpenseDay_managerId_date_key" ON "ExpenseDay"("managerId", "date");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "GuestInvitation_slug_key" ON "GuestInvitation"("slug");

-- CreateIndex
CREATE INDEX "GuestInvitation_createdById_idx" ON "GuestInvitation"("createdById");

-- CreateIndex
CREATE INDEX "GuestInvitationRsvp_invitationId_idx" ON "GuestInvitationRsvp"("invitationId");
