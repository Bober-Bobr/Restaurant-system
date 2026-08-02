import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { locales } from '../utils/translate';
import { getPhotoUrl } from '../utils/photoUrl';
import { useScrollReveal } from '../utils/useScrollReveal';
import { FingerTrail } from '../components/FingerTrail';
import { MusicPlayer } from '../components/MusicPlayer';
import type { PublicRestaurantDetail } from '../services/publicRestaurant.service';
import type { MenuItem } from '../types/domain';
import { accentStyle, resolveAccent } from './theme';
import { useCartLines } from './useCartLines';
import { CartDrawer } from './CartDrawer';
import { Price, useT } from './ui';

const NAV = [
  { to: '/', key: 'menu' },
  { to: '/halls', key: 'halls' },
  { to: '/reviews', key: 'reviews' },
  { to: '/about', key: 'about_us' },
  { to: '/contact', key: 'contact_us' },
] as const;

export function FoodSiteLayout({
  restaurant, menuItems, children,
}: {
  restaurant?: PublicRestaurantDetail;
  menuItems: MenuItem[];
  children: React.ReactNode;
}) {
  const { t, locale, setLocale } = useT();
  const location = useLocation();
  const revealRef = useScrollReveal<HTMLElement>([location.pathname]);
  const { count, subtotal } = useCartLines(menuItems);
  const [cartOpen, setCartOpen] = useState(false);

  const logo = restaurant?.logoUrl ? getPhotoUrl(restaurant.logoUrl) : null;
  const bg = restaurant?.backgroundImageUrl ? getPhotoUrl(restaurant.backgroundImageUrl) : null;
  const { accent } = resolveAccent(restaurant?.tabletAccentColor);

  return (
    <div className="fs-root" style={accentStyle(restaurant?.tabletAccentColor)}>
      <FingerTrail accent={accent} />
      <MusicPlayer src="/catering-music.mp3" accent={accent} />

      {/* Base wash, with or without a photo, so the page is never dead flat and
          foreground cards always have something to sit on. */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0,
        background: 'radial-gradient(130% 85% at 50% -10%, rgb(var(--fs-accent-rgb) / 0.07), transparent 60%)',
      }} />

      {/* The restaurant's own photo, kept in colour — the live site forces it to
          greyscale — but pushed well back: darkened, desaturated and slightly
          defocused, then covered by a scrim and a vignette. It should read as
          depth behind the menu, never as something competing with it. The 1.08
          scale hides the soft edges blur leaves on a cover-sized layer. */}
      {bg && (
        <>
          <div style={{
            position: 'fixed', inset: 0, zIndex: 0,
            backgroundImage: `url(${bg})`, backgroundSize: 'cover', backgroundPosition: 'center',
            filter: 'brightness(0.38) saturate(0.72) blur(2px)',
            transform: 'scale(1.08)',
          }} />
          <div style={{
            position: 'fixed', inset: 0, zIndex: 0,
            background:
              'radial-gradient(120% 80% at 50% 0%, rgb(var(--fs-accent-rgb) / 0.09), transparent 62%),'
              + 'radial-gradient(100% 100% at 50% 50%, transparent 30%, rgba(0,0,0,0.55) 100%),'
              + 'rgba(4,5,6,0.82)',
          }} />
        </>
      )}

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <header className="fs-glass" style={{ position: 'relative', zIndex: 35, borderBottom: '1px solid var(--fs-line)' }}>
          <div style={{
            maxWidth: 1180, margin: '0 auto', padding: '12px 16px',
            display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
          }}>
            <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', minWidth: 0 }}>
              {logo && <img src={logo} alt="" style={{ height: 40, width: 'auto', objectFit: 'contain', flexShrink: 0 }} />}
              <span style={{
                fontSize: 16, fontWeight: 800, letterSpacing: '-0.01em', color: 'var(--fs-text)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {restaurant?.name ?? ''}
              </span>
            </Link>

            <nav className="fs-scroll-x" style={{ display: 'flex', gap: 2, marginLeft: 'auto' }}>
              {NAV.map(({ to, key }) => {
                const isActive = to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);
                return (
                  <Link key={to} to={to} style={{
                    padding: '8px 13px', borderRadius: 9, fontSize: 14, fontWeight: 650,
                    textDecoration: 'none', whiteSpace: 'nowrap',
                    color: isActive ? 'var(--fs-accent)' : 'var(--fs-dim)',
                    background: isActive ? 'rgb(var(--fs-accent-rgb) / 0.10)' : 'transparent',
                  }}>
                    {t(key)}
                  </Link>
                );
              })}
            </nav>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ display: 'flex', gap: 3 }}>
                {locales.map((loc) => (
                  <button key={loc} type="button" onClick={() => setLocale(loc)}
                    className={`fs-chip${locale === loc ? ' is-active' : ''}`}
                    style={{ padding: '5px 9px', fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    {loc}
                  </button>
                ))}
              </div>

              <button type="button" className="fs-btn fs-btn-icon" aria-label={t('fs_cart')}
                style={{ position: 'relative' }} onClick={() => setCartOpen(true)}>
                🛒
                {count > 0 && <span className="fs-badge">{count}</span>}
              </button>
            </div>
          </div>
        </header>

        <main ref={revealRef} style={{
          flex: 1, width: '100%', maxWidth: 1180, margin: '0 auto',
          padding: '0 16px 120px',
        }}>
          {children}
        </main>

        <Footer restaurant={restaurant} />
      </div>

      {/* Floating cart bar. The header button is easy to miss mid-scroll on a
          phone, which is where this site is actually used. */}
      {count > 0 && !cartOpen && (
        <button type="button" className="fs-glass fs-cartbar" onClick={() => setCartOpen(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px',
            cursor: 'pointer', font: 'inherit', color: 'var(--fs-text)', textAlign: 'left',
          }}>
          <span style={{ fontSize: 19 }}>🛒</span>
          <span style={{ flex: 1, fontSize: 13.5, fontWeight: 700 }}>
            {count} · {t('fs_view_cart')}
          </span>
          <Price tiyin={subtotal} size={19} />
        </button>
      )}

      {cartOpen && restaurant && (
        <CartDrawer restaurantId={restaurant.id} menuItems={menuItems} onClose={() => setCartOpen(false)} />
      )}
    </div>
  );
}

function Footer({ restaurant }: { restaurant?: PublicRestaurantDetail }) {
  const { t } = useT();
  if (!restaurant) return null;
  return (
    <footer style={{ borderTop: '1px solid var(--fs-line)', padding: '26px 16px 30px' }}>
      <div style={{
        maxWidth: 1180, margin: '0 auto', display: 'flex', gap: 18,
        flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'grid', gap: 5 }}>
          <span className="fs-eyebrow">{restaurant.companyName ?? t('menu')}</span>
          <span style={{ fontSize: 16, fontWeight: 800 }}>{restaurant.name}</span>
        </div>
        <div className="fs-muted" style={{ display: 'grid', gap: 4, fontSize: 13, textAlign: 'right' }}>
          {restaurant.address && <span>{restaurant.address}</span>}
          {restaurant.phone && (
            <a href={`tel:${restaurant.phone}`} style={{ color: 'var(--fs-accent)', textDecoration: 'none' }}>
              {restaurant.phone}
            </a>
          )}
        </div>
      </div>
    </footer>
  );
}
