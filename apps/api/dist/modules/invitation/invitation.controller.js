import createHttpError from 'http-errors';
import { InvitationRepository } from './invitation.repository.js';
import { createInvitationSchema, updateInvitationSchema } from './invitation.schema.js';
const repo = new InvitationRepository();
// Convert undefined → null for JSON columns so Prisma replaces, not skips.
function normalizeJsonFields(input) {
    const out = { ...input };
    if ('countdownAt' in out && typeof out.countdownAt === 'string') {
        out.countdownAt = new Date(out.countdownAt);
    }
    return out;
}
export class InvitationController {
    async listByRestaurant(request, response) {
        const restaurantId = String(request.query.restaurantId ?? '').trim();
        if (!restaurantId) {
            response.status(400).json({ message: 'restaurantId required' });
            return;
        }
        response.json(await repo.listByRestaurant(restaurantId));
    }
    async getByEvent(request, response) {
        const eventIdOrNumber = String(request.params.eventId);
        const restaurantId = String(request.query.restaurantId ?? '').trim();
        if (!restaurantId) {
            response.status(400).json({ message: 'restaurantId required' });
            return;
        }
        const cuid = await repo.resolveEventId(eventIdOrNumber, restaurantId);
        if (!cuid) {
            response.status(404).json({ message: 'Event not found' });
            return;
        }
        const invitation = await repo.findByEventId(cuid);
        if (!invitation) {
            response.status(404).json({ message: 'No invitation for this event' });
            return;
        }
        response.json(invitation);
    }
    async getById(request, response) {
        const invitation = await repo.findById(String(request.params.id));
        if (!invitation) {
            response.status(404).json({ message: 'Not found' });
            return;
        }
        response.json(invitation);
    }
    async create(request, response) {
        const admin = request.admin;
        const data = createInvitationSchema.parse(request.body);
        const slugTaken = await repo.existsSlug(data.slug);
        if (slugTaken)
            throw createHttpError(409, 'Slug already in use');
        const resolvedEventId = await repo.resolveEventId(data.eventId, data.restaurantId);
        if (data.eventId && !resolvedEventId) {
            throw createHttpError(404, 'Event not found for this restaurant');
        }
        const created = await repo.create({
            ...normalizeJsonFields(data),
            eventId: resolvedEventId,
            createdById: admin.id,
            menuItems: (data.menuItems ?? []),
            galleryPhotos: (data.galleryPhotos ?? []),
        });
        response.status(201).json(created);
    }
    async update(request, response) {
        const id = String(request.params.id);
        const data = updateInvitationSchema.parse(request.body);
        if (data.slug) {
            const taken = await repo.existsSlug(data.slug, id);
            if (taken)
                throw createHttpError(409, 'Slug already in use');
        }
        const updated = await repo.update(id, {
            ...normalizeJsonFields(data),
            ...(data.menuItems !== undefined ? { menuItems: data.menuItems } : {}),
            ...(data.galleryPhotos !== undefined ? { galleryPhotos: data.galleryPhotos } : {}),
        });
        response.json(updated);
    }
    async remove(request, response) {
        await repo.delete(String(request.params.id));
        response.status(204).send();
    }
    // Public: by slug
    async publicBySlug(request, response) {
        const invitation = await repo.findBySlug(String(request.params.slug));
        if (!invitation || !invitation.isPublished) {
            response.status(404).json({ message: 'Not found' });
            return;
        }
        response.json(invitation);
    }
}
