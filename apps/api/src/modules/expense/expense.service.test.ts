import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExpenseService } from './expense.service.js';
import type { ExpenseRepository } from './expense.repository.js';

// ── One manager may not touch another manager's ledger ──────────────────────
// Every mutation on this service is scoped by managerId. There is no other
// guard: the routes are open to any RESTAURANT_MANAGER, so a missing check here
// is a manager editing somebody else's books. This walks every method.

const MINE = 'manager-1';
const THEIRS = 'manager-2';

function makeRepo(owner: string) {
  // Every ownership question answers with `owner`, so pointing a test at
  // THEIRS makes every check fail and MINE makes every check pass.
  const repo = {
    findDayById: vi.fn(async (id: string) => ({ id, managerId: owner, events: [], date: '2026-08-12' })),
    latestDay: vi.fn(async () => null),
    findDay: vi.fn(async () => null),
    createDay: vi.fn(async (_m: string, date: string) => ({ id: 'd1', date, events: [] })),
    cloneLines: vi.fn(async () => {}),
    listByIds: vi.fn(async () => []),
    reopenDay: vi.fn(async (id: string) => ({ id })),
    closeDay: vi.fn(async (id: string) => ({ id })),
    updateDay: vi.fn(async (id: string) => ({ id })),
    deleteDay: vi.fn(async () => {}),
    updateEvent: vi.fn(async (id: string) => ({ id })),
    ownerOfEvent: vi.fn(async () => owner),
    ownerOfProduct: vi.fn(async () => owner),
    ownerOfSalary: vi.fn(async () => owner),
    ownerOfAdditional: vi.fn(async () => owner),
    ownerOfService: vi.fn(async () => owner),
    ownerOfExtra: vi.fn(async () => owner),
    createProduct: vi.fn(async () => ({ id: 'p1' })), updateProduct: vi.fn(async () => ({ id: 'p1' })), deleteProduct: vi.fn(async () => {}),
    createSalary: vi.fn(async () => ({ id: 's1' })), updateSalary: vi.fn(async () => ({ id: 's1' })), deleteSalary: vi.fn(async () => {}),
    createAdditional: vi.fn(async () => ({ id: 'a1' })), updateAdditional: vi.fn(async () => ({ id: 'a1' })), deleteAdditional: vi.fn(async () => {}),
    createService: vi.fn(async () => ({ id: 'v1' })), updateService: vi.fn(async () => ({ id: 'v1' })), deleteService: vi.fn(async () => {}),
    createExtra: vi.fn(async () => ({ id: 'x1' })), updateExtra: vi.fn(async () => ({ id: 'x1' })), deleteExtra: vi.fn(async () => {}),
    listDays: vi.fn(async () => []),
  };
  return repo as unknown as ExpenseRepository & typeof repo;
}

const LINE = { name: 'Meat', amountSum: 1000 };

/** Every mutation, as a call anyone could make with an id they guessed. */
const MUTATIONS: { name: string; run: (s: ExpenseService, id: string) => Promise<unknown> }[] = [
  { name: 'updateDay', run: (s, id) => s.updateDay(MINE, id, {} as never) },
  { name: 'closeDay', run: (s, id) => s.closeDay(MINE, id) },
  { name: 'reopenDay', run: (s, id) => s.reopenDay(MINE, id) },
  { name: 'removeDay', run: (s, id) => s.removeDay(MINE, id) },
  { name: 'eventSelectionForExport', run: (s, id) => s.eventSelectionForExport(MINE, id, []) },
  { name: 'updateEvent', run: (s, id) => s.updateEvent(MINE, id, {} as never) },
  { name: 'addProduct', run: (s, id) => s.addProduct(MINE, id, LINE as never) },
  { name: 'updateProduct', run: (s, id) => s.updateProduct(MINE, id, LINE as never) },
  { name: 'removeProduct', run: (s, id) => s.removeProduct(MINE, id) },
  { name: 'addSalary', run: (s, id) => s.addSalary(MINE, id, LINE) },
  { name: 'updateSalary', run: (s, id) => s.updateSalary(MINE, id, LINE) },
  { name: 'removeSalary', run: (s, id) => s.removeSalary(MINE, id) },
  { name: 'addAdditional', run: (s, id) => s.addAdditional(MINE, id, LINE) },
  { name: 'updateAdditional', run: (s, id) => s.updateAdditional(MINE, id, LINE) },
  { name: 'removeAdditional', run: (s, id) => s.removeAdditional(MINE, id) },
  { name: 'addService', run: (s, id) => s.addService(MINE, id, LINE) },
  { name: 'updateService', run: (s, id) => s.updateService(MINE, id, LINE) },
  { name: 'removeService', run: (s, id) => s.removeService(MINE, id) },
  { name: 'addExtra', run: (s, id) => s.addExtra(MINE, id, LINE) },
  { name: 'updateExtra', run: (s, id) => s.updateExtra(MINE, id, LINE) },
  { name: 'removeExtra', run: (s, id) => s.removeExtra(MINE, id) },
];

