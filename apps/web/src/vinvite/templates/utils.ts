import { getPhotoUrl } from '../../utils/photoUrl';
import type { ScheduleItem, TemplateDefinition } from './types';

// The "when" of a schedule entry is a plain string, printed verbatim by the
// templates — so it can be a clock time ("19:00") or free text ("Spring 2018",
// "2027"). A programme wants the clock; "Our story" wants years. Which input
// the builder shows is stored per entry as `mode`.
//
// When `mode` is absent the input is inferred from the value, so entries saved
// before this existed — and every template's shipped defaults — open in the
// right one. An empty value has nothing to infer from, so it keeps the clock,
// which is what most schedules are.
export function whenMode(item: ScheduleItem): 'time' | 'text' {
  if (item.mode === 'time' || item.mode === 'text') return item.mode;
  if (!(item.time ?? '').trim()) return 'time';
  return /^\d{1,2}:\d{2}$/.test(item.time.trim()) ? 'time' : 'text';
}

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
