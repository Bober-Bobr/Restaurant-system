import type { AdminRole } from '../store/auth.store';

/**
 * Sections of the v-menu product — the web mirror of `apps/api/src/utils/section.ts`.
 *
 * The API cannot import from the web app or the other way round, so this rule
 * exists twice, exactly like the invoice arithmetic and `toSubdomainSlug`.
 * `sectionAgreement.test.ts` imports BOTH and runs the same roles through each;
 * if they drift, a kiosk asks for one section's halls while its bookings are
 * written to the other's, which is not a failure anybody would see until a
 * banquet's tables turned up on a small banquet's summary.
 *
 * ── What this copy is and is not for ─────────────────────────────────────────
 * On the authenticated routes the section is decided **on the server**, from the
 * caller's role, and nothing sent from here can change it. This copy exists for
 * the three UNAUTHENTICATED kiosk endpoints (halls, table packages, extra
 * services), which have no role to derive it from and so are told which set to
 * return. That is a display choice, not a permission — the bookings the kiosk
 * goes on to create are still stamped by the server.
 */
export type Section = 'BANQUET' | 'SMALL_BANQUET';

export const DEFAULT_SECTION: Section = 'BANQUET';

/**
 * The section a role works in, or `null` for a role that is not pinned to one
 * (the platform roles, who administer both).
 *
 * Must agree with `sectionForRole` on the API.
 */
export function sectionForRole(role: AdminRole | null | undefined): Section | null {
  switch (role) {
    case 'SUPERVISOR':
      return 'SMALL_BANQUET';
    case 'ADMIN':
    case 'EMPLOYEE':
    case 'KITCHEN':
      return 'BANQUET';
    default:
      return null;
  }
}

/**
 * The section a signed-in user's screens should show.
 *
 * Falls back to Banquet for the unpinned roles, because that is the section a
 * platform role reaches through the ordinary admin app; the Chief Admin's
 * cross-section views ask for what they want explicitly.
 */
export function sectionOfRole(role: AdminRole | null | undefined): Section {
  return sectionForRole(role) ?? DEFAULT_SECTION;
}
