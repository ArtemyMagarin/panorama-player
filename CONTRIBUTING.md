# Development Guide for panorama-player

This guide helps developers and coding agents understand the architecture, codebase structure, and workflows for contributing to panorama-player.

## Project Overview

**panorama-player** is a lightweight, framework-agnostic WebGL2 player for equirectangular panorama images. Key characteristics:

- **Zero runtime dependencies** — only TypeScript + standard browser APIs
- **Multiple instances** — many players can coexist on one page
- **Mobile-friendly** — supports touch drag, pinch zoom, and adaptive DPI
- **Resilient** — WebGL1 fallback for older devices, handles context loss gracefully
- **Small bundle** — ~6KB minified, optimized for production

### Why these choices?

- **WebGL2 primary, WebGL1 fallback**: WebGL2 provides better performance and simpler shader syntax, but older devices (iPad 6, etc.) need WebGL1 GLSL ES 100 shaders
- **Manual matrix math**: No gl-matrix dependency; we only need 4 core functions (identity, perspective, rotationX, rotationY)
- **Canvas swapping on WebGL2 failure**: WebKit bug — after `getContext('webgl2')` is called, subsequent `getContext('webgl')` on same canvas returns null; we create a fresh canvas for WebGL1 fallback
- **Reference-counted stylesheet**: Multiple players share one injected `<style>` element via acquire/release pattern
- **Pointer Events API**: Covers mouse, touch, pen uniformly; simpler than separate mousedown/touchstart handlers
- **rAF + dirty flag**: Only redraw when state changes (input, loadImage, setView, resize)

## Directory Structure

```
src/
  index.ts                    # Public exports (PanoramaPlayer, PanoramaOptions, View)
  types.ts                    # Options, View, DEFAULTS, resolveOptions()
  PanoramaPlayer.ts           # Orchestrator: lifecycle, input callbacks, view state

  renderer/
    Renderer.ts               # WebGL program, buffers, texture, draw loop, context creation
    shaders.ts                # GLSL: both WebGL2 (v300) and WebGL1 (ES 100) variants
    sphere.ts                 # buildSphere(latBands, lonBands) → { positions, uvs, indices }

  input/
    PointerInput.ts           # Pointer drag → yaw/pitch deltas (mouse + touch unified)
    WheelInput.ts             # Wheel + modifier check → FOV delta (or hint if rejected)

  math/
    mat4.ts                   # Matrix ops: identity, perspective, rotationX, rotationY, multiply
    camera.ts                 # buildViewProjection(view, aspect) → combined view-proj matrix

  utils/
    clamp.ts                  # clamp(v, min, max), wrapDeg(v), degToRad(v)
    loadImage.ts              # Converts string/HTMLImageElement → HTMLImageElement
    styles.ts                 # ref-counted stylesheet injector

tests/unit/
  *.test.ts                   # Jest tests for utilities, math, input, styles

e2e/
  pages/
    single.html               # Test page with wheelModifierRequired: true (default)
    no-modifier-required.html # Test page with wheelModifierRequired: false
    multi.html                # Two independent players

  drag.spec.ts                # Pointer drag direction, vertical pitch clamping
  zoom.spec.ts                # Wheel zoom with/without modifier, pinch zoom
  scroll.spec.ts              # Page scroll unaffected when no modifier
  multi.spec.ts               # Instance isolation, stylesheet ref-counting

demo/
  demo.js                     # Interactive demo: upload images, gallery, player reuse
  index.html                  # Entry point
  styles.css                  # Demo styling
```

## Key Architectural Patterns

### 1. Input → State → Render

Inputs (drag, wheel, pinch) call callbacks like `applyDrag()`, `applyWheel()`, `applyPinch()`. These modify `this.view` (yaw, pitch, fov) and set `dirty = true`. On next rAF, `draw()` reads the view and renders.

