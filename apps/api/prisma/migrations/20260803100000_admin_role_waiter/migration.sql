-- Food-service waiter role.
-- Isolated in its own migration on purpose: PostgreSQL allows ALTER TYPE ... ADD
-- VALUE inside a transaction, but the new value cannot be USED in that same
-- transaction. Keeping it alone means the next migration may reference it
-- freely. Same shape as 20260730170000_admin_role_performer.
ALTER TYPE "AdminRole" ADD VALUE 'WAITER';
