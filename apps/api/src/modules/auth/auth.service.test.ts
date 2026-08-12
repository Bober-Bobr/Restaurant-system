import { AdminRole } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { beforeEach, describe, expect, it } from 'vitest';
import { AuthService, canManageFoodEmployees } from './auth.service.js';
import { FakeAuthRepository, hashSync } from '../../test/fakeAuthRepository.js';

// ── Signing in, and who may create whom ─────────────────────────────────────
// These are the rules a wrong answer to which either locks a paying restaurant
// out or hands someone an account they should not have.

const PASSWORD = 'correct horse battery';

let repo: FakeAuthRepository;
let service: AuthService;

beforeEach(() => {
  repo = new FakeAuthRepository();
  service = new AuthService(repo.asRepository());
});

/** The failure every auth test cares about: which status, and what it said. */
async function statusOf(run: () => Promise<unknown>): Promise<number> {
  try {
    await run();
  } catch (error) {
    return (error as { status?: number }).status ?? 0;
  }
  throw new Error('expected the call to be refused, but it succeeded');
}

describe('login', () => {
  it('signs a valid user in and returns their restaurant', async () => {
    const restaurant = repo.addRestaurant({ name: 'Registon' });
    repo.addUser({ username: 'admin', passwordHash: hashSync(PASSWORD), role: AdminRole.ADMIN, restaurantId: restaurant.id });

    const result = await service.login('admin', PASSWORD);

    expect(result.username).toBe('admin');
    expect(result.role).toBe(AdminRole.ADMIN);
    expect(result.restaurantId).toBe(restaurant.id);
    expect(result.restaurantName).toBe('Registon');
    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBeTruthy();
  });

  it('rejects a wrong password', async () => {
    repo.addUser({ username: 'admin', passwordHash: hashSync(PASSWORD), role: AdminRole.ADMIN });
    expect(await statusOf(() => service.login('admin', 'wrong'))).toBe(401);
  });

  it('rejects an unknown username with the SAME error as a wrong password', async () => {
    repo.addUser({ username: 'admin', passwordHash: hashSync(PASSWORD), role: AdminRole.ADMIN });
    // Distinguishable errors would tell an attacker which usernames exist.
    const unknown = await service.login('nobody', PASSWORD).catch((e) => e);
    const wrongPassword = await service.login('admin', 'wrong').catch((e) => e);
    expect(unknown.status).toBe(401);
    expect(unknown.message).toBe(wrongPassword.message);
  });

  it('issues an access token carrying the identity the rest of the API trusts', async () => {
    const restaurant = repo.addRestaurant({ name: 'Registon' });
    const user = repo.addUser({ username: 'chef', passwordHash: hashSync(PASSWORD), role: AdminRole.KITCHEN, restaurantId: restaurant.id });

    const { accessToken } = await service.login('chef', PASSWORD);
    const claims = jwt.decode(accessToken) as Record<string, unknown>;

    expect(claims.sub).toBe(user.id);
    expect(claims.role).toBe(AdminRole.KITCHEN);
    expect(claims.restaurantId).toBe(restaurant.id);
    // v-menu tokens are typed so they can never be accepted as v-invite ones.
    expect(claims.type).toBe('access');
    expect(claims.sid).toBeTruthy();
  });

  it('records a session on login so the device can be revoked later', async () => {
    repo.addUser({ username: 'admin', passwordHash: hashSync(PASSWORD), role: AdminRole.ADMIN });
    await service.login('admin', PASSWORD, { userAgent: 'Chrome', ipAddress: '10.0.0.1' });

    expect(repo.sessions).toHaveLength(1);
    expect(repo.sessions[0].userAgent).toBe('Chrome');
    // The refresh token is stored hashed, never in the clear.
    expect(repo.sessions[0].refreshTokenHash).toMatch(/^\$2[aby]\$/);
  });
});

