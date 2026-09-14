import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { vinviteService, type PromoShowcase, type PromoWork } from './api';
import { TEMPLATE_META, type TemplateMeta } from './templates/meta';

export const EMPTY_SHOWCASE: PromoShowcase = { workSlugs: [], hiddenIds: [] };

// ── What the promotional site shows ─────────────────────────────────────────
//
// "Our work" is REAL published invitations the system administrator chose — a
// gallery of finished work rather than of the blank templates it was built
// from. It is opt-in: an invitation belongs to a customer, so nothing reaches
// the marketing site until somebody deliberately adds it.
//
// `kind` tells the caller whether any were chosen. The marketing page renders
// the gallery only for 'works'; 'templates' means nothing has been picked, and
// the page shows its price list alone rather than filling a portfolio with
// blank templates.

export type ShowcaseItems =
  | { kind: 'works'; works: PromoWork[]; templates: null }
  | { kind: 'templates'; works: null; templates: TemplateMeta[] };

/**
 * THE GALLERY IS SHOWN IN THE ADMINISTRATOR'S OWN ORDER, and there is no
 * "cover" selection any more.
 *
 * A star used to mean "ride the hero as a live card"; when the hero stopped
 * rendering cards it was kept on as "show this one first", which left two
 * controls doing one job — the list already has ↑ / ↓ arrows, and dragging a
 * row to the top says the same thing more plainly. `splitWorks` and the
 * `coverSlugs` column went with it.
 *
 * The server returns the works already ordered, and only the ones still
 * published, so there is nothing left for this module to decide.
 */

/**
 * Templates a visitor may see on the price list, in shipped order.
 *
 * Generic over `{ id }` and defaulting to the METADATA rather than the
 * registry. That is not tidiness: importing the registry here put all twelve
 * designs' markup — 374 kB gzipped — into the marketing page's chunk, because
 * this module is the first thing that page calls. Measured before and after.
 */
export function visibleTemplates<T extends { id: string }>(
  showcase: PromoShowcase,
  all: T[] = TEMPLATE_META as unknown as T[],
): T[] {
  const hidden = new Set(showcase.hiddenIds);
  // A template mentioned nowhere still appears: shipping a new one must not
  // make it invisible until an admin happens to re-save this screen.
  return all.filter((tpl) => !hidden.has(tpl.id));
}

// Read by the landing page while logged out, so neither query may require a
// token, and both must degrade to the shipped defaults if the request fails —
// a promotional page rendering nothing because a settings fetch 500'd would be
// far worse than one showing templates.
export function usePromoShowcase() {
  const showcaseQuery = useQuery({
    queryKey: ['vi-promo-showcase'],
    queryFn: () => vinviteService.getPromoShowcase(),
    staleTime: 60_000,
  });
  const worksQuery = useQuery({
    queryKey: ['vi-promo-works'],
    queryFn: () => vinviteService.getPromoWorks(),
    staleTime: 60_000,
  });

  const showcase = showcaseQuery.data ?? EMPTY_SHOWCASE;
  const templates = useMemo(() => visibleTemplates<TemplateMeta>(showcase), [showcase]);

  const items = useMemo<ShowcaseItems>(() => {
    const works = worksQuery.data ?? [];
    if (works.length === 0) return { kind: 'templates', works: null, templates };
    return { kind: 'works', works, templates: null };
  }, [worksQuery.data, templates]);

  return {
    items,
    /** Templates for the price list — always templates, never invitations. */
    templates,
    showcase,
    isLoading: showcaseQuery.isLoading || worksQuery.isLoading,
  };
}
