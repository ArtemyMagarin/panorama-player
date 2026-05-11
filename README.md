# panorama-player

Browser-only WebGL2 player for equirectangular panoramas. Framework-agnostic, **zero runtime dependencies**, multiple players per page, mouse + touch + wheel + pinch.

## Install

```sh
pnpm add panorama-player
```

## Usage

```ts
import { PanoramaPlayer } from 'panorama-player';

const host = document.getElementById('host')!;
const player = new PanoramaPlayer({
  initialView: { yaw: 0, pitch: 0, fov: 75 },
  fovRange: [30, 100],
  pitchRange: [-89, 89],
});

player.mount(host);
await player.loadImage('/panorama.jpg');

// later
player.setView({ yaw: 90 });
player.destroy();
```

## Interactions

- **Drag (mouse / touch)**: pointer drag rotates yaw and pitch.
- **Scroll wheel**: requires **Ctrl** (or **⌘ Cmd** on Mac). Rotate wheel to zoom in/out. Scroll without modifier allows page scrolling — an overlay hint appears showing the correct modifier for your platform.
- **Pinch (touch)**: two-finger pinch zooms in/out.

## API

| Method                            | Description                                                                |
| --------------------------------- | -------------------------------------------------------------------------- |
| `new PanoramaPlayer(options?)`    | Construct an unmounted player.                                             |
| `mount(container)`                | Insert canvas into `container`, attach input listeners, start render loop. |
| `loadImage(src)`                  | Load `string \| HTMLImageElement` and upload as the panorama texture.      |
| `setView({ yaw?, pitch?, fov? })` | Imperatively set the view; values are clamped/wrapped.                     |
| `getView()`                       | Returns current `{ yaw, pitch, fov }` (degrees).                           |
| `configure(partial)`              | Update options at runtime; constraints reapplied.                          |
| `destroy()`                       | Detach listeners, dispose WebGL resources, remove canvas.                  |

### Options

```ts
interface PanoramaOptions {
  initialView?: { yaw?: number; pitch?: number; fov?: number };
  fovRange?: [number, number]; // default [30, 100]
  pitchRange?: [number, number]; // default [-89, 89]
  dragSpeed?: number; // default 0.25
  zoomSpeed?: number; // default 0.05 (wheel)
  pinchSpeed?: number; // default 0.5
  devicePixelRatio?: number; // default min(window.devicePixelRatio, 2)
  wheelModifierRequired?: boolean; // default true; if true, wheel zoom requires Ctrl/Cmd key
}
```

## Multiple instances

Each `PanoramaPlayer` owns its own canvas + WebGL2 context + texture. The shared stylesheet (`#panorama-player-styles`) is reference-counted: injected once on first `mount`, removed when the last player is destroyed.

## Demo

**Live demo:** https://your-username.github.io/panorama-player (after deploying)

Or locally:
1. `pnpm build`
2. Open `demo/index.html` in your browser

**Features:**
- Upload your own 2:1 equirectangular images via drag-drop
- Try example panoramas from the gallery
- No external dependencies, runs entirely in the browser

## Development

```sh
pnpm install
pnpm typecheck
pnpm test            # Jest unit tests
pnpm e2e:install     # one-time browser install
pnpm test:e2e        # builds dist, generates fixture, runs Playwright
pnpm build           # emits dist/ (ESM + .d.ts)
```

## License

MIT
