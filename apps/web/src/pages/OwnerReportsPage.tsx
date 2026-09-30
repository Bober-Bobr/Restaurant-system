import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ActivityCalendar } from '../components/ActivityCalendar';
import {
  CH, CH_HEX, CHART_CSS, ChartLegend, ColumnChart, DivergingColumns, RankedBars, ShareBar, Sparkline,
} from '../components/charts/Charts';
import { compactCount, compactSum, monthLabel, spansYears } from '../components/charts/chartGeometry';
import { StickyHScroll } from '../components/ui/StickyHScroll';
import {
  reportService, type AreaRow, type AreasReport, type FinanceReport, type MenuReport,
  type MenuRow, type ReportFilters, type ScopeReport, type StaffReport,
} from '../services/report.service';
import { CATEGORY_LABEL_KEY } from '../utils/menuCategories';
import { formatSum } from '../utils/currency';
import { translate, type Locale, type TranslationKey } from '../utils/translate';

/**
 * The owner's Reports page.
 *
 * Four sections behind sub-tabs, and the tabs are not decoration: each section's
 * query is `enabled` only while it is open, so opening Reports costs ONE request
 * rather than five. The dish list alone can be several hundred rows with three
 * prices each, and an owner who wanted the profit figure should not wait for it.
 *
 * ── WHAT THIS PAGE IS CAREFUL ABOUT ────────────────────────────────────────
 * Every figure here is read by somebody deciding something, so where the data
 * cannot answer a question the page SAYS SO rather than drawing a zero:
 *
 *   · no Restaurant Manager assigned → there is no spending side anywhere in the
 *     product, so there is no profit. A flat zero line would read as "spent
 *     nothing", which is the opposite of "nobody is recording it".
 *   · spending is not recorded per dining area → the areas section reports what
 *     each room EARNED and says plainly that no per-area profit exists to show.
 *   · bookings are already mirrored into the ledger → they are reported beside
 *     the profit and never added to it.
 *
 * Charts are hand-drawn SVG (components/charts). This codebase has no charting
 * dependency and the owner's cabinet sits in the entry chunk every public page
 * downloads, so a library here would be paid for by someone tapping an NFC tag.
 */

type Section = 'pl' | 'areas' | 'menu' | 'staff';
const RANGES = [30, 90, 365] as const;

const DEPARTMENT_KEY: Record<string, TranslationKey> = {
  NAHOR: 'dept_nahor', FOTIHA: 'dept_fotiha', TUI: 'dept_tui', OTHERS: 'dept_others',
};

const ROLE_KEY: Record<string, TranslationKey> = {
  CHIEF_ADMIN: 'chief_admin_role', MANAGER: 'manager_role', OWNER: 'owner_role',
  ADMIN: 'administrator_role', CATERING_ADMIN: 'catering_admin_role',
  RESTAURANT_MANAGER: 'restaurant_manager_role', EMPLOYEE: 'employee_role',
  KITCHEN: 'kitchen_role', NFC_MAKER: 'nfc_maker_role', SUPERVISOR: 'supervisor_role',
  SMALL_KITCHEN: 'small_kitchen_role', PERFORMER: 'performer_role', HOST: 'host_role',
  CATERING_EMPLOYEE: 'food_employee_role',
};

const STATUS_KEY: Record<string, TranslationKey> = {
  DRAFT: 'status_draft', CONFIRMED: 'status_confirmed', CANCELLED: 'status_cancelled',
  COMPLETED: 'status_completed', MENU_NOT_SELECTED: 'status_menu_not_selected',
};

