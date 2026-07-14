-- Standalone flyers (for restaurants not in the system) may have no restaurant.
ALTER TABLE "Invitation" ALTER COLUMN "restaurantId" DROP NOT NULL;
