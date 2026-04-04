import createHttpError from 'http-errors';
export class PricingService {
    eventRepository;
    constructor(eventRepository) {
        this.eventRepository = eventRepository;
    }
    async calculateEventPricing(eventId) {
        const event = await this.eventRepository.getByNumber(eventId);
        if (!event) {
            throw createHttpError(404, 'Event not found');
        }
        const subtotalCents = event.selections.reduce((sum, selection) => {
            return sum + selection.quantity * selection.unitPriceCents;
        }, 0);
        const serviceFeeCents = Math.round(subtotalCents * 0.1);
        const taxCents = Math.round((subtotalCents + serviceFeeCents) * 0.12);
        const totalCents = subtotalCents + serviceFeeCents + taxCents;
        return {
            eventId: event.id,
            guestCount: event.guestCount,
            subtotalCents,
            serviceFeeCents,
            taxCents,
            totalCents,
            perGuestCents: event.guestCount > 0 ? Math.round(totalCents / event.guestCount) : totalCents
        };
    }
}
