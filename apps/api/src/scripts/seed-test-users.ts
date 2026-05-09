import { AdminRole, PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const PASSWORD_HASH = await bcrypt.hash('Bober2000', 12);

async function upsertUser(username: string, role: AdminRole, restaurantId?: string) {
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

  // ── owner_test: Madinabek company ───────────────────────────────────────
  const ownerTest = await upsertUser('owner_test', AdminRole.OWNER);

  let madinabek = await prisma.company.findUnique({ where: { ownerId: ownerTest.id } });
  if (!madinabek) {
    madinabek = await prisma.company.create({ data: { name: 'Madinabek', ownerId: ownerTest.id } });
  }

  let madinabekRestaurant = await prisma.restaurant.findFirst({ where: { ownerId: ownerTest.id } });
  if (!madinabekRestaurant) {
    madinabekRestaurant = await prisma.restaurant.create({
      data: { name: 'Madinabek', ownerId: ownerTest.id, companyId: madinabek.id },
    });
  } else {
    await prisma.restaurant.update({
      where: { id: madinabekRestaurant.id },
      data: { companyId: madinabek.id },
    });
  }
  console.log('✓ owner_test (OWNER) → Company: Madinabek → Restaurant:', madinabekRestaurant.name);

  // ── admin_test: admin of Madinabek restaurant ───────────────────────────
  await upsertUser('admin_test', AdminRole.ADMIN, madinabekRestaurant.id);
  console.log('✓ admin_test (ADMIN) → Restaurant:', madinabekRestaurant.name);

  // ── owner_test2: Rest company ────────────────────────────────────────────
  const ownerTest2 = await upsertUser('owner_test2', AdminRole.OWNER);

  let restCompany = await prisma.company.findUnique({ where: { ownerId: ownerTest2.id } });
  if (!restCompany) {
    restCompany = await prisma.company.create({ data: { name: 'Rest', ownerId: ownerTest2.id } });
  }

  let restRestaurant = await prisma.restaurant.findFirst({ where: { ownerId: ownerTest2.id } });
  if (!restRestaurant) {
    restRestaurant = await prisma.restaurant.create({
      data: { name: 'Rest', ownerId: ownerTest2.id, companyId: restCompany.id },
    });
  } else {
    await prisma.restaurant.update({
      where: { id: restRestaurant.id },
      data: { companyId: restCompany.id },
    });
  }
  console.log('✓ owner_test2 (OWNER) → Company: Rest → Restaurant:', restRestaurant.name);

  // ── admin_test2: admin of Rest restaurant ───────────────────────────────
  await upsertUser('admin_test2', AdminRole.ADMIN, restRestaurant.id);
  console.log('✓ admin_test2 (ADMIN) → Restaurant:', restRestaurant.name);

  console.log('\nAll done. Password for everyone: Bober2000');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
