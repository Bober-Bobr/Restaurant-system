import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { FLOOR_PLANS } from '../modules/floorMap/plans/index.js';
import { matchRestaurant, planProblems, planSeats } from '../modules/floorMap/plans/importPlan.js';

// Loads a ready-made floor plan (modules/floorMap/plans) into one restaurant's
// Small Banquets section, as an area of its own with its drawing and tables.
//
//   npm run import:floor-plan -w @banquet/api -- --restaurant "Sangizar" --dry-run
//   npm run import:floor-plan -w @banquet/api -- --restaurant "Sangizar"
//
// Options:
//   --restaurant <id or name>   required; an exact id, an exact name, or a single partial match
//   --plan <id>                 default: sangizar-street
//   --name <area name>          default: the plan's own ("Street")
//   --replace                   the area already exists WITH tables: replace its drawing and tables
//   --dry-run                   say what would happen, write nothing
//
// Safe to run twice: an existing area with no tables is filled in, and one
// that already has tables is left alone unless --replace is given.

const prisma = new PrismaClient();

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

async function main() {
  const query = arg('restaurant');
  const planId = arg('plan') ?? 'sangizar-street';
  const plan = FLOOR_PLANS[planId];
  const dryRun = flag('dry-run');
  const replace = flag('replace');

  if (!query) throw new Error('--restaurant is required (an id or a name).');
  if (!plan) throw new Error(`No plan "${planId}". Plans: ${Object.keys(FLOOR_PLANS).join(', ')}`);
  const problems = planProblems(plan);
  if (problems.length) throw new Error(`The plan is not valid:\n  ${problems.join('\n  ')}`);
  const areaName = (arg('name') ?? plan.name).trim();

  const match = matchRestaurant(await prisma.restaurant.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }), query);
  if (!match.ok) {
    const list = match.candidates.map((r) => `  ${r.id}  ${JSON.stringify(r.name)}`).join('\n');
    throw new Error(match.reason === 'ambiguous'
      ? `"${query}" matches more than one restaurant — pass the id:\n${list}`
      : `No restaurant matches "${query}". Restaurants:\n${list}`);
  }
  const restaurant = match.restaurant;

  const existing = await prisma.hall.findFirst({
    where: { restaurantId: restaurant.id, section: 'SMALL_BANQUET', name: areaName },
    select: { id: true, _count: { select: { floorTables: true } } },
  });
  if (existing && existing._count.floorTables > 0 && !replace) {
    throw new Error(`"${areaName}" in ${restaurant.name} already has ${existing._count.floorTables} tables. `
      + 'Nothing was changed. Pass --replace to replace its drawing and tables.');
  }

  const action = existing
    ? `${existing._count.floorTables ? 'replace' : 'fill in'} the existing area "${areaName}"`
    : `create the area "${areaName}"`;
  console.log(`${dryRun ? '[dry run] Would' : 'Will'} ${action} in ${restaurant.name} (${restaurant.id}), Small Banquets:`);
  console.log(`  ${plan.features.length} drawn features, ${plan.tables.length} tables, ${planSeats(plan)} seats, map ${plan.mapWidth} × ${plan.mapHeight}`);
  if (dryRun) return;

  await prisma.$transaction(async (tx) => {
    const hall = existing
      ? await tx.hall.update({
        where: { id: existing.id },
        data: { kind: plan.kind, mapWidth: plan.mapWidth, mapHeight: plan.mapHeight, mapFeatures: plan.features },
        select: { id: true },
      })
      : await tx.hall.create({
        data: {
          restaurantId: restaurant.id,
          section: 'SMALL_BANQUET',
          name: areaName,
          kind: plan.kind,
          capacity: planSeats(plan),
          mapWidth: plan.mapWidth,
          mapHeight: plan.mapHeight,
          mapFeatures: plan.features,
        },
        select: { id: true },
      });
    await tx.floorTable.deleteMany({ where: { hallId: hall.id } });
    await tx.floorTable.createMany({ data: plan.tables.map((t) => ({ ...t, hallId: hall.id })) });
  });
  console.log('Done. Open the supervisor\'s Map to see it.');
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
