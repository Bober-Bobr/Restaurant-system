import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { useAuthStore } from '../store/auth.store';
import { eventService } from '../services/event.service';
import { restaurantService } from '../services/restaurant.service';
import { publicMenuService } from '../services/publicMenu.service';
import { invitationService, normalizeGalleryItems, type Invitation, type InvitationMenuItem, type InvitationGalleryItem } from '../services/invitation.service';
import { getPhotoUrl } from '../utils/photoUrl';
import { buildSubdomainBase } from '../utils/subdomain';
import networkingLogoSrc from '../assets/networking-logo.png';
import { PhotoUploadField } from '../components/PhotoUploadField';
import { AudioUploadField } from '../components/AudioUploadField';
import QRCode from 'qrcode';

// Preset palettes for the invitation (accent + page background).
const PALETTES: { name: string; accent: string; background: string }[] = [
  { name: 'Gold', accent: '#c9a42c', background: '#fafaf7' },
  { name: 'Emerald', accent: '#0f7b5a', background: '#f3faf6' },
  { name: 'Rose', accent: '#c2185b', background: '#fdf4f7' },
  { name: 'Royal', accent: '#3b3f9e', background: '#f4f5fc' },
  { name: 'Sunset', accent: '#d2691e', background: '#fef7f0' },
  { name: 'Charcoal', accent: '#b08d57', background: '#1a1a1a' },
];

const inputStyle: React.CSSProperties = {
  background: 'rgba(15,23,42,0.6)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 10,
  color: '#e2e8f0',
  padding: '9px 12px',
  fontSize: 13,
  fontFamily: 'inherit',
  outline: 'none',
  width: '100%',
};
const labelStyle: React.CSSProperties = { fontSize: 11, color: 'rgba(226,232,240,0.6)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="adm-card tablet-fade-up" style={{ padding: 18 }}>
      <h2 className="adm-heading" style={{ margin: '0 0 14px' }}>{title}</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {children}
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'grid', gap: 4 }}>
      <span style={labelStyle}>{label}</span>
      {children}
    </label>
  );
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[\s_]+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 60) || 'invitation';
}

// ── Page ──────────────────────────────────────────────────────────────────