describe('module entitlements gate the login', () => {
  // The paid modules are what a restaurant buys; a role that exists only
  // because of one must not work when it is revoked.
  const CASES: { role: AdminRole; needs: 'moduleBanquet' | 'moduleCatering' }[] = [
    { role: AdminRole.ADMIN, needs: 'moduleBanquet' },
    { role: AdminRole.EMPLOYEE, needs: 'moduleBanquet' },
    { role: AdminRole.KITCHEN, needs: 'moduleBanquet' },
    { role: AdminRole.CATERING_ADMIN, needs: 'moduleCatering' },
    { role: AdminRole.CATERING_EMPLOYEE, needs: 'moduleCatering' },
  ];

  for (const { role, needs } of CASES) {
    it(`refuses ${role} when ${needs} is off`, async () => {
      const restaurant = repo.addRestaurant({ name: 'Registon', moduleBanquet: false, moduleCatering: false });
      repo.addUser({ username: 'u', passwordHash: hashSync(PASSWORD), role, restaurantId: restaurant.id });
      expect(await statusOf(() => service.login('u', PASSWORD))).toBe(403);
    });

    it(`allows ${role} when ${needs} is on`, async () => {
      const restaurant = repo.addRestaurant({
        name: 'Registon',
        moduleBanquet: needs === 'moduleBanquet',
        moduleCatering: needs === 'moduleCatering',
      });
      repo.addUser({ username: 'u', passwordHash: hashSync(PASSWORD), role, restaurantId: restaurant.id });
      await expect(service.login('u', PASSWORD)).resolves.toBeTruthy();
    });
  }

  const UNGATED = [AdminRole.CHIEF_ADMIN, AdminRole.MANAGER, AdminRole.OWNER, AdminRole.RESTAURANT_MANAGER, AdminRole.NFC_MAKER, AdminRole.PERFORMER, AdminRole.HOST];
  for (const role of UNGATED) {
    it(`never gates ${role}, who belongs to no module`, async () => {
      const restaurant = repo.addRestaurant({ name: 'Registon', moduleBanquet: false, moduleCatering: false });
      repo.addUser({ username: 'u', passwordHash: hashSync(PASSWORD), role, restaurantId: restaurant.id });
      await expect(service.login('u', PASSWORD)).resolves.toBeTruthy();
    });
  }

  it('lets a user with no restaurant through — other guards handle that', async () => {
    repo.addUser({ username: 'u', passwordHash: hashSync(PASSWORD), role: AdminRole.ADMIN, restaurantId: null });
    await expect(service.login('u', PASSWORD)).resolves.toBeTruthy();
  });
});

describe('refresh', () => {
  async function loginAndSession() {
    const restaurant = repo.addRestaurant({ name: 'Registon' });
    repo.addUser({ username: 'admin', passwordHash: hashSync(PASSWORD), role: AdminRole.ADMIN, restaurantId: restaurant.id });
    const login = await service.login('admin', PASSWORD);
    const sessionId = (jwt.decode(login.accessToken) as { sid: string }).sid;
    return { restaurant, login, sessionId };
  }

  it('exchanges a valid refresh token for a new access token', async () => {
    const { login, sessionId } = await loginAndSession();
    const refreshed = await service.refreshAccessToken(sessionId, login.refreshToken);
    expect(refreshed.accessToken).toBeTruthy();
    expect(refreshed.role).toBe(AdminRole.ADMIN);
  });

  it('reuses the session rather than piling up a new one per refresh', async () => {
    const { login, sessionId } = await loginAndSession();
    await service.refreshAccessToken(sessionId, login.refreshToken);
    expect(repo.sessions).toHaveLength(1);
  });

  it('rejects a refresh token that does not match the session', async () => {
    const { sessionId } = await loginAndSession();
    expect(await statusOf(() => service.refreshAccessToken(sessionId, 'forged'))).toBe(401);
  });

  it('rejects a session that no longer exists', async () => {
    const { login } = await loginAndSession();
    expect(await statusOf(() => service.refreshAccessToken('gone', login.refreshToken))).toBe(401);
  });

  it('REVOKING A MODULE ENDS A LIVE SESSION at the next refresh', async () => {
    // The whole reason the gate runs on refresh and not only on login: without
    // this, a revoked module would keep working until the user signed out.
    const { restaurant, login, sessionId } = await loginAndSession();
    restaurant.moduleBanquet = false;
    expect(await statusOf(() => service.refreshAccessToken(sessionId, login.refreshToken))).toBe(403);
  });
});

