import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as sub from './subdomain';
import { toSubdomainSlug as apiSlug } from '../../../api/src/utils/slug';

// ── Which product a visitor sees is decided entirely by hostname ────────────
// Every one of these predicates is consulted by the waterfall at the top of
// App.tsx. Two of them answering true, or the wrong one answering true, sends
// somebody to another product's app — a restaurant's guests at the Chief Admin
// dashboard, say. This walks the whole table.

/** These modules only ever read `hostname` and `pathname`. */
function at(url: string) {
  const parsed = new URL(url);
  vi.stubGlobal('window', { location: { hostname: parsed.hostname, pathname: parsed.pathname } });
}

beforeEach(() => vi.unstubAllGlobals());

const HOSTS = {
  root: 'https://v-menu.uz/',
  www: 'https://www.v-menu.uz/',
  localhost: 'http://localhost:5173/',
  admin: 'https://admin.v-menu.uz/',
  cabinet: 'https://cabinet.v-menu.uz/',
  manager: 'https://manager.v-menu.uz/',
  rmanager: 'https://rmanager.v-menu.uz/',
  performer: 'https://performer.v-menu.uz/',
  banquet: 'https://banquet.v-menu.uz/registon',
  foodAdmin: 'https://food-admin.v-menu.uz/registon',
  catering: 'https://v-menu.uz/registon',
  foodSite: 'https://test.v-menu.uz/registon',
  invite: 'https://v-invite.uz/',
  inviteSite: 'https://v-invite.uz/aziz-and-malika',
  connect: 'https://v-connect.uz/',
  nfc: 'https://nfc.v-connect.uz/',
  plaque: 'https://v-connect.uz/cafe-nur',
  event: 'https://event.v-menu.uz/summer-party',
  invitation: 'https://aziz.invitation.v-menu.uz/',
};

describe('each host is claimed by exactly one product', () => {
  // The predicates the App.tsx waterfall tests, in the order it tests them.
  const PREDICATES: Record<string, () => boolean> = {
    connectRoot: sub.isConnectRootDomain,
    nfcBuilder: sub.isNfcBuilderHost,
    inviteRoot: sub.isInviteRootDomain,
    admin: sub.isAdminSubdomain,
    cabinet: sub.isCabinetSubdomain,
    manager: sub.isManagerSubdomain,
    rmanager: sub.isRestaurantManagerSubdomain,
    performer: sub.isPerformerSubdomain,
    banquet: sub.isBanquetHost,
    foodAdmin: sub.isFoodAdminHost,
    foodSite: sub.isFoodSiteHost,
    event: sub.isEventSubdomain,
  };

  const EXPECTED: Record<keyof typeof HOSTS, string[]> = {
    root: [], www: [], localhost: [],
    admin: ['admin'], cabinet: ['cabinet'], manager: ['manager'], rmanager: ['rmanager'],
    performer: ['performer'], banquet: ['banquet'], foodAdmin: ['foodAdmin'],
    catering: [], foodSite: ['foodSite'],
    invite: ['inviteRoot'], inviteSite: ['inviteRoot'],
    connect: ['connectRoot'], nfc: ['nfcBuilder'], plaque: ['connectRoot'],
    event: ['event'], invitation: [],
  };

  for (const [name, url] of Object.entries(HOSTS)) {
    it(`${name} (${url}) matches only ${JSON.stringify(EXPECTED[name as keyof typeof HOSTS])}`, () => {
      at(url);
      const matched = Object.entries(PREDICATES).filter(([, fn]) => fn()).map(([key]) => key);
      expect(matched.sort()).toEqual([...EXPECTED[name as keyof typeof HOSTS]].sort());
    });
  }
});

describe('the root domain', () => {
  it('covers the bare host, www and local development', () => {
    for (const url of [HOSTS.root, HOSTS.www, HOSTS.localhost, 'http://v-menu.local:5173/']) {
      at(url);
      expect(sub.isRootDomain()).toBe(true);
    }
  });

  it('does not claim a subdomain', () => {
    for (const url of [HOSTS.admin, HOSTS.banquet, HOSTS.foodSite]) {
      at(url);
      expect(sub.isRootDomain()).toBe(false);
    }
  });
});

describe('the public catering slug', () => {
  it('is the first path segment on the root domain', () => {
    at(HOSTS.catering);
    expect(sub.getCateringSlug()).toBe('registon');
  });

  it('is null at the root, where the login page lives', () => {
    at(HOSTS.root);
    expect(sub.getCateringSlug()).toBeNull();
  });

  it('never swallows a reserved platform path', () => {
    // /login and /tablet belong to the platform; a restaurant may not shadow them.
    for (const path of ['login', 'tablet']) {
      at(`https://v-menu.uz/${path}`);
      expect(sub.getCateringSlug()).toBeNull();
    }
  });

  it('is null in local development, where routing is role-based', () => {
    at('http://localhost:5173/admin/menu');
    expect(sub.getCateringSlug()).toBeNull();
  });

  it('ignores deeper path segments', () => {
    at('https://v-menu.uz/registon/halls');
    expect(sub.getCateringSlug()).toBe('registon');
  });
});