/** Local `YYYY-MM-DD`. `toISOString()` would shift the day for anyone east of UTC. */
const dayKey = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export const OwnerReportsPage = ({ locale }: { locale: Locale }) => {
  const t = (key: TranslationKey, params?: Record<string, string | number>) => translate(key, locale, params);
  const money = (tiyin: number) => formatSum(tiyin);
  const shortMoney = (tiyin: number) => compactSum(tiyin, locale === 'en' ? 'en-US' : 'ru-RU');

  const [section, setSection] = useState<Section>('pl');
  const [restaurantId, setRestaurantId] = useState('');
  const [rangeDays, setRangeDays] = useState<number>(90);
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const today = dayKey(new Date());

  // A custom range only takes effect once BOTH ends are typed. Applying it after
  // the first field would refetch against a window starting in 1970 and show a
  // report the reader did not ask for while they are still typing.
  const filters: ReportFilters = useMemo(() => {
    const custom = rangeDays === 0 && customFrom && customTo;
    if (custom) {
      return {
        restaurantId: restaurantId || undefined,
        from: new Date(`${customFrom}T00:00:00`),
        to: new Date(`${customTo}T00:00:00`),
      };
    }
    const now = new Date();
    const days = rangeDays === 0 ? 90 : rangeDays;
    return {
      restaurantId: restaurantId || undefined,
      from: new Date(now.getFullYear(), now.getMonth(), now.getDate() - days + 1),
      to: now,
    };
  }, [restaurantId, rangeDays, customFrom, customTo, today]);

  const key = [restaurantId, rangeDays, rangeDays === 0 ? customFrom : '', rangeDays === 0 ? customTo : '', today];

  const scopeQuery = useQuery({
    queryKey: ['rep-scope', ...key],
    queryFn: () => reportService.scope(filters),
  });
  const financeQuery = useQuery({
    queryKey: ['rep-finance', ...key],
    queryFn: () => reportService.finance(filters),
    enabled: section === 'pl',
  });
  const areasQuery = useQuery({
    queryKey: ['rep-areas', ...key],
    queryFn: () => reportService.areas(filters),
    enabled: section === 'areas',
  });
  const menuQuery = useQuery({
    queryKey: ['rep-menu', ...key],
    queryFn: () => reportService.menu(filters),
    enabled: section === 'menu',
  });
  const staffQuery = useQuery({
    queryKey: ['rep-staff', ...key],
    queryFn: () => reportService.staff(filters),
    enabled: section === 'staff',
  });

  const restaurants = scopeQuery.data?.restaurants ?? [];
  const nameOf = (id: string | null) => restaurants.find((one) => one.id === id)?.name ?? '—';
  const many = restaurants.length > 1 && !restaurantId;

  return (
    <div className="rep-root">
      <style>{CHART_CSS}{PAGE_CSS}</style>

      {/* ── Filters, in ONE row above everything, so the whole page is reading
          the same window and it is obvious which. ── */}
      <div className="rep-bar">
        <label className="rep-field">
          <span className="adm-label">{t('rep_restaurant')}</span>
          <select className="adm-input" value={restaurantId} onChange={(e) => setRestaurantId(e.target.value)}>
            <option value="">{t('rep_all_restaurants')}</option>
            {restaurants.map((one) => <option key={one.id} value={one.id}>{one.name}</option>)}
          </select>
        </label>

        <div className="rep-chips">
          {RANGES.map((days) => (
            <Chip key={days} active={rangeDays === days} onClick={() => setRangeDays(days)}>
              {t('rep_last_days', { days })}
            </Chip>
          ))}
          <Chip active={rangeDays === 0} onClick={() => setRangeDays(0)}>{t('rep_custom')}</Chip>
        </div>

        {rangeDays === 0 && (
          <>
            <label className="rep-field">
              <span className="adm-label">{t('rep_from')}</span>
              <input type="date" className="adm-input" max={customTo || today}
                value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
            </label>
            <label className="rep-field">
              <span className="adm-label">{t('rep_to')}</span>
              <input type="date" className="adm-input" min={customFrom || undefined} max={today}
                value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
            </label>
          </>
        )}
      </div>

      {restaurants.length > 0 && (
        <p className="rep-note" style={{ margin: 0 }}>
          {many ? t('rep_covering', { count: restaurants.length }) : t('rep_covering_one', { name: restaurants[0]?.name ?? '' })}
        </p>
      )}

      <nav className="rep-tabs">
        {(['pl', 'areas', 'menu', 'staff'] as Section[]).map((one) => (
          <button key={one} type="button"
            className={`rep-tab${section === one ? ' is-active' : ''}`}
            onClick={() => setSection(one)}>
            {t(`rep_tab_${one}` as TranslationKey)}
          </button>
        ))}
      </nav>

      {section === 'pl' && (
        <Async query={financeQuery} t={t}>
          {(data) => <ProfitSection data={data} t={t} locale={locale} money={money} shortMoney={shortMoney} nameOf={nameOf} />}
        </Async>
      )}
      {section === 'areas' && (
        <Async query={areasQuery} t={t}>
          {(data) => <AreasSection data={data} t={t} money={money} shortMoney={shortMoney} nameOf={nameOf} many={many} />}
        </Async>
      )}
      {section === 'menu' && (
        <Async query={menuQuery} t={t}>
          {(data) => <MenuSection data={data} t={t} money={money} shortMoney={shortMoney} />}
        </Async>
      )}
      {section === 'staff' && (
        <Async query={staffQuery} t={t}>
          {(data) => <StaffSection data={data} t={t} locale={locale} money={money} shortMoney={shortMoney} nameOf={nameOf} many={many} />}
        </Async>
      )}

      {section === 'pl' && scopeQuery.data && (
        <BusinessSection data={scopeQuery.data} t={t} />
      )}
    </div>
  );
};

// ── Profit and loss ─────────────────────────────────────────────────────────

type T = (key: TranslationKey, params?: Record<string, string | number>) => string;

