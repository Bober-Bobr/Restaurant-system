import { AdminRole } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { isServiceRole } from '../performer/performer.kind.js';

export class AuthRepository {
  async countAdmins() {
    return prisma.adminUser.count();
  }

  async listAll() {
    return prisma.adminUser.findMany({
      select: { id: true, username: true, role: true, restaurantId: true, createdAt: true },
      orderBy: { createdAt: 'asc' }
    });
  }

  async listByOwner(ownerId: string) {
    const restaurants = await prisma.restaurant.findMany({
      where: { ownerId },
      select: { id: true }
    });
    const restaurantIds = restaurants.map((r) => r.id);
    return prisma.adminUser.findMany({
      // Performers and hosts carry no restaurantId — they are a platform-wide
      // pool that any venue can book — so a restaurant-scoped filter alone hides
      // them from the very people allowed to create them.
      where: {
        OR: [
          { id: ownerId },
          { restaurantId: { in: restaurantIds } },
          { role: { in: [AdminRole.PERFORMER, AdminRole.HOST] } },
        ],
      },
      select: { id: true, username: true, role: true, restaurantId: true, createdAt: true },
      orderBy: { createdAt: 'asc' }
    });
  }

  async listByRestaurant(restaurantId: string) {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { ownerId: true }
    });
    if (!restaurant) return [];
    return prisma.adminUser.findMany({
      // Performers and hosts are included for the same reason as in listByOwner.
      where: {
        OR: [
          { id: restaurant.ownerId },
          { restaurantId },
          { role: { in: [AdminRole.PERFORMER, AdminRole.HOST] } },
        ],
      },
      select: { id: true, username: true, role: true, restaurantId: true, createdAt: true },
      orderBy: { createdAt: 'asc' }
    });
  }

  async findByUsername(username: string) {
    return prisma.adminUser.findUnique({ where: { username } });
  }

  async findById(id: string) {
    return prisma.adminUser.findUnique({ where: { id } });
  }

  async create(username: string, passwordHash: string, role: AdminRole = AdminRole.OWNER, restaurantId?: string) {
    return prisma.adminUser.create({
      data: {
        username,
        passwordHash,
        role,
        ...(restaurantId ? { restaurantId } : {}),
        // A performer or host must have a profile row from the moment the
        // account exists, so they are never missing from the public block until
        // they happen to open their own profile page. Stage name defaults to
        // the username and is editable straight away.
        ...(isServiceRole(role) ? { performerProfile: { create: { displayName: username } } } : {}),
      },
    });
  }

  // Used when an existing account is switched TO the performer or host role,
  // which is the other way either can come into being.
  async ensurePerformerProfile(userId: string) {
    const user = await prisma.adminUser.findUnique({
      where: { id: userId },
      select: { username: true, role: true, performerProfile: { select: { id: true } } },
    });
    if (!user || !isServiceRole(user.role) || user.performerProfile) return;
    await prisma.performerProfile.create({ data: { userId, displayName: user.username } });
  }

  async findRestaurantByName(name: string) {
    return prisma.restaurant.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } }
    });
  }

  async findRestaurantById(id: string) {
    return prisma.restaurant.findUnique({ where: { id } });
  }

  async createAdminWithRestaurant(username: string, passwordHash: string, restaurantName: string) {
    return prisma.$transaction(async (tx) => {
      const user = await tx.adminUser.create({
        data: { username, passwordHash, role: AdminRole.ADMIN }
      });
      const restaurant = await tx.restaurant.create({
        // Self-signup is a banquet signup: grant the module up front, otherwise
        // the account this transaction creates could not log back in.
        data: { name: restaurantName, ownerId: user.id, moduleBanquet: true }
      });
      return tx.adminUser.update({
        where: { id: user.id },
        data: { restaurantId: restaurant.id }
      });
    });
  }

  async updateRefreshToken(userId: string, refreshTokenHash: string | null) {
    return prisma.adminUser.update({
      where: { id: userId },
      data: { refreshTokenHash }
    });
  }

  async updateRole(userId: string, role: AdminRole) {
    return prisma.adminUser.update({
      where: { id: userId },
      data: { role },
      select: { id: true, username: true, role: true }
    });
  }

  async updateRestaurant(userId: string, restaurantId: string | null) {
    return prisma.adminUser.update({
      where: { id: userId },
      data: { restaurantId },
      select: { id: true, username: true, role: true, restaurantId: true, createdAt: true }
    });
  }

  async updateCredentials(userId: string, data: { username?: string; passwordHash?: string }) {
    return prisma.adminUser.update({
      where: { id: userId },
      data,
      select: { id: true, username: true, role: true, restaurantId: true, createdAt: true }
    });
  }

  async findRestaurantIdsByOwner(ownerId: string) {
    const restaurants = await prisma.restaurant.findMany({
      where: { ownerId },
      select: { id: true }
    });
    return restaurants.map((r) => r.id);
  }

  async deleteById(userId: string) {
    return prisma.adminUser.delete({ where: { id: userId } });
  }

  // ── Sessions (per-device login) ──
  async createSession(data: { userId: string; refreshTokenHash: string; userAgent?: string | null; ipAddress?: string | null }) {
    return prisma.session.create({ data });
  }

  async findSessionById(id: string) {
    return prisma.session.findUnique({ where: { id } });
  }

  async updateSessionToken(id: string, refreshTokenHash: string) {
    return prisma.session.update({
      where: { id },
      data: { refreshTokenHash, lastSeenAt: new Date() },
    });
  }

  async listSessionsByUser(userId: string) {
    return prisma.session.findMany({
      where: { userId },
      orderBy: { lastSeenAt: 'desc' },
      select: { id: true, userAgent: true, ipAddress: true, createdAt: true, lastSeenAt: true },
    });
  }

  async deleteSession(id: string) {
    return prisma.session.delete({ where: { id } });
  }

  async deleteSessionsByUser(userId: string) {
    return prisma.session.deleteMany({ where: { userId } });
  }
}
