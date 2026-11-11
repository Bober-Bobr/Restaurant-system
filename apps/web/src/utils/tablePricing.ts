/**
 * What a table package costs per person once the guest has taken dishes off it.
 *
 * A table category is sold at a flat `ratePerPerson` that covers everything the
 * package includes. A guest who does not want one of those dishes should not pay
 * for it, so removing an included dish takes that dish's own menu price off the
 * rate — the same figure the dish would cost if it were bought as an Additional.
 *
 * This lives in one place because four screens have to agree on it: the kiosk's
 * running total, the Summary's pricing block, the exported PDF and the Events
 * page rebuilding an old booking. Two of those recompute from a stored
 * `menuConfig` rather than from anything the tablet sent, so a second copy of
 * the arithmetic would quietly quote a different price on the invoice than the
 * guest agreed to.
 *
 * The rate is floored at zero. Removing more than the package is worth is not a
 * refund: a restaurant that prices a package below the sum of its dishes (which
 * is the normal case — that is the point of a package) must not be made to pay
 * the guest.
 */
export type PricedPackageItem = { id: string; menuItem: { priceCents: number } };

export function removedDishesCents(
  packageItems: readonly PricedPackageItem[] | null | undefined,
  removedPackageItemIds: readonly string[] | null | undefined,
): number {
  if (!packageItems?.length || !removedPackageItemIds?.length) return 0;
  const removed = new Set(removedPackageItemIds);
  return packageItems.reduce(
    (sum, pi) => (removed.has(pi.id) ? sum + (pi.menuItem?.priceCents ?? 0) : sum),
    0,
  );
}

export function effectiveRatePerPerson(
  tableCategory: { ratePerPerson: number; packageItems?: readonly PricedPackageItem[] } | null | undefined,
  removedPackageItemIds: readonly string[] | null | undefined,
): number {
  if (!tableCategory) return 0;
  const off = removedDishesCents(tableCategory.packageItems, removedPackageItemIds);
  return Math.max(0, tableCategory.ratePerPerson - off);
}

/**
 * How many portions of each paid Additional dish are CHARGED.
 *
 * Two rules, by section:
 *
 * - **Banquet**: an extra is a tick, and a ticked dish is served to every
 *   guest — charged × the head count.
 * - **Small Banquets**: an extra is ordered by the PORTION (a host orders six
 *   plov for a table of twenty), so it is charged × the quantity ordered. Spread
 *   over the party that is `price × quantity ÷ guests` on top of the per-person
 *   rate, which is exactly what `usePriceCalculator` produces once it is handed
 *   the quantities: per-person = (rate × guests + Σ price × qty) ÷ guests.
 *
 * One function, so the menu page's running total, the summary and the PDF
 * cannot charge a party two different ways.
 */
export function chargedExtras(
  selected: Readonly<Record<string, number>>,
  guestCount: number,
  byQuantity: boolean,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [id, quantity] of Object.entries(selected)) {
    if (!(quantity > 0)) continue;
    out[id] = byQuantity ? quantity : Math.max(guestCount, 0);
  }
  return out;
}
