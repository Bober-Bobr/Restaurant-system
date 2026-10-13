import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { orderService, orderTotalCents, type FloorList, type WaiterOrder } from '../services/order.service';
import { useWorkArea } from '../utils/useWorkArea';
import { DUE_LEAD_MINUTES } from '../utils/workArea';
import { useLiveQuery } from '../services/live';
import { publicMenuService } from '../services/publicMenu.service';
import { useAdminStore } from '../store/admin.store';
import { useAuthStore } from '../store/auth.store';
import { translate, type TranslationKey } from '../utils/translate';
import { formatSum } from '../utils/currency';
import { dishName } from '../utils/menuI18n';
import type { MenuItem } from '../types/domain';

// ── The floor ───────────────────────────────────────────────────────────────
// Two things happen here: take an order, and look after the orders already
// taken. Nothing else — whoever is using this is standing up, holding a phone,
// usually in a hurry.
//
// TWO FLOORS, one page (utils/workArea.ts). General dining is a guest at a
// table who built the order themselves: they hold a three-character code, they
// press "call waiter", and they ask for another dish. A Small Banquets party
// agreed its food with the supervisor in advance and has no device in it at
// all — so there is no code to type, no call to answer and no dish to change,
// and every one of those controls is absent rather than present and dead.
//
// The page is not forked for it. `surface` is the one table that says which
// controls exist, the same mechanism the kiosk's two sessions use: written as
// two pages, "the floor works the same" would last about a release.

