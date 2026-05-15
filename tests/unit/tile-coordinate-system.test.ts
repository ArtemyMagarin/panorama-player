import { TileCoordinateSystem } from '../../src/tiles/TileCoordinateSystem.js';

describe('TileCoordinateSystem', () => {
  describe('getTilesX', () => {
    it('should return correct number of tiles for zoom level 0', () => {
      expect(TileCoordinateSystem.getTilesX(0)).toBe(4);
    });

    it('should return correct number of tiles for zoom level 1', () => {
      expect(TileCoordinateSystem.getTilesX(1)).toBe(8);
    });

    it('should return correct number of tiles for zoom level 2', () => {
      expect(TileCoordinateSystem.getTilesX(2)).toBe(16);
    });

    it('should return correct number of tiles for zoom level 3', () => {
      expect(TileCoordinateSystem.getTilesX(3)).toBe(32);
    });
  });

  describe('getTilesY', () => {
    it('should return correct number of tiles for zoom level 0', () => {
      expect(TileCoordinateSystem.getTilesY(0)).toBe(2);
    });

    it('should return correct number of tiles for zoom level 1', () => {
      expect(TileCoordinateSystem.getTilesY(1)).toBe(4);
    });

    it('should return correct number of tiles for zoom level 2', () => {
      expect(TileCoordinateSystem.getTilesY(2)).toBe(8);
    });

    it('should return correct number of tiles for zoom level 3', () => {
      expect(TileCoordinateSystem.getTilesY(3)).toBe(16);
    });
  });

  describe('tileToUV', () => {
    it('should map tile (0,0,0) to UV (0,0)', () => {
      const uv = TileCoordinateSystem.tileToUV(0, 0, 0);
      expect(uv.u).toBe(0);
      expect(uv.v).toBe(0);
    });

    it('should map tile (0,3,1) to UV (0.75,0.5)', () => {
      const uv = TileCoordinateSystem.tileToUV(0, 3, 1);
      expect(uv.u).toBe(0.75);
      expect(uv.v).toBe(0.5);
    });

    it('should map tile (1,7,3) to UV (0.875,0.75)', () => {
      const uv = TileCoordinateSystem.tileToUV(1, 7, 3);
      expect(uv.u).toBe(0.875);
      expect(uv.v).toBe(0.75);
    });
  });

  describe('uvToTile', () => {
    it('should map UV (0,0) to tile (0,0,0)', () => {
      const tile = TileCoordinateSystem.uvToTile(0, 0, 0);
      expect(tile.x).toBe(0);
      expect(tile.y).toBe(0);
    });

    it('should map UV (0.5,0.5) to tile (4,2,1)', () => {
      const tile = TileCoordinateSystem.uvToTile(1, 0.5, 0.5);
      expect(tile.x).toBe(4);
      expect(tile.y).toBe(2);
    });
  });

  describe('calculateOptimalZoom', () => {
    it('should return zoom 0 for small viewport', () => {
      const viewport = {
        width: 640,
        height: 480,
        dpr: 1,
        fov: 75,
      };
      const zoom = TileCoordinateSystem.calculateOptimalZoom(viewport, 512, 3);
      expect(zoom).toBe(0);
    });

    it('should return higher zoom for large viewport', () => {
      const viewport = {
        width: 3840,
        height: 2160,
        dpr: 2,
        fov: 75,
      };
      const zoom = TileCoordinateSystem.calculateOptimalZoom(viewport, 512, 3);
      expect(zoom).toBeGreaterThan(0);
    });

    it('should clamp to maxZoom', () => {
      const viewport = {
        width: 10000,
        height: 10000,
        dpr: 3,
        fov: 75,
      };
      const zoom = TileCoordinateSystem.calculateOptimalZoom(viewport, 512, 2);
      expect(zoom).toBeLessThanOrEqual(2);
    });
  });

  describe('getTileKey', () => {
    it('should create unique key for tile', () => {
      const key = TileCoordinateSystem.getTileKey({ z: 1, x: 2, y: 3 });
      expect(key).toBe('1:2:3');
    });
  });

  describe('parseTileKey', () => {
    it('should parse key back to tile', () => {
      const tile = TileCoordinateSystem.parseTileKey('1:2:3');
      expect(tile.z).toBe(1);
      expect(tile.x).toBe(2);
      expect(tile.y).toBe(3);
    });
  });

  describe('isValidTile', () => {
    it('should return true for valid tile', () => {
      const tile = { z: 1, x: 4, y: 2 };
      expect(TileCoordinateSystem.isValidTile(tile, 3)).toBe(true);
    });

    it('should return false for invalid zoom', () => {
      const tile = { z: 4, x: 0, y: 0 };
      expect(TileCoordinateSystem.isValidTile(tile, 3)).toBe(false);
    });

    it('should return false for invalid x coordinate', () => {
      const tile = { z: 1, x: 8, y: 0 };
      expect(TileCoordinateSystem.isValidTile(tile, 3)).toBe(false);
    });

    it('should return false for invalid y coordinate', () => {
      const tile = { z: 1, x: 0, y: 4 };
      expect(TileCoordinateSystem.isValidTile(tile, 3)).toBe(false);
    });
  });
});
