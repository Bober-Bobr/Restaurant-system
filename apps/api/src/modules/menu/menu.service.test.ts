import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MenuCategory } from '@prisma/client';
import { MenuService } from './menu.service.js';
import { createMenuItemSchema, updateMenuItemSchema, arrangementSchema, assignSelectionSchema } from './menu.schema.js';
import type { MenuRepository } from './menu.repository.js';
import type { MenuScope } from '../../utils/excludedCategories.js';
import type { EventRepository } from '../events/event.repository.js';

// Adding a dish, editing one, and putting one on an event's menu — the banquet
// side's daily work.

const DISH = { id: 'm1', name: 'Lagman', priceCents: 4500000, isActive: true, restaurantId: 'r1' };

function makeService() {
  const menuRepo = {
    listActive: vi.fn(async () => []),
    listAll: vi.fn(async () => []),
    create: vi.fn(async (restaurantId: string, payload: unknown) => ({ id: 'new', restaurantId, ...(payload as object) })),
    getById: vi.fn(async () => DISH),
    updateById: vi.fn(async (id: string, payload: unknown) => ({ id, ...(payload as object) })),
    deleteById: vi.fn(async () => {}),
    upsertSelection: vi.fn(async () => ({ id: 'sel1' })),
    saveArrangement: vi.fn(async () => {}),
    getExcludedCategories: vi.fn(async () => ({
      banquet: [MenuCategory.SUSHI_ROLLS],
      catering: [MenuCategory.FIRST_COURSE],
    })),
    // Mirrors the repository: a scope the caller left out keeps its stored list.
    saveExcludedCategories: vi.fn(async (_r: string, p: Partial<Record<MenuScope, MenuCategory[]>>) => ({
      banquet: p.banquet ?? [MenuCategory.SUSHI_ROLLS],
      catering: p.catering ?? [MenuCategory.FIRST_COURSE],
    })),
    getHideSubcategories: vi.fn(async () => false),
    saveHideSubcategories: vi.fn(async (_r: string, v: boolean) => v),
  };
  const eventRepo = {
    getByNumber: vi.fn(async () => ({ id: 'event-cuid', eventNumber: 42, restaurantId: 'r1' })),
  };
  const service = new MenuService(
    menuRepo as unknown as MenuRepository,
    eventRepo as unknown as EventRepository,
  );
  return { service, menuRepo, eventRepo };
}

async function statusOf(run: () => Promise<unknown>): Promise<number> {
  try {
    await run();
  } catch (error) {
    return (error as { status?: number }).status ?? 0;
  }
  throw new Error('expected the call to be refused, but it succeeded');
}

let harness: ReturnType<typeof makeService>;
beforeEach(() => { harness = makeService(); });

