import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { vinviteService } from './api';
import type { TemplateDefinition } from './templates/types';

// Admin-saved design override for a template, falling back to its shipped
// default. All cards/previews/new invitations use the effective config — and so
// does the promotional site, so a design the system administrator edited is
// what visitors actually see on the cover.
//
// The read is public, so this works on the logged-out landing page too.
export function useTemplateOverrides() {
  const query = useQuery({
    queryKey: ['vi-tpl-overrides'],
    queryFn: () => vinviteService.listTemplateOverrides(),
    staleTime: 60_000,
  });
  const map = useMemo(() => {
    const m = new Map<string, Record<string, unknown>>();
    for (const o of query.data ?? []) m.set(o.templateId, o.config);
    return m;
  }, [query.data]);
  return { effectiveConfig: (tpl: TemplateDefinition) => map.get(tpl.id) ?? tpl.defaultConfig };
}
