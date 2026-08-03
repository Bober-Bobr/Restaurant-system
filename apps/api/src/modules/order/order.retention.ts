import { prisma } from '../../db/prisma.js';

// ── Closed-order retention ──────────────────────────────────────────────────
// Closed orders are kept and stay viewable — the Statistics page reads them, and
// a restaurant wants last month's and last quarter's numbers. They are cleaned
// up a year after closing.
//
// "Once a year" is expressed as a RETENTION PERIOD swept daily, not as an annual
// timer. A `setInterval` of 365 days inside the API process would in practice
// never fire: `deploy.sh` restarts pm2 on every deploy, which resets the timer,
// so the cleanup would silently never happen. A short sweep against an absolute
// cutoff is restart-proof — whenever the process is up, anything past a year is
// removed, and nothing accumulates if it was down.

/** How long a closed order is kept before it is purged. */
export const RETENTION_MS = 365 * 24 * 60 * 60 * 1000;

/** How often the sweep looks. Cheap: one indexed DELETE that usually matches nothing. */
const SWEEP_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** Wait this long after boot so a deploy is not competing with a delete. */
const FIRST_SWEEP_DELAY_MS = 5 * 60 * 1000;

export function retentionCutoff(now = new Date()): Date {
  return new Date(now.getTime() - RETENTION_MS);
}

/**
 * Delete orders that closed more than a year ago. `OrderItem` rows go with them
 * via `ON DELETE CASCADE`.
 *
 * Only CLOSED and CANCELLED orders are eligible. A PENDING or OPEN order is
 * never purged on age alone — one still sitting open after a year means
 * something went wrong, and deleting it would destroy the evidence.
 */
export async function purgeExpiredOrders(now = new Date()): Promise<number> {
  const { count } = await prisma.order.deleteMany({
    where: {
      status: { in: ['CLOSED', 'CANCELLED'] },
      closedAt: { not: null, lt: retentionCutoff(now) },
    },
  });
  return count;
}

let timer: NodeJS.Timeout | null = null;

/** Starts the daily sweep. Called once from server startup; safe to call twice. */
export function startOrderRetentionSweep(): void {
  if (timer) return;

  const run = () => {
    purgeExpiredOrders()
      .then((count) => {
        if (count > 0) console.log(`[orders] retention sweep removed ${count} order(s) closed over a year ago`);
      })
      // A failed sweep must never take the API down — it is housekeeping, and
      // the next pass will pick up whatever this one missed.
      .catch((error) => console.error('[orders] retention sweep failed', error));
  };

  const first = setTimeout(() => {
    run();
    timer = setInterval(run, SWEEP_INTERVAL_MS);
    timer.unref?.();
  }, FIRST_SWEEP_DELAY_MS);
  first.unref?.();
}
