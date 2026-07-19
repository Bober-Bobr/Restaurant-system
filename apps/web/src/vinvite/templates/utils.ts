import { getPhotoUrl } from '../../utils/photoUrl';
import type { TemplateDefinition } from './types';

// Dot-path helpers for reading/writing template config values immutably.
export function getPath(obj: unknown, path: string): unknown {
  let cur: unknown = obj;
  for (const part of path.split('.')) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

export function setPath(obj: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> {
  const parts = path.split('.');
  const next = { ...obj };
  let cur: Record<string, unknown> = next;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const key = parts[i];
    const child = cur[key];
    cur[key] = child && typeof child === 'object' && !Array.isArray(child) ? { ...(child as Record<string, unknown>) } : {};
    cur = cur[key] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]] = value;
  return next;
}

// Uploaded assets are stored as relative /uploads/... paths. The template runs
// in a sandboxed srcdoc iframe, so absolutize them against the API origin
// before injection.
export function resolveAssetUrls(template: TemplateDefinition, config: Record<string, unknown>): Record<string, unknown> {
  const clone = structuredClone(config);
  for (const f of template.fields) {
    if (f.type === 'image' || f.type === 'audio') {
      const v = getPath(clone, f.path);
      if (typeof v === 'string' && v) {
        Object.assign(clone, setPath(clone, f.path, getPhotoUrl(v) ?? v));
      }
    } else if (f.type === 'gallery') {
      const arr = getPath(clone, f.path);
      if (Array.isArray(arr)) {
        for (const item of arr) {
          if (item && typeof item === 'object' && typeof (item as { image?: unknown }).image === 'string') {
            const it = item as { image: string };
            if (it.image) it.image = getPhotoUrl(it.image) ?? it.image;
          }
        }
      }
    }
  }
  return clone;
}
