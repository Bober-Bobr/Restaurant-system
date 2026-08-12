import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminRole } from '@prisma/client';
import { createRestaurantSchema, MODULE_FIELDS } from './restaurant.schema.js';

// ── Module entitlements are billing state ───────────────────────────────────
// They decide what a restaurant has paid for. An OWNER may legitimately PATCH
// their own restaurant, so the guard cannot live in the route — it has to
// remove the fields from the payload. If this ever stops working, any owner can
// grant themselves the banquet, catering and add-ons modules for free.

const serviceMock = vi.hoisted(() => ({
  create: vi.fn(async (_id: string, data: unknown) => data),
  update: vi.fn(async (_id: string, _rid: string, data: unknown) => data),
  updateAsChief: vi.fn(async (_rid: string, data: unknown) => data),
  listAll: vi.fn(async () => []),
  listForOwner: vi.fn(async () => []),
  listForStaff: vi.fn(async () => []),
  listForStaffByUserId: vi.fn(async () => []),
  remove: vi.fn(async () => {}),
  removeAsChief: vi.fn(async () => {}),
}));

// The controller builds its service at module load, so both have to be
// constructible — hence classes rather than arrow mocks.
vi.mock('./restaurant.service.js', () => ({ RestaurantService: class { constructor() { return serviceMock; } } }));
vi.mock('./restaurant.repository.js', () => ({ RestaurantRepository: class {} }));

const { RestaurantController } = await import('./restaurant.controller.js');

const controller = new RestaurantController();

function fakeRequest(role: AdminRole, body: Record<string, unknown>) {
  return { admin: { id: 'u1', role, restaurantId: 'r1' }, body, params: { id: 'r1' } } as never;
}
const fakeResponse = () => ({ json: vi.fn(), status: vi.fn().mockReturnThis(), send: vi.fn() }) as never;

const PAYLOAD_WITH_MODULES = {
  name: 'Registon',
  moduleBanquet: true,
  moduleCatering: true,
  moduleAddons: true,
};

beforeEach(() => vi.clearAllMocks());

describe('granting a paid module', () => {
  const OTHERS = [AdminRole.OWNER, AdminRole.MANAGER, AdminRole.ADMIN, AdminRole.CATERING_ADMIN, AdminRole.EMPLOYEE];

  for (const role of OTHERS) {
    it(`strips the module fields from a ${role}'s create`, async () => {
      await controller.create(fakeRequest(role, PAYLOAD_WITH_MODULES), fakeResponse());
      const written = serviceMock.create.mock.calls[0][1] as Record<string, unknown>;
      for (const field of MODULE_FIELDS) expect(written).not.toHaveProperty(field);
      // …while keeping everything the caller is allowed to set.
      expect(written.name).toBe('Registon');
    });

    it(`strips them from a ${role}'s update`, async () => {
      await controller.update(fakeRequest(role, PAYLOAD_WITH_MODULES), fakeResponse());
      const call = serviceMock.update.mock.calls[0] ?? serviceMock.updateAsChief.mock.calls[0];
      const written = call[call.length - 1] as Record<string, unknown>;
      for (const field of MODULE_FIELDS) expect(written).not.toHaveProperty(field);
    });
  }

  it('lets the CHIEF_ADMIN set them, since that is the whole point', async () => {
    await controller.update(fakeRequest(AdminRole.CHIEF_ADMIN, PAYLOAD_WITH_MODULES), fakeResponse());
    const written = serviceMock.updateAsChief.mock.calls[0][1] as Record<string, unknown>;
    expect(written).toMatchObject({ moduleBanquet: true, moduleCatering: true, moduleAddons: true });
  });

  it('strips rather than rejects, so an ordinary save still works', async () => {
    // An owner's restaurant form may echo the fields back; refusing the whole
    // request would break saving a phone number.
    const response = fakeResponse();
    await controller.update(fakeRequest(AdminRole.OWNER, { ...PAYLOAD_WITH_MODULES, phone: '+998901234567' }), response);
    const written = serviceMock.update.mock.calls[0][2] as Record<string, unknown>;
    expect(written.phone).toBe('+998901234567');
    expect(response.json).toHaveBeenCalled();
  });

  it('strips a module set to FALSE too, not only one set to true', async () => {
    // Revoking is as much a billing decision as granting.
    await controller.update(fakeRequest(AdminRole.OWNER, { moduleBanquet: false }), fakeResponse());
    expect(serviceMock.update.mock.calls[0][2]).not.toHaveProperty('moduleBanquet');
  });
});

describe('the restaurant payload itself', () => {
  it('rejects a colour that is not a hex colour', () => {
    expect(createRestaurantSchema.safeParse({ tabletAccentColor: 'red' }).success).toBe(false);
    expect(createRestaurantSchema.safeParse({ tabletAccentColor: '#c6f24e' }).success).toBe(true);
    expect(createRestaurantSchema.safeParse({ tabletAccentColor: '#abc' }).success).toBe(true);
  });

  it('allows a colour to be cleared', () => {
    expect(createRestaurantSchema.safeParse({ tabletAccentColor: null }).success).toBe(true);
  });

  it('allows a nameless restaurant, which inherits its company name', () => {
    expect(createRestaurantSchema.safeParse({}).success).toBe(true);
  });

  it('caps the free-text fields', () => {
    expect(createRestaurantSchema.safeParse({ name: 'x'.repeat(151) }).success).toBe(false);
    expect(createRestaurantSchema.safeParse({ history: 'x'.repeat(5001) }).success).toBe(false);
  });
});
