import { Prisma } from '@prisma/client';
import { getExcludedCategories } from '../../utils/excludedCategories.js';
import { prisma } from '../../db/prisma.js';
import createHttpError from 'http-errors';
import { generateCode, generateGuestToken, normalizeCode } from './order.code.js';
import { DEFAULT_WORK_AREA, isDueNow, workAreaOf, workAreaSurface, type WorkArea } from '../../utils/workArea.js';

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
  // The booking a small-banquet order feeds. Read through the relation rather
  // than copied onto the order, so moving a booking cannot leave its food
  // being served at the old hour — and it is what the floor list needs to say
  // whose party this is and when.
  event: {
    select: {
      id: true, eventNumber: true, eventDate: true, customerName: true,
      customerPhone: true, guestCount: true, hallId: true,
      hall: { select: { name: true } },
      floorTables: { select: { guestCount: true, floorTable: { select: { label: true } } } },
    },
  },
} satisfies Prisma.OrderInclude;

export type OrderLineInput = { menuItemId: string; quantity: number };

/** What the catering system sells: not switched off by dish, not by category. */
async function cateringOnSale(restaurantId: string) {
  const excluded = await getExcludedCategories(restaurantId, 'catering');
  return { disabledCatering: false, category: { notIn: excluded } };
}

/**
 * The same question for the Small Banquets section, which sells from the same
 * dish table at ITS OWN price and with its own switched-off lists.
 *
 * Separate rather than a parameter on the one above, because the three columns
 * it names are different columns — that is the whole of "one dish table, three
 * systems", and a shared helper taking a scope would have to build the column
 * names by string, which is how a price from the wrong product gets charged.
 */
