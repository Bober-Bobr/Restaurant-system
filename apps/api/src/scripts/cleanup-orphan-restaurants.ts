import { PrismaClient } from '@prisma/client';

// One-off cleanup for restaurants that were orphaned (companyId = null) by the
// old company-delete behaviour, which used `onDelete: SetNull` and left the
// restaurants behind. New company deletes remove their restaurants in a
// transaction, so this only needs to be run once per environment.
//
//   npm run cleanup:orphan-restaurants --workspace=apps/api
//
const prisma = new PrismaClient();

async function main() {
  const orphans = await prisma.restaurant.findMany({
    where: { companyId: null },
    select: { id: true, name: true },
  });

  if (orphans.length === 0) {
    console.log('No orphaned restaurants found. Nothing to do.');
    return;
  }

  console.log(`Deleting ${orphans.length} orphaned restaurant(s):`);
  for (const r of orphans) console.log(`  - ${r.id} ${JSON.stringify(r.name)}`);

  const { count } = await prisma.restaurant.deleteMany({ where: { companyId: null } });
  console.log(`Done. Removed ${count} restaurant(s).`);
}

main()
  .catch((err) => {
    console.error('Cleanup failed:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
