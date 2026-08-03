import { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import createHttpError from 'http-errors';
import { generateCode, generateGuestToken, normalizeCode } from './order.code.js';

// ── Order lifecycle ─────────────────────────────────────────────────────────
//   PENDING  guest placed it; a code is showing on their phone
//   OPEN     a waiter entered the code + table number; it is now theirs
//   CLOSED   the guest left and the waiter finalised it
//   CANCELLED never claimed / abandoned
//
// Status is a plain String, matching PerformerBooking — new states need no
// migration. Every transition below re-reads the row inside its transaction
// rather than trusting what the caller was looking at.

export const ORDER_STATUS = {
  pending: 'PENDING',
  open: 'OPEN',
  closed: 'CLOSED',
  cancelled: 'CANCELLED',
} as const;

/** A PENDING order nobody claims is stale after this and stops being claimable. */
export const CLAIM_WINDOW_MS = 3 * 60 * 60 * 1000;

const ORDER_INCLUDE = {
  items: { orderBy: { nameSnapshot: 'asc' } },
  waiter: { select: { id: true, username: true } },
} satisfies Prisma.OrderInclude;

export type OrderLineInput = { menuItemId: string; quantity: number };

export class OrderService {
  // ── Guest side (unauthenticated) ──────────────────────────────────────────

  /**
   * Place an order. Prices and names are resolved from the live menu HERE and
   * snapshotted onto the lines — the request body carries ids and quantities
   * only. A client that could name its own prices would be a hole big enough to
   * order a banquet for nothing.
   */
  async placeOrder(restaurantId: string, comment: string | null, lines: OrderLineInput[]) {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { id: true, moduleCatering: true },
    });
    if (!restaurant) throw createHttpError(404, 'Restaurant not found');
    // The same entitlement that decides whether the site resolves at all.
    if (!restaurant.moduleCatering) throw createHttpError(403, 'Ordering is not available for this restaurant.');

    // Collapse duplicate ids rather than trusting the client to have done it.
    const wanted = new Map<string, number>();
    for (const line of lines) {
      if (line.quantity <= 0) continue;
      wanted.set(line.menuItemId, (wanted.get(line.menuItemId) ?? 0) + line.quantity);
    }
    if (wanted.size === 0) throw createHttpError(400, 'The order is empty.');

    const menuItems = await prisma.menuItem.findMany({
      where: { id: { in: [...wanted.keys()] }, restaurantId, isActive: true },
      select: { id: true, name: true, priceCents: true, isOutOfStock: true },
    });
    const byId = new Map(menuItems.map((m) => [m.id, m]));

    // Reject rather than silently drop: the guest is looking at a total, and an
    // order that quietly loses a dish is worse than one that asks them to retry.
    const missing = [...wanted.keys()].filter((id) => !byId.has(id));
    if (missing.length > 0) throw createHttpError(409, 'Some dishes are no longer on the menu. Please refresh.');
    const unavailable = menuItems.filter((m) => m.isOutOfStock).map((m) => m.name);
    if (unavailable.length > 0) {
      throw createHttpError(409, `No longer available: ${unavailable.join(', ')}`);
    }

    const items = [...wanted.entries()].map(([menuItemId, quantity]) => {
      const item = byId.get(menuItemId)!;
      return {
        menuItemId,
        nameSnapshot: item.name,
        unitPriceCents: item.priceCents,
        quantity,
      };
    });

    // Retry on the partial unique index (restaurantId, code) WHERE status IN
    // (PENDING, OPEN). With 15,625 codes and a handful open per restaurant a
    // collision is rare, but it is a real race between two guests ordering at the
    // same instant — so let the database arbitrate and try again.
    for (let attempt = 0; attempt < 8; attempt += 1) {
      try {
        return await prisma.order.create({
          data: {
            restaurantId,
            code: generateCode(),
            guestToken: generateGuestToken(),
            status: ORDER_STATUS.pending,
            comment: comment?.trim() || null,
            items: { create: items },
          },
          include: ORDER_INCLUDE,
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') continue;
        throw error;
      }
    }
    throw createHttpError(503, 'Could not allocate an order code. Please try again.');
  }

  /** The guest's own view, keyed on their device token. */
  async getByGuestToken(guestToken: string) {
    const order = await prisma.order.findUnique({ where: { guestToken }, include: ORDER_INCLUDE });
    if (!order) throw createHttpError(404, 'Order not found');
    return order;
  }

  /**
   * "Call waiter". Only meaningful once a waiter owns the order — before that
   * there is nobody to notify, and the guest is already being told to read their
   * code out. Idempotent: pressing twice does not queue two calls, and does not
   * reset how long they have been waiting.
   */
  async callWaiter(guestToken: string) {
    const order = await prisma.order.findUnique({ where: { guestToken } });
    if (!order) throw createHttpError(404, 'Order not found');
    if (order.status !== ORDER_STATUS.open) {
      throw createHttpError(409, 'No waiter is assigned to this order yet.');
    }
    if (order.callPendingAt) return order;
    return prisma.order.update({ where: { id: order.id }, data: { callPendingAt: new Date() } });
  }

  // ── Waiter side (authenticated, restaurant-scoped) ────────────────────────

  /**
   * Claim a pending order by its code and attach the table number. The whole
   * point of the handoff: a guest cannot assign themselves a table, and an order
   * has no owner until a waiter physically stands at the table and types this.
   */
  async claim(waiterId: string, restaurantId: string, rawCode: string, tableNumber: string) {
    const code = normalizeCode(rawCode);
    const table = tableNumber.trim();
    if (!table) throw createHttpError(400, 'A table number is required.');

    return prisma.$transaction(async (tx) => {
      // Re-read inside the transaction: two waiters may be typing the same code.
      const order = await tx.order.findFirst({
        where: { restaurantId, code, status: ORDER_STATUS.pending },
        orderBy: { createdAt: 'desc' },
      });
      if (!order) throw createHttpError(404, 'No open order with that code. Check the code with the guest.');

      if (Date.now() - order.createdAt.getTime() > CLAIM_WINDOW_MS) {
        throw createHttpError(410, 'That order has expired. Ask the guest to place it again.');
      }

      return tx.order.update({
        where: { id: order.id },
        data: {
          waiterId,
          tableNumber: table,
          status: ORDER_STATUS.open,
          claimedAt: new Date(),
        },
        include: ORDER_INCLUDE,
      });
    });
  }

  /** Orders belonging to this waiter. `open` by default — their working set. */
  async listMine(waiterId: string, status?: string) {
    return prisma.order.findMany({
      where: { waiterId, ...(status ? { status } : {}) },
      include: ORDER_INCLUDE,
      orderBy: [{ callPendingAt: { sort: 'asc', nulls: 'last' } }, { claimedAt: 'desc' }],
      take: 100,
    });
  }

  /** Cheap enough to poll every few seconds — a count, not a list. */
  async alertCount(waiterId: string) {
    return prisma.order.count({
      where: { waiterId, status: ORDER_STATUS.open, callPendingAt: { not: null } },
    });
  }

  private async ownedOpenOrder(waiterId: string, id: string) {
    const order = await prisma.order.findUnique({ where: { id } });
    // 404 rather than 403 for someone else's order: a waiter has no business
    // learning that an id they guessed exists.
    if (!order || order.waiterId !== waiterId) throw createHttpError(404, 'Order not found');
    if (order.status !== ORDER_STATUS.open) throw createHttpError(409, 'This order is no longer open.');
    return order;
  }

  /**
   * Amend an open order — the waiter returns to the table and the guest wants
   * another dish, or the comment changed. Lines are replaced wholesale because
   * that is what the client edits; prices are re-snapshotted from the live menu
   * for the same reason as placeOrder.
   */
  async updateOrder(
    waiterId: string,
    id: string,
    payload: { items?: OrderLineInput[]; comment?: string | null; tableNumber?: string },
  ) {
    await this.ownedOpenOrder(waiterId, id);

    let itemData: { menuItemId: string; nameSnapshot: string; unitPriceCents: number; quantity: number }[] | null = null;
    if (payload.items) {
      const wanted = new Map<string, number>();
      for (const line of payload.items) {
        if (line.quantity <= 0) continue;
        wanted.set(line.menuItemId, (wanted.get(line.menuItemId) ?? 0) + line.quantity);
      }
      if (wanted.size === 0) throw createHttpError(400, 'An order needs at least one dish.');

      const order = await prisma.order.findUnique({ where: { id }, select: { restaurantId: true } });
      const menuItems = await prisma.menuItem.findMany({
        where: { id: { in: [...wanted.keys()] }, restaurantId: order!.restaurantId, isActive: true },
        select: { id: true, name: true, priceCents: true },
      });
      const byId = new Map(menuItems.map((m) => [m.id, m]));
      if (byId.size !== wanted.size) throw createHttpError(409, 'Some dishes are no longer on the menu.');

      itemData = [...wanted.entries()].map(([menuItemId, quantity]) => {
        const item = byId.get(menuItemId)!;
        return { menuItemId, nameSnapshot: item.name, unitPriceCents: item.priceCents, quantity };
      });
    }

    return prisma.$transaction(async (tx) => {
      if (itemData) {
        await tx.orderItem.deleteMany({ where: { orderId: id } });
        await tx.orderItem.createMany({ data: itemData.map((line) => ({ ...line, orderId: id })) });
      }
      return tx.order.update({
        where: { id },
        data: {
          ...(payload.comment !== undefined ? { comment: payload.comment?.trim() || null } : {}),
          ...(payload.tableNumber !== undefined ? { tableNumber: payload.tableNumber.trim() || null } : {}),
        },
        include: ORDER_INCLUDE,
      });
    });
  }

  /** The waiter has been to the table; stop the alert without closing anything. */
  async acknowledgeCall(waiterId: string, id: string) {
    await this.ownedOpenOrder(waiterId, id);
    return prisma.order.update({ where: { id }, data: { callPendingAt: null }, include: ORDER_INCLUDE });
  }

  /** The guest left. Finalises the order and frees its code for reuse. */
  async closeOrder(waiterId: string, id: string) {
    await this.ownedOpenOrder(waiterId, id);
    return prisma.order.update({
      where: { id },
      data: { status: ORDER_STATUS.closed, closedAt: new Date(), callPendingAt: null },
      include: ORDER_INCLUDE,
    });
  }
}

export const orderService = new OrderService();
