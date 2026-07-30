import { AdminRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import createHttpError from 'http-errors';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { AuthRepository } from './auth.repository.js';

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

export type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  username: string;
  role: AdminRole;
  restaurantId: string | null;
  restaurantName: string | null;
};

export type DeviceInfo = { userAgent?: string | null; ipAddress?: string | null };

// Roles that only exist because a restaurant bought the matching module. The
// platform roles (CHIEF_ADMIN, MANAGER, OWNER, RESTAURANT_MANAGER, NFC_MAKER)
// are not restaurant-scoped and are never gated here.
const MODULE_BY_ROLE: Partial<Record<AdminRole, 'moduleBanquet' | 'moduleCatering'>> = {
  [AdminRole.ADMIN]: 'moduleBanquet',
  [AdminRole.EMPLOYEE]: 'moduleBanquet',
  [AdminRole.KITCHEN]: 'moduleBanquet',
  [AdminRole.CATERING_ADMIN]: 'moduleCatering',
};

const MODULE_DENIED: Record<'moduleBanquet' | 'moduleCatering', string> = {
  moduleBanquet: 'The banquet module is not active for this restaurant. Contact the platform administrator.',
  moduleCatering: 'The catering module is not active for this restaurant. Contact the platform administrator.',
};

export class AuthService {
  constructor(private readonly authRepository: AuthRepository) {}

  // Gate a restaurant-scoped role on its module. Called on login AND on refresh,
  // so revoking a module ends live sessions within the 15-minute access-token
  // window instead of waiting for the user to sign out.
  private async assertModuleAccess(role: AdminRole, restaurantId: string | null): Promise<void> {
    const required = MODULE_BY_ROLE[role];
    if (!required) return;
    // No restaurant assigned yet — nothing to check; other guards handle it.
    if (!restaurantId) return;
    const restaurant = await this.authRepository.findRestaurantById(restaurantId);
    if (!restaurant) return;
    if (!restaurant[required]) throw createHttpError(403, MODULE_DENIED[required]);
  }

  // Same rule applied when granting a role rather than using one, so the UI
  // refuses up front instead of minting an account that is rejected at login.
  // A null restaurant is allowed through on purpose: the Chief Admin creates
  // staff first and assigns the restaurant in a second step, and that step runs
  // this check too. The login gate is the backstop either way.
  private async assertModuleAssignable(role: AdminRole, restaurantId: string | null): Promise<void> {
    const required = MODULE_BY_ROLE[role];
    if (!required || !restaurantId) return;
    const restaurant = await this.authRepository.findRestaurantById(restaurantId);
    if (!restaurant) throw createHttpError(404, 'Restaurant not found');
    if (!restaurant[required]) throw createHttpError(403, MODULE_DENIED[required]);
  }

  async register(
    username: string,
    password: string,
    options: { restaurantName?: string; role?: AdminRole },
    device: DeviceInfo = {}
  ): Promise<AuthResponse> {
    const role = options.role ?? AdminRole.ADMIN;
    const platformRoles: AdminRole[] = [AdminRole.CHIEF_ADMIN, AdminRole.MANAGER, AdminRole.OWNER, AdminRole.RESTAURANT_MANAGER];

    const taken = await this.authRepository.findByUsername(username);
    if (taken) throw createHttpError(409, 'Username already taken');

    const passwordHash = await bcrypt.hash(password, 12);

    if (platformRoles.includes(role)) {
      const user = await this.authRepository.create(username, passwordHash, role);
      return this.issueTokenPair(user.id, user.username, user.role, user.restaurantId, { device });
    }

    if (!options.restaurantName?.trim()) {
      throw createHttpError(400, 'Restaurant name is required.');
    }
    const restaurantName = options.restaurantName.trim();

    const existing = await this.authRepository.findRestaurantByName(restaurantName);
    if (existing) throw createHttpError(409, 'An admin for this restaurant already exists.');

    const user = await this.authRepository.createAdminWithRestaurant(username, passwordHash, restaurantName);
    return this.issueTokenPair(user.id, user.username, user.role, user.restaurantId, { device });
  }

