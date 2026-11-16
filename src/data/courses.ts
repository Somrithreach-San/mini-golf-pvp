export interface BumperObstacle {
  x: number;
  z: number;
  radius: number;
}

export interface MovingBlockObstacle {
  x: number;
  z: number;
  width: number;
  depth: number;
  axis: 'x' | 'z';
  range: number;
  speed: number;
  phase?: number;
}

export interface SandStrip {
  x: number;
  z: number;
  width: number;
  depth: number;
  frictionMultiplier?: number; // e.g. 0.96 for slow sand or 1.03 for speed ramp
}

export interface WallSegment {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  nx: number;
  nz: number;
}

export interface HoleCourse {
  holeNumber: number; // 1..30
  worldIndex: number; // 0..4
  name: string;
  par: number;
  theme?: 'chinese-garden';
  // Each cell [col, row] represents a 2x2 unit block in world space (centered at col*2, row*2)
  // Inside each 2x2 cell, we render a 2x2 sub-grid of 1x1 alternating light/dark green checkerboard tiles
  cells: [number, number][];
  start: [number, number]; // world [x, z]
  hole: [number, number];  // world [x, z]
  bumpers?: BumperObstacle[];
  sandStrips?: SandStrip[];
  movingBlocks?: MovingBlockObstacle[];
  internalWalls?: WallSegment[];
  // Default camera orientation angle in radians so Hole 1 looks horizontal like Screenshot 2
  defaultCameraAngle?: number;
}

export interface GolfWorld {
  index: number;
  name: string;
  subtitle: string;
  islandColor: string;
  wallTopColor: string;
}

export const GOLF_WORLDS: GolfWorld[] = [
  {
    index: 0,
    name: 'Sunny Meadow',
    subtitle: 'Gentle green fairways',
    islandColor: '#78eb46',
    wallTopColor: '#f08b62',
  },
  {
    index: 1,
    name: 'Pine Valley',
    subtitle: 'Bank shots and bumper pins',
    islandColor: '#6ce03b',
    wallTopColor: '#f08b62',
  },
  {
    index: 2,
    name: 'Golden Dunes',
    subtitle: 'Sand strips and doglegs',
    islandColor: '#74e642',
    wallTopColor: '#eb7f54',
  },
  {
    index: 3,
    name: 'Emerald Ridge',
    subtitle: 'Moving gates and tight corners',
    islandColor: '#64d836',
    wallTopColor: '#e8784e',
  },
  {
    index: 4,
    name: 'Starlight Champions',
    subtitle: 'Master championship courses',
    islandColor: '#78eb46',
    wallTopColor: '#f08b62',
  },
];

export const CELL_SIZE = 2.0; // Base logical cell step (2.0 world units)
export const FAIRWAY_PAD = 0.70; // Outward corridor expansion on all outer boundaries (+70% wider fairways = 3.40 units wide for 2-player space)

// Helper to generate rectangular ranges of [col, row] cells without duplicates
function rectCells(c1: number, r1: number, c2: number, r2: number): [number, number][] {
  const list: [number, number][] = [];
  const minC = Math.min(c1, c2);
  const maxC = Math.max(c1, c2);
  const minR = Math.min(r1, r2);
  const maxR = Math.max(r1, r2);
  for (let c = minC; c <= maxC; c++) {
    for (let r = minR; r <= maxR; r++) {
      list.push([c, r]);
    }
  }
  return list;
}

function mergeCells(...groups: [number, number][][]): [number, number][] {
  const map = new Map<string, [number, number]>();
  for (const g of groups) {
    for (const [c, r] of g) {
      map.set(`${c},${r}`, [c, r]);
    }
  }
  return Array.from(map.values());
}

