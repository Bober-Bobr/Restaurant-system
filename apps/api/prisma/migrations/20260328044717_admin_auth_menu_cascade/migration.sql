-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_EventMenuSelection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPriceCents" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EventMenuSelection_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EventMenuSelection_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_EventMenuSelection" ("createdAt", "eventId", "id", "menuItemId", "quantity", "unitPriceCents", "updatedAt") SELECT "createdAt", "eventId", "id", "menuItemId", "quantity", "unitPriceCents", "updatedAt" FROM "EventMenuSelection";
DROP TABLE "EventMenuSelection";
ALTER TABLE "new_EventMenuSelection" RENAME TO "EventMenuSelection";
CREATE INDEX "EventMenuSelection_eventId_idx" ON "EventMenuSelection"("eventId");
CREATE UNIQUE INDEX "EventMenuSelection_eventId_menuItemId_key" ON "EventMenuSelection"("eventId", "menuItemId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_username_key" ON "AdminUser"("username");
