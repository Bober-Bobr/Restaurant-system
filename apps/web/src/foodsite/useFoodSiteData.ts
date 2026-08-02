import { useQuery } from '@tanstack/react-query';
import { publicRestaurantService, type PublicRestaurantDetail } from '../services/publicRestaurant.service';
import { publicMenuService } from '../services/publicMenu.service';
import type { MenuItem } from '../types/domain';

// ── Restaurant + menu for the food-service site ─────────────────────────────
// Resolves the slug server-side via GET /public/restaurant?slug=. The live
// catering site instead downloads EVERY catering-enabled restaurant on the
// platform — names, addresses, phones, emails, histories — and scans the list in
// the browser to find one match. Not worth reproducing.
//
// Query keys are `fs-` prefixed so they never collide with the live site's
// `catering-*` keys in the shared React Query cache.

export type FoodSiteData = {
  restaurant?: PublicRestaurantDetail;
  menuItems: MenuItem[];
  isLoading: boolean;
  notFound: boolean;
};

export function useFoodSiteData(slug: string | null): FoodSiteData {
  const restaurantQuery = useQuery({
    queryKey: ['fs-restaurant', slug],
    queryFn: () => publicRestaurantService.getBySlug(slug!),
    enabled: !!slug,
    retry: false, // a 404 is a real answer here, not a blip worth retrying
  });

  // `/public/restaurant` deliberately ignores moduleCatering (the banquet gate
  // needs to find a restaurant precisely in order to learn which modules it does
  // NOT have), so the entitlement is enforced here instead. Without this a
  // restaurant that never bought the catering module would become reachable.
  const restaurant = restaurantQuery.data?.moduleCatering ? restaurantQuery.data : undefined;

  const menuQuery = useQuery({
    queryKey: ['fs-menu', restaurant?.id],
    queryFn: () => publicMenuService.listActive(restaurant!.id),
    enabled: !!restaurant?.id,
  });

  return {
    restaurant,
    menuItems: menuQuery.data ?? [],
    isLoading: !!slug && (restaurantQuery.isLoading || (!!restaurant && menuQuery.isLoading)),
    notFound: !slug || (!restaurantQuery.isLoading && !restaurant),
  };
}
