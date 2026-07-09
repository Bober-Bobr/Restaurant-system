import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { useAdminStore } from '../store/admin.store';
import { restaurantService, type Restaurant } from '../services/restaurant.service';
import { hallService } from '../services/hall.service';
import type { Hall } from '../types/domain';
import { translate, locales, type Locale } from '../utils/translate';

const LOCALE_LABELS: Record<Locale, string> = { en: 'EN', ru: 'RU', uz: 'UZ' };
import { getPhotoUrl } from '../utils/photoUrl';
import { buildAbsoluteUrl } from '../utils/subdomain';
import { PhotoUploadField } from '../components/PhotoUploadField';
import networkingLogoSrc from '../assets/networking-logo.png';
import { authService } from '../services/auth.service';

type Lang = 'en' | 'ru' | 'uz';

const inputStyle: React.CSSProperties = {
  background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
  color: '#e2e8f0', padding: '9px 12px', height: 40, fontSize: 13, fontFamily: 'inherit', outline: 'none', width: '100%',
};
const labelStyle: React.CSSProperties = { fontSize: 11, color: 'rgba(226,232,240,0.6)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' };

function Stars({ rating }: { rating: number }) {
  return (
    <span style={{ color: '#c9a42c', letterSpacing: 1 }}>
      {'★'.repeat(rating)}<span style={{ color: 'rgba(255,255,255,0.2)' }}>{'★'.repeat(5 - rating)}</span>
    </span>
  );
}

const DEFAULT_ACCENT = '#c9a42c';
const DEFAULT_BG = '#1a3320';
const HEX6 = /^#[0-9a-fA-F]{6}$/;

// Per-restaurant tablet/summary color palette. Two colors (accent + background)
// drive the whole tablet theme; null values fall back to the default gold theme.
function TabletThemeEditor({ r, locale }: { r: Restaurant; locale: Lang }) {
  const t = (k: Parameters<typeof translate>[0]) => translate(k, locale);
  const queryClient = useQueryClient();

  const [accent, setAccent] = useState(r.tabletAccentColor ?? DEFAULT_ACCENT);
  const [bg, setBg] = useState(r.tabletBgColor ?? DEFAULT_BG);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setAccent(r.tabletAccentColor ?? DEFAULT_ACCENT);
    setBg(r.tabletBgColor ?? DEFAULT_BG);
  }, [r.id, r.tabletAccentColor, r.tabletBgColor]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['manager-restaurants'] });
  const flash = () => { setSaved(true); setTimeout(() => setSaved(false), 1500); };

  const save = useMutation({
    mutationFn: () => restaurantService.update(r.id, { tabletAccentColor: accent, tabletBgColor: bg }),
    onSuccess: () => { flash(); invalidate(); },
  });
  const reset = useMutation({
    mutationFn: () => restaurantService.update(r.id, { tabletAccentColor: null, tabletBgColor: null }),
    onSuccess: () => { setAccent(DEFAULT_ACCENT); setBg(DEFAULT_BG); flash(); invalidate(); },
  });

  const dirty = accent !== (r.tabletAccentColor ?? DEFAULT_ACCENT) || bg !== (r.tabletBgColor ?? DEFAULT_BG);
  const isDefault = !r.tabletAccentColor && !r.tabletBgColor;
  const swatch = (value: string, onChange: (v: string) => void, label: string) => (
    <label style={{ display: 'grid', gap: 4 }}>
      <span style={labelStyle}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)}
          style={{ width: 44, height: 40, padding: 2, borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', cursor: 'pointer' }} />
        <input value={value}
          onChange={(e) => { const v = e.target.value; onChange(v); }}
          style={{ ...inputStyle, width: 110, fontFamily: 'monospace', textTransform: 'lowercase' }} placeholder="#000000" />
      </div>
    </label>
  );

  return (
    <div style={{ marginTop: 22, paddingTop: 18, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
      <p style={{ margin: '0 0 4px', ...labelStyle, fontSize: 12 }}>{t('tablet_theme')}</p>
      <p style={{ margin: '0 0 12px', fontSize: 12, color: 'rgba(226,232,240,0.5)' }}>{t('tablet_theme_help')}</p>

      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        {swatch(accent, setAccent, t('accent_color'))}
        {swatch(bg, setBg, t('background_color'))}

        {/* Live preview mirroring the tablet look */}
        <div style={{ display: 'grid', gap: 4 }}>
          <span style={labelStyle}>{t('preview')}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, background: bg, border: '1px solid rgba(255,255,255,0.12)' }}>
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: accent }}>{r.name}</span>
            <span style={{ padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: accent, color: bg }}>{t('view_summary')}</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
        <button type="button" className="adm-btn-primary" style={{ fontSize: 13, opacity: HEX6.test(accent) && HEX6.test(bg) && dirty ? 1 : 0.5 }}
          disabled={save.isPending || !dirty || !HEX6.test(accent) || !HEX6.test(bg)} onClick={() => save.mutate()}>
          {save.isPending ? t('saving') : t('save')}
        </button>
        <button type="button" className="adm-btn-danger" style={{ fontSize: 13, opacity: isDefault ? 0.5 : 1 }}
          disabled={reset.isPending || isDefault} onClick={() => reset.mutate()}>
          {t('reset_theme')}
        </button>
        {saved && <span style={{ color: '#4ade80', fontSize: 13, fontWeight: 600 }}>✓</span>}
      </div>
    </div>
  );
}

