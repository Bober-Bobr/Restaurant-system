-- Invitation orders now take several photos instead of one.
ALTER TABLE "InviteRequest" ADD COLUMN "photoUrls" JSONB NOT NULL DEFAULT '[]';

-- Carry over any single photo already captured. Written to survive the case
-- where the previous migration ran and rows exist; a no-op on an empty table.
UPDATE "InviteRequest"
   SET "photoUrls" = to_jsonb(ARRAY["photoUrl"])
 WHERE "photoUrl" IS NOT NULL;

ALTER TABLE "InviteRequest" DROP COLUMN "photoUrl";
