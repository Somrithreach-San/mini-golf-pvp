import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import {
  HoleCourse,
  CELL_SIZE,
  FAIRWAY_PAD,
  WallSegment,
  computeCourseWalls,
  getCourseBounds,
  GOLF_WORLDS,
  getMultiplayerTeePositions,
} from '../data/courses';
import { GolfBallSkin, GOLF_BALL_SKINS } from '../data/balls';
import {
  BALL_RADIUS,
  HOLE_RADIUS,
  MAX_SHOT_SPEED,
  BallPhysicsState,
  stepBallPhysics,
  stepMultiplayerPhysics,
  computeHintTrajectory,
} from '../physics/golfPhysics';
import { MultiplayerState, multiplayerManager } from '../multiplayer/MultiplayerManager';
import { soundEngine } from '../audio/soundEngine';
import { natureAssets } from './natureAssets';
import { loadBallModel, getCachedBallModel, preloadAllBallModels } from './golfBallAsset';
import { loadGolfClubModel } from './golfClubAsset';
import { createGolfTeeMesh, getTeeCupElevation, GOLF_TEE_DEFAULT_SCALE } from './golfTeeAsset';
import { createWindmillInstance, onWindmillLoaded, WindmillInstance } from './windmillAsset';

export interface GolfSceneCanvasProps {
  mode: 'menu' | 'play';
  course: HoleCourse;
  ballSkin: GolfBallSkin;
  rotateTrigger: number;
  hintTrigger: number;
  retryTrigger: number;
  onPowerChange: (powerPercent: number) => void;
  onStrokeIncrement: () => void;
  onHoleComplete: () => void;
  multiplayerState?: MultiplayerState;
  onMultiplayerHoleFinish?: (winner: 'p1' | 'p2' | 'tie', p1Strokes: number, p2Strokes: number) => void;
  onHintInfo?: (info: { powerPercent: number; isHoleInOne: boolean } | null) => void;
}

// Pre-allocated math helpers at module scope (Zero GC in render loop)
const _camTargetPos = new THREE.Vector3();
const _camLookAt = new THREE.Vector3();
const _ballRollAxis = new THREE.Vector3();
const _dummyMatrix = new THREE.Matrix4();
const _dummyPos = new THREE.Vector3();
const _dummyQuat = new THREE.Quaternion();
const _dummyScale = new THREE.Vector3(1, 1, 1);

const isSoftwareGl = (() => {
  if (typeof document === 'undefined') return false;
  const gl = document.createElement('canvas').getContext('webgl2');
  if (!gl) return true;
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
  const gpu = String(gl.getParameter(param));
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
})();

/**
 * Generates a reusable procedural normal/bump map for realistic golf ball dimples
 */
function createGolfDimpleBumpMap(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);

  const rows = 10;
  const cols = 20;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ox = (r % 2) * (size / cols) * 0.5;
      const cx = c * (size / cols) + ox;
      const cy = (r + 0.5) * (size / rows);
      const radius = size * 0.019;

      const grad = ctx.createRadialGradient(cx, cy, radius * 0.1, cx, cy, radius);
      grad.addColorStop(0, '#202020');
      grad.addColorStop(0.75, '#505050');
      grad.addColorStop(1, '#808080');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

/**
 * Computes a short, straight-line directional indicator right in front of the ball (no wall-bounce path assistant)
 */
function computeShortAimPoints(
  startX: number,
  startZ: number,
  dirX: number,
  dirZ: number,
  maxLength: number,
  walls: WallSegment[],
  course: HoleCourse,
  numPoints: number
): [number, number][] {
  const points: [number, number][] = [];
  const wallRadius = BALL_RADIUS + 0.06;

  for (let i = 1; i <= numPoints; i++) {
    const distFromBall = 0.28 + (i / numPoints) * maxLength;
    const px = startX + dirX * distFromBall;
    const pz = startZ + dirZ * distFromBall;

    // Stop the short aim line if it reaches a bumper or wall (do NOT reflect/bounce)
    let blocked = false;
    if (course.bumpers) {
      for (const b of course.bumpers) {
        if (Math.hypot(px - b.x, pz - b.z) < BALL_RADIUS + b.radius) {
          blocked = true;
          break;
        }
      }
    }
    if (!blocked) {
      for (const w of walls) {
        const wx = w.x2 - w.x1;
        const wz = w.z2 - w.z1;
        const lenSq = wx * wx + wz * wz;
        if (lenSq < 0.00001) continue;
        let t = ((px - w.x1) * wx + (pz - w.z1) * wz) / lenSq;
        t = Math.max(0, Math.min(1, t));
        const cx = w.x1 + t * wx;
        const cz = w.z1 + t * wz;
        if (Math.hypot(px - cx, pz - cz) < wallRadius) {
          blocked = true;
          break;
        }
      }
    }

    if (blocked) break;
    points.push([px, pz]);
  }

  return points;
}

