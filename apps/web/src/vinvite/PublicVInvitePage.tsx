import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { vinviteService, type PublicInviteSite } from './api';
import { getPhotoUrl } from '../utils/photoUrl';
import { FingerTrail, type TrailTemplate } from '../components/FingerTrail';
import { MusicPlayer } from '../components/MusicPlayer';
import { BlockList, readableText, type RenderCtx } from '../blocks/BlockRenderer';
import { ParticleField } from '../blocks/ParticleField';

function hexToRgba(hex: string, alpha: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!m) return `rgba(37,99,235,${alpha})`;
  const r = parseInt(m[1], 16), g = parseInt(m[2], 16), b = parseInt(m[3], 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ── Published invitation site: v-invite.uz/<slug> ─────────────────────────────
// (also usable via a host prop should wildcard subdomains become available)
export const PublicVInvitePage = ({ slug: slugProp }: { slug?: string }) => {
  const { slug: pathSlug = '' } = useParams();
  const slug = slugProp || pathSlug;
  const { data: site, isLoading, isError } = useQuery<PublicInviteSite>({
    queryKey: ['vi-public', slug],
    queryFn: () => vinviteService.publicBySlug(slug),
    enabled: !!slug,
  });

  if (isLoading) {
    return <main style={{ minHeight: '100vh', background: '#faf6ee', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>…</main>;
  }
  if (isError || !site) {
    return (
      <main style={{ minHeight: '100vh', background: '#faf6ee', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: '#1f2937', fontFamily: 'system-ui, sans-serif' }}>
        <span style={{ fontSize: 42 }}>💌</span>
        <p style={{ margin: 0, fontWeight: 600 }}>Invitation not found</p>
      </main>
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
  };

  return (
    <main style={{ minHeight: '100vh', background: pageBackground, color: '#1a1a1a', fontFamily: '"Playfair Display", Georgia, serif', display: 'flex', justifyContent: 'center', position: 'relative' }}>
      <ParticleField kind={theme.particles} fixed />
      <FingerTrail accent={theme.trailColor || accent} template={(theme.trailTemplate ?? 'sparkle') as TrailTemplate} />
      {musicSrc && <MusicPlayer src={musicSrc} accent={accent} />}
      <div style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 1 }}>
        <BlockList blocks={site.blocks ?? []} ctx={ctx} />
      </div>
    </main>
  );
};