export const ALL_HOLES: HoleCourse[] = [
  // ==========================================
  // WORLD 1: SUNNY MEADOW (Holes 1 - 6)
  // ==========================================
  {
    holeNumber: 1,
    worldIndex: 0,
    name: 'Straight Shot',
    par: 2,
    // 5 cells along Z (row -2..2), viewed from the right (+X looking toward -X)
    cells: rectCells(0, -2, 0, 2),
    start: [0, 3.2],
    hole: [0, -3.2],
    defaultCameraAngle: 0,
  },
  {
    holeNumber: 2,
    worldIndex: 0,
    name: 'Single Pin',
    par: 2,
    cells: rectCells(0, -2, 0, 2),
    start: [0, 3.2],
    hole: [0, -3.2],
    bumpers: [{ x: 0, z: -0.6, radius: 0.34 }],
    defaultCameraAngle: 0,
  },
  {
    holeNumber: 3,
    worldIndex: 0,
    name: 'Sunny Corner',
    par: 3,
    // L-shape: vertical stem on left (col -1, row -2..2) + top horizontal arm to right (col 0..2, row -2)
    cells: mergeCells(rectCells(-1, -2, -1, 2), rectCells(-1, -2, 2, -2)),
    start: [-2, 3.0],
    hole: [3.6, -4.0],
    sandStrips: [{ x: 1.0, z: -4.0, width: 1.0, depth: 3.40, frictionMultiplier: 0.96 }],
    defaultCameraAngle: 0,
  },
  {
    holeNumber: 4,
    worldIndex: 0,
    name: 'Left Bend',
    par: 2,
    // Inverted L-shape to left: vertical stem on right (col 1, row -2..2) + top arm to left (col -2..1, row -2)
    cells: mergeCells(rectCells(1, -2, 1, 2), rectCells(-2, -2, 1, -2)),
    start: [2, 3.0],
    hole: [-3.4, -4.0],
    defaultCameraAngle: 0,
  },
  {
    holeNumber: 5,
    worldIndex: 0,
    name: 'Corner Guard',
    par: 2,
    cells: mergeCells(rectCells(-1, -2, -1, 2), rectCells(-1, -2, 2, -2)),
    start: [-2, 3.0],
    hole: [3.6, -4.0],
    bumpers: [{ x: 0.6, z: -4.0, radius: 0.34 }],
    defaultCameraAngle: 0,
  },
  {
    holeNumber: 6,
    worldIndex: 0,
    name: 'Horseshoe Bend',
    par: 2,
    // U-shape: left leg (col -1, row -2..2), top bridge (col 0, row -2), right leg (col 1, row -2..1)
    cells: mergeCells(
      rectCells(-1, -2, -1, 2),
      rectCells(-1, -2, 1, -2),
      rectCells(1, -2, 1, 1)
    ),
    start: [-2, 3.0],
    hole: [2, 1.8],
    sandStrips: [{ x: 0, z: -4.0, width: 1.0, depth: 3.40, frictionMultiplier: 0.96 }],
    defaultCameraAngle: 0,
  },

  // ==========================================
  // WORLD 2: PINE VALLEY (Holes 7 - 12)
  // Includes Hole 9 matching Screenshot 1's main menu island!
  // ==========================================
  {
    holeNumber: 7,
    worldIndex: 1,
    name: 'Twin Bumpers',
    par: 2,
    cells: rectCells(0, -2, 0, 2),
    start: [0, 3.2],
    hole: [0, -3.4],
    bumpers: [
      { x: -0.64, z: -0.5, radius: 0.27 },
      { x: 0.64, z: -0.5, radius: 0.27 },
    ],
    defaultCameraAngle: 0,
  },
  {
    holeNumber: 8,
    worldIndex: 1,
    name: 'Zig-Zag Alley',
    par: 3,
    cells: mergeCells(
      rectCells(-1, 0, -1, 2),
      rectCells(-1, 0, 1, 0),
      rectCells(1, -2, 1, 0)
    ),
    start: [-2, 3.4],
    hole: [2, -3.4],
    bumpers: [{ x: 0, z: 0, radius: 0.34 }],
    defaultCameraAngle: 0,
  },
  {
    holeNumber: 9,
    worldIndex: 1,
    name: 'Meadow Dogleg',
    par: 3,
    // Matches Screenshot 1 Main Menu preview island: L-shape with tee at top-right leg, sand strip in bottom leg, hole at bottom-left!
    cells: mergeCells(
      rectCells(1, -2, 1, 1),
      rectCells(-2, 1, 1, 1)
    ),
    start: [2.0, -3.2],
    hole: [-3.4, 2.0],
    sandStrips: [{ x: -0.6, z: 2.0, width: 1.0, depth: 3.40, frictionMultiplier: 0.96 }],
    defaultCameraAngle: 0,
  },
  {
    holeNumber: 10,
    worldIndex: 1,
    name: 'Pinball Lane',
    par: 3,
    cells: rectCells(-1, -2, 0, 2),
    start: [-1, 3.2],
    hole: [-1, -3.2],
    bumpers: [
      { x: -1.0, z: 0.8, radius: 0.35 },
      { x: -1.8, z: -0.6, radius: 0.35 },
      { x: -0.2, z: -0.6, radius: 0.35 },
    ],
    defaultCameraAngle: 0,
  },
  {
    holeNumber: 11,
    worldIndex: 1,
    name: 'Double Corner',
    par: 3,
    cells: mergeCells(
      rectCells(-2, 0, -2, 2),
      rectCells(-2, 0, 0, 0),
      rectCells(0, -2, 0, 0),
      rectCells(0, -2, 2, -2)
    ),
    start: [-4, 3.4],
    hole: [3.4, -4.0],
    sandStrips: [{ x: -2.0, z: 0.0, width: 1.0, depth: 3.40, frictionMultiplier: 0.96 }],
    defaultCameraAngle: 0,
  },
  {
    holeNumber: 12,
    worldIndex: 1,
    name: 'Valley Loop',
    par: 3,
    cells: mergeCells(
      rectCells(-1, -2, 1, -2),
      rectCells(-1, 2, 1, 2),
      rectCells(-1, -2, -1, 2),
      rectCells(1, -2, 1, 2)
    ),
    start: [0, 4.0],
    hole: [0, -4.0],
    bumpers: [
      { x: -2.0, z: 0, radius: 0.34 },
      { x: 2.0, z: 0, radius: 0.34 },
    ],
    defaultCameraAngle: 0,
  },

  // ==========================================
  // WORLD 3: BREEZY DUNES (Holes 13 - 18)
  // ==========================================
  {
    holeNumber: 13,
    worldIndex: 2,
    name: 'Sandy Straight',
    par: 2,
    cells: rectCells(0, -3, 0, 2),
    start: [0, 3.4],
    hole: [0, -5.2],
    sandStrips: [
      { x: 0, z: 0.5, width: 3.40, depth: 1.1, frictionMultiplier: 0.94 },
      { x: 0, z: -2.5, width: 3.40, depth: 1.1, frictionMultiplier: 0.94 },
    ],
    defaultCameraAngle: 0,
  },
  {
    holeNumber: 14,
    worldIndex: 2,
    name: 'Dune Bank',
    par: 3,
    cells: mergeCells(rectCells(-1, -2, -1, 2), rectCells(-1, -2, 2, -2)),
    start: [-2, 3.2],
    hole: [3.4, -4.0],
    bumpers: [
      { x: -2.0, z: -1.0, radius: 0.32 },
      { x: 1.2, z: -4.0, radius: 0.32 },
    ],
    sandStrips: [{ x: 1.0, z: -4.0, width: 1.0, depth: 3.40, frictionMultiplier: 0.95 }],
    defaultCameraAngle: 0,
  },
  {
    holeNumber: 15,
    worldIndex: 2,
    name: 'Oasis S-Bend',
    par: 3,
    cells: mergeCells(
      rectCells(-2, -2, 0, -2),
      rectCells(0, -2, 0, 2),
      rectCells(0, 2, 2, 2)
    ),
    start: [3.4, 4.0],
    hole: [-3.4, -4.0],
    bumpers: [{ x: 0, z: 0, radius: 0.36 }],
    defaultCameraAngle: 0,
  },
  {
    holeNumber: 16,
    worldIndex: 2,
    name: 'Mirage Hook',
    par: 3,
    cells: mergeCells(
      rectCells(1, -2, 1, 2),
      rectCells(-1, -2, 1, -2),
      rectCells(-1, -2, -1, 1)
    ),
    start: [2.0, 3.4],
    hole: [-2.0, 1.4],
    sandStrips: [{ x: 1.0, z: -4.0, width: 1.0, depth: 3.40, frictionMultiplier: 0.95 }],
    bumpers: [{ x: -2.0, z: -1.5, radius: 0.32 }],
    defaultCameraAngle: 0,
  },
  {
    holeNumber: 17,
    worldIndex: 2,
    name: 'Pyramid Ricochet',
    par: 3,
    cells: mergeCells(rectCells(-1, -1, 1, 1), rectCells(0, 2, 0, 2), rectCells(0, -2, 0, -2)),
    start: [0, 3.5],
    hole: [0, -3.5],
    bumpers: [
      { x: 0, z: 1.2, radius: 0.34 },
      { x: -1.2, z: 0, radius: 0.34 },
      { x: 1.2, z: 0, radius: 0.34 },
      { x: 0, z: -1.2, radius: 0.34 },
    ],
    defaultCameraAngle: 0,
  },
  {
    holeNumber: 18,
    worldIndex: 2,
    name: 'Canyon U-Turn',
    par: 4,
    cells: mergeCells(
      rectCells(-2, -2, -2, 2),
      rectCells(-2, -2, 2, -2),
      rectCells(2, -2, 2, 2)
    ),
    start: [-4.0, 3.4],
    hole: [4.0, 3.4],
    sandStrips: [
      { x: -1.0, z: -4.0, width: 1.0, depth: 3.40, frictionMultiplier: 0.95 },
      { x: 1.0, z: -4.0, width: 1.0, depth: 3.40, frictionMultiplier: 0.95 },
    ],
    bumpers: [{ x: 0, z: -4.0, radius: 0.34 }],
    defaultCameraAngle: 0,
  },

  // ==========================================
  // WORLD 4: EMERALD RIDGE (Holes 19 - 24)
  // Introduces moving blocks + bumpers
  // ==========================================
  {
    holeNumber: 19,
    worldIndex: 3,
    name: 'Sweeper Gate',
    par: 2,
    cells: rectCells(0, -3, 0, 2),
    start: [0, 3.4],
    hole: [0, -5.2],
    movingBlocks: [
      { x: 0, z: -1.0, width: 0.7, depth: 0.35, axis: 'x', range: 0.55, speed: 2.2 },
    ],
    defaultCameraAngle: 0,
  },
  {
    holeNumber: 20,
    worldIndex: 3,
    name: 'Ridge Turn',
    par: 3,
    cells: mergeCells(rectCells(-1, -2, -1, 2), rectCells(-1, -2, 2, -2)),
    start: [-2.0, 3.2],
    hole: [3.4, -4.0],
    movingBlocks: [
      { x: 1.0, z: -4.0, width: 0.35, depth: 0.7, axis: 'z', range: 0.55, speed: 2.4 },
    ],
    defaultCameraAngle: 0,
  },
  {
    holeNumber: 21,
    worldIndex: 3,
    name: 'Twin Pistons',
    par: 3,
    cells: rectCells(0, -3, 0, 3),
    start: [0, 5.2],
    hole: [0, -5.2],
    movingBlocks: [
      { x: 0, z: 1.5, width: 0.75, depth: 0.35, axis: 'x', range: 0.52, speed: 2.0, phase: 0 },
      { x: 0, z: -1.5, width: 0.75, depth: 0.35, axis: 'x', range: 0.52, speed: 2.0, phase: Math.PI },
    ],
    defaultCameraAngle: 0,
  },
  {
    holeNumber: 22,
    worldIndex: 3,
    name: 'Emerald Bend',
    par: 3,
    cells: mergeCells(
      rectCells(1, -1, 1, 2),
      rectCells(-2, -1, 1, -1),
      rectCells(-2, -3, -2, -1)
    ),
    start: [2.0, 3.4],
    hole: [-4.0, -5.2],
    bumpers: [{ x: -0.5, z: -2.0, radius: 0.35 }],
    movingBlocks: [
      { x: -4.0, z: -3.5, width: 0.7, depth: 0.35, axis: 'x', range: 0.5, speed: 2.5 },
    ],
    defaultCameraAngle: 0,
  },
  {
    holeNumber: 23,
    worldIndex: 3,
    name: 'Emerald Diamond',
    par: 3,
    cells: mergeCells(
      rectCells(0, 1, 0, 3),
      rectCells(-1, -1, 1, 1),
      rectCells(0, -3, 0, -1)
    ),
    start: [0, 5.2],
    hole: [0, -5.2],
    bumpers: [
      { x: 0, z: 0, radius: 0.42 },
      { x: -1.3, z: 0, radius: 0.32 },
      { x: 1.3, z: 0, radius: 0.32 },
    ],
    sandStrips: [{ x: 0, z: -3.2, width: 3.40, depth: 1.0, frictionMultiplier: 0.95 }],
    defaultCameraAngle: 0,
  },
  {
    holeNumber: 24,
    worldIndex: 3,
    name: 'Spiral Fortress',
    par: 4,
    cells: mergeCells(
      rectCells(-2, -2, -2, 2),
      rectCells(-2, -2, 2, -2),
      rectCells(2, -2, 2, 1),
      rectCells(0, 1, 2, 1)
    ),
    start: [-4.0, 3.4],
    hole: [0.4, 2.0],
    bumpers: [{ x: 0, z: -4.0, radius: 0.35 }],
    movingBlocks: [
      { x: 4.0, z: -1.0, width: 0.7, depth: 0.35, axis: 'x', range: 0.65, speed: 2.3 },
    ],
    defaultCameraAngle: 0,
  },

  // ==========================================
  // WORLD 5: STARLIGHT CHAMPIONS (Holes 25 - 30)
  // ==========================================
  {
    holeNumber: 25,
    worldIndex: 4,
    name: 'Gauntlet Run',
    par: 3,
    cells: rectCells(0, -3, 0, 3),
    start: [0, 5.4],
    hole: [0, -5.4],
    bumpers: [
      { x: -0.64, z: 2.0, radius: 0.27 },
      { x: 0.64, z: 2.0, radius: 0.27 },
      { x: 0, z: -2.0, radius: 0.34 },
    ],
    movingBlocks: [
      { x: 0, z: 0, width: 0.75, depth: 0.35, axis: 'x', range: 0.65, speed: 2.6 },
    ],
    defaultCameraAngle: 0,
  },
  {
    holeNumber: 26,
    worldIndex: 4,
    name: 'Starlight Z',
    par: 3,
    cells: mergeCells(
      rectCells(-2, 1, 0, 1),
      rectCells(0, -1, 0, 1),
      rectCells(0, -1, 2, -1)
    ),
    start: [-3.4, 2.0],
    hole: [3.4, -2.0],
    sandStrips: [{ x: 0, z: 0, width: 3.40, depth: 1.0, frictionMultiplier: 0.95 }],
    bumpers: [
      { x: 0, z: 2.0, radius: 0.32 },
      { x: 0, z: -2.0, radius: 0.32 },
    ],
    defaultCameraAngle: 0,
  },
  {
    holeNumber: 27,
    worldIndex: 4,
    name: 'Triple Crown',
    par: 4,
    cells: mergeCells(
      rectCells(-2, -2, -2, 2),
      rectCells(-2, -2, 2, -2),
      rectCells(2, -2, 2, 2)
    ),
    start: [4.0, 3.4],
    hole: [-4.0, 3.4],
    movingBlocks: [
      { x: 0, z: -4.0, width: 0.35, depth: 0.75, axis: 'z', range: 0.52, speed: 2.5 },
    ],
    bumpers: [
      { x: 4.0, z: 0, radius: 0.34 },
      { x: -4.0, z: 0, radius: 0.34 },
    ],
    defaultCameraAngle: 0,
  },
  {
    holeNumber: 28,
    worldIndex: 4,
    name: 'Ricochet Chamber',
    par: 3,
    cells: mergeCells(
      rectCells(-1, 1, -1, 3),
      rectCells(-1, -1, 1, 1),
      rectCells(1, -3, 1, -1)
    ),
    start: [-2.0, 5.2],
    hole: [2.0, -5.2],
    bumpers: [
      { x: -1.5, z: 0, radius: 0.35 },
      { x: 0, z: 0, radius: 0.38 },
      { x: 1.5, z: 0, radius: 0.35 },
    ],
    sandStrips: [{ x: 2.0, z: -3.0, width: 3.40, depth: 1.0, frictionMultiplier: 0.95 }],
    defaultCameraAngle: 0,
  },
  {
    holeNumber: 29,
    worldIndex: 4,
    name: 'Pendulum Bridge',
    par: 4,
    cells: mergeCells(
      rectCells(-2, 0, -2, 2),
      rectCells(-2, 0, 2, 0),
      rectCells(2, -2, 2, 0)
    ),
    start: [-4.0, 3.4],
    hole: [4.0, -3.4],
    movingBlocks: [
      { x: -1.0, z: 0, width: 0.35, depth: 0.75, axis: 'z', range: 0.65, speed: 2.5, phase: 0 },
      { x: 1.0, z: 0, width: 0.35, depth: 0.75, axis: 'z', range: 0.65, speed: 2.5, phase: Math.PI },
    ],
    defaultCameraAngle: 0,
  },
  {
    holeNumber: 30,
    worldIndex: 4,
    name: 'Grand Finale',
    par: 4,
    cells: mergeCells(
      rectCells(0, 1, 0, 3),
      rectCells(-2, 1, 0, 1),
      rectCells(-2, -2, -2, 1),
      rectCells(-2, -2, 2, -2),
      rectCells(2, -2, 2, 0)
    ),
    start: [0, 5.4],
    hole: [4.0, -0.4],
    sandStrips: [
      { x: -2.0, z: 2.0, width: 1.0, depth: 3.40, frictionMultiplier: 0.95 },
      { x: 0, z: -4.0, width: 1.0, depth: 3.40, frictionMultiplier: 0.95 },
    ],
    bumpers: [
      { x: -4.0, z: -1.0, radius: 0.34 },
      { x: 2.0, z: -4.0, radius: 0.34 },
    ],
    movingBlocks: [
      { x: 4.0, z: -2.0, width: 0.72, depth: 0.35, axis: 'x', range: 0.65, speed: 2.4 },
    ],
    defaultCameraAngle: 0,
  },
];

