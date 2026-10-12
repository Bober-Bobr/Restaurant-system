import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { expenseService } from '../services/expense.service';
import type { DayEvent, DayEventType, ExpenseDay, ProductExpense } from '../types/domain';
import { useAdminStore } from '../store/admin.store';
import { translate } from '../utils/translate';
import { groupDigits, parseUsdToCents, parseWholeSum, usdInputValue } from '../utils/currency';
import {
  MAX_USD_CENTS, ZERO_MONEY, addMoney, anyUsd, formatMoney, hasUsd, money, scaleMoney, subtractMoney, sumMoney,
  type Money,
} from '../utils/ledgerMoney';

export const QUERY_KEY = ['expense-days'];
const UNITS = ['kg', 'g', 'l', 'ml', 'pcs'];
const MAX_SUM = 1_000_000_000;

export const EVENT_ORDER: DayEventType[] = ['NAHOR', 'FOTIHA', 'TUI', 'OTHERS'];
const EVENT_LABEL_KEY: Record<DayEventType, Parameters<typeof translate>[0]> = {
  NAHOR: 'dept_nahor', FOTIHA: 'dept_fotiha', TUI: 'dept_tui', OTHERS: 'dept_others',
};

type Locale = 'en' | 'ru' | 'uz';
type TFn = (key: Parameters<typeof translate>[0], params?: Record<string, string | number>) => string;

const clampSum = (n: number) => Math.max(0, Math.min(MAX_SUM, n));
const clampUsd = (n: number) => Math.max(0, Math.min(MAX_USD_CENTS, Math.round(n)));

const saveBlob = (blob: Blob, filename: string) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

// ── Revenue ──
// Every figure on this page is a PAIR — so'm and dollars — because a line can
// carry an amount in each and the two are never added together (there is no
// exchange rate in this product; see utils/ledgerMoney.ts). The helper names
// are the same as before and so is the arithmetic; what changed is that they
// return `Money` instead of a number, which is what makes mixing the two
// currencies impossible to write rather than merely discouraged.
//
// What a department takes in. Guest revenue is guests × price per guest unless
// a figure was typed in by hand, which wins outright — the ledger can then
// record what was actually charged when the multiplication does not describe it.
const perGuest = (e: DayEvent): Money => money(e.pricePerGuestSum, e.pricePerGuestUsdCents);
const computedGuests = (e: DayEvent): Money => scaleMoney(perGuest(e), e.guestCount);
// Each currency honours its OWN override and otherwise falls back to its own
// multiplication. One `!= null` test for both would have a so'm override
// silently zero the dollars that were recorded beside it.
const guestsRevenue = (e: DayEvent): Money => ({
  sum: e.manualGuestsSum != null ? e.manualGuestsSum : computedGuests(e).sum,
  usdCents: e.manualGuestsUsdCents != null ? e.manualGuestsUsdCents : computedGuests(e).usdCents,
});
// Additional services are SOLD, so they are revenue too and add to the
// department total. They sit outside the manual override on purpose: typing a
// guest figure by hand must not silently drop the services sold alongside it.
const servicesRevenue = (e: DayEvent): Money => sumMoney(e.services);
export const eventRevenue = (e: DayEvent): Money => addMoney(guestsRevenue(e), servicesRevenue(e));

// ── Spending ──
// Products, salaries and additional expenses. Services are revenue, not spend.
const eventSpent = (e: DayEvent): Money =>
  addMoney(addMoney(sumMoney(e.products), sumMoney(e.salaries)), sumMoney(e.additionals));

// Day-wide roll-ups. The PDF service mirrors these exactly.
export const daySpent = (day: ExpenseDay): Money =>
  day.events.reduce<Money>((acc, e) => addMoney(acc, eventSpent(e)), ZERO_MONEY);
export const dayRevenue = (day: ExpenseDay): Money =>
  day.events.reduce<Money>((acc, e) => addMoney(acc, eventRevenue(e)), ZERO_MONEY);

/** Anything at all recorded, in either currency. */
const isSomething = (m: Money) => m.sum > 0 || m.usdCents !== 0;

/**
 * Whether the dollar column is shown.
 *
 * Most ledgers are kept entirely in so'm, and a permanently empty second field
 * on every row of four sections is clutter on an already dense page — so it is
 * a column you switch on, remembered per browser like the other per-viewer
 * conveniences here.
 *
 * **Data beats the preference.** If any line already carries a dollar figure
 * the column is shown whether or not the switch is on: a stored amount that
 * cannot be seen is money the ledger is hiding, which is worse than clutter.
 * That also makes the switch safe to default off — nothing already recorded
 * can disappear behind it.
 */
const USD_PREF_KEY = 'vmenu-ledger-usd';

export const readUsdPref = (): boolean => {
  try {
    return window.localStorage.getItem(USD_PREF_KEY) === '1';
  } catch {
    // Private windows and blocked site data throw on access, and the ledger
    // must still open.
    return false;
  }
};

export const writeUsdPref = (on: boolean) => {
  try {
    window.localStorage.setItem(USD_PREF_KEY, on ? '1' : '0');
  } catch { /* nothing to do — the column still works for this visit */ }
};

const sortedEvents = (day: ExpenseDay) =>
  [...day.events].sort((a, b) => EVENT_ORDER.indexOf(a.type) - EVENT_ORDER.indexOf(b.type));

