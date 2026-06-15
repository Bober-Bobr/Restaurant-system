-- RESTAURANT_MANAGER is added to the AdminRole enum. SQLite stores enums as
-- TEXT, so no schema change is required for the new value.

-- ExpenseDay: a single day's budget for a Restaurant Manager.
CREATE TABLE "ExpenseDay" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" TEXT NOT NULL,
    "allocatedCents" INTEGER NOT NULL DEFAULT 0,
    "additionalCents" INTEGER NOT NULL DEFAULT 0,
    "additionalNote" TEXT,
    "managerId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExpenseDay_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "AdminUser" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ExpenseDay_managerId_date_key" ON "ExpenseDay"("managerId", "date");
CREATE INDEX "ExpenseDay_managerId_idx" ON "ExpenseDay"("managerId");

-- ProductExpense: allocated funds for a specific weight/volume of a product.
CREATE TABLE "ProductExpense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "quantity" REAL NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL DEFAULT 'kg',
    "amountCents" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "dayId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductExpense_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "ExpenseDay" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProductExpense_dayId_idx" ON "ProductExpense"("dayId");

-- SalaryExpense: an employee salary line for a day.
CREATE TABLE "SalaryExpense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "dayId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SalaryExpense_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "ExpenseDay" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "SalaryExpense_dayId_idx" ON "SalaryExpense"("dayId");
