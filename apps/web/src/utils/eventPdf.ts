import type { Event, MenuItem, TableCategory, TableCategoryPackageItem, Hall } from '../types/domain';
import type { Locale, translate } from './translate';
import { effectiveRatePerPerson } from './tablePricing';

type TranslateFn = (key: Parameters<typeof translate>[0]) => string;

const COURSE_CATEGORIES = ['HOT_APPETIZERS', 'FIRST_COURSE', 'SECOND_COURSE', 'THIRD_COURSE'];

type DishRow = { name: string; category: string; categoryLabel: string; servings: number };

// Rebuild the list of dishes that make up a table from a stored menu config:
// the fixed included dishes (honoring free swaps) plus the courses the guest
// actually selected. Mirrors TabletSummaryPage.buildTableDishes so the Events
// page PDF matches what the tablet produces.
function buildTableDishes(
  packageItems: TableCategoryPackageItem[],
  swaps: Record<string, string>,
  firstId: string | undefined,
  secondIds: string[],
  thirdIds: string[],
  hotAppetizerIds: string[],
  menuItems: MenuItem[],
  t: TranslateFn,
  removed: string[] = [],
): DishRow[] {
  const label = (category: string) => t(category.toLowerCase() as Parameters<typeof translate>[0]);
  const included = packageItems
    .filter((pi) => !COURSE_CATEGORIES.includes(pi.menuItem.category) && !removed.includes(pi.id))
    .map((pi) => {
      const swapId = swaps[pi.id];
      const dish = swapId ? (menuItems.find((m) => m.id === swapId) ?? pi.menuItem) : pi.menuItem;
      return { name: dish.name, category: dish.category, categoryLabel: label(dish.category), servings: pi.servings };
    });
  const course = (category: string, isSelected: (id: string) => boolean) =>
    packageItems
      .filter((pi) => pi.menuItem.category === category && isSelected(pi.menuItem.id))
      .map((pi) => ({ name: pi.menuItem.name, category: pi.menuItem.category, categoryLabel: label(pi.menuItem.category), servings: pi.servings }));
  return [
    ...course('HOT_APPETIZERS', (id) => hotAppetizerIds.includes(id)),
    ...included,
    ...course('FIRST_COURSE', (id) => id === firstId),
    ...course('SECOND_COURSE', (id) => secondIds.includes(id)),
    ...course('THIRD_COURSE', (id) => thirdIds.includes(id)),
  ];
}

/**
 * The category a food-service line falls under when its dish cannot be found.
 *
 * It is written as a CATEGORY so the server groups it like any other: the
 * exporter translates `category.toLowerCase()`, and `other_dishes` is a key it
 * already has (it captions the second table), so the block reads "Other dishes"
 * in all three languages instead of `OTHER_DISHES`.
 */
const UNKNOWN_DISH_CATEGORY = 'OTHER_DISHES';

/**
 * The dishes of a FOOD-SERVICE booking, as rows for the printed sheet.
 *
 * A party eating à la carte has no table package and no kiosk extras — which is
 * every source the banquet payload below is built from — so its sheet came out
 * with the dish table empty. That is the whole of "the dishes by category and
 * their quantities are not displayed" after an order taken on the floor map:
 * those dishes live on `menuConfig.diningOrder`, and nothing read them.
 *
 * The NAME is the order's own snapshot, because that is a record of what was
 * agreed and a dish renamed since must not rewrite it. The CATEGORY is looked
 * up live from the dish table, because the snapshot has never carried one — and
 * a line whose dish has since been deleted, or switched off for this system and
 * therefore absent from the list, still prints, under the fallback heading. The
 * kitchen needs the dish far more than it needs the right heading over it.
 */
export function diningDishRows(
  event: Pick<Event, 'menuConfig'>,
  menuItems: MenuItem[],
): { name: string; category: string; qty: number }[] {
  const order = event.menuConfig?.diningOrder;
  if (!order) return [];
  const byId = new Map(menuItems.map((item) => [item.id, item]));
  return order.lines
    .filter((line) => line.quantity > 0)
    .map((line) => ({
      name: line.name,
      category: (line.menuItemId ? byId.get(line.menuItemId)?.category : undefined) ?? UNKNOWN_DISH_CATEGORY,
      qty: line.quantity,
    }));
}

/**
 * What a food-service order came to, from its own lines.
 *
 * Read from the lines rather than the `totalCents` stored beside them, for the
 * reason `diningPortions` is: it is one free-form JSON column, and a figure that
 * its own lines do not add up to must not be the one on the invoice.
 */
export function diningTotalCents(event: Pick<Event, 'menuConfig'>): number {
  const order = event.menuConfig?.diningOrder;
  if (!order) return 0;
  return order.lines.reduce((sum, line) => sum + line.unitPriceCents * line.quantity, 0);
}