export const ExpenseLedgerPage = () => {
  const { locale } = useAdminStore();
  const t: TFn = (key, params) => translate(key, locale, params);
  const queryClient = useQueryClient();
  const [idx, setIdx] = useState(0);
  const [searchParams, setSearchParams] = useSearchParams();

  const { data: days = [], isLoading, isError } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => expenseService.listDays(),
  });

  useEffect(() => {
    if (idx > days.length - 1) setIdx(Math.max(0, days.length - 1));
  }, [days.length, idx]);

  // Deep link from the Accounts page: ?day=<id> jumps to that day, then clears.
  useEffect(() => {
    const dayId = searchParams.get('day');
    if (!dayId || days.length === 0) return;
    const pos = days.findIndex((d) => d.id === dayId);
    if (pos >= 0) setIdx(pos);
    searchParams.delete('day');
    setSearchParams(searchParams, { replace: true });
  }, [searchParams, days, setSearchParams]);

  const [newDate, setNewDate] = useState('');

  const addDay = useMutation({
    mutationFn: (date?: string) => expenseService.createDay(date),
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      setNewDate('');
      // Days are sorted by date desc; jump to the one we just created.
      const fresh = queryClient.getQueryData<ExpenseDay[]>(QUERY_KEY);
      const pos = fresh?.findIndex((d) => d.id === created?.id) ?? 0;
      setIdx(pos >= 0 ? pos : 0);
    },
  });

  const current = days[idx];

  const dateLabel = current
    ? new Date(`${current.date}T00:00:00`).toLocaleDateString(
        locale === 'uz' ? 'uz-UZ' : locale === 'ru' ? 'ru-RU' : 'en-US',
        { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
      )
    : '';

  const arrowBtn = (enabled: boolean): React.CSSProperties => ({
    width: 42, height: 42, borderRadius: 12, flexShrink: 0,
    border: '1px solid rgba(var(--adm-accent-rgb),0.35)',
    background: enabled ? 'rgba(var(--adm-accent-rgb),0.12)' : 'rgba(255,255,255,0.03)',
    color: enabled ? 'var(--adm-accent)' : 'rgba(226,232,240,0.25)',
    cursor: enabled ? 'pointer' : 'default', fontSize: 20, lineHeight: 1,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  });

  return (
    <main className="tablet-fade-in" style={{ maxWidth: 1000, margin: '0 auto', padding: '28px 20px', position: 'relative', zIndex: 1 }}>
      <h1 className="adm-title" style={{ marginBottom: 6 }}>{t('expense_ledger')}</h1>
      <p style={{ color: 'rgba(226,232,240,0.55)', fontSize: 13, marginTop: 0, marginBottom: 20 }}>
        {t('expense_ledger_help')}
      </p>

      <section className="adm-card tablet-fade-up" style={{ padding: 14, marginBottom: 20, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="button" className="adm-btn-primary" onClick={() => addDay.mutate(undefined)} disabled={addDay.isPending}>
          {addDay.isPending ? t('creating') : `+ ${t('add_day')}`}
        </button>
        <span style={{ color: 'rgba(226,232,240,0.35)', fontSize: 12 }}>{t('or')}</span>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ ...fieldLabelStyle, display: 'block' }}>{t('add_day_for_date')}</span>
          <input type="date" className="adm-input" value={newDate} onChange={(e) => setNewDate(e.target.value)} style={{ ...fieldSurface, width: 170 }} />
        </label>
        <button type="button" className="adm-btn-ghost" onClick={() => { if (newDate) addDay.mutate(newDate); }}
          disabled={!newDate || addDay.isPending} style={{ fontSize: 13 }}>
          {t('create_in_advance')}
        </button>
      </section>

      {isLoading && <p style={{ color: 'rgba(226,232,240,0.55)' }}>{t('loading')}</p>}
      {isError && <p style={{ color: '#fca5a5' }}>{t('something_went_wrong')}</p>}
      {!isLoading && days.length === 0 && <p style={{ color: 'rgba(226,232,240,0.55)' }}>{t('no_days_yet')}</p>}

      {current && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <button type="button" aria-label={t('older_day')} style={arrowBtn(idx < days.length - 1)}
              onClick={() => { if (idx < days.length - 1) setIdx(idx + 1); }}>‹</button>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#f8fafc', textTransform: 'capitalize' }}>
                {dateLabel}
                {current.isClosed && (
                  <span style={{ marginLeft: 10, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: 'rgba(148,163,184,0.18)', color: '#94a3b8', verticalAlign: 'middle' }}>
                    {t('closed_label')}
                  </span>
                )}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: 'rgba(226,232,240,0.4)' }}>{idx + 1} / {days.length}</p>
            </div>
            <button type="button" aria-label={t('newer_day')} style={arrowBtn(idx > 0)}
              onClick={() => { if (idx > 0) setIdx(idx - 1); }}>›</button>
          </div>

          <DayCard key={current.id} day={current} t={t} />
        </>
      )}
    </main>
  );
};

const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: 'rgba(226,232,240,0.6)', textTransform: 'uppercase', letterSpacing: '0.05em' };

// ── Field and heading styling ────────────────────────────────────────────────
// Deliberately the same visual language as the banquet event form
// (AdminEventsPage): gold field labels, gold uppercase section headings closed
// by a fading rule, and inputs given a gold-tinted border so every field reads
// as a field on this dark background rather than melting into the card.
const GOLD = 'var(--adm-accent)';

const fieldLabelStyle: React.CSSProperties = {
  display: 'grid', gap: 6,
  fontSize: 12.5, fontWeight: 600, letterSpacing: '0.02em',
  color: GOLD,
};

