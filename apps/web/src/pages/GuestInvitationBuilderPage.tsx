import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import QRCode from 'qrcode';
import { useAuthStore } from '../store/auth.store';
import {
  guestInvitationService,
  type GuestInvitation,
  type SectionAnimation,
  type SectionKey,
  type AnimationType,
  type TrailTemplate,
  type TimingItem,
} from '../services/guestInvitation.service';
import { buildSubdomainBase } from '../utils/subdomain';
import networkingLogoSrc from '../assets/networking-logo.png';
import { PhotoUploadField } from '../components/PhotoUploadField';
import { AudioUploadField } from '../components/AudioUploadField';

const TRAIL_TEMPLATES: { key: TrailTemplate; label: string }[] = [
  { key: 'sparkle', label: 'Sparkle' },
  { key: 'hearts', label: 'Hearts' },
  { key: 'candy', label: 'Candy' },
];

const ANIMATION_TYPES: AnimationType[] = [
  'none', 'fade', 'slide-up', 'slide-down', 'slide-left', 'slide-right', 'zoom', 'blur', 'flip',
];

const inputStyle: React.CSSProperties = {
  background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
  color: '#e2e8f0', padding: '9px 12px', height: 40, fontSize: 13, fontFamily: 'inherit', outline: 'none', width: '100%',
};
const labelStyle: React.CSSProperties = { fontSize: 11, color: 'rgba(226,232,240,0.6)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label style={{ display: 'grid', gap: 4 }}><span style={labelStyle}>{label}</span>{children}</label>;
}

