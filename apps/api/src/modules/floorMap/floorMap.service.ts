import createHttpError from 'http-errors';
import type { Section } from '../../utils/section.js';
import { readLayout, snapshotOf } from './floorMap.layout.js';
import { dayKey, wholeAreaAvailable, type BookingRow } from '../../utils/floorBooking.js';
import type {
  AreaKind, AreaPatch, AreaRow, AreaSize, FloorMapRepository, TableData, TableRow,
} from './floorMap.repository.js';

type Repo = Pick<FloorMapRepository, keyof FloorMapRepository>;

/**
 * The floor map: a section's halls and outdoor areas, and the tables in them.
 *
 * Every path that takes an id re-checks BOTH scopes — restaurant and section —
 * before touching the row, and answers 404 when either fails. The id is the
 * only thing the caller sends, and ids appear in list responses; 404 rather
 * than 403 so the status code cannot tell a supervisor which ids exist next
 * door. (The hall module checks the section alone. This one does not copy
 * that, because a table moved between halls names a SECOND id, and the second
 * id is exactly where a missing restaurant check would let a table walk into
 * another restaurant's room.)
 */
export class FloorMapService {
  constructor(private readonly repo: Repo) {}

  private async areaInScope(restaurantId: string, section: Section, id: string): Promise<AreaRow> {
    const area = await this.repo.getArea(id);
    if (!area || area.restaurantId !== restaurantId || area.section !== section) {
      throw createHttpError(404, 'Area not found');
    }
    return area;
  }

  private async tableInScope(restaurantId: string, section: Section, id: string) {
    const table = await this.repo.getTable(id);
    if (!table || table.hall.restaurantId !== restaurantId || table.hall.section !== section) {
      throw createHttpError(404, 'Table not found');
    }
    return table;
  }

  private async assertLabelFree(hallId: string, label: string, exceptId?: string) {
    const taken = (await this.repo.labelsInArea(hallId))
      .some((row) => row.id !== exceptId && row.label.toLowerCase() === label.toLowerCase());
    // Case-folded: "vip 1" and "VIP 1" are the same table when read aloud, and
    // the database's unique index would let both in.
    if (taken) throw createHttpError(409, 'A table with this number already exists in this area');
  }

  async getMap(restaurantId: string, section: Section) {
    const [areas, tables] = await Promise.all([
      this.repo.listAreas(restaurantId, section),
      this.repo.listTables(restaurantId, section),
    ]);
    return { areas, tables };
  }

  // ── Bookings on the map ───────────────────────────────────────────────────

  /**
   * What is taken on a day. The map draws from this: a table with a booking
   * against it is drawn as taken, and an area somebody has reserved whole is
   * drawn as a whole.
   *
   * The DAY is the unit because a booking holds its tables for the whole of
   * the day it falls on — see utils/floorBooking.ts.
   */
  async getDay(restaurantId: string, section: Section, day: string) {
    const bookings = await this.repo.bookingsOnDay(restaurantId, section, day);
    const tablesByHall = await this.repo.tableIdsByHall(restaurantId, section);
    // Which areas could still be taken whole, so the map does not offer a
    // button that the save would then refuse.
    const occupancy = { tables: new Map<string, BookingRow>(), wholeAreas: new Map<string, BookingRow>() };
    for (const booking of bookings) {
      if (booking.status === 'CANCELLED') continue;
      if (booking.wholeHall && booking.hallId) occupancy.wholeAreas.set(booking.hallId, booking);
      for (const t of booking.floorTables) occupancy.tables.set(t.floorTableId, booking);
    }
    const wholeAreaFree: Record<string, boolean> = {};
    for (const hallId of tablesByHall.keys()) {
      wholeAreaFree[hallId] = wholeAreaAvailable(hallId, occupancy, tablesByHall);
    }
    return { day, bookings, wholeAreaFree };
  }

