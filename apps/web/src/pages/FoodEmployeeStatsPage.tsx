import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  orderStatsService, orderTotalCents,
  type Granularity, type StatsScope, type WaiterOrder,
} from '../services/order.service';
import { ActivityCalendar, localDateKey } from '../components/ActivityCalendar';
import { useAdminStore } from '../store/admin.store';
import { useAuthStore } from '../store/auth.store';
import { translate, type TranslationKey } from '../utils/translate';
import { formatSum } from '../utils/currency';

// ── Statistics ──────────────────────────────────────────────────────────────
// Closed orders are the record: they are kept for a year (order.retention.ts)
// and everything here reads them. Three layers, coarse to fine:
//   1. the activity calendar — a rolling year at a glance, ALWAYS shown
//   2. the bar chart — day / week / month / year
//   3. the closed-order list — filtered by date and table
// Picking a square filters the list to that day, which is the only reason the
// calendar is interactive.

const GRANULARITIES: Granularity[] = ['day', 'week', 'month', 'year'];
const RANGES = [30, 90, 365] as const;

export const FoodEmployeeStatsPage = () => {
  const { locale } = useAdminStore();
  const t = (key: TranslationKey, p?: Record<string, string | number>) => translate(key, locale, p);
  const role = useAuthStore((s) => s.role);

  const mayAggregate = role === 'CATERING_ADMIN' || role === 'ADMIN' || role === 'CHIEF_ADMIN';
  const [scope, setScope] = useState<StatsScope>(mayAggregate ? 'restaurant' : 'me');
  const [granularity, setGranularity] = useState<Granularity>('day');
  const [metric, setMetric] = useState<'orders' | 'revenue'>('orders');
  const [rangeDays, setRangeDays] = useState<(typeof RANGES)[number]>(30);
  const [day, setDay] = useState<string | null>(null);
  const [table, setTable] = useState('');

  const today = localDateKey(new Date());

  const rangeFrom = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() - rangeDays + 1);
  }, [rangeDays, today]);

  // The calendar always covers a rolling year, independent of the chart range —
  // it is the "always available" overview, so narrowing the chart must not blank it.
  const yearFrom = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 364);
  }, [today]);

  const yearQuery = useQuery({
    queryKey: ['fe-stats-year', scope, today],
    queryFn: () => orderStatsService.buckets({ from: yearFrom, granularity: 'day', scope }),
  });

  const chartQuery = useQuery({
    queryKey: ['fe-stats-chart', scope, granularity, rangeDays, today],
    queryFn: () => orderStatsService.buckets({ from: rangeFrom, granularity, scope }),
  });

  const employeesQuery = useQuery({
    queryKey: ['fe-stats-employees', rangeDays, today],
    queryFn: () => orderStatsService.employees({ from: rangeFrom, scope: 'restaurant' }),
    enabled: mayAggregate && scope === 'restaurant',
  });

  const tablesQuery = useQuery({
    queryKey: ['fe-tables', scope],
    queryFn: () => orderStatsService.tables(scope),
  });

  // A picked calendar square (or the date field) narrows the list to one day.
  const dayStart = day ? new Date(`${day}T00:00:00`) : undefined;
  const dayEnd = dayStart ? new Date(dayStart.getTime() + 24 * 60 * 60 * 1000) : undefined;

  const historyQuery = useQuery({
    queryKey: ['fe-history', scope, day, table, rangeDays, today],
    queryFn: () => orderStatsService.history({
      from: dayStart ?? rangeFrom,
      to: dayEnd,
      table: table || undefined,
      scope,
      take: 50,
    }),
  });

  const calendarDays = useMemo(
    () => (yearQuery.data ?? []).map((bucket) => ({
      date: bucket.bucket,
      value: bucket.orders,
      label: `${bucket.bucket} · ${bucket.orders} · ${formatSum(bucket.revenueCents)}`,
    })),
    [yearQuery.data],
  );

  const buckets = chartQuery.data ?? [];
  const peak = Math.max(1, ...buckets.map((b) => (metric === 'orders' ? b.orders : b.revenueCents)));
  const totals = buckets.reduce(
    (acc, b) => ({ orders: acc.orders + b.orders, revenue: acc.revenue + b.revenueCents }),
    { orders: 0, revenue: 0 },
  );

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {mayAggregate && (
          <div style={{ display: 'flex', gap: 4 }}>
            <Chip active={scope === 'me'} onClick={() => setScope('me')}>{t('fe_scope_me')}</Chip>
            <Chip active={scope === 'restaurant'} onClick={() => setScope('restaurant')}>{t('fe_scope_restaurant')}</Chip>
          </div>
        )}
        <div style={{ display: 'flex', gap: 4, marginLeft: mayAggregate ? 'auto' : undefined }}>
          {RANGES.map((days) => (
            <Chip key={days} active={rangeDays === days} onClick={() => setRangeDays(days)}>
              {t('fe_last_days', { days })}
            </Chip>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
        <Stat label={t('fe_orders_closed')} value={String(totals.orders)} />
        <Stat label={t('fe_revenue')} value={formatSum(totals.revenue)} accent />
      </div>

      {/* ── Activity calendar: always shown, always a full year ── */}
      <section className="adm-card" style={{ padding: 16, display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <h2 className="adm-heading" style={{ margin: 0 }}>{t('fe_activity')}</h2>
          <span className="muted-text" style={{ fontSize: 12 }}>{t('fe_activity_hint')}</span>
          {day && (
            <button type="button" className="adm-btn-ghost adm-btn-sm" style={{ marginLeft: 'auto' }}
              onClick={() => setDay(null)}>
              {t('fe_clear_day')}
            </button>
          )}
        </div>
        {yearQuery.isLoading
          ? <div className="skeleton-shimmer" style={{ height: 110, borderRadius: 8 }} />
          : (
            <ActivityCalendar
              days={calendarDays}
              selected={day}
              onSelect={(picked) => setDay(picked === day ? null : picked)}
              emptyLabel={t('fe_no_activity')}
            />
          )}
      </section>

      {/* ── Chart ── */}
      <section className="adm-card" style={{ padding: 16, display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {GRANULARITIES.map((g) => (
              <Chip key={g} active={granularity === g} onClick={() => setGranularity(g)}>
                {t(`fe_by_${g}` as TranslationKey)}
              </Chip>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
            <Chip active={metric === 'orders'} onClick={() => setMetric('orders')}>{t('fe_orders')}</Chip>
            <Chip active={metric === 'revenue'} onClick={() => setMetric('revenue')}>{t('fe_revenue')}</Chip>
          </div>
        </div>

        {buckets.length === 0
          ? <p className="muted-text" style={{ margin: 0, fontSize: 14 }}>{t('fe_no_activity')}</p>
          : (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 160, overflowX: 'auto' }}>
              {buckets.map((bucket) => {
                const value = metric === 'orders' ? bucket.orders : bucket.revenueCents;
                return (
                  <div
                    key={bucket.bucket}
                    title={`${bucket.bucket} · ${bucket.orders} · ${formatSum(bucket.revenueCents)}`}
                    style={{
                      flex: '1 0 8px', minWidth: 8,
                      // A zero bar still gets 2px, so an empty day reads as a gap
                      // in a series rather than as nothing at all.
                      height: `${Math.max(2, (value / peak) * 100)}%`,
                      background: value > 0 ? '#c9a42c' : 'rgba(255,255,255,0.12)',
                      borderRadius: '3px 3px 0 0',
                    }}
                  />
                );
              })}
            </div>
          )}
      </section>

      {/* ── Per-employee comparison (Food Admin / Admin only) ── */}
      {mayAggregate && scope === 'restaurant' && (employeesQuery.data ?? []).length > 0 && (
        <section className="adm-card" style={{ padding: 16, display: 'grid', gap: 10 }}>
          <h2 className="adm-heading" style={{ margin: 0 }}>{t('fe_by_employee')}</h2>
          {(employeesQuery.data ?? []).map((row) => (
            <div key={row.waiterId ?? row.username} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
              <span style={{ flex: 1, minWidth: 0 }}>{row.username}</span>
              <span className="muted-text" style={{ whiteSpace: 'nowrap' }}>{row.orders}</span>
              <strong style={{ color: '#c9a42c', whiteSpace: 'nowrap' }}>{formatSum(row.revenueCents)}</strong>
            </div>
          ))}
        </section>
      )}

      {/* ── Closed orders, with filters ── */}
      <section className="adm-card" style={{ padding: 16, display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <h2 className="adm-heading" style={{ margin: 0 }}>{t('fe_closed_orders')}</h2>
          <span className="muted-text" style={{ fontSize: 12.5 }}>
            {historyQuery.data ? t('fe_found', { count: historyQuery.data.total }) : ''}
          </span>
        </div>

        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
          <label style={{ display: 'grid', gap: 4 }}>
            <span className="adm-label">{t('fe_filter_day')}</span>
            <input type="date" className="adm-input" value={day ?? ''} max={today}
              onChange={(e) => setDay(e.target.value || null)} />
          </label>
          <label style={{ display: 'grid', gap: 4 }}>
            <span className="adm-label">{t('fe_filter_table')}</span>
            <input className="adm-input" list="fe-tables" value={table}
              placeholder={t('fe_all_tables')}
              onChange={(e) => setTable(e.target.value)} />
            <datalist id="fe-tables">
              {(tablesQuery.data ?? []).map((value) => <option key={value} value={value} />)}
            </datalist>
          </label>
        </div>

        {historyQuery.isLoading && <div className="skeleton-shimmer" style={{ height: 80, borderRadius: 8 }} />}
        {!historyQuery.isLoading && (historyQuery.data?.items ?? []).length === 0 && (
          <p className="muted-text" style={{ margin: 0, fontSize: 14 }}>{t('fe_no_closed_orders')}</p>
        )}

        <div style={{ display: 'grid', gap: 8 }}>
          {(historyQuery.data?.items ?? []).map((order) => (
            <ClosedOrderRow key={order.id} order={order} t={t} showWho={scope === 'restaurant'} />
          ))}
        </div>
      </section>
    </div>
  );
};

function ClosedOrderRow({
  order, t, showWho,
}: {
  order: WaiterOrder;
  t: (k: TranslationKey, p?: Record<string, string | number>) => string;
  showWho: boolean;
}) {
  const [open, setOpen] = useState(false);
  const closed = order.closedAt ? new Date(order.closedAt) : null;

  return (
    <div style={{ borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden' }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
          background: 'transparent', border: 0, cursor: 'pointer', color: 'inherit', textAlign: 'left',
          flexWrap: 'wrap',
        }}
      >
        <span style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: '0.1em', color: '#c9a42c' }}>
          {order.code}
        </span>
        <span style={{ fontSize: 13.5 }}>{t('fe_table_short')} {order.tableNumber ?? '—'}</span>
        <span className="muted-text" style={{ fontSize: 12.5 }}>
          {closed ? closed.toLocaleString([], { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
        </span>
        {showWho && order.waiter && (
          <span className="muted-text" style={{ fontSize: 12.5 }}>{order.waiter.username}</span>
        )}
        <strong style={{ marginLeft: 'auto', whiteSpace: 'nowrap' }}>{formatSum(orderTotalCents(order))}</strong>
        <span className="muted-text" style={{ fontSize: 11 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{ padding: '0 12px 12px', display: 'grid', gap: 5 }}>
          {order.items.map((line) => (
            <div key={line.id} style={{ display: 'flex', gap: 10, fontSize: 13 }}>
              <span className="muted-text" style={{ minWidth: 26, fontVariantNumeric: 'tabular-nums' }}>
                {line.quantity}×
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>{line.nameSnapshot}</span>
              <span style={{ whiteSpace: 'nowrap' }}>{formatSum(line.unitPriceCents * line.quantity)}</span>
            </div>
          ))}
          {order.comment && (
            <p className="muted-text" style={{ margin: '4px 0 0', fontSize: 12.5, lineHeight: 1.5 }}>
              💬 {order.comment}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} style={{
      padding: '6px 12px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
      border: '1px solid rgba(255,255,255,0.14)',
      background: active ? '#fff' : 'transparent',
      color: active ? '#000' : 'rgba(255,255,255,0.7)',
    }}>
      {children}
    </button>
  );
}

function Stat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="adm-card" style={{ padding: '13px 15px', display: 'grid', gap: 4 }}>
      <span className="adm-label" style={{ margin: 0 }}>{label}</span>
      <strong style={{ fontSize: 21, color: accent ? '#c9a42c' : undefined }}>{value}</strong>
    </div>
  );
}
