import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { vinviteService, type PublicInviteSite, type RsvpSubmission } from './api';
import { InviteSiteView, isFullBleed } from './InviteSiteView';
import { usePlatformContacts } from '../hooks/usePlatformContacts';

// ── Published invitation site: v-invite.uz/<slug> ─────────────────────────────
// (also usable via a host prop should wildcard subdomains become available)
//
// The rendering itself lives in InviteSiteView, shared with the promotional
// site's showcase cards. This page owns only what is specific to a guest
// arriving at a real invitation: fetching it, the RSVP bridge, and the loading
// and not-found screens.
export const PublicVInvitePage = ({ slug: slugProp }: { slug?: string }) => {
  const { slug: pathSlug = '' } = useParams();
  const slug = slugProp || pathSlug;
  const { data: site, isLoading, isError } = useQuery<PublicInviteSite>({
    queryKey: ['vi-public', slug],
    queryFn: () => vinviteService.publicBySlug(slug),
    enabled: !!slug,
  });

  const contactFor = usePlatformContacts();

  const submitRsvp = useCallback(
    (payload: RsvpSubmission) => vinviteService.publicRsvp(slug, payload),
    [slug],
  );

  // Rich designs fill the viewport; the block designer's pages scroll normally.
  // The check runs before the loading branch so a rich invitation never flashes
  // the neutral loading page under its own full-bleed frame.
  if (site && isFullBleed(site)) {
    return (
      <main style={{ position: 'fixed', inset: 0 }}>
        <InviteSiteView site={site} contacts={contactFor('vinvite')} onRsvp={submitRsvp} />
      </main>
    );
  }

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

  return (
    <main style={{ minHeight: '100vh' }}>
      <InviteSiteView site={site} contacts={contactFor('vinvite')} onRsvp={submitRsvp} />
    </main>
  );
};
