import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getTemplate } from './templates';
import { resolveAssetUrls } from './templates/utils';

const html = readFileSync(join(__dirname, 'templates', 'wedding-samarkand', 'template.html'), 'utf8');

/**
 * Lantern Night's gallery showed its six stand-in plates and never the couple's
 * uploaded photos. Every hop from the upload to the frame checked out on its own,
 * so the fix is that the gallery no longer depends on all of them being perfect:
 * it reads a photo in any shape it can arrive in, nothing else on the page can
 * stop it being drawn, and it sits where a guest actually is.
 */
describe('an uploaded photo reaches the frame as an absolute URL, whatever its shape', () => {
  const tpl = getTemplate('wedding-samarkand')!;

  it('resolves { image }, { url }, { src } and bare strings alike', () => {
    const out = resolveAssetUrls(tpl, {
      gallery: [
        { image: '/uploads/a.jpg', caption: {} },
        { url: '/uploads/b.jpg' },
        { src: '/uploads/c.jpg' },
        '/uploads/d.jpg',
        { image: 'https://cdn.example/e.jpg' },
      ],
    });
    const g = out.gallery as unknown[];
    // A relative "/uploads/…" inside the srcdoc frame resolves against the
    // invitation's own host, which does not serve uploads.
    for (const item of g) {
      const url = typeof item === 'string' ? item : Object.values(item as Record<string, unknown>).find((v) => typeof v === 'string');
      expect(url).toMatch(/^https?:\/\//);
    }
    expect((g[4] as { image: string }).image).toBe('https://cdn.example/e.jpg');
  });

  it('the template accepts the same shapes', () => {
    expect(html).toMatch(/function photoUrl\(g\)/);
    expect(html).toMatch(/typeof g === 'string'/);
    expect(html).toMatch(/g\.image \|\| g\.url \|\| g\.src/);
    expect(html).toMatch(/var items = albumPhotos\(\);/);
  });
});

describe('nothing else on the page can stop the gallery being drawn', () => {
  const body = html.slice(html.indexOf('function renderAll() {'), html.indexOf('/* ── Boot'));

  it('every render step is isolated', () => {
    expect(html).toMatch(/function step\(fn\) \{\s*try \{ fn\(\); \} catch/);
    // No bare call left in the chain: one throwing block used to stop every
    // step after it, the gallery among them.
    expect(body).not.toMatch(/^\s{2}render\w+\(\);/m);
    expect(body).toContain('step(renderAlbum);');
  });

  it('draws the gallery before the steps most likely to meet odd data', () => {
    const at = (name: string) => body.indexOf(`step(${name});`);
    expect(at('renderAlbum')).toBeGreaterThan(-1);
    for (const later of ['renderProgramme', 'renderCountdown', 'applyVisibility', 'renderPlace']) {
      expect(at('renderAlbum')).toBeLessThan(at(later));
    }
  });
});

describe('the gallery is where a guest still is', () => {
  it('sits straight after the couple\'s story, before the date — not after the garden walk', () => {
    const pos = (id: string) => html.indexOf(`id="${id}"`);
    expect(pos('couple')).toBeLessThan(pos('album'));
    expect(pos('album')).toBeLessThan(pos('date'));
    expect(pos('album')).toBeLessThan(pos('journey'));
  });

  it('the builder lists it in the same place, and sectionIds follow the page', () => {
    const tpl = getTemplate('wedding-samarkand')!;
    const groups = tpl.groups.map((g) => g.key);
    expect(groups.indexOf('gallery')).toBe(groups.indexOf('story') + 1);
    const ids = tpl.sectionIds ?? [];
    expect(ids.indexOf('album')).toBe(ids.indexOf('couple') + 1);
  });
});
