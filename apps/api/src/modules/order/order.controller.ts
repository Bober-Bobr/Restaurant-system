import type { Request, Response } from 'express';
import { orderService } from './order.service.js';
import {
  claimOrderSchema, guestTokenSchema, listOrdersSchema,
  orderIdSchema, placeOrderSchema, statsQuerySchema, updateOrderSchema,
} from './order.schema.js';
import {
  clampOffset, listClosedOrders, listTableNumbers, ordersByBucket,
  parseGranularity, resolveRange, totalsByEmployee,
} from './order.stats.js';
import { AdminRole } from '@prisma/client';

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

  // ── Statistics ────────────────────────────────────────────────────────────
  // `scope=restaurant` aggregates every employee and belongs to whoever runs the
  // restaurant. A Food Employee asking for it is silently narrowed to their own
  // figures rather than refused: the tab is the same page for both, and the only
  // difference should be how much of it they can see.
  private scopeFor(request: Request): { restaurantId: string; waiterId: string | null } {
    const admin = request.admin!;
    const wantsRestaurant = request.query.scope === 'restaurant';
    const mayAggregate = admin.role === AdminRole.CATERING_ADMIN
      || admin.role === AdminRole.ADMIN
      || admin.role === AdminRole.CHIEF_ADMIN;
    return {
      restaurantId: request.restaurantId!,
      waiterId: wantsRestaurant && mayAggregate ? null : admin.id,
    };
  }

  async stats(request: Request, response: Response) {
    const query = statsQuerySchema.parse(request.query);
    const scope = this.scopeFor(request);
    const buckets = await ordersByBucket(
      { ...scope, ...resolveRange(query.from, query.to), tzOffsetMinutes: clampOffset(query.tzOffsetMinutes) },
      parseGranularity(query.granularity),
    );
    response.json(buckets);
  }

  async employeeTotals(request: Request, response: Response) {
    const query = statsQuerySchema.parse(request.query);
    const admin = request.admin!;
    const mayAggregate = admin.role === AdminRole.CATERING_ADMIN
      || admin.role === AdminRole.ADMIN
      || admin.role === AdminRole.CHIEF_ADMIN;
    if (!mayAggregate) { response.status(403).json({ message: 'Forbidden' }); return; }
    response.json(await totalsByEmployee({
      restaurantId: request.restaurantId!,
      ...resolveRange(query.from, query.to),
      tzOffsetMinutes: clampOffset(query.tzOffsetMinutes),
    }));
  }

  async history(request: Request, response: Response) {
    const query = statsQuerySchema.parse(request.query);
    const scope = this.scopeFor(request);
    response.json(await listClosedOrders({
      ...scope,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      tableNumber: query.table?.trim() || undefined,
      take: Math.min(query.take ?? 50, 200),
      skip: query.skip ?? 0,
    }));
  }

  async tables(request: Request, response: Response) {
    const scope = this.scopeFor(request);
    response.json(await listTableNumbers(scope.restaurantId, scope.waiterId));
  }

  async close(request: Request, response: Response) {
    const { id } = orderIdSchema.parse(request.params);
    response.json(await orderService.closeOrder(request.admin!.id, id));
  }
}

export const orderController = new OrderController();
