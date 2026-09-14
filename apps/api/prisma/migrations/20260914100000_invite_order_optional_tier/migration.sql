-- The category is optional on the promotional site's request form.
--
-- A visitor who just wants to be rung back should not have to decide what to
-- spend first; the phone number is the only required field. With no category
-- there is nothing to quote — the discount is a per-category amount — so the
-- three money columns go null together rather than to zero, which would read as
-- a quoted price of nothing.
--
-- Widening only: every existing row keeps its category and its figures.

ALTER TABLE "InviteOrder" ALTER COLUMN "tier" DROP NOT NULL;
ALTER TABLE "InviteOrder" ALTER COLUMN "listCents" DROP NOT NULL;
ALTER TABLE "InviteOrder" ALTER COLUMN "discountCents" DROP NOT NULL;
ALTER TABLE "InviteOrder" ALTER COLUMN "totalCents" DROP NOT NULL;
