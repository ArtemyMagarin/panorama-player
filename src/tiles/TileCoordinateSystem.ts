import type { Tile, ViewportInfo } from './types.js';

/**
 * Tile coordinate system for equirectangular panoramas
 * Maps XYZ tile coordinates to equirectangular projection
 */
export class TileCoordinateSystem {
  /**
   * Calculate the number of tiles along the X axis at a given zoom level
   * X axis covers 360° longitude
   */
  static getTilesX(z: number): number {
    return 4 * Math.pow(2, z);
  }

  /**
   * Calculate the number of tiles along the Y axis at a given zoom level
   * Y axis covers 180° latitude (-90° to +90°)
   */
  static getTilesY(z: number): number {
    return 2 * Math.pow(2, z);
  }

  /**
   * Map tile coordinates to UV coordinates (0-1 range)
   * U: longitude (0 to 360°)
   * V: latitude (+90° to -90°, top to bottom)
   */
  static tileToUV(z: number, x: number, y: number): { u: number; v: number } {
    const tilesX = this.getTilesX(z);
    const tilesY = this.getTilesY(z);
    return {
      u: x / tilesX,
      v: y / tilesY,
    };
  }

  /**
   * Map UV coordinates to tile coordinates
   */
  static uvToTile(z: number, u: number, v: number): { x: number; y: number } {
    const tilesX = this.getTilesX(z);
    const tilesY = this.getTilesY(z);
    return {
      x: Math.floor(u * tilesX),
      y: Math.floor(v * tilesY),
    };
  }

  /**
   * Calculate the optimal zoom level based on viewport size and device capabilities
   */
  static calculateOptimalZoom(viewport: ViewportInfo, tileSize: number, maxZoom: number): number {
    const { width, height, dpr, fov } = viewport;
    const screenCoverage = Math.max(width, height) * dpr;
    const fovFactor = fov / 75; // relative to 75° default
    const tilesNeeded = (screenCoverage * fovFactor) / tileSize;
    const requiredZoom = Math.log2(tilesNeeded);

    // Clamp to available zoom levels
    return Math.min(Math.max(0, Math.floor(requiredZoom)), maxZoom);
  }

  /**
   * Get all tiles at a given zoom level
   */
  static getTilesAtZoom(z: number): Tile[] {
    const tilesX = this.getTilesX(z);
    const tilesY = this.getTilesY(z);
    const tiles: Tile[] = [];

    for (let y = 0; y < tilesY; y++) {
      for (let x = 0; x < tilesX; x++) {
        tiles.push({ z, x, y });
      }
    }

    return tiles;
  }

  /**
   * Get tiles visible within a viewport defined by UV bounds
   */
  static getVisibleTiles(
    z: number,
    minU: number,
    maxU: number,
    minV: number,
    maxV: number,
  ): Tile[] {
    const tilesX = this.getTilesX(z);
    const tilesY = this.getTilesY(z);
    const tiles: Tile[] = [];

    const minX = Math.floor(minU * tilesX);
    const maxX = Math.ceil(maxU * tilesX);
    const minY = Math.floor(minV * tilesY);
    const maxY = Math.ceil(maxV * tilesY);

    for (let y = Math.max(0, minY); y < Math.min(tilesY, maxY); y++) {
      for (let x = Math.max(0, minX); x < Math.min(tilesX, maxX); x++) {
        tiles.push({ z, x, y });
      }
    }

    return tiles;
  }

  /**
   * Get tiles within a Chebyshev distance (L∞) from a set of tiles
   * Used for preloading adjacent tiles
   */
  static getTilesWithinRadius(centerTiles: Tile[], radius: number, _maxZ: number): Tile[] {
    const tilesSet = new Set<string>();
    const result: Tile[] = [];

    for (const centerTile of centerTiles) {
      const { z, x, y } = centerTile;
      const tilesX = this.getTilesX(z);
      const tilesY = this.getTilesY(z);

      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = (x + dx + tilesX) % tilesX; // Wrap around date line
          const ny = Math.max(0, Math.min(tilesY - 1, y + dy));

          const key = `${z}:${nx}:${ny}`;
          if (!tilesSet.has(key)) {
            tilesSet.add(key);
            result.push({ z, x: nx, y: ny });
          }
        }
      }
    }

    return result;
  }

  /**
   * Validate tile coordinates
   */
  static isValidTile(tile: Tile, maxZ: number): boolean {
    if (tile.z < 0 || tile.z > maxZ) return false;
    const tilesX = this.getTilesX(tile.z);
    const tilesY = this.getTilesY(tile.z);
    return tile.x >= 0 && tile.x < tilesX && tile.y >= 0 && tile.y < tilesY;
  }

  /**
   * Get tile key for caching
   */
  static getTileKey(tile: Tile): string {
    return `${tile.z}:${tile.x}:${tile.y}`;
  }

  /**
   * Parse tile key back to tile object
   */
  static parseTileKey(key: string): Tile {
    const [z, x, y] = key.split(':').map(Number);
    return { z, x, y };
  }
}