// The highlight itself, separated from the row height so multi-line textareas
// can take the surface without being forced to 38px.
const fieldSurface: React.CSSProperties = {
  background: 'rgba(var(--adm-bg-rgb),0.78)',
  borderColor: 'rgba(var(--adm-accent-rgb),0.3)',
};

const rowInput: React.CSSProperties = { ...fieldSurface, height: 38 };

// Section heading: gold, uppercase, with the same fading rule as the banquet
// form's GroupHeading, plus the section's own total on the right.
// Column headers for the repeated line rows. The rows use placeholders, which
// disappear as soon as a value is typed — these keep the columns named.
const colHeader: React.CSSProperties = {
  fontSize: 10.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
  color: 'rgba(var(--adm-accent-rgb),0.75)',
};

// Column widths mirror the row inputs below them exactly, so the labels sit
// over the fields they name. The trailing spacer stands in for the row's
// delete / add button.
const LineHeader = ({ t, nameLabel, showUsd }: { t: TFn; nameLabel: string; showUsd: boolean }) => (
  <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '2px 2px 0' }}>
    <span style={{ ...colHeader, flex: 2, minWidth: 160 }}>{nameLabel}</span>
    <span style={{ ...colHeader, width: 150, textAlign: 'right' }}>{t('amount')}</span>
    {showUsd && <span style={{ ...colHeader, width: USD_W, textAlign: 'right' }}>{t('amount_usd')}</span>}
    <span style={{ width: 34, flexShrink: 0 }} />
  </div>
);

/**
 * The dollar field's width, and the field itself.
 *
 * Narrower than the so'm field because the figures are: $18 500.00 is about as
 * long as a dollar amount in a restaurant's day gets, where its so'm twin runs
 * to nine digits.
 */
const USD_W = 118;

const UsdField = ({ value, onCommit, t, label }: {
  value: number; onCommit: (usdCents: number) => void; t: TFn; label?: string;
}) => {
  const [text, setText] = useState(value ? usdInputValue(value) : '');
  useEffect(() => { setText(value ? usdInputValue(value) : ''); }, [value]);
  const commit = () => {
    // An emptied field means nothing in dollars — zero, not "leave it be" —
    // because that is the only way to take a dollar amount back off a line.
    const next = text.trim() === '' ? 0 : parseUsdToCents(text);
    if (next === null) { setText(value ? usdInputValue(value) : ''); return; }
    if (clampUsd(next) !== value) onCommit(clampUsd(next));
  };
  const field = (
    <input className="adm-input" inputMode="decimal" value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }}
      placeholder={t('amount_usd_placeholder')}
      aria-label={t('amount_usd')}
      style={{ ...rowInput, width: USD_W, textAlign: 'right' }} />
  );
  return label ? <label style={{ ...fieldLabelStyle, width: USD_W }}>{label}{field}</label> : field;
};

const ProductHeader = ({ t, showUsd }: { t: TFn; showUsd: boolean }) => (
  <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '2px 2px 0', flexWrap: 'wrap' }}>
    <span style={{ ...colHeader, flex: 2, minWidth: 140 }}>{t('product_name')}</span>
    <span style={{ ...colHeader, width: 80 }}>{t('quantity')}</span>
    <span style={{ ...colHeader, width: 78 }}>{t('unit_label')}</span>
    <span style={{ ...colHeader, width: 150, textAlign: 'right' }}>{t('amount')}</span>
    {showUsd && <span style={{ ...colHeader, width: USD_W, textAlign: 'right' }}>{t('amount_usd')}</span>}
    <span style={{ width: 34, flexShrink: 0 }} />
  </div>
);

const BlockHeading = ({ title, total, tone }: {
  title: string; total: string; tone: 'revenue' | 'expense';
}) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
    <span style={{
      fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase',
      color: GOLD, whiteSpace: 'nowrap',
    }}>
      {title}
    </span>
    <span aria-hidden className="adm-rule-in" style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, rgba(var(--adm-accent-rgb),0.45), transparent)' }} />
    {total && (
      // Revenue and spending are told apart by colour: the two are easy to
      // confuse on this page, and the section totals are where it shows.
      <span style={{
        flexShrink: 0, fontSize: 12.5, fontWeight: 800, padding: '3px 10px', borderRadius: 999,
        color: tone === 'revenue' ? '#4ade80' : '#fbbf24',
        background: tone === 'revenue' ? 'rgba(74,222,128,0.1)' : 'rgba(251,191,36,0.1)',
        border: `1px solid ${tone === 'revenue' ? 'rgba(74,222,128,0.32)' : 'rgba(251,191,36,0.32)'}`,
      }}>
        {total}
      </span>
    )}
  </div>
);

