import createHttpError from 'http-errors';
import { AdminRole } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
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

export class PerformerService {
  // ── Profile ────────────────────────────────────────────────────────────────

  // Every performer has a profile row; it is created on first read rather than
  // at account creation so accounts made before this feature still work.
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
        ...(data.craft !== undefined ? { craft: data.craft?.trim() || null } : {}),
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
  // transaction so a performer can never end up marked available for a date
  // they have already agreed to.
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
          },
        });
      }
      return updated;
    });
  }

  async createBooking(data: BookingInput) {
    const performer = await prisma.adminUser.findUnique({
      where: { id: data.performerId },
      select: { id: true, role: true },
    });
    if (!performer || performer.role !== AdminRole.PERFORMER) {
      throw createHttpError(404, 'Performer not found');
    }
    return prisma.performerBooking.create({
      data: {
        performerId: performer.id,
        restaurantName: data.restaurantName.trim(),
        contactName: data.contactName.trim(),
        phone: data.phone.trim(),
        eventDate: parseDay(data.eventDate),
        eventTime: data.eventTime.trim(),
        eventType: data.eventType?.trim() || null,
        note: data.note?.trim() || null,
        restaurantId: data.restaurantId?.trim() || null,
        eventNumber: data.eventNumber ?? null,
      },
      select: { id: true, createdAt: true },
    });
  }

  // ── Public listing ─────────────────────────────────────────────────────────

  // Every visible performer, plus whether they are free on `date`. Busy means a
  // calendar entry that day — accepted bookings are calendar entries too, so
  // one check covers both.
  async listPublic(date?: string) {
    const profiles = await prisma.performerProfile.findMany({
      where: { isVisible: true, user: { role: AdminRole.PERFORMER } },
      orderBy: { displayName: 'asc' },
    });

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
      craft: p.craft,
      avatarUrl: p.avatarUrl,
      photoCount: Array.isArray(p.photos) ? p.photos.length : 0,
      videoCount: Array.isArray(p.videos) ? p.videos.length : 0,
      // Undefined when no date was asked for, so the UI can tell "free" apart
      // from "not asked".
      available: date ? !busy.has(p.userId) : undefined,
    }));
  }

  async getPublic(userId: string) {
    const profile = await prisma.performerProfile.findUnique({
      where: { userId },
      select: {
        userId: true, displayName: true, craft: true, bio: true,
        avatarUrl: true, photos: true, videos: true, isVisible: true,
      },
    });
    if (!profile || !profile.isVisible) throw createHttpError(404, 'Performer not found');
    // The phone is deliberately absent: guests reach a performer through a
    // booking request, not by calling them directly.
    return {
      id: profile.userId,
      displayName: profile.displayName,
      craft: profile.craft,
      bio: profile.bio,
      avatarUrl: profile.avatarUrl,
      photos: profile.photos,
      videos: profile.videos,
    };
  }
}
