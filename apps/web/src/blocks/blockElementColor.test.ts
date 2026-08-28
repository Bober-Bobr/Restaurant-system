import { describe, expect, it } from 'vitest';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BlockView, type RenderCtx } from './BlockRenderer';
import { createBlock, hasElementColor, elementColor, type Block, type BlockType } from './types';

/**
 * Every block now carries TWO colours: `textColor` for its type, and
 * `elementColor` for the surfaces it paints — the gallery's arrow discs, the
 * menu badge, the social chips, the contact circles, the button pill, the
 * divider glyph. They must move independently: setting one must not change the
 * other, which is the whole point of splitting them.
 *
 * Rendered rather than unit-tested, because the defect this guards against is a
 * value never reaching the markup. The web suite has no DOM, but
 * `renderToStaticMarkup` needs none.
 */
const ctx: RenderCtx = { accent: '#c8a97a', text: '#1a1817', textScale: 1 };

const ELEMENT = '#3311ff';
const INK = '#ff0000';

// Blocks that render nothing without content would compare equal vacuously.
const CONTENT: Partial<Record<BlockType, Record<string, unknown>>> = {
  hero: { title: 'Hi', subtitle: 'sub' },
  button: { label: 'Press' },
  countdown: { targetAt: '2030-01-01T00:00:00.000Z', label: 'left' },
  timing: { title: 'Timing', items: [{ time: '18:40', label: 'Gather' }] },
  gallery: { items: [{ photoUrl: '/uploads/a.jpg' }, { photoUrl: '/uploads/b.jpg' }] },
  menu: { title: 'MENU', items: [{ number: 1, name: 'Plov', photoUrl: '/uploads/a.jpg' }] },
  link: { label: 'Link', sublabel: 'sub' },
  socials: { title: 'Follow', links: [{ label: 'IG', url: 'https://example.com' }] },
  contacts: { title: 'Contact', phone: '1', telegramUrl: 'https://t.me/x' },
  rsvp: { title: 'RSVP' },
  form: { title: 'Lead', buttonLabel: 'Send' },
  savecontact: { label: 'Save', name: 'A', phone: '1' },
  map: { label: 'MAP', address: 'Tashkent' },
  promo: { title: 'Promo', code: 'SALE' },
  divider: { shape: 'icon', text: '★' },
  vccontact: { phone: '998901234567' },
};

// BlockView, not BlockList: `vccontact` is deliberately filtered out of the
// list (the flyer page renders it below the footer), and these tests are about
// one block's own markup either way.
function withProps(type: BlockType, extra: Record<string, unknown> = {}): Block {
  const b: Block = createBlock(type);
  b.props = { ...b.props, ...(CONTENT[type] ?? {}), ...extra };
  return b;
}

function render(type: BlockType, extra: Record<string, unknown> = {}): string {
  return renderToStaticMarkup(h(BlockView, { block: withProps(type, extra), ctx }));
}

const COLOURED = (Object.keys(CONTENT) as BlockType[]).filter(hasElementColor);

describe('a block paints its own surfaces', () => {
  for (const type of COLOURED) {
    it(`${type}: an element colour reaches the markup`, () => {
      const plain = render(type);
      const painted = render(type, { elementColor: ELEMENT });
      expect(plain.length, `${type} rendered nothing to compare`).toBeGreaterThan(50);
      expect(painted, `${type} ignored elementColor`).toContain(ELEMENT);
      expect(painted).not.toBe(plain);
    });

    it(`${type}: the block's own colour wins over the page accent`, () => {
      const THEME = '#0abf53';
      const painted = renderToStaticMarkup(
        h(BlockView, { block: withProps(type, { elementColor: ELEMENT }), ctx: { ...ctx, accent: THEME } }),
      );
      expect(painted).toContain(ELEMENT);
      expect(painted, `${type}: the page accent still shows through`).not.toContain(THEME);
    });

  }
});

describe('the two colours are independent', () => {
  for (const type of COLOURED) {
    it(`${type}: setting the element colour leaves the text colour alone`, () => {
      // The bug this splits apart: one picker used to drive both, so a designer
      // could not have a dark pill with light lettering.
      const both = render(type, { elementColor: ELEMENT, textColor: INK });
      expect(both, `${type}: lost the element colour`).toContain(ELEMENT);
      expect(both, `${type}: lost the text colour`).toContain(INK);
    });

    it(`${type}: a text colour alone does not paint the surface`, () => {
      const inked = render(type, { textColor: INK });
      expect(inked).not.toContain(ELEMENT);
    });
  }
});