const DayCard = ({ day, t }: { day: ExpenseDay; t: TFn }) => {
  const queryClient = useQueryClient();
  const { locale } = useAdminStore();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: QUERY_KEY });

  // Per-event PDF export: pick the departments to include, download just those.
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);
  const toggleEvent = (id: string) =>
    setSelectedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const downloadEvents = async () => {
    if (selectedEvents.size === 0) return;
    setExporting(true);
    try {
      const blob = await expenseService.downloadEventsPdf(day.id, [...selectedEvents], locale);
      saveBlob(blob, `${day.date}.pdf`);
    } catch {
      window.alert(t('download_failed'));
    } finally {
      setExporting(false);
    }
  };

  const updateDay = useMutation({
    mutationFn: (patch: { report?: string | null }) => expenseService.updateDay(day.id, patch),
    onSuccess: invalidate,
  });
  const removeDay = useMutation({ mutationFn: () => expenseService.removeDay(day.id), onSuccess: invalidate });

  const [report, setReport] = useState(day.report ?? '');
  useEffect(() => { setReport(day.report ?? ''); }, [day.report]);

  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const events = sortedEvents(day);
  const activeEvent = events.find((e) => e.id === activeEventId) ?? null;

  // While a department is open its figures are shown on their own; the day-wide
  // totals are only shown on the department overview.
  const budget = activeEvent ? eventRevenue(activeEvent) : dayRevenue(day);
  const spent = activeEvent ? eventSpent(activeEvent) : daySpent(day);
  const remaining = subtractMoney(budget, spent);

  // The dollar column: the manager's own switch, forced on by any dollar
  // figure already recorded anywhere in this day.
  const dayHasUsd = anyUsd([dayRevenue(day), daySpent(day), sumMoney(day.extras)]);
  const [usdPref, setUsdPref] = useState(readUsdPref);
  const showUsd = usdPref || dayHasUsd;
  const toggleUsd = (on: boolean) => { setUsdPref(on); writeUsdPref(on); };

  return (
    <section className="adm-card tablet-fade-up" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '16px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexWrap: 'wrap' }}>
        {/* The open department's total revenue: guest revenue (hand-entered or
            guests × price) PLUS the additional services sold. The two parts stay
            visible as the Booking and Additional services section totals below,
            so the breakdown is never hidden behind this one number. */}
        {activeEvent && isSomething(eventRevenue(activeEvent))
          ? <Total label={t('total_revenue')} value={formatMoney(eventRevenue(activeEvent))} color="#4ade80" />
          : <span />}
        {/* The day-delete button is only available on the department overview. */}
        {!activeEvent
          ? (
            <button type="button" className="adm-btn-danger" onClick={() => { if (window.confirm(t('delete_day_confirm'))) removeDay.mutate(); }}
              disabled={removeDay.isPending} style={{ fontSize: 12 }}>
              {t('delete')}
            </button>
          )
          : <span />}
      </div>

      <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 20 }}>
        {!activeEvent ? (
          /* Department selection */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Per-event PDF export toolbar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <button type="button" className="adm-btn-primary" onClick={downloadEvents}
                disabled={selectedEvents.size === 0 || exporting}
                style={{ opacity: selectedEvents.size === 0 ? 0.5 : 1, fontSize: 13 }}>
                {exporting ? t('loading') : `📄 ${t('download_selected')}${selectedEvents.size ? ` (${selectedEvents.size})` : ''}`}
              </button>
              {selectedEvents.size > 0 && (
                <button type="button" className="adm-btn-ghost" onClick={() => setSelectedEvents(new Set())} style={{ fontSize: 13 }}>
                  {t('clear_selection')}
                </button>
              )}
              {/* Shown here rather than per section: it is one column across
                  the whole day, and a switch per block would be four switches
                  that can disagree. Disabled while the day already holds a
                  dollar figure, because turning it off would hide it. */}
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto', cursor: dayHasUsd ? 'default' : 'pointer', fontSize: 13, color: 'rgba(226,232,240,0.75)' }}
                title={dayHasUsd ? t('usd_column_locked') : undefined}>
                <input type="checkbox" checked={showUsd} disabled={dayHasUsd}
                  onChange={(e) => toggleUsd(e.target.checked)}
                  style={{ width: 18, height: 18, accentColor: 'var(--adm-accent)', cursor: dayHasUsd ? 'default' : 'pointer' }} />
                {t('usd_column')}
              </label>
            </div>

            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))' }}>
              {events.map((ev) => {
                const evSpent = eventSpent(ev);
                const evBudget = eventRevenue(ev);
                const checked = selectedEvents.has(ev.id);
                return (
                  <div key={ev.id} className="tablet-fade-up"
                    style={{
                      position: 'relative', borderRadius: 16,
                      background: 'linear-gradient(160deg, rgba(var(--adm-accent-rgb),0.12), rgba(255,255,255,0.03))',
                      border: checked ? '1px solid rgba(var(--adm-accent-rgb),0.7)' : '1px solid rgba(var(--adm-accent-rgb),0.3)',
                      transition: 'all 0.18s',
                    }}>
                    <label onClick={(e) => e.stopPropagation()}
                      style={{ position: 'absolute', top: 12, right: 12, display: 'flex', cursor: 'pointer', zIndex: 1 }}>
                      <input type="checkbox" checked={checked} onChange={() => toggleEvent(ev.id)}
                        style={{ width: 18, height: 18, accentColor: 'var(--adm-accent)', cursor: 'pointer' }} />
                    </label>
                    <button type="button" onClick={() => setActiveEventId(ev.id)}
                      style={{ width: '100%', textAlign: 'left', cursor: 'pointer', background: 'none', border: 'none', padding: '18px 18px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingRight: 26 }}>
                        <span style={{ fontSize: 16, fontWeight: 800, color: '#f8fafc' }}>{t(EVENT_LABEL_KEY[ev.type])}</span>
                        <span style={{ color: 'var(--adm-accent)', fontSize: 18, marginLeft: 'auto' }}>›</span>
                      </div>
                      <p style={{ ...labelStyle, margin: '10px 0 2px' }}>{t('budget')}</p>
                      <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: isSomething(evBudget) ? '#e2e8f0' : 'rgba(226,232,240,0.45)' }}>
                        {formatMoney(evBudget)}
                      </p>
                      <p style={{ ...labelStyle, margin: '8px 0 2px' }}>{t('amount_spent')}</p>
                      <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: isSomething(evSpent) ? '#fbbf24' : 'rgba(226,232,240,0.45)' }}>
                        {formatMoney(evSpent)}
                      </p>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Selected department's expense panel */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <button type="button" onClick={() => setActiveEventId(null)}
              style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--adm-accent)', fontSize: 15, fontWeight: 700, padding: 0 }}>
              ‹ {t(EVENT_LABEL_KEY[activeEvent.type])}
            </button>
            <EventPanel event={activeEvent} t={t} onChanged={invalidate} showUsd={showUsd} />
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 28, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.07)', flexWrap: 'wrap' }}>
          {/* Only on the day overview: with a department open the same figure is
              already in the header above. */}
          {!activeEvent && <Total label={t('total_revenue')} value={formatMoney(budget)} color="#4ade80" />}
          <Total label={t('amount_spent')} value={formatMoney(spent)} color="#fbbf24" />
          {/* A balance can be in profit in one currency and at a loss in the
              other, so the colour follows whichever side is negative — and the
              two figures are shown, never one summed number. */}
          <Total label={t('remaining')} value={formatMoney(remaining)}
            color={remaining.sum < 0 || remaining.usdCents < 0 ? '#f87171' : '#4ade80'} />
        </div>

        {/* End-of-day report */}
        <div style={{ display: 'grid', gap: 8, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <span style={{ ...fieldLabelStyle, display: 'block' }}>{t('day_report')}</span>
          <textarea
            className="adm-input"
            rows={3}
            value={report}
            onChange={(e) => setReport(e.target.value)}
            onBlur={() => { if ((day.report ?? '') !== report) updateDay.mutate({ report: report || null }); }}
            placeholder={t('day_report_placeholder')}
            style={{ ...fieldSurface, resize: 'vertical', minHeight: 70, lineHeight: 1.5 }}
          />
        </div>
      </div>
    </section>
  );
};

