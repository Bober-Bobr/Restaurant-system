-- AlterTable
ALTER TABLE "Restaurant" ADD COLUMN "backgroundImageUrl" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Hall" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "description" TEXT,
    "photoUrl" TEXT,
    "photos" JSONB NOT NULL DEFAULT [],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "restaurantId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Hall_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Hall" ("capacity", "createdAt", "description", "id", "isActive", "name", "photoUrl", "restaurantId", "updatedAt") SELECT "capacity", "createdAt", "description", "id", "isActive", "name", "photoUrl", "restaurantId", "updatedAt" FROM "Hall";
DROP TABLE "Hall";
ALTER TABLE "new_Hall" RENAME TO "Hall";
CREATE INDEX "Hall_restaurantId_idx" ON "Hall"("restaurantId");
CREATE UNIQUE INDEX "Hall_restaurantId_name_key" ON "Hall"("restaurantId", "name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
