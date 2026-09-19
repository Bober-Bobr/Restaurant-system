import { AdminRole } from '@prisma/client';
import { z } from 'zod';

/**
 * Shell settings — the visual effects of the two guest-facing shells:
 *
 *   tablet    the banquet kiosk, switched by the main admin (ADMIN)
 *   catering  the public catering site (v-menu.uz/<slug> and test.v-menu.uz),
 *             switched by the food admin (CATERING_ADMIN)
 *
 * The two must never interact, and that is a property of this file rather than
 * of the Settings page:
 *
 *   · each system has its OWN columns (`SHELL_COLUMNS`), so there is no shared
 *     value one save could overwrite for the other;
 *   · which system a request writes is decided from the CALLER'S ROLE — the
 *     same rule as the Small Banquets section — so a main admin sending
 *     `?system=catering` still reaches the tablet, and nothing else;
 *   · `toColumns` only ever produces the columns of the system it was given,
 *     which the tests hold exhaustively.
 *
 * Hiding the other block on the page would be presentation. This is the
 * permission.
 */

export const SHELL_SYSTEMS = ['tablet', 'catering'] as const;
export type ShellSystem = (typeof SHELL_SYSTEMS)[number];

export const isShellSystem = (value: unknown): value is ShellSystem =>
  value === 'tablet' || value === 'catering';

/** The same kinds the tablet's `tabletParticles` and the block designer use. */
export const PARTICLE_KINDS = ['none', 'confetti', 'birthday', 'snow', 'candy', 'hearts', 'custom'] as const;

export type ShellSettings = {
  /** Blocks fading/rising into place as they appear. */
  animations: boolean;
  music: boolean;
  /** The cursor/finger trail. */
  trail: boolean;
  /** A ParticleKind; 'none' for no falling particles. */
  particles: string;
};

export const SHELL_COLUMNS = {
  tablet: { animations: 'tabletAnimations', music: 'tabletMusic', trail: 'tabletTrail', particles: 'tabletParticles' },
  catering: { animations: 'cateringAnimations', music: 'cateringMusic', trail: 'cateringTrail', particles: 'cateringParticles' },
} as const;

type SettingKey = keyof ShellSettings;

/**
 * The system a role's Settings page switches, or null for a role that has no
 * shell to switch.
 *
 * The SUPERVISOR is deliberately absent. Their kiosk is the same tablet the
 * main admin configures (the restaurant has one set of tablet columns), and
 * giving a second role the same switches would be two people fighting over one
 * setting.
 */
const PINNED: Partial<Record<AdminRole, ShellSystem>> = {
  [AdminRole.ADMIN]: 'tablet',
  [AdminRole.CATERING_ADMIN]: 'catering',
};

/** Platform roles may name either system — they already reach both products. */
const PLATFORM: AdminRole[] = [AdminRole.CHIEF_ADMIN, AdminRole.OWNER];

export function shellSystemsFor(role: AdminRole | undefined | null): ShellSystem[] {
  if (!role) return [];
  const pinned = PINNED[role];
  if (pinned) return [pinned];
  return PLATFORM.includes(role) ? [...SHELL_SYSTEMS] : [];
}

/** The system a request is for: the caller's own if pinned, else what a platform role asked for. */
export function resolveShellSystem(role: AdminRole | undefined | null, requested: unknown): ShellSystem | null {
  if (!role) return null;
  const pinned = PINNED[role];
  if (pinned) return pinned;
  if (PLATFORM.includes(role) && isShellSystem(requested)) return requested;
  return null;
}

/**
 * The request body. `.strict()`: a body naming another system's column by
 * accident (`cateringMusic` sent to the tablet) is refused rather than silently
 * dropped — a silent drop would look like a save that worked.
 */
export function shellPatchSchema(system: ShellSystem) {
  // The catering site has no custom-image particle: its image field exists only
  // for the tablet, in the manager portal.
  const kinds = system === 'tablet' ? PARTICLE_KINDS : PARTICLE_KINDS.filter((k) => k !== 'custom');
  return z.object({
    animations: z.boolean().optional(),
    music: z.boolean().optional(),
    trail: z.boolean().optional(),
    particles: z.enum(kinds as [string, ...string[]]).optional(),
  }).strict();
}

/** A patch as this system's columns — and only this system's. 'none' is stored as null. */
export function toColumns(system: ShellSystem, patch: Partial<ShellSettings>): Record<string, boolean | string | null> {
  const columns = SHELL_COLUMNS[system];
  const data: Record<string, boolean | string | null> = {};
  for (const key of Object.keys(columns) as SettingKey[]) {
    const value = patch[key];
    if (value === undefined) continue;
    data[columns[key]] = key === 'particles' ? (value === 'none' ? null : (value as string)) : (value as boolean);
  }
  return data;
}

/** This system's settings, read from a restaurant row. */
export function fromRow(system: ShellSystem, row: Record<string, unknown>): ShellSettings {
  const c = SHELL_COLUMNS[system];
  // `!== false`: a row from before the migration reads as ON, which it was.
  return {
    animations: row[c.animations] !== false,
    music: row[c.music] !== false,
    trail: row[c.trail] !== false,
    particles: typeof row[c.particles] === 'string' && row[c.particles] ? (row[c.particles] as string) : 'none',
  };
}