  async login(username: string, password: string, device: DeviceInfo = {}): Promise<AuthResponse> {
    const user = await this.authRepository.findByUsername(username);
    if (!user) throw createHttpError(401, 'Invalid username or password');

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw createHttpError(401, 'Invalid username or password');

    await this.assertModuleAccess(user.role, user.restaurantId);

    return this.issueTokenPair(user.id, user.username, user.role, user.restaurantId, { device });
  }

  async refreshAccessToken(sessionId: string, providedRefreshToken: string): Promise<AuthResponse> {
    const session = await this.authRepository.findSessionById(sessionId);
    if (!session) throw createHttpError(401, 'Session not found');

    const valid = await bcrypt.compare(providedRefreshToken, session.refreshTokenHash);
    if (!valid) throw createHttpError(401, 'Invalid or expired refresh token');

    const user = await this.authRepository.findById(session.userId);
    if (!user) throw createHttpError(401, 'User not found');

    await this.assertModuleAccess(user.role, user.restaurantId);

    return this.issueTokenPair(user.id, user.username, user.role, user.restaurantId, { sessionId });
  }

  async logout(sessionId: string): Promise<void> {
    try {
      await this.authRepository.deleteSession(sessionId);
    } catch {
      // Session already gone — treat as success.
    }
  }

  async listSessions(userId: string, currentSessionId: string | null) {
    const sessions = await this.authRepository.listSessionsByUser(userId);
    return sessions.map((s) => ({ ...s, isCurrent: s.id === currentSessionId }));
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const session = await this.authRepository.findSessionById(sessionId);
    if (!session || session.userId !== userId) {
      throw createHttpError(404, 'Session not found');
    }
    await this.authRepository.deleteSession(sessionId);
  }

  async listUsers() {
    return this.authRepository.listAll();
  }

  async createUserAsChief(
    caller: { id: string; role: AdminRole; restaurantId: string | null },
    payload: { username: string; password: string; role: AdminRole; restaurantId?: string | null }
  ) {
    if (caller.role === AdminRole.OWNER) {
      if (
        payload.role === AdminRole.OWNER ||
        payload.role === AdminRole.CHIEF_ADMIN ||
        payload.role === AdminRole.MANAGER
      ) {
        throw createHttpError(403, 'Owners can only create Administrator, Food Admin, Restaurant Manager, Employee, or Kitchen accounts.');
      }
      // Any restaurant an owner assigns must be one they actually own.
      if (payload.restaurantId) {
        const ownedIds = await this.authRepository.findRestaurantIdsByOwner(caller.id);
        if (!ownedIds.includes(payload.restaurantId)) {
          throw createHttpError(403, 'You can only assign your own restaurants.');
        }
      }
      // A restaurant manager must be tied to a restaurant so its events feed the ledger.
      if (payload.role === AdminRole.RESTAURANT_MANAGER && !payload.restaurantId) {
        throw createHttpError(400, 'Select a restaurant for the manager.');
      }
    }
    if (caller.role === AdminRole.ADMIN || caller.role === AdminRole.CATERING_ADMIN) {
      // A restaurant ADMIN may also create performers, who are platform-wide
      // and belong to no restaurant. CATERING_ADMIN may not.
      const allowed: AdminRole[] = caller.role === AdminRole.ADMIN
        ? [AdminRole.EMPLOYEE, AdminRole.KITCHEN, AdminRole.PERFORMER]
        : [AdminRole.EMPLOYEE, AdminRole.KITCHEN];
      if (!allowed.includes(payload.role)) {
        throw createHttpError(403, 'Administrators can only create Employee, Kitchen or Performer accounts.');
      }
      if (payload.role === AdminRole.PERFORMER) {
        // Never inherit the creator's restaurant — a performer is not staff of
        // the venue that happened to sign them up.
        payload.restaurantId = null;
      } else {
        // Force the new employee into the admin's restaurant
        const restaurantId = caller.restaurantId
          ?? (await this.authRepository.findById(caller.id))?.restaurantId
          ?? null;
        if (!restaurantId) throw createHttpError(400, 'Administrator has no restaurant assigned.');
        payload.restaurantId = restaurantId;
      }
    }
    // Performers are never restaurant-scoped, whoever creates them.
    if (payload.role === AdminRole.PERFORMER) payload.restaurantId = null;
    // A banquet/catering role is only assignable where that module is active —
    // otherwise the account would be created and then refused at login.
    await this.assertModuleAssignable(payload.role, payload.restaurantId ?? null);
    const taken = await this.authRepository.findByUsername(payload.username);
    if (taken) throw createHttpError(409, 'Username already taken');
    const passwordHash = await bcrypt.hash(payload.password, 12);
    return this.authRepository.create(payload.username, passwordHash, payload.role, payload.restaurantId ?? undefined);
  }

