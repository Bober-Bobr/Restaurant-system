import { describe, expect, it } from 'vitest';
import { draftOf, patchOf, mayAcceptServerValue } from './adminMenuDraft';
import type { MenuItem } from '../types/domain';

type MenuCategory = MenuItem['category'];

// The Menu page has no Save button. These are the two rules autosave adds over
// one — everything else it does was already true of the button.

const DISH = {
  id: 'm1',
  name: 'Lagman',
  category: 'SOUPS' as MenuCategory,
  description: 'Noodles',
  priceCents: 4500000,
  photoUrl: '/uploads/r1/menu/soups/a.jpg',
  nameI18n: { ru: 'Лагман' },
  descriptionI18n: {},
  subcategoryId: 'sub1',
  isBestseller: false,
  isOutOfStock: false,
} as unknown as MenuItem;

describe('the row shows what the server has', () => {
  it('carries every editable field across', () => {
    const draft = draftOf(DISH);
    expect(draft.name).toBe('Lagman');
    expect(draft.category).toBe('SOUPS');
    expect(draft.description).toBe('Noodles');
    expect(draft.photoUrl).toBe('/uploads/r1/menu/soups/a.jpg');
    expect(draft.nameI18n).toEqual({ ru: 'Лагман' });
  });

  it('shows the price in so\'m, ready to type over', () => {
    expect(draftOf(DISH).price).toBe('45000');
  });

  it('shows an unset field as empty, never as "null"', () => {
    const bare = draftOf({ ...DISH, description: null, photoUrl: null, nameI18n: null } as unknown as MenuItem);
    expect(bare.description).toBe('');
    expect(bare.photoUrl).toBe('');
    expect(bare.nameI18n).toEqual({});
  });
});

describe('an untouched row writes nothing new', () => {
  it('patches the same values back', () => {
    const patch = patchOf(draftOf(DISH), DISH);
    expect(patch.name).toBe(DISH.name);
    expect(patch.category).toBe(DISH.category);
    expect(patch.priceCents).toBe(DISH.priceCents);
    expect(patch.photoUrl).toBe(DISH.photoUrl);
  });

  it('does not clear the subcategory', () => {
    expect(patchOf(draftOf(DISH), DISH)).not.toHaveProperty('subcategoryId');
  });
});

describe('a price being typed is never written as something else', () => {
  // Autosave fires mid-edit; a Save button only ever saw a finished value.
  for (const price of ['', '   ', '.', 'abc', '-5']) {
    it(`leaves ${JSON.stringify(price)} out of the patch entirely`, () => {
      const patch = patchOf({ ...draftOf(DISH), price }, DISH);
      expect(patch).not.toHaveProperty('priceCents');
    });

    it(`still saves the rest of the row while the price reads ${JSON.stringify(price)}`, () => {
      // The name edit must not be held hostage by a half-typed price.
      const patch = patchOf({ ...draftOf(DISH), price, name: 'Lagmon' }, DISH);
      expect(patch.name).toBe('Lagmon');
    });
  }

  it('writes a complete price in tiyin', () => {
    expect(patchOf({ ...draftOf(DISH), price: '6.50' }, DISH).priceCents).toBe(650);
    expect(patchOf({ ...draftOf(DISH), price: '45 000' }, DISH).priceCents).toBe(4500000);
  });

  it('does commit a trailing-dot value, which is transient by design', () => {
    // "6." parses as 6, so pausing there for the debounce writes 6 so'm — and
    // the next keystroke writes 6.50 over it. Pinned rather than fixed: the
    // window is one save and it corrects itself, whereas refusing every value
    // ending in a separator would also refuse a deliberate "45000." save.
    expect(patchOf({ ...draftOf(DISH), price: '6.' }, DISH).priceCents).toBe(600);
  });
});

describe('the server may not overwrite an unsaved edit', () => {
  // The list refetches after every autosave, so the row is handed a fresh dish
  // constantly. Copying it in mid-typing is the one way autosave could lose
  // more work than a Save button ever did.
  it('accepts a server value for a clean row', () => {
    expect(mayAcceptServerValue(false)).toBe(true);
  });

  it('refuses one while the row holds unsaved edits', () => {
    expect(mayAcceptServerValue(true)).toBe(false);
  });
});

describe('the rest of the patch', () => {
  it('trims a name and drops a description cleared to spaces', () => {
    const patch = patchOf({ ...draftOf(DISH), name: '  Lagman  ', description: '   ' }, DISH);
    expect(patch.name).toBe('Lagman');
    expect(patch.description).toBeUndefined();
  });

  it('clears the subcategory when the dish moves category', () => {
    // It belonged to the old category and would otherwise dangle.
    const patch = patchOf({ ...draftOf(DISH), category: 'GRILL' as MenuCategory }, DISH);
    expect(patch.category).toBe('GRILL');
    expect(patch.subcategoryId).toBeNull();
  });

  it('strips blank translations but keeps real ones', () => {
    const patch = patchOf({ ...draftOf(DISH), nameI18n: { ru: '  ', uz: 'Lagmon' } }, DISH);
    expect(patch.nameI18n).toEqual({ uz: 'Lagmon' });
  });

  it('sends an empty translation map rather than undefined, so one can be removed', () => {
    // `undefined` would be omitted from the JSON body and the old translation
    // would survive on the server.
    const patch = patchOf({ ...draftOf(DISH), nameI18n: {} }, DISH);
    expect(patch.nameI18n).toEqual({});
  });

  it('clears a photo that was removed', () => {
    expect(patchOf({ ...draftOf(DISH), photoUrl: '' }, DISH).photoUrl).toBeUndefined();
  });
});
