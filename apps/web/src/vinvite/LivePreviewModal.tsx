import { InviteSiteView } from './InviteSiteView';
import { PreviewShell } from './PreviewShell';
import type { PromoWork } from './api';

// ── The one live invitation on the marketing site ────────────────────────────
//
// This module is the reason the landing page is cheap. Everything heavy lives
// behind this file's import: `InviteSiteView` dispatches a saved invitation to
// either the rich renderer — and with it the template registry, all twelve
// designs' markup, 374 kB gzipped — or the block renderer, with the particle
// field and the music player behind that.
//
// The landing page reaches it through `React.lazy`, so a visitor who reads the
// page and never opens a preview never downloads any of it. Nothing here may be
// imported by the page directly: a single value import would defeat the split
// and nothing visible would break, so `landingWeight.test.ts` reads the page's
// imports and fails if one appears.
//
// It opens a CUSTOMER'S INVITATION and nothing else. It used to open a design
// too, from the price list — that went when the price list became a list of
// categories: a design is not something a visitor picks, so there is nowhere
// left on the site that offers one to open.

/** What a preview can be asked to open. */
export type PreviewTarget = { site: PromoWork; name: string; emoji: string };

export default function LivePreviewModal({ target, onClose }: {
  target: PreviewTarget;
  onClose: () => void;
}) {
  return (
    <PreviewShell
      onClose={onClose}
      header={(
        <>
          <span className="vi-pv-head-emoji" aria-hidden>{target.emoji}</span>
          <span className="vi-pv-head-name">{target.name}</span>
        </>
      )}
    >
      {/* `chrome={false}`: a preview must not start the invitation's music or
          its cursor trail, and must never take a real reply. */}
      <InviteSiteView site={target.site} chrome={false} />
    </PreviewShell>
  );
}
