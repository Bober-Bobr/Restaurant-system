import { useEffect, useMemo, useRef, useState } from 'react';
import { CATEGORY_LABEL_KEY, orderCategories, type MenuCategory } from '../utils/menuCategories';
import { dishName } from '../utils/menuI18n';
import type { MenuItem } from '../types/domain';
import type { PublicRestaurantDetail } from '../services/publicRestaurant.service';
import { DishCard } from './DishCard';
import { DishModal } from './DishModal';
import { SectionHeading, useRailScroll, useT } from './ui';

// ── The menu ────────────────────────────────────────────────────────────────
// One continuous scroll with a sticky category rail, replacing the live site's
// two levels (category tiles → /category/:cat). Every dish is one scroll from
// the cart, and ordering never costs a page change.

const BESTSELLERS = '__bestsellers__';

type Section = {
  id: string;
  title: string;
  items: MenuItem[];
  /** Subcategory blocks inside a category section. */
  groups: { id: string; name: string | null; items: MenuItem[] }[];
};

export function MenuPage({
  restaurant, menuItems,
}: {
  restaurant: PublicRestaurantDetail;
  menuItems: MenuItem[];
}) {
  const { t, locale } = useT();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<MenuItem | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const railRef = useRef<HTMLDivElement>(null);

  const active = useMemo(() => menuItems.filter((m) => m.isActive), [menuItems]);

  const searched = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return active;
    return active.filter((m) => dishName(m, locale).toLowerCase().includes(q));
  }, [active, query, locale]);

  const sections = useMemo<Section[]>(() => {
    const out: Section[] = [];

    // Bestsellers lead, when there are any and the guest is not searching. The
    // live site made this a filter toggle; as a section it costs no interaction.
    if (!query.trim()) {
      const best = searched.filter((m) => m.isBestseller && !m.isOutOfStock);
      if (best.length > 0) {
        out.push({ id: BESTSELLERS, title: t('fs_bestsellers'), items: best, groups: [{ id: 'all', name: null, items: best }] });
      }
    }

    for (const cat of orderCategories(restaurant.categoryOrder)) {
      const items = searched.filter((m) => m.category === cat);
      if (items.length === 0) continue;
      out.push({
        id: cat,
        title: t(CATEGORY_LABEL_KEY[cat as MenuCategory]),
        items,
        groups: groupBySubcategory(items, cat as MenuCategory, !!restaurant.hideSubcategories),
      });
    }
    return out;
  }, [searched, restaurant.categoryOrder, restaurant.hideSubcategories, query, locale, t]);

  // Re-measure the rail's overflow when the chip set changes (search filtering
  // adds and removes categories).
  const sectionsKey = sections.map((s) => s.id).join('|');
  const rail = useRailScroll(railRef, [sectionsKey]);

  // ── Scroll-spy ──
  // Tracks which section heading last crossed beneath the sticky header. An
  // IntersectionObserver on the sections themselves would fight the rail's own
  // height; comparing heading offsets is both simpler and stable while a
  // programmatic scroll is in flight.
  useEffect(() => {
    if (sections.length === 0) return;
    const onScroll = () => {
      const line = 190; // header + rail, plus a little slack
      let current = sections[0]!.id;
      for (const section of sections) {
        const el = document.getElementById(`fs-cat-${section.id}`);
        if (el && el.getBoundingClientRect().top <= line) current = section.id;
      }
      setActiveId(current);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [sections]);

  // Keep the highlighted chip visible — on a phone the active one otherwise
  // ends up off-screen and the rail looks broken.
  useEffect(() => {
    if (!activeId || !railRef.current) return;
    const chip = railRef.current.querySelector<HTMLElement>(`[data-chip="${CSS.escape(activeId)}"]`);
    chip?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [activeId]);

  const jumpTo = (id: string) => {
    const el = document.getElementById(`fs-cat-${id}`);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 168;
    window.scrollTo({ top, behavior: 'smooth' });
  };

  return (
    <>
      {/* Sticky rail: search + category chips. */}
      <div className="fs-glass" style={{
        position: 'sticky', top: 0, zIndex: 30, margin: '0 -16px',
        padding: '10px 16px', borderBottom: '1px solid var(--fs-line)',
        display: 'grid', gap: 9,
      }}>
        <input
          className="fs-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('fs_search_dishes')}
          aria-label={t('fs_search_dishes')}
          style={{ padding: '9px 13px', fontSize: 14 }}
        />
        {sections.length > 0 && (
          <div className="fs-rail-wrap">
            {/* Arrows exist for the mouse: a wheel only emits deltaY, so without
                them (and the wheel translation in useRailScroll) the rail was
                immovable on a desktop. Hidden on touch widths, where a flick
                already works and they would just cover chips. */}
            <button type="button" className="fs-rail-arrow left" aria-label="‹"
              hidden={!rail.overflow.left} onClick={() => rail.nudge(-1)}>‹</button>

            <div ref={railRef} className="fs-scroll-x fs-rail" style={{ display: 'flex', gap: 7 }}>
              {sections.map((section) => (
                <button
                  key={section.id}
                  type="button"
                  data-chip={section.id}
                  className={`fs-chip${activeId === section.id ? ' is-active' : ''}`}
                  onClick={() => jumpTo(section.id)}
                >
                  {section.title}
                </button>
              ))}
            </div>

            <button type="button" className="fs-rail-arrow right" aria-label="›"
              hidden={!rail.overflow.right} onClick={() => rail.nudge(1)}>›</button>
          </div>
        )}
      </div>

      {sections.length === 0 && (
        <p className="fs-muted" style={{ padding: '48px 0', textAlign: 'center', fontSize: 15 }}>
          {query.trim() ? t('fs_no_results') : t('no_dishes_in_category')}
        </p>
      )}

      {sections.map((section) => (
        <section key={section.id} id={`fs-cat-${section.id}`} style={{ paddingTop: 30 }}>
          <SectionHeading title={section.title} meta={`${section.items.length}`} />

          {section.groups.map((group) => (
            <div key={group.id} style={{ marginBottom: 6 }}>
              {group.name && (
                <p style={{
                  margin: '10px 0 12px', fontSize: 12, fontWeight: 700,
                  letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--fs-faint)',
                }}>
                  {group.name}
                </p>
              )}
              <div style={{
                display: 'grid', gap: 14,
                gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
              }}>
                {group.items.map((item) => (
                  <DishCard key={`${section.id}-${item.id}`} item={item} onOpen={() => setSelected(item)} />
                ))}
              </div>
            </div>
          ))}
        </section>
      ))}

      {selected && <DishModal item={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

// A dish honours its subcategory only when all three hold: the restaurant's
// master switch is off, the subcategory belongs to this same category, and the
// subcategory is not itself hidden. Carried over verbatim from the live site —
// the rules are the restaurant's settings, not presentation.
export function groupBySubcategory(items: MenuItem[], cat: MenuCategory, hideSubcategories: boolean) {
  const NONE = '__none__';
  const map = new Map<string, { id: string; name: string | null; sortOrder: number; items: MenuItem[] }>();

  for (const item of items) {
    const sub = !hideSubcategories && item.subcategory
      && item.subcategory.category === cat && !item.subcategory.hidden
      ? item.subcategory : null;
    const key = sub?.id ?? NONE;
    if (!map.has(key)) {
      map.set(key, { id: key, name: sub?.name ?? null, sortOrder: sub?.sortOrder ?? 0, items: [] });
    }
    map.get(key)!.items.push(item);
  }

  const groups = [...map.values()].sort((a, b) => {
    // Ungrouped dishes go last, so named sections lead.
    if (a.id === NONE) return 1;
    if (b.id === NONE) return -1;
    return a.sortOrder - b.sortOrder || (a.name ?? '').localeCompare(b.name ?? '');
  });

  // The leftover bucket carries no name, so it never renders a heading — the
  // section title already covers it. Named subcategories always render theirs,
  // including when a category has only one.
  for (const group of groups) {
    group.items.sort((a, b) => Number(!!b.isBestseller) - Number(!!a.isBestseller));
  }
  return groups.map(({ id, name, items: groupItems }) => ({ id, name, items: groupItems }));
}
