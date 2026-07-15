-- Page-wide text color for flyers and guest invitations.
ALTER TABLE "Invitation" ADD COLUMN "textColor" TEXT;
ALTER TABLE "GuestInvitation" ADD COLUMN "textColor" TEXT;
