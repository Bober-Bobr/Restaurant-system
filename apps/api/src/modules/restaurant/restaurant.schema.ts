import { z } from 'zod';

export const createRestaurantSchema = z.object({
  // Name is optional — a nameless restaurant inherits its company's name on create.
  name: z.string().max(150).optional(),
  address: z.string().max(300).optional(),
  phone: z.string().max(60).optional().nullable(),
  email: z.string().max(160).optional().nullable(),
  history: z.string().max(5000).optional().nullable(),
  logoUrl: z.string().min(1).optional(),
  backgroundImageUrl: z.string().optional().nullable(),
  companyId: z.string().optional(),
  // Tablet/summary palette. Accept a #rgb / #rrggbb hex, or null to reset.
  tabletAccentColor: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/).optional().nullable(),
  tabletBgColor: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/).optional().nullable(),
  // Tablet cursor/finger-trail + falling-particle effects (null resets to default).
  tabletParticles: z.enum(['none', 'confetti', 'birthday', 'snow', 'candy', 'hearts', 'custom']).optional().nullable(),
  tabletParticlesColor: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/).optional().nullable(),
  tabletParticlesImageUrl: z.string().optional().nullable(),
  tabletTrailTemplate: z.enum(['sparkle', 'hearts', 'candy', 'custom']).optional().nullable(),
  tabletTrailColor: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/).optional().nullable(),
  tabletTrailImageUrl: z.string().optional().nullable(),
  // Paid module entitlements. Accepted here but stripped for every caller except
  // CHIEF_ADMIN in the controller — an OWNER may edit their own restaurant and
  // must not be able to grant themselves a module they have not paid for.
  moduleBanquet: z.boolean().optional(),
  moduleCatering: z.boolean().optional(),
  moduleAddons: z.boolean().optional(),
});

export const updateRestaurantSchema = createRestaurantSchema.partial();

export const MODULE_FIELDS = ['moduleBanquet', 'moduleCatering', 'moduleAddons'] as const;
