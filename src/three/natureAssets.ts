import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export const NATURE_CATALOG = {
  // Classic stylized deciduous oak trees (Sunny Meadow)
  oakTrees: [
    'Tree_1_A_Color1',
    'Tree_1_B_Color1',
    'Tree_1_C_Color1',
  ],
  // Tall conical evergreen pines (Pine Valley & Starlight)
  pineTrees: [
    'Tree_2_A_Color1',
    'Tree_2_B_Color1',
    'Tree_2_C_Color1',
    'Tree_2_D_Color1',
    'Tree_2_E_Color1',
  ],
  // Slender elegant birch / poplars (Emerald Ridge)
  birchTrees: [
    'Tree_3_A_Color1',
    'Tree_3_B_Color1',
    'Tree_3_C_Color1',
  ],
  // Warm golden autumn trees (Golden Dunes)
  autumnTrees: [
    'Tree_4_A_Color1',
    'Tree_4_B_Color1',
    'Tree_4_C_Color1',
  ],
  // Low round green bushes
  bushes: [
    'Bush_1_A_Color1',
    'Bush_1_B_Color1',
    'Bush_1_C_Color1',
    'Bush_1_D_Color1',
    'Bush_2_A_Color1',
    'Bush_2_B_Color1',
    'Bush_3_A_Color1',
  ],
  // Small garden accent stones
  smallRocks: [
    'Rock_1_A_Color1',
    'Rock_1_B_Color1',
    'Rock_1_C_Color1',
    'Rock_1_D_Color1',
    'Rock_1_E_Color1',
  ],
  // Medium rounded boulders
  mediumRocks: [
    'Rock_2_A_Color1',
    'Rock_2_B_Color1',
    'Rock_2_C_Color1',
    'Rock_2_D_Color1',
  ],
  // Large craggy formations
  largeRocks: [
    'Rock_3_A_Color1',
    'Rock_3_B_Color1',
    'Rock_3_C_Color1',
    'Rock_3_D_Color1',
  ],
  // Stylized 3D grass blade clusters (rich multi-blade patches)
  grassTufts: [
    'Grass_1_C_Color1',
    'Grass_1_D_Color1',
    'Grass_2_C_Color1',
    'Grass_2_D_Color1',
    'Grass_2_B_Color1',
    'Grass_1_B_Color1',
  ],
};

class NatureAssetManager {
  private loader: GLTFLoader;
  private cache: Map<string, THREE.Group> = new Map();
  private loadPromises: Map<string, Promise<THREE.Group | null>> = new Map();
  private listeners: Set<() => void> = new Set();
  private notifyTimeout: number | null = null;
  private preloadedCount: number = 0;
  private totalToPreload: number = 0;

