import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { EventList } from '../components/events/EventList';
import { eventService } from '../services/event.service';
import { hallService } from '../services/hall.service';
import { tableCategoryService } from '../services/tableCategory.service';
import type { Event } from '../types/domain';

const parsePositiveInt = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
};

const phoneValidators: Record<string, RegExp> = {
  US: /^(\+1)?(\d{3})[-.\s]?(\d{3})[-.\s]?(\d{4})$/,
  CA: /^(\+1)?(\d{3})[-.\s]?(\d{3})[-.\s]?(\d{4})$/,
  GB: /^(\+44|44)?\d{10,11}$/,
  DE: /^(\+49|49)?[1-9]\d{6,14}$/,
  FR: /^(\+33|33|0)\d{9}$/,
  IT: /^(\+39|39)?\d{9,11}$/,
  ES: /^(\+34|34)?[6-9]\d{8}$/,
  RU: /^(\+7|8)(\d{10})$/,
  CN: /^(\+86|86)?1[3-9]\d{9}$/,
  JP: /^(\+81|81|0)\d{9,10}$/,
  KR: /^(\+82|82|0)1[0-9]\d{7,8}$/,
  AU: /^(\+61|61|0)[2-478]\d{8}$/,
  UZ: /^(\+998|998)?\d{9}$/,
  EU: /^\+?[1-9]\d{1,14}$/
};

const countryFlagMap: Record<NonNullable<Event['region']>, string> = {
  US: '🇺🇸',
  CA: '🇨🇦',
  GB: '🇬🇧',
  DE: '🇩🇪',
  FR: '🇫🇷',
  IT: '🇮🇹',
  ES: '🇪🇸',
  RU: '🇷🇺',
  CN: '🇨🇳',
  JP: '🇯🇵',
  KR: '🇰🇷',
  AU: '🇦🇺',
  UZ: '🇺🇿',
  EU: '🇪🇺'
};

// Map phone code prefixes to region
const phoneCodeToRegion: Record<string, NonNullable<Event['region']>> = {
  '+1': 'US', // US and CA share +1, default to US
  '+44': 'GB',
  '+49': 'DE',
  '+33': 'FR',
  '+39': 'IT',
  '+34': 'ES',
  '+7': 'RU',
  '+86': 'CN',
  '+81': 'JP',
  '+82': 'KR',
  '+61': 'AU',
  '+998': 'UZ'
};

const detectRegionFromPhone = (phone: string): NonNullable<Event['region']> | null => {
  if (!phone.startsWith('+')) return null;
  
  // Try to match the longest code first for accuracy
  const codes = Object.keys(phoneCodeToRegion).sort((a, b) => b.length - a.length);
  for (const code of codes) {
    if (phone.startsWith(code)) {
      return phoneCodeToRegion[code];
    }
  }
  return null;
};

