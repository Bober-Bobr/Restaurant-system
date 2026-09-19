import type { MapFeature } from '../floorMap.features.js';
import type { FloorPlan, PlanTable } from './types.js';

/**
 * Sangizar — "Street", the restaurant's outdoor event venue.
 *
 * Redrawn from the paper plan the staff work from (a printed sheet on a
 * clipboard, photographed turned 90°; drawn here the right way up, with the
 * zone names reading normally).
 *
 * What was kept: the zones and their names, the pool, the stage, the walkways,
 * and the tables with their arrangement — the rows, the diagonal along the
 * Bungalow, the arc round the pool.
 *
 * What was left out, deliberately: everything written on the sheet by hand —
 * guests' names, phone numbers, head counts ("4ч", "2х+"), arrows and the
 * evening's totals. Those were one night's bookings, not the venue.
 *
 * Positions are a REDRAW, not a survey. The sheet's squares touch one another,
 * which on paper is fine and on this map would put chairs through their
 * neighbours, so rows keep their order and shape but are spaced to seat
 * people (≥ 120 units centre to centre). Table numbers are ours — the sheet
 * has none — running zone by zone. Everything is editable on the map.
 *
 * Coordinates are map units; the sheet's landscape is 2620 × 1780.
 */

const WIDTH = 2620;
const HEIGHT = 1780;

// The sheet's own colours, as printed.
const OLIVE = '#9c9a4f';
const PEACH = '#e0906f';
const WATER = '#3b8fc4';
const STAGE = '#4f8fd6';
const SWEET = '#7cc47f';
const HALL_GREEN = '#7f9a7a';
const WALKWAY = '#8fd0e8';

const features: MapFeature[] = [
  // Walkways first, so the zones and tables draw over them.
  { kind: 'path', shape: 'polygon', color: WALKWAY, points: [[301, 955], [582, 1483], [547, 1501], [266, 973]] },
  { kind: 'path', shape: 'polygon', color: WALKWAY, points: [[576, 792], [924, 792], [924, 1416]] },
  { kind: 'path', shape: 'rect', color: WALKWAY, x: 1250, y: 1092, width: 450, height: 32 },

  { kind: 'zone', shape: 'rect', color: OLIVE, label: 'Терраса', x: 40, y: 0, width: 700, height: 540, labelAt: [390, 300] },
  {
    kind: 'zone', shape: 'polygon', color: PEACH, label: 'Бунгал', labelAt: [340, 1470],
    points: [[0, 1092], [312, 1092], [648, 1344], [648, 1780], [0, 1780]],
  },
  { kind: 'zone', shape: 'rect', color: SWEET, label: 'Слад. бар', x: 1920, y: 324, width: 680, height: 732, labelAt: [2430, 450] },
  {
    kind: 'zone', shape: 'polygon', color: HALL_GREEN, label: 'New zal', labelAt: [2400, 1460],
    // Starts below the dessert bar, keeping the sheet's slanted edge.
    points: [[1990, 1780], [2620, 1780], [2620, 1100], [2290, 1100]],
  },

  // Half of the stage runs off the top of the sheet, as it does on paper.
  { kind: 'stage', shape: 'ellipse', color: STAGE, label: 'Сцена', x: 984, y: -180, width: 864, height: 360, labelAt: [1416, 90] },
  { kind: 'water', shape: 'ellipse', color: WATER, label: 'Ц. бассейн', x: 1205, y: 1387, width: 480, height: 480, labelAt: [1445, 1600] },

  { kind: 'label', shape: 'point', label: 'Ц. стар. бар', x: 655, y: 590 },
  { kind: 'label', shape: 'point', label: 'Центр сцена', x: 1480, y: 640 },
];

/** A square four-top, the sheet's commonest table. */
const SQUARE = { seats: 4, shape: 'RECT' as const, width: 64, height: 64 };

type Spot = Omit<PlanTable, 'label'>;
const at = (x: number, y: number, over: Partial<Spot> = {}): Spot => ({ ...SQUARE, x, y, rotation: 0, ...over });
const row = (y: number, xs: number[], over?: Partial<Spot>) => xs.map((x) => at(x, y, over));
const column = (x: number, ys: number[], over?: Partial<Spot>) => ys.map((y) => at(x, y, over));

const POOL = { x: 1445, y: 1627 };
/** Small two-tops in an arc round the pool, clear of the water. */
const poolside = [190, 215, 240, 265, 290, 315, 340].map((deg) => {
  const rad = (deg * Math.PI) / 180;
  return at(Math.round(POOL.x + 330 * Math.cos(rad)), Math.round(POOL.y + 330 * Math.sin(rad)), { seats: 2, width: 50, height: 50 });
});

/** Along the Bungalow's edge, following the walkway on the diagonal. */
const diagonal = ([[372, 917], [451, 1085], [509, 1195], [588, 1315], [653, 1445]] as const)
  .map(([x, y]) => at(x, y, { rotation: 60 }));

const spots: Spot[] = [
  // Terrace — round three of its sides, and two more just past its edge.
  ...row(70, [130, 250, 370, 490, 640]),
  ...column(130, [190, 310]),
  ...column(640, [190, 310, 430]),
  ...column(810, [80, 200]),
  // The old bar — two short rows and the long table on the walkway.
  ...row(680, [540, 655, 770]),
  ...row(850, [600, 715]),
  at(820, 1020, { seats: 6, width: 150, height: 80 }),
  ...diagonal,
  // Bungalow — along its outer wall and its lower edge.
  ...column(156, [1349, 1481, 1613]),
  ...row(1700, [300, 430, 560]),
  // Centre stage — the block in front of the stage and the two long rows.
  ...[490, 610, 730, 850].flatMap((y) => row(y, [1010, 1130])),
  ...row(940, [1270, 1390, 1510, 1630]),
  ...row(1180, [1030, 1150, 1270, 1390, 1510, 1630]),
  ...poolside,
  // The line of tables between the centre and the dessert bar.
  ...column(1812, [355, 475, 595, 715, 835, 955, 1075]),
  // Dessert bar — the row above it, the block inside and the diagonal.
  ...row(230, [2060, 2190, 2360]),
  ...[440, 560].flatMap((y) => row(y, [2030, 2150])),
  ...([[2060, 920], [2180, 860], [2300, 780], [2420, 700]] as const).map(([x, y]) => at(x, y)),
  // The round table drawn with its chairs, between the pool and the New hall.
  at(1968, 1140, { seats: 8, shape: 'ROUND', width: null, height: null }),
];

const tables: PlanTable[] = spots.map((spot, i) => ({ label: String(i + 1), ...spot }));

export const sangizarStreet: FloorPlan = {
  id: 'sangizar-street',
  name: 'Street',
  kind: 'OUTDOOR',
  mapWidth: WIDTH,
  mapHeight: HEIGHT,
  features,
  tables,
};
