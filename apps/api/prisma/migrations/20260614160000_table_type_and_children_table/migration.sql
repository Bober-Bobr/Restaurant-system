-- TableCategory audience type (ADULT default, CHILDREN add-on table)
ALTER TABLE "TableCategory" ADD COLUMN "tableType" TEXT NOT NULL DEFAULT 'ADULT';

-- Event: optional children's table add-on chosen on the tablet
ALTER TABLE "Event" ADD COLUMN "childrenTableCategoryId" TEXT;
ALTER TABLE "Event" ADD COLUMN "childrenCount" INTEGER NOT NULL DEFAULT 0;
