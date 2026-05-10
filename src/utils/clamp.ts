export function clamp(value: number, min: number, max: number): number {
  if (min > max) {
    const t = min;
    min = max;
    max = t;
  }
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export function wrapDeg(value: number): number {
  let v = value % 360;
  if (v > 180) v -= 360;
  else if (v < -180) v += 360;
  return v + 0;
}

export const degToRad = (d: number): number => (d * Math.PI) / 180;
export const radToDeg = (r: number): number => (r * 180) / Math.PI;
