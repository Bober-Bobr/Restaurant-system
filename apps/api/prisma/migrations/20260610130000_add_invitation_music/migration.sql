-- Add optional looping background music URL to invitations
ALTER TABLE "Invitation" ADD COLUMN "musicUrl" TEXT;
