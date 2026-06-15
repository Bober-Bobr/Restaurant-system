import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { expenseService } from '../services/expense.service';
import type { ExpenseDay, ProductExpense, SalaryExpense } from '../types/domain';
import { useAdminStore } from '../store/admin.store';
import { translate } from '../utils/translate';
import { formatSum, formatSumInput, parseSumToTiyin } from '../utils/currency';

const QUERY_KEY = ['expense-days'];
const UNITS = ['kg', 'g', 'l', 'ml', 'pcs'];

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

type Locale = 'en' | 'ru' | 'uz';

export const ExpenseLedgerPage = () => {
  const { locale } = useAdminStore();
  const t = (key: Parameters<typeof translate>[0], params?: Record<string, string | number>) => translate(key, locale, params);
  const queryClient = useQueryClient();
  const [newDate, setNewDate] = useState(todayStr());

  const { data: days = [], isLoading, isError } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => expenseService.listDays(),
  });

  const addDayMutation = useMutation({
    mutationFn: (date: string) => expenseService.createDay(date),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  return (
    <main className="tablet-fade-in" style={{ maxWidth: 1000, margin: '0 auto', padding: '28px 20px', position: 'relative', zIndex: 1 }}>
      <h1 className="adm-title" style={{ marginBottom: 6 }}>{t('expense_ledger')}</h1>
      <p style={{ color: 'rgba(226,232,240,0.55)', fontSize: 13, marginTop: 0, marginBottom: 20 }}>
        {t('expense_ledger_help')}
      </p>

      {/* Add a day */}
      <section className="adm-card tablet-fade-up" style={{ padding: 16, marginBottom: 24, display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <label style={{ display: 'grid', gap: 6 }}>
          <span className="adm-label">{t('select_date')}</span>
          <input type="date" className="adm-input" value={newDate} onChange={(e) => setNewDate(e.target.value)} style={{ colorScheme: 'dark' }} />
        </label>
        <button
          type="button"
          className="adm-btn-primary"
          onClick={() => { if (newDate) addDayMutation.mutate(newDate); }}
          disabled={!newDate || addDayMutation.isPending}
        >
          {addDayMutation.isPending ? t('creating') : t('add_day')}
        </button>
      </section>

      {isLoading && <p style={{ color: 'rgba(226,232,240,0.55)' }}>{t('loading')}</p>}
      {isError && <p style={{ color: '#fca5a5' }}>{t('something_went_wrong')}</p>}
      {!isLoading && days.length === 0 && <p style={{ color: 'rgba(226,232,240,0.55)' }}>{t('no_days_yet')}</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {days.map((day) => (
          <DayCard key={day.id} day={day} locale={locale} t={t} />
        ))}
      </div>
    </main>
  );
};

type TFn = (key: Parameters<typeof translate>[0], params?: Record<string, string | number>) => string;

const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: 'rgba(226,232,240,0.6)', textTransform: 'uppercase', letterSpacing: '0.05em' };

const DayCard = ({ day, locale, t }: { day: ExpenseDay; locale: Locale; t: TFn }) => {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: QUERY_KEY });

  const updateDay = useMutation({
    mutationFn: (patch: Partial<{ allocatedCents: number; additionalCents: number; additionalNote: string | null }>) =>
      expenseService.updateDay(day.id, patch),
    onSuccess: invalidate,
  });
  const removeDay = useMutation({
    mutationFn: () => expenseService.removeDay(day.id),
    onSuccess: invalidate,
  });

  const [allocated, setAllocated] = useState(formatSumInput(day.allocatedCents));
  const [additional, setAdditional] = useState(formatSumInput(day.additionalCents));
  const [note, setNote] = useState(day.additionalNote ?? '');
  useEffect(() => {
    setAllocated(formatSumInput(day.allocatedCents));
    setAdditional(formatSumInput(day.additionalCents));
    setNote(day.additionalNote ?? '');
  }, [day.allocatedCents, day.additionalCents, day.additionalNote]);

  const productsTotal = day.products.reduce((s, p) => s + p.amountCents, 0);
  const salariesTotal = day.salaries.reduce((s, p) => s + p.amountCents, 0);
  const spent = productsTotal + salariesTotal + day.additionalCents;
  const remaining = day.allocatedCents - spent;

  const dateLabel = new Date(`${day.date}T00:00:00`).toLocaleDateString(
    locale === 'uz' ? 'uz-UZ' : locale === 'ru' ? 'ru-RU' : 'en-US',
    { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
  );

  const commitMoney = (value: string, key: 'allocatedCents' | 'additionalCents') => {
    const cents = parseSumToTiyin(value);
    if (cents !== null && cents !== day[key]) updateDay.mutate({ [key]: cents });
  };

  return (
    <section className="adm-card tablet-fade-up" style={{ padding: 0, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '16px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexWrap: 'wrap' }}>
        <h2 className="adm-heading" style={{ margin: 0, fontSize: 17, textTransform: 'capitalize' }}>{dateLabel}</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={labelStyle}>{t('allocated_funds')}</span>
            <input
              className="adm-input"
              inputMode="numeric"
              value={allocated}
              onChange={(e) => setAllocated(e.target.value)}
              onBlur={() => commitMoney(allocated, 'allocatedCents')}
              style={{ width: 140, textAlign: 'right' }}
            />
          </label>
          <button
            type="button"
            className="adm-btn-danger"
            onClick={() => { if (window.confirm(t('delete_day_confirm'))) removeDay.mutate(); }}
            disabled={removeDay.isPending}
            style={{ fontSize: 12 }}
          >
            {t('delete')}
          </button>
        </div>
      </div>

      <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Block 1: Product expenses */}
        <Block title={t('product_expenses')} total={formatSum(productsTotal)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {day.products.map((p) => (
              <ProductRow key={p.id} product={p} t={t} onChanged={invalidate} />
            ))}
            <AddProductRow dayId={day.id} t={t} onAdded={invalidate} />
          </div>
        </Block>

        {/* Block 2: Employee salaries */}
        <Block title={t('employee_salaries')} total={formatSum(salariesTotal)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {day.salaries.map((s) => (
              <SalaryRow key={s.id} salary={s} t={t} onChanged={invalidate} />
            ))}
            <AddSalaryRow dayId={day.id} t={t} onAdded={invalidate} />
          </div>
        </Block>

        {/* Additional expenses */}
        <div style={{ display: 'grid', gap: 8 }}>
          <span style={labelStyle}>{t('additional_expenses')}</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              className="adm-input"
              placeholder={t('note')}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onBlur={() => { if ((day.additionalNote ?? '') !== note) updateDay.mutate({ additionalNote: note || null }); }}
              style={{ flex: 1, minWidth: 160 }}
            />
            <input
              className="adm-input"
              inputMode="numeric"
              value={additional}
              onChange={(e) => setAdditional(e.target.value)}
              onBlur={() => commitMoney(additional, 'additionalCents')}
              style={{ width: 140, textAlign: 'right' }}
            />
          </div>
        </div>

        {/* Totals */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 28, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.07)', flexWrap: 'wrap' }}>
          <Total label={t('amount_spent')} value={formatSum(spent)} color="#fbbf24" />
          <Total label={t('remaining')} value={formatSum(remaining)} color={remaining < 0 ? '#f87171' : '#4ade80'} />
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
  const [amount, setAmount] = useState(formatSumInput(product.amountCents));
  useEffect(() => {
    setName(product.name); setQty(String(product.quantity)); setUnit(product.unit); setAmount(formatSumInput(product.amountCents));
  }, [product.name, product.quantity, product.unit, product.amountCents]);

  const update = useMutation({
    mutationFn: (patch: Partial<{ name: string; quantity: number; unit: string; amountCents: number }>) =>
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
        onBlur={() => { const c = parseSumToTiyin(amount); if (c !== null && c !== product.amountCents) update.mutate({ amountCents: c }); }}
        placeholder={t('amount')} style={{ ...rowInput, width: 130, textAlign: 'right' }} />
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
      name: name.trim(),
      quantity: Number(qty) || 0,
      unit,
      amountCents: parseSumToTiyin(amount) ?? 0,
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
      <input className="adm-input" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={t('amount')} style={{ ...rowInput, width: 130, textAlign: 'right' }} />
      <button type="button" className="adm-btn-ghost" onClick={() => { if (name.trim()) add.mutate(); }} disabled={!name.trim() || add.isPending} style={{ fontSize: 18, lineHeight: 1, padding: '6px 12px' }}>+</button>
    </div>
  );
};

const SalaryRow = ({ salary, t, onChanged }: { salary: SalaryExpense; t: TFn; onChanged: () => void }) => {
  const [name, setName] = useState(salary.name);
  const [amount, setAmount] = useState(formatSumInput(salary.amountCents));
  useEffect(() => { setName(salary.name); setAmount(formatSumInput(salary.amountCents)); }, [salary.name, salary.amountCents]);

  const update = useMutation({
    mutationFn: (patch: Partial<{ name: string; amountCents: number }>) => expenseService.updateSalary(salary.id, patch),
    onSuccess: onChanged,
  });
  const remove = useMutation({ mutationFn: () => expenseService.removeSalary(salary.id), onSuccess: onChanged });

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <input className="adm-input" value={name} onChange={(e) => setName(e.target.value)}
        onBlur={() => { const v = name.trim(); if (v && v !== salary.name) update.mutate({ name: v }); }}
        placeholder={t('employee_name')} style={{ ...rowInput, flex: 2, minWidth: 160 }} />
      <input className="adm-input" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)}
        onBlur={() => { const c = parseSumToTiyin(amount); if (c !== null && c !== salary.amountCents) update.mutate({ amountCents: c }); }}
        placeholder={t('amount')} style={{ ...rowInput, width: 130, textAlign: 'right' }} />
      <button type="button" onClick={() => remove.mutate()} title={t('delete')}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f87171', fontSize: 18, lineHeight: 1, padding: 4 }}>×</button>
    </div>
  );
};

const AddSalaryRow = ({ dayId, t, onAdded }: { dayId: string; t: TFn; onAdded: () => void }) => {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const add = useMutation({
    mutationFn: () => expenseService.addSalary(dayId, { name: name.trim(), amountCents: parseSumToTiyin(amount) ?? 0 }),
    onSuccess: () => { setName(''); setAmount(''); onAdded(); },
  });
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <input className="adm-input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('employee_name')} style={{ ...rowInput, flex: 2, minWidth: 160 }} />
      <input className="adm-input" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={t('amount')} style={{ ...rowInput, width: 130, textAlign: 'right' }} />
      <button type="button" className="adm-btn-ghost" onClick={() => { if (name.trim()) add.mutate(); }} disabled={!name.trim() || add.isPending} style={{ fontSize: 18, lineHeight: 1, padding: '6px 12px' }}>+</button>
    </div>
  );
};
