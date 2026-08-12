import { AdminRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import type { AuthRepository } from '../modules/auth/auth.repository.js';

// ── An in-memory stand-in for the auth repository ───────────────────────────
// AuthService takes its repository through the constructor, so the rules can be
// tested against real data without a database. Only the methods the service
// actually calls are implemented; anything else throws loudly rather than
// returning undefined and making a test pass for the wrong reason.

export type FakeUser = {
  id: string;
  username: string;
  passwordHash: string;
  role: AdminRole;
  restaurantId: string | null;
};

export type FakeRestaurant = {
  id: string;
  name: string;
  ownerId?: string | null;
  moduleBanquet: boolean;
  moduleCatering: boolean;
  moduleAddons?: boolean;
};

export type FakeSession = {
  id: string;
  userId: string;
  refreshTokenHash: string;
  userAgent: string | null;
  ipAddress: string | null;
};

/** bcrypt at 12 rounds is slow on purpose; tests that don't check a password use this. */
export const DUMMY_HASH = '$2a$04$notarealhashnotarealhashno';

export function hashSync(password: string): string {
  // Cost 4: still bcrypt, ~100× faster than the production cost of 12. The
  // service always compares with bcrypt.compare, which reads the cost from the
  // hash itself, so this exercises the real code path.
  return bcrypt.hashSync(password, 4);
}

export class FakeAuthRepository {
  users: FakeUser[] = [];
  restaurants: FakeRestaurant[] = [];
  sessions: FakeSession[] = [];
  /** Ids passed to ensurePerformerProfile — a promotion must create the profile. */
  performerProfilesEnsured: string[] = [];
  deleted: string[] = [];

  private seq = 0;
  private nextId(prefix: string) { this.seq += 1; return `${prefix}${this.seq}`; }

  addUser(user: Partial<FakeUser> & { role: AdminRole; username: string }): FakeUser {
    const created: FakeUser = {
      id: user.id ?? this.nextId('u'),
      username: user.username,
      passwordHash: user.passwordHash ?? DUMMY_HASH,
      role: user.role,
      restaurantId: user.restaurantId ?? null,
    };
    this.users.push(created);
    return created;
  }

  addRestaurant(r: Partial<FakeRestaurant> & { name: string }): FakeRestaurant {
    const created: FakeRestaurant = {
      id: r.id ?? this.nextId('r'),
      name: r.name,
      ownerId: r.ownerId ?? null,
      moduleBanquet: r.moduleBanquet ?? true,
      moduleCatering: r.moduleCatering ?? true,
      moduleAddons: r.moduleAddons ?? false,
    };
    this.restaurants.push(created);
    return created;
  }

  // ── Methods the service calls ──────────────────────────────────────────────
  async findByUsername(username: string) {
    return this.users.find((u) => u.username === username) ?? null;
  }

  async findById(id: string) {
    return this.users.find((u) => u.id === id) ?? null;
  }

  async findRestaurantById(id: string) {
    return this.restaurants.find((r) => r.id === id) ?? null;
  }

  async findRestaurantByName(name: string) {
    return this.restaurants.find((r) => r.name === name) ?? null;
  }

  async findRestaurantIdsByOwner(ownerId: string) {
    return this.restaurants.filter((r) => r.ownerId === ownerId).map((r) => r.id);
  }

  async create(username: string, passwordHash: string, role: AdminRole, restaurantId?: string) {
    return this.addUser({ username, passwordHash, role, restaurantId: restaurantId ?? null });
  }

  async createAdminWithRestaurant(username: string, passwordHash: string, restaurantName: string) {
    // Mirrors the real one: self-signup gets the banquet module, or the account
    // it just created could not sign back in.
    const restaurant = this.addRestaurant({ name: restaurantName, moduleBanquet: true, moduleCatering: false });
    return this.addUser({ username, passwordHash, role: AdminRole.ADMIN, restaurantId: restaurant.id });
  }

  async createSession(data: { userId: string; refreshTokenHash: string; userAgent: string | null; ipAddress: string | null }) {
    const session: FakeSession = { id: this.nextId('s'), ...data };
    this.sessions.push(session);
    return session;
  }

  async updateSessionToken(sessionId: string, refreshTokenHash: string) {
    const session = this.sessions.find((s) => s.id === sessionId);
    if (session) session.refreshTokenHash = refreshTokenHash;
    return session;
  }

  async findSessionById(id: string) {
    return this.sessions.find((s) => s.id === id) ?? null;
  }

  async deleteSession(id: string) {
    this.sessions = this.sessions.filter((s) => s.id !== id);
  }

  async listSessionsByUser(userId: string) {
    return this.sessions.filter((s) => s.userId === userId);
  }

  async listByRestaurant(restaurantId: string) {
    return this.users.filter((u) => u.restaurantId === restaurantId);
  }

  async listByOwner(ownerId: string) {
    const ids = await this.findRestaurantIdsByOwner(ownerId);
    return this.users.filter((u) => u.id === ownerId || (u.restaurantId && ids.includes(u.restaurantId)));
  }

  async listAll() {
    return this.users;
  }

  async deleteById(id: string) {
    this.deleted.push(id);
    this.users = this.users.filter((u) => u.id !== id);
  }

  async updateCredentials(id: string, updates: { username?: string; passwordHash?: string }) {
    const user = this.users.find((u) => u.id === id);
    if (!user) throw new Error('no such user');
    Object.assign(user, updates);
    return user;
  }

  async updateRole(id: string, role: AdminRole) {
    const user = this.users.find((u) => u.id === id);
    if (!user) throw new Error('no such user');
    user.role = role;
    return user;
  }

  async updateRestaurant(id: string, restaurantId: string | null) {
    const user = this.users.find((u) => u.id === id);
    if (!user) throw new Error('no such user');
    user.restaurantId = restaurantId;
    return user;
  }

  async ensurePerformerProfile(userId: string) {
    this.performerProfilesEnsured.push(userId);
  }

  /** Satisfies the constructor's type without pretending to be complete. */
  asRepository(): AuthRepository {
    return this as unknown as AuthRepository;
  }
}