describe('adding a dish', () => {
  it('creates it inside the caller\'s restaurant', async () => {
    // Multi-tenancy: the restaurant comes from the token, never from the body.
    const created = await harness.service.createMenuItem('r1', {
      name: 'Lagman', category: MenuCategory.SOUPS, priceCents: 4500000,
    });
    expect(harness.menuRepo.create).toHaveBeenCalledWith('r1', expect.objectContaining({ name: 'Lagman' }));
    expect(created.restaurantId).toBe('r1');
  });

  describe('the payload it will accept', () => {
    const valid = { name: 'Lagman', category: MenuCategory.SOUPS, priceCents: 4500000 };

    it('accepts a minimal dish', () => {
      expect(createMenuItemSchema.safeParse(valid).success).toBe(true);
    });

    it('requires a name of at least two characters', () => {
      expect(createMenuItemSchema.safeParse({ ...valid, name: 'L' }).success).toBe(false);
      expect(createMenuItemSchema.safeParse({ ...valid, name: '' }).success).toBe(false);
    });

    it('requires a real category', () => {
      expect(createMenuItemSchema.safeParse({ ...valid, category: 'BURGERS' }).success).toBe(false);
    });

    it('requires a positive whole price in tiyin', () => {
      // Money is an integer count of tiyin; a fractional one is a bug upstream.
      expect(createMenuItemSchema.safeParse({ ...valid, priceCents: 0 }).success).toBe(false);
      expect(createMenuItemSchema.safeParse({ ...valid, priceCents: -100 }).success).toBe(false);
      expect(createMenuItemSchema.safeParse({ ...valid, priceCents: 45.5 }).success).toBe(false);
      expect(createMenuItemSchema.safeParse({ ...valid, priceCents: '4500000' }).success).toBe(false);
    });

    it('accepts per-language names, and lets any language be omitted', () => {
      expect(createMenuItemSchema.safeParse({ ...valid, nameI18n: { ru: 'Лагман' } }).success).toBe(true);
      expect(createMenuItemSchema.safeParse({ ...valid, nameI18n: {} }).success).toBe(true);
      expect(createMenuItemSchema.safeParse({ ...valid, nameI18n: null }).success).toBe(true);
    });

    it('accepts the flags the Menu page toggles', () => {
      const parsed = createMenuItemSchema.safeParse({ ...valid, isBestseller: true, isOutOfStock: true, showOnTablet: false });
      expect(parsed.success).toBe(true);
    });

    it('lets a subcategory be cleared with null', () => {
      expect(createMenuItemSchema.safeParse({ ...valid, subcategoryId: null }).success).toBe(true);
      expect(createMenuItemSchema.safeParse({ ...valid, subcategoryId: 'not-a-cuid' }).success).toBe(false);
    });

    it('makes every field optional for an edit', () => {
      // The Menu page autosaves partial patches — a price-only save must parse.
      expect(updateMenuItemSchema.safeParse({ priceCents: 100 }).success).toBe(true);
      expect(updateMenuItemSchema.safeParse({}).success).toBe(true);
    });
  });
});

describe('editing and deleting a dish', () => {
  it('404s on a dish that does not exist', async () => {
    harness.menuRepo.getById.mockResolvedValue(null as never);
    expect(await statusOf(() => harness.service.updateMenuItem('gone', { name: 'x' }))).toBe(404);
    expect(await statusOf(() => harness.service.deleteMenuItem('gone'))).toBe(404);
  });

  it('checks the dish exists before deleting anything', async () => {
    harness.menuRepo.getById.mockResolvedValue(null as never);
    await statusOf(() => harness.service.deleteMenuItem('gone'));
    expect(harness.menuRepo.deleteById).not.toHaveBeenCalled();
  });

  it('passes the patch straight through once the dish is found', async () => {
    await harness.service.updateMenuItem('m1', { priceCents: 5000000 });
    expect(harness.menuRepo.updateById).toHaveBeenCalledWith('m1', { priceCents: 5000000 });
  });
});

describe('putting a dish on an event\'s menu', () => {
  it('snapshots the price at the moment it is chosen', async () => {
    // Same reasoning as an order line: what was agreed must not move when the
    // restaurant edits the menu later.
    await harness.service.assignMenuItemToEvent('r1', 42, { menuItemId: 'm1', quantity: 3 });
    expect(harness.menuRepo.upsertSelection).toHaveBeenCalledWith('event-cuid', 'm1', 3, 4500000);
  });

  it('resolves the event by NUMBER inside the caller\'s restaurant', async () => {
    // Event numbers are per-restaurant, so the pair is what identifies one.
    await harness.service.assignMenuItemToEvent('r1', 42, { menuItemId: 'm1', quantity: 1 });
    expect(harness.eventRepo.getByNumber).toHaveBeenCalledWith('r1', 42);
  });

  it('404s when the event is not this restaurant\'s', async () => {
    harness.eventRepo.getByNumber.mockResolvedValue(null as never);
    expect(await statusOf(() => harness.service.assignMenuItemToEvent('r1', 42, { menuItemId: 'm1', quantity: 1 }))).toBe(404);
  });

  it('refuses a dish that has been deactivated', async () => {
    harness.menuRepo.getById.mockResolvedValue({ ...DISH, isActive: false } as never);
    expect(await statusOf(() => harness.service.assignMenuItemToEvent('r1', 42, { menuItemId: 'm1', quantity: 1 }))).toBe(404);
  });

  it('requires a positive quantity', () => {
    expect(assignSelectionSchema.safeParse({ menuItemId: 'c'.repeat(25), quantity: 0 }).success).toBe(false);
    expect(assignSelectionSchema.safeParse({ menuItemId: 'c'.repeat(25), quantity: -1 }).success).toBe(false);
  });
});