const Block = ({ title, total, tone = 'expense', children }: {
  title: string; total: string; tone?: 'revenue' | 'expense'; children: React.ReactNode;
}) => (
  <div>
    <BlockHeading title={title} total={total} tone={tone} />
    {children}
  </div>
);

const Total = ({ label, value, color }: { label: string; value: string; color: string }) => (
  <div style={{ textAlign: 'right' }}>
    <p style={{ ...labelStyle, margin: '0 0 2px' }}>{label}</p>
    <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color }}>{value}</p>
  </div>
);

// One department's booking, four expense blocks (products / salaries /
// additionals / services), the manual total override and notes.
const EventPanel = ({ event, t, onChanged, showUsd }: {
  event: DayEvent; t: TFn; onChanged: () => void; showUsd: boolean;
}) => {
  const productsTotal = sumMoney(event.products);
  const salariesTotal = sumMoney(event.salaries);
  const additionalsTotal = sumMoney(event.additionals);
  const servicesTotal = sumMoney(event.services);

  const updateEvent = useMutation({
    mutationFn: (patch: Partial<{
      bookingName: string | null; guestCount: number; pricePerGuestSum: number;
      pricePerGuestUsdCents: number; report: string | null;
      manualGuestsSum: number | null; manualGuestsUsdCents: number | null;
    }>) => expenseService.updateEvent(event.id, patch),
    onSuccess: onChanged,
  });

  const [bookingName, setBookingName] = useState(event.bookingName ?? '');
  const [guests, setGuests] = useState(event.guestCount ? String(event.guestCount) : '');
  const [price, setPrice] = useState(event.pricePerGuestSum ? groupDigits(String(event.pricePerGuestSum)) : '');
  const [note, setNote] = useState(event.report ?? '');
  useEffect(() => { setBookingName(event.bookingName ?? ''); }, [event.bookingName]);
  useEffect(() => { setGuests(event.guestCount ? String(event.guestCount) : ''); }, [event.guestCount]);
  useEffect(() => { setPrice(event.pricePerGuestSum ? groupDigits(String(event.pricePerGuestSum)) : ''); }, [event.pricePerGuestSum]);
  useEffect(() => { setNote(event.report ?? ''); }, [event.report]);

  return (
    <>
      {/* Booking: guests × price per guest is this department's guest revenue.
          Every field carries its own gold label rather than relying on a
          placeholder that disappears the moment something is typed. */}
      <Block title={t('booking')} total={formatMoney(guestsRevenue(event))} tone="revenue">
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <label style={{ ...fieldLabelStyle, flex: 2, minWidth: 180 }}>
            {t('booking_name')}
            <input className="adm-input" value={bookingName} onChange={(e) => setBookingName(e.target.value)}
              onBlur={() => { const v = bookingName.trim(); if (v !== (event.bookingName ?? '')) updateEvent.mutate({ bookingName: v || null }); }}
              style={rowInput} />
          </label>
          <label style={{ ...fieldLabelStyle, width: 110 }}>
            {t('guest_count')}
            <input className="adm-input" inputMode="numeric" value={guests} onChange={(e) => setGuests(e.target.value.replace(/[^\d]/g, ''))}
              onBlur={() => { const n = Number(guests) || 0; if (n !== event.guestCount) updateEvent.mutate({ guestCount: n }); }}
              style={{ ...rowInput, textAlign: 'right' }} />
          </label>
          <span style={{ color: 'rgba(226,232,240,0.4)', paddingBottom: 10 }}>×</span>
          <label style={{ ...fieldLabelStyle, width: 160 }}>
            {t('price_per_guest')}
            <input className="adm-input" inputMode="numeric" value={price} onChange={(e) => setPrice(groupDigits(e.target.value))}
              onBlur={() => { const c = parseWholeSum(price); if (c !== null && clampSum(c) !== event.pricePerGuestSum) updateEvent.mutate({ pricePerGuestSum: clampSum(c) }); }}
              style={{ ...rowInput, textAlign: 'right' }} />
          </label>
          {/* The per-guest price in dollars. Multiplied by the same guest count
              as the so'm price — one booking, two prices, two revenue figures. */}
          {showUsd && (
            <UsdField t={t} label={t('price_per_guest_usd')} value={event.pricePerGuestUsdCents ?? 0}
              onCommit={(usd) => updateEvent.mutate({ pricePerGuestUsdCents: usd })} />
          )}
        </div>
        <ManualGuestsField event={event} t={t} showUsd={showUsd}
          onSave={(v) => updateEvent.mutate({ manualGuestsSum: v })}
          onSaveUsd={(v) => updateEvent.mutate({ manualGuestsUsdCents: v })} />
      </Block>

      {/* The "Additional Services" product (performers, hosts, invitations…).
          These are SOLD, so they are revenue: this total is added to the guest
          revenue above to make the department total, never counted against it.
          Placed directly after the booking so it is filled in first, before any
          of the spending sections. */}
      <Block title={t('services_revenue')} total={formatMoney(servicesTotal)} tone="revenue">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <LineHeader t={t} nameLabel={t('service_name')} showUsd={showUsd} />
          {event.services.map((s) => (
            <LineRow key={s.id} line={s} placeholder={t('service_name')} t={t} showUsd={showUsd}
              onUpdate={(patch) => expenseService.updateService(s.id, patch)}
              onRemove={() => expenseService.removeService(s.id)} onChanged={onChanged} />
          ))}
          <AddLineRow placeholder={t('service_name')} t={t} showUsd={showUsd}
            onAdd={(payload) => expenseService.addService(event.id, payload)} onAdded={onChanged} />
        </div>
      </Block>

      <Block title={t('product_expenses')} total={formatMoney(productsTotal)}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <ProductHeader t={t} showUsd={showUsd} />
          {event.products.map((p) => <ProductRow key={p.id} product={p} t={t} onChanged={onChanged} showUsd={showUsd} />)}
          <AddProductRow eventId={event.id} t={t} onAdded={onChanged} showUsd={showUsd} />
        </div>
      </Block>

      <Block title={t('employee_salaries')} total={formatMoney(salariesTotal)}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <LineHeader t={t} nameLabel={t('employee_name')} showUsd={showUsd} />
          {event.salaries.map((s) => (
            <LineRow key={s.id} line={s} placeholder={t('employee_name')} t={t} showUsd={showUsd}
              onUpdate={(patch) => expenseService.updateSalary(s.id, patch)}
              onRemove={() => expenseService.removeSalary(s.id)} onChanged={onChanged} />
          ))}
          <AddLineRow placeholder={t('employee_name')} t={t} showUsd={showUsd}
            onAdd={(payload) => expenseService.addSalary(event.id, payload)} onAdded={onChanged} />
        </div>
      </Block>

      <Block title={t('additional_expenses')} total={formatMoney(additionalsTotal)}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <LineHeader t={t} nameLabel={t('note')} showUsd={showUsd} />
          {event.additionals.map((a) => (
            <LineRow key={a.id} line={a} placeholder={t('note')} t={t} showUsd={showUsd}
              onUpdate={(patch) => expenseService.updateAdditional(a.id, patch)}
              onRemove={() => expenseService.removeAdditional(a.id)} onChanged={onChanged} />
          ))}
          <AddLineRow placeholder={t('note')} t={t} showUsd={showUsd}
            onAdd={(payload) => expenseService.addAdditional(event.id, payload)} onAdded={onChanged} />
        </div>
      </Block>

      {/* Per-event notes (separate from the day report). */}
      <div style={{ display: 'grid', gap: 8, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        <span style={{ ...fieldLabelStyle, display: 'block' }}>{t('event_notes')}</span>
        <textarea className="adm-input" rows={2} value={note} onChange={(e) => setNote(e.target.value)}
          onBlur={() => { if ((event.report ?? '') !== note) updateEvent.mutate({ report: note || null }); }}
          placeholder={t('event_notes_placeholder')} style={{ ...fieldSurface, resize: 'vertical', minHeight: 56, lineHeight: 1.5 }} />
      </div>
    </>
  );
};

// Manual override of the department's revenue for all guests, mirroring the
// manual total on the tablet Summary page: a checkbox that reveals an amount
// field. It replaces guests × price per guest only — additional services are
// added on top either way, so ticking this never hides them.
const ManualGuestsField = ({ event, t, onSave, onSaveUsd, showUsd }: {
  event: DayEvent; t: TFn;
  onSave: (value: number | null) => void;
  onSaveUsd: (value: number | null) => void;
  showUsd: boolean;
}) => {
  const computed = computedGuests(event);
  // ONE switch for both currencies — "I am typing this department's guest
  // revenue myself" is one decision — but a figure each, because each currency
  // falls back to its own multiplication when its own override is null.
  const enabled = event.manualGuestsSum != null || event.manualGuestsUsdCents != null;
  const [text, setText] = useState(event.manualGuestsSum != null ? groupDigits(String(event.manualGuestsSum)) : '');
  useEffect(() => {
    setText(event.manualGuestsSum != null ? groupDigits(String(event.manualGuestsSum)) : '');
  }, [event.manualGuestsSum]);

  // Ticking the box seeds the override with the current computed figure, so the
  // field opens on the number being replaced rather than on a blank the ledger
  // would read as zero. BOTH currencies are seeded, or ticking it would set the
  // so'm figure by hand and leave the dollars still following the price — the
  // one number nobody typed would be the one that moved.
  const toggle = (checked: boolean) => {
    onSave(checked ? computed.sum : null);
    // Only when there is a dollar side to seed or to clear: writing an explicit
    // 0 on a so'm-only ledger would make `manualGuestsUsdCents` non-null and
    // force the dollar column on for every day anybody ever overrode.
    if (checked ? computed.usdCents > 0 : event.manualGuestsUsdCents != null) {
      onSaveUsd(checked ? computed.usdCents : null);
    }
  };

  return (
    <div style={{ display: 'grid', gap: 8, paddingTop: 12, marginTop: 4, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
        <input type="checkbox" checked={enabled} onChange={(e) => toggle(e.target.checked)}
          style={{ width: 18, height: 18, accentColor: 'var(--adm-accent)', cursor: 'pointer' }} />
        <span style={{ fontSize: 13, color: 'rgba(226,232,240,0.8)' }}>{t('edit_amount_manually')}</span>
      </label>
      {enabled && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <input className="adm-input" inputMode="numeric" value={text}
            onChange={(e) => setText(groupDigits(e.target.value))}
            onBlur={() => {
              const c = parseWholeSum(text);
              if (c === null) { setText(groupDigits(String(event.manualGuestsSum ?? 0))); return; }
              if (clampSum(c) !== event.manualGuestsSum) onSave(clampSum(c));
            }}
            placeholder={t('amount')} style={{ ...rowInput, width: 180, textAlign: 'right' }} />
          {showUsd && (
            <UsdField t={t} value={event.manualGuestsUsdCents ?? 0} onCommit={(usd) => onSaveUsd(usd)} />
          )}
          {/* The multiplication stays visible so it is obvious what was replaced. */}
          <span style={{ fontSize: 12, color: 'rgba(226,232,240,0.45)' }}>
            {t('guests_computed')}: {formatMoney(computed)}
          </span>
        </div>
      )}
    </div>
  );
};

const removeBtn: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', color: '#f87171', fontSize: 18, lineHeight: 1, padding: 4 };

const ProductRow = ({ product, t, onChanged, showUsd }: { product: ProductExpense; t: TFn; onChanged: () => void; showUsd: boolean }) => {
  const [name, setName] = useState(product.name);
  const [qty, setQty] = useState(String(product.quantity));
  const [unit, setUnit] = useState(product.unit);
  const [amount, setAmount] = useState(groupDigits(String(product.amountSum)));
  useEffect(() => {
    setName(product.name); setQty(String(product.quantity)); setUnit(product.unit); setAmount(groupDigits(String(product.amountSum)));
  }, [product.name, product.quantity, product.unit, product.amountSum]);

  const update = useMutation({
    mutationFn: (patch: Partial<{ name: string; quantity: number; unit: string; amountSum: number; amountUsdCents: number }>) =>
      expenseService.updateProduct(product.id, patch),
    onSuccess: onChanged,
  });
  const remove = useMutation({ mutationFn: () => expenseService.removeProduct(product.id), onSuccess: onChanged });

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <input className="adm-input" value={name} onChange={(e) => setName(e.target.value)}
        onBlur={() => { const v = name.trim(); if (v && v !== product.name) update.mutate({ name: v }); }}
        placeholder={t('product_name')} style={{ ...rowInput, flex: 2, minWidth: 140 }} />
      <input className="adm-input" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)}
        onBlur={() => { const n = Number(qty); if (Number.isFinite(n) && n !== product.quantity) update.mutate({ quantity: n }); }}
        placeholder={t('quantity')} style={{ ...rowInput, width: 80 }} />
      <select className="adm-input" value={unit} onChange={(e) => { setUnit(e.target.value); update.mutate({ unit: e.target.value }); }}
        style={{ ...rowInput, width: 78 }}>
        {UNITS.map((u) => <option key={u} value={u}>{t(`unit_${u}` as Parameters<typeof translate>[0])}</option>)}
      </select>
      <input className="adm-input" inputMode="numeric" value={amount} onChange={(e) => setAmount(groupDigits(e.target.value))}
        onBlur={() => { const c = parseWholeSum(amount); if (c !== null && clampSum(c) !== product.amountSum) update.mutate({ amountSum: clampSum(c) }); }}
        placeholder={t('amount')} style={{ ...rowInput, width: 150, textAlign: 'right' }} />
      {showUsd && (
        <UsdField t={t} value={product.amountUsdCents ?? 0}
          onCommit={(usd) => update.mutate({ amountUsdCents: usd })} />
      )}
      <button type="button" onClick={() => remove.mutate()} title={t('delete')} style={removeBtn}>×</button>
    </div>
  );
};

