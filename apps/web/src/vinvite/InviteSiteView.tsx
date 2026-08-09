import { getPhotoUrl } from '../utils/photoUrl';
import { FingerTrail, type TrailTemplate } from '../components/FingerTrail';
import { MusicPlayer } from '../components/MusicPlayer';
import { BlockList, readableText, type RenderCtx } from '../blocks/BlockRenderer';
import { ParticleField } from '../blocks/ParticleField';
import { getTemplate, readRichDesign } from './templates';
import { RichRenderer } from './templates/RichRenderer';
import { resolveAssetUrls } from './templates/utils';
import type { PublicInviteSite, RsvpSubmission } from './api';

// ── One published invitation, rendered ───────────────────────────────────────
// A saved invitation is one of two things, and callers should not have to care
// which: a RICH design (a first-party template driven by `theme.templateId` +
// config, hosted in a sandboxed iframe) or a BLOCK design (the shared block
// designer, rendered inline). This is the single place that dispatches.
//
// Used both by the published page at v-invite.uz/<slug> and by the promotional
// site's showcase cards, which is why the guest-facing chrome — music, cursor
// trail, falling particles — is optional. Eight cards on a marketing page each
// starting their own audio player and particle field would be unusable.

function hexToRgba(hex: string, alpha: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!m) return `rgba(37,99,235,${alpha})`;
  const r = parseInt(m[1], 16), g = parseInt(m[2], 16), b = parseInt(m[3], 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * True when the invitation is a rich design whose template we still ship — the
 * case that fills the viewport rather than scrolling as a normal page. An id
 * that no longer resolves falls back to the block renderer, so callers must ask
 * this rather than testing `theme.templateId` themselves.
 */
export function isFullBleed(site: PublicInviteSite): boolean {
  const rich = readRichDesign(site.theme);
  return !!(rich && getTemplate(rich.templateId));
}

export function InviteSiteView({ site, contacts, onRsvp, chrome = true }: {
  site: PublicInviteSite;
  contacts?: { phone: string; telegram: string; instagram: string };
  /** Omitted in previews: a showcase card must not take real replies. */
  onRsvp?: (payload: RsvpSubmission) => Promise<void>;
  /** Music player, finger trail and particle overlay. */
  chrome?: boolean;
}) {
  const rich = readRichDesign(site.theme);
  const richTemplate = rich ? getTemplate(rich.templateId) : null;

  if (rich && richTemplate) {
    return (
      <RichRenderer
        html={richTemplate.html}
        config={resolveAssetUrls(richTemplate, rich.config)}
        languages={rich.languages}
        contacts={contacts}
        // No handler means no bridge back to the server, so a preview simply
        // never persists a reply — the template's own timeout thanks the guest
        // and nothing is stored.
        onRsvp={onRsvp}
      />
    );
  }

  const theme = site.theme ?? {};
  const accent = theme.accentColor || '#c9a42c';
  const bgColor = theme.backgroundColor || '#fafaf7';
  const bgImage = theme.backgroundImageUrl ? (getPhotoUrl(theme.backgroundImageUrl) ?? theme.backgroundImageUrl) : null;
  const musicSrc = theme.musicUrl ? (getPhotoUrl(theme.musicUrl) ?? theme.musicUrl) : null;
  const pageBackground = bgImage
    ? `${bgColor} url(${bgImage}) top center / contain repeat`
    : `radial-gradient(circle at 20% 0%, ${hexToRgba(accent, 0.18)} 0%, transparent 40%), radial-gradient(circle at 80% 100%, ${hexToRgba(accent, 0.14)} 0%, transparent 50%), ${bgColor}`;

  const ctx: RenderCtx = {
    accent,
    text: theme.textColor || (bgImage ? '#f5f5f5' : readableText(bgColor)),
    textScale: theme.textScale ?? 1,
    // The block RSVP form submits { guestName, attending }; map it onto the
    // v-invite RSVP endpoint so responses are actually stored (and forwarded).
    submitRsvp: onRsvp ? (p) => onRsvp({ name: p.guestName, attending: p.attending }) : undefined,
  };

  return (
    <div style={{
      minHeight: '100%', background: pageBackground, color: '#1a1a1a',
      fontFamily: '"Playfair Display", Georgia, serif',
      display: 'flex', justifyContent: 'center', position: 'relative',
    }}>
      {chrome && (
        <>
          <ParticleField
            kind={theme.particles}
            imageUrl={theme.particlesImageUrl ? (getPhotoUrl(theme.particlesImageUrl) ?? theme.particlesImageUrl) : null}
            color={theme.particlesColor || accent}
            fixed
          />
          <FingerTrail
            accent={theme.trailColor || accent}
            template={(theme.trailTemplate ?? 'sparkle') as TrailTemplate}
            imageUrl={theme.trailImageUrl ? (getPhotoUrl(theme.trailImageUrl) ?? theme.trailImageUrl) : null}
          />
          {musicSrc && <MusicPlayer src={musicSrc} accent={accent} />}
        </>
      )}
      <div style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 1 }}>
        <BlockList blocks={site.blocks ?? []} ctx={ctx} />
      </div>
    </div>
  );
}
