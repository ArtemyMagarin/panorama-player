import type {
  CachedTile,
  Tile,
  TileError,
  TileLoadProgress,
  TileOptions,
  ViewportInfo,
} from './types.js';
import { TileState } from './types.js';
import { TileCoordinateSystem } from './TileCoordinateSystem.js';
import { TileLoader } from './TileLoader.js';
import { TileCache } from './TileCache.js';

/**
 * Manages tile loading, caching, and priority-based loading queue
 */
export class TileManager {
  private config: TileOptions;
  private loader: TileLoader;
  private cache: TileCache;
  private gl: WebGLRenderingContext | WebGL2RenderingContext;
  private currentZoom: number;
  private activeRequests = 0;
  private loadQueue: Tile[] = [];
  private isProcessingQueue = false;

  // Event callbacks
  private onLoadStart?: () => void;
  private onLoadProgress?: (progress: TileLoadProgress) => void;
  private onLoadComplete?: () => void;
  private onError?: (error: TileError) => void;

  constructor(
    gl: WebGLRenderingContext | WebGL2RenderingContext,
    config: TileOptions,
    initialViewport: ViewportInfo,
  ) {
    this.gl = gl;
    this.config = config;
    this.loader = new TileLoader(config);
    this.cache = new TileCache(gl, config);
    this.currentZoom = config.adaptiveZoom
      ? TileCoordinateSystem.calculateOptimalZoom(initialViewport, config.tileSize, config.maxZoom)
      : config.minZoom;
  }

  /**
   * Set event callbacks
   */
  setEventCallbacks(callbacks: {
    onLoadStart?: () => void;
    onLoadProgress?: (progress: TileLoadProgress) => void;
    onLoadComplete?: () => void;
    onError?: (error: TileError) => void;
  }): void {
    this.onLoadStart = callbacks.onLoadStart;
    this.onLoadProgress = callbacks.onLoadProgress;
    this.onLoadComplete = callbacks.onLoadComplete;
    this.onError = callbacks.onError;
  }

  /**
   * Update viewport and recalculate optimal zoom if adaptive
   */
  updateViewport(viewport: ViewportInfo): void {
    if (this.config.adaptiveZoom) {
      const newZoom = TileCoordinateSystem.calculateOptimalZoom(
        viewport,
        this.config.tileSize,
        this.config.maxZoom,
      );

      if (newZoom !== this.currentZoom) {
        this.currentZoom = newZoom;
        // Clear cache when zoom changes to free memory
        this.cache.clear();
      }
    }
  }

  /**
   * Get tiles visible in the current viewport
   */
  getVisibleTiles(viewU: number, viewV: number, fov: number): Tile[] {
    const _tilesX = TileCoordinateSystem.getTilesX(this.currentZoom);
    const _tilesY = TileCoordinateSystem.getTilesY(this.currentZoom);

    // Calculate visible UV range based on FOV
    const fovU = fov / 360;
    const fovV = (fov * 0.75) / 180; // Assume 4:3 aspect ratio

    const minU = Math.max(0, viewU - fovU / 2);
    const maxU = Math.min(1, viewU + fovU / 2);
    const minV = Math.max(0, viewV - fovV / 2);
    const maxV = Math.min(1, viewV + fovV / 2);

    return TileCoordinateSystem.getVisibleTiles(this.currentZoom, minU, maxU, minV, maxV);
  }

