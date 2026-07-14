import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { designTemplateService, type DesignKind, type DesignTheme } from '../services/designTemplate.service';
import { builtinTemplates, type PickedDesign } from '../blocks/builtinTemplates';
import { flyerCoverUrl } from '../blocks/cover';
import { getPhotoUrl } from '../utils/photoUrl';
import type { Block } from '../blocks/types';
import type { translate } from '../utils/translate';

type T = (k: Parameters<typeof translate>[0], p?: Record<string, string | number>) => string;

// Small flash/error helper shared by both builders.
export function useDesignSave() {
  const [savedFlash, setSavedFlash] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const flash = () => { setSavedFlash(true); setTimeout(() => setSavedFlash(false), 1500); };
  return { flash, error, setError, savedFlash };
}

// ── Built-in template preferences (per browser) ──────────────────────────────
// Built-ins are code, not DB rows, so "delete" (hide) and "favorite" for them
// are persisted locally.
const HIDDEN_BUILTINS_KEY = 'vmenu-hidden-builtin-templates';
const FAV_BUILTINS_KEY = 'vmenu-fav-builtin-templates';

function readIdSet(key: string): Set<string> {
  try {
    const raw = JSON.parse(localStorage.getItem(key) ?? '[]');
    return new Set(Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : []);
  } catch { return new Set(); }
}
function writeIdSet(key: string, set: Set<string>) {
  try { localStorage.setItem(key, JSON.stringify([...set])); } catch { /* storage unavailable */ }
}

// One entry in the chooser grid — a built-in or a saved (DB) template.
type ChooserItem = {
  id: string;
  name: string;
  blocks: Block[];
  theme: DesignTheme;
  builtin: boolean;
  favorite: boolean;
};

