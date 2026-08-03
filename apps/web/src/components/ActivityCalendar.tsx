import { useMemo } from 'react';

// ── GitHub-style activity calendar ──────────────────────────────────────────
// One square per day for a rolling year: weeks run left→right as columns, days
// top→bottom within a column. Built from plain divs rather than a chart library
// — this codebase has no charting dependency and one square per day does not
// justify adding one.
//
// Days are keyed by LOCAL date string, matching how the server buckets them, so
// a square always means the day the person actually worked.

export type ActivityDay = { date: string; value: number; label?: string };

const DAY_MS = 24 * 60 * 60 * 1000;

/** Local YYYY-MM-DD. `toISOString()` would shift the date for anyone east of UTC. */
export function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function ActivityCalendar({
  days, end = new Date(), weeks = 53, accent = '#c9a42c',
  weekdayLabels = ['Mon', 'Wed', 'Fri'], monthLabels,
  onSelect, selected, emptyLabel = 'No activity',
}: {
  days: ActivityDay[];
  /** Last day shown, inclusive. */
  end?: Date;
  weeks?: number;
  accent?: string;
  weekdayLabels?: [string, string, string] | string[];
  monthLabels?: string[];
  onSelect?: (date: string) => void;
  selected?: string | null;
  emptyLabel?: string;
}) {
  const byDate = useMemo(() => {
    const map = new Map<string, ActivityDay>();
    for (const day of days) map.set(day.date, day);
    return map;
  }, [days]);

  const { columns, max, monthTicks } = useMemo(() => {
    // Anchor on the Monday of the week containing `end`, so the last column is
    // the current week and the grid does not shift as the week progresses.
    const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    const isoDow = (last.getDay() + 6) % 7; // Monday = 0
    const lastMonday = new Date(last.getTime() - isoDow * DAY_MS);

    const cols: { date: Date; key: string; value: number; label?: string }[][] = [];
    const ticks: { column: number; month: number }[] = [];
    let highest = 0;

    for (let w = weeks - 1; w >= 0; w -= 1) {
      const monday = new Date(lastMonday.getTime() - w * DAY_MS * 7);
      const column: { date: Date; key: string; value: number; label?: string }[] = [];
      for (let d = 0; d < 7; d += 1) {
        const date = new Date(monday.getTime() + d * DAY_MS);
        const key = localDateKey(date);
        const entry = byDate.get(key);
        const value = date > last ? -1 : entry?.value ?? 0; // -1 = future, not rendered
        if (value > highest) highest = value;
        column.push({ date, key, value, label: entry?.label });
      }
      const columnIndex = weeks - 1 - w;
      // A month tick goes on the first column whose Monday falls in a new month.
      const prev = cols[cols.length - 1]?.[0]?.date;
      if (!prev || prev.getMonth() !== monday.getMonth()) {
        ticks.push({ column: columnIndex, month: monday.getMonth() });
      }
      cols.push(column);
    }
    return { columns: cols, max: highest, monthTicks: ticks };
  }, [byDate, end, weeks]);

  // Five steps, like the original. Quartiles of the observed maximum rather than
  // fixed thresholds, so a quiet restaurant still sees contrast in its own data.
  const level = (value: number): number => {
    if (value <= 0) return 0;
    if (max <= 1) return 4;
    return Math.min(4, Math.ceil((value / max) * 4));
  };

  const shade = (value: number): string => {
    const step = level(value);
    if (step === 0) return 'rgba(255,255,255,0.07)';
    return `color-mix(in srgb, ${accent} ${step * 25}%, rgba(255,255,255,0.07))`;
  };

  const months = monthLabels ?? ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
        {/* Weekday gutter: Mon / Wed / Fri, as the original does. */}
        <div style={{ display: 'grid', gridTemplateRows: 'repeat(7, 1fr)', gap: 3, paddingTop: 16, flexShrink: 0 }}>
          {[0, 1, 2, 3, 4, 5, 6].map((row) => (
            <span key={row} style={{ fontSize: 9, lineHeight: '11px', color: 'rgba(255,255,255,0.42)', height: 11 }}>
              {row === 0 ? weekdayLabels[0] : row === 2 ? weekdayLabels[1] : row === 4 ? weekdayLabels[2] : ''}
            </span>
          ))}
        </div>

        <div style={{ display: 'grid', gap: 3, gridAutoFlow: 'column', flexShrink: 0 }}>
          {/* Month row sits in the same grid so ticks line up with their column. */}
          {columns.map((column, columnIndex) => {
            const tick = monthTicks.find((t) => t.column === columnIndex);
            return (
              <div key={columnIndex} style={{ display: 'grid', gridTemplateRows: 'auto repeat(7, 11px)', gap: 3 }}>
                <span style={{ fontSize: 9, height: 13, color: 'rgba(255,255,255,0.45)', whiteSpace: 'nowrap' }}>
                  {tick ? months[tick.month] : ''}
                </span>
                {column.map((cell) => {
                  if (cell.value < 0) return <span key={cell.key} style={{ width: 11, height: 11 }} />;
                  const isSelected = selected === cell.key;
                  return (
                    <button
                      key={cell.key}
                      type="button"
                      title={cell.label ?? `${cell.key}: ${cell.value || emptyLabel}`}
                      onClick={onSelect ? () => onSelect(cell.key) : undefined}
                      style={{
                        width: 11, height: 11, padding: 0, borderRadius: 2,
                        background: shade(cell.value),
                        border: isSelected ? '1px solid #fff' : '1px solid transparent',
                        cursor: onSelect ? 'pointer' : 'default',
                      }}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'flex-end', fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>
        <span>Less</span>
        {[0, 1, 2, 3, 4].map((step) => (
          <span key={step} style={{
            width: 11, height: 11, borderRadius: 2,
            background: step === 0 ? 'rgba(255,255,255,0.07)' : `color-mix(in srgb, ${accent} ${step * 25}%, rgba(255,255,255,0.07))`,
          }} />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}
