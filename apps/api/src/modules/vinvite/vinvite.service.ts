import bcrypt from 'bcryptjs';
import createHttpError from 'http-errors';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { prisma } from '../../db/prisma.js';
import { forwardRsvp } from '../telegram/telegram.service.js';

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '30d';

// Names that can never be claimed as a published invitation slug. Links are
// path-based (v-invite.uz/<slug>), so every app route must be reserved too.
const RESERVED_SLUGS = new Set([
  'www', 'api', 'admin', 'app', 'login', 'register', 'logout', 'mail',
  'static', 'assets', 'help', 'support', 'uploads',
  'templates', 'devices', 'profile', 'projects', 'invitations', 'settings',
]);

export type InviteAuthResponse = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: PublicUser;
};

export type PublicUser = {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  // "USER" | "SYSTEM_ADMIN" — gates the Design+ tools in the rich editor.
  role: string;
  hasPassword: boolean;
  googleLinked: boolean;
  createdAt: Date;
};

export type DeviceInfo = { userAgent?: string | null; ipAddress?: string | null };

type DbUser = {
  id: string; email: string; username: string; passwordHash: string | null;
  googleId: string | null; displayName: string | null; avatarUrl: string | null;
  role: string; createdAt: Date;
};

function toPublicUser(u: DbUser): PublicUser {
  return {
    id: u.id, email: u.email, username: u.username,
    displayName: u.displayName, avatarUrl: u.avatarUrl,
    role: u.role,
    hasPassword: !!u.passwordHash, googleLinked: !!u.googleId,
    createdAt: u.createdAt,
  };
}

export class VInviteAuthService {
  async register(email: string, username: string, password: string, device: DeviceInfo = {}): Promise<InviteAuthResponse> {
    const normalizedEmail = email.trim().toLowerCase();
    const emailTaken = await prisma.inviteUser.findUnique({ where: { email: normalizedEmail } });
    if (emailTaken) throw createHttpError(409, 'An account with this email already exists');
    const usernameTaken = await prisma.inviteUser.findUnique({ where: { username } });
    if (usernameTaken) throw createHttpError(409, 'Username already taken');

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.inviteUser.create({ data: { email: normalizedEmail, username, passwordHash } });
    return this.issueTokenPair(user, { device });
  }

  async login(identifier: string, password: string, device: DeviceInfo = {}): Promise<InviteAuthResponse> {
    const id = identifier.trim();
    const user = id.includes('@')
      ? await prisma.inviteUser.findUnique({ where: { email: id.toLowerCase() } })
      : await prisma.inviteUser.findUnique({ where: { username: id } });
    if (!user?.passwordHash) throw createHttpError(401, 'Invalid credentials');

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw createHttpError(401, 'Invalid credentials');

    return this.issueTokenPair(user, { device });
  }

  // Sign in / register with a Google Identity Services ID-token credential.
  // Verified server-side against Google's tokeninfo endpoint; the audience must
  // match our configured OAuth client ID.
  async googleAuth(credential: string, device: DeviceInfo = {}): Promise<InviteAuthResponse> {
    if (!env.GOOGLE_CLIENT_ID) throw createHttpError(501, 'Google sign-in is not configured');

    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
    if (!res.ok) throw createHttpError(401, 'Invalid Google credential');
    const info = (await res.json()) as {
      aud?: string; sub?: string; email?: string; email_verified?: string;
      name?: string; picture?: string; exp?: string;
    };
    if (info.aud !== env.GOOGLE_CLIENT_ID || !info.sub || !info.email) {
      throw createHttpError(401, 'Invalid Google credential');
    }
    if (info.email_verified !== 'true') throw createHttpError(401, 'Google email is not verified');

    const email = info.email.toLowerCase();
    let user = await prisma.inviteUser.findUnique({ where: { googleId: info.sub } });
    if (!user) {
      // Same email registered with a password → link the Google account to it.
      const byEmail = await prisma.inviteUser.findUnique({ where: { email } });
      if (byEmail) {
        user = await prisma.inviteUser.update({
          where: { id: byEmail.id },
          data: {
            googleId: info.sub,
            displayName: byEmail.displayName ?? info.name ?? null,
            avatarUrl: byEmail.avatarUrl ?? info.picture ?? null,
          },
        });
      } else {
        user = await prisma.inviteUser.create({
          data: {
            email,
            username: await this.uniqueUsernameFromEmail(email),
            googleId: info.sub,
            displayName: info.name ?? null,
            avatarUrl: info.picture ?? null,
          },
        });
      }
    }
    return this.issueTokenPair(user, { device });
  }

