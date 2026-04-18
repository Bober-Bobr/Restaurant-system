import { AdminRole, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Find the first OWNER
  const owner = await prisma.adminUser.findFirst({
    where: { role: AdminRole.OWNER },
    orderBy: { createdAt: 'asc' }
  });

  if (!owner) {
    console.log('No OWNER user found — register first, then re-run the seed.');
    return;
  }

  // Create Madinabek restaurant if it doesn't already exist for this owner
  const existing = await prisma.restaurant.findFirst({
    where: { ownerId: owner.id, name: 'Madinabek' }
  });

  if (existing) {
    console.log(`Restaurant "Madinabek" already exists (id: ${existing.id}), skipping.`);
    return;
  }

  const restaurant = await prisma.restaurant.create({
    data: {
      name: 'Madinabek',
      address: '',
      logoUrl: '/uploads/madinabek-logo.png',
      ownerId: owner.id
    }
  });

  console.log(`Created restaurant "Madinabek" (id: ${restaurant.id}) for owner "${owner.username}".`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
