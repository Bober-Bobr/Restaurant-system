import { useAuthStore } from '../store/auth.store';
import { resolveAppTitle } from './appTitle';
import {
  getCateringSlug,
  getInvitationSubdomainSlug,
  getInviteSiteSlug,
  isConnectHost,
  isEventSubdomain,
  isFoodSiteHost,
  isInviteRootDomain,
} from './subdomain';

// The impure half of appTitle.ts: reads the host and the current session and
// writes document.title. Kept in its own module so `appTitle.ts` stays free of
// the auth store and of `window`, and can therefore be unit-tested as a plain
// function.

/** True on the one product that titles its own tab; nothing here fights it. */
export const ownsItsOwnTitle = () => isInviteRootDomain() || !!getInviteSiteSlug();

/** A page written for a guest — no staff session should reach the tab title. */
const isGuestPage = () =>
  !!getCateringSlug() || isFoodSiteHost() || isEventSubdomain() || !!getInvitationSubdomainSlug();

/**
 * Set the tab title for whoever is signed in right now.
 *
 * Called once from main.tsx before the first render — an effect would run after
 * the first paint, leaving the title index.html shipped with visible until then
 * — and again from App.tsx whenever the role or restaurant changes.
 */
export function applyAppTitle(): void {
  if (ownsItsOwnTitle()) return;
  const { role, restaurantName } = useAuthStore.getState();
  document.title = resolveAppTitle({
    role,
    restaurantName,
    connectHost: isConnectHost(),
    publicSite: isGuestPage(),
  });
}