  async refresh(providedRefreshToken: string): Promise<InviteAuthResponse> {
    let decoded: { sub?: string; sid?: string; type?: string };
    try {
      decoded = jwt.verify(providedRefreshToken, env.JWT_SECRET) as typeof decoded;
    } catch {
      throw createHttpError(401, 'Invalid or expired refresh token');
    }
    if (decoded.type !== 'invite-refresh' || !decoded.sid) throw createHttpError(401, 'Invalid token type');

    const session = await prisma.inviteSession.findUnique({ where: { id: decoded.sid } });
    if (!session) throw createHttpError(401, 'Session not found');

    const valid = await bcrypt.compare(providedRefreshToken, session.refreshTokenHash);
    if (!valid) throw createHttpError(401, 'Invalid or expired refresh token');

    const user = await prisma.inviteUser.findUnique({ where: { id: session.userId } });
    if (!user) throw createHttpError(401, 'User not found');

    await prisma.inviteSession.update({ where: { id: session.id }, data: { lastUsedAt: new Date() } });
    return this.issueTokenPair(user, { sessionId: session.id });
  }

  async logout(sessionId: string | null): Promise<void> {
    if (!sessionId) return;
    await prisma.inviteSession.deleteMany({ where: { id: sessionId } });
  }

  async me(userId: string): Promise<PublicUser> {
    const user = await prisma.inviteUser.findUnique({ where: { id: userId } });
    if (!user) throw createHttpError(404, 'User not found');
    return toPublicUser(user);
  }

  async listSessions(userId: string, currentSessionId: string | null) {
    const sessions = await prisma.inviteSession.findMany({
      where: { userId },
      orderBy: { lastUsedAt: 'desc' },
      select: { id: true, userAgent: true, ipAddress: true, createdAt: true, lastUsedAt: true },
    });
    return sessions.map((s) => ({ ...s, isCurrent: s.id === currentSessionId }));
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const session = await prisma.inviteSession.findUnique({ where: { id: sessionId } });
    if (!session || session.userId !== userId) throw createHttpError(404, 'Session not found');
    await prisma.inviteSession.delete({ where: { id: sessionId } });
  }

  async updateProfile(
    userId: string,
    payload: { displayName?: string | null; username?: string; currentPassword?: string; newPassword?: string }
  ): Promise<PublicUser> {
    const user = await prisma.inviteUser.findUnique({ where: { id: userId } });
    if (!user) throw createHttpError(404, 'User not found');

    const updates: { displayName?: string | null; username?: string; passwordHash?: string } = {};

    if (payload.displayName !== undefined) updates.displayName = payload.displayName;

    if (payload.username !== undefined && payload.username !== user.username) {
      const taken = await prisma.inviteUser.findUnique({ where: { username: payload.username } });
      if (taken) throw createHttpError(409, 'Username already taken');
      updates.username = payload.username;
    }

    if (payload.newPassword !== undefined) {
      // Accounts that already have a password must confirm it to change it.
      if (user.passwordHash) {
        if (!payload.currentPassword) throw createHttpError(400, 'Current password is required');
        const ok = await bcrypt.compare(payload.currentPassword, user.passwordHash);
        if (!ok) throw createHttpError(401, 'Current password is incorrect');
      }
      updates.passwordHash = await bcrypt.hash(payload.newPassword, 12);
    }

    const updated = await prisma.inviteUser.update({ where: { id: userId }, data: updates });
    return toPublicUser(updated);
  }

