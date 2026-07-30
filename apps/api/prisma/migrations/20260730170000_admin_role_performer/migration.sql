-- Additional Services: the performer role.
-- Kept in its own migration, matching 20260727130000_admin_role_nfc_maker:
-- PostgreSQL will not allow a newly added enum value to be USED in the same
-- transaction that adds it, and Prisma wraps each migration in one.
ALTER TYPE "AdminRole" ADD VALUE 'PERFORMER';