describe('the food-service site runs beside the live one', () => {
  it('takes its slug from the path', () => {
    at(HOSTS.foodSite);
    expect(sub.getFoodSiteSlug()).toBe('registon');
  });

  it('is null at the bare host, so a branded screen shows instead of an admin shell', () => {
    at('https://test.v-menu.uz/');
    expect(sub.isFoodSiteHost()).toBe(true);
    expect(sub.getFoodSiteSlug()).toBeNull();
  });

  it('does NOT claim the live catering host', () => {
    // The whole point of the parallel host: v-menu.uz/<slug> must be untouched.
    at(HOSTS.catering);
    expect(sub.isFoodSiteHost()).toBe(false);
    expect(sub.getCateringSlug()).toBe('registon');
  });

  it('honours the same reserved paths', () => {
    at('https://test.v-menu.uz/login');
    expect(sub.getFoodSiteSlug()).toBeNull();
  });

  it('works on the local-dev host too', () => {
    at('http://test.v-menu.local:5173/registon');
    expect(sub.getFoodSiteSlug()).toBe('registon');
  });
});

describe('the router basename', () => {
  // Miss this and every internal <Link> 404s under a cosmetic slug.
  it('is the slug on the path-based restaurant hosts', () => {
    for (const url of [HOSTS.banquet, HOSTS.foodAdmin, HOSTS.catering, HOSTS.foodSite]) {
      at(url);
      expect(sub.routerBasename()).toBe('/registon');
    }
  });

  it('survives a deep link', () => {
    at('https://banquet.v-menu.uz/registon/admin/menu');
    expect(sub.routerBasename()).toBe('/registon');
  });

  it('is empty where routes live at the root', () => {
    for (const url of [HOSTS.root, HOSTS.admin, HOSTS.cabinet, HOSTS.manager, HOSTS.performer, HOSTS.event, HOSTS.invite]) {
      at(url);
      expect(sub.routerBasename()).toBe('');
    }
  });

  it('is empty in local development, keeping role-based routing at root paths', () => {
    at('http://localhost:5173/admin/menu');
    expect(sub.routerBasename()).toBe('');
  });

  it('is empty at a bare banquet host rather than eating the first route', () => {
    at('https://banquet.v-menu.uz/');
    expect(sub.routerBasename()).toBe('');
  });
});

describe('v-invite and v-connect are separate products', () => {
  it('serves a published invitation from a path, not a subdomain', () => {
    // The .uz registrar rejects wildcard DNS, so every published page is
    // path-based.
    at(HOSTS.inviteSite);
    expect(sub.isInviteRootDomain()).toBe(true);
    expect(sub.buildInviteSiteUrl('aziz-and-malika')).toBe('https://v-invite.uz/aziz-and-malika');
  });

  it('tells the plaque page apart from the NFC builder', () => {
    at(HOSTS.plaque);
    expect(sub.getPlaqueSlug()).toBe('cafe-nur');
    expect(sub.isNfcBuilderHost()).toBe(false);

    at(HOSTS.nfc);
    expect(sub.isNfcBuilderHost()).toBe(true);
    expect(sub.getPlaqueSlug()).toBeNull();
  });

  it('keeps the v-connect login off the plaque path', () => {
    at('https://v-connect.uz/login');
    expect(sub.getPlaqueSlug()).toBeNull();
  });

  it('reads a guest invitation\'s slug from its subdomain label', () => {
    at(HOSTS.invitation);
    expect(sub.getInvitationSubdomainSlug()).toBe('aziz');
  });

  it('reads a flyer\'s slug from its subdomain label when it has one', () => {
    at('https://summer.event.v-menu.uz/');
    expect(sub.getEventSubdomainSlug()).toBe('summer');
    at(HOSTS.event);
    expect(sub.getEventSubdomainSlug()).toBeNull(); // bare host → the slug is in the path
  });
});

describe('slug derivation is in lockstep with the API', () => {
  // Restaurant slugs are not stored: the browser builds the URL with its copy
  // and the server resolves it back with its own. If the two ever disagree,
  // a restaurant's public site simply stops resolving — with no error anywhere.
  const NAMES = [
    'Registon Palace', 'REGISTON', 'Registon_Palace', "Registon's Café & Co.",
    'Ресторан Регистон', '  spaced   out  ', '---dashes---', '', '!!!',
    'a'.repeat(200), 'Bahor 2026', 'Zafar & Sons', 'Café-Restaurant «Nur»',
  ];

  for (const name of NAMES) {
    it(`agrees on ${JSON.stringify(name.slice(0, 30))}`, () => {
      expect(sub.toSubdomainSlug(name)).toBe(apiSlug(name));
    });
  }

  it('builds the URLs the API will be asked to resolve', () => {
    expect(sub.buildCateringSiteUrl(sub.toSubdomainSlug('Registon Palace'))).toBe('https://v-menu.uz/registon-palace');
    expect(sub.buildFoodSiteUrl(sub.toSubdomainSlug('Registon Palace'))).toBe('https://test.v-menu.uz/registon-palace');
  });
});
