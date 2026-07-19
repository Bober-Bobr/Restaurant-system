import axios, { type AxiosError } from 'axios';
import type { Block } from '../blocks/types';
import type { DesignTheme } from '../services/designTemplate.service';
import { useVInviteStore, type InviteUser } from './store';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:4000/api';

export const viHttp = axios.create({ baseURL: `${API_BASE}/vinvite` });

let isRefreshing = false;
let refreshWaiters: ((token: string) => void)[] = [];

viHttp.interceptors.request.use((config) => {
  const token = useVInviteStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

viHttp.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as (typeof error.config & { _retry?: boolean }) | undefined;
    const status = error.response?.status;
    const data = error.response?.data as { code?: string } | undefined;

    if (status === 401 && data?.code === 'TOKEN_EXPIRED' && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;

      if (!isRefreshing) {
        isRefreshing = true;
        const refreshToken = useVInviteStore.getState().refreshToken;
        if (refreshToken) {
          try {
            const response = await axios.post(`${API_BASE}/vinvite/auth/refresh`, { refreshToken });
            const { accessToken, refreshToken: newRefresh, user } = response.data as AuthResponse;
            useVInviteStore.getState().setTokens(accessToken, newRefresh);
            if (user) useVInviteStore.getState().setUser(user);
            refreshWaiters.forEach((cb) => cb(accessToken));
            refreshWaiters = [];
            isRefreshing = false;
            originalRequest.headers.Authorization = `Bearer ${accessToken}`;
            return viHttp(originalRequest);
          } catch {
            useVInviteStore.getState().logout();
            isRefreshing = false;
          }
        } else {
          isRefreshing = false;
        }
        return Promise.reject(error);
      }

      return new Promise((resolve) => {
        refreshWaiters.push((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          resolve(viHttp(originalRequest));
        });
      });
    }

    if (status === 401) useVInviteStore.getState().logout();
    return Promise.reject(error);
  }
);

// ── Types ─────────────────────────────────────────────────────────────────────

export type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: InviteUser;
};

export type InviteSessionInfo = {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  lastUsedAt: string;
  isCurrent: boolean;
};

export type InviteProjectSummary = {
  id: string;
  name: string;
  slug: string | null;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
};

export type InviteProject = InviteProjectSummary & {
  blocks: Block[];
  theme: DesignTheme;
};

export type InviteTemplate = {
  id: string;
  name: string;
  blocks: Block[];
  theme: DesignTheme;
  createdAt: string;
  updatedAt: string;
};

export type PublicInviteSite = {
  name: string;
  slug: string;
  blocks: Block[];
  // Block designs store DesignTheme here; rich designs store
  // { templateId, languages, config } (see vinvite/templates).
  theme: DesignTheme & Record<string, unknown>;
};

export type InviteRsvp = {
  id: string;
  projectId: string;
  guestName: string;
  attending: boolean;
  guests: number;
  dietary: string | null;
  message: string | null;
  createdAt: string;
};

export type RsvpSubmission = {
  name: string;
  attending: boolean;
  guests?: number;
  dietary?: string;
  message?: string;
};

// ── Service ───────────────────────────────────────────────────────────────────

export const vinviteService = {
  // Auth
  async register(payload: { email: string; username: string; password: string }): Promise<AuthResponse> {
    const { data } = await viHttp.post<AuthResponse>('/auth/register', payload);
    return data;
  },
  async login(payload: { identifier: string; password: string }): Promise<AuthResponse> {
    const { data } = await viHttp.post<AuthResponse>('/auth/login', payload);
    return data;
  },
  async google(credential: string): Promise<AuthResponse> {
    const { data } = await viHttp.post<AuthResponse>('/auth/google', { credential });
    return data;
  },
  async logout(): Promise<void> {
    try { await viHttp.post('/auth/logout'); } catch { /* session already gone */ }
  },
  async me(): Promise<InviteUser> {
    const { data } = await viHttp.get<InviteUser>('/auth/me');
    return data;
  },
  async updateProfile(payload: {
    displayName?: string | null; username?: string; currentPassword?: string; newPassword?: string;
  }): Promise<InviteUser> {
    const { data } = await viHttp.patch<InviteUser>('/auth/profile', payload);
    return data;
  },
  async listSessions(): Promise<InviteSessionInfo[]> {
    const { data } = await viHttp.get<InviteSessionInfo[]>('/auth/sessions');
    return data;
  },
  async revokeSession(id: string): Promise<void> {
    await viHttp.delete(`/auth/sessions/${id}`);
  },

  // Projects
  async listProjects(): Promise<InviteProjectSummary[]> {
    const { data } = await viHttp.get<InviteProjectSummary[]>('/projects');
    return data;
  },
  async getProject(id: string): Promise<InviteProject> {
    const { data } = await viHttp.get<InviteProject>(`/projects/${id}`);
    return data;
  },
  async createProject(payload: { name: string; blocks?: Block[]; theme?: DesignTheme }): Promise<InviteProject> {
    const { data } = await viHttp.post<InviteProject>('/projects', payload);
    return data;
  },
  async updateProject(id: string, payload: Partial<{
    name: string; slug: string | null; isPublished: boolean; blocks: Block[]; theme: DesignTheme;
  }>): Promise<InviteProject> {
    const { data } = await viHttp.patch<InviteProject>(`/projects/${id}`, payload);
    return data;
  },
  async removeProject(id: string): Promise<void> {
    await viHttp.delete(`/projects/${id}`);
  },
  async slugCheck(slug: string, projectId?: string): Promise<boolean> {
    const { data } = await viHttp.get<{ available: boolean }>('/slug-check', { params: { slug, projectId } });
    return data.available;
  },

  // Templates
  async listTemplates(): Promise<InviteTemplate[]> {
    const { data } = await viHttp.get<InviteTemplate[]>('/templates');
    return data;
  },
  async getTemplate(id: string): Promise<InviteTemplate> {
    const { data } = await viHttp.get<InviteTemplate>(`/templates/${id}`);
    return data;
  },
  async createTemplate(payload: { name: string; blocks?: Block[]; theme?: DesignTheme }): Promise<InviteTemplate> {
    const { data } = await viHttp.post<InviteTemplate>('/templates', payload);
    return data;
  },
  async updateTemplate(id: string, payload: Partial<{ name: string; blocks: Block[]; theme: DesignTheme }>): Promise<InviteTemplate> {
    const { data } = await viHttp.patch<InviteTemplate>(`/templates/${id}`, payload);
    return data;
  },
  async removeTemplate(id: string): Promise<void> {
    await viHttp.delete(`/templates/${id}`);
  },

  // RSVP responses (owner)
  async listRsvps(projectId: string): Promise<InviteRsvp[]> {
    const { data } = await viHttp.get<InviteRsvp[]>(`/projects/${projectId}/rsvps`);
    return data;
  },
  async removeRsvp(projectId: string, rsvpId: string): Promise<void> {
    await viHttp.delete(`/projects/${projectId}/rsvps/${rsvpId}`);
  },

  // Public site (no auth)
  async publicBySlug(slug: string): Promise<PublicInviteSite> {
    const { data } = await axios.get<PublicInviteSite>(`${API_BASE}/vinvite/public/${encodeURIComponent(slug)}`);
    return data;
  },
  async publicRsvp(slug: string, payload: RsvpSubmission): Promise<void> {
    await axios.post(`${API_BASE}/vinvite/public/${encodeURIComponent(slug)}/rsvp`, payload);
  },
};
