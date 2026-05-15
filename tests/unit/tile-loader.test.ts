import { TileLoader } from '../../src/tiles/TileLoader.js';
import type { TileOptions } from '../../src/tiles/types.js';

// Mock fetch globally
global.fetch = jest.fn() as any;

// Mock URL.createObjectURL
global.URL.createObjectURL = jest.fn(() => 'mock-url') as any;
global.URL.revokeObjectURL = jest.fn() as any;

describe('TileLoader', () => {
  let loader: TileLoader;
  let mockFetch: jest.MockedFunction<typeof fetch>;
  let mockConfig: TileOptions;

  beforeEach(() => {
    // Reset fetch mock before each test
    mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
    mockFetch.mockClear();
    mockConfig = {
      tileSize: 256,
      minZoom: 0,
      maxZoom: 3,
      baseUrl: 'https://example.com/tiles/{z}/{x}/{y}.png',
      cacheSize: 100,
      preloadRadius: 1,
      maxConcurrentRequests: 4,
      adaptiveZoom: true,
    };
    loader = new TileLoader(mockConfig);
    mockFetch = fetch as jest.MockedFunction<typeof fetch>;
    mockFetch.mockClear();
  });

  describe('loadTile', () => {
    it('should load a tile image successfully', async () => {
      global.Image = class extends Image {
        constructor() {
          super();
          (this as any).width = 256;
          (this as any).height = 256;
          setTimeout(() => {
            (this as any).onload?.();
          }, 0);
        }
      } as any;

      const mockResponse = {
        ok: true,
        blob: async () => new Blob(['mock image data'], { type: 'image/png' }),
      } as Response;

      mockFetch.mockResolvedValueOnce(mockResponse);

      const result = await loader.loadTile({ z: 0, x: 0, y: 0 });

      expect(result).toBeInstanceOf(HTMLImageElement);
      expect(result.width).toBe(256);
      expect(result.height).toBe(256);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/tiles/0/0/0.png',
        expect.any(Object),
      );
    });

    it('should handle loading errors', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as Response;

      mockFetch.mockResolvedValueOnce(mockResponse);

      await expect(loader.loadTile({ z: 0, x: 0, y: 0 })).rejects.toThrow(
        'Failed to load tile: 404 Not Found',
      );
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(loader.loadTile({ z: 0, x: 0, y: 0 })).rejects.toThrow('Network error');
    });

    it('should cancel previous request for same tile', async () => {
      const abortSpy = jest.spyOn(AbortController.prototype, 'abort');

      const mockResponse = {
        ok: true,
        blob: async () => new Blob(['mock image data'], { type: 'image/png' }),
      } as Response;

      mockFetch.mockResolvedValue(mockResponse);

      global.Image = class extends Image {
        constructor() {
          super();
          (this as any).width = 256;
          (this as any).height = 256;
          setTimeout(() => {
            (this as any).onload?.();
          }, 0);
        }
      } as any;

      // First request
      const promise1 = loader.loadTile({ z: 0, x: 0, y: 0 });

      // Second request for same tile should abort first
      const promise2 = loader.loadTile({ z: 0, x: 0, y: 0 });

      await Promise.all([promise1, promise2]);

      expect(abortSpy).toHaveBeenCalled();
    });

    it('should validate tile size', async () => {
      global.Image = class extends Image {
        constructor() {
          super();
          (this as any).width = 128; // Wrong size
          (this as any).height = 128;
          setTimeout(() => {
            (this as any).onload?.();
          }, 0);
        }
      } as any;

      const mockResponse = {
        ok: true,
        blob: async () => new Blob(['mock image data'], { type: 'image/png' }),
      } as Response;

      mockFetch.mockResolvedValueOnce(mockResponse);

      await expect(loader.loadTile({ z: 0, x: 0, y: 0 })).rejects.toThrow('Tile size mismatch');
    });

    it('should build correct URL from template', async () => {
      const mockResponse = {
        ok: true,
        blob: async () => new Blob(['mock image data'], { type: 'image/png' }),
      } as Response;

      mockFetch.mockResolvedValueOnce(mockResponse);

      global.Image = class extends Image {
        constructor() {
          super();
          (this as any).width = 256;
          (this as any).height = 256;
          setTimeout(() => {
            (this as any).onload?.();
          }, 0);
        }
      } as any;

      await loader.loadTile({ z: 2, x: 3, y: 1 });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/tiles/2/3/1.png',
        expect.any(Object),
      );
    });
  });
});
