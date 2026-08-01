-- System-admin control over how the built-in invitation templates appear on the
-- v-invite promotional site: which are featured on the hero cover, the order of
-- the rest, and which are kept off it.
--
-- One row per promotional surface, keyed by `scope` ("landing" today). No row
-- means "use the shipped defaults", so this deploy changes nothing on its own.
CREATE TABLE "InvitePromoShowcase" (
    "id"        TEXT NOT NULL,
    "scope"     TEXT NOT NULL,
    "coverIds"  JSONB NOT NULL DEFAULT '[]',
    "orderIds"  JSONB NOT NULL DEFAULT '[]',
    "hiddenIds" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvitePromoShowcase_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InvitePromoShowcase_scope_key" ON "InvitePromoShowcase"("scope");