describe('logout and session revocation', () => {
  it('deletes the session', async () => {
    repo.addUser({ id: 'u1', username: 'admin', passwordHash: hashSync(PASSWORD), role: AdminRole.ADMIN });
    const login = await service.login('admin', PASSWORD);
    const sessionId = (jwt.decode(login.accessToken) as { sid: string }).sid;

    await service.logout(sessionId);
    expect(repo.sessions).toHaveLength(0);
  });

  it('treats logging out of an already-gone session as success', async () => {
    await expect(service.logout('never-existed')).resolves.toBeUndefined();
  });

  it('refuses to revoke somebody else\'s session', async () => {
    repo.addUser({ id: 'u1', username: 'a', passwordHash: hashSync(PASSWORD), role: AdminRole.ADMIN });
    repo.addUser({ id: 'u2', username: 'b', passwordHash: hashSync(PASSWORD), role: AdminRole.ADMIN });
    const login = await service.login('a', PASSWORD);
    const sessionId = (jwt.decode(login.accessToken) as { sid: string }).sid;

    expect(await statusOf(() => service.revokeSession('u2', sessionId))).toBe(404);
    expect(repo.sessions).toHaveLength(1);
  });

  it('marks which session is the current one', async () => {
    const user = repo.addUser({ id: 'u1', username: 'a', passwordHash: hashSync(PASSWORD), role: AdminRole.ADMIN });
    await service.login('a', PASSWORD);
    const second = await service.login('a', PASSWORD);
    const currentId = (jwt.decode(second.accessToken) as { sid: string }).sid;

    const sessions = await service.listSessions(user.id, currentId);
    expect(sessions.filter((s) => s.isCurrent)).toHaveLength(1);
    expect(sessions.find((s) => s.isCurrent)!.id).toBe(currentId);
  });
});

describe('self-signup', () => {
  it('creates the restaurant with the banquet module on', async () => {
    // Without it the account it just made could not sign back in — the login
    // gate above would refuse the ADMIN it created.
    const result = await service.register('owner', PASSWORD, { restaurantName: 'New Place' });
    expect(result.role).toBe(AdminRole.ADMIN);
    const restaurant = repo.restaurants.find((r) => r.name === 'New Place')!;
    expect(restaurant.moduleBanquet).toBe(true);
    await expect(service.login('owner', PASSWORD)).resolves.toBeTruthy();
  });

  it('refuses a duplicate username', async () => {
    repo.addUser({ username: 'taken', role: AdminRole.ADMIN });
    expect(await statusOf(() => service.register('taken', PASSWORD, { restaurantName: 'X' }))).toBe(409);
  });

  it('refuses a restaurant name that already exists', async () => {
    repo.addRestaurant({ name: 'Registon' });
    expect(await statusOf(() => service.register('new', PASSWORD, { restaurantName: 'Registon' }))).toBe(409);
  });

  it('requires a restaurant name for a restaurant-scoped role', async () => {
    expect(await statusOf(() => service.register('new', PASSWORD, {}))).toBe(400);
  });

  it('stores the password hashed, never in the clear', async () => {
    await service.register('owner', PASSWORD, { restaurantName: 'New Place' });
    const user = repo.users.find((u) => u.username === 'owner')!;
    expect(user.passwordHash).not.toContain(PASSWORD);
    expect(user.passwordHash).toMatch(/^\$2[aby]\$/);
  });
});

