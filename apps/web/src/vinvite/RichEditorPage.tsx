import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import QRCode from 'qrcode';
import type { Locale } from '../utils/translate';
import { NumberField } from '../components/ui/NumberField';
import { PhotoUploadField } from '../components/PhotoUploadField';
import { AudioUploadField } from '../components/AudioUploadField';
import { VideoUploadField } from '../components/VideoUploadField';
import { vinviteService, type InviteRsvp, type TelegramStatus } from './api';
import { usePlatformContacts } from '../hooks/usePlatformContacts';
import { useViT, type ViKey } from './i18n';
import { useVInviteStore } from './store';
import { getTemplate } from './templates';
import { RichRenderer } from './templates/RichRenderer';
import { getPath, resolveAssetUrls, setPath, whenMode } from './templates/utils';
import {
  LOCALES,
  type AdminElement, type AdminKeyframe, type AdminLayer, type AdminParticles, type AdminSectionStyle, type AdminTrail,
  type GalleryItem, type LocalizedText, type QuoteItem, type RichDesignData, type ScheduleItem,
  type TemplateDefinition, type TemplateField, type TemplateFieldGroup,
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
  const contactFor = usePlatformContacts();

  // The preview follows every edit — config changes are pushed into the frame
  // over postMessage, so nothing reloads and no animation replays.
  const previewConfig = useMemo(
    () => (template ? resolveAssetUrls(template, design.config) : design.config),
    [template, design.config],
  );
  // Design+ motion paths are paused in the editor (so elements stay under the
  // cursor while dragging) unless this is toggled on.
  const [adminPlay, setAdminPlay] = useState(false);
  // Bumping this remounts RichRenderer, which rebuilds the srcdoc from the
  // current config — i.e. replays the invitation from its intro.
  const [reloadKey, setReloadKey] = useState(0);
  // Section the preview should jump to. Driven by whichever group is open and
  // by the section a Design+ control last touched.
  const [focusSection, setFocusSection] = useState<string | undefined>(undefined);
  // Which Design+ overlay element the panel is showing settings for. Picked by
  // clicking it in the preview, or set for you when you add a new one.
  const [selectedElement, setSelectedElement] = useState<string | null>(null);

  // A template swap invalidates any section id from the previous template.
  useEffect(() => { setFocusSection(undefined); setReloadKey((k) => k + 1); }, [design.templateId]);

  if (!template) {
    return <p style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>{t('not_found')}</p>;
  }

  const setConfig = (path: string, value: unknown) => {
    onChange({ ...design, config: setPath(design.config, path, value) });
  };

  // Opening a group jumps the preview to the part of the page it edits. Groups
  // without a home on the page (visibility, music) leave the preview alone.
  const toggleGroup = (group: TemplateFieldGroup) => {
    const opening = openGroup !== group.key;
    setOpenGroup(opening ? group.key : null);
    if (opening && group.section) setFocusSection(group.section);
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
                    onClick={() => toggleGroup(group)}
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
                onFocusSection={setFocusSection}
                selectedId={selectedElement}
                onSelect={setSelectedElement}
              />
            )}
          </div>

          {/* ── Preview (phone frame) — live; edits arrive over postMessage ── */}
          <div style={{ flex: '1 1 400px', minWidth: 320, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, position: 'sticky', top: 96 }}>
            <button
              type="button"
              onClick={() => setReloadKey((k) => k + 1)}
              title={t('replay_invitation')}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 18px', borderRadius: 999,
                border: '1px solid rgba(255,255,255,0.14)', cursor: 'pointer', fontSize: 13, fontWeight: 700,
                background: 'rgba(15,23,42,0.5)', color: '#94a3b8',
              }}
            >
              ↻ {t('replay_invitation')}
            </button>
            {isSystemAdmin && (
              <button
                type="button"
                onClick={() => setAdminPlay((v) => !v)}
                title={t('adm_play')}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 999,
                  border: '1px solid', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                  borderColor: adminPlay ? 'rgba(167,139,250,0.6)' : 'rgba(255,255,255,0.14)',
                  background: adminPlay ? 'rgba(124,58,237,0.18)' : 'rgba(15,23,42,0.5)',
                  color: adminPlay ? '#a78bfa' : '#94a3b8',
                }}
              >
                {adminPlay ? '⏸' : '▶'} {t('adm_play')}
              </button>
            )}
            <div style={{
              width: '100%', maxWidth: 420, height: 'min(74vh, 820px)', borderRadius: 28, overflow: 'hidden',
              border: '10px solid #0b1120', boxShadow: '0 30px 80px rgba(0,0,0,0.5)', background: '#000',
            }}>
              <RichRenderer
                key={reloadKey}
                html={template.html}
                config={previewConfig}
                languages={design.languages}
                contacts={contactFor('vinvite')}
                interactive
                focusSection={focusSection}
                adminEdit={isSystemAdmin}
                adminPlay={adminPlay}
                adminSelected={selectedElement}
                onAdminSelect={setSelectedElement}
                onAdminMove={(id, x, y, kf) => {
                  const layer = (design.config.adminLayer as AdminLayer) ?? {};
                  setConfig('adminLayer', {
                    ...layer,
                    elements: (layer.elements ?? []).map((e) => {
                      if (e.id !== id) return e;
                      // kf set → a motion-path marker was dragged, not the element.
                      if (kf != null && e.path?.[kf]) {
                        return { ...e, path: e.path.map((p, i) => (i === kf ? { ...p, x, y } : p)) };
                      }
                      return { ...e, x, y };
                    }),
                  });
                }}
              />
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
    case 'quotes':
      return <QuotesEditor field={field} design={design} setConfig={setConfig} />;
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
            {whenMode(item) === 'time' ? (
              <input
                type="time"
                style={{ ...panelInput, width: 110, colorScheme: 'dark' }}
                value={item.time}
                onChange={(e) => update(items.map((it, j) => (j === i ? { ...it, time: e.target.value } : it)))}
              />
            ) : (
              <input
                style={{ ...panelInput, width: 110 }}
                placeholder={t('fld_year')}
                value={item.time}
                onChange={(e) => update(items.map((it, j) => (j === i ? { ...it, time: e.target.value } : it)))}
              />
            )}
            {/* Switching clears the value: a clock time is not a year, and
                carrying "19:00" into a year field would look like a bug. */}
            <button
              type="button"
              className="adm-btn-ghost"
              style={{ fontSize: 11, padding: '5px 9px' }}
              title={whenMode(item) === 'time' ? t('fld_use_year') : t('fld_use_time')}
              onClick={() => update(items.map((it, j) => (j === i
                ? { ...it, mode: whenMode(it) === 'time' ? 'text' : 'time', time: '' }
                : it)))}
            >
              {whenMode(item) === 'time' ? '🕐' : '📅'}
            </button>
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
      {/* A new entry inherits the last one's kind: a story list goes on
          producing years, a programme goes on producing clock times. */}
      <button type="button" className="adm-btn-ghost" style={{ fontSize: 13 }}
        onClick={() => {
          const like = items.length ? whenMode(items[items.length - 1]!) : 'time';
          update([...items, { time: like === 'time' ? '19:00' : '', label: {}, mode: like }]);
        }}>
        ＋ {t('add_item')}
      </button>
    </div>
  );
}

