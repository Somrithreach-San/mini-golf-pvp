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
  frictionMultiplier?: number;
}

export interface RotatingSweeperObstacle {
  x: number;
  z: number;
  bladeCount: number; // 2, 3, or 4 blades
  bladeLength: number; // length from center pivot
  bladeWidth: number; // blade thickness
  speed: number; // rad/s (positive = CCW, negative = CW)
  phase?: number;
}

export interface TimedDrawbridge {
  x: number;
  z: number;
  width: number;
  depth: number;
  axis: 'x' | 'z';
  cycleDuration: number; // total period in seconds (e.g. 4.0)
  openDuration: number; // time bridge is open/retracted (gap impassable, e.g. 2.0)
  phase?: number;
}

export interface BoostPad {
  x: number;
  z: number;
  width: number;
  depth: number;
  dirX: number; // normalized boost vector X
  dirZ: number; // normalized boost vector Z
  boostSpeed: number; // target speed in m/s (e.g. 14.0 to 16.5)
}

export interface PortalNode {
  x: number;
  z: number;
  radius: number; // trigger radius, e.g. 0.42
  exitDir: [number, number]; // [dirX, dirZ] launch direction upon exiting
}

export interface PortalPair {
  id: string;
  a: PortalNode;
  b: PortalNode;
  color?: string; // hex color for visual rings
}

export interface SpecialSurfaceZone {
  x: number;
  z: number;
  width: number;
  depth: number;
  type: 'sand' | 'ice' | 'slime';
}

export interface GapRegion {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
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
  holeNumber: number; // 1..9
  worldIndex: number; // 0..2
  name: string;
  par: number;
  theme?: 'chinese-garden' | 'shifting-ruins' | 'neon-lab';
  cells: [number, number][];
  start: [number, number]; // world [x, z]
  hole: [number, number];  // world [x, z]
  bumpers?: BumperObstacle[];
  sandStrips?: SandStrip[];
  movingBlocks?: MovingBlockObstacle[];
  internalWalls?: WallSegment[];
  defaultCameraAngle?: number;
  // Creative modular obstacles & surfaces:
  sweepers?: RotatingSweeperObstacle[];
  drawbridges?: TimedDrawbridge[];
  boostPads?: BoostPad[];
  portals?: PortalPair[];
  surfaceZones?: SpecialSurfaceZone[];
  gapBounds?: GapRegion[];
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
    name: 'Island Courtyard',
    subtitle: 'Bank angles, split paths & windmills',
    islandColor: '#78eb46',
    wallTopColor: '#f08b62',
  },
  {
    index: 1,
    name: 'Shifting Ruins',
    subtitle: 'Piston gauntlets, abyss gaps & sand traps',
    islandColor: '#d4a373',
    wallTopColor: '#bc6c25',
  },
  {
    index: 2,
    name: 'Neon Lab',
    subtitle: 'Warp portals, zero-g ice & drawbridges',
    islandColor: '#1d2d44',
    wallTopColor: '#00e5ff',
  },
];

