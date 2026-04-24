import { useState } from 'react';
import type { MenuItem } from '../../types/domain';
import { getPhotoUrl } from '../../utils/photoUrl';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
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
    <Card className="space-y-4 p-4">
      {photoSrc ? (
        <>
          <button
            type="button"
            onClick={() => setLightboxOpen(true)}
            className="group relative w-full overflow-hidden rounded-2xl"
          >
            <img
              src={photoSrc}
              alt={item.name}
              className="h-40 w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/20 rounded-2xl">
              <svg className="h-8 w-8 text-white opacity-0 drop-shadow group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
              </svg>
            </div>
          </button>
          {lightboxOpen && (
            <Lightbox src={photoSrc} alt={item.name} onClose={() => setLightboxOpen(false)} />
          )}
        </>
      ) : (
        <div className="flex h-40 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-sm text-slate-400">
          No image
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">{item.name || 'Menu Item'}</h3>
            <p className="text-sm uppercase tracking-[0.2em] text-slate-500">
              {(item.category ? item.category.replace(/_/g, ' ') : 'General')}
            </p>
          </div>
          <div className="text-right text-lg font-semibold text-slate-900">
            ${(Number(item.priceCents ?? 0) / 100).toFixed(2)}
          </div>
        </div>
        {item.description ? (
          <p className="text-sm leading-6 text-slate-600">{item.description}</p>
        ) : null}
      </div>

      <div className="grid gap-3">
        <div className="grid gap-2">
          <label className="text-sm font-medium text-slate-700">Qty</label>
          <Input
            type="number"
            min={0}
            value={quantity}
            onChange={(event) => onQuantityChange(Number(event.target.value))}
            className="w-full"
          />
        </div>
        <Button
          variant={quantity > 0 ? 'accent' : 'secondary'}
          onClick={() => onQuantityChange(quantity > 0 ? 0 : 1)}
        >
          {quantity > 0 ? 'Remove' : 'Add'}
        </Button>
      </div>
    </Card>
  );
};
