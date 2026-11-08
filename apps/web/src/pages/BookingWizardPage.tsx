import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { floorMapService } from '../services/floorMap.service';
import { eventService } from '../services/event.service';
import { orderService } from '../services/order.service';
import { useAdminStore } from '../store/admin.store';
import { useAuthStore } from '../store/auth.store';
import { useTabletStore } from '../store/tablet.store';
import { useSessionDraft } from '../hooks/useSessionDraft';
import { dayKey } from '../utils/floorBooking';
import { translate } from '../utils/translate';
import { FloorMapPage, type MenuKind } from './FloorMapPage';
import { SmallBanquetOrderSheet, type OrderDraft } from './SmallBanquetOrderSheet';

/**
 * Taking a Small Banquets booking — a page of its own, in four stages.
 *
 *   1. Type of event — Banquet · Service order · Decide later
 *   2. Booking details — who, when, how many, which area
 *   3. Tables — the floor map, FULL SCREEN: reserve, re-seat, move, add,
 *      delete and merge tables
 *   4. Menu — what the type chose: the kiosk's banquet planner, the
 *      service-order basket (a menu with a cart), or straight back to the map
 *
 * It used to be a panel beside the plan, with the type asked LAST among the
 * fields. Asking it first is the point of the reorder: the type decides what
 * the whole booking leads to, and the stage list can only name stage 4 once it
 * is known.
 *
 * **The booking is created at the end of stage 3**, before any menu — exactly
 * as before. An order belongs to a booking (its `eventId`), and a supervisor
 * who abandons the basket still has the evening in the book, which is why the
 * menu is optional at all. So nothing typed in stages 1–2 reaches the server,
 * and leaving before stage 3's button writes nothing.
 *
 * **The whole wizard is a FULL-SCREEN page**: it is mounted OUTSIDE the
 * section's layout (App.tsx), so neither the masthead nor the rail of admin
 * pages is on screen while a booking is taken — those are a dozen ways out of
 * a job half done. The page wears the section's look itself (`adm-bg
 * svr-theme` on its root), and the way out is its own close button.
 *
 * **Stage 3 is the real floor map**, handed a `flow` (see `BookingFlow` in
 * FloorMapPage.tsx) rather than a copy of its table tools, and it fits the
 * whole plan to the screen.
 *
 * **Every stage shows the numbered stage list and a tip**, including the last
 * one: the basket takes the `steps` slot of the order sheet, and the banquet
 * hand-over shows its own stage-4 screen for the moment before the kiosk
 * opens.
 *
 * The draft lives in session storage, so a reload or a browser Back mid-way
 * does not throw the typing away — and a reload on stage 4 reopens the basket
 * for the booking already created rather than creating a second one.
 */

/** 'skip' is "decide later"; null is "not chosen yet". */
type WizardKind = 'banquet' | 'dining' | 'skip' | null;
type Stage = 1 | 2 | 3 | 4;

type Draft = {
  stage: Stage;
  kind: WizardKind;
  name: string;
  phone: string;
  day: string;
  time: string;
  /** Kept as typed; parsed only when it is used. */
  guests: string;
  hallId: string;
  /** Set once stage 3 has created the booking — never create it twice. */
  created: { eventNumber: number; hallId: string; guests: number } | null;
};

const DRAFT_KEY = 'vmenu-booking-wizard';
const STAGES: Stage[] = [1, 2, 3, 4];

const freshDraft = (): Draft => ({
  stage: 1, kind: null, name: '', phone: '', day: dayKey(new Date()), time: '19:00', guests: '', hallId: '', created: null,
});

const toMenuKind = (kind: WizardKind): MenuKind => (kind === 'banquet' || kind === 'dining' ? kind : null);

/** A typed head count, or null — nothing, nonsense and zero all mean "the tables decide". */
export const parseGuests = (raw: string): number | null => {
  const n = Number(raw.replace(/\s/g, ''));
  return Number.isInteger(n) && n > 0 ? n : null;
};

const errorText = (error: unknown) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message
  ?? (error as Error)?.message
  ?? 'Error';

