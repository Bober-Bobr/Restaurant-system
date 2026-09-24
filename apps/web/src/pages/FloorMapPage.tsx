import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { floorMapService } from '../services/floorMap.service';
import { hallService } from '../services/hall.service';
import { useAdminStore } from '../store/admin.store';
import {
  CHAIR_DEPTH, CHAIR_WIDTH, MAX_SEATS, MIN_SEATS, areaSize, chairsFor, clampSeats, clampTable, defaultAreaSize,
  featureLabelAt, featuresOf, fitTableSize, freeSpot, minAreaSize, nextRotation, nextTableLabel, overlappingTables,
  seatsIn, tableSize,
  type AreaKind, type FloorMap, type MapArea, type MapFeature, type MapTable, type TableShape,
} from '../utils/floorMap';
import { translate } from '../utils/translate';
import { dayKey, tableHolders, tablesByHallOf, wholeAreaAvailable, type MapBooking } from '../utils/floorBooking';
import { eventService } from '../services/event.service';
import { eventsPath } from '../utils/eventsPath';
import { useAuthStore } from '../store/auth.store';
import { useNavigate } from 'react-router-dom';

/**
 * The Small Banquets floor map — the section's main page.
 *
 * Each area — a hall, or an outdoor venue such as Sangizar's "Street" — has a
 * map of its OWN, and the tabs across the top switch between them. The chosen
 * area is in the URL (`?area=`), so a reload or a shared link opens the same
 * one. Under the tables sits the area's drawing (zones, the pool, the stage),
 * which is data on the area rather than code here.
 *
 * Two modes, because the map is a home page as well as an editor: a supervisor
 * opening it to look must not be able to shove a table across the room with a
 * stray swipe. Viewing selects; "Edit map" is what makes tables draggable and
 * resizable and the area's map resizable.
 *
 * The geometry — a table's size, where its chairs stand, what may overlap —
 * lives in utils/floorMap.ts and is tested there. This file is the pointer
 * handling and the drawing.
 */

const MAP_KEY = ['floor-map'] as const;
/** What is taken, per day — a booking holds its tables for the whole of one. */
const DAY_KEY = (day: string) => ['floor-map-day', day] as const;
const SCHEDULE_KEY = (from: string, to: string) => ['floor-map-schedule', from, to] as const;
const ZOOM_STEPS = [0.5, 0.75, 1, 1.5, 2, 3];
/** How far the pointer must travel, in map units, before a press becomes a drag. */
const DRAG_THRESHOLD = 4;

type Drag =
  | { type: 'move'; id: string; dx: number; dy: number; x: number; y: number; moved: boolean }
  | { type: 'resize-table'; id: string; width: number; height: number; moved: boolean }
  | { type: 'resize-area'; startX: number; startY: number; baseW: number; baseH: number; width: number; height: number; moved: boolean };

type TablePatch = Partial<Pick<MapTable, 'hallId' | 'label' | 'seats' | 'shape' | 'x' | 'y' | 'rotation' | 'width' | 'height'>>;

const errorText = (error: unknown) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message
  ?? (error as Error)?.message
  ?? 'Error';

/** How each kind of feature is painted; the colour itself comes from the plan. */
const FEATURE_PAINT: Record<MapFeature['kind'], { fill: number; stroke: number }> = {
  zone: { fill: 0.3, stroke: 0.75 },
  water: { fill: 0.55, stroke: 0.9 },
  stage: { fill: 0.45, stroke: 0.9 },
  path: { fill: 0.35, stroke: 0 },
  label: { fill: 0, stroke: 0 },
};

