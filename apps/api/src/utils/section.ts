import { AdminRole } from '@prisma/client';

/**
 * Sections of the v-menu product.
 *
 * The product had two: **Banquet** (banquet.v-menu.uz) and General Dining (the
 * catering / food-service side). **Small Banquets** is the third, run by a
 * SUPERVISOR at supervisor.v-menu.uz/<slug>.
 *
 * A section is NOT the same axis as `MenuScope` in excludedCategories.ts, even
 * though the two now share value names. `MenuScope` says *which product is
 * reading the shared dish table*; a section says *whose halls, packages, extra
 * services and bookings these are*. Small Banquets is both a section and a menu
 * scope; General Dining is only a menu scope, because it has no bookings.
 *
 * ── The rule that matters ────────────────────────────────────────────────────
 * The section of a request is derived from the CALLER'S ROLE, never from the
 * request body or a query parameter the caller controls. A supervisor asking
 * for `?section=BANQUET` gets their own section anyway. Only the platform roles
 * — who can already read every restaurant — may name a section explicitly, and
 * that is what lets a Chief Admin look at either side.
 *
 * Stored as a plain string column, on the same reasoning as DesignTemplate.kind:
 * a fourth section needs no migration. This file is the only thing that decides
 * what a valid value is, so a typo cannot quietly invent a partition of its own.
 */
export type Section = 'BANQUET' | 'SMALL_BANQUET';

export const SECTIONS: Section[] = ['BANQUET', 'SMALL_BANQUET'];

export const DEFAULT_SECTION: Section = 'BANQUET';

export function isSection(value: unknown): value is Section {
  return value === 'BANQUET' || value === 'SMALL_BANQUET';
}

/**
 * The section a role works in, or `null` for a role that is not pinned to one.
 *
 * Null means "may choose" — the platform roles (CHIEF_ADMIN, MANAGER, OWNER)
 * administer both sections and say which they mean per request. Everyone else
 * is pinned: that pinning IS the data separation.
 */
export function sectionForRole(role: AdminRole | undefined | null): Section | null {
  switch (role) {
    case AdminRole.SUPERVISOR:
      return 'SMALL_BANQUET';
    case AdminRole.ADMIN:
    case AdminRole.EMPLOYEE:
    case AdminRole.KITCHEN:
      return 'BANQUET';
    default:
      // CHIEF_ADMIN / MANAGER / OWNER choose; every other role never reaches a
      // section-scoped route at all.
      return null;
  }
}

/**
 * The section for a request: the caller's own if their role has one, otherwise
 * whatever they asked for, otherwise Banquet.
 *
 * The fallback is Banquet rather than a 400 because every request that existed
 * before this feature sends no section at all, and every one of those means the
 * original section. A stale bundle keeps working.
 */
export function resolveSection(role: AdminRole | undefined | null, requested: unknown): Section {
  const pinned = sectionForRole(role);
  if (pinned) return pinned;
  return isSection(requested) ? requested : DEFAULT_SECTION;
}
