-- AlterTable
ALTER TABLE "Restaurant" ADD COLUMN "email" TEXT;
ALTER TABLE "Restaurant" ADD COLUMN "history" TEXT;
ALTER TABLE "Restaurant" ADD COLUMN "phone" TEXT;

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "restaurantId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "text" TEXT,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Review_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Review_restaurantId_idx" ON "Review"("restaurantId");
