import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import QRCode from 'qrcode';
import type { Locale } from '../utils/translate';
import { PhotoUploadField } from '../components/PhotoUploadField';
import { AudioUploadField } from '../components/AudioUploadField';
import { vinviteService, type InviteRsvp, type TelegramStatus } from './api';
import { useViT, type ViKey } from './i18n';
import { useVInviteStore } from './store';
import { getTemplate } from './templates';
import { RichRenderer } from './templates/RichRenderer';
import { getPath, resolveAssetUrls, setPath } from './templates/utils';
import {
  LOCALES,
  type AdminElement, type AdminLayer, type AdminSectionStyle,
  type GalleryItem, type LocalizedText, type RichDesignData, type ScheduleItem,
  type TemplateDefinition, type TemplateField,
} from './templates/types';

// ── Form-based editor for rich (first-party) templates ───────────────────────
// Left: grouped fields driven by the template's field schema, with one input
// per selected language for localized values. Right: the live design in a
// sandboxed phone-frame preview, updated as you type.

const panelInput: React.CSSProperties = {
  background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
  color: '#e2e8f0', padding: '9px 12px', fontSize: 13, fontFamily: 'inherit', outline: 'none', width: '100%',
};
const panelLabel: React.CSSProperties = {
  fontSize: 11, color: 'rgba(226,232,240,0.6)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase',
};
const langTag: React.CSSProperties = {
  flex: '0 0 34px', textAlign: 'center', fontSize: 10, fontWeight: 800, letterSpacing: '0.08em',
  color: 'rgba(226,232,240,0.55)', textTransform: 'uppercase', paddingTop: 11,
};

function asLocalized(v: unknown): LocalizedText {
  return v && typeof v === 'object' ? (v as LocalizedText) : {};
}