/**
 * Automatically extracts clean, merged perimeter wall segments from a course's cell list.
 * Each cell [col, row] occupies:
 *   x in [col * 2 - 1, col * 2 + 1]
 *   z in [row * 2 - 1, row * 2 + 1]
 */
export function computeCourseWalls(course: HoleCourse): WallSegment[] {
  const cellSet = new Set<string>();
  for (const [c, r] of course.cells) {
    cellSet.add(`${c},${r}`);
  }

  const rawEdges: WallSegment[] = [];

  for (const [c, r] of course.cells) {
    const xMin = c * CELL_SIZE - CELL_SIZE / 2;
    const xMax = c * CELL_SIZE + CELL_SIZE / 2;
    const zMin = r * CELL_SIZE - CELL_SIZE / 2;
    const zMax = r * CELL_SIZE + CELL_SIZE / 2;

    // North edge (z = zMin), normal points +Z (inward)
    if (!cellSet.has(`${c},${r - 1}`)) {
      rawEdges.push({ x1: xMin, z1: zMin, x2: xMax, z2: zMin, nx: 0, nz: 1 });
    }
    // South edge (z = zMax), normal points -Z (inward)
    if (!cellSet.has(`${c},${r + 1}`)) {
      rawEdges.push({ x1: xMin, z1: zMax, x2: xMax, z2: zMax, nx: 0, nz: -1 });
    }
    // West edge (x = xMin), normal points +X (inward)
    if (!cellSet.has(`${c - 1},${r}`)) {
      rawEdges.push({ x1: xMin, z1: zMin, x2: xMin, z2: zMax, nx: 1, nz: 0 });
    }
    // East edge (x = xMax), normal points -X (inward)
    if (!cellSet.has(`${c + 1},${r}`)) {
      rawEdges.push({ x1: xMax, z1: zMin, x2: xMax, z2: zMax, nx: -1, nz: 0 });
    }
  }

  // Merge collinear contiguous horizontal edges
  const horiz = rawEdges.filter((e) => e.z1 === e.z2);
  const vert = rawEdges.filter((e) => e.x1 === e.x2);

  horiz.sort((a, b) => (a.z1 !== b.z1 ? a.z1 - b.z1 : a.nz !== b.nz ? a.nz - b.nz : a.x1 - b.x1));
  const mergedHoriz: WallSegment[] = [];
  for (const e of horiz) {
    const last = mergedHoriz[mergedHoriz.length - 1];
    if (
      last &&
      Math.abs(last.z1 - e.z1) < 0.001 &&
      last.nz === e.nz &&
      Math.abs(last.x2 - e.x1) < 0.001
    ) {
      last.x2 = e.x2;
    } else {
      mergedHoriz.push({ ...e });
    }
  }

  vert.sort((a, b) => (a.x1 !== b.x1 ? a.x1 - b.x1 : a.nx !== b.nx ? a.nx - b.nx : a.z1 - b.z1));
  const mergedVert: WallSegment[] = [];
  for (const e of vert) {
    const last = mergedVert[mergedVert.length - 1];
    if (
      last &&
      Math.abs(last.x1 - e.x1) < 0.001 &&
      last.nx === e.nx &&
      Math.abs(last.z2 - e.z1) < 0.001
    ) {
      last.z2 = e.z2;
    } else {
      mergedVert.push({ ...e });
    }
  }

  // Offset every merged orthogonal wall outward by FAIRWAY_PAD so all corridors are +2*FAIRWAY_PAD wider!
  // Each corner vertex (x, z) is shared by one horizontal wall (with normal nz) and one vertical wall (with normal nx).
  const vertNxAtCorner = new Map<string, number>();
  const horizNzAtCorner = new Map<string, number>();
  const vKey = (x: number, z: number) => `${x.toFixed(2)},${z.toFixed(2)}`;

  for (const h of mergedHoriz) {
    horizNzAtCorner.set(vKey(h.x1, h.z1), h.nz);
    horizNzAtCorner.set(vKey(h.x2, h.z2), h.nz);
  }
  for (const v of mergedVert) {
    vertNxAtCorner.set(vKey(v.x1, v.z1), v.nx);
    vertNxAtCorner.set(vKey(v.x2, v.z2), v.nx);
  }

  for (const h of mergedHoriz) {
    const nx1 = vertNxAtCorner.get(vKey(h.x1, h.z1)) ?? 0;
    const nx2 = vertNxAtCorner.get(vKey(h.x2, h.z2)) ?? 0;
    const newZ = h.z1 - h.nz * FAIRWAY_PAD;
    h.x1 = h.x1 - nx1 * FAIRWAY_PAD;
    h.x2 = h.x2 - nx2 * FAIRWAY_PAD;
    h.z1 = newZ;
    h.z2 = newZ;
  }

  for (const v of mergedVert) {
    const nz1 = horizNzAtCorner.get(vKey(v.x1, v.z1)) ?? 0;
    const nz2 = horizNzAtCorner.get(vKey(v.x2, v.z2)) ?? 0;
    const newX = v.x1 - v.nx * FAIRWAY_PAD;
    v.z1 = v.z1 - nz1 * FAIRWAY_PAD;
    v.z2 = v.z2 - nz2 * FAIRWAY_PAD;
    v.x1 = newX;
    v.x2 = newX;
  }

  const allWalls = [...mergedHoriz, ...mergedVert];
  if (course.internalWalls) {
    allWalls.push(...course.internalWalls);
  }
  return allWalls;
}

