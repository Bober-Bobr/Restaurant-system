/**
 * One-time data migration: SQLite (old dev.db) -> PostgreSQL (new).
 *
 * Reads every row from the legacy SQLite database via a dedicated read-only
 * client (generated from prisma/schema.sqlite.prisma) and writes it into the
 * Postgres database the main app now uses. cuid IDs are preserved, so all
 * foreign-key relationships carry over unchanged.
 *
 * SQLite never enforced foreign keys, so the old DB can contain dangling
 * references (e.g. a Hall pointing at a deleted Restaurant). Postgres DOES
 * enforce them, so as we copy we sanitize each row against the parents that
 * actually made it in: nullable FKs are set to null (matching the schema's
 * onDelete: SetNull), and rows with a missing REQUIRED parent are dropped
 * (matching onDelete: Cascade).
 *
 * It is READ-ONLY against SQLite and idempotent against Postgres
 * (skipDuplicates), so it is safe to run more than once.
 *
 * Required env:
 *   SQLITE_URL   e.g. file:/abs/path/dev.db          (the OLD database to read)
 *   DATABASE_URL e.g. postgresql://.../vmenu         (the NEW database to fill)
 *
 * Run AFTER `prisma migrate deploy` has created the Postgres tables:
 *   SQLITE_URL="file:/abs/path/dev.db" npx tsx src/scripts/migrate-to-postgres.ts
 */
import 'dotenv/config';
import { PrismaClient as PgClient } from '@prisma/client';
import { PrismaClient as SqliteClient } from '../generated/sqlite-client/index.js';

if (!process.env.SQLITE_URL) {
  // Default to the conventional dev.db location if not explicitly set.
  process.env.SQLITE_URL = 'file:./prisma/dev.db';
}

const sqlite = new SqliteClient();
const pg = new PgClient();

type FK = { field: string; parent: string; required: boolean };

// Foreign keys per model (Prisma client property name). `required` mirrors the
// schema: required FKs are onDelete Cascade (drop the orphan row), optional FKs
// are onDelete SetNull (null the dangling reference).
const FOREIGN_KEYS: Record<string, FK[]> = {
  company: [{ field: 'ownerId', parent: 'adminUser', required: true }],
  restaurant: [
    { field: 'ownerId', parent: 'adminUser', required: true },
    { field: 'companyId', parent: 'company', required: false },
  ],
  session: [{ field: 'userId', parent: 'adminUser', required: true }],
  menuSubcategory: [{ field: 'restaurantId', parent: 'restaurant', required: false }],
  menuItem: [
    { field: 'restaurantId', parent: 'restaurant', required: false },
    { field: 'subcategoryId', parent: 'menuSubcategory', required: false },
  ],
  hall: [{ field: 'restaurantId', parent: 'restaurant', required: false }],
  tableCategory: [{ field: 'restaurantId', parent: 'restaurant', required: false }],
  tableCategoryMenuItem: [
    { field: 'tableCategoryId', parent: 'tableCategory', required: true },
    { field: 'menuItemId', parent: 'menuItem', required: true },
  ],
  event: [
    { field: 'hallId', parent: 'hall', required: false },
    { field: 'tableCategoryId', parent: 'tableCategory', required: false },
    { field: 'restaurantId', parent: 'restaurant', required: false },
    // childrenTableCategoryId is a plain reference (no FK constraint) — leave as is.
  ],
  eventMenuSelection: [
    { field: 'eventId', parent: 'event', required: true },
    { field: 'menuItemId', parent: 'menuItem', required: true },
  ],
  invitation: [
    { field: 'eventId', parent: 'event', required: false },
    { field: 'restaurantId', parent: 'restaurant', required: true },
  ],
  review: [{ field: 'restaurantId', parent: 'restaurant', required: true }],
  expenseDay: [{ field: 'managerId', parent: 'adminUser', required: true }],
  dayEvent: [{ field: 'dayId', parent: 'expenseDay', required: true }],
  dayExtraExpense: [{ field: 'dayId', parent: 'expenseDay', required: true }],
  productExpense: [{ field: 'eventId', parent: 'dayEvent', required: true }],
  salaryExpense: [{ field: 'eventId', parent: 'dayEvent', required: true }],
  additionalExpense: [{ field: 'eventId', parent: 'dayEvent', required: true }],
  guestInvitation: [{ field: 'createdById', parent: 'adminUser', required: false }],
  guestInvitationRsvp: [{ field: 'invitationId', parent: 'guestInvitation', required: true }],
  designTemplate: [{ field: 'ownerId', parent: 'adminUser', required: false }],
};