export function RichDesignEditor({ design, onChange, projectId, initialTab }: {
  design: RichDesignData;
  onChange: (next: RichDesignData) => void;
  // Empty when editing a saved template (no project → no RSVP tab).
  projectId?: string;
  // Deep-link the RSVP tab open (e.g. from the dashboard "Wishes"/"Guests").
  initialTab?: 'design' | 'rsvp';
}) {
  const t = useViT();
  const template = getTemplate(design.templateId);
  const [tab, setTab] = useState<'design' | 'rsvp'>(initialTab && projectId ? initialTab : 'design');
  const [openGroup, setOpenGroup] = useState<string | null>(template?.groups[0]?.key ?? null);
  const isSystemAdmin = useVInviteStore((s) => s.user?.role === 'SYSTEM_ADMIN');

  const previewConfig = useMemo(
    () => (template ? resolveAssetUrls(template, design.config) : design.config),
    [template, design.config],
  );

  if (!template) {
    return <p style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>{t('not_found')}</p>;
  }

  const setConfig = (path: string, value: unknown) => {
    onChange({ ...design, config: setPath(design.config, path, value) });
  };
  const toggleLanguage = (lang: Locale) => {
    const has = design.languages.includes(lang);
    // Keep LOCALES order and never drop the last language.
    const next = has ? design.languages.filter((l) => l !== lang) : LOCALES.filter((l) => design.languages.includes(l) || l === lang);
    if (next.length === 0) return;
    onChange({ ...design, languages: next });
  };

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '18px 16px 80px' }}>
      {/* Tabs: design form ↔ guest responses */}
      {projectId && (
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['design', 'rsvp'] as const).map((key) => (
          <button
            key={key} type="button" onClick={() => setTab(key)}
            style={{
              padding: '9px 18px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer',
              border: '1px solid', borderColor: tab === key ? 'rgba(201,164,44,0.5)' : 'rgba(255,255,255,0.12)',
              background: tab === key ? 'rgba(201,164,44,0.15)' : 'rgba(15,23,42,0.5)',
              color: tab === key ? '#c9a42c' : '#e2e8f0',
            }}
          >
            {key === 'design' ? `🎨 ${t('design_tab')}` : `💌 ${t('rsvp_tab')}`}
          </button>
        ))}
      </div>
      )}

      {tab === 'rsvp' && projectId ? (
        <RsvpResponsesPanel projectId={projectId} />
      ) : (
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {/* ── Form panel ── */}
          <div style={{ flex: '1 1 380px', minWidth: 320, maxWidth: 560 }}>
            {/* Languages */}
            <div style={{ marginBottom: 14, padding: 14, borderRadius: 14, background: 'rgba(15,23,42,0.45)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <span style={panelLabel}>{t('langs_label')}</span>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                {LOCALES.map((lang) => {
                  const on = design.languages.includes(lang);
                  return (
                    <button
                      key={lang} type="button" onClick={() => toggleLanguage(lang)}
                      style={{
                        padding: '7px 16px', borderRadius: 10, fontSize: 12, fontWeight: 800, letterSpacing: '0.06em',
                        cursor: 'pointer', border: '1px solid',
                        borderColor: on ? 'rgba(201,164,44,0.5)' : 'rgba(255,255,255,0.12)',
                        background: on ? 'rgba(201,164,44,0.15)' : 'rgba(15,23,42,0.5)',
                        color: on ? '#c9a42c' : '#94a3b8',
                      }}
                    >
                      {lang.toUpperCase()}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Field groups */}
            {template.groups.map((group) => {
              const fields = template.fields.filter((f) => f.group === group.key);
              if (!fields.length) return null;
              const open = openGroup === group.key;
              return (
                <div key={group.key} style={{ marginBottom: 10, borderRadius: 14, background: 'rgba(15,23,42,0.45)', border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                  <button
                    type="button"
                    onClick={() => setOpenGroup(open ? null : group.key)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '13px 15px',
                      cursor: 'pointer', color: '#f1f5f9', fontSize: 14, fontWeight: 700, textAlign: 'left',
                    }}
                  >
                    <span style={{ fontSize: 17 }}>{group.icon}</span>
                    {t(group.labelKey as ViKey)}
                    <span style={{ marginLeft: 'auto', color: '#64748b', fontSize: 12 }}>{open ? '▲' : '▼'}</span>
                  </button>
                  {open && (
                    <div style={{ padding: '4px 15px 16px', display: 'grid', gap: 13 }}>
                      {fields.map((field) => (
                        <FieldEditor key={field.key} field={field} design={design} setConfig={setConfig} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Design+ — system administrators only */}
            {isSystemAdmin && (
              <AdminDesignPanel
                template={template}
                design={design}
                setConfig={setConfig}
                open={openGroup === '__admin'}
                onToggle={() => setOpenGroup(openGroup === '__admin' ? null : '__admin')}
              />
            )}
          </div>

          {/* ── Live preview (phone frame) ── */}
          <div style={{ flex: '1 1 400px', minWidth: 320, display: 'flex', justifyContent: 'center', position: 'sticky', top: 108 }}>
            <div style={{
              width: '100%', maxWidth: 420, height: 'min(78vh, 820px)', borderRadius: 28, overflow: 'hidden',
              border: '10px solid #0b1120', boxShadow: '0 30px 80px rgba(0,0,0,0.5)', background: '#000',
            }}>
              <RichRenderer html={template.html} config={previewConfig} languages={design.languages} interactive />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Single field ─────────────────────────────────────────────────────────────
function FieldEditor({ field, design, setConfig }: {
  field: TemplateField;
  design: RichDesignData;
  setConfig: (path: string, value: unknown) => void;
}) {
  const t = useViT();
  const label = t(field.labelKey as ViKey);
  const value = getPath(design.config, field.path);

  switch (field.type) {
    case 'localized-text':
    case 'localized-textarea': {
      const loc = asLocalized(value);
      const multiline = field.type === 'localized-textarea';
      return (
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={panelLabel}>{label}</span>
          {design.languages.map((lang) => (
            <div key={lang} style={{ display: 'flex', gap: 6 }}>
              {design.languages.length > 1 && <span style={langTag}>{lang}</span>}
              {multiline ? (
                <textarea
                  style={{ ...panelInput, minHeight: 66, resize: 'vertical' }}
                  value={loc[lang] ?? ''}
                  onChange={(e) => setConfig(field.path, { ...loc, [lang]: e.target.value })}
                />
              ) : (
                <input
                  style={panelInput}
                  value={loc[lang] ?? ''}
                  placeholder={field.placeholder}
                  onChange={(e) => setConfig(field.path, { ...loc, [lang]: e.target.value })}
                />
              )}
            </div>
          ))}
        </label>
      );
    }
    case 'text':
      return (
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={panelLabel}>{label}</span>
          <input
            style={panelInput}
            value={typeof value === 'string' ? value : ''}
            placeholder={field.placeholder}
            onChange={(e) => setConfig(field.path, e.target.value)}
          />
        </label>
      );
    case 'datetime': {
      const iso = typeof value === 'string' ? value : '';
      return (
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={panelLabel}>{label}</span>
          <input
            type="datetime-local"
            style={{ ...panelInput, colorScheme: 'dark' }}
            value={iso.slice(0, 16)}
            onChange={(e) => setConfig(field.path, e.target.value ? `${e.target.value}:00` : '')}
          />
        </label>
      );
    }
    case 'image':
      return (
        <PhotoUploadField
          label={label}
          value={typeof value === 'string' ? value : null}
          onChange={(url) => setConfig(field.path, url ?? '')}
          restaurantId=""
        />
      );
    case 'audio':
      return (
        <AudioUploadField
          label={label}
          value={typeof value === 'string' ? value : null}
          onChange={(url) => setConfig(field.path, url ?? '')}
          restaurantId=""
        />
      );
    case 'toggle': {
      // The stored value is the HIDDEN flag; the switch shows "visible".
      const hidden = value === true;
      return (
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={!hidden}
            onChange={(e) => setConfig(field.path, !e.target.checked)}
            style={{ width: 16, height: 16, accentColor: '#c9a42c', cursor: 'pointer' }}
          />
          <span style={{ fontSize: 13, color: hidden ? 'rgba(226,232,240,0.45)' : '#e2e8f0' }}>
            {label}
          </span>
          <span style={{ marginLeft: 'auto', fontSize: 15 }}>{hidden ? '🚫' : '👁'}</span>
        </label>
      );
    }
    case 'palette':
      return <PaletteEditor field={field} design={design} setConfig={setConfig} />;
    case 'gallery':
      return <GalleryEditor field={field} design={design} setConfig={setConfig} />;
    case 'schedule':
      return <ScheduleEditor field={field} design={design} setConfig={setConfig} />;
    default:
      return null;
  }
}

const itemBox: React.CSSProperties = {
  display: 'grid', gap: 8, padding: 12, borderRadius: 12,
  background: 'rgba(15,23,42,0.55)', border: '1px solid rgba(255,255,255,0.08)',
};

// Ordered list of colour swatches. Order matters — it is the order they appear
// on the invitation.
function PaletteEditor({ field, design, setConfig }: {
  field: TemplateField; design: RichDesignData; setConfig: (path: string, value: unknown) => void;
}) {
  const t = useViT();
  const raw = getPath(design.config, field.path);
  const colors = Array.isArray(raw) ? (raw as unknown[]).filter((c): c is string => typeof c === 'string') : [];
  const update = (next: string[]) => setConfig(field.path, next);
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {colors.map((hex, i) => (
          <div key={i} style={{ display: 'grid', justifyItems: 'center', gap: 4 }}>
            <input
              type="color"
              value={/^#[0-9a-f]{6}$/i.test(hex) ? hex : '#b08d4f'}
              onChange={(e) => update(colors.map((c, j) => (j === i ? e.target.value : c)))}
              style={{
                width: 46, height: 46, padding: 0, borderRadius: '50%', cursor: 'pointer',
                border: '1px solid rgba(255,255,255,0.25)', background: 'none',
              }}
            />
            <button
              type="button"
              onClick={() => update(colors.filter((_, j) => j !== i))}
              className="adm-btn-ghost"
              style={{ fontSize: 11, padding: '2px 8px', lineHeight: 1.2 }}
              aria-label={t('delete')}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="adm-btn-ghost"
        style={{ fontSize: 13, justifySelf: 'start' }}
        onClick={() => update([...colors, '#b08d4f'])}
      >
        ＋ {t('add_item')}
      </button>
    </div>
  );
}

function GalleryEditor({ field, design, setConfig }: {
  field: TemplateField; design: RichDesignData; setConfig: (path: string, value: unknown) => void;
}) {
  const t = useViT();
  const items = (getPath(design.config, field.path) as GalleryItem[] | undefined) ?? [];
  const update = (next: GalleryItem[]) => setConfig(field.path, next);
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {items.map((item, i) => (
        <div key={i} style={itemBox}>
          <PhotoUploadField
            value={item.image || null}
            onChange={(url) => update(items.map((it, j) => (j === i ? { ...it, image: url ?? '' } : it)))}
            restaurantId=""
            height={110}
          />
          {design.languages.map((lang) => (
            <div key={lang} style={{ display: 'flex', gap: 6 }}>
              {design.languages.length > 1 && <span style={langTag}>{lang}</span>}
              <input
                style={panelInput}
                placeholder={t('fld_caption')}
                value={asLocalized(item.caption)[lang] ?? ''}
                onChange={(e) => update(items.map((it, j) => (j === i ? { ...it, caption: { ...asLocalized(it.caption), [lang]: e.target.value } } : it)))}
              />
            </div>
          ))}
          <button type="button" className="adm-btn-danger" style={{ fontSize: 12, justifySelf: 'end' }} onClick={() => update(items.filter((_, j) => j !== i))}>
            {t('delete')}
          </button>
        </div>
      ))}
      <button type="button" className="adm-btn-ghost" style={{ fontSize: 13 }} onClick={() => update([...items, { image: '', caption: {} }])}>
        ＋ {t('add_item')}
      </button>
    </div>
  );
}

function ScheduleEditor({ field, design, setConfig }: {
  field: TemplateField; design: RichDesignData; setConfig: (path: string, value: unknown) => void;
}) {
  const t = useViT();
  const items = (getPath(design.config, field.path) as ScheduleItem[] | undefined) ?? [];
  const update = (next: ScheduleItem[]) => setConfig(field.path, next);
  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    update(next);
  };
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {items.map((item, i) => (
        <div key={i} style={itemBox}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              type="time"
              style={{ ...panelInput, width: 110, colorScheme: 'dark' }}
              value={item.time}
              onChange={(e) => update(items.map((it, j) => (j === i ? { ...it, time: e.target.value } : it)))}
            />
            <span style={{ flex: 1 }} />
            <button type="button" className="adm-btn-ghost" style={{ fontSize: 12, padding: '5px 9px' }} disabled={i === 0} onClick={() => move(i, i - 1)}>↑</button>
            <button type="button" className="adm-btn-ghost" style={{ fontSize: 12, padding: '5px 9px' }} disabled={i === items.length - 1} onClick={() => move(i, i + 1)}>↓</button>
            <button type="button" className="adm-btn-danger" style={{ fontSize: 12, padding: '5px 9px' }} onClick={() => update(items.filter((_, j) => j !== i))}>×</button>
          </div>
          {design.languages.map((lang) => (
            <div key={lang} style={{ display: 'flex', gap: 6 }}>
              {design.languages.length > 1 && <span style={langTag}>{lang}</span>}
              <input
                style={panelInput}
                placeholder={t('fld_label')}
                value={asLocalized(item.label)[lang] ?? ''}
                onChange={(e) => update(items.map((it, j) => (j === i ? { ...it, label: { ...asLocalized(it.label), [lang]: e.target.value } } : it)))}
              />
            </div>
          ))}
        </div>
      ))}
      <button type="button" className="adm-btn-ghost" style={{ fontSize: 13 }} onClick={() => update([...items, { time: '19:00', label: {} }])}>
        ＋ {t('add_item')}
      </button>
    </div>
  );
}

// ── Design+ (system administrators) ──────────────────────────────────────────
// Edits config.adminLayer: free overlay elements (photos/videos with position,
// size, rotation and animation — a video can cover a whole section, e.g. the
// hero after the intro) and per-section style overrides (background / text /
// accent). Rendered inside the iframe by the shared admin runtime.

const ANIMS: { key: AdminElement['anim']; label: string }[] = [
  { key: 'none', label: '—' },
  { key: 'fade-in', label: 'Fade in' },
  { key: 'slide-up', label: 'Slide up' },
  { key: 'zoom', label: 'Zoom' },
  { key: 'float', label: 'Float' },
  { key: 'pulse', label: 'Pulse' },
  { key: 'spin', label: 'Spin' },
];

function AdminDesignPanel({ template, design, setConfig, open, onToggle }: {
  template: TemplateDefinition;
  design: RichDesignData;
  setConfig: (path: string, value: unknown) => void;
  open: boolean;
  onToggle: () => void;
}) {
  const t = useViT();
  const layer: AdminLayer = (design.config.adminLayer as AdminLayer) ?? {};
  const elements = layer.elements ?? [];
  const styles = layer.styles ?? [];
  const sections = template.sectionIds ?? [];

  const save = (next: AdminLayer) => setConfig('adminLayer', next);
  const setElement = (id: string, patch: Partial<AdminElement>) =>
    save({ ...layer, elements: elements.map((e) => (e.id === id ? { ...e, ...patch } : e)) });
  const addElement = (type: AdminElement['type']) =>
    save({
      ...layer,
      elements: [...elements, {
        id: Math.random().toString(36).slice(2, 9),
        type, src: '', anchor: sections[0] ?? 'fixed',
        x: 50, y: 50, w: 30, rotate: 0, anim: 'none',
      }],
    });
  const removeElement = (id: string) => save({ ...layer, elements: elements.filter((e) => e.id !== id) });

  const setStyle = (section: string, patch: Partial<AdminSectionStyle>) => {
    const existing = styles.find((s) => s.section === section);
    const next = existing
      ? styles.map((s) => (s.section === section ? { ...s, ...patch } : s))
      : [...styles, { section, ...patch }];
    save({ ...layer, styles: next });
  };
  const setAccent = (section: string, color: string | undefined) =>
    setStyle(section, { vars: color ? Object.fromEntries((template.accentVars ?? []).map((v) => [v, color])) : undefined });
  const removeStyle = (section: string) => save({ ...layer, styles: styles.filter((s) => s.section !== section) });
  const styledSections = styles.map((s) => s.section);
  const unstyled = sections.filter((s) => !styledSections.includes(s));

  const num = (v: number | undefined, d: number) => (v == null ? d : v);
  const slider = (el: AdminElement, key: 'x' | 'y' | 'w' | 'rotate' | 'radius', label: string, min: number, max: number, d: number) => (
    <label style={{ display: 'grid', gap: 2, fontSize: 11, color: '#94a3b8' }}>
      {label}: {num(el[key], d)}
      <input type="range" min={min} max={max} value={num(el[key], d)} onChange={(e) => setElement(el.id, { [key]: Number(e.target.value) })} />
    </label>
  );

  return (
    <div style={{ marginBottom: 10, borderRadius: 14, background: 'rgba(124,58,237,0.10)', border: '1px solid rgba(167,139,250,0.35)', overflow: 'hidden' }}>
      <button
        type="button"
        onClick={onToggle}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '13px 15px', cursor: 'pointer', color: '#e9d5ff', fontSize: 14, fontWeight: 700, textAlign: 'left', background: 'none', border: 'none' }}
      >
        <span style={{ fontSize: 17 }}>🛠</span>
        {t('adm_design')}
        <span style={{ marginLeft: 'auto', color: '#a78bfa', fontSize: 12 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{ padding: '4px 15px 16px', display: 'grid', gap: 16 }}>
          {/* ── Overlay elements ── */}
          <div>
            <div style={{ ...panelLabel, marginBottom: 8 }}>{t('adm_elements')}</div>
            <div style={{ display: 'grid', gap: 10 }}>
              {elements.map((el) => (
                <div key={el.id} style={{ padding: 12, borderRadius: 12, background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(255,255,255,0.08)', display: 'grid', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 15 }}>{el.type === 'video' ? '🎬' : '🖼'}</span>
                    <select value={el.anchor} onChange={(e) => setElement(el.id, { anchor: e.target.value })} style={{ ...panelInput, width: 'auto', padding: '6px 8px', fontSize: 12 }}>
                      {sections.map((s) => <option key={s} value={s}>#{s}</option>)}
                      <option value="fixed">{t('adm_fixed')}</option>
                    </select>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#cbd5f5', marginLeft: 'auto' }}>
                      <input type="checkbox" checked={!!el.cover} onChange={(e) => setElement(el.id, { cover: e.target.checked || undefined })} />
                      {t('adm_cover')}
                    </label>
                    <button type="button" className="vi-btn vi-btn-ghost" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => removeElement(el.id)}>{t('delete')}</button>
                  </div>

                  {el.type === 'photo' ? (
                    <PhotoUploadField label="" value={el.src || null} onChange={(url) => setElement(el.id, { src: url ?? '' })} restaurantId="" height={90} />
                  ) : (
                    <input style={panelInput} placeholder={t('adm_video_url')} value={el.src} onChange={(e) => setElement(el.id, { src: e.target.value })} />
                  )}

                  {!el.cover && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px' }}>
                      {slider(el, 'x', 'X %', 0, 100, 50)}
                      {slider(el, 'y', 'Y %', 0, 100, 50)}
                      {slider(el, 'w', 'W %', 4, 100, 30)}
                      {slider(el, 'rotate', '°', -180, 180, 0)}
                      {slider(el, 'radius', 'R px', 0, 200, 0)}
                      <label style={{ display: 'grid', gap: 2, fontSize: 11, color: '#94a3b8' }}>
                        Opacity: {num(el.opacity, 1)}
                        <input type="range" min={0.1} max={1} step={0.05} value={num(el.opacity, 1)} onChange={(e) => setElement(el.id, { opacity: Number(e.target.value) })} />
                      </label>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <select value={el.anim ?? 'none'} onChange={(e) => setElement(el.id, { anim: e.target.value as AdminElement['anim'] })} style={{ ...panelInput, width: 'auto', padding: '6px 8px', fontSize: 12 }}>
                      {ANIMS.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
                    </select>
                    {el.anim && !['none', 'float', 'pulse', 'spin'].includes(el.anim) && (
                      <>
                        <label style={{ fontSize: 11, color: '#94a3b8' }}>s:
                          <input type="number" min={0.2} max={10} step={0.2} value={num(el.animDur, 1.6)} onChange={(e) => setElement(el.id, { animDur: Number(e.target.value) })} style={{ ...panelInput, width: 62, padding: '4px 6px', marginLeft: 4 }} />
                        </label>
                        <label style={{ fontSize: 11, color: '#94a3b8' }}>+s:
                          <input type="number" min={0} max={10} step={0.2} value={num(el.animDelay, 0)} onChange={(e) => setElement(el.id, { animDelay: Number(e.target.value) })} style={{ ...panelInput, width: 62, padding: '4px 6px', marginLeft: 4 }} />
                        </label>
                      </>
                    )}
                    <label style={{ fontSize: 11, color: '#94a3b8', marginLeft: 'auto' }}>z:
                      <input type="number" min={-1} max={99} value={num(el.z, el.cover ? 0 : 5)} onChange={(e) => setElement(el.id, { z: Number(e.target.value) })} style={{ ...panelInput, width: 56, padding: '4px 6px', marginLeft: 4 }} />
                    </label>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button type="button" className="vi-btn vi-btn-ghost" style={{ fontSize: 12 }} onClick={() => addElement('photo')}>＋ {t('adm_add_photo')}</button>
              <button type="button" className="vi-btn vi-btn-ghost" style={{ fontSize: 12 }} onClick={() => addElement('video')}>＋ {t('adm_add_video')}</button>
            </div>
          </div>

          {/* ── Per-section styles ── */}
          <div>
            <div style={{ ...panelLabel, marginBottom: 8 }}>{t('adm_styles')}</div>
            <div style={{ display: 'grid', gap: 8 }}>
              {styles.map((s) => (
                <div key={s.section} style={{ padding: 10, borderRadius: 12, background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: 12.5, color: '#e2e8f0' }}>#{s.section}</strong>
                  <label style={{ fontSize: 11, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>
                    {t('adm_bg')}
                    <input type="color" value={s.background ?? '#f6efe3'} onChange={(e) => setStyle(s.section, { background: e.target.value })} />
                  </label>
                  <label style={{ fontSize: 11, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>
                    {t('adm_text')}
                    <input type="color" value={s.text ?? '#3d2e21'} onChange={(e) => setStyle(s.section, { text: e.target.value })} />
                  </label>
                  <label style={{ fontSize: 11, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>
                    {t('adm_accent')}
                    <input type="color" value={Object.values(s.vars ?? {})[0] ?? '#c6a35c'} onChange={(e) => setAccent(s.section, e.target.value)} />
                  </label>
                  <button type="button" className="vi-btn vi-btn-ghost" style={{ fontSize: 11, padding: '4px 10px', marginLeft: 'auto' }} onClick={() => removeStyle(s.section)}>{t('delete')}</button>
                </div>
              ))}
            </div>
            {unstyled.length > 0 && (
              <select
                value=""
                onChange={(e) => { if (e.target.value) setStyle(e.target.value, {}); }}
                style={{ ...panelInput, width: 'auto', padding: '6px 8px', fontSize: 12, marginTop: 8 }}
              >
                <option value="">＋ {t('adm_add_style')}</option>
                {unstyled.map((s) => <option key={s} value={s}>#{s}</option>)}
              </select>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Guest responses (RSVP dashboard) ─────────────────────────────────────────
function RsvpResponsesPanel({ projectId }: { projectId: string }) {
  const t = useViT();
  const queryClient = useQueryClient();
  const rsvpsQuery = useQuery({ queryKey: ['vi-rsvps', projectId], queryFn: () => vinviteService.listRsvps(projectId) });
  const removeMutation = useMutation({
    mutationFn: (rsvpId: string) => vinviteService.removeRsvp(projectId, rsvpId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vi-rsvps', projectId] }),
  });

  const rsvps = rsvpsQuery.data ?? [];
  const coming = rsvps.filter((r) => r.attending);
  const totalGuests = coming.reduce((sum, r) => sum + r.guests, 0);

  if (rsvpsQuery.isLoading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><span className="vi-spinner" /></div>;
  }

  return (
    <div style={{ maxWidth: 760 }}>
      {/* Totals */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <Stat label={t('will_come')} value={String(coming.length)} color="#4ade80" />
        <Stat label={t('wont_come')} value={String(rsvps.length - coming.length)} color="#f87171" />
        <Stat label={t('guests_lbl')} value={String(totalGuests)} color="#c9a42c" />
      </div>

      {/* Telegram forwarding */}
      <TelegramPanel projectId={projectId} />

      {rsvps.length === 0 ? (
        <div style={{ padding: '52px 20px', textAlign: 'center', color: '#64748b', borderRadius: 14, background: 'rgba(15,23,42,0.45)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize: 38, marginBottom: 10 }}>💌</div>
          {t('no_rsvp')}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {rsvps.map((r) => <RsvpCard key={r.id} rsvp={r} onDelete={() => removeMutation.mutate(r.id)} />)}
        </div>
      )}
    </div>
  );
}

// ── Telegram RSVP forwarding: code / QR / deep link + connected chats ────────
// Collapsed to a single row until opened; the status query runs only then
// (opening for the first time also generates the project's code).
function TelegramPanel({ projectId }: { projectId: string }) {
  const t = useViT();
  const [open, setOpen] = useState(false);
  const [qr, setQr] = useState('');
  const queryClient = useQueryClient();
  const statusQuery = useQuery({
    queryKey: ['vi-telegram', projectId],
    queryFn: () => vinviteService.telegramStatus(projectId),
    enabled: open,
  });
  const status: TelegramStatus | undefined = statusQuery.data;

  useEffect(() => {
    if (status?.link) QRCode.toDataURL(status.link, { margin: 1, width: 220 }).then(setQr).catch(() => setQr(''));
    else setQr('');
  }, [status?.link]);

  const rotateMutation = useMutation({
    mutationFn: () => vinviteService.telegramRotate(projectId),
    onSuccess: (data) => queryClient.setQueryData(['vi-telegram', projectId], data),
  });
  const removeMutation = useMutation({
    mutationFn: (linkId: string) => vinviteService.telegramRemoveLink(projectId, linkId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vi-telegram', projectId] }),
  });

  const card: React.CSSProperties = { padding: 14, borderRadius: 14, background: 'rgba(15,23,42,0.45)', border: '1px solid rgba(255,255,255,0.08)' };
  return (
    <div style={{ ...card, marginBottom: 16 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#e2e8f0' }}
      >
        <span style={{ fontSize: 18 }}>✈</span>
        <strong style={{ fontSize: 14 }}>{t('tg_connect')}</strong>
        <span style={{ marginLeft: 'auto', color: '#94a3b8', fontSize: 13 }}>{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <div style={{ marginTop: 14 }}>
          {statusQuery.isLoading && <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}><span className="vi-spinner" /></div>}
          {status && status.enabled === false && (
            <p style={{ margin: 0, color: '#94a3b8', fontSize: 13, lineHeight: 1.6 }}>{t('tg_disabled')}</p>
          )}
          {status && status.enabled && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <p style={{ margin: 0, color: '#94a3b8', fontSize: 13, lineHeight: 1.6 }}>{t('tg_howto')}</p>

              <div style={{ ...card, textAlign: 'center', background: 'rgba(15,23,42,0.6)' }}>
                <div style={{ ...panelLabel, marginBottom: 8 }}>{t('tg_your_code')}</div>
                <div
                  onClick={() => status.code && navigator.clipboard?.writeText(status.code)}
                  title={t('copy_link')}
                  style={{ fontSize: 28, fontWeight: 800, letterSpacing: '0.3em', color: '#c9a42c', fontFamily: 'ui-monospace, monospace', cursor: 'pointer' }}
                >{status.code}</div>
                {qr && <img src={qr} alt="" style={{ width: 170, height: 170, margin: '12px auto 0', borderRadius: 10, background: '#fff', padding: 6 }} />}
                {status.link && (
                  <div style={{ marginTop: 10 }}>
                    <a href={status.link} target="_blank" rel="noopener noreferrer" className="vi-btn vi-btn-primary" style={{ display: 'inline-block', fontSize: 13, textDecoration: 'none' }}>{t('tg_open_bot')}</a>
                  </div>
                )}
              </div>

              <div>
                <div style={{ ...panelLabel, marginBottom: 8 }}>{t('tg_connected')} · {status.links?.length ?? 0}</div>
                {(status.links?.length ?? 0) === 0 ? (
                  <p style={{ margin: 0, color: '#64748b', fontSize: 13 }}>{t('tg_none')}</p>
                ) : (
                  <div style={{ display: 'grid', gap: 8 }}>
                    {status.links!.map((l) => (
                      <div key={l.id} style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 14px' }}>
                        <span style={{ color: '#f1f5f9', fontSize: 13 }}>{l.firstName || (l.username ? '@' + l.username : l.chatId)}{l.username && l.firstName ? ' · @' + l.username : ''}</span>
                        <button type="button" onClick={() => removeMutation.mutate(l.id)} className="vi-btn vi-btn-ghost" style={{ fontSize: 12, padding: '5px 12px' }}>{t('delete')}</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => { if (confirm(t('tg_rotate_confirm'))) rotateMutation.mutate(); }}
                className="vi-btn vi-btn-ghost"
                style={{ fontSize: 12, justifySelf: 'start', alignSelf: 'flex-start' }}
                disabled={rotateMutation.isPending}
              >↻ {t('tg_rotate')}</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ flex: '1 1 120px', padding: '14px 16px', borderRadius: 14, background: 'rgba(15,23,42,0.45)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div style={{ fontSize: 24, fontWeight: 800, color }}>{value}</div>
      <div style={{ ...panelLabel, marginTop: 4 }}>{label}</div>
    </div>
  );
}

function RsvpCard({ rsvp, onDelete }: { rsvp: InviteRsvp; onDelete: () => void }) {
  const t = useViT();
  return (
    <div style={{ padding: 14, borderRadius: 14, background: 'rgba(15,23,42,0.45)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <strong style={{ color: '#f1f5f9', fontSize: 14.5 }}>{rsvp.guestName}</strong>
        <span style={{
          fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999,
          background: rsvp.attending ? 'rgba(74,222,128,0.14)' : 'rgba(248,113,113,0.14)',
          color: rsvp.attending ? '#4ade80' : '#f87171',
        }}>
          {rsvp.attending ? `✓ ${t('will_come')}` : `✕ ${t('wont_come')}`}
        </span>
        {rsvp.attending && (
          <span style={{ fontSize: 12, color: '#94a3b8' }}>{t('guests_lbl')}: {rsvp.guests}</span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 11.5, color: '#64748b' }}>{new Date(rsvp.createdAt).toLocaleString()}</span>
        <button type="button" className="adm-btn-danger" style={{ fontSize: 11, padding: '4px 9px' }} onClick={onDelete}>×</button>
      </div>
      {rsvp.dietary && (
        <p style={{ margin: '8px 0 0', fontSize: 13, color: '#cbd5e1' }}>
          <span style={{ color: '#94a3b8' }}>{t('special_lbl')}:</span> {rsvp.dietary}
        </p>
      )}
      {rsvp.message && (
        <p style={{ margin: '6px 0 0', fontSize: 13, color: '#cbd5e1', fontStyle: 'italic' }}>
          <span style={{ color: '#94a3b8', fontStyle: 'normal' }}>{t('message_lbl')}:</span> «{rsvp.message}»
        </p>
      )}
    </div>
  );
}
