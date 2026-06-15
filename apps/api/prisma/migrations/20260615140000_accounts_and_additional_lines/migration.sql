-- Days can now be "closed" (finalized; excluded from PDF export).
ALTER TABLE "ExpenseDay" ADD COLUMN "isClosed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ExpenseDay" ADD COLUMN "closedAt" DATETIME;

-- Additional expenses become multiple line items (like products/salaries).
-- The old ExpenseDay.additionalSum / additionalNote columns are left in place
-- (now unused) to avoid a destructive table rebuild.
CREATE TABLE "AdditionalExpense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "amountSum" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "dayId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdditionalExpense_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "ExpenseDay" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "AdditionalExpense_dayId_idx" ON "AdditionalExpense"("dayId");
