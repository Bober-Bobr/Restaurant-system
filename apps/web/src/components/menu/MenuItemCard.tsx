import { useState } from 'react';
import type { MenuItem } from '../../types/domain';
import { getPhotoUrl } from '../../utils/photoUrl';
import { formatSum } from '../../utils/currency';
import { Card } from '../ui/card';
import { Lightbox } from '../ui/lightbox';

type MenuItemCardProps = {
  item: MenuItem;
  quantity: number;
  onQuantityChange: (nextQuantity: number) => void;
  dark?: boolean;
  viewOnly?: boolean;
};

export const MenuItemCard = ({ item, quantity, onQuantityChange, dark = false, viewOnly = false }: MenuItemCardProps) => {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const photoSrc = getPhotoUrl(item.photoUrl);

  const Wrapper = dark ? 'div' : Card;
  const wrapperProps = dark
    ? {
        className: 'group flex flex-col overflow-hidden rounded-2xl transition-all duration-300 hover:shadow-lg',
        style: { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)' },
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
            {lightboxOpen && <Lightbox src={photoSrc} alt={item.name} onClose={() => setLightboxOpen(false)} />}
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
            style={dark ? { background: '#c9a42c', color: '#1a3320' } : { background: '#1c1917', color: 'white' }}
          >
            {quantity}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-3">
        <div className="flex-1">
          {/* Category chip — gold-tinted so categories read at a glance */}
          <span className="mb-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
            style={dark
              ? { background: 'rgba(201,164,44,0.16)', color: '#d9b84a', border: '1px solid rgba(201,164,44,0.32)' }
              : { background: '#f6efd9', color: '#8a6d1a', border: '1px solid #ecdfb4' }}>
            {item.category ? item.category.replace(/_/g, ' ') : 'General'}
          </span>
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-semibold leading-snug" style={{ color: dark ? 'white' : '#1c1917' }}>
              {item.name || 'Menu Item'}
            </h3>
            <span className="shrink-0 text-sm font-bold" style={{ color: dark ? '#c9a42c' : '#1c1917' }}>
              {formatSum(Number(item.priceCents ?? 0))}
            </span>
          </div>
          {item.description && (
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed"
              style={{ color: dark ? 'rgba(255,255,255,0.55)' : '#78716c' }}>
              {item.description}
            </p>
          )}
        </div>

        {/* Controls — hidden in view-only mode */}
        {!viewOnly && (
        <div className="mt-3">
          {quantity === 0 ? (
            <button
              type="button"
              onClick={() => onQuantityChange(1)}
              className="w-full rounded-lg py-2 text-sm font-semibold transition-all duration-200 active:scale-[0.98]"
              style={dark
                ? { background: 'rgba(201,164,44,0.15)', color: '#c9a42c', border: '1px solid rgba(201,164,44,0.35)' }
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
                >
                  −
                </button>
                <span className="w-6 text-center text-sm font-semibold"
                  style={{ color: dark ? 'white' : '#1c1917' }}>
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => onQuantityChange(quantity + 1)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-lg font-medium transition-all active:scale-90"
                  style={dark ? { background: '#c9a42c', color: '#1a3320' } : { background: '#1c1917', color: 'white' }}
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