// A builder section. When `animKey` is given, the header carries the per-section
// animation controls (type + speed + delay) bound to that section.
function Section({ title, animKey, anim, onAnim, children }: {
  title: string;
  animKey?: SectionKey;
  anim?: SectionAnimation;
  onAnim?: (key: SectionKey, value: SectionAnimation) => void;
  children: React.ReactNode;
}) {
  return (
    <section className="adm-card tablet-fade-up" style={{ padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <h2 className="adm-heading" style={{ margin: 0 }}>{title}</h2>
        {animKey && onAnim && <AnimationControls value={anim} onChange={(v) => onAnim(animKey, v)} />}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>
    </section>
  );
}

function AnimationControls({ value, onChange }: { value?: SectionAnimation; onChange: (v: SectionAnimation) => void }) {
  const v: SectionAnimation = value ?? { type: 'fade', durationMs: 700, delayMs: 0 };
  const sel: React.CSSProperties = {
    background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
    color: '#e2e8f0', padding: '4px 8px', fontSize: 12, fontFamily: 'inherit', outline: 'none',
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <span style={{ ...labelStyle, fontSize: 10 }}>Animation</span>
      <select style={sel} value={v.type} onChange={(e) => onChange({ ...v, type: e.target.value as AnimationType })}>
        {ANIMATION_TYPES.map((tp) => <option key={tp} value={tp}>{tp}</option>)}
      </select>
      <input type="number" min={100} max={4000} step={50} title="Duration (ms)" style={{ ...sel, width: 78 }}
        value={v.durationMs ?? 700} onChange={(e) => onChange({ ...v, durationMs: Number(e.target.value) })} />
      <input type="number" min={0} max={4000} step={50} title="Delay (ms)" style={{ ...sel, width: 70 }}
        value={v.delayMs ?? 0} onChange={(e) => onChange({ ...v, delayMs: Number(e.target.value) })} />
    </div>
  );
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[\s_]+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 60) || 'invitation';
}

const DEFAULT_ANIMS: Partial<Record<SectionKey, SectionAnimation>> = {
  hero: { type: 'zoom', durationMs: 900, delayMs: 0 },
  greeting: { type: 'fade', durationMs: 800, delayMs: 0 },
  venue: { type: 'slide-up', durationMs: 800, delayMs: 0 },
  timing: { type: 'slide-left', durationMs: 800, delayMs: 0 },
  rsvp: { type: 'slide-up', durationMs: 800, delayMs: 0 },
  countdown: { type: 'zoom', durationMs: 800, delayMs: 0 },
  contacts: { type: 'fade', durationMs: 800, delayMs: 0 },
};

export const GuestInvitationBuilderPage = () => {
  const { id } = useParams();
  const isNew = !id;
  const accessToken = useAuthStore((s) => s.accessToken);
  const role = useAuthStore((s) => s.role);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const existingQuery = useQuery({
    queryKey: ['guest-invitation', id],
    queryFn: () => guestInvitationService.get(String(id)),
    enabled: !!accessToken && !!id,
  });
  const rsvpsQuery = useQuery({
    queryKey: ['guest-invitation-rsvps', id],
    queryFn: () => guestInvitationService.listRsvps(String(id)),
    enabled: !!accessToken && !!id,
  });

  const [form, setForm] = useState<Partial<GuestInvitation>>({});
  const [savedFlash, setSavedFlash] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (existingQuery.data && !initialized) {
      setForm(existingQuery.data);
      setInitialized(true);
    } else if (isNew && !initialized) {
      setForm({
        slug: '',
        accentColor: '#c9a42c',
        backgroundColor: '#fafaf7',
        trailTemplate: 'hearts',
        trailColor: '#c2185b',
        coupleNames: '',
        heroSubtitle: 'ЛИСТАЙТЕ ВНИЗ',
        greetingTitle: 'ДОРОГОЙ ГОСТЬ',
        venueLabel: 'РЕСТОРАН',
        mapButtonLabel: 'КАРТА',
        timingTitle: 'TIMING',
        timingItems: [],
        brandLabel: 'INVITE UZ',
        rsvpTitle: 'ПОДТВЕРДИТЕ ПРИСУТСТВИЕ',
        rsvpEnabled: true,
        sectionAnimations: DEFAULT_ANIMS,
        isPublished: true,
      });
      setInitialized(true);
    }
  }, [existingQuery.data, isNew, initialized]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { ...form, slug: form.slug?.trim() || slugify(form.coupleNames || 'invitation') };
      if (!isNew && id) return guestInvitationService.update(id, payload);
      return guestInvitationService.create(payload as Partial<GuestInvitation> & { slug: string });
    },
    onSuccess: (inv) => {
      setError(null);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1500);
      queryClient.invalidateQueries({ queryKey: ['manager-guest-invitations'] });
      const url = buildSubdomainBase(`${inv.slug}.invitation`, '/');
      QRCode.toDataURL(url, { width: 320, margin: 2, color: { dark: '#0f172a', light: '#ffffff' } })
        .then(setQrDataUrl).catch(() => setQrDataUrl(null));
      if (isNew) navigate(`/invitations/${inv.id}`, { replace: true });
    },
    onError: (e) => {
      if (axios.isAxiosError(e)) setError((e.response?.data as { message?: string })?.message ?? e.message);
      else if (e instanceof Error) setError(e.message);
      else setError('Save failed');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => (id ? guestInvitationService.remove(id) : Promise.resolve()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manager-guest-invitations'] });
      navigate('/invitations');
    },
  });

  if (!accessToken) return <Navigate to="/login" replace />;
  if (role !== 'MANAGER' && role !== 'CHIEF_ADMIN') return <Navigate to="/login" replace />;

  const set = <K extends keyof GuestInvitation>(k: K, v: GuestInvitation[K]) => setForm((f) => ({ ...f, [k]: v }));
  const setAnim = (key: SectionKey, value: SectionAnimation) =>
    setForm((f) => ({ ...f, sectionAnimations: { ...(f.sectionAnimations ?? {}), [key]: value } }));
  const animOf = (key: SectionKey) => form.sectionAnimations?.[key];

  const publicUrl = form.slug ? buildSubdomainBase(`${form.slug}.invitation`, '/') : '';
  const timing = form.timingItems ?? [];

  const setTiming = (items: TimingItem[]) => set('timingItems', items);
  const colorRow = (key: 'accentColor' | 'backgroundColor' | 'trailColor', fallback: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <input type="color" value={form[key] ?? fallback} onChange={(e) => set(key, e.target.value)}
        style={{ width: 42, height: 36, borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', cursor: 'pointer' }} />
      <input value={form[key] ?? fallback} onChange={(e) => set(key, e.target.value)} style={inputStyle} />
    </div>
  );

  return (
    <div className="adm-bg">
      <nav style={{ position: 'sticky', top: 0, zIndex: 30, background: 'rgba(15,23,42,0.78)', backdropFilter: 'blur(18px)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <Link to="/invitations" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
            <img src={networkingLogoSrc} alt="" style={{ height: 40, width: 'auto' }} />
            <div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#f8fafc' }}>Invitation Designer</p>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: 'rgba(226,232,240,0.55)' }}>{form.coupleNames || (isNew ? 'New invitation' : '...')}</p>
            </div>
          </Link>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {publicUrl && (
              <a href={publicUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#c9a42c', textDecoration: 'none', padding: '6px 12px', borderRadius: 8, background: 'rgba(201,164,44,0.08)', border: '1px solid rgba(201,164,44,0.3)' }}>Preview ↗</a>
            )}
            {!isNew && (
              <button type="button" onClick={() => { if (confirm('Delete this invitation?')) deleteMutation.mutate(); }} className="adm-btn-danger" style={{ fontSize: 12 }}>Delete</button>
            )}
            <button type="button" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="adm-btn-primary" style={{ fontSize: 13 }}>
              {saveMutation.isPending ? 'Saving...' : (isNew ? 'Create invitation' : 'Save changes')}
            </button>
          </div>
        </div>
      </nav>

      <main className="tablet-fade-in" style={{ maxWidth: 1180, margin: '0 auto', padding: '28px 20px', position: 'relative', zIndex: 1, display: 'grid', gap: 16 }}>
        <Link to="/invitations" style={{ fontSize: 12, color: 'rgba(226,232,240,0.6)', textDecoration: 'none' }}>← Back to invitations</Link>

        {error && <div style={{ padding: 12, borderRadius: 10, background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.35)', color: '#fca5a5', fontSize: 13 }}>{error}</div>}
        {savedFlash && <div style={{ padding: 12, borderRadius: 10, background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.35)', color: '#4ade80', fontSize: 13, fontWeight: 600 }}>✓ Saved</div>}

        {qrDataUrl && <QrModal qrDataUrl={qrDataUrl} publicUrl={publicUrl} slug={form.slug} onClose={() => setQrDataUrl(null)} />}

        <Section title="Slug & link">
          <Field label="Slug"><input value={form.slug ?? ''} onChange={(e) => set('slug', e.target.value)} style={inputStyle} placeholder="savlat-jasmina" /></Field>
          {publicUrl && <p style={{ margin: 0, fontSize: 12, color: 'rgba(226,232,240,0.55)' }}>Public URL: <code style={{ color: '#c9a42c' }}>{publicUrl}</code></p>}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#e2e8f0' }}>
            <input type="checkbox" checked={form.isPublished ?? true} onChange={(e) => set('isPublished', e.target.checked)} />
            Published (visible at the public URL)
          </label>
        </Section>

        <Section title="Theme">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
            <Field label="Accent color">{colorRow('accentColor', '#c9a42c')}</Field>
            <Field label="Background color">{colorRow('backgroundColor', '#fafaf7')}</Field>
          </div>
        </Section>

        <Section title="Cursor / finger trail">
          <Field label="Template">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {TRAIL_TEMPLATES.map((tpl) => {
                const on = (form.trailTemplate ?? 'sparkle') === tpl.key;
                return (
                  <button key={tpl.key} type="button" onClick={() => set('trailTemplate', tpl.key)}
                    style={{ padding: '7px 14px', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600, border: '1px solid',
                      borderColor: on ? 'rgba(201,164,44,0.5)' : 'rgba(255,255,255,0.12)',
                      background: on ? 'rgba(201,164,44,0.15)' : 'rgba(15,23,42,0.5)', color: on ? '#c9a42c' : '#e2e8f0' }}>
                    {tpl.label}{on ? ' ✓' : ''}
                  </button>
                );
              })}
            </div>
          </Field>
          <Field label="Trail color">{colorRow('trailColor', '#c2185b')}</Field>
        </Section>

        <Section title="Background music">
          <AudioUploadField label="Music file" value={form.musicUrl} onChange={(url) => set('musicUrl', url)} restaurantId="" />
          <Field label="Or paste a music URL"><input value={form.musicUrl ?? ''} onChange={(e) => set('musicUrl', e.target.value || null)} style={inputStyle} placeholder="https://example.com/song.mp3" /></Field>
        </Section>

        <Section title="Hero (couple)" animKey="hero" anim={animOf('hero')} onAnim={setAnim}>
          <Field label="Couple names"><input value={form.coupleNames ?? ''} onChange={(e) => set('coupleNames', e.target.value)} style={inputStyle} placeholder="САВЛАТ И ЖАСМИНА" /></Field>
          <Field label="Subtitle (scroll hint)"><input value={form.heroSubtitle ?? ''} onChange={(e) => set('heroSubtitle', e.target.value)} style={inputStyle} placeholder="ЛИСТАЙТЕ ВНИЗ" /></Field>
          <PhotoUploadField label="Hero photo" value={form.heroImageUrl} onChange={(url) => set('heroImageUrl', url)} restaurantId="" />
        </Section>

        <Section title="Dear guest" animKey="greeting" anim={animOf('greeting')} onAnim={setAnim}>
          <Field label="Title"><input value={form.greetingTitle ?? ''} onChange={(e) => set('greetingTitle', e.target.value)} style={inputStyle} placeholder="ДОРОГОЙ ГОСТЬ" /></Field>
          <Field label="Message"><textarea value={form.greetingMessage ?? ''} onChange={(e) => set('greetingMessage', e.target.value)} style={{ ...inputStyle, height: 'auto', minHeight: 90, resize: 'vertical' }} /></Field>
          <Field label="Couple signature"><input value={form.coupleSignature ?? ''} onChange={(e) => set('coupleSignature', e.target.value)} style={inputStyle} placeholder="SAVLAT & JASMINA" /></Field>
        </Section>

        <Section title="Venue & map" animKey="venue" anim={animOf('venue')} onAnim={setAnim}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
            <Field label="Label"><input value={form.venueLabel ?? ''} onChange={(e) => set('venueLabel', e.target.value)} style={inputStyle} placeholder="РЕСТОРАН" /></Field>
            <Field label="Venue name"><input value={form.venueName ?? ''} onChange={(e) => set('venueName', e.target.value)} style={inputStyle} placeholder="FOTIMA SULTAN" /></Field>
          </div>
          <Field label="Event date & time">
            <input type="datetime-local" value={form.eventDate ? form.eventDate.slice(0, 16) : ''}
              onChange={(e) => set('eventDate', e.target.value ? new Date(e.target.value).toISOString() : null)} style={inputStyle} />
          </Field>
          <PhotoUploadField label="Venue photo" value={form.venueImageUrl} onChange={(url) => set('venueImageUrl', url)} restaurantId="" />
          <Field label="Map address (opens Yandex Maps)"><input value={form.mapAddress ?? ''} onChange={(e) => set('mapAddress', e.target.value)} style={inputStyle} placeholder="Tashkent, Fotima Sultan restaurant" /></Field>
          <Field label="Map button label"><input value={form.mapButtonLabel ?? ''} onChange={(e) => set('mapButtonLabel', e.target.value)} style={inputStyle} placeholder="КАРТА" /></Field>
        </Section>

        <Section title="Timing schedule" animKey="timing" anim={animOf('timing')} onAnim={setAnim}>
          <Field label="Section title"><input value={form.timingTitle ?? ''} onChange={(e) => set('timingTitle', e.target.value)} style={inputStyle} placeholder="TIMING" /></Field>
          <TimingEditor items={timing} onChange={setTiming} />
        </Section>

        <Section title="Countdown" animKey="countdown" anim={animOf('countdown')} onAnim={setAnim}>
          <Field label="Target date & time">
            <input type="datetime-local" value={form.countdownAt ? form.countdownAt.slice(0, 16) : ''}
              onChange={(e) => set('countdownAt', e.target.value ? new Date(e.target.value).toISOString() : null)} style={inputStyle} />
          </Field>
          <Field label="Label"><input value={form.countdownLabel ?? ''} onChange={(e) => set('countdownLabel', e.target.value)} style={inputStyle} placeholder="ДО ВСТРЕЧИ ЧЕРЕЗ" /></Field>
        </Section>

        <Section title="RSVP" animKey="rsvp" anim={animOf('rsvp')} onAnim={setAnim}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#e2e8f0' }}>
            <input type="checkbox" checked={form.rsvpEnabled ?? true} onChange={(e) => set('rsvpEnabled', e.target.checked)} />
            Accept guest responses
          </label>
          <Field label="Title"><input value={form.rsvpTitle ?? ''} onChange={(e) => set('rsvpTitle', e.target.value)} style={inputStyle} placeholder="ПОДТВЕРДИТЕ ПРИСУТСТВИЕ" /></Field>
        </Section>

        <Section title="Contacts" animKey="contacts" anim={animOf('contacts')} onAnim={setAnim}>
          <Field label="Brand label"><input value={form.brandLabel ?? ''} onChange={(e) => set('brandLabel', e.target.value)} style={inputStyle} placeholder="INVITE UZ" /></Field>
          <Field label="Telegram URL"><input value={form.telegramUrl ?? ''} onChange={(e) => set('telegramUrl', e.target.value)} style={inputStyle} placeholder="https://t.me/..." /></Field>
          <Field label="Phone"><input value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value)} style={inputStyle} placeholder="+998 ..." /></Field>
          <Field label="Instagram URL"><input value={form.instagramUrl ?? ''} onChange={(e) => set('instagramUrl', e.target.value)} style={inputStyle} placeholder="https://instagram.com/..." /></Field>
        </Section>

        {!isNew && (
          <Section title={`Responses (${rsvpsQuery.data?.length ?? 0})`}>
            {(rsvpsQuery.data ?? []).length === 0
              ? <p style={{ margin: 0, fontSize: 13, color: 'rgba(226,232,240,0.5)' }}>No responses yet.</p>
              : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {(rsvpsQuery.data ?? []).map((r) => (
                    <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <span style={{ flex: 1, color: '#f8fafc', fontSize: 13 }}>{r.guestName}</span>
                      <span className="adm-badge" style={{
                        background: r.attending ? 'rgba(34,197,94,0.15)' : 'rgba(220,38,38,0.15)',
                        color: r.attending ? '#4ade80' : '#fca5a5',
                        border: `1px solid ${r.attending ? 'rgba(34,197,94,0.35)' : 'rgba(220,38,38,0.35)'}`,
                      }}>{r.attending ? 'Attending' : 'Declined'}</span>
                      <span style={{ fontSize: 11, color: 'rgba(226,232,240,0.45)' }}>{new Date(r.createdAt).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              )}
          </Section>
        )}
      </main>
    </div>
  );
};

function TimingEditor({ items, onChange }: { items: TimingItem[]; onChange: (items: TimingItem[]) => void }) {
  const update = (i: number, patch: Partial<TimingItem>) => onChange(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  const move = (i: number, dir: -1 | 1) => {
    const next = i + dir;
    if (next < 0 || next >= items.length) return;
    const copy = [...items];
    [copy[i], copy[next]] = [copy[next], copy[i]];
    onChange(copy);
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map((it, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input value={it.time} onChange={(e) => update(i, { time: e.target.value })} placeholder="18:40" style={{ ...inputStyle, width: 90 }} />
          <input value={it.label} onChange={(e) => update(i, { label: e.target.value })} placeholder="СБОР ГОСТЕЙ" style={{ ...inputStyle, flex: 1 }} />
          <button type="button" onClick={() => move(i, -1)} disabled={i === 0} style={miniBtn(i === 0)}>↑</button>
          <button type="button" onClick={() => move(i, 1)} disabled={i === items.length - 1} style={miniBtn(i === items.length - 1)}>↓</button>
          <button type="button" onClick={() => remove(i)} style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(220,38,38,0.85)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 15, lineHeight: 1, flexShrink: 0 }}>×</button>
        </div>
      ))}
      <button type="button" className="adm-btn-ghost" style={{ fontSize: 13, alignSelf: 'flex-start' }}
        onClick={() => onChange([...items, { time: '', label: '' }])}>+ Add row</button>
    </div>
  );
}
function miniBtn(disabled: boolean): React.CSSProperties {
  return { width: 28, height: 28, borderRadius: 6, background: disabled ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.08)', color: disabled ? 'rgba(226,232,240,0.3)' : 'rgba(226,232,240,0.8)', border: '1px solid rgba(255,255,255,0.1)', cursor: disabled ? 'default' : 'pointer', fontSize: 12, lineHeight: 1, flexShrink: 0 };
}

function QrModal({ qrDataUrl, publicUrl, slug, onClose }: { qrDataUrl: string; publicUrl: string; slug?: string; onClose: () => void }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} className="scale-in" style={{ width: '100%', maxWidth: 360, borderRadius: 18, background: 'rgba(15,23,42,0.98)', border: '1px solid rgba(201,164,44,0.35)', boxShadow: '0 20px 60px rgba(0,0,0,0.5)', padding: 22, textAlign: 'center' }}>
        <p style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: '#f8fafc' }}>Invitation ready</p>
        <p style={{ margin: '0 0 16px', fontSize: 12, color: 'rgba(226,232,240,0.6)' }}>Scan to open the invitation</p>
        <img src={qrDataUrl} alt="QR code" style={{ width: 220, height: 220, borderRadius: 12, background: '#fff', padding: 8 }} />
        {publicUrl && <a href={publicUrl} target="_blank" rel="noreferrer" style={{ display: 'block', margin: '14px 0 0', fontSize: 12, color: '#c9a42c', wordBreak: 'break-all' }}>{publicUrl}</a>}
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <a href={qrDataUrl} download={`invitation-${slug ?? 'qr'}.png`} className="adm-btn-primary" style={{ flex: 1, fontSize: 13, textAlign: 'center', textDecoration: 'none', padding: '9px 0' }}>Download QR</a>
          <button type="button" onClick={onClose} style={{ flex: 1, fontSize: 13, borderRadius: 10, background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(226,232,240,0.8)', cursor: 'pointer' }}>Close</button>
        </div>
      </div>
    </div>
  );
}
