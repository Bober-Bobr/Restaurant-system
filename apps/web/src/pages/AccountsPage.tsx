import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { expenseService } from '../services/expense.service';
import { QUERY_KEY, daySpent } from './ExpenseLedgerPage';
import type { ExpenseDay } from '../types/domain';
import { useAdminStore } from '../store/admin.store';
import { translate } from '../utils/translate';
import { formatWholeSum } from '../utils/currency';

export const AccountsPage = () => {
  const { locale } = useAdminStore();
  const t = (key: Parameters<typeof translate>[0], params?: Record<string, string | number>) => translate(key, locale, params);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [exporting, setExporting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: days = [], isLoading, isError } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => expenseService.listDays(),
  });

  const closeDay = useMutation({
    mutationFn: (id: string) => expenseService.closeDay(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const reopenDay = useMutation({
    mutationFn: (id: string) => expenseService.reopenDay(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  // Export the highlighted days: a single day → <date>.pdf; several days → a ZIP
  // of one <date>.pdf per day plus a summary.pdf. Days are not closed.
  const downloadSelection = async () => {
    const chosen: ExpenseDay[] = days
      .filter((d) => selected.has(d.id))
      .sort((a, b) => a.date.localeCompare(b.date));
    if (chosen.length === 0) return;
    setExporting(true);
    try {
      const blob = await expenseService.downloadSelectionPdf(chosen.map((d) => d.id), locale);
      const filename = chosen.length === 1
        ? `${chosen[0].date}.pdf`
        : `ledger-${chosen[0].date}_${chosen[chosen.length - 1].date}.zip`;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setSelected(new Set());
    } catch {
      window.alert(t('download_failed'));
    } finally {
      setExporting(false);
    }
  };

  const fmtDate = (date: string) =>
    new Date(`${date}T00:00:00`).toLocaleDateString(
      locale === 'uz' ? 'uz-UZ' : locale === 'ru' ? 'ru-RU' : 'en-US',
      { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }
    );

  return (
    <main className="tablet-fade-in" style={{ maxWidth: 1000, margin: '0 auto', padding: '28px 20px', position: 'relative', zIndex: 1 }}>
      <h1 className="adm-title" style={{ marginBottom: 6 }}>{t('accounts')}</h1>
      <p style={{ color: 'rgba(226,232,240,0.55)', fontSize: 13, marginTop: 0, marginBottom: 20 }}>
        {t('accounts_help')}
      </p>

      {/* Selection action bar — highlight days and export them as separate files */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <button type="button" className="adm-btn-primary" onClick={downloadSelection}
          disabled={selected.size === 0 || exporting} style={{ opacity: selected.size === 0 ? 0.5 : 1 }}>
          {exporting ? t('loading') : `📄 ${t('download_selected')}${selected.size ? ` (${selected.size})` : ''}`}
        </button>
        {selected.size > 0 && (
          <button type="button" className="adm-btn-ghost" onClick={() => setSelected(new Set())} style={{ fontSize: 13 }}>
            {t('clear_selection')}
          </button>
        )}
      </div>

      {isLoading && <p style={{ color: 'rgba(226,232,240,0.55)' }}>{t('loading')}</p>}
      {isError && <p style={{ color: '#fca5a5' }}>{t('something_went_wrong')}</p>}
      {!isLoading && days.length === 0 && <p style={{ color: 'rgba(226,232,240,0.55)' }}>{t('no_days_yet')}</p>}

      {days.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {days.map((day) => {
            const spent = daySpent(day);
            const balance = day.allocatedSum - spent;
            const isSelected = selected.has(day.id);
            return (
              <div key={day.id} className="adm-card tablet-fade-up"
                style={{
                  padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
                  border: isSelected ? '1px solid rgba(201,164,44,0.6)' : undefined,
                  background: isSelected ? 'rgba(201,164,44,0.08)' : undefined,
                }}>
                <div style={{ width: 22, display: 'flex', justifyContent: 'center' }}>
                  <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(day.id)}
                    style={{ width: 18, height: 18, accentColor: '#c9a42c', cursor: 'pointer' }} />
                </div>

                <div style={{ minWidth: 150 }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#f8fafc', textTransform: 'capitalize' }}>{fmtDate(day.date)}</p>
                  {day.isClosed && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('closed_label')}</span>
                  )}
                </div>

                <Stat label={t('allocated_funds')} value={formatWholeSum(day.allocatedSum)} />
                <Stat label={t('amount_spent')} value={formatWholeSum(spent)} color="#fbbf24" />
                <Stat label={t('remaining')} value={formatWholeSum(balance)} color={balance < 0 ? '#f87171' : '#4ade80'} />

                <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                  <button type="button" className="adm-btn-ghost"
                    onClick={() => navigate(`/ledger?day=${day.id}`)}
                    style={{ fontSize: 13 }}>
                    {t('go_to_ledger')}
                  </button>
                  {day.isClosed ? (
                    <button type="button" className="adm-btn-ghost"
                      onClick={() => { if (window.confirm(t('reopen_day_confirm'))) reopenDay.mutate(day.id); }}
                      disabled={reopenDay.isPending}
                      style={{ fontSize: 13 }}>
                      {t('reopen_day')}
                    </button>
                  ) : (
                    <button type="button" className="adm-btn-ghost"
                      onClick={() => { if (window.confirm(t('close_day_confirm'))) closeDay.mutate(day.id); }}
                      disabled={closeDay.isPending}
                      style={{ fontSize: 13 }}>
                      {t('close_day')}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
};

const Stat = ({ label, value, color }: { label: string; value: string; color?: string }) => (
  <div style={{ minWidth: 110 }}>
    <p style={{ margin: 0, fontSize: 10, fontWeight: 600, color: 'rgba(226,232,240,0.5)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</p>
    <p style={{ margin: '2px 0 0', fontSize: 14, fontWeight: 700, color: color ?? '#e2e8f0' }}>{value}</p>
  </div>
);
