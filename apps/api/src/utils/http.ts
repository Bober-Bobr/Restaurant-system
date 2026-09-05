import type { Request } from 'express';

export type Pagination = { skip: number; take: number };

export const getPagination = (request: Request): Pagination => {
  const page = Math.max(Number(request.query.page ?? 1), 1);
  const pageSize = Math.min(Math.max(Number(request.query.pageSize ?? 20), 1), 100);

  return {
    skip: (page - 1) * pageSize,
    take: pageSize
  };
};

/**
 * Pagination only when the caller actually asked for it.
 *
 * `getPagination` defaults a missing page to the FIRST twenty rows, which is a
 * silent truncation dressed up as a default — a caller that knows nothing about
 * paging gets a fifth of a page and no way to tell. On `GET /events` that was
 * the whole bug behind "bookings created on the tablet never appear": every
 * screen that lists events (the Events page, the calendar, invoices,
 * notifications, the employee list and the layout's badge) called it with no
 * page at all, the list is ordered by `eventDate` ascending, and so a
 * twenty-first booking — always the furthest in the future — was simply never
 * returned. The rows were saved correctly; nothing ever asked for them.
 *
 * So: an explicit `page`/`pageSize` still pages, and their absence means the
 * whole set rather than an arbitrary slice of it. Truncating is a decision, and
 * a caller has to make it deliberately.
 */
export const getOptionalPagination = (request: Request): Pagination | undefined => {
  const asked = request.query.page !== undefined || request.query.pageSize !== undefined;
  return asked ? getPagination(request) : undefined;
};
