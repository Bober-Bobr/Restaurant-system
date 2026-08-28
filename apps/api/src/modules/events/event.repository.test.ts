import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `create` reads the restaurant's highest event number and then writes the next
 * one. Two bookings taken in the same second therefore compute the same number,
 * and the database refuses one of them. This covers the repository against a
 * fake Postgres that enforces exactly the constraint the schema now declares:
 * unique per (restaurantId, eventNumber), and nothing wider.
 */
type Row = { id: string; restaurantId: string | null; eventNumber: number };

const store = vi.hoisted(() => ({ rows: [] as Row[], onBeforeCreate: null as null | (() => void) }));

const uniqueViolation = () =>
  Object.assign(new Error('Unique constraint failed'), {
    code: 'P2002',
    meta: { target: ['restaurantId', 'eventNumber'] },
  });

vi.mock('../../db/prisma.js', () => ({
  prisma: {
    event: {
      findFirst: async ({ where }: { where: { restaurantId?: string; eventNumber?: number } }) =>
        store.rows
          .filter(
            (r) =>
              (where.restaurantId === undefined || r.restaurantId === where.restaurantId) &&
              (where.eventNumber === undefined || r.eventNumber === where.eventNumber),
          )
          .sort((a, b) => b.eventNumber - a.eventNumber)[0] ?? null,
      create: async ({ data }: { data: Row }) => {
        store.onBeforeCreate?.();
        const clash = store.rows.some(
          (r) => r.restaurantId === data.restaurantId && r.eventNumber === data.eventNumber,
        );
        if (clash) throw uniqueViolation();
        const row = { ...data, id: `id-${store.rows.length + 1}` };
        store.rows.push(row);
        return row;
      },
    },
  },
}));

const { EventRepository } = await import('./event.repository.js');

const PAYLOAD = { customerName: 'Aziz', eventDate: new Date('2026-05-01'), guestCount: 100 };

beforeEach(() => {
  store.rows = [];
  store.onBeforeCreate = null;
});

describe('allocating an event number', () => {
  it('counts from 1 within each restaurant, independently', async () => {
    // The bug this replaces: restaurant B's first booking was refused outright
    // because restaurant A already owned event 1.
    const repo = new EventRepository();
    expect((await repo.create('r-a', PAYLOAD)).eventNumber).toBe(1);
    expect((await repo.create('r-a', PAYLOAD)).eventNumber).toBe(2);
    expect((await repo.create('r-b', PAYLOAD)).eventNumber).toBe(1);
    expect((await repo.create('r-b', PAYLOAD)).eventNumber).toBe(2);
  });

  it('a restaurant well behind another still books', async () => {
    store.rows = Array.from({ length: 40 }, (_, i) => ({ id: `a${i}`, restaurantId: 'r-a', eventNumber: i + 1 }));
    store.rows.push({ id: 'b1', restaurantId: 'r-b', eventNumber: 12 });
    const created = await new EventRepository().create('r-b', PAYLOAD);
    expect(created.eventNumber).toBe(13); // taken by r-a, and that is fine
  });

  it('takes the next number when someone else wins the race', async () => {
    // Simulate a concurrent insert landing between our read and our write.
    const repo = new EventRepository();
    let raced = false;
    store.onBeforeCreate = () => {
      if (raced) return;
      raced = true;
      store.rows.push({ id: 'other', restaurantId: 'r-a', eventNumber: 1 });
    };
    expect((await repo.create('r-a', PAYLOAD)).eventNumber).toBe(2);
  });

  it('gives up rather than spinning forever', async () => {
    // A constraint that refuses every number is a real fault, and must surface.
    store.onBeforeCreate = () => {
      throw uniqueViolation();
    };
    await expect(new EventRepository().create('r-a', PAYLOAD)).rejects.toMatchObject({ code: 'P2002' });
  });

  it('does not retry an unrelated failure', async () => {
    const create = vi.fn(() => {
      throw new Error('connection lost');
    });
    store.onBeforeCreate = create;
    await expect(new EventRepository().create('r-a', PAYLOAD)).rejects.toThrow('connection lost');
    expect(create).toHaveBeenCalledTimes(1);
  });
});