describe('expense ledger ownership', () => {
  for (const { name, run } of MUTATIONS) {
    it(`${name} refuses a row belonging to another manager`, async () => {
      const service = new ExpenseService(makeRepo(THEIRS));
      const error = await run(service, 'someone-elses-id').catch((e) => e);
      // 404, not 403: a manager has no business learning the id exists.
      expect(error.status).toBe(404);
    });

    it(`${name} allows the manager's own row`, async () => {
      const service = new ExpenseService(makeRepo(MINE));
      await expect(run(service, 'my-id')).resolves.not.toThrow();
    });
  }
});

describe('creating the next ledger day', () => {
  let repo: ReturnType<typeof makeRepo>;
  let service: ExpenseService;

  beforeEach(() => {
    repo = makeRepo(MINE);
    service = new ExpenseService(repo);
  });

  it('returns the existing day instead of creating a second one', async () => {
    const existing = { id: 'already-there', managerId: MINE, date: '2026-08-12', events: [] };
    repo.findDay = vi.fn(async () => existing) as never;
    await expect(service.createDay(MINE, '2026-08-12')).resolves.toBe(existing);
    expect(repo.createDay).not.toHaveBeenCalled();
  });

  it('follows the day after the latest one when no date is given', async () => {
    repo.latestDay = vi.fn(async () => ({ id: 'd0', date: '2026-08-12', events: [] })) as never;
    await service.createDay(MINE);
    expect(repo.createDay).toHaveBeenCalledWith(MINE, '2026-08-13');
  });

  it('steps over a month boundary correctly', async () => {
    repo.latestDay = vi.fn(async () => ({ id: 'd0', date: '2026-01-31', events: [] })) as never;
    await service.createDay(MINE);
    expect(repo.createDay).toHaveBeenCalledWith(MINE, '2026-02-01');
  });

  it('steps over a leap day correctly', async () => {
    repo.latestDay = vi.fn(async () => ({ id: 'd0', date: '2028-02-28', events: [] })) as never;
    await service.createDay(MINE);
    expect(repo.createDay).toHaveBeenCalledWith(MINE, '2028-02-29');
  });

  it('copies the previous day\'s line NAMES but none of its numbers', async () => {
    // The point of the carry-over: the structure repeats daily, the figures do not.
    repo.latestDay = vi.fn(async () => ({
      id: 'd0', date: '2026-08-12',
      events: [{
        id: 'e0', type: 'MORNING',
        products: [{ name: 'Meat', unit: 'kg', amountSum: 500000, quantity: 12 }],
        salaries: [{ name: 'Cooks', amountSum: 300000 }],
        additionals: [{ name: 'Taxi', amountSum: 50000 }],
        services: [{ name: 'Host', amountSum: 900000 }],
      }],
    })) as never;
    repo.createDay = vi.fn(async (_m: string, date: string) => ({
      id: 'd1', date, events: [{ id: 'e1', type: 'MORNING' }],
    })) as never;

    await service.createDay(MINE, '2026-08-13');

    expect(repo.cloneLines).toHaveBeenCalledWith(
      'e1',
      [{ name: 'Meat', unit: 'kg' }],
      [{ name: 'Cooks' }],
      [{ name: 'Taxi' }],
      [{ name: 'Host' }],
    );
  });

  it('does not clone from a department that had nothing in it', async () => {
    repo.latestDay = vi.fn(async () => ({
      id: 'd0', date: '2026-08-12',
      events: [{ id: 'e0', type: 'MORNING', products: [], salaries: [], additionals: [], services: [] }],
    })) as never;
    repo.createDay = vi.fn(async (_m: string, date: string) => ({
      id: 'd1', date, events: [{ id: 'e1', type: 'MORNING' }],
    })) as never;

    await service.createDay(MINE, '2026-08-13');
    expect(repo.cloneLines).not.toHaveBeenCalled();
  });
});
