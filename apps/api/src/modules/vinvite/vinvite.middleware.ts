import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';

type InviteJwtPayload = {
  sub: string;
  username?: string;
  sid?: string | null;
  type?: string;
};

// Auth guard for v-invite.uz endpoints. Uses the same JWT secret but a distinct
// token `type` ('invite-access'), so v-menu admin tokens are never accepted here
// and vice versa.
// Accepts EITHER a v-menu admin access token or a v-invite access token — used
// for shared infrastructure like photo/audio uploads. Sets request.admin or
// request.inviteUser accordingly.
export const adminOrInviteAuthMiddleware = (request: Request, response: Response, next: NextFunction): void => {
  const authorization = request.header('authorization');
  const bearerToken =
    authorization?.startsWith('Bearer ') ? authorization.slice('Bearer '.length).trim() : undefined;
  const legacyKey = request.header('x-admin-key');

  if (bearerToken) {
    try {
      const decoded = jwt.verify(bearerToken, env.JWT_SECRET) as InviteJwtPayload & {
        role?: string; restaurantId?: string | null;
      };
      if (decoded.type === 'invite-access') {
        request.inviteUser = { id: decoded.sub, username: decoded.username ?? '', sid: decoded.sid ?? null };
        next();
        return;
      }
      if (!decoded.type || decoded.type === 'access') {
        request.admin = {
          id: decoded.sub,
          username: decoded.username ?? '',
          role: decoded.role as never,
          restaurantId: decoded.restaurantId ?? null,
          sid: decoded.sid ?? null,
        };
        next();
        return;
      }
      response.status(401).json({ message: 'Invalid token type' });
      return;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        response.status(401).json({ message: 'Token expired', code: 'TOKEN_EXPIRED' });
        return;
      }
      response.status(401).json({ message: 'Invalid or expired token' });
      return;
    }
  }

  if (env.ADMIN_API_KEY && legacyKey === env.ADMIN_API_KEY) {
    request.admin = { id: 'legacy', username: 'legacy', role: 'OWNER' as never, restaurantId: null };
    next();
    return;
  }

  response.status(401).json({ message: 'Unauthorized' });
};

export const inviteAuthMiddleware = (request: Request, response: Response, next: NextFunction): void => {
  const authorization = request.header('authorization');
  const bearerToken =
    authorization?.startsWith('Bearer ') ? authorization.slice('Bearer '.length).trim() : undefined;

  if (!bearerToken) {
    response.status(401).json({ message: 'Unauthorized' });
    return;
  }

  try {
    const decoded = jwt.verify(bearerToken, env.JWT_SECRET) as InviteJwtPayload;
    if (decoded.type !== 'invite-access') {
      response.status(401).json({ message: 'Invalid token type' });
      return;
    }
    request.inviteUser = { id: decoded.sub, username: decoded.username ?? '', sid: decoded.sid ?? null };
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      response.status(401).json({ message: 'Token expired', code: 'TOKEN_EXPIRED' });
      return;
    }
    response.status(401).json({ message: 'Invalid or expired token' });
  }
};
