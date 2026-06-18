import type { AdditionalExpense, ExpenseDay, ProductExpense, SalaryExpense } from '../types/domain';
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
  async updateDay(id: string, payload: Partial<{ allocatedSum: number; report: string | null }>) {
    const { data } = await httpClient.patch<ExpenseDay>(`/expenses/days/${id}`, payload);
    return data;
  },
  async closeDay(id: string) {
    const { data } = await httpClient.patch<ExpenseDay>(`/expenses/days/${id}/close`, {});
    return data;
  },
  async reopenDay(id: string) {
    const { data } = await httpClient.patch<ExpenseDay>(`/expenses/days/${id}/reopen`, {});
    return data;
  },
  async removeDay(id: string) {
    await httpClient.delete(`/expenses/days/${id}`);
  },

  async addProduct(eventId: string, payload: { name: string; quantity?: number; unit?: string; amountSum?: number }) {
    const { data } = await httpClient.post<ProductExpense>(`/expenses/events/${eventId}/products`, payload);
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

  async addSalary(eventId: string, payload: { name: string; amountSum?: number }) {
    const { data } = await httpClient.post<SalaryExpense>(`/expenses/events/${eventId}/salaries`, payload);
    return data;
  },
  async updateSalary(id: string, payload: Partial<{ name: string; amountSum: number }>) {
    const { data } = await httpClient.patch<SalaryExpense>(`/expenses/salaries/${id}`, payload);
    return data;
  },
  async removeSalary(id: string) {
    await httpClient.delete(`/expenses/salaries/${id}`);
  },

  async addAdditional(eventId: string, payload: { name: string; amountSum?: number }) {
    const { data } = await httpClient.post<AdditionalExpense>(`/expenses/events/${eventId}/additionals`, payload);
    return data;
  },
  async updateAdditional(id: string, payload: Partial<{ name: string; amountSum: number }>) {
    const { data } = await httpClient.patch<AdditionalExpense>(`/expenses/additionals/${id}`, payload);
    return data;
  },
  async removeAdditional(id: string) {
    await httpClient.delete(`/expenses/additionals/${id}`);
  },

  // Download a PDF of the last `days` days ending at the latest created day
  // (closed days excluded).
  async downloadPdf(days: number, locale: string) {
    const { data } = await httpClient.get('/expenses/pdf', {
      params: { days, locale },
      responseType: 'blob',
    });
    return data as Blob;
  },

  // Download a PDF of the selected days; the server closes them afterwards.
  async downloadSelectionPdf(dayIds: string[], locale: string) {
    const { data } = await httpClient.post('/expenses/pdf/selection', { dayIds }, {
      params: { locale },
      responseType: 'blob',
    });
    return data as Blob;
  },
};
