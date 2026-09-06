import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { EventList } from '../components/events/EventList';
import { eventService } from '../services/event.service';
import { hallService } from '../services/hall.service';
import { tableCategoryService } from '../services/tableCategory.service';
import { menuService } from '../services/menu.service';
import { httpClient } from '../services/http';
import { useAdminStore } from '../store/admin.store';
import { useAuthStore } from '../store/auth.store';
import { useRestaurantBranding } from '../hooks/useRestaurantBranding';
import { useTabletStore } from '../store/tablet.store';
import { translate } from '../utils/translate';
import { buildEventExportPayload } from '../utils/eventPdf';
import type { Event } from '../types/domain';
import { Input } from '../components/ui/input';
import { MoneyInput } from '../components/ui/MoneyInput';
import { Select } from '../components/ui/select';
import { Button } from '../components/ui/button';
import { formatSum, parseSumToTiyin } from '../utils/currency';
import { soleHallId } from '../utils/soleHall';
import { clearSessionDraft, readSessionDraft, writeSessionDraft } from '../hooks/useSessionDraft';

/**
 * The create/edit event form, kept across a reload or a browser Back.
 *
 * Not an autosave: nothing here reaches the database until the form is
 * submitted. A create form that wrote on a keystroke would leave a trail of
 * half-typed events, so what it gets instead is a draft that outlives a
 * navigation and dies with the tab.
 *
 * `editingId` and `showForm` are part of it: restoring the fields of an edit
 * into a closed create form would silently retarget the save.
 */
export const EVENT_FORM_DRAFT_KEY = 'vmenu-event-form-draft';

export type EventFormDraft = {
  customerName: string; customerPhone: string;
  secondCustomerName: string; secondCustomerPhone: string;
  depositText: string; eventDate: string; eventTime: string; guestCountText: string;
  eventType: NonNullable<Event['eventType']>;
  status: NonNullable<Event['status']>;
  hallId: string; tableCategoryId: string; notes: string;
  birthdayPersonName: string; brideName: string; groomName: string; honoreePersonName: string;
  editingId: number | null; showForm: boolean;
};

/**
 * A whole positive count typed by a person, or null.
 *
 * Spaces are stripped before parsing because these fields group their digits by
 * place value now — `Number('1 200')` is NaN, which would have called every
 * four-figure count invalid.
 */
