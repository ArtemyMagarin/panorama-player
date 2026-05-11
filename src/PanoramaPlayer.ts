import { PointerInput } from './input/PointerInput.js';
import { WheelInput } from './input/WheelInput.js';
import { Renderer } from './renderer/Renderer.js';
import { type PanoramaOptions, type ResolvedOptions, type View, resolveOptions } from './types.js';
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

  constructor(options?: PanoramaOptions) {
    this.options = resolveOptions(options);
    this.view = { ...this.options.initialView };
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
  }

  loadImage(src: string | HTMLImageElement): Promise<void> {
    if (!this.renderer) {
      return Promise.reject(new Error('panorama-player: mount() before loadImage()'));
    }
    const renderer = this.renderer;
    return loadImage(src).then((img) => {
      if (this.destroyed || this.renderer !== renderer) return;
      renderer.uploadImage(img);
      this.dirty = true;
      this.scheduleFrame();
    });
  }

  configure(partial: Partial<PanoramaOptions>): void {
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
    this.dirty = true;
    this.scheduleFrame();
  }

  getView(): View {
    return { ...this.view };
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.rafHandle) {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = 0;
    }
    if (this.hintTimeout) {
      clearTimeout(this.hintTimeout);
      this.hintTimeout = 0;
    }
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.pointerInput?.dispose();
    this.pointerInput = null;
    this.wheelInput?.dispose();
    this.wheelInput = null;
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
    };
  }

  private applyConstraints(): void {
    const { fovRange, pitchRange } = this.options;
    this.view.pitch = clamp(this.view.pitch, pitchRange[0], pitchRange[1]);
    this.view.fov = clamp(this.view.fov, fovRange[0], fovRange[1]);
    this.view.yaw = wrapDeg(this.view.yaw);
  }

  private applyDrag(dxPx: number, dyPx: number): void {
    if (!this.canvas) return;
    const heightPx = this.canvas.clientHeight || 1;
    const fovScale = this.view.fov / heightPx;
    this.view.yaw = wrapDeg(this.view.yaw + dxPx * fovScale * this.options.dragSpeed * 4);
    this.view.pitch = clamp(
      this.view.pitch + dyPx * fovScale * this.options.dragSpeed * 4,
      this.options.pitchRange[0],
      this.options.pitchRange[1],
    );
    this.dirty = true;
    this.scheduleFrame();
  }

  private applyPinch(scale: number): void {
    const next = this.view.fov / Math.pow(scale, this.options.pinchSpeed);
    this.view.fov = clamp(next, this.options.fovRange[0], this.options.fovRange[1]);
    this.dirty = true;
    this.scheduleFrame();
  }

  private applyWheel(deltaY: number): void {
    const next = this.view.fov + deltaY * this.options.zoomSpeed;
    this.view.fov = clamp(next, this.options.fovRange[0], this.options.fovRange[1]);
    this.hideHint();
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
        .then(cleanup)
        .catch(() => {
          cleanup();
        });
    } else {
      requestFullscreen(this.root)
        .then(cleanup)
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