type TFn = (key: Parameters<typeof translate>[0], params?: Record<string, string | number>) => string;

/** Stage 4's name follows the type, because that is what stage 4 IS. */
const stageTitle = (stage: Stage, kind: WizardKind, t: TFn) =>
  stage === 1 ? t('bw_stage_type')
    : stage === 2 ? t('bw_stage_details')
    : stage === 3 ? t('bw_stage_tables')
    : kind === 'banquet' ? t('bw_stage_menu_banquet')
    : kind === 'dining' ? t('bw_stage_menu_dining')
    : kind === 'skip' ? t('bw_stage_menu_skip')
    : t('bw_stage_menu');

const stageTip = (stage: Stage, kind: WizardKind, t: TFn) =>
  stage === 1 ? t('bw_tip_type')
    : stage === 2 ? t('bw_tip_details')
    : stage === 3 ? t('bw_tip_tables')
    : kind === 'dining' ? t('bw_tip_menu_dining')
    : t('bw_tip_menu_banquet');

/**
 * The numbered stages, with each stage's name as its heading, and the tip for
 * the stage being done. One component for all four, so the list cannot read
 * differently on the plan from how it reads on the form before it.
 */
export const BookingStages = ({ stage, kind, t, onClose }: { stage: Stage; kind: WizardKind; t: TFn; onClose?: () => void }) => (
  <div className="bw-stages-wrap">
    <div className="bw-stages-top">
      <h1 className="adm-title bw-title">{t('bw_title')}</h1>
      <span className="bw-step-of">{t('bw_step_of', { n: stage, total: STAGES.length })}</span>
      {/* The page has no header, so this is the way out. */}
      {onClose && (
        <button type="button" className="adm-btn-ghost bw-close" onClick={onClose} aria-label={t('bw_close')}>
          ✕ <span>{t('bw_close')}</span>
        </button>
      )}
    </div>
    <ol className="bw-stages" aria-label={t('bw_stages')} lang={t('bw_lang')}>
      {STAGES.map((n) => {
        const state = n < stage ? 'is-done' : n === stage ? 'is-current' : 'is-next';
        return (
          <li key={n} className={`bw-stage ${state}`} aria-current={n === stage ? 'step' : undefined}>
            <span className="bw-stage-num" aria-hidden="true">{n < stage ? '✓' : n}</span>
            <div className="bw-stage-text">
              <h3 className="bw-stage-name">{stageTitle(n, kind, t)}</h3>
              {n < stage && <span className="bw-stage-state">{t('bw_done')}</span>}
            </div>
          </li>
        );
      })}
    </ol>
    <p className="bw-tip" role="note">
      <span className="bw-tip-icon" aria-hidden="true">💡</span>
      <span className="bw-tip-body">
        <strong>{t('bw_tip')}</strong>
        <span>{stageTip(stage, kind, t)}</span>
      </span>
    </p>
    <style>{BW_CSS}</style>
  </div>
);

