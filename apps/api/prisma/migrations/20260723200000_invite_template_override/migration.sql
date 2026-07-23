-- System-admin design overrides for built-in rich templates.
CREATE TABLE "InviteTemplateOverride" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "InviteTemplateOverride_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "InviteTemplateOverride_templateId_key" ON "InviteTemplateOverride"("templateId");
