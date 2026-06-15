import type { ExpenseDay, ProductExpense, SalaryExpense } from '../types/domain';
import { httpClient } from './http';

export const expenseService = {
  async listDays() {
    const { data } = await httpClient.get<ExpenseDay[]>('/expenses/days');
    return data;
  },
  // No date → the API creates the day after the latest one (or today), pre-filled
  // with the previous day's allocation and expense lines.
  async createDay(date?: string) {
    const { data } = await httpClient.post<ExpenseDay>('/expenses/days', date ? { date } : {});
    return data;
  },
  async updateDay(
    id: string,
    payload: Partial<{ allocatedSum: number; additionalSum: number; additionalNote: string | null }>
  ) {
    const { data } = await httpClient.patch<ExpenseDay>(`/expenses/days/${id}`, payload);
    return data;
  },
  async removeDay(id: string) {
    await httpClient.delete(`/expenses/days/${id}`);
  },

  async addProduct(dayId: string, payload: { name: string; quantity?: number; unit?: string; amountSum?: number }) {
    const { data } = await httpClient.post<ProductExpense>(`/expenses/days/${dayId}/products`, payload);
    return data;
  },
  async updateProduct(
    id: string,
    payload: Partial<{ name: string; quantity: number; unit: string; amountSum: number }>
  ) {
    const { data } = await httpClient.patch<ProductExpense>(`/expenses/products/${id}`, payload);
    return data;
  },
  async removeProduct(id: string) {
    await httpClient.delete(`/expenses/products/${id}`);
  },

  async addSalary(dayId: string, payload: { name: string; amountSum?: number }) {
    const { data } = await httpClient.post<SalaryExpense>(`/expenses/days/${dayId}/salaries`, payload);
    return data;
  },
  async updateSalary(id: string, payload: Partial<{ name: string; amountSum: number }>) {
    const { data } = await httpClient.patch<SalaryExpense>(`/expenses/salaries/${id}`, payload);
    return data;
  },
  async removeSalary(id: string) {
    await httpClient.delete(`/expenses/salaries/${id}`);
  },

  // Download a PDF covering `days` ending at `end`, returned as a Blob.
  async downloadPdf(end: string, days: number, locale: string) {
    const { data } = await httpClient.get('/expenses/pdf', {
      params: { end, days, locale },
      responseType: 'blob',
    });
    return data as Blob;
  },
};
