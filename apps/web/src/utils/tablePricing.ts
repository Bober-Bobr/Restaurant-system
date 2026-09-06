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
