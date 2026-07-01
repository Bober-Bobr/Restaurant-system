-- AlterTable: full tablet menu-selection snapshot for round-tripping events
ALTER TABLE "Event" ADD COLUMN     "menuConfig" JSONB;
