import { PointerInput } from './input/PointerInput.js';
import { WheelInput } from './input/WheelInput.js';
import { Renderer } from './renderer/Renderer.js';
import { TileRenderer } from './renderer/TileRenderer.js';
import {
  type PanoramaOptions,
  type PanoramaEvents,
  type ResolvedOptions,
  type View,
  type TileOptions,
  resolveOptions,
} from './types.js';
import { clamp, wrapDeg } from './utils/clamp.js';
import { loadImage } from './utils/loadImage.js';
import { acquireStyles, releaseStyles } from './utils/styles.js';
import {
  isFullscreenAvailable,
  requestFullscreen,
  exitFullscreen,
  isFullscreen,
  onFullscreenChange,
} from './utils/fullscreen.js';
import { TileManager } from './tiles/TileManager.js';

const FULLSCREEN_ENTER_ICON = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
</svg>`;

const FULLSCREEN_EXIT_ICON = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>
</svg>`;

export class PanoramaPlayer {
  private options: ResolvedOptions;
  private container: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private root: HTMLElement | null = null;
  private renderer: Renderer | null = null;
  private pointerInput: PointerInput | null = null;
  private wheelInput: WheelInput | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private rafHandle = 0;
  private dirty = true;
  private destroyed = false;
  private view: View;
  private hintElement: HTMLElement | null = null;
  private hintTimeout = 0;
  private fullscreenButton: HTMLElement | null = null;
  private unsubscribeFullscreenChange: (() => void) | null = null;
  private fullscreenToggling = false;
  private events: PanoramaEvents;
  private rotateThrottleTimer: number | null = null;
  private readonly rotateThrottleDelay = 16;
  private pendingRotatePayload: { view: View; deltaX: number; deltaY: number } | null = null;
  private rotating = false;

  // Tile mode properties
  private tileManager: TileManager | null = null;
  private tileRenderer: TileRenderer | null = null;
  private tileMode = false;
  private tileConfig: TileOptions | null = null;

  constructor(options?: PanoramaOptions) {
    this.options = resolveOptions(options);
    this.view = { ...this.options.initialView };
    this.events = options?.events || {};
  }

  private safeCall<T extends (...args: never[]) => void>(
    callback: T | undefined,
    ...args: Parameters<T>
  ): void {
    if (!callback) return;
    try {
      callback(...args);
    } catch (error) {
      console.error('panorama-player: event handler error', error);
    }
  }

  mount(container: HTMLElement): void {
    if (this.destroyed) throw new Error('panorama-player: cannot mount a destroyed player');
    if (this.container) throw new Error('panorama-player: already mounted');

    const doc = container.ownerDocument ?? document;
    acquireStyles(doc);

    const root = doc.createElement('div');
    root.className = 'panorama-player';

    const canvas = doc.createElement('canvas');
    canvas.className = 'panorama-player__canvas';
    root.appendChild(canvas);

    const hint = doc.createElement('div');
    hint.className = 'panorama-player__hint';
    const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform || '');
    hint.textContent = isMac ? 'Hold ⌘ and scroll to zoom' : 'Hold Ctrl and scroll to zoom';
    root.appendChild(hint);

    if (this.options.fullscreenEnabled && isFullscreenAvailable()) {
      const btn = doc.createElement('button');
      btn.className = 'panorama-player__fullscreen-btn';
      btn.setAttribute('type', 'button');
      btn.setAttribute('aria-label', 'Enter fullscreen');
      btn.innerHTML = this.getFullscreenIcon(false);
      btn.addEventListener('click', () => this.toggleFullscreen());
      root.appendChild(btn);
      this.fullscreenButton = btn;

      this.unsubscribeFullscreenChange = onFullscreenChange(() => {
        this.updateFullscreenButton();
      });
    }

    container.appendChild(root);

    this.container = container;
    this.root = root;
    this.hintElement = hint;
    this.renderer = new Renderer(canvas);
    // Renderer may have replaced the canvas (e.g. WebGL2 → WebGL1 fallback)
    this.canvas = this.renderer.canvas;

