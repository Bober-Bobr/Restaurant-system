import type { Event, MenuItem, TableCategory, TableCategoryPackageItem, Hall } from '../types/domain';
import type { Locale, translate } from './translate';

type TranslateFn = (key: Parameters<typeof translate>[0]) => string;

const COURSE_CATEGORIES = ['FIRST_COURSE', 'SECOND_COURSE', 'THIRD_COURSE'];

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
  menuItems: MenuItem[],
  t: TranslateFn,
): DishRow[] {
  const label = (category: string) => t(category.toLowerCase() as Parameters<typeof translate>[0]);
  const included = packageItems
    .filter((pi) => !COURSE_CATEGORIES.includes(pi.menuItem.category))
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
    ...included,
    ...course('FIRST_COURSE', (id) => id === firstId),
    ...course('SECOND_COURSE', (id) => secondIds.includes(id)),
    ...course('THIRD_COURSE', (id) => thirdIds.includes(id)),
  ];
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
        menuItems, t,
      )
    : [];

  // Pricing rebuilt from stored data (no ad-hoc discount is persisted).
  const menuSubtotalCents = menuItems.reduce(
    (sum, item) => sum + item.priceCents * (selectedItems[item.id] ?? 0), 0,
  );
  const tableRateCents = tableCategory ? tableCategory.ratePerPerson * guestCount : 0;
  const subtotalCents = menuSubtotalCents + tableRateCents;
  const perGuestCents = guestCount > 0 ? Math.round(subtotalCents / guestCount) : subtotalCents;

  // Optional children's table add-on.
  const childrenTableCategory = event.childrenTableCategoryId
    ? tableCategories.find((tc) => tc.id === event.childrenTableCategoryId)
    : undefined;
  const childrenCount = event.childrenCount ?? 0;
  const childrenActive = !!childrenTableCategory && (childrenCount > 0 || !!cfg?.childFirstCourseId);
  const childrenSubtotalCents = childrenActive ? childrenTableCategory!.ratePerPerson * childrenCount : 0;
  const totalCents = subtotalCents + childrenSubtotalCents;

  const childrenExport = childrenActive
    ? {
        childrenTableName: childrenTableCategory!.name,
        childrenCount,
        childrenRateCents: childrenTableCategory!.ratePerPerson,
        childrenSubtotalCents,
        childrenDishes: buildTableDishes(
          childrenTableCategory!.packageItems ?? [], cfg?.childReplacements ?? {},
          cfg?.childFirstCourseId, cfg?.childSecondCourseIds ?? [], cfg?.childThirdCourseIds ?? [],
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
    pricing: {
      perGuestCents,
      originalPerGuestCents: perGuestCents,
      totalCents,
      originalTotalCents: totalCents,
      discountPercent: 0,
      hasDiscount: false,
    },
    ...childrenExport,
    locale,
    restaurantName: restaurantName ?? '',
    restaurantLogoUrl: restaurantLogoUrl ?? null,
  };
}
