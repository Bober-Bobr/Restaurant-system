import { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import type { Section } from '../../utils/section.js';
import { DISABLED_COLUMN, getExcludedCategories, presentForScope, type MenuScope } from '../../utils/excludedCategories.js';

export type CreateTableCategoryData = {
  name: string;
  includedCategories: string;
  ratePerPerson: number;
  discountPercent?: number;
  tableType?: string;
  eventType?: string;
  hotAppetizerCount?: number;
  description?: string;
  photoUrl?: string;
  photos?: string[];
  freeSubstitutionItemIds?: string[];
  isActive?: boolean;
};

const packageItemsInclude = {
  packageItems: {
    include: {
      menuItem: {
        // All three prices are read so the package can be priced by ITS section
        // (presentPackage below); none of them leaves the API unresolved.
        select: {
          id: true, name: true, description: true, nameI18n: true, descriptionI18n: true, category: true, photoUrl: true, isBestseller: true,
          priceCents: true, priceCentsSmallBanquet: true, priceCentsCatering: true,
          disabledBanquet: true, disabledSmallBanquet: true, disabledCatering: true,
        }
      }
    }
  }
} as const;

const scopeOfSection = (section: Section): MenuScope => (section === 'SMALL_BANQUET' ? 'smallBanquet' : 'banquet');

type WithPackage = { section: string; packageItems: { menuItem: Parameters<typeof presentForScope>[0] & { category: string } }[] };

/**
 * A package as its own section sees it: each dish at that section's price, and
 * the other systems' prices and switches not in the payload at all. With
 * `onSale`, dishes the section switched off — by category or singly — are
 * dropped as well: that is the tablet's read, where a switched-off dish must
 * not be offered. The admin editor keeps them, so saving a package does not
 * silently strip dishes that are only switched off for now.
 */
function presentPackage<T extends WithPackage>(category: T, onSale?: { excluded: string[] }) {
  const scope = scopeOfSection(category.section as Section);
  const items = category.packageItems
    .filter((pi) => !onSale || (!onSale.excluded.includes(pi.menuItem.category) && !pi.menuItem[DISABLED_COLUMN[scope]]))
    .map((pi) => ({ ...pi, menuItem: presentForScope(pi.menuItem, scope) }));
  return { ...category, packageItems: items };
}

const presentAll = <T extends WithPackage>(rows: T[]) => rows.map((row) => presentPackage(row));
const presentOne = <T extends WithPackage>(row: T | null) => (row ? presentPackage(row) : row);

/**
 * Table packages belong to a restaurant AND to a section. They are the whole
 * commercial difference between Banquet and Small Banquets — a package IS the
 * price — so `section` is required on every read and write here rather than an
 * optional filter a caller could omit.
 */
export class TableCategoryRepository {
  async list(restaurantId: string, section: Section, params?: { skip: number; take: number }) {
    return presentAll(await prisma.tableCategory.findMany({
      ...(params ?? {}),
      where: { restaurantId, section },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: packageItemsInclude
    }));
  }

  async listActive(restaurantId: string, section: Section) {
    // The tablet's read: switched-off dishes are left out of every package.
    const excluded = await getExcludedCategories(restaurantId, scopeOfSection(section));
    const rows = await prisma.tableCategory.findMany({
      where: { restaurantId, section, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: packageItemsInclude
    });
    return rows.map((row) => presentPackage(row, { excluded }));
  }

  async listAll(restaurantId: string, section: Section) {
    return presentAll(await prisma.tableCategory.findMany({
      where: { restaurantId, section },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: packageItemsInclude
    }));
  }

  // `updateMany` with the scope in the WHERE is what makes this safe: an id
  // from the other section matches nothing and is silently skipped, rather than
  // being reordered by a caller who cannot even see it.
  async saveArrangement(restaurantId: string, section: Section, order: { id: string; sortOrder: number }[]) {
    await prisma.$transaction(
      order.map((item) =>
        prisma.tableCategory.updateMany({
          where: { id: item.id, restaurantId, section },
          data: { sortOrder: item.sortOrder },
        })
      )
    );
  }

  async count(restaurantId: string, section: Section) {
    return prisma.tableCategory.count({ where: { restaurantId, section } });
  }

  async create(restaurantId: string, section: Section, payload: CreateTableCategoryData) {
    const { photos, ...rest } = payload;
    return presentPackage(await prisma.tableCategory.create({
      data: { ...rest, photos: photos ?? [], restaurantId, section },
      include: packageItemsInclude
    }));
  }

  async updateById(id: string, payload: Prisma.TableCategoryUpdateInput) {
    return presentPackage(await prisma.tableCategory.update({ where: { id }, data: payload, include: packageItemsInclude }));
  }

  async setPackageItems(tableCategoryId: string, items: { menuItemId: string; servings: number }[]) {
    await prisma.tableCategoryMenuItem.deleteMany({ where: { tableCategoryId } });
    if (items.length > 0) {
      await prisma.tableCategoryMenuItem.createMany({
        data: items.map(({ menuItemId, servings }) => ({ tableCategoryId, menuItemId, servings }))
      });
    }
    return presentOne(await prisma.tableCategory.findUnique({ where: { id: tableCategoryId }, include: packageItemsInclude }));
  }

  async getById(id: string) {
    return presentOne(await prisma.tableCategory.findUnique({ where: { id }, include: packageItemsInclude }));
  }

  async getByName(restaurantId: string, section: Section, name: string) {
    return prisma.tableCategory.findFirst({ where: { restaurantId, section, name } });
  }

  async deleteById(id: string) {
    return prisma.tableCategory.delete({ where: { id } });
  }
}
