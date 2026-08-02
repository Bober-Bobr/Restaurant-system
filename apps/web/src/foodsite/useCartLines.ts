import { useMemo } from 'react';
import { useCartStore } from './cart.store';
import type { MenuItem } from '../types/domain';

export type CartLine = {
  item: MenuItem;
  qty: number;
  /** qty × unit price, in tiyin. */
  lineTotal: number;
  /** Still on the menu, but the kitchen has marked it unavailable. */
  outOfStock: boolean;
};

export type CartSummary = {
  lines: CartLine[];
  /** Total number of dishes (sum of quantities), for the badge. */
  count: number;
  /** Sum in tiyin, excluding out-of-stock lines. */
  subtotal: number;
  hasOutOfStock: boolean;
};

// Joins the stored ids to the live menu. Ids that no longer resolve — dish
// deleted, deactivated, or its category excluded by the restaurant — are dropped
// silently, because there is nothing useful to say about a dish we can no longer
// name. Dishes that merely went OUT OF STOCK are kept and flagged instead: the
// guest chose them, so the drawer tells them rather than quietly shrinking the
// order.
/** The join itself, kept free of React so it can be exercised directly. */
export function reconcileCart(stored: Record<string, number>, menuItems: MenuItem[]): CartSummary {
  const byId = new Map(menuItems.map((m) => [m.id, m]));
  const lines: CartLine[] = [];

  for (const [id, qty] of Object.entries(stored)) {
    const item = byId.get(id);
    if (!item || qty <= 0) continue;
    lines.push({
      item,
      qty,
      lineTotal: item.priceCents * qty,
      outOfStock: !!item.isOutOfStock,
    });
  }

  // Menu order, so the drawer reads like the page the guest just scrolled.
  const order = new Map(menuItems.map((m, i) => [m.id, i]));
  lines.sort((a, b) => (order.get(a.item.id) ?? 0) - (order.get(b.item.id) ?? 0));

  return {
    lines,
    count: lines.reduce((sum, l) => sum + l.qty, 0),
    subtotal: lines.reduce((sum, l) => sum + (l.outOfStock ? 0 : l.lineTotal), 0),
    hasOutOfStock: lines.some((l) => l.outOfStock),
  };
}

export function useCartLines(menuItems: MenuItem[]): CartSummary {
  const stored = useCartStore((s) => s.lines);
  return useMemo(() => reconcileCart(stored, menuItems), [stored, menuItems]);
}