export const FoodEmployeeOrdersPage = () => {
  const { locale } = useAdminStore();
  const t = (k: TranslationKey, p?: Record<string, string | number>) => translate(k, locale, p);
  const restaurantId = useAuthStore((s) => s.restaurantId);
  const queryClient = useQueryClient();
  const { surface } = useWorkArea();

  const [code, setCode] = useState('');
  const [table, setTable] = useState('');
  const [editing, setEditing] = useState<string | null>(null);

  const ordersQuery = useLiveQuery<FloorList>('waiterOrders', {
    queryKey: ['wt-orders', 'OPEN'],
    queryFn: () => orderService.listMine('OPEN'),
  });
  const orders = ordersQuery.data?.orders ?? [];

  // Waiting to be taken. Only where orders ARE taken off a list: in general
  // dining an unclaimed order belongs to the guest holding its code, and
  // listing them for anyone to take would undo that handoff.
  const pendingQuery = useLiveQuery<FloorList>('waiterOrders', {
    queryKey: ['wt-pending'],
    queryFn: () => orderService.pending(),
    enabled: surface.takeFromList,
  });
  const pending = pendingQuery.data?.orders ?? [];
  /** Parties whose order exists but whose evening is still hours away. */
  const later = (pendingQuery.data?.later ?? 0) + (ordersQuery.data?.later ?? 0);

  // The menu, for amending an order. Public endpoint — the staff device sees
  // the same live menu the guest did. Not fetched where nothing can be
  // amended: a party's dishes were agreed with the host.
  const { data: menuItems = [] } = useQuery({
    queryKey: ['wt-menu', restaurantId],
    queryFn: () => publicMenuService.listActive(restaurantId!),
    enabled: !!restaurantId && surface.editItems,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['wt-orders'] });
    queryClient.invalidateQueries({ queryKey: ['wt-pending'] });
    queryClient.invalidateQueries({ queryKey: ['wt-alerts'] });
  };

  const claim = useMutation({
    mutationFn: () => orderService.claim(code, table),
    onSuccess: () => { setCode(''); setTable(''); invalidate(); },
  });
  const acknowledge = useMutation({ mutationFn: (id: string) => orderService.acknowledge(id), onSuccess: invalidate });
  const take = useMutation({ mutationFn: (id: string) => orderService.take(id), onSuccess: invalidate });
  const close = useMutation({ mutationFn: (id: string) => orderService.close(id), onSuccess: invalidate });

  const canClaim = code.trim().length > 0 && table.trim().length > 0 && !claim.isPending;

  return (
    <div style={{ display: 'grid', gap: 18, maxWidth: 720 }}>
      {/* ── Take an order ── */}
      {surface.claimByCode && (
      <section className="adm-card" style={{ padding: 18, display: 'grid', gap: 13 }}>
        <div>
          <h2 className="adm-heading" style={{ margin: 0 }}>{t('fe_take_order')}</h2>
          <p className="muted-text" style={{ margin: '5px 0 0', fontSize: 13, lineHeight: 1.55 }}>
            {t('fe_claim_hint')}
          </p>
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); if (canClaim) claim.mutate(); }}
          style={{ display: 'grid', gap: 11, gridTemplateColumns: 'minmax(120px, 1fr) minmax(120px, 1fr)' }}
        >
          <label style={{ display: 'grid', gap: 5 }}>
            <span className="adm-label">{t('fe_code')}</span>
            <input
              className="adm-input"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              // A three-character code typed on a phone: no autocorrect, no
              // capitalisation surprises, and the whole field selected on focus
              // so a retype replaces rather than appends.
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              maxLength={6}
              onFocus={(e) => e.currentTarget.select()}
              style={{ fontSize: 22, fontWeight: 800, letterSpacing: '0.22em', textAlign: 'center' }}
            />
          </label>
          <label style={{ display: 'grid', gap: 5 }}>
            <span className="adm-label">{t('fe_table')}</span>
            <input
              className="adm-input"
              value={table}
              onChange={(e) => setTable(e.target.value)}
              inputMode="numeric"
              maxLength={20}
              style={{ fontSize: 22, fontWeight: 800, textAlign: 'center' }}
            />
          </label>

          <button type="submit" className="adm-btn-primary" disabled={!canClaim} style={{ gridColumn: '1 / -1' }}>
            {claim.isPending ? '…' : t('fe_claim')}
          </button>
        </form>

        {claim.isError && (
          <p style={{ margin: 0, fontSize: 13, color: '#f87171', lineHeight: 1.5 }}>
            {errorMessage(claim.error) ?? t('fe_claim_failed')}
          </p>
        )}
      </section>
      )}

      {/* ── Waiting to be taken (Small Banquets) ──
          The order is already on the screen and the party is already sitting
          at the tables the map gave them, so there is nothing to type: the
          whole handoff the code exists for happened when the booking was
          made. */}
      {surface.takeFromList && (
        <section style={{ display: 'grid', gap: 12 }}>
          <h2 className="adm-heading" style={{ margin: 0 }}>
            {t('fe_waiting')} {pending.length > 0 && <span className="muted-text">· {pending.length}</span>}
          </h2>
          {pending.length === 0 && (
            <p className="muted-text" style={{ margin: 0, fontSize: 14 }}>{t('fe_nothing_waiting')}</p>
          )}
          {pending.map((order) => (
            <PartyCard key={order.id} order={order} t={t}
              action={{ label: t('fe_take'), onPress: () => take.mutate(order.id), busy: take.isPending }} />
          ))}
          {/* What the list is NOT showing. A clean screen that says nothing
              about what it is holding back is a screen nobody can trust. */}
          {later > 0 && (
            <p className="muted-text" style={{ margin: 0, fontSize: 13 }}>
              {t('fe_later_hidden', { count: later, hours: Math.round(DUE_LEAD_MINUTES / 60) })}
            </p>
          )}
          {take.isError && (
            <p style={{ margin: 0, fontSize: 13, color: '#f87171' }}>{errorMessage(take.error) ?? '—'}</p>
          )}
        </section>
      )}

      {/* ── Active orders ── */}
      <section style={{ display: 'grid', gap: 12 }}>
        <h2 className="adm-heading" style={{ margin: 0 }}>
          {t('fe_active_orders')} {orders.length > 0 && <span className="muted-text">· {orders.length}</span>}
        </h2>

        {orders.length === 0 && (
          <p className="muted-text" style={{ margin: 0, fontSize: 14 }}>{t('fe_no_active_orders')}</p>
        )}

        {orders.map((order) => (surface.editItems ? (
          <OrderCard
            key={order.id}
            order={order}
            menuItems={menuItems}
            locale={locale}
            t={t}
            isEditing={editing === order.id}
            onEdit={() => setEditing(editing === order.id ? null : order.id)}
            onEdited={() => { setEditing(null); invalidate(); }}
            onAcknowledge={() => acknowledge.mutate(order.id)}
            onClose={() => { if (window.confirm(t('fe_close_confirm'))) close.mutate(order.id); }}
          />
        ) : (
          /* A party's order: who, when, which tables, and the food. No code to
             read out, no call to answer, no dish to change. */
          <PartyCard key={order.id} order={order} t={t}
            action={{
              label: t('fe_close_order'),
              danger: true,
              onPress: () => { if (window.confirm(t('fe_close_confirm'))) close.mutate(order.id); },
              busy: close.isPending,
            }} />
        )))}
      </section>
    </div>
  );
};

