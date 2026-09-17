import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { floorMapService } from '../services/floorMap.service';
import { hallService } from '../services/hall.service';
import { useAdminStore } from '../store/admin.store';
import {
  AREA_HEADER, CHAIR_DEPTH, CHAIR_WIDTH, MAX_SEATS, MIN_SEATS, areaAt, chairsFor, clampSeats, clampTable,
  freeSpot, isPlaced, minAreaSize, nextRotation, nextTableLabel, overlappingTables, placeNewArea, resolveLayouts, seatsIn,
  tableSize, worldSize,
  type AreaKind, type AreaLayout, type FloorMap, type MapArea, type MapTable, type TableShape,
} from '../utils/floorMap';
import { translate } from '../utils/translate';

/**
 * The Small Banquets floor map — the section's main page.
 *
 * Its halls and outdoor areas, and every table standing in them, drawn to one
 * scale. It is the first page where the section DIFFERS from the banquet app
 * rather than mounting the same component over separate data.
 *
 * Two modes, because the map is a home page as well as an editor: a supervisor
 * opening it to look must not be able to shove a table across the room with a
 * stray swipe. Viewing selects; "Edit map" is what makes things draggable.
 *
 * The geometry — how big a table of N seats is, where its chairs stand, where
 * an unplaced hall goes — lives in utils/floorMap.ts and is tested there. This
 * file is the pointer handling and the drawing.
 */

const MAP_KEY = ['floor-map'] as const;
const ZOOM_STEPS = [0.5, 0.75, 1, 1.5, 2, 3];
/** How far the pointer must travel, in map units, before a press becomes a drag. */
const DRAG_THRESHOLD = 4;

type Selection = { kind: 'table' | 'area'; id: string } | null;

type Drag =
  | { type: 'table'; id: string; dx: number; dy: number; x: number; y: number; moved: boolean }
  | { type: 'move-area'; id: string; dx: number; dy: number; x: number; y: number; moved: boolean }
  | { type: 'resize-area'; id: string; startX: number; startY: number; width: number; height: number; baseW: number; baseH: number; moved: boolean };

const errorText = (error: unknown) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message
  ?? (error as Error)?.message
  ?? 'Error';

