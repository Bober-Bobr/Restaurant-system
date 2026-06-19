import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { expenseService } from '../services/expense.service';
import type { DayEvent, DayEventType, ExpenseDay, ProductExpense } from '../types/domain';
import { useAdminStore } from '../store/admin.store';
import { translate } from '../utils/translate';
import { formatWholeSum, groupDigits, parseWholeSum } from '../utils/currency';

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

const bookingTotal = (e: DayEvent) => e.guestCount * e.pricePerGuestSum;
// Each event's budget is its booking (guests × price per guest). There is no
// longer a separate day-level allocation — the day budget is the sum of these.
export const eventBudget = (e: DayEvent) => bookingTotal(e);
// Spent = the actual expenses (products, salaries, additionals).
const eventSpent = (e: DayEvent) =>
  e.products.reduce((s, p) => s + p.amountSum, 0) +
  e.salaries.reduce((s, p) => s + p.amountSum, 0) +
  e.additionals.reduce((s, p) => s + p.amountSum, 0);

// Sum of every expense line across all of a day's events.
export const daySpent = (day: ExpenseDay) => day.events.reduce((s, e) => s + eventSpent(e), 0);
// Day budget = sum of every event's budget.
export const dayBudget = (day: ExpenseDay) => day.events.reduce((s, e) => s + eventBudget(e), 0);

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
    border: '1px solid rgba(201,164,44,0.35)',
    background: enabled ? 'rgba(201,164,44,0.12)' : 'rgba(255,255,255,0.03)',
    color: enabled ? '#c9a42c' : 'rgba(226,232,240,0.25)',
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
          <span style={labelStyle}>{t('add_day_for_date')}</span>
          <input type="date" className="adm-input" value={newDate} onChange={(e) => setNewDate(e.target.value)} style={{ width: 170 }} />
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
const rowInput: React.CSSProperties = { height: 38 };

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

  const budget = dayBudget(day);
  const spent = daySpent(day);
  const remaining = budget - spent;

  return (
    <section className="adm-card tablet-fade-up" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '16px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexWrap: 'wrap' }}>
        {/* Budget of the open department (guests × price per guest). */}
        {activeEvent && bookingTotal(activeEvent) > 0
          ? <Total label={t('guests_total')} value={formatWholeSum(bookingTotal(activeEvent))} color="#fbbf24" />
          : <span />}
        <button type="button" className="adm-btn-danger" onClick={() => { if (window.confirm(t('delete_day_confirm'))) removeDay.mutate(); }}
          disabled={removeDay.isPending} style={{ fontSize: 12 }}>
          {t('delete')}
        </button>
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
            </div>

            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))' }}>
              {events.map((ev) => {
                const evSpent = eventSpent(ev);
                const evBudget = eventBudget(ev);
                const checked = selectedEvents.has(ev.id);
                return (
                  <div key={ev.id} className="tablet-fade-up"
                    style={{
                      position: 'relative', borderRadius: 16,
                      background: 'linear-gradient(160deg, rgba(201,164,44,0.12), rgba(255,255,255,0.03))',
                      border: checked ? '1px solid rgba(201,164,44,0.7)' : '1px solid rgba(201,164,44,0.3)',
                      transition: 'all 0.18s',
                    }}>
                    <label onClick={(e) => e.stopPropagation()}
                      style={{ position: 'absolute', top: 12, right: 12, display: 'flex', cursor: 'pointer', zIndex: 1 }}>
                      <input type="checkbox" checked={checked} onChange={() => toggleEvent(ev.id)}
                        style={{ width: 18, height: 18, accentColor: '#c9a42c', cursor: 'pointer' }} />
                    </label>
                    <button type="button" onClick={() => setActiveEventId(ev.id)}
                      style={{ width: '100%', textAlign: 'left', cursor: 'pointer', background: 'none', border: 'none', padding: '18px 18px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingRight: 26 }}>
                        <span style={{ fontSize: 16, fontWeight: 800, color: '#f8fafc' }}>{t(EVENT_LABEL_KEY[ev.type])}</span>
                        <span style={{ color: '#c9a42c', fontSize: 18, marginLeft: 'auto' }}>›</span>
                      </div>
                      <p style={{ ...labelStyle, margin: '10px 0 2px' }}>{t('budget')}</p>
                      <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: evBudget > 0 ? '#e2e8f0' : 'rgba(226,232,240,0.45)' }}>
                        {formatWholeSum(evBudget)}
                      </p>
                      <p style={{ ...labelStyle, margin: '8px 0 2px' }}>{t('amount_spent')}</p>
                      <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: evSpent > 0 ? '#fbbf24' : 'rgba(226,232,240,0.45)' }}>
                        {formatWholeSum(evSpent)}
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
              style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#c9a42c', fontSize: 15, fontWeight: 700, padding: 0 }}>
              ‹ {t(EVENT_LABEL_KEY[activeEvent.type])}
            </button>
            <EventPanel event={activeEvent} t={t} onChanged={invalidate} />
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 28, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.07)', flexWrap: 'wrap' }}>
          <Total label={t('budget')} value={formatWholeSum(budget)} color="#e2e8f0" />
          <Total label={t('amount_spent')} value={formatWholeSum(spent)} color="#fbbf24" />
          <Total label={t('remaining')} value={formatWholeSum(remaining)} color={remaining < 0 ? '#f87171' : '#4ade80'} />
        </div>

        {/* End-of-day report */}
        <div style={{ display: 'grid', gap: 8, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <span style={labelStyle}>{t('day_report')}</span>
          <textarea
            className="adm-input"
            rows={3}
            value={report}
            onChange={(e) => setReport(e.target.value)}
            onBlur={() => { if ((day.report ?? '') !== report) updateDay.mutate({ report: report || null }); }}
            placeholder={t('day_report_placeholder')}
            style={{ resize: 'vertical', minHeight: 70, lineHeight: 1.5 }}
          />
        </div>
      </div>
    </section>
  );
};

const Block = ({ title, total, children }: { title: string; total: string; children: React.ReactNode }) => (
  <div>
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
      <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>{title}</h3>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(226,232,240,0.7)' }}>{total}</span>
    </div>
    {children}
  </div>
);

const Total = ({ label, value, color }: { label: string; value: string; color: string }) => (
  <div style={{ textAlign: 'right' }}>
    <p style={{ ...labelStyle, margin: '0 0 2px' }}>{label}</p>
    <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color }}>{value}</p>
  </div>
);

