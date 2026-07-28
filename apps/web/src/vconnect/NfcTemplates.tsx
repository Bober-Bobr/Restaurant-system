import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { designTemplateService, type DesignTheme } from '../services/designTemplate.service';
import { builtinTemplates, type PickedDesign } from '../blocks/builtinTemplates';
import { flyerCoverUrl } from '../blocks/cover';
import { getPhotoUrl } from '../utils/photoUrl';
import { useAdminStore } from '../store/admin.store';
import { translate } from '../utils/translate';
import type { Block } from '../blocks/types';

type TFn = (k: Parameters<typeof translate>[0], p?: Record<string, string | number>) => string;

// Built-in plaque designs are code, not DB rows, so "hide" and "favorite" for
// them live in this browser. Keys are namespaced away from the flyer designer's
// so hiding a plaque built-in never hides a flyer one.
const HIDDEN_KEY = 'vconnect-hidden-builtin-plaques';
const FAV_KEY = 'vconnect-fav-builtin-plaques';

function readIdSet(key: string): Set<string> {
  try {
    const raw = JSON.parse(localStorage.getItem(key) ?? '[]');
    return new Set(Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : []);
  } catch { return new Set(); }
}
function writeIdSet(key: string, set: Set<string>) {
  try { localStorage.setItem(key, JSON.stringify([...set])); } catch { /* storage unavailable */ }
}

type GridItem = {
  id: string;
  name: string;
  blocks: Block[];
  theme: DesignTheme;
  builtin: boolean;
  favorite: boolean;
};

