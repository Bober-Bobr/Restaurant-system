import { prisma } from '../../db/prisma.js';

const dayInclude = {
  products: { orderBy: [{ sortOrder: 'asc' as const }, { createdAt: 'asc' as const }] },
  salaries: { orderBy: [{ sortOrder: 'asc' as const }, { createdAt: 'asc' as const }] }
};

export type UpdateDayData = {
  allocatedCents?: number;
  additionalCents?: number;
  additionalNote?: string | null;
};

export type ProductData = {
  name: string;
  quantity?: number;
  unit?: string;
  amountCents?: number;
};

export type SalaryData = {
  name: string;
  amountCents?: number;
};

export class ExpenseRepository {
  listDays(managerId: string) {
    return prisma.expenseDay.findMany({
      where: { managerId },
      orderBy: { date: 'desc' },
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

  createDay(managerId: string, date: string) {
    return prisma.expenseDay.create({ data: { managerId, date }, include: dayInclude });
  }

  updateDay(id: string, data: UpdateDayData) {
    return prisma.expenseDay.update({ where: { id }, data, include: dayInclude });
  }

  deleteDay(id: string) {
    return prisma.expenseDay.delete({ where: { id } });
  }

  // Resolve the owning managerId for a product/salary line via its day.
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
