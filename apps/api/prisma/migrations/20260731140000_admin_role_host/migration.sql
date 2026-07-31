-- Additional Services: the host role (тамада / boshlovchi).
-- Kept in its own migration, matching 20260730170000_admin_role_performer:
-- PostgreSQL will not allow a newly added enum value to be USED in the same
-- transaction that adds it, and Prisma wraps each migration in one.
ALTER TYPE "AdminRole" ADD VALUE 'HOST';
