import { AdminRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import createHttpError from 'http-errors';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';
export class AuthService {
    authRepository;
    constructor(authRepository) {
        this.authRepository = authRepository;
    }
    async register(username, password, options) {
        if (!options.restaurantName?.trim()) {
            throw createHttpError(400, 'Restaurant name is required.');
        }
        const restaurantName = options.restaurantName.trim();
        const existing = await this.authRepository.findRestaurantByName(restaurantName);
        if (existing)
            throw createHttpError(409, 'An admin for this restaurant already exists.');
        const taken = await this.authRepository.findByUsername(username);
        if (taken)
            throw createHttpError(409, 'Username already taken');
        const passwordHash = await bcrypt.hash(password, 12);
        const user = await this.authRepository.createAdminWithRestaurant(username, passwordHash, restaurantName);
        return this.issueTokenPair(user.id, user.username, user.role, user.restaurantId);
    }
    async login(username, password) {
        const user = await this.authRepository.findByUsername(username);
        if (!user)
            throw createHttpError(401, 'Invalid username or password');
        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok)
            throw createHttpError(401, 'Invalid username or password');
        return this.issueTokenPair(user.id, user.username, user.role, user.restaurantId);
    }
    async refreshAccessToken(userId, providedRefreshToken) {
        const user = await this.authRepository.findById(userId);
        if (!user)
            throw createHttpError(401, 'User not found');
        if (!user.refreshTokenHash)
            throw createHttpError(401, 'No refresh token stored');
        const valid = await bcrypt.compare(providedRefreshToken, user.refreshTokenHash);
        if (!valid)
            throw createHttpError(401, 'Invalid or expired refresh token');
        return this.issueTokenPair(user.id, user.username, user.role, user.restaurantId);
    }
    async logout(userId) {
        await this.authRepository.updateRefreshToken(userId, null);
    }
    async listUsers() {
        return this.authRepository.listAll();
    }
    async listUsersForOwner(ownerId) {
        return this.authRepository.listByOwner(ownerId);
    }
    async listUsersForRestaurant(restaurantId) {
        return this.authRepository.listByRestaurant(restaurantId);
    }
    async resolveRestaurantId(userId, jwtRestaurantId) {
        if (jwtRestaurantId)
            return jwtRestaurantId;
        const user = await this.authRepository.findById(userId);
        return user?.restaurantId ?? null;
    }
    async deleteUser(callerId, callerRole, targetId) {
        if (callerId === targetId) {
            throw createHttpError(400, 'Cannot delete your own account.');
        }
        const target = await this.authRepository.findById(targetId);
        if (!target)
            throw createHttpError(404, 'User not found');
        if (callerRole === AdminRole.ADMIN && target.role !== AdminRole.EMPLOYEE) {
            throw createHttpError(403, 'Administrators can only delete Employee accounts.');
        }
        if (callerRole === AdminRole.EMPLOYEE) {
            throw createHttpError(403, 'Forbidden.');
        }
        await this.authRepository.deleteById(targetId);
    }
    async updateUserRole(callerRole, targetId, newRole) {
        if (callerRole !== AdminRole.OWNER) {
            throw createHttpError(403, 'Only the Owner can change roles.');
        }
        if (newRole === AdminRole.OWNER) {
            throw createHttpError(400, 'Cannot assign the Owner role.');
        }
        const target = await this.authRepository.findById(targetId);
        if (!target)
            throw createHttpError(404, 'User not found');
        return this.authRepository.updateRole(targetId, newRole);
    }
    async issueTokenPair(userId, username, role, restaurantId) {
        const accessToken = jwt.sign({ sub: userId, username, role, restaurantId, type: 'access' }, env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
        const refreshToken = jwt.sign({ sub: userId, type: 'refresh' }, env.JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
        const refreshTokenHash = await bcrypt.hash(refreshToken, 12);
        await this.authRepository.updateRefreshToken(userId, refreshTokenHash);
        const decoded = jwt.decode(accessToken);
        const expiresIn = decoded?.exp ? decoded.exp * 1000 - Date.now() : 15 * 60 * 1000;
        const restaurant = restaurantId
            ? await this.authRepository.findRestaurantById(restaurantId)
            : null;
        return { accessToken, refreshToken, expiresIn, username, role, restaurantId, restaurantName: restaurant?.name ?? null };
    }
}
