import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { hallService } from '../services/hall.service';
import { useAdminStore } from '../store/admin.store';
import { translate } from '../utils/translate';
import { Input } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { Button } from '../components/ui/button';
import { PhotoSelector } from '../components/ui/photo-selector';

const parsePositiveInt = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
};

export const AdminHallsPage = () => {
  const queryClient = useQueryClient();
  const { locale } = useAdminStore();
  const t = (key: Parameters<typeof translate>[0], params?: Record<string, string | number>) => translate(key, locale, params);
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
      <h1>{t('halls_management')}</h1>

      <section style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12, marginBottom: 16 }}>
        <h3>{t('create_hall')}</h3>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!canSubmit || createMutation.isPending) return;
            createMutation.mutate();
          }}
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignItems: 'end' }}
        >
          <label style={{ display: 'grid', gap: 6 }}>
            {t('name')}
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('hall_name_placeholder')} />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            {t('hall_capacity')}
            <Input
              type="number"
              min={1}
              max={5000}
              inputMode="numeric"
              value={capacityText}
              onChange={(e) => setCapacityText(e.target.value)}
            />
          </label>
          <label style={{ display: 'grid', gap: 6, gridColumn: '1 / -1' }}>
            <PhotoSelector
              category="hall"
              selectedPhotoUrl={photoUrl || undefined}
              onPhotoSelect={(url) => setPhotoUrl(url || '')}
              placeholder={t('select_hall_photo')}
            />
          </label>
          <label style={{ display: 'grid', gap: 6, gridColumn: '1 / -1' }}>
            {t('description_optional')}
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 12, alignItems: 'center' }}>
            <Button type="submit" disabled={!canSubmit}>
              {createMutation.isPending ? t('creating') : t('create_hall_button')}
            </Button>
            {validation.errors.length > 0 ? (
              <span style={{ color: '#b00020' }}>{validation.errors[0]}</span>
            ) : null}
            {createMutation.isError ? (
              <span style={{ color: '#b00020' }}>
                {createMutation.error instanceof Error ? createMutation.error.message : t('failed_to_create_hall')}
              </span>
            ) : null}
          </div>
        </form>
      </section>

      {isLoading ? <p>{t('loading_halls')}</p> : null}
      {isError ? <p>{t('failed_to_load_halls')}</p> : null}
      {halls && (
        <section style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>
          <h3>{t('all_halls')}</h3>
          {halls.length === 0 ? (
            <p>{t('no_halls_yet')}</p>
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
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 8, alignItems: 'end', marginBottom: 12 }}>
                        <label style={{ display: 'grid', gap: 4 }}>
                          {t('name')}
                          <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                        </label>
                        <label style={{ display: 'grid', gap: 4 }}>
                          {t('hall_capacity')}
                          <Input
                            type="number"
                            min={1}
                            max={5000}
                            value={editCapacityText}
                            onChange={(e) => setEditCapacityText(e.target.value)}
                          />
                        </label>
                        <label style={{ display: 'grid', gap: 4 }}>
                          {t('hall_description')}
                          <Input value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
                        </label>
                        <label style={{ display: 'grid', gap: 4 }}>
                          {t('hall_active')}
                          <input
                            type="checkbox"
                            checked={editIsActive}
                            onChange={(e) => setEditIsActive(e.target.checked)}
                          />
                        </label>
                      </div>
                      <div style={{ marginBottom: 12 }}>
                        <PhotoSelector
                          category="hall"
                          selectedPhotoUrl={editPhotoUrl || undefined}
                          onPhotoSelect={(url) => setEditPhotoUrl(url || '')}
                          placeholder={t('select_hall_photo')}
                        />
                      </div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <Button
                          onClick={saveEdit}
                          disabled={!canSaveEdit}
                        >
                          {updateMutation.isPending ? t('saving') : t('save')}
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={cancelEdit}
                        >
                          {t('cancel')}
                        </Button>
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
                            {t('hall_capacity')}: {hall.capacity}
                            {hall.description ? ` - ${hall.description}` : ''}
                            {!hall.isActive && ` (${t('hall_inactive')})`}
                          </p>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          onClick={() => startEditing(hall)}
                          style={{ background: '#28a745', color: 'white', padding: '4px 8px', border: 'none', borderRadius: 4 }}
                        >
                          {t('edit')}
                        </button>
                        <button
                          onClick={() => deleteMutation.mutate(hall.id)}
                          disabled={deleteMutation.isPending}
                          style={{ background: '#b00020', color: 'white', padding: '4px 8px', border: 'none', borderRadius: 4 }}
                        >
                          {t('delete')}
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
