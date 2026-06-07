import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { publicRestaurantService, type PublicRestaurantSummary } from '../services/publicRestaurant.service';
import { publicMenuService } from '../services/publicMenu.service';
import { useAdminStore } from '../store/admin.store';
import { Locale, locales, translate } from '../utils/translate';
import { toSubdomainSlug } from '../utils/subdomain';
import { getPhotoUrl } from '../utils/photoUrl';
import { formatSum } from '../utils/currency';
import type { MenuItem } from '../types/domain';

type MenuCategory = MenuItem['category'];

const CATEGORY_ORDER: MenuCategory[] = [
  'COLD_APPETIZERS', 'HOT_APPETIZERS', 'SALADS', 'FIRST_COURSE', 'SECOND_COURSE', 'DRINKS', 'SWEETS', 'FRUITS',
];
const CATEGORY_LABEL_KEY: Record<MenuCategory, Parameters<typeof translate>[0]> = {
  COLD_APPETIZERS: 'cold_appetizers',
  HOT_APPETIZERS: 'hot_appetizers',
  SALADS: 'salads',
  FIRST_COURSE: 'first_course',
  SECOND_COURSE: 'second_course',
  DRINKS: 'drinks',
  SWEETS: 'sweets',
  FRUITS: 'fruits',
};

// ── Shared data hook ────────────────────────────────────────────────────────
function useCateringData(slug: string) {
  const restaurantsQuery = useQuery({
    queryKey: ['catering-restaurants'],
    queryFn: () => publicRestaurantService.listAll(),
  });

  const restaurant: PublicRestaurantSummary | undefined = useMemo(
    () => (restaurantsQuery.data ?? []).find((r) => toSubdomainSlug(r.name) === slug),
    [restaurantsQuery.data, slug]
  );

  const menuQuery = useQuery({
    queryKey: ['catering-menu', restaurant?.id],
    queryFn: () => publicMenuService.listActive(restaurant!.id),
    enabled: !!restaurant?.id,
  });

  return {
    restaurant,
    menuItems: menuQuery.data ?? [],
    isLoading: restaurantsQuery.isLoading || (!!restaurant && menuQuery.isLoading),
    notFound: !restaurantsQuery.isLoading && !restaurant,
  };
}

