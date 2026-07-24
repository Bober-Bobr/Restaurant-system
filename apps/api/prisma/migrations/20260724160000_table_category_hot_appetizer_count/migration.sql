-- Number of hot appetizers a guest may pick for a set menu (table category).
ALTER TABLE "TableCategory" ADD COLUMN "hotAppetizerCount" INTEGER NOT NULL DEFAULT 3;
