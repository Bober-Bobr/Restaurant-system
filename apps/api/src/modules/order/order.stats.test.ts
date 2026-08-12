import { describe, expect, it } from 'vitest';
import { clampOffset, parseGranularity, resolveRange } from './order.stats.js';

// The statistics page's inputs all come from a client, so each one is a value
// somebody could send anything at all in.

describe('the reporting window', () => {
  it('defaults to the last twelve months', () => {
    // Which is exactly what retention keeps, so the default range can never
    // promise data that has already been purged.
    const { from, to } = resolveRange();
    const days = (to.getTime() - from.getTime()) / 86_400_000;
    expect(Math.round(days)).toBe(365);
  });

  it('honours both ends when given', () => {
    const { from, to } = resolveRange('2026-01-01', '2026-02-01');
    expect(from.toISOString().slice(0, 10)).toBe('2026-01-01');
    expect(to.toISOString().slice(0, 10)).toBe('2026-02-01');
  });

  it('swaps a reversed range rather than returning nothing', () => {
    // An empty chart is indistinguishable from "you had no orders".
    const { from, to } = resolveRange('2026-02-01', '2026-01-01');
    expect(from.toISOString().slice(0, 10)).toBe('2026-01-01');
    expect(to.toISOString().slice(0, 10)).toBe('2026-02-01');
  });

  it('falls back to the default year on an unparseable date', () => {
    const { from, to } = resolveRange('not-a-date', 'nonsense');
    expect(Number.isNaN(from.getTime())).toBe(false);
    expect(Number.isNaN(to.getTime())).toBe(false);
    expect(Math.round((to.getTime() - from.getTime()) / 86_400_000)).toBe(365);
  });

  it('counts back a year from an explicit end when only the end is given', () => {
    const { from, to } = resolveRange(undefined, '2026-06-01');
    expect(to.toISOString().slice(0, 10)).toBe('2026-06-01');
    expect(from.toISOString().slice(0, 10)).toBe('2025-06-01');
  });
});

describe('the viewer\'s timezone offset', () => {
  // Buckets are computed in the viewer's local time: a restaurant serving until
  // 02:00 closes orders that are already "yesterday" in UTC, and bucketing by
  // UTC would split one busy night across two squares of the calendar.
  it('keeps a real offset', () => {
    expect(clampOffset(300)).toBe(300);   // UTC+5, Tashkent
    expect(clampOffset(-480)).toBe(-480); // UTC-8
    expect(clampOffset(0)).toBe(0);
  });

  it('clamps to the range real timezones actually span', () => {
    expect(clampOffset(99999)).toBe(840);   // UTC+14, the eastern extreme
    expect(clampOffset(-99999)).toBe(-720); // UTC-12
  });

  it('treats junk as UTC rather than throwing', () => {
    for (const junk of [undefined, null, 'abc', NaN, Infinity, {}, []]) {
      expect(clampOffset(junk)).toBe(0);
    }
  });

  it('accepts the numeric string a query parameter actually arrives as', () => {
    expect(clampOffset('300')).toBe(300);
  });

  it('rounds a fractional offset', () => {
    expect(clampOffset(330.4)).toBe(330); // UTC+5:30 exists; fractions of a minute do not
  });
});

describe('granularity', () => {
  it('accepts the four the SQL knows', () => {
    for (const unit of ['day', 'week', 'month', 'year'] as const) {
      expect(parseGranularity(unit)).toBe(unit);
    }
  });

  it('falls back to day for anything else', () => {
    // The value reaches `date_trunc`, so it is restricted to a known set rather
    // than passed through — this is the restriction.
    for (const junk of ['hour', 'century', '; DROP TABLE "Order"', undefined, null, 7, {}]) {
      expect(parseGranularity(junk)).toBe('day');
    }
  });
});
