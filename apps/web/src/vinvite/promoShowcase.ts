import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { vinviteService, type PromoShowcase } from './api';
import { RICH_TEMPLATES } from './templates';
import type { TemplateDefinition } from './templates/types';

// How many hero cards the promotional cover actually renders. Desktop stacks
// two; a phone shows one, because two rotated iframes do not fit and the back
// card gets clipped. The admin may star more than this — the extras are simply
// next in line if one is unstarred later.
export const COVER_SLOTS_DESKTOP = 2;
export const COVER_SLOTS_MOBILE = 1;

export const EMPTY_SHOWCASE: PromoShowcase = { coverIds: [], orderIds: [], hiddenIds: [] };

export type ResolvedShowcase = {
  /** Templates shown on the promotional site, in the admin's order. */
  work: TemplateDefinition[];
  /** Templates featured on the main cover, in the admin's order. */
  cover: TemplateDefinition[];
};

// Turns the stored id lists into real templates.
//
// Every rule here exists so the promotional site cannot be broken from the
// settings form or by shipping a new template:
//
//  - Ids that no longer match a shipped template are dropped, so removing a
//    template from the code does not leave a hole.
//  - A template mentioned in NO list still appears, at the end of the order.
//    Without this, adding a template would make it invisible until an admin
//    happened to re-save these settings — a silent failure nobody would connect
//    to this screen.
//  - An empty (or entirely stale) cover selection falls back to the front of
//    the visible list, which is exactly the behaviour before this feature. The
//    hero can therefore never render blank.
export function resolveShowcase(
  showcase: PromoShowcase,
  all: TemplateDefinition[] = RICH_TEMPLATES,
): ResolvedShowcase {
  const byId = new Map(all.map((t) => [t.id, t]));
  const hidden = new Set(showcase.hiddenIds);

  const ordered: TemplateDefinition[] = [];
  const placed = new Set<string>();
  for (const id of showcase.orderIds) {
    const tpl = byId.get(id);
    if (tpl && !placed.has(id)) { ordered.push(tpl); placed.add(id); }
  }
  for (const tpl of all) {
    if (!placed.has(tpl.id)) { ordered.push(tpl); placed.add(tpl.id); }
  }

  const work = ordered.filter((t) => !hidden.has(t.id));

  const cover: TemplateDefinition[] = [];
  const onCover = new Set<string>();
  for (const id of showcase.coverIds) {
    const tpl = byId.get(id);
    if (tpl && !hidden.has(id) && !onCover.has(id)) { cover.push(tpl); onCover.add(id); }
  }

  return { work, cover: cover.length > 0 ? cover : work };
}

// Read by the landing page while logged out, so the query must never require a
// token and must degrade to the shipped defaults if the request fails —
// a promotional page that renders nothing because a settings fetch 500'd would
// be far worse than one showing the default order.
export function usePromoShowcase() {
  const query = useQuery({
    queryKey: ['vi-promo-showcase'],
    queryFn: () => vinviteService.getPromoShowcase(),
    staleTime: 60_000,
  });
  const showcase = query.data ?? EMPTY_SHOWCASE;
  const resolved = useMemo(() => resolveShowcase(showcase), [showcase]);
  return { ...resolved, showcase, isLoading: query.isLoading };
}
