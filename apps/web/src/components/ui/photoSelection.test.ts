import { describe, expect, it, vi } from 'vitest';
import { createElement as h, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { appendUploaded, movePhoto, normalizeSelection, togglePhoto } from './photoSelection';

// The store reaches for `localStorage`, and the picker only wants a locale out
// of it. The photo library is stubbed empty: what is under test here is the
// CHOSEN strip, which is drawn from props.
vi.mock('../../store/admin.store', () => ({
  useAdminStore: () => ({ locale: 'en' }),
}));
vi.mock('../../services/photo.service', () => ({
  photoService: { listPhotos: () => Promise.resolve([]) },
}));

const { PhotoSelector } = await import('./photo-selector');

describe('ticking photos in a gallery', () => {
  it('appends at the end, so adding a photo never changes the cover', () => {
    // The first photo is the cover (utils/hallPhotos.ts). If a tick inserted at
    // the front, choosing a sixth photo would silently replace the picture the
    // kiosk and the booking form show.
    expect(togglePhoto(['/a.jpg'], '/b.jpg', 10)).toEqual(['/a.jpg', '/b.jpg']);
  });

  it('unticks a photo that is already chosen', () => {
    expect(togglePhoto(['/a.jpg', '/b.jpg'], '/a.jpg', 10)).toEqual(['/b.jpg']);
  });

  it('REFUSES past the cap instead of evicting one already chosen', () => {
    // Dropping the oldest would quietly discard the cover; dropping the newest
    // would make the tick look broken. Refusing, with the button disabled and a
    // line of text saying why, is the only one of the three that is honest.
    const full = ['/a.jpg', '/b.jpg', '/c.jpg'];
    expect(togglePhoto(full, '/d.jpg', 3)).toBe(full);
  });

  it('still allows an UNtick when full', () => {
    expect(togglePhoto(['/a.jpg', '/b.jpg'], '/b.jpg', 2)).toEqual(['/a.jpg']);
  });

  it('drops duplicates, blanks and anything past the cap', () => {
    // An upload of ten files into a gallery with three free slots goes through
    // here. Two tiles sharing a URL would also share a React key.
    expect(normalizeSelection(['/a.jpg', '/a.jpg', '', '  ', '/b.jpg'], 10))
      .toEqual(['/a.jpg', '/b.jpg']);
    expect(normalizeSelection(['/a.jpg', '/b.jpg', '/c.jpg'], 2)).toEqual(['/a.jpg', '/b.jpg']);
  });
});

describe('reordering', () => {
  it('moves a photo one place and shifts the rest along', () => {
    expect(movePhoto(['/a.jpg', '/b.jpg', '/c.jpg'], 2, 1)).toEqual(['/a.jpg', '/c.jpg', '/b.jpg']);
  });

  it('makes a photo the cover by moving it to the front', () => {
    expect(movePhoto(['/a.jpg', '/b.jpg'], 1, 0)).toEqual(['/b.jpg', '/a.jpg']);
  });

  it('does nothing off either end, rather than wrapping', () => {
    const list = ['/a.jpg', '/b.jpg'];
    expect(movePhoto(list, 0, -1)).toBe(list);
    expect(movePhoto(list, 1, 2)).toBe(list);
    expect(movePhoto(list, 5, 0)).toBe(list);
  });
});

describe('what an upload adds', () => {
  it('adds EVERY file in a gallery, in the order they were given', () => {
    // The whole of the request: the file dialog has always accepted several, and
    // the picker kept the first and dropped the rest.
    expect(appendUploaded(['/a.jpg'], ['/b.jpg', '/c.jpg'], { multiple: true, max: 30 }))
      .toEqual(['/a.jpg', '/b.jpg', '/c.jpg']);
  });

  it('keeps the cover when uploading into a gallery that already has one', () => {
    expect(appendUploaded(['/a.jpg'], ['/b.jpg'], { multiple: true, max: 30 })[0]).toBe('/a.jpg');
  });

  it('fills the free slots and no more', () => {
    expect(appendUploaded(['/a.jpg'], ['/b.jpg', '/c.jpg', '/d.jpg'], { multiple: true, max: 3 }))
      .toEqual(['/a.jpg', '/b.jpg', '/c.jpg']);
  });

  it('replaces the field in single-photo mode, as it always did', () => {
    expect(appendUploaded(['/a.jpg'], ['/b.jpg', '/c.jpg'], { multiple: false, max: 1 }))
      .toEqual(['/b.jpg']);
  });

  it('changes nothing when the upload produced no files', () => {
    const before = ['/a.jpg'];
    expect(appendUploaded(before, [], { multiple: true, max: 30 })).toBe(before);
  });
});

// ── The markup, because a value that never reaches it is the whole bug ───────
// Same reasoning as blockInk.test.ts: the picker could hold a correct selection
// and draw none of it.
function render(node: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderToStaticMarkup(h(QueryClientProvider, { client }, node));
}

describe('the gallery picker draws the chosen photos', () => {
  const gallery = (photos: string[], max = 30) =>
    render(
      h(PhotoSelector, {
        category: 'hall',
        multiple: true,
        selectedPhotoUrls: photos,
        onPhotosChange: () => {},
        max,
      }),
    );

  it('draws every chosen photo, not just the first', () => {
    const html = gallery(['/uploads/hall/a.jpg', '/uploads/hall/b.jpg', '/uploads/hall/c.jpg']);
    for (const name of ['a.jpg', 'b.jpg', 'c.jpg']) expect(html).toContain(name);
  });

  it('names the cover and numbers the rest', () => {
    const html = gallery(['/uploads/hall/a.jpg', '/uploads/hall/b.jpg']);
    expect(html).toContain('Cover');
    // The second photo's position, so the order is readable off the strip.
    expect(html).toContain('>2<');
  });

  it('counts the selection against the cap', () => {
    expect(gallery(['/uploads/hall/a.jpg', '/uploads/hall/b.jpg'])).toContain('2 of 30 chosen');
  });

  it('disables the arrows at the ends', () => {
    // Two photos, so every arrow is at an end: first-back and last-forward.
    const html = gallery(['/uploads/hall/a.jpg', '/uploads/hall/b.jpg']);
    expect((html.match(/disabled=""/g) ?? []).length).toBe(2);
  });

  it('says why the upload button has gone dead once the cap is reached', () => {
    // A disabled button with no explanation is a page that looks broken.
    const html = gallery(['/uploads/hall/a.jpg', '/uploads/hall/b.jpg'], 2);
    expect(html).toContain('Maximum of 2 photos reached.');
  });

  it('shows no strip and no count when nothing is chosen', () => {
    const html = gallery([]);
    expect(html).not.toContain('chosen');
    expect(html).not.toContain('Cover');
  });

  it('leaves single-photo mode exactly as it was', () => {
    // Three other pages mount this picker (the menu, the dish editor, table
    // packages). Gallery mode must not have changed what they draw.
    const html = render(
      h(PhotoSelector, {
        category: 'menu',
        selectedPhotoUrl: '/uploads/menu/a.jpg',
        onPhotoSelect: () => {},
      }),
    );
    expect(html).toContain('Selected');
    expect(html).toContain('Clear');
    expect(html).not.toContain('Cover');
    expect(html).not.toContain('chosen');
  });
});
