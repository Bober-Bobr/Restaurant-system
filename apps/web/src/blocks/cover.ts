import type { Invitation } from '../services/invitation.service';

// First image found in the block list → the project's card cover in the flyer
// gallery. Falls back to the theme background photo.
export function flyerCoverUrl(inv: Pick<Invitation, 'blocks' | 'backgroundImageUrl'>): string | null {
  for (const b of inv.blocks ?? []) {
    const p = (b.props ?? {}) as Record<string, unknown>;
    for (const key of ['imageUrl', 'url', 'photoUrl']) {
      const v = p[key];
      if (typeof v === 'string' && v) return v;
    }
    const items = p.items;
    if (Array.isArray(items)) {
      for (const it of items) {
        const ph = (it as { photoUrl?: string | null } | null)?.photoUrl;
        if (typeof ph === 'string' && ph) return ph;
      }
    }
  }
  return inv.backgroundImageUrl ?? null;
}