function RestaurantCard({ r, locale }: { r: Restaurant; locale: 'en' | 'ru' | 'uz' }) {
  const t = (k: Parameters<typeof translate>[0]) => translate(k, locale);
  const queryClient = useQueryClient();

  const [phone, setPhone] = useState(r.phone ?? '');
  const [email, setEmail] = useState(r.email ?? '');
  const [history, setHistory] = useState(r.history ?? '');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setPhone(r.phone ?? ''); setEmail(r.email ?? ''); setHistory(r.history ?? '');
  }, [r.id, r.phone, r.email, r.history]);

  const saveInfo = useMutation({
    mutationFn: () => restaurantService.update(r.id, {
      phone: phone.trim() || null,
      email: email.trim() || null,
      history: history.trim() || null,
    }),
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
      queryClient.invalidateQueries({ queryKey: ['manager-restaurants'] });
    },
  });

  const updateBackground = useMutation({
    mutationFn: (url: string | null) => restaurantService.update(r.id, { backgroundImageUrl: url }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['manager-restaurants'] }),
  });

  // Fall back to the company logo, matching every other view in the app.
  const effLogo = r.logoUrl || r.company?.logoUrl || null;
  const logo = effLogo ? getPhotoUrl(effLogo) : null;
  const displayName = r.name || r.company?.name || '—';

  return (
    <section className="adm-card tablet-fade-up" style={{ padding: 18 }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        {logo
          ? <img src={logo ?? undefined} alt="" style={{ height: 44, width: 'auto', maxWidth: 80, objectFit: 'contain' }} />
          : <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(201,164,44,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c9a42c', fontWeight: 700 }}>{displayName.charAt(0)}</div>}
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#f8fafc' }}>{displayName}</h2>
      </header>

      {/* Info form */}
      <p style={{ margin: '0 0 4px', ...labelStyle, fontSize: 12 }}>{t('restaurant_info')}</p>
      <p style={{ margin: '0 0 12px', fontSize: 12, color: 'rgba(226,232,240,0.5)' }}>{t('restaurant_info_help')}</p>
      <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: 10 }}>
        <label style={{ display: 'grid', gap: 4 }}>
          <span style={labelStyle}>{t('phone')}</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} style={inputStyle} placeholder="+998 ..." />
        </label>
        <label style={{ display: 'grid', gap: 4 }}>
          <span style={labelStyle}>{t('email')}</span>
          <input value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} placeholder="info@..." />
        </label>
      </div>
      <label style={{ display: 'grid', gap: 4, marginBottom: 12 }}>
        <span style={labelStyle}>{t('history_label')}</span>
        <textarea value={history} onChange={(e) => setHistory(e.target.value)} style={{ ...inputStyle, height: 'auto', minHeight: 110, resize: 'vertical' }} />
      </label>

      {/* Background photo for the public catering site */}
      <div style={{ marginBottom: 12 }}>
        <span style={labelStyle}>{t('background_photo')}</span>
        <p style={{ margin: '2px 0 6px', fontSize: 12, color: 'rgba(226,232,240,0.5)' }}>{t('background_photo_help')}</p>
        <PhotoUploadField
          value={r.backgroundImageUrl ?? null}
          onChange={(url) => updateBackground.mutate(url)}
          restaurantId={r.id}
          height={140}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button type="button" className="adm-btn-primary" disabled={saveInfo.isPending} onClick={() => saveInfo.mutate()} style={{ fontSize: 13 }}>
          {saveInfo.isPending ? t('saving') : t('save_info')}
        </button>
        {saved && <span style={{ color: '#4ade80', fontSize: 13, fontWeight: 600 }}>✓ {t('credentials_saved')}</span>}
      </div>

      {/* Tablet/summary color palette */}
      <TabletThemeEditor r={r} locale={locale} />

      {/* Halls management */}
      <HallsManager restaurantId={r.id} locale={locale} />
    </section>
  );
}

