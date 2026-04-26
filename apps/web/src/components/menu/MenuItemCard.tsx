import { useState } from 'react';
import type { MenuItem } from '../../types/domain';
import { getPhotoUrl } from '../../utils/photoUrl';
import { Card } from '../ui/card';
import { Lightbox } from '../ui/lightbox';

type MenuItemCardProps = {
  item: MenuItem;
  quantity: number;
  onQuantityChange: (nextQuantity: number) => void;
};

export const MenuItemCard = ({ item, quantity, onQuantityChange }: MenuItemCardProps) => {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const photoSrc = getPhotoUrl(item.photoUrl);

  return (
    <Card className="group flex flex-col overflow-hidden p-0 transition-shadow duration-300 hover:shadow-md">
      {/* Image */}
      <div className="relative overflow-hidden">
        {photoSrc ? (
          <>
            <button
              type="button"
              onClick={() => setLightboxOpen(true)}
              className="block w-full overflow-hidden"
            >
              <img
                src={photoSrc}
                alt={item.name}
                className="h-48 w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
              />
              <div className="absolute inset-0 bg-black/0 transition-colors duration-300 group-hover:bg-black/10" />
            </button>
            {lightboxOpen && (
              <Lightbox src={photoSrc} alt={item.name} onClose={() => setLightboxOpen(false)} />
            )}
          </>
        ) : (
          <div className="flex h-48 items-center justify-center bg-stone-50">
            <svg className="h-10 w-10 text-stone-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
        {quantity > 0 && (
          <div className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-stone-900 text-sm font-bold text-white shadow-lg">
            {quantity}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-4">
        <div className="flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold leading-snug text-stone-900">{item.name || 'Menu Item'}</h3>
            <span className="shrink-0 text-base font-bold text-stone-900">
              ${(Number(item.priceCents ?? 0) / 100).toFixed(2)}
            </span>
          </div>
          <p className="mt-0.5 text-xs font-medium uppercase tracking-widest text-stone-400">
            {item.category ? item.category.replace(/_/g, ' ') : 'General'}
          </p>
          {item.description && (
            <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-stone-500">{item.description}</p>
          )}
        </div>

        {/* Controls */}
        <div className="mt-4">
          {quantity === 0 ? (
            <button
              type="button"
              onClick={() => onQuantityChange(1)}
              className="w-full rounded-xl bg-stone-900 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:bg-stone-700 active:scale-[0.98]"
            >
              Add
            </button>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => onQuantityChange(0)}
                className="text-xs text-stone-400 transition-colors hover:text-stone-600 hover:underline underline-offset-2"
              >
                Remove
              </button>
              <div className="flex items-center gap-1 rounded-xl bg-stone-100 p-1">
                <button
                  type="button"
                  onClick={() => onQuantityChange(Math.max(0, quantity - 1))}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-lg font-medium text-stone-700 transition-all hover:bg-stone-200 active:scale-90"
                >
                  −
                </button>
                <span className="w-6 text-center text-sm font-semibold text-stone-900">{quantity}</span>
                <button
                  type="button"
                  onClick={() => onQuantityChange(quantity + 1)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-stone-900 text-lg font-medium text-white transition-all hover:bg-stone-700 active:scale-90"
                >
                  +
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};
