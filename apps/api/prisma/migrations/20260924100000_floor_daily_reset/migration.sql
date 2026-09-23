-- The nightly layout reset needs to know whether it has already run for a
-- given day. A day string, not a timestamp: that is the question being asked,
-- and it makes the sweep idempotent across restarts.
--
-- Nullable with no default, so every area reads as "never reset" and the first
-- sweep after the deploy puts each one back to its saved default — areas with
-- no default saved are left alone entirely.
ALTER TABLE "Hall" ADD COLUMN "lastLayoutResetDay" TEXT;
