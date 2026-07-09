-- Banquet event type per table category (NAHOR | FOTIHA | TUI | OTHERS).
ALTER TABLE "TableCategory" ADD COLUMN "eventType" TEXT NOT NULL DEFAULT 'OTHERS';
