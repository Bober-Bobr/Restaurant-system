import { useNavigate } from 'react-router-dom';
import { DevicesPanel } from '../components/DevicesPanel';
import { useAdminStore } from '../store/admin.store';
import { useAuthStore } from '../store/auth.store';
import { translate } from '../utils/translate';

export const DevicesPage = () => {
  const { locale } = useAdminStore();
  const t = (k: Parameters<typeof translate>[0]) => translate(k, locale);
  const role = useAuthStore((s) => s.role);
  const navigate = useNavigate();

  // MANAGER, OWNER, CHIEF_ADMIN reach this page without a layout wrapper —
  // wrap with the dark background and provide a back button.
  const standalone = role === 'MANAGER' || role === 'OWNER' || role === 'CHIEF_ADMIN';

  const content = (
    <main className="tablet-fade-in" style={{ maxWidth: 820, margin: '0 auto', padding: '28px 20px', position: 'relative', zIndex: 1 }}>
      {standalone && (
        <button
          type="button"
          onClick={() => navigate(-1)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'rgba(226,232,240,0.6)', fontSize: 13, padding: '0 0 16px',
          }}
        >
          ← {t('back')}
        </button>
      )}
      <h1 className="adm-title" style={{ marginBottom: 20 }}>{t('devices_management')}</h1>
      <DevicesPanel locale={locale} />
    </main>
  );

  if (standalone) {
    return <div className="adm-bg">{content}</div>;
  }
  return content;
};
