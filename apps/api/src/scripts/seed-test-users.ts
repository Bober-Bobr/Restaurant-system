import { AdminRole, PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const PASSWORD_HASH = await bcrypt.hash('Bober2000', 12);

async function upsertUser(username: string, role: AdminRole, restaurantId?: string | null) {
  const existing = await prisma.adminUser.findUnique({ where: { username } });
  if (existing) {
    return prisma.adminUser.update({
      where: { username },
      data: { passwordHash: PASSWORD_HASH, role, restaurantId: restaurantId ?? null },
    });
  }
  return prisma.adminUser.create({
    data: { username, passwordHash: PASSWORD_HASH, role, ...(restaurantId ? { restaurantId } : {}) },
  });
}

async function main() {
  // ── Bober: Chief Administrator ──────────────────────────────────────────
  await upsertUser('Bober', AdminRole.CHIEF_ADMIN);
  console.log('✓ Bober (CHIEF_ADMIN)');

  // ── Fetch all existing restaurants with data counts ──────────────────────
  const allRestaurants = await prisma.restaurant.findMany({
    include: {
      _count: { select: { events: true, halls: true, menuItems: true, tableCategories: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  const score = (r: typeof allRestaurants[0]) =>
    r._count.events + r._count.halls + r._count.menuItems + r._count.tableCategories;

  console.log('\nFound restaurants:');
  allRestaurants.forEach((r) =>
    console.log(`  ${r.id}  "${r.name}"  score=${score(r)}`)
  );

  // ── owner_test → Madinabek company ───────────────────────────────────────
  const ownerTest = await upsertUser('owner_test', AdminRole.OWNER);

  let madinabek = await prisma.company.findFirst({ where: { ownerId: ownerTest.id, name: 'Madinabek' } });
  if (!madinabek) {
    madinabek = await prisma.company.create({ data: { name: 'Madinabek', ownerId: ownerTest.id } });
  }

  // Pick the "Madinabek" restaurant with most data; fall back to the single richest restaurant
  const madinCandidates = allRestaurants.filter((r) =>
    r.name.toLowerCase().includes('madinabek')
  );
  const primarySource = madinCandidates.length > 0
    ? madinCandidates.sort((a, b) => score(b) - score(a))[0]
    : allRestaurants.sort((a, b) => score(b) - score(a))[0];

  if (!primarySource) throw new Error('No restaurants found in database. Nothing to assign.');

  // Reassign this restaurant to owner_test + company (keeps its ID and all data/photos)
  const madinabekRestaurant = await prisma.restaurant.update({
    where: { id: primarySource.id },
    data: { ownerId: ownerTest.id, companyId: madinabek.id },
  });
  console.log(`\n✓ owner_test (OWNER) → Company: Madinabek → Restaurant: "${madinabekRestaurant.name}" (${madinabekRestaurant.id})`);

  // Delete any empty duplicate Madinabek restaurants left by a previous seed run
  const emptyDuplicates = madinCandidates.filter(
    (r) => r.id !== primarySource.id && score(r) === 0
  );
  for (const dup of emptyDuplicates) {
    await prisma.restaurant.delete({ where: { id: dup.id } });
    console.log(`  Deleted empty duplicate: "${dup.name}" (${dup.id})`);
  }

  // admin_test → Madinabek restaurant
  await upsertUser('admin_test', AdminRole.ADMIN, madinabekRestaurant.id);
  console.log(`✓ admin_test (ADMIN) → "${madinabekRestaurant.name}"`);

  // ── owner_test2 → Rest company ────────────────────────────────────────────
  const ownerTest2 = await upsertUser('owner_test2', AdminRole.OWNER);

  let restCompany = await prisma.company.findFirst({ where: { ownerId: ownerTest2.id, name: 'Rest' } });
  if (!restCompany) {
    restCompany = await prisma.company.create({ data: { name: 'Rest', ownerId: ownerTest2.id } });
  }

  // Find a Rest restaurant (any restaurant that is not the Madinabek one)
  const restCandidates = allRestaurants.filter(
    (r) => r.id !== madinabekRestaurant.id && r.name.toLowerCase().includes('rest')
  );
  const restFallback = allRestaurants.filter(
    (r) => r.id !== madinabekRestaurant.id
  );
  const restSource = (restCandidates[0] ?? restFallback[0]) ?? null;

  let restRestaurant;
  if (restSource) {
    restRestaurant = await prisma.restaurant.update({
      where: { id: restSource.id },
      data: { ownerId: ownerTest2.id, companyId: restCompany.id },
    });
    console.log(`\n✓ owner_test2 (OWNER) → Company: Rest → Restaurant: "${restRestaurant.name}" (${restRestaurant.id})`);
  } else {
    restRestaurant = await prisma.restaurant.create({
      data: { name: 'Rest', ownerId: ownerTest2.id, companyId: restCompany.id },
    });
    console.log(`\n✓ owner_test2 (OWNER) → Company: Rest → Restaurant: "Rest" created (${restRestaurant.id})`);
  }

  // Set Rest logo
  await prisma.restaurant.update({
    where: { id: restRestaurant.id },
    data: { logoUrl: '/uploads/image.png' },
  });
  console.log(`✓ Rest logo set to /uploads/image.png`);

  // admin_test2 → Rest restaurant
  await upsertUser('admin_test2', AdminRole.ADMIN, restRestaurant.id);
  console.log(`✓ admin_test2 (ADMIN) → "${restRestaurant.name}"`);

  console.log('\n✓ All done. Password for everyone: Bober2000');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