export const CELL_SIZE = 2.0; // Base logical cell step (2.0 world units)
export const FAIRWAY_PAD = 0.70; // Outward corridor expansion (+70% wider fairways for 2-player space)

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
  // =========================================================================
  // WORLD 1: ISLAND COURTYARD (Holes 1 - 3)
  // Theme: Natural lush green island, classical garden architecture, split paths
  // =========================================================================

  // Hole 1: Twin Bridges (Par 2)
  // Safe Route A (Left): Walled curve around water feature (2 putts)
  // Hero Route B (Right): Narrow rail-less bridge over water straight to cup (Hole-in-one potential, out-of-bounds on miss)
  {
    holeNumber: 1,
    worldIndex: 0,
    name: 'Twin Bridges',
    par: 2,
    cells: mergeCells(
      // Starting tee pad
      rectCells(-1, 2, 1, 3),
      // Left Safe Route A (Col -2, rows -2..1 and turn into green)
      rectCells(-2, -1, -2, 1),
      rectCells(-2, -2, 0, -2),
      // Right Hero Route B (Col 1, rows -2..1)
      rectCells(1, -2, 1, 1),
      // Green connecting both
      rectCells(-1, -3, 1, -2)
    ),
    start: [0, 5.0],
    hole: [0, -5.0],
    internalWalls: [
      // Wall separating the twin routes in the middle
      { x1: -0.2, z1: 2.2, x2: -0.2, z2: -2.2, nx: -1, nz: 0 },
      { x1: 0.2, z1: 2.2, x2: 0.2, z2: -2.2, nx: 1, nz: 0 },
    ],
    gapBounds: [
      // Water void gap between the bridges
      { minX: -0.8, maxX: 0.8, minZ: -2.0, maxZ: 2.0 },
    ],
    defaultCameraAngle: 0,
  },

  // Hole 2: The Courtyard Windmill (Par 3)
  // U-shaped green guarded by a 4-blade rotating windmill in center + corner pinball bumpers
  // Route A: Bank along outer curve timing around blades (3 putts)
  // Route B: Thread the shot directly through the moving blade timing window to the flag
  {
    holeNumber: 2,
    worldIndex: 0,
    name: 'The Courtyard Windmill',
    par: 3,
    cells: mergeCells(
      // West stem (Tee)
      rectCells(-2, 0, -1, 3),
      // North cross connector
      rectCells(-2, -2, 2, -1),
      // East stem (Green)
      rectCells(1, 0, 2, 3)
    ),
    start: [-3.0, 5.0],
    hole: [3.0, 5.0],
    sweepers: [
      // 4-blade rotating windmill at center pivot
      {
        x: 0,
        z: -1.0,
        bladeCount: 4,
        bladeLength: 1.9,
        bladeWidth: 0.28,
        speed: 1.35,
        phase: 0,
      },
    ],
    bumpers: [
      { x: -3.4, z: -3.2, radius: 0.38 },
      { x: 3.4, z: -3.2, radius: 0.38 },
      { x: 0, z: -3.4, radius: 0.34 },
    ],
    defaultCameraAngle: 0,
  },

  // Hole 3: Zig-Zag Canyon (Par 3)
  // Multi-tier switchback with ramps
  // Route A: Bank tier-by-tier down the zig-zag
  // Route B: Take diagonal boost ramp jump straight across canyon gap to bottom green
  {
    holeNumber: 3,
    worldIndex: 0,
    name: 'Zig-Zag Canyon',
    par: 3,
    cells: mergeCells(
      // Top Tier (Tee)
      rectCells(-2, 2, 1, 3),
      // Middle Tier
      rectCells(-1, 0, 2, 1),
      // Bottom Tier (Green)
      rectCells(-2, -3, 1, -2)
    ),
    start: [-3.2, 5.2],
    hole: [0, -5.2],
    boostPads: [
      // Diagonal jump boost pad on top ledge pointing down-right across canyon
      {
        x: 1.0,
        z: 4.2,
        width: 1.6,
        depth: 1.4,
        dirX: 0.35,
        dirZ: -0.93,
        boostSpeed: 14.5,
      },
    ],
    bumpers: [
      { x: 2.8, z: 0.8, radius: 0.36 },
      { x: -2.8, z: -0.8, radius: 0.36 },
    ],
    gapBounds: [
      // Canyon gap separating top tier from bottom tier
      { minX: -3.5, maxX: -1.2, minZ: 1.2, maxZ: 3.0 },
      { minX: 1.2, maxX: 3.5, minZ: -1.5, maxZ: 0.5 },
    ],
    defaultCameraAngle: 0,
  },

  // =========================================================================
  // WORLD 2: SHIFTING RUINS (Holes 4 - 6)
  // Theme: Sunken stone temples, alternating piston walls, deep sand traps
  // =========================================================================

  // Hole 4: Piston Gauntlet (Par 3)
  // 3 alternating sliding stone walls guarding the central corridor + flanking sand traps
  // Route A: Cautious staged putts between piston phases
  // Route B: Full-power threaded shot through all 3 open piston gates
  {
    holeNumber: 4,
    worldIndex: 1,
    name: 'Piston Gauntlet',
    par: 3,
    cells: mergeCells(
      // Central long fairway
      rectCells(-1, -3, 1, 3),
      // Side wings for sand bunkers
      rectCells(-2, -1, -1, 1),
      rectCells(1, -1, 2, 1)
    ),
    start: [0, 5.6],
    hole: [0, -5.6],
    movingBlocks: [
      // Piston 1 (South)
      { x: 0, z: 3.0, width: 1.9, depth: 0.65, axis: 'x', range: 1.5, speed: 2.1, phase: 0 },
      // Piston 2 (Middle - Opposite phase)
      { x: 0, z: 0.0, width: 1.9, depth: 0.65, axis: 'x', range: 1.5, speed: 2.1, phase: Math.PI },
      // Piston 3 (North)
      { x: 0, z: -3.0, width: 1.9, depth: 0.65, axis: 'x', range: 1.5, speed: 2.1, phase: 0.5 * Math.PI },
    ],
    surfaceZones: [
      // West sand bunker
      { x: -2.6, z: 0, width: 2.2, depth: 4.2, type: 'sand' },
      // East sand bunker
      { x: 2.6, z: 0, width: 2.2, depth: 4.2, type: 'sand' },
    ],
    defaultCameraAngle: 0,
  },

  // Hole 5: Boost Over the Abyss (Par 4)
  // Dogleg course with a vast abyss gap in the inner corner
  // Route A: Long safe bank-shot route around the perimeter
  // Route B: Diagonal boost pad launching ball across the abyss void onto raised green
  {
    holeNumber: 5,
    worldIndex: 1,
    name: 'Boost Over the Abyss',
    par: 4,
    cells: mergeCells(
      // South starting corridor
      rectCells(-3, 1, -1, 3),
      // Outer perimeter dogleg (West to East)
      rectCells(-3, -2, -2, 1),
      rectCells(-2, -3, 2, -2),
      // North-East Green
      rectCells(1, 0, 3, 2)
    ),
    start: [-4.0, 5.0],
    hole: [4.0, 3.2],
    boostPads: [
      // Diagonal jump pad launching north-east across the abyss
      {
        x: -2.2,
        z: 2.4,
        width: 1.6,
        depth: 1.4,
        dirX: 0.88,
        dirZ: -0.47,
        boostSpeed: 15.8,
      },
    ],
    bumpers: [
      { x: -4.8, z: -3.8, radius: 0.38 },
      { x: 0.0, z: -4.8, radius: 0.38 },
    ],
    gapBounds: [
      // Central abyss void
      { minX: -1.5, maxX: 1.5, minZ: -1.2, maxZ: 1.8 },
    ],
    defaultCameraAngle: 0,
  },

  // Hole 6: The Sunken Spiral (Par 4)
  // Descending spiral ramp surrounded by high-restitution bumper pillars
  // Route A: Follow the outer spiral curves cleanly using gentle bank shots
  // Route B: Slingshot ricochet off the strategic corner bumper straight into the cup
  {
    holeNumber: 6,
    worldIndex: 1,
    name: 'The Sunken Spiral',
    par: 4,
    cells: mergeCells(
      // Outer ring: North
      rectCells(-2, -2, 2, -2),
      // Outer ring: East
      rectCells(2, -2, 2, 2),
      // Outer ring: South
      rectCells(-2, 2, 2, 2),
      // Inner spiral arm: West
      rectCells(-2, 0, -2, 2),
      // Central Island Cup
      rectCells(0, 0, 1, 0)
    ),
    start: [-3.8, 3.8],
    hole: [1.0, 0.0],
    bumpers: [
      { x: -3.8, z: -3.8, radius: 0.40 },
      { x: 3.8, z: -3.8, radius: 0.40 },
      { x: 3.8, z: 3.8, radius: 0.40 },
      { x: -0.6, z: 1.6, radius: 0.34 },
    ],
    surfaceZones: [
      // Sand strip punishing reckless wide spiral turns
      { x: 3.8, z: 0.0, width: 1.6, depth: 3.0, type: 'sand' },
    ],
    defaultCameraAngle: 0,
  },

  // =========================================================================
  // WORLD 3: NEON LAB (Holes 7 - 9)
  // Theme: Cyber tech lab, portals, low-friction ice sheets, timed drawbridges
  // =========================================================================

  // Hole 7: Portal Ricochet (Par 3)
  // Cup sits inside an enclosed chamber
  // Route A: Wait and time shot through a narrow timed drawbridge
  // Route B: Bank off angled wall into Portal A to instantly warp into the cup room
  {
    holeNumber: 7,
    worldIndex: 2,
    name: 'Portal Ricochet',
    par: 3,
    cells: mergeCells(
      // Outer approach fairway
      rectCells(-2, 1, 2, 3),
      // Side bank wings
      rectCells(-2, -1, -2, 1),
      rectCells(2, -1, 2, 1),
      // Inner Enclosed Cup Chamber
      rectCells(-1, -3, 1, -1)
    ),
    start: [0, 5.4],
    hole: [0, -5.0],
    drawbridges: [
      // Central entry drawbridge to chamber
      {
        x: 0,
        z: -1.0,
        width: 1.8,
        depth: 1.6,
        axis: 'z',
        cycleDuration: 4.0,
        openDuration: 2.2,
        phase: 0,
      },
    ],
    portals: [
      {
        id: 'portal-7',
        a: { x: -3.6, z: 0.0, radius: 0.42, exitDir: [0.0, -1.0] },
        b: { x: 0.0, z: -3.2, radius: 0.42, exitDir: [0.0, -1.0] },
        color: '#00e5ff',
      },
    ],
    bumpers: [
      { x: -3.6, z: 3.2, radius: 0.35 },
      { x: 3.6, z: 3.2, radius: 0.35 },
    ],
    gapBounds: [
      // Drawbridge void gap
      { minX: -1.2, maxX: 1.2, minZ: -1.8, maxZ: -0.2 },
    ],
    defaultCameraAngle: 0,
  },

  // Hole 8: Zero-Friction Drift (Par 4)
  // S-curved ice arena with near-zero friction and rail-less outer edges
  // Route A: Gentle touch control along inner bumper track
  // Route B: High-speed drift shot using bumpers to slingshot around the ice bend directly to cup
  {
    holeNumber: 8,
    worldIndex: 2,
    name: 'Zero-Friction Drift',
    par: 4,
    cells: mergeCells(
      // Starting tee pad
      rectCells(-1, 2, 1, 3),
      // Broad curved ice arena
      rectCells(-2, -1, 2, 1),
      // Upper green
      rectCells(0, -3, 2, -2)
    ),
    start: [0, 5.2],
    hole: [2.0, -5.2],
    surfaceZones: [
      // Large slick ice sheet covering the arena
      { x: 0, z: 0, width: 8.6, depth: 4.8, type: 'ice' },
      // Slime patch on the far outer corner that kills momentum
      { x: -3.2, z: 0, width: 1.8, depth: 3.0, type: 'slime' },
    ],
    bumpers: [
      // Pinball bumpers acting as drift slingshots
      { x: -1.2, z: 0.0, radius: 0.38 },
      { x: 1.2, z: 0.0, radius: 0.38 },
      { x: 0.0, z: -2.4, radius: 0.38 },
    ],
    gapBounds: [
      // Rail-less outer cliff edge
      { minX: -4.5, maxX: -2.8, minZ: -2.5, maxZ: -0.5 },
      { minX: 2.8, maxX: 4.5, minZ: 0.5, maxZ: 2.5 },
    ],
    defaultCameraAngle: 0,
  },

  // Hole 9: Grand Finale (Par 5)
  // Master championship course:
  // Starting boost jump -> sliding piston gauntlet & timed drawbridge -> dual warp portals -> rotating windmill-guarded elevated green!
  {
    holeNumber: 9,
    worldIndex: 2,
    name: 'Grand Finale',
    par: 5,
    cells: mergeCells(
      // Zone 1: Launch Tee
      rectCells(-1, 3, 1, 4),
      // Zone 2: Piston Gauntlet & Bridge Hub
      rectCells(-2, 0, 2, 2),
      // Zone 3: Portal Wing
      rectCells(-3, -2, -2, 0),
      rectCells(2, -2, 3, 0),
      // Zone 4: Elevated Championship Green
      rectCells(-1, -4, 1, -2)
    ),
    start: [0, 7.2],
    hole: [0, -7.2],
    boostPads: [
      // Starting launch pad
      {
        x: 0,
        z: 5.6,
        width: 1.8,
        depth: 1.4,
        dirX: 0.0,
        dirZ: -1.0,
        boostSpeed: 15.2,
      },
    ],
    movingBlocks: [
      // Mid-course sliding barrier
      { x: 0, z: 2.0, width: 2.0, depth: 0.65, axis: 'x', range: 1.8, speed: 2.4, phase: 0 },
    ],
    drawbridges: [
      // Timed drawbridge crossing to final green
      {
        x: 0,
        z: -2.0,
        width: 1.8,
        depth: 1.6,
        axis: 'z',
        cycleDuration: 4.5,
        openDuration: 2.2,
        phase: 1.0,
      },
    ],
    portals: [
      {
        id: 'portal-finale',
        a: { x: -4.5, z: -1.0, radius: 0.42, exitDir: [0.7, -0.7] },
        b: { x: 0.0, z: -4.8, radius: 0.42, exitDir: [0.0, -1.0] },
        color: '#d946ef',
      },
    ],
    sweepers: [
      // 3-blade championship sweeper guarding the cup
      {
        x: 0,
        z: -6.0,
        bladeCount: 3,
        bladeLength: 1.7,
        bladeWidth: 0.28,
        speed: 1.6,
        phase: 0,
      },
    ],
    bumpers: [
      { x: -1.8, z: -7.0, radius: 0.36 },
      { x: 1.8, z: -7.0, radius: 0.36 },
    ],
    gapBounds: [
      // Chasm between hub and championship green
      { minX: -2.5, maxX: 2.5, minZ: -2.8, maxZ: -1.2 },
    ],
    defaultCameraAngle: 0,
  },
];

