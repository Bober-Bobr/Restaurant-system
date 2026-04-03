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

    const serviceFeeCents = Math.round(subtotalCents * 0.1);
    const taxCents = Math.round((subtotalCents + serviceFeeCents) * 0.12);

    return {
      subtotalCents,
      serviceFeeCents,
      taxCents,
      totalCents: subtotalCents + serviceFeeCents + taxCents,
      perGuestCents: guestCount > 0 ? Math.round((subtotalCents + serviceFeeCents + taxCents) / guestCount) : 0
    };
  }, [menuItems, selectedItems, tableCategory, guestCount]);
};
