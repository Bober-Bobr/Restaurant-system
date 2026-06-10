import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { publicRestaurantService, type PublicRestaurantSummary } from '../services/publicRestaurant.service';
import { publicMenuService } from '../services/publicMenu.service';
import { publicHallService } from '../services/publicHall.service';
import { reviewService } from '../services/review.service';
import { useAdminStore } from '../store/admin.store';
import { Locale, locales, translate } from '../utils/translate';
import { toSubdomainSlug } from '../utils/subdomain';
import { getPhotoUrl } from '../utils/photoUrl';
import { formatSum } from '../utils/currency';
import { Lightbox } from '../components/ui/lightbox';
import { useScrollReveal } from '../utils/useScrollReveal';
import type { Hall, MenuItem } from '../types/domain';

type MenuCategory = MenuItem['category'];

// ── Black & white palette tokens ────────────────────────────────────────────
const C = {
  text: '#ffffff',
  textDim: 'rgba(255,255,255,0.62)',
  textFaint: 'rgba(255,255,255,0.4)',
  starOn: '#ffffff',
  starOff: 'rgba(255,255,255,0.22)',
  line: 'rgba(255,255,255,0.12)',
};

const CATEGORY_ORDER: MenuCategory[] = [
  'SOUPS', 'PIZZA', 'COLD_APPETIZERS', 'GRILL', 'PASTRY', 'HOT_APPETIZERS',
  'BEER_SNACKS', 'DESSERT', 'LAMB_DISHES', 'BEEF_DISHES', 'CHICKEN_DISHES',
  'SIDE_DISHES', 'PASTA', 'SOFT_DRINKS', 'STEAKS', 'ENERGY_DRINKS',
  'SALADS_OIL', 'SALADS_MAYO', 'COFFEE', 'SUSHI_ROLLS', 'DRIED_FRUITS', 'CANDIES',
  'FIRST_COURSE', 'SECOND_COURSE', 'THIRD_COURSE', 'DRINKS', 'SWEETS', 'FRUITS',
];
const CATEGORY_LABEL_KEY: Record<MenuCategory, Parameters<typeof translate>[0]> = {
  SOUPS: 'soups',
  PIZZA: 'pizza',
  COLD_APPETIZERS: 'cold_appetizers',
  GRILL: 'grill',
  PASTRY: 'pastry',
  HOT_APPETIZERS: 'hot_appetizers',
  BEER_SNACKS: 'beer_snacks',
  DESSERT: 'dessert',
  LAMB_DISHES: 'lamb_dishes',
  BEEF_DISHES: 'beef_dishes',
  CHICKEN_DISHES: 'chicken_dishes',
  SIDE_DISHES: 'side_dishes',
  PASTA: 'pasta',
  SOFT_DRINKS: 'soft_drinks',
  STEAKS: 'steaks',
  ENERGY_DRINKS: 'energy_drinks',
  SALADS_OIL: 'salads_oil',
  SALADS_MAYO: 'salads_mayo',
  COFFEE: 'coffee',
  SUSHI_ROLLS: 'sushi_rolls',
  DRIED_FRUITS: 'dried_fruits',
  CANDIES: 'candies',
  FIRST_COURSE: 'first_course',
  SECOND_COURSE: 'second_course',
  THIRD_COURSE: 'third_course',
  DRINKS: 'drinks',
  SWEETS: 'sweets',
  FRUITS: 'fruits',
};

