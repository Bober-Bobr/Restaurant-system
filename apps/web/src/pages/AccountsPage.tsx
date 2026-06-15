import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { expenseService } from '../services/expense.service';
import { QUERY_KEY, daySpent } from './ExpenseLedgerPage';
import { useAdminStore } from '../store/admin.store';
import { translate } from '../utils/translate';
import { formatWholeSum } from '../utils/currency';

export const AccountsPage = () => {
  const { locale } = useAdminStore();
  const t = (key: Parameters<typeof translate>[0], params?: Record<string, string | number>) => translate(key, locale, params);
  const queryClient = useQueryClient();

  const [daysInput, setDaysInput] = useState('7');
  const [downloading, setDownloading] = useState(false);

  const { data: days = [], isLoading, isError } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => expenseService.listDays(),
  });

  const closeDay = useMutation({
    mutationFn: (id: string) => expenseService.closeDay(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const downloadPdf = async () => {
    const n = Math.max(1, Math.min(366, Math.floor(Number(daysInput) || 1)));
    setDownloading(true);
    try {
      const blob = await expenseService.downloadPdf(n, locale);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `ledger-last-${n}d.pdf`);
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

      {/* PDF download for the last N days (ending at the latest created day) */}
      <section className="adm-card tablet-fade-up" style={{ padding: 16, marginBottom: 24, display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <label style={{ display: 'grid', gap: 6 }}>
          <span className="adm-label">{t('pdf_days_label')}</span>
          <input type="number" min={1} max={366} className="adm-input" value={daysInput}
            onChange={(e) => setDaysInput(e.target.value)} style={{ width: 140 }} />
        </label>
        <button type="button" className="adm-btn-primary" onClick={downloadPdf} disabled={downloading} style={{ height: 42 }}>
          {downloading ? t('loading') : `📄 ${t('download_pdf')}`}
        </button>
        <span style={{ fontSize: 11, color: 'rgba(226,232,240,0.4)', alignSelf: 'center' }}>{t('closed_excluded_note')}</span>
      </section>

      {isLoading && <p style={{ color: 'rgba(226,232,240,0.55)' }}>{t('loading')}</p>}
      {isError && <p style={{ color: '#fca5a5' }}>{t('something_went_wrong')}</p>}
      {!isLoading && days.length === 0 && <p style={{ color: 'rgba(226,232,240,0.55)' }}>{t('no_days_yet')}</p>}

      {days.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {days.map((day) => {
            const spent = daySpent(day);
            const balance = day.allocatedSum - spent;
            return (
              <div key={day.id} className="adm-card tablet-fade-up" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ minWidth: 150 }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#f8fafc', textTransform: 'capitalize' }}>{fmtDate(day.date)}</p>
                  {day.isClosed && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('closed_label')}</span>
                  )}
                </div>

                <Stat label={t('allocated_funds')} value={formatWholeSum(day.allocatedSum)} />
                <Stat label={t('amount_spent')} value={formatWholeSum(spent)} color="#fbbf24" />
                <Stat label={t('remaining')} value={formatWholeSum(balance)} color={balance < 0 ? '#f87171' : '#4ade80'} />

                <div style={{ marginLeft: 'auto' }}>
                  {day.isClosed ? (
                    <span style={{ fontSize: 12, color: 'rgba(226,232,240,0.4)' }}>—</span>
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
