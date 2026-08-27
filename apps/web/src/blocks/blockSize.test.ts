import { describe, expect, it } from 'vitest';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BlockList, type RenderCtx } from './BlockRenderer';
import { createBlock, elementScale, elementScaleRange, type Block, type BlockType } from './types';

/**
 * The per-block element size: photos, videos, icons, buttons, the divider's gap.
 * "Resize everything except the text" is the requirement, so the tests that
 * matter most are the ones proving text does NOT move with it.
 */
const ctx: RenderCtx = { accent: '#c8a97a', text: '#1a1817', textScale: 1 };

const CONTENT: Partial<Record<BlockType, Record<string, unknown>>> = {
  image: { url: '/uploads/a.jpg' },
  video: { url: '/uploads/a.mp4' },
  gallery: { items: [{ photoUrl: '/uploads/a.jpg' }, { photoUrl: '/uploads/b.jpg' }] },
  menu: { title: 'MENU', items: [{ number: 1, name: 'Plov', photoUrl: '/uploads/a.jpg' }] },
  button: { label: 'Press' },
  savecontact: { label: 'Save', name: 'A', phone: '1' },
  socials: { title: 'Follow', links: [{ label: 'IG', url: 'https://example.com' }] },
  contacts: { title: 'Contact', phone: '1', telegramUrl: 'https://t.me/x' },
  map: { label: 'MAP', address: 'Tashkent' },
  divider: { shape: 'spacer' },
  hero: { title: 'Hi', imageUrl: '/uploads/a.jpg' },
  promo: { title: 'Promo', imageUrl: '/uploads/a.jpg' },
  link: { label: 'Link', sublabel: 'sub' },
};

function render(type: BlockType, scale?: number): string {
  const b: Block = createBlock(type);
  b.props = { ...b.props, ...(CONTENT[type] ?? {}), ...(scale === undefined ? {} : { elementScale: scale }) };
  return renderToStaticMarkup(h(BlockList, { blocks: [b], ctx }));
}

const SCALED: BlockType[] = [
  'hero', 'image', 'video', 'gallery', 'menu', 'button',
  'socials', 'contacts', 'savecontact', 'map', 'promo', 'divider',
];

describe('per-block element size', () => {
  for (const type of SCALED) {
    it(`${type}: the rendered size changes with elementScale`, () => {
      const { min } = elementScaleRange(type);
      const base = render(type);
      const small = render(type, min);
      expect(base.length, `${type} rendered nothing`).toBeGreaterThan(50);
      expect(small, `${type} ignored elementScale`).not.toBe(base);
    });
  }

  it('narrows full-width media to the chosen percentage, centred', () => {
    // The "not equal" checks above would pass on any difference at all; this is
    // what the scale is actually supposed to do to a photo.
    const half = render('image', 0.5);
    expect(half).toContain('width:50%');
    expect(half).toContain('margin:0 auto');
    expect(render('image')).toContain('width:100%');
  });

  it('grows fixed-size elements past 100%', () => {
    // The other half of the range, which only the non-media blocks have.
    const big = render('contacts', 1.5);
    expect(big).toContain('width:78px');   // the 52px icon circle
    expect(render('contacts')).toContain('width:52px');
  });

  it('leaves every font size alone', () => {
    // The whole point of a separate control. If element scale leaked into the
    // text, shrinking a photo would shrink its caption with it — which is
    // exactly what the two existing font sliders are for.
    const fontSizes = (html: string) => (html.match(/font-size:[^;"]+/g) ?? []).sort();
    for (const type of SCALED) {
      const { min, max } = elementScaleRange(type);
      expect(fontSizes(render(type, min)), `${type} at ${min}`).toEqual(fontSizes(render(type)));
      expect(fontSizes(render(type, max)), `${type} at ${max}`).toEqual(fontSizes(render(type)));
    }
  });

  it('a block with no elementScale renders exactly as before', () => {
    // Nothing already published may shift.
    for (const type of SCALED) {
      expect(render(type, 1)).toBe(render(type));
    }
  });

  it('pure-text blocks are untouched by it', () => {
    for (const type of ['heading', 'text'] as BlockType[]) {
      const b: Block = createBlock(type);
      b.props = { ...b.props, text: 'Hello' };
      const plain = renderToStaticMarkup(h(BlockList, { blocks: [b], ctx }));
      const scaled = renderToStaticMarkup(
        h(BlockList, { blocks: [{ ...b, props: { ...b.props, elementScale: 1.6 } }], ctx }),
      );
      expect(scaled).toBe(plain);
    }
  });
});

describe('elementScale clamping', () => {
  it('media blocks cannot grow past the column', () => {
    // There is nothing wider than the 420px column to grow into, and bleeding
    // past it would put a horizontal scrollbar on a phone.
    expect(elementScaleRange('image').max).toBe(1);
    expect(elementScale({ elementScale: 5 }, 'image')).toBe(1);
  });

  it('fixed-size elements grow and shrink', () => {
    expect(elementScaleRange('button').max).toBeGreaterThan(1);
    expect(elementScale({ elementScale: 1.4 }, 'button')).toBe(1.4);
  });

  it('a junk value falls back inside the range', () => {
    // Values come from saved JSON, so a hand-edited or legacy design must not be
    // able to collapse or explode a layout.
    expect(elementScale({ elementScale: 0 }, 'button')).toBe(elementScaleRange('button').min);
    expect(elementScale({ elementScale: -3 }, 'image')).toBe(elementScaleRange('image').min);
    expect(elementScale({ elementScale: Number.NaN }, 'button')).toBe(1);
    expect(elementScale({ elementScale: 'big' }, 'button')).toBe(1);
    expect(elementScale({}, 'button')).toBe(1);
  });
});
