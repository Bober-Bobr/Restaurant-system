import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { publicOrderService, type GuestOrder } from '../services/order.service';
import { useLiveQuery } from '../services/live';
import { useOrderSession } from './order.store';

// The guest's live order, or null. Drives three things at once: the code screen,
// the "call waiter" button, and the fact that the cart is locked — a guest with
// an order in progress orders through their waiter, not through the site again.
export function useActiveOrder(restaurantId: string | undefined) {
  const guestToken = useOrderSession((s) => s.guestToken);
  const sessionRestaurantId = useOrderSession((s) => s.restaurantId);
  const clear = useOrderSession((s) => s.clear);
  const queryClient = useQueryClient();

  // A token belonging to a different restaurant is not this site's business.
  const active = !!guestToken && !!restaurantId && sessionRestaurantId === restaurantId;

  const query = useLiveQuery<GuestOrder>('guestOrder', {
    queryKey: ['fs-order', guestToken],
    queryFn: () => publicOrderService.get(guestToken!),
    enabled: active,
    retry: false,
  });

  const order = query.data;
  const finished = order?.status === 'CLOSED' || order?.status === 'CANCELLED';

  // Two ways an order stops being ours: the waiter closed it, or the server no
  // longer knows the token (pruned, or a stale device). Either way, let go — a
  // guest left staring at a dead code with a locked cart has no way out.
  const gone = query.isError;
  useEffect(() => {
    if (!active) return;
    if (finished || gone) {
      clear();
      queryClient.removeQueries({ queryKey: ['fs-order', guestToken] });
    }
  }, [active, finished, gone, clear, queryClient, guestToken]);

  return {
    order: active && !finished && !gone ? order : undefined,
    isLoading: active && query.isLoading,
    /** True while an order is live: the cart must stay locked. */
    locked: active && !finished && !gone && !!order,
  };
}