export function isPointInsideCourse(course: HoleCourse, x: number, z: number, margin = 0.05): boolean {
  const half = CELL_SIZE / 2 + FAIRWAY_PAD + margin;
  for (const [c, r] of course.cells) {
    const cx = c * CELL_SIZE;
    const cz = r * CELL_SIZE;
    if (Math.abs(x - cx) <= half && Math.abs(z - cz) <= half) {
      return true;
    }
  }
  return false;
}

export function getCourseBounds(course: HoleCourse) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const [c, r] of course.cells) {
    minX = Math.min(minX, c * CELL_SIZE - CELL_SIZE / 2 - FAIRWAY_PAD);
    maxX = Math.max(maxX, c * CELL_SIZE + CELL_SIZE / 2 + FAIRWAY_PAD);
    minZ = Math.min(minZ, r * CELL_SIZE - CELL_SIZE / 2 - FAIRWAY_PAD);
    maxZ = Math.max(maxZ, r * CELL_SIZE + CELL_SIZE / 2 + FAIRWAY_PAD);
  }
  return {
    minX,
    maxX,
    minZ,
    maxZ,
    centerX: (minX + maxX) / 2,
    centerZ: (minZ + maxZ) / 2,
    width: maxX - minX,
    depth: maxZ - minZ,
  };
}

