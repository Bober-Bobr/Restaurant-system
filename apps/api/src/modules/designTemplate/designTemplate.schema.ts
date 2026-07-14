import { z } from 'zod';

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

export const createDesignTemplateSchema = z.object({
  name: z.string().min(1).max(120),
  kind: z.enum(['flyer', 'invitation']),
  blocks: blockArray.optional(),
  theme: z.record(z.string(), z.any()).optional(),
});

export type CreateDesignTemplateInput = z.infer<typeof createDesignTemplateSchema>;

export const updateDesignTemplateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  blocks: blockArray.optional(),
  theme: z.record(z.string(), z.any()).optional(),
  isFavorite: z.boolean().optional(),
});

export type UpdateDesignTemplateInput = z.infer<typeof updateDesignTemplateSchema>;
