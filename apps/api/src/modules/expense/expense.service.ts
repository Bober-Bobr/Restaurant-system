import createHttpError from 'http-errors';
import {
  ExpenseRepository,
  type ProductData,
  type SalaryData,
  type UpdateDayData
} from './expense.repository.js';

export class ExpenseService {
  constructor(private readonly repo: ExpenseRepository) {}

  listDays(managerId: string) {
    return this.repo.listDays(managerId);
  }

  // Get-or-create the day for a given date, so opening a date is idempotent.
  async createDay(managerId: string, date: string) {
    const existing = await this.repo.findDay(managerId, date);
    if (existing) return existing;
    return this.repo.createDay(managerId, date);
  }

  private async requireOwnDay(managerId: string, id: string) {
    const day = await this.repo.findDayById(id);
    if (!day || day.managerId !== managerId) throw createHttpError(404, 'Day not found');
    return day;
  }

  async updateDay(managerId: string, id: string, data: UpdateDayData) {
    await this.requireOwnDay(managerId, id);
    return this.repo.updateDay(id, data);
  }

  async removeDay(managerId: string, id: string) {
    await this.requireOwnDay(managerId, id);
    await this.repo.deleteDay(id);
  }

  async addProduct(managerId: string, dayId: string, data: ProductData) {
    await this.requireOwnDay(managerId, dayId);
    return this.repo.createProduct(dayId, data);
  }

  async updateProduct(managerId: string, id: string, data: Partial<ProductData>) {
    const owner = await this.repo.ownerOfProduct(id);
    if (owner !== managerId) throw createHttpError(404, 'Product not found');
    return this.repo.updateProduct(id, data);
  }

  async removeProduct(managerId: string, id: string) {
    const owner = await this.repo.ownerOfProduct(id);
    if (owner !== managerId) throw createHttpError(404, 'Product not found');
    await this.repo.deleteProduct(id);
  }

  async addSalary(managerId: string, dayId: string, data: SalaryData) {
    await this.requireOwnDay(managerId, dayId);
    return this.repo.createSalary(dayId, data);
  }

  async updateSalary(managerId: string, id: string, data: Partial<SalaryData>) {
    const owner = await this.repo.ownerOfSalary(id);
    if (owner !== managerId) throw createHttpError(404, 'Salary not found');
    return this.repo.updateSalary(id, data);
  }

  async removeSalary(managerId: string, id: string) {
    const owner = await this.repo.ownerOfSalary(id);
    if (owner !== managerId) throw createHttpError(404, 'Salary not found');
    await this.repo.deleteSalary(id);
  }
}
