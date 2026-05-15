import type { CachedTile, Tile, TileOptions } from './types.js';
import { TileCoordinateSystem } from './TileCoordinateSystem.js';

/**
 * LRU cache for tile textures with configurable size and priority-based eviction
 */
export class TileCache {
  private cache = new Map<string, CachedTile>();
  private accessOrder: string[] = [];
  private config: TileOptions;
  private gl: WebGLRenderingContext | WebGL2RenderingContext;

  constructor(gl: WebGLRenderingContext | WebGL2RenderingContext, config: TileOptions) {
    this.gl = gl;
    this.config = config;
  }

  /**
   * Get a cached tile
   */
  get(tile: Tile): CachedTile | undefined {
    const key = TileCoordinateSystem.getTileKey(tile);
    const cached = this.cache.get(key);

    if (cached) {
      // Update access time and move to end of access order
      cached.lastAccess = Date.now();
      this.updateAccessOrder(key);
    }

    return cached;
  }

  /**
   * Add a tile to the cache
   */
  set(tile: Tile, cachedTile: CachedTile): void {
    const key = TileCoordinateSystem.getTileKey(tile);

    // If cache is full, evict least recently used tile
    if (this.cache.size >= this.config.cacheSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    this.cache.set(key, cachedTile);
    this.updateAccessOrder(key);
  }

  /**
   * Remove a tile from the cache
   */
  delete(tile: Tile): void {
    const key = TileCoordinateSystem.getTileKey(tile);
    const cached = this.cache.get(key);

    if (cached) {
      // Delete WebGL texture
      if (cached.texture) {
        this.gl.deleteTexture(cached.texture);
      }

      // Cancel any pending load
      if (cached.abortController) {
        cached.abortController.abort();
      }

      this.cache.delete(key);
      this.removeFromAccessOrder(key);
    }
  }

  /**
   * Clear all tiles from the cache
   */
  clear(): void {
    for (const cached of this.cache.values()) {
      if (cached.texture) {
        this.gl.deleteTexture(cached.texture);
      }
      if (cached.abortController) {
        cached.abortController.abort();
      }
    }
    this.cache.clear();
    this.accessOrder = [];
  }

  /**
   * Get the number of tiles in the cache
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Get all cached tiles
   */
  getAll(): CachedTile[] {
    return Array.from(this.cache.values());
  }

  /**
   * Get tiles that are currently loading
   */
  getLoadingTiles(): CachedTile[] {
    return Array.from(this.cache.values()).filter((t) => t.state === 'loading');
  }

  /**
   * Get tiles that have been loaded successfully
   */
  getLoadedTiles(): CachedTile[] {
    return Array.from(this.cache.values()).filter((t) => t.state === 'loaded');
  }

  /**
   * Evict the least recently used tile
   */
  private evictLRU(): void {
    if (this.accessOrder.length === 0) return;

    const lruKey = this.accessOrder[0];
    const lruTile = this.cache.get(lruKey);

    if (lruTile) {
      // Don't evict tiles that are currently loading
      if (lruTile.state === 'loading') {
        // Find the next non-loading tile
        for (let i = 1; i < this.accessOrder.length; i++) {
          const key = this.accessOrder[i];
          const tile = this.cache.get(key);
          if (tile && tile.state !== 'loading') {
            this.delete(TileCoordinateSystem.parseTileKey(key));
            return;
          }
        }
        // All tiles are loading, can't evict
        return;
      }

      this.delete(TileCoordinateSystem.parseTileKey(lruKey));
    }
  }

  /**
   * Update access order for a tile
   */
  private updateAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index !== -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.push(key);
  }

  /**
   * Remove a tile from access order
   */
  private removeFromAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index !== -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    maxSize: number;
    loading: number;
    loaded: number;
    error: number;
  } {
    const tiles = Array.from(this.cache.values());
    return {
      size: this.cache.size,
      maxSize: this.config.cacheSize,
      loading: tiles.filter((t) => t.state === 'loading').length,
      loaded: tiles.filter((t) => t.state === 'loaded').length,
      error: tiles.filter((t) => t.state === 'error').length,
    };
  }
}
