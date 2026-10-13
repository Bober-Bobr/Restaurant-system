import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { stopTabletMusic } from '../utils/tabletMusic';
import { usePublicDataStore } from '../store/publicData.store';
import { useAuthStore } from '../store/auth.store';
import { adminLocale, useTabletStore } from '../store/tablet.store';
import { STILL_CLASS } from '../utils/shellSettings';

/** The Small Banquets kiosk's scope class — see `.svr-kiosk` in index.css. */
export const SECTION_KIOSK_CLASS = 'svr-kiosk';

export const TabletLayout = () => {
  const animations = usePublicDataStore((s) => s.tabletAnimations);
  const role = useAuthStore((s) => s.role);
  const setLocale = useTabletStore((s) => s.setLocale);

  useEffect(() => {
    return () => { stopTabletMusic(); };
  }, []);

  /**
   * The kiosk opens in the admin panel's language.
   *
   * ON MOUNT ONLY, which is exactly "when the tablet app is opened": the two
   * kiosk pages share this layout, so moving between the menu and the summary
   * does not re-run it, and the guest's own choice from the kiosk header stands
   * for the rest of their visit. The store's initial value reads the same
   * function, for the first paint; this is what picks up a language the staff
   * changed in the admin panel after the page was loaded.
   */
  useEffect(() => {
    setLocale(adminLocale());
  }, [setLocale]);

  // Two classes, two jobs:
  //   · the main admin's "block appearance animations" switch, applied once for
  //     every kiosk page;
  //   · the Small Banquets kiosk's own look. A scope class rather than forked
  //     pages, the same mechanism `.svr-theme` uses for the section's ~40 admin
  //     screens — the kiosk is 3600 lines across two files and a copy of it
  //     would drift from the original within a release. The palette itself
  //     comes from `kioskTheme`, since the pages set the --rg-* tokens inline
  //     and an inline value beats any class.
  // `display: contents` so the wrapper takes no part in the layout — it exists
  // only to carry the classes the CSS scopes on.
  const classes = [
    animations ? '' : STILL_CLASS,
    role === 'SUPERVISOR' ? SECTION_KIOSK_CLASS : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={classes || undefined} style={{ display: 'contents' }}>
      <Outlet />
    </div>
  );
};