const parsePositiveInt = (value: string): number | null => {
  const trimmed = value.replace(/\s/g, '').trim();
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

// ── Create/Edit Event form styling ──
// Field labels are rendered in the brand yellow, and fields are grouped under
// small yellow section headings with a fading rule line.
const GOLD = 'var(--adm-accent)';

const fieldLabelStyle: React.CSSProperties = {
  display: 'grid', gap: 6,
  fontSize: 12.5, fontWeight: 600, letterSpacing: '0.02em',
  color: GOLD,
};

const GroupHeading = ({ children }: { children: React.ReactNode }) => (
  <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
    <span style={{
      fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase',
      color: GOLD, whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
    <span aria-hidden className="adm-rule-in" style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, rgba(var(--adm-accent-rgb),0.45), transparent)' }} />
  </div>
);

// Month-of-year keys for labelling the month filter (index 0 = January).
const MONTH_KEYS: Parameters<typeof translate>[0][] = [
  'month_january', 'month_february', 'month_march', 'month_april', 'month_may', 'month_june',
  'month_july', 'month_august', 'month_september', 'month_october', 'month_november', 'month_december',
];

// 'YYYY-MM' bucket for an event's date (local time), or null when it has no date.
const eventMonthKey = (iso: string | null | undefined): string | null => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const STATUS_LABEL_KEY: Record<Event['status'], Parameters<typeof translate>[0]> = {
  DRAFT: 'status_draft',
  CONFIRMED: 'status_confirmed',
  CANCELLED: 'status_cancelled',
  COMPLETED: 'status_completed',
  MENU_NOT_SELECTED: 'status_menu_not_selected',
};

export const AdminEventsPage = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { locale } = useAdminStore();
  const tabletRestaurantId = useAuthStore((s) => s.restaurantId) ?? '';
  // The brand that goes on an exported PDF — see useRestaurantBranding.
  const { name: restaurantName, logoUrl: restaurantLogoUrl } = useRestaurantBranding();
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

  const { data: menuItems } = useQuery({
    queryKey: ['menuItems', 'banquet'],
    queryFn: () => menuService.list('banquet')
  });

  // Download the banquet summary PDF for a single event, rebuilt from its saved
  // menu config (courses, free swaps, extras, children) via the public exporter.
  const downloadEventPdf = async (event: Event) => {
    try {
      const payload = buildEventExportPayload(event, {
        menuItems: menuItems ?? [],
        tableCategories: tableCategories ?? [],
        halls: halls ?? [],
        restaurantName,
        restaurantLogoUrl,
        locale,
        t,
      });
      const response = await httpClient.post('/public/export/pdf', payload, { responseType: 'blob' });
      const downloadUrl = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', `event-${event.id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch {
      window.alert(t('download_failed'));
    }
  };

  // The half-filled form survives a reload and a browser Back. Read ONCE, in a
  // state initialiser: reading it from an effect would render the empty form
  // first and overwrite anything typed in that frame. See useSessionDraft.
  const [restoredForm] = useState(() => readSessionDraft<Partial<EventFormDraft>>(EVENT_FORM_DRAFT_KEY));
  const draft = <K extends keyof EventFormDraft>(key: K, fallback: EventFormDraft[K]) =>
    (restoredForm?.[key] ?? fallback) as EventFormDraft[K];

  const [customerName, setCustomerName] = useState(draft('customerName', ''));
  const [customerPhone, setCustomerPhone] = useState(draft('customerPhone', ''));
  const [secondCustomerName, setSecondCustomerName] = useState(draft('secondCustomerName', ''));
  const [secondCustomerPhone, setSecondCustomerPhone] = useState(draft('secondCustomerPhone', ''));
  const [depositText, setDepositText] = useState(draft('depositText', ''));
  const [eventDate, setEventDate] = useState(draft('eventDate', ''));
  const [eventTime, setEventTime] = useState(draft('eventTime', ''));
  const [guestCountText, setGuestCountText] = useState(draft('guestCountText', '50'));
  const [eventType, setEventType] = useState<NonNullable<Event['eventType']>>(draft('eventType', 'RESERVATION'));
  const [status, setStatus] = useState<NonNullable<Event['status']>>(draft('status', 'MENU_NOT_SELECTED'));
  const [hallId, setHallId] = useState(draft('hallId', ''));
  // With exactly one bookable hall the picker is a formality, so the field
  // starts filled in — an event saved with no hall is the commonest way this
  // form is got wrong, and for these restaurants there was never a choice to
  // make. See soleHall.ts for what counts as "one".
  const defaultHallId = useMemo(() => soleHallId(halls ?? []) ?? '', [halls]);
  // Applied when the halls arrive, and only to a field still empty. Keyed on
  // the default alone — an effect that also watched `hallId` would put the hall
  // straight back every time someone cleared it.
  useEffect(() => {
    if (defaultHallId) setHallId((current) => current || defaultHallId);
  }, [defaultHallId]);
  const [tableCategoryId, setTableCategoryId] = useState(draft('tableCategoryId', ''));
  const [notes, setNotes] = useState(draft('notes', ''));
  const [birthdayPersonName, setBirthdayPersonName] = useState(draft('birthdayPersonName', ''));
  const [brideName, setBrideName] = useState(draft('brideName', ''));
  const [groomName, setGroomName] = useState(draft('groomName', ''));
  const [honoreePersonName, setHonoreeName] = useState(draft('honoreePersonName', ''));
  const [editingId, setEditingId] = useState<number | null>(draft('editingId', null));
  // The create/edit panel is hidden by default and revealed via a button.
  const [showForm, setShowForm] = useState(draft('showForm', false));
  // Reschedule modal state (separate from the text-based date edit in the form).
  // One effect mirrors the whole form, rather than nineteen fields each writing
  // their own key: the form is restored as a unit, so it has to be stored as one.
  useEffect(() => {
    if (!showForm) return;   // a closed form has nothing worth keeping
    writeSessionDraft(EVENT_FORM_DRAFT_KEY, {
      customerName, customerPhone, secondCustomerName, secondCustomerPhone,
      depositText, eventDate, eventTime, guestCountText, eventType, status,
      hallId, tableCategoryId, notes,
      birthdayPersonName, brideName, groomName, honoreePersonName,
      editingId, showForm,
    } satisfies EventFormDraft);
  }, [customerName, customerPhone, secondCustomerName, secondCustomerPhone,
      depositText, eventDate, eventTime, guestCountText, eventType, status,
      hallId, tableCategoryId, notes,
      birthdayPersonName, brideName, groomName, honoreePersonName, editingId, showForm]);

  const [reschedulingId, setReschedulingId] = useState<number | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');

  // Search functionality
  const [searchId, setSearchId] = useState('');
  const [searchResult, setSearchResult] = useState<Event | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Month filter for the events list ('' = all months, otherwise 'YYYY-MM').
  const [monthFilter, setMonthFilter] = useState<string>('');
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    for (const e of events ?? []) {
      const key = eventMonthKey(e.eventDate);
      if (key) set.add(key);
    }
    return [...set].sort().reverse();
  }, [events]);
  const monthLabel = (ym: string) => {
    const [y, m] = ym.split('-').map(Number);
    return `${t(MONTH_KEYS[m - 1])} ${y}`;
  };
  const filteredEvents = useMemo(
    () => (monthFilter ? (events ?? []).filter((e) => eventMonthKey(e.eventDate) === monthFilter) : events),
    [events, monthFilter],
  );

  const validation = useMemo(() => {
    const errors: string[] = [];

    // A completely blank event is allowed (for later editing). Only values the
    // user actually typed are validated.
    if (eventDate && eventTime && Number.isNaN(new Date(`${eventDate}T${eventTime}`).getTime())) {
      errors.push('Event date/time is invalid.');
    }

    const guestCount = parsePositiveInt(guestCountText);
    if (guestCountText.trim() && guestCount === null) errors.push('Guest count must be a positive integer.');
    if (guestCount !== null && guestCount > 5000) errors.push('Guest count must be 5000 or less.');

    if (tableCategoryId && tableCategories && !tableCategories.find((category) => category.id === tableCategoryId)) {
      errors.push('Selected table category is invalid.');
    }

    return { errors, guestCount };
  }, [eventDate, eventTime, guestCountText, tableCategoryId, tableCategories]);

  const createMutation = useMutation({
    mutationFn: () => {
      if (validation.errors.length > 0) {
        throw new Error(validation.errors[0] ?? 'Invalid form');
      }

      // A blank event is allowed: only send a date when both parts were entered.
      const hasDateTime = !!(eventDate && eventTime);
      const date = hasDateTime ? new Date(`${eventDate}T${eventTime}`) : null;
      if (date && Number.isNaN(date.getTime())) {
        throw new Error('Invalid event date/time');
      }

      return eventService.create({
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() ? customerPhone.trim() : undefined,
        secondCustomerName: secondCustomerName.trim() ? secondCustomerName.trim() : undefined,
        secondCustomerPhone: secondCustomerPhone.trim() ? secondCustomerPhone.trim() : undefined,
        eventDate: date ? date.toISOString() : undefined,
        guestCount: validation.guestCount ?? undefined,
        depositCents: parseSumToTiyin(depositText) ?? undefined,
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
      setSecondCustomerName('');
      setSecondCustomerPhone('');
      setDepositText('');
      setEventDate('');
      setEventTime('');
      setGuestCountText('50');
      setStatus('MENU_NOT_SELECTED');
      setEventType('RESERVATION');
      setHallId(defaultHallId);
      setTableCategoryId('');
      setNotes('');
      setBirthdayPersonName('');
      setBrideName('');
      setGroomName('');
      setHonoreeName('');
      setShowForm(false);
      // The form is finished with, so the draft goes: a kept draft would
      // reopen an event that has already been saved or abandoned.
      clearSessionDraft(EVENT_FORM_DRAFT_KEY);
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
      setSecondCustomerName('');
      setSecondCustomerPhone('');
      setDepositText('');
      setEventDate('');
      setEventTime('');
      setGuestCountText('50');
      setStatus('MENU_NOT_SELECTED');
      setEventType('RESERVATION');
      setHallId(defaultHallId);
      setTableCategoryId('');
      setNotes('');
      setBirthdayPersonName('');
      setBrideName('');
      setGroomName('');
      setHonoreeName('');
      setShowForm(false);
      // The form is finished with, so the draft goes: a kept draft would
      // reopen an event that has already been saved or abandoned.
      clearSessionDraft(EVENT_FORM_DRAFT_KEY);
      await queryClient.invalidateQueries({ queryKey: ['events'] });
    }
  });

  const deleteMutation = useMutation<void, Error, number>({
    mutationFn: (eventId) => eventService.remove(eventId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['events'] });
    }
  });

  const rescheduleMutation = useMutation({
    mutationFn: ({ eventId, iso }: { eventId: number; iso: string }) => eventService.reschedule(eventId, iso),
    onSuccess: async () => {
      setReschedulingId(null);
      setRescheduleDate('');
      setRescheduleTime('');
      await queryClient.invalidateQueries({ queryKey: ['events'] });
    }
  });

  // Open the reschedule modal for an event, pre-filled with its current date/time.
  const openReschedule = (event: Event) => {
    setReschedulingId(event.id);
    const d = new Date(event.eventDate);
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString();
    setRescheduleDate(local.slice(0, 10));
    setRescheduleTime(local.slice(11, 16));
  };

  const submitReschedule = () => {
    if (!reschedulingId || !rescheduleDate || !rescheduleTime || rescheduleMutation.isPending) return;
    const date = new Date(`${rescheduleDate}T${rescheduleTime}`);
    if (Number.isNaN(date.getTime())) return;
    rescheduleMutation.mutate({ eventId: reschedulingId, iso: date.toISOString() });
  };

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
    setShowForm(true);
    setEditingId(event.id);
    setCustomerName(event.customerName);
    setCustomerPhone(event.customerPhone ?? '');
    setSecondCustomerName(event.secondCustomerName ?? '');
    setSecondCustomerPhone(event.secondCustomerPhone ?? '');
    setDepositText(event.depositCents ? String(Math.round(event.depositCents / 100)) : '');
    const evDate = new Date(event.eventDate);
    const evLocal = new Date(evDate.getTime() - evDate.getTimezoneOffset() * 60000).toISOString();
    setEventDate(evLocal.slice(0, 10));
    setEventTime(evLocal.slice(11, 16));
    setGuestCountText(event.guestCount.toString());
    setEventType(event.eventType ?? 'RESERVATION');
    setStatus(event.status);
    // An event saved before the restaurant had a hall reopens on the default
    // too: with a single hall there is no wrong answer to fill in.
    setHallId(event.hallId || defaultHallId);
    setTableCategoryId(event.tableCategoryId ?? '');
    setNotes(event.notes ?? '');
    setBirthdayPersonName(event.birthdayPersonName ?? '');
    setBrideName(event.brideName ?? '');
    setGroomName(event.groomName ?? '');
    setHonoreeName(event.honoreePersonName ?? '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // "Change Menu": hand the data entered so far over to the tablet flow (which
  // picks the menu/courses), then jump to the tablet. The `prefill=1` flag tells
  // the tablet menu page to keep the pre-selected table category instead of
  // resetting it. Contact + date/time resurface on the tablet Summary page.
  const goToTabletWithDraft = () => {
    // When editing an existing event, carry its saved menu config so the tablet
    // reopens with every dish the guest originally selected. A brand-new event
    // (editingId null) starts the menu flow empty and will CREATE on confirm.
    const event = editingId ? (events ?? []).find((e) => e.id === editingId) : undefined;
    useTabletStore.getState().loadEventDraft({
      editingEventId: editingId ?? undefined,
      hallId,
      tableCategoryId,
      guestCount: parsePositiveInt(guestCountText) ?? 0,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      secondCustomerName: secondCustomerName.trim(),
      secondCustomerPhone: secondCustomerPhone.trim(),
      depositCents: parseSumToTiyin(depositText) ?? 0,
      eventDate,
      eventTime,
      childrenCount: event?.childrenCount ?? 0,
      config: event?.menuConfig ?? null,
    });
    navigate(`/tablet?restaurantId=${encodeURIComponent(tabletRestaurantId)}&prefill=1`);
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <h1 className="adm-title" style={{ margin: 0 }}>{t('banquet_events')}</h1>
        {/* The create/edit panel is hidden by default; this button reveals it. */}
        <Button
          type="button"
          onClick={() => {
            if (showForm) {
              setShowForm(false);
              // The form is finished with, so the draft goes: a kept draft would
              // reopen an event that has already been saved or abandoned.
              clearSessionDraft(EVENT_FORM_DRAFT_KEY);
            } else {
              // Opening fresh for a NEW event — clear any leftover edit state.
              setEditingId(null);
              setShowForm(true);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }
          }}
        >
          {showForm ? t('hide_form') : `+ ${t('create_new_event_button')}`}
        </Button>
      </div>

      {showForm && (
      <section className="adm-card tablet-fade-up adm-section">
        <h3 className="adm-heading" style={{ marginTop: 0, marginBottom: 16 }}>{editingId ? t('edit_existing_event') : t('create_new_event')}</h3>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            // Blank events are allowed: only send a date when both parts are set.
            const hasDateTime = !!(eventDate && eventTime);
            const date = hasDateTime ? new Date(`${eventDate}T${eventTime}`) : null;
            if (date && Number.isNaN(date.getTime())) return;

            if (editingId) {
              if (!canSave || updateMutation.isPending) return;
              updateMutation.mutate({
                eventId: editingId,
                data: {
                  customerName: customerName.trim(),
                  customerPhone: customerPhone.trim() ? customerPhone.trim() : undefined,
                  secondCustomerName: secondCustomerName.trim() ? secondCustomerName.trim() : undefined,
                  secondCustomerPhone: secondCustomerPhone.trim() ? secondCustomerPhone.trim() : undefined,
                  eventDate: date ? date.toISOString() : undefined,
                  guestCount: validation.guestCount ?? 0,
                  depositCents: parseSumToTiyin(depositText) ?? 0,
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
          {/* ── Customer information ── */}
          <GroupHeading>{t('customer_information')}</GroupHeading>
          <label style={fieldLabelStyle}>
            {t('customer_name')}
            <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
          </label>
          <label style={fieldLabelStyle}>
            {t('phone_number')}
            <Input
              type="tel"
              placeholder="e.g., +7 999 123 45 67"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
            />
          </label>
          <label style={fieldLabelStyle}>
            {t('second_customer_name')}
            <Input
              value={secondCustomerName}
              onChange={(e) => setSecondCustomerName(e.target.value)}
            />
          </label>
          <label style={fieldLabelStyle}>
            {t('second_customer_phone')}
            <Input
              type="tel"
              placeholder="e.g., +7 999 123 45 67"
              value={secondCustomerPhone}
              onChange={(e) => setSecondCustomerPhone(e.target.value)}
            />
          </label>

          {/* ── Date & time ── */}
          <GroupHeading>{t('event_date_time')}</GroupHeading>
          <label style={fieldLabelStyle}>
            {t('event_date')}
            <Input
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
            />
          </label>
          <label style={fieldLabelStyle}>
            {t('event_time')}
            <Input
              type="time"
              value={eventTime}
              onChange={(e) => setEventTime(e.target.value)}
            />
          </label>

          {/* ── Event details ── */}
          <GroupHeading>{t('event_details')}</GroupHeading>
          <label style={fieldLabelStyle}>
            {t('guests')}
            <MoneyInput value={guestCountText} onChange={setGuestCountText} />
          </label>
          <label style={fieldLabelStyle}>
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
            <label style={fieldLabelStyle}>
              {t('birthday_person_name')}
              <Input placeholder={t('birthday_person_name_placeholder')} value={birthdayPersonName} onChange={(e) => setBirthdayPersonName(e.target.value)} />
            </label>
          )}
          {eventType === 'WEDDING' && (
            <>
              <label style={fieldLabelStyle}>
                {t('bride_name')}
                <Input placeholder={t('bride_groom_name_placeholder')} value={brideName} onChange={(e) => setBrideName(e.target.value)} />
              </label>
              <label style={fieldLabelStyle}>
                {t('groom_name')}
                <Input placeholder={t('bride_groom_name_placeholder')} value={groomName} onChange={(e) => setGroomName(e.target.value)} />
              </label>
            </>
          )}
          {!['BIRTHDAY', 'WEDDING'].includes(eventType) && (
            <label style={fieldLabelStyle}>
              {t('honoree_person_name')}
              <Input placeholder={t('honoree_person_name_placeholder')} value={honoreePersonName} onChange={(e) => setHonoreeName(e.target.value)} />
            </label>
          )}
          <label style={fieldLabelStyle}>
            {t('status')}
            <Select value={status} onChange={(e) => setStatus(e.target.value as NonNullable<Event['status']>)}>
              <option value="MENU_NOT_SELECTED">{t('status_menu_not_selected')}</option>
              <option value="CONFIRMED">{t('status_confirmed')}</option>
              <option value="CANCELLED">{t('status_cancelled')}</option>
              <option value="COMPLETED">{t('status_completed')}</option>
            </Select>
          </label>
          <label style={{ ...fieldLabelStyle, gridColumn: '1 / -1' }}>
            {t('notes')}
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>

          {/* ── Hall / Table ── */}
          <GroupHeading>{t('ev_col_hall_table')}</GroupHeading>
          <label style={fieldLabelStyle}>
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
          <label style={fieldLabelStyle}>
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

          {/* ── Payment ── */}
          <GroupHeading>{t('payment')}</GroupHeading>
          <label style={fieldLabelStyle}>
            {t('deposit_optional')}
            <MoneyInput value={depositText} onChange={setDepositText} placeholder="0" />
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
                  setSecondCustomerName('');
                  setSecondCustomerPhone('');
                  setDepositText('');
                  setEventDate('');
                  setEventTime('');
                  setGuestCountText('50');
                  setStatus('MENU_NOT_SELECTED');
                  setEventType('RESERVATION');
                  setHallId(defaultHallId);
                  setTableCategoryId('');
                  setNotes('');
                  setBirthdayPersonName('');
                  setBrideName('');
                  setGroomName('');
                  setHonoreeName('');
                  setShowForm(false);
                  // The form is finished with, so the draft goes: a kept draft would
                  // reopen an event that has already been saved or abandoned.
                  clearSessionDraft(EVENT_FORM_DRAFT_KEY);
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

          {/* Create/Edit Menu — hand the entered details to the tablet flow to pick
              the menu. Reads "Create Menu" for a new event, "Edit Menu" when editing. */}
          <div style={{ gridColumn: '1 / -1', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 16, display: 'flex' }}>
            <Button
              type="button"
              variant="accent"
              size="lg"
              onClick={goToTabletWithDraft}
              disabled={!tabletRestaurantId}
              style={{
                background: 'linear-gradient(135deg, var(--rg-accent, var(--adm-accent)), var(--rg-accent-soft, #d9b84a))',
                color: '#1a1205',
                fontWeight: 700,
                fontSize: '1rem',
                padding: '12px 28px',
                border: 'none',
                boxShadow: '0 6px 20px rgba(var(--adm-accent-rgb),0.45)',
                animation: 'menuCtaPulse 2.4s ease-in-out infinite',
              }}
            >
              🍽 {editingId ? t('edit_menu') : t('create_menu')} →
            </Button>
          </div>
        </form>
      </section>
      )}

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
            <div className="tablet-fade-up" style={{ background: 'rgba(var(--adm-bg-rgb),0.4)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 18 }}>
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
                  {searchResult.originalEventDate && new Date(searchResult.originalEventDate).getTime() !== d.getTime() && (
                    <p style={{ margin: '2px 0 0', fontSize: '0.72rem', color: '#f87171', textDecoration: 'line-through' }}>
                      {t('rescheduled_from')}: {new Date(searchResult.originalEventDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                    </p>
                  )}
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
                  onClick={() => downloadEventPdf(searchResult)}
                >
                  {t('download_pdf')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openReschedule(searchResult)}
                >
                  {t('reschedule')}
                </Button>
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

      {/* Month filter for the events list */}
      {events && events.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: 'rgba(226,232,240,0.6)' }}>{t('event_date')}:</span>
          <select
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="adm-input"
            style={{
              padding: '6px 12px', fontSize: 13, fontWeight: 600, borderRadius: 999, cursor: 'pointer',
              background: monthFilter ? 'rgba(var(--adm-accent-rgb),0.15)' : 'rgba(255,255,255,0.04)',
              color: monthFilter ? 'var(--adm-accent)' : 'rgba(226,232,240,0.7)',
              border: `1px solid ${monthFilter ? 'rgba(var(--adm-accent-rgb),0.4)' : 'rgba(255,255,255,0.1)'}`,
              colorScheme: 'dark', width: 'auto',
            }}
          >
            <option value="">{t('all_months')}</option>
            {availableMonths.map((ym) => (
              <option key={ym} value={ym}>{monthLabel(ym)}</option>
            ))}
          </select>
        </div>
      )}

      {isLoading ? <p>{t('loading_events')}</p> : null}
      {isError ? <p>{t('failed_load_events')}</p> : null}
      {filteredEvents ? (
        <EventList
          events={filteredEvents}
          onEdit={(eventId) => {
            const event = filteredEvents.find((item) => item.id === eventId);
            if (event) startEditing(event);
          }}
          onDownloadPdf={(eventId) => {
            const event = filteredEvents.find((item) => item.id === eventId);
            if (event) downloadEventPdf(event);
          }}
          onReschedule={(eventId) => {
            const event = filteredEvents.find((item) => item.id === eventId);
            if (event) openReschedule(event);
          }}
          onDelete={(eventId) => deleteMutation.mutate(eventId)}
          deletingId={deleteMutation.isPending ? deleteMutation.variables ?? null : null}
        />
      ) : null}

      {/* Reschedule modal — pick a new date/time; the old date is preserved. */}
      {reschedulingId !== null && (
        <div
          onClick={() => setReschedulingId(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000, display: 'flex',
            alignItems: 'center', justifyContent: 'center', padding: 16,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          }}
        >
          <div
            className="adm-card"
            onClick={(e) => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 420, padding: 24 }}
          >
            <h3 className="adm-heading" style={{ marginTop: 0, marginBottom: 16 }}>{t('reschedule_event')}</h3>
            <div style={{ display: 'grid', gap: 12 }}>
              <label style={{ display: 'grid', gap: 6 }}>
                {t('new_date')}
                <Input type="date" value={rescheduleDate} onChange={(e) => setRescheduleDate(e.target.value)} />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                {t('new_time')}
                <Input type="time" value={rescheduleTime} onChange={(e) => setRescheduleTime(e.target.value)} />
              </label>
              {rescheduleMutation.isError && (
                <span style={{ color: '#b00020' }}>
                  {rescheduleMutation.error instanceof Error ? rescheduleMutation.error.message : 'Failed to reschedule.'}
                </span>
              )}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                <Button type="button" variant="secondary" onClick={() => setReschedulingId(null)}>
                  {t('cancel')}
                </Button>
                <Button
                  type="button"
                  onClick={submitReschedule}
                  disabled={!rescheduleDate || !rescheduleTime || rescheduleMutation.isPending}
                >
                  {rescheduleMutation.isPending ? t('updating') : t('reschedule')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};