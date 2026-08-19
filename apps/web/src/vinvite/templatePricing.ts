import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { vinviteService, type TemplatePricing, type TemplateTier } from './api';
import { useViT } from './i18n';
import { formatSum } from '../utils/currency';

// The price list, shared by the two public pages that quote prices — the
// landing catalog and the pricing page. One query key, so a visitor moving
// between them does not refetch, and one definition of what an unset price
// reads as.
//
// Public on purpose: `GET /api/vinvite/template-pricing` needs no token,
// because a logged-out visitor is exactly who these prices are for.

export function useTemplatePricing() {
  const t = useViT();
  const query = useQuery({
    queryKey: ['vi-template-pricing'],
    queryFn: () => vinviteService.getTemplatePricing(),
    staleTime: 60_000,
  });

  const byTemplate = useMemo(() => {
    const map = new Map<string, TemplatePricing>();
    for (const row of query.data ?? []) map.set(row.templateId, row);
    return map;
  }, [query.data]);

  /**
   * Both columns are nullable, and the two blanks mean different things: a
   * template nobody has priced is "on request", a template priced at zero is
   * free. Collapsing them would quote the wrong thing in one of the two cases.
   */
  const priceLabel = (templateId: string): string => {
    const price = byTemplate.get(templateId)?.priceCents;
    if (price == null) return t('pricing_on_request');
    if (price === 0) return t('pricing_free');
    return formatSum(price);
  };

  const tierOf = (templateId: string): TemplateTier | null =>
    byTemplate.get(templateId)?.tier ?? null;

  return { byTemplate, priceLabel, tierOf };
}
