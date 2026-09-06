import { beforeEach, describe, expect, it, vi } from 'vitest';

// The ledger mirror is a side effect of every write here; it talks to Prisma,
// so it is stubbed. What matters in these tests is that it is *called*, since a
// blank mirror is how a manager's books silently miss an event.
const ledgerSync = vi.hoisted(() => vi.fn(async () => {}));
vi.mock('./event.ledgerSync.js', () => ({ syncEventToLedger: ledgerSync }));

const { EventService } = await import('./event.service.js');
const { createEventSchema, updateEventSchema } = await import('./event.schema.js');
import type { EventRepository } from './event.repository.js';

const EVENT = {
  id: 'cuid-1',
  eventNumber: 42,
  restaurantId: 'r1',
  customerName: 'Aziz',
  eventDate: new Date('2026-05-01T00:00:00.000Z'),
  originalEventDate: null as Date | null,
  guestCount: 120,
};

function makeService(event: typeof EVENT | null = EVENT) {
  const repo = {
    list: vi.fn(async () => [EVENT]),
    create: vi.fn(async (_r: string, payload: unknown) => ({ ...EVENT, ...(payload as object) })),
    getByNumber: vi.fn(async () => event),
    updateByNumber: vi.fn(async (_r: string, _n: number, data: unknown) => ({ ...EVENT, ...(data as object) })),
    deleteByNumber: vi.fn(async () => {}),
    addPayment: vi.fn(async () => {}),
    deletePayment: vi.fn(async () => {}),
  };
  return { service: new EventService(repo as unknown as EventRepository), repo };
}

async function statusOf(run: () => Promise<unknown>): Promise<number> {
  try {
    await run();
  } catch (error) {
    return (error as { status?: number }).status ?? 0;
  }
  throw new Error('expected the call to be refused, but it succeeded');
}

beforeEach(() => vi.clearAllMocks());

describe('an event is addressed by its number, not its database id', () => {
  it('exposes eventNumber as `id` and hides the cuid', async () => {
    // Event numbers are what staff say to each other; the cuid is internal.
    const { service } = makeService();
    const event = await service.getEventDetails('r1', 42);
    expect(event.id).toBe(42);
    expect(event).not.toHaveProperty('eventNumber');
  });

  it('maps every event in a list the same way', async () => {
    const { service } = makeService();
    const events = await service.listEvents('r1', { skip: 0, take: 10 });
    expect(events[0].id).toBe(42);
  });

  it('always resolves the number within the caller\'s restaurant', async () => {
    // Numbers restart per restaurant, so the pair is what identifies an event.
    const { service, repo } = makeService();
    await service.getEventDetails('r1', 42);
    expect(repo.getByNumber).toHaveBeenCalledWith('r1', 42);
  });

  const SCOPED: { name: string; run: (s: InstanceType<typeof EventService>) => Promise<unknown> }[] = [
    { name: 'reading', run: (s) => s.getEventDetails('r1', 42) },
    { name: 'editing', run: (s) => s.updateEvent('r1', 42, {}) },
    { name: 'deleting', run: (s) => s.deleteEvent('r1', 42) },
    { name: 'rescheduling', run: (s) => s.rescheduleEvent('r1', 42, new Date()) },
    { name: 'adding a payment', run: (s) => s.addPayment('r1', 42, 1000) },
    { name: 'removing a payment', run: (s) => s.removePayment('r1', 42, 'pay1') },
  ];

  for (const { name, run } of SCOPED) {
    it(`404s when ${name} an event this restaurant does not have`, async () => {
      const { service } = makeService(null);
      expect(await statusOf(() => run(service))).toBe(404);
    });
  }

  it('does not delete anything when the event is not found', async () => {
    const { service, repo } = makeService(null);
    await statusOf(() => service.deleteEvent('r1', 42));
    expect(repo.deleteByNumber).not.toHaveBeenCalled();
  });
});

describe('the expense-ledger mirror', () => {
  it('runs when an event is created', async () => {
    const { service } = makeService();
    await service.createEvent('r1', { customerName: 'Aziz' } as never);
    expect(ledgerSync).toHaveBeenCalledTimes(1);
  });

  it('runs again when the details change', async () => {
    // A blank event filled in afterwards, or a guest count corrected, has to
    // reach the manager's books too.
    const { service } = makeService();
    await service.updateEvent('r1', 42, { guestCount: 200 } as never);
    expect(ledgerSync).toHaveBeenCalledTimes(1);
  });

  it('runs when an event is moved to another date', async () => {
    const { service } = makeService();
    await service.rescheduleEvent('r1', 42, new Date('2026-06-01T00:00:00.000Z'));
    expect(ledgerSync).toHaveBeenCalledTimes(1);
  });
});

