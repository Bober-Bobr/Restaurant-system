import { useState } from 'react';
import type { Block, BlockType } from './types';
import { BLOCK_DEFS, PALETTE_ORDER, createBlock } from './types';
import { BlockView, VConnectFooter, VConnectContact, readableText, type RenderCtx } from './BlockRenderer';
import { useFlyerContact } from '../hooks/usePlatformContacts';
import { ParticleField, type ParticleKind } from './ParticleField';
import { BlockSettings } from './BlockSettings';
import type { DesignTheme } from '../services/designTemplate.service';
import type { TranslationKey } from '../utils/translate';
import { PhotoUploadField } from '../components/PhotoUploadField';
import { AudioUploadField } from '../components/AudioUploadField';
import { getPhotoUrl } from '../utils/photoUrl';

type T = (k: TranslationKey, p?: Record<string, string | number>) => string;

export type BlockEditorProps = {
  kind: 'flyer' | 'invitation' | 'plaque';
  blocks: Block[];
  theme: DesignTheme;
  onBlocksChange: (b: Block[]) => void;
  onThemeChange: (t: DesignTheme) => void;
  t: T;
  restaurantId?: string;
  showTrail?: boolean;
  // Linked event start: countdown blocks without an explicit target use it.
  eventDate?: string | null;
  // Restaurant logo shown by image blocks with "useLogo" enabled.
  logoUrl?: string | null;
};

function hexToRgba(hex: string, alpha: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec((hex || '').trim());
  if (!m) return `rgba(201,164,44,${alpha})`;
  return `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},${alpha})`;
}

const panelInput: React.CSSProperties = {
  background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
  color: '#e2e8f0', padding: '9px 12px', fontSize: 13, fontFamily: 'inherit', outline: 'none', width: '100%',
};
const panelLabel: React.CSSProperties = { fontSize: 11, color: 'rgba(226,232,240,0.6)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' };

