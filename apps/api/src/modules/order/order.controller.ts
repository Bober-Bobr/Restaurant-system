import type { Request, Response } from 'express';
import { orderService } from './order.service.js';
import {
  claimOrderSchema, guestTokenSchema, listOrdersSchema,
  orderIdSchema, placeOrderSchema, updateOrderSchema,
} from './order.schema.js';

// What an anonymous guest is allowed to see about their own order. Deliberately
// narrow: the waiter's identity is a username on a staff account, and the guest
// has no reason to receive it — only that somebody is now looking after them.
function toGuestView(order: Awaited<ReturnType<typeof orderService.placeOrder>>) {
  return {
    code: order.code,
    guestToken: order.guestToken,
    status: order.status,
    comment: order.comment,
    tableNumber: order.tableNumber,
    callPending: !!order.callPendingAt,
    claimed: !!order.claimedAt,
    createdAt: order.createdAt,
    items: order.items.map((line) => ({
      menuItemId: line.menuItemId,
      name: line.nameSnapshot,
      unitPriceCents: line.unitPriceCents,
      quantity: line.quantity,
    })),
    totalCents: order.items.reduce((sum, line) => sum + line.unitPriceCents * line.quantity, 0),
  };
}

export class OrderController {
  // ── Public (guest) ────────────────────────────────────────────────────────

  async place(request: Request, response: Response) {
    const payload = placeOrderSchema.parse(request.body);
    const order = await orderService.placeOrder(
      payload.restaurantId,
      payload.comment ?? null,
      payload.items,
    );
    response.status(201).json(toGuestView(order));
  }

  async getMine(request: Request, response: Response) {
    const { guestToken } = guestTokenSchema.parse(request.params);
    response.json(toGuestView(await orderService.getByGuestToken(guestToken)));
  }

  async callWaiter(request: Request, response: Response) {
    const { guestToken } = guestTokenSchema.parse(request.params);
    await orderService.callWaiter(guestToken);
    response.json(toGuestView(await orderService.getByGuestToken(guestToken)));
  }

  // ── Waiter ────────────────────────────────────────────────────────────────

  async listMine(request: Request, response: Response) {
    const { status } = listOrdersSchema.parse(request.query);
    response.json(await orderService.listMine(request.admin!.id, status));
  }

  async alertCount(request: Request, response: Response) {
    response.json({ count: await orderService.alertCount(request.admin!.id) });
  }

  async claim(request: Request, response: Response) {
    const { code, tableNumber } = claimOrderSchema.parse(request.body);
    const order = await orderService.claim(
      request.admin!.id,
      request.restaurantId!,
      code,
      tableNumber,
    );
    response.status(201).json(order);
  }

  async update(request: Request, response: Response) {
    const { id } = orderIdSchema.parse(request.params);
    const payload = updateOrderSchema.parse(request.body);
    response.json(await orderService.updateOrder(request.admin!.id, id, payload));
  }

  async acknowledgeCall(request: Request, response: Response) {
    const { id } = orderIdSchema.parse(request.params);
    response.json(await orderService.acknowledgeCall(request.admin!.id, id));
  }

  async close(request: Request, response: Response) {
    const { id } = orderIdSchema.parse(request.params);
    response.json(await orderService.closeOrder(request.admin!.id, id));
  }
}

export const orderController = new OrderController();