describe('the gallery arrows', () => {
  // The reported defect: changing the accent recoloured the round buttons, but
  // the chevrons on them stayed a hardcoded white — so a pale disc made the
  // arrows vanish.
  const discOf = (html: string) => html.match(/border-radius:50%;background:([^;]+);color:([^;]+)/);

  it('the chevron takes the block text colour, not a fixed white', () => {
    const html = render('gallery', { elementColor: ELEMENT, textColor: INK });
    expect(html).toContain(`background:${ELEMENT}`);
    expect(html).toContain(`color:${INK}`);
  });

  it('a pale disc still gets a dark chevron when no text colour is set', () => {
    // Legible by default: the fallback is contrast with the disc, never white.
    const html = render('gallery', { elementColor: '#ffffff' });
    const m = discOf(html);
    expect(m, 'no arrow disc rendered').toBeTruthy();
    expect(m![2]).not.toMatch(/#fff|#ffffff|white/i);
  });

  it('a dark disc gets a light chevron', () => {
    const m = discOf(render('gallery', { elementColor: '#101010' }));
    expect(m![2].toLowerCase()).toBe('#f5f5f5');
  });

  it('the disc and the chevron are never the same colour by accident', () => {
    for (const disc of ['#ffffff', '#101010', '#c8a97a', '#3311ff']) {
      const m = discOf(render('gallery', { elementColor: disc }));
      expect(m![1].toLowerCase(), disc).not.toBe(m![2].toLowerCase());
    }
  });
});

describe('which blocks drew from the page accent before this', () => {
  // Not every block had a colour at all. The pill blocks painted a fixed black,
  // and the contact discs a fixed #0d0d0d, so the page theme never reached
  // them — those are the ones that gain a control they simply did not have.
  // Recorded rather than asserted loosely, so that a block quietly losing its
  // link to the page accent shows up here.
  const followsPageAccent = (type: BlockType) =>
    renderToStaticMarkup(h(BlockView, { block: withProps(type), ctx: { ...ctx, accent: '#0abf53' } }))
      !== render(type);

  it('the accent-driven blocks still follow the page theme', () => {
    for (const type of ['hero', 'button', 'countdown', 'timing', 'gallery', 'menu', 'socials', 'promo', 'divider', 'form'] as BlockType[]) {
      expect(followsPageAccent(type), `${type} stopped following the page accent`).toBe(true);
    }
  });

  it('names the blocks that never did', () => {
    // `link` prefers its own legacy colour field; the rest paint fixed surfaces.
    for (const type of ['link', 'contacts', 'map', 'vccontact'] as BlockType[]) {
      expect(followsPageAccent(type), `${type} unexpectedly follows the page accent`).toBe(false);
    }
  });
});

describe('which blocks offer the control', () => {
  it('is hidden on blocks that draw nothing but type', () => {
    // A picker that changes nothing is worse than no picker.
    for (const type of ['heading', 'text', 'html', 'image', 'video'] as BlockType[]) {
      expect(hasElementColor(type), type).toBe(false);
    }
  });

  it('is offered everywhere else', () => {
    for (const type of ['gallery', 'button', 'contacts', 'divider', 'menu'] as BlockType[]) {
      expect(hasElementColor(type), type).toBe(true);
    }
  });

  it('a pure-type block ignores the prop even if one is stored', () => {
    for (const type of ['heading', 'text'] as BlockType[]) {
      const b = createBlock(type);
      b.props = { ...b.props, text: 'Hello' };
      const plain = renderToStaticMarkup(h(BlockView, { block: b, ctx }));
      const painted = renderToStaticMarkup(
        h(BlockView, { block: { ...b, props: { ...b.props, elementColor: ELEMENT } }, ctx }),
      );
      expect(painted).toBe(plain);
    }
  });

  it('reads the stored value, treating blank as unset', () => {
    expect(elementColor({ elementColor: ELEMENT })).toBe(ELEMENT);
    expect(elementColor({ elementColor: '' })).toBeNull();
    expect(elementColor({})).toBeNull();
    expect(elementColor({ elementColor: 42 })).toBeNull();
  });
});

describe('the link bar keeps the colour it was published with', () => {
  it('falls back to the legacy per-block colour field', () => {
    // Every existing link block stores `color`, and its own picker is gone now.
    const html = render('link', { color: '#e8792e' });
    expect(html).toContain('#e8792e');
  });

  it('the element colour wins over it', () => {
    const html = render('link', { color: '#e8792e', elementColor: ELEMENT });
    expect(html).toContain(ELEMENT);
    expect(html).not.toContain('#e8792e');
  });
});
