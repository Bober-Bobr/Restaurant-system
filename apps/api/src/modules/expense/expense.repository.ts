import { prisma } from '../../db/prisma.js';

const dayInclude = {
  products: { orderBy: [{ sortOrder: 'asc' as const }, { createdAt: 'asc' as const }] },
  salaries: { orderBy: [{ sortOrder: 'asc' as const }, { createdAt: 'asc' as const }] }
};

export type UpdateDayData = {
  allocatedSum?: number;
  additionalSum?: number;
  additionalNote?: string | null;
};

export type ProductData = {
  name: string;
  quantity?: number;
  unit?: string;
  amountSum?: number;
};

export type SalaryData = {
  name: string;
  amountSum?: number;
};

export type DayWithLines = Awaited<ReturnType<ExpenseRepository['findDayById']>>;

export class ExpenseRepository {
  listDays(managerId: string) {
    return prisma.expenseDay.findMany({
      where: { managerId },
      orderBy: { date: 'desc' },
      include: dayInclude
    });
  }

  // Days within an inclusive date range (YYYY-MM-DD strings compare lexically).
  listDaysInRange(managerId: string, from: string, to: string) {
    return prisma.expenseDay.findMany({
      where: { managerId, date: { gte: from, lte: to } },
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

  // The most recent day (used to derive the next date + clone its contents).
  latestDay(managerId: string) {
    return prisma.expenseDay.findFirst({
      where: { managerId },
      orderBy: { date: 'desc' },
      include: dayInclude
    });
  }

  createDay(managerId: string, date: string, seed?: UpdateDayData) {
    return prisma.expenseDay.create({
      data: {
        managerId,
        date,
        allocatedSum: seed?.allocatedSum ?? 0,
        additionalSum: seed?.additionalSum ?? 0,
        additionalNote: seed?.additionalNote ?? null
      },
      include: dayInclude
    });
  }

  async cloneLines(dayId: string, products: ProductData[], salaries: SalaryData[]) {
    const ops = [
      ...products.map((p, i) =>
        prisma.productExpense.create({ data: { ...p, dayId, sortOrder: i } })
      ),
      ...salaries.map((s, i) =>
        prisma.salaryExpense.create({ data: { ...s, dayId, sortOrder: i } })
      )
    ];
    if (ops.length) await prisma.$transaction(ops);
  }

  updateDay(id: string, data: UpdateDayData) {
    return prisma.expenseDay.update({ where: { id }, data, include: dayInclude });
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

  createProduct(dayId: string, data: ProductData) {
    return prisma.productExpense.create({ data: { ...data, dayId } });
  }

  updateProduct(id: string, data: Partial<ProductData>) {
    return prisma.productExpense.update({ where: { id }, data });
  }

  deleteProduct(id: string) {
    return prisma.productExpense.delete({ where: { id } });
  }

  createSalary(dayId: string, data: SalaryData) {
    return prisma.salaryExpense.create({ data: { ...data, dayId } });
  }

  updateSalary(id: string, data: Partial<SalaryData>) {
    return prisma.salaryExpense.update({ where: { id }, data });
  }

  deleteSalary(id: string) {
    return prisma.salaryExpense.delete({ where: { id } });
  }
}
