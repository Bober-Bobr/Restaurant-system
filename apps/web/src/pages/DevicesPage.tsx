import { DevicesPanel } from '../components/DevicesPanel';
import { useAdminStore } from '../store/admin.store';
import { translate } from '../utils/translate';

export const DevicesPage = () => {
  const { locale } = useAdminStore();
  return (
    <main className="tablet-fade-in" style={{ maxWidth: 820, margin: '0 auto', padding: '28px 20px', position: 'relative', zIndex: 1 }}>
      <h1 className="adm-title" style={{ marginBottom: 20 }}>{translate('devices', locale)}</h1>
      <DevicesPanel locale={locale} />
    </main>
  );
};
