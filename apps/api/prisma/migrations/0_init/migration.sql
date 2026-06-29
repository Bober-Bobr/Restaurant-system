-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'MENU_NOT_SELECTED');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('RESERVATION', 'BANQUET', 'WEDDING', 'BIRTHDAY', 'PRIVATE_PARTY', 'CORPORATE', 'FOTIHA_TUI', 'NACHOR_OSHI');

-- CreateEnum
CREATE TYPE "MenuCategory" AS ENUM ('SOUPS', 'PIZZA', 'COLD_APPETIZERS', 'GRILL', 'PASTRY', 'HOT_APPETIZERS', 'BEER_SNACKS', 'DESSERT', 'LAMB_DISHES', 'BEEF_DISHES', 'CHICKEN_DISHES', 'SIDE_DISHES', 'PASTA', 'SOFT_DRINKS', 'STEAKS', 'ENERGY_DRINKS', 'SALADS_OIL', 'SALADS_MAYO', 'COFFEE', 'SUSHI_ROLLS', 'DRIED_FRUITS', 'CANDIES', 'FIRST_COURSE', 'SECOND_COURSE', 'THIRD_COURSE', 'SWEETS', 'FRUITS', 'ALCOHOL', 'LEMONADES', 'NON_ALCOHOLIC_COCKTAILS', 'ALCOHOLIC_COCKTAILS', 'MILKSHAKES', 'TEA_MENU', 'FRESH_JUICES', 'LIQUEURS');