function OrderCard({
  order, menuItems, locale, t, isEditing, onEdit, onEdited, onAcknowledge, onClose,
}: {
  order: WaiterOrder;
  menuItems: MenuItem[];
  locale: Parameters<typeof dishName>[1];
  t: (k: TranslationKey, p?: Record<string, string | number>) => string;
  isEditing: boolean;
  onEdit: () => void;
  onEdited: () => void;
  onAcknowledge: () => void;
  onClose: () => void;
}) {
  const calling = !!order.callPendingAt;
  const waitingMinutes = calling
    ? Math.max(0, Math.round((Date.now() - new Date(order.callPendingAt!).getTime()) / 60_000))
    : 0;

  return (
    <article
      className="adm-card"
      style={{
        padding: 16, display: 'grid', gap: 12,
        // A guest waiting is the one thing on this screen that must not be
        // missed, so a called order is visibly different, not just badged.
        borderColor: calling ? '#fff' : undefined,
        boxShadow: calling ? '0 0 0 1px #fff, 0 10px 30px rgba(255,255,255,0.14)' : undefined,
      }}
    >
      <header style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{
          fontSize: 20, fontWeight: 800, letterSpacing: '0.14em',
          padding: '4px 10px', borderRadius: 8,
          background: 'rgba(255,255,255,0.12)', color: '#fff',
        }}>
          {order.code}
        </span>
        <strong style={{ fontSize: 16 }}>{t('fe_table')}: {order.tableNumber ?? '—'}</strong>
        <span className="muted-text" style={{ fontSize: 12.5, marginLeft: 'auto' }}>
          {t('fe_placed')} {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </header>

      {calling && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
          padding: '9px 12px', borderRadius: 10, background: '#fff',
        }}>
          <strong style={{ color: '#000', fontSize: 14 }}>
            🔔 {t('fe_calling')} · {t('fe_waiting_since', { minutes: waitingMinutes })}
          </strong>
          <button type="button" className="adm-btn-sm" style={{
            marginLeft: 'auto', background: '#000', color: '#fff',
            border: '1px solid #000', borderRadius: 8, fontWeight: 700, cursor: 'pointer',
          }} onClick={onAcknowledge}>
            {t('fe_acknowledge')}
          </button>
        </div>
      )}

      <div style={{ display: 'grid', gap: 6 }}>
        {order.items.map((line) => (
          <div key={line.id} style={{ display: 'flex', gap: 10, fontSize: 14 }}>
            <span className="muted-text" style={{ fontVariantNumeric: 'tabular-nums', minWidth: 28 }}>
              {line.quantity}×
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>{line.nameSnapshot}</span>
            <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
              {formatSum(line.unitPriceCents * line.quantity)}
            </span>
          </div>
        ))}
      </div>

      {order.comment && (
        <p style={{
          margin: 0, fontSize: 13.5, lineHeight: 1.55, padding: '9px 12px',
          borderRadius: 10, background: 'rgba(255,255,255,0.05)',
        }}>
          💬 {order.comment}
        </p>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span className="adm-label" style={{ margin: 0 }}>{t('fe_order_total')}</span>
        <strong style={{ fontSize: 18, color: '#fff' }}>{formatSum(orderTotalCents(order))}</strong>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button type="button" className="adm-btn-ghost adm-btn-sm" onClick={onEdit}>
            {t('fe_edit_items')}
          </button>
          <button type="button" className="adm-btn-danger adm-btn-sm" onClick={onClose}>
            {t('fe_close_order')}
          </button>
        </div>
      </div>

      {isEditing && (
        <OrderEditor order={order} menuItems={menuItems} locale={locale} t={t} onDone={onEdited} />
      )}
    </article>
  );
}

