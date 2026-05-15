export interface View {
  yaw: number;
  pitch: number;
  fov: number;
}

export interface PanoramaEvents {
  onMount?: (payload: { container: HTMLElement; canvas: HTMLCanvasElement }) => void;
  onUnmount?: () => void;
  onRotateStart?: (payload: { view: View }) => void;
  onRotate?: (payload: { view: View; deltaX: number; deltaY: number }) => void;
  onRotateEnd?: (payload: { view: View }) => void;
  onWheelZoom?: (payload: { fov: number; deltaY: number }) => void;
  onPinchZoom?: (payload: { fov: number; scale: number }) => void;
  onFullscreenEnter?: (payload: { element: HTMLElement }) => void;
  onFullscreenExit?: () => void;
  onResize?: (payload: { width: number; height: number; dpr: number }) => void;
  onLoad?: (payload: { image: HTMLImageElement; view: View }) => void;
  onError?: (payload: { error: Error; source: string | HTMLImageElement }) => void;
  onTileLoadStart?: () => void;
  onTileLoadProgress?: (payload: { loaded: number; total: number; zoom: number }) => void;
  onTileLoadComplete?: () => void;
  onTileError?: (payload: { error: Error; tile: { z: number; x: number; y: number } }) => void;
}

export interface TileOptions {
  baseUrl: string;
  minZoom: number;
  maxZoom: number;
  tileSize: number;
  cacheSize: number;
  preloadRadius: number;
  maxConcurrentRequests: number;
  adaptiveZoom: boolean;
}

export interface PanoramaOptions {
  initialView?: Partial<View>;
  fovRange?: [number, number];
  pitchRange?: [number, number];
  dragSpeed?: number;
  zoomSpeed?: number;
  pinchSpeed?: number;
  devicePixelRatio?: number;
  wheelModifierRequired?: boolean;
  fullscreenEnabled?: boolean;
  events?: PanoramaEvents;
  tiles?: TileOptions;
}

export interface ResolvedOptions {
  initialView: View;
  fovRange: [number, number];
  pitchRange: [number, number];
  dragSpeed: number;
  zoomSpeed: number;
  pinchSpeed: number;
  devicePixelRatio: number;
  wheelModifierRequired: boolean;
  fullscreenEnabled: boolean;
  tiles?: TileOptions;
}

export const DEFAULTS: ResolvedOptions = {
  initialView: { yaw: 0, pitch: 0, fov: 75 },
  fovRange: [30, 100],
  pitchRange: [-89, 89],
  dragSpeed: 0.25,
  zoomSpeed: 0.05,
  pinchSpeed: 0.5,
  devicePixelRatio: typeof window !== 'undefined' ? Math.min(window.devicePixelRatio ?? 1, 2) : 1,
  wheelModifierRequired: true,
  fullscreenEnabled: true,
};

export function resolveOptions(opts?: PanoramaOptions): ResolvedOptions {
  return {
    initialView: { ...DEFAULTS.initialView, ...(opts?.initialView ?? {}) },
    fovRange: opts?.fovRange ?? DEFAULTS.fovRange,
    pitchRange: opts?.pitchRange ?? DEFAULTS.pitchRange,
    dragSpeed: opts?.dragSpeed ?? DEFAULTS.dragSpeed,
    zoomSpeed: opts?.zoomSpeed ?? DEFAULTS.zoomSpeed,
    pinchSpeed: opts?.pinchSpeed ?? DEFAULTS.pinchSpeed,
    devicePixelRatio: opts?.devicePixelRatio ?? DEFAULTS.devicePixelRatio,
    wheelModifierRequired: opts?.wheelModifierRequired ?? DEFAULTS.wheelModifierRequired,
    fullscreenEnabled: opts?.fullscreenEnabled ?? DEFAULTS.fullscreenEnabled,
    tiles: opts?.tiles,
  };
}