const AddProductRow = ({ eventId, t, onAdded, showUsd }: { eventId: string; t: TFn; onAdded: () => void; showUsd: boolean }) => {
  const [name, setName] = useState('');
  const [qty, setQty] = useState('');
  const [unit, setUnit] = useState('kg');
  const [amount, setAmount] = useState('');
  const [usd, setUsd] = useState('');
  const add = useMutation({
    mutationFn: () => expenseService.addProduct(eventId, {
      name: name.trim(), quantity: Number(qty) || 0, unit, amountSum: clampSum(parseWholeSum(amount) ?? 0),
      amountUsdCents: clampUsd(parseUsdToCents(usd) ?? 0),
    }),
    onSuccess: () => { setName(''); setQty(''); setUnit('kg'); setAmount(''); setUsd(''); onAdded(); },
  });
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', opacity: 0.95 }}>
      <input className="adm-input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('product_name')} style={{ ...rowInput, flex: 2, minWidth: 140 }} />
      <input className="adm-input" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} placeholder={t('quantity')} style={{ ...rowInput, width: 80 }} />
      <select className="adm-input" value={unit} onChange={(e) => setUnit(e.target.value)} style={{ ...rowInput, width: 78 }}>
        {UNITS.map((u) => <option key={u} value={u}>{t(`unit_${u}` as Parameters<typeof translate>[0])}</option>)}
      </select>
      <input className="adm-input" inputMode="numeric" value={amount} onChange={(e) => setAmount(groupDigits(e.target.value))} placeholder={t('amount')} style={{ ...rowInput, width: 150, textAlign: 'right' }} />
      {showUsd && (
        <input className="adm-input" inputMode="decimal" value={usd} onChange={(e) => setUsd(e.target.value)}
          placeholder={t('amount_usd_placeholder')} aria-label={t('amount_usd')}
          style={{ ...rowInput, width: USD_W, textAlign: 'right' }} />
      )}
      <button type="button" className="adm-btn-ghost" onClick={() => { if (name.trim()) add.mutate(); }} disabled={!name.trim() || add.isPending} style={{ fontSize: 18, lineHeight: 1, padding: '6px 12px' }}>+</button>
    </div>
  );
};

