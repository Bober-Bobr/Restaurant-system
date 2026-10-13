import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_WORK_AREA, type WorkArea } from '../utils/workArea';

export type AdminRole = 'CHIEF_ADMIN' | 'MANAGER' | 'OWNER' | 'ADMIN' | 'CATERING_ADMIN' | 'RESTAURANT_MANAGER' | 'EMPLOYEE' | 'KITCHEN' | 'NFC_MAKER' | 'PERFORMER' | 'HOST' | 'CATERING_EMPLOYEE' | 'SUPERVISOR' | 'SMALL_KITCHEN';

type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  username: string | null;
  role: AdminRole | null;
  restaurantId: string | null;
  restaurantName: string | null;
  /**
   * Which floor this person is working (utils/workArea.ts).
   *
   * Stored here only so the FIRST PAINT after signing in is the right one.
   * `useWorkArea()` is what the screens read — it asks the server, so a
   * manager moving somebody between floors reaches them without a sign-out.
   */
  workArea: WorkArea;
  expiresAt: number | null;
  setTokens: (accessToken: string, refreshToken: string, expiresIn: number) => void;
  setAuth: (accessToken: string, refreshToken: string, username: string, expiresIn: number, role: AdminRole, restaurantId: string | null, restaurantName?: string | null, workArea?: WorkArea) => void;
  setWorkArea: (workArea: WorkArea) => void;
  logout: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      username: null,
      role: null,
      restaurantId: null,
      restaurantName: null,
      workArea: DEFAULT_WORK_AREA,
      expiresAt: null,
      setTokens: (accessToken, refreshToken, expiresIn) =>
        set({ accessToken, refreshToken, expiresAt: Date.now() + expiresIn }),
      setAuth: (accessToken, refreshToken, username, expiresIn, role, restaurantId, restaurantName = null, workArea = DEFAULT_WORK_AREA) =>
        set({ accessToken, refreshToken, username, role, restaurantId, restaurantName, workArea, expiresAt: Date.now() + expiresIn }),
      setWorkArea: (workArea) => set({ workArea }),
      logout: () =>
        set({ accessToken: null, refreshToken: null, username: null, role: null, restaurantId: null, restaurantName: null, workArea: DEFAULT_WORK_AREA, expiresAt: null })
    }),
    { name: 'banquet-admin-auth' }
  )
);
