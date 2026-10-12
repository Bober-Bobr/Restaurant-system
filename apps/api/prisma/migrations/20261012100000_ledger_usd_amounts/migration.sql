-- Every price in the expense ledger can now carry a DOLLAR amount beside its
-- so'm amount (see apps/api/src/utils/ledgerMoney.ts). The two are separate
-- figures and are never added together — there is no exchange rate anywhere in
-- this product, and there is deliberately no column for one.
--
-- Units: the so'm columns are whole so'm, as they already were; the dollar
-- columns are US CENTS, so $12.50 is 1250. A ledger kept entirely in so'm is
-- unaffected: every column defaults to 0, which every surface reads as "no
-- dollar figure was recorded" and draws exactly as it did before.

-- The four per-department line tables and the day's own extras.
ALTER TABLE "ProductExpense"    ADD COLUMN "amountUsdCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "SalaryExpense"     ADD COLUMN "amountUsdCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AdditionalExpense" ADD COLUMN "amountUsdCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ServiceExpense"    ADD COLUMN "amountUsdCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "DayExtraExpense"   ADD COLUMN "amountUsdCents" INTEGER NOT NULL DEFAULT 0;

-- The booking's per-guest price, and the manual override of the guest revenue.
-- The override is NULLABLE for the reason its so'm twin is: "overridden to
-- zero" and "not overridden" are different facts, and each currency falls back
-- to its own computed figure independently.
ALTER TABLE "DayEvent" ADD COLUMN "pricePerGuestUsdCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "DayEvent" ADD COLUMN "manualGuestsUsdCents"  INTEGER;
