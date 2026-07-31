import createHttpError from 'http-errors';
import { AdminRole } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { KIND_ROLE, isServiceRole, type ServiceKind } from './performer.kind.js';
import type { z } from 'zod';
import type {
  updatePerformerProfileSchema, performerEventSchema, updatePerformerEventSchema,
  createPerformerBookingSchema,
} from './performer.schema.js';

type ProfileInput = z.infer<typeof updatePerformerProfileSchema>;
type EventInput = z.infer<typeof performerEventSchema>;
type EventPatch = z.infer<typeof updatePerformerEventSchema>;
type BookingInput = z.infer<typeof createPerformerBookingSchema>;

// Dates arrive as yyyy-mm-dd and are compared by day, so everything is pinned to
// UTC midnight. Parsing the bare string would otherwise land on the server's
// local midnight and shift the day for anyone east or west of it.
function parseDay(value: string): Date {
  const day = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(day.getTime())) throw createHttpError(400, 'Invalid date.');
  return day;
}

function dayRange(value: string): { gte: Date; lt: Date } {
  const start = parseDay(value);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { gte: start, lt: end };
}

// Performers and hosts share every method here; `kind` only ever selects which
// role the public queries filter on.
export class PerformerService {
  // ── Profile ────────────────────────────────────────────────────────────────

  // Everyone gets a profile row; it is created on first read rather than at
  // account creation so accounts made before this feature still work.
  async getOrCreateProfile(userId: string) {
    const existing = await prisma.performerProfile.findUnique({ where: { userId } });
    if (existing) return existing;
    const user = await prisma.adminUser.findUnique({ where: { id: userId }, select: { username: true } });
    if (!user) throw createHttpError(404, 'User not found');
    return prisma.performerProfile.create({
      data: { userId, displayName: user.username },
    });
  }

  async updateProfile(userId: string, data: ProfileInput) {
    await this.getOrCreateProfile(userId);
    return prisma.performerProfile.update({
      where: { userId },
      data: {
        ...(data.displayName !== undefined ? { displayName: data.displayName.trim() } : {}),
        ...(data.bio !== undefined ? { bio: data.bio?.trim() || null } : {}),
        ...(data.phone !== undefined ? { phone: data.phone?.trim() || null } : {}),
        ...(data.avatarUrl !== undefined ? { avatarUrl: data.avatarUrl?.trim() || null } : {}),
        ...(data.photos !== undefined ? { photos: data.photos } : {}),
        ...(data.videos !== undefined ? { videos: data.videos } : {}),
        ...(data.isVisible !== undefined ? { isVisible: data.isVisible } : {}),
      },
    });
  }

  // ── Calendar ───────────────────────────────────────────────────────────────

  async listEvents(performerId: string) {
    return prisma.performerEvent.findMany({
      where: { performerId },
      orderBy: [{ eventDate: 'asc' }, { eventTime: 'asc' }],
    });
  }

  async createEvent(performerId: string, data: EventInput) {
    return prisma.performerEvent.create({
      data: {
        performerId,
        eventDate: parseDay(data.eventDate),
        eventTime: data.eventTime.trim(),
        title: data.title.trim(),
        note: data.note?.trim() || null,
        program: data.program?.trim() || null,
      },
    });
  }

  async updateEvent(performerId: string, id: string, data: EventPatch) {
    const existing = await prisma.performerEvent.findUnique({ where: { id } });
    if (!existing || existing.performerId !== performerId) throw createHttpError(404, 'Event not found');
    return prisma.performerEvent.update({
      where: { id },
      data: {
        ...(data.eventDate !== undefined ? { eventDate: parseDay(data.eventDate) } : {}),
        ...(data.eventTime !== undefined ? { eventTime: data.eventTime.trim() } : {}),
        ...(data.title !== undefined ? { title: data.title.trim() } : {}),
        ...(data.note !== undefined ? { note: data.note?.trim() || null } : {}),
        ...(data.program !== undefined ? { program: data.program?.trim() || null } : {}),
      },
    });
  }

  async removeEvent(performerId: string, id: string) {
    const existing = await prisma.performerEvent.findUnique({ where: { id } });
    if (!existing || existing.performerId !== performerId) throw createHttpError(404, 'Event not found');
    await prisma.performerEvent.delete({ where: { id } });
  }

  // ── Bookings ───────────────────────────────────────────────────────────────

