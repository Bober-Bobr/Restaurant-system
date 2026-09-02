import { useQuery } from '@tanstack/react-query';
import { publicRestaurantService } from '../services/publicRestaurant.service';
import { useAuthStore } from '../store/auth.store';

/**
 * The signed-in restaurant's name and logo, for documents that carry its brand.
 *
 * Exported PDFs and spreadsheets take the logo from the request body, so every
 * screen that builds one has to supply it. Two of the three forgot — they sent
 * `null` — and the exporter then fell back to a logo bundled in the repo, which
 * happened to be one particular restaurant's. Every other tenant's invoice went
 * out under that restaurant's brand.
 *
 * The fallback is gone, so a missing logo now means a plain document rather than
 * the wrong one. This hook is the other half: one place that answers "which logo
 * belongs on this document", so a fourth export screen cannot quietly ship with
 * `restaurantLogoUrl: null` again.
 *
 * It reads the PUBLIC restaurant endpoint — the same one the tablet uses — so it
 * needs no new API surface, and returns nulls while loading rather than
 * blocking: a document with no logo is a far smaller problem than a download
 * that will not start.
 */
export function useRestaurantBranding(): { name: string | null; logoUrl: string | null } {
  const restaurantId = useAuthStore((s) => s.restaurantId);
  const fallbackName = useAuthStore((s) => s.restaurantName);

  const { data } = useQuery({
    queryKey: ['restaurant-branding', restaurantId],
    queryFn: () => publicRestaurantService.get(restaurantId!),
    enabled: !!restaurantId,
    staleTime: 5 * 60_000,
  });

  return {
    name: data?.name ?? fallbackName ?? null,
    logoUrl: data?.logoUrl ?? null,
  };
}
