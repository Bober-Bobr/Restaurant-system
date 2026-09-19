-- Shell settings: the tablet's and the catering site's visual effects, switched
-- separately by the main admin and the food admin. Every switch defaults to ON
-- and catering particles to none — exactly what both surfaces did before — so
-- nothing looks different after the deploy until somebody changes a setting.

ALTER TABLE "Restaurant" ADD COLUMN "tabletAnimations" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Restaurant" ADD COLUMN "tabletMusic" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Restaurant" ADD COLUMN "tabletTrail" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Restaurant" ADD COLUMN "cateringAnimations" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Restaurant" ADD COLUMN "cateringMusic" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Restaurant" ADD COLUMN "cateringTrail" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Restaurant" ADD COLUMN "cateringParticles" TEXT;