// ── Halls management (info + photos) ────────────────────────────────────────
function HallsManager({ restaurantId, locale }: { restaurantId: string; locale: Lang }) {
  const t = (k: Parameters<typeof translate>[0]) => translate(k, locale);
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['manager-halls', restaurantId] });

  const hallsQuery = useQuery({
    queryKey: ['manager-halls', restaurantId],
    queryFn: () => hallService.listForRestaurant(restaurantId),
  });
  const halls = hallsQuery.data ?? [];

  const [newName, setNewName] = useState('');
  const [newCapacity, setNewCapacity] = useState('');

  const addHall = useMutation({
    mutationFn: () => hallService.createForRestaurant(restaurantId, {
      name: newName.trim(),
      capacity: Number(newCapacity) || 1,
    }),
    onSuccess: () => { setNewName(''); setNewCapacity(''); invalidate(); },
  });

  return (
    <div style={{ marginTop: 22, paddingTop: 18, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
      <p style={{ margin: '0 0 4px', ...labelStyle, fontSize: 12 }}>{t('manage_halls')} ({halls.length})</p>
      <p style={{ margin: '0 0 12px', fontSize: 12, color: 'rgba(226,232,240,0.5)' }}>{t('hall_info_help')}</p>

      {hallsQuery.isLoading && <p style={{ color: 'rgba(226,232,240,0.5)', fontSize: 13 }}>...</p>}
      {!hallsQuery.isLoading && halls.length === 0 && (
        <p style={{ color: 'rgba(226,232,240,0.5)', fontSize: 13 }}>{t('no_halls')}</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {halls.map((h) => (
          <HallEditor key={h.id} hall={h} restaurantId={restaurantId} locale={locale} onChanged={invalidate} />
        ))}
      </div>

      {/* Add hall */}
      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label style={{ display: 'grid', gap: 4, flex: '1 1 160px' }}>
          <span style={labelStyle}>{t('name')}</span>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} style={inputStyle} />
        </label>
        <label style={{ display: 'grid', gap: 4, width: 110 }}>
          <span style={labelStyle}>{t('capacity')}</span>
          <input value={newCapacity} onChange={(e) => setNewCapacity(e.target.value.replace(/[^0-9]/g, ''))} style={inputStyle} inputMode="numeric" />
        </label>
        <button type="button" className="adm-btn-primary" disabled={!newName.trim() || addHall.isPending}
          onClick={() => addHall.mutate()} style={{ fontSize: 13, opacity: !newName.trim() ? 0.5 : 1 }}>
          {addHall.isPending ? t('saving') : `+ ${t('add_hall')}`}
        </button>
      </div>
    </div>
  );
}

function HallEditor({ hall, restaurantId, locale, onChanged }: { hall: Hall; restaurantId: string; locale: Lang; onChanged: () => void }) {
  const t = (k: Parameters<typeof translate>[0]) => translate(k, locale);
  const [name, setName] = useState(hall.name);
  const [capacity, setCapacity] = useState(String(hall.capacity));
  const [description, setDescription] = useState(hall.description ?? '');
  const [photos, setPhotos] = useState<string[]>(() => {
    const all = [hall.photoUrl, ...(hall.photos ?? [])].filter((p): p is string => !!p);
    return Array.from(new Set(all));
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setName(hall.name);
    setCapacity(String(hall.capacity));
    setDescription(hall.description ?? '');
    const all = [hall.photoUrl, ...(hall.photos ?? [])].filter((p): p is string => !!p);
    setPhotos(Array.from(new Set(all)));
  }, [hall.id, hall.name, hall.capacity, hall.description, hall.photoUrl, hall.photos]);

  const save = useMutation({
    mutationFn: (nextPhotos?: string[]) => {
      const list = nextPhotos ?? photos;
      return hallService.updateForRestaurant(restaurantId, hall.id, {
        name: name.trim() || hall.name,
        capacity: Number(capacity) || hall.capacity,
        description: description.trim() || null,
        photoUrl: list[0] ?? null,
        photos: list,
      });
    },
    onSuccess: () => { setSaved(true); setTimeout(() => setSaved(false), 1500); onChanged(); },
  });

  const remove = useMutation({
    mutationFn: () => hallService.removeForRestaurant(restaurantId, hall.id),
    onSuccess: onChanged,
  });

  const addPhoto = (url: string | null) => {
    if (!url) return;
    const next = Array.from(new Set([...photos, url]));
    setPhotos(next);
    save.mutate(next);
  };
  const removePhoto = (url: string) => {
    const next = photos.filter((p) => p !== url);
    setPhotos(next);
    save.mutate(next);
  };

  return (
    <div style={{ padding: 12, borderRadius: 10, background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label style={{ display: 'grid', gap: 4, flex: '1 1 160px' }}>
          <span style={labelStyle}>{t('name')}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
        </label>
        <label style={{ display: 'grid', gap: 4, width: 100 }}>
          <span style={labelStyle}>{t('capacity')}</span>
          <input value={capacity} onChange={(e) => setCapacity(e.target.value.replace(/[^0-9]/g, ''))} style={inputStyle} inputMode="numeric" />
        </label>
      </div>

      <label style={{ display: 'grid', gap: 4, marginTop: 10 }}>
        <span style={labelStyle}>{t('description')}</span>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} style={{ ...inputStyle, height: 'auto', minHeight: 70, resize: 'vertical' }} />
      </label>

      {/* Photo gallery */}
      <p style={{ margin: '12px 0 6px', ...labelStyle }}>{t('photos')} ({photos.length})</p>
      <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))' }}>
        {photos.map((p) => (
          <div key={p} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', height: 72, border: '1px solid rgba(255,255,255,0.1)' }}>
            <img src={getPhotoUrl(p) ?? undefined} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <button type="button" onClick={() => removePhoto(p)}
              style={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: '50%', background: 'rgba(220,38,38,0.9)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, lineHeight: 1 }}>×</button>
          </div>
        ))}
        <div style={{ height: 72 }}>
          <PhotoUploadField value={null} onChange={addPhoto} restaurantId={restaurantId} height={72} label={undefined} />
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
        <button type="button" className="adm-btn-primary" disabled={save.isPending} onClick={() => save.mutate(undefined)} style={{ fontSize: 13 }}>
          {save.isPending ? t('saving') : t('save')}
        </button>
        <button type="button" className="adm-btn-danger" disabled={remove.isPending}
          onClick={() => { if (confirm(`${t('delete')}?`)) remove.mutate(); }} style={{ fontSize: 13 }}>
          {t('delete')}
        </button>
        {saved && <span style={{ color: '#4ade80', fontSize: 13, fontWeight: 600 }}>✓</span>}
      </div>
    </div>
  );
}

export const ManagerRestaurantsPage = () => {
  const accessToken = useAuthStore((s) => s.accessToken);
  const role = useAuthStore((s) => s.role);
  const { locale, setLocale } = useAdminStore();
  const t = (k: Parameters<typeof translate>[0]) => translate(k, locale);

  const logoutMutation = useMutation({
    mutationFn: () => authService.logout(),
    onSettled: () => {
      try { localStorage.removeItem('banquet-admin-auth'); } catch { /* ignore */ }
      window.location.replace(buildAbsoluteUrl('/login'));
    },
  });

  const restaurantsQuery = useQuery({
    queryKey: ['manager-restaurants'],
    queryFn: () => restaurantService.list(),
    enabled: !!accessToken,
  });

  const restaurants = useMemo(() => restaurantsQuery.data ?? [], [restaurantsQuery.data]);

  if (!accessToken) return <Navigate to="/login" replace />;
  if (role !== 'MANAGER' && role !== 'CHIEF_ADMIN') return <Navigate to="/login" replace />;

  return (
    <div className="adm-bg">
      <nav style={{
        position: 'sticky', top: 0, zIndex: 30,
        background: 'rgba(15,23,42,0.78)', backdropFilter: 'blur(18px)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
            <img src={networkingLogoSrc} alt="" style={{ height: 40, width: 'auto' }} />
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#f8fafc' }}>{t('restaurant_info')}</p>
          </Link>
          <Link to="/" style={{ marginLeft: 'auto', padding: '7px 13px', borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: 'none', color: 'rgba(226,232,240,0.75)', border: '1px solid rgba(255,255,255,0.12)' }}>
            ← {t('events')}
          </Link>
          <div style={{ display: 'flex', gap: 4 }}>
            {locales.map((loc) => (
              <button
                key={loc}
                type="button"
                onClick={() => setLocale(loc)}
                style={{
                  padding: '5px 10px', border: '1px solid', borderRadius: 6, cursor: 'pointer',
                  fontSize: 11, letterSpacing: '0.06em', transition: 'all 0.18s',
                  borderColor: locale === loc ? 'rgba(201,164,44,0.5)' : 'rgba(255,255,255,0.1)',
                  background: locale === loc ? 'rgba(201,164,44,0.15)' : 'transparent',
                  color: locale === loc ? '#c9a42c' : 'rgba(226,232,240,0.6)',
                  fontWeight: locale === loc ? 700 : 500,
                }}
              >
                {LOCALE_LABELS[loc]}
              </button>
            ))}
          </div>
          <button type="button" className="adm-btn-danger" onClick={() => logoutMutation.mutate()} disabled={logoutMutation.isPending} style={{ fontSize: 13 }}>
            {logoutMutation.isPending ? t('logging_out') : t('logout')}
          </button>
        </div>
      </nav>

      <main className="tablet-fade-in" style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 20px', position: 'relative', zIndex: 1, display: 'grid', gap: 18 }}>
        {restaurantsQuery.isLoading && <p style={{ color: 'rgba(226,232,240,0.5)' }}>...</p>}
        {restaurants.map((r) => <RestaurantCard key={r.id} r={r} locale={locale} />)}
      </main>
    </div>
  );
};
