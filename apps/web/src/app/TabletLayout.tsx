import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { stopTabletMusic } from '../utils/tabletMusic';
import { usePublicDataStore } from '../store/publicData.store';
import { STILL_CLASS } from '../utils/shellSettings';

export const TabletLayout = () => {
  const animations = usePublicDataStore((s) => s.tabletAnimations);

  useEffect(() => {
    return () => { stopTabletMusic(); };
  }, []);

  // The main admin's "block appearance animations" switch, applied once for
  // every kiosk page. `display: contents` so the wrapper takes no part in the
  // layout — it exists only to carry the class the CSS scopes on.
  return (
    <div className={animations ? undefined : STILL_CLASS} style={{ display: 'contents' }}>
      <Outlet />
    </div>
  );
};
