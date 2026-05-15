# ADR 0001: Tile-Based Panorama Loading

## Status

Accepted

## Context

The panorama-player currently loads entire equirectangular panorama images as single textures. This approach works well for small to medium-sized images but becomes problematic for high-resolution panoramas (8K+):

- **Long initial load times**: Users must wait for the entire image to download before seeing anything
- **High memory usage**: Full-resolution textures consume significant GPU memory
- **Poor bandwidth utilization**: Users may only view a portion of the panorama but download the entire image
- **Limited scalability**: Extremely high-resolution panoramas (16K+) may exceed device capabilities

## Decision

Implement a tile-based loading system that divides panoramas into smaller, manageable chunks (tiles) that can be loaded on-demand based on the user's current view direction. **The library will support both approaches simultaneously** - users can choose between single-image loading (existing behavior) or tile-based loading (new feature) based on their use case.

### Key Components

1. **Tile Coordinate System**: Maps XYZ tile coordinates to equirectangular projection
2. **Tile Cache**: LRU cache with configurable size and priority-based eviction
3. **Tile Loader**: Fetches and decodes tile images with error handling
4. **Tile Manager**: Orchestrates loading, caching, and rendering coordination

### Technical Approach

**Coordinate Mapping**:

- X (longitude): 0-360° horizontal position
- Y (latitude): -90° to +90° vertical position (top-to-bottom: Y=0 at +90°, Y=1 at -90°)
- Z (zoom): Grid resolution calculated as `width = 4 * 2^zoom`, `height = 2 * 2^zoom`
  - z=0: 4×2 tiles (lowest resolution, fastest load)
  - z=1: 8×4 tiles
  - z=2: 16×8 tiles
  - z=3: 32×16 tiles (highest resolution, most detail)

**Tile-to-UV Mapping**:

```typescript
// Explicit mapping from XYZ to equirectangular UV
function tileToUV(z: number, x: number, y: number): { u: number; v: number } {
  const tilesX = 4 * Math.pow(2, z);
  const tilesY = 2 * Math.pow(2, z);
  return {
    u: x / tilesX, // 0 to 1 (longitude 0 to 360)
    v: y / tilesY, // 0 to 1 (latitude +90 to -90, top to bottom)
  };
}
```

**Adaptive Zoom Strategy**:

The system automatically selects the optimal zoom level based on viewport size and device capabilities:

```typescript
function calculateOptimalZoom(
  viewportWidth: number,
  viewportHeight: number,
  tileSize: number,
  dpr: number,
  fov: number,
  maxZoom: number,
): number {
  // A tile covers (tileSize / tilesPerAxis) degrees of the visible arc.
  // At zoom z, tilesX = 4*2^z covers 360°, so each tile covers 360/(4*2^z) degrees.
  // We want the tile's pixel footprint to be ≥ 1 screen pixel, meaning:
  //   tileSize / (viewportPx * (fov/360)) ≥ 1
  // Solving for z: z = log2(viewportPx * dpr * fov / (tileSize * 360 / 4))
  // Simplified form using normalized FOV ratio against default (75°):
  const screenCoverage = Math.max(viewportWidth, viewportHeight) * dpr;
  const fovFactor = fov / 75; // relative to 75° default; wider FOV → more tiles visible → lower zoom needed
  const tilesNeeded = (screenCoverage * fovFactor) / tileSize;
  const requiredZoom = Math.log2(tilesNeeded);

  // Clamp to available zoom levels
  return Math.min(Math.max(0, Math.floor(requiredZoom)), maxZoom);
}
```

**Loading Strategy**:

1. **Initial Load**: Use adaptive zoom to load appropriate resolution for viewport
2. **Progressive Enhancement**: Start with lower zoom, upgrade to higher zoom as tiles load
3. **View-Based Priority**: Load tiles in current view first, then adjacent tiles
4. **Dynamic Adjustment**: Recalculate zoom on viewport resize or device capability changes
5. **Automatic Loading**: Tiles begin loading automatically when the player mounts with the `tiles` option present

**Rendering**:

Two strategies are used depending on the number of visible tiles:

