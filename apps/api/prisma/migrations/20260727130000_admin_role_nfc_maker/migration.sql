-- v-connect.uz: the NFC-plaque builder role.
-- Kept in its own migration: PostgreSQL will not allow a newly added enum value
-- to be USED in the same transaction that adds it, and Prisma wraps each
-- migration in one transaction.
ALTER TYPE "AdminRole" ADD VALUE 'NFC_MAKER';
