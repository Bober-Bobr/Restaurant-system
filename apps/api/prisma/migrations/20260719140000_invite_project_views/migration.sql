-- Per-invitation view counter (incremented when the public page is loaded).
ALTER TABLE "InviteProject" ADD COLUMN "views" INTEGER NOT NULL DEFAULT 0;