const formatPhoneNumber = (phone: string, region: NonNullable<Event['region']> | null): string => {
  // Remove all non-digit and non-plus characters
  const cleaned = phone.replace(/[^\d+]/g, '');
  
  if (!cleaned) return '';
  
  // Format based on region
  if (region === 'RU' && (cleaned.startsWith('+7') || cleaned.startsWith('8'))) {
    // Russian format: +7 (XXX) XXX-XX-XX
    if (cleaned.startsWith('+7')) {
      const rest = cleaned.slice(2);
      if (rest.length <= 3) return `+7 ${rest}`;
      if (rest.length <= 6) return `+7 (${rest.slice(0, 3)}) ${rest.slice(3)}`;
      if (rest.length <= 8) return `+7 (${rest.slice(0, 3)}) ${rest.slice(3, 6)}-${rest.slice(6)}`;
      return `+7 (${rest.slice(0, 3)}) ${rest.slice(3, 6)}-${rest.slice(6, 8)}-${rest.slice(8, 10)}`;
    }
    if (cleaned.startsWith('8')) {
      const rest = cleaned.slice(1);
      if (rest.length <= 3) return `8 ${rest}`;
      if (rest.length <= 6) return `8 (${rest.slice(0, 3)}) ${rest.slice(3)}`;
      if (rest.length <= 8) return `8 (${rest.slice(0, 3)}) ${rest.slice(3, 6)}-${rest.slice(6)}`;
      return `8 (${rest.slice(0, 3)}) ${rest.slice(3, 6)}-${rest.slice(6, 8)}-${rest.slice(8, 10)}`;
    }
  } else if (region === 'US' || region === 'CA') {
    // US/CA format: +1 (XXX) XXX-XXXX
    if (cleaned.startsWith('+1')) {
      const rest = cleaned.slice(2);
      if (rest.length <= 3) return `+1 ${rest}`;
      if (rest.length <= 6) return `+1 (${rest.slice(0, 3)}) ${rest.slice(3)}`;
      return `+1 (${rest.slice(0, 3)}) ${rest.slice(3, 6)}-${rest.slice(6, 10)}`;
    }
  } else if (region === 'GB') {
    // GB format: +44 XXXX XXX XXXX
    if (cleaned.startsWith('+44')) {
      const rest = cleaned.slice(3);
      if (rest.length <= 4) return `+44 ${rest}`;
      if (rest.length <= 7) return `+44 ${rest.slice(0, 4)} ${rest.slice(4)}`;
      return `+44 ${rest.slice(0, 4)} ${rest.slice(4, 7)} ${rest.slice(7)}`;
    }
  } else if (region === 'DE') {
    // Germany format: +49 XXX XXX XXXX
    if (cleaned.startsWith('+49')) {
      const rest = cleaned.slice(3);
      if (rest.length <= 3) return `+49 ${rest}`;
      if (rest.length <= 6) return `+49 ${rest.slice(0, 3)} ${rest.slice(3)}`;
      return `+49 ${rest.slice(0, 3)} ${rest.slice(3, 6)} ${rest.slice(6)}`;
    }
  } else if (region === 'FR') {
    // France format: +33 X XX XX XX XX
    if (cleaned.startsWith('+33')) {
      const rest = cleaned.slice(3);
      if (rest.length <= 1) return `+33 ${rest}`;
      if (rest.length <= 3) return `+33 ${rest.slice(0, 1)} ${rest.slice(1)}`;
      if (rest.length <= 5) return `+33 ${rest.slice(0, 1)} ${rest.slice(1, 3)} ${rest.slice(3)}`;
      if (rest.length <= 7) return `+33 ${rest.slice(0, 1)} ${rest.slice(1, 3)} ${rest.slice(3, 5)} ${rest.slice(5)}`;
      return `+33 ${rest.slice(0, 1)} ${rest.slice(1, 3)} ${rest.slice(3, 5)} ${rest.slice(5, 7)} ${rest.slice(7)}`;
    }
  } else if (region === 'IT') {
    // Italy format: +39 XXX XXX XXXX
    if (cleaned.startsWith('+39')) {
      const rest = cleaned.slice(3);
      if (rest.length <= 3) return `+39 ${rest}`;
      if (rest.length <= 6) return `+39 ${rest.slice(0, 3)} ${rest.slice(3)}`;
      return `+39 ${rest.slice(0, 3)} ${rest.slice(3, 6)} ${rest.slice(6)}`;
    }
  } else if (region === 'ES') {
    // Spain format: +34 XXX XX XX XX
    if (cleaned.startsWith('+34')) {
      const rest = cleaned.slice(3);
      if (rest.length <= 3) return `+34 ${rest}`;
      if (rest.length <= 5) return `+34 ${rest.slice(0, 3)} ${rest.slice(3)}`;
      if (rest.length <= 7) return `+34 ${rest.slice(0, 3)} ${rest.slice(3, 5)} ${rest.slice(5)}`;
      return `+34 ${rest.slice(0, 3)} ${rest.slice(3, 5)} ${rest.slice(5, 7)} ${rest.slice(7)}`;
    }
  } else if (region === 'CN') {
    // China format: +86 XXX XXXX XXXX
    if (cleaned.startsWith('+86')) {
      const rest = cleaned.slice(3);
      if (rest.length <= 3) return `+86 ${rest}`;
      if (rest.length <= 7) return `+86 ${rest.slice(0, 3)} ${rest.slice(3)}`;
      return `+86 ${rest.slice(0, 3)} ${rest.slice(3, 7)} ${rest.slice(7)}`;
    }
  } else if (region === 'JP') {
    // Japan format: +81 XX XXXX XXXX
    if (cleaned.startsWith('+81')) {
      const rest = cleaned.slice(3);
      if (rest.length <= 2) return `+81 ${rest}`;
      if (rest.length <= 6) return `+81 ${rest.slice(0, 2)} ${rest.slice(2)}`;
      return `+81 ${rest.slice(0, 2)} ${rest.slice(2, 6)} ${rest.slice(6)}`;
    }
  } else if (region === 'KR') {
    // South Korea format: +82 X XXXX XXXX
    if (cleaned.startsWith('+82')) {
      const rest = cleaned.slice(3);
      if (rest.length <= 1) return `+82 ${rest}`;
      if (rest.length <= 5) return `+82 ${rest.slice(0, 1)} ${rest.slice(1)}`;
      return `+82 ${rest.slice(0, 1)} ${rest.slice(1, 5)} ${rest.slice(5)}`;
    }
  } else if (region === 'AU') {
    // Australia format: +61 X XXXX XXXX
    if (cleaned.startsWith('+61')) {
      const rest = cleaned.slice(3);
      if (rest.length <= 1) return `+61 ${rest}`;
      if (rest.length <= 5) return `+61 ${rest.slice(0, 1)} ${rest.slice(1)}`;
      return `+61 ${rest.slice(0, 1)} ${rest.slice(1, 5)} ${rest.slice(5)}`;
    }
  } else if (region === 'UZ') {
    // Uzbekistan format: +998 XX XXX XX XX
    if (cleaned.startsWith('+998')) {
      const rest = cleaned.slice(4);
      if (rest.length <= 2) return `+998 ${rest}`;
      if (rest.length <= 5) return `+998 ${rest.slice(0, 2)} ${rest.slice(2)}`;
      if (rest.length <= 7) return `+998 ${rest.slice(0, 2)} ${rest.slice(2, 5)} ${rest.slice(5)}`;
      return `+998 ${rest.slice(0, 2)} ${rest.slice(2, 5)} ${rest.slice(5, 7)} ${rest.slice(7)}`;
    }
  }
  
  // Default formatting: just add spaces between groups of 3-4 digits
  if (cleaned.startsWith('+')) {
    const code = cleaned.match(/^\+\d{1,3}/)?.[0] || '+';
    const rest = cleaned.slice(code.length);
    if (!rest) return code;
    return `${code} ${rest.replace(/(\d{3,4})(?=\d)/g, '$1 ')}`;
  }
  
  return cleaned.replace(/(\d{3,4})(?=\d)/g, '$1 ');
};

