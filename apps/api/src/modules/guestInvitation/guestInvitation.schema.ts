import { z } from 'zod';

const dateTime = z.string().datetime({ offset: true });

const timingItem = z.object({
  time: z.string().max(20),
  label: z.string().max(160),
});

// Per-section animation config. Keys are section names (hero, greeting, ...).
const animationType = z.enum([
  'none',
  'fade',
  'slide-up',
  'slide-down',
  'slide-left',
  'slide-right',
  'zoom',
  'blur',
  'flip',
]);
const sectionAnimation = z.object({
  type: animationType,
  durationMs: z.number().int().min(100).max(4000).optional(),
  delayMs: z.number().int().min(0).max(4000).optional(),
});

const trailTemplate = z.enum(['sparkle', 'hearts', 'candy']);

// Freeform WYSIWYG block array (validated on the client; permissive here).
const blockArray = z
  .array(
    z.object({
      id: z.string().max(60),
      type: z.string().max(40),
      props: z.record(z.string(), z.any()).optional(),
      anim: z.any().optional(),
    })
  )
  .max(120);

const baseShape = {
  slug: z.string().min(1).max(120).regex(/^[a-zA-Z0-9_-]+$/),
  blocks: blockArray.optional(),

  accentColor: z.string().max(32).optional().nullable(),
  backgroundColor: z.string().max(32).optional().nullable(),
  backgroundImageUrl: z.string().max(500).optional().nullable(),
  textColor: z.string().max(32).optional().nullable(),
  musicUrl: z.string().max(500).optional().nullable(),
  trailTemplate: trailTemplate.optional(),
  trailColor: z.string().max(32).optional().nullable(),

  coupleNames: z.string().max(160).optional().nullable(),
  heroSubtitle: z.string().max(160).optional().nullable(),
  heroImageUrl: z.string().max(500).optional().nullable(),

  greetingTitle: z.string().max(160).optional().nullable(),
  greetingMessage: z.string().max(1000).optional().nullable(),
  coupleSignature: z.string().max(160).optional().nullable(),

  venueLabel: z.string().max(80).optional().nullable(),
  venueName: z.string().max(160).optional().nullable(),
  eventDate: dateTime.optional().nullable(),
  venueImageUrl: z.string().max(500).optional().nullable(),
  mapAddress: z.string().max(500).optional().nullable(),
  mapButtonLabel: z.string().max(60).optional().nullable(),

  timingTitle: z.string().max(80).optional().nullable(),
  timingItems: z.array(timingItem).max(30).optional(),

  countdownAt: dateTime.optional().nullable(),
  countdownLabel: z.string().max(60).optional().nullable(),

  telegramUrl: z.string().max(500).optional().nullable(),
  phone: z.string().max(60).optional().nullable(),
  instagramUrl: z.string().max(500).optional().nullable(),
  brandLabel: z.string().max(80).optional().nullable(),

  rsvpTitle: z.string().max(160).optional().nullable(),
  rsvpEnabled: z.boolean().optional(),

  sectionAnimations: z.record(z.string(), sectionAnimation).optional(),

  isPublished: z.boolean().optional(),
};

export const createGuestInvitationSchema = z.object(baseShape);
export const updateGuestInvitationSchema = z
  .object({ ...baseShape, slug: baseShape.slug.optional() })
  .partial();

// Public RSVP submission.
export const rsvpSchema = z.object({
  guestName: z.string().min(1).max(120),
  attending: z.boolean(),
});

export type CreateGuestInvitationInput = z.infer<typeof createGuestInvitationSchema>;
export type UpdateGuestInvitationInput = z.infer<typeof updateGuestInvitationSchema>;
export type RsvpInput = z.infer<typeof rsvpSchema>;
