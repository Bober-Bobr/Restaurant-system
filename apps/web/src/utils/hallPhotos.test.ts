import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MAX_HALL_PHOTOS, hallPhotoList, hallPhotoPayload } from './hallPhotos';
// The API's own cap, imported directly — the web suite already reaches into the
// API this way for `toSubdomainSlug`, the invoice arithmetic and the section
// rule. A picker that stopped at a different number than the server refuses at
// is a save that loses every photo in it.
import { MAX_HALL_PHOTOS as API_MAX_HALL_PHOTOS } from '../../../api/src/modules/hall/hall.schema';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('a hall photo gallery', () => {
  it('puts the cover first and keeps the stored order after it', () => {
    expect(hallPhotoList({ photoUrl: '/a.jpg', photos: ['/b.jpg', '/c.jpg'] }))
      .toEqual(['/a.jpg', '/b.jpg', '/c.jpg']);
  });

  it('does not repeat the cover when it is also in the array', () => {
    // This is the normal case, not an edge one: `hallPhotoPayload` writes the
    // cover into BOTH columns, so every hall saved from an admin screen has it
    // twice. Shown twice it would be a gallery with a duplicate first plate.
    expect(hallPhotoList({ photoUrl: '/a.jpg', photos: ['/a.jpg', '/b.jpg'] }))
      .toEqual(['/a.jpg', '/b.jpg']);
  });

  it('reads a hall that has only the old single column', () => {
    expect(hallPhotoList({ photoUrl: '/a.jpg' })).toEqual(['/a.jpg']);
  });

  it('is empty for a hall with no photos at all', () => {
    expect(hallPhotoList({})).toEqual([]);
    expect(hallPhotoList({ photoUrl: null, photos: [] })).toEqual([]);
  });

  it('ignores blanks rather than drawing an empty image', () => {
    expect(hallPhotoList({ photoUrl: '', photos: ['   ', '/b.jpg'] })).toEqual(['/b.jpg']);
  });

  it('survives a `photos` column that is not an array', () => {
    // It is a Json column, reachable with psql and written by three different
    // screens. Spreading a string would turn one bad row into a gallery of
    // forty-odd broken images, each one character long.
    expect(hallPhotoList({ photoUrl: '/a.jpg', photos: '/b.jpg' })).toEqual(['/a.jpg']);
    expect(hallPhotoList({ photos: { 0: '/b.jpg' } })).toEqual([]);
    expect(hallPhotoList({ photos: [1, null, '/b.jpg'] })).toEqual(['/b.jpg']);
  });
});

describe('what a chosen gallery writes', () => {
  it('mirrors the first photo into photoUrl, so single-photo screens still show the room', () => {
    // The kiosk's hall picker, the booking form and the admin list all read
    // `photoUrl` alone. If the gallery lived only in `photos`, filling it in
    // would have BLANKED the room's picture on every one of them.
    expect(hallPhotoPayload(['/a.jpg', '/b.jpg'])).toEqual({
      photoUrl: '/a.jpg',
      photos: ['/a.jpg', '/b.jpg'],
    });
  });

  it('clears photoUrl with null, never undefined', () => {
    // These payloads are PATCHed, and `JSON.stringify` drops an undefined key
    // entirely — so the server would keep the photo that was just removed and
    // the removal would look as though it had silently failed.
    const payload = hallPhotoPayload([]);
    expect(payload).toEqual({ photoUrl: null, photos: [] });
    expect(JSON.parse(JSON.stringify(payload))).toHaveProperty('photoUrl', null);
  });

  it('writes the reordered cover, so moving a photo to the front changes it', () => {
    expect(hallPhotoPayload(['/b.jpg', '/a.jpg']).photoUrl).toBe('/b.jpg');
  });
});

describe('the photo limit', () => {
  it('matches the number the API refuses at', () => {
    expect(MAX_HALL_PHOTOS).toBe(API_MAX_HALL_PHOTOS);
  });

  it('is the number the API schema actually applies to the array', () => {
    // The constant agreeing is not enough: the schema has to USE it. A
    // `.max(30)` left as a literal beside an exported 30 agrees with the web
    // for exactly as long as nobody edits one of them.
    const schema = readFileSync(join(SRC, '../../api/src/modules/hall/hall.schema.ts'), 'utf8');
    expect(schema).toMatch(/photos:\s*z\.array\(z\.string\(\)\)\.max\(MAX_HALL_PHOTOS\)/);
  });
});

describe('the pages that show hall photos', () => {
  // Three screens combined the two columns by hand before the admin page made a
  // fourth: the catering site, the food-service site and the manager portal.
  // Copies of this rule drift, and a drift means two screens disagree about
  // which photograph is a room's cover.
  const READERS = [
    'pages/CateringSite.tsx',
    'foodsite/HallsPage.tsx',
    'pages/ManagerRestaurantsPage.tsx',
    'pages/AdminHallsPage.tsx',
  ];

  for (const file of READERS) {
    it(`${file} asks the shared helper`, () => {
      const source = readFileSync(join(SRC, file), 'utf8');
      expect(source).toMatch(/from '\.\.\/utils\/hallPhotos'/);
      expect(source).toContain('hallPhotoList(');
    });

    it(`${file} does not combine the two columns itself`, () => {
      const source = readFileSync(join(SRC, file), 'utf8');
      // The shape every one of the copies had.
      expect(source).not.toMatch(/\[\s*hall\.photoUrl\s*,\s*\.\.\./);
      expect(source).not.toMatch(/\[\s*h\.photoUrl\s*,\s*\.\.\./);
    });
  }

  for (const file of ['pages/AdminHallsPage.tsx', 'pages/ManagerRestaurantsPage.tsx']) {
    it(`${file} writes the pair through hallPhotoPayload`, () => {
      const source = readFileSync(join(SRC, file), 'utf8');
      expect(source).toContain('hallPhotoPayload(');
      // The hand-written pair, which is what makes the cover drift from the
      // first photo of the gallery.
      expect(source).not.toMatch(/photoUrl:\s*\w+\[0\]/);
    });
  }
});

describe('the halls page offers a gallery in both forms', () => {
  const SOURCE = readFileSync(join(SRC, 'pages/AdminHallsPage.tsx'), 'utf8');

  it('mounts the picker in gallery mode, not single-photo mode', () => {
    // One page serves the banquet ADMIN, the Small Banquets SUPERVISOR and the
    // catering admin (App.tsx mounts it three times), so this one assertion is
    // all three sections.
    const pickers = SOURCE.match(/<PhotoSelector/g) ?? [];
    expect(pickers.length).toBe(2); // the create form and the row editor
    expect(SOURCE.match(/multiple\n/g)?.length ?? 0).toBe(2);
    expect(SOURCE).not.toContain('onPhotoSelect');
  });

  it('caps both pickers at the API limit rather than a literal', () => {
    expect(SOURCE.match(/max=\{MAX_HALL_PHOTOS\}/g)?.length).toBe(2);
  });

  it('clears the chosen gallery once a hall has been created', () => {
    // Eight photos of the room just created, still attached to the next one, is
    // a mistake waiting to be saved — and the single-photo field did exactly
    // that, because the reset never mentioned it.
    const onSuccess = SOURCE.slice(SOURCE.indexOf('onSuccess: async () => {'));
    expect(onSuccess.slice(0, onSuccess.indexOf('}'))).toContain('setPhotos([])');
  });
});