- **Per-tile textures** (primary): Each tile is uploaded as an individual `WebGLTexture` and rendered with a separate draw call. No layer limit; works on WebGL1 and WebGL2. Used when visible tile count exceeds the texture array budget.
- **WebGL2 Texture Array** (optimisation): Tiles packed into a `TEXTURE_2D_ARRAY` and rendered in a single draw call. Applied only when `visibleTileCount ≤ Math.min(gl.MAX_ARRAY_TEXTURE_LAYERS, cacheSize)`. At z=3 there are 32×16 = 512 tiles; the guaranteed minimum `MAX_ARRAY_TEXTURE_LAYERS` is 256, so texture arrays are opportunistic, not required.
- **WebGL1 fallback**: Per-tile textures with single draw calls; no texture array used.
- Feature Detection: Detect WebGL2 support at runtime via `canvas.getContext('webgl2')`.
- Context Loss Handling: Listen for `webglcontextlost`/`webglcontextrestored` events; recreate all tile textures on restore.

### API Design

```typescript
interface TileOptions {
  // No `enabled` field — presence of the `tiles` option implies tile mode.
  // Set `tiles: undefined` or omit it to use single-image mode.
  baseUrl: string; // e.g., "tiles/{z}/{x}/{y}.jpg" - supports {z}, {x}, {y} placeholders
  minZoom: number; // e.g., 0 (minimum available zoom level)
  maxZoom: number; // e.g., 3 (maximum available zoom level)
  tileSize: number; // e.g., 512 (pixels per tile, must be square)
  cacheSize: number; // e.g., 64 (maximum number of tiles in memory)
  // Preload tiles within this Chebyshev distance (L∞) from the viewport boundary.
  // 0 = only visible tiles; 1 = visible + all 8 adjacent neighbours; 2 = 25-tile ring; etc.
  preloadRadius: number;
  maxConcurrentRequests: number; // e.g., 6 (maximum simultaneous tile requests)
  adaptiveZoom: boolean; // e.g., true (automatically select zoom based on viewport)
}

interface PanoramaOptions {
  // ... existing options (unchanged)
  // `tiles` is a convenience shortcut: when present, loadTiles() is called automatically after mount.
  // It does not replace calling loadTiles() imperatively; both are equivalent.
  tiles?: TileOptions;
}

interface PanoramaEvents {
  // ... existing events
  onTileLoadStart?: () => void;
  // `total` reflects the tile set planned at the moment of the event and may
  // change mid-load if the viewport moves (pan/zoom). Do not use it for a
  // deterministic progress bar; use it as a rough indicator only.
  onTileLoadProgress?: (payload: { loaded: number; total: number; zoom: number }) => void;
  onTileLoadComplete?: () => void;
  onTileError?: (payload: { error: Error; tile: { z: number; x: number; y: number } }) => void;
}
```

### Dual-Mode Support

The library will support both loading approaches simultaneously:

**Single-Image Mode (Existing)**:

- Images are loaded via the existing `loadImage(src)` method — no API change
- Simple, fast for small to medium panoramas
- No server-side processing required
- Maintains current API and behavior exactly

**Tile-Based Mode (New)**:

- Tiles are loaded via a new `loadTiles(config: TileOptions): void` method, mirroring the imperative style of `loadImage()`
- The `tiles?: TileOptions` constructor option is a convenience shortcut: when provided, `loadTiles()` is called automatically after mount
- Optimized for high-resolution panoramas (8K+)
- Requires pre-processed tiles on server
- Progressive loading with view-based optimization
- **Adaptive zoom**: Automatically selects optimal resolution based on viewport size

**API Design**:

```typescript
// Single-image mode (existing — unchanged)
const player = new PanoramaPlayer();
player.mount(container);
player.loadImage('panorama.jpg');

// Tile-based mode (new) — imperative, mirrors loadImage()
const player = new PanoramaPlayer();
player.mount(container);
player.loadTiles({
  baseUrl: 'tiles/{z}/{x}/{y}.jpg',
  minZoom: 0,
  maxZoom: 3,
  tileSize: 512,
  cacheSize: 64,
  preloadRadius: 1, // Chebyshev distance: 1 = visible tiles + 8 direct neighbours
  maxConcurrentRequests: 6,
  adaptiveZoom: true,
});

// Tile-based mode via constructor shortcut (auto-loads on mount)
const player = new PanoramaPlayer({
  tiles: {
    baseUrl: 'tiles/{z}/{x}/{y}.jpg',
    // ...
  },
});
player.mount(container); // loadTiles() called automatically
```

**Backward Compatibility**:

- `loadImage()` continues to work unchanged; no existing code is affected
- Tile-based loading is opt-in via `loadTiles()` or the `tiles` constructor option
- No breaking changes to existing API
- Graceful degradation: WebGL1 devices use per-tile textures without texture arrays

