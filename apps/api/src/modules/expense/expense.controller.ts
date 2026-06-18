import type { Request, Response } from 'express';
import createHttpError from 'http-errors';
import { ExpenseRepository } from './expense.repository.js';
import { ExpenseService } from './expense.service.js';
import { generateCombinedPdf, generateExtrasPdf } from './expense.pdf.service.js';
import { type Locale, locales } from '../../utils/translate.js';
import {
  createDaySchema,
  createLineSchema,
  createProductSchema,
  eventIdSchema,
  idSchema,
  pdfSelectionSchema,
  updateDaySchema,
  updateEventSchema,
  updateLineSchema,
  updateProductSchema
} from './expense.schema.js';

const service = new ExpenseService(new ExpenseRepository());

function resolveLocale(value: unknown): Locale {
  return (locales as readonly string[]).includes(String(value)) ? (value as Locale) : 'en';
}

// The ledger is scoped to the calling Restaurant Manager (request.admin.id).
export class ExpenseController {
  async listDays(request: Request, response: Response) {
    response.json(await service.listDays(request.admin!.id));
  }

  async createDay(request: Request, response: Response) {
    const { date } = createDaySchema.parse(request.body);
    response.status(201).json(await service.createDay(request.admin!.id, date));
  }

  // Export the selected days' main expenses as one multi-page PDF. Days are never
  // closed by this action.
  async pdfSelection(request: Request, response: Response) {
    const { dayIds } = pdfSelectionSchema.parse(request.body);
    const locale = resolveLocale(request.query.locale);
    const { rows, fromDate, endDate } = await service.selectionForExport(request.admin!.id, dayIds);
    if (rows.length === 0) throw createHttpError(404, 'No days to export');

    const file = await generateCombinedPdf(rows, { from: fromDate, to: endDate }, locale);
    const filename = rows.length === 1 ? `${rows[0].date}.pdf` : `ledger-${fromDate}_${endDate}.pdf`;
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    response.send(file);
  }

  // Export the selected days' additional (day-level) expenses as one PDF.
  async pdfExtrasSelection(request: Request, response: Response) {
    const { dayIds } = pdfSelectionSchema.parse(request.body);
    const locale = resolveLocale(request.query.locale);
    const { rows, fromDate, endDate } = await service.selectionForExport(request.admin!.id, dayIds);
    if (rows.length === 0) throw createHttpError(404, 'No days to export');

    const file = await generateExtrasPdf(rows, { from: fromDate, to: endDate }, locale);
    const filename = rows.length === 1 ? `${rows[0].date}-extras.pdf` : `extras-${fromDate}_${endDate}.pdf`;
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    response.send(file);
  }

  async updateDay(request: Request, response: Response) {
    const { id } = idSchema.parse(request.params);
    const payload = updateDaySchema.parse(request.body);
    response.json(await service.updateDay(request.admin!.id, id, payload));
  }

  async closeDay(request: Request, response: Response) {
    const { id } = idSchema.parse(request.params);
    response.json(await service.closeDay(request.admin!.id, id));
  }

  async reopenDay(request: Request, response: Response) {
    const { id } = idSchema.parse(request.params);
    response.json(await service.reopenDay(request.admin!.id, id));
  }

  async removeDay(request: Request, response: Response) {
    const { id } = idSchema.parse(request.params);
    await service.removeDay(request.admin!.id, id);
    response.status(204).send();
  }

  async updateEvent(request: Request, response: Response) {
    const { id } = idSchema.parse(request.params);
    const payload = updateEventSchema.parse(request.body);
    response.json(await service.updateEvent(request.admin!.id, id, payload));
  }

  async addProduct(request: Request, response: Response) {
    const { eventId } = eventIdSchema.parse(request.params);
    const payload = createProductSchema.parse(request.body);
    response.status(201).json(await service.addProduct(request.admin!.id, eventId, payload));
  }

  async updateProduct(request: Request, response: Response) {
    const { id } = idSchema.parse(request.params);
    const payload = updateProductSchema.parse(request.body);
    response.json(await service.updateProduct(request.admin!.id, id, payload));
  }

  async removeProduct(request: Request, response: Response) {
    const { id } = idSchema.parse(request.params);
    await service.removeProduct(request.admin!.id, id);
    response.status(204).send();
  }

  async addSalary(request: Request, response: Response) {
    const { eventId } = eventIdSchema.parse(request.params);
    const payload = createLineSchema.parse(request.body);
    response.status(201).json(await service.addSalary(request.admin!.id, eventId, payload));
  }

  async updateSalary(request: Request, response: Response) {
    const { id } = idSchema.parse(request.params);
    const payload = updateLineSchema.parse(request.body);
    response.json(await service.updateSalary(request.admin!.id, id, payload));
  }

  async removeSalary(request: Request, response: Response) {
    const { id } = idSchema.parse(request.params);
    await service.removeSalary(request.admin!.id, id);
    response.status(204).send();
  }

  async addAdditional(request: Request, response: Response) {
    const { eventId } = eventIdSchema.parse(request.params);
    const payload = createLineSchema.parse(request.body);
    response.status(201).json(await service.addAdditional(request.admin!.id, eventId, payload));
  }

  async updateAdditional(request: Request, response: Response) {
    const { id } = idSchema.parse(request.params);
    const payload = updateLineSchema.parse(request.body);
    response.json(await service.updateAdditional(request.admin!.id, id, payload));
  }

  async removeAdditional(request: Request, response: Response) {
    const { id } = idSchema.parse(request.params);
    await service.removeAdditional(request.admin!.id, id);
    response.status(204).send();
  }

  async addExtra(request: Request, response: Response) {
    const { id } = idSchema.parse(request.params);
    const payload = createLineSchema.parse(request.body);
    response.status(201).json(await service.addExtra(request.admin!.id, id, payload));
  }

  async updateExtra(request: Request, response: Response) {
    const { id } = idSchema.parse(request.params);
    const payload = updateLineSchema.parse(request.body);
    response.json(await service.updateExtra(request.admin!.id, id, payload));
  }

  async removeExtra(request: Request, response: Response) {
    const { id } = idSchema.parse(request.params);
    await service.removeExtra(request.admin!.id, id);
    response.status(204).send();
  }
}
