import { useMemo } from 'react';
import { useVInviteStore } from './store';
import { useTemplateOverrides } from './templateOverrides';
import { getTemplate } from './templates';
import { RichRenderer } from './templates/RichRenderer';
import { resolveAssetUrls } from './templates/utils';
import { InviteSiteView } from './InviteSiteView';
import { PreviewShell } from './PreviewShell';
import { brandOf, brandVars, longDescKey } from './templateBrand';
import { useViT } from './i18n';
import { LOCALES } from './templates/types';
import type { PromoWork } from './api';

// ── The one live invitation on the marketing site ────────────────────────────
//
// This module is the reason the landing page is cheap. Everything heavy lives
// behind this file's import — the template registry and, with it, all twelve
// designs' markup (374 kB gzipped), plus the block renderer, the particle field
// and the music player that `InviteSiteView` can pull in.
//
// The landing page reaches it through `React.lazy`, so a visitor who reads the
// page and never opens a preview never downloads any of it. Nothing here may be
// imported by the page directly: a single value import would defeat the split
// and nothing visible would break, so `templateMeta.test.ts`'s companion check
// in `landingWeight.test.ts` reads the page's imports and fails if one appears.

// Stable identity: RichRenderer posts into the iframe whenever `config` or
// `languages` change by reference, so this must not be rebuilt per render.
const ALL_LOCALES = [...LOCALES];

/** What a preview can be asked to open: a customer's invitation, or a design. */
export type PreviewTarget =
  | { kind: 'work'; site: PromoWork; name: string; emoji: string }
  | { kind: 'template'; id: string; name: string; emoji: string; price: string };

export default function LivePreviewModal({ target, onClose }: {
  target: PreviewTarget;
  onClose: () => void;
}) {
  const t = useViT();
  const dark = useVInviteStore((s) => s.uiTheme) === 'dark';
  const { effectiveConfig } = useTemplateOverrides();

  // The administrator's saved Design+ config, not the shipped default — a
  // design edited in the studio must look the same here as everywhere else.
  const tpl = target.kind === 'template' ? getTemplate(target.id) : null;
  const config = useMemo(
    () => (tpl ? resolveAssetUrls(tpl, effectiveConfig(tpl) as Record<string, unknown>) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tpl, effectiveConfig],
  );

  // A design id that no longer resolves would otherwise render an empty shell
  // with a working Select button under it.
  if (target.kind === 'template' && !tpl) return null;

  // There is no "select" here for either kind. A customer's invitation was
  // never on sale, and a design is an illustration of its tier rather than the
  // thing chosen — the choice is the tier, made on the card this was opened
  // from, and an action here would quietly reintroduce picking a design.
  return (
    <PreviewShell
      onClose={onClose}
      brandStyle={tpl ? brandVars(brandOf(tpl), dark) : undefined}
      header={(
        <>
          <span className="vi-pv-head-emoji" aria-hidden>{target.emoji}</span>
          <span className="vi-pv-head-name">{target.name}</span>
          {target.kind === 'template' && <span className="vi-pv-head-price">{target.price}</span>}
        </>
      )}
      // The footer slot used to hold that button; it carries the design's full
      // description instead, which a visitor who opened it full screen is
      // exactly the person who wants.
      footer={target.kind === 'template'
        ? <p className="vi-pv-foot-desc">{t(longDescKey(target.id))}</p>
        : undefined}
    >
      {target.kind === 'template'
        ? <RichRenderer html={tpl!.html} config={config!} languages={ALL_LOCALES} interactive />
        // `chrome={false}`: a preview must not start the invitation's music or
        // its cursor trail, and must never take a real reply.
        : <InviteSiteView site={target.site} chrome={false} />}
    </PreviewShell>
  );
}
