import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { expenseService } from '../services/expense.service';
import type { ExpenseDay, ProductExpense, SalaryExpense } from '../types/domain';
import { useAdminStore } from '../store/admin.store';
import { translate } from '../utils/translate';
import { formatWholeSum, parseWholeSum } from '../utils/currency';

const QUERY_KEY = ['expense-days'];
const UNITS = ['kg', 'g', 'l', 'ml', 'pcs'];
const MAX_SUM = 1_000_000_000;

const PDF_PERIODS: { days: number; key: Parameters<typeof translate>[0] }[] = [
  { days: 1, key: 'period_day' },
  { days: 3, key: 'period_3_days' },
  { days: 7, key: 'period_week' },
  { days: 14, key: 'period_2_weeks' },
  { days: 30, key: 'period_month' },
];

type Locale = 'en' | 'ru' | 'uz';
type TFn = (key: Parameters<typeof translate>[0], params?: Record<string, string | number>) => string;

const clampSum = (n: number) => Math.max(0, Math.min(MAX_SUM, n));

export const ExpenseLedgerPage = () => {
  const { locale } = useAdminStore();
  const t: TFn = (key, params) => translate(key, locale, params);
  const queryClient = useQueryClient();
  const [idx, setIdx] = useState(0);
  const [period, setPeriod] = useState(1);
  const [downloading, setDownloading] = useState(false);

  const { data: days = [], isLoading, isError } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => expenseService.listDays(),
  });

  // Keep the selected index within bounds as the list changes.
  useEffect(() => {
    if (idx > days.length - 1) setIdx(Math.max(0, days.length - 1));
  }, [days.length, idx]);

  const addDay = useMutation({
    mutationFn: () => expenseService.createDay(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      setIdx(0); // newest day sits at the top
    },
  });

  const current = days[idx];

  const downloadPdf = async () => {
    if (!current) return;
    setDownloading(true);
    try {
      const blob = await expenseService.downloadPdf(current.date, period, locale);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `ledger-${current.date}-${period}d.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      window.alert(t('download_failed'));
    } finally {
      setDownloading(false);
    }
  };

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

      {/* Toolbar: add day + PDF export */}
      <section className="adm-card tablet-fade-up" style={{ padding: 14, marginBottom: 20, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="button" className="adm-btn-primary" onClick={() => addDay.mutate()} disabled={addDay.isPending}>
          {addDay.isPending ? t('creating') : `+ ${t('add_day')}`}
        </button>
        <div style={{ flex: 1 }} />
        <select className="adm-input" value={period} onChange={(e) => setPeriod(Number(e.target.value))} style={{ width: 160, height: 42 }}>
          {PDF_PERIODS.map((p) => <option key={p.days} value={p.days}>{t(p.key)}</option>)}
        </select>
        <button type="button" className="adm-btn-ghost" onClick={downloadPdf} disabled={!current || downloading} style={{ height: 42 }}>
          {downloading ? t('loading') : `📄 ${t('export_pdf')}`}
        </button>
      </section>

      {isLoading && <p style={{ color: 'rgba(226,232,240,0.55)' }}>{t('loading')}</p>}
      {isError && <p style={{ color: '#fca5a5' }}>{t('something_went_wrong')}</p>}
      {!isLoading && days.length === 0 && <p style={{ color: 'rgba(226,232,240,0.55)' }}>{t('no_days_yet')}</p>}

      {/* Day switcher  ‹  Current day  › */}
      {current && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <button type="button" aria-label={t('older_day')} style={arrowBtn(idx < days.length - 1)}
              onClick={() => { if (idx < days.length - 1) setIdx(idx + 1); }}>‹</button>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#f8fafc', textTransform: 'capitalize' }}>{dateLabel}</p>
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

const DayCard = ({ day, t }: { day: ExpenseDay; t: TFn }) => {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: QUERY_KEY });

  const updateDay = useMutation({
    mutationFn: (patch: Partial<{ allocatedSum: number; additionalSum: number; additionalNote: string | null }>) =>
      expenseService.updateDay(day.id, patch),
    onSuccess: invalidate,
  });
  const removeDay = useMutation({ mutationFn: () => expenseService.removeDay(day.id), onSuccess: invalidate });

  const [allocated, setAllocated] = useState(String(day.allocatedSum));
  const [additional, setAdditional] = useState(String(day.additionalSum));
  const [note, setNote] = useState(day.additionalNote ?? '');
  useEffect(() => {
    setAllocated(String(day.allocatedSum));
    setAdditional(String(day.additionalSum));
    setNote(day.additionalNote ?? '');
  }, [day.allocatedSum, day.additionalSum, day.additionalNote]);

  const productsTotal = day.products.reduce((s, p) => s + p.amountSum, 0);
  const salariesTotal = day.salaries.reduce((s, p) => s + p.amountSum, 0);
  const spent = productsTotal + salariesTotal + day.additionalSum;
  const remaining = day.allocatedSum - spent;

  const commitMoney = (value: string, key: 'allocatedSum' | 'additionalSum') => {
    const parsed = parseWholeSum(value);
    if (parsed === null) return;
    const next = clampSum(parsed);
    if (next !== day[key]) updateDay.mutate({ [key]: next });
  };

  return (
    <section className="adm-card tablet-fade-up" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '16px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={labelStyle}>{t('allocated_funds')}</span>
          <input className="adm-input" inputMode="numeric" value={allocated}
            onChange={(e) => setAllocated(e.target.value)} onBlur={() => commitMoney(allocated, 'allocatedSum')}
            style={{ width: 170, textAlign: 'right' }} />
        </label>
        <button type="button" className="adm-btn-danger" onClick={() => { if (window.confirm(t('delete_day_confirm'))) removeDay.mutate(); }}
          disabled={removeDay.isPending} style={{ fontSize: 12 }}>
          {t('delete')}
        </button>
      </div>

      <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <Block title={t('product_expenses')} total={formatWholeSum(productsTotal)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {day.products.map((p) => <ProductRow key={p.id} product={p} t={t} onChanged={invalidate} />)}
            <AddProductRow dayId={day.id} t={t} onAdded={invalidate} />
          </div>
        </Block>

        <Block title={t('employee_salaries')} total={formatWholeSum(salariesTotal)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {day.salaries.map((s) => <SalaryRow key={s.id} salary={s} t={t} onChanged={invalidate} />)}
            <AddSalaryRow dayId={day.id} t={t} onAdded={invalidate} />
          </div>
        </Block>

        <div style={{ display: 'grid', gap: 8 }}>
          <span style={labelStyle}>{t('additional_expenses')}</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input className="adm-input" placeholder={t('note')} value={note}
              onChange={(e) => setNote(e.target.value)}
              onBlur={() => { if ((day.additionalNote ?? '') !== note) updateDay.mutate({ additionalNote: note || null }); }}
              style={{ flex: 1, minWidth: 160 }} />
            <input className="adm-input" inputMode="numeric" value={additional}
              onChange={(e) => setAdditional(e.target.value)} onBlur={() => commitMoney(additional, 'additionalSum')}
              style={{ width: 170, textAlign: 'right' }} />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 28, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.07)', flexWrap: 'wrap' }}>
          <Total label={t('amount_spent')} value={formatWholeSum(spent)} color="#fbbf24" />
          <Total label={t('remaining')} value={formatWholeSum(remaining)} color={remaining < 0 ? '#f87171' : '#4ade80'} />
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

const rowInput: React.CSSProperties = { height: 38 };

const ProductRow = ({ product, t, onChanged }: { product: ProductExpense; t: TFn; onChanged: () => void }) => {
  const [name, setName] = useState(product.name);
  const [qty, setQty] = useState(String(product.quantity));
  const [unit, setUnit] = useState(product.unit);
  const [amount, setAmount] = useState(String(product.amountSum));
  useEffect(() => {
    setName(product.name); setQty(String(product.quantity)); setUnit(product.unit); setAmount(String(product.amountSum));
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
      <input className="adm-input" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)}
        onBlur={() => { const c = parseWholeSum(amount); if (c !== null && clampSum(c) !== product.amountSum) update.mutate({ amountSum: clampSum(c) }); }}
        placeholder={t('amount')} style={{ ...rowInput, width: 150, textAlign: 'right' }} />
      <button type="button" onClick={() => remove.mutate()} title={t('delete')}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f87171', fontSize: 18, lineHeight: 1, padding: 4 }}>×</button>
    </div>
  );
};

const AddProductRow = ({ dayId, t, onAdded }: { dayId: string; t: TFn; onAdded: () => void }) => {
  const [name, setName] = useState('');
  const [qty, setQty] = useState('');
  const [unit, setUnit] = useState('kg');
  const [amount, setAmount] = useState('');
  const add = useMutation({
    mutationFn: () => expenseService.addProduct(dayId, {
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
      <input className="adm-input" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={t('amount')} style={{ ...rowInput, width: 150, textAlign: 'right' }} />
      <button type="button" className="adm-btn-ghost" onClick={() => { if (name.trim()) add.mutate(); }} disabled={!name.trim() || add.isPending} style={{ fontSize: 18, lineHeight: 1, padding: '6px 12px' }}>+</button>
    </div>
  );
};

const SalaryRow = ({ salary, t, onChanged }: { salary: SalaryExpense; t: TFn; onChanged: () => void }) => {
  const [name, setName] = useState(salary.name);
  const [amount, setAmount] = useState(String(salary.amountSum));
  useEffect(() => { setName(salary.name); setAmount(String(salary.amountSum)); }, [salary.name, salary.amountSum]);

  const update = useMutation({
    mutationFn: (patch: Partial<{ name: string; amountSum: number }>) => expenseService.updateSalary(salary.id, patch),
    onSuccess: onChanged,
  });
  const remove = useMutation({ mutationFn: () => expenseService.removeSalary(salary.id), onSuccess: onChanged });

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <input className="adm-input" value={name} onChange={(e) => setName(e.target.value)}
        onBlur={() => { const v = name.trim(); if (v && v !== salary.name) update.mutate({ name: v }); }}
        placeholder={t('employee_name')} style={{ ...rowInput, flex: 2, minWidth: 160 }} />
      <input className="adm-input" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)}
        onBlur={() => { const c = parseWholeSum(amount); if (c !== null && clampSum(c) !== salary.amountSum) update.mutate({ amountSum: clampSum(c) }); }}
        placeholder={t('amount')} style={{ ...rowInput, width: 150, textAlign: 'right' }} />
      <button type="button" onClick={() => remove.mutate()} title={t('delete')}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f87171', fontSize: 18, lineHeight: 1, padding: 4 }}>×</button>
    </div>
  );
};

const AddSalaryRow = ({ dayId, t, onAdded }: { dayId: string; t: TFn; onAdded: () => void }) => {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const add = useMutation({
    mutationFn: () => expenseService.addSalary(dayId, { name: name.trim(), amountSum: clampSum(parseWholeSum(amount) ?? 0) }),
    onSuccess: () => { setName(''); setAmount(''); onAdded(); },
  });
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <input className="adm-input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('employee_name')} style={{ ...rowInput, flex: 2, minWidth: 160 }} />
      <input className="adm-input" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={t('amount')} style={{ ...rowInput, width: 150, textAlign: 'right' }} />
      <button type="button" className="adm-btn-ghost" onClick={() => { if (name.trim()) add.mutate(); }} disabled={!name.trim() || add.isPending} style={{ fontSize: 18, lineHeight: 1, padding: '6px 12px' }}>+</button>
    </div>
  );
};
