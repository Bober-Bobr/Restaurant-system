import { useAdminStore } from '../store/admin.store';
import { translate, type TranslationKey } from '../utils/translate';

// Statistics are the second pass of Stage 2: the day/week/month/year graph, the
// GitHub-style activity calendar, and the per-waiter aggregate for the
// restaurant's admin. The tab exists now so the navigation is not a dead end and
// so the route is settled before the views land.
//
// It says what is coming rather than showing an empty chart, because an empty
// chart reads as "you have done nothing" — which for a waiter looking at their
// own numbers is the wrong message entirely.
export const WaiterStatsPage = () => {
  const { locale } = useAdminStore();
  const t = (key: TranslationKey) => translate(key, locale);

  return (
    <div className="adm-card" style={{ padding: 28, textAlign: 'center', display: 'grid', gap: 10 }}>
      <span style={{ fontSize: 34 }}>📊</span>
      <h2 className="adm-heading" style={{ margin: 0 }}>{t('wt_statistics')}</h2>
      <p className="muted-text" style={{ margin: 0, fontSize: 14, lineHeight: 1.6, maxWidth: 380, marginInline: 'auto' }}>
        {t('wt_stats_soon')}
      </p>
    </div>
  );
};
