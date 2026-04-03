-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT,
    "eventDate" DATETIME NOT NULL,
    "guestCount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "eventType" TEXT NOT NULL DEFAULT 'RESERVATION',
    "region" TEXT,
    "hallId" TEXT,
    "tableCategoryId" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Event_hallId_fkey" FOREIGN KEY ("hallId") REFERENCES "Hall" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Event_tableCategoryId_fkey" FOREIGN KEY ("tableCategoryId") REFERENCES "TableCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Event" ("createdAt", "customerName", "customerPhone", "eventDate", "eventType", "guestCount", "hallId", "id", "notes", "region", "status", "updatedAt") SELECT "createdAt", "customerName", "customerPhone", "eventDate", "eventType", "guestCount", "hallId", "id", "notes", "region", "status", "updatedAt" FROM "Event";
DROP TABLE "Event";
ALTER TABLE "new_Event" RENAME TO "Event";
CREATE INDEX "Event_hallId_idx" ON "Event"("hallId");
CREATE INDEX "Event_tableCategoryId_idx" ON "Event"("tableCategoryId");
CREATE TABLE "new_TableCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "seatingCapacity" INTEGER NOT NULL,
    "mealPackage" TEXT NOT NULL DEFAULT '',
    "ratePerPerson" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_TableCategory" ("createdAt", "description", "id", "isActive", "name", "seatingCapacity", "updatedAt") SELECT "createdAt", "description", "id", "isActive", "name", "seatingCapacity", "updatedAt" FROM "TableCategory";
DROP TABLE "TableCategory";
ALTER TABLE "new_TableCategory" RENAME TO "TableCategory";
CREATE UNIQUE INDEX "TableCategory_name_key" ON "TableCategory"("name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