export const GolfSceneCanvas: React.FC<GolfSceneCanvasProps> = ({
  mode,
  course,
  ballSkin,
  rotateTrigger,
  hintTrigger,
  retryTrigger,
  onPowerChange,
  onStrokeIncrement,
  onHoleComplete,
  multiplayerState,
  onMultiplayerHoleFinish,
  onHintInfo,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);

  const callbacksRef = useRef({
    onPowerChange,
    onStrokeIncrement,
    onHoleComplete,
    onMultiplayerHoleFinish,
    onHintInfo,
  });
  callbacksRef.current = {
    onPowerChange,
    onStrokeIncrement,
    onHoleComplete,
    onMultiplayerHoleFinish,
    onHintInfo,
  };

  const stateRef = useRef<{
    mode: 'menu' | 'play';
    course: HoleCourse;
    ballSkin: GolfBallSkin;
    cameraAngleOffset: number;
    multiplayerState?: MultiplayerState;
    onMultiplayerHoleFinish?: (winner: 'p1' | 'p2' | 'tie', p1Strokes: number, p2Strokes: number) => void;
    rebuildCourse?: () => void;
    updateBallMaterial?: () => void;
    triggerHint?: () => void;
    resetBall?: () => void;
  }>({
    mode,
    course,
    ballSkin,
    cameraAngleOffset: 0,
    multiplayerState,
    onMultiplayerHoleFinish,
  });

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;
    let isDisposed = false;

    // 1. Initialize Renderer with True-to-Hex sRGB Color Output (No ACES/IBL Washout)
    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x000000, 0);

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    renderer.setSize(width, height);
    container.appendChild(renderer.domElement);

    // 2. Clean Vibrant Scene (No Fog or Milky White RoomEnvironment Reflection)
    const scene = new THREE.Scene();

    // 3. Camera
    const camera = new THREE.PerspectiveCamera(34, width / height, 0.5, 160);
    camera.position.set(0, 14, 14);

    // 4. Calibrated Cartoon Lighting Rig (1:1 Saturated Hex Color Reproduction + Crisp Shadows)
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.68);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 1.52);
    sunLight.position.set(8, 22, 11);
    sunLight.castShadow = !isSoftwareGl;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 4;
    sunLight.shadow.camera.far = 48;
    const d = 14.5;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = 0.00005;
    sunLight.shadow.normalBias = 0.005;
    scene.add(sunLight);

    // Warm up and pre-cache authentic golf audio sample buffers
    soundEngine.preloadSamples();

    // 5. Shared Geometries & Materials Cache (Rich, Unfaded Arcade Palette)
    const sharedGeos = {
      subTile: new THREE.BoxGeometry(1.0, 0.06, 1.0),
      cellBase: new THREE.BoxGeometry(1.0, 0.15, 1.0),
      treeTrunk: new THREE.CylinderGeometry(0.13, 0.25, 0.92, 7),
      treeRoot: new THREE.CylinderGeometry(0.24, 0.36, 0.22, 7),
      oakCrownMain: new THREE.IcosahedronGeometry(0.76, 0),
      oakCrownTop: new THREE.IcosahedronGeometry(0.5, 0),
      oakCrownSide: new THREE.IcosahedronGeometry(0.44, 0),
      pineTier1: new THREE.ConeGeometry(0.78, 0.95, 7),
      pineTier2: new THREE.ConeGeometry(0.62, 0.82, 7),
      pineTier3: new THREE.ConeGeometry(0.44, 0.68, 7),
      bush: new THREE.IcosahedronGeometry(0.28, 0),
      flower: new THREE.DodecahedronGeometry(0.09, 0),
      cliffRock: new THREE.DodecahedronGeometry(0.55, 0),
      cornerPostBody: new THREE.CylinderGeometry(0.16, 0.16, 0.24, 12),
      cornerPostCap: new THREE.CylinderGeometry(0.185, 0.185, 0.13, 12),
      hintDot: new THREE.SphereGeometry(0.065, 12, 12),
      hintBeacon: new THREE.RingGeometry(0.12, 0.34, 32).rotateX(-Math.PI / 2),
      hintCupBeacon: new THREE.RingGeometry(0.22, 0.46, 32).rotateX(-Math.PI / 2),
      bambooStalk: new THREE.CylinderGeometry(0.042, 0.052, 1.45, 7),
      bambooNode: new THREE.CylinderGeometry(0.056, 0.056, 0.035, 7),
      lanternBody: new THREE.SphereGeometry(0.16, 12, 10),
      lanternCap: new THREE.CylinderGeometry(0.08, 0.09, 0.04, 10),
      lilyPad: new THREE.CylinderGeometry(0.26, 0.26, 0.016, 14),
    };
    sharedGeos.treeTrunk.translate(0, 0.46, 0);
    sharedGeos.treeRoot.translate(0, 0.11, 0);
    sharedGeos.pineTier1.translate(0, 0.475, 0);
    sharedGeos.pineTier2.translate(0, 0.41, 0);
    sharedGeos.pineTier3.translate(0, 0.34, 0);
    sharedGeos.bambooStalk.translate(0, 0.725, 0);

    const textureLoader = new THREE.TextureLoader();
    const sandDiffuse = textureLoader.load('/assets/sand/sand_diffuse.jpg');
    sandDiffuse.wrapS = THREE.RepeatWrapping;
    sandDiffuse.wrapT = THREE.RepeatWrapping;
    sandDiffuse.colorSpace = THREE.SRGBColorSpace;

    const sandBump = textureLoader.load('/assets/sand/sand_bump.jpg');
    sandBump.wrapS = THREE.RepeatWrapping;
    sandBump.wrapT = THREE.RepeatWrapping;

    const sharedMats = {
      lightTile: new THREE.MeshStandardMaterial({ color: 0x8bf259, roughness: 0.88, metalness: 0.0 }),
      darkTile: new THREE.MeshStandardMaterial({ color: 0x7be449, roughness: 0.88, metalness: 0.0 }),
      jadeLightTile: new THREE.MeshStandardMaterial({ color: 0x6dd146, roughness: 0.88, metalness: 0.0 }),
      jadeDarkTile: new THREE.MeshStandardMaterial({ color: 0x5cc036, roughness: 0.88, metalness: 0.0 }),
      creamBase: new THREE.MeshStandardMaterial({ color: 0xedf7b8, roughness: 0.92, metalness: 0.0 }),
      marbleCream: new THREE.MeshStandardMaterial({ color: 0xf4efe1, roughness: 0.88, metalness: 0.0 }),
      carvedStone: new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.85, metalness: 0.0, flatShading: true }),
      sand: new THREE.MeshStandardMaterial({
        map: sandDiffuse,
        bumpMap: sandBump,
        bumpScale: 0.04,
        roughness: 0.88,
        metalness: 0.02,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      }),
      dirtUpper: new THREE.MeshStandardMaterial({ color: 0x99653c, roughness: 0.92, metalness: 0.0, flatShading: true }),
      dirtMid: new THREE.MeshStandardMaterial({ color: 0x80522f, roughness: 0.92, metalness: 0.0, flatShading: true }),
      dirtDeep: new THREE.MeshStandardMaterial({ color: 0x663f22, roughness: 0.95, metalness: 0.0, flatShading: true }),
      stoneCliffUpper: new THREE.MeshStandardMaterial({ color: 0x7c8a9e, roughness: 0.88, metalness: 0.0, flatShading: true }),
      stoneCliffMid: new THREE.MeshStandardMaterial({ color: 0x5c697a, roughness: 0.9, metalness: 0.0, flatShading: true }),
      stoneCliffDeep: new THREE.MeshStandardMaterial({ color: 0x414b59, roughness: 0.92, metalness: 0.0, flatShading: true }),
      cliffRock: new THREE.MeshStandardMaterial({ color: 0x8492a6, roughness: 0.85, metalness: 0.0, flatShading: true }),
      trunk: new THREE.MeshStandardMaterial({ color: 0x7c4c2a, roughness: 0.92, metalness: 0.0, flatShading: true }),
      sakuraTrunk: new THREE.MeshStandardMaterial({ color: 0x593624, roughness: 0.9, metalness: 0.0, flatShading: true }),
      canopy1: new THREE.MeshStandardMaterial({ color: 0x42b830, roughness: 0.85, metalness: 0.0, flatShading: true }),
      canopy2: new THREE.MeshStandardMaterial({ color: 0x4cc938, roughness: 0.85, metalness: 0.0, flatShading: true }),
      canopy3: new THREE.MeshStandardMaterial({ color: 0x359c24, roughness: 0.85, metalness: 0.0, flatShading: true }),
      sakuraPink1: new THREE.MeshStandardMaterial({ color: 0xff80ab, roughness: 0.82, metalness: 0.0, flatShading: true }),
      sakuraPink2: new THREE.MeshStandardMaterial({ color: 0xffa3c2, roughness: 0.82, metalness: 0.0, flatShading: true }),
      sakuraPink3: new THREE.MeshStandardMaterial({ color: 0xffcadb, roughness: 0.82, metalness: 0.0, flatShading: true }),
      bambooGreen: new THREE.MeshLambertMaterial({ color: 0x3db570 }),
      bambooDark: new THREE.MeshLambertMaterial({ color: 0x247548 }),
      vermilionRed: new THREE.MeshLambertMaterial({ color: 0xd62828 }),
      vermilionDark: new THREE.MeshLambertMaterial({ color: 0x9e1919 }),
      glazedRoofBlue: new THREE.MeshStandardMaterial({ color: 0x1d7096, roughness: 0.55, metalness: 0.05, flatShading: true }),
      glazedRoofDark: new THREE.MeshStandardMaterial({ color: 0x134e6b, roughness: 0.6, metalness: 0.05, flatShading: true }),
      teakWood: new THREE.MeshLambertMaterial({ color: 0xb56e33 }),
      lanternGlow: new THREE.MeshStandardMaterial({
        color: 0xff2a1f,
        emissive: 0xff3b00,
        emissiveIntensity: 0.45,
        roughness: 0.5,
      }),
      warmCandleGlow: new THREE.MeshStandardMaterial({
        color: 0xffd43b,
        emissive: 0xff9900,
        emissiveIntensity: 0.55,
        roughness: 0.4,
      }),
      pondWater: new THREE.MeshLambertMaterial({
        color: 0x22b8eb,
        transparent: true,
        opacity: 0.94,
      }),
      lilyPadMat: new THREE.MeshLambertMaterial({ color: 0x329c49 }),
      koiOrange: new THREE.MeshLambertMaterial({ color: 0xff4d14 }),
      flowerYellow: new THREE.MeshLambertMaterial({ color: 0xffd43b }),
      flowerPink: new THREE.MeshLambertMaterial({ color: 0xff70a6 }),
      whiteGloss: new THREE.MeshLambertMaterial({ color: 0xffffff }),
      chromeRim: new THREE.MeshLambertMaterial({ color: 0xdbe4ee }),
      goldAccent: new THREE.MeshLambertMaterial({ color: 0xffcf26 }),
      flagRed: new THREE.MeshLambertMaterial({ color: 0xf26444, side: THREE.DoubleSide }),
      hintDot: new THREE.MeshBasicMaterial({ color: 0xffd43b }),
      hintBeacon: new THREE.MeshBasicMaterial({ color: 0xffb703, transparent: true, opacity: 0.85, side: THREE.DoubleSide }),
      hintCupBeacon: new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.9, side: THREE.DoubleSide }),
    };

    // 6. Root Scene Hierarchy
    const islandRoot = new THREE.Group();
    scene.add(islandRoot);

    const courseGroup = new THREE.Group();
    islandRoot.add(courseGroup);

    // 7. 3D Modeled Ball Assembly (Ball 1 - Player 1 & Ball 2 - Player 2)
    const ballGroup = new THREE.Group();
    islandRoot.add(ballGroup);
    const ballRotGroup = new THREE.Group();
    ballGroup.add(ballRotGroup);

    const ballGroup2 = new THREE.Group();
    ballGroup2.visible = false;
    islandRoot.add(ballGroup2);
    const ballRotGroup2 = new THREE.Group();
    ballGroup2.add(ballRotGroup2);

    // Fallback sphere mesh while GLB loads
    const fallbackGeo = new THREE.SphereGeometry(BALL_RADIUS, 24, 24);
    const fallbackMat = new THREE.MeshStandardMaterial({
      color: stateRef.current.ballSkin.baseColor,
      roughness: 0.35,
      metalness: 0.05,
    });
    const fallbackMesh = new THREE.Mesh(fallbackGeo, fallbackMat);
    fallbackMesh.castShadow = !isSoftwareGl;
    fallbackMesh.receiveShadow = !isSoftwareGl;

    const fallbackMesh2 = fallbackMesh.clone();
    fallbackMesh2.castShadow = !isSoftwareGl;
    fallbackMesh2.receiveShadow = !isSoftwareGl;

    const currentBallHolder1 = { model: fallbackMesh };
    ballRotGroup.add(currentBallHolder1.model);

    const currentBallHolder2 = { model: fallbackMesh2 };
    ballRotGroup2.add(currentBallHolder2.model);

    function applyBallModelToGroup(rotGroup: THREE.Group, holder: { model: THREE.Object3D }, skin: GolfBallSkin) {
      const cached = getCachedBallModel(skin.modelUrl, BALL_RADIUS);
      if (cached) {
        rotGroup.remove(holder.model);
        holder.model = cached;
        rotGroup.add(holder.model);
        return;
      }

      loadBallModel(skin.modelUrl, BALL_RADIUS, isSoftwareGl).then((model) => {
        if (!model || isDisposed) return;
        rotGroup.remove(holder.model);
        holder.model = model;
        rotGroup.add(holder.model);
      });
    }

    function applyActiveBallModel(skin: GolfBallSkin) {
      applyBallModelToGroup(ballRotGroup, currentBallHolder1, skin);
    }

    applyActiveBallModel(stateRef.current.ballSkin);
    preloadAllBallModels(
      GOLF_BALL_SKINS.map((s) => s.modelUrl),
      BALL_RADIUS,
      isSoftwareGl
    );

    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 64;
    shadowCanvas.height = 64;
    const sCtx = shadowCanvas.getContext('2d')!;
    const sGrad = sCtx.createRadialGradient(32, 32, 4, 32, 32, 30);
    sGrad.addColorStop(0, 'rgba(15, 35, 10, 0.48)');
    sGrad.addColorStop(0.55, 'rgba(15, 35, 10, 0.22)');
    sGrad.addColorStop(1, 'rgba(15, 35, 10, 0.0)');
    sCtx.fillStyle = sGrad;
    sCtx.fillRect(0, 0, 64, 64);
    const shadowTex = new THREE.CanvasTexture(shadowCanvas);

    const shadowGeo = new THREE.PlaneGeometry(BALL_RADIUS * 2.8, BALL_RADIUS * 2.8);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
    });
    const ballShadow = new THREE.Mesh(shadowGeo, shadowMat);
    ballShadow.position.y = 0.192;
    ballShadow.renderOrder = 3;
    islandRoot.add(ballShadow);

    const ballShadow2 = new THREE.Mesh(shadowGeo.clone(), shadowMat.clone());
    ballShadow2.position.y = 0.192;
    ballShadow2.renderOrder = 3;
    ballShadow2.visible = false;
    islandRoot.add(ballShadow2);

    // Glowing Turn & Player Indicator Rings on Turf
    const markerRingGeo = new THREE.RingGeometry(BALL_RADIUS * 1.35, BALL_RADIUS * 1.82, 32);
    markerRingGeo.rotateX(-Math.PI / 2);

    const p1MarkerMat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      transparent: true,
      opacity: 0.95,
      side: THREE.DoubleSide,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    });
    const p1MarkerRing = new THREE.Mesh(markerRingGeo, p1MarkerMat);
    p1MarkerRing.position.y = 0.191;
    p1MarkerRing.visible = false;
    islandRoot.add(p1MarkerRing);

    const p2MarkerMat = new THREE.MeshBasicMaterial({
      color: 0xff5722,
      transparent: true,
      opacity: 0.95,
      side: THREE.DoubleSide,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    });
    const p2MarkerRing = new THREE.Mesh(markerRingGeo.clone(), p2MarkerMat);
    p2MarkerRing.position.y = 0.191;
    p2MarkerRing.visible = false;
    islandRoot.add(p2MarkerRing);

    // Aiming Indicator Group (Power Ring + Physics-Bounce Dotted Line + Directional Cone Tip)
    const aimGroup = new THREE.Group();
    aimGroup.visible = false;
    islandRoot.add(aimGroup);

    const aimRingGeo = new THREE.RingGeometry(BALL_RADIUS * 1.45, BALL_RADIUS * 1.9, 32);
    aimRingGeo.rotateX(-Math.PI / 2);
    const aimRingMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.92,
      side: THREE.DoubleSide,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    });
    const aimRing = new THREE.Mesh(aimRingGeo, aimRingMat);
    aimRing.position.y = 0.19;
    aimRing.renderOrder = 2;
    aimGroup.add(aimRing);

    const aimDots: THREE.Mesh[] = [];
    const dotGeo = new THREE.SphereGeometry(0.072, 12, 12);
    const dotMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    for (let i = 0; i < 5; i++) {
      const dot = new THREE.Mesh(dotGeo, dotMat.clone());
      dot.position.y = 0.25;
      aimGroup.add(dot);
      aimDots.push(dot);
    }

    // Remote Opponent Aiming Indicator Group (Multiplayer)
    const remoteAimGroup = new THREE.Group();
    remoteAimGroup.visible = false;
    islandRoot.add(remoteAimGroup);

    const remoteAimRingMat = new THREE.MeshBasicMaterial({
      color: 0xff3366,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    });
    const remoteAimRing = new THREE.Mesh(aimRingGeo, remoteAimRingMat);
    remoteAimRing.position.y = 0.19;
    remoteAimRing.renderOrder = 2;
    remoteAimGroup.add(remoteAimRing);

    const remoteAimDots: THREE.Mesh[] = [];
    const remoteDotMat = new THREE.MeshBasicMaterial({ color: 0xff3366 });
    for (let i = 0; i < 5; i++) {
      const rDot = new THREE.Mesh(dotGeo, remoteDotMat.clone());
      rDot.position.y = 0.25;
      remoteAimGroup.add(rDot);
      remoteAimDots.push(rDot);
    }

    // Hint Trajectory Group (Smart Corridor Path & Trajectory Visuals)
    const hintGroup = new THREE.Group();
    hintGroup.visible = false;
    islandRoot.add(hintGroup);
    let hintHideTimer = 0;
    const hintTrajectoryDots: THREE.Mesh[] = [];
    let hintTargetBeaconMesh: THREE.Mesh | null = null;
    let hintCupBeaconMesh: THREE.Mesh | null = null;

    // Aim direction tracking shared across course setup, pointer events and render loop
    let currentAimDirX = 0;
    let currentAimDirZ = -1;

    // 7b. Authentic 3D Golf Club Assembly (Extracted from GOLF_Club.blend)
    const clubGroup = new THREE.Group();
    clubGroup.visible = false;
    islandRoot.add(clubGroup);

    const clubGroup2 = new THREE.Group();
    clubGroup2.visible = false;
    islandRoot.add(clubGroup2);

    let clubModelInstance: THREE.Group | null = null;
    loadGolfClubModel(isSoftwareGl).then((model) => {
      if (model && !isDisposed) {
        clubModelInstance = model;
        clubGroup.add(model);
        clubGroup2.add(model.clone(true));
      }
    });

    // Ground Contact Shadow Under Club Head Sole
    const clubShadowGeo = new THREE.PlaneGeometry(0.36, 0.20);
    clubShadowGeo.rotateX(-Math.PI / 2);
    const clubShadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    });
    const clubShadow = new THREE.Mesh(clubShadowGeo, clubShadowMat);
    clubShadow.position.set(-0.02, -0.148, -0.07);
    clubGroup.add(clubShadow);

    const clubShadowMat2 = clubShadowMat.clone();
    const clubShadow2 = new THREE.Mesh(clubShadowGeo.clone(), clubShadowMat2);
    clubShadow2.position.set(-0.02, -0.148, -0.07);
    clubGroup2.add(clubShadow2);

    // Height offset for authentic 3D golf club: its sole sits at local y = -0.150,
    // so world position y = 0.338 places the sole at y = 0.188, resting right on the turf (0.175) and sand (0.189)
    // with zero embedding into the ground!
    const CLUB_BASE_Y = 0.338;

    // Dynamic Swing State (Downswing, Impact, Hold Follow-through until ball reaches destination)
    interface ClubSwingState {
      active: boolean;
      phase: 'idle' | 'swing' | 'holdingFollowThrough' | 'fading';
      timer: number;
      duration: number;
      impactTime: number;
      ballLaunched: boolean;
      originX: number;
      originZ: number;
      pullbackDist: number;
      strikePower: number;
      strikeDirX: number;
      strikeDirZ: number;
      fadeTimer: number;
      elevY: number;
    }

    const clubSwingState: ClubSwingState = {
      active: false,
      phase: 'idle',
      timer: 0,
      duration: 0.16,
      impactTime: 0.07,
      ballLaunched: false,
      originX: 0,
      originZ: 0,
      pullbackDist: 0.22,
      strikePower: 0,
      strikeDirX: 0,
      strikeDirZ: -1,
      fadeTimer: 0,
      elevY: 0,
    };

    const clubSwingState2: ClubSwingState = {
      active: false,
      phase: 'idle',
      timer: 0,
      duration: 0.16,
      impactTime: 0.07,
      ballLaunched: false,
      originX: 0,
      originZ: 0,
      pullbackDist: 0.22,
      strikePower: 0,
      strikeDirX: 0,
      strikeDirZ: -1,
      fadeTimer: 0,
      elevY: 0,
    };

    // Zero-GC 3D Particle Pool (Ball Rolling Trail Puffs + Wall/Bumper Collision Sparks + Sink Confetti)
    const particleGroup = new THREE.Group();
    islandRoot.add(particleGroup);

    const particleGeo = new THREE.DodecahedronGeometry(0.085, 0);
    interface ParticleSlot {
      mesh: THREE.Mesh;
      mat: THREE.MeshBasicMaterial;
      active: boolean;
      age: number;
      maxLife: number;
      vx: number;
      vy: number;
      vz: number;
      gravity: number;
      initialScale: number;
      spinSpeed: number;
    }

    const PARTICLE_POOL_SIZE = 64;
    const particlePool: ParticleSlot[] = [];
    let nextParticleIdx = 0;

    for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
      const pMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 1,
        depthWrite: false,
      });
      const pMesh = new THREE.Mesh(particleGeo, pMat);
      pMesh.visible = false;
      pMesh.renderOrder = 4;
      particleGroup.add(pMesh);
      particlePool.push({
        mesh: pMesh,
        mat: pMat,
        active: false,
        age: 0,
        maxLife: 0.4,
        vx: 0,
        vy: 0,
        vz: 0,
        gravity: 0,
        initialScale: 1,
        spinSpeed: 0,
      });
    }

    // Impact Shockwave Rings Pool (Expands on Wall / Bumper / Putt Impact)
    const shockwaveGeo = new THREE.RingGeometry(0.12, 0.21, 24);
    shockwaveGeo.rotateX(-Math.PI / 2);
    interface ShockwaveSlot {
      mesh: THREE.Mesh;
      mat: THREE.MeshBasicMaterial;
      active: boolean;
      age: number;
      maxLife: number;
      maxScale: number;
    }
    const shockwavePool: ShockwaveSlot[] = [];
    let nextShockwaveIdx = 0;
    for (let i = 0; i < 6; i++) {
      const swMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -4,
        polygonOffsetUnits: -4,
      });
      const swMesh = new THREE.Mesh(shockwaveGeo, swMat);
      swMesh.visible = false;
      swMesh.renderOrder = 4;
      particleGroup.add(swMesh);
      shockwavePool.push({
        mesh: swMesh,
        mat: swMat,
        active: false,
        age: 0,
        maxLife: 0.28,
        maxScale: 2.2,
      });
    }

    let trailEmitAccumulator = 0;

    function spawnParticle(
      x: number,
      y: number,
      z: number,
      vx: number,
      vy: number,
      vz: number,
      colorHex: number,
      scale: number,
      maxLife: number,
      gravity: number
    ) {
      const slot = particlePool[nextParticleIdx];
      nextParticleIdx = (nextParticleIdx + 1) % PARTICLE_POOL_SIZE;
      slot.active = true;
      slot.age = 0;
      slot.maxLife = maxLife;
      slot.vx = vx;
      slot.vy = vy;
      slot.vz = vz;
      slot.gravity = gravity;
      slot.initialScale = scale;
      slot.spinSpeed = (Math.random() - 0.5) * 10;
      slot.mat.color.setHex(colorHex);
      slot.mat.opacity = 0.95;
      slot.mesh.position.set(x, y, z);
      slot.mesh.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      slot.mesh.scale.setScalar(scale);
      slot.mesh.visible = true;
    }

    function spawnShockwave(x: number, z: number, colorHex: number, maxScale = 2.1, maxLife = 0.26) {
      const sw = shockwavePool[nextShockwaveIdx];
      nextShockwaveIdx = (nextShockwaveIdx + 1) % shockwavePool.length;
      sw.active = true;
      sw.age = 0;
      sw.maxLife = maxLife;
      sw.maxScale = maxScale;
      sw.mat.color.setHex(colorHex);
      sw.mat.opacity = 0.9;
      sw.mesh.position.set(x, 0.2, z);
      sw.mesh.scale.setScalar(0.35);
      sw.mesh.visible = true;
    }

    function spawnImpactBurst(
      hitX: number,
      hitZ: number,
      nx: number,
      nz: number,
      intensity: number,
      isBumper: boolean
    ) {
      const isChinese = stateRef.current.course.theme === 'chinese-garden';
      const count = isBumper ? 14 : Math.max(7, Math.round(6 + intensity * 8));
      const palette = isBumper
        ? [0xffd43b, 0x48dbfb, 0xffffff, 0xff85b3]
        : isChinese
        ? [0xffd43b, 0xffb8d1, 0xffffff, 0xff6b6b]
        : [0xffffff, 0xffd43b, 0xff922b, 0xf6f3d4];

      spawnShockwave(
        hitX,
        hitZ,
        isBumper ? 0xffd43b : isChinese ? 0xffd43b : 0xffffff,
        isBumper ? 2.5 : 1.5 + intensity * 0.9,
        0.26
      );

      for (let i = 0; i < count; i++) {
        const spreadAngle = (Math.random() - 0.5) * 2.1;
        const cosS = Math.cos(spreadAngle);
        const sinS = Math.sin(spreadAngle);
        const dirX = nx * cosS - nz * sinS;
        const dirZ = nx * sinS + nz * cosS;
        const spd = (1.1 + Math.random() * 2.6) * (0.55 + intensity * 0.65);
        const vy = 1.4 + Math.random() * 2.4;
        const color = palette[i % palette.length];
        const scale = 0.55 + Math.random() * 0.55;
        spawnParticle(
          hitX + nx * 0.05,
          0.24 + Math.random() * 0.06,
          hitZ + nz * 0.05,
          dirX * spd,
          vy,
          dirZ * spd,
          color,
          scale,
          0.28 + Math.random() * 0.2,
          9.8
        );
      }
    }

    function spawnLaunchBurst(x: number, z: number, dirX: number, dirZ: number, power: number) {
      const isChinese = stateRef.current.course.theme === 'chinese-garden';
      spawnShockwave(x, z, isChinese ? 0xffd43b : 0xffffff, 1.4 + power * 0.8, 0.22);
      const count = 9;
      const palette = isChinese ? [0xffd43b, 0xffb8d1, 0xffffff] : [0xffffff, 0xd9f99d, 0xfef08a];
      for (let i = 0; i < count; i++) {
        const angle = (Math.random() - 0.5) * 2.4;
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);
        // Puff mostly behind the shot direction
        const bx = -dirX * cosA + dirZ * sinA;
        const bz = -dirZ * cosA - dirX * sinA;
        const spd = (0.7 + Math.random() * 1.8) * (0.5 + power * 0.6);
        spawnParticle(
          x + bx * 0.1,
          0.21,
          z + bz * 0.1,
          bx * spd,
          0.65 + Math.random() * 1.1,
          bz * spd,
          palette[i % palette.length],
          0.55 + Math.random() * 0.45,
          0.25 + Math.random() * 0.16,
          3.5
        );
      }
    }

    function spawnSinkBurst(holeX: number, holeZ: number) {
      const isChinese = stateRef.current.course.theme === 'chinese-garden';
      spawnShockwave(holeX, holeZ, 0xffd43b, 2.8, 0.38);
      const palette = isChinese
        ? [0xffd43b, 0xff9ebb, 0xe03131, 0xffffff]
        : [0xffd43b, 0x40c952, 0xffffff, 0x48dbfb];
      for (let i = 0; i < 18; i++) {
        const angle = (i / 18) * Math.PI * 2 + (Math.random() - 0.5) * 0.25;
        const spd = 1.2 + Math.random() * 2.3;
        spawnParticle(
          holeX + Math.cos(angle) * 0.12,
          0.22,
          holeZ + Math.sin(angle) * 0.12,
          Math.cos(angle) * spd,
          2.6 + Math.random() * 2.4,
          Math.sin(angle) * spd,
          palette[i % palette.length],
          0.65 + Math.random() * 0.5,
          0.45 + Math.random() * 0.25,
          8.5
        );
      }
    }

    function updateParticles(dt: number) {
      for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
        const p = particlePool[i];
        if (!p.active) continue;
        p.age += dt;
        if (p.age >= p.maxLife) {
          p.active = false;
          p.mesh.visible = false;
          continue;
        }
        p.vy -= p.gravity * dt;
        p.mesh.position.x += p.vx * dt;
        p.mesh.position.y += p.vy * dt;
        p.mesh.position.z += p.vz * dt;

        // Bounce off fairway surface
        if (p.gravity > 0 && p.mesh.position.y < 0.2) {
          p.mesh.position.y = 0.2;
          p.vy = Math.abs(p.vy) * 0.45;
          p.vx *= 0.78;
          p.vz *= 0.78;
        }

        p.mesh.rotation.x += p.spinSpeed * dt;
        p.mesh.rotation.y += p.spinSpeed * dt;

        const lifeRatio = p.age / p.maxLife;
        const scaleCurve = lifeRatio < 0.2 ? lifeRatio / 0.2 : 1 - (lifeRatio - 0.2) / 0.8;
        p.mesh.scale.setScalar(Math.max(0.01, p.initialScale * scaleCurve));
        p.mat.opacity = Math.max(0, 1 - lifeRatio * lifeRatio);
      }

      for (let i = 0; i < shockwavePool.length; i++) {
        const sw = shockwavePool[i];
        if (!sw.active) continue;
        sw.age += dt;
        if (sw.age >= sw.maxLife) {
          sw.active = false;
          sw.mesh.visible = false;
          continue;
        }
        const t = sw.age / sw.maxLife;
        const easeOut = 1 - Math.pow(1 - t, 2.2);
        sw.mesh.scale.setScalar(0.35 + (sw.maxScale - 0.35) * easeOut);
        sw.mat.opacity = Math.max(0, (1 - t) * 0.85);
      }
    }

    interface KoiActor {
      group: THREE.Group;
      centerX: number;
      centerZ: number;
      radiusX: number;
      radiusZ: number;
      speed: number;
      phase: number;
    }

    let movingBlockMeshes: { mesh: THREE.Group; index: number }[] = [];
    let bumperMeshes: THREE.Group[] = [];
    let koiActors: KoiActor[] = [];
    let hangingLanternMeshes: THREE.Group[] = [];
    let flagPennantMesh: THREE.Mesh | null = null;
    let activeFlagGeo: THREE.BufferGeometry | null = null;
    let activeFlagBasePos: Float32Array | null = null;
    let activeFlagU: Float32Array | null = null;
    let currentWalls = computeCourseWalls(stateRef.current.course);
    let disposableCourseGeos: THREE.BufferGeometry[] = [];
    let disposableCourseMats: THREE.Material[] = [];
    let activeNatureGroup: THREE.Group | null = null;
    let activeWindmillInstance: WindmillInstance | null = null;
    let isHoleFinishedReporting = false;
    let syncTimer = 0;

    const initMpTees = getMultiplayerTeePositions(stateRef.current.course);
    const physicsState: BallPhysicsState = {
      x: stateRef.current.course.start[0],
      z: stateRef.current.course.start[1],
      vx: 0,
      vz: 0,
      isMoving: false,
      isSunk: false,
      sinkProgress: 0,
    };

    const physicsState2: BallPhysicsState = {
      x: initMpTees.p2[0],
      z: initMpTees.p2[1],
      vx: 0,
      vz: 0,
      isMoving: false,
      isSunk: false,
      sinkProgress: 0,
    };

    let isBall1OnTee = true;
    let ball1TeeDropTimer = 0;
    let isBall2OnTee = true;
    let ball2TeeDropTimer = 0;
    const teeElevation = getTeeCupElevation();

    // Helper: Build Upgraded Composite Trees (Faceted Oak or Tiered Pine + Base Bushes/Flowers)
    function createStylizedTree(scale: number, seed: number): THREE.Group {
      const tree = new THREE.Group();
      const isPine = seed % 3 === 1;

      const trunk = new THREE.Mesh(sharedGeos.treeTrunk, sharedMats.trunk);
      trunk.castShadow = !isSoftwareGl;
      trunk.receiveShadow = !isSoftwareGl;
      tree.add(trunk);

      const root = new THREE.Mesh(sharedGeos.treeRoot, sharedMats.trunk);
      tree.add(root);

      if (isPine) {
        // 3-Tiered Stylized Alpine Pine
        const t1 = new THREE.Mesh(sharedGeos.pineTier1, sharedMats.canopy3);
        t1.position.set(0, 0.65, 0);
        t1.rotation.y = seed * 0.5;
        t1.castShadow = !isSoftwareGl;
        t1.receiveShadow = !isSoftwareGl;
        tree.add(t1);

        const t2 = new THREE.Mesh(sharedGeos.pineTier2, sharedMats.canopy1);
        t2.position.set(0, 1.18, 0);
        t2.rotation.y = seed * 0.9 + 0.4;
        t2.castShadow = !isSoftwareGl;
        tree.add(t2);

        const t3 = new THREE.Mesh(sharedGeos.pineTier3, sharedMats.canopy2);
        t3.position.set(0, 1.65, 0);
        t3.rotation.y = seed * 1.3;
        t3.castShadow = !isSoftwareGl;
        tree.add(t3);
      } else {
        // 3-Cluster Faceted Meadow Oak
        const cMats = [sharedMats.canopy1, sharedMats.canopy2, sharedMats.canopy3];
        const mainCanopy = new THREE.Mesh(sharedGeos.oakCrownMain, cMats[seed % 3]);
        mainCanopy.position.set(0, 1.34, 0);
        mainCanopy.rotation.set(seed * 0.4, seed * 0.9, 0);
        mainCanopy.castShadow = !isSoftwareGl;
        mainCanopy.receiveShadow = !isSoftwareGl;
        tree.add(mainCanopy);

        const topCanopy = new THREE.Mesh(sharedGeos.oakCrownTop, sharedMats.canopy2);
        topCanopy.position.set(0.18, 1.82, -0.12);
        topCanopy.rotation.set(0.3, seed * 1.2, 0.2);
        topCanopy.castShadow = !isSoftwareGl;
        tree.add(topCanopy);

        const sideCanopy = new THREE.Mesh(sharedGeos.oakCrownSide, sharedMats.canopy3);
        sideCanopy.position.set(-0.32, 1.16, 0.22);
        sideCanopy.castShadow = !isSoftwareGl;
        tree.add(sideCanopy);
      }

      // Base Bush & Wildflower Accent at root collar
      if (seed % 2 === 0) {
        const bush = new THREE.Mesh(sharedGeos.bush, sharedMats.canopy2);
        bush.position.set(0.32, 0.16, 0.22);
        bush.scale.set(1.1, 0.75, 1.0);
        tree.add(bush);

        const flower = new THREE.Mesh(
          sharedGeos.flower,
          seed % 4 === 0 ? sharedMats.flowerYellow : sharedMats.flowerPink
        );
        flower.position.set(0.38, 0.34, 0.26);
        tree.add(flower);
      }

      tree.scale.setScalar(scale);
      return tree;
    }

    // Helper: Blooming Pink Cherry Blossom Tree (Sakura / Mei Hua) for Chinese Garden Level 1
    function createSakuraTree(scale: number, seed: number): THREE.Group {
      const tree = new THREE.Group();

      const trunk = new THREE.Mesh(sharedGeos.treeTrunk, sharedMats.sakuraTrunk);
      trunk.rotation.z = (seed % 2 === 0 ? 1 : -1) * 0.06;
      trunk.castShadow = !isSoftwareGl;
      trunk.receiveShadow = !isSoftwareGl;
      tree.add(trunk);

      const root = new THREE.Mesh(sharedGeos.treeRoot, sharedMats.sakuraTrunk);
      tree.add(root);

      const blossomMats = [sharedMats.sakuraPink1, sharedMats.sakuraPink2, sharedMats.sakuraPink3];

      const mainCrown = new THREE.Mesh(sharedGeos.oakCrownMain, blossomMats[seed % 3]);
      mainCrown.position.set(0, 1.32, 0);
      mainCrown.scale.set(1.18, 0.88, 1.15);
      mainCrown.rotation.set(seed * 0.3, seed * 0.8, 0);
      mainCrown.castShadow = !isSoftwareGl;
      mainCrown.receiveShadow = !isSoftwareGl;
      tree.add(mainCrown);

      const topCrown = new THREE.Mesh(sharedGeos.oakCrownTop, sharedMats.sakuraPink3);
      topCrown.position.set(0.22, 1.76, -0.14);
      topCrown.scale.set(1.15, 0.85, 1.12);
      topCrown.castShadow = !isSoftwareGl;
      tree.add(topCrown);

      const leftCrown = new THREE.Mesh(sharedGeos.oakCrownSide, sharedMats.sakuraPink1);
      leftCrown.position.set(-0.46, 1.18, 0.22);
      leftCrown.scale.set(1.15, 0.82, 1.1);
      leftCrown.castShadow = !isSoftwareGl;
      tree.add(leftCrown);

      const rightCrown = new THREE.Mesh(sharedGeos.oakCrownSide, sharedMats.sakuraPink2);
      rightCrown.position.set(0.44, 1.12, 0.28);
      rightCrown.scale.set(1.05, 0.8, 1.05);
      rightCrown.castShadow = !isSoftwareGl;
      tree.add(rightCrown);

      // Fallen pink blossom petals & mossy rock at base
      const baseRock = new THREE.Mesh(sharedGeos.bush, sharedMats.cliffRock);
      baseRock.position.set(-0.28, 0.12, 0.24);
      baseRock.scale.set(0.95, 0.55, 0.85);
      tree.add(baseRock);

      for (let p = 0; p < 3; p++) {
        const petal = new THREE.Mesh(sharedGeos.flower, blossomMats[p % 3]);
        const ang = p * 2.1 + seed;
        petal.position.set(Math.cos(ang) * 0.44, 0.04, Math.sin(ang) * 0.44);
        petal.scale.set(1.1, 0.35, 1.1);
        tree.add(petal);
      }

      tree.scale.setScalar(scale);
      return tree;
    }

    // Helper: Segmented Green Bamboo Grove Cluster (Matches Reference Image 2)
    function createBambooCluster(scale: number, seed: number): THREE.Group {
      const group = new THREE.Group();
      const stalkConfigs = [
        [0, 0, 1.0, 0.04, 0.02],
        [-0.16, 0.1, 0.86, -0.06, 0.04],
        [0.16, 0.08, 0.92, 0.05, -0.05],
        [-0.08, -0.15, 0.78, -0.04, -0.06],
        [0.12, -0.12, 0.68, 0.07, 0.03],
      ];

      stalkConfigs.forEach(([ox, oz, hScale, rx, rz], idx) => {
        const stalkGroup = new THREE.Group();
        stalkGroup.position.set(ox, 0, oz);
        stalkGroup.rotation.set(rx, seed + idx * 0.7, rz);
        stalkGroup.scale.set(1, hScale, 1);

        const stalk = new THREE.Mesh(sharedGeos.bambooStalk, sharedMats.bambooGreen);
        stalk.castShadow = !isSoftwareGl;
        stalkGroup.add(stalk);

        // Bamboo node rings
        [0.36, 0.74, 1.12].forEach((ny) => {
          const node = new THREE.Mesh(sharedGeos.bambooNode, sharedMats.bambooDark);
          node.position.y = ny;
          stalkGroup.add(node);
        });

        // Leafy top tuft
        const leafCrown = new THREE.Mesh(sharedGeos.bush, sharedMats.canopy2);
        leafCrown.position.set(0, 1.46, 0);
        leafCrown.scale.set(0.85, 0.52, 0.85);
        stalkGroup.add(leafCrown);

        group.add(stalkGroup);
      });

      // Base stones around bamboo
      const stone = new THREE.Mesh(sharedGeos.bush, sharedMats.carvedStone);
      stone.position.set(0.14, 0.08, 0.16);
      stone.scale.set(0.75, 0.45, 0.65);
      group.add(stone);

      group.scale.setScalar(scale);
      return group;
    }

    // Helper: Hanging Red Silk Chinese Lantern with Gold Caps & Tassel
    function createHangingRedLantern(scale = 1.0): THREE.Group {
      const lantern = new THREE.Group();

      const body = new THREE.Mesh(sharedGeos.lanternBody, sharedMats.lanternGlow);
      body.scale.set(1.0, 0.86, 1.0);
      lantern.add(body);

      const topCap = new THREE.Mesh(sharedGeos.lanternCap, sharedMats.goldAccent);
      topCap.position.y = 0.135;
      lantern.add(topCap);

      const botCap = new THREE.Mesh(sharedGeos.lanternCap, sharedMats.goldAccent);
      botCap.position.y = -0.135;
      lantern.add(botCap);

      const tasselGeo = new THREE.CylinderGeometry(0.018, 0.032, 0.14, 6);
      disposableCourseGeos.push(tasselGeo);
      const tassel = new THREE.Mesh(tasselGeo, sharedMats.goldAccent);
      tassel.position.y = -0.22;
      lantern.add(tassel);

      lantern.scale.setScalar(scale);
      hangingLanternMeshes.push(lantern);
      return lantern;
    }

    // Helper: Carved Stone Pagoda Garden Lantern (Matches Reference Image 2)
    function createStonePagodaLantern(scale = 1.0): THREE.Group {
      const pagoda = new THREE.Group();

      const baseGeo = new THREE.CylinderGeometry(0.18, 0.24, 0.12, 6);
      baseGeo.translate(0, 0.06, 0);
      const postGeo = new THREE.CylinderGeometry(0.09, 0.12, 0.36, 6);
      postGeo.translate(0, 0.28, 0);
      const platformGeo = new THREE.CylinderGeometry(0.19, 0.15, 0.07, 6);
      platformGeo.translate(0, 0.48, 0);
      const lightBoxGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.2, 6);
      lightBoxGeo.translate(0, 0.6, 0);
      const roofGeo = new THREE.ConeGeometry(0.32, 0.22, 6);
      roofGeo.translate(0, 0.79, 0);
      const spireGeo = new THREE.ConeGeometry(0.05, 0.14, 6);
      spireGeo.translate(0, 0.95, 0);
      disposableCourseGeos.push(baseGeo, postGeo, platformGeo, lightBoxGeo, roofGeo, spireGeo);

      const baseMesh = new THREE.Mesh(baseGeo, sharedMats.marbleCream);
      const postMesh = new THREE.Mesh(postGeo, sharedMats.marbleCream);
      const platformMesh = new THREE.Mesh(platformGeo, sharedMats.marbleCream);
      const lightBoxMesh = new THREE.Mesh(lightBoxGeo, sharedMats.warmCandleGlow);
      const roofMesh = new THREE.Mesh(roofGeo, sharedMats.vermilionRed);
      roofMesh.castShadow = !isSoftwareGl;
      const spireMesh = new THREE.Mesh(spireGeo, sharedMats.goldAccent);

      pagoda.add(baseMesh, postMesh, platformMesh, lightBoxMesh, roofMesh, spireMesh);
      pagoda.scale.setScalar(scale);
      return pagoda;
    }

    // Helper: 3D Chinese Imperial Pavilion (Ting) with Swept Blue Glazed Tile Roof (Matches Reference Image 2)
    function createChinesePavilion(): THREE.Group {
      const pavilion = new THREE.Group();

      // 1. White Carved Stone Plinth Foundation & Teak Wood Deck
      const stoneBaseGeo = new THREE.BoxGeometry(2.85, 0.22, 2.85);
      stoneBaseGeo.translate(0, 0.11, 0);
      const woodDeckGeo = new THREE.BoxGeometry(2.65, 0.1, 2.65);
      woodDeckGeo.translate(0, 0.26, 0);
      disposableCourseGeos.push(stoneBaseGeo, woodDeckGeo);

      const stoneBase = new THREE.Mesh(stoneBaseGeo, sharedMats.marbleCream);
      stoneBase.receiveShadow = !isSoftwareGl;
      stoneBase.castShadow = !isSoftwareGl;
      const woodDeck = new THREE.Mesh(woodDeckGeo, sharedMats.teakWood);
      woodDeck.receiveShadow = !isSoftwareGl;
      pavilion.add(stoneBase, woodDeck);

      // Front Wooden Steps facing the golf course (+X direction)
      for (let s = 0; s < 3; s++) {
        const stepGeo = new THREE.BoxGeometry(0.24, 0.08, 0.92);
        disposableCourseGeos.push(stepGeo);
        const stepMesh = new THREE.Mesh(stepGeo, sharedMats.teakWood);
        stepMesh.position.set(1.42 + s * 0.18, 0.22 - s * 0.07, 0);
        pavilion.add(stepMesh);
      }

      // 2. Four Vermilion-Red Columns on Carved Stone Drum Bases + Perimeter Railings
      const colOffset = 1.05;
      const colPositions = [
        [-colOffset, -colOffset],
        [colOffset, -colOffset],
        [-colOffset, colOffset],
        [colOffset, colOffset],
      ];

      const drumGeo = new THREE.CylinderGeometry(0.16, 0.19, 0.12, 12);
      drumGeo.translate(0, 0.36, 0);
      const columnGeo = new THREE.CylinderGeometry(0.11, 0.125, 1.55, 12);
      columnGeo.translate(0, 1.15, 0);
      disposableCourseGeos.push(drumGeo, columnGeo);

      colPositions.forEach(([cx, cz]) => {
        const drum = new THREE.Mesh(drumGeo, sharedMats.marbleCream);
        drum.position.set(cx, 0, cz);
        const col = new THREE.Mesh(columnGeo, sharedMats.vermilionRed);
        col.position.set(cx, 0, cz);
        col.castShadow = !isSoftwareGl;
        pavilion.add(drum, col);
      });

      // Vermilion-Red Courtyard Perimeter Railings (on N, S, W sides, leaving East open for stairs)
      const railSides = [
        [0, -colOffset, 2.1, 0.07],
        [0, colOffset, 2.1, 0.07],
        [-colOffset, 0, 0.07, 2.1],
      ];
      railSides.forEach(([rx, rz, rw, rd]) => {
        const topRailGeo = new THREE.BoxGeometry(rw, 0.06, rd);
        const botRailGeo = new THREE.BoxGeometry(rw, 0.08, rd);
        disposableCourseGeos.push(topRailGeo, botRailGeo);
        const topRail = new THREE.Mesh(topRailGeo, sharedMats.vermilionRed);
        topRail.position.set(rx, 0.68, rz);
        const botRail = new THREE.Mesh(botRailGeo, sharedMats.marbleCream);
        botRail.position.set(rx, 0.42, rz);
        pavilion.add(topRail, botRail);
      });

      // Decorative Lattice Back Screen Wall with Golden Moon Window (Matches Reference Image 2)
      const screenWallGeo = new THREE.BoxGeometry(0.1, 1.38, 1.96);
      screenWallGeo.translate(-colOffset, 1.08, 0);
      const moonWindowGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.14, 16);
      moonWindowGeo.rotateZ(Math.PI / 2);
      moonWindowGeo.translate(-colOffset, 1.15, 0);
      disposableCourseGeos.push(screenWallGeo, moonWindowGeo);

      const screenWall = new THREE.Mesh(screenWallGeo, sharedMats.marbleCream);
      const moonWindow = new THREE.Mesh(moonWindowGeo, sharedMats.goldAccent);
      pavilion.add(screenWall, moonWindow);

      // 3. Double-Tiered Swept Imperial Blue-Teal Glazed Roof (Matches Reference Image 2)
      const beamFrameGeo = new THREE.BoxGeometry(2.38, 0.18, 2.38);
      beamFrameGeo.translate(0, 1.88, 0);
      const lowerEaveSkirtGeo = new THREE.CylinderGeometry(1.48, 2.36, 0.36, 4);
      lowerEaveSkirtGeo.rotateY(Math.PI / 4);
      lowerEaveSkirtGeo.translate(0, 2.12, 0);
      const lowerRoofUpperGeo = new THREE.CylinderGeometry(0.95, 1.52, 0.38, 4);
      lowerRoofUpperGeo.rotateY(Math.PI / 4);
      lowerRoofUpperGeo.translate(0, 2.46, 0);

      const upperNeckGeo = new THREE.BoxGeometry(1.22, 0.24, 1.22);
      upperNeckGeo.translate(0, 2.72, 0);
      const upperEaveSkirtGeo = new THREE.CylinderGeometry(0.76, 1.72, 0.34, 4);
      upperEaveSkirtGeo.rotateY(Math.PI / 4);
      upperEaveSkirtGeo.translate(0, 2.96, 0);
      const upperRoofPeakGeo = new THREE.ConeGeometry(0.82, 0.52, 4);
      upperRoofPeakGeo.rotateY(Math.PI / 4);
      upperRoofPeakGeo.translate(0, 3.36, 0);
      disposableCourseGeos.push(
        beamFrameGeo,
        lowerEaveSkirtGeo,
        lowerRoofUpperGeo,
        upperNeckGeo,
        upperEaveSkirtGeo,
        upperRoofPeakGeo
      );

      const beamFrame = new THREE.Mesh(beamFrameGeo, sharedMats.vermilionRed);
      const lowerEaveSkirt = new THREE.Mesh(lowerEaveSkirtGeo, sharedMats.glazedRoofBlue);
      lowerEaveSkirt.castShadow = !isSoftwareGl;
      const lowerRoofUpper = new THREE.Mesh(lowerRoofUpperGeo, sharedMats.glazedRoofDark);
      const upperNeck = new THREE.Mesh(upperNeckGeo, sharedMats.vermilionRed);
      const upperEaveSkirt = new THREE.Mesh(upperEaveSkirtGeo, sharedMats.glazedRoofBlue);
      upperEaveSkirt.castShadow = !isSoftwareGl;
      const upperRoofPeak = new THREE.Mesh(upperRoofPeakGeo, sharedMats.glazedRoofDark);
      upperRoofPeak.castShadow = !isSoftwareGl;

      pavilion.add(beamFrame, lowerEaveSkirt, lowerRoofUpper, upperNeck, upperEaveSkirt, upperRoofPeak);

      // Upturned Vermilion & Gold Flying Eave Horns on Roof Corners
      const hornGeo = new THREE.ConeGeometry(0.09, 0.36, 6);
      disposableCourseGeos.push(hornGeo);
      colPositions.forEach(([cx, cz]) => {
        const sx = Math.sign(cx);
        const sz = Math.sign(cz);
        const horn = new THREE.Mesh(hornGeo, sharedMats.vermilionRed);
        horn.position.set(sx * 1.66, 2.04, sz * 1.66);
        horn.rotation.set(-sz * 0.65, 0, sx * 0.65);
        pavilion.add(horn);

        // Hang a glowing red silk lantern under each of the 4 lower roof corners!
        const lantern = createHangingRedLantern(0.88);
        lantern.position.set(sx * 1.48, 1.72, sz * 1.48);
        pavilion.add(lantern);
      });

      // Multi-Tiered Golden Pagoda Roof Spire Finial at Apex (Matches Reference Image 2)
      const spireBaseGeo = new THREE.SphereGeometry(0.13, 12, 12);
      spireBaseGeo.translate(0, 3.64, 0);
      const spireConeGeo = new THREE.ConeGeometry(0.08, 0.42, 8);
      spireConeGeo.translate(0, 3.92, 0);
      disposableCourseGeos.push(spireBaseGeo, spireConeGeo);

      const spireBase = new THREE.Mesh(spireBaseGeo, sharedMats.goldAccent);
      const spireCone = new THREE.Mesh(spireConeGeo, sharedMats.goldAccent);
      pavilion.add(spireBase, spireCone);

      return pavilion;
    }

    // Helper: Turquoise Koi Pond with Arched Red Wooden Bridge, Lotus Pads & Animated Koi Fish (Matches Reference Image 1)
    function createKoiPondAndBridge(pondX: number, pondZ: number): THREE.Group {
      const pondGroup = new THREE.Group();
      pondGroup.position.set(pondX, 0, pondZ);

      // 1. Double-Lobe Turquoise Water Surface raised slightly above island lawn (y = 0.015)
      const northLobeGeo = new THREE.CylinderGeometry(1.55, 1.55, 0.03, 24);
      const southLobeGeo = new THREE.CylinderGeometry(1.68, 1.68, 0.03, 24);
      const waistGeo = new THREE.BoxGeometry(1.75, 0.03, 1.6);
      disposableCourseGeos.push(northLobeGeo, southLobeGeo, waistGeo);

      const northWater = new THREE.Mesh(northLobeGeo, sharedMats.pondWater);
      northWater.position.set(-0.15, 0.012, -1.35);
      northWater.scale.set(1.05, 1, 1.18);

      const southWater = new THREE.Mesh(southLobeGeo, sharedMats.pondWater);
      southWater.position.set(0.15, 0.012, 1.35);
      southWater.scale.set(1.08, 1, 1.18);

      const waistWater = new THREE.Mesh(waistGeo, sharedMats.pondWater);
      waistWater.position.set(0, 0.012, 0);

      pondGroup.add(northWater, southWater, waistWater);

      // 2. Mossy River Stones & Taihu Scholar Rocks along Pond Shoreline
      const bankStones = [
        [-1.35, -2.3, 0.65, 0.42, 0.55],
        [0.95, -2.55, 0.85, 0.65, 0.7],
        [1.38, -1.4, 0.72, 0.45, 0.62],
        [-1.52, -0.95, 0.6, 0.38, 0.52],
        [-1.25, 1.85, 0.78, 0.48, 0.65],
        [1.48, 1.65, 0.92, 0.75, 0.8],
        [0.45, 2.75, 0.68, 0.42, 0.58],
        [-0.75, 2.65, 0.62, 0.38, 0.54],
      ];
      bankStones.forEach(([sx, sz, scX, scY, scZ], idx) => {
        const rock = new THREE.Mesh(
          sharedGeos.cliffRock,
          idx % 3 === 0 ? sharedMats.carvedStone : sharedMats.cliffRock
        );
        rock.position.set(sx, 0.08, sz);
        rock.scale.set(scX, scY, scZ);
        rock.rotation.set(idx * 0.4, idx * 1.1, 0.2);
        rock.castShadow = !isSoftwareGl;
        pondGroup.add(rock);
      });

      // 3. Floating Green Lily Pads & Pink Lotus Flowers
      const lilyPositions = [
        [-0.55, -1.75, 1.0, true],
        [0.48, -1.95, 0.82, false],
        [-0.35, 1.85, 1.08, true],
        [0.72, 1.45, 0.88, true],
        [0.12, 2.15, 0.76, false],
      ] as const;

      lilyPositions.forEach(([lx, lz, lScale, hasLotus]) => {
        const pad = new THREE.Mesh(sharedGeos.lilyPad, sharedMats.lilyPadMat);
        pad.position.set(lx, 0.032, lz);
        pad.scale.setScalar(lScale);
        pondGroup.add(pad);

        if (hasLotus) {
          const lotus = new THREE.Mesh(sharedGeos.flower, sharedMats.sakuraPink1);
          lotus.position.set(lx, 0.08, lz);
          lotus.scale.set(1.25, 0.85, 1.25);
          pondGroup.add(lotus);
        }
      });

      // 4. Animated Swimming Koi Fish (Orange/White & Gold Koi)
      const koiBodyGeo = new THREE.ConeGeometry(0.085, 0.34, 8);
      koiBodyGeo.rotateX(Math.PI / 2);
      const koiTailGeo = new THREE.ConeGeometry(0.065, 0.14, 4);
      koiTailGeo.rotateX(-Math.PI / 2);
      koiTailGeo.translate(0, 0, -0.2);
      disposableCourseGeos.push(koiBodyGeo, koiTailGeo);

      const koiConfigs = [
        { cx: -0.15, cz: -1.45, rx: 0.62, rz: 0.48, speed: 1.15, phase: 0.2, mat: sharedMats.koiOrange },
        { cx: 0.1, cz: -1.25, rx: 0.45, rz: 0.55, speed: -0.95, phase: 2.4, mat: sharedMats.whiteGloss },
        { cx: 0.12, cz: 1.35, rx: 0.68, rz: 0.52, speed: 1.08, phase: 1.1, mat: sharedMats.koiOrange },
        { cx: -0.1, cz: 1.55, rx: 0.48, rz: 0.42, speed: -1.25, phase: 3.8, mat: sharedMats.goldAccent },
      ];

      koiConfigs.forEach((cfg) => {
        const fishGroup = new THREE.Group();
        const body = new THREE.Mesh(koiBodyGeo, cfg.mat);
        body.scale.set(1, 0.55, 1);
        const tail = new THREE.Mesh(koiTailGeo, sharedMats.vermilionRed);
        tail.scale.set(0.6, 1, 1);
        fishGroup.add(body, tail);
        fishGroup.position.set(cfg.cx, 0.028, cfg.cz);
        pondGroup.add(fishGroup);

        koiActors.push({
          group: fishGroup,
          centerX: cfg.cx,
          centerZ: cfg.cz,
          radiusX: cfg.rx,
          radiusZ: cfg.rz,
          speed: cfg.speed,
          phase: cfg.phase,
        });
      });

      // 5. Arched Red Wooden Bridge Spanning the Koi Pond Waist (Matches Reference Image 1)
      const bridgeGroup = new THREE.Group();
      bridgeGroup.position.set(0, 0.02, 0);
      bridgeGroup.rotation.y = 0.12;

      const numPlanks = 11;
      const bridgeSpanX = 2.15;
      const bridgeWidthZ = 1.08;

      for (let i = 0; i < numPlanks; i++) {
        const t = i / (numPlanks - 1) - 0.5; // -0.5 .. +0.5
        const px = t * bridgeSpanX;
        const archY = Math.cos(t * Math.PI) * 0.34;
        const slopeAngle = Math.sin(t * Math.PI) * 0.42;

        const plankGeo = new THREE.BoxGeometry(0.19, 0.055, bridgeWidthZ);
        disposableCourseGeos.push(plankGeo);
        const plank = new THREE.Mesh(plankGeo, i % 2 === 0 ? sharedMats.vermilionRed : sharedMats.teakWood);
        plank.position.set(px, archY, 0);
        plank.rotation.z = -slopeAngle;
        plank.castShadow = !isSoftwareGl;
        bridgeGroup.add(plank);
      }

      // Bridge Posts & Curved Vermilion Handrails on Both Sides
      const postTValues = [-0.46, -0.16, 0.16, 0.46];
      const railPostGeo = new THREE.CylinderGeometry(0.045, 0.05, 0.44, 8);
      railPostGeo.translate(0, 0.22, 0);
      const postCapGeo = new THREE.SphereGeometry(0.062, 8, 8);
      postCapGeo.translate(0, 0.46, 0);
      disposableCourseGeos.push(railPostGeo, postCapGeo);

      [-bridgeWidthZ * 0.46, bridgeWidthZ * 0.46].forEach((sideZ) => {
        postTValues.forEach((pt) => {
          const px = pt * bridgeSpanX;
          const archY = Math.cos(pt * Math.PI) * 0.34;

          const post = new THREE.Mesh(railPostGeo, sharedMats.vermilionRed);
          post.position.set(px, archY, sideZ);
          post.castShadow = !isSoftwareGl;

          const cap = new THREE.Mesh(postCapGeo, sharedMats.goldAccent);
          cap.position.set(px, archY, sideZ);
          bridgeGroup.add(post, cap);
        });

        // Segmented handrail bars connecting the posts
        for (let s = 0; s < postTValues.length - 1; s++) {
          const t1 = postTValues[s];
          const t2 = postTValues[s + 1];
          const x1 = t1 * bridgeSpanX;
          const y1 = Math.cos(t1 * Math.PI) * 0.34 + 0.36;
          const x2 = t2 * bridgeSpanX;
          const y2 = Math.cos(t2 * Math.PI) * 0.34 + 0.36;

          const segLen = Math.hypot(x2 - x1, y2 - y1);
          const barGeo = new THREE.BoxGeometry(segLen + 0.04, 0.05, 0.05);
          disposableCourseGeos.push(barGeo);
          const bar = new THREE.Mesh(barGeo, sharedMats.vermilionRed);
          bar.position.set((x1 + x2) / 2, (y1 + y2) / 2, sideZ);
          bar.rotation.z = Math.atan2(y2 - y1, x2 - x1);
          bridgeGroup.add(bar);
        }
      });

      pondGroup.add(bridgeGroup);
      return pondGroup;
    }

    // Helper: Festive Catenary String of Red Chinese Lanterns Between Garden Posts (Matches Reference Image 1)
    function createFestiveLanternString(
      x1: number,
      y1: number,
      z1: number,
      x2: number,
      y2: number,
      z2: number,
      numLanterns: number,
      addEndPost = true
    ): THREE.Group {
      const stringGroup = new THREE.Group();

      if (addEndPost) {
        const postGeo = new THREE.CylinderGeometry(0.05, 0.065, y2, 8);
        postGeo.translate(x2, y2 / 2, z2);
        disposableCourseGeos.push(postGeo);
        const postMesh = new THREE.Mesh(postGeo, sharedMats.sakuraTrunk);
        postMesh.castShadow = !isSoftwareGl;
        stringGroup.add(postMesh);
      }

      const sag = 0.42;
      for (let i = 1; i <= numLanterns; i++) {
        const t = i / (numLanterns + 1);
        const lx = THREE.MathUtils.lerp(x1, x2, t);
        const lz = THREE.MathUtils.lerp(z1, z2, t);
        const ly = THREE.MathUtils.lerp(y1, y2, t) - Math.sin(t * Math.PI) * sag;

        const lantern = createHangingRedLantern(0.76);
        lantern.position.set(lx, ly, lz);
        stringGroup.add(lantern);
      }

      return stringGroup;
    }

    // Helper: Populate Natural Diorama Landscape Vignettes Framing the Course
    function populateNatureDecor(
      container: THREE.Group,
      course: HoleCourse,
      bounds: { minX: number; maxX: number; minZ: number; maxZ: number; centerX: number; centerZ: number; width: number; depth: number },
      isPlay: boolean
    ) {
      while (container.children.length > 0) {
        container.remove(container.children[0]);
      }
      activeWindmillInstance = null;

      // Chinese Garden has its own dedicated handcrafted Sakura trees, bamboo, koi pond and red lanterns
      if (course.theme === 'chinese-garden') {
        return;
      }

      const islandW = Math.max(14.0, bounds.width + 7.6);
      const islandD = Math.max(15.0, bounds.depth + 7.6);

      // Deterministic PRNG seeded per course so each hole has a unique, consistent layout
      const holeSeed = course.holeNumber * 7919 + course.worldIndex * 313 + 1337;
      let prngState = Math.abs(holeSeed) || 1234567;
      function prng() {
        prngState = (prngState * 1664525 + 1013904223) % 4294967296;
        return prngState / 4294967296;
      }

      // Safe clearance verification for any anchor point:
      // 1. Within island grass rough boundaries
      // 2. Far enough from every fairway cell center (>= 4.0m, so trunk is >= 2.3m away from wall)
      // 3. Clear of the tee-off box (>= 5.2m from course.start)
      // 4. Clear of camera foreground (if tee is at +Z, forbid placing large props south of the tee towards the camera)
      // 5. Clear of cup (>= 3.6m from course.hole)
      function isPositionSafe(wx: number, wz: number, minFairwayDist = 4.0): boolean {
        // Boundary within island turf
        const maxInnerX = isPlay ? islandW * 0.48 : islandW * 0.45;
        const maxInnerZ = isPlay ? islandD * 0.48 : islandD * 0.45;
        if (Math.abs(wx - bounds.centerX) > maxInnerX) return false;
        if (Math.abs(wz - bounds.centerZ) > maxInnerZ) return false;

        // Clearance from fairway cell centers (>= 4.0m so trunk is >= 2.3m from wall)
        for (const [c, r] of course.cells) {
          const cx = c * CELL_SIZE;
          const cz = r * CELL_SIZE;
          if (Math.hypot(wx - cx, wz - cz) < minFairwayDist) return false;
        }

        // TEE BOX CLEARANCE: Keep tee box area and shot perspective completely open
        const distToStart = Math.hypot(wx - course.start[0], wz - course.start[1]);
        if (distToStart < 5.2) return false;

        // Camera foreground protection: if tee is in south half, forbid placing objects south of tee towards camera
        const teeZ = course.start[1];
        if (teeZ > bounds.centerZ && wz > teeZ - 0.5 && Math.abs(wx - course.start[0]) < 4.5) {
          return false;
        }

        // Cup clearance: never obstruct cup
        if (Math.hypot(wx - course.hole[0], wz - course.hole[1]) < 3.6) return false;

        return true;
      }

      // Helper to spawn a stylized tree (uses GLTF nature asset with geometry fallback)
      function spawnTree(wx: number, wz: number, type: 'oak' | 'pine' | 'birch' | 'autumn', scale: number, seedOffset = 0) {
        let treeMesh = natureAssets.createTree(course.worldIndex, holeSeed + seedOffset, scale, !isSoftwareGl, type);
        if (!treeMesh) {
          treeMesh = createStylizedTree(scale, holeSeed + seedOffset);
        }
        if (treeMesh) {
          treeMesh.position.set(wx, 0.0, wz);
          treeMesh.rotation.y = prng() * Math.PI * 2;
          container.add(treeMesh);
        }
        return treeMesh;
      }

      // Helper to choose tree species based on world theme
      function pickThemeTreeType(): 'oak' | 'pine' | 'birch' | 'autumn' {
        const roll = prng();
        switch (course.worldIndex) {
          case 1: // Pine Valley: Evergreen Pines and Birch
            return roll < 0.65 ? 'pine' : roll < 0.88 ? 'birch' : 'oak';
          case 2: // Golden Dunes: Warm Autumn and Birch
            return roll < 0.60 ? 'autumn' : roll < 0.88 ? 'birch' : 'pine';
          case 3: // Emerald Ridge: Birch and Pine
            return roll < 0.60 ? 'birch' : roll < 0.88 ? 'pine' : 'oak';
          case 4: // Starlight Champions: Pine and Autumn
            return roll < 0.55 ? 'pine' : roll < 0.85 ? 'autumn' : 'birch';
          case 0: // Sunny Meadow: Stylized Oaks and Birch
          default:
            return roll < 0.60 ? 'oak' : roll < 0.85 ? 'birch' : 'pine';
        }
      }

      // Calibrated stylized tree scale: keeps Oak and Autumn canopies neat and non-obstructive
      function getTreeScale(type: 'oak' | 'pine' | 'birch' | 'autumn', isSapling = false): number {
        if (isSapling) return 0.24 + prng() * 0.04;
        if (type === 'oak' || type === 'autumn') {
          return 0.33 + prng() * 0.05; // 0.33 to 0.38
        }
        return 0.36 + prng() * 0.06; // 0.36 to 0.42
      }

      // Helper to add organic ground accents (small rock + low bush) at an object base
      function addBaseAccents(baseX: number, baseZ: number, seedOffset = 0, addRock = true, addBush = true) {
        if (addRock) {
          const rock = natureAssets.createRock('small', holeSeed + seedOffset + 11, 0.30, !isSoftwareGl);
          if (rock) {
            const ang = prng() * Math.PI * 2;
            rock.position.set(baseX + Math.cos(ang) * 0.42, 0.0, baseZ + Math.sin(ang) * 0.42);
            rock.rotation.y = prng() * Math.PI * 2;
            container.add(rock);
          }
        }
        if (addBush) {
          const bush = natureAssets.createBush(holeSeed + seedOffset + 17, 0.26, !isSoftwareGl);
          if (bush) {
            const ang = prng() * Math.PI * 2;
            bush.position.set(baseX + Math.cos(ang) * 0.46, 0.0, baseZ + Math.sin(ang) * 0.46);
            container.add(bush);
          }
        }
      }

      interface ZoneDef {
        id: string;
        x: number;
        z: number;
        isWest: boolean;
      }

      // Generate structured candidate zones framing the course
      const candidateZones: ZoneDef[] = [
        // North-West (Top-Left Background)
        { id: 'NW', x: bounds.minX - 3.4, z: bounds.minZ - 1.2, isWest: true },
        // North-East (Top-Right Background)
        { id: 'NE', x: bounds.maxX + 3.4, z: bounds.minZ - 1.2, isWest: false },
        // Mid-West Flank
        { id: 'MW', x: bounds.minX - 3.6, z: bounds.centerZ, isWest: true },
        // Mid-East Flank
        { id: 'ME', x: bounds.maxX + 3.6, z: bounds.centerZ, isWest: false },
        // Far North Background (Behind Cup)
        { id: 'FN', x: bounds.centerX - 1.2, z: bounds.minZ - 3.5, isWest: true },
        { id: 'FE', x: bounds.centerX + 1.2, z: bounds.minZ - 3.5, isWest: false },
      ];

      // Add gentle organic variation
      const jitteredZones = candidateZones.map((z) => ({
        ...z,
        x: z.x + (prng() - 0.5) * 0.7,
        z: z.z + (prng() - 0.5) * 0.7,
      }));

      // Filter to safe zones
      const safeZones = jitteredZones.filter((z) => isPositionSafe(z.x, z.z, 4.0));

      // If fewer than 2 zones are safe due to an unusual course shape, search outer ring
      if (safeZones.length < 2) {
        for (let aDeg = 30; aDeg < 360; aDeg += 45) {
          const ang = (aDeg * Math.PI) / 180;
          const dist = Math.max(bounds.width, bounds.depth) * 0.5 + 3.8;
          const px = bounds.centerX + Math.cos(ang) * dist;
          const pz = bounds.centerZ + Math.sin(ang) * dist;
          if (isPositionSafe(px, pz, 3.8)) {
            safeZones.push({
              id: `RING_${aDeg}`,
              x: px,
              z: pz,
              isWest: px < bounds.centerX,
            });
          }
        }
      }

      if (safeZones.length === 0) return; // Ultra-compact course, keep pristine lawn

      // Deterministically shuffle safe zones
      for (let i = safeZones.length - 1; i > 0; i--) {
        const j = Math.floor(prng() * (i + 1));
        const t = safeZones[i];
        safeZones[i] = safeZones[j];
        safeZones[j] = t;
      }

      const anchor1 = safeZones[0];

      // Anchor 2 should be on the opposite side of the course and well separated (>= 6.0m)
      const oppositeCandidates = safeZones.slice(1).filter((z) => {
        const dist = Math.hypot(z.x - anchor1.x, z.z - anchor1.z);
        if (dist < 6.0) return false;
        return z.isWest !== anchor1.isWest;
      });

      const anchor2 = oppositeCandidates.length > 0
        ? oppositeCandidates[0]
        : safeZones.slice(1).find((z) => Math.hypot(z.x - anchor1.x, z.z - anchor1.z) >= 5.5) || null;

      // Windmill decision (~40% of maps have a picturesque windmill feature)
      const hasWindmill = ((course.holeNumber * 37 + course.worldIndex * 13 + 5) % 100) < 40;

      if (hasWindmill) {
        // --- ANCHOR 1: Standout Windmill Feature ---
        const wm = createWindmillInstance(0.30, isSoftwareGl, 1.25 + prng() * 0.35);
        if (wm) {
          wm.root.position.set(anchor1.x, 0.0, anchor1.z);
          // Angle blades toward course center
          const faceAngle = Math.atan2(bounds.centerX - anchor1.x, bounds.centerZ - anchor1.z) + 0.15;
          wm.root.rotation.y = faceAngle;
          container.add(wm.root);
          activeWindmillInstance = wm;

          // Base accents
          addBaseAccents(anchor1.x, anchor1.z, 1, true, true);
        }

        // --- ANCHOR 2: Single Harmonizing Specimen Tree ---
        if (anchor2) {
          const treeType = pickThemeTreeType();
          const treeScale = getTreeScale(treeType);
          spawnTree(anchor2.x, anchor2.z, treeType, treeScale, 10);
          addBaseAccents(anchor2.x, anchor2.z, 20, prng() > 0.4, true);
        }
      } else {
        // --- ANCHOR 1: Scenic Natural Tree Grove ---
        const primaryType = pickThemeTreeType();
        const primaryScale = getTreeScale(primaryType);
        spawnTree(anchor1.x, anchor1.z, primaryType, primaryScale, 10);
        addBaseAccents(anchor1.x, anchor1.z, 20, true, true);

        // Companion sapling nestled outward away from course center (65% chance)
        if (prng() < 0.65) {
          const dirOutX = anchor1.x - bounds.centerX;
          const dirOutZ = anchor1.z - bounds.centerZ;
          const dirLen = Math.hypot(dirOutX, dirOutZ) || 1;
          const saplingX = anchor1.x + (dirOutX / dirLen) * 1.35 + (prng() - 0.5) * 0.3;
          const saplingZ = anchor1.z + (dirOutZ / dirLen) * 1.35 + (prng() - 0.5) * 0.3;
          if (isPositionSafe(saplingX, saplingZ, 3.8)) {
            const saplingScale = getTreeScale(primaryType, true);
            spawnTree(saplingX, saplingZ, primaryType, saplingScale, 30);
          }
        }

        // --- ANCHOR 2: Secondary Accent Feature ---
        if (anchor2) {
          const isRockery = prng() < 0.30;
          if (isRockery) {
            // Elegant rockery vignette: 1 medium rounded boulder + small pebble + bush
            const rock = natureAssets.createRock('medium', holeSeed + 45, 0.46, !isSoftwareGl);
            if (rock) {
              rock.position.set(anchor2.x, 0.0, anchor2.z);
              rock.rotation.y = prng() * Math.PI * 2;
              container.add(rock);
            }
            addBaseAccents(anchor2.x, anchor2.z, 50, true, true);
          } else {
            // Accent Tree with companion bush
            const accentType = pickThemeTreeType();
            const accentScale = getTreeScale(accentType);
            spawnTree(anchor2.x, anchor2.z, accentType, accentScale, 60);
            addBaseAccents(anchor2.x, anchor2.z, 70, prng() > 0.5, true);
          }
        }
      }
    }

    function buildCourseScene() {
      // Dispose per-course dynamic geometries & materials cleanly
      for (const g of disposableCourseGeos) g.dispose();
      for (const m of disposableCourseMats) m.dispose();
      disposableCourseGeos = [];
      disposableCourseMats = [];

      while (courseGroup.children.length > 0) {
        courseGroup.remove(courseGroup.children[0]);
      }
      movingBlockMeshes = [];
      bumperMeshes = [];
      koiActors = [];
      hangingLanternMeshes = [];
      flagPennantMesh = null;
      activeFlagGeo = null;
      activeFlagBasePos = null;
      activeFlagU = null;

      const activeCourse = stateRef.current.course;
      const isChineseGarden = activeCourse.theme === 'chinese-garden';
      const isPlayMode = stateRef.current.mode === 'play';
      const worldInfo = GOLF_WORLDS[activeCourse.worldIndex] || GOLF_WORLDS[0];
      currentWalls = computeCourseWalls(activeCourse);
      const bounds = getCourseBounds(activeCourse);

      // 1. Multi-Tiered Floating Island Diorama (Compact Island in Menu Mode; Seamless Full-Viewport Ground in Play Mode!)
      const islandW = Math.max(13.8, bounds.width + (isChineseGarden ? 9.2 : 7.6));
      const islandD = Math.max(14.8, bounds.depth + (isChineseGarden ? 9.2 : 7.6));
      const groundW = isPlayMode ? 68 : islandW;
      const groundD = isPlayMode ? 68 : islandD;

      const grassTopGeo = new THREE.BoxGeometry(groundW, 0.24, groundD);
      const grassTopMat = new THREE.MeshLambertMaterial({
        color: isChineseGarden ? 0x56b838 : worldInfo.islandColor,
      });
      disposableCourseGeos.push(grassTopGeo);
      disposableCourseMats.push(grassTopMat);

      const grassTop = new THREE.Mesh(grassTopGeo, grassTopMat);
      grassTop.position.set(bounds.centerX, -0.12, bounds.centerZ);
      grassTop.receiveShadow = !isSoftwareGl;
      courseGroup.add(grassTop);

      const natureGroup = new THREE.Group();
      courseGroup.add(natureGroup);
      activeNatureGroup = natureGroup;

      // Tapered 3-tier cliff base (Visible on Floating Island Diorama in Menu Mode)
      if (!isPlayMode) {
        const tier1Geo = new THREE.BoxGeometry(islandW * 0.96, 0.42, islandD * 0.96);
        const tier2Geo = new THREE.BoxGeometry(islandW * 0.88, 0.46, islandD * 0.88);
        const tier3Geo = new THREE.BoxGeometry(islandW * 0.76, 0.48, islandD * 0.76);
        disposableCourseGeos.push(tier1Geo, tier2Geo, tier3Geo);

        const tier1 = new THREE.Mesh(
          tier1Geo,
          isChineseGarden ? sharedMats.stoneCliffUpper : sharedMats.dirtUpper
        );
        tier1.position.set(bounds.centerX, -0.45, bounds.centerZ);
        const tier2 = new THREE.Mesh(
          tier2Geo,
          isChineseGarden ? sharedMats.stoneCliffMid : sharedMats.dirtMid
        );
        tier2.position.set(bounds.centerX, -0.89, bounds.centerZ);
        const tier3 = new THREE.Mesh(
          tier3Geo,
          isChineseGarden ? sharedMats.stoneCliffDeep : sharedMats.dirtDeep
        );
        tier3.position.set(bounds.centerX, -1.36, bounds.centerZ);
        courseGroup.add(tier1, tier2, tier3);
      }

      // 2. Instanced Checkerboard Fairway Sub-Tiles & Foundations (Minimizes Draw Calls!)
      const totalCells = activeCourse.cells.length;
      const baseMat = isChineseGarden ? sharedMats.marbleCream : sharedMats.creamBase;
      const lTileMat = isChineseGarden ? sharedMats.jadeLightTile : sharedMats.lightTile;
      const dTileMat = isChineseGarden ? sharedMats.jadeDarkTile : sharedMats.darkTile;

      const baseInstanced = new THREE.InstancedMesh(sharedGeos.cellBase, baseMat, totalCells);
      const lightInstanced = new THREE.InstancedMesh(sharedGeos.subTile, lTileMat, totalCells * 4);
      const darkInstanced = new THREE.InstancedMesh(sharedGeos.subTile, dTileMat, totalCells * 4);

      baseInstanced.receiveShadow = !isSoftwareGl;
      baseInstanced.castShadow = false; // Under-fairway base foundation should never cast shadow onto turf
      lightInstanced.receiveShadow = !isSoftwareGl;
      darkInstanced.receiveShadow = !isSoftwareGl;

      let baseIdx = 0;
      let lightIdx = 0;
      let darkIdx = 0;

      const cellSet = new Set<string>();
      for (const [c, r] of activeCourse.cells) {
        cellSet.add(`${c},${r}`);
      }

      // Solve exact cell boundaries for all cells so every corridor has:
      // 1. Equal width (3.40 = CELL_SIZE + 2 * FAIRWAY_PAD)
      // 2. Corner cells are symmetric 3.40 x 3.40 squares centered at (cx, cz)
      // 3. Straight segments seamlessly connect between corners and ends without lopsided sub-tiles or gaps
      const cellBoundsMap = new Map<string, { x1: number; x2: number; z1: number; z2: number; isCorner: boolean }>();

      // Step 1: Identify all corner intersection cells
      for (const [col, row] of activeCourse.cells) {
        const key = `${col},${row}`;
        const cx = col * CELL_SIZE;
        const cz = row * CELL_SIZE;
        const hasW = cellSet.has(`${col - 1},${row}`);
        const hasE = cellSet.has(`${col + 1},${row}`);
        const hasN = cellSet.has(`${col},${row - 1}`);
        const hasS = cellSet.has(`${col},${row + 1}`);
        const isCorner = (hasN || hasS) && (hasE || hasW);

        if (isCorner) {
          cellBoundsMap.set(key, {
            x1: cx - 1.0 - FAIRWAY_PAD,
            x2: cx + 1.0 + FAIRWAY_PAD,
            z1: cz - 1.0 - FAIRWAY_PAD,
            z2: cz + 1.0 + FAIRWAY_PAD,
            isCorner: true,
          });
        }
      }

      // Step 2: Solve straight corridor segments between ends and corners
      const visitedCells = new Set<string>();
      for (const [col, row] of activeCourse.cells) {
        const key = `${col},${row}`;
        if (cellBoundsMap.has(key) || visitedCells.has(key)) continue;

        const hasN = cellSet.has(`${col},${row - 1}`);
        const hasS = cellSet.has(`${col},${row + 1}`);
        const hasW = cellSet.has(`${col - 1},${row}`);
        const hasE = cellSet.has(`${col + 1},${row}`);

        const isVert = (hasN || hasS) || (!hasW && !hasE);

        if (isVert) {
          let minR = row;
          while (cellSet.has(`${col},${minR - 1}`) && !cellBoundsMap.has(`${col},${minR - 1}`)) {
            minR--;
          }
          let maxR = row;
          while (cellSet.has(`${col},${maxR + 1}`) && !cellBoundsMap.has(`${col},${maxR + 1}`)) {
            maxR++;
          }

          for (let r = minR; r <= maxR; r++) visitedCells.add(`${col},${r}`);

          const cx = col * CELL_SIZE;
          const x1 = cx - 1.0 - FAIRWAY_PAD;
          const x2 = cx + 1.0 + FAIRWAY_PAD;

          let zStart: number;
          const northNeighborKey = `${col},${minR - 1}`;
          if (cellBoundsMap.has(northNeighborKey)) {
            zStart = cellBoundsMap.get(northNeighborKey)!.z2;
          } else {
            zStart = minR * CELL_SIZE - 1.0 - FAIRWAY_PAD;
          }

          let zEnd: number;
          const southNeighborKey = `${col},${maxR + 1}`;
          if (cellBoundsMap.has(southNeighborKey)) {
            zEnd = cellBoundsMap.get(southNeighborKey)!.z1;
          } else {
            zEnd = maxR * CELL_SIZE + 1.0 + FAIRWAY_PAD;
          }

          const numCells = maxR - minR + 1;
          const cellLen = (zEnd - zStart) / numCells;

          for (let i = 0; i < numCells; i++) {
            const r = minR + i;
            cellBoundsMap.set(`${col},${r}`, {
              x1,
              x2,
              z1: zStart + i * cellLen,
              z2: zStart + (i + 1) * cellLen,
              isCorner: false,
            });
          }
        } else {
          let minC = col;
          while (cellSet.has(`${minC - 1},${row}`) && !cellBoundsMap.has(`${minC - 1},${row}`)) {
            minC--;
          }
          let maxC = col;
          while (cellSet.has(`${maxC + 1},${row}`) && !cellBoundsMap.has(`${maxC + 1},${row}`)) {
            maxC++;
          }

          for (let c = minC; c <= maxC; c++) visitedCells.add(`${c},${row}`);

          const cz = row * CELL_SIZE;
          const z1 = cz - 1.0 - FAIRWAY_PAD;
          const z2 = cz + 1.0 + FAIRWAY_PAD;

          let xStart: number;
          const westNeighborKey = `${minC - 1},${row}`;
          if (cellBoundsMap.has(westNeighborKey)) {
            xStart = cellBoundsMap.get(westNeighborKey)!.x2;
          } else {
            xStart = minC * CELL_SIZE - 1.0 - FAIRWAY_PAD;
          }

          let xEnd: number;
          const eastNeighborKey = `${maxC + 1},${row}`;
          if (cellBoundsMap.has(eastNeighborKey)) {
            xEnd = cellBoundsMap.get(eastNeighborKey)!.x1;
          } else {
            xEnd = maxC * CELL_SIZE + 1.0 + FAIRWAY_PAD;
          }

          const numCells = maxC - minC + 1;
          const cellLen = (xEnd - xStart) / numCells;

          for (let i = 0; i < numCells; i++) {
            const c = minC + i;
            cellBoundsMap.set(`${c},${row}`, {
              x1: xStart + i * cellLen,
              x2: xStart + (i + 1) * cellLen,
              z1,
              z2,
              isCorner: false,
            });
          }
        }
      }

      // Sub-tiles have height 0.06, centered at y = 0.145 -> top surface is at y = 0.175
      // Cell base has height 0.15, centered at y = 0.065 -> top surface is at y = 0.140 (well below 0.175 so zero Z-fighting!)
      for (const [col, row] of activeCourse.cells) {
        const bounds = cellBoundsMap.get(`${col},${row}`);
        if (!bounds) continue;

        const hasW = cellSet.has(`${col - 1},${row}`);
        const hasE = cellSet.has(`${col + 1},${row}`);
        const hasN = cellSet.has(`${col},${row - 1}`);
        const hasS = cellSet.has(`${col},${row + 1}`);

        // Base foundation box: extends 0.28 under outer walls and corner turns
        const bx1 = bounds.isCorner ? bounds.x1 - 0.28 : bounds.x1 - (hasW ? 0.01 : 0.28);
        const bx2 = bounds.isCorner ? bounds.x2 + 0.28 : bounds.x2 + (hasE ? 0.01 : 0.28);
        const bz1 = bounds.isCorner ? bounds.z1 - 0.28 : bounds.z1 - (hasN ? 0.01 : 0.28);
        const bz2 = bounds.isCorner ? bounds.z2 + 0.28 : bounds.z2 + (hasS ? 0.01 : 0.28);

        _dummyPos.set((bx1 + bx2) * 0.5, 0.065, (bz1 + bz2) * 0.5);
        _dummyScale.set(bx2 - bx1, 1, bz2 - bz1);
        _dummyMatrix.compose(_dummyPos, _dummyQuat, _dummyScale);
        baseInstanced.setMatrixAt(baseIdx++, _dummyMatrix);

        // Sub-tiles: 2x2 grid split exactly at the cell midpoints
        const midX = (bounds.x1 + bounds.x2) * 0.5;
        const midZ = (bounds.z1 + bounds.z2) * 0.5;

        for (let sx = 0; sx < 2; sx++) {
          for (let sz = 0; sz < 2; sz++) {
            const tx1 = sx === 0 ? bounds.x1 : midX;
            const tx2 = sx === 0 ? midX : bounds.x2;
            const tz1 = sz === 0 ? bounds.z1 : midZ;
            const tz2 = sz === 0 ? midZ : bounds.z2;

            const isEven = Math.abs((col * 2 + sx + row * 2 + sz) % 2) === 0;
            _dummyPos.set((tx1 + tx2) * 0.5, 0.145, (tz1 + tz2) * 0.5);
            _dummyScale.set(tx2 - tx1, 1, tz2 - tz1);
            _dummyMatrix.compose(_dummyPos, _dummyQuat, _dummyScale);
            if (isEven) {
              lightInstanced.setMatrixAt(lightIdx++, _dummyMatrix);
            } else {
              darkInstanced.setMatrixAt(darkIdx++, _dummyMatrix);
            }
          }
        }
      }
      _dummyScale.set(1, 1, 1);

      baseInstanced.count = baseIdx;
      lightInstanced.count = lightIdx;
      darkInstanced.count = darkIdx;
      baseInstanced.instanceMatrix.needsUpdate = true;
      lightInstanced.instanceMatrix.needsUpdate = true;
      darkInstanced.instanceMatrix.needsUpdate = true;
      baseInstanced.computeBoundingSphere();
      lightInstanced.computeBoundingSphere();
      darkInstanced.computeBoundingSphere();
      courseGroup.add(baseInstanced, lightInstanced, darkInstanced);

      // 3. Sand / Bridge Strips (raised cleanly above y = 0.175 grass top)
      if (activeCourse.sandStrips) {
        for (const s of activeCourse.sandStrips) {
          // If the course data still had old corridor width (2.68), adapt to current widened corridor 3.40
          const sWidth = Math.abs(s.width - 2.68) < 0.05 ? 3.40 : s.width;
          const sDepth = Math.abs(s.depth - 2.68) < 0.05 ? 3.40 : s.depth;
          const sGeo = new THREE.BoxGeometry(sWidth, 0.016, sDepth);

          // Set UV repeat scale proportional to world dimensions so the sand grain is uniform and seamless
          const uvAttr = sGeo.attributes.uv;
          const uvScaleU = sWidth / 1.5;
          const uvScaleV = sDepth / 1.5;
          for (let i = 0; i < uvAttr.count; i++) {
            uvAttr.setXY(i, uvAttr.getX(i) * uvScaleU, uvAttr.getY(i) * uvScaleV);
          }
          uvAttr.needsUpdate = true;

          disposableCourseGeos.push(sGeo);
          const sMesh = new THREE.Mesh(sGeo, sharedMats.sand);
          sMesh.position.set(s.x, 0.181, s.z);
          sMesh.receiveShadow = !isSoftwareGl;
          courseGroup.add(sMesh);
        }
      }

      // 4. Perimeter Walls (Clean Beveled Rectangular Corners on Standard Holes matching Screenshot 1; Imperial Pillars on Chinese Garden)
      const wallTopMat = new THREE.MeshLambertMaterial({
        color: isChineseGarden ? 0xd62828 : worldInfo.wallTopColor,
      });
      disposableCourseMats.push(wallTopMat);

      const wallThickness = 0.28;
      const wallHeight = 0.35;
      const cornerSet = new Set<string>();

      for (const w of currentWalls) {
        const len = Math.hypot(w.x2 - w.x1, w.z2 - w.z1) + wallThickness * 1.04;
        const isHoriz = Math.abs(w.z1 - w.z2) < 0.001;
        const midX = (w.x1 + w.x2) / 2 - w.nx * (wallThickness * 0.42);
        const midZ = (w.z1 + w.z2) / 2 - w.nz * (wallThickness * 0.42);

        const wBoxW = isHoriz ? len : wallThickness;
        const wBoxD = isHoriz ? wallThickness : len;

        const lowerGeo = new THREE.BoxGeometry(wBoxW, wallHeight * 0.68, wBoxD);
        const capGeo = new THREE.BoxGeometry(wBoxW + 0.045, wallHeight * 0.36, wBoxD + 0.045);
        disposableCourseGeos.push(lowerGeo, capGeo);

        const lowerMesh = new THREE.Mesh(lowerGeo, baseMat);
        lowerMesh.position.set(midX, 0.15 + (wallHeight * 0.68) / 2, midZ);
        lowerMesh.castShadow = !isSoftwareGl;
        lowerMesh.receiveShadow = !isSoftwareGl;
        courseGroup.add(lowerMesh);

        const capMesh = new THREE.Mesh(capGeo, wallTopMat);
        capMesh.position.set(midX, 0.15 + wallHeight * 0.84, midZ);
        capMesh.castShadow = !isSoftwareGl;
        capMesh.receiveShadow = !isSoftwareGl;
        courseGroup.add(capMesh);

        // Place Imperial Gold-Capped Vermilion Corner Pillars on Chinese Garden Level 1
        if (isChineseGarden) {
          [
            [w.x1, w.z1],
            [w.x2, w.z2],
          ].forEach(([px, pz]) => {
            const key = `${px.toFixed(2)},${pz.toFixed(2)}`;
            if (!cornerSet.has(key)) {
              cornerSet.add(key);
              const postGroup = new THREE.Group();
              postGroup.position.set(px, 0.15, pz);

              const pBody = new THREE.Mesh(sharedGeos.cornerPostBody, sharedMats.vermilionRed);
              pBody.position.y = 0.12;
              postGroup.add(pBody);

              const pCap = new THREE.Mesh(sharedGeos.cornerPostCap, sharedMats.goldAccent);
              pCap.position.y = 0.305;
              pCap.castShadow = !isSoftwareGl;
              postGroup.add(pCap);

              courseGroup.add(postGroup);
            }
          });
        }
      }

      // 5. Starting 3D Golf Tee(s) (Extracted from GOLF_Ball.obj - Dual in Multiplayer, Single in Solo)
      const mpStateForTee = stateRef.current.multiplayerState;
      const isMpTee = !!(mpStateForTee && mpStateForTee.isMultiplayer);

      if (isMpTee) {
        // Dual 3D Golf Tees for Multiplayer: Player 1 (cyan band) & Player 2 (orange band)
        // Guaranteed strictly on the exact same starting line perpendicular to the fairway direction
        const mpTees = getMultiplayerTeePositions(activeCourse);
        const teeMesh1 = createGolfTeeMesh({
          color: 0xe52521,
          accentColor: 0x00e5ff,
          scale: GOLF_TEE_DEFAULT_SCALE,
        });
        teeMesh1.position.set(mpTees.p1[0], 0.186, mpTees.p1[1]);
        courseGroup.add(teeMesh1);

        const teeMesh2 = createGolfTeeMesh({
          color: 0xe52521,
          accentColor: 0xff5722,
          scale: GOLF_TEE_DEFAULT_SCALE,
        });
        teeMesh2.position.set(mpTees.p2[0], 0.186, mpTees.p2[1]);
        courseGroup.add(teeMesh2);
      } else {
        // Single 3D Golf Tee for Solo Play (Classic vibrant red from model)
        const teeMesh = createGolfTeeMesh({
          color: 0xe52521,
          scale: GOLF_TEE_DEFAULT_SCALE,
        });
        teeMesh.position.set(activeCourse.start[0], 0.186, activeCourse.start[1]);
        courseGroup.add(teeMesh);
      }

      // 6. Deep Black Hollow Cup & Deep-Mounted Flagpole Assembly
      const holeGroup = new THREE.Group();
      holeGroup.position.set(activeCourse.hole[0], 0.184, activeCourse.hole[1]);

      // Outer White/Gold Tournament Cup Lip (Crisp border framing the hole)
      const cupRimGeo = new THREE.RingGeometry(HOLE_RADIUS * 0.86, HOLE_RADIUS * 1.14, 36);
      cupRimGeo.rotateX(-Math.PI / 2);

      // Deep Pitch-Black Hollow Hole Opening (Completely covers any grass underneath)
      const cupHoleGeo = new THREE.CircleGeometry(HOLE_RADIUS * 0.88, 36);
      cupHoleGeo.rotateX(-Math.PI / 2);

      // Inner Dark Cavity Shadow Ring for 3D depth perception
      const cupShadowGeo = new THREE.RingGeometry(HOLE_RADIUS * 0.55, HOLE_RADIUS * 0.88, 36);
      cupShadowGeo.rotateX(-Math.PI / 2);

      // Dark interior cup well (3D cavity depth beneath the surface)
      const cupWellGeo = new THREE.CylinderGeometry(HOLE_RADIUS * 0.87, HOLE_RADIUS * 0.87, 0.24, 32, 1, true);
      cupWellGeo.translate(0, -0.12, 0);

      const cupBottomGeo = new THREE.CircleGeometry(HOLE_RADIUS * 0.87, 32);
      cupBottomGeo.rotateX(-Math.PI / 2);
      cupBottomGeo.translate(0, -0.239, 0);

      disposableCourseGeos.push(cupRimGeo, cupHoleGeo, cupShadowGeo, cupWellGeo, cupBottomGeo);

      const cupRimMat = new THREE.MeshBasicMaterial({
        color: isChineseGarden ? 0xffd43b : 0xffffff,
        side: THREE.DoubleSide,
      });
      // Pure pitch-black void disc covering the surface
      const cupHoleMat = new THREE.MeshBasicMaterial({
        color: 0x050508,
        side: THREE.DoubleSide,
      });
      // Soft radial depth vignette
      const cupShadowMat = new THREE.MeshBasicMaterial({
        color: 0x121218,
        side: THREE.DoubleSide,
      });
      // Dark cavity interior walls & floor
      const cupWellMat = new THREE.MeshBasicMaterial({
        color: 0x020204,
        side: THREE.DoubleSide,
      });

      disposableCourseMats.push(cupRimMat, cupHoleMat, cupShadowMat, cupWellMat);

      // 3D Cup Cavity Interior
      const cupWell = new THREE.Mesh(cupWellGeo, cupWellMat);
      cupWell.renderOrder = 2;
      holeGroup.add(cupWell);

      const cupBottom = new THREE.Mesh(cupBottomGeo, cupWellMat);
      cupBottom.renderOrder = 2;
      holeGroup.add(cupBottom);

      // Surface Hole Void (Rich pitch-black disk at y = 0.002)
      const cupHole = new THREE.Mesh(cupHoleGeo, cupHoleMat);
      cupHole.position.y = 0.002;
      cupHole.renderOrder = 3;
      holeGroup.add(cupHole);

      // Inner Shadow Ring (y = 0.0025)
      const cupShadow = new THREE.Mesh(cupShadowGeo, cupShadowMat);
      cupShadow.position.y = 0.0025;
      cupShadow.renderOrder = 4;
      holeGroup.add(cupShadow);

      // Outer White Tournament Rim (y = 0.003)
      const cupRim = new THREE.Mesh(cupRimGeo, cupRimMat);
      cupRim.position.y = 0.003;
      cupRim.renderOrder = 5;
      holeGroup.add(cupRim);

      // Flagpole assembly with pole pushed DEEP down into the hole (no surface stand/socket)
      const flagAssembly = new THREE.Group();
      flagAssembly.position.set(0, 0, 0);

      // Submerged pole: starts at y = -0.24 (deep down inside the black hole) and extends up to y = 1.62
      const poleHeight = 1.86;
      const poleGeo = new THREE.CylinderGeometry(0.022, 0.026, poleHeight, 16);
      poleGeo.translate(0, poleHeight * 0.5 - 0.24, 0);

      const finialGeo = new THREE.SphereGeometry(0.075, 16, 16);
      disposableCourseGeos.push(poleGeo, finialGeo);

      const poleMesh = new THREE.Mesh(
        poleGeo,
        isChineseGarden ? sharedMats.vermilionRed : sharedMats.whiteGloss
      );
      poleMesh.castShadow = !isSoftwareGl;
      poleMesh.renderOrder = 4;
      flagAssembly.add(poleMesh);

      const finialMesh = new THREE.Mesh(finialGeo, sharedMats.goldAccent);
      finialMesh.position.set(0, 1.62, 0);
      finialMesh.renderOrder = 4;
      flagAssembly.add(finialMesh);

      // Segmented triangular cloth pennant geometry for natural wind wave & fluttering
      const U_SEGS = 16;
      const V_SEGS = 4;
      const pennantLength = 0.64;
      const pennantHeight = 0.42;

      const flagPosList: number[] = [];
      const flagUList: number[] = [];
      const flagIndices: number[] = [];

      for (let j = 0; j <= V_SEGS; j++) {
        const v = j / V_SEGS;
        for (let i = 0; i <= U_SEGS; i++) {
          const u = i / U_SEGS;
          const x = u * pennantLength;
          // Taper triangular pennant towards tip
          const topY = -u * (pennantHeight * 0.5);
          const botY = -pennantHeight + u * (pennantHeight * 0.5);
          const y = topY * (1 - v) + botY * v;
          const z = 0;

          flagPosList.push(x, y, z);
          flagUList.push(u);
        }
      }

      for (let j = 0; j < V_SEGS; j++) {
        for (let i = 0; i < U_SEGS; i++) {
          const a = j * (U_SEGS + 1) + i;
          const b = (j + 1) * (U_SEGS + 1) + i;
          const c = (j + 1) * (U_SEGS + 1) + (i + 1);
          const d = j * (U_SEGS + 1) + (i + 1);

          flagIndices.push(a, b, d);
          flagIndices.push(b, c, d);
        }
      }

      const flagGeo = new THREE.BufferGeometry();
      flagGeo.setAttribute('position', new THREE.Float32BufferAttribute(flagPosList, 3));
      flagGeo.setIndex(flagIndices);
      flagGeo.computeVertexNormals();
      disposableCourseGeos.push(flagGeo);

      const flagMat = isChineseGarden ? sharedMats.vermilionRed : sharedMats.flagRed;
      flagMat.side = THREE.DoubleSide;

      flagPennantMesh = new THREE.Mesh(flagGeo, flagMat);
      flagPennantMesh.position.set(0.018, 1.56, -0.009);
      flagPennantMesh.castShadow = !isSoftwareGl;
      flagPennantMesh.renderOrder = 4;
      flagAssembly.add(flagPennantMesh);

      activeFlagGeo = flagGeo;
      activeFlagBasePos = new Float32Array(flagPosList);
      activeFlagU = new Float32Array(flagUList);

      holeGroup.add(flagAssembly);
      courseGroup.add(holeGroup);

      // 7. Arcade-Style 4-Part Pinball Bumpers
      if (activeCourse.bumpers) {
        for (const b of activeCourse.bumpers) {
          const bGroup = new THREE.Group();
          bGroup.position.set(b.x, 0.176, b.z);

          const baseRingGeo = new THREE.CylinderGeometry(b.radius * 1.08, b.radius * 1.12, 0.06, 24);
          baseRingGeo.translate(0, 0.03, 0);
          const bodyGeo = new THREE.CylinderGeometry(b.radius, b.radius * 1.02, 0.24, 24);
          bodyGeo.translate(0, 0.14, 0);
          const capGeo = new THREE.CylinderGeometry(b.radius * 0.72, b.radius * 0.76, 0.28, 24);
          capGeo.translate(0, 0.15, 0);
          const centerDotGeo = new THREE.SphereGeometry(b.radius * 0.28, 16, 12);
          disposableCourseGeos.push(baseRingGeo, bodyGeo, capGeo, centerDotGeo);

          const baseRing = new THREE.Mesh(baseRingGeo, sharedMats.chromeRim);
          const bodyMesh = new THREE.Mesh(bodyGeo, wallTopMat);
          bodyMesh.castShadow = !isSoftwareGl;
          const topCap = new THREE.Mesh(capGeo, sharedMats.whiteGloss);
          const centerDot = new THREE.Mesh(centerDotGeo, sharedMats.goldAccent);
          centerDot.position.y = 0.29;
          centerDot.scale.y = 0.45;

          bGroup.add(baseRing, bodyMesh, topCap, centerDot);
          courseGroup.add(bGroup);
          bumperMeshes.push(bGroup);
        }
      }

      // 8. Upgraded Moving Gates with recessed ground guide track
      if (activeCourse.movingBlocks) {
        activeCourse.movingBlocks.forEach((mb, index) => {
          const trackW = mb.axis === 'x' ? mb.width + mb.range * 2 : mb.width * 0.5;
          const trackD = mb.axis === 'z' ? mb.depth + mb.range * 2 : mb.depth * 0.5;
          const trackGeo = new THREE.BoxGeometry(trackW, 0.014, trackD);
          disposableCourseGeos.push(trackGeo);
          const trackMesh = new THREE.Mesh(trackGeo, sharedMats.chromeRim);
          trackMesh.position.set(mb.x, 0.182, mb.z);
          courseGroup.add(trackMesh);

          const mbGroup = new THREE.Group();
          mbGroup.position.set(mb.x, 0.185, mb.z);

          const blockGeo = new THREE.BoxGeometry(mb.width, 0.33, mb.depth);
          blockGeo.translate(0, 0.165, 0);
          const stripeGeo = new THREE.BoxGeometry(mb.width + 0.025, 0.085, mb.depth + 0.025);
          stripeGeo.translate(0, 0.26, 0);
          disposableCourseGeos.push(blockGeo, stripeGeo);

          const blockMesh = new THREE.Mesh(blockGeo, wallTopMat);
          blockMesh.castShadow = !isSoftwareGl;
          blockMesh.receiveShadow = !isSoftwareGl;
          mbGroup.add(blockMesh);

          const stripeMesh = new THREE.Mesh(stripeGeo, sharedMats.creamBase);
          mbGroup.add(stripeMesh);

          courseGroup.add(mbGroup);
          movingBlockMeshes.push({ mesh: mbGroup, index });
        });
      }

      // 9. Environment Setpieces & Foliage: Chinese Garden Diorama (Level 1) vs Classic Meadow
      if (isChineseGarden) {
        // A. 3D Chinese Imperial Pavilion (Ting) on Left Terrace (Matches Reference Image 2)
        const pavilion = createChinesePavilion();
        pavilion.position.set(bounds.centerX - 3.85, 0, bounds.centerZ - 0.55);
        pavilion.rotation.y = 0.08;
        courseGroup.add(pavilion);

        // Stepping Stone Path leading from Pavilion Stairs toward the Fairway
        const steppingStones = [
          [-2.45, -0.5, 0.32],
          [-2.15, 0.15, 0.28],
          [-2.30, 0.85, 0.3],
          [2.15, -0.1, 0.32],
          [2.45, 0.45, 0.28],
        ];
        steppingStones.forEach(([sx, sz, sr]) => {
          const stGeo = new THREE.CylinderGeometry(sr, sr * 1.05, 0.04, 12);
          disposableCourseGeos.push(stGeo);
          const stMesh = new THREE.Mesh(stGeo, sharedMats.marbleCream);
          stMesh.position.set(bounds.centerX + sx, 0.015, bounds.centerZ + sz);
          courseGroup.add(stMesh);
        });

        // B. Turquoise Koi Pond & Arched Red Wooden Bridge on Right Terrace (Matches Reference Image 1)
        const koiPond = createKoiPondAndBridge(bounds.centerX + 3.85, bounds.centerZ + 0.15);
        courseGroup.add(koiPond);

        // C. Blooming Pink Cherry Blossom Trees (Sakura / Mei Hua) framing the garden
        const sakuraPlacements = [
          [-5.1, -4.4, 1.15],
          [-5.4, 3.1, 1.12],
          [-3.4, 4.9, 0.96],
          [5.1, -4.3, 1.08],
          [5.1, 4.2, 1.04],
          [2.6, -4.9, 0.88],
        ];
        sakuraPlacements.forEach(([tx, tz, tScale], idx) => {
          const tree = createSakuraTree(tScale, idx);
          tree.position.set(bounds.centerX + tx, 0, bounds.centerZ + tz);
          courseGroup.add(tree);
        });

        // D. Segmented Green Bamboo Groves around Pavilion & Pond (Matches Reference Image 2)
        const bambooPlacements = [
          [-5.65, -1.9, 1.08],
          [-5.55, 0.95, 1.02],
          [-2.8, -4.8, 0.94],
          [2.4, 4.9, 0.96],
          [5.65, -1.6, 0.92],
          [5.6, 2.1, 1.0],
        ];
        bambooPlacements.forEach(([bx, bz, bScale], idx) => {
          const bamboo = createBambooCluster(bScale, idx);
          bamboo.position.set(bounds.centerX + bx, 0, bounds.centerZ + bz);
          courseGroup.add(bamboo);
        });

        // E. Carved Stone Pagoda Garden Lanterns glowing softly along the path & water
        const stoneLanternSpots = [
          [-2.25, -3.5, 0.92],
          [-2.25, 2.8, 0.95],
          [2.22, -2.5, 0.9],
          [2.25, 2.6, 0.95],
        ];
        stoneLanternSpots.forEach(([lx, lz, lScale]) => {
          const pagodaLantern = createStonePagodaLantern(lScale);
          pagodaLantern.position.set(bounds.centerX + lx, 0, bounds.centerZ + lz);
          courseGroup.add(pagodaLantern);
        });

        // F. Festive Catenary Strings of Glowing Red Lanterns Draped Across the Garden (Matches Reference Image 1)
        const lanternString1 = createFestiveLanternString(
          bounds.centerX - 2.35,
          2.1,
          bounds.centerZ - 1.95,
          bounds.centerX + 2.1,
          2.15,
          bounds.centerZ - 3.65,
          4,
          true
        );
        const lanternString2 = createFestiveLanternString(
          bounds.centerX - 2.35,
          2.1,
          bounds.centerZ + 0.85,
          bounds.centerX - 1.85,
          2.05,
          bounds.centerZ + 4.1,
          3,
          true
        );
        courseGroup.add(lanternString1, lanternString2);
      }

      // Populate Modular 3D Cliff & Rock Tile Decor
      populateNatureDecor(natureGroup, activeCourse, bounds, isPlayMode);

      resetBallState();
    }

    function updateMultiplayerSkins() {
      const mp = stateRef.current.multiplayerState;
      if (!mp || !mp.isMultiplayer) {
        applyActiveBallModel(stateRef.current.ballSkin);
        return;
      }
      const isHost = mp.isHost;
      const hostSkinId = isHost ? mp.localPlayer.ballSkinId : (mp.remotePlayer?.ballSkinId || 'golf');
      const guestSkinId = isHost ? (mp.remotePlayer?.ballSkinId || 'golf') : mp.localPlayer.ballSkinId;

      const p1Skin = GOLF_BALL_SKINS.find((s) => s.id === hostSkinId) || GOLF_BALL_SKINS[0];
      const p2Skin = GOLF_BALL_SKINS.find((s) => s.id === guestSkinId) || GOLF_BALL_SKINS[0];

      applyBallModelToGroup(ballRotGroup, currentBallHolder1, p1Skin);
      applyBallModelToGroup(ballRotGroup2, currentBallHolder2, p2Skin);
    }

    function resetBallState() {
      const activeCourse = stateRef.current.course;
      const mp = stateRef.current.multiplayerState;
      const isMp = !!(mp && mp.isMultiplayer && mp.status === 'connected');
      isHoleFinishedReporting = false;

      if (isMp) {
        // Dual tee-off on the exact same starting line perpendicular to the fairway
        const mpTees = getMultiplayerTeePositions(activeCourse);
        physicsState.x = mpTees.p1[0];
        physicsState.z = mpTees.p1[1];
        physicsState.vx = 0;
        physicsState.vz = 0;
        physicsState.isMoving = false;
        physicsState.isSunk = false;
        physicsState.sinkProgress = 0;

        physicsState2.x = mpTees.p2[0];
        physicsState2.z = mpTees.p2[1];
        physicsState2.vx = 0;
        physicsState2.vz = 0;
        physicsState2.isMoving = false;
        physicsState2.isSunk = false;
        physicsState2.sinkProgress = 0;

        isBall2OnTee = true;
        ball2TeeDropTimer = 0;
        ballGroup2.position.set(physicsState2.x, 0.186 + BALL_RADIUS + teeElevation, physicsState2.z);
        ballGroup2.scale.setScalar(1);
        ballShadow2.position.set(physicsState2.x, 0.192, physicsState2.z);
        ballGroup2.visible = true;
        ballShadow2.visible = true;
        p1MarkerRing.visible = mp.currentTurn === 'p1';
        p2MarkerRing.visible = mp.currentTurn === 'p2';

        updateMultiplayerSkins();
      } else {
        physicsState.x = activeCourse.start[0];
        physicsState.z = activeCourse.start[1];
        physicsState.vx = 0;
        physicsState.vz = 0;
        physicsState.isMoving = false;
        physicsState.isSunk = false;
        physicsState.sinkProgress = 0;

        physicsState2.x = 9999;
        physicsState2.z = 9999;
        physicsState2.vx = 0;
        physicsState2.vz = 0;
        physicsState2.isMoving = false;
        physicsState2.isSunk = true;

        ballGroup2.visible = false;
        ballShadow2.visible = false;
        p1MarkerRing.visible = false;
        p2MarkerRing.visible = false;
      }

      isBall1OnTee = true;
      ball1TeeDropTimer = 0;
      ballGroup.position.set(physicsState.x, 0.186 + BALL_RADIUS + teeElevation, physicsState.z);
      ballGroup.scale.setScalar(1);
      ballShadow.position.set(physicsState.x, 0.192, physicsState.z);
      ballShadow.visible = true;
      hintGroup.visible = false;
      hintHideTimer = 0;
      callbacksRef.current.onHintInfo?.(null);
      aimGroup.visible = false;
      remoteAimGroup.visible = false;
      snapCameraNextFrame = true;
      callbacksRef.current.onPowerChange(0);

      // Reset golf putter state (only appears on release swing)
      clubSwingState.active = false;
      clubSwingState.ballLaunched = false;
      clubGroup.scale.setScalar(1);
      clubShadowMat.opacity = 0.42;
      clubGroup.visible = false;

      clubSwingState2.active = false;
      clubSwingState2.ballLaunched = false;
      clubGroup2.scale.setScalar(1);
      clubShadowMat2.opacity = 0.42;
      clubGroup2.visible = false;

      const dx = activeCourse.hole[0] - activeCourse.start[0];
      const dz = activeCourse.hole[1] - activeCourse.start[1];
      const len = Math.hypot(dx, dz) || 1;
      const initDirX = dx / len;
      const initDirZ = dz / len;
      currentAimDirX = initDirX;
      currentAimDirZ = initDirZ;
    }

    /**
     * Picks the smartest default camera azimuth for the current course and viewport aspect ratio:
     * - On landscape viewports (aspect >= 1.08), uses course.defaultCameraAngle (or aligns the long axis horizontally).
     * - On portrait viewports (aspect < 1.08), aligns the course's narrower axis horizontally so it fits the portrait width,
     *   AND orients the camera behind the starting tee looking forward/upward toward the hole.
     */
    function getSmartBaseCameraAngle(activeCourse: HoleCourse, aspect: number): number {
      if (activeCourse.defaultCameraAngle !== undefined) {
        return activeCourse.defaultCameraAngle;
      }

      // Evaluate the 4 cardinal azimuths to place camera behind starting tee looking toward the hole
      const bounds = getCourseBounds(activeCourse);
      const thX = activeCourse.hole[0] - activeCourse.start[0];
      const thZ = activeCourse.hole[1] - activeCourse.start[1];
      const candidates = [0, Math.PI / 2, Math.PI, -Math.PI / 2];

      let bestAngle = 0;
      let bestScore = -Infinity;

      for (const ang of candidates) {
        const rightX = Math.cos(ang);
        const rightZ = -Math.sin(ang);
        const fwdX = -Math.sin(ang);
        const fwdZ = -Math.cos(ang);

        const projWidth = bounds.width * Math.abs(rightX) + bounds.depth * Math.abs(rightZ);
        const forwardDot = thX * fwdX + thZ * fwdZ;

        // Strongly prefer camera behind tee looking forward/upward toward the hole
        let score = forwardDot * 3.5;
        if (forwardDot < -0.1) score -= 15.0;

        if (aspect < 1.08) {
          score -= projWidth * 1.8;
        }

        if (score > bestScore) {
          bestScore = score;
          bestAngle = ang;
        }
      }

      return bestAngle;
    }

    /**
     * Exact 3D Perspective Frustum Camera Solver:
     * Ensures 100% of the course cells, the flagpole, AND the golf ball (plus a generous drag-aiming pad around the ball)
     * are strictly inside the safe 84% central frustum, compensating for foreground perspective narrowing.
     */
    function computeSmartPlayCamera(
      activeCourse: HoleCourse,
      ballX: number,
      ballZ: number,
      totalAngle: number,
      fovDeg: number,
      aspect: number
    ) {
      // Slightly steeper pitch on portrait screens so foreground walls never occlude the ball
      const pitch = aspect < 1.0 ? 0.90 : 0.80;
      const cosPitch = Math.cos(pitch);
      const sinPitch = Math.sin(pitch);

      const camBackX = Math.sin(totalAngle);
      const camBackZ = Math.cos(totalAngle);
      const camRightX = Math.cos(totalAngle);
      const camRightZ = -Math.sin(totalAngle);

      let minU = Infinity;
      let maxU = -Infinity;
      let minV = Infinity;
      let maxV = -Infinity;

      const expandUV = (wx: number, wz: number) => {
        const u = wx * camRightX + wz * camRightZ;
        const v = wx * camBackX + wz * camBackZ;
        if (u < minU) minU = u;
        if (u > maxU) maxU = u;
        if (v < minV) minV = v;
        if (v > maxV) maxV = v;
      };

      const cellPad = CELL_SIZE * 0.5 + FAIRWAY_PAD;
      for (const [col, row] of activeCourse.cells) {
        const cx = col * CELL_SIZE;
        const cz = row * CELL_SIZE;
        expandUV(cx - cellPad, cz - cellPad);
        expandUV(cx + cellPad, cz - cellPad);
        expandUV(cx - cellPad, cz + cellPad);
        expandUV(cx + cellPad, cz + cellPad);
      }

      const midU = (minU + maxU) * 0.5;
      const midV = (minV + maxV) * 0.5;
      const ballU = ballX * camRightX + ballZ * camRightZ;
      const ballV = ballX * camBackX + ballZ * camBackZ;

      // Bias the camera focus point 36% toward the ball so the camera stays centered near the action
      const focusU = THREE.MathUtils.lerp(midU, ballU, 0.36);
      const focusV = THREE.MathUtils.lerp(midV, ballV, 0.36);

      const focusX = focusU * camRightX + focusV * camBackX;
      const focusZ = focusU * camRightZ + focusV * camBackZ;

      const safeMargin = aspect < 1.0 ? 0.94 : 0.92;
      const tanHalfVFov = Math.tan(THREE.MathUtils.degToRad(fovDeg * 0.5)) * safeMargin;
      const tanHalfHFov = Math.max(0.08, tanHalfVFov * aspect);

      let requiredR = 6.8;

      const checkPointFrustum = (px: number, py: number, pz: number, refX = focusX, refZ = focusZ) => {
        const dx = px - refX;
        const dz = pz - refZ;
        const xCam = dx * camRightX + dz * camRightZ;
        const dTowardCam = dx * camBackX + dz * camBackZ;
        const yCam = -dTowardCam * sinPitch + py * cosPitch;
        const depthOffset = dTowardCam * cosPitch + py * sinPitch;

        const rForWidth = Math.abs(xCam) / tanHalfHFov + depthOffset;
        const rForHeight = Math.abs(yCam) / tanHalfVFov + depthOffset;
        if (rForWidth > requiredR) requiredR = rForWidth;
        if (rForHeight > requiredR) requiredR = rForHeight;
      };

      // 1. Course overview framing (measured around course midpoint with 0.80 zoom-in factor so camera stays close and never zooms out due to ball focus offset!)
      const midX = midU * camRightX + midV * camBackX;
      const midZ = midU * camRightZ + midV * camBackZ;
      const courseZoomFactor = 0.80;
      for (const [col, row] of activeCourse.cells) {
        const cx = midX + (col * CELL_SIZE - midX) * courseZoomFactor;
        const cz = midZ + (row * CELL_SIZE - midZ) * courseZoomFactor;
        const pad = cellPad * courseZoomFactor;
        checkPointFrustum(cx - pad, 0.4, cz - pad, midX, midZ);
        checkPointFrustum(cx + pad, 0.4, cz - pad, midX, midZ);
        checkPointFrustum(cx - pad, 0.4, cz + pad, midX, midZ);
        checkPointFrustum(cx + pad, 0.4, cz + pad, midX, midZ);
      }

      // 2. Strictly keep the flagpole base & finial inside the frustum relative to actual camera lookAt (focusX, focusZ)
      checkPointFrustum(activeCourse.hole[0], 0.2, activeCourse.hole[1]);
      checkPointFrustum(activeCourse.hole[0], 1.55, activeCourse.hole[1]);

      // 3. Strictly keep the golf ball & a compact 0.82-unit drag-aiming pad inside the frustum relative to actual camera lookAt
      const aimPad = 0.82;
      checkPointFrustum(ballX - aimPad, 0.3, ballZ - aimPad);
      checkPointFrustum(ballX + aimPad, 0.3, ballZ - aimPad);
      checkPointFrustum(ballX - aimPad, 0.3, ballZ + aimPad);
      checkPointFrustum(ballX + aimPad, 0.3, ballZ + aimPad);

      _camLookAt.set(focusX, 0.1, focusZ);
      _camTargetPos.set(
        focusX + camBackX * cosPitch * requiredR,
        sinPitch * requiredR,
        focusZ + camBackZ * cosPitch * requiredR
      );
    }

    let snapCameraNextFrame = true;
    const _currentLookAt = new THREE.Vector3(0, 0.1, 0);

    function buildHintVisual() {
      if (physicsState.isMoving || physicsState.isSunk) return;
      while (hintGroup.children.length > 0) {
        hintGroup.remove(hintGroup.children[0]);
      }
      hintTrajectoryDots.length = 0;
      hintTargetBeaconMesh = null;
      hintCupBeaconMesh = null;

      const hintResult = computeHintTrajectory(
        stateRef.current.course,
        physicsState.x,
        physicsState.z,
        clock.getElapsedTime()
      );

      const pts = hintResult.points;
      for (let i = 1; i < pts.length; i++) {
        const [wx, wz] = pts[i];
        const dot = new THREE.Mesh(sharedGeos.hintDot, sharedMats.hintDot);
        dot.position.set(wx, 0.22, wz);
        const baseScale = Math.max(0.65, 1.05 - (i / pts.length) * 0.35);
        dot.scale.setScalar(baseScale);
        hintGroup.add(dot);
        hintTrajectoryDots.push(dot);
      }

      // Add Target Beacon on fairway turf
      const [tx, tz] = hintResult.targetPoint;
      const targetBeacon = new THREE.Mesh(sharedGeos.hintBeacon, sharedMats.hintBeacon);
      targetBeacon.position.set(tx, 0.192, tz);
      hintGroup.add(targetBeacon);
      hintTargetBeaconMesh = targetBeacon;

      if (hintResult.isHoleInOne) {
        const cupBeacon = new THREE.Mesh(sharedGeos.hintCupBeacon, sharedMats.hintCupBeacon);
        cupBeacon.position.set(stateRef.current.course.hole[0], 0.194, stateRef.current.course.hole[1]);
        hintGroup.add(cupBeacon);
        hintCupBeaconMesh = cupBeacon;
      }

      hintGroup.visible = true;
      hintHideTimer = 7.5;

      callbacksRef.current.onHintInfo?.({
        powerPercent: hintResult.recommendedPower,
        isHoleInOne: hintResult.isHoleInOne,
      });
    }

    function updateBallSkinMaterial() {
      const mp = stateRef.current.multiplayerState;
      if (mp && mp.isMultiplayer) {
        updateMultiplayerSkins();
      } else {
        const skin = stateRef.current.ballSkin;
        applyActiveBallModel(skin);
      }
    }

    stateRef.current.rebuildCourse = buildCourseScene;
    stateRef.current.updateBallMaterial = updateBallSkinMaterial;
    stateRef.current.triggerHint = buildHintVisual;
    stateRef.current.resetBall = resetBallState;

    buildCourseScene();

    const unsubscribeNature = natureAssets.onLoaded(() => {
      if (activeNatureGroup && stateRef.current.course) {
        const activeCourse = stateRef.current.course;
        const isPlayMode = stateRef.current.mode === 'play';
        const bounds = getCourseBounds(activeCourse);
        populateNatureDecor(activeNatureGroup, activeCourse, bounds, isPlayMode);
      }
    });

    const unsubscribeWindmill = onWindmillLoaded(() => {
      if (activeNatureGroup && stateRef.current.course) {
        const activeCourse = stateRef.current.course;
        const isPlayMode = stateRef.current.mode === 'play';
        const bounds = getCourseBounds(activeCourse);
        populateNatureDecor(activeNatureGroup, activeCourse, bounds, isPlayMode);
      }
    });

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // 8. High-DPI Mobile & PC Aiming with Sub-Pixel Exponential Smoothing & Non-Linear Precision Curve
    let isDragging = false;
    let dragStartClientX = 0;
    let dragStartClientY = 0;
    let rawDxPx = 0;
    let rawDyPx = 0;
    let smoothedDxPx = 0;
    let smoothedDyPx = 0;
    let currentShotPower = 0;
    let lastReportedPower = -1;

    function cancelActiveDrag() {
      if (!isDragging) return;
      isDragging = false;
      aimGroup.visible = false;
      currentShotPower = 0;
      lastReportedPower = 0;
      callbacksRef.current.onPowerChange(0);
      const mp = stateRef.current.multiplayerState;
      if (mp?.isMultiplayer && mp.status === 'connected') {
        multiplayerManager.sendCancelAim();
      }
    }

    function onPointerDown(e: PointerEvent) {
      if (stateRef.current.mode !== 'play') return;
      const mp = stateRef.current.multiplayerState;
      const isMp = !!(mp && mp.isMultiplayer && mp.status === 'connected');

      if (isMp) {
        const isHost = mp.isHost;
        const currentTurn = mp.currentTurn;
        const isMyTurn = (isHost && currentTurn === 'p1') || (!isHost && currentTurn === 'p2');
        if (!isMyTurn) return; // Opponent's turn!
        if (physicsState.isMoving || physicsState2.isMoving) return; // Wait for both balls to stop
        const myBall = isHost ? physicsState : physicsState2;
        if (myBall.isSunk) return;
      } else {
        if (physicsState.isMoving || physicsState.isSunk) return;
      }

      if (clubSwingState.active) {
        clubSwingState.active = false;
        clubGroup.visible = false;
      }
      if (e.button !== 0 && e.pointerType === 'mouse') return;

      soundEngine.startMusic();
      soundEngine.preloadSamples();

      isDragging = true;
      dragStartClientX = e.clientX;
      dragStartClientY = e.clientY;
      rawDxPx = 0;
      rawDyPx = 0;
      smoothedDxPx = 0;
      smoothedDyPx = 0;
      currentShotPower = 0;
      lastReportedPower = 0;
      aimGroup.position.set(0, 0, 0);
      aimGroup.visible = false;
      try {
        renderer.domElement.setPointerCapture(e.pointerId);
      } catch {}
    }

    function onPointerMove(e: PointerEvent) {
      if (!isDragging || stateRef.current.mode !== 'play') return;
      if (clubSwingState.active) return;
      const mp = stateRef.current.multiplayerState;
      const isMp = !!(mp && mp.isMultiplayer && mp.status === 'connected');
      const myState = (isMp && !mp.isHost) ? physicsState2 : physicsState;
      if (myState.isMoving || myState.isSunk) {
        cancelActiveDrag();
        return;
      }

      rawDxPx = e.clientX - dragStartClientX;
      rawDyPx = e.clientY - dragStartClientY;
    }

    function updateSmoothedAimVisuals(dt: number) {
      if (!isDragging || stateRef.current.mode !== 'play') return;

      // Sub-pixel exponential smoothing (eliminates high-DPI capacitive touch jitter)
      const smoothFactor = 1 - Math.exp(-26 * dt);
      smoothedDxPx += (rawDxPx - smoothedDxPx) * smoothFactor;
      smoothedDyPx += (rawDyPx - smoothedDyPx) * smoothFactor;

      const pullDistPx = Math.hypot(smoothedDxPx, smoothedDyPx);
      const deadzonePx = 5.5;

      if (pullDistPx < deadzonePx) {
        currentShotPower = 0;
        aimGroup.visible = false;
        if (lastReportedPower !== 0) {
          lastReportedPower = 0;
          callbacksRef.current.onPowerChange(0);
        }
        return;
      }

      const rect = renderer.domElement.getBoundingClientRect();
      const maxPullPx = Math.max(92, Math.min(148, Math.min(rect.width, rect.height) * 0.32));
      const linearRatio = Math.min(1, (pullDistPx - deadzonePx) / (maxPullPx - deadzonePx));
      const normalizedPower = Math.pow(linearRatio, 1.22);
      currentShotPower = normalizedPower;

      const roundedPower = Math.round(normalizedPower * 100);
      if (roundedPower !== lastReportedPower) {
        lastReportedPower = roundedPower;
        callbacksRef.current.onPowerChange(roundedPower);
      }

      // Slingshot direction rotated by current smart camera azimuth
      const aimRight = -smoothedDxPx / pullDistPx;
      const aimForward = smoothedDyPx / pullDistPx;

      const activeCourse = stateRef.current.course;
      const baseAngle = getSmartBaseCameraAngle(activeCourse, camera.aspect);
      const totalAngle = baseAngle + stateRef.current.cameraAngleOffset;
      const cosA = Math.cos(totalAngle);
      const sinA = Math.sin(totalAngle);

      currentAimDirX = aimRight * cosA + aimForward * -sinA;
      currentAimDirZ = aimRight * -sinA + aimForward * -cosA;

      // Update Aiming Ring around local player's Ball & Short Non-Bouncing Direction Pointer
      const mp = stateRef.current.multiplayerState;
      const isMp = !!(mp && mp.isMultiplayer && mp.status === 'connected');
      const myBall = (isMp && !mp.isHost) ? physicsState2 : physicsState;

      aimGroup.visible = true;
      aimRing.position.set(myBall.x, 0.19, myBall.z);

      const hue = (1 - normalizedPower) * 0.33;
      aimRingMat.color.setHSL(hue, 0.92, 0.55);
      aimRing.scale.setScalar(0.85 + normalizedPower * 0.65);

      const visibleDots = Math.max(2, Math.min(5, Math.floor(2 + normalizedPower * 3.5)));
      const shortLen = 0.32 + normalizedPower * 0.95;
      const previewPts = computeShortAimPoints(
        myBall.x,
        myBall.z,
        currentAimDirX,
        currentAimDirZ,
        shortLen,
        currentWalls,
        activeCourse,
        visibleDots
      );

      for (let i = 0; i < aimDots.length; i++) {
        const dot = aimDots[i];
        if (i < previewPts.length) {
          dot.visible = true;
          const [px, pz] = previewPts[i];
          dot.position.set(px, 0.25, pz);
          const scale = Math.max(0.55, 1.05 - i * 0.11);
          dot.scale.setScalar(scale);
          (dot.material as THREE.MeshBasicMaterial).color.setHSL(hue, 0.92, 0.6);
        } else {
          dot.visible = false;
        }
      }

      if (isMp) {
        multiplayerManager.sendAim(currentAimDirX, currentAimDirZ, currentShotPower);
      }
    }

    function onPointerUp(e: PointerEvent) {
      if (!isDragging) return;
      isDragging = false;
      aimGroup.visible = false;
      try {
        renderer.domElement.releasePointerCapture(e.pointerId);
      } catch {}

      const mp = stateRef.current.multiplayerState;
      const isMp = !!(mp && mp.isMultiplayer && mp.status === 'connected');
      const myBall = (isMp && !mp.isHost) ? physicsState2 : physicsState;

      if (isMp) {
        multiplayerManager.sendCancelAim();
      }

      if (currentShotPower > 0.03 && !myBall.isMoving && !myBall.isSunk && !clubSwingState.active) {
        if (isMp) {
          multiplayerManager.sendStroke(currentAimDirX, currentAimDirZ, currentShotPower);
        }

        // Trigger realistic golf club strike swing (downswing -> impact -> follow-through)
        const pullbackDist = BALL_RADIUS + 0.08 + currentShotPower * 0.45;
        const liftY = currentShotPower * 0.06;
        const tiltX = -currentShotPower * 0.14;

        clubSwingState.active = true;
        clubSwingState.phase = 'swing';
        clubSwingState.timer = 0;
        clubSwingState.duration = 0.14;
        clubSwingState.impactTime = 0.05;
        clubSwingState.ballLaunched = false;
        clubSwingState.originX = myBall.x;
        clubSwingState.originZ = myBall.z;
        clubSwingState.pullbackDist = pullbackDist;
        clubSwingState.strikePower = currentShotPower;
        clubSwingState.strikeDirX = currentAimDirX;
        clubSwingState.strikeDirZ = currentAimDirZ;
        clubSwingState.fadeTimer = 0;

        const myBallIsOnTee = (myBall === physicsState ? isBall1OnTee : isBall2OnTee);
        const myElev = myBallIsOnTee ? teeElevation : 0;
        clubSwingState.elevY = myElev;

        // Position club immediately at the cocked backswing position upon release
        clubGroup.position.set(
          myBall.x - currentAimDirX * pullbackDist,
          CLUB_BASE_Y + myElev + liftY,
          myBall.z - currentAimDirZ * pullbackDist
        );
        clubGroup.rotation.set(tiltX, Math.atan2(currentAimDirX, currentAimDirZ), 0);
        clubGroup.scale.setScalar(1);
        clubShadowMat.opacity = Math.max(0.18, 0.42 - liftY * 2.5);
        clubGroup.visible = true;
        hintGroup.visible = false;
      hintHideTimer = 0;
      callbacksRef.current.onHintInfo?.(null);
      }
      currentShotPower = 0;
      lastReportedPower = 0;
      callbacksRef.current.onPowerChange(0);
    }

    // Multiplayer Remote Aim, Stroke & Sync Handlers
    const unsubscribeRemoteAim = multiplayerManager.onRemoteAim((aim) => {
      const mp = stateRef.current.multiplayerState;
      if (!mp || !mp.isMultiplayer || mp.status !== 'connected') return;
      const remoteBall = mp.isHost ? physicsState2 : physicsState;

      if (!aim) {
        remoteAimGroup.visible = false;
        if (!clubSwingState2.active) clubGroup2.visible = false;
        return;
      }

      remoteAimGroup.visible = true;
      remoteAimRing.position.set(remoteBall.x, 0.19, remoteBall.z);

      const hue = (1 - aim.power) * 0.33;
      remoteAimRingMat.color.setHSL(hue, 0.92, 0.55);
      remoteAimRing.scale.setScalar(0.85 + aim.power * 0.65);

      const visibleDots = Math.max(2, Math.min(5, Math.floor(2 + aim.power * 3.5)));
      const shortLen = 0.32 + aim.power * 0.95;
      const rPoints = computeShortAimPoints(
        remoteBall.x,
        remoteBall.z,
        aim.dirX,
        aim.dirZ,
        shortLen,
        currentWalls,
        stateRef.current.course,
        visibleDots
      );
      for (let i = 0; i < remoteAimDots.length; i++) {
        const dot = remoteAimDots[i];
        if (i < rPoints.length) {
          dot.visible = true;
          const [px, pz] = rPoints[i];
          dot.position.set(px, 0.25, pz);
          const scale = Math.max(0.55, 1.05 - i * 0.11);
          dot.scale.setScalar(scale);
          (dot.material as THREE.MeshBasicMaterial).color.setHSL(hue, 0.92, 0.6);
        } else {
          dot.visible = false;
        }
      }

      if (!clubSwingState2.active) {
        const pullbackDist = BALL_RADIUS + 0.08 + aim.power * 0.45;
        const liftY = aim.power * 0.06;
        const tiltX = -aim.power * 0.14;
        clubGroup2.position.set(
          remoteBall.x - aim.dirX * pullbackDist,
          CLUB_BASE_Y + liftY,
          remoteBall.z - aim.dirZ * pullbackDist
        );
        clubGroup2.rotation.set(tiltX, Math.atan2(aim.dirX, aim.dirZ), 0);
        clubGroup2.scale.setScalar(1);
        clubShadowMat2.opacity = Math.max(0.18, 0.42 - liftY * 2.5);
        // Hide opponent's club while they're aiming — aim dots/ring give enough feedback
        clubGroup2.visible = false;
      }
    });

    const unsubscribeRemoteStroke = multiplayerManager.onRemoteStroke((stroke) => {
      const mp = stateRef.current.multiplayerState;
      if (!mp || !mp.isMultiplayer || mp.status !== 'connected') return;
      const remoteBall = mp.isHost ? physicsState2 : physicsState;
      remoteAimGroup.visible = false;

      const pullbackDist = BALL_RADIUS + 0.08 + stroke.power * 0.45;
      const liftY = stroke.power * 0.06;
      const tiltX = -stroke.power * 0.14;

      clubSwingState2.active = true;
      clubSwingState2.phase = 'swing';
      clubSwingState2.timer = 0;
      clubSwingState2.duration = 0.14;
      clubSwingState2.impactTime = 0.05;
      clubSwingState2.ballLaunched = false;
      clubSwingState2.originX = remoteBall.x;
      clubSwingState2.originZ = remoteBall.z;
      clubSwingState2.pullbackDist = pullbackDist;
      clubSwingState2.strikePower = stroke.power;
      clubSwingState2.strikeDirX = stroke.dirX;
      clubSwingState2.strikeDirZ = stroke.dirZ;
      clubSwingState2.fadeTimer = 0;

      const remoteBallIsOnTee = (!mp.isHost ? isBall1OnTee : isBall2OnTee);
      const remoteElev = remoteBallIsOnTee ? teeElevation : 0;
      clubSwingState2.elevY = remoteElev;

      clubGroup2.position.set(
        remoteBall.x - stroke.dirX * pullbackDist,
        CLUB_BASE_Y + remoteElev + liftY,
        remoteBall.z - stroke.dirZ * pullbackDist
      );
      clubGroup2.rotation.set(tiltX, Math.atan2(stroke.dirX, stroke.dirZ), 0);
      clubGroup2.scale.setScalar(1);
      clubShadowMat2.opacity = Math.max(0.18, 0.42 - liftY * 2.5);
      // Club appears only during the swing animation frames below, not at stroke receipt
      clubGroup2.visible = false;
    });

    const unsubscribeSync = multiplayerManager.onSync((data) => {
      const mp = stateRef.current.multiplayerState;
      if (!mp || mp.isHost) return; // Guest receives sync snapshot
      physicsState.x = data.b1.x;
      physicsState.z = data.b1.z;
      physicsState.vx = data.b1.vx;
      physicsState.vz = data.b1.vz;
      physicsState.isMoving = data.b1.isMoving;
      physicsState.isSunk = data.b1.isSunk;
      physicsState.sinkProgress = data.b1.sinkProgress;

      physicsState2.x = data.b2.x;
      physicsState2.z = data.b2.z;
      physicsState2.vx = data.b2.vx;
      physicsState2.vz = data.b2.vz;
      physicsState2.isMoving = data.b2.isMoving;
      physicsState2.isSunk = data.b2.isSunk;
      physicsState2.sinkProgress = data.b2.sinkProgress;
      if (typeof data.turnTimeRemaining === 'number') {
        multiplayerManager.setTurnTimeRemaining(data.turnTimeRemaining);
      }
    });

    const unsubscribeTimeout = multiplayerManager.onTimeout(() => {
      cancelActiveDrag();
      soundEngine.playWallBounce(1.0);
    });

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isDragging) {
        cancelActiveDrag();
      }
    }

    const domElem = renderer.domElement;
    domElem.addEventListener('pointerdown', onPointerDown);
    domElem.addEventListener('pointermove', onPointerMove);
    domElem.addEventListener('pointerup', onPointerUp);
    domElem.addEventListener('pointercancel', cancelActiveDrag);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('blur', cancelActiveDrag);

    // 9. Responsive Resize Handler
    function onResize() {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    window.addEventListener('resize', onResize);
    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(container);

    // 10. Animation Loop with Software-WebGL fenceSync Pacing
    const clock = new THREE.Clock();
    let frameId = 0;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (!gl || !gl.fenceSync) {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (isDisposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      if (isDisposed) return;
      const rawDt = clock.getDelta();
      const dt = Math.min(rawDt, 0.05);
      const elapsed = clock.getElapsedTime();

      const currentMode = stateRef.current.mode;
      const activeCourse = stateRef.current.course;

      // Animate swimming Koi fish in Chinese Garden Koi Pond
      if (koiActors.length > 0) {
        for (const koi of koiActors) {
          const t = elapsed * koi.speed + koi.phase;
          const nextX = koi.centerX + Math.cos(t) * koi.radiusX;
          const nextZ = koi.centerZ + Math.sin(t) * koi.radiusZ;
          const dxKoi = -Math.sin(t) * koi.radiusX * koi.speed;
          const dzKoi = Math.cos(t) * koi.radiusZ * koi.speed;
          koi.group.position.set(nextX, 0.028, nextZ);
          koi.group.rotation.y = Math.atan2(dxKoi, dzKoi) + Math.sin(elapsed * 9 + koi.phase) * 0.08;
        }
      }

      // Animate spinning windmill blades
      if (activeWindmillInstance?.blades) {
        activeWindmillInstance.blades.rotation.z += dt * activeWindmillInstance.spinSpeed;
      }

      // Hint animation & auto-fade
      if (hintGroup.visible) {
        if (hintHideTimer > 0) {
          hintHideTimer -= dt;
          if (hintHideTimer <= 0) {
            hintGroup.visible = false;
            hintHideTimer = 0;
            callbacksRef.current.onHintInfo?.(null);
          }
        }

        // Animate forward glowing wave along trajectory beads
        const waveTime = elapsed * 8.0;
        for (let i = 0; i < hintTrajectoryDots.length; i++) {
          const dot = hintTrajectoryDots[i];
          const wave = Math.sin(waveTime - i * 0.38);
          const pulse = 0.82 + 0.38 * Math.max(0, wave);
          dot.scale.setScalar(pulse);
        }

        // Pulse landing beacon ring
        if (hintTargetBeaconMesh) {
          const bPulse = 1.0 + 0.16 * Math.sin(elapsed * 5.0);
          hintTargetBeaconMesh.scale.set(bPulse, bPulse, 1);
        }
        if (hintCupBeaconMesh) {
          const cPulse = 1.0 + 0.22 * Math.sin(elapsed * 6.0);
          hintCupBeaconMesh.scale.set(cPulse, cPulse, 1);
        }
      }

      // Animate moving blocks
      if (activeCourse.movingBlocks) {
        for (const item of movingBlockMeshes) {
          const mb = activeCourse.movingBlocks[item.index];
          if (!mb) continue;
          const phase = mb.phase ?? 0;
          const offset = Math.sin(elapsed * mb.speed + phase) * mb.range;
          if (mb.axis === 'x') {
            item.mesh.position.x = mb.x + offset;
          } else {
            item.mesh.position.z = mb.z + offset;
          }
        }
      }

      // Smoothly decay bumper hit scale pulse
      for (const bMesh of bumperMeshes) {
        bMesh.scale.x = THREE.MathUtils.damp(bMesh.scale.x, 1, 12, dt);
        bMesh.scale.z = THREE.MathUtils.damp(bMesh.scale.z, 1, 12, dt);
      }

      // Animate Realistic Wind Flutter & Waving on the Flag Pennant (Pole remains 100% static in the cup)
      if (activeFlagGeo && activeFlagBasePos && activeFlagU) {
        const posAttr = activeFlagGeo.attributes.position;
        const posArr = posAttr.array as Float32Array;
        const count = posAttr.count;

        for (let i = 0; i < count; i++) {
          const u = activeFlagU[i]; // 0 at pole, 1 at tip
          // Primary wind wave traveling from pole to tip + secondary ripple + high-frequency flutter
          const wave1 = Math.sin(u * 6.5 - elapsed * 7.2) * 0.065 * u;
          const wave2 = Math.sin(u * 13.0 - elapsed * 11.5) * 0.024 * u;
          const wave3 = Math.cos(u * 3.0 - elapsed * 3.8) * 0.016 * u;

          posArr[i * 3 + 2] = activeFlagBasePos[i * 3 + 2] + wave1 + wave2 + wave3;
        }
        posAttr.needsUpdate = true;
        activeFlagGeo.computeVertexNormals();
      }

      if (flagPennantMesh) {
        // Natural wind angle sway around the pole (the pole stays 100% fixed, only the cloth swings slightly)
        flagPennantMesh.rotation.y = Math.sin(elapsed * 2.2) * 0.08 + Math.cos(elapsed * 1.5) * 0.04;
      }

      // Step 3D Particles & Shockwave Rings
      updateParticles(dt);

      const viewportWidth = container?.clientWidth || window.innerWidth;
      const isDesktopLayout = viewportWidth >= 1024;
      const isTabletLayout = viewportWidth >= 768 && viewportWidth < 1024;

      if (currentMode === 'menu') {
        clubGroup.visible = false;

        // Dynamic size extent factor based on course dimensions so all courses
        // (including wider/longer courses like Hole 3, 6, 8) are framed with generous breathing room
        const menuBounds = getCourseBounds(activeCourse);
        const extentFactor = Math.max(
          1.0,
          Math.max(menuBounds.width / 5.2, menuBounds.depth / 9.0) * 0.92
        );

        if (isDesktopLayout) {
          // PC Main Menu Layout: Floating Island on Left Half, Menu on Right Half
          islandRoot.rotation.x = 0.32;
          islandRoot.rotation.z = 0.24;
          islandRoot.rotation.y = -0.35 + Math.sin(elapsed * 0.5) * 0.08;
          islandRoot.position.set(-4.6, -0.4 + Math.sin(elapsed * 1.3) * 0.18, 0);

          camera.position.set(0, 24.5 * extentFactor, 22.0 * extentFactor);
          camera.lookAt(0, -0.6, 0);
        } else if (isTabletLayout) {
          // Tablet Main Menu Layout: Large Floating Island in Upper Center above Tablet Dock
          islandRoot.rotation.x = 0.34;
          islandRoot.rotation.z = 0.22;
          islandRoot.rotation.y = -0.38 + Math.sin(elapsed * 0.52) * 0.09;
          islandRoot.position.set(0, 3.4 + Math.sin(elapsed * 1.3) * 0.18, 0);

          const tabScale = camera.aspect < 1 ? Math.min(1.25, 0.95 / Math.max(0.6, camera.aspect)) : 1.0;
          camera.position.set(0, 25.5 * tabScale * extentFactor, 24.0 * tabScale * extentFactor);
          camera.lookAt(0, -0.9, 0);
        } else {
          // Mobile Main Menu Layout: Floating Island in Upper Half, Menu in Lower Half
          islandRoot.rotation.x = 0.36;
          islandRoot.rotation.z = 0.2;
          islandRoot.rotation.y = -0.42 + Math.sin(elapsed * 0.55) * 0.1;
          islandRoot.position.set(0, 3.8 + Math.sin(elapsed * 1.3) * 0.18, 0);

          const aspectScale = camera.aspect < 1 ? Math.min(1.48, 0.90 / Math.max(0.45, camera.aspect)) : 1.08;
          camera.position.set(0, 27.5 * aspectScale * extentFactor, 26.5 * aspectScale * extentFactor);
          camera.lookAt(0, -1.2, 0);
        }
      } else {
        islandRoot.rotation.set(0, 0, 0);
        islandRoot.position.set(0, 0, 0);

        const baseAngle = getSmartBaseCameraAngle(activeCourse, camera.aspect);
        const totalAngle = baseAngle + stateRef.current.cameraAngleOffset;

        const mp = stateRef.current.multiplayerState;
        const isMp = !!(mp && mp.isMultiplayer && mp.status === 'connected');
        const targetBallX = (isMp && mp.currentTurn === 'p2') ? physicsState2.x : physicsState.x;
        const targetBallZ = (isMp && mp.currentTurn === 'p2') ? physicsState2.z : physicsState.z;

        computeSmartPlayCamera(
          activeCourse,
          targetBallX,
          targetBallZ,
          totalAngle,
          camera.fov,
          camera.aspect
        );

        if (snapCameraNextFrame) {
          snapCameraNextFrame = false;
          camera.position.copy(_camTargetPos);
          _currentLookAt.copy(_camLookAt);
        } else {
          camera.position.x = THREE.MathUtils.damp(camera.position.x, _camTargetPos.x, 7.5, dt);
          camera.position.y = THREE.MathUtils.damp(camera.position.y, _camTargetPos.y, 7.5, dt);
          camera.position.z = THREE.MathUtils.damp(camera.position.z, _camTargetPos.z, 7.5, dt);
          _currentLookAt.x = THREE.MathUtils.damp(_currentLookAt.x, _camLookAt.x, 8.5, dt);
          _currentLookAt.y = THREE.MathUtils.damp(_currentLookAt.y, _camLookAt.y, 8.5, dt);
          _currentLookAt.z = THREE.MathUtils.damp(_currentLookAt.z, _camLookAt.z, 8.5, dt);
        }
        camera.lookAt(_currentLookAt);

        // Update smoothed high-DPI touch/mouse aiming visuals
        updateSmoothedAimVisuals(dt);

        // Animate 3D Golf Putter (Local Player)
        if (clubSwingState.active) {
          clubSwingState.timer += dt;
          const { timer, duration, impactTime, originX, originZ, pullbackDist, strikePower, strikeDirX, strikeDirZ } = clubSwingState;

          if (timer < impactTime) {
            // High-speed forward downswing toward ball surface
            const p = Math.min(1, timer / impactTime);
            const ease = p * p;
            const currentDist = pullbackDist - (pullbackDist - BALL_RADIUS) * ease;
            const liftY = (1 - ease) * (strikePower * 0.06);
            const tiltX = -(1 - ease) * (strikePower * 0.14);

            clubGroup.position.set(
              originX - strikeDirX * currentDist,
              CLUB_BASE_Y + clubSwingState.elevY + liftY,
              originZ - strikeDirZ * currentDist
            );
            clubGroup.rotation.set(tiltX, Math.atan2(strikeDirX, strikeDirZ), 0);
            clubGroup.scale.setScalar(1);
            clubGroup.visible = true;
            clubShadowMat.opacity = Math.max(0.18, 0.42 - liftY * 2.5);
          } else {
            // Impact moment!
            if (!clubSwingState.ballLaunched) {
              clubSwingState.ballLaunched = true;
              clubSwingState.phase = 'holdingFollowThrough';

              const speed = (0.14 + strikePower * 0.86) * MAX_SHOT_SPEED;
              const targetBall = (isMp && !mp.isHost) ? physicsState2 : physicsState;
              targetBall.vx = strikeDirX * speed;
              targetBall.vz = strikeDirZ * speed;
              targetBall.isMoving = true;
              hintGroup.visible = false;
      hintHideTimer = 0;
      callbacksRef.current.onHintInfo?.(null);

              // Contact point between putter face and ball
              const contactX = originX - strikeDirX * BALL_RADIUS;
              const contactZ = originZ - strikeDirZ * BALL_RADIUS;

              spawnLaunchBurst(
                contactX,
                contactZ,
                strikeDirX,
                strikeDirZ,
                strikePower
              );
              soundEngine.playPutt(strikePower);

              if (isMp) {
                if (mp.isHost) {
                  multiplayerManager.recordStroke('p1');
                } else {
                  multiplayerManager.recordStroke('p2');
                }
                // Strict alternating: flip turn immediately after the shot fires
                if (!physicsState.isSunk && !physicsState2.isSunk) {
                  multiplayerManager.setTurn(mp.currentTurn === 'p1' ? 'p2' : 'p1');
                }
              } else {
                callbacksRef.current.onStrokeIncrement();
              }
            }

            // Follow-through phase
            const followProgress = Math.min(1, (timer - impactTime) / Math.max(0.001, duration - impactTime));
            const easeOut = 1 - Math.pow(1 - followProgress, 2);
            const followDist = BALL_RADIUS - 0.20 * easeOut;
            const followTilt = easeOut * 0.14;

            clubGroup.position.set(
              originX - strikeDirX * followDist,
              CLUB_BASE_Y + clubSwingState.elevY,
              originZ - strikeDirZ * followDist
            );
            clubGroup.rotation.set(followTilt, Math.atan2(strikeDirX, strikeDirZ), 0);

            const localBall = (isMp && !mp.isHost) ? physicsState2 : physicsState;
            if (!localBall.isMoving || localBall.isSunk) {
              clubSwingState.fadeTimer += dt;
              if (clubSwingState.fadeTimer >= 0.25) {
                clubSwingState.active = false;
                clubGroup.visible = false;
                clubGroup.scale.setScalar(1);
                clubShadowMat.opacity = 0.42;
              } else {
                const fadeNorm = clubSwingState.fadeTimer / 0.25;
                clubGroup.scale.setScalar(Math.max(0.01, 1 - fadeNorm * 0.85));
                clubShadowMat.opacity = 0.42 * (1 - fadeNorm);
              }
            } else {
              clubGroup.scale.setScalar(1);
              clubShadowMat.opacity = 0.42;
            }
          }
        } else {
          clubGroup.visible = false;
        }

        // Animate 3D Golf Putter (Remote Opponent Player in Multiplayer)
        if (clubSwingState2.active) {
          clubSwingState2.timer += dt;
          const { timer, duration, impactTime, originX, originZ, pullbackDist, strikePower, strikeDirX, strikeDirZ } = clubSwingState2;

          if (timer < impactTime) {
            const p = Math.min(1, timer / impactTime);
            const ease = p * p;
            const currentDist = pullbackDist - (pullbackDist - BALL_RADIUS) * ease;
            const liftY = (1 - ease) * (strikePower * 0.06);
            const tiltX = -(1 - ease) * (strikePower * 0.14);

            clubGroup2.position.set(
              originX - strikeDirX * currentDist,
              CLUB_BASE_Y + clubSwingState2.elevY + liftY,
              originZ - strikeDirZ * currentDist
            );
            clubGroup2.rotation.set(tiltX, Math.atan2(strikeDirX, strikeDirZ), 0);
            clubGroup2.scale.setScalar(1);
            clubGroup2.visible = true;
            clubShadowMat2.opacity = Math.max(0.18, 0.42 - liftY * 2.5);
          } else {
            if (!clubSwingState2.ballLaunched) {
              clubSwingState2.ballLaunched = true;
              clubSwingState2.phase = 'holdingFollowThrough';

              const speed = (0.14 + strikePower * 0.86) * MAX_SHOT_SPEED;
              const targetBall = (isMp && mp.isHost) ? physicsState2 : physicsState;
              targetBall.vx = strikeDirX * speed;
              targetBall.vz = strikeDirZ * speed;
              targetBall.isMoving = true;

              const contactX = originX - strikeDirX * BALL_RADIUS;
              const contactZ = originZ - strikeDirZ * BALL_RADIUS;

              spawnLaunchBurst(
                contactX,
                contactZ,
                strikeDirX,
                strikeDirZ,
                strikePower
              );
              soundEngine.playPutt(strikePower);

              if (isMp) {
                if (mp.isHost) {
                  multiplayerManager.recordStroke('p2');
                } else {
                  multiplayerManager.recordStroke('p1');
                }
                // Strict alternating: flip turn immediately after the shot fires
                if (!physicsState.isSunk && !physicsState2.isSunk) {
                  multiplayerManager.setTurn(mp.currentTurn === 'p1' ? 'p2' : 'p1');
                }
              }
            }

            const followProgress = Math.min(1, (timer - impactTime) / Math.max(0.001, duration - impactTime));
            const easeOut = 1 - Math.pow(1 - followProgress, 2);
            const followDist = BALL_RADIUS - 0.20 * easeOut;
            const followTilt = easeOut * 0.14;

            clubGroup2.position.set(
              originX - strikeDirX * followDist,
              CLUB_BASE_Y + clubSwingState2.elevY,
              originZ - strikeDirZ * followDist
            );
            clubGroup2.rotation.set(followTilt, Math.atan2(strikeDirX, strikeDirZ), 0);

            const remoteBall = (isMp && mp.isHost) ? physicsState2 : physicsState;
            if (!remoteBall.isMoving || remoteBall.isSunk) {
              clubSwingState2.fadeTimer += dt;
              if (clubSwingState2.fadeTimer >= 0.25) {
                clubSwingState2.active = false;
                clubGroup2.visible = false;
                clubGroup2.scale.setScalar(1);
                clubShadowMat2.opacity = 0.42;
              } else {
                const fadeNorm = clubSwingState2.fadeTimer / 0.25;
                clubGroup2.scale.setScalar(Math.max(0.01, 1 - fadeNorm * 0.85));
                clubShadowMat2.opacity = 0.42 * (1 - fadeNorm);
              }
            } else {
              clubGroup2.scale.setScalar(1);
              clubShadowMat2.opacity = 0.42;
            }
          }
        }

        // Step Ball Physics (Single Player or Authoritative Host Multiplayer)
        const prevX1 = physicsState.x;
        const prevZ1 = physicsState.z;
        const prevX2 = physicsState2.x;
        const prevZ2 = physicsState2.z;

        let events: any = null;

        if (!isMp) {
          events = stepBallPhysics(physicsState, activeCourse, currentWalls, dt, elapsed);

          if (events.wallHitIntensity > 0) {
            soundEngine.playWallBounce(events.wallHitIntensity);
            spawnImpactBurst(events.hitX, events.hitZ, events.hitNx, events.hitNz, events.wallHitIntensity, false);
          }
          if (events.bumperHitIndex >= 0 && bumperMeshes[events.bumperHitIndex]) {
            bumperMeshes[events.bumperHitIndex].scale.set(1.28, 1.0, 1.28);
            soundEngine.playBumperBounce();
            spawnImpactBurst(events.hitX, events.hitZ, events.hitNx, events.hitNz, 0.95, true);
          }
          if (events.sunkJustNow) {
            soundEngine.playHoleSink();
            spawnSinkBurst(activeCourse.hole[0], activeCourse.hole[1]);
            callbacksRef.current.onHoleComplete();
          }
        } else {
          if (mp.isHost) {
            const mpSim = stepMultiplayerPhysics(physicsState, physicsState2, activeCourse, currentWalls, dt, elapsed);
            events = mpSim.events1;
            const events2 = mpSim.events2;

            // Physical Ball-on-Ball Bumping!
            if (mpSim.ballCollision && mpSim.ballCollision.collided) {
              const bbc = mpSim.ballCollision;
              soundEngine.playWallBounce(Math.min(1.0, bbc.intensity));
              spawnImpactBurst(bbc.contactX, bbc.contactZ, 0, 1, Math.min(1.0, bbc.intensity), true);
            }

            // Ball 1 events
            if (events.wallHitIntensity > 0) {
              soundEngine.playWallBounce(events.wallHitIntensity);
              spawnImpactBurst(events.hitX, events.hitZ, events.hitNx, events.hitNz, events.wallHitIntensity, false);
            }
            if (events.bumperHitIndex >= 0 && bumperMeshes[events.bumperHitIndex]) {
              bumperMeshes[events.bumperHitIndex].scale.set(1.28, 1.0, 1.28);
              soundEngine.playBumperBounce();
              spawnImpactBurst(events.hitX, events.hitZ, events.hitNx, events.hitNz, 0.95, true);
            }
            if (events.sunkJustNow) {
              soundEngine.playHoleSink();
              spawnSinkBurst(activeCourse.hole[0], activeCourse.hole[1]);
            }

            // Ball 2 events
            if (events2.wallHitIntensity > 0) {
              soundEngine.playWallBounce(events2.wallHitIntensity);
              spawnImpactBurst(events2.hitX, events2.hitZ, events2.hitNx, events2.hitNz, events2.wallHitIntensity, false);
            }
            if (events2.bumperHitIndex >= 0 && bumperMeshes[events2.bumperHitIndex]) {
              bumperMeshes[events2.bumperHitIndex].scale.set(1.28, 1.0, 1.28);
              soundEngine.playBumperBounce();
              spawnImpactBurst(events2.hitX, events2.hitZ, events2.hitNx, events2.hitNz, 0.95, true);
            }
            if (events2.sunkJustNow) {
              soundEngine.playHoleSink();
              spawnSinkBurst(activeCourse.hole[0], activeCourse.hole[1]);
            }

            // Authoritative Host Turn Timer (35s per turn)
            const ballsStationary = !physicsState.isMoving && !physicsState2.isMoving && !clubSwingState.active && !clubSwingState2.active;
            const holeNotDone = !(physicsState.isSunk && physicsState2.isSunk);

            if (ballsStationary && holeNotDone) {
              const newTime = Math.max(0, mp.turnTimeRemaining - dt);
              if (newTime <= 0) {
                multiplayerManager.handleTimeout();
                soundEngine.playWallBounce(1.0);
              } else {
                multiplayerManager.setTurnTimeRemaining(newTime);
              }
            }

            // 30Hz network snapshot broadcast to Guest
            syncTimer += dt;
            if (syncTimer >= 0.033) {
              syncTimer = 0;
              multiplayerManager.sendSync({
                b1: { ...physicsState },
                b2: { ...physicsState2 },
                currentTurn: mp.currentTurn,
                p1Strokes: mp.p1Strokes,
                p2Strokes: mp.p2Strokes,
                holeNumber: activeCourse.holeNumber,
                turnTimeRemaining: mp.turnTimeRemaining,
              });
            }

            // Turn transition & hole finish logic when both balls have stopped
            // Strict alternating: turns are flipped immediately at shot-fire time above.
            // Here we only handle: hole completion and sunk-player overrides.
            if (!physicsState.isMoving && !physicsState2.isMoving && !clubSwingState.active && !clubSwingState2.active) {
              if (physicsState.isSunk && physicsState2.isSunk) {
                // Both holed — report result
                if (!isHoleFinishedReporting) {
                  isHoleFinishedReporting = true;
                  const winner: 'p1' | 'p2' | 'tie' =
                    mp.p1Strokes < mp.p2Strokes ? 'p1' : mp.p2Strokes < mp.p1Strokes ? 'p2' : 'tie';
                  callbacksRef.current.onMultiplayerHoleFinish?.(winner, mp.p1Strokes, mp.p2Strokes);
                }
              } else if (physicsState.isSunk && !physicsState2.isSunk) {
                // P1 already sunk — lock turn to P2 until they sink too
                if (mp.currentTurn !== 'p2') multiplayerManager.setTurn('p2');
              } else if (physicsState2.isSunk && !physicsState.isSunk) {
                // P2 already sunk — lock turn to P1 until they sink too
                if (mp.currentTurn !== 'p1') multiplayerManager.setTurn('p1');
              }
              // Both still active — turn was already flipped at shot-fire time, nothing more to do
            }
          }
        }

        // Emit Rolling Movement Trail Particles while ball 1 is moving
        if (physicsState.isMoving && !physicsState.isSunk) {
          const curSpeed = Math.hypot(physicsState.vx, physicsState.vz);
          if (curSpeed > 0.45) {
            const speedNorm = Math.min(1, curSpeed / MAX_SHOT_SPEED);
            trailEmitAccumulator += dt * (18 + speedNorm * 34);
            while (trailEmitAccumulator >= 1) {
              trailEmitAccumulator -= 1;
              const invSpd = 1 / curSpeed;
              const backX = -physicsState.vx * invSpd;
              const backZ = -physicsState.vz * invSpd;
              const jitterX = (Math.random() - 0.5) * 0.16;
              const jitterZ = (Math.random() - 0.5) * 0.16;
              const isChinese = activeCourse.theme === 'chinese-garden';
              const trailColor = (events && events.isOnSand)
                ? Math.random() > 0.4
                  ? 0xfde68a
                  : 0xf59e0b
                : isChinese
                ? Math.random() > 0.45
                  ? 0xffb8d1
                  : 0xffd43b
                : Math.random() > 0.35
                ? 0xffffff
                : 0xd9f99d;
              spawnParticle(
                physicsState.x + backX * 0.14 + jitterX,
                0.205,
                physicsState.z + backZ * 0.14 + jitterZ,
                backX * (0.25 + Math.random() * 0.45) + (Math.random() - 0.5) * 0.35,
                0.35 + Math.random() * 0.55,
                backZ * (0.25 + Math.random() * 0.45) + (Math.random() - 0.5) * 0.35,
                trailColor,
                0.42 + speedNorm * 0.42,
                0.22 + Math.random() * 0.16,
                1.2
              );
            }
          }
        } else {
          trailEmitAccumulator = 0;
        }

        // Update 3D Ball 1 Position & Rolling Rotation
        const dx1 = physicsState.x - prevX1;
        const dz1 = physicsState.z - prevZ1;
        const movedDist1 = Math.hypot(dx1, dz1);
        if (movedDist1 > 0.0001) {
          _ballRollAxis.set(dz1, 0, -dx1).normalize();
          ballRotGroup.rotateOnWorldAxis(_ballRollAxis, -movedDist1 / BALL_RADIUS);
        }

        if (physicsState.isMoving && isBall1OnTee) {
          isBall1OnTee = false;
          ball1TeeDropTimer = 0;
        }
        let curElev1 = 0;
        if (isBall1OnTee) {
          curElev1 = teeElevation;
        } else if (ball1TeeDropTimer < 0.16) {
          ball1TeeDropTimer += dt;
          const ratio = Math.min(1, ball1TeeDropTimer / 0.16);
          curElev1 = teeElevation * (1 - ratio * ratio);
        }

        if (physicsState.isSunk) {
          const dropY = 0.186 + BALL_RADIUS - physicsState.sinkProgress * 0.34;
          const shrink = Math.max(0.01, 1 - physicsState.sinkProgress * 0.65);
          ballGroup.position.set(physicsState.x, dropY, physicsState.z);
          ballGroup.scale.setScalar(shrink);
          ballShadow.visible = false;
        } else {
          ballGroup.position.set(physicsState.x, 0.186 + BALL_RADIUS + curElev1, physicsState.z);
          ballGroup.scale.setScalar(1);
          ballShadow.position.set(physicsState.x, 0.192, physicsState.z);
          ballShadow.visible = true;
        }

        // Update 3D Ball 2 Position & Rolling Rotation (Multiplayer)
        if (isMp) {
          const dx2 = physicsState2.x - prevX2;
          const dz2 = physicsState2.z - prevZ2;
          const movedDist2 = Math.hypot(dx2, dz2);
          if (movedDist2 > 0.0001) {
            _ballRollAxis.set(dz2, 0, -dx2).normalize();
            ballRotGroup2.rotateOnWorldAxis(_ballRollAxis, -movedDist2 / BALL_RADIUS);
          }

          if (physicsState2.isMoving && isBall2OnTee) {
            isBall2OnTee = false;
            ball2TeeDropTimer = 0;
          }
          let curElev2 = 0;
          if (isBall2OnTee) {
            curElev2 = teeElevation;
          } else if (ball2TeeDropTimer < 0.16) {
            ball2TeeDropTimer += dt;
            const ratio = Math.min(1, ball2TeeDropTimer / 0.16);
            curElev2 = teeElevation * (1 - ratio * ratio);
          }

          if (physicsState2.isSunk) {
            const dropY = 0.186 + BALL_RADIUS - physicsState2.sinkProgress * 0.34;
            const shrink = Math.max(0.01, 1 - physicsState2.sinkProgress * 0.65);
            ballGroup2.position.set(physicsState2.x, dropY, physicsState2.z);
            ballGroup2.scale.setScalar(shrink);
            ballShadow2.visible = false;
          } else {
            ballGroup2.position.set(physicsState2.x, 0.186 + BALL_RADIUS + curElev2, physicsState2.z);
            ballGroup2.scale.setScalar(1);
            ballShadow2.position.set(physicsState2.x, 0.192, physicsState2.z);
            ballShadow2.visible = true;
          }

          // Animate Turf Turn Marker Ring: ONLY visible and pulsing on the player whose turn is up (hidden while aiming to avoid double rings)
          const isAimingActive = aimGroup.visible || remoteAimGroup.visible;
          const pulse = 1.0 + 0.12 * Math.sin(elapsed * 6);
          if (mp.currentTurn === 'p1') {
            p1MarkerRing.position.set(physicsState.x, 0.191, physicsState.z);
            p1MarkerRing.scale.set(pulse, pulse, pulse);
            p1MarkerMat.opacity = 0.95;
            p1MarkerRing.visible = !physicsState.isSunk && !isAimingActive;
            p2MarkerRing.visible = false;
          } else {
            p2MarkerRing.position.set(physicsState2.x, 0.191, physicsState2.z);
            p2MarkerRing.scale.set(pulse, pulse, pulse);
            p2MarkerMat.opacity = 0.95;
            p2MarkerRing.visible = !physicsState2.isSunk && !isAimingActive;
            p1MarkerRing.visible = false;
          }
        } else {
          ballGroup2.visible = false;
          ballShadow2.visible = false;
          p1MarkerRing.visible = false;
          p2MarkerRing.visible = false;
        }
      }

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    frameId = requestAnimationFrame(tick);

    return () => {
      isDisposed = true;
      unsubscribeNature();
      unsubscribeWindmill();
      unsubscribeRemoteAim();
      unsubscribeRemoteStroke();
      unsubscribeSync();
      unsubscribeTimeout();
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('blur', cancelActiveDrag);
      resizeObserver.disconnect();
      domElem.removeEventListener('pointerdown', onPointerDown);
      domElem.removeEventListener('pointermove', onPointerMove);
      domElem.removeEventListener('pointerup', onPointerUp);
      domElem.removeEventListener('pointercancel', cancelActiveDrag);

      for (const g of disposableCourseGeos) g.dispose();
      for (const m of disposableCourseMats) m.dispose();
      Object.values(sharedGeos).forEach((g) => g.dispose());
      Object.values(sharedMats).forEach((m) => m.dispose());
      clubShadowGeo.dispose();
      clubShadowMat.dispose();
      clubShadowMat2.dispose();
      p1MarkerMat.dispose();
      p2MarkerMat.dispose();
      remoteAimRingMat.dispose();
      fallbackGeo.dispose();
      fallbackMat.dispose();

      particleGeo.dispose();
      shockwaveGeo.dispose();
      particlePool.forEach((p) => p.mat.dispose());
      shockwavePool.forEach((sw) => sw.mat.dispose());
      shadowTex.dispose();
      sandDiffuse.dispose();
      sandBump.dispose();
      renderer.dispose();
      if (container.contains(domElem)) {
        container.removeChild(domElem);
      }
    };
  }, []);

  useEffect(() => {
    const prevCourse = stateRef.current.course;
    const prevMode = stateRef.current.mode;
    stateRef.current.mode = mode;
    stateRef.current.course = course;
    stateRef.current.cameraAngleOffset = 0;

    if (prevCourse.holeNumber !== course.holeNumber || prevMode !== mode) {
      stateRef.current.rebuildCourse?.();
    }
  }, [mode, course]);

  useEffect(() => {
    stateRef.current.ballSkin = ballSkin;
    stateRef.current.updateBallMaterial?.();
  }, [ballSkin]);

  useEffect(() => {
    stateRef.current.multiplayerState = multiplayerState;
    stateRef.current.onMultiplayerHoleFinish = onMultiplayerHoleFinish;
    stateRef.current.updateBallMaterial?.();
  }, [multiplayerState, onMultiplayerHoleFinish]);

  const prevTriggersRef = useRef({
    rotate: rotateTrigger,
    hint: hintTrigger,
    retry: retryTrigger,
  });

  useEffect(() => {
    if (rotateTrigger === prevTriggersRef.current.rotate) return;
    prevTriggersRef.current.rotate = rotateTrigger;
    stateRef.current.cameraAngleOffset += Math.PI / 2;
  }, [rotateTrigger]);

  useEffect(() => {
    if (hintTrigger === prevTriggersRef.current.hint) return;
    prevTriggersRef.current.hint = hintTrigger;
    stateRef.current.triggerHint?.();
  }, [hintTrigger]);

  useEffect(() => {
    if (retryTrigger === prevTriggersRef.current.retry) return;
    prevTriggersRef.current.retry = retryTrigger;
    stateRef.current.cameraAngleOffset = 0;
    stateRef.current.resetBall?.();
  }, [retryTrigger]);

  return <div ref={mountRef} className="w-full h-full relative overflow-hidden touch-none" />;
};
