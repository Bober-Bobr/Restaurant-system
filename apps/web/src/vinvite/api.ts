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

type InviteProjectBase = {
  id: string;
  name: string;
  slug: string | null;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
};

export type InviteProjectSummary = InviteProjectBase & {
  // Enriched by the API for the dashboard cards. `theme` carries the rich
  // design ({ templateId, languages, config }) so the card can show the event
  // date, template name and cover without a second fetch.
  theme?: DesignTheme & Record<string, unknown>;
  views: number;
  rsvpCount: number;
  guestCount: number;
  wishCount: number;
};

export type InviteProject = InviteProjectBase & {
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

// An invitation order placed from a restaurant's Additional Services page.
// Studio-wide operational data — only a SYSTEM_ADMIN can read or change these.
export type InviteRequest = {
  id: string;
  names: string[];
  eventType: string;
  phone: string;
  cardNumber: string | null;
  restaurantName: string;
  eventDate: string;
  eventTime: string;
  menu: string | null;
  performers: string | null;
  photoUrls: string[];
  dressCode: string | null;
  restaurantId: string | null;
  eventNumber: number | null;
  isRead: boolean;
  createdAt: string;
};

export type TelegramLink = {
  id: string;
  chatId: string;
  username: string | null;
  firstName: string | null;
  createdAt: string;
};

export type TelegramStatus = {
  enabled: boolean;
  code?: string;
  link?: string | null;
  links?: TelegramLink[];
};

// System-admin design override for a built-in rich template.
export type TemplateOverride = {
  templateId: string;
  config: Record<string, unknown>;
  updatedAt?: string;
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

  // Built-in template design overrides (Design+ template editing).
  async listTemplateOverrides(): Promise<TemplateOverride[]> {
    const { data } = await viHttp.get<TemplateOverride[]>('/template-overrides');
    return data;
  },
  async saveTemplateOverride(templateId: string, config: Record<string, unknown>): Promise<TemplateOverride> {
    const { data } = await viHttp.put<TemplateOverride>(`/template-overrides/${templateId}`, { config });
    return data;
  },

  // The studio contact block under the "developed with love" credit. Readable
  // by any signed-in user; the PUT is rejected for anyone but a SYSTEM_ADMIN.
  async getPlatformContact(): Promise<{ brand: string; phone: string; telegram: string; instagram: string }> {
    const { data } = await viHttp.get<{ brand: string; phone: string; telegram: string; instagram: string }>('/platform-contact');
    return data;
  },
  async savePlatformContact(payload: { phone: string; telegram: string; instagram: string }) {
    const { data } = await viHttp.put<{ brand: string; phone: string; telegram: string; instagram: string }>('/platform-contact', payload);
    return data;
  },

  // Invitation orders → the Notifications page. SYSTEM_ADMIN only; the server
  // rejects everyone else, so a non-admin never even loads the tab.
  async listInviteRequests(): Promise<InviteRequest[]> {
    const { data } = await viHttp.get<InviteRequest[]>('/invite-requests');
    return data;
  },
  async inviteRequestUnreadCount(): Promise<number> {
    const { data } = await viHttp.get<{ count: number }>('/invite-requests/unread-count');
    return data.count;
  },
  async setInviteRequestRead(id: string, isRead: boolean): Promise<InviteRequest> {
    const { data } = await viHttp.patch<InviteRequest>(`/invite-requests/${id}/read`, { isRead });
    return data;
  },
  async removeInviteRequest(id: string): Promise<void> {
    await viHttp.delete(`/invite-requests/${id}`);
  },

  // RSVP responses (owner)
  async listRsvps(projectId: string): Promise<InviteRsvp[]> {
    const { data } = await viHttp.get<InviteRsvp[]>(`/projects/${projectId}/rsvps`);
    return data;
  },
  async removeRsvp(projectId: string, rsvpId: string): Promise<void> {
    await viHttp.delete(`/projects/${projectId}/rsvps/${rsvpId}`);
  },

  // Telegram RSVP forwarding. These live outside the /vinvite prefix, so pass
  // absolute URLs (viHttp still attaches the invite token + refresh handling).
  async telegramStatus(projectId: string): Promise<TelegramStatus> {
    const { data } = await viHttp.get<TelegramStatus>(`${API_BASE}/telegram/vinvite/${projectId}/status`);
    return data;
  },
  async telegramRotate(projectId: string): Promise<TelegramStatus> {
    const { data } = await viHttp.post<Omit<TelegramStatus, 'enabled'>>(`${API_BASE}/telegram/vinvite/${projectId}/rotate`);
    return { ...data, enabled: true };
  },
  async telegramRemoveLink(projectId: string, linkId: string): Promise<void> {
    await viHttp.delete(`${API_BASE}/telegram/vinvite/${projectId}/links/${linkId}`);
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