describe('menu settings', () => {
  it('reads both switches together', async () => {
    const settings = await harness.service.getSettings('r1');
    expect(settings.excludedCategories).toEqual({
      banquet: [MenuCategory.SUSHI_ROLLS],
      catering: [MenuCategory.FIRST_COURSE],
    });
    expect(settings.hideSubcategories).toBe(false);
  });

  it('leaves the subcategory switch alone when the save does not mention it', async () => {
    // A save of the excluded-category list must not silently flip an unrelated
    // setting back to its default.
    await harness.service.saveSettings('r1', { excludedCategories: { banquet: [] } });
    expect(harness.menuRepo.saveHideSubcategories).not.toHaveBeenCalled();
    expect(harness.menuRepo.getHideSubcategories).toHaveBeenCalled();
  });

  it('writes it when the save does mention it', async () => {
    const saved = await harness.service.saveSettings('r1', { excludedCategories: { banquet: [] }, hideSubcategories: true });
    expect(harness.menuRepo.saveHideSubcategories).toHaveBeenCalledWith('r1', true);
    expect(saved.hideSubcategories).toBe(true);
  });

  it('accepts turning it explicitly off', async () => {
    const saved = await harness.service.saveSettings('r1', { excludedCategories: { banquet: [] }, hideSubcategories: false });
    expect(harness.menuRepo.saveHideSubcategories).toHaveBeenCalledWith('r1', false);
    expect(saved.hideSubcategories).toBe(false);
  });
});

describe('the two products keep separate excluded-category lists', () => {
  // One dish table serves banquets and the public catering menu, and each
  // switches off the categories it has no use for. Before the split there was
  // one list, so hiding energy drinks from a banquet package also stripped them
  // from the public menu.
  it('saving one product sends only that product', async () => {
    await harness.service.saveSettings('r1', { excludedCategories: { catering: [MenuCategory.ALCOHOL] } });
    expect(harness.menuRepo.saveExcludedCategories).toHaveBeenCalledWith('r1', {
      catering: [MenuCategory.ALCOHOL],
    });
  });

  it('leaves the list of the other product untouched', async () => {
    const saved = await harness.service.saveSettings('r1', { excludedCategories: { catering: [] } });
    expect(saved.excludedCategories.catering).toEqual([]);
    expect(saved.excludedCategories.banquet).toEqual([MenuCategory.SUSHI_ROLLS]);
  });

  it('a save that mentions no category list clears neither', async () => {
    // The Subcategories page flips only the master switch.
    const saved = await harness.service.saveSettings('r1', { hideSubcategories: true });
    expect(harness.menuRepo.saveExcludedCategories).toHaveBeenCalledWith('r1', {});
    expect(saved.excludedCategories).toEqual({
      banquet: [MenuCategory.SUSHI_ROLLS],
      catering: [MenuCategory.FIRST_COURSE],
    });
  });

  it('a menu read names the product it is reading for', async () => {
    await harness.service.listMenuItems('r1', 'catering');
    expect(harness.menuRepo.listActive).toHaveBeenCalledWith('r1', 'catering');
    await harness.service.listMenuItems('r1', 'banquet');
    expect(harness.menuRepo.listActive).toHaveBeenCalledWith('r1', 'banquet');
  });
});

describe('the catering-site arrangement', () => {
  it('saves the category order and the dish positions together', async () => {
    await harness.service.saveArrangement('r1', {
      categoryOrder: [MenuCategory.SOUPS, MenuCategory.GRILL],
      dishOrder: [{ id: 'm1', sortOrder: 0 }],
    });
    expect(harness.menuRepo.saveArrangement).toHaveBeenCalledWith(
      'r1', [MenuCategory.SOUPS, MenuCategory.GRILL], [{ id: 'm1', sortOrder: 0 }],
    );
  });

  it('rejects an unknown category or a negative position', () => {
    expect(arrangementSchema.safeParse({ categoryOrder: ['BURGERS'], dishOrder: [] }).success).toBe(false);
    expect(arrangementSchema.safeParse({
      categoryOrder: [], dishOrder: [{ id: 'c'.repeat(25), sortOrder: -1 }],
    }).success).toBe(false);
  });
});
