import type { DesignTheme } from '../services/designTemplate.service';
import type { Block } from '../blocks/types';

/**
 * The two pure pieces of the NFC plaque editor's save path, kept out of the
 * component so they can be tested — the same split as `pages/adminMenuDraft.ts`
 * does for the Menu page's autosave.
 *
 * Both exist because auto-save is less forgiving than a Save button: it fires
 * on a timer, so anything that misreports "changed" writes on every visit, and
 * anything that drops a field loses an edit the maker never confirmed.
 */

/**
 * The theme flattened for the API.
 *
 * Every field is written explicitly rather than the theme being spread, and an
 * absent value becomes `null`, not `undefined`. `DesignTheme` uses `undefined`
 * for "not set", and `JSON.stringify` DROPS an undefined key — so clearing a
 * colour in the editor used to send no key at all, the server kept the previous
 * value, and the change looked as though it had silently failed. `null` is what
 * actually clears the column.
 */
export function themePayload(theme: DesignTheme): Record<string, string | number | null> {
  return {
    accentColor: theme.accentColor ?? null,
    backgroundColor: theme.backgroundColor ?? null,
    backgroundImageUrl: theme.backgroundImageUrl ?? null,
    textColor: theme.textColor ?? null,
    textScale: theme.textScale ?? 1,
    particles: theme.particles ?? null,
    particlesColor: theme.particlesColor ?? null,
    particlesImageUrl: theme.particlesImageUrl ?? null,
    musicUrl: theme.musicUrl ?? null,
    trailTemplate: theme.trailTemplate ?? null,
    trailColor: theme.trailColor ?? null,
    trailImageUrl: theme.trailImageUrl ?? null,
  };
}

/**
 * A stable signature of everything that gets persisted. Auto-save fires when it
 * differs from the last saved one, so it must describe the *payload*, not the
 * editor's in-memory shape: theme keys are sorted, and it is built from
 * `themePayload` so a theme rebuilt from the server response compares equal to
 * the same theme assembled in the editor.
 */
export function plaqueSig(
  businessName: string,
  slug: string,
  isPublished: boolean,
  blocks: Block[],
  theme: DesignTheme,
): string {
  const t = Object.fromEntries(
    Object.entries(themePayload(theme)).sort(([a], [b]) => a.localeCompare(b)),
  );
  return JSON.stringify({ businessName, slug, isPublished, blocks, theme: t });
}
