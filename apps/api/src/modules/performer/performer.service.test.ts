import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminRole } from '@prisma/client';
import { isServiceRole, parseKind, KIND_ROLE } from './performer.kind.js';

const prismaMock = vi.hoisted(() => ({
  performerProfile: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  performerEvent: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  performerBooking: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), findMany: vi.fn(), count: vi.fn() },
  adminUser: { findUnique: vi.fn(), findMany: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock('../../db/prisma.js', () => ({ prisma: prismaMock }));

const { PerformerService } = await import('./performer.service.js');

let service: InstanceType<typeof PerformerService>;

beforeEach(() => {
  vi.clearAllMocks();
  service = new PerformerService();
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

const BOOKING = {
  performerId: 'p1',
  restaurantName: 'Registon',
  contactName: 'Aziz',
  phone: '+998901234567',
  eventDate: '2026-05-01',
  eventTime: '18:00',
};

describe('performers and hosts are one engine, two roles', () => {
  it('recognises both as service roles', () => {
    expect(isServiceRole(AdminRole.PERFORMER)).toBe(true);
    expect(isServiceRole(AdminRole.HOST)).toBe(true);
    expect(isServiceRole(AdminRole.EMPLOYEE)).toBe(false);
    expect(isServiceRole(AdminRole.ADMIN)).toBe(false);
  });

  it('defaults an unknown kind to performer, which is what older callers send', () => {
    expect(parseKind('host')).toBe('host');
    expect(parseKind('performer')).toBe('performer');
    for (const junk of [undefined, null, '', 'singer', 7]) expect(parseKind(junk)).toBe('performer');
  });

  it('maps each kind to exactly one role', () => {
    expect(KIND_ROLE.performer).toBe(AdminRole.PERFORMER);
    expect(KIND_ROLE.host).toBe(AdminRole.HOST);
  });
});

describe('dates are handled at UTC midnight', () => {
  // A bare `new Date('2026-05-01')` lands on the server's local midnight and
  // shifts the day for anyone east or west of it.
  it('stores a calendar entry\'s date at UTC midnight', async () => {
    prismaMock.performerEvent.create.mockResolvedValue({ id: 'e1' });
    await service.createEvent('p1', { eventDate: '2026-05-01', eventTime: '18:00', title: 'Wedding' } as never);
    const stored: Date = prismaMock.performerEvent.create.mock.calls[0][0].data.eventDate;
    expect(stored.toISOString()).toBe('2026-05-01T00:00:00.000Z');
  });

  it('rejects a date that is not a date', async () => {
    expect(await statusOf(() => service.createEvent('p1', {
      eventDate: 'tomorrow', eventTime: '18:00', title: 'x',
    } as never))).toBe(400);
  });

  it('asks the availability query for exactly one UTC day', async () => {
    prismaMock.adminUser.findMany.mockResolvedValue([]);
    prismaMock.performerEvent.findMany.mockResolvedValue([]);
    await service.listPublic('performer', '2026-05-01');

    const range = prismaMock.performerEvent.findMany.mock.calls[0][0].where.eventDate;
    expect(range.gte.toISOString()).toBe('2026-05-01T00:00:00.000Z');
    expect(range.lt.toISOString()).toBe('2026-05-02T00:00:00.000Z');
  });
});

describe('booking a host', () => {
  it('is refused server-side without a programme', async () => {
    // The disabled button in the form is a courtesy; this is the rule.
    prismaMock.adminUser.findUnique.mockResolvedValue({ id: 'p1', role: AdminRole.HOST });
    expect(await statusOf(() => service.createBooking(BOOKING as never))).toBe(400);
    expect(prismaMock.performerBooking.create).not.toHaveBeenCalled();
  });

  it('is refused when the programme is only whitespace', async () => {
    prismaMock.adminUser.findUnique.mockResolvedValue({ id: 'p1', role: AdminRole.HOST });
    expect(await statusOf(() => service.createBooking({ ...BOOKING, program: '   ' } as never))).toBe(400);
  });

  it('stores the programme when one is given', async () => {
    prismaMock.adminUser.findUnique.mockResolvedValue({ id: 'p1', role: AdminRole.HOST });
    prismaMock.performerBooking.create.mockResolvedValue({ id: 'b1' });
    await service.createBooking({ ...BOOKING, program: ' 18:00 toast\n19:00 dancing ' } as never);
    expect(prismaMock.performerBooking.create.mock.calls[0][0].data.program).toBe('18:00 toast\n19:00 dancing');
  });
});

describe('booking a performer', () => {
  it('needs no programme', async () => {
    prismaMock.adminUser.findUnique.mockResolvedValue({ id: 'p1', role: AdminRole.PERFORMER });
    prismaMock.performerBooking.create.mockResolvedValue({ id: 'b1' });
    await expect(service.createBooking(BOOKING as never)).resolves.toBeTruthy();
  });

  it('DROPS a programme sent for a performer rather than storing it', async () => {
    prismaMock.adminUser.findUnique.mockResolvedValue({ id: 'p1', role: AdminRole.PERFORMER });
    prismaMock.performerBooking.create.mockResolvedValue({ id: 'b1' });
    await service.createBooking({ ...BOOKING, program: 'a running order' } as never);
    expect(prismaMock.performerBooking.create.mock.calls[0][0].data.program).toBeNull();
  });

  it('cannot be aimed at someone who is neither a performer nor a host', async () => {
    prismaMock.adminUser.findUnique.mockResolvedValue({ id: 'x', role: AdminRole.ADMIN });
    expect(await statusOf(() => service.createBooking(BOOKING as never))).toBe(404);
  });

  it('404s on an id that does not exist', async () => {
    prismaMock.adminUser.findUnique.mockResolvedValue(null);
    expect(await statusOf(() => service.createBooking(BOOKING as never))).toBe(404);
  });
});

describe('answering a booking', () => {
  const pending = {
    id: 'b1', performerId: 'p1', status: 'PENDING',
    eventDate: new Date('2026-05-01T00:00:00.000Z'), eventTime: '18:00',
    restaurantName: 'Registon', note: 'outdoor', program: '18:00 toast',
  };

  it('creates the calendar entry in the SAME transaction as the acceptance', async () => {
    // Otherwise someone can be marked free for a date they have agreed to.
    prismaMock.performerBooking.findUnique.mockResolvedValue(pending);
    prismaMock.performerBooking.update.mockResolvedValue({ ...pending, status: 'ACCEPTED' });
    prismaMock.performerEvent.create.mockResolvedValue({ id: 'e1' });

    await service.decideBooking('p1', 'b1', 'ACCEPTED');

    expect(prismaMock.$transaction).toHaveBeenCalled();
    expect(prismaMock.performerEvent.create).toHaveBeenCalled();
  });

  it('carries the host\'s programme onto the calendar entry', async () => {
    prismaMock.performerBooking.findUnique.mockResolvedValue(pending);
    prismaMock.performerBooking.update.mockResolvedValue({ ...pending, status: 'ACCEPTED' });
    prismaMock.performerEvent.create.mockResolvedValue({ id: 'e1' });

    await service.decideBooking('p1', 'b1', 'ACCEPTED');

    expect(prismaMock.performerEvent.create.mock.calls[0][0].data).toMatchObject({
      performerId: 'p1', bookingId: 'b1', program: '18:00 toast', title: 'Registon',
    });
  });

  it('creates no calendar entry when declining', async () => {
    prismaMock.performerBooking.findUnique.mockResolvedValue(pending);
    prismaMock.performerBooking.update.mockResolvedValue({ ...pending, status: 'DECLINED' });
    await service.decideBooking('p1', 'b1', 'DECLINED');
    expect(prismaMock.performerEvent.create).not.toHaveBeenCalled();
  });

  it('refuses to answer somebody else\'s booking', async () => {
    prismaMock.performerBooking.findUnique.mockResolvedValue(pending);
    expect(await statusOf(() => service.decideBooking('other', 'b1', 'ACCEPTED'))).toBe(404);
  });

  it('refuses to answer the same request twice', async () => {
    prismaMock.performerBooking.findUnique.mockResolvedValue({ ...pending, status: 'ACCEPTED' });
    expect(await statusOf(() => service.decideBooking('p1', 'b1', 'DECLINED'))).toBe(409);
  });
});

describe('a calendar belongs to one performer', () => {
  const someoneElses = { id: 'e1', performerId: 'p1' };

  it('refuses to edit another performer\'s entry', async () => {
    prismaMock.performerEvent.findUnique.mockResolvedValue(someoneElses);
    expect(await statusOf(() => service.updateEvent('other', 'e1', { title: 'x' } as never))).toBe(404);
  });

  it('refuses to delete another performer\'s entry', async () => {
    prismaMock.performerEvent.findUnique.mockResolvedValue(someoneElses);
    expect(await statusOf(() => service.removeEvent('other', 'e1'))).toBe(404);
    expect(prismaMock.performerEvent.delete).not.toHaveBeenCalled();
  });
});

describe('the public listing', () => {
  const users = [
    { id: 'p2', username: 'zafar', performerProfile: { displayName: 'Zafar', avatarUrl: null, photos: ['a.jpg'], videos: [] } },
    { id: 'p1', username: 'aziz', performerProfile: null },
  ];

  it('is driven by the ROLE, so a profile-less account is still listed', async () => {
    // The role is what makes someone a performer; the profile is decoration.
    prismaMock.adminUser.findMany.mockResolvedValue(users);
    const listed = await service.listPublic('performer');
    expect(listed.map((p) => p.id)).toEqual(['p1', 'p2']); // sorted by display name
    expect(listed[0].displayName).toBe('aziz'); // falls back to the username
  });

  it('queries the role matching the kind asked for', async () => {
    prismaMock.adminUser.findMany.mockResolvedValue([]);
    await service.listPublic('host');
    expect(prismaMock.adminUser.findMany.mock.calls[0][0].where.role).toBe(AdminRole.HOST);
  });

  it('NEVER includes a phone number in the list', async () => {
    prismaMock.adminUser.findMany.mockResolvedValue([{
      id: 'p1', username: 'aziz',
      performerProfile: { displayName: 'Aziz', phone: '+998901234567', avatarUrl: null, photos: [], videos: [] },
    }]);
    const listed = await service.listPublic('performer');
    expect(JSON.stringify(listed)).not.toContain('998901234567');
  });

  it('leaves availability undefined when no date was asked for', async () => {
    // So the UI can tell "free" apart from "not asked".
    prismaMock.adminUser.findMany.mockResolvedValue(users);
    const listed = await service.listPublic('performer');
    expect(listed[0].available).toBeUndefined();
    expect(prismaMock.performerEvent.findMany).not.toHaveBeenCalled();
  });

  it('marks anyone with a calendar entry that day as busy', async () => {
    // One check covers both hand-entered commitments and accepted bookings,
    // because accepting a booking creates a calendar entry.
    prismaMock.adminUser.findMany.mockResolvedValue(users);
    prismaMock.performerEvent.findMany.mockResolvedValue([{ performerId: 'p2' }]);

    const listed = await service.listPublic('performer', '2026-05-01');
    expect(listed.find((p) => p.id === 'p1')!.available).toBe(true);
    expect(listed.find((p) => p.id === 'p2')!.available).toBe(false);
  });

  it('counts media without shipping it', async () => {
    prismaMock.adminUser.findMany.mockResolvedValue(users);
    const listed = await service.listPublic('performer');
    expect(listed.find((p) => p.id === 'p2')!.photoCount).toBe(1);
    expect(JSON.stringify(listed)).not.toContain('a.jpg');
  });
});

describe('the public profile', () => {
  it('does show the phone number, deliberately', async () => {
    // A guest browsing wants to call directly, not only book.
    prismaMock.adminUser.findUnique.mockResolvedValue({
      id: 'p1', username: 'aziz', role: AdminRole.PERFORMER,
      performerProfile: { displayName: 'Aziz', phone: '+998901234567', isVisible: true, photos: [], videos: [], bio: null, avatarUrl: null },
    });
    const profile = await service.getPublic('performer', 'p1');
    expect(profile.phone).toBe('+998901234567');
  });

  it('refuses to serve a host through the performers path', async () => {
    // Otherwise the two blocks bleed into each other.
    prismaMock.adminUser.findUnique.mockResolvedValue({ id: 'h1', username: 'h', role: AdminRole.HOST, performerProfile: null });
    expect(await statusOf(() => service.getPublic('performer', 'h1'))).toBe(404);
  });

  it('hides someone who switched their visibility off', async () => {
    prismaMock.adminUser.findUnique.mockResolvedValue({
      id: 'p1', username: 'aziz', role: AdminRole.PERFORMER,
      performerProfile: { displayName: 'Aziz', isVisible: false, photos: [], videos: [] },
    });
    expect(await statusOf(() => service.getPublic('performer', 'p1'))).toBe(404);
  });

  it('opens for an account whose profile row does not exist yet', async () => {
    prismaMock.adminUser.findUnique.mockResolvedValue({ id: 'p1', username: 'aziz', role: AdminRole.PERFORMER, performerProfile: null });
    const profile = await service.getPublic('performer', 'p1');
    expect(profile.displayName).toBe('aziz');
  });
});

describe('the profile row is created on first read', () => {
  it('so accounts made before the feature existed still work', async () => {
    prismaMock.performerProfile.findUnique.mockResolvedValue(null);
    prismaMock.adminUser.findUnique.mockResolvedValue({ username: 'aziz' });
    prismaMock.performerProfile.create.mockResolvedValue({ userId: 'p1', displayName: 'aziz' });

    await service.getOrCreateProfile('p1');
    expect(prismaMock.performerProfile.create.mock.calls[0][0].data).toEqual({ userId: 'p1', displayName: 'aziz' });
  });

  it('404s when the account itself is gone', async () => {
    prismaMock.performerProfile.findUnique.mockResolvedValue(null);
    prismaMock.adminUser.findUnique.mockResolvedValue(null);
    expect(await statusOf(() => service.getOrCreateProfile('ghost'))).toBe(404);
  });
});
