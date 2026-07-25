-- Per-restaurant tablet cursor/finger-trail + falling-particle effects.
ALTER TABLE "Restaurant" ADD COLUMN "tabletParticles" TEXT;
ALTER TABLE "Restaurant" ADD COLUMN "tabletParticlesColor" TEXT;
ALTER TABLE "Restaurant" ADD COLUMN "tabletParticlesImageUrl" TEXT;
ALTER TABLE "Restaurant" ADD COLUMN "tabletTrailTemplate" TEXT;
ALTER TABLE "Restaurant" ADD COLUMN "tabletTrailColor" TEXT;
ALTER TABLE "Restaurant" ADD COLUMN "tabletTrailImageUrl" TEXT;
