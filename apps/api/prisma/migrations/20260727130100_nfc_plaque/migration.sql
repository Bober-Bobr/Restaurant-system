-- NFC plaques (v-connect.uz): block-designed business pages published at
-- v-connect.uz/<slug> and reached by tapping an NFC tag.
CREATE TABLE "NfcPlaque" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdById" TEXT,
    "businessName" TEXT NOT NULL,
    "blocks" JSONB NOT NULL DEFAULT '[]',
    "accentColor" TEXT,
    "backgroundColor" TEXT,
    "backgroundImageUrl" TEXT,
    "textColor" TEXT,
    "textScale" DOUBLE PRECISION DEFAULT 1,
    "particles" TEXT,
    "particlesColor" TEXT,
    "particlesImageUrl" TEXT,
    "musicUrl" TEXT,
    "trailTemplate" TEXT NOT NULL DEFAULT 'sparkle',
    "trailColor" TEXT,
    "trailImageUrl" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NfcPlaque_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NfcPlaque_slug_key" ON "NfcPlaque"("slug");
CREATE INDEX "NfcPlaque_createdById_idx" ON "NfcPlaque"("createdById");

ALTER TABLE "NfcPlaque" ADD CONSTRAINT "NfcPlaque_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