async function smallBanquetOnSale(restaurantId: string) {
  const excluded = await getExcludedCategories(restaurantId, 'smallBanquet');
  return { disabledSmallBanquet: false, category: { notIn: excluded } };
}

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

    // Orders are the CATERING system's: its price, and only dishes it sells —
    // a dish or category the food admin switched off cannot be ordered, and
    // the banquet price is never charged here (utils/excludedCategories.ts).
    const items = await this.resolveLines(
      restaurantId, lines, await cateringOnSale(restaurantId), 'priceCentsCatering',
    );

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

  // ── The Small Banquets side (staff-placed, against a booking) ─────────────

  /**
   * Place a booking's food order — the supervisor's path, from the floor map.
   *
   * It is the SAME `Order` and the same floor screens as general dining, which
   * is the point: a party's food is served by the same people with the same
   * tools. Four things differ, and all four come from there being no guest
   * device in it:
   *
   *   · it is placed by staff for a BOOKING (`eventId`), not by a phone;
   *   · it is priced at the SMALL BANQUETS price, and refuses a dish that
   *     section has switched off — a banquet's food is not sold at the
   *     catering price (see "one dish table, three systems");
   *   · its table number is the tables the booking already holds, so nobody
   *     types one. The whole handoff that `claim` exists for — a guest cannot
   *     assign themselves a table — has already happened on the map;
   *   · it carries no module gate of its own. Small Banquets ships ungated,
   *     and borrowing `moduleCatering` would stop a venue that runs the
   *     section and never bought general dining from feeding its parties.
   *
   * The booking is re-checked against the caller's restaurant AND section,
   * 404 on either, like every other path that takes an id in this section.
   */
  async placeForBooking(
    restaurantId: string,
    section: string,
    eventNumber: number,
    lines: OrderLineInput[],
    comment: string | null,
  ) {
    const event = await prisma.event.findFirst({
      where: { restaurantId, eventNumber, section },
      select: {
        id: true, eventNumber: true,
        floorTables: { select: { floorTable: { select: { label: true } } } },
      },
    });
    if (!event) throw createHttpError(404, 'Booking not found');

    const items = await this.resolveLines(restaurantId, lines, await smallBanquetOnSale(restaurantId), 'priceCentsSmallBanquet');

    // The tables the party is already sitting at, in the order the map shows
    // them. A booking that holds the whole area, or none yet, has no label to
    // print — the waiter's card names the room and the booking instead.
    const tables = event.floorTables
      .map((row) => row.floorTable.label)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      .join(', ');

    for (let attempt = 0; attempt < 8; attempt += 1) {
      try {
        return await prisma.order.create({
          data: {
            restaurantId,
            eventId: event.id,
            workArea: 'SMALL_BANQUET',
            code: generateCode(),
            // Generated although nobody holds it: every order has one by
            // schema, and a nullable secret would be a second shape for every
            // guest-side path to allow for. Nothing displays it here.
            guestToken: generateGuestToken(),
            status: ORDER_STATUS.pending,
            tableNumber: tables || null,
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

  /**
   * Resolve ids and quantities into priced, snapshotted lines.
   *
   * One copy, two products: the only differences are which dishes are on sale
   * and WHICH PRICE COLUMN is charged, so both are arguments. Written twice,
   * the small-banquet path would eventually be given the catering price by a
   * copy-paste, which is a party invoiced at the wrong rate.
   */
  private async resolveLines(
    restaurantId: string,
    lines: OrderLineInput[],
    onSale: Prisma.MenuItemWhereInput,
    priceColumn: 'priceCentsCatering' | 'priceCentsSmallBanquet',
    /**
     * Whether a dish the kitchen has run out of refuses the whole thing.
     *
     * True when an order is PLACED: a guest looking at a total must not be
     * handed one they cannot be served. False when an open order is AMENDED,
     * which is the behaviour that path has always had and is deliberate — the
     * order may already contain a line that went out of stock after it was
     * taken, and refusing on that would leave the waiter unable to edit the
     * order at all until they removed something the guest may already have
     * eaten.
     */
    refuseOutOfStock = true,
  ) {
    const wanted = new Map<string, number>();
    for (const line of lines) {
      if (line.quantity <= 0) continue;
      wanted.set(line.menuItemId, (wanted.get(line.menuItemId) ?? 0) + line.quantity);
    }
    if (wanted.size === 0) throw createHttpError(400, 'The order is empty.');

    const menuItems = await prisma.menuItem.findMany({
      where: { id: { in: [...wanted.keys()] }, restaurantId, isActive: true, ...onSale },
      select: { id: true, name: true, isOutOfStock: true, [priceColumn]: true } as Prisma.MenuItemSelect,
    });
    const byId = new Map(menuItems.map((m) => [m.id as string, m]));
    const missing = [...wanted.keys()].filter((id) => !byId.has(id));
    if (missing.length > 0) throw createHttpError(409, 'Some dishes are no longer on the menu. Please refresh.');
    const unavailable = refuseOutOfStock ? menuItems.filter((m) => m.isOutOfStock).map((m) => m.name as string) : [];
    if (unavailable.length > 0) throw createHttpError(409, `No longer available: ${unavailable.join(', ')}`);

    return [...wanted.entries()].map(([menuItemId, quantity]) => {
      const item = byId.get(menuItemId)!;
      return {
        menuItemId,
        nameSnapshot: item.name as string,
        unitPriceCents: (item[priceColumn] as number) ?? 0,
        quantity,
      };
    });
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
    // A small-banquet order has a guest token because every order has one, and
    // nobody holds it. There is no guest device in that flow at all.
    this.assertAllowed(order, 'waiterCalls');
    if (order.status !== ORDER_STATUS.open) {
      throw createHttpError(409, 'No waiter is assigned to this order yet.');
    }
    if (order.callPendingAt) return order;
    return prisma.order.update({ where: { id: order.id }, data: { callPendingAt: new Date() } });
  }

  // ── Floor side (authenticated, restaurant-scoped) ─────────────────────────

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

  /**
   * The floor this member of staff is standing on, read FRESH on every call.
   *
   * Not from the token: an access token lasts fifteen minutes, so a manager
   * moving somebody between floors would leave them serving the wrong stream
   * for a quarter of an hour — and the switch is for right now. One read by
   * primary key against calls that are already database round trips.
   *
   * Every floor path asks this itself rather than taking the area as an
   * argument, so there is no call site that can forget to pass it. The web
   * knows its own area too (it draws the right controls), but nothing here
   * trusts that: a page a release behind must not be handed the other floor's
   * orders.
   */
  private async areaOf(adminId: string): Promise<WorkArea> {
    const row = await prisma.adminUser.findUnique({ where: { id: adminId }, select: { workArea: true } });
    return workAreaOf(row?.workArea ?? DEFAULT_WORK_AREA);
  }

  /**
   * The floor list: this waiter's own orders, on the floor they are working.
   *
   * **Filtered by work area on the SERVER**, not by the page: the two streams
   * are two jobs, and a waiter whose browser is a release behind must not be
   * handed a party's order while they are taking general dining, or the other
   * way round.
   *
   * In Small Banquets it also drops what is not due yet, and says HOW MANY it
   * dropped. A venue takes bookings weeks out; all of them at the top of the
   * list is a screen nobody can work from. The count is returned rather than
   * the rows because "3 later today" is the whole of what the waiter needs to
   * know about them — and because a list that says nothing about what it is
   * hiding is a list nobody can trust.
   */
  async listMine(waiterId: string, options: { status?: string; now?: Date } = {}) {
    const area = await this.areaOf(waiterId);
    const rows = await prisma.order.findMany({
      where: { waiterId, workArea: area, ...(options.status ? { status: options.status } : {}) },
      include: ORDER_INCLUDE,
      orderBy: [{ callPendingAt: { sort: 'asc', nulls: 'last' } }, { claimedAt: 'desc' }],
      take: 100,
    });
    return this.splitByDue(rows, area, options.now ?? new Date());
  }

  /**
   * Unclaimed orders waiting on this floor.
   *
   * Small Banquets only, and that is deliberate rather than an omission:
   * general dining's unclaimed orders are claimed BY CODE, from the guest's own
   * phone, and listing them for anyone to take would undo the one handoff the
   * whole flow is built around — a waiter is meant to be standing at the table.
   * A party's order has already been through that handoff on the map, so there
   * is nothing left to prove and nothing to type.
   */
  async pendingForArea(waiterId: string, restaurantId: string, now = new Date()) {
    const area = await this.areaOf(waiterId);
    if (!workAreaSurface(area).takeFromList) return { orders: [], later: 0 };
    const rows = await prisma.order.findMany({
      where: { restaurantId, workArea: area, status: ORDER_STATUS.pending },
      include: ORDER_INCLUDE,
      orderBy: [{ event: { eventDate: 'asc' } }, { createdAt: 'asc' }],
      take: 100,
    });
    return this.splitByDue(rows, area, now);
  }

  /** Hold back what is not due yet, and count it. See utils/workArea.ts. */
  private splitByDue<T extends { event: { eventDate: Date } | null }>(rows: T[], area: WorkArea, now: Date) {
    if (!workAreaSurface(area).hideUntilDue) return { orders: rows, later: 0 };
    const due = rows.filter((row) => isDueNow(row.event?.eventDate ?? null, now));
    return { orders: due, later: rows.length - due.length };
  }

  /**
   * Take an order off the list — the Small Banquets counterpart of `claim`.
   *
   * No code and no table number, because neither exists to be typed: the order
   * is already on the screen and the party is already sitting at the tables the
   * map gave them. The work area is checked as well as the restaurant, so this
   * cannot be used to reach into the general-dining stream and claim an order
   * out from under the code handoff.
   */
  async takeFromList(waiterId: string, restaurantId: string, id: string) {
    const area = await this.areaOf(waiterId);
    if (!workAreaSurface(area).takeFromList) {
      throw createHttpError(409, 'Orders on this floor are taken by their code.');
    }
    return prisma.$transaction(async (tx) => {
      // Re-read inside the transaction: two waiters may press the same row.
      const order = await tx.order.findFirst({
        where: { id, restaurantId, workArea: area, status: ORDER_STATUS.pending },
      });
      if (!order) throw createHttpError(409, 'That order has already been taken.');
      return tx.order.update({
        where: { id: order.id },
        data: { waiterId, status: ORDER_STATUS.open, claimedAt: new Date() },
        include: ORDER_INCLUDE,
      });
    });
  }

  /**
   * Cheap enough to poll every few seconds — a count, not a list.
   *
   * Scoped to the work area, which in Small Banquets means it is always zero:
   * there are no guest calls there, because there is no guest device. Scoped
   * rather than refused, so a page that polls it anyway gets the honest answer
   * instead of an error in the console every five seconds.
   */
  async alertCount(waiterId: string) {
    const area = await this.areaOf(waiterId);
    if (!workAreaSurface(area).waiterCalls) return 0;
    return prisma.order.count({
      where: { waiterId, workArea: area, status: ORDER_STATUS.open, callPendingAt: { not: null } },
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
   * Refuse what the order's own floor does not have.
   *
   * The surface table (utils/workArea.ts) is what the floor screens read to
   * decide which controls to draw; this is the same table enforced on the way
   * in, because a hidden control is presentation and not a rule. It is keyed on
   * the ORDER's work area rather than the caller's: what may be done to a
   * party's order does not change because the waiter switched floors.
   */
  private assertAllowed(order: { workArea: string }, feature: 'waiterCalls' | 'editItems') {
    if (workAreaSurface(workAreaOf(order.workArea))[feature]) return;
    throw createHttpError(409, feature === 'waiterCalls'
      // Said plainly, because both are reachable only from a stale page or a
      // hand-written request, and "forbidden" would read as a bug.
      ? 'This order has no guest device to call from.'
      : 'This order\'s dishes were agreed with the host and cannot be changed here.');
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
    const owned = await this.ownedOpenOrder(waiterId, id);
    // The dishes, not the whole order: a party's menu was agreed with the host
    // and is on the Events page, so changing it from the floor would make the
    // booking's own record wrong. A note for the kitchen is still a note.
    if (payload.items) this.assertAllowed(owned, 'editItems');

    let itemData: { menuItemId: string; nameSnapshot: string; unitPriceCents: number; quantity: number }[] | null = null;
    if (payload.items) {
      // Re-snapshotted from the live menu, through the same resolver the
      // original order went through — an amendment must not be able to carry a
      // price the order could not have been placed at.
      itemData = await this.resolveLines(
        owned.restaurantId, payload.items, await cateringOnSale(owned.restaurantId), 'priceCentsCatering', false,
      );
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
    const owned = await this.ownedOpenOrder(waiterId, id);
    this.assertAllowed(owned, 'waiterCalls');
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