// Combine a hall's single photoUrl + photos array into a unique, ordered list.
function hallPhotoList(hall: Hall): string[] {
  const all = [hall.photoUrl, ...(hall.photos ?? [])].filter((p): p is string => !!p);
  return Array.from(new Set(all));
}

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
  const bg = restaurant?.backgroundImageUrl ? getPhotoUrl(restaurant.backgroundImageUrl) : null;
  const revealRef = useScrollReveal<HTMLElement>();

  const navLink: React.CSSProperties = {
    padding: '8px 14px', borderRadius: 10, fontSize: 14, fontWeight: 600,
    textDecoration: 'none', color: 'rgba(255,255,255,0.78)', whiteSpace: 'nowrap',
  };

  return (
    <div className="cs-root" style={{ minHeight: '100vh', position: 'relative', background: '#0a0a0a', color: C.text }}>
      {/* Full-site background photo (grayscale, dimmed) */}
      {bg && (
        <>
          <div style={{
            position: 'fixed', inset: 0, zIndex: 0,
            backgroundImage: `url(${bg})`, backgroundSize: 'cover', backgroundPosition: 'center',
            filter: 'grayscale(100%)',
          }} />
          <div style={{ position: 'fixed', inset: 0, zIndex: 0, background: 'rgba(0,0,0,0.72)' }} />
        </>
      )}

      <div style={{ position: 'relative', zIndex: 1 }}>
        <header style={{
          position: 'sticky', top: 0, zIndex: 20,
          background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(16px)',
          borderBottom: `1px solid ${C.line}`,
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
              <Link to="/halls" style={navLink}>{t('halls')}</Link>
              <Link to="/reviews" style={navLink}>{t('reviews')}</Link>
              <Link to="/about" style={navLink}>{t('about_us')}</Link>
              <Link to="/contact" style={navLink}>{t('contact_us')}</Link>
            </nav>

            <div style={{ display: 'flex', gap: 4 }}>
              {locales.map((loc) => (
                <button key={loc} type="button" onClick={() => setLocale(loc)}
                  style={{
                    padding: '5px 9px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    textTransform: 'uppercase', letterSpacing: '0.05em',
                    border: '1px solid', borderColor: locale === loc ? 'rgba(255,255,255,0.85)' : C.line,
                    background: locale === loc ? '#fff' : 'rgba(255,255,255,0.04)',
                    color: locale === loc ? '#000' : C.textDim,
                  }}>
                  {loc}
                </button>
              ))}
            </div>
          </div>
        </header>

        <main ref={revealRef} style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px 48px' }}>
          {children}
        </main>
      </div>

      {/* Scope: keep inputs/focus monochrome within the catering site */}
      <style>{`
        .cs-root .rg-input:focus { border-color: rgba(255,255,255,0.55); }
      `}</style>
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
      <p style={{ margin: '0 0 22px', color: C.textDim, fontSize: 14 }}>{t('browse_menu_items')}</p>

      {categories.length === 0 && (
        <p style={{ color: C.textFaint }}>{t('no_dishes_in_category')}</p>
      )}

      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
        {categories.map(({ cat, items }) => {
          const cover = items.find((i) => i.photoUrl)?.photoUrl;
          const coverSrc = cover ? getPhotoUrl(cover) : null;
          return (
            <Link key={cat} to={`/category/${cat}`} className="rg-card reveal"
              style={{ overflow: 'hidden', textDecoration: 'none', display: 'flex', flexDirection: 'column' }}>
              <div style={{ position: 'relative', height: 150, background: 'rgba(0,0,0,0.3)' }}>
                {coverSrc
                  ? <img src={coverSrc ?? undefined} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.95 }} />
                  : <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,255,255,0.03))' }} />}
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.6), transparent)' }} />
                <span style={{ position: 'absolute', right: 12, top: 12, background: '#fff', color: '#000', borderRadius: 999, padding: '3px 10px', fontSize: 12, fontWeight: 700 }}>
                  {items.length}
                </span>
              </div>
              <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 17, fontWeight: 700, color: '#fff' }}>{t(CATEGORY_LABEL_KEY[cat])}</span>
                <span style={{ color: '#fff', fontSize: 18 }}>→</span>
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
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  return (
    <>
      <Link to="/" style={{ fontSize: 13, color: C.textDim, textDecoration: 'none' }}>← {t('back_to_menu')}</Link>
      <h1 style={{ margin: '10px 0 20px', fontSize: 26, fontWeight: 800, color: '#fff' }}>
        {labelKey ? t(labelKey) : category}
      </h1>

      {items.length === 0 ? (
        <p style={{ color: C.textFaint }}>{t('no_dishes_in_category')}</p>
      ) : (
        <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
          {items.map((item) => {
            const src = item.photoUrl ? getPhotoUrl(item.photoUrl) : null;
            return (
              <div key={item.id} className="rg-card reveal" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {src
                  ? <button type="button" onClick={() => setLightboxSrc(src)}
                      style={{ display: 'block', width: '100%', padding: 0, border: 'none', background: 'none', cursor: 'zoom-in' }}>
                      <img src={src} alt={item.name} style={{ width: '100%', height: 170, objectFit: 'cover', display: 'block' }} />
                    </button>
                  : <div style={{ width: '100%', height: 170, background: 'rgba(0,0,0,0.25)' }} />}
                <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#fff' }}>{item.name}</h3>
                    <span style={{ color: '#fff', fontWeight: 700, whiteSpace: 'nowrap' }}>{formatSum(item.priceCents)}</span>
                  </div>
                  {item.description && (
                    <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: C.textDim }}>{item.description}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {lightboxSrc && <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
    </>
  );
}

// ── About / Contact ─────────────────────────────────────────────────────────
function AboutPage({ restaurant, locale }: { restaurant?: PublicRestaurantSummary; locale: Locale }) {
  const t = (k: Parameters<typeof translate>[0]) => translate(k, locale);
  const logo = restaurant?.logoUrl ? getPhotoUrl(restaurant.logoUrl) : null;
  const history = restaurant?.history?.trim();
  return (
    <div className="rg-card reveal" style={{ padding: 28, textAlign: 'center', maxWidth: 680, margin: '0 auto' }}>
      {logo && <img src={logo ?? undefined} alt="" style={{ maxHeight: 120, maxWidth: '70%', objectFit: 'contain', margin: '0 auto 18px', display: 'block' }} />}
      <h1 style={{ margin: '0 0 6px', fontSize: 26, fontWeight: 800, color: '#fff' }}>{restaurant?.name ?? ''}</h1>
      <h2 className="rg-label" style={{ margin: '0 0 16px' }}>{history ? t('our_history') : t('about_us')}</h2>
      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.7, color: 'rgba(255,255,255,0.82)', whiteSpace: 'pre-wrap', textAlign: history ? 'left' : 'center' }}>
        {history || t('catering_welcome')}
      </p>
      {restaurant?.address && (
        <p style={{ margin: '18px 0 0', fontSize: 14, color: C.textDim }}>
          {t('address_label')}: {restaurant.address}
        </p>
      )}
    </div>
  );
}

// ── Halls ───────────────────────────────────────────────────────────────────
function HallsPage({ restaurantId, locale }: { restaurantId: string; locale: Locale }) {
  const t = (k: Parameters<typeof translate>[0]) => translate(k, locale);
  const { data: halls = [], isLoading } = useQuery({
    queryKey: ['catering-halls', restaurantId],
    queryFn: () => publicHallService.listActive(restaurantId),
  });

  return (
    <>
      <h1 style={{ margin: '0 0 22px', fontSize: 28, fontWeight: 800, color: '#fff' }}>{t('halls')}</h1>
      {isLoading && <p style={{ color: C.textFaint }}>...</p>}
      {!isLoading && halls.length === 0 && <p style={{ color: C.textFaint }}>—</p>}
      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
        {halls.map((h: Hall) => {
          const photos = hallPhotoList(h);
          const src = photos[0] ? getPhotoUrl(photos[0]) : null;
          return (
            <Link key={h.id} to={`/halls/${h.id}`} className="rg-card reveal"
              style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', textDecoration: 'none' }}>
              <div style={{ position: 'relative' }}>
                {src
                  ? <img src={src ?? undefined} alt={h.name} style={{ width: '100%', height: 180, objectFit: 'cover' }} />
                  : <div style={{ width: '100%', height: 180, background: 'rgba(0,0,0,0.25)' }} />}
                {photos.length > 1 && (
                  <span style={{ position: 'absolute', right: 10, bottom: 10, background: 'rgba(0,0,0,0.65)', color: '#fff', borderRadius: 999, padding: '2px 9px', fontSize: 12, fontWeight: 600 }}>
                    {photos.length} 🖼
                  </span>
                )}
              </div>
              <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#fff' }}>{h.name}</h3>
                  <span style={{ color: C.textDim, fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap' }}>{h.capacity} {t('seats')}</span>
                </div>
                {h.description && <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: C.textDim, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{h.description}</p>}
                <span style={{ marginTop: 4, fontSize: 13, fontWeight: 600, color: '#fff' }}>{t('view_hall')} →</span>
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}

// ── Hall detail (info + photo gallery) ──────────────────────────────────────
function HallDetail({ restaurantId, locale }: { restaurantId: string; locale: Locale }) {
  const { hallId = '' } = useParams();
  const t = (k: Parameters<typeof translate>[0]) => translate(k, locale);
  const [lightbox, setLightbox] = useState<number | null>(null);

  const { data: halls = [], isLoading } = useQuery({
    queryKey: ['catering-halls', restaurantId],
    queryFn: () => publicHallService.listActive(restaurantId),
  });

  const hall = halls.find((h: Hall) => h.id === hallId);
  const photos = hall ? hallPhotoList(hall) : [];

  if (isLoading) return <p style={{ color: C.textFaint }}>...</p>;
  if (!hall) {
    return (
      <>
        <Link to="/halls" style={{ fontSize: 13, color: C.textDim, textDecoration: 'none' }}>← {t('back_to_halls')}</Link>
        <p style={{ color: C.textFaint, marginTop: 16 }}>—</p>
      </>
    );
  }

  return (
    <>
      <Link to="/halls" style={{ fontSize: 13, color: C.textDim, textDecoration: 'none' }}>← {t('back_to_halls')}</Link>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', margin: '10px 0 18px' }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: '#fff' }}>{hall.name}</h1>
        <span style={{ color: C.textDim, fontSize: 15, fontWeight: 600 }}>{hall.capacity} {t('seats')}</span>
      </div>

      {hall.description && (
        <div className="rg-card reveal" style={{ padding: 20, marginBottom: 20 }}>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.7, color: 'rgba(255,255,255,0.85)', whiteSpace: 'pre-wrap' }}>{hall.description}</p>
        </div>
      )}

      {photos.length > 0 && (
        <>
          <h2 className="rg-label" style={{ margin: '0 0 12px' }}>{t('hall_gallery')}</h2>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
            {photos.map((p, i) => {
              const src = getPhotoUrl(p);
              return (
                <button key={p} type="button" onClick={() => setLightbox(i)} className="rg-card reveal"
                  style={{ overflow: 'hidden', padding: 0, border: 'none', cursor: 'pointer', background: 'rgba(0,0,0,0.25)' }}>
                  <img src={src ?? undefined} alt={`${hall.name} ${i + 1}`} style={{ width: '100%', height: 180, objectFit: 'cover', display: 'block' }} />
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Lightbox */}
      {lightbox !== null && photos[lightbox] && (
        <div
          onClick={() => setLightbox(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
        >
          <button type="button" onClick={() => setLightbox(null)}
            style={{ position: 'absolute', top: 18, right: 18, width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.12)', color: '#fff', border: 'none', fontSize: 22, cursor: 'pointer' }}>×</button>
          {photos.length > 1 && (
            <button type="button" onClick={(e) => { e.stopPropagation(); setLightbox((lightbox - 1 + photos.length) % photos.length); }}
              style={navArrow('left')}>‹</button>
          )}
          <img src={getPhotoUrl(photos[lightbox]) ?? undefined} alt="" onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '90%', maxHeight: '88vh', objectFit: 'contain', borderRadius: 8 }} />
          {photos.length > 1 && (
            <button type="button" onClick={(e) => { e.stopPropagation(); setLightbox((lightbox + 1) % photos.length); }}
              style={navArrow('right')}>›</button>
          )}
        </div>
      )}
    </>
  );
}

function navArrow(side: 'left' | 'right'): React.CSSProperties {
  return {
    position: 'absolute', [side]: 18, top: '50%', transform: 'translateY(-50%)',
    width: 48, height: 48, borderRadius: '50%', background: 'rgba(255,255,255,0.12)',
    color: '#fff', border: 'none', fontSize: 30, lineHeight: 1, cursor: 'pointer',
  };
}

// ── Reviews (approved, public) ──────────────────────────────────────────────
function StarRow({ rating }: { rating: number }) {
  return (
    <span style={{ color: C.starOn, letterSpacing: 1, fontSize: 15 }}>
      {'★'.repeat(rating)}<span style={{ color: C.starOff }}>{'★'.repeat(5 - rating)}</span>
    </span>
  );
}

function ReviewsPage({ restaurantId, locale }: { restaurantId: string; locale: Locale }) {
  const t = (k: Parameters<typeof translate>[0]) => translate(k, locale);
  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ['catering-reviews', restaurantId],
    queryFn: () => reviewService.listApproved(restaurantId),
  });

  return (
    <>
      <h1 style={{ margin: '0 0 22px', fontSize: 28, fontWeight: 800, color: '#fff' }}>{t('reviews')}</h1>
      {isLoading && <p style={{ color: C.textFaint }}>...</p>}
      {!isLoading && reviews.length === 0 && <p style={{ color: C.textFaint }}>{t('no_reviews_yet')}</p>}
      <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
        {reviews.map((rev) => (
          <div key={rev.id} className="rg-card reveal" style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <span style={{ fontWeight: 700, color: '#fff', fontSize: 15 }}>{rev.authorName}</span>
              <StarRow rating={rev.rating} />
            </div>
            {rev.text && <p style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.6, color: 'rgba(255,255,255,0.78)' }}>{rev.text}</p>}
          </div>
        ))}
      </div>
    </>
  );
}

function ContactRow({ icon, label, value, href }: { icon: string; label: string; value: string; href?: string }) {
  const inner = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.05)', border: `1px solid ${C.line}` }}>
      <span style={{ color: '#fff', fontSize: 20 }}>{icon}</span>
      <div style={{ minWidth: 0 }}>
        <p className="rg-label" style={{ margin: 0 }}>{label}</p>
        <p style={{ margin: '2px 0 0', color: '#fff', fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</p>
      </div>
    </div>
  );
  return href ? <a href={href} style={{ textDecoration: 'none' }}>{inner}</a> : inner;
}

function ContactPage({ restaurant, locale }: { restaurant?: PublicRestaurantSummary; locale: Locale }) {
  const t = (k: Parameters<typeof translate>[0]) => translate(k, locale);
  const address = restaurant?.address?.trim();
  const phone = restaurant?.phone?.trim();
  const email = restaurant?.email?.trim();
  const mapUrl = address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : null;

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="rg-card reveal" style={{ padding: 28 }}>
        <h1 style={{ margin: '0 0 18px', fontSize: 26, fontWeight: 800, color: '#fff', textAlign: 'center' }}>{t('contact_us')}</h1>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {address && <ContactRow icon="📍" label={t('address_label')} value={address} href={mapUrl ?? undefined} />}
          {phone && <ContactRow icon="📞" label={t('phone')} value={phone} href={`tel:${phone}`} />}
          {email && <ContactRow icon="✉️" label={t('email')} value={email} href={`mailto:${email}`} />}
          {!address && !phone && !email && <p style={{ color: C.textFaint, textAlign: 'center' }}>—</p>}
        </div>
      </div>

      {restaurant && <ReviewForm restaurantId={restaurant.id} locale={locale} />}
    </div>
  );
}

// ── Review submission form ──────────────────────────────────────────────────
function ReviewForm({ restaurantId, locale }: { restaurantId: string; locale: Locale }) {
  const t = (k: Parameters<typeof translate>[0]) => translate(k, locale);
  const [name, setName] = useState('');
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [text, setText] = useState('');

  const submit = useMutation({
    mutationFn: () => reviewService.submit({ restaurantId, authorName: name.trim(), rating, text: text.trim() || undefined }),
  });

  const canSubmit = name.trim().length > 0 && rating >= 1 && rating <= 5 && !submit.isPending;

  if (submit.isSuccess) {
    return (
      <div className="rg-card reveal" style={{ padding: 28, textAlign: 'center' }}>
        <div style={{ fontSize: 40 }}>✓</div>
        <p style={{ margin: '8px 0 0', color: '#fff', fontSize: 15 }}>{t('review_thanks')}</p>
      </div>
    );
  }

  return (
    <div className="rg-card reveal" style={{ padding: 24 }}>
      <h2 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700, color: '#fff' }}>{t('leave_a_review')}</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label style={{ display: 'grid', gap: 5 }}>
          <span className="rg-label">{t('your_name')}</span>
          <input className="rg-input" value={name} onChange={(e) => setName(e.target.value)} />
        </label>

        <div style={{ display: 'grid', gap: 5 }}>
          <span className="rg-label">{t('your_rating')}</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button"
                onClick={() => setRating(n)}
                onMouseEnter={() => setHover(n)}
                onMouseLeave={() => setHover(0)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                  fontSize: 32, lineHeight: 1,
                  color: n <= (hover || rating) ? C.starOn : C.starOff,
                  transition: 'color 0.12s, transform 0.12s',
                  transform: n <= (hover || rating) ? 'scale(1.08)' : 'scale(1)',
                }}
                aria-label={`${n} stars`}
              >★</button>
            ))}
          </div>
        </div>

        <label style={{ display: 'grid', gap: 5 }}>
          <span className="rg-label">{t('your_review')}</span>
          <textarea className="rg-input" value={text} onChange={(e) => setText(e.target.value)} style={{ minHeight: 96, resize: 'vertical' }} />
        </label>

        <button type="button" disabled={!canSubmit} onClick={() => submit.mutate()}
          style={{
            marginTop: 4, padding: '12px', borderRadius: 12, border: 'none',
            background: canSubmit ? '#fff' : 'rgba(255,255,255,0.35)',
            color: '#000', fontWeight: 700, fontSize: 15, cursor: canSubmit ? 'pointer' : 'not-allowed',
          }}>
          {submit.isPending ? '...' : t('submit_review')}
        </button>
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
      <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.7)' }}>
        Restaurant not found
      </div>
    );
  }

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.6)' }}>
        ...
      </div>
    );
  }

  return (
    <CateringLayout restaurant={restaurant} locale={locale} setLocale={setLocale}>
      <Routes>
        <Route path="/" element={<MenuBlocks menuItems={menuItems} locale={locale} />} />
        <Route path="/category/:category" element={<CategoryDetail menuItems={menuItems} locale={locale} />} />
        <Route path="/halls" element={<HallsPage restaurantId={restaurant!.id} locale={locale} />} />
        <Route path="/halls/:hallId" element={<HallDetail restaurantId={restaurant!.id} locale={locale} />} />
        <Route path="/reviews" element={<ReviewsPage restaurantId={restaurant!.id} locale={locale} />} />
        <Route path="/about" element={<AboutPage restaurant={restaurant} locale={locale} />} />
        <Route path="/contact" element={<ContactPage restaurant={restaurant} locale={locale} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </CateringLayout>
  );
};