// Shared row for salary & additional lines (both { name, amountSum }).
type SimpleLine = { id: string; name: string; amountSum: number; amountUsdCents?: number };

const LineRow = ({ line, placeholder, t, onUpdate, onRemove, onChanged, showUsd }: {
  line: SimpleLine; placeholder: string; t: TFn;
  onUpdate: (patch: Partial<{ name: string; amountSum: number; amountUsdCents: number }>) => Promise<unknown>;
  onRemove: () => Promise<unknown>; onChanged: () => void; showUsd: boolean;
}) => {
  const [name, setName] = useState(line.name);
  const [amount, setAmount] = useState(groupDigits(String(line.amountSum)));
  useEffect(() => { setName(line.name); setAmount(groupDigits(String(line.amountSum))); }, [line.name, line.amountSum]);

  const update = useMutation({ mutationFn: onUpdate, onSuccess: onChanged });
  const remove = useMutation({ mutationFn: onRemove, onSuccess: onChanged });

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <input className="adm-input" value={name} onChange={(e) => setName(e.target.value)}
        onBlur={() => { const v = name.trim(); if (v && v !== line.name) update.mutate({ name: v }); }}
        placeholder={placeholder} style={{ ...rowInput, flex: 2, minWidth: 160 }} />
      <input className="adm-input" inputMode="numeric" value={amount} onChange={(e) => setAmount(groupDigits(e.target.value))}
        onBlur={() => { const c = parseWholeSum(amount); if (c !== null && clampSum(c) !== line.amountSum) update.mutate({ amountSum: clampSum(c) }); }}
        placeholder={t('amount')} style={{ ...rowInput, width: 150, textAlign: 'right' }} />
      {showUsd && (
        <UsdField t={t} value={line.amountUsdCents ?? 0}
          onCommit={(usd) => update.mutate({ amountUsdCents: usd })} />
      )}
      <button type="button" onClick={() => remove.mutate()} title={t('delete')} style={removeBtn}>×</button>
    </div>
  );
};