  /**
   * The schedule: every booking on the map between two days, PAST AND FUTURE
   * alike. A schedule that only looked forward would be a list of what is left
   * rather than a record of what happened, and the admin asking "who was at
   * table 12 last Saturday" is exactly the question this answers.
   */
  async getSchedule(restaurantId: string, section: Section, from: string, to: string) {
    const bookings = await this.repo.bookingsBetween(restaurantId, section, from, to);
    return { from, to, bookings };
  }

  /** One area, its tables and the day's bookings — what the printed sheet needs. */
  async getPrintablePlan(restaurantId: string, section: Section, id: string, day: string) {
    const area = await this.areaInScope(restaurantId, section, id);
    const [tables, bookings, restaurantName] = await Promise.all([
      this.repo.tablesInArea(id),
      this.repo.bookingsOnDay(restaurantId, section, day),
      this.repo.restaurantName(restaurantId),
    ]);
    return { area, tables, bookings, day, restaurantName };
  }

  async createArea(
    restaurantId: string,
    section: Section,
    payload: { name: string; kind: AreaKind; capacity: number } & AreaSize,
  ) {
    if (await this.repo.areaNameTaken(restaurantId, section, payload.name)) {
      throw createHttpError(409, 'Hall with this name already exists');
    }
    return this.repo.createArea(restaurantId, section, payload);
  }

  async updateArea(
    restaurantId: string,
    section: Section,
    id: string,
    payload: AreaPatch,
  ) {
    const area = await this.areaInScope(restaurantId, section, id);
    if (payload.name && payload.name !== area.name
      && await this.repo.areaNameTaken(restaurantId, section, payload.name, id)) {
      throw createHttpError(409, 'Hall with this name already exists');
    }
    return this.repo.updateArea(id, payload);
  }

  /**
   * Remember the area exactly as it stands now — its tables, its map size and
   * its drawing — as the layout "revert" puts it back to. Saving again simply
   * replaces it: there is one default per area, and a second one would be a
   * list nobody asked for.
   */
  async saveDefaultLayout(restaurantId: string, section: Section, id: string): Promise<AreaRow> {
    const area = await this.areaInScope(restaurantId, section, id);
    const layout = snapshotOf(area, await this.repo.tablesInArea(id));
    return this.repo.saveDefaultLayout(id, layout, new Date());
  }

  /**
   * Put the area back to its saved default. The area's CURRENT tables are
   * replaced by the saved ones, so anything added since is gone — which is
   * what reverting a room means, and why the page asks first.
   *
   * With no default saved this is a 409 rather than a restore of nothing: an
   * area that has never been saved has no "default state" to go back to, and
   * emptying the room would be the worst possible reading of the button.
   */
  async restoreDefaultLayout(restaurantId: string, section: Section, id: string): Promise<{ area: AreaRow; tables: TableRow[] }> {
    await this.areaInScope(restaurantId, section, id);
    const layout = readLayout(await this.repo.readDefaultLayout(id));
    if (!layout) throw createHttpError(409, 'This area has no saved default layout');
    return this.repo.restoreLayout(id, layout);
  }

  async createTable(restaurantId: string, section: Section, payload: TableData): Promise<TableRow> {
    await this.areaInScope(restaurantId, section, payload.hallId);
    await this.assertLabelFree(payload.hallId, payload.label);
    return this.repo.createTable(payload);
  }

  async updateTable(restaurantId: string, section: Section, id: string, payload: Partial<TableData>): Promise<TableRow> {
    const table = await this.tableInScope(restaurantId, section, id);
    const hallId = payload.hallId ?? table.hallId;
    // Moving to another area names a second id, and it is checked like the first.
    if (hallId !== table.hallId) await this.areaInScope(restaurantId, section, hallId);
    // A label is unique within its area, so both a rename and a move can collide.
    if (payload.label !== undefined || hallId !== table.hallId) {
      await this.assertLabelFree(hallId, payload.label ?? table.label, id);
    }
    return this.repo.updateTable(id, payload);
  }

  async deleteTable(restaurantId: string, section: Section, id: string): Promise<void> {
    await this.tableInScope(restaurantId, section, id);
    await this.repo.deleteTable(id);
  }
}
