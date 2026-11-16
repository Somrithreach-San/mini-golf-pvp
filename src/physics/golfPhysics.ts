import {
  HoleCourse,
  WallSegment,
  CELL_SIZE,
  computeCourseWalls,
  isPointInsideCourse,
  RotatingSweeperObstacle,
  TimedDrawbridge,
  BoostPad,
  PortalPair,
  SpecialSurfaceZone,
  GapRegion,
} from '../data/courses';

export const BALL_RADIUS = 0.15;
export const HOLE_RADIUS = 0.37;
export const MAX_SHOT_SPEED = 16.5;

export interface BallPhysicsState {
  x: number;
  z: number;
  vx: number;
  vz: number;
  isMoving: boolean;
  isSunk: boolean;
  sinkProgress: number; // 0..1 animation into the cup
  teleportCooldown?: number; // portal teleport immunity cooldown
}

export interface PhysicsStepEvents {
  wallHitIntensity: number;
  bumperHitIndex: number;
  sunkJustNow: boolean;
  hitX: number;
  hitZ: number;
  hitNx: number;
  hitNz: number;
  isOnSand: boolean;
  isOnIce?: boolean;
  isOnSlime?: boolean;
  boostedJustNow?: boolean;
  teleportedJustNow?: boolean;
  hazardHitIntensity?: number;
}

