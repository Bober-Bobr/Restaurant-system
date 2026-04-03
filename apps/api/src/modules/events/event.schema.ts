import { EventStatus, EventType, Region } from '@prisma/client';
import { z } from 'zod';

const phoneValidators: Record<Region, RegExp> = {
  US: /^(\+1)?(\d{3})[-.\s]?(\d{3})[-.\s]?(\d{4})$/,
  CA: /^(\+1)?(\d{3})[-.\s]?(\d{3})[-.\s]?(\d{4})$/,
  GB: /^(\+44|44)?\d{10,11}$/,
  DE: /^(\+49|49)?[1-9]\d{6,14}$/,
  FR: /^(\+33|33|0)\d{9}$/,
  IT: /^(\+39|39)?\d{9,11}$/,
  ES: /^(\+34|34)?[6-9]\d{8}$/,
  RU: /^(\+7|8)(\d{10})$/,
  CN: /^(\+86|86)?1[3-9]\d{9}$/,
  JP: /^(\+81|81|0)\d{9,10}$/,
  KR: /^(\+82|82|0)1[0-9]\d{7,8}$/,
  AU: /^(\+61|61|0)[2-478]\d{8}$/,
  UZ: /^(\+998|998)?\d{9}$/,
  EU: /^\+?[1-9]\d{1,14}$/
};

const phoneValidator = z.string().optional();

export const createEventSchema = z
  .object({
    customerName: z.string().min(2).max(120),
    customerPhone: phoneValidator,
    eventDate: z.string().datetime(),
    guestCount: z.number().int().positive().max(5000),
    status: z.nativeEnum(EventStatus).optional(),
    eventType: z.nativeEnum(EventType).optional(),
    region: z.nativeEnum(Region).optional(),
    hallId: z.string().cuid().optional(),
    tableCategoryId: z.string().cuid().optional(),
    notes: z.string().max(2000).optional()
  })
  .superRefine((data, ctx) => {
    if (data.customerPhone && data.region) {
      const validator = phoneValidators[data.region as Region];
      if (!validator.test(data.customerPhone)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['customerPhone'],
          message: `Invalid phone number format for region ${data.region}`
        });
      }
    }
  });

export const updateEventSchema = z
  .object({
    customerName: z.string().min(2).max(120).optional(),
    customerPhone: phoneValidator,
    eventDate: z.string().datetime().optional(),
    guestCount: z.number().int().positive().max(5000).optional(),
    status: z.nativeEnum(EventStatus).optional(),
    eventType: z.nativeEnum(EventType).optional(),
    region: z.nativeEnum(Region).optional(),
    hallId: z.string().cuid().optional(),
    notes: z.string().max(2000).optional()
  })
  .superRefine((data, ctx) => {
    if (data.customerPhone && data.region) {
      const validator = phoneValidators[data.region as Region];
      if (!validator.test(data.customerPhone)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['customerPhone'],
          message: `Invalid phone number format for region ${data.region}`
        });
      }
    }
  });

export const eventIdSchema = z.object({
  eventId: z.string().cuid()
});
