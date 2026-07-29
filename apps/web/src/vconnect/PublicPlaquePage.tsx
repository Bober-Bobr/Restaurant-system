import { useQuery } from '@tanstack/react-query';
import { publicNfcPlaqueService } from '../services/publicNfcPlaque.service';
import { BlockList, VConnectFooter, VConnectContact, findVcContact, readableText, type RenderCtx } from '../blocks/BlockRenderer';
import { ParticleField } from '../blocks/ParticleField';
import { FingerTrail, type TrailTemplate } from '../components/FingerTrail';
import { MusicPlayer } from '../components/MusicPlayer';
import { getPhotoUrl } from '../utils/photoUrl';
import { translate } from '../utils/translate';
import type { ParticleKind } from '../blocks/ParticleField';

function hexToRgba(hex: string, alpha: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec((hex || '').trim());
  if (!m) return `rgba(200,169,122,${alpha})`;
  return `rgba(${parseInt(m[1]!, 16)},${parseInt(m[2]!, 16)},${parseInt(m[3]!, 16)},${alpha})`;
}

// ── v-connect.uz/<slug> — the page behind an NFC tag ─────────────────────────
// Renders the plaque's saved block layout with the shared renderer, exactly as
// the flyer public page does. Unpublished or unknown slugs show a neutral
// "not found" card rather than leaking whether the slug exists.
export const PublicPlaquePage = ({ slug }: { slug: string }) => {
  const { data: plaque, isLoading, isError } = useQuery({
    queryKey: ['public-plaque', slug],
    queryFn: () => publicNfcPlaqueService.bySlug(slug),
    retry: false,
  });

  if (isLoading) {
    return (
      <main className="vc-root" style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
        <span className="vc-muted" style={{ fontSize: 13, letterSpacing: '0.2em', textTransform: 'uppercase' }}>…</span>
      </main>
    );
  }

  if (isError || !plaque) {
    return (
      <main className="vc-root" style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', padding: 24 }}>
        <div className="vc-card" style={{ padding: '38px 30px', textAlign: 'center', maxWidth: 360 }}>
          <p className="vc-eyebrow" style={{ marginBottom: 12 }}>v-connect.uz</p>
          <p className="vc-muted" style={{ margin: 0, fontSize: 15 }}>{translate('vc_plaque_not_found', 'ru')}</p>
        </div>
      </main>
    );
  }

  const accent = plaque.accentColor || '#c8a97a';
  const bgColor = plaque.backgroundColor || '#faf7f0';
  const bgImage = plaque.backgroundImageUrl ? (getPhotoUrl(plaque.backgroundImageUrl) ?? plaque.backgroundImageUrl) : null;
  const particlesImg = plaque.particlesImageUrl ? (getPhotoUrl(plaque.particlesImageUrl) ?? plaque.particlesImageUrl) : null;
  const trailImg = plaque.trailImageUrl ? (getPhotoUrl(plaque.trailImageUrl) ?? plaque.trailImageUrl) : null;
  const musicSrc = plaque.musicUrl ? (getPhotoUrl(plaque.musicUrl) ?? plaque.musicUrl) : null;

  const pageBackground = bgImage
    ? `${bgColor} url(${bgImage}) top center / contain repeat`
    : `radial-gradient(circle at 20% 0%, ${hexToRgba(accent, 0.18)} 0%, transparent 40%), radial-gradient(circle at 80% 100%, ${hexToRgba(accent, 0.14)} 0%, transparent 50%), ${bgColor}`;

  const ctx: RenderCtx = {
    accent,
    text: plaque.textColor || (bgImage ? '#f5f5f5' : readableText(bgColor)),
    textScale: plaque.textScale ?? 1,
    brandName: plaque.businessName,
  };

  const blocks = plaque.blocks ?? [];
  const vc = findVcContact(blocks);

  return (
    <main
      style={{
        minHeight: '100vh', background: pageBackground,
        fontFamily: '"Playfair Display", Georgia, serif',
        display: 'flex', justifyContent: 'center', position: 'relative',
      }}
    >
      <ParticleField
        kind={plaque.particles as ParticleKind | undefined}
        imageUrl={particlesImg}
        color={plaque.particlesColor || accent}
        fixed
      />
      <FingerTrail
        accent={plaque.trailColor || accent}
        template={(plaque.trailTemplate as TrailTemplate | undefined) ?? 'sparkle'}
        imageUrl={trailImg}
      />
      {musicSrc && <MusicPlayer src={musicSrc} accent={accent} />}

      <div style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 1 }}>
        <BlockList blocks={blocks} ctx={ctx} />
        <VConnectFooter label={translate('website_developed_by', 'ru')} color={ctx.text} />
        {vc && (
          <VConnectContact
            phone={vc.phone}
            telegram={vc.telegram}
            instagram={vc.instagram}
            title={translate('vc_contact_title', 'ru')}
            callLabel={translate('vc_call', 'ru')}
            telegramLabel={translate('vc_telegram', 'ru')}
            instagramLabel={translate('vc_instagram', 'ru')}
            color={ctx.text}
          />
        )}
      </div>
    </main>
  );
};
