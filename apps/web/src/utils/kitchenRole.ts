import type { AdminRole } from '../store/auth.store';

/**
 * The roles that read a booking as a KITCHEN does.
 *
 * `SMALL_KITCHEN` is required to work exactly as `KITCHEN` does — that is the
 * whole premise of the Small Banquets section's staff routes, which mount one
 * route table for both. The events page had two `role === 'KITCHEN'` tests in
 * it anyway, so the Small Banquets cooks got neither the table package's dishes
 * nor the "Additional dishes" heading: they saw a booking with no food on it.
 *
 * **A positive list, like `kioskSessionsFor` and the kiosk's own role gate.**
 * `role !== 'EMPLOYEE'` would read the same way today and hand the kitchen view
 * to every role added to that layout afterwards; a list has to be edited on
 * purpose, and `kitchenRole.test.ts` holds it to the roles that actually reach
 * those pages.
 */
export const KITCHEN_ROLES = ['KITCHEN', 'SMALL_KITCHEN'] as const;

export type KitchenRole = (typeof KITCHEN_ROLES)[number];

/** Whether this role reads an event as a cook rather than as front of house. */
export function isKitchenRole(role: AdminRole | null | undefined): boolean {
  return KITCHEN_ROLES.includes(role as KitchenRole);
}
