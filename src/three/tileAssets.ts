import * as THREE from 'three';
import { ColladaLoader } from 'three/examples/jsm/loaders/ColladaLoader.js';

export const MODULAR_TILES = {
  // Tall cliff wall segments (straight)
  cliffStraights: [
    'Clifftile Straight 1',
    'Clifftile Straight 2',
    'Clifftile Straight 3',
  ],
  // Cliff turns, corners, and diagonals
  cliffCorners: [
    'Clifftile Convex',
    'Clifftile Concave',
    'Clifftile Diagonal',
  ],
  // Canyon passes / archway gateways
  cliffPasses: [
    'Clifftile Pass 1',
    'Clifftile Pass 2',
    'Rocktile Pass',
  ],
  // Medium-height rock barriers
  rockBarriers: [
    'Rocktile Straight 1',
    'Rocktile Straight 2',
    'Rocktile Convex',
    'Rocktile Diagonal',
  ],
};

// World-themed cliff tint colors
export const WORLD_CLIFF_TINTS: Record<number, number> = {
  0: 0x8a9096, // Sunny Meadow: Cool granite rock
  1: 0x6e7780, // Pine Valley: Dark alpine crag
  2: 0xb57852, // Golden Dunes: Red canyon sandstone
  3: 0x607868, // Emerald Ridge: Mossy deep forest stone
  4: 0x505560, // Starlight Champions: Midnight slate
};

class TileAssetManager {
  private loader: ColladaLoader;
  private cache: Map<string, THREE.Group> = new Map();
  private loadPromises: Map<string, Promise<THREE.Group | null>> = new Map();
  private listeners: Set<() => void> = new Set();
  private isPreloading: boolean = false;
  private preloadedCount: number = 0;
  private totalToPreload: number = 0;

  constructor() {
    this.loader = new ColladaLoader();
  }

  private notifyTimeout: number | null = null;

