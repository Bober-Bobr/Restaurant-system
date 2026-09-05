import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Request } from 'express';
import { getOptionalPagination, getPagination } from './http.js';

/**
 * A list endpoint that silently returns the first twenty rows to a caller who
 * asked for no page at all is not paginated — it is truncated.
 *
 * That was the whole of "bookings created on the tablet never appear on the
 * Events page". `GET /events` is ordered by `eventDate` ascending and every one
 * of the six screens that lists events (Events, calendar, invoices,
 * notifications, the employee list, the layout badge) called it with no page.
 * So a restaurant past its twentieth booking saw the twenty EARLIEST events
 * forever, and each new booking — always the furthest in the future — was
 * written correctly and never returned. Nothing was lost; nothing asked for it.
 *
 * `getOptionalPagination` makes truncating a decision the caller has to make.
 */
const req = (query: Record<string, unknown>) => ({ query } as unknown as Request);

const API_SRC = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');

describe('a page is only applied when one is asked for', () => {
  it('no page parameters means no limit at all', () => {
    expect(getOptionalPagination(req({}))).toBeUndefined();
  });

  it('other query parameters do not count as asking', () => {
    // `?restaurantId=` is on every one of these calls and must not silently
    // switch paging back on.
    expect(getOptionalPagination(req({ restaurantId: 'r1', scope: 'banquet' }))).toBeUndefined();
  });

  it('an explicit page still pages', () => {
    expect(getOptionalPagination(req({ page: '2' }))).toEqual({ skip: 20, take: 20 });
    expect(getOptionalPagination(req({ pageSize: '5' }))).toEqual({ skip: 0, take: 5 });
    expect(getOptionalPagination(req({ page: '3', pageSize: '10' }))).toEqual({ skip: 20, take: 10 });
  });

  it('and it agrees with getPagination whenever it returns anything', () => {
    for (const query of [{ page: '1' }, { pageSize: '100' }, { page: '4', pageSize: '25' }]) {
      expect(getOptionalPagination(req(query))).toEqual(getPagination(req(query)));
    }
  });

  it('getPagination itself is unchanged for the callers that want a default', () => {
    expect(getPagination(req({}))).toEqual({ skip: 0, take: 20 });
    expect(getPagination(req({ pageSize: '1000' }))).toEqual({ skip: 0, take: 100 });
    expect(getPagination(req({ page: '0' }))).toEqual({ skip: 0, take: 20 });
  });
});

describe('no list controller truncates a caller that asked for nothing', () => {
  /**
   * Read from the source rather than from a route table: what matters is which
   * helper each `list` reaches for, and a new controller written with the old
   * one is exactly the regression this is here to catch.
   */
  const controllers = (() => {
    const modules = path.join(API_SRC, 'modules');
    const found: { file: string; src: string }[] = [];
    for (const dir of readdirSync(modules, { withFileTypes: true })) {
      if (!dir.isDirectory()) continue;
      for (const entry of readdirSync(path.join(modules, dir.name))) {
        if (!entry.endsWith('.controller.ts')) continue;
        const file = path.join('modules', dir.name, entry);
        found.push({ file, src: readFileSync(path.join(modules, dir.name, entry), 'utf8') });
      }
    }
    return found;
  })();

  it('finds the controllers to check', () => {
    expect(controllers.length).toBeGreaterThan(5);
  });

  it('none of them calls getPagination', () => {
    // `getPagination` is kept for a caller that genuinely wants a default page,
    // but no list on this API has a pager in front of it, so none may default.
    const offenders = controllers.filter((c) => /\bgetPagination\(/.test(c.src)).map((c) => c.file);
    expect(offenders, `${offenders.join(', ')} still default to the first 20 rows`).toEqual([]);
  });

  it('the four that page use the optional helper', () => {
    for (const file of [
      'modules/events/event.controller.ts',
      'modules/hall/hall.controller.ts',
      'modules/tableCategory/tableCategory.controller.ts',
      'modules/extraService/extraService.controller.ts',
    ]) {
      const found = controllers.find((c) => c.file === file);
      expect(found, `${file} is gone — this suite needs rewriting`).toBeDefined();
      expect(found!.src, file).toContain('getOptionalPagination');
    }
  });
});
