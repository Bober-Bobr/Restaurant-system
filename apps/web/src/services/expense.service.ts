import type { AdditionalExpense, DayEvent, DayExtraExpense, ExpenseDay, ProductExpense, SalaryExpense, ServiceExpense } from '../types/domain';
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

  async updateEvent(
    id: string,
    // manualSpentSum: a number overrides the computed spent total, null clears
    // the override. Omit the key to leave it untouched.
    payload: Partial<{ bookingName: string | null; guestCount: number; pricePerGuestSum: number; report: string | null; manualSpentSum: number | null }>
  ) {
    const { data } = await httpClient.patch<DayEvent>(`/expenses/events/${id}`, payload);
    return data;
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

  // Per-event "Additional Services" lines (distinct from additionals above).
  async addService(eventId: string, payload: { name: string; amountSum?: number }) {
    const { data } = await httpClient.post<ServiceExpense>(`/expenses/events/${eventId}/services`, payload);
    return data;
  },
  async updateService(id: string, payload: Partial<{ name: string; amountSum: number }>) {
    const { data } = await httpClient.patch<ServiceExpense>(`/expenses/services/${id}`, payload);
    return data;
  },
  async removeService(id: string) {
    await httpClient.delete(`/expenses/services/${id}`);
  },

  // Day-level additional expenses (separate from the per-event main expenses).
  async addExtra(dayId: string, payload: { name: string; amountSum?: number }) {
    const { data } = await httpClient.post<DayExtraExpense>(`/expenses/days/${dayId}/extras`, payload);
    return data;
  },
  async updateExtra(id: string, payload: Partial<{ name: string; amountSum: number }>) {
    const { data } = await httpClient.patch<DayExtraExpense>(`/expenses/extras/${id}`, payload);
    return data;
  },
  async removeExtra(id: string) {
    await httpClient.delete(`/expenses/extras/${id}`);
  },

  // Export the selected days' main expenses as one multi-page PDF. Days are not
  // closed by this action.
  async downloadSelectionPdf(dayIds: string[], locale: string) {
    const { data } = await httpClient.post('/expenses/pdf/selection', { dayIds }, {
      params: { locale },
      responseType: 'blob',
    });
    return data as Blob;
  },

  // Export only the chosen event departments of a single day as one PDF.
  async downloadEventsPdf(dayId: string, eventIds: string[], locale: string) {
    const { data } = await httpClient.post('/expenses/pdf/events', { dayId, eventIds }, {
      params: { locale },
      responseType: 'blob',
    });
    return data as Blob;
  },

  // Export the selected days' additional (day-level) expenses as one PDF.
  async downloadExtrasPdf(dayIds: string[], locale: string) {
    const { data } = await httpClient.post('/expenses/pdf/extras-selection', { dayIds }, {
      params: { locale },
      responseType: 'blob',
    });
    return data as Blob;
  },
};
