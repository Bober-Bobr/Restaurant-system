-- The promotional site's "on the cover" selection is retired.
--
-- It meant "ride the hero as a live card". The hero has rendered no cards for
-- some time; the setting was kept on as "show this one first", which left two
-- controls doing one job — the showcase list's own up/down arrows already put a
-- row at the top, and they say it more plainly.
--
-- The column is dropped rather than left in place: a list nothing writes and
-- nothing reads is a setting that looks live to the next person to open the
-- table. The order lives in "workSlugs", which is untouched, so no gallery
-- changes on this deploy except that starred invitations are no longer pulled
-- to the front.

ALTER TABLE "InvitePromoShowcase" DROP COLUMN "coverSlugs";