// Wishes / testimonials: a free-text author line plus the quote itself, written
// per active language. Order is the order they are leafed through on the page.
function QuotesEditor({ field, design, setConfig }: {
  field: TemplateField; design: RichDesignData; setConfig: (path: string, value: unknown) => void;
}) {
  const t = useViT();
  const items = (getPath(design.config, field.path) as QuoteItem[] | undefined) ?? [];
  const update = (next: QuoteItem[]) => setConfig(field.path, next);
  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m!);
    update(next);
  };
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {items.map((item, i) => (
        <div key={i} style={itemBox}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              style={{ ...panelInput, flex: 1 }}
              placeholder={t('fld_author')}
              value={item.author ?? ''}
              onChange={(e) => update(items.map((it, j) => (j === i ? { ...it, author: e.target.value } : it)))}
            />
            <button type="button" className="adm-btn-ghost" style={{ fontSize: 12, padding: '5px 9px' }} disabled={i === 0} onClick={() => move(i, i - 1)}>↑</button>
            <button type="button" className="adm-btn-ghost" style={{ fontSize: 12, padding: '5px 9px' }} disabled={i === items.length - 1} onClick={() => move(i, i + 1)}>↓</button>
            <button type="button" className="adm-btn-danger" style={{ fontSize: 12, padding: '5px 9px' }} onClick={() => update(items.filter((_, j) => j !== i))}>×</button>
          </div>
          {design.languages.map((lang) => (
            <div key={lang} style={{ display: 'flex', gap: 6 }}>
              {design.languages.length > 1 && <span style={langTag}>{lang}</span>}
              <textarea
                style={{ ...panelInput, minHeight: 64, resize: 'vertical' }}
                placeholder={t('fld_quote')}
                value={asLocalized(item.text)[lang] ?? ''}
                onChange={(e) => update(items.map((it, j) => (j === i ? { ...it, text: { ...asLocalized(it.text), [lang]: e.target.value } } : it)))}
              />
            </div>
          ))}
        </div>
      ))}
      <button type="button" className="adm-btn-ghost" style={{ fontSize: 13 }} onClick={() => update([...items, { author: '', text: {} }])}>
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

