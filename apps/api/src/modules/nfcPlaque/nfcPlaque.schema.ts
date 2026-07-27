import { z } from 'zod';

// Slugs address the published plaque at v-connect.uz/<slug>, so they share the
// URL namespace with the platform's own paths.
const RESERVED_SLUGS = new Set(['login', 'nfc', 'api', 'uploads', 'assets', 'admin']);

export const plaqueSlugSchema = z
  .string()
  .min(3)
  .max(60)
  .regex(/^[a-z0-9-]+$/, 'Only lowercase letters, digits and dashes')
  .refine((s) => !s.startsWith('-') && !s.endsWith('-'), 'Cannot start or end with a dash')
  .refine((s) => !RESERVED_SLUGS.has(s), 'This address is reserved');

const themeFields = {
  accentColor: z.string().max(32).optional().nullable(),
  backgroundColor: z.string().max(32).optional().nullable(),
  backgroundImageUrl: z.string().max(500).optional().nullable(),
  textColor: z.string().max(32).optional().nullable(),
  textScale: z.number().min(0.5).max(2).optional().nullable(),
  particles: z.string().max(32).optional().nullable(),
  particlesColor: z.string().max(32).optional().nullable(),
  particlesImageUrl: z.string().max(500).optional().nullable(),
  musicUrl: z.string().max(500).optional().nullable(),
  trailTemplate: z.string().max(32).optional(),
  trailColor: z.string().max(32).optional().nullable(),
  trailImageUrl: z.string().max(500).optional().nullable(),
};

export const createNfcPlaqueSchema = z.object({
  businessName: z.string().min(1).max(150),
  slug: plaqueSlugSchema,
  // The block layout is opaque to the API — the shared designer owns its shape.
  blocks: z.array(z.any()).max(200).optional(),
  isPublished: z.boolean().optional(),
  ...themeFields,
});

export const updateNfcPlaqueSchema = createNfcPlaqueSchema.partial();

export const nfcPlaqueIdSchema = z.object({ id: z.string().cuid() });
export const nfcPlaqueSlugParamSchema = z.object({ slug: z.string().min(1).max(60) });
