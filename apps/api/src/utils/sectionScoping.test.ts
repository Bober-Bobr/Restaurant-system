import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Small Banquets keeps its own halls, table packages, extra services and
 * bookings; the dish table is the one thing it shares with the Banquet section.
 *
 * `sectionAgreement.test.ts` (web suite) covers the RULE — that the section
 * comes from the caller's role and cannot be asked for. This covers the reach:
 * that the rule actually gets as far as every query, because a filter missing
 * from one `findMany` is a section boundary with a hole in it, and the hole is
 * invisible until a restaurant has data in both sections.
 *
 * Source-reading rather than behavioural, for the usual reason in this repo:
 * there is no database in the suite, and what is being asserted is the presence
 * of a scope in a query — which is exactly a property of the source.
 */
const API_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const read = (rel: string) => fs.readFileSync(path.join(API_ROOT, rel), 'utf8');
/** Comments explain these rules at length; a presence check must not match the prose. */
const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');

const REPOS = {
  hall: 'src/modules/hall/hall.repository.ts',
  tableCategory: 'src/modules/tableCategory/tableCategory.repository.ts',
  extraService: 'src/modules/extraService/extraService.repository.ts',
  event: 'src/modules/events/event.repository.ts',
} as const;

describe('every list in a section-scoped module filters by section', () => {
  for (const [name, file] of Object.entries(REPOS)) {
    it(name, () => {
      const src = stripComments(read(file));
      // Each `where: { restaurantId ... }` in these four files must carry the
      // section beside it — a list filtered by restaurant alone would hand a
      // supervisor the banquet section's rows. The ONE deliberate exception is
      // identified by its `orderBy` rather than skipped by shape, so a new
      // unscoped query cannot slip through by resembling it.
      const queries = [...src.matchAll(/where:\s*\{([^}]*)\}/g)]
        .map((m) => ({ where: m[1], after: src.slice(m.index!, m.index! + 200) }))
        .filter((q) => q.where.includes('restaurantId'));
      expect(queries.length, 'no restaurant-scoped query found at all').toBeGreaterThan(0);
      for (const { where, after } of queries) {
        // The event-number allocator counts across the WHOLE restaurant on
        // purpose — see the block below.
        if (after.includes("orderBy: { eventNumber: 'desc' }")) continue;
        expect(where, `unsectioned query: where: {${where}}`).toContain('section');
      }
    });
  }

  it('and every create stamps it', () => {
    for (const [name, file] of Object.entries(REPOS)) {
      const src = stripComments(read(file));
      // Only creates on the section-scoped model itself. `EventPayment` rows
      // are created here too and carry no section of their own — they hang off
      // an event, which has one, and giving them a second copy would be a
      // second thing to keep in step.
      const model = name === 'event' ? 'event' : name;
      const pattern = new RegExp(`prisma\\.${model}\\.create\\(\\{\\s*\\n?\\s*data:\\s*\\{([^}]*)\\}`, 'g');
      const creates = [...src.matchAll(pattern)].map((m) => m[1]);
      expect(creates.length, `${name}: no create found`).toBeGreaterThan(0);
      for (const data of creates) {
        expect(data, `${name}: create does not stamp the section`).toContain('section');
      }
    }
  });
});

describe('a row fetched by id is re-checked, because the id is all the caller sends', () => {
  // `getById` looks a row up by primary key, so the detail / update / delete
  // paths would otherwise reach the other section's rows by guessing an id —
  // and ids are handed out in list responses to anyone with either section.
  const SERVICES: [string, string][] = [
    ['hall', 'src/modules/hall/hall.service.ts'],
    ['table category', 'src/modules/tableCategory/tableCategory.service.ts'],
    ['extra service', 'src/modules/extraService/extraService.service.ts'],
  ];

  for (const [name, file] of SERVICES) {
    it(`${name}: refuses a row from the other section`, () => {
      const src = stripComments(read(file));
      expect(src).toMatch(/\.section !== section/);
      // 404, not 403: "not yours" and "not there" have to look identical, or
      // the status code itself enumerates the other section's ids.
      const guard = src.slice(src.indexOf('.section !== section'));
      expect(guard.slice(0, 200)).toContain('404');
      expect(guard.slice(0, 200)).not.toContain('403');
    });
  }

  it('events are addressed by NUMBER, which is looked up with the section in the where', () => {
    // The event module has no `getById` — it resolves by (restaurant, number) —
    // so the scope goes in the query rather than in a follow-up check.
    const src = stripComments(read(REPOS.event));
    for (const method of ['getByNumber', 'updateByNumber', 'deleteByNumber']) {
      const at = src.indexOf(`async ${method}(`);
      expect(at, `${method} is gone`).toBeGreaterThan(-1);
      const body = src.slice(at, at + 400);
      expect(body, `${method} does not take a section`).toContain('section: Section');
      expect(body, `${method} does not filter on it`).toMatch(/where:\s*\{[^}]*section/);
    }
  });

  it('reordering table packages cannot touch the other section either', () => {
    // `updateMany` with the scope in the WHERE: an id from the other section
    // matches nothing and is skipped, rather than being reordered by a caller
    // who cannot even see it.
    const src = stripComments(read(REPOS.tableCategory));
    const at = src.indexOf('async saveArrangement(');
    expect(at).toBeGreaterThan(-1);
    expect(src.slice(at, at + 500)).toMatch(/where:\s*\{[^}]*restaurantId,\s*section/);
  });
});

