import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { expenseService } from '../services/expense.service';
import { QUERY_KEY } from './ExpenseLedgerPage';
import type { DayExtraExpense, ExpenseDay } from '../types/domain';
import { useAdminStore } from '../store/admin.store';
import { translate } from '../utils/translate';
import { formatWholeSum, groupDigits, parseWholeSum } from '../utils/currency';

const MAX_SUM = 1_000_000_000;
const clampSum = (n: number) => Math.max(0, Math.min(MAX_SUM, n));
const extrasTotal = (day: ExpenseDay) => day.extras.reduce((s, e) => s + e.amountSum, 0);

type TFn = (key: Parameters<typeof translate>[0], params?: Record<string, string | number>) => string;
const rowInput: React.CSSProperties = { height: 38 };
const removeBtn: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', color: '#f87171', fontSize: 18, lineHeight: 1, padding: 4 };

export const AdditionalExpensesPage = () => {
  const { locale } = useAdminStore();
  const t: TFn = (key, params) => translate(key, locale, params);
  const [idx, setIdx] = useState(0);

  const { data: days = [], isLoading, isError } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => expenseService.listDays(),
  });

  useEffect(() => {
    if (idx > days.length - 1) setIdx(Math.max(0, days.length - 1));
  }, [days.length, idx]);

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
      <h1 className="adm-title" style={{ marginBottom: 6 }}>{t('additional_expenses')}</h1>
      <p style={{ color: 'rgba(226,232,240,0.55)', fontSize: 13, marginTop: 0, marginBottom: 20 }}>
        {t('additional_expenses_help')}
      </p>

      {isLoading && <p style={{ color: 'rgba(226,232,240,0.55)' }}>{t('loading')}</p>}
      {isError && <p style={{ color: '#fca5a5' }}>{t('something_went_wrong')}</p>}
      {!isLoading && days.length === 0 && <p style={{ color: 'rgba(226,232,240,0.55)' }}>{t('no_days_yet')}</p>}

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

          <ExtrasCard key={current.id} day={current} t={t} />
        </>
      )}
    </main>
  );
};

const ExtrasCard = ({ day, t }: { day: ExpenseDay; t: TFn }) => {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: QUERY_KEY });
  const total = extrasTotal(day);

  return (
    <section className="adm-card tablet-fade-up" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>{t('additional_expenses')}</h3>
        <span style={{ fontSize: 14, fontWeight: 700, color: total > 0 ? '#fbbf24' : 'rgba(226,232,240,0.5)' }}>{formatWholeSum(total)}</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {day.extras.map((ex) => <ExtraRow key={ex.id} extra={ex} t={t} onChanged={invalidate} />)}
        <AddExtraRow dayId={day.id} t={t} onAdded={invalidate} />
      </div>
    </section>
  );
};

const ExtraRow = ({ extra, t, onChanged }: { extra: DayExtraExpense; t: TFn; onChanged: () => void }) => {
  const [name, setName] = useState(extra.name);
  const [amount, setAmount] = useState(groupDigits(String(extra.amountSum)));
  useEffect(() => { setName(extra.name); setAmount(groupDigits(String(extra.amountSum))); }, [extra.name, extra.amountSum]);

  const update = useMutation({
    mutationFn: (patch: Partial<{ name: string; amountSum: number }>) => expenseService.updateExtra(extra.id, patch),
    onSuccess: onChanged,
  });
  const remove = useMutation({ mutationFn: () => expenseService.removeExtra(extra.id), onSuccess: onChanged });

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <input className="adm-input" value={name} onChange={(e) => setName(e.target.value)}
        onBlur={() => { const v = name.trim(); if (v && v !== extra.name) update.mutate({ name: v }); }}
        placeholder={t('note')} style={{ ...rowInput, flex: 2, minWidth: 160 }} />
      <input className="adm-input" inputMode="numeric" value={amount} onChange={(e) => setAmount(groupDigits(e.target.value))}
        onBlur={() => { const c = parseWholeSum(amount); if (c !== null && clampSum(c) !== extra.amountSum) update.mutate({ amountSum: clampSum(c) }); }}
        placeholder={t('amount')} style={{ ...rowInput, width: 150, textAlign: 'right' }} />
      <button type="button" onClick={() => remove.mutate()} title={t('delete')} style={removeBtn}>×</button>
    </div>
  );
};

const AddExtraRow = ({ dayId, t, onAdded }: { dayId: string; t: TFn; onAdded: () => void }) => {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const add = useMutation({
    mutationFn: () => expenseService.addExtra(dayId, { name: name.trim(), amountSum: clampSum(parseWholeSum(amount) ?? 0) }),
    onSuccess: () => { setName(''); setAmount(''); onAdded(); },
  });
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <input className="adm-input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('note')} style={{ ...rowInput, flex: 2, minWidth: 160 }} />
      <input className="adm-input" inputMode="numeric" value={amount} onChange={(e) => setAmount(groupDigits(e.target.value))} placeholder="—" style={{ ...rowInput, width: 150, textAlign: 'right' }} />
      <button type="button" className="adm-btn-ghost" onClick={() => { if (name.trim()) add.mutate(); }} disabled={!name.trim() || add.isPending} style={{ fontSize: 18, lineHeight: 1, padding: '6px 12px' }}>+</button>
    </div>
  );
};