export function BlockEditor({ kind, blocks, theme, onBlocksChange, onThemeChange, t, restaurantId = '', showTrail, eventDate, logoUrl }: BlockEditorProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  // Global v-connect details, overridden by this page's own vccontact block.
  const flyerContact = useFlyerContact(blocks);

  const accent = theme.accentColor || '#c9a42c';
  const bgColor = theme.backgroundColor || '#fafaf7';
  const bgImage = theme.backgroundImageUrl ? (getPhotoUrl(theme.backgroundImageUrl) ?? theme.backgroundImageUrl) : null;
  const pageBackground = bgImage
    ? `${bgColor} url(${bgImage}) top center / contain repeat`
    : `radial-gradient(circle at 20% 0%, ${hexToRgba(accent, 0.16)} 0%, transparent 42%), radial-gradient(circle at 80% 100%, ${hexToRgba(accent, 0.12)} 0%, transparent 50%), ${bgColor}`;

  const ctx: RenderCtx = { accent, replayAnim: true, text: theme.textColor || (bgImage ? '#f5f5f5' : readableText(bgColor)), textScale: theme.textScale ?? 1, eventDate, logoUrl };

  const setBlock = (b: Block) => onBlocksChange(blocks.map((x) => (x.id === b.id ? b : x)));
  const addBlock = (type: BlockType) => {
    const b = createBlock(type);
    onBlocksChange([...blocks, b]);
    setSelectedId(b.id);
    setPaletteOpen(false);
  };
  const removeBlock = (id: string) => { onBlocksChange(blocks.filter((b) => b.id !== id)); if (selectedId === id) setSelectedId(null); };
  const duplicateBlock = (id: string) => {
    const idx = blocks.findIndex((b) => b.id === id);
    if (idx < 0) return;
    const copy = { ...structuredClone(blocks[idx]), id: createBlock(blocks[idx].type).id };
    const next = [...blocks]; next.splice(idx + 1, 0, copy); onBlocksChange(next);
  };
  const move = (from: number, to: number) => {
    if (to < 0 || to >= blocks.length || from === to) return;
    const next = [...blocks]; const [m] = next.splice(from, 1); next.splice(to, 0, m); onBlocksChange(next);
  };
  const toggleHidden = (id: string) => onBlocksChange(blocks.map((b) => (b.id === id ? { ...b, hidden: !b.hidden } : b)));

  const selected = blocks.find((b) => b.id === selectedId) ?? null;
  const preview = mode === 'preview';

  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 12px 120px 56px' }}>
      {/* Phone-frame live preview (scaled down to 80%). In edit mode overflow stays
          visible so the per-block drag handles on the left rail are not clipped. */}
      <div style={{
        width: '100%', maxWidth: 460, borderRadius: 28, overflow: preview ? 'hidden' : 'visible',
        border: '10px solid #0b1120', boxShadow: '0 30px 80px rgba(0,0,0,0.5)', background: '#000',
        zoom: 0.8,
      }}>
        <div style={{ position: 'relative', background: pageBackground, minHeight: 600, fontFamily: '"Playfair Display", Georgia, serif' }}>
          <ParticleField kind={theme.particles as ParticleKind | undefined} imageUrl={theme.particlesImageUrl ? (getPhotoUrl(theme.particlesImageUrl) ?? theme.particlesImageUrl) : null} color={theme.particlesColor || accent} />
          {blocks.length === 0 && (
            <p style={{ padding: '80px 24px', textAlign: 'center', color: '#475569', fontSize: 14, fontFamily: 'system-ui, sans-serif' }}>{t('empty_design')}</p>
          )}
          {blocks.map((b, i) => (
            preview ? (
              (b.hidden || b.type === 'vccontact') ? null : <BlockView key={b.id} block={b} ctx={ctx} />
            ) : (
              <EditableBlock
                key={b.id}
                block={b} index={i} count={blocks.length}
                selected={selectedId === b.id}
                t={t}
                onSelect={() => setSelectedId(b.id)}
                onUp={() => move(i, i - 1)}
                onDown={() => move(i, i + 1)}
                onDuplicate={() => duplicateBlock(b.id)}
                onDelete={() => removeBlock(b.id)}
                onToggleHidden={() => toggleHidden(b.id)}
                onDragStart={() => setDragIndex(i)}
                onDropOn={() => { if (dragIndex !== null) move(dragIndex, i); setDragIndex(null); }}
              >
                <BlockView block={b} ctx={ctx} />
              </EditableBlock>
            )
          ))}
          {/* Every flyer ends with the mandatory V-connect attribution, then the
              contact card (in preview; in edit mode it shows as its own block). */}
          {(kind === 'flyer' || kind === 'plaque') && <VConnectFooter label={t('website_developed_by')} />}
          {(kind === 'flyer' || kind === 'plaque') && preview && (
            <VConnectContact
              phone={flyerContact.phone} telegram={flyerContact.telegram}
              title={t('vc_contact_title')} callLabel={t('vc_call')} telegramLabel={t('vc_telegram')}
            />
          )}
        </div>
      </div>

      {/* Bottom floating toolbar */}
      <div style={{ position: 'fixed', bottom: 18, left: '50%', transform: 'translateX(-50%)', zIndex: 40, display: 'flex', alignItems: 'center', gap: 8, padding: 8, borderRadius: 16, background: 'rgba(15,23,42,0.92)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 12px 40px rgba(0,0,0,0.4)' }}>
        <button type="button" onClick={() => setMode(preview ? 'edit' : 'preview')} title={t('preview')}
          style={{ width: 42, height: 42, borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: preview ? 'rgba(201,164,44,0.2)' : 'rgba(255,255,255,0.06)', color: '#e2e8f0', cursor: 'pointer', fontSize: 18 }}>👁</button>
        <button type="button" className="adm-btn-primary" onClick={() => setPaletteOpen(true)} style={{ fontSize: 14, padding: '11px 22px' }}>+ {t('add_block')}</button>
        <button type="button" onClick={() => setThemeOpen(true)} title={t('theme_settings')}
          style={{ width: 42, height: 42, borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: '#e2e8f0', cursor: 'pointer', fontSize: 18 }}>⚙</button>
      </div>

      {/* Add-block palette */}
      {paletteOpen && (
        <Modal onClose={() => setPaletteOpen(false)} title={t('choose_block')}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 }}>
            {PALETTE_ORDER.filter((type) => kind === 'flyer' || kind === 'plaque' || type !== 'vccontact').map((type) => (
              <button key={type} type="button" onClick={() => addBlock(type)}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '16px 8px', borderRadius: 12, background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.1)', color: '#e2e8f0', cursor: 'pointer' }}>
                <span style={{ fontSize: 24 }}>{BLOCK_DEFS[type].icon}</span>
                <span style={{ fontSize: 12 }}>{t(BLOCK_DEFS[type].labelKey)}</span>
              </button>
            ))}
          </div>
        </Modal>
      )}

      {/* Block settings slide-over */}
      {selected && !preview && (
        <SlideOver onClose={() => setSelectedId(null)} title={`${t('block_settings')}: ${t(BLOCK_DEFS[selected.type].labelKey)}`}>
          <BlockSettings block={selected} onChange={setBlock} t={t} restaurantId={restaurantId} />
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button type="button" className="adm-btn-ghost" style={{ flex: 1, fontSize: 13 }} onClick={() => duplicateBlock(selected.id)}>{t('duplicate_block')}</button>
            <button type="button" className="adm-btn-danger" style={{ flex: 1, fontSize: 13 }} onClick={() => removeBlock(selected.id)}>{t('delete_block')}</button>
          </div>
        </SlideOver>
      )}

      {/* Theme slide-over */}
      {themeOpen && (
        <SlideOver onClose={() => setThemeOpen(false)} title={t('theme_settings')}>
          <ThemePanel theme={theme} onChange={onThemeChange} t={t} restaurantId={restaurantId} showTrail={showTrail} />
        </SlideOver>
      )}
    </div>
  );
}

