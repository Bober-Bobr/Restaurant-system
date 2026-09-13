-- Invitation orders placed on the promotional site, and the studio's Telegram
-- inbox for them.
--
-- Three new tables, no changes to anything that exists, so this migration is
-- additive and reversible by dropping them.
--
-- The money is snapshotted onto InviteOrder (list / discount / total) rather
-- than recomputed from the category tables, which live in code: an order is a
-- record of what was quoted at the time, and a later price change must not
-- rewrite it.

CREATE TABLE "InviteOrder" (
    "id"            TEXT NOT NULL,
    "name"          TEXT NOT NULL,
    "phone"         TEXT NOT NULL,
    "tier"          TEXT NOT NULL,
    "promoCode"     TEXT,
    "listCents"     INTEGER NOT NULL,
    "discountCents" INTEGER NOT NULL,
    "totalCents"    INTEGER NOT NULL,
    "isRead"        BOOLEAN NOT NULL DEFAULT false,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InviteOrder_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InviteOrder_createdAt_idx" ON "InviteOrder"("createdAt");
CREATE INDEX "InviteOrder_isRead_idx" ON "InviteOrder"("isRead");

-- One row, scope = 'orders'. The bind code lives here rather than in an env var
-- so it can be rotated without an env edit and a restart.
CREATE TABLE "InviteOrderInbox" (
    "id"        TEXT NOT NULL,
    "scope"     TEXT NOT NULL,
    "code"      TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InviteOrderInbox_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InviteOrderInbox_scope_key" ON "InviteOrderInbox"("scope");
CREATE UNIQUE INDEX "InviteOrderInbox_code_key" ON "InviteOrderInbox"("code");

-- Subscribers to that one inbox. chatId is unique on its own: unlike the flyer
-- and project links there is nothing to scope it to, so a chat is either
-- subscribed or it is not.
CREATE TABLE "InviteOrderTelegramLink" (
    "id"        TEXT NOT NULL,
    "chatId"    TEXT NOT NULL,
    "username"  TEXT,
    "firstName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InviteOrderTelegramLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InviteOrderTelegramLink_chatId_key" ON "InviteOrderTelegramLink"("chatId");
