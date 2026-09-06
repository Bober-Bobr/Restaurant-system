-- The two money columns that hold a whole invoice rather than a unit price.
--
-- Both stored tiyin (1/100 so'm) in a 32-bit integer, which stops at
-- 2 147 483 647 tiyin = 21 474 836 so'm. A 200-guest banquet at 250 000 a head
-- is 50 000 000 so'm, so any deposit or payment past roughly 21.5 million was
-- refused by Postgres outright — and, with no error handler on the Invoices
-- page, the "Add payment" button appeared to do nothing at all.
--
-- Widening is lossless: every existing value already fits, and nothing else in
-- the schema references these columns.
--
-- It is NOT free, though: int4 → int8 changes the on-disk width, so Postgres
-- rewrites each table and holds an ACCESS EXCLUSIVE lock while it does. Both
-- tables are small — one row per event, a handful per invoice — so this is a
-- moment, not an outage. On a table of millions it would need a different plan.
ALTER TABLE "Event" ALTER COLUMN "depositCents" TYPE BIGINT;
ALTER TABLE "EventPayment" ALTER COLUMN "amountCents" TYPE BIGINT;
