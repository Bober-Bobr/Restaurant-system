import { formatSumInput, parseSumToTiyin } from '../utils/currency';
import { cleanI18n } from '../utils/menuI18n';
import type { MenuItem, DishI18n } from '../types/domain';

// ── What an autosaving dish row sends, decided in one pure place ─────────────
// The Menu page has no Save button: edits commit on their own (see
// `useDishDraft` in AdminMenuPage). The timing lives in the hook; WHAT gets
// written lives here, where it can be reasoned about and tested without a DOM.

export type MenuCategory = MenuItem['category'];

export type DishDraft = {
  name: string;
  category: MenuCategory;
  description: string;
  price: string;
  photoUrl: string;
  nameI18n: DishI18n;
  descriptionI18n: DishI18n;
};

/** The row's fields as they should read for a dish straight from the server. */
export function draftOf(item: MenuItem): DishDraft {
  return {
    name: item.name,
    category: item.category,
    description: item.description ?? '',
    price: formatSumInput(item.priceCents),
    photoUrl: item.photoUrl ?? '',
    nameI18n: item.nameI18n ?? {},
    descriptionI18n: item.descriptionI18n ?? {},
  };
}

/**
 * The patch for a draft. Two rules matter more than the rest, because autosave
 * fires mid-edit where a Save button only ever fired on a finished one:
 *
 *  · A price that does not parse is **left out**, not written as 0. Autosave
 *    sees "6." on the way to "6.50"; committing that as a price would quietly
 *    change what a dish costs. The next keystroke carries it.
 *  · Changing the category clears the subcategory, which belonged to the old
 *    one — the same rule the Save button applied.
 */
export function patchOf(draft: DishDraft, item: MenuItem): Partial<MenuItem> {
  const priceCents = parseSumToTiyin(draft.price);
  return {
    name: draft.name.trim(),
    category: draft.category,
    description: draft.description.trim() || undefined,
    nameI18n: cleanI18n(draft.nameI18n) ?? {},
    descriptionI18n: cleanI18n(draft.descriptionI18n) ?? {},
    photoUrl: draft.photoUrl.trim() || undefined,
    ...(priceCents !== null ? { priceCents } : {}),
    ...(draft.category !== item.category ? { subcategoryId: null } : {}),
  };
}

/**
 * Whether a dish coming back from the server may overwrite what is on screen.
 *
 * The list refetches after every autosave, so a row is handed a fresh `item`
 * constantly. Copying it in while the row holds unsaved edits would throw away
 * whatever was typed during the request — the one way an autosaving form can
 * lose more work than a Save button ever did.
 */
export function mayAcceptServerValue(hasUnsavedEdits: boolean): boolean {
  return !hasUnsavedEdits;
}
