import axios from 'axios';
import type { Hall } from '../types/domain';

const publicHallsUrl = (): string => {
  const apiRoot = (import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api').replace(/\/$/, '');
  return `${apiRoot}/public/halls`;
};

export const publicHallService = {
  async listActive(): Promise<Hall[]> {
    const { data } = await axios.get<Hall[]>(publicHallsUrl());
    return data;
  }
};