  constructor() {
    this.loader = new GLTFLoader();
  }

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
          console.error('Error in nature asset listener:', err);
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
   * Load and normalize a single GLTF KayKit nature model.
   * Centers the model horizontally on X/Z and ensures its base sits flat at y = 0.00.
   */
  public async loadModel(name: string): Promise<THREE.Group | null> {
    if (this.cache.has(name)) {
      return this.cache.get(name)!;
    }

    if (this.loadPromises.has(name)) {
      return this.loadPromises.get(name)!;
    }

    const url = `/assets/nature/${encodeURIComponent(name)}.gltf`;

    const promise = new Promise<THREE.Group | null>((resolve) => {
      this.loader.load(
        url,
        (gltf) => {
          if (!gltf || !gltf.scene) {
            resolve(null);
            return;
          }
          const root = gltf.scene;

          // Enable shadows and configure PBR materials
          root.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const mesh = child as THREE.Mesh;
              mesh.castShadow = true;
              mesh.receiveShadow = true;

              if (mesh.material) {
                const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
                if ('roughness' in mat) {
                  (mat as THREE.MeshStandardMaterial).roughness = 0.85;
                  (mat as THREE.MeshStandardMaterial).metalness = 0.05;
                }
              }
            }
          });

          // Compute bounding box
          const bbox = new THREE.Box3().setFromObject(root);
          const minY = bbox.min.y;
          const centerX = (bbox.max.x + bbox.min.x) * 0.5;
          const centerZ = (bbox.max.z + bbox.min.z) * 0.5;

          // Recenter horizontally and lift so bottom sits EXACTLY on ground plane y = 0.00
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
          console.warn(`Failed to load nature model: ${name}`, error);
          resolve(null);
        }
      );
    });

    this.loadPromises.set(name, promise);
    return promise;
  }

  /**
   * Clone a model from cache and scale it appropriately
   */
  public cloneModel(name: string, scale = 0.6, castShadow = true): THREE.Group | null {
    const original = this.cache.get(name);
    if (!original) {
      this.loadModel(name);
      return null;
    }

    const clone = original.clone(true);
    clone.scale.setScalar(scale);

    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        (child as THREE.Mesh).castShadow = castShadow;
        (child as THREE.Mesh).receiveShadow = true;
      }
    });

    return clone;
  }

  /**
   * Get a world-themed tree model
   */
  public createTree(
    worldIndex = 0,
    seed = 0,
    scale = 0.62,
    castShadow = true,
    treeType?: 'oak' | 'pine' | 'birch' | 'autumn' | 'any'
  ): THREE.Group | null {
    let pool: string[];
    if (treeType === 'oak') pool = NATURE_CATALOG.oakTrees;
    else if (treeType === 'pine') pool = NATURE_CATALOG.pineTrees;
    else if (treeType === 'birch') pool = NATURE_CATALOG.birchTrees;
    else if (treeType === 'autumn') pool = NATURE_CATALOG.autumnTrees;
    else if (treeType === 'any') {
      pool = [
        ...NATURE_CATALOG.oakTrees,
        ...NATURE_CATALOG.pineTrees,
        ...NATURE_CATALOG.birchTrees,
        ...NATURE_CATALOG.autumnTrees,
      ];
    } else {
      switch (worldIndex) {
        case 1: // Pine Valley: Mostly Pines with occasional Birch
          pool = (seed % 4 === 0) ? NATURE_CATALOG.birchTrees : NATURE_CATALOG.pineTrees;
          break;
        case 2: // Golden Dunes: Warm Autumn with Birch
          pool = (seed % 3 === 0) ? NATURE_CATALOG.birchTrees : NATURE_CATALOG.autumnTrees;
          break;
        case 3: // Emerald Ridge: Birch & Pine
          pool = (seed % 3 === 0) ? NATURE_CATALOG.pineTrees : NATURE_CATALOG.birchTrees;
          break;
        case 4: // Starlight Champions: Pine & Autumn
          pool = (seed % 3 === 0) ? NATURE_CATALOG.autumnTrees : NATURE_CATALOG.pineTrees;
          break;
        case 0: // Sunny Meadow: Oak with occasional Birch/Pine
        default:
          pool = (seed % 4 === 0) ? NATURE_CATALOG.birchTrees : (seed % 5 === 0) ? NATURE_CATALOG.pineTrees : NATURE_CATALOG.oakTrees;
          break;
      }
    }

    const modelName = pool[Math.abs(seed) % pool.length];
    return this.cloneModel(modelName, scale, castShadow);
  }

  /**
   * Get a stylized bush model
   */
  public createBush(
    seed = 0,
    scale = 0.42,
    castShadow = true
  ): THREE.Group | null {
    const pool = NATURE_CATALOG.bushes;
    const modelName = pool[Math.abs(seed) % pool.length];
    return this.cloneModel(modelName, scale, castShadow);
  }

  /**
   * Get a stylized rock model (small, medium, or large)
   */
  public createRock(
    size: 'small' | 'medium' | 'large' = 'medium',
    seed = 0,
    scale = 0.55,
    castShadow = true
  ): THREE.Group | null {
    let pool: string[];
    switch (size) {
      case 'small':
        pool = NATURE_CATALOG.smallRocks;
        break;
      case 'large':
        pool = NATURE_CATALOG.largeRocks;
        break;
      case 'medium':
      default:
        pool = NATURE_CATALOG.mediumRocks;
        break;
    }

    const modelName = pool[Math.abs(seed) % pool.length];
    return this.cloneModel(modelName, scale, castShadow);
  }

  /**
   * Get a stylized 3D grass tuft model
   */
  public createGrass(
    seed = 0,
    scale = 1.35,
    castShadow = true
  ): THREE.Group | null {
    const pool = NATURE_CATALOG.grassTufts;
    const modelName = pool[Math.abs(seed) % pool.length];
    return this.cloneModel(modelName, scale, castShadow);
  }

  /**
   * Preload core nature models for fast display
   */
  public preloadPriorityAssets() {
    const priorityModels = [
      ...NATURE_CATALOG.oakTrees,
      ...NATURE_CATALOG.pineTrees,
      ...NATURE_CATALOG.autumnTrees,
      ...NATURE_CATALOG.birchTrees,
      ...NATURE_CATALOG.bushes.slice(0, 4),
      ...NATURE_CATALOG.smallRocks.slice(0, 3),
      ...NATURE_CATALOG.mediumRocks.slice(0, 3),
      ...NATURE_CATALOG.largeRocks.slice(0, 2),
      ...NATURE_CATALOG.grassTufts.slice(0, 4),
    ];

    this.totalToPreload = priorityModels.length;
    this.preloadedCount = 0;

    priorityModels.forEach((name) => {
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

export const natureAssets = new NatureAssetManager();

if (typeof window !== 'undefined') {
  natureAssets.preloadPriorityAssets();
}