export function stepBallPhysics(
  state: BallPhysicsState,
  course: HoleCourse,
  walls: WallSegment[],
  dt: number,
  elapsedTime: number,
  subSteps = 8
): PhysicsStepEvents {
  const events: PhysicsStepEvents = {
    wallHitIntensity: 0,
    bumperHitIndex: -1,
    sunkJustNow: false,
    hitX: state.x,
    hitZ: state.z,
    hitNx: 0,
    hitNz: 1,
    isOnSand: false,
    isOnIce: false,
    isOnSlime: false,
    boostedJustNow: false,
    teleportedJustNow: false,
    hazardHitIntensity: 0,
  };

  if (state.isSunk) {
    state.sinkProgress = Math.min(1, state.sinkProgress + dt * 4.2);
    // Ease ball toward exact center of hole
    state.x += (course.hole[0] - state.x) * Math.min(1, dt * 14);
    state.z += (course.hole[1] - state.z) * Math.min(1, dt * 14);
    return events;
  }

  // Check portal cooldown
  if (state.teleportCooldown && state.teleportCooldown > 0) {
    state.teleportCooldown = Math.max(0, state.teleportCooldown - dt);
  }

  // Active moving obstacles can impart motion to stationary balls
  const hasDynamicObstacles = Boolean(
    (course.movingBlocks && course.movingBlocks.length > 0) ||
    (course.sweepers && course.sweepers.length > 0) ||
    (course.drawbridges && course.drawbridges.length > 0)
  );

  if (!state.isMoving && !hasDynamicObstacles) return events;

  const actualSubSteps = state.isMoving ? subSteps : 2;
  const subDt = dt / actualSubSteps;

  for (let step = 0; step < actualSubSteps; step++) {
    const safeX = state.x;
    const safeZ = state.z;
    const stepTime = elapsedTime + step * subDt;

    // 1. Advance Ball Position
    if (state.isMoving) {
      state.x += state.vx * subDt;
      state.z += state.vz * subDt;

      // 2. Surface Zones & Friction
      let dampingPerSec = 1.95; // default grass rolling drag
      let curRestitution = 0.82; // standard wall restitution

      // Check legacy sandStrips
      if (course.sandStrips) {
        for (const s of course.sandStrips) {
          if (
            Math.abs(state.x - s.x) <= s.width / 2 + BALL_RADIUS * 0.4 &&
            Math.abs(state.z - s.z) <= s.depth / 2 + BALL_RADIUS * 0.4
          ) {
            dampingPerSec = 4.8;
            events.isOnSand = true;
            break;
          }
        }
      }

      // Check creative specialSurfaceZones (Sand, Ice, Slime)
      if (course.surfaceZones) {
        for (const sz of course.surfaceZones) {
          if (
            Math.abs(state.x - sz.x) <= sz.width / 2 + BALL_RADIUS * 0.35 &&
            Math.abs(state.z - sz.z) <= sz.depth / 2 + BALL_RADIUS * 0.35
          ) {
            if (sz.type === 'sand') {
              dampingPerSec = 5.2;
              events.isOnSand = true;
            } else if (sz.type === 'ice') {
              dampingPerSec = 0.22; // Low drag: smooth sliding drift
              events.isOnIce = true;
            } else if (sz.type === 'slime') {
              dampingPerSec = 8.8; // High drag + kills bounce
              curRestitution = 0.05;
              events.isOnSlime = true;
            }
            break;
          }
        }
      }

      // Apply exponential friction + gentle linear stop threshold
      const speed = Math.hypot(state.vx, state.vz);
      if (speed > 0.0001) {
        const factor = Math.max(0, 1 - dampingPerSec * subDt);
        state.vx *= factor;
        state.vz *= factor;

        // Extra constant rolling drag at low speeds (unless on low-friction ice)
        const linearDrag = (events.isOnIce ? 0.08 : 0.55) * subDt;
        const curSpeed = Math.hypot(state.vx, state.vz);
        if (curSpeed <= linearDrag) {
          state.vx = 0;
          state.vz = 0;
        } else {
          const ratio = (curSpeed - linearDrag) / curSpeed;
          state.vx *= ratio;
          state.vz *= ratio;
        }
      }

      // 3. Boost Pads / Speed Strips
      if (course.boostPads) {
        for (const bp of course.boostPads) {
          if (
            Math.abs(state.x - bp.x) <= bp.width / 2 &&
            Math.abs(state.z - bp.z) <= bp.depth / 2
          ) {
            const curSpd = Math.hypot(state.vx, state.vz);
            const targetSpd = Math.max(curSpd * 1.35, bp.boostSpeed);
            state.vx = bp.dirX * targetSpd;
            state.vz = bp.dirZ * targetSpd;
            state.isMoving = true;
            events.boostedJustNow = true;
            break;
          }
        }
      }

      // 4. Paired Portals / Teleporters
      if (course.portals && (!state.teleportCooldown || state.teleportCooldown <= 0)) {
        for (const pair of course.portals) {
          const distA = Math.hypot(state.x - pair.a.x, state.z - pair.a.z);
          if (distA < pair.a.radius) {
            const curSpd = Math.max(4.5, Math.hypot(state.vx, state.vz));
            state.x = pair.b.x + pair.b.exitDir[0] * (pair.b.radius + 0.12);
            state.z = pair.b.z + pair.b.exitDir[1] * (pair.b.radius + 0.12);
            state.vx = pair.b.exitDir[0] * curSpd;
            state.vz = pair.b.exitDir[1] * curSpd;
            state.teleportCooldown = 0.65;
            events.teleportedJustNow = true;
            break;
          }

          const distB = Math.hypot(state.x - pair.b.x, state.z - pair.b.z);
          if (distB < pair.b.radius) {
            const curSpd = Math.max(4.5, Math.hypot(state.vx, state.vz));
            state.x = pair.a.x + pair.a.exitDir[0] * (pair.a.radius + 0.12);
            state.z = pair.a.z + pair.a.exitDir[1] * (pair.a.radius + 0.12);
            state.vx = pair.a.exitDir[0] * curSpd;
            state.vz = pair.a.exitDir[1] * curSpd;
            state.teleportCooldown = 0.65;
            events.teleportedJustNow = true;
            break;
          }
        }
      }

      // 5. Check Hole Capture & Rim Attraction
      const dxHole = course.hole[0] - state.x;
      const dzHole = course.hole[1] - state.z;
      const distHole = Math.hypot(dxHole, dzHole);
      const curSpeed = Math.hypot(state.vx, state.vz);

      if (distHole < HOLE_RADIUS) {
        if (distHole > 0.001) {
          state.vx += (dxHole / distHole) * 9.5 * subDt;
          state.vz += (dzHole / distHole) * 9.5 * subDt;
        }
        if (distHole < HOLE_RADIUS * 0.78 && curSpeed < 9.5) {
          state.isSunk = true;
          state.isMoving = false;
          state.vx = 0;
          state.vz = 0;
          events.sunkJustNow = true;
          return events;
        }
      }

      // 6. Pinball Bumper Pillars (High Restitution Rebound = 1.38x)
      if (course.bumpers) {
        for (let i = 0; i < course.bumpers.length; i++) {
          const b = course.bumpers[i];
          const dx = state.x - b.x;
          const dz = state.z - b.z;
          const dist = Math.hypot(dx, dz);
          const minDist = BALL_RADIUS + b.radius;
          if (dist < minDist && dist > 0.0001) {
            const nx = dx / dist;
            const nz = dz / dist;
            state.x = b.x + nx * minDist;
            state.z = b.z + nz * minDist;

            const vn = state.vx * nx + state.vz * nz;
            if (vn < 0) {
              const bumperRestitution = 1.38; // Arcade pinball punch!
              state.vx -= (1 + bumperRestitution) * vn * nx;
              state.vz -= (1 + bumperRestitution) * vn * nz;
              events.bumperHitIndex = i;
              events.hitX = b.x + nx * b.radius;
              events.hitZ = b.z + nz * b.radius;
              events.hitNx = nx;
              events.hitNz = nz;
            }
          }
        }
      }
    }

    // 7. Rotating Windmills / Sweepers
    if (course.sweepers) {
      for (const sw of course.sweepers) {
        const baseAngle = stepTime * sw.speed + (sw.phase ?? 0);
        const bladeHalfW = sw.bladeWidth / 2;
        const colRadius = BALL_RADIUS + bladeHalfW;

        for (let k = 0; k < sw.bladeCount; k++) {
          const bladeAngle = baseAngle + (k * 2 * Math.PI) / sw.bladeCount;
          const cosA = Math.cos(bladeAngle);
          const sinA = Math.sin(bladeAngle);

          // Blade segment: (sw.x, sw.z) -> (tipX, tipZ)
          const tipX = sw.x + cosA * sw.bladeLength;
          const tipZ = sw.z + sinA * sw.bladeLength;

          const segX = tipX - sw.x;
          const segZ = tipZ - sw.z;
          const segLenSq = segX * segX + segZ * segZ;
          if (segLenSq < 0.0001) continue;

          let t = ((state.x - sw.x) * segX + (state.z - sw.z) * segZ) / segLenSq;
          t = Math.max(0, Math.min(1, t));

          const cx = sw.x + t * segX;
          const cz = sw.z + t * segZ;
          const dx = state.x - cx;
          const dz = state.z - cz;
          const dist = Math.hypot(dx, dz);

          if (dist < colRadius) {
            let nx = -sinA;
            let nz = cosA;
            // Align normal pointing toward ball
            if (dx * nx + dz * nz < 0) {
              nx = -nx;
              nz = -nz;
            }

            state.x = cx + nx * (colRadius + 0.005);
            state.z = cz + nz * (colRadius + 0.005);

            // Blade tangential velocity at contact point
            const contactRadius = t * sw.bladeLength;
            const bladeTanVx = -sinA * sw.speed * contactRadius;
            const bladeTanVz = cosA * sw.speed * contactRadius;

            const relVx = state.vx - bladeTanVx;
            const relVz = state.vz - bladeTanVz;
            const vn = relVx * nx + relVz * nz;

            if (vn < 0) {
              const restitution = 1.30;
              state.vx = bladeTanVx + (state.vx - bladeTanVx) - (1 + restitution) * vn * nx;
              state.vz = bladeTanVz + (state.vz - bladeTanVz) - (1 + restitution) * vn * nz;
            } else if (!state.isMoving) {
              state.vx = bladeTanVx * 1.35 + nx * 2.0;
              state.vz = bladeTanVz * 1.35 + nz * 2.0;
            }
            state.isMoving = true;
            events.hazardHitIntensity = 0.85;
            events.hitX = cx;
            events.hitZ = cz;
            events.hitNx = nx;
            events.hitNz = nz;
          }
        }
      }
    }

    // 8. Sliding Piston Walls / Moving Blocks
    if (course.movingBlocks) {
      for (const mb of course.movingBlocks) {
        const phase = mb.phase ?? 0;
        const offset = Math.sin(stepTime * mb.speed + phase) * mb.range;
        const instVel = Math.cos(stepTime * mb.speed + phase) * mb.range * mb.speed;
        const mbVx = mb.axis === 'x' ? instVel : 0;
        const mbVz = mb.axis === 'z' ? instVel : 0;

        const bx = mb.axis === 'x' ? mb.x + offset : mb.x;
        const bz = mb.axis === 'z' ? mb.z + offset : mb.z;
        const halfW = mb.width / 2;
        const halfD = mb.depth / 2;

        const closestX = Math.max(bx - halfW, Math.min(state.x, bx + halfW));
        const closestZ = Math.max(bz - halfD, Math.min(state.z, bz + halfD));
        const dx = state.x - closestX;
        const dz = state.z - closestZ;
        const dist = Math.hypot(dx, dz);

        if (dist < BALL_RADIUS) {
          let nx = 0;
          let nz = 1;
          if (dist > 0.0001) {
            nx = dx / dist;
            nz = dz / dist;
          } else {
            const penX = halfW - Math.abs(state.x - bx);
            const penZ = halfD - Math.abs(state.z - bz);
            if (penX < penZ) {
              nx = state.x >= bx ? 1 : -1;
              nz = 0;
            } else {
              nx = 0;
              nz = state.z >= bz ? 1 : -1;
            }
          }
          state.x = closestX + nx * (BALL_RADIUS + 0.005);
          state.z = closestZ + nz * (BALL_RADIUS + 0.005);

          const relVx = state.vx - mbVx;
          const relVz = state.vz - mbVz;
          const vn = relVx * nx + relVz * nz;
          if (vn < 0) {
            state.vx -= 1.85 * vn * nx;
            state.vz -= 1.85 * vn * nz;
          } else if (!state.isMoving) {
            state.vx = mbVx * 1.25 + nx * 1.5;
            state.vz = mbVz * 1.25 + nz * 1.5;
          }
          state.isMoving = true;
          const impact = Math.min(1, Math.hypot(relVx, relVz) / 8);
          if (impact >= events.wallHitIntensity) {
            events.wallHitIntensity = Math.max(0.25, impact);
            events.hitX = closestX;
            events.hitZ = closestZ;
            events.hitNx = nx;
            events.hitNz = nz;
          }
        }
      }
    }

    if (!state.isMoving) break;

    // 9. Perimeter & Internal Walls
    const wallRadius = BALL_RADIUS + 0.08;
    for (const w of walls) {
      const wx = w.x2 - w.x1;
      const wz = w.z2 - w.z1;
      const lenSq = wx * wx + wz * wz;
      if (lenSq < 0.00001) continue;

      let t = ((state.x - w.x1) * wx + (state.z - w.z1) * wz) / lenSq;
      t = Math.max(0, Math.min(1, t));
      const cx = w.x1 + t * wx;
      const cz = w.z1 + t * wz;

      const dx = state.x - cx;
      const dz = state.z - cz;
      const dist = Math.hypot(dx, dz);

      if (dist < wallRadius) {
        let nx = w.nx;
        let nz = w.nz;
        if (t <= 0.001 || t >= 0.999) {
          if (dist > 0.0001) {
            nx = dx / dist;
            nz = dz / dist;
          }
        }

        state.x = cx + nx * wallRadius;
        state.z = cz + nz * wallRadius;

        const vn = state.vx * nx + state.vz * nz;
        if (vn < 0) {
          const restitution = 0.82;
          state.vx -= (1 + restitution) * vn * nx;
          state.vz -= (1 + restitution) * vn * nz;
          const impact = Math.min(1, Math.abs(vn) / 10);
          if (impact >= events.wallHitIntensity) {
            events.wallHitIntensity = Math.max(0.18, impact);
            events.hitX = cx;
            events.hitZ = cz;
            events.hitNx = nx;
            events.hitNz = nz;
          }
        }
      }
    }

    // 10. Void Gap Check & Timed Drawbridges
    let isInVoidGap = false;
    if (course.gapBounds) {
      for (const gap of course.gapBounds) {
        if (
          state.x >= gap.minX &&
          state.x <= gap.maxX &&
          state.z >= gap.minZ &&
          state.z <= gap.maxZ
        ) {
          // Check if drawbridge covers this gap and is currently closed/walkable
          let bridgeClosed = false;
          if (course.drawbridges) {
            for (const db of course.drawbridges) {
              const cycleT = (stepTime + (db.phase ?? 0)) % db.cycleDuration;
              const isClosed = cycleT >= db.openDuration;
              if (
                isClosed &&
                Math.abs(state.x - db.x) <= db.width / 2 &&
                Math.abs(state.z - db.z) <= db.depth / 2
              ) {
                bridgeClosed = true;
                break;
              }
            }
          }
          if (!bridgeClosed) {
            isInVoidGap = true;
            break;
          }
        }
      }
    }

    // 11. Out-of-Bounds Recovery (Void gap drop or crossing outside perimeter)
    if (isInVoidGap || !isPointInsideCourse(course, state.x, state.z, 0.25)) {
      if (!isInVoidGap && isPointInsideCourse(course, safeX, safeZ, 0.25)) {
        state.x = safeX;
        state.z = safeZ;
        state.vx = -state.vx * 0.4;
        state.vz = -state.vz * 0.4;
      } else {
        // Drop into void: clean reset onto starting tee
        state.x = course.start[0];
        state.z = course.start[1];
        state.vx = 0;
        state.vz = 0;
        state.isMoving = false;
        events.hazardHitIntensity = 1.0;
      }
    }
  }

  // Stop threshold
  if (state.isMoving && Math.hypot(state.vx, state.vz) < 0.08) {
    state.vx = 0;
    state.vz = 0;
    state.isMoving = false;
  }

  return events;
}

