import createHttpError from 'http-errors';
import {
  ExpenseRepository,
  type LineData,
  type ProductData,
  type UpdateDayData
} from './expense.repository.js';

// Date helpers operating on YYYY-MM-DD strings (UTC, no timezone drift).
function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}
function addDays(date: string, delta: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export class ExpenseService {
  constructor(private readonly repo: ExpenseRepository) {}

  listDays(managerId: string) {
    return this.repo.listDays(managerId);
  }

  // Create the next day. If no date is given, it's the day after the latest day
  // (or today when there are none). Only the previous day's line *structure*
  // (product/salary/additional names and product units) is carried over — every
  // fill-in number (allocation, quantities, amounts) starts blank.
  async createDay(managerId: string, date?: string) {
    const latest = await this.repo.latestDay(managerId);
    const targetDate = date ?? (latest ? addDays(latest.date, 1) : todayStr());

    const existing = await this.repo.findDay(managerId, targetDate);
    if (existing) return existing;

    const day = await this.repo.createDay(managerId, targetDate);

    if (latest) {
      await this.repo.cloneLines(
        day.id,
        latest.products.map((p) => ({ name: p.name, unit: p.unit, quantity: 0, amountSum: 0 })),
        latest.salaries.map((s) => ({ name: s.name, amountSum: 0 })),
        latest.additionals.map((a) => ({ name: a.name, amountSum: 0 }))
      );
    }
    return this.repo.findDayById(day.id);
  }

  // The last `days` calendar days ending at the latest created day (or today).
  // Closed days are excluded.
  async listForPdf(managerId: string, days: number) {
    const latest = await this.repo.latestDay(managerId);
    const endDate = latest?.date ?? todayStr();
    const fromDate = addDays(endDate, -(days - 1));
    return { rows: await this.repo.listDaysInRange(managerId, fromDate, endDate, true), fromDate, endDate };
  }

  // Export the given open days, then close them. Returns the rows captured
  // before closing (so the PDF reflects their final contents).
  async exportSelectionAndClose(managerId: string, dayIds: string[]) {
    const rows = await this.repo.listOpenDaysByIds(managerId, dayIds);
    const ids = rows.map((r) => r.id);
    if (ids.length) await this.repo.closeManyByIds(managerId, ids);
    const dates = rows.map((r) => r.date);
    return {
      rows,
      fromDate: dates[0] ?? todayStr(),
      endDate: dates[dates.length - 1] ?? todayStr()
    };
  }

  async reopenDay(managerId: string, id: string) {
    await this.requireOwnDay(managerId, id);
    return this.repo.reopenDay(id);
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

  async closeDay(managerId: string, id: string) {
    await this.requireOwnDay(managerId, id);
    return this.repo.closeDay(id);
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
    if ((await this.repo.ownerOfProduct(id)) !== managerId) throw createHttpError(404, 'Product not found');
    return this.repo.updateProduct(id, data);
  }
  async removeProduct(managerId: string, id: string) {
    if ((await this.repo.ownerOfProduct(id)) !== managerId) throw createHttpError(404, 'Product not found');
    await this.repo.deleteProduct(id);
  }

  async addSalary(managerId: string, dayId: string, data: LineData) {
    await this.requireOwnDay(managerId, dayId);
    return this.repo.createSalary(dayId, data);
  }
  async updateSalary(managerId: string, id: string, data: Partial<LineData>) {
    if ((await this.repo.ownerOfSalary(id)) !== managerId) throw createHttpError(404, 'Salary not found');
    return this.repo.updateSalary(id, data);
  }
  async removeSalary(managerId: string, id: string) {
    if ((await this.repo.ownerOfSalary(id)) !== managerId) throw createHttpError(404, 'Salary not found');
    await this.repo.deleteSalary(id);
  }

  async addAdditional(managerId: string, dayId: string, data: LineData) {
    await this.requireOwnDay(managerId, dayId);
    return this.repo.createAdditional(dayId, data);
  }
  async updateAdditional(managerId: string, id: string, data: Partial<LineData>) {
    if ((await this.repo.ownerOfAdditional(id)) !== managerId) throw createHttpError(404, 'Additional expense not found');
    return this.repo.updateAdditional(id, data);
  }
  async removeAdditional(managerId: string, id: string) {
    if ((await this.repo.ownerOfAdditional(id)) !== managerId) throw createHttpError(404, 'Additional expense not found');
    await this.repo.deleteAdditional(id);
  }
}
