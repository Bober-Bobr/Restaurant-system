import { z } from 'zod';

const menuItem = z.object({
  number: z.number().int().min(1).max(99),
  name: z.string().min(1).max(120),
  photoUrl: z.string().max(500).optional().nullable(),
});

const dateTime = z.string().datetime({ offset: true });

// Freeform WYSIWYG block: { id, type, props, anim? }. Props are type-specific and
// validated on the client, so the server schema stays permissive.
export const blockArray = z
  .array(
    z.object({
      id: z.string().max(60),
      type: z.string().max(40),
      props: z.record(z.string(), z.any()).optional(),
      anim: z.any().optional(),
      // Blocks the designer switched off. Zod strips unknown keys, so omitting
      // this silently discarded the flag and hidden blocks came back on save.
      hidden: z.boolean().optional(),
    })
  )
  .max(120);

const baseShape = {
  slug: z.string().min(1).max(120).regex(/^[a-zA-Z0-9_-]+$/),
  blocks: blockArray.optional(),
  eventId: z.string().max(40).optional().nullable(),
  // Optional: standalone flyers (restaurant not in the system) have no restaurantId.
  restaurantId: z.string().min(1).max(40).optional().nullable(),

  promoTitle: z.string().max(120).optional().nullable(),
  promoSubtitle: z.string().max(240).optional().nullable(),
  promoCode: z.string().max(60).optional().nullable(),
  promoImageUrl: z.string().max(500).optional().nullable(),
  promoCodeAlt: z.string().max(60).optional().nullable(),
  promoDescription: z.string().max(500).optional().nullable(),

  telegramUrl: z.string().max(500).optional().nullable(),
  telegramLabel: z.string().max(60).optional().nullable(),

  welcomeTitle: z.string().max(240).optional().nullable(),
  welcomeSubtitle: z.string().max(240).optional().nullable(),
  welcomeImageUrl: z.string().max(500).optional().nullable(),
  welcomeMessage: z.string().max(500).optional().nullable(),

  countdownAt: dateTime.optional().nullable(),
  countdownLabel: z.string().max(60).optional().nullable(),

  menuItems: z.array(menuItem).max(50).optional(),
  // Gallery items: a still photo + optional Instagram video link.
  // Legacy plain-string entries are still accepted for backward compatibility.
  galleryPhotos: z.array(
    z.union([
      z.string().max(500),
      z.object({
        photoUrl: z.string().max(500),
        videoUrl: z.string().max(500).optional().nullable(),
      }),
    ])
  ).max(50).optional(),

  instagramUrl: z.string().max(500).optional().nullable(),
  instagramLabel: z.string().max(60).optional().nullable(),
  phone: z.string().max(60).optional().nullable(),
  contactsTitle: z.string().max(120).optional().nullable(),
  contactVCardUrl: z.string().max(500).optional().nullable(),

  accentColor: z.string().max(32).optional().nullable(),
  backgroundColor: z.string().max(32).optional().nullable(),
  backgroundImageUrl: z.string().max(500).optional().nullable(),
  textColor: z.string().max(32).optional().nullable(),
  textScale: z.number().min(0.5).max(2).optional().nullable(),
  particles: z.string().max(20).optional().nullable(),
  particlesImageUrl: z.string().max(500).optional().nullable(),
  trailTemplate: z.string().max(20).optional().nullable(),
  trailColor: z.string().max(32).optional().nullable(),
  trailImageUrl: z.string().max(500).optional().nullable(),
  musicUrl: z.string().max(500).optional().nullable(),

  isPublished: z.boolean().optional(),
};

export const createInvitationSchema = z.object(baseShape);
export const updateInvitationSchema = z.object({
  ...baseShape,
  slug: baseShape.slug.optional(),
  restaurantId: baseShape.restaurantId.optional(),
}).partial();

export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;
export type UpdateInvitationInput = z.infer<typeof updateInvitationSchema>;

// Public lead submitted from a flyer's "form" block.
export const invitationRequestSchema = z.object({
  name: z.string().min(1).max(120),
  phone: z.string().min(1).max(60),
  message: z.string().max(1000).optional().nullable(),
});
export type InvitationRequestInput = z.infer<typeof invitationRequestSchema>;
