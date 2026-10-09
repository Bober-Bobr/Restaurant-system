import type { AreaKind, AreaSize, FloorMap, MapArea, MapFeature, MapTable, TableShape } from '../utils/floorMap';
import type { MapBooking } from '../utils/floorBooking';
import { httpClient } from './http';

export type TablePayload = {
  hallId: string;
  label: string;
  seats: number;
  shape: TableShape;
  x: number;
  y: number;
  rotation?: number;
  /** Null = back to the size its seats call for. */
  width?: number | null;
  height?: number | null;
};

/**
 * The Small Banquets floor map. No section parameter: the server derives it
 * from the supervisor's role, as it does for halls and events.
 */
export const floorMapService = {
  async get() {
    const { data } = await httpClient.get<FloorMap>('/floor-map');
    return data;
  },
  async createArea(payload: { name: string; kind: AreaKind; capacity: number } & AreaSize) {
    const { data } = await httpClient.post<MapArea>('/floor-map/areas', payload);
    return data;
  },
  /**
   * An area's own fields, and its DRAWING.
   *
   * `mapFeatures` is sent as the whole array, because that is the column: there
   * is no per-shape endpoint and adding one would mean inventing ids for
   * shapes that have none. The consequence is worth knowing — one bad shape is
   * a 400 that refuses the whole drawing — which is why the editor is held to
   * the server's own bounds in utils/floorFeatures.ts.
   */
  async updateArea(id: string, payload: Partial<AreaSize & { name: string; kind: AreaKind; mapFeatures: MapFeature[] }>) {
    const { data } = await httpClient.patch<MapArea>(`/floor-map/areas/${id}`, payload);
    return data;
  },
  /** Remember this area exactly as it stands — tables, map size and drawing. */
  async saveDefaultLayout(id: string) {
    const { data } = await httpClient.post<MapArea>(`/floor-map/areas/${id}/default`, {});
    return data;
  },
  /** Put the area back to that saved layout. Its current tables are replaced. */
  async restoreDefaultLayout(id: string) {
    const { data } = await httpClient.post<{ area: MapArea; tables: MapTable[] }>(`/floor-map/areas/${id}/restore`, {});
    return data;
  },
  /**
   * What is taken on a day. The unit is a DAY because a booking holds its
   * tables for the whole of the one it falls on (utils/floorBooking.ts).
   */
  async day(date: string) {
    const { data } = await httpClient.get<{ day: string; bookings: MapBooking[]; wholeAreaFree: Record<string, boolean> }>(
      '/floor-map/day', { params: { date } },
    );
    return data;
  },
  /** The schedule between two days — past and future alike. */
  async schedule(from: string, to: string) {
    const { data } = await httpClient.get<{ from: string; to: string; bookings: MapBooking[] }>(
      '/floor-map/schedule', { params: { from, to } },
    );
    return data;
  },
  /**
   * The printable plan of one area for one day, as a PDF blob.
   *
   * The LANGUAGE and the reader's TIMEZONE go with the request. The sheet is
   * translated whole on the server and cannot be switched once it is on paper,
   * and a booking's time is stored as an instant — printed as UTC a 19:00
   * banquet came out as 14:00.
   */
  async printArea(id: string, date: string, lang: string) {
    const { data } = await httpClient.get<Blob>(`/floor-map/areas/${id}/print`, {
      params: { date, lang, tz: -new Date().getTimezoneOffset() }, responseType: 'blob',
    });
    return data;
  },
  async createTable(payload: TablePayload) {
    const { data } = await httpClient.post<MapTable>('/floor-map/tables', payload);
    return data;
  },
  async updateTable(id: string, payload: Partial<TablePayload>) {
    const { data } = await httpClient.patch<MapTable>(`/floor-map/tables/${id}`, payload);
    return data;
  },
  async removeTable(id: string) {
    await httpClient.delete(`/floor-map/tables/${id}`);
  },
};