describe('who may create which accounts', () => {
  const OWNER = { id: 'owner1', role: AdminRole.OWNER, restaurantId: null };

  it('an OWNER may staff a restaurant they own', async () => {
    const restaurant = repo.addRestaurant({ name: 'Registon', ownerId: 'owner1' });
    const created = await service.createUserAsChief(OWNER, {
      username: 'waiter', password: PASSWORD, role: AdminRole.CATERING_EMPLOYEE, restaurantId: restaurant.id,
    });
    expect(created.role).toBe(AdminRole.CATERING_EMPLOYEE);
    expect(created.restaurantId).toBe(restaurant.id);
  });

  it('an OWNER may not assign a restaurant they do not own', async () => {
    const other = repo.addRestaurant({ name: 'Someone Else', ownerId: 'owner2' });
    expect(await statusOf(() => service.createUserAsChief(OWNER, {
      username: 'waiter', password: PASSWORD, role: AdminRole.EMPLOYEE, restaurantId: other.id,
    }))).toBe(403);
  });

  for (const role of [AdminRole.OWNER, AdminRole.CHIEF_ADMIN, AdminRole.MANAGER]) {
    it(`an OWNER may not create a ${role}`, async () => {
      expect(await statusOf(() => service.createUserAsChief(OWNER, {
        username: 'x', password: PASSWORD, role,
      }))).toBe(403);
    });
  }

  it('an OWNER must tie a RESTAURANT_MANAGER to a restaurant', async () => {
    // Otherwise the manager's events never reach any expense ledger.
    expect(await statusOf(() => service.createUserAsChief(OWNER, {
      username: 'rm', password: PASSWORD, role: AdminRole.RESTAURANT_MANAGER, restaurantId: null,
    }))).toBe(400);
  });

  describe('the two staff sides do not overlap', () => {
    it('a banquet ADMIN may create an EMPLOYEE', async () => {
      const restaurant = repo.addRestaurant({ name: 'Registon' });
      const caller = { id: 'a1', role: AdminRole.ADMIN, restaurantId: restaurant.id };
      const created = await service.createUserAsChief(caller, { username: 'e', password: PASSWORD, role: AdminRole.EMPLOYEE });
      expect(created.restaurantId).toBe(restaurant.id);
    });

    it('a banquet ADMIN may NOT create a Food Employee', async () => {
      const restaurant = repo.addRestaurant({ name: 'Registon' });
      const caller = { id: 'a1', role: AdminRole.ADMIN, restaurantId: restaurant.id };
      expect(await statusOf(() => service.createUserAsChief(caller, {
        username: 'w', password: PASSWORD, role: AdminRole.CATERING_EMPLOYEE,
      }))).toBe(403);
    });

    it('a Food Admin may create a Food Employee', async () => {
      const restaurant = repo.addRestaurant({ name: 'Registon' });
      const caller = { id: 'c1', role: AdminRole.CATERING_ADMIN, restaurantId: restaurant.id };
      const created = await service.createUserAsChief(caller, {
        username: 'w', password: PASSWORD, role: AdminRole.CATERING_EMPLOYEE,
      });
      expect(created.restaurantId).toBe(restaurant.id);
    });

    it('a Food Admin may NOT create a banquet EMPLOYEE', async () => {
      const restaurant = repo.addRestaurant({ name: 'Registon' });
      const caller = { id: 'c1', role: AdminRole.CATERING_ADMIN, restaurantId: restaurant.id };
      expect(await statusOf(() => service.createUserAsChief(caller, {
        username: 'e', password: PASSWORD, role: AdminRole.EMPLOYEE,
      }))).toBe(403);
    });

    it('a Food Admin may NOT create a performer', async () => {
      const restaurant = repo.addRestaurant({ name: 'Registon' });
      const caller = { id: 'c1', role: AdminRole.CATERING_ADMIN, restaurantId: restaurant.id };
      expect(await statusOf(() => service.createUserAsChief(caller, {
        username: 'p', password: PASSWORD, role: AdminRole.PERFORMER,
      }))).toBe(403);
    });
  });

  it('an ADMIN with no restaurant cannot create staff at all', async () => {
    const caller = { id: 'a1', role: AdminRole.ADMIN, restaurantId: null };
    repo.addUser({ id: 'a1', username: 'a', role: AdminRole.ADMIN, restaurantId: null });
    expect(await statusOf(() => service.createUserAsChief(caller, {
      username: 'e', password: PASSWORD, role: AdminRole.EMPLOYEE,
    }))).toBe(400);
  });

  it('an ADMIN cannot smuggle staff into another restaurant', async () => {
    const mine = repo.addRestaurant({ name: 'Mine' });
    const theirs = repo.addRestaurant({ name: 'Theirs' });
    const caller = { id: 'a1', role: AdminRole.ADMIN, restaurantId: mine.id };
    const created = await service.createUserAsChief(caller, {
      username: 'e', password: PASSWORD, role: AdminRole.EMPLOYEE, restaurantId: theirs.id,
    });
    expect(created.restaurantId).toBe(mine.id);
  });

  for (const role of [AdminRole.PERFORMER, AdminRole.HOST]) {
    it(`a ${role} is never tied to the restaurant that created them`, async () => {
      // They are a platform-wide pool any venue can book, not staff of the
      // venue that happened to sign them up.
      const restaurant = repo.addRestaurant({ name: 'Registon' });
      const caller = { id: 'a1', role: AdminRole.ADMIN, restaurantId: restaurant.id };
      const created = await service.createUserAsChief(caller, {
        username: 'p', password: PASSWORD, role, restaurantId: restaurant.id,
      });
      expect(created.restaurantId).toBeNull();
    });
  }

  it('refuses a role the restaurant has not bought the module for', async () => {
    // Creating it would mint an account that is refused at its first login.
    const restaurant = repo.addRestaurant({ name: 'Registon', moduleBanquet: false });
    expect(await statusOf(() => service.createUserAsChief(
      { id: 'chief', role: AdminRole.CHIEF_ADMIN, restaurantId: null },
      { username: 'e', password: PASSWORD, role: AdminRole.EMPLOYEE, restaurantId: restaurant.id },
    ))).toBe(403);
  });

  it('refuses a duplicate username before hashing anything', async () => {
    repo.addUser({ username: 'taken', role: AdminRole.EMPLOYEE });
    expect(await statusOf(() => service.createUserAsChief(
      { id: 'chief', role: AdminRole.CHIEF_ADMIN, restaurantId: null },
      { username: 'taken', password: PASSWORD, role: AdminRole.EMPLOYEE },
    ))).toBe(409);
  });

  it('agrees with canManageFoodEmployees, the one rule behind it', () => {
    expect(canManageFoodEmployees(AdminRole.CHIEF_ADMIN)).toBe(true);
    expect(canManageFoodEmployees(AdminRole.OWNER)).toBe(true);
    expect(canManageFoodEmployees(AdminRole.CATERING_ADMIN)).toBe(true);
    expect(canManageFoodEmployees(AdminRole.ADMIN)).toBe(false);
    expect(canManageFoodEmployees(AdminRole.MANAGER)).toBe(false);
  });
});

