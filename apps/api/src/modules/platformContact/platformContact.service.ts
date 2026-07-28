import { prisma } from '../../db/prisma.js';

// The two brands that carry contact details under their "developed by" credit.
export const BRANDS = ['vconnect', 'vinvite'] as const;
export type Brand = (typeof BRANDS)[number];

export type PlatformContactDto = { brand: Brand; phone: string; telegram: string };

const EMPTY = (brand: Brand): PlatformContactDto => ({ brand, phone: '', telegram: '' });

export class PlatformContactService {
  // Always returns a row per brand — a brand that has never been configured
  // reads as empty rather than missing, so callers never branch on null.
  async listAll(): Promise<PlatformContactDto[]> {
    const rows = await prisma.platformContact.findMany();
    return BRANDS.map((brand) => {
      const row = rows.find((r) => r.brand === brand);
      return row
        ? { brand, phone: row.phone ?? '', telegram: row.telegram ?? '' }
        : EMPTY(brand);
    });
  }

  async get(brand: Brand): Promise<PlatformContactDto> {
    const row = await prisma.platformContact.findUnique({ where: { brand } });
    return row ? { brand, phone: row.phone ?? '', telegram: row.telegram ?? '' } : EMPTY(brand);
  }

  async upsert(brand: Brand, data: { phone?: string; telegram?: string }): Promise<PlatformContactDto> {
    const phone = (data.phone ?? '').trim() || null;
    const telegram = (data.telegram ?? '').trim() || null;
    const row = await prisma.platformContact.upsert({
      where: { brand },
      create: { brand, phone, telegram },
      update: { phone, telegram },
    });
    return { brand, phone: row.phone ?? '', telegram: row.telegram ?? '' };
  }
}