function EditableBlock({ block, index, count, selected, t, children, onSelect, onUp, onDown, onDuplicate, onDelete, onToggleHidden, onDragStart, onDropOn }: {
  block: Block; index: number; count: number; selected: boolean; t: T; children: React.ReactNode;
  onSelect: () => void; onUp: () => void; onDown: () => void; onDuplicate: () => void; onDelete: () => void;
  onToggleHidden: () => void; onDragStart: () => void; onDropOn: () => void;
}) {
  const hidden = block.hidden === true;
  return (
    <div
      onClick={onSelect}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); onDropOn(); }}
      style={{ position: 'relative', cursor: 'pointer', outline: selected ? '2px solid #c9a42c' : '2px solid transparent', outlineOffset: -2 }}
    >
      {/* Block toolbar */}
      <div style={{ position: 'absolute', top: 4, right: 4, zIndex: 5, display: 'flex', gap: 4, opacity: selected ? 1 : 0.0, transition: 'opacity 0.15s' }}
        className="block-toolbar"
        onClick={(e) => e.stopPropagation()}>
        <Mini draggable onDragStart={onDragStart} title="⠿">⠿</Mini>
        <Mini disabled={index === 0} onClick={onUp} title={t('move_up')}>↑</Mini>
        <Mini disabled={index === count - 1} onClick={onDown} title={t('move_down')}>↓</Mini>
        <Mini onClick={onToggleHidden} title={hidden ? t('show_block') : t('hide_block')}>{hidden ? '🙈' : '👁'}</Mini>
        <Mini onClick={onDuplicate} title={t('duplicate_block')}>⧉</Mini>
        <Mini onClick={onDelete} title={t('delete_block')} danger>×</Mini>
      </div>
      {/* "Hidden" badge so it's obvious the block won't appear on the page */}
      {hidden && (
        <div style={{ position: 'absolute', top: 4, left: 4, zIndex: 5, pointerEvents: 'none', padding: '3px 9px', borderRadius: 999, background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(255,255,255,0.14)', color: 'rgba(226,232,240,0.85)', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: 'system-ui, sans-serif' }}>{t('hidden_badge')}</div>
      )}
      {/* Left drag handle (always visible, like the reference) */}
      <div draggable onDragStart={onDragStart} onClick={(e) => e.stopPropagation()}
        title={block.type}
        style={{ position: 'absolute', left: -48, top: '50%', transform: 'translateY(-50%)', zIndex: 5, width: 30, height: 44, borderRadius: 8, background: 'rgba(15,23,42,0.92)', border: '1px solid rgba(255,255,255,0.14)', color: 'rgba(226,232,240,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'grab', fontSize: 15 }}>☰</div>
      <div style={{ pointerEvents: 'none', opacity: hidden ? 0.35 : 1, filter: hidden ? 'grayscale(0.4)' : 'none', transition: 'opacity 0.15s' }}>{children}</div>
    </div>
  );
}

function Mini({ children, onClick, disabled, danger, draggable, onDragStart, title }: {
  children: React.ReactNode; onClick?: () => void; disabled?: boolean; danger?: boolean; draggable?: boolean; onDragStart?: () => void; title?: string;
}) {
  return (
    <button type="button" disabled={disabled} draggable={draggable} onDragStart={onDragStart} onClick={onClick} title={title}
      style={{ width: 26, height: 26, borderRadius: 6, border: 'none', cursor: disabled ? 'default' : (draggable ? 'grab' : 'pointer'),
        background: danger ? 'rgba(220,38,38,0.9)' : 'rgba(15,23,42,0.92)', color: danger ? '#fff' : (disabled ? 'rgba(226,232,240,0.3)' : '#e2e8f0'),
        fontSize: 14, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{children}</button>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} className="scale-in" style={{ width: '100%', maxWidth: 520, maxHeight: '80vh', overflowY: 'auto', borderRadius: 18, background: 'rgba(15,23,42,0.98)', border: '1px solid rgba(255,255,255,0.12)', padding: 20 }}>
        <h3 style={{ margin: '0 0 16px', color: '#f8fafc', fontSize: 16 }}>{title}</h3>
        {children}
      </div>
    </div>
  );
}

function SlideOver({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 55, display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} />
      <div style={{ position: 'relative', width: '100%', maxWidth: 380, height: '100%', overflowY: 'auto', background: 'rgba(15,23,42,0.99)', borderLeft: '1px solid rgba(255,255,255,0.1)', padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ margin: 0, color: '#f8fafc', fontSize: 15 }}>{title}</h3>
          <button type="button" onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: '#e2e8f0', cursor: 'pointer' }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

const TRAILS: { key: string; labelKey: TranslationKey }[] = [
  { key: 'sparkle', labelKey: 'trail_sparkle' }, { key: 'hearts', labelKey: 'trail_hearts' },
  { key: 'candy', labelKey: 'trail_candy' }, { key: 'custom', labelKey: 'trail_custom' },
];

function ThemePanel({ theme, onChange, t, restaurantId, showTrail }: { theme: DesignTheme; onChange: (t: DesignTheme) => void; t: T; restaurantId: string; showTrail?: boolean }) {
  const set = (k: keyof DesignTheme, v: string | null) => onChange({ ...theme, [k]: v });
  const scale = theme.textScale ?? 1;
  const colorRow = (k: keyof DesignTheme, fallback: string) => (
    <div style={{ display: 'flex', gap: 8 }}>
      <input type="color" value={(theme[k] as string) || fallback} onChange={(e) => set(k, e.target.value)} style={{ width: 42, height: 36, borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', cursor: 'pointer' }} />
      <input style={panelInput} value={(theme[k] as string) || fallback} onChange={(e) => set(k, e.target.value)} />
    </div>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <label style={{ display: 'grid', gap: 5 }}><span style={panelLabel}>{t('accent_color')}</span>{colorRow('accentColor', '#c9a42c')}</label>
      <label style={{ display: 'grid', gap: 5 }}><span style={panelLabel}>{t('background_color')}</span>{colorRow('backgroundColor', '#fafaf7')}</label>
      {/* Page-wide text color: recolors all blocks at once (per-block overrides win). */}
      <label style={{ display: 'grid', gap: 5 }}>
        <span style={panelLabel}>{t('text_color')}</span>
        {colorRow('textColor', '#1a1a1a')}
        {theme.textColor && <button type="button" onClick={() => set('textColor', null)} style={{ justifySelf: 'start', marginTop: 2, background: 'none', border: 'none', color: 'rgba(226,232,240,0.55)', fontSize: 11, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>{t('reset_auto')}</button>}
      </label>
      {/* Page-wide text size: scales all block text at once. */}
      <label style={{ display: 'grid', gap: 5 }}>
        <span style={panelLabel}>{t('text_size')}: {Math.round(scale * 100)}%</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input type="range" min={0.7} max={1.6} step={0.05} value={scale}
            onChange={(e) => onChange({ ...theme, textScale: Number(e.target.value) })}
            style={{ flex: 1, accentColor: '#c9a42c' }} />
          {scale !== 1 && <button type="button" onClick={() => onChange({ ...theme, textScale: 1 })} style={{ background: 'none', border: 'none', color: 'rgba(226,232,240,0.55)', fontSize: 11, cursor: 'pointer', textDecoration: 'underline', padding: 0, whiteSpace: 'nowrap' }}>{t('reset_auto')}</button>}
        </div>
      </label>
      {/* Falling particle effect over the whole page. */}
      <label style={{ display: 'grid', gap: 5 }}>
        <span style={panelLabel}>{t('particles')}</span>
        <select style={panelInput} value={theme.particles ?? 'none'} onChange={(e) => set('particles', e.target.value)}>
          <option value="none">{t('particle_none')}</option>
          <option value="confetti">{t('particle_confetti')}</option>
          <option value="birthday">{t('particle_birthday')}</option>
          <option value="hearts">{t('particle_hearts')}</option>
          <option value="snow">{t('particle_snow')}</option>
          <option value="candy">{t('particle_candy')}</option>
          <option value="custom">{t('particle_custom')}</option>
        </select>
      </label>
      {/* Custom falling-particle image. */}
      {theme.particles === 'custom' && (
        <PhotoUploadField label={t('particle_image')} value={theme.particlesImageUrl} onChange={(url) => set('particlesImageUrl', url)} restaurantId={restaurantId} hint={t('drop_or_paste')} />
      )}
      {/* Particle colour — syncs with the accent by default; override here. A
          custom image keeps its own colours, so hide it in that mode. */}
      {theme.particles && theme.particles !== 'none' && theme.particles !== 'custom' && (
        <label style={{ display: 'grid', gap: 5 }}>
          <span style={panelLabel}>{t('particle_color')}</span>
          {colorRow('particlesColor', theme.accentColor || '#c9a42c')}
          {theme.particlesColor && <button type="button" onClick={() => set('particlesColor', null)} style={{ justifySelf: 'start', marginTop: 2, background: 'none', border: 'none', color: 'rgba(226,232,240,0.55)', fontSize: 11, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>{t('sync_with_accent')}</button>}
        </label>
      )}
      <PhotoUploadField label={t('background_photo')} value={theme.backgroundImageUrl} onChange={(url) => set('backgroundImageUrl', url)} restaurantId={restaurantId} hint={t('drop_or_paste')} />
      {showTrail && (
        <>
          <label style={{ display: 'grid', gap: 5 }}>
            <span style={panelLabel}>{t('trail')}</span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {TRAILS.map((tr) => {
                const on = (theme.trailTemplate ?? 'sparkle') === tr.key;
                return <button key={tr.key} type="button" onClick={() => set('trailTemplate', tr.key)}
                  style={{ padding: '7px 13px', borderRadius: 10, cursor: 'pointer', fontSize: 12, fontWeight: 600, border: '1px solid', borderColor: on ? 'rgba(201,164,44,0.5)' : 'rgba(255,255,255,0.12)', background: on ? 'rgba(201,164,44,0.15)' : 'rgba(15,23,42,0.5)', color: on ? '#c9a42c' : '#e2e8f0' }}>{t(tr.labelKey)}</button>;
              })}
            </div>
          </label>
          {/* Custom cursor/finger-trail image. */}
          {theme.trailTemplate === 'custom' && (
            <PhotoUploadField label={t('trail_image')} value={theme.trailImageUrl} onChange={(url) => set('trailImageUrl', url)} restaurantId={restaurantId} hint={t('drop_or_paste')} />
          )}
          <label style={{ display: 'grid', gap: 5 }}><span style={panelLabel}>{t('trail_color')}</span>{colorRow('trailColor', '#c2185b')}</label>
        </>
      )}
      <label style={{ display: 'grid', gap: 5 }}>
        <span style={panelLabel}>{t('music')}</span>
        <AudioUploadField label="" value={theme.musicUrl} onChange={(url) => set('musicUrl', url)} restaurantId={restaurantId} />
      </label>
    </div>
  );
}
