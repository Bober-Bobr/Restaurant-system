import type { Block, BlockFieldDef, ButtonAction, GalleryItem, MenuShowcaseItem, SocialLink, TimingItem } from './types';
import { BLOCK_DEFS } from './types';
import { FONT_OPTIONS, fontStack } from './fonts';
import type { SectionAnimation, AnimationType } from '../services/guestInvitation.service';
import type { TranslationKey } from '../utils/translate';
import { PhotoUploadField } from '../components/PhotoUploadField';
import { NumberField } from '../components/ui/NumberField';
import { VideoUploadField } from '../components/VideoUploadField';
import { getPhotoUrl } from '../utils/photoUrl';

type T = (k: TranslationKey) => string;

const input: React.CSSProperties = {
  background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
  color: '#e2e8f0', padding: '9px 12px', fontSize: 13, fontFamily: 'inherit', outline: 'none', width: '100%',
};
const label: React.CSSProperties = { fontSize: 11, color: 'rgba(226,232,240,0.6)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' };

const ANIMATION_TYPES: AnimationType[] = ['none', 'fade', 'slide-up', 'slide-down', 'slide-left', 'slide-right', 'zoom', 'blur', 'flip'];

export function BlockSettings({ block, onChange, t, restaurantId }: {
  block: Block;
  onChange: (b: Block) => void;
  t: T;
  restaurantId: string;
}) {
  const def = BLOCK_DEFS[block.type];
  const setProp = (k: string, v: unknown) => onChange({ ...block, props: { ...block.props, [k]: v } });
  const setAnim = (a: SectionAnimation) => onChange({ ...block, anim: a });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Hide this block from the published page (still editable here). */}
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#e2e8f0', padding: '8px 10px', borderRadius: 10, background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <input type="checkbox" checked={block.hidden === true} onChange={(e) => onChange({ ...block, hidden: e.target.checked })} />
        {t('hide_block')}
      </label>
      {def.fields.map((f) => (
        <FieldEditor key={f.key} field={f} value={block.props[f.key]} onChange={(v) => setProp(f.key, v)} t={t} restaurantId={restaurantId} />
      ))}
      {/* Per-block text color — available on every block (empty = inherit the
          page-wide theme color). */}
      <FieldEditor
        field={{ key: 'textColor', labelKey: 'bf_text_color', type: 'color' }}
        value={block.props.textColor}
        onChange={(v) => setProp('textColor', v)}
        t={t}
        restaurantId={restaurantId}
      />
      {block.props.textColor ? (
        <button type="button" onClick={() => setProp('textColor', '')} style={{ justifySelf: 'start', marginTop: -6, background: 'none', border: 'none', color: 'rgba(226,232,240,0.55)', fontSize: 11, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>{t('reset_auto')}</button>
      ) : null}
      {/* Per-block font size — headings and body text, available on every block. */}
      <FontSizeControls
        heading={typeof block.props.headingScale === 'number' ? block.props.headingScale : 1}
        body={typeof block.props.bodyScale === 'number' ? block.props.bodyScale : 1}
        onHeading={(v) => setProp('headingScale', v)}
        onBody={(v) => setProp('bodyScale', v)}
        t={t}
      />
      <FontControls
        heading={typeof block.props.headingFont === 'string' ? block.props.headingFont : ''}
        body={typeof block.props.bodyFont === 'string' ? block.props.bodyFont : ''}
        onHeading={(v) => setProp('headingFont', v)}
        onBody={(v) => setProp('bodyFont', v)}
        t={t}
      />
      <AnimationControls value={block.anim} onChange={setAnim} t={t} />
    </div>
  );
}

function Labeled({ text, children }: { text: string; children: React.ReactNode }) {
  return <label style={{ display: 'grid', gap: 5 }}><span style={label}>{text}</span>{children}</label>;
}

