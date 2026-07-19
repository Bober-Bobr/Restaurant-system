import { z } from 'zod';

// Freeform WYSIWYG block (same permissive shape as the flyer designer — props
// are validated client-side).
export const blockArray = z
  .array(
    z.object({
      id: z.string().max(60),
      type: z.string().max(40),
      props: z.record(z.string(), z.any()).optional(),
      anim: z.any().optional(),
      hidden: z.boolean().optional(),
    })
  )
  .max(120);

const username = z
  .string()
  .min(3, 'Username must be at least 3 characters')
  .max(32)
  .regex(/^[a-zA-Z0-9._-]+$/, 'Username may contain letters, digits, dot, dash and underscore');

const password = z.string().min(6, 'Password must be at least 6 characters').max(128);

export const registerSchema = z.object({
  email: z.string().email().max(254),
  username,
  password,
});

export const loginSchema = z.object({
  // Email or username.
  identifier: z.string().min(1).max(254),
  password: z.string().min(1).max(128),
});

export const googleAuthSchema = z.object({
  // Google Identity Services ID token (JWT credential).
  credential: z.string().min(20).max(4096),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(20),
});

export const updateProfileSchema = z.object({
  displayName: z.string().max(80).optional().nullable(),
  username: username.optional(),
  currentPassword: z.string().max(128).optional(),
  newPassword: password.optional(),
});

// Published sites live at <slug>.v-invite.uz — subdomain-safe labels only.
export const projectSlug = z
  .string()
  .min(3)
  .max(63)
  .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, 'Lowercase letters, digits and dashes only');

export const createProjectSchema = z.object({
  name: z.string().min(1).max(120),
  blocks: blockArray.optional(),
  theme: z.record(z.string(), z.any()).optional(),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  slug: projectSlug.optional().nullable(),
  isPublished: z.boolean().optional(),
  blocks: blockArray.optional(),
  theme: z.record(z.string(), z.any()).optional(),
});

// Guest RSVP from a published invitation (no auth — length-capped).
export const rsvpSchema = z.object({
  name: z.string().min(1).max(120),
  attending: z.boolean(),
  guests: z.number().int().min(0).max(20).optional(),
  dietary: z.string().max(500).optional(),
  message: z.string().max(2000).optional(),
});

export const createTemplateSchema = z.object({
  name: z.string().min(1).max(120),
  blocks: blockArray.optional(),
  theme: z.record(z.string(), z.any()).optional(),
});

export const updateTemplateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  blocks: blockArray.optional(),
  theme: z.record(z.string(), z.any()).optional(),
});
