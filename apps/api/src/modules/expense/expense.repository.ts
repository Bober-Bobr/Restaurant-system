import { prisma } from '../../db/prisma.js';

export const EVENT_TYPES = ['NAHOR', 'FOTIHA', 'TUI', 'OTHERS'] as const;
export type EventType = (typeof EVENT_TYPES)[number];

const lineOrder = [{ sortOrder: 'asc' as const }, { createdAt: 'asc' as const }];
const eventInclude = {
  products: { orderBy: lineOrder },
  salaries: { orderBy: lineOrder },
  additionals: { orderBy: lineOrder }
};
const dayInclude = {
  events: { include: eventInclude, orderBy: { createdAt: 'asc' as const } }
};

export type UpdateDayData = {
  allocatedSum?: number;
  report?: string | null;
};

export type UpdateEventData = {
  bookingName?: string | null;
  guestCount?: number;
  pricePerGuestSum?: number;
  report?: string | null;
};

export type ProductData = {
  name: string;
  quantity?: number;
  unit?: string;
  amountSum?: number;
};

export type LineData = {
  name: string;
  amountSum?: number;
};

export class ExpenseRepository {
  listDays(managerId: string) {
    return prisma.expenseDay.findMany({ where: { managerId }, orderBy: { date: 'desc' }, include: dayInclude });
  }

  listDaysInRange(managerId: string, from: string, to: string, openOnly = false) {
    return prisma.expenseDay.findMany({
      where: { managerId, date: { gte: from, lte: to }, ...(openOnly ? { isClosed: false } : {}) },
      orderBy: { date: 'asc' },
      include: dayInclude
    });
  }

  listOpenDaysByIds(managerId: string, ids: string[]) {
    return prisma.expenseDay.findMany({
      where: { managerId, id: { in: ids }, isClosed: false },
      orderBy: { date: 'asc' },
      include: dayInclude
    });
  }

  closeManyByIds(managerId: string, ids: string[]) {
    return prisma.expenseDay.updateMany({
      where: { managerId, id: { in: ids } },
      data: { isClosed: true, closedAt: new Date() }
    });
  }

  reopenDay(id: string) {
    return prisma.expenseDay.update({ where: { id }, data: { isClosed: false, closedAt: null }, include: dayInclude });
  }

  findDay(managerId: string, date: string) {
    return prisma.expenseDay.findUnique({ where: { managerId_date: { managerId, date } }, include: dayInclude });
  }

  findDayById(id: string) {
    return prisma.expenseDay.findUnique({ where: { id }, include: dayInclude });
  }

  latestDay(managerId: string) {
    return prisma.expenseDay.findFirst({ where: { managerId }, orderBy: { date: 'desc' }, include: dayInclude });
  }

  // A new day starts with its four (empty) event departments.
  createDay(managerId: string, date: string) {
    return prisma.expenseDay.create({
      data: { managerId, date, events: { create: EVENT_TYPES.map((type) => ({ type })) } },
      include: dayInclude
    });
  }

  // Copy line *structure* (names/units) into an event, with blank numbers.
  async cloneLines(eventId: string, products: ProductData[], salaries: LineData[], additionals: LineData[]) {
    const ops = [
      ...products.map((p, i) => prisma.productExpense.create({ data: { name: p.name, unit: p.unit, quantity: 0, amountSum: 0, eventId, sortOrder: i } })),
      ...salaries.map((s, i) => prisma.salaryExpense.create({ data: { name: s.name, amountSum: 0, eventId, sortOrder: i } })),
      ...additionals.map((a, i) => prisma.additionalExpense.create({ data: { name: a.name, amountSum: 0, eventId, sortOrder: i } }))
    ];
    if (ops.length) await prisma.$transaction(ops);
  }

  updateDay(id: string, data: UpdateDayData) {
    return prisma.expenseDay.update({ where: { id }, data, include: dayInclude });
  }

  closeDay(id: string) {
    return prisma.expenseDay.update({ where: { id }, data: { isClosed: true, closedAt: new Date() }, include: dayInclude });
  }

  deleteDay(id: string) {
    return prisma.expenseDay.delete({ where: { id } });
  }

  // Ownership lookups traverse line → event → day → manager.
  async ownerOfEvent(eventId: string): Promise<string | null> {
    const row = await prisma.dayEvent.findUnique({ where: { id: eventId }, select: { day: { select: { managerId: true } } } });
    return row?.day.managerId ?? null;
  }

  updateEvent(id: string, data: UpdateEventData) {
    return prisma.dayEvent.update({ where: { id }, data });
  }
  async ownerOfProduct(id: string): Promise<string | null> {
    const row = await prisma.productExpense.findUnique({ where: { id }, select: { event: { select: { day: { select: { managerId: true } } } } } });
    return row?.event.day.managerId ?? null;
  }
  async ownerOfSalary(id: string): Promise<string | null> {
    const row = await prisma.salaryExpense.findUnique({ where: { id }, select: { event: { select: { day: { select: { managerId: true } } } } } });
    return row?.event.day.managerId ?? null;
  }
  async ownerOfAdditional(id: string): Promise<string | null> {
    const row = await prisma.additionalExpense.findUnique({ where: { id }, select: { event: { select: { day: { select: { managerId: true } } } } } });
    return row?.event.day.managerId ?? null;
  }

  createProduct(eventId: string, data: ProductData) {
    return prisma.productExpense.create({ data: { ...data, eventId } });
  }
  updateProduct(id: string, data: Partial<ProductData>) {
    return prisma.productExpense.update({ where: { id }, data });
  }
  deleteProduct(id: string) {
    return prisma.productExpense.delete({ where: { id } });
  }

  createSalary(eventId: string, data: LineData) {
    return prisma.salaryExpense.create({ data: { ...data, eventId } });
  }
  updateSalary(id: string, data: Partial<LineData>) {
    return prisma.salaryExpense.update({ where: { id }, data });
  }
  deleteSalary(id: string) {
    return prisma.salaryExpense.delete({ where: { id } });
  }

  createAdditional(eventId: string, data: LineData) {
    return prisma.additionalExpense.create({ data: { ...data, eventId } });
  }
  updateAdditional(id: string, data: Partial<LineData>) {
    return prisma.additionalExpense.update({ where: { id }, data });
  }
  deleteAdditional(id: string) {
    return prisma.additionalExpense.delete({ where: { id } });
  }
}
