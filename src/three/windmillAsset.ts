import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export interface WindmillInstance {
  root: THREE.Group;
  blades: THREE.Object3D | null;
  spinSpeed: number; // rad/s
}

const loader = new GLTFLoader();
let cachedWindmillModel: THREE.Group | null = null;
let pendingPromise: Promise<THREE.Group | null> | null = null;
const listeners = new Set<() => void>();

/**
 * Loads the Quaternius authentic Windmill model from public/assets/windmill.glb
 * (extracted from Windmill.blend), tunes PBR materials and enables shadows.
 */
export async function loadWindmillModel(isSoftwareGl: boolean = false): Promise<THREE.Group | null> {
  if (cachedWindmillModel) {
    return cachedWindmillModel.clone(true);
  }

  if (pendingPromise) {
    const base = await pendingPromise;
    return base ? base.clone(true) : null;
  }

  pendingPromise = new Promise<THREE.Group | null>((resolve) => {
    loader.load(
      '/assets/windmill.glb',
      (gltf) => {
        const root = gltf.scene;

        root.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            mesh.castShadow = !isSoftwareGl;
            mesh.receiveShadow = !isSoftwareGl;

            const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            mats.forEach((m) => {
              if (m instanceof THREE.MeshStandardMaterial) {
                const matName = (m.name || '').toLowerCase();
                if (matName.includes('brown')) {
                  // Warm rustic cedar timber body
                  m.color.setHex(0x8a5229);
                  m.roughness = 0.82;
                  m.metalness = 0.04;
                } else if (matName.includes('grey') || matName.includes('gray')) {
                  // Clean off-white sails / stone accents
                  m.color.setHex(0xf3f5f8);
                  m.roughness = 0.55;
                  m.metalness = 0.08;
                }
              }
            });
          }
        });

        cachedWindmillModel = root;
        listeners.forEach((cb) => {
          try {
            cb();
          } catch {}
        });
        resolve(root.clone(true));
      },
      undefined,
      (err) => {
        console.error('Error loading windmill.glb model:', err);
        resolve(null);
      }
    );
  });

  return pendingPromise;
}

/**
 * Creates an instance of the Windmill if cached, ready for animation.
 */
export function createWindmillInstance(
  scale: number = 0.32,
  isSoftwareGl: boolean = false,
  spinSpeed: number = 1.35
): WindmillInstance | null {
  if (!cachedWindmillModel) {
    loadWindmillModel(isSoftwareGl);
    return null;
  }

  const root = cachedWindmillModel.clone(true);
  root.scale.setScalar(scale);

  // Find the rotating blades mesh
  const blades = root.getObjectByName('Windmill_Blades') || null;

  return {
    root,
    blades,
    spinSpeed,
  };
}

/**
 * Register a listener when the windmill model finishes loading.
 */
export function onWindmillLoaded(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

// Preload immediately in browser
if (typeof window !== 'undefined') {
  loadWindmillModel();
}