  public onLoaded(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notifyListeners() {
    if (this.notifyTimeout !== null) return;
    this.notifyTimeout = window.setTimeout(() => {
      this.notifyTimeout = null;
      this.listeners.forEach((cb) => {
        try {
          cb();
        } catch (err) {
          console.error('Error in tile asset listener:', err);
        }
      });
    }, 40);
  }

  public get(name: string): THREE.Group | null {
    return this.cache.get(name) || null;
  }

  public has(name: string): boolean {
    return this.cache.has(name);
  }

  /**
   * Load and normalize a single Collada tile model asynchronously.
   * Centers the model on X/Z and ensures its base sits flat at y = 0.00.
   */
  public async loadModel(name: string): Promise<THREE.Group | null> {
    if (this.cache.has(name)) {
      return this.cache.get(name)!;
    }

    if (this.loadPromises.has(name)) {
      return this.loadPromises.get(name)!;
    }

    const encodedName = encodeURIComponent(name);
    const url = `/assets/tiles/${encodedName}.dae`;

    const promise = new Promise<THREE.Group | null>((resolve) => {
      this.loader.load(
        url,
        (collada) => {
          if (!collada || !collada.scene) {
            resolve(null);
            return;
          }
          const root = collada.scene;

          // Convert materials to Standard PBR and configure shadows
          root.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const mesh = child as THREE.Mesh;
              mesh.castShadow = true;
              mesh.receiveShadow = true;

              // Upgrade Phong/Lambert to MeshStandardMaterial for rich lighting
              const origMat = Array.isArray(mesh.material)
                ? mesh.material[0]
                : mesh.material;
              const matColor = (origMat && 'color' in (origMat as unknown as object))
                ? (origMat as unknown as { color: THREE.Color }).color
                : 0x7a8288;

              const stdMat = new THREE.MeshStandardMaterial({
                color: matColor,
                roughness: 0.84,
                metalness: 0.05,
                flatShading: true,
              });
              mesh.material = stdMat;
            }
          });

          // Compute world bounding box of rotated Collada scene
          const bbox = new THREE.Box3().setFromObject(root);
          const minY = bbox.min.y;
          const centerX = (bbox.max.x + bbox.min.x) * 0.5;
          const centerZ = (bbox.max.z + bbox.min.z) * 0.5;

          // Recenter horizontally and lift geometry so its lowest point rests EXACTLY at y = 0.00
          root.position.set(-centerX, -minY, -centerZ);

          const container = new THREE.Group();
          container.name = name;
          container.add(root);

          this.cache.set(name, container);
          this.notifyListeners();
          resolve(container);
        },
        undefined,
        (error) => {
          console.warn(`Failed to load tile model: ${name}`, error);
          resolve(null);
        }
      );
    });

    this.loadPromises.set(name, promise);
    return promise;
  }

  /**
   * Clone a tile model from cache, applying scale, shadows, and optional world color tint
   */
  public cloneModel(
    name: string,
    scale = 0.12,
    worldIndex = 0,
    castShadow = true
  ): THREE.Group | null {
    const original = this.cache.get(name);
    if (!original) {
      this.loadModel(name);
      return null;
    }

    const clone = original.clone(true);
    clone.scale.setScalar(scale);

    const tintColor = WORLD_CLIFF_TINTS[worldIndex] ?? WORLD_CLIFF_TINTS[0];

    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = castShadow;
        mesh.receiveShadow = true;
        if (mesh.material) {
          const m = (mesh.material as THREE.MeshStandardMaterial).clone();
          m.color.setHex(tintColor);
          mesh.material = m;
        }
      }
    });

    return clone;
  }

  /**
   * Get a straight cliff wall tile
   */
  public createCliffStraight(
    seed: number,
    worldIndex = 0,
    scale = 0.11,
    castShadow = true
  ): THREE.Group | null {
    const pool = MODULAR_TILES.cliffStraights;
    const modelName = pool[Math.abs(seed) % pool.length];
    return this.cloneModel(modelName, scale, worldIndex, castShadow);
  }

  /**
   * Get a cliff corner or diagonal tile
   */
  public createCliffCorner(
    type: 'convex' | 'concave' | 'diagonal' = 'convex',
    worldIndex = 0,
    scale = 0.11,
    castShadow = true
  ): THREE.Group | null {
    let modelName = 'Clifftile Convex';
    if (type === 'concave') modelName = 'Clifftile Concave';
    else if (type === 'diagonal') modelName = 'Clifftile Diagonal';
    return this.cloneModel(modelName, scale, worldIndex, castShadow);
  }

  /**
   * Get a canyon pass / natural stone gateway
   */
  public createCliffPass(
    seed: number,
    worldIndex = 0,
    scale = 0.11,
    castShadow = true
  ): THREE.Group | null {
    const pool = MODULAR_TILES.cliffPasses;
    const modelName = pool[Math.abs(seed) % pool.length];
    return this.cloneModel(modelName, scale, worldIndex, castShadow);
  }

  /**
   * Get a medium rock barrier tile
   */
  public createRockBarrier(
    seed: number,
    worldIndex = 0,
    scale = 0.12,
    castShadow = true
  ): THREE.Group | null {
    const pool = MODULAR_TILES.rockBarriers;
    const modelName = pool[Math.abs(seed) % pool.length];
    return this.cloneModel(modelName, scale, worldIndex, castShadow);
  }

  /**
   * Preload all 13 modular tiles immediately on startup
   */
  public preloadAllTiles() {
    if (this.isPreloading) return;
    this.isPreloading = true;

    const allModels = [
      ...MODULAR_TILES.cliffStraights,
      ...MODULAR_TILES.cliffCorners,
      ...MODULAR_TILES.cliffPasses,
      ...MODULAR_TILES.rockBarriers,
    ];

    this.totalToPreload = allModels.length;
    this.preloadedCount = 0;

    allModels.forEach((name) => {
      this.loadModel(name).then(() => {
        this.preloadedCount++;
      });
    });
  }

  public getLoadProgress(): number {
    if (this.totalToPreload === 0) return 1;
    return Math.min(1, this.preloadedCount / this.totalToPreload);
  }
}

export const tileAssets = new TileAssetManager();

if (typeof window !== 'undefined') {
  tileAssets.preloadAllTiles();
}
