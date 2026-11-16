import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
const modelCache = new Map<string, THREE.Group>();
const pendingPromises = new Map<string, Promise<THREE.Group | null>>();
const listeners = new Set<(modelUrl: string, group: THREE.Group) => void>();

export function onBallModelLoaded(callback: (modelUrl: string, group: THREE.Group) => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

export function getCachedBallModel(modelUrl: string, ballRadius: number): THREE.Group | null {
  const cached = modelCache.get(modelUrl);
  if (!cached) return null;
  const clone = cached.clone(true);
  clone.scale.setScalar(ballRadius);
  return clone;
}

/**
 * Loads a 3D ball model from GLB (exported from Blender),
 * centers it at (0, 0, 0), normalizes its outer radius to 1.0,
 * and scales it to the exact target ballRadius.
 */
export async function loadBallModel(
  modelUrl: string,
  ballRadius: number,
  isSoftwareGl: boolean = false
): Promise<THREE.Group | null> {
  const cached = modelCache.get(modelUrl);
  if (cached) {
    const clone = cached.clone(true);
    clone.scale.setScalar(ballRadius);
    return clone;
  }

  if (pendingPromises.has(modelUrl)) {
    const base = await pendingPromises.get(modelUrl)!;
    if (!base) return null;
    const clone = base.clone(true);
    clone.scale.setScalar(ballRadius);
    return clone;
  }

  const promise = new Promise<THREE.Group | null>((resolve) => {
    loader.load(
      modelUrl,
      (gltf) => {
        const root = gltf.scene;

        // Configure shadows & PBR material settings on all child meshes
        root.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            mesh.castShadow = !isSoftwareGl;
            mesh.receiveShadow = !isSoftwareGl;
            if (mesh.material) {
              const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
              mats.forEach((m) => {
                if (m instanceof THREE.MeshStandardMaterial) {
                  m.roughness = Math.min(0.65, m.roughness);
                }
              });
            }
          }
        });

        // Center root object at (0, 0, 0)
        const bbox = new THREE.Box3().setFromObject(root);
        const center = new THREE.Vector3();
        bbox.getCenter(center);
        root.position.sub(center);

        // Find exact maximum vertex radius from origin to ensure 100% identical size across all ball models
        root.updateMatrixWorld(true);
        let maxVertexRadius = 0;
        root.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            const pos = mesh.geometry?.attributes?.position;
            if (pos) {
              const v = new THREE.Vector3();
              for (let i = 0; i < pos.count; i++) {
                v.fromBufferAttribute(pos, i);
                v.applyMatrix4(mesh.matrixWorld);
                const d = v.length();
                if (d > maxVertexRadius) maxVertexRadius = d;
              }
            }
          }
        });

        // Normalize so outer sphere radius is exactly 1.000000
        const normFactor = maxVertexRadius > 0.001 ? 1.0 / maxVertexRadius : 1.0;
        root.scale.setScalar(normFactor);

        const group = new THREE.Group();
        group.add(root);

        const baseGroup = new THREE.Group();
        baseGroup.add(group);

        modelCache.set(modelUrl, baseGroup);

        listeners.forEach((cb) => {
          try {
            cb(modelUrl, baseGroup);
          } catch (e) {
            console.error('Error in ball model listener:', e);
          }
        });

        const clone = baseGroup.clone(true);
        clone.scale.setScalar(ballRadius);
        resolve(clone);
      },
      undefined,
      (err) => {
        console.warn(`Could not load ball model from ${modelUrl}:`, err);
        resolve(null);
      }
    );
  });

  pendingPromises.set(modelUrl, promise);
  return promise;
}

/**
 * Preloads all 3D ball models into cache so switching skins in-game or in the modal is instantaneous.
 */
export function preloadAllBallModels(urls: string[], ballRadius: number, isSoftwareGl: boolean = false) {
  urls.forEach((u) => loadBallModel(u, ballRadius, isSoftwareGl));
}
