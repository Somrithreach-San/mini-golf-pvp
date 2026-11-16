import * as THREE from 'three';

export interface GolfBallSkin {
  id: string;
  name: string;
  subtitle: string;
  requiredStars: number;
  modelUrl: string;
  iconUrl: string;
  baseColor: string;
  accentColor: string;
  pattern: 'golf' | 'basketball' | 'tennis' | 'soccer' | 'bowling' | 'beach';
  metalness?: number;
  roughness?: number;
}

export const GOLF_BALL_SKINS: GolfBallSkin[] = [
  {
    id: 'golf',
    name: 'Golf Ball',
    subtitle: '',
    requiredStars: 0,
    modelUrl: '/assets/balls/golf.glb',
    iconUrl: '/assets/balls/golf_3d.png',
    baseColor: '#ffffff',
    accentColor: '#cbd5e1',
    pattern: 'golf',
    roughness: 0.25,
    metalness: 0.0,
  },
  {
    id: 'basketball',
    name: 'Basket Ball',
    subtitle: '',
    requiredStars: 0,
    modelUrl: '/assets/balls/basketball.glb',
    iconUrl: '/assets/balls/basketball_3d.png',
    baseColor: '#ea580c',
    accentColor: '#1e293b',
    pattern: 'basketball',
    roughness: 0.5,
    metalness: 0.0,
  },
  {
    id: 'tennis',
    name: 'Tennis Ball',
    subtitle: '',
    requiredStars: 3,
    modelUrl: '/assets/balls/tennis.glb',
    iconUrl: '/assets/balls/tennis_3d.png',
    baseColor: '#84cc16',
    accentColor: '#ffffff',
    pattern: 'tennis',
    roughness: 0.5,
    metalness: 0.0,
  },
  {
    id: 'soccer',
    name: 'Soccer Ball',
    subtitle: '',
    requiredStars: 6,
    modelUrl: '/assets/balls/soccer.glb',
    iconUrl: '/assets/balls/soccer_3d.png',
    baseColor: '#ffffff',
    accentColor: '#0f172a',
    pattern: 'soccer',
    roughness: 0.45,
    metalness: 0.0,
  },
  {
    id: 'bowling',
    name: 'Bowling Ball',
    subtitle: '',
    requiredStars: 9,
    modelUrl: '/assets/balls/bowling.glb',
    iconUrl: '/assets/balls/bowling_3d.png',
    baseColor: '#0f172a',
    accentColor: '#38bdf8',
    pattern: 'bowling',
    roughness: 0.18,
    metalness: 0.05,
  },
  {
    id: 'beach',
    name: 'Beach Ball',
    subtitle: '',
    requiredStars: 12,
    modelUrl: '/assets/balls/beach.glb',
    iconUrl: '/assets/balls/beach_3d.png',
    baseColor: '#ef4444',
    accentColor: '#3b82f6',
    pattern: 'beach',
    roughness: 0.22,
    metalness: 0.0,
  },
];

/**
 * Generates an iconic 2D canvas badge preview for the Ball Selection Modal.
 */
export function createBallCanvas(skin: GolfBallSkin, size = 128): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const half = size / 2;

  if (skin.pattern === 'golf') {
    // White dimpled golf ball
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, size, size);

    // Subtle dimple dots
    ctx.fillStyle = 'rgba(148, 163, 184, 0.45)';
    const rings = [
      { r: size * 0.15, count: 6 },
      { r: size * 0.28, count: 12 },
      { r: size * 0.38, count: 16 },
    ];
    rings.forEach(({ r, count }) => {
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2;
        const x = half + Math.cos(a) * r;
        const y = half + Math.sin(a) * r;
        ctx.beginPath();
        ctx.arc(x, y, size * 0.026, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  } else if (skin.pattern === 'basketball') {
    // Orange basketball with black rib lines
    ctx.fillStyle = '#ea580c';
    ctx.fillRect(0, 0, size, size);

    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = size * 0.05;

    // Cross lines
    ctx.beginPath();
    ctx.moveTo(0, half);
    ctx.lineTo(size, half);
    ctx.moveTo(half, 0);
    ctx.lineTo(half, size);
    ctx.stroke();

    // Curved side ribs
    ctx.beginPath();
    ctx.arc(half, -half * 0.2, half * 0.9, 0.35 * Math.PI, 0.65 * Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(half, size + half * 0.2, half * 0.9, 1.35 * Math.PI, 1.65 * Math.PI);
    ctx.stroke();
  } else if (skin.pattern === 'tennis') {
    // Neon chartreuse felt with white curved seam
    ctx.fillStyle = '#84cc16';
    ctx.fillRect(0, 0, size, size);

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = size * 0.06;
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.arc(half * 0.2, half, half * 0.6, -0.4 * Math.PI, 0.4 * Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(size - half * 0.2, half, half * 0.6, 0.6 * Math.PI, 1.4 * Math.PI);
    ctx.stroke();
  } else if (skin.pattern === 'soccer') {
    // White hexagons with black central pentagon
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, size, size);

    // Center pentagon
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = (i * 2 * Math.PI) / 5 - Math.PI / 2;
      const x = half + Math.cos(a) * (size * 0.22);
      const y = half + Math.sin(a) * (size * 0.22);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();

    // Radiating seams
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = size * 0.035;
    for (let i = 0; i < 5; i++) {
      const a = (i * 2 * Math.PI) / 5 - Math.PI / 2;
      const x1 = half + Math.cos(a) * (size * 0.22);
      const y1 = half + Math.sin(a) * (size * 0.22);
      const x2 = half + Math.cos(a) * (size * 0.48);
      const y2 = half + Math.sin(a) * (size * 0.48);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  } else if (skin.pattern === 'bowling') {
    // Onyx dark gloss bowling ball with 3 finger holes
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, size, size);

    // 3 finger holes (triangle layout)
    ctx.fillStyle = '#020617';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = size * 0.02;

    const holes = [
      { x: half - size * 0.09, y: half - size * 0.08, r: size * 0.05 },
      { x: half + size * 0.09, y: half - size * 0.08, r: size * 0.05 },
      { x: half, y: half + size * 0.12, r: size * 0.065 },
    ];
    holes.forEach((h) => {
      ctx.beginPath();
      ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
  } else if (skin.pattern === 'beach') {
    // Beach water ball with alternating red, blue, white panels
    const colors = ['#ef4444', '#3b82f6', '#ffffff', '#ef4444', '#3b82f6', '#ffffff'];
    const segAngle = (Math.PI * 2) / colors.length;

    colors.forEach((col, idx) => {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(half, half);
      ctx.arc(half, half, half, idx * segAngle, (idx + 1) * segAngle);
      ctx.closePath();
      ctx.fill();
    });

    // Center white cap
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(half, half, size * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  return canvas;
}

export function createBallTexture(skin: GolfBallSkin, maxAnisotropy = 4): THREE.CanvasTexture {
  const canvas = createBallCanvas(skin, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}
