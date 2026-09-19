import type { ShellSettings, ShellSystem } from '../utils/shellSettings';
import { httpClient } from './http';

type ShellResponse = { system: ShellSystem; settings: ShellSettings };

/**
 * The Settings page's shell block. `system` is sent every time, but the server
 * honours it for the Chief Admin and the Owner only — a main admin always
 * reaches the tablet and a food admin the catering site, whatever is sent.
 */
export const shellSettingsService = {
  async get(system: ShellSystem) {
    const { data } = await httpClient.get<ShellResponse>('/shell-settings', { params: { system } });
    return data;
  },
  async save(system: ShellSystem, settings: Partial<ShellSettings>) {
    const { data } = await httpClient.put<ShellResponse>('/shell-settings', { ...settings, system });
    return data;
  },
};
