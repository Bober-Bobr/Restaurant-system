import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { stopTabletMusic } from '../utils/tabletMusic';
import { usePublicDataStore } from '../store/publicData.store';
import { useAuthStore } from '../store/auth.store';
import { STILL_CLASS } from '../utils/shellSettings';

/** The Small Banquets kiosk's scope class — see `.svr-kiosk` in index.css. */
export const SECTION_KIOSK_CLASS = 'svr-kiosk';

export const TabletLayout = () => {
  const animations = usePublicDataStore((s) => s.tabletAnimations);
  const role = useAuthStore((s) => s.role);

  useEffect(() => {
    return () => { stopTabletMusic(); };
  }, []);

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
