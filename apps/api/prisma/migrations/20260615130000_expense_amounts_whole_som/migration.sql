-- Expense amounts are now stored as whole so'm (not tiyin) so they can hold
-- values up to 1,000,000,000 without exceeding the 32-bit Int range.
ALTER TABLE "ExpenseDay" RENAME COLUMN "allocatedCents" TO "allocatedSum";
ALTER TABLE "ExpenseDay" RENAME COLUMN "additionalCents" TO "additionalSum";
ALTER TABLE "ProductExpense" RENAME COLUMN "amountCents" TO "amountSum";
ALTER TABLE "SalaryExpense" RENAME COLUMN "amountCents" TO "amountSum";
