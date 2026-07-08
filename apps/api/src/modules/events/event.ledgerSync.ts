import { AdminRole } from '@prisma/client';
import { prisma } from '../../db/prisma.js';

// When a restaurant admin creates an event, mirror it into the assigned
// restaurant manager's expense ledger as that day's department booking:
//   morning   → Nahor
//   afternoon → Fotiha
//   evening   → Wedding (TUI)
// filling the booking title (customer name), guest count and cost per person.

// Uzbekistan is UTC+5 year-round (no DST). Events are entered in Tashkent local
// time by the browser and stored as a UTC instant, so we shift by +5h to recover
// the wall-clock hour/date the admin actually chose (independent of server TZ).
const UZ_OFFSET_MS = 5 * 60 * 60 * 1000;

type LedgerType = 'NAHOR' | 'FOTIHA' | 'TUI';
const DAY_DEPARTMENTS = ['NAHOR', 'FOTIHA', 'TUI', 'OTHERS'] as const;

// morning < 12:00 · afternoon 12:00–16:59 · evening ≥ 17:00
function departmentForHour(hour: number): LedgerType {
  if (hour < 12) return 'NAHOR';
  if (hour < 17) return 'FOTIHA';
  return 'TUI';
}

type SyncableEvent = {
  restaurantId: string | null;
  customerName: string;
  eventDate: Date;
  guestCount: number;
  tableCategory?: { ratePerPerson: number } | null;
};

// Best-effort: this must never throw, so a ledger hiccup can't fail the event
// creation that triggered it. Skips silently when there's nothing to mirror
// (no restaurant, no assigned manager, or a still-blank event with no name).
export async function syncEventToLedger(event: SyncableEvent): Promise<void> {
  try {
    if (!event.restaurantId) return; // blank/unassigned event — nothing to mirror
    const bookingName = event.customerName?.trim();
    if (!bookingName) {
      console.info('[ledger-sync] skipped: event has no customer name yet.');
      return;
    }

    const manager = await prisma.adminUser.findFirst({
      where: { role: AdminRole.RESTAURANT_MANAGER, restaurantId: event.restaurantId },
      select: { id: true }
    });
    if (!manager) {
      console.info(`[ledger-sync] skipped: no RESTAURANT_MANAGER is assigned to restaurant ${event.restaurantId}. Assign one so its events feed the ledger.`);
      return;
    }

    const local = new Date(event.eventDate.getTime() + UZ_OFFSET_MS);
    const date = local.toISOString().slice(0, 10); // YYYY-MM-DD (Tashkent)
    const type = departmentForHour(local.getUTCHours());

    // Ledger amounts are whole so'm; the per-person rate is stored in tiyin.
    const pricePerGuestSum = Math.round((event.tableCategory?.ratePerPerson ?? 0) / 100);

    // Ensure the day exists (with its four departments), then fill the booking.
    const day = await prisma.expenseDay.upsert({
      where: { managerId_date: { managerId: manager.id, date } },
      update: {},
      create: {
        managerId: manager.id,
        date,
        events: { create: DAY_DEPARTMENTS.map((t) => ({ type: t })) }
      },
      include: { events: { select: { id: true, type: true } } }
    });

    const dept = day.events.find((e) => e.type === type);
    if (!dept) return;

    await prisma.dayEvent.update({
      where: { id: dept.id },
      data: { bookingName, guestCount: event.guestCount, pricePerGuestSum }
    });
    console.info(`[ledger-sync] mirrored "${bookingName}" into manager ${manager.id} ledger — ${date} / ${type} (${event.guestCount} guests).`);
  } catch (err) {
    console.error('[ledger-sync] failed to mirror event into the expense ledger:', err);
  }
}
