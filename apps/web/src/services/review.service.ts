import axios from 'axios';
import { httpClient } from './http';

export type Review = {
  id: string;
  restaurantId: string;
  authorName: string;
  rating: number;
  text: string | null;
  isApproved: boolean;
  createdAt: string;
};

export type PublicReview = {
  id: string;
  authorName: string;
  rating: number;
  text: string | null;
  createdAt: string;
};

const apiRoot = (): string =>
  (import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api').replace(/\/$/, '');

export const reviewService = {
  // ── Public ──
  async submit(payload: { restaurantId: string; authorName: string; rating: number; text?: string }) {
    await axios.post(`${apiRoot()}/public/reviews`, payload);
  },
  async listApproved(restaurantId: string): Promise<PublicReview[]> {
    const { data } = await axios.get<PublicReview[]>(`${apiRoot()}/public/reviews`, { params: { restaurantId } });
    return data;
  },

  // ── Manager / Chief ──
  async listAll(restaurantId: string): Promise<Review[]> {
    const { data } = await httpClient.get<Review[]>('/reviews', { params: { restaurantId } });
    return data;
  },
  async setApproved(id: string, isApproved: boolean): Promise<Review> {
    const { data } = await httpClient.patch<Review>(`/reviews/${id}/approve`, { isApproved });
    return data;
  },
  async remove(id: string): Promise<void> {
    await httpClient.delete(`/reviews/${id}`);
  },
};
