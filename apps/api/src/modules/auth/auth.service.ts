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
};

export class AuthService {
  constructor(private readonly authRepository: AuthRepository) {}

  async register(
    username: string,
    password: string,
    options: { restaurantName?: string }
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
    return this.issueTokenPair(user.id, user.username, user.role, user.restaurantId);
  }

  async login(username: string, password: string): Promise<AuthResponse> {
    const user = await this.authRepository.findByUsername(username);
    if (!user) throw createHttpError(401, 'Invalid username or password');

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw createHttpError(401, 'Invalid username or password');

    return this.issueTokenPair(user.id, user.username, user.role, user.restaurantId);
  }

  async refreshAccessToken(userId: string, providedRefreshToken: string): Promise<AuthResponse> {
    const user = await this.authRepository.findById(userId);
    if (!user) throw createHttpError(401, 'User not found');
    if (!user.refreshTokenHash) throw createHttpError(401, 'No refresh token stored');

    const valid = await bcrypt.compare(providedRefreshToken, user.refreshTokenHash);
    if (!valid) throw createHttpError(401, 'Invalid or expired refresh token');

    return this.issueTokenPair(user.id, user.username, user.role, user.restaurantId);
  }

  async logout(userId: string): Promise<void> {
    await this.authRepository.updateRefreshToken(userId, null);
  }

  async listUsers() {
    return this.authRepository.listAll();
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

    if (callerRole === AdminRole.ADMIN && target.role !== AdminRole.EMPLOYEE) {
      throw createHttpError(403, 'Administrators can only delete Employee accounts.');
    }
    if (callerRole === AdminRole.EMPLOYEE) {
      throw createHttpError(403, 'Forbidden.');
    }
    await this.authRepository.deleteById(targetId);
  }

  async updateUserRole(callerRole: AdminRole, targetId: string, newRole: AdminRole) {
    if (callerRole !== AdminRole.OWNER) {
      throw createHttpError(403, 'Only the Owner can change roles.');
    }
    if (newRole === AdminRole.OWNER) {
      throw createHttpError(400, 'Cannot assign the Owner role.');
    }
    const target = await this.authRepository.findById(targetId);
    if (!target) throw createHttpError(404, 'User not found');

    return this.authRepository.updateRole(targetId, newRole);
  }

  private async issueTokenPair(
    userId: string,
    username: string,
    role: AdminRole,
    restaurantId: string | null
  ): Promise<AuthResponse> {
    const accessToken = jwt.sign(
      { sub: userId, username, role, restaurantId, type: 'access' },
      env.JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRY }
    );

    const refreshToken = jwt.sign(
      { sub: userId, type: 'refresh' },
      env.JWT_SECRET,
      { expiresIn: REFRESH_TOKEN_EXPIRY }
    );

    const refreshTokenHash = await bcrypt.hash(refreshToken, 12);
    await this.authRepository.updateRefreshToken(userId, refreshTokenHash);

    const decoded = jwt.decode(accessToken) as { exp?: number } | null;
    const expiresIn = decoded?.exp ? decoded.exp * 1000 - Date.now() : 15 * 60 * 1000;

    return { accessToken, refreshToken, expiresIn, username, role, restaurantId };
  }
}