  private async uniqueUsernameFromEmail(email: string): Promise<string> {
    const base = (email.split('@')[0] ?? 'user')
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, '')
      .slice(0, 24) || 'user';
    let candidate = base;
    for (let i = 0; i < 50; i += 1) {
      const taken = await prisma.inviteUser.findUnique({ where: { username: candidate } });
      if (!taken) return candidate;
      candidate = `${base}${Math.floor(Math.random() * 10000)}`;
    }
    return `user${Date.now()}`;
  }

  private async issueTokenPair(user: DbUser, opts: { sessionId?: string; device?: DeviceInfo }): Promise<InviteAuthResponse> {
    let sessionId = opts.sessionId;
    if (!sessionId) {
      const session = await prisma.inviteSession.create({
        data: {
          userId: user.id,
          refreshTokenHash: '',
          userAgent: opts.device?.userAgent ?? null,
          ipAddress: opts.device?.ipAddress ?? null,
        },
      });
      sessionId = session.id;
    }

    const accessToken = jwt.sign(
      { sub: user.id, username: user.username, sid: sessionId, type: 'invite-access' },
      env.JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRY }
    );
    const refreshToken = jwt.sign(
      { sub: user.id, sid: sessionId, type: 'invite-refresh' },
      env.JWT_SECRET,
      { expiresIn: REFRESH_TOKEN_EXPIRY }
    );

    const refreshTokenHash = await bcrypt.hash(refreshToken, 12);
    await prisma.inviteSession.update({ where: { id: sessionId }, data: { refreshTokenHash } });

    const decoded = jwt.decode(accessToken) as { exp?: number } | null;
    const expiresIn = decoded?.exp ? decoded.exp * 1000 - Date.now() : 15 * 60 * 1000;

    return { accessToken, refreshToken, expiresIn, user: toPublicUser(user) };
  }
}

// ── Projects & templates ──────────────────────────────────────────────────────

