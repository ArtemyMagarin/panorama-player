export interface View {
  yaw: number;
  pitch: number;
  fov: number;
}

export interface PanoramaOptions {
  initialView?: Partial<View>;
  fovRange?: [number, number];
  pitchRange?: [number, number];
  dragSpeed?: number;
  zoomSpeed?: number;
  pinchSpeed?: number;
  devicePixelRatio?: number;
}

export interface ResolvedOptions {
  initialView: View;
  fovRange: [number, number];
  pitchRange: [number, number];
  dragSpeed: number;
  zoomSpeed: number;
  pinchSpeed: number;
  devicePixelRatio: number;
}

export const DEFAULTS: ResolvedOptions = {
  initialView: { yaw: 0, pitch: 0, fov: 75 },
  fovRange: [30, 100],
  pitchRange: [-89, 89],
  dragSpeed: 0.25,
  zoomSpeed: 0.05,
  pinchSpeed: 0.5,
  devicePixelRatio: typeof window !== 'undefined' ? Math.min(window.devicePixelRatio ?? 1, 2) : 1,
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
  };
}
