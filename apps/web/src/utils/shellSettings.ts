import type { AdminRole } from '../store/auth.store';

/**
 * Shell settings on the web side — the visual effects of the two guest-facing
 * shells, and which role switches which.
 *
 *   tablet    the banquet kiosk            — the main admin (ADMIN)
 *   catering  the public catering site     — the food admin (CATERING_ADMIN)
 *             (v-menu.uz/<slug> and test.v-menu.uz/<slug> alike)
 *
 * The two never interact. The server decides which set a save writes, from the
 * role (apps/api/src/modules/shellSettings/shellSettings.rules.ts); here each
 * surface READS only its own fields — `tabletShell` never looks at a catering*
 * field and `cateringShell` never at a tablet* one — so even a payload carrying
 * both cannot leak one system's switch into the other.
 * `shellSettingsAgreement.test.ts` holds the role map to the API's.
 */

export type ShellSystem = 'tablet' | 'catering';

export type ShellSettings = {
  animations: boolean;
  music: boolean;
  trail: boolean;
  /** A ParticleKind; 'none' for no particles. */
  particles: string;
};

/** Offered on the Settings page. 'custom' (an uploaded image) is the manager portal's, for the tablet only. */
export const PARTICLE_CHOICES = ['none', 'confetti', 'birthday', 'snow', 'candy', 'hearts'] as const;

/**
 * The class a shell's root carries when appearance animations are off. See
 * `.fx-still` in index.css: it FAST-FORWARDS the animations rather than
 * removing them, because a revealed block's visible state is the end of its
 * keyframes.
 */
export const STILL_CLASS = 'fx-still';

type TabletFields = {
  tabletAnimations?: boolean | null;
  tabletMusic?: boolean | null;
  tabletTrail?: boolean | null;
  tabletParticles?: string | null;
};

type CateringFields = {
  cateringAnimations?: boolean | null;
  cateringMusic?: boolean | null;
  cateringTrail?: boolean | null;
  cateringParticles?: string | null;
};

// `!== false`: a payload from before the columns existed — a stale API, a
// cached response — reads as ON, which is what both shells did then.
const on = (v: boolean | null | undefined) => v !== false;
const kind = (v: string | null | undefined) => (v && v !== 'none' ? v : 'none');

/** The tablet's settings. Reads tablet* fields only. */
export function tabletShell(r: TabletFields | null | undefined): ShellSettings {
  return { animations: on(r?.tabletAnimations), music: on(r?.tabletMusic), trail: on(r?.tabletTrail), particles: kind(r?.tabletParticles) };
}

/** The catering site's settings. Reads catering* fields only. */
export function cateringShell(r: CateringFields | null | undefined): ShellSettings {
  return { animations: on(r?.cateringAnimations), music: on(r?.cateringMusic), trail: on(r?.cateringTrail), particles: kind(r?.cateringParticles) };
}

/**
 * The shell a role's Settings page offers. The web copy of the API's rule —
 * an explicit map, so a role added later shows no shell block until somebody
 * decides. The SUPERVISOR has none: their kiosk is the main admin's tablet.
 */
const SHELL_SYSTEMS: Partial<Record<NonNullable<AdminRole>, ShellSystem[]>> = {
  ADMIN: ['tablet'],
  CATERING_ADMIN: ['catering'],
  CHIEF_ADMIN: ['tablet', 'catering'],
  OWNER: ['tablet', 'catering'],
};

export function shellSystemsFor(role: AdminRole | null | undefined): ShellSystem[] {
  return (role && SHELL_SYSTEMS[role]) || [];
}