/**
 * Checks whether a chapter/world is unlocked.
 * World 0 (Sunny Meadow) is unlocked by default.
 * For any subsequent world W, all preceding worlds must have EVERY hole maxed out with 3 stars!
 */
export function isWorldUnlocked(worldIndex: number, holeStars: Record<number, number>): boolean {
  if (worldIndex <= 0) return true;
  for (let w = 0; w < worldIndex; w++) {
    const holesInWorld = ALL_HOLES.filter((h) => h.worldIndex === w);
    const isWorldMaxed =
      holesInWorld.length > 0 &&
      holesInWorld.every((h) => (holeStars[h.holeNumber] || 0) === 3);
    if (!isWorldMaxed) return false;
  }
  return true;
}

/**
 * Checks whether a specific hole level is unlocked.
 * - Hole 1 is always unlocked.
 * - For any subsequent hole N:
 *   - Its world must be unlocked.
 *   - If it's the first hole of that world, it's unlocked once the world is unlocked.
 *   - Otherwise, the player must have earned at least 2 stars on hole N - 1.
 */
export function isHoleUnlocked(holeNumber: number, holeStars: Record<number, number>): boolean {
  if (holeNumber <= 1) return true;
  const course = ALL_HOLES.find((h) => h.holeNumber === holeNumber);
  if (!course) return false;

  // World must be unlocked
  if (!isWorldUnlocked(course.worldIndex, holeStars)) {
    return false;
  }

  // If it's the first hole of its world (1, 7, 13, 19, 25), world unlock unlocks it
  const worldHoles = ALL_HOLES.filter((h) => h.worldIndex === course.worldIndex);
  if (worldHoles.length > 0 && worldHoles[0].holeNumber === holeNumber) {
    return true;
  }

  // Otherwise, must have earned at least 2 stars on the preceding hole
  return (holeStars[holeNumber - 1] || 0) >= 2;
}

