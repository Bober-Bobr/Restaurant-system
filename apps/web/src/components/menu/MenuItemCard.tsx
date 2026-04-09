import type { MenuItem } from '../../types/domain';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card } from '../ui/card';

type MenuItemCardProps = {
  item: MenuItem;
  quantity: number;
  onQuantityChange: (nextQuantity: number) => void;
};

export const MenuItemCard = ({ item, quantity, onQuantityChange }: MenuItemCardProps) => {
  return (
    <Card className="space-y-4 p-4">
      {item.photoUrl ? (
        <img
          src={item.photoUrl}
          alt={item.name}
          className="h-40 w-full rounded-2xl object-cover"
        />
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
