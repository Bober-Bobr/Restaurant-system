import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { useAuthStore } from '../store/auth.store';
import { eventService } from '../services/event.service';
import { restaurantService } from '../services/restaurant.service';
import { invitationService, type Invitation, type InvitationMenuItem } from '../services/invitation.service';
import { getPhotoUrl } from '../utils/photoUrl';
import networkingLogoSrc from '../assets/networking-logo.png';

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
    queryFn: () => invitationService.byEvent(String(eventId)),
    enabled: !!accessToken && !!eventId,
  });

  const [form, setForm] = useState<Partial<Invitation>>({});
  const [savedFlash, setSavedFlash] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    ? `https://${restaurantSlug}.invitation.v-menu.uz/${form.slug}`
    : '';

  const updateMenuItem = (index: number, patch: Partial<InvitationMenuItem>) => {
    const items = [...(form.menuItems ?? [])];
    items[index] = { ...items[index], ...patch };
    set('menuItems', items);
  };
  const addMenuItem = () => {
    const items = [...(form.menuItems ?? [])];
    items.push({ number: items.length + 1, name: '', photoUrl: '' });
    set('menuItems', items);
  };
  const removeMenuItem = (index: number) => {
    const items = [...(form.menuItems ?? [])];
    items.splice(index, 1);
    set('menuItems', items.map((it, i) => ({ ...it, number: i + 1 })));
  };

  const addGalleryPhoto = (url: string) => {
    if (!url.trim()) return;
    set('galleryPhotos', [...(form.galleryPhotos ?? []), url.trim()]);
  };
  const removeGalleryPhoto = (index: number) => {
    const next = [...(form.galleryPhotos ?? [])];
    next.splice(index, 1);
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

        <Section title="Promo card (top hero)">
          <Field label="Title"><input value={form.promoTitle ?? ''} onChange={(e) => set('promoTitle', e.target.value)} style={inputStyle} /></Field>
          <Field label="Subtitle"><input value={form.promoSubtitle ?? ''} onChange={(e) => set('promoSubtitle', e.target.value)} style={inputStyle} /></Field>
          <Field label="Promo code (badge)"><input value={form.promoCode ?? ''} onChange={(e) => set('promoCode', e.target.value)} style={inputStyle} placeholder="#MARJON88" /></Field>
          <Field label="Promo image URL"><input value={form.promoImageUrl ?? ''} onChange={(e) => set('promoImageUrl', e.target.value)} style={inputStyle} placeholder="/uploads/..." /></Field>
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
          <Field label="Image URL"><input value={form.welcomeImageUrl ?? ''} onChange={(e) => set('welcomeImageUrl', e.target.value)} style={inputStyle} /></Field>
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
          {(form.menuItems ?? []).map((item, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '60px 1fr 1fr auto', gap: 8, alignItems: 'end' }}>
              <Field label="№"><input type="number" min={1} value={item.number} onChange={(e) => updateMenuItem(i, { number: Number(e.target.value) || 1 })} style={inputStyle} /></Field>
              <Field label="Name"><input value={item.name} onChange={(e) => updateMenuItem(i, { name: e.target.value })} style={inputStyle} /></Field>
              <Field label="Photo URL"><input value={item.photoUrl ?? ''} onChange={(e) => updateMenuItem(i, { photoUrl: e.target.value })} style={inputStyle} /></Field>
              <button type="button" onClick={() => removeMenuItem(i)} className="adm-btn-danger" style={{ fontSize: 11, padding: '7px 10px' }}>×</button>
            </div>
          ))}
          <button type="button" onClick={addMenuItem} className="adm-btn-primary" style={{ fontSize: 12, justifySelf: 'start' }}>+ Add menu item</button>
        </Section>

        <Section title="Photo gallery">
          <GalleryEditor photos={form.galleryPhotos ?? []} onAdd={addGalleryPhoto} onRemove={removeGalleryPhoto} />
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

function GalleryEditor({ photos, onAdd, onRemove }: { photos: string[]; onAdd: (url: string) => void; onRemove: (i: number) => void }) {
  const [url, setUrl] = useState('');
  return (
    <>
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={url} onChange={(e) => setUrl(e.target.value)}
          placeholder="/uploads/photo.jpg" style={inputStyle} />
        <button type="button"
          onClick={() => { onAdd(url); setUrl(''); }}
          className="adm-btn-primary" style={{ fontSize: 12 }}>Add</button>
      </div>
      {photos.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
          {photos.map((p, i) => (
            <div key={i} style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', aspectRatio: '4 / 3', background: 'rgba(15,23,42,0.5)' }}>
              <img src={getPhotoUrl(p) ?? p} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <button type="button" onClick={() => onRemove(i)}
                style={{ position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: '50%', background: 'rgba(220,38,38,0.85)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}>×</button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