export interface HintResult {
  points: [number, number][];
  recommendedPower: number; // 0..100 percentage
  targetPoint: [number, number];
  isHoleInOne: boolean;
}

function lineSegmentsIntersect(
  x1: number, z1: number, x2: number, z2: number,
  x3: number, z3: number, x4: number, z4: number
): boolean {
  const d = (x1 - x2) * (z3 - z4) - (z1 - z2) * (x3 - x4);
  if (Math.abs(d) < 0.00001) return false;
  const t = ((x1 - x3) * (z3 - z4) - (z1 - z3) * (x3 - x4)) / d;
  const u = -((x1 - x2) * (z1 - z3) - (z1 - z2) * (x1 - x3)) / d;
  return t >= 0.001 && t <= 0.999 && u >= 0.001 && u <= 0.999;
}

function isLineOfSightClear(
  x1: number, z1: number,
  x2: number, z2: number,
  walls: WallSegment[],
  bumpers?: { x: number; z: number; radius: number }[]
): boolean {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const len = Math.hypot(dx, dz);
  if (len < 0.05) return true;

  const nx = -dz / len;
  const nz = dx / len;
  const margin = BALL_RADIUS + 0.08;

  const offsets = [0, margin, -margin];

  for (const off of offsets) {
    const rx1 = x1 + nx * off;
    const rz1 = z1 + nz * off;
    const rx2 = x2 + nx * off;
    const rz2 = z2 + nz * off;

    for (const w of walls) {
      if (lineSegmentsIntersect(rx1, rz1, rx2, rz2, w.x1, w.z1, w.x2, w.z2)) {
        return false;
      }
    }
  }

  if (bumpers) {
    for (const b of bumpers) {
      const bRad = b.radius + BALL_RADIUS + 0.06;
      const t = Math.max(0, Math.min(1, ((b.x - x1) * dx + (b.z - z1) * dz) / (len * len)));
      const cx = x1 + t * dx;
      const cz = z1 + t * dz;
      if (Math.hypot(b.x - cx, b.z - cz) < bRad) {
        return false;
      }
    }
  }

  return true;
}