export const FloorMapPage = () => {
  const { locale } = useAdminStore();
  const t = (key: Parameters<typeof translate>[0], params?: Record<string, string | number>) => translate(key, locale, params);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({ queryKey: MAP_KEY, queryFn: () => floorMapService.get() });
  const areas = useMemo(() => data?.areas ?? [], [data]);
  const tables = useMemo(() => data?.tables ?? [], [data]);

  const [editing, setEditing] = useState(false);
  const [selection, setSelection] = useState<Selection>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  // A phone opens zoomed in: the whole floor fitted to 390px draws table
  // numbers a few pixels high. The map scrolls inside its own frame.
  const [zoom, setZoom] = useState(() => (typeof window !== 'undefined' && window.innerWidth < 700 ? 2 : 1));
  const [notice, setNotice] = useState<string | null>(null);
  const [areaForm, setAreaForm] = useState<{ name: string; kind: AreaKind; capacity: string } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const layouts = useMemo(() => resolveLayouts(areas, tables), [areas, tables]);
  const overlapping = useMemo(() => overlappingTables(tables), [tables]);

  /** The layout to draw — the stored one, overridden by an area being dragged. */
  const layoutOf = (id: string): AreaLayout | undefined => {
    const base = layouts.get(id);
    if (!base || !drag || drag.id !== id) return base;
    if (drag.type === 'move-area') return { ...base, mapX: drag.x, mapY: drag.y };
    if (drag.type === 'resize-area') return { ...base, mapWidth: drag.width, mapHeight: drag.height };
    return base;
  };

  const drawnLayouts = useMemo(() => {
    const out = new Map(layouts);
    if (drag && drag.type !== 'table') out.set(drag.id, layoutOf(drag.id)!);
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layouts, drag]);
  const world = worldSize(drawnLayouts.values());

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

  const updateTable = (table: MapTable, patch: Partial<MapTable>) => {
    const next = { ...table, ...patch };
    // A change of seats, shape or rotation changes the table's footprint, so the
    // table is pulled back inside its area if it now pokes out.
    const layout = layouts.get(next.hallId);
    if (layout) Object.assign(next, clampTable(next, next, { width: layout.mapWidth, height: layout.mapHeight }));
    const body = {
      hallId: next.hallId, label: next.label, seats: next.seats, shape: next.shape as TableShape,
      x: next.x, y: next.y, rotation: next.rotation,
    };
    // Only what changed, so a rename that collides does not also resend a move.
    const changed = Object.fromEntries(Object.entries(body).filter(([k, v]) => table[k as keyof MapTable] !== v));
    if (Object.keys(changed).length === 0) return;
    void commit(
      (m) => ({ ...m, tables: m.tables.map((x) => (x.id === table.id ? next : x)) }),
      () => floorMapService.updateTable(table.id, changed),
    );
  };

  const updateArea = (area: MapArea, patch: Partial<AreaLayout & { name: string; kind: AreaKind }>) => {
    void commit(
      (m) => ({ ...m, areas: m.areas.map((x) => (x.id === area.id ? { ...x, ...patch } : x)) }),
      () => floorMapService.updateArea(area.id, patch),
    );
  };

  /**
   * Entering edit mode pins every area the map placed by itself. Until then an
   * unplaced hall's position is only a suggestion that moves when another hall
   * is created; once someone starts arranging tables inside it, it must stay put.
   */
  const startEditing = () => {
    setEditing(true);
    for (const area of areas) {
      if (isPlaced(area)) continue;
      const layout = layouts.get(area.id);
      if (layout) updateArea(area, layout);
    }
  };

  const addTable = async (areaId: string) => {
    const layout = layouts.get(areaId);
    if (!layout) return;
    const inArea = tables.filter((x) => x.hallId === areaId);
    const draft = { shape: 'RECT' as const, seats: 4, rotation: 0 };
    const room = { width: layout.mapWidth, height: layout.mapHeight };
    let spot = freeSpot(draft, room, inArea);
    if (!spot) {
      // Full: put it in the middle and say so, rather than refusing — the
      // supervisor can move it or enlarge the area, and a button that does
      // nothing explains nothing.
      spot = clampTable({ x: room.width / 2, y: room.height / 2 }, draft, room);
      setNotice(t('fm_area_full'));
    }
    const row = await commit(null, () => floorMapService.createTable({
      hallId: areaId, label: nextTableLabel(inArea.map((x) => x.label)), ...draft, ...spot!,
    }));
    if (row) {
      patchCache((m) => ({ ...m, tables: [...m.tables, row] }));
      setSelection({ kind: 'table', id: row.id });
    }
  };

  const deleteTable = (table: MapTable) => {
    if (!window.confirm(t('fm_delete_table_confirm', { label: table.label }))) return;
    setSelection(null);
    void commit((m) => ({ ...m, tables: m.tables.filter((x) => x.id !== table.id) }), () => floorMapService.removeTable(table.id));
  };

  const deleteArea = (area: MapArea) => {
    const count = tables.filter((x) => x.hallId === area.id).length;
    if (!window.confirm(t('fm_delete_area_confirm', { name: area.name, count }))) return;
    setSelection(null);
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

  const createArea = async () => {
    if (!areaForm) return;
    const capacity = Number(areaForm.capacity.replace(/\s/g, ''));
    if (!areaForm.name.trim() || !Number.isInteger(capacity) || capacity <= 0) return;
    const row = await commit(null, () => floorMapService.createArea({
      name: areaForm.name.trim(), kind: areaForm.kind, capacity, ...placeNewArea(areas, tables, areaForm.kind),
    }));
    if (row) {
      patchCache((m) => ({ ...m, areas: [...m.areas, row] }));
      void queryClient.invalidateQueries({ queryKey: ['halls'] });
      setAreaForm(null);
      setSelection({ kind: 'area', id: row.id });
    }
  };

  // ── Pointer handling ──────────────────────────────────────────────────────

  /** A pointer position in map units, whatever the zoom and scroll. */
  const toWorld = (event: { clientX: number; clientY: number }) => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return { x: 0, y: 0 };
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
    setSelection({ kind: 'table', id: table.id });
    const layout = layouts.get(table.hallId);
    if (!layout) return;
    const p = toWorld(event);
    const cx = layout.mapX + table.x;
    const cy = layout.mapY + table.y;
    beginDrag(event, { type: 'table', id: table.id, dx: p.x - cx, dy: p.y - cy, x: cx, y: cy, moved: false });
  };

  const onAreaHeaderPointerDown = (event: ReactPointerEvent<SVGRectElement>, area: MapArea) => {
    setSelection({ kind: 'area', id: area.id });
    const layout = layouts.get(area.id);
    if (!layout) return;
    const p = toWorld(event);
    beginDrag(event, { type: 'move-area', id: area.id, dx: p.x - layout.mapX, dy: p.y - layout.mapY, x: layout.mapX, y: layout.mapY, moved: false });
  };

  const onResizePointerDown = (event: ReactPointerEvent<SVGRectElement>, area: MapArea) => {
    setSelection({ kind: 'area', id: area.id });
    const layout = layouts.get(area.id);
    if (!layout) return;
    const p = toWorld(event);
    beginDrag(event, {
      type: 'resize-area', id: area.id, startX: p.x, startY: p.y,
      width: layout.mapWidth, height: layout.mapHeight, baseW: layout.mapWidth, baseH: layout.mapHeight, moved: false,
    });
  };

  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!drag) return;
    const p = toWorld(event);
    if (drag.type === 'table') {
      const x = p.x - drag.dx;
      const y = p.y - drag.dy;
      const moved = drag.moved || Math.hypot(x - drag.x, y - drag.y) > DRAG_THRESHOLD;
      setDrag({ ...drag, x, y, moved });
    } else if (drag.type === 'move-area') {
      const x = Math.max(0, Math.round(p.x - drag.dx));
      const y = Math.max(0, Math.round(p.y - drag.dy));
      setDrag({ ...drag, x, y, moved: drag.moved || x !== drag.x || y !== drag.y });
    } else {
      const min = minAreaSize(tables.filter((x) => x.hallId === drag.id));
      const width = Math.max(min.width, Math.round(drag.baseW + p.x - drag.startX));
      const height = Math.max(min.height, Math.round(drag.baseH + p.y - drag.startY));
      setDrag({ ...drag, width, height, moved: true });
    }
  };

  const onPointerUp = () => {
    const done = drag;
    setDrag(null);
    if (!done || !done.moved) return;

    if (done.type === 'table') {
      const table = tables.find((x) => x.id === done.id);
      if (!table) return;
      // Dropped over another area → it moves there. Dropped over empty floor →
      // it stays in its own area, pulled back to the nearest edge.
      const target = areaAt({ x: done.x, y: done.y }, layouts) ?? table.hallId;
      const layout = layouts.get(target)!;
      const pos = clampTable({ x: done.x - layout.mapX, y: done.y - layout.mapY }, table, { width: layout.mapWidth, height: layout.mapHeight });
      updateTable(table, { hallId: target, ...pos });
      return;
    }

    const area = areas.find((x) => x.id === done.id);
    const layout = layoutOf(done.id) ?? layouts.get(done.id);
    if (!area || !layout) return;
    const final = done.type === 'move-area'
      ? { ...layouts.get(done.id)!, mapX: done.x, mapY: done.y }
      : { ...layouts.get(done.id)!, mapWidth: done.width, mapHeight: done.height };
    updateArea(area, final);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setSelection(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // A selection whose row has gone (deleted, or reloaded after a failed save).
  const selectedTable = selection?.kind === 'table' ? tables.find((x) => x.id === selection.id) ?? null : null;
  const selectedArea = selection?.kind === 'area' ? areas.find((x) => x.id === selection.id) ?? null : null;
  /** The area "Add table" targets: the one selected, or the selected table's, or the first. */
  const targetAreaId = selectedArea?.id ?? selectedTable?.hallId ?? areas[0]?.id ?? null;

  // ── Drawing ───────────────────────────────────────────────────────────────

  const renderTable = (table: MapTable) => {
    const layout = layouts.get(table.hallId);
    if (!layout) return null;
    const dragging = drag?.type === 'table' && drag.id === table.id;
    const cx = dragging ? drag.x : layout.mapX + table.x;
    const cy = dragging ? drag.y : layout.mapY + table.y;
    const { width, height } = tableSize(table.shape, table.seats);
    const selected = selectedTable?.id === table.id;
    return (
      <g
        key={table.id}
        className={`fm-table-group${selected ? ' is-selected' : ''}${overlapping.has(table.id) ? ' is-overlapping' : ''}${editing ? ' is-editable' : ''}${dragging ? ' is-dragging' : ''}`}
        onPointerDown={(e) => onTablePointerDown(e, table)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelection({ kind: 'table', id: table.id }); } }}
        role="button"
        tabIndex={0}
        aria-label={`${t('fm_table', { label: table.label })}, ${t('fm_seats')}: ${table.seats}`}
      >
        <g transform={`translate(${cx} ${cy}) rotate(${table.rotation})`}>
          {chairsFor(table.shape, table.seats).map((chair, i) => (
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
            : <rect className="fm-top" x={-width / 2} y={-height / 2} width={width} height={height} rx={8} />}
        </g>
        {/* The number is drawn upright whatever the table's rotation — a label
            turned 45° is a label nobody reads across a room. */}
        <text className="fm-table-label" x={cx} y={cy - 2} textAnchor="middle" dominantBaseline="middle">{table.label}</text>
        <text className="fm-table-seats" x={cx} y={cy + 15} textAnchor="middle" dominantBaseline="middle">{table.seats}</text>
      </g>
    );
  };

  const renderArea = (area: MapArea) => {
    const layout = layoutOf(area.id);
    if (!layout) return null;
    const inArea = tables.filter((x) => x.hallId === area.id);
    const outdoor = area.kind === 'OUTDOOR';
    const selected = selectedArea?.id === area.id;
    return (
      <g key={area.id} className={`fm-area${outdoor ? ' is-outdoor' : ''}${selected ? ' is-selected' : ''}${area.isActive ? '' : ' is-inactive'}`}>
        <rect
          className="fm-area-body"
          x={layout.mapX} y={layout.mapY} width={layout.mapWidth} height={layout.mapHeight} rx={outdoor ? 18 : 4}
          onPointerDown={() => { if (!drag) setSelection({ kind: 'area', id: area.id }); }}
        />
        <rect
          className={`fm-area-header${editing ? ' is-handle' : ''}`}
          x={layout.mapX} y={layout.mapY} width={layout.mapWidth} height={AREA_HEADER} rx={outdoor ? 18 : 4}
          onPointerDown={(e) => onAreaHeaderPointerDown(e, area)}
        />
        <text className="fm-area-name" x={layout.mapX + 16} y={layout.mapY + AREA_HEADER / 2} dominantBaseline="middle">
          {area.name}
          <tspan className="fm-area-meta" dx={12}>
            {outdoor ? t('fm_kind_outdoor') : t('fm_kind_hall')}
            {' · '}
            {t('fm_area_stats', { tables: inArea.length, seats: seatsIn(inArea) })}
            {area.isActive ? '' : ` · ${t('fm_inactive')}`}
          </tspan>
        </text>
        {editing && (
          <rect
            className="fm-resize"
            x={layout.mapX + layout.mapWidth - 22} y={layout.mapY + layout.mapHeight - 22} width={18} height={18} rx={3}
            onPointerDown={(e) => onResizePointerDown(e, area)}
          />
        )}
      </g>
    );
  };

  // ── Panel ─────────────────────────────────────────────────────────────────

  const panel = () => {
    if (selectedTable) {
      const table = selectedTable;
      const area = areas.find((x) => x.id === table.hallId);
      const clash = overlapping.has(table.id) && <p className="fm-notice" style={{ margin: '0 0 12px' }}>{t('fm_overlap')}</p>;
      if (!editing) {
        return (
          <>
          {clash}
          <dl className="fm-facts">
            <dt>{t('fm_table_number')}</dt><dd>{table.label}</dd>
            <dt>{t('fm_seats')}</dt><dd>{table.seats}</dd>
            <dt>{t('fm_shape')}</dt><dd>{table.shape === 'ROUND' ? t('fm_shape_round') : t('fm_shape_rect')}</dd>
            <dt>{t('fm_area')}</dt><dd>{area?.name ?? '—'}</dd>
          </dl>
          </>
        );
      }
      return (
        <div className="fm-form">
          {clash}
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
                  onClick={() => updateTable(table, { shape })}>
                  {shape === 'ROUND' ? t('fm_shape_round') : t('fm_shape_rect')}
                </button>
              ))}
            </div>
          </div>
          <button type="button" className="adm-btn-ghost" disabled={table.shape === 'ROUND'}
            onClick={() => updateTable(table, { rotation: nextRotation(table.rotation) })}>
            {t('fm_rotate')}
          </button>
          <label>
            <span>{t('fm_area')}</span>
            <select className="adm-input" value={table.hallId}
              onChange={(e) => {
                const target = layouts.get(e.target.value);
                if (!target) return;
                const room = { width: target.mapWidth, height: target.mapHeight };
                const spot = freeSpot(table, room, tables.filter((x) => x.hallId === e.target.value))
                  ?? clampTable({ x: room.width / 2, y: room.height / 2 }, table, room);
                updateTable(table, { hallId: e.target.value, ...spot });
              }}>
              {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>
          <button type="button" className="adm-btn-danger" onClick={() => deleteTable(table)}>{t('fm_delete_table')}</button>
        </div>
      );
    }

    if (selectedArea) {
      const area = selectedArea;
      const inArea = tables.filter((x) => x.hallId === area.id);
      if (!editing) {
        return (
          <dl className="fm-facts">
            <dt>{t('name')}</dt><dd>{area.name}</dd>
            <dt>{t('fm_kind')}</dt><dd>{area.kind === 'OUTDOOR' ? t('fm_kind_outdoor') : t('fm_kind_hall')}</dd>
            <dt>{t('capacity')}</dt><dd>{area.capacity}</dd>
            <dt>{t('fm_seats')}</dt><dd>{t('fm_area_stats', { tables: inArea.length, seats: seatsIn(inArea) })}</dd>
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
                  {kind === 'OUTDOOR' ? t('fm_kind_outdoor') : t('fm_kind_hall')}
                </button>
              ))}
            </div>
          </div>
          <p className="fm-caption">{t('fm_area_stats', { tables: inArea.length, seats: seatsIn(inArea) })}</p>
          <button type="button" className="adm-btn-primary" onClick={() => void addTable(area.id)}>{t('fm_add_table_here')}</button>
          <button type="button" className="adm-btn-danger" onClick={() => deleteArea(area)}>{t('fm_delete_area')}</button>
        </div>
      );
    }

    return <p className="fm-caption" style={{ margin: 0 }}>{t('fm_nothing_selected')}</p>;
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
            <>
              <button type="button" className="adm-btn-ghost" onClick={() => setAreaForm({ name: '', kind: 'OUTDOOR', capacity: '' })}>
                {t('fm_add_area')}
              </button>
              <button type="button" className="adm-btn-ghost" disabled={!targetAreaId} onClick={() => targetAreaId && void addTable(targetAreaId)}>
                {t('fm_add_table')}
              </button>
            </>
          )}
          <button type="button" className="adm-btn-primary" onClick={() => (editing ? setEditing(false) : startEditing())}>
            {editing ? t('fm_done') : t('fm_edit')}
          </button>
        </div>
      </div>

      <p className="fm-caption" style={{ margin: '14px 0' }}>{editing ? t('fm_hint_edit') : t('fm_hint_view')}</p>
      {notice && <p className="fm-notice" role="alert">{notice}</p>}

      {areaForm && (
        <form
          className="adm-card fm-area-form"
          onSubmit={(e) => { e.preventDefault(); void createArea(); }}
        >
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

          {isLoading ? null : areas.length === 0 ? (
            <p className="adm-empty" style={{ margin: 0 }}>{t('fm_empty')}</p>
          ) : (
            <div className="fm-scroll">
              <svg
                ref={svgRef}
                className={`fm-svg${editing ? ' is-editing' : ''}`}
                viewBox={`0 0 ${world.width} ${world.height}`}
                style={{ width: `${zoom * 100}%` }}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={() => setDrag(null)}
                role="application"
                aria-label={t('fm_title')}
              >
                <defs>
                  <pattern id="fm-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <circle cx="1" cy="1" r="1.4" className="fm-grid-dot" />
                  </pattern>
                </defs>
                <rect width={world.width} height={world.height} fill="url(#fm-grid)"
                  onPointerDown={() => setSelection(null)} />
                {areas.map(renderArea)}
                {/* Tables after every area, so a table dragged over a
                    neighbouring room is drawn above it rather than beneath. */}
                {tables.map(renderTable)}
              </svg>
            </div>
          )}
        </section>

        <aside className="adm-card fm-panel">
          <h3 className="adm-heading" style={{ marginTop: 0 }}>
            {selectedTable ? t('fm_table', { label: selectedTable.label }) : selectedArea ? selectedArea.name : t('floor_map')}
          </h3>
          {panel()}
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
        .fm-layout { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 16px; align-items: start; }
        .fm-canvas-card { padding: 12px !important; min-width: 0; }
        .fm-zoom { display: flex; gap: 6px; justify-content: flex-end; margin-bottom: 10px; }
        .fm-zoom button { min-width: 36px; }
        .fm-scroll { overflow: auto; max-height: 76vh; border-radius: 4px; background: rgba(var(--adm-bg-rgb), 0.55); }
        .fm-svg { display: block; min-width: 100%; height: auto; user-select: none; -webkit-user-select: none; }
        .fm-grid-dot { fill: rgba(var(--adm-text-rgb), 0.12); }

        .fm-area-body { fill: rgba(var(--adm-surface-rgb), 0.72); stroke: rgba(var(--adm-text-rgb), 0.22); stroke-width: 2; }
        .fm-area.is-outdoor .fm-area-body {
          fill: rgba(var(--adm-accent-rgb), 0.05); stroke: rgba(var(--adm-accent-rgb), 0.55); stroke-dasharray: 14 10;
        }
        .fm-area.is-selected .fm-area-body { stroke: var(--adm-accent); stroke-width: 3; }
        .fm-area.is-inactive { opacity: 0.55; }
        .fm-area-header { fill: rgba(var(--adm-text-rgb), 0.05); }
        .fm-area.is-outdoor .fm-area-header { fill: rgba(var(--adm-accent-rgb), 0.08); }
        .fm-area-header.is-handle { cursor: move; touch-action: none; }
        .fm-area-name { font-size: 20px; font-weight: 700; fill: var(--adm-title, var(--adm-text)); pointer-events: none; }
        .fm-area-meta { font-size: 14px; font-weight: 500; fill: rgba(var(--adm-text-rgb), 0.55); }
        .fm-resize { fill: var(--adm-accent); opacity: 0.8; cursor: nwse-resize; touch-action: none; }

        .fm-table-group { cursor: pointer; outline: none; }
        .fm-table-group.is-editable { cursor: grab; touch-action: none; }
        .fm-table-group.is-dragging { cursor: grabbing; }
        .fm-top { fill: rgba(var(--adm-accent-rgb), 0.18); stroke: rgba(var(--adm-accent-rgb), 0.7); stroke-width: 2; }
        .fm-chair { fill: rgba(var(--adm-text-rgb), 0.16); stroke: rgba(var(--adm-text-rgb), 0.5); stroke-width: 1.5; }
        .fm-table-group.is-selected .fm-top, .fm-table-group:focus-visible .fm-top { stroke: var(--adm-accent); stroke-width: 4; }
        .fm-table-group.is-selected .fm-chair { stroke: var(--adm-accent); }
        .fm-table-group.is-overlapping .fm-top, .fm-table-group.is-overlapping .fm-chair { stroke: #f87171; }
        .fm-table-group.is-dragging { opacity: 0.85; }
        .fm-table-label { font-size: 17px; font-weight: 800; fill: var(--adm-text); pointer-events: none; }
        .fm-table-seats { font-size: 11px; font-weight: 600; fill: rgba(var(--adm-text-rgb), 0.55); pointer-events: none; }

        .fm-panel { position: sticky; top: 84px; padding: 18px !important; }
        .fm-form { display: grid; gap: 14px; }
        .fm-form label, .fm-area-form label { display: grid; gap: 6px; font-size: 13px; }
        .fm-stepper { display: flex; align-items: center; gap: 10px; margin-top: 6px; }
        .fm-stepper output { min-width: 32px; text-align: center; font-size: 20px; font-weight: 800; }
        .fm-stepper button { min-width: 40px; }
        .fm-segmented { display: flex; margin-top: 6px; border: 1px solid var(--adm-line); border-radius: 4px; overflow: hidden; }
        .fm-segmented button {
          flex: 1; padding: 8px 6px; font-size: 12px; font-weight: 600; cursor: pointer;
          background: transparent; border: 0; color: rgba(var(--adm-text-rgb), 0.7);
        }
        .fm-segmented button.is-on { background: rgba(var(--adm-accent-rgb), 0.16); color: var(--adm-accent); }
        .fm-facts { display: grid; grid-template-columns: auto 1fr; gap: 8px 14px; margin: 0; font-size: 14px; }
        .fm-facts dt { color: rgba(var(--adm-text-rgb), 0.55); }
        .fm-facts dd { margin: 0; font-weight: 600; }
        .fm-area-form { display: grid; grid-template-columns: 2fr 1fr 1fr auto; gap: 12px; align-items: end; margin-bottom: 16px; }
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
