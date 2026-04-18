/*
  Warnings:

  - You are about to drop the column `mealPackage` on the `TableCategory` table. All the data in the column will be lost.
  - You are about to drop the column `seatingCapacity` on the `TableCategory` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "Restaurant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "logoUrl" TEXT,
    "ownerId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Restaurant_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "AdminUser" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TableCategoryMenuItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tableCategoryId" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    CONSTRAINT "TableCategoryMenuItem_tableCategoryId_fkey" FOREIGN KEY ("tableCategoryId") REFERENCES "TableCategory" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TableCategoryMenuItem_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AdminUser" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "refreshTokenHash" TEXT,
    "role" TEXT NOT NULL DEFAULT 'OWNER',
    "restaurantId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AdminUser_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_AdminUser" ("createdAt", "id", "passwordHash", "refreshTokenHash", "updatedAt", "username") SELECT "createdAt", "id", "passwordHash", "refreshTokenHash", "updatedAt", "username" FROM "AdminUser";
DROP TABLE "AdminUser";
ALTER TABLE "new_AdminUser" RENAME TO "AdminUser";
CREATE UNIQUE INDEX "AdminUser_username_key" ON "AdminUser"("username");
CREATE INDEX "AdminUser_restaurantId_idx" ON "AdminUser"("restaurantId");
CREATE TABLE "new_Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventNumber" INTEGER NOT NULL DEFAULT 0,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT,
    "eventDate" DATETIME NOT NULL,
    "guestCount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "eventType" TEXT NOT NULL DEFAULT 'RESERVATION',
    "region" TEXT,
    "hallId" TEXT,
    "tableCategoryId" TEXT,
    "restaurantId" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Event_hallId_fkey" FOREIGN KEY ("hallId") REFERENCES "Hall" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Event_tableCategoryId_fkey" FOREIGN KEY ("tableCategoryId") REFERENCES "TableCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Event_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Event" ("createdAt", "customerName", "customerPhone", "eventDate", "eventType", "guestCount", "hallId", "id", "notes", "region", "status", "tableCategoryId", "updatedAt") SELECT "createdAt", "customerName", "customerPhone", "eventDate", "eventType", "guestCount", "hallId", "id", "notes", "region", "status", "tableCategoryId", "updatedAt" FROM "Event";
DROP TABLE "Event";
ALTER TABLE "new_Event" RENAME TO "Event";
CREATE UNIQUE INDEX "Event_eventNumber_key" ON "Event"("eventNumber");
CREATE INDEX "Event_hallId_idx" ON "Event"("hallId");
CREATE INDEX "Event_tableCategoryId_idx" ON "Event"("tableCategoryId");
CREATE INDEX "Event_restaurantId_idx" ON "Event"("restaurantId");
CREATE TABLE "new_Hall" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "description" TEXT,
    "photoUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "restaurantId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Hall_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Hall" ("capacity", "createdAt", "description", "id", "isActive", "name", "photoUrl", "updatedAt") SELECT "capacity", "createdAt", "description", "id", "isActive", "name", "photoUrl", "updatedAt" FROM "Hall";
DROP TABLE "Hall";
ALTER TABLE "new_Hall" RENAME TO "Hall";
CREATE INDEX "Hall_restaurantId_idx" ON "Hall"("restaurantId");
CREATE UNIQUE INDEX "Hall_restaurantId_name_key" ON "Hall"("restaurantId", "name");
CREATE TABLE "new_MenuItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "photoUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "restaurantId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MenuItem_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_MenuItem" ("category", "createdAt", "description", "id", "isActive", "name", "photoUrl", "priceCents", "updatedAt") SELECT "category", "createdAt", "description", "id", "isActive", "name", "photoUrl", "priceCents", "updatedAt" FROM "MenuItem";
DROP TABLE "MenuItem";
ALTER TABLE "new_MenuItem" RENAME TO "MenuItem";
CREATE INDEX "MenuItem_category_isActive_idx" ON "MenuItem"("category", "isActive");
CREATE INDEX "MenuItem_restaurantId_idx" ON "MenuItem"("restaurantId");
CREATE TABLE "new_TableCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "includedCategories" TEXT NOT NULL DEFAULT '',
    "ratePerPerson" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "photoUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "restaurantId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TableCategory_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_TableCategory" ("createdAt", "description", "id", "isActive", "name", "photoUrl", "ratePerPerson", "updatedAt") SELECT "createdAt", "description", "id", "isActive", "name", "photoUrl", "ratePerPerson", "updatedAt" FROM "TableCategory";
DROP TABLE "TableCategory";
ALTER TABLE "new_TableCategory" RENAME TO "TableCategory";
CREATE INDEX "TableCategory_restaurantId_idx" ON "TableCategory"("restaurantId");
CREATE UNIQUE INDEX "TableCategory_restaurantId_name_key" ON "TableCategory"("restaurantId", "name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Restaurant_ownerId_idx" ON "Restaurant"("ownerId");

-- CreateIndex
CREATE INDEX "TableCategoryMenuItem_tableCategoryId_idx" ON "TableCategoryMenuItem"("tableCategoryId");

-- CreateIndex
CREATE UNIQUE INDEX "TableCategoryMenuItem_tableCategoryId_menuItemId_key" ON "TableCategoryMenuItem"("tableCategoryId", "menuItemId");
