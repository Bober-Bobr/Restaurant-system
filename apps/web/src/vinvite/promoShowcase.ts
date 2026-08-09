import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { vinviteService, type PromoShowcase, type PromoWork } from './api';
import { RICH_TEMPLATES } from './templates';
import type { TemplateDefinition } from './templates/types';

// How many hero cards the promotional cover actually renders. Desktop stacks
// two; a phone shows one, because two rotated iframes do not fit and the back
// card gets clipped. The admin may star more than this — the extras are simply
// next in line if one is unstarred later.
export const COVER_SLOTS_DESKTOP = 2;
export const COVER_SLOTS_MOBILE = 1;

export const EMPTY_SHOWCASE: PromoShowcase = { workSlugs: [], coverSlugs: [], hiddenIds: [] };

// ── What the promotional site shows ─────────────────────────────────────────
//
// "Our work" and the cover are REAL published invitations the system
// administrator chose — a gallery of finished work rather than of the blank
// templates it was built from. Both lists are opt-in: an invitation belongs to
// a customer, so nothing reaches the marketing site by default.
//
// Until anything is chosen the site falls back to the built-in templates. A
// marketing page whose main gallery is empty on a fresh install would look
// broken, and the fallback disappears the moment the first invitation is
// starred. `kind` tells the caller which of the two it got, because they render
// differently — a template is html+config, an invitation is a saved site.

export type ShowcaseItems =
  | { kind: 'works'; works: PromoWork[]; cover: PromoWork[]; templates: null }
  | { kind: 'templates'; works: null; cover: null; templates: TemplateDefinition[] };

/**
 * Splits the resolved invitations into the grid order and the cover order.
 *
 * The server already returns them in the administrator's order and only
 * includes ones that are still published, so the only rule left here is the
 * cover fallback: an empty (or entirely unpublished) cover selection falls back
 * to the front of the list, so the hero can never render blank.
 */
export function splitWorks(works: PromoWork[]): { works: PromoWork[]; cover: PromoWork[] } {
  const cover = works.filter((w) => w.onCover);
  return { works, cover: cover.length > 0 ? cover : works };
}

/** Templates a visitor may see on the price list, in shipped order. */
export function visibleTemplates(
  showcase: PromoShowcase,
  all: TemplateDefinition[] = RICH_TEMPLATES,
): TemplateDefinition[] {
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
  const templates = useMemo(() => visibleTemplates(showcase), [showcase]);

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
