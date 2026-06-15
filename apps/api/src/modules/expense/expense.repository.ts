import { prisma } from '../../db/prisma.js';

const lineOrder = [{ sortOrder: 'asc' as const }, { createdAt: 'asc' as const }];
const dayInclude = {
  products: { orderBy: lineOrder },
  salaries: { orderBy: lineOrder },
  additionals: { orderBy: lineOrder }
};

export type UpdateDayData = {
  allocatedSum?: number;
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
    return prisma.expenseDay.findMany({
      where: { managerId },
      orderBy: { date: 'desc' },
      include: dayInclude
    });
  }

  // Days within an inclusive date range (YYYY-MM-DD strings compare lexically).
  listDaysInRange(managerId: string, from: string, to: string, openOnly = false) {
    return prisma.expenseDay.findMany({
      where: { managerId, date: { gte: from, lte: to }, ...(openOnly ? { isClosed: false } : {}) },
      orderBy: { date: 'asc' },
      include: dayInclude
    });
  }

  findDay(managerId: string, date: string) {
    return prisma.expenseDay.findUnique({
      where: { managerId_date: { managerId, date } },
      include: dayInclude
    });
  }

  findDayById(id: string) {
    return prisma.expenseDay.findUnique({ where: { id }, include: dayInclude });
  }

  latestDay(managerId: string) {
    return prisma.expenseDay.findFirst({
      where: { managerId },
      orderBy: { date: 'desc' },
      include: dayInclude
    });
  }

  createDay(managerId: string, date: string, seed?: UpdateDayData) {
    return prisma.expenseDay.create({
      data: { managerId, date, allocatedSum: seed?.allocatedSum ?? 0 },
      include: dayInclude
    });
  }

  async cloneLines(dayId: string, products: ProductData[], salaries: LineData[], additionals: LineData[]) {
    const ops = [
      ...products.map((p, i) => prisma.productExpense.create({ data: { ...p, dayId, sortOrder: i } })),
      ...salaries.map((s, i) => prisma.salaryExpense.create({ data: { ...s, dayId, sortOrder: i } })),
      ...additionals.map((a, i) => prisma.additionalExpense.create({ data: { ...a, dayId, sortOrder: i } }))
    ];
    if (ops.length) await prisma.$transaction(ops);
  }

  updateDay(id: string, data: UpdateDayData) {
    return prisma.expenseDay.update({ where: { id }, data, include: dayInclude });
  }

  closeDay(id: string) {
    return prisma.expenseDay.update({
      where: { id },
      data: { isClosed: true, closedAt: new Date() },
      include: dayInclude
    });
  }

  deleteDay(id: string) {
    return prisma.expenseDay.delete({ where: { id } });
  }

  async ownerOfProduct(productId: string): Promise<string | null> {
    const row = await prisma.productExpense.findUnique({
      where: { id: productId },
      select: { day: { select: { managerId: true } } }
    });
    return row?.day.managerId ?? null;
  }

  async ownerOfSalary(salaryId: string): Promise<string | null> {
    const row = await prisma.salaryExpense.findUnique({
      where: { id: salaryId },
      select: { day: { select: { managerId: true } } }
    });
    return row?.day.managerId ?? null;
  }

  async ownerOfAdditional(additionalId: string): Promise<string | null> {
    const row = await prisma.additionalExpense.findUnique({
      where: { id: additionalId },
      select: { day: { select: { managerId: true } } }
    });
    return row?.day.managerId ?? null;
  }

  createProduct(dayId: string, data: ProductData) {
    return prisma.productExpense.create({ data: { ...data, dayId } });
  }
  updateProduct(id: string, data: Partial<ProductData>) {
    return prisma.productExpense.update({ where: { id }, data });
  }
  deleteProduct(id: string) {
    return prisma.productExpense.delete({ where: { id } });
  }

  createSalary(dayId: string, data: LineData) {
    return prisma.salaryExpense.create({ data: { ...data, dayId } });
  }
  updateSalary(id: string, data: Partial<LineData>) {
    return prisma.salaryExpense.update({ where: { id }, data });
  }
  deleteSalary(id: string) {
    return prisma.salaryExpense.delete({ where: { id } });
  }

  createAdditional(dayId: string, data: LineData) {
    return prisma.additionalExpense.create({ data: { ...data, dayId } });
  }
  updateAdditional(id: string, data: Partial<LineData>) {
    return prisma.additionalExpense.update({ where: { id }, data });
  }
  deleteAdditional(id: string) {
    return prisma.additionalExpense.delete({ where: { id } });
  }
}