describe('listing a restaurant\'s users', () => {
  beforeEach(() => {
    repo.addUser({ username: 'admin', role: AdminRole.ADMIN, restaurantId: 'r1' });
    repo.addUser({ username: 'waiter', role: AdminRole.CATERING_EMPLOYEE, restaurantId: 'r1' });
    repo.addUser({ username: 'cook', role: AdminRole.KITCHEN, restaurantId: 'r1' });
  });

  it('hides Food Employees from a banquet ADMIN who shares the restaurant', async () => {
    // Hiding a role from a dropdown is presentation; this is the permission.
    const users = await service.listUsersForRestaurant('r1', AdminRole.ADMIN);
    expect(users.map((u) => u.username)).toEqual(['admin', 'cook']);
  });

  it('shows them to a Food Admin', async () => {
    const users = await service.listUsersForRestaurant('r1', AdminRole.CATERING_ADMIN);
    expect(users.map((u) => u.username)).toContain('waiter');
  });

  it('shows them to the Chief Admin and the Owner', async () => {
    for (const role of [AdminRole.CHIEF_ADMIN, AdminRole.OWNER]) {
      const users = await service.listUsersForRestaurant('r1', role);
      expect(users.map((u) => u.username)).toContain('waiter');
    }
  });
});

describe('deleting a user', () => {
  it('refuses to delete your own account', async () => {
    repo.addUser({ id: 'u1', username: 'me', role: AdminRole.CHIEF_ADMIN });
    expect(await statusOf(() => service.deleteUser('u1', AdminRole.CHIEF_ADMIN, 'u1'))).toBe(400);
  });

  it('404s on a user who does not exist', async () => {
    expect(await statusOf(() => service.deleteUser('u1', AdminRole.CHIEF_ADMIN, 'ghost'))).toBe(404);
  });

  it('lets an ADMIN delete an EMPLOYEE but not another ADMIN', async () => {
    repo.addUser({ id: 'e1', username: 'e', role: AdminRole.EMPLOYEE, restaurantId: 'r1' });
    repo.addUser({ id: 'a2', username: 'a2', role: AdminRole.ADMIN, restaurantId: 'r1' });

    await service.deleteUser('a1', AdminRole.ADMIN, 'e1');
    expect(repo.deleted).toEqual(['e1']);
    expect(await statusOf(() => service.deleteUser('a1', AdminRole.ADMIN, 'a2'))).toBe(403);
  });

  for (const role of [AdminRole.EMPLOYEE, AdminRole.KITCHEN]) {
    it(`refuses a ${role} outright`, async () => {
      repo.addUser({ id: 'e2', username: 'x', role: AdminRole.EMPLOYEE });
      expect(await statusOf(() => service.deleteUser('me', role, 'e2'))).toBe(403);
    });
  }
});

