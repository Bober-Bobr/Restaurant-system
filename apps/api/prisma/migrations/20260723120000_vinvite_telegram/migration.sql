-- Telegram RSVP forwarding moved from manager guest invitations to v-invite.uz
-- projects. Undo the guest-invitation feature (IF EXISTS: safe whether or not
-- the previous migration ran) and recreate it on InviteProject.

DROP TABLE IF EXISTS "GuestInvitationTelegramLink";
DROP INDEX IF EXISTS "GuestInvitation_telegramCode_key";
ALTER TABLE "GuestInvitation" DROP COLUMN IF EXISTS "telegramCode";

-- Per-project activation code (sent to the RSVP bot to subscribe a chat).
ALTER TABLE "InviteProject" ADD COLUMN "telegramCode" TEXT;
CREATE UNIQUE INDEX "InviteProject_telegramCode_key" ON "InviteProject"("telegramCode");

-- Chats subscribed to a project's RSVPs.
CREATE TABLE "InviteTelegramLink" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "username" TEXT,
    "firstName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InviteTelegramLink_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "InviteTelegramLink_projectId_chatId_key" ON "InviteTelegramLink"("projectId", "chatId");
CREATE INDEX "InviteTelegramLink_projectId_idx" ON "InviteTelegramLink"("projectId");
ALTER TABLE "InviteTelegramLink" ADD CONSTRAINT "InviteTelegramLink_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "InviteProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