```typescript
// PointerInput detects drag
onDrag: (dx, dy) => this.applyDrag(dx, dy)

// PanoramaPlayer updates state
private applyDrag(dxPx, dyPx) {
  this.view.yaw += dxPx * ...;  // Positive dx = rightward drag
  this.dirty = true;
}

// rAF-driven render
private scheduleFrame() {
  this.rafHandle = requestAnimationFrame(() => {
    if (this.dirty && this.renderer) {
      this.renderer.draw(this.view);
    }
  });
}
```

### 2. WebGL Context Management

**Renderer.ts** handles both creation and recovery:

- Tries `getContext('webgl2')` with minimal attributes
- If WebGL2 unavailable/lost, swaps canvas and tries `getContext('webgl')`
- Listens to `webglcontextlost` / `webglcontextrestored` events
- On restoration, reinitializes program, buffers, texture
- On `destroy()`, disposes all GPU resources and calls `loseContext()`

**Key gotchas:**

- Canvas must NOT be in a `display: none` container when creating context (iOS Safari issue)
- Explicit 1×1 canvas dimensions before `getContext()` helps with some iOS versions
- Minimal context attributes reduce GPU memory pressure on low-end devices

### 3. Shader Variants

Both **WebGL2 (v300 ES)** and **WebGL1 (ES 100)** shaders compute the same transformation:

- **Vertex**: Transform sphere position by view-projection matrix
- **Fragment**: Sample equirectangular texture using interpolated UV

**Differences:**

- WebGL2: `layout(location = N)`, `in/out`, `texture()`
- WebGL1: `bindAttribLocation()`, `attribute/varying`, `texture2D()`, `gl_FragColor`

The renderer selects shaders at runtime based on `this.isWebGL2`.

### 4. Sphere Geometry

`buildSphere(latBands, lonBands)` generates:

- **positions**: Float32Array of 3D vertices on unit sphere
- **uvs**: Float32Array of texture coordinates (u = atan2(z,x)/2π + 0.5, v = asin(y)/π + 0.5)
- **indices**: Uint16Array of triangle indices
- **indexCount**: Quick access for draw call

Recomputed per-instance (geometry is cheap, GPU context is not shareable).

### 5. Reference-Counted Stylesheet

`utils/styles.ts` manages a single shared `<style id="panorama-player-styles">`:

```typescript
acquireStyles(doc); // First call: inject <style>; increment counter
releaseStyles(doc); // Last call (counter = 0): remove <style>
```

Multiple instances call `acquire` in `mount()`, `release` in `destroy()`. This saves DOM bloat and ensures CSS rules are loaded once.

### 6. Input Direction Conventions

**Horizontal drag:**

- Rightward drag (positive dx) → yaw **increases** → view rotates left (see left side)
- Leftward drag (negative dx) → yaw **decreases** → view rotates right

**Vertical drag:**

- Downward drag (positive dy) → pitch **increases** → view rotates up

**Wheel:**

- Scroll down (negative deltaY) → fov decreases → zoom in
- Scroll up (positive deltaY) → fov increases → zoom out

**Pinch:**

- Two fingers moving apart (distance increases) → fov decreases → zoom in
- Two fingers moving together (distance decreases) → fov increases → zoom out

## Workflow

### Running Locally

```bash
pnpm install
pnpm typecheck    # Check TS types
pnpm test         # Run Jest unit tests
pnpm build        # Emit dist/ (ESM + .d.ts)
```

### E2E Testing

```bash
pnpm e2e:install  # One-time: install Playwright browsers
pnpm test:e2e     # Build, generate fixture, run Playwright on chromium + mobile
```

E2E tests in `e2e/pages/` and `e2e/*.spec.ts` run against real WebGL contexts. They verify:

- Drag direction and clamping
- Wheel zoom with/without modifier
- Pinch zoom
- Page scrolling unaffected
- Multi-instance isolation
- Stylesheet ref-counting

### Demo

```bash
pnpm build
pnpm demo         # Serves demo/ on localhost:3000 (or similar)
```

Or open `demo/index.html` directly after build.

## Common Tasks

### Add a New Option

1. Add to `PanoramaOptions` in `src/types.ts`
2. Add default to `DEFAULTS` constant
3. Add to `resolveOptions()` return object
4. Use in `PanoramaPlayer` (e.g., pass to `WheelInput`)
5. Add test case to `tests/unit/`

