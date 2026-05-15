# Tile-Based Panorama Loading Implementation

## Overview

This implementation adds tile-based panorama loading to the PanoramaPlayer, enabling efficient on-demand loading of high-resolution panoramic images. The system divides large panoramas into smaller tiles that are loaded only when needed, significantly improving performance and reducing memory usage.

## Architecture

### Core Components

1. **TileCoordinateSystem** (`src/tiles/TileCoordinateSystem.ts`)
   - Maps between XYZ tile coordinates and equirectangular UV coordinates
   - Calculates optimal zoom levels based on viewport size
   - Determines visible tiles within a given view
   - Handles coordinate transformations and validation

2. **TileLoader** (`src/tiles/TileLoader.ts`)
   - Fetches and decodes individual tile images
   - Implements request cancellation and deduplication
   - Validates tile dimensions
   - Handles network errors and retries

3. **TileCache** (`src/tiles/TileCache.ts`)
   - LRU (Least Recently Used) cache for loaded tiles
   - Manages WebGL texture lifecycle
   - Implements priority-based eviction
   - Tracks cache statistics

4. **TileManager** (`src/tiles/TileManager.ts`)
   - Orchestrates the entire tile loading pipeline
   - Manages loading queue with concurrency limits
   - Coordinates between cache, loader, and renderer
   - Provides event callbacks for loading progress

5. **TileRenderer** (`src/renderer/TileRenderer.ts`)
   - Renders individual tiles as textured quads
   - Handles UV remapping from world-space to tile-local coordinates
   - Supports both WebGL1 and WebGL2
   - Manages per-tile texture objects

### Coordinate System

The implementation uses an XYZ tile coordinate system similar to web maps:

- **Z (Zoom)**: Integer zoom level (0 = lowest resolution, higher = more detail)
- **X (Longitude)**: Tile column index (0 to 2^z - 1)
- **Y (Latitude)**: Tile row index (0 to 2^(z-1) - 1)

At zoom level 0, the panorama is divided into 4×2 tiles (8 total). Each subsequent zoom level doubles the resolution in both dimensions.

### URL Template

Tiles are loaded using a URL template with placeholders:

```
tiles/{z}/{x}/{y}.jpg
```

Example URLs:

- `tiles/0/0/0.jpg` - Zoom 0, tile (0, 0)
- `tiles/2/3/1.jpg` - Zoom 2, tile (3, 1)

## API Usage

### Basic Usage

```typescript
import { PanoramaPlayer } from 'panorama-player';

const player = new PanoramaPlayer({
  container: document.getElementById('container'),
  tiles: {
    baseUrl: 'https://example.com/panorama/tiles/{z}/{x}/{y}.jpg',
    tileSize: 512,
    minZoom: 0,
    maxZoom: 3,
    cacheSize: 64,
    preloadRadius: 1,
    maxConcurrentRequests: 6,
    adaptiveZoom: true,
  },
});

// Tiles are loaded automatically based on the tiles option
```

### Manual Loading

```typescript
const player = new PanoramaPlayer({
  container: document.getElementById('container'),
});

// Load tiles programmatically
await player.loadTiles({
  baseUrl: 'https://example.com/panorama/tiles/{z}/{x}/{y}.jpg',
  tileSize: 512,
  minZoom: 0,
  maxZoom: 3,
});
```

### Event Callbacks

```typescript
const player = new PanoramaPlayer({
  container: document.getElementById('container'),
  tiles: {
    baseUrl: 'tiles/{z}/{x}/{y}.jpg',
    tileSize: 512,
    minZoom: 0,
    maxZoom: 3,
  },
  onTileLoadStart: (tile) => {
    console.log(`Loading tile ${tile.z}/${tile.x}/${tile.y}`);
  },
  onTileLoadProgress: (tile, progress) => {
    console.log(`Progress: ${progress}%`);
  },
  onTileLoadComplete: (tile) => {
    console.log(`Tile ${tile.z}/${tile.x}/${tile.y} loaded`);
  },
  onTileError: (tile, error) => {
    console.error(`Failed to load tile:`, error);
  },
});
```

## Configuration Options

### TileOptions

| Option                  | Type      | Default | Description                    |
| ----------------------- | --------- | ------- | ------------------------------ |
| `baseUrl`               | `string`  | -       | URL template for tile images   |
| `minZoom`               | `number`  | `0`     | Minimum available zoom level   |
| `maxZoom`               | `number`  | `3`     | Maximum available zoom level   |
| `tileSize`              | `number`  | `512`   | Size of each tile in pixels    |
| `cacheSize`             | `number`  | `64`    | Maximum tiles to cache         |
| `preloadRadius`         | `number`  | `1`     | Preload radius around viewport |
| `maxConcurrentRequests` | `number`  | `6`     | Maximum simultaneous requests  |
| `adaptiveZoom`          | `boolean` | `true`  | Auto-select optimal zoom       |

## Performance Characteristics

### Memory Usage

- **Per Tile**: ~1-2 MB (512×512 JPEG at 80% quality)
- **Cache Size**: 64 tiles = ~64-128 MB (configurable)
- **Texture Memory**: Additional GPU memory for cached tiles

### Loading Performance

