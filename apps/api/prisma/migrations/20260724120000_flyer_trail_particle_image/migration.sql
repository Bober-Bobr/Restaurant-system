-- Flyer (Invitation): custom particle/trail images + per-flyer cursor trail.
ALTER TABLE "Invitation" ADD COLUMN "particlesImageUrl" TEXT;
ALTER TABLE "Invitation" ADD COLUMN "trailTemplate" TEXT;
ALTER TABLE "Invitation" ADD COLUMN "trailColor" TEXT;
ALTER TABLE "Invitation" ADD COLUMN "trailImageUrl" TEXT;
