import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { EventList } from '../components/events/EventList';
import { eventService } from '../services/event.service';
import { hallService } from '../services/hall.service';
import { tableCategoryService } from '../services/tableCategory.service';
import { useAdminStore } from '../store/admin.store';
import { translate } from '../utils/translate';
import type { Event } from '../types/domain';
import { Input } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { Button } from '../components/ui/button';

const parsePositiveInt = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
};

const eventTypes: NonNullable<Event['eventType']>[] = ['RESERVATION', 'BANQUET', 'WEDDING', 'PRIVATE_PARTY', 'CORPORATE'];

export const AdminEventsPage = () => {
  const queryClient = useQueryClient();
  const { locale } = useAdminStore();
  const t = (key: Parameters<typeof translate>[0], params?: Record<string, string | number>) => translate(key, locale, params);
  const { data: events, isLoading, isError } = useQuery({
    queryKey: ['events'],
    queryFn: () => eventService.list()
  });

  const { data: halls } = useQuery({
    queryKey: ['halls'],
    queryFn: () => hallService.list()
  });

  const { data: tableCategories } = useQuery({
    queryKey: ['tableCategories'],
    queryFn: () => tableCategoryService.list()
  });

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [eventDateLocal, setEventDateLocal] = useState('');
  const [guestCountText, setGuestCountText] = useState('50');
  const [eventType, setEventType] = useState<NonNullable<Event['eventType']>>('RESERVATION');
  const [status, setStatus] = useState<NonNullable<Event['status']>>('DRAFT');
  const [hallId, setHallId] = useState('');
  const [tableCategoryId, setTableCategoryId] = useState('');
  const [notes, setNotes] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);

  const validation = useMemo(() => {
    const errors: string[] = [];

    if (customerName.trim().length < 2) errors.push('Customer name must be at least 2 characters.');

    if (!eventDateLocal) {
      errors.push('Event date/time is required.');
    } else if (Number.isNaN(new Date(eventDateLocal).getTime())) {
      errors.push('Event date/time is invalid.');
    }

    const guestCount = parsePositiveInt(guestCountText);
    if (guestCount === null) errors.push('Guest count must be a positive integer.');
    if (guestCount !== null && guestCount > 5000) errors.push('Guest count must be 5000 or less.');

    if (tableCategoryId && tableCategories && !tableCategories.find((category) => category.id === tableCategoryId)) {
      errors.push('Selected table category is invalid.');
    }

    return { errors, guestCount };
  }, [customerName, eventDateLocal, guestCountText, tableCategoryId, tableCategories]);

  const createMutation = useMutation({
    mutationFn: () => {
      if (validation.errors.length > 0 || validation.guestCount === null) {
        throw new Error(validation.errors[0] ?? 'Invalid form');
      }

      const date = new Date(eventDateLocal);
      if (Number.isNaN(date.getTime())) {
        throw new Error('Invalid event date/time');
      }

      return eventService.create({
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() ? customerPhone.trim() : undefined,
        eventDate: date.toISOString(),
        guestCount: validation.guestCount,
        status,
        eventType,
        hallId: hallId ? hallId : undefined,
        tableCategoryId: tableCategoryId ? tableCategoryId : undefined,
        notes: notes.trim() ? notes.trim() : undefined
      });
    },
    onSuccess: async () => {
      setCustomerName('');
      setCustomerPhone('');
      setEventDateLocal('');
      setGuestCountText('50');
      setStatus('DRAFT');
      setEventType('RESERVATION');
      setHallId('');
      setTableCategoryId('');
      setNotes('');
      await queryClient.invalidateQueries({ queryKey: ['events'] });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ eventId, data }: { eventId: number; data: any }) =>
      eventService.update(eventId, data),
    onSuccess: async () => {
      setEditingId(null);
      setCustomerName('');
      setCustomerPhone('');
      setEventDateLocal('');
      setGuestCountText('50');
      setStatus('DRAFT');
      setEventType('RESERVATION');
      setHallId('');
      setTableCategoryId('');
      setNotes('');
      await queryClient.invalidateQueries({ queryKey: ['events'] });
    }
  });

  const deleteMutation = useMutation<void, Error, number>({
    mutationFn: (eventId) => eventService.remove(eventId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['events'] });
    }
  });

  const canSubmit = validation.errors.length === 0 && !createMutation.isPending;
  const canSave = validation.errors.length === 0 && !updateMutation.isPending;

  return (
    <main style={{ padding: 20 }}>
      <h1>{t('banquet_events')}</h1>

      <section style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12, marginBottom: 16 }}>
        <h3>{editingId ? t('edit_existing_event') : t('create_new_event')}</h3>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const date = new Date(eventDateLocal);
            if (!eventDateLocal || Number.isNaN(date.getTime())) return;

            if (editingId) {
              if (!canSave || updateMutation.isPending) return;
              updateMutation.mutate({
                eventId: editingId,
                data: {
                  customerName: customerName.trim(),
                  customerPhone: customerPhone.trim() ? customerPhone.trim() : undefined,
                  eventDate: date.toISOString(),
                  guestCount: validation.guestCount ?? 0,
                  status,
                  eventType,
                  hallId: hallId ? hallId : undefined,
                  tableCategoryId: tableCategoryId ? tableCategoryId : undefined,
                  notes: notes.trim() ? notes.trim() : undefined
                }
              });
            } else {
              if (!canSubmit || createMutation.isPending) return;
              createMutation.mutate();
            }
          }}
          style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, alignItems: 'end' }}
        >
          <label style={{ display: 'grid', gap: 6 }}>
            {t('customer_name')}
            <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            {t('phone_number')}
            <Input
              type="tel"
              placeholder="e.g., +7 999 123 45 67"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
            />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            {t('event_date_time')}
            <Input
              type="datetime-local"
              value={eventDateLocal}
              onChange={(e) => setEventDateLocal(e.target.value)}
            />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            {t('guests')}
            <Input
              type="number"
              min={1}
              max={5000}
              inputMode="numeric"
              value={guestCountText}
              onChange={(e) => setGuestCountText(e.target.value)}
            />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            {t('event_type')}
            <Select value={eventType} onChange={(e) => setEventType(e.target.value as NonNullable<Event['eventType']>)}>
              {eventTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </Select>
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            {t('status')}
            <Select value={status} onChange={(e) => setStatus(e.target.value as NonNullable<Event['status']>)}>
              <option value="DRAFT">DRAFT</option>
              <option value="CONFIRMED">CONFIRMED</option>
              <option value="CANCELLED">CANCELLED</option>
            </Select>
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            {t('hall_optional')}
            <Select value={hallId} onChange={(e) => setHallId(e.target.value)}>
              <option value="">{t('select_hall')}</option>
              {halls?.map((hall) => (
                <option key={hall.id} value={hall.id}>
                  {hall.name} (Cap: {hall.capacity})
                </option>
              ))}
            </Select>
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            {t('table_category_optional')}
            <Select value={tableCategoryId} onChange={(e) => setTableCategoryId(e.target.value)}>
              <option value="">{t('choose_table_category')}</option>
              {tableCategories?.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name} - {category.mealPackage} ({category.seatingCapacity} seats, {Number(category.ratePerPerson / 100).toFixed(2)} per person)
                </option>
              ))}
            </Select>
          </label>
          <label style={{ display: 'grid', gap: 6, gridColumn: '1 / -1' }}>
            {t('notes')}
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 12, alignItems: 'center' }}>
            <Button type="submit" disabled={editingId ? !canSave : !canSubmit}>
              {editingId
                ? updateMutation.isPending
                  ? t('updating')
                  : t('update_event')
                : createMutation.isPending
                ? t('creating')
                : t('create_event')}
            </Button>
            {editingId ? (
              <Button
                variant="secondary"
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setCustomerName('');
                  setCustomerPhone('');
                  setEventDateLocal('');
                  setGuestCountText('50');
                  setStatus('DRAFT');
                  setEventType('RESERVATION');
                  setHallId('');
                  setTableCategoryId('');
                  setNotes('');
                }}
              >
                {t('cancel')}
              </Button>
            ) : null}
            {validation.errors.length > 0 ? (
              <span style={{ color: '#b00020' }}>{validation.errors[0]}</span>
            ) : null}
            {editingId ? (
              updateMutation.isError ? (
                <span style={{ color: '#b00020' }}>
                  {updateMutation.error instanceof Error ? updateMutation.error.message : 'Failed to update event.'}
                </span>
              ) : null
            ) : createMutation.isError ? (
              <span style={{ color: '#b00020' }}>
                {createMutation.error instanceof Error ? createMutation.error.message : 'Failed to create event.'}
              </span>
            ) : null}
          </div>
        </form>
      </section>

      {isLoading ? <p>{t('loading_events')}</p> : null}
      {isError ? <p>{t('failed_load_events')}</p> : null}
      {events ? (
        <EventList
          events={events}
          onEdit={(eventId) => {
            const event = events.find((item) => item.id === eventId);
            if (!event) return;

            setEditingId(event.id);
            setCustomerName(event.customerName);
            setCustomerPhone(event.customerPhone ?? '');
            const eventDate = new Date(event.eventDate);
            const localISO = new Date(eventDate.getTime() - eventDate.getTimezoneOffset() * 60000)
              .toISOString()
              .slice(0, 16);
            setEventDateLocal(localISO);
            setGuestCountText(event.guestCount.toString());
            setEventType(event.eventType ?? 'RESERVATION');
            setStatus(event.status);
            setHallId(event.hallId ?? '');
            setTableCategoryId(event.tableCategoryId ?? '');
            setNotes(event.notes ?? '');
          }}
          onDelete={(eventId) => deleteMutation.mutate(eventId)}
          deletingId={deleteMutation.isPending ? deleteMutation.variables ?? null : null}
        />
      ) : null}
    </main>
  );
};