    this.pointerInput = new PointerInput(this.canvas, {
      onDrag: (dx, dy) => this.applyDrag(dx, dy),
      onDragEnd: () => this.applyDragEnd(),
      onPinch: (scale) => this.applyPinch(scale),
    });
    this.wheelInput = new WheelInput(
      this.canvas,
      {
        onWheel: (deltaY) => this.applyWheel(deltaY),
        onWheelRejected: () => this.showHint(),
      },
      this.options.wheelModifierRequired,
    );

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.handleResize());
      this.resizeObserver.observe(root);
    }
    this.handleResize();
    this.dirty = true;
    this.scheduleFrame();

    // Auto-load tiles if tiles option is provided
    if (this.options.tiles) {
      this.loadTiles(this.options.tiles).catch((error) => {
        this.safeCall(this.events.onError, { error, source: 'tiles' });
      });
    }

    this.safeCall(this.events.onMount, { container, canvas: this.canvas });
  }

  loadImage(src: string | HTMLImageElement): Promise<void> {
    if (!this.renderer) {
      return Promise.reject(new Error('panorama-player: mount() before loadImage()'));
    }

    // Dispose of tile mode if switching from tiles to single image
    if (this.tileMode) {
      this.disposeTileMode();
    }

    const renderer = this.renderer;
    return loadImage(src)
      .then((img) => {
        if (this.destroyed || this.renderer !== renderer) return;
        renderer.uploadImage(img);
        this.dirty = true;
        this.scheduleFrame();

        this.safeCall(this.events.onLoad, { image: img, view: { ...this.view } });
      })
      .catch((error) => {
        this.safeCall(this.events.onError, { error, source: src });
        throw error;
      });
  }

  loadTiles(config: TileOptions): Promise<void> {
    if (!this.renderer) {
      return Promise.reject(new Error('panorama-player: mount() before loadTiles()'));
    }

    // Dispose of single image mode if switching from single image to tiles
    if (!this.tileMode) {
      this.disposeSingleImageMode();
    }

    this.tileMode = true;
    this.tileConfig = config;

    // Initialize tile manager and renderer
    const gl = this.renderer.glContext;
    this.tileManager = new TileManager(gl, config, {
      width: this.root?.clientWidth || 1,
      height: this.root?.clientHeight || 1,
      dpr: this.options.devicePixelRatio,
      fov: this.view.fov,
    });

    this.tileRenderer = new TileRenderer(gl);
    this.tileRenderer.initialize();
    this.tileRenderer.updateGeometry(this.tileManager.getCurrentZoom());

    // Set up event callbacks
    this.tileManager.setEventCallbacks({
      onLoadStart: () => this.safeCall(this.events.onTileLoadStart),
      onLoadProgress: (progress) => this.safeCall(this.events.onTileLoadProgress, progress),
      onLoadComplete: () => this.safeCall(this.events.onTileLoadComplete),
      onError: (error) => this.safeCall(this.events.onTileError, error),
    });

    // Start loading tiles for current view
    this.loadTilesForCurrentView();

    return Promise.resolve();
  }

  private loadTilesForCurrentView(): void {
    if (!this.tileManager) return;

    // Convert view to UV coordinates
    const viewU = (this.view.yaw + 180) / 360;
    const viewV = (90 - this.view.pitch) / 180;

    this.tileManager.loadTilesForView(viewU, viewV, this.view.fov);
  }

  private disposeTileMode(): void {
    if (this.tileManager) {
      this.tileManager.dispose();
      this.tileManager = null;
    }
    if (this.tileRenderer) {
      this.tileRenderer.dispose();
      this.tileRenderer = null;
    }
    this.tileMode = false;
    this.tileConfig = null;
  }

  private disposeSingleImageMode(): void {
    // Single image mode doesn't need explicit cleanup
    // The renderer will handle texture replacement
  }

  configure(partial: Partial<PanoramaOptions>): void {
    // Guard against mode switching
    if (partial.tiles !== undefined) {
      if (this.tileMode && !partial.tiles) {
        throw new Error(
          'panorama-player: cannot disable tile mode via configure(); recreate the player instance',
        );
      }
      if (!this.tileMode && partial.tiles) {
        throw new Error(
          'panorama-player: cannot switch to tile mode via configure(); recreate the player instance',
        );
      }
    }

    this.options = resolveOptions({ ...this.optionsAsInput(), ...partial });
    this.applyConstraints();
    this.dirty = true;
    this.scheduleFrame();
  }

  setView(view: Partial<View>): void {
    if (view.yaw !== undefined) this.view.yaw = wrapDeg(view.yaw);
    if (view.pitch !== undefined) this.view.pitch = view.pitch;
    if (view.fov !== undefined) this.view.fov = view.fov;
    this.applyConstraints();

    this.safeCall(this.events.onRotate, {
      view: { ...this.view },
      deltaX: 0,
      deltaY: 0,
    });

    this.dirty = true;
    this.scheduleFrame();
  }

  getView(): View {
    return { ...this.view };
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    this.safeCall(this.events.onUnmount);

    if (this.rafHandle) {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = 0;
    }
    if (this.hintTimeout) {
      clearTimeout(this.hintTimeout);
      this.hintTimeout = 0;
    }
    this.clearRotateThrottle();
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.pointerInput?.dispose();
    this.pointerInput = null;
    this.wheelInput?.dispose();
    this.wheelInput = null;

    // Dispose of tile mode resources
    this.disposeTileMode();

    this.renderer?.dispose();
    this.renderer = null;
    this.unsubscribeFullscreenChange?.();
    this.unsubscribeFullscreenChange = null;
    this.fullscreenToggling = false;
    if (this.root && this.root.parentNode) this.root.parentNode.removeChild(this.root);
    this.root = null;
    this.canvas = null;
    this.hintElement = null;
    this.fullscreenButton = null;
    if (this.container) {
      releaseStyles(this.container.ownerDocument ?? document);
      this.container = null;
    }

    this.events = {};
  }

  private optionsAsInput(): PanoramaOptions {
    return {
      initialView: this.options.initialView,
      fovRange: this.options.fovRange,
      pitchRange: this.options.pitchRange,
      dragSpeed: this.options.dragSpeed,
      zoomSpeed: this.options.zoomSpeed,
      pinchSpeed: this.options.pinchSpeed,
      devicePixelRatio: this.options.devicePixelRatio,
      wheelModifierRequired: this.options.wheelModifierRequired,
      fullscreenEnabled: this.options.fullscreenEnabled,
      events: this.events,
    };
  }

  updateEvents(events: Partial<PanoramaEvents>): void {
    this.events = { ...this.events, ...events };
  }

  private applyConstraints(): void {
    const { fovRange, pitchRange } = this.options;
    this.view.pitch = clamp(this.view.pitch, pitchRange[0], pitchRange[1]);
    this.view.fov = clamp(this.view.fov, fovRange[0], fovRange[1]);
    this.view.yaw = wrapDeg(this.view.yaw);
  }

  private applyDrag(dxPx: number, dyPx: number): void {
    if (!this.canvas) return;

    if (!this.rotating) {
      this.rotating = true;
      this.safeCall(this.events.onRotateStart, { view: { ...this.view } });
    }

    const heightPx = this.canvas.clientHeight || 1;
    const fovScale = this.view.fov / heightPx;
    this.view.yaw = wrapDeg(this.view.yaw + dxPx * fovScale * this.options.dragSpeed * 4);
    this.view.pitch = clamp(
      this.view.pitch + dyPx * fovScale * this.options.dragSpeed * 4,
      this.options.pitchRange[0],
      this.options.pitchRange[1],
    );

    this.queueRotate({ view: { ...this.view }, deltaX: dxPx, deltaY: dyPx });

    this.dirty = true;
    this.scheduleFrame();
  }

  private applyDragEnd(): void {
    if (!this.rotating) return;
    this.flushRotate();
    this.rotating = false;
    this.safeCall(this.events.onRotateEnd, { view: { ...this.view } });
  }

  private queueRotate(payload: { view: View; deltaX: number; deltaY: number }): void {
    if (!this.events.onRotate) return;

    if (!this.rotateThrottleTimer) {
      this.safeCall(this.events.onRotate, payload);
      this.rotateThrottleTimer = window.setTimeout(
        () => this.flushRotate(),
        this.rotateThrottleDelay,
      );
      return;
    }

    this.pendingRotatePayload = payload;
  }

  private flushRotate(): void {
    if (this.rotateThrottleTimer) {
      clearTimeout(this.rotateThrottleTimer);
      this.rotateThrottleTimer = null;
    }

    const payload = this.pendingRotatePayload;
    this.pendingRotatePayload = null;
    if (payload) this.safeCall(this.events.onRotate, payload);
  }

  private clearRotateThrottle(): void {
    if (this.rotateThrottleTimer) {
      clearTimeout(this.rotateThrottleTimer);
      this.rotateThrottleTimer = null;
    }
    this.pendingRotatePayload = null;
    this.rotating = false;
  }

  private applyPinch(scale: number): void {
    const next = this.view.fov / Math.pow(scale, this.options.pinchSpeed);
    this.view.fov = clamp(next, this.options.fovRange[0], this.options.fovRange[1]);

    this.safeCall(this.events.onPinchZoom, { fov: this.view.fov, scale });

    this.dirty = true;
    this.scheduleFrame();
  }

  private applyWheel(deltaY: number): void {
    const next = this.view.fov + deltaY * this.options.zoomSpeed;
    this.view.fov = clamp(next, this.options.fovRange[0], this.options.fovRange[1]);
    this.hideHint();

    this.safeCall(this.events.onWheelZoom, { fov: this.view.fov, deltaY });

    this.dirty = true;
    this.scheduleFrame();
  }

  private showHint(): void {
    if (!this.hintElement) return;
    if (this.hintTimeout) clearTimeout(this.hintTimeout);
    this.hintElement.classList.add('visible');
    this.hintTimeout = window.setTimeout(() => {
      if (this.hintElement) {
        this.hintElement.classList.remove('visible');
      }
      this.hintTimeout = 0;
    }, 2000);
  }

  private hideHint(): void {
    if (!this.hintElement) return;
    if (this.hintTimeout) {
      clearTimeout(this.hintTimeout);
      this.hintTimeout = 0;
    }
    this.hintElement.classList.remove('visible');
  }

  private handleResize(): void {
    if (!this.canvas || !this.renderer || !this.root) return;
    const dpr = this.options.devicePixelRatio;
    const w = Math.max(1, Math.floor(this.root.clientWidth * dpr));
    const h = Math.max(1, Math.floor(this.root.clientHeight * dpr));
    this.renderer.resize(w, h);
    this.safeCall(this.events.onResize, {
      width: this.root.clientWidth,
      height: this.root.clientHeight,
      dpr,
    });

    this.dirty = true;
    this.scheduleFrame();
  }

  private scheduleFrame(): void {
    if (this.rafHandle || this.destroyed) return;
    this.rafHandle = requestAnimationFrame(() => {
      this.rafHandle = 0;
      if (this.destroyed) return;
      if (!this.dirty || !this.renderer) return;
      this.dirty = false;
      this.renderer.draw(this.view);
    });
  }

  private toggleFullscreen(): void {
    if (!this.root || this.fullscreenToggling) return;
    this.fullscreenToggling = true;
    const cleanup = () => {
      this.fullscreenToggling = false;
    };
    if (isFullscreen()) {
      exitFullscreen()
        .then(() => {
          this.safeCall(this.events.onFullscreenExit);
          cleanup();
        })
        .catch(() => {
          cleanup();
        });
    } else {
      requestFullscreen(this.root)
        .then(() => {
          if (this.root) {
            this.safeCall(this.events.onFullscreenEnter, { element: this.root });
          }
          cleanup();
        })
        .catch(() => {
          cleanup();
        });
    }
  }

  private updateFullscreenButton(): void {
    if (!this.fullscreenButton) return;
    const isFs = isFullscreen();
    this.fullscreenButton.innerHTML = this.getFullscreenIcon(isFs);
    this.fullscreenButton.setAttribute('aria-label', isFs ? 'Exit fullscreen' : 'Enter fullscreen');
  }

  private getFullscreenIcon(isFullscreen: boolean): string {
    return isFullscreen ? FULLSCREEN_EXIT_ICON : FULLSCREEN_ENTER_ICON;
  }
}
