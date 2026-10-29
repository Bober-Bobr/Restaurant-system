import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { byLocalDay, clockOf, monthGrid, shiftMonth, slotForHour } from './bookingCalendar';

const here = dirname(fileURLToPath(import.meta.url));
const read = (path: string) => readFileSync(join(here, path), 'utf8');

describe('the month grid', () => {
  it('starts on Monday and pads the first week', () => {
    // 1 October 2026 is a Thursday: three blanks before it.
    const cells = monthGrid('2026-10');
    expect(cells.slice(0, 4)).toEqual([null, null, null, '2026-10-01']);
  });

  it('holds every day once and finishes the last week', () => {
    const cells = monthGrid('2026-10');
    expect(cells.length % 7).toBe(0);
    expect(cells.filter(Boolean)).toHaveLength(31);
    expect(cells.filter(Boolean).at(-1)).toBe('2026-10-31');
  });

  it('knows a leap February', () => {
    expect(monthGrid('2028-02').filter(Boolean)).toHaveLength(29);
    expect(monthGrid('2027-02').filter(Boolean)).toHaveLength(28);
  });
});

describe('moving between months', () => {
  it('crosses a year end both ways', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2027-01', -1)).toBe('2026-12');
    expect(shiftMonth('2026-10', -22)).toBe('2024-12');
  });
});

describe('bookings are filed under the reader’s own day', () => {
  it('sorts each day earliest first', () => {
    const late = new Date(2026, 9, 17, 19, 0).toISOString();
    const early = new Date(2026, 9, 17, 12, 30).toISOString();
    const map = byLocalDay([{ id: 'b', eventDate: late }, { id: 'a', eventDate: early }]);
    expect(map.get('2026-10-17')?.map((row) => row.id)).toEqual(['a', 'b']);
  });

  it('keeps a late-evening booking on its own evening', () => {
    // 23:30 local is the next UTC day east of Greenwich; a UTC key would file
    // the end of a wedding under the following morning.
    const at = new Date(2026, 9, 17, 23, 30).toISOString();
    expect([...byLocalDay([{ eventDate: at }]).keys()]).toEqual(['2026-10-17']);
  });

  it('drops a booking with no readable date instead of filing it under NaN', () => {
    expect(byLocalDay([{ eventDate: 'nope' }]).size).toBe(0);
  });

  it('prints a 24-hour clock', () => {
    expect(clockOf(new Date(2026, 9, 17, 19, 5).toISOString())).toBe('19:05');
    expect(clockOf('nope')).toBe('');
  });
});

describe('one set of slot windows', () => {
  it('matches the admin calendar', () => {
    expect(slotForHour(9)).toBe('breakfast');
    expect(slotForHour(13)).toBe('lunch');
    expect(slotForHour(18)).toBe('dinner');
    expect(slotForHour(23)).toBeNull();
  });

  it('is not redefined by either calendar', () => {
    // Two copies of "which hours are lunch" would show one booking as lunch on
    // the admin's screen and dinner on the owner's.
    for (const page of ['../pages/CalendarPage.tsx', '../pages/OwnerReportsPage.tsx']) {
      expect(read(page)).not.toMatch(/function slotForHour/);
      expect(read(page)).toMatch(/from '\.\.\/utils\/bookingCalendar'/);
    }
  });
});

describe('the owner’s Reports page', () => {
  const page = read('../pages/OwnerReportsPage.tsx');

  it('puts Calendar immediately after Profit & loss', () => {
    expect(page).toMatch(/SECTIONS: Section\[\] = \['pl', 'calendar',/);
  });

  it('fetches the calendar only while its tab is open', () => {
    expect(page).toMatch(/queryKey: \['rep-calendar'[\s\S]{0,200}enabled: section === 'calendar'/);
  });

  it('keeps the month controls outside the loading boundary', () => {
    // Inside it, the arrows vanish behind a skeleton on every press.
    const nav = page.indexOf('className="rep-cal-nav"');
    const asyncCal = page.indexOf('<Async query={calendarQuery}');
    expect(nav).toBeGreaterThan(0);
    expect(nav).toBeLessThan(asyncCal);
  });
});