  async listUsersForOwner(ownerId: string) {
    return this.authRepository.listByOwner(ownerId);
  }

  async listUsersForRestaurant(restaurantId: string) {
    return this.authRepository.listByRestaurant(restaurantId);
  }

  async resolveRestaurantId(userId: string, jwtRestaurantId: string | null): Promise<string | null> {
    if (jwtRestaurantId) return jwtRestaurantId;
    const user = await this.authRepository.findById(userId);
    return user?.restaurantId ?? null;
  }

  async deleteUser(callerId: string, callerRole: AdminRole, targetId: string) {
    if (callerId === targetId) {
      throw createHttpError(400, 'Cannot delete your own account.');
    }
    const target = await this.authRepository.findById(targetId);
    if (!target) throw createHttpError(404, 'User not found');

    if ((callerRole === AdminRole.ADMIN || callerRole === AdminRole.CATERING_ADMIN) && target.role !== AdminRole.EMPLOYEE && target.role !== AdminRole.KITCHEN) {
      throw createHttpError(403, 'Administrators can only delete Employee or Kitchen accounts.');
    }
    if (callerRole === AdminRole.EMPLOYEE || callerRole === AdminRole.KITCHEN) {
      throw createHttpError(403, 'Forbidden.');
    }
    await this.authRepository.deleteById(targetId);
  }

  async updateUserCredentials(
    caller: { id: string; role: AdminRole; restaurantId: string | null },
    targetId: string,
    payload: { username?: string; password?: string }
  ) {
    if (payload.username === undefined && payload.password === undefined) {
      throw createHttpError(400, 'Username or password must be provided.');
    }

    const target = await this.authRepository.findById(targetId);
    if (!target) throw createHttpError(404, 'User not found.');

    const isSelf = target.id === caller.id;

    if (caller.role === AdminRole.CHIEF_ADMIN) {
      // Chief admin may edit anyone.
    } else if (caller.role === AdminRole.OWNER) {
      if (!isSelf) {
        if (target.role === AdminRole.CHIEF_ADMIN || target.role === AdminRole.OWNER) {
          throw createHttpError(403, 'Owners cannot manage other Owners or Chief Admins.');
        }
        // Performers belong to no restaurant, so the restaurant check below can
        // never pass for them. Owners may create performers, so they must be
        // able to fix a mistyped password afterwards.
        if (target.role !== AdminRole.PERFORMER) {
          const ownerRestaurantIds = await this.authRepository.findRestaurantIdsByOwner(caller.id);
          if (!target.restaurantId || !ownerRestaurantIds.includes(target.restaurantId)) {
            throw createHttpError(403, 'Cannot manage users outside your restaurants.');
          }
        }
      }
    } else if (caller.role === AdminRole.ADMIN || caller.role === AdminRole.CATERING_ADMIN) {
      if (!isSelf) {
        // A restaurant ADMIN may also create performers — and so may edit them.
        // CATERING_ADMIN cannot create them and cannot edit them either.
        const canEditPerformer = caller.role === AdminRole.ADMIN && target.role === AdminRole.PERFORMER;
        if (!canEditPerformer) {
          if (target.role !== AdminRole.EMPLOYEE && target.role !== AdminRole.KITCHEN) {
            throw createHttpError(403, 'Administrators can only edit Employee, Kitchen or Performer accounts.');
          }
          const callerRestId =
            caller.restaurantId ?? (await this.authRepository.findById(caller.id))?.restaurantId ?? null;
          if (!callerRestId || target.restaurantId !== callerRestId) {
            throw createHttpError(403, 'Cannot manage users outside your restaurant.');
          }
        }
      }
    } else {
      throw createHttpError(403, 'Forbidden.');
    }

    const updates: { username?: string; passwordHash?: string } = {};
    if (payload.username !== undefined) {
      const taken = await this.authRepository.findByUsername(payload.username);
      if (taken && taken.id !== targetId) {
        throw createHttpError(409, 'Username already taken.');
      }
      updates.username = payload.username;
    }
    if (payload.password !== undefined) {
      updates.passwordHash = await bcrypt.hash(payload.password, 12);
    }

    return this.authRepository.updateCredentials(targetId, updates);
  }

