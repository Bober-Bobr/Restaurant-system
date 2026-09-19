-- Dishes per system: each of Banquet, Small Banquets and Catering gets its own
-- price and its own "switched off" flag on the shared dish table.
--
-- `priceCents` stays and becomes the BANQUET price. The two new prices are
-- copied from it, so every system starts at exactly today's price and nothing
-- changes on the deploy; from then on they move independently.

ALTER TABLE "MenuItem" ADD COLUMN "priceCentsSmallBanquet" INTEGER;
ALTER TABLE "MenuItem" ADD COLUMN "priceCentsCatering" INTEGER;
UPDATE "MenuItem" SET "priceCentsSmallBanquet" = "priceCents", "priceCentsCatering" = "priceCents";
ALTER TABLE "MenuItem" ALTER COLUMN "priceCentsSmallBanquet" SET NOT NULL;
ALTER TABLE "MenuItem" ALTER COLUMN "priceCentsCatering" SET NOT NULL;

-- Nothing is switched off to begin with.
ALTER TABLE "MenuItem" ADD COLUMN "disabledBanquet" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "MenuItem" ADD COLUMN "disabledSmallBanquet" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "MenuItem" ADD COLUMN "disabledCatering" BOOLEAN NOT NULL DEFAULT false;