describe('changing a role', () => {
  it('is refused for everyone but the Chief Admin and the Owner', async () => {
    repo.addUser({ id: 'e1', username: 'e', role: AdminRole.EMPLOYEE });
    for (const role of [AdminRole.ADMIN, AdminRole.MANAGER, AdminRole.CATERING_ADMIN, AdminRole.EMPLOYEE]) {
      expect(await statusOf(() => service.updateUserRole(role, 'e1', AdminRole.KITCHEN))).toBe(403);
    }
  });

  it('stops an OWNER promoting anyone to OWNER, MANAGER or CHIEF_ADMIN', async () => {
    repo.addUser({ id: 'e1', username: 'e', role: AdminRole.EMPLOYEE });
    for (const role of [AdminRole.OWNER, AdminRole.MANAGER, AdminRole.CHIEF_ADMIN]) {
      expect(await statusOf(() => service.updateUserRole(AdminRole.OWNER, 'e1', role))).toBe(403);
    }
  });

  it('checks the new role against the restaurant\'s modules', async () => {
    const restaurant = repo.addRestaurant({ name: 'Registon', moduleCatering: false });
    repo.addUser({ id: 'e1', username: 'e', role: AdminRole.EMPLOYEE, restaurantId: restaurant.id });
    expect(await statusOf(() => service.updateUserRole(AdminRole.CHIEF_ADMIN, 'e1', AdminRole.CATERING_ADMIN))).toBe(403);
  });

  it('creates the profile when promoting someone to performer', async () => {
    // Without it they never appear in the public performers list.
    repo.addUser({ id: 'e1', username: 'e', role: AdminRole.EMPLOYEE });
    await service.updateUserRole(AdminRole.CHIEF_ADMIN, 'e1', AdminRole.PERFORMER);
    expect(repo.performerProfilesEnsured).toContain('e1');
  });
});

describe('reassigning a user\'s restaurant', () => {
  it('is Chief-Admin-only', async () => {
    repo.addUser({ id: 'e1', username: 'e', role: AdminRole.EMPLOYEE });
    expect(await statusOf(() => service.updateUserRestaurant(AdminRole.OWNER, 'e1', 'r1'))).toBe(403);
  });

  it('refuses for roles that are not restaurant-affiliated', async () => {
    repo.addUser({ id: 'o1', username: 'o', role: AdminRole.OWNER });
    expect(await statusOf(() => service.updateUserRestaurant(AdminRole.CHIEF_ADMIN, 'o1', 'r1'))).toBe(400);
  });

  it('404s on a restaurant that does not exist', async () => {
    repo.addUser({ id: 'e1', username: 'e', role: AdminRole.EMPLOYEE });
    expect(await statusOf(() => service.updateUserRestaurant(AdminRole.CHIEF_ADMIN, 'e1', 'nope'))).toBe(404);
  });

  it('checks the destination restaurant\'s modules', async () => {
    // The pairing only becomes real here, so this is where it gets checked.
    const restaurant = repo.addRestaurant({ name: 'No Banquet', moduleBanquet: false });
    repo.addUser({ id: 'e1', username: 'e', role: AdminRole.EMPLOYEE });
    expect(await statusOf(() => service.updateUserRestaurant(AdminRole.CHIEF_ADMIN, 'e1', restaurant.id))).toBe(403);
  });

  it('moves the user when everything checks out', async () => {
    const restaurant = repo.addRestaurant({ name: 'Registon' });
    repo.addUser({ id: 'e1', username: 'e', role: AdminRole.EMPLOYEE });
    const moved = await service.updateUserRestaurant(AdminRole.CHIEF_ADMIN, 'e1', restaurant.id);
    expect(moved.restaurantId).toBe(restaurant.id);
  });
});