// One department's booking, three expense blocks (products / salaries / additionals) and notes.
const EventPanel = ({ event, t, onChanged }: { event: DayEvent; t: TFn; onChanged: () => void }) => {
  const productsTotal = event.products.reduce((s, p) => s + p.amountSum, 0);
  const salariesTotal = event.salaries.reduce((s, p) => s + p.amountSum, 0);
  const additionalsTotal = event.additionals.reduce((s, p) => s + p.amountSum, 0);

  const updateEvent = useMutation({
    mutationFn: (patch: Partial<{ bookingName: string | null; guestCount: number; pricePerGuestSum: number; report: string | null }>) =>
      expenseService.updateEvent(event.id, patch),
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
      {/* Booking: guests × price per guest is added to this department's spent.
          The total itself is shown at the top, above the allocated funds field. */}
      <Block title={t('booking')} total="">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input className="adm-input" value={bookingName} onChange={(e) => setBookingName(e.target.value)}
            onBlur={() => { const v = bookingName.trim(); if (v !== (event.bookingName ?? '')) updateEvent.mutate({ bookingName: v || null }); }}
            placeholder={t('booking_name')} style={{ ...rowInput, flex: 2, minWidth: 160 }} />
          <input className="adm-input" inputMode="numeric" value={guests} onChange={(e) => setGuests(e.target.value.replace(/[^\d]/g, ''))}
            onBlur={() => { const n = Number(guests) || 0; if (n !== event.guestCount) updateEvent.mutate({ guestCount: n }); }}
            placeholder={t('guest_count')} style={{ ...rowInput, width: 100, textAlign: 'right' }} />
          <span style={{ color: 'rgba(226,232,240,0.4)' }}>×</span>
          <input className="adm-input" inputMode="numeric" value={price} onChange={(e) => setPrice(groupDigits(e.target.value))}
            onBlur={() => { const c = parseWholeSum(price); if (c !== null && clampSum(c) !== event.pricePerGuestSum) updateEvent.mutate({ pricePerGuestSum: clampSum(c) }); }}
            placeholder={t('price_per_guest')} style={{ ...rowInput, width: 150, textAlign: 'right' }} />
        </div>
      </Block>

      <Block title={t('product_expenses')} total={formatWholeSum(productsTotal)}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {event.products.map((p) => <ProductRow key={p.id} product={p} t={t} onChanged={onChanged} />)}
          <AddProductRow eventId={event.id} t={t} onAdded={onChanged} />
        </div>
      </Block>

      <Block title={t('employee_salaries')} total={formatWholeSum(salariesTotal)}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {event.salaries.map((s) => (
            <LineRow key={s.id} line={s} placeholder={t('employee_name')} t={t}
              onUpdate={(patch) => expenseService.updateSalary(s.id, patch)}
              onRemove={() => expenseService.removeSalary(s.id)} onChanged={onChanged} />
          ))}
          <AddLineRow placeholder={t('employee_name')}
            onAdd={(payload) => expenseService.addSalary(event.id, payload)} onAdded={onChanged} />
        </div>
      </Block>

      <Block title={t('additional_expenses')} total={formatWholeSum(additionalsTotal)}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {event.additionals.map((a) => (
            <LineRow key={a.id} line={a} placeholder={t('note')} t={t}
              onUpdate={(patch) => expenseService.updateAdditional(a.id, patch)}
              onRemove={() => expenseService.removeAdditional(a.id)} onChanged={onChanged} />
          ))}
          <AddLineRow placeholder={t('note')}
            onAdd={(payload) => expenseService.addAdditional(event.id, payload)} onAdded={onChanged} />
        </div>
      </Block>

      {/* Per-event notes (separate from the day report). */}
      <div style={{ display: 'grid', gap: 8, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        <span style={labelStyle}>{t('event_notes')}</span>
        <textarea className="adm-input" rows={2} value={note} onChange={(e) => setNote(e.target.value)}
          onBlur={() => { if ((event.report ?? '') !== note) updateEvent.mutate({ report: note || null }); }}
          placeholder={t('event_notes_placeholder')} style={{ resize: 'vertical', minHeight: 56, lineHeight: 1.5 }} />
      </div>
    </>
  );
};

const removeBtn: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', color: '#f87171', fontSize: 18, lineHeight: 1, padding: 4 };

const ProductRow = ({ product, t, onChanged }: { product: ProductExpense; t: TFn; onChanged: () => void }) => {
  const [name, setName] = useState(product.name);
  const [qty, setQty] = useState(String(product.quantity));
  const [unit, setUnit] = useState(product.unit);
  const [amount, setAmount] = useState(groupDigits(String(product.amountSum)));
  useEffect(() => {
    setName(product.name); setQty(String(product.quantity)); setUnit(product.unit); setAmount(groupDigits(String(product.amountSum)));
  }, [product.name, product.quantity, product.unit, product.amountSum]);

  const update = useMutation({
    mutationFn: (patch: Partial<{ name: string; quantity: number; unit: string; amountSum: number }>) =>
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
      <button type="button" onClick={() => remove.mutate()} title={t('delete')} style={removeBtn}>×</button>
    </div>
  );
};

const AddProductRow = ({ eventId, t, onAdded }: { eventId: string; t: TFn; onAdded: () => void }) => {
  const [name, setName] = useState('');
  const [qty, setQty] = useState('');
  const [unit, setUnit] = useState('kg');
  const [amount, setAmount] = useState('');
  const add = useMutation({
    mutationFn: () => expenseService.addProduct(eventId, {
      name: name.trim(), quantity: Number(qty) || 0, unit, amountSum: clampSum(parseWholeSum(amount) ?? 0),
    }),
    onSuccess: () => { setName(''); setQty(''); setUnit('kg'); setAmount(''); onAdded(); },
  });
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', opacity: 0.95 }}>
      <input className="adm-input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('product_name')} style={{ ...rowInput, flex: 2, minWidth: 140 }} />
      <input className="adm-input" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} placeholder={t('quantity')} style={{ ...rowInput, width: 80 }} />
      <select className="adm-input" value={unit} onChange={(e) => setUnit(e.target.value)} style={{ ...rowInput, width: 78 }}>
        {UNITS.map((u) => <option key={u} value={u}>{t(`unit_${u}` as Parameters<typeof translate>[0])}</option>)}
      </select>
      <input className="adm-input" inputMode="numeric" value={amount} onChange={(e) => setAmount(groupDigits(e.target.value))} placeholder={t('amount')} style={{ ...rowInput, width: 150, textAlign: 'right' }} />
      <button type="button" className="adm-btn-ghost" onClick={() => { if (name.trim()) add.mutate(); }} disabled={!name.trim() || add.isPending} style={{ fontSize: 18, lineHeight: 1, padding: '6px 12px' }}>+</button>
    </div>
  );
};

// Shared row for salary & additional lines (both { name, amountSum }).
type SimpleLine = { id: string; name: string; amountSum: number };

const LineRow = ({ line, placeholder, t, onUpdate, onRemove, onChanged }: {
  line: SimpleLine; placeholder: string; t: TFn;
  onUpdate: (patch: Partial<{ name: string; amountSum: number }>) => Promise<unknown>;
  onRemove: () => Promise<unknown>; onChanged: () => void;
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
      <button type="button" onClick={() => remove.mutate()} title={t('delete')} style={removeBtn}>×</button>
    </div>
  );
};

const AddLineRow = ({ placeholder, onAdd, onAdded }: {
  placeholder: string;
  onAdd: (payload: { name: string; amountSum: number }) => Promise<unknown>;
  onAdded: () => void;
}) => {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const add = useMutation({
    mutationFn: () => onAdd({ name: name.trim(), amountSum: clampSum(parseWholeSum(amount) ?? 0) }),
    onSuccess: () => { setName(''); setAmount(''); onAdded(); },
  });
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <input className="adm-input" value={name} onChange={(e) => setName(e.target.value)} placeholder={placeholder} style={{ ...rowInput, flex: 2, minWidth: 160 }} />
      <input className="adm-input" inputMode="numeric" value={amount} onChange={(e) => setAmount(groupDigits(e.target.value))} placeholder="—" style={{ ...rowInput, width: 150, textAlign: 'right' }} />
      <button type="button" className="adm-btn-ghost" onClick={() => { if (name.trim()) add.mutate(); }} disabled={!name.trim() || add.isPending} style={{ fontSize: 18, lineHeight: 1, padding: '6px 12px' }}>+</button>
    </div>
  );
};
