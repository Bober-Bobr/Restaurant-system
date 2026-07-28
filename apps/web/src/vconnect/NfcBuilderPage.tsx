import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { nfcPlaqueService } from '../services/nfcPlaque.service';
import { designTemplateService, type DesignTheme } from '../services/designTemplate.service';
import type { PickedDesign } from '../blocks/builtinTemplates';
import { NfcTemplateGrid } from './NfcTemplates';
import { useAdminStore } from '../store/admin.store';
import { translate } from '../utils/translate';
import { buildPlaqueUrl } from '../utils/subdomain';
import { BlockEditor } from '../blocks/BlockEditor';
import { createBlock, type Block } from '../blocks/types';
import { LinkQrButton } from '../components/LinkQrButton';
import { VC_LOGO } from './branding';

type TFn = (k: Parameters<typeof translate>[0], p?: Record<string, string | number>) => string;
type SaveState = 'idle' | 'saving' | 'saved' | 'error';

// The plaque address is the last path segment of v-connect.uz/<slug>.
function slugify(s: string): string {
  return s.toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

// A starting layout for a business plaque: who you are, what you do, how to
// reach you. Deliberately different from the flyer seed (no promo/countdown).
function seedPlaqueBlocks(businessName: string): Block[] {
  const heading = createBlock('heading');
  heading.props = { ...heading.props, text: businessName || 'Business', align: 'center' };
  const text = createBlock('text');
  const socials = createBlock('socials');
  const vc = createBlock('vccontact');
  return [heading, text, socials, vc];
}

const PLAQUE_THEME: DesignTheme = {
  accentColor: '#c8a97a',
  backgroundColor: '#faf7f0',
  textColor: '#1a1817',
  textScale: 1,
  trailTemplate: 'sparkle',
};

function errText(e: unknown): string {
  if (axios.isAxiosError(e)) {
    const body = e.response?.data as { message?: unknown } | undefined;
    if (typeof body?.message === 'string') return body.message;
  }
  return e instanceof Error ? e.message : 'Error';
}

// A stable signature of everything persisted — drives the dirty check.
function sig(businessName: string, slug: string, isPublished: boolean, blocks: Block[], theme: DesignTheme): string {
  return JSON.stringify({ businessName, slug, isPublished, blocks, theme });
}

// ── nfc.v-connect.uz/plaques/:id — the plaque designer ───────────────────────
// Same shared block designer the flyer tool uses, wrapped in the v-connect
// chrome with the address field, publish switch and the tag's link/QR.
export const NfcBuilderPage = () => {
  const { plaqueId = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { locale } = useAdminStore();
  const t: TFn = (k, p) => translate(k, locale, p);

  const existingQuery = useQuery({
    queryKey: ['nfc-plaque', plaqueId],
    queryFn: () => nfcPlaqueService.get(plaqueId),
    enabled: !!plaqueId,
  });
  const existing = existingQuery.data;

  const [businessName, setBusinessName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [theme, setTheme] = useState<DesignTheme>(PLAQUE_THEME);
  const [isPublished, setIsPublished] = useState(false);
  const [initialized, setInitialized] = useState(false);
  // A brand-new plaque starts at the template chooser; an existing one is
  // already past that decision.
  const [chosen, setChosen] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [error, setError] = useState<string | null>(null);

  const savedSigRef = useRef('');

  // Load an existing plaque, or seed a new one once.
  useEffect(() => {
    if (initialized) return;
    if (plaqueId && !existing) return;
    if (existing) {
      setBusinessName(existing.businessName);
      setSlug(existing.slug);
      setSlugTouched(true);
      setBlocks(existing.blocks ?? []);
      setTheme({
        accentColor: existing.accentColor ?? undefined,
        backgroundColor: existing.backgroundColor ?? undefined,
        backgroundImageUrl: existing.backgroundImageUrl ?? undefined,
        textColor: existing.textColor ?? undefined,
        textScale: existing.textScale ?? 1,
        particles: existing.particles ?? undefined,
        particlesColor: existing.particlesColor ?? undefined,
        particlesImageUrl: existing.particlesImageUrl ?? undefined,
        musicUrl: existing.musicUrl ?? undefined,
        trailTemplate: existing.trailTemplate ?? 'sparkle',
        trailColor: existing.trailColor ?? undefined,
        trailImageUrl: existing.trailImageUrl ?? undefined,
      });
      setIsPublished(existing.isPublished);
      savedSigRef.current = sig(existing.businessName, existing.slug, existing.isPublished, existing.blocks ?? [], theme);
      setChosen(true);
    }
    // A new plaque stays empty until `applyTemplate` runs — the chooser below
    // gates the editor, so seeding here would be thrown away.
    setInitialized(true);
    // theme is intentionally excluded: it is being initialised here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing, plaqueId, initialized]);

  // A new plaque derives its address from the business name until the maker
  // edits the address themselves.
  useEffect(() => {
    if (!slugTouched) setSlug(slugify(businessName));
  }, [businessName, slugTouched]);

  // "Blank" falls back to the starter layout so a new plaque is never an empty
  // page; anything else applies the picked design verbatim.
  const applyTemplate = (picked: PickedDesign | null) => {
    if (picked) {
      setBlocks(structuredClone(picked.blocks));
      setTheme({ ...PLAQUE_THEME, ...picked.theme });
    } else {
      setBlocks(seedPlaqueBlocks(businessName));
      setTheme(PLAQUE_THEME);
    }
    setChosen(true);
  };

  const saveAsTemplate = async () => {
    const name = window.prompt(t('template_name'), businessName.trim());
    if (!name?.trim()) return;
    try {
      await designTemplateService.create({ name: name.trim(), kind: 'plaque', blocks, theme });
      await queryClient.invalidateQueries({ queryKey: ['design-templates', 'plaque'] });
      setError(null);
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 1800);
    } catch (e) {
      setError(errText(e));
    }
  };

  const currentSig = sig(businessName, slug, isPublished, blocks, theme);
  const dirty = initialized && currentSig !== savedSigRef.current;

  const payload = () => ({
    businessName: businessName.trim(),
    slug,
    blocks,
    isPublished,
    ...theme,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (plaqueId) return nfcPlaqueService.update(plaqueId, payload());
      return nfcPlaqueService.create({ ...payload(), businessName: businessName.trim(), slug });
    },
    onMutate: () => { setSaveState('saving'); setError(null); },
    onSuccess: async (saved) => {
      savedSigRef.current = currentSig;
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 1800);
      await queryClient.invalidateQueries({ queryKey: ['nfc-plaques'] });
      if (!plaqueId) navigate(`/plaques/${saved.id}`, { replace: true });
    },
    onError: (e) => { setSaveState('error'); setError(errText(e)); },
  });

  const validSlug = /^[a-z0-9-]{3,60}$/.test(slug);
  const canSave = businessName.trim().length > 0 && validSlug && !saveMutation.isPending;

  // Publishing is a save with the flag flipped, so the switch never leaves the
  // page in a state where the public URL disagrees with what was saved.
  const togglePublish = () => {
    setIsPublished((v) => !v);
    setTimeout(() => saveMutation.mutate(), 0);
  };

  if (plaqueId && existingQuery.isLoading) {
    return (
      <div className="vc-root" style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
        <span className="vc-muted">{t('loading')}</span>
      </div>
    );
  }

  // New plaque → pick a starting design first.
  if (!plaqueId && !chosen) {
    return (
      <div className="vc-root" style={{ minHeight: '100vh' }}>
        <main style={{ maxWidth: 1120, margin: '0 auto', padding: '28px 20px 64px' }}>
          <NfcTemplateGrid mode="choose" onPick={applyTemplate} onBack={() => navigate('/')} />
        </main>
      </div>
    );
  }

  return (
    <div className="vc-root" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 40,
        background: 'rgba(11,11,10,0.9)',
        backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
        borderBottom: '1px solid var(--vc-line)',
      }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '11px 18px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <button type="button" className="vc-btn vc-btn-ghost" style={{ fontSize: 12.5, padding: '8px 13px' }} onClick={() => navigate('/')}>
            ← {t('back')}
          </button>
          <img src={VC_LOGO} alt="" style={{ height: 26, width: 'auto', objectFit: 'contain', opacity: 0.9 }} />

          <span className={`vc-badge${isPublished ? ' live' : ''}`}>
            {isPublished ? <><i />{t('vc_live')}</> : t('vc_draft')}
          </span>

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {saveState === 'saving' && <span className="vc-muted" style={{ fontSize: 12 }}>{t('saving')}</span>}
            {saveState === 'saved' && <span style={{ fontSize: 12, color: 'var(--vc-accent)' }}>{t('saved')}</span>}
            {dirty && saveState === 'idle' && <span className="vc-muted" style={{ fontSize: 12 }}>•</span>}

            {plaqueId && validSlug && (
              <LinkQrButton url={buildPlaqueUrl(slug)} filename={`nfc-${slug}`} t={t} />
            )}
            <button type="button" className="vc-btn vc-btn-ghost" style={{ fontSize: 12.5 }} onClick={() => void saveAsTemplate()}>
              {t('save_as_template')}
            </button>
            <button type="button" className="vc-btn vc-btn-ghost" style={{ fontSize: 12.5 }} onClick={togglePublish} disabled={!canSave}>
              {isPublished ? t('vc_unpublish') : t('vc_publish')}
            </button>
            <button type="button" className="vc-btn vc-btn-primary" style={{ fontSize: 12.5 }} onClick={() => saveMutation.mutate()} disabled={!canSave || !dirty}>
              {t('save')}
            </button>
          </div>
        </div>

        {/* Identity row */}
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 18px 12px', display: 'grid', gap: 10, gridTemplateColumns: 'minmax(180px, 1fr) minmax(200px, 1.4fr)' }}>
          <label>
            <span className="vc-label">{t('vc_business_name')}</span>
            <input
              className="vc-input"
              value={businessName}
              placeholder={t('vc_business_name_placeholder')}
              onChange={(e) => setBusinessName(e.target.value)}
            />
          </label>
          <label>
            <span className="vc-label">{t('vc_tag_address')}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="vc-muted" style={{ fontSize: 12.5, whiteSpace: 'nowrap' }}>v-connect.uz/</span>
              <input
                className="vc-input"
                value={slug}
                placeholder="my-business"
                onChange={(e) => { setSlugTouched(true); setSlug(slugify(e.target.value)); }}
                style={{ borderColor: slug && !validSlug ? 'var(--vc-danger)' : undefined }}
              />
            </div>
          </label>
        </div>

        {error && (
          <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 18px 12px' }}>
            <p style={{ margin: 0, fontSize: 12.5, color: 'var(--vc-danger)' }}>{error}</p>
          </div>
        )}
      </header>

      {/* The shared block designer */}
      <div style={{ flex: 1 }}>
        <BlockEditor
          kind="plaque"
          blocks={blocks}
          theme={theme}
          onBlocksChange={setBlocks}
          onThemeChange={setTheme}
          t={t}
          showTrail
        />
      </div>
    </div>
  );
};
