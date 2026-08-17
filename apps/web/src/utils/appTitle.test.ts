import { describe, expect, it } from 'vitest';
import type { AdminRole } from '../store/auth.store';
import { CONNECT_TITLE, PLATFORM_ROLES, PLATFORM_TITLE, RESTAURANT_ROLES, resolveAppTitle } from './appTitle';

// The tab title is the one piece of chrome that is identical on every page, so
// getting it wrong is wrong everywhere at once. The rule is about who is signed
// in, not about which screen they are on.

const ALL_ROLES: AdminRole[] = [
  'CHIEF_ADMIN', 'MANAGER', 'OWNER', 'ADMIN', 'CATERING_ADMIN', 'RESTAURANT_MANAGER',
  'EMPLOYEE', 'KITCHEN', 'NFC_MAKER', 'PERFORMER', 'HOST', 'CATERING_EMPLOYEE',
];

describe('roles that belong to one restaurant are titled with it', () => {
  // ADMIN, EMPLOYEE, KITCHEN and the two catering roles all carry a
  // restaurantId, and their staff routinely have several restaurants open.
  for (const role of RESTAURANT_ROLES) {
    it(`${role} → the restaurant's name`, () => {
      expect(resolveAppTitle({ role, restaurantName: 'Registon Palace' })).toBe('Registon Palace');
    });
  }

  it('falls back to the product name before the name is known', () => {
    // The store is empty for a moment after a cold load; an empty tab title
    // would flash rather than simply not change.
    expect(resolveAppTitle({ role: 'ADMIN', restaurantName: null })).toBe(PLATFORM_TITLE);
    expect(resolveAppTitle({ role: 'ADMIN', restaurantName: '   ' })).toBe(PLATFORM_TITLE);
  });
});

describe('platform-wide roles are titled with the product', () => {
  for (const role of PLATFORM_ROLES) {
    it(`${role} → ${PLATFORM_TITLE}`, () => {
      expect(resolveAppTitle({ role, restaurantName: null })).toBe(PLATFORM_TITLE);
    });
  }

  it('ignores a restaurant name that somehow reached the store', () => {
    // An OWNER owns several; naming one of them in the tab would be a lie, and
    // a stale name left over from a previous session is exactly how that
    // happens. The role decides, not the presence of a value.
    for (const role of PLATFORM_ROLES) {
      expect(resolveAppTitle({ role, restaurantName: 'Registon Palace' })).toBe(PLATFORM_TITLE);
    }
  });

  it('covers every role — a new one must be classified deliberately', () => {
    // This is the test that fails when a role is added to auth.store.ts and
    // nobody decided which side of the line it falls on.
    for (const role of ALL_ROLES) {
      const title = resolveAppTitle({ role, restaurantName: 'Registon Palace' });
      expect(title).toBe(RESTAURANT_ROLES.includes(role) ? 'Registon Palace' : PLATFORM_TITLE);
    }
  });

  it('the two lists between them account for every role', () => {
    for (const role of ALL_ROLES) {
      // NFC_MAKER is the deliberate exception: neither, because it is a
      // v-connect account and that host is titled before the role is consulted.
      if (role === 'NFC_MAKER') continue;
      expect(PLATFORM_ROLES.includes(role) || RESTAURANT_ROLES.includes(role)).toBe(true);
    }
  });
});

describe('v-connect is its own product', () => {
  it('is named for itself whoever is looking', () => {
    // The builder, the sign-in page and a published plaque are all v-connect;
    // a plaque is read by a stranger with no session at all.
    expect(resolveAppTitle({ role: 'NFC_MAKER', restaurantName: null, connectHost: true })).toBe(CONNECT_TITLE);
    expect(resolveAppTitle({ role: null, restaurantName: null, connectHost: true })).toBe(CONNECT_TITLE);
  });

  it('outranks a restaurant session left open in the same browser', () => {
    expect(resolveAppTitle({ role: 'ADMIN', restaurantName: 'Registon Palace', connectHost: true })).toBe(CONNECT_TITLE);
  });

  it('an NFC_MAKER on a v-menu host is simply the platform', () => {
    // NFC_MAKER is tied to no restaurant, so there is no name to show.
    expect(resolveAppTitle({ role: 'NFC_MAKER', restaurantName: null })).toBe(PLATFORM_TITLE);
  });
});

describe('guest-facing pages never leak the staff session', () => {
  // The catering site, the food-service site, flyers and invitations are read by
  // a restaurant's guests. Whoever is signed in on that browser is irrelevant.
  it('shows the product name, not the signed-in restaurant', () => {
    expect(resolveAppTitle({ role: 'ADMIN', restaurantName: 'Registon Palace', publicSite: true })).toBe(PLATFORM_TITLE);
    expect(resolveAppTitle({ role: null, restaurantName: null, publicSite: true })).toBe(PLATFORM_TITLE);
  });
});

describe('signed out', () => {
  it('the login page and the tablet kiosk show the product name', () => {
    expect(resolveAppTitle({ role: null, restaurantName: null })).toBe(PLATFORM_TITLE);
  });
});
