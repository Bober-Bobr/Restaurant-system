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
    async register(username, password, allowOpenRegistration) {
        const existingCount = await this.authRepository.countAdmins();
        if (existingCount > 0 && !allowOpenRegistration) {
            throw createHttpError(403, 'Registration is closed. Sign in with an existing admin account.');
        }
        const taken = await this.authRepository.findByUsername(username);
        if (taken) {
            throw createHttpError(409, 'Username already taken');
        }
        const passwordHash = await bcrypt.hash(password, 12);
        const user = await this.authRepository.create(username, passwordHash);
        return this.issueTokenPair(user.id, user.username);
    }
    async login(username, password) {
        const user = await this.authRepository.findByUsername(username);
        if (!user) {
            throw createHttpError(401, 'Invalid username or password');
        }
        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) {
            throw createHttpError(401, 'Invalid username or password');
        }
        return this.issueTokenPair(user.id, user.username);
    }
    async refreshAccessToken(userId, providedRefreshToken) {
        const user = await this.authRepository.findById(userId);
        if (!user) {
            throw createHttpError(401, 'User not found');
        }
        if (!user.refreshTokenHash) {
            throw createHttpError(401, 'No refresh token stored');
        }
        const refreshTokenValid = await bcrypt.compare(providedRefreshToken, user.refreshTokenHash);
        if (!refreshTokenValid) {
            throw createHttpError(401, 'Invalid or expired refresh token');
        }
        return this.issueTokenPair(user.id, user.username);
    }
    async logout(userId) {
        await this.authRepository.updateRefreshToken(userId, null);
    }
    async issueTokenPair(userId, username) {
        const accesstoken = jwt.sign({ sub: userId, username, type: 'access' }, env.JWT_SECRET, {
            expiresIn: ACCESS_TOKEN_EXPIRY
        });
        const refreshToken = jwt.sign({ sub: userId, type: 'refresh' }, env.JWT_SECRET, {
            expiresIn: REFRESH_TOKEN_EXPIRY
        });
        const refreshTokenHash = await bcrypt.hash(refreshToken, 12);
        await this.authRepository.updateRefreshToken(userId, refreshTokenHash);
        const accessTokenDecoded = jwt.decode(accesstoken);
        const expiresIn = accessTokenDecoded?.exp ? accessTokenDecoded.exp * 1000 - Date.now() : 15 * 60 * 1000;
        return {
            accessToken: accesstoken,
            refreshToken,
            expiresIn,
            username
        };
    }
}
