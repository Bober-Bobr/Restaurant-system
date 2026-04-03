import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { hallService } from '../services/hall.service';

const parsePositiveInt = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
};

export const AdminHallsPage = () => {
  const queryClient = useQueryClient();
  const { data: halls, isLoading, isError } = useQuery({
    queryKey: ['halls'],
    queryFn: () => hallService.list()
  });

  const [name, setName] = useState('');
  const [capacityText, setCapacityText] = useState('100');
  const [description, setDescription] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editCapacityText, setEditCapacityText] = useState('100');
  const [editDescription, setEditDescription] = useState('');
  const [editPhotoUrl, setEditPhotoUrl] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);

  const validation = useMemo(() => {
    const errors: string[] = [];

    if (name.trim().length < 1) errors.push('Name is required.');
    if (name.trim().length > 100) errors.push('Name must be 100 characters or less.');

    const capacity = parsePositiveInt(capacityText);
    if (capacity === null) errors.push('Capacity must be a positive integer.');
    if (capacity !== null && capacity > 5000) errors.push('Capacity must be 5000 or less.');

    return { errors, capacity };
  }, [name, capacityText]);

  const editValidation = useMemo(() => {
    const errors: string[] = [];

    if (editName.trim().length < 1) errors.push('Name is required.');
    if (editName.trim().length > 100) errors.push('Name must be 100 characters or less.');

    const capacity = parsePositiveInt(editCapacityText);
    if (capacity === null) errors.push('Capacity must be a positive integer.');
    if (capacity !== null && capacity > 5000) errors.push('Capacity must be 5000 or less.');

    return { errors, capacity };
  }, [editName, editCapacityText]);

  const createMutation = useMutation({
    mutationFn: () => {
      if (validation.errors.length > 0 || validation.capacity === null) {
        throw new Error(validation.errors[0] ?? 'Invalid form');
      }

      return hallService.create({
        name: name.trim(),
        capacity: validation.capacity,
        description: description.trim() ? description.trim() : undefined,
        photoUrl: photoUrl.trim() ? photoUrl.trim() : undefined,
        isActive: true
      });
    },
    onSuccess: async () => {
      setName('');
      setCapacityText('100');
      setDescription('');
      await queryClient.invalidateQueries({ queryKey: ['halls'] });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => hallService.update(id, data),
    onSuccess: async () => {
      setEditingId(null);
      await queryClient.invalidateQueries({ queryKey: ['halls'] });
    }
  });

  const deleteMutation = useMutation<void, Error, string>({
    mutationFn: (id) => hallService.remove(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['halls'] });
    }
  });

  const startEditing = (hall: any) => {
    setEditingId(hall.id);
    setEditName(hall.name);
    setEditCapacityText(hall.capacity.toString());
    setEditDescription(hall.description || '');
    setEditPhotoUrl(hall.photoUrl || '');
    setEditIsActive(hall.isActive);
  };

  const saveEdit = () => {
    if (!editingId || editValidation.errors.length > 0 || editValidation.capacity === null) return;

    updateMutation.mutate({
      id: editingId,
      data: {
        name: editName.trim(),
        capacity: editValidation.capacity,
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
      <h1>Halls</h1>

      <section style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12, marginBottom: 16 }}>
        <h3>Create new hall</h3>
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
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Main Hall" />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            Capacity
            <input
              type="number"
              min={1}
              max={5000}
              inputMode="numeric"
              value={capacityText}
              onChange={(e) => setCapacityText(e.target.value)}
            />
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
              {createMutation.isPending ? 'Creating...' : 'Create hall'}
            </button>
            {validation.errors.length > 0 ? (
              <span style={{ color: '#b00020' }}>{validation.errors[0]}</span>
            ) : null}
            {createMutation.isError ? (
              <span style={{ color: '#b00020' }}>
                {createMutation.error instanceof Error ? createMutation.error.message : 'Failed to create hall.'}
              </span>
            ) : null}
          </div>
        </form>
      </section>

      {isLoading ? <p>Loading halls...</p> : null}
      {isError ? <p>Failed to load halls.</p> : null}
      {halls && (
        <section style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>
          <h3>All Halls</h3>
          {halls.length === 0 ? (
            <p>No halls yet.</p>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {halls.map((hall) => (
                <div
                  key={hall.id}
                  style={{
                    border: '1px solid #eee',
                    padding: 12,
                    borderRadius: 4,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  {editingId === hall.id ? (
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
                          max={5000}
                          value={editCapacityText}
                          onChange={(e) => setEditCapacityText(e.target.value)}
                        />
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
                        {hall.photoUrl ? (
                          <img
                            src={hall.photoUrl}
                            alt={hall.name}
                            style={{ width: 80, height: 60, objectFit: 'cover', borderRadius: 4 }}
                          />
                        ) : null}
                        <div>
                          <strong>{hall.name}</strong>
                          <p style={{ margin: '4px 0 0', fontSize: '0.9em', color: '#666' }}>
                            Capacity: {hall.capacity}
                            {hall.description ? ` - ${hall.description}` : ''}
                            {!hall.isActive && ' (Inactive)'}
                          </p>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          onClick={() => startEditing(hall)}
                          style={{ background: '#28a745', color: 'white', padding: '4px 8px', border: 'none', borderRadius: 4 }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteMutation.mutate(hall.id)}
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
