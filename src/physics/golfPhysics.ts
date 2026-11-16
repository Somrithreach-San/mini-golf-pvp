import { HoleCourse, WallSegment, CELL_SIZE, computeCourseWalls, isPointInsideCourse } from '../data/courses';

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
  };

  if (state.isSunk) {
    state.sinkProgress = Math.min(1, state.sinkProgress + dt * 4.2);
    // Ease ball toward exact center of hole
    state.x += (course.hole[0] - state.x) * Math.min(1, dt * 14);
    state.z += (course.hole[1] - state.z) * Math.min(1, dt * 14);
    return events;
  }

  // Even if the ball is stationary, check if a moving block slides into it
  const hasMovingBlocks = Boolean(course.movingBlocks && course.movingBlocks.length > 0);
  if (!state.isMoving && !hasMovingBlocks) return events;

  const actualSubSteps = state.isMoving ? subSteps : 1;
  const subDt = dt / actualSubSteps;

  for (let step = 0; step < actualSubSteps; step++) {
    const safeX = state.x;
    const safeZ = state.z;
    const stepTime = elapsedTime + step * subDt;

    if (state.isMoving) {
      // Advance position
      state.x += state.vx * subDt;
      state.z += state.vz * subDt;

      // Pure ground rolling physics (Zero air resistance or wind drift forces)
      let dampingPerSec = 1.95; // standard grass rolling resistance
      if (course.sandStrips) {
        for (const s of course.sandStrips) {
          if (
            Math.abs(state.x - s.x) <= s.width / 2 + BALL_RADIUS * 0.4 &&
            Math.abs(state.z - s.z) <= s.depth / 2 + BALL_RADIUS * 0.4
          ) {
            dampingPerSec = 4.6; // sand slows the ball down noticeably
            events.isOnSand = true;
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
        // Extra constant rolling drag at low speeds so the ball settles crisply
        const linearDrag = 0.55 * subDt;
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

      // Check hole capture / rim attraction
      const dxHole = course.hole[0] - state.x;
      const dzHole = course.hole[1] - state.z;
      const distHole = Math.hypot(dxHole, dzHole);
      const curSpeed = Math.hypot(state.vx, state.vz);

      if (distHole < HOLE_RADIUS) {
        // Gravity pull toward center of cup
        if (distHole > 0.001) {
          state.vx += (dxHole / distHole) * 9.5 * subDt;
          state.vz += (dzHole / distHole) * 9.5 * subDt;
        }
        // Sink if within capture radius and not blasting across at max speed
        if (distHole < HOLE_RADIUS * 0.78 && curSpeed < 9.5) {
          state.isSunk = true;
          state.isMoving = false;
          state.vx = 0;
          state.vz = 0;
          events.sunkJustNow = true;
          return events;
        }
      }

      // Collide with Bumpers
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
            // Push out
            state.x = b.x + nx * minDist;
            state.z = b.z + nz * minDist;

            const vn = state.vx * nx + state.vz * nz;
            if (vn < 0) {
              const restitution = 0.92;
              state.vx -= (1 + restitution) * vn * nx;
              state.vz -= (1 + restitution) * vn * nz;
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

    // Collide with Moving Blocks (works even if ball was previously stationary)
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

    // Collide with Perimeter & Internal Walls
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
          // Corner endpoint collision (e.g. convex corner of an L-bend)
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

    // Emergency out-of-bounds recovery ONLY if ball somehow crosses completely outside the perimeter walls (margin = +0.25)
    if (!isPointInsideCourse(course, state.x, state.z, 0.25)) {
      if (isPointInsideCourse(course, safeX, safeZ, 0.25)) {
        state.x = safeX;
        state.z = safeZ;
        state.vx = -state.vx * 0.4;
        state.vz = -state.vz * 0.4;
      } else {
        // Hard failsafe: return ball safely onto the starting tee so game never soft-locks
        state.x = course.start[0];
        state.z = course.start[1];
        state.vx = 0;
        state.vz = 0;
        state.isMoving = false;
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

/**
 * Checks if segment (x1, z1) -> (x2, z2) intersects segment (x3, z3) -> (x4, z4).
 */
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

/**
 * Checks if a direct straight path from (x1, z1) to (x2, z2) has clear line of sight
 * (not obstructed by perimeter walls or bumper obstacles with safety radius buffer).
 */
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

  // Check 3 parallel rays (center, left offset, right offset)
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

  // Check bumper obstacles
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

/**
 * Uses BFS across course grid cells to find the shortest corridor sequence
 * from the ball's current cell to the hole cup's cell.
 */
function findCorridorCellPath(
  course: HoleCourse,
  startX: number,
  startZ: number
): [number, number][] {
  const cellSet = new Set<string>();
  for (const [c, r] of course.cells) {
    cellSet.add(`${c},${r}`);
  }

  const startC = Math.round(startX / CELL_SIZE);
  const startR = Math.round(startZ / CELL_SIZE);
  const holeC = Math.round(course.hole[0] / CELL_SIZE);
  const holeR = Math.round(course.hole[1] / CELL_SIZE);

  let actualStartC = startC;
  let actualStartR = startR;
  if (!cellSet.has(`${startC},${startR}`)) {
    let bestDist = Infinity;
    for (const [c, r] of course.cells) {
      const d = Math.hypot(startX - c * CELL_SIZE, startZ - r * CELL_SIZE);
      if (d < bestDist) {
        bestDist = d;
        actualStartC = c;
        actualStartR = r;
      }
    }
  }

  const queue: [number, number][][] = [[[actualStartC, actualStartR]]];
  const visited = new Set<string>([`${actualStartC},${actualStartR}`]);

  while (queue.length > 0) {
    const path = queue.shift()!;
    const [currC, currR] = path[path.length - 1];

    if (currC === holeC && currR === holeR) {
      return path;
    }

    const neighbors: [number, number][] = [
      [currC + 1, currR],
      [currC - 1, currR],
      [currC, currR + 1],
      [currC, currR - 1],
    ];

    for (const [nc, nr] of neighbors) {
      const key = `${nc},${nr}`;
      if (cellSet.has(key) && !visited.has(key)) {
        visited.add(key);
        queue.push([...path, [nc, nr]]);
      }
    }
  }

  return [[actualStartC, actualStartR]];
}

/**
 * Finds the immediate fairway target waypoint (hole cup or corner bend)
 * ensuring shots navigate corridors instead of smacking perimeter walls.
 */
function findNextTargetWaypoint(
  course: HoleCourse,
  startX: number,
  startZ: number,
  walls: WallSegment[]
): [number, number] {
  // 1. Direct line of sight to hole cup?
  if (isLineOfSightClear(startX, startZ, course.hole[0], course.hole[1], walls, course.bumpers)) {
    return [course.hole[0], course.hole[1]];
  }

  // 2. BFS corridor path
  const cellPath = findCorridorCellPath(course, startX, startZ);
  if (cellPath.length <= 1) {
    return [course.hole[0], course.hole[1]];
  }

  // Extract corridor waypoints (corner turns along path)
  const waypoints: [number, number][] = [];
  for (let i = 1; i < cellPath.length - 1; i++) {
    const prev = cellPath[i - 1];
    const curr = cellPath[i];
    const next = cellPath[i + 1];
    const d1 = [curr[0] - prev[0], curr[1] - prev[1]];
    const d2 = [next[0] - curr[0], next[1] - curr[1]];
    if (d1[0] !== d2[0] || d1[1] !== d2[1]) {
      waypoints.push([curr[0] * CELL_SIZE, curr[1] * CELL_SIZE]);
    }
  }
  waypoints.push([course.hole[0], course.hole[1]]);

  // Find the furthest waypoint that has clear line of sight from ball
  for (let i = waypoints.length - 1; i >= 0; i--) {
    const wp = waypoints[i];
    if (isLineOfSightClear(startX, startZ, wp[0], wp[1], walls, course.bumpers)) {
      return wp;
    }
  }

  // If corner vertex isn't fully visible, find the furthest visible cell center along path
  for (let i = cellPath.length - 1; i >= 0; i--) {
    const [c, r] = cellPath[i];
    const wx = c * CELL_SIZE;
    const wz = r * CELL_SIZE;
    if (isLineOfSightClear(startX, startZ, wx, wz, walls, course.bumpers)) {
      return [wx, wz];
    }
  }

  return [course.hole[0], course.hole[1]];
}

/**
 * Intelligent AI Caddie / Shot Assistant:
 * Uses BFS fairway corridor pathfinding, line-of-sight analysis, and multi-candidate
 * physics simulations to compute the optimal stroke trajectory, recommended power percentage,
 * and target destination.
 */
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

  // Build candidate shot angles
  const candidateAngles = new Set<number>();
  candidateAngles.add(targetAngle);
  candidateAngles.add(holeAngle);

  // Directional cone around target angle
  for (let deg = -24; deg <= 24; deg += 4) {
    candidateAngles.add(targetAngle + (deg * Math.PI) / 180);
  }

  // Wider bank angles for bouncing off corridor walls
  for (const deg of [-48, -36, 36, 48]) {
    candidateAngles.add(targetAngle + (deg * Math.PI) / 180);
  }

  // If hole angle differs, also test cone around hole in case a bank shot can reach
  if (Math.abs(holeAngle - targetAngle) > 0.2) {
    for (const deg of [-12, -6, 6, 12]) {
      candidateAngles.add(holeAngle + (deg * Math.PI) / 180);
    }
  }

  // Speed candidate levels
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
        // Direct Hole In One / Sink!
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

      // Bonus if resting position has line of sight to hole for next putt!
      if (isLineOfSightClear(simState.x, simState.z, course.hole[0], course.hole[1], walls, course.bumpers)) {
        score -= 8.0;
      }

      // Penalty if ended outside or stuck
      if (!isPointInsideCourse(course, simState.x, simState.z)) {
        score += 200.0;
      }

      if (score < bestScore) {
        bestScore = score;
        bestAngle = angle;
        bestSpeed = speed;
      }
    }
  }

  // Re-simulate winning candidate with high fidelity (dt = 0.02) to record trajectory points
  const points: [number, number][] = [[startX, startZ]];
  const recordSim: BallPhysicsState = {
    x: startX,
    z: startZ,
    vx: Math.cos(bestAngle) * bestSpeed,
    vz: Math.sin(bestAngle) * bestSpeed,
    isMoving: true,
    isSunk: false,
    sinkProgress: 0,
  };

  const highDt = 0.02;
  let lastRecordedX = startX;
  let lastRecordedZ = startZ;

  for (let s = 0; s < 180; s++) {
    const events = stepBallPhysics(recordSim, course, walls, highDt, elapsedTime + s * highDt, 3);
    const distFromLast = Math.hypot(recordSim.x - lastRecordedX, recordSim.z - lastRecordedZ);

    if (distFromLast >= 0.22 || events.wallHitIntensity > 0 || recordSim.isSunk) {
      points.push([recordSim.x, recordSim.z]);
      lastRecordedX = recordSim.x;
      lastRecordedZ = recordSim.z;
    }

    if (recordSim.isSunk) {
      points.push([course.hole[0], course.hole[1]]);
      break;
    }
    if (!recordSim.isMoving) break;
  }

  // Calculate recommended power percentage (0..100)
  // speed = (0.14 + P * 0.86) * MAX_SHOT_SPEED
  const rawPower = (bestSpeed / MAX_SHOT_SPEED - 0.14) / 0.86;
  const recommendedPower = Math.round(Math.max(15, Math.min(100, rawPower * 100)));

  const finalTargetPoint = bestIsSunk
    ? course.hole
    : points.length > 1
    ? points[points.length - 1]
    : target;

  return {
    points,
    recommendedPower,
    targetPoint: [finalTargetPoint[0], finalTargetPoint[1]],
    isHoleInOne: bestIsSunk,
  };
}

export interface BallBallCollisionEvent {
  collided: boolean;
  contactX: number;
  contactZ: number;
  intensity: number;
}

/**
 * Resolves physical elastic collision between two golf balls on the fairway,
 * exchanging realistic momentum and preventing interpenetration.
 */
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

    // Only apply impulse if balls are approaching each other
    if (normalVel > 0) {
      const restitution = 0.88; // crisp solid golf ball rebound
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

    // Positional separation to prevent sticking/jitter
    const overlap = minDist - dist;
    const halfOverlap = overlap * 0.5 + 0.001;
    ball1.x -= nx * halfOverlap;
    ball1.z -= nz * halfOverlap;
    ball2.x += nx * halfOverlap;
    ball2.z += nz * halfOverlap;
  }

  return event;
}

/**
 * Simultaneously steps two balls with high-fidelity 120Hz sub-stepping,
 * resolving wall collisions, terrain, and ball-on-ball physical bumping.
 */
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

    // Ball-on-ball physical bumping
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