// Amending an order: staff came back to the table and the guest wants
// something else. Quantities are edited in place and the whole line set is sent,
// which is what the server expects — it re-snapshots prices from the live menu.
function OrderEditor({
  order, menuItems, locale, t, onDone,
}: {
  order: WaiterOrder;
  menuItems: MenuItem[];
  locale: Parameters<typeof dishName>[1];
  t: (k: TranslationKey) => string;
  onDone: () => void;
}) {
  const [lines, setLines] = useState<Record<string, number>>(() => {
    const out: Record<string, number> = {};
    for (const line of order.items) if (line.menuItemId) out[line.menuItemId] = line.quantity;
    return out;
  });
  const [comment, setComment] = useState(order.comment ?? '');
  const [search, setSearch] = useState('');

  const save = useMutation({
    mutationFn: () => orderService.update(order.id, {
      items: Object.entries(lines).filter(([, q]) => q > 0).map(([menuItemId, quantity]) => ({ menuItemId, quantity })),
      comment: comment.trim() || null,
    }),
    onSuccess: onDone,
  });

  const chosen = useMemo(
    () => menuItems.filter((m) => (lines[m.id] ?? 0) > 0),
    [menuItems, lines],
  );
  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return menuItems
      .filter((m) => m.isActive && !m.isOutOfStock && dishName(m, locale).toLowerCase().includes(q))
      .slice(0, 8);
  }, [menuItems, search, locale]);

  const setQty = (id: string, qty: number) =>
    setLines((prev) => {
      const next = { ...prev };
      if (qty > 0) next[id] = Math.min(qty, 99); else delete next[id];
      return next;
    });

  const total = chosen.reduce((sum, m) => sum + m.priceCents * (lines[m.id] ?? 0), 0);
  const empty = Object.values(lines).every((q) => q <= 0);

  return (
    <div style={{ display: 'grid', gap: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
      {chosen.map((item) => (
        <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ flex: 1, minWidth: 0, fontSize: 14 }}>{dishName(item, locale)}</span>
          <span className="muted-text" style={{ fontSize: 12.5, whiteSpace: 'nowrap' }}>
            {formatSum(item.priceCents)}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button type="button" className="adm-btn-ghost adm-btn-sm"
              onClick={() => setQty(item.id, (lines[item.id] ?? 0) - 1)}>−</button>
            <span style={{ minWidth: 22, textAlign: 'center', fontWeight: 800 }}>{lines[item.id]}</span>
            <button type="button" className="adm-btn-ghost adm-btn-sm"
              onClick={() => setQty(item.id, (lines[item.id] ?? 0) + 1)}>+</button>
          </div>
        </div>
      ))}

      <label style={{ display: 'grid', gap: 5 }}>
        <span className="adm-label">{t('fe_add_dish')}</span>
        <input className="adm-input" value={search} onChange={(e) => setSearch(e.target.value)} />
      </label>
      {results.length > 0 && (
        <div style={{ display: 'grid', gap: 6 }}>
          {results.map((item) => (
            <button key={item.id} type="button" className="adm-btn-ghost"
              style={{ justifyContent: 'space-between', display: 'flex' }}
              onClick={() => { setQty(item.id, (lines[item.id] ?? 0) + 1); setSearch(''); }}>
              <span>{dishName(item, locale)}</span>
              <span className="muted-text">{formatSum(item.priceCents)}</span>
            </button>
          ))}
        </div>
      )}

      <label style={{ display: 'grid', gap: 5 }}>
        <span className="adm-label">{t('fe_kitchen_comment')}</span>
        <textarea className="adm-input" value={comment} onChange={(e) => setComment(e.target.value)}
          style={{ minHeight: 70, resize: 'vertical' }} />
      </label>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <strong style={{ fontSize: 16, color: '#fff' }}>{formatSum(total)}</strong>
        <button type="button" className="adm-btn-primary" style={{ marginLeft: 'auto' }}
          disabled={empty || save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? '…' : t('fe_save')}
        </button>
      </div>
      {save.isError && (
        <p style={{ margin: 0, fontSize: 13, color: '#f87171' }}>{errorMessage(save.error) ?? '—'}</p>
      )}
    </div>
  );
}

