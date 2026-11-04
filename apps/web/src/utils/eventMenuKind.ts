import type { DishI18n, Event, EventMenuConfig } from '../types/domain';
import type { Locale, translate } from './translate';
import { dishName } from './menuI18n';

/**
 * What kind of evening a booking is — and whether anybody has decided.
 *
 * A Small Banquets booking can be a BANQUET (priced by a table package, menu
 * chosen in the kiosk) or FOOD SERVICE (dishes and portions, which become an
 * ordinary floor order). The two are priced in completely different ways, so a
 * booking where nobody has chosen yet is its own answer — `null`, shown as
 * "Menu not selected" — rather than quietly filed as a banquet.
 *
 * **Derived, never a column.** The obvious alternative is a new `Event.status`
 * value, and it would be wrong: `status` is about the BOOKING (draft,
 * confirmed, cancelled, completed) and this is about its menu. One field
 * answering both means a cancelled booking cannot also be one whose menu was
 * never chosen, and the two facts are independent. Reading it from the data
 * also means it cannot drift from the data.
 */

export type MenuKind = 'banquet' | 'dining' | null;

const hasAnyCourse = (config: EventMenuConfig | null | undefined): boolean => {
  if (!config) return false;
  return (config.hotAppetizerIds?.length ?? 0) > 0
    || !!config.firstCourseId
    || (config.secondCourseIds?.length ?? 0) > 0
    || (config.thirdCourseIds?.length ?? 0) > 0
    || Object.keys(config.extras ?? {}).length > 0;
};

/**
 * Which kind this booking is.
 *
 * `sessionKind` is the recorded answer, written by the kiosk's session chooser
 * and by the map's. The two fallbacks are for bookings taken before any of this
 * existed: one with a table package or a course on it IS a banquet, whoever
 * typed it, and saying "menu not selected" about a wedding with forty dishes
 * chosen would be plainly wrong.
 */
export function menuKindOf(
  event: Pick<Event, 'menuConfig' | 'tableCategoryId'>,
): MenuKind {
  const config = event.menuConfig ?? null;
  if (config?.sessionKind) return config.sessionKind;
  if (config?.diningOrder) return 'dining';
  if (event.tableCategoryId || hasAnyCourse(config)) return 'banquet';
  return null;
}

/** The label for a kind, including the one for "nobody has chosen". */
export function menuKindLabelKey(kind: MenuKind): Parameters<typeof translate>[0] {
  if (kind === 'banquet') return 'menu_kind_banquet';
  if (kind === 'dining') return 'menu_kind_dining';
  // The status the product already has for this, rather than a second string
  // saying the same thing in the same words.
  return 'status_menu_not_selected';
}

/**
 * The food-service order recorded on a booking, if it has one.
 *
 * The snapshot on `menuConfig`, not the `Order` row: the Events page lists
 * every booking a restaurant has ever taken, and a request per card is not a
 * page. The two cannot drift, because a small-banquet order's dishes cannot be
 * amended from the floor — see utils/workArea.ts, where `editItems` is false
 * and the server enforces it rather than the screen.
 */
export function diningOrderOf(event: Pick<Event, 'menuConfig'>) {
  return event.menuConfig?.diningOrder ?? null;
}

/** Portions on that order — what a kitchen asks first. */
export function diningPortions(event: Pick<Event, 'menuConfig'>): number {
  const order = diningOrderOf(event);
  if (!order) return 0;
  // Read from the lines rather than trusting the stored figure beside them:
  // it is one JSON column, and a hand-edited row must not be able to claim a
  // portion count its own lines do not add up to.
  return order.lines.reduce((sum, line) => sum + line.quantity, 0);
}

/** One dish chosen for a banquet: a course choice, or a paid extra with a quantity. */
export type BanquetMenuLine = { menuItemId: string; name: string | null; quantity: number | null };

/**
 * The dishes a BANQUET booking has chosen, read from `menuConfig`.
 *
 * The kiosk records its menu there — the courses picked (hot appetizers,
 * first, main, third) and the paid extras with their quantities — and never
 * writes `EventMenuSelection` rows. The Events page's Menu column counted only
 * those rows, so every banquet whose menu was chosen in the kiosk, which is
 * every one booked from the Small Banquets map, showed "—" there.
 *
 * `name` comes from the dish list the page already holds; a dish deleted or
 * switched off since is still COUNTED (the booking did choose it) and comes
 * back with a null name, so the caller can say so rather than drop it.
 * Adult menu only: the children's table is its own package and its own figure.
 */
export function banquetMenuOf(
  event: Pick<Event, 'menuConfig'>,
  menuItems: ReadonlyArray<{ id: string; name: string; nameI18n?: DishI18n | null }> = [],
  locale: Locale = 'uz',
): BanquetMenuLine[] {
  const config = event.menuConfig;
  if (!config || config.diningOrder) return [];
  const byId = new Map(menuItems.map((m) => [m.id, m]));
  const named = (id: string) => {
    const item = byId.get(id);
    return item ? dishName(item, locale) || null : null;
  };
  const lines: BanquetMenuLine[] = [];
  const seen = new Set<string>();
  const course = (id: string | undefined | null) => {
    if (!id || seen.has(id)) return;
    seen.add(id);
    lines.push({ menuItemId: id, name: named(id), quantity: null });
  };
  (config.hotAppetizerIds ?? []).forEach(course);
  course(config.firstCourseId);
  (config.secondCourseIds ?? []).forEach(course);
  (config.thirdCourseIds ?? []).forEach(course);
  for (const [id, qty] of Object.entries(config.extras ?? {})) {
    const quantity = Number(qty);
    if (!id || !Number.isFinite(quantity) || quantity <= 0) continue;
    lines.push({ menuItemId: id, name: named(id), quantity });
  }
  return lines;
}
