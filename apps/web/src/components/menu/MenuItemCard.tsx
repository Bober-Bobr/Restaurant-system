import type { MenuItem } from '../../types/domain';

type MenuItemCardProps = {
  item: MenuItem;
  quantity: number;
  onQuantityChange: (nextQuantity: number) => void;
};

export const MenuItemCard = ({ item, quantity, onQuantityChange }: MenuItemCardProps) => {
  return (
    <article style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>
      {item.photoUrl && (
        <img 
          src={item.photoUrl} 
          alt={item.name} 
          style={{ width: '100%', height: '150px', objectFit: 'cover', borderRadius: 4, marginBottom: 8 }} 
        />
      )}
      <h4>{item.name}</h4>
      <p>{item.category.replace('_', ' ').toLowerCase()}</p>
      <p>${(item.priceCents / 100).toFixed(2)}</p>
      {item.description && <p style={{ fontSize: '0.9em', color: '#666' }}>{item.description}</p>}
      <label>
        Qty
        <input
          type="number"
          min={0}
          value={quantity}
          onChange={(event) => onQuantityChange(Number(event.target.value))}
        />
      </label>
    </article>
  );
};
