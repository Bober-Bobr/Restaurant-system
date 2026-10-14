import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authService } from '../services/auth.service';
import { useAuthStore } from '../store/auth.store';
import { DEFAULT_WORK_AREA, canSetWorkArea, hasWorkArea, workAreaOf, workAreaSurface, type WorkArea } from './workArea';

/**
 * Which floor this member of staff is on, and the switch that moves them.
 *
 * **It is asked of the SERVER, not read from the signed-in session.** The work
 * area is a column on the account and a manager may change it mid-shift — a
 * value cached in the browser would leave a waiter looking at the wrong floor's
 * chrome while the server quite correctly handed them the other floor's orders,
 * which is the worst of both. The session's copy is `initialData`, so the first
 * paint is right and nothing flickers.
 *
 * One hook for every screen that needs it — the layout (which paints the look)
 * and the orders page (which draws the controls) — so the two cannot disagree
 * about where somebody is working.
 */
export const WORK_AREA_KEY = ['me', 'work-area'] as const;

export function useWorkArea() {
  const queryClient = useQueryClient();
  const role = useAuthStore((s) => s.role);
  const stored = useAuthStore((s) => s.workArea);
  const setStored = useAuthStore((s) => s.setWorkArea);

  const query = useQuery({
    queryKey: WORK_AREA_KEY,
    queryFn: () => authService.me(),
    // Only the roles that stand on a floor have one; nobody else should be
    // asking, and a positive list is what stops a role added to these screens
    // later quietly acquiring a setting nobody designed for it.
    enabled: !!role && hasWorkArea(role),
    initialData: { id: '', username: '', role: role!, workArea: stored },
    // A manager's change should reach the floor within a minute, without
    // anybody signing out. Cheap: one row by primary key.
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  const area: WorkArea = role && hasWorkArea(role) ? workAreaOf(query.data?.workArea) : DEFAULT_WORK_AREA;

  const switchTo = useMutation({
    mutationFn: (next: WorkArea) => authService.setWorkArea('me', next),
    onSuccess: (user) => {
      const next = workAreaOf(user.workArea);
      // The session's copy is updated too, or the next cold load would paint
      // the old floor for a moment.
      setStored(next);
      queryClient.setQueryData(WORK_AREA_KEY, { id: user.id, username: user.username, role: user.role, workArea: next });
      // Everything on the floor is now a different list: the orders, what is
      // waiting to be taken, and the alert count (which is zero in Small
      // Banquets — there is no guest device to call from).
      void queryClient.invalidateQueries({ queryKey: ['wt-orders'] });
      void queryClient.invalidateQueries({ queryKey: ['wt-pending'] });
      void queryClient.invalidateQueries({ queryKey: ['wt-alerts'] });
    },
  });

  return {
    area,
    surface: workAreaSurface(area),
    /**
     * Whether this person may move THEMSELVES between floors.
     *
     * A waiter may not: the floor is an assignment their manager makes, and a
     * waiter who could re-choose it could take a party's order out of a queue
     * somebody else is answerable for. The same shared rule the server
     * applies, so the control exists exactly where the request would succeed.
     */
    canSwitch: !!role && canSetWorkArea(role, role),
    /** Whether this role works a floor at all — what the badge is shown for. */
    onAFloor: !!role && hasWorkArea(role),
    switchTo: (next: WorkArea) => switchTo.mutate(next),
    switching: switchTo.isPending,
  };
}
