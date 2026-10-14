import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { playCallAlert } from '../utils/alertSound';
import { callingOrders, newCalls, prune, tableLabel, waitedMinutes, type CallingOrder } from '../utils/waiterCalls';
import type { TranslationKey } from '../utils/translate';

/**
 * "Table 7 is calling the waiter!"
 *
 * It lives in the LAYOUT, not on the orders page, because a call has to reach
 * the waiter wherever they are — on the statistics tab, or scrolled to the foot
 * of a list of eight orders. A badge on a tab was the only thing saying so, and
 * a badge is not something somebody crossing a dining room reads.
 *
 * Fixed to the BOTTOM of the screen: that is where a thumb already is, and the
 * header it would otherwise sit under is where the tabs are.
 *
 * It is a one-way announcement. Acknowledging a call is the order's own button
 * on the Orders page — doing it from here would mean acknowledging a table the
 * waiter has not been to yet, which is exactly what the acknowledgement is
 * supposed to mean. So this offers "Open" (which goes to the list) and
 * "Dismiss" (which silences THIS banner and nothing else; the call stays, the
 * badge stays, and the card on the list still says the table is waiting).
 */
export const WaiterCallBanner = ({ orders, t }: {
  orders: readonly (CallingOrder & { code?: string })[];
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}) => {
  const navigate = useNavigate();
  const calling = callingOrders(orders);
  /** Calls already announced, so a six-second poll does not beep every six seconds. */
  const announced = useRef<Set<string>>(new Set());
  /** Calls the waiter has waved away on this screen. */
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  /**
   * A clock, because the data does not tick.
   *
   * "Waiting 7 min" is computed at render, and the orders poll returns the
   * SAME call every six seconds — React Query's structural sharing keeps the
   * identity of deep-equal data, so nothing re-renders and the figure would
   * sit at whatever it was when the call arrived. Half a minute is fine for a
   * figure in whole minutes, and it is one `setState` on a timer rather than
   * one a second.
   */
  const [, tick] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => tick((n) => n + 1), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    // Forget anything no longer calling FIRST, or a table that called, was
    // served and called again would never sound a second time.
    announced.current = prune(announced.current, calling);
    const fresh = newCalls(calling, announced.current);
    if (fresh.length === 0) return;
    for (const order of fresh) announced.current.add(order.id);
    playCallAlert();
    // A call that arrives after being dismissed is a NEW call and must show.
    setDismissed((prev) => {
      if (fresh.every((order) => !prev.has(order.id))) return prev;
      const next = new Set(prev);
      for (const order of fresh) next.delete(order.id);
      return next;
    });
  }, [calling]);

  const showing = calling.filter((order) => !dismissed.has(order.id));
  if (showing.length === 0) return null;
  const first = showing[0];

  return (
    <div className="wcb" role="alert" aria-live="assertive">
      <div className="wcb-body">
        <strong>{t('fe_call_alert', { table: tableLabel(first) })}</strong>
        <span>
          {t('fe_waiting_since', { minutes: waitedMinutes(first) })}
          {/* The others, counted rather than listed: the banner's job is to get
              somebody moving to the table that has waited longest. */}
          {showing.length > 1 && ` · ${t('fe_call_alert_more', { count: showing.length - 1 })}`}
        </span>
      </div>
      <div className="wcb-actions">
        <button type="button" className="wcb-go" onClick={() => navigate('/orders')}>
          {t('fe_call_alert_open')}
        </button>
        <button type="button" className="wcb-x" aria-label={t('cancel')}
          onClick={() => setDismissed((prev) => new Set([...prev, ...showing.map((order) => order.id)]))}>
          ×
        </button>
      </div>

      <style>{`
        .wcb {
          position: fixed; left: 0; right: 0; bottom: 0; z-index: 60;
          display: flex; align-items: center; gap: 12px;
          padding: 13px 16px calc(13px + env(safe-area-inset-bottom, 0px));
          /* White on near-black in dining mode and the floor's accent on its
             own ground in the other: the same token pair the header's active
             tab uses, so the alert belongs to whichever floor it appears on. */
          background: var(--sbf-tab-on, #fff); color: var(--sbf-tab-ink, #000);
          box-shadow: 0 -8px 28px rgba(0, 0, 0, 0.45);
          animation: wcb-in 0.22s ease-out;
        }
        @keyframes wcb-in { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @media (prefers-reduced-motion: reduce) { .wcb { animation: none; } }
        .wcb-body { display: grid; gap: 2px; min-width: 0; }
        .wcb-body strong { font-size: 15.5px; line-height: 1.25; }
        .wcb-body span { font-size: 12.5px; opacity: 0.72; }
        .wcb-actions { display: flex; align-items: center; gap: 8px; margin-left: auto; }
        /* Both ≥44px: this is pressed in a hurry, one-handed. */
        .wcb-go, .wcb-x {
          min-height: 44px; border-radius: 10px; cursor: pointer; font-weight: 700;
          border: 1px solid currentColor; background: transparent; color: inherit;
        }
        .wcb-go { padding: 0 14px; font-size: 13.5px; }
        .wcb-x { min-width: 44px; font-size: 20px; line-height: 1; }
      `}</style>
    </div>
  );
};
