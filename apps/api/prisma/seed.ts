/// <reference types="node" />
import { AdminRole, PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Independent of the owner/restaurant seeding below, which returns early when
  // no OWNER exists — the NFC account must be created either way.
  await seedNfcMaker();

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

// ── v-connect.uz: the NFC-plaque builder account ─────────────────────────────
// Idempotent: the password is only set when the account is first created, so
// re-running the seed never resets a password that was changed in production.
// Override the default with NFC_MAKER_PASSWORD when seeding a real environment.
async function seedNfcMaker() {
  const username = 'nfc_maker';
  const existing = await prisma.adminUser.findUnique({ where: { username } });
  if (existing) {
    if (existing.role !== AdminRole.NFC_MAKER) {
      await prisma.adminUser.update({ where: { id: existing.id }, data: { role: AdminRole.NFC_MAKER } });
      console.log(`Updated "${username}" to role NFC_MAKER.`);
    } else {
      console.log(`NFC maker "${username}" already exists, skipping.`);
    }
    return;
  }
  const password = process.env.NFC_MAKER_PASSWORD || 'XfjuaJiM$^+pYZMPQvK7';
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.adminUser.create({
    data: { username, passwordHash, role: AdminRole.NFC_MAKER },
  });
  console.log(`Created NFC maker account "${username}".`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
