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

    // Discount comes from the selected table category and applies to the subtotal.
    const discountPercent = Math.min(100, Math.max(0, tableCategory?.discountPercent ?? 0));
    const discountedSubtotalCents = Math.round(subtotalCents * (1 - discountPercent / 100));

    const compute = (base: number) => {
      const serviceFeeCents = Math.round(base * 0.1);
      const taxCents = Math.round((base + serviceFeeCents) * 0.12);
      const totalCents = base + serviceFeeCents + taxCents;
      return {
        serviceFeeCents,
        taxCents,
        totalCents,
        perGuestCents: guestCount > 0 ? Math.round(totalCents / guestCount) : 0,
      };
    };

    const discounted = compute(discountedSubtotalCents); // effective values
    const original = compute(subtotalCents);             // pre-discount values

    return {
      discountPercent,
      hasDiscount: discountPercent > 0,

      // Effective (discounted) values
      subtotalCents: discountedSubtotalCents,
      serviceFeeCents: discounted.serviceFeeCents,
      taxCents: discounted.taxCents,
      totalCents: discounted.totalCents,
      perGuestCents: discounted.perGuestCents,

      // Original (pre-discount) values — used for the crossed-out price
      originalSubtotalCents: subtotalCents,
      originalTotalCents: original.totalCents,
      originalPerGuestCents: original.perGuestCents,
    };
  }, [menuItems, selectedItems, tableCategory, guestCount]);
};