export const TOTAL_GAME_STARS = ALL_HOLES.length * 3; // 27 stars total (3 worlds x 3 holes)

export function computeCourseWalls(course: HoleCourse): WallSegment[] {
  const cellSet = new Set<string>();
  for (const [c, r] of course.cells) {
    cellSet.add(`${c},${r}`);
  }

  const rawEdges: { x1: number; z1: number; x2: number; z2: number; nx: number; nz: number }[] = [];

  for (const [c, r] of course.cells) {
    const minX = c * CELL_SIZE - CELL_SIZE / 2;
    const maxX = c * CELL_SIZE + CELL_SIZE / 2;
    const minZ = r * CELL_SIZE - CELL_SIZE / 2;
    const maxZ = r * CELL_SIZE + CELL_SIZE / 2;

    // North (row - 1): -Z
    if (!cellSet.has(`${c},${r - 1}`)) {
      rawEdges.push({ x1: minX, z1: minZ, x2: maxX, z2: minZ, nx: 0, nz: 1 });
    }
    // South (row + 1): +Z
    if (!cellSet.has(`${c},${r + 1}`)) {
      rawEdges.push({ x1: minX, z1: maxZ, x2: maxX, z2: maxZ, nx: 0, nz: -1 });
    }
    // West (col - 1): -X
    if (!cellSet.has(`${c - 1},${r}`)) {
      rawEdges.push({ x1: minX, z1: minZ, x2: minX, z2: maxZ, nx: 1, nz: 0 });
    }
    // East (col + 1): +X
    if (!cellSet.has(`${c + 1},${r}`)) {
      rawEdges.push({ x1: maxX, z1: minZ, x2: maxX, z2: maxZ, nx: -1, nz: 0 });
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

  // Offset every merged orthogonal wall outward by FAIRWAY_PAD
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
 * World 0 is unlocked by default.
 * Subsequent worlds unlock when the player has earned at least 2 stars on each hole in preceding worlds.
 */
export function isWorldUnlocked(worldIndex: number, holeStars: Record<number, number>): boolean {
  if (worldIndex <= 0) return true;
  for (let w = 0; w < worldIndex; w++) {
    const holesInWorld = ALL_HOLES.filter((h) => h.worldIndex === w);
    const isWorldCleared =
      holesInWorld.length > 0 &&
      holesInWorld.every((h) => (holeStars[h.holeNumber] || 0) >= 2);
    if (!isWorldCleared) return false;
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

  // If it's the first hole of its world (1, 4, 7), world unlock unlocks it
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
    return `Earn at least 2★ on all holes in ${prevWorld ? prevWorld.name : 'previous world'}`;
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
 * on the exact same starting line (side-by-side perpendicular to the fairway direction).
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
