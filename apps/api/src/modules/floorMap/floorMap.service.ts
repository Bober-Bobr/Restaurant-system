import createHttpError from 'http-errors';
import type { Section } from '../../utils/section.js';
import { occupancyOf, wholeAreaAvailable } from '../../utils/floorBooking.js';
import type {
  AreaKind, AreaPatch, AreaRow, AreaSize, FloorMapRepository, TableData, TableRow,
} from './floorMap.repository.js';

type Repo = Pick<FloorMapRepository, keyof FloorMapRepository>;

/** Midnight UTC at the start of the day `now` falls in — where "from today onward" begins. */
export const startOfDay = (now: Date) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

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

  /** Unique within ONE layout of the area — the standing one, or one day's. */
  private async assertLabelFree(hallId: string, day: string | null, label: string, exceptId?: string) {
    const taken = (await this.repo.labelsInArea(hallId, day))
      .some((row) => row.id !== exceptId && row.label.toLowerCase() === label.toLowerCase());
    // Case-folded: "vip 1" and "VIP 1" are the same table when read aloud, and
    // the database's unique index would let both in.
    if (taken) throw createHttpError(409, 'A table with this number already exists in this area');
  }

  /**
   * The areas and the tables a day is drawn from. With no day, the STANDING
   * layout — the default every day shows, and what the two layout editors
   * change. With a day, each area's own layout for that day where it has one
   * (`dayLayouts` names those areas), else the standing one.
   */
  async getMap(restaurantId: string, section: Section, day?: string) {
    const [areas, tables, dayLayouts] = await Promise.all([
      this.repo.listAreas(restaurantId, section),
      this.repo.listTables(restaurantId, section, day),
      day ? this.repo.dayLayoutHalls(restaurantId, section, day) : Promise.resolve([] as string[]),
    ]);
    return { areas, tables, dayLayouts };
  }

  /**
   * Give an area a layout of its own on one day — what the booking wizard
   * asks for before its first change to the tables, so the change touches that
   * day alone. See `FloorMapRepository.forkDay`.
   */
  async forkDay(restaurantId: string, section: Section, hallId: string, day: string) {
    await this.areaInScope(restaurantId, section, hallId);
    return this.repo.forkDay(hallId, day);
  }

  // ── Bookings on the map ───────────────────────────────────────────────────

  /**
   * What is taken on a day. The map draws from this: a table with a booking
   * against it is drawn as taken, and an area somebody has reserved whole is
   * drawn as a whole.
   *
   * The DAY is the unit because a booking holds its tables for the whole of
   * the day it falls on — see utils/floorBooking.ts.
   *
   * The list includes bookings that merely NAME an area and hold no table:
   * they are what the Events page creates, and the map has to show them or an
   * evening the restaurant has sold is nowhere on the picture of that day.
   */
  async getDay(restaurantId: string, section: Section, day: string) {
    const bookings = await this.repo.bookingsOnDay(restaurantId, section, day);
    const tablesByHall = await this.repo.tableIdsByHall(restaurantId, section, day);
    // Which areas could still be taken whole, so the map does not offer a
    // button that the save would then refuse. Built by the shared reader, not
    // by hand here, so "what is taken" cannot mean two things.
    const occupancy = occupancyOf(bookings);
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
      this.repo.tablesInArea(id, day),
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

  async createTable(restaurantId: string, section: Section, payload: TableData): Promise<TableRow> {
    await this.areaInScope(restaurantId, section, payload.hallId);
    const day = payload.day ?? null;
    // A table added on one day's layout needs that layout to exist first, or
    // the day would show this one table and none of the standing ones.
    if (day) await this.repo.forkDay(payload.hallId, day);
    await this.assertLabelFree(payload.hallId, day, payload.label);
    return this.repo.createTable({ ...payload, day });
  }

  async updateTable(restaurantId: string, section: Section, id: string, payload: Partial<TableData>): Promise<TableRow> {
    const table = await this.tableInScope(restaurantId, section, id);
    const hallId = payload.hallId ?? table.hallId;
    // A table in one day's layout belongs to that day of THAT area; carrying it
    // into another area would put it in a layout the other area may not have.
    if (hallId !== table.hallId && table.day) {
      throw createHttpError(400, 'A table in one day\'s layout cannot be moved to another area');
    }
    // Moving to another area names a second id, and it is checked like the first.
    if (hallId !== table.hallId) await this.areaInScope(restaurantId, section, hallId);
    // A label is unique within its layout, so both a rename and a move can collide.
    if (payload.label !== undefined || hallId !== table.hallId) {
      await this.assertLabelFree(hallId, table.day, payload.label ?? table.label, id);
    }
    return this.repo.updateTable(id, payload);
  }

  async deleteTable(restaurantId: string, section: Section, id: string): Promise<void> {
    await this.tableInScope(restaurantId, section, id);
    await this.repo.deleteTable(id);
  }

  /**
   * Merge several tables into one — the staff pushing two four-tops together
   * for a party of eight, and saying so on the map.
   *
   * The merged table's size and seat count come from the browser, which is
   * where the layout geometry lives (`mergeTables` in utils/floorMap.ts: the
   * capacity is the SUM of the merged tables'). Three things cannot be left to
   * it, and they are all this does:
   *
   *   · **every id is re-checked against restaurant AND section**, like every
   *     other path here, and a merge names as many ids as the caller likes;
   *   · **they must all be in ONE area.** A merge across rooms is not a
   *     rearrangement, it is a table teleporting — and it would leave the other
   *     room with tables silently deleted from a map nobody was looking at;
   *   · **the FIRST id is the table that stays.** It keeps its row and its
   *     number, so the bookings already on it are untouched; the others are
   *     deleted, and the repository refuses if a booking from today onward
   *     still holds one of them.
   */
  async mergeTables(
    restaurantId: string,
    section: Section,
    payload: {
      tableIds: string[]; seats: number; x: number; y: number;
      width: number; height: number; rotation: number;
    },
  ): Promise<TableRow> {
    const [keepId, ...removeIds] = payload.tableIds;
    const rows = await Promise.all(payload.tableIds.map((id) => this.tableInScope(restaurantId, section, id)));
    const hallId = rows[0].hallId;
    if (rows.some((row) => row.hallId !== hallId)) {
      throw createHttpError(400, 'All the tables being merged must be in the same area');
    }
    // And in the same LAYOUT of it: a standing table and one day's copy are
    // two different pieces of furniture as far as any day is concerned.
    if (rows.some((row) => row.day !== rows[0].day)) {
      throw createHttpError(400, 'All the tables being merged must be in the same day\'s layout');
    }
    const { table, blocked } = await this.repo.mergeTables(
      keepId,
      removeIds,
      {
        seats: payload.seats,
        // Pinned here rather than taken from the body: a merged table is a
        // rectangle, and two sides each holding that fact can disagree.
        shape: 'RECT',
        x: payload.x,
        y: payload.y,
        rotation: payload.rotation,
        width: payload.width,
        height: payload.height,
      },
      startOfDay(new Date()),
    );
    if (!table) {
      // Named, like a booking clash on the map: "unavailable" alone sends
      // somebody away from the desk to find out which table and whose evening.
      throw createHttpError(409, `These tables are booked and cannot be merged away: ${blocked.join(', ')}`);
    }
    return table;
  }
}