- **Initial Load**: Only visible tiles (typically 4-8 tiles)
- **Pan/Zoom**: On-demand loading of newly visible tiles
- **Preloading**: Tiles within preload radius loaded in advance
- **Concurrent Loading**: Up to 6 simultaneous requests (configurable)

### Optimization Strategies

1. **Adaptive Zoom**: Automatically selects optimal zoom level based on viewport
2. **LRU Caching**: Keeps frequently used tiles in memory
3. **Priority Loading**: Loads visible tiles first, then preloads adjacent tiles
4. **Request Deduplication**: Cancels duplicate requests for the same tile
5. **Texture Management**: Efficient WebGL texture lifecycle

## Browser Compatibility

- **WebGL1**: Full support with fallback rendering
- **WebGL2**: Enhanced performance with additional features
- **Fetch API**: Required for tile loading
- **Blob/URL.createObjectURL**: Required for image decoding

### Minimum Browser Versions

- Chrome 51+
- Firefox 54+
- Safari 10.1+
- Edge 15+

## Server-Side Requirements

### Tile Generation

Panoramas must be pre-processed into tile pyramids:

1. **Input**: High-resolution equirectangular image
2. **Processing**: Generate image pyramid at multiple zoom levels
3. **Output**: Individual tile images following URL template

### Tile Format Recommendations

- **Format**: JPEG (80% quality) or WebP
- **Size**: 512×512 or 1024×1024 pixels
- **Naming**: `{z}/{x}/{y}.jpg` pattern
- **Compression**: Balance quality and file size

### Example Tile Structure

```
tiles/
├── 0/
│   ├── 0/
│   │   ├── 0.jpg
│   │   ├── 1.jpg
│   │   └── 2.jpg
│   ├── 1/
│   │   ├── 0.jpg
│   │   ├── 1.jpg
│   │   └── 2.jpg
│   └── 2/
│       ├── 0.jpg
│       ├── 1.jpg
│       └── 2.jpg
├── 1/
│   └── ... (8×4 = 32 tiles)
└── 2/
    └── ... (16×8 = 128 tiles)
```

## Testing

### Unit Tests

- **TileCoordinateSystem**: 22 tests covering coordinate mapping, validation, and zoom calculation
- **TileLoader**: 6 tests covering loading, error handling, and request cancellation
- **Total**: 83 tests passing (including existing tests)

### Test Coverage

```bash
# Run all tests
pnpm test

# Run specific test suite
pnpm test tests/unit/tile-coordinate-system.test.ts
pnpm test tests/unit/tile-loader.test.ts
```

## Migration Guide

### From Single Image to Tiles

**Before:**

```typescript
const player = new PanoramaPlayer({
  container: document.getElementById('container'),
  image: 'panorama.jpg',
});
```

**After:**

```typescript
const player = new PanoramaPlayer({
  container: document.getElementById('container'),
  tiles: {
    baseUrl: 'tiles/{z}/{x}/{y}.jpg',
    tileSize: 512,
    minZoom: 0,
    maxZoom: 3,
  },
});
```

### Dual-Mode Support

The player supports both single-image and tile-based modes:

```typescript
// Start with single image
const player = new PanoramaPlayer({
  container: document.getElementById('container'),
  image: 'preview.jpg',
});

// Later switch to tiles
await player.loadTiles({
  baseUrl: 'tiles/{z}/{x}/{y}.jpg',
  tileSize: 512,
  minZoom: 0,
  maxZoom: 3,
});
```

## Troubleshooting

### Common Issues

1. **Tiles Not Loading**
   - Verify URL template is correct
   - Check CORS configuration on server
   - Ensure tile files exist at expected paths

2. **Poor Performance**
   - Reduce `cacheSize` for low-memory devices
   - Increase `preloadRadius` for smoother panning
   - Lower `maxZoom` to reduce total tile count

3. **Visual Artifacts**
   - Ensure all tiles at a zoom level are available
   - Check tile dimensions match `tileSize` configuration
   - Verify tile alignment and overlap

### Debug Mode

Enable detailed logging:

```typescript
const player = new PanoramaPlayer({
  container: document.getElementById('container'),
  tiles: {
    baseUrl: 'tiles/{z}/{x}/{y}.jpg',
    tileSize: 512,
    minZoom: 0,
    maxZoom: 3,
  },
  onTileLoadStart: (tile) => console.log('Loading:', tile),
  onTileLoadComplete: (tile) => console.log('Loaded:', tile),
  onTileError: (tile, error) => console.error('Error:', tile, error),
});
```

## Future Enhancements

Potential improvements for future versions:

1. **Progressive Loading**: Load low-res tiles first, then upgrade to high-res
2. **WebP Support**: Use WebP for better compression
3. **Tile Prediction**: Predict and preload tiles based on user behavior
4. **Memory Monitoring**: Dynamic cache sizing based on available memory
5. **Tile Prioritization**: Smart prioritization based on viewport position

## References

- **ADR 0001**: [Tile-Based Panorama Loading](../adr/0001-tile-based-panorama-loading.md)
- **Web Map Tiling**: [OpenStreetMap tiling scheme](https://wiki.openstreetmap.org/wiki/Slippy_map_tilenames)
- **Equirectangular Projection**: Standard panoramic projection format

## License

This implementation is part of the PanoramaPlayer project and follows the same license terms.