const eventTypes: NonNullable<Event['eventType']>[] = ['RESERVATION', 'BANQUET', 'WEDDING', 'PRIVATE_PARTY', 'CORPORATE'];

export const AdminEventsPage = () => {
  const queryClient = useQueryClient();
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

  // Auto-detect region from phone number
  const detectedRegion = detectRegionFromPhone(customerPhone);
  const region: NonNullable<Event['region']> = detectedRegion || 'EU';

  const validation = useMemo(() => {
    const errors: string[] = [];

    if (customerName.trim().length < 2) errors.push('Customer name must be at least 2 characters.');

    if (customerPhone.trim() && region) {
      const validator = phoneValidators[region];
      if (!validator.test(customerPhone.trim())) {
        errors.push(`Invalid phone number format for region ${region}`);
      }
    }

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
  }, [customerName, customerPhone, eventDateLocal, guestCountText, region, tableCategoryId, tableCategories]);

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
        region,
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
      <h1>Banquet Events</h1>

      <section style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12, marginBottom: 16 }}>
        <h3>{editingId ? 'Edit existing event' : 'Create new event'}</h3>
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
                  region,
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
            Customer name
            <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            Phone Number {region ? countryFlagMap[region] : '📱'}
            <input
              type="tel"
              placeholder="e.g., +7 999 123 45 67"
              value={customerPhone}
              onChange={(e) => {
                const formatted = formatPhoneNumber(e.target.value, region);
                setCustomerPhone(formatted);
              }}
            />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            Event date/time
            <input
              type="datetime-local"
              value={eventDateLocal}
              onChange={(e) => setEventDateLocal(e.target.value)}
            />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            Guests
            <input
              type="number"
              min={1}
              max={5000}
              inputMode="numeric"
              value={guestCountText}
              onChange={(e) => setGuestCountText(e.target.value)}
            />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            Event Type
            <select value={eventType} onChange={(e) => setEventType(e.target.value as NonNullable<Event['eventType']>)}>
              {eventTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            Status
            <select value={status} onChange={(e) => setStatus(e.target.value as NonNullable<Event['status']>)}>
              <option value="DRAFT">DRAFT</option>
              <option value="CONFIRMED">CONFIRMED</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            Hall (Optional)
            <select value={hallId} onChange={(e) => setHallId(e.target.value)}>
              <option value="">-- Select a hall --</option>
              {halls?.map((hall) => (
                <option key={hall.id} value={hall.id}>
                  {hall.name} (Cap: {hall.capacity})
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            Table category (Optional)
            <select value={tableCategoryId} onChange={(e) => setTableCategoryId(e.target.value)}>
              <option value="">-- Select a table category --</option>
              {tableCategories?.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name} - {category.mealPackage} ({category.seatingCapacity} seats, {Number(category.ratePerPerson / 100).toFixed(2)} per person)
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: 'grid', gap: 6, gridColumn: '1 / -1' }}>
            Notes
            <input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 12, alignItems: 'center' }}>
            <button type="submit" disabled={editingId ? !canSave : !canSubmit}>
              {editingId
                ? updateMutation.isPending
                  ? 'Updating...'
                  : 'Update event'
                : createMutation.isPending
                ? 'Creating...'
                : 'Create event'}
            </button>
            {editingId ? (
              <button
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
                Cancel
              </button>
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

      {isLoading ? <p>Loading events...</p> : null}
      {isError ? <p>Failed to load events.</p> : null}
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
