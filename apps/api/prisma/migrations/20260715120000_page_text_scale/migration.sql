-- Page-wide text size multiplier for flyers and guest invitations.
ALTER TABLE "Invitation" ADD COLUMN "textScale" DOUBLE PRECISION DEFAULT 1;
ALTER TABLE "GuestInvitation" ADD COLUMN "textScale" DOUBLE PRECISION DEFAULT 1;
