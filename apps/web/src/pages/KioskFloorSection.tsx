import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FLOOR_PLAN_CSS, FloorPlanView, type TableState } from '../components/floor/FloorPlanView';
import { floorMapService } from '../services/floorMap.service';
import { useTabletStore } from '../store/tablet.store';
import { dayKey, seatedGuests, seatsRemaining, tableHolders, tablesByHallOf, wholeAreaAvailable } from '../utils/floorBooking';
import type { MapArea, MapTable } from '../utils/floorMap';
import type { translate } from '../utils/translate';

/**
 * The map section on the kiosk — the guest picks where they will sit.
 *
 * Shown in BOTH kinds of session: a banquet evening chooses its tables here
 * just as a general-dining one does, and the difference between the two
 * sessions is about packages and prices, not about the room.
 *
 * Two things make it a booking surface rather than a picture:
 *
 *  · **What is already taken that day is not pickable.** Occupancy is read for
 *    the booking's own date, so moving the date changes what is free — which
 *    is why the date is a prop and not read from here.
 *  · **The whole area can be taken**, but only once every table on that map is
 *    free. The server checks it again on save: the button is a courtesy, and
 *    two guests on two tablets can reach it at the same moment.
 */

type TFn = (key: Parameters<typeof translate>[0], params?: Record<string, string | number>) => string;

type Props = {
  /** The booking's date, `YYYY-MM-DD`. Empty until the guest picks one. */
  date: string;
  /**
   * The head count this booking is for, 0 when none was given. The seating
   * may not exceed it — the server refuses the save either way, so the
   * steppers stop short of it rather than letting a guest build something
   * that will be turned down at Confirm.
   */
  guestCount?: number;
  /**
   * Drawn large. A general-dining booking is ONLY the map — there is no menu,
   * no package and no price beside it — so the plan is the page rather than a
   * card on it, and a table has to be tappable at arm's length.
   */
  large?: boolean;
  t: TFn;
};

type KindFilter = 'ALL' | 'HALL' | 'OUTDOOR';

