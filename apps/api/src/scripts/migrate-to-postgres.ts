/**
 * One-time data migration: SQLite (old dev.db) -> PostgreSQL (new).
 *
 * Reads every row from the legacy SQLite database via a dedicated read-only
 * client (generated from prisma/schema.sqlite.prisma) and writes it into the
 * Postgres database the main app now uses. cuid IDs are preserved, so all
 * foreign-key relationships carry over unchanged.
 *
 * It is READ-ONLY against SQLite and idempotent against Postgres
 * (skipDuplicates), so it is safe to run more than once.
 *
 * Required env:
 *   SQLITE_URL   e.g. file:./prisma/dev.db          (the OLD database to read)
 *   DATABASE_URL e.g. postgresql://.../vmenu        (the NEW database to fill)
 *
 * Run AFTER `prisma migrate deploy` has created the Postgres tables:
 *   npm run migrate:to-postgres --workspace=apps/api
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

// Insert order respects foreign keys: a table only appears after every table it
// references. The single circular reference (AdminUser.restaurantId <->
// Restaurant.ownerId) is handled separately below.
const COPY_ORDER = [
  'company',
  'restaurant',
  'session',
  'menuSubcategory',
  'menuItem',
  'hall',
  'tableCategory',
  'tableCategoryMenuItem',
  'event',
  'eventMenuSelection',
  'invitation',
  'review',
  'expenseDay',
  'dayEvent',
  'dayExtraExpense',
  'productExpense',
  'salaryExpense',
  'additionalExpense',
  'guestInvitation',
  'guestInvitationRsvp',
  'designTemplate',
] as const;

async function copyTable(model: string): Promise<number> {
  const rows: any[] = await (sqlite as any)[model].findMany();
  if (rows.length === 0) return 0;
  const res = await (pg as any)[model].createMany({ data: rows, skipDuplicates: true });
  return res.count;
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
  console.log(`adminUser            : ${users.length}`);

  // 2. Everything else in FK-safe order.
  for (const model of COPY_ORDER) {
    const n = await copyTable(model);
    console.log(`${model.padEnd(21)}: ${n}`);
  }

  // 3. Now restaurants exist — restore each user's restaurantId.
  const usersWithRestaurant = users.filter((u) => u.restaurantId);
  for (const u of usersWithRestaurant) {
    await pg.adminUser.update({
      where: { id: u.id },
      data: { restaurantId: u.restaurantId },
    });
  }
  console.log(`adminUser.restaurantId patched: ${usersWithRestaurant.length}`);

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
