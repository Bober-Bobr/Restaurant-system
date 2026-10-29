import type { Request, Response } from 'express';
import { reportQuerySchema } from './report.schema.js';
import {
  clampOffset, monthWindow, resolveRange, resolveReportRestaurants, type ReportScope,
} from './report.scope.js';
import {
  areasReport, calendarReport, financeReport, menuReport, scopeReport, staffReport,
} from './report.service.js';

/**
 * One scope for every report, resolved per request.
 *
 * The ownership check runs on EVERY report rather than once at the top of the
 * router: four endpoints each taking a `restaurantId` is four places to forget
 * it, and the one that was forgotten would hand an owner another owner's figures.
 * It is three lines and a database round trip; the alternative is a data leak
 * that no test on the other three routes would catch.
 */
async function resolveScope(request: Request): Promise<ReportScope> {
  const query = reportQuerySchema.parse(request.query);
  const admin = request.admin!;
  const restaurantIds = await resolveReportRestaurants(
    { id: admin.id, role: admin.role },
    query.restaurantId,
  );
  const { from, to } = resolveRange(query.from, query.to);
  return { restaurantIds, from, to, tzOffsetMinutes: clampOffset(query.tz) };
}

export class ReportController {
  /** Profit and loss: the headline, the ledger, bookings, orders, per month, per day. */
  async finance(request: Request, response: Response) {
    response.json(await financeReport(await resolveScope(request)));
  }

  /**
   * One month of bookings across every restaurant and area, with each day's P&L.
   *
   * Same scope resolution as every other report — the ownership check is not
   * skipped because the window is a month rather than a range. Only the window
   * is replaced, by the month asked for.
   */
  async calendar(request: Request, response: Response) {
    const scope = await resolveScope(request);
    const { month } = reportQuerySchema.parse(request.query);
    const window = monthWindow(month, scope.tzOffsetMinutes);
    response.json(await calendarReport({ ...scope, from: window.from, to: window.to }, window.month));
  }

  /** Per dining area. Revenue is real; spending is not recorded per area — see the service. */
  async areas(request: Request, response: Response) {
    response.json(await areasReport(await resolveScope(request)));
  }

  /** Every dish, with all three systems' prices and how often it was chosen. */
  async menu(request: Request, response: Response) {
    response.json(await menuReport(await resolveScope(request)));
  }

  /** Waiter figures and the staff roster. */
  async staff(request: Request, response: Response) {
    response.json(await staffReport(await resolveScope(request)));
  }

  /** Which restaurants this report covers, and what each has switched on. */
  async scope(request: Request, response: Response) {
    response.json(await scopeReport(await resolveScope(request)));
  }
}
