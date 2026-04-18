import { EventRepository } from '../events/event.repository.js';
import { eventIdSchema } from '../events/event.schema.js';
import { PricingService } from './pricing.service.js';
const pricingService = new PricingService(new EventRepository());
export class PricingController {
    async getPricing(request, response) {
        const { eventId } = eventIdSchema.parse(request.params);
        const pricing = await pricingService.calculateEventPricing(request.restaurantId, eventId);
        response.json(pricing);
    }
}
