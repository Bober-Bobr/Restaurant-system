import type { Request, Response } from 'express';
import { EventRepository } from '../events/event.repository.js';
import { eventIdSchema } from '../events/event.schema.js';
import { PricingService } from '../pricing/pricing.service.js';
import { ExportService } from './export.service.js';

const eventRepository = new EventRepository();
const exportService = new ExportService(eventRepository, new PricingService(eventRepository));

export class ExportController {
  async excel(request: Request, response: Response) {
    const { eventId } = eventIdSchema.parse(request.params);
    const file = await exportService.createEventExcel(eventId);

    response.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    response.setHeader('Content-Disposition', `attachment; filename="event-${eventId}.xlsx"`);
    response.send(file);
  }

  async pdf(request: Request, response: Response) {
    const { eventId } = eventIdSchema.parse(request.params);
    const file = await exportService.createEventPdf(eventId);

    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader('Content-Disposition', `attachment; filename="event-${eventId}.pdf"`);
    response.send(file);
  }
}