export class VInviteProjectService {
  async listMine(userId: string) {
    const projects = await prisma.inviteProject.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true, name: true, slug: true, isPublished: true,
        createdAt: true, updatedAt: true, views: true, theme: true,
      },
    });
    const ids = projects.map((p) => p.id);
    if (ids.length === 0) {
      return projects.map((p) => ({ ...p, rsvpCount: 0, guestCount: 0, wishCount: 0 }));
    }
    // One groupBy for totals + guest sum, one for the messages ("wishes") count.
    const [totals, wishes] = await Promise.all([
      prisma.inviteRsvp.groupBy({
        by: ['projectId'], where: { projectId: { in: ids } },
        _count: { _all: true }, _sum: { guests: true },
      }),
      prisma.inviteRsvp.groupBy({
        by: ['projectId'], where: { projectId: { in: ids }, message: { not: null } },
        _count: { _all: true },
      }),
    ]);
    const totalMap = new Map(totals.map((t) => [t.projectId, t]));
    const wishMap = new Map(wishes.map((w) => [w.projectId, w._count._all]));
    return projects.map((p) => ({
      ...p,
      rsvpCount: totalMap.get(p.id)?._count._all ?? 0,
      guestCount: totalMap.get(p.id)?._sum.guests ?? 0,
      wishCount: wishMap.get(p.id) ?? 0,
    }));
  }

  async getMine(userId: string, id: string) {
    const project = await prisma.inviteProject.findUnique({ where: { id } });
    if (!project || project.userId !== userId) throw createHttpError(404, 'Project not found');
    return project;
  }

  create(userId: string, data: { name: string; blocks?: unknown; theme?: unknown }) {
    return prisma.inviteProject.create({
      data: {
        userId,
        name: data.name,
        blocks: (data.blocks ?? []) as object,
        theme: (data.theme ?? {}) as object,
      },
    });
  }

  async isSlugAvailable(slug: string, forProjectId?: string): Promise<boolean> {
    if (RESERVED_SLUGS.has(slug)) return false;
    const existing = await prisma.inviteProject.findUnique({ where: { slug } });
    return !existing || existing.id === forProjectId;
  }

  async update(
    userId: string,
    id: string,
    data: { name?: string; slug?: string | null; isPublished?: boolean; blocks?: unknown; theme?: unknown }
  ) {
    const project = await this.getMine(userId, id);

    if (data.slug !== undefined && data.slug !== null && data.slug !== project.slug) {
      const available = await this.isSlugAvailable(data.slug, id);
      if (!available) throw createHttpError(409, 'This name is already taken');
    }
    // Publishing requires a claimed slug.
    if (data.isPublished === true && !(data.slug ?? project.slug)) {
      throw createHttpError(400, 'Choose a link name before publishing');
    }

    return prisma.inviteProject.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.slug !== undefined ? { slug: data.slug } : {}),
        ...(data.isPublished !== undefined ? { isPublished: data.isPublished } : {}),
        ...(data.blocks !== undefined ? { blocks: data.blocks as object } : {}),
        ...(data.theme !== undefined ? { theme: data.theme as object } : {}),
      },
    });
  }

  async remove(userId: string, id: string) {
    await this.getMine(userId, id);
    await prisma.inviteProject.delete({ where: { id } });
  }

  // Public site payload for v-invite.uz/<slug>.
  /**
   * Data for the Open Graph card that chat apps (Telegram, WhatsApp) render when
   * an invitation link is shared. Their crawlers do not execute JavaScript, so
   * the published SPA route cannot supply this — it has to come from the server.
   */
  async getShareCard(slug: string, origin: string) {
    const project = await prisma.inviteProject.findUnique({
      where: { slug },
      select: { name: true, slug: true, isPublished: true, theme: true },
    });
    if (!project || !project.isPublished) throw createHttpError(404, 'Invitation not found');

    const theme = (project.theme ?? {}) as Record<string, unknown>;
    const config = (theme.config ?? {}) as Record<string, unknown>;
    const abs = (url: unknown): string | null => {
      if (typeof url !== 'string' || !url.trim()) return null;
      if (/^https?:\/\//i.test(url)) return url;
      return origin + (url.startsWith('/') ? url : '/' + url);
    };

    // Prefer something the host actually chose, in the order a guest would
    // recognise it; otherwise fall back to the bundled card.
    const gallery = Array.isArray(config.gallery) ? (config.gallery as Record<string, unknown>[]) : [];
    const venue = (config.venue ?? {}) as Record<string, unknown>;
    const image =
      abs(gallery.find((g) => g && typeof g.image === 'string' && g.image)?.image) ??
      abs(venue.image) ??
      abs(theme.backgroundImageUrl) ??
      origin + '/share-cover.jpg';

    return {
      title: project.name,
      url: origin + '/' + project.slug,
      image,
    };
  }

  async getPublicBySlug(slug: string) {
    const project = await prisma.inviteProject.findUnique({
      where: { slug },
      select: { name: true, slug: true, isPublished: true, blocks: true, theme: true, updatedAt: true },
    });
    if (!project || !project.isPublished) throw createHttpError(404, 'Invitation not found');
    // Best-effort view counter — never block the page render on it. (Not
    // deduped by visitor; adequate for the dashboard's rough "views" stat.)
    void prisma.inviteProject.update({ where: { slug }, data: { views: { increment: 1 } } }).catch(() => undefined);
    return project;
  }

  // Guest RSVP from a published invitation (no auth).
  async submitRsvp(
    slug: string,
    data: { name: string; attending: boolean; guests?: number; dietary?: string; message?: string }
  ) {
    const project = await prisma.inviteProject.findUnique({
      where: { slug },
      select: { id: true, isPublished: true },
    });
    if (!project || !project.isPublished) throw createHttpError(404, 'Invitation not found');

    const created = await prisma.inviteRsvp.create({
      data: {
        projectId: project.id,
        guestName: data.name,
        attending: data.attending,
        guests: data.attending ? (data.guests ?? 1) : 0,
        dietary: data.dietary?.trim() || null,
        message: data.message?.trim() || null,
      },
      select: { id: true, createdAt: true },
    });
    // Fire-and-forget: Telegram delivery must never fail the RSVP.
    void forwardRsvp(project.id, {
      guestName: data.name,
      attending: data.attending,
      guests: data.attending ? (data.guests ?? 1) : 0,
      dietary: data.dietary?.trim() || null,
      message: data.message?.trim() || null,
    }).catch(() => undefined);
    return created;
  }

  // The owner's response list for one of their projects.
  async listRsvps(userId: string, projectId: string) {
    await this.getMine(userId, projectId);
    return prisma.inviteRsvp.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async removeRsvp(userId: string, projectId: string, rsvpId: string) {
    await this.getMine(userId, projectId);
    await prisma.inviteRsvp.deleteMany({ where: { id: rsvpId, projectId } });
  }
}

export class VInviteTemplateService {
  listMine(userId: string) {
    return prisma.inviteTemplate.findMany({ where: { userId }, orderBy: { updatedAt: 'desc' } });
  }

  async getMine(userId: string, id: string) {
    const tpl = await prisma.inviteTemplate.findUnique({ where: { id } });
    if (!tpl || tpl.userId !== userId) throw createHttpError(404, 'Template not found');
    return tpl;
  }

  create(userId: string, data: { name: string; blocks?: unknown; theme?: unknown }) {
    return prisma.inviteTemplate.create({
      data: {
        userId,
        name: data.name,
        blocks: (data.blocks ?? []) as object,
        theme: (data.theme ?? {}) as object,
      },
    });
  }

  async update(userId: string, id: string, data: { name?: string; blocks?: unknown; theme?: unknown }) {
    await this.getMine(userId, id);
    return prisma.inviteTemplate.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.blocks !== undefined ? { blocks: data.blocks as object } : {}),
        ...(data.theme !== undefined ? { theme: data.theme as object } : {}),
      },
    });
  }

  async remove(userId: string, id: string) {
    await this.getMine(userId, id);
    await prisma.inviteTemplate.delete({ where: { id } });
  }
}