describe('rescheduling', () => {
  it('records where the event started out', async () => {
    const { service, repo } = makeService();
    await service.rescheduleEvent('r1', 42, new Date('2026-06-01T00:00:00.000Z'));

    const data = repo.updateByNumber.mock.calls[0][2] as { originalEventDate: Date; eventDate: Date };
    expect(data.originalEventDate).toEqual(EVENT.eventDate);
    expect(data.eventDate.toISOString()).toBe('2026-06-01T00:00:00.000Z');
  });

  it('KEEPS the first original date across repeated moves', async () => {
    // Otherwise every reschedule rewrites history and the true origin is lost.
    const firstDate = new Date('2026-01-01T00:00:00.000Z');
    const { service, repo } = makeService({ ...EVENT, originalEventDate: firstDate, eventDate: new Date('2026-05-01T00:00:00.000Z') });

    await service.rescheduleEvent('r1', 42, new Date('2026-07-01T00:00:00.000Z'));
    expect((repo.updateByNumber.mock.calls[0][2] as { originalEventDate: Date }).originalEventDate).toEqual(firstDate);
  });
});

describe('editing an event', () => {
  it('leaves a hall alone when the payload does not mention it', async () => {
    // The difference between "not sent" and "cleared" matters: a partial edit
    // must not unassign the hall.
    const { service, repo } = makeService();
    await service.updateEvent('r1', 42, { guestCount: 200 } as never);
    expect(repo.updateByNumber.mock.calls[0][2]).not.toHaveProperty('hallId');
  });

  it('clears a hall when it is explicitly emptied', async () => {
    const { service, repo } = makeService();
    await service.updateEvent('r1', 42, { hallId: '' } as never);
    expect((repo.updateByNumber.mock.calls[0][2] as { hallId: null }).hallId).toBeNull();
  });

  it('treats the table categories and the debt deadline the same way', async () => {
    const { service, repo } = makeService();
    await service.updateEvent('r1', 42, {
      tableCategoryId: '', childrenTableCategoryId: '', debtDeadline: null,
    } as never);
    const data = repo.updateByNumber.mock.calls[0][2] as Record<string, unknown>;
    expect(data.tableCategoryId).toBeNull();
    expect(data.childrenTableCategoryId).toBeNull();
    expect(data.debtDeadline).toBeNull();
  });

  it('passes the menu selection through untouched', async () => {
    const { service, repo } = makeService();
    const menuConfig = { SOUPS: [{ id: 'm1', quantity: 2 }] };
    await service.updateEvent('r1', 42, { menuConfig } as never);
    expect((repo.updateByNumber.mock.calls[0][2] as { menuConfig: unknown }).menuConfig).toEqual(menuConfig);
  });
});

describe('a payment can never exceed the balance', () => {
  /**
   * Pushing an invoice past its total leaves it at a negative balance — money
   * the restaurant appears to owe the customer, arrived at by a typo. The cap is
   * computed from the STORED event, not from anything the caller sends: a client
   * that reports its own total is a client that sets its own limit.
   */
  const invoiced = (over: Record<string, unknown> = {}) => ({
    ...EVENT,
    guestCount: 100,
    depositCents: 0,
    tableCategory: { ratePerPerson: 10_000 },   // 100 × 10 000 = 1 000 000 tiyin
    selections: [],
    payments: [],
    ...over,
  });

  const serviceFor = (event: unknown) => {
    const repo = {
      getByNumber: vi.fn(async () => event),
      addPayment: vi.fn(async () => {}),
    } as unknown as EventRepository;
    return { service: new EventService(repo), repo: repo as unknown as { addPayment: ReturnType<typeof vi.fn> } };
  };

  it('takes a payment for exactly the outstanding balance', () => {
    const { service } = serviceFor(invoiced());
    return expect(service.addPayment('r1', 42, 1_000_000)).resolves.toBeDefined();
  });

  it('takes a smaller instalment', () => {
    const { service } = serviceFor(invoiced());
    return expect(service.addPayment('r1', 42, 400_000)).resolves.toBeDefined();
  });

  it('refuses one so'.concat("'", 'm over'), async () => {
    const { service, repo } = serviceFor(invoiced());
    await expect(service.addPayment('r1', 42, 1_000_100)).rejects.toMatchObject({ status: 400 });
    expect(repo.addPayment, 'the payment was written anyway').not.toHaveBeenCalled();
  });

  it('counts the deposit and earlier instalments towards the cap', () => {
    // 1 000 000 total, 300 000 deposit, 200 000 already paid → 500 000 left.
    const event = invoiced({ depositCents: 300_000, payments: [{ amountCents: 200_000 }] });
    const { service } = serviceFor(event);
    return Promise.all([
      expect(service.addPayment('r1', 42, 500_000)).resolves.toBeDefined(),
      expect(serviceFor(event).service.addPayment('r1', 42, 500_001)).rejects.toMatchObject({ status: 400 }),
    ]);
  });

  it('counts priced dish selections into the total', () => {
    const event = invoiced({ selections: [{ quantity: 2, unitPriceCents: 50_000 }] });   // +100 000
    const { service } = serviceFor(event);
    return expect(service.addPayment('r1', 42, 1_100_000)).resolves.toBeDefined();
  });

  it('refuses anything at all once the invoice is settled', async () => {
    const event = invoiced({ depositCents: 1_000_000 });
    await expect(serviceFor(event).service.addPayment('r1', 42, 1)).rejects.toMatchObject({ status: 400 });
  });

  it('still 404s for an event that does not exist, before any of this', () => {
    const { service } = serviceFor(null);
    return expect(service.addPayment('r1', 42, 1)).rejects.toMatchObject({ status: 404 });
  });
});