// Build the payload POSTed to /public/export/pdf (and /excel) to regenerate the
// banquet summary for an existing event from its stored menuConfig.
export function buildEventExportPayload(
  event: Event,
  opts: {
    menuItems: MenuItem[];
    tableCategories: TableCategory[];
    halls: Hall[];
    restaurantName: string | null;
    restaurantLogoUrl: string | null;
    locale: Locale;
    t: TranslateFn;
  },
) {
  const { menuItems, tableCategories, halls, restaurantName, restaurantLogoUrl, locale, t } = opts;
  const cfg = event.menuConfig ?? null;
  const guestCount = event.guestCount;

  const tableCategory = tableCategories.find((tc) => tc.id === event.tableCategoryId);
  const hall = halls.find((h) => h.id === event.hallId);

  // Each selected Extra is served to every guest → quantity = guestCount.
  const extras = cfg?.extras ?? {};
  const selectedItems: Record<string, number> = {};
  for (const [id, qty] of Object.entries(extras)) {
    if (qty > 0) selectedItems[id] = guestCount;
  }

  const includedDishes = tableCategory
    ? buildTableDishes(
        tableCategory.packageItems ?? [], cfg?.replacements ?? {},
        cfg?.firstCourseId, cfg?.secondCourseIds ?? [], cfg?.thirdCourseIds ?? [],
        cfg?.hotAppetizerIds ?? [],
        menuItems, t,
        cfg?.removedPackageItemIds ?? [],
      )
    : [];

  // A food-service booking's dishes and money, which come from the order
  // snapshot rather than from a table package it does not have.
  const orderedDishes = diningDishRows(event, menuItems);
  const diningCents = diningTotalCents(event);

  // Pricing rebuilt from stored data (no ad-hoc discount is persisted).
  const menuSubtotalCents = menuItems.reduce(
    (sum, item) => sum + item.priceCents * (selectedItems[item.id] ?? 0), 0,
  );
  // Dishes the guest took off the table came off the rate when they booked, so
  // the rebuilt document has to price it the same way — see utils/tablePricing.
  const ratePerPerson = effectiveRatePerPerson(tableCategory, cfg?.removedPackageItemIds ?? []);
  const tableRateCents = tableCategory ? ratePerPerson * guestCount : 0;
  // The order's own money is ADDED rather than substituted: a booking can hold
  // both (a banquet whose host also ordered dishes for the pass), and a
  // document that priced one of the two would be wrong about the evening.
  const subtotalCents = menuSubtotalCents + tableRateCents + diningCents;
  const perGuestCents = guestCount > 0 ? Math.round(subtotalCents / guestCount) : subtotalCents;

  // Optional children's table add-on.
  const childrenTableCategory = event.childrenTableCategoryId
    ? tableCategories.find((tc) => tc.id === event.childrenTableCategoryId)
    : undefined;
  const childrenCount = event.childrenCount ?? 0;
  const childrenActive = !!childrenTableCategory && (childrenCount > 0 || !!cfg?.childFirstCourseId);
  const childrenSubtotalCents = childrenActive ? childrenTableCategory!.ratePerPerson * childrenCount : 0;
  const totalCents = subtotalCents + childrenSubtotalCents;

  // Prepaid deposit, subtracted from the total.
  const depositCents = event.depositCents ?? 0;
  const amountDueCents = Math.max(0, totalCents - depositCents);

  const childrenExport = childrenActive
    ? {
        childrenTableName: childrenTableCategory!.name,
        childrenCount,
        childrenRateCents: childrenTableCategory!.ratePerPerson,
        childrenSubtotalCents,
        childrenDishes: buildTableDishes(
          childrenTableCategory!.packageItems ?? [], cfg?.childReplacements ?? {},
          cfg?.childFirstCourseId, cfg?.childSecondCourseIds ?? [], cfg?.childThirdCourseIds ?? [],
          cfg?.childHotAppetizerIds ?? [],
          menuItems, t,
        ),
      }
    : {};

  return {
    customerName: event.customerName,
    customerPhone: event.customerPhone ?? '',
    secondCustomerName: event.secondCustomerName || undefined,
    secondCustomerPhone: event.secondCustomerPhone || undefined,
    eventDate: event.eventDate,
    hallName: hall?.name ?? '',
    tableCategoryName: tableCategory?.name ?? '',
    guestCount,
    selectedItems,
    menuItems,
    includedDishes,
    orderedDishes,
    pricing: {
      perGuestCents,
      originalPerGuestCents: perGuestCents,
      totalCents,
      originalTotalCents: totalCents,
      discountPercent: 0,
      hasDiscount: false,
      depositCents,
      amountDueCents,
    },
    ...childrenExport,
    locale,
    restaurantName: restaurantName ?? '',
    restaurantLogoUrl: restaurantLogoUrl ?? null,
  };
}
