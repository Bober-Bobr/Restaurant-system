-- MenuSubcategory: named grouping of dishes within a single MenuCategory
CREATE TABLE "MenuSubcategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "restaurantId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MenuSubcategory_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "MenuSubcategory_restaurantId_category_name_key" ON "MenuSubcategory"("restaurantId", "category", "name");
CREATE INDEX "MenuSubcategory_restaurantId_category_idx" ON "MenuSubcategory"("restaurantId", "category");

-- MenuItem.subcategoryId (optional FK, SET NULL on delete)
ALTER TABLE "MenuItem" ADD COLUMN "subcategoryId" TEXT REFERENCES "MenuSubcategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "MenuItem_subcategoryId_idx" ON "MenuItem"("subcategoryId");
