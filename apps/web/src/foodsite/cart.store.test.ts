import { beforeEach, describe, expect, it, vi } from 'vitest';

// zustand/persist resolves its storage when the store module is first
// evaluated, so the stub has to be in place before the dynamic import below —
// and it has to be reachable both bare and through `window`.
const store = new Map<string, string>();
const fakeStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, v); },
  removeItem: (k: string) => { store.delete(k); },
};
vi.stubGlobal('localStorage', fakeStorage);
vi.stubGlobal('window', { localStorage: fakeStorage });

const { useCartStore, dropIfStale, MAX_AGE_MS } = await import('./cart.store');

const cart = () => useCartStore.getState();

beforeEach(() => {
  store.clear();
  useCartStore.setState({ restaurantId: null, lines: {}, updatedAt: Date.now() });
});

describe('the cart holds ids and quantities, nothing else', () => {
  it('never stores a price or a name', () => {
    // Totals are recomputed against the live menu on every render, so a price
    // the restaurant edits can never go stale in a guest's cart.
    cart().setRestaurant('r1');
    cart().add('m1');
    const persisted = JSON.parse(store.get('vmenu-food-cart')!);
    expect(persisted.state.lines).toEqual({ m1: 1 });
    expect(JSON.stringify(persisted)).not.toMatch(/price|name/i);
  });

  it('adds and increments', () => {
    cart().add('m1');
    cart().add('m1');
    cart().add('m2');
    expect(cart().lines).toEqual({ m1: 2, m2: 1 });
  });

  it('removes an entry rather than keeping it at zero', () => {
    // Left at 0, every future reader would have to remember to filter it out.
    cart().add('m1');
    cart().remove('m1');
    expect(cart().lines).toEqual({});
    expect('m1' in cart().lines).toBe(false);
  });

  it('treats a quantity of zero or less as a removal', () => {
    cart().add('m1');
    cart().setQty('m1', 0);
    expect(cart().lines).toEqual({});

    cart().setQty('m2', -3);
    expect(cart().lines).toEqual({});
  });

  it('caps a single line at 99', () => {
    // A stuck stepper — or a fat finger on a phone — must not order 5,000 plov.
    cart().setQty('m1', 100000);
    expect(cart().lines.m1).toBe(99);
  });

  it('empties on clear', () => {
    cart().add('m1');
    cart().clear();
    expect(cart().lines).toEqual({});
  });
});

describe('a cart belongs to one restaurant', () => {
  it('empties when the guest walks into a different restaurant', () => {
    cart().setRestaurant('r1');
    cart().add('m1');
    cart().setRestaurant('r2');
    expect(cart().lines).toEqual({});
    expect(cart().restaurantId).toBe('r2');
  });

  it('does NOT empty when the same restaurant is set again', () => {
    // Every render calls this; clearing unconditionally would empty the cart
    // on navigation.
    cart().setRestaurant('r1');
    cart().add('m1');
    cart().setRestaurant('r1');
    expect(cart().lines).toEqual({ m1: 1 });
  });
});

describe('a cart expires', () => {
  const HOUR = 60 * 60 * 1000;
  const now = Date.now();

  it('drops a cart older than twelve hours', () => {
    // Rehydrating last week's cart at a table is confusing, and is actively
    // wrong now that an order reaches a kitchen.
    const state = { restaurantId: 'r1', lines: { m1: 2 }, updatedAt: now - 13 * HOUR };
    dropIfStale(state, now);
    expect(state.lines).toEqual({});
    expect(state.restaurantId).toBeNull();
  });

  it('keeps a cart from an hour ago', () => {
    const state = { restaurantId: 'r1', lines: { m1: 2 }, updatedAt: now - HOUR };
    dropIfStale(state, now);
    expect(state.lines).toEqual({ m1: 2 });
    expect(state.restaurantId).toBe('r1');
  });

  it('keeps one right at the boundary and drops one just past it', () => {
    const fresh = { restaurantId: 'r1', lines: { m1: 1 }, updatedAt: now - MAX_AGE_MS };
    dropIfStale(fresh, now);
    expect(fresh.lines).toEqual({ m1: 1 });

    const stale = { restaurantId: 'r1', lines: { m1: 1 }, updatedAt: now - MAX_AGE_MS - 1 };
    dropIfStale(stale, now);
    expect(stale.lines).toEqual({});
  });

  it('drops a cart with no timestamp at all', () => {
    // Written by a version before `updatedAt` existed: unknown age, so old.
    const state = { restaurantId: 'r1', lines: { m1: 1 } };
    dropIfStale(state, now);
    expect(state.lines).toEqual({});
  });

  it('stamps the time on every change, so there is something to judge', () => {
    const before = cart().updatedAt;
    vi.setSystemTime(new Date(Date.now() + 5000));
    cart().add('m1');
    expect(cart().updatedAt).toBeGreaterThan(before);
    vi.useRealTimers();
  });
});
