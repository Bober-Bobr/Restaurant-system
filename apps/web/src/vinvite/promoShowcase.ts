import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { vinviteService, type PromoShowcase, type PromoWork } from './api';
import { TEMPLATE_META, type TemplateMeta } from './templates/meta';

export const EMPTY_SHOWCASE: PromoShowcase = { workSlugs: [], coverSlugs: [], hiddenIds: [] };

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
  | { kind: 'works'; works: PromoWork[]; cover: PromoWork[]; templates: null }
  | { kind: 'templates'; works: null; cover: null; templates: TemplateMeta[] };

/**
 * The gallery order: starred invitations first, the rest behind them.
 *
 * The "cover" selection used to decide which one or two invitations rode the
 * hero as live cards. The hero no longer renders any — they were the most
 * expensive thing on the site — so rather than leave the administrator a
 * setting that silently does nothing, a star now means FIRST IN THE SLIDER,
 * which is the same intent (this is the one to show people) expressed against
 * what the page actually has.
 *
 * The server already returns them in the administrator's order and only
 * includes ones still published, so this is a stable partition and nothing
 * else. Starring none, or starring all, both leave the order untouched.
 */
export function splitWorks(works: PromoWork[]): { works: PromoWork[]; cover: PromoWork[] } {
  const cover = works.filter((w) => w.onCover);
  const rest = works.filter((w) => !w.onCover);
  return { works: [...cover, ...rest], cover };
}

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
    if (works.length === 0) return { kind: 'templates', works: null, cover: null, templates };
    const split = splitWorks(works);
    return { kind: 'works', works: split.works, cover: split.cover, templates: null };
  }, [worksQuery.data, templates]);

  return {
    items,
    /** Templates for the price list — always templates, never invitations. */
    templates,
    showcase,
    isLoading: showcaseQuery.isLoading || worksQuery.isLoading,
  };
}
