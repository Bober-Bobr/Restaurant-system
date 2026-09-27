import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { eventService } from '../services/event.service';
import { hallService } from '../services/hall.service';
import { tableCategoryService } from '../services/tableCategory.service';
import { menuService } from '../services/menu.service';
import { useAdminStore } from '../store/admin.store';
import { useAuthStore } from '../store/auth.store';
import { useRestaurantBranding } from '../hooks/useRestaurantBranding';
import { translate } from '../utils/translate';
import { isKitchenRole } from '../utils/kitchenRole';
import { menuScopeOfRole } from '../utils/menuScope';
import { CATEGORY_LABEL_KEY } from '../utils/menuCategories';
import { dishName } from '../utils/menuI18n';
import { groupKitchenDishes, servedPortions, type DishGroup } from '../utils/kitchenDishes';
import {
  EMPTY_FILTERS, isFiltering, visibleEvents, type KitchenFilters, type KitchenSort,
} from '../utils/kitchenEvents';
import type { Event } from '../types/domain';
import { httpClient } from '../services/http';

const EVENT_TYPE_LABEL_KEY: Record<NonNullable<Event['eventType']>, Parameters<typeof translate>[0]> = {
  RESERVATION: 'event_type_reservation',
  BANQUET: 'event_type_banquet',
  WEDDING: 'event_type_wedding',
  BIRTHDAY: 'event_type_birthday',
  PRIVATE_PARTY: 'event_type_private_party',
  CORPORATE: 'event_type_corporate',
  FOTIHA_TUI: 'event_type_fotiha_tui',
  NACHOR_OSHI: 'event_type_nachor_oshi',
};

const STATUS_BADGE: Record<Event['status'], { bg: string; labelKey: Parameters<typeof translate>[0] }> = {
  DRAFT: { bg: '#9ca3af', labelKey: 'status_draft' },
  CONFIRMED: { bg: '#16a34a', labelKey: 'status_confirmed' },
  CANCELLED: { bg: '#dc2626', labelKey: 'status_cancelled' },
  COMPLETED: { bg: '#2563eb', labelKey: 'status_completed' },
  MENU_NOT_SELECTED: { bg: '#d97706', labelKey: 'status_menu_not_selected' },
};

