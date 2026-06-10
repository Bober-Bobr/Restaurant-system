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

export class AuthService {
  constructor(private readonly authRepository: AuthRepository) {}

  async register(
    username: string,
    password: string,
    options: { restaurantName?: string },
    device: DeviceInfo = {}
  ): Promise<AuthResponse> {
    if (!options.restaurantName?.trim()) {
      throw createHttpError(400, 'Restaurant name is required.');
    }
    const restaurantName = options.restaurantName.trim();

    const existing = await this.authRepository.findRestaurantByName(restaurantName);
    if (existing) throw createHttpError(409, 'An admin for this restaurant already exists.');

    const taken = await this.authRepository.findByUsername(username);
    if (taken) throw createHttpError(409, 'Username already taken');

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await this.authRepository.createAdminWithRestaurant(username, passwordHash, restaurantName);
    return this.issueTokenPair(user.id, user.username, user.role, user.restaurantId, { device });
  }

  async login(username: string, password: string, device: DeviceInfo = {}): Promise<AuthResponse> {
    const user = await this.authRepository.findByUsername(username);
    if (!user) throw createHttpError(401, 'Invalid username or password');

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw createHttpError(401, 'Invalid username or password');

    return this.issueTokenPair(user.id, user.username, user.role, user.restaurantId, { device });
  }

  async refreshAccessToken(sessionId: string, providedRefreshToken: string): Promise<AuthResponse> {
    const session = await this.authRepository.findSessionById(sessionId);
    if (!session) throw createHttpError(401, 'Session not found');

    const valid = await bcrypt.compare(providedRefreshToken, session.refreshTokenHash);
    if (!valid) throw createHttpError(401, 'Invalid or expired refresh token');

    const user = await this.authRepository.findById(session.userId);
    if (!user) throw createHttpError(401, 'User not found');

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
      if (payload.role === AdminRole.OWNER || payload.role === AdminRole.CHIEF_ADMIN || payload.role === AdminRole.MANAGER) {
        throw createHttpError(403, 'Owners can only create Administrator, Catering Admin, Employee, or Kitchen accounts.');
      }
    }
    if (caller.role === AdminRole.ADMIN || caller.role === AdminRole.CATERING_ADMIN) {
      if (payload.role !== AdminRole.EMPLOYEE && payload.role !== AdminRole.KITCHEN) {
        throw createHttpError(403, 'Administrators can only create Employee or Kitchen accounts.');
      }
      // Force the new employee into the admin's restaurant
      const restaurantId = caller.restaurantId
        ?? (await this.authRepository.findById(caller.id))?.restaurantId
        ?? null;
      if (!restaurantId) throw createHttpError(400, 'Administrator has no restaurant assigned.');
      payload.restaurantId = restaurantId;
    }
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
        const ownerRestaurantIds = await this.authRepository.findRestaurantIdsByOwner(caller.id);
        if (!target.restaurantId || !ownerRestaurantIds.includes(target.restaurantId)) {
          throw createHttpError(403, 'Cannot manage users outside your restaurants.');
        }
      }
    } else if (caller.role === AdminRole.ADMIN || caller.role === AdminRole.CATERING_ADMIN) {
      if (!isSelf) {
        if (target.role !== AdminRole.EMPLOYEE && target.role !== AdminRole.KITCHEN) {
          throw createHttpError(403, 'Administrators can only edit Employee or Kitchen accounts.');
        }
        const callerRestId =
          caller.restaurantId ?? (await this.authRepository.findById(caller.id))?.restaurantId ?? null;
        if (!callerRestId || target.restaurantId !== callerRestId) {
          throw createHttpError(403, 'Cannot manage users outside your restaurant.');
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
        throw createHttpError(403, 'Owners can only assign Administrator, Catering Admin, Employee, or Kitchen roles.');
      }
    }
    const target = await this.authRepository.findById(targetId);
    if (!target) throw createHttpError(404, 'User not found');

    return this.authRepository.updateRole(targetId, newRole);
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
