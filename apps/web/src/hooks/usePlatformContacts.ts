import { useQuery } from '@tanstack/react-query';
import { fetchPlatformContacts, type Brand, type PlatformContact } from '../services/platformContact.service';
import { findVcContact } from '../blocks/BlockRenderer';
import type { Block } from '../blocks/types';

const EMPTY: PlatformContact = { brand: 'vconnect', phone: '', telegram: '' };

// The studio's contact details, shared by every published page. Cached for the
// session — they change about once a year, and a published invitation should
// not spend a request on them per render.
export function usePlatformContacts() {
  const { data } = useQuery({
    queryKey: ['platform-contacts'],
    queryFn: fetchPlatformContacts,
    staleTime: 10 * 60_000,
  });
  return (brand: Brand): PlatformContact => data?.[brand] ?? { ...EMPTY, brand };
}

// A flyer shows the global v-connect details unless it carries its own
// vccontact block, which overrides them for that page only.
export function useFlyerContact(blocks: Block[] | undefined): { phone: string; telegram: string } {
  const contactFor = usePlatformContacts();
  const global = contactFor('vconnect');
  const override = findVcContact(blocks ?? []);
  // An override only counts when it actually carries a value — an empty block
  // must not blank out the global details.
  if (override && (override.phone.trim() || override.telegram.trim())) return override;
  return { phone: global.phone, telegram: global.telegram };
}
