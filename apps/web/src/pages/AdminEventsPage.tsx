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
import { formatSum } from '../utils/currency';

const parsePositiveInt = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
};

// Binary search function for finding event by ID
const binarySearchEventById = (events: Event[], targetId: number): Event | null => {
  // Sort events by ID for binary search
  const sortedEvents = [...events].sort((a, b) => a.id - b.id);

  let left = 0;
  let right = sortedEvents.length - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const midEvent = sortedEvents[mid];

    if (midEvent.id === targetId) {
      return midEvent;
    } else if (midEvent.id < targetId) {
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }

  return null; // Event not found
};

const eventTypes: NonNullable<Event['eventType']>[] = ['RESERVATION', 'BANQUET', 'WEDDING', 'BIRTHDAY', 'PRIVATE_PARTY', 'CORPORATE'];

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
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [guestCountText, setGuestCountText] = useState('50');
  const [eventType, setEventType] = useState<NonNullable<Event['eventType']>>('RESERVATION');
  const [status, setStatus] = useState<NonNullable<Event['status']>>('DRAFT');
  const [hallId, setHallId] = useState('');
  const [tableCategoryId, setTableCategoryId] = useState('');
  const [notes, setNotes] = useState('');
  const [birthdayPersonName, setBirthdayPersonName] = useState('');
  const [brideName, setBrideName] = useState('');
  const [groomName, setGroomName] = useState('');
  const [honoreePersonName, setHonoreeName] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);

  // Search functionality
  const [searchId, setSearchId] = useState('');
  const [searchResult, setSearchResult] = useState<Event | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  const validation = useMemo(() => {
    const errors: string[] = [];

    if (customerName.trim().length < 2) errors.push('Customer name must be at least 2 characters.');

    if (!eventDate) {
      errors.push('Event date is required.');
    } else if (!eventTime) {
      errors.push('Event time is required.');
    } else if (Number.isNaN(new Date(`${eventDate}T${eventTime}`).getTime())) {
      errors.push('Event date/time is invalid.');
    }

    const guestCount = parsePositiveInt(guestCountText);
    if (guestCount === null) errors.push('Guest count must be a positive integer.');
    if (guestCount !== null && guestCount > 5000) errors.push('Guest count must be 5000 or less.');

    if (tableCategoryId && tableCategories && !tableCategories.find((category) => category.id === tableCategoryId)) {
      errors.push('Selected table category is invalid.');
    }

    return { errors, guestCount };
  }, [customerName, eventDate, eventTime, guestCountText, tableCategoryId, tableCategories]);

  const createMutation = useMutation({
    mutationFn: () => {
      if (validation.errors.length > 0 || validation.guestCount === null) {
        throw new Error(validation.errors[0] ?? 'Invalid form');
      }

      const date = new Date(`${eventDate}T${eventTime}`);
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
        notes: notes.trim() ? notes.trim() : undefined,
        birthdayPersonName: eventType === 'BIRTHDAY' && birthdayPersonName.trim() ? birthdayPersonName.trim() : undefined,
        brideName: eventType === 'WEDDING' && brideName.trim() ? brideName.trim() : undefined,
        groomName: eventType === 'WEDDING' && groomName.trim() ? groomName.trim() : undefined,
        honoreePersonName: !['BIRTHDAY', 'WEDDING'].includes(eventType) && honoreePersonName.trim() ? honoreePersonName.trim() : undefined
      });
    },
    onSuccess: async () => {
      setCustomerName('');
      setCustomerPhone('');
      setEventDate('');
      setEventTime('');
      setGuestCountText('50');
      setStatus('DRAFT');
      setEventType('RESERVATION');
      setHallId('');
      setTableCategoryId('');
      setNotes('');
      setBirthdayPersonName('');
      setBrideName('');
      setGroomName('');
      setHonoreeName('');
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
      setEventDate('');
      setEventTime('');
      setGuestCountText('50');
      setStatus('DRAFT');
      setEventType('RESERVATION');
      setHallId('');
      setTableCategoryId('');
      setNotes('');
      setBirthdayPersonName('');
      setBrideName('');
      setGroomName('');
      setHonoreeName('');
      await queryClient.invalidateQueries({ queryKey: ['events'] });
    }
  });

  const deleteMutation = useMutation<void, Error, number>({
    mutationFn: (eventId) => eventService.remove(eventId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['events'] });
    }
  });

  // Search handler
  const handleSearch = () => {
    if (!events) {
      setSearchError(t('no_events_loaded'));
      setSearchResult(null);
      return;
    }

    const targetId = parsePositiveInt(searchId);
    if (targetId === null) {
      setSearchError(t('enter_event_id'));
      setSearchResult(null);
      return;
    }

    const result = binarySearchEventById(events, targetId);
    if (result) {
      setSearchResult(result);
      setSearchError(null);
    } else {
      setSearchResult(null);
      setSearchError(t('event_not_found', { id: targetId }));
    }
  };

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
            const date = new Date(`${eventDate}T${eventTime}`);
            if (!eventDate || !eventTime || Number.isNaN(date.getTime())) return;

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
                  notes: notes.trim() ? notes.trim() : undefined,
                  birthdayPersonName: eventType === 'BIRTHDAY' && birthdayPersonName.trim() ? birthdayPersonName.trim() : undefined,
                  brideName: eventType === 'WEDDING' && brideName.trim() ? brideName.trim() : undefined,
                  groomName: eventType === 'WEDDING' && groomName.trim() ? groomName.trim() : undefined,
                  honoreePersonName: !['BIRTHDAY', 'WEDDING'].includes(eventType) && honoreePersonName.trim() ? honoreePersonName.trim() : undefined
                }
              });
            } else {
              if (!canSubmit || createMutation.isPending) return;
              createMutation.mutate();
            }
          }}
          className="form-grid-2" style={{ alignItems: 'end' }}
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
            {t('event_date')}
            <Input
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
            />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            {t('event_time')}
            <Input
              type="time"
              value={eventTime}
              onChange={(e) => setEventTime(e.target.value)}
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
                  {t(`event_type_${type.toLowerCase()}` as Parameters<typeof t>[0])}
                </option>
              ))}
            </Select>
          </label>
          {eventType === 'BIRTHDAY' && (
            <label style={{ display: 'grid', gap: 6 }}>
              {t('birthday_person_name')}
              <Input placeholder={t('birthday_person_name_placeholder')} value={birthdayPersonName} onChange={(e) => setBirthdayPersonName(e.target.value)} />
            </label>
          )}
          {eventType === 'WEDDING' && (
            <>
              <label style={{ display: 'grid', gap: 6 }}>
                {t('bride_name')}
                <Input placeholder={t('bride_groom_name_placeholder')} value={brideName} onChange={(e) => setBrideName(e.target.value)} />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                {t('groom_name')}
                <Input placeholder={t('bride_groom_name_placeholder')} value={groomName} onChange={(e) => setGroomName(e.target.value)} />
              </label>
            </>
          )}
          {!['BIRTHDAY', 'WEDDING'].includes(eventType) && (
            <label style={{ display: 'grid', gap: 6 }}>
              {t('honoree_person_name')}
              <Input placeholder={t('honoree_person_name_placeholder')} value={honoreePersonName} onChange={(e) => setHonoreeName(e.target.value)} />
            </label>
          )}
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
                  {category.name} ({formatSum(category.ratePerPerson)} per person)
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
                  setEventDate('');
                  setEventTime('');
                  setGuestCountText('50');
                  setStatus('DRAFT');
                  setEventType('RESERVATION');
                  setHallId('');
                  setTableCategoryId('');
                  setNotes('');
                  setBirthdayPersonName('');
                  setBrideName('');
                  setGroomName('');
                  setHonoreeName('');
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

      {/* Search Section */}
      <section style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12, marginBottom: 16 }}>
        <h3>{t('search_event_by_id')}</h3>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 12, flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {t('enter_event_id')}:
            <Input
              type="number"
              min="1"
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              placeholder={t('enter_event_id')}
            />
          </label>
          <Button
            type="button"
            onClick={handleSearch}
            disabled={!events || isLoading}
            style={{ alignSelf: 'end' }}
          >
            {t('search_olog_n')}
          </Button>
        </div>
        {searchError && <p style={{ color: '#b00020' }}>{searchError}</p>}
        {searchResult && (() => {
          const d = new Date(searchResult.eventDate);
          const dateStr = d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
          const timeStr = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
          const eventTypeLabels: Record<string, string> = {
            RESERVATION: t('event_type_reservation'), BANQUET: t('event_type_banquet'),
            WEDDING: t('event_type_wedding'), BIRTHDAY: t('event_type_birthday'),
            PRIVATE_PARTY: t('event_type_private_party'), CORPORATE: t('event_type_corporate')
          };
          const statusColors: Record<string, string> = {
            DRAFT: '#64748b', CONFIRMED: '#059669', CANCELLED: '#dc2626'
          };
          const dishTypes  = searchResult.selections?.length ?? 0;
          const totalPcs   = searchResult.selections?.reduce((s, sel) => s + sel.quantity, 0) ?? 0;

          return (
            <div style={{ border: '1px solid #cbd5e1', borderRadius: 8, padding: 16, backgroundColor: '#f8fafc' }}>
              <h4 style={{ margin: '0 0 12px', fontSize: '0.9rem', color: '#475569' }}>{t('search_result')}</h4>

              <div className="form-grid-3" style={{ gap: '10px 24px' }}>
                <div>
                  <p style={{ margin: 0, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8' }}>ID</p>
                  <p style={{ margin: '2px 0 0', fontFamily: 'monospace', color: '#475569' }}>#{searchResult.id}</p>
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8' }}>{t('customer_name')}</p>
                  <p style={{ margin: '2px 0 0', fontWeight: 600, color: '#0f172a' }}>{searchResult.customerName}</p>
                  {searchResult.customerPhone && (
                    <p style={{ margin: '1px 0 0', fontSize: '0.78rem', color: '#64748b' }}>{searchResult.customerPhone}</p>
                  )}
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8' }}>{t('status')}</p>
                  <p style={{ margin: '2px 0 0', fontWeight: 600, color: statusColors[searchResult.status] ?? '#475569' }}>{searchResult.status}</p>
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8' }}>{t('event_date_time')}</p>
                  <p style={{ margin: '2px 0 0', color: '#0f172a' }}>{dateStr}</p>
                  <p style={{ margin: '1px 0 0', fontSize: '0.78rem', color: '#64748b' }}>{timeStr}</p>
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8' }}>{t('event_type')}</p>
                  <p style={{ margin: '2px 0 0', color: '#0f172a' }}>
                    {searchResult.eventType ? (eventTypeLabels[searchResult.eventType] ?? searchResult.eventType) : '—'}
                  </p>
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8' }}>{t('guests')}</p>
                  <p style={{ margin: '2px 0 0', color: '#0f172a' }}>{searchResult.guestCount}</p>
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8' }}>{t('hall_optional')}</p>
                  <p style={{ margin: '2px 0 0', color: '#0f172a' }}>{searchResult.hall?.name ?? '—'}</p>
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8' }}>{t('table_category_optional')}</p>
                  <p style={{ margin: '2px 0 0', color: '#0f172a' }}>{searchResult.tableCategory?.name ?? '—'}</p>
                  {searchResult.tableCategory && (
                    <p style={{ margin: '1px 0 0', fontSize: '0.78rem', color: '#64748b' }}>{formatSum(searchResult.tableCategory.ratePerPerson)} per person</p>
                  )}
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8' }}>Menu</p>
                  <p style={{ margin: '2px 0 0', color: '#0f172a' }}>
                    {dishTypes > 0 ? `${dishTypes} dish${dishTypes !== 1 ? 'es' : ''}, ${totalPcs} pcs` : '—'}
                  </p>
                </div>
                {searchResult.eventType === 'BIRTHDAY' && searchResult.birthdayPersonName && (
                  <div>
                    <p style={{ margin: 0, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8' }}>{t('birthday_person_name')}</p>
                    <p style={{ margin: '2px 0 0', color: '#0f172a' }}>{searchResult.birthdayPersonName}</p>
                  </div>
                )}
                {searchResult.eventType === 'WEDDING' && searchResult.brideName && (
                  <div>
                    <p style={{ margin: 0, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8' }}>{t('bride_name')}</p>
                    <p style={{ margin: '2px 0 0', color: '#0f172a' }}>{searchResult.brideName}</p>
                  </div>
                )}
                {searchResult.eventType === 'WEDDING' && searchResult.groomName && (
                  <div>
                    <p style={{ margin: 0, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8' }}>{t('groom_name')}</p>
                    <p style={{ margin: '2px 0 0', color: '#0f172a' }}>{searchResult.groomName}</p>
                  </div>
                )}
                {searchResult.eventType && !['BIRTHDAY', 'WEDDING'].includes(searchResult.eventType) && searchResult.honoreePersonName && (
                  <div>
                    <p style={{ margin: 0, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8' }}>{t('honoree_person_name')}</p>
                    <p style={{ margin: '2px 0 0', color: '#0f172a' }}>{searchResult.honoreePersonName}</p>
                  </div>
                )}
                {searchResult.notes && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <p style={{ margin: 0, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8' }}>{t('notes')}</p>
                    <p style={{ margin: '2px 0 0', fontSize: '0.85rem', color: '#475569' }}>{searchResult.notes}</p>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditingId(searchResult.id);
                    setCustomerName(searchResult.customerName);
                    setCustomerPhone(searchResult.customerPhone ?? '');
                    const srDate = new Date(searchResult.eventDate);
                    const srLocal = new Date(srDate.getTime() - srDate.getTimezoneOffset() * 60000).toISOString();
                    setEventDate(srLocal.slice(0, 10));
                    setEventTime(srLocal.slice(11, 16));
                    setGuestCountText(searchResult.guestCount.toString());
                    setEventType(searchResult.eventType ?? 'RESERVATION');
                    setStatus(searchResult.status);
                    setHallId(searchResult.hallId ?? '');
                    setTableCategoryId(searchResult.tableCategoryId ?? '');
                    setNotes(searchResult.notes ?? '');
                    setBirthdayPersonName(searchResult.birthdayPersonName ?? '');
                    setBrideName(searchResult.brideName ?? '');
                    setGroomName(searchResult.groomName ?? '');
                    setHonoreeName(searchResult.honoreePersonName ?? '');
                    document.querySelector('form')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                >
                  {t('edit')}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    if (window.confirm(`Delete reservation for ${searchResult.customerName}?`)) {
                      deleteMutation.mutate(searchResult.id);
                      setSearchResult(null);
                      setSearchId('');
                    }
                  }}
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending ? t('deleting') : t('delete')}
                </Button>
              </div>
            </div>
          );
        })()}
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
            const evDate = new Date(event.eventDate);
            const evLocal = new Date(evDate.getTime() - evDate.getTimezoneOffset() * 60000).toISOString();
            setEventDate(evLocal.slice(0, 10));
            setEventTime(evLocal.slice(11, 16));
            setGuestCountText(event.guestCount.toString());
            setEventType(event.eventType ?? 'RESERVATION');
            setStatus(event.status);
            setHallId(event.hallId ?? '');
            setTableCategoryId(event.tableCategoryId ?? '');
            setNotes(event.notes ?? '');
            setBirthdayPersonName(event.birthdayPersonName ?? '');
            setBrideName(event.brideName ?? '');
            setGroomName(event.groomName ?? '');
            setHonoreeName(event.honoreePersonName ?? '');
          }}
          onDelete={(eventId) => deleteMutation.mutate(eventId)}
          deletingId={deleteMutation.isPending ? deleteMutation.variables ?? null : null}
        />
      ) : null}
    </main>
  );
};
