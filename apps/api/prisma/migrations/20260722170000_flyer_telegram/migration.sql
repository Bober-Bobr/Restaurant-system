-- Telegram forwarding for flyer form submissions.

-- Per-flyer activation code (sent to the bot to subscribe a chat).
ALTER TABLE "Invitation" ADD COLUMN "telegramCode" TEXT;
CREATE UNIQUE INDEX "Invitation_telegramCode_key" ON "Invitation"("telegramCode");

-- Chats subscribed to a flyer's submissions.
CREATE TABLE "FlyerTelegramLink" (
    "id" TEXT NOT NULL,
    "invitationId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "username" TEXT,
    "firstName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FlyerTelegramLink_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FlyerTelegramLink_invitationId_chatId_key" ON "FlyerTelegramLink"("invitationId", "chatId");
CREATE INDEX "FlyerTelegramLink_invitationId_idx" ON "FlyerTelegramLink"("invitationId");
ALTER TABLE "FlyerTelegramLink" ADD CONSTRAINT "FlyerTelegramLink_invitationId_fkey"
    FOREIGN KEY ("invitationId") REFERENCES "Invitation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
