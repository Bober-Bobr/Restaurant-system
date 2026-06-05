import { useMemo } from 'react';
import type { MenuItem, TableCategory } from '../types/domain';

export const usePriceCalculator = (
  menuItems: MenuItem[],
  selectedItems: Record<string, number>,
  tableCategory?: TableCategory,
  guestCount: number = 1
) => {
  return useMemo(() => {
    const menuSubtotalCents = menuItems.reduce((sum, item) => {
      return sum + item.priceCents * (selectedItems[item.id] ?? 0);
    }, 0);

    const tableRateCents = tableCategory ? tableCategory.ratePerPerson * guestCount : 0;
    const subtotalCents = menuSubtotalCents + tableRateCents;

    return {
      subtotalCents,
      perGuestCents: guestCount > 0 ? Math.round(subtotalCents / guestCount) : subtotalCents,
    };
  }, [menuItems, selectedItems, tableCategory, guestCount]);
};