const clampNum = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const FloorMapPage = () => {
  const { locale } = useAdminStore();
  const t = (key: Parameters<typeof translate>[0], params?: Record<string, string | number>) => translate(key, locale, params);
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const { data, isLoading } = useQuery({ queryKey: MAP_KEY, queryFn: () => floorMapService.get() });
  const areas = useMemo(() => data?.areas ?? [], [data]);
  const tables = useMemo(() => data?.tables ?? [], [data]);

  // The area on screen: the one in the URL, else the first. A stale or foreign
  // id in a shared link falls back rather than showing an empty page.
  const current = areas.find((a) => a.id === searchParams.get('area')) ?? areas[0] ?? null;
  const areaTables = useMemo(() => (current ? tables.filter((x) => x.hallId === current.id) : []), [tables, current]);
  const features = useMemo(() => (current ? featuresOf(current) : []), [current]);
  const overlapping = useMemo(() => overlappingTables(areaTables), [areaTables]);

  const [editing, setEditing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  // A phone opens zoomed in: a whole venue fitted to 390px draws table numbers
  // a few pixels high. The map scrolls inside its own frame.
  const [zoom, setZoom] = useState(() => (typeof window !== 'undefined' && window.innerWidth < 700 ? 2 : 1));
  const [notice, setNotice] = useState<string | null>(null);
  /** A confirmation of something that WORKED — the red notice is for failures. */
  const [flash, setFlash] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [areaForm, setAreaForm] = useState<{ name: string; kind: AreaKind; capacity: string } | null>(null);
  const [scheduleShown, setScheduleShown] = useState(false);

  // ── The day being looked at ──────────────────────────────────────────────
  // The map is a picture of one DAY: which tables are taken depends entirely
  // on which day is being asked about, so the date sits beside the tabs rather
  // than inside a panel.
  const [day, setDay] = useState(() => dayKey(new Date()));

  // The schedule: a month either side of the chosen day, PAST AND FUTURE —
  // "who was at table 12 last Saturday" is exactly what it is opened for.
  // Only fetched while the panel is open, since it is a wider read.
  const schedFrom = useMemo(() => dayKey(new Date(Date.parse(`${day}T00:00:00Z`) - 30 * 86400_000)), [day]);
  const schedTo = useMemo(() => dayKey(new Date(Date.parse(`${day}T00:00:00Z`) + 30 * 86400_000)), [day]);

  // What is taken on the chosen day. Its own query, keyed on the day, so
  // moving the date re-reads occupancy without re-reading the whole map.
  const { data: occupancy } = useQuery({
    queryKey: DAY_KEY(day),
    queryFn: () => floorMapService.day(day),
  });
  const { data: schedule } = useQuery({
    queryKey: SCHEDULE_KEY(schedFrom, schedTo),
    queryFn: () => floorMapService.schedule(schedFrom, schedTo),
    enabled: scheduleShown,
  });
  const [openBooking, setOpenBooking] = useState<MapBooking | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [booking, setBooking] = useState<{ name: string; phone: string; time: string } | null>(null);
  const [busyBooking, setBusyBooking] = useState(false);
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.role);
  const svgRef = useRef<SVGSVGElement>(null);

  const stored = current ? areaSize(current, areaTables) : { width: 0, height: 0 };
  const size = drag?.type === 'resize-area' ? { width: drag.width, height: drag.height } : stored;
  /** Handles and type scale with the map, so a venue-sized plan stays grabbable and legible. */
  const unit = Math.max(1, size.width / 1200);

  const selectedTable = areaTables.find((x) => x.id === selectedId) ?? null;

  // ── Who holds what, on the chosen day ────────────────────────────────────
  const byHall = useMemo(() => tablesByHallOf(tables), [tables]);
  const holders = useMemo(() => tableHolders(occupancy, byHall), [occupancy, byHall]);
  const takenHere = areaTables.filter((x) => holders.has(x.id)).length;
  const wholeAreaBooking = useMemo(
    () => (current ? (occupancy?.bookings ?? []).find((b) => b.wholeHall && b.hallId === current.id) ?? null : null),
    [occupancy, current],
  );
  const canTakeWholeArea = !!current && wholeAreaAvailable(current.id, occupancy, byHall);
  /** The booking the admin is drafting, as table id → guests. */
  const [picked, setPicked] = useState<Record<string, number>>({});
  const pickedList = useMemo(
    () => Object.entries(picked).map(([floorTableId, guestCount]) => ({ floorTableId, guestCount })),
    [picked],
  );

  const switchArea = (id: string) => {
    setSelectedId(null);
    setDrag(null);
    // The flash names what happened to the area being left; it would read as a
    // statement about the new one.
    setFlash(null);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('area', id);
      return next;
    }, { replace: true });
  };

  // ── Writing ───────────────────────────────────────────────────────────────

  const patchCache = (fn: (map: FloorMap) => FloorMap) =>
    queryClient.setQueryData<FloorMap>(MAP_KEY, (map) => (map ? fn(map) : map));

  /**
   * Apply a change to the cached map at once, then send it. On failure the map
   * is reloaded from the server and the reason shown.
   *
   * On success NOTHING is written back — neither a refetch nor the server's copy
   * of the row. The server stores exactly the fields it was sent, so the
   * optimistic row already is the saved one; writing each reply back would
   * redraw 11 chairs between two quick presses of "+" that end at 12, and a
   * reply arriving out of order would leave the older value on screen.
   */
  const commit = async <T,>(optimistic: ((map: FloorMap) => FloorMap) | null, send: () => Promise<T>) => {
    if (optimistic) patchCache(optimistic);
    try {
      const row = await send();
      setNotice(null);
      return row;
    } catch (error) {
      setNotice(t('fm_save_failed', { message: errorText(error) }));
      await queryClient.invalidateQueries({ queryKey: MAP_KEY });
      return null;
    }
  };

  const updateTable = (table: MapTable, patch: TablePatch) => {
    const next: MapTable = { ...table, ...patch };
    // A resized table asked for more seats than it can take grows to take them.
    if (next.width != null && next.height != null) Object.assign(next, fitTableSize(next.shape, next.seats, next.width, next.height));
    // A new size, seat count, shape or angle changes the footprint, so the
    // table is pulled back onto its map if it now pokes off the edge.
    const target = areas.find((a) => a.id === next.hallId);
    if (target) {
      const room = areaSize(target, tables.filter((x) => x.hallId === target.id && x.id !== table.id));
      Object.assign(next, clampTable(next, next, room));
    }
    const body = {
      hallId: next.hallId, label: next.label, seats: next.seats, shape: next.shape as TableShape,
      x: next.x, y: next.y, rotation: next.rotation, width: next.width ?? null, height: next.height ?? null,
    };
    // Only what changed, so a rename that collides does not also resend a move.
    const changed = Object.fromEntries(Object.entries(body).filter(([k, v]) => (table[k as keyof MapTable] ?? null) !== v));
    if (Object.keys(changed).length === 0) return;
    void commit(
      (m) => ({ ...m, tables: m.tables.map((x) => (x.id === table.id ? next : x)) }),
      () => floorMapService.updateTable(table.id, changed),
    );
  };

  const updateArea = (area: MapArea, patch: Partial<{ name: string; kind: AreaKind; mapWidth: number; mapHeight: number }>) => {
    void commit(
      (m) => ({ ...m, areas: m.areas.map((x) => (x.id === area.id ? { ...x, ...patch } : x)) }),
      () => floorMapService.updateArea(area.id, patch),
    );
  };

  const addTable = async () => {
    if (!current) return;
    const draft = { shape: 'RECT' as const, seats: 4, rotation: 0 };
    let spot = freeSpot(draft, stored, areaTables, features);
    if (!spot) {
      // Full: put it in the middle and say so, rather than refusing — the
      // supervisor can move it or enlarge the map, and a button that does
      // nothing explains nothing.
      spot = clampTable({ x: stored.width / 2, y: stored.height / 2 }, draft, stored);
      setNotice(t('fm_area_full'));
    }
    const row = await commit(null, () => floorMapService.createTable({
      hallId: current.id, label: nextTableLabel(areaTables.map((x) => x.label)), ...draft, ...spot!,
    }));
    if (row) {
      patchCache((m) => ({ ...m, tables: [...m.tables, row] }));
      setSelectedId(row.id);
    }
  };

  const deleteTable = (table: MapTable) => {
    if (!window.confirm(t('fm_delete_table_confirm', { label: table.label }))) return;
    setSelectedId(null);
    void commit((m) => ({ ...m, tables: m.tables.filter((x) => x.id !== table.id) }), () => floorMapService.removeTable(table.id));
  };

  const deleteArea = (area: MapArea) => {
    const count = tables.filter((x) => x.hallId === area.id).length;
    if (!window.confirm(t('fm_delete_area_confirm', { name: area.name, count }))) return;
    setSelectedId(null);
    // Through the halls endpoint: an area IS a hall, and that is the one place
    // that decides what removing a hall does. Its tables go with it (cascade).
    void commit(
      (m) => ({ areas: m.areas.filter((x) => x.id !== area.id), tables: m.tables.filter((x) => x.hallId !== area.id) }),
      async () => {
        await hallService.remove(area.id);
        await queryClient.invalidateQueries({ queryKey: ['halls'] });
      },
    );
  };

  /**
   * Remember the area as it stands now. There is ONE default per area, so
   * saving over an existing one asks first — the old layout is not kept, and
   * the press that replaces it is the same press that saves the first one.
   */
  const saveDefaultLayout = async (area: MapArea) => {
    if (area.defaultLayoutAt && !window.confirm(t('fm_default_replace_confirm', { name: area.name }))) return;
    setFlash(null);
    setBusy(true);
    const row = await commit(null, () => floorMapService.saveDefaultLayout(area.id));
    setBusy(false);
    if (row) {
      patchCache((m) => ({ ...m, areas: m.areas.map((x) => (x.id === row.id ? { ...x, ...row } : x)) }));
      setFlash(t('fm_default_saved_ok'));
    }
  };

  /**
   * Put the area back to its saved layout. This DELETES the tables standing in
   * it and writes the saved ones again, so it asks first and says how many
   * tables are there now. The reply carries the whole area, and it is written
   * into the cache rather than merged: every table is a new row.
   */
  const restoreDefaultLayout = async (area: MapArea) => {
    const count = tables.filter((x) => x.hallId === area.id).length;
    if (!window.confirm(t('fm_restore_default_confirm', { name: area.name, count }))) return;
    setFlash(null);
    setSelectedId(null);
    setBusy(true);
    const result = await commit(null, () => floorMapService.restoreDefaultLayout(area.id));
    setBusy(false);
    if (result) {
      patchCache((m) => ({
        areas: m.areas.map((x) => (x.id === result.area.id ? { ...x, ...result.area } : x)),
        tables: [...m.tables.filter((x) => x.hallId !== result.area.id), ...result.tables],
      }));
      setFlash(t('fm_default_restored', { count: result.tables.length }));
    }
  };

  /** The printable plan of this area for the chosen day. */
  const printArea = async (area: MapArea) => {
    setFlash(null);
    setBusy(true);
    try {
      const blob = await floorMapService.printArea(area.id, day);
      // Handed to the browser as a download rather than opened: this is a
      // sheet for the pass, and a print dialog is the admin's own choice.
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${area.name.replace(/[^\w.-]+/g, '-')}-${day}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Revoked on the next tick: revoking immediately cancels the download
      // in some browsers.
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (error) {
      setNotice(t('fm_print_failed', { message: errorText(error) }));
    } finally {
      setBusy(false);
    }
  };

  /**
   * Create a booking from the map — the admin's own path, beside the kiosk's.
   * The tables are what was picked on the plan; the server re-checks them
   * against the day and derives the head count from them.
   */
  const saveBooking = async () => {
    if (!booking || !current) return;
    const wholeArea = pickedList.length === 0;
    setBusyBooking(true);
    setFlash(null);
    try {
      const created = await eventService.create({
        customerName: booking.name.trim(),
        customerPhone: booking.phone.trim() || undefined,
        eventDate: new Date(`${day}T${booking.time || '19:00'}`).toISOString(),
        guestCount: pickedList.reduce((sum, s) => sum + s.guestCount, 0),
        status: 'CONFIRMED',
        hallId: current.id,
        floorTables: pickedList,
        wholeHall: wholeArea,
      } as Parameters<typeof eventService.create>[0]);
      setBooking(null);
      setPicked({});
      await queryClient.invalidateQueries({ queryKey: DAY_KEY(day) });
      setFlash(t('fm_booking_saved', { number: String(created.id) }));
    } catch (error) {
      setNotice(t('fm_booking_failed', { message: errorText(error) }));
    } finally {
      setBusyBooking(false);
    }
  };

  const createArea = async () => {
    if (!areaForm) return;
    const capacity = Number(areaForm.capacity.replace(/\s/g, ''));
    if (!areaForm.name.trim() || !Number.isInteger(capacity) || capacity <= 0) return;
    const start = defaultAreaSize(areaForm.kind);
    const row = await commit(null, () => floorMapService.createArea({
      name: areaForm.name.trim(), kind: areaForm.kind, capacity, mapWidth: start.width, mapHeight: start.height,
    }));
    if (row) {
      patchCache((m) => ({ ...m, areas: [...m.areas, row] }));
      void queryClient.invalidateQueries({ queryKey: ['halls'] });
      setAreaForm(null);
      // A new area is where the next thing happens, so it opens at once.
      switchArea(row.id);
    }
  };

  // ── Pointer handling ──────────────────────────────────────────────────────

  /** A pointer position in map units, whatever the zoom and scroll. */
  const toMap = (event: { clientX: number; clientY: number }) => {
    const ctm = svgRef.current?.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  };

  const beginDrag = (event: ReactPointerEvent<Element>, next: Drag) => {
    event.stopPropagation();
    if (!editing) return;
    (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
    setDrag(next);
  };

  const onTablePointerDown = (event: ReactPointerEvent<SVGGElement>, table: MapTable) => {
    setSelectedId(table.id);
    // Not editing the map: a press is about the BOOKING on that table —
    // picking it for the one being drafted, or opening the one that holds it.
    if (!editing) {
      const holder = holders.get(table.id);
      if (booking) {
        if (!holder) {
          setPicked((prev) => {
            const next = { ...prev };
            if (table.id in next) delete next[table.id];
            else next[table.id] = table.seats;
            return next;
          });
        }
      } else {
        setOpenBooking(holder ?? null);
      }
    }
    const p = toMap(event);
    beginDrag(event, { type: 'move', id: table.id, dx: p.x - table.x, dy: p.y - table.y, x: table.x, y: table.y, moved: false });
  };

  const onTableHandlePointerDown = (event: ReactPointerEvent<SVGElement>, table: MapTable) => {
    const current = tableSize(table.shape, table.seats, table);
    beginDrag(event, { type: 'resize-table', id: table.id, ...current, moved: false });
  };

  const onAreaHandlePointerDown = (event: ReactPointerEvent<SVGRectElement>) => {
    const p = toMap(event);
    beginDrag(event, { type: 'resize-area', startX: p.x, startY: p.y, baseW: stored.width, baseH: stored.height, ...stored, moved: false });
  };

  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!drag) return;
    const p = toMap(event);
    if (drag.type === 'move') {
      const x = p.x - drag.dx;
      const y = p.y - drag.dy;
      setDrag({ ...drag, x, y, moved: drag.moved || Math.hypot(x - drag.x, y - drag.y) > DRAG_THRESHOLD });
    } else if (drag.type === 'resize-table') {
      const table = areaTables.find((x) => x.id === drag.id);
      if (!table) return;
      // Measured in the table's own axes, so a table turned 45° still widens
      // along its length. The resize is symmetric about the centre: the
      // handle's distance from it is half the new size.
      const rad = (-table.rotation * Math.PI) / 180;
      const dx = p.x - table.x;
      const dy = p.y - table.y;
      const lx = Math.abs(dx * Math.cos(rad) - dy * Math.sin(rad));
      const ly = Math.abs(dx * Math.sin(rad) + dy * Math.cos(rad));
      const wanted = table.shape === 'ROUND' ? { w: 2 * Math.max(lx, ly), h: 2 * Math.max(lx, ly) } : { w: 2 * lx, h: 2 * ly };
      const fitted = fitTableSize(table.shape, table.seats, wanted.w, wanted.h);
      setDrag({ ...drag, ...fitted, moved: true });
    } else {
      const min = minAreaSize(areaTables);
      const width = Math.max(min.width, Math.round(drag.baseW + p.x - drag.startX));
      const height = Math.max(min.height, Math.round(drag.baseH + p.y - drag.startY));
      setDrag({ ...drag, width, height, moved: true });
    }
  };

  const onPointerUp = () => {
    const done = drag;
    setDrag(null);
    if (!done || !done.moved || !current) return;
    if (done.type === 'resize-area') {
      updateArea(current, { mapWidth: done.width, mapHeight: done.height });
      return;
    }
    const table = areaTables.find((x) => x.id === done.id);
    if (!table) return;
    if (done.type === 'move') updateTable(table, { x: Math.round(done.x), y: Math.round(done.y) });
    else updateTable(table, { width: done.width, height: done.height });
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ── Drawing ───────────────────────────────────────────────────────────────

  const renderFeature = (f: MapFeature, i: number) => {
    const paint = FEATURE_PAINT[f.kind] ?? FEATURE_PAINT.zone;
    const color = f.color ?? 'var(--adm-accent)';
    const style = { fill: color, fillOpacity: paint.fill, stroke: paint.stroke ? color : 'none', strokeOpacity: paint.stroke, strokeWidth: 3 * unit };
    let body = null;
    if (f.shape === 'rect') body = <rect x={f.x} y={f.y} width={f.width} height={f.height} rx={6 * unit} style={style} />;
    else if (f.shape === 'ellipse') body = <ellipse cx={f.x + f.width / 2} cy={f.y + f.height / 2} rx={f.width / 2} ry={f.height / 2} style={style} />;
    else if (f.shape === 'polygon') body = <polygon points={f.points.map((p) => p.join(',')).join(' ')} style={style} />;
    const [lx, ly] = featureLabelAt(f);
    return (
      <g key={i} className={`fm-feature is-${f.kind}`}>
        {body}
        {f.label && (
          <text className="fm-feature-label" x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 26 * unit }}>
            {f.label}
          </text>
        )}
      </g>
    );
  };

  const renderTable = (table: MapTable) => {
    const moving = drag?.type === 'move' && drag.id === table.id ? drag : null;
    const resizing = drag?.type === 'resize-table' && drag.id === table.id ? drag : null;
    const cx = moving ? moving.x : table.x;
    const cy = moving ? moving.y : table.y;
    const sized = resizing ? { width: resizing.width, height: resizing.height } : table;
    const { width, height } = tableSize(table.shape, table.seats, sized);
    const selected = selectedId === table.id;
    const labelSize = clampNum(Math.min(width, height) * 0.36, 14, 30);
    return (
      <g
        key={table.id}
        className={[
          'fm-table-group',
          selected ? 'is-selected' : '',
          overlapping.has(table.id) ? 'is-overlapping' : '',
          editing ? 'is-editable' : '',
          moving ? 'is-dragging' : '',
          // The day's bookings. Not while editing: there the map is furniture
          // being arranged, and colouring it by an evening's bookings would
          // say a table cannot be moved when it can.
          !editing && holders.has(table.id) ? 'is-taken' : '',
          !editing && table.id in picked ? 'is-picked' : '',
        ].filter(Boolean).join(' ')}
        onPointerDown={(e) => onTablePointerDown(e, table)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedId(table.id); } }}
        role="button"
        tabIndex={0}
        aria-label={`${t('fm_table', { label: table.label })}, ${t('fm_seats')}: ${table.seats}`}
      >
        <g transform={`translate(${cx} ${cy}) rotate(${table.rotation})`}>
          {chairsFor(table.shape, table.seats, sized).map((chair, i) => (
            <rect
              key={i}
              className="fm-chair"
              x={-CHAIR_WIDTH / 2}
              y={-CHAIR_DEPTH / 2}
              width={CHAIR_WIDTH}
              height={CHAIR_DEPTH}
              rx={5}
              transform={`translate(${chair.x} ${chair.y}) rotate(${chair.angle})`}
            />
          ))}
          {table.shape === 'ROUND'
            ? <circle className="fm-top" r={width / 2} />
            : <rect className="fm-top" x={-width / 2} y={-height / 2} width={width} height={height} rx={Math.min(8, width / 6)} />}
          {editing && selected && (
            // The resize handle, on the table's own corner so it turns with it.
            <g className="fm-table-handle" onPointerDown={(e) => onTableHandlePointerDown(e, table)}>
              <circle cx={width / 2} cy={height / 2} r={18 * unit} className="fm-hit" />
              <rect x={width / 2 - 8 * unit} y={height / 2 - 8 * unit} width={16 * unit} height={16 * unit} rx={3 * unit} />
            </g>
          )}
        </g>
        {/* The number is drawn upright whatever the table's rotation — a label
            turned 45° is a label nobody reads across a room. */}
        <text className="fm-table-label" x={cx} y={cy - labelSize * 0.12} textAnchor="middle" dominantBaseline="middle" style={{ fontSize: labelSize }}>
          {table.label}
        </text>
        <text className="fm-table-seats" x={cx} y={cy + labelSize * 0.72} textAnchor="middle" dominantBaseline="middle" style={{ fontSize: labelSize * 0.5 }}>
          {/* Who has it, when somebody does — the number a waiter reads off
              the map is the party's, not the table's capacity. */}
          {!editing && picked[table.id] !== undefined ? `${picked[table.id]}/${table.seats}`
            : !editing && holders.get(table.id) ? holders.get(table.id)!.customerName
            : table.seats}
        </text>
      </g>
    );
  };

  // ── Panel ─────────────────────────────────────────────────────────────────

  const kindLabel = (kind: string) => (kind === 'OUTDOOR' ? t('fm_kind_outdoor') : t('fm_kind_hall'));

  const tablePanel = (table: MapTable) => {
    const clash = overlapping.has(table.id) && <p className="fm-notice" style={{ margin: '0 0 12px' }}>{t('fm_overlap')}</p>;
    const dims = tableSize(table.shape, table.seats, table);
    const resized = table.width != null && table.height != null;
    const sizeText = `${Math.round(dims.width)} × ${Math.round(dims.height)}`;
    if (!editing) {
      return (
        <>
          {clash}
          <dl className="fm-facts">
            <dt>{t('fm_table_number')}</dt><dd>{table.label}</dd>
            <dt>{t('fm_seats')}</dt><dd>{table.seats}</dd>
            <dt>{t('fm_shape')}</dt><dd>{table.shape === 'ROUND' ? t('fm_shape_round') : t('fm_shape_rect')}</dd>
            <dt>{t('fm_size')}</dt><dd>{sizeText}</dd>
            <dt>{t('fm_area')}</dt><dd>{current?.name ?? '—'}</dd>
          </dl>
        </>
      );
    }
    return (
      <div className="fm-form">
        <label>
          <span>{t('fm_table_number')}</span>
          {/* Keyed on the table so switching selection resets the draft. */}
          <LabelField key={table.id} value={table.label} onCommit={(label) => updateTable(table, { label })} />
        </label>
        <div>
          <span className="fm-caption">{t('fm_seats')}</span>
          <div className="fm-stepper">
            <button type="button" className="adm-btn-ghost" disabled={table.seats <= MIN_SEATS}
              onClick={() => updateTable(table, { seats: clampSeats(table.seats - 1) })} aria-label="−">−</button>
            <output aria-live="polite">{table.seats}</output>
            <button type="button" className="adm-btn-ghost" disabled={table.seats >= MAX_SEATS}
              onClick={() => updateTable(table, { seats: clampSeats(table.seats + 1) })} aria-label="+">+</button>
          </div>
        </div>
        <div>
          <span className="fm-caption">{t('fm_shape')}</span>
          <div className="fm-segmented">
            {(['RECT', 'ROUND'] as const).map((shape) => (
              <button key={shape} type="button" aria-pressed={table.shape === shape}
                className={table.shape === shape ? 'is-on' : ''}
                // A new shape starts from its automatic size: a long table's
                // proportions mean nothing to a circle.
                onClick={() => table.shape !== shape && updateTable(table, { shape, width: null, height: null })}>
                {shape === 'ROUND' ? t('fm_shape_round') : t('fm_shape_rect')}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="fm-caption">{t('fm_size')}</span>
          <div className="fm-size-row">
            <output>{sizeText}</output>
            <button type="button" className="adm-btn-ghost" disabled={!resized}
              onClick={() => updateTable(table, { width: null, height: null })}>
              {t('fm_auto_size')}
            </button>
          </div>
          <p className="fm-caption" style={{ margin: '6px 0 0' }}>{t('fm_size_hint')}</p>
        </div>
        <button type="button" className="adm-btn-ghost" disabled={table.shape === 'ROUND'}
          onClick={() => updateTable(table, { rotation: nextRotation(table.rotation) })}>
          {t('fm_rotate')}
        </button>
        {/* Below the controls, not above them: a press of "+" can be what
            causes the overlap, and a notice appearing above the stepper would
            push it out from under the next press. */}
        {clash}
        <label>
          <span>{t('fm_area')}</span>
          <select className="adm-input" value={table.hallId}
            onChange={(e) => {
              const target = areas.find((a) => a.id === e.target.value);
              if (!target) return;
              const others = tables.filter((x) => x.hallId === target.id);
              const room = areaSize(target, others);
              const spot = freeSpot(table, room, others, featuresOf(target))
                ?? clampTable({ x: room.width / 2, y: room.height / 2 }, table, room);
              setSelectedId(null);
              updateTable(table, { hallId: target.id, ...spot });
            }}>
            {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </label>
        <button type="button" className="adm-btn-danger" onClick={() => deleteTable(table)}>{t('fm_delete_table')}</button>
      </div>
    );
  };

  const savedAtText = (area: MapArea) =>
    (area.defaultLayoutAt
      ? new Date(area.defaultLayoutAt).toLocaleString(
        locale === 'ru' ? 'ru-RU' : locale === 'uz' ? 'uz-UZ' : 'en-US',
        { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' },
      )
      : null);

  const areaPanel = (area: MapArea) => {
    const stats = t('fm_area_stats', { tables: areaTables.length, seats: seatsIn(areaTables) });
    const savedAt = savedAtText(area);
    if (!editing) {
      return (
        <dl className="fm-facts">
          <dt>{t('fm_kind')}</dt><dd>{kindLabel(area.kind)}</dd>
          <dt>{t('capacity')}</dt><dd>{area.capacity}</dd>
          <dt>{t('fm_seats')}</dt><dd>{stats}</dd>
          <dt>{t('fm_default')}</dt><dd>{savedAt ?? t('fm_default_none')}</dd>
        </dl>
      );
    }
    return (
      <div className="fm-form">
        <label>
          <span>{t('name')}</span>
          <LabelField key={area.id} value={area.name} maxLength={100} onCommit={(name) => updateArea(area, { name })} />
        </label>
        <div>
          <span className="fm-caption">{t('fm_kind')}</span>
          <div className="fm-segmented">
            {(['HALL', 'OUTDOOR'] as const).map((kind) => (
              <button key={kind} type="button" aria-pressed={area.kind === kind}
                className={area.kind === kind ? 'is-on' : ''}
                onClick={() => area.kind !== kind && updateArea(area, { kind })}>
                {kindLabel(kind)}
              </button>
            ))}
          </div>
        </div>
        <p className="fm-caption" style={{ margin: 0 }}>{stats}</p>
        <p className="fm-caption" style={{ margin: 0 }}>{t('fm_map_size')}: {stored.width} × {stored.height}</p>
        <button type="button" className="adm-btn-primary" onClick={() => void addTable()}>{t('fm_add_table_here')}</button>

        {/* The area's default layout: how this room is meant to stand, and the
            way back to it after an evening has moved everything about. */}
        <div className="fm-default">
          <span className="fm-caption">{t('fm_default')}</span>
          <p className="fm-caption" style={{ margin: '4px 0 10px' }}>
            {savedAt ? t('fm_default_saved_at', { at: savedAt }) : t('fm_default_none_hint')}
          </p>
          <button type="button" className="adm-btn-ghost" disabled={busy} onClick={() => void saveDefaultLayout(area)}>
            {savedAt ? t('fm_default_replace') : t('fm_save_default')}
          </button>
          <button type="button" className="adm-btn-ghost" disabled={busy || !savedAt}
            onClick={() => void restoreDefaultLayout(area)}>
            {t('fm_restore_default')}
          </button>
          {flash && <p className="fm-flash" role="status">{flash}</p>}
        </div>

        <button type="button" className="adm-btn-danger" onClick={() => deleteArea(area)}>{t('fm_delete_area')}</button>
      </div>
    );
  };

  /** A booking the admin clicked on the map. */
  const bookingCard = (b: MapBooking) => (
    <div className="fm-booking-card">
      <dl className="fm-facts">
        <dt>{t('fm_booking')}</dt><dd>#{b.eventNumber}</dd>
        <dt>{t('fm_booked_by')}</dt><dd>{b.customerName}</dd>
        {b.customerPhone && (<><dt>{t('customer_phone')}</dt><dd>{b.customerPhone}</dd></>)}
        <dt>{t('event_time')}</dt><dd>{new Date(b.eventDate).toISOString().slice(11, 16)}</dd>
        <dt>{t('guest_count')}</dt><dd>{b.guestCount}</dd>
        <dt>{t('status')}</dt><dd>{b.status}</dd>
        <dt>{t('fm_chosen_tables')}</dt>
        <dd>
          {b.wholeHall ? t('fm_whole_area_taken')
            : b.floorTables
              .map((x) => tables.find((y) => y.id === x.floorTableId)?.label)
              .filter(Boolean).join(', ')}
        </dd>
        {b.notes && (<><dt>{t('notes')}</dt><dd>{b.notes}</dd></>)}
      </dl>
      <button type="button" className="adm-btn-ghost"
        onClick={() => navigate(`${eventsPath(role)}?event=${b.eventNumber}`)}>
        {t('fm_open_event')}
      </button>
      <button type="button" className="adm-btn-ghost" onClick={() => setOpenBooking(null)}>{t('done')}</button>
    </div>
  );

  /** The booking being drafted from the map. */
  const bookingForm = () => {
    const guests = pickedList.reduce((sum, s) => sum + s.guestCount, 0);
    const wholeArea = pickedList.length === 0;
    return (
      <div className="fm-form">
        <p className="fm-caption" style={{ margin: 0 }}>
          {wholeArea
            ? (canTakeWholeArea ? t('fm_whole_area') : t('fm_whole_area_unavailable'))
            : t('fm_total_guests', { count: guests })}
        </p>
        <label>
          <span>{t('customer_name')}</span>
          <input className="adm-input" value={booking!.name} autoFocus
            onChange={(e) => setBooking({ ...booking!, name: e.target.value })} />
        </label>
        <label>
          <span>{t('customer_phone')}</span>
          <input className="adm-input" type="tel" value={booking!.phone}
            onChange={(e) => setBooking({ ...booking!, phone: e.target.value })} />
        </label>
        <label>
          <span>{t('event_time')}</span>
          <input className="adm-input" type="time" value={booking!.time}
            onChange={(e) => setBooking({ ...booking!, time: e.target.value })} />
        </label>
        {pickedList.map((s) => {
          const table = tables.find((x) => x.id === s.floorTableId);
          if (!table) return null;
          return (
            <div key={s.floorTableId} className="fm-size-row">
              <span>{t('fm_table', { label: table.label })}</span>
              <div className="fm-stepper">
                <button type="button" className="adm-btn-ghost" disabled={s.guestCount <= 1}
                  onClick={() => setPicked((p) => ({ ...p, [s.floorTableId]: s.guestCount - 1 }))}>−</button>
                <output>{s.guestCount}</output>
                <button type="button" className="adm-btn-ghost" disabled={s.guestCount >= table.seats}
                  onClick={() => setPicked((p) => ({ ...p, [s.floorTableId]: s.guestCount + 1 }))}>+</button>
              </div>
            </div>
          );
        })}
        <button type="button" className="adm-btn-primary"
          disabled={busyBooking || !booking!.name.trim() || (wholeArea && !canTakeWholeArea)}
          onClick={() => void saveBooking()}>
          {t('fm_create')}
        </button>
        <button type="button" className="adm-btn-ghost" onClick={() => { setBooking(null); setPicked({}); }}>
          {t('cancel')}
        </button>
      </div>
    );
  };

  // ── Page ──────────────────────────────────────────────────────────────────

  return (
    <main className="fm-page" style={{ maxWidth: 1600, margin: '0 auto', padding: '28px 20px', position: 'relative', zIndex: 1 }}>
      <div className="fm-head">
        <div>
          <h1 className="adm-title" style={{ margin: 0 }}>{t('fm_title')}</h1>
          <p className="fm-caption" style={{ margin: '6px 0 0' }}>{t('fm_subtitle')}</p>
        </div>
        <div className="fm-toolbar">
          {editing && (
            <button type="button" className="adm-btn-ghost" disabled={!current} onClick={() => void addTable()}>
              {t('fm_add_table')}
            </button>
          )}
          <button type="button" className="adm-btn-primary" onClick={() => { setEditing((v) => !v); setDrag(null); }}>
            {editing ? t('fm_done') : t('fm_edit')}
          </button>
        </div>
      </div>

      {/* One tab per area. Each area is its own map; this is how you move between them. */}
      <div className="fm-tabs" role="tablist" aria-label={t('fm_areas')}>
        {areas.map((a) => {
          const n = tables.filter((x) => x.hallId === a.id).length;
          const on = current?.id === a.id;
          return (
            <button key={a.id} type="button" role="tab" aria-selected={on}
              className={`fm-tab${on ? ' is-on' : ''}${a.kind === 'OUTDOOR' ? ' is-outdoor' : ''}`}
              onClick={() => switchArea(a.id)}>
              <span className="fm-tab-name">{a.name}</span>
              <span className="fm-tab-meta">{kindLabel(a.kind)} · {n}</span>
            </button>
          );
        })}
        {editing && (
          <button type="button" className="fm-tab fm-tab-add" onClick={() => setAreaForm({ name: '', kind: 'OUTDOOR', capacity: '' })}>
            + {t('fm_add_area')}
          </button>
        )}
      </div>

      {/* The day the map is a picture OF. Which tables are taken depends
          entirely on it, so it sits with the tabs rather than in a panel. */}
      {!editing && (
        <div className="fm-daybar">
          <label className="fm-caption" htmlFor="fm-day">{t('fm_day')}</label>
          <input id="fm-day" type="date" className="adm-input" value={day}
            onChange={(e) => { setDay(e.target.value || dayKey(new Date())); setOpenBooking(null); }} />
          <button type="button" className="adm-btn-ghost" onClick={() => setDay(dayKey(new Date()))}>
            {t('fm_today')}
          </button>
          <button type="button" className="adm-btn-ghost" aria-pressed={scheduleOpen}
            onClick={() => { setScheduleOpen((v) => !v); setScheduleShown(true); }}>
            {t('fm_schedule')}
          </button>
          <button type="button" className="adm-btn-ghost" disabled={!current || busy}
            onClick={() => current && void printArea(current)}>
            {t('fm_print_map')}
          </button>
          <button type="button" className="adm-btn-primary" disabled={!current}
            onClick={() => { setBooking(booking ? null : { name: '', phone: '', time: '19:00' }); setPicked({}); setOpenBooking(null); }}>
            {booking ? t('cancel') : t('fm_new_booking')}
          </button>
          <span className="fm-legend">
            <span><i className="fm-swatch" style={{ background: 'rgb(var(--adm-surface-rgb))' }} />{t('fm_free')}</span>
            <span><i className="fm-swatch" style={{ background: 'rgba(148,163,184,0.55)' }} />{t('fm_taken')}</span>
            <span>{t('fm_occupancy_summary', { taken: takenHere, total: areaTables.length })}</span>
          </span>
        </div>
      )}

      <p className="fm-caption" style={{ margin: '12px 0' }}>
        {editing ? t('fm_hint_edit') : booking ? t('fm_new_booking_hint') : t('fm_hint_view')}
      </p>
      {flash && <p className="fm-flash" role="status" style={{ margin: '0 0 10px' }}>{flash}</p>}
      {notice && <p className="fm-notice" role="alert">{notice}</p>}

      {areaForm && (
        <form className="adm-card fm-area-form" onSubmit={(e) => { e.preventDefault(); void createArea(); }}>
          <label>
            <span>{t('name')}</span>
            <input className="adm-input" value={areaForm.name} maxLength={100} autoFocus
              onChange={(e) => setAreaForm({ ...areaForm, name: e.target.value })} />
          </label>
          <label>
            <span>{t('fm_kind')}</span>
            <select className="adm-input" value={areaForm.kind}
              onChange={(e) => setAreaForm({ ...areaForm, kind: e.target.value as AreaKind })}>
              <option value="HALL">{t('fm_kind_hall')}</option>
              <option value="OUTDOOR">{t('fm_kind_outdoor')}</option>
            </select>
          </label>
          <label>
            <span>{t('capacity')}</span>
            <input className="adm-input" inputMode="numeric" value={areaForm.capacity}
              onChange={(e) => setAreaForm({ ...areaForm, capacity: e.target.value.replace(/[^\d\s]/g, '') })} />
          </label>
          <div className="fm-area-form-actions">
            <button type="button" className="adm-btn-ghost" onClick={() => setAreaForm(null)}>{t('cancel')}</button>
            <button type="submit" className="adm-btn-primary"
              disabled={!areaForm.name.trim() || !(Number(areaForm.capacity.replace(/\s/g, '')) > 0)}>
              {t('fm_create')}
            </button>
          </div>
        </form>
      )}

      {scheduleOpen && (
        <section className="adm-card fm-sched-card">
          <p className="adm-heading" style={{ marginTop: 0 }}>{t('fm_schedule')}</p>
          <p className="fm-caption" style={{ margin: '0 0 10px' }}>{schedFrom} — {schedTo}</p>
          <div className="fm-sched">
            {(schedule?.bookings ?? []).length === 0 && (
              <p className="fm-caption" style={{ margin: 0 }}>{t('fm_schedule_empty')}</p>
            )}
            {(schedule?.bookings ?? []).map((b) => {
              const when = new Date(b.eventDate);
              const bookingDay = dayKey(when);
              const area = areas.find((a) => a.id === b.hallId);
              return (
                <button key={b.id} type="button"
                  className={`fm-sched-row${bookingDay < dayKey(new Date()) ? ' is-past' : ''}`}
                  onClick={() => {
                    // Jumping to a booking moves the map to its day and its
                    // area, which is what "show me this one" means.
                    setDay(bookingDay);
                    if (b.hallId) switchArea(b.hallId);
                    setOpenBooking(b);
                    setScheduleOpen(false);
                  }}>
                  <span className="fm-sched-when">{bookingDay} · {when.toISOString().slice(11, 16)}</span>
                  <span className="fm-sched-who">#{b.eventNumber} {b.customerName}</span>
                  <span className="fm-sched-what">
                    {area?.name ?? '—'} · {b.wholeHall ? t('fm_whole_area_taken')
                      : b.floorTables.map((x) => tables.find((y) => y.id === x.floorTableId)?.label).filter(Boolean).join(', ')}
                    {' · '}{b.guestCount}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <div className="fm-layout">
        <section className="adm-card fm-canvas-card">
          <div className="fm-zoom">
            <button type="button" className="adm-btn-ghost" aria-label={t('fm_zoom_out')} title={t('fm_zoom_out')}
              disabled={zoom <= ZOOM_STEPS[0]}
              onClick={() => setZoom(ZOOM_STEPS[Math.max(0, ZOOM_STEPS.indexOf(zoom) - 1)])}>−</button>
            <button type="button" className="adm-btn-ghost" onClick={() => setZoom(1)}>{t('fm_zoom_fit')}</button>
            <button type="button" className="adm-btn-ghost" aria-label={t('fm_zoom_in')} title={t('fm_zoom_in')}
              disabled={zoom >= ZOOM_STEPS[ZOOM_STEPS.length - 1]}
              onClick={() => setZoom(ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, ZOOM_STEPS.indexOf(zoom) + 1)])}>+</button>
          </div>

          {isLoading ? null : !current ? (
            <p className="adm-empty" style={{ margin: 0 }}>{t('fm_empty')}</p>
          ) : (
            <div className="fm-scroll">
              <svg
                ref={svgRef}
                key={current.id}
                className={`fm-svg${editing ? ' is-editing' : ''}${current.kind === 'OUTDOOR' ? ' is-outdoor' : ''}`}
                viewBox={`0 0 ${size.width} ${size.height}`}
                style={{ width: `${zoom * 100}%` }}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={() => setDrag(null)}
                role="application"
                aria-label={current.name}
              >
                <defs>
                  <pattern id="fm-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <circle cx="1" cy="1" r="1.4" className="fm-grid-dot" />
                  </pattern>
                  <clipPath id="fm-clip"><rect width={size.width} height={size.height} /></clipPath>
                </defs>
                <rect className="fm-ground" width={size.width} height={size.height} onPointerDown={() => setSelectedId(null)} />
                <rect width={size.width} height={size.height} fill="url(#fm-grid)" pointerEvents="none" />
                {/* The drawing never takes a click: a press on a zone is a press on the floor. */}
                <g clipPath="url(#fm-clip)" pointerEvents="none">{features.map(renderFeature)}</g>
                {areaTables.map(renderTable)}
                {/* Reserved as a whole: said over the plan, because no single
                    table carries that fact. */}
                {!editing && wholeAreaBooking && (
                  <g pointerEvents="none">
                    <rect width={size.width} height={size.height} fill="rgba(148,163,184,0.18)" />
                    <text x={size.width / 2} y={size.height / 2} textAnchor="middle" dominantBaseline="middle"
                      style={{ fontSize: 42 * unit, fontWeight: 800, fill: 'var(--adm-text)', opacity: 0.6 }}>
                      {t('fm_whole_area_taken')} · #{wholeAreaBooking.eventNumber}
                    </text>
                  </g>
                )}
                {editing && (
                  <rect
                    className="fm-resize"
                    x={size.width - 30 * unit} y={size.height - 30 * unit} width={24 * unit} height={24 * unit} rx={4 * unit}
                    onPointerDown={onAreaHandlePointerDown}
                  />
                )}
              </svg>
            </div>
          )}
        </section>

        <aside className="adm-card fm-panel">
          <h3 className="adm-heading" style={{ marginTop: 0 }}>
            {booking ? t('fm_new_booking')
              : openBooking ? t('fm_booking')
              : selectedTable ? t('fm_table', { label: selectedTable.label })
              : current?.name ?? t('floor_map')}
          </h3>
          {/* What the panel is about, in order of what the admin just did:
              a booking being drafted, a booking they clicked, then the map. */}
          {booking ? bookingForm()
            : openBooking ? bookingCard(openBooking)
            : selectedTable ? tablePanel(selectedTable)
            : current ? areaPanel(current)
            : <p className="fm-caption" style={{ margin: 0 }}>{t('fm_nothing_selected')}</p>}
        </aside>
      </div>

      <style>{`
        .fm-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
        .fm-toolbar { display: flex; gap: 8px; flex-wrap: wrap; }
        .fm-caption { font-size: 13px; color: rgba(var(--adm-text-rgb), 0.6); }
        .fm-notice {
          margin: 0 0 14px; padding: 10px 14px; border-radius: 4px; font-size: 13px;
          color: #fecaca; background: rgba(220, 38, 38, 0.12); border: 1px solid rgba(220, 38, 38, 0.35);
        }

        .fm-tabs {
          display: flex; gap: 6px; margin-top: 18px; overflow-x: auto; padding-bottom: 2px;
          border-bottom: 1px solid var(--adm-line); scrollbar-width: thin;
        }
        .fm-tab {
          flex: 0 0 auto; display: grid; gap: 2px; text-align: left; cursor: pointer;
          padding: 9px 16px 10px; border: 1px solid transparent; border-bottom: 0; border-radius: 4px 4px 0 0;
          background: transparent; color: rgba(var(--adm-text-rgb), 0.7);
          margin-bottom: -1px;
        }
        .fm-tab:hover { color: var(--adm-text); background: rgba(var(--adm-text-rgb), 0.04); }
        .fm-tab.is-on {
          color: var(--adm-accent); background: rgba(var(--adm-surface-rgb), 0.9);
          border-color: var(--adm-line); box-shadow: inset 0 2px 0 var(--adm-accent);
        }
        .fm-tab-name { font-size: 14px; font-weight: 700; }
        .fm-tab-meta { font-size: 11px; color: rgba(var(--adm-text-rgb), 0.5); }
        .fm-tab-add { color: var(--adm-accent); font-size: 13px; font-weight: 700; align-self: center; }

        .fm-layout { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 16px; align-items: start; }
        .fm-canvas-card { padding: 12px !important; min-width: 0; }
        .fm-zoom { display: flex; gap: 6px; justify-content: flex-end; margin-bottom: 10px; }
        .fm-zoom button { min-width: 36px; }
        .fm-scroll { overflow: auto; max-height: 76vh; border-radius: 4px; background: rgba(var(--adm-bg-rgb), 0.55); }
        .fm-svg { display: block; min-width: 100%; height: auto; user-select: none; -webkit-user-select: none; }
        .fm-ground { fill: rgba(var(--adm-surface-rgb), 0.6); }
        .fm-svg.is-outdoor .fm-ground { fill: rgba(var(--adm-accent-rgb), 0.05); }
        .fm-grid-dot { fill: rgba(var(--adm-text-rgb), 0.1); }
        .fm-feature-label {
          font-weight: 800; letter-spacing: 0.02em; fill: var(--adm-text);
          paint-order: stroke; stroke: rgba(var(--adm-bg-rgb), 0.7); stroke-width: 5px;
        }
        .fm-feature.is-label .fm-feature-label { fill: rgba(var(--adm-text-rgb), 0.75); font-weight: 700; }
        .fm-resize { fill: var(--adm-accent); opacity: 0.85; cursor: nwse-resize; touch-action: none; }

        .fm-table-group { cursor: pointer; outline: none; }
        .fm-table-group.is-editable { cursor: grab; touch-action: none; }
        .fm-table-group.is-dragging { cursor: grabbing; opacity: 0.85; }
        .fm-top { fill: rgb(var(--adm-surface-rgb)); stroke: rgba(var(--adm-accent-rgb), 0.8); stroke-width: 2; }
        .fm-chair { fill: rgba(var(--adm-text-rgb), 0.28); stroke: rgba(var(--adm-text-rgb), 0.6); stroke-width: 1.5; }
        .fm-table-group.is-selected .fm-top, .fm-table-group:focus-visible .fm-top { stroke: var(--adm-accent); stroke-width: 4; }
        .fm-table-group.is-selected .fm-chair { stroke: var(--adm-accent); }
        .fm-table-group.is-overlapping .fm-top, .fm-table-group.is-overlapping .fm-chair { stroke: #f87171; }
        /* Taken on the chosen day: filled, so it reads without colour too. */
        .fm-table-group.is-taken .fm-top { fill: rgba(148,163,184,0.55); stroke: rgba(148,163,184,0.9); }
        .fm-table-group.is-taken .fm-chair { opacity: 0.4; }
        .fm-table-group.is-taken .fm-table-seats { fill: rgba(var(--adm-text-rgb), 0.85); font-weight: 700; }
        /* Picked for the booking being drafted. */
        .fm-table-group.is-picked .fm-top { fill: rgba(var(--adm-accent-rgb), 0.85); stroke: var(--adm-accent); }
        .fm-table-group.is-picked .fm-table-label,
        .fm-table-group.is-picked .fm-table-seats { fill: var(--adm-accent-ink, #04120d); }

        /* The day bar carries a date, four controls and a legend. Given one
           flat row they run together and the legend crowds the buttons, so it
           is a bordered strip with its own rhythm: the controls on one line,
           the legend pushed to the end and onto its own line once there is no
           room for both. */
        .fm-daybar {
          display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
          margin: 18px 0 0; padding: 12px 14px;
          border: 1px solid var(--adm-line); border-radius: 6px;
          background: rgba(var(--adm-text-rgb), 0.03);
        }
        .fm-daybar > label { margin-right: -4px; }
        .fm-daybar input[type="date"] { max-width: 190px; }
        .fm-legend {
          display: flex; align-items: center; gap: 16px; flex-wrap: wrap;
          margin-left: auto; padding-left: 14px;
          border-left: 1px solid var(--adm-line);
          font-size: 12px; color: rgba(var(--adm-text-rgb), 0.6);
        }
        @media (max-width: 900px) {
          /* No room for both: the legend takes the next line, and the rule
             that separated them would then be a stray vertical tick. */
          .fm-legend { margin-left: 0; padding-left: 0; border-left: 0; width: 100%; }
        }
        .fm-legend span { display: inline-flex; align-items: center; gap: 6px; }
        .fm-swatch { width: 14px; height: 10px; border-radius: 2px; border: 1px solid var(--adm-line); display: inline-block; }
        /* .adm-card sets no padding of its own, and an inline !important is
           silently DROPPED by React — which is how this card came to have none
           at all and its text sat against the edge. It belongs here. (No
           backticks in this block: it lives inside a template literal.) */
        .fm-sched-card { padding: 18px !important; margin-top: 18px; }
        .fm-booking-card { display: grid; gap: 10px; }
        .fm-booking-card .fm-facts { margin-bottom: 4px; }
        /* Room for the scrollbar, so the last row is not sliced by it. */
        .fm-sched { display: grid; gap: 10px; max-height: 340px; overflow: auto; padding-right: 4px; }
        .fm-sched-row {
          display: grid; gap: 3px; padding: 10px 12px; border-radius: 4px;
          border: 1px solid var(--adm-line); border-left: 2px solid rgba(var(--adm-accent-rgb), 0.5);
          background: rgba(var(--adm-text-rgb), 0.03); cursor: pointer; text-align: left;
        }
        .fm-sched-row.is-past { opacity: 0.6; }
        .fm-sched-when { font-size: 12px; color: var(--adm-accent); font-weight: 700; }
        .fm-sched-who { font-size: 13px; font-weight: 600; }
        .fm-sched-what { font-size: 11px; color: rgba(var(--adm-text-rgb), 0.55); }
        .fm-table-label { font-weight: 800; fill: var(--adm-text); pointer-events: none; }
        .fm-table-seats { font-weight: 600; fill: rgba(var(--adm-text-rgb), 0.55); pointer-events: none; }
        .fm-table-handle { cursor: nwse-resize; touch-action: none; }
        .fm-table-handle rect { fill: var(--adm-accent); stroke: rgb(var(--adm-bg-rgb)); stroke-width: 2; }
        .fm-table-handle .fm-hit { fill: transparent; }

        .fm-panel { position: sticky; top: 84px; padding: 18px !important; }
        .fm-form { display: grid; gap: 14px; }
        .fm-form label, .fm-area-form label { display: grid; gap: 6px; font-size: 13px; }
        .fm-stepper { display: flex; align-items: center; gap: 10px; margin-top: 6px; }
        .fm-stepper output { min-width: 32px; text-align: center; font-size: 20px; font-weight: 800; }
        .fm-stepper button { min-width: 40px; }
        .fm-size-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 6px; }
        .fm-size-row output { font-size: 15px; font-weight: 700; font-variant-numeric: tabular-nums; }
        .fm-segmented { display: flex; margin-top: 6px; border: 1px solid var(--adm-line); border-radius: 4px; overflow: hidden; }
        .fm-segmented button {
          flex: 1; padding: 8px 6px; font-size: 12px; font-weight: 600; cursor: pointer;
          background: transparent; border: 0; color: rgba(var(--adm-text-rgb), 0.7);
        }
        .fm-segmented button.is-on { background: rgba(var(--adm-accent-rgb), 0.16); color: var(--adm-accent); }
        .fm-default {
          display: grid; gap: 8px; padding: 12px; border-radius: 4px;
          border: 1px solid var(--adm-line); background: rgba(var(--adm-text-rgb), 0.03);
        }
        .fm-flash {
          margin: 2px 0 0; font-size: 12px; font-weight: 600; color: var(--adm-accent);
        }
        .fm-facts { display: grid; grid-template-columns: auto 1fr; gap: 8px 14px; margin: 0; font-size: 14px; }
        .fm-facts dt { color: rgba(var(--adm-text-rgb), 0.55); }
        .fm-facts dd { margin: 0; font-weight: 600; }
        .fm-area-form { display: grid; grid-template-columns: 2fr 1fr 1fr auto; gap: 12px; align-items: end; margin-bottom: 16px; padding: 16px !important; }
        .fm-area-form-actions { display: flex; gap: 8px; }

        @media (max-width: 1100px) {
          .fm-layout { grid-template-columns: minmax(0, 1fr); }
          .fm-panel { position: static; }
        }
        @media (max-width: 640px) {
          .fm-page { padding: 20px 16px !important; }
          .fm-area-form { grid-template-columns: 1fr; }
          .fm-toolbar { width: 100%; }
          .fm-toolbar button { flex: 1; }
        }
      `}</style>
    </main>
  );
};

/**
 * A text field that commits on blur or Enter, never per keystroke: every commit
 * is a request, and a table number half-typed on the way to "12" would collide
 * with table 1.
 */
const LabelField = ({ value, onCommit, maxLength = 20 }: { value: string; onCommit: (next: string) => void; maxLength?: number }) => {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commitDraft = () => {
    const next = draft.trim();
    if (!next) { setDraft(value); return; }
    if (next !== value) onCommit(next);
  };
  return (
    <input
      className="adm-input"
      value={draft}
      maxLength={maxLength}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commitDraft}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitDraft(); } if (e.key === 'Escape') setDraft(value); }}
    />
  );
};
