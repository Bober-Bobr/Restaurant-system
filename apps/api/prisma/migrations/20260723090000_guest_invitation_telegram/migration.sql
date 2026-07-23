-- Telegram forwarding for guest invitation RSVPs (mirror of the flyer feature).

-- Per-invitation activation code (sent to the bot to subscribe a chat).
ALTER TABLE "GuestInvitation" ADD COLUMN "telegramCode" TEXT;
CREATE UNIQUE INDEX "GuestInvitation_telegramCode_key" ON "GuestInvitation"("telegramCode");

-- Chats subscribed to an invitation's RSVPs.
CREATE TABLE "GuestInvitationTelegramLink" (
    "id" TEXT NOT NULL,
    "invitationId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "username" TEXT,
    "firstName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GuestInvitationTelegramLink_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GuestInvitationTelegramLink_invitationId_chatId_key" ON "GuestInvitationTelegramLink"("invitationId", "chatId");
CREATE INDEX "GuestInvitationTelegramLink_invitationId_idx" ON "GuestInvitationTelegramLink"("invitationId");
ALTER TABLE "GuestInvitationTelegramLink" ADD CONSTRAINT "GuestInvitationTelegramLink_invitationId_fkey"
    FOREIGN KEY ("invitationId") REFERENCES "GuestInvitation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