## Consequences

### Positive

- **Dual-mode flexibility**: Users choose the best approach for their use case
- **Faster initial load**: Tile mode provides progressive loading for large panoramas
- **Reduced memory usage**: Tile mode keeps only visible tiles in memory
- **Better bandwidth utilization**: Tile mode downloads only what's viewed
- **Scalability**: Tile mode supports extremely high-resolution panoramas
- **Backward compatibility**: Existing single-image mode continues to work unchanged
- **No breaking changes**: Existing API remains fully functional

### Negative

- **Increased complexity**: Additional components and logic to maintain
- **Server requirements**: Tile mode requires pre-processed tiles on server
- **Potential visual artifacts**: Tile boundaries may be visible during loading
- **Additional configuration**: Tile mode requires URL and parameter configuration
- **Decision overhead**: Users must choose between single-image and tile modes
- **No runtime mode switching**: Switching between single-image and tile mode requires recreating the player instance; the mode is fixed at construction time.
- **Increased draw-call count**: Tile mode issues one `drawElements` call per visible tile (typically 10–30+ at z=2, up to 60+ at z=3) compared to the current single draw call per frame. This increases GPU command overhead and may require batching optimizations on lower-end devices.

### Neutral

- **Code size increase**: Additional tile system code (~5-8KB gzipped, tree-shakeable)
- **API surface expansion**: New configuration options and events for tile behavior
- **Testing complexity**: Additional test cases for tile loading and caching
- **Documentation burden**: Need to document both approaches and use cases

## Implementation Plan

### Phase 1: Foundation

- Create tile coordinate system (`src/tiles/TileCoordinateSystem.ts`)
- Implement basic tile loader (`src/tiles/TileLoader.ts`)
- Add tile configuration types (`src/tiles/types.ts`)
- Add a separate `src/tiles/index.ts` entry point and update `.size-limit.cjs` with a second limit entry (combined target ≤ 14 KB gzipped)

### Phase 2: Caching & Loading

- Implement LRU tile cache (`src/tiles/TileCache.ts`)
- Add view-based tile selection logic
- Implement priority loading queue

### Phase 3: Rendering

- Replace the static sphere mesh in `src/renderer/sphere.ts` with a zoom-aware generator. The current mesh is 16 latitude bands × 32 longitude bands (fixed). The new generator produces `2×2^z` latitude segments × `4×2^z` longitude segments at zoom z, so each grid cell maps to exactly one tile (e.g. z=2 → 8 lat × 16 lon; z=3 → 16 lat × 32 lon). The mesh is regenerated when the active zoom level changes.
- Implement per-tile texture rendering (primary path) in `src/renderer/TileRenderer.ts`
  - Fragment shader receives a `sampler2D` uniform per tile; UV is remapped from world-space UV to tile-local UV: `tileUV = (worldUV - tileOrigin) * tilesPerAxis`
  - Each tile issues one draw call against its single-segment geometry patch
- Optionally pack tiles into a `TEXTURE_2D_ARRAY` when `visibleCount ≤ MAX_ARRAY_TEXTURE_LAYERS` for a single-draw-call fast path; fragment shader uses `sampler2DArray` and a tile-index buffer
- Add smooth alpha transitions between zoom levels (`src/renderer/shaders.ts`)
- Pole handling: top and bottom rows use clamped UV to avoid singularities at ±90°; tiles in those rows are rendered at reduced subdivision to avoid vertex crowding
- Date-line handling: tiles at x=0 and x=tilesX-1 share the 0°/360° seam; UVs are clamped rather than wrapped to prevent a 1-texel bleed

### Phase 4: Integration

- Add `loadTiles(config: TileOptions): void` method to `PanoramaPlayer`
- Wire the `tiles` constructor option to auto-call `loadTiles()` after mount
- Add guard in `configure()` to throw when attempting to switch modes at runtime
- Handle edge cases: calling `loadImage()` after `loadTiles()` (and vice versa) disposes previous mode resources cleanly

### Phase 5: Testing & Optimization

- Unit tests for tile system components
- E2E tests for tile loading behavior
- Performance optimization and memory management
- Documentation updates

## Alternatives Considered

### Alternative 1: Progressive JPEG Loading

Load a single image with progressive JPEG encoding.

**Pros**: Simpler implementation, no server-side changes
**Cons**: Still loads entire image, limited quality control, no view-based optimization

