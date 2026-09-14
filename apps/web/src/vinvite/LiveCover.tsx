import { InviteSiteView } from './InviteSiteView';
import type { PromoWork } from './api';

// ── The cover of a real invitation, held still ───────────────────────────────
//
// The gallery's cards show the actual first screen of the invitation they open,
// which is what a visitor is there to look at. What they do NOT do is perform:
// no intro sequence, no reveal-on-scroll, no opening film, nothing moving. Four
// invitations playing their own openings at the foot of a marketing page is four
// devices' worth of work for a thumbnail, and it is why these cards were reduced
// to a name and a gradient once before.
//
// `still` is the whole mechanism (see RichRenderer): the template is told the
// reader asked for no motion, so it takes the path it already has for exactly
// that — everything revealed at once, and the poster frame instead of the film.
// That is also the cheapest path it has.
//
// THIS MODULE IS THE LAZY BOUNDARY. It is the only thing in the gallery that
// reaches `InviteSiteView`, and through it the template registry — 374 kB of
// markup that must stay out of the landing page's own chunk. `landingWeight`
// guards the import; the card mounts this only once it is near the viewport, so
// a visitor who never scrolls to the gallery pays nothing at all.
export default function LiveCover({ site }: { site: PromoWork }) {
  return (
    <InviteSiteView
      site={site}
      // No music, no cursor trail, no falling particles: a cover must not start
      // anything on the visitor's behalf.
      chrome={false}
      // No handler, so the card cannot take a real reply even if a guest managed
      // to reach the form inside it.
      still
    />
  );
}
