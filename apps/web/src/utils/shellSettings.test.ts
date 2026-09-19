import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as api from '../../../api/src/modules/shellSettings/shellSettings.rules';
import type { AdminRole } from '../store/auth.store';
import { cateringShell, shellSystemsFor, tabletShell } from './shellSettings';

/**
 * Shell settings: the main admin switches the tablet's effects, the food admin
 * the catering site's, and the two must never interact.
 *
 * The API holds the permission (a save can only reach the caller's own
 * system's columns — see its own tests). This holds the rest of the chain: the
 * web shows each role the same system the API will write, and each surface
 * READS only its own system's switches.
 */
const src = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');

describe('the web offers each role the system the API lets it write', () => {
  // Every role the product has, read from the schema's enum — a role added
  // later is covered without anybody editing a list here.
  const schema = readFileSync(join(__dirname, '..', '..', '..', 'api', 'prisma', 'schema.prisma'), 'utf8');
  const enumBody = schema.slice(schema.indexOf('enum AdminRole {'), schema.indexOf('}', schema.indexOf('enum AdminRole {')));
  const roles = [...enumBody.matchAll(/^\s+([A-Z_]+)\s*$/gm)].map((m) => m[1]);

  it('found the roles', () => {
    expect(roles).toContain('ADMIN');
    expect(roles).toContain('SMALL_KITCHEN');
    expect(roles.length).toBeGreaterThan(10);
  });

  for (const role of roles) {
    it(role, () => {
      expect(shellSystemsFor(role as AdminRole)).toEqual(api.shellSystemsFor(role as Parameters<typeof api.shellSystemsFor>[0]));
    });
  }

  it('the main admin gets the tablet and the food admin the catering site, one each', () => {
    expect(shellSystemsFor('ADMIN')).toEqual(['tablet']);
    expect(shellSystemsFor('CATERING_ADMIN')).toEqual(['catering']);
    expect(shellSystemsFor('SUPERVISOR')).toEqual([]);
  });
});

describe('each surface reads only its own switches', () => {
  // Every field of one system ON and the other OFF, then the reverse: a reader
  // that looked at the wrong system's field would come out mixed.
  const tabletOnly = {
    tabletAnimations: true, tabletMusic: true, tabletTrail: true, tabletParticles: 'snow',
    cateringAnimations: false, cateringMusic: false, cateringTrail: false, cateringParticles: null,
  };
  const cateringOnly = {
    tabletAnimations: false, tabletMusic: false, tabletTrail: false, tabletParticles: null,
    cateringAnimations: true, cateringMusic: true, cateringTrail: true, cateringParticles: 'hearts',
  };

  it('the tablet follows the tablet* fields', () => {
    expect(tabletShell(tabletOnly)).toEqual({ animations: true, music: true, trail: true, particles: 'snow' });
    expect(tabletShell(cateringOnly)).toEqual({ animations: false, music: false, trail: false, particles: 'none' });
  });

  it('the catering site follows the catering* fields', () => {
    expect(cateringShell(cateringOnly)).toEqual({ animations: true, music: true, trail: true, particles: 'hearts' });
    expect(cateringShell(tabletOnly)).toEqual({ animations: false, music: false, trail: false, particles: 'none' });
  });

  it('a payload from before the settings existed reads as everything on — what both shells did then', () => {
    expect(tabletShell({})).toEqual({ animations: true, music: true, trail: true, particles: 'none' });
    expect(cateringShell(undefined)).toEqual({ animations: true, music: true, trail: true, particles: 'none' });
  });

  // The pages themselves: a catering page that read `tabletMusic` would pass
  // the tests above and still couple the two systems.
  const TABLET_FILES = ['store/publicData.store.ts', 'app/TabletLayout.tsx', 'pages/TabletMenuPage.tsx', 'pages/TabletSummaryPage.tsx'];
  const CATERING_FILES = ['pages/CateringSite.tsx', 'foodsite/FoodSiteLayout.tsx'];
  const CATERING_FIELD = /catering(Animations|Music|Trail|Particles)|cateringShell/;
  const TABLET_FIELD = /tablet(Animations|Music|Trail)\b|tabletShell/;

  for (const file of TABLET_FILES) {
    it(`${file} never reads a catering switch`, () => {
      expect(src(file)).not.toMatch(CATERING_FIELD);
    });
  }
  for (const file of CATERING_FILES) {
    it(`${file} follows the catering switches and never the tablet's`, () => {
      const code = src(file);
      expect(code).toContain('cateringShell(');
      expect(code).not.toMatch(TABLET_FIELD);
    });
  }

  it('on every surface, the trail and the music are drawn only when switched on', () => {
    for (const file of ['pages/TabletMenuPage.tsx', 'pages/TabletSummaryPage.tsx', ...CATERING_FILES]) {
      const code = src(file);
      for (const tag of ['<FingerTrail', '<MusicPlayer']) {
        let at = code.indexOf(tag);
        while (at >= 0) {
          // The 60 characters before the tag hold its `… && (` guard.
          expect(code.slice(Math.max(0, at - 60), at), `${file}: an unguarded ${tag}`).toMatch(/(trail|Trail|music|Music)\w*\s*&&\s*\(?\s*$/);
          at = code.indexOf(tag, at + 1);
        }
      }
    }
  });

  it('the tablet does not start its music when switched off', () => {
    const code = src('pages/TabletMenuPage.tsx');
    const at = code.indexOf('startTabletMusic();', code.indexOf('const dismissWelcome'));
    expect(at, 'the welcome no longer starts the music').toBeGreaterThan(-1);
    expect(code.slice(at - 40, at)).toContain('if (tabletMusicOn)');
  });
});

describe('switching animations off never hides a block', () => {
  const css = readFileSync(join(__dirname, '..', 'index.css'), 'utf8');
  const block = css.slice(css.indexOf('.fx-still .reveal {'), css.indexOf('}', css.indexOf('animation-iteration-count: 1 !important;')) + 1);

  it('revealed blocks are shown outright, as under reduced motion', () => {
    expect(block).toMatch(/\.fx-still \.reveal \{[^}]*opacity:\s*1/);
  });

  it('the fade classes are fast-forwarded — never `animation: none`, which leaves a block at its first frame', () => {
    for (const cls of ['tablet-fade-up', 'tablet-fade-in', 'fs-fade-up', 'fs-fade-in']) {
      expect(block, cls).toContain(`.fx-still .${cls}`);
    }
    const fades = block.slice(block.indexOf('.fx-still .tablet-fade-up'));
    expect(fades).not.toMatch(/animation:\s*none/);
    expect(fades).toContain('animation-duration: 1ms !important');
    // The menu grid staggers its cards with an inline delay; that has to go too.
    expect(fades).toContain('animation-delay: 0s !important');
  });

  it('both shells carry the class from their own switch', () => {
    expect(src('app/TabletLayout.tsx')).toMatch(/animations \? undefined : STILL_CLASS/);
    for (const file of ['pages/CateringSite.tsx', 'foodsite/FoodSiteLayout.tsx']) {
      expect(src(file)).toMatch(/shell\.animations \? '' : ` \$\{STILL_CLASS\}`/);
    }
  });
});