### Alternative 2: Multiple Resolution Images

Load different resolution images based on viewport size.

**Pros**: Simpler than tiles, better bandwidth usage
**Cons**: Still loads full image at each resolution, no view-based optimization

### Alternative 3: WebGL Virtual Textures

Use WebGL virtual texture paging techniques.

**Pros**: Most sophisticated approach, excellent for huge textures
**Cons**: Very complex implementation, limited browser support, overkill for most use cases

### Alternative 4: Tile-Only Approach

Remove single-image mode and only support tile-based loading.

**Pros**: Simpler codebase, single code path to maintain
**Cons**: Breaking change, requires server-side processing for all use cases, overkill for small panoramas

**Decision**: Rejected - dual-mode approach provides better flexibility and backward compatibility

## Implementation Considerations

### User Experience & Migration

- **Tile Generation**: Provide reference script/tools for converting single panoramas to XYZ tile format
- **Mixed Scenarios**: Support both modes in same application; each player instance operates independently
- **Migration Path**: Existing implementations continue unchanged; tile mode is opt-in

### Performance & Resource Management

- **Memory Savings**: Expected 60-80% reduction for 8K+ panoramas (only visible tiles in memory)
- **CPU/GPU Overhead**: Minimal additional overhead from tile coordinate calculations and cache management
- **Cache Strategy**: LRU eviction with view-distance priority; memory-aware defaults
- **Memory-Aware Defaults**:
  ```typescript
  function getDefaultCacheSize(): number {
    // deviceMemory is undefined on browsers that don't support it; treat as high-memory.
    const isLowMemory =
      (navigator as any).deviceMemory != null && (navigator as any).deviceMemory <= 4;
    return isLowMemory ? 32 : 64;
  }
  ```
- **Texture Disposal**: Explicit WebGL texture deletion with `gl.deleteTexture()` on cache eviction
- **Concurrency**: Limit concurrent requests (default: 6); implement request queue with backpressure
- **Request Cancellation**: Each in-flight fetch is issued with an `AbortController`; when a tile leaves the priority queue (viewport pan/zoom-out), its controller is aborted to free concurrency slots immediately
- **Texture Array Limits**: Detect `gl.MAX_ARRAY_TEXTURE_LAYERS` at runtime; use texture arrays only when visible tile count fits within the limit. Fall back to per-tile textures (not single-image mode) when the limit is exceeded.

### Server-Side Requirements

- **Tile Generation**: Recommend using ImageMagick or GDAL for equirectangular → XYZ tile conversion
- **Directory Structure**: Standard `{z}/{x}/{y}.jpg` hierarchy; support custom URL patterns
- **CDN Caching**: Tiles are cacheable by default; recommend long cache headers (1 year)
- **Format Specifications**: JPEG/WebP with 85-90% quality; recommended tile size: 512×512 or 1024×1024
- **Tile Validation**: Runtime validation of tile dimensions and format
  ```typescript
  function validateTile(img: HTMLImageElement, expectedSize: number): void {
    if (img.width !== expectedSize || img.height !== expectedSize) {
      throw new Error(
        `Tile size mismatch: expected ${expectedSize}x${expectedSize}, got ${img.width}x${img.height}`,
      );
    }
  }
  ```

### Rendering Quality & Artifacts

- **Loading States**: Show lower zoom level tiles as placeholders; fade in higher resolution tiles
- **Seam Prevention**: Use linear filtering and slight overlap at tile boundaries
- **Failed Tiles**: Show error placeholder; retry with exponential backoff; fall back to lower zoom
- **WebGL1 Fallback**: Use texture atlas approach when texture arrays unavailable

### API Design Decisions

- **Explicit Mode Selection**: Mode is determined by which load method is called (`loadImage()` vs `loadTiles()`). The `tiles` constructor option is a convenience that auto-calls `loadTiles()` on mount; it does not change the mode at the type level.
- **Runtime Switching**: Not supported; recreate the player instance to switch modes. See Consequences → Negative.
- **`configure()` guard**: `PanoramaOptions.tiles` may be passed to `configure()` to update tile parameters (e.g. `cacheSize`, `preloadRadius`) while tile mode is active. Passing `tiles` via `configure()` when the player is in single-image mode (i.e. `loadImage()` was called and `loadTiles()` was not) will throw an `Error: cannot switch to tile mode via configure(); recreate the player instance`. Passing `tiles: undefined` to disable tile mode at runtime is likewise rejected.
- **Conflict Resolution**: If `loadImage()` and `loadTiles()` are both called on the same instance, the last call wins and the previous mode's resources are disposed. Using the constructor `tiles` shortcut alongside a subsequent `loadImage()` call follows the same rule.
- **DOM Decoupling**: Coordinate system accepts viewport dimensions as parameters for better testability