const formatDate = (iso: string, locale: string) => {
  const d = new Date(iso);
  return d.toLocaleString(locale === 'ru' ? 'ru-RU' : locale === 'uz' ? 'uz-UZ' : 'en-US', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

export const EmployeeEventsPage = () => {
  const { locale } = useAdminStore();
  const role = useAuthStore((s) => s.role);
  const { name: restaurantName, logoUrl: restaurantLogoUrl } = useRestaurantBranding();
  const t = (key: Parameters<typeof translate>[0], params?: Record<string, string | number>) =>
    translate(key, locale, params);

  const eventsQuery = useQuery<Event[]>({ queryKey: ['events'], queryFn: () => eventService.list() });
  const hallsQuery = useQuery({ queryKey: ['halls'], queryFn: () => hallService.list() });
  const tcQuery = useQuery({ queryKey: ['tableCategories'], queryFn: () => tableCategoryService.list() });
  // The system this role reads the shared dish table through — 'banquet' was
  // hardcoded, which had the Small Banquets cooks exporting the banquet side's
  // prices and switched-off dishes. The server pins it from the role in any
  // case; this makes the query key agree with what comes back.
  const scope = menuScopeOfRole(role) ?? 'banquet';
  const menuQuery = useQuery({ queryKey: ['menu', scope], queryFn: () => menuService.list(scope) });
  // SMALL_KITCHEN reads a booking exactly as KITCHEN does: the section's cooks
  // need the same food on the card. A positive list, in utils/kitchenRole.ts.
  const kitchen = isKitchenRole(role);

  const events = eventsQuery.data ?? [];
  const halls = hallsQuery.data ?? [];
  const tableCategories = tcQuery.data ?? [];
  const menuItems = menuQuery.data ?? [];

  // ── Finding one booking ───────────────────────────────────────────────────
  // `/events` is unbounded by design, so this page holds every booking the
  // restaurant has ever taken. The logic is in utils/kitchenEvents.ts, pure and
  // tested; this is only the state behind the controls.
  const [filters, setFilters] = useState<KitchenFilters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<KitchenSort>('date-asc');
  const shown = useMemo(() => visibleEvents(events, filters, sort), [events, filters, sort]);
  const narrowed = isFiltering(filters);
  /** Only the halls that a booking on this page actually names. */
  const hallOptions = useMemo(() => {
    const named = new Set(events.map((e) => e.hallId).filter(Boolean) as string[]);
    return halls.filter((h) => named.has(h.id));
  }, [events, halls]);

  /**
   * Which dish groups are open, keyed by booking, block and category.
   *
   * Collapsed by default: a wedding runs to forty dishes across eight
   * categories, and the whole point of grouping them is that the card can be
   * skimmed. Nothing is lost by it — the collapsed row carries the dish and
   * portion counts.
   */
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const toggle = (key: string) => setOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  const setMany = (keys: string[], value: boolean) =>
    setOpen((prev) => ({ ...prev, ...Object.fromEntries(keys.map((k) => [k, value])) }));

  const downloadEvent = async (event: Event, format: 'pdf' | 'excel') => {
    const hall = halls.find((h) => h.id === event.hallId);
    const tc = tableCategories.find((c) => c.id === event.tableCategoryId);
    const selectedItems: Record<string, number> = {};
    (event.selections ?? []).forEach((s) => {
      selectedItems[s.menuItem.id] = s.quantity;
    });

    // No financial information — pricing zeroed out for employees
    const body = {
      customerName: event.customerName,
      customerPhone: event.customerPhone ?? '',
      hallName: hall?.name ?? '',
      tableCategoryName: tc?.name ?? '',
      guestCount: event.guestCount,
      selectedItems,
      menuItems,
      pricing: { subtotalCents: 0, serviceFeeCents: 0, taxCents: 0, perGuestCents: 0, totalCents: 0 },
      locale,
      // The employee export carries the restaurant's own brand like every
      // other one. It used to send an empty name and no logo at all, which is
      // how it ended up wearing another restaurant's.
      restaurantName: restaurantName ?? '',
      restaurantLogoUrl,
      excludeFinancial: true,
    };

    const url = format === 'pdf' ? '/public/export/pdf' : '/public/export/excel';
    const filename = `event-${event.id}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;

    try {
      const response = await httpClient.post(url, body, { responseType: 'blob' });
      const downloadUrl = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      alert(t('download_failed'));
    }
  };

  return (
    <main className="tablet-fade-in" style={{ maxWidth: 1180, margin: '0 auto', padding: '28px 20px', position: 'relative', zIndex: 1 }}>
      <h1 className="adm-title" style={{ marginBottom: 6 }}>{t('events')}</h1>
      {/* The count is of what is ON SCREEN, and says what the whole list holds
          beside it — a filtered page reporting the full total is a page that
          contradicts itself. */}
      <p style={{ color: 'rgba(226,232,240,0.55)', fontSize: 13, marginBottom: 20, marginTop: 0 }}>
        {narrowed ? t('ke_shown_of', { shown: shown.length, total: events.length }) : `${events.length} ${t('events').toLowerCase()}`}
      </p>

      {/* Search, filters and sorting. The list is every booking the restaurant
          has ever taken, so this is the way into it. */}
      <div className="ke-bar">
        <label className="ke-field ke-search">
          <span className="adm-label">{t('ke_search')}</span>
          <input className="adm-input" inputMode="numeric" placeholder={t('ke_search_placeholder')}
            value={filters.query} onChange={(e) => setFilters({ ...filters, query: e.target.value })} />
        </label>
        <label className="ke-field">
          <span className="adm-label">{t('ke_when')}</span>
          <select className="adm-input" value={filters.when}
            onChange={(e) => setFilters({ ...filters, when: e.target.value as KitchenFilters['when'] })}>
            <option value="all">{t('ke_when_all')}</option>
            <option value="today">{t('ke_when_today')}</option>
            <option value="upcoming">{t('ke_when_upcoming')}</option>
            <option value="past">{t('ke_when_past')}</option>
          </select>
        </label>
        <label className="ke-field">
          <span className="adm-label">{t('status')}</span>
          <select className="adm-input" value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value as KitchenFilters['status'] })}>
            <option value="">{t('ke_any')}</option>
            {(Object.keys(STATUS_BADGE) as Event['status'][]).map((key) => (
              <option key={key} value={key}>{t(STATUS_BADGE[key].labelKey)}</option>
            ))}
          </select>
        </label>
        {/* Only the halls a booking on this page actually names: a picker
            listing rooms with nothing in them is a list of dead ends. */}
        {hallOptions.length > 1 && (
          <label className="ke-field">
            <span className="adm-label">{t('hall')}</span>
            <select className="adm-input" value={filters.hallId}
              onChange={(e) => setFilters({ ...filters, hallId: e.target.value })}>
              <option value="">{t('ke_any')}</option>
              {hallOptions.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
          </label>
        )}
        <label className="ke-field">
          <span className="adm-label">{t('ke_sort')}</span>
          <select className="adm-input" value={sort} onChange={(e) => setSort(e.target.value as KitchenSort)}>
            <option value="date-asc">{t('ke_sort_date_asc')}</option>
            <option value="date-desc">{t('ke_sort_date_desc')}</option>
            <option value="number-desc">{t('ke_sort_number_desc')}</option>
            <option value="number-asc">{t('ke_sort_number_asc')}</option>
            <option value="guests-desc">{t('ke_sort_guests_desc')}</option>
          </select>
        </label>
        {narrowed && (
          <button type="button" className="adm-btn-ghost ke-clear" onClick={() => setFilters(EMPTY_FILTERS)}>
            {t('ke_clear')}
          </button>
        )}
      </div>

      {eventsQuery.isLoading && <p style={{ color: 'rgba(226,232,240,0.55)' }}>{t('loading_events')}</p>}
      {eventsQuery.isError && <p style={{ color: '#fca5a5' }}>{t('failed_load_events')}</p>}

      <div style={{ display: 'grid', gap: 14 }}>
        {shown.map((event, idx) => {
          // The booking carries its own hall, so the room is named even when the
          // halls request has not landed, or the hall was retired since. It used
          // to depend entirely on finding it in that second list.
          const hall = event.hall ?? halls.find((h) => h.id === event.hallId);
          const tc = tableCategories.find((c) => c.id === event.tableCategoryId);
          const selections = event.selections ?? [];
          const floorTables = event.floorTables ?? [];
          const status = STATUS_BADGE[event.status];
          // Portions, not servings: a hot appetizer is one per guest, and the
          // sheet this card downloads has always said so.
          const packageGroups = groupKitchenDishes((tc?.packageItems ?? []).map((pi) => ({
            id: pi.id,
            name: dishName(pi.menuItem, locale),
            category: pi.menuItem.category,
            portions: servedPortions({ category: pi.menuItem.category, servings: pi.servings }, event.guestCount),
          })));
          const selectionGroups = groupKitchenDishes(selections.map((sel) => ({
            id: sel.id,
            name: dishName(sel.menuItem, locale),
            category: sel.menuItem.category,
            portions: sel.quantity,
          })));

          return (
            <div key={event.id} className="adm-card adm-card-hover tablet-fade-up" style={{ padding: 20, animationDelay: `${idx * 60}ms` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#f8fafc' }}>
                  <span style={{ color: 'var(--adm-accent)' }}>#{event.id}</span> — {event.customerName}
                </h2>
                <span className="adm-badge" style={{ background: status.bg, color: '#fff' }}>
                  {t(status.labelKey)}
                </span>
                {event.eventType && (
                  <span className="adm-badge" style={{ background: 'rgba(99,102,241,0.18)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.3)' }}>
                    {t(EVENT_TYPE_LABEL_KEY[event.eventType])}
                  </span>
                )}
                {/* WHICH ROOM, up beside the number. It is the first thing a cook
                    wants off a list of bookings, and as one cell in the grid
                    below it was a row that simply vanished when a booking had no
                    hall — reading as "anywhere" rather than "not chosen". */}
                {kitchen && (
                  <span className="adm-badge ke-hall" title={t('hall')}>
                    {hall?.name ?? t('not_selected')}
                  </span>
                )}
              </div>

              <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: 14 }}>
                <Detail label={t('event_date_time')} value={formatDate(event.eventDate, locale)} />
                <Detail label={t('guests')} value={String(event.guestCount)} />
                {hall && <Detail label={t('hall')} value={hall.name} />}
                {tc && <Detail label={t('table_category')} value={tc.name} />}
                {/* Where in that room the party sits. A cook plating for table
                    7 needs the number, not only the name of the hall — and a
                    booking with a hall and no tables says so, rather than
                    leaving a gap that reads as "anywhere". */}
                {hall && (
                  <Detail
                    label={t('fm_chosen_tables')}
                    value={event.wholeHall ? t('fm_whole_area_taken')
                      : floorTables.length > 0
                        ? floorTables.map((x) => `${x.floorTable?.label ?? '—'} · ${x.guestCount}`).join(', ')
                        : t('fm_no_tables_yet')}
                  />
                )}
              </div>

              {/* The dishes, in categories that fold away. A wedding runs to
                  forty of them and the flat column they were in could not be
                  skimmed; the served courses come first, in the order the
                  printed sheet uses. */}
              {kitchen && packageGroups.length > 0 && (
                <DishBlock
                  label={t('table_category_dishes')} groups={packageGroups}
                  open={open} onToggle={toggle} onAll={setMany} keyFor={(c) => `${event.id}:pkg:${c}`} t={t}
                />
              )}

              {selectionGroups.length > 0 && (
                <DishBlock
                  label={kitchen ? t('additional_dishes') : t('selected_dishes')} groups={selectionGroups}
                  open={open} onToggle={toggle} onAll={setMany} keyFor={(c) => `${event.id}:add:${c}`} t={t}
                />
              )}

              {event.notes && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 10, marginBottom: 12, fontSize: 13, color: 'rgba(226,232,240,0.65)' }}>
                  <strong style={{ color: 'var(--adm-accent)' }}>{t('notes')}:</strong> {event.notes}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 14 }}>
                <button onClick={() => downloadEvent(event, 'pdf')} className="adm-btn-primary" style={{ fontSize: 13 }}>
                  {t('download_pdf')}
                </button>
                <button onClick={() => downloadEvent(event, 'excel')} className="adm-btn-ghost" style={{ fontSize: 13, color: '#4ade80', borderColor: 'rgba(74,222,128,0.3)' }}>
                  {t('download_excel')}
                </button>
              </div>
            </div>
          );
        })}

        {/* Two different empty states: nothing to show, and nothing MATCHING.
            One message for both leaves the reader wondering whether the
            restaurant has no bookings or their search is simply wrong. */}
        {!eventsQuery.isLoading && shown.length === 0 && (
          narrowed
            ? <p className="adm-empty">{t('ke_none_match')}</p>
            : <p className="adm-empty">{t('no_items_selected')}</p>
        )}
      </div>

      <style>{`
        /* Search, filters and sorting. A row of fields that wraps, rather than a
           grid: the hall picker is not always there, and a fixed grid would
           leave a hole where it should be. */
        .ke-bar {
          display: flex; flex-wrap: wrap; gap: 12px; align-items: end;
          margin-bottom: 20px; padding: 14px;
          border: 1px solid var(--adm-line); border-radius: 6px;
          background: rgba(var(--adm-text-rgb), 0.03);
        }
        .ke-field { display: grid; gap: 4px; min-width: 150px; }
        .ke-search { min-width: 190px; flex: 1 1 190px; }
        .ke-bar .adm-input { width: 100%; }
        .ke-clear { align-self: end; }
        .ke-hall {
          background: rgba(var(--adm-accent-rgb), 0.16);
          color: var(--adm-accent);
          border: 1px solid rgba(var(--adm-accent-rgb), 0.35);
        }

        .ke-dishes { border-top: 1px solid rgba(255,255,255,0.06); padding-top: 12px; margin-bottom: 12px; }
        .ke-dishes-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 8px; }
        .ke-all {
          background: none; border: 0; cursor: pointer; padding: 2px 4px;
          font-size: 12px; font-weight: 600; color: var(--adm-accent);
          text-decoration: underline; text-underline-offset: 3px;
        }
        .ke-groups { display: grid; gap: 6px; }
        .ke-group { border: 1px solid var(--adm-line); border-radius: 4px; overflow: hidden; }
        /* A served course is what goes out during the evening. Marked with a
           spine as well as being first in the list, so it still reads where the
           accent colour does not. */
        .ke-group.is-served { border-left: 2px solid rgba(var(--adm-accent-rgb), 0.7); }
        .ke-group-head {
          display: flex; align-items: center; gap: 8px; width: 100%;
          padding: 8px 10px; cursor: pointer; text-align: left;
          background: rgba(var(--adm-text-rgb), 0.03); border: 0; color: inherit;
        }
        .ke-group-head:hover { background: rgba(var(--adm-text-rgb), 0.06); }
        .ke-caret { font-size: 11px; color: var(--adm-accent); width: 10px; }
        .ke-group-name { font-size: 13px; font-weight: 700; color: #e2e8f0; }
        .ke-group-meta { margin-left: auto; font-size: 11px; color: rgba(226,232,240,0.5); }
        .ke-list { margin: 0; padding: 8px 12px 10px 28px; display: grid; gap: 4px; list-style: disc; }
        .ke-list li { font-size: 13px; color: #cbd5e1; }
        .ke-portions { color: rgba(226,232,240,0.45); }

        @media (max-width: 640px) {
          /* Two-up, not stacked. Five full-width fields measured 396px on a
             390px screen — a whole phone screen of controls before the first
             booking. The search keeps its own line, since it is the one that is
             typed into. */
          .ke-field { min-width: 0; flex: 1 1 calc(50% - 6px); }
          .ke-search { min-width: 0; flex: 1 1 100%; }
          .ke-clear { flex: 1 1 100%; }
        }
      `}</style>
    </main>
  );
};

/**
 * One block of dishes, grouped into categories that fold away.
 *
 * The open/closed state is held by the PAGE, keyed by booking and block, not by
 * this component: a card re-rendered by a filter change or a refetch would
 * otherwise snap every group shut under the reader.
 */
const DishBlock = ({ label, groups, open, onToggle, onAll, keyFor, t }: {
  label: string;
  groups: DishGroup[];
  open: Record<string, boolean>;
  onToggle: (key: string) => void;
  onAll: (keys: string[], value: boolean) => void;
  keyFor: (category: string) => string;
  t: (key: Parameters<typeof translate>[0], params?: Record<string, string | number>) => string;
}) => {
  const keys = groups.map((g) => keyFor(g.category));
  const anyOpen = keys.some((k) => open[k]);
  const dishes = groups.reduce((sum, g) => sum + g.dishCount, 0);
  return (
    <div className="ke-dishes">
      <div className="ke-dishes-head">
        <p className="adm-label" style={{ margin: 0 }}>{label} ({dishes})</p>
        <button type="button" className="ke-all" onClick={() => onAll(keys, !anyOpen)}>
          {anyOpen ? t('ke_collapse_all') : t('ke_expand_all')}
        </button>
      </div>
      <div className="ke-groups">
        {groups.map((group) => {
          const key = keyFor(group.category);
          const shown = !!open[key];
          const categoryLabel = CATEGORY_LABEL_KEY[group.category as keyof typeof CATEGORY_LABEL_KEY];
          return (
            <div key={key} className={`ke-group${group.served ? ' is-served' : ''}`}>
              <button type="button" className="ke-group-head" aria-expanded={shown} onClick={() => onToggle(key)}>
                <span className="ke-caret" aria-hidden="true">{shown ? '▾' : '▸'}</span>
                <span className="ke-group-name">{categoryLabel ? t(categoryLabel) : group.category}</span>
                {/* Both counts on the closed row, so folding a group away hides
                    no number the prep depends on. */}
                <span className="ke-group-meta">
                  {t('ke_group_meta', { dishes: group.dishCount, portions: group.portions })}
                </span>
              </button>
              {shown && (
                <ul className="ke-list">
                  {group.dishes.map((d) => (
                    <li key={d.id}>
                      {d.name} <span className="ke-portions">× {d.portions}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const Detail = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="adm-label" style={{ margin: 0 }}>{label}</p>
    <p style={{ margin: '4px 0 0', fontSize: 14, color: '#e2e8f0', fontWeight: 600 }}>{value}</p>
  </div>
);

const btnStyle = (bg: string): React.CSSProperties => ({
  padding: '7px 14px',
  background: bg,
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
});
