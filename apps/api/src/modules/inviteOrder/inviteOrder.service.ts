import createHttpError from 'http-errors';
import { prisma } from '../../db/prisma.js';
import { isPromoCode, normalizePromoCode, quoteOrder, type OrderTier } from '../../utils/invitePromo.js';
import { forwardInviteOrder } from '../telegram/telegram.service.js';
import type { CreateInviteOrderInput } from './inviteOrder.schema.js';

// ── Invitation orders from the promotional site ──────────────────────────────
// The studio works from Telegram, so the forward is the point of the feature.
// The row is written FIRST and the forward is best-effort on top of it: a bot
// token that has been revoked, a Telegram outage or a studio that has not
// subscribed any chat yet must not be the reason a customer's details are lost.

const TIER_LABEL: Record<OrderTier, string> = {
  STANDARD: 'Standard',
  PREMIUM: 'Premium',
  LUXURY: 'Luxury',
};

export class InviteOrderService {
  async create(input: CreateInviteOrderInput) {
    const name = input.name.trim();
    const phone = input.phone.trim();
    if (!name) throw createHttpError(400, 'A name is required.');
    if (!phone) throw createHttpError(400, 'A phone number is required.');

    const raw = input.promoCode?.trim() ?? '';
    // Refused rather than quietly quoted at full price: the form showed this
    // visitor a reduced figure, and charging more without saying so is the one
    // outcome worth failing over. The form blocks it too, so this is the
    // hand-made request.
    if (raw && !isPromoCode(raw)) {
      throw createHttpError(400, `Promo code ${normalizePromoCode(raw)} was not recognised.`);
    }

    const quote = quoteOrder(input.tier, raw || null);

    const order = await prisma.inviteOrder.create({
      data: {
        name,
        phone,
        tier: quote.tier,
        promoCode: quote.promoCode,
        listCents: quote.listCents,
        discountCents: quote.discountCents,
        totalCents: quote.totalCents,
      },
    });

    // Never block the customer's confirmation on Telegram. `forwardInviteOrder`
    // already swallows Bot API failures; this catch covers the database read it
    // does for the subscriber list.
    await forwardInviteOrder({
      name: order.name,
      phone: order.phone,
      tierLabel: TIER_LABEL[quote.tier],
      promoCode: order.promoCode,
      listCents: order.listCents,
      discountCents: order.discountCents,
      totalCents: order.totalCents,
    }).catch((err) => console.warn('[invite-order] forward failed:', err instanceof Error ? err.message : err));

    // The visitor is told what they will be charged, echoed from the row that
    // was actually written rather than from what they sent.
    return {
      id: order.id,
      createdAt: order.createdAt,
      tier: order.tier,
      promoCode: order.promoCode,
      listCents: order.listCents,
      discountCents: order.discountCents,
      totalCents: order.totalCents,
    };
  }

  async list() {
    return prisma.inviteOrder.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async unreadCount() {
    return prisma.inviteOrder.count({ where: { isRead: false } });
  }

  async setRead(id: string, isRead: boolean) {
    const existing = await prisma.inviteOrder.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw createHttpError(404, 'Order not found');
    return prisma.inviteOrder.update({ where: { id }, data: { isRead } });
  }

  async remove(id: string) {
    const existing = await prisma.inviteOrder.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw createHttpError(404, 'Order not found');
    await prisma.inviteOrder.delete({ where: { id } });
  }
}
