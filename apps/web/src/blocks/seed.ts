import type { Block, BlockType } from './types';
import { createBlock } from './types';
import type { Invitation } from '../services/invitation.service';
import { normalizeGalleryItems } from '../services/invitation.service';
import type { GuestInvitation } from '../services/guestInvitation.service';
import type { DesignTheme } from '../services/designTemplate.service';

// Build a block with overridden props on top of its defaults.
function block(type: BlockType, props: Record<string, unknown>): Block {
  const b = createBlock(type);
  b.props = { ...b.props, ...props };
  return b;
}

// ── Flyer (restaurant Invitation) → blocks ──────────────────────────────────
export function seedFlyerBlocks(inv: Partial<Invitation>): Block[] {
  const out: Block[] = [];
  if (inv.promoTitle || inv.promoImageUrl || inv.promoCode) {
    out.push(block('promo', { title: inv.promoTitle ?? '', imageUrl: inv.promoImageUrl ?? '', code: inv.promoCode ?? '', subtitle: inv.promoSubtitle ?? '' }));
  }
  if (inv.promoCodeAlt || inv.promoDescription) {
    out.push(block('heading', { text: inv.promoCodeAlt ?? '' }));
    if (inv.promoDescription) out.push(block('text', { text: inv.promoDescription }));
  }
  if (inv.telegramUrl) out.push(block('button', { label: inv.telegramLabel ?? 'TELEGRAM', action: { kind: 'telegram', value: inv.telegramUrl } }));
  if (inv.welcomeTitle || inv.welcomeImageUrl || inv.welcomeMessage) {
    if (inv.welcomeImageUrl) out.push(block('image', { url: inv.welcomeImageUrl }));
    if (inv.welcomeTitle) out.push(block('heading', { text: inv.welcomeTitle }));
    if (inv.welcomeSubtitle) out.push(block('text', { text: inv.welcomeSubtitle }));
    if (inv.welcomeMessage) out.push(block('text', { text: inv.welcomeMessage }));
  }
  if (inv.countdownAt) out.push(block('countdown', { targetAt: inv.countdownAt, label: inv.countdownLabel ?? '' }));
  if (inv.menuItems && inv.menuItems.length) out.push(block('menu', { title: 'МЕНЮ · MENU', items: inv.menuItems }));
  if (inv.galleryPhotos && inv.galleryPhotos.length) out.push(block('gallery', { items: normalizeGalleryItems(inv.galleryPhotos) }));
  out.push(block('contacts', { title: inv.contactsTitle ?? 'НАШИ КОНТАКТЫ', phone: inv.phone ?? '', instagramUrl: inv.instagramUrl ?? '', telegramUrl: inv.telegramUrl ?? '' }));
  // Contact card for reaching V-connect — always present (rendered after the
  // mandatory attribution footer). Empty by default; the manager fills it in.
  out.push(block('vccontact', {}));
  return out;
}

export function flyerTheme(inv: Partial<Invitation>): DesignTheme {
  return {
    accentColor: inv.accentColor ?? '#c9a42c',
    backgroundColor: inv.backgroundColor ?? '#fafaf7',
    backgroundImageUrl: inv.backgroundImageUrl ?? null,
    textColor: inv.textColor ?? null,
    textScale: inv.textScale ?? 1,
    particles: inv.particles ?? null,
    particlesImageUrl: inv.particlesImageUrl ?? null,
    particlesColor: inv.particlesColor ?? null,
    trailTemplate: inv.trailTemplate ?? 'sparkle',
    trailColor: inv.trailColor ?? null,
    trailImageUrl: inv.trailImageUrl ?? null,
    musicUrl: inv.musicUrl ?? null,
  };
}

// ── Standalone Invitation → blocks ──────────────────────────────────────────
export function seedInvitationBlocks(inv: Partial<GuestInvitation>): Block[] {
  const out: Block[] = [];
  if (inv.coupleNames || inv.heroImageUrl) {
    out.push(block('hero', { title: inv.coupleNames ?? '', subtitle: inv.heroSubtitle ?? 'ЛИСТАЙТЕ ВНИЗ', imageUrl: inv.heroImageUrl ?? '' }));
  }
  if (inv.greetingTitle || inv.greetingMessage) {
    if (inv.greetingTitle) out.push(block('heading', { text: inv.greetingTitle }));
    if (inv.greetingMessage) out.push(block('text', { text: inv.greetingMessage }));
    if (inv.coupleSignature) out.push(block('heading', { text: inv.coupleSignature }));
  }
  if (inv.venueName || inv.venueImageUrl) {
    if (inv.venueLabel) out.push(block('text', { text: inv.venueLabel }));
    if (inv.venueName) out.push(block('heading', { text: inv.venueName }));
    if (inv.venueImageUrl) out.push(block('image', { url: inv.venueImageUrl }));
  }
  if (inv.mapAddress) out.push(block('map', { label: inv.mapButtonLabel ?? 'КАРТА', address: inv.mapAddress }));
  if (inv.countdownAt) out.push(block('countdown', { targetAt: inv.countdownAt, label: inv.countdownLabel ?? '' }));
  if (inv.rsvpEnabled !== false) out.push(block('rsvp', { title: inv.rsvpTitle ?? 'ПОДТВЕРДИТЕ ПРИСУТСТВИЕ' }));
  out.push(block('contacts', { title: 'НАШИ КОНТАКТЫ', phone: inv.phone ?? '', telegramUrl: inv.telegramUrl ?? '', instagramUrl: inv.instagramUrl ?? '' }));
  return out;
}

export function invitationTheme(inv: Partial<GuestInvitation>): DesignTheme {
  return {
    accentColor: inv.accentColor ?? '#c9a42c',
    backgroundColor: inv.backgroundColor ?? '#fafaf7',
    backgroundImageUrl: inv.backgroundImageUrl ?? null,
    textColor: inv.textColor ?? null,
    textScale: inv.textScale ?? 1,
    particles: inv.particles ?? null,
    musicUrl: inv.musicUrl ?? null,
    trailTemplate: inv.trailTemplate ?? 'hearts',
    trailColor: inv.trailColor ?? '#c2185b',
  };
}
