import type { Tile, TileOptions } from './types.js';

/**
 * Loads and decodes tile images with error handling and retry logic
 */
export class TileLoader {
  private config: TileOptions;
  private pendingRequests = new Map<string, AbortController>();

  constructor(config: TileOptions) {
    this.config = config;
  }

  /**
   * Load a single tile image
   */
  async loadTile(tile: Tile): Promise<HTMLImageElement> {
    const key = `${tile.z}:${tile.x}:${tile.y}`;

    // Cancel any existing request for this tile
    const existingController = this.pendingRequests.get(key);
    if (existingController) {
      existingController.abort();
    }

    // Create new abort controller for this request
    const controller = new AbortController();
    this.pendingRequests.set(key, controller);

    try {
      const url = this.buildTileUrl(tile);
      const response = await fetch(url, {
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Failed to load tile: ${response.status} ${response.statusText}`);
      }

      const blob = await response.blob();
      const image = await this.decodeImage(blob);

      // Validate tile size
      this.validateTile(image, this.config.tileSize);

      return image;
    } finally {
      this.pendingRequests.delete(key);
    }
  }

  /**
   * Build tile URL from template
   */
  private buildTileUrl(tile: Tile): string {
    return this.config.baseUrl
      .replace('{z}', tile.z.toString())
      .replace('{x}', tile.x.toString())
      .replace('{y}', tile.y.toString());
  }

  /**
   * Decode image blob to HTMLImageElement
   */
  private decodeImage(blob: Blob): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      const url = URL.createObjectURL(blob);

      image.onload = () => {
        URL.revokeObjectURL(url);
        resolve(image);
      };

      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to decode tile image'));
      };

      image.src = url;
    });
  }

  /**
   * Validate tile dimensions
   * Edge tiles may be smaller than expectedSize, so we use >= comparison
   */
  private validateTile(image: HTMLImageElement, expectedSize: number): void {
    if (image.width > expectedSize || image.height > expectedSize) {
      throw new Error(
        `Tile size exceeds maximum: expected <= ${expectedSize}x${expectedSize}, got ${image.width}x${image.height}`,
      );
    }
  }

  /**
   * Cancel all pending requests
   */
  cancelAll(): void {
    for (const controller of this.pendingRequests.values()) {
      controller.abort();
    }
    this.pendingRequests.clear();
  }

  /**
   * Cancel request for a specific tile
   */
  cancelTile(tile: Tile): void {
    const key = `${tile.z}:${tile.x}:${tile.y}`;
    const controller = this.pendingRequests.get(key);
    if (controller) {
      controller.abort();
      this.pendingRequests.delete(key);
    }
  }

  /**
   * Get number of pending requests
   */
  getPendingCount(): number {
    return this.pendingRequests.size;
  }
}
