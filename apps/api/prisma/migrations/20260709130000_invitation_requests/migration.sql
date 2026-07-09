-- Leads captured from a flyer's public "form" block.
CREATE TABLE "InvitationRequest" (
    "id" TEXT NOT NULL,
    "invitationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvitationRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InvitationRequest_invitationId_idx" ON "InvitationRequest"("invitationId");

ALTER TABLE "InvitationRequest" ADD CONSTRAINT "InvitationRequest_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "Invitation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