function findCorridorCellPath(
  course: HoleCourse,
  startX: number,
  startZ: number
): [number, number][] {
  const cellSet = new Set<string>();
  for (const [c, r] of course.cells) {
    cellSet.add(`${c},${r}`);
  }

  let startCell: [number, number] = [0, 0];
  let minStartDist = Infinity;
  for (const [c, r] of course.cells) {
    const cx = c * CELL_SIZE;
    const cz = r * CELL_SIZE;
    const d = Math.hypot(startX - cx, startZ - cz);
    if (d < minStartDist) {
      minStartDist = d;
      startCell = [c, r];
    }
  }

  let holeCell: [number, number] = [0, 0];
  let minHoleDist = Infinity;
  for (const [c, r] of course.cells) {
    const cx = c * CELL_SIZE;
    const cz = r * CELL_SIZE;
    const d = Math.hypot(course.hole[0] - cx, course.hole[1] - cz);
    if (d < minHoleDist) {
      minHoleDist = d;
      holeCell = [c, r];
    }
  }

  const startKey = `${startCell[0]},${startCell[1]}`;
  const holeKey = `${holeCell[0]},${holeCell[1]}`;

  if (startKey === holeKey) {
    return [startCell];
  }

  const queue: [number, number][] = [startCell];
  const visited = new Set<string>([startKey]);
  const parentMap = new Map<string, [number, number]>();

  const neighbors = [
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0],
  ];

  let found = false;

  while (queue.length > 0) {
    const [cc, cr] = queue.shift()!;
    const curKey = `${cc},${cr}`;

    if (curKey === holeKey) {
      found = true;
      break;
    }

    for (const [dc, dr] of neighbors) {
      const nc = cc + dc;
      const nr = cr + dr;
      const nKey = `${nc},${nr}`;

      if (cellSet.has(nKey) && !visited.has(nKey)) {
        visited.add(nKey);
        parentMap.set(nKey, [cc, cr]);
        queue.push([nc, nr]);
      }
    }
  }

  if (!found) {
    return [startCell, holeCell];
  }

  const path: [number, number][] = [];
  let curr: [number, number] | undefined = holeCell;
  while (curr) {
    path.unshift(curr);
    const k = `${curr[0]},${curr[1]}`;
    if (k === startKey) break;
    curr = parentMap.get(k);
  }

  return path;
}

