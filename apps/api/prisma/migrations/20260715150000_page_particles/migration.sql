-- Falling particle effect (confetti/snow/candy) for flyers and guest invitations.
ALTER TABLE "Invitation" ADD COLUMN "particles" TEXT;
ALTER TABLE "GuestInvitation" ADD COLUMN "particles" TEXT;
