import type { Request, Response } from 'express';
import { ExpenseRepository } from './expense.repository.js';
import { ExpenseService } from './expense.service.js';
import {
  createDaySchema,
  createProductSchema,
  createSalarySchema,
  dayIdSchema,
  idSchema,
  updateDaySchema,
  updateProductSchema,
  updateSalarySchema
} from './expense.schema.js';

const service = new ExpenseService(new ExpenseRepository());

// The ledger is scoped to the calling Restaurant Manager (request.admin.id).
export class ExpenseController {
  async listDays(request: Request, response: Response) {
    response.json(await service.listDays(request.admin!.id));
  }

  async createDay(request: Request, response: Response) {
    const { date } = createDaySchema.parse(request.body);
    response.status(201).json(await service.createDay(request.admin!.id, date));
  }

  async updateDay(request: Request, response: Response) {
    const { id } = idSchema.parse(request.params);
    const payload = updateDaySchema.parse(request.body);
    response.json(await service.updateDay(request.admin!.id, id, payload));
  }

  async removeDay(request: Request, response: Response) {
    const { id } = idSchema.parse(request.params);
    await service.removeDay(request.admin!.id, id);
    response.status(204).send();
  }

  async addProduct(request: Request, response: Response) {
    const { dayId } = dayIdSchema.parse(request.params);
    const payload = createProductSchema.parse(request.body);
    response.status(201).json(await service.addProduct(request.admin!.id, dayId, payload));
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
    const { dayId } = dayIdSchema.parse(request.params);
    const payload = createSalarySchema.parse(request.body);
    response.status(201).json(await service.addSalary(request.admin!.id, dayId, payload));
  }

  async updateSalary(request: Request, response: Response) {
    const { id } = idSchema.parse(request.params);
    const payload = updateSalarySchema.parse(request.body);
    response.json(await service.updateSalary(request.admin!.id, id, payload));
  }

  async removeSalary(request: Request, response: Response) {
    const { id } = idSchema.parse(request.params);
    await service.removeSalary(request.admin!.id, id);
    response.status(204).send();
  }
}