function findNextTargetWaypoint(
  course: HoleCourse,
  startX: number,
  startZ: number,
  walls: WallSegment[]
): [number, number] {
  if (isLineOfSightClear(startX, startZ, course.hole[0], course.hole[1], walls, course.bumpers)) {
    return [course.hole[0], course.hole[1]];
  }

  const cellPath = findCorridorCellPath(course, startX, startZ);

  for (let i = cellPath.length - 1; i >= 0; i--) {
    const [c, r] = cellPath[i];
    const wx = c * CELL_SIZE;
    const wz = r * CELL_SIZE;

    const distFromStart = Math.hypot(wx - startX, wz - startZ);
    if (distFromStart < 0.6) continue;

    if (isLineOfSightClear(startX, startZ, wx, wz, walls, course.bumpers)) {
      return [wx, wz];
    }
  }

  const dx = course.hole[0] - startX;
  const dz = course.hole[1] - startZ;
  const len = Math.hypot(dx, dz) || 1;
  return [startX + (dx / len) * 2.5, startZ + (dz / len) * 2.5];
}

export function computeHintTrajectory(
  course: HoleCourse,
  startX: number,
  startZ: number,
  elapsedTime = 0
): HintResult {
  const walls = computeCourseWalls(course);
  const target = findNextTargetWaypoint(course, startX, startZ, walls);
  const isDirectHoleTarget =
    Math.hypot(target[0] - course.hole[0], target[1] - course.hole[1]) < 0.2;

  const targetAngle = Math.atan2(target[1] - startZ, target[0] - startX);
  const holeAngle = Math.atan2(course.hole[1] - startZ, course.hole[0] - startX);

  const candidateAngles = new Set<number>();
  candidateAngles.add(targetAngle);
  candidateAngles.add(holeAngle);

  for (let deg = -24; deg <= 24; deg += 4) {
    candidateAngles.add(targetAngle + (deg * Math.PI) / 180);
  }

  for (const deg of [-48, -36, 36, 48]) {
    candidateAngles.add(targetAngle + (deg * Math.PI) / 180);
  }

  if (Math.abs(holeAngle - targetAngle) > 0.2) {
    for (const deg of [-12, -6, 6, 12]) {
      candidateAngles.add(holeAngle + (deg * Math.PI) / 180);
    }
  }

  const speedCandidates: number[] = [4.2, 5.8, 7.4, 9.0, 10.8, 12.6, 14.2, 15.8];

  let bestAngle = targetAngle;
  let bestSpeed = 9.0;
  let bestScore = Infinity;
  let bestIsSunk = false;
  const simDt = 0.03;

  for (const angle of candidateAngles) {
    const dirX = Math.cos(angle);
    const dirZ = Math.sin(angle);

    for (const speed of speedCandidates) {
      const simState: BallPhysicsState = {
        x: startX,
        z: startZ,
        vx: dirX * speed,
        vz: dirZ * speed,
        isMoving: true,
        isSunk: false,
        sinkProgress: 0,
      };

      let minHoleDist = Infinity;
      let minTargetDist = Infinity;
      let sunkStep = -1;

      for (let step = 0; step < 130; step++) {
        stepBallPhysics(simState, course, walls, simDt, elapsedTime + step * simDt, 3);
        const dh = Math.hypot(simState.x - course.hole[0], simState.z - course.hole[1]);
        if (dh < minHoleDist) minHoleDist = dh;
        const dtg = Math.hypot(simState.x - target[0], simState.z - target[1]);
        if (dtg < minTargetDist) minTargetDist = dtg;

        if (simState.isSunk) {
          sunkStep = step;
          break;
        }
        if (!simState.isMoving) break;
      }

      if (sunkStep >= 0) {
        const sinkScore = -100000 - (130 - sunkStep) * 100;
        if (sinkScore < bestScore) {
          bestScore = sinkScore;
          bestAngle = angle;
          bestSpeed = speed;
          bestIsSunk = true;
        }
        continue;
      }

      if (bestIsSunk) continue;

      const endHoleDist = Math.hypot(simState.x - course.hole[0], simState.z - course.hole[1]);
      const endTargetDist = Math.hypot(simState.x - target[0], simState.z - target[1]);

      let score = 0;
      if (isDirectHoleTarget) {
        score = endHoleDist * 2.0 + minHoleDist * 0.8;
      } else {
        score = endTargetDist * 1.5 + endHoleDist * 0.8 + minTargetDist * 0.4;
      }

      if (isLineOfSightClear(simState.x, simState.z, course.hole[0], course.hole[1], walls, course.bumpers)) {
        score -= 2.0;
      }

      if (score < bestScore) {
        bestScore = score;
        bestAngle = angle;
        bestSpeed = speed;
      }
    }
  }

  // Generate smooth sampled visual trajectory polyline
  const trajectoryState: BallPhysicsState = {
    x: startX,
    z: startZ,
    vx: Math.cos(bestAngle) * bestSpeed,
    vz: Math.sin(bestAngle) * bestSpeed,
    isMoving: true,
    isSunk: false,
    sinkProgress: 0,
  };

  const polyline: [number, number][] = [[startX, startZ]];
  let lastSampleX = startX;
  let lastSampleZ = startZ;

  for (let s = 0; s < 140; s++) {
    stepBallPhysics(trajectoryState, course, walls, simDt, elapsedTime + s * simDt, 4);

    const stepDist = Math.hypot(trajectoryState.x - lastSampleX, trajectoryState.z - lastSampleZ);
    if (stepDist >= 0.28 || trajectoryState.isSunk || !trajectoryState.isMoving) {
      polyline.push([trajectoryState.x, trajectoryState.z]);
      lastSampleX = trajectoryState.x;
      lastSampleZ = trajectoryState.z;
    }

    if (trajectoryState.isSunk || !trajectoryState.isMoving) break;
  }

  const powerFraction = Math.max(0, Math.min(1, (bestSpeed / MAX_SHOT_SPEED - 0.14) / 0.86));
  const recommendedPower = Math.round(powerFraction * 100);

  return {
    points: polyline,
    recommendedPower: Math.max(15, Math.min(100, recommendedPower)),
    targetPoint: target,
    isHoleInOne: bestIsSunk,
  };
}