  async listBookings(performerId: string) {
    return prisma.performerBooking.findMany({
      where: { performerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async pendingBookingCount(performerId: string) {
    return prisma.performerBooking.count({ where: { performerId, status: 'PENDING' } });
  }

  // Accepting a booking also puts it in the calendar. Both writes happen in one
  // transaction so nobody can end up marked available for a date they have
  // already agreed to. The programme travels with it, so a host opens the
  // calendar entry and finds the running order the client sent.
  async decideBooking(performerId: string, id: string, status: 'ACCEPTED' | 'DECLINED') {
    const booking = await prisma.performerBooking.findUnique({ where: { id } });
    if (!booking || booking.performerId !== performerId) throw createHttpError(404, 'Booking not found');
    if (booking.status !== 'PENDING') throw createHttpError(409, 'This request has already been answered.');

    return prisma.$transaction(async (tx) => {
      const updated = await tx.performerBooking.update({ where: { id }, data: { status } });
      if (status === 'ACCEPTED') {
        await tx.performerEvent.create({
          data: {
            performerId,
            bookingId: booking.id,
            eventDate: booking.eventDate,
            eventTime: booking.eventTime,
            title: booking.restaurantName,
            note: booking.note,
            program: booking.program,
          },
        });
      }
      return updated;
    });
  }

  async createBooking(data: BookingInput) {
    const target = await prisma.adminUser.findUnique({
      where: { id: data.performerId },
      select: { id: true, role: true },
    });
    if (!target || !isServiceRole(target.role)) throw createHttpError(404, 'Not found');
    const program = data.program?.trim() || null;
    // A host is being asked to run the evening; without the programme they have
    // nothing to judge the request on, so the API refuses rather than letting a
    // half-filled request land in their inbox.
    if (target.role === AdminRole.HOST && !program) {
      throw createHttpError(400, 'An event programme is required when booking a host.');
    }
    return prisma.performerBooking.create({
      data: {
        performerId: target.id,
        restaurantName: data.restaurantName.trim(),
        contactName: data.contactName.trim(),
        phone: data.phone.trim(),
        eventDate: parseDay(data.eventDate),
        eventTime: data.eventTime.trim(),
        eventType: data.eventType?.trim() || null,
        note: data.note?.trim() || null,
        // Performers are never asked for one, so it is dropped rather than
        // stored if a caller sends it anyway.
        program: target.role === AdminRole.HOST ? program : null,
        restaurantId: data.restaurantId?.trim() || null,
        eventNumber: data.eventNumber ?? null,
      },
      select: { id: true, createdAt: true },
    });
  }

  // ── Public listing ─────────────────────────────────────────────────────────

  // Everyone of the requested kind who is visible, plus whether they are free on
  // `date`. Busy means a calendar entry that day — accepted bookings are
  // calendar entries too, so one check covers both.
  //
  // Driven off AdminUser, NOT PerformerProfile. The role is what makes someone a
  // performer or a host; the profile is decoration. Querying profiles instead
  // meant an account whose profile row did not exist yet was invisible to
  // guests, which is not a state anyone would expect or could diagnose.
  async listPublic(kind: ServiceKind, date?: string) {
    const users = await prisma.adminUser.findMany({
      where: {
        role: KIND_ROLE[kind],
        // A missing profile counts as visible — the switch is opt-out.
        OR: [{ performerProfile: { isVisible: true } }, { performerProfile: { is: null } }],
      },
      select: { id: true, username: true, performerProfile: true },
    });

    const profiles = users
      .map((u) => ({
        userId: u.id,
        displayName: u.performerProfile?.displayName || u.username,
        avatarUrl: u.performerProfile?.avatarUrl ?? null,
        photos: u.performerProfile?.photos ?? [],
        videos: u.performerProfile?.videos ?? [],
      }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));

    let busy = new Set<string>();
    if (date) {
      const taken = await prisma.performerEvent.findMany({
        where: { eventDate: dayRange(date) },
        select: { performerId: true },
      });
      busy = new Set(taken.map((t) => t.performerId));
    }

    return profiles.map((p) => ({
      id: p.userId,
      displayName: p.displayName,
      avatarUrl: p.avatarUrl,
      photoCount: Array.isArray(p.photos) ? p.photos.length : 0,
      videoCount: Array.isArray(p.videos) ? p.videos.length : 0,
      // Undefined when no date was asked for, so the UI can tell "free" apart
      // from "not asked".
      available: date ? !busy.has(p.userId) : undefined,
    }));
  }

  async getPublic(kind: ServiceKind, userId: string) {
    // Same reasoning as listPublic: resolve the account, then their profile if
    // one exists, so a profile-less account still opens rather than 404ing.
    const user = await prisma.adminUser.findUnique({
      where: { id: userId },
      select: { id: true, username: true, role: true, performerProfile: true },
    });
    // The role must match the kind that was asked for, so a host cannot be
    // fetched through the performers path and shown in the wrong block.
    if (!user || user.role !== KIND_ROLE[kind]) throw createHttpError(404, 'Not found');
    if (user.performerProfile && !user.performerProfile.isVisible) throw createHttpError(404, 'Not found');

    // The phone IS public here, by product decision: guests browsing want to
    // reach them directly, not only through a booking request. It is shown on
    // the profile view only, never in the list.
    return {
      id: user.id,
      displayName: user.performerProfile?.displayName || user.username,
      bio: user.performerProfile?.bio ?? null,
      phone: user.performerProfile?.phone ?? null,
      avatarUrl: user.performerProfile?.avatarUrl ?? null,
      photos: user.performerProfile?.photos ?? [],
      videos: user.performerProfile?.videos ?? [],
    };
  }
}