  async updateUserRole(callerRole: AdminRole, targetId: string, newRole: AdminRole) {
    // CHIEF_ADMIN can assign any role. OWNER can only assign ADMIN/EMPLOYEE/KITCHEN.
    if (callerRole !== AdminRole.CHIEF_ADMIN && callerRole !== AdminRole.OWNER) {
      throw createHttpError(403, 'You cannot change user roles.');
    }
    if (callerRole === AdminRole.OWNER) {
      if (newRole === AdminRole.CHIEF_ADMIN || newRole === AdminRole.MANAGER || newRole === AdminRole.OWNER) {
        throw createHttpError(403, 'Owners can only assign Administrator, Food Admin, Employee, or Kitchen roles.');
      }
    }
    const target = await this.authRepository.findById(targetId);
    if (!target) throw createHttpError(404, 'User not found');
    await this.assertModuleAssignable(newRole, target.restaurantId);

    const updated = await this.authRepository.updateRole(targetId, newRole);
    // Promoting an existing account to performer has to create the profile row
    // too, or they never show up in the public performers list.
    await this.authRepository.ensurePerformerProfile(targetId);
    return updated;
  }

  // Chief Admin reassigns which restaurant a staff user is affiliated with.
  // Owners derive their restaurants from ownership, and Chief Admins are
  // system-wide, so neither can be reassigned this way.
  async updateUserRestaurant(callerRole: AdminRole, targetId: string, restaurantId: string | null) {
    if (callerRole !== AdminRole.CHIEF_ADMIN) {
      throw createHttpError(403, 'Only the Chief Admin can reassign a user\'s restaurant.');
    }
    const target = await this.authRepository.findById(targetId);
    if (!target) throw createHttpError(404, 'User not found');
    if (target.role === AdminRole.CHIEF_ADMIN || target.role === AdminRole.OWNER) {
      throw createHttpError(400, 'This user is not affiliated with a restaurant.');
    }
    if (restaurantId) {
      const restaurant = await this.authRepository.findRestaurantById(restaurantId);
      if (!restaurant) throw createHttpError(404, 'Restaurant not found');
    }
    // The pairing only becomes real here, so this is where a banquet/catering
    // role gets checked against the restaurant it is being moved to.
    await this.assertModuleAssignable(target.role, restaurantId);
    return this.authRepository.updateRestaurant(targetId, restaurantId);
  }

  private async issueTokenPair(
    userId: string,
    username: string,
    role: AdminRole,
    restaurantId: string | null,
    opts: { sessionId?: string; device?: DeviceInfo }
  ): Promise<AuthResponse> {
    // New login → create a session row; refresh → reuse the existing one.
    let sessionId = opts.sessionId;
    if (!sessionId) {
      const session = await this.authRepository.createSession({
        userId,
        refreshTokenHash: '',
        userAgent: opts.device?.userAgent ?? null,
        ipAddress: opts.device?.ipAddress ?? null,
      });
      sessionId = session.id;
    }

    const accessToken = jwt.sign(
      { sub: userId, username, role, restaurantId, sid: sessionId, type: 'access' },
      env.JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRY }
    );

    const refreshToken = jwt.sign(
      { sub: userId, sid: sessionId, type: 'refresh' },
      env.JWT_SECRET,
      { expiresIn: REFRESH_TOKEN_EXPIRY }
    );

    const refreshTokenHash = await bcrypt.hash(refreshToken, 12);
    await this.authRepository.updateSessionToken(sessionId, refreshTokenHash);

    const decoded = jwt.decode(accessToken) as { exp?: number } | null;
    const expiresIn = decoded?.exp ? decoded.exp * 1000 - Date.now() : 15 * 60 * 1000;

    const restaurant = restaurantId
      ? await this.authRepository.findRestaurantById(restaurantId)
      : null;

    return { accessToken, refreshToken, expiresIn, username, role, restaurantId, restaurantName: restaurant?.name ?? null };
  }
}
