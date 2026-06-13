import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { AuthRepository } from './auth.repository.js';
import { loginSchema, refreshTokenSchema, registerSchema, updateCredentialsSchema, updateRoleSchema } from './auth.schema.js';
import { AuthService } from './auth.service.js';

type JwtPayload = {
  sub: string;
  username: string;
  sid?: string;
  type?: string;
};

const authService = new AuthService(new AuthRepository());

function deviceInfo(request: Request) {
  const userAgent = request.header('user-agent') ?? null;
  const fwd = request.header('x-forwarded-for');
  const ipAddress = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(',')[0]?.trim() || request.ip || null;
  return { userAgent, ipAddress };
}

export class AuthController {
  async register(request: Request, response: Response) {
    const payload = registerSchema.parse(request.body);
    const result = await authService.register(payload.username, payload.password, {
      restaurantName: payload.restaurantName,
      role: payload.role,
    }, deviceInfo(request));
    response.status(201).json(result);
  }

  async login(request: Request, response: Response) {
    const payload = loginSchema.parse(request.body);
    const result = await authService.login(payload.username, payload.password, deviceInfo(request));
    response.json(result);
  }

  async refresh(request: Request, response: Response) {
    const payload = refreshTokenSchema.parse(request.body);

    try {
      const decoded = jwt.verify(payload.refreshToken, env.JWT_SECRET) as JwtPayload;
      if (!decoded.sub || decoded.type !== 'refresh' || !decoded.sid) {
        response.status(401).json({ message: 'Invalid refresh token' });
        return;
      }

      const result = await authService.refreshAccessToken(decoded.sid, payload.refreshToken);
      response.json(result);
    } catch (error) {
      response.status(401).json({ message: 'Invalid or expired refresh token' });
    }
  }

  async logout(request: Request, response: Response) {
    const authorization = request.header('authorization');
    const bearerToken =
      authorization?.startsWith('Bearer ') ? authorization.slice('Bearer '.length).trim() : undefined;

    if (!bearerToken) {
      response.status(401).json({ message: 'Unauthorized' });
      return;
    }

    try {
      const decoded = jwt.verify(bearerToken, env.JWT_SECRET) as JwtPayload;
      if (decoded.sid) {
        await authService.logout(decoded.sid);
      }
      response.json({ message: 'Logged out successfully' });
    } catch (error) {
      response.status(401).json({ message: 'Invalid token' });
    }
  }

  async listSessions(request: Request, response: Response) {
    const admin = request.admin!;
    const sessions = await authService.listSessions(admin.id, admin.sid ?? null);
    response.json(sessions);
  }

  async revokeSession(request: Request, response: Response) {
    const admin = request.admin!;
    await authService.revokeSession(admin.id, String(request.params.id));
    response.status(204).send();
  }

  async me(request: Request, response: Response) {
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

  async listUsers(request: Request, response: Response) {
    const admin = request.admin!;
    if (admin.role === 'CHIEF_ADMIN' || admin.role === 'MANAGER') {
      response.json(await authService.listUsers());
      return;
    }
    if (admin.role === 'OWNER') {
      response.json(await authService.listUsersForOwner(admin.id));
      return;
    }
    const restaurantId = await authService.resolveRestaurantId(admin.id, admin.restaurantId);
    if (!restaurantId) {
      response.json([]);
      return;
    }
    response.json(await authService.listUsersForRestaurant(restaurantId));
  }

  async createUserAsChief(request: Request, response: Response) {
    const admin = request.admin!;
    const result = await authService.createUserAsChief(
      { id: admin.id, role: admin.role, restaurantId: admin.restaurantId ?? null },
      request.body
    );
    response.status(201).json(result);
  }

  async deleteUser(request: Request, response: Response) {
    const admin = request.admin!;
    await authService.deleteUser(admin.id, admin.role, String(request.params.id));
    response.status(204).send();
  }

  async updateRole(request: Request, response: Response) {
    const admin = request.admin!;
    const { role } = updateRoleSchema.parse(request.body);
    const updated = await authService.updateUserRole(admin.role, String(request.params.id), role);
    response.json(updated);
  }

  async updateCredentials(request: Request, response: Response) {
    const admin = request.admin!;
    const payload = updateCredentialsSchema.parse(request.body);
    const updated = await authService.updateUserCredentials(
      { id: admin.id, role: admin.role, restaurantId: admin.restaurantId ?? null },
      String(request.params.id),
      payload
    );
    response.json(updated);
  }
}
