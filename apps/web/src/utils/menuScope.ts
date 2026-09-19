import type { AdminRole } from '../store/auth.store';
import type { MenuScope } from '../types/domain';

/**
 * The system — banquet, small banquets or catering — a role reads the shared
 * dish table through. The web copy of `menuScopeForRole` in the API's
 * utils/excludedCategories.ts; menuScope.test.ts holds the two together for
 * every role. Null for a platform role, which belongs to no one system.
 */
const SCOPE_BY_ROLE: Partial<Record<NonNullable<AdminRole>, MenuScope>> = {
  ADMIN: 'banquet',
  EMPLOYEE: 'banquet',
  KITCHEN: 'banquet',
  SUPERVISOR: 'smallBanquet',
  SMALL_KITCHEN: 'smallBanquet',
  CATERING_ADMIN: 'catering',
  CATERING_EMPLOYEE: 'catering',
};

export function menuScopeOfRole(role: AdminRole | null | undefined): MenuScope | null {
  return (role && SCOPE_BY_ROLE[role]) || null;
}
