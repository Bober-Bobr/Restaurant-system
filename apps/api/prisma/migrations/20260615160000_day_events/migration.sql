-- Each day now contains four event departments (NAHOR, FOTIHA, TUI, OTHERS),
-- and expense lines hang off an event instead of directly off the day.

-- 1. DayEvent table
CREATE TABLE "DayEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "dayId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DayEvent_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "ExpenseDay" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "DayEvent_dayId_type_key" ON "DayEvent"("dayId", "type");
CREATE INDEX "DayEvent_dayId_idx" ON "DayEvent"("dayId");

-- 2. Backfill four events for every existing day.
INSERT INTO "DayEvent" ("id", "type", "dayId", "createdAt")
SELECT lower(hex(randomblob(12))), tp."t", d."id", CURRENT_TIMESTAMP
FROM "ExpenseDay" d
CROSS JOIN (
    SELECT 'NAHOR' AS t
    UNION ALL SELECT 'FOTIHA'
    UNION ALL SELECT 'TUI'
    UNION ALL SELECT 'OTHERS'
) tp;

-- 3. Rebuild ProductExpense with eventId (existing lines map to the day's OTHERS event).
CREATE TABLE "new_ProductExpense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "quantity" REAL NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL DEFAULT 'kg',
    "amountSum" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "eventId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductExpense_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "DayEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ProductExpense" ("id", "name", "quantity", "unit", "amountSum", "sortOrder", "eventId", "createdAt")
SELECT p."id", p."name", p."quantity", p."unit", p."amountSum", p."sortOrder",
    (SELECT e."id" FROM "DayEvent" e WHERE e."dayId" = p."dayId" AND e."type" = 'OTHERS'),
    p."createdAt"
FROM "ProductExpense" p;
DROP TABLE "ProductExpense";
ALTER TABLE "new_ProductExpense" RENAME TO "ProductExpense";
CREATE INDEX "ProductExpense_eventId_idx" ON "ProductExpense"("eventId");

-- 4. Rebuild SalaryExpense with eventId.
CREATE TABLE "new_SalaryExpense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "amountSum" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "eventId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SalaryExpense_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "DayEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_SalaryExpense" ("id", "name", "amountSum", "sortOrder", "eventId", "createdAt")
SELECT s."id", s."name", s."amountSum", s."sortOrder",
    (SELECT e."id" FROM "DayEvent" e WHERE e."dayId" = s."dayId" AND e."type" = 'OTHERS'),
    s."createdAt"
FROM "SalaryExpense" s;
DROP TABLE "SalaryExpense";
ALTER TABLE "new_SalaryExpense" RENAME TO "SalaryExpense";
CREATE INDEX "SalaryExpense_eventId_idx" ON "SalaryExpense"("eventId");

-- 5. Rebuild AdditionalExpense with eventId.
CREATE TABLE "new_AdditionalExpense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "amountSum" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "eventId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdditionalExpense_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "DayEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_AdditionalExpense" ("id", "name", "amountSum", "sortOrder", "eventId", "createdAt")
SELECT a."id", a."name", a."amountSum", a."sortOrder",
    (SELECT e."id" FROM "DayEvent" e WHERE e."dayId" = a."dayId" AND e."type" = 'OTHERS'),
    a."createdAt"
FROM "AdditionalExpense" a;
DROP TABLE "AdditionalExpense";
ALTER TABLE "new_AdditionalExpense" RENAME TO "AdditionalExpense";
CREATE INDEX "AdditionalExpense_eventId_idx" ON "AdditionalExpense"("eventId");
