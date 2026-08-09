-- The promotional site's showcase now lists REAL published invitations by slug
-- rather than built-in template ids.
--
-- The two id lists being dropped cannot be migrated into the new ones: a
-- template id is not an invitation slug, and there is no invitation those ids
-- could point at. The administrator re-picks from their own published
-- invitations, and until they do the site falls back to showing templates, so
-- nothing goes blank in between.
--
-- "hiddenIds" is kept and narrowed in meaning: it now holds template ids kept
-- off the price list. That is what it already contained, and the pricing page
-- already honoured it, so no data change is needed.

ALTER TABLE "InvitePromoShowcase" ADD COLUMN "workSlugs" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "InvitePromoShowcase" ADD COLUMN "coverSlugs" JSONB NOT NULL DEFAULT '[]';

ALTER TABLE "InvitePromoShowcase" DROP COLUMN "coverIds";
ALTER TABLE "InvitePromoShowcase" DROP COLUMN "orderIds";
