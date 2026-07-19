-- Guest RSVP responses for published v-invite invitations.
CREATE TABLE "InviteRsvp" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "guestName" TEXT NOT NULL,
    "attending" BOOLEAN NOT NULL,
    "guests" INTEGER NOT NULL DEFAULT 1,
    "dietary" TEXT,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InviteRsvp_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InviteRsvp_projectId_idx" ON "InviteRsvp"("projectId");

ALTER TABLE "InviteRsvp"
    ADD CONSTRAINT "InviteRsvp_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "InviteProject"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