// ── Layout ──────────────────────────────────────────────────────────────────
function CateringLayout({
  restaurant, locale, setLocale, children,
}: {
  restaurant?: PublicRestaurantSummary;
  locale: Locale;
  setLocale: (l: Locale) => void;
  children: React.ReactNode;
}) {
  const t = (k: Parameters<typeof translate>[0]) => translate(k, locale);
  const logo = restaurant?.logoUrl ? getPhotoUrl(restaurant.logoUrl) : null;

  const navLink: React.CSSProperties = {
    padding: '8px 14px', borderRadius: 10, fontSize: 14, fontWeight: 600,
    textDecoration: 'none', color: 'rgba(255,255,255,0.8)', whiteSpace: 'nowrap',
  };

  return (
    <div className="rg-bg" style={{ minHeight: '100vh' }}>
      <header style={{
        position: 'sticky', top: 0, zIndex: 20,
        background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', minWidth: 0 }}>
            {logo
              ? <img src={logo ?? undefined} alt={restaurant?.name ?? ''} style={{ height: 44, width: 'auto', objectFit: 'contain', flexShrink: 0 }} />
              : null}
            <span style={{ fontSize: 16, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {restaurant?.name ?? ''}
            </span>
          </Link>

          <nav style={{ display: 'flex', gap: 4, marginLeft: 'auto', flexWrap: 'wrap' }}>
            <Link to="/" style={navLink}>{t('menu')}</Link>
            <Link to="/about" style={navLink}>{t('about_us')}</Link>
            <Link to="/contact" style={navLink}>{t('contact_us')}</Link>
          </nav>

          <div style={{ display: 'flex', gap: 4 }}>
            {locales.map((loc) => (
              <button key={loc} type="button" onClick={() => setLocale(loc)}
                style={{
                  padding: '5px 9px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                  border: '1px solid', borderColor: locale === loc ? 'rgba(201,164,44,0.6)' : 'rgba(255,255,255,0.12)',
                  background: locale === loc ? 'rgba(201,164,44,0.18)' : 'rgba(255,255,255,0.04)',
                  color: locale === loc ? '#c9a42c' : 'rgba(255,255,255,0.65)',
                }}>
                {loc}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px 48px' }}>
        {children}
      </main>
    </div>
  );
}

// ── Menu page (category blocks) ─────────────────────────────────────────────
function MenuBlocks({ menuItems, locale }: { menuItems: MenuItem[]; locale: Locale }) {
  const t = (k: Parameters<typeof translate>[0]) => translate(k, locale);
  const categories = CATEGORY_ORDER
    .map((cat) => ({
      cat,
      items: menuItems.filter((m) => m.category === cat && m.isActive),
    }))
    .filter((c) => c.items.length > 0);

  return (
    <>
      <h1 style={{ margin: '0 0 6px', fontSize: 28, fontWeight: 800, color: '#fff' }}>{t('our_menu')}</h1>
      <p style={{ margin: '0 0 22px', color: 'rgba(255,255,255,0.55)', fontSize: 14 }}>{t('browse_menu_items')}</p>

      {categories.length === 0 && (
        <p style={{ color: 'rgba(255,255,255,0.5)' }}>{t('no_dishes_in_category')}</p>
      )}

      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
        {categories.map(({ cat, items }) => {
          const cover = items.find((i) => i.photoUrl)?.photoUrl;
          const coverSrc = cover ? getPhotoUrl(cover) : null;
          return (
            <Link key={cat} to={`/category/${cat}`} className="rg-card tablet-fade-up"
              style={{ overflow: 'hidden', textDecoration: 'none', display: 'flex', flexDirection: 'column' }}>
              <div style={{ position: 'relative', height: 150, background: 'rgba(0,0,0,0.3)' }}>
                {coverSrc
                  ? <img src={coverSrc ?? undefined} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.92 }} />
                  : <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, rgba(201,164,44,0.18), rgba(60,110,50,0.25))' }} />}
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.6), transparent)' }} />
                <span style={{ position: 'absolute', right: 12, top: 12, background: 'rgba(201,164,44,0.95)', color: '#1a3320', borderRadius: 999, padding: '3px 10px', fontSize: 12, fontWeight: 700 }}>
                  {items.length}
                </span>
              </div>
              <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 17, fontWeight: 700, color: '#fff' }}>{t(CATEGORY_LABEL_KEY[cat])}</span>
                <span style={{ color: '#c9a42c', fontSize: 18 }}>→</span>
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}

// ── Category detail ─────────────────────────────────────────────────────────
function CategoryDetail({ menuItems, locale }: { menuItems: MenuItem[]; locale: Locale }) {
  const { category = '' } = useParams();
  const t = (k: Parameters<typeof translate>[0]) => translate(k, locale);
  const cat = category as MenuCategory;
  const items = menuItems.filter((m) => m.category === cat && m.isActive);
  const labelKey = CATEGORY_LABEL_KEY[cat];

  return (
    <>
      <Link to="/" style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', textDecoration: 'none' }}>← {t('back_to_menu')}</Link>
      <h1 style={{ margin: '10px 0 20px', fontSize: 26, fontWeight: 800, color: '#fff' }}>
        {labelKey ? t(labelKey) : category}
      </h1>

      {items.length === 0 ? (
        <p style={{ color: 'rgba(255,255,255,0.5)' }}>{t('no_dishes_in_category')}</p>
      ) : (
        <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
          {items.map((item) => {
            const src = item.photoUrl ? getPhotoUrl(item.photoUrl) : null;
            return (
              <div key={item.id} className="rg-card tablet-fade-up" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {src
                  ? <img src={src ?? undefined} alt={item.name} style={{ width: '100%', height: 170, objectFit: 'cover' }} />
                  : <div style={{ width: '100%', height: 170, background: 'rgba(0,0,0,0.25)' }} />}
                <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#fff' }}>{item.name}</h3>
                    <span style={{ color: '#c9a42c', fontWeight: 700, whiteSpace: 'nowrap' }}>{formatSum(item.priceCents)}</span>
                  </div>
                  {item.description && (
                    <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: 'rgba(255,255,255,0.6)' }}>{item.description}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

// ── About / Contact ─────────────────────────────────────────────────────────
function AboutPage({ restaurant, locale }: { restaurant?: PublicRestaurantSummary; locale: Locale }) {
  const t = (k: Parameters<typeof translate>[0]) => translate(k, locale);
  const logo = restaurant?.logoUrl ? getPhotoUrl(restaurant.logoUrl) : null;
  return (
    <div className="rg-card tablet-fade-up" style={{ padding: 28, textAlign: 'center', maxWidth: 640, margin: '0 auto' }}>
      {logo && <img src={logo ?? undefined} alt="" style={{ maxHeight: 120, maxWidth: '70%', objectFit: 'contain', margin: '0 auto 18px', display: 'block' }} />}
      <h1 style={{ margin: '0 0 6px', fontSize: 26, fontWeight: 800, color: '#c9a42c' }}>{restaurant?.name ?? ''}</h1>
      <h2 className="rg-label" style={{ margin: '0 0 16px' }}>{t('about_us')}</h2>
      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: 'rgba(255,255,255,0.8)' }}>{t('catering_welcome')}</p>
      {restaurant?.address && (
        <p style={{ margin: '18px 0 0', fontSize: 14, color: 'rgba(255,255,255,0.6)' }}>
          {t('address_label')}: {restaurant.address}
        </p>
      )}
    </div>
  );
}

function ContactPage({ restaurant, locale }: { restaurant?: PublicRestaurantSummary; locale: Locale }) {
  const t = (k: Parameters<typeof translate>[0]) => translate(k, locale);
  const address = restaurant?.address?.trim();
  const mapUrl = address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : null;
  return (
    <div className="rg-card tablet-fade-up" style={{ padding: 28, maxWidth: 560, margin: '0 auto' }}>
      <h1 style={{ margin: '0 0 18px', fontSize: 26, fontWeight: 800, color: '#fff', textAlign: 'center' }}>{t('contact_us')}</h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <span style={{ color: '#c9a42c', fontSize: 20 }}>📍</span>
          <div>
            <p className="rg-label" style={{ margin: 0 }}>{t('address_label')}</p>
            <p style={{ margin: '2px 0 0', color: '#fff', fontSize: 15 }}>{address || '—'}</p>
          </div>
        </div>
        {mapUrl && (
          <a href={mapUrl} target="_blank" rel="noreferrer"
            className="tablet-fade-up"
            style={{ textAlign: 'center', padding: '12px', borderRadius: 12, background: '#c9a42c', color: '#1a3320', fontWeight: 700, textDecoration: 'none' }}>
            {t('address_label')} ↗
          </a>
        )}
      </div>
    </div>
  );
}

// ── Top-level catering app ──────────────────────────────────────────────────
export const CateringSite = ({ slug }: { slug: string }) => {
  const { locale, setLocale } = useAdminStore();
  const { restaurant, menuItems, isLoading, notFound } = useCateringData(slug);

  if (notFound) {
    return (
      <div className="rg-bg" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.7)' }}>
        Restaurant not found
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="rg-bg" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.6)' }}>
        ...
      </div>
    );
  }

  return (
    <CateringLayout restaurant={restaurant} locale={locale} setLocale={setLocale}>
      <Routes>
        <Route path="/" element={<MenuBlocks menuItems={menuItems} locale={locale} />} />
        <Route path="/category/:category" element={<CategoryDetail menuItems={menuItems} locale={locale} />} />
        <Route path="/about" element={<AboutPage restaurant={restaurant} locale={locale} />} />
        <Route path="/contact" element={<ContactPage restaurant={restaurant} locale={locale} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </CateringLayout>
  );
};