describe('the event payload', () => {
  const valid = {
    customerName: 'Aziz Karimov',
    customerPhone: '+998901234567',
    eventDate: '2026-05-01T18:00:00.000Z',
    guestCount: 120,
  };

  it('accepts a normal booking', () => {
    expect(createEventSchema.safeParse(valid).success).toBe(true);
  });

  it('accepts a COMPLETELY BLANK event, on purpose', () => {
    // Staff pencil a date in and fill the rest in later, so every core field is
    // optional and the controller defaults what is missing. If this ever starts
    // failing, someone has made the booking form refuse a half-taken phone call.
    expect(createEventSchema.safeParse({}).success).toBe(true);
  });

  it('still rejects a date that is not a date', () => {
    expect(createEventSchema.safeParse({ ...valid, eventDate: 'sometime' }).success).toBe(false);
    // …and insists on a full timestamp rather than a bare day, so the slot is
    // never ambiguous across timezones.
    expect(createEventSchema.safeParse({ ...valid, eventDate: '2026-05-01' }).success).toBe(false);
  });

  it('caps a customer name rather than letting a blob through', () => {
    expect(createEventSchema.safeParse({ ...valid, customerName: 'x'.repeat(121) }).success).toBe(false);
  });

  it('will not take a fractional or negative guest count', () => {
    expect(createEventSchema.safeParse({ ...valid, guestCount: 12.5 }).success).toBe(false);
    expect(createEventSchema.safeParse({ ...valid, guestCount: -1 }).success).toBe(false);
  });

  it('takes a head count of zero — the count often is not known yet', () => {
    // The tablet's Confirm button no longer requires one, so this is the shape
    // a booking taken over the phone actually arrives in.
    expect(createEventSchema.safeParse({ ...valid, guestCount: 0 }).success).toBe(true);
    expect(createEventSchema.safeParse({ ...valid, childrenCount: 0 }).success).toBe(true);
  });

  it('no longer stops at the old 5000 guess', () => {
    // That cap lived only here, so a bigger figure came back to the tablet as a
    // generic "Unable to create event" naming no field.
    for (const guestCount of [5001, 20_000, 2_147_483_647]) {
      expect(createEventSchema.safeParse({ ...valid, guestCount }).success, String(guestCount)).toBe(true);
      expect(updateEventSchema.safeParse({ guestCount }).success, `update ${guestCount}`).toBe(true);
    }
  });

  it('still refuses a number the Int column cannot hold', () => {
    // The remaining bound is the column's, not a policy: an overflow would be a
    // 500 with a Postgres message, which is worse than a 400.
    for (const guestCount of [2_147_483_648, Number.MAX_SAFE_INTEGER]) {
      expect(createEventSchema.safeParse({ ...valid, guestCount }).success, String(guestCount)).toBe(false);
      expect(createEventSchema.safeParse({ ...valid, childrenCount: guestCount }).success, String(guestCount)).toBe(false);
    }
  });

  it('takes money as whole tiyin only', () => {
    expect(createEventSchema.safeParse({ ...valid, depositCents: 150.5 }).success).toBe(false);
    expect(createEventSchema.safeParse({ ...valid, depositCents: 15000000 }).success).toBe(true);
  });
});
