import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { tableCategoryService } from '../services/tableCategory.service';
import type { TableCategory } from '../types/domain';

const parsePositiveInt = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
};

export const AdminTableCategoriesPage = () => {
  const queryClient = useQueryClient();
  const { data: categories, isLoading, isError } = useQuery({
    queryKey: ['tableCategories'],
    queryFn: () => tableCategoryService.list()
  });

  const [name, setName] = useState('');
  const [seatingCapacityText, setSeatingCapacityText] = useState('2');
  const [mealPackage, setMealPackage] = useState('');
  const [ratePerPersonText, setRatePerPersonText] = useState('0');
  const [description, setDescription] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editSeatingCapacityText, setEditSeatingCapacityText] = useState('2');
  const [editMealPackage, setEditMealPackage] = useState('');
  const [editRatePerPersonText, setEditRatePerPersonText] = useState('0');
  const [editDescription, setEditDescription] = useState('');
  const [editPhotoUrl, setEditPhotoUrl] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);

  const validation = useMemo(() => {
    const errors: string[] = [];

    if (name.trim().length < 1) errors.push('Name is required.');
    if (name.trim().length > 100) errors.push('Name must be 100 characters or less.');

    const seatingCapacity = parsePositiveInt(seatingCapacityText);
    if (seatingCapacity === null) errors.push('Seating capacity must be a positive integer.');
    if (seatingCapacity !== null && seatingCapacity > 1000) errors.push('Seating capacity must be 1000 or less.');

    if (mealPackage.trim().length < 2) errors.push('Meal package must be at least 2 characters.');

    const ratePerPerson = Number(ratePerPersonText);
    if (!Number.isFinite(ratePerPerson) || ratePerPerson < 0) errors.push('Rate per person must be a non-negative number.');

    return { errors, seatingCapacity };
  }, [name, seatingCapacityText, mealPackage, ratePerPersonText]);

  const editValidation = useMemo(() => {
    const errors: string[] = [];

    if (editName.trim().length < 1) errors.push('Name is required.');
    if (editName.trim().length > 100) errors.push('Name must be 100 characters or less.');

    const seatingCapacity = parsePositiveInt(editSeatingCapacityText);
    if (seatingCapacity === null) errors.push('Seating capacity must be a positive integer.');
    if (seatingCapacity !== null && seatingCapacity > 1000) errors.push('Seating capacity must be 1000 or less.');

    if (editMealPackage.trim().length < 2) errors.push('Meal package must be at least 2 characters.');

    const ratePerPerson = Number(editRatePerPersonText);
    if (!Number.isFinite(ratePerPerson) || ratePerPerson < 0) errors.push('Rate per person must be a non-negative number.');

    return { errors, seatingCapacity };
  }, [editName, editSeatingCapacityText, editMealPackage, editRatePerPersonText]);

  const createMutation = useMutation({
    mutationFn: () => {
      if (validation.errors.length > 0 || validation.seatingCapacity === null) {
        throw new Error(validation.errors[0] ?? 'Invalid form');
      }

      return tableCategoryService.create({
        name: name.trim(),
        seatingCapacity: validation.seatingCapacity,
        mealPackage: mealPackage.trim(),
        ratePerPerson: Math.round(Number(ratePerPersonText) * 100),
        description: description.trim() ? description.trim() : undefined,
        photoUrl: photoUrl.trim() ? photoUrl.trim() : undefined,
        isActive: true
      });
    },
    onSuccess: async () => {
      setName('');
      setSeatingCapacityText('2');      setMealPackage('');
      setRatePerPersonText('0');      setDescription('');
      await queryClient.invalidateQueries({ queryKey: ['tableCategories'] });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<TableCategory> }) => tableCategoryService.update(id, data),
    onSuccess: async () => {
      setEditingId(null);
      await queryClient.invalidateQueries({ queryKey: ['tableCategories'] });
    }
  });

  const deleteMutation = useMutation<void, Error, string>({
    mutationFn: (id) => tableCategoryService.remove(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['tableCategories'] });
    }
  });

  const startEditing = (category: TableCategory) => {
    setEditingId(category.id);
    setEditName(category.name);
    setEditSeatingCapacityText(category.seatingCapacity.toString());
    setEditMealPackage(category.mealPackage);
    setEditRatePerPersonText((category.ratePerPerson / 100).toFixed(2));
    setEditDescription(category.description || '');
    setEditPhotoUrl(category.photoUrl || '');
    setEditIsActive(category.isActive);
  };

  const saveEdit = () => {
    if (!editingId || editValidation.errors.length > 0 || editValidation.seatingCapacity === null) return;

    updateMutation.mutate({
      id: editingId,
      data: {
        name: editName.trim(),
        seatingCapacity: editValidation.seatingCapacity,
        mealPackage: editMealPackage.trim(),
        ratePerPerson: Math.round(Number(editRatePerPersonText) * 100),
        description: editDescription.trim() || undefined,
        photoUrl: editPhotoUrl.trim() ? editPhotoUrl.trim() : undefined,
        isActive: editIsActive
      }
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const canSubmit = validation.errors.length === 0 && !createMutation.isPending;
  const canSaveEdit = editValidation.errors.length === 0 && !updateMutation.isPending;

  return (
    <main style={{ padding: 20 }}>
      <h1>Table Categories</h1>

      <section style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12, marginBottom: 16 }}>
        <h3>Create new table category</h3>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!canSubmit || createMutation.isPending) return;
            createMutation.mutate();
          }}
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignItems: 'end' }}
        >
          <label style={{ display: 'grid', gap: 6 }}>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., 2-person table" />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            Seating Capacity
            <input
              type="number"
              min={1}
              max={1000}
              inputMode="numeric"
              value={seatingCapacityText}
              onChange={(e) => setSeatingCapacityText(e.target.value)}
            />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            Meal Package
            <input value={mealPackage} onChange={(e) => setMealPackage(e.target.value)} />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            Rate Per Person (e.g. 10.00)
            <input value={ratePerPersonText} onChange={(e) => setRatePerPersonText(e.target.value)} />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            Photo URL (Optional)
            <input value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} placeholder="https://example.com/image.jpg" />
          </label>
          <label style={{ display: 'grid', gap: 6, gridColumn: '1 / -1' }}>
            Description (Optional)
            <input value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 12, alignItems: 'center' }}>
            <button type="submit" disabled={!canSubmit}>
              {createMutation.isPending ? 'Creating...' : 'Create category'}
            </button>
            {validation.errors.length > 0 ? (
              <span style={{ color: '#b00020' }}>{validation.errors[0]}</span>
            ) : null}
            {createMutation.isError ? (
              <span style={{ color: '#b00020' }}>
                {createMutation.error instanceof Error ? createMutation.error.message : 'Failed to create category.'}
              </span>
            ) : null}
          </div>
        </form>
      </section>

      {isLoading ? <p>Loading table categories...</p> : null}
      {isError ? <p>Failed to load table categories.</p> : null}
      {categories && (
        <section style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>
          <h3>All Categories</h3>
          {categories.length === 0 ? (
            <p>No table categories yet.</p>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {categories.map((category) => (
                <div
                  key={category.id}
                  style={{
                    border: '1px solid #eee',
                    padding: 12,
                    borderRadius: 4,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  {editingId === category.id ? (
                    <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 8, alignItems: 'end' }}>
                      <label style={{ display: 'grid', gap: 4 }}>
                        Name
                        <input value={editName} onChange={(e) => setEditName(e.target.value)} />
                      </label>
                      <label style={{ display: 'grid', gap: 4 }}>
                        Capacity
                        <input
                          type="number"
                          min={1}
                          max={1000}
                          value={editSeatingCapacityText}
                          onChange={(e) => setEditSeatingCapacityText(e.target.value)}
                        />
                      </label>
                      <label style={{ display: 'grid', gap: 4 }}>
                        Meal Package
                        <input value={editMealPackage} onChange={(e) => setEditMealPackage(e.target.value)} />
                      </label>
                      <label style={{ display: 'grid', gap: 4 }}>
                        Rate ($)
                        <input value={editRatePerPersonText} onChange={(e) => setEditRatePerPersonText(e.target.value)} />
                      </label>
                      <label style={{ display: 'grid', gap: 4 }}>
                        Description
                        <input value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
                      </label>
                      <label style={{ display: 'grid', gap: 4 }}>
                        Photo URL
                        <input value={editPhotoUrl} onChange={(e) => setEditPhotoUrl(e.target.value)} placeholder="https://example.com/image.jpg" />
                      </label>
                      <label style={{ display: 'grid', gap: 4 }}>
                        Active
                        <input
                          type="checkbox"
                          checked={editIsActive}
                          onChange={(e) => setEditIsActive(e.target.checked)}
                        />
                      </label>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          onClick={saveEdit}
                          disabled={!canSaveEdit}
                          style={{ background: '#007bff', color: 'white', padding: '4px 8px', border: 'none', borderRadius: 4 }}
                        >
                          {updateMutation.isPending ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          onClick={cancelEdit}
                          style={{ background: '#6c757d', color: 'white', padding: '4px 8px', border: 'none', borderRadius: 4 }}
                        >
                          Cancel
                        </button>
                      </div>
                      {editValidation.errors.length > 0 && (
                        <div style={{ gridColumn: '1 / -1', color: '#b00020', fontSize: '0.9em' }}>
                          {editValidation.errors[0]}
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        {category.photoUrl ? (
                          <img
                            src={category.photoUrl}
                            alt={category.name}
                            style={{ width: 80, height: 60, objectFit: 'cover', borderRadius: 4 }}
                          />
                        ) : null}
                        <div>
                          <strong>{category.name}</strong>
                          <p style={{ margin: '4px 0 0', fontSize: '0.9em', color: '#666' }}>
                            Capacity: {category.seatingCapacity}, Meal: {category.mealPackage}, Rate: ${(category.ratePerPerson / 100).toFixed(2)}
                            {category.description ? ` - ${category.description}` : ''}
                            {!category.isActive && ' (Inactive)'}
                          </p>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          onClick={() => startEditing(category)}
                          style={{ background: '#28a745', color: 'white', padding: '4px 8px', border: 'none', borderRadius: 4 }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteMutation.mutate(category.id)}
                          disabled={deleteMutation.isPending}
                          style={{ background: '#b00020', color: 'white', padding: '4px 8px', border: 'none', borderRadius: 4 }}
                        >
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  );
};
