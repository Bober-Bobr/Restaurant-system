-- v-invite.uz: standalone invitation-builder users, sessions, projects, templates.

-- CreateTable
CREATE TABLE "InviteUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT,
    "googleId" TEXT,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InviteUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InviteSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InviteSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InviteProject" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "blocks" JSONB NOT NULL DEFAULT '[]',
    "theme" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InviteProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InviteTemplate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "blocks" JSONB NOT NULL DEFAULT '[]',
    "theme" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InviteTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InviteUser_email_key" ON "InviteUser"("email");
CREATE UNIQUE INDEX "InviteUser_username_key" ON "InviteUser"("username");
CREATE UNIQUE INDEX "InviteUser_googleId_key" ON "InviteUser"("googleId");
CREATE INDEX "InviteSession_userId_idx" ON "InviteSession"("userId");
CREATE UNIQUE INDEX "InviteProject_slug_key" ON "InviteProject"("slug");
CREATE INDEX "InviteProject_userId_idx" ON "InviteProject"("userId");
CREATE INDEX "InviteTemplate_userId_idx" ON "InviteTemplate"("userId");

-- AddForeignKey
ALTER TABLE "InviteSession" ADD CONSTRAINT "InviteSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "InviteUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InviteProject" ADD CONSTRAINT "InviteProject_userId_fkey" FOREIGN KEY ("userId") REFERENCES "InviteUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InviteTemplate" ADD CONSTRAINT "InviteTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "InviteUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
