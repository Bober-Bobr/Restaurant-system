import type { Request, Response } from 'express';
import { DEFAULT_SECTION } from '../../utils/section.js';
import { FloorMapRepository } from './floorMap.repository.js';
import {
  createAreaSchema, createTableSchema, daySchema, idSchema, scheduleSchema,
  updateAreaSchema, updateTableSchema,
} from './floorMap.schema.js';
import { dayKey } from '../../utils/floorBooking.js';
import { buildFloorPlanPdf } from './floorMap.pdf.service.js';
import { FloorMapService } from './floorMap.service.js';

const service = new FloorMapService(new FloorMapRepository());

// Both set by `requireRestaurant`, which the router is mounted behind.
const scope = (request: Request) => [request.restaurantId!, request.section ?? DEFAULT_SECTION] as const;

export class FloorMapController {
  async get(request: Request, response: Response) {
    response.json(await service.getMap(...scope(request)));
  }

  /** What is taken on a day — today when the caller names none. */
  async getDay(request: Request, response: Response) {
    const { date } = daySchema.parse(request.query);
    response.json(await service.getDay(...scope(request), date ?? dayKey(new Date())));
  }

  /** The schedule, past and future, between two days. */
  async getSchedule(request: Request, response: Response) {
    const { from, to } = scheduleSchema.parse(request.query);
    response.json(await service.getSchedule(...scope(request), from, to));
  }

  /**
   * The printable plan of one area for one day. Streamed rather than buffered:
   * a venue-sized plan is a few hundred kilobytes and there is nothing to do
   * with it in between.
   */
  async printArea(request: Request, response: Response) {
    const { id } = idSchema.parse(request.params);
    const { date } = daySchema.parse(request.query);
    const day = date ?? dayKey(new Date());
    const plan = await service.getPrintablePlan(...scope(request), id, day);
    const doc = buildFloorPlanPdf(plan);
    response.setHeader('Content-Type', 'application/pdf');
    // A name the admin can file: the area and the day it is a plan OF.
    const safe = plan.area.name.replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '') || 'area';
    response.setHeader('Content-Disposition', `attachment; filename="${safe}-${day}.pdf"`);
    doc.pipe(response);
    doc.end();
  }

  async createArea(request: Request, response: Response) {
    const payload = createAreaSchema.parse(request.body);
    response.status(201).json(await service.createArea(...scope(request), payload));
  }

  async updateArea(request: Request, response: Response) {
    const { id } = idSchema.parse(request.params);
    const payload = updateAreaSchema.parse(request.body);
    response.json(await service.updateArea(...scope(request), id, payload));
  }

  async saveDefaultLayout(request: Request, response: Response) {
    const { id } = idSchema.parse(request.params);
    response.json(await service.saveDefaultLayout(...scope(request), id));
  }

  async restoreDefaultLayout(request: Request, response: Response) {
    const { id } = idSchema.parse(request.params);
    response.json(await service.restoreDefaultLayout(...scope(request), id));
  }

  async createTable(request: Request, response: Response) {
    const payload = createTableSchema.parse(request.body);
    response.status(201).json(await service.createTable(...scope(request), payload));
  }

  async updateTable(request: Request, response: Response) {
    const { id } = idSchema.parse(request.params);
    const payload = updateTableSchema.parse(request.body);
    response.json(await service.updateTable(...scope(request), id, payload));
  }

  async deleteTable(request: Request, response: Response) {
    const { id } = idSchema.parse(request.params);
    await service.deleteTable(...scope(request), id);
    response.status(204).send();
  }
}
