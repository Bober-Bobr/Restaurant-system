import type { Request, Response } from 'express';
import { DEFAULT_SECTION, type Section } from '../../utils/section.js';
import { EventRepository } from '../events/event.repository.js';
import { eventIdSchema } from '../events/event.schema.js';
import { PricingService } from './pricing.service.js';

const pricingService = new PricingService(new EventRepository());

const sectionOf = (request: Request) => request.section ?? DEFAULT_SECTION;

export class PricingController {
  async getPricing(request: Request, response: Response) {
    const { eventId } = eventIdSchema.parse(request.params);
    const pricing = await pricingService.calculateEventPricing(request.restaurantId!, sectionOf(request), eventId);

    response.json(pricing);
  }
}