function AdminDesignPanel({ template, design, setConfig, open, onToggle, onFocusSection, selectedId, onSelect }: {
  template: TemplateDefinition;
  design: RichDesignData;
  setConfig: (path: string, value: unknown) => void;
  open: boolean;
  onToggle: () => void;
  // Jump the preview to whichever section a control here is acting on.
  onFocusSection: (section: string) => void;
  // Settings are shown for ONE element at a time — the one picked in the
  // preview. Listing every element's controls at once made the panel a wall of
  // sliders with no way to tell which shape on the page each belonged to.
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const t = useViT();
  const layer: AdminLayer = (design.config.adminLayer as AdminLayer) ?? {};
  const elements = layer.elements ?? [];
  const styles = layer.styles ?? [];
  const sections = template.sectionIds ?? [];

  const save = (next: AdminLayer) => setConfig('adminLayer', next);
  // Editing an element scrolls to the section it lives in, so the change is
  // visible without hunting for it. 'fixed' elements are already on screen.
  const focusAnchor = (anchor: string | undefined) => {
    if (anchor && anchor !== 'fixed') onFocusSection(anchor);
  };
  const setElement = (id: string, patch: Partial<AdminElement>) => {
    focusAnchor(patch.anchor ?? elements.find((e) => e.id === id)?.anchor);
    save({ ...layer, elements: elements.map((e) => (e.id === id ? { ...e, ...patch } : e)) });
  };
  const addElement = (type: AdminElement['type']) => {
    const anchor = sections[0] ?? 'fixed';
    focusAnchor(anchor);
    const id = Math.random().toString(36).slice(2, 9);
    save({
      ...layer,
      elements: [...elements, { id, type, src: '', anchor, x: 50, y: 50, w: 30, rotate: 0, anim: 'none' }],
    });
    // A new element has no image yet, so it renders nothing in the preview and
    // could not be clicked there — it has to open on its own or it is lost.
    onSelect(id);
  };
  const removeElement = (id: string) => {
    if (selectedId === id) onSelect(null);
    save({ ...layer, elements: elements.filter((e) => e.id !== id) });
  };

  const setStyle = (section: string, patch: Partial<AdminSectionStyle>) => {
    onFocusSection(section);
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
              {elements.length === 0 && (
                <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>{t('adm_no_elements')}</p>
              )}
              {elements.map((el) => {
                const selected = el.id === selectedId;
                return (
                <div key={el.id} style={{
                  padding: selected ? 12 : '8px 10px', borderRadius: 12,
                  background: selected ? 'rgba(15,23,42,0.5)' : 'rgba(15,23,42,0.3)',
                  border: `1px solid ${selected ? 'rgba(167,139,250,0.55)' : 'rgba(255,255,255,0.08)'}`,
                  display: 'grid', gap: selected ? 10 : 0,
                }}>
                  {/* The row itself is the picker. Clicking it selects the
                      element and takes the preview to the section it lives in,
                      which is the same thing clicking it in the preview does. */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => { onSelect(selected ? null : el.id); if (!selected) focusAnchor(el.anchor); }}
                      aria-expanded={selected}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0,
                        padding: 0, background: 'none', border: 'none', cursor: 'pointer',
                        color: selected ? '#e9d5ff' : '#cbd5f5', font: 'inherit', fontSize: 12.5, textAlign: 'left',
                      }}
                    >
                      <span style={{ fontSize: 15 }}>{el.type === 'video' ? '🎬' : '🖼'}</span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        #{el.anchor === 'fixed' ? t('adm_fixed') : el.anchor}
                        {el.cover ? ` · ${t('adm_cover')}` : ''}
                        {!el.src ? ` · ${t('adm_no_source')}` : ''}
                      </span>
                      <span style={{ marginLeft: 'auto', color: '#a78bfa', fontSize: 11 }}>{selected ? '▲' : '▼'}</span>
                    </button>
                    <button type="button" className="vi-btn vi-btn-ghost" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => removeElement(el.id)}>{t('delete')}</button>
                  </div>

                  {selected && (
                  <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <select value={el.anchor} onChange={(e) => setElement(el.id, { anchor: e.target.value })} style={{ ...panelInput, width: 'auto', padding: '6px 8px', fontSize: 12 }}>
                      {sections.map((sec) => <option key={sec} value={sec}>#{sec}</option>)}
                      <option value="fixed">{t('adm_fixed')}</option>
                    </select>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#cbd5f5', marginLeft: 'auto' }}>
                      <input type="checkbox" checked={!!el.cover} onChange={(e) => setElement(el.id, { cover: e.target.checked || undefined })} />
                      {t('adm_cover')}
                    </label>
                  </div>

                  {el.type === 'photo' ? (
                    <PhotoUploadField label="" value={el.src || null} onChange={(url) => setElement(el.id, { src: url ?? '' })} restaurantId="" height={90} />
                  ) : (
                    <div style={{ display: 'grid', gap: 6 }}>
                      <VideoUploadField value={el.src || null} onChange={(url) => setElement(el.id, { src: url ?? '' })} restaurantId="" />
                      {!el.src && (
                        <input style={panelInput} placeholder={t('adm_video_url')} value={el.src} onChange={(e) => setElement(el.id, { src: e.target.value })} />
                      )}
                    </div>
                  )}

                  {!el.cover && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px' }}>
                      <p style={{ gridColumn: '1 / -1', margin: 0, fontSize: 11, color: '#a78bfa' }}>↔ {t('adm_drag_hint')}</p>
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
                          <NumberField min={0.2} max={10} step={0.2} value={num(el.animDur, 1.6)} onChange={(n) => setElement(el.id, { animDur: n })} style={{ ...panelInput, width: 62, padding: '4px 6px', marginLeft: 4 }} />
                        </label>
                        <label style={{ fontSize: 11, color: '#94a3b8' }}>+s:
                          <NumberField min={0} max={10} step={0.2} value={num(el.animDelay, 0)} onChange={(n) => setElement(el.id, { animDelay: n })} style={{ ...panelInput, width: 62, padding: '4px 6px', marginLeft: 4 }} />
                        </label>
                      </>
                    )}
                    <label style={{ fontSize: 11, color: '#94a3b8', marginLeft: 'auto' }}>z:
                      <NumberField min={-1} max={99} value={num(el.z, el.cover ? 0 : 5)} onChange={(n) => setElement(el.id, { z: n })} style={{ ...panelInput, width: 56, padding: '4px 6px', marginLeft: 4 }} />
                    </label>
                  </div>

                  {!el.cover && <PathEditor el={el} setElement={setElement} />}
                  </>
                  )}
                </div>
                );
              })}
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

          {/* ── Page-wide text size ── */}
          <div>
            <div style={{ ...panelLabel, marginBottom: 8 }}>{t('adm_text_size')}</div>
            <div style={{ padding: 10, borderRadius: 12, background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 11, color: '#94a3b8' }}>A</span>
              <input
                type="range"
                min={0.7}
                max={1.5}
                step={0.05}
                value={layer.textScale ?? 1}
                onChange={(e) => save({ ...layer, textScale: Number(e.target.value) })}
                style={{ flex: 1 }}
              />
              <span style={{ fontSize: 16, color: '#94a3b8' }}>A</span>
              <span style={{ fontSize: 12, color: '#e2e8f0', minWidth: 44, textAlign: 'right' }}>
                {Math.round((layer.textScale ?? 1) * 100)}%
              </span>
              {layer.textScale != null && layer.textScale !== 1 && (
                <button
                  type="button"
                  className="vi-btn vi-btn-ghost"
                  style={{ fontSize: 11, padding: '4px 10px' }}
                  onClick={() => save({ ...layer, textScale: undefined })}
                >
                  {t('adm_reset')}
                </button>
              )}
            </div>
            <p style={{ margin: '6px 2px 0', fontSize: 11, color: '#94a3b8' }}>{t('adm_text_size_hint')}</p>
          </div>

          {/* ── Falling particles ── */}
          <ParticlesEditor
            particles={layer.particles}
            onChange={(particles) => save({ ...layer, particles })}
          />

          {/* ── Cursor/finger trail ── */}
          <TrailEditor
            trail={layer.trail}
            onChange={(trail) => save({ ...layer, trail })}
          />
        </div>
      )}
    </div>
  );
}

