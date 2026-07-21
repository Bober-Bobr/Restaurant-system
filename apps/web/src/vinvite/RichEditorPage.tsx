import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Locale } from '../utils/translate';
import { PhotoUploadField } from '../components/PhotoUploadField';
import { AudioUploadField } from '../components/AudioUploadField';
import { vinviteService, type InviteRsvp } from './api';
import { useViT, type ViKey } from './i18n';
import { getTemplate } from './templates';
import { RichRenderer } from './templates/RichRenderer';
import { getPath, resolveAssetUrls, setPath } from './templates/utils';
import { LOCALES, type GalleryItem, type LocalizedText, type RichDesignData, type ScheduleItem, type TemplateField } from './templates/types';

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
