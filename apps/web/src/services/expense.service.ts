import type { ExpenseDay, ProductExpense, SalaryExpense } from '../types/domain';
import { httpClient } from './http';

export const expenseService = {
  async listDays() {
    const { data } = await httpClient.get<ExpenseDay[]>('/expenses/days');
    return data;
  },
  async createDay(date: string) {
    const { data } = await httpClient.post<ExpenseDay>('/expenses/days', { date });
    return data;
  },
  async updateDay(
    id: string,
    payload: Partial<{ allocatedCents: number; additionalCents: number; additionalNote: string | null }>
  ) {
    const { data } = await httpClient.patch<ExpenseDay>(`/expenses/days/${id}`, payload);
    return data;
  },
  async removeDay(id: string) {
    await httpClient.delete(`/expenses/days/${id}`);
  },

  async addProduct(dayId: string, payload: { name: string; quantity?: number; unit?: string; amountCents?: number }) {
    const { data } = await httpClient.post<ProductExpense>(`/expenses/days/${dayId}/products`, payload);
    return data;
  },
  async updateProduct(
    id: string,
    payload: Partial<{ name: string; quantity: number; unit: string; amountCents: number }>
  ) {
    const { data } = await httpClient.patch<ProductExpense>(`/expenses/products/${id}`, payload);
    return data;
  },
  async removeProduct(id: string) {
    await httpClient.delete(`/expenses/products/${id}`);
  },

  async addSalary(dayId: string, payload: { name: string; amountCents?: number }) {
    const { data } = await httpClient.post<SalaryExpense>(`/expenses/days/${dayId}/salaries`, payload);
    return data;
  },
  async updateSalary(id: string, payload: Partial<{ name: string; amountCents: number }>) {
    const { data } = await httpClient.patch<SalaryExpense>(`/expenses/salaries/${id}`, payload);
    return data;
  },
  async removeSalary(id: string) {
    await httpClient.delete(`/expenses/salaries/${id}`);
  },
};
