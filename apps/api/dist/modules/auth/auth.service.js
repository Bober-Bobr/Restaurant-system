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
        const existingCount = await this.authRepository.countAdmins();
        if (existingCount === 0) {
            // First ever user — always becomes OWNER, no auth needed
            const taken = await this.authRepository.findByUsername(username);
            if (taken)
                throw createHttpError(409, 'Username already taken');
            const passwordHash = await bcrypt.hash(password, 12);
            const user = await this.authRepository.create(username, passwordHash, AdminRole.OWNER);
            return this.issueTokenPair(user.id, user.username, user.role);
        }
        // Subsequent registrations require a caller with sufficient role
        if (!options.callerRole) {
            throw createHttpError(403, 'Registration requires authentication. Contact an administrator.');
        }
        if (options.callerRole === AdminRole.EMPLOYEE) {
            throw createHttpError(403, 'Employees cannot create user accounts.');
        }
        // ADMIN can only create EMPLOYEE
        if (options.callerRole === AdminRole.ADMIN) {
            if (options.requestedRole && options.requestedRole !== AdminRole.EMPLOYEE) {
                throw createHttpError(403, 'Administrators can only create Employee accounts.');
            }
            const role = AdminRole.EMPLOYEE;
            const taken = await this.authRepository.findByUsername(username);
            if (taken)
                throw createHttpError(409, 'Username already taken');
            const passwordHash = await bcrypt.hash(password, 12);
            const user = await this.authRepository.create(username, passwordHash, role);
            return this.issueTokenPair(user.id, user.username, user.role);
        }
        // OWNER can create ADMIN or EMPLOYEE
        const role = options.requestedRole ?? AdminRole.EMPLOYEE;
        if (role === AdminRole.OWNER) {
            throw createHttpError(403, 'Cannot create another Owner account.');
        }
        const taken = await this.authRepository.findByUsername(username);
        if (taken)
            throw createHttpError(409, 'Username already taken');
        const passwordHash = await bcrypt.hash(password, 12);
        const user = await this.authRepository.create(username, passwordHash, role);
        return this.issueTokenPair(user.id, user.username, user.role);
    }
    async login(username, password) {
        const user = await this.authRepository.findByUsername(username);
        if (!user)
            throw createHttpError(401, 'Invalid username or password');
        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok)
            throw createHttpError(401, 'Invalid username or password');
        return this.issueTokenPair(user.id, user.username, user.role);
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
        return this.issueTokenPair(user.id, user.username, user.role);
    }
    async logout(userId) {
        await this.authRepository.updateRefreshToken(userId, null);
    }
    async listUsers() {
        return this.authRepository.listAll();
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
    async issueTokenPair(userId, username, role) {
        const accessToken = jwt.sign({ sub: userId, username, role, type: 'access' }, env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
        const refreshToken = jwt.sign({ sub: userId, type: 'refresh' }, env.JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
        const refreshTokenHash = await bcrypt.hash(refreshToken, 12);
        await this.authRepository.updateRefreshToken(userId, refreshTokenHash);
        const decoded = jwt.decode(accessToken);
        const expiresIn = decoded?.exp ? decoded.exp * 1000 - Date.now() : 15 * 60 * 1000;
        return { accessToken, refreshToken, expiresIn, username, role };
    }
}
