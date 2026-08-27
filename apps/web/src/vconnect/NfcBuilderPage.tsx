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
import { plaqueSig as sig, themePayload } from './plaqueDraft';
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

// How long the editor waits after the last change before persisting. Matches
// the flyer builder.
const AUTOSAVE_MS = 900;

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
  // Signature of the save currently in flight — see the mutationFn.
  const pendingSigRef = useRef('');
  // The id of a plaque this editor created. `plaqueId` comes from the route and
  // only updates after onSuccess navigates, so between the create resolving and
  // that re-render the mutationFn would still see an empty id and POST a SECOND
  // plaque. That window is narrow but reachable now that saves fire on a timer
  // rather than on a click.
  const createdIdRef = useRef('');
  // The signature of the last save that FAILED. Auto-save re-evaluates whenever
  // a request settles, so without this a permanent error — a taken address, an
  // expired session — would be retried every AUTOSAVE_MS for as long as the tab
  // stayed open. Editing anything changes the signature and lets it try again.
  const failedSigRef = useRef('');

  // Load an existing plaque, or seed a new one once.
  useEffect(() => {
    if (initialized) return;
    if (plaqueId && !existing) return;
    if (existing) {
      // Built as a local first: the baseline signature below has to be taken
      // from the theme being loaded, not from the `theme` state variable, which
      // still holds the previous render's value (PLAQUE_THEME on a first load)
      // because `setTheme` has not committed yet. Reading the state there made
      // every plaque open dirty, and with auto-save that is an immediate
      // pointless write on every visit to the editor.
      const loadedBlocks = existing.blocks ?? [];
      const loadedTheme: DesignTheme = {
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
      };
      setBusinessName(existing.businessName);
      setSlug(existing.slug);
      setSlugTouched(true);
      setBlocks(loadedBlocks);
      setTheme(loadedTheme);
      setIsPublished(existing.isPublished);
      savedSigRef.current = sig(existing.businessName, existing.slug, existing.isPublished, loadedBlocks, loadedTheme);
      setChosen(true);
    }
    // A new plaque stays empty until `applyTemplate` runs — the chooser below
    // gates the editor, so seeding here would be thrown away.
    setInitialized(true);
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
    ...themePayload(theme),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      // The signature of exactly what this request carries. Recorded here, not
      // in onSuccess, because an edit made WHILE the request is in flight would
      // otherwise be marked as saved when it completes: the editor would show
      // "saved", the button would go disabled, and that change would never be
      // sent. Changing a block's colour and immediately pausing is the easiest
      // way to hit it, which is what made colours look like they did not stick.
      pendingSigRef.current = sig(businessName.trim(), slug, isPublished, blocks, theme);
      const id = plaqueId || createdIdRef.current;
      if (id) return nfcPlaqueService.update(id, payload());
      return nfcPlaqueService.create({ ...payload(), businessName: businessName.trim(), slug });
    },
    onMutate: () => { setSaveState('saving'); setError(null); },
    onSuccess: async (saved) => {
      createdIdRef.current = saved.id;
      savedSigRef.current = pendingSigRef.current;
      setSaveState('saved');
      setTimeout(() => setSaveState((s) => (s === 'saved' ? 'idle' : s)), 1800);
      await queryClient.invalidateQueries({ queryKey: ['nfc-plaques'] });
      if (!plaqueId) navigate(`/plaques/${saved.id}`, { replace: true });
    },
    onError: (e) => {
      failedSigRef.current = pendingSigRef.current;
      setSaveState('error');
      setError(errText(e));
    },
  });

  const validSlug = /^[a-z0-9-]{3,60}$/.test(slug);
  const canSave = businessName.trim().length > 0 && validSlug && !saveMutation.isPending;

  // ── Auto-save ──────────────────────────────────────────────────────────────
  // Same mechanism as the flyer builder: any change to the persisted signature
  // starts a debounce, and the timer restarts on the next keystroke so a burst
  // of edits is one write. Nothing here can fire before `initialized`, and a new
  // plaque waits for the template chooser (`chosen`) — otherwise opening the
  // editor would create an empty plaque nobody asked for.
  //
  // A save is skipped while the name or address is invalid rather than being
  // attempted and failed: the address is typed character by character, and every
  // prefix shorter than three characters would otherwise be a rejected request.
  const canAutoSave = initialized && chosen && businessName.trim().length > 0 && validSlug;
  useEffect(() => {
    if (!canAutoSave) return;
    if (currentSig === savedSigRef.current) return;
    if (saveMutation.isPending) return;
    // Do not re-attempt exactly what just failed; see failedSigRef.
    if (currentSig === failedSigRef.current) return;
    const h = window.setTimeout(() => saveMutation.mutate(), AUTOSAVE_MS);
    return () => window.clearTimeout(h);
    // saveMutation is recreated every render; depending on it would restart the
    // debounce on each keystroke's re-render and never let it elapse.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSig, canAutoSave, saveMutation.isPending]);

  // Publishing just flips the flag — auto-save persists it, so the switch can no
  // longer leave the public URL disagreeing with what was saved. It used to fire
  // a save from a `setTimeout(…, 0)` to read the state React had not committed
  // yet, which is a race this removes rather than tightens.
  const togglePublish = () => setIsPublished((v) => !v);

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
            {/* Auto-save covers the normal case; this stays as an explicit
                "save now" that skips the debounce. */}
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
