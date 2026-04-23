import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { AuthRepository } from './auth.repository.js';
import { loginSchema, refreshTokenSchema, registerSchema, updateRoleSchema } from './auth.schema.js';
import { AuthService } from './auth.service.js';
const authService = new AuthService(new AuthRepository());
export class AuthController {
    async register(request, response) {
        const payload = registerSchema.parse(request.body);
        const result = await authService.register(payload.username, payload.password, {
            restaurantName: payload.restaurantName
        });
        response.status(201).json(result);
    }
    async login(request, response) {
        const payload = loginSchema.parse(request.body);
        const result = await authService.login(payload.username, payload.password);
        response.json(result);
    }
    async refresh(request, response) {
        const payload = refreshTokenSchema.parse(request.body);
        try {
            const decoded = jwt.verify(payload.refreshToken, env.JWT_SECRET);
            if (!decoded.sub || decoded.type !== 'refresh') {
                response.status(401).json({ message: 'Invalid refresh token' });
                return;
            }
            const result = await authService.refreshAccessToken(decoded.sub, payload.refreshToken);
            response.json(result);
        }
        catch (error) {
            response.status(401).json({ message: 'Invalid or expired refresh token' });
        }
    }
    async logout(request, response) {
        const authorization = request.header('authorization');
        const bearerToken = authorization?.startsWith('Bearer ') ? authorization.slice('Bearer '.length).trim() : undefined;
        if (!bearerToken) {
            response.status(401).json({ message: 'Unauthorized' });
            return;
        }
        try {
            const decoded = jwt.verify(bearerToken, env.JWT_SECRET);
            if (decoded.sub) {
                await authService.logout(decoded.sub);
            }
            response.json({ message: 'Logged out successfully' });
        }
        catch (error) {
            response.status(401).json({ message: 'Invalid token' });
        }
    }
    async me(request, response) {
        const admin = request.admin;
        if (!admin) {
            response.status(401).json({ message: 'Unauthorized' });
            return;
        }
        response.json({
            id: admin.id,
            username: admin.username,
            role: admin.role
        });
    }
    async listUsers(request, response) {
        const admin = request.admin;
        const restaurantId = await authService.resolveRestaurantId(admin.id, admin.restaurantId);
        if (!restaurantId) {
            response.json([]);
            return;
        }
        response.json(await authService.listUsersForRestaurant(restaurantId));
    }
    async deleteUser(request, response) {
        const admin = request.admin;
        await authService.deleteUser(admin.id, admin.role, String(request.params.id));
        response.status(204).send();
    }
    async updateRole(request, response) {
        const admin = request.admin;
        const { role } = updateRoleSchema.parse(request.body);
        const updated = await authService.updateUserRole(admin.role, String(request.params.id), role);
        response.json(updated);
    }
}
