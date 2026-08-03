import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ── The guest's active order ────────────────────────────────────────────────
// One value matters: the `guestToken` minted when the order was placed. It is
// the only thing proving this anonymous browser owns that order, so it lives in
// localStorage and every public read is keyed on it.
//
// Scoped to a restaurant for the same reason the cart is: walking into a
// different restaurant must not carry a live order across.
//
// It expires. A guest who ordered lunch and comes back at dinner should get a
// clean site, not yesterday's code — and the server stops honouring the claim
// after three hours anyway (CLAIM_WINDOW_MS).

const MAX_AGE_MS = 6 * 60 * 60 * 1000;

export type OrderSessionState = {
  restaurantId: string | null;
  guestToken: string | null;
  startedAt: number;
  start: (restaurantId: string, guestToken: string) => void;
  clear: () => void;
};

export const useOrderSession = create<OrderSessionState>()(
  persist(
    (set) => ({
      restaurantId: null,
      guestToken: null,
      startedAt: 0,
      start: (restaurantId, guestToken) => set({ restaurantId, guestToken, startedAt: Date.now() }),
      clear: () => set({ restaurantId: null, guestToken: null, startedAt: 0 }),
    }),
    {
      name: 'vmenu-food-order',
      partialize: (s) => ({ restaurantId: s.restaurantId, guestToken: s.guestToken, startedAt: s.startedAt }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        if (state.guestToken && Date.now() - (state.startedAt ?? 0) > MAX_AGE_MS) {
          state.guestToken = null;
          state.restaurantId = null;
          state.startedAt = 0;
        }
      },
    }
  )
);