  /**
   * Load tiles for the current view
   */
  async loadTilesForView(viewU: number, viewV: number, fov: number): Promise<void> {
    const visibleTiles = this.getVisibleTiles(viewU, viewV, fov);

    // Add preload radius
    const tilesToLoad = TileCoordinateSystem.getTilesWithinRadius(
      visibleTiles,
      this.config.preloadRadius,
      this.config.maxZoom,
    );

    // Filter out already loaded tiles
    const tilesNeedingLoad = tilesToLoad.filter((tile) => {
      const cached = this.cache.get(tile);
      return !cached || cached.state === 'error';
    });

    if (tilesNeedingLoad.length === 0) {
      return;
    }

    // Sort by distance from center of view (priority)
    tilesNeedingLoad.sort((a, b) => {
      const distA = this.getDistanceFromViewCenter(a, viewU, viewV);
      const distB = this.getDistanceFromViewCenter(b, viewU, viewV);
      return distA - distB;
    });

    // Add to queue
    this.loadQueue.push(...tilesNeedingLoad);

    // Start processing queue if not already processing
    if (!this.isProcessingQueue) {
      this.processQueue();
    }
  }

  /**
   * Process the loading queue with concurrency limit
   */
  private async processQueue(): Promise<void> {
    this.isProcessingQueue = true;

    if (this.onLoadStart) {
      this.onLoadStart();
    }

    const totalTiles = this.loadQueue.length;
    let loadedCount = 0;

    while (this.loadQueue.length > 0) {
      // Wait for available request slot
      while (this.activeRequests >= this.config.maxConcurrentRequests) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      const tile = this.loadQueue.shift()!;
      this.activeRequests++;

      // Load tile
      this.loadTile(tile)
        .then(() => {
          loadedCount++;
          if (this.onLoadProgress) {
            this.onLoadProgress({
              loaded: loadedCount,
              total: totalTiles,
              zoom: this.currentZoom,
            });
          }
        })
        .catch((error) => {
          if (this.onError) {
            this.onError({
              error,
              tile,
            });
          }
        })
        .finally(() => {
          this.activeRequests--;
        });
    }

    // Wait for all active requests to complete
    while (this.activeRequests > 0) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    this.isProcessingQueue = false;

    if (this.onLoadComplete) {
      this.onLoadComplete();
    }
  }

  /**
   * Load a single tile
   */
  private async loadTile(tile: Tile): Promise<void> {
    // Check if already loading
    const existing = this.cache.get(tile);
    if (existing?.state === TileState.Loading) {
      return existing.loadPromise!;
    }

    // Create cached tile entry
    const cachedTile: CachedTile = {
      tile,
      texture: null,
      state: TileState.Loading,
      lastAccess: Date.now(),
      loadPromise: null,
      abortController: null,
      retryCount: 0,
    };

    this.cache.set(tile, cachedTile);

    // Load image
    const loadPromise = this.loader
      .loadTile(tile)
      .then((image) => {
        // Create WebGL texture
        const texture = this.createTexture(image);
        cachedTile.texture = texture;
        cachedTile.state = TileState.Loaded;
      })
      .catch((error) => {
        cachedTile.state = TileState.Error;
        throw error;
      });

    cachedTile.loadPromise = loadPromise;
    return loadPromise;
  }

  /**
   * Create a WebGL texture from an image
   */
  private createTexture(image: HTMLImageElement): WebGLTexture {
    const texture = this.gl.createTexture()!;
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);

    // Upload image to texture
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.RGBA,
      this.gl.RGBA,
      this.gl.UNSIGNED_BYTE,
      image,
    );

    // Set texture parameters
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);

    return texture;
  }

  /**
   * Calculate distance from view center for priority sorting
   */
  private getDistanceFromViewCenter(tile: Tile, viewU: number, viewV: number): number {
    const uv = TileCoordinateSystem.tileToUV(tile.z, tile.x, tile.y);
    const du = uv.u - viewU;
    const dv = uv.v - viewV;
    return Math.sqrt(du * du + dv * dv);
  }

  /**
   * Get the cache
   */
  getCache(): TileCache {
    return this.cache;
  }

  /**
   * Get current zoom level
   */
  getCurrentZoom(): number {
    return this.currentZoom;
  }

  /**
   * Cancel all pending loads
   */
  cancelAll(): void {
    this.loader.cancelAll();
    this.loadQueue = [];
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.cancelAll();
    this.cache.clear();
  }
}
