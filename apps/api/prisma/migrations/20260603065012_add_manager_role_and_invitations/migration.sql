-- CreateTable
CREATE TABLE "Invitation" (
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
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Invitation_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Invitation_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Company" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT,
    "ownerId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Company_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "AdminUser" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Company" ("createdAt", "id", "logoUrl", "name", "ownerId", "updatedAt") SELECT "createdAt", "id", "logoUrl", "name", "ownerId", "updatedAt" FROM "Company";
DROP TABLE "Company";
ALTER TABLE "new_Company" RENAME TO "Company";
CREATE INDEX "Company_ownerId_idx" ON "Company"("ownerId");
CREATE TABLE "new_Restaurant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "logoUrl" TEXT,
    "ownerId" TEXT NOT NULL,
    "companyId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Restaurant_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "AdminUser" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Restaurant_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Restaurant" ("address", "companyId", "createdAt", "id", "logoUrl", "name", "ownerId", "updatedAt") SELECT "address", "companyId", "createdAt", "id", "logoUrl", "name", "ownerId", "updatedAt" FROM "Restaurant";
DROP TABLE "Restaurant";
ALTER TABLE "new_Restaurant" RENAME TO "Restaurant";
CREATE INDEX "Restaurant_ownerId_idx" ON "Restaurant"("ownerId");
CREATE INDEX "Restaurant_companyId_idx" ON "Restaurant"("companyId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_slug_key" ON "Invitation"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_eventId_key" ON "Invitation"("eventId");

-- CreateIndex
CREATE INDEX "Invitation_restaurantId_idx" ON "Invitation"("restaurantId");

-- CreateIndex
CREATE INDEX "Invitation_eventId_idx" ON "Invitation"("eventId");