// ── Motion path: numbered keyframes the element travels through ──────────────
// Positions are dragged in the preview (numbered markers); here each stop only
// exposes its optional pose overrides (rotate / scale / opacity) plus the
// path's duration, easing and repeat mode.
function PathEditor({ el, setElement }: {
  el: AdminElement;
  setElement: (id: string, patch: Partial<AdminElement>) => void;
}) {
  const t = useViT();
  const path = el.path ?? [];
  const setKf = (i: number, patch: Partial<AdminKeyframe>) =>
    setElement(el.id, { path: path.map((p, j) => (j === i ? { ...p, ...patch } : p)) });
  const addKf = () => {
    const last = path[path.length - 1] ?? { x: el.x ?? 50, y: el.y ?? 50 };
    setElement(el.id, {
      path: [...path, { x: Math.min(100, (last.x ?? 50) + 12), y: Math.min(100, (last.y ?? 50) + 12) }],
    });
  };
  const removeKf = (i: number) => {
    const next = path.filter((_, j) => j !== i);
    setElement(el.id, { path: next.length ? next : undefined });
  };
  const kfNum = (v: number | undefined, d: number) => (v == null ? d : v);

  return (
    <div style={{ display: 'grid', gap: 8, padding: 10, borderRadius: 10, background: 'rgba(124,58,237,0.08)', border: '1px dashed rgba(167,139,250,0.3)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa', letterSpacing: '0.04em', textTransform: 'uppercase' }}>🎞 {t('adm_path')}</span>
        <button type="button" className="vi-btn vi-btn-ghost" style={{ fontSize: 11, padding: '3px 10px', marginLeft: 'auto' }} onClick={addKf}>＋ {t('adm_add_kf')}</button>
      </div>

      {path.length > 0 && (
        <>
          <p style={{ margin: 0, fontSize: 11, color: '#a78bfa' }}>↔ {t('adm_kf_hint')}</p>
          {path.map((p, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{
                width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                border: '2px dashed rgba(167,139,250,0.95)', background: 'rgba(124,58,237,0.35)',
                color: '#fff', fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}>{i + 2}</span>
              <label style={{ fontSize: 11, color: '#94a3b8' }}>°
                <NumberField min={-360} max={360} value={kfNum(p.rotate, el.rotate ?? 0)} onChange={(n) => setKf(i, { rotate: n })} style={{ ...panelInput, width: 58, padding: '4px 6px', marginLeft: 4 }} />
              </label>
              <label style={{ fontSize: 11, color: '#94a3b8' }}>×
                <NumberField min={0.1} max={5} step={0.1} value={kfNum(p.scale, 1)} onChange={(n) => setKf(i, { scale: n })} style={{ ...panelInput, width: 58, padding: '4px 6px', marginLeft: 4 }} />
              </label>
              <label style={{ fontSize: 11, color: '#94a3b8' }}>α
                <NumberField min={0} max={1} step={0.05} value={kfNum(p.opacity, 1)} onChange={(n) => setKf(i, { opacity: n })} style={{ ...panelInput, width: 58, padding: '4px 6px', marginLeft: 4 }} />
              </label>
              <button type="button" className="vi-btn vi-btn-ghost" style={{ fontSize: 11, padding: '3px 9px', marginLeft: 'auto' }} onClick={() => removeKf(i)}>✕</button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ fontSize: 11, color: '#94a3b8' }}>{t('adm_dur')}:
              <NumberField min={0.5} max={60} step={0.5} value={kfNum(el.pathDur, 6)} onChange={(n) => setElement(el.id, { pathDur: n })} style={{ ...panelInput, width: 62, padding: '4px 6px', marginLeft: 4 }} />
            </label>
            <select value={el.pathEase ?? 'ease-in-out'} onChange={(e) => setElement(el.id, { pathEase: e.target.value as AdminElement['pathEase'] })} style={{ ...panelInput, width: 'auto', padding: '5px 8px', fontSize: 12 }}>
              <option value="ease-in-out">ease-in-out</option>
              <option value="ease">ease</option>
              <option value="linear">linear</option>
            </select>
            <select value={el.pathMode ?? 'loop'} onChange={(e) => setElement(el.id, { pathMode: e.target.value as AdminElement['pathMode'] })} style={{ ...panelInput, width: 'auto', padding: '5px 8px', fontSize: 12 }}>
              <option value="loop">{t('adm_loop')}</option>
              <option value="alternate">{t('adm_alt')}</option>
              <option value="once">{t('adm_once')}</option>
            </select>
          </div>
        </>
      )}
    </div>
  );
}

// ── Falling particles: preset shapes or a custom uploaded image ──────────────
const PARTICLE_PRESETS: AdminParticles['preset'][] = ['none', 'confetti', 'snow', 'hearts', 'sparkles', 'petals', 'custom'];

function ParticlesEditor({ particles, onChange }: {
  particles: AdminParticles | undefined;
  onChange: (next: AdminParticles | undefined) => void;
}) {
  const t = useViT();
  const p: AdminParticles = particles ?? { preset: 'none' };
  const set = (patch: Partial<AdminParticles>) => {
    const next = { ...p, ...patch };
    onChange(next.preset === 'none' ? undefined : next);
  };
  const pnum = (v: number | undefined, d: number) => (v == null ? d : v);

  return (
    <div>
      <div style={{ ...panelLabel, marginBottom: 8 }}>{t('adm_particles')}</div>
      <div style={{ padding: 12, borderRadius: 12, background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(255,255,255,0.08)', display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 15 }}>❄</span>
          <select value={p.preset} onChange={(e) => set({ preset: e.target.value as AdminParticles['preset'] })} style={{ ...panelInput, width: 'auto', padding: '6px 8px', fontSize: 12 }}>
            {PARTICLE_PRESETS.map((key) => <option key={key} value={key}>{t(`prt_${key}` as ViKey)}</option>)}
          </select>
          {p.preset !== 'none' && (
            <select value={p.mode ?? 'always'} onChange={(e) => set({ mode: e.target.value as AdminParticles['mode'] })} style={{ ...panelInput, width: 'auto', padding: '6px 8px', fontSize: 12, marginLeft: 'auto' }}>
              <option value="always">{t('adm_mode_always')}</option>
              <option value="scroll">{t('adm_mode_scroll')}</option>
            </select>
          )}
        </div>

        {p.preset === 'custom' && (
          <PhotoUploadField label={t('adm_particle_img')} value={p.src || null} onChange={(url) => set({ src: url ?? '' })} restaurantId="" height={90} />
        )}

        {/* Colour override — recolours the particles; a custom image keeps its
            own colours, so it is hidden in that mode. */}
        {p.preset !== 'none' && p.preset !== 'custom' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: '#94a3b8', minWidth: 70 }}>{t('adm_particle_color')}</span>
            <input
              type="color"
              value={p.color || '#e8c76a'}
              onChange={(e) => set({ color: e.target.value })}
              style={{ width: 40, height: 30, borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', cursor: 'pointer', padding: 0 }}
            />
            {p.color && (
              <button type="button" onClick={() => set({ color: undefined })} style={{ background: 'none', border: 'none', color: 'rgba(226,232,240,0.55)', fontSize: 11, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>{t('adm_default_colors')}</button>
            )}
          </div>
        )}

        {p.preset !== 'none' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px 12px' }}>
            <label style={{ display: 'grid', gap: 2, fontSize: 11, color: '#94a3b8' }}>
              {t('adm_count')}: {pnum(p.count, 40)}
              <input type="range" min={5} max={120} value={pnum(p.count, 40)} onChange={(e) => set({ count: Number(e.target.value) })} />
            </label>
            <label style={{ display: 'grid', gap: 2, fontSize: 11, color: '#94a3b8' }}>
              {t('adm_size')}: {pnum(p.size, 14)}
              <input type="range" min={6} max={48} value={pnum(p.size, 14)} onChange={(e) => set({ size: Number(e.target.value) })} />
            </label>
            <label style={{ display: 'grid', gap: 2, fontSize: 11, color: '#94a3b8' }}>
              {t('adm_speed')}: {pnum(p.speed, 1)}
              <input type="range" min={0.2} max={3} step={0.1} value={pnum(p.speed, 1)} onChange={(e) => set({ speed: Number(e.target.value) })} />
            </label>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Cursor/finger trail: same presets as the falling particles ───────────────
function TrailEditor({ trail, onChange }: {
  trail: AdminTrail | undefined;
  onChange: (next: AdminTrail | undefined) => void;
}) {
  const t = useViT();
  const p: AdminTrail = trail ?? { preset: 'none' };
  const set = (patch: Partial<AdminTrail>) => {
    const next = { ...p, ...patch };
    onChange(next.preset === 'none' ? undefined : next);
  };
  const pnum = (v: number | undefined, d: number) => (v == null ? d : v);

  return (
    <div>
      <div style={{ ...panelLabel, marginBottom: 8 }}>{t('adm_trail')}</div>
      <div style={{ padding: 12, borderRadius: 12, background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(255,255,255,0.08)', display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 15 }}>✨</span>
          <select value={p.preset} onChange={(e) => set({ preset: e.target.value as AdminTrail['preset'] })} style={{ ...panelInput, width: 'auto', padding: '6px 8px', fontSize: 12 }}>
            {PARTICLE_PRESETS.map((key) => <option key={key} value={key}>{t(`prt_${key}` as ViKey)}</option>)}
          </select>
        </div>

        {p.preset === 'custom' && (
          <PhotoUploadField label={t('adm_particle_img')} value={p.src || null} onChange={(url) => set({ src: url ?? '' })} restaurantId="" height={90} />
        )}

        {/* Colour override — the trail recolours to this; a custom image keeps
            its own colours, so it is hidden in that mode. */}
        {p.preset !== 'none' && p.preset !== 'custom' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: '#94a3b8', minWidth: 70 }}>{t('adm_trail_color')}</span>
            <input
              type="color"
              value={p.color || '#e8c76a'}
              onChange={(e) => set({ color: e.target.value })}
              style={{ width: 40, height: 30, borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', cursor: 'pointer', padding: 0 }}
            />
            {p.color && (
              <button type="button" onClick={() => set({ color: undefined })} style={{ background: 'none', border: 'none', color: 'rgba(226,232,240,0.55)', fontSize: 11, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>{t('adm_default_colors')}</button>
            )}
          </div>
        )}

        {p.preset !== 'none' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px' }}>
            <label style={{ display: 'grid', gap: 2, fontSize: 11, color: '#94a3b8' }}>
              {t('adm_size')}: {pnum(p.size, 14)}
              <input type="range" min={6} max={48} value={pnum(p.size, 14)} onChange={(e) => set({ size: Number(e.target.value) })} />
            </label>
            <label style={{ display: 'grid', gap: 2, fontSize: 11, color: '#94a3b8' }}>
              {t('adm_density')}: {pnum(p.density, 2)}
              <input type="range" min={1} max={6} value={pnum(p.density, 2)} onChange={(e) => set({ density: Number(e.target.value) })} />
            </label>
          </div>
        )}
      </div>
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