export const BookingWizardPage = () => {
  const { locale } = useAdminStore();
  const t: TFn = (key, params) => translate(key, locale, params);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const restaurantId = useAuthStore((s) => s.restaurantId) ?? '';
  const [draft, setDraft, clearDraft] = useSessionDraft<Draft>(DRAFT_KEY, freshDraft());
  const [busy, setBusy] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [nameTouched, setNameTouched] = useState(false);

  // The areas, from the SAME query the floor map reads, so stage 3 opens on
  // a warm cache rather than loading the map a second time.
  const { data: map } = useQuery({ queryKey: ['floor-map'], queryFn: () => floorMapService.get() });
  const areas = map?.areas ?? [];

  const patch = (next: Partial<Draft>) => setDraft({ ...draft, ...next });
  const kind = draft.kind;
  const guestCap = parseGuests(draft.guests);

  /** Leave the wizard. Clears the draft: the next "+ New booking" starts clean. */
  const leave = (flash?: string, area?: string) => {
    clearDraft();
    const params = new URLSearchParams();
    if (area) params.set('area', area);
    if (flash) params.set('day', draft.day);
    const qs = params.toString();
    navigate(`/${qs ? `?${qs}` : ''}`, { state: flash ? { flash } : null });
  };

  /**
   * Stage 3 has created the booking; stage 4 is whatever the type said.
   *
   * The banquet planner is the KIOSK's chooser — halls, table packages,
   * courses — handed a draft that names this booking, so the menu is saved
   * back onto it instead of creating a second one. It is told the type
   * (`sessionKind`) so it does not ask "Banquet or General Dining?" again, and
   * that the tables are held (`floorLocked`) so confirming a menu cannot
   * release them.
   */
  const onCreated = (created: NonNullable<Draft['created']>) => {
    if (kind === 'banquet') {
      useTabletStore.getState().loadEventDraft({
        editingEventId: created.eventNumber,
        hallId: created.hallId,
        tableCategoryId: '',
        guestCount: created.guests,
        customerName: draft.name.trim(),
        customerPhone: draft.phone.trim(),
        secondCustomerName: '',
        secondCustomerPhone: '',
        eventDate: draft.day,
        eventTime: draft.time || '19:00',
        config: null,
        sessionKind: 'banquet',
        floorLocked: true,
      });
      clearDraft();
      navigate(`/tablet?restaurantId=${encodeURIComponent(restaurantId)}&prefill=1`);
      return;
    }
    if (kind === 'dining') {
      setOrderError(null);
      setDraft({ ...draft, stage: 4, created });
      return;
    }
    // "Decide later": the booking is in the book, its menu outstanding — said
    // plainly on the map, since nothing else there would say it.
    leave(t('bw_saved_no_menu', { number: created.eventNumber }), created.hallId);
  };

  /**
   * Place the party's service order, and record it on the booking.
   *
   * TWO writes, in this order and not the other way round: the order is what
   * the kitchen and the waiter work from, so it is created first and the
   * booking's own copy of the menu follows. If the second one fails the party
   * still gets fed — the Events page would be missing the summary, which is a
   * reporting gap rather than a missing meal. The reverse would be a booking
   * that claims food nobody was ever asked to cook.
   */
  const placeOrder = async (order: OrderDraft) => {
    const created = draft.created;
    if (!created) return;
    const items = Object.entries(order.lines)
      .filter(([, quantity]) => quantity > 0)
      .map(([menuItemId, quantity]) => ({ menuItemId, quantity }));
    if (items.length === 0) return;
    setBusy(true);
    setOrderError(null);
    try {
      const placed = await orderService.placeForBooking({
        eventNumber: created.eventNumber,
        comment: order.comment.trim() || null,
        items,
      });
      const lines = placed.items.map((line) => ({
        menuItemId: line.menuItemId,
        name: line.nameSnapshot,
        quantity: line.quantity,
        unitPriceCents: line.unitPriceCents,
      }));
      const portions = lines.reduce((sum, line) => sum + line.quantity, 0);
      await eventService.update(created.eventNumber, {
        menuConfig: {
          sessionKind: 'dining',
          diningOrder: {
            orderId: placed.id,
            placedAt: placed.createdAt,
            lines,
            portions,
            totalCents: lines.reduce((sum, line) => sum + line.unitPriceCents * line.quantity, 0),
          },
        } as never,
      });
      await queryClient.invalidateQueries({ queryKey: ['floor-map-day', draft.day] });
      leave(t('sbo_sent', { number: String(created.eventNumber), portions }), created.hallId);
    } catch (error) {
      setOrderError(t('sbo_failed', { message: errorText(error) }));
    } finally {
      setBusy(false);
    }
  };

  // A stage-4 draft for a banquet has already been handed to the kiosk; one
  // with no booking behind it is a draft nothing can finish. Either way,
  // start again rather than show a dead stage.
  useEffect(() => {
    if (draft.stage === 4 && (kind !== 'dining' || !draft.created)) setDraft(freshDraft());
    if (draft.stage >= 2 && kind === null) setDraft(freshDraft());
  }, [draft.stage, kind, draft.created, setDraft]);

  // The basket has its own Cancel; everywhere else the close button is the way out.
  const stages = <BookingStages stage={draft.stage} kind={kind} t={t} onClose={draft.stage === 4 ? undefined : () => leave()} />;

  // ── Stage 4: the service-order basket ─────────────────────────────────────
  if (draft.stage === 4 && kind === 'dining' && draft.created) {
    const created = draft.created;
    return (
      <div className="adm-bg svr-theme bw-root">
      <SmallBanquetOrderSheet
        booking={{
          eventNumber: created.eventNumber,
          customerName: draft.name.trim(),
          when: `${draft.day} ${draft.time}`,
          guestCount: created.guests,
        }}
        steps={stages}
        t={t}
        locale={locale}
        busy={busy}
        error={orderError}
        // Leaving does NOT undo the booking: the evening is in the book and
        // its menu is outstanding — the state "decide later" produces.
        onCancel={() => leave(t('bw_saved_order_later', { number: created.eventNumber }), created.hallId)}
        onPlace={(order) => void placeOrder(order)}
      />
      </div>
    );
  }

  // ── Stage 3: the plan, full screen ────────────────────────────────────────
  if (draft.stage === 3 && kind) {
    return (
      <div className="adm-bg svr-theme bw-root">
        <FloorMapPage
          flow={{
            kind: toMenuKind(kind),
            name: draft.name,
            phone: draft.phone,
            day: draft.day,
            time: draft.time || '19:00',
            guestCount: guestCap,
            hallId: draft.hallId || null,
            header: stages,
            onBack: () => patch({ stage: 2 }),
            onCancel: () => leave(),
            onCreated,
          }}
        />
      </div>
    );
  }

  // ── Stages 1 and 2: a page inside the section's layout ────────────────────
  const nameMissing = !draft.name.trim();
  return (
    <div className="adm-bg svr-theme bw-root">
    <main className="bw-page">
      {stages}

      {draft.stage === 1 && (
        <section className="adm-card bw-card">
          <h2 className="bw-heading">{t('bw_type_heading')}</h2>
          <p className="bw-sub">{t('bw_type_sub')}</p>
          <div className="bw-kinds">
            {([
              ['banquet', 'menu_kind_banquet', 'menu_kind_banquet_hint', '🍽'],
              ['dining', 'menu_kind_dining', 'menu_kind_dining_hint', '🛒'],
              ['skip', 'menu_kind_skip', 'menu_kind_skip_hint', '⏳'],
            ] as const).map(([value, label, hint, icon]) => (
              // Choosing IS the step: a press moves to the details at once,
              // rather than asking for a Continue after an answer was given.
              <button key={value} type="button"
                className={`bw-kind${kind === value ? ' is-on' : ''}`}
                aria-pressed={kind === value}
                onClick={() => patch({ kind: value, stage: 2 })}>
                <span className="bw-kind-icon" aria-hidden="true">{icon}</span>
                <strong>{t(label)}</strong>
                <span className="bw-sub">{t(hint)}</span>
              </button>
            ))}
          </div>
          <div className="bw-actions">
            <button type="button" className="adm-btn-ghost" onClick={() => leave()}>{t('cancel')}</button>
          </div>
        </section>
      )}

      {draft.stage === 2 && (
        <form className="adm-card bw-card"
          onSubmit={(e) => {
            e.preventDefault();
            setNameTouched(true);
            if (!nameMissing) patch({ stage: 3 });
          }}>
          <h2 className="bw-heading">{t('bw_details_heading')}</h2>
          <p className="bw-sub">
            {t('bw_stage_type')}: <strong>{kind === 'banquet' ? t('menu_kind_banquet') : kind === 'dining' ? t('menu_kind_dining') : t('menu_kind_skip')}</strong>
          </p>
          <div className="bw-grid">
            <label className="bw-field bw-wide">
              <span>{t('customer_name')} *</span>
              <input className="adm-input" value={draft.name} autoFocus maxLength={200}
                aria-invalid={nameTouched && nameMissing}
                onBlur={() => setNameTouched(true)}
                onChange={(e) => patch({ name: e.target.value })} />
              {nameTouched && nameMissing && <span className="bw-error">{t('bw_name_needed')}</span>}
            </label>
            <label className="bw-field">
              <span>{t('customer_phone')}</span>
              <input className="adm-input" type="tel" value={draft.phone}
                onChange={(e) => patch({ phone: e.target.value })} />
            </label>
            <label className="bw-field">
              <span>{t('bw_guests_optional')}</span>
              <input className="adm-input" inputMode="numeric" value={draft.guests}
                onChange={(e) => patch({ guests: e.target.value.replace(/[^\d\s]/g, '') })} />
            </label>
            {/* The day the plan will be drawn for — which tables are free is
                entirely a question about it, so it is asked before the plan. */}
            <label className="bw-field">
              <span>{t('fm_day')}</span>
              <input className="adm-input" type="date" value={draft.day}
                onChange={(e) => patch({ day: e.target.value || dayKey(new Date()) })} />
            </label>
            <label className="bw-field">
              <span>{t('event_time')}</span>
              <input className="adm-input" type="time" value={draft.time}
                onChange={(e) => patch({ time: e.target.value })} />
            </label>
            {areas.length > 1 && (
              <label className="bw-field bw-wide">
                <span>{t('bw_area')}</span>
                <select className="adm-input" value={draft.hallId}
                  onChange={(e) => patch({ hallId: e.target.value })}>
                  <option value="">—</option>
                  {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </label>
            )}
          </div>
          <div className="bw-actions">
            <button type="button" className="adm-btn-ghost" onClick={() => patch({ stage: 1 })}>‹ {t('bw_back')}</button>
            <button type="button" className="adm-btn-ghost" onClick={() => leave()}>{t('cancel')}</button>
            <button type="submit" className="adm-btn-primary">{t('bw_continue')} ›</button>
          </div>
        </form>
      )}
    </main>
    </div>
  );
};

/*
 * Kept outside the component and free of backticks inside: it is a template
 * literal, and one stray backtick ends it (styleBlocks.test.ts).
 */
const BW_CSS = `
  .bw-page { max-width: 980px; margin: 0 auto; padding: 28px 20px 48px; display: grid; gap: 18px; }
  .bw-stages-wrap { display: grid; gap: 12px; min-width: 0; }
  .bw-stages-top { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
  .bw-title { margin: 0; font-size: 26px; }
  .bw-step-of { font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: rgba(var(--adm-text-rgb), 0.55); }
  .bw-stages {
    list-style: none; margin: 0; padding: 0;
    display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px;
  }
  .bw-stage {
    display: flex; align-items: center; gap: 10px; min-width: 0;
    padding: 10px 12px; border-radius: 4px;
    border: 1px solid var(--adm-line); background: rgba(var(--adm-text-rgb), 0.03);
  }
  .bw-stage-num {
    flex: 0 0 28px; height: 28px; border-radius: 999px;
    display: inline-flex; align-items: center; justify-content: center;
    font-size: 13px; font-weight: 800;
    border: 1px solid var(--adm-line); color: rgba(var(--adm-text-rgb), 0.6);
  }
  .bw-stage-text { display: grid; min-width: 0; }
  .bw-stage-name {
    margin: 0; font-size: 13.5px; font-weight: 700; line-height: 1.25;
    color: rgba(var(--adm-text-rgb), 0.62);
    overflow-wrap: break-word; hyphens: auto;
  }
  .bw-stage-state { font-size: 11px; color: rgba(var(--adm-text-rgb), 0.5); }
  .bw-stage.is-current {
    border-color: var(--adm-accent); background: rgba(var(--adm-accent-rgb), 0.12);
  }
  .bw-stage.is-current .bw-stage-num { background: var(--adm-accent); border-color: var(--adm-accent); color: var(--adm-accent-ink); }
  .bw-stage.is-current .bw-stage-name { color: var(--adm-text); }
  .bw-stage.is-done .bw-stage-num { border-color: rgba(var(--adm-accent-rgb), 0.6); color: var(--adm-accent); }
  /* The tip is meant to be READ, so it is set as a callout rather than a
     caption: body-size type, full-strength ink, a solid accent spine and a
     tinted ground. */
  .bw-tip {
    margin: 0; display: flex; gap: 12px; align-items: flex-start;
    padding: 14px 18px; border-radius: 6px; font-size: 16px; line-height: 1.5;
    border: 1px solid rgba(var(--adm-accent-rgb), 0.55);
    border-left: 5px solid var(--adm-accent);
    background: rgba(var(--adm-accent-rgb), 0.14);
    color: var(--adm-text);
    box-shadow: 0 6px 22px rgba(0, 0, 0, 0.25);
  }
  .bw-tip-icon { font-size: 22px; line-height: 1.2; flex: 0 0 auto; }
  .bw-tip-body { display: grid; gap: 2px; min-width: 0; }
  .bw-tip strong { color: var(--adm-accent); font-size: 13px; letter-spacing: 0.08em; text-transform: uppercase; }
  .bw-root { min-height: 100vh; }
  .bw-close { margin-left: auto; min-height: 40px; display: inline-flex; align-items: center; gap: 6px; }
  .bw-stages-top .bw-step-of { margin-left: auto; }
  .bw-stages-top .bw-step-of + .bw-close { margin-left: 4px; }
  .bw-card { padding: 22px !important; display: grid; gap: 14px; min-width: 0; }
  .bw-heading { margin: 0; font-size: 20px; color: var(--adm-title); }
  .bw-sub { font-size: 13px; color: rgba(var(--adm-text-rgb), 0.62); margin: 0; }
  .bw-kinds { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
  .bw-kind {
    display: grid; gap: 6px; align-content: start; text-align: left; cursor: pointer;
    min-height: 150px; padding: 18px; border-radius: 6px;
    border: 1px solid var(--adm-line); background: rgba(var(--adm-text-rgb), 0.03);
    color: inherit; transition: border-color 0.15s, background 0.15s;
  }
  .bw-kind:hover, .bw-kind:focus-visible { border-color: rgba(var(--adm-accent-rgb), 0.6); }
  .bw-kind.is-on { border-color: var(--adm-accent); background: rgba(var(--adm-accent-rgb), 0.12); }
  .bw-kind strong { font-size: 17px; }
  .bw-kind-icon { font-size: 26px; }
  .bw-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 16px; }
  .bw-field { display: grid; gap: 6px; min-width: 0; font-size: 13px; color: rgba(var(--adm-text-rgb), 0.75); }
  .bw-field .adm-input { width: 100%; min-height: 44px; box-sizing: border-box; }
  .bw-wide { grid-column: 1 / -1; }
  .bw-error { color: #fca5a5; font-size: 12.5px; }
  .bw-actions { display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap; }
  .bw-actions button { min-height: 44px; }
  .bw-actions .adm-btn-primary { min-width: 160px; }
  /* A phone: still all four stages, numbered and named, but as ONE row with
     the number above the name. A 2 x 2 grid took a third of the screen, and
     inside the service-order basket that third came out of the menu. The
     tick says a stage is done, so the word goes. */
  @media (max-width: 760px) {
    .bw-stages { gap: 6px; }
    .bw-stage { flex-direction: column; align-items: center; text-align: center; gap: 4px; padding: 6px 4px; }
    .bw-stage-num { flex: 0 0 auto; width: 22px; height: 22px; font-size: 11px; }
    .bw-stage-name { font-size: 11px; }
    .bw-stage-state { display: none; }
    .bw-title { font-size: 20px; }
    .bw-tip { font-size: 14.5px; padding: 10px 12px; border-left-width: 4px; }
    .bw-tip-icon { font-size: 18px; }
    .bw-close span { display: none; }
    .bw-kinds, .bw-grid { grid-template-columns: minmax(0, 1fr); }
    .bw-kind { min-height: 0; }
    .bw-page { padding: 18px 16px 40px; }
    .bw-actions button { flex: 1 1 auto; }
  }
`;