const AddLineRow = ({ placeholder, onAdd, onAdded, t, showUsd }: {
  placeholder: string;
  onAdd: (payload: { name: string; amountSum: number; amountUsdCents: number }) => Promise<unknown>;
  onAdded: () => void;
  t: TFn;
  showUsd: boolean;
}) => {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [usd, setUsd] = useState('');
  const add = useMutation({
    mutationFn: () => onAdd({
      name: name.trim(),
      amountSum: clampSum(parseWholeSum(amount) ?? 0),
      amountUsdCents: clampUsd(parseUsdToCents(usd) ?? 0),
    }),
    onSuccess: () => { setName(''); setAmount(''); setUsd(''); onAdded(); },
  });
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <input className="adm-input" value={name} onChange={(e) => setName(e.target.value)} placeholder={placeholder} style={{ ...rowInput, flex: 2, minWidth: 160 }} />
      <input className="adm-input" inputMode="numeric" value={amount} onChange={(e) => setAmount(groupDigits(e.target.value))} placeholder="—" style={{ ...rowInput, width: 150, textAlign: 'right' }} />
      {showUsd && (
        <input className="adm-input" inputMode="decimal" value={usd} onChange={(e) => setUsd(e.target.value)}
          placeholder={t('amount_usd_placeholder')} aria-label={t('amount_usd')}
          style={{ ...rowInput, width: USD_W, textAlign: 'right' }} />
      )}
      <button type="button" className="adm-btn-ghost" onClick={() => { if (name.trim()) add.mutate(); }} disabled={!name.trim() || add.isPending} style={{ fontSize: 18, lineHeight: 1, padding: '6px 12px' }}>+</button>
    </div>
  );
};
