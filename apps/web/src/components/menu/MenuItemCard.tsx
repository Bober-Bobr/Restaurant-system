import { useEffect, useState } from 'react';
import type { MenuItem } from '../../types/domain';
import { getPhotoUrl } from '../../utils/photoUrl';
import { formatSum } from '../../utils/currency';
import { dishName, dishDescription } from '../../utils/menuI18n';
import { defaultLocale, translate, type Locale } from '../../utils/translate';
import { Card } from '../ui/card';
import { Lightbox } from '../ui/lightbox';

type MenuItemCardProps = {
  item: MenuItem;
  quantity: number;
  onQuantityChange: (nextQuantity: number) => void;
  dark?: boolean;
  locale?: Locale;
  // Toggle mode: select/deselect only, no quantity counter (used for Extras,
  // which are priced per guest rather than by an entered quantity).
  toggleMode?: boolean;
  // Extras only: lets a paid dish replace an included complimentary dish of the
  // same category instead of being added as a paid item. When `activeTargetName`
  // is set the dish is currently standing in for that included dish (free).
  replace?: {
    canReplace: boolean;
    activeTargetName?: string | null;
    onOpen: () => void;
    onRevert: () => void;
  };
};

export const MenuItemCard = ({ item, quantity, onQuantityChange, dark = false, locale = defaultLocale, toggleMode = false, replace }: MenuItemCardProps) => {
  const localizedName = dishName(item, locale);
  const localizedDescription = dishDescription(item, locale);
  // Localized category label for the chip. Falls back to the humanized enum when
  // a category has no translation key (so nothing ever shows a raw ENUM_VALUE).
  const categoryLabel = (() => {
    if (!item.category) return translate('general', locale);
    const key = item.category.toLowerCase() as Parameters<typeof translate>[0];
    const translated = translate(key, locale);
    return translated === key ? item.category.replace(/_/g, ' ') : translated;
  })();
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const photoSrc = getPhotoUrl(item.photoUrl);
  const selected = quantity > 0;

  // Free-entry quantity: a local string lets the field be cleared/retyped without
  // immediately collapsing the card when it momentarily empties.
  const [qtyStr, setQtyStr] = useState(String(quantity));
  useEffect(() => { setQtyStr(String(quantity)); }, [quantity]);
  const commitQty = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 4);
    setQtyStr(digits);
    if (digits !== '') onQuantityChange(Math.min(9999, parseInt(digits, 10)));
  };

  const Wrapper = dark ? 'div' : Card;
  const wrapperProps = dark
    ? {
        className: 'group flex h-full flex-col overflow-hidden rounded-2xl transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5',
        style: {
          background: selected
            ? 'linear-gradient(160deg, rgba(var(--rg-accent-rgb),0.16) 0%, rgba(255,255,255,0.05) 60%)'
            : 'rgba(255,255,255,0.06)',
          border: selected ? '1px solid rgba(var(--rg-accent-rgb),0.55)' : '1px solid rgba(255,255,255,0.12)',
          backdropFilter: 'blur(8px)',
          boxShadow: selected ? '0 10px 28px rgba(var(--rg-accent-rgb),0.20)' : undefined,
        },
      }
    : { className: 'group flex flex-col overflow-hidden p-0 transition-all duration-300 hover:shadow-lg' };

  return (
    <Wrapper {...wrapperProps as any}>
      {/* Image */}
      <div className="relative overflow-hidden">
        {photoSrc ? (
          <>
            <button type="button" onClick={() => setLightboxOpen(true)} className="block w-full overflow-hidden">
              <img src={photoSrc} alt={item.name}
                className="h-32 w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]" />
              <div className="absolute inset-0 bg-black/0 transition-colors duration-300 group-hover:bg-black/10" />
            </button>
            {lightboxOpen && <Lightbox src={photoSrc} alt={item.name} onClose={() => setLightboxOpen(false)} compact />}
          </>
        ) : (
          <div
            className="flex h-32 items-center justify-center"
            style={dark ? { background: 'rgba(0,0,0,0.25)' } : { background: '#f8f7f5' }}
          >
            <svg className="h-9 w-9" style={{ color: dark ? 'rgba(255,255,255,0.15)' : '#d6d3d1' }}
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
        {quantity > 0 && (
          <div
            className="absolute right-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold shadow-lg"
            style={dark ? { background: 'var(--rg-accent)', color: 'var(--rg-bg)' } : { background: '#1c1917', color: 'white' }}
          >
            {toggleMode ? (
              <svg width="13" height="13" viewBox="0 0 12 12" fill="none">
                <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : quantity}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-3">
        <div className="flex-1">
          {/* Category chip — gold-tinted so categories read at a glance */}
          <span className="mb-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
            style={dark
              ? { background: 'rgba(var(--rg-accent-rgb),0.16)', color: 'var(--rg-accent-soft)', border: '1px solid rgba(var(--rg-accent-rgb),0.32)' }
              : { background: '#f6efd9', color: '#8a6d1a', border: '1px solid #ecdfb4' }}>
            {categoryLabel}
          </span>
          {/* Name then price on its own line below — the price is no longer
              squeezed onto the name row where narrow cards would clip it. */}
          <h3 className="text-sm font-semibold leading-snug" style={{ color: dark ? 'white' : '#1c1917' }}>
            {localizedName || 'Menu Item'}
          </h3>
          <span className="mt-1 block text-sm font-bold" style={{ color: dark ? 'var(--rg-accent)' : '#1c1917' }}>
            {formatSum(Number(item.priceCents ?? 0))}
          </span>
          {localizedDescription && (
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed"
              style={{ color: dark ? 'rgba(255,255,255,0.55)' : '#78716c' }}>
              {localizedDescription}
            </p>
          )}
        </div>

        {toggleMode && (
        <div className="mt-3 flex flex-col gap-2">
          {replace?.activeTargetName ? (
            // This paid dish is currently replacing an included complimentary dish
            // (served free in its place) — show that state with a revert action.
            <div className="rounded-lg px-3 py-2" style={{ background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.45)' }}>
              <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: '#93c5fd' }}>
                {translate('replacing_label', locale)}
              </p>
              <p className="mt-0.5 text-xs font-semibold" style={{ color: dark ? 'white' : '#1c1917' }}>
                {replace.activeTargetName}
              </p>
              <button
                type="button"
                onClick={replace.onRevert}
                className="mt-2 w-full rounded-md py-1.5 text-xs font-semibold"
                style={{ background: 'rgba(255,255,255,0.08)', color: dark ? 'rgba(255,255,255,0.75)' : '#44403c', border: '1px solid rgba(255,255,255,0.18)' }}
              >
                ↺ {translate('revert_to_default', locale)}
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => onQuantityChange(selected ? 0 : 1)}
                className="w-full rounded-lg py-2 text-sm font-semibold transition-all duration-200 active:scale-[0.98]"
                style={selected
                  ? (dark ? { background: 'var(--rg-accent)', color: 'var(--rg-bg)' } : { background: '#1c1917', color: 'white' })
                  : (dark ? { background: 'rgba(var(--rg-accent-rgb),0.15)', color: 'var(--rg-accent)', border: '1px solid rgba(var(--rg-accent-rgb),0.35)' } : { background: '#1c1917', color: 'white' })}
              >
                {selected ? `✓ ${translate('selected', locale)}` : translate('add', locale)}
              </button>
              {replace?.canReplace && !selected && (
                <button
                  type="button"
                  onClick={replace.onOpen}
                  className="w-full rounded-lg py-2 text-xs font-semibold transition-all duration-200 active:scale-[0.98]"
                  style={dark
                    ? { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.18)' }
                    : { background: '#f5f5f4', color: '#44403c', border: '1px solid #e7e5e4' }}
                >
                  ⇄ {translate('replace_included', locale)}
                </button>
              )}
            </>
          )}
        </div>
        )}

        {!toggleMode && (
        <div className="mt-3">
          {quantity === 0 ? (
            <button
              type="button"
              onClick={() => onQuantityChange(1)}
              className="w-full rounded-lg py-2 text-sm font-semibold transition-all duration-200 active:scale-[0.98]"
              style={dark
                ? { background: 'rgba(var(--rg-accent-rgb),0.15)', color: 'var(--rg-accent)', border: '1px solid rgba(var(--rg-accent-rgb),0.35)' }
                : { background: '#1c1917', color: 'white' }}
            >
              Add
            </button>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => onQuantityChange(0)}
                className="text-xs transition-colors hover:underline underline-offset-2"
                style={{ color: dark ? 'rgba(255,255,255,0.4)' : '#a8a29e' }}
              >
                Remove
              </button>
              <div className="flex items-center gap-1 rounded-xl p-1"
                style={{ background: dark ? 'rgba(255,255,255,0.1)' : '#f5f5f4' }}>
                <button
                  type="button"
                  onClick={() => onQuantityChange(Math.max(0, quantity - 1))}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-lg font-medium transition-all active:scale-90"
                  style={{ color: dark ? 'rgba(255,255,255,0.8)' : '#44403c' }}
                  aria-label="Decrease"
                >
                  −
                </button>
                <input
                  type="text"
                  inputMode="numeric"
                  value={qtyStr}
                  onChange={(e) => commitQty(e.target.value)}
                  onFocus={(e) => e.currentTarget.select()}
                  onBlur={() => { if (qtyStr === '') setQtyStr(String(quantity)); }}
                  className="w-10 bg-transparent text-center text-sm font-semibold outline-none"
                  style={{ color: dark ? 'white' : '#1c1917' }}
                  aria-label="Quantity"
                />
                <button
                  type="button"
                  onClick={() => onQuantityChange(quantity + 1)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-lg font-medium transition-all active:scale-90"
                  style={dark ? { background: 'var(--rg-accent)', color: 'var(--rg-bg)' } : { background: '#1c1917', color: 'white' }}
                  aria-label="Increase"
                >
                  +
                </button>
              </div>
            </div>
          )}
        </div>
        )}
      </div>
    </Wrapper>
  );
};