export interface BallBallCollisionEvent {
  collided: boolean;
  contactX: number;
  contactZ: number;
  intensity: number;
}

export function resolveBallBallCollision(
  ball1: BallPhysicsState,
  ball2: BallPhysicsState
): BallBallCollisionEvent {
  const event: BallBallCollisionEvent = {
    collided: false,
    contactX: 0,
    contactZ: 0,
    intensity: 0,
  };

  if (ball1.isSunk || ball2.isSunk) return event;

  const dx = ball2.x - ball1.x;
  const dz = ball2.z - ball1.z;
  const dist = Math.hypot(dx, dz);
  const minDist = BALL_RADIUS * 2; // 0.30

  if (dist < minDist) {
    let nx = 1;
    let nz = 0;
    if (dist > 0.0001) {
      nx = dx / dist;
      nz = dz / dist;
    }

    event.contactX = ball1.x + nx * BALL_RADIUS;
    event.contactZ = ball1.z + nz * BALL_RADIUS;

    const dvx = ball1.vx - ball2.vx;
    const dvz = ball1.vz - ball2.vz;
    const normalVel = dvx * nx + dvz * nz;

    if (normalVel > 0) {
      const restitution = 0.88;
      const impulse = ((1 + restitution) * normalVel) * 0.5;

      ball1.vx -= impulse * nx;
      ball1.vz -= impulse * nz;
      ball2.vx += impulse * nx;
      ball2.vz += impulse * nz;

      ball1.isMoving = Math.hypot(ball1.vx, ball1.vz) > 0.015;
      ball2.isMoving = Math.hypot(ball2.vx, ball2.vz) > 0.015;

      event.collided = true;
      event.intensity = Math.min(1, normalVel / 6.0);
    }

    const overlap = minDist - dist;
    const halfOverlap = overlap * 0.5 + 0.001;
    ball1.x -= nx * halfOverlap;
    ball1.z -= nz * halfOverlap;
    ball2.x += nx * halfOverlap;
    ball2.z += nz * halfOverlap;
  }

  return event;
}