describe('event numbers stay unique across the whole restaurant', () => {
  it('the allocator deliberately counts both sections', () => {
    // Two bookings both called "13" in one venue is an operational hazard — the
    // number is what staff say out loud, and a Chief Admin sees both books. It
    // is also what the unique constraint requires: [restaurantId, eventNumber]
    // is not scoped by section, so allocating within one section would collide
    // with the other's numbers on every insert and burn all the retries.
    const src = read(REPOS.event);
    const at = src.indexOf('orderBy: { eventNumber: \'desc\' }');
    expect(at).toBeGreaterThan(-1);
    const query = src.slice(src.lastIndexOf('where:', at), at);
    expect(query, 'the allocator was scoped to one section').not.toContain('section');
  });

  it('and the schema still keys them per restaurant, not per section', () => {
    const schema = read('prisma/schema.prisma');
    expect(schema).toContain('@@unique([restaurantId, eventNumber])');
  });
});

describe('the schema and the migration', () => {
  const schema = read('prisma/schema.prisma');

  it('carries a section on each of the four models, defaulting to Banquet', () => {
    // The default is what makes the deploy invisible: every existing row is a
    // banquet row, and nothing has to be backfilled.
    const sections = [...schema.matchAll(/section\s+String\s+@default\("BANQUET"\)/g)];
    expect(sections).toHaveLength(4);
  });

  it('moves name uniqueness into the section for halls and packages', () => {
    // Both sections may perfectly well have a "Main hall". Without the section
    // in the key, whichever came second could never use that name at all.
    expect(schema).toContain('@@unique([restaurantId, section, name])');
    expect(schema).not.toMatch(/@@unique\(\[restaurantId, name\]\)/);
  });

  it('gives the section its own list of switched-off dish categories', () => {
    expect(schema).toContain('excludedCategoriesSmallBanquet');
  });

  it('and a migration exists that does all of it', () => {
    const dir = path.join(API_ROOT, 'prisma', 'migrations', '20260908090000_small_banquets_section');
    const sql = fs.readFileSync(path.join(dir, 'migration.sql'), 'utf8');
    expect(sql).toContain(`ALTER TYPE "AdminRole" ADD VALUE IF NOT EXISTS 'SUPERVISOR'`);
    for (const table of ['Event', 'Hall', 'TableCategory', 'ExtraService']) {
      expect(sql, `${table} has no section column`)
        .toContain(`ALTER TABLE "${table}" ADD COLUMN "section" TEXT NOT NULL DEFAULT 'BANQUET'`);
    }
    // The old two-column unique keys must go, or the new three-column ones sit
    // beside them and the second section still cannot reuse a name.
    expect(sql).toContain('DROP INDEX IF EXISTS "Hall_restaurantId_name_key"');
    expect(sql).toContain('DROP INDEX IF EXISTS "TableCategory_restaurantId_name_key"');
    // Seeded from the banquet list: the new section starts out looking like the
    // one it was split from, not with every category switched on.
    expect(sql).toContain('UPDATE "Restaurant" SET "excludedCategoriesSmallBanquet" = "excludedCategoriesBanquet"');
  });
});

describe('who may create a supervisor', () => {
  const auth = stripComments(read('src/modules/auth/auth.service.ts'));

  it('the Chief Admin and the restaurant Owner, and nobody else', () => {
    expect(auth).toContain('const SUPERVISOR_MANAGERS: AdminRole[] = [AdminRole.CHIEF_ADMIN, AdminRole.OWNER]');
    expect(auth).toContain('canManageSupervisors(caller.role)');
  });

  it('and the same rule hides the account from everyone else', () => {
    // Hiding a role from a dropdown is presentation, not a permission — the
    // rule that gates creation gates the list too, so a banquet ADMIN sharing a
    // restaurant with a supervisor does not see an account they cannot act on.
    const at = auth.indexOf('async listUsersForRestaurant(');
    expect(at).toBeGreaterThan(-1);
    expect(auth.slice(at, at + 600)).toContain('canManageSupervisors(callerRole)');
  });

  it('a supervisor without a restaurant is refused rather than created', () => {
    // Every page would fail on `requireRestaurant`; better to refuse than to
    // mint an account that cannot do anything.
    expect(auth).toContain('AdminRole.SUPERVISOR && !payload.restaurantId');
  });
});