### Testing Strategy

- **Mock Tile Server**: Implement test fixture that serves tile images from local files
- **Performance Benchmarks**: Compare load time, memory usage, and rendering FPS between modes
- **Edge Cases**: Test rapid panning, network failures, WebGL context loss, memory pressure

### Bundle Size Impact

- **Current budget**: The project enforces a **6 KB gzip hard cap** via `.size-limit.cjs`. The tile system is estimated at +5–8 KB gzipped, which would exceed the cap for a single-entry build.
- **Resolution**: Ship tile support as a **separate entry point** (`panorama-player/tiles`) with its own size-limit entry. The main entry point (`PanoramaPlayer` + single-image mode) retains the 6 KB cap; the tile bundle gets its own limit (target: ≤ 14 KB gzipped combined). Update `.size-limit.cjs` as part of Phase 1.
- **Tree-Shaking**: Tile modules are in a separate `src/tiles/` subtree with no imports from the main entry; bundlers tree-shake them completely when the tile entry is unused.
- **Opt-Out**: Users importing only from the main entry pay no size penalty.

### Browser Compatibility

- **WebGL2 Texture Arrays**: Supported in Chrome 56+, Firefox 51+, Safari 14+
- **Feature Detection**: Detect WebGL2 support at runtime using `canvas.getContext('webgl2')`
- **Mobile Performance**: Test on iOS Safari and Chrome Android; implement memory limits
- **Known Issues**: iOS Safari may have texture size limits; implement graceful degradation
- **Context Loss Handling**: Listen for `webglcontextlost`/`webglcontextrestored` events; recreate textures on restore

### Error Handling & Resilience

- **Partial Failures**: Allow up to 20% failed tiles before showing error state
- **Network Timeouts**: 10-second timeout per tile via `AbortController` + `AbortSignal.timeout(10_000)`; implement retry with exponential backoff
- **Retry Logic**: Max 3 retries per tile with 1s, 2s, 4s delays; aborted requests (due to viewport change) are not retried
- **Request Deduplication**: Track pending requests separately from active requests; each request holds an `AbortController` so viewport-evicted tiles can be cancelled mid-flight without waiting for timeout
- **Failed Tile Fallback**: Show lower zoom level tiles as fallback; display error placeholder for missing tiles

### Future Extensibility

- **Cubemap Support**: Tile system designed to support multiple projection types
- **Multi-Resolution**: Coordinate system compatible with standard map tile providers
- **Projection Types**: Extensible for other spherical projections (Mercator, etc.)

### Documentation & Examples

- **Tile Generation**: Provide scripts and documentation for converting panoramas
- **Example Tile Sets**: Include sample tile sets in demo for testing
- **Demo Page**: Showcase both modes with side-by-side comparison

### Success Criteria

Baseline: single-image mode loading an 8K JPEG (~24 MB) on a simulated 20 Mbps connection, viewport 1920×1080, FOV 75°.

- **Load Time**: Time-to-first-render ≤ 50% of baseline (~12 s → ≤ 6 s) at z=0 initial load
- **Memory Usage**: GPU texture memory ≤ 40% of baseline for a 90°×60° viewport window (viewing ~15% of the panorama)
- **Bandwidth**: Total bytes transferred ≤ 30% of baseline for the same 90°×60° view
- **User Experience**: No tile seams or black patches visible during normal pan/zoom at 60 fps; lower-zoom placeholder tiles shown within 200 ms of mount

## References

- [Google Maps Tile Coordinates](https://developers.google.com/maps/documentation/javascript/coordinates)
- [Mapbox Tile Specification](https://docs.mapbox.com/help/glossary/tile-coverage/)
- [WebGL2 Texture Arrays](https://www.khronos.org/opengl/wiki/Array_Texture)
- [OpenStreetMap Tile Server](https://wiki.openstreetmap.org/wiki/Tile_servers)
- [GDAL Equirectangular to Tiles](https://gdal.org/programs/gdal2tiles.html)
- [ImageMagick Image Processing](https://imagemagick.org/script/command-line-processing.php)
