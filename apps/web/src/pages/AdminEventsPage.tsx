import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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

const eventTypes: NonNullable<Event['eventType']>[] = ['RESERVATION', 'BANQUET', 'WEDDING', 'BIRTHDAY', 'PRIVATE_PARTY', 'CORPORATE', 'FOTIHA_TUI', 'NACHOR_OSHI'];

const STATUS_LABEL_KEY: Record<Event['status'], Parameters<typeof translate>[0]> = {
  DRAFT: 'status_draft',
  CONFIRMED: 'status_confirmed',
  CANCELLED: 'status_cancelled',
  COMPLETED: 'status_completed',
  MENU_NOT_SELECTED: 'status_menu_not_selected',
};

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

  // Populate the editor form from an event and bring it into view at the top of
  // the page (the editing section). Shared by the list, search, and the
  // "focus event" deep-link coming from the calendar.
  const startEditing = (event: Event) => {
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
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Deep link from the calendar: /?editEventId=<id> opens that event in the
  // editor once the events have loaded, then clears the param so it doesn't
  // re-trigger on later renders.
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const editId = searchParams.get('editEventId');
    if (!editId || !events) return;
    const event = events.find((item) => item.id === Number(editId));
    if (event) startEditing(event);
    searchParams.delete('editEventId');
    setSearchParams(searchParams, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, searchParams]);

  const canSubmit = validation.errors.length === 0 && !createMutation.isPending;
  const canSave = validation.errors.length === 0 && !updateMutation.isPending;

  return (
    <main className="tablet-fade-in" style={{ maxWidth: 1280, margin: '0 auto', padding: '28px 20px', position: 'relative', zIndex: 1 }}>
      <h1 className="adm-title" style={{ marginBottom: 20 }}>{t('banquet_events')}</h1>

      <section className="adm-card tablet-fade-up adm-section">
        <h3 className="adm-heading" style={{ marginTop: 0, marginBottom: 16 }}>{editingId ? t('edit_existing_event') : t('create_new_event')}</h3>
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
              <option value="DRAFT">{t('status_draft')}</option>
              <option value="CONFIRMED">{t('status_confirmed')}</option>
              <option value="CANCELLED">{t('status_cancelled')}</option>
              <option value="COMPLETED">{t('status_completed')}</option>
              <option value="MENU_NOT_SELECTED">{t('status_menu_not_selected')}</option>
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
      <section className="adm-card tablet-fade-up adm-section" style={{ animationDelay: '80ms' }}>
        <h3 className="adm-heading" style={{ marginTop: 0, marginBottom: 16 }}>{t('search_event_by_id')}</h3>
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
            DRAFT: '#94a3b8', CONFIRMED: '#4ade80', CANCELLED: '#fca5a5', COMPLETED: '#60a5fa', MENU_NOT_SELECTED: '#fbbf24',
          };
          const dishTypes  = searchResult.selections?.length ?? 0;
          const totalPcs   = searchResult.selections?.reduce((s, sel) => s + sel.quantity, 0) ?? 0;

          return (
            <div className="tablet-fade-up" style={{ background: 'rgba(15,23,42,0.4)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 18 }}>
              <h4 className="adm-heading" style={{ margin: '0 0 14px' }}>{t('search_result')}</h4>

              <div className="form-grid-3" style={{ gap: '10px 24px' }}>
                <div>
                  <p style={{ margin: 0, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'rgba(226,232,240,0.45)' }}>ID</p>
                  <p style={{ margin: '2px 0 0', fontFamily: 'monospace', color: 'rgba(226,232,240,0.7)' }}>#{searchResult.id}</p>
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'rgba(226,232,240,0.45)' }}>{t('customer_name')}</p>
                  <p style={{ margin: '2px 0 0', fontWeight: 600, color: '#e2e8f0' }}>{searchResult.customerName}</p>
                  {searchResult.customerPhone && (
                    <p style={{ margin: '1px 0 0', fontSize: '0.78rem', color: 'rgba(226,232,240,0.6)' }}>{searchResult.customerPhone}</p>
                  )}
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'rgba(226,232,240,0.45)' }}>{t('status')}</p>
                  <p style={{ margin: '2px 0 0', fontWeight: 600, color: statusColors[searchResult.status] ?? '#475569' }}>{t(STATUS_LABEL_KEY[searchResult.status])}</p>
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'rgba(226,232,240,0.45)' }}>{t('event_date_time')}</p>
                  <p style={{ margin: '2px 0 0', color: '#e2e8f0' }}>{dateStr}</p>
                  <p style={{ margin: '1px 0 0', fontSize: '0.78rem', color: 'rgba(226,232,240,0.6)' }}>{timeStr}</p>
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'rgba(226,232,240,0.45)' }}>{t('event_type')}</p>
                  <p style={{ margin: '2px 0 0', color: '#e2e8f0' }}>
                    {searchResult.eventType ? (eventTypeLabels[searchResult.eventType] ?? searchResult.eventType) : '—'}
                  </p>
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'rgba(226,232,240,0.45)' }}>{t('guests')}</p>
                  <p style={{ margin: '2px 0 0', color: '#e2e8f0' }}>{searchResult.guestCount}</p>
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'rgba(226,232,240,0.45)' }}>{t('hall_optional')}</p>
                  <p style={{ margin: '2px 0 0', color: '#e2e8f0' }}>{searchResult.hall?.name ?? '—'}</p>
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'rgba(226,232,240,0.45)' }}>{t('table_category_optional')}</p>
                  <p style={{ margin: '2px 0 0', color: '#e2e8f0' }}>{searchResult.tableCategory?.name ?? '—'}</p>
                  {searchResult.tableCategory && (
                    <p style={{ margin: '1px 0 0', fontSize: '0.78rem', color: 'rgba(226,232,240,0.6)' }}>{formatSum(searchResult.tableCategory.ratePerPerson)} per person</p>
                  )}
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'rgba(226,232,240,0.45)' }}>Menu</p>
                  <p style={{ margin: '2px 0 0', color: '#e2e8f0' }}>
                    {dishTypes > 0 ? `${dishTypes} dish${dishTypes !== 1 ? 'es' : ''}, ${totalPcs} pcs` : '—'}
                  </p>
                </div>
                {searchResult.eventType === 'BIRTHDAY' && searchResult.birthdayPersonName && (
                  <div>
                    <p style={{ margin: 0, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'rgba(226,232,240,0.45)' }}>{t('birthday_person_name')}</p>
                    <p style={{ margin: '2px 0 0', color: '#e2e8f0' }}>{searchResult.birthdayPersonName}</p>
                  </div>
                )}
                {searchResult.eventType === 'WEDDING' && searchResult.brideName && (
                  <div>
                    <p style={{ margin: 0, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'rgba(226,232,240,0.45)' }}>{t('bride_name')}</p>
                    <p style={{ margin: '2px 0 0', color: '#e2e8f0' }}>{searchResult.brideName}</p>
                  </div>
                )}
                {searchResult.eventType === 'WEDDING' && searchResult.groomName && (
                  <div>
                    <p style={{ margin: 0, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'rgba(226,232,240,0.45)' }}>{t('groom_name')}</p>
                    <p style={{ margin: '2px 0 0', color: '#e2e8f0' }}>{searchResult.groomName}</p>
                  </div>
                )}
                {searchResult.eventType && !['BIRTHDAY', 'WEDDING'].includes(searchResult.eventType) && searchResult.honoreePersonName && (
                  <div>
                    <p style={{ margin: 0, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'rgba(226,232,240,0.45)' }}>{t('honoree_person_name')}</p>
                    <p style={{ margin: '2px 0 0', color: '#e2e8f0' }}>{searchResult.honoreePersonName}</p>
                  </div>
                )}
                {searchResult.notes && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <p style={{ margin: 0, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'rgba(226,232,240,0.45)' }}>{t('notes')}</p>
                    <p style={{ margin: '2px 0 0', fontSize: '0.85rem', color: 'rgba(226,232,240,0.7)' }}>{searchResult.notes}</p>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => startEditing(searchResult)}
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
            if (event) startEditing(event);
          }}
          onDelete={(eventId) => deleteMutation.mutate(eventId)}
          deletingId={deleteMutation.isPending ? deleteMutation.variables ?? null : null}
        />
      ) : null}
    </main>
  );
};