// Full-screen "start from blank / ready-made / a saved template" chooser.
export function TemplateChooser({ kind, t, onPick, backLink }: {
  kind: DesignKind;
  t: T;
  onPick: (picked: PickedDesign | null) => void;
  backLink: string;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const queryKey = ['design-templates', kind];
  const { data: templates = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => designTemplateService.listMine(kind),
  });

  const [hiddenBuiltins, setHiddenBuiltins] = useState<Set<string>>(() => readIdSet(HIDDEN_BUILTINS_KEY));
  const [favBuiltins, setFavBuiltins] = useState<Set<string>>(() => readIdSet(FAV_BUILTINS_KEY));

  const removeMutation = useMutation({
    mutationFn: (id: string) => designTemplateService.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });
  const favoriteMutation = useMutation({
    mutationFn: ({ id, isFavorite }: { id: string; isFavorite: boolean }) => designTemplateService.update(id, { isFavorite }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const hideBuiltin = (id: string) => {
    const next = new Set(hiddenBuiltins); next.add(id);
    setHiddenBuiltins(next); writeIdSet(HIDDEN_BUILTINS_KEY, next);
  };
  const toggleBuiltinFav = (id: string) => {
    const next = new Set(favBuiltins);
    if (next.has(id)) next.delete(id); else next.add(id);
    setFavBuiltins(next); writeIdSet(FAV_BUILTINS_KEY, next);
  };

  // Editing a built-in saves a personal copy first (built-ins are code).
  const editBuiltin = async (item: ChooserItem) => {
    const created = await designTemplateService.create({ name: item.name, kind, blocks: item.blocks, theme: item.theme });
    queryClient.invalidateQueries({ queryKey });
    navigate(`/templates/${created.id}`);
  };

  const items: ChooserItem[] = [
    ...builtinTemplates(kind)
      .filter((tpl) => !hiddenBuiltins.has(tpl.id))
      .map((tpl) => ({ id: tpl.id, name: tpl.name, blocks: tpl.blocks, theme: tpl.theme, builtin: true, favorite: favBuiltins.has(tpl.id) })),
    ...templates.map((tpl) => ({ id: tpl.id, name: tpl.name, blocks: tpl.blocks ?? [], theme: tpl.theme ?? {}, builtin: false, favorite: tpl.isFavorite })),
  ].sort((a, b) => Number(b.favorite) - Number(a.favorite));

  return (
    <div className="adm-bg" style={{ minHeight: '100vh' }}>
      <main className="tablet-fade-in" style={{ maxWidth: 980, margin: '0 auto', padding: '40px 20px', position: 'relative', zIndex: 1 }}>
        <Link to={backLink} style={{ fontSize: 12, color: 'rgba(226,232,240,0.6)', textDecoration: 'none' }}>← {t('back')}</Link>
        <h1 className="adm-title" style={{ margin: '10px 0 24px' }}>{t('start_blank')} / {t('my_templates')}</h1>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 14 }}>
          {/* Blank */}
          <button type="button" onClick={() => onPick(null)} className="adm-card adm-card-hover"
            style={{ padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, cursor: 'pointer', color: '#e2e8f0', minHeight: 240, justifyContent: 'center' }}>
            <span style={{ fontSize: 34 }}>＋</span>
            <span style={{ fontSize: 14, fontWeight: 700 }}>{t('blank')}</span>
          </button>

          {items.map((item) => (
            <TemplateCard
              key={item.id}
              item={item}
              t={t}
              onPick={() => onPick({ blocks: item.blocks, theme: item.theme })}
              onFavorite={() => item.builtin ? toggleBuiltinFav(item.id) : favoriteMutation.mutate({ id: item.id, isFavorite: !item.favorite })}
              onEdit={() => { if (item.builtin) void editBuiltin(item); else navigate(`/templates/${item.id}`); }}
              onDelete={() => {
                if (!window.confirm(`${t('delete_block')}: ${item.name}?`)) return;
                if (item.builtin) hideBuiltin(item.id); else removeMutation.mutate(item.id);
              }}
            />
          ))}
        </div>

        {isLoading && <p style={{ color: 'rgba(226,232,240,0.5)', marginTop: 16 }}>...</p>}
        {!isLoading && items.length === 0 && <p style={{ color: 'rgba(226,232,240,0.5)', marginTop: 16, fontSize: 13 }}>{t('no_templates')}</p>}
      </main>
    </div>
  );
}

function TemplateCard({ item, t, onPick, onFavorite, onEdit, onDelete }: {
  item: ChooserItem;
  t: T;
  onPick: () => void;
  onFavorite: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const cover = flyerCoverUrl({ blocks: item.blocks, backgroundImageUrl: item.theme?.backgroundImageUrl ?? null });
  const coverSrc = cover ? (getPhotoUrl(cover) ?? cover) : null;
  const accent = item.theme?.accentColor || '#c9a42c';

  return (
    <div className="adm-card adm-card-hover" style={{ padding: 0, overflow: 'hidden', color: '#e2e8f0', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {/* Action row */}
      <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 2, display: 'flex', gap: 6 }}>
        <MiniAction title={t('favorite')} onClick={onFavorite} active={item.favorite}>{item.favorite ? '★' : '☆'}</MiniAction>
        <MiniAction title={t('edit_template')} onClick={onEdit}>✎</MiniAction>
        <MiniAction title={t('delete_block')} onClick={onDelete} danger>×</MiniAction>
      </div>
      {item.builtin && (
        <span className="adm-badge" style={{ position: 'absolute', top: 8, left: 8, zIndex: 2, background: 'rgba(201,164,44,0.18)', color: '#c9a42c', border: '1px solid rgba(201,164,44,0.35)' }}>{t('ready_made')}</span>
      )}

      {/* Cover + name → pick */}
      <button type="button" onClick={onPick}
        style={{ background: 'transparent', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', color: 'inherit', display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div style={{
          height: 170, width: '100%', flexShrink: 0,
          background: coverSrc
            ? `url(${coverSrc}) top center / cover`
            : `linear-gradient(160deg, ${accent}26 0%, rgba(15,23,42,0.92) 100%)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {!coverSrc && <span style={{ fontSize: 34, opacity: 0.75 }}>{item.builtin ? '💍' : '🗂'}</span>}
        </div>
        <div style={{ padding: '10px 12px 12px', borderTop: '1px solid rgba(255,255,255,0.07)', width: '100%' }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#f8fafc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.favorite && <span style={{ color: '#c9a42c', marginRight: 5 }}>★</span>}{item.name}
          </p>
          <p style={{ margin: '3px 0 0', fontSize: 11, color: 'rgba(226,232,240,0.5)' }}>{item.blocks.length} blocks</p>
        </div>
      </button>
    </div>
  );
}

function MiniAction({ children, title, onClick, danger, active }: {
  children: React.ReactNode; title: string; onClick: () => void; danger?: boolean; active?: boolean;
}) {
  return (
    <button type="button" title={title} onClick={(e) => { e.stopPropagation(); onClick(); }}
      style={{
        width: 28, height: 28, borderRadius: '50%', border: 'none', cursor: 'pointer', fontSize: 14, lineHeight: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: danger ? 'rgba(220,38,38,0.85)' : active ? 'rgba(201,164,44,0.9)' : 'rgba(15,23,42,0.85)',
        color: danger ? '#fff' : active ? '#1a1a1a' : '#e2e8f0',
        boxShadow: '0 2px 6px rgba(0,0,0,0.35)',
      }}>{children}</button>
  );
}
