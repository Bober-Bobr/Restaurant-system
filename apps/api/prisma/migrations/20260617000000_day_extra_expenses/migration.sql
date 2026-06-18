-- Day-level additional expenses (separate from per-event main expenses).
CREATE TABLE "DayExtraExpense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "amountSum" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "dayId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DayExtraExpense_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "ExpenseDay" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "DayExtraExpense_dayId_idx" ON "DayExtraExpense"("dayId");
