import { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { dayKey } from '../../utils/floorBooking.js';
import { readLayout } from './floorMap.layout.js';
import { FloorMapRepository } from './floorMap.repository.js';

// ── The nightly layout reset ────────────────────────────────────────────────
// An evening moves the tables about. Every area that has a saved default
// layout is put back to it at the start of each new day, so a room always
// opens the way it is meant to stand rather than the way last night left it.
//
// Expressed as "has this area been reset FOR today?" and swept often, not as a
// timer that fires at midnight. `deploy.sh` restarts pm2 on every deploy,
// which would reset a midnight timer and quietly skip a day; and a process
// that was down overnight would miss the moment entirely. A day stamp compared
// against today is restart-proof: whenever the API is up, anything not yet
// done for today gets done, and doing it twice is a no-op.
//
// **The day boundary is UTC**, the same one `dayKey` uses for occupancy, so an
// area's reset and its bookings agree about which day it is. For this
// product's market (UTC+5) that lands in the small hours of the morning —
// after the evening it is clearing up after, and before anyone is seated.

/** How often the sweep looks. Cheap: one indexed read that usually matches nothing. */
const SWEEP_INTERVAL_MS = 15 * 60 * 1000;

/** Wait this long after boot, so a deploy is not competing with the sweep. */
const FIRST_SWEEP_DELAY_MS = 60 * 1000;

export type ResetOutcome = {
  hallId: string;
  name: string;
  /** Tables kept because a booking from today onward still holds them. */
  kept: string[];
};

/**
 * Put every area that has a saved default back to it, once per day.
 *
 * Areas with **no saved default are left alone** — there is nothing to put
 * them back to, and emptying a room would be the worst possible reading of
 * "reset". A stored layout that is not a usable one is skipped for the same
 * reason, and its day is still stamped so a corrupt row cannot make the sweep
 * retry it every quarter of an hour for ever.
 */
export async function resetLayoutsForDay(
  now = new Date(),
  repo = new FloorMapRepository(),
): Promise<ResetOutcome[]> {
  const today = dayKey(now);
  if (!today) return [];

  const due = await prisma.hall.findMany({
    where: {
      defaultLayout: { not: Prisma.DbNull },
      OR: [{ lastLayoutResetDay: null }, { lastLayoutResetDay: { not: today } }],
    },
    select: { id: true, name: true },
  });

  const done: ResetOutcome[] = [];
  for (const hall of due) {
    // One area at a time, each in its own transaction: a venue with a broken
    // layout must not stop the rooms after it being put back.
    try {
      const layout = readLayout(await repo.readDefaultLayout(hall.id));
      if (layout) {
        // Bookings from the start of today onward keep their tables — putting
        // the room back must never cancel somebody's evening.
        const { kept } = await repo.restoreLayout(hall.id, layout, startOfDay(now));
        done.push({ hallId: hall.id, name: hall.name, kept });
      }
      await prisma.hall.update({ where: { id: hall.id }, data: { lastLayoutResetDay: today } });
    } catch (error) {
      console.error(`[floor-map] daily reset failed for area ${hall.id}`, error);
    }
  }
  return done;
}

/** Midnight UTC of the day `now` falls in — the cutoff bookings are protected from. */
export function startOfDay(now: Date): Date {
  return new Date(`${dayKey(now)}T00:00:00.000Z`);
}

let timer: NodeJS.Timeout | null = null;

/** Starts the sweep. Called once from server startup; safe to call twice. */
export function startFloorLayoutResetSweep(): void {
  if (timer) return;

  const run = () => {
    resetLayoutsForDay()
      .then((done) => {
        if (done.length === 0) return;
        console.log(`[floor-map] put ${done.length} area(s) back to their default layout`);
        for (const area of done) {
          if (area.kept.length > 0) {
            // Said out loud: the room is NOT fully back to its default, and
            // the reason is somebody's booking.
            console.log(`[floor-map] "${area.name}" kept booked table(s): ${area.kept.join(', ')}`);
          }
        }
      })
      // Housekeeping must never take the API down; the next pass picks up
      // whatever this one missed.
      .catch((error) => console.error('[floor-map] daily reset sweep failed', error));
  };

  setTimeout(() => {
    run();
    timer = setInterval(run, SWEEP_INTERVAL_MS);
    timer.unref?.();
  }, FIRST_SWEEP_DELAY_MS).unref?.();
}
