-- SQLite stores enums as TEXT so no ALTER needed; new values are valid immediately.
-- This migration is a no-op for SQLite but marks the schema change in history.
SELECT 1;