// The plaque template grid, in one of two modes:
//   'choose'  — starting a new plaque; a card applies its design (used by NfcBuilderPage)
//   'manage'  — the Templates page; a card opens the template editor
export function NfcTemplateGrid({ mode, onPick, onBack }: {
  mode: 'choose' | 'manage';
  onPick?: (picked: PickedDesign | null) => void;
  onBack?: () => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { locale } = useAdminStore();
  const t: TFn = (k, p) => translate(k, locale, p);

  const queryKey = ['design-templates', 'plaque'];
  const { data: templates = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => designTemplateService.listMine('plaque'),
  });

  const [hiddenBuiltins, setHiddenBuiltins] = useState<Set<string>>(() => readIdSet(HIDDEN_KEY));
  const [favBuiltins, setFavBuiltins] = useState<Set<string>>(() => readIdSet(FAV_KEY));
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const removeMutation = useMutation({
    mutationFn: (id: string) => designTemplateService.remove(id),
    onSuccess: async () => { setConfirmId(null); await queryClient.invalidateQueries({ queryKey }); },
  });
  const favoriteMutation = useMutation({
    mutationFn: ({ id, isFavorite }: { id: string; isFavorite: boolean }) => designTemplateService.update(id, { isFavorite }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const hideBuiltin = (id: string) => {
    const next = new Set(hiddenBuiltins); next.add(id);
    setHiddenBuiltins(next); writeIdSet(HIDDEN_KEY, next);
  };
  const toggleBuiltinFav = (id: string) => {
    const next = new Set(favBuiltins);
    if (next.has(id)) next.delete(id); else next.add(id);
    setFavBuiltins(next); writeIdSet(FAV_KEY, next);
  };

  // Built-ins are code — editing one saves a personal copy first, then opens
  // that copy. The original stays available for the next plaque.
  const openForEdit = async (item: GridItem) => {
    if (!item.builtin) { navigate(`/templates/${item.id}`); return; }
    const created = await designTemplateService.create({ name: item.name, kind: 'plaque', blocks: item.blocks, theme: item.theme });
    await queryClient.invalidateQueries({ queryKey });
    navigate(`/templates/${created.id}`);
  };

  const createBlank = async () => {
    const name = window.prompt(t('template_name'));
    if (!name?.trim()) return;
    const created = await designTemplateService.create({ name: name.trim(), kind: 'plaque', blocks: [], theme: {} });
    await queryClient.invalidateQueries({ queryKey });
    navigate(`/templates/${created.id}`);
  };

  const items: GridItem[] = [
    ...builtinTemplates('plaque')
      .filter((tpl) => !hiddenBuiltins.has(tpl.id))
      .map((tpl) => ({ id: tpl.id, name: tpl.name, blocks: tpl.blocks, theme: tpl.theme, builtin: true, favorite: favBuiltins.has(tpl.id) })),
    ...templates.map((tpl) => ({ id: tpl.id, name: tpl.name, blocks: tpl.blocks ?? [], theme: tpl.theme ?? {}, builtin: false, favorite: tpl.isFavorite })),
  ].sort((a, b) => Number(b.favorite) - Number(a.favorite));

  const pending = templates.find((tpl) => tpl.id === confirmId);

  return (
    <section className="vc-fade-up">
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap', marginBottom: 8 }}>
        <div>
          <p className="vc-eyebrow">{t('vc_nfc_plaques')}</p>
          <h1 className="vc-title" style={{ marginTop: 8 }}>{mode === 'manage' ? t('my_templates') : t('vc_pick_template')}</h1>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {mode === 'manage' && (
            <button type="button" className="vc-btn vc-btn-primary" onClick={() => void createBlank()}>
              ＋ {t('vc_new_template')}
            </button>
          )}
          {onBack && (
            <button type="button" className="vc-btn vc-btn-ghost" onClick={onBack}>← {t('back')}</button>
          )}
        </div>
      </div>
      <hr className="vc-rule" style={{ margin: '18px 0 24px' }} />

      <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))' }}>
        {mode === 'choose' && (
          <button
            type="button"
            className="vc-card"
            onClick={() => onPick?.(null)}
            style={{
              padding: 24, minHeight: 250, cursor: 'pointer', color: 'var(--vc-beige)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10,
            }}
          >
            <span style={{ fontSize: 34, color: 'var(--vc-accent)' }}>＋</span>
            <span style={{ fontSize: 14, fontWeight: 600 }}>{t('blank')}</span>
          </button>
        )}

        {items.map((item, i) => (
          <TemplateCard
            key={item.id}
            item={item}
            delayMs={i * 55}
            t={t}
            onOpen={() => (mode === 'choose' ? onPick?.({ blocks: item.blocks, theme: item.theme }) : void openForEdit(item))}
            onFavorite={() => item.builtin ? toggleBuiltinFav(item.id) : favoriteMutation.mutate({ id: item.id, isFavorite: !item.favorite })}
            onEdit={() => void openForEdit(item)}
            onDelete={() => item.builtin ? hideBuiltin(item.id) : setConfirmId(item.id)}
          />
        ))}
      </div>

      {isLoading && <p className="vc-muted" style={{ fontSize: 14, marginTop: 16 }}>{t('loading')}</p>}
      {!isLoading && items.length === 0 && <p className="vc-muted" style={{ fontSize: 14, marginTop: 16 }}>{t('no_templates')}</p>}

      {pending && (
        <div
          onClick={() => setConfirmId(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 60, padding: 16,
            background: 'rgba(0,0,0,0.66)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div className="vc-card vc-fade-up" onClick={(e) => e.stopPropagation()} style={{ padding: 26, maxWidth: 380, width: '100%' }}>
            <p style={{ margin: '0 0 6px', fontSize: 16 }}>{t('delete_block')}: {pending.name}</p>
            <p className="vc-muted" style={{ margin: '0 0 22px', fontSize: 13.5 }}>{t('vc_delete_template_hint')}</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="vc-btn vc-btn-ghost" style={{ flex: 1 }} onClick={() => setConfirmId(null)}>{t('cancel')}</button>
              <button
                type="button"
                className="vc-btn vc-btn-danger"
                style={{ flex: 1 }}
                disabled={removeMutation.isPending}
                onClick={() => removeMutation.mutate(pending.id)}
              >
                {removeMutation.isPending ? '…' : t('delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function TemplateCard({ item, delayMs, t, onOpen, onFavorite, onEdit, onDelete }: {
  item: GridItem;
  delayMs: number;
  t: TFn;
  onOpen: () => void;
  onFavorite: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const cover = flyerCoverUrl({ blocks: item.blocks, backgroundImageUrl: item.theme?.backgroundImageUrl ?? null });
  const coverSrc = cover ? (getPhotoUrl(cover) ?? cover) : null;
  const accent = item.theme?.accentColor || '#c8a97a';
  const bg = item.theme?.backgroundColor || '#0f0f0e';

  return (
    <div className="vc-card vc-fade-up" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative', animationDelay: `${delayMs}ms` }}>
      <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 2, display: 'flex', gap: 6 }}>
        <MiniAction title={t('favorite')} onClick={onFavorite} active={item.favorite}>{item.favorite ? '★' : '☆'}</MiniAction>
        <MiniAction title={t('edit_template')} onClick={onEdit}>✎</MiniAction>
        <MiniAction title={t('delete_block')} onClick={onDelete} danger>×</MiniAction>
      </div>
      {item.builtin && (
        <span className="vc-badge" style={{ position: 'absolute', top: 8, left: 8, zIndex: 2 }}>{t('ready_made')}</span>
      )}

      <button
        type="button"
        onClick={onOpen}
        style={{ background: 'transparent', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', color: 'inherit', display: 'flex', flexDirection: 'column', flex: 1 }}
      >
        <div style={{
          height: 175, width: '100%', flexShrink: 0,
          background: coverSrc
            ? `url(${coverSrc}) top center / cover`
            : `linear-gradient(160deg, ${accent}33 0%, ${bg} 100%)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {!coverSrc && <span style={{ fontSize: 34, opacity: 0.8 }}>📇</span>}
        </div>
        <div style={{ padding: '11px 13px 13px', borderTop: '1px solid var(--vc-line)', width: '100%' }}>
          <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.favorite && <span style={{ color: 'var(--vc-accent)', marginRight: 5 }}>★</span>}{item.name}
          </p>
          <p className="vc-muted" style={{ margin: '3px 0 0', fontSize: 11.5 }}>{item.blocks.length} blocks</p>
        </div>
      </button>
    </div>
  );
}

function MiniAction({ children, title, onClick, danger, active }: {
  children: React.ReactNode; title: string; onClick: () => void; danger?: boolean; active?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      style={{
        width: 28, height: 28, borderRadius: '50%', border: 'none', cursor: 'pointer', fontSize: 14, lineHeight: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: danger ? 'var(--vc-danger)' : active ? 'var(--vc-accent)' : 'rgba(11,11,10,0.85)',
        color: danger ? '#fff' : active ? '#0b0b0a' : 'var(--vc-beige)',
        boxShadow: '0 2px 6px rgba(0,0,0,0.45)',
      }}
    >{children}</button>
  );
}

// ── nfc.v-connect.uz/templates — manage the maker's plaque templates ─────────
export const NfcTemplatesPage = () => <NfcTemplateGrid mode="manage" />;