export const InvitationBuilderPage = () => {
  const { restaurantId = '', eventId = '' } = useParams();
  const accessToken = useAuthStore((s) => s.accessToken);
  const role = useAuthStore((s) => s.role);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const restaurantsQuery = useQuery({
    queryKey: ['manager-restaurants'],
    queryFn: () => restaurantService.list(),
    enabled: !!accessToken,
  });

  const eventsQuery = useQuery({
    queryKey: ['manager-events', restaurantId],
    queryFn: () => eventService.list({ restaurantId }),
    enabled: !!accessToken && !!restaurantId,
  });

  const event = (eventsQuery.data ?? []).find((e) => String(e.id) === String(eventId));
  const restaurant = restaurantsQuery.data?.find((r) => r.id === restaurantId);

  const existingQuery = useQuery({
    queryKey: ['invitation-by-event', eventId],
    queryFn: () => invitationService.byEvent(String(eventId), restaurantId),
    enabled: !!accessToken && !!eventId,
  });

  const [form, setForm] = useState<Partial<Invitation>>({});
  const [savedFlash, setSavedFlash] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (existingQuery.data) {
      setForm(existingQuery.data);
    } else if (restaurant && event && Object.keys(form).length === 0) {
      // Initial template with sensible defaults from the event
      setForm({
        slug: slugify(`${restaurant.name}-${event.customerName}-${event.id}`),
        restaurantId,
        eventId: String(event.id),
        welcomeTitle: 'Добро пожаловать',
        welcomeSubtitle: 'Xush kelibsiz',
        welcomeMessage: `Добро пожаловать — вкус, тепло и гостеприимство ждут вас!`,
        countdownAt: event.eventDate,
        promoTitle: 'ОНЛАЙН ПРИГЛАСИТЕЛЬНОЕ',
        promoSubtitle: `Чтобы получить онлайн-пригласительное, напишите по телеграму и отправьте промокод`,
        telegramLabel: 'TELEGRAM',
        instagramLabel: 'INSTAGRAM',
        contactsTitle: 'НАШИ КОНТАКТЫ',
        menuItems: [],
        galleryPhotos: [],
        isPublished: true,
      });
    }
  }, [existingQuery.data, restaurant, event]); // eslint-disable-line react-hooks/exhaustive-deps

  const isEditing = !!existingQuery.data;

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (isEditing && existingQuery.data) {
        return invitationService.update(existingQuery.data.id, form);
      }
      return invitationService.create({
        ...form,
        slug: form.slug ?? slugify(`${restaurant?.name}-${eventId}`),
        restaurantId,
        eventId: String(eventId),
      });
    },
    onSuccess: (inv) => {
      setError(null);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1500);
      queryClient.setQueryData(['invitation-by-event', eventId], inv);
      queryClient.invalidateQueries({ queryKey: ['manager-invitations', restaurantId] });
      // Generate a QR code pointing at the public invitation URL.
      if (publicUrl) {
        QRCode.toDataURL(publicUrl, { width: 320, margin: 2, color: { dark: '#0f172a', light: '#ffffff' } })
          .then(setQrDataUrl)
          .catch(() => setQrDataUrl(null));
      }
    },
    onError: (e) => {
      if (axios.isAxiosError(e)) {
        const body = e.response?.data as { message?: string } | undefined;
        setError(body?.message ?? e.message);
      } else if (e instanceof Error) setError(e.message);
      else setError('Save failed');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => existingQuery.data ? invitationService.remove(existingQuery.data.id) : Promise.resolve(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitation-by-event', eventId] });
      queryClient.invalidateQueries({ queryKey: ['manager-invitations', restaurantId] });
      navigate(`/restaurants/${restaurantId}`);
    },
  });

  if (!accessToken) return <Navigate to="/login" replace />;
  if (role !== 'MANAGER' && role !== 'CHIEF_ADMIN') return <Navigate to="/login" replace />;

  const set = <K extends keyof Invitation>(k: K, v: Invitation[K]) => setForm((f) => ({ ...f, [k]: v }));

  const restaurantSlug = useMemo(() => {
    if (!restaurant) return '';
    return restaurant.name.toLowerCase().replace(/[\s_]+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 63);
  }, [restaurant]);
  const publicUrl = form.slug && restaurantSlug
    ? buildSubdomainBase(`${restaurantSlug}.invitation`, `/${form.slug}`)
    : '';

  // Toggle a restaurant menu item in the invitation. Numbering is auto-assigned.
  const toggleMenuItem = (selected: { id: string; name: string; photoUrl?: string | null }) => {
    const items = [...(form.menuItems ?? [])];
    const idx = items.findIndex((it) => it.name === selected.name);
    if (idx >= 0) {
      items.splice(idx, 1);
    } else {
      items.push({ number: items.length + 1, name: selected.name, photoUrl: selected.photoUrl ?? null });
    }
    set('menuItems', items.map((it, i) => ({ ...it, number: i + 1 })));
  };
  const moveMenuItem = (index: number, dir: -1 | 1) => {
    const items = [...(form.menuItems ?? [])];
    const next = index + dir;
    if (next < 0 || next >= items.length) return;
    [items[index], items[next]] = [items[next], items[index]];
    set('menuItems', items.map((it, i) => ({ ...it, number: i + 1 })));
  };

  const galleryItems = normalizeGalleryItems(form.galleryPhotos);
  const addGalleryPhoto = (url: string) => {
    if (!url.trim()) return;
    set('galleryPhotos', [...galleryItems, { photoUrl: url.trim(), videoUrl: null }]);
  };
  const setGalleryVideo = (index: number, videoUrl: string) => {
    const next = galleryItems.map((it, i) => (i === index ? { ...it, videoUrl: videoUrl || null } : it));
    set('galleryPhotos', next);
  };
  const removeGalleryPhoto = (index: number) => {
    const next = galleryItems.filter((_, i) => i !== index);
    set('galleryPhotos', next);
  };

  return (
    <div className="adm-bg">
      <nav style={{
        position: 'sticky', top: 0, zIndex: 30,
        background: 'rgba(15,23,42,0.78)',
        backdropFilter: 'blur(18px)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
            <img src={networkingLogoSrc} alt="" style={{ height: 40, width: 'auto' }} />
            <div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#f8fafc' }}>Invitation Builder</p>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: 'rgba(226,232,240,0.55)' }}>
                {restaurant?.name ?? '...'} · {event?.customerName ?? '...'}
              </p>
            </div>
          </Link>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {publicUrl && (
              <a href={publicUrl} target="_blank" rel="noreferrer"
                style={{ fontSize: 12, color: '#c9a42c', textDecoration: 'none', padding: '6px 12px', borderRadius: 8, background: 'rgba(201,164,44,0.08)', border: '1px solid rgba(201,164,44,0.3)' }}>
                Preview ↗
              </a>
            )}
            {isEditing && (
              <button type="button"
                onClick={() => { if (confirm('Delete this invitation?')) deleteMutation.mutate(); }}
                className="adm-btn-danger"
                style={{ fontSize: 12 }}
              >
                Delete
              </button>
            )}
            <button
              type="button"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="adm-btn-primary"
              style={{ fontSize: 13 }}
            >
              {saveMutation.isPending ? 'Saving...' : (isEditing ? 'Save changes' : 'Create invitation')}
            </button>
          </div>
        </div>
      </nav>

      <main className="tablet-fade-in" style={{ maxWidth: 1180, margin: '0 auto', padding: '28px 20px', position: 'relative', zIndex: 1, display: 'grid', gap: 16 }}>
        <Link to={`/restaurants/${restaurantId}`} style={{ fontSize: 12, color: 'rgba(226,232,240,0.6)', textDecoration: 'none' }}>← Back to events</Link>

        {error && (
          <div style={{ padding: 12, borderRadius: 10, background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.35)', color: '#fca5a5', fontSize: 13 }}>
            {error}
          </div>
        )}
        {savedFlash && (
          <div style={{ padding: 12, borderRadius: 10, background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.35)', color: '#4ade80', fontSize: 13, fontWeight: 600 }}>
            ✓ Saved
          </div>
        )}

        {qrDataUrl && (
          <div
            onClick={() => setQrDataUrl(null)}
            style={{
              position: 'fixed', inset: 0, zIndex: 60,
              background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="scale-in"
              style={{
                width: '100%', maxWidth: 360, borderRadius: 18,
                background: 'rgba(15,23,42,0.98)', border: '1px solid rgba(201,164,44,0.35)',
                boxShadow: '0 20px 60px rgba(0,0,0,0.5)', padding: 22, textAlign: 'center',
              }}
            >
              <p style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: '#f8fafc' }}>Invitation ready</p>
              <p style={{ margin: '0 0 16px', fontSize: 12, color: 'rgba(226,232,240,0.6)' }}>Scan to open the invitation</p>
              <img src={qrDataUrl} alt="QR code" style={{ width: 220, height: 220, borderRadius: 12, background: '#fff', padding: 8 }} />
              {publicUrl && (
                <a href={publicUrl} target="_blank" rel="noreferrer"
                  style={{ display: 'block', margin: '14px 0 0', fontSize: 12, color: '#c9a42c', wordBreak: 'break-all' }}>
                  {publicUrl}
                </a>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <a href={qrDataUrl} download={`invitation-${form.slug ?? 'qr'}.png`}
                  className="adm-btn-primary" style={{ flex: 1, fontSize: 13, textAlign: 'center', textDecoration: 'none', padding: '9px 0' }}>
                  Download QR
                </a>
                <button type="button" onClick={() => setQrDataUrl(null)}
                  style={{ flex: 1, fontSize: 13, borderRadius: 10, background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(226,232,240,0.8)', cursor: 'pointer' }}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        <Section title="Slug & link">
          <Field label="Slug">
            <input value={form.slug ?? ''} onChange={(e) => set('slug', e.target.value)}
              style={inputStyle} placeholder="my-invitation" />
          </Field>
          {publicUrl && (
            <p style={{ margin: 0, fontSize: 12, color: 'rgba(226,232,240,0.55)' }}>
              Public URL: <code style={{ color: '#c9a42c' }}>{publicUrl}</code>
            </p>
          )}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#e2e8f0' }}>
            <input type="checkbox" checked={form.isPublished ?? true}
              onChange={(e) => set('isPublished', e.target.checked)} />
            Published (visible at the public URL)
          </label>
        </Section>

        <Section title="Design & palette">
          <Field label="Palette presets">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {PALETTES.map((p) => {
                const active = (form.accentColor ?? '#c9a42c') === p.accent && (form.backgroundColor ?? '#fafaf7') === p.background;
                return (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, accentColor: p.accent, backgroundColor: p.background }))}
                    title={p.name}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '6px 10px', borderRadius: 10, cursor: 'pointer',
                      background: 'rgba(15,23,42,0.5)',
                      border: `1px solid ${active ? p.accent : 'rgba(255,255,255,0.12)'}`,
                      color: '#e2e8f0', fontSize: 12,
                    }}
                  >
                    <span style={{ width: 14, height: 14, borderRadius: '50%', background: p.accent, border: '1px solid rgba(255,255,255,0.3)' }} />
                    <span style={{ width: 14, height: 14, borderRadius: 4, background: p.background, border: '1px solid rgba(255,255,255,0.3)' }} />
                    {p.name}
                    {active && <span style={{ color: p.accent }}>✓</span>}
                  </button>
                );
              })}
            </div>
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
            <Field label="Accent color">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="color" value={form.accentColor ?? '#c9a42c'} onChange={(e) => set('accentColor', e.target.value)}
                  style={{ width: 42, height: 36, borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', cursor: 'pointer' }} />
                <input value={form.accentColor ?? '#c9a42c'} onChange={(e) => set('accentColor', e.target.value)} style={inputStyle} />
              </div>
            </Field>
            <Field label="Background color">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="color" value={form.backgroundColor ?? '#fafaf7'} onChange={(e) => set('backgroundColor', e.target.value)}
                  style={{ width: 42, height: 36, borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', cursor: 'pointer' }} />
                <input value={form.backgroundColor ?? '#fafaf7'} onChange={(e) => set('backgroundColor', e.target.value)} style={inputStyle} />
              </div>
            </Field>
          </div>
          <PhotoUploadField
            label="Background photo (optional)"
            value={form.backgroundImageUrl}
            onChange={(url) => set('backgroundImageUrl', url)}
            restaurantId={restaurantId}
          />
        </Section>

        <Section title="Background music">
          <p style={{ margin: 0, fontSize: 12, color: 'rgba(226,232,240,0.55)' }}>
            Plays softly on a loop while guests view the invitation. Upload an audio file or paste a direct link.
          </p>
          <AudioUploadField
            label="Music file"
            value={form.musicUrl}
            onChange={(url) => set('musicUrl', url)}
            restaurantId={restaurantId}
          />
          <Field label="Or paste a music URL">
            <input value={form.musicUrl ?? ''} onChange={(e) => set('musicUrl', e.target.value || null)}
              style={inputStyle} placeholder="https://example.com/song.mp3" />
          </Field>
        </Section>

        <Section title="Promo card (top hero)">
          <Field label="Title"><input value={form.promoTitle ?? ''} onChange={(e) => set('promoTitle', e.target.value)} style={inputStyle} /></Field>
          <Field label="Subtitle"><input value={form.promoSubtitle ?? ''} onChange={(e) => set('promoSubtitle', e.target.value)} style={inputStyle} /></Field>
          <Field label="Promo code (badge)"><input value={form.promoCode ?? ''} onChange={(e) => set('promoCode', e.target.value)} style={inputStyle} placeholder="#MARJON88" /></Field>
          <PhotoUploadField
            label="Promo image"
            value={form.promoImageUrl}
            onChange={(url) => set('promoImageUrl', url)}
            restaurantId={restaurantId}
          />
          <Field label="Alt promo code"><input value={form.promoCodeAlt ?? ''} onChange={(e) => set('promoCodeAlt', e.target.value)} style={inputStyle} placeholder="#MARJON77" /></Field>
          <Field label="Description"><textarea value={form.promoDescription ?? ''} onChange={(e) => set('promoDescription', e.target.value)} style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} /></Field>
        </Section>

        <Section title="Telegram CTA">
          <Field label="Telegram URL"><input value={form.telegramUrl ?? ''} onChange={(e) => set('telegramUrl', e.target.value)} style={inputStyle} placeholder="https://t.me/marjon" /></Field>
          <Field label="Button label"><input value={form.telegramLabel ?? ''} onChange={(e) => set('telegramLabel', e.target.value)} style={inputStyle} placeholder="TELEGRAM" /></Field>
        </Section>

        <Section title="Welcome card">
          <Field label="Title"><input value={form.welcomeTitle ?? ''} onChange={(e) => set('welcomeTitle', e.target.value)} style={inputStyle} placeholder="Добро пожаловать" /></Field>
          <Field label="Subtitle"><input value={form.welcomeSubtitle ?? ''} onChange={(e) => set('welcomeSubtitle', e.target.value)} style={inputStyle} placeholder="Xush kelibsiz" /></Field>
          <PhotoUploadField
            label="Welcome image"
            value={form.welcomeImageUrl}
            onChange={(url) => set('welcomeImageUrl', url)}
            restaurantId={restaurantId}
          />
          <Field label="Message"><textarea value={form.welcomeMessage ?? ''} onChange={(e) => set('welcomeMessage', e.target.value)} style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} /></Field>
        </Section>

        <Section title="Countdown">
          <Field label="Event date & time">
            <input type="datetime-local"
              value={form.countdownAt ? form.countdownAt.slice(0, 16) : ''}
              onChange={(e) => set('countdownAt', e.target.value ? new Date(e.target.value).toISOString() : null)}
              style={inputStyle} />
          </Field>
          <Field label="Label (e.g. weekday)"><input value={form.countdownLabel ?? ''} onChange={(e) => set('countdownLabel', e.target.value)} style={inputStyle} placeholder="СРЕДА" /></Field>
        </Section>

        <Section title="Menu showcase">
          <MenuPicker
            restaurantId={restaurantId}
            selected={form.menuItems ?? []}
            onToggle={toggleMenuItem}
            onMove={moveMenuItem}
          />
        </Section>

        <Section title="Gallery (Instagram video stills)">
          <GalleryEditor
            items={galleryItems}
            onAdd={addGalleryPhoto}
            onRemove={removeGalleryPhoto}
            onSetVideo={setGalleryVideo}
            restaurantId={restaurantId}
          />
        </Section>

        <Section title="Contacts">
          <Field label="Section title"><input value={form.contactsTitle ?? ''} onChange={(e) => set('contactsTitle', e.target.value)} style={inputStyle} placeholder="НАШИ КОНТАКТЫ" /></Field>
          <Field label="Phone"><input value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value)} style={inputStyle} placeholder="+998 ..." /></Field>
          <Field label="Instagram URL"><input value={form.instagramUrl ?? ''} onChange={(e) => set('instagramUrl', e.target.value)} style={inputStyle} placeholder="https://instagram.com/marjon_restaurant" /></Field>
          <Field label="Instagram label"><input value={form.instagramLabel ?? ''} onChange={(e) => set('instagramLabel', e.target.value)} style={inputStyle} placeholder="@marjon_restaurant" /></Field>
          <Field label="vCard URL (Save contact)"><input value={form.contactVCardUrl ?? ''} onChange={(e) => set('contactVCardUrl', e.target.value)} style={inputStyle} placeholder="/contacts/marjon.vcf" /></Field>
        </Section>
      </main>
    </div>
  );
};

function GalleryEditor({ items, onAdd, onRemove, onSetVideo, restaurantId }: {
  items: InvitationGalleryItem[];
  onAdd: (url: string) => void;
  onRemove: (i: number) => void;
  onSetVideo: (i: number, videoUrl: string) => void;
  restaurantId: string;
}) {
  return (
    <>
      <p style={{ margin: 0, fontSize: 12, color: 'rgba(226,232,240,0.55)' }}>
        Upload a still frame, then paste the Instagram video link guests open by tapping it.
      </p>
      <PhotoUploadField
        label="Add a still frame"
        value={null}
        onChange={(url) => { if (url) onAdd(url); }}
        restaurantId={restaurantId}
        height={110}
      />
      {items.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map((it, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: 8, borderRadius: 10, background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ position: 'relative', width: 84, height: 64, borderRadius: 8, overflow: 'hidden', flexShrink: 0, background: '#000' }}>
                <img src={getPhotoUrl(it.photoUrl) ?? it.photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                {it.videoUrl && (
                  <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.6)', fontSize: 22 }}>▶</span>
                )}
              </div>
              <input
                value={it.videoUrl ?? ''}
                onChange={(e) => onSetVideo(i, e.target.value)}
                placeholder="https://instagram.com/reel/..."
                style={{ ...inputStyle, flex: 1 }}
              />
              <button type="button" onClick={() => onRemove(i)}
                style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(220,38,38,0.85)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 15, lineHeight: 1, flexShrink: 0 }}>×</button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function MenuPicker({
  restaurantId, selected, onToggle, onMove,
}: {
  restaurantId: string;
  selected: InvitationMenuItem[];
  onToggle: (item: { id: string; name: string; photoUrl?: string | null }) => void;
  onMove: (index: number, dir: -1 | 1) => void;
}) {
  const menuQuery = useQuery({
    queryKey: ['public-menu', restaurantId],
    queryFn: () => publicMenuService.listActive(restaurantId),
    enabled: !!restaurantId,
  });

  const items = menuQuery.data ?? [];
  const isSelected = (name: string) => selected.some((s) => s.name === name);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {selected.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <p style={{ margin: 0, ...labelStyle }}>Showcased ({selected.length})</p>
          {selected.map((it, i) => (
            <div key={`${it.name}-${i}`} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 10px', borderRadius: 10,
              background: 'rgba(201,164,44,0.08)', border: '1px solid rgba(201,164,44,0.25)',
            }}>
              <span style={{ width: 26, height: 26, borderRadius: '50%', background: '#c9a42c', color: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>{it.number}</span>
              {it.photoUrl
                ? <img src={getPhotoUrl(it.photoUrl) ?? it.photoUrl} alt="" style={{ width: 34, height: 34, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                : <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(255,255,255,0.06)', flexShrink: 0 }} />
              }
              <span style={{ flex: 1, minWidth: 0, color: '#f8fafc', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.name}</span>
              <button type="button" onClick={() => onMove(i, -1)} disabled={i === 0}
                style={moveBtnStyle(i === 0)}>↑</button>
              <button type="button" onClick={() => onMove(i, 1)} disabled={i === selected.length - 1}
                style={moveBtnStyle(i === selected.length - 1)}>↓</button>
              <button type="button" onClick={() => onToggle({ id: it.name, name: it.name, photoUrl: it.photoUrl })}
                style={{ width: 26, height: 26, borderRadius: '50%', background: 'rgba(220,38,38,0.85)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 14, lineHeight: 1, flexShrink: 0 }}>×</button>
            </div>
          ))}
        </div>
      )}

      <p style={{ margin: 0, ...labelStyle }}>Available menu items</p>
      {menuQuery.isLoading && <p style={{ margin: 0, color: 'rgba(226,232,240,0.5)', fontSize: 12 }}>...</p>}
      {!menuQuery.isLoading && items.length === 0 && (
        <p style={{ margin: 0, color: 'rgba(226,232,240,0.5)', fontSize: 12 }}>
          This restaurant has no active menu items yet.
        </p>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
        {items.map((m) => {
          const picked = isSelected(m.name);
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onToggle({ id: m.id, name: m.name, photoUrl: m.photoUrl })}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 10px', borderRadius: 10,
                background: picked ? 'rgba(34,197,94,0.12)' : 'rgba(15,23,42,0.5)',
                border: `1px solid ${picked ? 'rgba(34,197,94,0.45)' : 'rgba(255,255,255,0.08)'}`,
                color: '#e2e8f0', textAlign: 'left', cursor: 'pointer',
              }}
            >
              {m.photoUrl
                ? <img src={getPhotoUrl(m.photoUrl) ?? undefined} alt="" style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                : <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(255,255,255,0.06)', flexShrink: 0 }} />
              }
              <span style={{ flex: 1, minWidth: 0, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</span>
              <span style={{ color: picked ? '#4ade80' : '#c9a42c', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                {picked ? '✓' : '+'}
              </span>
            </button>
          );
        })}
      </div>
      <p style={{ margin: 0, fontSize: 11, color: 'rgba(226,232,240,0.45)' }}>
        Showcase items come from this restaurant's menu. To add new items, open the restaurant's Menu page in the admin panel.
      </p>
    </div>
  );
}

function moveBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    width: 26, height: 26, borderRadius: 6,
    background: disabled ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.08)',
    color: disabled ? 'rgba(226,232,240,0.3)' : 'rgba(226,232,240,0.8)',
    border: '1px solid rgba(255,255,255,0.1)',
    cursor: disabled ? 'default' : 'pointer',
    fontSize: 12, lineHeight: 1, flexShrink: 0,
  };
}
