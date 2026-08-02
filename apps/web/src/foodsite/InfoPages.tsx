import { getPhotoUrl } from '../utils/photoUrl';
import type { PublicRestaurantDetail } from '../services/publicRestaurant.service';
import { useT } from './ui';

export function AboutPage({ restaurant }: { restaurant: PublicRestaurantDetail }) {
  const { t } = useT();
  const logo = restaurant.logoUrl ? getPhotoUrl(restaurant.logoUrl) : null;
  const history = restaurant.history?.trim();

  return (
    <div className="fs-card reveal" style={{
      padding: 30, maxWidth: 720, margin: '30px auto 0', textAlign: 'center',
    }}>
      {logo && (
        <img src={logo} alt="" style={{
          maxHeight: 118, maxWidth: '70%', objectFit: 'contain', display: 'block', margin: '0 auto 18px',
        }} />
      )}
      <h1 className="fs-title" style={{ marginBottom: 6 }}>{restaurant.name}</h1>
      <p className="fs-eyebrow" style={{ margin: '0 0 18px' }}>
        {history ? t('our_history') : t('about_us')}
      </p>
      <p className="fs-muted" style={{
        margin: 0, fontSize: 15, lineHeight: 1.72, whiteSpace: 'pre-wrap',
        textAlign: history ? 'left' : 'center',
      }}>
        {history || t('catering_welcome')}
      </p>
      {restaurant.address && (
        <p style={{ margin: '20px 0 0', fontSize: 14, color: 'var(--fs-faint)' }}>
          {t('address_label')}: {restaurant.address}
        </p>
      )}
    </div>
  );
}

function ContactRow({ icon, label, value, href }: { icon: string; label: string; value: string; href?: string }) {
  const inner = (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 13, padding: '14px 16px',
      borderRadius: 13, background: 'var(--fs-surface)', border: '1px solid var(--fs-line)',
    }}>
      <span style={{ fontSize: 19 }}>{icon}</span>
      <div style={{ minWidth: 0 }}>
        <p className="fs-label" style={{ margin: 0 }}>{label}</p>
        <p style={{ margin: '2px 0 0', fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</p>
      </div>
    </div>
  );
  return href
    ? <a href={href} style={{ textDecoration: 'none', color: 'inherit' }}>{inner}</a>
    : inner;
}

export function ContactPage({ restaurant }: { restaurant: PublicRestaurantDetail }) {
  const { t } = useT();
  const address = restaurant.address?.trim();
  const phone = restaurant.phone?.trim();
  const email = restaurant.email?.trim();
  const mapUrl = address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
    : null;

  return (
    <div className="fs-card reveal" style={{ padding: 28, maxWidth: 580, margin: '30px auto 0' }}>
      <h1 className="fs-title" style={{ textAlign: 'center', marginBottom: 20 }}>{t('contact_us')}</h1>
      <div style={{ display: 'grid', gap: 12 }}>
        {address && <ContactRow icon="📍" label={t('address_label')} value={address} href={mapUrl ?? undefined} />}
        {phone && <ContactRow icon="📞" label={t('phone')} value={phone} href={`tel:${phone}`} />}
        {email && <ContactRow icon="✉️" label={t('email')} value={email} href={`mailto:${email}`} />}
        {!address && !phone && !email && <p className="fs-muted" style={{ textAlign: 'center', margin: 0 }}>—</p>}
      </div>
    </div>
  );
}
