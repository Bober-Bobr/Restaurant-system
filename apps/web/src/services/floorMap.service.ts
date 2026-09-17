import type { AreaKind, AreaLayout, FloorMap, MapArea, MapTable, TableShape } from '../utils/floorMap';
import { httpClient } from './http';

export type TablePayload = {
  hallId: string;
  label: string;
  seats: number;
  shape: TableShape;
  x: number;
  y: number;
  rotation?: number;
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
  async createArea(payload: { name: string; kind: AreaKind; capacity: number } & AreaLayout) {
    const { data } = await httpClient.post<MapArea>('/floor-map/areas', payload);
    return data;
  },
  async updateArea(id: string, payload: Partial<AreaLayout & { name: string; kind: AreaKind }>) {
    const { data } = await httpClient.patch<MapArea>(`/floor-map/areas/${id}`, payload);
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
