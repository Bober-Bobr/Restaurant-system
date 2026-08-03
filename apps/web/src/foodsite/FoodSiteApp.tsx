import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useFoodSiteData } from './useFoodSiteData';
import { useActiveOrder } from './useActiveOrder';
import { useCartStore } from './cart.store';
import { FoodSiteLayout } from './FoodSiteLayout';
import { MenuPage } from './MenuPage';
import { HallsPage, HallDetailPage } from './HallsPage';
import { ReviewsPage } from './ReviewsPage';
import { AboutPage, ContactPage } from './InfoPages';
import { FullPageNote, useT } from './ui';
import './foodsite.css';

// ── test.v-menu.uz/<slug> — the food-service ordering site ───────────────────
// Phase 1: the redesign and a working cart. Ordering is deliberately inert —
// see CheckoutSheet.tsx.
//
// Routes mirror the live catering site (minus /category/:category, which the
// single-scroll menu replaces) so a later cutover does not break bookmarks or
// printed QR codes.
export function FoodSiteApp({ slug }: { slug: string | null }) {
  const { t } = useT();
  const { restaurant, menuItems, isLoading, notFound } = useFoodSiteData(slug);
  const setRestaurant = useCartStore((s) => s.setRestaurant);
  // Drives the code screen, the call-waiter button and the cart lock at once.
  const { order: activeOrder, locked } = useActiveOrder(restaurant?.id);

  // Binds the cart to this restaurant, emptying it if it belonged to another —
  // dishes must not walk from one restaurant's site to the next.
  useEffect(() => {
    if (restaurant?.id) setRestaurant(restaurant.id);
  }, [restaurant?.id, setRestaurant]);

  if (isLoading) {
    return (
      <div className="fs-root">
        <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center' }}>
          <span className="fs-spinner" />
        </div>
      </div>
    );
  }

  if (notFound || !restaurant) {
    return (
      <div className="fs-root">
        <FullPageNote
          title={slug ? t('fs_not_found') : t('fs_no_restaurant')}
          body={slug ? t('fs_not_found_hint') : t('fs_no_restaurant_hint')}
        />
      </div>
    );
  }

  return (
    <FoodSiteLayout restaurant={restaurant} menuItems={menuItems} orderLocked={locked}>
      <Routes>
        <Route path="/" element={<MenuPage restaurant={restaurant} menuItems={menuItems} activeOrder={activeOrder} />} />
        <Route path="/halls" element={<HallsPage restaurantId={restaurant.id} />} />
        <Route path="/halls/:hallId" element={<HallDetailPage restaurantId={restaurant.id} />} />
        <Route path="/reviews" element={<ReviewsPage restaurantId={restaurant.id} />} />
        <Route path="/about" element={<AboutPage restaurant={restaurant} />} />
        <Route path="/contact" element={<ContactPage restaurant={restaurant} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </FoodSiteLayout>
  );
}
