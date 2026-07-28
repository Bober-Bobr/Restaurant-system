-- Contact details shown under the "developed by" credit on published flyers
-- (brand 'vconnect') and v-invite invitations (brand 'vinvite').
CREATE TABLE "PlatformContact" (
    "id" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "phone" TEXT,
    "telegram" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformContact_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlatformContact_brand_key" ON "PlatformContact"("brand");
