-- v-invite user roles: USER (default) / SYSTEM_ADMIN.
ALTER TABLE "InviteUser" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'USER';

-- Promote the existing V-team account to system administrator.
UPDATE "InviteUser" SET "role" = 'SYSTEM_ADMIN' WHERE lower("username") = lower('V-team');