/**
 * A Small Banquets party's order.
 *
 * Deliberately a different card from `OrderCard` rather than that card with
 * five things switched off, because it answers a different question. General
 * dining asks "which table, and are they waiting?"; a party asks "whose
 * evening is this, when do they sit down, and where". The code is not shown at
 * all — nobody is holding one — and the lines are read-only, which is the whole
 * of "the client does not interact with this order".
 *
 * The TIME is the party's, not the order's: an order placed last Tuesday for
 * tonight is a tonight order, and printing when it was typed would be the one
 * useless fact on the card.
 */
function PartyCard({ order, t, action }: {
  order: WaiterOrder;
  t: (k: TranslationKey, p?: Record<string, string | number>) => string;
  action: { label: string; onPress: () => void; busy?: boolean; danger?: boolean };
}) {
  const event = order.event ?? null;
  const when = event ? new Date(event.eventDate) : null;
  const tables = event?.floorTables.map((row) => row.floorTable.label).join(', ') || order.tableNumber;
  const portions = order.items.reduce((sum, line) => sum + line.quantity, 0);

  return (
    <article className="adm-card" style={{ padding: 16, display: 'grid', gap: 12 }}>
      <header style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <strong style={{ fontSize: 17 }}>
          {/* Local time, like every other clock in this product: printed as
              UTC a 19:00 party reads as 14:00. */}
          {when ? when.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
        </strong>
        <span style={{ fontSize: 15, minWidth: 0 }}>{event?.customerName ?? '—'}</span>
        {event && (
          <span className="muted-text" style={{ fontSize: 12.5 }}>#{event.eventNumber}</span>
        )}
        <span className="muted-text" style={{ fontSize: 12.5, marginLeft: 'auto' }}>
          {event?.hall?.name ?? ''}
        </span>
      </header>

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 13 }}>
        {tables && <span>{t('fe_table')}: <strong>{tables}</strong></span>}
        {!!event?.guestCount && <span>{t('guest_count')}: <strong>{event.guestCount}</strong></span>}
        <span>{t('fe_portions')}: <strong>{portions}</strong></span>
      </div>

      <div style={{ display: 'grid', gap: 6 }}>
        {order.items.map((line) => (
          <div key={line.id} style={{ display: 'flex', gap: 10, fontSize: 14 }}>
            <span className="muted-text" style={{ fontVariantNumeric: 'tabular-nums', minWidth: 28 }}>
              {line.quantity}×
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>{line.nameSnapshot}</span>
            <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
              {formatSum(line.unitPriceCents * line.quantity)}
            </span>
          </div>
        ))}
      </div>

      {order.comment && (
        <p style={{
          margin: 0, fontSize: 13.5, lineHeight: 1.55, padding: '9px 12px',
          borderRadius: 10, background: 'rgba(255,255,255,0.05)',
        }}>
          💬 {order.comment}
        </p>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span className="adm-label" style={{ margin: 0 }}>{t('fe_order_total')}</span>
        <strong style={{ fontSize: 18, color: 'var(--adm-title, #fff)' }}>{formatSum(orderTotalCents(order))}</strong>
        <button type="button"
          className={action.danger ? 'adm-btn-danger adm-btn-sm' : 'adm-btn-primary adm-btn-sm'}
          style={{ marginLeft: 'auto' }}
          disabled={action.busy} onClick={action.onPress}>
          {action.label}
        </button>
      </div>
    </article>
  );
}

function errorMessage(error: unknown): string | null {
  const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
  return typeof message === 'string' && message.trim() ? message : null;
}
