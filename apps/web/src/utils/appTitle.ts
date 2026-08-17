import type { AdminRole } from '../store/auth.store';

// ── What the browser tab says ────────────────────────────────────────────────
// One SPA serves three products and a dozen roles, so a single static <title>
// ("Banquet Admin") was wrong almost everywhere: it named the banquet module to
// people who never open it, and it named nothing useful to the staff of a
// restaurant, who have several tabs of the same app open at once.
//
// The rule follows who the signed-in person IS:
//
//   · tied to one restaurant  → that restaurant's name (ADMIN, EMPLOYEE,
//     KITCHEN, CATERING_ADMIN, CATERING_EMPLOYEE). This is the whole point —
//     a manager watching two restaurants can tell the tabs apart.
//   · platform-wide           → the product name (CHIEF_ADMIN, MANAGER, OWNER,
//     RESTAURANT_MANAGER, PERFORMER, HOST). None of them belongs to a single
//     restaurant, so a restaurant name would be a lie.
//   · v-connect              → the product name there, for NFC_MAKER and for
//     the public plaque pages alike.
//
// These are product names, so they are deliberately NOT translated — the same
// reason `v-invite.uz` is not.

export const PLATFORM_TITLE = 'Restaurant System';
export const CONNECT_TITLE = 'V-connect';

/**
 * Roles that work across the platform rather than inside one restaurant.
 *
 * PERFORMER, HOST and RESTAURANT_MANAGER carry `restaurantId: null` by design
 * (see auth.service), so they could never show a name anyway; CHIEF_ADMIN,
 * MANAGER and OWNER reach many restaurants and must not be labelled with one.
 */
export const PLATFORM_ROLES: readonly AdminRole[] = [
  'CHIEF_ADMIN',
  'MANAGER',
  'OWNER',
  'RESTAURANT_MANAGER',
  'PERFORMER',
  'HOST',
];

/**
 * The roles that carry a `restaurantId` and therefore have a name to show.
 *
 * Stated as a positive list rather than "everything that is not platform-wide":
 * a role added to auth.store.ts then defaults to the product name, which is
 * merely unhelpful, instead of defaulting to a restaurant name it may have no
 * right to. NFC_MAKER is the reason this is not simply the complement of
 * PLATFORM_ROLES — it belongs to v-connect and to no restaurant.
 */
export const RESTAURANT_ROLES: readonly AdminRole[] = [
  'ADMIN',
  'EMPLOYEE',
  'KITCHEN',
  'CATERING_ADMIN',
  'CATERING_EMPLOYEE',
];

export type TitleContext = {
  role: AdminRole | null;
  restaurantName: string | null;
  /** v-connect.uz or nfc.v-connect.uz — its own product, its own name. */
  connectHost?: boolean;
  /**
   * A page written for a guest rather than for staff (the catering site, the
   * food-service site, a flyer, an invitation). Whoever happens to be signed in
   * on this browser is irrelevant there, so no role name leaks into the tab.
   */
  publicSite?: boolean;
};

export function resolveAppTitle({ role, restaurantName, connectHost, publicSite }: TitleContext): string {
  if (connectHost) return CONNECT_TITLE;
  if (publicSite) return PLATFORM_TITLE;
  if (!role || !RESTAURANT_ROLES.includes(role)) return PLATFORM_TITLE;
  const name = restaurantName?.trim();
  return name ? name : PLATFORM_TITLE;
}
