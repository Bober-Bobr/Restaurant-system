import { useMutation, useQueryClient } from '@tanstack/react-query';
import { formatSum } from '../utils/currency';
import { publicOrderService, type GuestOrder } from '../services/order.service';
import { Price, useT } from './ui';

// ── What the guest sees once they have ordered ──────────────────────────────
// Before a waiter picks it up, the code is the whole screen: it is the one thing
// the guest has to do next, so it is set at a size readable across a table with
// the phone flat.
//
// After a waiter claims it, the code stops mattering and the panel becomes a
// receipt plus the "call waiter" button.
export function ActiveOrderPanel({ order }: { order: GuestOrder }) {
  const { t } = useT();
  const queryClient = useQueryClient();

  const call = useMutation({
    mutationFn: () => publicOrderService.callWaiter(order.guestToken),
    onSuccess: (updated) => queryClient.setQueryData(['fs-order', order.guestToken], updated),
  });

  const waiting = order.status === 'PENDING';

  return (
    <section className="fs-card reveal" style={{ padding: 0, overflow: 'hidden', marginTop: 30 }}>
      <div style={{
        padding: '20px 20px 22px',
        borderBottom: '1px solid var(--fs-line)',
        display: 'grid', gap: 14, justifyItems: 'center', textAlign: 'center',
      }}>
        {waiting ? (
          <>
            <p className="fs-eyebrow" style={{ margin: 0 }}>{t('fs_show_this_code')}</p>
            <strong style={{
              display: 'block',
              fontSize: 'clamp(56px, 20vw, 92px)',
              fontWeight: 800,
              lineHeight: 1,
              letterSpacing: '0.12em',
              color: 'var(--fs-accent)',
              // A code is read character by character, so the glyphs must not
              // shuffle width as the eye moves along them.
              fontVariantNumeric: 'tabular-nums',
              paddingLeft: '0.12em',
            }}>
              {order.code}
            </strong>
            <p className="fs-muted" style={{ margin: 0, fontSize: 14, lineHeight: 1.6, maxWidth: 340 }}>
              {t('fs_code_hint')}
            </p>
          </>
        ) : (
          <>
            <span className="fs-pill">✓ {t('fs_order_accepted')}</span>
            <p className="fs-muted" style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6, maxWidth: 360 }}>
              {order.tableNumber
                ? `${t('fs_table')} ${order.tableNumber} · ${t('fs_order_accepted_hint')}`
                : t('fs_order_accepted_hint')}
            </p>

            <button
              type="button"
              className={`fs-btn ${order.callPending ? 'fs-btn-ghost' : 'fs-btn-primary'}`}
              style={{ width: '100%', maxWidth: 320 }}
              disabled={order.callPending || call.isPending}
              onClick={() => call.mutate()}
            >
              {order.callPending ? `⏳ ${t('fs_waiter_coming')}` : `🔔 ${t('fs_call_waiter')}`}
            </button>
            {call.isError && (
              <p style={{ margin: 0, fontSize: 12.5, color: 'var(--fs-danger)' }}>{t('fs_call_failed')}</p>
            )}
          </>
        )}
      </div>

      <div style={{ padding: '16px 20px 18px', display: 'grid', gap: 8 }}>
        <span className="fs-label" style={{ marginBottom: 0 }}>{t('fs_your_order')}</span>
        {order.items.map((line) => (
          <div key={`${line.menuItemId ?? line.name}`} style={{ display: 'flex', gap: 10, fontSize: 14 }}>
            <span className="fs-muted" style={{ fontVariantNumeric: 'tabular-nums' }}>{line.quantity}×</span>
            <span style={{ flex: 1, minWidth: 0 }}>{line.name}</span>
            <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
              {formatSum(line.unitPriceCents * line.quantity)}
            </span>
          </div>
        ))}

        {order.comment && (
          <p className="fs-muted" style={{
            margin: '4px 0 0', fontSize: 13, lineHeight: 1.55,
            padding: '9px 11px', borderRadius: 10, background: 'rgba(0,0,0,0.3)',
          }}>
            💬 {order.comment}
          </p>
        )}

        <hr className="fs-rule" style={{ margin: '4px 0' }} />
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 }}>
          <span className="fs-label" style={{ marginBottom: 0 }}>{t('total')}</span>
          <Price tiyin={order.totalCents} size={24} />
        </div>
      </div>
    </section>
  );
}

/** Slim banner shown above the menu while an order is live. */
export function OrderLockNotice({ order }: { order: GuestOrder }) {
  const { t } = useT();
  return (
    <div className="fs-card" style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', marginTop: 16,
      borderColor: 'rgb(var(--fs-accent-rgb) / 0.4)',
    }}>
      <span style={{ fontSize: 18 }}>{order.status === 'PENDING' ? '🧾' : '👋'}</span>
      <p className="fs-muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.5, flex: 1 }}>
        {order.status === 'PENDING' ? t('fs_locked_pending') : t('fs_locked_open')}
      </p>
    </div>
  );
}
