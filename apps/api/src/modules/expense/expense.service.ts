import createHttpError from 'http-errors';
import {
  ExpenseRepository,
  type LineData,
  type ProductData,
  type UpdateDayData,
  type UpdateEventData
} from './expense.repository.js';

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

  // Create the next day with its four event departments. Each event copies the
  // previous day's matching event's line *structure* (names/units); every number
  // (allocation, quantities, amounts) starts blank.
  async createDay(managerId: string, date?: string) {
    const latest = await this.repo.latestDay(managerId);
    const targetDate = date ?? (latest ? addDays(latest.date, 1) : todayStr());

    const existing = await this.repo.findDay(managerId, targetDate);
    if (existing) return existing;

    const day = await this.repo.createDay(managerId, targetDate);

    if (latest) {
      for (const event of day.events) {
        const src = latest.events.find((e) => e.type === event.type);
        if (!src) continue;
        if (src.products.length || src.salaries.length || src.additionals.length) {
          await this.repo.cloneLines(
            event.id,
            src.products.map((p) => ({ name: p.name, unit: p.unit })),
            src.salaries.map((s) => ({ name: s.name })),
            src.additionals.map((a) => ({ name: a.name }))
          );
        }
      }
    }
    return this.repo.findDayById(day.id);
  }

  // Selected days for a multi-file export (no auto-close), oldest first.
  async selectionForExport(managerId: string, dayIds: string[]) {
    const rows = await this.repo.listByIds(managerId, dayIds);
    const dates = rows.map((r) => r.date);
    return { rows, fromDate: dates[0] ?? todayStr(), endDate: dates[dates.length - 1] ?? todayStr() };
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
  private async requireOwnEvent(managerId: string, eventId: string) {
    if ((await this.repo.ownerOfEvent(eventId)) !== managerId) throw createHttpError(404, 'Event not found');
  }

  async updateEvent(managerId: string, id: string, data: UpdateEventData) {
    await this.requireOwnEvent(managerId, id);
    return this.repo.updateEvent(id, data);
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

  async addProduct(managerId: string, eventId: string, data: ProductData) {
    await this.requireOwnEvent(managerId, eventId);
    return this.repo.createProduct(eventId, data);
  }
  async updateProduct(managerId: string, id: string, data: Partial<ProductData>) {
    if ((await this.repo.ownerOfProduct(id)) !== managerId) throw createHttpError(404, 'Product not found');
    return this.repo.updateProduct(id, data);
  }
  async removeProduct(managerId: string, id: string) {
    if ((await this.repo.ownerOfProduct(id)) !== managerId) throw createHttpError(404, 'Product not found');
    await this.repo.deleteProduct(id);
  }

  async addSalary(managerId: string, eventId: string, data: LineData) {
    await this.requireOwnEvent(managerId, eventId);
    return this.repo.createSalary(eventId, data);
  }
  async updateSalary(managerId: string, id: string, data: Partial<LineData>) {
    if ((await this.repo.ownerOfSalary(id)) !== managerId) throw createHttpError(404, 'Salary not found');
    return this.repo.updateSalary(id, data);
  }
  async removeSalary(managerId: string, id: string) {
    if ((await this.repo.ownerOfSalary(id)) !== managerId) throw createHttpError(404, 'Salary not found');
    await this.repo.deleteSalary(id);
  }

  async addAdditional(managerId: string, eventId: string, data: LineData) {
    await this.requireOwnEvent(managerId, eventId);
    return this.repo.createAdditional(eventId, data);
  }
  async updateAdditional(managerId: string, id: string, data: Partial<LineData>) {
    if ((await this.repo.ownerOfAdditional(id)) !== managerId) throw createHttpError(404, 'Additional expense not found');
    return this.repo.updateAdditional(id, data);
  }
  async removeAdditional(managerId: string, id: string) {
    if ((await this.repo.ownerOfAdditional(id)) !== managerId) throw createHttpError(404, 'Additional expense not found');
    await this.repo.deleteAdditional(id);
  }

  async addExtra(managerId: string, dayId: string, data: LineData) {
    await this.requireOwnDay(managerId, dayId);
    return this.repo.createExtra(dayId, data);
  }
  async updateExtra(managerId: string, id: string, data: Partial<LineData>) {
    if ((await this.repo.ownerOfExtra(id)) !== managerId) throw createHttpError(404, 'Extra expense not found');
    return this.repo.updateExtra(id, data);
  }
  async removeExtra(managerId: string, id: string) {
    if ((await this.repo.ownerOfExtra(id)) !== managerId) throw createHttpError(404, 'Extra expense not found');
    await this.repo.deleteExtra(id);
  }
}