export const KioskFloorSection = ({ date, large = false, guestCount = 0, t }: Props) => {
  const {
    floorSelections, wholeAreaId, toggleFloorTable, setFloorTableGuests, setWholeArea,
  } = useTabletStore();
  const [areaId, setAreaId] = useState<string | null>(null);
  const [kind, setKind] = useState<KindFilter>('ALL');

  const { data: map } = useQuery({ queryKey: ['kiosk-floor-map'], queryFn: () => floorMapService.get() });
  // Keyed on the DAY: a booking holds its tables for the whole of the one it
  // falls on, so this is re-read whenever the guest moves the date.
  const day = date || dayKey(new Date());
  const { data: occupancy } = useQuery({
    queryKey: ['kiosk-floor-day', day],
    queryFn: () => floorMapService.day(day),
    enabled: !!map,
  });

  const areas = useMemo(() => (map?.areas ?? []).filter((a) => a.isActive !== false), [map]);
  const tables = map?.tables ?? [];
  const shown = useMemo(
    () => (kind === 'ALL' ? areas : areas.filter((a) => (a.kind === 'OUTDOOR' ? 'OUTDOOR' : 'HALL') === kind)),
    [areas, kind],
  );
  const area: MapArea | null = shown.find((a) => a.id === areaId) ?? shown[0] ?? null;
  const areaTables = useMemo(
    () => (area ? tables.filter((x) => x.hallId === area.id) : []),
    [tables, area],
  );

  const byHall = useMemo(() => tablesByHallOf(tables), [tables]);
  const holders = useMemo(() => tableHolders(occupancy, byHall), [occupancy, byHall]);
  const canTakeWhole = !!area && wholeAreaAvailable(area.id, occupancy, byHall);

  if (!map || areas.length === 0) return null;

  const stateOf = (table: MapTable): TableState => {
    if (wholeAreaId && wholeAreaId === table.hallId) return 'selected';
    if (table.id in floorSelections) return 'selected';
    return holders.has(table.id) ? 'taken' : 'free';
  };

  const captionOf = (table: MapTable) => {
    const seated = floorSelections[table.id];
    if (seated !== undefined) return `${seated}/${table.seats}`;
    const holder = holders.get(table.id);
    return holder ? t('fm_taken') : null;
  };

  const chosen = Object.entries(floorSelections);
  const selections = chosen.map(([floorTableId, g]) => ({ floorTableId, guestCount: g }));
  const totalGuests = seatedGuests(selections);
  // Null when the booking named no head count — a general-dining booking is
  // whatever the tables seat.
  const remaining = seatsRemaining(selections, guestCount);
  const full = remaining === 0;

  return (
    <section className="rg-card p-4 sm:p-6 reveal">
      <p className="rg-heading">{t('fm_kiosk_title')}</p>
      <p className="mt-1 mb-4 text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
        {full ? t('fm_seating_full') : t('fm_kiosk_hint')}
      </p>

      {/* Indoor / outdoor, then the areas of that kind. Two rows rather than
          one long list: a venue has a handful of rooms and one terrace, and
          "which sort of place" is the question a guest asks first. */}
      <div className="kf-filters">
        {(['ALL', 'HALL', 'OUTDOOR'] as const).map((k) => (
          <button key={k} type="button" aria-pressed={kind === k}
            className={`kf-chip${kind === k ? ' is-on' : ''}`}
            onClick={() => { setKind(k); setAreaId(null); }}>
            {t(k === 'ALL' ? 'fm_kind_all' : k === 'HALL' ? 'fm_kind_hall' : 'fm_kind_outdoor')}
          </button>
        ))}
      </div>

      <div className="kf-tabs" role="tablist" aria-label={t('fm_areas')}>
        {shown.map((a) => {
          const on = area?.id === a.id;
          const free = (byHall.get(a.id) ?? []).filter((id) => !holders.has(id)).length;
          return (
            <button key={a.id} type="button" role="tab" aria-selected={on}
              className={`kf-tab${on ? ' is-on' : ''}`} onClick={() => setAreaId(a.id)}>
              <span className="kf-tab-name">{a.name}</span>
              <span className="kf-tab-meta">{t('fm_free_count', { count: free })}</span>
            </button>
          );
        })}
      </div>

      {area && (
        <>
          <div className={`kf-map${large ? ' is-large' : ''}`}>
            <FloorPlanView
              area={area}
              tables={areaTables}
              stateOf={stateOf}
              captionOf={captionOf}
              onTableClick={(table) => {
                // Seats it full, or up to what is left of the head count —
                // never past it. Already-chosen tables always toggle off.
                if (table.id in floorSelections || remaining === null) {
                  toggleFloorTable(table.id, table.seats);
                } else if (remaining > 0) {
                  toggleFloorTable(table.id, Math.min(table.seats, remaining));
                }
              }}
              wholeAreaLabel={wholeAreaId === area.id ? t('fm_whole_area_taken') : null}
              ariaLabel={area.name}
            />
          </div>

          <div className="kf-actions">
            {/* Only once every table on this map is free — a venue cannot be
                let out from under a booking that already holds a table in it.
                The server checks it again on save. */}
            <button type="button" className="kf-whole" disabled={!canTakeWhole && wholeAreaId !== area.id}
              aria-pressed={wholeAreaId === area.id}
              onClick={() => setWholeArea(wholeAreaId === area.id ? undefined : area.id)}>
              {wholeAreaId === area.id ? t('fm_whole_area_cancel') : t('fm_whole_area')}
            </button>
            {!canTakeWhole && wholeAreaId !== area.id && (
              <span className="kf-note">{t('fm_whole_area_unavailable')}</span>
            )}
          </div>
        </>
      )}

      {/* What has been chosen, with the guests at each — the head count of the
          whole booking is their sum, so this is where it is decided. */}
      {chosen.length > 0 && (
        <div className="kf-chosen">
          <p className="rg-label">{t('fm_chosen_tables')}</p>
          {chosen.map(([id, guests]) => {
            const table = tables.find((x) => x.id === id);
            if (!table) return null;
            return (
              <div key={id} className="kf-row">
                <span className="kf-row-name">{t('fm_table', { label: table.label })}</span>
                <div className="kf-stepper">
                  <button type="button" aria-label="−" disabled={guests <= 1}
                    onClick={() => setFloorTableGuests(id, guests - 1)}>−</button>
                  <output aria-live="polite">{guests}</output>
                  <button type="button" aria-label="+"
                    disabled={guests >= table.seats || full}
                    onClick={() => setFloorTableGuests(id, guests + 1)}>+</button>
                </div>
                <button type="button" className="kf-drop" onClick={() => toggleFloorTable(id, table.seats)}>
                  {t('remove_dish')}
                </button>
              </div>
            );
          })}
          <p className="kf-total">
            {remaining === null
              ? t('fm_total_guests', { count: totalGuests })
              : t('fm_seated_of', { seated: totalGuests, of: guestCount })}
          </p>
          {full && <p className="kf-note">{t('fm_seating_full')}</p>}
        </div>
      )}

      <style>{`
        ${FLOOR_PLAN_CSS}
        /* The kiosk's palette, mapped onto the plan's own tokens. */
        .kf-map {
          --fp-accent: var(--rg-accent);
          --fp-accent-ink: var(--rg-bg);
          --fp-ground: rgba(var(--rg-bg-rgb), 0.55);
          --fp-ground-outdoor: rgba(var(--rg-accent-rgb), 0.06);
          --fp-grid: rgba(255,255,255,0.09);
          --fp-surface: rgba(var(--rg-bg-rgb), 0.92);
          --fp-table-line: rgba(var(--rg-accent-rgb), 0.75);
          --fp-chair: rgba(255,255,255,0.22);
          --fp-chair-line: rgba(255,255,255,0.4);
          --fp-text: #fff;
          --fp-text-muted: rgba(255,255,255,0.55);
          --fp-text-halo: rgba(var(--rg-bg-rgb), 0.75);
          --fp-taken: rgba(148,163,184,0.5);
          --fp-taken-line: rgba(148,163,184,0.8);
          --fp-taken-text: rgba(255,255,255,0.75);
          overflow: auto; max-height: 62vh; border-radius: 10px;
          background: rgba(var(--rg-bg-rgb), 0.45);
        }
        /* The dining session's map is the whole booking, so it gets the
           screen: nearly the full viewport height, and the plan scaled up
           inside it so a table is a comfortable target at arm's length. */
        .kf-map.is-large { max-height: 82vh; min-height: 56vh; }
        .kf-map.is-large .fp-svg { width: 150% !important; min-width: 150%; }
        @media (max-width: 900px) {
          .kf-map.is-large .fp-svg { width: 260% !important; min-width: 260%; }
        }
        .kf-filters { display: flex; gap: 8px; margin-bottom: 10px; flex-wrap: wrap; }
        .kf-chip {
          padding: 7px 14px; border-radius: 999px; font-size: 13px; font-weight: 600; cursor: pointer;
          background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.7);
          border: 1px solid rgba(255,255,255,0.14);
        }
        .kf-chip.is-on { background: rgba(var(--rg-accent-rgb),0.18); color: var(--rg-accent); border-color: rgba(var(--rg-accent-rgb),0.5); }
        .kf-tabs { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 8px; scrollbar-width: thin; }
        .kf-tab {
          flex: 0 0 auto; display: grid; gap: 2px; text-align: left; cursor: pointer; padding: 8px 14px;
          border-radius: 8px; background: transparent; color: rgba(255,255,255,0.7);
          border: 1px solid transparent;
        }
        .kf-tab.is-on { color: var(--rg-accent); background: rgba(var(--rg-accent-rgb),0.12); border-color: rgba(var(--rg-accent-rgb),0.45); }
        .kf-tab-name { font-size: 14px; font-weight: 700; }
        .kf-tab-meta { font-size: 11px; opacity: 0.75; }
        .kf-actions { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-top: 12px; }
        .kf-whole {
          padding: 10px 18px; border-radius: 10px; font-size: 14px; font-weight: 700; cursor: pointer;
          background: rgba(var(--rg-accent-rgb),0.14); color: var(--rg-accent);
          border: 1px solid rgba(var(--rg-accent-rgb),0.5);
        }
        .kf-whole[aria-pressed="true"] { background: var(--rg-accent); color: var(--rg-bg); }
        .kf-whole:disabled { opacity: 0.4; cursor: not-allowed; }
        .kf-note { font-size: 12px; color: rgba(255,255,255,0.5); }
        .kf-chosen { margin-top: 16px; display: grid; gap: 10px; }
        .kf-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
        .kf-row-name { font-weight: 700; color: #fff; min-width: 90px; }
        .kf-stepper { display: flex; align-items: center; gap: 8px; }
        .kf-stepper button {
          min-width: 34px; min-height: 34px; border-radius: 8px; cursor: pointer; font-size: 16px;
          background: rgba(255,255,255,0.07); color: #fff; border: 1px solid rgba(255,255,255,0.18);
        }
        .kf-stepper button:disabled { opacity: 0.35; cursor: not-allowed; }
        .kf-stepper output { min-width: 28px; text-align: center; font-weight: 800; color: #fff; }
        .kf-drop { font-size: 12px; color: rgba(255,255,255,0.5); text-decoration: underline; cursor: pointer; background: none; border: 0; }
        .kf-total { font-size: 14px; font-weight: 700; color: var(--rg-accent); margin: 2px 0 0; }
      `}</style>
    </section>
  );
};
