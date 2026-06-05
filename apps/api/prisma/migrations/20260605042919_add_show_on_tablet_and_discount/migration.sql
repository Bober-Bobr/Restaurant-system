-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_MenuItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "photoUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "showOnTablet" BOOLEAN NOT NULL DEFAULT true,
    "restaurantId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MenuItem_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_MenuItem" ("category", "createdAt", "description", "id", "isActive", "name", "photoUrl", "priceCents", "restaurantId", "updatedAt") SELECT "category", "createdAt", "description", "id", "isActive", "name", "photoUrl", "priceCents", "restaurantId", "updatedAt" FROM "MenuItem";
DROP TABLE "MenuItem";
ALTER TABLE "new_MenuItem" RENAME TO "MenuItem";
CREATE INDEX "MenuItem_category_isActive_idx" ON "MenuItem"("category", "isActive");
CREATE INDEX "MenuItem_restaurantId_idx" ON "MenuItem"("restaurantId");
CREATE TABLE "new_TableCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "includedCategories" TEXT NOT NULL DEFAULT '',
    "ratePerPerson" INTEGER NOT NULL DEFAULT 0,
    "discountPercent" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "photoUrl" TEXT,
    "photos" JSONB NOT NULL DEFAULT [],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "restaurantId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TableCategory_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_TableCategory" ("createdAt", "description", "id", "includedCategories", "isActive", "name", "photoUrl", "photos", "ratePerPerson", "restaurantId", "updatedAt") SELECT "createdAt", "description", "id", "includedCategories", "isActive", "name", "photoUrl", "photos", "ratePerPerson", "restaurantId", "updatedAt" FROM "TableCategory";
DROP TABLE "TableCategory";
ALTER TABLE "new_TableCategory" RENAME TO "TableCategory";
CREATE INDEX "TableCategory_restaurantId_idx" ON "TableCategory"("restaurantId");
CREATE UNIQUE INDEX "TableCategory_restaurantId_name_key" ON "TableCategory"("restaurantId", "name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
