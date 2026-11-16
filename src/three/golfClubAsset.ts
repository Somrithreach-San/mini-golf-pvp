import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
let cachedClubModel: THREE.Group | null = null;
let pendingPromise: Promise<THREE.Group | null> | null = null;

/**
 * Loads the authentic 3D golf club extracted from GOLF_Club.blend,
 * configures PBR materials and shadow properties, and caches it.
 */
export async function loadGolfClubModel(isSoftwareGl: boolean = false): Promise<THREE.Group | null> {
  if (cachedClubModel) {
    return cachedClubModel.clone(true);
  }

  if (pendingPromise) {
    const base = await pendingPromise;
    return base ? base.clone(true) : null;
  }

  pendingPromise = new Promise<THREE.Group | null>((resolve) => {
    loader.load(
      '/assets/golf_club.glb',
      (gltf) => {
        const root = gltf.scene;

        root.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            mesh.castShadow = !isSoftwareGl;
            mesh.receiveShadow = !isSoftwareGl;

            // Enhance materials for realistic metallic chrome shaft & iron head
            const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            mats.forEach((m) => {
              if (m instanceof THREE.MeshStandardMaterial) {
                if (m.name.toLowerCase().includes('grip')) {
                  // Matte rubber grip
                  m.color.setHex(0x1a1c20);
                  m.roughness = 0.85;
                  m.metalness = 0.05;
                } else if (m.name.toLowerCase().includes('ferul')) {
                  // Glossy black ferrule collar
                  m.color.setHex(0x111317);
                  m.roughness = 0.30;
                  m.metalness = 0.15;
                } else if (m.name.toLowerCase().includes('chrome')) {
                  // Gleaming mirror chrome shaft
                  m.color.setHex(0xf2f4f8);
                  m.roughness = 0.12;
                  m.metalness = 0.95;
                } else {
                  // Brushed stainless steel iron head
                  m.color.setHex(0xd0d5dd);
                  m.roughness = 0.26;
                  m.metalness = 0.90;
                }
              }
            });
          }
        });

        cachedClubModel = root;
        resolve(root.clone(true));
      },
      undefined,
      (err) => {
        console.error('Error loading golf club GLB model:', err);
        resolve(null);
      }
    );
  });

  return pendingPromise;
}