function ProfitSection({
  data, t, locale, money, shortMoney, nameOf,
}: {
  data: FinanceReport;
  t: T; locale: Locale; money: (v: number) => string; shortMoney: (v: number) => string;
  nameOf: (id: string | null) => string;
}) {
  const months = data.byMonth.map((row) => row.month);
  const withYear = spansYears(months);
  const labels = months.map((month) => monthLabel(month, locale, withYear));
  const profitable = data.total.balanceCents >= 0;

  return (
    <>
      {/* The ledger is the only source of spending. Without one there is no
          profit to report, and saying so is the whole content of this panel. */}
      {data.ledgerManagers.length === 0 && (
        <Notice tone="warn" title={t('rep_ledger_missing')} body={t('rep_ledger_missing_hint')} />
      )}

      {/* ── The hero figure: exactly one per view ── */}
      <section className="adm-card adm-card-lead rep-hero">
        <div>
          <span className="adm-label">{profitable ? t('rep_net') : t('rep_net_loss')}</span>
          <strong className="rep-hero-value" style={{ color: profitable ? CH.revenue : CH.loss }}>
            {money(data.total.balanceCents)}
          </strong>
          <span className="rep-note">
            {data.total.marginPct === null
              ? t('rep_margin_na')
              : `${t('rep_margin')} ${data.total.marginPct}%`}
          </span>
        </div>
        <Sparkline
          values={data.byMonth.map((row) => row.balanceCents)}
          color={profitable ? CH.revenue : CH.loss}
          width={120}
          height={34}
        />
      </section>

      <div className="rep-stats">
        <Stat label={t('rep_revenue')} value={money(data.total.revenueCents)} swatch={CH.revenue} />
        <Stat label={t('rep_spent')} value={money(data.total.spentCents)} swatch={CH.spend} />
        <Stat label={t('rep_bookings')} value={String(data.bookings.count)}
          sub={t('rep_avg_guests') + ': ' + data.bookings.averageGuests} />
        <Stat label={t('rep_orders')} value={String(data.orders.count)}
          sub={money(data.orders.revenueCents)} />
      </div>

      {/* ── Revenue against spending, month by month ── */}
      <Panel title={t('rep_by_month')}>
        <ChartLegend series={[
          { label: t('rep_revenue'), color: CH.revenue },
          { label: t('rep_spent'), color: CH.spend },
        ]} />
        <ColumnChart
          categories={labels}
          series={[
            { key: 'rev', label: t('rep_revenue'), color: CH.revenue, values: data.byMonth.map((row) => row.revenueCents) },
            { key: 'spend', label: t('rep_spent'), color: CH.spend, values: data.byMonth.map((row) => row.spentCents) },
          ]}
          format={shortMoney}
          tipTitle={(index) => monthLabel(months[index], locale, true)}
          emptyLabel={t('rep_no_data')}
        />
      </Panel>

      {/* ── The same months as a balance, which is the question an owner asks ──
          Position carries the sign here as well as colour: profit above the
          line, loss below it. */}
      <Panel title={t('rep_balance_by_month')}>
        <DivergingColumns
          categories={labels}
          values={data.byMonth.map((row) => row.balanceCents)}
          format={shortMoney}
          tipTitle={(index) => monthLabel(months[index], locale, true)}
          positiveLabel={t('rep_profit')}
          negativeLabel={t('rep_loss')}
        />
      </Panel>

      <div className="rep-two">
        <Panel title={t('rep_revenue_sources')}>
          <ShareBar parts={[
            { key: 'ledger', label: t('rep_src_ledger'), value: data.ledger.revenueCents, color: CH.revenue, display: money(data.ledger.revenueCents) },
            { key: 'orders', label: t('rep_src_orders'), value: data.orders.revenueCents, color: CH.count, display: money(data.orders.revenueCents) },
          ]} />
        </Panel>

        <Panel title={t('rep_spend_breakdown')} note={data.ledger.extrasCents > 0 ? t('rep_extras_note') : undefined}>
          <RankedBars
            color={CH.spend}
            emptyLabel={t('rep_no_data')}
            rows={[
              { key: 'p', name: t('rep_products'), value: data.ledger.productsCents, display: money(data.ledger.productsCents) },
              { key: 's', name: t('rep_salaries'), value: data.ledger.salariesCents, display: money(data.ledger.salariesCents) },
              { key: 'a', name: t('rep_additionals'), value: data.ledger.additionalsCents, display: money(data.ledger.additionalsCents) },
              { key: 'e', name: t('rep_extras'), value: data.ledger.extrasCents, display: money(data.ledger.extrasCents) },
            ].filter((row) => row.value > 0)}
          />
        </Panel>
      </div>

      {/* ── Per department: the ledger's own four sittings ── */}
      <Panel title={t('rep_by_department')}
        note={`${t('rep_days_recorded')}: ${data.ledger.daysRecorded}`}>
        <ChartLegend series={[
          { label: t('rep_revenue'), color: CH.revenue },
          { label: t('rep_spent'), color: CH.spend },
        ]} />
        <ColumnChart
          categories={data.ledger.byDepartment.map((row) => t(DEPARTMENT_KEY[row.type] ?? 'rep_by_department'))}
          series={[
            { key: 'rev', label: t('rep_revenue'), color: CH.revenue, values: data.ledger.byDepartment.map((row) => row.revenueCents) },
            { key: 'spend', label: t('rep_spent'), color: CH.spend, values: data.ledger.byDepartment.map((row) => row.spentCents) },
          ]}
          format={shortMoney}
          height={180}
          emptyLabel={t('rep_no_data')}
        />
        <StickyHScroll>
          <table className="rep-table">
            <thead>
              <tr>
                <th>{t('rep_by_department')}</th>
                <th className="num">{t('guests')}</th>
                <th className="num">{t('rep_revenue')}</th>
                <th className="num">{t('rep_spent')}</th>
                <th className="num">{t('rep_profit')}</th>
                <th className="num">{t('rep_margin')}</th>
              </tr>
            </thead>
            <tbody>
              {data.ledger.byDepartment.map((row) => (
                <tr key={row.type}>
                  <td>{t(DEPARTMENT_KEY[row.type] ?? 'rep_by_department')}</td>
                  <td className="num">{row.guests.toLocaleString('ru-RU')}</td>
                  <td className="num">{money(row.revenueCents)}</td>
                  <td className="num">{money(row.spentCents)}</td>
                  <td className="num" style={{ color: row.balanceCents >= 0 ? CH.revenue : CH.loss }}>
                    {money(row.balanceCents)}
                  </td>
                  <td className="num">{row.marginPct === null ? '—' : `${row.marginPct}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </StickyHScroll>
      </Panel>

      {/* ── Bookings, beside the profit and never inside it ── */}
      <Panel title={t('rep_bookings')} note={t('rep_bookings_note')}>
        {data.bookings.bookingsBeyondLedger > 0 && (
          <Notice
            tone="warn"
            title={t('rep_beyond_ledger', { count: data.bookings.bookingsBeyondLedger })}
            body={t('rep_beyond_ledger_hint')}
          />
        )}
        <ShareBar parts={[
          { key: 'in', label: t('rep_collected'), value: data.bookings.collectedCents, color: CH.revenue, display: money(data.bookings.collectedCents) },
          { key: 'owed', label: t('rep_outstanding'), value: data.bookings.outstandingCents, color: CH.spend, display: money(data.bookings.outstandingCents) },
        ]} />
        <div className="rep-stats">
          <Stat label={t('rep_invoiced')} value={money(data.bookings.invoicedCents)} />
          <Stat label={t('rep_avg_invoice')} value={money(data.bookings.averageInvoiceCents)} />
          <Stat label={t('guests')} value={data.bookings.guests.toLocaleString('ru-RU')} />
          <Stat label={t('rep_cancelled')} value={String(data.bookings.cancelled)} />
        </div>
        {data.bookings.bySection.length > 1 && (
          <RankedBars
            color={CH.revenue}
            emptyLabel={t('rep_no_data')}
            rows={data.bookings.bySection.map((row) => ({
              key: row.section,
              name: row.section === 'SMALL_BANQUET' ? t('rep_section_small') : t('rep_section_banquet'),
              value: row.invoicedCents,
              display: money(row.invoicedCents),
              sub: `${row.count} · ${row.guests} ${t('guests').toLowerCase()}`,
            }))}
          />
        )}
        {data.bookings.byStatus.length > 0 && (
          <ul className="ch-legend" style={{ marginTop: 2 }}>
            {data.bookings.byStatus.map((row) => (
              <li key={row.status}>
                {t(STATUS_KEY[row.status] ?? 'rep_bookings')}
                <strong style={{ color: '#f1f5f9' }}>{row.count}</strong>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {/* ── A rolling look at every day in the window ── */}
      <Panel title={t('rep_activity')} note={t('rep_activity_hint')}>
        <ActivityCalendar
          days={data.byDay.map((row) => ({
            date: row.date,
            value: row.revenueCents,
            label: `${row.date} · ${money(row.revenueCents)}`,
          }))}
          locale={locale}
          // Raw hex, not the custom property: the calendar draws its own
          // elements outside the `.ch` subtree, where `var(--ch-revenue)` would
          // resolve to nothing and every square would come out blank.
          accent={CH_HEX.revenue}
          lessLabel={t('fe_less')}
          moreLabel={t('fe_more')}
          emptyLabel={t('rep_no_activity')}
        />
      </Panel>

      {data.ledgerManagers.length > 1 && (
        <p className="rep-note">
          {data.ledgerManagers.map((one) => `${one.username} — ${nameOf(one.restaurantId)}`).join(' · ')}
        </p>
      )}
    </>
  );
}

// ── Dining areas ────────────────────────────────────────────────────────────

function AreasSection({
  data, t, money, shortMoney, nameOf, many,
}: {
  data: AreasReport;
  t: T; money: (v: number) => string; shortMoney: (v: number) => string;
  nameOf: (id: string | null) => string; many: boolean;
}) {
  const areaName = (area: AreaRow) =>
    `${area.name}${many ? ` · ${nameOf(area.restaurantId)}` : ''}`;
  const earning = data.areas.filter((area) => area.invoicedCents > 0);

  return (
    <>
      <Notice tone="info" title={t('rep_areas_title')} body={t('rep_areas_spend_note')} />

      <div className="rep-stats">
        <Stat label={t('rep_invoiced')} value={money(data.totals.invoicedCents)} swatch={CH.revenue} />
        <Stat label={t('rep_collected')} value={money(data.totals.collectedCents)} />
        <Stat label={t('rep_bookings')} value={String(data.totals.bookings)} />
        <Stat label={t('guests')} value={data.totals.guests.toLocaleString('ru-RU')} />
      </div>

      <Panel title={t('rep_area_revenue')}>
        <RankedBars
          color={CH.revenue}
          emptyLabel={t('rep_no_data')}
          rows={earning.map((area) => ({
            key: area.id,
            name: areaName(area),
            value: area.invoicedCents,
            display: shortMoney(area.invoicedCents),
            sub: `${area.count} · ${area.guests} ${t('guests').toLowerCase()}${area.fillPct !== null ? ` · ${area.fillPct}%` : ''}`,
          }))}
        />
      </Panel>

      <Panel title={t('rep_areas_title')}>
        <StickyHScroll>
          <table className="rep-table">
            <thead>
              <tr>
                <th>{t('rep_area')}</th>
                <th>{t('rep_section')}</th>
                <th className="num">{t('rep_capacity')}</th>
                <th className="num">{t('rep_tables')}</th>
                <th className="num">{t('rep_bookings')}</th>
                <th className="num">{t('guests')}</th>
                <th className="num">{t('rep_fill')}</th>
                <th className="num">{t('rep_invoiced')}</th>
                <th className="num">{t('rep_collected')}</th>
                <th className="num">{t('rep_outstanding')}</th>
                <th className="num">{t('rep_per_guest')}</th>
              </tr>
            </thead>
            <tbody>
              {data.areas.map((area) => (
                <tr key={area.id}>
                  <td>
                    {areaName(area)}
                    {area.kind === 'OUTDOOR' && <span className="rep-pill">{t('rep_kind_outdoor')}</span>}
                    {!area.isActive && <span className="rep-pill is-off">{t('rep_retired')}</span>}
                  </td>
                  <td>{area.section === 'SMALL_BANQUET' ? t('rep_section_small') : t('rep_section_banquet')}</td>
                  <td className="num">{area.capacity || '—'}</td>
                  <td className="num">{area.tables || '—'}</td>
                  <td className="num">{area.count}</td>
                  <td className="num">{area.guests.toLocaleString('ru-RU')}</td>
                  <td className="num">{area.fillPct === null ? '—' : `${area.fillPct}%`}</td>
                  <td className="num">{money(area.invoicedCents)}</td>
                  <td className="num">{money(area.collectedCents)}</td>
                  <td className="num">{money(area.outstandingCents)}</td>
                  <td className="num">{area.revenuePerGuestCents > 0 ? money(area.revenuePerGuestCents) : '—'}</td>
                </tr>
              ))}
              {/* Bookings naming no room belong to no area's figures, and are
                  shown so the rows add up to the total above. */}
              {data.unassigned.count > 0 && (
                <tr className="rep-row-muted">
                  <td>{t('rep_unassigned')}</td>
                  <td>—</td><td className="num">—</td><td className="num">—</td>
                  <td className="num">{data.unassigned.count}</td>
                  <td className="num">{data.unassigned.guests.toLocaleString('ru-RU')}</td>
                  <td className="num">—</td>
                  <td className="num">{money(data.unassigned.invoicedCents)}</td>
                  <td className="num">{money(data.unassigned.collectedCents)}</td>
                  <td className="num">{money(data.unassigned.outstandingCents)}</td>
                  <td className="num">—</td>
                </tr>
              )}
            </tbody>
          </table>
        </StickyHScroll>
        {data.areas.length === 0 && <p className="rep-note">{t('rep_no_data')}</p>}
      </Panel>
    </>
  );
}

// ── The dish table ──────────────────────────────────────────────────────────

type MenuSort = 'demand' | 'revenue' | 'price' | 'name';

function MenuSection({
  data, t, money, shortMoney,
}: {
  data: MenuReport;
  t: T; money: (v: number) => string; shortMoney: (v: number) => string;
}) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState<MenuSort>('demand');

  const label = (key: string) =>
    (CATEGORY_LABEL_KEY as Record<string, TranslationKey>)[key]
      ? t((CATEGORY_LABEL_KEY as Record<string, TranslationKey>)[key])
      : key;

  const shown = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    const found = data.items.filter((item) =>
      (!needle || item.name.toLocaleLowerCase().includes(needle))
      && (!category || item.category === category));
    return sortItems(found, sort);
  }, [data.items, query, category, sort]);

  const topDishes = useMemo(
    () => sortItems(data.items, 'demand').filter((item) => item.demand > 0).slice(0, 10),
    [data.items],
  );

  return (
    <>
      <Notice tone="info" title={t('rep_tab_menu')} body={t('rep_menu_note')} />

      <div className="rep-stats">
        <Stat label={t('rep_dishes')} value={String(data.totals.dishes)} />
        <Stat label={t('rep_active')} value={String(data.totals.active)} swatch={CH.revenue} />
        <Stat label={t('rep_out_of_stock')} value={String(data.totals.outOfStock)} />
        <Stat label={t('rep_never_chosen')} value={String(data.totals.neverChosen)} />
      </div>

      <div className="rep-two">
        <Panel title={t('rep_by_category')}>
          <RankedBars
            color={CH.count}
            emptyLabel={t('rep_no_data')}
            rows={data.byCategory.slice(0, 12).map((row) => ({
              key: row.category,
              name: label(row.category),
              value: row.dishes,
              display: compactCount(row.dishes, 'ru-RU'),
              sub: row.averagePriceCents > 0 ? `${t('rep_avg_price')}: ${shortMoney(row.averagePriceCents)}` : undefined,
            }))}
          />
        </Panel>

        <Panel title={t('rep_top_dishes')}>
          <RankedBars
            color={CH.revenue}
            emptyLabel={t('rep_no_data')}
            rows={topDishes.map((item) => ({
              key: item.id,
              name: item.name,
              value: item.demand,
              display: compactCount(item.demand, 'ru-RU'),
              sub: `${label(item.category)} · ${shortMoney(item.demandRevenueCents)}`,
            }))}
          />
        </Panel>
      </div>

      <Panel title={t('rep_dishes')}>
        <div className="rep-bar">
          <label className="rep-field">
            <span className="adm-label">{t('rep_search_dish')}</span>
            <input className="adm-input" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          <label className="rep-field">
            <span className="adm-label">{t('rep_category')}</span>
            <select className="adm-input" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">{t('rep_all_categories')}</option>
              {data.byCategory.map((row) => (
                <option key={row.category} value={row.category}>{label(row.category)}</option>
              ))}
            </select>
          </label>
          <label className="rep-field">
            <span className="adm-label">{t('rep_sort')}</span>
            <select className="adm-input" value={sort} onChange={(e) => setSort(e.target.value as MenuSort)}>
              <option value="demand">{t('rep_sort_demand')}</option>
              <option value="revenue">{t('rep_sort_revenue')}</option>
              <option value="price">{t('rep_sort_price')}</option>
              <option value="name">{t('rep_sort_name')}</option>
            </select>
          </label>
        </div>

        <p className="rep-note" style={{ margin: 0 }}>
          {t('rep_shown_of', { shown: shown.length, total: data.items.length })}
        </p>

        {shown.length === 0 ? (
          <p className="rep-note">{data.items.length === 0 ? t('rep_no_data') : t('rep_none_match')}</p>
        ) : (
          <StickyHScroll>
            <table className="rep-table">
              <thead>
                <tr>
                  <th>{t('rep_dish')}</th>
                  <th>{t('rep_category')}</th>
                  <th className="num">{t('rep_price_banquet')}</th>
                  <th className="num">{t('rep_price_small')}</th>
                  <th className="num">{t('rep_price_catering')}</th>
                  <th className="num">{t('rep_demand_booked')}</th>
                  <th className="num">{t('rep_demand_ordered')}</th>
                  <th className="num">{t('rep_revenue')}</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((item) => (
                  <tr key={item.id} className={item.isActive ? undefined : 'rep-row-muted'}>
                    <td>
                      {item.name}
                      {item.isBestseller && <span className="rep-pill">★</span>}
                      {item.isOutOfStock && <span className="rep-pill is-off">{t('rep_out_of_stock')}</span>}
                      {!item.isActive && <span className="rep-pill is-off">{t('rep_retired')}</span>}
                    </td>
                    <td>{label(item.category)}</td>
                    {/* A price switched off for one system is struck through with
                        the word beside it: a dash alone would read as "no price
                        set", which is a different fact. */}
                    <PriceCell cents={item.priceCents} off={item.disabledBanquet} money={money} t={t} />
                    <PriceCell cents={item.priceCentsSmallBanquet} off={item.disabledSmallBanquet} money={money} t={t} />
                    <PriceCell cents={item.priceCentsCatering} off={item.disabledCatering} money={money} t={t} />
                    <td className="num">{item.bookedQuantity || '—'}</td>
                    <td className="num">{item.orderedQuantity || '—'}</td>
                    <td className="num">{item.demandRevenueCents > 0 ? money(item.demandRevenueCents) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </StickyHScroll>
        )}
        <p className="rep-note" style={{ margin: 0 }}>
          {`${t('rep_no_photo')}: ${data.totals.withoutPhoto} · ${t('rep_bestsellers')}: ${data.totals.bestsellers}`}
          {` · ${t('rep_off')} — ${t('rep_price_banquet')}: ${data.totals.offBanquet},`}
          {` ${t('rep_price_small')}: ${data.totals.offSmallBanquet},`}
          {` ${t('rep_price_catering')}: ${data.totals.offCatering}`}
        </p>
      </Panel>
    </>
  );
}

function PriceCell({ cents, off, money, t }: { cents: number; off: boolean; money: (v: number) => string; t: T }) {
  return (
    <td className="num">
      <span style={off ? { textDecoration: 'line-through', opacity: 0.55 } : undefined}>
        {cents > 0 ? money(cents) : '—'}
      </span>
      {off && <span className="rep-pill is-off">{t('rep_off')}</span>}
    </td>
  );
}

function sortItems(items: MenuRow[], sort: MenuSort): MenuRow[] {
  const out = [...items];
  switch (sort) {
    case 'revenue': return out.sort((a, b) => b.demandRevenueCents - a.demandRevenueCents || a.name.localeCompare(b.name));
    case 'price': return out.sort((a, b) => b.priceCents - a.priceCents || a.name.localeCompare(b.name));
    case 'name': return out.sort((a, b) => a.name.localeCompare(b.name));
    default: return out.sort((a, b) => b.demand - a.demand || a.name.localeCompare(b.name));
  }
}

// ── Staff ───────────────────────────────────────────────────────────────────

function StaffSection({
  data, t, locale, money, shortMoney, nameOf, many,
}: {
  data: StaffReport;
  t: T; locale: Locale; money: (v: number) => string; shortMoney: (v: number) => string;
  nameOf: (id: string | null) => string; many: boolean;
}) {
  const dateFormat = useMemo(
    () => new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: '2-digit' }),
    [locale],
  );

  return (
    <>
      <Notice tone="info" title={t('rep_staff')} body={t('rep_staff_note')} />

      <div className="rep-stats">
        <Stat label={t('rep_people')} value={String(data.staffCount)} />
        <Stat label={t('rep_waiters')} value={String(data.waiters.length)} />
        <Stat label={t('rep_orders_closed')} value={String(data.total.orders)} />
        <Stat label={t('rep_revenue')} value={money(data.total.revenueCents)} swatch={CH.revenue} />
      </div>

      <Panel title={t('rep_waiter_revenue')}>
        <RankedBars
          color={CH.revenue}
          emptyLabel={t('rep_no_waiters')}
          rows={data.waiters.filter((row) => row.revenueCents > 0).map((row) => ({
            key: row.id ?? 'former',
            name: row.former ? t('rep_former_staff') : `${row.username}${many ? ` · ${nameOf(row.restaurantId)}` : ''}`,
            value: row.revenueCents,
            display: shortMoney(row.revenueCents),
            sub: `${row.orders} ${t('rep_orders').toLowerCase()} · ${t('rep_avg_order')} ${shortMoney(row.averageOrderCents)}`,
          }))}
        />
      </Panel>

      {data.waiters.length > 0 && (
        <Panel title={t('rep_waiters')}>
          <StickyHScroll>
            <table className="rep-table">
              <thead>
                <tr>
                  <th>{t('rep_waiters')}</th>
                  <th className="num">{t('rep_orders_closed')}</th>
                  <th className="num">{t('rep_revenue')}</th>
                  <th className="num">{t('rep_avg_order')}</th>
                  <th className="num">{t('rep_tables_served')}</th>
                  <th className="num">{t('rep_last_order')}</th>
                </tr>
              </thead>
              <tbody>
                {data.waiters.map((row) => (
                  <tr key={row.id ?? 'former'} className={row.former ? 'rep-row-muted' : undefined}>
                    <td>
                      {row.former ? t('rep_former_staff') : row.username}
                      {many && !row.former && <span className="rep-pill">{nameOf(row.restaurantId)}</span>}
                    </td>
                    <td className="num">{row.orders}</td>
                    <td className="num">{money(row.revenueCents)}</td>
                    <td className="num">{money(row.averageOrderCents)}</td>
                    <td className="num">{row.tables || '—'}</td>
                    <td className="num">
                      {row.lastClosedAt ? dateFormat.format(new Date(row.lastClosedAt)) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </StickyHScroll>
        </Panel>
      )}

      <Panel title={t('rep_roster')}>
        <RankedBars
          color={CH.count}
          emptyLabel={t('rep_no_data')}
          rows={data.roster.map((row) => ({
            key: row.role,
            name: t(ROLE_KEY[row.role] ?? 'rep_people'),
            value: row.count,
            display: String(row.count),
          }))}
        />
      </Panel>
    </>
  );
}

// ── The business at a glance ────────────────────────────────────────────────

function BusinessSection({ data, t }: { data: ScopeReport; t: T }) {
  return (
    <Panel title={t('rep_scope')}>
      <div className="rep-stats">
        <Stat label={t('rep_table_packages')} value={String(data.counts.tableCategories)} />
        <Stat label={t('rep_extra_services')} value={String(data.counts.extraServices)} />
        <Stat label={t('rep_reviews')} value={String(data.counts.reviews)} />
        <Stat label={t('rep_invitations')} value={String(data.counts.invitations)} />
      </div>
      <ul className="rep-list">
        {data.restaurants.map((one) => (
          <li key={one.id}>
            <strong>{one.name}</strong>
            {one.company && <span className="rep-note"> · {one.company.name}</span>}
            {one.modules.banquet && <span className="rep-pill">{t('rep_section_banquet')}</span>}
            {one.modules.catering && <span className="rep-pill">{t('rep_price_catering')}</span>}
            {one.modules.addons && <span className="rep-pill">{t('addon_services')}</span>}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

// ── Shared pieces ───────────────────────────────────────────────────────────

/**
 * Loading, failure and success for a query, in one place.
 *
 * A failure gets a RETRY, not just a message: these are five separate requests
 * and one of them timing out must not mean reloading the page and losing the
 * window the reader had set up.
 */
function Async<TData>({
  query, t, children,
}: {
  query: { data?: TData; isLoading: boolean; isError: boolean; refetch: () => void };
  t: T;
  children: (data: TData) => React.ReactNode;
}) {
  if (query.isLoading) {
    return (
      <div style={{ display: 'grid', gap: 12 }}>
        <div className="skeleton-shimmer" style={{ height: 96, borderRadius: 12 }} />
        <div className="skeleton-shimmer" style={{ height: 210, borderRadius: 12 }} />
      </div>
    );
  }
  if (query.isError || !query.data) {
    return (
      <section className="adm-card" style={{ padding: 18, display: 'grid', gap: 10, justifyItems: 'start' }}>
        <p style={{ margin: 0, color: '#fca5a5' }}>{t('rep_failed')}</p>
        <button type="button" className="adm-btn-ghost adm-btn-sm" onClick={() => query.refetch()}>
          {t('rep_retry')}
        </button>
      </section>
    );
  }
  return <>{children(query.data)}</>;
}

function Panel({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="adm-card rep-panel">
      <div className="rep-panel-head">
        <h3 className="adm-heading" style={{ margin: 0 }}>{title}</h3>
        {note && <p className="rep-note" style={{ margin: 0 }}>{note}</p>}
      </div>
      {children}
    </section>
  );
}

/**
 * A stat tile. The swatch is what carries a series' identity beside the figure —
 * the figure itself stays in ink, because a light fill hue is illegible as type
 * on this ground.
 */
function Stat({ label, value, sub, swatch }: { label: string; value: string; sub?: string; swatch?: string }) {
  return (
    <div className="adm-card rep-stat">
      <span className="adm-label" style={{ margin: 0, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        {swatch && <span className="ch-key" style={{ background: swatch }} aria-hidden="true" />}
        {label}
      </span>
      <strong className="rep-stat-value">{value}</strong>
      {sub && <span className="rep-note">{sub}</span>}
    </div>
  );
}

function Notice({ tone, title, body }: { tone: 'warn' | 'info'; title: string; body: string }) {
  return (
    <aside className={`rep-notice is-${tone}`}>
      <strong>{title}</strong>
      <p>{body}</p>
    </aside>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={`rep-chip${active ? ' is-active' : ''}`}>
      {children}
    </button>
  );
}

const PAGE_CSS = `
/* ── The rule this page cannot do without ─────────────────────────────────
   A grid item's default \`min-width: auto\` means it will NOT shrink below its
   content's min-content width, and a single implicit column is sized by its
   widest item. So one wide table made EVERY panel on the page as wide as that
   table, the charts inside them drew to that width, and \`.adm-bg\`'s
   \`overflow-x: clip\` then hid the right-hand third of every chart with no
   scrollbar to reveal it — measured at 390px: a 629px chart in a 342px column.
   \`minmax(0, 1fr)\` plus \`min-width: 0\` on the items is what lets the column
   shrink, which is also what lets StickyHScroll do its job on the table. */
.rep-root { display: grid; gap: 18px; grid-template-columns: minmax(0, 1fr); }
.rep-root > * { min-width: 0; }
.rep-panel > *, .rep-two > *, .rep-stats > * { min-width: 0; }

.rep-bar {
  display: grid; gap: 10px;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  align-items: end;
}
.rep-field { display: grid; gap: 4px; min-width: 0; }
.rep-field .adm-input { width: 100%; }
.rep-chips { display: flex; flex-wrap: wrap; gap: 5px; align-items: center; }
.rep-chip {
  padding: 7px 13px; border-radius: 999px; font-size: 12.5px; font-weight: 700;
  cursor: pointer; border: 1px solid rgba(255,255,255,0.14);
  background: transparent; color: rgba(226,232,240,0.7);
  transition: background 0.16s, color 0.16s, border-color 0.16s;
}
.rep-chip.is-active {
  background: rgba(var(--adm-accent-rgb),0.16);
  border-color: rgba(var(--adm-accent-rgb),0.5);
  color: var(--adm-accent);
}
.rep-tabs {
  display: flex; gap: 4px; overflow-x: auto;
  border-bottom: 1px solid rgba(255,255,255,0.08);
}
.rep-tab {
  padding: 10px 15px; background: none; border: 0; cursor: pointer;
  border-bottom: 2px solid transparent; white-space: nowrap;
  color: rgba(226,232,240,0.6); font-size: 13.5px; font-weight: 700;
}
.rep-tab.is-active { color: var(--adm-accent); border-bottom-color: var(--adm-accent); }

.rep-hero { display: flex; align-items: center; gap: 16px; padding: 18px 20px; flex-wrap: wrap; }
.rep-hero > div { display: grid; gap: 3px; min-width: 0; }
/* The one hero figure on the page. Same sans as everything else — a display
   serif here would read as decoration on a number somebody acts on. */
.rep-hero-value { font-size: 34px; line-height: 1.1; font-weight: 800; letter-spacing: -0.02em; }
.rep-hero > svg { margin-left: auto; }

.rep-stats { display: grid; gap: 10px; grid-template-columns: repeat(auto-fit, minmax(min(148px, 100%), 1fr)); }
.rep-stat { padding: 12px 14px; display: grid; gap: 3px; }
.rep-stat-value { font-size: 19px; color: #f8fafc; font-weight: 700; }

.rep-panel { padding: 16px; display: grid; gap: 12px; grid-template-columns: minmax(0, 1fr); }
.rep-panel-head { display: grid; gap: 3px; }
.rep-note { font-size: 11.5px; color: rgba(226,232,240,0.52); line-height: 1.5; }
.rep-two { display: grid; gap: 14px; grid-template-columns: repeat(auto-fit, minmax(min(290px, 100%), 1fr)); }

.rep-notice {
  border-radius: 10px; padding: 12px 14px; display: grid; gap: 4px;
  border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.03);
}
.rep-notice strong { font-size: 13px; color: #f1f5f9; }
.rep-notice p { margin: 0; font-size: 12px; line-height: 1.55; color: rgba(226,232,240,0.62); }
.rep-notice.is-warn { border-color: rgba(201,133,0,0.45); background: rgba(201,133,0,0.09); }
.rep-notice.is-warn strong { color: #f0c26b; }

.rep-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.rep-table th, .rep-table td {
  padding: 8px 10px; text-align: left; white-space: nowrap;
  border-bottom: 1px solid rgba(255,255,255,0.055);
}
.rep-table th {
  font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.06em;
  color: rgba(226,232,240,0.5); font-weight: 700;
}
/* Columns of figures align on the digit, so they can be compared down the
   column. Standalone values elsewhere keep proportional figures. */
.rep-table td.num, .rep-table th.num { text-align: right; font-variant-numeric: tabular-nums; }
.rep-table tbody tr:hover { background: rgba(255,255,255,0.03); }
.rep-row-muted td { color: rgba(226,232,240,0.45); }

.rep-pill {
  display: inline-block; margin-left: 6px; padding: 1px 6px; border-radius: 999px;
  font-size: 10px; font-weight: 700; vertical-align: middle;
  background: rgba(var(--adm-accent-rgb),0.14); color: var(--adm-accent);
  border: 1px solid rgba(var(--adm-accent-rgb),0.3);
}
.rep-pill.is-off {
  background: rgba(255,255,255,0.06); color: rgba(226,232,240,0.6);
  border-color: rgba(255,255,255,0.12);
}

.rep-list { margin: 0; padding: 0; list-style: none; display: grid; gap: 7px; font-size: 13px; }

@media (max-width: 620px) {
  /* Two columns, so From/To and Category/Sort sit side by side — but the FIRST
     control spans both: a restaurant name or a search box in a 152px field is
     unusable, and a date input narrower than about 150px drops its own
     placeholder. */
  .rep-bar { grid-template-columns: 1fr 1fr; }
  .rep-bar > :first-child, .rep-bar .rep-chips { grid-column: 1 / -1; }
  /* Two by two, not a scrolling row. Four tabs do not fit across 314px and the
     row silently hid the last two behind a horizontal scroll with no affordance
     saying it was there — a section of the report nobody would find. */
  .rep-tabs {
    display: grid; grid-template-columns: 1fr 1fr; gap: 0;
    overflow-x: visible; border-bottom: 0;
  }
  .rep-tab {
    padding: 9px 8px; font-size: 12.5px; white-space: normal;
    border: 1px solid rgba(255,255,255,0.09); border-radius: 9px;
  }
  .rep-tab.is-active {
    border-color: rgba(var(--adm-accent-rgb),0.45);
    background: rgba(var(--adm-accent-rgb),0.12);
  }
  .rep-hero-value { font-size: 27px; }
  .rep-hero > svg { margin-left: 0; }
  .rep-stats { grid-template-columns: 1fr 1fr; }
  .rep-stat-value { font-size: 17px; }
  .rep-panel { padding: 13px; }
  .rep-table th, .rep-table td { padding: 7px 8px; }
}
`;
