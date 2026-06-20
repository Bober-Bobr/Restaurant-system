-- CreateTable
CREATE TABLE "DesignTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "blocks" JSONB NOT NULL DEFAULT '[]',
    "theme" JSONB NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DesignTemplate_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "AdminUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_GuestInvitation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "createdById" TEXT,
    "blocks" JSONB NOT NULL DEFAULT '[]',
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
INSERT INTO "new_GuestInvitation" ("accentColor", "backgroundColor", "brandLabel", "countdownAt", "countdownLabel", "coupleNames", "coupleSignature", "createdAt", "createdById", "eventDate", "greetingMessage", "greetingTitle", "heroImageUrl", "heroSubtitle", "id", "instagramUrl", "isPublished", "mapAddress", "mapButtonLabel", "musicUrl", "phone", "rsvpEnabled", "rsvpTitle", "sectionAnimations", "slug", "telegramUrl", "timingItems", "timingTitle", "trailColor", "trailTemplate", "updatedAt", "venueImageUrl", "venueLabel", "venueName") SELECT "accentColor", "backgroundColor", "brandLabel", "countdownAt", "countdownLabel", "coupleNames", "coupleSignature", "createdAt", "createdById", "eventDate", "greetingMessage", "greetingTitle", "heroImageUrl", "heroSubtitle", "id", "instagramUrl", "isPublished", "mapAddress", "mapButtonLabel", "musicUrl", "phone", "rsvpEnabled", "rsvpTitle", "sectionAnimations", "slug", "telegramUrl", "timingItems", "timingTitle", "trailColor", "trailTemplate", "updatedAt", "venueImageUrl", "venueLabel", "venueName" FROM "GuestInvitation";
DROP TABLE "GuestInvitation";
ALTER TABLE "new_GuestInvitation" RENAME TO "GuestInvitation";
CREATE UNIQUE INDEX "GuestInvitation_slug_key" ON "GuestInvitation"("slug");
CREATE INDEX "GuestInvitation_createdById_idx" ON "GuestInvitation"("createdById");
CREATE TABLE "new_Invitation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "eventId" TEXT,
    "restaurantId" TEXT NOT NULL,
    "createdById" TEXT,
    "blocks" JSONB NOT NULL DEFAULT '[]',
    "promoTitle" TEXT,
    "promoSubtitle" TEXT,
    "promoCode" TEXT,
    "promoImageUrl" TEXT,
    "promoCodeAlt" TEXT,
    "promoDescription" TEXT,
    "telegramUrl" TEXT,
    "telegramLabel" TEXT,
    "welcomeTitle" TEXT,
    "welcomeSubtitle" TEXT,
    "welcomeImageUrl" TEXT,
    "welcomeMessage" TEXT,
    "countdownAt" DATETIME,
    "countdownLabel" TEXT,
    "menuItems" JSONB NOT NULL DEFAULT '[]',
    "galleryPhotos" JSONB NOT NULL DEFAULT '[]',
    "instagramUrl" TEXT,
    "instagramLabel" TEXT,
    "phone" TEXT,
    "contactsTitle" TEXT,
    "contactVCardUrl" TEXT,
    "accentColor" TEXT,
    "backgroundColor" TEXT,
    "backgroundImageUrl" TEXT,
    "musicUrl" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Invitation_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Invitation_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Invitation" ("accentColor", "backgroundColor", "backgroundImageUrl", "contactVCardUrl", "contactsTitle", "countdownAt", "countdownLabel", "createdAt", "createdById", "eventId", "galleryPhotos", "id", "instagramLabel", "instagramUrl", "isPublished", "menuItems", "musicUrl", "phone", "promoCode", "promoCodeAlt", "promoDescription", "promoImageUrl", "promoSubtitle", "promoTitle", "restaurantId", "slug", "telegramLabel", "telegramUrl", "updatedAt", "welcomeImageUrl", "welcomeMessage", "welcomeSubtitle", "welcomeTitle") SELECT "accentColor", "backgroundColor", "backgroundImageUrl", "contactVCardUrl", "contactsTitle", "countdownAt", "countdownLabel", "createdAt", "createdById", "eventId", "galleryPhotos", "id", "instagramLabel", "instagramUrl", "isPublished", "menuItems", "musicUrl", "phone", "promoCode", "promoCodeAlt", "promoDescription", "promoImageUrl", "promoSubtitle", "promoTitle", "restaurantId", "slug", "telegramLabel", "telegramUrl", "updatedAt", "welcomeImageUrl", "welcomeMessage", "welcomeSubtitle", "welcomeTitle" FROM "Invitation";
DROP TABLE "Invitation";
ALTER TABLE "new_Invitation" RENAME TO "Invitation";
CREATE UNIQUE INDEX "Invitation_slug_key" ON "Invitation"("slug");
CREATE UNIQUE INDEX "Invitation_eventId_key" ON "Invitation"("eventId");
CREATE INDEX "Invitation_restaurantId_idx" ON "Invitation"("restaurantId");
CREATE INDEX "Invitation_eventId_idx" ON "Invitation"("eventId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "DesignTemplate_ownerId_idx" ON "DesignTemplate"("ownerId");

