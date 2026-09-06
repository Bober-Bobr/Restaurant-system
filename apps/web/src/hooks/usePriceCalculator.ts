import { useMemo } from 'react';
import type { MenuItem, TableCategory } from '../types/domain';
import { effectiveRatePerPerson } from '../utils/tablePricing';

export const usePriceCalculator = (
  menuItems: MenuItem[],
  selectedItems: Record<string, number>,
  tableCategory?: TableCategory,
  guestCount: number = 1,
  // Included dishes the guest took off the table — their price comes off the
  // per-person rate. See utils/tablePricing.ts for why that rule lives there.
  removedPackageItemIds: readonly string[] = [],
) => {
  return useMemo(() => {
    const menuSubtotalCents = menuItems.reduce((sum, item) => {
      return sum + item.priceCents * (selectedItems[item.id] ?? 0);
    }, 0);

    const ratePerPerson = effectiveRatePerPerson(tableCategory, removedPackageItemIds);
    const tableRateCents = ratePerPerson * guestCount;
    const subtotalCents = menuSubtotalCents + tableRateCents;

    return {
      subtotalCents,
      ratePerPerson,
      perGuestCents: guestCount > 0 ? Math.round(subtotalCents / guestCount) : subtotalCents,
    };
  }, [menuItems, selectedItems, tableCategory, guestCount, removedPackageItemIds]);
};
