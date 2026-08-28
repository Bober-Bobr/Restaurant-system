/**
 * What a dish is offered as on the tablet. The Additional page presents this as
 * TWO independent switches — "Paid" and "Free" — because they answer two
 * unrelated questions, and a dish can honestly be both:
 *
 * | Paid | Free | meaning                                                     |
 * |------|------|-------------------------------------------------------------|
 * |  on  |  on  | `BOTH` — a free substitute AND a paid Additional item        |
 * |  on  |  off | `PAID` — only under Additional; never a free substitute      |
 * |  off |  on  | `FREE` — a free substitute; not sold as an Additional item   |
 * |  off |  off | `NONE` — neither; it is simply included in the table         |
 * |      |      |          categories that have selected it                    |
 *
 * The four states are stored in the one `tabletStatus` column rather than as two
 * boolean columns: it already exists, the mapping is exact, and one column
 * cannot disagree with itself the way two can.
 */
export type TabletStatus = 'NONE' | 'FREE' | 'PAID' | 'BOTH';

export const TABLET_STATUSES: TabletStatus[] = ['NONE', 'FREE', 'PAID', 'BOTH'];

export function isTabletStatus(value: unknown): value is TabletStatus {
  return typeof value === 'string' && (TABLET_STATUSES as string[]).includes(value);
}

/**
 * A dish's status, tolerating rows that predate the column.
 *
 * A missing value falls back to FREE rather than NONE when `showOnTablet` is
 * off. NONE and FREE were indistinguishable in the code that ran until now — a
 * dish that was not PAID was free to swap in, whichever of the two it held — so
 * FREE is what such a row has actually been behaving as. Resolving it to NONE
 * would quietly withdraw free substitutes that guests can pick today.
 */
export function tabletStatusOf(item: {
  tabletStatus?: string | null;
  showOnTablet?: boolean;
}): TabletStatus {
  if (isTabletStatus(item.tabletStatus)) return item.tabletStatus;
  return item.showOnTablet === false ? 'FREE' : 'PAID';
}

/** Sold as a paid item in the tablet's "Additional" section. */
export function isPaidExtra(status: TabletStatus): boolean {
  return status === 'PAID' || status === 'BOTH';
}

/** Offered as a free substitute for a dish in the table's package. */
export function isFreeChoice(status: TabletStatus): boolean {
  return status === 'FREE' || status === 'BOTH';
}

/** The pair of switches back to the stored value. */
export function toTabletStatus(paid: boolean, free: boolean): TabletStatus {
  if (paid && free) return 'BOTH';
  if (paid) return 'PAID';
  if (free) return 'FREE';
  return 'NONE';
}

/** Flipping one switch leaves the other exactly as it was. */
export function withPaid(status: TabletStatus, paid: boolean): TabletStatus {
  return toTabletStatus(paid, isFreeChoice(status));
}

export function withFree(status: TabletStatus, free: boolean): TabletStatus {
  return toTabletStatus(isPaidExtra(status), free);
}

/**
 * The legacy `showOnTablet` boolean, kept in step for any reader that still
 * consults it. "Shown on the tablet" has always meant "sold as a paid extra",
 * so BOTH sets it too.
 */
export function showOnTabletFor(status: TabletStatus): boolean {
  return isPaidExtra(status);
}
