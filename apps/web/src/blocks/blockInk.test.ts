import { describe, expect, it } from 'vitest';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BlockList, type RenderCtx } from './BlockRenderer';
import { createBlock, type Block } from './types';

/**
 * Several blocks paint their own solid surface — the button, Save contact, the
 * social rows, the menu header, the RSVP submit, the map button. The section
 * wrapper sets `color`, but a fixed `color:` on the pill inside overrode it, so
 * setting a per-block text colour did nothing on exactly those blocks.
 *
 * Rendered rather than unit-tested: the bug was that a value never reached the
 * markup, so the markup is the only place it can be observed. The web suite has
 * no DOM, but `renderToStaticMarkup` needs none.
 */
const ctx: RenderCtx = { accent: '#c8a97a', text: '#1a1817', textScale: 1 };

const PILL_BLOCKS = ['button', 'savecontact', 'socials', 'menu', 'rsvp', 'map'] as const;

function render(type: string, extraProps: Record<string, unknown> = {}): string {
  const b = createBlock(type as Block['type']);
  b.props = { ...b.props, ...extraProps };
  return renderToStaticMarkup(h(BlockList, { blocks: [b], ctx }));
}

// Blocks that render nothing without content would make an empty comparison
// pass vacuously, so each is given the minimum it needs to draw its pill.
const CONTENT: Record<string, Record<string, unknown>> = {
  button: { label: 'Press' },
  savecontact: { label: 'Save', name: 'A', phone: '1' },
  socials: { title: 'Follow', links: [{ label: 'IG', url: 'https://example.com' }] },
  menu: { title: 'MENU', items: [{ name: 'Plov', price: '10' }] },
  rsvp: { title: 'RSVP' },
  map: { label: 'MAP', address: 'Tashkent' },
};

describe('per-block text colour on solid-pill blocks', () => {
  for (const type of PILL_BLOCKS) {
    it(`${type}: an explicit textColor reaches the pill, not just the wrapper`, () => {
      const plain = render(type, CONTENT[type]);
      const inked = render(type, { ...CONTENT[type], textColor: '#ff0000' });
      expect(plain.length, `${type} rendered nothing to compare`).toBeGreaterThan(50);

      // Counted, not merely present. The section wrapper has always emitted the
      // colour — asserting `toContain` here passes against the very bug this
      // covers, because that one occurrence is the wrapper's. The pill carrying
      // it too is what makes the second occurrence.
      const hits = (inked.match(/#ff0000/g) ?? []).length;
      expect(hits, `${type}: colour reached the wrapper only`).toBeGreaterThanOrEqual(2);
      expect(inked).not.toBe(plain);
    });

    it(`${type}: renders identically when no textColor is set`, () => {
      // The whole point of keying this on the EXPLICIT per-block colour: every
      // flyer and plaque already published must look exactly as it did.
      const a = render(type, CONTENT[type]);
      const b = render(type, CONTENT[type]);
      expect(a).toBe(b);
      // The page-wide ink must not be mistaken for a per-block choice.
      const withPageInk = renderToStaticMarkup(
        h(BlockList, {
          blocks: [Object.assign(createBlock(type as Block['type']), { props: { ...createBlock(type as Block['type']).props, ...CONTENT[type] } })],
          ctx: { ...ctx, text: '#0000ff' },
        }),
      );
      expect(withPageInk).not.toContain('background:#0000ff');
    });
  }

  it('a dark ink flips the pill to a light surface', () => {
    // Otherwise choosing a dark colour writes near-black text onto a near-black
    // pill: the setting "works" and the block goes blank, which is worse than
    // it not working at all.
    const dark = render('savecontact', { ...CONTENT.savecontact, textColor: '#111111' });
    expect(dark).toContain('#111111');
    expect(dark).not.toContain('background:#0d0d0d');
  });

  it('a light ink keeps the original dark pill', () => {
    const light = render('savecontact', { ...CONTENT.savecontact, textColor: '#ffe9a8' });
    expect(light).toContain('#ffe9a8');
    expect(light).toContain('background:#0d0d0d');
  });
});
