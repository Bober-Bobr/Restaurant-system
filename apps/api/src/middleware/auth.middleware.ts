import type { AdminRole } from '@prisma/client';
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { prisma } from '../db/prisma.js';

type JwtPayload = {
  sub: string;
  username: string;
  role?: AdminRole;
  restaurantId?: string | null;
  type?: string;
};

export const adminAuthMiddleware = (request: Request, response: Response, next: NextFunction): void => {
  const authorization = request.header('authorization');
  const bearerToken =
    authorization?.startsWith('Bearer ') ? authorization.slice('Bearer '.length).trim() : undefined;
  const legacyKey = request.header('x-admin-key');

  if (bearerToken) {
    try {
      const decoded = jwt.verify(bearerToken, env.JWT_SECRET) as JwtPayload;
      if (decoded.type && decoded.type !== 'access') {
        response.status(401).json({ message: 'Invalid token type' });
        return;
      }
      request.admin = { id: decoded.sub, username: decoded.username, role: decoded.role as AdminRole, restaurantId: decoded.restaurantId ?? null };
      next();
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
    request.admin = { id: 'legacy', username: 'legacy', role: 'OWNER' as AdminRole, restaurantId: null };
    next();
    return;
  }

  response.status(401).json({ message: 'Unauthorized' });
};

export const optionalAuthMiddleware = (request: Request, _response: Response, next: NextFunction): void => {
  const authorization = request.header('authorization');
  const bearerToken =
    authorization?.startsWith('Bearer ') ? authorization.slice('Bearer '.length).trim() : undefined;

  if (bearerToken) {
    try {
      const decoded = jwt.verify(bearerToken, env.JWT_SECRET) as JwtPayload;
      if (!decoded.type || decoded.type === 'access') {
        request.admin = { id: decoded.sub, username: decoded.username, role: decoded.role as AdminRole, restaurantId: decoded.restaurantId ?? null };
      }
    } catch {
      // Ignore invalid tokens — request proceeds without admin context
    }
  }

  next();
};

export const requireRole = (...roles: AdminRole[]) =>
  (request: Request, response: Response, next: NextFunction): void => {
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

export const requireRestaurant = async (request: Request, response: Response, next: NextFunction): Promise<void> => {
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
