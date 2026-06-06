-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Invitation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "eventId" TEXT,
    "restaurantId" TEXT NOT NULL,
    "createdById" TEXT,
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
    "menuItems" JSONB NOT NULL DEFAULT [],
    "galleryPhotos" JSONB NOT NULL DEFAULT [],
    "instagramUrl" TEXT,
    "instagramLabel" TEXT,
    "phone" TEXT,
    "contactsTitle" TEXT,
    "contactVCardUrl" TEXT,
    "accentColor" TEXT,
    "backgroundColor" TEXT,
    "backgroundImageUrl" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Invitation_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Invitation_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Invitation" ("accentColor", "backgroundColor", "backgroundImageUrl", "contactVCardUrl", "contactsTitle", "countdownAt", "countdownLabel", "createdAt", "createdById", "eventId", "galleryPhotos", "id", "instagramLabel", "instagramUrl", "isPublished", "menuItems", "phone", "promoCode", "promoCodeAlt", "promoDescription", "promoImageUrl", "promoSubtitle", "promoTitle", "restaurantId", "slug", "telegramLabel", "telegramUrl", "updatedAt", "welcomeImageUrl", "welcomeMessage", "welcomeSubtitle", "welcomeTitle") SELECT "accentColor", "backgroundColor", "backgroundImageUrl", "contactVCardUrl", "contactsTitle", "countdownAt", "countdownLabel", "createdAt", "createdById", "eventId", "galleryPhotos", "id", "instagramLabel", "instagramUrl", "isPublished", "menuItems", "phone", "promoCode", "promoCodeAlt", "promoDescription", "promoImageUrl", "promoSubtitle", "promoTitle", "restaurantId", "slug", "telegramLabel", "telegramUrl", "updatedAt", "welcomeImageUrl", "welcomeMessage", "welcomeSubtitle", "welcomeTitle" FROM "Invitation";
DROP TABLE "Invitation";
ALTER TABLE "new_Invitation" RENAME TO "Invitation";
CREATE UNIQUE INDEX "Invitation_slug_key" ON "Invitation"("slug");
CREATE UNIQUE INDEX "Invitation_eventId_key" ON "Invitation"("eventId");
CREATE INDEX "Invitation_restaurantId_idx" ON "Invitation"("restaurantId");
CREATE INDEX "Invitation_eventId_idx" ON "Invitation"("eventId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
