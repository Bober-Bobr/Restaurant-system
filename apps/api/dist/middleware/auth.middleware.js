import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
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
            request.admin = { id: decoded.sub, username: decoded.username };
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
        request.admin = { id: 'legacy', username: 'legacy' };
        next();
        return;
    }
    response.status(401).json({ message: 'Unauthorized' });
};
