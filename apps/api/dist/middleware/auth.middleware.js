import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { prisma } from '../db/prisma.js';
export const adminAuthMiddleware = (request, response, next) => {
    const authorization = request.header('authorization');
    const bearerToken = authorization?.startsWith('Bearer ') ? authorization.slice('Bearer '.length).trim() : undefined;
    const legacyKey = request.header('x-admin-key');
    if (bearerToken) {
        try {
            const decoded = jwt.verify(bearerToken, env.JWT_SECRET);
            if (decoded.type && decoded.type !== 'access') {
                response.status(401).json({ message: 'Invalid token type' });
                return;
            }
            request.admin = { id: decoded.sub, username: decoded.username, role: decoded.role, restaurantId: decoded.restaurantId ?? null };
            next();
            return;
        }
        catch (error) {
            if (error instanceof jwt.TokenExpiredError) {
                response.status(401).json({ message: 'Token expired', code: 'TOKEN_EXPIRED' });
                return;
            }
            response.status(401).json({ message: 'Invalid or expired token' });
            return;
        }
    }
    if (env.ADMIN_API_KEY && legacyKey === env.ADMIN_API_KEY) {
        request.admin = { id: 'legacy', username: 'legacy', role: 'OWNER', restaurantId: null };
        next();
        return;
    }
    response.status(401).json({ message: 'Unauthorized' });
};
export const optionalAuthMiddleware = (request, _response, next) => {
    const authorization = request.header('authorization');
    const bearerToken = authorization?.startsWith('Bearer ') ? authorization.slice('Bearer '.length).trim() : undefined;
    if (bearerToken) {
        try {
            const decoded = jwt.verify(bearerToken, env.JWT_SECRET);
            if (!decoded.type || decoded.type === 'access') {
                request.admin = { id: decoded.sub, username: decoded.username, role: decoded.role, restaurantId: decoded.restaurantId ?? null };
            }
        }
        catch {
            // Ignore invalid tokens — request proceeds without admin context
        }
    }
    next();
};
export const requireRole = (...roles) => (request, response, next) => {
    if (!request.admin) {
        response.status(401).json({ message: 'Unauthorized' });
        return;
    }
    if (!roles.includes(request.admin.role)) {
        response.status(403).json({ message: 'Forbidden' });
        return;
    }
    next();
};
export const requireRestaurant = async (request, response, next) => {
    const admin = request.admin;
    if (!admin) {
        response.status(401).json({ message: 'Unauthorized' });
        return;
    }
    if (admin.restaurantId) {
        request.restaurantId = admin.restaurantId;
        next();
        return;
    }
    const user = await prisma.adminUser.findUnique({
        where: { id: admin.id },
        select: { restaurantId: true }
    });
    if (!user?.restaurantId) {
        response.status(400).json({ message: 'No restaurant assigned to this account' });
        return;
    }
    request.restaurantId = user.restaurantId;
    next();
};