// Insert order respects foreign keys: a table only appears after every table it
// references. The single circular reference (AdminUser.restaurantId <->
// Restaurant.ownerId) is handled separately below.
const COPY_ORDER = [
  'company', 'restaurant', 'session', 'menuSubcategory', 'menuItem', 'hall',
  'tableCategory', 'tableCategoryMenuItem', 'event', 'eventMenuSelection',
  'invitation', 'review', 'expenseDay', 'dayEvent', 'dayExtraExpense',
  'productExpense', 'salaryExpense', 'additionalExpense', 'guestInvitation',
  'guestInvitationRsvp', 'designTemplate',
] as const;

// Ids that actually exist in Postgres after each table is copied, so children
// can validate their references against them.
const insertedIds: Record<string, Set<string>> = {};

async function copyTable(model: string): Promise<void> {
  const rows: any[] = await (sqlite as any)[model].findMany();
  const fks = FOREIGN_KEYS[model] ?? [];

  let nulled = 0;
  let dropped = 0;
  const kept = rows.filter((row) => {
    for (const fk of fks) {
      const val = row[fk.field];
      if (val == null) continue;
      if (insertedIds[fk.parent]?.has(val)) continue;
      // Dangling reference.
      if (fk.required) { dropped++; return false; }
      row[fk.field] = null;
      nulled++;
    }
    return true;
  });

  if (kept.length > 0) {
    await (pg as any)[model].createMany({ data: kept, skipDuplicates: true });
  }
  insertedIds[model] = new Set(kept.map((r) => r.id));

  const notes = [nulled ? `${nulled} fk nulled` : '', dropped ? `${dropped} dropped` : '']
    .filter(Boolean).join(', ');
  console.log(`${model.padEnd(21)}: ${kept.length}${notes ? `  (${notes})` : ''}`);
}

async function main() {
  console.log(`Reading from : ${process.env.SQLITE_URL}`);
  console.log(`Writing to   : ${(process.env.DATABASE_URL ?? '').replace(/:[^:@/]*@/, ':****@')}`);
  console.log('');

  // 1. AdminUser first, but with restaurantId stripped — the restaurants it
  //    points to don't exist yet (circular FK). We patch it back in step 3.
  const users: any[] = await sqlite.adminUser.findMany();
  if (users.length > 0) {
    await pg.adminUser.createMany({
      data: users.map(({ restaurantId, ...rest }) => rest),
      skipDuplicates: true,
    });
  }
  insertedIds.adminUser = new Set(users.map((u) => u.id));
  console.log(`adminUser            : ${users.length}`);

  // 2. Everything else in FK-safe order, sanitizing dangling references.
  for (const model of COPY_ORDER) {
    await copyTable(model);
  }

  // 3. Now restaurants exist — restore each user's restaurantId (only when the
  //    referenced restaurant actually survived the copy).
  const usersToPatch = users.filter((u) => u.restaurantId && insertedIds.restaurant?.has(u.restaurantId));
  for (const u of usersToPatch) {
    await pg.adminUser.update({ where: { id: u.id }, data: { restaurantId: u.restaurantId } });
  }
  console.log(`adminUser.restaurantId patched: ${usersToPatch.length}`);

  console.log('\nDone.');
}

main()
  .catch((e) => {
    console.error('\nMigration FAILED:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sqlite.$disconnect();
    await pg.$disconnect();
  });
