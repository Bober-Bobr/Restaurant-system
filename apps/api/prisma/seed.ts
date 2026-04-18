/// <reference types="node" />
import { AdminRole, PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  let owner = await prisma.adminUser.findFirst({
    where: { role: AdminRole.OWNER },
    orderBy: { createdAt: 'asc' }
  });

  if (!owner) {
    const username = process.env.OWNER_USERNAME;
    const password = process.env.OWNER_PASSWORD;
    if (!username || !password) {
      console.log('No OWNER found. Provide OWNER_USERNAME and OWNER_PASSWORD env vars to create one:');
      console.log('  OWNER_USERNAME=Bober OWNER_PASSWORD=YourPass@1 npx tsx prisma/seed.ts');
      return;
    }
    const existing = await prisma.adminUser.findUnique({ where: { username } });
    if (existing) {
      console.log(`User "${username}" already exists, using it as owner.`);
      owner = existing;
    } else {
      const passwordHash = await bcrypt.hash(password, 12);
      owner = await prisma.adminUser.create({
        data: { username, passwordHash, role: AdminRole.OWNER }
      });
      console.log(`Created owner account "${username}".`);
    }
  }

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
