import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ── The guest's cart ────────────────────────────────────────────────────────
// Three rules, each preventing a real failure:
//
//  1. Only ids and quantities are stored — never prices or names. Totals are
//     computed against the live menu on every render, so a price the restaurant
//     edits can never go stale in a guest's cart. Event.menuConfig stores ids
//     only for the same reason.
//  2. The cart belongs to ONE restaurant. Changing restaurant clears it, so
//     dishes cannot walk from one restaurant's site to another's.
//  3. Carts expire. A cart rehydrated from last week's visit is confusing now
//     and will be actively wrong once orders reach a kitchen.

/** A cart older than this is dropped on rehydrate. */
const MAX_AGE_MS = 12 * 60 * 60 * 1000;

export type CartState = {
  restaurantId: string | null;
  /** menuItemId → quantity. Only positive quantities are ever stored. */
  lines: Record<string, number>;
  updatedAt: number;

  /** Point the cart at a restaurant, emptying it if it belonged to another. */
  setRestaurant: (restaurantId: string) => void;
  add: (menuItemId: string) => void;
  setQty: (menuItemId: string, qty: number) => void;
  remove: (menuItemId: string) => void;
  clear: () => void;
};

// Drop zero/negative entries rather than keeping them at 0 — the tablet store
// leaves them in the map and filters at every read site, which means every new
// reader has to remember to.
function withQty(lines: Record<string, number>, id: string, qty: number): Record<string, number> {
  const next = { ...lines };
  if (qty > 0) next[id] = Math.min(qty, 99);
  else delete next[id];
  return next;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      restaurantId: null,
      lines: {},
      updatedAt: Date.now(),

      setRestaurant: (restaurantId) => {
        if (get().restaurantId === restaurantId) return;
        set({ restaurantId, lines: {}, updatedAt: Date.now() });
      },
      add: (menuItemId) =>
        set((s) => ({ lines: withQty(s.lines, menuItemId, (s.lines[menuItemId] ?? 0) + 1), updatedAt: Date.now() })),
      setQty: (menuItemId, qty) =>
        set((s) => ({ lines: withQty(s.lines, menuItemId, qty), updatedAt: Date.now() })),
      remove: (menuItemId) =>
        set((s) => ({ lines: withQty(s.lines, menuItemId, 0), updatedAt: Date.now() })),
      clear: () => set({ lines: {}, updatedAt: Date.now() }),
    }),
    {
      name: 'vmenu-food-cart',
      // Persist state only; the actions are recreated by the initializer.
      partialize: (s) => ({ restaurantId: s.restaurantId, lines: s.lines, updatedAt: s.updatedAt }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        if (Date.now() - (state.updatedAt ?? 0) > MAX_AGE_MS) {
          state.lines = {};
          state.restaurantId = null;
        }
      },
    }
  )
);