-- CreateEnum
CREATE TYPE "Region" AS ENUM ('US', 'CA', 'GB', 'DE', 'FR', 'IT', 'ES', 'RU', 'CN', 'JP', 'KR', 'AU', 'UZ', 'EU');

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('CHIEF_ADMIN', 'MANAGER', 'OWNER', 'ADMIN', 'CATERING_ADMIN', 'RESTAURANT_MANAGER', 'EMPLOYEE', 'KITCHEN');

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "eventNumber" INTEGER NOT NULL DEFAULT 0,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "guestCount" INTEGER NOT NULL,
    "status" "EventStatus" NOT NULL DEFAULT 'DRAFT',
    "eventType" "EventType" NOT NULL DEFAULT 'RESERVATION',
    "region" "Region",
    "hallId" TEXT,
    "tableCategoryId" TEXT,
    "childrenTableCategoryId" TEXT,
    "childrenCount" INTEGER NOT NULL DEFAULT 0,
    "restaurantId" TEXT,
    "notes" TEXT,
    "birthdayPersonName" TEXT,
    "brideName" TEXT,
    "groomName" TEXT,
    "honoreePersonName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "refreshTokenHash" TEXT,
    "role" "AdminRole" NOT NULL DEFAULT 'OWNER',
    "restaurantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseDay" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "allocatedSum" INTEGER NOT NULL DEFAULT 0,
    "report" TEXT,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "closedAt" TIMESTAMP(3),
    "managerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DayExtraExpense" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amountSum" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "dayId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DayExtraExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DayEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "dayId" TEXT NOT NULL,
    "bookingName" TEXT,
    "guestCount" INTEGER NOT NULL DEFAULT 0,
    "pricePerGuestSum" INTEGER NOT NULL DEFAULT 0,
    "report" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DayEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductExpense" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL DEFAULT 'kg',
    "amountSum" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "eventId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalaryExpense" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amountSum" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "eventId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalaryExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdditionalExpense" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amountSum" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "eventId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdditionalExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Restaurant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "history" TEXT,
    "logoUrl" TEXT,
    "backgroundImageUrl" TEXT,
    "categoryOrder" TEXT,
    "excludedCategories" TEXT,
    "hideSubcategories" BOOLEAN NOT NULL DEFAULT false,
    "ownerId" TEXT NOT NULL,
    "companyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Restaurant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "text" TEXT,
    "photoUrl" TEXT,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TableCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "includedCategories" TEXT NOT NULL DEFAULT '',
    "ratePerPerson" INTEGER NOT NULL DEFAULT 0,
    "discountPercent" INTEGER NOT NULL DEFAULT 0,
    "tableType" TEXT NOT NULL DEFAULT 'ADULT',
    "description" TEXT,
    "photoUrl" TEXT,
    "photos" JSONB NOT NULL DEFAULT '[]',
    "freeSubstitutionItemIds" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "restaurantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TableCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TableCategoryMenuItem" (
    "id" TEXT NOT NULL,
    "tableCategoryId" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "servings" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "TableCategoryMenuItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hall" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "description" TEXT,
    "photoUrl" TEXT,
    "photos" JSONB NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "restaurantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Hall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "nameI18n" JSONB,
    "descriptionI18n" JSONB,
    "category" "MenuCategory" NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "photoUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "showOnTablet" BOOLEAN NOT NULL DEFAULT true,
    "tabletStatus" TEXT NOT NULL DEFAULT 'PAID',
    "isBestseller" BOOLEAN NOT NULL DEFAULT false,
    "isOutOfStock" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "restaurantId" TEXT,
    "subcategoryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuSubcategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "MenuCategory" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "restaurantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuSubcategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventMenuSelection" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPriceCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventMenuSelection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "eventId" TEXT,
    "restaurantId" TEXT NOT NULL,
    "createdById" TEXT,
    "blocks" JSONB NOT NULL DEFAULT '[]',
    "promoTitle" TEXT,
    "promoSubtitle" TEXT,
    "promoCode" TEXT,
    "promoImageUrl" TEXT,
    "promoCodeAlt" TEXT,
    "promoDescription" TEXT,
    "telegramUrl" TEXT,
    "telegramLabel" TEXT,
    "welcomeTitle" TEXT,
    "welcomeSubtitle" TEXT,
    "welcomeImageUrl" TEXT,
    "welcomeMessage" TEXT,
    "countdownAt" TIMESTAMP(3),
    "countdownLabel" TEXT,
    "menuItems" JSONB NOT NULL DEFAULT '[]',
    "galleryPhotos" JSONB NOT NULL DEFAULT '[]',
    "instagramUrl" TEXT,
    "instagramLabel" TEXT,
    "phone" TEXT,
    "contactsTitle" TEXT,
    "contactVCardUrl" TEXT,
    "accentColor" TEXT,
    "backgroundColor" TEXT,
    "backgroundImageUrl" TEXT,
    "musicUrl" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuestInvitation" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdById" TEXT,
    "blocks" JSONB NOT NULL DEFAULT '[]',
    "accentColor" TEXT,
    "backgroundColor" TEXT,
    "backgroundImageUrl" TEXT,
    "musicUrl" TEXT,
    "trailTemplate" TEXT NOT NULL DEFAULT 'sparkle',
    "trailColor" TEXT,
    "coupleNames" TEXT,
    "heroSubtitle" TEXT,
    "heroImageUrl" TEXT,
    "greetingTitle" TEXT,
    "greetingMessage" TEXT,
    "coupleSignature" TEXT,
    "venueLabel" TEXT,
    "venueName" TEXT,
    "eventDate" TIMESTAMP(3),
    "venueImageUrl" TEXT,
    "mapAddress" TEXT,
    "mapButtonLabel" TEXT,
    "timingTitle" TEXT,
    "timingItems" JSONB NOT NULL DEFAULT '[]',
    "countdownAt" TIMESTAMP(3),
    "countdownLabel" TEXT,
    "telegramUrl" TEXT,
    "phone" TEXT,
    "instagramUrl" TEXT,
    "brandLabel" TEXT,
    "rsvpTitle" TEXT,
    "rsvpEnabled" BOOLEAN NOT NULL DEFAULT true,
    "sectionAnimations" JSONB NOT NULL DEFAULT '{}',
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuestInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuestInvitationRsvp" (
    "id" TEXT NOT NULL,
    "invitationId" TEXT NOT NULL,
    "guestName" TEXT NOT NULL,
    "attending" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuestInvitationRsvp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DesignTemplate" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "blocks" JSONB NOT NULL DEFAULT '[]',
    "theme" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DesignTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Event_eventNumber_key" ON "Event"("eventNumber");

-- CreateIndex
CREATE INDEX "Event_hallId_idx" ON "Event"("hallId");

-- CreateIndex
CREATE INDEX "Event_tableCategoryId_idx" ON "Event"("tableCategoryId");

-- CreateIndex
CREATE INDEX "Event_restaurantId_idx" ON "Event"("restaurantId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_username_key" ON "AdminUser"("username");

-- CreateIndex
CREATE INDEX "AdminUser_restaurantId_idx" ON "AdminUser"("restaurantId");

-- CreateIndex
CREATE INDEX "ExpenseDay_managerId_idx" ON "ExpenseDay"("managerId");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseDay_managerId_date_key" ON "ExpenseDay"("managerId", "date");

-- CreateIndex
CREATE INDEX "DayExtraExpense_dayId_idx" ON "DayExtraExpense"("dayId");

-- CreateIndex
CREATE INDEX "DayEvent_dayId_idx" ON "DayEvent"("dayId");

-- CreateIndex
CREATE UNIQUE INDEX "DayEvent_dayId_type_key" ON "DayEvent"("dayId", "type");

-- CreateIndex
CREATE INDEX "ProductExpense_eventId_idx" ON "ProductExpense"("eventId");

-- CreateIndex
CREATE INDEX "SalaryExpense_eventId_idx" ON "SalaryExpense"("eventId");

-- CreateIndex
CREATE INDEX "AdditionalExpense_eventId_idx" ON "AdditionalExpense"("eventId");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Company_ownerId_idx" ON "Company"("ownerId");

-- CreateIndex
CREATE INDEX "Restaurant_ownerId_idx" ON "Restaurant"("ownerId");

-- CreateIndex
CREATE INDEX "Restaurant_companyId_idx" ON "Restaurant"("companyId");

-- CreateIndex
CREATE INDEX "Review_restaurantId_idx" ON "Review"("restaurantId");

-- CreateIndex
CREATE INDEX "TableCategory_restaurantId_idx" ON "TableCategory"("restaurantId");

-- CreateIndex
CREATE UNIQUE INDEX "TableCategory_restaurantId_name_key" ON "TableCategory"("restaurantId", "name");

-- CreateIndex
CREATE INDEX "TableCategoryMenuItem_tableCategoryId_idx" ON "TableCategoryMenuItem"("tableCategoryId");

-- CreateIndex
CREATE UNIQUE INDEX "TableCategoryMenuItem_tableCategoryId_menuItemId_key" ON "TableCategoryMenuItem"("tableCategoryId", "menuItemId");

-- CreateIndex
CREATE INDEX "Hall_restaurantId_idx" ON "Hall"("restaurantId");

-- CreateIndex
CREATE UNIQUE INDEX "Hall_restaurantId_name_key" ON "Hall"("restaurantId", "name");

-- CreateIndex
CREATE INDEX "MenuItem_category_isActive_idx" ON "MenuItem"("category", "isActive");

-- CreateIndex
CREATE INDEX "MenuItem_restaurantId_idx" ON "MenuItem"("restaurantId");

-- CreateIndex
CREATE INDEX "MenuItem_subcategoryId_idx" ON "MenuItem"("subcategoryId");

-- CreateIndex
CREATE INDEX "MenuSubcategory_restaurantId_category_idx" ON "MenuSubcategory"("restaurantId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "MenuSubcategory_restaurantId_category_name_key" ON "MenuSubcategory"("restaurantId", "category", "name");

-- CreateIndex
CREATE INDEX "EventMenuSelection_eventId_idx" ON "EventMenuSelection"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "EventMenuSelection_eventId_menuItemId_key" ON "EventMenuSelection"("eventId", "menuItemId");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_slug_key" ON "Invitation"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_eventId_key" ON "Invitation"("eventId");

-- CreateIndex
CREATE INDEX "Invitation_restaurantId_idx" ON "Invitation"("restaurantId");

-- CreateIndex
CREATE INDEX "Invitation_eventId_idx" ON "Invitation"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "GuestInvitation_slug_key" ON "GuestInvitation"("slug");

-- CreateIndex
CREATE INDEX "GuestInvitation_createdById_idx" ON "GuestInvitation"("createdById");

-- CreateIndex
CREATE INDEX "GuestInvitationRsvp_invitationId_idx" ON "GuestInvitationRsvp"("invitationId");

-- CreateIndex
CREATE INDEX "DesignTemplate_ownerId_idx" ON "DesignTemplate"("ownerId");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_hallId_fkey" FOREIGN KEY ("hallId") REFERENCES "Hall"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_tableCategoryId_fkey" FOREIGN KEY ("tableCategoryId") REFERENCES "TableCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminUser" ADD CONSTRAINT "AdminUser_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseDay" ADD CONSTRAINT "ExpenseDay_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DayExtraExpense" ADD CONSTRAINT "DayExtraExpense_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "ExpenseDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DayEvent" ADD CONSTRAINT "DayEvent_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "ExpenseDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductExpense" ADD CONSTRAINT "ProductExpense_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "DayEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryExpense" ADD CONSTRAINT "SalaryExpense_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "DayEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdditionalExpense" ADD CONSTRAINT "AdditionalExpense_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "DayEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Restaurant" ADD CONSTRAINT "Restaurant_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Restaurant" ADD CONSTRAINT "Restaurant_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableCategory" ADD CONSTRAINT "TableCategory_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableCategoryMenuItem" ADD CONSTRAINT "TableCategoryMenuItem_tableCategoryId_fkey" FOREIGN KEY ("tableCategoryId") REFERENCES "TableCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableCategoryMenuItem" ADD CONSTRAINT "TableCategoryMenuItem_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hall" ADD CONSTRAINT "Hall_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_subcategoryId_fkey" FOREIGN KEY ("subcategoryId") REFERENCES "MenuSubcategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuSubcategory" ADD CONSTRAINT "MenuSubcategory_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventMenuSelection" ADD CONSTRAINT "EventMenuSelection_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventMenuSelection" ADD CONSTRAINT "EventMenuSelection_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestInvitation" ADD CONSTRAINT "GuestInvitation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestInvitationRsvp" ADD CONSTRAINT "GuestInvitationRsvp_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "GuestInvitation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignTemplate" ADD CONSTRAINT "DesignTemplate_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