/**
 * Returns a human-friendly lock reason string if a hole is locked, or null if unlocked.
 */
export function getHoleLockReason(
  holeNumber: number,
  holeStars: Record<number, number>
): string | null {
  if (isHoleUnlocked(holeNumber, holeStars)) return null;

  const course = ALL_HOLES.find((h) => h.holeNumber === holeNumber);
  if (!course) return 'Locked';

  if (!isWorldUnlocked(course.worldIndex, holeStars)) {
    const prevWorld = GOLF_WORLDS[course.worldIndex - 1];
    return `Max out 3★ on all holes in ${prevWorld ? prevWorld.name : 'previous chapter'}`;
  }

  const prevHoleStars = holeStars[holeNumber - 1] || 0;
  return `Earn at least 2★ on Hole ${holeNumber - 1} (Current: ${prevHoleStars}★)`;
}

/**
 * Returns the highest unlocked hole number.
 */
export function getHighestUnlockedHole(holeStars: Record<number, number>): number {
  let highest = 1;
  for (const hole of ALL_HOLES) {
    if (isHoleUnlocked(hole.holeNumber, holeStars)) {
      if (hole.holeNumber > highest) {
        highest = hole.holeNumber;
      }
    }
  }
  return highest;
}

/**
 * Calculates dual multiplayer tee-off positions that are GUARANTEED to be
 * on the exact same starting line (side-by-side perpendicular to the fairway direction),
 * regardless of whether the fairway runs along Z, along X, or diagonally.
 */