// Two dropdowns (headings + body) choosing a font family per block. Each option
// previews in its own font; the empty key keeps the design's default font.
function FontControls({ heading, body, onHeading, onBody, t }: {
  heading: string; body: string; onHeading: (v: string) => void; onBody: (v: string) => void; t: T;
}) {
  const select = (val: string, on: (v: string) => void, lbl: string) => (
    <div style={{ display: 'grid', gap: 4 }}>
      <span style={label}>{lbl}</span>
      <select
        value={val}
        onChange={(e) => on(e.target.value)}
        style={{ ...input, fontFamily: fontStack(val) || 'inherit', cursor: 'pointer' }}
      >
        {FONT_OPTIONS.map((f) => (
          <option key={f.key} value={f.key} style={{ fontFamily: f.stack || 'inherit', color: '#111' }}>{f.label}</option>
        ))}
      </select>
    </div>
  );
  return (
    <div style={{ display: 'grid', gap: 10, padding: '10px 12px', borderRadius: 10, background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <span style={{ ...label, color: 'rgba(226,232,240,0.85)' }}>{t('bf_fonts')}</span>
      {select(heading, onHeading, t('bf_heading_size'))}
      {select(body, onBody, t('bf_body_size'))}
    </div>
  );
}

// Two sliders (headings + body) that write a font-size multiplier onto the
// block. 1 = the design's default size; the renderer clamps to [0.6, 2].
function FontSizeControls({ heading, body, onHeading, onBody, t }: {
  heading: number; body: number; onHeading: (v: number) => void; onBody: (v: number) => void; t: T;
}) {
  const row = (val: number, on: (v: number) => void, lbl: string) => (
    <div style={{ display: 'grid', gap: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={label}>{lbl}</span>
        <span style={{ fontSize: 11, color: 'rgba(226,232,240,0.85)', fontVariantNumeric: 'tabular-nums' }}>{Math.round(val * 100)}%</span>
      </div>
      <input
        type="range" min={0.6} max={2} step={0.05} value={val}
        onChange={(e) => on(Number(e.target.value))}
        style={{ width: '100%', accentColor: '#c9a42c', cursor: 'pointer' }}
      />
    </div>
  );
  return (
    <div style={{ display: 'grid', gap: 10, padding: '10px 12px', borderRadius: 10, background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <span style={{ ...label, color: 'rgba(226,232,240,0.85)' }}>{t('bf_font_sizes')}</span>
      {row(heading, onHeading, t('bf_heading_size'))}
      {row(body, onBody, t('bf_body_size'))}
    </div>
  );
}

function FieldEditor({ field, value, onChange, t, restaurantId }: {
  field: BlockFieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
  t: T;
  restaurantId: string;
}) {
  const txt = typeof value === 'string' ? value : '';
  switch (field.type) {
    case 'text':
      return <Labeled text={t(field.labelKey)}><input style={input} value={txt} onChange={(e) => onChange(e.target.value)} /></Labeled>;
    case 'textarea':
      return <Labeled text={t(field.labelKey)}><textarea style={{ ...input, minHeight: 90, resize: 'vertical' }} value={txt} onChange={(e) => onChange(e.target.value)} /></Labeled>;
    case 'html':
      return <Labeled text={t(field.labelKey)}><textarea spellCheck={false} placeholder="<div>…</div>" style={{ ...input, minHeight: 160, resize: 'vertical', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12, whiteSpace: 'pre' }} value={txt} onChange={(e) => onChange(e.target.value)} /></Labeled>;
    case 'color':
      return (
        <Labeled text={t(field.labelKey)}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="color" value={txt || '#000000'} onChange={(e) => onChange(e.target.value)} style={{ width: 42, height: 36, borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', cursor: 'pointer' }} />
            <input style={input} value={txt} onChange={(e) => onChange(e.target.value)} />
          </div>
        </Labeled>
      );
    case 'datetime':
      return <DateTimeField label={t(field.labelKey)} value={txt} onChange={onChange} t={t} />;
    case 'number':
      return <Labeled text={t(field.labelKey)}><input type="number" min={1} max={60} step={0.5} style={input} value={typeof value === 'number' ? value : ''} onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))} /></Labeled>;
    case 'boolean':
      return (
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#e2e8f0' }}>
          <input type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} />
          {t(field.labelKey)}
        </label>
      );
    case 'select':
      return (
        <Labeled text={t(field.labelKey)}>
          <select style={input} value={txt} onChange={(e) => onChange(e.target.value)}>
            {(field.options ?? []).map((o) => <option key={o.value} value={o.value}>{t(o.labelKey)}</option>)}
          </select>
        </Labeled>
      );
    case 'image':
      return <PhotoUploadField label={t(field.labelKey)} value={txt || null} onChange={(url) => onChange(url)} restaurantId={restaurantId} hint={t('drop_or_paste')} />;
    case 'video':
      return <VideoUploadField label={t(field.labelKey)} value={txt || null} onChange={(url) => onChange(url)} restaurantId={restaurantId} hint={t('drop_or_paste')} />;
    case 'action':
      return <ActionEditor value={value as ButtonAction | undefined} onChange={onChange} t={t} />;
    case 'gallery':
      return <GalleryItemsEditor items={Array.isArray(value) ? (value as GalleryItem[]) : []} onChange={onChange} t={t} restaurantId={restaurantId} />;
    case 'menu':
      return <MenuItemsEditor items={Array.isArray(value) ? (value as MenuShowcaseItem[]) : []} onChange={onChange} t={t} restaurantId={restaurantId} labelText={t(field.labelKey)} />;
    case 'socials':
      return <SocialsEditor items={Array.isArray(value) ? (value as SocialLink[]) : []} onChange={onChange} t={t} />;
    case 'timing':
      return <TimingEditor items={Array.isArray(value) ? (value as TimingItem[]) : []} onChange={onChange} t={t} />;
    default:
      return null;
  }
}

// ── Date + time picker ───────────────────────────────────────────────────────
// Split into a plain date input and a time input — clearer than a combined
// datetime-local, especially on mobile. The value is stored as an absolute
// instant (ISO/UTC) so the countdown reaches zero at the same real moment for
// every viewer; here we convert to/from the editor's LOCAL wall-clock so the
// time shown is exactly what was entered (fixes the timezone drift where a
// saved 19:00 reopened as 14:00).
function pad2(n: number): string { return String(n).padStart(2, '0'); }
function isoToLocalParts(iso: string): { date: string; time: string } {
  if (!iso) return { date: '', time: '' };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: '', time: '' };
  return {
    date: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`,
    time: `${pad2(d.getHours())}:${pad2(d.getMinutes())}`,
  };
}
function localPartsToIso(date: string, time: string): string | null {
  if (!date) return null;
  const d = new Date(`${date}T${time || '00:00'}`); // parsed in local time
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function DateTimeField({ label, value, onChange, t }: { label: string; value: string; onChange: (v: string | null) => void; t: T }) {
  const { date, time } = isoToLocalParts(value);
  return (
    <Labeled text={label}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          type="date"
          style={{ ...input, flex: '1 1 56%', colorScheme: 'dark' }}
          value={date}
          onChange={(e) => onChange(localPartsToIso(e.target.value, time))}
        />
        <input
          type="time"
          style={{ ...input, flex: '1 1 44%', colorScheme: 'dark' }}
          value={time}
          onChange={(e) => onChange(localPartsToIso(date, e.target.value))}
        />
        {value && (
          <button type="button" onClick={() => onChange(null)} title={t('reset_auto')}
            style={{ width: 28, height: 28, flexShrink: 0, borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(15,23,42,0.9)', color: '#e2e8f0', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}>×</button>
        )}
      </div>
    </Labeled>
  );
}

function ActionEditor({ value, onChange, t }: { value?: ButtonAction; onChange: (v: ButtonAction) => void; t: T }) {
  const v: ButtonAction = value ?? { kind: 'link', value: '' };
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <Labeled text={t('bf_action')}>
        <select style={input} value={v.kind} onChange={(e) => onChange({ ...v, kind: e.target.value as ButtonAction['kind'] })}>
          <option value="link">{t('action_link')}</option>
          <option value="phone">{t('action_phone')}</option>
          <option value="telegram">{t('action_telegram')}</option>
          <option value="map">{t('action_map')}</option>
        </select>
      </Labeled>
      <Labeled text={t('action_value')}><input style={input} value={v.value} onChange={(e) => onChange({ ...v, value: e.target.value })} /></Labeled>
    </div>
  );
}

function rowBox(children: React.ReactNode) {
  return <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: 8, borderRadius: 10, background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(255,255,255,0.08)' }}>{children}</div>;
}
function delBtn(onClick: () => void) {
  return <button type="button" onClick={onClick} style={{ width: 26, height: 26, borderRadius: '50%', background: 'rgba(220,38,38,0.85)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 14, lineHeight: 1, flexShrink: 0 }}>×</button>;
}
function addBtn(onClick: () => void, text: string) {
  return <button type="button" className="adm-btn-ghost" style={{ fontSize: 13, alignSelf: 'flex-start' }} onClick={onClick}>+ {text}</button>;
}

function GalleryItemsEditor({ items, onChange, t, restaurantId }: { items: GalleryItem[]; onChange: (v: GalleryItem[]) => void; t: T; restaurantId: string }) {
  // Reorder items (photos/videos) — the carousel plays them in this order.
  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    onChange(next);
  };
  return (
    <Labeled text={t('bf_gallery')}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((it, i) => (
          rowBox(<>
            <img src={getPhotoUrl(it.photoUrl) ?? it.photoUrl} alt="" style={{ width: 54, height: 42, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />
            <input style={{ ...input, flex: 1 }} placeholder="https://instagram.com/reel/..." value={it.videoUrl ?? ''} onChange={(e) => onChange(items.map((x, j) => j === i ? { ...x, videoUrl: e.target.value || null } : x))} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
              {moveBtn(() => move(i, i - 1), '↑', i === 0, t('move_up'))}
              {moveBtn(() => move(i, i + 1), '↓', i === items.length - 1, t('move_down'))}
            </div>
            {delBtn(() => onChange(items.filter((_, j) => j !== i)))}
          </>)
        ))}
        <PhotoUploadField label={t('add_item')} value={null} onChange={(url) => { if (url) onChange([...items, { photoUrl: url, videoUrl: null }]); }} restaurantId={restaurantId} height={90} hint={t('drop_or_paste')} />
      </div>
    </Labeled>
  );
}

function moveBtn(onClick: () => void, glyph: string, disabled: boolean, title: string) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title}
      style={{ width: 24, height: 20, borderRadius: 5, border: '1px solid rgba(255,255,255,0.12)', cursor: disabled ? 'default' : 'pointer', background: 'rgba(15,23,42,0.9)', color: disabled ? 'rgba(226,232,240,0.25)' : '#e2e8f0', fontSize: 11, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{glyph}</button>
  );
}

function MenuItemsEditor({ items, onChange, t, restaurantId, labelText }: { items: MenuShowcaseItem[]; onChange: (v: MenuShowcaseItem[]) => void; t: T; restaurantId: string; labelText?: string }) {
  const renumber = (list: MenuShowcaseItem[]) => list.map((x, i) => ({ ...x, number: i + 1 }));
  return (
    <Labeled text={labelText ?? t('bf_menu')}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((it, i) => (
          rowBox(<>
            <span style={{ width: 22, textAlign: 'center', color: '#c9a42c', fontWeight: 700 }}>{it.number}</span>
            {it.photoUrl
              ? <img src={getPhotoUrl(it.photoUrl) ?? it.photoUrl} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />
              : <div style={{ width: 40, height: 40, borderRadius: 6, background: 'rgba(255,255,255,0.06)', flexShrink: 0 }} />}
            <input style={{ ...input, flex: 1 }} placeholder="Самса" value={it.name} onChange={(e) => onChange(items.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
            {delBtn(() => onChange(renumber(items.filter((_, j) => j !== i))))}
          </>)
        ))}
        <PhotoUploadField label={t('add_item')} value={null} onChange={(url) => { if (url) onChange(renumber([...items, { number: items.length + 1, name: '', photoUrl: url }])); }} restaurantId={restaurantId} height={90} hint={t('drop_or_paste')} />
        {addBtn(() => onChange(renumber([...items, { number: items.length + 1, name: '', photoUrl: null }])), t('add_row'))}
      </div>
    </Labeled>
  );
}

function SocialsEditor({ items, onChange, t }: { items: SocialLink[]; onChange: (v: SocialLink[]) => void; t: T }) {
  return (
    <Labeled text={t('bf_socials')}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((it, i) => (
          rowBox(<>
            <input style={{ ...input, width: 120 }} placeholder="@label" value={it.label} onChange={(e) => onChange(items.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} />
            <input style={{ ...input, flex: 1 }} placeholder="https://..." value={it.url} onChange={(e) => onChange(items.map((x, j) => j === i ? { ...x, url: e.target.value } : x))} />
            {delBtn(() => onChange(items.filter((_, j) => j !== i)))}
          </>)
        ))}
        {addBtn(() => onChange([...items, { label: '', url: '' }]), t('add_row'))}
      </div>
    </Labeled>
  );
}

function TimingEditor({ items, onChange, t }: { items: TimingItem[]; onChange: (v: TimingItem[]) => void; t: T }) {
  return (
    <Labeled text={t('bf_timing')}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((it, i) => (
          rowBox(<>
            <input style={{ ...input, width: 80 }} placeholder="18:40" value={it.time} onChange={(e) => onChange(items.map((x, j) => j === i ? { ...x, time: e.target.value } : x))} />
            <input style={{ ...input, flex: 1 }} placeholder="СБОР ГОСТЕЙ" value={it.label} onChange={(e) => onChange(items.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} />
            {delBtn(() => onChange(items.filter((_, j) => j !== i)))}
          </>)
        ))}
        {addBtn(() => onChange([...items, { time: '', label: '' }]), t('add_row'))}
      </div>
    </Labeled>
  );
}

export function AnimationControls({ value, onChange, t }: { value?: SectionAnimation; onChange: (v: SectionAnimation) => void; t: T }) {
  const v: SectionAnimation = value ?? { type: 'fade', durationMs: 700, delayMs: 0 };
  return (
    <div style={{ display: 'grid', gap: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
      <span style={label}>{t('animation')}</span>
      <select style={input} value={v.type} onChange={(e) => onChange({ ...v, type: e.target.value as AnimationType })}>
        {ANIMATION_TYPES.map((tp) => <option key={tp} value={tp}>{tp}</option>)}
      </select>
      <div style={{ display: 'flex', gap: 8 }}>
        <Labeled text={t('duration_ms')}><NumberField min={100} max={4000} step={50} style={input} value={v.durationMs ?? 700} onChange={(n) => onChange({ ...v, durationMs: n })} /></Labeled>
        <Labeled text={t('delay_ms')}><NumberField min={0} max={4000} step={50} style={input} value={v.delayMs ?? 0} onChange={(n) => onChange({ ...v, delayMs: n })} /></Labeled>
      </div>
    </div>
  );
}