describe('changing credentials', () => {
  it('requires something to change', async () => {
    repo.addUser({ id: 'u1', username: 'a', role: AdminRole.ADMIN });
    expect(await statusOf(() => service.updateUserCredentials(
      { id: 'chief', role: AdminRole.CHIEF_ADMIN, restaurantId: null }, 'u1', {},
    ))).toBe(400);
  });

  it('stores a new password hashed', async () => {
    repo.addUser({ id: 'u1', username: 'a', role: AdminRole.ADMIN });
    await service.updateUserCredentials(
      { id: 'chief', role: AdminRole.CHIEF_ADMIN, restaurantId: null }, 'u1', { password: 'new-password' },
    );
    const user = repo.users.find((u) => u.id === 'u1')!;
    expect(user.passwordHash).not.toContain('new-password');
    await expect(service.login('a', 'new-password')).resolves.toBeTruthy();
  });

  it('refuses a username already taken by someone else', async () => {
    repo.addUser({ id: 'u1', username: 'a', role: AdminRole.ADMIN });
    repo.addUser({ id: 'u2', username: 'b', role: AdminRole.ADMIN });
    expect(await statusOf(() => service.updateUserCredentials(
      { id: 'chief', role: AdminRole.CHIEF_ADMIN, restaurantId: null }, 'u1', { username: 'b' },
    ))).toBe(409);
  });

  it('lets a user rename themselves to their own name', async () => {
    repo.addUser({ id: 'u1', username: 'a', role: AdminRole.ADMIN });
    await expect(service.updateUserCredentials(
      { id: 'chief', role: AdminRole.CHIEF_ADMIN, restaurantId: null }, 'u1', { username: 'a', password: 'x' },
    )).resolves.toBeTruthy();
  });

  it('stops an OWNER touching another Owner or a Chief Admin', async () => {
    repo.addUser({ id: 'o2', username: 'o2', role: AdminRole.OWNER });
    repo.addUser({ id: 'c1', username: 'c1', role: AdminRole.CHIEF_ADMIN });
    const caller = { id: 'o1', role: AdminRole.OWNER, restaurantId: null };
    expect(await statusOf(() => service.updateUserCredentials(caller, 'o2', { password: 'x' }))).toBe(403);
    expect(await statusOf(() => service.updateUserCredentials(caller, 'c1', { password: 'x' }))).toBe(403);
  });

  it('stops an OWNER touching users outside their restaurants', async () => {
    repo.addRestaurant({ id: 'r1', name: 'Mine', ownerId: 'o1' });
    repo.addUser({ id: 'e1', username: 'e', role: AdminRole.EMPLOYEE, restaurantId: 'r2' });
    expect(await statusOf(() => service.updateUserCredentials(
      { id: 'o1', role: AdminRole.OWNER, restaurantId: null }, 'e1', { password: 'x' },
    ))).toBe(403);
  });

  it('lets an OWNER fix a performer\'s password, who belongs to no restaurant', async () => {
    repo.addUser({ id: 'p1', username: 'p', role: AdminRole.PERFORMER, restaurantId: null });
    await expect(service.updateUserCredentials(
      { id: 'o1', role: AdminRole.OWNER, restaurantId: null }, 'p1', { password: 'x' },
    )).resolves.toBeTruthy();
  });

  it('lets an ADMIN edit their own staff but nobody else\'s', async () => {
    repo.addUser({ id: 'e1', username: 'e1', role: AdminRole.EMPLOYEE, restaurantId: 'r1' });
    repo.addUser({ id: 'e2', username: 'e2', role: AdminRole.EMPLOYEE, restaurantId: 'r2' });
    const caller = { id: 'a1', role: AdminRole.ADMIN, restaurantId: 'r1' };

    await expect(service.updateUserCredentials(caller, 'e1', { password: 'x' })).resolves.toBeTruthy();
    expect(await statusOf(() => service.updateUserCredentials(caller, 'e2', { password: 'x' }))).toBe(403);
  });

  it('lets everyone change their own credentials', async () => {
    repo.addUser({ id: 'e1', username: 'e1', role: AdminRole.EMPLOYEE, restaurantId: 'r1' });
    await expect(service.updateUserCredentials(
      { id: 'e1', role: AdminRole.ADMIN, restaurantId: 'r1' }, 'e1', { password: 'x' },
    )).resolves.toBeTruthy();
  });

  it('refuses a caller with no business here at all', async () => {
    repo.addUser({ id: 'e1', username: 'e1', role: AdminRole.EMPLOYEE });
    expect(await statusOf(() => service.updateUserCredentials(
      { id: 'k1', role: AdminRole.KITCHEN, restaurantId: 'r1' }, 'e1', { password: 'x' },
    ))).toBe(403);
  });
});
