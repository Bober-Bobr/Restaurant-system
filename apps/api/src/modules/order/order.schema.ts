import { z } from 'zod';

// The client sends ids and quantities only — never prices. The service resolves
// both from the live menu, so there is nothing here for a caller to lie about.
const orderLineSchema = z.object({
  menuItemId: z.string().cuid(),
  quantity: z.number().int().min(1).max(99),
});

export const placeOrderSchema = z.object({
  restaurantId: z.string().cuid(),
  comment: z.string().max(500).optional().nullable(),
  items: z.array(orderLineSchema).min(1).max(60),
});

export const guestTokenSchema = z.object({
  guestToken: z.string().min(10).max(200),
});

export const claimOrderSchema = z.object({
  code: z.string().min(1).max(12),
  tableNumber: z.string().min(1).max(20),
});

export const updateOrderSchema = z.object({
  items: z.array(orderLineSchema).min(1).max(60).optional(),
  comment: z.string().max(500).optional().nullable(),
  tableNumber: z.string().max(20).optional(),
});

export const orderIdSchema = z.object({ id: z.string().cuid() });

export const listOrdersSchema = z.object({
  status: z.enum(['PENDING', 'OPEN', 'CLOSED', 'CANCELLED']).optional(),
});