export function stepMultiplayerPhysics(
  ball1: BallPhysicsState,
  ball2: BallPhysicsState,
  course: HoleCourse,
  walls: WallSegment[],
  dt: number,
  elapsedTime: number,
  subSteps = 8
): {
  events1: PhysicsStepEvents;
  events2: PhysicsStepEvents;
  ballCollision: BallBallCollisionEvent;
} {
  let combinedCollision: BallBallCollisionEvent = {
    collided: false,
    contactX: 0,
    contactZ: 0,
    intensity: 0,
  };

  const actualSubSteps = (ball1.isMoving || ball2.isMoving) ? subSteps : 1;
  const subDt = dt / actualSubSteps;

  let lastEvents1: PhysicsStepEvents = {
    wallHitIntensity: 0,
    bumperHitIndex: -1,
    sunkJustNow: false,
    hitX: ball1.x,
    hitZ: ball1.z,
    hitNx: 0,
    hitNz: 1,
    isOnSand: false,
  };
  let lastEvents2: PhysicsStepEvents = {
    wallHitIntensity: 0,
    bumperHitIndex: -1,
    sunkJustNow: false,
    hitX: ball2.x,
    hitZ: ball2.z,
    hitNx: 0,
    hitNz: 1,
    isOnSand: false,
  };

  for (let s = 0; s < actualSubSteps; s++) {
    const stepTime = elapsedTime + s * subDt;
    const e1 = stepBallPhysics(ball1, course, walls, subDt, stepTime, 1);
    const e2 = stepBallPhysics(ball2, course, walls, subDt, stepTime, 1);

    if (e1.wallHitIntensity > lastEvents1.wallHitIntensity) lastEvents1 = e1;
    if (e2.wallHitIntensity > lastEvents2.wallHitIntensity) lastEvents2 = e2;
    if (e1.sunkJustNow) lastEvents1.sunkJustNow = true;
    if (e2.sunkJustNow) lastEvents2.sunkJustNow = true;
    if (e1.isOnSand) lastEvents1.isOnSand = true;
    if (e2.isOnSand) lastEvents2.isOnSand = true;
    if (e1.boostedJustNow) lastEvents1.boostedJustNow = true;
    if (e2.boostedJustNow) lastEvents2.boostedJustNow = true;
    if (e1.teleportedJustNow) lastEvents1.teleportedJustNow = true;
    if (e2.teleportedJustNow) lastEvents2.teleportedJustNow = true;
    if (e1.hazardHitIntensity) lastEvents1.hazardHitIntensity = e1.hazardHitIntensity;
    if (e2.hazardHitIntensity) lastEvents2.hazardHitIntensity = e2.hazardHitIntensity;

    const col = resolveBallBallCollision(ball1, ball2);
    if (col.collided) {
      combinedCollision = col;
    }
  }

  return {
    events1: lastEvents1,
    events2: lastEvents2,
    ballCollision: combinedCollision,
  };
}
