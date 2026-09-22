import type { AreaKind, AreaSize, FloorMap, MapArea, MapTable, TableShape } from '../utils/floorMap';
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
  async updateArea(id: string, payload: Partial<AreaSize & { name: string; kind: AreaKind }>) {
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