export function getMultiplayerTeePositions(course: HoleCourse): {
  p1: [number, number];
  p2: [number, number];
} {
  const sx = course.start[0];
  const sz = course.start[1];
  const hx = course.hole[0];
  const hz = course.hole[1];

  // 4 cardinal directions down the fairway
  const candidates: [number, number][] = [
    [0, -1],
    [0, 1],
    [1, 0],
    [-1, 0],
  ];

  let bestDir: [number, number] = [0, -1];
  let bestScore = Infinity;

  for (const [dx, dz] of candidates) {
    const px = sx + dx * 1.5;
    const pz = sz + dz * 1.5;
    if (isPointInsideCourse(course, px, pz, 0.15)) {
      const dist = (px - hx) ** 2 + (pz - hz) ** 2;
      if (dist < bestScore) {
        bestScore = dist;
        bestDir = [dx, dz];
      }
    }
  }

  if (bestScore === Infinity) {
    const dx = hx - sx;
    const dz = hz - sz;
    const len = Math.hypot(dx, dz) || 1;
    bestDir = [dx / len, dz / len];
  }

  // Perpendicular lateral vector across fairway: (-dirZ, dirX)
  const perpX = -bestDir[1];
  const perpZ = bestDir[0];
  const offset = 0.45;

  return {
    p1: [sx - perpX * offset, sz - perpZ * offset],
    p2: [sx + perpX * offset, sz + perpZ * offset],
  };
}
