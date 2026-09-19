import createHttpError from 'http-errors';
import { prisma } from '../../db/prisma.js';
import {
  SHELL_COLUMNS, fromRow, shellPatchSchema, toColumns, type ShellSettings, type ShellSystem,
} from './shellSettings.rules.js';

export type ShellRepo = {
  /** Only the named columns of one restaurant. */
  read(restaurantId: string, columns: string[]): Promise<Record<string, unknown> | null>;
  write(restaurantId: string, data: Record<string, boolean | string | null>, columns: string[]): Promise<Record<string, unknown>>;
};

const columnsOf = (system: ShellSystem) => Object.values(SHELL_COLUMNS[system]);
const select = (columns: string[]) => Object.fromEntries(columns.map((c) => [c, true]));

export const prismaShellRepo: ShellRepo = {
  async read(restaurantId, columns) {
    return prisma.restaurant.findUnique({ where: { id: restaurantId }, select: select(columns) }) as Promise<Record<string, unknown> | null>;
  },
  async write(restaurantId, data, columns) {
    return prisma.restaurant.update({ where: { id: restaurantId }, data, select: select(columns) }) as Promise<Record<string, unknown>>;
  },
};

export class ShellSettingsService {
  constructor(private readonly repo: ShellRepo = prismaShellRepo) {}

  async get(restaurantId: string, system: ShellSystem): Promise<ShellSettings> {
    // Reads only this system's columns, so the other system's settings never
    // even reach the response.
    const row = await this.repo.read(restaurantId, columnsOf(system));
    if (!row) throw createHttpError(404, 'Restaurant not found');
    return fromRow(system, row);
  }

  async save(restaurantId: string, system: ShellSystem, body: unknown): Promise<ShellSettings> {
    const parsed = shellPatchSchema(system).safeParse(body ?? {});
    if (!parsed.success) throw createHttpError(400, parsed.error.issues[0]?.message ?? 'Invalid settings');
    const data = toColumns(system, parsed.data);
    if (Object.keys(data).length === 0) return this.get(restaurantId, system);
    return fromRow(system, await this.repo.write(restaurantId, data, columnsOf(system)));
  }
}
