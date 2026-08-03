-- Food-service employee role: the counterpart to CATERING_ADMIN, working the
-- floor with guest order codes. Distinct from the banquet EMPLOYEE role, which
-- is unchanged.
-- Isolated in its own migration on purpose: PostgreSQL allows ALTER TYPE ... ADD
-- VALUE inside a transaction, but the new value cannot be USED in that same
-- transaction. Keeping it alone means the next migration may reference it
-- freely. Same shape as 20260730170000_admin_role_performer.
ALTER TYPE "AdminRole" ADD VALUE 'CATERING_EMPLOYEE';