### Fix a Bug

1. Write a test that reproduces it (Jest or Playwright)
2. Fix the code
3. Verify test passes + all existing tests still pass
4. Commit with `fix:` prefix

### Add a Feature

1. Sketch the behavior (docs/comments)
2. Implement core logic with unit tests
3. Add e2e test if it affects user interaction
4. Update README if it's user-facing
5. Commit with `feat:` prefix

### Handle New Device Issues

- **Context creation fails**: Check `Renderer.createContext()` logic. Likely need to adjust canvas dimensions, context attributes, or add more robust fallback.
- **Shader doesn't compile**: Verify GLSL syntax matches both WebGL2 v300 and WebGL1 ES 100 rules.
- **Touch inaccuracy**: Check pointer event coordinate handling in `PointerInput.ts`; iOS sometimes reports stale clientX/clientY.
- **Memory leak**: Ensure `dispose()` is called; check for lingering event listeners or GPU resources.

## Testing Philosophy

- **Unit tests** (Jest): Pure functions, math, utilities. No DOM needed (jsdom).
- **E2E tests** (Playwright): Real browser, real WebGL, real interactions. Tests the full flow.
- **Manual testing**: Demo page on actual target devices (old iPad, etc.) to catch runtime quirks.

## Common Gotchas

1. **Forgotten `preventDef
ault()` on wheel**: Page scrolls even when zooming.
2. **Canvas in hidden container**: WebGL context creation fails silently on iOS.
3. **No canvas swap on WebGL1 fallback**: `getContext('webgl')` returns null after WebGL2 attempt.
4. **Forgetting `hideHint()` in `applyWheel()`**: Hint persists after successful zoom.
5. **Not clearing `rafHandle` on destroy**: rAF keeps firing, wastes CPU.
6. **Stale `this` in listeners**: Use arrow functions or bind explicitly.
7. **Browser caching old dist**: Always hard-refresh (Ctrl+Shift+R) after rebuild.

## Code Style

- **No comments by default**: Code should be self-explanatory. Comment only the "why" if non-obvious (e.g., WebKit bugs, performance trade-offs).
- **Arrow functions in class properties**: Ensures `this` is bound; avoids `.bind()` boilerplate.
- **Type annotations**: Always annotate function params and returns.
- **Single responsibility**: Each file does one thing well (Renderer handles WebGL, PointerInput handles pointer events, etc.).
- **No premature abstractions**: If it's used once, don't factor it out.

## Commit Message Format

Use Conventional Commits:

```
feat: add dark mode toggle              # New feature
fix: correct horizontal drag direction  # Bug fix
refactor: simplify matrix multiplication # Code improvement
test: add test for pinch zoom           # Test addition
docs: update README with new API        # Documentation
build: upgrade TypeScript to 5.5        # Build system
chore: remove debug logging             # Maintenance

# Use imperative mood. Good: "add", "fix", "refactor". Bad: "added", "fixed", "refactored"
```

## Performance Notes

- Sphere geometry: 16×32 bands = 544 vertices, 3,072 triangles. Balanced for low-end devices.
- Matrix math: Hand-written (no gl-matrix). Only 4 functions used, so dependency not justified.
- Shader precision: `highp` for vertex math (needed for large fov/aspect), appropriate precision for fragment.
- Texture filtering: `LINEAR` (no mipmaps); equirectangular wrapping at poles handled by shader.
- rAF scheduling: Only when `dirty = true`; saves CPU/battery on static scenes.

## Future Improvements

- [ ] Cubemap texture support (six faces instead of equirectangular)
- [ ] Animated panorama transitions (crossfade between images)
- [ ] Gyroscope/accelerometer input on mobile
- [ ] Custom vertex/fragment shader injection (advanced use case)
- [ ] WEBP/AVIF image format support with fallbacks

---

**Questions?** Check the commit history (`git log --oneline`) for context on past decisions, or review the plan at the root of the repo (CLAUDE.md).
