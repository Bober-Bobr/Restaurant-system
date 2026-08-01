-- The manual amount on an Expense Ledger department overrides the GUEST REVENUE
-- ("revenue for all guests"), not the spent total. Renamed so the column says
-- what it now means; a rename keeps whatever a user had already typed in.
--
-- Kept as a separate migration rather than editing 20260731100000, which
-- introduced the column: that one may already have been applied, and rewriting
-- an applied migration fails Prisma's checksum check.
ALTER TABLE "DayEvent" RENAME COLUMN "manualSpentSum" TO "manualGuestsSum";
