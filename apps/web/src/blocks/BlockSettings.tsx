import type { Block, BlockFieldDef, ButtonAction, GalleryItem, MenuShowcaseItem, SocialLink, TimingItem } from './types';
import { BLOCK_DEFS } from './types';
import type { SectionAnimation, AnimationType } from '../services/guestInvitation.service';
import type { TranslationKey } from '../utils/translate';
import { PhotoUploadField } from '../components/PhotoUploadField';
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
      {def.fields.map((f) => (
        <FieldEditor key={f.key} field={f} value={block.props[f.key]} onChange={(v) => setProp(f.key, v)} t={t} restaurantId={restaurantId} />
      ))}
      <AnimationControls value={block.anim} onChange={setAnim} t={t} />
    </div>
  );
}

function Labeled({ text, children }: { text: string; children: React.ReactNode }) {
  return <label style={{ display: 'grid', gap: 5 }}><span style={label}>{text}</span>{children}</label>;
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
      return <Labeled text={t(field.labelKey)}><input type="datetime-local" style={input} value={txt ? txt.slice(0, 16) : ''} onChange={(e) => onChange(e.target.value ? new Date(e.target.value).toISOString() : null)} /></Labeled>;
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
      return <PhotoUploadField label={t(field.labelKey)} value={txt || null} onChange={(url) => onChange(url)} restaurantId={restaurantId} />;
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
  return (
    <Labeled text={t('bf_gallery')}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((it, i) => (
          rowBox(<>
            <img src={getPhotoUrl(it.photoUrl) ?? it.photoUrl} alt="" style={{ width: 54, height: 42, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />
            <input style={{ ...input, flex: 1 }} placeholder="https://instagram.com/reel/..." value={it.videoUrl ?? ''} onChange={(e) => onChange(items.map((x, j) => j === i ? { ...x, videoUrl: e.target.value || null } : x))} />
            {delBtn(() => onChange(items.filter((_, j) => j !== i)))}
          </>)
        ))}
        <PhotoUploadField label={t('add_item')} value={null} onChange={(url) => { if (url) onChange([...items, { photoUrl: url, videoUrl: null }]); }} restaurantId={restaurantId} height={90} />
      </div>
    </Labeled>
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
        <PhotoUploadField label={t('add_item')} value={null} onChange={(url) => { if (url) onChange(renumber([...items, { number: items.length + 1, name: '', photoUrl: url }])); }} restaurantId={restaurantId} height={90} />
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
        <Labeled text={t('duration_ms')}><input type="number" min={100} max={4000} step={50} style={input} value={v.durationMs ?? 700} onChange={(e) => onChange({ ...v, durationMs: Number(e.target.value) })} /></Labeled>
        <Labeled text={t('delay_ms')}><input type="number" min={0} max={4000} step={50} style={input} value={v.delayMs ?? 0} onChange={(e) => onChange({ ...v, delayMs: Number(e.target.value) })} /></Labeled>
      </div>
    </div>
  );
}