// ── Built-in template design overrides (system administrators) ────────────────
// A SYSTEM_ADMIN can re-design a first-party rich template; the stored config
// replaces the template's defaultConfig for template cards, previews and every
// newly created invitation. Reads are public (the templates page needs them
// before login); writes are role-gated.
export class VInviteTemplateOverrideService {
  list() {
    return prisma.inviteTemplateOverride.findMany({
      select: { templateId: true, config: true, updatedAt: true },
    });
  }

  async save(userId: string, templateId: string, config: Record<string, unknown>) {
    const user = await prisma.inviteUser.findUnique({ where: { id: userId }, select: { role: true } });
    if (user?.role !== 'SYSTEM_ADMIN') throw createHttpError(403, 'System administrators only');
    return prisma.inviteTemplateOverride.upsert({
      where: { templateId },
      create: { templateId, config: config as object },
      update: { config: config as object },
      select: { templateId: true, config: true, updatedAt: true },
    });
  }
}

// How the built-in templates are presented on the promotional site. Read by
// logged-out visitors, written only by a SYSTEM_ADMIN.
const PROMO_SCOPE = 'landing';

export class VInvitePromoShowcaseService {
  // Absent row means "shipped defaults" — three empty lists, which the web side
  // resolves to registry order with the first templates on the cover. Returning
  // this rather than 404ing keeps the landing page free of error handling for
  // what is simply the initial state.
  async get() {
    const row = await prisma.invitePromoShowcase.findUnique({
      where: { scope: PROMO_SCOPE },
      select: { coverIds: true, orderIds: true, hiddenIds: true, updatedAt: true },
    });
    if (!row) return { coverIds: [], orderIds: [], hiddenIds: [], updatedAt: null };
    return {
      coverIds: asIdList(row.coverIds),
      orderIds: asIdList(row.orderIds),
      hiddenIds: asIdList(row.hiddenIds),
      updatedAt: row.updatedAt,
    };
  }

  async save(
    userId: string,
    data: { coverIds: string[]; orderIds: string[]; hiddenIds: string[] },
  ) {
    const user = await prisma.inviteUser.findUnique({ where: { id: userId }, select: { role: true } });
    if (user?.role !== 'SYSTEM_ADMIN') throw createHttpError(403, 'System administrators only');

    // De-duplicate rather than reject: the form can only produce duplicates
    // through a race, and silently collapsing them is friendlier than a 400 the
    // admin cannot act on.
    const clean = {
      coverIds: unique(data.coverIds),
      orderIds: unique(data.orderIds),
      hiddenIds: unique(data.hiddenIds),
    };
    await prisma.invitePromoShowcase.upsert({
      where: { scope: PROMO_SCOPE },
      create: { scope: PROMO_SCOPE, ...clean },
      update: clean,
    });
    return this.get();
  }
}

// The columns are JSON, so anything could be in them; keep only strings.
function asIdList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

function unique(ids: string[]): string[] {
  return [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
}
