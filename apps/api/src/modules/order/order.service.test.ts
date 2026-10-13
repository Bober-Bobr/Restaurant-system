import { beforeEach, describe, expect, it, vi } from 'vitest';

// The order service talks to the Prisma singleton directly, so the singleton is
// what gets replaced. Everything the service decides — pricing, the module
// gate, who owns what, the claim window — happens before Prisma is reached.
const prismaMock = vi.hoisted(() => ({
  restaurant: { findUnique: vi.fn() },
  menuItem: { findMany: vi.fn() },
  order: { create: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn(), findMany: vi.fn(), count: vi.fn() },
  // The floor somebody is standing on is read fresh on every floor call — see
  // `areaOf`. General dining unless a test says otherwise, which is also the
  // column's own default.
  adminUser: { findUnique: vi.fn() },
  event: { findFirst: vi.fn() },
  orderItem: { deleteMany: vi.fn(), createMany: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock('../../db/prisma.js', () => ({ prisma: prismaMock }));

const { OrderService, ORDER_STATUS, CLAIM_WINDOW_MS } = await import('./order.service.js');
const { Prisma } = await import('@prisma/client');

const RESTAURANT = 'rest-1';
const OPEN_RESTAURANT = { id: RESTAURANT, moduleCatering: true };

// Orders are the catering system's, so they are priced at the CATERING price.
const MENU = [
  { id: 'm1', name: 'Lagman', priceCentsCatering: 4500000, isOutOfStock: false },
  { id: 'm2', name: 'Plov', priceCentsCatering: 6000000, isOutOfStock: false },
];

let service: InstanceType<typeof OrderService>;

beforeEach(() => {
  vi.clearAllMocks();
  service = new OrderService();
  prismaMock.restaurant.findUnique.mockResolvedValue(OPEN_RESTAURANT);
  prismaMock.adminUser.findUnique.mockResolvedValue({ workArea: 'DINING' });
  // Answer like the database would: only the ids that were asked for.
  prismaMock.menuItem.findMany.mockImplementation(async ({ where }: never) => {
    const wanted: string[] = (where as { id: { in: string[] } }).id.in;
    return MENU.filter((item) => wanted.includes(item.id));
  });
  prismaMock.order.create.mockImplementation(async ({ data }: never) => ({ id: 'o1', ...(data as object) }));
  // Run the callback against the same mock, which is what a transaction is here.
  prismaMock.$transaction.mockImplementation(async (fn: never) => (fn as unknown as (tx: unknown) => unknown)(prismaMock));
});

async function statusOf(run: () => Promise<unknown>): Promise<number> {
  try {
    await run();
  } catch (error) {
    return (error as { status?: number }).status ?? 0;
  }
  throw new Error('expected the call to be refused, but it succeeded');
}

/** What `order.create` was actually asked to write. */
function createdOrder() {
  return prismaMock.order.create.mock.calls[0][0].data;
}

describe('placing an order', () => {
  it('snapshots the name and price from the SERVER, not from the request', async () => {
    // The request body carries ids and quantities only. A client that could
    // name its own prices could order a banquet for nothing.
    await service.placeOrder(RESTAURANT, null, [{ menuItemId: 'm1', quantity: 2 }]);

    expect(createdOrder().items.create).toEqual([
      { menuItemId: 'm1', nameSnapshot: 'Lagman', unitPriceCents: 4500000, quantity: 2 },
    ]);
  });

  it('ignores any price the client tries to send', async () => {
    await service.placeOrder(RESTAURANT, null, [
      { menuItemId: 'm1', quantity: 1, unitPriceCents: 1, nameSnapshot: 'Free lunch' } as never,
    ]);
    const line = createdOrder().items.create[0];
    expect(line.unitPriceCents).toBe(4500000);
    expect(line.nameSnapshot).toBe('Lagman');
  });

  it('collapses duplicate ids instead of trusting the client to have done it', async () => {
    await service.placeOrder(RESTAURANT, null, [
      { menuItemId: 'm1', quantity: 1 },
      { menuItemId: 'm1', quantity: 2 },
    ]);
    expect(createdOrder().items.create).toEqual([
      { menuItemId: 'm1', nameSnapshot: 'Lagman', unitPriceCents: 4500000, quantity: 3 },
    ]);
  });

  it('drops lines with a quantity of zero or less', async () => {
    await service.placeOrder(RESTAURANT, null, [
      { menuItemId: 'm1', quantity: 0 },
      { menuItemId: 'm2', quantity: -5 },
      { menuItemId: 'm2', quantity: 1 },
    ]);
    expect(createdOrder().items.create).toEqual([
      { menuItemId: 'm2', nameSnapshot: 'Plov', unitPriceCents: 6000000, quantity: 1 },
    ]);
  });

  it('refuses an order that ends up empty', async () => {
    expect(await statusOf(() => service.placeOrder(RESTAURANT, null, []))).toBe(400);
    expect(await statusOf(() => service.placeOrder(RESTAURANT, null, [{ menuItemId: 'm1', quantity: 0 }]))).toBe(400);
  });

  it('is gated on the catering module, like the site itself', async () => {
    prismaMock.restaurant.findUnique.mockResolvedValue({ id: RESTAURANT, moduleCatering: false });
    expect(await statusOf(() => service.placeOrder(RESTAURANT, null, [{ menuItemId: 'm1', quantity: 1 }]))).toBe(403);
  });

  it('404s on a restaurant that does not exist', async () => {
    prismaMock.restaurant.findUnique.mockResolvedValue(null);
    expect(await statusOf(() => service.placeOrder(RESTAURANT, null, [{ menuItemId: 'm1', quantity: 1 }]))).toBe(404);
  });

  it('REJECTS rather than silently dropping a dish that has gone', async () => {
    // The guest is looking at a total. An order that quietly loses a dish is
    // worse than one that asks them to refresh. ("gone" is not in MENU, so the
    // default mock already answers with one row for a two-id request.)
    expect(await statusOf(() => service.placeOrder(RESTAURANT, null, [
      { menuItemId: 'm1', quantity: 1 },
      { menuItemId: 'gone', quantity: 1 },
    ]))).toBe(409);
    expect(prismaMock.order.create).not.toHaveBeenCalled();
  });

  it('refuses an out-of-stock dish and names it', async () => {
    prismaMock.menuItem.findMany.mockResolvedValue([{ ...MENU[0], isOutOfStock: true }]);
    const error = await service.placeOrder(RESTAURANT, null, [{ menuItemId: 'm1', quantity: 1 }]).catch((e) => e);
    expect(error.status).toBe(409);
    expect(error.message).toContain('Lagman');
  });

  it('only ever resolves dishes from this restaurant, and only active ones', async () => {
    await service.placeOrder(RESTAURANT, null, [{ menuItemId: 'm1', quantity: 1 }]);
    expect(prismaMock.menuItem.findMany.mock.calls[0][0].where).toMatchObject({
      restaurantId: RESTAURANT,
      isActive: true,
    });
  });

  it('starts PENDING with a code and a guest token', async () => {
    await service.placeOrder(RESTAURANT, null, [{ menuItemId: 'm1', quantity: 1 }]);
    const order = createdOrder();
    expect(order.status).toBe(ORDER_STATUS.pending);
    expect(order.code).toHaveLength(3);
    expect(order.guestToken.length).toBeGreaterThan(20);
  });

  it('trims the kitchen comment and stores an empty one as null', async () => {
    await service.placeOrder(RESTAURANT, '  no onions  ', [{ menuItemId: 'm1', quantity: 1 }]);
    expect(createdOrder().comment).toBe('no onions');

    prismaMock.order.create.mockClear();
    await service.placeOrder(RESTAURANT, '   ', [{ menuItemId: 'm1', quantity: 1 }]);
    expect(createdOrder().comment).toBeNull();
  });

  it('retries with a fresh code when two guests collide on one', async () => {
    // The partial unique index arbitrates; the service tries again rather than
    // failing a guest who did nothing wrong.
    const conflict = new Prisma.PrismaClientKnownRequestError('unique', { code: 'P2002', clientVersion: 'test' });
    prismaMock.order.create
      .mockRejectedValueOnce(conflict)
      .mockRejectedValueOnce(conflict)
      .mockImplementationOnce(async ({ data }: never) => ({ id: 'o1', ...(data as object) }));

    await expect(service.placeOrder(RESTAURANT, null, [{ menuItemId: 'm1', quantity: 1 }])).resolves.toBeTruthy();
    expect(prismaMock.order.create).toHaveBeenCalledTimes(3);

    const codes = prismaMock.order.create.mock.calls.map((call: never[]) => (call[0] as { data: { code: string } }).data.code);
    expect(new Set(codes).size).toBeGreaterThan(1);
  });

  it('gives up rather than looping forever', async () => {
    const conflict = new Prisma.PrismaClientKnownRequestError('unique', { code: 'P2002', clientVersion: 'test' });
    prismaMock.order.create.mockRejectedValue(conflict);
    expect(await statusOf(() => service.placeOrder(RESTAURANT, null, [{ menuItemId: 'm1', quantity: 1 }]))).toBe(503);
  });

  it('does not swallow a real database error as a code collision', async () => {
    prismaMock.order.create.mockRejectedValue(new Error('connection lost'));
    await expect(service.placeOrder(RESTAURANT, null, [{ menuItemId: 'm1', quantity: 1 }]))
      .rejects.toThrow('connection lost');
    expect(prismaMock.order.create).toHaveBeenCalledTimes(1);
  });
});

describe('the guest\'s own view', () => {
  it('is keyed on the device token, never on the code', async () => {
    prismaMock.order.findUnique.mockResolvedValue({ id: 'o1' });
    await service.getByGuestToken('secret-token');
    expect(prismaMock.order.findUnique.mock.calls[0][0].where).toEqual({ guestToken: 'secret-token' });
  });

  it('404s on a token that owns nothing', async () => {
    prismaMock.order.findUnique.mockResolvedValue(null);
    expect(await statusOf(() => service.getByGuestToken('nope'))).toBe(404);
  });
});

describe('calling the waiter', () => {
  it('is refused before anyone has claimed the order', async () => {
    // There is nobody to notify yet — the guest is still being told to read
    // their code out.
    prismaMock.order.findUnique.mockResolvedValue({ id: 'o1', status: ORDER_STATUS.pending });
    expect(await statusOf(() => service.callWaiter('t'))).toBe(409);
  });

  it('marks the call once the order is open', async () => {
    prismaMock.order.findUnique.mockResolvedValue({ id: 'o1', status: ORDER_STATUS.open, callPendingAt: null });
    prismaMock.order.update.mockResolvedValue({ id: 'o1' });
    await service.callWaiter('t');
    expect(prismaMock.order.update.mock.calls[0][0].data.callPendingAt).toBeInstanceOf(Date);
  });

  it('pressing twice does not reset how long they have been waiting', async () => {
    const waitingSince = new Date('2026-08-12T10:00:00Z');
    prismaMock.order.findUnique.mockResolvedValue({ id: 'o1', status: ORDER_STATUS.open, callPendingAt: waitingSince });
    const result = await service.callWaiter('t');
    expect(prismaMock.order.update).not.toHaveBeenCalled();
    expect(result.callPendingAt).toBe(waitingSince);
  });
});

describe('a waiter claiming an order', () => {
  const pending = { id: 'o1', status: ORDER_STATUS.pending, createdAt: new Date() };

  it('takes ownership and attaches the table number', async () => {
    prismaMock.order.findFirst.mockResolvedValue(pending);
    prismaMock.order.update.mockResolvedValue({ id: 'o1' });

    await service.claim('waiter-1', RESTAURANT, 'a3f', ' 12 ');

    expect(prismaMock.order.update.mock.calls[0][0].data).toMatchObject({
      waiterId: 'waiter-1',
      tableNumber: '12',
      status: ORDER_STATUS.open,
    });
  });

  it('looks the code up case-insensitively, inside this restaurant only', async () => {
    prismaMock.order.findFirst.mockResolvedValue(pending);
    prismaMock.order.update.mockResolvedValue({ id: 'o1' });

    await service.claim('waiter-1', RESTAURANT, ' a3f ', '12');

    expect(prismaMock.order.findFirst.mock.calls[0][0].where).toEqual({
      restaurantId: RESTAURANT, code: 'A3F', status: ORDER_STATUS.pending,
    });
  });

  it('requires a table number — the guest never provides one', async () => {
    expect(await statusOf(() => service.claim('waiter-1', RESTAURANT, 'A3F', '   '))).toBe(400);
    expect(prismaMock.order.findFirst).not.toHaveBeenCalled();
  });

  it('404s on a code nobody placed', async () => {
    prismaMock.order.findFirst.mockResolvedValue(null);
    expect(await statusOf(() => service.claim('waiter-1', RESTAURANT, 'A3F', '12'))).toBe(404);
  });

  it('refuses an order that has gone stale', async () => {
    prismaMock.order.findFirst.mockResolvedValue({
      ...pending, createdAt: new Date(Date.now() - CLAIM_WINDOW_MS - 1000),
    });
    expect(await statusOf(() => service.claim('waiter-1', RESTAURANT, 'A3F', '12'))).toBe(410);
  });

  it('still accepts one right at the edge of the window', async () => {
    prismaMock.order.findFirst.mockResolvedValue({
      ...pending, createdAt: new Date(Date.now() - CLAIM_WINDOW_MS + 5000),
    });
    prismaMock.order.update.mockResolvedValue({ id: 'o1' });
    await expect(service.claim('waiter-1', RESTAURANT, 'A3F', '12')).resolves.toBeTruthy();
  });

  it('re-reads the order inside the transaction', async () => {
    // Two waiters may be typing the same code at the same moment.
    prismaMock.order.findFirst.mockResolvedValue(pending);
    prismaMock.order.update.mockResolvedValue({ id: 'o1' });
    await service.claim('waiter-1', RESTAURANT, 'A3F', '12');
    expect(prismaMock.$transaction).toHaveBeenCalled();
  });
});

describe('an order belongs to the waiter who claimed it', () => {
  const otherWaiters = [
    { name: 'amending', run: () => service.updateOrder('waiter-2', 'o1', { comment: 'x' }) },
    { name: 'acknowledging the call', run: () => service.acknowledgeCall('waiter-2', 'o1') },
    { name: 'closing', run: () => service.closeOrder('waiter-2', 'o1') },
  ];

  for (const { name, run } of otherWaiters) {
    it(`refuses ${name} somebody else's order`, async () => {
      prismaMock.order.findUnique.mockResolvedValue({ id: 'o1', waiterId: 'waiter-1', status: ORDER_STATUS.open });
      // 404 rather than 403: a waiter has no business learning a guessed id exists.
      expect(await statusOf(run)).toBe(404);
    });
  }

  it('refuses an order that is already closed', async () => {
    prismaMock.order.findUnique.mockResolvedValue({ id: 'o1', waiterId: 'waiter-1', status: ORDER_STATUS.closed });
    expect(await statusOf(() => service.closeOrder('waiter-1', 'o1'))).toBe(409);
  });
});

describe('amending an open order', () => {
  beforeEach(() => {
    prismaMock.order.findUnique.mockResolvedValue({
      id: 'o1', waiterId: 'waiter-1', status: ORDER_STATUS.open, restaurantId: RESTAURANT,
    });
    prismaMock.order.update.mockResolvedValue({ id: 'o1' });
  });

  it('re-snapshots prices from the live menu, as placing does', async () => {
    await service.updateOrder('waiter-1', 'o1', { items: [{ menuItemId: 'm2', quantity: 2 }] });
    expect(prismaMock.orderItem.createMany.mock.calls[0][0].data).toEqual([
      { orderId: 'o1', menuItemId: 'm2', nameSnapshot: 'Plov', unitPriceCents: 6000000, quantity: 2 },
    ]);
  });

  it('replaces the lines wholesale rather than merging', async () => {
    await service.updateOrder('waiter-1', 'o1', { items: [{ menuItemId: 'm1', quantity: 1 }] });
    expect(prismaMock.orderItem.deleteMany).toHaveBeenCalledWith({ where: { orderId: 'o1' } });
  });

  it('refuses to empty an order', async () => {
    expect(await statusOf(() => service.updateOrder('waiter-1', 'o1', { items: [] }))).toBe(400);
  });

  it('refuses lines that no longer resolve', async () => {
    prismaMock.menuItem.findMany.mockResolvedValue([]);
    expect(await statusOf(() => service.updateOrder('waiter-1', 'o1', {
      items: [{ menuItemId: 'gone', quantity: 1 }],
    }))).toBe(409);
  });

  it('leaves the lines alone when only the comment changed', async () => {
    await service.updateOrder('waiter-1', 'o1', { comment: 'no onions' });
    expect(prismaMock.orderItem.deleteMany).not.toHaveBeenCalled();
    expect(prismaMock.order.update.mock.calls[0][0].data).toEqual({ comment: 'no onions' });
  });

  it('distinguishes "clear the comment" from "do not touch it"', async () => {
    await service.updateOrder('waiter-1', 'o1', { comment: null });
    expect(prismaMock.order.update.mock.calls[0][0].data).toEqual({ comment: null });

    prismaMock.order.update.mockClear();
    await service.updateOrder('waiter-1', 'o1', {});
    expect(prismaMock.order.update.mock.calls[0][0].data).toEqual({});
  });
});

describe('closing an order', () => {
  it('stamps the time and clears any outstanding call', async () => {
    prismaMock.order.findUnique.mockResolvedValue({ id: 'o1', waiterId: 'w1', status: ORDER_STATUS.open });
    prismaMock.order.update.mockResolvedValue({ id: 'o1' });

    await service.closeOrder('w1', 'o1');

    const data = prismaMock.order.update.mock.calls[0][0].data;
    expect(data.status).toBe(ORDER_STATUS.closed);
    expect(data.closedAt).toBeInstanceOf(Date);
    // Closing frees the code for reuse; leaving an alert set would keep
    // buzzing a waiter about a table that has left.
    expect(data.callPendingAt).toBeNull();
  });
});

describe('the waiter\'s working set', () => {
  it('counts only orders that are actually calling', async () => {
    prismaMock.order.count.mockResolvedValue(2);
    await service.alertCount('w1');
    expect(prismaMock.order.count.mock.calls[0][0].where).toEqual({
      waiterId: 'w1', workArea: 'DINING', status: ORDER_STATUS.open, callPendingAt: { not: null },
    });
  });

  it('lists only this waiter\'s orders, on the floor they are working', async () => {
    prismaMock.order.findMany.mockResolvedValue([]);
    await service.listMine('w1');
    expect(prismaMock.order.findMany.mock.calls[0][0].where).toEqual({ waiterId: 'w1', workArea: 'DINING' });
  });

  it('puts the tables that are calling first', async () => {
    prismaMock.order.findMany.mockResolvedValue([]);
    await service.listMine('w1');
    expect(prismaMock.order.findMany.mock.calls[0][0].orderBy[0]).toEqual({
      callPendingAt: { sort: 'asc', nulls: 'last' },
    });
  });
});

describe('an order is the catering system\'s, whatever the other systems do', () => {
  it('charges the catering price — the banquet price is not even read', async () => {
    await service.placeOrder(RESTAURANT, null, [{ menuItemId: 'm1', quantity: 2 }]);
    const call = prismaMock.menuItem.findMany.mock.calls[0][0];
    expect(call.select).toMatchObject({ priceCentsCatering: true });
    expect(call.select).not.toHaveProperty('priceCents');
    expect(JSON.stringify(createdOrder())).toContain('4500000');
  });

  it('cannot order a dish the food admin switched off', async () => {
    await service.placeOrder(RESTAURANT, null, [{ menuItemId: 'm1', quantity: 1 }]);
    expect(prismaMock.menuItem.findMany.mock.calls[0][0].where).toMatchObject({ disabledCatering: false });
  });
});

// ── The Small Banquets floor ───────────────────────────────────────────────
// A party's food order: placed by staff against a booking, priced at the
// SECTION'S price, taken off a list rather than by a code, and hidden until
// the evening is close. See utils/workArea.ts for the rule behind all of it.

const PARTY_MENU = [
  { id: 'm1', name: 'Lagman', priceCentsSmallBanquet: 3000000, isOutOfStock: false },
  { id: 'm2', name: 'Plov', priceCentsSmallBanquet: 4000000, isOutOfStock: false },
];

const BOOKING = {
  id: 'ev-cuid', eventNumber: 42,
  floorTables: [{ floorTable: { label: '7' } }, { floorTable: { label: '10' } }],
};

/** An order row as the floor list gets it, with its party's time. */
const partyOrder = (over: Record<string, unknown> = {}) => ({
  id: 'o-party', workArea: 'SMALL_BANQUET', status: 'PENDING',
  event: { eventDate: new Date('2026-10-13T19:00:00.000Z') },
  ...over,
});

describe('a party\'s food order', () => {
  beforeEach(() => {
    prismaMock.event.findFirst.mockResolvedValue(BOOKING);
    prismaMock.menuItem.findMany.mockImplementation(async ({ where }: never) => {
      const wanted: string[] = (where as { id: { in: string[] } }).id.in;
      return PARTY_MENU.filter((item) => wanted.includes(item.id));
    });
  });

  it('is priced at the SMALL BANQUETS price, never the catering one', async () => {
    // Three systems sell from one dish table at three prices; charging a party
    // the general-dining price is charging the wrong rate for the room.
    await service.placeForBooking(RESTAURANT, 'SMALL_BANQUET', 42, [{ menuItemId: 'm1', quantity: 40 }], null);
    const select = prismaMock.menuItem.findMany.mock.calls[0][0].select;
    expect(select).toMatchObject({ priceCentsSmallBanquet: true });
    expect(select).not.toHaveProperty('priceCentsCatering');
    expect(select).not.toHaveProperty('priceCents');
    expect(JSON.stringify(createdOrder())).toContain('3000000');
  });

  it('and refuses a dish the SECTION has switched off', async () => {
    await service.placeForBooking(RESTAURANT, 'SMALL_BANQUET', 42, [{ menuItemId: 'm1', quantity: 1 }], null);
    expect(prismaMock.menuItem.findMany.mock.calls[0][0].where).toMatchObject({ disabledSmallBanquet: false });
  });

  it('belongs to the booking, and to the Small Banquets floor', async () => {
    await service.placeForBooking(RESTAURANT, 'SMALL_BANQUET', 42, [{ menuItemId: 'm1', quantity: 2 }], ' two tables ');
    const data = createdOrder();
    expect(data.eventId).toBe('ev-cuid');
    expect(data.workArea).toBe('SMALL_BANQUET');
    expect(data.status).toBe(ORDER_STATUS.pending);
    expect(data.comment).toBe('two tables');
  });

  it('takes its table number from the tables the booking already holds', async () => {
    // Nobody types one: the handoff a code exists for happened on the map.
    await service.placeForBooking(RESTAURANT, 'SMALL_BANQUET', 42, [{ menuItemId: 'm1', quantity: 2 }], null);
    expect(createdOrder().tableNumber).toBe('7, 10');
  });

  it('a booking in another section or restaurant is 404', async () => {
    prismaMock.event.findFirst.mockResolvedValue(null);
    expect(await statusOf(() => service.placeForBooking(RESTAURANT, 'SMALL_BANQUET', 42, [{ menuItemId: 'm1', quantity: 1 }], null))).toBe(404);
    // Scoped on all three, so a number alone reaches nothing.
    expect(prismaMock.event.findFirst.mock.calls[0][0].where).toEqual({
      restaurantId: RESTAURANT, eventNumber: 42, section: 'SMALL_BANQUET',
    });
  });

  it('an empty order is refused rather than written', async () => {
    expect(await statusOf(() => service.placeForBooking(RESTAURANT, 'SMALL_BANQUET', 42, [{ menuItemId: 'm1', quantity: 0 }], null))).toBe(400);
    expect(prismaMock.order.create).not.toHaveBeenCalled();
  });

  it('a dish that is off the menu now is refused, not silently dropped', async () => {
    expect(await statusOf(() => service.placeForBooking(RESTAURANT, 'SMALL_BANQUET', 42, [{ menuItemId: 'ghost', quantity: 1 }], null))).toBe(409);
  });
});

describe('the floor a waiter is working decides what they see', () => {
  it('the list is filtered by the work area, read fresh from the account', async () => {
    prismaMock.adminUser.findUnique.mockResolvedValue({ workArea: 'SMALL_BANQUET' });
    prismaMock.order.findMany.mockResolvedValue([]);
    await service.listMine('w1', { status: 'OPEN' });
    expect(prismaMock.order.findMany.mock.calls[0][0].where).toEqual({
      waiterId: 'w1', workArea: 'SMALL_BANQUET', status: 'OPEN',
    });
    // Fresh, not from the token: a manager moving somebody between floors must
    // not take fifteen minutes to land.
    expect(prismaMock.adminUser.findUnique).toHaveBeenCalledWith({ where: { id: 'w1' }, select: { workArea: true } });
  });

  it('on the party floor, what is not due yet is held back and COUNTED', async () => {
    prismaMock.adminUser.findUnique.mockResolvedValue({ workArea: 'SMALL_BANQUET' });
    const now = new Date('2026-10-13T12:00:00.000Z');
    prismaMock.order.findMany.mockResolvedValue([
      partyOrder({ id: 'soon', event: { eventDate: new Date('2026-10-13T13:00:00.000Z') } }),
      partyOrder({ id: 'tonight', event: { eventDate: new Date('2026-10-13T19:00:00.000Z') } }),
      partyOrder({ id: 'tomorrow', event: { eventDate: new Date('2026-10-14T19:00:00.000Z') } }),
    ]);
    const { orders, later } = await service.listMine('w1', { now });
    expect(orders.map((o: { id: string }) => o.id)).toEqual(['soon']);
    expect(later).toBe(2);
  });

  it('and nothing is held back on the dining floor', async () => {
    prismaMock.adminUser.findUnique.mockResolvedValue({ workArea: 'DINING' });
    prismaMock.order.findMany.mockResolvedValue([
      partyOrder({ id: 'a', workArea: 'DINING', event: null }),
      partyOrder({ id: 'b', workArea: 'DINING', event: null }),
    ]);
    const { orders, later } = await service.listMine('w1', {});
    expect(orders).toHaveLength(2);
    expect(later).toBe(0);
  });

  it('"waiting to be taken" exists only where orders ARE taken off a list', async () => {
    // General dining's unclaimed orders belong to the guest holding the code;
    // listing them for anyone to take would undo that handoff.
    prismaMock.adminUser.findUnique.mockResolvedValue({ workArea: 'DINING' });
    expect(await service.pendingForArea('w1', RESTAURANT)).toEqual({ orders: [], later: 0 });
    expect(prismaMock.order.findMany).not.toHaveBeenCalled();
  });

  it('taking one off the list needs no code and no table number', async () => {
    prismaMock.adminUser.findUnique.mockResolvedValue({ workArea: 'SMALL_BANQUET' });
    prismaMock.order.findFirst.mockResolvedValue({ id: 'o-party' });
    prismaMock.order.update.mockResolvedValue({ id: 'o-party', status: 'OPEN' });
    await service.takeFromList('w1', RESTAURANT, 'o-party');
    // Re-read inside the transaction and scoped on the floor, so this cannot
    // reach into the dining stream.
    expect(prismaMock.order.findFirst.mock.calls[0][0].where).toEqual({
      id: 'o-party', restaurantId: RESTAURANT, workArea: 'SMALL_BANQUET', status: ORDER_STATUS.pending,
    });
    expect(prismaMock.order.update.mock.calls[0][0].data).toMatchObject({ waiterId: 'w1', status: ORDER_STATUS.open });
    expect(prismaMock.order.update.mock.calls[0][0].data).not.toHaveProperty('tableNumber');
  });

  it('two waiters pressing the same row: the second is told, not given it', async () => {
    prismaMock.adminUser.findUnique.mockResolvedValue({ workArea: 'SMALL_BANQUET' });
    prismaMock.order.findFirst.mockResolvedValue(null);
    expect(await statusOf(() => service.takeFromList('w1', RESTAURANT, 'o-party'))).toBe(409);
  });

  it('a dining waiter cannot take an order off a list at all', async () => {
    prismaMock.adminUser.findUnique.mockResolvedValue({ workArea: 'DINING' });
    // Refused BEFORE any read, and with its own reason. Asserting only the
    // status passed against the guard being deleted: the transaction's own
    // "already taken" check answers 409 as well, so the test went on passing
    // while a dining waiter could in fact claim one by id — a break-check
    // found that.
    let message = '';
    try {
      await service.takeFromList('w1', RESTAURANT, 'o-party');
    } catch (error) {
      message = (error as Error).message;
      expect((error as { status?: number }).status).toBe(409);
    }
    expect(message).toContain('code');
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(prismaMock.order.findFirst).not.toHaveBeenCalled();
  });

  it('the alert count is zero on the party floor — there is no device to call from', async () => {
    prismaMock.adminUser.findUnique.mockResolvedValue({ workArea: 'SMALL_BANQUET' });
    expect(await service.alertCount('w1')).toBe(0);
    // Answered rather than refused: a page that polls it anyway gets the
    // honest number instead of an error every five seconds.
    expect(prismaMock.order.count).not.toHaveBeenCalled();
  });
});

describe('what a party\'s order does NOT have', () => {
  // "The client does not create or interact with the order", enforced on the
  // way in rather than only hidden on the screen.
  it('no "call waiter" — there is no guest device in it', async () => {
    prismaMock.order.findUnique.mockResolvedValue({
      id: 'o-party', guestToken: 'tok', workArea: 'SMALL_BANQUET', status: ORDER_STATUS.open,
    });
    expect(await statusOf(() => service.callWaiter('tok'))).toBe(409);
    expect(prismaMock.order.update).not.toHaveBeenCalled();
  });

  it('no acknowledging a call that cannot exist', async () => {
    prismaMock.order.findUnique.mockResolvedValue({
      id: 'o-party', waiterId: 'w1', workArea: 'SMALL_BANQUET', status: ORDER_STATUS.open,
    });
    expect(await statusOf(() => service.acknowledgeCall('w1', 'o-party'))).toBe(409);
  });

  it('no changing the DISHES — they were agreed with the host', async () => {
    prismaMock.order.findUnique.mockResolvedValue({
      id: 'o-party', waiterId: 'w1', workArea: 'SMALL_BANQUET', status: ORDER_STATUS.open,
    });
    expect(await statusOf(() => service.updateOrder('w1', 'o-party', { items: [{ menuItemId: 'm1', quantity: 1 }] }))).toBe(409);
    expect(prismaMock.orderItem.deleteMany).not.toHaveBeenCalled();
  });

  it('but a note for the kitchen is still a note', async () => {
    prismaMock.order.findUnique.mockResolvedValue({
      id: 'o-party', waiterId: 'w1', workArea: 'SMALL_BANQUET', status: ORDER_STATUS.open,
    });
    prismaMock.order.update.mockResolvedValue({ id: 'o-party' });
    await service.updateOrder('w1', 'o-party', { comment: 'allergy on table 7' });
    expect(prismaMock.order.update.mock.calls[0][0].data).toMatchObject({ comment: 'allergy on table 7' });
  });

  it('and a DINING order keeps all three', async () => {
    // The same code, the other way round: these refusals are the order's
    // floor, not the caller's.
    prismaMock.order.findUnique.mockResolvedValue({
      id: 'o1', guestToken: 'tok', waiterId: 'w1', workArea: 'DINING',
      status: ORDER_STATUS.open, callPendingAt: null,
    });
    prismaMock.order.update.mockResolvedValue({ id: 'o1' });
    await service.callWaiter('tok');
    await service.acknowledgeCall('w1', 'o1');
    expect(prismaMock.order.update).toHaveBeenCalledTimes(2);
  });
});

describe('one resolver, three callers', () => {
  // Placing a guest's order, placing a party's and amending an open one all
  // resolve ids into priced, snapshotted lines. Written three times, one of
  // them would eventually be given another product's price column.
  it('a dish the kitchen has run out of refuses a NEW order', async () => {
    prismaMock.menuItem.findMany.mockResolvedValue([
      { id: 'm1', name: 'Lagman', priceCentsCatering: 100, isOutOfStock: true },
    ]);
    expect(await statusOf(() => service.placeOrder(RESTAURANT, null, [{ menuItemId: 'm1', quantity: 1 }]))).toBe(409);
  });

  it('but not an AMENDMENT, which is what that path has always done', async () => {
    // The order may already hold a line that went out of stock after it was
    // taken; refusing would leave the waiter unable to edit it at all.
    prismaMock.order.findUnique.mockResolvedValue({
      id: 'o1', restaurantId: RESTAURANT, waiterId: 'w1', workArea: 'DINING', status: ORDER_STATUS.open,
    });
    prismaMock.menuItem.findMany.mockResolvedValue([
      { id: 'm1', name: 'Lagman', priceCentsCatering: 100, isOutOfStock: true },
    ]);
    prismaMock.order.update.mockResolvedValue({ id: 'o1' });
    await service.updateOrder('w1', 'o1', { items: [{ menuItemId: 'm1', quantity: 1 }] });
    expect(prismaMock.orderItem.createMany).toHaveBeenCalled();
  });

  it('an amendment is re-priced from the live menu, never from the request', async () => {
    prismaMock.order.findUnique.mockResolvedValue({
      id: 'o1', restaurantId: RESTAURANT, waiterId: 'w1', workArea: 'DINING', status: ORDER_STATUS.open,
    });
    prismaMock.order.update.mockResolvedValue({ id: 'o1' });
    await service.updateOrder('w1', 'o1', { items: [{ menuItemId: 'm1', quantity: 3 }] });
    const written = prismaMock.orderItem.createMany.mock.calls.at(-1)![0].data;
    expect(written[0]).toMatchObject({ nameSnapshot: 'Lagman', unitPriceCents: 4500000, quantity: 3 });
  });
});
