/**
 * Configuration options for tile-based panorama loading
 */
export interface TileOptions {
  /**
   * Base URL template for tile images.
   * Supports {z}, {x}, {y} placeholders.
   * Example: "tiles/{z}/{x}/{y}.jpg"
   */
  baseUrl: string;

  /**
   * Minimum available zoom level (typically 0)
   */
  minZoom: number;

  /**
   * Maximum available zoom level (typically 3 for 32x16 tiles)
   */
  maxZoom: number;

  /**
   * Size of each tile in pixels (must be square)
   * Common values: 512, 1024
   */
  tileSize: number;

  /**
   * Maximum number of tiles to keep in memory
   * Default: 64 (32 for low-memory devices)
   */
  cacheSize: number;

  /**
   * Preload tiles within this Chebyshev distance (L∞) from viewport boundary
   * 0 = only visible tiles
   * 1 = visible + all 8 adjacent neighbours
   * 2 = 25-tile ring
   * Default: 1
   */
  preloadRadius: number;

  /**
   * Maximum simultaneous tile requests
   * Default: 6
   */
  maxConcurrentRequests: number;

  /**
   * Automatically select optimal zoom based on viewport size
   * Default: true
   */
  adaptiveZoom: boolean;
}

/**
 * Represents a single tile with its coordinates
 */
export interface Tile {
  z: number;
  x: number;
  y: number;
}

/**
 * Tile loading state
 */
export enum TileState {
  Pending = 'pending',
  Loading = 'loading',
  Loaded = 'loaded',
  Error = 'error',
}

/**
 * Cached tile with its texture and metadata
 */
export interface CachedTile {
  tile: Tile;
  texture: WebGLTexture | null;
  state: TileState;
  lastAccess: number;
  loadPromise: Promise<void> | null;
  abortController: AbortController | null;
}

/**
 * Viewport information for tile selection
 */
export interface ViewportInfo {
  width: number;
  height: number;
  dpr: number;
  fov: number;
}

/**
 * Tile loading progress
 */
export interface TileLoadProgress {
  loaded: number;
  total: number;
  zoom: number;
}

/**
 * Tile error information
 */
export interface TileError {
  error: Error;
  tile: Tile;
}
